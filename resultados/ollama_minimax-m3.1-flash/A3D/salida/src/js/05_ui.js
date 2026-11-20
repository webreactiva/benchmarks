/* ==========================================================================
   Interfaz: lista de paradas, ficha, transporte, línea de tiempo y minimapa
   ========================================================================== */

const $ = id => document.getElementById(id);
const el = {
  stopList: $('stopList'), cardTitle: $('cardTitle'), cardPlace: $('cardPlace'),
  cardBody: $('cardBody'), cardFacts: $('cardFacts'), cardKicker: $('cardKicker'),
  nowTitle: $('nowTitle'), barFill: $('barFill'), head: $('head'), ticks: $('ticks'),
  play: $('playB'), mapCanvas: $('mapCanvas'), mapCoord: $('mapCoord'),
  help: $('help'), stops: $('stops'), speedBox: $('speeds'), presetBox: $('presets')
};

/* ------------------------------------------------- lista de paradas */
const stopItems = [];
STOPS.forEach((s, i) => {
  const li = document.createElement('li');
  const b = document.createElement('button');
  b.innerHTML = `<span class="n">${i + 1}</span><span class="t">${s.title}</span>`;
  b.addEventListener('click', () => { goStop(i); });
  li.appendChild(b);
  el.stopList.appendChild(li);
  stopItems.push(li);
});

/* ---------------------------------------------------------- transporte */
function goStop(i) {
  tour.time = stopStart[clamp(i, 0, STOPS.length - 1)];
  tour.stop = i;
  syncHUD(true);
}
function nextStop() {
  const r = segmentAt(tour.time);
  let i = r.seg.stop;
  if (r.seg.type === 'travel' && r.local < 0.55) { /* ya va de camino */ }
  else i = Math.min(i + 1, STOPS.length - 1);
  goStop(i);
}
function prevStop() {
  const r = segmentAt(tour.time);
  const i = Math.max(0, r.seg.stop - 1);
  goStop(i);
}
function setPlaying(v) {
  tour.playing = v;
  el.play.textContent = v ? '❚❚' : '▶';
  el.play.classList.toggle('active', v);
}
function setSpeed(v) {
  tour.speed = v;
  Array.from(el.speedBox.children).forEach(b => b.classList.toggle('on', parseFloat(b.dataset.v) === v));
}
function setFree(v) {
  tour.free = v;
  orbit.enabled = v;
  const btn = $('freeBtn');
  if (btn) btn.classList.toggle('active', v);
  if (v) {
    const p = new THREE.Vector3(), t = new THREE.Vector3();
    poseAt(tour.time, p, t);
    camera.position.copy(p);
    camera.lookAt(t);
    orbit.syncFrom(p, t);
    setPlaying(false);
  } else {
    const p = new THREE.Vector3(), t = new THREE.Vector3();
    poseAt(tour.time, p, t);
    camera.position.copy(p);
    camera.lookAt(t);
  }
}

/* -------------------------------------------------------- HUD sincrono */
let lastStop = -1;
function syncHUD(force) {
  const r = segmentAt(tour.time);
  const s = r.seg;
  const idx = s.type === 'dwell' ? s.stop : (r.local > 0.6 ? Math.min(s.stop + 1, STOPS.length - 1) : s.stop);
  const st = STOPS[idx];

  if (idx !== lastStop || force) {
    lastStop = idx;
    el.cardKicker.textContent = `Parada ${String(idx + 1).padStart(2, '0')} / ${STOPS.length}`;
    el.cardTitle.textContent = st.title;
    el.cardPlace.textContent = st.place;
    el.cardBody.innerHTML = st.text;
    el.cardFacts.innerHTML = st.facts.map(f => `<span>${f}</span>`).join('');
    stopItems.forEach((li, i) => {
      li.classList.toggle('active', i === idx);
      li.classList.toggle('done', i < idx);
    });
  }
  const dest = STOPS[s.type === 'travel' ? Math.min(s.stop + 1, STOPS.length - 1) : s.stop];
  el.nowTitle.innerHTML = `${dest.title}<small>${s.type === 'travel' ? 'en camino' : 'en visita'}</small>`;

  const p = tour.time / T_TOTAL;
  el.barFill.style.width = (p * 100).toFixed(2) + '%';
  el.head.style.left = (p * 100).toFixed(2) + '%';
}

