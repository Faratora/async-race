import express from "express";
import cors from "cors";

const app: express.Express = express();
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) || [];

const corsOrigin = process.env.NODE_ENV === "production"
  ? (allowedOrigins.length > 0
    ? allowedOrigins
    : true)
  : "http://localhost:5173";

app.use(cors({
  origin: corsOrigin as boolean | string | (string | RegExp)[],
  credentials: true,
}));
app.use(express.json());

// ============ ИНТЕРФЕЙСЫ ============
interface Car {
  id: number;
  name: string;
  color: string;
  maxSpeed: number;
}

interface Winner {
  id: number;
  carId: number;
  carName: string;
  carColor: string;
  wins: number;
  bestTime: number;
}

// ============ ПАЛИТРА ЦВЕТОВ ============
const CAR_COLORS = [
  "#ff0000", // красный
  "#ff8800", // оранжевый
  "#ffcc00", // жёлтый
  "#00cc00", // зелёный
  "#0088cc", // голубой
  "#0000ff", // синий
  "#8800cc", // фиолетовый
  "#ff00ff", // розовый
  "#ff4444", // светло-красный
  "#44ff44", // светло-зелёный
  "#4444ff", // светло-синий
  "#ff88cc", // светло-розовый
  "#00cccc", // бирюзовый
  "#cc8800", // янтарный
  "#888888", // серый
  "#ffffff", // белый
  "#cc0000", // бордовый
  "#006600", // тёмно-зелёный
  "#003366", // тёмно-синий
] as const;

// ============ КОНСТАНТЫ ============
const CONSTANTS = {
  SPAM_LIMIT_START: 50,
  SPAM_LIMIT_DRIVE: 30,
  ERROR_PROBABILITY: 0.05,
  DEFAULT_CARS_LIMIT: 7,
  DEFAULT_WINNERS_LIMIT: 10,
  MIN_SPEED_KMH: 150,
  MAX_SPEED_KMH: 350,
  HIGH_SPEED_THRESHOLD: 250,
  SERVER_PORT: 3000,
  SERVER_HOST: "127.0.0.1",
  // HTTP статусы
  HTTP_OK: 200,
  HTTP_CREATED: 201,
  HTTP_BAD_REQUEST: 400,
  HTTP_NOT_FOUND: 404,
  HTTP_TOO_MANY_REQUESTS: 429,
  HTTP_INTERNAL_SERVER_ERROR: 500,
} as const;

const CAR_NAMES = {
  firstParts: ["Tesla", "Ford", "BMW", "Audi", "Porsche", "Lamborghini", 
  "Ferrari", "McLaren", "Chevrolet", "Dodge", "Nissan", "Toyota", 
  "Honda", "Mercedes", "Volkswagen", "Jaguar", "Bentley", "Maserati", 
  "Alfa Romeo", "Volvo"],
  secondParts: ["Model S", "Mustang", "M3", "RS6", "911", "Huracan", 
  "F8", "720S", "Camaro", "Challenger", "GT-R", "Supra", "Civic", 
  "AMG", "Golf", "F-Type", "Continental", "Ghibli", "Giulia", "XC90"]
} as const;

// ============ ХРАНИЛИЩЕ ДАННЫХ ============
// Используем Map для O(1) доступа
class DataStore {
  private cars = new Map<number, Car>();
  private winners = new Map<number, Winner>();
  private carIdCounter = 1;
  private winnerIdCounter = 1;
  private spamCounter = 0;
  private brokenCarId: number | undefined = undefined;
  private winnerLocks = new Map<number, Promise<void>>();
  private lastColor: string | undefined = undefined;

  // ===== UTILITY METHODS =====
  private randomColor(): string {
    let color: string;
    // Повторяем, пока не найдём цвет, отличный от предыдущего
    do {
      const index = Math.floor(Math.random() * CAR_COLORS.length);
      color = CAR_COLORS[index];
    } while (color === this.lastColor);
    
    this.lastColor = color;
    return color;
  }

  private randomCarName(): string {
    const first = CAR_NAMES.firstParts[Math.floor(Math.random() * CAR_NAMES.firstParts.length)];
    const second = CAR_NAMES.secondParts[Math.floor(Math.random() * CAR_NAMES.secondParts.length)];
    return first + ' ' + second;
  }

  // ===== CAR METHODS =====
  getCars(): Car[] {
    return this.cars.values().toArray();
  }

  getCar(id: number): Car | undefined {
    return this.cars.get(id);
  }

  addCar(name: string, color: string): Car {
    const maxSpeed = CONSTANTS.MIN_SPEED_KMH + 
      Math.floor(Math.random() * (CONSTANTS.MAX_SPEED_KMH - CONSTANTS.MIN_SPEED_KMH + 1));
    const car: Car = { 
      id: this.carIdCounter++, 
      name: name.trim(), 
      color: color.trim(),
      maxSpeed,
    };
    this.cars.set(car.id, car);
    return car;
  }

