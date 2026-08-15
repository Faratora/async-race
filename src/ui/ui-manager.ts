import {
  CARS_PER_PAGE,
  WINNERS_PER_PAGE,
  ViewName,
  SortConfig,
  Car,
  Winner,
} from "../types/index.ts";

import {
  fetchCars,
  createCar,
  updateCar,
  deleteCar,
  generateCars,
  fetchWinners,
  recordWinner,
} from "../api/index.ts";

import { state } from "../state/index.ts";
import { element } from "./builder.ts";

import { startRaceHandler, resetRaceHandler, updateCarButtonStates, isCarRacing, isCarBroken, isCarFinished } from "./race-engine.ts";

// ============ КОНСТАНТЫ ============
export const INPUT_NAME_WIDTH = 200;
export const DEFAULT_COLOR = "#ff0000";

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

  try {
    await loadGarageCars();
  } catch {
    state.garage.cars = [];
    state.garage.total = 0;
  }

  app.replaceChildren();

  const totalPages = Math.ceil(state.garage.total / CARS_PER_PAGE) || 1;

  renderGarageHeader(app, totalPages);
  renderAddCarForm(app);
  renderEditForm(app);
  renderRaceControls(app);
  renderCarCards(app);
  renderGaragePagination(app, totalPages);
};

const renderGarageHeader = (app: HTMLElement, totalPages: number): void => {
  app.append(
    element("div", { class: "view-header" },
      element("span", { class: "view-title" }, `Garage (${state.garage.total})`),
      element("span", { class: "view-info" }, `Page ${state.garage.page} / ${totalPages} (${state.garage.total} cars)`)
    )
  );
};

const renderAddCarForm = (app: HTMLElement): void => {
  const form = element("div", { class: "add-car-form" });
  form.innerHTML = `
    <input type="text" id="car-name" placeholder="Car name" value="${escapeHtml(state.garage.createCarName)}" class="form-control" style="width: ${INPUT_NAME_WIDTH}px;">
    <input type="color" id="car-color" value="${state.garage.selectedColor}" class="form-control form-control-color">
    <button class="btn btn-primary" id="btn-create">Create</button>
    <button class="btn btn-generate" id="btn-generate">Generate 100 Cars</button>
  `;

  const nameInput = form.querySelector<HTMLInputElement>("#car-name");
  nameInput?.addEventListener("input", () => {
    state.garage.createCarName = nameInput.value;
  });

  const colorInput = form.querySelector<HTMLInputElement>("#car-color");
  colorInput?.addEventListener("input", () => {
    state.garage.selectedColor = colorInput.value;
  });

  app.append(form);
};

const renderEditForm = (app: HTMLElement): void => {
  if (state.garage.editingCarId === undefined) return;

  const form = element("div", { class: "edit-car-form" });
  form.innerHTML = `
    <input type="text" id="update-name" value="${escapeHtml(state.garage.editName)}" class="form-control" style="width: ${INPUT_NAME_WIDTH}px;">
    <input type="color" id="update-color" value="${state.garage.editColor}" class="form-control form-control-color">
    <button class="btn btn-primary" id="btn-update">Update</button>
    <button class="btn btn-secondary" id="btn-cancel-edit">Cancel</button>
  `;
  app.append(form);
};

const renderRaceControls = (app: HTMLElement): void => {
  const controls = element("div", { class: "race-controls" });
  controls.innerHTML = `
    <button class="btn btn-success" id="btn-start-race">Start Race</button>
    <button class="btn btn-warning" id="btn-reset-race">Reset Race</button>
  `;

  controls.querySelector<HTMLButtonElement>("#btn-start-race")?.addEventListener("click", () => {
    void startRaceHandler();
  });
  controls.querySelector<HTMLButtonElement>("#btn-reset-race")?.addEventListener("click", () => {
    void resetRaceHandler();
  });

  app.append(controls);
};

// ============ КАРТОЧКИ АВТОМОБИЛЕЙ ============
export const createCarCard = (car: Car): HTMLElement => {
  const carId = Number(car.id);
  const isDriving = state.race.drivingCars[carId] !== undefined ||
    (state.race.isRacing && isCarRacing(carId));
  const isBroken = isCarBroken(carId);
  const isFinished = isCarFinished(carId);
  const initial = escapeHtml(car.name)[0]?.toUpperCase() || "?";

  const card = element("div", { class: "car-card" });

  if (state.garage.editingCarId === carId) {
    card.classList.add("selected");
  }

  const carImage = element("div", { class: "car-image", style: `background-color: ${car.color}` }, initial);
  const carName = element("div", { class: "car-name", dataAction: "select", dataId: String(car.id) }, escapeHtml(car.name));
  const carInfo = element("div", { class: "car-info" }, carName);

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
    disabled: !(isDriving || isBroken || isFinished) ? true : undefined
  }, "B");

  const actions = element("div", { class: "car-actions" },
    element("button", { class: "btn btn-outline-info btn btn-sm", dataAction: "select", dataId: String(car.id) }, "Select"),
    element("button", { class: "btn btn-outline-danger btn btn-sm", dataAction: "remove", dataId: String(car.id) }, "Remove")
  );

  const road = element("div", { class: "car-road", dataId: String(car.id) },
    element("div", { class: "car-road-line" }),
    element("div", { class: "car-road-finish" }),
    element("div", { class: "car-flag" }),
    element("div", { class: "car", style: `background-color: ${car.color}` })
  );

  card.append(
    element("div", { class: "car-card-top" }, actions, carImage, carInfo),
    element("div", { class: "car-card-bottom" }, road,
      element("div", { class: "car-start-stop" }, startButton, stopButton)
    )
  );

  return card;
};

