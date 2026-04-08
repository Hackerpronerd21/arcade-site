/**
 * All game systems in one file:
 *  - CombatSystem
 *  - ResourceSystem
 *  - ProductionSystem
 *  - StatusSystem (fire, web, freeze, infection)
 *  - HeroSystem (aura effects)
 *  - SupplySystem
 *  - BasicAI (sandbox enemy)
 *
 * Each system receives the full game world state and mutates it.
 */

import { Unit } from './Unit.js';
import { pathfinder } from './Pathfinder.js';
import { Building } from './Building.js';
import { ResourceNode } from './ResourceNode.js';
import type { GameResources, GameState, Notification, StatusEffect } from '../types/index.js';
import { ALL_UNITS, calcProductionTime, HERO_REPURCHASE, HERO_REPURCHASE_COOLDOWN } from '../config/index.js';

// ─── World snapshot passed to all systems ─────────────────────────────────────

export interface WorldState {
  playerUnits: Unit[];
  enemyUnits: Unit[];
  playerBuildings: Building[];
  enemyBuildings: Building[];
  allNodes: ResourceNode[];
  gameState: GameState;
  playerFaction: string;
  notifications: Notification[];
  /** Projectile spawn requests (resolved by scene's renderer) */
  projectileRequests: ProjectileRequest[];
  /** Status zone requests (fire bombs, coolant, spore clouds) */
  zoneRequests: ZoneRequest[];
  /** New units to spawn next frame */
  spawnRequests: SpawnRequest[];
}

export interface ProjectileRequest {
  fromX: number; fromY: number;
  toX: number; toY: number;
  color: number;
  speed: number;
  damage: number;
  targetId: string;
  isAoe: boolean;
  aoeRadius: number;
}

export interface ZoneRequest {
  x: number; y: number;
  radius: number;
  type: 'fire' | 'coolant' | 'spore' | 'slime' | 'web';
  duration: number;
  owner: string;
}

export interface SpawnRequest {
  unitKey: string;
  x: number;
  y: number;
  owner: 'player' | 'enemy';
}

// ─── COMBAT SYSTEM ────────────────────────────────────────────────────────────

