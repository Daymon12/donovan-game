// Zombie Jeep: you drive a jeep, seen from above, on a grassy field.
//
//   - Put a finger down anywhere: a joystick appears right under it. Slide
//     the finger: the jeep turns that way and drives, faster the further
//     you slide. Lift it: the joystick goes and the jeep stops.
//     With two jeeps, the left half of the screen drives jeep 1 and the
//     right half drives jeep 2.
//   - Zombies dig their way out of the ground (a hole opens, then a zombie
//     climbs out) and chase the closest jeep. Don't let one touch you!
//   - Waves: every 30 seconds a new wave starts, and each is harder:
//     zombies come quicker, more of them are fast ones (who run faster
//     every wave), and the slow ones take more hits to knock out.
//   - At the end of each wave a big boss zombie digs out. The next wave
//     only starts once it's knocked out (it takes lots of hits).
//   - Potion bottles pop up now and then. Drive over one for a power-up:
//     blue = speed, yellow = rapid fire, purple = shield.
//   - A gun turret on top of each jeep swings round by itself and shoots
//     the closest zombie (if it's near enough). One shot knocks a zombie out.
//   - New areas: at wave 5 (and every 5 waves after) the trees on the right
//     side part to open a path to a new field next door. The view follows
//     the jeeps (the middle of both, with two players), and the two jeeps
//     can't drive further apart than the screen is wide.
//   - A second player can tap "+ Jeep 2" to join with an orange jeep.
//     If a zombie gets one jeep, the other keeps going, and a red rescue
//     potion pops up: grab it (or beat the boss) and the caught jeep comes
//     back. Game over when both are out.
//
// The jeeps and zombies are built from 3D blocks right here in code.
import { button, el } from './hud.js';
import { hex, glowMaterial, setVisibility, paint as paintModel } from './world.js';
import * as sound from './sound.js';

const JEEP_TOP_SPEED = 300;    // pixels per second
const JEEP_TURN = 5;           // how fast it turns (radians per second)
const JEEP_BRAKE = 1400;       // how quickly it stops when you let go
// Joysticks: one appears wherever a finger goes down.
const STICK_RADIUS = 80;       // how far the knob moves from the middle
const STICK_DEAD = 0.15;       // tiny pushes don't move the jeep
const JEEP_RADIUS = 34;        // for bumping into zombies
const JOIN_SAFE_MS = 2000;
const REAR_AXLE = 22;          // back wheels: this far behind the jeep's middle...
const WHEEL_GAP = 19;          // ...and this far either side (for tyre tracks)     // a jeep that just joined can't be caught for this long
const ZOMBIE_RADIUS = 24;
const FIRST_ZOMBIE_MS = 1200;  // first zombie arrives after this long

// Waves: every WAVE_MS a new, harder wave starts.
const WAVE_MS = 30000;
const SPAWN_EVERY_MS = 2000;   // time between zombies in wave 1...
const SPAWN_QUICKER = 0.85;    // ...each wave they come this much quicker...
const SPAWN_FASTEST_MS = 500;  // ...but never quicker than this

// Two kinds of zombie:
//   slow  - shuffles along at the same speed every wave, but takes one more
//           hit to knock out each wave (wave 1: 1 hit, wave 2: 2 hits, ...).
//   fast  - thin, orange shirt, darker skin. Always 1 hit, but runs faster
//           every wave. More of them show up in later waves.
const SLOW_SPEED = [40, 60];   // pixels per second
const SLOW_TURN = 1.6;         // how fast it turns to follow a jeep (radians/second)
const SLOW_MAX_HITS = 8;
const FAST_SPEED = 110;        // in wave 1...
const FAST_SPEED_PER_WAVE = 22; // ...plus this much each wave...
const FAST_SPEED_MAX = 240;    // ...up to this (the jeep's top speed is 300)
const FAST_TURN = 2.4;
const FAST_CHANCE = 0.15;      // share of fast zombies in wave 1...
const FAST_CHANCE_PER_WAVE = 0.1; // ...plus this each wave...
const FAST_CHANCE_MAX = 0.6;   // ...up to this

// The boss: when a wave's 30 seconds are up, a big zombie (about as big as
// the jeep) digs out. Other zombies keep coming, and the next wave only
// starts once the boss is knocked out.
const BOSS_SIZE = 2.2;         // times bigger than a normal zombie
const BOSS_SPEED = 32;         // slow, heavy steps
const BOSS_TURN = 1.0;
const BOSS_HITS = 20;          // hits to knock it out in wave 1...
const BOSS_HITS_PER_WAVE = 8;  // ...plus this many more each wave

// Potion bottles pop up now and then; drive over one for a power-up.
const POTION_EVERY_MS = [7000, 11000]; // a new bottle every 7 to 11 seconds
const POTION_LASTS_MS = 10000;  // a bottle disappears if nobody grabs it
const BOOST_MS = 7000;          // how long a power-up lasts
const POTIONS = {
  speed:  { color: '#3aa0ff', label: 'Speed!' },     // jeep drives much faster
  rapid:  { color: '#ffd84d', label: 'Rapid fire!' }, // gun shoots much faster
  shield: { color: '#b46bff', label: 'Shield!' },    // zombies can't get you
};
// Rescue potion: only shows up while a jeep is caught. Grab it and that jeep comes back.
const RESCUE = { color: '#ff4d6d', label: 'Rescue!' };
const RESCUE_AFTER_MS = 4000;   // pops up this long after a jeep is caught (or after the last one vanished)
const RESCUE_LASTS_MS = 15000;
const SPEED_BOOST = 1.6;        // top speed x1.6 with the speed potion
const RAPID_FIRE_MS = 200;      // time between shots with the rapid-fire potion
const HOLE_MS = 900;           // a hole takes this long to open...
const CLIMB_MS = 900;          // ...then the zombie takes this long to climb out
const HOLE_STAYS_MS = 1500;    // the empty hole stays this long before filling in...
const HOLE_FADE_MS = 10000;    // ...then its ring of dug-up dirt fades away over this long
const HOLE_MIN_DISTANCE = 230; // holes never open closer than this to a jeep
const TURRET_RANGE = 380;      // the gun only shoots zombies this close (pixels)
const TURRET_TURN = 7;         // how fast the gun swings round (radians per second)
const TURRET_FIRE_MS = 650;    // time between shots
const SHOT_SPEED = 700;        // bullet speed (pixels per second)
const SHOT_RADIUS = 6;

// Areas: fields side by side. Every NEW_AREA_EVERY waves the trees on the
// right of the last field part, opening a path to a new field.
const NEW_AREA_EVERY = 5;
const GAP_HALF = 130;          // the path through the trees is twice this tall
const CAMERA_FOLLOW = 6;        // how quickly the view catches up with the jeeps

export default class ZombieGame {
  constructor(world, ui, { onBack, onRestart }) {
    this.world = world;
    this.ui = ui;
    this.onRestart = onRestart;
    const { W, H } = world;
    this.root = new BABYLON.TransformNode('zombie-game', world.scene);
    this.mats = makeMaterials(world.scene);

    // Softer daylight than space (bright colours wash out otherwise).
    this.sun = world.scene.getLightByName('sun');
    this.sky = world.scene.getLightByName('sky');
    this.oldLight = [this.sun.intensity, this.sky.intensity];
    this.sun.intensity = 0.75;
    this.sky.intensity = 0.55;

    this.areas = [];     // fields side by side; field k starts k screens to the right
    this.arrows = [];
    this.buildArea(0);

    // Jeep 1 starts in the middle, pointing up. Jeep 2 joins with the button.
    this.jeeps = [this.makeJeep(W / 2, H / 2, 'green')];
    this.makeStick(this.jeeps[0], '#2ecc71');
    this.shots = [];

    this.zombies = [];   // zombies out of the ground, chasing
    this.diggers = [];   // zombies still climbing out of their holes
    this.holes = [];     // empty holes waiting to fill in
    this.potions = [];   // bottles waiting to be picked up
    this.started = performance.now();
    this.wave = 1;
    this.waveStarted = this.started;
    this.nextZombieAt = this.started + FIRST_ZOMBIE_MS;
    this.nextPotionAt = this.started + between(...POTION_EVERY_MS);
    this.over = false;

    // At the top: which wave it is, and seconds left in this wave.
    this.clock = el('div', 'zombie-clock');
    this.clock.style.left = `${W / 2}px`;
    ui.append(this.clock);
    this.showWaveBanner();

    // The wave track plays now, at the start, and again after each boss
    // (just before the next wave). No new zombies come out while it plays;
    // zombies already out keep chasing.
    this.phase = 'fight';
    this.music = sound.play('wave');
    this.quietUntil = this.started + sound.duration('wave') * 1000;

    // Boss health bar (hidden until a boss comes out).
    this.bossBar = el('div', 'boss-bar');
    this.bossBar.style.left = `${W / 2}px`;
    this.bossBar.append(el('div'));
    this.bossBar.style.display = 'none';
    ui.append(this.bossBar);

    button(ui, 70, 40, '◀ Back', onBack, { width: 110, height: 52, fontSize: 22 });
    this.joinButton = button(ui, W - 90, 40, '+ Jeep 2', () => this.joinSecondJeep(),
      { width: 150, height: 52, fontSize: 24, color: '#d9822b' });

    this.setUpTouch();
    this.stopFrames = world.onFrame((now, dt) => this.update(now, dt));
    window.game = this; // for testing from the browser console
  }

