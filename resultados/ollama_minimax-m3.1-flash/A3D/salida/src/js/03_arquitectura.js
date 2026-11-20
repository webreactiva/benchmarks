/* ==========================================================================
   Arquitectura: murallas, Alcazaba, Palacios Nazaríes, Carlos V, Generalife
   ========================================================================== */

const monument = new THREE.Group();
monument.name = 'Alhambra';
scene.add(monument);
const MAP = [];                 //Simplificación del plano para el minimapa
const mapRect = (x, z, w, d, rot) => MAP.push({ t: 'r', x, z, w, d, rot: rot || 0 });
const mapCirc = (x, z, r) => MAP.push({ t: 'c', x, z, r });

/* --------------------------------------------------------- primitivas */
function boxGeo(w, h, d, uvScale) {
  const s = uvScale || 6;
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const f = [
    [d / s, h / s], [d / s, h / s],
    [w / s, d / s], [w / s, d / s],
    [w / s, h / s], [w / s, h / s]
  ];
  for (let face = 0; face < 6; face++) {
    for (let i = 0; i < 4; i++) {
      const k = face * 4 + i;
      uv.setXY(k, uv.getX(k) * f[face][0], uv.getY(k) * f[face][1]);
    }
  }
  uv.needsUpdate = true;
  return g;
}
function addBox(parent, w, h, d, x, y, z, mat, rotY, uvScale) {
  const m = new THREE.Mesh(boxGeo(w, h, d, uvScale), mat);
  m.position.set(x, y, z);
  if (rotY) m.rotation.y = rotY;
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
function addWall(parent, p1, p2, h, t, mat, uvScale) {
  const dx = p2[0] - p1[0], dz = p2[1] - p1[1];
  const len = Math.hypot(dx, dz);
  const m = new THREE.Mesh(boxGeo(len, h, t, uvScale || 6), mat);
  m.position.set((p1[0] + p2[0]) / 2, PLATEAU + h / 2, (p1[1] + p2[1]) / 2);
  m.rotation.y = Math.atan2(-dz, dx);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

/* arcos herradura nazaríes */
function archPath(path, w, h, ox) {
  const R = w / 2, jamb = 0.94 * R, cy = h - R;
  const a0 = 200 * DEG, a1 = -20 * DEG;
  const yJ = cy + Math.sin(a0) * R;
  path.moveTo((ox || 0) - jamb, 0);
  path.lineTo((ox || 0) - jamb, yJ);
  path.absarc(ox || 0, cy, R, a0, a1, true);
  path.lineTo((ox || 0) + jamb, 0);
  path.closePath();
  return path;
}
function archShape(w, h) { return archPath(new THREE.Shape(), w, h, 0); }

/* panel de muro con huecos de arco herradura */
function addArchPanel(parent, w, h, t, holes, mat, uvScale) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.closePath();
  for (const ho of holes) s.holes.push(archPath(new THREE.Path(), ho.w, ho.h, ho.x));
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 10 });
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

/* hueco oscuro (vano visto de frente) */
function addOpening(parent, w, h, x, y, z, rotY, mat) {
  const g = new THREE.ShapeGeometry(archShape(w, h), 12);
  const m = new THREE.Mesh(g, mat || MAT.sombra);
  m.position.set(x, y, z);
  if (rotY) m.rotation.y = rotY;
  m.receiveShadow = false;
  parent.add(m);
  return m;
}

/* ventanas en vanos */
function addVentanas(parent, w, d, h, filas, cols, mat) {
  const ww = 0.9, wh = 1.9;
  for (let f = 0; f < filas; f++) {
    const y = h * (0.3 + 0.28 * f);
    for (let c = 0; c < cols; c++) {
      const off = (c - (cols - 1) / 2) * (w / (cols + 0.6));
      addBox(parent, ww, wh, 0.5, off, y, d / 2 + 0.02, mat || MAT.sombra, 0, 3);
      addBox(parent, ww, wh, 0.5, off, y, -d / 2 - 0.02, mat || MAT.sombra, 0, 3);
    }
    for (let c = 0; c < Math.max(1, cols - 1); c++) {
      const off = (c - (cols - 2) / 2) * (d / (cols + 0.2));
      addBox(parent, 0.5, wh, ww, w / 2 + 0.02, y, off, mat || MAT.sombra, 0, 3);
      addBox(parent, 0.5, wh, ww, -w / 2 - 0.02, y, off, mat || MAT.sombra, 0, 3);
    }
  }
}