export function updateCombat(world: WorldState, delta: number): void {
  const allUnits = [...world.playerUnits, ...world.enemyUnits];

  for (const unit of allUnits) {
    if (!unit.isAlive) continue;
    if (unit.state === 'loaded') continue;

    // Tick attack cooldown
    if (unit.attackCooldown > 0) {
      unit.attackCooldown -= delta;
    }

    // Auto-acquire attack target if idle or attack-moving
    if (!unit.attackTarget || !unit.attackTarget.isAlive) {
      unit.attackTarget = null;
      if (unit.state === 'idle' || unit.isAttackMoveOrder) {
        const enemies = unit.owner === 'player' ? world.enemyUnits : world.playerUnits;
        unit.attackTarget = findClosestEnemy(unit, enemies, unit.aggroRange);
      }
    } else if (!unit.attackTarget.isAlive) {
      unit.attackTarget = null;
    }

    if (!unit.attackTarget) continue;

    const target = unit.attackTarget;
    const dist = unit.distanceToUnit(target);

    if (dist <= unit.config.attackRange) {
      // In range — attack
      if (unit.state !== 'attacking') unit.state = 'attacking';
      unit.stopMoving(); // stop to fire (kite logic is manual)
      unit.targetPos = null;

      if (unit.attackCooldown <= 0) {
        const dmg = calcDamage(unit);
        const projColor = unit.config.color;

        if (unit.config.attackRange > 35) {
          // Ranged — create projectile request
          world.projectileRequests.push({
            fromX: unit.x, fromY: unit.y,
            toX: target.x, toY: target.y,
            color: projColor, speed: 400,
            damage: dmg, targetId: target.id,
            isAoe: false, aoeRadius: 0,
          });
        } else {
          // Melee — instant hit
          target.takeDamage(dmg);
          unit.flashTimer = 0.08;
        }

        // Apply web buildup from spider units
        if (unit.config.faction === 'spider' && !unit.config.isHero) {
          target.applyStatus({
            type: 'web', totalDuration: 6, remainingDuration: 6,
            intensity: 1, webBuildup: 8, sourceId: unit.id,
          });
        }

        // Web execution: only spider hero completes the kill
        if (unit.config.isHero && unit.config.faction === 'spider') {
          if (target.webBuildup >= 100) {
            // Execute — instant kill
            target.takeDamage(target.hp);
            // Spawn a spider sac zone
            world.zoneRequests.push({
              x: target.x, y: target.y,
              radius: 40, type: 'web', duration: 30, owner: unit.owner,
            });
          }
        }

        // Arsonist firebomb (active ability is separate; basic attack applies minor fire)
        if (unit.config.key === 'arsonist') {
          if (!target.hasStatus('fire') && !target.hasStatus('burning')) {
            target.applyStatus({
              type: 'burning', totalDuration: 3, remainingDuration: 3,
              intensity: 1, webBuildup: 0, sourceId: unit.id,
            });
          }
        }

        // Cryo enforcer freezes + shatters spider sacs handled in status
        if (unit.config.key === 'cryo_enforcer') {
          target.applyStatus({
            type: 'frozen', totalDuration: 2, remainingDuration: 2,
            intensity: 1, webBuildup: 0, sourceId: unit.id,
          });
          // Ice clears web
          target.clearStatus('web');
          target.webBuildup = 0;
        }

        unit.attackCooldown = 1 / unit.config.attackRate;
      }
    } else {
      // Out of range — move toward target
      unit.state = 'moving';
      unit.targetPos = { x: target.x, y: target.y };
    }
  }

  // Tower attacks
  for (const building of [...world.playerBuildings, ...world.enemyBuildings]) {
    if (!building.isAlive || !building.config.isTower || building.state === 'under_construction') continue;
    if (building.towerCooldown > 0) {
      building.towerCooldown -= delta;
      continue;
    }
    const enemies = building.owner === 'player' ? world.enemyUnits : world.playerUnits;
    const target = findClosestEnemyToBuilding(building, enemies, building.config.towerRange);
    if (target) {
      target.takeDamage(building.config.towerDamage);
      world.projectileRequests.push({
        fromX: building.x, fromY: building.y,
        toX: target.x, toY: target.y,
        color: 0xffffff, speed: 500,
        damage: 0, targetId: target.id,  // damage already applied
        isAoe: false, aoeRadius: 0,
      });
      building.towerCooldown = 1 / building.config.towerAttackRate;
    }
  }
}

function calcDamage(unit: Unit): number {
  let dmg = unit.config.damage;
  // Tony's command presence aura bonus is applied in hero system via attack boost flag
  return dmg;
}

function findClosestEnemy(unit: Unit, enemies: Unit[], range: number): Unit | null {
  let best: Unit | null = null;
  let bestDist = range;
  for (const e of enemies) {
    if (!e.isAlive || e.state === 'loaded') continue;
    const d = unit.distanceToUnit(e);
    if (d < bestDist) { bestDist = d; best = e; }
  }
  return best;
}

function findClosestEnemyToBuilding(b: Building, enemies: Unit[], range: number): Unit | null {
  let best: Unit | null = null;
  let bestDist = range;
  for (const e of enemies) {
    if (!e.isAlive) continue;
    const d = b.distanceTo(e.x, e.y);
    if (d < bestDist) { bestDist = d; best = e; }
  }
  return best;
}

// ─── MOVEMENT SYSTEM ──────────────────────────────────────────────────────────

const SEPARATION_RADIUS = 22;
const SEPARATION_STRENGTH = 200;
const STOP_THRESHOLD = 8;
const WAYPOINT_REACH = 48;   // px — pop waypoint when this close
const PATH_SNAP = 128;       // px — snap combat destinations to reduce A* calls

/** Build a string key for a destination, optionally snapping to a coarser grid. */
function makeDestKey(x: number, y: number, snap: boolean): string {
  if (snap) {
    return `${Math.round(x / PATH_SNAP)}:${Math.round(y / PATH_SNAP)}`;
  }
  return `${Math.round(x)}:${Math.round(y)}`;
}

