import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    this.generateTextures();
    this.scene.start('Chapter1Scene');
  }

  private generateTextures(): void {
    const g = this.add.graphics();

    // ── Player: Mira Vasek (olive scout) ──────────────────────────────
    g.fillStyle(0x5a7840, 1);
    g.fillRect(0, 0, 24, 48);
    g.fillStyle(0xd4a574, 1);    // face
    g.fillRect(5, 2, 14, 14);
    g.fillStyle(0x3d2b1f, 1);    // belt
    g.fillRect(0, 28, 24, 4);
    g.fillStyle(0x8a9c6e, 1);    // collar
    g.fillRect(7, 14, 10, 6);
    g.generateTexture('player', 24, 48);
    g.clear();

    // ── Trench Ghoul (undead soldier, grey-blue) ──────────────────────
    g.fillStyle(0x3d4a5c, 1);
    g.fillRect(0, 0, 32, 48);
    g.fillStyle(0x6b6b55, 1);    // decayed face
    g.fillRect(6, 2, 20, 18);
    g.fillStyle(0xcc2222, 1);    // eye glow
    g.fillRect(9, 8, 4, 4);
    g.fillRect(19, 8, 4, 4);
    g.fillStyle(0x2a3340, 1);    // armor detail
    g.fillRect(0, 20, 32, 4);
    g.generateTexture('ghoul', 32, 48);
    g.clear();

    // ── Warden (vampire lord, deep purple) ────────────────────────────
    g.fillStyle(0x2d1248, 1);
    g.fillRect(0, 0, 64, 80);
    g.fillStyle(0x5a2d8c, 1);    // chest armor
    g.fillRect(8, 24, 48, 40);
    g.fillStyle(0x8b4a6e, 1);    // head
    g.fillRect(16, 2, 32, 26);
    g.fillStyle(0xff6600, 1);    // eye glow
    g.fillRect(21, 10, 8, 8);
    g.fillRect(35, 10, 8, 8);
    g.fillStyle(0x3d1a6b, 1);    // shoulder pads
    g.fillRect(0, 20, 18, 18);
    g.fillRect(46, 20, 18, 18);
    g.fillStyle(0x1a0a2e, 1);    // helmet rim
    g.fillRect(14, 0, 36, 6);
    g.generateTexture('warden', 64, 80);
    g.clear();

    // ── Platform tile (tiled/scaled, 1×1 dark brown) ──────────────────
    g.fillStyle(0x3d2b1f, 1);
    g.fillRect(0, 0, 1, 1);
    g.generateTexture('platform', 1, 1);
    g.clear();

    // ── Crate (destructible, wooden) ──────────────────────────────────
    g.fillStyle(0x8b6914, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x6b5010, 1);    // plank lines
    g.fillRect(4, 0, 2, 32);
    g.fillRect(16, 0, 2, 32);
    g.fillRect(26, 0, 2, 32);
    g.fillRect(0, 4, 32, 2);
    g.fillRect(0, 26, 32, 2);
    g.fillStyle(0xa07820, 1);    // highlight edge
    g.fillRect(0, 0, 32, 1);
    g.fillRect(0, 0, 1, 32);
    g.generateTexture('crate', 32, 32);
    g.clear();

    // ── Lantern (checkpoint) ──────────────────────────────────────────
    g.fillStyle(0x2a1f0e, 1);    // pole
    g.fillRect(6, 14, 4, 18);
    g.fillStyle(0x5a4020, 1);    // frame
    g.fillRect(0, 4, 16, 16);
    g.fillStyle(0xfef3c7, 0.9);  // glow
    g.fillRect(3, 7, 10, 10);
    g.generateTexture('lantern', 16, 32);
    g.clear();

    // ── Relic pickup (dog tag, silver) ────────────────────────────────
    g.fillStyle(0xb0b8c0, 1);
    g.fillRect(2, 0, 8, 12);
    g.fillStyle(0xd8e0e8, 1);
    g.fillRect(4, 2, 4, 7);
    g.fillStyle(0x606870, 1);    // notch
    g.fillRect(5, 11, 2, 2);
    g.generateTexture('relic', 12, 14);
    g.clear();

    // ── Grenade ───────────────────────────────────────────────────────
    g.fillStyle(0x1a4a28, 1);
    g.fillCircle(6, 9, 6);
    g.fillStyle(0x3d3d3d, 1);    // handle
    g.fillRect(4, 0, 4, 7);
    g.fillStyle(0x888800, 1);    // pin ring
    g.fillRect(3, 2, 6, 2);
    g.generateTexture('grenade', 12, 16);
    g.clear();

    // ── Boss bar background ───────────────────────────────────────────
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(0, 0, 400, 22);
    g.fillStyle(0x333333, 1);
    g.fillRect(1, 1, 398, 20);
    g.generateTexture('bossbar-bg', 400, 22);
    g.clear();

    g.destroy();
  }
}
