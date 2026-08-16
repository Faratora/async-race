import {
  startEngine,
  getVelocity,
  startRace,
  resetRace,
} from "../api/index.ts";

import { state } from "../state/index.ts";

import {
  resetCarVisualState,
  resetCarPositions,
  animateRace,
  updateCarButtonStates,
  getCarElement,
} from "./animations.ts";

// ============ УПРАВЛЕНИЕ ГОНКОЙ ============
export const removeWinnerMessage = (): void => {
  document.querySelectorAll(".winner-message, .breakdown-notification").forEach(el => el.remove());
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

  resetCarVisualState(carIds);
  resetCarPositions(carIds);

  carIds.forEach((id, index) => {
    const result = velocities[index];
    const isBroken = result.status === "rejected";

    state.race.carRaces[id] = {
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

  const carIds = state.garage.cars.map(c => c.id);
  resetCarVisualState(carIds);
  resetCarPositions(carIds);

  document.querySelectorAll(".breakdown-message, .winner-message, .breakdown-notification").forEach(el => el.remove());

  if (carIds.length > 0) {
    await resetRace(carIds);
  }

  updateCarButtonStates();
};