export function updateMovement(world: WorldState, delta: number): void {
  const allUnits = [...world.playerUnits, ...world.enemyUnits];

  for (const unit of allUnits) {
    if (!unit.isAlive || unit.state === 'loaded') continue;

    const speed = unit.moveSpeed;

    // States that require path-following movement toward targetPos
    const isNavigating =
      unit.targetPos !== null &&
      (unit.state === 'moving' || unit.state === 'gathering' || unit.state === 'returning');

    if (isNavigating && unit.targetPos) {
      const { x: tx, y: ty } = unit.targetPos;

      // Recompute path when destination changes.
      // Combat destinations snap to 128 px grid to avoid A* every frame.
      const snap = unit.state === 'moving';
      const dk = makeDestKey(tx, ty, snap);

      if (dk !== unit.pathDestKey) {
        unit.pathDestKey = dk;
        const result = pathfinder.findPath(unit.x, unit.y, tx, ty);
        unit.path = result ? result.waypoints.slice() : [];
      }

      // Pop waypoints we have reached
      while (unit.path.length > 0) {
        const wp = unit.path[0]!;
        const wdx = wp.x - unit.x;
        const wdy = wp.y - unit.y;
        if (wdx * wdx + wdy * wdy < WAYPOINT_REACH * WAYPOINT_REACH) {
          unit.path.shift();
        } else {
          break;
        }
      }

      // Steer toward next waypoint, or directly to target if path is exhausted
      const steerX = unit.path.length > 0 ? unit.path[0]!.x : tx;
      const steerY = unit.path.length > 0 ? unit.path[0]!.y : ty;

      const dx = steerX - unit.x;
      const dy = steerY - unit.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < STOP_THRESHOLD && unit.state === 'moving') {
        unit.stopMoving(); // clears path + pathDestKey
        continue;
      }

      if (dist > 0) {
        unit.vx = (dx / dist) * speed;
        unit.vy = (dy / dist) * speed;
      }
    } else {
      // Dampen velocity when not navigating; clear stale path data
      unit.vx *= 0.8;
      unit.vy *= 0.8;
      if (unit.path.length > 0) {
        unit.path = [];
        unit.pathDestKey = '';
      }
    }

    // Separation steering (only nearby same-owner units)
    let sepX = 0, sepY = 0;
    for (const other of allUnits) {
      if (other.id === unit.id || !other.isAlive) continue;
      const dx = unit.x - other.x;
      const dy = unit.y - other.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < SEPARATION_RADIUS * SEPARATION_RADIUS && distSq > 0) {
        const d = Math.sqrt(distSq);
        sepX += (dx / d) * SEPARATION_STRENGTH;
        sepY += (dy / d) * SEPARATION_STRENGTH;
      }
    }

    const finalVx = unit.vx + sepX;
    const finalVy = unit.vy + sepY;
    const finalSpeed = Math.sqrt(finalVx * finalVx + finalVy * finalVy);

    if (finalSpeed > 0) {
      const clampedSpeed = Math.min(finalSpeed, speed * 1.1);
      const nx = (finalVx / finalSpeed) * clampedSpeed;
      const ny = (finalVy / finalSpeed) * clampedSpeed;
      unit.x += nx * delta;
      unit.y += ny * delta;
    }

    // Clamp to world bounds
    unit.x = Math.max(16, Math.min(6384, unit.x));
    unit.y = Math.max(16, Math.min(6384, unit.y));
  }
}

// ─── RESOURCE SYSTEM ──────────────────────────────────────────────────────────

const GATHER_RATE = 8;          // resources per second per worker
const CARRY_CAPACITY = 5;       // resources per trip
const DEPOSIT_RANGE = 80;       // pixels from HQ to deposit
const GATHER_RANGE = 32;        // pixels from node to gather

