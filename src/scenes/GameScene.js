// The game screen: two players face each other across an open middle.
//
//   | P1 |                              | P2 |
//   | ▶  |        open middle           |  ◀ |
//   |    |                              |    |
//   left line                      right line
//
// Each ship stays in its own strip behind its line.
import { makeButton } from '../ui/button.js';
import { makeTextures } from '../art/textures.js';
import Ship from '../objects/Ship.js';

const STRIP_WIDTH = 200; // how deep each player's strip is, from the screen edge

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    const { width, height } = this.scale;
    makeTextures(this);

    // --- The two lines ---
    const leftLineX = STRIP_WIDTH;
    const rightLineX = width - STRIP_WIDTH;
    this.drawDashedLine(leftLineX, height, 0x2ec4ff);
    this.drawDashedLine(rightLineX, height, 0xff7a45);

    // --- Ships: each lives in its own strip and points at the other ---
    this.ships = [
      new Ship(this, leftLineX / 2, height / 2, {
        zone: new Phaser.Geom.Rectangle(0, 0, leftLineX - 4, height),
        facing: 'right',
        texture: 'ship-blue',
      }),
      new Ship(this, width - STRIP_WIDTH / 2, height / 2, {
        zone: new Phaser.Geom.Rectangle(rightLineX + 4, 0, STRIP_WIDTH - 4, height),
        facing: 'left',
        texture: 'ship-orange',
      }),
    ];

    this.setUpTouch(width);

    // Small "back" button at the top middle (away from both players).
    makeButton(this, width / 2, 50, '◀ Back', () => {
      this.scene.start('TitleScene');
    }, { width: 180, height: 70, fontSize: 30, color: 0x5b6ee1 });
  }

  // Touch the left half to drive the left ship, the right half for the right ship.
  // Two fingers at once work, so both players can play together.
  setUpTouch(width) {
    const shipFor = (p) => (p.x < width / 2 ? this.ships[0] : this.ships[1]);

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

  drawDashedLine(x, height, color) {
    const g = this.add.graphics();
    g.lineStyle(6, color, 0.9);
    for (let y = 0; y < height; y += 40) {
      g.lineBetween(x, y, x, y + 24);
    }
  }

  // Runs about 60 times a second.
  update(time) {
    for (const ship of this.ships) ship.update(time);
  }
}
