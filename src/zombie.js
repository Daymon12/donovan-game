// Zombie Jeep: you drive a jeep, seen from above, on a grassy field.
//
//   - Hold your finger on the screen: the jeep drives toward your finger.
//   - Let go: the jeep stops.
//   - Zombies dig their way out of the ground (a hole opens, then a zombie
//     climbs out) and chase the jeep. Don't let one touch it!
//   - The longer you last, the more (and faster) zombies come.
//   - A gun turret on top of the jeep swings round by itself and shoots
//     the closest zombie (if it's near enough). One shot knocks a zombie out.
//
// The jeep and zombies are built from 3D blocks right here in code.
import { button, el } from './hud.js';
import { hex, glowMaterial } from './world.js';

const JEEP_TOP_SPEED = 300;    // pixels per second
const JEEP_TURN = 5;           // how fast it turns (radians per second)
const JEEP_BRAKE = 1400;       // how quickly it stops when you let go
const JEEP_RADIUS = 34;        // for bumping into zombies
const ZOMBIE_RADIUS = 24;
const FIRST_ZOMBIE_MS = 1200;  // first zombie arrives after this long
const SPAWN_START_MS = 2200;   // time between zombies at the start...
const SPAWN_FASTEST_MS = 650;  // ...getting quicker, down to this
const SPAWN_SPEEDUP = 0.96;    // each new zombie comes a little sooner
const ZOMBIE_SPEED = [40, 80]; // walking speed (slowest, fastest) at the start
const ZOMBIE_SPEED_GROWTH = 1;   // walking speed added per second survived
const ZOMBIE_TURN = 1.6;       // how fast a zombie turns to follow the jeep (radians/second);
                               // slower than the jeep, so quick swerves can lose them
