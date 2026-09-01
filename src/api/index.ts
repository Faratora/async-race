import { CONFIG } from "../config/index.ts";
import type { Car, Winner } from "../types/index.ts";

// ============ КОНСТАНТЫ ============
const REQUEST_TIMEOUT = 3000;
const RETRY_COUNT = 3;
const RETRY_DELAY = 500;
const HEX_COLOR_LENGTH = 6;
const HEX_ALPHABET_SIZE = 16;
const GENERATE_BATCH_SIZE = 10;
const HTTP_STATUS_TOO_MANY_REQUESTS = 429;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

const randomCarColor = (): string => {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let index = 0; index < HEX_COLOR_LENGTH; index++) {
    color += letters[Math.floor(Math.random() * HEX_ALPHABET_SIZE)];
  }
  return color;
};

const CAR_NAME_FIRST_PARTS = [
  "Tesla", "Ford", "BMW", "Audi", "Porsche",
  "Lamborghini", "Ferrari", "McLaren", "Chevrolet", "Dodge",
  "Nissan", "Toyota", "Honda", "Mercedes", "Volkswagen",
  "Jaguar", "Bentley", "Maserati", "Alfa Romeo", "Volvo",
] as const;

const CAR_NAME_SECOND_PARTS = [
  "Model S", "Mustang", "M3", "RS6", "911",
  "Huracan", "F8", "720S", "Camaro", "Challenger",
  "GT-R", "Supra", "Civic", "AMG", "Golf",
  "F-Type", "Continental", "Ghibli", "Giulia", "XC90",
] as const;

const randomCarName = (): string => {
  const first = CAR_NAME_FIRST_PARTS[Math.floor(Math.random() * CAR_NAME_FIRST_PARTS.length)];
  const second = CAR_NAME_SECOND_PARTS[Math.floor(Math.random() * CAR_NAME_SECOND_PARTS.length)];
  return `${first} ${second}`;
};

// ============ ОБЩАЯ ЛОГИКА ОБРАБОТКИ ОТВЕТОВ ============
const handleResponseError = async (response: Response): Promise<never> => {
  let errorText: string;
  try {
    errorText = await response.text();
  } catch {
    errorText = "Unable to read error response";
  }
  const status = response.status;
  const statusText = response.statusText.trim() || "unknown";
  throw new Error(`HTTP ${status} ${statusText}: ${errorText}`);
};

async function processResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    await handleResponseError(response);
  }
  const text: string = await response.text();
  if (!text) {
    throw new Error("Empty response body");
  }
  return JSON.parse(text);
}

async function handleVoidResponse(response: Response): Promise<void> {
  if (response.ok) return;
  await handleResponseError(response);
}

// ============ FETCH С ТАЙМАУТОМ ============
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // Дополнительная проверка: если response.ok === false и статус некорректен — выводим диагностическую информацию
    if (!response.ok && (response.status === undefined || response.status === 0)) {
      console.error(`[fetchWithTimeout] Non-OK response with invalid status for ${url}:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        type: response.type,
        url: response.url,
      });
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request to ${url} timed out after ${REQUEST_TIMEOUT}ms`);
    }
    throw error;
  }
}

async function fetchWithRetry<T>(
  url: string,
  options: RequestInit = {},
  retries = RETRY_COUNT,
  delay = RETRY_DELAY,
): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response: Response = await fetchWithTimeout(url, options);
      if (shouldRetry(response, attempt, retries)) {
        await new Promise((resolve) => setTimeout(resolve, delay * 2 ** attempt));
        continue;
      }
      return await processResponse<T>(response);
    } catch (error) {
      if (attempt === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay * 2 ** attempt));
    }
  }
  throw new Error("Retry limit exceeded");
}

const shouldRetry = (
  response: Response,
  attempt: number,
  retries: number,
): boolean => {
  // Не повторяем 429 (Too Many Requests) — это защитный код сервера
  if (response.status === HTTP_STATUS_TOO_MANY_REQUESTS) {
    return false;
  }
  return response.status === HTTP_STATUS_INTERNAL_SERVER_ERROR && attempt < retries - 1;
};

// ============ УТИЛИТЫ ПАГИНАЦИИ ============

const extractTotalCount = (response: Response, itemsLength: number): number => {
  const totalHeader = response.headers.get("X-Total-Count");
  return totalHeader === null ? itemsLength : Number(totalHeader);
};

// ============ GARAGE ============

export async function fetchCars(
  page: number,
  limit: number,
): Promise<{ cars: Car[]; total: number }> {
  const response: Response = await fetchWithTimeout(
    `${CONFIG.API.BASE}/garage?_page=${page}&_limit=${limit}`,
  );
  const cars: Car[] = await processResponse<Car[]>(response);
  const total = extractTotalCount(response, cars.length);
  return { cars, total };
}

