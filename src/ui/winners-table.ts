import type { Winner } from "../types/index.ts";
import type { SortConfig } from "../types/index.ts";

import { state } from "../state/index.ts";
import { element } from "./builder.ts";
import { escapeHtml } from "./helpers.ts";
import { WINNERS_PER_PAGE } from "../config/index.ts";
import { formatTime } from "../types/index.ts";

// ============ УТИЛИТЫ ============
const createSortHeader = (label: string, sortKey: SortConfig["sortBy"]): HTMLElement => {
  const isActive = state.winners.sortBy === sortKey;
  const arrow = isActive ? (state.winners.sortOrder === "asc" ? "▲" : "▼") : "";
  return element("span", { class: "table-header-sortable", dataSort: sortKey }, `${label} ${arrow}`);
};

// ============ СТРОКА ПОБЕДИТЕЛЯ ============
export const createWinnerRow = (winner: Winner, index: number, onDelete: (id: number) => void): HTMLElement => {
  const row = element("div", { class: "table-row" },
    element("span", undefined, String(index + 1)),
    element("span", undefined,
      element("div", { class: "winner-car-icon", style: `background-color: ${winner.carColor};` })
    ),
    element("span", undefined, escapeHtml(winner.carName)),
    element("span", undefined, String(winner.wins)),
    element("span", undefined, formatTime(winner.bestTime))
  );
  
  const clearButton = element("button", {
    class: "winner-delete-btn",
    title: "Удалить",
  }, "✕");
  clearButton.addEventListener("click", () => onDelete(winner.id));
  row.append(clearButton);
  
  return row;
};

// ============ ТАБЛИЦА ПОБЕДИТЕЛЕЙ ============
export const renderWinnersTable = (
  app: HTMLElement | DocumentFragment,
  onDelete?: (id: number) => void,
  onClearAll?: () => void,
): void => {
  const table = element("div");

  const headerChildren: (HTMLElement | string)[] = [
    element("span", undefined, "Number"),
    element("span", undefined, "Car"),
    createSortHeader("Name", "name"),
    createSortHeader("Wins", "wins"),
    createSortHeader("Best time (second)", "bestTime"),
  ];
  
  if (onClearAll) {
    const clearButton = element("button", {
      class: "clear-all-btn",
    }, "Очистить всё");
    clearButton.addEventListener("click", onClearAll);
    headerChildren.push(clearButton);
  }
  
  const header = element("div", { class: "table-header" }, ...headerChildren);
  table.append(header);

  if (state.winners.winners.length === 0) {
    table.append(
      element("div", { class: "table-row", style: "grid-column: 1 / -1; text-align: center;" },
        "No winners yet. Start a race!"
      )
    );
  } else {
    for (const [index, winner] of state.winners.winners.entries()) {
      const globalIndex = (state.winners.page - 1) * WINNERS_PER_PAGE + index;
      table.append(createWinnerRow(winner, globalIndex, onDelete ?? (() => {})));
    }
  }

  app.append(table);
};