  addCars(count: number): Car[] {
    const generated: Car[] = [];
    for (let index = 0; index < count; index++) {
      generated.push(this.addCar(
        this.randomCarName(),
        this.randomColor()
      ));
    }
    return generated;
  }

  updateCar(id: number, name: string, color: string): Car | undefined {
    const car = this.cars.get(id);
    if (car) {
      car.name = name.trim();
      car.color = color.trim();
      return car;
    }
    return undefined;
  }

  deleteCar(id: number): Car | undefined {
  const car = this.cars.get(id);
  if (car) {
    this.cars.delete(id);
    // Безопасное удаление
    const winnerIdsToDelete: number[] = [];
    for (const [winnerId, winner] of this.winners) {
      if (winner.carId === id) {
        winnerIdsToDelete.push(winnerId);
      }
    }
    for (const wId of winnerIdsToDelete) this.winners.delete(wId);
    return car;
  }
  return undefined;
}

  // ===== WINNER METHODS =====
  getWinners(): Winner[] {
    return this.winners.values().toArray();
  }

  getWinnerByCarId(carId: number): Winner | undefined {
    for (const winner of this.winners.values()) {
      if (winner.carId === carId) {
        return winner;
      }
    }
    return undefined;
  }

  async addOrUpdateWinner(carId: number, carName: string, carColor: string, time: number): Promise<Winner> {
    const existingLock = this.winnerLocks.get(carId);
    if (existingLock) {
      await existingLock;
    }

    const lockPromise = (async (): Promise<void> => {
      try {
        let winner = this.getWinnerByCarId(carId);
        if (winner) {
          winner.wins += 1;
          if (time < winner.bestTime) {
            winner.bestTime = time;
          }
          return;
        }

        const newWinner: Winner = {
          id: this.winnerIdCounter++,
          carId,
          carName: carName.trim(),
          carColor: carColor.trim(),
          wins: 1,
          bestTime: time,
        };
        this.winners.set(newWinner.id, newWinner);
      } finally {
        this.winnerLocks.delete(carId);
      }
    })();

    this.winnerLocks.set(carId, lockPromise);
    await lockPromise;

    return this.getWinnerByCarId(carId) ?? (() => { throw new Error("Winner not found after creation"); })();
  }

  // ===== SPAM CONTROL =====
  incrementSpam(): number {
    return ++this.spamCounter;
  }

  resetSpam(): void {
    this.spamCounter = 0;
  }

  // ===== BROKEN CAR =====
  setBrokenCarId(carId: number): void {
    this.brokenCarId = carId;
  }

  getBrokenCarId(): number | undefined {
    return this.brokenCarId;
  }

  clearBrokenCar(): void {
    this.brokenCarId = undefined;
  }

  // ===== VALIDATION =====
  isValidCarData(body: unknown): body is { name: string; color: string } {
    return typeof body === 'object' && body !== null &&
      typeof (body as { name: unknown }).name === 'string' && 
      typeof (body as { color: unknown }).color === 'string' &&
      (body as { name: string }).name.trim().length > 0 &&
      (body as { color: string }).color.trim().length > 0;
  }

  isValidWinnerData(body: unknown): body is { carId: number; carName: string; carColor: string; time: number } {
    return typeof body === 'object' && body !== null &&
      typeof (body as { carId: unknown }).carId === 'number' &&
      typeof (body as { carName: unknown }).carName === 'string' &&
      typeof (body as { carColor: unknown }).carColor === 'string' &&
      typeof (body as { time: unknown }).time === 'number' &&
      (body as { time: number }).time > 0;
  }
}

const store = new DataStore();

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============
function parsePagination(query: Record<string, unknown>): { page: number; limit: number } {
  const page = query.page ? Math.max(1, Number(query.page) || 1) : 1;
  const limit = query.limit ? Math.max(1, Number(query.limit) || CONSTANTS.DEFAULT_CARS_LIMIT) : CONSTANTS.DEFAULT_CARS_LIMIT;
  return { page, limit };
}

function parseId(parameter: unknown): number | undefined {
  const id = Number(parameter);
  if (Number.isNaN(id) || id <= 0) {
    return undefined;
  }
  return id;
}

function handleError(response: express.Response, status: number, message: string): void {
  console.error(`[ERROR] ${status}: ${message}`);
  response.status(status).json({ error: message });
}

function isSpamCheck(response: express.Response, limit: number): boolean {
  const count = store.incrementSpam();
  if (count % limit === 0) {
    handleError(response, CONSTANTS.HTTP_TOO_MANY_REQUESTS, "Too many requests");
    return true;
  }
  return false;
}

