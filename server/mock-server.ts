import express from "express";
import cors from "cors";

const app: express.Express = express();
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) || [];

const corsOrigin = process.env.NODE_ENV === "production"
  ? allowedOrigins.length > 0
    ? allowedOrigins
    : true
  : "http://localhost:5173";

app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));
app.use(express.json());

// ============ ИНТЕРФЕЙСЫ ============
interface Car {
  id: number;
  name: string;
  color: string;
}

interface Winner {
  id: number;
  carId: number;
  carName: string;
  carColor: string;
  wins: number;
  bestTime: number;
}

// ============ КОНСТАНТЫ ============
const CONSTANTS = {
  COLOR_MAX: 256,
  SPAM_LIMIT_START: 50,
  SPAM_LIMIT_DRIVE: 30,
  ERROR_PROBABILITY: 0.05,
  DEFAULT_CARS_LIMIT: 7,
  DEFAULT_WINNERS_LIMIT: 10,
  VELOCITY_MIN: 0.4,
  VELOCITY_MAX: 1.1,
  SERVER_PORT: 3001,
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
  private brokenCarId: number | null = null;

  // ===== CAR METHODS =====
  getCars(): Car[] {
    return Array.from(this.cars.values());
  }

  getCar(id: number): Car | undefined {
    return this.cars.get(id);
  }

  addCar(name: string, color: string): Car {
    const car: Car = { 
      id: this.carIdCounter++, 
      name: name.trim(), 
      color: color.trim() 
    };
    this.cars.set(car.id, car);
    return car;
  }

  addCars(count: number): Car[] {
    const generated: Car[] = [];
    for (let i = 0; i < count; i++) {
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
    winnerIdsToDelete.forEach(wId => this.winners.delete(wId));
    return car;
  }
  return undefined;
}

  // ===== WINNER METHODS =====
  getWinners(): Winner[] {
    return Array.from(this.winners.values());
  }

  getWinnerByCarId(carId: number): Winner | undefined {
    for (const winner of this.winners.values()) {
      if (winner.carId === carId) {
        return winner;
      }
    }
    return undefined;
  }

  addOrUpdateWinner(carId: number, carName: string, carColor: string, time: number): Winner {
    let winner = this.getWinnerByCarId(carId);
    if (winner) {
      winner.wins += 1;
      if (time < winner.bestTime) {
        winner.bestTime = time;
      }
      return winner;
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
    return newWinner;
  }

  // ===== UTILITY METHODS =====
  private randomColor(): string {
    const r = Math.floor(Math.random() * CONSTANTS.COLOR_MAX);
    const g = Math.floor(Math.random() * CONSTANTS.COLOR_MAX);
    const b = Math.floor(Math.random() * CONSTANTS.COLOR_MAX);
    return `#${[r, g, b].map(c => c.toString(16).padStart(2, "0")).join("")}`;
  }

  private randomCarName(): string {
    const first = CAR_NAMES.firstParts[Math.floor(Math.random() * CAR_NAMES.firstParts.length)];
    const second = CAR_NAMES.secondParts[Math.floor(Math.random() * CAR_NAMES.secondParts.length)];
    return `${first} ${second}`;
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

  getBrokenCarId(): number | null {
    return this.brokenCarId;
  }

  clearBrokenCar(): void {
    this.brokenCarId = null;
  }

  // ===== VALIDATION =====
  isValidCarData(body: any): body is { name: string; color: string } {
    return body && 
      typeof body.name === 'string' && 
      typeof body.color === 'string' &&
      body.name.trim().length > 0 &&
      body.color.trim().length > 0;
  }

  isValidWinnerData(body: any): body is { carId: number; carName: string; carColor: string; time: number } {
    return body &&
      typeof body.carId === 'number' &&
      typeof body.carName === 'string' &&
      typeof body.carColor === 'string' &&
      typeof body.time === 'number' &&
      body.time > 0;
  }
}

const store = new DataStore();

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============
function parsePagination(query: any): { page: number; limit: number } {
  const page = query.page ? Math.max(1, parseInt(String(query.page), 10) || 1) : 1;
  const limit = query.limit ? Math.max(1, parseInt(String(query.limit), 10) || CONSTANTS.DEFAULT_CARS_LIMIT) : CONSTANTS.DEFAULT_CARS_LIMIT;
  return { page, limit };
}

function parseId(param: any): number | null {
  const id = parseInt(String(param), 10);
  if (isNaN(id) || id <= 0) {
    return null;
  }
  return id;
}

function handleError(res: express.Response, status: number, message: string): void {
  console.error(`[ERROR] ${status}: ${message}`);
  res.status(status).json({ error: message });
}

function checkSpam(res: express.Response, limit: number): boolean {
  const count = store.incrementSpam();
  if (count % limit === 0) {
    handleError(res, CONSTANTS.HTTP_TOO_MANY_REQUESTS, "Too many requests");
    return true;
  }
  return false;
}

// ============ МАРШРУТЫ ============
// ----- CARS -----
app.get("/api/cars", (req: express.Request, res: express.Response): void => {
  try {
    const { page, limit } = parsePagination(req.query);
    const allCars = store.getCars();
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginated = allCars.slice(start, end);
    res.set("X-Total-Count", String(allCars.length));
    res.json({ cars: paginated });
  } catch (error) {
    handleError(res, CONSTANTS.HTTP_INTERNAL_SERVER_ERROR, "Failed to fetch cars");
  }
});

app.post("/api/cars", (req: express.Request, res: express.Response): void => {
  try {
    const body = req.body;
    if (!store.isValidCarData(body)) {
      handleError(res, CONSTANTS.HTTP_BAD_REQUEST, "Missing or invalid name/color");
      return;
    }
    const car = store.addCar(body.name, body.color);
    res.status(CONSTANTS.HTTP_CREATED).json(car);
  } catch (error) {
    handleError(res, CONSTANTS.HTTP_INTERNAL_SERVER_ERROR, "Failed to create car");
  }
});

app.put("/api/cars/:id", (req: express.Request, res: express.Response): void => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      handleError(res, CONSTANTS.HTTP_BAD_REQUEST, "Invalid car ID");
      return;
    }
    const body = req.body;
    if (!store.isValidCarData(body)) {
      handleError(res, CONSTANTS.HTTP_BAD_REQUEST, "Missing or invalid name/color");
      return;
    }
    const car = store.updateCar(id, body.name, body.color);
    if (!car) {
      handleError(res, CONSTANTS.HTTP_NOT_FOUND, "Car not found");
      return;
    }
    res.json(car);
  } catch (error) {
    handleError(res, CONSTANTS.HTTP_INTERNAL_SERVER_ERROR, "Failed to update car");
  }
});

