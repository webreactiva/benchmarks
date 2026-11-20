/* ==========================================================================
   Recorrido: paradas, spline de cámara, línea de tiempo y etiquetas
   ========================================================================== */

const STOPS = [
  {
    title: 'Puerta de la Justicia',
    place: 'Muralla sur · acceso al recinto',
    text: 'La Alhambra se abre al mundo por esta puerta fortificada, abierta al público en 1858 y coronada por <em>El Descobridor</em>, la figura de un peregrino que señala la ruta hacia La Meca. Durante buena parte de su historia esta fue la única entrada al recinto, tras cruzar el puente sobre el Darro. La portada original, obra del siglo XIII, se conserva en el Museo de la Alhambra.',
    facts: ['Siglo XIII', 'Muralla sur', 'Punto de acceso'],
    cam: [575, 96, 405], tgt: [568, 68, 351], dwell: 4.2
  },
  {
    title: 'Plaza de los Aljibes',
    place: 'Explanada sur e iglesia de Santa María',
    text: 'Amplia explanada surgida en el siglo XIX al excavarse el gran aljibe que da nombre a la plaza. Al fondo se alza la iglesia de Santa María, construida sobre una mezquita del siglo XI y cabecera de una comunidad morisca y después cristiana. Su torre campanario es la referencia visual más recognizable de toda la Alhambra.',
    facts: ['Aljibes de la Alhambra', 'Iglesia de Santa María', 'Siglo XVI'],
    cam: [505, 86, 288], tgt: [540, 64, 90], dwell: 4.6
  },
  {
    title: 'Alcazaba: la Torre de la Vela',
    place: 'La fortaleza militar de la Alhambra',
    text: 'Coronando el punto más alto del conjunto, la Torre de la Vela fue levantada en el siglo XIII y rehecha después del terremoto de 1528. Le debe el nombre a la campana colgada de su mirador, que anunciaba el crepúsculo a toda Granada: la señal de <em>la vela</em> que marcaba el final de la jornada. Desde aquí se controla todo el valle del Darro.',
    facts: ['Torre de la Vela', 'Siglos XIII–XVIII', 'Campanario'],
    cam: [100, 104, 222], tgt: [48, 82, 148], dwell: 5.0
  },
  {
    title: 'Torre Quebrada y muralla norte',
    place: 'Defensa noroccidental del recinto',
    text: 'Caminando por el adarve norte se llega a la Torre Quebrada, una de las primeras piezas de artillería de la Corona de Castilla: sus troneras se orientan al norte para batir un eventual cerco de la ciudad. La muralla de tapial, de hasta dieciséis metros de altura, protege la meseta de la Sabika por el poniente.',
    facts: ['Torre Quebrada', 'Tapial', 'Muralla de la Sabika'],
    cam: [168, 86, 6], tgt: [99, 74, 44], dwell: 4.4
  },
  {
    title: 'Palacio de Carlos V',
    place: 'Plaza de los Aljibes · Renacimiento',
    text: 'Erigido entre 1527 y 1537 en pleno corazón de la medina islámica, este palacio renacentista es redondo y macizo, y el mundo entero lo llama <em>Carlos V</em>. Dentro, el patio circular de dos plantas de columnas encierra a su vez un pequeño jardín de cipreses. Es la única arquitectura de estilo italiano renacentista de toda la Alhambra.',
    facts: ['1527–1537', 'Pedro Machuca', 'Patio circular'],
    cam: [648, 96, 306], tgt: [642, 66, 176], dwell: 5.2
  },
  {
    title: 'Patio de los Leones',
    place: 'Palacios Nazaríes · corazón de la Alhambra',
    text: 'El patio más destacado de los Palacios Nazaríes, construido por el sultán Muhammad V entre 1330 y 1350. En su centro se alza la fuente de los doce leones, más que emblema firma del grabador que los diseñó. Las esbeltas columnas que rodean el patio soportan un pórtico de mocárabes que sostiene el piso alto y el tejado de madera.',
    facts: ['1330–1350', 'Muhammad V', 'Fuente de los doce leones'],
    cam: [305, 74, 194], tgt: [305, 60, 132], dwell: 5.6
  },
  {
    title: 'Sala de los Abencerrajes',
    place: 'Palacios Nazaríes · artesonado de mocárabes',
    text: 'Una de las salas más notables de la Alhambra, en cuyo techo de mocárabes se advierte el sello del artífice que la decoró en el siglo XVI, cuando la dinastía nazarí ya había caído. El motivo central del artesonado es la estrella de ocho puntas, emblema nazarí, y la leyenda que lo acompaña traduce el deseo de <em>quien mira a Dios, queda protegido</em>.',
    facts: ['Siglo XVI', 'Mocárabes', 'Estrella de ocho puntas'],
    cam: [326, 64, 152], tgt: [366, 59, 139], dwell: 4.8
  },
  {
    title: 'Sala de los Embajadores',
    place: 'Palacios Nazaríes · salón del trono',
    text: 'La mayor estancia de los Palacios Nazaríes, donde se recibía a los emisarios y se despachaba el gobierno del reino nazarí. Su cúpula de mocárabes se asemeja a un paraguas de estrellas, y desde la galería alta la corte podía presenciar la ceremonia desde arriba. La Sala de los Abencerrajes, contigua, se comunicaba con ella mediante un paso cubierto.',
    facts: ['Salón del trono', 'Cúpula de mocárabes', 'Siglo XIV'],
    cam: [306, 68, 337], tgt: [306, 60, 258], dwell: 5.2
  },
  {
    title: 'Patio de los Arrayanes',
    place: 'Palacios Nazaríes · patio de los mirtos',
    text: 'Un jardín rectangular con una larga pila de agua que multiplica el reflejo de la fachada de Comares, revestida de azulejos. El nombre procede de los arrayanes o mirtos plantados en hileras, junto a naranjos y limoneros que densifican la sombra del patio y refrescan el verano granadino.',
    facts: ['1350', 'Pila de los mirtos', 'Fachada de azulejos'],
    cam: [452, 72, 206], tgt: [520, 60, 150], dwell: 5.0
  },
  {
    title: 'El Mexuar',
    place: 'Palacios Nazaríes · salón de audiencia',
    text: 'Sala cuadrada donde el sultán reunía a su consejo para impartir justicia: el <em>mexuar</em> es, literalmente, el lugar de audiencia. La estancia fue construida por Yusuf I a principios del siglo XIV y conserva un techo de madera de artesa con tejas esmaltadas, de las pocas cubiertas originales que sobrevivieron al incendio de 1898.',
    facts: ['Yusuf I', 'Siglo XIV', 'Techo de artesa esmaltada'],
    cam: [452, 76, 118], tgt: [458, 64, 72], dwell: 4.4
  },
  {
    title: 'Torre de Comares',
    place: 'La torre del agua · 45 metros de altura',
    text: 'La torre más alta de la Alhambra, levantada por Yusuf I entre 1304 y 1330. Aloja el salón de Comares, la estancia más amplia del conjunto, capaz de reunir a toda la corte. Su mirador revela la geometría de los Palacios Nazaríes: un laberinto de patios, aljibes y fuentes, con la Alcazaba recortada al fondo.',
    facts: ['1304–1330', '45 metros de altura', 'Salón de Comares'],
    cam: [374, 118, 8], tgt: [332, 88, 78], dwell: 5.4
  },
  {
    title: 'Mirador de Comares',
    place: 'Torre de Comares · panorama del conjunto',
    text: 'Desde lo alto de la torre la Alhambra se lee como un mapa: el eje de los Palacios Nazaríes, la Alcazaba al oeste, el Generalife al este y, al sur, el río Darro separando el conjunto del Albaicín. Aquí quiso Yusuf I mostrar a sus visitantes el alcance de una obra que aún no estaba terminada.',
    facts: ['Panorámica del conjunto', 'Eje nazarí', 'Darro y Albaicín'],
    cam: [330, 120, 72], tgt: [250, 60, 210], dwell: 5.8
  },
  {
    title: 'Patio de la Acequia',
    place: 'Generalife · jardín y canal de agua',
    text: 'El Generalife, el <em>jardín del jefe</em>, es la finca agrícola y de recreo de los sultanes. Su elemento central es la acequia, un canal de piedra que trae el agua del Darro y la reparte entre fuentes, riegos y norias, un sistema que hace posible la luxuriant vegetación en pleno verano granadino.',
    facts: ['Siglo XIV', 'Acequia', 'Agua del Darro'],
    cam: [800, 74, 142], tgt: [800, 60, 66], dwell: 5.2
  },
  {
    title: 'Escalera de Agua',
    place: 'Generalife · prodigio de la hidráulica medieval',
    text: 'La escalera de agua es un prodigio de la ingeniería medieval: dos canales paralelos descienden por la pendiente del cerro y cada peldaño lanza un chorro que permite salvar el desnivel sin perder presión. El agua servía para regar, para las fuentes del jardín y para dar de beber a los visitantes que subían hasta el palacio.',
    facts: ['Norias y canales', 'Ingeniería hidráulica', 'Siglo XIV'],
    cam: [730, 78, 134], tgt: [712, 62, 46], dwell: 4.6
  },
  {
    title: 'Palacio del Generalife',
    place: 'Pabellón del Generalife · mirador de la Barca',
    text: 'En la cota más alta del recinto, el pabellón del Generalife conserva un salón con techo de madera, una columnata de mármol y una galería con vistas al valle. Desde el pequeño mirador de la Barca, una barca de madera colgada sobre el vacío, se contempla toda la Alhambra y el casco antiguo de Granada.',
    facts: ['Pabellón del Generalife', 'Mirador de la Barca', 'Vistas al Albaicín'],
    cam: [840, 86, 128], tgt: [830, 64, 18], dwell: 5.4
  },
  {
    title: 'Mirador de Lindaraja',
    place: 'Sur del recinto · el Darro y la Alhambra desde fuera',
    text: 'Termina el recorrido en el punto que mejor explica la elección del sitio: desde la ruta que sube desde el Darro, la Alhambra aparece como una ciudad dentro de la ciudad, con sus murallas, sus torres y sus tejados de teja árabe. Al fondo, la Sierra Nevada cierra el horizonte con las nieves de abril.',
    facts: ['Mirador de Lindaraja', 'Sierra Nevada', 'Ruta de los puestos'],
    cam: [404, 90, 330], tgt: [430, 48, 470], dwell: 6.0
  }
];

