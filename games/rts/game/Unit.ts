import type { UnitConfig, UnitState, OwnerType, StatusEffect, StatusEffectType, Vec2 } from '../types/index.js';
import { ALL_UNITS } from '../config/index.js';

let nextId = 1;

export class Unit {
  readonly id: string;
  readonly config: UnitConfig;

  // Runtime state
  x: number;
  y: number;
  hp: number;
  owner: OwnerType;
  state: UnitState = 'idle';
  isDead: boolean = false;

  // Movement
  vx: number = 0;
  vy: number = 0;
  targetPos: Vec2 | null = null;
  isAttackMoveOrder: boolean = false;

  // Pathfinding
  path: { x: number; y: number }[] = [];
  pathDestKey: string = '';

  // Combat
  attackTarget: Unit | null = null;
  attackCooldown: number = 0;        // seconds until next attack
  aggroRange: number;                // auto-attack acquire range

  // Resource gathering
  gatherTarget: { x: number; y: number; id: string; type: 'primary' | 'advanced' } | null = null;
  carryAmount: number = 0;
  carryType: 'primary' | 'advanced' | null = null;
  homeBase: { x: number; y: number } | null = null;

  // Transport
  cargo: Unit[] = [];

  // Hero aura radius
  auraRadius: number = 0;
  auraCooldowns: Map<string, number> = new Map();

  // Status effects
  statusEffects: StatusEffect[] = [];
  webBuildup: number = 0;            // 0–100 for web execution

  // Visual feedback
  flashTimer: number = 0;            // attack flash duration
  deathTimer: number = 0;            // fade-out duration

  // Construction (worker building a structure)
  buildTarget: { buildingId: string; x: number; y: number } | null = null;

  // Stealth
  isCloaked: boolean = false;
  cloakTimer: number = 0;

  constructor(key: string, x: number, y: number, owner: OwnerType) {
    this.id = `unit_${nextId++}`;
    const cfg = ALL_UNITS[key];
    if (!cfg) throw new Error(`Unknown unit key: ${key}`);
    this.config = cfg;
    this.x = x;
    this.y = y;
    this.hp = cfg.maxHp;
    this.owner = owner;
    this.aggroRange = cfg.attackRange * 2.5;
    if (cfg.isHero) {
      this.auraRadius = 200;
    }
  }

  get isAlive(): boolean { return !this.isDead; }

  get moveSpeed(): number {
    let speed = this.config.moveSpeed;
    for (const se of this.statusEffects) {
      if (se.type === 'slowed' || se.type === 'frozen' || se.type === 'web') {
        speed *= se.type === 'frozen' ? 0.0 : 0.55;
      }
    }
    return speed;
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
    this.flashTimer = 0.12;
    if (this.hp === 0) {
      this.isDead = true;
      this.deathTimer = 0.6;
    }
  }

  heal(amount: number): void {
    this.hp = Math.min(this.config.maxHp, this.hp + amount);
  }

  hasStatus(type: StatusEffectType): boolean {
    return this.statusEffects.some(s => s.type === type);
  }

  getStatus(type: StatusEffectType): StatusEffect | undefined {
    return this.statusEffects.find(s => s.type === type);
  }

  applyStatus(effect: StatusEffect): void {
    const existing = this.getStatus(effect.type);
    if (existing) {
      // Refresh duration if new one is longer
      if (effect.totalDuration > existing.remainingDuration) {
        existing.remainingDuration = effect.totalDuration;
      }
      if (effect.type === 'web') {
        existing.webBuildup = Math.min(100, existing.webBuildup + effect.webBuildup);
        this.webBuildup = existing.webBuildup;
      }
    } else {
      this.statusEffects.push({ ...effect });
      if (effect.type === 'web') {
        this.webBuildup += effect.webBuildup;
      }
    }
  }

  clearStatus(type: StatusEffectType): void {
    this.statusEffects = this.statusEffects.filter(s => s.type !== type);
    if (type === 'web') {
      this.webBuildup = 0;
    }
  }

  clearAllStatusEffects(): void {
    this.statusEffects = [];
    this.webBuildup = 0;
  }

  tickStatusEffects(delta: number): void {
    for (let i = this.statusEffects.length - 1; i >= 0; i--) {
      const se = this.statusEffects[i]!;
      se.remainingDuration -= delta;

      if (se.type === 'burning' || se.type === 'fire') {
        // 3 damage per second from fire
        this.takeDamage(3 * delta);
      }
      if (se.type === 'infected') {
        this.takeDamage(2 * delta);
      }

      if (se.remainingDuration <= 0) {
        this.statusEffects.splice(i, 1);
        if (se.type === 'web') {
          this.webBuildup = 0;
        }
      }
    }
  }

  stopMoving(): void {
    this.vx = 0;
    this.vy = 0;
    this.targetPos = null;
    this.state = 'idle';
    this.path = [];
    this.pathDestKey = '';
  }

  distanceTo(x: number, y: number): number {
    const dx = this.x - x;
    const dy = this.y - y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  distanceToUnit(other: Unit): number {
    return this.distanceTo(other.x, other.y);
  }
}

export function createUnit(key: string, x: number, y: number, owner: OwnerType): Unit {
  return new Unit(key, x, y, owner);
}
