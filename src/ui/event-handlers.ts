import {
  ViewName,
  SortConfig,
} from "../types/index.ts";

import {
  CARS_PER_PAGE,
  WINNERS_PER_PAGE,
} from "../config/index.ts";

import {
  createCarAction,
  updateCarAction,
  deleteCarAction,
  generateCarsAction,
  startEngineAction,
  stopEngineAction,
  loadWinners,
} from "../state/index.ts";

import { state } from "../state/index.ts";

import { renderGarage, renderWinners, loadGarageCars } from "./ui-manager.ts";
import { startDriveCar, stopDriveCar, resetCarToStart } from "./animations.ts";
import { isCarBroken, isCarFinished, getCarElement, updateCarButtonStates } from "./animations.ts";
import { showGenericNotification } from "./notifications.ts";
import { resetCarVisualReset } from "./helpers.ts";

// ============ ОБЩАЯ ЛОГИКА ЗАГРУЗКИ ГАРАЖА ============
const reloadGarage = (): void => {
  state.garage.page = 1;
  void loadGarageCars().then(renderGarage);
};

// ============ ЗАЩИТА ОТ ГОНКИ СОСТОЯНИЙ ============
const ACTION_TIMEOUT = 5000; // 5 секунд
const pendingActions = new Map<number, number>(); // id -> timestamp

const isActionPending = (id: number): boolean => {
  const timestamp = pendingActions.get(id);
  if (!timestamp) return false;
  if (Date.now() - timestamp > ACTION_TIMEOUT) {
    pendingActions.delete(id);
    return false;
  }
  return true;
};

const withPendingAction = async <T>(
  id: number,
  action: () => Promise<T>,
  onError?: (error: unknown) => void,
): Promise<T | void> => {
  if (isActionPending(id)) {
    console.warn(`Action already pending for car ${id}`);
    return;
  }

  pendingActions.set(id, Date.now());
  try {
    return await action();
  } catch (error) {
    if (onError) {
      onError(error);
    } else {
      console.error(`Action failed for car ${id}:`, error);
    }
  } finally {
    pendingActions.delete(id);
  }
};

// ============ ЗАЩИТА ОТ СПАМА ============
const spamFlags = new Set<string>();

const withSpamGuard = (key: string, action: () => void): void => {
  if (spamFlags.has(key)) {
    showGenericNotification("Please wait for the previous action to complete");
    return;
  }
  spamFlags.add(key);
  action();
};

const clearSpamFlag = (key: string): void => {
  spamFlags.delete(key);
};

// ============ ОБРАБОТЧИКИ КНОПОК ============
export const handleCreateButton = (): void => {
  const name = state.garage.createCarName.trim();
  if (!name) return;

  withSpamGuard("create", () => {
    void createCarAction({ name, color: state.garage.selectedColor })
      .then(() => {
        state.garage.createCarName = "";
        reloadGarage();
      })
      .finally(() => clearSpamFlag("create"));
  });
};

export const handleGenerateButton = (): void => {
  withSpamGuard("generate", () => {
    void generateCarsAction(100)
      .then(reloadGarage)
      .catch((error) => {
        console.error("Failed to generate cars:", error);
      })
      .finally(() => clearSpamFlag("generate"));
  });
};

export const handleUpdateButton = (): void => {
  if (state.garage.editingCarId === undefined) return;

  const nameInput = document.querySelector<HTMLInputElement>("#update-name");
  if (!nameInput) return;

  const name = nameInput.value.trim();
  if (!name) return;

  const color = state.garage.editColor;
  const carId = state.garage.editingCarId;

  withSpamGuard("update", () => {
    void updateCarAction(carId, { name, color })
      .then(() => {
        state.garage.editingCarId = undefined;
        state.garage.editName = "";
        state.garage.editColor = "#ff0000";
        reloadGarage();
      })
      .finally(() => clearSpamFlag("update"));
  });
};