  destroy() {
    this.destroyed = true;
    this.stopFrames();
    this.stopTouch();
    this.music.stop();
    clearTimeout(this.timer);
    [this.sun.intensity, this.sky.intensity] = this.oldLight;
    this.root.dispose(false, false);
    for (const m of Object.values(this.mats)) m.dispose();
    for (const a of this.areas) {
      a.grassMat.opacityTexture.dispose();
      a.grassMat.dispose();
      a.shadeMat.dispose(false, true);
      a.tracks.material.dispose(true, true);
    }
    this.grassTexture.dispose();
    this.sandTexture.dispose();
    for (const m of this.treeMats) m.dispose();
    this.world.originX = 0;
    this.world.cameraX = 0;
    this.world.camera.position.x = 0;
    this.ui.innerHTML = '';
  }

  // ---------- Jeeps ----------

  makeJeep(x, y, paint) {
    return {
      x, y,
      heading: 0,          // which way it points (0 = up the screen)
      speed: 0,
      stick: null,         // joystick push, x and y from -1 to 1 (null = not touching)
      pointerId: null,     // which finger is on its joystick
      turretAim: 0,        // which way its gun points on screen
      lastShot: 0,
      out: false,          // caught by a zombie
      safeUntil: 0,
      boost: { speed: 0, rapid: 0, shield: 0 }, // when each power-up runs out
      model: makeJeep(this, paint),
    };
  }

  hasBoost(j, kind, now) {
    return now < j.boost[kind];
  }

  // Player 2 joins: an orange jeep appears, away from the zombies,
  // and can't be caught for a moment while they get ready.
  joinSecondJeep() {
    if (this.jeeps.length > 1 || this.over) return;
    const safest = this.safeSpot();
    const jeep = this.makeJeep(safest.x, safest.y, 'orange');
    jeep.safeUntil = performance.now() + JOIN_SAFE_MS;
    this.jeeps.push(jeep);
    this.makeStick(jeep, '#ff9a3c');
    this.joinButton.remove();
    this.world.burst(jeep.x, jeep.y, { count: 10, color: '#ffb347', size: [6, 12], dist: [40, 90], ms: 450 });
  }

  // The spot on the screen furthest from any zombie (for a jeep to appear).
  safeSpot() {
    const { W, H } = this.world;
    const c = this.world.cameraX;
    const spots = [[c + W / 2, H * 0.8], [c + W / 2, H * 0.2], [c + W * 0.25, H / 2], [c + W * 0.75, H / 2]];
    // (Not on top of a jeep that's already there.)
    const free = spots.filter(([x, y]) => this.liveJeeps().every((j) => Math.hypot(j.x - x, j.y - y) > 200));
    const safest = (free.length ? free : spots).reduce((best, spot) =>
      (this.closestZombieDistance(spot) > this.closestZombieDistance(best) ? spot : best));
    const spot = { x: safest[0], y: safest[1] };
    this.keepInFields(spot, JEEP_RADIUS); // (not in the trees between two fields)
    return spot;
  }

  closestZombieDistance([x, y]) {
    let best = Infinity;
    for (const z of [...this.zombies, ...this.diggers]) best = Math.min(best, Math.hypot(z.x - x, z.y - y));
    return best;
  }

  liveJeeps() {
    return this.jeeps.filter((j) => !j.out);
  }

