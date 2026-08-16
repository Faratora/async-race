import { Car } from "../types/index.ts";
import { state } from "../state/index.ts";
import { element } from "./builder.ts";
import { escapeHtml } from "./ui-manager.ts";
import { isCarRacing, isCarBroken, isCarFinished, updateCarButtonStates } from "./animations.ts";

// ============ КАРТОЧКА АВТОМОБИЛЯ ============
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
  // Отображаем максимальную скорость
  const carSpeed = element("div", { class: "car-speed" }, `${car.maxSpeed} km/h`);
  const carInfo = element("div", { class: "car-info" }, carName, carSpeed);

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
    element("button", { class: "btn btn-outline-info btn btn-sm", dataAction: "select", dataId: String(car.id) }, "Update"),
    element("button", { class: "btn btn-outline-danger btn btn-sm", dataAction: "remove", dataId: String(car.id) }, "Delete")
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

// ============ РЕНДЕР КАРТОЧЕК ============
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
  updateCarButtonStates();
};
