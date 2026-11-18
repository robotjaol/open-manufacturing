// Interactive 3D model of Line 2040 (secondary packaging, end of line).
// Everything is built from primitives so the repo has no binary model files.
// Layout: the line runs along +x, floor at y = 0, units are metres.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

const BELT_Y = 0.8;
const CARTON = { x: 0.4, y: 0.25, z: 0.38 };
export const ZS_X = [-7.2, -3.4, -1.55, 3.6, 5.0]; // photoeye x per station index
const SPAWN_X = -9.6;
const END_X = 5.05;
const PAL_X = 8.0;
const STATUS_COLOR = [0x0ca30c, 0xfab219, 0xec835a, 0xd03b3b];

// ---------- helpers ----------
const geoCache = new Map();
function boxGeo(w, h, d) {
  const k = `${w}|${h}|${d}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}
function box(w, h, d, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(boxGeo(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}
function rbox(w, h, d, r, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function cyl(r, len, mat, x = 0, y = 0, z = 0, axis = 'y', seg = 28) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.position.set(x, y, z);
  if (axis === 'x') m.rotation.z = Math.PI / 2;
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function canvasTex(w, h, draw, repeat = null) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  return t;
}
const std = (color, metalness = 0.2, roughness = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });

// ---------- materials ----------
function makeMaterials() {
  const mesh = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff';
    g.lineWidth = 6;
    for (let i = 0; i <= w; i += 128) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, h);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i);
      g.lineTo(w, i);
      g.stroke();
    }
  });
  return {
    steel: std(0xbfc5cc, 0.85, 0.32),
    steelDark: std(0x4b515a, 0.7, 0.45),
    frame: std(0xdde1e6, 0.25, 0.55),
    frameDark: std(0x353a42, 0.45, 0.55),
    panel: std(0xc9ced5, 0.2, 0.6),
    rubber: std(0x15171a, 0.1, 0.9),
    carton: std(0xc9a46f, 0.0, 0.85),
    tape: std(0xe6d6ad, 0.0, 0.7),
    yellow: std(0xf2b705, 0.2, 0.5),
    red: std(0xd03b3b, 0.2, 0.5),
    motor: std(0x2f5fa7, 0.35, 0.5),
    gearbox: std(0x8a96a3, 0.55, 0.45),
    wood: std(0xb68b57, 0.0, 0.9),
    white: std(0xf1f2f3, 0.1, 0.6),
    glass: new THREE.MeshStandardMaterial({ color: 0xaec8dc, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0, depthWrite: false }),
    fence: new THREE.MeshStandardMaterial({ color: 0x23272d, alphaMap: mesh, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 0.8 }),
    ghost: new THREE.MeshStandardMaterial({ color: 0xaab3bf, transparent: true, opacity: 0.1, depthWrite: false }),
    ledGreen: new THREE.MeshBasicMaterial({ color: 0x31d158 }),
    ledRed: new THREE.MeshBasicMaterial({ color: 0xff3b30 }),
    ledAmber: new THREE.MeshBasicMaterial({ color: 0xffb21e }),
    beam: new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.5 }),
    screen: new THREE.MeshBasicMaterial({ color: 0x4aa3ff }),
  };
}

// ---------- conveyor ----------
function conveyor(M, { length, width = 0.62, roller = false, beltTex }) {
  const g = new THREE.Group();
  const h = BELT_Y;
  const half = width / 2 + 0.04;
  for (const s of [-1, 1]) {
    g.add(box(length, 0.14, 0.05, M.frame, length / 2, h - 0.07, s * half));
    g.add(box(length, 0.025, 0.1, M.steel, length / 2, h + 0.005, s * half));
    // adjustable side guide with brackets
    g.add(box(length - 0.25, 0.1, 0.012, M.steel, length / 2, h + 0.13, s * (width / 2 - 0.015)));
    for (let x = 0.3; x < length - 0.2; x += 0.65) {
      g.add(box(0.03, 0.15, 0.075, M.steelDark, x, h + 0.075, s * (width / 2 + 0.02)));
    }
  }
  let belt = null;
  if (roller) {
    g.add(box(length - 0.1, 0.02, width, M.steelDark, length / 2, h - 0.06, 0));
    for (let x = 0.06; x < length - 0.04; x += 0.1) g.add(cyl(0.026, width, M.steel, x, h - 0.026, 0, 'z', 14));
  } else {
    belt = new THREE.Mesh(boxGeo(length - 0.1, 0.03, width), new THREE.MeshStandardMaterial({ map: beltTex.clone(), roughness: 0.92, metalness: 0.05 }));
    belt.material.map.repeat.set((length - 0.1) / 0.5, 1);
    belt.material.map.needsUpdate = true;
    belt.position.set(length / 2, h - 0.015, 0);
    belt.receiveShadow = true;
    g.add(belt);
    g.add(cyl(0.07, width + 0.04, M.steel, 0.04, h - 0.075, 0, 'z'));
    g.add(cyl(0.07, width + 0.04, M.steel, length - 0.04, h - 0.075, 0, 'z'));
  }
  const nLeg = Math.max(2, Math.ceil(length / 1.2) + 1);
  for (let i = 0; i < nLeg; i++) {
    const x = 0.15 + (i * (length - 0.3)) / (nLeg - 1);
    for (const s of [-1, 1]) {
      g.add(box(0.05, h - 0.14, 0.05, M.frame, x, (h - 0.14) / 2, s * half));
      g.add(cyl(0.045, 0.025, M.steelDark, x, 0.0125, s * half));
    }
    g.add(box(0.03, 0.03, width + 0.08, M.frame, x, 0.3, 0));
  }
  g.userData.belt = belt;
  return g;
}

// ---------- drive: gearmotor + pillow block bearing ----------
function pillowBlock(M, housingMat) {
  const g = new THREE.Group();
  g.add(box(0.17, 0.025, 0.085, M.steelDark, 0, -0.07, 0));
  g.add(box(0.1, 0.07, 0.085, housingMat, 0, -0.025, 0));
  const ring = cyl(0.048, 0.085, housingMat, 0, 0, 0, 'z');
  g.add(ring);
  g.add(cyl(0.031, 0.1, M.steel, 0, 0, 0, 'z'));
  g.add(cyl(0.018, 0.24, M.steel, 0, 0, 0.04, 'z'));
  for (const sx of [-1, 1]) g.add(cyl(0.011, 0.02, M.steelDark, sx * 0.065, -0.05, 0, 'y', 6));
  const nip = cyl(0.006, 0.02, M.steel, 0, 0.062, 0);
  g.add(nip);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), M.steel);
  ball.position.set(0, 0.075, 0);
  g.add(ball);
  return g;
}
function gearmotor(M, motorMat) {
  const g = new THREE.Group(); // axis along +z (outwards), origin at gearbox mount face
  g.add(rbox(0.2, 0.2, 0.16, 0.02, M.gearbox, 0, 0, 0.08));
  g.add(cyl(0.012, 0.03, M.steelDark, 0.06, 0.105, 0.06));
  g.add(cyl(0.018, 0.015, M.white, -0.06, 0, 0.165, 'z'));
  const pts = [new THREE.Vector2(0, 0)];
  const len = 0.34;
  for (let i = 0; i < 16; i++) {
    const y = 0.02 + i * ((len - 0.05) / 16);
    pts.push(new THREE.Vector2(0.075, y), new THREE.Vector2(0.092, y + 0.004), new THREE.Vector2(0.092, y + 0.012), new THREE.Vector2(0.075, y + 0.016));
  }
  pts.push(new THREE.Vector2(0.075, len), new THREE.Vector2(0, len));
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 36), motorMat);
  body.rotation.x = Math.PI / 2;
  body.position.set(0, 0, 0.16);
  body.castShadow = true;
  g.add(body);
  g.add(cyl(0.082, 0.07, M.steelDark, 0, 0, 0.545, 'z'));
  const fan = cyl(0.062, 0.012, M.steel, 0, 0, 0.585, 'z', 16);
  g.add(fan);
  g.userData.fan = fan;
  g.add(rbox(0.1, 0.07, 0.1, 0.01, M.steelDark, 0, 0.115, 0.34));
  g.add(cyl(0.012, 0.03, M.steel, 0.055, 0.115, 0.34, 'x'));
  return g;
}
function vibrationSensor(M) {
  const g = new THREE.Group();
  g.add(cyl(0.017, 0.035, M.steel, 0, 0.0175, 0));
  g.add(cyl(0.012, 0.012, M.red, 0, 0.041, 0));
  return g;
}

// ---------- photoeye ----------
function photoeye(M, width) {
  const g = new THREE.Group();
  const z = width / 2 + 0.12;
  g.add(box(0.035, 0.035, 0.06, M.steel, 0, 0, z));
  const led = box(0.012, 0.012, 0.008, M.ledGreen.clone(), 0, 0.025, z);
  led.material = M.ledGreen.clone();
  g.add(led);
  g.add(box(0.05, 0.05, 0.012, M.red, 0, 0, -z));
  const beam = cyl(0.004, z * 2 - 0.08, M.beam.clone(), 0, 0, 0, 'z', 6);
  g.add(beam);
  g.add(box(0.03, 0.02, 0.05, M.steelDark, 0, -0.03, z + 0.02));
  g.userData.led = led;
  g.userData.beam = beam;
  return g;
}

// ---------- case packer ----------
function casePacker(M, beltTex, labelTex) {
  const g = new THREE.Group();
  const L = 3.8;
  g.add(conveyor(M, { length: L, beltTex }));
  const W = 1.1;
  const H = 2.35;
  const post = (x, z) => g.add(box(0.14, H, 0.14, M.frameDark, x, H / 2, z));
  for (const x of [0.1, L - 0.1]) for (const z of [-W, W]) post(x, z);
  for (const y of [1.15, H]) {
    for (const z of [-W, W]) g.add(box(L, 0.1, 0.12, M.frameDark, L / 2, y, z));
    for (const x of [0.1, L - 0.1]) g.add(box(0.12, 0.1, W * 2, M.frameDark, x, y, 0));
  }
  g.add(box(L, 0.05, W * 2 + 0.1, M.frame, L / 2, H + 0.05, 0));
  for (const z of [-W, W]) {
    g.add(box(L - 0.3, 0.85, 0.03, M.panel, L / 2, 0.55, z));
    const gl = box(L - 0.4, 1.0, 0.02, M.glass, L / 2, 1.7, z, false);
    gl.castShadow = false;
    g.add(gl);
    for (let x = 0.6; x < L - 0.3; x += 0.85) g.add(box(0.04, 1.0, 0.04, M.frameDark, x, 1.7, z));
  }
  // electrical cabinet
  const cab = box(0.55, 1.9, 0.8, M.frame, L + 0.15, 0.95, -0.55);
  g.add(cab);
  g.add(box(0.01, 1.7, 0.7, M.steelDark, L + 0.435, 0.95, -0.55));
  g.add(box(0.03, 0.18, 0.03, M.steel, L + 0.45, 0.95, -0.25));
  for (let i = 0; i < 6; i++) g.add(box(0.012, 0.02, 0.28, M.steelDark, L + 0.435, 1.55 + i * 0.04, -0.82));
  // stack light
  g.add(cyl(0.02, 0.5, M.steelDark, L - 0.35, H + 0.3, W - 0.2));
  const beacon = { r: cyl(0.05, 0.08, M.ledRed.clone(), L - 0.35, H + 0.6, W - 0.2), a: cyl(0.05, 0.08, M.ledAmber.clone(), L - 0.35, H + 0.69, W - 0.2), gr: cyl(0.05, 0.08, M.ledGreen.clone(), L - 0.35, H + 0.78, W - 0.2) };
  for (const m of Object.values(beacon)) g.add(m);
  beacon.r.material.color.setHex(0x4a1410);
  beacon.a.material.color.setHex(0x4a3410);
  // HMI on an arm
  g.add(cyl(0.025, 1.4, M.steelDark, 0.5, 0.7, W + 0.28));
  const hmi = canvasTex(256, 160, (c, w, h) => {
    c.fillStyle = '#0d2238';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#4aa3ff';
    c.font = 'bold 22px monospace';
    c.fillText('2040-CPK-301', 14, 34);
    c.fillStyle = '#31d158';
    c.fillText('RUN  120 packs/min', 14, 70);
    c.fillStyle = '#9fb8d0';
    c.font = '16px monospace';
    c.fillText('SYNTHETIC DATA', 14, 110);
  });
  const screen = new THREE.Mesh(boxGeo(0.34, 0.22, 0.02), new THREE.MeshBasicMaterial({ map: hmi }));
  screen.position.set(0.5, 1.45, W + 0.3);
  g.add(screen);
  g.add(box(0.37, 0.25, 0.03, M.steelDark, 0.5, 1.45, W + 0.285));
  // pick arm on a gantry
  g.add(box(L - 0.6, 0.08, 0.14, M.steel, L / 2, 2.1, 0));
  const carriage = new THREE.Group();
  carriage.add(box(0.34, 0.14, 0.34, M.yellow, 0, 0, 0));
  const mast = new THREE.Group();
  mast.add(cyl(0.035, 0.7, M.steel, 0, -0.35, 0));
  mast.add(box(0.55, 0.05, 0.4, M.frameDark, 0, -0.72, 0));
  for (let i = 0; i < 6; i++) mast.add(cyl(0.025, 0.04, M.rubber, -0.18 + (i % 3) * 0.18, -0.765, i < 3 ? -0.1 : 0.1));
  carriage.add(mast);
  carriage.position.set(0.9, 2.1, 0);
  g.add(carriage);
  // carton blanks magazine
  for (let i = 0; i < 12; i++) g.add(box(0.5, 0.012, 0.36, M.carton, L - 0.8, 0.95 + i * 0.014, -0.75));
  g.add(box(0.55, 0.02, 0.4, M.steelDark, L - 0.8, 0.94, -0.75));
  g.userData = { carriage, mast, beacon };
  return g;
}

// ---------- palletizer, pallet, AGV ----------
function palletizerCell(M) {
  const g = new THREE.Group();
  const x0 = 5.4;
  const x1 = 10.0;
  const z0 = -2.5;
  const z1 = 2.5;
  const fh = 1.9;
  const post = (x, z) => g.add(box(0.06, fh, 0.06, M.yellow, x, fh / 2, z));
  const panel = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za);
    const m = new THREE.Mesh(boxGeo(len, fh - 0.2, 0.01), M.fence);
    m.position.set((xa + xb) / 2, fh / 2 + 0.05, (za + zb) / 2);
    m.rotation.y = -Math.atan2(zb - za, xb - xa);
    const mat = M.fence.clone();
    mat.alphaMap = M.fence.alphaMap.clone();
    mat.alphaMap.repeat.set(len / 0.5, (fh - 0.2) / 0.5);
    mat.alphaMap.needsUpdate = true;
    m.material = mat;
    g.add(m);
    for (const y of [fh - 0.02, 0.12]) {
      const rail = box(len, 0.04, 0.04, M.yellow, (xa + xb) / 2, y, (za + zb) / 2);
      rail.rotation.y = -Math.atan2(zb - za, xb - xa);
      g.add(rail);
    }
  };
  // west side with the conveyor opening, north, south
  panel(x0, z0, x0, -0.55);
  panel(x0, 0.55, x0, z1);
  panel(x0, z1, x1, z1);
  panel(x0, z0, x1, z0);
  panel(x1, z0, x1, -1.2);
  panel(x1, 1.2, x1, z1);
  for (const [x, z] of [[x0, z0], [x0, -0.55], [x0, 0.55], [x0, z1], [7.7, z1], [x1, z1], [x1, 1.2], [x1, -1.2], [x1, z0], [7.7, z0]]) post(x, z);
  // light curtain on the outfeed
  for (const z of [-1.2, 1.2]) {
    g.add(box(0.05, 1.5, 0.05, M.frameDark, x1, 0.8, z));
    g.add(box(0.012, 1.3, 0.012, M.ledRed, x1 + 0.03, 0.8, z));
  }
  // gantry: rails along x on both sides, cross beam travels along x, hoist lowers
  const CROSS_Y = 3.4;
  const colX = [5.2, 9.4];
  for (const x of colX) for (const z of [-1.7, 1.7]) g.add(box(0.2, CROSS_Y + 0.2, 0.2, M.frame, x, (CROSS_Y + 0.2) / 2, z));
  for (const z of [-1.7, 1.7]) g.add(box(colX[1] - colX[0] + 0.2, 0.18, 0.2, M.frame, (colX[0] + colX[1]) / 2, CROSS_Y + 0.15, z));
  const cross = new THREE.Group();
  cross.add(box(0.22, 0.2, 3.6, M.frameDark, 0, 0, 0));
  const hoist = new THREE.Group();
  hoist.add(cyl(0.05, 1.6, M.steel, 0, -0.8, 0));
  hoist.add(box(1.0, 0.06, 0.75, M.frameDark, 0, -1.62, 0));
  for (let i = 0; i < 6; i++) hoist.add(box(0.08, 0.04, 0.7, M.steelDark, -0.4 + i * 0.16, -1.66, 0));
  const held = new THREE.Group();
  for (let n = 0; n < 6; n++) held.add(box(CARTON.x - 0.01, CARTON.y - 0.01, CARTON.z - 0.01, M.carton, -0.4 + (n % 3) * 0.4, -1.69 - CARTON.y / 2, n < 3 ? -0.19 : 0.19));
  held.visible = false;
  hoist.add(held);
  cross.add(hoist);
  cross.position.set(5.0, CROSS_Y, 0);
  g.add(cross);
  // outfeed shuttle rollers + pallet infeed side table
  g.add(box(3.2, 0.1, 1.0, M.frame, 8.0, 0.05, 0));
  for (let x = 6.5; x < 9.6; x += 0.12) g.add(cyl(0.022, 0.9, M.steel, x, 0.11, 0, 'z', 10));
  g.userData = { cross, hoist, held, CROSS_Y };
  return g;
}
function palletMesh(M) {
  const g = new THREE.Group();
  for (const z of [-0.33, 0, 0.33]) g.add(box(1.2, 0.14, 0.1, M.wood, 0, 0.07, z));
  for (let i = 0; i < 7; i++) g.add(box(0.08, 0.025, 0.8, M.wood, -0.54 + i * 0.18, 0.152, 0));
  return g;
}
function agv(M) {
  const g = new THREE.Group();
  g.add(rbox(1.5, 0.26, 0.95, 0.06, M.frame, 0, 0.2, 0));
  g.add(box(1.52, 0.05, 0.97, M.yellow, 0, 0.1, 0));
  g.add(box(1.2, 0.04, 0.8, M.steelDark, 0, 0.35, 0));
  for (let i = 0; i < 9; i++) g.add(cyl(0.02, 0.8, M.steel, -0.5 + i * 0.125, 0.385, 0, 'z', 10));
  g.add(cyl(0.07, 0.12, M.steelDark, 0.7, 0.34, 0));
  g.add(box(0.04, 0.03, 0.9, M.ledGreen.clone(), 0.77, 0.24, 0));
  g.add(cyl(0.03, 0.12, M.ledAmber.clone(), -0.62, 0.4, 0.4));
  g.userData.mount = new THREE.Object3D();
  g.userData.mount.position.set(0, 0.4, 0);
  g.add(g.userData.mount);
  return g;
}

// ---------- scene ----------
export function createPlant(container, { onSelect, onHover, onStop, assets }) {
  const M = makeMaterials();
  const beltTex = canvasTex(64, 128, (c, w, h) => {
    c.fillStyle = '#1b1d21';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#2a2d33';
    for (let x = 0; x < w; x += 16) c.fillRect(x, 0, 3, h);
    c.fillStyle = '#24272c';
    c.fillRect(0, 0, w, 6);
  });
  beltTex.repeat.set(4, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeceef1);
  scene.fog = new THREE.Fog(0xeceef1, 40, 90);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = 'labels3d';
  container.appendChild(labelRenderer.domElement);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 160);
  const VIEW_WHOLE = { pos: new THREE.Vector3(11, 12, 21), target: new THREE.Vector3(3.2, 0.3, 0) };
  const wholeFor = (aspect) => {
    if (aspect < 0.9) return { pos: new THREE.Vector3(-19, 10, 7), target: new THREE.Vector3(3.5, 0.3, 0) }; // portrait: look down the line from the infeed end
    const k = Math.max(0.78, 1.15 / Math.max(0.35, aspect));
    return { pos: VIEW_WHOLE.target.clone().add(VIEW_WHOLE.pos.clone().sub(VIEW_WHOLE.target).multiplyScalar(k)), target: VIEW_WHOLE.target.clone() };
  };
  camera.position.copy(VIEW_WHOLE.pos);
  const controls = new OrbitControls(camera, labelRenderer.domElement);
  controls.target.copy(VIEW_WHOLE.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.maxPolarAngle = Math.PI * 0.485;
  controls.minDistance = 1.2;
  controls.maxDistance = 60;

  scene.add(new THREE.HemisphereLight(0xffffff, 0xc9ced6, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 2.3);
  sun.position.set(7, 14, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 10, bottom: -10, near: 1, far: 40 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.target.position.set(1, 0, 0);
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xdde8ff, 0.6);
  fill.position.set(-8, 6, -6);
  scene.add(fill);

  // floor with a 1 m grid and walkway lines
  const floorTex = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#e3e5e8';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#d2d5da';
    c.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      c.beginPath();
      c.moveTo((i * w) / 4, 0);
      c.lineTo((i * w) / 4, h);
      c.stroke();
      c.beginPath();
      c.moveTo(0, (i * h) / 4);
      c.lineTo(w, (i * h) / 4);
      c.stroke();
    }
  });
  floorTex.repeat.set(10, 6);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 24), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85, metalness: 0 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf2b705 });
  const stripe = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.1), lineMat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -Math.atan2(z1 - z0, x1 - x0);
    m.position.set((x0 + x1) / 2, 0.004, (z0 + z1) / 2);
    scene.add(m);
  };
  stripe(-10.5, 2.2, 5.2, 2.2);
  stripe(-10.5, -2.2, -1.9, -2.2);
  stripe(5.3, 3.0, 12.6, 3.0);
  stripe(10.5, -4.8, 13, -4.8);

  // ----- assets -----
  const A = {};
  const register = (id, group, extra = {}) => {
    group.userData.assetId = id;
    group.traverse((o) => {
      if (o.isMesh) o.userData.assetId = id;
    });
    scene.add(group);
    A[id] = { id, group, ...extra };
  };

  const c201 = conveyor(M, { length: 4.5, beltTex });
  c201.position.set(-9.5, 0, 0);
  const pe201 = photoeye(M, 0.62);
  pe201.position.set(ZS_X[0] - -9.5, BELT_Y + 0.13, 0);
  c201.add(pe201);
  const mtr201 = gearmotor(M, M.motor);
  mtr201.position.set(4.4, BELT_Y - 0.075, 0.5);
  c201.add(mtr201);
  register('2040-CNV-201', c201, { belt: c201.userData.belt, pe: pe201, fans: [mtr201.userData.fan] });

  const c202 = conveyor(M, { length: 3.2, beltTex });
  c202.position.set(-5.0, 0, 0);
  const pe202 = photoeye(M, 0.62);
  pe202.position.set(ZS_X[1] + 5.0, BELT_Y + 0.13, 0);
  c202.add(pe202);
  const brgMat = M.steelDark.clone();
  const brgA = pillowBlock(M, brgMat);
  brgA.position.set(3.2, BELT_Y - 0.075, 0.5);
  c202.add(brgA);
  const brgB = pillowBlock(M, M.steelDark);
  brgB.position.set(3.2, BELT_Y - 0.075, -0.5);
  brgB.rotation.y = Math.PI;
  c202.add(brgB);
  const mtrMat = M.motor.clone();
  const mtr202 = gearmotor(M, mtrMat);
  mtr202.position.set(3.2, BELT_Y - 0.075, 0.72);
  c202.add(mtr202);
  const vt202 = vibrationSensor(M);
  vt202.position.set(3.2, BELT_Y - 0.075 + 0.048, 0.5);
  c202.add(vt202);
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(3.2, 0.82, 0.5), new THREE.Vector3(3.1, 0.95, 0.62), new THREE.Vector3(2.7, 0.9, 0.72), new THREE.Vector3(2.6, 0.45, 0.62), new THREE.Vector3(2.6, 0.3, 0.52)]), 24, 0.005, 6),
    M.rubber
  );
  c202.add(cable);
  c202.add(box(0.1, 0.12, 0.06, M.frameDark, 2.6, 0.26, 0.5));
  register('2040-CNV-202', c202, { belt: c202.userData.belt, pe: pe202, fans: [mtr202.userData.fan], brgMat, mtrMat });

  const cpk = casePacker(M, beltTex);
  cpk.position.set(-1.8, 0, 0);
  const pe301 = photoeye(M, 0.62);
  pe301.position.set(ZS_X[2] + 1.8, BELT_Y + 0.13, 0);
  cpk.add(pe301);
  register('2040-CPK-301', cpk, { belt: cpk.children[0].userData.belt, pe: pe301 });

  const c401 = conveyor(M, { length: 3.2, roller: true, beltTex });
  c401.position.set(2.0, 0, 0);
  const pe401 = photoeye(M, 0.62);
  pe401.position.set(ZS_X[3] - 2.0, BELT_Y + 0.13, 0);
  c401.add(pe401);
  const mtr401 = gearmotor(M, M.motor);
  mtr401.position.set(3.1, BELT_Y - 0.075, 0.5);
  c401.add(mtr401);
  register('2040-CNV-401', c401, { pe: pe401, fans: [mtr401.userData.fan] });

  const pal = palletizerCell(M);
  const pe501 = photoeye(M, 0.62);
  pe501.position.set(ZS_X[4] - 2.0, BELT_Y + 0.13, 0);
  c401.add(pe501);
  register('2040-PAL-501', pal, { pe: pe501 });

  // pallet with instanced cases
  const palletG = palletMesh(M);
  palletG.position.set(PAL_X, 0.11, 0);
  scene.add(palletG);
  const MAXCASE = 30;
  const stackMesh = new THREE.InstancedMesh(boxGeo(CARTON.x - 0.01, CARTON.y - 0.01, CARTON.z - 0.01), M.carton, MAXCASE);
  stackMesh.castShadow = true;
  stackMesh.receiveShadow = true;
  stackMesh.count = 0;
  palletG.add(stackMesh);

  const staging = new THREE.Group();
  scene.add(staging);

  const agvG = agv(M);
  agvG.position.set(12.2, 0, -3.8);
  register('2040-AGV-601', agvG);

  // moving cartons (instanced) with a tape strip
  const MAXN = 48;
  const cartonMesh = new THREE.InstancedMesh(boxGeo(CARTON.x, CARTON.y, CARTON.z), M.carton, MAXN);
  const tapeMesh = new THREE.InstancedMesh(boxGeo(0.06, 0.004, CARTON.z + 0.002), M.tape, MAXN);
  cartonMesh.castShadow = true;
  cartonMesh.receiveShadow = true;
  cartonMesh.count = 0;
  tapeMesh.count = 0;
  scene.add(cartonMesh, tapeMesh);

  // ----- status halos on the floor -----
  const glowTex = canvasTex(128, 128, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)');
    gr.addColorStop(0.6, 'rgba(255,255,255,0.35)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr;
    c.fillRect(0, 0, w, h);
  });
  const halos = [];
  const haloSpec = [
    { id: '2040-CNV-201', x: -7.2, w: 5.2, d: 2.4 },
    { id: '2040-CNV-202', x: -3.4, w: 4.4, d: 2.4 },
    { id: '2040-CPK-301', x: 0.1, w: 5.4, d: 3.6 },
    { id: '2040-CNV-401', x: 3.6, w: 4.4, d: 2.4 },
    { id: '2040-PAL-501', x: 7.6, w: 6.4, d: 5.4 },
  ];
  haloSpec.forEach((s) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.d), new THREE.MeshBasicMaterial({ map: glowTex, color: STATUS_COLOR[0], transparent: true, opacity: 0, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(s.x, 0.006, 0);
    scene.add(m);
    halos.push(m);
  });

  // ----- selection brackets -----
  const bracketMat = new THREE.LineBasicMaterial({ color: 0x2a78d6, depthTest: false, transparent: true });
  const brackets = new THREE.LineSegments(new THREE.BufferGeometry(), bracketMat);
  brackets.renderOrder = 999;
  brackets.visible = false;
  scene.add(brackets);
  function setBrackets(box3) {
    const { min, max } = box3;
    const e = 0.22;
    const pts = [];
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
      const sx = x === min.x ? 1 : -1;
      const sy = y === min.y ? 1 : -1;
      const sz = z === min.z ? 1 : -1;
      const ex = Math.min(e, (max.x - min.x) / 3);
      const ey = Math.min(e, (max.y - min.y) / 3);
      const ez = Math.min(e, (max.z - min.z) / 3);
      pts.push(x, y, z, x + sx * ex, y, z, x, y, z, x, y + sy * ey, z, x, y, z, x, y, z + sz * ez);
    }
    brackets.geometry.dispose();
    brackets.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    brackets.visible = true;
  }

  // ----- labels -----
  const chips = {};
  const chipAnchor = {
    '2040-CNV-201': [-7.2, 1.55, 0],
    '2040-CNV-202': [-3.4, 1.55, 0],
    '2040-CPK-301': [0.1, 3.15, 0],
    '2040-CNV-401': [3.6, 1.55, 0],
    '2040-PAL-501': [7.6, 3.6, 0],
    '2040-AGV-601': [0, 0.85, 0],
  };
  const addChip = (id, label, pos, parent = scene, sub = false) => {
    const el = document.createElement('button');
    el.className = 'tag3d' + (sub ? ' sub' : '');
    el.innerHTML = `<span class="dot"></span><span class="t">${label}</span><span class="v"></span>`;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onSelect && onSelect(id);
    });
    const obj = new CSS2DObject(el);
    obj.position.set(...pos);
    parent.add(obj);
    chips[id] = { el, obj };
  };
  for (const [id, pos] of Object.entries(chipAnchor)) addChip(id, id, pos, id === '2040-AGV-601' ? agvG : scene);
  addChip('2040-MTR-202', '2040-MTR-202', [-1.2, 1.0, 1.25], scene, true);
  addChip('2040-BRG-202A', '2040-BRG-202A', [-2.3, 0.45, 0.55], scene, true);
  addChip('2040-VT-202', '2040-VT-202', [-2.3, 1.3, 0.5], scene, true);
  ['2040-MTR-202', '2040-BRG-202A', '2040-VT-202'].forEach((id) => chips[id].el.classList.add('hidden'));
  A['2040-MTR-202'] = { id: '2040-MTR-202', group: mtr202, parentId: '2040-CNV-202' };
  A['2040-BRG-202A'] = { id: '2040-BRG-202A', group: brgA, parentId: '2040-CNV-202' };
  A['2040-VT-202'] = { id: '2040-VT-202', group: vt202, parentId: '2040-CNV-202' };
  for (const k of ['2040-MTR-202', '2040-BRG-202A', '2040-VT-202']) A[k].group.traverse((o) => o.isMesh && (o.userData.assetId = k));

  // ----- state -----
  const state = {
    time: 0,
    rates: [1, 1, 1, 1, 1], // stops per hour at the cursor
    status: [0, 0, 0, 0, 0],
    stopUntil: [0, 0, 0, 0, 0],
    stopCount: [0, 0, 0, 0, 0],
    vib: 1,
    selected: null,
    xray: false,
    playing: true,
    layers: { guards: true, sensors: true, labels: true, status: true },
    vibZoneColor: STATUS_COLOR[0],
  };
  const agents = [];
  let spawnAcc = 0;
  const dummy = new THREE.Object3D();
  let buffered = 0;
  const pallet = { layers: 0, cycle: -1, t: 0, state: 'filling' };
  const agvState = { s: 'park', t: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), carrying: false, done: 0 };
  const rand = (() => {
    let a = 12345;
    return () => {
      a = (a * 1664525 + 1013904223) >>> 0;
      return a / 4294967296;
    };
  })();

  function agentCount() {
    return agents.length;
  }
  // initial cartons so the line is not empty at start
  for (let x = SPAWN_X + 0.5; x < 3.5; x += 1.15) agents.push({ x });

  const zoneOf = (x) => {
    for (let i = 0; i < 5; i++) if (Math.abs(x - ZS_X[i]) < 0.22 && x < ZS_X[i] + 0.12) return i;
    return -1;
  };

  function updateCartons(dt) {
    spawnAcc += 0.58 * dt;
    const last = agents.length ? agents[0].x : 99;
    if (spawnAcc > 1.15 && last > SPAWN_X + 0.7 && agents.length < MAXN - 2) {
      agents.unshift({ x: SPAWN_X });
      spawnAcc = 0;
    }
    // agents sorted so that index 0 is upstream, last is downstream leader
    for (let i = agents.length - 1; i >= 0; i--) {
      const a = agents[i];
      const leader = agents[i + 1];
      let v = 0.58 * dt;
      const z = zoneOf(a.x);
      if (z >= 0 && state.time < state.stopUntil[z]) v = 0;
      if (leader) v = Math.min(v, Math.max(0, leader.x - a.x - (CARTON.x + 0.07)));
      // palletizer holds cartons when the pallet is being swapped
      if (a.x > END_X - 0.5 && pallet.state !== 'filling') v = Math.min(v, Math.max(0, END_X - 0.4 - a.x));
      a.x += v;
      if (a.x >= END_X) {
        agents.splice(i, 1);
        buffered++;
      }
    }
    cartonMesh.count = tapeMesh.count = agents.length;
    agents.forEach((a, i) => {
      dummy.position.set(a.x, BELT_Y + CARTON.y / 2 + 0.002, 0);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      cartonMesh.setMatrixAt(i, dummy.matrix);
      dummy.position.y += CARTON.y / 2 + 0.003;
      dummy.updateMatrix();
      tapeMesh.setMatrixAt(i, dummy.matrix);
    });
    cartonMesh.instanceMatrix.needsUpdate = true;
    tapeMesh.instanceMatrix.needsUpdate = true;
  }

  function stationStops(dt) {
    for (let i = 0; i < 5; i++) {
      if (state.time >= state.stopUntil[i]) {
        const p = (state.rates[i] / 12) * dt; // visual cadence: 1 h of plant time = 12 s
        if (rand() < p) {
          state.stopUntil[i] = state.time + 0.5 + rand() * 0.25;
          state.stopCount[i]++;
          onStop && onStop(i);
        }
      }
    }
    const pes = [A['2040-CNV-201'].pe, A['2040-CNV-202'].pe, A['2040-CPK-301'].pe, A['2040-CNV-401'].pe, A['2040-PAL-501'].pe];
    pes.forEach((pe, i) => {
      const stopped = state.time < state.stopUntil[i];
      pe.userData.led.material.color.setHex(stopped ? 0xff3b30 : 0x31d158);
      pe.userData.beam.material.opacity = stopped ? 0.95 : 0.35 + 0.1 * Math.sin(state.time * 8 + i);
    });
  }

  function updatePallet(dt) {
    const { hoist, cross, held, CROSS_Y } = A['2040-PAL-501'].group.userData;
    const e = (k) => k * k * (3 - 2 * k);
    const PICK_X = 5.0;
    const PLACE_X = PAL_X;
    const hoistFor = (layer) => CROSS_Y - 1.66 - (0.555 + layer * CARTON.y); // hoist drop so the plate sits on the stack
    const hPick = CROSS_Y - 1.66 - 1.08;
    if (pallet.state !== 'filling') return;
    if (pallet.cycle < 0 && buffered >= 6) {
      buffered -= 6;
      pallet.cycle = 0;
      pallet.placed = false;
    }
    if (pallet.cycle >= 0) {
      pallet.cycle += dt;
      const t = pallet.cycle;
      const hPlace = hoistFor(pallet.layers);
      let x = PICK_X;
      let y = 0;
      if (t < 1.0) y = e(t / 1.0) * hPick; // lower to the cases
      else if (t < 1.4) y = hPick; // grip
      else if (t < 2.2) y = hPick + (0 - hPick) * e((t - 1.4) / 0.8); // lift
      else if (t < 3.8) {
        x = PICK_X + (PLACE_X - PICK_X) * e((t - 2.2) / 1.6); // travel
        y = 0;
      } else if (t < 4.6) {
        x = PLACE_X;
        y = hPlace * e((t - 3.8) / 0.8); // lower onto the stack
      } else if (t < 5.0) {
        x = PLACE_X;
        y = hPlace; // release
      } else if (t < 5.8) {
        x = PLACE_X;
        y = hPlace * (1 - e((t - 5.0) / 0.8)); // retract
      } else if (t < 7.4) {
        x = PLACE_X + (PICK_X - PLACE_X) * e((t - 5.8) / 1.6); // return
        y = 0;
      } else pallet.cycle = -1;
      held.visible = t >= 1.4 && t < 4.8;
      if (t >= 4.8 && !pallet.placed) {
        pallet.placed = true;
        const k = pallet.layers * 6;
        for (let n = 0; n < 6; n++) {
          dummy.position.set(-0.4 + (n % 3) * 0.4, 0.14 + 0.025 + CARTON.y / 2 + pallet.layers * CARTON.y, n < 3 ? -0.19 : 0.19);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          stackMesh.setMatrixAt(k + n, dummy.matrix);
        }
        stackMesh.count = k + 6;
        stackMesh.instanceMatrix.needsUpdate = true;
        pallet.layers++;
      }
      cross.position.x = x;
      hoist.position.y = -y;
      if (pallet.cycle < 0) {
        held.visible = false;
        cross.position.x = PICK_X;
        hoist.position.y = 0;
        if (pallet.layers >= 5) {
          pallet.state = 'full';
          agvState.s = 'toPickup';
          agvState.t = 0;
          agvState.from.copy(agvG.position);
          agvState.to.set(10.4, 0, 0);
        }
      }
    }
  }

  function updateAGV(dt) {
    const ease = (a) => a * a * (3 - 2 * a);
    const s = agvState;
    s.t += dt;
    const go = (dur, next, onDone) => {
      const k = Math.min(1, s.t / dur);
      agvG.position.lerpVectors(s.from, s.to, ease(k));
      const d = s.to.clone().sub(s.from);
      if (d.lengthSq() > 0.01) {
        const target = Math.atan2(-d.z, d.x);
        agvG.rotation.y += (target - agvG.rotation.y) * Math.min(1, dt * 6);
      }
      if (k >= 1) {
        s.s = next;
        s.t = 0;
        s.from.copy(agvG.position);
        onDone && onDone();
      }
    };
    if (s.s === 'toPickup') go(3.5, 'load', () => {});
    else if (s.s === 'load') {
      // pallet shuttles out onto the AGV deck
      const k = Math.min(1, s.t / 2);
      palletG.position.x = PAL_X + (agvG.position.x - PAL_X) * ease(k);
      agvG.rotation.y += (0 - agvG.rotation.y) * Math.min(1, dt * 6);
      if (k >= 1) {
        s.s = 'toStaging';
        s.t = 0;
        s.from.copy(agvG.position);
        s.to.set(12.4, 0, 3.9);
        s.carry = true;
      }
    } else if (s.s === 'toStaging') {
      go(4.5, 'unload', () => {});
      const f = agvG.position;
      palletG.position.set(f.x, 0.4, f.z);
      palletG.rotation.y = agvG.rotation.y;
    } else if (s.s === 'unload') {
      const k = Math.min(1, s.t / 1.2);
      palletG.position.y = 0.4 - 0.29 * ease(k);
      if (k >= 1) {
        const st = new THREE.InstancedMesh(stackMesh.geometry, M.carton, MAXCASE);
        st.count = stackMesh.count;
        st.castShadow = true;
        for (let n = 0; n < st.count; n++) {
          const m = new THREE.Matrix4();
          stackMesh.getMatrixAt(n, m);
          st.setMatrixAt(n, m);
        }
        const doneG = palletMesh(M);
        doneG.add(st);
        doneG.position.set(11.0 + (s.done % 3) * 1.4, 0.11, 4.2 - Math.floor(s.done / 3) * 0.0);
        staging.add(doneG);
        if (staging.children.length > 3) staging.remove(staging.children[0]);
        s.done++;
        palletG.position.set(PAL_X, 0.11, 0);
        palletG.rotation.y = 0;
        stackMesh.count = 0;
        pallet.layers = 0;
        pallet.state = 'filling';
        s.s = 'return';
        s.t = 0;
        s.from.copy(agvG.position);
        s.to.set(12.2, 0, -3.8);
      }
    } else if (s.s === 'return') go(5, 'park', () => {});
  }

  function updateCasePacker(dt) {
    const cp = A['2040-CPK-301'].group.userData;
    const t = state.time;
    const stopped = state.time < state.stopUntil[2];
    const k = stopped ? 0 : 1;
    cp.carriage.position.x = 0.9 + (Math.sin(t * 0.9) * 0.5 + 0.5) * 2.0 * k + cp.carriage.position.x * (1 - k);
    cp.mast.position.y = -Math.max(0, Math.sin(t * 1.8)) * 0.35;
    const st = state.status[2];
    cp.beacon.gr.material.color.setHex(st === 0 ? 0x31d158 : 0x15381d);
    cp.beacon.a.material.color.setHex(st >= 1 ? 0xffb21e : 0x4a3410);
    cp.beacon.r.material.color.setHex(st >= 3 ? 0xff3b30 : 0x4a1410);
  }

  // ----- interaction -----
  const pickables = [];
  for (const a of Object.values(A)) a.group.traverse((o) => o.isMesh && pickables.push(o));
  pickables.push(...[]);
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = null;
  const baseId = (id) => (A[id] && A[id].parentId) || id;
  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    return hit ? hit.object.userData.assetId : null;
  }
  let downAt = null;
  labelRenderer.domElement.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
  labelRenderer.domElement.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
    const id = pick(e);
    onSelect && onSelect(id);
  });
  labelRenderer.domElement.addEventListener('pointermove', (e) => {
    const id = pick(e);
    if (id !== hovered) {
      hovered = id;
      labelRenderer.domElement.style.cursor = id ? 'pointer' : 'grab';
      onHover && onHover(id);
    }
  });

  // camera presets and tween
  const PRESETS = {
    whole: VIEW_WHOLE,
    '2040-CNV-201': { pos: new THREE.Vector3(-4.8, 3.4, 5.6), target: new THREE.Vector3(-7.2, 0.8, 0) },
    '2040-CNV-202': { pos: new THREE.Vector3(-3.4, 3.0, 7.2), target: new THREE.Vector3(-3.4, 0.8, 0) },
    drive: { pos: new THREE.Vector3(-0.2, 1.7, 3.0), target: new THREE.Vector3(-1.9, 0.75, 0.5) },
    '2040-CPK-301': { pos: new THREE.Vector3(2.8, 4.4, 7.4), target: new THREE.Vector3(0.1, 1.2, 0) },
    '2040-CNV-401': { pos: new THREE.Vector3(6.4, 3.2, 5.4), target: new THREE.Vector3(3.6, 0.8, 0) },
    '2040-PAL-501': { pos: new THREE.Vector3(12.8, 6.8, 9.2), target: new THREE.Vector3(7.8, 1.0, 0) },
    '2040-AGV-601': { pos: new THREE.Vector3(14.5, 4.0, 4.2), target: new THREE.Vector3(11.6, 0.4, 0) },
  };
  PRESETS['2040-MTR-202'] = PRESETS.drive;
  PRESETS['2040-BRG-202A'] = PRESETS.drive;
  PRESETS['2040-VT-202'] = PRESETS.drive;
  let tween = null;
  function flyTo(key, dur = 1.1) {
    const p = key === 'whole' || !PRESETS[key] ? wholeFor(camera.aspect) : PRESETS[key];
    tween = { t: 0, dur, p0: camera.position.clone(), t0: controls.target.clone(), p1: p.pos.clone(), t1: p.target.clone() };
  }

  function applyXray() {
    const sel = state.selected ? baseId(state.selected) : null;
    for (const a of Object.values(A)) {
      if (a.parentId) continue;
      a.group.traverse((o) => {
        if (!o.isMesh) return;
        if (!o.userData.m0) o.userData.m0 = o.material;
        o.material = state.xray && sel && a.id !== sel ? M.ghost : o.userData.m0;
      });
    }
  }
  function select(id) {
    state.selected = id;
    const b = id ? baseId(id) : null;
    if (b && A[b]) {
      const bx = new THREE.Box3().setFromObject(A[id].group);
      setBrackets(bx);
    } else brackets.visible = false;
    ['2040-MTR-202', '2040-BRG-202A', '2040-VT-202'].forEach((k) => chips[k].el.classList.toggle('hidden', !(b === '2040-CNV-202')));
    for (const [k, c] of Object.entries(chips)) c.el.classList.toggle('selected', k === id);
    applyXray();
    flyTo(id || 'whole');
  }

  function setLayer(name, on) {
    state.layers[name] = on;
    if (name === 'guards') A['2040-PAL-501'].group.traverse((o) => o.isMesh && (o.visible = on));
    if (name === 'labels') labelRenderer.domElement.style.display = on ? '' : 'none';
    if (name === 'sensors') for (const k of ['2040-CNV-201', '2040-CNV-202', '2040-CPK-301', '2040-CNV-401', '2040-PAL-501']) A[k].pe.visible = on;
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    labelRenderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();
  {
    const w0 = wholeFor(camera.aspect);
    camera.position.copy(w0.pos);
    controls.target.copy(w0.target);
  }

  // ----- loop -----
  const clock = new THREE.Clock();
  let raf = 0;
  const pulse = { t: 0 };
  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta());
    if (state.playing) {
      state.time += dt;
      updateCartons(dt);
      stationStops(dt);
      updatePallet(dt);
      updateAGV(dt);
      updateCasePacker(dt);
      for (const id of ['2040-CNV-201', '2040-CNV-202']) {
        const a = A[id];
        const run = state.time >= state.stopUntil[id === '2040-CNV-201' ? 0 : 1];
        if (a.belt && run) a.belt.material.map.offset.x -= (0.58 / 0.5) * dt;
      }
      for (const a of Object.values(A)) if (a.fans) a.fans.forEach((f) => (f.rotation.y += dt * 30));
    }
    // halos and status
    pulse.t += dt;
    halos.forEach((h, i) => {
      const s = state.layers.status ? state.status[i] : 0;
      h.material.color.setHex(STATUS_COLOR[s]);
      const base = s === 0 ? 0.0 : 0.38;
      h.material.opacity = base * (0.75 + 0.25 * Math.sin(pulse.t * (s >= 2 ? 5 : 3)));
    });
    // bearing and motor tint follow the status of station 1
    const s1 = state.status[1];
    const brg = A['2040-CNV-202'].brgMat;
    brg.color.setHex(s1 >= 2 ? 0xd03b3b : s1 === 1 ? 0xfab219 : 0x4b515a);
    brg.emissive.setHex(s1 >= 2 ? 0x5a0d0d : 0x000000);
    // vibration shake of the bearing group
    const shake = Math.max(0, state.vib - 1.2) * 0.0009;
    c202.children.forEach((c) => {
      if (c === brgA || c === vt202) c.position.y = BELT_Y - 0.075 + (c === vt202 ? 0.048 : 0) + (Math.random() - 0.5) * shake;
    });
    if (tween) {
      tween.t += dt;
      const k = Math.min(1, tween.t / tween.dur);
      const e = k * k * (3 - 2 * k);
      camera.position.lerpVectors(tween.p0, tween.p1, e);
      controls.target.lerpVectors(tween.t0, tween.t1, e);
      if (k >= 1) tween = null;
    }
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }
  frame();

  return {
    setCursorState({ rates, status, vib, chipText }) {
      state.rates = rates;
      state.status = status;
      state.vib = vib;
      ['2040-CNV-201', '2040-CNV-202', '2040-CPK-301', '2040-CNV-401', '2040-PAL-501'].forEach((id, i) => {
        const c = chips[id];
        c.el.querySelector('.v').textContent = chipText[i];
        c.el.dataset.s = status[i];
      });
    },
    select,
    flyTo,
    setXray(on) {
      state.xray = on;
      applyXray();
    },
    setLayer,
    setPlaying(on) {
      state.playing = on;
    },
    getStopCounts: () => state.stopCount.slice(),
    ids: () => Object.keys(A),
    dispose() {
      cancelAnimationFrame(raf);
      renderer.dispose();
    },
  };
}
