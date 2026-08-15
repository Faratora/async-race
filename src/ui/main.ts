import {
  CARS_PER_PAGE,
  WINNERS_PER_PAGE,
  TRACK_PADDING,
  FINISH_OFFSET,
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

// ============ КОНСТАНТЫ ============
const INPUT_NAME_WIDTH = 200;
const DEFAULT_COLOR = "#ff0000";
const BREAKDOWN_CONFIG = {
  BASE_CHANCE: 0.001,
  DISTANCE_MULTIPLIER: 3,
  HIGH_SPEED_BONUS: 0.002,
  MIN_TIME_BEFORE_BREAKDOWN: 0.5,
  REPAIR_CHANCE_PER_FRAME: 0.005,
  REPAIR_TIME: 2,
  MAX_BREAKDOWNS: 2,
};

// ============ УТИЛИТЫ ============
const escapeHtml = (text: string): string => {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
};

const getApp = (): HTMLElement | null => document.querySelector("#app");

const getCarElement = (id: number): HTMLElement | null => 
  document.querySelector(`.car-road[data-id="${CSS.escape(String(id))}"] .car`);

const getRoadElement = (id: number): HTMLElement | null => 
  document.querySelector(`.car-road[data-id="${CSS.escape(String(id))}"]`);

const getTrackWidth = (road: HTMLElement): number => 
  road.offsetWidth - TRACK_PADDING;

const getCarRace = (id: number): CarRace | undefined => state.race.carRaces[id];

const isCarRacing = (id: number): boolean => {
  const race = getCarRace(id);
  return !!race && !race.finished && !race.broken;
};

const isCarBroken = (id: number): boolean => {
  const race = getCarRace(id);
  return !!race && race.broken;
};

const isCarFinished = (id: number): boolean => {
  const race = getCarRace(id);
  return !!race && (race.finished || race.broken);
};

const getBreakdownChance = (progress: number, velocity: number, elapsed: number): number => {
  if (elapsed < BREAKDOWN_CONFIG.MIN_TIME_BEFORE_BREAKDOWN) return 0;

  let chance = BREAKDOWN_CONFIG.BASE_CHANCE;
  chance *= (1 + progress * BREAKDOWN_CONFIG.DISTANCE_MULTIPLIER);

  if (velocity > 0.8) {
    chance += BREAKDOWN_CONFIG.HIGH_SPEED_BONUS;
  }

  return chance;
};

const getBreakdownType = (progress: number, velocity: number): string => {
  if (progress > 0.8) return "engine_overheating";
  if (velocity > 0.8) return "transmission_failure";
  if (progress < 0.3) return "start_stall";
  return "random_breakdown";
};

// ============ ЗАГРУЗКА ДАННЫХ ============
const loadGarageCars = async (): Promise<void> => {
  try {
    const data = await fetchCars(state.garage.page, CARS_PER_PAGE);
    state.garage.cars = data.cars;
    state.garage.total = data.total;
  } catch (error) {
    console.error("Failed to load cars:", error);
  }
};

const loadWinners = async (): Promise<void> => {
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
const switchView = (view: ViewName): void => {
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
const renderGarage = async (): Promise<void> => {
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
const createCarCard = (car: Car): HTMLElement => {
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

const renderCarCards = (app: HTMLElement): void => {
  if (state.garage.cars.length === 0) {
    app.append(
      element("div", { class: "view-info", style: "padding: 2rem; text-align: center;" }, 
        "No cars yet. Create one above!"
      )
    );
    return;
  }

  state.garage.cars.forEach(car => app.append(createCarCard(car)));
  updateCarButtonStates();
};

// ============ ОБНОВЛЕНИЕ СОСТОЯНИЯ КНОПОК ============
const updateCarButtonStates = (): void => {
  state.garage.cars.forEach(car => {
    const carId = Number(car.id);
    const startButton = document.querySelector<HTMLButtonElement>(
      `.btn-start-engine[data-id="${CSS.escape(String(carId))}"]`
    );
    const stopButton = document.querySelector<HTMLButtonElement>(
      `.btn-stop-engine[data-id="${CSS.escape(String(carId))}"]`
    );
    
    if (!startButton || !stopButton) return;

    const isDriving = state.race.drivingCars[carId] !== undefined || 
      (state.race.isRacing && isCarRacing(carId));
    const isBroken = isCarBroken(carId);
    const isFinished = isCarFinished(carId);

    startButton.disabled = isDriving || isBroken || isFinished;
    // Stop должен быть активен, если машина финишировала (чтобы сбросить)
    stopButton.disabled = !(isDriving || isBroken) && !isFinished;
  });
};

// ============ ПАГИНАЦИЯ ============
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
const renderWinners = async (): Promise<void> => {
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

// ============ УПРАВЛЕНИЕ ГОНКОЙ ============
const removeWinnerMessage = (): void => {
  document.querySelector(".winner-message")?.remove();
};

const showWinnerMessage = (carName: string, time: number): void => {
  const app = getApp();
  if (!app) return;

  const message = element("div", { class: "winner-message" }, 
    `🏆 ${carName} wins with time ${time.toFixed(2)}s!`
  );
  app.insertBefore(message, app.firstChild);
};

const showBreakdownMessage = (carId: number, type: string): void => {
  const app = getApp();
  if (!app) return;

  const messages: Record<string, string> = {
    engine_overheating: "🔥 Engine overheating!",
    transmission_failure: "⚙️ Transmission failure!",
    start_stall: "😤 Stalled at start!",
    random_breakdown: "🔧 Random breakdown!",
  };

  const message = element(
    "div",
    {
      class: "breakdown-message",
      style: "position: fixed; top: 20px; right: 20px; background: #ff4444; color: white; padding: 10px; border-radius: 5px; z-index: 1000;",
    },
    `${messages[type] ?? "💥 Breakdown!"} (Car ${carId})`
  );

  app.append(message);

  setTimeout(() => {
    message.remove();
  }, 3000);
};

const resetCarPositions = (carIds: number[]): void => {
  carIds.forEach(id => {
    const car = getCarElement(id);
    if (car instanceof HTMLElement) {
      car.style.transform = "translateX(0px)";
    }
  });
};

// ============ АНИМАЦИЯ ============
const animateCarRace = (carId: number, race: CarRace): void => {
  const car = getCarElement(carId);
  if (!(car instanceof HTMLElement)) return;

  // OБРАБОТКА СЛОМАННОЙ МАШИНЫ
  if (race.broken) {
    car.classList.add("broken");

    if (race.breakdownHistory && race.breakdownHistory.count < BREAKDOWN_CONFIG.MAX_BREAKDOWNS) {
      if (race.repairStartTime === undefined) {
        race.repairStartTime = performance.now();
        race.isRepairing = true;
        console.log(`🔧 Starting repair for car ${carId}...`);
        return;
      }

      const repairElapsed = (performance.now() - race.repairStartTime) / 1000;
      if (repairElapsed >= BREAKDOWN_CONFIG.REPAIR_TIME) {
        race.broken = false;
        race.isRepairing = false;
        race.repairStartTime = undefined;
        car.classList.remove("broken");
        console.log(`✅ Car ${carId} repaired!`);

        const currentTransform = car.style.transform;
        const match = currentTransform.match(/translateX\(([-\d.]+)px\)/);
        const currentLeft = match ? parseFloat(match[1]) : 0;
        car.dataset.lastPosition = String(currentLeft);
        return;
      }

      const repairProgress = repairElapsed / BREAKDOWN_CONFIG.REPAIR_TIME;
      car.style.opacity = String(0.3 + repairProgress * 0.7);
      return;
    }

    console.log(`💀 Car ${carId} is out of the race!`);
    return;
  }

  // ДВИЖЕНИЕ МАШИНЫ
  const road = car.parentElement;
  if (!(road instanceof HTMLElement)) return;

  const trackWidth = getTrackWidth(road);
  const elapsed = performance.now() - race.startTime;
  const elapsedSeconds = elapsed / 1000;
  const progress = Math.min(1, elapsed * race.velocity / trackWidth);
  const left = Math.min(progress * trackWidth, trackWidth - FINISH_OFFSET);

  car.style.transform = `translateX(${left}px)`;
  car.dataset.lastPosition = String(left);

  if (race.isRepairing) {
    car.style.opacity = "1";
    race.isRepairing = false;
  }

  // ПРОВЕРКА ПОЛОМКИ
  const breakdownChance = getBreakdownChance(progress, race.velocity, elapsedSeconds);

  if (Math.random() < breakdownChance) {
    const breakdownType = getBreakdownType(progress, race.velocity);

    race.broken = true;
    if (!race.breakdownHistory) {
      race.breakdownHistory = { count: 0, timestamps: [], positions: [], types: [] };
    }
    race.breakdownHistory.count++;
    race.breakdownHistory.timestamps.push(performance.now());
    race.breakdownHistory.positions.push(progress);
    race.breakdownHistory.types.push(breakdownType);

    car.classList.add("broken");
    car.classList.add(`broken-${breakdownType}`);

    switch (breakdownType) {
      case "engine_overheating":
        car.style.transform = `translateX(${left}px) scale(1.1)`;
        console.log(`🔥 Car ${carId} engine overheated at ${Math.round(progress * 100)}%!`);
        break;
      case "transmission_failure":
        car.style.transform = `translateX(${left}px) rotate(5deg)`;
        console.log(`⚙️ Car ${carId} transmission failed at ${Math.round(progress * 100)}%!`);
        break;
      case "start_stall":
        console.log(`😤 Car ${carId} stalled at start!`);
        break;
      default:
        console.log(`🔧 Car ${carId} broke down at ${Math.round(progress * 100)}%!`);
    }

    showBreakdownMessage(carId, breakdownType);
    return;
  }

  // ПРОВЕРКА ФИНИША
  if (left >= trackWidth - FINISH_OFFSET) {
    handleCarFinish(carId, race, elapsed);
  }
};

const handleCarFinish = (carId: number, race: CarRace, elapsed: number): void => {
  if (race.broken) return;
  
  race.finished = true;
  
  const road = getRoadElement(carId);
  if (road instanceof HTMLElement) {
    const trackWidth = getTrackWidth(road);
    race.time = trackWidth / race.velocity;
  } else {
    race.time = elapsed / 1000;
  }

  void driveCar(carId).catch(error => console.error("Failed to drive car:", error));
  updateCarButtonStates();

  if (!state.race.winnerAnnounced) {
    state.race.winnerAnnounced = true;
    const car = state.garage.cars.find(c => c.id === carId);
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
};

const animateRace = (): void => {
  if (!state.race.isRacing) return;

  let allFinished = true;

  Object.entries(state.race.carRaces).forEach(([idStr, race]) => {
    if (race.finished || race.broken) return;
    allFinished = false;
    animateCarRace(Number(idStr), race);
  });

  if (allFinished) {
    state.race.isRacing = false;
    state.race.animationId = 0;
    
    Object.keys(state.race.carRaces).forEach(idStr => {
      const carId = Number(idStr);
      const race = state.race.carRaces[carId];
      race.broken = false;
      race.isRepairing = false;
      race.repairStartTime = undefined;
      
      const car = getCarElement(carId);
      if (car instanceof HTMLElement) {
        car.classList.remove("broken");
        car.classList.remove("broken-engine_overheating", "broken-transmission_failure", "broken-start_stall", "broken-random_breakdown");
        car.style.opacity = "1";
        car.style.scale = "1";
        car.style.rotate = "0deg";
      }
    });
    
    updateCarButtonStates();
    return;
  }

  state.race.animationId = requestAnimationFrame(animateRace);
};

// ============ ОБРАБОТКА ИЗМЕНЕНИЯ РАЗМЕРА ============
const handleResize = (): void => {
  const updateCarPosition = (id: number, startTime: number, velocity: number): void => {
    const car = getCarElement(id);
    if (!(car instanceof HTMLElement)) return;

    const road = car.parentElement;
    if (!(road instanceof HTMLElement)) return;

    const trackWidth = getTrackWidth(road);
    const elapsed = performance.now() - startTime;
    const progress = Math.min(1, elapsed * velocity / trackWidth);
    const left = Math.min(progress * trackWidth, trackWidth - FINISH_OFFSET);
    car.style.transform = `translateX(${left}px)`;
  };

  Object.entries(state.race.carRaces).forEach(([idStr, race]) => {
    if (!race.finished && !race.broken) {
      updateCarPosition(Number(idStr), race.startTime, race.velocity);
    }
  });

  Object.entries(state.race.drivingCars).forEach(([idStr, drive]) => {
    updateCarPosition(Number(idStr), drive.startTime, drive.velocity);
  });
};

// ============ ОБРАБОТЧИКИ ГОНКИ ============
const startRaceHandler = async (): Promise<void> => {
  if (state.race.isRacing) return;
  
  const carIds = state.garage.cars.map(c => c.id);
  if (carIds.length === 0) return;

  removeWinnerMessage();
  state.race.isRacing = true;
  state.race.winnerAnnounced = false;

  await startRace(carIds);
  await Promise.all(carIds.map(id => startEngine(id)));

  const velocities = await Promise.allSettled(carIds.map(id => getVelocity(id)));
  const now = performance.now();
  
  state.race.carRaces = {};
  carIds.forEach((id, index) => {
    const result = velocities[index];
    const isBroken = result.status === "rejected";
    
    state.race.carRaces[id] = {
      startTime: now,
      velocity: result.status === "fulfilled" ? result.value : 0.5,
      finished: false,
      broken: isBroken,
      time: undefined,
      breakdownHistory: {
        count: isBroken ? 1 : 0,
        timestamps: isBroken ? [now] : [],
        positions: isBroken ? [0] : [],
        types: isBroken ? ["start_stall"] : [],
      },
      repairStartTime: undefined,
      isRepairing: false,
    };
    
    if (isBroken) {
      console.log(`🚗 Car ${id} broke down at start!`);
      const car = getCarElement(id);
      if (car instanceof HTMLElement) {
        car.classList.add("broken");
        car.classList.add("broken-start_stall");
      }
    }
  });

  resetCarPositions(carIds);
  updateCarButtonStates();
  animateRace();
};

const resetRaceHandler = async (): Promise<void> => {
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

  document.querySelectorAll(".car").forEach(car => {
    if (car instanceof HTMLElement) {
      car.classList.remove("broken");
      car.classList.remove("broken-engine_overheating", "broken-transmission_failure", "broken-start_stall", "broken-random_breakdown");
      car.style.transform = "translateX(0px)";
      car.style.opacity = "1";
      car.style.scale = "1";
      car.style.rotate = "0deg";
      delete car.dataset.lastPosition;
    }
  });

  document.querySelectorAll(".breakdown-message").forEach(el => el.remove());

  const carIds = state.garage.cars.map(c => c.id);
  if (carIds.length > 0) {
    await resetRace(carIds);
  }
  
  updateCarButtonStates();
};

// ============ ДВИЖЕНИЕ АВТОМОБИЛЯ ============
const animateDriveCar = (): void => {
  const now = performance.now();
  const entries = Object.entries(state.race.drivingCars);

  entries.forEach(([idStr, drive]) => {
    const carId = Number(idStr);
    const carElement = getCarElement(carId);
    if (!(carElement instanceof HTMLElement)) return;

    const road = carElement.parentElement;
    if (!(road instanceof HTMLElement)) return;

    const trackWidth = getTrackWidth(road);
    const elapsed = now - drive.startTime;
    const progress = Math.min(1, elapsed * drive.velocity / trackWidth);
    const left = Math.min(progress * trackWidth, trackWidth - FINISH_OFFSET);
    carElement.style.transform = `translateX(${left}px)`;

    if (progress >= 1) {
      delete state.race.drivingCars[carId];
      const existing = state.race.carRaces[carId];
      if (existing) {
        existing.finished = true;
      } else {
        state.race.carRaces[carId] = {
          startTime: drive.startTime,
          velocity: drive.velocity,
          finished: true,
          broken: false,
          time: undefined,
        };
      }
      void driveCar(carId)
        .then(updateCarButtonStates)
        .catch(error => {
          console.error("Failed to drive car:", error);
          updateCarButtonStates();
        });
    }
  });

  if (Object.keys(state.race.drivingCars).length > 0) {
    state.race.driveAnimationId = requestAnimationFrame(animateDriveCar);
  }
};

const startDriveCar = async (carId: number): Promise<void> => {
  const velocity = await getVelocity(carId);

  if (state.race.carRaces[carId]) {
    state.race.carRaces[carId].finished = false;
    state.race.carRaces[carId].broken = false;
  }

  state.race.drivingCars[carId] = { startTime: performance.now(), velocity };

  const carElement = getCarElement(carId);
  if (carElement instanceof HTMLElement) {
    carElement.style.transform = "translateX(0px)";
  }

  updateCarButtonStates();

  if (Object.keys(state.race.drivingCars).length === 1) {
    animateDriveCar();
  }
};

const stopDriveCar = (carId: number): void => {
  delete state.race.drivingCars[carId];

  if (state.race.carRaces[carId]) {
    state.race.carRaces[carId].finished = true;
  }

  const carElement = getCarElement(carId);
  if (carElement instanceof HTMLElement) {
    carElement.style.transform = "translateX(0px)";
  }
  
  updateCarButtonStates();
};

const resetCarToStart = (carId: number): void => {
  if (state.race.animationId) {
    cancelAnimationFrame(state.race.animationId);
    state.race.animationId = 0;
  }
  state.race.isRacing = false;

  if (state.race.carRaces[carId]) {
    const race = state.race.carRaces[carId];
    race.broken = false;
    race.finished = false;
    race.time = undefined;
  }

  const car = getCarElement(carId);
  if (car instanceof HTMLElement) {
    car.classList.remove("broken");
    const road = car.parentElement;
    if (road instanceof HTMLElement) {
      const trackWidth = getTrackWidth(road);
      const currentTransform = car.style.transform;
      const match = currentTransform.match(/translateX\(([-\d.]+)px\)/);
      const currentLeft = match ? parseFloat(match[1]) : 0;
      const duration = Math.max(300, (currentLeft / trackWidth) * 500);
      
      car.style.transition = `transform ${duration}ms ease-out`;
      car.style.transform = "translateX(0px)";
      setTimeout(() => {
        car.style.transition = "";
      }, duration);
    }
  }
  
  updateCarButtonStates();
};

// ============ ОБРАБОТЧИКИ СОБЫТИЙ ============
const handleCarAction = (action: string | undefined, id: number): void => {
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
        }
        const car = getCarElement(id);
        if (car instanceof HTMLElement) {
          car.classList.remove("broken");
          car.classList.remove("broken-engine_overheating", "broken-transmission_failure", "broken-start_stall", "broken-random_breakdown");
          car.style.opacity = "1";
          car.style.scale = "1";
          car.style.rotate = "0deg";
        }
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

const handleCreateButton = (): void => {
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

const handleGenerateButton = (): void => {
  void generateCars(100)
    .then(() => {
      state.garage.page = 1;
      return loadGarageCars();
    })
    .then(renderGarage);
};

const handleUpdateButton = (): void => {
  if (state.garage.editingCarId === undefined) return;

  const nameInput = document.querySelector<HTMLInputElement>("#update-name");
  if (!nameInput) return;

  const name = nameInput.value.trim();
  if (!name) return;

  const colorInput = document.querySelector<HTMLInputElement>("#update-color");
  const color = colorInput?.value || DEFAULT_COLOR;

  void updateCar(state.garage.editingCarId, { name, color })
    .then(() => {
      state.garage.editingCarId = undefined;
      state.garage.editName = "";
      state.garage.editColor = DEFAULT_COLOR;
      return loadGarageCars();
    })
    .then(renderGarage);
};

const handleCancelEditButton = (): void => {
  state.garage.editingCarId = undefined;
  state.garage.editName = "";
  state.garage.editColor = DEFAULT_COLOR;

  if (state.race.driveAnimationId) {
    cancelAnimationFrame(state.race.driveAnimationId);
  }
  state.race.drivingCars = {};
  renderGarage();
};

const handlePreviousButton = (): void => {
  if (state.race.isRacing || state.garage.page <= 1) return;
  state.garage.page--;
  void loadGarageCars().then(renderGarage);
};

const handleNextButton = (): void => {
  if (state.race.isRacing) return;
  const totalPages = Math.ceil(state.garage.total / CARS_PER_PAGE);
  if (state.garage.page >= totalPages) return;
  state.garage.page++;
  void loadGarageCars().then(renderGarage);
};

const handlePreviousWinnersButton = (): void => {
  if (state.winners.page <= 1) return;
  state.winners.page--;
  renderWinners();
};

const handleNextWinnersButton = (): void => {
  const totalPages = Math.ceil(state.winners.total / WINNERS_PER_PAGE);
  if (state.winners.page >= totalPages) return;
  state.winners.page++;
  renderWinners();
};

// ============ ДЕЛЕГИРОВАНИЕ СОБЫТИЙ ============
const handleAppClick = (event: MouseEvent): void => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  // Обработка действий с автомобилями
  const action = target.dataset.action;
  if (action && ["select", "remove", "start", "stop"].includes(action)) {
    const id = Number(target.dataset.id);
    if (!Number.isNaN(id)) {
      handleCarAction(action, id);
    }
    return;
  }

  // Обработка кнопок
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

  // Сортировка
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
  }
};

const setupEventDelegation = (): void => {
  const app = getApp();
  if (app) {
    app.addEventListener("click", handleAppClick);
  }
};

// ============ ТИП-ГВАРДЫ ============
const isViewName = (value: string | null | undefined): value is ViewName =>
  value === "garage" || value === "winners";

const isSortBy = (value: string | null | undefined): value is SortConfig["sortBy"] =>
  value === "wins" || value === "bestTime" || value === "name";

const isSortOrder = (value: string | null | undefined): value is SortConfig["sortOrder"] =>
  value === "asc" || value === "desc";

// ============ ИНИЦИАЛИЗАЦИЯ ============
// Настройка вкладок
document.querySelectorAll("#nav-tabs .nav-link").forEach(tab => {
  if (!(tab instanceof HTMLElement)) return;
  tab.addEventListener("click", () => {
    const view = tab.dataset.view;
    if (view && isViewName(view)) {
      switchView(view);
    }
  });
});

export const init = (): void => {
  const resizeObserver = new ResizeObserver(handleResize);
  resizeObserver.observe(document.body);
};

export { switchView, setupEventDelegation };