  // The closest jeep that's still going (or null).
  closestJeep(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const j of this.liveJeeps()) {
      const d = Math.hypot(j.x - x, j.y - y);
      if (d < bestD) { bestD = d; best = j; }
    }
    return best;
  }

  // ---------- Joysticks: push to drive, let go to stop ----------

  // Jeep j's joystick (hidden until a finger goes down for it).
  makeStick(j, color) {
    const base = el('div', 'stick');
    Object.assign(base.style, { width: `${STICK_RADIUS * 2}px`, height: `${STICK_RADIUS * 2}px`, borderColor: color, display: 'none' });
    const knob = el('div', 'stick-knob');
    knob.style.background = color;
    base.append(knob);
    this.ui.append(base);
    j.stickEl = base;
    j.knob = knob;
  }

  // The finger on jeep j's stick is at p: work out the push (0 in the
  // middle, 1 at the rim) and move the knob there.
  pushStick(j, p) {
    let x = (p.x - j.stickAt.x) / STICK_RADIUS;
    let y = (p.y - j.stickAt.y) / STICK_RADIUS;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    j.stick = { x, y };
    j.knob.style.transform = `translate(calc(-50% + ${x * STICK_RADIUS}px), calc(-50% + ${y * STICK_RADIUS}px))`;
  }

  letGoStick(j) {
    j.stick = null;
    j.pointerId = null;
    if (j.knob) {
      j.knob.style.transform = 'translate(-50%, -50%)';
      j.stickEl.style.display = 'none';
    }
  }

  // A finger going down puts a joystick right there. With two jeeps, the
  // left half of the screen is jeep 1's and the right half is jeep 2's
  // (if that jeep is caught or already driven, the other free one takes it).
  setUpTouch() {
    const { W, H } = this.world;
    const stage = document.getElementById('stage');
    const toScreen = (e) => {
      const r = stage.getBoundingClientRect();
      return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
    };
    const down = (e) => {
      const p = toScreen(e);
      const free = this.liveJeeps().filter((j) => j.stickEl && j.pointerId === null);
      if (!free.length) return;
      const mine = this.jeeps[p.x < W / 2 ? 0 : 1];
      const j = free.includes(mine) ? mine : free[0];
      j.pointerId = e.pointerId;
      j.stickAt = p;
      Object.assign(j.stickEl.style, { left: `${p.x}px`, top: `${p.y}px`, display: '' });
      this.pushStick(j, p);
    };
    const move = (e) => {
      const j = this.jeeps.find((jj) => jj.pointerId === e.pointerId);
      if (j) this.pushStick(j, toScreen(e));
    };
    const up = (e) => {
      const j = this.jeeps.find((jj) => jj.pointerId === e.pointerId);
      if (j) this.letGoStick(j);
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
    if (this.over) return;
    const s = dt / 1000;
    for (const a of this.areas) a.tracks.update(now);
    // How a wave goes:
    //   'fight' - 30 seconds of zombies.
    //   'boss'  - time's up: a big boss zombie digs out. Zombies keep coming.
    //             The wave doesn't end until the boss is knocked out.
    //   'break' - boss down: the wave track plays (no new zombies), then
    //             the next wave starts.
    const msLeft = WAVE_MS - (now - this.waveStarted);
    if (this.phase === 'fight' && msLeft <= 0) {
      this.phase = 'boss';
      this.spawnZombie(now, 'boss');
    } else if (this.phase === 'break' && now >= this.breakEnds) {
      this.phase = 'fight';
      this.wave += 1;
      this.waveStarted = now;
      this.showWaveBanner();
      if (this.wave % NEW_AREA_EVERY === 0) this.openNewArea(now);
    }

    for (const j of this.liveJeeps()) {
      this.driveJeep(j, s, now);
      this.aimTurret(j, now, s);
      // Blink while safe after joining.
      setVisibility(j.model, now < j.safeUntil && Math.floor(now / 125) % 2 ? 0.35 : 1);
      j.model.shield.setEnabled(this.hasBoost(j, 'shield', now));
    }
    for (const j of this.jeeps) if (j.stickEl) j.stickEl.style.opacity = j.out ? '0.3' : '';
    this.followCamera(s);
    this.moveShots(s, now);
    this.updatePotions(now);

    // New zombies (quicker each wave), but none while the wave track plays.
    if (now >= this.nextZombieAt && now >= this.quietUntil) {
      this.spawnZombie(now);
      const every = Math.max(SPAWN_FASTEST_MS, SPAWN_EVERY_MS * Math.pow(SPAWN_QUICKER, this.wave - 1));
      this.nextZombieAt = now + every;
    }
    this.updateDiggers(now);

    // Move zombies: each one turns toward the closest jeep and shuffles after it.
    for (const z of this.zombies) {
      const j = this.closestJeep(z.x, z.y);
      if (j) {
        const want = Math.atan2(j.x - z.x, -(j.y - z.y)); // direction to the jeep
        let diff = want - z.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest way round
        z.heading += Math.max(-z.turn * s, Math.min(z.turn * s, diff));
      }
      // Fast zombies keep getting faster as the waves go up.
      if (z.kind === 'fast') z.speed = fastSpeed(this.wave);
      // Stop flashing after being hit.
      if (z.flashUntil && now > z.flashUntil) {
        z.flashUntil = 0;
        setVisibility(z.model, 1);
      }
      z.x += Math.sin(z.heading) * z.speed * s;
      z.y -= Math.cos(z.heading) * z.speed * s;
      this.keepInFields(z, z.r); // zombies come through the paths too, not the trees
    }
    this.spreadZombies();
    for (const z of this.zombies) {
      z.step += s * (2 + z.speed / 12); // quicker zombies take quicker steps
      z.model.rotation.y = z.heading;
      placeZombie(this, z);
      for (const j of this.liveJeeps()) {
        if (now < j.safeUntil || this.hasBoost(j, 'shield', now)) continue;
        if (Math.hypot(z.x - j.x, z.y - j.y) < (JEEP_RADIUS + z.r) * 0.85) {
          this.crash(j, z, now);
          if (this.over) return;
        }
      }
    }

    let text = `Wave ${this.wave} · ${Math.max(0, Math.ceil(msLeft / 1000))}`;
    if (this.phase === 'boss') text = `Wave ${this.wave} · BOSS!`;
    if (this.phase === 'break') text = `Wave ${this.wave} ✓`;
    if (this.clock.textContent !== text) this.clock.textContent = text;
    this.drawBossBar();
  }

  // The boss's health bar under the wave counter (only while a boss is out).
  drawBossBar() {
    const boss = this.zombies.find((z) => z.kind === 'boss');
    this.bossBar.style.display = boss ? '' : 'none';
    if (boss) this.bossBar.firstChild.style.width = `${Math.round(100 * boss.hits / boss.maxHits)}%`;
  }

  // The boss is down: cheer, play the wave track, then the next wave.
  bossDefeated(boss, now) {
    this.world.burst(boss.x, boss.y, { count: 24, color: '#7bd44a', size: [10, 24], dist: [60, 200], ms: 800 });
    this.world.burst(boss.x, boss.y, { count: 12, color: '#ffd84d', size: [8, 16], dist: [40, 140], ms: 650 });
    this.world.shake(400, 14);
    this.popText(boss.x, boss.y - 40, 'Boss down!', '#ffd84d');
    // A jeep that got caught comes back: its partner made it through the wave.
    this.bringBackJeeps(now);
    this.phase = 'break';
    const trackMs = sound.duration('wave') * 1000;
    this.breakEnds = now + trackMs;
    this.quietUntil = now + trackMs;
    this.music.stop();
    this.music = sound.play('wave');
  }

  // Every caught jeep comes back (somewhere safe on screen, blinking for a moment).
  bringBackJeeps(now) {
    for (const j of this.jeeps) {
      if (!j.out) continue;
      const spot = this.safeSpot();
      this.letGoStick(j);
      Object.assign(j, {
        x: spot.x, y: spot.y, out: false, speed: 0,
        lastWheels: null, safeUntil: now + JOIN_SAFE_MS, boost: { speed: 0, rapid: 0, shield: 0 },
      });
      j.model.setEnabled(true);
      j.model.position.copyFrom(this.world.at(j.x, j.y, 0));
      this.world.burst(j.x, j.y, { count: 12, color: '#ffd84d', size: [6, 12], dist: [40, 100], ms: 500 });
      this.popText(j.x, j.y - 50, 'Back!', '#ffd84d');
    }
  }

  // Big "Wave 2!" across the middle when a new wave starts.
  showWaveBanner() {
    const { W, H } = this.world;
    const banner = el('div', 'wave-banner');
    banner.textContent = `Wave ${this.wave}!`;
    banner.style.left = `${W / 2}px`;
    banner.style.top = `${H / 2}px`;
    this.ui.append(banner);
    setTimeout(() => banner.remove(), 1800);
  }

  // A little word that floats up from (x, y), e.g. "Speed!".
  popText(x, y, text, color) {
    const t = el('div', 'plus');
    t.textContent = text;
    Object.assign(t.style, { left: `${x - this.world.cameraX}px`, top: `${y}px`, color, fontSize: '40px' });
    t.style.setProperty('--rise', '-70px');
    this.ui.append(t);
    setTimeout(() => t.remove(), 900);
  }

  driveJeep(j, s, now) {
    const { W, H } = this.world;
    const push = j.stick ? Math.hypot(j.stick.x, j.stick.y) : 0;
    if (push > STICK_DEAD) {
      // Turn the way the stick points (heading 0 = up the screen, turning clockwise).
      const want = Math.atan2(j.stick.x, -j.stick.y);
      let diff = want - j.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest way round
      j.heading += Math.max(-JEEP_TURN * s, Math.min(JEEP_TURN * s, diff));
      // The further the push, the faster.
      const top = JEEP_TOP_SPEED * (this.hasBoost(j, 'speed', now) ? SPEED_BOOST : 1);
      const wantSpeed = top * Math.min(1, (push - STICK_DEAD) / (0.8 - STICK_DEAD));
      j.speed += Math.max(-JEEP_BRAKE * s, Math.min(900 * s, wantSpeed - j.speed));
    } else {
      // Stick let go (or in the middle): stop.
      j.speed = Math.max(0, j.speed - JEEP_BRAKE * s);
    }

    j.x += Math.sin(j.heading) * j.speed * s;
    j.y -= Math.cos(j.heading) * j.speed * s;
    this.keepInFields(j, JEEP_RADIUS);
    // Both jeeps have to fit on the screen: a jeep can't get further from
    // the other one than the screen is wide (it's held back at the edge).
    const other = this.liveJeeps().find((o) => o !== j);
    if (other) {
      const reach = W - 2 * JEEP_RADIUS - 20;
      j.x = Math.max(other.x - reach, Math.min(other.x + reach, j.x));
    }

    j.model.position.copyFrom(this.world.at(j.x, j.y, 0));
    j.model.rotation.y = j.heading;
    this.leaveTracks(j);
    // Wheels spin with speed.
    for (const w of j.model.wheels) w.rotation.x += j.speed * s / 12;
  }

  // Tyre tracks from the two back wheels while the jeep is moving.
  leaveTracks(j) {
    if (j.speed < 15) {
      j.lastWheels = null;
      return;
    }
    const fx = Math.sin(j.heading);   // forward, in field pixels
    const fy = -Math.cos(j.heading);
    const sx = -fy;                    // sideways
    const sy = fx;
    const wheels = [-1, 1].map((side) => [
      j.x - fx * REAR_AXLE + sx * side * WHEEL_GAP,
      j.y - fy * REAR_AXLE + sy * side * WHEEL_GAP,
    ]);
    if (j.lastWheels) {
      wheels.forEach(([x, y], i) => this.markTracks(j.lastWheels[i][0], j.lastWheels[i][1], x, y));
    }
    j.lastWheels = wheels;
  }

  // ---------- Areas ----------

  // A field: dirt, grass round the edge and trees all round, sitting at
  // its own spot in the 3D world (field k is k screens to the right).
  // Every field after the first starts with an open path on its left.
  buildArea(k) {
    const { W, H, scene } = this.world;
    const node = new BABYLON.TransformNode('area' + k, scene);
    node.parent = this.root;
    node.position.x = k * W;
    const area = { k, node, gaps: { left: k > 0, right: false }, trees: [] };
    makeGround(this, area, W, H);
    makeEdgeShade(this, area, W, H);
    area.tracks = makeTracks(this, area, W, H);
    makeBorderTrees(this, area, W, H);
    this.areas.push(area);
    return area;
  }

  // Wave 5, 10, ...: a new field appears to the right of the last one,
  // and the trees on that side part to open a path to it.
  openNewArea(now) {
    const last = this.areas[this.areas.length - 1];
    this.buildArea(last.k + 1);
    last.gaps.right = true;
    redrawGrass(this, last);
    // The trees in the way shrink away in a puff of leaves, one after another.
    const { W, H } = this.world;
    const inWay = last.trees.filter((t) => t.x > W - 150 && Math.abs(t.y - H / 2) < GAP_HALF + 30);
    inWay.sort((a, b) => b.x - a.x);
    inWay.forEach((t, i) => {
      last.trees.splice(last.trees.indexOf(t), 1);
      const size = t.node.scaling.x;
      setTimeout(() => {
        if (this.destroyed) return;
        this.world.burst(last.k * W + t.x, t.y, { count: 8, color: pick(TREE_GREENS), size: [8, 16], dist: [30, 80], ms: 500, h: 40 });
        this.world.animate(500, (p) => t.node.scaling.setAll(size * (1 - p)), () => t.node.dispose());
      }, 200 + i * 120);
    });
    setTimeout(() => {
      if (this.destroyed) return;
      const msg = el('div', 'wave-banner');
      msg.textContent = 'New path! ➜';
      msg.style.left = `${this.world.W / 2}px`;
      msg.style.top = `${this.world.H / 2 + 120}px`;
      msg.style.fontSize = '72px';
      this.ui.append(msg);
      setTimeout(() => msg.remove(), 1800);
    }, 900);
    this.makeArrows();
  }

  // Keep something (a jeep or zombie, r = its size) out of the trees: inside
  // its field, or in an open path between two fields.
  keepInFields(p, r) {
    const { W, H } = this.world;
    const k = Math.max(0, Math.min(this.areas.length - 1, Math.floor(p.x / W)));
    const area = this.areas[k];
    const left = k * W;
    const pathHalf = GAP_HALF - r;
    const inPath = Math.abs(p.y - H / 2) <= pathHalf;
    const minX = area.gaps.left && inPath ? left - W : left + r;
    const maxX = area.gaps.right && inPath ? left + 2 * W : left + W - r;
    p.x = Math.max(minX, Math.min(maxX, p.x));
    const across = p.x - left;
    if (across < r || across > W - r) {
      p.y = Math.max(H / 2 - pathHalf, Math.min(H / 2 + pathHalf, p.y)); // going through a path
    } else {
      p.y = Math.max(r, Math.min(H - r, p.y));
    }
  }

  // A random spot across the screen that's inside a field (not in the
  // trees between two fields), at least `margin` from a field's edge.
  spotOnScreen(margin) {
    const { W } = this.world;
    const cam = this.world.cameraX;
    for (let tries = 0; tries < 20; tries++) {
      const x = cam + between(margin, W - margin);
      const across = x - Math.floor(x / W) * W;
      if (across > margin && across < W - margin) return x;
    }
    const k = Math.min(this.areas.length - 1, Math.round(cam / W));
    return k * W + W / 2;
  }

  // The view follows the jeeps (the middle of them, with two), but never
  // past the end fields, and never leaving a jeep off the screen.
  followCamera(s) {
    const { W } = this.world;
    const live = this.liveJeeps();
    if (!live.length) return;
    const last = this.areas.length * W - W;
    const middle = live.reduce((sum, j) => sum + j.x, 0) / live.length;
    const want = Math.max(0, Math.min(last, middle - W / 2));
    let cam = this.world.cameraX + (want - this.world.cameraX) * Math.min(1, s * CAMERA_FOLLOW);
    for (const j of live) cam = Math.max(j.x + JEEP_RADIUS - W, Math.min(j.x - JEEP_RADIUS, cam));
    cam = Math.max(0, Math.min(last, cam));
    this.world.cameraX = cam;
    this.world.camera.position.x = cam;
    for (const a of this.arrows) {
      const x = a.x - cam;
      a.el.style.left = `${x}px`;
      a.el.style.display = x < -80 || x > W + 80 ? 'none' : '';
    }
  }

  // Tyre marks go on the field they're in.
  markTracks(x1, y1, x2, y2) {
    const { W } = this.world;
    const k = Math.max(0, Math.min(this.areas.length - 1, Math.floor((x1 + x2) / 2 / W)));
    this.areas[k].tracks.mark(x1 - k * W, y1, x2 - k * W, y2);
  }

  // Bouncing arrows at every open path (moved with the view each frame).
  makeArrows() {
    for (const a of this.arrows) a.el.remove();
    this.arrows = [];
    const { W, H } = this.world;
    for (const area of this.areas) {
      for (const side of ['left', 'right']) {
        if (!area.gaps[side]) continue;
        const arrow = el('div', 'path-arrow ' + side);
        arrow.textContent = side === 'right' ? '➜' : '⬅';
        arrow.style.top = `${H / 2}px`;
        this.ui.append(arrow);
        this.arrows.push({ el: arrow, x: area.k * W + (side === 'right' ? W - 55 : 55) });
      }
    }
  }

  // ---------- Zombies ----------

  // A new zombie digs its way out somewhere on the field (never right next
  // to a jeep): first a hole opens, then the zombie climbs out of it.
  // It can't move, hurt a jeep or be shot until it's all the way out.
  // kind = 'boss' for the big one at the end of a wave; otherwise picked at random.
  spawnZombie(now, kind = null) {
    const { W, H } = this.world;
    const boss = kind === 'boss';
    let x;
    let y;
    for (let tries = 0; tries < 30; tries++) {
      x = this.spotOnScreen(boss ? 120 : 60);
      y = between(boss ? 180 : 120, H - (boss ? 120 : 60));
      const j = this.closestJeep(x, y);
      if (!j || Math.hypot(x - j.x, y - j.y) > HOLE_MIN_DISTANCE * (boss ? 1.4 : 1)) break;
    }
    const j = this.closestJeep(x, y) || { x: W / 2, y: H / 2 };
    if (!kind) {
      const fastChance = Math.min(FAST_CHANCE_MAX, FAST_CHANCE + FAST_CHANCE_PER_WAVE * (this.wave - 1));
      kind = Math.random() < fastChance ? 'fast' : 'slow';
    }
    const hits = {
      fast: 1,
      slow: Math.min(SLOW_MAX_HITS, this.wave),
      boss: BOSS_HITS + BOSS_HITS_PER_WAVE * (this.wave - 1),
    }[kind];
    const z = {
      x,
      y,
      kind,
      r: boss ? ZOMBIE_RADIUS * BOSS_SIZE : ZOMBIE_RADIUS,
      heading: Math.atan2(j.x - x, -(j.y - y)), // already looking at the jeep
      speed: { fast: fastSpeed(this.wave), slow: between(...SLOW_SPEED), boss: BOSS_SPEED }[kind],
      turn: { fast: FAST_TURN, slow: SLOW_TURN, boss: BOSS_TURN }[kind],
      hits,                        // hits it takes to knock out
      maxHits: hits,
      step: Math.random() * 10,    // where it is in its shuffle
      born: now,
      size: boss ? BOSS_SIZE : 1,  // how big its hole is
      model: makeZombie(this, kind),
      hole: makeHole(this, x, y),
    };
    z.model.rotation.y = z.heading;
    z.model.setEnabled(false); // still underground
    this.diggers.push(z);
    return z;
  }

  // Holes opening and zombies climbing out of them.
  updateDiggers(now) {
    for (const z of this.diggers) {
      const age = now - z.born;
      if (age < HOLE_MS) {
        // The hole opens up.
        const t = age / HOLE_MS;
        z.hole.scaling.set(t * z.size, 1, t * z.size);
        if (Math.random() < 0.3 * z.size) this.world.burst(z.x, z.y, { count: 1, color: '#8a6a44', size: [4, 8], dist: [20 * z.size, 40 * z.size], ms: 300, h: 0 });
      } else if (age < HOLE_MS + CLIMB_MS) {
        // The zombie rises out of it.
        z.hole.scaling.set(z.size, 1, z.size);
        z.model.setEnabled(true);
        const t = (age - HOLE_MS) / CLIMB_MS;
        placeZombie(this, z);
        z.model.position.y = -10 - (1 - t) * 110 * z.size;
        z.model.rotation.z = Math.sin(age / 60) * 0.12 * (1 - t);
      } else {
        // All the way out: it joins the chase.
        z.model.setEnabled(true); // (in case a slow frame skipped the climb)
        placeZombie(this, z);
        z.model.rotation.z = 0;
        z.model.walk();
        z.out = true;
        this.world.burst(z.x, z.y, { count: 6 * z.size, color: '#8a6a44', size: [6, 12], dist: [30 * z.size, 60 * z.size], ms: 350, h: 0 });
        if (z.kind === 'boss') this.world.shake(300, 8);
        this.holes.push({ node: z.hole, pit: z.hole.pit, closeAt: now + HOLE_STAYS_MS });
        delete z.hole;
        this.zombies.push(z);
      }
    }
    this.diggers = this.diggers.filter((z) => !z.out);

    // Empty holes stay a little while, then fill in. Then the pile of dug-up
    // dirt round the edge slowly fades back into the ground.
    for (const h of this.holes) {
      if (now < h.closeAt) continue;
      const t = (now - h.closeAt) / 500;
      if (!h.filled) {
        if (t >= 1) {
          h.pit.dispose();
          h.filled = now;
        } else {
          h.pit.scaling.set(1 - t, 1, 1 - t);
        }
        continue;
      }
      const fade = (now - h.filled) / HOLE_FADE_MS;
      if (fade >= 1) {
        h.node.dispose();
        h.gone = true;
      } else {
        for (const m of h.node.getChildMeshes()) m.visibility = 1 - fade;
      }
    }
    this.holes = this.holes.filter((h) => !h.gone);
  }

  // Zombies push each other apart so they don't all pile into one blob.
  spreadZombies() {
    for (let i = 0; i < this.zombies.length; i++) {
      for (let k = i + 1; k < this.zombies.length; k++) {
        const a = this.zombies[i];
        const b = this.zombies[k];
        const gap = a.r + b.r;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d >= gap || d === 0) continue;
        const push = (gap - d) / 2;
        a.x += (dx / d) * push; a.y += (dy / d) * push;
        b.x -= (dx / d) * push; b.y -= (dy / d) * push;
      }
    }
  }

  // ---------- The gun turrets ----------

  // Swing a jeep's gun toward the closest zombie in range, and fire when lined up.
  aimTurret(j, now, s) {
    let target = null;
    let best = TURRET_RANGE;
    for (const z of this.zombies) {
      const d = Math.hypot(z.x - j.x, z.y - j.y);
      if (d < best) { best = d; target = z; }
    }
    if (target) {
      const want = Math.atan2(target.x - j.x, -(target.y - j.y));
      let diff = want - j.turretAim;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      j.turretAim += Math.max(-TURRET_TURN * s, Math.min(TURRET_TURN * s, diff));
      const fireEvery = this.hasBoost(j, 'rapid', now) ? RAPID_FIRE_MS : TURRET_FIRE_MS;
      if (Math.abs(diff) < 0.12 && now - j.lastShot > fireEvery) {
        this.fire(j);
        j.lastShot = now;
      }
    }
    // The gun sits on the jeep, so its turn is measured from the jeep's heading.
    j.model.turret.rotation.y = j.turretAim - j.heading;
  }

  fire(j) {
    const dx = Math.sin(j.turretAim);
    const dy = -Math.cos(j.turretAim);
    const x = j.x + dx * 44; // from the end of the barrel
    const y = j.y + dy * 44;
    const mesh = BABYLON.MeshBuilder.CreateSphere('shot', { diameter: SHOT_RADIUS * 2, segments: 6 }, this.world.scene);
    mesh.material = glowMaterial(this.world.scene, '#ffd84d');
    mesh.parent = this.root;
    const shot = { x, y, vx: dx * SHOT_SPEED, vy: dy * SHOT_SPEED, mesh };
    mesh.position.copyFrom(this.world.at(x, y, 50));
    this.shots.push(shot);
    this.world.burst(x, y, { count: 4, color: '#ffb347', size: [5, 9], dist: [10, 25], ms: 120, h: 50 });
  }

  // Bullets fly straight. Each hit takes one off a zombie's hits; at 0 it's knocked out.
  moveShots(s, now) {
    const { W, H } = this.world;
    for (const shot of this.shots) {
      shot.x += shot.vx * s;
      shot.y += shot.vy * s;
      shot.mesh.position.copyFrom(this.world.at(shot.x, shot.y, 50));
      const hit = this.zombies.find((z) => Math.hypot(z.x - shot.x, z.y - shot.y) < z.r + SHOT_RADIUS);
      if (hit) {
        shot.gone = true;
        hit.hits -= 1;
        if (hit.hits <= 0) {
          this.knockOut(hit);
          if (hit.kind === 'boss') this.bossDefeated(hit, now);
        } else {
          // Still standing: flash, get knocked back a little (the boss doesn't budge).
          hit.flashUntil = now + 90;
          setVisibility(hit.model, 0.4);
          if (hit.kind !== 'boss') {
            hit.x += shot.vx * 0.02;
            hit.y += shot.vy * 0.02;
          }
          this.world.burst(hit.x, hit.y, { count: 3, color: '#7bd44a', size: [4, 8], dist: [15, 35], ms: 200 });
        }
      } else if (shot.x < this.world.cameraX - 50 || shot.x > this.world.cameraX + W + 50 || shot.y < -50 || shot.y > H + 50) {
        shot.gone = true;
      }
    }
    for (const shot of this.shots) if (shot.gone) shot.mesh.dispose();
    this.shots = this.shots.filter((shot) => !shot.gone);
  }

  knockOut(z) {
    this.world.burst(z.x, z.y, { count: 10, color: '#7bd44a', size: [6, 14], dist: [30, 80], ms: 450 });
    z.model.dispose();
    this.zombies = this.zombies.filter((other) => other !== z);
  }

  // ---------- Potions ----------

  // Bottles pop up now and then (away from the jeeps), bob and sparkle,
  // and vanish after a while. Drive over one to grab its power-up.
  updatePotions(now) {
    const { W, H } = this.world;
    if (now >= this.nextPotionAt) {
      this.nextPotionAt = now + between(...POTION_EVERY_MS);
      this.spawnPotion(pick(Object.keys(POTIONS)), now);
    }
    // While a jeep is caught, a rescue potion pops up (a new one if it vanishes).
    const someoneCaught = this.jeeps.some((j) => j.out);
    const rescueOut = this.potions.some((p) => p.kind === 'rescue');
    if (!someoneCaught) {
      this.nextRescueAt = 0;
      for (const p of this.potions) if (p.kind === 'rescue') p.gone = true; // nobody needs it now
    } else if (!rescueOut) {
      if (!this.nextRescueAt) this.nextRescueAt = now + RESCUE_AFTER_MS;
      else if (now >= this.nextRescueAt) {
        this.nextRescueAt = 0;
        this.spawnPotion('rescue', now);
      }
    }

    for (const p of this.potions) {
      const age = now - p.born;
      // Bob up and down and slowly turn, so it catches the eye.
      p.model.position.copyFrom(this.world.at(p.x, p.y, 20 + Math.sin(age / 200) * 8));
      p.model.rotation.y = age / 500;
      // Blink in its last 2 seconds, then vanish.
      const blinking = age > p.lasts - 2000;
      setVisibility(p.model, blinking && Math.floor(age / 150) % 2 ? 0.25 : 1);
      if (age > p.lasts) p.gone = true;

      const j = this.liveJeeps().find((jj) => Math.hypot(jj.x - p.x, jj.y - p.y) < JEEP_RADIUS + 26);
      if (j && !p.gone) {
        p.gone = true;
        if (p.kind === 'rescue') this.bringBackJeeps(now);
        else j.boost[p.kind] = now + BOOST_MS;
        const { color, label } = p.kind === 'rescue' ? RESCUE : POTIONS[p.kind];
        this.world.burst(p.x, p.y, { count: 14, color, size: [6, 12], dist: [40, 100], ms: 500, h: 30 });
        this.popText(p.x, p.y - 30, label, color);
      }
    }
    for (const p of this.potions) if (p.gone) p.model.dispose();
    this.potions = this.potions.filter((p) => !p.gone);
  }

  // A bottle pops up on the screen, away from the jeeps.
  spawnPotion(kind, now) {
    const { H } = this.world;
    const color = kind === 'rescue' ? RESCUE.color : POTIONS[kind].color;
    let x;
    let y;
    for (let tries = 0; tries < 20; tries++) {
      x = this.spotOnScreen(80);
      y = between(140, H - 80);
      const j = this.closestJeep(x, y);
      if (!j || Math.hypot(x - j.x, y - j.y) > 200) break;
    }
    const model = makePotion(this, color);
    if (kind === 'rescue') model.scaling.scaleInPlace(1.35); // a bit bigger, easy to spot
    const lasts = kind === 'rescue' ? RESCUE_LASTS_MS : POTION_LASTS_MS;
    this.potions.push({ kind, x, y, born: now, model, lasts });
    this.world.burst(x, y, { count: 8, color, size: [5, 10], dist: [30, 60], ms: 400, h: 20 });
  }

  // ---------- Getting caught ----------

  // A zombie got jeep j. It's out; when no jeeps are left, the game is over.
  crash(j, zombie, now) {
    j.out = true;
    this.letGoStick(j);
    this.world.burst((j.x + zombie.x) / 2, (j.y + zombie.y) / 2, { count: 14, color: '#7bd44a', size: [8, 18], dist: [50, 140], ms: 650 });
    this.world.burst(j.x, j.y, { count: 8, color: '#ffd84d', size: [8, 14], dist: [30, 100], ms: 500 });
    this.world.shake(350, 12);
    j.model.setEnabled(false);
    if (this.liveJeeps().length > 0) return; // the other jeep keeps going

    this.over = true;
    this.joinButton.remove();
    this.timer = setTimeout(() => this.showGameOver(), 700);
  }

  showGameOver() {
    if (this.destroyed) return;
    const { W, H } = this.world;
    const box = el('div', 'winner');
    box.style.top = `${H / 2 - 70}px`;
    const title = el('div', 'winner-title');
    title.textContent = this.jeeps.length > 1 ? 'Zombies got you!' : 'Zombie got you!';
    title.style.color = '#ff4d3c';
    const sub = el('div', 'winner-sub');
    sub.textContent = `You made it to wave ${this.wave}`;
    box.append(title, sub);
    this.ui.append(box);
    button(this.ui, W / 2, H / 2 + 100, 'Play again', () => this.onRestart(),
      { width: 320, height: 90, fontSize: 44, color: '#2ecc71' });
  }
}

