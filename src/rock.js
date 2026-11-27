// An asteroid floating in the middle (Kenney 3D meteor). Bullets nudge it,
// like pushing something in space: there's no friction, so every hit adds
// a little speed and it keeps drifting. It bounces off the left and right
// edges and off other rocks. It doesn't spin.
//
// Powers (see bullets.js):
//   ⚡ zapped  - yellow, slows down for ZAP_MS
//   ❄ shatter - a big rock breaks into 4 small pieces (done by the game)
//   🔥 hot     - red, can't score until it cools down (fades back over HOT_MS)
import { paint, setGlow, hex } from './world.js';

const RADIUS = 42;            // hit circle of a big rock (small pieces are half)
const START_DRIFT = 25;       // slow sideways drift at the start (pixels/second)
const PUSH = 22;              // speed added by each bullet hit ("heavy" = small number)
const PIECE_PUSH = 2.5;       // small pieces get pushed this many times harder
const MAX_SPEED = 380;        // speed limit
const ZAP_MS = 3000;          // how long electric slows it
const ZAP_KEEP = 0.3;         // while zapped, keeps only 30% of its speed each second
export const HOT_MS = 6000;   // how long lava keeps it hot

const ROCK = hex('#b8a89a');  // normal rock colour
const ICE = hex('#aee8ff');   // colour of frozen pieces
const ZAP = hex('#ffe14d');   // electric yellow
const HOT = hex('#ff3b1f');   // lava red

export default class Rock {
  constructor(game, x, y, { piece = false, vx = null, vy = 0 } = {}) {
    this.game = game;
    this.world = game.world;
    this.piece = piece;
    this.r = piece ? RADIUS / 2 : RADIUS;
    this.x = x;
    this.y = y;

    if (vx === null) {
      // Start with a slow sideways drift (never up/down, so nobody gets a free point).
      const dir = Math.random() < 0.5 ? -1 : 1;
      this.vx = dir * (START_DRIFT * (0.5 + Math.random() * 0.5));
      this.vy = 0;
    } else {
      this.vx = vx;
      this.vy = vy;
    }

    this.scored = false;
    this.zapUntil = 0;
    this.hotUntil = 0;
    this.look = '';

    this.model = this.world.spawn(piece ? 'piece' : 'rock', this.r * 2.3);
    this.model.parent = game.root;
    // Each rock sits at its own fixed angle so they don't all look the same
    // (set once - they never turn).
    this.model.rotation.y = Math.random() * Math.PI * 2;
    this.updateColor(0);
    this.place();
  }

  // A bullet hit at (bx, by): push away from the hit point.
  pushFrom(bx, by) {
    const strength = PUSH * (this.piece ? PIECE_PUSH : 1);
    let dx = this.x - bx;
    let dy = this.y - by;
    const len = Math.hypot(dx, dy) || 1;
    this.vx += (dx / len) * strength;
    this.vy += (dy / len) * strength;
  }

  zap(now) { this.zapUntil = now + ZAP_MS; }
  heat(now) { this.hotUntil = now + HOT_MS; }
  isHot(now) { return now < this.hotUntil; }

  // Called every frame by the game.
  tick(now, dt) {
    if (now < this.zapUntil) {
      const keep = Math.pow(ZAP_KEEP, dt / 1000);
      this.vx *= keep;
      this.vy *= keep;
    }
    // Speed limit.
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > MAX_SPEED) {
      this.vx *= MAX_SPEED / speed;
      this.vy *= MAX_SPEED / speed;
    }
    this.x += this.vx * dt / 1000;
    this.y += this.vy * dt / 1000;

    // Bounce off the left and right edges.
    const { W } = this.world;
    if (this.x < this.r) { this.x = this.r; this.vx = Math.abs(this.vx); }
    if (this.x > W - this.r) { this.x = W - this.r; this.vx = -Math.abs(this.vx); }

    this.updateColor(now);
    this.place();
  }

  place() {
    this.model.position.copyFrom(this.world.at(this.x, this.y, 0));
  }

  updateColor(now) {
    const base = this.piece ? ICE : ROCK;
    const heat = now < this.hotUntil ? (this.hotUntil - now) / HOT_MS : 0;
    const zapped = !heat && now < this.zapUntil;
    // Only repaint when the look changes (heat fades in small steps).
    const look = heat ? 'h' + Math.ceil(heat * 20) : zapped ? 'z' : 'n';
    if (look === this.look) return;
    this.look = look;

    let color = base;
    if (heat) color = BABYLON.Color3.Lerp(base, HOT, heat);
    else if (zapped) color = ZAP;
    // Keep the light and dark parts of the model, just change the colour.
    paint(this.model, (c) => color.scale(0.55 + 0.6 * brightness(c)));
    if (heat) setGlow(this.model, HOT, 0.35 * heat);
    else if (zapped) setGlow(this.model, ZAP, 0.2);
    else setGlow(this.model, base, 0);
  }

  // Scored: puff up and fade away.
  vanish() {
    this.scored = true;
    const s = this.model.scaling.x;
    this.world.animate(350, (t) => {
      this.model.scaling.setAll(s * (1 + 0.6 * t));
      for (const m of this.model.getChildMeshes()) m.visibility = 1 - t;
    }, () => this.model.dispose(false, true));
  }

  remove() {
    this.scored = true;
    this.model.dispose(false, true);
  }
}

function brightness(c) {
  return Math.max(c.r, c.g, c.b);
}
