import {
  CARS_PER_PAGE,
  WINNERS_PER_PAGE,
  TRACK_PADDING,
  ViewName,
  SortConfig,
  CarRace,
  Car,
  Winner,
} from "../types/index.ts";

import {
  fetchCars,
  createCar,
  updateCar,
  deleteCar,
  generateCars,
  startEngine,
  stopEngine,
  getVelocity,
  driveCar,
  startRace,
  resetRace,
  fetchWinners,
  recordWinner,
} from "../api/index.ts";

import { state } from "../state/index.ts";
import { element } from "./builder.ts";

const INPUT_NAME_WIDTH = 200;
const DEFAULT_COLOR = "#ff0000";

// ============ DATA LOADING ============

async function loadGarageCars(): Promise<void> {
  try {
    const data = await fetchCars(state.garage.page, CARS_PER_PAGE);
    state.garage.cars = data.cars;
    state.garage.total = data.total;
  } catch (error) {
    console.error("Failed to load cars:", error);
  }
}

async function loadWinners(): Promise<void> {
  try {
    const data = await fetchWinners(state.winners.page, WINNERS_PER_PAGE, state.winners.sortBy, state.winners.sortOrder);
    state.winners.winners = data.winners;
    state.winners.total = data.total;
  } catch (error) {
    console.error("Failed to load winners:", error);
  }
}

// ============ VIEW SWITCHING ============

function switchView(view: ViewName): void {
  const app = document.querySelector("#app");
  if (!(app instanceof HTMLElement)) return;
  if (state.currentView === view && app.children.length > 0) {
    return;
  }
  state.currentView = view;
  for (const tab of document.querySelectorAll("#nav-tabs .nav-link")) {
    if (!(tab instanceof HTMLElement)) continue;
    tab.classList.toggle("active", tab.dataset.view === view);
  }
  if (view === "garage") {
    renderGarage();
  } else {
    renderWinners();
  }
}

// ============ GARAGE RENDERING ============

