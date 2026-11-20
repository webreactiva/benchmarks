/* ==========================================================================
   Jardines: Generalife, parterres, cipreses y arbolado del cerro
   ========================================================================== */
{
  /* huerto de naranjos del Patio de los Arrayanes */
  for (let i = 0; i < 6; i++) {
    const x = 448 + i * 14, z = 118;
    const g = new THREE.Group();
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 2.4, 6), vegMats.tronco);
    t.position.y = 1.2;
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1, 1),
      new THREE.MeshStandardMaterial({ color: 0x3d6330, roughness: 0.95, flatShading: true }));
    c.position.y = 3.6; c.scale.set(1, 0.85, 1);
    g.add(t, c);
    g.position.set(x, PLATEAU, z);
    g.traverse(n => { if (n.isMesh) n.castShadow = true; });
    monument.add(g);
  }

  /* cipreses del Generalife, flanqueando la acequia */
  for (let i = 0; i < 13; i++) {
    const x = 700 + i * 16;
    addCipres(x, 54, 0.9 + rnd() * 0.25);
    if (i % 2 === 0) addCipres(x + 6, 82, 0.85 + rnd() * 0.25);
  }
  /* cipreses junto a la Escalera de Agua */
  addCipres(690, 40, 1.0); addCipres(690, 96, 0.95);
  addCipres(760, 100, 0.9);

  /* parterres de flores */
  const flowerMats = [
    new THREE.MeshStandardMaterial({ color: 0xc2453f, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0xe0b23c, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0xd6d2c4, roughness: 1 })
  ];
  const beds = [
    [760, 44, 26, 12], [840, 44, 26, 12], [880, 100, 20, 16],
    [560, 250, 30, 16], [600, 250, 24, 16], [520, 250, 22, 16],
    [190, 120, 24, 40], [150, 250, 26, 20]
  ];
  for (let bi = 0; bi < beds.length; bi++) {
    const [x, z, w, d] = beds[bi];
    const kerb = new THREE.Mesh(boxGeo(w, 0.5, d, 4), MAT.piedra);
    kerb.position.set(x, PLATEAU + 0.25, z);
    kerb.receiveShadow = true;
    monument.add(kerb);
    const soil = new THREE.Mesh(boxGeo(w - 1.4, 0.3, d - 1.4, 4),
      new THREE.MeshStandardMaterial({ color: 0x4a3a26, roughness: 1 }));
    soil.position.set(x, PLATEAU + 0.5, z);
    monument.add(soil);
    const n = Math.floor(w * d / 9);
    for (let i = 0; i < n; i++) {
      const fx = x + (rnd() - 0.5) * (w - 3), fz = z + (rnd() - 0.5) * (d - 3);
      const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), flowerMats[bi % 3]);
      f.position.set(fx, PLATEAU + 0.95, fz);
      f.castShadow = true;
      monument.add(f);
    }
  }

  /* arbolado del cerro, fuera de los muros */
  const treeRnd = rng(7788);
  for (let i = 0; i < 260; i++) {
    const x = -700 + treeRnd() * 2400;
    const z = -700 + treeRnd() * 1100;
    const d = sdBox(x - 450, z - 140, (SITIO.x1 - SITIO.x0) / 2 + 12, (SITIO.z1 - SITIO.z0) / 2 + 12);
    if (d < 6) continue;
    if (Math.abs(z - riverZ(x)) < 40) continue;
    const y = terrainHeight(x, z);
    if (y > 120 || y < 12) continue;
    if (treeRnd() > 0.55) addPino(x, z, 0.8 + treeRnd() * 0.8);
    else addCipres(x, z, 0.8 + treeRnd() * 0.6);
  }
  /* bosquecillo de pinos en la ladera sur */
  for (let i = 0; i < 70; i++) {
    const x = -450 + treeRnd() * 1500;
    const z = 400 + treeRnd() * 180;
    const y = terrainHeight(x, z);
    if (y < 14) continue;
    addPino(x, z, 0.9 + treeRnd() * 0.7);
  }
}
