// Direction B, "The Unfolded Room": the interior designer's developed elevations. The floor plan in the
// middle, the four walls folded out flat around it, the ceiling beyond the kitchen wall, all annotated like
// a real sheet: dimensions, material codes, elevation titles. Everything on the sheet is flat and washed
// out like a coloured drawing. Scroll folds it into a closed box, the colour comes in, the door opens and
// you walk into the kitchen.
import {
  THREE, Part, bx, cyl, ball, panel, M, V, D2R, clamp, lerp, ease, easeOut, win,
  scene, renderer, camera, lineMat, stdMat, eyeKey, canvasTex, rng, ctx, DRAW, patchFill, INK, segs,
} from './core.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const RX = 3.0, RZ = 2.4, H = 2.9, TH = 0.12, OX = RX + TH, OZ = RZ + TH;
const TX = -0.65, TZ = -0.5;                 // the table
// a soft box: cushions, upholstery
function rb(x0, y0, z0, x1, y1, z1, r = 0.04) {
  const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
  const g = new RoundedBoxGeometry(w, h, d, 4, Math.min(r, Math.min(w, h, d) / 2 - 0.002));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return g;
}

export async function build(labels) {
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.add(new THREE.HemisphereLight('#fffaf1', '#e8dcc6', 2.4));
  // the pendant throws a crisp pool on the table once you are inside (no soft glow on the ceiling)
  const lamp = new THREE.SpotLight('#ffe0ad', 0, 4, 0.62, 0.12, 1.2);
  lamp.position.set(TX, 2.05, TZ); lamp.target.position.set(TX, 0, TZ); scene.add(lamp, lamp.target);
  // the sun starts in the south-west, so shadows fall away from the copy, and comes round to the east
  // window by the time you are inside
  const SUN_A = V(-7, 11, 8), SUN_B = V(10, 7.2, 3.2);
  const sun = new THREE.DirectionalLight('#fff4e4', 2.6);
  sun.position.copy(SUN_A); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 45 });
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.025; sun.target.position.set(0, 0, -1.5);
  scene.add(sun, sun.target);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ color: '#4a3a28', opacity: 0.08 }));
  ground.position.y = -0.125; ground.receiveShadow = true; scene.add(ground);

  const T = buildTextures();
  const PAL = {
    plaster: { mat: stdMat('#ece3d3', { rough: 0.9, map: T.plaster, bumpMap: T.plasterBump, bumpScale: 0.004 }), uvScale: 0.35 },
    ceiling: { mat: stdMat('#efe8db', { rough: 0.92, map: T.plaster, bumpMap: T.plasterBump, bumpScale: 0.003, emissive: '#efe4cf', emissiveIntensity: 0.22 }), uvScale: 0.35 },
    base: { mat: stdMat('#d9d1c3', { rough: 0.88, bumpMap: T.plasterBump, bumpScale: 0.005 }), uvScale: 0.5 },
    floor: { mat: stdMat('#ffffff', { map: T.floor.map, bumpMap: T.floor.bump, bumpScale: 0.024, rough: 0.52, env: 0.55 }), thr: 60 },
    oak: { mat: stdMat('#ffffff', { map: T.oak.map, bumpMap: T.oak.bump, bumpScale: 0.018, rough: 0.56, env: 0.5 }), uvScale: 0.8 },
    walnut: { mat: stdMat('#ffffff', { map: T.walnut.map, bumpMap: T.walnut.bump, bumpScale: 0.02, rough: 0.44, env: 0.6 }), uvScale: 0.8 },
    sage: { mat: stdMat('#87987d', { rough: 0.58, bumpMap: T.oak.bump, bumpScale: 0.008 }), uvScale: 0.8 },
    tile: { mat: stdMat('#ffffff', { map: T.zellige.map, bumpMap: T.zellige.bump, bumpScale: 0.022, rough: 0.24, env: 0.68 }), thr: 60 },
    steel: { mat: stdMat('#a4a29c', { rough: 0.32, metal: 0.72, env: 0.75 }) },
    linen: { mat: stdMat('#ddd4c4', { rough: 0.92, bumpMap: T.fabricBump, bumpScale: 0.02 }), uvScale: 2.2 },
    cushion: { mat: stdMat('#ddd4c4', { rough: 0.92, bumpMap: T.fabricBump, bumpScale: 0.02 }), uvScale: 2.2, hull: 1, thr: 50 },
    pillow: { mat: stdMat('#b2593a', { rough: 0.88, bumpMap: T.fabricBump, bumpScale: 0.022 }), uvScale: 2.2, hull: 1, thr: 50 },
    rust: { mat: stdMat('#b2593a', { rough: 0.78, bumpMap: T.plasterBump, bumpScale: 0.012 }), uvScale: 1.0 },
    ink: { mat: stdMat('#282622', { rough: 0.42, metal: 0.35 }) },
    frame: { mat: stdMat('#363530', { rough: 0.46, metal: 0.25 }) },
    glass: { mat: stdMat('#c4d6da', { opacity: 0.2, rough: 0.08, env: 0.8 }), cast: false, edges: false },
    rug: { mat: stdMat('#ffffff', { map: T.rug.map, bumpMap: T.rug.bump, bumpScale: 0.034, rough: 0.92 }), thr: 60 },
    shade: { mat: stdMat('#f6f0e2', { emissive: '#f3d9a6', emissiveIntensity: 0.38, bumpMap: T.fabricBump, bumpScale: 0.01 }), uvScale: 1.5, hull: 1, edges: false },
    leaf: { mat: stdMat('#5f7f4a', { rough: 0.78, side: THREE.DoubleSide }), w: 'mid', thr: 20 },
    pot: { mat: stdMat('#c4a585', { rough: 0.82, bumpMap: T.plasterBump, bumpScale: 0.016 }), uvScale: 1.0, hull: 1 },
    cream: { mat: stdMat('#f1ebdf', { rough: 0.38 }), hull: 1 },
    artA: { mat: stdMat('#ffffff', { map: T.artA, bumpMap: T.fabricBump, bumpScale: 0.012, rough: 0.78 }) },
    artB: { mat: stdMat('#ffffff', { map: T.artB, bumpMap: T.fabricBump, bumpScale: 0.012, rough: 0.78 }) },
    b1: { mat: stdMat('#a14a33', { rough: 0.7 }), w: 'mid' }, b2: { mat: stdMat('#2f4b5e', { rough: 0.7 }), w: 'mid' }, b3: { mat: stdMat('#d9c8a1', { rough: 0.75 }), w: 'mid' }, b4: { mat: stdMat('#5d6c3d', { rough: 0.7 }), w: 'mid' }, b5: { mat: stdMat('#272623', { rough: 0.65 }), w: 'mid' },
  };
  const line = lineMat({ w: 0.95, color: '#2a2622', opacity: 0.88 });
  const W = { mid: lineMat({ w: 0.6, color: '#2a2622', opacity: 0.6 }) };
  const mkPart = g => new Part(g, PAL, line, W);

  // ---- floor and the things that stand on it
  const floor = new THREE.Group(); scene.add(floor);
  const fp = mkPart(floor);
  fp.add('base', bx(-OX, -0.12, -OZ, OX, -0.02, OZ));
  fp.add('floor', bx(-RX, -0.02, -RZ, RX, 0, RZ));
  const fItems = new THREE.Group(); floor.add(fItems); const fi = mkPart(fItems);
  fi.add('rug', bx(-2.25, 0, -1.75, 0.95, 0.014, 0.75));
  // walnut dining table with recessed apron rails and tabletop centerpiece
  fi.add('walnut', bx(TX - 0.9, 0.72, TZ - 0.45, TX + 0.9, 0.76, TZ + 0.45),
    bx(TX - 0.78, 0.66, TZ - 0.35, TX + 0.78, 0.72, TZ - 0.32),
    bx(TX - 0.78, 0.66, TZ + 0.32, TX + 0.78, 0.72, TZ + 0.35));
  for (const [dx, dz] of [[-0.8, -0.36], [0.8, -0.36], [-0.8, 0.36], [0.8, 0.36]]) fi.add('walnut', bx(TX + dx - 0.03, 0.012, TZ + dz - 0.03, TX + dx + 0.03, 0.72, TZ + dz + 0.03));
  fi.add('cream', cyl(0.14, 0.055, TX - 0.16, 0.76, TZ + 0.03, 28, 0.09));
  fi.add('rust', cyl(0.052, 0.16, TX + 0.18, 0.76, TZ - 0.06, 24, 0.04));
  fi.add('b3', bx(TX + 0.34, 0.76, TZ + 0.02, TX + 0.6, 0.786, TZ + 0.22));
  // four chairs: legs, a seat, two back posts and two rails
  for (const x of [TX - 0.45, TX + 0.45]) for (const s of [-1, 1]) {
    const zs = TZ + s * 0.7, zb = zs + s * 0.19;
    fi.add('oak', bx(x - 0.21, 0.44, zs - 0.2, x + 0.21, 0.47, zs + 0.2));
    for (const [dx, dz] of [[-0.18, -0.17], [0.18, -0.17], [-0.18, 0.17], [0.18, 0.17]]) fi.add('oak', bx(x + dx - 0.017, 0.012, zs + dz - 0.017, x + dx + 0.017, 0.44, zs + dz + 0.017));
    for (const dx of [-0.18, 0.18]) fi.add('oak', bx(x + dx - 0.017, 0.47, zb - 0.017, x + dx + 0.017, 0.88, zb + 0.017));
    fi.add('oak', bx(x - 0.2, 0.8, zb - 0.02, x + 0.2, 0.88, zb + 0.02), bx(x - 0.2, 0.62, zb - 0.015, x + 0.2, 0.65, zb + 0.015));
  }
  // a fig drawn leaf by leaf
  fi.add('pot', cyl(0.2, 0.42, 2.5, 0, -1.85, 40, 0.16));
  fi.add('oak', cyl(0.014, 1.3, 2.5, 0.4, -1.85, 8));
  const leafShape = new THREE.Shape(); leafShape.absellipse(0, 0.18, 0.095, 0.18, 0, Math.PI * 2, false);
  for (let i = 0; i < 16; i++) {
    const h = 0.72 + i * 0.065, a = i * 2.4, th = 0.7 + (i % 3) * 0.22, k = 0.85 + (i % 4) * 0.08;
    const g = new THREE.ExtrudeGeometry(leafShape, { depth: 0.004, bevelEnabled: false, curveSegments: 20 });
    g.scale(k, k, 1); g.applyMatrix4(new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationX(th)));
    g.translate(2.5, h, -1.85); fi.add('leaf', g);
  }
  fp.build(); fi.build();

  // ---- the walls, each hinged on its outer bottom edge
  const walls = {};
  function wall(id, pos) {
    const pivot = new THREE.Group(); pivot.position.set(...pos); scene.add(pivot);
    const items = new THREE.Group(); pivot.add(items);
    const w = { id, pivot, items, wp: mkPart(pivot), ip: mkPart(items) };
    walls[id] = w; return w;
  }
  const N = wall('north', [0, 0, -OZ]);
  const S = wall('south', [0, 0, OZ]);
  const Wst = wall('west', [-OX, 0, 0]);
  const E = wall('east', [OX, 0, 0]);
  N.items.position.z = TH; S.items.position.z = -TH; Wst.items.position.x = TH; E.items.position.x = -TH;

  // A north: the kitchen wall
  N.wp.add('plaster', panel([[-OX, 0], [OX, 0], [OX, H], [-OX, H]], [], TH));
  const k = N.ip;
  k.add('sage', bx(-3.0, 0, 0, -2.48, 2.3, 0.62), bx(-2.47, 0, 0, -1.95, 2.3, 0.62));
  k.add('ink', bx(-2.53, 0.92, 0.62, -2.51, 1.24, 0.645), bx(-2.44, 0.92, 0.62, -2.42, 1.24, 0.645));
  k.add('ink', bx(-1.95, 0, 0, 2.25, 0.1, 0.55));
  for (let x = -1.95; x < 2.2; x += 0.6) {
    k.add('sage', bx(x + 0.004, 0.1, 0, x + 0.596, 0.86, 0.6));
    k.add('ink', bx(x + 0.22, 0.81, 0.6, x + 0.38, 0.825, 0.625));
  }
  k.add('oak', bx(-1.97, 0.86, 0, 2.27, 0.9, 0.64));
  k.add('tile', bx(-1.95, 0.9, 0, 2.25, 1.5, 0.012));
  k.add('oak', bx(-1.4, 1.72, 0, 1.6, 1.76, 0.28), bx(-1.25, 0.9, 0.013, -0.85, 1.32, 0.03));
  for (const x of [-1.2, 0.1, 1.4]) k.add('oak', bx(x - 0.015, 1.6, 0, x + 0.015, 1.72, 0.2));
  // induction cooktop + stainless steel sink basin rim & gooseneck mixer tap
  k.add('ink', bx(-0.68, 0.9, 0.12, 0.02, 0.906, 0.52));
  k.add('steel', bx(0.2, 0.9, 0.14, 0.82, 0.908, 0.5), cyl(0.016, 0.32, 0.51, 0.9, 0.08, 12), bx(0.495, 1.2, 0.08, 0.525, 1.22, 0.24));
  k.add('cream', cyl(0.07, 0.2, -1.1, 1.76, 0.14, 32), cyl(0.06, 0.16, -0.9, 1.76, 0.14, 32), cyl(0.09, 0.26, 1.2, 1.76, 0.14, 32));
  k.add('rust', cyl(0.06, 0.14, 0.95, 1.76, 0.14, 32));

  // B east: the window and the seat under it
  const WZ = 1.3, WV0 = 0.48, WV1 = 2.45;
  E.wp.add('plaster', panel([[-RZ, 0], [RZ, 0], [RZ, H], [-RZ, H]], [[[-WZ, WV0], [WZ, WV0], [WZ, WV1], [-WZ, WV1]]], TH).applyMatrix4(M.alongZ(0)));
  const f = 0.06;
  E.wp.add('frame', bx(-TH, WV0, -WZ, 0, WV0 + f, WZ), bx(-TH, WV1 - f, -WZ, 0, WV1, WZ), bx(-TH, WV0, -WZ, 0, WV1, -WZ + f), bx(-TH, WV0, WZ - f, 0, WV1, WZ), bx(-TH, WV0, -0.03, 0, WV1, 0.03));
  E.wp.add('oak', bx(-TH - 0.02, WV0 - 0.025, -WZ - 0.04, 0.01, WV0, WZ + 0.04));
  E.wp.add('glass', bx(-0.07, WV0 + f, -WZ + f, -0.05, WV1 - f, WZ - f));
  E.ip.add('oak', bx(-0.55, 0, -1.55, 0, 0.42, 1.55));
  E.ip.add('cushion', rb(-0.53, 0.42, -1.5, -0.02, 0.52, 1.5, 0.04));
  E.ip.add('linen', bx(-0.09, 0.08, 1.62, -0.02, 2.75, 2.15));
  E.ip.add('pillow', rb(-0.24, 0.5, -1.42, -0.06, 0.84, -0.98, 0.07), rb(-0.26, 0.5, 0.9, -0.06, 0.8, 1.32, 0.07));

  // C south: the door and the bookcase
  S.wp.add('plaster', panel([[-OX, 0], [1.4, 0], [1.4, 2.2], [2.3, 2.2], [2.3, 0], [OX, 0], [OX, H], [-OX, H]], [], TH).applyMatrix4(M.alongX(-TH)));
  S.wp.add('oak', bx(1.36, 0, -TH - 0.01, 1.4, 2.24, 0.01), bx(2.3, 0, -TH - 0.01, 2.34, 2.24, 0.01), bx(1.36, 2.2, -TH - 0.01, 2.34, 2.24, 0.01));
  // hung on the west jamb, opening inward, so from the south-east you see the leaf swing into the room
  const door = new THREE.Group(); door.position.set(1.42, 0, -0.07); S.pivot.add(door);
  const dp = mkPart(door);
  dp.add('oak', bx(0, 0.005, -0.02, 0.86, 2.18, 0.02));
  dp.add('ink', bx(0.74, 1.0, 0.02, 0.78, 1.04, 0.06), bx(0.64, 1.0, 0.04, 0.78, 1.03, 0.06), bx(0.74, 1.0, -0.06, 0.78, 1.04, -0.02), bx(0.64, 1.0, -0.06, 0.78, 1.03, -0.04));
  dp.build();
  const sh = S.ip, X0 = -2.8, X1 = 0.8, D = -0.32;
  sh.add('walnut', bx(X0, 0, 0, X0 + 0.03, 2.4, D), bx(X1 - 0.03, 0, 0, X1, 2.4, D), bx(-1.6, 0, 0, -1.57, 2.4, D), bx(-0.4, 0, 0, -0.37, 2.4, D));
  const shelves = [0, 0.42, 0.84, 1.26, 1.68, 2.1, 2.37];
  for (const y of shelves) sh.add('walnut', bx(X0, y, 0, X1, y + 0.03, D));
  const r = rng(7), bk = ['b1', 'b2', 'b3', 'b4', 'b5', 'b3', 'b2'];
  for (let s = 0; s < shelves.length - 2; s++) {
    for (const [a, b] of [[X0 + 0.03, -1.6], [-1.57, -0.4], [-0.37, X1 - 0.03]]) {
      let x = a + 0.02 + r() * 0.1; const stop = b - 0.02 - r() * 0.35;
      while (x < stop) { const w = 0.025 + r() * 0.035, h = 0.2 + r() * 0.15, d = 0.17 + r() * 0.08; sh.add(bk[Math.floor(r() * bk.length)], bx(x, shelves[s] + 0.03, -0.02, x + w, shelves[s] + 0.03 + h, -0.02 - d)); x += w + 0.004; }
    }
  }

  // D west: the sideboard and two framed architectural paintings
  Wst.wp.add('plaster', panel([[-RZ, 0], [RZ, 0], [RZ, H], [-RZ, H]], [], TH).applyMatrix4(M.alongZ(TH)));
  const wi = Wst.ip;
  for (const z of [-1.6, -1.05, -0.5, 0.05]) {
    wi.add('walnut', bx(0, 0.18, z + 0.004, 0.45, 0.74, z + 0.546));
    wi.add('ink', bx(0.45, 0.66, z + 0.22, 0.47, 0.675, z + 0.33));
  }
  wi.add('walnut', bx(0, 0.74, -1.62, 0.47, 0.77, 0.62));
  for (const z of [-1.55, 0.55]) wi.add('ink', bx(0.38, 0, z - 0.02, 0.42, 0.18, z + 0.02));
  wi.add('walnut', bx(0, 1.1, -1.37, 0.028, 2.04, -0.23), bx(0, 1.3, 0.03, 0.028, 1.9, 0.52));
  wi.add('artA', bx(0.01, 1.12, -1.35, 0.038, 2.02, -0.25));
  wi.add('artB', bx(0.01, 1.32, 0.05, 0.038, 1.88, 0.5));
  wi.add('cream', cyl(0.06, 0.34, 0.24, 0.77, 0.25, 32)); wi.add('shade', cyl(0.18, 0.22, 0.24, 1.08, 0.25, 48, 0.12));
  wi.add('rust', cyl(0.07, 0.3, 0.22, 0.77, -1.2, 32, 0.05));

  // the ceiling, hinged on the kitchen wall's top edge, and its pendant over the table
  const lid = new THREE.Group(); lid.position.set(0, H, 0); N.pivot.add(lid);
  const lp = mkPart(lid); lp.add('ceiling', bx(-OX, 0, 0, OX, TH, 2 * OZ));
  const lItems = new THREE.Group(); lid.add(lItems); const li = mkPart(lItems);
  const lz = OZ + TZ;
  li.add('ink', cyl(0.008, 0.62, TX, -0.62, lz, 8), cyl(0.06, 0.03, TX, -0.03, lz, 32));
  li.add('shade', new THREE.SphereGeometry(0.22, 64, 32).translate(TX, -0.8, lz));

  for (const w of Object.values(walls)) { w.wp.build(); w.ip.build(); }
  lp.build(); li.build();

  // ---- timing: it folds into a closed box, then you walk in through the door
  const FOLD = { west: [0.12, 0.24], north: [0.19, 0.31], east: [0.26, 0.38], south: [0.33, 0.45], lid: [0.42, 0.56] };
  const GROW = { floor: [0.06, 0.18], west: [0.16, 0.26], north: [0.23, 0.33], east: [0.3, 0.4], south: [0.37, 0.47], lid: [0.44, 0.52] };
  const sheets = [];
  let S_tags = () => {};
  const g = (k, p) => lerp(0.015, 1, ease(win(p, ...GROW[k])));

  const keys = [
    { at: 0, t: [0.0, 0, -2.5], az: 90, el: 89.3, fov: 2.2, h: 19.8, sx: 0.2, ph: { h: 46, sx: 0, sy: -0.22 } },
    { at: 0.06, t: [0.0, 0, -2.5], az: 90, el: 89.3, fov: 2.2, h: 19.8, sx: 0.2, ph: { h: 46, sx: 0, sy: -0.22 } },
    { at: 0.3, t: [0.3, 0.8, -1.4], az: 104, el: 42, fov: 2.2, h: 14.5, sx: 0.2, ph: { h: 30, sx: 0, sy: -0.3 } },
    { at: 0.56, t: [0.3, 1.4, 0], az: 112, el: 34, fov: 2.6, h: 10.5, sx: 0.14, ph: { h: 21, sx: 0, sy: -0.22 } },
    { at: 0.62, t: [0.3, 1.4, 0], az: 112, el: 34, fov: 2.6, h: 10.5, sx: 0.14, ph: { h: 21, sx: 0, sy: -0.22 } },
    eyeKey(0.72, [6.6, 3.9, 8.4], [1.6, 1.25, 2.3], 38, { ph: eyeKey(0.72, [7.8, 4.5, 10.2], [1.4, 1.25, 1.8], 50) }),
    eyeKey(0.80, [1.85, 1.6, 4.4], [1.85, 1.58, 0], 52, { sy: -0.04, ph: eyeKey(0.80, [1.85, 1.6, 5.6], [1.85, 1.58, 0], 72, { sy: -0.02 }) }),
    eyeKey(0.87, [1.95, 1.68, 1.9], [-0.8, 1.62, -2.4], 56, { sy: 0.08, ph: eyeKey(0.87, [1.95, 1.68, 1.9], [-1.3, 1.62, -2.4], 74, { sy: 0.18 }) }),
    eyeKey(0.94, [1.10, 1.56, 0.55], [-1.1, 1.46, -2.35], 56, { sy: 0.06, ph: eyeKey(0.94, [1.10, 1.56, 0.55], [-1.1, 1.46, -2.35], 74, { sy: 0.12 }) }),
    eyeKey(1.0, [0.45, 1.54, 0.75], [2.4, 1.38, -0.85], 58, { sy: 0.04, ph: eyeKey(1.0, [0.45, 1.54, 0.75], [2.4, 1.38, -0.85], 74, { sy: 0.08 }) }),
  ];

  function update(p) {
    const fold = {};
    for (const [id, w] of Object.entries(FOLD)) fold[id] = 1 - ease(win(p, ...w));     // 1 = lying flat
    N.pivot.rotation.x = -Math.PI / 2 * fold.north;
    S.pivot.rotation.x = Math.PI / 2 * fold.south;
    Wst.pivot.rotation.z = Math.PI / 2 * fold.west;
    E.pivot.rotation.z = -Math.PI / 2 * fold.east;
    lid.rotation.x = -Math.PI / 2 * fold.lid;
    fItems.scale.y = g('floor', p);
    N.items.scale.z = g('north', p); S.items.scale.z = g('south', p);
    Wst.items.scale.x = g('west', p); E.items.scale.x = g('east', p);
    lItems.scale.y = g('lid', p);
    // half open while you look at the box, then right back against the wall as you walk through
    door.rotation.y = 1.0 * ease(win(p, 0.56, 0.65)) + 1.6 * ease(win(p, 0.78, 0.85));
    for (const [m, a, b] of sheets) { m.opacity = 1 - win(p, a, b); }
    S_tags(p);
    DRAW.uWash.value = 1 - ease(win(p, 0.2, 0.5));
    sun.position.lerpVectors(SUN_A, SUN_B, ease(win(p, 0.56, 0.7)));
    lamp.intensity = 5.5 * win(p, 0.66, 0.84);
    const up = ['west', 'north', 'east', 'south', 'lid'].filter(id => fold[id] < 0.02).length;
    const stop = p < 0.16 ? 'sheet' : p < 0.64 ? 'fold' : p < 0.83 ? 'door' : p < 0.95 ? 'kitchen' : 'window';
    let cap = '', capOp = 0;
    if (p < 0.83) {
      cap = '<span class="lv">ELEVATION C // SOUTH THRESHOLD</span><span class="t">C · THE DOOR WALL</span><span class="m">OK-02 oak door &nbsp;·&nbsp; 900 × 2 200 &nbsp;·&nbsp; wall 6 240</span>';
      capOp = win(p, 0.66, 0.70) * (1 - win(p, 0.79, 0.82));
    } else if (p < 0.95) {
      cap = '<span class="lv">ELEVATION A // NORTH WALL</span><span class="t">THE SAGE KITCHEN</span><span class="m">SG-01 sage lacquer &nbsp;·&nbsp; ZL-03 zellige &nbsp;·&nbsp; OK-02 oak</span>';
      capOp = win(p, 0.84, 0.87) * (1 - win(p, 0.92, 0.95));
    } else {
      cap = '<span class="lv">ELEVATION B // EAST WINDOW SEAT</span><span class="t">DINING &amp; WINDOW BENCH</span><span class="m">WN-05 walnut table &nbsp;·&nbsp; PD-06 paper pendant &nbsp;·&nbsp; LN-04 linen</span>';
      capOp = win(p, 0.95, 0.98);
    }
    return {
      hero: 1 - clamp((p - 0.5) / 0.06),
      counter: p < 0.58 ? `Surface <b>${String(1 + up).padStart(2, '0')}</b> / 06` : '',
      hint: p < 0.5 ? 'Scroll to fold it up' : p < 0.85 ? 'Scroll to go in' : '',
      legend: '<b>A</b> Kitchen &nbsp;<b>B</b> Window &nbsp;<b>C</b> Door &nbsp;<b>D</b> Sideboard &nbsp;<b>E</b> Ceiling',
      legendOp: 1 - win(p, 0.06, 0.1),
      cap,
      capOp,
      stop,
    };
  }

  update(0); scene.updateMatrixWorld(true);
  const SH = { x0: -8.6, z0: -11.6, w: 17.2, d: 18.4, s: 150 };
  const panelTex = drawSheet(SH, 'panel'), groundTex = drawSheet(SH, 'ground');
  const decalMat = (map, a, b) => { const m = patchFill(new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), { wash: false }); sheets.push([m, a, b]); return m; };
  const panelMat = decalMat(panelTex, 0.48, 0.56), groundMat = decalMat(groundTex, 0.1, 0.18);
  function decal(mat, x0, z0, x1, z1, y, parent) {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const x = x0 + uv.getX(i) * (x1 - x0), z = z1 - uv.getY(i) * (z1 - z0);
      uv.setXY(i, (x - SH.x0) / SH.w, 1 - (z - SH.z0) / SH.d);
    }
    const m = new THREE.Mesh(g, mat); m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.renderOrder = 4;
    scene.add(m); m.updateMatrixWorld(); if (parent) parent.attach(m); return m;
  }
  // what rides up: dimensions and item codes, one strip per surface
  decal(panelMat, -OX, -OZ, OX, OZ, 0.03, floor);
  decal(panelMat, SH.x0, -5.42, SH.x0 + SH.w, -OZ, 0.145, N.pivot);
  decal(panelMat, SH.x0, SH.z0, SH.x0 + SH.w, -5.42, 0.03, lid);
  decal(panelMat, SH.x0, -OZ, -OX, 3.0, 0.145, Wst.pivot);
  decal(panelMat, OX, -OZ, SH.x0 + SH.w, 3.3, 0.145, E.pivot);
  decal(panelMat, -OX, OZ, OX, SH.z0 + SH.d, 0.145, S.pivot);
  decal(panelMat, OX, 3.3, SH.x0 + SH.w, SH.z0 + SH.d, 0.145, S.pivot);
  // item codes: upright tags that ride with their surface and hide when it turns away from you
  const CODES = [
    [N.pivot, V(0, 0, 1), 0.12, [[1.6, -3.0, 'SG-01'], [2.05, -3.38, 'OK-02'], [0.9, -3.75, 'ZL-03'], [-0.8, -4.26, 'OK-02']]],
    [E.pivot, V(-1, 0, 0), 0.12, [[3.3, -0.75, 'OK-02'], [3.6, 0.35, 'LN-04'], [5.2, 1.27, 'ST-09']]],
    [S.pivot, V(0, 0, -1), 0.12, [[-1.0, 4.4, 'WN-05'], [1.75, 3.6, 'OK-02']]],
    [Wst.pivot, V(1, 0, 0), 0.12, [[-3.6, -1.1, 'WN-05'], [-4.7, -0.8, 'AR-08'], [-4.15, 0.25, 'LP-10']]],
    [lid, V(0, -1, 0), 0.0, [[TX + 0.2, -5.42 - (OZ + TZ) - 0.2, 'PD-06']]],
  ];
  const tags = [];
  for (const [obj, n, y, list] of CODES) for (const [x, z, c] of list) {
    const at = obj.worldToLocal(V(x, y, z));
    tags.push({ obj, n, item: labels.add({ no: c, name: '', obj, at, mode: 'tag', cls: 'code', tx: 12, ty: -16 }) });
  }
  const tw = new THREE.Vector3(), tn = new THREE.Vector3(), tq = new THREE.Quaternion();
  S_tags = (p) => {
    const life = win(p, 0.0, 0.02) * (1 - win(p, 0.46, 0.52));
    for (const t of tags) {
      t.obj.getWorldQuaternion(tq); tn.copy(t.n).applyQuaternion(tq);
      tw.copy(t.item.at).applyMatrix4(t.obj.matrixWorld); tw.sub(camera.position).negate().normalize();
      t.item.op = life * clamp((tn.dot(tw) - 0.3) / 0.3);
    }
  };
  // the closed box keeps its drawing on the outside: dimension strings and wall titles
  const outMat = lineMat({ w: 1.0, color: INK, opacity: 0 });
  const tk = (x, y, z, ax) => ax === 'x' ? [x - 0.07, y - 0.07, z, x + 0.07, y + 0.07, z] : [x, y - 0.07, z - 0.07, x, y + 0.07, z + 0.07];
  segs(S.pivot, [[-OX, 0.25, 0.015, OX, 0.25, 0.015], tk(-OX, 0.25, 0.015, 'x'), tk(OX, 0.25, 0.015, 'x'),
    [1.4, 2.42, 0.015, 2.3, 2.42, 0.015], tk(1.4, 2.42, 0.015, 'x'), tk(2.3, 2.42, 0.015, 'x'),
    [2.5, 0.02, 0.015, 2.5, 2.2, 0.015], [2.43, 0.02, 0.015, 2.57, 0.02, 0.015], [2.43, 2.2, 0.015, 2.57, 2.2, 0.015]], outMat);
  segs(E.pivot, [[0.015, 0.25, -RZ, 0.015, 0.25, RZ], tk(0.015, 0.25, -RZ, 'z'), tk(0.015, 0.25, RZ, 'z'),
    [0.015, 2.62, -WZ, 0.015, 2.62, WZ], tk(0.015, 2.62, -WZ, 'z'), tk(0.015, 2.62, WZ, 'z')], outMat);
  const OUT = [
    [S.pivot, V(0, 0, 1), V(0, 0.42, 0.015), '6 240', ''], [S.pivot, V(0, 0, 1), V(1.85, 2.58, 0.015), '900', ''],
    [S.pivot, V(0, 0, 1), V(2.5, 1.1, 0.015), '2 200', ''], [S.pivot, V(0, 0, 1), V(-1.9, 1.5, 0.015), 'C', 'Door wall'],
    [E.pivot, V(1, 0, 0), V(0.015, 0.42, 0), '4 800', ''], [E.pivot, V(1, 0, 0), V(0.015, 2.78, 0), '2 600', ''],
    [E.pivot, V(1, 0, 0), V(0.015, 1.5, -1.9), 'B', 'Window wall'],
  ];
  const outs = OUT.map(([obj, n, at, no, name]) => ({ obj, n, item: labels.add({ no, name, obj, at, mode: 'tag', cls: name ? '' : 'code', tx: 0, ty: 0 }) }));
  const prevTags = S_tags;
  S_tags = (p) => {
    prevTags(p);
    const life = win(p, 0.58, 0.63) * (1 - win(p, 0.77, 0.81));
    outMat.opacity = life * 0.9;
    for (const t of outs) {
      t.obj.getWorldQuaternion(tq); tn.copy(t.n).applyQuaternion(tq);
      tw.copy(t.item.at).applyMatrix4(t.obj.matrixWorld); tw.sub(camera.position).negate().normalize();
      t.item.op = life * clamp((tn.dot(tw) - 0.05) / 0.15);
    }
  };
  // what stays on the paper: titles, the finishes schedules, the title block
  decal(groundMat, SH.x0, SH.z0, SH.x0 + SH.w, SH.z0 + SH.d, 0.16, null);

  return {
    update, keys, R: 40,
    // shadows arrive with the fills, so nothing casts a shadow before it has been drawn
    introHook: (T) => { sun.shadow.intensity = win(T, 3.3, 3.9); },
    draw: { dir: [0, 0, 0], radial: 1, c: [0, 0, 0], min: 0, max: 12, soft: 1.0 },
    radar: {
      scale: '1:50',
      viewBox: '-4.2 -3.4 8.4 6.8',
      plan: 'M-3.0 -2.4 H3.0 V2.4 H-3.0 Z M-3.0 -1.8 H2.25 M-1.55 -0.95 H0.25 V-0.05 H-1.55 Z M2.45 -1.55 V1.55 M-2.8 2.08 H0.8',
      strokeW: 0.12, dotR: 0.35, coneW: 0.10, coneLen: 1.8,
      clampX: [-3.2, 3.2], clampZ: [-2.6, 2.8],
      axoDot: [1.85, 2.3], axoAng: -1.95,
      zones: [
        { stop: 'kitchen', p: 0.91, tag: 'ELEV A // SAGE KITCHEN', x: -3.0, y: -2.4, w: 4.5, h: 2.4 },
        { stop: 'window', p: 0.99, tag: 'ELEV B // WINDOW SEAT', x: 1.5, y: -2.4, w: 1.5, h: 3.4 },
        { stop: 'door', p: 0.78, tag: 'ELEV C // DOOR WALL', x: -3.0, y: 0.0, w: 6.0, h: 2.4 },
      ],
      stops: [
        { stop: 'sheet', p: 0.02, tag: 'DEVELOPED SHEET // 1:50', label: 'SHEET' },
        { stop: 'fold', p: 0.56, tag: 'CLOSED BOX // 6 SIDES', label: 'FOLD' },
        { stop: 'door', p: 0.78, tag: 'ELEV C // DOOR WALL', label: 'DOOR' },
        { stop: 'kitchen', p: 0.91, tag: 'ELEV A // KITCHEN', label: 'KITCHEN' },
        { stop: 'window', p: 0.99, tag: 'ELEV B // WINDOW', label: 'WINDOW' },
      ],
    },
    chrome: {
      title: 'B · The Unfolded Room',
      dwg: 'ELEV.02',
      brand: 'Field', brandSub: 'Interiors and joinery',
      nav: 'Rooms     Joinery     Studio', cta: 'Book a visit',
      kicker: 'Developed elevations · Sheet I-02',
      loader: 'Drawing sheet I-02',
      h1: 'We draw all six<br>sides of a <em>room.</em>',
      lede: 'The floor, four walls and the ceiling, laid out flat the way we draw them. Scroll and the kitchen folds itself shut, then walk in.',
      spec: [['Room', 'Kitchen and dining'], ['Size', '6.0 × 4.8 m'], ['Ceiling', '2.90 m']],
      hint: 'Scroll to fold it up',
    },
  };
}

