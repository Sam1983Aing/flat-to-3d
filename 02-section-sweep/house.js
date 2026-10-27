// The house, once, as data. Every look of the page is drawn from this list: the ink drawing and the lit material.
// Section runs along x: north and the hill on the left (x < 4), the view and the lower garden on the right.
// y up, z across the house (it spans z -8 to 4). Levels: garden -3.20, entrance 0.00, study 3.20, roof 6.40.
// The section cuts at z = 0. Everything behind the cut is the "behind" part, everything in front of it the "front"
// part (shown only while the camera is inside), and the scale figures are their own part.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

let seed = 11;
export const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// what the drawing knows about a surface (written into the depth pass, see draw.js)
// paper 1, poche 2 + 0.9 * rank (rank orders the fill on load), earth cut 4, a scale figure 5, a tree or a plant 6
// (figures, trees and plants stay drawn in the lit house: the building turns real, the life in it stays drawn)
export const ID = { paper: 1, poche: 2, earth: 4, person: 5, life: 6 };
export const CUT = 0;

// ---------------------------------------------------------------- the structure (from the overview sketch)
// v2: the lower flight of the scissor stair moved beside the upper one (z -6.4 to -5.2). In the sketch both flights
// sat in the same strip and the lower one had 1.3 m of headroom, so nobody could have walked down it.
function structure(box) {
  const carve = (a0, a1, b0, b1, holes) => {
    const cuts = [...new Set([a0, a1, ...holes.flatMap((h) => [h[0], h[1]])].filter((v) => v >= a0 && v <= a1))].sort((p, q) => p - q);
    const out = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const p0 = cuts[i], p1 = cuts[i + 1], mid = (p0 + p1) / 2;
      const hs = holes.filter((h) => h[0] < mid && h[1] > mid).map((h) => [h[2], h[3]]).sort((p, q) => p[0] - q[0]);
      let y = b0;
      for (const [q0, q1] of hs) { if (q0 > y) out.push([p0, p1, y, q0]); y = Math.max(y, q1); }
      if (y < b1) out.push([p0, p1, y, b1]);
    }
    return out;
  };
  // a wall: axis 'x' is thick along x and spans (z, y); axis 'z' is thick along z and spans (x, y)
  const wall = (axis, t0, t1, a0, a1, b0, b1, holes, m, inner = 'plaster') => {
    for (const [p0, p1, q0, q1] of carve(a0, a1, b0, b1, holes)) {
      if (axis === 'x') box(t0, q0, p0, t1, q1, p1, { all: m, px: t0 < 10 ? inner : m, nx: t0 < 10 ? m : inner });
      else box(p0, q0, t0, p1, q1, t1, { all: m, pz: t0 < 0 ? inner : m, nz: t0 < 0 ? m : inner });
    }
    for (const h of holes) {
      const tm = (t0 + t1) / 2, f = 0.05;
      if (axis === 'x') {
        if (h[3] - h[2] > 1.9 && h[2] <= b0 + 0.01) continue; // doors stay open (a hole from the floor up)
        box(tm - 0.04, h[2], h[0], tm + 0.04, h[2] + f, h[1], 'steel', 'frame'); box(tm - 0.04, h[3] - f, h[0], tm + 0.04, h[3], h[1], 'steel', 'frame');
        box(tm - 0.04, h[2], h[0], tm + 0.04, h[3], h[0] + f, 'steel', 'frame'); box(tm - 0.04, h[2], h[1] - f, tm + 0.04, h[3], h[1], 'steel', 'frame');
        box(tm - 0.01, h[2], h[0], tm + 0.01, h[3], h[1], 'glass', 'glass');
      } else {
        if (h[2] <= b0 + 0.01 && h[3] - h[2] > 1.9) continue;
        box(h[0], h[2], tm - 0.04, h[1], h[2] + f, tm + 0.04, 'steel', 'frame'); box(h[0], h[3] - f, tm - 0.04, h[1], h[3], tm + 0.04, 'steel', 'frame');
        box(h[0], h[2], tm - 0.04, h[0] + f, h[3], tm + 0.04, 'steel', 'frame'); box(h[1] - f, h[2], tm - 0.04, h[1], h[3], tm + 0.04, 'steel', 'frame');
        if (h[1] - h[0] > 3) { const m = (h[0] + h[1]) / 2; box(m - 0.03, h[2], tm - 0.04, m + 0.03, h[3], tm + 0.04, 'steel', 'frame'); }
        box(h[0], h[2], tm - 0.01, h[1], h[3], tm + 0.01, 'glass', 'glass');
      }
    }
  };
  const SL = { all: 'conc', py: 'floorL', ny: 'ceiling' }, SG = { all: 'conc', py: 'oak', ny: 'ceiling' }, SB = { all: 'conc', py: 'stoneFloor', ny: 'ceiling' };
  // footings
  box(3.1, -4.3, -8.4, 4.6, -3.6, 4.4, 'conc');
  box(17.7, -4.3, -8.4, 18.9, -3.6, 4.4, 'conc');
  box(4.6, -4.3, -8.4, 17.7, -3.6, -7.4, 'conc');
  box(4.6, -4.3, 3.4, 17.7, -3.6, 4.4, 'conc');
  // lower slab: stone in the bath, oak in the bedroom
  box(4.0, -3.6, -7.7, 11.0, -3.2, 3.7, SB);
  box(11.0, -3.6, -7.7, 18.3, -3.2, 3.7, SL);
  // ground slab, with the hole for the lower flight at x 5.5 to 10.3, z -6.4 to -5.2
  box(4.0, -0.35, -7.7, 18.3, 0, -6.4, SG);
  box(4.0, -0.35, -6.4, 5.5, 0, -5.2, SG);
  box(10.3, -0.35, -6.4, 18.3, 0, -5.2, SG);
  box(4.0, -0.35, -5.2, 18.3, 0, 3.7, SG);
  box(18.3, -0.35, -8.0, 22.5, 0, 1.5, { all: 'conc', py: 'pave' });
  // mezzanine and third-floor upper lounge (extended to x 15.1, leaving x 15.1..18.24 as the double-height light well)
  box(4.0, 2.85, -6.4, 15.1, 3.2, 3.7, SG);
  box(4.0, 2.85, -7.7, 5.5, 3.2, -6.4, SG);
  box(10.3, 2.85, -7.7, 15.1, 3.2, -6.4, SG);
  const RF = { all: 'conc', py: 'gravel', ny: 'ceiling' };
  box(4.0, 7.6, -8.0, 15.4, 8.0, 4.0, RF);
  box(15.1, 6.4, -8.0, 19.6, 6.8, 4.0, RF);
  box(4.0, 6.4, -8.0, 15.1, 7.6, -7.7, { all: 'conc', pz: 'plaster' });
  box(4.0, 6.4, 3.7, 15.1, 7.6, 4.0, { all: 'conc', nz: 'plaster' });
  // north wall: the entrance door from the upper court, a window for the study
  wall('x', 3.7, 4.0, -8, 4, -3.6, 0, [], 'conc');
  wall('x', 3.7, 4.0, -8, 4, 0, 8.0, [[-1.2, 1.2, 0, 2.4], [-5.6, -2.4, 4.3, 5.9]], 'conc');
  // back and front walls
  wall('z', -8.0, -7.7, 4.0, 18.3, -3.6, -0.35, [[5.0, 7.0, -1.7, -0.9]], 'conc');
  wall('z', -8.0, -7.7, 4.0, 18.3, -0.35, 6.4, [[12.4, 14.6, 4.2, 5.7], [15.5, 17.5, 3.9, 5.7], [4.6, 9.8, 4.9, 5.8]], 'conc');
  wall('z', 3.7, 4.0, 4.0, 18.3, -3.6, -0.35, [[5.0, 7.0, -1.7, -0.9]], 'conc');
  wall('z', 3.7, 4.0, 4.0, 18.3, -0.35, 6.4, [[12.6, 17.4, 0.8, 2.5], [5.0, 9.4, 0.9, 2.2]], 'conc');
  // lower level, between the bath and the bedroom, with its door
  wall('x', 11.0, 11.15, -7.7, 3.7, -3.2, -0.35, [[-3.1, -1.3, -3.2, -0.95]], 'plaster', 'plaster');
  // third floor partition between the study and the new upper lounge: solid closed wall with a 1.0m doorway
  wall('x', 10.35, 10.5, -7.7, 3.7, 3.2, 7.6, [[-5.0, -4.0, 3.2, 5.4]], 'plaster', 'plaster');
  // south glass, both levels, the clerestory, the balustrades
  const glassRun = (x, y0, y1, z0, z1, step) => {
    box(x - 0.02, y0, z0, x + 0.02, y1, z1, 'glass', 'glass');
    for (let z = z0; z <= z1 + 1e-3; z += step) box(x - 0.06, y0, Math.max(z0, z - 0.04), x + 0.06, y1, Math.min(z1, z + 0.04), 'steel', 'frame');
    box(x - 0.06, y0, z0, x + 0.06, y0 + 0.06, z1, 'steel', 'frame'); box(x - 0.06, y1 - 0.06, z0, x + 0.06, y1, z1, 'steel', 'frame');
  };
  glassRun(18.24, -3.2, -0.35, -7.7, 3.7, 1.9);
  glassRun(18.24, 0, 6.4, -7.7, 3.7, 1.9);
  box(18.18, 3.12, -7.7, 18.3, 3.2, 3.7, 'steel', 'frame');
  glassRun(15.1, 6.8, 7.6, -7.7, 3.7, 1.9);
  // balustrades with bottom steel shoe channels and end posts so glass reads clearly
  box(22.42, 0, -8.0, 22.46, 1.05, 1.5, 'glass', 'glass'); box(22.38, 1.05, -8.0, 22.5, 1.1, 1.5, 'steel', 'frame'); box(22.39, 0, -8.0, 22.49, 0.06, 1.5, 'steel', 'frame');
  box(15.06, 3.2, -7.7, 15.1, 4.25, 3.7, 'glass', 'glass'); box(15.02, 4.25, -7.7, 15.14, 4.3, 3.7, 'steel', 'frame'); box(15.03, 3.2, -7.7, 15.13, 3.26, 3.7, 'steel', 'frame');
  // guards round the stair holes
  box(5.5, 0, -5.22, 10.3, 1.0, -5.18, 'glass', 'glass'); box(5.5, 1.0, -5.24, 10.3, 1.05, -5.16, 'steel', 'frame'); box(5.5, 0, -5.24, 10.3, 0.05, -5.16, 'steel', 'frame');
  box(5.5, 3.2, -6.42, 10.3, 4.25, -6.38, 'glass', 'glass'); box(5.5, 4.25, -6.44, 10.3, 4.3, -6.36, 'steel', 'frame'); box(5.5, 3.2, -6.44, 10.3, 3.25, -6.36, 'steel', 'frame');
  // the scissor stair: the upper flight rises west along the back wall, the lower flight rises east beside it
  const n = 18, run = 4.8 / n, rise = 3.2 / n, ST = { all: 'conc', py: 'oak' };
  for (let i = 0; i < n; i++) {
    const t = (i + 1) * rise;
    box(10.3 - (i + 1) * run, Math.max(0, t - 0.45), -7.7, 10.3 - i * run, t, -6.5, ST, 'stair');
    box(5.5 + i * run, Math.max(-3.2, -3.2 + t - 0.45), -6.4, 5.5 + (i + 1) * run, -3.2 + t, -5.2, ST, 'stair');
  }
  // paving
  box(-7, 0, -6.5, 3.7, 0.03, 3.5, 'pave', 'land');
  box(18.3, -3.2, -7.7, 24.5, -3.17, 3.7, 'pave', 'land');
}

