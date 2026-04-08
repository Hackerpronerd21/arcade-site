/**
 * UnitSpriteManager — manages a pool of Phaser Image objects, one per unit,
 * covering all five factions.
 *
 * Priority order for sprite lookup:
 *   1. Mafia atlas   (texture: 'mafia')
 *   2. Faction atlas (textures: 'spiderrace', 'primals', 'timecore', 'verdantplague')
 *   3. Fallback: no Image created — Renderer draws colored shape as before
 *
 * The Graphics Renderer continues to draw HP bars, selection rings,
 * status overlays, etc. on top (depth 10000).
 */

import Phaser from 'phaser';
import { Unit } from '../game/Unit.js';
import { AnimatedSprite } from './AnimatedSprite.js';
import {
  hasMafiaSprite,
  getMafiaFrameName,
  getMafiaFrameCount,
  type AnimState,
} from './MafiaAtlas.js';
import {
  hasFactionSprite,
  getFactionTextureKey,
  getFactionFrameName,
  getFactionFrameCount,
} from './FactionAtlas.js';
import type { UnitState } from '../types/index.js';

// ─── Unit-state → animation-state mapping ────────────────────────────────────

function resolveAnim(unitState: UnitState, isDead: boolean, isHit: boolean): AnimState {
  if (isDead) return 'death';
  if (isHit)  return 'hit';
  switch (unitState) {
    case 'moving':
    case 'gathering':
    case 'returning': return 'walk';
    case 'attacking':  return 'attack';
    default:           return 'idle';
  }
}

// ─── Per-unit sprite entry ────────────────────────────────────────────────────

interface SpriteEntry {
  image:   Phaser.GameObjects.Image;
  anim:    AnimatedSprite;
  isMafia: boolean;
  textureKey: string;
}

// ─── Manager ─────────────────────────────────────────────────────────────────

export class UnitSpriteManager {
  private readonly scene: Phaser.Scene;
  private readonly pool: Map<string, SpriteEntry> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Returns true if a sprite exists for the given unit key
   * (either Mafia or one of the four other factions).
   */
  static hasSpriteForUnit(unitKey: string): boolean {
    return hasMafiaSprite(unitKey) || hasFactionSprite(unitKey);
  }

  /**
   * Sync sprites to the current unit list. Call once per frame.
   *
   * @param delta  Frame delta in ms.
   * @param units  All living + recently-dead units (player + enemy).
   */
  update(delta: number, units: Unit[]): void {
    // ── Prune stale entries ───────────────────────────────────────────────────
    const liveIds = new Set(units.map(u => u.id));
    for (const [id, entry] of this.pool) {
      if (!liveIds.has(id)) {
        entry.image.destroy();
        this.pool.delete(id);
      }
    }

    for (const unit of units) {
      const isMafia   = hasMafiaSprite(unit.config.key);
      const isFaction = !isMafia && hasFactionSprite(unit.config.key);
      if (!isMafia && !isFaction) continue; // no sprite — Graphics handles it

      // ── Create entry on first sight ───────────────────────────────────────
      let entry = this.pool.get(unit.id);
      if (!entry) {
        const texKey    = isMafia ? 'mafia' : (getFactionTextureKey(unit.config.key) ?? '');
        const firstFrame = isMafia
          ? getMafiaFrameName(unit.config.key, 'idle', 0)
          : getFactionFrameName(texKey, unit.config.key, 'idle', 0);

        const img = this.scene.add.image(unit.x, unit.y, texKey, firstFrame);
        img.setOrigin(0.5, 0.75); // feet at unit.y
        entry = { image: img, anim: new AnimatedSprite(), isMafia, textureKey: texKey };
        this.pool.set(unit.id, entry);
      }

      const { image, anim, isMafia: im, textureKey } = entry;

      // ── Advance animation ─────────────────────────────────────────────────
      const isHit      = unit.flashTimer > 0;
      const targetAnim = resolveAnim(unit.state as UnitState, unit.isDead, isHit);
      const frameCount = im
        ? getMafiaFrameCount(targetAnim)
        : getFactionFrameCount(targetAnim);
      anim.update(delta, targetAnim, frameCount);

      // ── Apply frame ───────────────────────────────────────────────────────
      const frameName = im
        ? getMafiaFrameName(unit.config.key, anim.animationState, anim.frameIndex)
        : getFactionFrameName(textureKey, unit.config.key, anim.animationState, anim.frameIndex);
      image.setFrame(frameName);

      // ── Position & painter's-sort depth ──────────────────────────────────
      image.setPosition(unit.x, unit.y);
      image.setDepth(unit.y + 100);

      // ── Scale: flip based on velocity, hero size-up ───────────────────────
      const baseScale = unit.config.isHero ? 1.2 : 1.0;
      const flipX     = unit.vx < -0.5 ? -1 : 1;
      image.setScale(flipX * baseScale, baseScale);

      // ── Alpha: death fade / cloak ─────────────────────────────────────────
      if (unit.isDead) {
        image.setAlpha(Math.max(0, unit.deathTimer / 0.6));
      } else if ((unit as any).isCloaked && unit.owner === 'player') {
        image.setAlpha(0.3);
      } else {
        image.setAlpha(1);
      }

      // ── Hit-flash: white tint ─────────────────────────────────────────────
      if (isHit) {
        image.setTint(0xffffff);
      } else {
        image.clearTint();
      }
    }
  }

  destroyAll(): void {
    for (const entry of this.pool.values()) {
      entry.image.destroy();
    }
    this.pool.clear();
  }
}
