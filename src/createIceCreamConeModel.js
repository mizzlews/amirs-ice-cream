import * as THREE from '../vendor/three.module.js';

// Procedural reconstruction of the cone in assets/ice-cream-cone-with-spoon.jpg.
// Code only: no meshes, textures or art packs are loaded. See object-sculpt-spec.json.

// --- deterministic value noise ------------------------------------------------

function hash3(x, y, z) {
  let h = x * 374761393 + y * 668265263 + z * 2147483647;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

const fade = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), xf);
  const x10 = lerp(c(0, 1, 0), c(1, 1, 0), xf);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), xf);
  const x11 = lerp(c(0, 1, 1), c(1, 1, 1), xf);
  return lerp(lerp(x00, x10, yf), lerp(x01, x11, yf), zf) * 2 - 1;
}

// --- the cone -----------------------------------------------------------------

const triWave = (x) => {
  const f = x - Math.floor(x);
  return 1 - Math.abs(2 * f - 1);
};

// Diamond lattice: the crest of two counter-running triangle waves.
function waffle(u, v) {
  const a = fade(triWave(u * 18 + v * 14));
  const b = fade(triWave(u * 18 - v * 14));
  return Math.max(a, b);
}

const VALLEY = new THREE.Color('#e8c389');
const CREST = new THREE.Color('#c0792f');

