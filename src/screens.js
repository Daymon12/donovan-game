// The screens (like pages of a website): Title, Settings and the Game.
// Menus are plain HTML on top of the 3D view; only one screen shows at a time.
import Game from './game.js';
import { button, el } from './hud.js';
import { VERSION } from './version.js';
import { checkForUpdate } from './update.js';
import * as settings from './settings.js';
import { paint, hex } from './world.js';

let leave = () => {}; // cleans up the current screen

function open(world, ui, screen) {
  leave();
  ui.innerHTML = '';
  leave = screen(world, ui) || (() => {});
}

// ---------- Title ----------

export function showTitle(world, ui) {
  open(world, ui, titleScreen);
}

function titleScreen(world, ui) {
  const { W, H } = world;

  const title = el('div', 'title');
  title.textContent = "Donovan's Games";
  title.style.top = `${H * 0.2}px`;
  ui.append(title);

  // A big 3D ship slowly turning, just for show.
  const ship = world.spawn('ship', Math.min(W, H) * 0.3);
  ship.position.copyFrom(world.at(W / 2, H * 0.4, 50));
  ship.rotation.x = -0.5;
  paint(ship, (c) => (Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) > 0.3 ? hex('#2ec4ff') : c));
  const stopSpin = world.onFrame((now, dt) => { ship.rotation.y += dt * 0.0008; });

  const start = button(ui, W / 2, H * 0.62, 'START', () => open(world, ui, gameScreen),
    { width: 360, height: 140, fontSize: 64, color: '#2ecc71' });
  start.classList.add('breathe');

  // Grown-up corner: settings, version number, update.
  button(ui, 104, H - 52, 'Settings', () => open(world, ui, settingsScreen),
    { width: 160, height: 56, fontSize: 24, color: '#3a4070' });

  const version = el('div', 'small');
  version.textContent = `v${VERSION}`;
  Object.assign(version.style, { left: `${W / 2}px`, top: `${H - 36}px`, transform: 'translateX(-50%)' });
  ui.append(version);

  const status = el('div', 'small');
  Object.assign(status.style, { right: '24px', top: `${H - 140}px` });
  ui.append(status);

  let busy = false;
  button(ui, W - 104, H - 52, '↻ Update', async () => {
    if (busy) return;
    busy = true;
    status.textContent = 'Checking...';
    const result = await checkForUpdate();
    status.textContent = result.message;
    if (!result.reloading) busy = false;
  }, { width: 160, height: 56, fontSize: 24, color: '#3a4070' });

  return () => {
    stopSpin();
    ship.dispose(false, true);
  };
}

// ---------- Settings ----------

function settingsScreen(world, ui) {
  const { W, H } = world;

  const title = el('div', 'title');
  title.textContent = 'Settings';
  title.style.top = `${H * 0.12}px`;
  title.style.fontSize = '72px';
  ui.append(title);

  stepper(ui, W, 'bulletSpeed', H * 0.3);
  stepper(ui, W, 'bulletSize', H * 0.45);

  // Preview: a sample bullet flying up at the chosen speed and size.
  const previewTop = H * 0.56;
  const previewBottom = H * 0.86;
  const label = el('div', 'small');
  label.textContent = 'Preview';
  Object.assign(label.style, { left: `${W / 2}px`, top: `${previewTop - 40}px`, transform: 'translateX(-50%)' });
  const bullet = el('div', 'preview-bullet');
  ui.append(label, bullet);

  let y = previewBottom;
  const stop = world.onFrame((now, dt) => {
    y -= settings.get('bulletSpeed').value * dt / 1000;
    if (y < previewTop) y = previewBottom;
    const s = settings.get('bulletSize').value;
    bullet.style.transform = `translate(${W / 2}px, ${y}px) translate(-50%, -50%) scale(${s})`;
  });

  button(ui, W / 2, H * 0.93, '◀ Back', () => open(world, ui, titleScreen),
    { width: 220, height: 80, fontSize: 34 });

  return stop;
}

// One row: label, [-] current choice [+]
function stepper(ui, W, key, y) {
  const label = el('div', 'label');
  label.textContent = settings.OPTIONS[key].label;
  Object.assign(label.style, { left: `${W / 2}px`, top: `${y - 60}px` });

  const value = el('div', 'value');
  value.textContent = settings.get(key).name;
  Object.assign(value.style, { left: `${W / 2}px`, top: `${y + 10}px` });
  ui.append(label, value);

  const change = (d) => { value.textContent = settings.step(key, d).name; };
  button(ui, W / 2 - 220, y + 10, '−', () => change(-1), { width: 100, height: 90, fontSize: 60, color: '#3a4070' });
  button(ui, W / 2 + 220, y + 10, '+', () => change(+1), { width: 100, height: 90, fontSize: 60, color: '#3a4070' });
}

// ---------- Game ----------

function gameScreen(world, ui) {
  const game = new Game(world, ui, {
    onBack: () => open(world, ui, titleScreen),
    onRestart: () => open(world, ui, gameScreen),
  });
  return () => game.destroy();
}