export async function createCar(data: {
  name: string;
  color: string;
}): Promise<Car> {
  const response: Response = await fetchWithTimeout(`${CONFIG.API.BASE}/garage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return processResponse<Car>(response);
}

export async function updateCar(
  id: number,
  data: { name: string; color: string },
): Promise<Car> {
  const response: Response = await fetchWithTimeout(`${CONFIG.API.BASE}/garage/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return processResponse<Car>(response);
}

export async function deleteCar(id: number): Promise<void> {
  await deleteResource("garage", id);
}

export async function deleteWinner(id: number): Promise<void> {
  await deleteResource("winners", id);
}

async function deleteResource(resource: string, id: number): Promise<void> {
  const response: Response = await fetchWithTimeout(`${CONFIG.API.BASE}/${resource}/${id}`, {
    method: "DELETE",
  });
  await handleVoidResponse(response);
}

export async function generateCars(count: number): Promise<Car[]> {
  const generated: Car[] = [];
  const batchSize = GENERATE_BATCH_SIZE;
  for (let index = 0; index < count; index += batchSize) {
    const batch = Array.from({ length: Math.min(batchSize, count - index) }, (_, _index) => ({
      name: randomCarName(),
      color: randomCarColor(),
    }));
    const results = await Promise.allSettled(
      batch.map((data) => createCar(data)),
    );
    for (const result of results) {
      if (result.status === "fulfilled") {
        generated.push(result.value);
      }
    }
  }
  return generated;
}

// ============ ENGINE ============

const fetchEngineState = (carId: number): Promise<{ velocity: number; distance: number }> =>
  fetchWithRetry<{ velocity: number; distance: number }>(`${CONFIG.API.BASE}/engine?id=${carId}&status=started`, {
    method: "PATCH",
  });

export async function startEngine(carId: number): Promise<{ velocity: number; distance: number }> {
  return fetchEngineState(carId);
}

export async function stopEngine(carId: number): Promise<{ velocity: number; distance: number }> {
  const response: Response = await fetchWithTimeout(`${CONFIG.API.BASE}/engine?id=${carId}&status=stopped`, {
    method: "PATCH",
  });
  return processResponse<{ velocity: number; distance: number }>(response);
}

export async function driveCar(carId: number): Promise<void> {
  const response: Response = await fetchWithTimeout(`${CONFIG.API.BASE}/engine?id=${carId}&status=drive`, {
    method: "PATCH",
  });
  if (response.ok) return;
  if (response.status === 500) {
    throw new Error("Drive failed with 500");
  }
}

// ============ WINNERS ============

// Блокировка для предотвращения дублирования запросов на запись победителей
const winnerRecordLock = new Map<number, boolean>();

export interface ApiWinner {
  id: number;
  wins: number;
  time: number | null;
  carName?: string;
  carColor?: string;
}

export async function fetchWinners(
  page: number,
  limit: number,
  sortBy: string,
  sortOrder: string,
): Promise<{ winners: ApiWinner[]; total: number }> {
  const response: Response = await fetchWithTimeout(
    `${CONFIG.API.BASE}/winners?_page=${page}&_limit=${limit}&_sort=${sortBy}&_order=${sortOrder}`,
  );
  const winners: ApiWinner[] = await processResponse<ApiWinner[]>(response);
  const total = extractTotalCount(response, winners.length);
  return { winners, total };
}

export async function recordWinner(data: {
  carId: number;
  carName: string;
  carColor: string;
  time: number | null | undefined;
}): Promise<Winner> {
  // Защита от повторной записи для того же carId
  if (winnerRecordLock.get(data.carId)) {
    console.warn(`[recordWinner] Already recording winner for car ${data.carId}, skipping`);
    // Пытаемся получить существующего победителя
    try {
      const response: Response = await fetchWithTimeout(`${CONFIG.API.BASE}/winners/${data.carId}`, {
        method: "GET",
      });
      const existing = await processResponse<{ id: number; wins: number; time: number | null; carName?: string; carColor?: string }>(response);
      return { ...existing, carId: data.carId, carName: data.carName, carColor: data.carColor, bestTime: existing.time ?? null };
    } catch {
      return { id: data.carId, carId: data.carId, carName: data.carName, carColor: data.carColor, wins: 0, bestTime: null };
    }
  }
  winnerRecordLock.set(data.carId, true);

  try {
    let existingWinner: { id: number; wins: number; time: number | null; carName?: string; carColor?: string } | null = null;
    try {
      const checkResponse: Response = await fetchWithTimeout(`${CONFIG.API.BASE}/winners/${data.carId}`, {
        method: "GET",
      });
      if (checkResponse.ok) {
        const text = await checkResponse.text();
        if (text) {
          existingWinner = JSON.parse(text) as { id: number; wins: number; time: number | null; carName?: string; carColor?: string };
        }
      } else if (checkResponse.status !== 404) {
        await handleResponseError(checkResponse);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        existingWinner = null;
      } else {
        throw error;
      }
    }

    if (existingWinner) {
      const updatedWins = existingWinner.wins + 1;
      const updatedTime = data.time != null && (existingWinner.time == null || data.time < existingWinner.time)
        ? data.time
        : existingWinner.time;

      const response: Response = await fetchWithTimeout(`${CONFIG.API.BASE}/winners/${data.carId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: data.carId,
          wins: updatedWins,
          time: updatedTime,
          carName: data.carName,
          carColor: data.carColor,
        }),
      });
      const winner = await processResponse<Winner>(response);
      return { ...winner, carId: data.carId, carName: data.carName, carColor: data.carColor, bestTime: updatedTime ?? null };
    } else {
      const response: Response = await fetchWithTimeout(`${CONFIG.API.BASE}/winners`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: data.carId, wins: 1, time: data.time, carName: data.carName, carColor: data.carColor }),
      });
      const winner = await processResponse<Winner>(response);
      return { ...winner, carId: data.carId, carName: data.carName, carColor: data.carColor, bestTime: data.time ?? null };
    }
  } finally {
    // Разблокируем после завершения
    winnerRecordLock.delete(data.carId);
  }
}
