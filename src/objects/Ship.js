// A player's ship. Follows a finger inside its own zone and shoots bullets.
//
// zone = the rectangle the ship may move in, e.g. the bottom half of the screen.
// The ship can never leave its zone, so it can't cross the centre line.

const FOLLOW_SPEED = 0.25;   // 0..1, how quickly the ship catches up to the finger
const FINGER_OFFSET = 70;    // ship sits this far above the finger so it stays visible
const FIRE_EVERY_MS = 180;   // time between shots while the finger is down
const BULLET_SPEED = 750;    // pixels per second

export default class Ship extends Phaser.Physics.Arcade.Image {
  constructor(scene, x, y, zone) {
    super(scene, x, y, 'ship');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.zone = zone;
    this.target = new Phaser.Math.Vector2(x, y);
    this.firing = false;
    this.lastShot = 0;

    // A pool of reusable bullets (faster than creating new ones every shot).
    this.bullets = scene.physics.add.group({ defaultKey: 'bullet', maxSize: 40 });
  }

  // Called by the scene when this ship's finger moves.
  aimAt(x, y) {
    this.target.set(x, y - FINGER_OFFSET);
  }

  update(time) {
    // Glide toward the finger...
    this.x += (this.target.x - this.x) * FOLLOW_SPEED;
    this.y += (this.target.y - this.y) * FOLLOW_SPEED;

    // ...but stay inside the zone (this is what makes the line a wall).
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    this.x = Phaser.Math.Clamp(this.x, this.zone.left + halfW, this.zone.right - halfW);
    this.y = Phaser.Math.Clamp(this.y, this.zone.top + halfH, this.zone.bottom - halfH);

    if (this.firing && time - this.lastShot > FIRE_EVERY_MS) {
      this.shoot();
      this.lastShot = time;
    }

    // Recycle bullets that flew off the screen.
    for (const b of this.bullets.getChildren()) {
      if (b.active && b.y < -30) {
        this.bullets.killAndHide(b);
        b.body.stop();
      }
    }
  }

  shoot() {
    const b = this.bullets.get(this.x, this.y - this.height / 2);
    if (!b) return; // all 40 bullets are already flying
    b.setActive(true).setVisible(true);
    b.body.reset(this.x, this.y - this.height / 2);
    b.setVelocityY(-BULLET_SPEED);
  }
}
