/* ==========================================================================
   Entorno: cerro de la Sabika, Darro, Albaicín y Sierra Nevada
   ========================================================================== */

const PLATEAU = 56;          // cota de la meseta monumental
const SITIO = { x0: -55, x1: 955, z0: -110, z1: 390 };   // recinto amurallado

function sdBox(px, pz, bx, bz) {
  const dx = Math.abs(px) - bx, dz = Math.abs(pz) - bz;
  const ox = Math.max(dx, 0), oz = Math.max(dz, 0);
  return Math.hypot(ox, oz) + Math.min(Math.max(dx, dz), 0);
}
function riverZ(x) { return 482 + Math.sin(x * 0.0032) * 42 + Math.sin(x * 0.0009) * 60; }

function terrainHeight(x, z) {
  const dRect = sdBox(x - 450, z - 140, (SITIO.x1 - SITIO.x0) / 2, (SITIO.z1 - SITIO.z0) / 2);
  let h = PLATEAU;
  h -= 46 * smoothstep(300, 470, z);                        // caída al valle del Darro
  h += 34 * smoothstep(120, -300, z);                        // alzado hacia el norte
  h += 26 * smoothstep(520, 780, z);                         // oppuesta sur (Albaicín)
  h -= 30 * smoothstep(560, 980, Math.abs(x - 450));         // laderas este/oeste
  const n = 5.4 * Math.sin(x * 0.0042 + 1.7) * Math.cos(z * 0.0051 - 0.6)
    + 2.4 * Math.sin(x * 0.0121 - 0.3) * Math.sin(z * 0.0107 + 2.1)
    + 1.3 * Math.sin(x * 0.031 + 2.4) * Math.cos(z * 0.027);
  h += n * smoothstep(0, 75, dRect);
  const dr = Math.abs(z - riverZ(x));
  h -= 24 * (1 - smoothstep(0, 120, dr));                    // cauce del río
  h = lerp(h, PLATEAU, 1 - smoothstep(0, 42, dRect));        // meseta llana
  return h;
}

/* ------------------------------------------------------------- terreno */
const terrainGeo = new THREE.PlaneGeometry(3000, 2400, 220, 176);
terrainGeo.rotateX(-Math.PI / 2);
terrainGeo.translate(450, 0, 140);
{
  const pos = terrainGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cSierra = new THREE.Color(0x6b7a63), cSeco = new THREE.Color(0x9c9163),
    cVerde = new THREE.Color(0x5c7040), cRio = new THREE.Color(0x3f4b34),
    cTierra = new THREE.Color(0x8d7b57), cNieve = new THREE.Color(0xd8dee6);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = terrainHeight(x, z);
    pos.setY(i, y);
    const dRect = sdBox(x - 450, z - 140, (SITIO.x1 - SITIO.x0) / 2, (SITIO.z1 - SITIO.z0) / 2);
    const dr = Math.abs(z - riverZ(x));
    const v = 0.5 + 0.5 * Math.sin(x * 0.013) * Math.cos(z * 0.017);
    tmp.copy(cSeco).lerp(cVerde, v * 0.75);
    tmp.lerp(cSierra, smoothstep(70, 120, y));
    tmp.lerp(cNieve, smoothstep(150, 230, y) * 0.85);
    tmp.lerp(cRio, (1 - smoothstep(20, 120, dr)) * 0.55);
    tmp.lerp(cTierra, smoothstep(0, 30, dRect) * 0.55);
    const shade = 0.86 + 0.28 * v;
    colors[i * 3] = tmp.r * shade; colors[i * 3 + 1] = tmp.g * shade; colors[i * 3 + 2] = tmp.b * shade;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();
}
const terrain = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 1, metalness: 0, flatShading: false
}));
terrain.receiveShadow = true;
scene.add(terrain);

/* --------------------------------------------------------------- río Darro */
{
  const N = 120, w = 26;
  const g = new THREE.BufferGeometry();
  const pos = [], uv = [];
  for (let i = 0; i <= N; i++) {
    const x = -400 + (i / N) * 2100;
    const z = riverZ(x);
    pos.push(x, 9.2, z - w); pos.push(x, 9.2, z + w);
    uv.push(i / N * 22, 0, i / N * 22, 1);
  }
  const idx = [];
  for (let i = 0; i < N; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const river = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
    color: 0x3d6f74, roughness: 0.12, metalness: 0.4, transparent: true, opacity: 0.9
  }));
  river.name = 'río';
  scene.add(river);
  scene.userData.river = river;
}

/* ------------------------------------------------- Sierra Nevada de fondo */
{
  const mat = new THREE.MeshStandardMaterial({ color: 0x77839b, roughness: 1, flatShading: true });
  const matSnow = new THREE.MeshStandardMaterial({ color: 0xdfe5ee, roughness: 1, flatShading: true });
  const peaks = [
    [-500, -1150, 420, 300], [120, -1250, 520, 380], [760, -1150, 470, 330],
    [1350, -1250, 560, 400], [1950, -1000, 480, 320], [-1200, -1000, 380, 260]
  ];
  for (const [x, z, r, h] of peaks) {
    const g = new THREE.ConeGeometry(r, h, 6, 1);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, h / 2 - 20, z);
    m.rotation.y = rnd() * TAU;
    m.receiveShadow = false;
    scene.add(m);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.36, h * 0.3, 6, 1), matSnow);
    cap.position.set(x, h * 0.85 - 20, z);
    cap.rotation.y = m.rotation.y;
    scene.add(cap);
  }
  /* loma de la Alhambra al fondo oeste */
  const hill = new THREE.Mesh(new THREE.ConeGeometry(420, 150, 7), mat);
  hill.position.set(-820, 20, -260);
  scene.add(hill);
}