// ---------- The 3D pieces ----------

function makeMaterials(scene) {
  const m = (name, color, emissive = false) => {
    const mat = new BABYLON.StandardMaterial(name, scene);
    mat.diffuseColor = hex(color);
    mat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    if (emissive) mat.emissiveColor = hex(color);
    return mat;
  };
  return {
    grass: m('grass', '#4f8f3a'),
    dirt: m('dirt', '#9c7a50'),
    dugDirt: m('dugDirt', '#6e4f30'),
    tuft: m('tuft', '#3f7a2e'),
    darkTuft: m('darkTuft', '#2a5a22'),
    glass: m('glass', '#9fd4ff'),
    seat: m('seat', '#5a3b22'),
    gun: m('gun', '#6b6f78'),
    gunDark: m('gunDark', '#3a3d44'),
    shield: (() => {
      const s = m('shield', '#b46bff');
      s.emissiveColor = hex('#b46bff').scale(0.25);
      s.alpha = 0.35;
      return s;
    })(),
    hole: m('hole', '#2a1a0e'),
  };
}

// A grass texture drawn in code: soft lighter/darker patches, then thousands
// of little blades in different greens. It tiles seamlessly (anything drawn
// near an edge is drawn again on the opposite side).
const GRASS_TILE = 230; // one copy of the texture covers this many pixels of field

