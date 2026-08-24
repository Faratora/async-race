import {
  startEngineAction,
  stopEngineAction,
  startRaceSetup,
  setCarRaceVelocity,
  setCarRaceBroken,
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
  const elements = document.querySelectorAll(".winner-message, .breakdown-notification, .breakdown-message");
  for (const element of elements) {
    element.remove();
  }
};

// ============ ОБРАБОТЧИКИ ГОНКИ ============
export const startRaceHandler = async (): Promise<void> => {
  if (state.race.isRacing) {
    console.log("[race] Already racing, skipping");
    return;
  }

  const carIds = state.garage.cars.map(c => c.id);
  console.log("[race] Starting race with cars:", carIds);

  if (carIds.length === 0) {
    console.log("[race] No cars, skipping");
    return;
  }

  removeAllNotifications();
  startRaceSetup(carIds, performance.now());
  updateRaceControls();
  console.log("[race] isRacing after setup:", state.race.isRacing);
  console.log("[race] carRaces keys:", Object.keys(state.race.carRaces));

  try {
    const engineResults = await startAllEngines(carIds);
    console.log("[race] Engine results:", engineResults);
    await validateGarageState(carIds);
    await initializeRaceCars(carIds, engineResults);
  } catch (error) {
    clearRaceState();
    updateRaceControls();
    console.error("Failed to start race:", error);
  }
};

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============

const startAllEngines = async (carIds: number[]): Promise<Map<number, number>> => {
  const results = await Promise.allSettled(
    carIds.map(async (id) => {
      try {
        const result = await startEngineAction(id);
        return { id, velocity: result.velocity };
      } catch {
        console.warn(`[race] startEngine API failed for car ${id}, using fallback velocity`);
        // Fallback: генерируем скорость локально если API не отвечает
        const fallbackVelocity = 150 + Math.random() * 200; // 150-350 km/h
        return { id, velocity: fallbackVelocity };
      }
    }),
  );

  const velocities = new Map<number, number>();
  for (const result of results) {
    if (result.status === "fulfilled") {
      velocities.set(result.value.id, result.value.velocity);
    }
  }
  return velocities;
};

const validateGarageState = async (carIds: number[]): Promise<void> => {
  const currentCarIds = new Set(state.garage.cars.map(c => c.id));
  if (carIds.some(id => !currentCarIds.has(id))) {
    throw new Error("Garage changed during race start");
  }
};

const initializeRaceCars = async (carIds: number[], velocities: Map<number, number>): Promise<void> => {
  resetCarVisualState(carIds);
  resetCarPositions(carIds);

  for (const id of carIds) {
    const velocity = velocities.get(id);
    if (velocity) {
      setCarRaceVelocity(id, velocity);
    } else {
      setCarRaceBroken(id, performance.now());
      markCarAsBroken(id);
    }
  }

  updateCarButtonStates();
  animateRace();
};

const markCarAsBroken = (carId: number): void => {
  const car = getCarElement(carId);
  if (car instanceof HTMLElement) {
    car.classList.add("broken", "broken-start_stall");
  }
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
    await Promise.allSettled(carIds.map(id => stopEngineAction(id)));
  }

  updateCarButtonStates();
};
