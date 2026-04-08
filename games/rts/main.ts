import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene }   from './scenes/UIScene.js';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width:  window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#0a1a0a',
  scene: [BootScene, GameScene, UIScene],
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scale: {
    mode:         Phaser.Scale.RESIZE,
    autoCenter:   Phaser.Scale.CENTER_BOTH,
    width:        '100%',
    height:       '100%',
  },
  render: {
    antialias: true,
    pixelArt:  false,
  },
  input: {
    mouse: {
      preventDefaultDown:  true,
      preventDefaultUp:    true,
      preventDefaultMove:  false,
      preventDefaultWheel: false,
    },
  },
};

new Phaser.Game(config);
