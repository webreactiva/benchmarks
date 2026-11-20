/* ==========================================================================
   ALHAMBRA DE GRANADA — Ruta 3D
   Motor: render, texturas procedurales, cielo, luz por hora y cámara libre
   ========================================================================== */
'use strict';

const THREE = window.THREE;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/* ---------------------------------------------------------------- utils */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = rng(20241117);

/* --------------------------------------------------------- texturas base */
function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { c, x: c.getContext('2d') };
}
function toTex(c, rx, ry) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx || 1, ry || 1);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function speckle(x, w, h, n, dark, light) {
  for (let i = 0; i < n; i++) {
    const px = rnd() * w, py = rnd() * h, s = 1 + rnd() * 2.2;
    x.fillStyle = rnd() > 0.5 ? dark : light;
    x.globalAlpha = 0.06 + rnd() * 0.12;
    x.fillRect(px, py, s, s);
  }
  x.globalAlpha = 1;
}

/* Tapia: earth-rammed masonry of the Nasrid walls */
function texTapia(base, dark) {
  const { c, x } = canvas2d(256, 256);
  x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 26; i++) {
    const y = rnd() * 256, h = 2 + rnd() * 7;
    x.fillStyle = dark; x.globalAlpha = 0.06 + rnd() * 0.09;
    x.fillRect(0, y, 256, h);
  }
  x.globalAlpha = 1;
  speckle(x, 256, 256, 2600, 'rgba(60,40,20,.9)', 'rgba(255,245,220,.9)');
  for (let i = 0; i < 14; i++) {
    x.strokeStyle = 'rgba(80,58,32,.22)'; x.lineWidth = 0.7 + rnd();
    x.beginPath();
    const px = rnd() * 256;
    x.moveTo(px, rnd() * 120);
    x.lineTo(px + (rnd() - 0.5) * 8, 140 + rnd() * 116);
    x.stroke();
  }
  return toTex(c);
}

/* Nasrid azulejo: cobalt star lattice */
function texAzulejo() {
  const { c, x } = canvas2d(256, 256);
  x.fillStyle = '#eef4f6'; x.fillRect(0, 0, 256, 256);
  const cell = 64;
  const star = (cx, cy, R, r, n, fill, stroke) => {
    x.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * TAU - Math.PI / 2;
      const rad = i % 2 ? r : R;
      const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.closePath();
    if (fill) { x.fillStyle = fill; x.fill(); }
    if (stroke) { x.strokeStyle = stroke; x.lineWidth = 2; x.stroke(); }
  };
  for (let gy = 0; gy < 4; gy++) {
    for (let gx = 0; gx < 4; gx++) {
      const cx = gx * cell + cell / 2, cy = gy * cell + cell / 2;
      star(cx, cy, 25, 11.5, 8, '#1d4f9c', '#12336c');
      star(cx, cy, 13, 5.5, 8, '#f4f8fa', null);
      star(cx, cy, 6, 2.6, 8, '#2f7a53', null);
      x.strokeStyle = 'rgba(29,79,156,.35)'; x.lineWidth = 1.4;
      x.strokeRect(gx * cell + 3, gy * cell + 3, cell - 6, cell - 6);
    }
  }
  speckle(x, 256, 256, 900, 'rgba(20,40,70,.6)', 'rgba(255,255,255,.8)');
  return toTex(c);
}

/* Ashlar stone */
function texPiedra(base, joint) {
  const { c, x } = canvas2d(256, 256);
  x.fillStyle = joint; x.fillRect(0, 0, 256, 256);
  const bw = 64, bh = 32;
  for (let row = 0; row < 8; row++) {
    for (let col = -1; col < 5; col++) {
      const off = (row % 2) * bw / 2;
      const px = col * bw + off, py = row * bh;
      const shade = 0.86 + rnd() * 0.24;
      x.fillStyle = shadeHex(base, shade);
      x.fillRect(px + 1.4, py + 1.4, bw - 2.8, bh - 2.8);
    }
  }
  speckle(x, 256, 256, 1800, 'rgba(70,60,45,.7)', 'rgba(255,255,255,.7)');
  return toTex(c);
}
function shadeHex(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = clamp(Math.round(r * k), 0, 255); g = clamp(Math.round(g * k), 0, 255); b = clamp(Math.round(b * k), 0, 255);
  return `rgb(${r},${g},${b})`;
}

