import Phaser from 'phaser';

// ── Constants ─────────────────────────────────────────────────────────────────
const PATROL_SPEED = 62;
const CHASE_SPEED = 115;
const DETECT_RANGE = 230;
const ATTACK_RANGE = 46;
const LUNGE_SPEED = 290;
const ATTACK_COOLDOWN = 1500;
const STAGGER_DURATION = 360;
const RELIC_DROP = 2;

// ── Types ─────────────────────────────────────────────────────────────────────
type GhoulAIState = 'patrol' | 'chase' | 'lunge' | 'stagger' | 'dead';

// ── TrenchGhoul ───────────────────────────────────────────────────────────────
export class TrenchGhoul extends Phaser.Physics.Arcade.Sprite {
  hp: number = 2;
  isDead: boolean = false;

  private aiState: GhoulAIState = 'patrol';
  private patrolLeft: number;
  private patrolRight: number;
  private direction: number = 1;
  private attackCooldown: number = 0;
  private staggerTimer: number = 0;
  private playerRef: Phaser.Physics.Arcade.Sprite | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    patrolLeft: number,
    patrolRight: number,
  ) {
    super(scene, x, y, 'ghoul');
    this.patrolLeft = patrolLeft;
    this.patrolRight = patrolRight;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(9);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(28, 44);
    body.setOffset(2, 2);
  }

  setPlayer(player: Phaser.Physics.Arcade.Sprite): void {
    this.playerRef = player;
  }

  update(delta: number): void {
    if (this.isDead || !this.playerRef) return;

    const body = this.body as Phaser.Physics.Arcade.Body;

    if (this.attackCooldown > 0) this.attackCooldown -= delta;

    if (this.staggerTimer > 0) {
      this.staggerTimer -= delta;
      if (this.staggerTimer <= 0) {
        this.staggerTimer = 0;
        this.aiState = this.playerRef
          ? (Math.abs(this.x - this.playerRef.x) < DETECT_RANGE ? 'chase' : 'patrol')
          : 'patrol';
        this.clearTint();
      }
      return;
    }

    const dx = this.playerRef.x - this.x;
    const dy = this.playerRef.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const sameLevel = Math.abs(dy) < 90;

    switch (this.aiState) {
      case 'patrol': this.doPatrol(body, dist, sameLevel); break;
      case 'chase':  this.doChase(body, dist, sameLevel);  break;
      case 'lunge':
        // Lunge velocity already applied; recover when it slows
        if (Math.abs(body.velocity.x) < 40) {
          this.aiState = 'chase';
        }
        break;
    }
  }

  takeDamage(amount: number, sourceX: number = 0): void {
    if (this.isDead) return;
    this.hp -= amount;

    if (this.hp <= 0) {
      this.die(sourceX);
      return;
    }

    this.aiState = 'stagger';
    this.staggerTimer = STAGGER_DURATION;
    this.setTint(0xffffff);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(this.x > sourceX ? 170 : -170);
    body.setVelocityY(-110);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private doPatrol(body: Phaser.Physics.Arcade.Body, dist: number, sameLevel: boolean): void {
    if (dist < DETECT_RANGE && sameLevel) {
      this.aiState = 'chase';
      return;
    }

    body.setVelocityX(this.direction * PATROL_SPEED);
    this.setFlipX(this.direction < 0);

    if (this.x <= this.patrolLeft) this.direction = 1;
    else if (this.x >= this.patrolRight) this.direction = -1;
  }

  private doChase(body: Phaser.Physics.Arcade.Body, dist: number, sameLevel: boolean): void {
    if (dist > DETECT_RANGE * 1.5 || !sameLevel) {
      this.aiState = 'patrol';
      return;
    }

    if (dist < ATTACK_RANGE && this.attackCooldown <= 0) {
      this.doLunge(body);
      return;
    }

    const dir = this.playerRef!.x > this.x ? 1 : -1;
    body.setVelocityX(dir * CHASE_SPEED);
    this.setFlipX(dir < 0);
  }

  private doLunge(body: Phaser.Physics.Arcade.Body): void {
    const dir = this.playerRef!.x > this.x ? 1 : -1;
    body.setVelocityX(dir * LUNGE_SPEED);
    body.setVelocityY(-80);
    this.attackCooldown = ATTACK_COOLDOWN;
    this.aiState = 'lunge';
    this.setTint(0xff6666);
    this.scene.time.delayedCall(200, () => {
      if (!this.isDead) this.clearTint();
    });
  }

  private die(sourceX: number): void {
    this.isDead = true;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setEnable(false);
    // Slight death kick
    body.setVelocityX(this.x > sourceX ? 80 : -80);
    body.setVelocityY(-60);

    this.setTint(0x222233);
    this.scene.events.emit('enemyDied', this.x, this.y, RELIC_DROP);

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 800,
      delay: 500,
      onComplete: () => this.destroy(),
    });
  }
}
