// The house, as a list of parts. Copied unchanged from the sketch (sketch/sketch.js, houseParts).
// 1 unit = 1 metre of house. On the desk that is 1 cm, so the desk is built a hundred times its size
// and this file never has to know it is a model.
// Section runs along x: north and the hill on the left (x < 4), the view and the lower garden on the right.
// y up, z across the house (it spans z -8 to 4). Levels: garden -3.20, entrance 0.00, study 3.20, roof 6.40.
// Phases: 1 footings, 2 lower level, 3 ground slab, 4 upper walls, 5 mezzanine and stairs, 6 roof, 7 glass, 8 fit out.

export function makeRnd(s) {
  let seed = s;
  return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function houseParts(rnd = makeRnd(11)) {
  const P = [];
  const box = (x0, y0, z0, x1, y1, z1, m, k = 'struct', ph = 2) => P.push({ b: [x0, y0, z0, x1, y1, z1], m, k, ph });
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
  const wall = (axis, t0, t1, a0, a1, b0, b1, holes, m, ph) => {
    for (const [p0, p1, q0, q1] of carve(a0, a1, b0, b1, holes)) axis === 'x' ? box(t0, q0, p0, t1, q1, p1, m, 'struct', ph) : box(p0, q0, t0, p1, q1, t1, m, 'struct', ph);
    for (const h of holes) { // a steel frame and a pane in every hole
      const tm = (t0 + t1) / 2, f = 0.05;
      if (axis === 'x') {
        if (h[2] > b0 + 0.01 || true) {
          const glass = h[3] - h[2] > 2.3 && h[2] <= b0 + 0.01 ? false : true; // doors stay open
          if (!glass) continue;
          box(tm - 0.04, h[2], h[0], tm + 0.04, h[2] + f, h[1], 'steel', 'frame', 7); box(tm - 0.04, h[3] - f, h[0], tm + 0.04, h[3], h[1], 'steel', 'frame', 7);
          box(tm - 0.04, h[2], h[0], tm + 0.04, h[3], h[0] + f, 'steel', 'frame', 7); box(tm - 0.04, h[2], h[1] - f, tm + 0.04, h[3], h[1], 'steel', 'frame', 7);
          box(tm - 0.01, h[2], h[0], tm + 0.01, h[3], h[1], 'glass', 'glass', 7);
        }
      } else {
        box(h[0], h[2], tm - 0.04, h[1], h[2] + f, tm + 0.04, 'steel', 'frame', 7); box(h[0], h[3] - f, tm - 0.04, h[1], h[3], tm + 0.04, 'steel', 'frame', 7);
        box(h[0], h[2], tm - 0.04, h[0] + f, h[3], tm + 0.04, 'steel', 'frame', 7); box(h[1] - f, h[2], tm - 0.04, h[1], h[3], tm + 0.04, 'steel', 'frame', 7);
        if (h[1] - h[0] > 3) { const m = (h[0] + h[1]) / 2; box(m - 0.03, h[2], tm - 0.04, m + 0.03, h[3], tm + 0.04, 'steel', 'frame', 7); }
        box(h[0], h[2], tm - 0.01, h[1], h[3], tm + 0.01, 'glass', 'glass', 7);
      }
    }
  };
  const SL = { all: 'conc', top: 'floorL', bot: 'plaster' }, SG = { all: 'conc', top: 'oak', bot: 'plaster' };

  // footings
  box(3.1, -4.3, -8.4, 4.6, -3.6, 4.4, 'conc', 'struct', 1);
  box(17.7, -4.3, -8.4, 18.9, -3.6, 4.4, 'conc', 'struct', 1);
  box(4.6, -4.3, -8.4, 17.7, -3.6, -7.4, 'conc', 'struct', 1);
  box(4.6, -4.3, 3.4, 17.7, -3.6, 4.4, 'conc', 'struct', 1);
  // slabs
  box(4.0, -3.6, -7.7, 18.3, -3.2, 3.7, SL, 'struct', 2);
  box(4.0, -0.35, -6.4, 18.3, 0, 3.7, SG, 'struct', 3);
  box(4.0, -0.35, -7.7, 5.5, 0, -6.4, SG, 'struct', 3);
  box(10.3, -0.35, -7.7, 18.3, 0, -6.4, SG, 'struct', 3);
  box(18.3, -0.35, -8.0, 22.5, 0, 1.5, { all: 'conc', top: 'pave' }, 'struct', 3);
  box(4.0, 2.85, -6.4, 11.0, 3.2, 3.7, SG, 'struct', 5);
  box(4.0, 2.85, -7.7, 5.5, 3.2, -6.4, SG, 'struct', 5);
  box(10.3, 2.85, -7.7, 11.0, 3.2, -6.4, SG, 'struct', 5);
  const RF = { all: 'conc', top: 'gravel', bot: 'plaster' };
  box(4.0, 6.4, -8.0, 8.5, 6.8, 4.0, RF, 'struct', 6);
  box(12.0, 6.4, -8.0, 19.6, 6.8, 4.0, RF, 'struct', 6);
  box(8.3, 6.8, -8.0, 8.5, 8.0, 4.0, 'conc', 'struct', 6);
  box(8.3, 7.6, -8.0, 12.3, 8.0, 4.0, RF, 'struct', 6);
  box(8.5, 6.4, -8.0, 12.0, 7.6, -7.7, 'conc', 'struct', 6);
  box(8.5, 6.4, 3.7, 12.0, 7.6, 4.0, 'conc', 'struct', 6);
  // north wall: the entrance door from the upper court, a window for the study
  wall('x', 3.7, 4.0, -8, 4, -3.6, 0, [], 'conc', 2);
  wall('x', 3.7, 4.0, -8, 4, 0, 6.8, [[-1.2, 1.2, 0, 2.4], [-5.6, -2.4, 4.3, 5.9]], 'conc', 4);
  // back and front walls
  wall('z', -8.0, -7.7, 4.0, 18.3, -3.6, -0.35, [[13.0, 17.2, -2.3, -0.9], [5.0, 7.0, -1.7, -0.9]], 'conc', 2);
  wall('z', -8.0, -7.7, 4.0, 18.3, -0.35, 6.4, [[12.6, 17.4, 0.9, 5.6], [4.6, 10.8, 4.9, 5.8]], 'conc', 4);
  wall('z', 3.7, 4.0, 4.0, 18.3, -3.6, -0.35, [[13.0, 17.2, -2.3, -0.9], [5.0, 7.0, -1.7, -0.9]], 'conc', 2);
  wall('z', 3.7, 4.0, 4.0, 18.3, -0.35, 6.4, [[12.6, 17.4, 0.9, 5.6], [5.0, 9.4, 0.9, 2.2]], 'conc', 4);
  // lower level, between bedroom and bath
  wall('x', 11.0, 11.15, -7.7, 3.7, -3.2, -0.35, [[-2.4, -1.4, -3.2, -1.1]], 'plaster', 4);
  // south glass, both levels, the clerestory, the balustrades
  const glassRun = (x, y0, y1, z0, z1, step) => {
    box(x - 0.02, y0, z0, x + 0.02, y1, z1, 'glass', 'glass', 7);
    for (let z = z0; z <= z1 + 1e-3; z += step) box(x - 0.06, y0, Math.max(z0, z - 0.04), x + 0.06, y1, Math.min(z1, z + 0.04), 'steel', 'frame', 7);
    box(x - 0.06, y0, z0, x + 0.06, y0 + 0.06, z1, 'steel', 'frame', 7); box(x - 0.06, y1 - 0.06, z0, x + 0.06, y1, z1, 'steel', 'frame', 7);
  };
  glassRun(18.24, -3.2, -0.35, -7.7, 3.7, 1.9);
  glassRun(18.24, 0, 6.4, -7.7, 3.7, 1.9);
  box(18.18, 3.12, -7.7, 18.3, 3.2, 3.7, 'steel', 'frame', 7);
  glassRun(12.0, 6.8, 7.6, -7.7, 3.7, 1.9);
  box(22.42, 0, -8.0, 22.46, 1.05, 1.5, 'glass', 'glass', 7); box(22.38, 1.05, -8.0, 22.5, 1.1, 1.5, 'steel', 'frame', 7);
  box(10.96, 3.2, -6.4, 11.0, 4.25, 3.7, 'glass', 'glass', 7); box(10.92, 4.25, -6.4, 11.04, 4.3, 3.7, 'steel', 'frame', 7);
  box(5.5, 0, -6.42, 10.3, 1.0, -6.38, 'glass', 'glass', 7); box(5.5, 1.0, -6.44, 10.3, 1.05, -6.36, 'steel', 'frame', 7);
  // stairs, a scissor pair along the back wall
  const n = 18, run = 4.8 / n, rise = 3.2 / n;
  for (let i = 0; i < n; i++) {
    const t = (i + 1) * rise;
    box(10.3 - (i + 1) * run, Math.max(0, t - 0.45), -7.7, 10.3 - i * run, t, -6.5, { all: 'conc', top: 'oak' }, 'stair', 5);
    box(5.5 + i * run, Math.max(-3.2, -3.2 + t - 0.45), -7.7, 5.5 + (i + 1) * run, -3.2 + t, -6.5, { all: 'conc', top: 'oak' }, 'stair', 5);
  }
  // furniture (beyond the cut, so it reads in the section)
  const F = (x0, y0, z0, x1, y1, z1, m) => box(x0, y0, z0, x1, y1, z1, m, 'furn', 8);
  F(12.6, 0, -7.2, 17.2, 0.015, -3.4, 'rug');
  F(13.0, 0, -7.3, 16.6, 0.42, -6.35, 'fabric'); F(13.0, 0.42, -7.3, 16.6, 0.86, -7.04, 'fabric');
  F(13.0, 0.42, -7.3, 13.24, 0.62, -6.35, 'fabric'); F(16.36, 0.42, -7.3, 16.6, 0.62, -6.35, 'fabric');
  F(13.3, 0.42, -6.95, 14.9, 0.56, -6.4, 'linen'); F(14.95, 0.42, -6.95, 16.3, 0.56, -6.4, 'linen');
  F(13.9, 0.3, -5.6, 15.7, 0.36, -4.7, 'walnut'); F(14.1, 0, -5.45, 15.5, 0.3, -4.85, 'walnut');
  F(16.6, 0, -4.6, 17.5, 0.42, -3.7, 'leather'); F(17.25, 0.42, -4.6, 17.5, 0.9, -3.7, 'leather');
  F(4.0, 0, -6.0, 4.65, 2.4, -2.2, 'walnut');
  F(6.2, 0, -4.6, 9.4, 0.88, -3.7, 'walnut'); F(6.15, 0.88, -4.65, 9.45, 0.92, -3.65, 'stone');
  F(6.4, 0.72, -2.2, 9.2, 0.77, -1.1, 'oak');
  for (const [lx, lz] of [[6.5, -2.1], [9.1, -2.1], [6.5, -1.2], [9.1, -1.2]]) F(lx - 0.03, 0, lz - 0.03, lx + 0.03, 0.72, lz + 0.03, 'walnut');
  for (const cx of [6.9, 7.8, 8.7]) { F(cx - 0.22, 0.44, -2.75, cx + 0.22, 0.48, -2.35, 'walnut'); F(cx - 0.22, 0.48, -2.75, cx + 0.22, 0.9, -2.71, 'walnut'); F(cx - 0.2, 0, -2.7, cx + 0.2, 0.44, -2.66, 'walnut'); }
  F(5.4, 3.92, -1.9, 7.6, 3.97, -1.1, 'oak'); F(5.45, 3.2, -1.85, 5.5, 3.92, -1.15, 'steel'); F(7.5, 3.2, -1.85, 7.55, 3.92, -1.15, 'steel');
  F(4.0, 3.2, -1.95, 4.38, 5.8, -0.2, 'walnut');
  for (let s = 0; s < 6; s++) {
    const y = 3.25 + s * 0.42;
    F(4.0, y, -1.95, 4.38, y + 0.025, -0.2, 'walnut');
    let z = -1.9;
    while (z < -0.3) { const w = 0.03 + rnd() * 0.05, h = 0.22 + rnd() * 0.14; if (rnd() < 0.85) F(4.05, y + 0.025, z, 4.33, y + 0.025 + h, z + w, 'book' + Math.floor(rnd() * 5)); z += w + 0.005; }
  }
  F(13.2, -3.2, -7.7, 15.8, -2.1, -7.6, 'walnut'); F(13.4, -3.2, -7.6, 15.6, -2.8, -5.5, 'walnut');
  F(13.45, -2.8, -7.3, 15.55, -2.66, -5.45, 'linen'); F(13.6, -2.8, -7.55, 14.4, -2.6, -7.1, 'linen'); F(14.6, -2.8, -7.55, 15.4, -2.6, -7.1, 'linen');
  F(12.7, -3.2, -7.7, 13.2, -2.75, -7.25, 'walnut'); F(15.8, -3.2, -7.7, 16.3, -2.75, -7.25, 'walnut');
  F(6.6, -3.2, -5.2, 8.4, -2.65, -4.4, 'white');
  F(4.0, -2.6, -3.6, 4.6, -2.3, -2.0, 'walnut'); F(4.0, -2.1, -3.5, 4.03, -1.0, -2.1, 'mirror');
  F(19.2, 0, -6.8, 21.0, 0.32, -6.1, 'teak'); F(19.2, 0.32, -6.8, 19.6, 0.72, -6.1, 'teak');
  F(19.2, 0, -5.4, 21.0, 0.32, -4.7, 'teak'); F(19.2, 0.32, -5.4, 19.6, 0.72, -4.7, 'teak');
  // paving
  box(-7, 0, -6.5, 3.7, 0.03, 3.5, 'pave', 'land', 8);
  box(18.3, -3.2, -7.7, 24.5, -3.17, 3.7, 'pave', 'land', 8);
  return P;
}

// people and trees, as in the sketch: [x, y, z, rotation] and [kind, x, y, z]
export const PEOPLE = [[15.4, 0, -2.8, 0.6], [9.9, 3.2, -2.2, 1.9], [21.6, -3.2, -1.6, -0.4], [-2.5, 0, -1.8, 2.6], [20.2, 0, -2.8, -1.2]];
export const TREES = [['olive', 31.5, -4.6, -11], ['cypress', 34.5, -5.25, -14], ['cypress', 37, -5.4, -8], ['round', -4.5, 0, -5.5], ['round', -9.5, 0, 1.5], ['cypress', -7.5, 0, -11]];
