import {
  CARS_PER_PAGE,
  WINNERS_PER_PAGE,
  TRACK_PADDING,
  FINISH_OFFSET,
  BREAKDOWN_CONFIG,
  getBreakdownChance,
  getBreakdownType,
  triggerBreakdown,
} from "../config/index.ts";

import { showBreakdownNotification } from "./notifications.ts";

import type { CarRace } from "../types/index.ts";

import {
  startEngine,
  getVelocity,
  driveCar,
  startRace,
  resetRace,
  recordWinner,
} from "../api/index.ts";

import { state } from "../state/index.ts";
import { element } from "./builder.ts";

// ============ УТИЛИТЫ ============
export const getCarRace = (id: number): CarRace | undefined => state.race.carRaces[id];

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

export const getCarElement = (id: number): HTMLElement | null =>
  document.querySelector(`.car-road[data-id="${CSS.escape(String(id))}"] .car`);

export const getRoadElement = (id: number): HTMLElement | null =>
  document.querySelector(`.car-road[data-id="${CSS.escape(String(id))}"]`);

export const getTrackWidth = (road: HTMLElement): number =>
  road.offsetWidth - TRACK_PADDING;

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

    if (startButton.disabled) {
      startButton.setAttribute("disabled", "");
    } else {
      startButton.removeAttribute("disabled");
    }

    if (stopButton.disabled) {
      stopButton.setAttribute("disabled", "");
    } else {
      stopButton.removeAttribute("disabled");
    }
  }
};

// ============ УПРАВЛЕНИЕ ГОНКОЙ ============
export const removeWinnerMessage = (): void => {
  document.querySelector(".winner-message")?.remove();
};

export const showWinnerMessage = (carName: string, time: number): void => {
  const app = document.querySelector("#app");
  if (!(app instanceof HTMLElement)) return;

  const message = element("div", { class: "winner-message" },
    `🏆 ${carName} wins with time ${time.toFixed(2)}s!`
  );
  app.insertBefore(message, app.firstChild);
};

export const showBreakdownMessage = (carId: number, type: string): void => {
  const app = document.querySelector("#app");
  if (!(app instanceof HTMLElement)) return;

  const messages: Record<string, string> = {
    engine_overheating: "Engine overheating!",
    transmission_failure: "Transmission failure!",
    start_stall: "Stalled at start!",
    random_breakdown: "Random breakdown!",
  };

  const message = element(
    "div",
    {
      class: "breakdown-message",
      style: "position: fixed; top: 20px; right: 20px; background: #ff4444; color: white; padding: 10px; border-radius: 5px; z-index: 1000;",
    },
    `${messages[type] ?? "Breakdown!"} (Car ${carId})`
  );

  app.append(message);

  setTimeout(() => {
    message.remove();
  }, 3000);
};

export const resetCarPositions = (carIds: number[]): void => {
  carIds.forEach(id => {
    const car = getCarElement(id);
    if (car instanceof HTMLElement) {
      car.style.transform = "translateX(0px)";
    }
  });
};