function makeGrassTexture(scene) {
  const S = 512;
  const tex = new BABYLON.DynamicTexture('grass', { width: S, height: S }, scene, true);
  const ctx = tex.getContext();
  const wrapped = (x, y, draw) => {
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) draw(x + dx, y + dy);
  };
  ctx.fillStyle = '#4c8a38';
  ctx.fillRect(0, 0, S, S);

  // Soft patches of lighter and darker grass.
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = between(40, 110);
    const light = Math.random() < 0.5;
    wrapped(x, y, (px, py) => {
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, light ? 'rgba(120, 170, 80, 0.35)' : 'rgba(40, 90, 35, 0.35)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }

  // Blades of grass.
  const blades = ['#3b7429', '#427e2f', '#4f9038', '#5a9c40', '#66a84a', '#78b252', '#86a948', '#35682a'];
  ctx.lineCap = 'round';
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const len = between(3, 9);
    const a = between(-Math.PI, Math.PI);
    ctx.strokeStyle = pick(blades);
    ctx.lineWidth = between(1, 2.2);
    wrapped(x, y, (px, py) => {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
      ctx.stroke();
    });
  }

  // A few tiny light flecks (little flowers / sunlit tips).
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    ctx.fillStyle = pick(['rgba(230, 240, 170, 0.7)', 'rgba(200, 230, 140, 0.6)', 'rgba(255, 255, 255, 0.45)']);
    wrapped(x, y, (px, py) => ctx.fillRect(px, py, 2, 2));
  }

  tex.update();
  tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
  tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
  return tex;
}

