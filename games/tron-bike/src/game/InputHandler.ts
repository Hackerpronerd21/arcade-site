import type { Direction } from '../types';

export class InputHandler {
  private p1Queue: Direction[] = [];
  private p2Queue: Direction[] = [];
  private bound: (e: KeyboardEvent) => void;

  constructor() {
    this.bound = this.onKey.bind(this);
    window.addEventListener('keydown', this.bound);
  }

  private onKey(e: KeyboardEvent) {
    switch (e.key) {
      case 'w': case 'W': this.p1Queue.push('UP');    break;
      case 's': case 'S': this.p1Queue.push('DOWN');  break;
      case 'a': case 'A': this.p1Queue.push('LEFT');  break;
      case 'd': case 'D': this.p1Queue.push('RIGHT'); break;
      case 'ArrowUp':    e.preventDefault(); this.p2Queue.push('UP');    break;
      case 'ArrowDown':  e.preventDefault(); this.p2Queue.push('DOWN');  break;
      case 'ArrowLeft':  e.preventDefault(); this.p2Queue.push('LEFT');  break;
      case 'ArrowRight': e.preventDefault(); this.p2Queue.push('RIGHT'); break;
    }
  }

  consumeP1(): Direction | null { return this.p1Queue.shift() ?? null; }
  consumeP2(): Direction | null { return this.p2Queue.shift() ?? null; }

  // For online single-seat: check WASD first, then arrows
  consumeAny(): Direction | null {
    return this.p1Queue.shift() ?? this.p2Queue.shift() ?? null;
  }

  destroy() {
    window.removeEventListener('keydown', this.bound);
  }
}