// ---- the sheet, in plan coordinates (north up). Two layers: 'panel' (dimensions and item codes, which ride
// up with their wall) and 'ground' (elevation titles, finishes schedules, title block, which stay on the paper).
function drawSheet(SH, layer) {
  const S = SH.s, X = x => (x - SH.x0) * S, Y = z => (z - SH.z0) * S;
  const ACC = '#e85d04';
  return canvasTex(Math.round(SH.w * S), Math.round(SH.d * S), (g) => {
    g.strokeStyle = INK; g.fillStyle = INK; g.lineCap = 'round';
    const font = (m, wt = 500) => { g.font = `${wt} ${Math.round(m * S)}px "IBM Plex Mono"`; };
    const ln = (x0, z0, x1, z1, w = 2) => { g.lineWidth = w; g.beginPath(); g.moveTo(X(x0), Y(z0)); g.lineTo(X(x1), Y(z1)); g.stroke(); };
    const txt = (t, x, z, m = 0.18, align = 'center', rot = 0, wt = 600, col = INK) => {
      g.save(); g.translate(X(x), Y(z)); g.rotate(rot); font(m, wt); g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = col; g.fillText(t, 0, 0); g.restore();
    };
    const tick = (x, z) => ln(x - 0.07, z + 0.07, x + 0.07, z - 0.07, 3);
    const dimH = (x0, x1, z, t) => { ln(x0, z, x1, z, 1.8); tick(x0, z); tick(x1, z); ln(x0, z - 0.12, x0, z + 0.12, 1.4); ln(x1, z - 0.12, x1, z + 0.12, 1.4); txt(t, (x0 + x1) / 2, z - 0.19); };
    const dimV = (z0, z1, x, t) => { ln(x, z0, x, z1, 1.8); tick(x, z0); tick(x, z1); ln(x - 0.12, z0, x + 0.12, z0, 1.4); ln(x - 0.12, z1, x + 0.12, z1, 1.4); txt(t, x - 0.19, (z0 + z1) / 2, 0.18, 'center', -Math.PI / 2); };
    // an item code: a dot on the thing, the code on a small paper plate beside it
    const code = (dx, dz, c, side = 1) => {
      g.beginPath(); g.arc(X(dx), Y(dz), 0.045 * S, 0, 7); g.fillStyle = ACC; g.fill();
      return;
    };
    const title = (l, t, x, z) => {
      font(0.3, 600); g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillStyle = ACC; g.fillText(l, X(x), Y(z)); const lw = g.measureText(l + '  ').width;
      g.fillStyle = INK; g.fillText(t, X(x) + lw, Y(z));
    };
    const schedule = (x, z, rows, right = false) => rows.forEach(([c, d], i) => {
      font(0.17, 600); g.textBaseline = 'middle';
      const zz = Y(z + i * 0.32), cw = g.measureText(c + '  ').width;
      if (right) { font(0.17, 500); const dw = g.measureText(d).width; g.textAlign = 'left'; g.fillStyle = INK; g.fillText(d, X(x) - dw, zz); font(0.17, 600); g.fillStyle = ACC; g.fillText(c, X(x) - dw - cw, zz); }
      else { g.textAlign = 'left'; g.fillStyle = ACC; g.fillText(c, X(x), zz); font(0.17, 500); g.fillStyle = INK; g.fillText(d, X(x) + cw, zz); }
    });

    if (layer === 'panel') {
      // P plan
      dimH(-3, 3, 2.24, '6 000'); dimV(-2.4, 2.4, -2.78, '4 800');
      txt('KITCHEN', -1.0, 1.3, 0.24); txt('28.8 M²  ·  OK-02 OAK 180', -1.0, 1.66, 0.16, 'center', 0, 500);
      // A kitchen wall (north, z = -2.52 - height on the wall)
      dimV(-2.52, -5.42, -3.45, '2 900'); dimH(-1.95, 2.25, -4.75, '4 200');
      code(1.6, -3.0, 'SG-01'); code(2.05, -3.38, 'OK-02'); code(0.9, -3.75, 'ZL-03'); code(-0.8, -4.26, 'OK-02');
      // B window wall (east, x = 3.12 + height)
      dimV(-1.3, 1.3, 5.84, '2 600'); dimH(3.12, 3.6, -1.7, '480');
      code(3.3, -0.75, 'OK-02'); code(3.6, 0.35, 'LN-04'); code(5.2, 1.27, 'ST-09');
      // C door wall (south, z = 2.52 + height)
      dimH(1.4, 2.3, 4.98, '900'); dimV(2.52, 4.72, 2.66, '2 200'); dimH(-3.12, 3.12, 5.75, '6 240');
      code(-1.0, 4.4, 'WN-05'); code(1.75, 3.6, 'OK-02');
      // D sideboard wall (west, x = -3.12 - height)
      code(-3.6, -1.1, 'WN-05', -1); code(-4.7, -0.8, 'AR-08', -1); code(-4.15, 0.25, 'LP-10', -1);
      // E ceiling (beyond the kitchen wall)
      g.setLineDash([0.1 * S, 0.07 * S]); g.lineWidth = 1.6; g.strokeStyle = INK; g.strokeRect(X(-2.95), Y(-10.3), 5.9 * S, 4.72 * S); g.setLineDash([]);
      for (const x of [-1.0, 0.2, 1.4]) { g.beginPath(); g.arc(X(x), Y(-5.84), 0.06 * S, 0, 7); g.lineWidth = 1.8; g.stroke(); }
      const px = TX, pz = -5.42 - (OZ + TZ);
      g.beginPath(); g.arc(X(px), Y(pz), 0.22 * S, 0, 7); g.stroke(); ln(px - 0.3, pz, px + 0.3, pz, 1.4); ln(px, pz - 0.3, px, pz + 0.3, 1.4);
      code(px + 0.2, pz - 0.2, 'PD-06');
      txt('LIME PLASTER  ·  2 900 AFF', 0, -9.85, 0.18);
      txt('P  PLAN  1:50', -2.85, -2.16, 0.2, 'left');
    } else {
      title('A', 'KITCHEN WALL', 3.5, -5.1);
      schedule(3.5, -4.55, [['SG-01', 'SAGE LACQUER'], ['OK-02', 'OILED OAK'], ['ZL-03', 'ZELLIGE 100 × 100']]);
      title('B', 'WINDOW WALL', 3.4, 2.9);
      schedule(6.3, -1.2, [['OK-02', 'OILED OAK'], ['LN-04', 'LINEN'], ['ST-09', 'STEEL FRAME']]);
      title('C', 'DOOR WALL', -1.4, 6.3);
      schedule(3.5, 3.7, [['WN-05', 'WALNUT'], ['OK-02', 'OILED OAK']]);
      title('D', 'SIDEBOARD WALL', -8.3, 2.9);
      schedule(-6.4, -1.6, [['WN-05', 'WALNUT'], ['AR-08', 'CLIENT’S OWN'], ['LP-10', 'LINEN LAMP']], true);
      title('E', 'CEILING', 3.5, -10.0);
      schedule(3.5, -9.45, [['PD-06', 'PAPER PENDANT Ø 440']]);
      // title block, scale bar, north point
      ln(-8.3, 5.2, -4.6, 5.2, 2.6);
      font(0.24, 600); g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = INK; g.fillText('FIELD  ·  KITCHEN', X(-8.3), Y(5.52));
      font(0.16, 500); g.fillText('SHEET I-02  ·  DEVELOPED ELEVATIONS  ·  1:50', X(-8.3), Y(5.88));
      for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? 'rgba(0,0,0,0)' : INK; g.fillRect(X(-8.3 + i * 0.5), Y(6.12), 0.5 * S, 0.07 * S); g.lineWidth = 1.4; g.strokeRect(X(-8.3 + i * 0.5), Y(6.12), 0.5 * S, 0.07 * S); }
      g.fillStyle = INK; font(0.13); g.fillText('0', X(-8.32), Y(6.38)); g.fillText('2 M', X(-6.45), Y(6.38));
      g.beginPath(); g.arc(X(-4.0), Y(4.0), 0.32 * S, 0, 7); g.lineWidth = 2; g.stroke();
      g.beginPath(); g.moveTo(X(-4.0), Y(3.6)); g.lineTo(X(-4.13), Y(4.1)); g.lineTo(X(-3.87), Y(4.1)); g.closePath(); g.fill();
      txt('N', -4.0, 4.55, 0.16);
    }
  });
}

