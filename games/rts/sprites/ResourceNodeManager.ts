/**
 * ResourceNodeManager — replaces programmatic resource node circles
 * with sprite images from the terrain atlas.
 *
 * Each ResourceNode gets a Phaser.GameObjects.Image positioned at its
 * world coordinate. Depleted nodes fade out; a programmatic pulse ring
 * is still drawn by the Graphics Renderer on top for gameplay readability.
 */

import Phaser from 'phaser';
import { ResourceNode } from '../game/ResourceNode.js';
import {
  TERRAIN_CLEAN_FLOW,
  TERRAIN_SPORADIC_FLOW,
} from './TerrainAtlas.js';

const CLEAN_SCALE    = 1.1;
const ADVANCED_SCALE = 1.3;
const DEPTH          = 55; // above ground tile (-1), below unit sprites (100+)

interface NodeEntry {
  image: Phaser.GameObjects.Image;
}

export class ResourceNodeManager {
  private readonly scene: Phaser.Scene;
  private readonly pool: Map<string, NodeEntry> = new Map();
  private time = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Sync sprites to current node list. Call once per frame.
   */
  update(delta: number, nodes: ResourceNode[]): void {
    this.time += delta / 1000;

    const liveIds = new Set(nodes.map(n => n.id));

    // Prune removed nodes
    for (const [id, entry] of this.pool) {
      if (!liveIds.has(id)) {
        entry.image.destroy();
        this.pool.delete(id);
      }
    }

    for (const node of nodes) {
      let entry = this.pool.get(node.id);

      if (!entry) {
        const frameName = node.type === 'primary'
          ? TERRAIN_CLEAN_FLOW
          : TERRAIN_SPORADIC_FLOW;
        const img = this.scene.add.image(node.x, node.y, 'terrain', frameName);
        img.setDepth(DEPTH);
        entry = { image: img };
        this.pool.set(node.id, entry);
      }

      const { image } = entry;
      image.setPosition(node.x, node.y);

      // Deplete: fade to near-invisible
      if (node.isDepleted) {
        image.setAlpha(0.18);
        image.setScale(node.type === 'primary' ? CLEAN_SCALE * 0.7 : ADVANCED_SCALE * 0.7);
        return;
      }

      // Pulse animation: gentle scale/alpha oscillation
      const pulseFactor = 0.05 + 0.04 * Math.sin(this.time * 2 + node.x * 0.005);
      const baseScale   = node.type === 'primary' ? CLEAN_SCALE : ADVANCED_SCALE;
      image.setScale(baseScale + pulseFactor);
      image.setAlpha(0.88 + 0.12 * Math.sin(this.time * 2.5 + node.y * 0.005));
    }
  }

  destroyAll(): void {
    for (const entry of this.pool.values()) {
      entry.image.destroy();
    }
    this.pool.clear();
  }
}