// === УНИВЕРСАЛЬНЫЕ УТИЛИТЫ ===
const paginate = <T>(items: T[], page: number, limit: number): { paginated: T[]; total: number } => {
  const start = (page - 1) * limit;
  const end = start + limit;
  return { paginated: items.slice(start, end), total: items.length };
};

const requireId = (request: express.Request, response: express.Response, notFoundMessage: string): number | undefined => {
  const id = parseId(request.params.id);
  if (!id) {
    handleError(response, CONSTANTS.HTTP_BAD_REQUEST, "Invalid ID");
    return undefined;
  }
  if (!store.getCar(id)) {
    handleError(response, CONSTANTS.HTTP_NOT_FOUND, notFoundMessage);
    return undefined;
  }
  return id;
};

const execute = async (function_: () => Promise<void>, response: express.Response, errorMessage: string): Promise<void> => {
  try {
    await function_();
  } catch {
    handleError(response, CONSTANTS.HTTP_INTERNAL_SERVER_ERROR, errorMessage);
  }
};

// ============ МАРШРУТЫ ============
// ----- CARS -----
app.get("/api/cars", (request: express.Request, response: express.Response): void => {
  try {
    const { page, limit } = parsePagination(request.query);
    const { paginated, total } = paginate(store.getCars(), page, limit);
    response.set("X-Total-Count", String(total));
    response.json({ cars: paginated });
  } catch {
    handleError(response, CONSTANTS.HTTP_INTERNAL_SERVER_ERROR, "Failed to fetch cars");
  }
});

app.post("/api/cars", (request: express.Request, response: express.Response): void => {
  try {
    const body = request.body;
    if (!store.isValidCarData(body)) {
      handleError(response, CONSTANTS.HTTP_BAD_REQUEST, "Missing or invalid name/color");
      return;
    }
    const car = store.addCar(body.name, body.color);
    response.status(CONSTANTS.HTTP_CREATED).json(car);
  } catch {
    handleError(response, CONSTANTS.HTTP_INTERNAL_SERVER_ERROR, "Failed to create car");
  }
});

app.put("/api/cars/:id", async (request: express.Request, response: express.Response): Promise<void> => {
  const id = requireId(request, response, "Car not found");
  if (!id) return;

  await execute(async () => {
    const body = request.body;
    if (!store.isValidCarData(body)) {
      handleError(response, CONSTANTS.HTTP_BAD_REQUEST, "Missing or invalid name/color");
      return;
    }
    const car = store.updateCar(id, body.name, body.color);
    if (!car) {
      handleError(response, CONSTANTS.HTTP_NOT_FOUND, "Car not found");
      return;
    }
    response.json(car);
  }, response, "Failed to update car");
});

app.delete("/api/cars/:id", async (request: express.Request, response: express.Response): Promise<void> => {
  const id = requireId(request, response, "Car not found");
  if (!id) return;

  await execute(async () => {
    const car = store.deleteCar(id);
    if (!car) {
      handleError(response, CONSTANTS.HTTP_NOT_FOUND, "Car not found");
      return;
    }
    response.json({ success: true, car });
  }, response, "Failed to delete car");
});

app.post("/api/cars/bulk", (request: express.Request, response: express.Response): void => {
  try {
    const count = typeof request.body?.count === 'number' ? request.body.count : 10;
    const safeCount = Math.min(Math.max(1, count), 100);
    const generated = store.addCars(safeCount);
    response.status(CONSTANTS.HTTP_CREATED).json(generated);
  } catch {
    handleError(response, CONSTANTS.HTTP_INTERNAL_SERVER_ERROR, "Failed to generate cars");
  }
});

// ----- CAR CONTROL -----
app.post("/api/cars/:id/start", (request: express.Request, response: express.Response): void => {
  if (isSpamCheck(response, CONSTANTS.SPAM_LIMIT_START)) return;
  const id = requireId(request, response, "Car not found");
  if (!id) return;
  response.json({ status: "started" });
});

app.get("/api/cars/:id/velocity", (request: express.Request, response: express.Response): void => {
  const id = requireId(request, response, "Car not found");
  if (!id) return;

  // Если машина сломана — возвращаем 500
  if (store.getBrokenCarId() === id) {
    handleError(response, CONSTANTS.HTTP_INTERNAL_SERVER_ERROR, "Car broke down");
    return;
  }
  const car = store.getCar(id);
  response.json({ maxSpeed: car!.maxSpeed });
});

