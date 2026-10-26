// Direction C, "Floor by Floor": a bigger building. A five-storey mass-timber block hangs apart over its
// city block, floor by floor. The camera comes down into the gap above level 3 while the floors above still
// float, and level 4 lowers onto its columns over your head.
import {
  THREE, Part, bx, beam, cyl, ball, panel, M, V, D2R, clamp, lerp, ease, easeOut, win, segs,
  scene, renderer, lineMat, stdMat, toneMat, liveLine, eyeKey, rng, ctx, ACCENT, INK, boxUV, canvasTex,
} from './core.js';

const BX = 12, BZ = 8;                         // half footprint
const G0 = 4.5, FH = 3.5, BEAM = 0.5, SLAB = 0.24;
const COLX = [-10.8, -5.4, 0, 5.4, 10.8], COLZ = [-6.6, -2.2, 2.2, 6.6];
const CORE = [6.4, -7.4, 11.4, -3.2];          // x0, z0, x1, z1: the north-east corner, where the axo can see it

export async function build(labels) {
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.add(new THREE.HemisphereLight('#fbf8f2', '#e6ddcd', 2.1), new THREE.AmbientLight('#fff8ee', 0.5));
  const sun = new THREE.DirectionalLight('#fff3e2', 1.8);
  sun.position.set(-30, 52, 40); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 5, far: 160 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.target.position.set(0, 10, 0);
  scene.add(sun, sun.target);
  scene.fog = new THREE.Fog('#f2efe7', 140, 420);

  const T = textures();
  const PAL = {
    card: { mat: stdMat('#f3f0ea', { rough: 0.95, bumpMap: T.concBump, bumpScale: 0.006 }), uvScale: 0.2 },
    street: { mat: stdMat('#e3ded4', { rough: 0.95, bumpMap: T.concBump, bumpScale: 0.008 }), uvScale: 0.15 },
    clt: { mat: stdMat('#ffffff', { rough: 0.62, map: T.clt, bumpMap: T.cltBump, bumpScale: 0.022, env: 0.5 }) },
    screed: { mat: stdMat('#ffffff', { rough: 0.68, map: T.screed, bumpMap: T.concBump, bumpScale: 0.012, env: 0.45 }), uvScale: 0.45, w: 'mid' },
    glulam: { mat: stdMat('#ffffff', { rough: 0.54, map: T.lamH, bumpMap: T.lamHBump, bumpScale: 0.02, env: 0.55 }) },
    col: { mat: stdMat('#ffffff', { rough: 0.54, map: T.lamV, bumpMap: T.lamVBump, bumpScale: 0.02, env: 0.55 }) },
    beam2: { mat: stdMat('#ffffff', { rough: 0.54, map: T.lamH, bumpMap: T.lamHBump, bumpScale: 0.02, env: 0.55 }), w: 'mid' },
    larch: { mat: stdMat('#ffffff', { rough: 0.64, map: T.larch, bumpMap: T.lamVBump, bumpScale: 0.016 }), uvScale: 0.8 },
    fin: { mat: stdMat('#ffffff', { rough: 0.64, map: T.larch, bumpMap: T.lamVBump, bumpScale: 0.016 }), uvScale: 0.8, w: 'thin' },
    concrete: { mat: stdMat('#ffffff', { rough: 0.84, map: T.stipple, bumpMap: T.concBump, bumpScale: 0.025 }) },
    pier: { mat: stdMat('#ffffff', { rough: 0.84, map: T.stipple, bumpMap: T.concBump, bumpScale: 0.025 }) },
    core: { mat: stdMat('#d6d1c8', { rough: 0.88, map: T.hatch, bumpMap: T.concBump, bumpScale: 0.02 }) },
    coreWall: { mat: stdMat('#b9b4aa', { rough: 0.88, bumpMap: T.concBump, bumpScale: 0.014 }) },
    glass: { mat: stdMat('#b7cdd3', { opacity: 0.14, rough: 0.06, env: 0.85 }), cast: false, edges: false },
    frame: { mat: stdMat('#3c3b36', { rough: 0.42, metal: 0.45, env: 0.65 }) },
    desk: { mat: stdMat('#f4f1ea', { rough: 0.52, bumpMap: T.cltBump, bumpScale: 0.008 }), uvScale: 0.8 },
    chair: { mat: stdMat('#9a978f', { rough: 0.6 }) , w: 'mid' },
    green: { mat: stdMat('#7d9466', { rough: 0.92, bumpMap: T.concBump, bumpScale: 0.02 }), uvScale: 0.6 },
    tree: { mat: stdMat('#f3f0e8', { rough: 1 }), hull: 1, edges: false },
    leaf: { mat: stdMat('#6f8a57', { rough: 0.88 }), hull: 1, edges: false },
    figure: { mat: stdMat('#f7f4ee', { side: THREE.DoubleSide }), thr: 20 },
  };
  const line = lineMat({ w: 0.8, color: '#2a2622', opacity: 0.8 });
  const ctxLine = lineMat({ w: 0.7, color: '#6a655b', opacity: 0.32 });
  const joint = lineMat({ w: 0.5, color: '#7a6a52', opacity: 0.55 });

  // ---- the city block, as a white card model
  const city = new THREE.Group(); scene.add(city);
  const cityUp = new THREE.Group(); city.add(cityUp);
  const cp = new Part(city, { ...PAL, card: { mat: PAL.card.mat, line: ctxLine }, street: { mat: PAL.street.mat, line: ctxLine }, tree: PAL.tree }, ctxLine);
  cp.add('street', bx(-80, -0.12, -60, 80, -0.02, 60));
  cp.add('card', bx(-17, -0.02, -13, 17, 0.12, 13));   // the plot and its pavement
  cp.build();
  const cu = new Part(cityUp, { card: { mat: PAL.card.mat, line: ctxLine }, tree: PAL.tree }, ctxLine);
  const r = rng(5);
  const blocks = [
    [-50, -13, -22, 13, 13], [-50, 19, -26, 44, 11], [-22, 19, 8, 44, 15], [12, 19, 46, 44, 9],
    [22, -13, 48, 13, 8], [-50, -54, -22, -19, 16], [-16, -54, 16, -19, 12], [22, -54, 48, -19, 18],
  ];
  for (const [x0, z0, x1, z1, h] of blocks) {
    // each block is a few buildings of different heights
    const n = 2 + Math.floor(r() * 3); let x = x0;
    for (let i = 0; i < n; i++) { const xe = i === n - 1 ? x1 : x + (x1 - x0) / n * (0.7 + r() * 0.6); cu.add('card', bx(x, 0, z0, xe - 0.3, h * (0.7 + r() * 0.6), z1)); x = xe; }
  }
  cu.build();

  // ---- the building, one group per storey
  const storeys = [];
  function storey(no, name, sub, base) {
    const g = new THREE.Group(); scene.add(g);
    const ln = lineMat({ w: 1.0, color: '#2a2622', opacity: 0.9 }), mid = lineMat({ w: 0.6, color: '#2a2622', opacity: 0.7 }), thin = lineMat({ w: 0.45, color: '#2a2622', opacity: 0.45 });
    const s = { no, name, sub, base, g, line: ln, lines: [ln, mid, thin], part: new Part(g, PAL, ln, { mid, thin }) };
    storeys.push(s); return s;
  }
  const U = (g, sc = 1) => boxUV(g, sc);
  const slabShape = [[-BX, BZ], [BX, BZ], [BX, -BZ], [-BX, -BZ]];
  const coreHole = [[CORE[0] + 0.25, -CORE[1] - 0.25], [CORE[2] - 0.25, -CORE[1] - 0.25], [CORE[2] - 0.25, -CORE[3] + 0.25], [CORE[0] + 0.25, -CORE[3] + 0.25]];
  function coreWalls(part, y0, y1, key = 'core') {
    const [x0, z0, x1, z1] = CORE, t = 0.25;
    part.add(key, U(bx(x0, y0, z0, x1, y1, z0 + t)), U(bx(x0, y0, z0 + t, x0 + t, y1, z1)), U(bx(x1 - t, y0, z0 + t, x1, y1, z1)));
    part.add(key, U(bx(x0 + t, y0, z1 - t, x1 - t, y1, z1)));
  }
  function facade(part, y0, y1, fin = 'fin', step = 3.0, depth = 0.3, w = 0.035) {
    // glass all round, fins outside it, a band across the fin ends top and bottom so the edge reads as one line
    const sides = [[-BX, BZ, BX, BZ, 0, 1], [-BX, -BZ, BX, -BZ, 0, -1], [BX, -BZ, BX, BZ, 1, 0], [-BX, -BZ, -BX, BZ, -1, 0]];
    for (const [x0, z0, x1, z1, nx, nz] of sides) {
      if (nz) {
        part.add('glass', bx(x0, y0, z0 - 0.01, x1, y1, z0 + 0.01));
        part.add('frame', bx(x0, y0, z0 - 0.04, x1, y0 + 0.06, z0 + 0.04), bx(x0, y1 - 0.06, z0 - 0.04, x1, y1, z0 + 0.04));
        for (let x = x0 + step / 2; x < x1; x += step) part.add(fin, U(bx(x - w, y0, z0 + nz * 0.02, x + w, y1, z0 + nz * depth)));
        part.add('larch', bx(x0, y1 - 0.12, Math.min(z0 + nz * 0.02, z0 + nz * depth), x1, y1, Math.max(z0 + nz * 0.02, z0 + nz * depth)));
      } else {
        part.add('glass', bx(x0 - 0.01, y0, z0, x0 + 0.01, y1, z1));
        part.add('frame', bx(x0 - 0.04, y0, z0, x0 + 0.04, y0 + 0.06, z1), bx(x0 - 0.04, y1 - 0.06, z0, x0 + 0.04, y1, z1));
        for (let z = z0 + step / 2; z < z1; z += step) part.add(fin, U(bx(x0 + nx * 0.02, y0, z - w, x0 + nx * depth, y1, z + w)));
        part.add('larch', bx(Math.min(x0 + nx * 0.02, x0 + nx * depth), y1 - 0.12, z0, Math.max(x0 + nx * 0.02, x0 + nx * depth), y1, z1));
      }
    }
  }

  // ground: a concrete podium with a cafe
  const S0 = storey('00', 'Ground', 'Concrete podium, café, lobby', 0);
  S0.part.add('concrete', U(bx(-BX, 0, -BZ, BX, 0.3, BZ)));
  for (const x of COLX) for (const z of COLZ) {
    S0.part.add('concrete', U(bx(x - 0.25, 0.3, z - 0.25, x + 0.25, G0, z + 0.25)));
    S0.part.add('frame', bx(x - 0.28, 0.3, z - 0.28, x + 0.28, 0.38, z + 0.28));
  }
  facade(S0.part, 0.3, G0, 'pier', 3.0, 0.55, 0.26);
  // timber floors: beams on the column lines, the CLT slab, glulam columns, steel connectors, luminaires, facade
  function timberFloor(s, roof) {
    for (const x of COLX) s.part.add('glulam', U(bx(x - 0.18, 0, -BZ + 0.3, x + 0.18, BEAM, BZ - 0.3)));
    for (const z of COLZ) s.part.add('beam2', U(bx(-BX + 0.3, 0.16, z - 0.12, BX - 0.3, BEAM, z + 0.12)));
    // suspended linear studio luminaire bars between the glulam soffit beams
    for (const x of [-8.1, -2.7, 2.7, 8.1]) {
      for (const [z0, z1] of [[-5.6, -3.0], [-1.4, 1.4], [3.0, 5.6]]) {
        if (x > 5.0 && z0 < -2.5) continue;
        s.part.add('frame', bx(x - 0.04, 0.08, z0, x + 0.04, 0.12, z1));
      }
    }
    s.part.add('clt', U(panel(slabShape, [coreHole], SLAB).applyMatrix4(M.flat(BEAM)), 0.5));
    const jt = [];
    for (let x = -BX + 2.4; x < BX - 0.1; x += 2.4) { jt.push([x, BEAM + SLAB + 0.052, -BZ + 0.14, x, BEAM + SLAB + 0.052, BZ - 0.14]); jt.push([x, BEAM - 0.002, -BZ + 0.12, x, BEAM - 0.002, BZ - 0.12]); }
    if (!roof) s.part.add('screed', panel([[-BX + 0.12, BZ - 0.12], [BX - 0.12, BZ - 0.12], [BX - 0.12, -BZ + 0.12], [-BX + 0.12, -BZ + 0.12]], [coreHole], 0.05).applyMatrix4(M.flat(BEAM + SLAB)));
    segs(s.g, jt, joint);
    s.part.add('larch', bx(-BX - 0.02, 0, BZ - 0.12, BX + 0.02, BEAM + SLAB, BZ + 0.02), bx(-BX - 0.02, 0, -BZ - 0.02, BX + 0.02, BEAM + SLAB, -BZ + 0.12),
      bx(BX - 0.12, 0, -BZ, BX + 0.02, BEAM + SLAB, BZ), bx(-BX - 0.02, 0, -BZ, -BX + 0.12, BEAM + SLAB, BZ));
    if (roof) return;
    const y0 = BEAM + SLAB;
    for (const x of COLX) for (const z of COLZ) {
      s.part.add('col', U(bx(x - 0.18, y0, z - 0.18, x + 0.18, FH, z + 0.18)));
      // steel base & head knife-plate collar connectors on each glulam column
      s.part.add('frame', bx(x - 0.195, y0, z - 0.195, x + 0.195, y0 + 0.08, z + 0.195),
        bx(x - 0.195, FH - 0.11, z - 0.195, x + 0.195, FH, z + 0.195));
    }
    // core access portal frame on the west face of the concrete core
    s.part.add('frame', bx(CORE[0] - 0.03, y0, -5.85, CORE[0] + 0.02, y0 + 2.25, -5.77),
      bx(CORE[0] - 0.03, y0, -4.63, CORE[0] + 0.02, y0 + 2.25, -4.55),
      bx(CORE[0] - 0.03, y0 + 2.18, -5.85, CORE[0] + 0.02, y0 + 2.26, -4.55));
    facade(s.part, y0, FH);
  }
  const names = [['01', 'Level 1', 'Offices · CLT 240 on glulam'], ['02', 'Level 2', 'Offices · 384 m²'], ['03', 'Level 3', 'Studios · 384 m²'], ['04', 'Level 4', 'Studios · 384 m²']];
  const SL = names.map(([no, n, sub], i) => { const s = storey(no, n, sub, G0 + i * FH); timberFloor(s); return s; });
  const SR = storey('05', 'Roof', 'Garden, plant room, PV', G0 + 4 * FH);
  timberFloor(SR, true);
  const ry = BEAM + SLAB;
  SR.part.add('larch', bx(-BX, ry, BZ - 0.15, BX, ry + 1.1, BZ), bx(-BX, ry, -BZ, BX, ry + 1.1, -BZ + 0.15), bx(BX - 0.15, ry, -BZ, BX, ry + 1.1, BZ), bx(-BX, ry, -BZ, -BX + 0.15, ry + 1.1, BZ));
  SR.part.add('green', bx(-11.3, ry, -1.5, -1.0, ry + 0.3, 7.3), bx(4.2, ry, 0.5, 11.3, ry + 0.3, 7.3));
  SR.part.add('concrete', U(bx(-10.5, ry, -7.2, -5, ry + 2.0, -3.5)));
  // rooftop solar PV collector arrays over the plant room
  for (const z of [-6.7, -5.5, -4.3]) {
    SR.part.add('frame', bx(-10.1, ry + 2.0, z - 0.35, -5.4, ry + 2.18, z + 0.35));
  }
  for (const [x, z] of [[-8, 2], [-4.5, 5.5], [7.5, 4]]) SR.part.add('leaf', ball(1.1, x, ry + 1.6, z, 2));

  // level 3 has people and desks in it, because that is where the camera stands
  const L3 = SL[2];
  const y3 = BEAM + SLAB;
  const rr = rng(21);
  for (const z of [-0.2, 3.6]) for (let x = -9.5; x < 9; x += 3.4) {
    L3.part.add('desk', bx(x, y3 + 0.72, z, x + 3.0, y3 + 0.745, z + 0.8));
    for (const lx of [x + 0.06, x + 2.9]) L3.part.add('frame', bx(lx, y3, z + 0.08, lx + 0.04, y3 + 0.72, z + 0.12), bx(lx, y3, z + 0.68, lx + 0.04, y3 + 0.72, z + 0.72), bx(lx, y3 + 0.02, z + 0.08, lx + 0.04, y3 + 0.06, z + 0.72));
    L3.part.add('desk', bx(x + 0.1, y3 + 0.35, z + 0.02, x + 2.9, y3 + 0.7, z + 0.04));
    for (let cx = x + 0.5; cx < x + 3; cx += 1.0) {
      L3.part.add('frame', bx(cx - 0.26, y3 + 0.95, z + 0.12, cx + 0.26, y3 + 1.27, z + 0.14), bx(cx - 0.015, y3 + 0.745, z + 0.1, cx + 0.015, y3 + 0.98, z + 0.13));
      const cz = z + 1.2 + rr() * 0.25, a0 = (rr() - 0.5) * 0.9;
      const cp = [bx(-0.23, 0.45, -0.22, 0.23, 0.51, 0.2), bx(-0.2, 0.6, 0.2, 0.2, 1.02, 0.25), bx(-0.02, 0.51, 0.2, 0.02, 0.62, 0.24), cyl(0.022, 0.38, 0, 0.07, 0, 12)];
      for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5; cp.push(beam(V(0, 0.07, 0), V(Math.cos(a) * 0.3, 0.03, Math.sin(a) * 0.3), 0.035, 0.03)); }
      for (const g of cp) { g.rotateY(a0); g.translate(cx + (rr() - 0.5) * 0.3, y3, cz); L3.part.add('chair', g); }
    }
  }
  L3.part.add('leaf', ball(0.5, 8.6, y3 + 1.0, -5.6, 2), ball(0.4, -10.4, y3 + 1.0, -5.8, 2));
  L3.part.add('desk', cyl(0.22, 0.45, 8.6, y3, -5.6, 20), cyl(0.2, 0.45, -10.4, y3, -5.8, 20));
  const person = new THREE.Shape([[-0.15, 0], [-0.05, 0], [-0.025, 0.8], [0.025, 0.8], [0.05, 0], [0.15, 0], [0.12, 0.86], [0.2, 1.36], [0.15, 1.44], [0.05, 1.47], [-0.05, 1.47], [-0.15, 1.44], [-0.2, 1.36], [-0.12, 0.86]].map(([a, b]) => new THREE.Vector2(a, b)));
  const head = new THREE.Shape(); head.absarc(0, 1.6, 0.105, 0, Math.PI * 2, false);
  const fig = (x, z, h = 1.75, turn = Math.PI / 2) => {
    for (const sh of [person, head]) {
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.01, bevelEnabled: false, curveSegments: 24 });
      g.scale(h / 1.72, h / 1.72, 1); g.rotateY(turn); g.translate(x, y3, z); L3.part.add('figure', g);
    }
  };
  fig(-2.2, 6.4); fig(4.6, 2.0, 1.68); fig(-7.5, 1.4);

  for (const s of storeys) { s.part.build(); s.g.position.y = s.base; }
  // the core: one concrete tower that always stands 2.6 m clear of the roof, so it stretches with the stack.
  const CORE_TOP0 = G0 + 4 * FH + BEAM + SLAB + 2.6;
  const coreG = new THREE.Group(); coreG.position.y = 0.3; scene.add(coreG);
  const coreLine = lineMat({ w: 1.1, color: '#2a2622', opacity: 0.9 });
  const cpart = new Part(coreG, PAL, coreLine);
  coreWalls(cpart, 0, CORE_TOP0 - 0.3, 'coreWall');
  cpart.build();
  const capG = new THREE.Group(); scene.add(capG);
  const capPart = new Part(capG, PAL, coreLine);
  coreWalls(capPart, 0, 0.18, 'core');
  // internal lift-shaft divider wall inside the concrete core
  capPart.add('core', U(bx(CORE[0] + 0.25, 0, (CORE[1] + CORE[3]) / 2 - 0.1, CORE[2] - 0.25, 0.18, (CORE[1] + CORE[3]) / 2 + 0.1), 0.45));
  capPart.build();

  // ---- labels on the north-east corner of each floor
  for (const s of storeys) s.label = labels.add({ no: s.no, name: s.name, sub: s.sub, obj: s.g, at: V(BX, s === S0 ? 0.3 : BEAM + SLAB, -BZ) });

  const coreLabel = labels.add({ no: 'C', name: 'Core', sub: 'Concrete, cast first', obj: capG, at: V(CORE[2], 0.16, CORE[1]) });
  const dash = liveLine(lineMat({ w: 0.9, color: INK, dashed: true, dash: 0.35, gap: 0.3, opacity: 0.6 }));

  // ---- timing: the floors land bottom up, the camera dives into the gap over level 3, level 4 comes down onto it
  const GAP = [3.6, 3.6, 3.6, 3.6, 5.4, 3.6];
  const EYE = G0 + 2 * FH + BEAM + SLAB + 1.6;
  const LAND = [[0.06, 0.13], [0.11, 0.18], [0.16, 0.23], [0.21, 0.3], [0.7, 0.82], [0.8, 0.9]];
  const keys = [
    { at: 0, t: [0.5, 22, 0], az: 45, el: 29, fov: 1.5, h: 56, sx: 0.04, ph: { h: 104, sx: -0.18, sy: -0.3 } },
    { at: 0.05, t: [0.5, 22, 0], az: 45, el: 29, fov: 1.5, h: 56, sx: 0.04, ph: { h: 104, sx: -0.18, sy: -0.3 } },
    { at: 0.34, t: [0.5, 14, 0], az: 45, el: 27, fov: 1.5, h: 45, sx: 0.12, ph: { h: 90, sx: -0.18, sy: -0.28 } },
    eyeKey(0.60, [10.4, EYE, 7.1], [-6, EYE, 3.4], 56, { sy: -0.36, ph: eyeKey(0.60, [10.4, EYE, 7.1], [-6, EYE, 3.4], 82, { sy: -0.33 }) }),
    eyeKey(0.84, [8.8, EYE, 5.8], [-7.5, EYE, 2.0], 56, { sy: -0.08, ph: eyeKey(0.84, [8.8, EYE, 5.8], [-7.5, EYE, 2.0], 80, { sy: -0.18 }) }),
    eyeKey(0.93, [3.6, EYE, 2.95], [-10.5, EYE - 0.12, 4.6], 58, { sy: -0.05, ph: eyeKey(0.93, [3.6, EYE, 2.95], [-10.5, EYE - 0.12, 4.6], 80, { sy: -0.12 }) }),
    eyeKey(1.0, [-2.4, EYE, 2.88], [-11.8, EYE - 0.18, 5.8], 58, { sy: -0.04, ph: eyeKey(1.0, [-2.4, EYE, 2.88], [-11.8, EYE - 0.18, 5.8], 80, { sy: -0.10 }) }),
  ];

  function update(p) {
    const land = LAND.map(([a, b]) => ease(win(p, a, b)));
    cityUp.scale.y = 0.012;
    let acc = 0;
    storeys.forEach((s, i) => {
      acc += GAP[i] * (1 - land[i]);
      s.g.position.y = s.base + acc;
      const cur = LAND.reduce((c, [a], j) => p >= a - 0.004 ? j : c, -1);
      const on = i === cur && p < LAND[i][1] + 0.012;
      for (const m of s.lines) m.color.set(on ? ACCENT : '#2a2622');
      s.label.on = on; s.label.op = p < 0.36 ? 1 : clamp(1 - (p - 0.36) / 0.04);
      coreLabel.op = p < 0.36 ? 1 : clamp(1 - (p - 0.36) / 0.04);
    });
    const top = SR.g.position.y + BEAM + SLAB + 2.6;
    coreG.scale.y = (top - 0.3) / (CORE_TOP0 - 0.3); capG.position.y = top;
    // dotted lines from each column top to where it meets the floor above
    const ls = [];
    for (let i = 1; i < storeys.length; i++) {
      const below = storeys[i - 1], above = storeys[i];
      const top = below.g.position.y + (i === 1 ? G0 : FH), bot = above.g.position.y;
      if (bot - top > 0.05) for (const [x, z] of [[-BX, -BZ], [BX, -BZ], [BX, BZ], [-BX, BZ], [-5.4, 2.2], [5.4, 2.2], [0, 6.6], [-10.8, -6.6], [10.8, 6.6]]) ls.push([x, top, z, x, bot, z]);
    }
    const g0 = storeys[0].g.position.y;
    if (g0 > 0.05) for (const [x, z] of [[-BX, -BZ], [BX, -BZ], [BX, BZ], [-BX, BZ]]) ls.push([x, g0, z, x, 0.12, z]);
    dash.set(ls);
    const stop = p < 0.35 ? 'stack' : p < 0.68 ? 'gap' : p < 0.87 ? 'drop' : 'studio';
    let cap = '', capOp = 0;
    if (p < 0.87) {
      cap = '<span class="lv">LEVEL 03 // +11.50M FFL</span><span class="t">LEVEL 3 · CLT SOFFIT</span><span class="m">384 m² &nbsp;·&nbsp; 3.5 m floor to floor &nbsp;·&nbsp; spruce CLT 240</span>';
      capOp = win(p, 0.78, 0.83) * (1 - win(p, 0.85, 0.87));
    } else {
      cap = '<span class="lv">PERIMETER BAY // GLULAM GRID 5.4M</span><span class="t">OPEN TIMBER STUDIO</span><span class="m">Glulam 360 × 500 &nbsp;·&nbsp; larch solar fins &nbsp;·&nbsp; concrete core</span>';
      capOp = win(p, 0.87, 0.91);
    }
    return {
      hero: 1 - clamp((p - 0.34) / 0.06),
      counter: p < 0.4 ? `Floor <b>${String(land.filter(v => v > 0.98).length).padStart(2, '0')}</b> / 06` : '',
      hint: p < 0.36 ? 'Scroll to stack it' : p < 0.84 ? 'Scroll to bring level 4 down' : 'Scroll across the studio floor',
      cap,
      capOp,
      stop,
    };
  }

  return {
    update, keys, R: 130,
    // shadows arrive with the fills, so nothing casts a shadow before it has been drawn
    introHook: (T) => { sun.shadow.intensity = win(T, 3.3, 3.9); },
    colX: () => ctx.phone ? ctx.W - 100 : ctx.W * 0.73,
    draw: { dir: [0, 1, 0], radial: 0.12, c: [0, 0, 0], min: -1, max: 46, soft: 2.2 },
    radar: {
      scale: '1:500',
      viewBox: '-13.5 -9.2 27 18.4',
      plan: 'M-12 -8 H12 V8 H-12 Z M6.4 -7.4 H11.4 V-3.2 H6.4 Z M-5.4 -8 V8 M0 -8 V8 M5.4 -8 V8 M-12 -2.2 H12 M-12 2.2 H12',
      strokeW: 0.36, dotR: 1.0, coneW: 0.28, coneLen: 5.2,
      clampX: [-11.5, 11.5], clampZ: [-7.5, 7.5],
      axoDot: [10.4, 7.1], axoAng: -2.4,
      zones: [
        { stop: 'studio', p: 0.98, tag: 'WEST STUDIO BAY // +11.5M', x: -12, y: -8, w: 12, h: 16 },
        { stop: 'drop', p: 0.82, tag: 'EAST STUDIO BAY // L4 DROP', x: 0, y: -8, w: 12, h: 16 },
      ],
      stops: [
        { stop: 'stack', p: 0.18, tag: 'MASS TIMBER STACK // 00-05', label: 'STACK' },
        { stop: 'gap', p: 0.60, tag: 'LEVEL 03 GAP // +11.5M', label: 'L3 GAP' },
        { stop: 'drop', p: 0.82, tag: 'LEVEL 04 LOWERING', label: 'L4 DROP' },
        { stop: 'studio', p: 0.98, tag: 'OPEN TIMBER STUDIO', label: 'STUDIO' },
      ],
    },
    chrome: {
      title: 'C · Floor by Floor',
      dwg: 'SEC.500',
      brand: 'Storey', brandSub: 'Mass timber buildings',
      nav: 'Projects     Engineering     Contact', cta: 'Talk to us',
      kicker: 'Exploded axonometric · 1:500',
      loader: 'Plotting sheet S-500',
      h1: 'Four floors of timber.<br><em>One week each.</em>',
      lede: 'A concrete ground floor, then four floors of cross-laminated timber on glulam columns. Scroll to stack them, then stand on level 3 while level 4 comes down.',
      spec: [['Building', 'Kerbside House'], ['Floors', '5 + roof'], ['Area', '1,920 m²']],
      hint: 'Scroll to stack it',
    },
  };
}

