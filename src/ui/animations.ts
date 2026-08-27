import {
  CONFIG,
  BREAKDOWN_CONFIG,
  getBreakdownChance,
  getBreakdownType,
  speedToProgressPerMs,
} from "../config/index.ts";

import { showBreakdownNotification, showWinnerNotification, type BrokenCar } from "./notifications.ts";

import type { Car, CarRace, DrivingCar } from "../types/index.ts";

import {
  recordWinnerAction,
  findCarById,
  getCarRace,
  stopRaceAnimation,
} from "../state/index.ts";

import { state } from "../state/index.ts";
import { resetCarVisualReset } from "./helpers.ts";

// ============ УТИЛИТЫ ============
export const isCarRacing = (id: number): boolean => {
  const race = getCarRace(id);
  return !!race && !race.finished && !race.broken;
};

export const isCarBroken = (id: number): boolean => {
  const race = getCarRace(id);
  return !!race && race.broken;
};

export const isCarFinished = (id: number): boolean => {
  const race = getCarRace(id);
  return !!race && race.finished && !race.broken;
};

export const getCarElement = (id: number): HTMLElement | undefined => {
  const element = document.querySelector(`.car-road[data-id="${CSS.escape(String(id))}"] .car`);
  if (!(element instanceof HTMLElement)) {
    return undefined;
  }
  return element;
};

const getRoad = (car: HTMLElement): HTMLElement | undefined => {
  const road = car.parentElement;
  return road instanceof HTMLElement ? road : undefined;
};

export const getTrackWidth = (road: HTMLElement): number =>
  road.offsetWidth - CONFIG.UI.TRACK_PADDING;

// ============ ОБНОВЛЕНИЕ ПОЗИЦИИ МАШИНЫ ============
export const updateCarPosition = (car: HTMLElement, startTime: number, maxSpeed: number): void => {
  const road = getRoad(car);
  if (!road) return;

  const trackWidth = getTrackWidth(road);
  const elapsed = performance.now() - startTime;
  const effectiveSpeed = maxSpeed / CONFIG.PHYSICS.TIME_DILATION;
  const progressPerMs = speedToProgressPerMs(effectiveSpeed);
  const left = Math.min(elapsed * progressPerMs * trackWidth, trackWidth - CONFIG.UI.FINISH_OFFSET);
  car.style.transform = `translateX(${left}px)`;
  car.dataset.lastPosition = String(left);
};

// ============ ОБНОВЛЕНИЕ СОСТОЯНИЯ КНОПОК ============
export const updateCarButtonStates = (): void => {
  for (const car of state.garage.cars) {
    const carId = Number(car.id);
    const startButton = document.querySelector<HTMLButtonElement>(
      `.btn-start-engine[data-id="${CSS.escape(String(carId))}"]`
    );
    const stopButton = document.querySelector<HTMLButtonElement>(
      `.btn-stop-engine[data-id="${CSS.escape(String(carId))}"]`
    );

    if (!startButton || !stopButton) continue;

    const isDriving = state.race.drivingCars[carId] !== undefined ||
      (state.race.isRacing && isCarRacing(carId));
    const isBroken = isCarBroken(carId);
    const isFinished = isCarFinished(carId);

    startButton.disabled = isDriving || isBroken || isFinished;
    stopButton.disabled = !isDriving && !isBroken && !isFinished;

    startButton.toggleAttribute("disabled", startButton.disabled);
    stopButton.toggleAttribute("disabled", stopButton.disabled);
  }
};

// ============ ОБНОВЛЕНИЕ КНОПОК УПРАВЛЕНИЯ ГОНКОЙ ============
export const updateRaceControls = (): void => {
  const startButton = document.querySelector<HTMLButtonElement>("#btn-start-race");
  if (!startButton) return;

  startButton.disabled = state.race.isRacing;
  startButton.toggleAttribute("disabled", startButton.disabled);
};

// ============ СБРОС ПОЗИЦИЙ И СОСТОЯНИЯ ============
export const resetCarPositions = (carIds: number[]): void => {
  for (const id of carIds) {
    const car = getCarElement(id);
    if (car) {
      car.style.transform = "translateX(0px)";
    }
  }
};

export const resetCarVisualState = (carIds: number[]): void => {
  for (const id of carIds) {
    const car = getCarElement(id);
    if (car) {
      resetCarVisualReset(car, true);
    }
  }
};

// ============ АНИМАЦИЯ ============
export const animateCarRace = (carId: number, race: CarRace): void => {
  const car = getCarElement(carId);
  if (!car) {
    return;
  }

  if (race.broken) {
    handleBrokenCar(carId, car, race);
    return;
  }

  animateCarMovement(carId, car, race);
};

