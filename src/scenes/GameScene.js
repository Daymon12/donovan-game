// The game screen: two players face each other across an open middle.
//
//   ─────────────────────────────  ← top edge
//              ▼  orange player (P2)
//   - - - - - - - - - - - - - - -  ← top line
//
//               open middle
//
//   - - - - - - - - - - - - - - -  ← bottom line
//              ▲  blue player (P1)
//   ─────────────────────────────  ← bottom edge
//
// Each ship stays in its own strip behind its line.
import { makeButton } from '../ui/button.js';
import { makeTextures } from '../art/textures.js';
import Ship from '../objects/Ship.js';

const STRIP_DEPTH = 180; // how deep each player's strip is, from the screen edge

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    const { width, height } = this.scale;
    makeTextures(this);

    // --- The two lines ---
    const topLineY = STRIP_DEPTH;
    const bottomLineY = height - STRIP_DEPTH;
    this.drawDashedLine(topLineY, width, 0xff7a45);
    this.drawDashedLine(bottomLineY, width, 0x2ec4ff);

    // --- Ships: each lives in its own strip and points at the other ---
    this.ships = [
      new Ship(this, width / 2, height - STRIP_DEPTH / 2, {
        zone: new Phaser.Geom.Rectangle(0, bottomLineY + 4, width, STRIP_DEPTH - 4),
        facing: 'up',
        texture: 'ship-blue',
      }),
      new Ship(this, width / 2, STRIP_DEPTH / 2, {
        zone: new Phaser.Geom.Rectangle(0, 0, width, topLineY - 4),
        facing: 'down',
        texture: 'ship-orange',
      }),
    ];

    this.setUpTouch(height);

    // Small "back" button on the left edge of the middle (away from both players).
    makeButton(this, 100, height / 2, '◀ Back', () => {
      this.scene.start('TitleScene');
    }, { width: 160, height: 64, fontSize: 28, color: 0x5b6ee1 });
  }

  // Touch the bottom half to drive the bottom ship, the top half for the top ship.
  // Two fingers at once work, so both players can play together.
  setUpTouch(height) {
    const shipFor = (p) => (p.y > height / 2 ? this.ships[0] : this.ships[1]);

    this.input.on('pointerdown', (p, over) => {
      if (over.length > 0) return; // tapped a button, not the field
      const ship = shipFor(p);
      if (ship.pointerId !== null) return; // that ship already has a finger
      ship.pointerId = p.id;
      ship.firing = true;
      ship.aimAt(p.x, p.y);
    });

    this.input.on('pointermove', (p) => {
      const ship = this.ships.find((s) => s.pointerId === p.id);
      if (ship) ship.aimAt(p.x, p.y);
    });

    const release = (p) => {
      const ship = this.ships.find((s) => s.pointerId === p.id);
      if (ship) {
        ship.pointerId = null;
        ship.firing = false;
      }
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  drawDashedLine(y, width, color) {
    const g = this.add.graphics();
    g.lineStyle(6, color, 0.9);
    for (let x = 0; x < width; x += 40) {
      g.lineBetween(x, y, x + 24, y);
    }
  }

  // Runs about 60 times a second.
  update(time) {
    for (const ship of this.ships) ship.update(time);
  }
}
