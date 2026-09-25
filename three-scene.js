// ============================================================
// KAIZOU PEN — three.js layer
// ------------------------------------------------------------
// 1. A fixed full-screen canvas behind the page with drifting particles.
// 2. A 3D spinning pen that starts in the hero, can be spun by dragging,
//    and flies down to the shop heading as the page scrolls.
// 3. window.KZ3D.mountPdp / unmountPdp — a 360° viewer for the product modal.
// If WebGL is unavailable nothing happens and the pen.png fallback stays.
// ============================================================
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FOV = 35;
const CAM_Z = 10;
const PEN_LEN = 4.1;               // world length of the pen model incl. caps
const clamp01 = v => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';
const isMobile = () => innerWidth <= 900;

// ============ PEN MODEL ============
function createPen({ body = '#f4f4f6', bandA = '#ff1478', bandB = '#12b8ff' } = {}) {
  const pen = new THREE.Group();
  const seg = 48;
  const bodyMat  = new THREE.MeshPhysicalMaterial({ color: body, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 });
  const metalMat = new THREE.MeshStandardMaterial({ color: '#dadce2', metalness: 1, roughness: 0.2 });
  const darkMat  = new THREE.MeshStandardMaterial({ color: '#15151c', roughness: 0.45 });
  const bandAMat = new THREE.MeshPhysicalMaterial({ color: bandA, roughness: 0.3, clearcoat: 1 });
  const bandBMat = new THREE.MeshPhysicalMaterial({ color: bandB, roughness: 0.3, clearcoat: 1 });

  const cyl = (r, y0, y1, mat) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, y1 - y0, seg), mat);
    m.position.y = (y0 + y1) / 2;
    pen.add(m);
  };

  cyl(0.13, -1.55, 1.55, bodyMat);                     // main barrel
  for (const s of [1, -1]) {
    cyl(0.122, s > 0 ? 1.55 : -1.93, s > 0 ? 1.93 : -1.55, metalMat);   // metal caps
    cyl(0.137, s > 0 ? 1.52 : -1.58, s > 0 ? 1.58 : -1.52, darkMat);    // cap seam
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.122, seg, 16), metalMat);
    tip.scale.y = 0.55;
    tip.position.y = s * 1.93;
    pen.add(tip);
  }
  cyl(0.136, 1.18, 1.36, bandAMat);                    // grip bands
  cyl(0.136, -1.36, -1.18, bandBMat);
  cyl(0.134, -0.03, 0.03, darkMat);                    // balance mark

  pen.rotation.z = Math.PI / 2;                        // lie along X
  const holder = new THREE.Group();
  holder.add(pen);
  holder.userData.bodyMat = bodyMat;
  return holder;
}

function addLights(scene, renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const key = new THREE.DirectionalLight('#ffffff', 1.4);
  key.position.set(3, 5, 6);
  const warm = new THREE.PointLight('#ff4500', 28, 0, 2);
  warm.position.set(-4, 2, 3);
  const cool = new THREE.PointLight('#0057ff', 28, 0, 2);
  cool.position.set(4, -2, 3);
  scene.add(key, warm, cool);
}

function makeRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