export function updateResources(world: WorldState, delta: number): void {
  const workers = world.playerUnits.filter(u => u.config.isWorker && u.isAlive);

  // Find player HQ (deposit target)
  const hq = world.playerBuildings.find(b => b.config.isHQ && b.isAlive);
  if (!hq) return;

  for (const worker of workers) {
    if (worker.state === 'loaded' || worker.state === 'building') continue;

    if (worker.carryAmount >= CARRY_CAPACITY || (!worker.gatherTarget && worker.carryAmount > 0)) {
      // Returning to deposit
      worker.state = 'returning';
      worker.targetPos = { x: hq.x, y: hq.y };
      const distToHQ = worker.distanceTo(hq.x, hq.y);
      if (distToHQ < DEPOSIT_RANGE) {
        if (worker.carryType === 'primary') {
          world.gameState.resources.primary += worker.carryAmount;
        } else {
          world.gameState.resources.advanced += worker.carryAmount;
        }
        worker.carryAmount = 0;
        worker.carryType = null;
        worker.state = 'idle';
        worker.targetPos = null;
      }
      continue;
    }

    // Find a resource node to gather from if no target
    if (!worker.gatherTarget) {
      const node = findNearestFreeNode(worker, world.allNodes);
      if (node) {
        worker.gatherTarget = {
          x: node.x, y: node.y, id: node.id,
          type: node.type,
        };
      }
    }

    if (worker.gatherTarget) {
      const node = world.allNodes.find(n => n.id === worker.gatherTarget!.id);
      if (!node || node.isDepleted) {
        worker.gatherTarget = null;
        worker.state = 'idle';
        continue;
      }

      // Advanced nodes require an extraction building
      if (node.type === 'advanced' && node.extractionBuildingId === null) {
        worker.gatherTarget = null;
        worker.state = 'idle';
        continue;
      }

      worker.state = 'gathering';
      worker.targetPos = { x: node.x, y: node.y };
      const dist = worker.distanceTo(node.x, node.y);

      if (dist < GATHER_RANGE) {
        worker.targetPos = null;
        worker.vx = 0; worker.vy = 0;
        // Gather
        const toGather = Math.min(GATHER_RATE * delta, CARRY_CAPACITY - worker.carryAmount, node.amount);
        const gathered = node.harvest(toGather);
        worker.carryAmount += gathered;
        worker.carryType = node.type;
        node.assignWorker(worker.id);
      }
    }
  }
}

function findNearestFreeNode(worker: Unit, nodes: ResourceNode[]): ResourceNode | null {
  let best: ResourceNode | null = null;
  let bestDist = Infinity;

  for (const n of nodes) {
    if (n.isDepleted) continue;
    if (n.type === 'advanced' && n.extractionBuildingId === null) continue;
    if (n.isSaturated && !n.assignedWorkerIds.has(worker.id)) continue;
    const d = worker.distanceTo(n.x, n.y);
    if (d < bestDist) { bestDist = d; best = n; }
  }
  return best;
}

// ─── PRODUCTION SYSTEM ────────────────────────────────────────────────────────

export function updateProduction(
  world: WorldState,
  delta: number,
  addPlayerUnit: (unitKey: string, x: number, y: number) => void,
): void {
  for (const building of world.playerBuildings) {
    if (!building.isAlive || building.state === 'under_construction' || building.productionQueue.length === 0) continue;

    const item = building.productionQueue[0]!;
    item.progress += delta / item.totalTime;

    if (item.progress >= 1) {
      building.productionQueue.shift();
      const cfg = ALL_UNITS[item.unitKey];
      if (cfg) {
        const supplyAfter = world.gameState.supply + cfg.supply;
        if (supplyAfter <= world.gameState.maxSupply) {
          world.gameState.supply += cfg.supply;
          addPlayerUnit(item.unitKey, building.x + 80, building.y + 60);
          world.notifications.push({
            message: `${cfg.name} ready`,
            type: 'info',
            ttl: 3,
          });
        } else {
          // Stall — not enough supply
          item.progress = 1; // keep stalled
          world.notifications.push({
            message: 'SUPPLY CAP REACHED',
            type: 'warning',
            ttl: 3,
          });
        }
      }
    }
  }
}

