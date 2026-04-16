import Phaser from 'phaser';
import { SocketClient } from '../net/SocketClient';
import type { RoomInfo } from '../types';

const W = 800;
const H = 640;
const FONT = "'Press Start 2P'";

interface LobbyInit {
  lobbyMode: 'matchmaking' | 'private_host' | 'private_join';
  name: string;
  serverUrl: string;
  code?: string;
}

export class LobbyScene extends Phaser.Scene {
  private socket!: SocketClient;
  private cfg!: LobbyInit;
  private room: RoomInfo | null = null;
  private statusLine = '';
  private queueCount = 0;
  private connecting = true;
  private dots = 0;
  private dotsTimer = 0;

  private statusText!: Phaser.GameObjects.Text;
  private roomCodeText!: Phaser.GameObjects.Text;
  private playerListText!: Phaser.GameObjects.Text;
  private actionText!: Phaser.GameObjects.Text;
  private backText!: Phaser.GameObjects.Text;
  private keyDown!: (e: KeyboardEvent) => void;

  constructor() { super('LobbyScene'); }

  init(data: LobbyInit) {
    this.cfg = data;
    this.room = null;
    this.connecting = true;
    this.statusLine = 'CONNECTING...';
  }

  async create() {
    const g = this.add.graphics();
    g.fillStyle(0x050510);
    g.fillRect(0, 0, W, H);
    g.lineStyle(1, 0x111133, 0.4);
    for (let x = 0; x < W; x += 40) g.lineBetween(x, 0, x, H);
    for (let y = 0; y < H; y += 40) g.lineBetween(0, y, W, y);

    const titleLabel = {
      matchmaking:   'MATCHMAKING',
      private_host:  'PRIVATE LOBBY',
      private_join:  'JOINING LOBBY',
    }[this.cfg.lobbyMode];

    this.add.text(W / 2, 60, titleLabel, {
      fontFamily: FONT, fontSize: '20px', color: '#00FFFF',
      stroke: '#003333', strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(W / 2, 92, '— TEAM 6  vs  TEAM 7 —', {
      fontFamily: FONT, fontSize: '8px', color: '#334455',
    }).setOrigin(0.5);

    this.roomCodeText = this.add.text(W / 2, 150, '', {
      fontFamily: FONT, fontSize: '28px', color: '#FF6B00',
      stroke: '#773300', strokeThickness: 4,
    }).setOrigin(0.5);

    this.statusText = this.add.text(W / 2, 220, '', {
      fontFamily: FONT, fontSize: '10px', color: '#556677',
    }).setOrigin(0.5);

    this.playerListText = this.add.text(W / 2, 320, '', {
      fontFamily: FONT, fontSize: '9px', color: '#aabbcc',
      align: 'center', lineSpacing: 10,
    }).setOrigin(0.5);

    this.actionText = this.add.text(W / 2, 520, '', {
      fontFamily: FONT, fontSize: '11px', color: '#39ff14',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.actionText.on('pointerdown', () => this.onAction());

    this.backText = this.add.text(W / 2, 570, '[ BACK TO MENU ]', {
      fontFamily: FONT, fontSize: '8px', color: '#445566',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.backText.on('pointerdown', () => this.goBack());

    this.keyDown = this.handleKey.bind(this);
    window.addEventListener('keydown', this.keyDown);

    this.socket = new SocketClient();
    try {
      await this.socket.connect(this.cfg.serverUrl);
    } catch {
      this.statusLine = 'CONNECTION FAILED\nCHECK SERVER URL';
      this.connecting = false;
      this.refresh();
      return;
    }

    this.connecting = false;
    this.socket.on(e => {
      if (e.type === 'disconnected') {
        this.statusLine = 'DISCONNECTED';
        this.refresh();
      }
      if (e.type === 'queue_count') {
        this.queueCount = e.count;
        this.refresh();
      }
      if (e.type === 'room_created' || e.type === 'room_joined' || e.type === 'room_updated') {
        this.room = e.room;
        this.refresh();
      }
      if (e.type === 'room_error') {
        this.statusLine = e.message;
        this.refresh();
      }
      if (e.type === 'game_start') {
        this.room = e.room;
        this.launchGame();
      }
    });

    if (this.cfg.lobbyMode === 'matchmaking') {
      this.socket.joinQueue(this.cfg.name);
      this.statusLine = 'SEARCHING FOR OPPONENT...';
    } else if (this.cfg.lobbyMode === 'private_host') {
      this.socket.createRoom(this.cfg.name);
      this.statusLine = 'CREATING ROOM...';
    } else if (this.cfg.lobbyMode === 'private_join' && this.cfg.code) {
      this.socket.joinRoom(this.cfg.code, this.cfg.name);
      this.statusLine = 'JOINING ROOM...';
    }

    this.refresh();
  }

  update(_t: number, delta: number) {
    this.dotsTimer += delta;
    if (this.dotsTimer > 400) {
      this.dotsTimer = 0;
      this.dots = (this.dots + 1) % 4;
      this.refresh();
    }
  }

  private refresh() {
    const dot = '.'.repeat(this.dots);

    if (this.connecting) {
      this.statusText.setText(`CONNECTING${dot}`);
      this.roomCodeText.setText('');
      this.playerListText.setText('');
      this.actionText.setText('');
      return;
    }

    if (!this.room) {
      // In queue or waiting for room
      if (this.cfg.lobbyMode === 'matchmaking') {
        this.statusText.setText(`SEARCHING${dot}\n\nIN QUEUE: ${this.queueCount}`);
      } else {
        this.statusText.setText(this.statusLine + (this.statusLine.endsWith('...') ? dot : ''));
      }
      this.roomCodeText.setText('');
      this.playerListText.setText('');
      this.actionText.setText('');
      return;
    }

    // Room established
    const isHost = this.room.hostId === this.socket.id;

    if (this.cfg.lobbyMode !== 'matchmaking') {
      this.roomCodeText.setText(`CODE: ${this.room.code}`);
    } else {
      this.roomCodeText.setText('MATCH FOUND!');
    }

    this.statusText.setText(`PLAYERS: ${this.room.players.length}/6`);

    const lines = this.room.players.map(p => {
      const teamColor = p.team === 6 ? '[T6]' : '[T7]';
      const readyStr = p.ready ? '✓' : '○';
      const hostMark = p.id === this.room!.hostId ? ' ♛' : '';
      return `${readyStr} ${teamColor} ${p.name}${hostMark}`;
    });
    this.playerListText.setText(lines.join('\n'));

    const myPlayer = this.room.players.find(p => p.id === this.socket.id);
    const imReady = myPlayer?.ready ?? false;

    if (isHost) {
      const allReady = this.room.players.every(p => p.ready);
      this.actionText.setText(allReady ? '[ START GAME ]' : '[ WAITING FOR READY... ]');
      this.actionText.setColor(allReady ? '#39ff14' : '#445566');
    } else {
      this.actionText.setText(imReady ? '[ READY ✓ ]' : '[ MARK READY ]');
      this.actionText.setColor(imReady ? '#39ff14' : '#00FFFF');
    }
  }

  private onAction() {
    if (!this.room) return;
    const isHost = this.room.hostId === this.socket.id;
    if (isHost) {
      const allReady = this.room.players.every(p => p.ready);
      if (allReady) this.socket.startGame();
    } else {
      this.socket.setReady();
    }
  }

  private handleKey(e: KeyboardEvent) {
    if (e.key === 'Enter') this.onAction();
    if (e.key === 'Escape') this.goBack();
  }

  private launchGame() {
    if (!this.room) return;
    const myPlayer = this.room.players.find(p => p.id === this.socket.id);
    const isHost = this.room.hostId === this.socket.id;
    window.removeEventListener('keydown', this.keyDown);
    this.scene.start('GameScene', {
      mode: isHost ? 'host' : 'client',
      playerCount: 1,
      myId: this.socket.id,
      myTeam: myPlayer?.team,
      mySlot: 0,
      roomCode: this.room.code,
      socket: this.socket,
      room: this.room,
    });
  }

  private goBack() {
    this.socket?.leaveQueue();
    this.socket?.disconnect();
    window.removeEventListener('keydown', this.keyDown);
    this.scene.start('MenuScene');
  }

  shutdown() {
    window.removeEventListener('keydown', this.keyDown);
    if (this.socket?.connected) {
      this.socket.leaveQueue();
    }
  }
}
