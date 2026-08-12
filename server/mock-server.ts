import express from "express";
import cors from "cors";

const app: express.Application = express();
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());

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

let cars: Car[] = [];
let winners: Winner[] = [];
let nextCarId: number = 1;
let nextWinnerId: number = 1;

const firstParts: string[] = [
  "Tesla", "Ford", "BMW", "Audi", "Porsche",
  "Lamborghini", "Ferrari", "McLaren", "Chevrolet", "Dodge",
  "Nissan", "Toyota", "Honda", "Mercedes", "Volkswagen",
  "Jaguar", "Bentley", "Maserati", "Alfa Romeo", "Volvo",
];

const secondParts: string[] = [
  "Model S", "Mustang", "M3", "RS6", "911",
  "Huracan", "F8", "720S", "Camaro", "Challenger",
  "GT-R", "Supra", "Civic", "AMG", "Golf",
  "F-Type", "Continental", "Ghibli", "Giulia", "XC90",
];

const COLOR_MAX = 256;
const SPAM_LIMIT_START = 50;
const SPAM_LIMIT_DRIVE = 30;
const ERROR_PROBABILITY = 0.05;
const DEFAULT_CARS_LIMIT = 7;
const DEFAULT_WINNERS_LIMIT = 10;
const VELOCITY_MIN = 0.5;
const VELOCITY_MAX = 2.0;
const SERVER_PORT = 3001;
const SERVER_HOST = "127.0.0.1";
const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_INTERNAL_SERVER_ERROR = 500;

function randomColor(): string {
  const r: number = Math.floor(Math.random() * COLOR_MAX);
  const g: number = Math.floor(Math.random() * COLOR_MAX);
  const b: number = Math.floor(Math.random() * COLOR_MAX);
  return "#" + [r, g, b].map((c: number): string => c.toString(16).padStart(2, "0")).join("");
}

function randomCarName(): string {
  const first: string = firstParts[Math.floor(Math.random() * firstParts.length)];
  const second: string = secondParts[Math.floor(Math.random() * secondParts.length)];
  return first + " " + second;
}

let spamCounter: number = 0;

app.get("/api/cars", (req: express.Request, res: express.Response): void => {
  const page: number = req.query.page ? parseInt(String(req.query.page), 10) || 1 : 1;
  const limit: number = req.query.limit ? parseInt(String(req.query.limit), 10) || DEFAULT_CARS_LIMIT : DEFAULT_CARS_LIMIT;
  const start: number = (page - 1) * limit;
  const end: number = start + limit;
  const paginated: Car[] = cars.slice(start, end);
  res.set("X-Total-Count", String(cars.length));
  res.json({ cars: paginated });
});

