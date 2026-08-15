import {
  ViewName,
  SortConfig,
  CARS_PER_PAGE,
  WINNERS_PER_PAGE,
} from "../types/index.ts";

import {
  createCar,
  updateCar,
  deleteCar,
  generateCars,
  startEngine,
  stopEngine,
} from "../api/index.ts";

import { state } from "../state/index.ts";

import { renderGarage, renderWinners, loadGarageCars } from "./ui-manager.ts";
import { startDriveCar, stopDriveCar, resetCarToStart, isCarBroken, isCarFinished, getCarElement, updateCarButtonStates } from "./race-engine.ts";

// ============ ОБРАБОТЧИКИ СОБЫТИЙ ============
export const handleCarAction = (action: string | undefined, id: number): void => {
  if (!action) return;

  switch (action) {
    case "remove":
      void deleteCar(id)
        .then(() => {
          state.winners.winners = state.winners.winners.filter(w => w.carId !== id);
          return loadGarageCars();
        })
        .then(renderGarage);
      break;

    case "select": {
      const car = state.garage.cars.find(c => c.id === id);
      if (!car) return;
      state.garage.editingCarId = id;
      state.garage.editName = car.name;
      state.garage.editColor = car.color;
      renderGarage();
      break;
    }

    case "start":
      void startEngine(id).then(() => startDriveCar(id));
      break;

    case "stop": {
      const isBroken = isCarBroken(id);
      const isFinished = isCarFinished(id);
      if (isBroken) {
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
          car.classList.remove("broken");
          car.classList.remove("broken-engine_overheating", "broken-transmission_failure", "broken-start_stall", "broken-random_breakdown");
          car.style.opacity = "1";
          car.style.scale = "1";
          car.style.rotate = "0deg";
          car.style.transform = "translateX(0px)";
        }
        // Останавливаем анимацию гонки
        if (state.race.animationId) {
          cancelAnimationFrame(state.race.animationId);
          state.race.animationId = 0;
        }
        state.race.isRacing = false;
        updateCarButtonStates();
      } else if (isFinished) {
        resetCarToStart(id);
      } else {
        void stopEngine(id).then(() => stopDriveCar(id));
      }
      break;
    }
  }
};

export const handleCreateButton = (): void => {
  const name = state.garage.createCarName.trim();
  if (!name) return;

  void createCar({ name, color: state.garage.selectedColor })
    .then(() => {
      state.garage.createCarName = "";
      state.garage.page = 1;
      return loadGarageCars();
    })
    .then(renderGarage);
};

export const handleGenerateButton = (): void => {
  void generateCars(100)
    .then(() => {
      state.garage.page = 1;
      return loadGarageCars();
    })
    .then(renderGarage);
};

export const handleUpdateButton = (): void => {
  if (state.garage.editingCarId === undefined) return;

  const nameInput = document.querySelector<HTMLInputElement>("#update-name");
  if (!nameInput) return;

  const name = nameInput.value.trim();
  if (!name) return;

  const colorInput = document.querySelector<HTMLInputElement>("#update-color");
  const color = colorInput?.value || "#ff0000";

  void updateCar(state.garage.editingCarId, { name, color })
    .then(() => {
      state.garage.editingCarId = undefined;
      state.garage.editName = "";
      state.garage.editColor = "#ff0000";
      return loadGarageCars();
    })
    .then(renderGarage);
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

export const handlePreviousButton = (): void => {
  if (state.race.isRacing || state.garage.page <= 1) return;
  state.garage.page--;
  void loadGarageCars().then(renderGarage);
};

export const handleNextButton = (): void => {
  if (state.race.isRacing) return;
  const totalPages = Math.ceil(state.garage.total / CARS_PER_PAGE);
  if (state.garage.page >= totalPages) return;
  state.garage.page++;
  void loadGarageCars().then(renderGarage);
};

export const handlePreviousWinnersButton = (): void => {
  if (state.winners.page <= 1) return;
  state.winners.page--;
  renderWinners();
};

export const handleNextWinnersButton = (): void => {
  const totalPages = Math.ceil(state.winners.total / WINNERS_PER_PAGE);
  if (state.winners.page >= totalPages) return;
  state.winners.page++;
  renderWinners();
};

// ============ ДЕЛЕГИРОВАНИЕ СОБЫТИЙ ============
export const handleAppClick = (event: MouseEvent): void => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.action;
  if (action && ["select", "remove", "start", "stop"].includes(action)) {
    const id = Number(target.dataset.id);
    if (!Number.isNaN(id)) {
      handleCarAction(action, id);
    }
    return;
  }

  const buttonHandlers: Array<[string, () => void]> = [
    ["#btn-create", handleCreateButton],
    ["#btn-generate", handleGenerateButton],
    ["#btn-update", handleUpdateButton],
    ["#btn-cancel-edit", handleCancelEditButton],
    ["#btn-prev", handlePreviousButton],
    ["#btn-next", handleNextButton],
    ["#btn-prev-winners", handlePreviousWinnersButton],
    ["#btn-next-winners", handleNextWinnersButton],
  ];

  for (const [selector, handler] of buttonHandlers) {
    if (target.closest(selector)) {
      handler();
      return;
    }
  }

  const sortBy = target.dataset.sort;
  if (isSortBy(sortBy)) {
    if (state.winners.sortBy === sortBy) {
      state.winners.sortOrder = state.winners.sortOrder === "asc" ? "desc" : "asc";
    } else {
      state.winners.sortBy = sortBy;
      state.winners.sortOrder = "desc";
    }
    state.winners.page = 1;
    renderWinners();
    return;
  }

  const sortOrder = target.dataset.sortOrder;
  if (isSortOrder(sortOrder)) {
    state.winners.sortOrder = sortOrder;
    state.winners.page = 1;
    renderWinners();
    return;
  }
};

export const setupEventDelegation = (): void => {
  const app = document.querySelector("#app");
  if (app instanceof HTMLElement) {
    app.addEventListener("click", handleAppClick);
  }

  // Обработчик для навигации (вне #app)
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.closest("#nav-tabs .nav-link")) {
      const view = target.dataset.view;
      if (view && isViewName(view)) {
        import("./ui-manager.ts").then(({ switchView }) => {
          switchView(view);
        });
      }
    }
  });
};

// ============ ТИП-ГВАРДЫ ============
export const isViewName = (value: string | null | undefined): value is ViewName =>
  value === "garage" || value === "winners";

export const isSortBy = (value: string | null | undefined): value is SortConfig["sortBy"] =>
  value === "wins" || value === "bestTime" || value === "name";

export const isSortOrder = (value: string | null | undefined): value is SortConfig["sortOrder"] =>
  value === "asc" || value === "desc";