// ─── STATUS EFFECT SYSTEM ─────────────────────────────────────────────────────

export function updateStatusEffects(world: WorldState, delta: number): void {
  const allUnits = [...world.playerUnits, ...world.enemyUnits];

  for (const unit of allUnits) {
    if (!unit.isAlive) continue;
    unit.tickStatusEffects(delta);

    // Fire burns away web and infection
    if (unit.hasStatus('fire') || unit.hasStatus('burning')) {
      unit.clearStatus('web');
      unit.clearStatus('infected');
      unit.webBuildup = 0;
    }

    // Frozen prevents movement
    if (unit.hasStatus('frozen')) {
      unit.vx = 0;
      unit.vy = 0;
    }

    // Ice (from cryo_enforcer) negates spores
    if (unit.hasStatus('frozen')) {
      unit.clearStatus('infected');
    }
  }

  // Tick flash and death timers
  for (const unit of allUnits) {
    if (unit.flashTimer > 0) unit.flashTimer -= delta;
    if (unit.deathTimer > 0) unit.deathTimer -= delta;
  }
  for (const b of [...world.playerBuildings, ...world.enemyBuildings]) {
    if (b.flashTimer > 0) b.flashTimer -= delta;
    if (b.deathTimer > 0) b.deathTimer -= delta;
  }
}

// ─── HERO AURA SYSTEM ────────────────────────────────────────────────────────

const COMMAND_PRESENCE_DMGBUFF  = 0.15;  // +15% damage
const COMMAND_PRESENCE_SPDBUFF  = 0.12;  // +12% speed
const INTIMIDATION_DEBUFF       = 0.1;   // -10% enemy damage

/**
 * Apply Tony's (and other hero) aura buffs/debuffs each frame.
 * This is done as a tag on the unit that the damage calc reads.
 * We store aura boosts as flags on the unit, reset each frame.
 */
export function updateHeroAuras(world: WorldState, _delta: number): void {
  // Reset aura flags first
  for (const u of world.playerUnits) {
    (u as any)._auraSpeedBonus   = 0;
    (u as any)._auraDmgBonus     = 0;
    (u as any)._auraDebuffActive = false;
  }
  for (const u of world.enemyUnits) {
    (u as any)._auraDebuffActive = false;
  }

  // Tony aura
  const tony = world.playerUnits.find(u => u.config.key === 'tony' && u.isAlive);
  if (tony) {
    const r = tony.auraRadius;
    for (const ally of world.playerUnits) {
      if (ally.id === tony.id) continue;
      if (tony.distanceToUnit(ally) <= r) {
        (ally as any)._auraSpeedBonus = COMMAND_PRESENCE_SPDBUFF;
        (ally as any)._auraDmgBonus   = COMMAND_PRESENCE_DMGBUFF;
      }
    }
    for (const enemy of world.enemyUnits) {
      if (tony.distanceToUnit(enemy) <= r) {
        (enemy as any)._auraDebuffActive = true;
      }
    }
  }

  // Apex Alpha pack aura
  const alpha = world.playerUnits.find(u => u.config.key === 'apex_alpha' && u.isAlive)
    ?? world.enemyUnits.find(u => u.config.key === 'apex_alpha' && u.isAlive);
  if (alpha) {
    const allies = alpha.owner === 'player' ? world.playerUnits : world.enemyUnits;
    for (const a of allies) {
      if (alpha.distanceToUnit(a) <= alpha.auraRadius) {
        (a as any)._auraSpeedBonus = Math.max((a as any)._auraSpeedBonus ?? 0, 0.1);
        (a as any)._auraDmgBonus   = Math.max((a as any)._auraDmgBonus ?? 0, 0.12);
      }
    }
  }
}

// ─── SUPPLY SYSTEM ────────────────────────────────────────────────────────────

export function recalcSupply(world: WorldState): void {
  let max = 0;
  for (const b of world.playerBuildings) {
    if (b.isAlive && b.state !== 'under_construction') max += b.config.supplyProvided;
  }
  world.gameState.maxSupply = Math.min(200, max);

  let used = 0;
  for (const u of world.playerUnits) {
    if (u.isAlive) used += u.config.supply;
  }
  world.gameState.supply = used;
}

