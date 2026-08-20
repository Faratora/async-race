import type { CarRace } from "../types/index.ts";

import {
  startEngine,
  getVelocity,
  startRace,
  resetRace,
} from "../api/index.ts";

import { state } from "../state/index.ts";
import { BREAKDOWN_CONFIG } from "../config/index.ts";

import {
  resetCarVisualState,
  resetCarPositions,
  animateRace,
  updateCarButtonStates,
  updateRaceControls,
  getCarElement,
} from "./animations.ts";

// ============ УПРАВЛЕНИЕ УВЕДОМЛЕНИЯМИ ============
export const removeWinnerMessage = (): void => {
  document.querySelectorAll(".winner-message").forEach(el => el.remove());
};

export const removeBreakdownMessages = (): void => {
  document.querySelectorAll(".breakdown-notification, .breakdown-message").forEach(el => el.remove());
};

export const removeAllNotifications = (): void => {
  document.querySelectorAll(".winner-message, .breakdown-notification, .breakdown-message").forEach(el => el.remove());
};

// ============ ОБРАБОТЧИКИ ГОНКИ ============
export const startRaceHandler = async (): Promise<void> => {
  if (state.race.isRacing) return;

  const carIds = state.garage.cars.map(c => c.id);
  if (carIds.length === 0) return;

  removeAllNotifications();
  state.race.isRacing = true;
  state.race.winnerAnnounced = false;
  updateRaceControls();

  await startRace(carIds);
  await Promise.all(carIds.map(id => startEngine(id)));

  const velocities = await Promise.allSettled(carIds.map(id => getVelocity(id)));
  const now = performance.now();

  state.race.carRaces = {};
  resetCarVisualState(carIds);
  resetCarPositions(carIds);

  carIds.forEach((id, index) => {
    const result = velocities[index];
    const isBroken = result.status === "rejected";
    state.race.carRaces[id] = createCarRace(id, now, isBroken, result);
  });

  carIds.forEach(id => {
    if (isCarBrokenAtStart(id)) {
      const car = getCarElement(id);
      if (car instanceof HTMLElement) {
        car.classList.add("broken");
        car.classList.add("broken-start_stall");
      }
    }
  });

  updateCarButtonStates();
  animateRace();
};

const createCarRace = (
  carId: number,
  now: number,
  isBroken: boolean,
  result: PromiseFulfilledResult<number> | PromiseRejectedResult,
): CarRace => ({
  carId,
  startTime: now,
  maxSpeed: result.status === "fulfilled" ? result.value : 0,
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
});

const isCarBrokenAtStart = (id: number): boolean => {
  const result = state.race.carRaces[id];
  return result?.broken ?? false;
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
  updateRaceControls();

  const carIds = state.garage.cars.map(c => c.id);
  resetCarVisualState(carIds);
  resetCarPositions(carIds);

  removeAllNotifications();

  if (carIds.length > 0) {
    await resetRace(carIds);
  }

  updateCarButtonStates();
};