/* torre cuadrada con cornisa y ventanas */
function addTorre(parent, cx, cz, w, d, h, mat, opts) {
  const o = opts || {};
  const g = new THREE.Group();
  addBox(g, w, h, d, 0, h / 2, 0, mat);
  addBox(g, w + 1.4, 1.3, d + 1.4, 0, h + 0.65, 0, MAT.piedra);
  if (o.almenas) {
    const n = Math.floor(w / 2.6);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + 1.3 + i * ((w - 2.6) / (n - 1));
      addBox(g, 1.5, 1.5, 1.5, x, h + 2, d / 2, mat, 0, 3);
      addBox(g, 1.5, 1.5, 1.5, x, h + 2, -d / 2, mat, 0, 3);
    }
  }
  addVentanas(g, w, d, h, o.filas || 2, o.cols || 2);
  g.position.set(cx, PLATEAU, cz);
  g.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
  parent.add(g);
  return g;
}

/* columnas esbeltas con capitel */
const geoCol = new THREE.CylinderGeometry(0.24, 0.3, 3.6, 8);
const geoCap = new THREE.BoxGeometry(0.85, 0.34, 0.85);
const geoCapSup = new THREE.BoxGeometry(1.05, 0.26, 1.05);
function addColumna(parent, x, z, h) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(geoCol, MAT.piedra);
  c.position.y = 1.8; c.scale.y = h / 3.6;
  const b = new THREE.Mesh(geoCap, MAT.piedra); b.position.y = h - 0.5;
  const t = new THREE.Mesh(geoCapSup, MAT.piedra); t.position.y = h - 0.2;
  g.add(c, b, t);
  g.position.set(x, PLATEAU, z);
  g.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
  parent.add(g);
  return g;
}

/* arquería: columnas + dintel con arcos */
function addArcada(parent, pts, h, arcoMat, colMat) {
  const g = new THREE.Group();
  for (let i = 0; i < pts.length; i++) {
    addColumna(g, pts[i][0], pts[i][1], h);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const mid = new THREE.Mesh(boxGeo(len, 0.9, 1.1, 4), arcoMat || MAT.piedra);
    mid.position.set((a[0] + b[0]) / 2, PLATEAU + h + 0.4, (a[1] + b[1]) / 2);
    mid.rotation.y = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
    mid.castShadow = true; mid.receiveShadow = true;
    g.add(mid);
  }
  parent.add(g);
  return g;
}

/* ------------------------------------------------------------ murallas */
const WALL_PTS = [
  [-30, 150], [-58, 70], [-14, 10], [130, -45], [340, -62], [575, -42],
  [775, -8], [890, 62], [938, 170], [885, 290], [700, 342], [568, 351],
  [430, 362], [175, 350], [15, 300], [-32, 228]
];
{
  const g = new THREE.Group();
  for (let i = 0; i < WALL_PTS.length; i++) {
    const a = WALL_PTS[i], b = WALL_PTS[(i + 1) % WALL_PTS.length];
    addWall(g, a, b, 14, 4.6, MAT.tapia);
    /* almenas */
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.floor(len / 7);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const x = lerp(a[0], b[0], t), z = lerp(a[1], b[1], t);
      addBox(g, 2.2, 1.3, 4.8, x, PLATEAU + 14.6, z, MAT.tapia, Math.atan2(-(b[1] - a[1]), b[0] - a[0]), 3);
    }
  }
  monument.add(g);
  MAP.push({ t: 'w', pts: WALL_PTS });
}

