/**
 * Pure drawing module — receives Graphics + game state and renders everything.
 * No game logic here; only visuals.
 */

import type Phaser from 'phaser';
import { Unit } from './Unit.js';
import { Building } from './Building.js';
import { ResourceNode } from './ResourceNode.js';
import type { WorldState, ZoneRequest } from './Systems.js';
import type { SelectionBox } from './InputHandler.js';
import { UnitSpriteManager } from '../sprites/UnitSpriteManager.js';

// ─── Colour palette ───────────────────────────────────────────────────────────
const COL = {
  GRASS:      0x2d5a27,
  GRASS_DARK: 0x274e22,
  ROCK:       0x666655,
  CLEAN_FLOW: 0x00e5ff,
  SPOR_FLOW:  0xff2200,
  SEL_RING:   0x00ff88,
  HP_BG:      0x330000,
  HP_FULL:    0x22dd44,
  HP_MID:     0xddcc00,
  HP_LOW:     0xff2200,
  FIRE:       0xff6600,
  WEB:        0xeeeecc,
  FROZEN:     0x99ddff,
  INFECTED:   0x44ff44,
  AURA:       0xffff00,
  PROJ_DEF:   0xffffff,
  ATTACK_MOVE:0xff8800,
} as const;

export interface LiveProjectile {
  x: number; y: number;
  vx: number; vy: number;
  color: number;
  life: number; // seconds remaining
  targetId: string;
}

export interface LiveZone {
  x: number; y: number;
  radius: number;
  type: ZoneRequest['type'];
  life: number;
  maxLife: number;
}

export class Renderer {
  private gfx: Phaser.GameObjects.Graphics;
  private time: number = 0;

  readonly projectiles: LiveProjectile[] = [];
  readonly zones: LiveZone[] = [];

  constructor(gfx: Phaser.GameObjects.Graphics) {
    this.gfx = gfx;
  }

  addZoneRequest(req: ZoneRequest): void {
    this.zones.push({
      x: req.x, y: req.y, radius: req.radius,
      type: req.type, life: req.duration, maxLife: req.duration,
    });
  }

  update(
    delta: number,
    world: WorldState,
    selectedUnits: Unit[],
    selectionBox: SelectionBox,
    buildPlacementPos: { x: number; y: number; key: string } | null,
    allNodes: ResourceNode[],
    attackMoveTargetPos: { x: number; y: number } | null,
  ): void {
    this.time += delta / 1000;
    const g = this.gfx;
    g.clear();

    // Terrain background is now a TileSprite (GameScene). Just draw overlays.
    this.drawResourceNodeRings(g, allNodes); // gameplay-readability pulse rings
    this.drawZones(g, delta);
    this.drawBuildings(g, world, selectedUnits);
    this.drawUnits(g, world, selectedUnits);
    this.drawProjectiles(g, delta, world);
    this.drawSelectionBox(g, selectionBox);
    this.drawHeroAuras(g, world);

    if (attackMoveTargetPos) {
      g.lineStyle(2, COL.ATTACK_MOVE, 0.8);
      g.strokeCircle(attackMoveTargetPos.x, attackMoveTargetPos.y, 20);
      g.fillStyle(COL.ATTACK_MOVE, 0.3);
      g.fillCircle(attackMoveTargetPos.x, attackMoveTargetPos.y, 20);
    }

    if (buildPlacementPos) {
      this.drawBuildingGhost(g, buildPlacementPos);
    }
  }

  // ─── Resource Node rings (gameplay readability overlay) ──────────────────
  // The actual sprites are drawn by ResourceNodeManager at depth 55.
  // This adds a thin pulse ring so nodes are readable even at low zoom.

  private drawResourceNodeRings(g: Phaser.GameObjects.Graphics, nodes: ResourceNode[]): void {
    for (const node of nodes) {
      if (node.isDepleted) continue;
      const pulse = 0.4 + 0.25 * Math.sin(this.time * 2.5 + node.x * 0.01);
      const color  = node.type === 'primary' ? COL.CLEAN_FLOW : COL.SPOR_FLOW;
      const radius = node.type === 'primary' ? 34 : 42;
      g.lineStyle(1.5, color, pulse);
      g.strokeCircle(node.x, node.y, radius);

      if (node.extractionBuildingId) {
        g.lineStyle(2, 0xffaa00, 0.6);
        g.strokeRect(node.x - 28, node.y - 28, 56, 56);
      }
    }
  }

  // ─── Status Zones (fire, coolant, spores) ────────────────────────────────

  private drawZones(g: Phaser.GameObjects.Graphics, delta: number): void {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i]!;
      z.life -= delta / 1000;
      if (z.life <= 0) { this.zones.splice(i, 1); continue; }

