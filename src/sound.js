// Sounds, played with the Web Audio API.
//
// iPads only allow sound after the first touch, so the first tap anywhere
// "unlocks" audio. Sounds are loaded once at startup and kept ready.
//
//   sound.play('wave')  -> starts it, returns something with .stop()
//   sound.duration('wave') -> length in seconds (0 if not loaded yet)

const FILES = {
  wave: 'assets/audio/wave.m4a', // the wave track (plays at the start and before each wave)
};

let ctx = null;
const buffers = {};

function context() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

// First touch: wake up audio (and play a tiny silent sound, which iPads need).
function unlock() {
  const c = context();
  if (!c) return;
  if (c.state !== 'running') c.resume();
  const silent = c.createBuffer(1, 1, 22050);
  const src = c.createBufferSource();
  src.buffer = silent;
  src.connect(c.destination);
  src.start(0);
}
window.addEventListener('pointerdown', unlock, { capture: true });

export async function loadAll() {
  const c = context();
  if (!c) return;
  await Promise.all(Object.entries(FILES).map(async ([name, url]) => {
    try {
      const data = await (await fetch(url)).arrayBuffer();
      buffers[name] = await c.decodeAudioData(data);
    } catch { /* no sound if it can't load - the game still works */ }
  }));
}

export function duration(name) {
  return buffers[name]?.duration || 0;
}

const NOTHING = { stop() {} };

export function play(name) {
  const c = context();
  if (!c || !buffers[name]) return NOTHING;
  if (c.state !== 'running') c.resume();
  const src = c.createBufferSource();
  src.buffer = buffers[name];
  src.connect(c.destination);
  src.start(0);
  return { stop() { try { src.stop(); } catch { /* already finished */ } } };
}