const HOLE_MS = 900;           // a hole takes this long to open...
const CLIMB_MS = 900;          // ...then the zombie takes this long to climb out
const HOLE_STAYS_MS = 1500;    // the empty hole stays this long before closing
const HOLE_MIN_DISTANCE = 230; // holes never open closer than this to the jeep
const TURRET_RANGE = 380;      // the gun only shoots zombies this close (pixels)
const TURRET_TURN = 7;         // how fast the gun swings round (radians per second)
const TURRET_FIRE_MS = 650;    // time between shots
const SHOT_SPEED = 700;        // bullet speed (pixels per second)
const SHOT_RADIUS = 6;

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

    makeGround(this, W, H);

    // The jeep starts in the middle, pointing up.
    this.jeep = { x: W / 2, y: H / 2, heading: 0, speed: 0, model: makeJeep(this) };
    this.finger = null; // where the finger is (null = not touching)
    this.turretAim = 0;  // which way the gun points on screen (0 = up)
    this.lastShot = 0;
    this.shots = [];

    this.zombies = [];   // zombies out of the ground, chasing
    this.diggers = [];   // zombies still climbing out of their holes
    this.holes = [];     // empty holes waiting to close up
    this.started = performance.now();
    this.nextZombieAt = this.started + FIRST_ZOMBIE_MS;
    this.spawnEvery = SPAWN_START_MS;
    this.over = false;

    // Timer at the top: how long you've lasted.
    this.clock = el('div', 'zombie-clock');
    this.clock.style.left = `${W / 2}px`;
    this.clock.textContent = '0';
    ui.append(this.clock);

    button(ui, 70, 40, '◀ Back', onBack, { width: 110, height: 52, fontSize: 22 });

    this.setUpTouch();
    this.stopFrames = world.onFrame((now, dt) => this.update(now, dt));
    window.game = this; // for testing from the browser console
  }

  destroy() {
    this.destroyed = true;
    this.stopFrames();
    this.stopTouch();
    clearTimeout(this.timer);
    [this.sun.intensity, this.sky.intensity] = this.oldLight;
    this.root.dispose(false, false);
    for (const m of Object.values(this.mats)) m.dispose();
    this.ui.innerHTML = '';
  }

  // ---------- Touch: hold to drive, let go to stop ----------

  setUpTouch() {
    const { W, H } = this.world;
    const stage = document.getElementById('stage');
    let pointerId = null;
    const toBoard = (e) => {
      const r = stage.getBoundingClientRect();
      return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
    };
    const down = (e) => {
      if (pointerId !== null) return; // only one finger drives
      pointerId = e.pointerId;
      this.finger = toBoard(e);
    };
    const move = (e) => {
      if (e.pointerId === pointerId) this.finger = toBoard(e);
    };
    const up = (e) => {
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      this.finger = null;
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
    this.driveJeep(s);
    this.aimTurret(now, s);
    this.moveShots(s);

    // New zombies.
    if (now >= this.nextZombieAt) {
      this.spawnZombie(now);
      this.spawnEvery = Math.max(SPAWN_FASTEST_MS, this.spawnEvery * SPAWN_SPEEDUP);
      this.nextZombieAt = now + this.spawnEvery;
    }
    this.updateDiggers(now);

    // Move zombies: each one turns toward the jeep and shuffles after it.
    const j = this.jeep;
    for (const z of this.zombies) {
      const want = Math.atan2(j.x - z.x, -(j.y - z.y)); // direction to the jeep
      let diff = want - z.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest way round
      z.heading += Math.max(-ZOMBIE_TURN * s, Math.min(ZOMBIE_TURN * s, diff));
      z.x += Math.sin(z.heading) * z.speed * s;
      z.y -= Math.cos(z.heading) * z.speed * s;
    }
    this.spreadZombies();
    for (const z of this.zombies) {
      z.step += s * 7;
      z.model.rotation.y = z.heading;
      placeZombie(this, z);
      if (Math.hypot(z.x - j.x, z.y - j.y) < (JEEP_RADIUS + ZOMBIE_RADIUS) * 0.85) {
        this.crash(z, now);
        return;
      }
    }

    this.clock.textContent = String(Math.floor((now - this.started) / 1000));
  }

  driveJeep(s) {
    const j = this.jeep;
    const { W, H } = this.world;
    if (this.finger) {
      const dx = this.finger.x - j.x;
      const dy = this.finger.y - j.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 6) {
        // Turn toward the finger (heading 0 = up the screen, turning clockwise).
        const want = Math.atan2(dx, -dy);
        let diff = want - j.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest way round
        j.heading += Math.max(-JEEP_TURN * s, Math.min(JEEP_TURN * s, diff));
        // Speed up, but slow down when nearly at the finger.
        const want_speed = Math.min(JEEP_TOP_SPEED, dist * 4);
        j.speed += Math.max(-JEEP_BRAKE * s, Math.min(900 * s, want_speed - j.speed));
      } else {
        j.speed = Math.max(0, j.speed - JEEP_BRAKE * s);
      }
    } else {
      // Finger lifted: stop.
      j.speed = Math.max(0, j.speed - JEEP_BRAKE * s);
    }

    j.x += Math.sin(j.heading) * j.speed * s;
    j.y -= Math.cos(j.heading) * j.speed * s;
    j.x = Math.max(JEEP_RADIUS, Math.min(W - JEEP_RADIUS, j.x));
    j.y = Math.max(JEEP_RADIUS, Math.min(H - JEEP_RADIUS, j.y));

    j.model.position.copyFrom(this.world.at(j.x, j.y, 0));
    j.model.rotation.y = j.heading;
    // Wheels spin with speed.
    for (const w of j.model.wheels) w.rotation.x += j.speed * s / 12;
  }

  // A new zombie digs its way out somewhere on the field (never right next
  // to the jeep): first a hole opens, then the zombie climbs out of it.
  // It can't move, hurt the jeep or be shot until it's all the way out.
  spawnZombie(now) {
    const { W, H } = this.world;
    const j = this.jeep;
    let x;
    let y;
    for (let tries = 0; tries < 30; tries++) {
      x = between(60, W - 60);
      y = between(120, H - 60);
      if (Math.hypot(x - j.x, y - j.y) > HOLE_MIN_DISTANCE) break;
    }
    const seconds = (now - this.started) / 1000;
    const z = {
      x,
      y,
      heading: Math.atan2(j.x - x, -(j.y - y)), // already looking at the jeep
      speed: between(ZOMBIE_SPEED[0], ZOMBIE_SPEED[1]) + seconds * ZOMBIE_SPEED_GROWTH,
      step: Math.random() * 10,    // where it is in its shuffle
      born: now,
      model: makeZombie(this),
      hole: makeHole(this, x, y),
    };
    z.model.rotation.y = z.heading;
    z.model.setEnabled(false); // still underground
    this.diggers.push(z);
  }

  // Holes opening and zombies climbing out of them.
  updateDiggers(now) {
    for (const z of this.diggers) {
      const age = now - z.born;
      if (age < HOLE_MS) {
        // The hole opens up.
        const t = age / HOLE_MS;
        z.hole.scaling.set(t, 1, t);
        if (Math.random() < 0.3) this.world.burst(z.x, z.y, { count: 1, color: '#8a6a44', size: [4, 8], dist: [20, 40], ms: 300, h: 0 });
      } else if (age < HOLE_MS + CLIMB_MS) {
        // The zombie rises out of it.
        z.hole.scaling.set(1, 1, 1);
        z.model.setEnabled(true);
        const t = (age - HOLE_MS) / CLIMB_MS;
        z.step += 0.4; // wriggle its arms while climbing
        placeZombie(this, z);
        z.model.position.y = -10 - (1 - t) * 110;
        z.model.rotation.z = Math.sin(age / 60) * 0.12 * (1 - t);
      } else {
        // All the way out: it joins the chase.
        z.model.rotation.z = 0;
        z.out = true;
        this.world.burst(z.x, z.y, { count: 6, color: '#8a6a44', size: [6, 12], dist: [30, 60], ms: 350, h: 0 });
        this.holes.push({ mesh: z.hole, closeAt: now + HOLE_STAYS_MS });
        delete z.hole;
        this.zombies.push(z);
      }
    }
    this.diggers = this.diggers.filter((z) => !z.out);

    // Empty holes stay a little while, then close up.
    for (const h of this.holes) {
      if (now < h.closeAt) continue;
      const t = (now - h.closeAt) / 500;
      if (t >= 1) {
        h.mesh.dispose();
        h.gone = true;
      } else {
        h.mesh.scaling.set(1 - t, 1, 1 - t);
      }
    }
    this.holes = this.holes.filter((h) => !h.gone);
  }

  // ---------- The gun turret ----------

  // Swing the gun toward the closest zombie in range, and fire when lined up.
  aimTurret(now, s) {
    const j = this.jeep;
    let target = null;
    let best = TURRET_RANGE;
    for (const z of this.zombies) {
      const d = Math.hypot(z.x - j.x, z.y - j.y);
      if (d < best) { best = d; target = z; }
    }
    if (target) {
      const want = Math.atan2(target.x - j.x, -(target.y - j.y));
      let diff = want - this.turretAim;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.turretAim += Math.max(-TURRET_TURN * s, Math.min(TURRET_TURN * s, diff));
      if (Math.abs(diff) < 0.12 && now - this.lastShot > TURRET_FIRE_MS) {
        this.fire();
        this.lastShot = now;
      }
    }
    // The gun sits on the jeep, so its turn is measured from the jeep's heading.
    j.model.turret.rotation.y = this.turretAim - j.heading;
  }

  fire() {
    const j = this.jeep;
    const dx = Math.sin(this.turretAim);
    const dy = -Math.cos(this.turretAim);
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

  // Bullets fly straight; one hit knocks a zombie out.
  moveShots(s) {
    const { W, H } = this.world;
    for (const shot of this.shots) {
      shot.x += shot.vx * s;
      shot.y += shot.vy * s;
      shot.mesh.position.copyFrom(this.world.at(shot.x, shot.y, 50));
      const hit = this.zombies.find((z) => Math.hypot(z.x - shot.x, z.y - shot.y) < ZOMBIE_RADIUS + SHOT_RADIUS);
      if (hit) {
        shot.gone = true;
        this.knockOut(hit);
      } else if (shot.x < -50 || shot.x > W + 50 || shot.y < -50 || shot.y > H + 50) {
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

  // Zombies push each other apart so they don't all pile into one blob.
  spreadZombies() {
    const gap = ZOMBIE_RADIUS * 2;
    for (let i = 0; i < this.zombies.length; i++) {
      for (let k = i + 1; k < this.zombies.length; k++) {
        const a = this.zombies[i];
        const b = this.zombies[k];
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

  crash(zombie, now) {
    this.over = true;
    this.finger = null;
    const j = this.jeep;
    this.world.burst((j.x + zombie.x) / 2, (j.y + zombie.y) / 2, { count: 14, color: '#7bd44a', size: [8, 18], dist: [50, 140], ms: 650 });
    this.world.burst(j.x, j.y, { count: 8, color: '#ffd84d', size: [8, 14], dist: [30, 100], ms: 500 });
    this.world.shake(350, 12);
    const seconds = Math.floor((now - this.started) / 1000);
    this.timer = setTimeout(() => this.showGameOver(seconds), 700);
  }

  showGameOver(seconds) {
    if (this.destroyed) return;
    const { W, H } = this.world;
    const box = el('div', 'winner');
    box.style.top = `${H / 2 - 70}px`;
    const title = el('div', 'winner-title');
    title.textContent = 'Zombie got you!';
    title.style.color = '#ff4d3c';
    const sub = el('div', 'winner-sub');
    sub.textContent = `You lasted ${seconds} second${seconds === 1 ? '' : 's'}`;
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
    dirt: m('dirt', '#8a6a44'),
    tuft: m('tuft', '#3f7a2e'),
    jeep: m('jeep', '#6f8f3c'),
    jeepDark: m('jeepDark', '#4f6a2a'),
    tire: m('tire', '#1e1e22'),
    glass: m('glass', '#9fd4ff'),
    seat: m('seat', '#5a3b22'),
    light: m('light', '#fff2a0', true),
    gun: m('gun', '#6b6f78'),
    gunDark: m('gunDark', '#3a3d44'),
    skin: m('skin', '#7bd44a'),
    shirt: m('shirt', '#5a6fb0'),
    pants: m('pants', '#5a4a3a'),
    eye: m('eye', '#1a1a1a'),
    hole: m('hole', '#2a1a0e'),
  };
}

// A grassy field with dirt patches and tufts of grass.
function makeGround(game, W, H) {
  const { scene } = game.world;
  const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: W + 60, height: H + 60 }, scene);
  ground.material = game.mats.grass;
  ground.position.y = -10;
  ground.parent = game.root;
  for (let i = 0; i < 14; i++) {
    const patch = BABYLON.MeshBuilder.CreateCylinder('dirt', { diameter: between(60, 160), height: 1, tessellation: 10 }, scene);
    patch.material = game.mats.dirt;
    patch.scaling.z = between(0.5, 1);
    patch.rotation.y = Math.random() * Math.PI;
    patch.position.copyFrom(game.world.at(between(0, W), between(0, H), -9));
    patch.parent = game.root;
  }
  for (let i = 0; i < 40; i++) {
    const tuft = BABYLON.MeshBuilder.CreateCylinder('tuft', { diameterTop: 0, diameterBottom: between(10, 18), height: 14, tessellation: 5 }, scene);
    tuft.material = game.mats.tuft;
    tuft.position.copyFrom(game.world.at(between(0, W), between(0, H), -3));
    tuft.parent = game.root;
  }
}

// The jeep: about 60 wide and 96 long. Its front points up the screen (+z).
function makeJeep(game) {
  const { scene } = game.world;
  const M = game.mats;
  const jeep = new BABYLON.TransformNode('jeep', scene);
  jeep.parent = game.root;
  const box = (name, mat, w, h, d, x, y, z) => {
    const b = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    b.material = mat;
    b.position.set(x, y, z);
    b.parent = jeep;
    return b;
  };
  box('body', M.jeep, 54, 22, 92, 0, 16, 0);
  box('hood', M.jeepDark, 50, 4, 30, 0, 29, 28);      // bonnet at the front
  box('windshield', M.glass, 50, 16, 4, 0, 36, 12);    // glass in front of the seats
  box('seatL', M.seat, 18, 8, 16, -12, 30, -2);
  box('seatR', M.seat, 18, 8, 16, 12, 30, -2);
  box('bench', M.seat, 44, 8, 14, 0, 30, -24);
  box('bumper', M.tire, 58, 8, 6, 0, 10, 47);
  box('lightL', M.light, 12, 8, 3, -18, 22, 46.5);
  box('lightR', M.light, 12, 8, 3, 18, 22, 46.5);
  // Spare tyre on the back.
  const spare = BABYLON.MeshBuilder.CreateCylinder('spare', { diameter: 26, height: 8, tessellation: 14 }, scene);
  spare.material = M.tire;
  spare.rotation.x = Math.PI / 2;
  spare.position.set(0, 26, -49);
  spare.parent = jeep;
  // Gun turret on top, behind the front seats: a round base and a long barrel.
  // (The game turns it to aim; it points forward to start with.)
  const turret = new BABYLON.TransformNode('turret', scene);
  turret.parent = jeep;
  turret.position.set(0, 40, -12);
  const base = BABYLON.MeshBuilder.CreateCylinder('turretBase', { diameter: 28, height: 10, tessellation: 16 }, scene);
  base.material = M.gun;
  base.parent = turret;
  const top = box('turretTop', M.gunDark, 16, 10, 18, 0, 8, 0);
  top.parent = turret;
  top.position.set(0, 8, 0);
  const barrel = box('barrel', M.gunDark, 6, 6, 36, 0, 0, 0);
  barrel.parent = turret;
  barrel.position.set(0, 9, 22);
  jeep.turret = turret;
  // 4 wheels.
  jeep.wheels = [];
  for (const [x, z] of [[-30, 28], [30, 28], [-30, -28], [30, -28]]) {
    const w = BABYLON.MeshBuilder.CreateCylinder('wheel', { diameter: 26, height: 12, tessellation: 14 }, scene);
    w.material = M.tire;
    w.rotation.z = Math.PI / 2; // roll forward
    w.position.set(x, 13, z);
    const hub = new BABYLON.TransformNode('hub', scene);
    hub.parent = jeep;
    w.parent = hub;
    jeep.wheels.push(w);
  }
  return jeep;
}

// A hole in the ground: a dark pit with a ring of dug-up dirt round it.
// Starts closed (scale 0); the game opens it up.
function makeHole(game, x, y) {
  const { scene } = game.world;
  const hole = new BABYLON.TransformNode('hole', scene);
  hole.parent = game.root;
  hole.position.copyFrom(game.world.at(x, y, -9));
  const ring = BABYLON.MeshBuilder.CreateCylinder('holeRing', { diameter: 86, height: 4, tessellation: 12 }, scene);
  ring.material = game.mats.dirt;
  ring.parent = hole;
  const pit = BABYLON.MeshBuilder.CreateCylinder('pit', { diameter: 60, height: 2, tessellation: 12 }, scene);
  pit.material = game.mats.hole;
  pit.position.y = 2.5;
  pit.parent = hole;
  // A few clumps of dirt thrown out round the edge.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
    const clump = BABYLON.MeshBuilder.CreateBox('clump', { size: between(8, 14) }, scene);
    clump.material = game.mats.dirt;
    clump.position.set(Math.cos(a) * 48, 3, Math.sin(a) * 48);
    clump.rotation.y = Math.random() * Math.PI;
    clump.parent = hole;
  }
  hole.scaling.set(0, 1, 0);
  return hole;
}

// A blocky zombie, arms stretched out in front. Faces +z (we turn it to walk).
function makeZombie(game) {
  const { scene } = game.world;
  const M = game.mats;
  const z = new BABYLON.TransformNode('zombie', scene);
  z.parent = game.root;
  const box = (name, mat, w, h, d, x, y, zz, parent = z) => {
    const b = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    b.material = mat;
    b.position.set(x, y, zz);
    b.parent = parent;
    return b;
  };
  z.legs = [box('legL', M.pants, 9, 22, 9, -6, 11, 0), box('legR', M.pants, 9, 22, 9, 6, 11, 0)];
  box('body', M.shirt, 26, 26, 14, 0, 35, 0);
  const head = box('head', M.skin, 18, 18, 18, 0, 57, 0);
  box('eyeL', M.eye, 4, 4, 2, -4, 59, 9.5);
  box('eyeR', M.eye, 4, 4, 2, 4, 59, 9.5);
  z.head = head;
  // Arms reaching forward.
  z.arms = [box('armL', M.skin, 7, 7, 24, -16, 42, 12), box('armR', M.skin, 7, 7, 24, 16, 42, 12)];
  z.scaling.setAll(1.7);
  return z;
}

// Put a zombie in place and make it shuffle.
function placeZombie(game, z) {
  z.model.position.copyFrom(game.world.at(z.x, z.y, -10));
  const swing = Math.sin(z.step);
  z.model.legs[0].position.z = swing * 5;
  z.model.legs[1].position.z = -swing * 5;
  z.model.arms[0].position.z = 12 + swing * 3;
  z.model.arms[1].position.z = 12 - swing * 3;
  z.model.head.rotation.z = Math.sin(z.step * 0.5) * 0.25; // head lolls side to side
}

function between(a, b) {
  return a + Math.random() * (b - a);
}