      const alpha = (z.life / z.maxLife) * 0.55;
      const pulse = 0.8 + 0.2 * Math.sin(this.time * 4);

      switch (z.type) {
        case 'fire':
          g.fillStyle(COL.FIRE, alpha * pulse);
          g.fillCircle(z.x, z.y, z.radius);
          g.lineStyle(2, 0xff9900, alpha);
          g.strokeCircle(z.x, z.y, z.radius);
          break;
        case 'coolant':
          g.fillStyle(0x99ddff, alpha * pulse);
          g.fillCircle(z.x, z.y, z.radius);
          g.lineStyle(2, 0xffffff, alpha * 0.7);
          g.strokeCircle(z.x, z.y, z.radius);
          break;
        case 'spore':
          g.fillStyle(0x44cc44, alpha * pulse * 0.6);
          g.fillCircle(z.x, z.y, z.radius);
          break;
        case 'slime':
          g.fillStyle(0x88ff44, alpha * 0.5);
          g.fillCircle(z.x, z.y, z.radius);
          break;
        case 'web':
          // Spider sac / web zone
          g.fillStyle(COL.WEB, alpha * 0.4);
          g.fillCircle(z.x, z.y, z.radius);
          g.lineStyle(1, COL.WEB, alpha * 0.8);
          g.strokeCircle(z.x, z.y, z.radius);
          // Cross-web lines
          g.lineStyle(1, COL.WEB, alpha * 0.5);
          for (let a = 0; a < Math.PI; a += Math.PI / 4) {
            g.lineBetween(
              z.x + Math.cos(a) * z.radius, z.y + Math.sin(a) * z.radius,
              z.x - Math.cos(a) * z.radius, z.y - Math.sin(a) * z.radius,
            );
          }
          break;
      }
    }
  }

  // ─── Buildings ────────────────────────────────────────────────────────────

  private drawBuildings(g: Phaser.GameObjects.Graphics, world: WorldState, selectedUnits: Unit[]): void {
    const allBuildings = [...world.playerBuildings, ...world.enemyBuildings];

    for (const b of allBuildings) {
      if (b.isDead && b.deathTimer <= 0) continue;

      const alpha = b.isDead ? b.deathTimer : 1;
      const flash = b.flashTimer > 0 ? 0.5 : 0;
      const bx = b.left;
      const by = b.top;
      const bw = b.config.width;
      const bh = b.config.height;

      // ── Under construction ────────────────────────────────────────────────
      if (b.state === 'under_construction') {
        // Grey shell
        g.fillStyle(0x444444, 0.7 * alpha);
        g.fillRect(bx, by, bw, bh);
        g.lineStyle(2, 0xaaaaaa, alpha);
        g.strokeRect(bx, by, bw, bh);

        // Diagonal scaffold hatch (top-left to bottom-right)
        g.lineStyle(1, 0xffcc44, 0.45 * alpha);
        const step = 14;
        for (let off = 0; off < bw + bh; off += step) {
          const x1 = bx + Math.max(0, off - bh);
          const y1 = by + Math.min(bh, off);
          const x2 = bx + Math.min(bw, off);
          const y2 = by + Math.max(0, off - bw);
          g.lineBetween(x1, y1, x2, y2);
        }

        // Construction progress bar
        g.fillStyle(0x000000, 0.6);
        g.fillRect(bx, by + bh + 2, bw, 6);
        g.fillStyle(0xffcc00, 0.9);
        g.fillRect(bx, by + bh + 2, bw * b.constructionProgress, 6);

        continue;
      }

      // Shadow
      g.fillStyle(0x000000, 0.3);
      g.fillRect(bx + 6, by + 6, bw, bh);

      // Body
      const bodyCol = flash > 0 ? 0xffffff : b.config.color;
      g.fillStyle(bodyCol, alpha);
      g.fillRect(bx, by, bw, bh);

      // Border (player = green, enemy = red)
      const borderCol = b.owner === 'player' ? 0x88ff88 : 0xff4444;
      g.lineStyle(2, borderCol, alpha);
      g.strokeRect(bx, by, bw, bh);

      // Tower range indicator (subtle)
      if (b.config.isTower) {
        g.lineStyle(1, 0xffffff, 0.12);
        g.strokeCircle(b.x, b.y, b.config.towerRange);
      }

      // HP bar
      this.drawHPBar(g, bx, by - 10, bw, 5, b.hp / b.config.maxHp);

      // Production progress bar
      if (b.productionQueue.length > 0) {
        const item = b.productionQueue[0]!;
        g.fillStyle(0x000000, 0.6);
        g.fillRect(bx, by + bh + 2, bw, 4);
        g.fillStyle(0x00aaff, 0.9);
        g.fillRect(bx, by + bh + 2, bw * item.progress, 4);

        // Queue count
        if (b.productionQueue.length > 1) {
          // Render a small count badge — done via text in UIScene; skip here
        }
      }

      // Name label abbreviation
      g.fillStyle(0x000000, 0.5);
      g.fillRect(bx + 2, by + 2, Math.min(bw - 4, 60), 12);
    }
  }

  // ─── Units ────────────────────────────────────────────────────────────────

  private drawUnits(g: Phaser.GameObjects.Graphics, world: WorldState, selectedUnits: Unit[]): void {
    const selectedIds = new Set(selectedUnits.map(u => u.id));
    const allUnits = [...world.playerUnits, ...world.enemyUnits];

    for (const unit of allUnits) {
      if (unit.isDead && unit.deathTimer <= 0) continue;
      const alpha = unit.isDead ? Math.max(0, unit.deathTimer / 0.6) : 1;

      const r = unit.config.radius;
      const isSelected = selectedIds.has(unit.id);
      const flash = unit.flashTimer > 0;

      // Selection ring
      if (isSelected) {
        g.lineStyle(2, COL.SEL_RING, 0.95);
        g.strokeCircle(unit.x, unit.y, r + 5);
      }

      const hasSprite = UnitSpriteManager.hasSpriteForUnit(unit.config.key);

      if (!hasSprite) {
        // Fallback: draw colored shape for units without a sprite (e.g. Spider units)
        g.fillStyle(0x000000, 0.25 * alpha);
        g.fillEllipse(unit.x + 3, unit.y + 3, r * 2, r * 1.2);

        const bodyColor = flash ? 0xffffff : unit.config.color;
        g.fillStyle(bodyColor, alpha);

        switch (unit.config.shape) {
          case 'circle':
            g.fillCircle(unit.x, unit.y, r);
            break;
          case 'rect':
            g.fillRect(unit.x - r, unit.y - r * 0.75, r * 2, r * 1.5);
            break;
          case 'diamond': {
            const pts = [
              { x: unit.x,     y: unit.y - r * 1.4 },
              { x: unit.x + r, y: unit.y },
              { x: unit.x,     y: unit.y + r * 1.4 },
              { x: unit.x - r, y: unit.y },
            ];
            g.fillPoints(pts, true);
            break;
          }
        }

        const border = unit.owner === 'player' ? 0x88ff88 : 0xff5555;
        g.lineStyle(1.5, border, alpha * 0.9);
        g.strokeCircle(unit.x, unit.y, r);
      }

      // HP bar
      this.drawHPBar(g, unit.x - r, unit.y - r - 6, r * 2, 4, unit.hp / unit.config.maxHp);

      // Status effect overlays
      this.drawStatusOverlays(g, unit, r);

      // Web buildup meter
      if (unit.webBuildup > 0) {
        const barW = r * 2;
        g.fillStyle(0x222222, 0.8);
        g.fillRect(unit.x - r, unit.y + r + 2, barW, 3);
        g.fillStyle(COL.WEB, 1);
        g.fillRect(unit.x - r, unit.y + r + 2, barW * (unit.webBuildup / 100), 3);
      }

      // Cargo indicator (workers)
      if (unit.config.isWorker && unit.carryAmount > 0) {
        const cargoCol = unit.carryType === 'primary' ? COL.CLEAN_FLOW : COL.SPOR_FLOW;
        g.fillStyle(cargoCol, 0.9);
        g.fillCircle(unit.x + r - 3, unit.y - r + 3, 4);
      }

      // Transport cargo count
      if (unit.config.isTransport && unit.cargo.length > 0) {
        g.fillStyle(0xffffff, 0.8);
        g.fillCircle(unit.x + r, unit.y - r, 5);
      }

      // Stealth cloak (semitransparent silhouette for own units)
      if (unit.isCloaked && unit.owner === 'player') {
        g.fillStyle(0x8888ff, 0.2);
        g.fillCircle(unit.x, unit.y, r + 2);
      }

      // Hero pulsing ring
      if (unit.config.isHero && unit.isAlive) {
        const ring = 0.4 + 0.3 * Math.sin(this.time * 3);
        g.lineStyle(1.5, unit.config.color, ring);
        g.strokeCircle(unit.x, unit.y, r + 8);
      }
    }
  }

  private drawStatusOverlays(g: Phaser.GameObjects.Graphics, unit: Unit, r: number): void {
    const x = unit.x;
    const y = unit.y;
    const t = this.time;

    for (const se of unit.statusEffects) {
      switch (se.type) {
        case 'fire':
        case 'burning': {
          const a = 0.6 + 0.3 * Math.sin(t * 8);
          g.lineStyle(2, COL.FIRE, a);
          g.strokeCircle(x, y, r + 3);
          // Fire particles
          g.fillStyle(0xffff00, a * 0.8);
          for (let i = 0; i < 3; i++) {
            const angle = t * 5 + i * 2.094;
            g.fillCircle(
              x + Math.cos(angle) * (r + 2),
              y + Math.sin(angle) * (r + 2) - 3,
              2.5,
            );
          }
          break;
        }
        case 'web': {
          const a = 0.4 + 0.3 * Math.sin(t * 2);
          g.lineStyle(1.5, COL.WEB, a);
          g.strokeCircle(x, y, r + 2);
          break;
        }
        case 'frozen': {
          g.fillStyle(COL.FROZEN, 0.35);
          g.fillCircle(x, y, r + 2);
          g.lineStyle(2, 0xffffff, 0.8);
          g.strokeCircle(x, y, r + 2);
          break;
        }
        case 'infected': {
          const a = 0.4 + 0.3 * Math.sin(t * 3);
          g.lineStyle(2, COL.INFECTED, a);
          g.strokeCircle(x, y, r + 2);
          break;
        }
        case 'slowed': {
          g.lineStyle(1, 0x88aaff, 0.5);
          g.strokeCircle(x, y, r + 2);
          break;
        }
      }
    }

    // Tony's active ability visual
    if ((unit as any)._temperActive) {
      g.lineStyle(2, 0xff6600, 0.7 + 0.3 * Math.sin(this.time * 10));
      g.strokeCircle(x, y, r + 6);
    }
  }

  // ─── Hero Auras ───────────────────────────────────────────────────────────

  private drawHeroAuras(g: Phaser.GameObjects.Graphics, world: WorldState): void {
    const allUnits = [...world.playerUnits, ...world.enemyUnits];
    for (const u of allUnits) {
      if (!u.config.isHero || !u.isAlive || u.auraRadius === 0) continue;
      const pulse = 0.06 + 0.04 * Math.sin(this.time * 2);
      g.lineStyle(1, COL.AURA, pulse);
      g.strokeCircle(u.x, u.y, u.auraRadius);
    }
  }

  // ─── Projectiles ─────────────────────────────────────────────────────────

  private drawProjectiles(g: Phaser.GameObjects.Graphics, delta: number, world: WorldState): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]!;
      p.x += p.vx * (delta / 1000);
      p.y += p.vy * (delta / 1000);
      p.life -= delta / 1000;

      if (p.life <= 0) {
        // Deal damage on arrival
        const target = [...world.playerUnits, ...world.enemyUnits].find(u => u.id === p.targetId);
        if (target && target.isAlive) target.takeDamage(0); // damage was pre-applied for instant; AOE here if needed
        this.projectiles.splice(i, 1);
        continue;
      }

      g.fillStyle(p.color, 0.9);
      g.fillCircle(p.x, p.y, 3);
      // Tracer
      g.lineStyle(1, p.color, 0.4);
      g.lineBetween(p.x, p.y, p.x - p.vx * 0.06, p.y - p.vy * 0.06);
    }
  }

  addProjectile(
    fromX: number, fromY: number,
    toX: number, toY: number,
    color: number, speed: number,
    targetId: string,
  ): void {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const travelTime = dist / speed;
    this.projectiles.push({
      x: fromX, y: fromY,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      color,
      life: travelTime,
      targetId,
    });
  }

  // ─── Selection Box ────────────────────────────────────────────────────────

  private drawSelectionBox(g: Phaser.GameObjects.Graphics, box: SelectionBox): void {
    if (!box.active) return;
    const x = Math.min(box.startX, box.currentX);
    const y = Math.min(box.startY, box.currentY);
    const w = Math.abs(box.currentX - box.startX);
    const h = Math.abs(box.currentY - box.startY);
    if (w < 4 || h < 4) return;

    g.fillStyle(0x00ff88, 0.08);
    g.fillRect(x, y, w, h);
    g.lineStyle(1.5, 0x00ff88, 0.8);
    g.strokeRect(x, y, w, h);
  }

  // ─── Building Ghost (placement preview) ──────────────────────────────────

  private drawBuildingGhost(
    g: Phaser.GameObjects.Graphics,
    bp: { x: number; y: number; key: string },
  ): void {
    g.fillStyle(0xffffff, 0.2);
    g.fillRect(bp.x - 40, bp.y - 35, 80, 70);
    g.lineStyle(2, 0x88ff88, 0.6);
    g.strokeRect(bp.x - 40, bp.y - 35, 80, 70);
  }

  // ─── HP Bar helper ────────────────────────────────────────────────────────

  private drawHPBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, pct: number): void {
    g.fillStyle(COL.HP_BG, 0.7);
    g.fillRect(x, y, w, h);

    const col = pct > 0.6 ? COL.HP_FULL : pct > 0.3 ? COL.HP_MID : COL.HP_LOW;
    g.fillStyle(col, 0.9);
    g.fillRect(x, y, w * pct, h);
  }
}
