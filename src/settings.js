// Game settings, saved on the device so they stay the same next time.
// Each setting is a list of choices; we store which one is picked.

export const OPTIONS = {
  bulletSpeed: {
    label: 'Bullet speed',
    choices: [
      { name: 'Very slow', value: 200 },
      { name: 'Slow',      value: 300 },
      { name: 'Medium',    value: 400 },
      { name: 'Fast',      value: 550 },
      { name: 'Very fast', value: 750 },
    ],
    default: 2,
  },
  bulletSize: {
    label: 'Bullet size',
    choices: [
      { name: 'Small',  value: 0.75 },
      { name: 'Normal', value: 1 },
      { name: 'Big',    value: 1.3 },
      { name: 'Bigger', value: 1.6 },
      { name: 'Huge',   value: 2 },
    ],
    default: 1,
  },
};

const STORAGE_KEY = 'donovan-settings';
let picked = load();

function load() {
  const result = {};
  for (const key of Object.keys(OPTIONS)) result[key] = OPTIONS[key].default;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    for (const key of Object.keys(OPTIONS)) {
      const i = saved[key];
      if (Number.isInteger(i) && i >= 0 && i < OPTIONS[key].choices.length) result[key] = i;
    }
  } catch { /* storage unavailable: use defaults */ }
  return result;
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(picked)); } catch { /* ignore */ }
}

// The chosen choice for a setting, e.g. get('bulletSpeed') -> { name: 'Medium', value: 400 }
export function get(key) {
  return OPTIONS[key].choices[picked[key]];
}

// Move a setting one step up (+1) or down (-1). Returns the new choice.
export function step(key, delta) {
  const max = OPTIONS[key].choices.length - 1;
  picked[key] = Phaser.Math.Clamp(picked[key] + delta, 0, max);
  save();
  return get(key);
}

export function isFirst(key) { return picked[key] === 0; }
export function isLast(key) { return picked[key] === OPTIONS[key].choices.length - 1; }