// ---------------------------------------------------------------- the staging
// Furniture as rounded boxes and lathes, placed room by room. Pieces carry a material key from look.js.
function staging(box, item, life) {
  const rb = (x0, y0, z0, x1, y1, z1, r, m) => { const g = new RoundedBoxGeometry(x1 - x0, y1 - y0, z1 - z0, 3, Math.min(r, (x1 - x0) / 2.1, (y1 - y0) / 2.1, (z1 - z0) / 2.1)); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); item(g, m); };
  const cyl = (x, y, z, r0, r1, h, m, seg = 24, open = false) => { const g = new THREE.CylinderGeometry(r0, r1, h, seg, 1, open); g.translate(x, y + h / 2, z); item(g, m); };
  const sph = (x, y, z, r, m) => { const g = new THREE.SphereGeometry(r, 24, 16); g.translate(x, y, z); item(g, m); };
  const F = (x0, y0, z0, x1, y1, z1, m) => box(x0, y0, z0, x1, y1, z1, m, 'furn');
  const chair = (x, z, face, y = 0) => { // a wooden dining chair, face = +1 looks +z, -1 looks -z
    const s = face;
    rb(x - 0.22, y + 0.43, z - 0.21, x + 0.22, y + 0.47, z + 0.21, 0.015, 'oakFurn');
    rb(x - 0.22, y + 0.47, z - s * 0.21 - 0.02, x + 0.22, y + 0.88, z - s * 0.21 + 0.02, 0.015, 'oakFurn');
    for (const [dx, dz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) F(x + dx - 0.018, y, z + dz - 0.018, x + dx + 0.018, y + 0.43, z + dz + 0.018, 'oakFurn');
  };
  const lamp = (x, y, z, h, r) => { cyl(x, y, z, 0.16, 0.18, 0.02, 'blackSteel'); cyl(x, y, z, 0.012, 0.012, h, 'blackSteel', 8); cyl(x, y + h, z, r * 0.62, r, r * 1.1, 'shade', 28, true); };
  const plant = (x, y, z, h, s, potR = 0.24) => {
    cyl(x, y, z, potR, potR * 0.8, potR * 2, 'terracotta');
    life(canopy([[0, 0, 0, s, h / 2, s, Math.round(120 * h)]], 0.06, 0.13), 'leaf', [x, y + potR * 2 + h / 2 + 0.05, z]);
    life((() => { const g = new THREE.CylinderGeometry(0.02, 0.025, h * 0.5, 6); g.translate(x, y + potR * 2 + h * 0.25, z); return g; })(), 'bark');
  };

  // ---- living room, the double height space (x 11 to 18.24)
  rb(12.3, 0, -6.95, 17.5, 0.025, -2.55, 0.008, 'rug');
  // recessed dark walnut plinth under the sofa for a crisp shadow gap
  F(12.98, 0.02, -7.42, 16.62, 0.07, -6.32, 'walnut');
  rb(12.9, 0.07, -7.5, 16.7, 0.38, -6.25, 0.05, 'boucle');
  for (let i = 0; i < 3; i++) {
    rb(13.15 + i * 1.12, 0.37, -7.2, 13.15 + (i + 1) * 1.12 - 0.04, 0.55, -6.26, 0.075, 'boucle');
    rb(13.15 + i * 1.12, 0.4, -7.48, 13.15 + (i + 1) * 1.12 - 0.04, 0.92, -7.16, 0.085, 'boucle');
  }
  rb(12.9, 0.07, -7.5, 13.16, 0.66, -6.25, 0.06, 'boucle'); rb(16.44, 0.07, -7.5, 16.7, 0.66, -6.25, 0.06, 'boucle');
  rb(13.5, 0.52, -6.95, 13.95, 0.88, -6.85, 0.05, 'cushionRust'); rb(15.7, 0.52, -6.95, 16.15, 0.86, -6.85, 0.05, 'cushionSage');
  // a low travertine plinth table on recessed stone blocks
  F(14.05, 0.02, -5.35, 14.35, 0.24, -4.65, 'travertine'); F(15.25, 0.02, -5.35, 15.55, 0.24, -4.65, 'travertine');
  rb(13.8, 0.24, -5.55, 15.8, 0.34, -4.45, 0.03, 'travertine');
  item((() => { const g = new THREE.CylinderGeometry(0.11, 0.09, 0.26, 24); g.translate(14.3, 0.47, -5.0); return g; })(), 'ceramic');
  rb(14.9, 0.34, -5.2, 15.35, 0.38, -4.9, 0.005, 'book1'); rb(14.92, 0.38, -5.18, 15.3, 0.41, -4.93, 0.005, 'book2'); rb(14.95, 0.41, -5.15, 15.28, 0.43, -4.95, 0.005, 'book0');
  item((() => { const g = new THREE.SphereGeometry(0.2, 28, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); g.translate(15.45, 0.54, -4.75); return g; })(), 'ceramicDark');
  rb(16.2, 0.55, -7.3, 16.66, 0.62, -6.3, 0.02, 'throwOchre');
  // a second group: two lounge chairs and a round side table, facing the sofa across the rug
  for (const cx of [14.0, 15.6]) { rb(cx - 0.4, 0.1, -3.15, cx + 0.4, 0.4, -2.4, 0.06, 'boucle'); rb(cx - 0.4, 0.36, -2.6, cx + 0.4, 0.86, -2.4, 0.06, 'boucle'); for (const dx of [-0.32, 0.32]) F(cx + dx - 0.02, 0, -3.1, cx + dx + 0.02, 0.1, -2.45, 'blackSteel'); }
  cyl(14.8, 0, -2.75, 0.24, 0.24, 0.5, 'travertine');
  for (const [cx, cz, rot] of [[16.9, -4.1, -1], [12.5, -4.0, 1]]) {
    rb(cx - 0.42, 0.1, cz - 0.4, cx + 0.42, 0.42, cz + 0.4, 0.06, 'leather');
    rb(rot > 0 ? cx - 0.42 : cx + 0.3, 0.3, cz - 0.4, rot > 0 ? cx - 0.3 : cx + 0.42, 0.84, cz + 0.4, 0.05, 'leather');
    for (const dz of [-0.33, 0.33]) F(cx - 0.36, 0, cz + dz - 0.02, cx + 0.36, 0.1, cz + dz + 0.02, 'blackSteel');
  }
  lamp(12.85, 0, -6.95, 1.55, 0.2);
  plant(17.55, 0, -6.95, 1.85, 0.48, 0.26);
  // art over the sofa, with a slim oak gallery frame (sized to sit cleanly below the extended y=2.85 ceiling)
  F(13.5, 1.12, -7.7, 16.1, 2.58, -7.67, 'oakFurn');
  F(13.55, 1.17, -7.67, 16.05, 2.53, -7.64, 'art1');
  // a long walnut credenza along the front wall and a big olive in a pot by the glass (front part)
  F(12.6, 0.08, 3.1, 17.0, 0.62, 3.66, 'walnutDoors'); F(12.6, 0, 3.15, 17.0, 0.08, 3.6, 'blackSteel');
  item((() => { const g = new THREE.CylinderGeometry(0.1, 0.14, 0.42, 24); g.translate(13.4, 0.83, 3.38); return g; })(), 'ceramic');
  cyl(17.2, 0, 2.4, 0.42, 0.36, 0.62, 'travertine');
  life((() => { const g = new THREE.CylinderGeometry(0.06, 0.09, 1.6, 8); g.translate(17.2, 1.42, 2.4); return g; })(), 'bark');
  life(canopy([[0, 0, 0, 1.0, 0.6, 0.9, 340], [0.4, 0.4, 0.2, 0.7, 0.5, 0.6, 140]], 0.07, 0.13), 'olive', [17.2, 2.5, 2.4]);

  // ---- kitchen and dining, under the mezzanine (x 4 to 11)
  F(4.0, 0, -5.0, 4.65, 2.5, -1.6, 'walnutDoors');
  F(4.0, 0.9, -1.6, 4.65, 0.94, -1.3, 'marble');
  rb(6.2, 0, -4.45, 9.4, 0.88, -3.55, 0.02, 'walnutDoors');
  rb(6.15, 0.88, -4.5, 9.45, 0.93, -3.5, 0.01, 'marble');
  for (const sx of [6.8, 7.8, 8.8]) { cyl(sx, 0, -3.15, 0.02, 0.02, 0.66, 'blackSteel', 8); cyl(sx, 0.66, -3.15, 0.19, 0.19, 0.06, 'leather'); cyl(sx, 0, -3.15, 0.17, 0.17, 0.015, 'blackSteel'); }
  // the dining table: oak on two trestles, six chairs, three opal pendants
  rb(6.25, 0.72, -1.95, 9.35, 0.77, -0.85, 0.01, 'oakFurn');
  for (const tx of [6.7, 8.9]) { F(tx - 0.04, 0, -1.75, tx + 0.04, 0.72, -1.05, 'oakFurn'); }
  for (const cx of [6.85, 7.8, 8.75]) { chair(cx, -2.3, 1); chair(cx, -0.5, -1); }
  for (const px of [6.95, 7.8, 8.65]) { cyl(px, 1.95, -1.4, 0.004, 0.004, 0.9, 'blackSteel', 4); sph(px, 1.84, -1.4, 0.14, 'opal'); }
  // a bowl and a vase on the island
  item((() => { const g = new THREE.SphereGeometry(0.18, 24, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); g.translate(7.2, 1.11, -4.0); return g; })(), 'ceramic');

  // ---- the study on the third floor (x 4 to 10.35, y 3.20)
  rb(4.8, 3.2, -3.6, 9.2, 3.22, 1.2, 0.006, 'rug');
  rb(5.4, 3.92, -1.95, 7.6, 3.96, -1.05, 0.01, 'oakFurn');
  F(5.45, 3.2, -1.9, 5.5, 3.92, -1.1, 'blackSteel'); F(7.5, 3.2, -1.9, 7.55, 3.92, -1.1, 'blackSteel');
  chair(6.5, -0.65, -1, 3.2);
  cyl(5.75, 3.96, -1.75, 0.07, 0.08, 0.02, 'blackSteel'); cyl(5.75, 3.98, -1.75, 0.008, 0.008, 0.38, 'blackSteel', 6); cyl(5.75, 4.36, -1.68, 0.06, 0.09, 0.1, 'shade', 20, true);
  // a lounge chair in the study, a plant beside the doorway
  rb(8.0, 3.32, 1.0, 8.85, 3.62, 1.85, 0.06, 'cognac'); rb(8.0, 3.5, 1.65, 8.85, 4.1, 1.85, 0.06, 'cognac');
  F(8.05, 3.2, 1.05, 8.8, 3.32, 1.8, 'blackSteel');
  plant(9.65, 3.2, -5.95, 1.25, 0.38, 0.2);
  // horizontal rectangular abstract painting on the closed study partition wall (x = 10.35)
  F(10.31, 4.05, -3.35, 10.35, 5.75, -0.25, 'walnut');
  F(10.29, 4.10, -3.30, 10.31, 5.70, -0.30, 'art3');
  F(5.1, 3.9, 3.62, 8.3, 5.7, 3.7, 'oakFurn'); F(5.16, 3.96, 3.6, 8.24, 5.64, 3.62, 'artSection');
  rb(6.1, 3.96, -1.75, 6.5, 3.975, -1.47, 0.004, 'blackSteel'); rb(6.1, 3.975, -1.76, 6.5, 4.24, -1.75, 0.003, 'blackSteel');
  rb(6.75, 3.96, -1.8, 7.05, 4.02, -1.55, 0.005, 'book3'); rb(6.77, 4.02, -1.78, 7.03, 4.06, -1.57, 0.005, 'book2');
  cyl(7.3, 3.96, -1.35, 0.045, 0.04, 0.1, 'ceramic');
  rb(8.15, 3.2, 0.25, 8.7, 3.6, 0.8, 0.08, 'cognac');
  lamp(9.25, 3.2, 1.75, 1.45, 0.17);
  // the bookshelf along the north wall, below and beside the window
  F(4.0, 3.2, -2.2, 4.03, 5.85, 2.2, 'walnut');
  F(4.0, 3.2, -2.2, 4.4, 5.85, -2.17, 'walnut'); F(4.0, 3.2, 2.17, 4.4, 5.85, 2.2, 'walnut'); F(4.0, 5.82, -2.2, 4.4, 5.85, 2.2, 'walnut');
  for (let s = 0; s < 6; s++) {
    const y = 3.25 + s * 0.43;
    F(4.03, y, -2.17, 4.4, y + 0.025, 2.17, 'walnut');
    let z = -2.1;
    while (z < 2.1) { const w = 0.03 + rnd() * 0.05, h = 0.22 + rnd() * 0.15; if (rnd() < 0.8) F(4.04, y + 0.025, z, 4.3 + rnd() * 0.05, y + 0.025 + h, z + w, 'book' + Math.floor(rnd() * 5)); else z += 0.12 * rnd(); z += w + 0.004; }
  }

  // ---- the upper lounge / atelier on the third floor (x 10.50 to 15.10, y 3.20)
  rb(11.0, 3.2, -3.55, 14.55, 3.225, -0.45, 0.006, 'rugDark');
  // fluted walnut credenza with honed travertine top along the back wall
  F(11.05, 3.2, -7.66, 14.25, 3.92, -7.04, 'walnutDoors');
  rb(11.02, 3.92, -7.68, 14.28, 3.97, -7.02, 0.01, 'travertine');
  cyl(11.55, 3.97, -7.32, 0.11, 0.08, 0.28, 'ceramicDark');
  item((() => { const g = new THREE.SphereGeometry(0.16, 24, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); g.translate(12.35, 4.12, -7.34); return g; })(), 'brass');
  rb(12.95, 3.97, -7.46, 13.35, 4.01, -7.20, 0.005, 'book0'); rb(12.98, 4.01, -7.44, 13.32, 4.04, -7.22, 0.005, 'book2');
  lamp(13.85, 3.97, -7.34, 0.42, 0.14);
  // framed architectural print on the back wall beside the upper lounge window
  F(11.08, 4.18, -7.7, 12.12, 5.56, -7.66, 'oakFurn');
  F(11.13, 4.23, -7.66, 12.07, 5.51, -7.64, 'art2');
  // cognac leather and walnut daybed facing the mezzanine light well
  F(11.18, 3.22, -3.12, 12.02, 3.30, -0.88, 'walnut');
  rb(11.12, 3.30, -3.18, 12.08, 3.60, -0.82, 0.05, 'cognac');
  rb(11.12, 3.55, -3.18, 11.38, 4.02, -0.82, 0.06, 'cognac');
  rb(11.38, 3.58, -2.85, 11.72, 3.92, -2.35, 0.05, 'cushionRust');
  rb(11.38, 3.58, -1.65, 11.72, 3.90, -1.15, 0.05, 'cushionSage');
  rb(11.55, 3.58, -3.12, 12.04, 3.65, -2.25, 0.02, 'throwOchre');
  // honed travertine plinth coffee table in the center of the lounge
  F(12.52, 3.22, -2.42, 13.28, 3.44, -1.58, 'travertine');
  rb(12.40, 3.44, -2.55, 13.40, 3.53, -1.45, 0.025, 'travertine');
  cyl(12.72, 3.53, -2.12, 0.09, 0.07, 0.24, 'ceramic');
  rb(12.92, 3.53, -1.88, 13.25, 3.57, -1.62, 0.005, 'book1'); rb(12.95, 3.57, -1.86, 13.22, 3.60, -1.64, 0.005, 'book3');
  // two boucle lounge chairs facing the daybed across the travertine table
  for (const cz of [-2.65, -1.35]) {
    rb(13.68, 3.30, cz - 0.38, 14.42, 3.60, cz + 0.38, 0.06, 'boucle');
    rb(14.20, 3.54, cz - 0.38, 14.42, 4.02, cz + 0.38, 0.06, 'boucle');
    for (const dz of [-0.30, 0.30]) F(13.74, 3.2, cz + dz - 0.02, 14.36, 3.30, cz + dz + 0.02, 'blackSteel');
  }
  // three suspended opal pendant globes over the upper lounge (hung from the y=7.6 ceiling above the y=5.7 window line)
  for (const [px, py, pz] of [[12.45, 6.15, -2.15], [12.95, 6.38, -1.80], [13.35, 5.98, -2.05]]) {
    cyl(px, py, pz, 0.004, 0.004, 7.6 - py, 'blackSteel', 4);
    sph(px, py, pz, 0.13, 'opal');
  }
  lamp(11.32, 3.2, -0.58, 1.52, 0.18);
  plant(14.52, 3.2, -6.85, 1.45, 0.44, 0.22);
  // front-side walnut console bookcase in the upper lounge (front part)
  F(11.3, 3.2, 3.08, 14.1, 3.88, 3.66, 'walnutDoors');
  rb(11.26, 3.88, 3.05, 14.14, 3.93, 3.68, 0.01, 'travertine');

  // ---- the bedroom, lower level (x 11.15 to 18.24, y -3.20)
  // hand-loomed wool loop rug with a thin darker border band underneath
  rb(12.24, -3.20, -7.46, 16.76, -3.19, -3.22, 0.004, 'rugDark');
  rb(12.32, -3.19, -7.38, 16.68, -3.172, -3.30, 0.006, 'rug');
  // channel-tufted upholstered headboard framed in a slim dark walnut surround
  F(13.04, -3.20, -7.70, 15.96, -2.02, -7.62, 'walnut');
  for (let i = 0; i < 8; i++) {
    const hx0 = 13.09 + i * 0.352, hx1 = hx0 + 0.340;
    rb(hx0, -3.16, -7.64, hx1, -2.06, -7.52, 0.038, 'headboard');
  }
  // horizontal rectangular abstract painting centered directly above the bed frame (x = 13.32..15.68, center 14.50)
  F(13.32, -1.78, -7.70, 15.68, -0.74, -7.66, 'walnut');
  F(13.36, -1.74, -7.66, 15.64, -0.78, -7.64, 'art4');
  // floating walnut platform bed with recessed dark steel plinth, oak trim reveal, and layered bedding
  F(13.52, -3.20, -7.42, 15.48, -3.06, -5.52, 'blackSteel');
  rb(13.32, -3.06, -7.56, 15.68, -2.83, -5.34, 0.035, 'walnut');
  rb(13.36, -2.84, -7.54, 15.64, -2.80, -5.36, 0.015, 'oakFurn');
  rb(13.40, -2.81, -7.52, 15.60, -2.57, -5.40, 0.055, 'linen');
  // plush overhanging cloud duvet with a folded linen sheet turn-down collar at the head
  rb(13.35, -2.66, -6.92, 15.65, -2.47, -5.33, 0.065, 'duvet');
  rb(13.36, -2.50, -7.02, 15.64, -2.43, -6.68, 0.03, 'linen');
  // quilted ochre throw blanket draped across the lower third and wrapping down both sides of the mattress
  rb(13.33, -2.59, -6.02, 15.67, -2.44, -5.46, 0.04, 'throwOchre');
  rb(13.31, -2.80, -6.01, 13.40, -2.46, -5.47, 0.025, 'throwOchre');
  rb(15.60, -2.80, -6.01, 15.69, -2.46, -5.47, 0.025, 'throwOchre');
  // three tiers of pillows: tall linen Euro shams, boucle sleeping pillows, and sage lumbar cushions
  for (const px of [13.54, 14.58]) rb(px, -2.57, -7.50, px + 0.88, -2.22, -7.24, 0.08, 'linen');
  for (const px of [13.58, 14.62]) rb(px, -2.57, -7.28, px + 0.80, -2.30, -6.98, 0.075, 'boucle');
  for (const px of [13.72, 14.74]) rb(px, -2.56, -7.02, px + 0.54, -2.36, -6.82, 0.06, 'cushionSage');
  // sculpted nightstands on slim black-steel legs with lower open shelf, walnut drawer box, brass pull, and travertine top
  for (const [bx, bookMat] of [[12.34, 'book1'], [16.02, 'book0']]) {
    for (const lx of [bx + 0.04, bx + 0.60]) for (const lz of [-7.58, -7.12]) F(lx - 0.015, -3.20, lz - 0.015, lx + 0.015, -2.86, lz + 0.015, 'blackSteel');
    rb(bx + 0.02, -3.04, -7.58, bx + 0.62, -3.00, -7.12, 0.008, 'walnut');
    rb(bx + 0.12, -3.00, -7.48, bx + 0.44, -2.96, -7.22, 0.004, 'book2');
    rb(bx, -2.86, -7.60, bx + 0.64, -2.67, -7.10, 0.018, 'walnut');
    rb(bx - 0.01, -2.67, -7.61, bx + 0.65, -2.64, -7.09, 0.008, 'travertine');
    F(bx + 0.22, -2.76, -7.10, bx + 0.42, -2.74, -7.07, 'brass');
    lamp(bx + 0.22, -2.64, -7.38, 0.36, 0.12);
    rb(bx + 0.36, -2.64, -7.48, bx + 0.58, -2.60, -7.22, 0.004, bookMat);
  }
  // tailored foot-of-bed bench on black-steel sled legs, walnut platform rail, and three tufted cognac cushions
  for (const sx of [13.68, 15.32]) {
    F(sx - 0.02, -3.20, -5.08, sx + 0.02, -2.96, -4.68, 'blackSteel');
  }
  rb(13.56, -2.96, -5.10, 15.44, -2.90, -4.66, 0.015, 'walnut');
  for (let i = 0; i < 3; i++) {
    rb(13.58 + i * 0.61, -2.90, -5.11, 13.58 + (i + 1) * 0.61 - 0.02, -2.74, -4.65, 0.045, 'cognac');
  }
  rb(14.76, -2.75, -5.12, 15.32, -2.69, -4.64, 0.02, 'throwOchre');
  rb(13.82, -2.74, -5.00, 14.20, -2.70, -4.76, 0.005, 'book2');
  rb(13.85, -2.70, -4.98, 14.17, -2.67, -4.78, 0.005, 'book1');
  cyl(14.34, -2.74, -4.88, 0.045, 0.038, 0.09, 'ceramic');
  // reading lounge chair by the garden glass with black-steel sled legs, lumbar pillow, and travertine side table
  for (const dz of [-3.34, -2.66]) F(16.64, -3.20, dz - 0.02, 17.36, -3.08, dz + 0.02, 'blackSteel');
  rb(16.58, -3.08, -3.42, 17.42, -2.78, -2.58, 0.06, 'boucle');
  rb(17.20, -2.88, -3.42, 17.42, -2.38, -2.58, 0.055, 'boucle');
  rb(17.02, -2.78, -3.22, 17.22, -2.52, -2.78, 0.045, 'cushionRust');
  cyl(16.28, -3.20, -2.38, 0.19, 0.19, 0.44, 'travertine');
  cyl(16.28, -2.76, -2.38, 0.045, 0.038, 0.11, 'ceramicDark');
  lamp(17.15, -3.20, -2.12, 1.48, 0.18);
  // dresser along the partition wall with recessed plinth, travertine top, brass-rimmed mirror, and ceramic vessel
  F(11.15, -3.20, -6.66, 11.58, -3.12, -4.64, 'blackSteel');
  rb(11.15, -3.12, -6.70, 11.62, -2.42, -4.60, 0.015, 'walnutDoors');
  rb(11.15, -2.42, -6.72, 11.65, -2.38, -4.58, 0.01, 'travertine');
  item((() => { const g = new THREE.CylinderGeometry(0.42, 0.42, 0.03, 48); g.rotateZ(Math.PI / 2); g.translate(11.17, -1.75, -5.65); return g; })(), 'mirror');
  item((() => { const g = new THREE.TorusGeometry(0.42, 0.018, 8, 64); g.rotateY(Math.PI / 2); g.translate(11.18, -1.75, -5.65); return g; })(), 'brass');
  cyl(11.40, -2.38, -6.30, 0.08, 0.06, 0.24, 'ceramic');
  rb(11.24, -2.38, -5.12, 11.54, -2.34, -4.82, 0.005, 'book3');
  // floor-to-ceiling pleated linen drapery on recessed black-steel ceiling tracks
  for (const [z0, z1] of [[-7.65, -6.42], [2.42, 3.65]]) {
    F(17.86, -0.39, z0 - 0.02, 18.02, -0.35, z1 + 0.02, 'blackSteel');
    item((() => {
      const w = z1 - z0, h = (-0.38) - (-3.19), segZ = 84, segY = 16;
      const g = new THREE.PlaneGeometry(w, h, segZ, segY);
      g.rotateY(-Math.PI / 2);
      g.translate(17.94, (-3.19 + -0.38) / 2, (z0 + z1) / 2);
      const pos = g.attributes.position;
      const folds = 8.5;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i), z = pos.getZ(i);
        const u = (z - z0) / w, v = (y - (-3.19)) / h;
        const amp = 0.056 * (1 + 0.24 * (1 - v));
        const dx = amp * Math.sin(u * folds * Math.PI * 2) + 0.010 * Math.sin(u * folds * Math.PI * 4 + 0.65) + 0.012 * Math.sin(v * Math.PI) * Math.cos(u * Math.PI * 3);
        pos.setX(i, 17.94 + dx);
      }
      g.computeVertexNormals();
      return g;
    })(), 'curtain');
  }
  // ---- the snug, lower level (x 4 to 11)
  // board-formed concrete chimney breast with a deep recessed steel firebox opening
  F(4.0, -2.95, -1.95, 4.55, -2.30, -1.3, 'conc');
  F(4.0, -2.95, -3.7, 4.55, -2.30, -3.05, 'conc');
  F(4.0, -2.30, -3.7, 4.55, -0.35, -1.3, 'conc');
  // recessed darkened steel firebox chamber (x 4.16 to 4.56)
  F(4.16, -2.95, -3.05, 4.22, -2.30, -1.95, 'blackSteel');
  F(4.16, -2.95, -3.05, 4.56, -2.30, -2.99, 'blackSteel');
  F(4.16, -2.95, -2.01, 4.56, -2.30, -1.95, 'blackSteel');
  F(4.16, -2.35, -3.05, 4.56, -2.30, -1.95, 'blackSteel');
  F(4.16, -2.95, -3.05, 4.56, -2.91, -1.95, 'blackSteel');
  // recessed steel firewood niche beside the chimney breast with shelf dividers and tightly stacked split logs
  F(4.0, -2.95, -4.36, 4.18, -1.46, -3.7, 'blackSteel');
  F(4.0, -2.95, -4.38, 4.54, -1.46, -4.34, 'blackSteel');
  F(4.0, -2.95, -3.72, 4.54, -1.46, -3.68, 'blackSteel');
  F(4.0, -1.50, -4.38, 4.54, -1.46, -3.68, 'blackSteel');
  F(4.18, -2.47, -4.34, 4.52, -2.44, -3.72, 'blackSteel');
  F(4.18, -1.98, -4.34, 4.52, -1.95, -3.72, 'blackSteel');
  for (const baseY of [-2.95, -2.44, -1.95]) {
    for (let row = 0; row < 5; row++) {
      const cols = row % 2 === 0 ? 5 : 4;
      for (let col = 0; col < cols; col++) {
        const r = 0.045 + ((row + col) % 3) * 0.003;
        const ly = baseY + 0.048 + row * 0.082;
        const lz = -4.26 + col * 0.112 + (row % 2) * 0.056;
        item((() => { const g = new THREE.CylinderGeometry(r, r * 1.03, 0.34, 12); g.rotateZ(Math.PI / 2); g.translate(4.35, ly, lz); return g; })(), 'bark');
        item((() => { const g = new THREE.CylinderGeometry(r * 0.80, r * 0.80, 0.344, 12); g.rotateZ(Math.PI / 2); g.translate(4.35, ly, lz); return g; })(), 'oakFurn');
      }
    }
  }
  // framed painting centered on the open north wall to the left of the chimney breast (z 0.15 to 2.15)
  F(4.0, -2.32, 0.15, 4.04, -0.88, 2.15, 'oakFurn');
  F(4.04, -2.27, 0.20, 4.06, -0.93, 2.10, 'art1');
  plant(4.68, -3.2, 2.38, 1.38, 0.44, 0.22);
  // cast-iron grate, glowing ember bed, dark charred split logs, and layered flames inside the recessed firebox
  F(4.26, -2.89, -2.84, 4.46, -2.86, -2.16, 'blackSteel');
  rb(4.25, -2.92, -2.80, 4.46, -2.87, -2.20, 0.015, 'fire');
  for (const [lx, ly, lz, lr, rz] of [[4.33, -2.83, -2.38, 0.09, 0.0], [4.42, -2.83, -2.60, -0.11, 0.04], [4.37, -2.76, -2.49, 0.04, -0.05], [4.31, -2.81, -2.66, 0.14, 0.02]]) {
    item((() => { const g = new THREE.CylinderGeometry(0.040, 0.046, 0.50, 10); g.rotateX(Math.PI / 2 + lr); g.rotateZ(rz); g.translate(lx, ly, lz); return g; })(), 'walnut');
  }
  // organic layered flame bed and warm core glow nestled between the logs
  rb(4.31, -2.83, -2.72, 4.41, -2.68, -2.28, 0.04, 'fire');
  rb(4.33, -2.72, -2.62, 4.39, -2.56, -2.36, 0.035, 'fire');
  rb(4.34, -2.78, -2.58, 4.40, -2.62, -2.42, 0.03, 'opal');
  // cantilevered monolithic concrete hearth bench with hearth objects
  F(4.0, -3.2, -4.4, 4.92, -2.95, -0.45, 'conc');
  cyl(4.56, -2.95, -0.88, 0.11, 0.08, 0.30, 'ceramicDark');
  cyl(4.64, -2.95, -0.68, 0.075, 0.06, 0.19, 'ceramic');
  rb(4.42, -2.95, -3.48, 4.78, -2.91, -3.22, 0.005, 'book4'); rb(4.45, -2.91, -3.45, 4.75, -2.87, -3.25, 0.005, 'book2');
  lamp(8.1, -3.2, -0.35, 1.48, 0.18);
  rb(5.3, -3.2, -4.3, 9.6, -3.18, -0.5, 0.005, 'rugDark');
  rb(7.6, -3.1, -4.2, 8.55, -2.78, -0.7, 0.05, 'boucle'); rb(8.3, -2.9, -4.2, 8.55, -2.35, -0.7, 0.05, 'boucle');
  rb(5.6, -3.1, -4.2, 7.6, -2.78, -3.3, 0.05, 'boucle'); rb(5.6, -2.9, -4.2, 7.6, -2.35, -3.95, 0.05, 'boucle');
  rb(7.8, -2.76, -2.4, 8.25, -2.4, -2.3, 0.04, 'cushionRust'); rb(6.0, -2.76, -3.85, 6.45, -2.4, -3.75, 0.04, 'cushionSage');
  rb(5.9, -3.2, -2.6, 6.9, -2.86, -1.6, 0.03, 'travertine');
  cyl(6.22, -2.86, -2.22, 0.075, 0.055, 0.22, 'ceramicDark');
  item((() => { const g = new THREE.SphereGeometry(0.14, 24, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); g.translate(6.55, -2.72, -1.92); return g; })(), 'brass');
  rb(6.15, -2.86, -1.95, 6.48, -2.82, -1.72, 0.005, 'book0'); rb(6.18, -2.82, -1.93, 6.45, -2.79, -1.74, 0.005, 'book2');
  plant(10.35, -3.2, -0.55, 1.15, 0.36, 0.2);
  // walnut credenza on the front wall with lamp, vessels, and monographs
  F(5.4, -3.2, 3.08, 8.8, -2.52, 3.66, 'walnutDoors');
  rb(5.36, -2.52, 3.05, 8.84, -2.47, 3.68, 0.01, 'travertine');
  lamp(6.05, -2.47, 3.36, 0.44, 0.14);
  cyl(7.15, -2.47, 3.34, 0.10, 0.075, 0.26, 'ceramicDark');
  rb(7.65, -2.47, 3.24, 8.12, -2.43, 3.50, 0.005, 'book1'); rb(7.68, -2.43, 3.26, 8.08, -2.39, 3.48, 0.005, 'book3');

  // ---- terrace and lower garden
  for (const tz of [-6.8, -5.2]) { rb(19.2, 0.18, tz, 21.1, 0.32, tz + 0.72, 0.03, 'teak'); rb(19.2, 0.3, tz, 19.65, 0.75, tz + 0.72, 0.03, 'teak'); F(19.3, 0, tz + 0.05, 21.0, 0.18, tz + 0.67, 'blackSteel'); }
  cyl(21.6, 0, -1.2, 0.3, 0.26, 0.55, 'terracotta'); life(canopy([[0, 0, 0, 0.5, 0.45, 0.5, 120]], 0.05, 0.1), 'leaf', [21.6, 1.0, -1.2]);
  for (const tz of [-6.6, -5.4]) { rb(19.6, -3.0, tz, 21.4, -2.86, tz + 0.7, 0.03, 'linenOut'); F(19.7, -3.17, tz + 0.05, 21.3, -3.0, tz + 0.65, 'teak'); }
}