async function renderGarage(): Promise<void> {
  const app = document.querySelector("#app");
  if (!(app instanceof HTMLElement)) return;
  try {
    await loadGarageCars();
  } catch (error) {
    console.error("Failed to load cars:", error);
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
}

function renderGarageHeader(app: HTMLElement, totalPages: number): void {
  const header = element("div", { class: "view-header" },
    element("span", { class: "view-title" }, `Garage (${state.garage.total})`),
    element("span", { class: "view-info" }, `Page ${state.garage.page} / ${totalPages} (${state.garage.total} cars)`),
  );
  app.append(header);
}

function renderAddCarForm(app: HTMLElement): void {
  const addForm = document.createElement("div");
  addForm.className = "add-car-form";
  addForm.innerHTML = `
    <input type="text" id="car-name" placeholder="Car name" value="${escapeHtml(state.garage.createCarName)}" class="form-control" style="width: ${INPUT_NAME_WIDTH}px;">
    <input type="color" id="car-color" value="${state.garage.selectedColor}" class="form-control form-control-color">
    <button class="btn btn-primary" id="btn-create">Create</button>
    <button class="btn btn-generate" id="btn-generate">Generate 100 Cars</button>
  `;
  const nameInput = addForm.querySelector("#car-name");
  if (nameInput instanceof HTMLInputElement) {
    nameInput.addEventListener("input", () => {
      state.garage.createCarName = nameInput.value;
    });
  }
  const colorInput = addForm.querySelector("#car-color");
  if (colorInput instanceof HTMLInputElement) {
    colorInput.addEventListener("input", () => {
      state.garage.selectedColor = colorInput.value;
    });
  }
  app.append(addForm);
}

function renderEditForm(app: HTMLElement): void {
  if (state.garage.editingCarId === undefined) return;
  const editForm = document.createElement("div");
  editForm.className = "edit-car-form";
  editForm.innerHTML = `
    <input type="text" id="update-name" value="${escapeHtml(state.garage.editName)}" class="form-control" style="width: ${INPUT_NAME_WIDTH}px;">
    <input type="color" id="update-color" value="${state.garage.editColor}" class="form-control form-control-color">
    <button class="btn btn-primary" id="btn-update">Update</button>
    <button class="btn btn-secondary" id="btn-cancel-edit">Cancel</button>
  `;
  app.append(editForm);
}

function renderRaceControls(app: HTMLElement): void {
  const raceControls = document.createElement("div");
  raceControls.className = "race-controls";
  raceControls.innerHTML = `
    <button class="btn btn-success" id="btn-start-race">Start Race</button>
    <button class="btn btn-warning" id="btn-reset-race">Reset Race</button>
  `;
  app.append(raceControls);

  const buttonStartRace = raceControls.querySelector("#btn-start-race");
  if (buttonStartRace instanceof HTMLButtonElement) {
    buttonStartRace.addEventListener("click", () => { void startRaceHandler(); });
  }
  const buttonResetRace = raceControls.querySelector("#btn-reset-race");
  if (buttonResetRace instanceof HTMLButtonElement) {
    buttonResetRace.addEventListener("click", () => { void resetRaceHandler(); });
  }
}

function createCarCard(car: Car): HTMLElement {
  const carId = Number(car.id);
  const isDriving = Object.hasOwn(state.race.drivingCars, carId) ||
    (state.race.isRacing && Object.hasOwn(state.race.carRaces, carId) && !state.race.carRaces[carId].finished && !state.race.carRaces[carId].broken);
  const isFinished = Object.hasOwn(state.race.carRaces, carId) &&
    (state.race.carRaces[carId].finished || state.race.carRaces[carId].broken);
  const initial = escapeHtml(car.name)[0]?.toUpperCase() || "?";

  const card = element("div", { class: "car-card" });
  if (state.garage.editingCarId !== undefined && state.garage.editingCarId === carId) {
    card.classList.add("selected");
  }

  const carImage = element("div", { class: "car-image", style: `background-color: ${car.color}` }, initial);
  const carName = element("div", { class: "car-name", dataAction: "select", dataId: String(car.id) }, escapeHtml(car.name));
  const carInfo = element("div", { class: "car-info" }, carName);

  const startButton = element("button", { class: "btn btn-start-engine btn btn-sm", dataAction: "start", dataId: String(car.id), disabled: isDriving ? true : undefined }, "A");
  const stopButton = element("button", { class: "btn btn-stop-engine btn btn-sm", dataAction: "stop", dataId: String(car.id), disabled: isFinished ? undefined : true }, "B");
  const editButton = element("button", { class: "btn btn-outline-info btn btn-sm", dataAction: "select", dataId: String(car.id) }, "Select");
  const removeButton = element("button", { class: "btn btn-outline-danger btn btn-sm", dataAction: "remove", dataId: String(car.id) }, "Remove");
  const actions = element("div", { class: "car-actions" }, editButton, removeButton);

  const top = element("div", { class: "car-card-top" }, actions, carImage, carInfo);

  const roadLine = element("div", { class: "car-road-line" });
  const roadFinish = element("div", { class: "car-road-finish" });
  const roadFlag = element("div", { class: "car-flag" });
  const carElement = element("div", { class: "car", style: `background-color: ${car.color}` });
  const road = element("div", { class: "car-road", dataId: String(car.id) }, roadLine, roadFinish, roadFlag, carElement);
  const startStopButtons = element("div", { class: "car-start-stop" }, startButton, stopButton);
  const bottom = element("div", { class: "car-card-bottom" }, road, startStopButtons);

  card.append(top, bottom);
  return card;
}

function renderCarCards(app: HTMLElement): void {
  if (state.garage.cars.length === 0) {
    renderEmptyGarageMessage(app);
    return;
  }

  for (const car of state.garage.cars) {
    app.append(createCarCard(car));
  }
  updateCarButtonStates();
}

function updateCarButtonStates(): void {
  for (const car of state.garage.cars) {
    const carId = Number(car.id);
    const startButton = document.querySelector(`.btn-start-engine[data-id="${CSS.escape(String(carId))}"]`);
    const stopButton = document.querySelector(`.btn-stop-engine[data-id="${CSS.escape(String(carId))}"]`);
    if (!(startButton instanceof HTMLButtonElement) || !(stopButton instanceof HTMLButtonElement)) continue;

    const isDriving = Object.hasOwn(state.race.drivingCars, carId) ||
      (state.race.isRacing && Object.hasOwn(state.race.carRaces, carId) && !state.race.carRaces[carId].finished && !state.race.carRaces[carId].broken);
    const isFinished = Object.hasOwn(state.race.carRaces, carId) &&
      (state.race.carRaces[carId].finished || state.race.carRaces[carId].broken);
    startButton.disabled = isDriving;
    stopButton.disabled = !isFinished;
  }
}

function renderEmptyGarageMessage(app: HTMLElement): void {
  const empty = document.createElement("div");
  empty.className = "view-info";
  empty.textContent = "No cars yet. Create one above!";
  empty.style.padding = "2rem";
  empty.style.textAlign = "center";
  app.append(empty);
}

function renderGaragePagination(app: HTMLElement, totalPages: number): void {
  if (totalPages <= 1) return;
  const pagination = element("div", { class: "pagination-controls" },
    element("button", { class: "btn btn-secondary", id: "btn-prev", disabled: state.garage.page <= 1 || state.race.isRacing ? true : undefined }, "Previous"),
    element("span", undefined, `Page ${state.garage.page} of ${totalPages}`),
    element("button", { class: "btn btn-secondary", id: "btn-next", disabled: state.garage.page >= totalPages || state.race.isRacing ? true : undefined }, "Next"),
  );
  app.append(pagination);
}

// ============ WINNERS RENDERING ============

async function renderWinners(): Promise<void> {
  const app = document.querySelector("#app");
  if (!(app instanceof HTMLElement)) return;
  app.replaceChildren();

  await loadWinners();

  const totalPages = Math.ceil(state.winners.total / WINNERS_PER_PAGE) || 1;

  renderWinnersHeader(app, totalPages);
  renderSortControls(app);
  renderWinnersTable(app);
  renderWinnersPagination(app, totalPages);
}

function renderWinnersHeader(app: HTMLElement, totalPages: number): void {
  const header = document.createElement("div");
  header.className = "view-header";
  header.innerHTML = `
    <span class="view-title">Winners</span>
    <span class="view-info">Page ${state.winners.page} / ${totalPages} (${state.winners.total} winners)</span>
  `;
  app.append(header);
}

function renderSortControls(app: HTMLElement): void {
  const sortControls = element("div", { class: "sort-controls" },
    element("span", undefined, "Sort by:"),
    element("button", { class: `btn btn-sm ${state.winners.sortBy === "wins" ? "btn-primary" : "btn-secondary"}`, dataSort: "wins" }, "Wins"),
    element("button", { class: `btn btn-sm ${state.winners.sortBy === "bestTime" ? "btn-primary" : "btn-secondary"}`, dataSort: "bestTime" }, "Best Time"),
    element("button", { class: `btn btn-sm ${state.winners.sortOrder === "asc" ? "btn-primary" : "btn-secondary"}`, dataSortOrder: "asc" }, "Asc"),
    element("button", { class: `btn btn-sm ${state.winners.sortOrder === "desc" ? "btn-primary" : "btn-secondary"}`, dataSortOrder: "desc" }, "Desc"),
  );
  app.append(sortControls);
}

function createWinnerRow(winner: Winner, index: number): HTMLElement {
  const row = element("div", { class: "table-row" },
    element("span", undefined, String(index + 1)),
    element("span", undefined,
      element("div", { class: "winner-car-icon", style: `background-color: ${winner.carColor};` })
    ),
    element("span", undefined, escapeHtml(winner.carName)),
    element("span", undefined, String(winner.wins)),
    element("span", undefined, `${winner.bestTime.toFixed(2)}`),
  );
  return row;
}

function renderWinnersTable(app: HTMLElement): void {
  const table = element("div");
  const thead = element("div", { class: "table-header" },
    element("span", undefined, "Number"),
    element("span", undefined, "Car"),
    element("span", undefined, "Name"),
    element("span", undefined, "Wins"),
    element("span", undefined, "Best time (sec)"),
  );
  table.append(thead);

  if (state.winners.winners.length === 0) {
    const emptyRow = element("div", { class: "table-row", style: "grid-column: 1 / -1; text-align: center;" }, "No winners yet. Start a race!");
    table.append(emptyRow);
  } else {
    for (let i = 0; i < state.winners.winners.length; i++) {
      table.append(createWinnerRow(state.winners.winners[i], i));
    }
  }
  app.append(table);
}

function renderWinnersPagination(app: HTMLElement, totalPages: number): void {
  const pagination = element("div", { class: "pagination-controls" },
    element("button", { class: "btn btn-secondary", id: "btn-prev-winners", disabled: state.winners.page <= 1 ? true : undefined }, "Previous"),
    element("span", undefined, `Page ${state.winners.page} of ${totalPages}`),
    element("button", { class: "btn btn-secondary", id: "btn-next-winners", disabled: state.winners.page >= totalPages ? true : undefined }, "Next"),
  );
  app.append(pagination);
}

// ============ DOM HELPERS ============

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  // eslint-disable-next-line unicorn/prefer-dom-node-html-methods
  return div.innerHTML;
}