// ============ PARTICLES ============
function createParticles(count) {
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 64;
  const g = sprite.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);

  const palette = ['#ff4500', '#0057ff', '#ff1478', '#9aa0b4'].map(c => new THREE.Color(c));
  const seeds = new Float32Array(count * 4);   // u, v, z, speed
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    seeds[i * 4]     = Math.random() * 2 - 1;
    seeds[i * 4 + 1] = Math.random();
    seeds[i * 4 + 2] = lerp(-7, 3, Math.random());
    seeds[i * 4 + 3] = lerp(0.4, 1.2, Math.random());
    palette[i % palette.length].toArray(col, i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.07, map: new THREE.CanvasTexture(sprite), vertexColors: true,
    transparent: true, depthWrite: false, sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  const applyTheme = () => {
    mat.blending = isDark() ? THREE.AdditiveBlending : THREE.NormalBlending;
    mat.opacity = isDark() ? 0.9 : 0.5;
    mat.needsUpdate = true;
  };
  applyTheme();

  const update = (scrollY, time, halfW, halfH) => {
    for (let i = 0; i < count; i++) {
      const u = seeds[i * 4], v = seeds[i * 4 + 1], z = seeds[i * 4 + 2], sp = seeds[i * 4 + 3];
      const depth = (CAM_Z - z) / CAM_Z;           // farther = larger visible area
      const near = 1 / depth;                       // nearer = faster parallax
      const off = (scrollY / innerHeight) * 0.35 * near * sp + (REDUCED ? 0 : time * 0.012 * sp);
      const vv = ((v + off) % 1 + 1) % 1;
      pos[i * 3]     = u * halfW * depth * 1.1 + (REDUCED ? 0 : Math.sin(time * 0.3 * sp + i) * 0.08);
      pos[i * 3 + 1] = (vv * 2 - 1) * halfH * depth * 1.1;
      pos[i * 3 + 2] = z;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return { points, update, applyTheme };
}

// ============ MAIN PAGE SCENE ============
function initPage() {
  const heroVisual = document.querySelector('.hero-visual');
  const canvas = document.createElement('canvas');
  canvas.id = 'kz3d';
  canvas.setAttribute('aria-hidden', 'true');
  const noise = document.querySelector('.bg-noise');
  (noise || document.body.firstChild).after(canvas);

  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.1, 100);
  camera.position.z = CAM_Z;
  addLights(scene, renderer);

  const particles = createParticles(isMobile() ? 450 : 1100);
  scene.add(particles.points);

  // anchor (screen position + scale) > tilt (viewing angle) > spinner (spin) > pen
  const anchor = new THREE.Group();
  const tilt = new THREE.Group();
  const spinner = new THREE.Group();
  const pen = createPen();
  spinner.add(pen);
  tilt.add(spinner);
  anchor.add(tilt);
  scene.add(anchor);

  const halfH = () => CAM_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const worldPerPx = () => (2 * halfH()) / innerHeight;
  const toWorld = (x, y) => {
    const k = worldPerPx();
    return [(x - innerWidth / 2) * k, -(y - innerHeight / 2) * k];
  };

  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  resize();
  addEventListener('resize', resize);

  // ---- pointer parallax + drag to spin ----
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener('pointermove', e => {
    pointer.x = e.clientX / innerWidth * 2 - 1;
    pointer.y = e.clientY / innerHeight * 2 - 1;
  }, { passive: true });

  const BASE_SPIN = REDUCED ? 0.4 : 3.2;           // rad/s
  let spinAngle = 0, spinVel = BASE_SPIN, dragging = false, lastX = 0, lastT = 0;
  if (heroVisual) {
    heroVisual.addEventListener('pointerdown', e => {
      dragging = true; lastX = e.clientX; lastT = performance.now();
      heroVisual.classList.add('dragging');
      heroVisual.setPointerCapture(e.pointerId);
    });
    heroVisual.addEventListener('pointermove', e => {
      if (!dragging) return;
      const now = performance.now();
      const dx = e.clientX - lastX;
      spinAngle -= dx * 0.012;
      spinVel = -dx * 0.012 / Math.max(0.008, (now - lastT) / 1000);
      lastX = e.clientX; lastT = now;
    });
    const end = () => { dragging = false; heroVisual.classList.remove('dragging'); };
    heroVisual.addEventListener('pointerup', end);
    heroVisual.addEventListener('pointercancel', end);
  }

  new MutationObserver(particles.applyTheme)
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // ---- scroll choreography: hero → shop heading ----
  const landingEl = document.querySelector('#shop .section-head');
  const docTop = el => el.getBoundingClientRect().top + scrollY;

  const clock = new THREE.Clock();
  const tick = () => {
    requestAnimationFrame(tick);
    if (document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;

    pointer.sx = lerp(pointer.sx, pointer.x, 0.05);
    pointer.sy = lerp(pointer.sy, pointer.y, 0.05);

    const hr = heroVisual.getBoundingClientRect();
    const heroX = hr.left + hr.width / 2, heroY = hr.top + hr.height / 2;
    const heroLen = Math.min(hr.width, hr.height) * (isMobile() ? 0.8 : 0.72);

    let t = 0, landX = heroX, landY = heroY, landLen = heroLen;
    if (landingEl) {
      const lr = landingEl.getBoundingClientRect();
      const endScroll = Math.max(1, docTop(landingEl) - innerHeight * 0.3);
      t = clamp01(scrollY / endScroll);
      if (isMobile()) {                            // phones: beside the "/ collection" tag
        landLen = 110;
        landX = innerWidth - landLen / 2 - 24;
        landY = lr.top + 10;
      } else {                                     // desktop: just right of the title
        landLen = 170;
        landX = Math.min(lr.right + landLen / 2 + 32, innerWidth - landLen / 2 - 32);
        landY = lr.top + lr.height * 0.4;
      }
    }
    const e = ease(t);
    const arc = Math.sin(Math.PI * e) * innerWidth * (isMobile() ? 0.05 : 0.18);
    const [wx, wy] = toWorld(lerp(heroX, landX, e) - arc, lerp(heroY, landY, e));
    anchor.position.set(wx, wy, 0);
    anchor.scale.setScalar(Math.max(0.0001, lerp(heroLen, landLen, e) * worldPerPx() / PEN_LEN));
    anchor.visible = anchor.scale.x > 0.001;

    // spin: fast in the hero, settles to a resting angle on landing
    if (!dragging) spinVel = lerp(spinVel, BASE_SPIN * (1 - e), 1 - Math.pow(0.02, dt));
    spinAngle += spinVel * dt * (dragging ? 0 : 1);
    if (e > 0.75 && !dragging) {
      const rest = Math.round(spinAngle / Math.PI) * Math.PI + 0.12;
      spinAngle = lerp(spinAngle, rest, (e - 0.75) * 4 * 0.15);
    }
    spinner.rotation.y = spinAngle;
    pen.rotation.x = REDUCED ? 0 : time * 0.6;       // slow roll catches reflections

    const heroWeight = 1 - e;
    tilt.rotation.x = lerp(0.18, 1.0, heroWeight) + pointer.sy * 0.25 * heroWeight;
    tilt.rotation.z = lerp(-0.08, -0.35, heroWeight) + pointer.sx * 0.2 * heroWeight;

    particles.points.rotation.y = pointer.sx * 0.06;
    particles.points.rotation.x = pointer.sy * 0.04;
    particles.update(scrollY, time, halfH() * camera.aspect, halfH());

    renderer.render(scene, camera);
  };
  tick();
  document.documentElement.classList.add('has-3d');
}

// ============ PRODUCT VIEWER (PDP) ============
const colorCache = new Map();
function sampleColor(url) {
  if (!url) return Promise.resolve(null);
  if (colorCache.has(url)) return colorCache.get(url);
  const p = new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = 48;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0, 48, 48);
        const d = g.getImageData(0, 0, 48, 48).data;
        // pens are thin in the photos, so bucket saturated pixels by hue and take the biggest bucket
        const buckets = Array.from({ length: 12 }, () => ({ r: 0, g: 0, b: 0, n: 0 }));
        const hsl = {};
        const tmp = new THREE.Color();
        for (let i = 0; i < d.length; i += 4) {
          tmp.setRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, THREE.SRGBColorSpace).getHSL(hsl, THREE.SRGBColorSpace);
          if (hsl.s < 0.4 || hsl.l < 0.2 || hsl.l > 0.85) continue;
          const bk = buckets[Math.floor(hsl.h * 12) % 12];
          bk.r += d[i]; bk.g += d[i + 1]; bk.b += d[i + 2]; bk.n++;
        }
        const top = buckets.reduce((a, b) => (b.n > a.n ? b : a));
        resolve(top.n >= 12
          ? new THREE.Color().setRGB(top.r / top.n / 255, top.g / top.n / 255, top.b / top.n / 255, THREE.SRGBColorSpace)
          : null);
      } catch { resolve(null); }                   // tainted canvas (no CORS)
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
  colorCache.set(url, p);
  return p;
}

