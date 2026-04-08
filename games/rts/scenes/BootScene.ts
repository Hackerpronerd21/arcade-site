import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  preload(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    // Loading bar
    const bar = this.add.graphics();
    bar.fillStyle(0x222222, 1);
    bar.fillRect(w / 2 - 200, h / 2 - 20, 400, 40);

    this.load.on('progress', (value: number) => {
      bar.clear();
      bar.fillStyle(0x222222, 1);
      bar.fillRect(w / 2 - 200, h / 2 - 20, 400, 40);
      bar.fillStyle(0x00e5ff, 1);
      bar.fillRect(w / 2 - 196, h / 2 - 16, 392 * value, 32);
    });

    // Faction sprite sheets — frames registered dynamically in GameScene.create()
    this.load.image('mafia',         'assets/mafia.png');
    this.load.image('spiderrace',    'assets/spiderrace.png');
    this.load.image('primals',       'assets/primals.png');
    this.load.image('timecore',      'assets/timecore.png');
    this.load.image('verdantplague', 'assets/verdantplague.png');

    // Terrain atlas — ground tiles + resource node sprites
    this.load.image('terrain', 'assets/TERRAIN SHEET.png');
  }

  create(): void {
    this.scene.start('GameScene');
  }
}