// ============ RACE HANDLERS ============

async function startRaceHandler(): Promise<void> {
  if (state.race.isRacing) return;
  const carIds = state.garage.cars.map((c) => c.id);
  if (carIds.length === 0) return;

  removeWinnerMessage();

  state.race.isRacing = true;
  state.race.winnerAnnounced = false;
  await startRace(carIds);

  await Promise.all(carIds.map((id) => startEngine(id)));

  const velocities = await Promise.all(carIds.map((id) => getVelocity(id)));
  const now = performance.now();
  state.race.carRaces = {};
  for (const [index, id] of carIds.entries()) {
    state.race.carRaces[id] = {
      startTime: now,
      velocity: velocities[index],
      finished: false,
      broken: false,
      time: undefined,
    };
  }

  resetCarPositions(carIds);

  updateCarButtonStates();
  animateRace();
}

function removeWinnerMessage(): void {
  const winnerMessage = document.querySelector(".winner-message");
  if (winnerMessage) winnerMessage.remove();
}

function resetCarPositions(carIds: number[]): void {
  for (const id of carIds) {
    const car = document.querySelector(`.car-road[data-id="${CSS.escape(String(id))}"] .car`);
    if (car instanceof HTMLElement) {
      car.style.transform = "translateX(0px)";
    }
  }
}

