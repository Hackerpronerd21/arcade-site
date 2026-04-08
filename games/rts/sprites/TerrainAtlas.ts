/**
 * TerrainAtlas — frame registrations for TERRAIN SHEET.png.
 *
 * Sheet layout (1024×559):
 *   Section 1 (top-left):  Base ground tiles — 5 neutral variants, 32×31 px each
 *   Section 3 (top-right): Resource node display sprites
 *     - Clean Flow (primary):  x=775, y=50,  w=72, h=78
 *     - Sporadic Flow (adv):   x=860, y=58,  w=85, h=93
 *
 * Tile size note: the ground tiles are 32×31 (one-pixel gap included in width).
 * For the TileSprite background we use 'terrain_ground_0'.
 */

import type Phaser from 'phaser';

// ─── Ground tile definitions (5 neutral variants) ────────────────────────────

const GROUND_TILES = [
  { name: 'terrain_ground_0', x:  34, y: 44, w: 32, h: 31 },
  { name: 'terrain_ground_1', x:  66, y: 44, w: 32, h: 31 },
  { name: 'terrain_ground_2', x:  98, y: 44, w: 32, h: 31 },
  { name: 'terrain_ground_3', x: 130, y: 44, w: 32, h: 31 },
  { name: 'terrain_ground_4', x: 162, y: 44, w: 32, h: 31 },
] as const;

// ─── Resource node display sprites ───────────────────────────────────────────

const RESOURCE_NODE_FRAMES = [
  { name: 'terrain_clean_flow',   x: 775, y: 50, w: 72, h: 78 },
  { name: 'terrain_sporadic_flow', x: 860, y: 58, w: 85, h: 93 },
] as const;

// ─── Public helpers ───────────────────────────────────────────────────────────

export const TERRAIN_GROUND_FRAMES = GROUND_TILES.map(t => t.name) as readonly string[];

export const TERRAIN_CLEAN_FLOW    = 'terrain_clean_flow'    as const;
export const TERRAIN_SPORADIC_FLOW = 'terrain_sporadic_flow' as const;

/**
 * Register all terrain atlas frames into the Phaser 'terrain' texture.
 * Must be called in scene `create()` after BootScene has loaded the texture.
 */
export function registerTerrainFrames(textures: Phaser.Textures.TextureManager): void {
  const texture = textures.get('terrain');
  if (!texture) {
    console.warn('[TerrainAtlas] "terrain" texture not loaded');
    return;
  }

  for (const { name, x, y, w, h } of [...GROUND_TILES, ...RESOURCE_NODE_FRAMES]) {
    texture.add(name, 0, x, y, w, h);
  }
}