export const handleCancelEditButton = (): void => {
  state.garage.editingCarId = undefined;
  state.garage.editName = "";
  state.garage.editColor = "#ff0000";

  if (state.race.driveAnimationId) {
    cancelAnimationFrame(state.race.driveAnimationId);
  }
  state.race.drivingCars = {};
  renderGarage();
};

// ============ ОБЩАЯ ЛОГИКА ПАГИНАЦИИ ============

const changeGaragePage = (delta: number): void => {
  const totalPages = Math.ceil(state.garage.total / CARS_PER_PAGE) || 1;
  const newPage = state.garage.page + delta;
  if (newPage < 1 || newPage > totalPages) return;
  state.garage.page = newPage;
  void loadGarageCars().then(renderGarage);
};

const changeWinnersPage = (delta: number): void => {
  const totalPages = Math.ceil(state.winners.total / WINNERS_PER_PAGE) || 1;
  const newPage = state.winners.page + delta;
  if (newPage < 1 || newPage > totalPages) return;
  state.winners.page = newPage;
  void loadWinners().then(() => renderWinners());
};

export const handlePreviousButton = (): void => changeGaragePage(-1);
export const handleNextButton = (): void => changeGaragePage(1);
export const handlePreviousWinnersButton = (): void => changeWinnersPage(-1);
export const handleNextWinnersButton = (): void => changeWinnersPage(1);

// ============ ОБРАБОТЧИКИ ДЕЙСТВИЙ С МАШИНОЙ ============
export const handleCarAction = (action: string | undefined, id: number): void => {
  if (!action) return;

  switch (action) {
    case "remove": {
      handleRemoveCar(id);
      break;
    }

    case "select": {
      handleSelectCar(id);
      break;
    }

    case "start": {
      void handleStartEngine(id);
      break;
    }

    case "stop": {
      void handleStopEngine(id);
      break;
    }
  }
};

const handleRemoveCar = (id: number): void => {
  void deleteCarAction(id)
    .then(() => {
      state.winners.winners = state.winners.winners.filter(w => w.carId !== id);
      state.winners.total = state.winners.winners.length;

      const totalPages = Math.ceil(state.winners.total / WINNERS_PER_PAGE) || 1;
      if (state.winners.page > totalPages) {
        state.winners.page = Math.max(1, totalPages);
      }

      return loadGarageCars();
    })
    .then(async () => {
      // Проверяем что страница не вышла за границы после удаления
      const totalPages = Math.ceil(state.garage.total / CARS_PER_PAGE) || 1;
      if (state.garage.page > totalPages) {
        state.garage.page = Math.max(1, totalPages);
        await loadGarageCars();
      }
      return renderGarage();
    })
    .catch((error) => {
      console.error("Failed to remove car:", error);
    });
};

const handleSelectCar = (id: number): void => {
  const car = state.garage.cars.find(c => c.id === id);
  if (!car) return;
  state.garage.editingCarId = id;
  state.garage.editName = car.name;
  state.garage.editColor = car.color;
  renderGarage();
};

const handleStartEngine = (id: number): void => {
  void withPendingAction(id, async () => {
    await startEngineAction(id);
    startDriveCar(id);
  });
};

const handleStopEngine = (id: number): void => {
  void withPendingAction(id, async () => {
    const isBroken = isCarBroken(id);
    const isFinished = isCarFinished(id);
    if (isBroken) {
      handleRepairCar(id);
    } else if (isFinished) {
      resetCarToStart(id);
    } else {
      await stopEngineAction(id);
      stopDriveCar(id);
    }
  });
};

const handleRepairCar = (id: number): void => {
  const race = state.race.carRaces[id];
  if (race) {
    race.broken = false;
    race.isRepairing = false;
    race.repairStartTime = undefined;
    race.finished = false;
    race.time = undefined;
  }
  const car = getCarElement(id);
  if (car instanceof HTMLElement) {
    resetCarVisualReset(car);
  }
  stopRaceAnimation();
  updateCarButtonStates();
};

const stopRaceAnimation = (): void => {
  if (state.race.animationId) {
    cancelAnimationFrame(state.race.animationId);
    state.race.animationId = 0;
  }
  state.race.isRacing = false;
};

