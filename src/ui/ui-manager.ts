import {
  CARS_PER_PAGE,
  WINNERS_PER_PAGE,
  ViewName,
  Car,
} from "../types/index.ts";

import {
  fetchCars,
  fetchWinners,
} from "../api/index.ts";

import { state } from "../state/index.ts";
import { element } from "./builder.ts";
import { CONFIG } from "../config/index.ts";
import { createInput, createButton, createPagination, renderHeader } from "./helpers.ts";

import { startRaceHandler, resetRaceHandler } from "./race-engine.ts";
import { updateCarButtonStates, isCarRacing, isCarBroken, isCarFinished } from "./animations.ts";
import { renderWinnersTable } from "./winners-table.ts";

// ============ УТИЛИТЫ ============
export const escapeHtml = (text: string): string => {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
};

export const getApp = (): HTMLElement | null => document.querySelector("#app");

// ============ ЗАГРУЗКА ДАННЫХ ============
export const loadGarageCars = async (): Promise<void> => {
  try {
    const data = await fetchCars(state.garage.page, CARS_PER_PAGE);
    state.garage.cars = data.cars;
    state.garage.total = data.total;
  } catch (error) {
    console.error("Failed to load cars:", error);
  }
};

export const loadWinners = async (): Promise<void> => {
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
};

// ============ ПЕРЕКЛЮЧЕНИЕ ВИДОВ ============
export const switchView = (view: ViewName): void => {
  const app = getApp();
  if (!app) return;

  if (state.currentView === view && app.children.length > 0) return;

  state.currentView = view;

  document.querySelectorAll("#nav-tabs .nav-link").forEach((tab) => {
    if (tab instanceof HTMLElement) {
      tab.classList.toggle("active", tab.dataset.view === view);
    }
  });

  view === "garage" ? renderGarage() : renderWinners();
};

// ============ ОТРИСОВКА ГАРАЖА ============
export const renderGarage = async (): Promise<void> => {
  const app = getApp();
  if (!app) return;

  app.append(element("div", { class: "loader" }, "Loading..."));

  try {
    await loadGarageCars();
  } catch {
    state.garage.cars = [];
    state.garage.total = 0;
  }

  const totalPages = Math.ceil(state.garage.total / CARS_PER_PAGE) || 1;

  const fragment = document.createDocumentFragment();
  
  renderHeader(fragment, `Garage (${state.garage.total})`, state.garage.total, state.garage.page, totalPages);
  renderAddCarForm(fragment);
  renderEditForm(fragment);
  renderRaceControls(fragment);
  renderCarCards(fragment);

  const garagePrevDisabled = state.garage.page <= 1 || state.race.isRacing;
  const garageNextDisabled = state.garage.page >= totalPages || state.race.isRacing;
  fragment.appendChild(createPagination("btn-prev", "btn-next", state.garage.page, totalPages, garagePrevDisabled, garageNextDisabled));
  
  app.replaceChildren(fragment);
  updateCarButtonStates();
};

const renderAddCarForm = (container: HTMLElement | DocumentFragment): void => {
  const form = element("div", { class: "add-car-form" });
  form.append(
    createInput("car-name", "text", escapeHtml(state.garage.createCarName), "Car name", CONFIG.UI.INPUT_NAME_WIDTH),
    createInput("car-color", "color", state.garage.selectedColor),
    createButton("btn-create", "Create", "btn btn-primary"),
    createButton("btn-generate", "Generate 100 Cars", "btn btn-generate"),
  );

  const nameInput = form.querySelector<HTMLInputElement>("#car-name");
  nameInput?.addEventListener("input", () => {
    state.garage.createCarName = nameInput.value;
  });

  const colorInput = form.querySelector<HTMLInputElement>("#car-color");
  colorInput?.addEventListener("input", () => {
    state.garage.selectedColor = colorInput.value;
  });

  container.append(form);
};

const renderEditForm = (container: HTMLElement | DocumentFragment): void => {
  if (state.garage.editingCarId === undefined) return;

  const form = element("div", { class: "edit-car-form" });
  form.append(
    createInput("update-name", "text", escapeHtml(state.garage.editName), "", CONFIG.UI.INPUT_NAME_WIDTH),
    createInput("update-color", "color", state.garage.editColor),
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
  const carId = Number(car.id);
  const isDriving = state.race.drivingCars[carId] !== undefined ||
    (state.race.isRacing && isCarRacing(carId));
  const isBroken = isCarBroken(carId);
  const isFinished = isCarFinished(carId);
  const initial = escapeHtml(car.name)[0]?.toUpperCase() || "?";

  const carImage = element("div", { class: "car-image", style: `background-color: ${car.color}` }, initial);
  const carName = element("div", { class: "car-name", dataAction: "select", dataId: String(car.id) }, escapeHtml(car.name));
  const carInfo = element("div", { class: "car-info" }, carName);
  const actions = element("div", { class: "car-actions" },
    element("button", { class: "btn btn-outline-info btn btn-sm", dataAction: "select", dataId: String(car.id) }, "Select"),
    element("button", { class: "btn btn-outline-danger btn btn-sm", dataAction: "remove", dataId: String(car.id) }, "Remove")
  );

  return element("div", { class: "car-card-top" }, actions, carImage, carInfo);
};

const createCarCardBottom = (car: Car): HTMLElement => {
  const carId = Number(car.id);
  const isDriving = state.race.drivingCars[carId] !== undefined ||
    (state.race.isRacing && isCarRacing(carId));
  const isBroken = isCarBroken(carId);
  const isFinished = isCarFinished(carId);

  const startButton = element("button", {
    class: "btn btn-start-engine btn btn-sm",
    dataAction: "start",
    dataId: String(car.id),
    disabled: isDriving || isBroken || isFinished ? true : undefined
  }, "A");

  const stopButton = element("button", {
    class: "btn btn-stop-engine btn btn-sm",
    dataAction: "stop",
    dataId: String(car.id),
    disabled: !(isDriving || isBroken || isFinished) ? undefined : true
  }, "B");

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

  state.garage.cars.forEach(car => container.append(createCarCard(car)));
};

// ============ ПОБЕДИТЕЛИ ============
export const renderWinners = async (): Promise<void> => {
  const app = getApp();
  if (!app) return;

  app.append(element("div", { class: "loader" }, "Loading..."));

  await loadWinners();

  const totalPages = Math.ceil(state.winners.total / WINNERS_PER_PAGE) || 1;

  const fragment = document.createDocumentFragment();
  
  renderHeader(fragment, `Winners (${state.winners.total})`, state.winners.total, state.winners.page, totalPages);
  renderWinnersTable(fragment);

  const winnersPrevDisabled = state.winners.page <= 1;
  const winnersNextDisabled = state.winners.page >= totalPages;
  fragment.appendChild(createPagination("btn-prev-winners", "btn-next-winners", state.winners.page, totalPages, winnersPrevDisabled, winnersNextDisabled));
  
  app.replaceChildren(fragment);
};
