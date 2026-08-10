import {
  Car,
  Winner,
  CARS_PER_PAGE,
  WINNERS_PER_PAGE,
  ViewName,
  SortConfig,
} from "./types/index.ts";

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
} from "./api/index.ts";

const state = {
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
    carRaces: {} as Record<number, { startTime: number; velocity: number; finished: boolean; time: number | undefined }>,
    animationId: 0,
  },
};

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

function switchView(view: ViewName): void {
  if (state.currentView === view) {
    return;
  }
  state.currentView = view;
  for (const tab of document.querySelectorAll("#nav-tabs .nav-link")) {
    const button = tab as HTMLElement;
    button.classList.toggle("active", button.dataset.view === view);
  }
  if (view === "garage") {
    renderGarage();
  } else {
    renderWinners();
  }
}

async function renderGarage(): Promise<void> {
  const app = document.querySelector("#app")!;
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

function renderGarageHeader(app: Element, totalPages: number): void {
  const header = document.createElement("div") as HTMLElement;
  header.className = "view-header";
  header.innerHTML = `
    <span class="view-title">Garage (${state.garage.total})</span>
    <span class="view-info">Page ${state.garage.page} / ${totalPages} (${state.garage.total} cars)</span>
  `;
  app.append(header);
}

function renderAddCarForm(app: Element): void {
  const addForm = document.createElement("div") as HTMLElement;
  addForm.className = "add-car-form";
  addForm.innerHTML = `
    <input type="text" id="car-name" placeholder="Car name" value="${escapeHtml(state.garage.createCarName)}" class="form-control" style="width: 200px;">
    <button class="btn btn-primary" id="btn-create">Create</button>
    <button class="btn btn-generate" id="btn-generate">Generate 100 Cars</button>
  `;
  const nameInput = addForm.querySelector("#car-name") as HTMLInputElement | null;
  if (nameInput) {
    nameInput.addEventListener("input", () => {
      state.garage.createCarName = nameInput.value;
    });
  }
  app.append(addForm);
}

function renderEditForm(app: Element): void {
  if (state.garage.editingCarId === undefined) return;
    const editForm = document.createElement("div") as HTMLElement;
  editForm.className = "edit-car-form";
  editForm.innerHTML = `
    <input type="text" id="update-name" value="${escapeHtml(state.garage.editName)}" class="form-control" style="width: 200px;">
    <input type="color" id="update-color" value="${state.garage.editColor}" class="form-control form-control-color">
    <button class="btn btn-primary" id="btn-update">Update</button>
    <button class="btn btn-secondary" id="btn-cancel-edit">Cancel</button>
  `;
  app.append(editForm);
}

function renderRaceControls(app: Element): void {
  const raceControls = document.createElement("div") as HTMLElement;
  raceControls.className = "race-controls";
  raceControls.innerHTML = `
    <button class="btn btn-success" id="btn-start-race">Start Race</button>
    <button class="btn btn-warning" id="btn-reset-race">Reset Race</button>
  `;
  app.append(raceControls);
  const buttonStartRace = raceControls.querySelector("#btn-start-race") as HTMLButtonElement;
  const buttonResetRace = raceControls.querySelector("#btn-reset-race") as HTMLButtonElement;
  buttonStartRace.addEventListener("click", () => { void startRaceHandler(); });
  buttonResetRace.addEventListener("click", () => { void resetRaceHandler(); });
}

function renderCarCards(app: Element): void {
  if (state.garage.cars.length === 0) {
    renderEmptyGarageMessage(app);
    return;
  }

  for (const car of state.garage.cars) {
    app.append(createCarCard(car));
  }
}

function renderEmptyGarageMessage(app: Element): void {
  const empty = document.createElement("div") as HTMLElement;
  empty.className = "view-info";
  empty.textContent = "No cars yet. Create one above!";
  empty.style.padding = "2rem";
  empty.style.textAlign = "center";
  app.append(empty);
}

function createCarCard(car: Car): HTMLElement {
  const card = document.createElement("div") as HTMLElement;
  card.className = "car-card";
  if (state.garage.editingCarId === car.id) {
    card.classList.add("selected");
  }
  const initial = escapeHtml(car.name)[0]?.toUpperCase() || "?";
  card.innerHTML = `
    <div class="car-card-top">
      <div class="car-image" style="background-color: ${car.color}">${initial}</div>
      <div class="car-info">
        <div class="car-name" data-action="edit" data-id="${car.id}">${escapeHtml(car.name)}</div>
      </div>
      <div class="car-actions">
        <button class="btn btn-start-engine btn btn-sm" data-action="start" data-id="${car.id}">Start</button>
        <button class="btn btn-stop-engine btn btn-sm" data-action="stop" data-id="${car.id}">Stop</button>
        <button class="btn btn-outline-info btn btn-sm" data-action="select" data-id="${car.id}">Select</button>
        <button class="btn btn-outline-danger btn btn-sm" data-action="remove" data-id="${car.id}">Remove</button>
      </div>
    </div>
    <div class="car-card-bottom">
      <div class="car-road" data-id="${car.id}">
        <div class="car-road-line"></div>
        <div class="car-road-finish"></div>
        <div class="car-flag"></div>
        <div class="car" style="background-color: ${car.color}"></div>
      </div>
    </div>
  `;
  return card;
}

function renderGaragePagination(app: Element, totalPages: number): void {
  if (totalPages <= 1) return;
  const pagination = document.createElement("div") as HTMLElement;
  pagination.className = "pagination-controls";
  pagination.innerHTML = `
    <button class="btn btn-secondary" id="btn-prev" ${state.garage.page <= 1 ? "disabled" : ""}>Previous</button>
    <span>Page ${state.garage.page} of ${totalPages}</span>
    <button class="btn btn-secondary" id="btn-next" ${state.garage.page >= totalPages ? "disabled" : ""}>Next</button>
  `;
  app.append(pagination);
}

function escapeHtml(text: string): string {
  const div = document.createElement("div") as HTMLElement;
  div.textContent = text;
  // eslint-disable-next-line unicorn/prefer-dom-node-html-methods
  return div.innerHTML;
}

async function renderWinners(): Promise<void> {
  const app = document.querySelector("#app")!;
  app.replaceChildren();

  await loadWinners();

  const totalPages = Math.ceil(state.winners.total / WINNERS_PER_PAGE) || 1;

  renderWinnersHeader(app, totalPages);
  renderSortControls(app);
  renderWinnersTable(app);
  renderWinnersPagination(app, totalPages);
}

function renderWinnersHeader(app: Element, totalPages: number): void {
  const header = document.createElement("div") as HTMLElement;
  header.className = "view-header";
  header.innerHTML = `
    <span class="view-title">Winners</span>
    <span class="view-info">Page ${state.winners.page} / ${totalPages} (${state.winners.total} winners)</span>
  `;
  app.append(header);
}

function renderSortControls(app: Element): void {
  const sortControls = document.createElement("div") as HTMLElement;
  sortControls.className = "sort-controls";
  sortControls.innerHTML = `
    <span>Sort by:</span>
    <button class="btn btn-sm ${state.winners.sortBy === "wins" ? "btn-primary" : "btn-secondary"}" data-sort="wins">Wins</button>
    <button class="btn btn-sm ${state.winners.sortBy === "bestTime" ? "btn-primary" : "btn-secondary"}" data-sort="bestTime">Best Time</button>
    <button class="btn btn-sm ${state.winners.sortOrder === "asc" ? "btn-primary" : "btn-secondary"}" data-sort-order="asc">↑ Asc</button>
    <button class="btn btn-sm ${state.winners.sortOrder === "desc" ? "btn-primary" : "btn-secondary"}" data-sort-order="desc">↓ Desc</button>
  `;
  app.append(sortControls);
}

function renderWinnersTable(app: Element): void {
  const table = document.createElement("div") as HTMLElement;
  const thead = document.createElement("div") as HTMLElement;
  thead.className = "table-header";
  thead.innerHTML = `<span>#</span><span></span><span>Car</span><span>Wins</span><span>Best Time</span>`;
  table.append(thead);

  if (state.winners.winners.length === 0) {
    const emptyRow = document.createElement("div") as HTMLElement;
    emptyRow.className = "table-row";
    emptyRow.style.gridColumn = "1 / -1";
    emptyRow.style.textAlign = "center";
    emptyRow.textContent = "No winners yet. Start a race!";
    table.append(emptyRow);
  } else {
    for (const winner of state.winners.winners) {
      const row = document.createElement("div") as HTMLElement;
      row.className = "table-row";
      const initial = escapeHtml(winner.carName)[0]?.toUpperCase() || "?";
      row.innerHTML = `
        <span>${winner.id}</span>
        <span>
          <div class="car-image" style="background-color: ${winner.carColor}; width: 30px; height: 20px; font-size: 10px; border-radius: 3px; display: inline-flex; align-items: center; justify-content: center; color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">${initial}</div>
        </span>
        <span>${escapeHtml(winner.carName)}</span>
        <span>${winner.wins}</span>
        <span>${winner.bestTime.toFixed(2)}s</span>
      `;
      table.append(row);
    }
  }
  app.append(table);
}

function renderWinnersPagination(app: Element, totalPages: number): void {
  if (totalPages <= 1) return;
  const pagination = document.createElement("div") as HTMLElement;
  pagination.className = "pagination-controls";
  pagination.innerHTML = `
    <button class="btn btn-secondary" id="btn-prev-winners" ${state.winners.page <= 1 ? "disabled" : ""}>Previous</button>
    <span>Page ${state.winners.page} of ${totalPages}</span>
    <button class="btn btn-secondary" id="btn-next-winners" ${state.winners.page >= totalPages ? "disabled" : ""}>Next</button>
  `;
  app.append(pagination);
}

async function startRaceHandler(): Promise<void> {
  if (state.race.isRacing) return;
  const carIds = state.garage.cars.map((c) => c.id);
  if (carIds.length === 0) return;

  state.race.isRacing = true;
  await startRace(carIds);

  await Promise.all(carIds.map((id) => startEngine(id)));

  const velocities = await Promise.all(carIds.map((id) => getVelocity(id)));
  const now = performance.now();
  state.race.carRaces = {};
  for (const [id, index] of carIds.entries()) {
    state.race.carRaces[id] = {
      startTime: now,
      velocity: velocities[index],
      finished: false,
      time: undefined,
    };
  }

  for (const id of carIds) {
    const emoji = document.querySelector(`.car-road[data-id="${CSS.escape(String(id))}"] .car`) as HTMLElement | null;
    if (emoji) emoji.style.left = "0px";
  }

  animateRace();
}

function animateRace(): void {
  if (!state.race.isRacing) return;

  let isAllFinished = true;

  for (const [carIdString, race] of Object.entries(state.race.carRaces)) {
    if (race.finished) continue;
    isAllFinished = false;
    const carId = Number(carIdString);
    const car = document.querySelector(`.car-road[data-id="${CSS.escape(String(carId))}"] .car`) as HTMLElement | null;
    if (!car) continue;

    const left = updateCarPosition(car, race);
    if (left >= car.parentElement!.offsetWidth - 40 - 5) {
      handleCarFinish(carId, race);
    }
  }

  if (isAllFinished) {
    state.race.isRacing = false;
    return;
  }

  state.race.animationId = requestAnimationFrame(animateRace);
}

function updateCarPosition(car: HTMLElement, race: { startTime: number; velocity: number }): number {
  const road = car.parentElement!;
  const trackWidth = road.offsetWidth - 40;
  const elapsed = performance.now() - race.startTime;
  const progress = Math.min(1, elapsed * race.velocity / trackWidth);
  const left = progress * trackWidth;
  car.style.left = `${left}px`;
  return left;
}

function handleCarFinish(carId: number, race: { startTime: number; finished: boolean; time: number | undefined }): void {
  race.finished = true;
  race.time = (performance.now() - race.startTime) / 1000;
  void driveCar(carId);

  const finishedTimes = Object.values(state.race.carRaces)
    .filter((r) => r.time !== undefined)
    .map((r) => r.time as number);

  if (finishedTimes.length === 1 || race.time === Math.min(...finishedTimes)) {
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
  const app = document.querySelector("#app")!;
  const message = document.createElement("div") as HTMLElement;
  message.className = "winner-message";
  message.textContent = `🏆 ${carName} wins with time ${time.toFixed(2)}s!`;
  app.insertBefore(message, app.firstChild);
}

async function resetRaceHandler(): Promise<void> {
  if (state.race.animationId) {
    cancelAnimationFrame(state.race.animationId);
  }
  state.race.isRacing = false;
  state.race.carRaces = {};
  const carIds = state.garage.cars.map((c) => c.id);
  if (carIds.length > 0) {
    await resetRace(carIds);
  }
  for (const emoji of document.querySelectorAll(".car")) {
    (emoji as HTMLElement).style.left = "0px";
  }
}

function setupEventDelegation(): void {
  const app = document.querySelector("#app")!;

  app.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;

    const action = target.dataset.action;
    if (action && ["edit", "select", "remove", "start", "stop"].includes(action)) {
      await handleCarAction(action, Number(target.dataset.id));
      return;
    }

    if (await canCreateCar(target)) return;
    if (target.closest("#btn-generate")) { await handleGenerateCars(); return; }
    if (await canUpdateCar(target)) return;
    if (target.closest("#btn-cancel-edit")) { handleCancelEdit(); return; }
    if (target.closest("#btn-start-race")) { await startRaceHandler(); return; }
    if (target.closest("#btn-reset-race")) { await resetRaceHandler(); return; }
    if (canHandleGaragePagination(target)) return;
    if (canHandleSortControls(target)) return;
    if (canHandleWinnersPagination(target)) return;
  });
}

