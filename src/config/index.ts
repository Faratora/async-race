// ============ КОНФИГУРАЦИЯ ============
export const CONFIG = {
  // API настройки
  API: {
    BASE: "/api",
    ENDPOINTS: {
      CARS: "/cars",
      WINNERS: "/winners",
      RACE: "/race",
      HEALTH: "/health",
    },
  } as const,

  // UI настройки
  UI: {
    TRACK_PADDING: 65,
    FINISH_OFFSET: 75,
    INPUT_NAME_WIDTH: 200,
    DEFAULT_COLOR: "#ff0000",
    CARS_PER_PAGE: 7,
    WINNERS_PER_PAGE: 10,
  } as const,

  // Физика гонки
  PHYSICS: {
    TRACK_LENGTH: 400,
    MIN_SPEED_KMH: 150,
    MAX_SPEED_KMH: 350,
    TIME_DILATION: 1.1,
  } as const,
} as const;

// ============ ОБРАТНАЯ СОВМЕСТИМОСТЬ ============
export const {
  CARS_PER_PAGE,
  WINNERS_PER_PAGE,
} = {
  CARS_PER_PAGE: CONFIG.UI.CARS_PER_PAGE,
  WINNERS_PER_PAGE: CONFIG.UI.WINNERS_PER_PAGE,
};

export const API_BASE = CONFIG.API.BASE;

export const { TRACK_PADDING, FINISH_OFFSET, INPUT_NAME_WIDTH, DEFAULT_COLOR } = {
  TRACK_PADDING: CONFIG.UI.TRACK_PADDING,
  FINISH_OFFSET: CONFIG.UI.FINISH_OFFSET,
  INPUT_NAME_WIDTH: CONFIG.UI.INPUT_NAME_WIDTH,
  DEFAULT_COLOR: CONFIG.UI.DEFAULT_COLOR,
};

export const { TRACK_LENGTH, MIN_SPEED_KMH, MAX_SPEED_KMH, TIME_DILATION } = {
  TRACK_LENGTH: CONFIG.PHYSICS.TRACK_LENGTH,
  MIN_SPEED_KMH: CONFIG.PHYSICS.MIN_SPEED_KMH,
  MAX_SPEED_KMH: CONFIG.PHYSICS.MAX_SPEED_KMH,
  TIME_DILATION: CONFIG.PHYSICS.TIME_DILATION,
};

// Конвертирует км/ч в прогресс трассы за миллисекунду
// Возвращает долю трассы (0..1), проходимую за 1 мс при данной скорости
export const speedToProgressPerMs = (maxSpeedKmh: number): number => {
  if (maxSpeedKmh <= 0 || !Number.isFinite(maxSpeedKmh)) {
    console.warn(`Invalid speed: ${maxSpeedKmh} km/h, using default`);
    return 0.01;
  }

  // км/ч → м/с (1 км/ч = 1/3.6 м/с)
  const metersPerSecond = maxSpeedKmh / 3.6;

  // м/с → м/мс
  const metersPerMillisecond = metersPerSecond / 1000;

  // м/мс → доля трассы за 1 мс
  return metersPerMillisecond / CONFIG.PHYSICS.TRACK_LENGTH;
};

export const BREAKDOWN_CONFIG = {
  // Базовая вероятность поломки за 1 мс (0.01%)
  BASE_CHANCE: 0.0001,
  // Множитель вероятности в зависимости от пройденного расстояния
  // При 100% дистанции: chance * (1 + DISTANCE_MULTIPLIER)
  DISTANCE_MULTIPLIER: 1,
  // Порог высокой скорости (км/ч), выше которой увеличивается шанс поломки
  HIGH_SPEED_THRESHOLD: 250,
  // Дополнительная вероятность при высокой скорости
  HIGH_SPEED_BONUS: 0.0004,
  // Минимальное время после старта до первой поломки (сек)
  MIN_TIME_BEFORE_BREAKDOWN: 0.5,
  // Вероятность ремонта за кадр (0.5% при 60fps = ~30% в секунду)
  REPAIR_CHANCE_PER_FRAME: 0.005,
  // Время ремонта (сек)
  REPAIR_TIME: 2,
  // Максимальное количество поломок
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
