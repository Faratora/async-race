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
  sortBy: "wins" | "bestTime" | "name";
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
  broken: boolean;
  time: number | undefined;
  breakdownHistory?: {
    count: number;
    timestamps: number[];
    positions: number[];
    types: string[];
  };
  repairStartTime?: number;
  isRepairing?: boolean;
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

export { CARS_PER_PAGE, WINNERS_PER_PAGE, API_BASE, TRACK_PADDING, FINISH_OFFSET } from "../config/index.ts";