async function handleCarAction(action: string, id: number): Promise<void> {
  if (Number.isNaN(id)) return;

  switch (action) {
  case "edit":
  case "select": {
    const car = state.garage.cars.find((c) => c.id === id);
    if (!car) return;
    state.garage.editingCarId = id;
    state.garage.editName = car.name;
    state.garage.editColor = car.color;
    renderGarage();
    break;
  }
  case "remove": {
    await deleteCar(id);
    await loadGarageCars();
    renderGarage();
    break;
  }
  case "start": {
    await startEngine(id);
    break;
  }
  case "stop": {
    await stopEngine(id);
    break;
  }
  // No default
  }
}

async function canCreateCar(target: HTMLElement): Promise<boolean> {
  const buttonCreate = target.closest("#btn-create");
  if (!buttonCreate) return false;
  const nameInput = document.querySelector("#car-name") as HTMLInputElement | null;
  const name = nameInput?.value.trim() ?? "";
  if (!name) return true;
  const color = "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0");
  await createCar({ name, color });
  state.garage.createCarName = "";
  state.garage.page = 1;
  await loadGarageCars();
  renderGarage();
  return true;
}

async function handleGenerateCars(): Promise<void> {
  await generateCars(100);
  state.garage.page = 1;
  await loadGarageCars();
  renderGarage();
}

