// 3D digital twin of the 2040-CNV-202 head drive unit: frame, head shaft and drum, two pillow block
// bearings, shaft-mounted gearbox with motor, belt, nip guard, vibration transmitter, photoeye,
// and a magnified bearing inspector with a spall that grows with the wear ratio.
// Built from primitives. Units are metres, the shaft axis runs along z at height AX.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const AX = 0.55;
const PRI_COLOR = [0x0ca30c, 0xfab219, 0xd03b3b];
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const geo = new Map();
const bg = (w, h, d) => {
  const k = `${w}|${h}|${d}`;
  if (!geo.has(k)) geo.set(k, new THREE.BoxGeometry(w, h, d));
  return geo.get(k);
};
const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(bg(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
};
const rbox = (w, h, d, r, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
};
const cyl = (r, len, mat, x = 0, y = 0, z = 0, axis = 'y', seg = 32) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.position.set(x, y, z);
  if (axis === 'x') m.rotation.z = Math.PI / 2;
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  m.castShadow = m.receiveShadow = true;
  return m;
};
const std = (color, metalness = 0.2, roughness = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (repeat) t.repeat.set(...repeat);
  return t;
}

function materials() {
  return {
    steel: std(0xbfc5cc, 0.85, 0.3),
    steelDark: std(0x4b515a, 0.7, 0.45),
    frame: std(0xdde1e6, 0.25, 0.55),
    frameDark: std(0x353a42, 0.45, 0.55),
    rubber: std(0x15171a, 0.1, 0.9),
    housing: std(0x6d7681, 0.55, 0.45),
    insert: std(0xa9b0b8, 0.8, 0.35),
    yellow: std(0xf2b705, 0.2, 0.5),
    red: std(0xd03b3b, 0.2, 0.5),
    motor: std(0x2f5fa7, 0.35, 0.5),
    gearbox: std(0x8a96a3, 0.55, 0.45),
    white: std(0xf1f2f3, 0.1, 0.6),
    carton: std(0xc9a46f, 0, 0.85),
    glass: new THREE.MeshStandardMaterial({ color: 0xaec8dc, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0, depthWrite: false }),
    ghost: new THREE.MeshStandardMaterial({ color: 0xaab3bf, transparent: true, opacity: 0.1, depthWrite: false }),
    ledGreen: new THREE.MeshBasicMaterial({ color: 0x31d158 }),
    beam: new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.5 }),
  };
}

function pillowBlock(M, mat) {
  const g = new THREE.Group();
  g.add(box(0.19, 0.025, 0.05, M.steelDark, 0, -0.1075, 0));
  g.add(box(0.1, 0.05, 0.05, mat, 0, -0.07, 0));
  g.add(cyl(0.058, 0.05, mat, 0, 0, 0, 'z', 40));
  g.add(cyl(0.05, 0.056, M.insert, 0, 0, 0, 'z', 40));
  g.add(cyl(0.034, 0.066, M.steel, 0, 0, 0, 'z', 32));
  for (const s of [-1, 1]) {
    g.add(cyl(0.041, 0.004, M.rubber, 0, 0, s * 0.029, 'z', 32));
    g.add(cyl(0.009, 0.012, M.steelDark, s * 0.075, -0.088, 0, 'y', 6));
    g.add(cyl(0.005, 0.016, M.steelDark, 0.0, 0.035, s * 0.036, 'y', 8));
  }
  g.add(cyl(0.005, 0.02, M.steel, 0, 0.068, 0));
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 12, 10), M.steel);
  ball.position.set(0, 0.082, 0);
  g.add(ball);
  return g;
}

