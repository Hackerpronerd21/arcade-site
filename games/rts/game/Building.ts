import type { BuildingConfig, BuildingState, OwnerType, ProductionItem } from '../types/index.js';
import { ALL_BUILDINGS, calcProductionTime } from '../config/index.js';

let nextBuildingId = 1;

export class Building {
  readonly id: string;
  readonly config: BuildingConfig;

  x: number; // center x
  y: number; // center y
  hp: number;
  owner: OwnerType;
  state: BuildingState = 'idle';
  isDead: boolean = false;

  // Production queue (max 5 slots)
  productionQueue: ProductionItem[] = [];
  readonly MAX_QUEUE = 5;

  // Extraction: reference to which resource node this sits on
  extractionNodeId: string | null = null;
  extractionWorkerCount: number = 0;

  // Tower targeting
  towerCooldown: number = 0;
  towerTargetId: string | null = null;

  // Construction state
  constructionProgress: number = 0;  // 0–1; only meaningful when state === 'under_construction'
  builderUnitId: string | null = null;

  // Flash on hit
  flashTimer: number = 0;
  deathTimer: number = 0;

  constructor(key: string, x: number, y: number, owner: OwnerType) {
    this.id = `building_${nextBuildingId++}`;
    const cfg = ALL_BUILDINGS[key];
    if (!cfg) throw new Error(`Unknown building key: ${key}`);
    this.config = cfg;
    this.x = x;
    this.y = y;
    this.hp = cfg.maxHp;
    this.owner = owner;
  }

  get isAlive(): boolean { return !this.isDead; }

  get left(): number   { return this.x - this.config.width  / 2; }
  get right(): number  { return this.x + this.config.width  / 2; }
  get top(): number    { return this.y - this.config.height / 2; }
  get bottom(): number { return this.y + this.config.height / 2; }

  canQueueUnit(unitKey: string): boolean {
    return (
      this.config.produces.includes(unitKey) &&
      this.productionQueue.length < this.MAX_QUEUE
    );
  }

  queueUnit(unitKey: string): boolean {
    if (!this.canQueueUnit(unitKey)) return false;
    const totalTime = calcProductionTime(0, 0); // placeholder; caller calculates
    this.productionQueue.push({ unitKey, progress: 0, totalTime });
    return true;
  }

  queueUnitWithTime(unitKey: string, totalTime: number): boolean {
    if (!this.canQueueUnit(unitKey)) return false;
    this.productionQueue.push({ unitKey, progress: 0, totalTime });
    return true;
  }

  cancelLastQueued(): void {
    this.productionQueue.pop();
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
    this.flashTimer = 0.15;
    if (this.hp === 0) {
      this.isDead = true;
      this.deathTimer = 1.0;
    }
  }

  distanceTo(x: number, y: number): number {
    const dx = this.x - x;
    const dy = this.y - y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

export function createBuilding(key: string, x: number, y: number, owner: OwnerType): Building {
  return new Building(key, x, y, owner);
}
