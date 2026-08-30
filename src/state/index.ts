import { AppState, CarFormData, Car, CarRace, Winner } from "../types/index.ts";
import { CARS_PER_PAGE } from "../config/index.ts";
import { WINNERS_PER_PAGE } from "../config/index.ts";
import {
  fetchCars,
  fetchWinners,
  createCar,
  updateCar,
  deleteCar,
  deleteWinner,
  generateCars,
  startEngine,
  stopEngine,
  getVelocity,
  driveCar,
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
    allWinners: [],
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
    winnerRecorded: false,
    totalBreakdowns: 0,
  },
};

// ============ УТИЛИТЫ ============

const withErrorLogging = async <T>(
  action: () => Promise<T>,
  label: string,
): Promise<T> => {
  try {
    return await action();
  } catch (error) {
    console.error(`Failed to ${label}:`, error);
    throw error;
  }
};

// ============ ГАРАЖ ============

const velocityCache = new Map<number, number>();

export async function loadGarage(): Promise<void> {
  try {
    const data = await fetchCars(state.garage.page, CARS_PER_PAGE);
    state.garage.cars = data.cars.map((car) => ({ ...car, maxSpeed: car.maxSpeed ?? 0 }));
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
  await withErrorLogging(() => updateCar(id, data), "update car");
}

export async function deleteCarAction(id: number): Promise<void> {
  await withErrorLogging(() => deleteCar(id), "delete car");
}

export async function deleteWinnerAction(id: number): Promise<void> {
  await withErrorLogging(() => deleteWinner(id), "delete winner");
}

export async function generateCarsAction(count: number): Promise<void> {
  await withErrorLogging(() => generateCars(count), "generate cars");
}

// ============ ПОБЕДИТЕЛИ ============

type ApiWinnerLike = {
  id: number;
  wins: number;
  time: number | null;
  carName?: string;
  carColor?: string;
};

const toWinner = (w: ApiWinnerLike, carId: number): Winner => ({
  id: w.id,
  carId,
  carName: w.carName ?? `Car ${carId}`,
  carColor: w.carColor ?? "#ff0000",
  wins: w.wins ?? 0,
  bestTime: w.time,
});

export async function loadWinnersPage(): Promise<void> {
  try {
    const data = await fetchWinners(
      state.winners.page,
      WINNERS_PER_PAGE,
      state.winners.sortBy,
      state.winners.sortOrder
    );
    state.winners.winners = data.winners.map((w) => toWinner(w, w.id));
    state.winners.total = data.total;
  } catch (error) {
    console.error("Failed to load winners:", error);
  }
}

export async function loadAllWinners(): Promise<void> {
  try {
    const data = await fetchWinners(
      1,
      1000,
      state.winners.sortBy,
      state.winners.sortOrder
    );
    
    const aggregated = new Map<number, Winner>();
    for (const w of data.winners) {
      const carId = w.id;
      const existing = aggregated.get(carId);
      const winner = toWinner(w, carId);
      if (existing) {
        existing.wins += winner.wins;
        if (winner.bestTime != null && (existing.bestTime == null || winner.bestTime < existing.bestTime)) {
          existing.bestTime = winner.bestTime;
        }
      } else {
        aggregated.set(carId, winner);
      }
    }
    state.winners.allWinners = [...aggregated.values()];
    state.winners.total = aggregated.size;
  } catch (error) {
    console.error("Failed to load all winners:", error);
  }
}

export async function recordWinnerAction(data: {
  carId: number;
  carName: string;
  carColor: string;
  time: number | null | undefined;
}): Promise<void> {
  try {
    await recordWinner(data);
  } catch (error) {
    console.error("Failed to record winner:", error);
  }
}

// ============ ГОНКА ============

const cacheVelocityAndSync = (carId: number, velocity: number): void => {
  velocityCache.set(carId, velocity);
  if (state.garage.cars.some((c) => c.id === carId)) {
    state.garage.cars = state.garage.cars.map((c) =>
      c.id === carId ? { ...c, maxSpeed: velocity } : c,
    );
  }
};

export async function startEngineAction(carId: number): Promise<{ velocity: number }> {
  const result = await startEngine(carId);
  cacheVelocityAndSync(carId, result.velocity);
  return { velocity: result.velocity };
}

export async function stopEngineAction(carId: number): Promise<void> {
  await stopEngine(carId);
}

export async function getVelocityAction(carId: number): Promise<number> {
  if (velocityCache.has(carId)) {
    const cached = velocityCache.get(carId);
    if (cached === undefined) {
      throw new Error(`Velocity not found for car ${carId}`);
    }
    return cached;
  }
  const result = await getVelocity(carId);
  cacheVelocityAndSync(carId, result);
  return result;
}

export async function driveCarAction(carId: number): Promise<void> {
  await driveCar(carId);
}

export function resetRaceState(carId: number): void {
  const race = state.race.carRaces[carId];
  if (race) {
    race.finished = false;
    race.time = undefined;
  }
}

export function clearDriveCar(_carId: number): void {
  delete state.race.drivingCars[_carId];
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

export function findCarById(id: number): Car | undefined {
  return state.garage.cars.find(c => c.id === id);
}

export function getCarRace(id: number): CarRace | undefined {
  return state.race.carRaces[id];
}

// ============ ЗАПУСК ГОНКИ (бизнес-логика) ============

export function startRaceSetup(carIds: number[], now: number): void {
  state.race.isRacing = true;
  state.race.winnerAnnounced = false;
  state.race.winnerCarId = undefined;
  state.race.totalBreakdowns = 0;

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
    // Случайный фактор ±20% для заметной разницы скоростей
    const variance = 0.8 + Math.random() * 0.4;
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
  state.race.winnerRecorded = false;
  state.race.isRacing = false;
  state.race.totalBreakdowns = 0;
}
