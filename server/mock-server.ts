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
  carId: number;
  carName: string;
  carColor: string;
  wins: number;
  bestTime: number;
}

let cars: Car[] = [];
let winners: Winner[] = [];
let nextCarId: number = 1;

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

function randomColor(): string {
  const r: number = Math.floor(Math.random() * 256);
  const g: number = Math.floor(Math.random() * 256);
  const b: number = Math.floor(Math.random() * 256);
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
  const limit: number = req.query.limit ? parseInt(String(req.query.limit), 10) || 7 : 7;
  const start: number = (page - 1) * limit;
  const end: number = start + limit;
  const paginated: Car[] = cars.slice(start, end);
  res.json({ cars: paginated, total: cars.length });
});

app.post("/api/cars", (req: express.Request, res: express.Response): void => {
  try {
    const body: { name?: string; color?: string } = req.body || {};
    if (!body.name || !body.color) {
      res.status(400).json({ error: "Missing name or color" });
      return;
    }
    const car: Car = { id: nextCarId++, name: body.name, color: body.color };
    cars.push(car);
    res.status(201).json(car);
  } catch (err: unknown) {
    console.error("Error creating car:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/api/cars/:id", (req: express.Request, res: express.Response): void => {
  const id: number = parseInt(String(req.params.id), 10);
  const body: { name: string; color: string } = req.body;
  const car: Car | undefined = cars.find((c: Car): boolean => c.id === id);
  if (car === undefined) {
    res.status(404).json({ error: "Car not found" });
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
    res.status(404).json({ error: "Car not found" });
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
  res.status(201).json(generated);
});

app.post("/api/cars/:id/start", (req: express.Request, res: express.Response): void => {
  spamCounter++;
  if (spamCounter % 50 === 0) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }
  const id: number = parseInt(String(req.params.id), 10);
  const car: Car | undefined = cars.find((c: Car): boolean => c.id === id);
  if (car === undefined) {
    res.status(404).json({ error: "Car not found" });
    return;
  }
  res.json({ status: "started" });
});

app.get("/api/cars/:id/velocity", (req: express.Request, res: express.Response): void => {
  const id: number = parseInt(String(req.params.id), 10);
  const car: Car | undefined = cars.find((c: Car): boolean => c.id === id);
  if (car === undefined) {
    res.status(404).json({ error: "Car not found" });
    return;
  }
  const velocity: number = 2 + Math.random() * 8;
  res.json({ velocity });
});

app.post("/api/cars/:id/drive", (req: express.Request, res: express.Response): void => {
  spamCounter++;
  if (spamCounter % 30 === 0) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }
  if (Math.random() < 0.05) {
    res.status(500).json({ error: "Internal server error" });
    return;
  }
  const id: number = parseInt(String(req.params.id), 10);
  const car: Car | undefined = cars.find((c: Car): boolean => c.id === id);
  if (car === undefined) {
    res.status(404).json({ error: "Car not found" });
    return;
  }
  res.json({ status: "driving" });
});

app.post("/api/cars/:id/stop", (req: express.Request, res: express.Response): void => {
  const id: number = parseInt(String(req.params.id), 10);
  const car: Car | undefined = cars.find((c: Car): boolean => c.id === id);
  if (car === undefined) {
    res.status(404).json({ error: "Car not found" });
    return;
  }
  res.json({ status: "stopped" });
});

app.post("/api/race/start", (req: express.Request, res: express.Response): void => {
  const body: { carIds?: number[] } = req.body;
  if (!body.carIds || body.carIds.length === 0) {
    res.status(400).json({ error: "No carIds provided" });
    return;
  }
  res.json({ status: "race_started", carCount: body.carIds.length });
});

app.post("/api/race/reset", (req: express.Request, res: express.Response): void => {
  const body: { carIds?: number[] } = req.body;
  if (!body.carIds) {
    res.status(400).json({ error: "No carIds provided" });
    return;
  }
  res.json({ status: "race_reset", carCount: body.carIds.length });
});

app.get("/api/winners", (req: express.Request, res: express.Response): void => {
  const page: number = req.query.page ? parseInt(String(req.query.page), 10) || 1 : 1;
  const limit: number = req.query.limit ? parseInt(String(req.query.limit), 10) || 10 : 10;
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
  res.json({ winners: paginated, total: sorted.length });
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
  const winner: Winner = { carId: body.carId, carName: body.carName, carColor: body.carColor, wins: 1, bestTime: body.time };
  winners.push(winner);
  res.status(201).json(winner);
});

const PORT: number = 3001;
app.listen(PORT, "127.0.0.1", (): void => {
  console.log("Mock server running on port " + PORT);
});