/* Marble paving for the courtyards */
function texMarmol() {
  const { c, x } = canvas2d(256, 256);
  x.fillStyle = '#dcd5c4'; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(120,110,92,.5)'; x.lineWidth = 1.6;
  for (let i = 0; i <= 4; i++) {
    x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 256); x.stroke();
    x.beginPath(); x.moveTo(0, i * 64); x.lineTo(256, i * 64); x.stroke();
  }
  x.strokeStyle = 'rgba(150,138,115,.55)'; x.lineWidth = 1.1;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const cx = i * 64 + 32, cy = j * 64 + 32;
    x.beginPath();
    x.moveTo(cx, cy - 17); x.lineTo(cx + 17, cy); x.lineTo(cx, cy + 17); x.lineTo(cx - 17, cy);
    x.closePath(); x.stroke();
  }
  speckle(x, 256, 256, 2400, 'rgba(120,110,90,.55)', 'rgba(255,255,255,.85)');
  return toTex(c);
}

/* Terracotta roof tiles */
function texTeja() {
  const { c, x } = canvas2d(128, 128);
  x.fillStyle = '#9d4f34'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 16; i++) {
    x.fillStyle = shadeHex('#a9563a', 0.85 + rnd() * 0.3);
    x.fillRect(i * 8, 0, 7, 128);
    x.fillStyle = 'rgba(40,18,10,.3)';
    x.fillRect(i * 8 + 7, 0, 1.6, 128);
  }
  for (let i = 0; i < 128; i += 16) { x.fillStyle = 'rgba(40,18,10,.22)'; x.fillRect(0, i, 128, 2); }
  speckle(x, 128, 128, 700, 'rgba(50,24,12,.7)', 'rgba(255,220,190,.6)');
  return toTex(c);
}

/* Gravel path */
function texGrava() {
  const { c, x } = canvas2d(128, 128);
  x.fillStyle = '#c3b091'; x.fillRect(0, 0, 128, 128);
  speckle(x, 128, 128, 4200, 'rgba(110,95,70,.85)', 'rgba(255,246,225,.85)');
  return toTex(c);
}

/* Dark wood (doors, ceilings) */
function texMadera() {
  const { c, x } = canvas2d(128, 128);
  x.fillStyle = '#3b2415'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 30; i++) {
    x.strokeStyle = `rgba(${20 + rnd() * 40},${12 + rnd() * 20},6,.5)`;
    x.lineWidth = 0.6 + rnd() * 2;
    x.beginPath(); const px = rnd() * 128;
    x.moveTo(px, 0); x.bezierCurveTo(px + 6, 40, px - 6, 80, px + (rnd() - 0.5) * 8, 128);
    x.stroke();
  }
  return toTex(c);
}

/* ------------------------------------------------------------ materiales */
const TEX = {
  tapia: texTapia('#c9ab7d', '#8d6c40'),
  tapiaOsc: texTapia('#b59465', '#7b5c33'),
  azulejo: texAzulejo(),
  piedra: texPiedra('#d6cab1', '#a89a80'),
  marmol: texMarmol(),
  teja: texTeja(),
  grava: texGrava(),
  madera: texMadera()
};

