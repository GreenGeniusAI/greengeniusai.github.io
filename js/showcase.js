/* GreenGenius — product showcase
   Any .stage with a data-model-src attribute becomes an interactive 3D view.
   Until a model is set, the stage shows its static image or empty state and
   this file loads nothing.

   Usage:
     <div class="stage" data-model-src="models/pot.stl">            one STL
     <div class="stage" data-model-src="models/a.stl, models/b.stl"
          data-model-colors="#e8e6df, #2b2d2c">                       several parts
   STL is assumed to be in millimetres with Z up (CAD convention).
   Three.js is fetched from a CDN only when a model is present. */

// jsDelivr's +esm builds rewrite the add-ons' bare `import "three"` to the same
// pinned build, so no import map is needed and only one copy of three loads.
const CDN = "https://cdn.jsdelivr.net/npm/three@0.160.0";
const stages = [...document.querySelectorAll(".stage[data-model-src]")].filter((s) => s.dataset.modelSrc.trim());

if (stages.length && webglAvailable()) {
  const [THREE, { STLLoader }, { OrbitControls }] = await Promise.all([
    import(`${CDN}/+esm`),
    import(`${CDN}/examples/jsm/loaders/STLLoader.js/+esm`),
    import(`${CDN}/examples/jsm/controls/OrbitControls.js/+esm`),
  ]);
  stages.forEach((stage) => mount(stage, THREE, STLLoader, OrbitControls).catch((err) => {
    console.error("Showcase: could not load model", err);
  }));
}

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch (e) {
    return false;
  }
}

async function mount(stage, THREE, STLLoader, OrbitControls) {
  const srcs = stage.dataset.modelSrc.split(",").map((s) => s.trim()).filter(Boolean);
  const colors = (stage.dataset.modelColors || "").split(",").map((s) => s.trim());
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const loader = new STLLoader();
  const geometries = await Promise.all(srcs.map((src) => loader.loadAsync(src)));

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9bdb8, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(-1, 1.6, 1.2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.6);
  rim.position.set(1.2, 0.8, -1);
  scene.add(rim);

  // CAD is Z-up; rotate the whole model so it stands upright in Y-up space.
  const model = new THREE.Group();
  model.rotation.x = -Math.PI / 2;
  geometries.forEach((g, i) => {
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: colors[i] || "#e6e4dd", roughness: 0.6, metalness: 0 });
    model.add(new THREE.Mesh(g, mat));
  });
  scene.add(model);

  // Centre the model on the origin and fit the camera to it.
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  model.position.sub(centre);
  const radius = size.length() / 2;

  const camera = new THREE.PerspectiveCamera(30, 1, radius / 50, radius * 20);
  const dist = radius / Math.sin(THREE.MathUtils.degToRad(15)) * 0.9;
  camera.position.set(-dist * 0.55, dist * 0.32, dist * 0.78);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = radius * 1.6;
  controls.maxDistance = radius * 6;
  controls.autoRotate = !reduce;          // slow turn so the form reads; stops once the visitor takes over
  controls.autoRotateSpeed = 0.8;
  controls.addEventListener("start", () => { controls.autoRotate = false; });

  stage.querySelectorAll("img, .stage-empty").forEach((el) => el.remove());
  stage.appendChild(renderer.domElement);
  renderer.domElement.setAttribute("aria-label", stage.dataset.modelLabel || "Interactive 3D model. Drag to rotate, scroll or pinch to zoom.");
  renderer.domElement.setAttribute("role", "img");
  const hint = document.createElement("span");
  hint.className = "stage-hint";
  hint.textContent = "Drag to rotate";
  stage.appendChild(hint);

  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  // Render only while the stage is on screen.
  let visible = false, raf = 0;
  const loop = () => {
    controls.update();
    renderer.render(scene, camera);
    raf = visible ? requestAnimationFrame(loop) : 0;
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(loop);
  }).observe(stage);
}
