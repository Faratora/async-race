import { API_BASE, Car, Winner } from "../types/index.ts";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorText: string = await response.clone().text();
    throw new Error(
      `HTTP ${response.status} ${response.statusText}: ${errorText}`,
    );
  }
  const text: string = await response.text();
  if (!text) {
    throw new Error("Empty response body");
  }
  return JSON.parse(text);
}

async function handleVoidResponse(response: Response): Promise<void> {
  if (response.ok) return;
  const errorText: string = await response.clone().text();
  throw new Error(
    `HTTP ${response.status} ${response.statusText}: ${errorText}`,
  );
}

async function fetchWithRetry<T>(
  url: string,
  options: RequestInit = {},
  retries = 3,
  delay = 500,
): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response: Response = await fetch(url, options);
      const shouldRetry = (response.status === 429 || response.status === 500) && attempt < retries - 1;
      if (shouldRetry) {
        await new Promise((resolve) => setTimeout(resolve, delay * 2 ** attempt));
        continue;
      }
      if (!response.ok) {
        const errorText: string = await response.clone().text();
        throw new Error(
          `HTTP ${response.status} ${response.statusText}: ${errorText}`,
        );
      }
      const text: string = await response.text();
      if (!text) {
        throw new Error("Empty response body");
      }
      return JSON.parse(text);
    } catch (error) {
      if (attempt === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay * 2 ** attempt));
    }
  }
  throw new Error("Retry limit exceeded");
}

export async function fetchCars(
  page: number,
  limit: number,
): Promise<{ cars: Car[]; total: number }> {
  const response: Response = await fetch(
    `${API_BASE}/cars?page=${page}&limit=${limit}`,
  );
  return handleResponse<{ cars: Car[]; total: number }>(response);
}

export async function createCar(data: {
  name: string;
  color: string;
}): Promise<Car> {
  const response: Response = await fetch(`${API_BASE}/cars`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<Car>(response);
}

export async function updateCar(
  id: number,
  data: { name: string; color: string },
): Promise<Car> {
  const response: Response = await fetch(`${API_BASE}/cars/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<Car>(response);
}

export async function deleteCar(id: number): Promise<void> {
  const response: Response = await fetch(`${API_BASE}/cars/${id}`, {
    method: "DELETE",
  });
  console.log("[api] deleteCar response status=", response.status);
  await handleResponse<void>(response);
}

export async function generateCars(count: number): Promise<Car[]> {
  const response: Response = await fetch(`${API_BASE}/cars/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count }),
  });
  return handleResponse<Car[]>(response);
}

export async function startEngine(carId: number): Promise<void> {
  await fetchWithRetry<void>(`${API_BASE}/cars/${carId}/start`, {
    method: "POST",
  });
}

export async function stopEngine(carId: number): Promise<void> {
  const response: Response = await fetch(`${API_BASE}/cars/${carId}/stop`, {
    method: "POST",
  });
  await handleVoidResponse(response);
}

export async function getVelocity(carId: number): Promise<number> {
  const response: Response = await fetch(`${API_BASE}/cars/${carId}/velocity`);
  const data: { velocity: number } =
    await handleResponse<{ velocity: number }>(response);
  return data.velocity;
}

export async function driveCar(carId: number): Promise<void> {
  await fetchWithRetry<void>(`${API_BASE}/cars/${carId}/drive`, {
    method: "POST",
  });
}

export async function startRace(carIds: number[]): Promise<void> {
  await fetchWithRetry<void>(`${API_BASE}/race/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ carIds }),
  });
}

export async function resetRace(carIds: number[]): Promise<void> {
  await fetchWithRetry<void>(`${API_BASE}/race/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ carIds }),
  });
}

export async function fetchWinners(
  page: number,
  limit: number,
  sortBy: string,
  sortOrder: string,
): Promise<{ winners: Winner[]; total: number }> {
  const response: Response = await fetch(
    `${API_BASE}/winners?page=${page}&limit=${limit}&sortBy=${sortBy}&sortOrder=${sortOrder}`,
  );
  return handleResponse<{ winners: Winner[]; total: number }>(response);
}

export async function recordWinner(data: {
  carId: number;
  carName: string;
  carColor: string;
  time: number;
}): Promise<Winner> {
  const response: Response = await fetch(`${API_BASE}/winners`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<Winner>(response);
}