app.post("/api/cars", (req: express.Request, res: express.Response): void => {
  try {
    const body: { name?: string; color?: string } = req.body || {};
    if (!body.name || !body.color) {
      res.status(HTTP_BAD_REQUEST).json({ error: "Missing name or color" });
      return;
    }
    const car: Car = { id: nextCarId++, name: body.name, color: body.color };
    cars.push(car);
    res.status(HTTP_CREATED).json(car);
  } catch (err: unknown) {
    console.error("Error creating car:", err);
    res.status(HTTP_INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
  }
});

app.put("/api/cars/:id", (req: express.Request, res: express.Response): void => {
  const id: number = parseInt(String(req.params.id), 10);
  const body: { name: string; color: string } = req.body;
  const car: Car | undefined = cars.find((c: Car): boolean => c.id === id);
  if (car === undefined) {
    res.status(HTTP_NOT_FOUND).json({ error: "Car not found" });
    return;
  }
  car.name = body.name;
  car.color = body.color;
  res.json(car);
});

app.delete("/api/cars/:id", (req: express.Request, res: express.Response): void => {
  const id: number = parseInt(String(req.params.id), 10);
  const carIndex: number = cars.findIndex((c: Car): boolean => c.id === id);
  if (carIndex === -1) {
    res.status(HTTP_NOT_FOUND).json({ error: "Car not found" });
    return;
  }
  const [removed] = cars.splice(carIndex, 1);
  winners = winners.filter((w: Winner): boolean => w.carId !== id);
  res.json({ success: true, car: removed });
});

app.post("/api/cars/bulk", (req: express.Request, res: express.Response): void => {
  const body: { count: number } = req.body;
  const generated: Car[] = [];
  for (let i: number = 0; i < body.count; i++) {
    generated.push({
      id: nextCarId++,
      name: randomCarName(),
      color: randomColor(),
    });
  }
  cars.push(...generated);
  res.status(HTTP_CREATED).json(generated);
});

app.post("/api/cars/:id/start", (req: express.Request, res: express.Response): void => {
  spamCounter++;
  if (spamCounter % SPAM_LIMIT_START === 0) {
    res.status(HTTP_TOO_MANY_REQUESTS).json({ error: "Too many requests" });
    return;
  }
  const id: number = parseInt(String(req.params.id), 10);
  const car: Car | undefined = cars.find((c: Car): boolean => c.id === id);
  if (car === undefined) {
    res.status(HTTP_NOT_FOUND).json({ error: "Car not found" });
    return;
  }
  res.json({ status: "started" });
});

app.get("/api/cars/:id/velocity", (req: express.Request, res: express.Response): void => {
  const id: number = parseInt(String(req.params.id), 10);
  const car: Car | undefined = cars.find((c: Car): boolean => c.id === id);
  if (car === undefined) {
    res.status(HTTP_NOT_FOUND).json({ error: "Car not found" });
    return;
  }
  const velocity: number = VELOCITY_MIN + Math.random() * (VELOCITY_MAX - VELOCITY_MIN);
  res.json({ velocity });
});

app.post("/api/cars/:id/drive", (req: express.Request, res: express.Response): void => {
  spamCounter++;
  if (spamCounter % SPAM_LIMIT_DRIVE === 0) {
    res.status(HTTP_TOO_MANY_REQUESTS).json({ error: "Too many requests" });
    return;
  }
  if (Math.random() < ERROR_PROBABILITY) {
    res.status(HTTP_INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
    return;
  }
  const id: number = parseInt(String(req.params.id), 10);
  const car: Car | undefined = cars.find((c: Car): boolean => c.id === id);
  if (car === undefined) {
    res.status(HTTP_NOT_FOUND).json({ error: "Car not found" });
    return;
  }
  res.json({ status: "driving" });
});

app.post("/api/cars/:id/stop", (req: express.Request, res: express.Response): void => {
  const id: number = parseInt(String(req.params.id), 10);
  const car: Car | undefined = cars.find((c: Car): boolean => c.id === id);
  if (car === undefined) {
    res.status(HTTP_NOT_FOUND).json({ error: "Car not found" });
    return;
  }
  res.json({ status: "stopped" });
});

app.post("/api/race/start", (req: express.Request, res: express.Response): void => {
  const body: { carIds?: number[] } = req.body;
  if (!body.carIds || body.carIds.length === 0) {
    res.status(HTTP_BAD_REQUEST).json({ error: "No carIds provided" });
    return;
  }
  res.json({ status: "race_started", carCount: body.carIds.length });
});

app.post("/api/race/reset", (req: express.Request, res: express.Response): void => {
  const body: { carIds?: number[] } = req.body;
  if (!body.carIds) {
    res.status(HTTP_BAD_REQUEST).json({ error: "No carIds provided" });
    return;
  }
  res.json({ status: "race_reset", carCount: body.carIds.length });
});

app.get("/api/winners", (req: express.Request, res: express.Response): void => {
  const page: number = req.query.page ? parseInt(String(req.query.page), 10) || 1 : 1;
  const limit: number = req.query.limit ? parseInt(String(req.query.limit), 10) || DEFAULT_WINNERS_LIMIT : DEFAULT_WINNERS_LIMIT;
  const sortBy: string = req.query.sortBy ? String(req.query.sortBy) : "wins";
  const sortOrder: string = req.query.sortOrder ? String(req.query.sortOrder) : "desc";
  const sorted: Winner[] = [...winners].sort((a: Winner, b: Winner): number => {
    const valA: number = sortBy === "wins" ? a.wins : a.bestTime;
    const valB: number = sortBy === "wins" ? b.wins : b.bestTime;
    if (sortOrder === "asc") {
      return valA - valB;
    }
    return valB - valA;
  });
  const start: number = (page - 1) * limit;
  const end: number = start + limit;
  const paginated: Winner[] = sorted.slice(start, end);
  res.set("X-Total-Count", String(sorted.length));
  res.json({ winners: paginated });
});

app.post("/api/winners", (req: express.Request, res: express.Response): void => {
  const body: { carId: number; carName: string; carColor: string; time: number } = req.body;
  const existing: Winner | undefined = winners.find((w: Winner): boolean => w.carId === body.carId);
  if (existing !== undefined) {
    existing.wins += 1;
    if (body.time < existing.bestTime) {
      existing.bestTime = body.time;
    }
    res.json(existing);
    return;
  }
  const winner: Winner = { id: nextWinnerId++, carId: body.carId, carName: body.carName, carColor: body.carColor, wins: 1, bestTime: body.time };
  winners.push(winner);
  res.status(HTTP_CREATED).json(winner);
});

app.listen(SERVER_PORT, SERVER_HOST, (): void => {
  console.log("Mock server running on port " + SERVER_PORT);
});
