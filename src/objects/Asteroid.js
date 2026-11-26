// An asteroid floating in the middle. Bullets nudge it, like pushing
// something in space: there's no friction, so every hit adds a little
// speed and it keeps drifting. It bounces off the left and right edges.

const RADIUS = 42;          // hit circle size
const START_DRIFT = 25;     // slow sideways drift at the start (pixels/second)
const PUSH = 22;            // speed added by each bullet hit ("heavy" = small number)
const MAX_SPEED = 380;      // speed limit

export default class Asteroid extends Phaser.Physics.Arcade.Image {
  constructor(scene, x, y) {
    super(scene, x, y, 'asteroid');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setCircle(RADIUS, this.width / 2 - RADIUS, this.height / 2 - RADIUS);
    this.setBounce(1);                     // bounces off walls and each other without slowing
    this.setCollideWorldBounds(true);
    this.setMaxVelocity(MAX_SPEED);

    // Start with a slow sideways drift (never up/down, so nobody gets a free point).
    const dir = Math.random() < 0.5 ? -1 : 1;
    this.setVelocity(dir * Phaser.Math.Between(START_DRIFT * 0.5, START_DRIFT), 0);
    this.setAngularVelocity(Phaser.Math.Between(-25, 25)); // slow spin, just for looks

    this.scored = false;
  }

  // A bullet hit at (bx, by): push away from the hit point.
  pushFrom(bx, by) {
    const push = new Phaser.Math.Vector2(this.x - bx, this.y - by).normalize().scale(PUSH);
    this.body.velocity.add(push);
  }
}
