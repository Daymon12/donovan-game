// A player's ship (Kenney 3D model). Follows a finger inside its own zone
// and shoots.
//
// zone   = the area the ship may move in (its strip behind its line),
//          as { left, right, top, bottom } in board pixels.
//          The ship can never leave its zone, so it can't cross its line.
// facing = 'up' (bottom player) or 'down' (top player).
//
// How each power fires while your finger is down:
//   ⚡ Electric - a steady stream of bolts.
//   ❄ Ice      - an ice crystal grows at the tip of the gun; when it's full,
//                a big ice blast fires. Then a cool-down before it can charge again.
//                Getting hit by the other player resets the charge.
//   🔥 Lava     - one fireball, then a cool-down (longer than the ice's).
//
// Health: 10 hits destroys the ship. It has 3 lives: after blowing up it
// comes back (with full health and a short safe time) until all 3 are used.
import * as settings from './settings.js';
import { paint, setVisibility, hex } from './world.js';
import { makeBullet } from './bullets.js';

const SHIP_SIZE = 84;        // how big the ship is on screen (pixels)
const FOLLOW_SPEED = 0.25;   // 0..1, how quickly the ship catches up to the finger
const FINGER_OFFSET = 70;    // ship sits this far ahead of the finger so it stays visible
const FIRE_EVERY_MS = 180;   // time between electric bolts while the finger is down
const ICE_CHARGE_MS = 1200;  // how long the ice takes to grow to full
const ICE_COOLDOWN_MS = 3000;  // wait after an ice blast before it can charge again
const LAVA_COOLDOWN_MS = 4500; // wait after a fireball before the next one
const ICE_BLAST_SIZE = 2.4;  // the ice blast is this many times bigger than a normal bullet
const ICE_BLAST_SPEED = 1.4; // ...and this many times faster
export const MAX_HEALTH = 10; // hits per life
export const MAX_LIVES = 3;   // ships per game
const RESPAWN_MS = 1500;      // wait before coming back after blowing up
const SAFE_MS = 1500;         // can't be hit for this long after coming back
const HALF_W = 36;            // half the ship's size, for keeping it inside its zone
const HALF_H = 40;
const HIT_W = 26;             // hit box (a bit smaller than the ship, so near-misses don't count)
const HIT_H = 30;
// Which way the Kenney ship model points; turn it so its nose faces "up" on screen.
const MODEL_TURN = Math.PI;
// Bullet speed and size come from the Settings screen (see settings.js).

const COOLDOWNS = { freeze: ICE_COOLDOWN_MS, lava: LAVA_COOLDOWN_MS };

export default class Ship {
  constructor(game, x, y, { zone, facing, name, color }) {
    this.game = game;
    this.world = game.world;
    this.name = name;
    this.color = color;               // e.g. '#2ec4ff'
    this.zone = zone;
    this.dy = facing === 'up' ? -1 : 1;
    this.home = { x, y };
    this.x = x;
    this.y = y;
    this.target = { x, y };
    this.firing = false;
    this.lastShot = 0;
    this.pointerId = null;   // which finger is driving this ship
    this.power = 'electric'; // picked with the power buttons
    this.bullets = [];
    this.iceCharge = 0;      // 0 = empty, 1 = full (fires)
    this.readyAt = { freeze: 0, lava: 0 }; // when each cool-down ends

    this.health = MAX_HEALTH;
    this.lives = MAX_LIVES;
    this.alive = true;
    this.safeUntil = 0;
    this.flashUntil = 0;

    // The 3D model: Kenney's ship, with its orange parts painted in our colour.
    this.model = this.world.spawn('ship', SHIP_SIZE);
    this.model.parent = game.root;
    this.model.rotation.y = MODEL_TURN + (facing === 'up' ? 0 : Math.PI);
    const mine = hex(color);
    paint(this.model, (c) => (isColourful(c) ? mine : c));

    // The ice crystal that grows at the tip of the gun while charging.
    this.chargeMesh = makeBullet(this.world.scene, 'freeze', color, 1);
    this.chargeMesh.parent = game.root;
    this.chargeMesh.setEnabled(false);

    this.place();
  }

  // Called by the game when this ship's finger moves.
  aimAt(x, y) {
    this.target.x = x;
    this.target.y = y + this.dy * FINGER_OFFSET;
  }

  // Picked a power button. Switching away from ice loses the charge.
  setPower(key) {
    if (key !== this.power) this.iceCharge = 0;
    this.power = key;
  }

  // 0..1: how much of this power's cool-down is left (0 = ready).
  cooldownLeft(key, now) {
    const total = COOLDOWNS[key];
    if (!total) return 0;
    return Math.max(0, (this.readyAt[key] - now) / total);
  }

  // Fire right away if this power is ready (a quick tap fires straight away).
  tryFire(now) {
    if (!this.alive) return;
    if (this.power === 'electric' && now - this.lastShot > FIRE_EVERY_MS) {
      this.shoot('electric');
      this.lastShot = now;
    } else if (this.power === 'lava' && now >= this.readyAt.lava) {
      this.shoot('lava');
      this.readyAt.lava = now + LAVA_COOLDOWN_MS;
    }
    // Ice doesn't fire on a tap: it charges in update() while the finger is down.
  }