// ============ ОБРАБОТКА СЛОМАННОЙ МАШИНЫ ============
const handleBrokenCar = (
  carId: number,
  car: HTMLElement,
  race: CarRace,
): void => {
  car.classList.add("broken");

  if (race.breakdownHistory && race.breakdownHistory.count < BREAKDOWN_CONFIG.MAX_BREAKDOWNS) {
    handleRepairProgress(carId, car, race);
    return;
  }

  updateCarButtonStates();
};

const handleRepairProgress = (
  carId: number,
  car: HTMLElement,
  race: CarRace,
): void => {
  if (race.repairStartTime === undefined) {
    race.repairStartTime = performance.now();
    race.isRepairing = true;
    updateCarButtonStates();
    return;
  }

  const repairElapsed = (performance.now() - race.repairStartTime) / 1000;
  if (repairElapsed >= BREAKDOWN_CONFIG.REPAIR_TIME) {
    race.broken = false;
    race.isRepairing = false;
    race.repairStartTime = undefined;
    car.classList.remove("broken");

    const currentTransform = car.style.transform;
    const match = currentTransform.match(/translateX\(([-\d.]+)px\)/);
    const currentLeft = match ? Number(match[1]) : 0;
    car.dataset.lastPosition = String(currentLeft);
    updateCarButtonStates();
    return;
  }

  const repairProgress = repairElapsed / BREAKDOWN_CONFIG.REPAIR_TIME;
  car.style.opacity = String(0.3 + repairProgress * 0.7);
  updateCarButtonStates();
};

// ============ АНИМАЦИЯ ДВИЖЕНИЯ ============
const animateCarMovement = (
  carId: number,
  car: HTMLElement,
  race: CarRace,
): void => {
  const road = getRoad(car);
  if (!road) {
    return;
  }

  const trackWidth = getTrackWidth(road);
  const elapsed = performance.now() - race.startTime;
  const elapsedSeconds = elapsed / 1000;
  const effectiveSpeed = race.maxSpeed / CONFIG.PHYSICS.TIME_DILATION;
  const progressPerMs = speedToProgressPerMs(effectiveSpeed);
  const left = Math.min(elapsed * progressPerMs * trackWidth, trackWidth - CONFIG.UI.FINISH_OFFSET);
  const progress = left / trackWidth;

  car.style.transform = `translateX(${Math.min(left, trackWidth - CONFIG.UI.FINISH_OFFSET)}px)`;
  car.dataset.lastPosition = String(left);

  if (race.isRepairing) {
    car.style.opacity = "1";
    race.isRepairing = false;
  }

  const breakdownChance = getBreakdownChance(progress, race.maxSpeed, elapsedSeconds);

  if (Math.random() < breakdownChance) {
    handleCarBreakdown(carId, car, race, progress, left);
    return;
  }

  if (left >= trackWidth - CONFIG.UI.FINISH_OFFSET) {
    handleCarFinish(carId, race, elapsed);
  }
};

// ============ ОБРАБОТКА ПОЛОМКИ ============
const handleCarBreakdown = (
  carId: number,
  car: HTMLElement,
  race: CarRace,
  progress: number,
  left: number,
): void => {
  const breakdownType = getBreakdownType(progress, race.maxSpeed);

  race.broken = true;
  race.breakdownHistory.count++;
  race.breakdownHistory.timestamps.push(performance.now());
  race.breakdownHistory.positions.push(progress);
  race.breakdownHistory.types.push(breakdownType);

  applyBreakdownVisuals(car, breakdownType, left, progress, carId);
  showBreakdownNotification(breakdownType);
  updateCarButtonStates();
  updateCarButtonsOnBreakdown(carId);
};

// ============ ВИЗУАЛЬНЫЕ ЭФФЕКТЫ ПОЛОМКИ ============
const applyBreakdownVisuals = (
  car: HTMLElement,
  breakdownType: string,
  left: number,
  _progress: number,
  _carId: number,
): void => {
  car.classList.add("broken", `broken-${breakdownType}`);

  switch (breakdownType) {
    case "engine_overheating": {
      car.style.transform = `translateX(${left}px) scale(1.1)`;
      break;
    }
    case "transmission_failure": {
      car.style.transform = `translateX(${left}px) rotate(5deg)`;
      break;
    }
    case "start_stall": {
      break;
    }
    default: {
      break;
    }
  }
};

