// The game screen: two players face each other across an open middle
// with 5 asteroids floating in it.
//
//   ─────────────────────────────  ← top edge
//   3          ▼  orange player (P2)
//   - - - - - - - - - - - - - - -  ← top line
//        ●    ●    ●    ●    ●     ← asteroids
//   - - - - - - - - - - - - - - -  ← bottom line
//              ▲  blue player (P1)        2
//   ─────────────────────────────  ← bottom edge
//
// Shoot an asteroid past the OTHER player's line = 1 point.
// When all 5 are gone, the higher score wins.
// Each hit on the other ship takes 1 of its 10 lives; 0 lives = destroyed, you win.
import { makeButton } from '../ui/button.js';
import { makeTextures } from '../art/textures.js';
import Ship from '../objects/Ship.js';
import Asteroid from '../objects/Asteroid.js';

// How deep each player's strip is, as a share of the screen height
// (0.25 = each player gets a quarter, the middle gets half).
const STRIP_SHARE = 0.25;
const ASTEROID_COUNT = 5;
const FONT = 'Arial Rounded MT Bold, Arial, sans-serif';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    const { width, height } = this.scale;
    makeTextures(this);
    const STRIP_DEPTH = Math.round(height * STRIP_SHARE);

    // --- The two lines ---
    this.topLineY = STRIP_DEPTH;
    this.bottomLineY = height - STRIP_DEPTH;
    this.drawDashedLine(this.topLineY, width, 0xff7a45);
    this.drawDashedLine(this.bottomLineY, width, 0x2ec4ff);

    // --- Ships: each lives in its own strip and points at the other ---
    this.ships = [
      new Ship(this, width / 2, height - STRIP_DEPTH / 2, {
        zone: new Phaser.Geom.Rectangle(0, this.bottomLineY + 4, width, STRIP_DEPTH - 4),
        facing: 'up',
        texture: 'ship-blue',
        name: 'Blue',
        color: 0x2ec4ff,
      }),
      new Ship(this, width / 2, STRIP_DEPTH / 2, {
        zone: new Phaser.Geom.Rectangle(0, 0, width, this.topLineY - 4),
        facing: 'down',
        texture: 'ship-orange',
        name: 'Orange',
        color: 0xff7a45,
      }),
    ];
    const [blue, orange] = this.ships;

    // --- Scores: each player's score sits in their own corner, facing them ---
    blue.score = 0;
    orange.score = 0;
    blue.scoreText = this.makeScoreText(width - 60, height - STRIP_DEPTH / 2, blue, 0);
    orange.scoreText = this.makeScoreText(60, STRIP_DEPTH / 2, orange, 180);

    // --- Life bars: opposite corner from the score ---
    blue.placeLifeBar(24, height - STRIP_DEPTH / 2, 1);
    orange.placeLifeBar(width - 24, STRIP_DEPTH / 2, -1);

    // --- Asteroids in a row across the middle ---
    // They bounce off the left/right edges only (top/bottom are the goals).
    this.physics.world.setBoundsCollision(true, true, false, false);
    this.asteroids = this.add.group();
    for (let i = 0; i < ASTEROID_COUNT; i++) {
      const x = width * (0.18 + i * (0.64 / (ASTEROID_COUNT - 1)));
      const y = height / 2 + (i % 2 === 0 ? -30 : 30);
      this.asteroids.add(new Asteroid(this, x, y));
    }
    this.physics.add.collider(this.asteroids, this.asteroids); // rocks bump each other

    // --- Bullets push asteroids (and disappear) ---
    for (const ship of this.ships) {
      this.physics.add.overlap(this.asteroids, ship.bullets, (rock, bullet) => {
        rock.pushFrom(bullet.x, bullet.y);
        ship.removeBullet(bullet);
      });
    }

    // --- Hitting the OTHER ship takes a life; 10 hits destroys it ---
    this.gameOver = false;
    this.physics.add.overlap(orange, blue.bullets, (ship, bullet) => this.hit(blue, orange, bullet));
    this.physics.add.overlap(blue, orange.bullets, (ship, bullet) => this.hit(orange, blue, bullet));

    this.setUpTouch(height);

    // Small "back" button on the left edge of the middle (away from both players).
    makeButton(this, 70, height / 2, '◀ Back', () => {
      this.scene.start('TitleScene');
    }, { width: 120, height: 56, fontSize: 24, color: 0x5b6ee1 }).setDepth(10);
  }

  makeScoreText(x, y, ship, angle) {
    return this.add.text(x, y, '0', {
      fontFamily: FONT,
      fontSize: '72px',
      fontStyle: 'bold',
      color: hexColor(ship.color),
    }).setOrigin(0.5).setAngle(angle).setAlpha(0.85);
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
      if (!this.gameOver && this.time.now - ship.lastShot > 180) {
        ship.shoot(); // a quick tap fires right away
        ship.lastShot = this.time.now;
      }
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

  // An asteroid crossed a line: the player on the OTHER side gets the point.
  scorePoint(rock, scorer) {
    rock.scored = true;
    rock.body.enable = false;
    this.tweens.add({
      targets: rock, scale: 1.6, alpha: 0, duration: 350,
      onComplete: () => rock.destroy(),
    });

    scorer.score += 1;
    scorer.scoreText.setText(String(scorer.score));
    this.tweens.add({ targets: scorer.scoreText, scale: 1.5, duration: 150, yoyo: true });

    // "+1" pops up where the rock crossed.
    const plus = this.add.text(rock.x, rock.y, '+1', {
      fontFamily: FONT, fontSize: '56px', fontStyle: 'bold', color: hexColor(scorer.color),
    }).setOrigin(0.5);
    this.tweens.add({
      targets: plus, y: plus.y + (scorer === this.ships[0] ? -60 : 60), alpha: 0, duration: 800,
      onComplete: () => plus.destroy(),
    });

    const left = this.asteroids.getChildren().filter((r) => !r.scored).length;
    if (left === 0) this.time.delayedCall(500, () => this.endRound());
  }

  // All asteroids gone: higher score wins (5 rocks, so there's never a tie).
  endRound() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.physics.pause();
    for (const s of this.ships) s.firing = false;

    const [blue, orange] = this.ships;
    const winner = blue.score > orange.score ? blue : orange;
    this.showWinner(winner, `${blue.score} – ${orange.score}`);
  }

  // shooter's bullet hit the target ship: it loses a life.
  // Out of lives = ship destroyed and the shooter wins.
  hit(shooter, target, bullet) {
    if (this.gameOver) return;
    shooter.removeBullet(bullet);
    if (!target.takeHit()) return; // still has lives left

    this.gameOver = true;
    this.physics.pause();
    for (const s of this.ships) s.firing = false;

    target.explode();
    this.time.delayedCall(600, () => this.showWinner(shooter, `${target.name}'s ship destroyed!`));
  }

  showWinner(winner, subtitle) {
    const { width, height } = this.scale;

    const text = this.add.text(width / 2, height / 2 - 70, `${winner.name} wins!`, {
      fontFamily: FONT,
      fontSize: '96px',
      fontStyle: 'bold',
      color: hexColor(winner.color),
      stroke: '#ffffff',
      strokeThickness: 8,
    }).setOrigin(0.5).setScale(0).setDepth(20);
    this.tweens.add({ targets: text, scale: 1, duration: 400, ease: 'Back.easeOut' });

    this.add.text(width / 2, height / 2 + 10, subtitle, {
      fontFamily: FONT, fontSize: '44px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(20);

    makeButton(this, width / 2, height / 2 + 100, 'Play again', () => {
      this.scene.restart();
    }, { width: 320, height: 90, fontSize: 44 }).setDepth(20);
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
    if (this.gameOver) return;
    for (const ship of this.ships) ship.update(time);

    // Did an asteroid cross a line?
    const [blue, orange] = this.ships;
    for (const rock of this.asteroids.getChildren()) {
      if (rock.scored) continue;
      if (rock.y < this.topLineY) this.scorePoint(rock, blue);          // into orange's side
      else if (rock.y > this.bottomLineY) this.scorePoint(rock, orange); // into blue's side
    }
  }
}

function hexColor(n) {
  return '#' + n.toString(16).padStart(6, '0');
}
