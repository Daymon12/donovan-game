// Entry point: sizes the game to the screen, starts the 3D world, shows the title.
import { createWorld } from './world.js';
import { showTitle } from './screens.js';
import * as sound from './sound.js';

// The game's size matches the shape of the screen it starts on, so it fills
// the whole iPad with no empty bands. The short side is always 834
// (an iPad Pro 11" in points); the long side follows the screen's shape.
const SHORT_SIDE = 834;
const isPortrait = () => window.innerHeight > window.innerWidth;

const w = window.innerWidth;
const h = window.innerHeight;
const aspect = Math.min(2.2, Math.max(1.3, Math.max(w, h) / Math.min(w, h)));
const LONG_SIDE = Math.round(SHORT_SIDE * aspect);
const startedPortrait = isPortrait();
const W = startedPortrait ? SHORT_SIDE : LONG_SIDE;
const H = startedPortrait ? LONG_SIDE : SHORT_SIDE;

// The stage holds the 3D view and the buttons on top. It is W x H board
// pixels, scaled to fit the screen (like Phaser's FIT mode).
const stage = document.getElementById('stage');
const ui = document.getElementById('ui');
stage.style.width = `${W}px`;
stage.style.height = `${H}px`;
function fit() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
}
fit();
window.addEventListener('resize', fit);

ui.innerHTML = '<div class="title" style="top:45%">Loading...</div>';
const [world] = await Promise.all([
  createWorld(document.getElementById('view'), W, H),
  sound.loadAll(),
]);
window.world = world; // for testing from the browser console
showTitle(world, ui);

// Turning the iPad between upright and sideways restarts the game in the new shape.
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (isPortrait() !== startedPortrait) location.reload();
  }, 300);
});
