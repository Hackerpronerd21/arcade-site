import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { TrenchGhoul } from '../entities/TrenchGhoul';
import { Warden } from '../entities/Warden';
import { RelicSystem } from '../systems/RelicSystem';

// ── Constants ─────────────────────────────────────────────────────────────────
const WORLD_W = 2400;
const WORLD_H = 600;
const GROUND_Y = 570;      // top surface of ground
const GRENADE_COST = 2;
const GRENADE_DAMAGE = 3;
const GRENADE_RADIUS = 90;
const STOMP_RADIUS = 120;

// ── Types ─────────────────────────────────────────────────────────────────────
interface Checkpoint {
  x: number;
  y: number;
  lantern: Phaser.GameObjects.Image;
  activated: boolean;
}

// ── Chapter1Scene ─────────────────────────────────────────────────────────────
export class Chapter1Scene extends Phaser.Scene {
  private player!: Player;
  private ghouls!: Phaser.Physics.Arcade.Group;
  private warden!: Warden;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private crates!: Phaser.Physics.Arcade.StaticGroup;
  private relicPickups!: Phaser.Physics.Arcade.Group;
  private grenades!: Phaser.Physics.Arcade.Group;
  private checkpoints: Checkpoint[] = [];
  private relicSystem!: RelicSystem;