/* --- etiquetas 3D de los conjuntos --- */
const POIS = [
  { t: 'Torre de la Vela', s: 'Alcazaba', p: [48, 100, 148] },
  { t: 'Torre del Homenaje', s: 'Alcazaba', p: [97, 86, 112] },
  { t: 'Torre Quebrada', s: 'Alcazaba', p: [99, 78, 44] },
  { t: 'Torre de Comares', s: 'Palacios Nazaríes', p: [330, 116, 78] },
  { t: 'Palacio de Comares', s: 'Nazaríes', p: [392, 76, 160] },
  { t: 'Mexuar', s: 'Nazaríes', p: [458, 72, 68] },
  { t: 'Patio de los Arrayanes', s: 'Nazaríes', p: [486, 64, 152] },
  { t: 'Patio de los Leones', s: 'Nazaríes', p: [305, 64, 132] },
  { t: 'Sala de los Embajadores', s: 'Nazaríes', p: [306, 94, 259] },
  { t: 'Palacio de Carlos V', s: 'Renacimiento', p: [642, 78, 176] },
  { t: 'Santa María de la Alhambra', s: 'Iglesia', p: [539, 74, 72] },
  { t: 'Puerta de la Justicia', s: 'Acceso sur', p: [568, 84, 351] },
  { t: 'Generalife', s: 'Jardines', p: [830, 74, 15] },
  { t: 'Patio de la Acequia', s: 'Generalife', p: [800, 64, 66] }
];

