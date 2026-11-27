// Service worker: saves the game's files on the device so it plays offline.
// Strategy: try the internet first (so updates show up right away),
// and fall back to the saved copy when offline.
// Bump CACHE when you want to force-refresh everything.
const CACHE = 'donovan-v22';

const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'lib/babylon.js',
  'lib/babylonjs.loaders.min.js',
  'src/style.css',
  'src/main.js',
  'src/version.js',
  'src/update.js',
  'src/settings.js',
  'src/world.js',
  'src/screens.js',
  'src/game.js',
  'src/hud.js',
  'src/ship.js',
  'src/rock.js',
  'src/bullets.js',
  'src/zombie.js',
  'src/sound.js',
  'assets/audio/wave.m4a',
  'assets/audio/music.mp3',
  'assets/kenney/craft_speederA.glb',
  'assets/kenney/meteor_detailed.glb',
  'assets/kenney/meteor.glb',
  'assets/kenney/cars/suv.glb',
  'assets/kenney/cars/Textures/colormap.png',
  'assets/kenney/zombies/zombie-a.glb',
  'assets/kenney/zombies/zombie-c.glb',
  'assets/kenney/graveyard/character-zombie.glb',
  'assets/kenney/graveyard/pine.glb',
  'assets/kenney/graveyard/pine-crooked.glb',
  'assets/kenney/graveyard/Textures/colormap.png',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  // 'no-cache' = always ask GitHub if the file changed (skips the browser's
  // 10-minute reuse window), so new versions show up on the next launch.
  event.respondWith(
    fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }))
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