// The field: plain dirt in the middle, textured grass near the trees.
// Layers from the bottom up: dirt -> grass (fades out toward the middle,
// with a ragged edge) -> dark shade under the trees -> tyre tracks -> holes.
function makeGround(game, area, W, H) {
  const { scene } = game.world;
  // The sand and grass pictures are made once and shared by every field.
  if (!game.sandTexture) {
    const sand = makeSandTexture(scene);
    sand.uScale = (W + 60) / SAND_TILE;
    sand.vScale = (H + 60) / SAND_TILE;
    game.mats.dirt.diffuseTexture = sand;
    game.mats.dirt.diffuseColor = new BABYLON.Color3(1, 1, 1);
    game.sandTexture = sand;
    game.grassTexture = makeGrassTexture(scene);
    game.grassTexture.uScale = W / GRASS_TILE;
    game.grassTexture.vScale = H / GRASS_TILE;
  }
  // (A little bigger than the screen, so neighbouring fields overlap: no seam.)
  const dirt = BABYLON.MeshBuilder.CreateGround('dirtField', { width: W + 60, height: H + 60 }, scene);
  dirt.material = game.mats.dirt;
  dirt.position.y = -12 - area.k * 0.2; // (neighbours overlap a little: keep them from flickering)
  dirt.parent = area.node;

  // Grass layer: the grass texture repeats across it, and a second
  // "where is there grass" picture makes it fade out toward the middle.
  const mat = new BABYLON.StandardMaterial('grassLayer', scene);
  mat.diffuseTexture = game.grassTexture;
  mat.opacityTexture = makeGrassMask(scene, W, H, area.gaps);
  mat.specularColor = BABYLON.Color3.Black();
  const layer = BABYLON.MeshBuilder.CreateGround('grassLayer', { width: W, height: H }, scene);
  layer.material = mat;
  layer.position.y = -11;
  layer.alphaIndex = 1;
  layer.parent = area.node;
  area.grassMat = mat;
}

// A path just opened in this field: redraw its grass and shade with a dirt
// track through the gap.
function redrawGrass(game, area) {
  const { scene, W, H } = game.world;
  const oldMask = area.grassMat.opacityTexture;
  area.grassMat.opacityTexture = makeGrassMask(scene, W, H, area.gaps);
  oldMask.dispose();
  const oldShade = area.shadeMat.diffuseTexture;
  area.shadeMat.diffuseTexture = makeShadeTexture(scene, W, H, area.gaps);
  oldShade.dispose();
}

// Rub out the grass (or shade) where a path goes through the trees, with
// soft edges. S = picture size, depth = how far in from the side to rub out.
function cutPaths(ctx, S, W, H, gaps, depth) {
  const top = S * (H / 2 - GAP_HALF * 0.85) / H;
  const bottom = S * (H / 2 + GAP_HALF * 0.85) / H;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.25, 'rgba(0,0,0,1)');
  g.addColorStop(0.75, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  if (gaps.left) ctx.fillRect(0, top, depth, bottom - top);
  if (gaps.right) ctx.fillRect(S - depth, top, depth, bottom - top);
  ctx.restore();
}

// White where there's grass (the edges), see-through in the middle, with a
// ragged, natural-looking border between grass and dirt.
const GRASS_BAND = 120; // how far in from each edge the grass reaches (pixels)

function makeGrassMask(scene, W, H, gaps) {
  const S = 256;
  const bx = S * GRASS_BAND / W; // the strip's width in picture pixels, across...
  const by = S * GRASS_BAND / H; // ...and down
  const tex = new BABYLON.DynamicTexture('grassMask', { width: S, height: S }, scene, false);
  const ctx = tex.getContext();
  const sides = [
    [0, 0, 0, by], [0, S, 0, S - by],
    [0, 0, bx, 0], [S, 0, S - bx, 0],
  ];
  for (const [x0, y0, x1, y1] of sides) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }
  // Clumps of grass poking out into the dirt, so the border isn't a straight line.
  for (let i = 0; i < 70; i++) {
    const t = Math.random() * S;
    const side = Math.floor(Math.random() * 4);
    const d = between(0.45, 1) * (side < 2 ? bx : by);
    const x = side === 0 ? d : side === 1 ? S - d : t;
    const y = side === 2 ? d : side === 3 ? S - d : t;
    const r = between(4, 10);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  cutPaths(ctx, S, W, H, gaps, bx * 1.05);
  tex.hasAlpha = true;
  tex.update();
  return tex;
}

// Sand texture (tan yellow): lots of tiny granules and a few small
// pebbles, kept subtle. Tiles seamlessly like the grass.
const SAND_TILE = 340;

function makeSandTexture(scene) {
  const S = 512;
  const tex = new BABYLON.DynamicTexture('sand', { width: S, height: S }, scene, true);
  const ctx = tex.getContext();
  const wrapped = (x, y, draw) => {
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) draw(x + dx, y + dy);
  };
  ctx.fillStyle = '#d6b97c';
  ctx.fillRect(0, 0, S, S);
  // Very soft lighter / darker patches.
  for (let i = 0; i < 18; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = between(50, 120);
    const light = Math.random() < 0.5;
    wrapped(x, y, (px, py) => {
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, light ? 'rgba(240, 222, 170, 0.1)' : 'rgba(170, 135, 80, 0.08)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }
  // Sand granules.
  const grains = ['rgba(240,222,172,0.6)', 'rgba(176,142,88,0.5)', 'rgba(222,196,140,0.5)', 'rgba(150,118,72,0.4)', 'rgba(252,240,205,0.5)'];
  for (let i = 0; i < 16000; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const size = Math.random() < 0.85 ? 1 : 2;
    ctx.fillStyle = pick(grains);
    wrapped(x, y, (px, py) => ctx.fillRect(px, py, size, size));
  }
  // A few small pebbles with a light top and a dark edge.
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = between(1.5, 3.5);
    wrapped(x, y, (px, py) => {
      ctx.fillStyle = 'rgba(140, 108, 66, 0.5)';
      ctx.beginPath(); ctx.arc(px + 0.6, py + 0.6, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(232, 214, 170, 0.75)';
      ctx.beginPath(); ctx.arc(px, py, r * 0.8, 0, Math.PI * 2); ctx.fill();
    });
  }
  tex.update();
  tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
  tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
  return tex;
}

// Tyre tracks: the jeeps' back wheels leave dark marks in the dirt that
// slowly fade away. They're drawn on one see-through picture laid over
// the field (much cheaper than lots of little 3D pieces).
const TRACK_SCALE = 0.5;     // picture pixels per field pixel
const TRACK_FADE_EVERY = 100; // ms between fading steps
const TRACK_FADE = 0.05;     // how much the marks fade each step (all gone in ~6 seconds)

function makeTracks(game, area, W, H) {
  const { scene } = game.world;
  const tw = Math.round(W * TRACK_SCALE);
  const th = Math.round(H * TRACK_SCALE);
  const tex = new BABYLON.DynamicTexture('tracks', { width: tw, height: th }, scene, false);
  tex.hasAlpha = true;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, tw, th);
  tex.update();
  const mat = new BABYLON.StandardMaterial('tracks', scene);
  mat.diffuseTexture = tex;
  mat.useAlphaFromDiffuseTexture = true;
  mat.specularColor = BABYLON.Color3.Black();
  const plane = BABYLON.MeshBuilder.CreateGround('tracks', { width: W, height: H }, scene);
  plane.material = mat;
  plane.position.y = -9.6;
  plane.alphaIndex = 3;
  plane.parent = area.node;

  let dirty = false;
  let lastFade = 0;
  let fades = 0;
  return {
    material: mat,
    // A mark from (x1, y1) to (x2, y2) in field pixels.
    mark(x1, y1, x2, y2) {
      ctx.strokeStyle = 'rgba(58, 40, 22, 0.55)';
      ctx.lineWidth = 7 * TRACK_SCALE;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1 * TRACK_SCALE, y1 * TRACK_SCALE);
      ctx.lineTo(x2 * TRACK_SCALE, y2 * TRACK_SCALE);
      ctx.stroke();
      dirty = true;
    },
    // Every frame: fade old marks a little, and send the picture to the screen if it changed.
    update(now) {
      if (now - lastFade >= TRACK_FADE_EVERY) {
        lastFade = now;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = `rgba(0, 0, 0, ${TRACK_FADE})`;
        ctx.fillRect(0, 0, tw, th);
        ctx.restore();
        dirty = true;
        // Once a second, wipe marks that have almost faded away completely
        // (otherwise faint ghost lines hang around forever).
        if (++fades % 10 === 0) {
          const img = ctx.getImageData(0, 0, tw, th);
          const px = img.data;
          for (let i = 3; i < px.length; i += 4) if (px[i] < 26) px[i] = 0;
          ctx.putImageData(img, 0, 0);
        }
      }
      if (dirty) {
        tex.update();
        dirty = false;
      }
    },
  };
}