app.post("/api/cars/:id/drive", async (request: express.Request, response: express.Response): Promise<void> => {
  if (isSpamCheck(response, CONSTANTS.SPAM_LIMIT_DRIVE)) return;
  if (Math.random() < CONSTANTS.ERROR_PROBABILITY) {
    handleError(response, CONSTANTS.HTTP_INTERNAL_SERVER_ERROR, "Simulated server error");
    return;
  }
  const id = requireId(request, response, "Car not found");
  if (!id) return;

  await execute(async () => {
    response.json({ status: "driving" });
  }, response, "Failed to drive car");
});

app.post("/api/cars/:id/stop", async (request: express.Request, response: express.Response): Promise<void> => {
  const id = requireId(request, response, "Car not found");
  if (!id) return;

  await execute(async () => {
    response.json({ status: "stopped" });
  }, response, "Failed to stop car");
});

app.post("/api/cars/:id/repair", async (request: express.Request, response: express.Response): Promise<void> => {
  const id = requireId(request, response, "Car not found");
  if (!id) return;

  await execute(async () => {
    store.clearBrokenCar();
    response.json({ status: "repaired" });
  }, response, "Failed to repair car");
});

// ----- RACE -----
app.post("/api/race/start", (request: express.Request, response: express.Response): void => {
  const carIds = request.body?.carIds;
  if (!Array.isArray(carIds) || carIds.length === 0) {
    handleError(response, CONSTANTS.HTTP_BAD_REQUEST, "No carIds provided");
    return;
  }
  
  // Сбрасываем предыдущую поломку
  store.clearBrokenCar();
  
  // Случайно выбираем одну машину для поломки (20% шанс)
  if (Math.random() < 0.2 && carIds.length > 0) {
    const randomIndex = Math.floor(Math.random() * carIds.length);
    const brokenCarId = carIds[randomIndex];
    store.setBrokenCarId(brokenCarId);
    console.log(`Car ${brokenCarId} selected to break down during race`);
  }
  
  response.json({ status: "race_started", carCount: carIds.length });
});

app.post("/api/race/reset", (request: express.Request, response: express.Response): void => {
  const carIds = request.body?.carIds;
  if (!Array.isArray(carIds)) {
    handleError(response, CONSTANTS.HTTP_BAD_REQUEST, "Invalid carIds");
    return;
  }

  store.clearBrokenCar();
  store.resetSpam();
  console.log(`Race reset, broken car cleared, spam counter reset`);
  
  response.json({ status: "race_reset", carCount: carIds.length });
});
// ----- WINNERS -----
app.get("/api/winners", (request: express.Request, response: express.Response): void => {
  try {
    const { page, limit } = parsePagination(request.query);
    const sortBy = String(request.query.sortBy || "wins");
    const sortOrder = String(request.query.sortOrder || "desc");
    let winners = store.getWinners();
    
    winners.sort((a: Winner, b: Winner) => {
      let valueA: string | number, valueB: string | number;
      if (sortBy === "name") {
        valueA = a.carName.toLowerCase();
        valueB = b.carName.toLowerCase();
        return sortOrder === "asc" 
          ? String(valueA).localeCompare(String(valueB))
          : String(valueB).localeCompare(String(valueA));
      }
      valueA = sortBy === "wins" ? a.wins : a.bestTime;
      valueB = sortBy === "wins" ? b.wins : b.bestTime;
      return sortOrder === "asc" ? valueA - valueB : valueB - valueA;
    });
    
    const { paginated, total } = paginate(winners, page, limit);
    response.set("X-Total-Count", String(total));
    response.json({ winners: paginated });
  } catch {
    handleError(response, CONSTANTS.HTTP_INTERNAL_SERVER_ERROR, "Failed to fetch winners");
  }
});

app.post("/api/winners", async (request: express.Request, response: express.Response): Promise<void> => {
  try {
    const body = request.body;
    if (!store.isValidWinnerData(body)) {
      handleError(response, CONSTANTS.HTTP_BAD_REQUEST, "Invalid winner data");
      return;
    }
    const winner = await store.addOrUpdateWinner(
      body.carId,
      body.carName,
      body.carColor,
      body.time
    );
    response.json(winner);
  } catch {
    handleError(response, CONSTANTS.HTTP_INTERNAL_SERVER_ERROR, "Failed to save winner");
  }
});

// ----- HEALTH CHECK -----
app.get("/api/health", (request: express.Request, response: express.Response): void => {
  response.json({
    status: "ok",
    cars: store.getCars().length,
    winners: store.getWinners().length,
    timestamp: new Date().toISOString()
  });
});

// ============ ЗАПУСК СЕРВЕРА ============
const server = app.listen(CONSTANTS.SERVER_PORT, CONSTANTS.SERVER_HOST, () => {
  console.log(`Server running at http://${CONSTANTS.SERVER_HOST}:${CONSTANTS.SERVER_PORT}`);
  console.log(`Health check: http://${CONSTANTS.SERVER_HOST}:${CONSTANTS.SERVER_PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});