// people and trees (repositioned so no figure blocks the study desk dead-centre or gets cropped at the frame bottom)
const PEOPLE = [[16.55, 0, -6.1, 0.9], [4.95, 3.2, -3.1, 0.8], [21.6, -3.2, -1.6, -0.4], [-2.5, 0, -1.8, 2.6], [20.2, 0, -2.8, -1.2]];
const TREES = [['olive', 31.5, -4.6, -11], ['cypress', 34.5, -5.25, -14], ['cypress', 37, -5.4, -8], ['round', -4.5, 0, -5.5], ['round', -9.5, 0, 1.5], ['cypress', -7.5, 0, -11], ['olive', 23.2, -3.2, -10.6], ['round', 8.6, -3.2, 7.4], ['cypress', 5.4, -3.2, 9.2], ['olive', 12.5, -3.2, 10.5], ['cypress', 27.5, -3.6, 7.5], ['round', 30, -4.25, -2.5]];
const figureGeo = () => {
  const g = new THREE.LatheGeometry([[0, 0], [0.12, 0], [0.14, 0.1], [0.15, 0.82], [0.19, 1.0], [0.21, 1.36], [0.19, 1.44], [0.07, 1.5], [0.07, 1.54], [0.1, 1.6], [0.1, 1.7], [0.06, 1.75], [0, 1.76]].map(([x, y]) => new THREE.Vector2(x, y)), 16);
  g.scale(1, 1, 0.62); return g;
};

