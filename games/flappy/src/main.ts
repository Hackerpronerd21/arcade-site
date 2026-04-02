import Phaser from "phaser";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const WIDTH = 360;
const HEIGHT = 640;
const GRAVITY = 1400;
const FLAP_VELOCITY = -420;
const PIPE_SPEED = 200;
const PIPE_GAP = 155;
const PIPE_INTERVAL = 1600;    // ms between pipe spawns
const PIPE_WIDTH = 52;
const GROUND_H = 80;
const BIRD_W = 34;
const BIRD_H = 26;
const BEST_KEY = "flappy_best";

// Colors
const COL_SKY_TOP = 0x1a1a2e;
const COL_SKY_BOT = 0x16213e;
const COL_PIPE = 0x22c55e;
const COL_PIPE_CAP = 0x16a34a;
const COL_BIRD = 0xfde047;
const COL_BIRD_WING = 0xfbbf24;
const COL_GROUND = 0x15803d;
const COL_GROUND_TOP = 0x166534;

// ---------------------------------------------------------------------------
// Bird class
// ---------------------------------------------------------------------------
class Bird {
  x: number;
  y: number;
  vy: number = 0;
  angle: number = 0;
  alive: boolean = true;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  flap(): void {
    this.vy = FLAP_VELOCITY;
  }

  update(dt: number, gravity: number): void {
    this.vy += gravity * dt;
    this.y += this.vy * dt;
    // Rotate based on velocity: nose-down when falling, nose-up when flapping
    this.angle = Phaser.Math.Clamp(this.vy * 0.06, -30, 90);
  }

  getBounds(): Phaser.Geom.Rectangle {
    // Slightly smaller than visual for forgiving hitbox
    return new Phaser.Geom.Rectangle(
      this.x - BIRD_W / 2 + 4,
      this.y - BIRD_H / 2 + 4,
      BIRD_W - 8,
      BIRD_H - 8,
    );
  }
}

// ---------------------------------------------------------------------------
// Pipe pair data
// ---------------------------------------------------------------------------
interface PipePair {
  x: number;
  gapY: number;   // center Y of the gap
  scored: boolean;
}

// ---------------------------------------------------------------------------
// BootScene
// ---------------------------------------------------------------------------
class BootScene extends Phaser.Scene {
  constructor() { super("BootScene"); }

  create(): void {
    this.scene.start("GameScene");
  }
}

// ---------------------------------------------------------------------------
// GameScene
// ---------------------------------------------------------------------------
type GameState = "idle" | "playing" | "dead";

class GameScene extends Phaser.Scene {
  private bird!: Bird;
  private pipes: PipePair[] = [];
  private gfx!: Phaser.GameObjects.Graphics;
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

    this.bird = new Bird(WIDTH * 0.3, HEIGHT * 0.45);

    this.gfx = this.add.graphics();

    // Score display
    this.scoreText = this.add.text(WIDTH / 2, 48, "0", {
      fontFamily: "'Press Start 2P'",
      fontSize: "28px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 4,
    }).setOrigin(0.5, 0).setDepth(10);

