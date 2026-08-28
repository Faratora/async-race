const jsonServer = require('json-server');

const db = {
    garage: [
        {
            "name": "Tesla",
            "color": "#e6e6fa",
            "id": 1,
        },
        {
            "name": "BMW",
            "color": "#fede00",
            "id": 2,
        },
        {
            "name": "Mersedes",
            "color": "#6c779f",
            "id": 3,
        },
        {
            "name": "Ford",
            "color": "#ef3c40",
            "id": 4,
        },
    ],
    winners: [
        {
            id: 1,
            wins: 1,
            time: 10,
        }
    ]
};

const server = jsonServer.create();
const router = jsonServer.router(db);
const middlewares = jsonServer.defaults();

const PORT = process.env.PORT || 3000;

const state = { velocity: {}, blocked: {} };

server.use(middlewares);

// ============ AGGREGATE WINNERS BY CAR ID ============
server.post('/winners', (req, res) => {
    const { id, time, carName, carColor } = req.body;
    if (id == null) {
        return res.status(400).send('Missing "id" in request body');
    }

    const existing = db.winners.find(w => w.id === id);
    if (existing) {
        existing.wins += 1;
        if (time != null && (existing.time == null || time < existing.time)) {
            existing.time = time;
        }
        if (carName) existing.carName = carName;
        if (carColor) existing.carColor = carColor;
        return res.status(200).json(existing);
    }

    const newWinner = {
        id,
        wins: 1,
        time: time ?? null,
        carName: carName ?? null,
        carColor: carColor ?? null,
    };
    db.winners.push(newWinner);
    return res.status(201).json(newWinner);
});

const STATUS = {
    STARTED: 'started',
    STOPPED: 'stopped',
    DRIVE: 'drive',
};

server.patch('/engine', (req, res) => {
    const { id, status } = req.query;

    if (!id || Number.isNaN(+id) || +id <= 0) {
        return res.status(400).send('Required parameter "id" is missing. Should be a positive number');
    }

    if (!status || !/^(started)|(stopped)|(drive)$/.test(status)) {
        return res.status(400).send(`Wrong parameter "status". Expected: "started", "stopped" or "drive". Received: "${status}"`);
    }

    if (!db.garage.find(car => car.id === +id)) {
        return res.status(404).send('Car with such id was not found in the garage.')
    }

    const distance = 500000;

    if (status === STATUS.DRIVE) {
        if (state.blocked[id]) {
            return res.status(429).send('Drive already in progress. You can\'t run drive for the same car twice while it\'s not stopped.');
        }
        
        const velocity = state.velocity[id];

        if (!velocity) {
            return res.status(404).send('Engine parameters for car with such id was not found in the garage. Have you tried to set engine status to "started" before?');
        }

        
        state.blocked[id] = true;

        const x = Math.round(distance / velocity);

        delete state.velocity[id];        

        if (new Date().getMilliseconds() % 3 === 0) {
            setTimeout(() => {                
                delete state.blocked[id];
                res.header('Content-Type', 'application/json').status(500).send('Car has been stopped suddenly. It\'s engine was broken down.');
            }, Math.random() * x ^ 0);
        } else {
            setTimeout(() => {                
                delete state.blocked[id];
                res.header('Content-Type', 'application/json').status(200).send(JSON.stringify({ success: true }));
            }, x);
        }
    } else {
        const x = req.query.speed ? +req.query.speed : Math.random() * 2000 ^ 0;

        const velocity = status === STATUS.STARTED ? Math.max(50, Math.random() * 200 ^ 0) : 0;

        if (velocity) {
            state.velocity[id] = velocity;
        } else {
            delete state.velocity[id];
            delete state.blocked[id];
        }

        setTimeout(() => res.header('Content-Type', 'application/json').status(200).send(JSON.stringify({ velocity, distance })), x);
    }
});

server.use(router);
server.listen(PORT, () => {
    console.log('Server is running on port', PORT);
});
