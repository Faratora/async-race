import type { CarRace } from "../types/index.ts";

// ============ КОНФИГУРАЦИЯ ПОЛОМОК ============
// Поломка теперь определяется статусом 500 от /engine?status=drive, а не вероятностью.
export const BREAKDOWN_CONFIG = {} as const;

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

export const createEmptyBreakdownHistory = (): BreakdownHistory => ({
  count: 0,
  timestamps: [],
  positions: [],
  types: [],
});

export const createCarRace = (
  carId: number,
  options: { startTime: number; maxSpeed: number; finished?: boolean; broken?: boolean; time?: number | undefined },
): CarRace => ({
  carId,
  startTime: options.startTime,
  maxSpeed: options.maxSpeed,
  finished: options.finished ?? false,
  broken: options.broken ?? false,
  time: options.time,
  breakdownHistory: createEmptyBreakdownHistory(),
  repairStartTime: undefined,
  isRepairing: false,
});

// ============ РАСЧЁТ ШАНСА ПОЛОМКИ ============
// Функция getBreakdownChance удалена: поломка теперь определяется
// статусом 500 от /engine?status=drive (см. startRaceDriveRequests).