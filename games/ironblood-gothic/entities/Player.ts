import Phaser from 'phaser';

// ── Constants ─────────────────────────────────────────────────────────────────
const WALK_SPEED = 185;
const JUMP_VELOCITY = -510;
const ATTACK_DURATION = 190;
const ATTACK_COOLDOWN = 370;
const INVINCIBLE_DURATION = 900;
const MELEE_REACH = 56;
const MAX_HP = 3;
const KNOCKBACK_X = 240;
const KNOCKBACK_Y = -190;

// ── Types ─────────────────────────────────────────────────────────────────────
export type PlayerState = 'idle' | 'walk' | 'jump' | 'crouch' | 'attack' | 'hurt' | 'dead';

// ── Player ────────────────────────────────────────────────────────────────────
export class Player extends Phaser.Physics.Arcade.Sprite {
  hp: number = MAX_HP;
  readonly maxHp: number = MAX_HP;
  state: PlayerState = 'idle';

  isAttacking: boolean = false;
  isInvincible: boolean = false;
  // Tracks which objects were hit in this swing; cleared on attack end
  attackHitSet: Set<object> = new Set();

  checkpointX: number;
  checkpointY: number;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private attackKey!: Phaser.Input.Keyboard.Key;
  private grenadeKey!: Phaser.Input.Keyboard.Key;

  private attackTimer: number = 0;
  private attackCooldown: number = 0;
  private invincibleTimer: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');
    this.checkpointX = x;
    this.checkpointY = y;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(20, 44);
    body.setOffset(2, 2);

    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.attackKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.grenadeKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
  }

  update(delta: number): void {
    if (this.state === 'dead') return;

    const body = this.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down;

    this.tickTimers(delta, onGround);
    if (this.state === 'hurt') return;

    const crouching = this.cursors.down.isDown && onGround;

    this.handleMovement(body, onGround, crouching);
    this.handleJump(body, onGround, crouching);
    this.handleAttack(crouching);
    this.handleGrenade();
    this.updateCrouchBody(body, crouching);
    this.deriveState(body, onGround, crouching);
  }

  getMeleeReach(): number { return MELEE_REACH; }

  takeDamage(amount: number, sourceX: number): void {
    if (this.isInvincible || this.state === 'dead') return;

    this.hp = Math.max(0, this.hp - amount);
    if (this.hp === 0) {
      this.die();
      return;
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(this.x > sourceX ? KNOCKBACK_X : -KNOCKBACK_X);
    body.setVelocityY(KNOCKBACK_Y);

    this.state = 'hurt';
    this.isInvincible = true;
    this.invincibleTimer = INVINCIBLE_DURATION;
    this.setTint(0xff4444);

    this.scene.time.delayedCall(280, () => {
      if (this.state === 'hurt') {
        this.state = 'idle';
        this.clearTint();
      }
    });

    this.scene.events.emit('playerHurt', this.hp);
  }

  respawn(): void {
    this.hp = MAX_HP;
    this.state = 'idle';
    this.isInvincible = false;
    this.isAttacking = false;
    this.invincibleTimer = 0;
    this.attackTimer = 0;
    this.attackCooldown = 0;
    this.attackHitSet.clear();
    this.clearTint();
    this.setAlpha(1);
    this.setPosition(this.checkpointX, this.checkpointY - 20);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setEnable(true);
    body.setVelocity(0, 0);
    body.setSize(20, 44);
    body.setOffset(2, 2);

    this.scene.events.emit('playerRespawned', MAX_HP);
  }

  setCheckpoint(x: number, y: number): void {
    this.checkpointX = x;
    this.checkpointY = y;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private tickTimers(delta: number, onGround: boolean): void {
    if (this.attackTimer > 0) {
      this.attackTimer -= delta;
      if (this.attackTimer <= 0) {
        this.attackTimer = 0;
        this.isAttacking = false;
        this.attackHitSet.clear();
        if (this.state === 'attack') {
          this.state = onGround ? 'idle' : 'jump';
        }
        this.clearTint();
      }
    }
    if (this.attackCooldown > 0) this.attackCooldown -= delta;

    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= delta;
      this.setAlpha(Math.floor(this.invincibleTimer / 90) % 2 === 0 ? 1 : 0.35);
      if (this.invincibleTimer <= 0) {
        this.invincibleTimer = 0;
        this.isInvincible = false;
        this.setAlpha(1);
      }
    }
  }

  private handleMovement(body: Phaser.Physics.Arcade.Body, onGround: boolean, crouching: boolean): void {
    // Lock horizontal movement on ground during melee swing
    if (this.state === 'attack' && onGround) {
      body.setVelocityX(0);
      return;
    }
    if (this.cursors.left.isDown && !crouching) {
      body.setVelocityX(-WALK_SPEED);
      this.setFlipX(true);
    } else if (this.cursors.right.isDown && !crouching) {
      body.setVelocityX(WALK_SPEED);
      this.setFlipX(false);
    } else {
      body.setVelocityX(0);
    }
  }

  private handleJump(body: Phaser.Physics.Arcade.Body, onGround: boolean, crouching: boolean): void {
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up) && onGround && !crouching) {
      body.setVelocityY(JUMP_VELOCITY);
      this.state = 'jump';
    }
  }

  private handleAttack(crouching: boolean): void {
    if (Phaser.Input.Keyboard.JustDown(this.attackKey) && this.attackCooldown <= 0 && !crouching) {
      this.attackTimer = ATTACK_DURATION;
      this.attackCooldown = ATTACK_COOLDOWN;
      this.isAttacking = true;
      this.state = 'attack';
      this.setTint(0xffdd88);
    }
  }

  private handleGrenade(): void {
    if (Phaser.Input.Keyboard.JustDown(this.grenadeKey)) {
      this.scene.events.emit('playerThrowGrenade', this.x, this.y - 16, this.flipX ? -1 : 1);
    }
  }

  private updateCrouchBody(body: Phaser.Physics.Arcade.Body, crouching: boolean): void {
    if (crouching) {
      body.setSize(20, 28);
      body.setOffset(2, 18);
    } else if (this.state !== 'attack') {
      body.setSize(20, 44);
      body.setOffset(2, 2);
    }
  }

  private deriveState(body: Phaser.Physics.Arcade.Body, onGround: boolean, crouching: boolean): void {
    if (this.state === 'attack' || this.state === 'hurt') return;
    if (!onGround) {
      this.state = 'jump';
    } else if (crouching) {
      this.state = 'crouch';
    } else if (body.velocity.x !== 0) {
      this.state = 'walk';
    } else {
      this.state = 'idle';
    }
  }

  private die(): void {
    this.state = 'dead';
    this.setTint(0x440000);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setEnable(false);

    this.scene.events.emit('playerDied');
    this.scene.time.delayedCall(2000, () => this.respawn());
  }
}