function buildConeGeometry(radialSeg = 128, heightSeg = 52, topRadius = 1, height = 2.95) {
  const position = [], colour = [], index = [];
  const c = new THREE.Color();
  for (let j = 0; j <= heightSeg; j++) {
    const v = j / heightSeg;
    const y = -v * height;
    const baseR = lerp(topRadius, 0.035, Math.pow(v, 0.92));
    for (let i = 0; i <= radialSeg; i++) {
      const u = i / radialSeg;
      const th = u * Math.PI * 2;
      const ridge = waffle(u, v);
      const relief = 0.055 * (1 - Math.pow(v, 2.6));
      const r = baseR * (1 + ridge * relief);
      position.push(Math.cos(th) * r, y, Math.sin(th) * r);
      c.copy(VALLEY).lerp(CREST, ridge * 0.85).multiplyScalar(0.94 + 0.1 * (1 - v));
      colour.push(c.r, c.g, c.b);
    }
  }
  const row = radialSeg + 1;
  for (let j = 0; j < heightSeg; j++) {
    for (let i = 0; i < radialSeg; i++) {
      const a = j * row + i, b = a + 1, d = a + row, e = d + 1;
      index.push(a, d, b, b, d, e);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colour, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

// --- the rim frill ------------------------------------------------------------

function buildFrillGeometry(radialSeg = 220, rings = 7, innerR = 0.985) {
  const position = [], colour = [], index = [];
  const inner = new THREE.Color('#ecd9b4');
  const outer = new THREE.Color('#c98a46');
  const c = new THREE.Color();
  for (let j = 0; j <= rings; j++) {
    const t = j / rings;
    for (let i = 0; i <= radialSeg; i++) {
      const u = i / radialSeg;
      const th = u * Math.PI * 2;
      const scallop = 1 + 0.055 * Math.sin(th * 9) + 0.02 * Math.sin(th * 23 + 0.8);
      const r = lerp(innerR, 1.31 * scallop, t);
      const y = t * (0.1 + 0.075 * Math.sin(th * 7 + 0.4) + 0.03 * Math.sin(th * 13 + 1.2));
      position.push(Math.cos(th) * r, y, Math.sin(th) * r);
      c.copy(inner).lerp(outer, Math.pow(t, 1.4));
      colour.push(c.r, c.g, c.b);
    }
  }
  const row = radialSeg + 1;
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < radialSeg; i++) {
      const a = j * row + i, b = a + 1, d = a + row, e = d + 1;
      index.push(a, d, b, b, d, e);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colour, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

// --- the scoops ---------------------------------------------------------------

function buildScoopGeometry(detail, seed, flatten, tear) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const d = 1
      + 0.17 * tear * noise3(v.x * 2.1 + seed, v.y * 2.1 + seed, v.z * 2.1 - seed)
      + 0.085 * tear * noise3(v.x * 4.4 - seed, v.y * 4.4 + seed * 2, v.z * 4.4 + seed)
      + 0.04 * tear * noise3(v.x * 9.3 + seed * 3, v.y * 9.3 - seed, v.z * 9.3 + seed * 2);
    v.multiplyScalar(d);
    v.y *= flatten;
    // one scoop-tool shear, and a lip that overhangs on -x
    v.x += 0.07 * v.y;
    if (v.y < -0.1) v.x -= 0.06 * (v.y + 0.1);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const count = pos.count;
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
  return g;
}

// Ribbon swirls written into the colour attribute, so a flavour change is one buffer write.
function paintScoop(geometry, flavour) {
  const base = new THREE.Color(flavour.base);
  const ribbon = new THREE.Color(flavour.ribbon ?? flavour.base);
  const pos = geometry.attributes.position;
  const col = geometry.attributes.color;
  const v = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const n = noise3(v.x * 3.3 + 7.1, v.y * 3.3 - 2.4, v.z * 3.3 + 5.6);
    const t = Math.max(0, Math.min(1, (n + 0.15) * 1.9));
    c.copy(base).lerp(ribbon, fade(t) * (flavour.ribbon ? 0.85 : 0));
    const shade = 0.96 + 0.08 * noise3(v.x * 11, v.y * 11, v.z * 11);
    c.multiplyScalar(shade);
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
}

// --- inclusions ---------------------------------------------------------------

function buildInclusions(scoopGeometry, max = 90) {
  const g = new THREE.DodecahedronGeometry(1, 0);
  const m = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
  const mesh = new THREE.InstancedMesh(g, m, max);
  mesh.frustumCulled = false;
  const pos = scoopGeometry.attributes.position;
  const dummy = new THREE.Object3D();
  const v = new THREE.Vector3();
  for (let i = 0; i < max; i++) {
    const idx = Math.floor(hash3(i * 13 + 1, i * 7 + 3, 11) * pos.count);
    v.fromBufferAttribute(pos, idx);
    if (v.y < -0.25) v.y = -0.25;
    dummy.position.copy(v).multiplyScalar(0.965);
    dummy.rotation.set(hash3(i, 1, 2) * 6.28, hash3(i, 2, 3) * 6.28, hash3(i, 3, 4) * 6.28);
    const s = 0.032 + hash3(i, 5, 6) * 0.03;
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

// --- drips --------------------------------------------------------------------

function buildDrips() {
  const group = new THREE.Group();
  const runs = [
    { th: 2.1, len: 0.74, r: 0.055 },
    { th: 4.0, len: 0.46, r: 0.044 },
    { th: 5.6, len: 0.58, r: 0.05 }
  ];
  for (const run of runs) {
    const points = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const y = 0.06 - t * run.len;
      const radius = lerp(1.02, 1.02 - t * 0.3, t) + 0.015 * Math.sin(t * 5);
      const th = run.th + 0.12 * t;
      points.push(new THREE.Vector3(Math.cos(th) * radius, y, Math.sin(th) * radius));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(curve, 22, run.r, 10, false);
    const mesh = new THREE.Mesh(geometry, null);
    mesh.scale.y = 0.15;
    group.add(mesh);
  }
  return group;
}

// --- the model ----------------------------------------------------------------

export const FLAVOURS = [
  { id: 'burnt-honey', name: 'Burnt honey & sesame', base: '#e8c87d', ribbon: '#a8721f', bits: '#d9c9a0' },
  { id: 'pistachio', name: 'Pistachio, twice roasted', base: '#b9c178', ribbon: null, bits: '#6f7f3a' },
  { id: 'sour-cherry', name: 'Sour cherry sorbet', base: '#c2384a', ribbon: '#7d1526', bits: null },
  { id: 'malted-milk', name: 'Malted milk', base: '#efe0c4', ribbon: '#c49a5e', bits: '#9a7042' },
  { id: 'cardamom', name: 'Cardamom cream', base: '#efe6cf', ribbon: '#b9a06a', bits: null },
  { id: 'dark-chocolate', name: 'Dark chocolate sorbet', base: '#4a2a21', ribbon: '#2a1611', bits: null },
  { id: 'strawberry-pepper', name: 'Strawberry & black pepper', base: '#e7a2a4', ribbon: '#b94b55', bits: '#3a3330' },
  { id: 'salt-caramel', name: 'Salt caramel', base: '#dca864', ribbon: '#8f5420', bits: '#f0e6d2' }
];

export function createIceCreamConeModel({ detail = 5 } = {}) {
  const root = new THREE.Group();
  root.name = 'amirsCone';

  const waffleMaterial = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.74, metalness: 0, clearcoat: 0.05, clearcoatRoughness: 0.8,
    side: THREE.DoubleSide
  });
  const creamMaterial = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.6, metalness: 0, clearcoat: 0.09, clearcoatRoughness: 0.45,
    sheen: 0.55, sheenRoughness: 0.7, sheenColor: new THREE.Color('#fff2e2')
  });

  const cone = new THREE.Mesh(buildConeGeometry(), waffleMaterial);
  cone.name = 'cone';
  cone.userData.partId = 'cone';

  const frill = new THREE.Mesh(buildFrillGeometry(), waffleMaterial);
  frill.name = 'frill';
  frill.userData.partId = 'frill';

  const lower = new THREE.Mesh(buildScoopGeometry(detail, 3.7, 0.64, 0.75), creamMaterial);
  lower.name = 'scoopLower';
  lower.userData.partId = 'scoopLower';
  lower.scale.setScalar(0.92);
  lower.position.y = 0.3;

  const upper = new THREE.Mesh(buildScoopGeometry(detail, 11.3, 0.9, 1.15), creamMaterial);
  upper.name = 'scoopUpper';
  upper.userData.partId = 'scoopUpper';
  upper.scale.setScalar(0.93);
  upper.position.y = 1.18;

  const inclusions = buildInclusions(upper.geometry);
  inclusions.name = 'inclusions';
  inclusions.userData.partId = 'inclusions';
  upper.add(inclusions);

  const drips = buildDrips();
  drips.name = 'drips';
  drips.userData.partId = 'drips';
  for (const mesh of drips.children) mesh.material = creamMaterial;

  root.add(cone, frill, lower, upper, drips);
  root.userData.parts = ['cone', 'frill', 'scoopLower', 'scoopUpper', 'inclusions', 'drips'];

  // Dripping is painted from the scoop above it, so it never contradicts the flavour.
  const dripColour = new THREE.Color();
  function paintDrips(flavour) {
    dripColour.set(flavour.base);
    for (const mesh of drips.children) {
      const count = mesh.geometry.attributes.position.count;
      const array = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        array[i * 3] = dripColour.r; array[i * 3 + 1] = dripColour.g; array[i * 3 + 2] = dripColour.b;
      }
      mesh.geometry.setAttribute('color', new THREE.Float32BufferAttribute(array, 3));
    }
  }

  let current = FLAVOURS[0];
  let previous = FLAVOURS[1];
  let swapT = 1;

  function apply() {
    paintScoop(upper.geometry, current);
    paintScoop(lower.geometry, previous);
    paintDrips(previous);
    inclusions.visible = Boolean(current.bits);
    if (current.bits) inclusions.material.color.set(current.bits);
  }
  apply();

  root.userData.setFlavour = (id) => {
    const next = FLAVOURS.find((f) => f.id === id);
    if (!next || next.id === current.id) return;
    previous = current;
    current = next;
    apply();
    swapT = 0;
  };
  root.userData.getFlavour = () => current;

  root.userData.update = (elapsed, delta, reduced) => {
    if (swapT < 1) {
      swapT = Math.min(1, swapT + delta * 1.7);
      const e = 1 - Math.pow(1 - swapT, 3);
      upper.scale.setScalar(0.93 * (0.55 + 0.45 * e));
      upper.position.y = 1.18 + 0.5 * (1 - e);
      lower.scale.setScalar(0.92 * (1 + 0.06 * Math.sin(e * Math.PI)));
    }
    if (reduced) return;
    root.rotation.y = elapsed * 0.22;
    root.position.y = Math.sin(elapsed * 0.8) * 0.035;
    const creep = (Math.sin(elapsed * 0.35) + 1) / 2;
    drips.children.forEach((mesh, i) => {
      mesh.scale.y = 0.18 + creep * (0.55 + i * 0.18);
    });
  };

  return root;
}
