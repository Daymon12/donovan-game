// The 3 bullet powers and what their bullets look like in 3D.
//
//   ⚡ Electric - a glowing yellow bolt:  zaps an asteroid, it turns yellow and slows down.
//   ❄ Freeze   - an ice crystal:          shatters a big asteroid into 4 small, light pieces.
//   🔥 Lava     - a fireball:              heats an asteroid red: it can't score until it cools.
//
// Every bullet has an outline in its ship's colour, so you can tell whose it is.
import { hex, glowMaterial } from './world.js';

export const POWERS = {
  electric: { icon: '⚡', color: '#ffe14d' },
  freeze:   { icon: '❄️', color: '#9be7ff' },
  lava:     { icon: '🔥', color: '#ff5a1f' },
};

const templates = new Map();

// A new bullet for this power, outlined in the ship's colour.
// The outline is a slightly bigger copy of the bullet, in the ship's colour,
// just underneath it (the camera looks straight down, so it shows as a rim).
export function makeBullet(scene, power, shipColor, size) {
  const key = scene.uid + power;
  if (!templates.has(key)) templates.set(key, makeTemplate(scene, power));
  const template = templates.get(key);

  const bullet = new BABYLON.TransformNode('bullet', scene);
  bullet.scaling.setAll(size);
  const core = template.clone('core', bullet);
  core.setEnabled(true);
  const rim = template.clone('rim', bullet);
  rim.setEnabled(true);
  rim.material = glowMaterial(scene, shipColor);
  rim.scaling.scaleInPlace(1.45);
  rim.position.y = -12;
  return bullet;
}

function makeTemplate(scene, power) {
  const mat = new BABYLON.StandardMaterial('bullet-' + power, scene);
  let mesh;
  if (power === 'electric') {
    // Long glowing bolt.
    mesh = BABYLON.MeshBuilder.CreateCapsule('electric', { radius: 7, height: 34, tessellation: 8 }, scene);
    mesh.rotation.x = Math.PI / 2; // lie flat, pointing up/down the screen
    mat.emissiveColor = hex('#d9a800');
    mat.disableLighting = true;
  } else if (power === 'freeze') {
    // Pointy ice crystal.
    mesh = BABYLON.MeshBuilder.CreatePolyhedron('freeze', { type: 1, size: 11 }, scene);
    mesh.scaling.set(1, 1, 1.6);
    mat.diffuseColor = hex('#dff8ff');
    mat.emissiveColor = hex('#6fc8ff');
    mat.specularColor = new BABYLON.Color3(1, 1, 1);
  } else {
    // Fireball.
    mesh = BABYLON.MeshBuilder.CreateSphere('lava', { diameter: 22, segments: 8 }, scene);
    mat.emissiveColor = hex('#e04000');
    mat.diffuseColor = hex('#ffb000');
  }
  mesh.material = mat;
  mesh.setEnabled(false);
  return mesh;
}
