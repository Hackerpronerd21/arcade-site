/**
 * Mafia sprite atlas — defines the frame layout for mafia.png (1024×559).
 *
 * Layout rules:
 *  - Rows (y-axis): one infantry unit per row, identified by unit key
 *  - Columns (x-axis): animation states, uniform x-positions across ALL rows
 *  - Death column starts at x=416 (right section of the sheet)
 *
 * Frame names use the convention: `mafia_{unitKey}_{animState}_{frameIndex}`
 * e.g.  mafia_tony_idle_0,  mafia_associate_walk_2
 *
 * Call registerMafiaFrames() once after the 'mafia' texture is loaded to
 * populate the Phaser texture with all named frames.
 */

import type Phaser from 'phaser';

// ─── Animation types ──────────────────────────────────────────────────────────

export type AnimState = 'idle' | 'walk' | 'attack' | 'hit' | 'death';

// ─── Column spec (same x-positions for every infantry row) ───────────────────

interface ColSpec { startX: number; frameW: number; count: number }

const COLUMN_SPEC: Record<AnimState, ColSpec> = {
  idle:   { startX: 0,   frameW: 43, count: 2 },
  walk:   { startX: 94,  frameW: 38, count: 4 },
  attack: { startX: 256, frameW: 31, count: 3 },
  hit:    { startX: 358, frameW: 56, count: 1 },
  death:  { startX: 416, frameW: 82, count: 2 },
};

// ─── Row spec (one entry per infantry unit) ───────────────────────────────────

interface RowSpec { y: number; h: number }

const ROW_SPEC: Readonly<Record<string, RowSpec>> = {
  tony:        { y: 12,  h: 62 },
  associate:   { y: 81,  h: 42 },
  street_thug: { y: 133, h: 43 },
  soldier:     { y: 184, h: 41 },
  lookout:     { y: 232, h: 40 },
  gangster:    { y: 277, h: 43 },
  launderer:   { y: 325, h: 47 },
  enforcer:    { y: 369, h: 51 },
  arsonist:    { y: 419, h: 41 },
  caporegime:  { y: 464, h: 52 },
  assassin:    { y: 512, h: 39 },
};

// ─── Public helpers ───────────────────────────────────────────────────────────

/** Unit keys that have a sprite in the mafia atlas. */
export const MAFIA_SPRITE_KEYS: ReadonlySet<string> = new Set(Object.keys(ROW_SPEC));

/** Returns true if the unit key maps to a sprite row in this atlas. */
export function hasMafiaSprite(unitKey: string): boolean {
  return MAFIA_SPRITE_KEYS.has(unitKey);
}

/** Number of frames in each animation state. */
export function getMafiaFrameCount(anim: AnimState): number {
  return COLUMN_SPEC[anim].count;
}

/** Canonical frame name for a given unit / animation / frame index. */
export function getMafiaFrameName(unitKey: string, anim: AnimState, frameIdx: number): string {
  return `mafia_${unitKey}_${anim}_${frameIdx}`;
}

/**
 * Dynamically register all mafia infantry frame rects into the Phaser texture.
 *
 * Must be called AFTER the 'mafia' texture has been loaded by Phaser
 * (i.e. in scene `create()`, not `preload()`).
 */
export function registerMafiaFrames(textures: Phaser.Textures.TextureManager): void {
  const texture = textures.get('mafia');
  if (!texture) {
    console.warn('[MafiaAtlas] mafia texture not loaded — call load.image("mafia", ...) first');
    return;
  }

  for (const [unitKey, row] of Object.entries(ROW_SPEC)) {
    for (const [animName, col] of Object.entries(COLUMN_SPEC)) {
      const anim = animName as AnimState;
      for (let i = 0; i < col.count; i++) {
        const name = getMafiaFrameName(unitKey, anim, i);
        const fx = col.startX + i * col.frameW;
        // sourceIndex 0 = the base image layer
        texture.add(name, 0, fx, row.y, col.frameW, row.h);
      }
    }
  }
}