// ============ АНИМАЦИЯ ============
export const animateCarRace = (carId: number, race: CarRace): void => {
  const car = getCarElement(carId);
  if (!(car instanceof HTMLElement)) return;

  if (race.broken) {
    car.classList.add("broken");

    if (race.breakdownHistory && race.breakdownHistory.count < BREAKDOWN_CONFIG.MAX_BREAKDOWNS) {
      if (race.repairStartTime === undefined) {
        race.repairStartTime = performance.now();
        race.isRepairing = true;
        console.log(`Starting repair for car ${carId}...`);
        updateCarButtonStates();
        return;
      }

      const repairElapsed = (performance.now() - race.repairStartTime) / 1000;
      if (repairElapsed >= BREAKDOWN_CONFIG.REPAIR_TIME) {
        race.broken = false;
        race.isRepairing = false;
        race.repairStartTime = undefined;
        car.classList.remove("broken");
        console.log(`Car ${carId} repaired!`);

        const currentTransform = car.style.transform;
        const match = currentTransform.match(/translateX\(([-\d.]+)px\)/);
        const currentLeft = match ? parseFloat(match[1]) : 0;
        car.dataset.lastPosition = String(currentLeft);
        updateCarButtonStates();
        return;
      }

      const repairProgress = repairElapsed / BREAKDOWN_CONFIG.REPAIR_TIME;
      car.style.opacity = String(0.3 + repairProgress * 0.7);
      updateCarButtonStates();
      return;
    }

    console.log(`Car ${carId} is out of the race!`);
    updateCarButtonStates();
    return;
  }

  const road = car.parentElement;
  if (!(road instanceof HTMLElement)) return;

  const trackWidth = getTrackWidth(road);
  const elapsed = performance.now() - race.startTime;
  const elapsedSeconds = elapsed / 1000;
  const progress = Math.min(1, elapsed * race.velocity / trackWidth);
  const left = progress * trackWidth;

  car.style.transform = `translateX(${Math.min(left, trackWidth - FINISH_OFFSET)}px)`;
  car.dataset.lastPosition = String(left);

  if (race.isRepairing) {
    car.style.opacity = "1";
    race.isRepairing = false;
  }

  const breakdownChance = getBreakdownChance(progress, race.velocity, elapsedSeconds);

  if (Math.random() < breakdownChance) {
    const breakdownType = getBreakdownType(progress, race.velocity);

    race.broken = true;
    if (!race.breakdownHistory) {
      race.breakdownHistory = { count: 0, timestamps: [], positions: [], types: [] };
    }
    race.breakdownHistory.count++;
    race.breakdownHistory.timestamps.push(performance.now());
    race.breakdownHistory.positions.push(progress);
    race.breakdownHistory.types.push(breakdownType);

    car.classList.add("broken");
    car.classList.add(`broken-${breakdownType}`);

    switch (breakdownType) {
      case "engine_overheating":
        car.style.transform = `translateX(${left}px) scale(1.1)`;
        console.log(`Car ${carId} engine overheated at ${Math.round(progress * 100)}%!`);
        break;
      case "transmission_failure":
        car.style.transform = `translateX(${left}px) rotate(5deg)`;
        console.log(`Car ${carId} transmission failed at ${Math.round(progress * 100)}%!`);
        break;
      case "start_stall":
        console.log(`Car ${carId} stalled at start!`);
        break;
      default:
        console.log(`Car ${carId} broke down at ${Math.round(progress * 100)}%!`);
    }

    showBreakdownMessage(carId, breakdownType);
    updateCarButtonStates();

    // Принудительная активация кнопки B при поломке
    const stopButton = document.querySelector<HTMLButtonElement>(`.btn-stop-engine[data-id="${CSS.escape(String(carId))}"]`);
    if (stopButton) {
      stopButton.disabled = false;
      stopButton.removeAttribute("disabled");
    }

    const startButton = document.querySelector<HTMLButtonElement>(`.btn-start-engine[data-id="${CSS.escape(String(carId))}"]`);
    if (startButton) {
      startButton.disabled = true;
      startButton.setAttribute("disabled", "");
    }

    return;
  }

  if (left >= trackWidth - FINISH_OFFSET) {
    handleCarFinish(carId, race, elapsed);
  }
};

export const handleCarFinish = (carId: number, race: CarRace, elapsed: number): void => {
  if (race.broken) return;

  race.finished = true;

  const road = getRoadElement(carId);
  if (road instanceof HTMLElement) {
    const trackWidth = getTrackWidth(road);
    race.time = trackWidth / race.velocity;
  } else {
    race.time = elapsed / 1000;
  }

  void driveCar(carId).catch(error => console.error("Failed to drive car:", error));
  updateCarButtonStates();

  // Принудительная активация кнопки B при финише
  const stopButton = document.querySelector<HTMLButtonElement>(`.btn-stop-engine[data-id="${CSS.escape(String(carId))}"]`);
  if (stopButton) {
    stopButton.disabled = false;
    stopButton.removeAttribute("disabled");
  }

  if (!state.race.winnerAnnounced) {
    state.race.winnerAnnounced = true;
    const car = state.garage.cars.find(c => c.id === carId);
    if (car) {
      void recordWinner({
        carId: car.id,
        carName: car.name,
        carColor: car.color,
        time: race.time,
      });
      showWinnerMessage(car.name, race.time);
    }
  }
};