// A jeep: Kenney's Car Kit SUV (about 100 long), with our gun turret on
// the roof. Its front points up the screen (+z).
// paint = 'green' (player 1, the SUV's own colours) or 'orange' (player 2, tinted).
const JEEP_LENGTH = 100;
const ORANGE_TINT = new BABYLON.Color3(1, 0.62, 0.3);

function makeJeep(game, paint) {
  const { scene } = game.world;
  const M = game.mats;
  const jeep = new BABYLON.TransformNode('jeep', scene);
  jeep.parent = game.root;

  const car = game.world.spawn('suv', JEEP_LENGTH);
  car.parent = jeep;
  car.position.y = 22; // sit on the ground (the model is centred on its middle)
  if (paint === 'orange') paintModel(car, (c) => c.multiply(ORANGE_TINT));

  // Gun turret on the roof: a round base and a long barrel.
  // (The game turns it to aim; it points forward to start with.)
  const turret = new BABYLON.TransformNode('turret', scene);
  turret.parent = jeep;
  turret.position.set(0, 52, -6);
  const part = (mesh, mat, x, y, z) => {
    mesh.material = mat;
    mesh.parent = turret;
    mesh.position.set(x, y, z);
    return mesh;
  };
  part(BABYLON.MeshBuilder.CreateCylinder('turretBase', { diameter: 26, height: 8, tessellation: 16 }, scene), M.gun, 0, 0, 0);
  part(BABYLON.MeshBuilder.CreateBox('turretTop', { width: 15, height: 9, depth: 17 }, scene), M.gunDark, 0, 7, 0);
  part(BABYLON.MeshBuilder.CreateBox('barrel', { width: 6, height: 6, depth: 36 }, scene), M.gunDark, 0, 8, 22);
  jeep.turret = turret;

  // Shield bubble (only shown with the shield potion).
  const shield = BABYLON.MeshBuilder.CreateSphere('shieldBubble', { diameter: 150, segments: 16 }, scene);
  shield.material = M.shield;
  shield.position.y = 25;
  shield.parent = jeep;
  shield.setEnabled(false);
  jeep.shield = shield;
  jeep.wheels = [];
  return jeep;
}

// Trees (Kenney Graveyard Kit pines) all round the edge of the field, half
// off the screen so just their tops peek in. Two rows: big ones on the
// outside, smaller ones in front. Each tree gets its own shade of green
// so the forest looks natural instead of copy-pasted.
const TREE_GREENS = [
  '#3f7d3a', // mid green
  '#2f6a35', // deep green
  '#4f9045', // fresh light green
  '#26592e', // dark pine
  '#5a9440', // yellowy green
  '#3a7a55', // blue-green
];

function makeBorderTrees(game, area, W, H) {
  const kinds = ['pine', 'pine', 'pineCrooked']; // mostly straight pines
  const spots = [];
  const ring = (inset, step, size) => {
    for (let x = -30; x <= W + 30; x += step) {
      spots.push([x + between(-14, 14), inset + between(-10, 10), size]);
      spots.push([x + between(-14, 14), H - inset + between(-10, 10), size]);
    }
    for (let y = step / 2; y <= H - step / 2; y += step) {
      spots.push([inset + between(-10, 10), y + between(-14, 14), size]);
      spots.push([W - inset + between(-10, 10), y + between(-14, 14), size]);
    }
  };
  ring(-8, 58, [95, 130]); // outer row: big trees, mostly off screen
  ring(26, 74, [60, 85]);  // inner row: smaller trees in front
  // One plain green material per shade (shared by all trees of that shade).
  // The Kenney texture has brown and orange rims, so we drop it: all green.
  if (!game.treeMats) {
    game.treeMats = TREE_GREENS.map((color) => {
      const m = new BABYLON.StandardMaterial('tree-' + color, game.world.scene);
      m.diffuseColor = hex(color);
      m.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
      return m;
    });
  }
  const shades = game.treeMats;
  for (const [x, y, [small, big]] of spots) {
    // No trees in an open path (the left side of every field after the first).
    if (area.gaps.left && x < 150 && Math.abs(y - H / 2) < GAP_HALF + 30) continue;
    const tree = game.world.spawn(pick(kinds), between(small, big));
    tree.parent = area.node;
    tree.position.copyFrom(fieldSpot(W, H, x, y, 30));
    area.trees.push({ node: tree, x, y });
    tree.rotation.y = Math.random() * Math.PI * 2;
    const shade = pick(shades);
    for (const mesh of tree.getChildMeshes()) {
      const old = mesh.material;
      mesh.material = shade;
      if (old) old.dispose();
    }
  }
}

// Darker grass right under the trees, fading out toward the middle
// (like the shade under a forest edge).
function makeEdgeShade(game, area, W, H) {
  const { scene } = game.world;
  const mat = new BABYLON.StandardMaterial('edgeShade', scene);
  mat.diffuseTexture = makeShadeTexture(scene, W, H, area.gaps);
  mat.useAlphaFromDiffuseTexture = true;
  mat.specularColor = BABYLON.Color3.Black();
  const plane = BABYLON.MeshBuilder.CreateGround('edgeShade', { width: W, height: H }, scene);
  plane.material = mat;
  plane.position.y = -10.3; // just above the grass layer
  plane.alphaIndex = 2;
  plane.parent = area.node;
  area.shadeMat = mat;

  // Darker grass tufts near the edges (none where a path goes, or might go later).
  for (let i = 0; i < 60; i++) {
    const side = Math.floor(Math.random() * 4);
    const d = between(10, GRASS_BAND * 0.7);
    const x = side === 0 ? d : side === 1 ? W - d : between(0, W);
    const y = side === 2 ? d : side === 3 ? H - d : between(0, H);
    if (side < 2 && (y < 0 || y > H)) continue;
    if (side < 2 && Math.abs(y - H / 2) < GAP_HALF) continue;
    const tuft = BABYLON.MeshBuilder.CreateCylinder('tuft', { diameterTop: 0, diameterBottom: between(12, 22), height: 16, tessellation: 5 }, scene);
    tuft.material = game.mats.darkTuft;
    tuft.position.copyFrom(fieldSpot(W, H, x, y, -3));
    tuft.parent = area.node;
  }
}

function makeShadeTexture(scene, W, H, gaps) {
  const tex = new BABYLON.DynamicTexture('edgeShade', { width: 256, height: 256 }, scene, false);
  const ctx = tex.getContext();
  const dark = 'rgba(28, 70, 24, ';
  const bx = 256 * GRASS_BAND * 0.8 / W; // the shade stays inside the grass strip
  const by = 256 * GRASS_BAND * 0.8 / H;
  const sides = [
    [0, 0, 0, by], [0, 256, 0, 256 - by],
    [0, 0, bx, 0], [256, 0, 256 - bx, 0],
  ];
  for (const [x0, y0, x1, y1] of sides) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, dark + '0.9)');
    g.addColorStop(0.5, dark + '0.45)');
    g.addColorStop(1, dark + '0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  }
  cutPaths(ctx, 256, W, H, gaps, bx * 1.1);
  tex.hasAlpha = true;
  tex.update();
  return tex;
}