function textures() {
  const rep = (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const r = rng(9);
  const hatch = rep(canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c4bfb6'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(60,56,50,.55)'; g.lineWidth = 3;
    for (let k = -h; k < w + h; k += 32) { g.beginPath(); g.moveTo(k, h); g.lineTo(k + h, 0); g.stroke(); }
  }));
  const concBump = rep(canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) { g.fillStyle = '#262626'; g.fillRect(0, y, w, 2); g.fillStyle = '#bcbcbc'; g.fillRect(0, y + 2, w, 1.5); }
    for (let i = 0; i < 320; i++) { g.fillStyle = i % 2 ? 'rgba(20,20,20,0.45)' : 'rgba(230,230,230,0.4)'; g.beginPath(); g.arc(r() * w, r() * h, 1 + r() * 2.2, 0, 7); g.fill(); }
  }));
  const stipple = rep(canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#cdc8bf'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) { g.fillStyle = 'rgba(65,60,54,0.16)'; g.fillRect(0, y, w, 1.5); }
    g.fillStyle = 'rgba(70,66,60,.5)';
    for (let i = 0; i < 260; i++) { g.beginPath(); g.arc(r() * w, r() * h, 1 + r() * 1.6, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(70,66,60,.45)'; g.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) { const x = r() * w, y = r() * h, s = 5 + r() * 5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + s, y + s * 0.4); g.lineTo(x + s * 0.2, y + s); g.closePath(); g.stroke(); }
  }));
  const screed = rep(canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#beb7ab'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 380; i++) {
      g.fillStyle = i % 2 ? 'rgba(245,240,230,0.22)' : 'rgba(75,70,62,0.20)';
      g.fillRect(r() * w, r() * h, 1.5 + r() * 2.5, 1.5 + r() * 2.5);
    }
  }));
  const lamPair = (vertical) => {
    const cb = document.createElement('canvas'); cb.width = cb.height = 256;
    const gb = cb.getContext('2d');
    const map = rep(canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#d9bb8d'; g.fillRect(0, 0, w, h);
      gb.fillStyle = '#808080'; gb.fillRect(0, 0, w, h);
      for (let k = 0; k < 256; k += 10.24) {
        const tone = (r() - 0.5) * 14;
        g.fillStyle = `rgb(${Math.round(217 + tone)},${Math.round(187 + tone * 0.8)},${Math.round(141 + tone * 0.6)})`;
        if (vertical) g.fillRect(k, 0, 10.24, h); else g.fillRect(0, k, w, 10.24);
        const bv = Math.round(128 + tone * 2);
        gb.fillStyle = `rgb(${bv},${bv},${bv})`;
        if (vertical) gb.fillRect(k, 0, 10.24, h); else gb.fillRect(0, k, w, 10.24);
        g.fillStyle = `rgba(135,92,48,${0.22 + r() * 0.14})`;
        gb.fillStyle = '#202020';
        if (vertical) { g.fillRect(k, 0, 1.4, h); gb.fillRect(k, 0, 1.8, h); }
        else { g.fillRect(0, k, w, 1.4); gb.fillRect(0, k, w, 1.8); }
      }
      g.strokeStyle = 'rgba(140,98,54,.14)'; g.lineWidth = 1.1;
      gb.strokeStyle = 'rgba(40,40,40,0.28)'; gb.lineWidth = 1.2;
      for (let i = 0; i < 45; i++) {
        const o = r() * 256; g.beginPath(); gb.beginPath();
        if (vertical) { g.moveTo(o, 0); g.bezierCurveTo(o + 6, 80, o - 6, 170, o, 256); gb.moveTo(o, 0); gb.bezierCurveTo(o + 6, 80, o - 6, 170, o, 256); }
        else { g.moveTo(0, o); g.bezierCurveTo(80, o + 6, 170, o - 6, 256, o); gb.moveTo(0, o); gb.bezierCurveTo(80, o + 6, 170, o - 6, 256, o); }
        g.stroke(); gb.stroke();
      }
    }));
    const bump = rep(new THREE.CanvasTexture(cb)); bump.anisotropy = 8;
    return { map, bump };
  };
  const cltCb = document.createElement('canvas'); cltCb.width = cltCb.height = 512;
  const cltGb = cltCb.getContext('2d');
  const clt = rep(canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#e1d1b2'; g.fillRect(0, 0, w, h);
    cltGb.fillStyle = '#808080'; cltGb.fillRect(0, 0, w, h);
    for (let y = 0; y < 512; y += 32) {
      const v = (r() - 0.5) * 12;
      g.fillStyle = `rgb(${Math.round(225 + v)},${Math.round(209 + v * 0.8)},${Math.round(178 + v * 0.6)})`;
      g.fillRect(0, y, w, 32);
      const bv = Math.round(128 + v * 2);
      cltGb.fillStyle = `rgb(${bv},${bv},${bv})`; cltGb.fillRect(0, y, w, 32);
      g.fillStyle = 'rgba(120,86,48,0.22)'; g.fillRect(0, y, w, 1.4);
      cltGb.fillStyle = '#222222'; cltGb.fillRect(0, y, w, 1.8);
    }
    g.strokeStyle = 'rgba(145,106,64,.15)'; g.lineWidth = 1.2;
    cltGb.strokeStyle = 'rgba(35,35,35,0.28)'; cltGb.lineWidth = 1.2;
    for (let i = 0; i < 75; i++) {
      const o = r() * 512, d1 = 8 * (r() - 0.5), d2 = 8 * (r() - 0.5);
      g.beginPath(); g.moveTo(0, o); g.bezierCurveTo(170, o + d1, 340, o + d2, 512, o); g.stroke();
      cltGb.beginPath(); cltGb.moveTo(0, o); cltGb.bezierCurveTo(170, o + d1, 340, o + d2, 512, o); cltGb.stroke();
    }
  }));
  const cltBump = rep(new THREE.CanvasTexture(cltCb)); cltBump.anisotropy = 8;
  const larch = rep(canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c9a476'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      const v = (r() - 0.5) * 14;
      g.fillStyle = `rgb(${Math.round(201 + v)},${Math.round(164 + v * 0.8)},${Math.round(118 + v * 0.6)})`;
      g.fillRect(x, 0, 16, h);
      g.fillStyle = 'rgba(85,54,28,0.24)'; g.fillRect(x, 0, 1.2, h);
    }
  }));
  const lamH = lamPair(false), lamV = lamPair(true);
  return { hatch, stipple, concBump, screed, lamH: lamH.map, lamHBump: lamH.bump, lamV: lamV.map, lamVBump: lamV.bump, clt, cltBump, larch };
}
