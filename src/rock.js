// An asteroid floating in the middle (Kenney 3D meteor). Bullets nudge it,
// like pushing something in space: there's no friction, so every hit adds
// a little speed and it keeps drifting. It bounces off the left and right
// edges and off other rocks. It doesn't spin.
//
// Rocks come in 3 sizes (see SIZES). Bigger ones are heavier (pushed less)
// and take more hits to break into 4 small pieces.
//
// Powers (see bullets.js):
//   ⚡ zapped - yellow, slows right down for ZAP_MS
//   ❄ ice    - the charged ice blast explodes rocks (done by the game)
//   🔥 hot    - glows red for a while (just looks hot, it can still score)
import { paint, setGlow, hex } from './world.js';

// The 3 sizes: r = radius in pixels, hits = bullets it takes to break it.
export const SIZES = {
  big:    { r: 52, hits: 15 },
  medium: { r: 40, hits: 10 },
  small:  { r: 29, hits: 6 },
};

const START_DRIFT = 25;       // slow sideways drift at the start (pixels/second)
const PUSH = 22;              // speed added by a bullet hit on a medium rock
const PIECE_PUSH = 4;         // small pieces get pushed this many times harder
const MAX_SPEED = 380;        // speed limit for whole rocks
const PIECE_MAX_SPEED = 600;  // pieces can go faster
const ZAP_MS = 6000;          // how long electric slows it
const ZAP_KEEP = 0.12;        // while zapped, keeps only 12% of its speed each second
const HOT_MS = 6000;          // how long lava keeps it glowing red

const ROCK = hex('#b8a89a');  // normal rock colour
const ICE = hex('#aee8ff');   // colour of pieces
const ZAP = hex('#ffe14d');   // electric yellow
const HOT = hex('#ff3b1f');   // lava red

export default class Rock {
  // size = 'big' | 'medium' | 'small' for whole rocks; pieces pass piece: true and r.
  constructor(game, x, y, { size = 'medium', piece = false, r = 20, vx = null, vy = 0 } = {}) {
    this.game = game;
    this.world = game.world;
    this.piece = piece;
    this.r = piece ? r : SIZES[size].r;
    this.hitsToBreak = piece ? Infinity : SIZES[size].hits;
    this.hits = 0;
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

  // How heavy it is (for bumping into other rocks).
  get mass() { return this.r * this.r; }

  // A hit at (bx, by): push away from the hit point. power = how many times a normal push.
  pushFrom(bx, by, power = 1) {
    const strength = PUSH * power * (this.piece ? PIECE_PUSH : 40 / this.r);
    const dx = this.x - bx;
    const dy = this.y - by;
    const len = Math.hypot(dx, dy) || 1;
    this.vx += (dx / len) * strength;
    this.vy += (dy / len) * strength;
  }

  zap(now) { this.zapUntil = now + ZAP_MS; }
  heat(now) { this.hotUntil = now + HOT_MS; }

  // Called every frame by the game.
  tick(now, dt) {
    if (now < this.zapUntil) {
      const keep = Math.pow(ZAP_KEEP, dt / 1000);
      this.vx *= keep;
      this.vy *= keep;
    }
    // Speed limit.
    const speed = Math.hypot(this.vx, this.vy);
    const limit = this.piece ? PIECE_MAX_SPEED : MAX_SPEED;
    if (speed > limit) {
      this.vx *= limit / speed;
      this.vy *= limit / speed;
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
