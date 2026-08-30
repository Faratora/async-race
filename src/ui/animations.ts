import {
  CONFIG,
  BREAKDOWN_CONFIG,
  getBreakdownChance,
  getBreakdownType,
  speedToProgressPerMs,
  createEmptyBreakdownHistory,
} from "../config/index.ts";

import { showWinnerNotification, type BrokenCar } from "./notifications.ts";

import type { Car, CarRace, DrivingCar } from "../types/index.ts";

import {
  recordWinnerAction,
  findCarById,
  getCarRace,
  stopRaceAnimation,
} from "../state/index.ts";

import { state } from "../state/index.ts";
import { resetCarVisualReset } from "./helpers.ts";
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

const getCurrentLeft = (car: HTMLElement): number => {
  const match = car.style.transform.match(/translateX\(([-\d.]+)px\)/);
  return match ? Number(match[1]) : 0;
};

export const getTrackWidth = (road: HTMLElement): number =>
  road.offsetWidth - CONFIG.UI.TRACK_PADDING;

// ============ УТИЛИТЫ РАСЧЁТА ПОЗИЦИИ ============

interface CarPosition {
  left: number;
  progress: number;
  trackWidth: number;
}

const calculateCarPosition = (
  road: HTMLElement,
  startTime: number,
  maxSpeed: number,
): CarPosition => {
  const trackWidth = getTrackWidth(road);
  const elapsed = performance.now() - startTime;
  const effectiveSpeed = maxSpeed / CONFIG.PHYSICS.TIME_DILATION;
  const progressPerMs = speedToProgressPerMs(effectiveSpeed);
  const left = Math.min(elapsed * progressPerMs * trackWidth, trackWidth - CONFIG.UI.FINISH_OFFSET);
  const progress = left / trackWidth;
  return { left, progress, trackWidth };
};

// ============ ОБНОВЛЕНИЕ ПОЗИЦИИ МАШИНЫ ============
export const updateCarPosition = (car: HTMLElement, startTime: number, maxSpeed: number): void => {
  const road = getRoad(car);
  if (!road) return;

  const { left } = calculateCarPosition(road, startTime, maxSpeed);
  car.style.transform = `translateX(${left}px)`;
  car.dataset.lastPosition = String(left);
};