export const animateRace = (): void => {
  if (!state.race.isRacing) return;

  let allFinished = true;

  Object.entries(state.race.carRaces).forEach(([idStr, race]) => {
    if (race.finished || race.broken) return;
    allFinished = false;
    animateCarRace(Number(idStr), race);
  });

  if (allFinished) {
    state.race.isRacing = false;
    state.race.animationId = 0;

    updateCarButtonStates();
    return;
  }

  state.race.animationId = requestAnimationFrame(animateRace);
};

// ============ ОБРАБОТКА ИЗМЕНЕНИЯ РАЗМЕРА ============
export const handleResize = (): void => {
  const updateCarPosition = (id: number, startTime: number, velocity: number): void => {
    const car = getCarElement(id);
    if (!(car instanceof HTMLElement)) return;

    const road = car.parentElement;
    if (!(road instanceof HTMLElement)) return;

    const trackWidth = getTrackWidth(road);
    const elapsed = performance.now() - startTime;
    const progress = Math.min(1, elapsed * velocity / trackWidth);
    const left = Math.min(progress * trackWidth, trackWidth - FINISH_OFFSET);
    car.style.transform = `translateX(${left}px)`;
  };

  Object.entries(state.race.carRaces).forEach(([idStr, race]) => {
    if (!race.finished && !race.broken) {
      updateCarPosition(Number(idStr), race.startTime, race.velocity);
    }
  });

  Object.entries(state.race.drivingCars).forEach(([idStr, drive]) => {
    updateCarPosition(Number(idStr), drive.startTime, drive.velocity);
  });
};

// ============ ОБРАБОТЧИКИ ГОНКИ ============
export const startRaceHandler = async (): Promise<void> => {
  if (state.race.isRacing) return;

  const carIds = state.garage.cars.map(c => c.id);
  if (carIds.length === 0) return;

  removeWinnerMessage();
  state.race.isRacing = true;
  state.race.winnerAnnounced = false;

  await startRace(carIds);
  await Promise.all(carIds.map(id => startEngine(id)));

  const velocities = await Promise.allSettled(carIds.map(id => getVelocity(id)));
  const now = performance.now();

  state.race.carRaces = {};
  carIds.forEach((id, index) => {
    const result = velocities[index];
    const isBroken = result.status === "rejected";

    state.race.carRaces[id] = {
      startTime: now,
      velocity: result.status === "fulfilled" ? result.value : 0.5,
      finished: false,
      broken: isBroken,
      time: undefined,
      breakdownHistory: {
        count: isBroken ? 1 : 0,
        timestamps: isBroken ? [now] : [],
        positions: isBroken ? [0] : [],
        types: isBroken ? ["start_stall"] : [],
      },
      repairStartTime: undefined,
      isRepairing: false,
    };

    if (isBroken) {
      console.log(`Car ${id} broke down at start!`);
      const car = getCarElement(id);
      if (car instanceof HTMLElement) {
        car.classList.add("broken");
        car.classList.add("broken-start_stall");
      }
    }
  });

  resetCarPositions(carIds);
  updateCarButtonStates();
  animateRace();
};

export const resetRaceHandler = async (): Promise<void> => {
  if (state.race.animationId) {
    cancelAnimationFrame(state.race.animationId);
    state.race.animationId = 0;
  }
  if (state.race.driveAnimationId) {
    cancelAnimationFrame(state.race.driveAnimationId);
    state.race.driveAnimationId = 0;
  }

  state.race.isRacing = false;
  state.race.carRaces = {};
  state.race.drivingCars = {};
  state.race.winnerAnnounced = false;

  document.querySelectorAll(".car").forEach(car => {
    if (car instanceof HTMLElement) {
      car.classList.remove("broken");
      car.classList.remove("broken-engine_overheating", "broken-transmission_failure", "broken-start_stall", "broken-random_breakdown");
      car.style.transform = "translateX(0px)";
      car.style.opacity = "1";
      car.style.scale = "1";
      car.style.rotate = "0deg";
      delete car.dataset.lastPosition;
    }
  });

  document.querySelectorAll(".breakdown-message").forEach(el => el.remove());

  const carIds = state.garage.cars.map(c => c.id);
  if (carIds.length > 0) {
    await resetRace(carIds);
  }

  updateCarButtonStates();
};