let pdp = null;
function unmountPdp() {
  if (!pdp) return;
  cancelAnimationFrame(pdp.raf);
  pdp.ro.disconnect();
  pdp.controls.dispose();
  pdp.renderer.dispose();
  pdp.renderer.forceContextLoss();
  pdp.canvas.remove();
  pdp.hint.remove();
  pdp = null;
}

function mountPdp(container, product) {
  unmountPdp();
  const canvas = document.createElement('canvas');
  canvas.className = 'pdp-3d-canvas';
  const hint = document.createElement('div');
  hint.className = 'pdp-3d-hint';
  hint.textContent = 'Drag to rotate · 360°';
  container.append(canvas, hint);

  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 1.2, 9);
  addLights(scene, renderer);

  const pen = createPen({ bandA: '#ffffff', bandB: '#15151c' });
  pen.rotation.z = 0.35;
  scene.add(pen);
  sampleColor(product.images && product.images[0]).then(c => {
    if (c && pdp && pdp.pen === pen) pen.userData.bodyMat.color.copy(c);
  });

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.autoRotate = !REDUCED;
  controls.autoRotateSpeed = 2.2;

  const ro = new ResizeObserver(() => {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole pen in frame on narrow containers (fov 30 → width ≈ 0.54·d·aspect)
    const d = Math.max(7.5, 10 / camera.aspect);
    camera.position.setLength(d);
    controls.minDistance = d * 0.6;
    controls.maxDistance = d * 1.6;
    camera.updateProjectionMatrix();
  });
  ro.observe(container);

  pdp = { canvas, hint, renderer, controls, ro, pen, raf: 0 };
  const loop = () => {
    pdp.raf = requestAnimationFrame(loop);
    controls.update();
    renderer.render(scene, camera);
  };
  loop();
}

// ============ BOOT ============
try {
  initPage();
  window.KZ3D = { mountPdp, unmountPdp };
} catch (err) {
  console.warn('3D disabled:', err);
  document.getElementById('kz3d')?.remove();
}
