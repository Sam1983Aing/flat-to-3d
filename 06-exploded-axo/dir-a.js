// Direction A, "The Board": the competition-board exploded axo of a timber house, in ink.
// Layers land in building order, then the long lens widens and the drawing becomes a place.
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  THREE, Part, bx, beam, cyl, ball, panel, ring, M, V, D2R, clamp, lerp, ease, easeOut, win,
  scene, lineMat, toneMat, segs, liveLine, eyeKey, canvasTex, ctx, ACCENT, INK, patchFill,
} from './core.js';

// ---- the house (metres). x runs east, z south, y up. The glazed gable faces east onto a porch.
const FL = 0.3, EH = 3.0, TP = Math.tan(40 * D2R), CP = Math.cos(40 * D2R), SP = Math.sin(40 * D2R);
const ZO = 3.5, TH = 0.12, ZI = ZO - TH, XW = -7.4, XE = 7.4, XG = 5.9, F = FL + 0.03;
const RISE = ZO * TP, PL = 0.1;
const UL = z => FL + EH + PL + (ZO - Math.min(Math.abs(z), ZO)) * TP;   // underside of the rafters
const Y0 = FL + EH + PL + RISE;                                          // that line at the ridge
const OH = 0.55, T = (ZO + OH) / CP, XR = 7.95;                          // eave overhang, rafter length, roof ends

// openings, as (u, v) rectangles in each wall's own drawing (v from the slab top)
const SOUTH = [[-1.2, 0.45, 3.2, 2.45], [-6.6, 1.4, -5.8, 2.4]];
const NORTH = [[-6.2, 0.8, -4.6, 2.3], [0.4, 1.05, 2.6, 2.25]];
const WEST = [[-2.6, 0.5, -1.4, 2.6], [1.2, 1.4, 2.2, 2.4]];
const ROUND = { c: [0, 4.35], r: 0.42 };
const rect = ([a, b, c, d]) => [[a, b], [c, b], [c, d], [a, d]];
function rb(x0, y0, z0, x1, y1, z1, r = 0.04) {
  const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
  const g = new RoundedBoxGeometry(w, h, d, 4, Math.min(r, Math.min(w, h, d) / 2 - 0.002));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return g;
}