/* ------------------------------------------------------- línea tiempo */
{
  stopStart.forEach((t, i) => {
    const d = document.createElement('div');
    d.className = 'tick';
    d.style.left = ((t / T_TOTAL) * 100).toFixed(2) + '%';
    d.title = STOPS[i].title;
    d.addEventListener('click', ev => { ev.stopPropagation(); goStop(i); });
    el.ticks.appendChild(d);
  });
  const track = $('track');
  track.addEventListener('click', ev => {
    const r = track.getBoundingClientRect();
    const p = clamp((ev.clientX - r.left) / r.width, 0, 1);
    tour.time = p * T_TOTAL;
    syncHUD(true);
  });
}

/* --------------------------------------------------------- velocidad */
[0.5, 1, 1.5, 2].forEach(v => {
  const b = document.createElement('button');
  b.textContent = v + '×';
  b.dataset.v = v;
  b.addEventListener('click', () => setSpeed(v));
  el.speedBox.appendChild(b);
});
setSpeed(1);

/* ------------------------------------------------------ hora del día */
Object.keys(PRESETS).forEach(k => {
  const b = document.createElement('button');
  b.textContent = PRESETS[k].label;
  b.dataset.k = k;
  b.addEventListener('click', () => {
    applyPreset(k);
    Array.from(el.presetBox.children).forEach(c => c.classList.toggle('on', c.dataset.k === k));
  });
  el.presetBox.appendChild(b);
});
{
  const b = document.createElement('button');
  b.textContent = 'Vista libre';
  b.id = 'freeBtn';
  b.addEventListener('click', () => setFree(!tour.free));
  el.presetBox.appendChild(b);
  const f = document.createElement('button');
  f.textContent = 'Pantalla completa';
  f.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  });
  el.presetBox.appendChild(f);
  const h = document.createElement('button');
  h.textContent = '?';
  h.title = 'Ayuda';
  h.addEventListener('click', () => el.help.classList.toggle('show'));
  el.presetBox.appendChild(h);
}
Array.from(el.presetBox.children).forEach(c => c.classList.toggle('on', c.dataset.k === presetActual));

/* ------------------------------------------------------------ botones */
el.play.addEventListener('click', () => {
  if (!tour.free) setPlaying(!tour.playing);
});
$('nextB').addEventListener('click', nextStop);
$('prevB').addEventListener('click', prevStop);
$('nextBtn').addEventListener('click', nextStop);
$('prevBtn').addEventListener('click', prevStop);
$('stopsToggle').addEventListener('click', () => {
  const ol = el.stopList;
  const hidden = ol.style.display === 'none';
  ol.style.display = hidden ? '' : 'none';
  $('stopsToggle').textContent = hidden ? '–' : '+';
});
el.help.querySelector('.close').addEventListener('click', () => el.help.classList.remove('show'));

/* ----------------------------------------------------------- minimapa */
const mapCtx = el.mapCanvas.getContext('2d');
const MAPW = el.mapCanvas.width, MAPH = el.mapCanvas.height;
const MB = { x0: -140, x1: 1010, z0: -150, z1: 430 };
const mscale = Math.min((MAPW - 14) / (MB.x1 - MB.x0), (MAPH - 14) / (MB.z1 - MB.z0));
const mox = (MAPW - (MB.x1 - MB.x0) * mscale) / 2;
const moz = (MAPH - (MB.z1 - MB.z0) * mscale) / 2;
const mx = x => mox + (x - MB.x0) * mscale;
const mz = z => moz + (z - MB.z0) * mscale;

const routePts = [];
for (let i = 0; i <= 240; i++) routePts.push(camCurve.getPoint(i / 240));

