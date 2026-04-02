import Phaser from "phaser";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CELL = 20;         // px per grid cell
const COLS = 40;         // 800 / 20
const ROWS = 30;         // 600 / 20
const WIDTH = COLS * CELL;   // 800
const HEIGHT = ROWS * CELL;  // 600
const BASE_TICK = 150;   // ms between moves at start
const MIN_TICK = 60;     // fastest possible tick
const SPEED_EVERY = 5;   // foods eaten before speed bump

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Point { x: number; y: number; }
type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

// ---------------------------------------------------------------------------
// Snake class — tracks grid coordinates only, no physics bodies
// ---------------------------------------------------------------------------
class Snake {
  body: Point[];
  direction: Direction;
  nextDirection: Direction;
  growing: boolean;

  constructor(startX: number, startY: number) {
    this.body = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
    ];
    this.direction = "RIGHT";
    this.nextDirection = "RIGHT";
    this.growing = false;
  }

  setDirection(dir: Direction): void {
    const opposites: Record<Direction, Direction> = {
      UP: "DOWN", DOWN: "UP", LEFT: "RIGHT", RIGHT: "LEFT",
    };
    if (dir !== opposites[this.direction]) {
      this.nextDirection = dir;
    }
  }

  move(): void {
    this.direction = this.nextDirection;
    const head = this.body[0];
    const deltas: Record<Direction, Point> = {
      UP:    { x: 0,  y: -1 },
      DOWN:  { x: 0,  y:  1 },
      LEFT:  { x: -1, y:  0 },
      RIGHT: { x:  1, y:  0 },
    };
    const d = deltas[this.direction];
    const newHead: Point = { x: head.x + d.x, y: head.y + d.y };
    this.body.unshift(newHead);
    if (!this.growing) {
      this.body.pop();
    } else {
      this.growing = false;
    }
  }

  grow(): void {
    this.growing = true;
  }

  get head(): Point { return this.body[0]; }

  hitsWall(): boolean {
    const h = this.head;
    return h.x < 0 || h.x >= COLS || h.y < 0 || h.y >= ROWS;
  }

  hitsItself(): boolean {
    const h = this.head;
    return this.body.slice(1).some(s => s.x === h.x && s.y === h.y);
  }

  occupies(p: Point): boolean {
    return this.body.some(s => s.x === p.x && s.y === p.y);
  }
}

// ---------------------------------------------------------------------------
// Food class
// ---------------------------------------------------------------------------
class Food {
  pos: Point;

  constructor() {
    this.pos = { x: 0, y: 0 };
  }

  respawn(snake: Snake): void {
    let p: Point;
    do {
      p = {
        x: Phaser.Math.Between(0, COLS - 1),
        y: Phaser.Math.Between(0, ROWS - 1),
      };
    } while (snake.occupies(p));
    this.pos = p;
  }
}

// ---------------------------------------------------------------------------
// BootScene
// ---------------------------------------------------------------------------
class BootScene extends Phaser.Scene {
  constructor() { super("BootScene"); }

  create(): void {
    this.scale.scaleMode = Phaser.Scale.FIT;
    this.scale.autoCenter = Phaser.Scale.CENTER_BOTH;
    this.scene.start("GameScene");
  }
}

// ---------------------------------------------------------------------------
// GameScene
// ---------------------------------------------------------------------------
class GameScene extends Phaser.Scene {
  private snake!: Snake;
  private food!: Food;
  private gfx!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private backBtn!: Phaser.GameObjects.Text;
  private moveTimer!: Phaser.Time.TimerEvent;
  private score: number = 0;
  private foodEaten: number = 0;
  private tickDelay: number = BASE_TICK;
  private flashRect!: Phaser.GameObjects.Rectangle;

  constructor() { super("GameScene"); }

  create(): void {
    this.score = 0;
    this.foodEaten = 0;
    this.tickDelay = BASE_TICK;

    this.snake = new Snake(10, 10);
    this.food = new Food();
    this.food.respawn(this.snake);

    // Graphics layer for snake + food
    this.gfx = this.add.graphics();

    // Score
    this.scoreText = this.add.text(WIDTH - 12, 12, "0", {
      fontFamily: "'Press Start 2P'",
      fontSize: "14px",
      color: "#ffffff",
    }).setOrigin(1, 0);

    // Back button
    this.backBtn = this.add.text(12, 12, "< ARCADE", {
      fontFamily: "'Press Start 2P'",
      fontSize: "10px",
      color: "#555555",
    }).setOrigin(0, 0).setInteractive({ useHandCursor: true });

    this.backBtn.on("pointerover", () => this.backBtn.setColor("#aaaaaa"));
    this.backBtn.on("pointerout",  () => this.backBtn.setColor("#555555"));
    this.backBtn.on("pointerup",   () => { window.location.href = "/"; });

    // Screen-flash overlay (transparent, used for food-eat flash)
    this.flashRect = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x39ff14, 0)
      .setDepth(10);

