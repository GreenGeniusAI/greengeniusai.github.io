/* =============================================================================
   GreenGenius planter — shared 3D scene
   Builds the real CAD assembly (from assets/model-data.js, exported by
   tools/export_model.py) with product materials. Used by the hero, the
   "inside" scroll story and tools/render.html (still renders).

   World units are millimetres, Z is up. The front of the pot faces -Y (the
   fill port is front-left), the electronics bay and its windows face +Y, and
   the USB-C opening is on the +X wall.
   ========================================================================== */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";

export const META = window.META;
const MESH = window.MESHES;

/* Product colourway: warm-white PETG body on a deep forest tank, lime cap. */
const PARTS = {
  tank:          { color: 0x24392e, rough: 0.62, printed: true },
  top:           { color: 0xeae6da, rough: 0.58, printed: true },
  lid:           { color: 0xeae6da, rough: 0.58, printed: true },
  cap:           { color: 0xb8f14a, rough: 0.5,  printed: true },
  stake:         { color: 0xb8f14a, rough: 0.5 },
  pcb:           { color: 0x1c5a33, rough: 0.45 },
  pump:          { color: 0x2a2c2b, rough: 0.4 },
  pump_cable:    { color: 0xc9483a, rough: 0.5 },
  tube:          { color: 0xd9e2da, rough: 0.25 },
  level_sensor:  { color: 0xc9483a, rough: 0.5 },
  soil_sensor_1: { color: 0x1b1d1c, rough: 0.4 },
  soil_sensor_2: { color: 0x1b1d1c, rough: 0.4 },
  dht:           { color: 0x6fa8d8, rough: 0.5 },
  soil:          { color: 0x3d2a1d, rough: 0.95 },
  water:         { color: 0x5aaee6, rough: 0.08, water: true },
};

const geoCache = {};
function partGeometry(name) {
  if (geoCache[name]) return geoCache[name];
  const e = MESH[name];
  const bytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)).buffer;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(bytes(e.v)), 3));
  g.setIndex(new THREE.BufferAttribute(e.i32 ? new Uint32Array(bytes(e.i)) : new Uint16Array(bytes(e.i)), 1));
  g.computeBoundingBox();
  const bb = g.boundingBox.clone();
  const pivot = new THREE.Vector3((bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, bb.min.z);
  g.translate(-pivot.x, -pivot.y, -pivot.z);
  const smooth = toCreasedNormals(g, THREE.MathUtils.degToRad(32));
  const out = { smooth, indexed: g, pivot, bbox: bb, edges: null };
  return (geoCache[name] = out);
}

/* --------------------------------------------------------------------------
   Procedural plant. The CAD only has placeholder spheres; a marketing render
   wants leaves. Seeded so every render is identical.
   ------------------------------------------------------------------------ */
function rng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

function leafGeometry(len, wid) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(wid * 0.62, len * 0.08, wid * 0.58, len * 0.72, 0, len);
  s.bezierCurveTo(-wid * 0.58, len * 0.72, -wid * 0.62, len * 0.08, 0, 0);
  const g = new THREE.ShapeGeometry(s, 14);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), t = y / len;
    // droop toward the tip, cup along the midrib
    p.setZ(i, -0.32 * len * t * t + 0.22 * Math.abs(x) * (1 - t * 0.4));
  }
  g.computeVertexNormals();
  return g;
}

function makePlant(base) {
  const r = rng(11);
  const plant = new THREE.Group();
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x46702c, roughness: 0.7 });
  const up = new THREE.Vector3(0, 0, 1);
  const N = 11;
  for (let k = 0; k < N; k++) {
    const az = k * 2.39996 + r() * 0.4;
    const h = 30 + (k / N) * 85 + r() * 14;          // height of the leaf joint above soil
    const reach = 14 + r() * 30 + (k % 3) * 6;        // horizontal reach of the stem
    const tip = new THREE.Vector3(base.x + Math.cos(az) * reach, base.y + Math.sin(az) * reach, base.z + h);
    const mid = new THREE.Vector3(base.x + Math.cos(az) * reach * 0.25, base.y + Math.sin(az) * reach * 0.25, base.z + h * 0.6);
    const curve = new THREE.CatmullRomCurve3([base.clone().add(new THREE.Vector3(r() * 4 - 2, r() * 4 - 2, -2)), mid, tip]);
    plant.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 1.3 + r() * 0.5, 6), stemMat));

    const len = 40 + r() * 20, wid = len * (0.66 + r() * 0.1);
    const leafCol = new THREE.Color().setHSL(0.29 + r() * 0.04, 0.55 + r() * 0.12, 0.17 + r() * 0.06);
    const leafMat = new THREE.MeshStandardMaterial({ color: leafCol, roughness: 0.62, side: THREE.DoubleSide, envMapIntensity: 0.3 });
    const leaf = new THREE.Mesh(leafGeometry(len, wid), leafMat);
    const dir = new THREE.Vector3(Math.cos(az), Math.sin(az), 0.35 + r() * 0.5).normalize();
    const xAxis = new THREE.Vector3().crossVectors(dir, up).normalize();
    const zAxis = new THREE.Vector3().crossVectors(xAxis, dir).normalize();
    leaf.matrix.makeBasis(xAxis, dir, zAxis);
    leaf.matrix.setPosition(tip);
    leaf.matrixAutoUpdate = false;
    leaf.castShadow = true;
    plant.add(leaf);
  }
  plant.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return plant;
}

/* --------------------------------------------------------------------------
   Scene
   ------------------------------------------------------------------------ */
