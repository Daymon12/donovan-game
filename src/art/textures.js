// Placeholder art drawn with code (no image files needed yet).
// Each drawing is saved as a "texture" with a name, like 'ship-blue' or 'bullet'.
// Later you can swap any of these for a real picture with the same name.

export function makeTextures(scene) {
  if (scene.textures.exists('bullet')) return; // only draw once

  const g = scene.add.graphics();

  drawShip(g, 0x2ec4ff, 0x1b6fa8);
  g.generateTexture('ship-blue', 72, 80);
  g.clear();

  drawShip(g, 0xff7a45, 0xb8432a);
  g.generateTexture('ship-orange', 72, 80);
  g.clear();

  // --- Bullet: 12 x 26 glowing capsule (points up, like the ships) ---
  g.fillStyle(0xffd84d, 1);
  g.fillRoundedRect(0, 0, 12, 26, 6);
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(3, 3, 6, 12, 3);
  g.generateTexture('bullet', 12, 26);

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
