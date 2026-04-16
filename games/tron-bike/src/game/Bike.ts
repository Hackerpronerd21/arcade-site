import { Arena } from './Arena';
import type { Direction, Team } from '../types';

export const TEAM_COLORS: Record<Team, { main: number; glow: number; hex: string }> = {
  6: { main: 0x00FFFF, glow: 0x006666, hex: '#00FFFF' },
  7: { main: 0xFF6B00, glow: 0x773300, hex: '#FF6B00' },
};

const OPPOSITE: Record<Direction, Direction> = {
  UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
};

export function dirDelta(dir: Direction): [number, number] {
  switch (dir) {
    case 'UP':    return [0, -1];
    case 'DOWN':  return [0,  1];
    case 'LEFT':  return [-1, 0];
    case 'RIGHT': return [1,  0];
  }
}

export interface SpawnConfig {
  id: string;
  x: number;
  y: number;
  dir: Direction;
  team: Team;
}

// Spawn positions for up to 3 players per team
export const SPAWNS: SpawnConfig[] = [
  // Team 6 (left side, heading right)
  { id: 't6_0', x: 8,  y: 20, dir: 'RIGHT', team: 6 },
  { id: 't6_1', x: 8,  y: 30, dir: 'RIGHT', team: 6 },
  { id: 't6_2', x: 8,  y: 40, dir: 'RIGHT', team: 6 },
  // Team 7 (right side, heading left)
  { id: 't7_0', x: 71, y: 20, dir: 'LEFT',  team: 7 },
  { id: 't7_1', x: 71, y: 30, dir: 'LEFT',  team: 7 },
  { id: 't7_2', x: 71, y: 40, dir: 'LEFT',  team: 7 },
];

export class Bike {
  id: string;
  x: number;
  y: number;
  dir: Direction;
  nextDir: Direction;
  team: Team;
  alive = true;
  dirtyTrail: Array<[number, number]> = [];

  constructor(cfg: SpawnConfig) {
    this.id = cfg.id;
    this.x = cfg.x;
    this.y = cfg.y;
    this.dir = cfg.dir;
    this.nextDir = cfg.dir;
    this.team = cfg.team;
  }

  turn(dir: Direction) {
    if (dir !== OPPOSITE[this.dir]) this.nextDir = dir;
  }

  advance(arena: Arena): boolean {
    if (!this.alive) return false;
    this.dir = this.nextDir;
    const [dx, dy] = dirDelta(this.dir);
    const nx = this.x + dx;
    const ny = this.y + dy;
    if (arena.isOccupied(nx, ny)) {
      this.alive = false;
      return false;
    }
    const trailVal = this.team === 6 ? 1 : 2;
    arena.set(this.x, this.y, trailVal);
    this.dirtyTrail.push([this.x, this.y]);
    this.x = nx;
    this.y = ny;
    return true;
  }

  clearDirty() {
    this.dirtyTrail = [];
  }
}