  update(now, dt) {
    this.moveBullets(dt);
    if (!this.alive) {
      this.chargeMesh.setEnabled(false);
      return;
    }

    // Glide toward the finger (same feel at any frame rate)...
    const k = 1 - Math.pow(1 - FOLLOW_SPEED, dt / (1000 / 60));
    const oldX = this.x;
    this.x += (this.target.x - this.x) * k;
    this.y += (this.target.y - this.y) * k;

    // ...but stay inside the zone (this is what makes the line a wall).
    const z = this.zone;
    this.x = clamp(this.x, z.left + HALF_W, z.right - HALF_W);
    this.y = clamp(this.y, z.top + HALF_H, z.bottom - HALF_H);

    // Lean into turns, like a real spaceship banking.
    const lean = clamp((this.x - oldX) / Math.max(dt, 1) * 0.6, -0.6, 0.6);
    this.model.rotation.z += (lean * -this.dy - this.model.rotation.z) * 0.2;

    if (this.firing) {
      this.tryFire(now);
      // Ice: grow the crystal; when full, blast it.
      if (this.power === 'freeze' && now >= this.readyAt.freeze) {
        this.iceCharge += dt / ICE_CHARGE_MS;
        if (this.iceCharge >= 1) {
          this.iceCharge = 0;
          this.shoot('iceblast');
          this.readyAt.freeze = now + ICE_COOLDOWN_MS;
          this.world.burst(this.x, this.y + this.dy * (HALF_H + 20), {
            count: 8, color: '#dff8ff', size: [5, 10], dist: [20, 50], ms: 250,
          });
        }
      }
    }

    this.place();
    this.drawCharge(now);

    // Flicker when hit, blink while safe after coming back.
    let v = 1;
    if (now < this.flashUntil) v = 0.3;
    else if (now < this.safeUntil) v = Math.floor(now / 125) % 2 ? 0.25 : 1;
    setVisibility(this.model, v);
  }

  place() {
    this.model.position.copyFrom(this.world.at(this.x, this.y, 20));
  }

  // The ice crystal at the gun tip: grows (and wobbles) as it charges.
  drawCharge(now) {
    const c = this.iceCharge;
    const m = this.chargeMesh;
    if (c <= 0 || this.power !== 'freeze') {
      m.setEnabled(false);
      return;
    }
    m.setEnabled(true);
    const size = settings.get('bulletSize').value;
    const wobble = 1 + 0.08 * Math.sin(now / 40) * c;
    m.scaling.setAll(size * (0.3 + (ICE_BLAST_SIZE - 0.3) * c) * wobble);
    m.position.copyFrom(this.world.at(this.x, this.y + this.dy * (HALF_H + 8 + 22 * c), 30));
  }

  // ---------- Bullets ----------

  // kind = 'electric', 'lava' or 'iceblast'
  shoot(kind) {
    if (!this.alive) return;
    let size = settings.get('bulletSize').value;
    let speed = settings.get('bulletSpeed').value;
    if (kind === 'iceblast') {
      size *= ICE_BLAST_SIZE;
      speed *= ICE_BLAST_SPEED;
    }
    const b = {
      x: this.x,
      y: this.y + this.dy * HALF_H,
      vy: this.dy * speed,
      r: 12 * size,
      power: kind,
      mesh: makeBullet(this.world.scene, kind === 'iceblast' ? 'freeze' : kind, this.color, size),
    };
    b.mesh.parent = this.game.root;
    b.mesh.position.copyFrom(this.world.at(b.x, b.y, 20));
    this.bullets.push(b);
  }

  moveBullets(dt) {
    const { H } = this.world;
    for (const b of this.bullets) {
      b.y += b.vy * dt / 1000;
      b.mesh.position.z = H / 2 - b.y;
      if (b.y < -60 || b.y > H + 60) this.removeBullet(b);
    }
  }

  // Take a bullet away (off screen, or after it hits something).
  removeBullet(b) {
    if (b.gone) return;
    b.gone = true;
    b.mesh.dispose();
    this.bullets = this.bullets.filter((x) => x !== b);
  }

  // Did bullet b hit this ship?
  isHitBy(b) {
    return Math.abs(b.x - this.x) < HIT_W + b.r && Math.abs(b.y - this.y) < HIT_H + b.r;
  }

  // ---------- Health and lives ----------

  // Lose 1 health. Returns 'ignored' (safe or already blown up), 'hit',
  // 'destroyed' (blew up, will come back) or 'gameover' (no lives left).
  takeHit(now) {
    if (!this.alive || now < this.safeUntil) return 'ignored';
    this.iceCharge = 0; // getting hit knocks out the ice charge: start again
    this.health -= 1;
    if (this.health > 0) {
      this.flashUntil = now + 140;
      this.onChange?.();
      return 'hit';
    }
    this.lives -= 1;
    this.explode();
    this.onChange?.();
    if (this.lives > 0) {
      this.respawnTimer = setTimeout(() => this.respawn(), RESPAWN_MS);
      return 'destroyed';
    }
    return 'gameover';
  }

  respawn() {
    if (this.game.destroyed) return;
    this.health = MAX_HEALTH;
    this.x = this.home.x;
    this.y = this.home.y;
    this.target = { ...this.home };
    this.alive = true;
    this.firing = this.pointerId !== null; // keep shooting if a finger is still down
    this.safeUntil = performance.now() + SAFE_MS;
    this.model.setEnabled(true);
    this.place();
    this.onChange?.();
  }

  // Blow up: glowing pieces fly out in the ship's colour and it disappears.
  explode() {
    this.alive = false;
    this.firing = false;
    this.world.burst(this.x, this.y, { count: 12, color: this.color, size: [10, 22], dist: [60, 170], ms: 750 });
    this.world.burst(this.x, this.y, { count: 6, color: '#ffd84d', size: [8, 16], dist: [40, 120], ms: 600 });
    this.world.shake(300, 10);
    this.model.setEnabled(false);
    this.chargeMesh.setEnabled(false);
  }

  destroy() {
    clearTimeout(this.respawnTimer);
  }
}

// The bright "paint" parts of the Kenney model (its orange stripes),
// as opposed to the white / grey body.
function isColourful(c) {
  return Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) > 0.3;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
