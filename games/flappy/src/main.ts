import Phaser from "phaser";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const WIDTH = 360;
const HEIGHT = 640;
const GRAVITY = 1400;
const FLAP_VELOCITY = -400;
const PIPE_SPEED = 190;
const PIPE_GAP = 160;
const PIPE_INTERVAL = 1700;
const PIPE_WIDTH = 56;
const GROUND_H = 70;
const BEST_KEY = "flappy_best";

// ---------------------------------------------------------------------------
// Bird (shrimp) — pure data, no rendering
// ---------------------------------------------------------------------------
class Bird {
  x: number;
  y: number;
  vy: number = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  flap(): void {
    this.vy = FLAP_VELOCITY;
  }

  update(dt: number): void {
    this.vy += GRAVITY * dt;
    this.y += this.vy * dt;
  }

  /** Visual rotation angle in degrees */
  get angle(): number {
    return Phaser.Math.Clamp(this.vy * 0.055, -25, 85);
  }

  /** Tight hitbox rectangle */
  getBounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.x - 14, this.y - 10, 28, 20);
  }
}

// ---------------------------------------------------------------------------
// Pipe pair data
// ---------------------------------------------------------------------------
interface PipePair {
  x: number;
  gapY: number;
  scored: boolean;
  topWhale: Phaser.GameObjects.Text;
  botWhale: Phaser.GameObjects.Text;
}

// ---------------------------------------------------------------------------
// BootScene
// ---------------------------------------------------------------------------
class BootScene extends Phaser.Scene {
  constructor() { super("BootScene"); }
  create(): void { this.scene.start("GameScene"); }
}

// ---------------------------------------------------------------------------
// GameScene
// ---------------------------------------------------------------------------
type GameState = "idle" | "playing" | "dead";

class GameScene extends Phaser.Scene {
  private bird!: Bird;
  private shrimpObj!: Phaser.GameObjects.Text;
  private pipes: PipePair[] = [];
  private bg!: Phaser.GameObjects.Graphics;
  private pipesGfx!: Phaser.GameObjects.Graphics;
  private ground!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private backBtn!: Phaser.GameObjects.Text;
  private pipeTimer!: Phaser.Time.TimerEvent;
  private score: number = 0;
  private best: number = 0;
  private state: GameState = "idle";
  private deathTimer: number = 0;

  constructor() { super("GameScene"); }