// ─── CONSTRUCTION SYSTEM ─────────────────────────────────────────────────────

const CONSTRUCT_RANGE = 64; // pixels; worker must be within this distance to build

export function updateConstruction(world: WorldState, delta: number): void {
  for (const unit of world.playerUnits) {
    if (unit.state !== 'building' || !unit.buildTarget) continue;

    const building = world.playerBuildings.find(b => b.id === unit.buildTarget!.buildingId);

    if (!building || building.isDead || building.state !== 'under_construction') {
      // Building gone or already completed by someone else — idle worker
      unit.buildTarget = null;
      unit.state = 'idle';
      continue;
    }

    const dist = unit.distanceTo(building.x, building.y);
    if (dist > CONSTRUCT_RANGE) {
      unit.targetPos = { x: building.x, y: building.y };
    } else {
      unit.targetPos = null;
      unit.vx = 0;
      unit.vy = 0;
      building.builderUnitId = unit.id;
      building.constructionProgress += delta / building.config.buildTime;

      if (building.constructionProgress >= 1) {
        building.constructionProgress = 1;
        building.state = 'idle';
        building.builderUnitId = null;
        unit.buildTarget = null;
        unit.state = 'idle';
        world.notifications.push({
          message: `${building.config.name} complete!`,
          type: 'info',
          ttl: 4,
        });
      }
    }
  }
}

// ─── HERO DEATH / REPURCHASE ─────────────────────────────────────────────────

export function updateHeroState(world: WorldState, delta: number): void {
  const hero = world.playerUnits.find(u => u.config.isHero);

  if (!hero || !hero.isAlive) {
    world.gameState.heroAlive = false;

    if (world.gameState.techTier >= 3 && !world.gameState.heroRepurchasable) {
      if (world.gameState.heroRepurchaseCooldown > 0) {
        world.gameState.heroRepurchaseCooldown -= delta;
      } else {
        world.gameState.heroRepurchasable = true;
      }
    }
  } else {
    world.gameState.heroAlive = true;
  }
}

// ─── BASIC AI (sandbox enemy) ─────────────────────────────────────────────────

const AI_WORKER_TARGET    = 8;
const AI_ATTACK_COOLDOWN  = 30; // seconds between attack waves
const AI_WAVE_SIZE        = 6;

interface AIState {
  attackTimer: number;
  waveNumber: number;
}

const aiState: AIState = { attackTimer: AI_ATTACK_COOLDOWN, waveNumber: 0 };

export function updateAI(world: WorldState, delta: number): void {
  // Worker logic — they auto-gather via the resource system
  // AI workers assigned to nearest nodes
  const enemyWorkers = world.enemyUnits.filter(u => u.config.isWorker && u.isAlive);
  const enemyHQ = world.enemyBuildings.find(b => b.config.isHQ && b.isAlive);

  if (enemyHQ && enemyWorkers.length < AI_WORKER_TARGET) {
    // AI auto-produces workers from HQ
    if (enemyHQ.productionQueue.length === 0) {
      const workerKey = getEnemyWorkerKey(world);
      if (workerKey) {
        const cfg = ALL_UNITS[workerKey]!;
        enemyHQ.queueUnitWithTime(workerKey, calcProductionTime(cfg.primaryCost, cfg.advancedCost));
      }
    }
  }

  // Produce enemy units
  for (const building of world.enemyBuildings) {
    if (!building.isAlive || building.productionQueue.length > 0) continue;
    const unitKey = pickAIUnitToProduce(building, world);
    if (unitKey) {
      const cfg = ALL_UNITS[unitKey]!;
      building.queueUnitWithTime(unitKey, calcProductionTime(cfg.primaryCost, cfg.advancedCost));
    }
  }

  // Spawn produced units (same logic as player but for enemy)
  for (const building of world.enemyBuildings) {
    if (!building.isAlive || building.productionQueue.length === 0) continue;
    const item = building.productionQueue[0]!;
    item.progress += delta / item.totalTime;
    if (item.progress >= 1) {
      building.productionQueue.shift();
      const cfg = ALL_UNITS[item.unitKey];
      if (cfg) {
        world.spawnRequests.push({
          unitKey: item.unitKey,
          x: building.x - 80,
          y: building.y + 60,
          owner: 'enemy',
        });
      }
    }
  }

  // Attack waves
  aiState.attackTimer -= delta;
  if (aiState.attackTimer <= 0) {
    aiState.attackTimer = AI_ATTACK_COOLDOWN + aiState.waveNumber * 5;
    aiState.waveNumber++;

    const fighters = world.enemyUnits.filter(u => !u.config.isWorker && u.isAlive);
    const playerHQ = world.playerBuildings.find(b => b.config.isHQ && b.isAlive);
    if (playerHQ && fighters.length > 0) {
      const attackers = fighters.slice(0, AI_WAVE_SIZE + aiState.waveNumber * 2);
      for (const a of attackers) {
        a.state = 'moving';
        a.isAttackMoveOrder = true;
        a.targetPos = { x: playerHQ.x, y: playerHQ.y };
      }
    }
  }

  // Enemy resource gathering (simplified — instant income)
  if (world.enemyBuildings.some(b => b.config.isHQ && b.isAlive)) {
    // Enemies get passive income scaled to saturation
    world.gameState; // (enemy doesn't use gameState, they just have a pool tracked elsewhere)
  }
}

