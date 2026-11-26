// The game screen: centre line + one ship that shoots.
import { makeButton } from '../ui/button.js';
import { makeTextures } from '../art/textures.js';
import Ship from '../objects/Ship.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    const { width, height } = this.scale;
    makeTextures(this);

    // --- Centre line (like the red line in hockey) ---
    const lineY = height / 2;
    const line = this.add.graphics();
    line.lineStyle(6, 0xff4d6d, 0.9);
    for (let x = 0; x < width; x += 40) {
      line.lineBetween(x, lineY, x + 24, lineY); // dashed
    }

    // --- Player ship: lives in the bottom half, below the line ---
    const bottomZone = new Phaser.Geom.Rectangle(0, lineY + 6, width, height - lineY - 6);
    this.ship = new Ship(this, width / 2, height - 90, bottomZone);

    // --- Touch controls: finger in the bottom half moves the ship and fires ---
    this.input.on('pointerdown', (p) => {
      if (p.y > lineY) {
        this.ship.aimAt(p.x, p.y);
        this.ship.firing = true;
      }
    });
    this.input.on('pointermove', (p) => {
      if (p.isDown && this.ship.firing) this.ship.aimAt(p.x, p.y);
    });
    this.input.on('pointerup', () => { this.ship.firing = false; });

    // Small "back" button in the corner to return to the start screen.
    makeButton(this, 110, 70, '◀ Back', () => {
      this.scene.start('TitleScene');
    }, { width: 180, height: 80, fontSize: 34, color: 0x5b6ee1 });
  }

  // Runs about 60 times a second.
  update(time) {
    this.ship.update(time);
  }
}