/* ------------------------------------------------------- spline cámara */
const camPts = [], tgtPts = [];
STOPS.forEach(s => { camPts.push(V3(s.cam[0], s.cam[1], s.cam[2])); tgtPts.push(V3(s.tgt[0], s.tgt[1], s.tgt[2])); });
/* puntos de control intermedios para que el vuelo no atraviese edificios */
const EXTRAS = [
  { at: 4, p: V3(420, 126, 130), q: V3(330, 96, 80) },   // entre las paradas 5 y 6, sobre Comares
  { at: 11, p: V3(560, 124, 40), q: V3(800, 72, 60) }    // entre las paradas 12 y 13, rumbo al Generalife
];
EXTRAS.forEach(e => { camPts.splice(e.at, 0, e.p); tgtPts.splice(e.at, 0, e.q); });

const camCurve = new THREE.CatmullRomCurve3(camPts, false, 'centripetal', 0.5);
const tgtCurve = new THREE.CatmullRomCurve3(tgtPts, false, 'centripetal', 0.5);

/* índice de cada parada dentro del spline (por los puntos extra) */
const stopIndex = [];
{
  let k = 0;
  for (let i = 0; i < STOPS.length; i++) {
    stopIndex.push(k);
    k += (EXTRAS.some(e => e.at === i) ? 2 : 1);
  }
}
const uOf = i => stopIndex[i] / (camPts.length - 1);

