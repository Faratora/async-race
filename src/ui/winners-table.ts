import { state } from "../state/index.ts";
import { element } from "./builder.ts";
import { escapeHtml } from "./ui-manager.ts";
import { formatTime, WINNERS_PER_PAGE } from "../types/index.ts";

// ============ СТРОКА ПОБЕДИТЕЛЯ ============
export const createWinnerRow = (winner: import("../types/index.ts").Winner, index: number): HTMLElement =>
  element("div", { class: "table-row" },
    element("span", undefined, String(index + 1)),
    element("span", undefined,
      element("div", { class: "winner-car-icon", style: `background-color: ${winner.carColor};` })
    ),
    element("span", undefined, escapeHtml(winner.carName)),
    element("span", undefined, String(winner.wins)),
    element("span", undefined, formatTime(winner.bestTime))
  );

// ============ ТАБЛИЦА ПОБЕДИТЕЛЕЙ ============
export const renderWinnersTable = (app: HTMLElement | DocumentFragment): void => {
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
    const startIndex = (state.winners.page - 1) * WINNERS_PER_PAGE;
    state.winners.winners.forEach((winner, index) => {
      table.append(createWinnerRow(winner, startIndex + index));
    });
  }

  app.append(table);
};

// ============ ПАГИНАЦИЯ ПОБЕДИТЕЛЕЙ ============
export const renderWinnersPagination = (app: HTMLElement, totalPages: number): void => {
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