const MAT = {
  tapia: new THREE.MeshStandardMaterial({ map: TEX.tapia, roughness: 0.95, metalness: 0 }),
  tapiaOsc: new THREE.MeshStandardMaterial({ map: TEX.tapiaOsc, roughness: 0.96, metalness: 0 }),
  azulejo: new THREE.MeshStandardMaterial({ map: TEX.azulejo, roughness: 0.42, metalness: 0.05 }),
  piedra: new THREE.MeshStandardMaterial({ map: TEX.piedra, roughness: 0.9, metalness: 0 }),
  marmol: new THREE.MeshStandardMaterial({ map: TEX.marmol, roughness: 0.55, metalness: 0.03 }),
  teja: new THREE.MeshStandardMaterial({ map: TEX.teja, roughness: 0.82, metalness: 0 }),
  grava: new THREE.MeshStandardMaterial({ map: TEX.grava, roughness: 1, metalness: 0 }),
  madera: new THREE.MeshStandardMaterial({ map: TEX.madera, roughness: 0.72, metalness: 0.02 }),
  sombra: new THREE.MeshStandardMaterial({ color: 0x120d09, roughness: 1, metalness: 0 }),
  hueco: new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: 1, metalness: 0 }),
  bronce: new THREE.MeshStandardMaterial({ color: 0x8a6a33, roughness: 0.38, metalness: 0.85 }),
  claro: new THREE.MeshStandardMaterial({ color: 0xe8dcc2, roughness: 0.8 }),
  agua: new THREE.MeshStandardMaterial({
    color: 0x1f6f7a, roughness: 0.06, metalness: 0.35, transparent: true, opacity: 0.86
  })
};

/* ---------------------------------------------------------------- render */
const canvasEl = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd9c3a0, 700, 3000);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.6, 6000);
camera.position.set(575, 96, 405);

/* ------------------------------------------------------------------ cielo */
const skyUniforms = {
  topColor: { value: new THREE.Color(0x3d76b8) },
  horizonColor: { value: new THREE.Color(0xe8c79a) },
  bottomColor: { value: new THREE.Color(0x8a6a4e) },
  sunColor: { value: new THREE.Color(0xfff0cf) },
  sunDir: { value: new THREE.Vector3(0.4, 0.5, -0.7).normalize() },
  glow: { value: 0.55 },
  sunSize: { value: 800 }
};
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(3400, 32, 20),
  new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 topColor, horizonColor, bottomColor, sunColor, sunDir;
      uniform float glow, sunSize;
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(bottomColor, horizonColor, smoothstep(-0.35, 0.02, h));
        col = mix(col, topColor, smoothstep(0.0, 0.62, h));
        float sd = max(dot(d, normalize(sunDir)), 0.0);
        col += sunColor * pow(sd, sunSize) * 3.0;
        col += sunColor * pow(sd, 9.0) * glow * 0.55;
        col += sunColor * pow(sd, 2.0) * glow * 0.12;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  })
);
sky.frustumCulled = false;
scene.add(sky);

/* estrellas (visibles de noche) */
const starGeo = new THREE.BufferGeometry();
{
  const N = 1400, pos = new Float32Array(N * 3), siz = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const u = rnd() * 2 - 1, a = rnd() * TAU, s = Math.sqrt(1 - u * u);
    const R = 3200;
    pos[i * 3] = Math.cos(a) * s * R;
    pos[i * 3 + 1] = Math.abs(u) * R;
    pos[i * 3 + 2] = Math.sin(a) * s * R;
    siz[i] = 4 + rnd() * 16;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute('size', new THREE.BufferAttribute(siz, 1));
}
const starMat = new THREE.PointsMaterial({
  color: 0xfff4dd, size: 16, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, fog: false
});
const stars = new THREE.Points(starGeo, starMat);
stars.frustumCulled = false;
scene.add(stars);

