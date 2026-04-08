/**
 * Handles all mouse and keyboard input for the GameScene.
 * Returns command intents; does NOT directly mutate game state.
 */
import Phaser from 'phaser';
import { Unit } from './Unit.js';
import { Building } from './Building.js';
import { ResourceNode } from './ResourceNode.js';
import type { Vec2 } from '../types/index.js';

export type CommandIntent =
  | { type: 'move'; worldPos: Vec2 }
  | { type: 'attack_move'; worldPos: Vec2 }
  | { type: 'attack'; targetId: string }
  | { type: 'gather'; nodeId: string }
  | { type: 'stop' }
  | { type: 'hold' }
  | { type: 'load'; transportId: string }
  | { type: 'unload'; worldPos: Vec2 }
  | { type: 'firebomb'; worldPos: Vec2 }
  | { type: 'queue_unit'; buildingId: string; unitKey: string }
  | { type: 'select_all_type' }
  | { type: 'deselect' };

export interface SelectionBox {
  active: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export class InputHandler {
  readonly phScene: Phaser.Scene;
  private phCamera: Phaser.Cameras.Scene2D.Camera;
  private selectionBox: SelectionBox = {
    active: false, startX: 0, startY: 0, currentX: 0, currentY: 0,
  };

  private isAttackMoveQueued = false;
  private isFirebombQueued = false;

  // Camera pan
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  private readonly CAMERA_SPEED = 600;
  private readonly EDGE_SCROLL_MARGIN = 40;
  private readonly EDGE_SCROLL_SPEED = 500;

  constructor(scene: Phaser.Scene) {
    this.phScene = scene;
    this.phCamera = scene.cameras.main;

    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.wasd = {
      up:    scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down:  scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left:  scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  getSelectionBox(): SelectionBox { return this.selectionBox; }
  getAttackMoveQueued(): boolean { return this.isAttackMoveQueued; }
  getFirebombQueued(): boolean { return this.isFirebombQueued; }
  clearAttackMove(): void { this.isAttackMoveQueued = false; }
  clearFirebomb(): void { this.isFirebombQueued = false; }

  handleKeyboardInput(delta: number): void {
    const dt = delta / 1000;
    const speed = this.CAMERA_SPEED;
    const cam = this.phCamera;

    if (this.cursors.left.isDown  || this.wasd.left.isDown)  cam.scrollX -= speed * dt;
    if (this.cursors.right.isDown || this.wasd.right.isDown) cam.scrollX += speed * dt;
    if (this.cursors.up.isDown    || this.wasd.up.isDown)    cam.scrollY -= speed * dt;
    if (this.cursors.down.isDown  || this.wasd.down.isDown)  cam.scrollY += speed * dt;

    // Clamp camera
    cam.scrollX = Math.max(0, Math.min(6400 - cam.width,  cam.scrollX));
    cam.scrollY = Math.max(0, Math.min(6400 - cam.height, cam.scrollY));
  }

  handleEdgeScrolling(delta: number): void {
    const dt = delta / 1000;
    const { x: mx, y: my } = this.phScene.input;
    const { width, height } = this.phScene.scale;
    const m = this.EDGE_SCROLL_MARGIN;
    const sp = this.EDGE_SCROLL_SPEED;

    if (mx < m)           this.phCamera.scrollX -= sp * dt;
    if (mx > width - m)   this.phCamera.scrollX += sp * dt;
    if (my < m)           this.phCamera.scrollY -= sp * dt;
    if (my > height - m)  this.phCamera.scrollY += sp * dt;
  }

  handleZoom(event: WheelEvent): void {
    const cam = this.phCamera;
    const delta = event.deltaY > 0 ? -0.05 : 0.05;
    cam.zoom = Math.max(0.3, Math.min(1.5, cam.zoom + delta));
  }

  /** Call when A key pressed */
  queueAttackMove(): void {
    this.isAttackMoveQueued = true;
    this.isFirebombQueued = false;
  }

  /** Call when F key pressed (firebomb) */
  queueFirebomb(): void {
    this.isFirebombQueued = true;
    this.isAttackMoveQueued = false;
  }

  startSelectionBox(worldX: number, worldY: number): void {
    this.selectionBox = {
      active: true,
      startX: worldX, startY: worldY,
      currentX: worldX, currentY: worldY,
    };
  }

  updateSelectionBox(worldX: number, worldY: number): void {
    if (this.selectionBox.active) {
      this.selectionBox.currentX = worldX;
      this.selectionBox.currentY = worldY;
    }
  }

  endSelectionBox(): SelectionBox {
    const box = { ...this.selectionBox };
    this.selectionBox.active = false;
    return box;
  }

  /** Get the normalised selection rectangle in world coords */
  getSelectionRect(): { x: number; y: number; w: number; h: number } | null {
    if (!this.selectionBox.active) return null;
    const x = Math.min(this.selectionBox.startX, this.selectionBox.currentX);
    const y = Math.min(this.selectionBox.startY, this.selectionBox.currentY);
    const w = Math.abs(this.selectionBox.currentX - this.selectionBox.startX);
    const h = Math.abs(this.selectionBox.currentY - this.selectionBox.startY);
    return { x, y, w, h };
  }

  /** Returns all player units inside the selection box */
  getUnitsInSelectionBox(
    units: Unit[],
    box: { x: number; y: number; w: number; h: number },
  ): Unit[] {
    return units.filter(u =>
      u.isAlive &&
      u.x >= box.x && u.x <= box.x + box.w &&
      u.y >= box.y && u.y <= box.y + box.h,
    );
  }

  /** Click a point to see if it hits a unit */
  getUnitAtPoint(units: Unit[], worldX: number, worldY: number, radius = 16): Unit | null {
    let best: Unit | null = null;
    let bestDist = radius;
    for (const u of units) {
      if (!u.isAlive) continue;
      const d = u.distanceTo(worldX, worldY);
      if (d < bestDist) { bestDist = d; best = u; }
    }
    return best;
  }

  getBuildingAtPoint(
    buildings: Building[],
    worldX: number,
    worldY: number,
  ): Building | null {
    for (const b of buildings) {
      if (!b.isAlive) continue;
      if (
        worldX >= b.left && worldX <= b.right &&
        worldY >= b.top  && worldY <= b.bottom
      ) return b;
    }
    return null;
  }

  getResourceAtPoint(
    nodes: ResourceNode[],
    worldX: number,
    worldY: number,
    radius = 24,
  ): ResourceNode | null {
    for (const n of nodes) {
      if (n.isDepleted) continue;
      const dx = n.x - worldX;
      const dy = n.y - worldY;
      if (Math.sqrt(dx * dx + dy * dy) < radius) return n;
    }
    return null;
  }
}