async function canUpdateCar(target: HTMLElement): Promise<boolean> {
  const buttonUpdate = target.closest("#btn-update");
  if (!buttonUpdate) return false;
  if (state.garage.editingCarId === undefined) return true;
  const nameInput = document.querySelector("#update-name") as HTMLInputElement | null;
  if (!nameInput) return true;
  const name = nameInput.value.trim();
  if (!name) return true;
  const colorInput = document.querySelector("#update-color") as HTMLInputElement | null;
  await updateCar(state.garage.editingCarId, { name, color: colorInput?.value || "#ff0000" });
  state.garage.editingCarId = undefined;
  state.garage.editName = "";
  state.garage.editColor = "#ff0000";
  await loadGarageCars();
  renderGarage();
  return true;
}

function handleCancelEdit(): void {
  state.garage.editingCarId = undefined;
  state.garage.editName = "";
  state.garage.editColor = "#ff0000";
  renderGarage();
}

function canHandleGaragePagination(target: HTMLElement): boolean {
  const buttonPrevious = target.closest("#btn-prev");
  if (buttonPrevious) {
    if (state.garage.page > 1) {
      state.garage.page--;
      void loadGarageCars().then(() => renderGarage());
    }
    return true;
  }
  const buttonNext = target.closest("#btn-next");
  if (buttonNext) {
    const totalPages = Math.ceil(state.garage.total / CARS_PER_PAGE);
    if (state.garage.page < totalPages) {
      state.garage.page++;
      void loadGarageCars().then(() => renderGarage());
    }
    return true;
  }
  return false;
}