export async function build(labels) {
  const PAL = {
    white: { mat: toneMat('#fbfaf6', { mode: 0, scale: 1.0 }) },
    floor: { mat: toneMat('#f3e5cd', { mode: 1, scale: 1.2 }) },
    sunPatch: { mat: toneMat('#fdf3da', { mode: 1, scale: 1.2, opacity: 0.72 }), edges: false },
    oak: { mat: toneMat('#f2e2c6', { mode: 1, scale: 1.6 }) },
    concrete: { mat: toneMat('#dfdbd2', { mode: 2, scale: 1.0 }) },
    glass: { mat: toneMat('#dce8eb', { opacity: 0.16, mode: 5 }) },
    clad: { mat: toneMat('#faf8f2', { mode: 1, scale: 2.2 }), w: 'thin' },
    seam: { mat: toneMat('#f3f1eb', { mode: 3, scale: 1.5 }), w: 'thin' },
    rafter: { mat: toneMat('#f4e4cb', { mode: 1, scale: 2.0 }), w: 'mid' },
    steel: { mat: toneMat('#d2cec5', { mode: 3, scale: 2.0 }), w: 'thin' },
    leaf: { mat: toneMat('#eff0e6', { side: THREE.DoubleSide, mode: 0 }), w: 'mid', thr: 20 },
    frame: { mat: toneMat('#ece7dc', { mode: 1, scale: 2.0 }) },
    soft: { mat: toneMat('#f6f3ec', { mode: 4, scale: 1.0 }), hull: 1 },
    cushion: { mat: toneMat('#f8f5ee', { mode: 4, scale: 1.4 }), hull: 1, thr: 50 },
    terracotta: { mat: toneMat('#d97a54', { mode: 4, scale: 1.4 }), hull: 1, thr: 50 },
    shade: { mat: toneMat('#fff5de', { mode: 4, scale: 1.5 }), hull: 1 },
    ember: { mat: toneMat('#ff6a14', { mode: 0, scale: 1.0 }), edges: false },
    book1: { mat: toneMat('#c85a32', { mode: 0 }), w: 'thin' },
    book2: { mat: toneMat('#3d5467', { mode: 0 }), w: 'thin' },
    book3: { mat: toneMat('#e2d6be', { mode: 0 }), w: 'thin' },
    green: { mat: toneMat('#f1f0e8', { mode: 0 }), hull: 1, edges: false },
  };
  const hatchMat = lineMat({ w: 0.6, color: '#8f897d', opacity: 0.9 });
  const dashMat = lineMat({ w: 0.9, color: INK, dashed: true, dash: 0.22, gap: 0.2, opacity: 0.75 });

  // ---- the plan the house stands on
  const plan = new THREE.Mesh(new THREE.PlaneGeometry(24, 16).rotateX(-Math.PI / 2), patchFill(new THREE.MeshBasicMaterial({ map: drawPlan() })));
  plan.position.y = -0.01; scene.add(plan);

  const layers = [];
  function layer(id, no, name, sub, level) {
    const g = new THREE.Group(); scene.add(g);
    const line = lineMat({ w: 1.45 }), mid = lineMat({ w: 0.95 }), thin = lineMat({ w: 0.6, opacity: 0.6 });
    const W = { mid, thin };
    const L = { id, no, name, sub, level, g, line, lines: [line, mid, thin], subs: [] };
    L.part = new Part(g, PAL, line, W);
    L.side = (dir) => { const sg = new THREE.Group(); g.add(sg); const s = { g: sg, dir, part: new Part(sg, PAL, line, W) }; L.subs.push(s); return s; };
    layers.push(L); return L;
  }

  // 01 Floor: slab on strip footings, the oak boards, sunlit floor patches, the furniture that stands on it
  const L1 = layer('floor', '01', 'Floor', 'Concrete slab on strip footings', 1);
  L1.part.add('concrete', bx(-7.55, 0, -3.6, 7.5, FL, 3.6),
    bx(-7.55, -0.7, -3.6, 7.5, 0, -3.1), bx(-7.55, -0.7, 3.1, 7.5, 0, 3.6),
    bx(-7.55, -0.7, -3.1, -7.05, 0, 3.1), bx(7.0, -0.7, -3.1, 7.5, 0, 3.1));
  // galvanized steel perimeter hold-down brackets along the slab edge
  for (const x of [-7.1, -3.7, 0.2, 3.8, 5.8]) {
    L1.part.add('steel', bx(x - 0.06, FL - 0.08, ZO - 0.01, x + 0.06, FL + 0.04, ZO + 0.015),
      bx(x - 0.06, FL - 0.08, -ZO - 0.015, x + 0.06, FL + 0.04, -ZO + 0.01));
  }
  L1.part.add('floor', bx(-7.28, FL, -ZI, XE, F, ZI));
  // warm sunlit floor patches cast through south windows and east glass gable
  L1.part.add('sunPatch',
    bx(-0.95, F + 0.001, 1.15, 2.95, F + 0.003, 3.22),
    bx(4.05, F + 0.001, -2.15, 5.82, F + 0.003, 2.15));
  // a trestle table in oak, a bench, three chairs with legs and a back, plus tabletop vessels
  L1.part.add('oak', bx(1.7, F + 0.72, -0.25, 3.9, F + 0.76, 0.75));
  for (const x of [2.0, 3.6]) {
    L1.part.add('oak', beam(V(x, F, -0.22), V(x, F + 0.72, 0.12), 0.06, 0.05), beam(V(x, F, 0.72), V(x, F + 0.72, 0.38), 0.06, 0.05), bx(x - 0.035, F + 0.64, -0.2, x + 0.035, F + 0.72, 0.7));
  }
  L1.part.add('oak', bx(2.0, F + 0.32, 0.22, 3.6, F + 0.37, 0.28));
  L1.part.add('soft', cyl(0.15, 0.055, 2.55, F + 0.76, 0.25, 28, 0.09), cyl(0.055, 0.16, 3.15, F + 0.76, 0.18, 20, 0.042));
  L1.part.add('terracotta', cyl(0.045, 0.12, 2.95, F + 0.76, 0.36, 18, 0.035));
  L1.part.add('oak', bx(1.9, F + 0.42, 0.98, 3.7, F + 0.46, 1.3), bx(2.0, F, 1.0, 2.05, F + 0.42, 1.28), bx(3.55, F, 1.0, 3.6, F + 0.42, 1.28));
  for (const x of [2.2, 2.8, 3.4]) {
    L1.part.add('oak', bx(x - 0.2, F + 0.44, -0.84, x + 0.2, F + 0.47, -0.44));
    for (const [dx, dz] of [[-0.17, -0.81], [0.17, -0.81], [-0.17, -0.47], [0.17, -0.47]]) L1.part.add('oak', bx(x + dx - 0.017, F, dz - 0.017, x + dx + 0.017, F + 0.44, dz + 0.017));
    for (const dx of [-0.17, 0.17]) L1.part.add('oak', bx(x + dx - 0.017, F + 0.47, -0.83, x + dx + 0.017, F + 0.88, -0.8));
    L1.part.add('oak', bx(x - 0.19, F + 0.8, -0.835, x + 0.19, F + 0.88, -0.795), bx(x - 0.19, F + 0.62, -0.83, x + 0.19, F + 0.65, -0.8));
  }
  // the sofa faces the long south window: a woven rug, base, two seat cushions, two back cushions, arms, accent pillow
  L1.part.add('white', bx(-3.2, F, 0.75, 0.45, F + 0.012, 3.05));
  L1.part.add('oak', bx(-2.88, F + 0.06, 1.02, -0.62, F + 0.26, 1.88));
  L1.part.add('cushion', rb(-2.9, F + 0.06, 1.0, -0.6, F + 0.8, 1.22, 0.07),
    rb(-2.9, F + 0.06, 1.0, -2.7, F + 0.62, 1.9, 0.06), rb(-0.8, F + 0.06, 1.0, -0.6, F + 0.62, 1.9, 0.06),
    rb(-2.7, F + 0.26, 1.22, -1.76, F + 0.46, 1.88, 0.06), rb(-1.74, F + 0.26, 1.22, -0.8, F + 0.46, 1.88, 0.06),
    rb(-2.68, F + 0.46, 1.22, -1.78, F + 0.8, 1.4, 0.07), rb(-1.72, F + 0.46, 1.22, -0.82, F + 0.8, 1.4, 0.07));
  L1.part.add('terracotta', rb(-2.64, F + 0.46, 1.38, -2.24, F + 0.74, 1.66, 0.05));
  for (const [x, z] of [[-2.85, 1.05], [-0.65, 1.05], [-2.85, 1.85], [-0.65, 1.85]]) L1.part.add('oak', bx(x - 0.03, F, z - 0.03, x + 0.03, F + 0.06, z + 0.03));
  // sculptural oak lounge armchair & floor reading lamp completing the living conversation group
  L1.part.add('oak', bx(-0.32, F + 0.24, 2.05, 0.26, F + 0.30, 2.62),
    bx(-0.32, F, 2.05, -0.27, F + 0.52, 2.62), bx(0.21, F, 2.05, 0.26, F + 0.52, 2.62),
    bx(0.18, F + 0.30, 2.07, 0.24, F + 0.74, 2.60));
  L1.part.add('cushion', rb(-0.26, F + 0.30, 2.08, 0.18, F + 0.44, 2.59, 0.05),
    rb(0.06, F + 0.44, 2.09, 0.19, F + 0.72, 2.58, 0.05));
  L1.part.add('steel', cyl(0.14, 0.02, -3.05, F, 1.15, 24), cyl(0.012, 1.32, -3.05, F + 0.02, 1.15, 12));
  L1.part.add('shade', cyl(0.16, 0.22, -3.05, F + 1.28, 1.15, 28, 0.11));
  L1.part.add('soft', cyl(0.4, 0.04, -1.75, F + 0.36, 2.4, 48), cyl(0.04, 0.36, -1.75, F, 2.4, 16));
  L1.part.add('book1', bx(-1.92, F + 0.4, 2.28, -1.64, F + 0.435, 2.48));
  L1.part.add('soft', cyl(0.042, 0.065, -1.56, F + 0.4, 2.42, 16));
  // a wood stove on its hearth against the box, with glowing amber firebox embers & stacked birch logs
  L1.part.add('concrete', bx(-3.62, F, -0.75, -2.75, F + 0.025, 0.35));
  L1.part.add('soft', cyl(0.27, 0.78, -3.2, F + 0.12, -0.2, 40), cyl(0.3, 0.04, -3.2, F + 0.9, -0.2, 40));
  L1.part.add('steel', bx(-3.31, F + 0.3, 0.05, -3.09, F + 0.58, 0.075), bx(-2.95, F + 0.3, -0.32, -2.92, F + 0.58, -0.08));
  L1.part.add('ember', bx(-3.27, F + 0.34, 0.052, -3.13, F + 0.51, 0.082), bx(-2.94, F + 0.34, -0.29, -2.912, F + 0.51, -0.11));
  for (const a of [0.6, 2.7, 4.8]) L1.part.add('steel', bx(-3.2 + Math.cos(a) * 0.2 - 0.02, F + 0.02, -0.2 + Math.sin(a) * 0.2 - 0.02, -3.2 + Math.cos(a) * 0.2 + 0.02, F + 0.12, -0.2 + Math.sin(a) * 0.2 + 0.02));
  L1.part.add('steel', bx(-3.52, F + 0.025, -0.68, -2.98, F + 0.28, -0.46));
  for (const [ly, lz] of [[0.07, -0.61], [0.07, -0.52], [0.16, -0.565]]) {
    L1.part.add('oak', bx(-3.48, F + ly, lz - 0.035, -3.02, F + ly + 0.07, lz + 0.035));
  }
  // ground-floor bedroom & bathroom furniture inside the oak box (visible through the open doorways)
  L1.part.add('oak', bx(-7.1, F, -3.2, -5.2, F + 0.24, -1.2), bx(-7.1, F, -1.15, -6.65, F + 0.42, -0.78));
  L1.part.add('cushion', rb(-7.02, F + 0.24, -3.12, -5.28, F + 0.44, -1.28, 0.06),
    rb(-6.98, F + 0.44, -3.02, -6.58, F + 0.62, -2.24, 0.05), rb(-6.98, F + 0.44, -2.14, -6.58, F + 0.62, -1.36, 0.05));
  L1.part.add('oak', bx(-7.1, F, 0.4, -6.42, F + 0.82, 2.15));
  L1.part.add('white', cyl(0.19, 0.11, -6.74, F + 0.82, 1.25, 24));
  // a fig by the glass, drawn leaf by leaf
  L1.part.add('soft', cyl(0.2, 0.42, 5.3, F, -2.85, 40, 0.16));
  L1.part.add('oak', cyl(0.014, 1.25, 5.3, F + 0.4, -2.85, 8));
  const leaf = new THREE.Shape(); leaf.absellipse(0, 0.17, 0.085, 0.17, 0, Math.PI * 2, false);
  for (let i = 0; i < 15; i++) {
    const h = F + 0.75 + i * 0.065, a = i * 2.4, th = 0.75 + (i % 3) * 0.2, k = 0.85 + (i % 4) * 0.08;
    const g = new THREE.ExtrudeGeometry(leaf, { depth: 0.004, bevelEnabled: false, curveSegments: 20 });
    g.scale(k, k, 1); g.applyMatrix4(new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationX(th)));
    g.translate(5.3, h, -2.85); L1.part.add('leaf', g);
  }
  // floor boards, drawn as hatching
  const boards = [];
  for (let z = -ZI + 0.2; z < ZI; z += 0.2) boards.push([-7.28, F + 0.001, z, XG, F + 0.001, z]);
  for (let z = -ZI + 0.14; z < ZI; z += 0.14) boards.push([XG + 0.06, F + 0.001, z, XE, F + 0.001, z]);
  segs(L1.g, boards, hatchMat);

  // 02 Structure: CLT walls, the oak box with its furnished mezzanine loft, the kitchen
  const L2 = layer('structure', '02', 'Structure', 'Cross-laminated timber, 120 mm', 2);
  const longOut = [[-7.28, 0], [6.2, 0], [6.2, 2.4], [XE, 2.4], [XE, EH], [-7.28, EH]];
  L2.part.add('white', panel(longOut, SOUTH.map(rect), TH).applyMatrix4(M.alongX(ZI, FL)));
  L2.part.add('white', panel(longOut, NORTH.map(rect), TH).applyMatrix4(M.alongX(-ZO, FL)));
  const gable = [[-ZO, 0], [ZO, 0], [ZO, EH + PL], [0, EH + PL + RISE], [-ZO, EH + PL]];
  L2.part.add('white', panel(gable, [...WEST.map(rect), ROUND], TH).applyMatrix4(M.alongZ(XW + TH, FL)));
  L2.part.add('rafter', bx(-7.28, FL + EH, ZI, XE, FL + EH + PL, ZO), bx(-7.28, FL + EH, -ZO, XE, FL + EH + PL, -ZI));
  // the box: a partition with two doors, a wall between bed and bath, the loft on top with its rail, ladder, and loft furniture
  const part = [[-ZI, 0.03], [-1.6, 0.03], [-1.6, 2.13], [-0.7, 2.13], [-0.7, 0.03], [0.7, 0.03], [0.7, 2.13], [1.5, 2.13], [1.5, 0.03], [ZI, 0.03], [ZI, 2.75], [-ZI, 2.75]];
  L2.part.add('oak', panel(part, [], 0.12).applyMatrix4(M.alongZ(-3.7, FL)));
  L2.part.add('oak', panel([[-7.28, 0.03], [-3.82, 0.03], [-3.82, 2.75], [-7.28, 2.75]], [], 0.1).applyMatrix4(M.alongX(-0.05, FL)));
  const LOFT_Y = FL + 2.9;
  L2.part.add('oak', bx(-7.28, FL + 2.75, -ZI, -3.7, LOFT_Y, ZI));
  // loft balustrade with a clean entry opening at the ladder (z = -2.55 .. -1.90)
  for (const z of [-3.15, -2.55, -1.90, -1.15, -0.40, 0.35, 1.10, 1.85, 2.60, 3.25]) {
    L2.part.add('oak', bx(-3.79, LOFT_Y, z - 0.022, -3.74, FL + 3.85, z + 0.022));
  }
  L2.part.add('oak',
    bx(-3.8, FL + 3.85, -ZI, -3.73, FL + 3.9, -2.52),
    bx(-3.8, FL + 3.85, -1.93, -3.73, FL + 3.9, ZI));
  // furnished Oak Mezzanine Loft (+3.20m): woven rug, low oak platform bed, linen mattress, terracotta throw, pillows, bedside tables, glowing lamp, and north eave bookshelf
  L2.part.add('white', bx(-6.85, LOFT_Y, -1.45, -4.35, LOFT_Y + 0.012, 1.45));
  L2.part.add('oak',
    bx(-7.15, LOFT_Y, -1.12, -5.05, LOFT_Y + 0.22, 1.12),
    bx(-7.18, LOFT_Y + 0.22, -1.12, -7.06, LOFT_Y + 0.78, 1.12));
  L2.part.add('cushion',
    rb(-7.04, LOFT_Y + 0.22, -1.0, -5.15, LOFT_Y + 0.42, 1.0, 0.06),
    rb(-7.00, LOFT_Y + 0.42, -0.88, -6.58, LOFT_Y + 0.62, -0.06, 0.06),
    rb(-7.00, LOFT_Y + 0.42, 0.06, -6.58, LOFT_Y + 0.62, 0.88, 0.06));
  L2.part.add('terracotta',
    rb(-5.68, LOFT_Y + 0.23, -1.02, -5.12, LOFT_Y + 0.45, 1.02, 0.05),
    rb(-6.62, LOFT_Y + 0.42, -0.35, -6.36, LOFT_Y + 0.58, 0.35, 0.05));
  // bedside tables & warm linen lamp
  L2.part.add('oak',
    bx(-7.12, LOFT_Y, 1.24, -6.68, LOFT_Y + 0.42, 1.68),
    bx(-7.12, LOFT_Y, -1.68, -6.68, LOFT_Y + 0.42, -1.24));
  L2.part.add('soft', cyl(0.055, 0.16, -6.9, LOFT_Y + 0.42, 1.46, 20));
  L2.part.add('shade', cyl(0.14, 0.19, -6.9, LOFT_Y + 0.56, 1.46, 28, 0.09));
  L2.part.add('book2', bx(-7.02, LOFT_Y + 0.42, -1.56, -6.76, LOFT_Y + 0.46, -1.34));
  // low built-in north eave loft bookshelf & study credenza
  L2.part.add('oak',
    bx(-6.95, LOFT_Y, -3.18, -4.15, LOFT_Y + 0.04, -2.76),
    bx(-6.95, LOFT_Y + 0.36, -3.18, -4.15, LOFT_Y + 0.39, -2.76),
    bx(-6.95, LOFT_Y + 0.68, -3.18, -4.15, LOFT_Y + 0.72, -2.76),
    bx(-6.95, LOFT_Y, -3.18, -6.91, LOFT_Y + 0.72, -2.76),
    bx(-5.55, LOFT_Y, -3.18, -5.51, LOFT_Y + 0.72, -2.76),
    bx(-4.19, LOFT_Y, -3.18, -4.15, LOFT_Y + 0.72, -2.76));
  L2.part.add('book1', bx(-6.82, LOFT_Y + 0.39, -3.12, -6.52, LOFT_Y + 0.64, -2.84), bx(-5.38, LOFT_Y + 0.04, -3.12, -5.08, LOFT_Y + 0.32, -2.84));
  L2.part.add('book2', bx(-6.48, LOFT_Y + 0.39, -3.12, -6.18, LOFT_Y + 0.66, -2.84), bx(-5.02, LOFT_Y + 0.39, -3.12, -4.74, LOFT_Y + 0.63, -2.84));
  L2.part.add('book3', bx(-6.14, LOFT_Y + 0.39, -3.12, -5.82, LOFT_Y + 0.61, -2.84), bx(-4.70, LOFT_Y + 0.39, -3.12, -4.42, LOFT_Y + 0.65, -2.84));
  L2.part.add('soft', cyl(0.075, 0.18, -4.65, LOFT_Y + 0.72, -2.96, 20));
  // timber loft ladder against the east face of the oak box
  for (const z of [-2.45, -2.0]) L2.part.add('oak', beam(V(-3.32, F, z), V(-3.69, FL + 2.92, z), 0.032, 0.055));
  for (let i = 1; i <= 8; i++) {
    const u = i / 9, ly = lerp(F, FL + 2.9, u), lx = lerp(-3.32, -3.69, u);
    L2.part.add('oak', bx(lx - 0.02, ly - 0.012, -2.45, lx + 0.02, ly + 0.012, -2.0));
  }
  L2.part.add('soft', cyl(0.075, 7.35 - (F + 0.94), -3.2, F + 0.94, -0.2, 28), cyl(0.12, 0.06, -3.2, 7.35, -0.2, 28));
  // kitchen: tall unit, base run, oak worktop, inset sink + mixer tap, open upper shelf, door joints
  L2.part.add('white', bx(-2.9, F, -ZI, -1.7, F + 2.3, -2.76), bx(-1.7, F, -ZI, 3.1, F + 0.86, -2.78));
  L2.part.add('oak', bx(-1.72, F + 0.86, -ZI, 3.12, F + 0.9, -2.74), bx(-1.4, F + 1.52, -ZI, 2.5, F + 1.555, -3.1));
  L2.part.add('steel', bx(0.32, F + 0.9, -3.24, 0.92, F + 0.908, -2.86), cyl(0.015, 0.28, 0.62, F + 0.9, -3.3, 12), bx(-0.95, F + 0.9, -3.24, -0.25, F + 0.906, -2.86));
  L2.part.add('soft', cyl(0.065, 0.16, -0.9, F + 1.555, -3.24, 20), cyl(0.055, 0.13, -0.72, F + 1.555, -3.24, 20), cyl(0.08, 0.2, 1.8, F + 1.555, -3.24, 24));
  L2.part.add('terracotta', cyl(0.06, 0.15, 1.52, F + 1.555, -3.24, 20));
  const joints = [];
  for (let x = -1.1; x < 3.1; x += 0.6) joints.push([x, F + 0.02, -2.779, x, F + 0.84, -2.779]);
  joints.push([-2.3, F + 0.02, -2.759, -2.3, F + 2.28, -2.759], [-2.9, F + 1.5, -2.759, -1.7, F + 1.5, -2.759]);
  // CLT panel assembly cassette joints along the 120mm perimeter walls
  for (const x of [-4.8, -2.4, 3.6]) {
    joints.push([x, FL, ZO + 0.002, x, FL + EH, ZO + 0.002], [x, FL, -ZO - 0.002, x, FL + EH, -ZO - 0.002]);
  }
  segs(L2.g, joints, hatchMat);

  // 03 Glazing (rides with the walls, pulled out sideways): the glass gable, the windows, a sliding door
  const L3 = layer('glazing', '03', 'Glazing', 'Triple glazed, oak frames', 2);
  const gE = L3.side(V(1, 0, 0)), gS = L3.side(V(0, 0, 1)), gN = L3.side(V(0, 0, -1)), gW = L3.side(V(-1, 0, 0));
  const mull = [-ZI, -1.9, -0.6, 0.6, 1.9, ZI];
  for (const z of mull) { const zz = clamp(z, -ZI + 0.04, ZI - 0.04); gE.part.add('frame', bx(XG - 0.06, F, zz - 0.04, XG + 0.06, UL(Math.abs(zz) + 0.04) - 0.02, zz + 0.04)); }
  gE.part.add('frame', bx(XG - 0.06, FL, -ZI, XG + 0.06, F + 0.06, ZI), bx(XG - 0.06, F + 2.26, -ZI, XG + 0.06, F + 2.34, ZI));
  for (const s of [-1, 1]) gE.part.add('frame', beam(V(XG, UL(ZI) - 0.04, s * ZI), V(XG, UL(0) - 0.04, 0), 0.12, 0.08));
  gE.part.add('frame', bx(XG - 0.06, F, -0.04, XG + 0.06, UL(0.04) - 0.02, 0.04));
  const gl = [[-ZI, 0.08], [ZI, 0.08], [ZI, UL(ZI) - FL - 0.06], [0, UL(0) - FL - 0.06], [-ZI, UL(ZI) - FL - 0.06]];
  gE.part.add('glass', panel(gl, [], 0.02).applyMatrix4(M.alongZ(XG + 0.01, FL)));
  const door = L3.side(V(1, 0, 0)); L3.door = door;
  door.part.add('frame', bx(XG + 0.07, F, -0.62, XG + 0.13, F + 2.26, -0.56), bx(XG + 0.07, F, 0.56, XG + 0.13, F + 2.26, 0.62),
    bx(XG + 0.07, F, -0.62, XG + 0.13, F + 0.08, 0.62), bx(XG + 0.07, F + 2.18, -0.62, XG + 0.13, F + 2.26, 0.62));
  door.part.add('steel', bx(XG + 0.13, F + 0.92, -0.53, XG + 0.15, F + 1.32, -0.50));
  door.part.add('glass', bx(XG + 0.09, F + 0.08, -0.56, XG + 0.11, F + 2.18, 0.56));
  // windows: a frame in the wall's thickness, projecting cill flashing, and pane
  function win4(part, axis, w0, w1, [a0, v0, a1, v1]) {
    const y0 = FL + v0, y1 = FL + v1, f = 0.06;
    const B = axis === 'x' ? (x0, yy0, x1, yy1, ww0, ww1) => bx(x0, yy0, ww0, x1, yy1, ww1) : (z0, yy0, z1, yy1, ww0, ww1) => bx(ww0, yy0, z0, ww1, yy1, z1);
    part.add('frame', B(a0, y0, a1, y0 + f, w0, w1), B(a0, y1 - f, a1, y1, w0, w1), B(a0, y0 + f, a0 + f, y1 - f, w0, w1), B(a1 - f, y0 + f, a1, y1 - f, w0, w1));
    const m = (w0 + w1) / 2; part.add('glass', B(a0 + f, y0 + f, a1 - f, y1 - f, m - 0.01, m + 0.01));
  }
  for (const o of SOUTH) win4(gS.part, 'x', ZI, ZO, o);
  for (const o of NORTH) win4(gN.part, 'x', -ZO, -ZI, o);
  for (const [a0, v0, a1, v1] of WEST) win4(gW.part, 'z', XW, XW + TH, [a0, v0, a1, v1]);
  gW.part.add('frame', ring(0.36, 0.42, TH).applyMatrix4(new THREE.Matrix4().makeTranslation(XW + TH, FL + ROUND.c[1], 0).multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2))));
  gW.part.add('glass', new THREE.CylinderGeometry(0.36, 0.36, 0.02, 40).rotateZ(Math.PI / 2).translate(XW + TH / 2, FL + ROUND.c[1], 0));

  // 04 Cladding: vertical larch boards on battens, pulled out from each wall
  const L4 = layer('cladding', '04', 'Cladding', 'Vertical larch boards, 22 × 140', 2);
  const cS = L4.side(V(0, 0, 1)), cN = L4.side(V(0, 0, -1)), cW = L4.side(V(-1, 0, 0));
  const BW = 0.14, BG = 0.026, c0 = FL - 0.25;
  function boardsAlong(holes, a0, a1, top, notch) {
    const out = [];
    for (let a = a0; a + BW <= a1 + 1e-6; a += BW + BG) {
      const b = a + BW; let spans = [[c0, top(a, b)]];
      if (notch && b > notch[0]) spans = [[FL + notch[1], top(a, b)]];
      for (const h of holes) {
        const [u0, v0, u1, v1] = h.r ? [h.c[0] - h.r, h.c[1] - h.r, h.c[0] + h.r, h.c[1] + h.r] : h;
        if (b > u0 && a < u1) spans = spans.flatMap(([s, e]) => [[s, Math.min(e, FL + v0 - 0.03)], [Math.max(s, FL + v1 + 0.03), e]]).filter(([s, e]) => e - s > 0.05);
      }
      for (const [s, e] of spans) out.push([a, b, s, e]);
    }
    return out;
  }
  const flat = () => FL + EH + PL;
  for (const [a, b, s, e] of boardsAlong(SOUTH, -7.452, XE, flat, [6.2, 2.4])) cS.part.add('clad', bx(a, s, ZO + 0.03, b, e, ZO + 0.052));
  for (const [a, b, s, e] of boardsAlong(NORTH, -7.452, XE, flat, [6.2, 2.4])) cN.part.add('clad', bx(a, s, -ZO - 0.052, b, e, -ZO - 0.03));
  const gTop = (a, b) => UL(Math.max(Math.abs(a), Math.abs(b)));
  for (const [a, b, s, e] of boardsAlong([...WEST, ROUND], -ZO - 0.052, ZO + 0.052, gTop)) cW.part.add('clad', bx(XW - 0.052, s, a, XW - 0.03, e, b));

  // 05 Roof structure and 06 Roof: built in the plane of each slope, then turned into place
  const slopeM = (side) => {
    const s = Math.sin(40 * D2R), c = CP;
    const m = new THREE.Matrix4();
    if (side > 0) m.makeBasis(V(1, 0, 0), V(0, c, s), V(0, -s, c)); else m.makeBasis(V(-1, 0, 0), V(0, c, -s), V(0, -s, -c));
    return m.setPosition(0, Y0, 0);
  };
  const MS = slopeM(1), MN = slopeM(-1);
  const sb = (side, x0, x1, w0, w1, t0, t1) => (side > 0 ? bx(x0, w0, t0, x1, w1, t1) : bx(-x1, w0, t0, -x0, w1, t1)).applyMatrix4(side > 0 ? MS : MN);
  const L5 = layer('rafters', '05', 'Roof structure', 'Glulam ridge, rafters at 600', 3);
  for (const side of [1, -1]) {
    for (let x = -XR + 0.04; x <= XR; x += 0.6) L5.part.add('rafter', sb(side, x - 0.04, x + 0.04, 0, 0.22, -0.22 * TP, T));
    L5.part.add('rafter', sb(side, -XR, XR, 0, 0.22, T - 0.03, T));
  }
  L5.part.add('rafter', bx(-XR, Y0 - 0.28, -0.08, XR, Y0, 0.08));
  for (const x of [-XR + 0.02, -3.7, 0.2, XG, XR - 0.02]) {
    L5.part.add('steel', bx(x - 0.05, Y0 - 0.29, -0.09, x + 0.05, Y0 + 0.01, 0.09));
  }
  // twin spun-linen pendant lamps suspended from the glulam ridge beam over the oak dining table
  for (const px of [2.35, 3.25]) {
    const py0 = F + 1.82, py1 = Y0 - 0.28;
    L5.part.add('steel', cyl(0.008, py1 - py0, px, py0, 0.22, 8));
    L5.part.add('shade', cyl(0.20, 0.16, px, py0 - 0.14, 0.22, 32, 0.07));
  }
  const L6 = layer('roof', '06', 'Roof', 'Insulated panels, standing-seam zinc', 4);
  for (const side of [1, -1]) {
    L6.part.add('white', sb(side, -XR, XR, 0.22, 0.42, -0.42 * TP, T));
    L6.part.add('seam', sb(side, -XR - 0.02, XR + 0.02, 0.42, 0.44, -0.44 * TP, T + 0.03));
    for (let x = -XR + 0.2; x < XR; x += 0.45) L6.part.add('seam', sb(side, x - 0.012, x + 0.012, 0.44, 0.48, -0.48 * TP, T + 0.03));
    // zinc half-round eave gutter along each roof edge
    L6.part.add('steel', sb(side, -XR - 0.02, XR + 0.02, 0.36, 0.43, T + 0.03, T + 0.1));
  }
  const YT = Y0 + 0.48 / CP;
  L6.part.add('seam', bx(-XR - 0.03, YT - 0.1, -0.11, XR + 0.03, YT + 0.04, 0.11));

  for (const L of layers) { L.part.build(); for (const s of L.subs) s.part.build(); }

  // ---- the stack: how far each level floats, and the order things land
  const LIFT = { 1: 2.3, 2: 4.9, 3: 10.2, 4: 15.6 };
  const PULL = { glazing: 3.4, cladding: 6.2 };
  const ORDER = ['floor', 'structure', 'glazing', 'cladding', 'rafters', 'roof'];
  const T0 = 0.05, STEP = 0.056, DUR = 0.068;
  const landAt = id => { const i = ORDER.indexOf(id); return [T0 + i * STEP, T0 + i * STEP + DUR]; };

  // ---- labels in a column right of the drawing, each on its layer's north-east corner
  const anchor = {
    floor: [L1.g, V(7.5, 0.15, -3.6)],
    structure: [L2.g, V(XE, FL + EH, ZO)],
    glazing: [gE.g, V(XG, UL(ZI) - 0.1, -ZI)],
    cladding: [cN.g, V(6.0, FL + 1.6, -ZO - 0.052)],
    rafters: [L5.g, V(XR, Y0 + 0.11 * CP - T * SP, -0.11 * SP - T * CP)],
    roof: [L6.g, V(XR, Y0 + 0.44 * CP - T * SP, -0.44 * SP - T * CP)],
  };
  const SHORT = { rafters: 'Rafters' };
  for (const L of layers) { const [obj, at] = anchor[L.id]; L.label = labels.add({ no: L.no, name: L.name, short: SHORT[L.id], sub: L.sub, obj, at, rank: 10 - Number(L.no) }); }

  // ---- dotted lines between the floating layers
  const dash = liveLine(dashMat);
  const corners = [[-7.4, -3.5], [7.4, -3.5], [7.4, 3.5], [-7.4, 3.5]];

  // ---- camera: the long lens over the whole stack (0.00..0.41), dolly-zoom to the east porch (0.41..0.62),
  // then a 4-stop interior walkthrough through Dining (0.71), Living & Hearth (0.80), Oak Mezzanine Loft (0.89), and Ridge Panorama (1.00)
  const keys = [
    { at: 0, t: [0.2, 10.2, 0], az: 45, el: 27, fov: 1.5, h: 33, sx: -0.02, ph: { h: 61, sx: -0.24, sy: -0.15 } },
    { at: 0.39, t: [0.2, 10.2, 0], az: 45, el: 27, fov: 1.5, h: 33, sx: -0.02, ph: { h: 61, sx: -0.24, sy: -0.15 } },
    { at: 0.48, t: [0.4, 3.2, 0], az: 45, el: 27, fov: 1.5, h: 15, sx: 0.2, ph: { h: 40, sx: 0, sy: -0.3 } },
    { at: 0.52, t: [0.6, 3.0, 0], az: 42, el: 24, fov: 1.6, h: 14, sx: 0.16, ph: { h: 38, sx: 0, sy: -0.24 } },
    // Porch arrival (dolly-zoom lands on east deck)
    eyeKey(0.62, [13.8, 1.62, 0.15], [XG, 1.62, 0], 46, { sy: -0.18, ph: eyeKey(0.62, [14.5, 1.62, 0.15], [XG - 1.5, 1.62, 0], 64, { sy: -0.12 }) }),
    // Stop 1: Threshold & Oak Trestle Dining Table
    eyeKey(0.71, [4.75, 1.60, 0.35], [0.2, 1.42, -0.65], 54, { sy: -0.10, ph: eyeKey(0.71, [4.85, 1.60, 0.35], [0.2, 1.42, -0.65], 70, { sy: -0.08 }) }),
    // Waypoint into north kitchen aisle
    eyeKey(0.75, [3.1, 1.58, -1.50], [-1.6, 1.32, 0.85], 55, { sy: -0.08, ph: eyeKey(0.75, [3.1, 1.58, -1.50], [-1.6, 1.32, 0.85], 72, { sy: -0.06 }) }),
    // Stop 2: Kitchen, Sunlit Living Lounge & Glowing Wood Stove
    eyeKey(0.80, [0.55, 1.50, -1.25], [-2.85, 1.15, 1.35], 56, { sy: -0.06, ph: eyeKey(0.80, [0.55, 1.50, -1.25], [-2.85, 1.15, 1.35], 72, { sy: -0.05 }) }),
    // Ladder crest waypoint passing through the balustrade opening
    eyeKey(0.85, [-3.45, 4.22, -2.18], [-6.2, 3.65, -0.2], 56, { sy: -0.05, ph: eyeKey(0.85, [-3.45, 4.22, -2.18], [-6.2, 3.65, -0.2], 72, { sy: -0.04 }) }),
    // Stop 3: Inside the furnished Oak Mezzanine Loft (+3.20m), unobstructed view of platform bed & west oculus
    eyeKey(0.89, [-4.05, 4.25, -1.65], [-6.55, 3.60, 0.15], 56, { sy: -0.05, ph: eyeKey(0.89, [-4.05, 4.25, -1.65], [-6.55, 3.60, 0.15], 72, { sy: -0.04 }) }),
    // Stop 4: Pivot on the loft landing looking back east across the 6.6m-high Long Room & glazed gable
    eyeKey(0.98, [-3.35, 4.18, -1.55], [5.8, 1.85, 0.25], 58, { sy: -0.06, ph: eyeKey(0.98, [-3.35, 4.18, -1.55], [5.8, 1.85, 0.25], 74, { sy: -0.05 }) }),
    eyeKey(1.0, [-3.35, 4.18, -1.55], [5.8, 1.85, 0.25], 58, { sy: -0.06, ph: eyeKey(1.0, [-3.35, 4.18, -1.55], [5.8, 1.85, 0.25], 74, { sy: -0.05 }) }),
  ];
  keys[4].easeFn = t => ease(t);

  const STOPS = [
    { id: 'porch', a: 0.53, b: 0.66, lv: 'STAGE 00 // SITE ASSEMBLY COMPLETE', t: 'CLOSED ON SITE · DAY NINE', m: 'Six layers  ·  one crane day  ·  no wet trades' },
    { id: 'dining', a: 0.67, b: 0.75, lv: 'STOP 01 // EAST THRESHOLD · +0.33M', t: 'THE DINING TABLE', m: 'Glazed east gable  ·  oak trestle table  ·  spun pendants' },
    { id: 'living', a: 0.76, b: 0.84, lv: 'STOP 02 // LIVING & HEARTH · +0.33M', t: 'KITCHEN & LOUNGE', m: 'South window light  ·  linen sofa  ·  cast-iron wood stove' },
    { id: 'loft', a: 0.85, b: 0.93, lv: 'STOP 03 // MEZZANINE LOFT · +3.20M', t: 'THE OAK LOFT', m: 'Platform bed  ·  west oculus window  ·  timber ladder' },
    { id: 'ridge', a: 0.94, b: 1.01, lv: 'STOP 04 // CATHEDRAL VOLUME · 96 M²', t: 'THE LONG ROOM', m: '6.6 × 9.4 m  ·  ridge +6.34 m  ·  CLT, larch & zinc' },
  ];

  function update(p) {
    const land = {};
    for (const id of ORDER) { const [a, b] = landAt(id); land[id] = ease(win(p, a, b)); }
    const lv = { 1: 1 - land.floor, 2: 1 - land.structure, 3: 1 - land.rafters, 4: 1 - land.roof };
    const lift = {}; let acc = 0, prev = 0;
    for (const k of [1, 2, 3, 4]) { acc += (LIFT[k] - prev) * lv[k]; prev = LIFT[k]; lift[k] = acc; }
    for (const L of layers) {
      L.g.position.y = lift[L.level];
      const pull = PULL[L.id] ? PULL[L.id] * (1 - land[L.id]) : 0;
      for (const s of L.subs) s.g.position.copy(s.dir).multiplyScalar(pull);
      // the layer in the air while it lands is drawn in the accent colour
      const [a, b] = landAt(L.id);
      const cur = ORDER.reduce((c, id) => p >= landAt(id)[0] - 0.006 ? id : c, null);
      const on = L.id === cur && p < b + 0.012;
      for (const m of L.lines) m.color.set(on ? ACCENT : INK);
      L.label.on = on;
      L.label.op = (p > b + 0.012 ? 0.5 : 1) * (1 - win(p, 0.40, 0.45));
      L.label.dy = 0;
    }
    // the sliding door opens as the camera reaches the porch
    L3.door.g.position.z = -1.25 * ease(win(p, 0.54, 0.64));

    // dotted lines: plan to floor, floor to walls, walls to rafters, rafters to roof, and the sideways pulls
    const ls = [];
    const y1 = lift[1], y2 = lift[2], y3 = lift[3], y4 = lift[4];
    for (const [x, z] of corners) {
      if (y1 > 0.05) ls.push([x * 7.55 / 7.4, -0.7 + y1, z * 3.6 / 3.5, x * 7.55 / 7.4, 0, z * 3.6 / 3.5]);
      if (y2 - y1 > 0.05) ls.push([x, FL + y2, z, x, FL + y1, z]);
      if (y3 - y2 > 0.05) ls.push([x, FL + EH + PL + y3, z, x, FL + EH + PL + y2, z]);
      const ez = Math.sign(z) * (T * CP), ey = Y0 - T * Math.sin(40 * D2R);
      if (y4 - y3 > 0.05) ls.push([Math.sign(x) * XR, ey + 0.22 * CP + y4, ez + Math.sign(z) * 0.22 * Math.sin(40 * D2R), Math.sign(x) * XR, ey + 0.22 * CP + y3, ez + Math.sign(z) * 0.22 * Math.sin(40 * D2R)]);
    }
    const gp = PULL.glazing * (1 - land.glazing), cp = PULL.cladding * (1 - land.cladding);
    if (gp > 0.05) for (const z of [-ZI, ZI]) for (const y of [FL, UL(ZI)]) ls.push([XG + gp, y + y2, z, XE, y + y2, z]);
    if (cp > 0.05) for (const x of [-7.45, XE]) for (const y of [c0, FL + EH + PL]) { ls.push([x, y + y2, ZO + 0.05 + cp, x, y + y2, ZO]); ls.push([x, y + y2, -ZO - 0.05 - cp, x, y + y2, -ZO]); }
    dash.set(ls);

    const landed = ORDER.filter(id => land[id] > 0.98).length;
    let cap = '', capOp = 0, activeStop = p < 0.52 ? 'axo' : 'porch';
    for (const s of STOPS) {
      const fadeOut = s.id === 'ridge' ? 1 : (1 - win(p, s.b - 0.025, s.b));
      const v = win(p, s.a, s.a + 0.025) * fadeOut;
      if (v > capOp) {
        capOp = v;
        cap = `<span class="lv">${s.lv}</span><span class="t">${s.t}</span><span class="m">${s.m}</span>`;
      }
      if (p >= s.a - 0.01) activeStop = s.id;
    }

    return {
      hero: 1 - clamp((p - 0.43) / 0.05),
      counter: p < 0.54 ? `Layer <b>${String(Math.min(6, landed + (p > T0 ? 1 : 0))).padStart(2, '0')}</b> / 06` : '',
      hint: p < 0.42 ? 'Scroll to build it' : p < 0.65 ? 'Scroll to walk inside' : p < 0.95 ? 'Scroll through the house' : '',
      cap,
      capOp,
      stop: activeStop,
    };
  }

  return {
    update, keys, R: 70,
    colX: () => ctx.phone ? ctx.W - 100 : ctx.W * 0.725,
    draw: { dir: [0, 1, 0], radial: 0, min: -1, max: 23, soft: 1.4 },
    radar: {
      scale: '1:100',
      viewBox: '-8.6 -4.6 17.8 9.2',
      plan: 'M-7.4 -3.5 H7.4 V3.5 H-7.4 Z M-3.7 -3.5 V3.5 M5.9 -3.5 V3.5 M-7.4 0 H-3.7 M-2.9 -3.4 H3.1 V-2.75 H-2.9 Z M1.7 -0.25 H3.9 V0.75 H1.7 Z M-2.9 1.0 H-0.6 V1.9 H-2.9 Z',
      strokeW: 0.22, dotR: 0.65, coneW: 0.18, coneLen: 3.2,
      clampX: [-7.4, 7.6], clampZ: [-3.4, 3.4],
      axoDot: [6.8, 2.4], axoAng: -2.35,
      zones: [
        { stop: 'loft', p: 0.89, tag: '03 // OAK LOFT +3.20M', x: -7.4, y: -3.5, w: 3.7, h: 7.0 },
        { stop: 'living', p: 0.80, tag: '02 // LIVING & HEARTH', x: -3.7, y: -3.5, w: 5.2, h: 7.0 },
        { stop: 'dining', p: 0.71, tag: '01 // DINING TABLE', x: 1.5, y: -3.5, w: 4.4, h: 7.0 },
        { stop: 'porch', p: 0.62, tag: 'PORCH // +0.33M', x: 5.9, y: -3.5, w: 1.9, h: 7.0 },
      ],
      stops: [
        { stop: 'axo', p: 0.18, tag: 'AXO STACK // 01-06', label: 'AXO' },
        { stop: 'porch', p: 0.62, tag: 'PORCH // +0.33M', label: 'PORCH' },
        { stop: 'dining', p: 0.71, tag: '01 // DINING TABLE', label: 'DINING' },
        { stop: 'living', p: 0.80, tag: '02 // LIVING & HEARTH', label: 'LIVING' },
        { stop: 'loft', p: 0.89, tag: '03 // OAK LOFT +3.20M', label: 'LOFT' },
        { stop: 'ridge', p: 0.98, tag: '04 // THE LONG ROOM', label: 'RIDGE' },
      ],
    },
    chrome: {
      title: 'A · The Board',
      dwg: 'AXO.04',
      brand: 'Purlin', brandSub: 'Timber houses',
      nav: 'Houses     Workshop     Journal', cta: 'Start a house',
      kicker: 'Axonometric · Sheet A-04 · 1:100',
      loader: 'Plotting sheet A-04',
      h1: 'How a house<br>goes <em>together.</em>',
      lede: 'Six layers, made in our workshop and closed on site in nine days. Scroll to assemble the house, then walk inside through the Long Room and up to the oak loft.',
      spec: [['House', 'The Long Room'], ['Area', '96 m² + Loft'], ['Frame', 'CLT, larch, zinc']],
      hint: 'Scroll to build it',
    },
  };
}

