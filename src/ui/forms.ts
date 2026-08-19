import { state } from "../state/index.ts";
import { element } from "./builder.ts";
import { escapeHtml } from "./ui-manager.ts";
import { CONFIG } from "../config/index.ts";

// ============ ФОРМА СОЗДАНИЯ МАШИНЫ ============
export const renderAddCarForm = (app: HTMLElement): void => {
  const form = element("div", { class: "add-car-form" });
  form.innerHTML = `
    <input type="text" id="car-name" placeholder="Car name" value="${escapeHtml(state.garage.createCarName)}" class="form-control" style="width: ${CONFIG.UI.INPUT_NAME_WIDTH}px;">
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

// ============ ФОРМА РЕДАКТИРОВАНИЯ ============
export const renderEditForm = (app: HTMLElement): void => {
  if (state.garage.editingCarId === undefined) return;

  const form = element("div", { class: "edit-car-form" });
  form.innerHTML = `
    <input type="text" id="update-name" value="${escapeHtml(state.garage.editName)}" class="form-control" style="width: ${CONFIG.UI.INPUT_NAME_WIDTH}px;">
    <input type="color" id="update-color" value="${state.garage.editColor}" class="form-control form-control-color">
    <button class="btn btn-primary" id="btn-update">Update</button>
    <button class="btn btn-secondary" id="btn-cancel-edit">Cancel</button>
  `;
  app.append(form);
};

// ============ УПРАВЛЕНИЕ ГОНКОЙ ============
export const renderRaceControls = (app: HTMLElement): void => {
  const controls = element("div", { class: "race-controls" });
  controls.innerHTML = `
    <button class="btn btn-success" id="btn-start-race">Start Race</button>
    <button class="btn btn-warning" id="btn-reset-race">Reset Race</button>
  `;

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
