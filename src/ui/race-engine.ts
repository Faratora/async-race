import {
  stopEngineAction,
  startRaceSetup,
  setCarRaceVelocity,
  clearRaceState,
  stopRaceAnimation,
} from "../state/index.ts";

import { state } from "../state/index.ts";

import {
  resetCarVisualState,
  resetCarPositions,
  animateRace,
  updateCarButtonStates,
  updateRaceControls,
} from "./animations.ts";

// ============ УПРАВЛЕНИЕ УВЕДОМЛЕНИЯМИ ============
export const removeAllNotifications = (): void => {
  const elements = document.querySelectorAll(".winner-message, .breakdown-notification, .breakdown-message");
  for (const element of elements) {
    element.remove();
  }
};

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============

const initializeRaceCars = (carIds: number[], velocities: Map<number, number>): void => {
  resetCarVisualState(carIds);
  resetCarPositions(carIds);

  for (const id of carIds) {
    const velocity = velocities.get(id);
    if (velocity) {
      setCarRaceVelocity(id, velocity);
    } else {
      // Fallback: разброс 200–400 км/ч
      const fallbackVelocity = 200 + Math.random() * 200;
      setCarRaceVelocity(id, fallbackVelocity);
    }
  }

  updateCarButtonStates();
  animateRace();
};

// ============ ОБРАБОТЧИКИ ГОНКИ ============
export const startRaceHandler = async (): Promise<void> => {
  if (state.race.isRacing) {
    return;
  }

  const carIds = state.garage.cars.map(c => c.id);

  if (carIds.length === 0) {
    return;
  }

  removeAllNotifications();
  startRaceSetup(carIds, performance.now());
  updateRaceControls();

  // Запускаем гонку мгновенно — без ожидания API
  initializeRaceCars(carIds, new Map());
};

export const resetRaceHandler = async (): Promise<void> => {
  stopRaceAnimation();
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
    await Promise.allSettled(carIds.map(id => stopEngineAction(id)));
  }

  updateCarButtonStates();
};
