import Phaser from 'phaser';

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_HP = 12;
const PHASE2_HP = 8;
const PHASE3_HP = 4;
const WALK_SPEED = 55;
const CHARGE_SPEED = 420;
const DROP_X_SPEED = 280;
const ARENA_LEFT = 1650;
const ARENA_RIGHT = 2350;

// ── Types ─────────────────────────────────────────────────────────────────────
type WardenPhase = 1 | 2 | 3;
type WardenAIState = 'walk' | 'charge' | 'stomp' | 'rising' | 'hovering' | 'dropping' | 'stunned' | 'dead';

// ── Warden ────────────────────────────────────────────────────────────────────
export class Warden extends Phaser.Physics.Arcade.Sprite {
  hp: number = MAX_HP;
  readonly maxHp: number = MAX_HP;
  isDead: boolean = false;
  isActive: boolean = false;

  private phase: WardenPhase = 1;
  private aiState: WardenAIState = 'walk';
  private direction: number = -1;
  private actionTimer: number = 2000; // initial walk-in delay
  private stompCd: number = 0;
  private chargeCd: number = 4000; // starts locked until phase 2
  private dropCd: number = 6000;   // starts locked until phase 3
  private playerRef: Phaser.Physics.Arcade.Sprite | null = null;
  private dropTargetX: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'warden');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(9);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(52, 72);
    body.setOffset(6, 4);

    this.setVisible(false);
    body.setEnable(false);
  }

  activate(player: Phaser.Physics.Arcade.Sprite): void {
    this.playerRef = player;
    this.isActive = true;
    this.setVisible(true);
    (this.body as Phaser.Physics.Arcade.Body).setEnable(true);
    this.aiState = 'walk';
    this.scene.events.emit('wardenActivated', this.hp, this.maxHp);
  }

  update(delta: number): void {
    if (!this.isActive || this.isDead || !this.playerRef) return;

    const body = this.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down;

    // Tick timers
    if (this.actionTimer > 0) this.actionTimer -= delta;
    if (this.stompCd > 0) this.stompCd -= delta;
    if (this.chargeCd > 0) this.chargeCd -= delta;
    if (this.dropCd > 0) this.dropCd -= delta;

    this.checkPhaseTransition();

    switch (this.aiState) {
      case 'walk':     this.doWalk(body, onGround);     break;
      case 'charge':   this.doCharge(body, onGround);   break;
      case 'stomp':    this.doStomp(onGround);           break;
      case 'rising':   this.doRising(body);              break;
      case 'hovering': /* controlled by delayedCall */   break;
      case 'dropping': this.doDropping(body, onGround);  break;
      case 'stunned':
        // Recover from stun once back on ground and timer elapsed
        if (this.actionTimer <= 0 && onGround) {
          this.aiState = 'walk';
          this.clearTint();
          body.setVelocityX(0);
        }
        break;
    }

    // Hard-clamp to arena
    if (this.x < ARENA_LEFT) { this.setX(ARENA_LEFT); body.setVelocityX(0); this.direction = 1; }
    if (this.x > ARENA_RIGHT) { this.setX(ARENA_RIGHT); body.setVelocityX(0); this.direction = -1; }
  }

  takeDamage(amount: number, sourceX: number = 0): void {
    if (this.isDead) return;
    this.hp = Math.max(0, this.hp - amount);
    this.scene.events.emit('wardenHurt', this.hp, this.maxHp);

    if (this.hp <= 0) {
      this.die();
      return;
    }

    // Brief hit flash; don't override phase-transition tint
    const dir = this.x > sourceX ? 1 : -1;
    (this.body as Phaser.Physics.Arcade.Body).setVelocityX(dir * 100);
    this.setTint(0xffffff);
    this.scene.time.delayedCall(140, () => { if (!this.isDead) this.clearTint(); });
  }

  getContactDamage(): number { return 1; }
  getStompDamage(): number { return 1; }

  // ── Private ────────────────────────────────────────────────────────────────

  private checkPhaseTransition(): void {
    const prev = this.phase;
    if (this.hp <= PHASE3_HP && this.phase < 3) this.phase = 3;
    else if (this.hp <= PHASE2_HP && this.phase < 2) this.phase = 2;

    if (this.phase !== prev) {
      this.enterStun(1400);
      this.scene.events.emit('wardenPhaseChange', this.phase);
    }
  }

  private doWalk(body: Phaser.Physics.Arcade.Body, onGround: boolean): void {
    if (!onGround) return;

    // Always drift toward player
    this.direction = this.playerRef!.x > this.x ? 1 : -1;
    this.setFlipX(this.direction < 0);
    body.setVelocityX(this.direction * WALK_SPEED);

    if (this.actionTimer > 0) return;

    // Action priority: drop > charge > stomp
    if (this.phase === 3 && this.dropCd <= 0) {
      this.dropCd = 4200;
      this.startRise(body);
    } else if (this.phase >= 2 && this.chargeCd <= 0) {
      this.chargeCd = 2800;
      this.startCharge(body);
    } else if (this.stompCd <= 0) {
      this.stompCd = 3200;
      this.startStomp(body);
    } else {
      // All on cooldown — brief breather so we don't spam the check
      this.actionTimer = 700;
    }
  }

  private doCharge(body: Phaser.Physics.Arcade.Body, onGround: boolean): void {
    if (!onGround) return;
    if (body.blocked.left || body.blocked.right) {
      this.endCharge(body);
    }
  }

  private doStomp(onGround: boolean): void {
    if (this.actionTimer <= 0 && onGround) {
      this.scene.events.emit('wardenStomp', this.x, this.y + 36);
      this.enterStun(650);
    }
  }

  private doRising(body: Phaser.Physics.Arcade.Body): void {
    if (body.blocked.up) {
      // Reached ceiling — freeze in hover state
      body.setVelocity(0, 0);
      body.setGravityY(-520); // negate world gravity
      this.aiState = 'hovering';
      this.dropTargetX = this.playerRef!.x;
      this.setTint(0xaa44ff);

      this.scene.time.delayedCall(500, () => {
        if (this.isDead) return;
        body.setGravityY(0); // restore gravity
        const dir = this.dropTargetX > this.x ? 1 : -1;
        body.setVelocityX(dir * DROP_X_SPEED);
        body.setVelocityY(720);
        this.aiState = 'dropping';
        this.setTint(0xff4400);
      });
    }
  }

  private doDropping(body: Phaser.Physics.Arcade.Body, onGround: boolean): void {
    if (onGround) {
      body.setVelocityX(0);
      this.scene.events.emit('wardenStomp', this.x, this.y + 36);
      this.enterStun(900);
    }
  }

  private startCharge(body: Phaser.Physics.Arcade.Body): void {
    const dir = this.playerRef!.x > this.x ? 1 : -1;
    this.direction = dir;
    this.setFlipX(dir < 0);
    body.setVelocityX(dir * CHARGE_SPEED);
    this.aiState = 'charge';
    this.setTint(0xff2222);

    // Charge has a max duration
    this.scene.time.delayedCall(750, () => {
      if (this.aiState === 'charge') {
        this.endCharge(this.body as Phaser.Physics.Arcade.Body);
      }
    });
  }

  private endCharge(body: Phaser.Physics.Arcade.Body): void {
    body.setVelocityX(0);
    this.enterStun(520);
  }

  private startStomp(body: Phaser.Physics.Arcade.Body): void {
    body.setVelocityX(0);
    this.aiState = 'stomp';
    this.actionTimer = 680; // wind-up before stomp fires
    this.setTint(0xffaa00);
  }

  private startRise(body: Phaser.Physics.Arcade.Body): void {
    body.setVelocityX(0);
    body.setVelocityY(-620);
    this.aiState = 'rising';
    this.setTint(0xaa44ff);
  }

  private enterStun(duration: number): void {
    this.aiState = 'stunned';
    this.actionTimer = duration;
    this.setTint(0x888888);
    (this.body as Phaser.Physics.Arcade.Body).setVelocityX(0);
  }

  private die(): void {
    this.isDead = true;
    this.aiState = 'dead';
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setEnable(false);
    body.setVelocity(0, 0);
    this.scene.events.emit('wardenDied');

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      y: this.y + 50,
      scaleY: 0.1,
      duration: 1400,
      ease: 'Power2',
    });
  }
}
