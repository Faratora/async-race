import type { BreakdownType } from "../config/index.ts";
import { getBreakdownMessage } from "../config/index.ts";

// ============ ПОЛОМКА ============
export const createBreakdownMessage = (carId: number, type: BreakdownType): string => {
  return `${getBreakdownMessage(type)} (Car ${carId})`;
};

export const showBreakdownNotification = (carId: number, type: BreakdownType): void => {
  const app = document.querySelector("#app");
  if (!(app instanceof HTMLElement)) return;

  const message = document.createElement("div");
  message.className = "breakdown-notification";
  message.textContent = createBreakdownMessage(carId, type);

  app.append(message);
  setTimeout(() => message.remove(), 3000);
};

// ============ ПОБЕДИТЕЛЬ ============
export const showWinnerNotification = (carName: string, time: number): void => {
  const app = document.querySelector("#app");
  if (!(app instanceof HTMLElement)) return;

  const message = document.createElement("div");
  message.className = "winner-message";
  message.textContent = `🏆 ${carName} wins with time ${time.toFixed(2)}s!`;

  app.insertBefore(message, app.firstChild);
  setTimeout(() => message.remove(), 30000);
};