// ============ ОБНОВЛЕНИЕ КНОПОК ПРИ ПОЛОМКЕ ============
const updateCarButtonsOnBreakdown = (carId: number): void => {
  const stopButton = document.querySelector<HTMLButtonElement>(
    `.btn-stop-engine[data-id="${CSS.escape(String(carId))}"]`,
  );
  if (stopButton) {
    stopButton.disabled = false;
    stopButton.removeAttribute("disabled");
  }

  const startButton = document.querySelector<HTMLButtonElement>(
    `.btn-start-engine[data-id="${CSS.escape(String(carId))}"]`,
  );
  if (startButton) {
    startButton.disabled = true;
    startButton.setAttribute("disabled", "");
  }
};

export const handleCarFinish = (carId: number, race: CarRace, elapsed: number): void => {
  if (race.broken) return;

  race.finished = true;
  race.time = (elapsed * CONFIG.PHYSICS.TIME_DILATION) / 1000;

  updateCarButtonStates();

  const stopButton = document.querySelector<HTMLButtonElement>(`.btn-stop-engine[data-id="${CSS.escape(String(carId))}"]`);
  if (stopButton) {
    stopButton.disabled = false;
    stopButton.removeAttribute("disabled");
  }

  if (!state.race.winnerAnnounced) {
    state.race.winnerAnnounced = true;
    const car = findCarById(carId);
    if (car) {
      const brokenCars = collectBrokenCars();
      announceWinner(car, race.time, brokenCars);
    }
  }
};

// ============ СБОР СЛОМАННЫХ МАШИН ============
const collectBrokenCars = (): BrokenCar[] => {
  const brokenCars: BrokenCar[] = [];
  for (const race of Object.values(state.race.carRaces)) {
    if (!race.broken || !race.breakdownHistory || race.breakdownHistory.count === 0) {
      continue;
    }

    const car = findCarById(race.carId);
    if (car) {
      const lastType = race.breakdownHistory.types.at(-1);
      if (lastType !== undefined) {
        brokenCars.push({
          id: car.id,
          name: car.name,
          type: lastType,
        });
      }
    }

  }
  return brokenCars;
};

// ============ ОБЪЯВЛЕНИЕ ПОБЕДИТЕЛЯ ============
const announceWinner = (
  car: Car,
  time: number,
  brokenCars: BrokenCar[],
): void => {
  void recordWinnerAction({
    carId: car.id,
    carName: car.name,
    carColor: car.color,
    time,
  });
  showWinnerNotification(car.name, time, brokenCars);
};

export const animateRace = (): void => {
  if (!state.race.isRacing) return;

  let hasAllFinished = true;

  for (const [idString, race] of Object.entries(state.race.carRaces)) {
    if (race.finished || race.broken) continue;
    hasAllFinished = false;
    animateCarRace(Number(idString), race);
  }

  if (hasAllFinished) {
    state.race.isRacing = false;
    state.race.animationId = 0;
    updateCarButtonStates();
    updateRaceControls();
    return;
  }

  state.race.animationId = requestAnimationFrame(animateRace);
};

// ============ ОБРАБОТКА ИЗМЕНЕНИЯ РАЗМЕРА ============
export const handleResize = (): void => {
  for (const [idString, race] of Object.entries(state.race.carRaces)) {
    if (race.finished || race.broken) continue;
    const car = getCarElement(Number(idString));
    if (car) updateCarPosition(car, race.startTime, race.maxSpeed);
  }

  for (const [idString, drive] of Object.entries(state.race.drivingCars)) {
    const car = getCarElement(Number(idString));
    if (car) updateCarPosition(car, drive.startTime, drive.maxSpeed);
  }
};

// ============ ДВИЖЕНИЕ АВТОМОБИЛЯ ============
export const animateDriveCar = (): void => {
  for (const [idString, drive] of Object.entries(state.race.drivingCars)) {
    const carId = Number(idString);

    const carElement = getCarElement(carId);
    if (!carElement) {
      continue;
    }

    updateCarPosition(carElement, drive.startTime, drive.maxSpeed);

    const road = getRoad(carElement);
    if (!road) {
      continue;
    }

    const trackWidth = getTrackWidth(road);
    const left = Number(carElement.dataset.lastPosition ?? "0");

    if (left >= trackWidth - CONFIG.UI.FINISH_OFFSET) {
      handleDriveCarFinished(carId, drive);
    }
  }

  if (Object.keys(state.race.drivingCars).length > 0) {
    state.race.driveAnimationId = requestAnimationFrame(animateDriveCar);
  }
};

// ============ ЗАВЕРШЕНИЕ ЕЗДЫ ============
const handleDriveCarFinished = (carId: number, drive: DrivingCar): void => {
  delete state.race.drivingCars[carId];
  handleDriveCarComplete(carId, drive);
};

