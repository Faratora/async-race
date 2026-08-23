export interface Car {
    id: number;
    name: string;
    color: string;
    maxSpeed?: number;
}

export interface Winner {
    id: number;
    carId: number;
    carName: string;
    carColor: string;
    wins: number;
    bestTime: number;
}

export type EngineState = 'idle' | 'starting' | 'driving' | 'stopping';

export type ViewName = 'garage' | 'winners';

export interface SortConfig {
    sortBy: 'wins' | 'bestTime' | 'name';
    sortOrder: 'asc' | 'desc';
}

export interface GarageState {
    cars: Car[];
    page: number;
    total: number;
    selectedColor: string;
    editingCarId: number | undefined;
    editName: string;
    editColor: string;
    createCarName: string;
}

export interface WinnersState {
    winners: Winner[];
    page: number;
    total: number;
    sortBy: SortConfig['sortBy'];
    sortOrder: SortConfig['sortOrder'];
}

export interface RaceState {
    isRacing: boolean;
    carRaces: Record<number, CarRace>;
    animationId: number;
    drivingCars: Record<number, DrivingCar>;
    driveAnimationId: number;
    winnerAnnounced: boolean;
}

import type { BreakdownType } from "../config/index.ts";

export interface CarRace {
    carId: number;
    startTime: number;
    maxSpeed: number;
    finished: boolean;
    broken: boolean;
    time: number | undefined;
    breakdownHistory: {
        count: number;
        timestamps: number[];
        positions: number[];
        types: BreakdownType[];
    };
    repairStartTime?: number;
    isRepairing?: boolean;
}

export interface DrivingCar {
    startTime: number;
    maxSpeed: number;
}

export interface AppState {
    currentView: ViewName;
    garage: GarageState;
    winners: WinnersState;
    race: RaceState;
}

export interface CarFormData {
    name: string;
    color: string;
}

export interface RaceResult {
    carId: number;
    carName: string;
    carColor: string;
    time: number;
}

// ============ УТИЛИТЫ ВРЕМЕНИ ============

/**
 * Форматирует время в секундах в строку MM:SS.ms
 */
export const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
        return `${mins}:${secs.toFixed(2).padStart(5, '0')}`;
    }
    return secs.toFixed(2);
};