/* ------------------------------------------------------- línea de tiempo */
const TIMELINE = [];
{
  let t = 0;
  for (let i = 0; i < STOPS.length; i++) {
    TIMELINE.push({ type: 'dwell', stop: i, dur: STOPS[i].dwell, t0: t });
    t += STOPS[i].dwell;
    if (i < STOPS.length - 1) {
      const a = camPts[stopIndex[i]], b = camPts[stopIndex[i + 1]];
      const dur = clamp(a.distanceTo(b) / 34, 4.2, 9.5);
      TIMELINE.push({ type: 'travel', stop: i, dur, t0: t });
      t += dur;
    }
  }
}
const T_TOTAL = TIMELINE[TIMELINE.length - 1].t0 + TIMELINE[TIMELINE.length - 1].dur;

function segmentAt(time) {
  const t = clamp(time, 0, T_TOTAL);
  for (let i = 0; i < TIMELINE.length; i++) {
    const s = TIMELINE[i];
    if (t < s.t0 + s.dur || i === TIMELINE.length - 1) {
      return { seg: s, local: clamp((t - s.t0) / s.dur, 0, 1), idx: i };
    }
  }
  return { seg: TIMELINE[0], local: 1, idx: 0 };
}

/* instante en que comienza cada parada (para la línea de tiempo) */
const stopStart = [];
{
  let acc = 0;
  for (let i = 0; i < STOPS.length; i++) {
    stopStart.push(acc);
    acc += STOPS[i].dwell;
    if (i < STOPS.length - 1) acc += TIMELINE.find(s => s.type === 'travel' && s.stop === i).dur;
  }
}

/* ---------------------------------------------------- controlador cámara */
const tour = {
  playing: false,
  time: 0,
  speed: 1,
  free: false,
  stop: 0
};

const _pos = new THREE.Vector3(), _tgt = new THREE.Vector3(), _off = new THREE.Vector3();
const UP = V3(0, 1, 0);

function poseAt(time, outPos, outTgt) {
  const r = segmentAt(time);
  const s = r.seg;
  if (s.type === 'dwell') {
    const u = uOf(s.stop);
    const ang = Math.sin(r.local * Math.PI * 2 * 0.085) * 0.085;
    const p = camCurve.getPoint(u);
    const t = tgtCurve.getPoint(u);
    _off.copy(p).sub(t).applyAxisAngle(UP, ang);
    outPos.copy(t).add(_off);
    outTgt.copy(t);
  } else {
    const a = uOf(s.stop), b = uOf(s.stop + 1);
    const u = lerp(a, b, easeInOut(r.local));
    camCurve.getPoint(u, outPos);
    tgtCurve.getPoint(u, outTgt);
  }
  return s;
}

/* pose exacta de una parada concreta */
function stopPose(i, outPos, outTgt) {
  const u = uOf(i);
  camCurve.getPoint(u, outPos);
  tgtCurve.getPoint(u, outTgt);
}

/* --------------------------------------------------- etiquetas DOM 3D */
const labelLayer = document.getElementById('labels');
const labelEls = [];
POIS.forEach(p => {
  const el = document.createElement('div');
  el.className = 'lbl';
  el.innerHTML = `<b>${p.t}</b><i>${p.s}</i><div class="stem"></div><div class="dot"></div>`;
  labelLayer.appendChild(el);
  labelEls.push({ el, pos: V3(p.p[0], p.p[1], p.p[2]) });
});
const _v = new THREE.Vector3();
function updateLabels() {
  const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
  for (const L of labelEls) {
    _v.copy(L.pos).project(camera);
    const dist = camera.position.distanceTo(L.pos);
    const visible = _v.z < 1 && _v.x > -1.05 && _v.x < 1.05 && _v.y > -1.05 && _v.y < 1.05 && dist < 640;
    if (!visible) { L.el.classList.remove('on'); continue; }
    L.el.classList.add('on');
    L.el.style.left = ((_v.x * 0.5 + 0.5) * w) + 'px';
    L.el.style.top = ((-_v.y * 0.5 + 0.5) * h) + 'px';
    L.el.style.opacity = String(clamp(1.3 - dist / 640, 0.2, 1));
  }
}
