import { AppState } from "../types/index.ts";

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