function finnedMotor(M) {
  const g = new THREE.Group(); // axis along +z from 0 to 0.55
  const pts = [new THREE.Vector2(0, 0)];
  const len = 0.34;
  for (let i = 0; i < 16; i++) {
    const y = 0.02 + i * ((len - 0.05) / 16);
    pts.push(new THREE.Vector2(0.075, y), new THREE.Vector2(0.092, y + 0.004), new THREE.Vector2(0.092, y + 0.012), new THREE.Vector2(0.075, y + 0.016));
  }
  pts.push(new THREE.Vector2(0.075, len), new THREE.Vector2(0, len));
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), M.motor);
  body.rotation.x = Math.PI / 2;
  body.position.z = 0.02;
  body.castShadow = true;
  g.add(body);
  g.add(cyl(0.085, 0.07, M.steelDark, 0, 0, 0.405, 'z'));
  const fan = cyl(0.062, 0.012, M.steel, 0, 0, 0.45, 'z', 18);
  g.add(fan);
  g.add(rbox(0.1, 0.07, 0.1, 0.01, M.steelDark, 0, 0.11, 0.2));
  g.add(cyl(0.012, 0.03, M.steel, 0.055, 0.11, 0.2, 'x'));
  g.add(box(0.07, 0.035, 0.004, M.white, 0, 0.0, 0.0).translateY(0.095).translateZ(0.3));
  g.userData.fan = fan;
  return g;
}

// ---- magnified bearing inspector (half section, so the balls and the raceway are visible) ----
function bearingInspector(M, geom) {
  const Rp = geom.pitchDiameterMm / 2000;
  const rb = geom.ballDiameterMm / 2000;
  const rOutIn = Rp + rb;
  const rInOut = Rp - rb;
  const t = 0.0045;
  const w = 0.017;
  const root = new THREE.Group();
  const lathe = (r0, r1, y0, y1, mat, seg = 72) => {
    const p = [new THREE.Vector2(r0, y0), new THREE.Vector2(r1, y0), new THREE.Vector2(r1, y1), new THREE.Vector2(r0, y1), new THREE.Vector2(r0, y0)];
    const m = new THREE.Mesh(new THREE.LatheGeometry(p, seg), mat);
    m.rotation.x = Math.PI / 2;
    m.castShadow = m.receiveShadow = true;
    return m;
  };
  const outerMat = M.steel.clone();
  const outer = lathe(rOutIn, rOutIn + t, -w / 2, 0, outerMat); // half width, opening faces +z
  root.add(outer);
  const inner = new THREE.Group();
  inner.add(lathe(rInOut - t, rInOut, -w / 2, w / 2, M.steel));
  inner.add(box(0.0035, 0.004, w, M.steelDark, 0, rInOut - t, 0)); // key mark
  root.add(inner);
  const cage = new THREE.Group();
  const balls = [];
  const ballMat = std(0xe3e6ea, 0.95, 0.18);
  for (let k = 0; k < geom.N; k++) {
    const a = (k / geom.N) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.SphereGeometry(rb, 28, 20), ballMat);
    b.position.set(Math.cos(a) * Rp, Math.sin(a) * Rp, 0);
    b.castShadow = true;
    cage.add(b);
    balls.push(b);
    const bar = box(rb * 0.5, 0.0008, 0.0014, M.yellow, Math.cos(a) * Rp, Math.sin(a) * Rp, rb * 0.95);
    bar.rotation.z = a;
    cage.add(bar);
  }
  for (const z of [-rb * 0.7, rb * 0.7]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(Rp, 0.0006, 8, 90), M.yellow);
    ring.position.z = z;
    cage.add(ring);
  }
  root.add(cage);
  // spall on the outer raceway, at a fixed angle in the load zone
  const spallAngle = -Math.PI / 2 - 0.45;
  const spall = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial({ color: 0x2a2a2d, roughness: 0.9, emissive: 0x000000 }));
  spall.position.set(Math.cos(spallAngle) * (rOutIn - 0.0002), Math.sin(spallAngle) * (rOutIn - 0.0002), -w / 4);
  spall.scale.set(0.0003, 0.0003, 0.0003);
  root.add(spall);
  return { root, inner, cage, balls, spall, spallAngle, outerMat, geom };
}