// ============ ДВИЖЕНИЕ АВТОМОБИЛЯ ============
export const animateDriveCar = (): void => {
  const now = performance.now();
  const entries = Object.entries(state.race.drivingCars);

  entries.forEach(([idStr, drive]) => {
    const carId = Number(idStr);
    const carElement = getCarElement(carId);
    if (!(carElement instanceof HTMLElement)) return;

    const road = carElement.parentElement;
    if (!(road instanceof HTMLElement)) return;

    const trackWidth = getTrackWidth(road);
    const elapsed = now - drive.startTime;
    const progress = Math.min(1, elapsed * drive.velocity / trackWidth);
    const left = Math.min(progress * trackWidth, trackWidth - FINISH_OFFSET);
    carElement.style.transform = `translateX(${left}px)`;

    if (progress >= 1) {
      delete state.race.drivingCars[carId];
      const existing = state.race.carRaces[carId];
      if (existing) {
        existing.finished = true;
      } else {
        state.race.carRaces[carId] = {
          startTime: drive.startTime,
          velocity: drive.velocity,
          finished: true,
          broken: false,
          time: undefined,
        };
      }
      void driveCar(carId)
        .then(updateCarButtonStates)
        .catch(error => {
          console.error("Failed to drive car:", error);
          updateCarButtonStates();
        });
    }
  });

  if (Object.keys(state.race.drivingCars).length > 0) {
    state.race.driveAnimationId = requestAnimationFrame(animateDriveCar);
  }
};

export const startDriveCar = async (carId: number): Promise<void> => {
  const velocity = await getVelocity(carId);

  if (state.race.carRaces[carId]) {
    state.race.carRaces[carId].finished = false;
    state.race.carRaces[carId].broken = false;
  }

  state.race.drivingCars[carId] = { startTime: performance.now(), velocity };

  const carElement = getCarElement(carId);
  if (carElement instanceof HTMLElement) {
    carElement.style.transform = "translateX(0px)";
  }

  updateCarButtonStates();

  if (Object.keys(state.race.drivingCars).length === 1) {
    animateDriveCar();
  }
};

export const stopDriveCar = (carId: number): void => {
  delete state.race.drivingCars[carId];

  if (state.race.carRaces[carId]) {
    state.race.carRaces[carId].finished = true;
  }

  const carElement = getCarElement(carId);
  if (carElement instanceof HTMLElement) {
    carElement.style.transform = "translateX(0px)";
  }

  updateCarButtonStates();
};

export const resetCarToStart = (carId: number): void => {
  if (state.race.animationId) {
    cancelAnimationFrame(state.race.animationId);
    state.race.animationId = 0;
  }
  state.race.isRacing = false;

  if (state.race.carRaces[carId]) {
    const race = state.race.carRaces[carId];
    race.broken = false;
    race.finished = false;
    race.time = undefined;
  }

  const car = getCarElement(carId);
  if (car instanceof HTMLElement) {
    car.classList.remove("broken");
    const road = car.parentElement;
    if (road instanceof HTMLElement) {
      const trackWidth = getTrackWidth(road);
      const currentTransform = car.style.transform;
      const match = currentTransform.match(/translateX\(([-\d.]+)px\)/);
      const currentLeft = match ? parseFloat(match[1]) : 0;
      const duration = Math.max(300, (currentLeft / trackWidth) * 500);

      car.style.transition = `transform ${duration}ms ease-out`;
      car.style.transform = "translateX(0px)";
      setTimeout(() => {
        car.style.transition = "";
      }, duration);
    }
  }

  updateCarButtonStates();
};

// ============ ИНИЦИАЛИЗАЦИЯ ============
export const init = (): void => {
  const resizeObserver = new ResizeObserver(handleResize);
  resizeObserver.observe(document.body);
};
