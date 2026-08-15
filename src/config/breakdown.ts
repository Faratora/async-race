import { BREAKDOWN_CONFIG } from "./index.ts";
import { CarRace } from "../types/index.ts";

// ============ ТИПЫ ============
export type BreakdownType =
  | "engine_overheating"
  | "transmission_failure"
  | "start_stall"
  | "random_breakdown";

export interface BreakdownHistory {
  count: number;
  timestamps: number[];
  positions: number[];
  types: BreakdownType[];
}

export interface BreakdownEvent {
  type: BreakdownType;
  progress: number;
  velocity: number;
  timestamp: number;
}

// ============ КОНСТАНТЫ ============
const BREAKDOWN_MESSAGES: Record<BreakdownType, string> = {
  engine_overheating: "Engine overheating!",
  transmission_failure: "Transmission failure!",
  start_stall: "Stalled at start!",
  random_breakdown: "Random breakdown!",
};

// ============ РАСЧЁТ ШАНСА ПОЛОМКИ ============
export const getBreakdownChance = (
  progress: number,
  velocity: number,
  elapsed: number
): number => {
  if (elapsed < BREAKDOWN_CONFIG.MIN_TIME_BEFORE_BREAKDOWN) return 0;

  let chance = BREAKDOWN_CONFIG.BASE_CHANCE;
  chance *= (1 + progress * BREAKDOWN_CONFIG.DISTANCE_MULTIPLIER);

  if (velocity > 0.8) {
    chance += BREAKDOWN_CONFIG.HIGH_SPEED_BONUS;
  }

  return chance;
};

// ============ ТИП ПОЛОМКИ ============
export const getBreakdownType = (progress: number, velocity: number): BreakdownType => {
  if (progress > 0.8) return "engine_overheating";
  if (velocity > 0.8) return "transmission_failure";
  if (progress < 0.3) return "start_stall";
  return "random_breakdown";
};

// ============ СООБЩЕНИЕ О ПОЛОМКЕ ============
export const getBreakdownMessage = (type: BreakdownType): string => {
  return BREAKDOWN_MESSAGES[type];
};

// ============ ОБРАБОТКА ПОЛОМКИ ============
export const triggerBreakdown = (
  carId: number,
  race: CarRace,
  progress: number,
  velocity: number
): BreakdownEvent | null => {
  const breakdownType = getBreakdownType(progress, velocity);

  if (!race.breakdownHistory) {
    race.breakdownHistory = { count: 0, timestamps: [], positions: [], types: [] };
  }

  if (race.breakdownHistory.count >= BREAKDOWN_CONFIG.MAX_BREAKDOWNS) {
    return null;
  }

  const event: BreakdownEvent = {
    type: breakdownType,
    progress,
    velocity,
    timestamp: performance.now(),
  };

  race.broken = true;
  race.breakdownHistory.count++;
  race.breakdownHistory.timestamps.push(event.timestamp);
  race.breakdownHistory.positions.push(progress);
  race.breakdownHistory.types.push(breakdownType);

  return event;
};

// ============ СБРОС ПОЛОМКИ ============
export const resetBreakdown = (race: CarRace): void => {
  race.broken = false;
  race.isRepairing = false;
  race.repairStartTime = undefined;
};

// ============ УВЕДОМЛЕНИЕ ============
export const showBreakdownNotification = (carId: number, type: BreakdownType): void => {
  const app = document.querySelector("#app");
  if (!(app instanceof HTMLElement)) return;

  const message = document.createElement("div");
  message.className = "breakdown-notification";
  message.textContent = `${getBreakdownMessage(type)} (Car ${carId})`;
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

// ============ ПРОВЕРКА СОСТОЯНИЯ ============
export const isCarBroken = (carId: number): boolean => {
  const app = document.querySelector("#app");
  if (!app) return false;
  if (!(app instanceof HTMLElement)) return false;

  // Проверяем по CSS-классу
  const car = app.querySelector(`.car-road[data-id="${CSS.escape(String(carId))}"] .car`);
  if (!(car instanceof HTMLElement)) return false;
  return car.classList.contains("broken");
};