function animateRace(): void {
  if (!state.race.isRacing) return;

  let isAllFinished = true;

  for (const [carIdString, race] of Object.entries(state.race.carRaces)) {
    if (race.finished) continue;
    isAllFinished = false;
    animateCarRace(carIdString, race);
  }

  if (isAllFinished) {
    state.race.isRacing = false;
    state.race.animationId = 0;
    updateCarButtonStates();
    return;
  }

  state.race.animationId = requestAnimationFrame(animateRace);
}

function handleResize(): void {
  for (const [carIdString, race] of Object.entries(state.race.carRaces)) {
    if (race.finished) continue;
    const carId = Number(carIdString);
    const car = document.querySelector(`.car-road[data-id="${CSS.escape(String(carId))}"] .car`);
    if (!(car instanceof HTMLElement)) continue;
    const road = car.parentElement;
    if (!(road instanceof HTMLElement)) continue;
    const trackWidth = road.offsetWidth - TRACK_PADDING;
    const elapsed = performance.now() - race.startTime;
    const progress = Math.min(1, elapsed * race.velocity / trackWidth);
    const left = Math.min(progress * trackWidth, trackWidth);
    car.style.transform = `translateX(${left}px)`;
  }

  for (const [carIdString, drive] of Object.entries(state.race.drivingCars)) {
    const carId = Number(carIdString);
    const car = document.querySelector(`.car-road[data-id="${CSS.escape(String(carId))}"] .car`);
    if (!(car instanceof HTMLElement)) continue;
    const road = car.parentElement;
    if (!(road instanceof HTMLElement)) continue;
    const trackWidth = road.offsetWidth - TRACK_PADDING;
    const elapsed = performance.now() - drive.startTime;
    const progress = Math.min(1, elapsed * drive.velocity / trackWidth);
    const left = Math.min(progress * trackWidth, trackWidth);
    car.style.transform = `translateX(${left}px)`;
  }
}

