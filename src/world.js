// The 3D world, built with Babylon.js.
//
// The camera looks straight down at the board, so the game still plays
// like before (flat, top vs bottom), but everything is a real 3D model
// with light and shading.
//
// The game logic works in "board" pixels, just like the screen:
// x goes right, y goes down, (0, 0) is the top-left corner.
// world.at(x, y) turns a board spot into a 3D position.

const MODEL_DIR = 'assets/kenney/';
const MODELS = {
  ship: 'craft_speederA.glb',     // Kenney Space Kit (CC0)
  rock: 'meteor_detailed.glb',
  piece: 'meteor.glb',
  suv: 'cars/suv.glb',            // Kenney Car Kit (CC0) - the jeep
  zombieA: 'zombies/zombie-a.glb', // Kenney Animated Characters Survivors (CC0) - slow zombie
  zombieC: 'zombies/zombie-c.glb', //   ...other skin - fast zombie
  boss: 'graveyard/character-zombie.glb', // Kenney Graveyard Kit (CC0) - boss zombie
  pine: 'graveyard/pine.glb',     //   ...trees round the edge of the field
  pineCrooked: 'graveyard/pine-crooked.glb',
};

export async function createWorld(canvas, W, H) {
  const engine = new BABYLON.Engine(canvas, true, { stencil: true, antialias: true }, true);
  // Sharp on the iPad's retina screen, but never more than 2x (keeps it smooth).
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));

  const scene = new BABYLON.Scene(engine);
  scene.clearColor = BABYLON.Color4.FromHexString('#0f1230ff');

  // Camera high above, looking straight down. Orthographic = no perspective,
  // so 1 world unit = 1 board pixel everywhere on screen.
  const camera = new BABYLON.FreeCamera('camera', new BABYLON.Vector3(0, 1000, 0), scene);
  camera.rotation.x = Math.PI / 2;
  camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
  camera.orthoLeft = -W / 2;
  camera.orthoRight = W / 2;
  camera.orthoTop = H / 2;
  camera.orthoBottom = -H / 2;
  camera.minZ = 1;
  camera.maxZ = 3000;

  // Soft light from everywhere + a "sun" from the top-left for shading.
  const sky = new BABYLON.HemisphericLight('sky', new BABYLON.Vector3(0.2, 1, 0.3), scene);
  sky.intensity = 0.8;
  sky.groundColor = new BABYLON.Color3(0.25, 0.25, 0.45);
  const sun = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-0.5, -1, 0.6), scene);
  sun.intensity = 1.8;

  // Glow: anything with an "emissive" (light-giving) colour glows a little.
  const glow = new BABYLON.GlowLayer('glow', scene, { mainTextureSamples: 2 });
  glow.intensity = 0.7;

  makeStars(scene, W, H);

  const models = {};
  for (const [name, file] of Object.entries(MODELS)) {
    models[name] = await loadModel(scene, file);
  }

  const world = {
    engine, scene, camera, W, H,

    // Where the board's left edge is in the 3D world, and where the camera
    // is looking (Zombie Jeep slides these over when you drive into a new area).
    originX: 0,
    cameraX: 0,

    // Board spot (x, y) -> 3D position. h = height above the board.
    at(x, y, h = 0) {
      return new BABYLON.Vector3(x + world.originX - W / 2, h, H / 2 - y);
    },

    // A fresh copy of a Kenney model, centred, `size` pixels across
    // (or `size` pixels tall with { by: 'height' }, for characters).
    // Each copy has its own colours, so it can be painted on its own.
    // Animated models get pivot.anims = { run: AnimationGroup, ... }.
    spawn(name, size, { by = 'across' } = {}) {
      const m = models[name];
      const copy = m.container.instantiateModelsToScene((n) => n, true, { doNotInstantiate: true });
      const root = copy.rootNodes[0];
      const pivot = new BABYLON.TransformNode(name, scene);
      root.parent = pivot;
      if (by === 'height') {
        // Characters stand on the ground: centre them sideways only.
        root.position.subtractInPlace(new BABYLON.Vector3(m.center.x, m.min.y, m.center.z));
      } else {
        root.position.subtractInPlace(m.center);
      }
      pivot.scaling.setAll(size / (by === 'height' ? m.size.y : m.across));
      pivot.anims = {};
      for (const g of copy.animationGroups) {
        g.stop();
        pivot.anims[g.name.replace(/^Clone of /, '')] = g;
      }
      pivot.onDisposeObservable.add(() => copy.animationGroups.forEach((g) => g.dispose()));
      return pivot;
    },

    // Things to run every frame: fn(now, dtMs). Returns a function that stops it.
    onFrame(fn) {
      const o = scene.onBeforeRenderObservable.add(() => {
        fn(performance.now(), Math.min(engine.getDeltaTime(), 50));
      });
      return () => scene.onBeforeRenderObservable.remove(o);
    },

    // Run fn(t) for `ms` milliseconds, t going 0 -> 1, then call done.
    animate(ms, fn, done) {
      const start = performance.now();
      const stop = world.onFrame((now) => {
        const t = Math.min(1, (now - start) / ms);
        fn(t);
        if (t >= 1) {
          stop();
          if (done) done();
        }
      });
    },

    // Little glowing balls flying out from (x, y): explosions, ice, sparks.
    burst(x, y, { count = 10, color = '#ffffff', size = [6, 14], dist = [50, 120], ms = 500, h = 30 }) {
      const mat = glowMaterial(scene, color);
      for (let i = 0; i < count; i++) {
        const ball = BABYLON.MeshBuilder.CreateSphere('spark', { diameter: 1, segments: 4 }, scene);
        ball.material = mat;
        const s = between(size[0], size[1]);
        ball.scaling.setAll(s);
        const a = Math.random() * Math.PI * 2;
        const d = between(dist[0], dist[1]);
        const from = world.at(x, y, h);
        const to = world.at(x + Math.cos(a) * d, y + Math.sin(a) * d, h);
        world.animate(ms, (t) => {
          const e = 1 - Math.pow(1 - t, 3); // fast, then slowing down
          BABYLON.Vector3.LerpToRef(from, to, e, ball.position);
          ball.visibility = 1 - t;
          ball.scaling.setAll(s * (1 - 0.7 * t));
        }, () => ball.dispose());
      }
    },

    // Wobble the camera for a moment (big hits and explosions).
    shake(ms = 250, amount = 8) {
      world.animate(ms, (t) => {
        const k = amount * (1 - t);
        camera.position.x = world.cameraX + (Math.random() - 0.5) * 2 * k;
        camera.position.z = (Math.random() - 0.5) * 2 * k;
      }, () => { camera.position.x = world.cameraX; camera.position.z = 0; });
    },
  };

  engine.runRenderLoop(() => scene.render());
  window.addEventListener('resize', () => engine.resize());
  return world;
}

