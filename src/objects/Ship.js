// A player's ship. Follows a finger inside its own zone and shoots bullets.
//
// zone   = the rectangle the ship may move in (its strip behind its line).
//          The ship can never leave its zone, so it can't cross its line.
// facing = which way the ship points and shoots: 'up', 'down', 'left' or 'right'.
//
// Health: 10 hits destroys the ship. It has 3 lives: after blowing up it
// comes back (with full health and a short safe time) until all 3 are used.
import * as settings from '../settings.js';

const FOLLOW_SPEED = 0.25;   // 0..1, how quickly the ship catches up to the finger
const FINGER_OFFSET = 70;    // ship sits this far ahead of the finger so it stays visible
const FIRE_EVERY_MS = 180;   // time between shots while the finger is down
export const MAX_HEALTH = 10; // hits per life
export const MAX_LIVES = 3;   // ships per game
const RESPAWN_MS = 1500;      // wait before coming back after blowing up
const SAFE_MS = 1500;         // can't be hit for this long after coming back
// Bullet speed and size come from the Settings screen (see settings.js).

const DIRECTIONS = {
  up:    { angle: 0,   dx: 0,  dy: -1 },
  right: { angle: 90,  dx: 1,  dy: 0 },
  down:  { angle: 180, dx: 0,  dy: 1 },
  left:  { angle: -90, dx: -1, dy: 0 },
};

export default class Ship extends Phaser.Physics.Arcade.Image {
  constructor(scene, x, y, { zone, facing = 'up', texture = 'ship-blue', name = 'Player', color = 0xffffff }) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.name = name;
    this.color = color;
    this.colorName = texture.replace('ship-', ''); // 'blue' or 'orange'
    this.home = { x, y };
    // Hit box a bit smaller than the picture, so near-misses don't count.
    this.body.setSize(52, 60, true);

    this.dir = DIRECTIONS[facing];
    this.setAngle(this.dir.angle);

    // Size on screen after turning (sideways ships are wider than tall).
    const sideways = this.dir.dx !== 0;
    this.halfW = (sideways ? this.height : this.width) / 2;
    this.halfH = (sideways ? this.width : this.height) / 2;

    this.zone = zone;
    this.target = new Phaser.Math.Vector2(x, y);
    this.firing = false;
    this.lastShot = 0;
    this.pointerId = null; // which finger is driving this ship
    this.power = 'electric'; // picked with the power buttons

    // A pool of reusable bullets (faster than creating new ones every shot).
    this.bullets = scene.physics.add.group({ maxSize: 40 });

