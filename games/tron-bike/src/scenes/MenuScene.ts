import Phaser from 'phaser';

const W = 800;
const H = 640;
const FONT = "'Press Start 2P'";

interface MenuItem {
  label: string;
  sub: string;
  color: string;
  action: () => void;
}

export class MenuScene extends Phaser.Scene {
  private selected = 0;
  private items: MenuItem[] = [];
  private nameInput = '';
  private enteringName = false;
  private enteringCode = false;
  private roomCode = '';
  private serverUrl = '';
  private nameText!: Phaser.GameObjects.Text;
  private codeText!: Phaser.GameObjects.Text;
  private keyDown!: (e: KeyboardEvent) => void;

  constructor() { super('MenuScene'); }

  init() {
    this.selected = 0;
    this.nameInput = localStorage.getItem('tron_name') ?? 'RIDER';
    this.serverUrl = localStorage.getItem('tron_server') ?? (
      window.location.hostname === 'localhost'
        ? 'http://localhost:3001'
        : 'https://tron-server.fly.dev'
    );
    this.enteringName = false;
    this.enteringCode = false;
    this.roomCode = '';
  }

  create() {
    const g = this.add.graphics();
    // Background gradient
    g.fillStyle(0x050510);
    g.fillRect(0, 0, W, H);

    // Grid lines
    g.lineStyle(1, 0x111133, 0.5);
    for (let x = 0; x < W; x += 40) { g.lineBetween(x, 0, x, H); }
    for (let y = 0; y < H; y += 40) { g.lineBetween(0, y, W, y); }

    // Title
    this.add.text(W / 2, 80, 'TRON', {
      fontFamily: FONT, fontSize: '56px', color: '#00FFFF',
      stroke: '#006666', strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(W / 2, 140, 'SPEED BIKE', {
      fontFamily: FONT, fontSize: '22px', color: '#FF6B00',
      stroke: '#773300', strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(W / 2, 170, '— TEAM 6  vs  TEAM 7 —', {
      fontFamily: FONT, fontSize: '9px', color: '#555577',
    }).setOrigin(0.5);

    // Name row
    this.add.text(120, 230, 'RIDER NAME:', {
      fontFamily: FONT, fontSize: '8px', color: '#556677',
    }).setOrigin(0, 0.5);

    this.nameText = this.add.text(360, 230, `[ ${this.nameInput} ]`, {
      fontFamily: FONT, fontSize: '9px', color: '#00FFFF',
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

    this.nameText.on('pointerdown', () => { this.enteringName = true; this.refreshNameText(); });

    // Menu items
    this.items = [
      {
        label: 'LOCAL  GAME',
        sub: 'WASD vs ARROW KEYS — SAME PC',
        color: '#00FFFF',
        action: () => this.startLocal(),
      },
      {
        label: 'FIND  MATCH',
        sub: 'SEARCH FOR AN OPPONENT ONLINE',
        color: '#39ff14',
        action: () => this.startMatchmaking(),
      },
      {
        label: 'CREATE  ROOM',
        sub: 'PRIVATE LOBBY — SHARE A CODE',
        color: '#FF6B00',
        action: () => this.createPrivate(),
      },
      {
        label: 'JOIN  ROOM',
        sub: 'ENTER A PRIVATE LOBBY CODE',
        color: '#FF2D78',
        action: () => { this.enteringCode = true; this.refreshCodeText(); },
      },
    ];

    const startY = 300;
    this.items.forEach((item, i) => {
      const y = startY + i * 72;
      const sel = this.add.graphics();
      sel.setName(`sel_${i}`);
      const bg = this.add.graphics();
      bg.fillStyle(0x0a0a1a);
      bg.fillRect(100, y - 22, 600, 50);
      const txt = this.add.text(200, y, item.label, {
        fontFamily: FONT, fontSize: '13px', color: item.color,
      }).setOrigin(0, 0.5).setName(`item_${i}`).setInteractive({ useHandCursor: true });
      this.add.text(200, y + 18, item.sub, {
        fontFamily: FONT, fontSize: '6px', color: '#334455',
      }).setOrigin(0, 0.5);

      txt.on('pointerover',  () => { this.selected = i; this.refreshSelector(); });
      txt.on('pointerdown',  () => item.action());
    });

    // Code input display (hidden until JOIN selected)
    this.codeText = this.add.text(W / 2, 594, '', {
      fontFamily: FONT, fontSize: '10px', color: '#FF2D78',
    }).setOrigin(0.5);

    this.add.text(W / 2, 616, '', {
      fontFamily: FONT, fontSize: '7px', color: '#445566',
    }).setOrigin(0.5);

    this.add.text(W / 2, H - 16, 'CLICK / ENTER TO SELECT   ↑↓ NAVIGATE', {
      fontFamily: FONT, fontSize: '6px', color: '#222233',
    }).setOrigin(0.5);

    this.refreshSelector();

    this.keyDown = this.handleKey.bind(this);
    window.addEventListener('keydown', this.keyDown);
  }

  private refreshSelector() {
    for (let i = 0; i < this.items.length; i++) {
      const txt = this.children.getByName(`item_${i}`) as Phaser.GameObjects.Text | null;
      if (txt) txt.setAlpha(i === this.selected ? 1 : 0.35);
    }
  }

  private refreshNameText() {
    const cursor = this.enteringName ? '_' : '';
    this.nameText.setText(`[ ${this.nameInput}${cursor} ]`);
    this.nameText.setColor(this.enteringName ? '#ffffff' : '#00FFFF');
  }

  private refreshCodeText() {
    if (this.enteringCode) {
      this.codeText.setText(`ENTER CODE: ${this.roomCode}_`);
    } else {
      this.codeText.setText('');
    }
  }

  private handleKey(e: KeyboardEvent) {
    if (this.enteringName) {
      if (e.key === 'Enter' || e.key === 'Escape') {
        this.enteringName = false;
        if (this.nameInput.length === 0) this.nameInput = 'RIDER';
        localStorage.setItem('tron_name', this.nameInput);
        this.refreshNameText();
        return;
      }
      if (e.key === 'Backspace') {
        this.nameInput = this.nameInput.slice(0, -1);
      } else if (e.key.length === 1 && this.nameInput.length < 12) {
        this.nameInput += e.key.toUpperCase();
      }
      this.refreshNameText();
      return;
    }

    if (this.enteringCode) {
      if (e.key === 'Enter') {
        if (this.roomCode.length === 6) this.joinPrivate(this.roomCode);
        return;
      }
      if (e.key === 'Escape') { this.enteringCode = false; this.refreshCodeText(); return; }
      if (e.key === 'Backspace') { this.roomCode = this.roomCode.slice(0, -1); }
      else if (e.key.length === 1 && this.roomCode.length < 6) {
        this.roomCode += e.key.toUpperCase();
      }
      this.refreshCodeText();
      return;
    }

    if (e.key === 'ArrowUp')   { this.selected = Math.max(0, this.selected - 1); this.refreshSelector(); }
    if (e.key === 'ArrowDown') { this.selected = Math.min(this.items.length - 1, this.selected + 1); this.refreshSelector(); }
    if (e.key === 'Enter')     { this.items[this.selected].action(); }
  }

  private startLocal() {
    window.removeEventListener('keydown', this.keyDown);
    this.scene.start('GameScene', {
      mode: 'offline',
      playerCount: 1,
    });
  }

  private startMatchmaking() {
    window.removeEventListener('keydown', this.keyDown);
    this.scene.start('LobbyScene', {
      lobbyMode: 'matchmaking',
      name: this.nameInput,
      serverUrl: this.serverUrl,
    });
  }

  private createPrivate() {
    window.removeEventListener('keydown', this.keyDown);
    this.scene.start('LobbyScene', {
      lobbyMode: 'private_host',
      name: this.nameInput,
      serverUrl: this.serverUrl,
    });
  }

  private joinPrivate(code: string) {
    window.removeEventListener('keydown', this.keyDown);
    this.scene.start('LobbyScene', {
      lobbyMode: 'private_join',
      name: this.nameInput,
      serverUrl: this.serverUrl,
      code,
    });
  }

  shutdown() {
    window.removeEventListener('keydown', this.keyDown);
  }
}
