import {
  CARS_PER_PAGE,
  WINNERS_PER_PAGE,
  ViewName,
  Car,
  Winner,
} from "../types/index.ts";

import {
  fetchCars,
  fetchWinners,
} from "../api/index.ts";

import { state } from "../state/index.ts";
import { element } from "./builder.ts";
import { INPUT_NAME_WIDTH, DEFAULT_COLOR } from "../config/index.ts";

import { startRaceHandler, resetRaceHandler, updateCarButtonStates, isCarRacing, isCarBroken, isCarFinished } from "./race-engine.ts";

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

  app.innerHTML = '<div class="loader">Loading...</div>';

  try {
    await loadGarageCars();
  } catch {
    state.garage.cars = [];
    state.garage.total = 0;
  }

  const totalPages = Math.ceil(state.garage.total / CARS_PER_PAGE) || 1;

  const fragment = document.createDocumentFragment();
  
  renderHeader(fragment, `Garage (${state.garage.total})`, state.garage.total, state.garage.page, totalPages, "cars");
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

const renderHeader = (
  container: HTMLElement | DocumentFragment,
  title: string,
  total: number,
  currentPage: number,
  totalPages: number,
  extraInfo?: string
): void => {
  container.append(
    element("div", { class: "view-header" },
      element("span", { class: "view-title" }, title),
      element("span", { class: "view-info" },
        `Page ${currentPage} / ${totalPages} (${total}${extraInfo ? `, ${extraInfo}` : ''})`
      )
    )
  );
};

const renderAddCarForm = (container: HTMLElement | DocumentFragment): void => {
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

  container.append(form);
};

const renderEditForm = (container: HTMLElement | DocumentFragment): void => {
  if (state.garage.editingCarId === undefined) return;

  const form = element("div", { class: "edit-car-form" });
  form.innerHTML = `
    <input type="text" id="update-name" value="${escapeHtml(state.garage.editName)}" class="form-control" style="width: ${INPUT_NAME_WIDTH}px;">
    <input type="color" id="update-color" value="${state.garage.editColor}" class="form-control form-control-color">
    <button class="btn btn-primary" id="btn-update">Update</button>
    <button class="btn btn-secondary" id="btn-cancel-edit">Cancel</button>
  `;
  container.append(form);
};

const renderRaceControls = (container: HTMLElement | DocumentFragment): void => {
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

  container.append(controls);
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
    disabled: !(isDriving || isBroken || isFinished) ? undefined : true
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

const createPagination = (
  prevId: string,
  nextId: string,
  currentPage: number,
  totalPages: number,
  isPrevDisabled: boolean,
  isNextDisabled: boolean
): HTMLElement => {
  return element("div", { class: "pagination-controls" },
    element("button", {
      class: "btn btn-secondary",
      id: prevId,
      disabled: isPrevDisabled ? true : undefined
    }, "Previous"),
    element("span", undefined, `Page ${currentPage} of ${totalPages}`),
    element("button", {
      class: "btn btn-secondary",
      id: nextId,
      disabled: isNextDisabled ? true : undefined
    }, "Next")
  );
};

// ============ ПОБЕДИТЕЛИ ============
export const renderWinners = async (): Promise<void> => {
  const app = getApp();
  if (!app) return;

  app.innerHTML = '<div class="loader">Loading...</div>';

  await loadWinners();

  const totalPages = Math.ceil(state.winners.total / WINNERS_PER_PAGE) || 1;

  const fragment = document.createDocumentFragment();
  
  renderHeader(fragment, "Winners", state.winners.total, state.winners.page, totalPages, "winners");
  renderWinnersTable(fragment);

  const winnersPrevDisabled = state.winners.page <= 1;
  const winnersNextDisabled = state.winners.page >= totalPages;
  fragment.appendChild(createPagination("btn-prev-winners", "btn-next-winners", state.winners.page, totalPages, winnersPrevDisabled, winnersNextDisabled));
  
  app.replaceChildren(fragment);
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

const renderWinnersTable = (container: HTMLElement | DocumentFragment): void => {
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

  container.append(table);
};