/* ------------------------------------------------------- Alcazaba */
{
  const g = new THREE.Group();
  /* Torre de la Vela */
  const vela = addTorre(g, 48, 148, 19, 19, 33, MAT.tapia, { filas: 3, cols: 2, almenas: true });
  addBox(vela, 9, 9, 9, 0, 38, 0, MAT.tapia);
  addBox(vela, 9.8, 0.9, 9.8, 0, 42.9, 0, MAT.piedra);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(7, 6, 4), MAT.teja);
  roof.position.set(0, 46.3, 0); roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  vela.add(roof);
  /* el Descobridor (campana) */
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6, 0, TAU, 0, Math.PI * 0.62), MAT.bronce);
  bell.position.set(0, 38, 3.6); bell.rotation.x = Math.PI;
  vela.add(bell);
  mapRect(48, 148, 19, 19);

  /* Torre del Homenaje */
  addTorre(g, 97, 112, 16, 16, 25, MAT.tapia, { filas: 2, cols: 2 });
  mapRect(97, 112, 16, 16);
  /* Torre Quebrada */
  addTorre(g, 99, 44, 13, 13, 21, MAT.tapia, { filas: 2, cols: 2 });
  mapRect(99, 44, 13, 13);
  /* Torre de las Damas */
  addTorre(g, 26, 232, 12, 12, 15, MAT.tapia, { filas: 2, cols: 1 });
  mapRect(26, 232, 12, 12);
  /* Cuartel */
  addBox(g, 80, 9, 54, 110, PLATEAU + 4.5, 207, MAT.tapiaOsc, 0, 6);
  addBox(g, 82, 1, 56, 110, PLATEAU + 9.4, 207, MAT.piedra);
  mapRect(110, 207, 80, 54);
  monument.add(g);
}