function drawMap() {
  const c = mapCtx;
  c.clearRect(0, 0, MAPW, MAPH);
  /* fondo */
  c.fillStyle = 'rgba(12,10,8,.55)';
  c.fillRect(0, 0, MAPW, MAPH);
  c.strokeStyle = 'rgba(217,178,106,.07)';
  c.lineWidth = 1;
  for (let x = MB.x0; x < MB.x1; x += 100) { c.beginPath(); c.moveTo(mx(x), 0); c.lineTo(mx(x), MAPH); c.stroke(); }
  for (let z = MB.z0; z < MB.z1; z += 100) { c.beginPath(); c.moveTo(0, mz(z)); c.lineTo(MAPW, mz(z)); c.stroke(); }
  /* siluetas */
  for (const s of MAP) {
    if (s.t === 'w') {
      c.beginPath();
      s.pts.forEach((p, i) => i ? c.lineTo(mx(p[0]), mz(p[1])) : c.moveTo(mx(p[0]), mz(p[1])));
      c.closePath();
      c.strokeStyle = 'rgba(226,196,140,.75)';
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = 'rgba(120,96,60,.16)';
      c.fill();
    } else if (s.t === 'r') {
      c.save();
      c.translate(mx(s.x), mz(s.z));
      c.rotate(s.rot || 0);
      c.fillStyle = 'rgba(214,190,148,.42)';
      c.strokeStyle = 'rgba(240,220,180,.6)';
      c.lineWidth = 1;
      c.fillRect(-s.w * mscale / 2, -s.d * mscale / 2, s.w * mscale, s.d * mscale);
      c.strokeRect(-s.w * mscale / 2, -s.d * mscale / 2, s.w * mscale, s.d * mscale);
      c.restore();
    } else if (s.t === 'c') {
      c.beginPath();
      c.arc(mx(s.x), mz(s.z), s.r * mscale, 0, TAU);
      c.fillStyle = 'rgba(214,190,148,.35)';
      c.strokeStyle = 'rgba(240,220,180,.6)';
      c.fill(); c.stroke();
    }
  }
  /* ruta */
  c.beginPath();
  routePts.forEach((p, i) => i ? c.lineTo(mx(p.x), mz(p.z)) : c.moveTo(mx(p.x), mz(p.z)));
  c.strokeStyle = 'rgba(217,178,106,.85)';
  c.lineWidth = 1.6;
  c.setLineDash([4, 3]);
  c.stroke();
  c.setLineDash([]);
  /* paradas */
  STOPS.forEach((s, i) => {
    const p = camPts[stopIndex[i]];
    c.beginPath();
    c.arc(mx(p.x), mz(p.z), 3, 0, TAU);
    c.fillStyle = i === lastStop ? '#f0d9a4' : 'rgba(217,178,106,.65)';
    c.fill();
  });
  /* cámara */
  const p = camera.position;
  const t = new THREE.Vector3();
  camera.getWorldDirection(t);
  const ang = Math.atan2(t.x, t.z);
  c.save();
  c.translate(mx(p.x), mz(p.z));
  c.rotate(-ang + Math.PI);
  c.fillStyle = 'rgba(255,255,255,.14)';
  c.beginPath();
  c.moveTo(0, 0);
  c.arc(0, 0, 26, -0.45, 0.45);
  c.closePath();
  c.fill();
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(0, 0, 3.2, 0, TAU);
  c.fill();
  c.restore();
  /* norte */
  c.fillStyle = 'rgba(217,178,106,.75)';
  c.font = '9px sans-serif';
  c.fillText('N', MAPW - 13, 12);
}

/* clic en el minimapa: salta a la parada más cercana */
el.mapCanvas.addEventListener('click', ev => {
  const r = el.mapCanvas.getBoundingClientRect();
  const px = (ev.clientX - r.left) * (MAPW / r.width);
  const py = (ev.clientY - r.top) * (MAPH / r.height);
  let best = -1, bd = 1e9;
  STOPS.forEach((s, i) => {
    const p = camPts[stopIndex[i]];
    const d = Math.hypot(mx(p.x) - px, mz(p.z) - py);
    if (d < bd) { bd = d; best = i; }
  });
  if (best >= 0 && bd < 26) goStop(best);
});

/* --------------------------------------------------------- teclado */
window.addEventListener('keydown', ev => {
  if (ev.target && /input|textarea/i.test(ev.target.tagName)) return;
  switch (ev.key) {
    case ' ': ev.preventDefault(); if (!tour.free) setPlaying(!tour.playing); break;
    case 'ArrowRight': nextStop(); break;
    case 'ArrowLeft': prevStop(); break;
    case 'l': case 'L': setFree(!tour.free); break;
    case 'h': case 'H': el.help.classList.toggle('show'); break;
    case 'f': case 'F':
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
      break;
  }
});
