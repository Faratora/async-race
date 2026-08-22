import {
  startRaceAction,
  resetRaceAction,
  startEngineAction,
  getVelocityAction,
  startRaceSetup,
  setCarRaceVelocity,
  setCarRaceBroken,
  isCarRaceBroken,
  clearRaceState,
} from "../state/index.ts";

import { state } from "../state/index.ts";

import {
  resetCarVisualState,
  resetCarPositions,
  animateRace,
  updateCarButtonStates,
  updateRaceControls,
  getCarElement,
} from "./animations.ts";

// ============ УПРАВЛЕНИЕ УВЕДОМЛЕНИЯМИ ============
export const removeAllNotifications = (): void => {
<<<<<<< Updated upstream
  document.querySelectorAll(".winner-message, .breakdown-notification, .breakdown-message").forEach(element => element.remove());
=======
  const elements = document.querySelectorAll(".winner-message, .breakdown-notification, .breakdown-message");
  for (const element of elements) {
    element.remove();
  }
>>>>>>> Stashed changes
};

// ============ ОБРАБОТЧИКИ ГОНКИ ============
export const startRaceHandler = async (): Promise<void> => {
  if (state.race.isRacing) return;

  const carIds = state.garage.cars.map(c => c.id);
  if (carIds.length === 0) return;

  removeAllNotifications();
  startRaceSetup(carIds, performance.now());
  updateRaceControls();

  await startRaceAction(carIds);
  await Promise.all(carIds.map(id => startEngineAction(id)));

  const velocities = await Promise.allSettled(carIds.map(id => getVelocityAction(id)));

  resetCarVisualState(carIds);
  resetCarPositions(carIds);

  for (const [index, id] of carIds.entries()) {
    const result = velocities[index];
    if (result.status === "fulfilled") {
      setCarRaceVelocity(id, result.value);
    } else {
      setCarRaceBroken(id, performance.now());
    }
  }

<<<<<<< Updated upstream
  carIds.forEach(id => {
    if (!isCarRaceBroken(id)) {
    	return;
    }

    const car = getCarElement(id);
    if (car instanceof HTMLElement) {
      car.classList.add("broken", "broken-start_stall");
    }

  });
=======
  }
>>>>>>> Stashed changes

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

  clearRaceState();
  updateRaceControls();

  const carIds = state.garage.cars.map(c => c.id);
  resetCarVisualState(carIds);
  resetCarPositions(carIds);

  removeAllNotifications();

  if (carIds.length > 0) {
    await resetRaceAction(carIds);
  }

  updateCarButtonStates();
};