// ---- the ground floor plan, drawn once into a canvas
function drawPlan() {
  const S = 100, X = x => (x + 12) * S, Y = z => (z + 8) * S;
  return canvasTex(2400, 1600, (g) => {
    g.fillStyle = '#f2efe7'; g.fillRect(0, 0, 2400, 1600);
    g.strokeStyle = INK; g.lineWidth = 2.2; g.strokeRect(36, 36, 2328, 1528);
    g.lineWidth = 1; g.strokeRect(46, 46, 2308, 1508);
    const line = (x0, z0, x1, z1, w = 2, dash = []) => { g.setLineDash(dash); g.lineWidth = w; g.beginPath(); g.moveTo(X(x0), Y(z0)); g.lineTo(X(x1), Y(z1)); g.stroke(); g.setLineDash([]); };
    const box = (x0, z0, x1, z1, w = 2, fill) => { if (fill) { g.fillStyle = fill; g.fillRect(X(x0), Y(z0), X(x1) - X(x0), Y(z1) - Y(z0)); } g.lineWidth = w; g.strokeRect(X(x0), Y(z0), X(x1) - X(x0), Y(z1) - Y(z0)); };
    g.strokeStyle = INK; g.fillStyle = INK;
    // grid with bubbles
    g.font = '500 26px "IBM Plex Mono"'; g.textAlign = 'center'; g.textBaseline = 'middle';
    [[-7.4, 'A'], [-3.7, 'B'], [XG, 'C'], [7.4, 'D']].forEach(([x, n]) => { line(x, -6.6, x, 6.0, 1.2, [24, 8, 4, 8]); g.beginPath(); g.arc(X(x), Y(-6.95), 24, 0, 7); g.stroke(); g.fillText(n, X(x), Y(-6.95)); });
    [[-3.5, '1'], [0, '2'], [3.5, '3']].forEach(([z, n]) => { line(-10.2, z, 9.6, z, 1.2, [24, 8, 4, 8]); g.beginPath(); g.arc(X(-10.55), Y(z), 24, 0, 7); g.stroke(); g.fillText(n, X(-10.55), Y(z)); });
    // roof line
    line(-XR, -4.05, XR, -4.05, 1.5, [14, 10]); line(-XR, 4.05, XR, 4.05, 1.5, [14, 10]); line(-XR, -4.05, -XR, 4.05, 1.5, [14, 10]); line(XR, -4.05, XR, 4.05, 1.5, [14, 10]);
    // walls in poché, openings left white
    g.fillStyle = INK;
    const wallX = (z0, z1, holes) => { let a = -7.45; const cuts = [...holes.map(h => [h[0], h[2]]), [6.2, XE]].sort((p, q) => p[0] - q[0]); for (const [u0, u1] of cuts) { g.fillRect(X(a), Y(z0), X(u0) - X(a), Y(z1) - Y(z0)); a = u1; } };
    wallX(ZI, ZO + 0.05, SOUTH); wallX(-ZO - 0.05, -ZI, NORTH);
    let a = -ZO - 0.05; for (const [u0, , u1] of [...WEST].sort((p, q) => p[0] - q[0])) { g.fillRect(X(-7.45), Y(a), X(-7.28) - X(-7.45), Y(u0) - Y(a)); a = u1; } g.fillRect(X(-7.45), Y(a), X(-7.28) - X(-7.45), Y(ZO + 0.05) - Y(a));
    // glazing as thin double lines
    for (const [u0, , u1] of SOUTH) { line(u0, ZO - 0.03, u1, ZO - 0.03, 1.5); line(u0, ZI + 0.03, u1, ZI + 0.03, 1.5); }
    for (const [u0, , u1] of NORTH) { line(u0, -ZO + 0.03, u1, -ZO + 0.03, 1.5); line(u0, -ZI - 0.03, u1, -ZI - 0.03, 1.5); }
    line(XG - 0.04, -ZI, XG - 0.04, ZI, 1.5); line(XG + 0.04, -ZI, XG + 0.04, ZI, 1.5); line(XG + 0.1, -0.62, XG + 0.1, 0.62, 3);
    // the box, its doors and fittings
    box(-3.82, -ZI, -3.7, ZI, 1, INK); g.fillStyle = '#f2efe7'; g.fillRect(X(-3.83), Y(-1.6), 14, Y(-0.7) - Y(-1.6)); g.fillRect(X(-3.83), Y(0.7), 14, Y(1.5) - Y(0.7)); g.fillStyle = INK;
    box(-7.28, -0.05, -3.82, 0.05, 1, INK);
    g.lineWidth = 1.2; g.beginPath(); g.arc(X(-3.7), Y(-0.7), 0.9 * S, Math.PI, 1.5 * Math.PI); g.stroke(); line(-3.7, -0.7, -4.6, -0.7, 1.5);
    g.beginPath(); g.arc(X(-3.7), Y(1.5), 0.8 * S, 0.5 * Math.PI, Math.PI); g.stroke(); line(-3.7, 1.5, -4.5, 1.5, 1.5);
    box(-7.1, -3.2, -5.2, -1.2, 1.5); box(-7.1, -3.2, -6.6, -2.2, 1); box(-7.1, -2.15, -6.6, -1.25, 1);
    box(-7.1, 0.4, -6.4, 2.2, 1.5); box(-5.6, 2.6, -4.9, 3.2, 1.5); g.beginPath(); g.ellipse(X(-4.4), Y(0.55), 26, 20, 0, 0, 7); g.stroke();
    // kitchen, table, sofa, rug
    box(-2.9, -ZI, -1.7, -2.76, 1.5); box(-1.7, -ZI, 3.1, -2.76, 1.5); g.beginPath(); g.ellipse(X(0.6), Y(-3.07), 24, 16, 0, 0, 7); g.stroke();
    box(1.8, -0.2, 3.9, 0.75, 1.5); box(1.9, 0.95, 3.8, 1.28, 1); for (const x of [2.2, 2.85, 3.5]) box(x - 0.21, -0.8, x + 0.21, -0.36, 1);
    box(-2.9, 1.0, -0.6, 1.9, 1.5); box(-2.9, 1.0, -0.6, 1.22, 1); line(-3.2, 0.75, -0.3, 0.75, 1, [8, 6]); line(-3.2, 3.0, -0.3, 3.0, 1, [8, 6]);
    g.beginPath(); g.arc(X(-1.75), Y(2.4), 40, 0, 7); g.stroke();
    // porch boards and steps
    for (let z = -ZI + 0.14; z < ZI; z += 0.14) line(XG + 0.06, z, XE, z, 0.8);
    // room names & elevation datums
    g.fillStyle = INK; g.font = '700 32px "Chakra Petch"';
    g.fillText('LIVING', X(-1.6), Y(-0.5)); g.fillText('KITCHEN', X(1.3), Y(-1.9)); g.fillText('PORCH', X(6.65), Y(-1.6));
    g.font = '600 26px "Chakra Petch"'; g.fillText('BED', X(-5.6), Y(-1.9)); g.fillText('BATH', X(-5.8), Y(1.6));
    g.font = '400 20px "IBM Plex Mono"'; g.fillText('62 M² · FFL +0.33', X(-1.6), Y(-0.15));
    g.fillText('DECK +0.30', X(6.65), Y(-1.25));
    // dimensions along the south side
    const dim = (x0, x1, z, t) => { line(x0, z, x1, z, 1.2); for (const x of [x0, x1]) line(x - 0.12, z + 0.12, x + 0.12, z - 0.12, 2); g.font = '400 22px "IBM Plex Mono"'; g.fillText(t, X((x0 + x1) / 2), Y(z) - 18); };
    dim(-7.45, XE, 5.0, '14 850'); dim(-7.45, -3.7, 5.7, '3 750'); dim(-3.7, XG, 5.7, '9 600'); dim(XG, XE, 5.7, '1 500');
    g.save(); g.translate(X(9.1), Y(0)); g.rotate(-Math.PI / 2); g.font = '400 22px "IBM Plex Mono"'; g.fillText('7 100', 0, -18); g.restore();
    line(9.1, -3.55, 9.1, 3.55, 1.2);
    // north arrow, scale bar, and title block
    g.beginPath(); g.arc(X(10.3), Y(-6.4), 34, 0, 7); g.stroke(); g.beginPath(); g.moveTo(X(10.3), Y(-6.4) - 44); g.lineTo(X(10.3) - 12, Y(-6.4) + 10); g.lineTo(X(10.3) + 12, Y(-6.4) + 10); g.closePath(); g.fill();
    g.textAlign = 'left'; g.font = '700 30px "Chakra Petch"'; g.fillText('GROUND FLOOR', X(-10.9), Y(6.95)); g.font = '400 20px "IBM Plex Mono"'; g.fillText('THE LONG ROOM · 1:100 · DWG A-01', X(-10.9), Y(7.3));
    for (let i = 0; i < 5; i++) {
      g.fillStyle = i % 2 === 0 ? INK : '#f2efe7';
      g.fillRect(X(6.5 + i * 0.8), Y(7.02), 0.8 * S, 10);
      g.strokeRect(X(6.5 + i * 0.8), Y(7.02), 0.8 * S, 10);
    }
    g.fillStyle = INK; g.font = '500 18px "IBM Plex Mono"'; g.fillText('0', X(6.5), Y(7.32)); g.fillText('5 M', X(10.2), Y(7.32));
  });
}

