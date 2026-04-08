import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { Chapter1Scene } from './scenes/Chapter1Scene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#0d1117',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 520 },
      debug: false,
    },
  },
  scene: [BootScene, Chapter1Scene],
};

new Phaser.Game(config);