// a crown of small leaves, merged into one geometry: clusters are [cx, cy, cz, rx, ry, rz, count]
function canopy(clusters, s0, s1) {
  const list = [];
  for (const [cx, cy, cz, rx, ry, rz, n] of clusters) for (let i = 0; i < n; i++) {
    let x, y, z; do { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; } while (x * x + y * y + z * z > 1);
    const k = 0.6 + 0.4 * Math.sqrt(rnd());
    const g = new THREE.IcosahedronGeometry(s0 + rnd() * (s1 - s0), 0); g.scale(1, 0.55, 1); g.rotateX(rnd() * 3); g.rotateZ(rnd() * 3);
    g.translate(cx + x * rx * k, cy + y * ry * k, cz + z * rz * k); list.push(g);
  }
  return mergeGeometries(list);
}

// uv in metres from world position, by the face's main axis, so textures run on across pieces
function worldUV(pos, nor) {
  const uv = new Float32Array((pos.length / 3) * 2);
  for (let i = 0; i < pos.length / 3; i++) {
    const ax = Math.abs(nor[i * 3]), ay = Math.abs(nor[i * 3 + 1]), az = Math.abs(nor[i * 3 + 2]);
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    if (ax >= ay && ax >= az) { uv[i * 2] = z; uv[i * 2 + 1] = y; } else if (ay >= az) { uv[i * 2] = x; uv[i * 2 + 1] = z; } else { uv[i * 2] = x; uv[i * 2 + 1] = y; }
  }
  return uv;
}

