import {
  ViewName,
  Car,
} from "../types/index.ts";

import {
  CARS_PER_PAGE,
  WINNERS_PER_PAGE,
} from "../config/index.ts";

import { state, loadGarage, loadAllWinners } from "../state/index.ts";
import { element } from "./builder.ts";
import { CONFIG } from "../config/index.ts";
import { createInput, createButton, createPagination, createColorPalette, renderHeader, escapeHtml, getTotalPages } from "./helpers.ts";

import { startRaceHandler, resetRaceHandler } from "./race-engine.ts";
import { updateCarButtonStates, computeCarStates } from "./animations.ts";
import { renderWinnersTable } from "./winners-table.ts";

export const getApp = (): HTMLElement | null => document.querySelector("#app");

// ============ ПЕРЕКЛЮЧЕНИЕ ВИДОВ ============
export const switchView = (view: ViewName): void => {
  const app = getApp();
  if (!app) return;

  if (state.currentView === view && app.children.length > 0) return;

  state.currentView = view;

  const tabs = document.querySelectorAll("#nav-tabs .nav-link");
  for (const tab of tabs) {
    if (tab instanceof HTMLElement) {
      tab.classList.toggle("active", tab.dataset.view === view);
    }
  }

  if (view === "garage") {
    renderGarage();
  } else {
    renderWinners();
  }
};

// ============ ОТРИСОВКА ГАРАЖА ============

const renderView = async <T>(
  loadData: () => Promise<T>,
  render: (data: T, fragment: DocumentFragment) => void,
  onDone?: () => void,
): Promise<void> => {
  const app = getApp();
  if (!app) return;

  app.append(element("div", { class: "loader" }, "Loading..."));
  const data = await loadData();
  const fragment = document.createDocumentFragment();
  render(data, fragment);
  app.replaceChildren(fragment);
  onDone?.();
};

export const renderGarage = async (): Promise<void> => {
  await renderView(
    async () => {
      await loadGarage();
      return;
    },
    (_data: unknown, fragment: DocumentFragment) => {
      const totalPages = getTotalPages(state.garage.total, CARS_PER_PAGE);
      renderHeader(fragment, `Garage (${state.garage.total})`, state.garage.total, state.garage.page, totalPages);
      renderAddCarForm(fragment);
      renderEditForm(fragment);
      renderRaceControls(fragment);
      renderCarCards(fragment);
      const isPreviousDisabled = state.garage.page <= 1;
      const isNextDisabled = state.garage.page >= totalPages;
      fragment.append(createPagination("btn-prev", "btn-next", state.garage.page, totalPages, isPreviousDisabled, isNextDisabled));
    },
    () => updateCarButtonStates(),
  );
};

const renderAddCarForm = (container: HTMLElement | DocumentFragment): void => {
  const form = element("div", { class: "add-car-form" });
  const nameInput: HTMLInputElement = createInput("car-name", "text", escapeHtml(state.garage.createCarName), "Car name", CONFIG.UI.INPUT_NAME_WIDTH);
  const colorPalette = createColorPalette(state.garage.selectedColor, (color) => {
    state.garage.selectedColor = color;
  });
  form.append(
    nameInput,
    colorPalette,
    createButton("btn-create", "Create", "btn btn-primary"),
    createButton("btn-generate", "Generate 100 Cars", "btn btn-generate"),
  );

  nameInput.addEventListener("input", () => {
    state.garage.createCarName = nameInput.value;
  });

  container.append(form);
};

const renderEditForm = (container: HTMLElement | DocumentFragment): void => {
  if (state.garage.editingCarId === undefined) return;

  const form = element("div", { class: "edit-car-form" });
  const nameInput = createInput("update-name", "text", escapeHtml(state.garage.editName), "", CONFIG.UI.INPUT_NAME_WIDTH);
  const colorPalette = createColorPalette(state.garage.editColor, (color) => {
    state.garage.editColor = color;
  });
  form.append(
    nameInput,
    colorPalette,
    createButton("btn-update", "Update", "btn btn-primary"),
    createButton("btn-cancel-edit", "Cancel", "btn btn-secondary"),
  );
  container.append(form);
};

const renderRaceControls = (container: HTMLElement | DocumentFragment): void => {
  const controls = element("div", { class: "race-controls" });
  controls.append(
    createButton("btn-start-race", "Start Race", "btn btn-success"),
    createButton("btn-reset-race", "Reset Race", "btn btn-warning"),
  );

  controls.querySelector<HTMLButtonElement>("#btn-start-race")?.addEventListener("click", () => {
    void startRaceHandler();
  });
  controls.querySelector<HTMLButtonElement>("#btn-reset-race")?.addEventListener("click", () => {
    void resetRaceHandler();
  });

  container.append(controls);
};

