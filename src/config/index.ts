export const CARS_PER_PAGE = 7;
export const WINNERS_PER_PAGE = 10;
export const API_BASE = "/api";
export const TRACK_PADDING = 65;
export const FINISH_OFFSET = 75;

// Длина трассы в метрах
export const TRACK_LENGTH = 400;

// Коэффициент замедления анимации
// TIME_DILATION = 1 → гонка идёт в реальном времени
// TIME_DILATION > 1 → гонка медленнее (1.1 → в 1.1 раза медленнее)
export const TIME_DILATION = 1.1;

export const INPUT_NAME_WIDTH = 200;
export const DEFAULT_COLOR = "#ff0000";

// Диапазон максимальной скорости машин (км/ч)
export const MIN_SPEED_KMH = 150;
export const MAX_SPEED_KMH = 350;

// Конвертирует км/ч в прогресс трассы за миллисекунду
// Возвращает долю трассы (0..1), проходимую за 1 мс при данной скорости
export const speedToProgressPerMs = (maxSpeedKmh: number): number => {
  if (maxSpeedKmh <= 0 || !isFinite(maxSpeedKmh)) {
    console.warn(`Invalid speed: ${maxSpeedKmh} km/h, using default`);
    return 0.01;
  }

  // км/ч → м/с (1 км/ч = 1/3.6 м/с)
  const metersPerSecond = maxSpeedKmh / 3.6;

  // м/с → м/мс
  const metersPerMillisecond = metersPerSecond / 1000;

  // м/мс → доля трассы за 1 мс
  return metersPerMillisecond / TRACK_LENGTH;
};

export const BREAKDOWN_CONFIG = {
  BASE_CHANCE: 0.0001,
  DISTANCE_MULTIPLIER: 1,
  HIGH_SPEED_BONUS: 0.0004,
  MIN_TIME_BEFORE_BREAKDOWN: 0.5,
  REPAIR_CHANCE_PER_FRAME: 0.005,
  REPAIR_TIME: 2,
  MAX_BREAKDOWNS: 2,
};

export {
  getBreakdownChance,
  getBreakdownType,
  getBreakdownMessage,
  triggerBreakdown,
  resetBreakdown,
} from "./breakdown.ts";

export type {
  BreakdownType,
  BreakdownHistory,
  BreakdownEvent,
} from "./breakdown.ts";

export {
  createBreakdownMessage,
  showBreakdownNotification,
  showWinnerNotification,
} from "../ui/notifications.ts";