/* ------------------------------------------------------- Albaicín y ciudad */
{
  const dummy = new THREE.Object3D();
  const N = 620;
  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xe9e0cd, roughness: 0.95 }), N);
  const roofs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x8d4a33, roughness: 0.9 }), N);
  let k = 0, guard = 0;
  while (k < N && guard < N * 6) {
    guard++;
    const ang = -0.32;
    const gx = -100 + Math.floor(rnd() * 46), gz = 12 + Math.floor(rnd() * 16);
    const jx = (rnd() - 0.5) * 5.2, jz = (rnd() - 0.5) * 5.2;
    const lx = gx + jx, lz = gz + jz;
    const x = 450 + lx * Math.cos(ang) - lz * Math.sin(ang);
    const z = 560 + lx * Math.sin(ang) + lz * Math.cos(ang);
    if (Math.abs(z - riverZ(x)) < 34) continue;
    const y = terrainHeight(x, z);
    const w = 7 + rnd() * 9, d = 7 + rnd() * 9, h = 6 + rnd() * 9;
    dummy.position.set(x, y + h / 2, z);
    dummy.rotation.set(0, -ang + (rnd() - 0.5) * 0.12, 0);
    dummy.scale.set(w, h, d);
    dummy.updateMatrix();
    walls.setMatrixAt(k, dummy.matrix);
    dummy.position.set(x, y + h + 0.7, z);
    dummy.scale.set(w + 1.1, 1.4, d + 1.1);
    dummy.updateMatrix();
    roofs.setMatrixAt(k, dummy.matrix);
    k++;
  }
  walls.count = k; roofs.count = k;
  walls.castShadow = false; walls.receiveShadow = true;
  scene.add(walls, roofs);

  /* catedral y Alcazaba de la ciudad, al sur */
  const cat = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(46, 22, 80), MAT.claro);
  body.position.y = 11;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(48, 2.4, 82), MAT.teja);
  roof.position.y = 23;
  const tower = new THREE.Mesh(new THREE.BoxGeometry(17, 46, 17), MAT.claro);
  tower.position.set(0, 23, -30);
  const tRoof = new THREE.Mesh(new THREE.ConeGeometry(13, 12, 4), MAT.teja);
  tRoof.position.set(0, 52, -30); tRoof.rotation.y = Math.PI / 4;
  cat.add(body, roof, tower, tRoof);
  const cx = 430, cz = 640, cy = terrainHeight(cx, cz);
  cat.position.set(cx, cy, cz);
  cat.rotation.y = -0.32;
  cat.traverse(o => { if (o.isMesh) o.castShadow = false; });
  scene.add(cat);
}

/* ---------------------------------------------------------- vegetación */
const vegMats = {
  cipres: new THREE.MeshStandardMaterial({ color: 0x2f4630, roughness: 1, flatShading: true }),
  pino: new THREE.MeshStandardMaterial({ color: 0x3d5a35, roughness: 1, flatShading: true }),
  arbusto: new THREE.MeshStandardMaterial({ color: 0x4a6b3c, roughness: 1, flatShading: true }),
  seto: new THREE.MeshStandardMaterial({ color: 0x466b3d, roughness: 1, flatShading: true }),
  tronco: new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 1 })
};
const geoCipres = new THREE.ConeGeometry(1.9, 15, 7);
const geoPino = new THREE.ConeGeometry(5.2, 11, 8);
const geoTronco = new THREE.CylinderGeometry(0.32, 0.42, 3, 6);
const geoArbusto = new THREE.IcosahedronGeometry(1, 0);

function addCipres(x, z, scale) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(geoTronco, vegMats.tronco);
  t.position.y = 1.5; t.scale.setScalar(scale);
  const c = new THREE.Mesh(geoCipres, vegMats.cipres);
  c.position.y = 3 + 15 * scale / 2; c.scale.set(scale, scale, scale);
  g.add(t, c);
  g.position.set(x, terrainHeight(x, z), z);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(g);
  return g;
}
function addPino(x, z, scale) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(geoTronco, vegMats.tronco);
  t.position.y = 1.4; t.scale.setScalar(scale);
  const c = new THREE.Mesh(geoPino, vegMats.pino);
  c.position.y = 3 + 5.5 * scale; c.scale.set(scale, scale, scale);
  const c2 = new THREE.Mesh(geoPino, vegMats.pino);
  c2.position.y = 3 + 5.5 * scale + 4.6 * scale; c2.scale.set(scale * 0.7, scale * 0.7, scale * 0.7);
  g.add(t, c, c2);
  g.position.set(x, terrainHeight(x, z), z);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(g);
  return g;
}
function addArbusto(x, y, z, s) {
  const m = new THREE.Mesh(geoArbusto, vegMats.arbusto);
  m.position.set(x, y + s * 0.55, z);
  m.scale.set(s, s * 0.8, s);
  m.castShadow = true;
  scene.add(m);
  return m;
}
function addSeto(x, y, z, w, d, h) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), vegMats.seto);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
  return m;
}
