export const COLS = 80;
export const ROWS = 60;
export const CELL = 10;

export class Arena {
  grid: Uint8Array;

  constructor() {
    this.grid = new Uint8Array(COLS * ROWS);
    this.reset();
  }

  reset() {
    this.grid.fill(0);
    for (let x = 0; x < COLS; x++) {
      this.grid[x] = 3;
      this.grid[(ROWS - 1) * COLS + x] = 3;
    }
    for (let y = 0; y < ROWS; y++) {
      this.grid[y * COLS] = 3;
      this.grid[y * COLS + (COLS - 1)] = 3;
    }
  }

  at(x: number, y: number): number {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return 3;
    return this.grid[y * COLS + x];
  }

  set(x: number, y: number, v: number) {
    if (x >= 0 && x < COLS && y >= 0 && y < ROWS) {
      this.grid[y * COLS + x] = v;
    }
  }

  isOccupied(x: number, y: number): boolean {
    return this.at(x, y) !== 0;
  }

  toArray(): number[] {
    return Array.from(this.grid);
  }

  fromArray(arr: number[]) {
    for (let i = 0; i < arr.length && i < this.grid.length; i++) {
      this.grid[i] = arr[i];
    }
  }
}
