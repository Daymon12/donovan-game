// The game screen: two players face each other across an open middle
// with 5 asteroids floating in it.
//
//   ┌────┬────────────────────┬────┐
//   │ 3  │     ▼ orange       │⚡❄🔥│  ← orange strip (faces the top player)
//   ├ ─ ─┼ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┼─ ─ ┤  ← top line
//   │    │   ●   ●   ●   ●   ●│    │  ← asteroids
//   ├ ─ ─┼ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┼─ ─ ┤  ← bottom line
//   │⚡❄🔥│      ▲ blue        │ 2  │  ← blue strip
//   └────┴────────────────────┴────┘
//
// Shoot an asteroid past the OTHER player's line = 1 point.
// When all rocks are gone, the higher score wins.
// 10 hits destroys a ship; after 3 ships you're out and the other player wins.
import Ship, { FIRE_EVERY_MS } from './ship.js';
import Rock from './rock.js';
import { makePanel, button, el, SIDE_COLUMN } from './hud.js';
import { glowMaterial } from './world.js';

// How deep each player's strip is, as a share of the screen height
// (0.25 = each player gets a quarter, the middle gets half).
const STRIP_SHARE = 0.25;
const ROCK_COUNT = 5;
const BLUE = '#2ec4ff';
const ORANGE = '#ff7a45';

export default class Game {
  constructor(world, ui, { onBack, onRestart }) {
    this.world = world;
    this.ui = ui;
    this.onBack = onBack;
    this.onRestart = onRestart;
    const { W, H } = world;
    this.root = new BABYLON.TransformNode('game', world.scene);
    const STRIP = Math.round(H * STRIP_SHARE);

    // --- The two lines ---
    this.topLineY = STRIP;
    this.bottomLineY = H - STRIP;
    this.drawDashedLine(this.topLineY, ORANGE);
    this.drawDashedLine(this.bottomLineY, BLUE);

    // --- Ships: each lives in its own strip (between the side columns) ---
    const left = SIDE_COLUMN;
    const right = W - SIDE_COLUMN;
    this.ships = [
      new Ship(this, W / 2, H - STRIP / 2, {
        zone: { left, right, top: this.bottomLineY + 4, bottom: H },
        facing: 'up', name: 'Blue', color: BLUE,
      }),
      new Ship(this, W / 2, STRIP / 2, {
        zone: { left, right, top: 0, bottom: this.topLineY - 4 },
        facing: 'down', name: 'Orange', color: ORANGE,
      }),
    ];
    const [blue, orange] = this.ships;
    blue.score = 0;
    orange.score = 0;
    blue.panel = makePanel(ui, blue, { top: false, y: H - STRIP, height: STRIP, width: W });
    orange.panel = makePanel(ui, orange, { top: true, y: 0, height: STRIP, width: W });

    // --- Asteroids in a row across the middle ---
    this.rocks = [];
    for (let i = 0; i < ROCK_COUNT; i++) {
      const x = W * (0.18 + i * (0.64 / (ROCK_COUNT - 1)));
      const y = H / 2 + (i % 2 === 0 ? -30 : 30);
      this.rocks.push(new Rock(this, x, y));
    }

    this.gameOver = false;
    this.setUpTouch();

    // Small "back" button on the left edge of the middle (away from both players).
    button(ui, SIDE_COLUMN / 2, H / 2, '◀ Back', () => this.onBack(),
      { width: 100, height: 52, fontSize: 22 });

    this.stopFrames = world.onFrame((now, dt) => this.update(now, dt));
    window.game = this; // for testing from the browser console
  }

  // Leave the game screen: remove everything it made.
  destroy() {
    this.destroyed = true;
    this.stopFrames();
    this.stopTouch();
    for (const s of this.ships) s.destroy();
    clearTimeout(this.timer);
    // Ships and rocks have their own paint; lines and bullets share theirs.
    for (const thing of [...this.ships, ...this.rocks]) {
      if (!thing.model.isDisposed()) thing.model.dispose(false, true);
    }
    this.root.dispose();
    this.ui.innerHTML = '';
  }

  // ---------- Touch ----------

