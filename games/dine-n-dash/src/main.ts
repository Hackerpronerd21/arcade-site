import Phaser from "phaser";

// ─── Constants ───────────────────────────────────────────────────────────────
const W = 480;
const H = 640;
const ROT_SPEED = 3.2;         // rad/s
const THRUST = 250;             // px/s²
const DRAG_PER_SEC = 0.62;     // velocity multiplier per second (< 1 = friction)
const MAX_SPEED = 300;          // px/s
const BULLET_SPEED = 440;       // px/s
const FIRE_COOLDOWN = 290;      // ms
const INVINCIBLE_MS = 1800;
const BULLET_LIFE = 1500;       // ms
const MAX_HP = 3;
const FORK_RADIUS = 15;
const BEST_KEY = "dinedash_best";

const RADII = [50, 25, 12] as const;
const SPEED_MIN = [35, 58, 95] as const;
const SPEED_MAX = [55, 90, 150] as const;
const ROT_SPDS = [0.5, 1.1, 2.3] as const;  // rad/s base per tier
const TIER_SCORE = [10, 20, 50] as const;

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface Plate {
  x: number; y: number; vx: number; vy: number;
  rot: number; rotSpd: number; tier: number;
  gfx: Phaser.GameObjects.Graphics;
}

interface Bullet {
  x: number; y: number; vx: number; vy: number;
  life: number; gfx: Phaser.GameObjects.Graphics;
}

interface Shard {
  x: number; y: number; vx: number; vy: number;
  rot: number; rotSpd: number; alpha: number;
  gfx: Phaser.GameObjects.Graphics;
}

interface Mushroom {
  x: number; y: number; vx: number; vy: number;
  obj: Phaser.GameObjects.Text;
}

// ─── BootScene ────────────────────────────────────────────────────────────────
class BootScene extends Phaser.Scene {
  constructor() { super("BootScene"); }
  create(): void { this.scene.start("GameScene"); }
}

// ─── GameScene ────────────────────────────────────────────────────────────────
class GameScene extends Phaser.Scene {
  private fx = W / 2; private fy = H / 2;
  private fvx = 0; private fvy = 0;
  private fAngle = 0;
  private hp = MAX_HP;
  private invTimer = 0;
  private fireCooldown = 0;
  private dead = false;
  private deathTimer = 0;
  private score = 0;
  private wave = 1;
  private waveClearing = false;
  private waveClearTimer = 0;
  private best = 0;

  private plates: Plate[] = [];
  private bullets: Bullet[] = [];
  private shards: Shard[] = [];
  private mushrooms: Mushroom[] = [];

  private forkGfx!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private hpIcons: Phaser.GameObjects.Text[] = [];
  private waveLabel!: Phaser.GameObjects.Text;
  private waveBanner!: Phaser.GameObjects.Text;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;

  constructor() { super("GameScene"); }

