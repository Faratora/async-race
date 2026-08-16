import type { BreakdownType } from "../config/index.ts";
import { getBreakdownMessage } from "../config/index.ts";
import { formatTime } from "../types/index.ts";

// ============ ОБЩАЯ ЛОГИКА УВЕДОМЛЕНИЙ ============
interface NotificationOptions {
  className: string;
  message: string;
  duration?: number;
  insertFirst?: boolean;
}

const showNotification = (options: NotificationOptions): void => {
  const app = document.querySelector("#app");
  if (!(app instanceof HTMLElement)) return;

  const element = document.createElement("div");
  element.className = options.className;
  element.textContent = options.message;

  if (options.insertFirst) {
    app.insertBefore(element, app.firstChild);
  } else {
    app.append(element);
  }

  setTimeout(() => element.remove(), options.duration ?? 3000);
};

// ============ ПОЛОМКА ============
export const createBreakdownMessage = (carId: number, type: BreakdownType): string => {
  return `${getBreakdownMessage(type)} (Car ${carId})`;
};

export const showBreakdownNotification = (carId: number, type: BreakdownType): void => {
  showNotification({
    className: "breakdown-notification",
    message: createBreakdownMessage(carId, type),
    duration: 3000,
  });
};

// ============ ПОБЕДИТЕЛЬ ============
export interface BrokenCar {
  id: number;
  name: string;
  type: string;
}

export const showWinnerNotification = (
  winnerName: string,
  time: number,
  brokenCars: BrokenCar[] = []
): void => {
  const message = `🏆 ${winnerName} wins with time ${formatTime(time)}!`;

  showNotification({
    className: "winner-message",
    message,
    duration: 30000,
    insertFirst: true,
  });

  if (brokenCars.length > 0) {
    const brokenList = brokenCars
      .map(car => `${car.name} (Car ${car.id})`)
      .join(", ");
    const breakdownMessage = `💥 Broken: ${brokenList}`;

    showNotification({
      className: "breakdown-notification",
      message: breakdownMessage,
      duration: 30000,
    });
  }
};