/* ------------------------------------------------ Palacios Nazaríes */
{
  const g = new THREE.Group();

  /* --- Torre de Comares --- */
  const comares = addTorre(g, 330, 78, 23, 23, 40, MAT.tapia, { filas: 3, cols: 2 });
  addBox(comares, 8, 7, 8, 0, 44, 0, MAT.tapia);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(6, 9, 6), MAT.teja);
  spire.position.set(0, 52, 0); spire.castShadow = true;
  comares.add(spire);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), MAT.bronce);
  finial.position.set(0, 57, 0);
  comares.add(finial);
  mapRect(330, 78, 23, 23);

  /* --- Palacio de Comares (fachada de azulejos al patio de los Arrayanes) --- */
  const pc = new THREE.Group();
  addBox(pc, 96, 15, 104, 364, PLATEAU + 7.5, 160, MAT.tapiaOsc, 0, 6);
  /* fachada este con siete arcos herradura */
  const holes = [];
  for (let i = 0; i < 7; i++) holes.push({ x: -33 + i * 11, w: 4.4, h: 7.4 });
  const facade = addArchPanel(pc, 96, 15, 1.1, holes, MAT.azulejo, 4);
  facade.position.set(412, PLATEAU, 160);
  facade.rotation.y = Math.PI / 2;
  /* ventanas superiores */
  for (let i = 0; i < 9; i++) {
    addOpening(pc, 2.6, 4.2, 412.4, PLATEAU + 8.6, 118 + i * 10.5, Math.PI / 2, MAT.sombra);
  }
  /* portada */
  const portal = addArchPanel(pc, 12, 11, 1.4, [{ x: 0, w: 5, h: 8 }], MAT.tapia);
  portal.position.set(412.2, PLATEAU, 160);
  portal.rotation.y = Math.PI / 2;
  addBox(pc, 14, 1.2, 16, 413, PLATEAU + 11.2, 160, MAT.piedra);
  g.add(pc);
  mapRect(364, 160, 96, 104);

  /* --- Mexuar --- */
  addBox(g, 68, 11, 56, 458, PLATEAU + 5.5, 68, MAT.tapiaOsc, 0, 6);
  const mexPort = addArchPanel(g, 20, 9, 1.2, [{ x: 0, w: 4, h: 6.4 }], MAT.azulejo);
  mexPort.position.set(458, PLATEAU, 96.4);
  addBox(g, 70, 1.1, 58, 458, PLATEAU + 11.3, 68, MAT.piedra);
  mapRect(458, 68, 68, 56);

  /* --- Patio de los Arrayanes --- */
  const ay = new THREE.Group();
  const floor = new THREE.Mesh(boxGeo(148, 0.6, 104, 8), MAT.marmol);
  floor.position.set(486, PLATEAU + 0.3, 152);
  floor.receiveShadow = true;
  ay.add(floor);
  /* pileta longitudinal */
  const pool = new THREE.Mesh(boxGeo(118, 1.4, 11, 6), MAT.piedra);
  pool.position.set(486, PLATEAU + 0.4, 152);
  ay.add(pool);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(112, 7.4), MAT.agua.clone());
  water.rotation.x = -Math.PI / 2;
  water.position.set(486, PLATEAU + 1.0, 152);
  ay.add(water);
  scene.userData.pools = scene.userData.pools || [];
  scene.userData.pools.push({ mesh: water, kind: 'pool' });
  /* setos de arrayán */
  for (let i = 0; i < 9; i++) {
    addSeto(434 + i * 13, PLATEAU, 140, 10, 3.4, 1.5);
    addSeto(434 + i * 13, PLATEAU, 164, 10, 3.4, 1.5);
  }
  /* pórtico de azulejos al oeste (fachada de Comares) */
  const portico = addArchPanel(ay, 100, 8.5, 1, [{ x: -40, w: 3.4, h: 6 }, { x: -20, w: 3.4, h: 6 }, { x: 0, w: 3.4, h: 6 }, { x: 20, w: 3.4, h: 6 }, { x: 40, w: 3.4, h: 6 }], MAT.azulejo);
  portico.position.set(413, PLATEAU, 152);
  portico.rotation.y = Math.PI / 2;
  g.add(ay);
  mapRect(486, 152, 148, 104);

  /* --- Patio de los Leones --- */
  const le = new THREE.Group();
  const lfloor = new THREE.Mesh(boxGeo(172, 0.6, 140, 8), MAT.marmol);
  lfloor.position.set(305, PLATEAU + 0.3, 132);
  lfloor.receiveShadow = true;
  le.add(lfloor);
  /* galería porticada al norte y al oeste */
  const northPts = [], westPts = [];
  for (let i = 0; i <= 10; i++) northPts.push([228 + i * 16, 66]);
  for (let i = 0; i <= 7; i++) westPts.push([223, 76 + i * 15]);
  addArcada(le, northPts, 4.2, MAT.azulejo);
  addArcada(le, westPts, 4.2, MAT.azulejo);
  /* enclose el patio */
  addBox(le, 174, 9, 2.4, 305, PLATEAU + 4.5, 202, MAT.tapiaOsc);
  addBox(le, 2.4, 9, 140, 391, PLATEAU + 4.5, 132, MAT.tapiaOsc);
  addBox(le, 174, 9, 2.4, 305, PLATEAU + 4.5, 62, MAT.tapiaOsc);
  /* fuente de los Leones */
  const fuente = new THREE.Group();
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(11.5, 11.8, 1.5, 28), MAT.piedra);
  basin.position.y = 0.75; basin.castShadow = true; basin.receiveShadow = true;
  const basinIn = new THREE.Mesh(new THREE.CylinderGeometry(10.2, 10.2, 0.5, 28), MAT.agua);
  basinIn.position.y = 1.45;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 2.4, 12), MAT.piedra);
  stem.position.y = 2.4;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 1.6, 1.3, 16), MAT.piedra);
  bowl.position.y = 4.1;
  const water2 = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.3, 16), MAT.agua);
  water2.position.y = 4.65;
  fuente.add(basin, basinIn, stem, bowl, water2);
  fuente.position.set(305, PLATEAU, 132);
  le.add(fuente);
  scene.userData.pools.push({ mesh: basinIn, kind: 'fountain' });
  /* doce leones */
  const lionMat = new THREE.MeshStandardMaterial({ color: 0xb8ab92, roughness: 0.85 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + 0.26;
    const lx = 305 + Math.cos(a) * 17.5, lz = 132 + Math.sin(a) * 17.5;
    const lg = new THREE.Group();
    const ped = new THREE.Mesh(boxGeo(1.9, 1.5, 1.9, 3), MAT.piedra);
    ped.position.y = 0.75;
    const body = new THREE.Mesh(boxGeo(2.1, 1.05, 1.15, 3), lionMat);
    body.position.y = 2.05;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lionMat);
    head.position.set(1.0, 2.35, 0);
    const muzzle = new THREE.Mesh(boxGeo(0.5, 0.38, 0.55, 3), lionMat);
    muzzle.position.set(1.35, 2.2, 0);
    const legG = new THREE.Group();
    for (const [ox, oz] of [[0.7, 0.38], [0.7, -0.38], [-0.7, 0.38], [-0.7, -0.38]]) {
      const leg = new THREE.Mesh(boxGeo(0.3, 0.8, 0.3, 2), lionMat);
      leg.position.set(ox, 1.65, oz);
      legG.add(leg);
    }
    const tail = new THREE.Mesh(boxGeo(0.85, 0.2, 0.2, 2), lionMat);
    tail.position.set(-1.25, 2.3, 0);
    lg.add(ped, body, head, muzzle, legG, tail);
    lg.position.set(lx, PLATEAU, lz);
    lg.rotation.y = -a + Math.PI / 2;
    lg.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
    le.add(lg);
  }
  g.add(le);
  mapRect(305, 132, 172, 140);

  /* --- Sala de los Abencerrajes (abierta al patio de los Leones) --- */
  const ab = new THREE.Group();
  /* muros: norte, sur y fondo (este) */
  addBox(ab, 48, 9, 2.4, 368, PLATEAU + 4.5, 109, MAT.tapiaOsc);
  addBox(ab, 48, 9, 2.4, 368, PLATEAU + 4.5, 165, MAT.tapiaOsc);
  addBox(ab, 2.4, 9, 58, 388.6, PLATEAU + 4.5, 137, MAT.tapiaOsc);
  const abFloor = new THREE.Mesh(boxGeo(46, 0.4, 54, 6), MAT.marmol);
  abFloor.position.set(368, PLATEAU + 0.2, 137);
  abFloor.receiveShadow = true;
  ab.add(abFloor);
  /* artesonado escalonado (mocárabes) */
  for (let i = 0; i < 4; i++) {
    const w = 34 - i * 8;
    const m = new THREE.Mesh(boxGeo(w, 0.9, w, 3), MAT.claro);
    m.position.set(368, PLATEAU + 9 + i * 0.9, 137);
    m.rotation.y = i * Math.PI / 4;
    ab.add(m);
  }
  /* fachada de tres arcos lobulados hacia el patio */
  const abFront = addArchPanel(ab, 58, 9, 1.2, [
    { x: -19, w: 3.6, h: 6.2 }, { x: 0, w: 3.6, h: 6.2 }, { x: 19, w: 3.6, h: 6.2 }
  ], MAT.tapiaOsc);
  abFront.position.set(344, PLATEAU, 137);
  abFront.rotation.y = -Math.PI / 2;
  g.add(ab);

  /* --- Sala de los Embajadores (abierta al sur, con cúpula) --- */
  const emb = new THREE.Group();
  addBox(emb, 164, 15, 2.6, 306, PLATEAU + 7.5, 216, MAT.tapia);
  addBox(emb, 2.6, 15, 86, 224, PLATEAU + 7.5, 259, MAT.tapia);
  addBox(emb, 2.6, 15, 86, 388, PLATEAU + 7.5, 259, MAT.tapia);
  /* fachada sur: tres arcos que dejan ver la sala */
  const embFront = addArchPanel(emb, 164, 15, 1.6, [
    { x: -46, w: 11, h: 11 }, { x: 0, w: 13, h: 12 }, { x: 46, w: 11, h: 11 }
  ], MAT.tapiaOsc);
  embFront.position.set(306, PLATEAU, 302);
  const embFloor = new THREE.Mesh(boxGeo(158, 0.4, 80, 7), MAT.marmol);
  embFloor.position.set(306, PLATEAU + 0.2, 259);
  embFloor.receiveShadow = true;
  emb.add(embFloor);
  /* galería de columnas interiores */
  for (let i = 0; i < 6; i++) {
    const x = 248 + i * 23;
    addColumna(emb, x, 228, 11);
    addColumna(emb, x, 290, 11);
  }
  /* tambor y cúpula de mocárabes */
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 5, 8), MAT.claro);
  drum.position.set(306, PLATEAU + 17, 259);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(15, 12, 7, 0, TAU, 0, Math.PI / 2), MAT.claro);
  dome.position.set(306, PLATEAU + 19.5, 259);
  const domeTip = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), MAT.bronce);
  domeTip.position.set(306, PLATEAU + 35, 259);
  emb.add(drum, dome, domeTip);
  /* ventanales del ábside */
  for (let i = 0; i < 5; i++) {
    addOpening(emb, 2.8, 6.5, 306 - 28 + i * 14, PLATEAU + 2.2, 214.6, 0, MAT.sombra);
  }
  g.add(emb);
  mapRect(306, 259, 164, 86);

  monument.add(g);
}