export const computeCarStates = (carId: number): { isDriving: boolean; isBroken: boolean; isFinished: boolean } => {
  const isDriving = state.race.drivingCars[carId] !== undefined ||
    (state.race.isRacing && isCarRacing(carId));
  const isBroken = isCarBroken(carId);
  const isFinished = isCarFinished(carId);
  return { isDriving, isBroken, isFinished };
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

    const { isDriving, isBroken, isFinished } = computeCarStates(carId);

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
  _race: CarRace,
): void => {
  car.classList.add("broken");
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

  const { left, progress, trackWidth } = calculateCarPosition(road, race.startTime, race.maxSpeed);
  const elapsed = performance.now() - race.startTime;
  const elapsedSeconds = elapsed / 1000;

  car.style.transform = `translateX(${left}px)`;
  car.dataset.lastPosition = String(left);

  if (race.isRepairing) {
    car.style.opacity = "1";
    race.isRepairing = false;
  }

  const breakdownChance = getBreakdownChance(progress, race.maxSpeed, elapsedSeconds);

  // Ограничиваем общее количество поломок в гонке
  if (state.race.totalBreakdowns >= BREAKDOWN_CONFIG.MAX_BREAKDOWNS_PER_RACE) {
    // Лимит поломок достигнут — больше не ломаем машины
    if (left >= trackWidth - CONFIG.UI.FINISH_OFFSET) {
      handleCarFinish(carId, race, elapsed);
    }
    return;
  }

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
  state.race.totalBreakdowns++;
  race.breakdownHistory.timestamps.push(performance.now());
  race.breakdownHistory.positions.push(progress);
  race.breakdownHistory.types.push(breakdownType);

  applyBreakdownVisuals(car, breakdownType, left, progress, carId);
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

// ============ УТИЛИТЫ УПРАВЛЕНИЯ КНОПКАМИ ============

const setCarButtonEnabled = (carId: number, kind: "start" | "stop", isEnabled: boolean): void => {
  const selector = kind === "start" ? ".btn-start-engine" : ".btn-stop-engine";
  const button = document.querySelector<HTMLButtonElement>(
    `${selector}[data-id="${CSS.escape(String(carId))}"]`,
  );
  if (!button) return;
  button.disabled = !isEnabled;
  button.toggleAttribute("disabled", !isEnabled);
};

// ============ ОБНОВЛЕНИЕ КНОПОК ПРИ ПОЛОМКЕ ============
const updateCarButtonsOnBreakdown = (carId: number): void => {
  setCarButtonEnabled(carId, "stop", true);
  setCarButtonEnabled(carId, "start", false);
};

export const handleCarFinish = (carId: number, race: CarRace, elapsed: number): void => {
  if (race.broken) return;

  race.finished = true;
  race.time = (elapsed * CONFIG.PHYSICS.TIME_DILATION * CONFIG.PHYSICS.TIME_MULTIPLIER) / 1000;

  updateCarButtonStates();
  setCarButtonEnabled(carId, "stop", true);

  if (!state.race.winnerAnnounced) {
    state.race.winnerAnnounced = true;
    state.race.winnerCarId = carId;
  }
};

// ============ СБОР СЛОМАННЫХ МАШИН ============
const collectBrokenCars = (): BrokenCar[] => {
  const brokenCars: BrokenCar[] = [];
  for (const race of Object.values(state.race.carRaces)) {
    if (race.breakdownHistory.count === 0 || !race.broken) {
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

// ============ ЗАПИСЬ ПОБЕДИТЕЛЯ ============
const recordWinnerForCar = (car: Car, time: number | null | undefined): void => {
  void recordWinnerAction({
    carId: car.id,
    carName: car.name,
    carColor: car.color,
    time,
  });
};

// ============ ОБЪЯВЛЕНИЕ ПОБЕДИТЕЛЯ ============
const announceWinner = (
  car: Car,
  time: number,
  brokenCars: BrokenCar[],
): void => {
  recordWinnerForCar(car, time);
  showWinnerNotification(car.name, time, brokenCars);
};

// ============ ЗАПИСЬ ОСТАЛЬНЫХ ФИНИШЕРАВОВ ============
const recordRemainingFinishers = (
  winnerCarId: number | undefined,
): void => {
  for (const [idString, race] of Object.entries(state.race.carRaces)) {
    if (!race.finished && !race.broken) continue;
    const carId = Number(idString);
    if (winnerCarId !== undefined && carId === winnerCarId) continue;

    const car = findCarById(carId);
    if (car) {
      recordWinnerForCar(car, race.finished ? race.time ?? null : null);
    }
  }
};

// ============ ОБЪЯВЛЕНИЕ ПОБЕДИТЕЛЯ ============
const announceWinnerForFinishedRace = (winnerCarId: number | undefined): void => {
  if (winnerCarId === undefined) return;

  const winnerCar = findCarById(winnerCarId);
  if (!winnerCar) return;

  const race = state.race.carRaces[winnerCarId];
  const time = race?.time ?? 0;
  const brokenCars = collectBrokenCars();
  announceWinner(winnerCar, time, brokenCars);
  recordRemainingFinishers(winnerCarId);
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

    if (!state.race.winnerRecorded) {
      state.race.winnerRecorded = true;
      announceWinnerForFinishedRace(state.race.winnerCarId);
    }

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
  breakdownHistory: createEmptyBreakdownHistory(),
});

export const startDriveCar = async (carId: number, maxSpeed: number = 250): Promise<void> => {
  if (Object.hasOwn(state.race.carRaces, carId)) {
    state.race.carRaces[carId].finished = false;
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

  const currentLeft = getCurrentLeft(carElement);

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

  // Фиксируем текущую позицию машины
  const carElement = getCarElement(carId);
  if (carElement) {
    carElement.style.transition = "none";
    const currentLeft = getCurrentLeft(carElement);
    carElement.style.transform = `translateX(${currentLeft}px)`;
    carElement.dataset.lastPosition = String(currentLeft);
  }

  updateCarButtonStates();
};

const animateCarToStart = (car: HTMLElement, duration: number): void => {
  car.style.transition = `transform ${duration}ms ease-out`;
  car.style.transform = "translateX(0px)";
  setTimeout(() => {
    car.style.transition = "";
  }, duration);
};

export const stopDriveCar = (carId: number): void => {
  delete state.race.drivingCars[carId];

  if (Object.hasOwn(state.race.carRaces, carId)) {
    state.race.carRaces[carId].finished = true;
  }

  const carElement = getCarElement(carId);
  if (carElement) {
    const currentLeft = getCurrentLeft(carElement);
    animateCarToStart(carElement, Math.max(300, (currentLeft / 1000) * 500));
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

  resetCarVisualReset(car);

  const road = getRoad(car);
  if (!road) return;

  const trackWidth = getTrackWidth(road);
  const currentLeft = getCurrentLeft(car);
  animateCarToStart(car, Math.max(300, (currentLeft / trackWidth) * 500));

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
