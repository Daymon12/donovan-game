// Placeholder art drawn with code (no image files needed yet).
// Each drawing is saved as a "texture" with a name, like 'ship-blue' or 'bullet'.
// Later you can swap any of these for a real picture with the same name.

export function makeTextures(scene) {
  if (scene.textures.exists('bullet-blue')) return; // only draw once

  const g = scene.add.graphics();

  drawShip(g, 0x2ec4ff, 0x1b6fa8);
  g.generateTexture('ship-blue', 72, 80);
  g.clear();

  drawShip(g, 0xff7a45, 0xb8432a);
  g.generateTexture('ship-orange', 72, 80);
  g.clear();

  // --- Bullets match their ship: 'ship-blue' fires 'bullet-blue', etc. ---
  drawBullet(g, 0x2ec4ff);
  g.generateTexture('bullet-blue', 16, 34);
  g.clear();

  drawBullet(g, 0xff7a45);
  g.generateTexture('bullet-orange', 16, 34);
  g.clear();

  drawAsteroid(g);
  g.generateTexture('asteroid', 96, 96);

  g.destroy();
}

// Asteroid: 96 x 96 lumpy grey rock with craters.
function drawAsteroid(g) {
  const c = 48;
  // Lumpy outline: a circle with a few bumps (fixed, so every rock looks the same).
  const bumps = [44, 40, 45, 38, 43, 46, 39, 44, 41, 45, 38, 43];
  const points = bumps.map((r, i) => {
    const a = (i / bumps.length) * Math.PI * 2;
    return new Phaser.Math.Vector2(c + Math.cos(a) * r, c + Math.sin(a) * r);
  });
  g.fillStyle(0x8a8f9e, 1);
  g.fillPoints(points, true);
  g.fillStyle(0x6b7080, 1);              // craters
  g.fillCircle(34, 36, 9);
  g.fillCircle(60, 58, 12);
  g.fillCircle(38, 66, 6);
  g.fillStyle(0xb4b9c6, 1);              // highlight
  g.fillCircle(56, 30, 6);
}

// Bullet: 16 x 34 glowing capsule with a white core, pointing up.
function drawBullet(g, color) {
  g.fillStyle(color, 1);
  g.fillRoundedRect(0, 0, 16, 34, 8);
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(4, 4, 8, 15, 4);
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
