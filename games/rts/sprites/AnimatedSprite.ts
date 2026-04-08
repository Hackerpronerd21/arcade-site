/**
 * Atlas-agnostic animated sprite state machine.
 *
 * Tracks animationState, frameIndex, and animationTimer for a single unit.
 * Callers supply the target AnimState and the per-state frame-count/fps so
 * this class contains no atlas-specific knowledge.
 *
 * Rules:
 *  - State transition resets frameIndex and timer (except 'death' locks once entered).
 *  - 'hit' is a one-shot interrupt; caller must stop sending 'hit' once done.
 *  - 'death' plays to the last frame then holds there indefinitely.
 */

import type { AnimState } from './MafiaAtlas.js';

/** Frames-per-second for each animation state. */
const ANIM_FPS: Record<AnimState, number> = {
  idle:   5,
  walk:   8,
  attack: 10,
  hit:    12,
  death:  4,
};

export class AnimatedSprite {
  animationState: AnimState = 'idle';
  frameIndex: number = 0;
  animationTimer: number = 0;

  /**
   * Advance the animation.
   *
   * @param delta       Frame delta in milliseconds.
   * @param targetState Desired animation state derived from unit state.
   * @param frameCount  Number of frames in targetState (from atlas).
   */
  update(delta: number, targetState: AnimState, frameCount: number): void {
    const dt = delta / 1000;

    // ── State transition ──────────────────────────────────────────────────────
    if (targetState !== this.animationState) {
      if (this.animationState === 'death') return; // locked
      this.animationState = targetState;
      this.frameIndex = 0;
      this.animationTimer = 0;
    }

    // ── Advance timer ─────────────────────────────────────────────────────────
    const frameDur = 1 / ANIM_FPS[this.animationState];
    this.animationTimer += dt;

    if (this.animationTimer >= frameDur) {
      this.animationTimer -= frameDur;

      if (this.animationState === 'death') {
        // play-once: hold on last frame
        this.frameIndex = Math.min(this.frameIndex + 1, frameCount - 1);
      } else {
        // loop all other states
        this.frameIndex = (this.frameIndex + 1) % frameCount;
      }
    }
  }
}
