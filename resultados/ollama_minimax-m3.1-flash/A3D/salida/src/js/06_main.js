/* ==========================================================================
   Bucle principal: animación, cámara, agua, hora del día y arranque
   ========================================================================== */

/* --------------------------------------------------- textura de oleaje */
function texRipple() {
  const { c, x } = canvas2d(128, 128);
  x.fillStyle = '#dcdcdc'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 30; i++) {
    x.strokeStyle = `rgba(255,255,255,${0.08 + rnd() * 0.22})`;
    x.lineWidth = 1 + rnd() * 2.4;
    x.beginPath();
    const cx = rnd() * 128, cy = rnd() * 128, r = 5 + rnd() * 42;
    x.arc(cx, cy, r, 0, TAU);
    x.stroke();
  }
  const t = toTex(c, 5, 5);
  t.repeat.set(3, 1);
  return t;
}
const rippleTex = texRipple();
if (scene.userData.pools) {
  scene.userData.pools.forEach(p => {
    p.mesh.material.map = rippleTex;
    p.mesh.material.needsUpdate = true;
  });
}

/* ------------------------------------------------------------ resize */
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
}
window.addEventListener('resize', onResize);

/* ------------------------------------------------------------- bucle */
let lastT = performance.now();
let fpsAcc = 0, fpsN = 0, fps = 60;
let mapTick = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastT) / 1000, 0.06);
  lastT = now;
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }

  /* transición de hora del día */
  if (blend.t < 1) {
    blend.t = Math.min(1, blend.t + dt / 1.3);
    applyPresetNow(blend.from, blend.to, easeInOut(blend.t));
  }

  /* avance del recorrido */
  if (tour.playing && !tour.free) {
    tour.time += dt * tour.speed;
    if (tour.time >= T_TOTAL) {
      tour.time = T_TOTAL;
      setPlaying(false);
    }
  }

  /* cámara */
  if (tour.free) {
    orbit.update();
  } else {
    poseAt(tour.time, _pos, _tgt);
    camera.position.copy(_pos);
    camera.lookAt(_tgt);
  }

  /* agua: desplazamiento del oleaje y pulsos de los surtidores */
  rippleTex.offset.x = (rippleTex.offset.x + dt * 0.06) % 1;
  rippleTex.offset.y = (rippleTex.offset.y + dt * 0.02) % 1;
  if (scene.userData.jets) {
    const t = now / 1000;
    scene.userData.jets.forEach((j, i) => {
      const s = 1 + 0.18 * Math.sin(t * 3.1 + i * 0.9);
      j.scale.y = s;
      j.position.y = PLATEAU + 1.95 + (s - 1) * 1.2;
    });
  }

  /*轻微 movimiento del agua en la pila */
  if (scene.userData.pools) {
    scene.userData.pools.forEach((p, i) => {
      if (p.kind === 'fountain') p.mesh.position.y = PLATEAU + 1.45 + Math.sin(now / 700 + i) * 0.04;
    });
  }

  syncHUD(false);
  updateLabels();

  /* minimapa a ~20 fps */
  mapTick += dt;
  if (mapTick > 0.05) {
    mapTick = 0;
    drawMap();
    const st = STOPS[lastStop] ? lastStop + 1 : 1;
    el.mapCoord.textContent = `parada ${st}/${STOPS.length} · ${fps} fps`;
  }

  renderer.render(scene, camera);
}

/* ------------------------------------------------------------- arranque */
window.__alhambra = { tour, scene, camera, renderer, STOPS, POIS, CAMERA: camCurve, T_TOTAL, terrainHeight, PLATEAU, WALL_PTS, stopStart, orbit, camCurve };

function boot() {
  applyPreset(presetActual, true);
  poseAt(0, _pos, _tgt);
  camera.position.copy(_pos);
  camera.lookAt(_tgt);
  syncHUD(true);
  drawMap();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
  setTimeout(() => {
    const l = document.getElementById('loading');
    if (l) l.classList.add('done');
    setTimeout(() => setPlaying(true), 700);
  }, 260);
}

try {
  boot();
} catch (err) {
  const l = document.getElementById('loading');
  if (l) {
    l.querySelector('.in').innerHTML =
      '<div class="mark">Alhambra</div><div class="err">No se ha podido iniciar la escena 3D.<br>' +
      (err && err.message ? err.message : err) + '<br>Comprueba que el navegador permita WebGL.</div>';
  }
  console.error(err);
}