// ---- procedural material textures & bump maps
function buildTextures() {
  const r = rng(17);
  const woodVeneer = (baseRgb, streakRgb, rows = 8) => {
    const s = 512, cb = document.createElement('canvas'); cb.width = cb.height = s;
    const gb = cb.getContext('2d');
    const map = canvasTex(s, s, (g) => {
      const h = s / rows;
      gb.fillStyle = '#808080'; gb.fillRect(0, 0, s, s);
      for (let row = 0; row < rows; row++) {
        const v = (r() - 0.5) * 16;
        const c = baseRgb.map(ch => Math.round(clamp(ch + v, 0, 255)));
        g.fillStyle = `rgb(${c})`; g.fillRect(0, row * h, s, h);
        const bv = Math.round(120 + (r() - 0.5) * 28);
        gb.fillStyle = `rgb(${bv},${bv},${bv})`; gb.fillRect(0, row * h, s, h);
        for (let k = 0; k < 42; k++) {
          const yy = row * h + r() * h, gh = 0.7 + r() * 1.6;
          g.fillStyle = `rgba(${streakRgb},${0.06 + r() * 0.09})`; g.fillRect(0, yy, s, gh);
          gb.fillStyle = 'rgba(30,30,30,0.28)'; gb.fillRect(0, yy, s, gh);
        }
        g.fillStyle = `rgba(${streakRgb},0.22)`; g.fillRect(0, row * h, s, 1.2);
        gb.fillStyle = '#202020'; gb.fillRect(0, row * h, s, 1.5);
      }
    }, { repeat: true });
    const bump = new THREE.CanvasTexture(cb);
    bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.anisotropy = 8;
    return { map, bump };
  };

  const plaster = canvasTex(512, 512, (g, s) => {
    g.fillStyle = '#fcfaf6'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 65; i++) {
      const x = r() * s, y = r() * s, rad = 28 + r() * 76;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, i % 2 ? 'rgba(255,253,248,0.03)' : 'rgba(185,172,152,0.024)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }, { repeat: true });

  const plasterBump = canvasTex(256, 256, (g, s) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 45; i++) {
      const x = r() * s, y = r() * s, rad = 18 + r() * 52;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, i % 2 ? 'rgba(210,210,210,0.09)' : 'rgba(50,50,50,0.09)');
      gr.addColorStop(1, 'rgba(128,128,128,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }, { repeat: true });

  const fabricBump = canvasTex(128, 128, (g, s) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 4) { g.fillStyle = 'rgba(235,235,235,0.28)'; g.fillRect(0, y, s, 1.5); }
    for (let x = 0; x < s; x += 4) { g.fillStyle = 'rgba(25,25,25,0.28)'; g.fillRect(x, 0, 1.5, s); }
  }, { repeat: true });

  const artA = canvasTex(512, 512, (g, s) => {
    g.fillStyle = '#f2eadb'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#cf9a3e'; g.fillRect(28, 28, s - 56, s - 56);
    g.fillStyle = '#b65332'; g.fillRect(54, 54, 210, s - 108);
    g.fillStyle = '#262420'; g.fillRect(284, 54, 174, 190);
    g.fillStyle = '#efe6d5'; g.beginPath(); g.arc(270, 290, 68, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#262420'; g.lineWidth = 4; g.beginPath(); g.moveTo(54, 290); g.lineTo(s - 54, 290); g.stroke();
  });

  const artB = canvasTex(512, 512, (g, s) => {
    g.fillStyle = '#f2eadb'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#3d5a70'; g.fillRect(28, 28, s - 56, s - 56);
    g.fillStyle = '#e8dec9'; g.fillRect(62, 62, s - 124, 210);
    g.fillStyle = '#c4512c'; g.fillRect(62, 296, 180, 154);
    g.strokeStyle = '#24221e'; g.lineWidth = 5; g.beginPath(); g.arc(256, 170, 64, 0, Math.PI * 2); g.stroke();
  });

  return {
    plaster, plasterBump, fabricBump,
    oak: woodVeneer([203, 158, 107], '95,58,28', 8),
    walnut: woodVeneer([112, 76, 52], '38,20,10', 8),
    floor: oakFloor(),
    zellige: zellige(),
    rug: rug(),
    artA, artB,
  };
}

function oakFloor() {
  const r = rng(3), S = 300, W = Math.round(6 * S), H = Math.round(4.8 * S);
  const cb = document.createElement('canvas'); cb.width = W; cb.height = H;
  const gb = cb.getContext('2d');
  const map = canvasTex(W, H, (g, w, h) => {
    const bw = 0.18 * S;
    gb.fillStyle = '#888888'; gb.fillRect(0, 0, w, h);
    for (let y = 0, row = 0; y < h; y += bw, row++) {
      let x = -r() * 1.5 * S;
      while (x < w) {
        const L = (1.1 + r() * 1.3) * S, t = r();
        const c = [200 + t * 22 - 10, 157 + t * 18 - 8, 106 + t * 14 - 6].map(Math.round);
        g.fillStyle = `rgb(${c})`; g.fillRect(x, y, L, bw);
        const bv = Math.round(115 + t * 32);
        gb.fillStyle = `rgb(${bv},${bv},${bv})`; gb.fillRect(x, y, L, bw);
        g.strokeStyle = `rgba(110,72,40,${0.11 + r() * 0.08})`; g.lineWidth = 1.2;
        gb.strokeStyle = 'rgba(40,40,40,0.28)'; gb.lineWidth = 1.2;
        for (let k = 0; k < 7; k++) {
          const yy = y + 4 + r() * (bw - 8);
          g.beginPath(); gb.beginPath(); g.moveTo(x, yy); gb.moveTo(x, yy);
          for (let xx = x; xx < x + L; xx += 40) {
            const wy = yy + Math.sin(xx * 0.01 + k) * 2.2;
            g.lineTo(xx, wy); gb.lineTo(xx, wy);
          }
          g.stroke(); gb.stroke();
        }
        g.fillStyle = 'rgba(70,45,25,.55)'; g.fillRect(x + L - 1.5, y, 1.5, bw);
        gb.fillStyle = '#141414'; gb.fillRect(x + L - 2, y, 2, bw);
        x += L;
      }
      g.fillStyle = 'rgba(70,45,25,.5)'; g.fillRect(0, y + bw - 1.5, w, 1.5);
      gb.fillStyle = '#141414'; gb.fillRect(0, y + bw - 2, w, 2);
    }
  });
  const bump = new THREE.CanvasTexture(cb); bump.anisotropy = 8;
  return { map, bump };
}
function zellige() {
  const r = rng(11), S = 500, W = Math.round(4.2 * S), H = Math.round(0.6 * S);
  const cb = document.createElement('canvas'); cb.width = W; cb.height = H;
  const gb = cb.getContext('2d');
  const map = canvasTex(W, H, (g, w, h) => {
    g.fillStyle = '#e9e4d8'; g.fillRect(0, 0, w, h);
    gb.fillStyle = '#222222'; gb.fillRect(0, 0, w, h);
    const t = 0.1 * S;
    for (let y = 0; y < h; y += t) for (let x = 0; x < w; x += t) {
      const k = r(); const c = [88 + k * 30, 128 + k * 26, 116 + k * 20].map(Math.round);
      g.fillStyle = `rgb(${c})`; g.fillRect(x + 2, y + 2, t - 4, t - 4);
      const bv = Math.round(165 + (r() - 0.5) * 55);
      gb.fillStyle = `rgb(${bv},${bv},${bv})`; gb.fillRect(x + 2, y + 2, t - 4, t - 4);
      g.fillStyle = `rgba(255,255,255,${0.14 + r() * 0.16})`; g.fillRect(x + 6, y + 6, (t - 12) * r(), 5);
    }
  });
  const bump = new THREE.CanvasTexture(cb); bump.anisotropy = 8;
  return { map, bump };
}
function rug() {
  const S = 300, W = Math.round(3.2 * S), H = Math.round(2.5 * S);
  const cb = document.createElement('canvas'); cb.width = W; cb.height = H;
  const gb = cb.getContext('2d');
  const map = canvasTex(W, H, (g, w, h) => {
    g.fillStyle = '#e8dcc6'; g.fillRect(0, 0, w, h);
    gb.fillStyle = '#787878'; gb.fillRect(0, 0, w, h);
    g.fillStyle = '#b5643f'; g.fillRect(40, 40, w - 80, h - 80);
    g.fillStyle = '#e8dcc6'; for (let i = 0; i < 5; i++) g.fillRect(90, 110 + i * 120, w - 180, 18);
    g.fillStyle = '#7d3f27'; for (let i = 0; i < 4; i++) g.fillRect(90, 160 + i * 120, w - 180, 8);
    for (let y = 0; y < h; y += 5) {
      g.fillStyle = y % 10 === 0 ? 'rgba(255,248,236,0.10)' : 'rgba(50,30,15,0.08)';
      g.fillRect(0, y, w, 2.2);
      gb.fillStyle = y % 10 === 0 ? '#c4c4c4' : '#424242';
      gb.fillRect(0, y, w, 2.5);
    }
  });
  const bump = new THREE.CanvasTexture(cb); bump.anisotropy = 8;
  return { map, bump };
}