function getEnemyWorkerKey(world: WorldState): string | null {
  const hq = world.enemyBuildings.find(b => b.config.isHQ);
  if (!hq) return null;
  const workerKeys = hq.config.produces.filter(k => ALL_UNITS[k]?.isWorker);
  return workerKeys[0] ?? null;
}

function pickAIUnitToProduce(building: Building, _world: WorldState): string | null {
  const options = building.config.produces.filter(k => {
    const u = ALL_UNITS[k];
    return u && !u.isWorker && !u.isHero;
  });
  if (options.length === 0) return null;
  return options[Math.floor(Math.random() * options.length)] ?? null;
}

// ─── FIREBOMB ABILITY ─────────────────────────────────────────────────────────

export function triggerFirebomb(
  caster: Unit,
  targetX: number,
  targetY: number,
  world: WorldState,
): void {
  const RADIUS = 80;
  world.zoneRequests.push({
    x: targetX, y: targetY,
    radius: RADIUS, type: 'fire', duration: 4, owner: caster.owner,
  });

  // Apply fire status to units in radius
  const allUnits = [...world.playerUnits, ...world.enemyUnits];
  for (const u of allUnits) {
    const dx = u.x - targetX;
    const dy = u.y - targetY;
    if (Math.sqrt(dx * dx + dy * dy) <= RADIUS) {
      const fireEffect: StatusEffect = {
        type: 'fire', totalDuration: 4, remainingDuration: 4,
        intensity: 1, webBuildup: 0, sourceId: caster.id,
      };
      u.applyStatus(fireEffect);
      // Fire burns web and infection
      u.clearStatus('web');
      u.clearStatus('infected');
      u.webBuildup = 0;
    }
  }
}

// ─── TONY ABILITY: LOSE YOUR TEMPER ──────────────────────────────────────────

export function triggerLoseYourTemper(tony: Unit): void {
  if ((tony as any)._abilityTemperCooldown > 0) return;
  (tony as any)._abilityTemperCooldown = 15;
  // Apply temp buff flag
  (tony as any)._temperActive = true;
  (tony as any)._temperTimer = 4; // 4 seconds of enhanced damage/speed
  tony.config; // accessed for reference
}

export function updateTonyAbilities(tony: Unit, delta: number): void {
  if ((tony as any)._abilityTemperCooldown > 0) {
    (tony as any)._abilityTemperCooldown -= delta;
  }
  if ((tony as any)._temperTimer > 0) {
    (tony as any)._temperTimer -= delta;
    if ((tony as any)._temperTimer <= 0) {
      (tony as any)._temperActive = false;
    }
  }
}
