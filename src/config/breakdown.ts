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
  maxSpeed: number;
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
  maxSpeed: number,
  elapsed: number
): number => {
  if (elapsed < BREAKDOWN_CONFIG.MIN_TIME_BEFORE_BREAKDOWN) return 0;

  let chance = BREAKDOWN_CONFIG.BASE_CHANCE;
  chance *= (1 + progress * BREAKDOWN_CONFIG.DISTANCE_MULTIPLIER);

  // Высокая скорость (>250 км/ч) увеличивает шанс поломки
  if (maxSpeed > 250) {
    chance += BREAKDOWN_CONFIG.HIGH_SPEED_BONUS;
  }

  return chance;
};

// ============ ТИП ПОЛОМКИ ============
export const getBreakdownType = (progress: number, maxSpeed: number): BreakdownType => {
  if (progress > 0.8) return "engine_overheating";
  if (maxSpeed > 250) return "transmission_failure";
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
  maxSpeed: number
): BreakdownEvent | null => {
  const breakdownType = getBreakdownType(progress, maxSpeed);

  if (!race.breakdownHistory) {
    race.breakdownHistory = { count: 0, timestamps: [], positions: [], types: [] };
  }

  if (race.breakdownHistory.count >= BREAKDOWN_CONFIG.MAX_BREAKDOWNS) {
    return null;
  }

  const event: BreakdownEvent = {
    type: breakdownType,
    progress,
    maxSpeed,
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