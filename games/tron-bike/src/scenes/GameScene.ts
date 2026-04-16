import Phaser from 'phaser';
import { Arena, COLS, ROWS, CELL } from '../game/Arena';
import { Bike, TEAM_COLORS, SPAWNS } from '../game/Bike';
import { InputHandler } from '../game/InputHandler';
import type { Team, GameState, BikeState } from '../types';
import type { SocketClient } from '../net/SocketClient';
import type { RoomInfo } from '../types';

const W = 800;
const ARENA_TOP = 40;
const H = ROWS * CELL + ARENA_TOP; // 640
const TICK_MS = 83; // ~12 ticks/sec
const WIN_ROUNDS = 2;
const FONT = "'Press Start 2P'";

interface GameInit {
  mode: 'offline' | 'host' | 'client';
  playerCount: number;
  myId?: string;
  myTeam?: Team;
  mySlot?: number;
  socket?: SocketClient;
  room?: RoomInfo;
  scores?: [number, number];
}

export class GameScene extends Phaser.Scene {
  private cfg!: GameInit;
  private arena!: Arena;
  private bikes: Bike[] = [];
  private arenaRT!: Phaser.GameObjects.RenderTexture;
  private trailGfx!: Phaser.GameObjects.Graphics;
  private headGfx!: Phaser.GameObjects.Graphics;
  private hudGfx!: Phaser.GameObjects.Graphics;
  private bigText!: Phaser.GameObjects.Text;
  private hudText!: Phaser.GameObjects.Text;
  private inputHandler!: InputHandler;

  private scores: [number, number] = [0, 0];
  private round = 0;
  private phase: 'countdown' | 'playing' | 'round_end' | 'match_end' = 'countdown';
  private countdown = 3;
  private countdownTimer = 0;
  private tickTimer = 0;
  private tick = 0;
  private roundEndTimer = 0;
  private goShown = false;

  constructor() { super('GameScene'); }

  init(data: GameInit) {
    this.cfg = data;
    this.scores = data.scores ?? [0, 0];
    this.round = 0;
  }