/* ------------------------------------------- Palacio de Carlos V */
{
  const g = new THREE.Group();
  const cx = 642, cz = 176, R = 46;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 17, 48, 1, true), MAT.piedra);
  ring.position.set(cx, PLATEAU + 8.5, cz);
  ring.castShadow = true; ring.receiveShadow = true;
  ring.material = new THREE.MeshStandardMaterial({ map: TEX.piedra, roughness: 0.85, side: THREE.DoubleSide });
  g.add(ring);
  const cornice = new THREE.Mesh(new THREE.TorusGeometry(R, 1.5, 6, 48), MAT.piedra);
  cornice.rotation.x = Math.PI / 2;
  cornice.position.set(cx, PLATEAU + 17, cz);
  g.add(cornice);
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(R - 1.5, R - 1.5, 0.6, 48), MAT.marmol);
  floor.position.set(cx, PLATEAU + 0.3, cz);
  floor.receiveShadow = true;
  g.add(floor);
  /* patio interior */
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(19, 19, 8, 32, 1, true), MAT.claro);
  inner.position.set(cx, PLATEAU + 4, cz);
  g.add(inner);
  /* dos pisos de columnas en el patio */
  for (const [yy, rr] of [[4, 17], [9.5, 18.5]]) {
    const n = 24;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 5, 8), MAT.piedra);
      col.position.set(cx + Math.cos(a) * rr, PLATEAU + yy, cz + Math.sin(a) * rr);
      col.castShadow = true;
      g.add(col);
    }
  }
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(17.6, 0.9, 5, 32), MAT.piedra);
  ring2.rotation.x = Math.PI / 2; ring2.position.set(cx, PLATEAU + 6.6, cz);
  g.add(ring2);
  /* portada con columnas exteriores al sur */
  for (let i = 0; i < 8; i++) {
    const a = -0.55 + (i / 7) * 1.1;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.95, 12, 10), MAT.piedra);
    col.position.set(cx + Math.sin(a) * (R - 4), PLATEAU + 6, cz + Math.cos(a) * (R - 4));
    col.castShadow = true;
    g.add(col);
  }
  monument.add(g);
  mapCirc(cx, cz, R);
}