app.delete("/api/cars/:id", (req: express.Request, res: express.Response): void => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      handleError(res, CONSTANTS.HTTP_BAD_REQUEST, "Invalid car ID");
      return;
    }
    const car = store.deleteCar(id);
    if (!car) {
      handleError(res, CONSTANTS.HTTP_NOT_FOUND, "Car not found");
      return;
    }
    res.json({ success: true, car });
  } catch (error) {
    handleError(res, CONSTANTS.HTTP_INTERNAL_SERVER_ERROR, "Failed to delete car");
  }
});

app.post("/api/cars/bulk", (req: express.Request, res: express.Response): void => {
  try {
    const count = typeof req.body?.count === 'number' ? req.body.count : 10;
    const safeCount = Math.min(Math.max(1, count), 100);
    const generated = store.addCars(safeCount);
    res.status(CONSTANTS.HTTP_CREATED).json(generated);
  } catch (error) {
    handleError(res, CONSTANTS.HTTP_INTERNAL_SERVER_ERROR, "Failed to generate cars");
  }
});

// ----- CAR CONTROL -----
app.post("/api/cars/:id/start", (req: express.Request, res: express.Response): void => {
  if (checkSpam(res, CONSTANTS.SPAM_LIMIT_START)) return;
  const id = parseId(req.params.id);
  if (!id || !store.getCar(id)) {
    handleError(res, CONSTANTS.HTTP_NOT_FOUND, "Car not found");
    return;
  }
  res.json({ status: "started" });
});

app.get("/api/cars/:id/velocity", (req: express.Request, res: express.Response): void => {
  const id = parseId(req.params.id);
  if (!id || !store.getCar(id)) {
    handleError(res, CONSTANTS.HTTP_NOT_FOUND, "Car not found");
    return;
  }
  // Если машина сломана — возвращаем 500
  if (store.getBrokenCarId() === id) {
    handleError(res, CONSTANTS.HTTP_INTERNAL_SERVER_ERROR, "Car broke down");
    return;
  }
  const velocity = CONSTANTS.VELOCITY_MIN + Math.random() * (CONSTANTS.VELOCITY_MAX - CONSTANTS.VELOCITY_MIN);
  res.json({ velocity: parseFloat(velocity.toFixed(2)) });
});