/* --------------------------------------------------------------- luces */
const sun = new THREE.DirectionalLight(0xfff1d6, 3.0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 2600;
sun.shadow.camera.left = -620;
sun.shadow.camera.right = 620;
sun.shadow.camera.top = 460;
sun.shadow.camera.bottom = -460;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.9;
scene.add(sun);
scene.add(sun.target);

const hemi = new THREE.HemisphereLight(0xbcd6f2, 0x6b543c, 1.15);
scene.add(hemi);
const bounce = new THREE.DirectionalLight(0xc9a679, 0.55);
bounce.position.set(300, 60, 500);
scene.add(bounce);

/* presets de hora del día */
const PRESETS = {
  amanecer: {
    label: 'Amanecer',
    sunEl: 16, sunAz: 100,
    sun: 0xffd0a0, sunI: 2.9,
    top: 0x2f5f9e, horizon: 0xf2b184, bottom: 0x6b5340,
    glow: 0.9, fog: 0xdcb294, fogNear: 520, fogFar: 2400,
    hemiSky: 0xa8c4e8, hemiGnd: 0x6b4f34, hemiI: 1.25, exposure: 1.06, night: 0
  },
  mediodia: {
    label: 'Mediodía',
    sunEl: 63, sunAz: 186,
    sun: 0xfff6e2, sunI: 3.5,
    top: 0x3b78c4, horizon: 0xd9e4ee, bottom: 0x8f8c86,
    glow: 0.42, fog: 0xcfd8dd, fogNear: 900, fogFar: 3600,
    hemiSky: 0xcfe2f7, hemiGnd: 0x7d6a4e, hemiI: 1.25, exposure: 1.02, night: 0
  },
  atardecer: {
    label: 'Atardecer',
    sunEl: 18, sunAz: 282,
    sun: 0xffc07a, sunI: 3.3,
    top: 0x2a4f8c, horizon: 0xf6a24f, bottom: 0x5d3f2f,
    glow: 1.05, fog: 0xe0a071, fogNear: 480, fogFar: 2200,
    hemiSky: 0x9fb6e0, hemiGnd: 0x6a4c33, hemiI: 1.3, exposure: 1.12, night: 0
  },
  noche: {
    label: 'Noche',
    sunEl: 34, sunAz: 300,
    sun: 0xa8c0f0, sunI: 0.75,
    top: 0x0a1330, horizon: 0x1d2a4d, bottom: 0x090c18,
    glow: 0.22, fog: 0x141d33, fogNear: 420, fogFar: 1900,
    hemiSky: 0x2a3c66, hemiGnd: 0x131722, hemiI: 0.5, exposure: 1.12, night: 1
  }
};
let presetActual = 'atardecer';
let blend = { from: 'atardecer', to: 'atardecer', t: 1 };

function applyPreset(name, instant) {
  blend = { from: presetActual, to: name, t: instant ? 1 : 0 };
  presetActual = name;
  if (instant) applyPresetNow(name, name, 1);
}
function applyPresetNow(fromName, toName, t) {
  const A = PRESETS[fromName], B = PRESETS[toName];
  const mixC = (ka, kb) => new THREE.Color(ka).lerp(new THREE.Color(kb), t);
  skyUniforms.topColor.value.copy(mixC(A.top, B.top));
  skyUniforms.horizonColor.value.copy(mixC(A.horizon, B.horizon));
  skyUniforms.bottomColor.value.copy(mixC(A.bottom, B.bottom));
  skyUniforms.sunColor.value.copy(mixC(A.sun, B.sun));
  skyUniforms.glow.value = lerp(A.glow, B.glow, t);
  skyUniforms.sunSize.value = lerp(700, 800, t);

  const el = lerp(A.sunEl, B.sunEl, t) * DEG, az = lerp(A.sunAz, B.sunAz, t) * DEG;
  const dir = V3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
  skyUniforms.sunDir.value.copy(dir);
  sun.position.set(450 + dir.x * 900, 56 + dir.y * 900, 150 + dir.z * 900);
  sun.target.position.set(450, 56, 150);
  sun.color.copy(mixC(A.sun, B.sun));
  sun.intensity = lerp(A.sunI, B.sunI, t);
  hemi.color.copy(mixC(A.hemiSky, B.hemiSky, t));
  hemi.groundColor.copy(mixC(A.hemiGnd, B.hemiGnd, t));
  hemi.intensity = lerp(A.hemiI, B.hemiI, t);
  bounce.intensity = lerp(0.25, 0.6, t) * (1 - B.night * 0.7);
  scene.fog.color.copy(mixC(A.fog, B.fog, t));
  scene.fog.near = lerp(A.fogNear, B.fogNear, t);
  scene.fog.far = lerp(A.fogFar, B.fogFar, t);
  renderer.toneMappingExposure = lerp(A.exposure, B.exposure, t);
  starMat.opacity = lerp(A.night, B.night, t) * 0.95;
}

/* ------------------------------------------------------- cámara libre */
class OrbitCam {
  constructor(cam, dom) {
    this.cam = cam; this.dom = dom;
    this.enabled = false;
    this.target = V3(450, 60, 150);
    this.radius = 220; this.theta = 2.4; this.phi = 1.1;
    this.minR = 12; this.maxR = 1400;
    this.dragging = false; this.mode = 0; this.lastX = 0; this.lastY = 0;
    this.pinch = 0;
    this._bind();
  }
  _bind() {
    const d = this.dom;
    d.addEventListener('pointerdown', e => {
      if (!this.enabled) return;
      if (e.pointerType === 'touch' && this._touches > 1) return;
      this.dragging = true; this.mode = (e.button === 2 || e.shiftKey) ? 1 : 0;
      this.lastX = e.clientX; this.lastY = e.clientY;
      d.setPointerCapture(e.pointerId);
    });
    d.addEventListener('pointermove', e => {
      if (!this.dragging || !this.enabled) return;
      const dx = e.clientX - this.lastX, dy = e.clientY - this.lastY;
      this.lastX = e.clientX; this.lastY = e.clientY;
      if (this.mode === 0) {
        this.theta -= dx * 0.0042;
        this.phi = clamp(this.phi - dy * 0.0034, 0.08, Math.PI * 0.495);
      } else {
        const right = V3(Math.cos(this.theta), 0, -Math.sin(this.theta));
        const fwd = V3(Math.sin(this.theta), 0, Math.cos(this.theta));
        const k = this.radius * 0.0013;
        this.target.addScaledVector(right, -dx * k);
        this.target.addScaledVector(fwd, -dy * k);
      }
    });
    const stop = e => { this.dragging = false; try { d.releasePointerCapture(e.pointerId); } catch (_) { } };
    d.addEventListener('pointerup', stop);
    d.addEventListener('pointercancel', stop);
    d.addEventListener('contextmenu', e => e.preventDefault());
    d.addEventListener('wheel', e => {
      if (!this.enabled) return;
      e.preventDefault();
      this.radius = clamp(this.radius * (1 + Math.sign(e.deltaY) * 0.11), this.minR, this.maxR);
    }, { passive: false });
    /* táctil: pellizco */
    this._touches = 0;
    d.addEventListener('touchstart', e => {
      this._touches = e.touches.length;
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.pinch = Math.hypot(dx, dy);
      }
    }, { passive: true });
    d.addEventListener('touchmove', e => {
      if (!this.enabled) return;
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        if (this.pinch) this.radius = clamp(this.radius * (this.pinch / dist), this.minR, this.maxR);
        this.pinch = dist;
      }
    }, { passive: true });
    d.addEventListener('touchend', () => { this._touches = 0; this.pinch = 0; });
  }
  syncFrom(pos, tgt) {
    this.target.copy(tgt);
    const off = pos.clone().sub(tgt);
    this.radius = clamp(off.length(), this.minR, this.maxR);
    this.phi = clamp(Math.acos(clamp(off.y / this.radius, -1, 1)), 0.08, Math.PI * 0.495);
    this.theta = Math.atan2(off.x, off.z);
  }
  update() {
    const sp = Math.sin(this.phi), cp = Math.cos(this.phi);
    this.cam.position.set(
      this.target.x + this.radius * sp * Math.sin(this.theta),
      this.target.y + this.radius * cp,
      this.target.z + this.radius * sp * Math.cos(this.theta)
    );
    this.cam.lookAt(this.target);
  }
}
const orbit = new OrbitCam(camera, renderer.domElement);
