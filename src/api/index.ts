import { CONFIG } from "../config/index.ts";
import type { Car, Winner } from "../types/index.ts";

// ============ КОНСТАНТЫ ============
const REQUEST_TIMEOUT = 3000;
const RETRY_COUNT = 3;
const RETRY_DELAY = 500;

export const CAR_COLORS = [
  "#ff0000", "#ff8800", "#ffcc00", "#00cc00", "#0088cc",
  "#0000ff", "#8800cc", "#ff00ff", "#ff4444", "#44ff44",
  "#4444ff", "#ff88cc", "#00cccc", "#cc8800", "#888888",
  "#ffffff", "#cc0000", "#006600", "#003366", "#ff4444",
] as const;

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

const randomCarColor = (): string => {
  return CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
};

// ============ ОБЩАЯ ЛОГИКА ОБРАБОТКИ ОТВЕТОВ ============
const handleResponseError = async (response: Response): Promise<never> => {
  let errorText: string;
  try {
    errorText = await response.text();
  } catch {
    errorText = "Unable to read error response";
  }
  const status = response.status ?? "unknown";
  const statusText = response.statusText ?? "unknown";
  throw new Error(`HTTP ${status} ${statusText}: ${errorText}`);
};

async function processResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    await handleResponseError(response);
  }
  const text: string = await response.text();
  if (!text) {
    return undefined as unknown as T;
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
  return (response.status === 429 || response.status === 500) && attempt < retries - 1;
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
  const totalHeader: string | null = response.headers.get("X-Total-Count");
  const total: number = totalHeader === null ? cars.length : Number(totalHeader);
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
  const response: Response = await fetchWithTimeout(`${CONFIG.API.BASE}/garage/${id}`, {
    method: "DELETE",
  });
  await handleVoidResponse(response);
}

export async function generateCars(count: number): Promise<Car[]> {
  const generated: Car[] = [];
  const batchSize = 10;
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

export async function startEngine(carId: number): Promise<{ velocity: number; distance: number }> {
  return fetchWithRetry<{ velocity: number; distance: number }>(`${CONFIG.API.BASE}/engine?id=${carId}&status=started`, {
    method: "PATCH",
  });
}

export async function stopEngine(carId: number): Promise<{ velocity: number; distance: number }> {
  const response: Response = await fetchWithTimeout(`${CONFIG.API.BASE}/engine?id=${carId}&status=stopped`, {
    method: "PATCH",
  });
  return processResponse<{ velocity: number; distance: number }>(response);
}

export async function repairCar(carId: number): Promise<{ velocity: number; distance: number }> {
  // async-race-api не поддерживает ремонт; имитируем перезапуск двигателя
  return startEngine(carId);
}

export async function getVelocity(carId: number): Promise<number> {
  const data: { velocity: number; distance: number } =
    await fetchWithRetry<{ velocity: number; distance: number }>(`${CONFIG.API.BASE}/engine?id=${carId}&status=started`, {
      method: "PATCH",
    });
  return data.velocity;
}

export async function driveCar(carId: number): Promise<void> {
  console.log("[driveCar] called for car", carId);
  try {
    const response: Response = await fetchWithTimeout(`${CONFIG.API.BASE}/engine?id=${carId}&status=drive`, {
      method: "PATCH",
    });
    console.log("[driveCar] response for car", carId, "status:", response.status, "ok:", response.ok);
    if (response.ok) return;
    if (response.status === 500) {
      throw new Error("Drive failed with 500");
    }
    // 429 и другие ошибки — не блокируем анимацию
  } catch (error: unknown) {
    console.log("[driveCar] error for car", carId, "error:", error);
    // Если это не 500 — игнорируем
    if (error instanceof Error && error.message.includes("500")) {
      throw error;
    }
  }
}

// ============ WINNERS ============

interface ApiWinner {
  id: number;
  wins: number;
  time: number;
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
  const totalHeader: string | null = response.headers.get("X-Total-Count");
  const total: number = totalHeader === null ? winners.length : Number(totalHeader);
  return { winners, total };
}

export async function recordWinner(data: {
  carId: number;
  carName: string;
  carColor: string;
  time: number;
}): Promise<Winner> {
  try {
    const response: Response = await fetchWithTimeout(`${CONFIG.API.BASE}/winners`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: data.carId, wins: 1, time: data.time, carName: data.carName, carColor: data.carColor }),
    });
    const winner = await processResponse<Winner>(response);
    return { ...winner, carId: data.carId, carName: data.carName, carColor: data.carColor, bestTime: data.time };
  } catch {
    // duplicate id — машина уже в таблице, нужно инкрементировать wins и обновить bestTime
    const response: Response = await fetchWithTimeout(`${CONFIG.API.BASE}/winners/${data.carId}`, {
      method: "GET",
    });
    const existing = await processResponse<{ id: number; wins: number; time: number; carName?: string; carColor?: string }>(response);

    const newWins = existing.wins + 1;
    const newBestTime = Math.min(existing.time, data.time);

    const updateResponse: Response = await fetchWithTimeout(`${CONFIG.API.BASE}/winners/${data.carId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: data.carId, wins: newWins, time: newBestTime, carName: data.carName, carColor: data.carColor }),
    });
    const winner = await processResponse<Winner>(updateResponse);
    return { ...winner, carId: data.carId, carName: data.carName, carColor: data.carColor, bestTime: newBestTime };
  }
}