app.post("/api/cars/:id/drive", (req: express.Request, res: express.Response): void => {
  if (checkSpam(res, CONSTANTS.SPAM_LIMIT_DRIVE)) return;
  if (Math.random() < CONSTANTS.ERROR_PROBABILITY) {
    handleError(res, CONSTANTS.HTTP_INTERNAL_SERVER_ERROR, "Simulated server error");
    return;
  }
  const id = parseId(req.params.id);
  if (!id || !store.getCar(id)) {
    handleError(res, CONSTANTS.HTTP_NOT_FOUND, "Car not found");
    return;
  }
  res.json({ status: "driving" });
});

app.post("/api/cars/:id/stop", (req: express.Request, res: express.Response): void => {
  const id = parseId(req.params.id);
  if (!id || !store.getCar(id)) {
    handleError(res, CONSTANTS.HTTP_NOT_FOUND, "Car not found");
    return;
  }
  res.json({ status: "stopped" });
});

app.post("/api/cars/:id/repair", (req: express.Request, res: express.Response): void => {
  const id = parseId(req.params.id);
  if (!id || !store.getCar(id)) {
    handleError(res, CONSTANTS.HTTP_NOT_FOUND, "Car not found");
    return;
  }
  store.clearBrokenCar();
  res.json({ status: "repaired" });
});

// ----- RACE -----
app.post("/api/race/start", (req: express.Request, res: express.Response): void => {
  const carIds = req.body?.carIds;
  if (!Array.isArray(carIds) || carIds.length === 0) {
    handleError(res, CONSTANTS.HTTP_BAD_REQUEST, "No carIds provided");
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
  
  res.json({ status: "race_started", carCount: carIds.length });
});

app.post("/api/race/reset", (req: express.Request, res: express.Response): void => {
  const carIds = req.body?.carIds;
  if (!Array.isArray(carIds)) {
    handleError(res, CONSTANTS.HTTP_BAD_REQUEST, "Invalid carIds");
    return;
  }

  store.clearBrokenCar();
  store.resetSpam();
  console.log(`Race reset, broken car cleared, spam counter reset`);
  
  res.json({ status: "race_reset", carCount: carIds.length });
});
// ----- WINNERS -----
app.get("/api/winners", (req: express.Request, res: express.Response): void => {
  try {
    const { page, limit } = parsePagination(req.query);
    const sortBy = String(req.query.sortBy || "wins");
    const sortOrder = String(req.query.sortOrder || "desc");
    let winners = store.getWinners();
    
    // Сортировка
    winners.sort((a: Winner, b: Winner) => {
      let valA: string | number, valB: string | number;
      if (sortBy === "name") {
        valA = a.carName.toLowerCase();
        valB = b.carName.toLowerCase();
        return sortOrder === "asc" 
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      }
      valA = sortBy === "wins" ? a.wins : a.bestTime;
      valB = sortBy === "wins" ? b.wins : b.bestTime;
      return sortOrder === "asc" ? valA - valB : valB - valA;
    });
    
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginated = winners.slice(start, end);
    res.set("X-Total-Count", String(winners.length));
    res.json({ winners: paginated });
  } catch (error) {
    handleError(res, CONSTANTS.HTTP_INTERNAL_SERVER_ERROR, "Failed to fetch winners");
  }
});

app.post("/api/winners", (req: express.Request, res: express.Response): void => {
  try {
    const body = req.body;
    if (!store.isValidWinnerData(body)) {
      handleError(res, CONSTANTS.HTTP_BAD_REQUEST, "Invalid winner data");
      return;
    }
    const winner = store.addOrUpdateWinner(
      body.carId,
      body.carName,
      body.carColor,
      body.time
    );
    res.json(winner);
  } catch (error) {
    handleError(res, CONSTANTS.HTTP_INTERNAL_SERVER_ERROR, "Failed to save winner");
  }
});

// ----- HEALTH CHECK -----
app.get("/api/health", (req: express.Request, res: express.Response): void => {
  res.json({
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