// A spot in a field, measured from that field's own middle (for things
// that belong to one field and sit inside its node).
function fieldSpot(W, H, x, y, h) {
  return new BABYLON.Vector3(x - W / 2, h, H / 2 - y);
}

// A hole in the ground: a dark pit with a ring of dug-up dirt round it.
// Starts closed (scale 0); the game opens it up. Later the pit (hole.pit)
// fills in, then the dirt ring and clumps slowly fade away.
function makeHole(game, x, y) {
  const { scene } = game.world;
  const hole = new BABYLON.TransformNode('hole', scene);
  hole.parent = game.root;
  hole.position.copyFrom(game.world.at(x, y, -9));
  const ring = BABYLON.MeshBuilder.CreateCylinder('holeRing', { diameter: 86, height: 4, tessellation: 12 }, scene);
  ring.material = game.mats.dugDirt;
  ring.parent = hole;
  const pit = BABYLON.MeshBuilder.CreateCylinder('pit', { diameter: 60, height: 2, tessellation: 12 }, scene);
  pit.material = game.mats.hole;
  pit.position.y = 2.5;
  pit.parent = hole;
  hole.pit = pit;
  // A few clumps of dirt thrown out round the edge.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
    const clump = BABYLON.MeshBuilder.CreateBox('clump', { size: between(8, 14) }, scene);
    clump.material = game.mats.dugDirt;
    clump.position.set(Math.cos(a) * 48, 3, Math.sin(a) * 48);
    clump.rotation.y = Math.random() * Math.PI;
    clump.parent = hole;
  }
  hole.scaling.set(0, 1, 0);
  return hole;
}

// A potion bottle: round glowing body, glass neck, cork. Lies on the grass.
function makePotion(game, color) {
  const { scene } = game.world;
  const bottle = new BABYLON.TransformNode('potion', scene);
  bottle.parent = game.root;
  const liquid = new BABYLON.StandardMaterial('potion-' + color, scene);
  liquid.diffuseColor = hex(color);
  liquid.emissiveColor = hex(color).scale(0.2);
  const body = BABYLON.MeshBuilder.CreateSphere('potionBody', { diameter: 30, segments: 10 }, scene);
  body.material = liquid;
  body.parent = bottle;
  const neck = BABYLON.MeshBuilder.CreateCylinder('potionNeck', { diameter: 11, height: 16, tessellation: 10 }, scene);
  neck.material = game.mats.glass;
  neck.rotation.x = Math.PI / 2;
  neck.position.set(0, 4, 19);
  neck.parent = bottle;
  const cork = BABYLON.MeshBuilder.CreateCylinder('potionCork', { diameter: 12, height: 7, tessellation: 10 }, scene);
  cork.material = game.mats.seat;
  cork.rotation.x = Math.PI / 2;
  cork.position.set(0, 4, 29);
  cork.parent = bottle;
  // The bottle's own colour is disposed with it (glass and cork are shared).
  bottle.onDisposeObservable.add(() => liquid.dispose());
  return bottle;
}

// ---------- Zombie models (Kenney) ----------
//
//   slow - Kenney Survivors zombie, skin A. Shuffles: its run animation, slowed right down.
//   fast - Kenney Survivors zombie, skin C. Sprints: the run animation at full speed.
//   boss - Kenney Graveyard Kit zombie, made huge. Stomps along with its walk animation.

const ZOMBIE_MODELS = {
  slow: { model: 'zombieA', height: 112, anim: 'run', animSpeed: 0.45, shadow: 22 },
  fast: { model: 'zombieC', height: 106, anim: 'run', animSpeed: 1.2, shadow: 20 },
  boss: { model: 'boss', height: 210, anim: 'walk', animSpeed: 0.9, shadow: 52 },
};

let shadowMaterial = null;

function makeZombie(game, kind = 'slow') {
  const { scene } = game.world;
  const info = ZOMBIE_MODELS[kind];
  const z = new BABYLON.TransformNode('zombie', scene);
  z.parent = game.root;

  const body = game.world.spawn(info.model, info.height, { by: 'height' });
  z.armPoses = armsForward(body, ARM_RIGS[info.model]);
  z.armPhase = Math.random() * Math.PI * 2;
  body.parent = z;

  // Soft shadow on the ground.
  if (!shadowMaterial || shadowMaterial.getScene() !== scene || shadowMaterial.isDisposed?.()) {
    shadowMaterial = new BABYLON.StandardMaterial('z-shadow', scene);
    shadowMaterial.diffuseColor = BABYLON.Color3.Black();
    shadowMaterial.specularColor = BABYLON.Color3.Black();
    shadowMaterial.alpha = 0.3;
  }
  const shadow = BABYLON.MeshBuilder.CreateDisc('zshadow', { radius: info.shadow, tessellation: 16 }, scene);
  shadow.rotation.x = Math.PI / 2;
  shadow.position.y = 0.6;
  shadow.material = shadowMaterial;
  shadow.parent = z;

  // Play one of its animations on a loop (and stop the others).
  z.play = (name, speed = 1) => {
    for (const [n, g] of Object.entries(body.anims)) {
      if (n === name) g.start(true, speed);
      else g.stop();
    }
  };
  z.walk = () => z.play(info.anim, info.animSpeed);
  z.play('idle');
  return z;
}

// The classic zombie pose: both arms stretched straight out in front.
// We take the arms out of the walk/run animations (the legs and body keep
// moving) and turn each upper arm to point forward, a little downward.
//   anim  - which animated parts are arms
//   arms  - [upper arm, the part it points at] for each side
//           (just [arm] when the arm is one solid piece)
//   droop - how far below level the arms point
const ARM_BOB = 0.22;          // how far the arms swing up and down
const ARM_BOB_SPEED = { slow: 4, fast: 9, boss: 3 }; // how quickly (bigger = faster)

const SURVIVOR_ARMS = {
  anim: /^(Left|Right)(Shoulder|Arm|ForeArm|Hand)/,
  arms: [['LeftArm', 'LeftForeArm'], ['RightArm', 'RightForeArm']],
  droop: 0.25,
  spread: 0.22,
};
const ARM_RIGS = {
  zombieA: SURVIVOR_ARMS,
  zombieC: SURVIVOR_ARMS,
  boss: { anim: /^arm-(left|right)$/, arms: [['arm-left'], ['arm-right']], droop: 0.15, spread: 0.28 },
};

function armsForward(body, rig) {
  for (const group of Object.values(body.anims)) {
    for (const t of [...group.targetedAnimations]) {
      if (rig.anim.test(t.target.name)) group.removeTargetedAnimation(t.animation);
    }
  }
  const all = body.getDescendants(false);
  all.forEach((n) => n.computeWorldMatrix?.(true));
  const poses = [];
  rig.arms.forEach(([armName, tipName], i) => {
    const arm = all.find((n) => n.name === armName);
    if (!arm) return;
    const side = i === 0 ? -1 : 1; // left arm is on the -x side (the model faces +z)
    // Which way the arm points now, measured in its parent's space...
    const rot = arm.rotationQuaternion || BABYLON.Quaternion.FromEulerVector(arm.rotation);
    const tip = tipName
      ? all.find((n) => n.name === tipName).position
      : arm.getBoundingInfo().boundingBox.center;
    const now = tip.applyRotationQuaternion(rot).normalize();
    const parentInverse = arm.parent.getWorldMatrix().clone().invert();
    // ...turned to point forward (a little out to the side), once raised and once lowered.
    const aim = (droop) => {
      const forward = new BABYLON.Vector3(side * rig.spread, -droop, 1).normalize();
      const want = BABYLON.Vector3.TransformNormal(forward, parentInverse).normalize();
      const turn = new BABYLON.Quaternion();
      BABYLON.Quaternion.FromUnitVectorsToRef(now, want, turn);
      return turn.multiply(rot);
    };
    const high = aim(rig.droop - ARM_BOB);
    const low = aim(rig.droop + ARM_BOB);
    arm.rotationQuaternion = high.clone();
    poses.push({ arm, high, low, side });
  });
  return poses;
}

// Put a zombie in place (its own animation does the walking), and bob its
// arms up and down - left and right taking turns, quicker for fast zombies.
function placeZombie(game, z) {
  z.model.position.copyFrom(game.world.at(z.x, z.y, -10));
  const t = performance.now() / 1000 * ARM_BOB_SPEED[z.kind] + z.model.armPhase;
  for (const p of z.model.armPoses) {
    const k = (Math.sin(t + (p.side > 0 ? Math.PI : 0)) + 1) / 2;
    BABYLON.Quaternion.SlerpToRef(p.low, p.high, k, p.arm.rotationQuaternion);
  }
}

// How fast a fast zombie runs in this wave.
function fastSpeed(wave) {
  return Math.min(FAST_SPEED_MAX, FAST_SPEED + FAST_SPEED_PER_WAVE * (wave - 1));
}

function between(a, b) {
  return a + Math.random() * (b - a);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}