// ---------- Colours ----------

// Paint every part of a model. fn(originalColour) returns the new colour.
export function paint(node, fn) {
  for (const mat of materialsOf(node)) {
    const key = mat.albedoColor ? 'albedoColor' : 'diffuseColor';
    if (!mat._original) mat._original = mat[key].clone();
    mat[key].copyFrom(fn(mat._original));
  }
}

// Make a whole model give off light of this colour (0 = none).
export function setGlow(node, color, strength) {
  for (const mat of materialsOf(node)) {
    if (!mat.emissiveColor) continue;
    mat.emissiveColor.copyFrom(color).scaleInPlace(strength);
  }
}

// Show / hide a whole model, or make it see-through (0..1).
export function setVisibility(node, v) {
  for (const mesh of node.getChildMeshes()) mesh.visibility = v;
}

export function hex(color) {
  return BABYLON.Color3.FromHexString(color);
}

const glowMaterials = {};
export function glowMaterial(scene, color) {
  if (!glowMaterials[color]) {
    const m = new BABYLON.StandardMaterial('glow-' + color, scene);
    m.emissiveColor = hex(color);
    m.diffuseColor = BABYLON.Color3.Black();
    m.disableLighting = true;
    glowMaterials[color] = m;
  }
  return glowMaterials[color];
}

// ---------- Helpers ----------

function materialsOf(node) {
  const mats = new Set();
  for (const mesh of node.getChildMeshes()) if (mesh.material) mats.add(mesh.material);
  return mats;
}

function between(a, b) {
  return a + Math.random() * (b - a);
}

// Load a model file once, and measure it so copies can be centred and sized.
async function loadModel(scene, file) {
  const container = BABYLON.LoadAssetContainerAsync
    ? await BABYLON.LoadAssetContainerAsync(MODEL_DIR + file, scene)
    : await BABYLON.SceneLoader.LoadAssetContainerAsync(MODEL_DIR, file, scene);
  const probe = container.instantiateModelsToScene((n) => n, false, { doNotInstantiate: true });
  const { min, max } = probe.rootNodes[0].getHierarchyBoundingVectors(true);
  probe.dispose();
  const size = max.subtract(min);
  return {
    container,
    min,
    center: min.add(max).scale(0.5),
    across: Math.max(size.x, size.z), // widest side seen from above
    size,
  };
}

// A field of little stars far below the board.
function makeStars(scene, W, H) {
  const star = BABYLON.MeshBuilder.CreateSphere('star', { diameter: 1, segments: 3 }, scene);
  const m = new BABYLON.StandardMaterial('star', scene);
  m.emissiveColor = new BABYLON.Color3(0.85, 0.88, 1);
  m.disableLighting = true;
  star.material = m;
  star.isVisible = false;
  for (let i = 0; i < 140; i++) {
    const s = star.createInstance('star' + i);
    s.position.set(between(-W / 2, W / 2), -500, between(-H / 2, H / 2));
    s.scaling.setAll(between(1.5, 4));
  }
}
