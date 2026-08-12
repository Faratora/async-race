import { Car, Winner, ViewName, SortConfig } from "../types/index.ts";

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

export const state = {
  currentView: "garage" as ViewName,
  garage: {
    cars: [] as Car[],
    page: 1,
    total: 0,
    selectedColor: "#ff0000",
    editingCarId: undefined as number | undefined,
    editName: "",
    editColor: "#ff0000",
    createCarName: "",
  },
  winners: {
    winners: [] as Winner[],
    page: 1,
    total: 0,
    sortBy: "wins" as SortConfig["sortBy"],
    sortOrder: "desc" as SortConfig["sortOrder"],
  },
  race: {
    isRacing: false,
    carRaces: {} as Record<number, CarRace>,
    animationId: 0,
    drivingCars: {} as Record<number, DrivingCar>,
    driveAnimationId: 0,
    winnerAnnounced: false,
  },
};