  create() {
    // Arena render texture (trails persist here; only redrawn on round reset)
    this.arenaRT = this.add.renderTexture(0, ARENA_TOP, W, ROWS * CELL);
    this.trailGfx = this.add.graphics();

    // Head graphics drawn each frame (on top of RT)
    this.headGfx = this.add.graphics();
    this.hudGfx  = this.add.graphics();

    this.hudText = this.add.text(W / 2, 20, '', {
      fontFamily: FONT, fontSize: '10px', color: '#ffffff', align: 'center',
    }).setOrigin(0.5).setDepth(10);

    this.bigText = this.add.text(W / 2, H / 2, '', {
      fontFamily: FONT, fontSize: '28px', color: '#ffffff', align: 'center',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(10);

    this.inputHandler = new InputHandler();

    // Online: receive state from host
    if (this.cfg.mode === 'client' && this.cfg.socket) {
      this.cfg.socket.on(e => {
        if (e.type === 'game_state') this.applyRemoteState(e.state);
        if (e.type === 'player_left') {
          this.bigText.setText('OPPONENT LEFT');
          this.time.delayedCall(2500, () => this.goMenu());
        }
      });
    }

    this.startRound();
  }

  // ── Round lifecycle ────────────────────────────────────────────────────────

  private startRound() {
    this.round++;
    this.phase = 'countdown';
    this.countdown = 3;
    this.countdownTimer = 0;
    this.tickTimer = 0;
    this.tick = 0;
    this.goShown = false;

    this.arena = new Arena();
    this.bikes = [];

    const n = Math.min(this.cfg.playerCount ?? 1, 3);
    for (let i = 0; i < n; i++) {
      this.bikes.push(new Bike(SPAWNS[i]));
      this.bikes.push(new Bike(SPAWNS[i + 3]));
    }

    this.redrawArenaRT();
  }

  // ── Update loop ────────────────────────────────────────────────────────────

  update(_t: number, delta: number) {
    if (this.cfg.mode === 'client') {
      // Client just renders whatever state arrived
      this.drawHeads();
      this.drawHud();
      return;
    }

    if (this.phase === 'countdown') {
      this.countdownTimer += delta;
      if (this.countdownTimer >= 1000) {
        this.countdownTimer -= 1000;
        this.countdown--;
        if (this.countdown < 0) {
          this.phase = 'playing';
          this.goShown = true;
          this.time.delayedCall(500, () => { this.goShown = false; });
        }
      }
      this.drawHeads();
      this.drawHud();
      return;
    }

    if (this.phase === 'playing') {
      this.tickTimer += delta;
      while (this.tickTimer >= TICK_MS) {
        this.tickTimer -= TICK_MS;
        this.processTick();
      }
      this.drawHeads();
      this.drawHud();
      return;
    }

    if (this.phase === 'round_end') {
      this.roundEndTimer += delta;
      if (this.roundEndTimer >= 2000) {
        this.roundEndTimer = 0;
        this.startRound();
      }
      this.drawHeads();
      this.drawHud();
    }

    if (this.phase === 'match_end') {
      this.drawHeads();
      this.drawHud();
    }
  }

  // ── Tick (host authority) ──────────────────────────────────────────────────

  private processTick() {
    this.tick++;
    this.handleInputs();

    const dying: Bike[] = [];
    for (const bike of this.bikes) {
      if (!bike.alive) continue;
      const survived = bike.advance(this.arena);
      if (!survived) dying.push(bike);
    }

    // Paint dirty trails onto RenderTexture
    this.paintDirtyTrails();

    // Check round end
    const alive6 = this.bikes.filter(b => b.team === 6 && b.alive).length;
    const alive7 = this.bikes.filter(b => b.team === 7 && b.alive).length;

    if (alive6 === 0 || alive7 === 0) {
      if (alive6 > alive7) this.scores[0]++;
      else if (alive7 > alive6) this.scores[1]++;

      if (this.scores[0] >= WIN_ROUNDS || this.scores[1] >= WIN_ROUNDS) {
        this.phase = 'match_end';
      } else {
        this.phase = 'round_end';
        this.roundEndTimer = 0;
      }
    }

    // Broadcast state to online clients
    if (this.cfg.mode === 'host' && this.cfg.socket) {
      this.cfg.socket.sendState(this.buildState());
    }
  }

  private handleInputs() {
    const mode = this.cfg.mode;

    if (mode === 'offline') {
      // Local 2-player: P1=WASD → Team 6, P2=Arrows → Team 7
      const d1 = this.inputHandler.consumeP1();
      const d2 = this.inputHandler.consumeP2();
      if (d1) this.getBike(6, 0)?.turn(d1);
      if (d2) this.getBike(7, 0)?.turn(d2);
    } else if (mode === 'host') {
      // My own input
      const dir = this.inputHandler.consumeAny();
      if (dir) {
        const myTeam = this.cfg.myTeam;
        if (myTeam) this.getBike(myTeam, 0)?.turn(dir);
      }
      // Remote inputs come via socket events (handled in create())
    }
  }

  private getBike(team: Team, slot: number): Bike | undefined {
    return this.bikes.filter(b => b.team === team)[slot];
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  private redrawArenaRT() {
    this.trailGfx.clear();

    // Background
    this.trailGfx.fillStyle(0x050510);
    this.trailGfx.fillRect(0, 0, W, ROWS * CELL);

    // Walls
    for (let x = 0; x < COLS; x++) {
      this.trailGfx.fillStyle(0x1a1a3a);
      this.trailGfx.fillRect(x * CELL, 0, CELL, CELL);
      this.trailGfx.fillRect(x * CELL, (ROWS - 1) * CELL, CELL, CELL);
    }
    for (let y = 1; y < ROWS - 1; y++) {
      this.trailGfx.fillStyle(0x1a1a3a);
      this.trailGfx.fillRect(0, y * CELL, CELL, CELL);
      this.trailGfx.fillRect((COLS - 1) * CELL, y * CELL, CELL, CELL);
    }

    this.arenaRT.clear();
    this.arenaRT.draw(this.trailGfx, 0, 0);
    this.trailGfx.clear();
  }

  private paintDirtyTrails() {
    this.trailGfx.clear();
    for (const bike of this.bikes) {
      if (bike.dirtyTrail.length === 0) continue;
      const c = TEAM_COLORS[bike.team];
      for (const [tx, ty] of bike.dirtyTrail) {
        const px = tx * CELL;
        const py = ty * CELL;
        this.trailGfx.fillStyle(c.glow);
        this.trailGfx.fillRect(px, py, CELL, CELL);
        this.trailGfx.fillStyle(c.main);
        this.trailGfx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
      }
      bike.clearDirty();
    }
    if (this.trailGfx.commandBuffer.length > 0) {
      this.arenaRT.draw(this.trailGfx, 0, 0);
    }
    this.trailGfx.clear();
  }

  private drawHeads() {
    this.headGfx.clear();
    for (const bike of this.bikes) {
      if (!bike.alive) continue;
      const c = TEAM_COLORS[bike.team];
      const px = bike.x * CELL;
      const py = bike.y * CELL + ARENA_TOP;
      // Glow ring
      this.headGfx.fillStyle(c.glow);
      this.headGfx.fillRect(px - 2, py - 2, CELL + 4, CELL + 4);
      // Head
      this.headGfx.fillStyle(c.main);
      this.headGfx.fillRect(px, py, CELL, CELL);
      // Bright core
      this.headGfx.fillStyle(0xffffff);
      this.headGfx.fillRect(px + 3, py + 3, CELL - 6, CELL - 6);
    }
  }

  private drawHud() {
    this.hudGfx.clear();
    this.hudGfx.fillStyle(0x080818);
    this.hudGfx.fillRect(0, 0, W, ARENA_TOP);
    // Team 6 color bar
    this.hudGfx.fillStyle(0x00FFFF);
    this.hudGfx.fillRect(0, 0, 4, ARENA_TOP);
    // Team 7 color bar
    this.hudGfx.fillStyle(0xFF6B00);
    this.hudGfx.fillRect(W - 4, 0, 4, ARENA_TOP);

    this.hudText.setText(
      `TEAM 6  ${this.scores[0]} : ${this.scores[1]}  TEAM 7`
    );

    // Big center text
    if (this.phase === 'countdown') {
      const str = this.countdown > 0 ? String(this.countdown) : (this.goShown ? 'GO!' : '');
      this.bigText.setText(str).setColor('#ffffff');
    } else if (this.phase === 'round_end') {
      const w = this.scores[0] > this.scores[1] ? 6
              : this.scores[1] > this.scores[0] ? 7 : 0;
      this.bigText
        .setText(w ? `TEAM ${w} WINS ROUND!` : 'TIE ROUND!')
        .setColor(w === 6 ? '#00FFFF' : w === 7 ? '#FF6B00' : '#ffffff');
    } else if (this.phase === 'match_end') {
      const w = this.scores[0] >= WIN_ROUNDS ? 6 : 7;
      this.bigText
        .setText(`TEAM ${w}\nWINS THE MATCH!`)
        .setColor(w === 6 ? '#00FFFF' : '#FF6B00');
      // Show rematch prompt after short delay
      if (!this.children.getByName('rematch_btn')) {
        this.time.delayedCall(1200, () => this.showMatchEndButtons(w));
      }
    } else {
      this.bigText.setText('');
    }
  }

  private showMatchEndButtons(_winner: Team) {
    const r = this.add.text(W / 2, H / 2 + 100, '[ REMATCH ]', {
      fontFamily: FONT, fontSize: '14px', color: '#39ff14',
    }).setOrigin(0.5).setName('rematch_btn').setDepth(20).setInteractive({ useHandCursor: true });

    const m = this.add.text(W / 2, H / 2 + 140, '[ MAIN MENU ]', {
      fontFamily: FONT, fontSize: '11px', color: '#556677',
    }).setOrigin(0.5).setDepth(20).setInteractive({ useHandCursor: true });

    r.on('pointerdown', () => {
      r.destroy(); m.destroy();
      this.scores = [0, 0];
      this.startRound();
    });
    m.on('pointerdown', () => this.goMenu());

    // Keyboard
    const kd = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        window.removeEventListener('keydown', kd);
        r.destroy(); m.destroy();
        this.scores = [0, 0];
        this.startRound();
      }
      if (e.key === 'Escape') {
        window.removeEventListener('keydown', kd);
        this.goMenu();
      }
    };
    window.addEventListener('keydown', kd);
  }

  // ── Remote state (client mode) ─────────────────────────────────────────────

  private applyRemoteState(state: GameState) {
    this.scores = state.scores;
    this.countdown = state.countdown;
    this.phase = state.phase;

    // Sync bikes from state
    for (const bs of state.bikes) {
      let bike = this.bikes.find(b => b.id === bs.id);
      if (!bike) {
        const spawn = SPAWNS.find(s => s.id === bs.id);
        if (spawn) {
          bike = new Bike(spawn);
          this.bikes.push(bike);
        } else continue;
      }
      const prevX = bike.x, prevY = bike.y;
      bike.x = bs.x;
      bike.y = bs.y;
      bike.dir = bs.dir;
      bike.alive = bs.alive;

      if (bs.alive && (prevX !== bs.x || prevY !== bs.y)) {
        bike.dirtyTrail.push([prevX, prevY]);
      }
    }

    // Repaint trails from server grid on round start
    if (state.phase === 'countdown' && state.tick === 0) {
      this.arena.fromArray(state.trails);
      this.redrawArenaRT();
      for (const bike of this.bikes) bike.clearDirty();
    } else {
      this.paintDirtyTrails();
    }
  }

  private buildState(): GameState {
    return {
      tick: this.tick,
      bikes: this.bikes.map<BikeState>(b => ({
        id: b.id, x: b.x, y: b.y,
        dir: b.dir, team: b.team, alive: b.alive,
      })),
      trails: this.arena.toArray(),
      phase: this.phase,
      scores: this.scores,
      countdown: this.countdown,
    };
  }

  private goMenu() {
    this.cfg.socket?.disconnect();
    this.inputHandler.destroy();
    this.scene.start('MenuScene');
  }

  shutdown() {
    this.inputHandler?.destroy();
  }
}
