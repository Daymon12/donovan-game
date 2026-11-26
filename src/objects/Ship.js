// A player's ship. Follows a finger inside its own zone and shoots bullets.
//
// zone   = the rectangle the ship may move in (its strip behind its line).
//          The ship can never leave its zone, so it can't cross its line.
// facing = which way the ship points and shoots: 'up', 'down', 'left' or 'right'.
import * as settings from '../settings.js';

const FOLLOW_SPEED = 0.25;   // 0..1, how quickly the ship catches up to the finger
const FINGER_OFFSET = 70;    // ship sits this far ahead of the finger so it stays visible
const FIRE_EVERY_MS = 180;   // time between shots while the finger is down
export const MAX_LIVES = 10; // hits a ship can take before it's destroyed
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

    // A pool of reusable bullets (faster than creating new ones every shot).
    // Bullets match the ship's colour: 'ship-blue' fires 'bullet-blue'.
    this.bullets = scene.physics.add.group({
      defaultKey: texture.replace('ship', 'bullet'),
      maxSize: 40,
    });

    this.lives = MAX_LIVES;
    this.lifeBar = scene.add.graphics();
  }

  // Where to draw this ship's life bar. dir = 1 grows rightward, -1 leftward.
  placeLifeBar(x, y, dir) {
    this.lifeBarSpot = { x, y, dir };
    this.drawLifeBar();
  }

  // 10 little blocks: full ones are coloured (green, then yellow, then red), lost ones are dark.
  drawLifeBar() {
    const { x, y, dir } = this.lifeBarSpot;
    const g = this.lifeBar;
    const color = this.lives > 6 ? 0x2ecc71 : this.lives > 3 ? 0xffd84d : 0xff4d4d;
    g.clear();
    for (let i = 0; i < MAX_LIVES; i++) {
      const left = dir > 0 ? x + i * 18 : x - i * 18 - 14;
      if (i < this.lives) {
        g.fillStyle(color, 1);
        g.fillRoundedRect(left, y - 11, 14, 22, 4);
      } else {
        g.lineStyle(2, 0x5a5f7a, 1);
        g.strokeRoundedRect(left, y - 11, 14, 22, 4);
      }
    }
  }

  // Lose one life. Returns true if that was the last one.
  takeHit() {
    this.lives = Math.max(0, this.lives - 1);
    this.drawLifeBar();
    if (this.lives > 0) {
      // Quick blink so you can see you got hit.
      this.scene.tweens.add({ targets: this, alpha: 0.3, duration: 70, yoyo: true, repeat: 1 });
    }
    return this.lives === 0;
  }

  // Blow up: ship pieces fly out in its colour and the ship disappears.
  explode() {
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

  // Called by the scene when this ship's finger moves.
  aimAt(x, y) {
    this.target.set(x + this.dir.dx * FINGER_OFFSET, y + this.dir.dy * FINGER_OFFSET);
  }

  update(time) {
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

    // Recycle bullets that flew off the screen.
    const { width, height } = this.scene.scale;
    for (const b of this.bullets.getChildren()) {
      if (b.active && (b.x < -30 || b.x > width + 30 || b.y < -30 || b.y > height + 30)) {
        this.removeBullet(b);
      }
    }
  }

  // Put a bullet back in the pool (off screen, or after it hits something).
  removeBullet(b) {
    b.disableBody(true, true);
  }

  shoot() {
    const noseX = this.x + this.dir.dx * this.halfW;
    const noseY = this.y + this.dir.dy * this.halfH;
    const b = this.bullets.get(noseX, noseY);
    if (!b) return; // all 40 bullets are already flying
    const speed = settings.get('bulletSpeed').value;
    b.enableBody(true, noseX, noseY, true, true);
    b.setAngle(this.dir.angle);
    b.setScale(settings.get('bulletSize').value);
    b.setVelocity(this.dir.dx * speed, this.dir.dy * speed);
  }
}
