import type { BreakdownType } from "../config/index.ts";
import { getBreakdownMessage } from "../config/index.ts";

// ============ СОЗДАНИЕ СООБЩЕНИЯ ============
export const createBreakdownMessage = (carId: number, type: BreakdownType): string => {
  return `${getBreakdownMessage(type)} (Car ${carId})`;
};

// ============ ПОКАЗ УВЕДОМЛЕНИЯ ============
export const showBreakdownNotification = (carId: number, type: BreakdownType): void => {
  const app = document.querySelector("#app");
  if (!(app instanceof HTMLElement)) return;

  const message = document.createElement("div");
  message.className = "breakdown-notification";
  message.textContent = createBreakdownMessage(carId, type);
  message.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ff4444;
    color: white;
    padding: 10px;
    border-radius: 5px;
    z-index: 1000;
  `;

  app.append(message);
  setTimeout(() => message.remove(), 3000);
};
