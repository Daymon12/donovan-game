// Placeholder art drawn with code (no image files needed yet).
// Each drawing is saved as a "texture" with a name, like 'ship-blue'.
// Later you can swap any of these for a real picture with the same name.

const SHIP_COLORS = {
  blue:   { body: 0x2ec4ff, tail: 0x1b6fa8 },
  orange: { body: 0xff7a45, tail: 0xb8432a },
};

export function makeTextures(scene) {
  if (scene.textures.exists('asteroid-small')) return; // only draw once

  const g = scene.add.graphics();
  const save = (key, w, h) => { g.generateTexture(key, w, h); g.clear(); };

  for (const [name, c] of Object.entries(SHIP_COLORS)) {
    drawShip(g, c.body, c.tail);
    save(`ship-${name}`, 72, 80);

    // Power bullets: each type has its own shape, outlined in the ship's colour.
    drawElectric(g, c.body);
    save(`bullet-electric-${name}`, 20, 36);
    drawFreeze(g, c.body);
    save(`bullet-freeze-${name}`, 20, 36);
    drawLava(g, c.body);
    save(`bullet-lava-${name}`, 20, 36);
  }

  drawAsteroid(g, 1);
  save('asteroid', 96, 96);
  drawAsteroid(g, 0.5);
  save('asteroid-small', 48, 48);

  g.destroy();
}

// Ship: 72 x 80, drawn pointing UP. Ships are rotated to face other ways.
function drawShip(g, body, tail) {
  g.fillStyle(body, 1);
  g.fillTriangle(36, 0, 0, 72, 72, 72);          // body
  g.fillStyle(tail, 1);
  g.fillTriangle(36, 30, 14, 80, 58, 80);        // tail
  g.fillStyle(0xffffff, 1);
  g.fillCircle(36, 44, 10);                      // cockpit
  g.fillStyle(0xffd84d, 1);
  g.fillRect(22, 72, 10, 8);                     // engine flames
  g.fillRect(40, 72, 10, 8);
}

// ⚡ Electric: yellow zig-zag lightning bolt (20 x 36, nose at top).
function drawElectric(g, outline) {
  const pts = [[13, 0], [3, 19], [9, 19], [5, 36], [17, 14], [11, 14], [16, 0]]
    .map(([x, y]) => new Phaser.Math.Vector2(x, y));
  g.fillStyle(0xffe14d, 1);
  g.fillPoints(pts, true);
  g.lineStyle(2, outline, 1);
  g.strokePoints(pts, true);
}

// ❄ Freeze: pale-blue ice crystal (diamond) with a white shine.
function drawFreeze(g, outline) {
  const pts = [[10, 0], [19, 13], [10, 36], [1, 13]].map(([x, y]) => new Phaser.Math.Vector2(x, y));
  g.fillStyle(0xbff0ff, 1);
  g.fillPoints(pts, true);
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(10, 3, 15, 13, 10, 20);
  g.lineStyle(2, outline, 1);
  g.strokePoints(pts, true);
}

// 🔥 Lava: glowing orange fireball with a flame tip and yellow centre.
function drawLava(g, outline) {
  g.fillStyle(0xff5a1f, 1);
  g.fillTriangle(10, 0, 2, 22, 18, 22);
  g.fillCircle(10, 25, 9);
  g.fillStyle(0xffd84d, 1);
  g.fillCircle(10, 25, 4);
  g.lineStyle(2, outline, 1);
  g.strokeCircle(10, 25, 9);
}

// Asteroid: lumpy grey rock with craters. scale 1 = 96 x 96, 0.5 = 48 x 48.
function drawAsteroid(g, s) {
  const c = 48 * s;
  const bumps = [44, 40, 45, 38, 43, 46, 39, 44, 41, 45, 38, 43];
  const points = bumps.map((r, i) => {
    const a = (i / bumps.length) * Math.PI * 2;
    return new Phaser.Math.Vector2(c + Math.cos(a) * r * s, c + Math.sin(a) * r * s);
  });
  g.fillStyle(0x8a8f9e, 1);
  g.fillPoints(points, true);
  g.fillStyle(0x6b7080, 1);              // craters
  g.fillCircle(34 * s, 36 * s, 9 * s);
  g.fillCircle(60 * s, 58 * s, 12 * s);
  g.fillCircle(38 * s, 66 * s, 6 * s);
  g.fillStyle(0xb4b9c6, 1);              // highlight
  g.fillCircle(56 * s, 30 * s, 6 * s);
}
