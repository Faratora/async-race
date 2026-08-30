import type { CarRace } from "../types/index.ts";

// ============ КОНФИГУРАЦИЯ ПОЛОМОК ============
export const BREAKDOWN_CONFIG = {
  BASE_CHANCE: 0.001,
  DISTANCE_MULTIPLIER: 3,
  HIGH_SPEED_THRESHOLD: 250,
  HIGH_SPEED_BONUS: 0.002,
  MIN_TIME_BEFORE_BREAKDOWN: 0.5,
  MAX_BREAKDOWNS_PER_RACE: 2,
};

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

export const createEmptyBreakdownHistory = (): BreakdownHistory => ({
  count: 0,
  timestamps: [],
  positions: [],
  types: [],
});

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
  if (maxSpeed > BREAKDOWN_CONFIG.HIGH_SPEED_THRESHOLD) {
    chance += BREAKDOWN_CONFIG.HIGH_SPEED_BONUS;
  }

  return chance;
};

// ============ ТИП ПОЛОМКИ ============
export const getBreakdownType = (progress: number, maxSpeed: number): BreakdownType => {
  if (progress > 0.8) return "engine_overheating";
  if (maxSpeed > BREAKDOWN_CONFIG.HIGH_SPEED_THRESHOLD) return "transmission_failure";
  if (progress < 0.3) return "start_stall";
  return "random_breakdown";
};

// ============ ОБРАБОТКА ПОЛОМКИ ============
export const triggerBreakdown = (
  carId: number,
  race: CarRace,
  progress: number,
  maxSpeed: number,
): BreakdownEvent | undefined => {
  const breakdownType = getBreakdownType(progress, maxSpeed);

  if (!race.breakdownHistory) {
    race.breakdownHistory = createEmptyBreakdownHistory();
  }

  if (race.breakdownHistory.count >= BREAKDOWN_CONFIG.MAX_BREAKDOWNS_PER_RACE) {
    return undefined;
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