export const renderCarCards = (app: HTMLElement): void => {
  if (state.garage.cars.length === 0) {
    app.append(
      element("div", { class: "view-info", style: "padding: 2rem; text-align: center;" },
        "No cars yet. Create one above!"
      )
    );
    return;
  }

  state.garage.cars.forEach(car => app.append(createCarCard(car)));
  // updateCarButtonStates is imported from race-engine via global scope or we need to import it
};

const renderGaragePagination = (app: HTMLElement, totalPages: number): void => {
  if (totalPages <= 1) return;

  app.append(
    element("div", { class: "pagination-controls" },
      element("button", {
        class: "btn btn-secondary",
        id: "btn-prev",
        disabled: state.garage.page <= 1 || state.race.isRacing ? true : undefined
      }, "Previous"),
      element("span", undefined, `Page ${state.garage.page} of ${totalPages}`),
      element("button", {
        class: "btn btn-secondary",
        id: "btn-next",
        disabled: state.garage.page >= totalPages || state.race.isRacing ? true : undefined
      }, "Next")
    )
  );
};

// ============ ПОБЕДИТЕЛИ ============
export const renderWinners = async (): Promise<void> => {
  const app = getApp();
  if (!app) return;

  app.replaceChildren();
  await loadWinners();

  const totalPages = Math.ceil(state.winners.total / WINNERS_PER_PAGE) || 1;

  renderWinnersHeader(app, totalPages);
  renderWinnersTable(app);
  renderWinnersPagination(app, totalPages);
};

const renderWinnersHeader = (app: HTMLElement, totalPages: number): void => {
  app.append(
    element("div", { class: "view-header" },
      element("span", { class: "view-title" }, "Winners"),
      element("span", { class: "view-info" },
        `Page ${state.winners.page} / ${totalPages} (${state.winners.total} winners)`
      )
    )
  );
};

const createWinnerRow = (winner: Winner, index: number): HTMLElement =>
  element("div", { class: "table-row" },
    element("span", undefined, String(index + 1)),
    element("span", undefined,
      element("div", { class: "winner-car-icon", style: `background-color: ${winner.carColor};` })
    ),
    element("span", undefined, escapeHtml(winner.carName)),
    element("span", undefined, String(winner.wins)),
    element("span", undefined, `${winner.bestTime.toFixed(2)}`)
  );

const renderWinnersTable = (app: HTMLElement): void => {
  const table = element("div");

  const header = element("div", { class: "table-header" },
    element("span", undefined, "Number"),
    element("span", undefined, "Car"),
    element("span", { class: "table-header-sortable", dataSort: "name" },
      `Name ${state.winners.sortBy === "name" ? (state.winners.sortOrder === "asc" ? "▲" : "▼") : ""}`
    ),
    element("span", { class: "table-header-sortable", dataSort: "wins" },
      `Wins ${state.winners.sortBy === "wins" ? (state.winners.sortOrder === "asc" ? "▲" : "▼") : ""}`
    ),
    element("span", { class: "table-header-sortable", dataSort: "bestTime" },
      `Best time (sec) ${state.winners.sortBy === "bestTime" ? (state.winners.sortOrder === "asc" ? "▲" : "▼") : ""}`
    )
  );
  table.append(header);

  if (state.winners.winners.length === 0) {
    table.append(
      element("div", { class: "table-row", style: "grid-column: 1 / -1; text-align: center;" },
        "No winners yet. Start a race!"
      )
    );
  } else {
    state.winners.winners.forEach((winner, index) => {
      table.append(createWinnerRow(winner, index));
    });
  }

  app.append(table);
};

const renderWinnersPagination = (app: HTMLElement, totalPages: number): void => {
  app.append(
    element("div", { class: "pagination-controls" },
      element("button", {
        class: "btn btn-secondary",
        id: "btn-prev-winners",
        disabled: state.winners.page <= 1 ? true : undefined
      }, "Previous"),
      element("span", undefined, `Page ${state.winners.page} of ${totalPages}`),
      element("button", {
        class: "btn btn-secondary",
        id: "btn-next-winners",
        disabled: state.winners.page >= totalPages ? true : undefined
      }, "Next")
    )
  );
};