  // Touch the bottom half to drive the bottom ship, the top half for the top ship.
  // Two fingers at once work, so both players can play together.
  setUpTouch() {
    const { W, H } = this.world;
    const stage = document.getElementById('stage');
    const toBoard = (e) => {
      const r = stage.getBoundingClientRect();
      return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
    };

    const down = (e) => {
      const p = toBoard(e);
      const ship = p.y > H / 2 ? this.ships[0] : this.ships[1];
      if (ship.pointerId !== null) return; // that ship already has a finger
      ship.pointerId = e.pointerId;
      ship.aimAt(p.x, p.y);
      if (!ship.alive) return;
      ship.firing = true;
      const now = performance.now();
      if (!this.gameOver && now - ship.lastShot > FIRE_EVERY_MS) {
        ship.shoot(); // a quick tap fires right away
        ship.lastShot = now;
      }
    };
    const move = (e) => {
      const ship = this.ships.find((s) => s.pointerId === e.pointerId);
      if (ship) {
        const p = toBoard(e);
        ship.aimAt(p.x, p.y);
      }
    };
    const up = (e) => {
      const ship = this.ships.find((s) => s.pointerId === e.pointerId);
      if (ship) {
        ship.pointerId = null;
        ship.firing = false;
      }
    };

    stage.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    this.stopTouch = () => {
      stage.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }

  // ---------- Every frame ----------

  update(now, dt) {
    if (this.gameOver) return;
    for (const ship of this.ships) ship.update(now, dt);

    const live = this.rocks.filter((r) => !r.scored);
    for (const rock of live) rock.tick(now, dt);
    this.bumpRocks(live);

    // Bullets hitting rocks and ships.
    const [blue, orange] = this.ships;
    for (const ship of this.ships) {
      const enemy = ship === blue ? orange : blue;
      for (const b of [...ship.bullets]) {
        const rock = this.rocks.find((r) => !r.scored && Math.hypot(r.x - b.x, r.y - b.y) < r.r + b.r * 0.8);
        if (rock) {
          ship.removeBullet(b);
          this.rockHit(rock, b, now);
        } else if (enemy.alive && enemy.isHitBy(b)) {
          this.shipHit(ship, enemy, b, now);
        }
        if (this.gameOver) return;
      }
    }

    // Did a rock cross a line?
    for (const rock of this.rocks) {
      if (rock.scored) continue;
      const overTop = rock.y < this.topLineY;
      const overBottom = rock.y > this.bottomLineY;
      if (!overTop && !overBottom) continue;

      if (rock.isHot(now)) {
        // Too hot to score: bounce back off the line.
        rock.y = overTop ? this.topLineY : this.bottomLineY;
        rock.vy = overTop ? Math.abs(rock.vy) : -Math.abs(rock.vy);
      } else {
        this.scorePoint(rock, overTop ? blue : orange);
      }
    }
  }

  // Rocks bounce off each other like billiard balls (no speed lost).
  bumpRocks(rocks) {
    for (let i = 0; i < rocks.length; i++) {
      for (let j = i + 1; j < rocks.length; j++) {
        const a = rocks[i];
        const b = rocks[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        const minDist = a.r + b.r;
        if (dist >= minDist || dist === 0) continue;
        const nx = dx / dist;
        const ny = dy / dist;
        // Push them apart so they don't overlap.
        const overlap = (minDist - dist) / 2;
        a.x += nx * overlap; a.y += ny * overlap;
        b.x -= nx * overlap; b.y -= ny * overlap;
        // Swap their speed along the line between them (only if moving together).
        const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (closing < 0) {
          a.vx -= closing * nx; a.vy -= closing * ny;
          b.vx += closing * nx; b.vy += closing * ny;
        }
      }
    }
  }

  // ---------- Powers ----------

  rockHit(rock, bullet, now) {
    switch (bullet.power) {
      case 'electric':
        // Zap: no push, just slows it down for a while.
        rock.zap(now);
        this.world.burst(rock.x, rock.y, { count: 8, color: '#ffe14d', size: [4, 8], dist: [rock.r, rock.r + 30], ms: 260 });
        break;
      case 'freeze':
        if (!rock.piece) this.shatter(rock);
        else rock.pushFrom(bullet.x, bullet.y);
        break;
      case 'lava':
        rock.pushFrom(bullet.x, bullet.y);
        rock.heat(now);
        this.world.burst(bullet.x, bullet.y, { count: 6, color: '#ff8a1f', size: [5, 10], dist: [20, 50], ms: 300 });
        break;
      default:
        rock.pushFrom(bullet.x, bullet.y);
    }
  }

  // A big rock breaks into 4 small icy pieces flying apart sideways.
  // (Only sideways, so pieces don't drift over a line on their own -
  // they keep whatever up/down speed the big rock already had.)
  shatter(rock) {
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const piece = new Rock(this, rock.x + dx * 22, rock.y + dy * 22, {
        piece: true, vx: rock.vx + dx * 45, vy: rock.vy,
      });
      piece.zapUntil = rock.zapUntil; // keep any zap / heat it already had
      piece.hotUntil = rock.hotUntil;
      this.rocks.push(piece);
    }
    this.world.burst(rock.x, rock.y, { count: 12, color: '#dff8ff', size: [5, 12], dist: [50, 90], ms: 450 });
    rock.remove(); // not a point, just gone
  }

  // ---------- Points and winning ----------

  // A rock crossed a line: the player on the OTHER side gets the point.
  scorePoint(rock, scorer) {
    rock.vanish();
    scorer.score += 1;
    scorer.panel.setScore(scorer.score);

    // "+1" pops up where the rock crossed.
    const plus = el('div', 'plus');
    plus.textContent = '+1';
    plus.style.left = `${rock.x}px`;
    plus.style.top = `${rock.y}px`;
    plus.style.color = scorer.color;
    plus.style.setProperty('--rise', scorer === this.ships[0] ? '-60px' : '60px');
    this.ui.append(plus);
    setTimeout(() => plus.remove(), 900);

    if (this.rocks.every((r) => r.scored)) {
      this.timer = setTimeout(() => this.endRound(), 500);
    }
  }

  // All asteroids gone: higher score wins (frozen pieces can make a tie).
  endRound() {
    if (this.gameOver || this.destroyed) return;
    this.stopPlay();
    const [blue, orange] = this.ships;
    const result = `${blue.score} – ${orange.score}`;
    if (blue.score === orange.score) this.showWinner(null, result);
    else this.showWinner(blue.score > orange.score ? blue : orange, result);
  }

  // shooter's bullet hit the target ship.
  shipHit(shooter, target, bullet, now) {
    const result = target.takeHit(now);
    if (result === 'ignored') return; // safe after coming back: bullets pass through
    shooter.removeBullet(bullet);
    if (result === 'gameover') {
      this.stopPlay();
      this.timer = setTimeout(() => this.showWinner(shooter, `${target.name} is out of ships!`), 700);
    }
  }

  stopPlay() {
    this.gameOver = true;
    for (const s of this.ships) s.firing = false;
  }

  // winner = null means a tie.
  showWinner(winner, subtitle) {
    if (this.destroyed) return;
    const { W, H } = this.world;
    const box = el('div', 'winner');
    box.style.top = `${H / 2 - 70}px`;
    const title = el('div', 'winner-title');
    title.textContent = winner ? `${winner.name} wins!` : "It's a tie!";
    title.style.color = winner ? winner.color : '#ffd84d';
    const sub = el('div', 'winner-sub');
    sub.textContent = subtitle;
    box.append(title, sub);
    this.ui.append(box);
    button(this.ui, W / 2, H / 2 + 100, 'Play again', () => this.onRestart(),
      { width: 320, height: 90, fontSize: 44, color: '#2ecc71' });
  }

  drawDashedLine(y, color) {
    const { W } = this.world;
    const mat = glowMaterial(this.world.scene, color);
    for (let x = 0; x < W; x += 40) {
      const dash = BABYLON.MeshBuilder.CreateBox('dash', { width: 24, height: 2, depth: 6 }, this.world.scene);
      dash.material = mat;
      dash.position.copyFrom(this.world.at(x + 12, y, -10));
      dash.parent = this.root;
    }
  }
}