/* ------------------------------- Santa María, puertas y Generalife */
{
  const g = new THREE.Group();
  /* Iglesia de Santa María */
  addBox(g, 46, 13, 48, 539, PLATEAU + 6.5, 72, MAT.tapiaOsc, 0, 6);
  addBox(g, 48, 1.2, 50, 539, PLATEAU + 13.4, 72, MAT.teja);
  const bell = addTorre(g, 519, 54, 9, 9, 24, MAT.tapiaOsc, { filas: 2, cols: 1 });
  const br = new THREE.Mesh(new THREE.ConeGeometry(6.5, 5, 4), MAT.teja);
  br.position.set(0, 27, 0); br.rotation.y = Math.PI / 4;
  bell.add(br);
  mapRect(539, 72, 46, 48);

  /* Puerta de la Justicia: torre con vano de arco herradura */
  const gate = new THREE.Group();
  addBox(gate, 17.4, 1.1, 17.4, 0, 22.4, 0, MAT.piedra);
  const front = addArchPanel(gate, 16, 22, 1.2, [{ x: 0, w: 4.6, h: 7.2 }], MAT.tapia);
  front.position.set(0, 0, 8.1);
  const back = addArchPanel(gate, 16, 22, 1.2, [{ x: 0, w: 4.6, h: 7.2 }], MAT.tapia);
  back.position.set(0, 0, -8.1); back.rotation.y = Math.PI;
  addBox(gate, 5.6, 22, 16, 5.2, 11, 0, MAT.tapia);
  addBox(gate, 5.6, 22, 16, -5.2, 11, 0, MAT.tapia);
  addBox(gate, 4.8, 15, 16, 0, 14.4, 0, MAT.tapia);
  gate.position.set(568, PLATEAU, 351);
  g.add(gate);
  mapRect(568, 351, 18, 18);

  /* Puerta de los Leones (norte) */
  const gl = new THREE.Group();
  addBox(gl, 12, 14, 12, 0, 7, 0, MAT.tapia);
  const glf = addArchPanel(gl, 12, 14, 1.2, [{ x: 0, w: 3.4, h: 6 }], MAT.tapia);
  glf.position.set(0, 0, 6.1);
  const glb = addArchPanel(gl, 12, 14, 1.2, [{ x: 0, w: 3.4, h: 6 }], MAT.tapia);
  glb.position.set(0, 0, -6.1); glb.rotation.y = Math.PI;
  gl.position.set(300, PLATEAU, -60);
  g.add(gl);
  mapRect(300, -60, 14, 14);

  /* Generalife: palacio */
  addBox(g, 84, 12, 58, 830, PLATEAU + 6, 15, MAT.tapiaOsc, 0, 6);
  addBox(g, 86, 1.2, 60, 830, PLATEAU + 12.6, 15, MAT.teja);
  /* arquería de la galería */
  const gal = [];
  for (let i = 0; i <= 9; i++) gal.push([792 + i * 8.5, 45]);
  addArcada(g, gal, 4, MAT.azulejo);
  mapRect(830, 15, 84, 58);

  /* acequia del Generalife */
  const acequia = new THREE.Group();
  const canal = new THREE.Mesh(boxGeo(215, 1.2, 5, 8), MAT.piedra);
  canal.position.set(800, PLATEAU + 0.4, 66);
  acequia.add(canal);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(210, 3.4), MAT.agua.clone());
  water.rotation.x = -Math.PI / 2;
  water.position.set(800, PLATEAU + 0.95, 66);
  acequia.add(water);
  scene.userData.pools.push({ mesh: water, kind: 'acequia' });
  /* surtidores */
  const jets = [];
  for (let i = 0; i < 12; i++) {
    const jx = 706 + i * 17.5;
    const j = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.4, 6), new THREE.MeshStandardMaterial({
      color: 0xdff2f5, transparent: true, opacity: 0.65, roughness: 0.2
    }));
    j.position.set(jx, PLATEAU + 2.0, 66);
    acequia.add(j);
    jets.push(j);
  }
  scene.userData.jets = jets;
  /* escalera de agua */
  for (let i = 0; i < 10; i++) {
    const step = new THREE.Mesh(boxGeo(14, 1.1, 3.4, 5), MAT.piedra);
    step.position.set(712, PLATEAU + 0.6 + i * 0.75, 60 - i * 3.6);
    acequia.add(step);
    const chute = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.6), MAT.agua);
    chute.rotation.x = -Math.PI / 2;
    chute.position.set(712, PLATEAU + 1.2 + i * 0.75, 60 - i * 3.6);
    acequia.add(chute);
  }
  g.add(acequia);
  mapRect(800, 66, 215, 5);

  monument.add(g);
}

/* ---------------------------------------------- explanadas y caminos */
{
  const g = new THREE.Group();
  const paving = new THREE.Mesh(boxGeo(240, 0.35, 46, 10), MAT.grava);
  paving.position.set(565, PLATEAU + 0.15, 300);
  g.add(paving);
  const path2 = new THREE.Mesh(boxGeo(60, 0.35, 300, 10), MAT.grava);
  path2.position.set(470, PLATEAU + 0.15, 180);
  g.add(path2);
  const path3 = new THREE.Mesh(boxGeo(330, 0.35, 34, 10), MAT.grava);
  path3.position.set(430, PLATEAU + 0.15, 258);
  g.add(path3);
  const path4 = new THREE.Mesh(boxGeo(38, 0.35, 300, 10), MAT.grava);
  path4.position.set(160, PLATEAU + 0.15, 150);
  g.add(path4);
  const path5 = new THREE.Mesh(boxGeo(230, 0.35, 30, 10), MAT.grava);
  path5.position.set(760, PLATEAU + 0.15, 100);
  g.add(path5);
  monument.add(g);
}
