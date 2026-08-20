import type { Winner } from "../types/index.ts";
import type { SortConfig } from "../types/index.ts";

import { state } from "../state/index.ts";
import { element } from "./builder.ts";
import { escapeHtml } from "./ui-manager.ts";
import { WINNERS_PER_PAGE } from "../config/index.ts";
import { formatTime } from "../types/index.ts";

// ============ УТИЛИТЫ ============
const createSortHeader = (label: string, sortKey: SortConfig["sortBy"]): HTMLElement => {
  const isActive = state.winners.sortBy === sortKey;
  const arrow = isActive ? (state.winners.sortOrder === "asc" ? "▲" : "▼") : "";
  return element("span", { class: "table-header-sortable", dataSort: sortKey }, `${label} ${arrow}`);
};

// ============ СТРОКА ПОБЕДИТЕЛЯ ============
export const createWinnerRow = (winner: Winner, index: number): HTMLElement =>
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
    createSortHeader("Name", "name"),
    createSortHeader("Wins", "wins"),
    createSortHeader("Best time (second)", "bestTime")
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