  // HUD
  private hpBoxes: Phaser.GameObjects.Rectangle[] = [];
  private bossBarBg!: Phaser.GameObjects.Image;
  private bossBarFill!: Phaser.GameObjects.Rectangle;
  private bossLabel!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'Chapter1Scene' });
  }

  create(): void {
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);

    this.buildBackground();
    this.buildLevel();
    this.spawnPlayer();
    this.spawnEnemies();
    this.buildHUD();
    this.setupEvents();
    this.setupCamera();

    this.relicSystem = new RelicSystem(this);
    this.activateCheckpoint(0); // always start from checkpoint 0
  }

  update(_time: number, delta: number): void {
    this.player.update(delta);

    (this.ghouls.getChildren() as unknown as TrenchGhoul[]).forEach(g => g.update(delta));
    this.warden.update(delta);

    // ── Melee + crate hits ─────────────────────────────────────────────
    if (this.player.isAttacking) {
      this.processMeleeHits();
    }

    // ── Enemy contact damage ───────────────────────────────────────────
    (this.ghouls.getChildren() as unknown as TrenchGhoul[]).forEach(ghoul => {
      if (!ghoul.isDead) {
        const d = Phaser.Math.Distance.Between(ghoul.x, ghoul.y, this.player.x, this.player.y);
        if (d < 30) this.hurtPlayer(1, ghoul.x);
      }
    });

    if (this.warden.isActive && !this.warden.isDead) {
      const d = Phaser.Math.Distance.Between(this.warden.x, this.warden.y, this.player.x, this.player.y);
      if (d < 48) this.hurtPlayer(this.warden.getContactDamage(), this.warden.x);
    }

    // ── Checkpoint proximity ───────────────────────────────────────────
    this.checkpoints.forEach((cp, i) => {
      if (!cp.activated) {
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, cp.x, cp.y);
        if (d < 64) this.activateCheckpoint(i);
      }
    });

    // ── Warden trigger ─────────────────────────────────────────────────
    if (!this.warden.isActive && this.player.x > 1720) {
      this.warden.activate(this.player);
    }
  }

  // ── Level build ────────────────────────────────────────────────────────────

  private buildBackground(): void {
    // Section backgrounds at depth -10; scroll with world
    this.add.rectangle(400, 300, 800, WORLD_H, 0x0d1a2e).setDepth(-10);  // courtyard: dark sky
    this.add.rectangle(1200, 300, 800, WORLD_H, 0x060608).setDepth(-10); // tunnel: blackout
    this.add.rectangle(2000, 300, 800, WORLD_H, 0x0f0514).setDepth(-10); // chamber: deep purple

    // Atmospheric colour strips near ground
    this.add.rectangle(400, 540, 800, 80, 0x1a2b10, 0.4).setDepth(-9);
    this.add.rectangle(1200, 540, 800, 80, 0x0a0a0a, 0.6).setDepth(-9);
    this.add.rectangle(2000, 540, 800, 80, 0x1a0522, 0.5).setDepth(-9);
  }

  private buildLevel(): void {
    this.platforms = this.physics.add.staticGroup();
    this.crates = this.physics.add.staticGroup();

    // ── Ground (full world width) ──────────────────────────────────────
    this.addPlatform(0, GROUND_Y, WORLD_W, 30, 0x2d1e14);
    // Left boundary
    this.addPlatform(-20, 0, 20, WORLD_H, 0x1a1a1a);

    // ══ SECTION 1: COURTYARD (x 0–800) ════════════════════════════════
    this.addPlatform(120, 460, 170, 18, 0x3d2b1f);  // Plat A: y surface 460
    this.addPlatform(360, 400, 150, 18, 0x3d2b1f);  // Plat B: y surface 400
    this.addPlatform(560, 456, 170, 18, 0x3d2b1f);  // Plat C: y surface 456

    this.addCrate(75, GROUND_Y);
    this.addCrate(270, GROUND_Y);
    this.addCrate(480, GROUND_Y);
    this.addCrate(175, 460);       // on Plat A

    this.addCheckpoint(48, GROUND_Y);    // CP 0 – start

    // ══ SECTION 2: TUNNEL (x 800–1600) ════════════════════════════════
    // Low ceiling for claustrophobic feel
    this.addPlatform(800, 300, 800, 18, 0x1a1a1a);

    this.addPlatform(870, 470, 140, 18, 0x3d2b1f);   // Plat D
    this.addPlatform(1060, 420, 155, 18, 0x3d2b1f);  // Plat E
    this.addPlatform(1260, 458, 155, 18, 0x3d2b1f);  // Plat F
    this.addPlatform(1450, 476, 120, 18, 0x3d2b1f);  // Plat G

    this.addCrate(920, GROUND_Y);
    this.addCrate(1140, GROUND_Y);
    this.addCrate(1330, GROUND_Y);

    this.addCheckpoint(820, GROUND_Y);   // CP 1 – mid tunnel

    // ══ SECTION 3: WARDEN'S CHAMBER (x 1600–2400) ════════════════════
    // Ceiling for ceiling-drop mechanic
    this.addPlatform(1600, 280, 800, 18, 0x1a0a22);
    // Arena walls
    this.addPlatform(1600, 298, 20, 290, 0x1a0a22);
    this.addPlatform(2380, 298, 20, 290, 0x1a0a22);
    // Side ledges for height variety
    this.addPlatform(1622, 460, 100, 18, 0x3d2b1f);
    this.addPlatform(2278, 460, 100, 18, 0x3d2b1f);

    this.addCrate(1720, GROUND_Y);
    this.addCrate(2240, GROUND_Y);

    this.addCheckpoint(1660, GROUND_Y);  // CP 2 – before boss
  }

  // x, y = top-left corner of platform
  private addPlatform(x: number, y: number, w: number, h: number, color: number = 0x3d2b1f): void {
    const p = this.platforms.create(x + w / 2, y + h / 2, 'platform') as Phaser.Physics.Arcade.Image;
    p.setDisplaySize(w, h);
    p.setTint(color);
    p.refreshBody();
  }

  // x, y = centre-bottom of crate (origin 0.5, 1)
  private addCrate(x: number, y: number): void {
    const c = this.crates.create(x, y, 'crate') as Phaser.Physics.Arcade.Image;
    c.setOrigin(0.5, 1);
    c.setData('hp', 2);
    c.refreshBody();
  }

  // x, y = bottom of lantern
  private addCheckpoint(x: number, y: number): void {
    const lantern = this.add
      .image(x, y, 'lantern')
      .setOrigin(0.5, 1)
      .setDepth(5)
      .setTint(0x443322);
    this.checkpoints.push({ x, y: y - 16, lantern, activated: false });
  }

  // ── Spawning ───────────────────────────────────────────────────────────────

  private spawnPlayer(): void {
    this.player = new Player(this, 80, 500);
    this.physics.add.collider(this.player, this.platforms);
    this.relicPickups = this.physics.add.group();
    this.grenades = this.physics.add.group();

    // Relic auto-collect
    this.physics.add.overlap(this.player, this.relicPickups, (_p, r) => {
      const relic = r as Phaser.Physics.Arcade.Image;
      if (!relic.active) return;
      relic.setActive(false);
      this.relicSystem.add(1);
      relic.destroy();
    });
  }

  private spawnEnemies(): void {
    this.ghouls = this.physics.add.group();

    // Courtyard
    this.spawnGhoul(310, 500, 190, 530);
    this.spawnGhoul(600, 500, 460, 720);
    // Tunnel
    this.spawnGhoul(960, 500, 860, 1110);
    this.spawnGhoul(1320, 500, 1110, 1530);

    this.physics.add.collider(this.ghouls, this.platforms);

    // Warden (inactive until player enters chamber)
    this.warden = new Warden(this, 2000, 480);
    this.physics.add.collider(this.warden, this.platforms);
  }

  private spawnGhoul(x: number, y: number, left: number, right: number): void {
    const g = new TrenchGhoul(this, x, y, left, right);
    g.setPlayer(this.player);
    this.ghouls.add(g);
  }

  // ── HUD ────────────────────────────────────────────────────────────────────

  private buildHUD(): void {
    // HP boxes — top-left, fixed to camera
    for (let i = 0; i < 3; i++) {
      const box = this.add
        .rectangle(18 + i * 24, 18, 18, 18, 0xdc2626)
        .setScrollFactor(0)
        .setDepth(100)
        .setOrigin(0, 0);
      this.hpBoxes.push(box);
    }
    this.add
      .text(12, 38, 'HP', { fontSize: '9px', fontFamily: 'monospace', color: '#777' })
      .setScrollFactor(0)
      .setDepth(100);

    // Controls hint (bottom-left)
    this.add
      .text(8, 580, '← → move   ↑ jump   X attack   Q grenade (costs 2 relics)', {
        fontSize: '9px', fontFamily: 'monospace', color: '#555',
      })
      .setScrollFactor(0)
      .setDepth(100)
      .setOrigin(0, 1);

    // Boss bar — bottom-centre, hidden until boss activates
    this.bossBarBg = this.add
      .image(400, 572, 'bossbar-bg')
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);
    this.bossBarFill = this.add
      .rectangle(202, 572, 392, 14, 0x7c3aed)
      .setScrollFactor(0)
      .setDepth(101)
      .setOrigin(0, 0.5)
      .setVisible(false);
    this.bossLabel = this.add
      .text(400, 557, 'THE WARDEN', {
        fontSize: '10px', fontFamily: 'monospace', color: '#c4b5fd',
      })
      .setScrollFactor(0)
      .setDepth(101)
      .setOrigin(0.5, 1)
      .setVisible(false);
  }

  private updateHpHUD(hp: number): void {
    this.hpBoxes.forEach((box, i) => {
      box.setFillStyle(i < hp ? 0xdc2626 : 0x2a2a2a);
    });
  }

  private updateBossBar(hp: number, maxHp: number): void {
    const pct = hp / maxHp;
    this.bossBarFill.setDisplaySize(392 * pct, 14);
    const color = hp <= PHASE3_HP_REF ? 0xff4444 : hp <= PHASE2_HP_REF ? 0xf97316 : 0x7c3aed;
    this.bossBarFill.setFillStyle(color);
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  private setupEvents(): void {
    this.events.on('playerHurt', (hp: number) => this.updateHpHUD(hp));
    this.events.on('playerRespawned', (hp: number) => this.updateHpHUD(hp));
    this.events.on('playerDied', () => {
      this.cameras.main.flash(500, 80, 0, 0);
    });
    this.events.on('playerThrowGrenade', (x: number, y: number, dir: number) => {
      this.throwGrenade(x, y, dir);
    });
    this.events.on('enemyDied', (x: number, y: number, count: number) => {
      this.spawnRelics(x, y, count);
    });
    this.events.on('wardenActivated', (hp: number, maxHp: number) => {
      this.bossBarBg.setVisible(true);
      this.bossBarFill.setVisible(true);
      this.bossLabel.setVisible(true);
      this.updateBossBar(hp, maxHp);
      this.cameras.main.shake(400, 0.012);
    });
    this.events.on('wardenHurt', (hp: number, maxHp: number) => {
      this.updateBossBar(hp, maxHp);
      this.cameras.main.shake(70, 0.004);
    });
    this.events.on('wardenStomp', (x: number, y: number) => {
      this.handleStomp(x, y);
    });
    this.events.on('wardenPhaseChange', (_phase: number) => {
      this.cameras.main.flash(220, 80, 0, 80);
    });
    this.events.on('wardenDied', () => {
      this.bossLabel.setText('ELIMINATED');
      this.bossBarFill.setFillStyle(0x22c55e);
      this.cameras.main.shake(700, 0.022);
      this.time.delayedCall(3200, () => this.showVictory());
    });
  }

  // ── Camera ─────────────────────────────────────────────────────────────────

  private setupCamera(): void {
    this.cameras.main.startFollow(this.player, true);
    this.cameras.main.setLerp(0.08, 0.08);
    this.cameras.main.setDeadzone(70, 50);
  }

  // ── Checkpoint ─────────────────────────────────────────────────────────────

  private activateCheckpoint(index: number): void {
    const cp = this.checkpoints[index];
    if (!cp || cp.activated) return;
    cp.activated = true;
    cp.lantern.clearTint();
    cp.lantern.setTint(0xf59e0b); // light up amber
    this.player.setCheckpoint(cp.x, cp.y);
    this.cameras.main.flash(160, 30, 20, 0);
  }

  // ── Combat ─────────────────────────────────────────────────────────────────

  private processMeleeHits(): void {
    const reach = this.player.getMeleeReach();
    const { x: px, y: py, flipX } = this.player;
    const facingRight = !flipX;

    // Ghouls
    (this.ghouls.getChildren() as unknown as TrenchGhoul[]).forEach(ghoul => {
      if (ghoul.isDead || this.player.attackHitSet.has(ghoul)) return;
      const inFront = facingRight ? ghoul.x > px : ghoul.x < px;
      if (inFront && Phaser.Math.Distance.Between(px, py, ghoul.x, ghoul.y) < reach) {
        ghoul.takeDamage(1, px);
        this.player.attackHitSet.add(ghoul);
      }
    });

    // Warden
    if (this.warden.isActive && !this.warden.isDead && !this.player.attackHitSet.has(this.warden)) {
      const inFront = facingRight ? this.warden.x > px : this.warden.x < px;
      if (inFront && Phaser.Math.Distance.Between(px, py, this.warden.x, this.warden.y) < reach + 24) {
        this.warden.takeDamage(1, px);
        this.player.attackHitSet.add(this.warden);
      }
    }

    // Crates
    (this.crates.getChildren() as unknown as Phaser.Physics.Arcade.Image[]).forEach(crate => {
      if (!crate.active || this.player.attackHitSet.has(crate)) return;
      const inFront = facingRight ? crate.x > px : crate.x < px;
      const dist = Phaser.Math.Distance.Between(px, py - 8, crate.x, crate.y - 16);
      if (inFront && dist < reach + 18) {
        this.player.attackHitSet.add(crate); // one hit per swing
        this.hitCrate(crate);
      }
    });
  }

  private hitCrate(crate: Phaser.Physics.Arcade.Image): void {
    let hp = crate.getData('hp') as number;
    hp--;
    if (hp <= 0) {
      const dropCount = Phaser.Math.Between(1, 3);
      this.spawnRelics(crate.x, crate.y - 20, dropCount);
      this.tweens.add({
        targets: crate,
        scaleX: 1.5,
        scaleY: 0.05,
        alpha: 0,
        duration: 220,
        onComplete: () => { if (crate.active) this.crates.remove(crate, true, true); },
      });
    } else {
      crate.setData('hp', hp);
      crate.setTint(0xff8844);
      this.time.delayedCall(100, () => { if (crate.active) crate.clearTint(); });
    }
  }

  private hurtPlayer(amount: number, sourceX: number): void {
    this.player.takeDamage(amount, sourceX);
    this.updateHpHUD(this.player.hp);
  }

  // ── Grenade system ─────────────────────────────────────────────────────────

  private throwGrenade(x: number, y: number, dir: number): void {
    if (!this.relicSystem.spend(GRENADE_COST)) return;

    const g = this.physics.add.image(x, y, 'grenade');
    g.setDepth(8);
    const body = g.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(dir * 310, -330);

    this.grenades.add(g);

    // Explode on hitting platform
    this.physics.add.collider(g, this.platforms, () => {
      if (g.active) this.explodeGrenade(g.x, g.y, g);
    });

    // Auto-explode after 2.4 s
    this.time.delayedCall(2400, () => {
      if (g.active) this.explodeGrenade(g.x, g.y, g);
    });
  }

  private explodeGrenade(ex: number, ey: number, g: Phaser.Physics.Arcade.Image): void {
    g.destroy();

    // Visual burst
    const burst = this.add.circle(ex, ey, GRENADE_RADIUS, 0xff6600, 0.65).setDepth(15);
    this.tweens.add({
      targets: burst,
      alpha: 0,
      scale: 1.6,
      duration: 280,
      onComplete: () => burst.destroy(),
    });

    // Damage enemies in radius
    (this.ghouls.getChildren() as unknown as TrenchGhoul[]).forEach(ghoul => {
      if (!ghoul.isDead) {
        const d = Phaser.Math.Distance.Between(ex, ey, ghoul.x, ghoul.y);
        if (d < GRENADE_RADIUS) ghoul.takeDamage(GRENADE_DAMAGE, ex);
      }
    });

    if (this.warden.isActive && !this.warden.isDead) {
      const d = Phaser.Math.Distance.Between(ex, ey, this.warden.x, this.warden.y);
      if (d < GRENADE_RADIUS) this.warden.takeDamage(GRENADE_DAMAGE, ex);
    }
  }

  // ── Stomp shockwave ────────────────────────────────────────────────────────

  private handleStomp(x: number, y: number): void {
    const ring = this.add.ellipse(x, y, STOMP_RADIUS * 2, 22, 0xff6600, 0.55).setDepth(14);
    this.tweens.add({
      targets: ring,
      scaleX: 2.2,
      alpha: 0,
      duration: 380,
      onComplete: () => ring.destroy(),
    });

    const dPlayer = Math.abs(this.player.x - x);
    if (dPlayer < STOMP_RADIUS) {
      this.hurtPlayer(this.warden.getStompDamage(), x);
    }
  }

  // ── Relics ─────────────────────────────────────────────────────────────────

  private spawnRelics(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const relic = this.physics.add.image(
        x + Phaser.Math.Between(-18, 18),
        y,
        'relic',
      );
      relic.setDepth(7);
      const body = relic.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(Phaser.Math.Between(-130, 130), Phaser.Math.Between(-220, -80));
      this.physics.add.collider(relic, this.platforms);
      this.relicPickups.add(relic);
    }
  }

  // ── Victory ────────────────────────────────────────────────────────────────

  private showVictory(): void {
    this.add.rectangle(400, 300, 800, 600, 0x000000, 0.75).setScrollFactor(0).setDepth(200);

    this.add
      .text(400, 250, 'CHAPTER I', {
        fontSize: '14px', fontFamily: 'monospace', color: '#666',
      })
      .setScrollFactor(0).setDepth(201).setOrigin(0.5);

    this.add
      .text(400, 280, 'THE WARDEN FALLS', {
        fontSize: '26px', fontFamily: 'monospace', color: '#c0c0c0',
      })
      .setScrollFactor(0).setDepth(201).setOrigin(0.5);

    this.add
      .text(400, 326, 'The burning chamber falls silent.', {
        fontSize: '14px', fontFamily: 'monospace', color: '#888',
      })
      .setScrollFactor(0).setDepth(201).setOrigin(0.5);

    this.add
      .text(400, 356, 'Mira lights a cigarette over the ashes.', {
        fontSize: '12px', fontFamily: 'monospace', color: '#555', fontStyle: 'italic',
      })
      .setScrollFactor(0).setDepth(201).setOrigin(0.5);

    this.add
      .text(400, 410, '— to be continued —', {
        fontSize: '11px', fontFamily: 'monospace', color: '#444', fontStyle: 'italic',
      })
      .setScrollFactor(0).setDepth(201).setOrigin(0.5);
  }
}

// Phase threshold refs (mirrored from Warden for colour coding)
const PHASE2_HP_REF = 8;
const PHASE3_HP_REF = 4;
