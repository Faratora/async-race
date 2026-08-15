import { state } from "../state/index.ts";
import { element } from "./builder.ts";

// ============ ПАГИНАЦИЯ ГАРАЖА ============
export const renderGaragePagination = (app: HTMLElement, totalPages: number): void => {
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

// ============ ЗАГОЛОВОК ГАРАЖА ============
export const renderGarageHeader = (app: HTMLElement, totalPages: number): void => {
  app.append(
    element("div", { class: "view-header" },
      element("span", { class: "view-title" }, `Garage (${state.garage.total})`),
      element("span", { class: "view-info" }, `Page ${state.garage.page} / ${totalPages} (${state.garage.total} cars)`)
    )
  );
};

// ============ ЗАГОЛОВОК ПОБЕДИТЕЛЕЙ ============
export const renderWinnersHeader = (app: HTMLElement, totalPages: number): void => {
  app.append(
    element("div", { class: "view-header" },
      element("span", { class: "view-title" }, "Winners"),
      element("span", { class: "view-info" },
        `Page ${state.winners.page} / ${totalPages} (${state.winners.total} winners)`
      )
    )
  );
};