// ============ ДЕЛЕГИРОВАНИЕ СОБЫТИЙ ============
interface Handlers {
  appClickHandler: ((event: MouseEvent) => void) | undefined;
  navClickHandler: ((event: MouseEvent) => void) | undefined;
}

const handlers: Handlers = {
  appClickHandler: undefined,
  navClickHandler: undefined,
};

export const setupEventDelegation = (): (() => void) => {
  const app = document.querySelector("#app");
  handlers.appClickHandler = appClickHandlerInternal;
  if (app instanceof HTMLElement) {
    app.addEventListener("click", handlers.appClickHandler);
  }
  handlers.navClickHandler = navClickHandlerInternal;
  document.addEventListener("click", handlers.navClickHandler);

  // Возвращаем функцию очистки
  return () => {
    if (app instanceof HTMLElement && handlers.appClickHandler) {
      app.removeEventListener("click", handlers.appClickHandler);
      handlers.appClickHandler = undefined;
    }
    if (handlers.navClickHandler) {
      document.removeEventListener("click", handlers.navClickHandler);
      handlers.navClickHandler = undefined;
    }
  };
};

// ============ ВНУТРЕННИЕ ОБРАБОТЧИКИ ============
const appClickHandlerInternal = (event: MouseEvent): void => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (isCarActionClick(target)) return;
  if (isButtonClick(target)) return;
  handleSortClick(target);
};

const isCarActionClick = (target: HTMLElement): boolean => {
  const action = target.dataset.action;
  if (action && ["select", "remove", "start", "stop"].includes(action)) {
    const id = Number(target.dataset.id);
    if (!Number.isNaN(id)) {
      handleCarAction(action, id);
    }
    return true;
  }
  return false;
};

const buttonSelectors: Array<[string, () => void]> = [
  ["#btn-create", handleCreateButton],
  ["#btn-generate", handleGenerateButton],
  ["#btn-update", handleUpdateButton],
  ["#btn-cancel-edit", handleCancelEditButton],
  ["#btn-prev", handlePreviousButton],
  ["#btn-next", handleNextButton],
  ["#btn-prev-winners", handlePreviousWinnersButton],
  ["#btn-next-winners", handleNextWinnersButton],
];

const isButtonClick = (target: HTMLElement): boolean => {
  for (const [selector, handler] of buttonSelectors) {
    if (target.closest(selector)) {
      handler();
      return true;
    }
  }
  return false;
};

const handleSortClick = (target: HTMLElement): void => {
  const sortBy = target.dataset.sort;
  if (isSortBy(sortBy)) {
    handleSortByChange(sortBy);
    return;
  }

  const sortOrder = target.dataset.sortOrder;
  if (isSortOrder(sortOrder)) {
    state.winners.sortOrder = sortOrder;
    state.winners.page = 1;
    renderWinners();
  }
};

const handleSortByChange = (sortBy: SortConfig["sortBy"]): void => {
  if (state.winners.sortBy === sortBy) {
    state.winners.sortOrder = state.winners.sortOrder === "asc" ? "desc" : "asc";
  } else {
    state.winners.sortBy = sortBy;
    state.winners.sortOrder = "desc";
  }
  state.winners.page = 1;
  renderWinners();
};

const navClickHandlerInternal = async (event: MouseEvent): Promise<void> => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.closest("#nav-tabs .nav-link")) {
    const view = target.dataset.view;
    if (view && isViewName(view)) {
      const { switchView } = await import("./ui-manager.ts");
      switchView(view);
    }
  }
};

// ============ ТИП-ГВАРДЫ ============
export const isViewName = (value: string | null | undefined): value is ViewName =>
  ["garage", "winners"].includes(value ?? "");

export const isSortBy = (value: string | null | undefined): value is SortConfig["sortBy"] =>
  ["wins", "bestTime", "name"].includes(value ?? "");

export const isSortOrder = (value: string | null | undefined): value is SortConfig["sortOrder"] =>
  ["asc", "desc"].includes(value ?? "");
