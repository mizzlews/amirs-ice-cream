import * as THREE from '../vendor/three.module.js';
import { createIceCreamConeModel } from './createIceCreamConeModel.js';

// A procedural environment: a sand-over-cobalt gradient with one bright window,
// so the cream picks up a real reflection without loading an HDR file.
function environmentTexture(renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, 128);
  sky.addColorStop(0, '#fbf3e2');
  sky.addColorStop(0.55, '#e6dbc7');
  sky.addColorStop(1, '#1b3a8f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(16, 10, 34, 26);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(86, 18, 22, 16);
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromEquirectangular(texture).texture;
  pmrem.dispose();
  texture.dispose();
  return envMap;
}

// A soft contact shadow, drawn rather than rendered: shadow maps cost more than this is worth.
function contactShadow() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 6, 128, 128, 126);
  g.addColorStop(0, 'rgba(6,43,138,0.42)');
  g.addColorStop(0.45, 'rgba(6,43,138,0.16)');
  g.addColorStop(1, 'rgba(6,43,138,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 4.4),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -3.02;
  return mesh;
}

export function mountStage(canvas, { onFlavour } = {}) {
  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = window.matchMedia('(pointer: coarse)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.environment = environmentTexture(renderer);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 1.1, 10.4);
  camera.lookAt(0, 0.1, 0);

  const key = new THREE.DirectionalLight('#fff0d8', 2.4);
  key.position.set(-3.4, 5.2, 4.2);
  const rim = new THREE.DirectionalLight('#cfe0ff', 0.9);
  rim.position.set(3.6, 1.4, -4.2);
  const fill = new THREE.HemisphereLight('#f6ecd8', '#0c2f91', 0.85);
  scene.add(key, rim, fill);

  const model = createIceCreamConeModel({ detail: coarse ? 4 : 5 });
  model.position.y = -0.2;
  scene.add(model, contactShadow());

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Keep the cone the same size however the panel is shaped.
    camera.position.z = camera.aspect < 0.9 ? 12.6 : 10.4;
    camera.updateProjectionMatrix();
    camera.lookAt(0, 0.1, 0);
  }
  resize();
  new ResizeObserver(resize).observe(canvas);

  const clock = new THREE.Clock();
  let running = true;
  function frame() {
    if (!running) return;
    const delta = Math.min(clock.getDelta(), 0.05);
    model.userData.update(clock.elapsedTime, delta, reducedQuery.matches);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) { clock.getDelta(); frame(); }
  });

  return {
    setFlavour(id) {
      model.userData.setFlavour(id);
      onFlavour?.(model.userData.getFlavour());
    }
  };
}
