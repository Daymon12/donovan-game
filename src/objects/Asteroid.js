// An asteroid floating in the middle. Bullets nudge it, like pushing
// something in space: there's no friction, so every hit adds a little
// speed and it keeps drifting. It bounces off the left and right edges.
// It doesn't spin.
//
// Powers (see ui/powers.js):
//   ⚡ zapped  - yellow, slows down for ZAP_MS
//   ❄ shatter - a big rock breaks into 4 small pieces (done by the scene)
//   🔥 hot     - red, can't score until it cools down (fades back over HOT_MS)

const RADIUS = 42;            // hit circle of a big rock (small pieces are half)
const START_DRIFT = 25;       // slow sideways drift at the start (pixels/second)
const PUSH = 22;              // speed added by each bullet hit ("heavy" = small number)
const PIECE_PUSH = 2.5;       // small pieces get pushed this many times harder
const MAX_SPEED = 380;        // speed limit
const ZAP_MS = 3000;          // how long electric slows it
const ZAP_KEEP = 0.3;         // while zapped, keeps only 30% of its speed each second
export const HOT_MS = 6000;   // how long lava keeps it hot

const ICE = 0xaee8ff;         // colour of frozen pieces
const ZAP = 0xffe14d;         // electric yellow
const HOT = 0xff3b1f;         // lava red

export default class Asteroid extends Phaser.Physics.Arcade.Image {
  constructor(scene, x, y, { piece = false, vx = null, vy = 0 } = {}) {
    super(scene, x, y, piece ? 'asteroid-small' : 'asteroid');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.piece = piece;
    const r = piece ? RADIUS / 2 : RADIUS;
    this.body.setCircle(r, this.width / 2 - r, this.height / 2 - r);
    this.setBounce(1);                     // bounces off walls and each other without slowing
    this.setCollideWorldBounds(true);
    this.setMaxVelocity(MAX_SPEED);

    if (vx === null) {
      // Start with a slow sideways drift (never up/down, so nobody gets a free point).
      const dir = Math.random() < 0.5 ? -1 : 1;
      this.setVelocity(dir * Phaser.Math.Between(START_DRIFT * 0.5, START_DRIFT), 0);
    } else {
      this.setVelocity(vx, vy);
    }

    this.scored = false;
    this.zapUntil = 0;
    this.hotUntil = 0;
    this.updateColor(0);
  }

  // A bullet hit at (bx, by): push away from the hit point.
  pushFrom(bx, by) {
    const strength = PUSH * (this.piece ? PIECE_PUSH : 1);
    const push = new Phaser.Math.Vector2(this.x - bx, this.y - by).normalize().scale(strength);
    this.body.velocity.add(push);
  }

  zap(now) { this.zapUntil = now + ZAP_MS; }
  heat(now) { this.hotUntil = now + HOT_MS; }
  isHot(now) { return now < this.hotUntil; }

  // Called every frame by the scene.
  tick(now, deltaMs) {
    if (now < this.zapUntil) {
      this.body.velocity.scale(Math.pow(ZAP_KEEP, deltaMs / 1000));
    }
    this.updateColor(now);
  }

  updateColor(now) {
    const base = this.piece ? ICE : 0xffffff;
    let color = base;
    if (now < this.hotUntil) {
      // Bright red, fading back to normal as it cools.
      color = mix(base, HOT, (this.hotUntil - now) / HOT_MS);
    } else if (now < this.zapUntil) {
      color = ZAP;
    }
    if (color === 0xffffff) this.clearTint();
    else this.setTint(color);
  }
}

// Blend two colours: t = 0 gives a, t = 1 gives b.
function mix(a, b, t) {
  const ch = (c, s) => (c >> s) & 0xff;
  const m = (s) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}