const handleDriveCarComplete = (carId: number, drive: DrivingCar): void => {
  const existing = state.race.carRaces[carId];
  const elapsed = (performance.now() - drive.startTime) * CONFIG.PHYSICS.TIME_DILATION / 1000;
  if (existing) {
    existing.finished = true;
    existing.time = elapsed;
  } else {
    state.race.carRaces[carId] = createDefaultFinishedRace(carId, drive, elapsed);
  }
};

const createDefaultFinishedRace = (carId: number, drive: DrivingCar, elapsed: number): CarRace => ({
  carId,
  startTime: drive.startTime,
  maxSpeed: drive.maxSpeed,
  finished: true,
  broken: false,
  time: elapsed,
  breakdownHistory: { count: 0, timestamps: [], positions: [], types: [] },
});

export const startDriveCar = async (carId: number, maxSpeed: number = 250): Promise<void> => {
  if (Object.hasOwn(state.race.carRaces, carId)) {
    state.race.carRaces[carId].finished = false;
    state.race.carRaces[carId].broken = false;
  }

  state.race.drivingCars[carId] = { startTime: performance.now(), maxSpeed };

  const carElement = getCarElement(carId);
  if (carElement) {
    carElement.style.transform = "translateX(0px)";
  }

  updateCarButtonStates();

  if (Object.keys(state.race.drivingCars).length > 0) {
    animateDriveCar();
  }
};

export const updateDriveCarSpeed = (carId: number, newSpeed: number): void => {
  const drive = state.race.drivingCars[carId];
  if (!drive) return;

  const carElement = getCarElement(carId);
  if (!carElement) {
    drive.maxSpeed = newSpeed;
    return;
  }

  const currentTransform = carElement.style.transform;
  const match = currentTransform.match(/translateX\(([-\d.]+)px\)/);
  const currentLeft = match ? Number(match[1]) : 0;

  const road = getRoad(carElement);
  if (!road) {
    drive.maxSpeed = newSpeed;
    return;
  }

  const trackWidth = getTrackWidth(road);
  const effectiveSpeed = newSpeed / CONFIG.PHYSICS.TIME_DILATION;
  const progressPerMs = speedToProgressPerMs(effectiveSpeed);

  drive.maxSpeed = newSpeed;
  drive.startTime = performance.now() - (currentLeft / (progressPerMs * trackWidth));
};

export const stopDriveCarInPlace = (carId: number): void => {
  delete state.race.drivingCars[carId];

  updateCarButtonStates();
};

export const stopDriveCar = (carId: number): void => {
  delete state.race.drivingCars[carId];

  if (Object.hasOwn(state.race.carRaces, carId)) {
    state.race.carRaces[carId].finished = true;
  }

  const carElement = getCarElement(carId);
  if (carElement) {
    const currentTransform = carElement.style.transform;
    const match = currentTransform.match(/translateX\(([-\d.]+)px\)/);
    const currentLeft = match ? Number(match[1]) : 0;
    const duration = Math.max(300, (currentLeft / 1000) * 500);

    carElement.style.transition = `transform ${duration}ms ease-out`;
    carElement.style.transform = "translateX(0px)";
    setTimeout(() => {
      carElement.style.transition = "";
    }, duration);
  }

  updateCarButtonStates();
};

export const resetCarToStart = (carId: number): void => {
  stopRaceAnimation();

  if (Object.hasOwn(state.race.carRaces, carId)) {
    const race = state.race.carRaces[carId];
    race.broken = false;
    race.finished = false;
    race.time = undefined;
  }

  const car = getCarElement(carId);
  if (!car) return;

  car.classList.remove("broken");
  const road = getRoad(car);
  if (!road) return;

  const trackWidth = getTrackWidth(road);
  const currentTransform = car.style.transform;
  const match = currentTransform.match(/translateX\(([-\d.]+)px\)/);
  const currentLeft = match ? Number(match[1]) : 0;
  const duration = Math.max(300, (currentLeft / trackWidth) * 500);

  car.style.transition = `transform ${duration}ms ease-out`;
  car.style.transform = "translateX(0px)";
  setTimeout(() => {
    car.style.transition = "";
  }, duration);

  updateCarButtonStates();
};

// ============ ИНИЦИААЛИЗАЦИЯ ============
const observers: { resize?: ResizeObserver } = {};

export const init = (): void => {
  observers.resize = new ResizeObserver(handleResize);
  observers.resize.observe(document.body);
};

export const destroy = (): void => {
  if (!observers.resize) return;
  observers.resize.disconnect();
  observers.resize = undefined;
};