// ---------------------------------------------------------------- pieces
// Everything becomes a list of pieces: flat arrays of triangles in world space with a material key, a drawing id and
// a part (behind, front, people). draw.js and real.js merge them however they need.
export function buildPieces({ extent = [-16, 46, -24, 16] } = {}) {
  const pieces = [];
  const push = (pos, nor, mat, id, part, extra = {}) => pieces.push({ pos, nor, mat, id, part, ...extra });
  const faceKey = (spec, ax, sg) => {
    if (typeof spec === 'string') return spec;
    const k = (sg > 0 ? 'p' : 'n') + 'xyz'[ax];
    return spec[k] || spec.all;
  };
  // a box, split at the cut: the faces on the cut become poche on both halves
  const box = (x0, y0, z0, x1, y1, z1, spec, kind = 'struct') => {
    const halves = [];
    if (z1 <= CUT) halves.push(['behind', [x0, y0, z0, x1, y1, z1], false]);
    else if (z0 >= CUT) halves.push(['front', [x0, y0, z0, x1, y1, z1], false]);
    else { halves.push(['behind', [x0, y0, z0, x1, y1, CUT], true]); halves.push(['front', [x0, y0, CUT, x1, y1, z1], true]); }
    const cy = (y0 + y1) / 2;
    const rank = Math.min(1, Math.max(0, (cy + 4.3) / 12.5)) * 0.82 + rnd() * 0.18;
    for (const [part, b, split] of halves) {
      for (let ax = 0; ax < 3; ax++) for (const sg of [1, -1]) {
        const n = [0, 0, 0]; n[ax] = sg;
        const u = (ax + 1) % 3, v = (ax + 2) % 3;
        const at = sg > 0 ? b[ax + 3] : b[ax];
        const corner = (uu, vv) => { const q = [0, 0, 0]; q[ax] = at; q[u] = uu; q[v] = vv; return q; };
        const c = [corner(b[u], b[v]), corner(b[u + 3], b[v]), corner(b[u + 3], b[v + 3]), corner(b[u], b[v + 3])];
        const A = new THREE.Vector3(...c[0]), B = new THREE.Vector3(...c[1]), D = new THREE.Vector3(...c[2]);
        const order = B.clone().sub(A).cross(D.clone().sub(A)).dot(new THREE.Vector3(...n)) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
        const pos = [], nor = [];
        for (const k of order) { pos.push(...c[k]); nor.push(...n); }
        const onCut = split && ax === 2 && ((part === 'behind' && sg > 0) || (part === 'front' && sg < 0));
        const glass = spec === 'glass';
        push(pos, nor, onCut ? 'poche' : faceKey(spec, ax, sg), glass ? 0 : onCut ? ID.poche + 0.9 * rank : ID.paper, part, { glass, kind });
      }
    }
  };
  const fromGeo = (g, mat, part, id = ID.paper, kind = 'item') => {
    const ng = g.index ? g.toNonIndexed() : g;
    push(Array.from(ng.attributes.position.array), Array.from(ng.attributes.normal.array), mat, id, part, { kind });
  };
  const item = (g, mat, at = null) => {
    if (at) g.translate(at[0], at[1], at[2]);
    g.computeBoundingBox();
    const c = g.boundingBox.getCenter(new THREE.Vector3());
    fromGeo(g, mat, c.z < CUT ? 'behind' : 'front');
  };
  const life = (g, mat, at = null) => { if (at) g.translate(at[0], at[1], at[2]); g.computeBoundingBox(); const c = g.boundingBox.getCenter(new THREE.Vector3()); fromGeo(g, mat, c.z < CUT ? 'behind' : 'front', ID.life, 'life'); };
  structure(box);
  staging(box, item, life);
  // people: their own part, so the page can keep them drawn inside the real house
  for (const [x, y, z, ry] of PEOPLE) { const g = figureGeo(); g.rotateY(ry); g.translate(x, y, z); fromGeo(g, 'figure', 'people', ID.person, 'person'); }
  // trees
  for (const [kind, x, y, z] of TREES) {
    if (x < extent[0] + 2 || x > extent[1] - 2 || z < extent[2] + 2 || z > extent[3] - 2) continue;
    const at = (g, m, dy) => { g.translate(x, y + dy, z); life(g, m); };
    if (kind === 'cypress') {
      at(canopy([[0, 0, 0, 0.8, 3.3, 0.8, 520]], 0.11, 0.2), 'leafDark', 3.7);
      at(new THREE.CylinderGeometry(0.1, 0.14, 1.2, 8), 'bark', 0.6);
    } else {
      const olive = kind === 'olive';
      const t = new THREE.CylinderGeometry(0.1, 0.2, 2.4, 8); t.rotateZ(olive ? 0.16 : 0.04); at(t, 'bark', 1.2);
      const br = new THREE.CylinderGeometry(0.05, 0.09, 1.6, 6); br.rotateZ(-0.7); br.translate(0.3, 0, 0); at(br, 'bark', 2.4);
      const cl = olive ? [[-0.4, 0, 0, 1.6, 0.9, 1.4, 380], [0.9, 0.4, 0.3, 1.1, 0.7, 1.0, 220], [-0.2, 0.8, -0.4, 1.0, 0.6, 1.0, 180]]
        : [[0, 0, 0, 1.7, 1.6, 1.6, 520], [0.5, 0.9, 0.3, 1.1, 0.9, 1.0, 220]];
      at(canopy(cl, olive ? 0.1 : 0.12, olive ? 0.18 : 0.22), olive ? 'olive' : 'leaf', olive ? 3.0 : 3.6);
    }
  }
  // the land: the section profile extruded along z, split at the cut; the faces on the cut are the earth cut
  const [X0, X1, Z0, Z1] = extent;
  const PH = [[X0, 0], [3.7, 0], [3.7, -3.6], [18.3, -3.6], [18.3, -3.2], [26, -3.2], [34, -5.2], [X1, -5.7], [X1, -8], [X0, -8]];
  const PS = [[X0, 0], [5, 0], [17.5, -3.2], [26, -3.2], [34, -5.2], [X1, -5.7], [X1, -8], [X0, -8]];
  const PF = [[X0, 0], [3.7, 0], [3.7, -3.2], [26, -3.2], [34, -5.2], [X1, -5.7], [X1, -8], [X0, -8]]; // in front of the house: a lower court behind a retaining wall
  const band = (prof, z0, z1, part, cutAt) => {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(prof.map(([x, y]) => new THREE.Vector2(x, y))), { depth: z1 - z0, bevelEnabled: false });
    g.translate(0, 0, z0);
    const ng = g.index ? g.toNonIndexed() : g;
    const P = ng.attributes.position.array, N = ng.attributes.normal.array;
    // split triangles into top (grass), sides and caps by their normal
    const groups = {};
    for (let t = 0; t < P.length / 9; t++) {
      const nz = N[t * 9 + 2], ny = N[t * 9 + 1], z = P[t * 9 + 2];
      const nx = N[t * 9];
      let key = ny > 0.35 ? (P[t * 9 + 1] < -3.1 && P[t * 9] < 18.3 && z > 4 ? 'pave' : 'grass') : prof === PF && Math.abs(nx) > 0.9 ? 'conc' : 'earthCut', id = ID.paper;
      if (Math.abs(nz) > 0.9 && cutAt !== null && Math.abs(z - cutAt) < 0.01) id = ID.earth;
      const k = key + ':' + id;
      (groups[k] ||= { pos: [], nor: [], mat: key, id });
      for (let j = 0; j < 9; j++) { groups[k].pos.push(P[t * 9 + j]); groups[k].nor.push(N[t * 9 + j]); }
    }
    for (const g2 of Object.values(groups)) push(g2.pos, g2.nor, g2.mat, g2.id, part, { kind: 'land' });
  };
  band(PH, -8, CUT - 0.003, 'behind', CUT - 0.003);
  band(PS, Z0, -8, 'behind', null);
  band(PH, CUT + 0.003, 4, 'front', CUT + 0.003);
  band(PF, 4, Z1, 'front', null);
  for (const p of pieces) {
    p.uv = worldUV(p.pos, p.nor);
    if (p.mat === 'curtain') {
      for (let i = 0; i < p.pos.length / 3; i++) { p.uv[i * 2] = p.pos[i * 3 + 2] * 2.2; p.uv[i * 2 + 1] = p.pos[i * 3 + 1] * 1.4; }
    } else if (p.mat.startsWith('art')) { // a picture is painted for its face: stretch uv to 0..1 across it
      let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
      for (let i = 0; i < p.uv.length; i += 2) { u0 = Math.min(u0, p.uv[i]); u1 = Math.max(u1, p.uv[i]); v0 = Math.min(v0, p.uv[i + 1]); v1 = Math.max(v1, p.uv[i + 1]); }
      for (let i = 0; i < p.uv.length; i += 2) { p.uv[i] = (p.uv[i] - u0) / Math.max(1e-4, u1 - u0); p.uv[i + 1] = (p.uv[i + 1] - v0) / Math.max(1e-4, v1 - v0); }
    }
  }
  return pieces;
}

// merged geometry of some pieces, with the attributes asked for
export function mergePieces(list, { uv = false, id = false } = {}) {
  let n = 0; for (const p of list) n += p.pos.length;
  const pos = new Float32Array(n), nor = new Float32Array(n), uvs = uv ? new Float32Array((n / 3) * 2) : null, ids = id ? new Float32Array(n / 3) : null;
  let o = 0;
  for (const p of list) {
    pos.set(p.pos, o); nor.set(p.nor, o);
    if (uv) uvs.set(p.uv, (o / 3) * 2);
    if (id) ids.fill(p.id, o / 3, o / 3 + p.pos.length / 3);
    o += p.pos.length;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (uv) g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (id) g.setAttribute('aId', new THREE.BufferAttribute(ids, 1));
  g.computeBoundingSphere();
  return g;
}

// boxes the camera must not enter (structure, glass marked), for checking a camera path
export function solids() {
  const list = [];
  structure((x0, y0, z0, x1, y1, z1, spec, kind = 'struct') => list.push([x0, y0, z0, x1, y1, z1, spec === 'glass' ? 'glass' : kind]));
  return list;
}