function animateCarRace(carIdString: string, race: CarRace): void {
  const carId = Number(carIdString);
  const car = document.querySelector(`.car-road[data-id="${CSS.escape(String(carId))}"] .car`);
  if (!(car instanceof HTMLElement)) return;

  // Car is broken — stop it
  if (race.broken) {
    car.classList.add("broken");
    return;
  }

  const road = car.parentElement;
  if (!(road instanceof HTMLElement)) return;
  const trackWidth = road.offsetWidth - TRACK_PADDING;
  const elapsed = performance.now() - race.startTime;
  const progress = Math.min(1, elapsed * race.velocity / trackWidth);
  const left = progress * trackWidth;

  car.style.transform = `translateX(${left}px)`;

  // Random chance to break down (~0.1% per frame)
  if (Math.random() < 0.001) {
    race.broken = true;
    car.classList.add("broken");
    console.log(`🔧 Car ${carId} broke down at ${Math.round(progress * 100)}%`);
    return;
  }

  if (left >= trackWidth) {
    handleCarFinish(carId, race, elapsed);
  }
}

function handleCarFinish(carId: number, race: CarRace, elapsed: number): void {
  if (race.broken) return;
  race.finished = true;
  race.time = elapsed / 1000 * 10;
  void driveCar(carId).catch((error) => console.error("Failed to drive car:", error));
  updateCarButtonStates();

  if (!state.race.winnerAnnounced) {
    state.race.winnerAnnounced = true;
    const car = state.garage.cars.find((c) => c.id === carId);
    if (car) {
      void recordWinner({
        carId: car.id,
        carName: car.name,
        carColor: car.color,
        time: race.time,
      });
      showWinnerMessage(car.name, race.time);
    }
  }
}

function showWinnerMessage(carName: string, time: number): void {
  const app = document.querySelector("#app");
  if (!(app instanceof HTMLElement)) return;
  const message = document.createElement("div");
  message.className = "winner-message";
  message.textContent = `🏆 ${carName} wins with time ${time.toFixed(2)}s!`;
  app.insertBefore(message, app.firstChild);
}

// ============ DRIVE ANIMATION ============

function animateDriveCar(): void {
  const now = performance.now();
  for (const [carIdString, drive] of Object.entries(state.race.drivingCars)) {
    const carId = Number(carIdString);
    const carElement = document.querySelector(`.car-road[data-id="${CSS.escape(String(carId))}"] .car`);
    if (!(carElement instanceof HTMLElement)) continue;

    const road = carElement.parentElement;
    if (!(road instanceof HTMLElement)) continue;
    const trackWidth = road.offsetWidth - TRACK_PADDING;
    const elapsed = now - drive.startTime;
    const progress = Math.min(1, elapsed * drive.velocity / trackWidth);
    const left = Math.min(progress * trackWidth, trackWidth);
    carElement.style.transform = `translateX(${left}px)`;

    if (progress >= 1) {
      delete state.race.drivingCars[carId];
      void driveCar(carId).catch((error) => {
        console.error("Failed to drive car:", error);
        updateCarButtonStates();
      });
    }
  }

  if (Object.keys(state.race.drivingCars).length > 0) {
    state.race.driveAnimationId = requestAnimationFrame(animateDriveCar);
  }
}