export function createMachine(container, { onSelect, geometry, ratios }) {
  const M = materials();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeceef1);
  scene.fog = new THREE.Fog(0xeceef1, 12, 30);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
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

  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 60);
  const controls = new OrbitControls(camera, labelRenderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 0.4;
  controls.maxDistance = 12;

  scene.add(new THREE.HemisphereLight(0xffffff, 0xc9ced6, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(3, 5, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 14 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.01;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xdde8ff, 0.6);
  fill.position.set(-4, 3, -3);
  scene.add(fill);

  const floorTex = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#e3e5e8';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#d2d5da';
    c.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      c.beginPath(); c.moveTo((i * w) / 4, 0); c.lineTo((i * w) / 4, h); c.stroke();
      c.beginPath(); c.moveTo(0, (i * h) / 4); c.lineTo(w, (i * h) / 4); c.stroke();
    }
  }, [8, 8]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const machine = new THREE.Group();
  scene.add(machine);
  const parts = {};
  const addPart = (id, group, explode, anchor, chipLabel) => {
    group.userData.partId = id;
    group.traverse((o) => o.isMesh && (o.userData.partId = id));
    machine.add(group);
    parts[id] = { id, group, explode, anchor, home: group.position.clone() };
  };

  // ---------- FRM: skid, stands, plates, belt frame, torque arm ----------
  {
    const g = new THREE.Group();
    g.add(box(1.9, 0.03, 1.9, M.frameDark, -0.45, 0.015, 0));
    for (const z of [-0.5, 0.5]) {
      g.add(box(0.14, 0.38, 0.08, M.frame, 0, 0.22, z));
      g.add(box(0.3, 0.02, 0.1, M.steelDark, 0, 0.42, z));
      g.add(box(0.04, 0.14, 0.16, M.steelDark, 0.0, AX, z * 0.86));
    }
    for (const z of [-0.36, 0.36]) {
      g.add(box(1.25, 0.14, 0.035, M.frame, -0.625, AX, z));
      g.add(box(1.25, 0.022, 0.07, M.steel, -0.625, AX + 0.082, z));
      g.add(box(0.04, 0.52, 0.04, M.frame, -1.15, 0.29, z));
      g.add(box(0.04, 0.52, 0.04, M.frame, -0.4, 0.29, z));
      g.add(cyl(0.04, 0.02, M.steelDark, -1.15, 0.03, z));
    }
    // torque arm: link from the gearbox lug down to the skid
    g.add(cyl(0.011, 0.42, M.steel, 0.0, 0.24, 0.72));
    g.add(cyl(0.022, 0.026, M.steelDark, 0.0, 0.03 + 0.013, 0.72));
    g.add(box(0.07, 0.016, 0.07, M.steelDark, 0.0, 0.038, 0.72));
    addPart('2040-FRM-202', g, V(0, -0.28, 0), V(-0.95, 0.2, 0.36));
  }

  // ---------- SHF: head shaft and drum ----------
  const shaftGroup = new THREE.Group();
  {
    shaftGroup.add(cyl(0.0175, 1.48, M.steel, 0, AX, 0.12, 'z', 28));
    const drum = new THREE.Group();
    const lag = cyl(0.0835, 0.6, M.rubber, 0, 0, 0, 'z', 48);
    drum.add(lag);
    drum.add(cyl(0.08, 0.62, M.steelDark, 0, 0, 0, 'z', 48));
    for (const s of [-1, 1]) {
      drum.add(cyl(0.05, 0.012, M.steel, 0, 0, s * 0.315, 'z', 32));
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        drum.add(cyl(0.004, 0.014, M.steelDark, Math.cos(a) * 0.035, Math.sin(a) * 0.035, s * 0.322, 'z', 8));
      }
    }
    drum.position.set(0, AX, 0);
    shaftGroup.add(drum);
    shaftGroup.userData.drum = drum;
    shaftGroup.add(box(0.008, 0.008, 0.05, M.steelDark, 0.0175, AX, 0.84)); // key
    shaftGroup.add(cyl(0.02, 0.01, M.steelDark, 0, AX, 0.865, 'z', 24));
    addPart('2040-SHF-202', shaftGroup, V(0, 0.2, 0), V(0.0, AX + 0.24, -0.25));
  }

  // ---------- bearings ----------
  const brgMatA = M.housing.clone();
  const brgA = pillowBlock(M, brgMatA);
  brgA.position.set(0, AX, 0.5);
  addPart('2040-BRG-202A', brgA, V(0, 0, 0.42), V(0.0, AX - 0.2, 0.5));
  const brgB = pillowBlock(M, M.housing.clone());
  brgB.position.set(0, AX, -0.5);
  brgB.rotation.y = Math.PI;
  addPart('2040-BRG-202B', brgB, V(0, 0, -0.42), V(0.0, AX - 0.2, -0.5));

  // ---------- GBX and MTR ----------
  {
    const g = new THREE.Group();
    g.add(rbox(0.22, 0.22, 0.2, 0.025, M.gearbox, 0, AX, 0.72));
    g.add(cyl(0.05, 0.03, M.steelDark, 0, AX, 0.595, 'z', 32));
    g.add(cyl(0.03, 0.02, M.steel, 0, AX, 0.835, 'z', 24));
    g.add(cyl(0.012, 0.03, M.steelDark, 0.04, AX + 0.115, 0.7)); // breather
    g.add(box(0.04, 0.05, 0.05, M.steelDark, 0.0, AX - 0.12, 0.72)); // torque lug
    g.add(box(0.03, 0.04, 0.003, M.white, 0.0, AX + 0.02, 0.8205));
    addPart('2040-GBX-202', g, V(0, 0, 0.55), V(-0.15, AX - 0.15, 0.72));
  }
  const motor = finnedMotor(M);
  motor.rotation.y = Math.PI / 2;
  motor.position.set(0.11, AX, 0.72);
  addPart('2040-MTR-202', motor, V(0.32, 0, 0.55), V(0.4, AX + 0.15, 0.72));

  // ---------- BLT: belt, tail roller, cartons ----------
  const beltTex = canvasTex(64, 128, (c, w, h) => {
    c.fillStyle = '#1b1d21';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#2a2d33';
    for (let x = 0; x < w; x += 16) c.fillRect(x, 0, 3, h);
  }, [2.5, 1]);
  const beltGroup = new THREE.Group();
  const cartons = [];
  let belt;
  {
    const rr = 0.0835;
    const mat = new THREE.MeshStandardMaterial({ map: beltTex, roughness: 0.92, metalness: 0.05 });
    belt = new THREE.Mesh(bg(1.25, 0.006, 0.6), mat);
    belt.position.set(-0.625, AX + rr + 0.003, 0);
    belt.receiveShadow = true;
    beltGroup.add(belt);
    beltGroup.add(box(1.25, 0.006, 0.6, M.rubber, -0.625, AX - rr - 0.003, 0));
    const wrap = (cx, sign) => {
      const s = new THREE.Shape();
      s.absarc(0, 0, rr + 0.006, -Math.PI / 2, Math.PI / 2, false);
      s.absarc(0, 0, rr, Math.PI / 2, -Math.PI / 2, true);
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.6, bevelEnabled: false, curveSegments: 24 }), M.rubber);
      m.position.set(cx, AX, -0.3);
      if (sign < 0) m.rotation.y = Math.PI, (m.position.z = 0.3);
      m.castShadow = true;
      return m;
    };
    beltGroup.add(wrap(0, 1));
    beltGroup.add(wrap(-1.25, -1));
    beltGroup.add(cyl(0.08, 0.6, M.steelDark, -1.25, AX, 0, 'z', 40));
    beltGroup.add(cyl(0.0175, 0.8, M.steel, -1.25, AX, 0, 'z', 20));
    for (let i = 0; i < 3; i++) {
      const c = box(0.3, 0.14, 0.3, M.carton, 0, AX + rr + 0.006 + 0.07, 0);
      c.userData.phase = i / 3;
      cartons.push(c);
      beltGroup.add(c);
    }
    addPart('2040-BLT-202', beltGroup, V(-0.35, 0.1, 0), V(-0.9, AX + 0.3, 0));
  }

  // ---------- GRD: nip guard ----------
  {
    const g = new THREE.Group();
    g.add(box(0.3, 0.3, 0.76, M.glass, 0.06, AX + 0.02, 0));
    for (const z of [-0.38, 0.38]) for (const y of [AX - 0.13, AX + 0.17]) g.add(box(0.3, 0.018, 0.018, M.yellow, 0.06, y, z));
    for (const x of [-0.09, 0.21]) for (const z of [-0.38, 0.38]) g.add(box(0.018, 0.3, 0.018, M.yellow, x, AX + 0.02, z));
    for (const x of [-0.09, 0.21]) for (const y of [AX - 0.13, AX + 0.17]) g.add(box(0.018, 0.018, 0.76, M.yellow, x, y, 0));
    addPart('2040-GRD-202', g, V(0, 0.4, 0), V(0.15, AX + 0.36, -0.38));
  }

  // ---------- VT: vibration transmitter ----------
  {
    const g = new THREE.Group();
    g.add(cyl(0.012, 0.03, M.steel, 0, AX + 0.0745, 0.5, 'y', 6));
    g.add(cyl(0.017, 0.032, M.steelDark, 0, AX + 0.105, 0.5));
    g.add(cyl(0.012, 0.012, M.red, 0, AX + 0.127, 0.5));
    const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, AX + 0.13, 0.5), V(0.05, AX + 0.2, 0.5), V(0.18, AX + 0.18, 0.55), V(0.2, AX - 0.1, 0.6)]), 20, 0.004, 6), M.rubber);
    g.add(cable);
    addPart('2040-VT-202', g, V(0, 0.5, 0.0), V(0.1, AX + 0.28, 0.5));
  }

  // ---------- ZS: photoeye ----------
  {
    const g = new THREE.Group();
    const x = -0.75;
    const y = AX + 0.2;
    g.add(box(0.035, 0.035, 0.06, M.steel, x, y, 0.41));
    const led = box(0.012, 0.012, 0.008, M.ledGreen.clone(), x, y + 0.025, 0.41);
    g.add(led);
    g.add(box(0.05, 0.05, 0.012, M.red, x, y, -0.41));
    g.add(box(0.03, 0.12, 0.03, M.steelDark, x, y - 0.075, 0.41));
    g.add(box(0.03, 0.12, 0.03, M.steelDark, x, y - 0.075, -0.41));
    const bm = cyl(0.004, 0.76, M.beam.clone(), x, y, 0, 'z', 6);
    g.add(bm);
    g.userData = { led, bm };
    addPart('2040-ZS-202', g, V(0, 0.4, 0), V(x, y + 0.1, 0.41));
  }

  // ---------- bearing inspector ----------
  const insp = bearingInspector(M, geometry);
  const inspHolder = new THREE.Group();
  inspHolder.position.set(1.5, 0.78, -0.05);
  inspHolder.scale.setScalar(7);
  inspHolder.add(insp.root);
  scene.add(inspHolder);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.05, 40), M.frameDark);
  stand.position.set(1.5, 0.025, -0.05);
  stand.receiveShadow = true;
  scene.add(stand);
  scene.add(cyl(0.018, 0.5, M.steelDark, 1.5, 0.28, -0.05));
  const leader = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0.07, AX + 0.02, 0.5), V(0.55, 0.9, 0.3), V(1.2, 0.82, 0.0)]), new THREE.LineDashedMaterial({ color: 0x2a78d6, dashSize: 0.03, gapSize: 0.02 }));
  leader.computeLineDistances();
  scene.add(leader);

  // ---------- chips ----------
  const chips = {};
  const addChip = (id, text, pos, parent) => {
    const el = document.createElement('button');
    el.className = 'tag3d';
    el.innerHTML = `<span class="dot"></span><span class="t">${text}</span><span class="v"></span>`;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onSelect && onSelect(id);
    });
    const o = new CSS2DObject(el);
    o.position.copy(pos);
    parent.add(o);
    chips[id] = { el, obj: o };
  };
  for (const p of Object.values(parts)) addChip(p.id, p.id.replace('2040-', ''), p.anchor, p.group);
  const inspChip = document.createElement('div');
  inspChip.className = 'tag3d plain';
  inspChip.innerHTML = '<span class="t">Bearing inspector, BRG-202A, 7x</span>';
  const inspObj = new CSS2DObject(inspChip);
  inspObj.position.set(1.5, 1.3, -0.05);
  scene.add(inspObj);

  // ---------- state ----------
  const state = { time: 0, explode: 0, wear: 1, selected: null, xray: false, flash: 0, prevAng: insp.balls.map(() => 0), rpm: 69, playing: true, vibShake: 0 };
  const pickables = [];
  Object.values(parts).forEach((p) => p.group.traverse((o) => o.isMesh && pickables.push(o)));
  insp.root.traverse((o) => {
    if (o.isMesh) {
      o.userData.partId = '2040-BRG-202A';
      pickables.push(o);
    }
  });
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pick = (ev) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    return hit ? hit.object.userData.partId : null;
  };
  let downAt = null;
  labelRenderer.domElement.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
  labelRenderer.domElement.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
    onSelect && onSelect(pick(e));
  });
  labelRenderer.domElement.addEventListener('pointermove', (e) => (labelRenderer.domElement.style.cursor = pick(e) ? 'pointer' : 'grab'));

  const brackets = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x2a78d6, depthTest: false, transparent: true }));
  brackets.renderOrder = 999;
  brackets.visible = false;
  scene.add(brackets);
  function setBrackets(b3) {
    const { min, max } = b3;
    const pts = [];
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
      const sx = x === min.x ? 1 : -1;
      const sy = y === min.y ? 1 : -1;
      const sz = z === min.z ? 1 : -1;
      const e = (a, b) => Math.min(0.06, (b - a) / 3);
      pts.push(x, y, z, x + sx * e(min.x, max.x), y, z, x, y, z, x, y + sy * e(min.y, max.y), z, x, y, z, x, y, z + sz * e(min.z, max.z));
    }
    brackets.geometry.dispose();
    brackets.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    brackets.visible = true;
  }

  const PRESETS = {
    whole: { pos: V(2.5, 1.6, 3.0), target: V(0.5, 0.5, 0.1) },
    '2040-BRG-202A': { pos: V(1.0, 0.95, 1.25), target: V(0.35, 0.6, 0.45) },
    '2040-BRG-202B': { pos: V(-0.9, 0.95, -1.35), target: V(0, 0.55, -0.5) },
    '2040-SHF-202': { pos: V(1.2, 1.3, 1.9), target: V(0, 0.55, 0.1) },
    '2040-GBX-202': { pos: V(1.2, 1.1, 1.7), target: V(0.1, 0.55, 0.72) },
    '2040-MTR-202': { pos: V(1.6, 1.1, 1.7), target: V(0.33, 0.55, 0.72) },
    '2040-BLT-202': { pos: V(-0.4, 1.4, 2.2), target: V(-0.55, 0.6, 0) },
    '2040-FRM-202': { pos: V(1.8, 1.0, 2.2), target: V(-0.2, 0.3, 0.1) },
    '2040-GRD-202': { pos: V(1.0, 1.3, 1.6), target: V(0.06, 0.6, 0) },
    '2040-VT-202': { pos: V(0.7, 1.1, 1.1), target: V(0.05, 0.65, 0.5) },
    '2040-ZS-202': { pos: V(-0.2, 1.1, 1.5), target: V(-0.75, 0.75, 0.2) },
    inspector: { pos: V(3.1, 1.15, 2.1), target: V(0.95, 0.7, 0.2) },
  };
  const wholeFor = (aspect) => {
    const p = PRESETS.whole;
    const k = Math.max(1, 1.2 / Math.max(0.4, aspect));
    return { pos: p.target.clone().add(p.pos.clone().sub(p.target).multiplyScalar(k)), target: p.target.clone() };
  };
  let tween = null;
  function flyTo(key, dur = 1.0) {
    const p = key === 'whole' || !PRESETS[key] ? wholeFor(camera.aspect) : PRESETS[key];
    tween = { t: 0, dur, p0: camera.position.clone(), t0: controls.target.clone(), p1: p.pos.clone(), t1: p.target.clone() };
  }
  function applyXray() {
    for (const p of Object.values(parts)) {
      p.group.traverse((o) => {
        if (!o.isMesh) return;
        if (!o.userData.m0) o.userData.m0 = o.material;
        o.material = state.xray && state.selected && p.id !== state.selected ? M.ghost : o.userData.m0;
      });
    }
  }
  function select(id) {
    state.selected = id;
    if (id && parts[id]) setBrackets(new THREE.Box3().setFromObject(parts[id].group));
    else brackets.visible = false;
    for (const [k, c] of Object.entries(chips)) c.el.classList.toggle('selected', k === id);
    applyXray();
    flyTo(id === '2040-BRG-202A' ? 'inspector' : id || 'whole');
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

  const clock = new THREE.Clock();
  const ratio = { cage: ratios.ftf, rowSpeed: 0.28 };
  let raf = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta());
    if (state.playing) {
      state.time += dt;
      shaftGroup.userData.drum.rotation.z -= dt * 1.15 * 0.5 * Math.PI * 2 * 0.5;
      beltTex.offset.x -= dt * 0.578 / 0.5 * 0.4;
      cartons.forEach((c, i) => {
        const u = (state.time * 0.35 + c.userData.phase) % 1;
        c.position.x = -1.1 + u * 1.0;
      });
      insp.inner.rotation.z -= dt * ratio.rowSpeed * Math.PI * 2;
      insp.cage.rotation.z -= dt * ratio.rowSpeed * ratio.cage * Math.PI * 2;
      motor.userData.fan && (motor.userData.fan.rotation.y += dt * 30);
    }
    // defect impact flash when a ball passes the spall
    let hit = false;
    insp.balls.forEach((b, i) => {
      const a = Math.atan2(b.getWorldPosition(new THREE.Vector3()).y - inspHolder.position.y, b.getWorldPosition(new THREE.Vector3()).x - inspHolder.position.x);
      const d = Math.atan2(Math.sin(a - insp.spallAngle), Math.cos(a - insp.spallAngle));
      const prev = state.prevAng[i];
      if (prev < 0 && d >= 0 && Math.abs(d) < 0.5) hit = true;
      state.prevAng[i] = d;
    });
    if (hit) state.flash = 1;
    state.flash *= Math.exp(-dt * 7);
    const sev = Math.max(0, Math.min(1, (state.wear - 1.2) / 2.8));
    const size = 0.0004 + sev * 0.0042;
    insp.spall.scale.set(size, size, size * 0.5);
    insp.spall.material.emissive.setRGB(1, 0.15, 0.05);
    insp.spall.material.emissiveIntensity = state.flash * (0.2 + sev * 1.8);
    insp.spall.material.color.setHex(sev > 0.05 ? 0x3a1f1f : 0x2a2a2d);
    // housing tint with wear zone and shake with vibration
    const z = state.zone;
    brgMatA.color.setHex(z >= 2 ? 0xa04545 : z === 1 ? 0xb59a52 : 0x6d7681);
    const shake = Math.max(0, state.wear - 1.3) * 0.0006;
    brgA.position.y = AX + (Math.random() - 0.5) * shake;
    // explode
    for (const p of Object.values(parts)) {
      p.group.position.set(p.home.x + p.explode.x * state.explode, p.home.y + p.explode.y * state.explode, p.home.z + p.explode.z * state.explode);
    }
    // photoeye beam
    const ze = parts['2040-ZS-202'].group.userData;
    ze.bm.material.opacity = 0.35 + 0.1 * Math.sin(state.time * 8);
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
    setState({ wear, zone, chipInfo }) {
      state.wear = wear;
      state.zone = zone;
      for (const [id, c] of Object.entries(chipInfo || {})) {
        const ch = chips[id];
        if (!ch) continue;
        ch.el.dataset.p = c.level;
        ch.el.querySelector('.v').textContent = c.text;
      }
    },
    select,
    flyTo,
    setExplode(v) {
      state.explode = v;
      if (state.selected && parts[state.selected]) setBrackets(new THREE.Box3().setFromObject(parts[state.selected].group));
    },
    setXray(on) {
      state.xray = on;
      applyXray();
    },
    setPlaying(on) {
      state.playing = on;
    },
    setLabels(on) {
      labelRenderer.domElement.style.display = on ? '' : 'none';
    },
    async exportGLB() {
      const root = new THREE.Group();
      root.name = '2040-CNV-202 head drive unit';
      const saved = Object.values(parts).map((p) => p.group.position.clone());
      Object.values(parts).forEach((p) => p.group.position.copy(p.home));
      machine.children.forEach((c) => root.add(c.clone(true)));
      const inspClone = inspHolder.clone(true);
      inspClone.name = 'bearing inspector 7x';
      root.add(inspClone);
      Object.values(parts).forEach((p, i) => p.group.position.copy(saved[i]));
      const exporter = new GLTFExporter();
      return await new Promise((res, rej) => exporter.parse(root, res, rej, { binary: true }));
    },
    ids: () => Object.keys(parts),
    anchorScreen(id) {
      const p = parts[id];
      if (!p) return null;
      const v = p.group.localToWorld(p.anchor.clone()).project(camera);
      return { x: (v.x * 0.5 + 0.5) * container.clientWidth, y: (-v.y * 0.5 + 0.5) * container.clientHeight };
    },
    dispose() {
      cancelAnimationFrame(raf);
      renderer.dispose();
    },
  };
}