    this.health = MAX_HEALTH;
    this.lives = MAX_LIVES;
    this.alive = true;
    this.safeUntil = 0;
    this.hud = scene.add.graphics().setDepth(4);
  }

  // Called by the scene when this ship's finger moves.
  aimAt(x, y) {
    this.target.set(x + this.dir.dx * FINGER_OFFSET, y + this.dir.dy * FINGER_OFFSET);
  }

  update(time) {
    // Recycle bullets that flew off the screen.
    const { width, height } = this.scene.scale;
    for (const b of this.bullets.getChildren()) {
      if (b.active && (b.x < -40 || b.x > width + 40 || b.y < -40 || b.y > height + 40)) {
        this.removeBullet(b);
      }
    }
    if (!this.alive) return;

    // Glide toward the finger...
    this.x += (this.target.x - this.x) * FOLLOW_SPEED;
    this.y += (this.target.y - this.y) * FOLLOW_SPEED;

    // ...but stay inside the zone (this is what makes the line a wall).
    this.x = Phaser.Math.Clamp(this.x, this.zone.left + this.halfW, this.zone.right - this.halfW);
    this.y = Phaser.Math.Clamp(this.y, this.zone.top + this.halfH, this.zone.bottom - this.halfH);

    if (this.firing && time - this.lastShot > FIRE_EVERY_MS) {
      this.shoot();
      this.lastShot = time;
    }
  }

  // Put a bullet back in the pool (off screen, or after it hits something).
  removeBullet(b) {
    b.disableBody(true, true);
  }

  shoot() {
    if (!this.alive) return;
    const key = `bullet-${this.power}-${this.colorName}`;
    const noseX = this.x + this.dir.dx * this.halfW;
    const noseY = this.y + this.dir.dy * this.halfH;
    const b = this.bullets.get(noseX, noseY, key);
    if (!b) return; // all 40 bullets are already flying
    const speed = settings.get('bulletSpeed').value;
    b.setTexture(key);
    b.power = this.power;
    b.enableBody(true, noseX, noseY, true, true);
    b.setAngle(this.dir.angle);
    b.setScale(settings.get('bulletSize').value);
    b.setVelocity(this.dir.dx * speed, this.dir.dy * speed);
  }

  // ---------- Health and lives ----------

  // Lose 1 health. Returns 'ignored' (safe or already blown up), 'hit',
  // 'destroyed' (blew up, will come back) or 'gameover' (no lives left).
  takeHit(time) {
    if (!this.alive || time < this.safeUntil) return 'ignored';
    this.health -= 1;
    if (this.health > 0) {
      this.scene.tweens.add({ targets: this, alpha: 0.3, duration: 70, yoyo: true, repeat: 1 });
      this.drawHud();
      return 'hit';
    }
    this.lives -= 1;
    this.explode();
    this.drawHud();
    if (this.lives > 0) {
      this.scene.time.delayedCall(RESPAWN_MS, () => this.respawn());
      return 'destroyed';
    }
    return 'gameover';
  }

  respawn() {
    this.health = MAX_HEALTH;
    this.setPosition(this.home.x, this.home.y);
    this.target.set(this.home.x, this.home.y);
    this.body.reset(this.home.x, this.home.y);
    this.body.enable = true;
    this.setVisible(true);
    this.alive = true;
    this.firing = this.pointerId !== null; // keep shooting if a finger is still down
    this.safeUntil = this.scene.time.now + SAFE_MS;
    // Blink while safe.
    this.scene.tweens.add({
      targets: this, alpha: 0.25, duration: 125, yoyo: true,
      repeat: Math.floor(SAFE_MS / 250) - 1, onComplete: () => this.setAlpha(1),
    });
    this.drawHud();
  }

  // Blow up: ship pieces fly out in its colour and the ship disappears.
  explode() {
    this.alive = false;
    this.firing = false;
    this.body.enable = false;
    const scene = this.scene;
    for (let i = 0; i < 14; i++) {
      const piece = scene.add.circle(this.x, this.y, Phaser.Math.Between(5, 12),
        i % 3 === 0 ? 0xffd84d : this.color);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.Between(60, 160);
      scene.tweens.add({
        targets: piece,
        x: this.x + Math.cos(angle) * dist,
        y: this.y + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0.3,
        duration: 700,
        ease: 'Cubic.easeOut',
        onComplete: () => piece.destroy(),
      });
    }
    scene.cameras.main.shake(250, 0.01);
    this.setVisible(false);
  }

  // ---------- Health bar and lives display ----------

  // Where to draw this ship's health bar and lives. flip = true for the top player.
  placeHud(x, y, flip) {
    this.hudSpot = { x, y, flip };
    this.drawHud();
  }

  drawHud() {
    const { x, y, flip } = this.hudSpot;
    const g = this.hud;
    g.clear();

    // Health: 10 small blocks (green, then yellow, then red).
    const color = this.health > 6 ? 0x2ecc71 : this.health > 3 ? 0xffd84d : 0xff4d4d;
    const left0 = x - (MAX_HEALTH * 10 - 2) / 2;
    for (let i = 0; i < MAX_HEALTH; i++) {
      const slot = flip ? MAX_HEALTH - 1 - i : i; // top player's bar empties from their right
      const left = left0 + i * 10;
      if (slot < this.health) {
        g.fillStyle(color, 1);
        g.fillRoundedRect(left, y - 9, 8, 18, 3);
      } else {
        g.lineStyle(2, 0x5a5f7a, 1);
        g.strokeRoundedRect(left, y - 9, 8, 18, 3);
      }
    }

    // Lives: 3 little ships. Used-up ones are outlines.
    const ly = y + (flip ? -32 : 32);
    const tip = flip ? 10 : -10; // little ships point the same way as the real one
    for (let i = 0; i < MAX_LIVES; i++) {
      const cx = x + (i - 1) * 30;
      const p = [cx, ly + tip, cx - 10, ly - tip, cx + 10, ly - tip];
      if (i < this.lives) {
        g.fillStyle(this.color, 1);
        g.fillTriangle(...p);
      } else {
        g.lineStyle(2, 0x5a5f7a, 1);
        g.strokeTriangle(...p);
      }
    }
  }
}
