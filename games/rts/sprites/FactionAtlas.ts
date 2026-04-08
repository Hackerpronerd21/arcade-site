/**
 * FactionAtlas — sprite atlas for Spider, Primal, Timecore, and Verdant factions.
 *
 * All four sheets share the same 1024×559 dimensions and the same animation
 * column structure as the Mafia sheet. Only the unit row positions differ.
 *
 * Column layout (identical to MafiaAtlas):
 *   idle:   x=0,   frameW=43, 2 frames
 *   walk:   x=94,  frameW=38, 4 frames
 *   attack: x=256, frameW=31, 3 frames
 *   hit:    x=358, frameW=56, 1 frame
 *   death:  x=416, frameW=82, 2 frames
 *
 * Frame name convention:  {textureKey}_{unitKey}_{animState}_{frameIndex}
 *   e.g.  spiderrace_spider_hero_walk_2
 */

import type Phaser from 'phaser';
import type { AnimState } from './MafiaAtlas.js';

// ─── Shared column spec (same for all faction sheets) ─────────────────────────

const COLUMN_SPEC: Record<AnimState, { startX: number; frameW: number; count: number }> = {
  idle:   { startX: 0,   frameW: 43, count: 2 },
  walk:   { startX: 94,  frameW: 38, count: 4 },
  attack: { startX: 256, frameW: 31, count: 3 },
  hit:    { startX: 358, frameW: 56, count: 1 },
  death:  { startX: 416, frameW: 82, count: 2 },
};

// ─── Row specs per faction ─────────────────────────────────────────────────────

type RowSpec = { y: number; h: number };

const SPIDER_ROWS: Record<string, RowSpec> = {
  spider_hero:  { y: 12,  h: 62 },
  brood_tender: { y: 81,  h: 42 },
  webling:      { y: 133, h: 43 },
  skitterer:    { y: 184, h: 41 },
  web_spitter:  { y: 232, h: 40 },
  web_beast:    { y: 277, h: 43 },
};

const PRIMAL_ROWS: Record<string, RowSpec> = {
  apex_alpha:  { y: 12,  h: 62 },
  nest_tender: { y: 81,  h: 42 },
  raptor:      { y: 133, h: 43 },
  tyrant_rex:  { y: 184, h: 41 },
};

const TIMECORE_ROWS: Record<string, RowSpec> = {
  time_fragment:    { y: 12,  h: 62 },
  chrono_harvester: { y: 81,  h: 42 },
  cryo_enforcer:    { y: 277, h: 43 },
  chrono_tank:      { y: 325, h: 47 },
  time_anchor:      { y: 464, h: 52 },
};

const VERDANT_ROWS: Record<string, RowSpec> = {
  sproutling:      { y: 12,  h: 62 },
  spore_tender:    { y: 232, h: 40 },
  bloom_tyrant:    { y: 464, h: 52 },
  plague_behemoth: { y: 512, h: 39 },
};

// ─── Faction → texture key and row spec ───────────────────────────────────────

interface FactionSpec {
  textureKey: string;
  rows: Record<string, RowSpec>;
}

const FACTION_SPECS: FactionSpec[] = [
  { textureKey: 'spiderrace',  rows: SPIDER_ROWS   },
  { textureKey: 'primals',     rows: PRIMAL_ROWS   },
  { textureKey: 'timecore',    rows: TIMECORE_ROWS },
  { textureKey: 'verdantplague', rows: VERDANT_ROWS },
];

// ─── Lookup tables built on first registration ────────────────────────────────

/** Maps unit key → texture key */
const UNIT_TO_TEXTURE = new Map<string, string>();

/** Set of all unit keys covered by this module */
export const FACTION_SPRITE_KEYS = new Set<string>();

/** Returns the Phaser texture key for a given unit, or null if not covered. */
export function getFactionTextureKey(unitKey: string): string | null {
  return UNIT_TO_TEXTURE.get(unitKey) ?? null;
}

/** Returns true if this module covers the given unit key. */
export function hasFactionSprite(unitKey: string): boolean {
  return FACTION_SPRITE_KEYS.has(unitKey);
}

/** Number of frames in each animation state (same for all factions). */
export function getFactionFrameCount(anim: AnimState): number {
  return COLUMN_SPEC[anim].count;
}

/** Canonical frame name for a faction unit. */
export function getFactionFrameName(
  textureKey: string,
  unitKey: string,
  anim: AnimState,
  frameIdx: number,
): string {
  return `${textureKey}_${unitKey}_${anim}_${frameIdx}`;
}

/**
 * Register all faction sprite frames into Phaser textures.
 * Call once in scene `create()` after all textures are loaded.
 */
export function registerFactionFrames(textures: Phaser.Textures.TextureManager): void {
  for (const { textureKey, rows } of FACTION_SPECS) {
    const texture = textures.get(textureKey);
    if (!texture) {
      console.warn(`[FactionAtlas] texture "${textureKey}" not loaded`);
      continue;
    }

    for (const [unitKey, row] of Object.entries(rows)) {
      UNIT_TO_TEXTURE.set(unitKey, textureKey);
      FACTION_SPRITE_KEYS.add(unitKey);

      for (const [animName, col] of Object.entries(COLUMN_SPEC)) {
        const anim = animName as AnimState;
        for (let i = 0; i < col.count; i++) {
          const name = getFactionFrameName(textureKey, unitKey, anim, i);
          const fx   = col.startX + i * col.frameW;
          texture.add(name, 0, fx, row.y, col.frameW, row.h);
        }
      }
    }
  }
}
