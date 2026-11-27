// Each player's strip of buttons and info, drawn with plain HTML on top of
// the 3D view:
//
//   ┌──────┬─────────────────────────┬────────┐
//   │  ⚡  │                         │   2    │  ← score
//   │  ❄  │     (ship moves here)    │ ▮▮▮▮▮▮ │  ← health (10 blocks)
//   │  🔥  │                         │ ▲ ▲ △  │  ← ships left
//   └──────┴─────────────────────────┴────────┘
//    power                               info
//
// The top player's strip is the same thing turned around (rotated 180°),
// so everything faces them.
import { POWERS } from './bullets.js';
import { MAX_HEALTH, MAX_LIVES } from './ship.js';

export const SIDE_COLUMN = 110;   // width of the button / info columns at each side

export function makePanel(ui, ship, { top, y, height, width }) {
  const panel = el('div', 'panel');
  Object.assign(panel.style, {
    left: '0px', top: `${y}px`, width: `${width}px`, height: `${height}px`,
    transform: top ? 'rotate(180deg)' : '',
  });

  // --- Power buttons ---
  const powers = el('div', 'powers');
  powers.style.width = `${SIDE_COLUMN}px`;
  const gap = Math.min(84, (height - 16) / 3);
  const buttons = {};
  for (const key of Object.keys(POWERS)) {
    const b = el('div', 'power tap');
    b.textContent = POWERS[key].icon;
    b.style.height = `${gap - 10}px`;
    b.style.setProperty('--on', POWERS[key].color);
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      ship.power = key;
      draw();
      b.classList.add('pressed');
      setTimeout(() => b.classList.remove('pressed'), 90);
    });
    buttons[key] = b;
    powers.append(b);
  }

  // --- Score, health, lives ---
  const info = el('div', 'info');
  info.style.width = `${SIDE_COLUMN}px`;
  info.style.color = ship.color;
  const score = el('div', 'score');
  score.textContent = '0';
  const health = el('div', 'health');
  const blocks = [];
  for (let i = 0; i < MAX_HEALTH; i++) blocks.push(health.appendChild(el('span')));
  const lives = el('div', 'lives');
  const icons = [];
  for (let i = 0; i < MAX_LIVES; i++) icons.push(lives.appendChild(el('span')));
  info.append(score, health, lives);

  panel.append(powers, info);
  ui.append(panel);

  function draw() {
    for (const key of Object.keys(buttons)) buttons[key].classList.toggle('on', ship.power === key);
    const color = ship.health > 6 ? '#2ecc71' : ship.health > 3 ? '#ffd84d' : '#ff4d4d';
    blocks.forEach((b, i) => {
      b.style.background = i < ship.health ? color : 'transparent';
    });
    icons.forEach((s, i) => s.classList.toggle('used', i >= ship.lives));
  }
  draw();
  ship.onChange = draw;

  return {
    setScore(n) {
      score.textContent = String(n);
      score.classList.remove('bump');
      void score.offsetWidth; // restart the little "bump" animation
      score.classList.add('bump');
    },
  };
}

// Make an HTML element with a class name.
export function el(tag, className = '') {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

// A big rounded button at (x, y) (its centre), in board pixels.
export function button(parent, x, y, label, onPress, { width = 220, height = 80, fontSize = 34, color = '#5b6ee1' } = {}) {
  const b = el('div', 'btn tap');
  b.textContent = label;
  Object.assign(b.style, {
    left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px`,
    fontSize: `${fontSize}px`, background: color,
  });
  b.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    onPress();
  });
  parent.append(b);
  return b;
}