async function startDriveCar(carId: number): Promise<void> {
  const velocity = await getVelocity(carId);
  const now = performance.now();
  state.race.drivingCars[carId] = { startTime: now, velocity };

  const carElement = document.querySelector(`.car-road[data-id="${CSS.escape(String(carId))}"] .car`);
  if (carElement instanceof HTMLElement) {
    carElement.style.transform = "translateX(0px)";
  }

  updateCarButtonStates();

  if (Object.keys(state.race.drivingCars).length === 1) {
    animateDriveCar();
  }
}

function stopDriveCar(carId: number): void {
  delete state.race.drivingCars[carId];
  
  if (Object.hasOwn(state.race.carRaces, carId)) {
    state.race.carRaces[carId].finished = true;
  }
  
  const carElement = document.querySelector(`.car-road[data-id="${CSS.escape(String(carId))}"] .car`);
  if (carElement instanceof HTMLElement) {
    carElement.style.transform = "translateX(0px)";
  }
  updateCarButtonStates();
}

async function resetRaceHandler(): Promise<void> {
  if (state.race.animationId) {
    cancelAnimationFrame(state.race.animationId);
    state.race.animationId = 0;
  }
  if (state.race.driveAnimationId) {
    cancelAnimationFrame(state.race.driveAnimationId);
    state.race.driveAnimationId = 0;
  }
  state.race.isRacing = false;
  state.race.carRaces = {};
  state.race.drivingCars = {};
  state.race.winnerAnnounced = false;
  const carIds = state.garage.cars.map((c) => c.id);
  if (carIds.length > 0) {
    await resetRace(carIds);
  }
  for (const emoji of document.querySelectorAll(".car")) {
    if (emoji instanceof HTMLElement) {
      emoji.style.transform = "translateX(0px)";
    }
  }
  updateCarButtonStates();
}

// ============ EVENT DELEGATION ============

function handleCarAction(action: string | undefined, id: number): void {
  if (!action) return;
  switch (action) {
  case "remove": {
    void deleteCar(id).then(() => {
      state.winners.winners = state.winners.winners.filter((w) => w.carId !== id);
      return loadGarageCars();
    }).then(() => {
      renderGarage();
    });
    break;
  }
  case "select": {
    const car = state.garage.cars.find((c) => c.id === id);
    if (!car) return;
    state.garage.editingCarId = id;
    state.garage.editName = car.name;
    state.garage.editColor = car.color;
    renderGarage();
    break;
  }
  case "start": {
    void startEngine(id).then(() => startDriveCar(id));
    break;
  }
  case "stop": {
    void stopEngine(id).then(() => stopDriveCar(id));
    break;
  }
  }
}

function handleCreateButton(): void {
  const name = state.garage.createCarName.trim();
  if (!name) return;
  const color = state.garage.selectedColor;
  void createCar({ name, color }).then(() => {
    state.garage.createCarName = "";
    state.garage.page = 1;
    return loadGarageCars();
  }).then(() => {
    renderGarage();
  });
}

function handleGenerateButton(): void {
  void generateCars(100).then(() => {
    state.garage.page = 1;
    return loadGarageCars();
  }).then(() => {
    renderGarage();
  });
}

function handleUpdateButton(): void {
  if (state.garage.editingCarId === undefined) return;
  const nameInput = document.querySelector("#update-name");
  if (!(nameInput instanceof HTMLInputElement)) return;
  const name = nameInput.value.trim();
  if (!name) return;
  const colorInput = document.querySelector("#update-color");
  const color = colorInput instanceof HTMLInputElement ? colorInput.value : DEFAULT_COLOR;
  void updateCar(state.garage.editingCarId, { name, color }).then(() => {
    state.garage.editingCarId = undefined;
    state.garage.editName = "";
    state.garage.editColor = DEFAULT_COLOR;
    return loadGarageCars();
  }).then(() => {
    renderGarage();
  });
}

