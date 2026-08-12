export interface Car {
  id: number;
  name: string;
  color: string;
}

export interface Winner {
  id: number;
  carId: number;
  carName: string;
  carColor: string;
  wins: number;
  bestTime: number;
}

export type EngineState = "idle" | "starting" | "driving" | "stopping";

export type ViewName = "garage" | "winners";

export interface SortConfig {
  sortBy: "wins" | "bestTime";
  sortOrder: "asc" | "desc";
}

export interface GarageState {
  cars: Car[];
  page: number;
  total: number;
  selectedColor: string;
  editingCarId: number | undefined;
  editName: string;
  editColor: string;
  createCarName: string;
}

export interface WinnersState {
  winners: Winner[];
  page: number;
  total: number;
  sortBy: SortConfig["sortBy"];
  sortOrder: SortConfig["sortOrder"];
}

export interface RaceState {
  isRacing: boolean;
  carRaces: Record<number, CarRace>;
  animationId: number;
  drivingCars: Record<number, DrivingCar>;
  driveAnimationId: number;
  winnerAnnounced: boolean;
}

export interface CarRace {
  startTime: number;
  velocity: number;
  finished: boolean;
  time: number | undefined;
}

export interface DrivingCar {
  startTime: number;
  velocity: number;
}

export interface AppState {
  currentView: ViewName;
  garage: GarageState;
  winners: WinnersState;
  race: RaceState;
}

export interface CarFormData {
  name: string;
  color: string;
}

export interface RaceResult {
  carId: number;
  carName: string;
  carColor: string;
  time: number;
}

export const CARS_PER_PAGE = 7;
export const WINNERS_PER_PAGE = 10;
export const API_BASE = "/api";
export const TRACK_PADDING = 65;