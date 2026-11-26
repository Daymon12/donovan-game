// Entry point: sets up the Phaser game and lists every scene (screen).
import TitleScene from './scenes/TitleScene.js';
import GameScene from './scenes/GameScene.js';

// The game is designed at this size, then scaled to fit any screen.
export const WIDTH = 1024;
export const HEIGHT = 768;

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1b1f3b',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: WIDTH,
    height: HEIGHT,
  },
  input: {
    activePointers: 4, // allow several fingers at once (for two players later)
  },
  // Arcade physics: simple, fast movement and collisions (speed, bumping, hits).
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  // The first scene in this list is the one shown at launch.
  scene: [TitleScene, GameScene],
});
