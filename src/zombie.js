// Zombie Jeep: you drive a jeep, seen from above, on a grassy field.
//
//   - Hold your finger on the screen: the closest jeep drives toward your finger.
//   - Let go: the jeep stops.
//   - Zombies dig their way out of the ground (a hole opens, then a zombie
//     climbs out) and chase the closest jeep. Don't let one touch you!
//   - Waves: every 30 seconds a new wave starts, and each is harder:
//     zombies come quicker, more of them are fast ones (who run faster
//     every wave), and the slow ones take more hits to knock out.
//   - At the end of each wave a big boss zombie digs out. The next wave
//     only starts once it's knocked out (it takes lots of hits).
//   - Potion bottles pop up now and then. Drive over one for a power-up:
//     blue = speed, yellow = rapid fire, purple = shield, olive = land mines
//     (the jeep drops one behind it every 3 seconds; they only blow up zombies),
//     orange = bulldozer
//     (a blade on the front: drive into zombies to flatten them - not the boss!).
//   - A gun turret on top of each jeep swings round by itself and shoots
//     the closest zombie (if it's near enough).
//   - Points: every zombie knocked out earns points (shown top left).
//   - From wave 5 a weapon box sits somewhere on the map (a label points to
//     it). Drive over it with enough points to buy a new weapon for that
//     jeep: machine gun, shotgun, rockets or laser. Then the box moves.
//   - The map: three fields. A (bottom left, where you start), B (bottom
//     right) and C (wide, along the top). Paths through the trees open at
//     wave 2 (A to B), wave 5 (B to C) and wave 7 (A to C). The view follows
//     the jeeps (the middle of both, with two players), and the two jeeps
//     can't get further apart than the screen.
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

// Jumpers (from wave 3): purple. One stands still for a moment, turning to
// face the jeep, then leaps at it in a big hop - and does it again.
// Can't catch you in mid-air, only when it lands.
const JUMPER_FROM_WAVE = 3;
const JUMPER_CHANCE = 0.22;    // share of zombies that are jumpers
const JUMPER_HITS = 2;         // hits to knock one out (one more every 3 waves)
const JUMP_WAIT_MS = 1100;     // crouches this long between hops...
const JUMP_MS = 650;           // ...a hop takes this long...
const JUMP_DIST = 280;         // ...and covers up to this far...
const JUMP_HEIGHT = 70;        // ...this high
const JUMPER_TURN = 4;

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
const BOOST_MS = 18000;         // how long a power-up lasts
const POTIONS = {
  speed:  { color: '#3aa0ff', label: 'Speed!' },     // jeep drives much faster
  rapid:  { color: '#ffd84d', label: 'Rapid fire!' }, // gun shoots much faster
  shield: { color: '#b46bff', label: 'Shield!' },    // zombies can't get you
  dozer:  { color: '#ff8c1a', label: 'Bulldozer!' }, // blade on the front flattens zombies (not the boss)
  mines:  { color: '#8fa63a', label: 'Land mines!' }, // drops a mine behind the jeep every few seconds
};
// Rescue potion: only shows up while a jeep is caught. Grab it and that jeep comes back.
const RESCUE = { color: '#ff4d6d', label: 'Rescue!' };
const RESCUE_AFTER_MS = 4000;   // pops up this long after a jeep is caught (or after the last one vanished)
const RESCUE_LASTS_MS = 15000;
// Land mines (from the mines potion): one drops behind the jeep every
// MINE_EVERY_MS. A zombie that steps on one sets it off; jeeps can't.
const MINE_EVERY_MS = 3000;
const MINE_BLAST = { blast: 115, damage: 5 }; // hurts every zombie this close
const MINE_LASTS_MS = 45000;   // an unused mine fades away after this long
const SPEED_BOOST = 1.6;        // top speed x1.6 with the speed potion
const RAPID_FACTOR = 0.35;      // rapid-fire potion: time between shots x0.35
const HOLE_MS = 900;           // a hole takes this long to open...
const CLIMB_MS = 900;          // ...then the zombie takes this long to climb out
const HOLE_STAYS_MS = 1500;    // the empty hole stays this long before filling in...
const HOLE_FADE_MS = 10000;    // ...then its ring of dug-up dirt fades away over this long
const HOLE_MIN_DISTANCE = 230; // holes never open closer than this to a jeep
const TURRET_RANGE = 380;      // the gun only shoots zombies this close (pixels)
const TURRET_TURN = 7;         // how fast the gun swings round (radians per second)

// Weapons. Every jeep starts with the gun; the weapon box sells the others.
//   ms = time between shots, shots = bullets per shot (spread out over `spread`
//   radians), damage = hits taken off a zombie, life = how long a bullet flies
//   (ms, else until off screen), blast = rockets hurt everything this close,
//   pierce = laser bolts go through zombies.
const WEAPONS = {
  gun:     { name: 'Gun',          ms: 650,  shots: 1, spread: 0,    damage: 1, speed: 700,  size: 6,  color: '#ffd84d' },
  machine: { name: 'Machine gun!', ms: 150,  shots: 1, spread: 0.12, damage: 1, speed: 900,  size: 5,  color: '#fff17a' },
  shotgun: { name: 'Shotgun!',     ms: 800,  shots: 6, spread: 0.6,  damage: 1, speed: 750,  size: 5,  color: '#ffb347', life: 500 },
  rocket:  { name: 'Rockets!',     ms: 1100, shots: 1, spread: 0,    damage: 4, speed: 520,  size: 11, color: '#ff6a3d', blast: 120 },
  laser:   { name: 'Laser!',       ms: 380,  shots: 1, spread: 0,    damage: 2, speed: 1400, size: 5,  color: '#5ef0ff', pierce: true },
};

// Points for knocking zombies out, and the weapon box.
const POINTS = { slow: 10, fast: 15, jumper: 20, boss: 100 };
const BOX_WAVE = 5;            // the box first shows up at this wave
const BOX_PRICE = 300;         // points for one go
const BOX_MOVE_MS = 1500;      // after a buy it vanishes, then pops up somewhere else