    // Input
    this.input.keyboard!.on("keydown", (e: KeyboardEvent) => {
      switch (e.code) {
        case "ArrowUp":    case "KeyW": this.snake.setDirection("UP");    break;
        case "ArrowDown":  case "KeyS": this.snake.setDirection("DOWN");  break;
        case "ArrowLeft":  case "KeyA": this.snake.setDirection("LEFT");  break;
        case "ArrowRight": case "KeyD": this.snake.setDirection("RIGHT"); break;
      }
    });

    // Movement timer
    this.moveTimer = this.time.addEvent({
      delay: this.tickDelay,
      callback: this.tick,
      callbackScope: this,
      loop: true,
    });
  }

  private tick(): void {
    this.snake.move();

    if (this.snake.hitsWall() || this.snake.hitsItself()) {
      this.moveTimer.remove();
      this.cameras.main.flash(300, 255, 0, 0, true);
      this.time.delayedCall(350, () => {
        this.scene.start("GameOverScene", { score: this.score });
      });
      return;
    }

    // Check food
    if (this.snake.head.x === this.food.pos.x && this.snake.head.y === this.food.pos.y) {
      this.snake.grow();
      this.score += 10;
      this.foodEaten++;
      this.scoreText.setText(String(this.score));
      this.food.respawn(this.snake);

      // Green flash
      this.tweens.add({
        targets: this.flashRect,
        alpha: { from: 0.15, to: 0 },
        duration: 120,
        ease: "Quad.easeOut",
      });

      // Speed up every N foods
      if (this.foodEaten % SPEED_EVERY === 0) {
        this.tickDelay = Math.max(MIN_TICK, this.tickDelay - 10);
        this.moveTimer.reset({
          delay: this.tickDelay,
          callback: this.tick,
          callbackScope: this,
          loop: true,
        });
      }
    }

    this.draw();
  }

  private draw(): void {
    this.gfx.clear();

    // Grid (subtle)
    this.gfx.lineStyle(1, 0x1a1a1a, 1);
    for (let x = 0; x <= COLS; x++) {
      this.gfx.lineBetween(x * CELL, 0, x * CELL, HEIGHT);
    }
    for (let y = 0; y <= ROWS; y++) {
      this.gfx.lineBetween(0, y * CELL, WIDTH, y * CELL);
    }

    // Snake body
    this.snake.body.forEach((seg, i) => {
      const brightness = i === 0 ? 0x39ff14 : 0x22cc0a;
      this.gfx.fillStyle(brightness, 1);
      this.gfx.fillRect(
        seg.x * CELL + 1,
        seg.y * CELL + 1,
        CELL - 2,
        CELL - 2,
      );
    });

    // Food (circle)
    this.gfx.fillStyle(0xff4444, 1);
    const fx = this.food.pos.x * CELL + CELL / 2;
    const fy = this.food.pos.y * CELL + CELL / 2;
    this.gfx.fillCircle(fx, fy, CELL / 2 - 2);
  }
}

// ---------------------------------------------------------------------------
// GameOverScene
// ---------------------------------------------------------------------------
class GameOverScene extends Phaser.Scene {
  constructor() { super("GameOverScene"); }

  create(data: { score: number }): void {
    const cx = WIDTH / 2;
    const cy = HEIGHT / 2;

    // Dim background
    this.add.rectangle(cx, cy, WIDTH, HEIGHT, 0x000000, 0.75);

    this.add.text(cx, cy - 70, "GAME OVER", {
      fontFamily: "'Press Start 2P'",
      fontSize: "28px",
      color: "#ff4444",
    }).setOrigin(0.5);

    this.add.text(cx, cy - 10, `SCORE: ${data.score}`, {
      fontFamily: "'Press Start 2P'",
      fontSize: "16px",
      color: "#ffffff",
    }).setOrigin(0.5);

    // Play Again button
    const playBtn = this.add.text(cx, cy + 60, "PLAY AGAIN", {
      fontFamily: "'Press Start 2P'",
      fontSize: "14px",
      color: "#39ff14",
      backgroundColor: "#111",
      padding: { x: 16, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    playBtn.on("pointerover", () => playBtn.setColor("#ffffff"));
    playBtn.on("pointerout",  () => playBtn.setColor("#39ff14"));
    playBtn.on("pointerup",   () => this.scene.start("GameScene"));

    // Back button
    const backBtn = this.add.text(cx, cy + 120, "< BACK TO ARCADE", {
      fontFamily: "'Press Start 2P'",
      fontSize: "10px",
      color: "#555",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    backBtn.on("pointerover", () => backBtn.setColor("#aaa"));
    backBtn.on("pointerout",  () => backBtn.setColor("#555"));
    backBtn.on("pointerup",   () => { window.location.href = "/"; });

    // Color pulse on game over text
    this.tweens.add({
      targets: this.add.rectangle(cx, cy, WIDTH, HEIGHT, 0xff0000, 0),
      alpha: { from: 0.2, to: 0 },
      duration: 600,
      ease: "Quad.easeOut",
    });
  }
}

// ---------------------------------------------------------------------------
// Phaser game config
// ---------------------------------------------------------------------------
new Phaser.Game({
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: "#0d0d0d",
  scene: [BootScene, GameScene, GameOverScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});
