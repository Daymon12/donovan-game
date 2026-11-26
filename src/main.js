// Entry point: sets up the Phaser game and lists every scene (screen).
import TitleScene from './scenes/TitleScene.js';
import GameScene from './scenes/GameScene.js';
import SettingsScene from './scenes/SettingsScene.js';

// The game's size matches the shape of the screen it starts on, so it fills
// the whole iPad with no empty bands. The short side is always 834
// (an iPad Pro 11" in points); the long side follows the screen's shape.
const SHORT_SIDE = 834;
const isPortrait = () => window.innerHeight > window.innerWidth;

const w = window.innerWidth;
const h = window.innerHeight;
const aspect = Phaser.Math.Clamp(Math.max(w, h) / Math.min(w, h), 1.3, 2.2);
const LONG_SIDE = Math.round(SHORT_SIDE * aspect);
const startedPortrait = isPortrait();

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1b1f3b',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: startedPortrait ? SHORT_SIDE : LONG_SIDE,
    height: startedPortrait ? LONG_SIDE : SHORT_SIDE,
  },
  input: {
    activePointers: 4, // allow several fingers at once (both players)
  },
  // Arcade physics: simple, fast movement and collisions (speed, bumping, hits).
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  // The first scene in this list is the one shown at launch.
  scene: [TitleScene, GameScene, SettingsScene],
});

// Turning the iPad between upright and sideways restarts the game in the new shape.
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (isPortrait() !== startedPortrait) location.reload();
  }, 300);
});
