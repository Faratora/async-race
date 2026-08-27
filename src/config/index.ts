// ============ КОНФИГУРАЦИЯ ============
export const CARS_PER_PAGE = 7;
export const WINNERS_PER_PAGE = 10;

export const CONFIG = {
  // API настройки (async-race-api через Vite proxy)
  API: {
    BASE: "/api",
    ENDPOINTS: {
      GARAGE: "/garage",
      ENGINE: "/engine",
      WINNERS: "/winners",
    },
  } as const,

  // UI настройки
  UI: {
    TRACK_PADDING: 65,
    FINISH_OFFSET: 75,
    INPUT_NAME_WIDTH: 200,
    CARS_PER_PAGE,
    WINNERS_PER_PAGE,
  } as const,

  // Физика гонки
  PHYSICS: {
    TRACK_LENGTH: 2000,
    MIN_SPEED_KMH: 200,
    MAX_SPEED_KMH: 500,
    TIME_DILATION: 0.07,
  } as const,
} as const;

// ============ ОБРАТНАЯ СОВМЕСТИМОСТЬ ============
export const API_BASE = CONFIG.API.BASE;

export const TRACK_PADDING = CONFIG.UI.TRACK_PADDING;
export const FINISH_OFFSET = CONFIG.UI.FINISH_OFFSET;
export const INPUT_NAME_WIDTH = CONFIG.UI.INPUT_NAME_WIDTH;

export const TRACK_LENGTH = CONFIG.PHYSICS.TRACK_LENGTH;
export const MIN_SPEED_KMH = CONFIG.PHYSICS.MIN_SPEED_KMH;
export const MAX_SPEED_KMH = CONFIG.PHYSICS.MAX_SPEED_KMH;
export const TIME_DILATION = CONFIG.PHYSICS.TIME_DILATION;

const FALLBACK_SPEED_PROGRESS = 0.01;

// Конвертирует км/ч в прогресс трассы за миллисекунду
// Возвращает долю трассы (0..1), проходимую за 1 мс при данной скорости
export const speedToProgressPerMs = (maxSpeedKmh: number): number => {
  if (maxSpeedKmh <= 0 || !Number.isFinite(maxSpeedKmh)) {
    console.warn(`Invalid speed: ${maxSpeedKmh} km/h, using default`);
    return FALLBACK_SPEED_PROGRESS;
  }

  // км/ч → м/с (1 км/ч = 1/3.6 м/с)
  const metersPerSecond = maxSpeedKmh / 3.6;

  // м/с → м/мс
  const metersPerMillisecond = metersPerSecond / 1000;

  // м/мс → доля трассы за 1 мс
  return metersPerMillisecond / CONFIG.PHYSICS.TRACK_LENGTH;
};

export { BREAKDOWN_CONFIG } from "./breakdown.ts";

export {
  getBreakdownChance,
  getBreakdownType,
  triggerBreakdown,
  resetBreakdown,
} from "./breakdown.ts";

export type {
  BreakdownType,
  BreakdownHistory,
  BreakdownEvent,
} from "./breakdown.ts";
