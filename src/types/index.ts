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
  page: number;
  selectedColor: string;
  editingCarId: number | undefined;
  editName: string;
  editColor: string;
}

export interface WinnersState {
  page: number;
  sort: SortConfig;
}

export interface AppState {
  currentView: ViewName;
  garage: GarageState;
  winners: WinnersState;
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