    // Tap-to-start prompt
    this.promptText = this.add.text(WIDTH / 2, HEIGHT * 0.62, "TAP TO FLAP", {
      fontFamily: "'Press Start 2P'",
      fontSize: "13px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);

    // Blink tween
    this.tweens.add({
      targets: this.promptText,
      alpha: { from: 1, to: 0 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Back button
    this.backBtn = this.add.text(12, 12, "< ARCADE", {
      fontFamily: "'Press Start 2P'",
      fontSize: "10px",
      color: "#555555",
    }).setOrigin(0, 0).setDepth(10).setInteractive({ useHandCursor: true });

    this.backBtn.on("pointerover", () => this.backBtn.setColor("#aaaaaa"));
    this.backBtn.on("pointerout",  () => this.backBtn.setColor("#555555"));
    this.backBtn.on("pointerup",   () => { window.location.href = "/"; });

    // Input — space, pointer, or any key
    this.input.on("pointerdown", () => this.handleFlap());
    this.input.keyboard!.on("keydown-SPACE", () => this.handleFlap());

    // Pipe spawn timer (only runs during play)
    this.pipeTimer = this.time.addEvent({
      delay: PIPE_INTERVAL,
      callback: this.spawnPipe,
      callbackScope: this,
      loop: true,
      paused: true,
    });

    this.draw();
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
  }

  private spawnPipe(): void {
    const minGapY = PIPE_GAP / 2 + 40;
    const maxGapY = HEIGHT - GROUND_H - PIPE_GAP / 2 - 40;
    const gapY = Phaser.Math.Between(minGapY, maxGapY);
    this.pipes.push({ x: WIDTH + PIPE_WIDTH / 2, gapY, scored: false });
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;

    if (this.state === "idle") {
      // Gentle hover in idle
      this.bird.y = HEIGHT * 0.45 + Math.sin((_time / 600)) * 8;
      this.draw();
      return;
    }

    if (this.state === "dead") {
      // Bird falls off screen after death
      this.bird.vy += GRAVITY * dt;
      this.bird.y += this.bird.vy * dt;
      this.bird.angle = 90;
      this.deathTimer += delta;
      this.draw();

      if (this.deathTimer > 900) {
        this.scene.start("GameOverScene", { score: this.score, best: this.best });
      }
      return;
    }

    // --- playing ---
    this.bird.update(dt, GRAVITY);

    // Scroll pipes
    for (const pipe of this.pipes) {
      pipe.x -= PIPE_SPEED * dt;
    }
    // Remove off-screen pipes
    this.pipes = this.pipes.filter(p => p.x > -PIPE_WIDTH);

    // Score: passed a pipe
    for (const pipe of this.pipes) {
      if (!pipe.scored && pipe.x < this.bird.x) {
        pipe.scored = true;
        this.score++;
        this.scoreText.setText(String(this.score));
        // Quick white flash on score
        this.cameras.main.flash(80, 255, 255, 255, true);
      }
    }

    // Collision: ground
    if (this.bird.y + BIRD_H / 2 >= HEIGHT - GROUND_H) {
      this.bird.y = HEIGHT - GROUND_H - BIRD_H / 2;
      this.die();
      return;
    }

    // Collision: ceiling
    if (this.bird.y - BIRD_H / 2 <= 0) {
      this.die();
      return;
    }

    // Collision: pipes
    const birdBounds = this.bird.getBounds();
    for (const pipe of this.pipes) {
      const topPipeRect = new Phaser.Geom.Rectangle(
        pipe.x - PIPE_WIDTH / 2, 0,
        PIPE_WIDTH, pipe.gapY - PIPE_GAP / 2,
      );
      const botPipeRect = new Phaser.Geom.Rectangle(
        pipe.x - PIPE_WIDTH / 2, pipe.gapY + PIPE_GAP / 2,
        PIPE_WIDTH, HEIGHT,
      );
      if (
        Phaser.Geom.Intersects.RectangleToRectangle(birdBounds, topPipeRect) ||
        Phaser.Geom.Intersects.RectangleToRectangle(birdBounds, botPipeRect)
      ) {
        this.die();
        return;
      }
    }

    this.draw();
  }

  private die(): void {
    this.state = "dead";
    this.deathTimer = 0;
    this.pipeTimer.paused = true;
    this.bird.alive = false;

    // Save best
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(BEST_KEY, String(this.best));
    }

    // Red screen flash
    this.cameras.main.flash(250, 255, 0, 0, true);
  }

  private draw(): void {
    const g = this.gfx;
    g.clear();

    // Sky gradient (two rects approximating a gradient)
    g.fillStyle(COL_SKY_TOP);
    g.fillRect(0, 0, WIDTH, HEIGHT / 2);
    g.fillStyle(COL_SKY_BOT);
    g.fillRect(0, HEIGHT / 2, WIDTH, HEIGHT / 2);

    // Pipes
    for (const pipe of this.pipes) {
      this.drawPipe(pipe);
    }

    // Ground
    g.fillStyle(COL_GROUND);
    g.fillRect(0, HEIGHT - GROUND_H, WIDTH, GROUND_H);
    g.fillStyle(COL_GROUND_TOP);
    g.fillRect(0, HEIGHT - GROUND_H, WIDTH, 6);

    // Bird
    this.drawBird();
  }

  private drawPipe(pipe: PipePair): void {
    const g = this.gfx;
    const capH = 18;
    const capW = PIPE_WIDTH + 8;
    const x = pipe.x;

    // Top pipe body
    const topH = pipe.gapY - PIPE_GAP / 2;
    g.fillStyle(COL_PIPE);
    g.fillRect(x - PIPE_WIDTH / 2, 0, PIPE_WIDTH, topH - capH);
    // Top pipe cap
    g.fillStyle(COL_PIPE_CAP);
    g.fillRect(x - capW / 2, topH - capH, capW, capH);

    // Bottom pipe body
    const botY = pipe.gapY + PIPE_GAP / 2;
    g.fillStyle(COL_PIPE);
    g.fillRect(x - PIPE_WIDTH / 2, botY + capH, PIPE_WIDTH, HEIGHT - botY - capH);
    // Bottom pipe cap
    g.fillStyle(COL_PIPE_CAP);
    g.fillRect(x - capW / 2, botY, capW, capH);
  }

  private drawBird(): void {
    const g = this.gfx;
    const { x, y, angle } = this.bird;
    const rad = Phaser.Math.DegToRad(angle);

    g.save();
    // Translate to bird center, rotate, translate back
    const matrix = new Phaser.GameObjects.Components.TransformMatrix();
    matrix.translate(x, y);
    matrix.rotate(rad);

    g.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.tx, matrix.ty);

    // Body
    g.fillStyle(COL_BIRD);
    g.fillEllipse(0, 0, BIRD_W, BIRD_H);

    // Wing (lower when flapping up, higher when falling)
    const wingOffset = this.bird.vy < 0 ? -6 : 4;
    g.fillStyle(COL_BIRD_WING);
    g.fillEllipse(-4, wingOffset, 18, 10);

    // Eye
    g.fillStyle(0xffffff);
    g.fillCircle(10, -5, 6);
    g.fillStyle(0x1e1e1e);
    g.fillCircle(12, -5, 3);

    // Beak
    g.fillStyle(0xf97316);
    g.fillTriangle(16, -2, 24, 1, 16, 4);

    g.restore();
  }
}

// ---------------------------------------------------------------------------
// GameOverScene
// ---------------------------------------------------------------------------
class GameOverScene extends Phaser.Scene {
  constructor() { super("GameOverScene"); }

  create(data: { score: number; best: number }): void {
    const cx = WIDTH / 2;

    // Dark overlay
    this.add.rectangle(cx, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.6);

    // Panel
    const panelY = HEIGHT * 0.42;
    this.add.rectangle(cx, panelY, 280, 220, 0x111827, 0.95)
      .setStrokeStyle(2, 0x374151);

    this.add.text(cx, panelY - 80, "GAME OVER", {
      fontFamily: "'Press Start 2P'",
      fontSize: "18px",
      color: "#ef4444",
    }).setOrigin(0.5);

    this.add.text(cx, panelY - 30, `SCORE`, {
      fontFamily: "'Press Start 2P'",
      fontSize: "9px",
      color: "#9ca3af",
    }).setOrigin(0.5);

    this.add.text(cx, panelY, String(data.score), {
      fontFamily: "'Press Start 2P'",
      fontSize: "32px",
      color: "#ffffff",
    }).setOrigin(0.5);

    this.add.text(cx, panelY + 50, `BEST: ${data.best}`, {
      fontFamily: "'Press Start 2P'",
      fontSize: "10px",
      color: "#fde047",
    }).setOrigin(0.5);

    // New best badge
    if (data.score > 0 && data.score >= data.best) {
      this.add.text(cx + 60, panelY - 5, "NEW!", {
        fontFamily: "'Press Start 2P'",
        fontSize: "8px",
        color: "#22c55e",
      }).setOrigin(0.5);
    }

    // Play Again
    const playBtn = this.add.text(cx, panelY + 100, "PLAY AGAIN", {
      fontFamily: "'Press Start 2P'",
      fontSize: "13px",
      color: "#22c55e",
      backgroundColor: "#111",
      padding: { x: 16, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    playBtn.on("pointerover", () => playBtn.setColor("#ffffff"));
    playBtn.on("pointerout",  () => playBtn.setColor("#22c55e"));
    playBtn.on("pointerup",   () => this.scene.start("GameScene"));

    // Back to arcade
    const backBtn = this.add.text(cx, panelY + 160, "< BACK TO ARCADE", {
      fontFamily: "'Press Start 2P'",
      fontSize: "9px",
      color: "#555",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    backBtn.on("pointerover", () => backBtn.setColor("#aaa"));
    backBtn.on("pointerout",  () => backBtn.setColor("#555"));
    backBtn.on("pointerup",   () => { window.location.href = "/"; });

    // Space to replay
    this.input.keyboard!.once("keydown-SPACE", () => this.scene.start("GameScene"));
  }
}

// ---------------------------------------------------------------------------
// Game config
// ---------------------------------------------------------------------------
new Phaser.Game({
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: "#1a1a2e",
  scene: [BootScene, GameScene, GameOverScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});