// The map, in screens: A bottom left (start), B bottom right, C wide along the top.
const FIELDS = [
  { x: 0, y: 0, w: 1, h: 1 },  // A
  { x: 1, y: 0, w: 1, h: 1 },  // B
  { x: 0, y: -1, w: 2, h: 1 }, // C
];
// Paths through the trees: on field a's `side`, `at` this far along it (0 to 1), into field b.
const OPENINGS = [
  { wave: 2, a: 0, b: 1, side: 'right', at: 0.5 },  // 1: A to B
  { wave: 5, a: 1, b: 2, side: 'top', at: 0.57 },   // 2: B to C
  { wave: 7, a: 0, b: 2, side: 'top', at: 0.48 },   // 3: A to C
];
const GAP_HALF = 130;          // a path is twice this wide
const PATH_DEPTH = 170;        // and reaches this far either side of the tree line
const CAMERA_FOLLOW = 6;       // how quickly the view catches up with the jeeps

// Background music: loops all game, but goes quiet while the wave track
// plays (so you can hear it), then comes back up.
const MUSIC_FILE = 'assets/audio/music.mp3';
const MUSIC_VOLUME = 0.45;
const MUSIC_QUIET = 0.08;

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

    this.areas = [];     // fields built so far
    this.fields = [];    // ...by number (0 = A, 1 = B, 2 = C)
    this.paths = [];     // open paths between fields
    this.arrows = [];
    this.buildArea(0);
    this.box = null;     // the weapon box (from wave 5)
    this.points = 0;

    // Jeep 1 starts in the middle, pointing up. Jeep 2 joins with the button.
    this.jeeps = [this.makeJeep(W / 2, H / 2, 'green')];
    this.shots = [];

    this.zombies = [];   // zombies out of the ground, chasing
    this.diggers = [];   // zombies still climbing out of their holes
    this.holes = [];     // empty holes waiting to fill in
    this.potions = [];   // bottles waiting to be picked up
    this.mines = [];     // land mines on the ground
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
    this.pointsEl = el('div', 'points');
    ui.append(this.pointsEl);
    this.drawPoints();
    this.showWaveBanner();

    // The wave track plays now, at the start, and again after each boss
    // (just before the next wave). No new zombies come out while it plays;
    // zombies already out keep chasing.
    this.phase = 'fight';
    this.music = sound.play('wave');
    this.quietUntil = this.started + sound.duration('wave') * 1000;
    this.song = sound.music(MUSIC_FILE, MUSIC_QUIET); // starts quiet: the wave track is playing
    this.songQuiet = true;

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
    this.song.stop();
    clearTimeout(this.timer);
    [this.sun.intensity, this.sky.intensity] = this.oldLight;
    this.root.dispose(false, false);
    for (const m of Object.values(this.mats)) m.dispose();
    for (const a of this.areas) {
      a.dirtMat.dispose(false, true);
      a.grassMat.dispose(false, true);
      a.shadeMat.dispose(false, true);
      a.tracks.material.dispose(true, true);
    }
    this.grassTexture.dispose();
    this.sandTexture.dispose();
    for (const m of this.treeMats) m.dispose();
    this.world.originX = 0;
    this.world.cameraX = 0;
    this.world.cameraY = 0;
    this.world.camera.position.x = 0;
    this.world.camera.position.z = 0;
    this.ui.innerHTML = '';
  }

  // ---------- Jeeps ----------

  makeJeep(x, y, paint) {
    return {
      x, y,
      heading: 0,          // which way it points (0 = up the screen)
      speed: 0,
      finger: null,        // where its driver's finger is on the screen (null = not touching)
      pointerId: null,     // which finger is driving it
      turretAim: 0,        // which way its gun points on screen
      lastShot: 0,
      weapon: 'gun',       // see WEAPONS
      out: false,          // caught by a zombie
      safeUntil: 0,
      boost: { speed: 0, rapid: 0, shield: 0, dozer: 0, mines: 0 }, // when each power-up runs out
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
    this.joinButton.remove();
    this.world.burst(jeep.x, jeep.y, { count: 10, color: '#ffb347', size: [6, 12], dist: [40, 90], ms: 450 });
  }

  // The spot on the screen furthest from any zombie (for a jeep to appear).
  safeSpot() {
    const { W, H } = this.world;
    const cx = this.world.cameraX;
    const cy = this.world.cameraY;
    const spots = [[W / 2, H * 0.8], [W / 2, H * 0.2], [W * 0.25, H / 2], [W * 0.75, H / 2]]
      .map(([x, y]) => [cx + x, cy + y])
      .filter(([x, y]) => this.walkable(x, y, JEEP_RADIUS + 10)); // (not in the trees)
    // (Not on top of a jeep that's already there.)
    const free = spots.filter(([x, y]) => this.liveJeeps().every((j) => Math.hypot(j.x - x, j.y - y) > 200));
    const choices = free.length ? free : spots;
    if (!choices.length) return this.spotInView(JEEP_RADIUS + 20);
    const safest = choices.reduce((best, spot) =>
      (this.closestZombieDistance(spot) > this.closestZombieDistance(best) ? spot : best));
    return { x: safest[0], y: safest[1] };
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

  // ---------- Touch: hold to drive, let go to stop ----------

  stopSteering(j) {
    j.pointerId = null;
    j.finger = null;
  }

  // Each new finger takes the closest jeep that nobody is driving yet.
  setUpTouch() {
    const { W, H } = this.world;
    const stage = document.getElementById('stage');
    const toScreen = (e) => {
      const r = stage.getBoundingClientRect();
      // Where on the SCREEN. The view moves, so each frame the jeep heads for
      // whatever bit of the field is under the finger right then.
      return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
    };
    const down = (e) => {
      const p = toScreen(e);
      const q = { x: p.x + this.world.cameraX, y: p.y + this.world.cameraY }; // that spot on the field
      const free = this.liveJeeps().filter((j) => j.pointerId === null);
      if (!free.length) return;
      free.sort((a, b) => Math.hypot(a.x - q.x, a.y - q.y) - Math.hypot(b.x - q.x, b.y - q.y));
      free[0].pointerId = e.pointerId;
      free[0].finger = p;
    };
    const move = (e) => {
      const j = this.jeeps.find((jj) => jj.pointerId === e.pointerId);
      if (j) j.finger = toScreen(e);
    };
    const up = (e) => {
      const j = this.jeeps.find((jj) => jj.pointerId === e.pointerId);
      if (j) this.stopSteering(j);
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
    // Music down while the wave track plays, back up after.
    const quiet = now < this.quietUntil;
    if (quiet !== this.songQuiet) {
      this.songQuiet = quiet;
      this.song.volume(quiet ? MUSIC_QUIET : MUSIC_VOLUME, quiet ? 0.4 : 1.5);
    }
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
      this.openPaths();
      if (this.wave === BOX_WAVE) this.placeBox(now);
    }

    for (const j of this.liveJeeps()) {
      this.driveJeep(j, s, now);
      this.aimTurret(j, now, s);
      // Blink while safe after joining.
      setVisibility(j.model, now < j.safeUntil && Math.floor(now / 125) % 2 ? 0.35 : 1);
      j.model.shield.setEnabled(this.hasBoost(j, 'shield', now));
      j.model.blade.setEnabled(this.hasBoost(j, 'dozer', now));
    }
    this.followCamera(s);
    this.moveShots(s, now);
    this.updatePotions(now);
    this.updateBox(now);
    this.updateMines(now);

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
      if (z.kind === 'jumper') {
        this.hop(z, now, s);
        continue;
      }
      // (Zombies come through the paths too, not through the trees.)
      this.moveBy(z, z.r, Math.sin(z.heading) * z.speed * s, -Math.cos(z.heading) * z.speed * s);
    }
    this.spreadZombies();
    for (const z of this.zombies) {
      z.step += s * (2 + z.speed / 12); // quicker zombies take quicker steps
      z.model.rotation.y = z.heading;
      placeZombie(this, z);
      // Bulldozer: any zombie the jeep runs into is flattened (the boss is too big).
      const dozer = z.kind !== 'boss' && this.liveJeeps().find((j) => this.hasBoost(j, 'dozer', now)
        && Math.hypot(z.x - j.x, z.y - j.y) < (JEEP_RADIUS + z.r) * 1.05);
      if (dozer) {
        this.world.burst(z.x, z.y, { count: 8, color: '#ffb347', size: [6, 12], dist: [30, 80], ms: 350 });
        this.world.shake(120, 4);
        this.hurtZombie(z, z.hits, 0, 0, now);
        continue;
      }
      if ((z.lift || 0) > 30) continue; // a jumper in mid-air can't catch you
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
      this.stopSteering(j);
      Object.assign(j, {
        x: spot.x, y: spot.y, out: false, speed: 0,
        lastWheels: null, safeUntil: now + JOIN_SAFE_MS, boost: { speed: 0, rapid: 0, shield: 0, dozer: 0, mines: 0 },
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
  popText(x, y, text, color, size = 40) {
    const t = el('div', 'plus');
    t.textContent = text;
    Object.assign(t.style, { left: `${x - this.world.cameraX}px`, top: `${y - this.world.cameraY}px`, color, fontSize: `${size}px` });
    t.style.setProperty('--rise', '-70px');
    this.ui.append(t);
    setTimeout(() => t.remove(), 900);
  }

  driveJeep(j, s, now) {
    const { W, H } = this.world;
    if (j.finger) {
      const dx = j.finger.x + this.world.cameraX - j.x; // (finger is on the screen; the view moves)
      const dy = j.finger.y + this.world.cameraY - j.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 6) {
        // Turn toward the finger (heading 0 = up the screen, turning clockwise).
        const want = Math.atan2(dx, -dy);
        let diff = want - j.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest way round
        j.heading += Math.max(-JEEP_TURN * s, Math.min(JEEP_TURN * s, diff));
        // Speed up, but slow down when nearly at the finger.
        const top = JEEP_TOP_SPEED * (this.hasBoost(j, 'speed', now) ? SPEED_BOOST : 1);
        const wantSpeed = Math.min(top, dist * 4);
        j.speed += Math.max(-JEEP_BRAKE * s, Math.min(900 * s, wantSpeed - j.speed));
      } else {
        j.speed = Math.max(0, j.speed - JEEP_BRAKE * s);
      }
    } else {
      // Finger lifted: stop.
      j.speed = Math.max(0, j.speed - JEEP_BRAKE * s);
    }

    // Stay out of the trees, and both jeeps have to fit on the screen:
    // a jeep can't get further from the other one than that (it's held back).
    const other = this.liveJeeps().find((o) => o !== j);
    const reachX = W - 2 * JEEP_RADIUS - 20;
    const reachY = H - 2 * JEEP_RADIUS - 20;
    this.moveBy(j, JEEP_RADIUS, Math.sin(j.heading) * j.speed * s, -Math.cos(j.heading) * j.speed * s,
      (x, y) => this.walkable(x, y, JEEP_RADIUS)
        && (!other || (Math.abs(x - other.x) <= reachX && Math.abs(y - other.y) <= reachY)));

    j.model.position.copyFrom(this.world.at(j.x, j.y, 0));
    j.model.rotation.y = j.heading;
    this.leaveTracks(j);
    // Wheels spin with speed.
    for (const w of j.model.wheels) w.rotation.x += j.speed * s / 12;
  }

  // Tyre tracks from the two back wheels while the jeep is moving.
  leaveTracks(j) {
    if (Math.abs(j.speed) < 15) {
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

  // ---------- The map: fields and the paths between them ----------

  // Field i (see FIELDS): dirt, grass round the edge and trees all round,
  // at its own spot in the 3D world.
  buildArea(i) {
    const { W, H, scene } = this.world;
    const f = FIELDS[i];
    const area = { i, x: f.x * W, y: f.y * H, w: f.w * W, h: f.h * H, gaps: [], trees: [], tufts: [] };
    area.node = new BABYLON.TransformNode('area' + i, scene);
    area.node.parent = this.root;
    area.node.position.set(area.x + area.w / 2 - W / 2, 0, H / 2 - (area.y + area.h / 2));
    makeGround(this, area);
    makeEdgeShade(this, area);
    area.tracks = makeTracks(this, area);
    makeBorderTrees(this, area);
    this.fields[i] = area;
    this.areas.push(area);
    return area;
  }

  // Waves 2, 5 and 7: a path opens (and the field on the other side is
  // built, if it isn't yet).
  openPaths() {
    for (const o of OPENINGS) if (o.wave === this.wave) this.openPath(o);
  }

  openPath(o) {
    if (!this.fields[o.b]) this.buildArea(o.b);
    const a = this.fields[o.a];
    const b = this.fields[o.b];
    const vertical = o.side === 'left' || o.side === 'right'; // the tree line runs up and down
    const along = vertical ? a.y + o.at * a.h : a.x + o.at * a.w;
    const wall = { left: a.x, right: a.x + a.w, top: a.y, bottom: a.y + a.h }[o.side];
    const toward = o.side === 'right' || o.side === 'bottom' ? 1 : -1; // from a into b
    this.paths.push({ vertical, along, wall, toward });
    const opposite = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' }[o.side];
    for (const [area, side] of [[a, o.side], [b, opposite]]) {
      const gap = { side, at: along - (vertical ? area.y : area.x) };
      area.gaps.push(gap);
      redrawGrass(this, area);
      this.clearPath(area, gap);
    }
    setTimeout(() => {
      if (this.destroyed) return;
      const msg = el('div', 'wave-banner');
      msg.textContent = 'New path!';
      msg.style.left = `${this.world.W / 2}px`;
      msg.style.top = `${this.world.H / 2 + 120}px`;
      msg.style.fontSize = '72px';
      this.ui.append(msg);
      setTimeout(() => msg.remove(), 1800);
    }, 900);
    this.makeArrows();
  }

  // The trees in the way shrink away in a puff of leaves, one after another.
  clearPath(area, gap) {
    const inWay = area.trees.filter((t) => inGap(area, gap, t.x, t.y, 30));
    inWay.forEach((t, i) => {
      area.trees.splice(area.trees.indexOf(t), 1);
      const size = t.node.scaling.x;
      setTimeout(() => {
        if (this.destroyed) return;
        this.world.burst(area.x + t.x, area.y + t.y, { count: 8, color: pick(TREE_GREENS), size: [8, 16], dist: [30, 80], ms: 500, h: 40 });
        this.world.animate(500, (p) => t.node.scaling.setAll(size * (1 - p)), () => t.node.dispose());
      }, 200 + i * 120);
    });
    for (const t of area.tufts.filter((tt) => inGap(area, gap, tt.x, tt.y, 0))) t.mesh.dispose();
    area.tufts = area.tufts.filter((tt) => !inGap(area, gap, tt.x, tt.y, 0));
  }

  // Can something this size (r) be here? Inside a field, or in an open path.
  walkable(x, y, r) {
    for (const a of this.areas) {
      if (x >= a.x + r && x <= a.x + a.w - r && y >= a.y + r && y <= a.y + a.h - r) return true;
    }
    const half = GAP_HALF - r;
    for (const p of this.paths) {
      const [across, along] = p.vertical ? [x, y] : [y, x];
      if (Math.abs(across - p.wall) <= PATH_DEPTH && Math.abs(along - p.along) <= half) return true;
    }
    return false;
  }

  // Move something (a jeep or zombie, r = its size) by (dx, dy), but not
  // into the trees: it slides along them instead.
  moveBy(p, r, dx, dy, ok = (x, y) => this.walkable(x, y, r)) {
    if (!ok(p.x, p.y)) { // somewhere odd already: let it move, so it can get out
      p.x += dx;
      p.y += dy;
      return;
    }
    if (ok(p.x + dx, p.y)) p.x += dx;
    if (ok(p.x, p.y + dy)) p.y += dy;
  }

  // A random spot on the screen, inside a field (at least `margin` from the trees).
  spotInView(margin) {
    const { W, H } = this.world;
    const cx = this.world.cameraX;
    const cy = this.world.cameraY;
    for (let tries = 0; tries < 40; tries++) {
      const x = cx + between(margin, W - margin);
      const y = cy + between(margin + 60, H - margin);
      if (this.walkable(x, y, margin)) return { x, y };
    }
    const j = this.liveJeeps()[0];
    const a = (j && this.areas.find((f) => j.x >= f.x && j.x <= f.x + f.w && j.y >= f.y && j.y <= f.y + f.h)) || this.areas[0];
    return { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  }

  // The view follows the jeeps (the middle of them, with two), but never
  // past the edge of the map, and never leaving a jeep off the screen.
  followCamera(s) {
    const { W, H } = this.world;
    const live = this.liveJeeps();
    if (!live.length) return;
    const minX = Math.min(...this.areas.map((a) => a.x));
    const maxX = Math.max(...this.areas.map((a) => a.x + a.w)) - W;
    const minY = Math.min(...this.areas.map((a) => a.y));
    const maxY = Math.max(...this.areas.map((a) => a.y + a.h)) - H;
    const midX = live.reduce((sum, j) => sum + j.x, 0) / live.length;
    const midY = live.reduce((sum, j) => sum + j.y, 0) / live.length;
    const k = Math.min(1, s * CAMERA_FOLLOW);
    let cx = this.world.cameraX + (Math.max(minX, Math.min(maxX, midX - W / 2)) - this.world.cameraX) * k;
    let cy = this.world.cameraY + (Math.max(minY, Math.min(maxY, midY - H / 2)) - this.world.cameraY) * k;
    for (const j of live) {
      cx = Math.max(j.x + JEEP_RADIUS - W, Math.min(j.x - JEEP_RADIUS, cx));
      cy = Math.max(j.y + JEEP_RADIUS - H, Math.min(j.y - JEEP_RADIUS, cy));
    }
    cx = Math.max(minX, Math.min(maxX, cx));
    cy = Math.max(minY, Math.min(maxY, cy));
    this.world.cameraX = cx;
    this.world.cameraY = cy;
    this.world.camera.position.x = cx;
    this.world.camera.position.z = -cy;
    for (const a of this.arrows) {
      const x = a.x - cx;
      const y = a.y - cy;
      a.el.style.left = `${x}px`;
      a.el.style.top = `${y}px`;
      a.el.style.display = x < -20 || x > W + 20 || y < 60 || y > H + 20 ? 'none' : '';
    }
  }

  // Tyre marks go on the field they're in.
  markTracks(x1, y1, x2, y2) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const a = this.areas.find((f) => mx >= f.x && mx <= f.x + f.w && my >= f.y && my <= f.y + f.h);
    if (a) a.tracks.mark(x1 - a.x, y1 - a.y, x2 - a.x, y2 - a.y);
  }

  // Bouncing arrows on both sides of every open path, pointing through it
  // (moved with the view each frame).
  makeArrows() {
    for (const a of this.arrows) a.el.remove();
    this.arrows = [];
    for (const p of this.paths) {
      for (const dir of [p.toward, -p.toward]) {
        // On the near side, pointing across (further in above/below, clear of the wave counter).
        const spot = p.wall - dir * (p.vertical ? 60 : 130);
        const [x, y] = p.vertical ? [spot, p.along] : [p.along, spot];
        const name = p.vertical ? (dir > 0 ? 'right' : 'left') : (dir > 0 ? 'down' : 'up');
        const arrow = el('div', 'path-arrow ' + name);
        arrow.textContent = { right: '➜', left: '⬅', up: '⬆', down: '⬇' }[name];
        this.ui.append(arrow);
        this.arrows.push({ el: arrow, x, y });
      }
    }
  }

  // ---------- Land mines ----------

  // Drop mines behind jeeps that have the potion; blow up any a zombie steps on.
  updateMines(now) {
    for (const j of this.liveJeeps()) {
      if (!this.hasBoost(j, 'mines', now) || now < (j.nextMineAt || 0)) continue;
      j.nextMineAt = now + MINE_EVERY_MS;
      const x = j.x - Math.sin(j.heading) * 50; // out the back
      const y = j.y + Math.cos(j.heading) * 50;
      const model = makeMine(this);
      model.position.copyFrom(this.world.at(x, y, -8));
      this.mines.push({ x, y, model, born: now });
      this.world.burst(x, y, { count: 4, color: '#8fa63a', size: [4, 8], dist: [10, 25], ms: 200, h: 0 });
    }
    for (const m of this.mines) {
      const age = now - m.born;
      m.model.light.setEnabled(Math.floor(now / 400) % 2 === 0); // blinking red light
      if (age > MINE_LASTS_MS) {
        m.gone = true;
        continue;
      }
      // (A jumper in the air sails over it.)
      const z = this.zombies.find((zz) => (zz.lift || 0) < 30 && Math.hypot(zz.x - m.x, zz.y - m.y) < zz.r + 16);
      if (z) {
        m.gone = true;
        this.explode(m.x, m.y, MINE_BLAST, now);
      }
    }
    for (const m of this.mines) if (m.gone) m.model.dispose();
    this.mines = this.mines.filter((m) => !m.gone);
  }

  // ---------- Points and the weapon box ----------

  drawPoints() {
    this.pointsEl.textContent = `⭐ ${this.points}`;
  }

  // The weapon box pops up somewhere on the map (not right by a jeep).
  placeBox(now) {
    let x;
    let y;
    for (let tries = 0; tries < 30; tries++) {
      const a = pick(this.areas);
      x = a.x + between(160, a.w - 160);
      y = a.y + between(160, a.h - 160);
      if (this.liveJeeps().every((j) => Math.hypot(j.x - x, j.y - y) > 300)) break;
    }
    if (!this.box) {
      const label = el('div', 'box-label');
      label.textContent = `🎁 ${BOX_PRICE} ⭐`;
      this.ui.append(label);
      this.box = { model: makeBox(this), label, nagUntil: 0 };
    }
    Object.assign(this.box, { x, y, hiddenUntil: 0, moving: false });
    this.box.model.setEnabled(true);
    this.world.burst(x, y, { count: 12, color: '#ffd84d', size: [6, 12], dist: [40, 100], ms: 500, h: 30 });
  }

  // Bob the box, keep its label pointing at it, and sell weapons.
  updateBox(now) {
    const b = this.box;
    if (!b) return;
    if (b.moving) {
      if (now < b.hiddenUntil) return;
      this.placeBox(now);
    }
    b.model.position.copyFrom(this.world.at(b.x, b.y, 4 + Math.sin(now / 250) * 4));
    b.model.rotation.y = Math.sin(now / 900) * 0.4;
    // The label sits above the box; if the box is off screen, it waits at
    // the edge of the screen on that side, so you know which way to go.
    const { W, H } = this.world;
    const sx = b.x - this.world.cameraX;
    const sy = b.y - this.world.cameraY - 70;
    const lx = Math.max(90, Math.min(W - 90, sx));
    const ly = Math.max(120, Math.min(H - 40, sy));
    b.label.style.left = `${lx}px`;
    b.label.style.top = `${ly}px`;
    b.label.classList.toggle('far', lx !== sx || ly !== sy);

    const j = this.liveJeeps().find((jj) => Math.hypot(jj.x - b.x, jj.y - b.y) < JEEP_RADIUS + 34);
    if (!j) return;
    if (this.points >= BOX_PRICE) {
      this.points -= BOX_PRICE;
      this.drawPoints();
      j.weapon = pick(Object.keys(WEAPONS).filter((k) => k !== 'gun' && k !== j.weapon));
      const w = WEAPONS[j.weapon];
      this.world.burst(b.x, b.y, { count: 20, color: w.color, size: [8, 16], dist: [50, 140], ms: 600, h: 30 });
      this.popText(j.x, j.y - 60, w.name, w.color, 48);
      b.moving = true;
      b.hiddenUntil = now + BOX_MOVE_MS;
      b.model.setEnabled(false);
      b.label.style.display = 'none';
      setTimeout(() => { b.label.style.display = ''; }, BOX_MOVE_MS);
    } else if (now > b.nagUntil) {
      this.popText(b.x, b.y - 50, `Need ${BOX_PRICE} ⭐`, '#ffffff', 30);
      b.nagUntil = now + 1500;
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
      ({ x, y } = this.spotInView(boss ? 120 : 60));
      const j = this.closestJeep(x, y);
      if (!j || Math.hypot(x - j.x, y - j.y) > HOLE_MIN_DISTANCE * (boss ? 1.4 : 1)) break;
    }
    const j = this.closestJeep(x, y) || { x: W / 2, y: H / 2 };
    if (!kind && this.wave >= JUMPER_FROM_WAVE && Math.random() < JUMPER_CHANCE) kind = 'jumper';
    if (!kind) {
      const fastChance = Math.min(FAST_CHANCE_MAX, FAST_CHANCE + FAST_CHANCE_PER_WAVE * (this.wave - 1));
      kind = Math.random() < fastChance ? 'fast' : 'slow';
    }
    const hits = {
      fast: 1,
      jumper: JUMPER_HITS + Math.max(0, Math.floor((this.wave - JUMPER_FROM_WAVE) / 3)),
      slow: Math.min(SLOW_MAX_HITS, this.wave),
      boss: BOSS_HITS + BOSS_HITS_PER_WAVE * (this.wave - 1),
    }[kind];
    const z = {
      x,
      y,
      kind,
      r: boss ? ZOMBIE_RADIUS * BOSS_SIZE : ZOMBIE_RADIUS,
      heading: Math.atan2(j.x - x, -(j.y - y)), // already looking at the jeep
      speed: { fast: fastSpeed(this.wave), slow: between(...SLOW_SPEED), jumper: 0, boss: BOSS_SPEED }[kind],
      turn: { fast: FAST_TURN, slow: SLOW_TURN, jumper: JUMPER_TURN, boss: BOSS_TURN }[kind],
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

  // A jumper: wait (turning to face the jeep), then hop toward it, land, wait again.
  hop(z, now, s) {
    if (!z.jump) {
      z.lift = 0;
      if (!z.jumpAt) z.jumpAt = now + JUMP_WAIT_MS * between(0.5, 1.2);
      const j = this.closestJeep(z.x, z.y);
      if (now < z.jumpAt || !j) return;
      const d = Math.min(JUMP_DIST, Math.hypot(j.x - z.x, j.y - z.y) + 40);
      z.heading = Math.atan2(j.x - z.x, -(j.y - z.y));
      z.jump = { start: now, vx: Math.sin(z.heading) * d / JUMP_MS, vy: -Math.cos(z.heading) * d / JUMP_MS };
      z.model.play('jump', 0.85);
      return;
    }
    const t = Math.min(1, (now - z.jump.start) / JUMP_MS);
    this.moveBy(z, z.r, z.jump.vx * s * 1000, z.jump.vy * s * 1000);
    z.lift = Math.sin(t * Math.PI) * JUMP_HEIGHT;
    if (t >= 1) {
      z.jump = null;
      z.lift = 0;
      z.jumpAt = now + JUMP_WAIT_MS;
      z.model.play('idle');
      this.world.burst(z.x, z.y, { count: 5, color: '#c9a66b', size: [5, 10], dist: [20, 45], ms: 300, h: 0 });
    }
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
        this.moveBy(a, a.r, (dx / d) * push, (dy / d) * push);
        this.moveBy(b, b.r, -(dx / d) * push, -(dy / d) * push);
      }
    }
  }

  // ---------- The gun turrets ----------

  // Swing a jeep's gun toward the closest zombie in range, and fire when lined up.
  aimTurret(j, now, s) {
    const w = WEAPONS[j.weapon];
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
      const fireEvery = w.ms * (this.hasBoost(j, 'rapid', now) ? RAPID_FACTOR : 1);
      if (Math.abs(diff) < 0.12 && now - j.lastShot > fireEvery) {
        this.fire(j, now);
        j.lastShot = now;
      }
    }
    // The gun sits on the jeep, so its turn is measured from the jeep's heading.
    j.model.turret.rotation.y = j.turretAim - j.heading;
  }

  fire(j, now) {
    const w = WEAPONS[j.weapon];
    const bx = j.x + Math.sin(j.turretAim) * 44; // the end of the barrel
    const by = j.y - Math.cos(j.turretAim) * 44;
    for (let i = 0; i < w.shots; i++) {
      const off = w.shots > 1 ? (i / (w.shots - 1) - 0.5) * w.spread : (Math.random() - 0.5) * w.spread;
      const a = j.turretAim + off;
      const dx = Math.sin(a);
      const dy = -Math.cos(a);
      const mesh = BABYLON.MeshBuilder.CreateSphere('shot', { diameter: w.size * 2, segments: 6 }, this.world.scene);
      mesh.material = glowMaterial(this.world.scene, w.color);
      mesh.parent = this.root;
      if (w.pierce) { // laser bolts are long and thin
        mesh.scaling.z = 4;
        mesh.rotation.y = a;
      }
      mesh.position.copyFrom(this.world.at(bx, by, 50));
      this.shots.push({ x: bx, y: by, vx: dx * w.speed, vy: dy * w.speed, mesh, w, born: now, hit: new Set() });
    }
    this.world.burst(bx, by, { count: 4, color: w.color, size: [5, 9], dist: [10, 25], ms: 120, h: 50 });
  }

  // Bullets fly straight. Each hit takes `damage` off a zombie's hits; at 0 it's knocked out.
  moveShots(s, now) {
    const { W, H } = this.world;
    const cx = this.world.cameraX;
    const cy = this.world.cameraY;
    for (const shot of this.shots) {
      const { w } = shot;
      shot.x += shot.vx * s;
      shot.y += shot.vy * s;
      shot.mesh.position.copyFrom(this.world.at(shot.x, shot.y, 50));
      const hit = this.zombies.find((z) => !shot.hit.has(z) && Math.hypot(z.x - shot.x, z.y - shot.y) < z.r + w.size);
      if (hit) {
        if (w.blast) {
          shot.gone = true;
          this.explode(shot.x, shot.y, w, now);
        } else {
          this.hurtZombie(hit, w.damage, shot.vx, shot.vy, now);
          if (w.pierce) shot.hit.add(hit);
          else shot.gone = true;
        }
      } else if ((w.life && now - shot.born > w.life)
        || shot.x < cx - 50 || shot.x > cx + W + 50 || shot.y < cy - 50 || shot.y > cy + H + 50) {
        shot.gone = true;
      }
    }
    for (const shot of this.shots) if (shot.gone) shot.mesh.dispose();
    this.shots = this.shots.filter((shot) => !shot.gone);
  }

  // A rocket goes off: it hurts every zombie near the bang.
  explode(x, y, w, now) {
    this.world.burst(x, y, { count: 18, color: '#ff8a3d', size: [10, 22], dist: [40, w.blast], ms: 450, h: 30 });
    this.world.burst(x, y, { count: 8, color: '#ffe066', size: [8, 14], dist: [20, w.blast * 0.6], ms: 350, h: 30 });
    this.world.shake(180, 6);
    for (const z of [...this.zombies]) {
      if (Math.hypot(z.x - x, z.y - y) < w.blast + z.r) this.hurtZombie(z, w.damage, z.x - x, z.y - y, now);
    }
  }

  // Take `damage` hits off zombie z (pushed back along (vx, vy) if it's still up).
  hurtZombie(z, damage, vx, vy, now) {
    if (z.knockedOut) return;
    z.hits -= damage;
    if (z.hits <= 0) {
      z.knockedOut = true;
      this.knockOut(z);
      this.points += POINTS[z.kind];
      this.drawPoints();
      this.popText(z.x, z.y - 30, `+${POINTS[z.kind]}`, '#ffd84d', 28);
      if (z.kind === 'boss') this.bossDefeated(z, now);
      return;
    }
    // Still standing: flash, get knocked back a little (the boss doesn't budge).
    z.flashUntil = now + 90;
    setVisibility(z.model, 0.4);
    if (z.kind !== 'boss') {
      const len = Math.hypot(vx, vy) || 1;
      this.moveBy(z, z.r, (vx / len) * 14, (vy / len) * 14);
    }
    this.world.burst(z.x, z.y, { count: 3, color: '#7bd44a', size: [4, 8], dist: [15, 35], ms: 200 });
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
        if (p.kind === 'mines') j.nextMineAt = now + 400; // first one straight away
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
      ({ x, y } = this.spotInView(80));
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
    this.stopSteering(j);
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
    sub.textContent = `You made it to wave ${this.wave} · ⭐ ${this.points}`;
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
    wood: m('wood', '#9a6a35'),
    woodDark: m('woodDark', '#5e3d1d'),
    gold: m('gold', '#ffcc33', true),
    dozer: m('dozer', '#ffb81c'),
    mine: m('mine', '#4a4f3a'),
    mineLight: m('mineLight', '#ff3020', true),
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
function makeGround(game, area) {
  const { scene } = game.world;
  const { w, h } = area;
  // The sand and grass pictures are drawn once; each field gets its own
  // copy so it can repeat them the right number of times across its size.
  if (!game.sandTexture) {
    game.sandTexture = makeSandTexture(scene);
    game.grassTexture = makeGrassTexture(scene);
  }
  const sand = copyTexture(scene, game.sandTexture);
  sand.wrapU = sand.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
  sand.uScale = (w + 60) / SAND_TILE;
  sand.vScale = (h + 60) / SAND_TILE;
  const dirtMat = new BABYLON.StandardMaterial('dirt', scene);
  dirtMat.diffuseTexture = sand;
  dirtMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
  area.dirtMat = dirtMat;
  // (A little bigger than the field, so neighbouring fields overlap: no seam.)
  const dirt = BABYLON.MeshBuilder.CreateGround('dirtField', { width: w + 60, height: h + 60 }, scene);
  dirt.material = dirtMat;
  dirt.position.y = -12 - area.i * 0.2; // (neighbours overlap a little: keep them from flickering)
  dirt.parent = area.node;

  // Grass layer: the grass texture repeats across it, and a second
  // "where is there grass" picture makes it fade out toward the middle.
  const grass = copyTexture(scene, game.grassTexture);
  grass.wrapU = grass.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
  grass.uScale = w / GRASS_TILE;
  grass.vScale = h / GRASS_TILE;
  const mat = new BABYLON.StandardMaterial('grassLayer', scene);
  mat.diffuseTexture = grass;
  mat.opacityTexture = makeGrassMask(scene, w, h, area.gaps);
  mat.specularColor = BABYLON.Color3.Black();
  const layer = BABYLON.MeshBuilder.CreateGround('grassLayer', { width: w, height: h }, scene);
  layer.material = mat;
  layer.position.y = -11;
  layer.alphaIndex = 1;
  layer.parent = area.node;
  area.grassMat = mat;
}

// A copy of a drawn texture (Babylon's own clone() leaves the copy blank).
function copyTexture(scene, tex) {
  const { width, height } = tex.getSize();
  const copy = new BABYLON.DynamicTexture(tex.name, { width, height }, scene, true);
  copy.getContext().drawImage(tex.getContext().canvas, 0, 0);
  copy.update();
  return copy;
}

// A path just opened in this field: redraw its grass and shade with a dirt
// track through the gap.
function redrawGrass(game, area) {
  const { scene } = game.world;
  const oldMask = area.grassMat.opacityTexture;
  area.grassMat.opacityTexture = makeGrassMask(scene, area.w, area.h, area.gaps);
  oldMask.dispose();
  const oldShade = area.shadeMat.diffuseTexture;
  area.shadeMat.diffuseTexture = makeShadeTexture(scene, area.w, area.h, area.gaps);
  oldShade.dispose();
}

// Is the spot (x, y) in a field (measured from its top-left) by this path
// through its trees? `extra` widens the check a little.
function inGap(area, gap, x, y, extra) {
  const along = gap.side === 'left' || gap.side === 'right' ? y : x;
  if (Math.abs(along - gap.at) > GAP_HALF + extra) return false;
  if (gap.side === 'left') return x < 150;
  if (gap.side === 'right') return x > area.w - 150;
  if (gap.side === 'top') return y < 150;
  return y > area.h - 150;
}

// Rub out the grass (or shade) where paths go through the trees, with soft
// edges. S = picture size, w/h = field size, bx/by = how deep to rub out.
function cutPaths(ctx, S, w, h, gaps, bx, by) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (const g of gaps) {
    const vertical = g.side === 'left' || g.side === 'right';
    const len = vertical ? h : w;
    const a = S * (g.at - GAP_HALF * 0.85) / len;
    const b = S * (g.at + GAP_HALF * 0.85) / len;
    const grad = vertical ? ctx.createLinearGradient(0, a, 0, b) : ctx.createLinearGradient(a, 0, b, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.25, 'rgba(0,0,0,1)');
    grad.addColorStop(0.75, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    if (g.side === 'left') ctx.fillRect(0, a, bx, b - a);
    if (g.side === 'right') ctx.fillRect(S - bx, a, bx, b - a);
    if (g.side === 'top') ctx.fillRect(a, 0, b - a, by);
    if (g.side === 'bottom') ctx.fillRect(a, S - by, b - a, by);
  }
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
  cutPaths(ctx, S, W, H, gaps, bx * 1.05, by * 1.05);
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

function makeTracks(game, area) {
  const { scene } = game.world;
  const { w: W, h: H } = area;
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

  // Bulldozer blade on the front (only shown with the bulldozer potion):
  // a wide yellow blade with a dark edge, held on by two arms.
  const blade = new BABYLON.TransformNode('blade', scene);
  blade.parent = jeep;
  const plate = BABYLON.MeshBuilder.CreateBox('bladePlate', { width: 104, height: 30, depth: 9 }, scene);
  plate.material = M.dozer;
  plate.position.set(0, 16, 64);
  plate.rotation.x = -0.25; // tipped forward a little
  plate.parent = blade;
  const edge = BABYLON.MeshBuilder.CreateBox('bladeEdge', { width: 106, height: 6, depth: 11 }, scene);
  edge.material = M.gunDark;
  edge.position.set(0, 3, 67);
  edge.parent = blade;
  for (const x of [-26, 26]) {
    const arm = BABYLON.MeshBuilder.CreateBox('bladeArm', { width: 7, height: 7, depth: 26 }, scene);
    arm.material = M.gun;
    arm.position.set(x, 16, 50);
    arm.parent = blade;
  }
  blade.setEnabled(false);
  jeep.blade = blade;
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

function makeBorderTrees(game, area) {
  const { w: W, h: H } = area;
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
function makeEdgeShade(game, area) {
  const { scene } = game.world;
  const { w: W, h: H } = area;
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

  // Darker grass tufts near the edges (cleared away if a path opens there).
  for (let i = 0; i < 60; i++) {
    const side = Math.floor(Math.random() * 4);
    const d = between(10, GRASS_BAND * 0.7);
    const x = side === 0 ? d : side === 1 ? W - d : between(0, W);
    const y = side === 2 ? d : side === 3 ? H - d : between(0, H);
    if (side < 2 && (y < 0 || y > H)) continue;
    const tuft = BABYLON.MeshBuilder.CreateCylinder('tuft', { diameterTop: 0, diameterBottom: between(12, 22), height: 16, tessellation: 5 }, scene);
    tuft.material = game.mats.darkTuft;
    tuft.position.copyFrom(fieldSpot(W, H, x, y, -3));
    tuft.parent = area.node;
    area.tufts.push({ mesh: tuft, x, y });
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
  cutPaths(ctx, 256, W, H, gaps, bx * 1.1, by * 1.1);
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

// A land mine: a flat dark-green disc with a blinking red light on top.
function makeMine(game) {
  const { scene } = game.world;
  const mine = new BABYLON.TransformNode('mine', scene);
  mine.parent = game.root;
  const disc = BABYLON.MeshBuilder.CreateCylinder('mineDisc', { diameter: 32, height: 7, tessellation: 14 }, scene);
  disc.material = game.mats.mine;
  disc.position.y = 3.5;
  disc.parent = mine;
  const cap = BABYLON.MeshBuilder.CreateCylinder('mineCap', { diameter: 16, height: 4, tessellation: 12 }, scene);
  cap.material = game.mats.gunDark;
  cap.position.y = 9;
  cap.parent = mine;
  const light = BABYLON.MeshBuilder.CreateSphere('mineLight', { diameter: 7, segments: 6 }, scene);
  light.material = game.mats.mineLight;
  light.position.y = 12;
  light.parent = mine;
  mine.light = light;
  return mine;
}

// The weapon box: a wooden crate with dark bands and a glowing gold lid.
function makeBox(game) {
  const { scene } = game.world;
  const M = game.mats;
  const box = new BABYLON.TransformNode('weaponBox', scene);
  box.parent = game.root;
  const crate = BABYLON.MeshBuilder.CreateBox('crate', { width: 64, height: 42, depth: 64 }, scene);
  crate.material = M.wood;
  crate.position.y = 21;
  crate.parent = box;
  for (const x of [-22, 22]) {
    const band = BABYLON.MeshBuilder.CreateBox('band', { width: 8, height: 43, depth: 66 }, scene);
    band.material = M.woodDark;
    band.position.set(x, 21, 0);
    band.parent = box;
  }
  const lid = BABYLON.MeshBuilder.CreateBox('lid', { width: 68, height: 6, depth: 68 }, scene);
  lid.material = M.gold;
  lid.position.y = 45;
  lid.parent = box;
  return box;
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
  // jumper - skin A again, tinted purple, a little smaller. Crouches (idle), then jumps.
  jumper: { model: 'zombieA', height: 100, anim: 'idle', animSpeed: 1.4, shadow: 21, tint: new BABYLON.Color3(0.8, 0.55, 1.25) },
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
  if (info.tint) paintModel(body, (c) => c.multiply(info.tint));

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
  z.shadow = shadow;

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
const ARM_BOB_SPEED = { slow: 4, fast: 9, jumper: 6, boss: 3 }; // how quickly (bigger = faster)

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
  const lift = z.lift || 0; // (a jumper in mid-air: its shadow stays on the ground)
  z.model.position.copyFrom(game.world.at(z.x, z.y, -10 + lift));
  z.model.shadow.position.y = 0.6 - lift;
  z.model.shadow.scaling.setAll(1 - lift / (JUMP_HEIGHT * 2.5));
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
