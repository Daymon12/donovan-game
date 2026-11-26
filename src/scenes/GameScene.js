// The game screen: two players face each other across an open middle
// with 5 asteroids floating in it.
//
//   ┌────┬────────────────────┬────┐
//   │ 3  │     ▼ orange       │⚡❄🔥│  ← orange strip (HUD faces the top player)
//   ├ ─ ─┼ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┼─ ─ ┤  ← top line
//   │    │   ●   ●   ●   ●   ●│    │  ← asteroids
//   ├ ─ ─┼ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┼─ ─ ┤  ← bottom line
//   │⚡❄🔥│      ▲ blue        │ 2  │  ← blue strip
//   └────┴────────────────────┴────┘
//    power      ship moves     score, health,
//    buttons    in the middle  lives
//
// Shoot an asteroid past the OTHER player's line = 1 point.
// When all rocks are gone, the higher score wins.
// 10 hits destroys a ship; after 3 ships you're out and the other player wins.
import { makeButton } from '../ui/button.js';
import { makePowerButtons } from '../ui/powers.js';
import { makeTextures } from '../art/textures.js';
import Ship from '../objects/Ship.js';
import Asteroid from '../objects/Asteroid.js';

// How deep each player's strip is, as a share of the screen height
// (0.25 = each player gets a quarter, the middle gets half).
const STRIP_SHARE = 0.25;
const SIDE_COLUMN = 110;       // width of the button / score columns at each side
const ASTEROID_COUNT = 5;
const FONT = 'Arial Rounded MT Bold, Arial, sans-serif';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    const { width, height } = this.scale;
    makeTextures(this);
    const STRIP = Math.round(height * STRIP_SHARE);

    // --- The two lines ---
    this.topLineY = STRIP;
    this.bottomLineY = height - STRIP;
    this.drawDashedLine(this.topLineY, width, 0xff7a45);
    this.drawDashedLine(this.bottomLineY, width, 0x2ec4ff);

    // --- Ships: each lives in its own strip (between the side columns) ---
    const shipWidth = width - SIDE_COLUMN * 2;
    this.ships = [
      new Ship(this, width / 2, height - STRIP / 2, {
        zone: new Phaser.Geom.Rectangle(SIDE_COLUMN, this.bottomLineY + 4, shipWidth, STRIP - 4),
        facing: 'up',
        texture: 'ship-blue',
        name: 'Blue',
        color: 0x2ec4ff,
      }),
      new Ship(this, width / 2, STRIP / 2, {
        zone: new Phaser.Geom.Rectangle(SIDE_COLUMN, 0, shipWidth, this.topLineY - 4),
        facing: 'down',
        texture: 'ship-orange',
        name: 'Orange',
        color: 0xff7a45,
      }),
    ];
    const [blue, orange] = this.ships;

    // --- HUD: power buttons on one side, score + health + lives on the other ---
    const colMid = SIDE_COLUMN / 2;
    const spacing = Math.min(84, (STRIP - 16) / 3);
    const blueY = height - STRIP / 2;
    const orangeY = STRIP / 2;

    makePowerButtons(this, blue, colMid, blueY, spacing, false);
    makePowerButtons(this, orange, width - colMid, orangeY, spacing, true);

    blue.score = 0;
    orange.score = 0;
    blue.scoreText = this.makeScoreText(width - colMid, blueY - 62, blue, 0);
    orange.scoreText = this.makeScoreText(colMid, orangeY + 62, orange, 180);
    blue.placeHud(width - colMid, blueY + 6, false);
    orange.placeHud(colMid, orangeY - 6, true);

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

    // --- Bullets hit asteroids: push + the bullet's power ---
    for (const ship of this.ships) {
      this.physics.add.overlap(this.asteroids, ship.bullets, (rock, bullet) => {
        if (!bullet.active || rock.scored) return;
        ship.removeBullet(bullet);
        this.rockHit(rock, bullet);
      });
    }

    // --- Bullets hit the OTHER ship: lose health ---
    this.gameOver = false;
    this.physics.add.overlap(orange, blue.bullets, (ship, bullet) => this.shipHit(blue, orange, bullet));
    this.physics.add.overlap(blue, orange.bullets, (ship, bullet) => this.shipHit(orange, blue, bullet));

    this.setUpTouch(height);

    // Small "back" button on the left edge of the middle (away from both players).
    makeButton(this, colMid, height / 2, '◀ Back', () => {
      this.scene.start('TitleScene');
    }, { width: 100, height: 52, fontSize: 22, color: 0x5b6ee1 }).setDepth(10);
  }

  makeScoreText(x, y, ship, angle) {
    return this.add.text(x, y, '0', {
      fontFamily: FONT,
      fontSize: '56px',
      fontStyle: 'bold',
      color: hexColor(ship.color),
    }).setOrigin(0.5).setAngle(angle).setDepth(4);
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
      ship.aimAt(p.x, p.y);
      if (!ship.alive) return;
      ship.firing = true;
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

  // ---------- Powers ----------

  rockHit(rock, bullet) {
    const now = this.time.now;
    switch (bullet.power) {
      case 'electric':
        // Zap: no push, just slows it down for a while.
        rock.zap(now);
        this.zapEffect(rock);
        break;
      case 'freeze':
        if (!rock.piece) {
          this.shatter(rock);
        } else {
          rock.pushFrom(bullet.x, bullet.y);
        }
        break;
      case 'lava':
        rock.pushFrom(bullet.x, bullet.y);
        rock.heat(now);
        break;
      default:
        rock.pushFrom(bullet.x, bullet.y);
    }
  }

  // A big rock breaks into 4 small icy pieces flying apart sideways.
  // (Only sideways, so pieces don't drift over a line on their own -
  // they keep whatever up/down speed the big rock already had.)
  shatter(rock) {
    const v = rock.body.velocity;
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const piece = new Asteroid(this, rock.x + dx * 22, rock.y + dy * 22, {
        piece: true,
        vx: v.x + dx * 45,
        vy: v.y,
      });
      piece.zapUntil = rock.zapUntil;   // keep any zap / heat it already had
      piece.hotUntil = rock.hotUntil;
      this.asteroids.add(piece);
    }
    // Ice burst.
    for (let i = 0; i < 10; i++) {
      const bit = this.add.circle(rock.x, rock.y, Phaser.Math.Between(3, 7), 0xdff8ff);
      const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
      this.tweens.add({
        targets: bit, x: rock.x + Math.cos(a) * 70, y: rock.y + Math.sin(a) * 70,
        alpha: 0, duration: 450, onComplete: () => bit.destroy(),
      });
    }
    rock.scored = true; // not a point, just gone
    rock.destroy();
  }

  // Little yellow lightning lines around a zapped rock.
  zapEffect(rock) {
    const g = this.add.graphics().setDepth(6);
    g.lineStyle(3, 0xffe14d, 1);
    const r = rock.piece ? 24 : 46;
    for (let i = 0; i < 5; i++) {
      const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
      let x = rock.x + Math.cos(a) * r * 0.6;
      let y = rock.y + Math.sin(a) * r * 0.6;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 3; k++) {
        x += Math.cos(a) * 10 + Phaser.Math.Between(-8, 8);
        y += Math.sin(a) * 10 + Phaser.Math.Between(-8, 8);
        g.lineTo(x, y);
      }
      g.strokePath();
    }
    this.tweens.add({ targets: g, alpha: 0, duration: 250, onComplete: () => g.destroy() });
  }

  // ---------- Points and winning ----------

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

  // All asteroids gone: higher score wins (frozen pieces can make a tie).
  endRound() {
    if (this.gameOver) return;
    this.stopPlay();
    const [blue, orange] = this.ships;
    const result = `${blue.score} – ${orange.score}`;
    if (blue.score === orange.score) this.showWinner(null, result);
    else this.showWinner(blue.score > orange.score ? blue : orange, result);
  }

  // shooter's bullet hit the target ship.
  shipHit(shooter, target, bullet) {
    if (this.gameOver || !bullet.active) return;
    const result = target.takeHit(this.time.now);
    if (result === 'ignored') return; // safe after coming back: bullets pass through
    shooter.removeBullet(bullet);
    if (result === 'gameover') {
      this.stopPlay();
      this.time.delayedCall(700, () => this.showWinner(shooter, `${target.name} is out of ships!`));
    }
  }

  stopPlay() {
    this.gameOver = true;
    this.physics.pause();
    for (const s of this.ships) s.firing = false;
  }

  // winner = null means a tie.
  showWinner(winner, subtitle) {
    const { width, height } = this.scale;

    const text = this.add.text(width / 2, height / 2 - 70, winner ? `${winner.name} wins!` : "It's a tie!", {
      fontFamily: FONT,
      fontSize: '88px',
      fontStyle: 'bold',
      color: winner ? hexColor(winner.color) : '#ffd84d',
      stroke: '#ffffff',
      strokeThickness: 8,
    }).setOrigin(0.5).setScale(0).setDepth(20);
    this.tweens.add({ targets: text, scale: 1, duration: 400, ease: 'Back.easeOut' });

    this.add.text(width / 2, height / 2 + 10, subtitle, {
      fontFamily: FONT, fontSize: '40px', color: '#ffffff',
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
  update(time, delta) {
    if (this.gameOver) return;
    for (const ship of this.ships) ship.update(time);

    // Asteroid powers, and did one cross a line?
    const [blue, orange] = this.ships;
    for (const rock of this.asteroids.getChildren()) {
      if (rock.scored) continue;
      rock.tick(time, delta);

      const overTop = rock.y < this.topLineY;
      const overBottom = rock.y > this.bottomLineY;
      if (!overTop && !overBottom) continue;

      if (rock.isHot(time)) {
        // Too hot to score: bounce back off the line.
        rock.y = overTop ? this.topLineY : this.bottomLineY;
        rock.body.velocity.y = overTop ? Math.abs(rock.body.velocity.y) : -Math.abs(rock.body.velocity.y);
      } else {
        this.scorePoint(rock, overTop ? blue : orange);
      }
    }
  }
}

function hexColor(n) {
  return '#' + n.toString(16).padStart(6, '0');
}