  create(): void {
    this.fx = W / 2; this.fy = H / 2;
    this.fvx = 0; this.fvy = 0; this.fAngle = 0;
    this.hp = MAX_HP; this.invTimer = 0; this.fireCooldown = 0;
    this.dead = false; this.deathTimer = 0;
    this.score = 0; this.wave = 1;
    this.waveClearing = false; this.waveClearTimer = 0;
    this.plates = []; this.bullets = []; this.shards = []; this.mushrooms = [];
    this.best = parseInt(localStorage.getItem(BEST_KEY) ?? "0", 10);

    // Background (static, drawn once)
    const bgGfx = this.add.graphics().setDepth(0);
    this.drawBackground(bgGfx);

    this.forkGfx = this.add.graphics().setDepth(6);

    // HUD
    this.scoreText = this.add.text(W / 2, 18, "0", {
      fontFamily: "'Press Start 2P'", fontSize: "26px", color: "#fff",
      stroke: "#000", strokeThickness: 4,
    }).setOrigin(0.5, 0).setDepth(10);

    this.waveLabel = this.add.text(W - 10, 14, "WAVE 1", {
      fontFamily: "'Press Start 2P'", fontSize: "7px", color: "#886644",
    }).setOrigin(1, 0).setDepth(10);

    this.waveBanner = this.add.text(W / 2, H / 2 - 60, "", {
      fontFamily: "'Press Start 2P'", fontSize: "18px", color: "#f4c46a",
      stroke: "#000", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(15).setAlpha(0);

    this.rebuildHPIcons();

    const back = this.add.text(10, H - 14, "< ARCADE", {
      fontFamily: "'Press Start 2P'", fontSize: "7px", color: "#664422",
    }).setOrigin(0, 1).setDepth(10).setInteractive({ useHandCursor: true });
    back.on("pointerover", () => back.setColor("#cc8844"));
    back.on("pointerout",  () => back.setColor("#664422"));
    back.on("pointerup",   () => { window.location.href = "/"; });

    // Controls hint
    this.add.text(W / 2, H - 14, "ARROWS/WASD: move   SPACE: shoot", {
      fontFamily: "'Press Start 2P'", fontSize: "5px", color: "#443322",
    }).setOrigin(0.5, 1).setDepth(10);

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyW     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.spawnWave();
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;

    if (this.dead) { this.updateDeath(dt); return; }

    if (this.waveClearing) {
      this.waveClearTimer -= delta;
      if (this.waveClearTimer <= 0) {
        this.waveClearing = false;
        this.waveBanner.setAlpha(0);
        this.spawnWave();
      }
      return;
    }

    this.handleInput(dt, delta);
    this.updateBullets(dt);
    this.updatePlates(dt);
    this.updateShards(dt);
    this.updateMushrooms(dt);
    this.checkBulletPlateCollisions();
    this.checkForkPlateCollisions();
    this.checkForkMushroomCollisions();
    this.checkWaveClear();
    this.drawFork();
  }

  private handleInput(dt: number, delta: number): void {
    const rotLeft  = this.cursors.left.isDown || this.keyA.isDown;
    const rotRight = this.cursors.right.isDown || this.keyD.isDown;
    const thrusting = this.cursors.up.isDown || this.keyW.isDown;

    if (rotLeft)  this.fAngle -= ROT_SPEED * dt;
    if (rotRight) this.fAngle += ROT_SPEED * dt;

    if (thrusting) {
      this.fvx += Math.sin(this.fAngle) * THRUST * dt;
      this.fvy -= Math.cos(this.fAngle) * THRUST * dt;
    }

    // Delta-time correct drag
    const drag = Math.pow(DRAG_PER_SEC, dt);
    this.fvx *= drag;
    this.fvy *= drag;

    const spd = Math.hypot(this.fvx, this.fvy);
    if (spd > MAX_SPEED) {
      this.fvx = (this.fvx / spd) * MAX_SPEED;
      this.fvy = (this.fvy / spd) * MAX_SPEED;
    }

    this.fx += this.fvx * dt;
    this.fy += this.fvy * dt;

    // Screen wrap
    if (this.fx < -25)    this.fx = W + 25;
    if (this.fx > W + 25) this.fx = -25;
    if (this.fy < -25)    this.fy = H + 25;
    if (this.fy > H + 25) this.fy = -25;

    if (Phaser.Input.Keyboard.JustDown(this.keySpace) && this.fireCooldown <= 0) {
      this.fireMeatball();
      this.fireCooldown = FIRE_COOLDOWN;
    }
    this.fireCooldown = Math.max(0, this.fireCooldown - delta);
    this.invTimer     = Math.max(0, this.invTimer - delta);
  }

  private fireMeatball(): void {
    const sx = this.fx + Math.sin(this.fAngle) * 26;
    const sy = this.fy - Math.cos(this.fAngle) * 26;
    const gfx = this.add.graphics().setDepth(4);
    gfx.fillStyle(0x8b4513, 1);
    gfx.fillCircle(0, 0, 5);
    gfx.fillStyle(0xc07040, 0.5);
    gfx.fillCircle(-1, -2, 2);
    gfx.setPosition(sx, sy);
    this.bullets.push({
      x: sx, y: sy,
      vx: Math.sin(this.fAngle) * BULLET_SPEED,
      vy: -Math.cos(this.fAngle) * BULLET_SPEED,
      life: BULLET_LIFE, gfx,
    });
  }

  private updateBullets(dt: number): void {
    this.bullets = this.bullets.filter(b => {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt * 1000;
      if (b.x < -10) b.x = W + 10; if (b.x > W + 10) b.x = -10;
      if (b.y < -10) b.y = H + 10; if (b.y > H + 10) b.y = -10;
      b.gfx.setPosition(b.x, b.y);
      if (b.life <= 0) { b.gfx.destroy(); return false; }
      return true;
    });
  }

  private spawnPlateAt(tier: number, x: number, y: number, vx: number, vy: number): void {
    const rotSpd = (Math.random() < 0.5 ? 1 : -1) * ROT_SPDS[tier] * Phaser.Math.FloatBetween(0.7, 1.4);
    const gfx = this.add.graphics().setDepth(3);
    this.drawPlate(gfx, tier);
    gfx.setPosition(x, y);
    this.plates.push({ x, y, vx, vy, rot: 0, rotSpd, tier, gfx });
  }

  private spawnPlateFromEdge(tier: number): void {
    const edge = Phaser.Math.Between(0, 3);
    const r = RADII[tier];
    let x: number, y: number;
    if      (edge === 0) { x = Phaser.Math.FloatBetween(0, W); y = -r - 5; }
    else if (edge === 1) { x = W + r + 5; y = Phaser.Math.FloatBetween(0, H); }
    else if (edge === 2) { x = Phaser.Math.FloatBetween(0, W); y = H + r + 5; }
    else                 { x = -r - 5;    y = Phaser.Math.FloatBetween(0, H); }

    const toCenter = Math.atan2(H / 2 - y, W / 2 - x);
    const spread   = Phaser.Math.FloatBetween(-0.6, 0.6);
    const spd      = Phaser.Math.FloatBetween(SPEED_MIN[tier], SPEED_MAX[tier]);
    this.spawnPlateAt(tier, x, y, Math.cos(toCenter + spread) * spd, Math.sin(toCenter + spread) * spd);
  }

  private drawPlate(g: Phaser.GameObjects.Graphics, tier: number): void {
    const r = RADII[tier];
    if (tier === 0) {
      // Spaghetti plate
      g.fillStyle(0xfff8f0, 1);
      g.fillCircle(0, 0, r);
      g.fillStyle(0xede0c8, 0.5);
      g.fillCircle(0, 0, r - 6);
      g.lineStyle(2, 0xf4c46a, 0.85);
      g.strokeCircle(r * 0.18, 0, r * 0.38);
      g.strokeCircle(-r * 0.22, r * 0.1, r * 0.3);
      g.strokeCircle(r * 0.06, -r * 0.2, r * 0.2);
      g.fillStyle(0x8b4513, 0.9);
      g.fillCircle(r * 0.12, -r * 0.08, r * 0.2);
      g.fillStyle(0xc07040, 0.5);
      g.fillCircle(r * 0.08, -r * 0.12, r * 0.09);
    } else if (tier === 1) {
      // Meatball
      g.fillStyle(0x6e3010, 1);
      g.fillCircle(0, 0, r);
      g.fillStyle(0x9a5030, 0.65);
      g.fillCircle(-r * 0.18, -r * 0.18, r * 0.6);
      g.fillStyle(0xc07040, 0.25);
      g.fillCircle(-r * 0.22, -r * 0.22, r * 0.32);
    } else {
      // Glass shard
      g.fillStyle(0xe8f4ff, 0.72);
      g.fillTriangle(0, -r, -r * 0.85, r * 0.65, r * 0.75, r * 0.45);
      g.lineStyle(1, 0xffffff, 0.85);
      g.strokeTriangle(0, -r, -r * 0.85, r * 0.65, r * 0.75, r * 0.45);
    }
  }

  private updatePlates(dt: number): void {
    for (const p of this.plates) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.rotSpd * dt;
      const r = RADII[p.tier] + 5;
      if (p.x < -r)    p.x = W + r;
      if (p.x > W + r) p.x = -r;
      if (p.y < -r)    p.y = H + r;
      if (p.y > H + r) p.y = -r;
      p.gfx.setPosition(p.x, p.y).setRotation(p.rot);
    }
  }

  private spawnVisualShards(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.4, 0.4);
      const spd   = Phaser.Math.FloatBetween(55, 130);
      const gfx   = this.add.graphics().setDepth(2);
      const sr = 7;
      gfx.fillStyle(0xe8f4ff, 0.75);
      gfx.fillTriangle(0, -sr, -sr * 0.8, sr * 0.6, sr * 0.7, sr * 0.5);
      gfx.setPosition(x, y);
      this.shards.push({
        x, y,
        vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
        rot: Phaser.Math.FloatBetween(0, Math.PI * 2),
        rotSpd: Phaser.Math.FloatBetween(-3.5, 3.5),
        alpha: 1, gfx,
      });
    }
  }

  private updateShards(dt: number): void {
    this.shards = this.shards.filter(s => {
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.rot += s.rotSpd * dt;
      s.alpha -= 0.65 * dt;
      s.gfx.setPosition(s.x, s.y).setRotation(s.rot).setAlpha(Math.max(0, s.alpha));
      if (s.alpha <= 0) { s.gfx.destroy(); return false; }
      return true;
    });
  }

  private spawnMushroom(x: number, y: number): void {
    const obj = this.add.text(x, y, "🍄", { fontSize: "26px" })
      .setOrigin(0.5).setDepth(4);
    this.mushrooms.push({
      x, y,
      vx: Phaser.Math.FloatBetween(-35, 35),
      vy: Phaser.Math.FloatBetween(20, 50),
      obj,
    });
  }

  private updateMushrooms(dt: number): void {
    this.mushrooms = this.mushrooms.filter(m => {
      m.x += m.vx * dt; m.y += m.vy * dt;
      m.obj.setPosition(m.x, m.y);
      if (m.y > H + 50) { m.obj.destroy(); return false; }
      return true;
    });
  }

  private checkBulletPlateCollisions(): void {
    const deadBullets = new Set<number>();
    const deadPlates  = new Set<number>();

    for (let bi = 0; bi < this.bullets.length; bi++) {
      if (deadBullets.has(bi)) continue;
      const b = this.bullets[bi];
      for (let pi = 0; pi < this.plates.length; pi++) {
        if (deadPlates.has(pi)) continue;
        const p = this.plates[pi];
        if (Math.hypot(b.x - p.x, b.y - p.y) >= RADII[p.tier] + 5) continue;

        deadBullets.add(bi);
        deadPlates.add(pi);

        this.score += TIER_SCORE[p.tier];
        this.scoreText.setText(String(this.score));
        this.cameras.main.flash(50, 255, 200, 80, true);

        if (p.tier === 0) {
          // Large plate → 2 meatballs
          for (let k = 0; k < 2; k++) {
            const a   = Math.atan2(p.vy, p.vx) + (k === 0 ? 0.9 : -0.9) + Phaser.Math.FloatBetween(-0.25, 0.25);
            const spd = Phaser.Math.FloatBetween(SPEED_MIN[1], SPEED_MAX[1]);
            this.spawnPlateAt(1, p.x, p.y, Math.cos(a) * spd, Math.sin(a) * spd);
          }
          if (Math.random() < 0.35) this.spawnMushroom(p.x, p.y);
        } else if (p.tier === 1) {
          // Meatball → 2 glass shard plates + visual debris
          this.spawnVisualShards(p.x, p.y, 4);
          for (let k = 0; k < 2; k++) {
            const a   = Math.atan2(p.vy, p.vx) + (k === 0 ? 1.1 : -1.1) + Phaser.Math.FloatBetween(-0.3, 0.3);
            const spd = Phaser.Math.FloatBetween(SPEED_MIN[2], SPEED_MAX[2]);
            this.spawnPlateAt(2, p.x, p.y, Math.cos(a) * spd, Math.sin(a) * spd);
          }
        } else {
          // Glass shard → visual debris only
          this.spawnVisualShards(p.x, p.y, 2);
        }
        break;
      }
    }

    for (const pi of [...deadPlates].sort((a, b) => b - a)) {
      this.plates[pi].gfx.destroy();
      this.plates.splice(pi, 1);
    }
    for (const bi of [...deadBullets].sort((a, b) => b - a)) {
      this.bullets[bi].gfx.destroy();
      this.bullets.splice(bi, 1);
    }
  }

  private checkForkPlateCollisions(): void {
    if (this.invTimer > 0) return;
    for (const p of this.plates) {
      if (Math.hypot(this.fx - p.x, this.fy - p.y) >= RADII[p.tier] + FORK_RADIUS - 5) continue;
      this.hp--;
      this.invTimer = INVINCIBLE_MS;
      this.cameras.main.shake(200, 0.014);
      this.cameras.main.flash(200, 255, 50, 50, true);
      this.rebuildHPIcons();
      if (this.hp <= 0) { this.startDeath(); return; }
      break;
    }
  }

  private checkForkMushroomCollisions(): void {
    this.mushrooms = this.mushrooms.filter(m => {
      if (Math.hypot(this.fx - m.x, this.fy - m.y) >= 26) return true;
      if (this.hp < MAX_HP) {
        this.hp++;
        this.rebuildHPIcons();
        this.cameras.main.flash(110, 80, 255, 80, true);
      }
      m.obj.destroy();
      return false;
    });
  }

  private checkWaveClear(): void {
    if (this.plates.length > 0 || this.waveClearing) return;
    this.wave++;
    this.waveClearing = true;
    this.waveClearTimer = 2300;
    this.waveLabel.setText(`WAVE ${this.wave}`);
    this.waveBanner.setText(`WAVE ${this.wave}`).setAlpha(1);
    this.tweens.add({
      targets: this.waveBanner,
      alpha: 0, duration: 1600, delay: 500, ease: "Sine.easeIn",
    });
  }

  private spawnWave(): void {
    const count = Math.min(2 + this.wave, 9);
    for (let i = 0; i < count; i++) this.spawnPlateFromEdge(0);
  }

  private startDeath(): void {
    this.dead = true;
    this.deathTimer = 0;
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(BEST_KEY, String(this.best));
    }
    this.cameras.main.shake(400, 0.022);
    this.cameras.main.flash(350, 255, 40, 40, true);
  }

  private updateDeath(dt: number): void {
    this.deathTimer += dt * 1000;
    this.fAngle += 5.5 * dt;
    this.drawFork();
    this.forkGfx.setAlpha(Math.max(0, 1 - this.deathTimer / 900));
    if (this.deathTimer > 1400) {
      this.cleanupAll();
      this.scene.start("GameOverScene", { score: this.score, best: this.best, wave: this.wave });
    }
  }

  private cleanupAll(): void {
    for (const p of this.plates) p.gfx.destroy();
    for (const b of this.bullets) b.gfx.destroy();
    for (const s of this.shards)  s.gfx.destroy();
    for (const m of this.mushrooms) m.obj.destroy();
    this.plates = []; this.bullets = []; this.shards = []; this.mushrooms = [];
  }

  private rebuildHPIcons(): void {
    for (const icon of this.hpIcons) icon.destroy();
    this.hpIcons = [];
    for (let i = 0; i < MAX_HP; i++) {
      this.hpIcons.push(
        this.add.text(12 + i * 26, 14, i < this.hp ? "🍴" : "🩶", { fontSize: "18px" }).setDepth(10),
      );
    }
  }

  private drawFork(): void {
    const g = this.forkGfx;
    g.clear();
    g.fillStyle(0xd4d4d8, 1);

    // 4 tines pointing in -Y from origin
    for (let i = 0; i < 4; i++) {
      g.fillRect(-7 + i * 4, -22, 2, 15);
    }
    // Tine base
    g.fillRect(-8, -8, 16, 9);
    // Handle
    g.fillRoundedRect(-5, 1, 10, 20, 3);

    // Thrust flame
    if (this.cursors.up.isDown || this.keyW.isDown) {
      g.fillStyle(0xff8c00, 0.85);
      g.fillTriangle(-4, 22, 4, 22, 0, 30 + Phaser.Math.FloatBetween(0, 9));
      g.fillStyle(0xffee00, 0.65);
      g.fillTriangle(-2, 22, 2, 22, 0, 27 + Phaser.Math.FloatBetween(0, 4));
    }

    g.setPosition(this.fx, this.fy).setRotation(this.fAngle);

    // Invincibility flash (don't override death alpha — updateDeath sets that after)
    if (!this.dead) {
      g.setAlpha(this.invTimer > 0 && Math.floor(this.invTimer / 90) % 2 === 0 ? 0.2 : 1);
    }
  }

  private drawBackground(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x0d0804, 1);
    g.fillRect(0, 0, W, H);

    // Subtle tablecloth grid
    const sq = 64;
    for (let row = 0; row < Math.ceil(H / sq); row++) {
      for (let col = 0; col < Math.ceil(W / sq); col++) {
        if ((row + col) % 2 === 0) {
          g.fillStyle(0x120a05, 1);
          g.fillRect(col * sq, row * sq, sq, sq);
        }
      }
    }

    // Sauce splatters
    const splatData: [number, number, number][] = [
      [45, 90, 10], [150, 210, 7], [290, 160, 12], [390, 310, 8],
      [110, 460, 9], [330, 510, 6], [230, 360, 11], [455, 130, 7],
      [60, 580, 8], [400, 440, 10],
    ];
    for (const [sx, sy, sr] of splatData) {
      g.fillStyle(0x5a1010, 0.18);
      g.fillCircle(sx, sy, sr);
      g.fillStyle(0x8a2020, 0.08);
      g.fillCircle(sx + sr * 0.6, sy - sr * 0.4, sr * 0.5);
    }
  }
}