// ============ КАРТОЧКИ АВТОМОБИЛЕЙ ============
export const createCarCard = (car: Car): HTMLElement => {
  const carId = Number(car.id);
  const card = element("div", { class: "car-card" });

  if (state.garage.editingCarId === carId) {
    card.classList.add("selected");
  }

  card.append(createCarCardTop(car));
  card.append(createCarCardBottom(car));

  return card;
};

const createCarCardTop = (car: Car): HTMLElement => {
  const initial = escapeHtml(car.name)[0]?.toUpperCase() || "?";

  const carImage = element("div", { class: "car-image", style: `background-color: ${car.color}` }, initial);
  const carName = element("div", { class: "car-name", dataAction: "select", dataId: String(car.id) }, escapeHtml(car.name));
  const carInfo = element("div", { class: "car-info" }, carName);
  const actions = element("div", { class: "car-actions" },
    createButton(`select-${car.id}`, "Select", "btn btn-outline-info btn btn-sm", { dataAction: "update", dataId: String(car.id) }),
    createButton(`remove-${car.id}`, "Remove", "btn btn-outline-danger btn btn-sm", { dataAction: "remove", dataId: String(car.id) })
  );

  return element("div", { class: "car-card-top" }, actions, carImage, carInfo);
};

const createCarCardBottom = (car: Car): HTMLElement => {
  const carId = Number(car.id);
  const { isDriving, isBroken, isFinished } = computeCarStates(carId);

  const startButton = createButton(`start-${car.id}`, "A", "btn btn-start-engine btn btn-sm", {
    dataAction: "start",
    dataId: String(car.id),
    disabled: isDriving || isBroken || isFinished ? true : undefined,
  });

  const stopButton = createButton(`stop-${car.id}`, "B", "btn btn-stop-engine btn btn-sm", {
    dataAction: "stop",
    dataId: String(car.id),
    disabled: isDriving || isBroken || isFinished ? undefined : true,
  });

  const road = element("div", { class: "car-road", dataId: String(car.id) },
    element("div", { class: "car-road-line" }),
    element("div", { class: "car-road-finish" }),
    element("div", { class: "car-flag" }),
    element("div", { class: "car", style: `background-color: ${car.color}` })
  );

  return element("div", { class: "car-card-bottom" }, road,
    element("div", { class: "car-start-stop" }, startButton, stopButton)
  );
};

export const renderCarCards = (container: HTMLElement | DocumentFragment): void => {
  if (state.garage.cars.length === 0) {
    container.append(
      element("div", { class: "view-info", style: "padding: 2rem; text-align: center;" },
        "No cars yet. Create one above!"
      )
    );
    return;
  }

  for (const car of state.garage.cars) {
    container.append(createCarCard(car));
  }
};

// ============ ПОБЕДИТЕЛИ ============

export const renderWinners = async (): Promise<void> => {
  await loadAllWinners();
  sortWinners();
  paginateWinners();

  const totalPages = getTotalPages(state.winners.total, WINNERS_PER_PAGE);
  if (state.winners.page > totalPages) {
    state.winners.page = 1;
    paginateWinners();
  }

  await renderView(
    () => Promise.resolve(undefined),
    (_data: unknown, fragment: DocumentFragment) => {
      const totalPages = getTotalPages(state.winners.total, WINNERS_PER_PAGE);
      renderHeader(fragment, `Winners (${state.winners.total})`, state.winners.total, state.winners.page, totalPages);
      renderWinnersTable(fragment);
      const isPreviousDisabled = state.winners.page <= 1;
      const isNextDisabled = state.winners.page >= totalPages;
      fragment.append(createPagination("btn-prev-winners", "btn-next-winners", state.winners.page, totalPages, isPreviousDisabled, isNextDisabled));
    },
  );
};

const paginateWinners = (): void => {
  const start = (state.winners.page - 1) * WINNERS_PER_PAGE;
  const end = start + WINNERS_PER_PAGE;
  state.winners.winners = state.winners.allWinners.slice(start, end);
};

export const sortWinners = (): void => {
  const { sortBy, sortOrder } = state.winners;
  state.winners.allWinners.sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case "name": {
        cmp = a.carName.localeCompare(b.carName);
        break;
      }
      case "wins": {
        cmp = a.wins - b.wins;
        break;
      }
      case "bestTime": {
        cmp = (a.bestTime ?? Infinity) - (b.bestTime ?? Infinity);
        break;
      }
    }
    return sortOrder === "asc" ? cmp : -cmp;
  });
};