export function createPlanter(canvas, opts = {}) {
  const { background = null, shadows = true, preserveDrawingBuffer = false, pixelRatio = Math.min(devicePixelRatio || 1, 2) } = opts;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: background === null, preserveDrawingBuffer });
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  if (background !== null) scene.background = new THREE.Color(background);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environmentIntensity = 0.75;

  const camera = new THREE.PerspectiveCamera(28, 1, 5, 6000);
  camera.up.set(0, 0, 1);
  const target = new THREE.Vector3(0, META.D / 2, 70);

  const key = new THREE.DirectionalLight(0xfff4e6, 2.2);
  key.position.set(-180, -240, 380);
  key.castShadow = shadows;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -220, right: 220, top: 220, bottom: -220, near: 50, far: 1200 });
  key.shadow.bias = -0.0004;
  key.shadow.radius = 6;
  scene.add(key, key.target);
  key.target.position.copy(target);
  const rim = new THREE.DirectionalLight(0xd8f0ff, 0.9);
  rim.position.set(220, 300, 200);
  scene.add(rim);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.ShadowMaterial({ opacity: 0.2 }));
  ground.position.z = -0.2;
  ground.receiveShadow = true;
  scene.add(ground);

  const root = new THREE.Group();
  scene.add(root);

  const parts = {};
  for (const [name, cfg] of Object.entries(PARTS)) {
    if (!MESH[name]) continue;
    const { smooth, indexed, pivot, bbox } = partGeometry(name);
    const mat = new THREE.MeshPhysicalMaterial({
      color: cfg.color, roughness: cfg.rough, metalness: 0,
      clearcoat: cfg.printed ? 0.15 : 0, clearcoatRoughness: 0.6,
      transparent: !!cfg.water, opacity: cfg.water ? 0.55 : 1,
      side: THREE.DoubleSide, emissive: 0xb8f14a, emissiveIntensity: 0,
    });
    const mesh = new THREE.Mesh(smooth, mat);
    mesh.castShadow = !cfg.water;
    mesh.receiveShadow = true;
    const grp = new THREE.Group();
    grp.add(mesh);
    grp.position.copy(pivot);
    let edges = null;
    if (cfg.printed) {
      edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(indexed, 30),
        new THREE.LineBasicMaterial({ color: 0xb8f14a, transparent: true, opacity: 0, depthWrite: false })
      );
      grp.add(edges);
    }
    root.add(grp);
    parts[name] = { name, grp, mesh, mat, edges, cfg, base: pivot.clone(), bbox, state: { o: 1, lift: 0, hl: 0, sz: 1 } };
  }

  // Plant replaces the CAD's placeholder spheres.
  const plantBase = new THREE.Vector3(14, 36, META.soilTop);
  const plant = makePlant(plantBase);
  const plantGrp = new THREE.Group();
  plantGrp.add(plant);
  root.add(plantGrp);
  parts.plant = { name: "plant", grp: plantGrp, mesh: null, mat: null, edges: null, cfg: {}, base: new THREE.Vector3(), bbox: null, state: { o: 1, lift: 0, hl: 0, sz: 1 } };

  /* Apply a state { o: opacity, lift: mm, hl: 0..1 highlight, sz: z-scale } */
  function apply(name, s) {
    const p = parts[name];
    if (!p) return;
    p.state = s;
    p.grp.visible = s.o > 0.01;
    p.grp.position.set(p.base.x, p.base.y, p.base.z + (s.lift || 0));
    p.grp.scale.set(1, 1, Math.max(s.sz ?? 1, 0.001));
    if (name === "plant") {
      p.grp.traverse((o) => {
        if (!o.isMesh) return;
        o.material.transparent = s.o < 0.999;
        o.material.opacity = s.o;
        o.material.depthWrite = s.o > 0.5;
      });
      return;
    }
    const water = !!p.cfg.water;
    const o = water ? 0.55 * s.o : s.o;
    p.mat.transparent = water || o < 0.999;
    p.mat.opacity = o;
    p.mat.depthWrite = water ? false : o > 0.6;
    p.mesh.castShadow = !water && o > 0.6;
    p.mat.emissiveIntensity = (s.hl || 0) * 0.35;
    if (p.edges) p.edges.material.opacity = Math.max(0, (1 - o) * 0.55 - 0.05);
  }

  function sph(az, el, dist, tz = target.z) {
    const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
    const t = new THREE.Vector3(target.x, target.y, tz);
    return {
      pos: new THREE.Vector3(Math.cos(e) * Math.cos(a), Math.cos(e) * Math.sin(a), Math.sin(e)).multiplyScalar(dist).add(t),
      look: t,
    };
  }

  function setView(az, el, dist, tz) {
    const v = sph(az, el, dist, tz);
    camera.position.copy(v.pos);
    camera.lookAt(v.look);
  }

  function resize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  /* Anchor for an HTML label: a fixed point, or "part:top" for a part's top centre. */
  const tmp = new THREE.Vector3();
  function anchor(at) {
    if (Array.isArray(at)) return tmp.set(at[0], at[1], at[2]);
    const [name, where] = at.split(":");
    const p = parts[name];
    const bb = p.bbox;
    tmp.set((bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, where === "top" ? bb.max.z : (bb.min.z + bb.max.z) / 2);
    tmp.z += p.state.lift || 0;
    return tmp;
  }
  function project(at, w, h) {
    const v = anchor(at).clone().project(camera);
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, visible: v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 };
  }

  return {
    THREE, renderer, scene, camera, target, parts, root, apply, setView, resize, project,
    render: () => renderer.render(scene, camera),
    dispose: () => { renderer.dispose(); pmrem.dispose(); },
  };
}

export function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch (e) {
    return false;
  }
}
