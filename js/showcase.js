/* GreenGenius — product showcase
   Any element with a data-model-src attribute (the .model-slot on the product
   stage) becomes an interactive 3D view. Until a model is set, nothing loads.

     <div class="model-slot" data-model-src="models/greengenius-v3.glb" data-model-intro="assemble">
     <div class="model-slot" data-model-src="a.stl, b.stl" data-model-colors="#e8e6df, #2b2d2c">

   GLB: nodes are named "<group>__<part>" (base, shell, drawer, band, pot). With
   data-model-intro="assemble" the groups come together once on first view.
   STL: one or more files, coloured by data-model-colors.
   Models are CAD exports in millimetres with Z up. Three.js loads from a CDN
   only when a model is present. */

// jsDelivr's +esm builds rewrite the add-ons' bare `import "three"` to the same
// pinned build, so no import map is needed and only one copy of three loads.
const CDN = "https://cdn.jsdelivr.net/npm/three@0.160.0";
const slots = [...document.querySelectorAll("[data-model-src]")].filter((s) => s.dataset.modelSrc.trim());

if (slots.length && webglAvailable()) {
  const [THREE, { OrbitControls }, { RoomEnvironment }] = await Promise.all([
    import(`${CDN}/+esm`),
    import(`${CDN}/examples/jsm/controls/OrbitControls.js/+esm`),
    import(`${CDN}/examples/jsm/environments/RoomEnvironment.js/+esm`),
  ]);
  for (const slot of slots) {
    mount(slot, THREE, OrbitControls, RoomEnvironment).catch((err) => console.error("Showcase: could not load model", err));
  }
}

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch (e) {
    return false;
  }
}

async function loadModel(slot, THREE) {
  const srcs = slot.dataset.modelSrc.split(",").map((s) => s.trim()).filter(Boolean);
  const group = new THREE.Group();
  if (srcs.length === 1 && /\.glb$/i.test(srcs[0])) {
    const { GLTFLoader } = await import(`${CDN}/examples/jsm/loaders/GLTFLoader.js/+esm`);
    const { toCreasedNormals } = await import(`${CDN}/examples/jsm/utils/BufferGeometryUtils.js/+esm`);
    const gltf = await new GLTFLoader().loadAsync(srcs[0]);
    // CAD tessellation shares vertices across curved faces; rebuild normals so
    // curves shade smoothly while edges sharper than 35° stay crisp.
    gltf.scene.traverse((o) => {
      if (o.isMesh) o.geometry = toCreasedNormals(o.geometry, THREE.MathUtils.degToRad(35));
    });
    group.add(gltf.scene);
  } else {
    const { STLLoader } = await import(`${CDN}/examples/jsm/loaders/STLLoader.js/+esm`);
    const colors = (slot.dataset.modelColors || "").split(",").map((s) => s.trim());
    const loader = new STLLoader();
    const geos = await Promise.all(srcs.map((s) => loader.loadAsync(s)));
    geos.forEach((g, i) => {
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: colors[i] || "#e6e4dd", roughness: 0.6 }));
      mesh.name = `part__${i}`;
      group.add(mesh);
    });
  }
  return group;
}

async function mount(slot, THREE, OrbitControls, RoomEnvironment) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const content = await loadModel(slot, THREE);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  const key = new THREE.DirectionalLight(0xfff3e6, 1.6);
  key.position.set(-1, 1.4, 1.2);
  scene.add(key);

  // CAD is Z-up; stand the model upright in three's Y-up space.
  const model = new THREE.Group();
  model.rotation.x = -Math.PI / 2;
  model.add(content);
  scene.add(model);

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  model.position.sub(centre);
  const radius = size.length() / 2;

  const camera = new THREE.PerspectiveCamera(28, 1, radius / 50, radius * 20);
  const dist = (radius / Math.sin(THREE.MathUtils.degToRad(14))) * 0.92;
  camera.position.set(-dist * 0.5, dist * 0.22, dist * 0.84);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.enableZoom = false;                  // keeps page scroll working over the model
  controls.minPolarAngle = Math.PI * 0.2;
  controls.maxPolarAngle = Math.PI * 0.55;
  controls.autoRotateSpeed = 0.7;
  controls.addEventListener("start", () => { controls.autoRotate = false; });

  slot.appendChild(renderer.domElement);
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.setAttribute("aria-label", slot.dataset.modelLabel || "Interactive 3D model. Drag to rotate.");
  const hint = document.createElement("span");
  hint.className = "stage-hint";
  hint.textContent = "Drag to rotate";
  slot.appendChild(hint);

  /* ---------- assembly intro ----------
     Each group starts displaced and eases into place, in build order. */
  const groups = {};
  content.traverse((o) => {
    if (!o.name || !o.name.includes("__")) return;
    const g = o.name.split("__")[0];
    (groups[g] = groups[g] || []).push({ obj: o, home: o.position.clone() });
  });
  const STEPS = [                               // group, start ms, duration ms, offset in CAD mm [x, y, z]
    ["shell", 0, 900, [0, 0, 110]],
    ["drawer", 650, 900, [0, -170, 0]],
    ["band", 1150, 800, [0, 0, 120]],
    ["pot", 1450, 950, [0, 0, 160]],
  ];
  const playIntro = slot.dataset.modelIntro === "assemble" && !reduce && STEPS.some(([g]) => groups[g]);
  const ease = (t) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);
  const place = (t) => {
    for (const [g, start, dur, off] of STEPS) {
      const k = 1 - ease((t - start) / dur);
      for (const { obj, home } of groups[g] || []) {
        obj.position.set(home.x + off[0] * k, home.y + off[1] * k, home.z + off[2] * k);
      }
    }
  };
  const INTRO_MS = 2500;
  let introStart = null;
  if (playIntro) place(0);
  else controls.autoRotate = !reduce;

  const resize = () => {
    const { width, height } = slot.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(slot);
  resize();
  slot.classList.add("is-loaded");

  // Render only while on screen; the intro starts the first time it is seen.
  let visible = false, raf = 0;
  const loop = (now) => {
    if (playIntro && introStart !== null && introStart !== -1) {
      const t = now - introStart;
      place(t);
      if (t > INTRO_MS) {
        controls.autoRotate = true;
        introStart = -1;                         // done; never replays
      }
    }
    controls.update();
    renderer.render(scene, camera);
    raf = visible ? requestAnimationFrame(loop) : 0;
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && playIntro && introStart === null) introStart = performance.now();
    if (visible && !raf) raf = requestAnimationFrame(loop);
  }, { threshold: 0.3 }).observe(slot);
}
