import { state } from "../state/index.ts";
import { element } from "./builder.ts";
import { escapeHtml } from "./ui-manager.ts";
import { CONFIG } from "../config/index.ts";

// ============ УТИЛИТЫ ============
const createInput = (id: string, type: string, value: string, placeholder = "", width = 0): HTMLElement => {
  const attrs: Record<string, string | number> = { id, type, value, class: "form-control" };
  if (placeholder) attrs.placeholder = placeholder;
  if (width > 0) attrs.style = `width: ${width}px;`;
  return element("input", attrs);
};

const createButton = (id: string, text: string, btnClass: string): HTMLElement =>
  element("button", { id, class: btnClass }, text);

// ============ ФОРМА СОЗДАНИЯ МАШИНЫ ============
export const renderAddCarForm = (app: HTMLElement): void => {
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

  app.append(form);
};

// ============ ФОРМА РЕДАКТИРОВАНИЯ ============
export const renderEditForm = (app: HTMLElement): void => {
  if (state.garage.editingCarId === undefined) return;

  const form = element("div", { class: "edit-car-form" });
  form.append(
    createInput("update-name", "text", escapeHtml(state.garage.editName), "", CONFIG.UI.INPUT_NAME_WIDTH),
    createInput("update-color", "color", state.garage.editColor),
    createButton("btn-update", "Update", "btn btn-primary"),
    createButton("btn-cancel-edit", "Cancel", "btn btn-secondary"),
  );
  app.append(form);
};

// ============ УПРАВЛЕНИЕ ГОНКОЙ ============
export const renderRaceControls = (app: HTMLElement): void => {
  const controls = element("div", { class: "race-controls" });
  controls.append(
    createButton("btn-start-race", "Start Race", "btn btn-success"),
    createButton("btn-reset-race", "Reset Race", "btn btn-warning"),
  );

  controls.querySelector<HTMLButtonElement>("#btn-start-race")?.addEventListener("click", () => {
    import("./race-engine.ts").then(({ startRaceHandler }) => {
      void startRaceHandler();
    });
  });
  controls.querySelector<HTMLButtonElement>("#btn-reset-race")?.addEventListener("click", () => {
    import("./race-engine.ts").then(({ resetRaceHandler }) => {
      void resetRaceHandler();
    });
  });

  app.append(controls);
};