function canHandleSortControls(target: HTMLElement): boolean {
  const sortBy = target.dataset.sort;
  if (sortBy && ["wins", "bestTime"].includes(sortBy)) {
    state.winners.sortBy = sortBy as SortConfig["sortBy"];
    state.winners.page = 1;
    renderWinners();
    return true;
  }
  const sortOrder = target.dataset.sortOrder;
  if (sortOrder && ["asc", "desc"].includes(sortOrder)) {
    state.winners.sortOrder = sortOrder as SortConfig["sortOrder"];
    state.winners.page = 1;
    renderWinners();
    return true;
  }
  return false;
}

function canHandleWinnersPagination(target: HTMLElement): boolean {
  const buttonPreviousWinners = target.closest("#btn-prev-winners");
  if (buttonPreviousWinners) {
    if (state.winners.page > 1) {
      state.winners.page--;
      renderWinners();
    }
    return true;
  }
  const buttonNextWinners = target.closest("#btn-next-winners");
  if (buttonNextWinners) {
    const totalPages = Math.ceil(state.winners.total / WINNERS_PER_PAGE);
    if (state.winners.page < totalPages) {
      state.winners.page++;
      renderWinners();
    }
    return true;
  }
  return false;
}

for (const tab of document.querySelectorAll("#nav-tabs .nav-link")) {
  tab.addEventListener("click", () => {
    const view = (tab as HTMLElement).dataset.view as ViewName;
    if (view) switchView(view);
  });
}

switchView("garage");
setupEventDelegation();

