import { AppState, CarFormData, Car } from "../types/index.ts";
import { CARS_PER_PAGE } from "../config/index.ts";
import { WINNERS_PER_PAGE } from "../config/index.ts";
import {
  fetchCars,
  fetchWinners,
  createCar,
  updateCar,
  deleteCar,
  generateCars,
  startEngine,
  stopEngine,
  repairCar,
  getVelocity,
  driveCar,
  startRace,
  resetRace,
  recordWinner,
} from "../api/index.ts";

// ============ Состояние ============
export const state: AppState = {
  currentView: "garage",
  garage: {
    cars: [],
    page: 1,
    total: 0,
    selectedColor: "#ff0000",
    editingCarId: undefined,
    editName: "",
    editColor: "#ff0000",
    createCarName: "",
  },
  winners: {
    winners: [],
    page: 1,
    total: 0,
    sortBy: "wins",
    sortOrder: "desc",
  },
  race: {
    isRacing: false,
    carRaces: {},
    animationId: 0,
    drivingCars: {},
    driveAnimationId: 0,
    winnerAnnounced: false,
  },
};

// ============ ГАРАЖ ============

export async function loadGarage(): Promise<void> {
  try {
    const data = await fetchCars(state.garage.page, CARS_PER_PAGE);
    state.garage.cars = data.cars;
    state.garage.total = data.total;
  } catch (error) {
    console.error("Failed to load cars:", error);
  }
}

export async function createCarAction(data: CarFormData): Promise<Car | undefined> {
  try {
    const result = await createCar(data);
    return result;
  } catch (error) {
    console.error("Failed to create car:", error);
    return undefined;
  }
}

export async function updateCarAction(id: number, data: CarFormData): Promise<void> {
  try {
    await updateCar(id, data);
  } catch (error) {
    console.error("Failed to update car:", error);
    throw error;
  }
}

export async function deleteCarAction(id: number): Promise<void> {
  try {
    await deleteCar(id);
  } catch (error) {
    console.error("Failed to delete car:", error);
    throw error;
  }
}

export async function generateCarsAction(count: number): Promise<void> {
  try {
    await generateCars(count);
  } catch (error) {
    console.error("Failed to generate cars:", error);
    throw error;
  }
}

// ============ ПОБЕДИТЕЛИ ============

export async function loadWinners(): Promise<void> {
  try {
    const data = await fetchWinners(
      state.winners.page,
      WINNERS_PER_PAGE,
      state.winners.sortBy,
      state.winners.sortOrder
    );
    state.winners.winners = data.winners;
    state.winners.total = data.total;
  } catch (error) {
    console.error("Failed to load winners:", error);
  }
}

export async function recordWinnerAction(data: {
  carId: number;
  carName: string;
  carColor: string;
  time: number;
}): Promise<void> {
  try {
    await recordWinner(data);
  } catch (error) {
    console.error("Failed to record winner:", error);
  }
}

// ============ ГОНКА ============

export async function startEngineAction(carId: number): Promise<void> {
  await startEngine(carId);
}

export async function stopEngineAction(carId: number): Promise<void> {
  await stopEngine(carId);
}

export async function repairCarAction(carId: number): Promise<void> {
  try {
    await repairCar(carId);
  } catch {
    // ignore repair errors
  }
}

export async function getVelocityAction(carId: number): Promise<number> {
  return await getVelocity(carId);
}

export async function driveCarAction(carId: number): Promise<void> {
  await driveCar(carId);
}

export function resetRaceState(carId: number): void {
  const race = state.race.carRaces[carId];
  if (race) {
    race.broken = false;
    race.finished = false;
    race.time = undefined;
  }
}

export function clearDriveCar(carId: number): void {
  delete state.race.drivingCars[carId];
}

export function setDriveCar(carId: number, maxSpeed: number): void {
  state.race.drivingCars[carId] = { startTime: performance.now(), maxSpeed };
}

export function stopRaceAnimation(): void {
  if (state.race.animationId) {
    cancelAnimationFrame(state.race.animationId);
    state.race.animationId = 0;
  }
  state.race.isRacing = false;
}

// ============ ГОНКА (расширенная) ============

export async function startRaceAction(carIds: number[]): Promise<void> {
  try {
    await startRace(carIds);
  } catch (error) {
    console.error("Failed to start race:", error);
    throw error;
  }
}

export async function resetRaceAction(carIds: number[]): Promise<void> {
  try {
    await resetRace(carIds);
  } catch (error) {
    console.error("Failed to reset race:", error);
    throw error;
  }
}

// ============ ЗАПУСК ГОНКИ (бизнес-логика) ============

export function startRaceSetup(carIds: number[], now: number): void {
  state.race.isRacing = true;
  state.race.winnerAnnounced = false;

  state.race.carRaces = {};

  for (const id of carIds) {
    state.race.carRaces[id] = {
      carId: id,
      startTime: now,
      maxSpeed: 0,
      finished: false,
      broken: false,
      time: undefined,
      breakdownHistory: { count: 0, timestamps: [], positions: [], types: [] },
      repairStartTime: undefined,
      isRepairing: false,
    };
  }
}

export function setCarRaceVelocity(carId: number, maxSpeed: number): void {
  const race = state.race.carRaces[carId];
  if (race) {
    // Случайный фактор ±10% для непредсказуемости результатов
    const variance = 0.9 + Math.random() * 0.2;
    race.maxSpeed = maxSpeed * variance;
  }
}

export function setCarRaceBroken(carId: number, now: number): void {
  const race = state.race.carRaces[carId];
  if (race) {
    race.broken = true;
    race.breakdownHistory = {
      count: 1,
      timestamps: [now],
      positions: [0],
      types: ["start_stall"],
    };
  }
}

export function isCarRaceBroken(carId: number): boolean {
  return state.race.carRaces[carId]?.broken ?? false;
}

export function clearRaceState(): void {
  state.race.carRaces = {};
  state.race.drivingCars = {};
  state.race.winnerAnnounced = false;
  state.race.isRacing = false;
}