// ─── GameOverScene ────────────────────────────────────────────────────────────
class GameOverScene extends Phaser.Scene {
  constructor() { super("GameOverScene"); }

  create(data: { score: number; best: number; wave: number }): void {
    const cx = W / 2, cy = H / 2;

    this.add.rectangle(cx, cy, W, H, 0x000000, 0.72);
    this.add.rectangle(cx, cy - 10, 310, 290, 0x130802, 1).setStrokeStyle(2, 0x8b4513);

    this.add.text(cx, cy - 118, "DINE 'N' DASH", {
      fontFamily: "'Press Start 2P'", fontSize: "12px", color: "#f4c46a",
      stroke: "#000", strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(cx, cy - 88, "FORK DROPPED", {
      fontFamily: "'Press Start 2P'", fontSize: "10px", color: "#ef4444",
    }).setOrigin(0.5);

    this.add.text(cx, cy - 52, "SCORE", {
      fontFamily: "'Press Start 2P'", fontSize: "8px", color: "#886644",
    }).setOrigin(0.5);

    this.add.text(cx, cy - 24, String(data.score), {
      fontFamily: "'Press Start 2P'", fontSize: "34px", color: "#ffffff",
      stroke: "#000", strokeThickness: 4,
    }).setOrigin(0.5);

    const isNewBest = data.score > 0 && data.score >= data.best;
    this.add.text(cx, cy + 34, `BEST: ${data.best}`, {
      fontFamily: "'Press Start 2P'", fontSize: "9px",
      color: isNewBest ? "#22c55e" : "#fde047",
    }).setOrigin(0.5);

    this.add.text(cx, cy + 56, `WAVES SURVIVED: ${data.wave}`, {
      fontFamily: "'Press Start 2P'", fontSize: "7px", color: "#886644",
    }).setOrigin(0.5);

    if (isNewBest) {
      this.add.text(cx, cy + 76, "NEW RECORD! 🍝", {
        fontFamily: "'Press Start 2P'", fontSize: "8px", color: "#22c55e",
      }).setOrigin(0.5);
    }

    const playBtn = this.add.text(cx, cy + 110, "EAT AGAIN", {
      fontFamily: "'Press Start 2P'", fontSize: "11px", color: "#f4c46a",
      backgroundColor: "#130802", padding: { x: 14, y: 9 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    playBtn.on("pointerover", () => playBtn.setColor("#ffffff"));
    playBtn.on("pointerout",  () => playBtn.setColor("#f4c46a"));
    playBtn.on("pointerup",   () => this.scene.start("GameScene"));

    const backBtn = this.add.text(cx, cy + 156, "< BACK TO ARCADE", {
      fontFamily: "'Press Start 2P'", fontSize: "7px", color: "#664422",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    backBtn.on("pointerover", () => backBtn.setColor("#cc8844"));
    backBtn.on("pointerout",  () => backBtn.setColor("#664422"));
    backBtn.on("pointerup",   () => { window.location.href = "/"; });

    this.input.keyboard!.once("keydown-SPACE", () => this.scene.start("GameScene"));
  }
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
new Phaser.Game({
  type: Phaser.AUTO,
  width: W,
  height: H,
  backgroundColor: "#0d0804",
  scene: [BootScene, GameScene, GameOverScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});