function handleCancelEditButton(): void {
  state.garage.editingCarId = undefined;
  state.garage.editName = "";
  state.garage.editColor = DEFAULT_COLOR;
  if (state.race.driveAnimationId) {
    cancelAnimationFrame(state.race.driveAnimationId);
  }
  state.race.drivingCars = {};
  renderGarage();
}

function handlePreviousButton(): void {
  if (state.race.isRacing) return;
  if (state.garage.page <= 1) return;
  state.garage.page--;
  void loadGarageCars().then(() => renderGarage());
}

function handleNextButton(): void {
  if (state.race.isRacing) return;
  const totalPages = Math.ceil(state.garage.total / CARS_PER_PAGE);
  if (state.garage.page >= totalPages) return;
  state.garage.page++;
  void loadGarageCars().then(() => renderGarage());
}

function handleSortBy(sortBy: SortConfig["sortBy"]): void {
  state.winners.sortBy = sortBy;
  state.winners.page = 1;
  renderWinners();
}

function handleSortOrder(sortOrder: SortConfig["sortOrder"]): void {
  state.winners.sortOrder = sortOrder;
  state.winners.page = 1;
  renderWinners();
}

function handlePreviousWinnersButton(): void {
  if (state.winners.page <= 1) return;
  state.winners.page--;
  renderWinners();
}

function handleNextWinnersButton(): void {
  const totalPages = Math.ceil(state.winners.total / WINNERS_PER_PAGE);
  if (state.winners.page >= totalPages) return;
  state.winners.page++;
  renderWinners();
}

function didDispatchButtonClick(target: HTMLElement, selector: string, handler: () => void): boolean {
  const button = target.closest(selector);
  if (button) {
    handler();
    return true;
  }
  return false;
}

function handleAppClick(event: MouseEvent): void {
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

  if (didDispatchButtonClick(target, "#btn-create", handleCreateButton)) return;
  if (didDispatchButtonClick(target, "#btn-generate", handleGenerateButton)) return;
  if (didDispatchButtonClick(target, "#btn-update", handleUpdateButton)) return;
  if (didDispatchButtonClick(target, "#btn-cancel-edit", handleCancelEditButton)) return;
  if (didDispatchButtonClick(target, "#btn-prev", handlePreviousButton)) return;
  if (didDispatchButtonClick(target, "#btn-next", handleNextButton)) return;

  const sortBy = target.dataset.sort;
  if (isSortBy(sortBy)) {
    handleSortBy(sortBy);
    return;
  }

  const sortOrder = target.dataset.sortOrder;
  if (isSortOrder(sortOrder)) {
    handleSortOrder(sortOrder);
    return;
  }

  if (didDispatchButtonClick(target, "#btn-prev-winners", handlePreviousWinnersButton)) return;
  if (didDispatchButtonClick(target, "#btn-next-winners", handleNextWinnersButton)) return;
}

function setupEventDelegation(): void {
  const app = document.querySelector("#app");
  if (!(app instanceof HTMLElement)) return;
  app.addEventListener("click", handleAppClick);
}

// ============ INIT ============

function isViewName(value: string | null | undefined): value is ViewName {
  return value === "garage" || value === "winners";
}

function isSortBy(value: string | null | undefined): value is SortConfig["sortBy"] {
  return value === "wins" || value === "bestTime";
}

function isSortOrder(value: string | null | undefined): value is SortConfig["sortOrder"] {
  return value === "asc" || value === "desc";
}

for (const tab of document.querySelectorAll("#nav-tabs .nav-link")) {
  if (!(tab instanceof HTMLElement)) continue;
  tab.addEventListener("click", () => {
    const view = tab.dataset.view;
    if (view && isViewName(view)) {
      switchView(view);
    }
  });
}

export function init(): void {
  const resizeObserver = new ResizeObserver(() => {
    handleResize();
  });
  resizeObserver.observe(document.body);
}

export { switchView, setupEventDelegation };
