import { CONFIG } from "../config/index.ts";
import type { Car, Winner } from "../types/index.ts";

// ============ РљРћРќРЎРўРђРќРўР« ============
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

// ============ РћР‘Р©РђРЇ Р›РћР“РРљРђ РћР‘Р РђР‘РћРўРљР РћРўР’Р•РўРћР’ ============
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

// ============ FETCH РЎ РўРђР™РњРђРЈРўРћРњ ============
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

    // Р”РѕРїРѕР»РЅРёС‚РµР»СЊРЅР°СЏ РїСЂРѕРІРµСЂРєР°: РµСЃР»Рё response.ok === false Рё СЃС‚Р°С‚СѓСЃ РЅРµРєРѕСЂСЂРµРєС‚РµРЅ вЂ” РІС‹РІРѕРґРёРј РґРёР°РіРЅРѕСЃС‚РёС‡РµСЃРєСѓСЋ РёРЅС„РѕСЂРјР°С†РёСЋ
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
  // РќРµ РїРѕРІС‚РѕСЂСЏРµРј 429 (Too Many Requests) вЂ” СЌС‚Рѕ Р·Р°С‰РёС‚РЅС‹Р№ РєРѕРґ СЃРµСЂРІРµСЂР°
  if (response.status === HTTP_STATUS_TOO_MANY_REQUESTS) {
    return false;
  }
  return response.status === HTTP_STATUS_INTERNAL_SERVER_ERROR && attempt < retries - 1;
};

// ============ РЈРўРР›РРўР« РџРђР“РРќРђР¦РР ============

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

// Р‘Р»РѕРєРёСЂРѕРІРєР° РґР»СЏ РїСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёСЏ РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ Р·Р°РїСЂРѕСЃРѕРІ РЅР° Р·Р°РїРёСЃСЊ РїРѕР±РµРґРёС‚РµР»РµР№
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

interface ApiWinnerResponse {
  id: number;
  wins: number;
  time: number | null;
  carName?: string;
  carColor?: string;
}

async function fetchExistingWinner(carId: number): Promise<ApiWinnerResponse | null> {
  try {
    const checkResponse: Response = await fetchWithTimeout(
      `${CONFIG.API.BASE}/winners/${carId}`,
      { method: "GET" },
    );
    if (checkResponse.ok) {
      const text = await checkResponse.text();
      if (text) {
        const parsed = JSON.parse(text) satisfies ApiWinnerResponse;
        return parsed;
      }
    } else if (checkResponse.status !== 404) {
      await handleResponseError(checkResponse);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) {
      return null;
    }
    throw error;
  }
  return null;
}

async function updateExistingWinner(
  data: {
    carId: number;
    carName: string;
    carColor: string;
    time: number | null | undefined;
  },
  existing: ApiWinnerResponse,
): Promise<Winner> {
  const updatedWins = existing.wins + 1;
  const updatedTime =
    data.time != null && (existing.time == null || data.time < existing.time)
      ? data.time
      : existing.time;

  const response: Response = await fetchWithTimeout(
    `${CONFIG.API.BASE}/winners/${data.carId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: data.carId,
        wins: updatedWins,
        time: updatedTime,
        carName: data.carName,
        carColor: data.carColor,
      }),
    },
  );
  const winner = await processResponse<Winner>(response);
  return {
    ...winner,
    carId: data.carId,
    carName: data.carName,
    carColor: data.carColor,
    bestTime: updatedTime ?? null,
  };
}

async function createNewWinner(
  data: {
    carId: number;
    carName: string;
    carColor: string;
    time: number | null | undefined;
  },
): Promise<Winner> {
  const response: Response = await fetchWithTimeout(
    `${CONFIG.API.BASE}/winners`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: data.carId,
        wins: 1,
        time: data.time,
        carName: data.carName,
        carColor: data.carColor,
      }),
    },
  );
  const winner = await processResponse<Winner>(response);
  return {
    ...winner,
    carId: data.carId,
    carName: data.carName,
    carColor: data.carColor,
    bestTime: data.time ?? null,
  };
}

async function handleDuplicateRecord(
  carId: number,
  carName: string,
  carColor: string,
): Promise<Winner> {
  console.warn(`[recordWinner] Already recording winner for car ${carId}, skipping`);
  try {
    const response: Response = await fetchWithTimeout(
      `${CONFIG.API.BASE}/winners/${carId}`,
      { method: "GET" },
    );
    const existing = await processResponse<ApiWinnerResponse>(response);
    return {
      ...existing,
      carId,
      carName,
      carColor,
      bestTime: existing.time ?? null,
    };
  } catch {
    return {
      id: carId,
      carId,
      carName,
      carColor,
      wins: 0,
      bestTime: null,
    };
  }
}

export async function recordWinner(
  data: {
    carId: number;
    carName: string;
    carColor: string;
    time: number | null | undefined;
  },
): Promise<Winner> {
  if (winnerRecordLock.get(data.carId)) {
    return handleDuplicateRecord(data.carId, data.carName, data.carColor);
  }

  winnerRecordLock.set(data.carId, true);

  try {
    const existingWinner = await fetchExistingWinner(data.carId);
    if (existingWinner) {
      return updateExistingWinner(data, existingWinner);
    }
    return createNewWinner(data);
  } finally {
    winnerRecordLock.delete(data.carId);
  }
}