  create(): void {
    this.score = 0;
    this.pipes = [];
    this.state = "idle";
    this.deathTimer = 0;
    this.best = parseInt(localStorage.getItem(BEST_KEY) ?? "0", 10);

    this.bird = new Bird(WIDTH * 0.28, HEIGHT * 0.44);

    // ── Background (drawn once, static) ──────────────────────────────────
    this.bg = this.add.graphics();
    this.drawBackground();

    // ── Pipe bodies (redrawn each frame) ─────────────────────────────────
    this.pipesGfx = this.add.graphics().setDepth(2);

    // ── Ground (drawn once, static, on top of pipes) ──────────────────────
    this.ground = this.add.graphics().setDepth(4);
    this.drawGround();

    // ── Shrimp 🦐 ─────────────────────────────────────────────────────────
    this.shrimpObj = this.add.text(this.bird.x, this.bird.y, "🦐", {
      fontSize: "32px",
    })
      .setOrigin(0.5)
      .setDepth(5)
      .setScale(-1, 1); // flip to face right

    // ── HUD ──────────────────────────────────────────────────────────────
    this.scoreText = this.add.text(WIDTH / 2, 44, "0", {
      fontFamily: "'Press Start 2P'",
      fontSize: "30px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 5,
    }).setOrigin(0.5, 0).setDepth(10);

    this.promptText = this.add.text(WIDTH / 2, HEIGHT * 0.63, "TAP TO SWIM", {
      fontFamily: "'Press Start 2P'",
      fontSize: "12px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);

    this.tweens.add({
      targets: this.promptText,
      alpha: { from: 1, to: 0.1 },
      duration: 550,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.backBtn = this.add.text(12, 12, "< ARCADE", {
      fontFamily: "'Press Start 2P'",
      fontSize: "9px",
      color: "#4a9fd4",
    }).setOrigin(0, 0).setDepth(10).setInteractive({ useHandCursor: true });

    this.backBtn.on("pointerover", () => this.backBtn.setColor("#a0d4f5"));
    this.backBtn.on("pointerout",  () => this.backBtn.setColor("#4a9fd4"));
    this.backBtn.on("pointerup",   () => { window.location.href = "/"; });

    // ── Input ─────────────────────────────────────────────────────────────
    this.input.on("pointerdown", () => this.handleFlap());
    this.input.keyboard!.on("keydown-SPACE", () => this.handleFlap());

    // ── Pipe spawn timer ──────────────────────────────────────────────────
    this.pipeTimer = this.time.addEvent({
      delay: PIPE_INTERVAL,
      callback: this.spawnPipe,
      callbackScope: this,
      loop: true,
      paused: true,
    });
  }

  private handleFlap(): void {
    if (this.state === "dead") return;

    if (this.state === "idle") {
      this.state = "playing";
      this.promptText.setVisible(false);
      this.pipeTimer.paused = false;
      this.spawnPipe();
    }

    this.bird.flap();
    // Small shrimp squish on flap
    this.tweens.add({
      targets: this.shrimpObj,
      scaleX: { from: -1.3, to: -1 },
      scaleY: { from: 0.75, to: 1 },
      duration: 160,
      ease: "Back.easeOut",
    });
  }

  private spawnPipe(): void {
    const minGapY = PIPE_GAP / 2 + 50;
    const maxGapY = HEIGHT - GROUND_H - PIPE_GAP / 2 - 50;
    const gapY = Phaser.Math.Between(minGapY, maxGapY);
    const x = WIDTH + PIPE_WIDTH / 2 + 10;

    // Top whale (upside-down, sits at bottom of top pipe)
    const topWhale = this.add.text(x, gapY - PIPE_GAP / 2, "🐋", {
      fontSize: "40px",
    })
      .setOrigin(0.5, 1)
      .setAngle(180)
      .setDepth(3);

    // Bottom whale (normal, sits at top of bottom pipe)
    const botWhale = this.add.text(x, gapY + PIPE_GAP / 2, "🐋", {
      fontSize: "40px",
    })
      .setOrigin(0.5, 0)
      .setDepth(3);

    this.pipes.push({ x, gapY, scored: false, topWhale, botWhale });
  }

  update(time: number, delta: number): void {
    const dt = delta / 1000;

    if (this.state === "idle") {
      // Gentle bob
      this.bird.y = HEIGHT * 0.44 + Math.sin(time / 550) * 9;
      this.shrimpObj.setPosition(this.bird.x, this.bird.y);
      return;
    }

    if (this.state === "dead") {
      this.bird.vy += GRAVITY * dt * 1.2;
      this.bird.y += this.bird.vy * dt;
      this.shrimpObj.setPosition(this.bird.x, this.bird.y).setAngle(90);
      this.deathTimer += delta;
      this.redrawPipes();
      if (this.deathTimer > 900) {
        this.cleanupPipes();
        this.scene.start("GameOverScene", { score: this.score, best: this.best });
      }
      return;
    }

    // ── playing ──────────────────────────────────────────────────────────
    this.bird.update(dt);

    // Sync shrimp sprite
    this.shrimpObj
      .setPosition(this.bird.x, this.bird.y)
      .setAngle(this.bird.angle);

    // Scroll pipes
    for (const pipe of this.pipes) {
      pipe.x -= PIPE_SPEED * dt;
      pipe.topWhale.setX(pipe.x);
      pipe.botWhale.setX(pipe.x);
    }

    // Score
    for (const pipe of this.pipes) {
      if (!pipe.scored && pipe.x < this.bird.x) {
        pipe.scored = true;
        this.score++;
        this.scoreText.setText(String(this.score));
        this.cameras.main.flash(70, 255, 255, 255, true);
        this.tweens.add({
          targets: this.scoreText,
          scaleX: { from: 1.3, to: 1 },
          scaleY: { from: 1.3, to: 1 },
          duration: 180,
          ease: "Back.easeOut",
        });
      }
    }

    // Remove off-screen pipes
    this.pipes = this.pipes.filter(pipe => {
      if (pipe.x < -PIPE_WIDTH - 50) {
        pipe.topWhale.destroy();
        pipe.botWhale.destroy();
        return false;
      }
      return true;
    });

    // ── Collision: ground ────────────────────────────────────────────────
    if (this.bird.y + 14 >= HEIGHT - GROUND_H) {
      this.die();
      return;
    }

    // ── Collision: ceiling ───────────────────────────────────────────────
    if (this.bird.y - 14 <= 0) {
      this.die();
      return;
    }

    // ── Collision: pipe bodies ───────────────────────────────────────────
    const birdBounds = this.bird.getBounds();
    for (const pipe of this.pipes) {
      const half = PIPE_WIDTH / 2;
      const topRect = new Phaser.Geom.Rectangle(
        pipe.x - half, 0, PIPE_WIDTH, pipe.gapY - PIPE_GAP / 2,
      );
      const botRect = new Phaser.Geom.Rectangle(
        pipe.x - half, pipe.gapY + PIPE_GAP / 2, PIPE_WIDTH, HEIGHT,
      );
      if (
        Phaser.Geom.Intersects.RectangleToRectangle(birdBounds, topRect) ||
        Phaser.Geom.Intersects.RectangleToRectangle(birdBounds, botRect)
      ) {
        this.die();
        return;
      }
    }

    this.redrawPipes();
  }

  private die(): void {
    this.state = "dead";
    this.deathTimer = 0;
    this.pipeTimer.paused = true;
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(BEST_KEY, String(this.best));
    }
    this.cameras.main.flash(280, 255, 30, 30, true);
  }

  private redrawPipes(): void {
    const g = this.pipesGfx;
    g.clear();

    for (const pipe of this.pipes) {
      const half = PIPE_WIDTH / 2;

      // Top pipe body
      const topH = pipe.gapY - PIPE_GAP / 2;
      g.fillStyle(0x0c2a4a, 1);
      g.fillRect(pipe.x - half, 0, PIPE_WIDTH, topH);
      // subtle highlight
      g.fillStyle(0x1a4a7a, 1);
      g.fillRect(pipe.x - half, 0, 5, topH);

      // Bottom pipe body
      const botY = pipe.gapY + PIPE_GAP / 2;
      g.fillStyle(0x0c2a4a, 1);
      g.fillRect(pipe.x - half, botY, PIPE_WIDTH, HEIGHT - botY);
      g.fillStyle(0x1a4a7a, 1);
      g.fillRect(pipe.x - half, botY, 5, HEIGHT - botY);
    }
  }

  private drawBackground(): void {
    const g = this.bg;
    // Deep ocean gradient (approximated with bands)
    const bands = [
      [0, 0x0a1628],
      [0.25, 0x0d1f3c],
      [0.5, 0x0f2847],
      [0.75, 0x112f52],
    ];
    const bandH = HEIGHT / bands.length;
    bands.forEach(([, color], i) => {
      g.fillStyle(color as number, 1);
      g.fillRect(0, i * bandH, WIDTH, bandH + 2);
    });

    // Subtle bubble particles (static decorative dots)
    g.fillStyle(0x1e4a7a, 0.4);
    const bubblePositions = [
      [30, 120], [80, 280], [140, 180], [200, 420], [260, 90],
      [310, 350], [50, 500], [180, 560], [290, 200], [120, 460],
    ];
    for (const [bx, by] of bubblePositions) {
      g.fillCircle(bx, by, 3);
    }
  }

  private drawGround(): void {
    const g = this.ground;
    // Ocean floor
    g.fillStyle(0x0a1e35, 1);
    g.fillRect(0, HEIGHT - GROUND_H, WIDTH, GROUND_H);
    // Sandy/rocky top strip
    g.fillStyle(0x1a3a5c, 1);
    g.fillRect(0, HEIGHT - GROUND_H, WIDTH, 6);
    // Seaweed hints
    g.fillStyle(0x0d4a2a, 1);
    const seaweedX = [40, 100, 180, 240, 310];
    for (const sx of seaweedX) {
      g.fillRect(sx, HEIGHT - GROUND_H - 14, 5, 14);
      g.fillRect(sx + 2, HEIGHT - GROUND_H - 22, 5, 10);
    }
  }

  private cleanupPipes(): void {
    for (const pipe of this.pipes) {
      pipe.topWhale.destroy();
      pipe.botWhale.destroy();
    }
    this.pipes = [];
  }
}

// ---------------------------------------------------------------------------
// GameOverScene
// ---------------------------------------------------------------------------
class GameOverScene extends Phaser.Scene {
  constructor() { super("GameOverScene"); }

  create(data: { score: number; best: number }): void {
    const cx = WIDTH / 2;
    const cy = HEIGHT / 2;

    // Dark overlay
    this.add.rectangle(cx, cy, WIDTH, HEIGHT, 0x000000, 0.65);

    // Panel
    this.add.rectangle(cx, cy - 10, 290, 240, 0x071525, 1)
      .setStrokeStyle(2, 0x1a4a7a);

    this.add.text(cx, cy - 100, "WASHED UP", {
      fontFamily: "'Press Start 2P'",
      fontSize: "16px",
      color: "#ef4444",
      stroke: "#000",
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(cx, cy - 55, "SCORE", {
      fontFamily: "'Press Start 2P'",
      fontSize: "8px",
      color: "#7fb3d3",
    }).setOrigin(0.5);

    this.add.text(cx, cy - 28, String(data.score), {
      fontFamily: "'Press Start 2P'",
      fontSize: "36px",
      color: "#ffffff",
      stroke: "#000",
      strokeThickness: 4,
    }).setOrigin(0.5);

    const isNewBest = data.score > 0 && data.score >= data.best;

    this.add.text(cx, cy + 30, `BEST: ${data.best}`, {
      fontFamily: "'Press Start 2P'",
      fontSize: "10px",
      color: isNewBest ? "#22c55e" : "#fde047",
    }).setOrigin(0.5);

    if (isNewBest) {
      this.add.text(cx, cy + 56, "NEW RECORD! 🦐", {
        fontFamily: "'Press Start 2P'",
        fontSize: "8px",
        color: "#22c55e",
      }).setOrigin(0.5);
    }

    // Play Again button
    const playBtn = this.add.text(cx, cy + 90, "SWIM AGAIN", {
      fontFamily: "'Press Start 2P'",
      fontSize: "12px",
      color: "#38bdf8",
      backgroundColor: "#071525",
      padding: { x: 16, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    playBtn.on("pointerover", () => playBtn.setColor("#ffffff"));
    playBtn.on("pointerout",  () => playBtn.setColor("#38bdf8"));
    playBtn.on("pointerup",   () => this.scene.start("GameScene"));

    const backBtn = this.add.text(cx, cy + 140, "< BACK TO ARCADE", {
      fontFamily: "'Press Start 2P'",
      fontSize: "8px",
      color: "#4a6a8a",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    backBtn.on("pointerover", () => backBtn.setColor("#7fb3d3"));
    backBtn.on("pointerout",  () => backBtn.setColor("#4a6a8a"));
    backBtn.on("pointerup",   () => { window.location.href = "/"; });

    this.input.keyboard!.once("keydown-SPACE", () => this.scene.start("GameScene"));
    this.input.once("pointerdown", () => this.scene.start("GameScene"));
  }
}

// ---------------------------------------------------------------------------
// Game config
// ---------------------------------------------------------------------------
new Phaser.Game({
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: "#0a1628",
  scene: [BootScene, GameScene, GameOverScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});
