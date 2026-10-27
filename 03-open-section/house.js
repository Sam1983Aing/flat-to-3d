// Casa Graó: an invented house stepping down a hillside, for the direction sketches.
//
// Every solid is a profile drawn in the section plane (x along the section, y up, metres)
// pushed back along the depth axis z, from z0 to z1. The camera looks from +z, the front
// facade is at z = 0 and the back wall at z = -10. A cut at depth zc keeps everything with
// z <= zc, and the black fill on the cut is the profile itself.
//
// Levels: L0 garden and living ±0.00, L1 bedrooms +3.30, L2 entrance and kitchen +6.60
// (street level), roof +10.10.

export const pieces = [];
export const floors = [];      // floor rectangles that get a tile grid {x0, x1, z0, z1, y, step}
export const sprites = [];     // entourage {type, x, y, z, h, flip}

const R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const add = (kind, pts, z0, z1, extra = {}) => pieces.push({ kind, pts, z0, z1, ...extra });
const cut = (pts, z0, z1, extra) => add('cut', pts, z0, z1, extra);
// what a piece is made of, for the colour ending. as('oak', () => {...}) paints everything made inside it
let MAT = null;
const as = (mat, fn) => { const was = MAT; MAT = mat; fn(); MAT = was; };
const furn = (pts, z0, z1, extra) => add('furn', pts, z0, z1, { mat: MAT, ...extra });

const D0 = -10, D1 = 0;               // house depth
const LANE = [-5.2, -3.9];            // the stair runs in this strip, the main cut goes through it
// The house changes along its depth, so a moving cut has something to find. Nothing changes inside the
// stair lane, so the main section (cut at -4.6) is the same drawing as before.
//   in front of the stair: a loggia on the street at L2 (z -2 to 0), a gallery over the living room at L1
//   behind the stair: a courtyard through L1 and the terrace (PATIO), a lantern on the roof over the dining table
const PATIO = { x0: 10.8, x1: 14.2, z0: -9.7, z1: -6.6 };
const LANTERN = { x0: 6.4, x1: 7.9, z0: -9.7, z1: -6.6 };      // clear of the stair's rooflight, and of the parapet on C in perspective
const LOGGIA = -2.0, GALLERY = -3.6;

// ---------------------------------------------------------------- the land
// Natural hillside, and the same hill carved where the house sits in it.
const natural = [[-30, -14], [50, -14], [50, -4.2], [38, -2.4], [34, 0], [23.2, 0], [16, 2.0], [8, 4.6], [0, 6.6],
  [-1.6, 6.6], [-1.6, 6.45], [-16, 6.45], [-30, 9.8]];
const carved = [[-30, -14], [50, -14], [50, -4.2], [38, -2.4], [34, 0], [31.25, 0], [31.25, -1.75], [24.75, -1.75], [24.75, 0],
  [23.2, 0], [23.2, -0.35], [10.15, -0.35], [10.15, 2.95], [5.15, 2.95], [5.15, 6.25], [0.15, 6.25], [0.15, 6.6],
  [-1.6, 6.6], [-1.6, 6.45], [-16, 6.45], [-30, 9.8]];
add('earth', carved, D0 - 0.3, D1 + 0.3, { ground: true });
add('earth', natural, -40, D0 - 0.3, { ground: true });
const front = [[-30, -14], [50, -14], [50, -4.2], [38, -2.4], [34, 0], [23.2, 0], [23.2, -0.35], [10.15, -0.35], [10.15, 2.95], [5.15, 2.95], [5.15, 6.25], [0.15, 6.25], [0.15, 6.6],
  [-1.6, 6.6], [-1.6, 6.45], [-16, 6.45], [-30, 9.8]];
add('earth', front, D1 + 0.3, 8, { ground: true });   // terraced in front of the house, so the facade can be seen whole
// the ground line the hatch fades from, as a function of x (left to right)
export const groundLine = [[-30, 9.8], [-16, 6.45], [-1.6, 6.45], [-1.6, 6.6], [0.15, 6.6], [0.16, 6.25], [5.15, 6.25], [5.16, 2.95],
  [10.15, 2.95], [10.16, -0.35], [23.2, -0.35], [23.21, 0], [24.75, 0], [24.76, -1.75], [31.25, -1.75], [31.26, 0], [34, 0], [38, -2.4], [50, -4.2]];

// ---------------------------------------------------------------- structure
// retaining walls and footings, cut by any section through the house
cut(R(0, 5.7, 0.3, 6.25), D0, D1, { mat: 'stone' });                // W0, street side of the kitchen, below the floor
cut(R(0, 6.25, 0.3, 9.6), D0, LOGGIA, { mat: 'stone' });             // and above it, back to the loggia: local stone
cut(R(0, 6.6, 0.3, 9.6), D1 - 0.3, D1);            // the loggia's corner columns
cut(R(8.7, 6.6, 9.0, 9.3), D1 - 0.3, D1);
cut(R(-0.25, 5.45, 0.55, 5.75), D0, D1, { mat: 'stone' });          // its footing
cut(R(5.0, 2.6, 5.3, 6.25), D0, D1, { mat: 'stone' });              // W5, behind the bedrooms
cut(R(4.75, 2.35, 5.55, 2.65), D0, D1, { mat: 'stone' });
cut(R(10.0, -0.8, 10.3, 2.95), D0, D1, { mat: 'stone' });           // W10, behind the dining room
cut(R(9.75, -1.05, 10.55, -0.75), D0, D1, { mat: 'stone' });

// L0 ground slab
cut(R(10.0, -0.35, 23.2, 0), D0, D1);
// L1 slab, with the void over the lower flight in the stair lane
cut(R(5.0, 2.95, 10.3, 3.3), D0, D1);
cut(R(13.6, 2.95, 15.0, 3.3), PATIO.z1, D1);
cut(R(13.6, 2.95, 15.0, 3.3), D0, PATIO.z0);
cut(R(PATIO.x1, 2.95, 15.0, 3.3), PATIO.z0, PATIO.z1);
cut(R(10.3, 2.95, 13.6, 3.3), PATIO.z1, LANE[0]);
cut(R(10.3, 2.95, 13.6, 3.3), D0, PATIO.z0);
cut(R(10.3, 2.95, PATIO.x0, 3.3), PATIO.z0, PATIO.z1);
cut(R(15.0, 2.95, 22.0, 3.3), GALLERY, D1);        // the gallery over the living room, in front of the stair
cut(R(21.6, 2.65, 22.0, 2.95), GALLERY, D1);        // its edge beam
cut(R(21.65, 0, 21.9, 2.65), -3.5, -3.25);          // and the columns that carry it
cut(R(21.65, 0, 21.9, 2.65), -0.75, -0.5);
cut(R(10.3, 2.95, 13.6, 3.3), LANE[1], D1);
cut(R(14.6, 2.55, 15.0, 2.95), D0, D1);           // downstand beam where L1 stops over the living room
cut(R(14.65, 0, 14.95, 2.55), -7.35, -7.05);       // and the two columns that carry it, on grid D
cut(R(14.65, 0, 14.95, 2.55), -2.15, -1.85);
// L2 slab and the terrace over the living room, with the void over the upper flight
cut(R(0, 6.25, 5.3, 6.6), D0, D1);
cut(R(8.6, 6.25, 9.0, 6.6), D0, D1);
cut(R(5.3, 6.25, 8.6, 6.6), D0, LANE[0]);
cut(R(5.3, 6.25, 8.6, 6.6), LANE[1], D1);
for (const [y0, y1, kind] of [[6.25, 6.48, 'cut'], [6.48, 6.6, 'layer']]) {   // terrace slab, then its build-up
  add(kind, R(9.0, y0, 23.2, y1), PATIO.z1, D1);
  add(kind, R(9.0, y0, 23.2, y1), D0, PATIO.z0);
  add(kind, R(9.0, y0, PATIO.x0, y1), PATIO.z0, PATIO.z1);
  add(kind, R(PATIO.x1, y0, 23.2, y1), PATIO.z0, PATIO.z1);
}
// L1 east wall over the living room: sill, interior glass, head
cut(R(14.75, 3.3, 15.0, 4.25), D0, GALLERY);
cut(R(14.75, 5.9, 15.0, 6.25), D0, D1);
add('glass', R(14.86, 4.25, 14.9, 5.9), D0, GALLERY);
add('glass', R(15.0, 3.3, 22.0, 4.3), GALLERY - 0.04, GALLERY);   // the gallery's balustrades
add('glass', R(21.96, 3.3, 22.0, 4.3), GALLERY, D1);
// the courtyard: glass on three sides at both levels, and round its opening on the terrace
for (const [y0, y1] of [[0, 2.95], [3.3, 6.25], [6.6, 7.6]]) {
  add('glass', R(PATIO.x0, y0, PATIO.x1, y1), PATIO.z1 - 0.02, PATIO.z1 + 0.02);
  add('glass', R(PATIO.x0 - 0.02, y0, PATIO.x0 + 0.02, y1), PATIO.z0, PATIO.z1);
  add('glass', R(PATIO.x1 - 0.02, y0, PATIO.x1 + 0.02, y1), PATIO.z0, PATIO.z1);
}
// living room facade to the garden: full height glass between a sill and a deep head
cut(R(22.75, 5.85, 23.2, 6.25), D0, D1);
cut(R(22.75, 0, 23.0, 0.08), D0, D1);
add('glass', R(22.85, 0.08, 22.89, 5.85), D0, D1);
// kitchen facade to the terrace
cut(R(8.75, 9.3, 9.3, 9.6), D0, D1);
add('glass', R(8.93, 6.6, 8.97, 9.3), D0, LOGGIA);
// roof over L2 with a rooflight above the stair, structure, insulation, parapets
cut(R(-0.3, 9.6, 5.6, 9.85), D0, D1);
cut(R(7.8, 9.6, 9.3, 9.85), LANTERN.z1, D1);
cut(R(7.8, 9.6, 9.3, 9.85), D0, LANTERN.z0);
cut(R(LANTERN.x1, 9.6, 9.3, 9.85), LANTERN.z0, LANTERN.z1);
cut(R(5.6, 9.6, 7.8, 9.85), LANTERN.z1, LANE[0]);
cut(R(5.6, 9.6, 7.8, 9.85), D0, LANTERN.z0);
cut(R(5.6, 9.6, LANTERN.x0, 9.85), LANTERN.z0, LANTERN.z1);
// the lantern: upstands, a solid back, glass to the south, a roof of its own
for (const [a, b] of [[LANTERN.x0, LANTERN.x0 + 0.15], [LANTERN.x1 - 0.15, LANTERN.x1]]) {
  cut(R(a, 9.6, b, 9.95), LANTERN.z0, LANTERN.z1);
  add('glass', R(a + 0.055, 9.95, b - 0.055, 10.85), LANTERN.z0, LANTERN.z1);
  cut(R(a, 10.85, b, 10.95), LANTERN.z0, LANTERN.z1);
}
cut(R(LANTERN.x0, 9.85, LANTERN.x1, 10.95), LANTERN.z0 - 0.15, LANTERN.z0);
cut(R(LANTERN.x0 + 0.15, 9.6, LANTERN.x1 - 0.15, 9.9), LANTERN.z1 - 0.15, LANTERN.z1);
add('glass', R(LANTERN.x0 + 0.15, 9.9, LANTERN.x1 - 0.15, 10.95), LANTERN.z1 - 0.1, LANTERN.z1 - 0.06);
cut(R(LANTERN.x0 - 0.1, 10.95, LANTERN.x1 + 0.1, 11.2), LANTERN.z0 - 0.25, LANTERN.z1 + 0.1);
add('layer', R(LANTERN.x0 - 0.1, 11.2, LANTERN.x1 + 0.1, 11.34), LANTERN.z0 - 0.25, LANTERN.z1 + 0.1);
cut(R(5.6, 9.6, 7.8, 9.85), LANE[1], D1);
add('layer', R(0, 9.85, 5.45, 10.1), D0, D1);
add('layer', R(7.95, 9.85, 9.0, 10.1), LANTERN.z1, D1);
add('layer', R(7.95, 9.85, 9.0, 10.1), D0, LANTERN.z0 - 0.15);
add('layer', R(LANTERN.x1, 9.85, 9.0, 10.1), LANTERN.z0 - 0.15, LANTERN.z1);
add('layer', R(5.45, 9.85, 7.95, 10.1), LANTERN.z1, LANE[0]);
add('layer', R(5.45, 9.85, 7.95, 10.1), D0, LANTERN.z0 - 0.15);
add('layer', R(5.45, 9.85, LANTERN.x0, 10.1), LANTERN.z0 - 0.15, LANTERN.z1);
add('layer', R(5.45, 9.85, 7.95, 10.1), LANE[1], D1);
cut(R(-0.3, 9.85, 0, 10.45), D0, D1);
cut(R(9.0, 9.85, 9.3, 10.45), D0, D1);
cut(R(6.05, 9.6, 7.8, 9.85), LANE[0], LANE[1]);   // the roof closes over the lower part of the void
add('layer', R(6.2, 9.85, 7.95, 10.1), LANE[0], LANE[1]);
cut(R(5.45, 9.85, 5.6, 10.3), LANE[0], LANE[1]);   // rooflight upstands, over the top of the flight
cut(R(6.05, 9.85, 6.2, 10.3), LANE[0], LANE[1]);
add('glass', [[5.45, 10.3], [6.2, 10.3], [6.2, 10.34], [5.45, 10.34]], LANE[0], LANE[1]);
// terrace balustrades, garden side and street front
add('glass', R(22.95, 6.6, 22.99, 7.7), D0, D1);
add('glass', R(9.0, 6.6, 22.99, 7.7), D1 - 0.04, D1);
cut(R(9.0, 7.7, 23.02, 7.76), D1 - 0.06, D1);
cut(R(22.92, 7.7, 23.02, 7.76), D0, D1);
// pool shell and water
cut(R(24.75, -1.75, 25.0, 0), D0 - 0.3, D1 + 0.3);
cut(R(31.0, -1.75, 31.25, 0), D0 - 0.3, D1 + 0.3);
cut(R(24.75, -1.75, 31.25, -1.5), D0 - 0.3, D1 + 0.3);
cut(R(24.75, -1.75, 31.25, 0), D0 - 0.3, D0 - 0.05);
add('water', R(25.0, -1.5, 31.0, -0.12), D0 - 0.05, D1 + 0.3);

// back walls (parallel to the cut, seen beyond it) with their windows cut out as holes
function wall(x0, y0, x1, y1, holes, z0, z1, mat) {
  add('cut', R(x0, y0, x1, y1), z0, z1, { holes: holes.map(h => R(...h)), mat });
  holes.forEach(([a, b, c, d]) => {
    add('furn', R(a, b, c, d), z0 + 0.1, z0 + 0.16, { holes: [R(a + 0.05, b + 0.05, c - 0.05, d - 0.05)], frame: true, mat: 'bronze' });
    add('glass', R(a + 0.05, b + 0.05, c - 0.05, d - 0.05), z0 + 0.12, z0 + 0.14);
  });
}
wall(0.3, 6.6, 8.75, 9.6, [[1.5, 7.75, 4.5, 8.9], [6.3, 6.8, 8.3, 9.1]], D0, D0 + 0.3);
wall(5.3, 3.3, 14.75, 6.25, [[6.0, 4.6, 8.8, 5.8]], D0, D0 + 0.3);
wall(10.3, 0, 15.0, 2.95, [], D0, D0 + 0.3);
wall(15.0, 0, 22.85, 6.25, [[15.6, 3.4, 22.2, 5.9]], D0, D0 + 0.3);
// front walls, only ever seen as ghosts
wall(0.3, 6.6, 8.75, 9.6, [[2.0, 6.6, 3.1, 8.9], [4.6, 7.4, 7.6, 9.0]], LOGGIA - 0.3, LOGGIA);
wall(5.3, 3.3, 14.75, 6.25, [[6.5, 4.2, 9.5, 5.8]], D1 - 0.3, D1, 'stone');     // the lower two floors in local stone, the top one in plaster
wall(10.3, 0, 15.0, 2.95, [[11.2, 0.6, 14.2, 2.4]], D1 - 0.3, D1, 'stone');
wall(15.0, 0, 22.85, 6.25, [[16, 0.4, 22, 5.6]], D1 - 0.3, D1, 'stone');

// ---------------------------------------------------------------- the stair
// Two straight flights in the stair lane, cascading down the hill with the house.
function flight(xTop, yTop, xBot, yBot, n, z0, z1) {
  const dir = Math.sign(xBot - xTop), run = Math.abs(xBot - xTop) / n, rise = (yTop - yBot) / n;
  const slope = rise / run, wv = 0.2 * Math.hypot(1, slope);
  const X = i => xTop + dir * i * run;
  const pts = [[xTop, yTop]];
  for (let i = 0; i < n; i++) {
    pts.push([X(i), yTop - (i + 1) * rise]);
    if (i < n - 1) pts.push([X(i + 1), yTop - (i + 1) * rise]);
  }
  pts.push([X(n - 1) - dir * wv / slope, yBot]);
  pts.push([xTop, yTop - rise - wv]);
  if (dir < 0) pts.reverse();
  cut(pts, z0, z1);
  return { run, rise, at: x => yTop - Math.floor((x - xTop) * dir / run + 1) * rise };
}
export const upper = flight(5.3, 6.6, 9.62, 3.3, 16, LANE[0], LANE[1]);
export const lower = flight(10.3, 3.3, 14.62, 0, 16, LANE[0], LANE[1]);
// balustrades round the two voids
add('glass', R(5.3, 6.6, 8.6, 7.6), LANE[0] - 0.04, LANE[0]);
add('glass', R(8.56, 6.6, 8.6, 7.6), LANE[0], LANE[1]);
add('glass', R(5.3, 6.6, 8.6, 7.6), LANE[1], LANE[1] + 0.04);
add('glass', R(10.3, 3.3, 13.6, 4.3), LANE[0] - 0.04, LANE[0]);
add('glass', R(13.56, 3.3, 13.6, 4.3), LANE[0], LANE[1]);
add('glass', R(10.3, 3.3, 13.6, 4.3), LANE[1], LANE[1] + 0.04);
// handrails along the flights, on the far side of the lane
const rail = (x0, y0, x1, y1) => add('furn', [[x0, y0 + 0.9], [x1, y1 + 0.9], [x1, y1 + 0.94], [x0, y0 + 0.94]], LANE[0] + 0.04, LANE[0] + 0.08, { mat: 'metal' });
rail(5.3, 6.6, 9.62, 3.3);
rail(10.3, 3.3, 14.62, 0);

// ---------------------------------------------------------------- furniture
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

function table(x0, x1, y, z0, z1, h = 0.74, wood = 'oak') { as(wood, () => {
  furn(R(x0, y + h - 0.04, x1, y + h), z0, z1);
  for (const lx of [x0 + 0.06, x1 - 0.1]) for (const lz of [z0 + 0.06, z1 - 0.1]) furn(R(lx, y, lx + 0.04, y + h - 0.04), lz, lz + 0.04);
}); }
function chair(x, y, zc, face, wood = 'oak') { as(wood, () => {   // x is the chair's middle, face +1 looks to +x
  const z0 = zc - 0.22, z1 = zc + 0.22, b = x - face * 0.22;
  furn(R(x - 0.22, y + 0.43, x + 0.22, y + 0.47), z0, z1);
  furn(face > 0 ? R(b, y + 0.47, b + 0.035, y + 0.86) : R(b - 0.035, y + 0.47, b, y + 0.86), z0 + 0.02, z1 - 0.02);
  for (const lx of [x - 0.21, x + 0.18]) for (const lz of [z0 + 0.01, z1 - 0.04]) furn(R(lx, y, lx + 0.03, y + 0.43), lz, lz + 0.03);
}); }
function stool(x, y, zc) {
  furn(R(x - 0.18, y + 0.72, x + 0.18, y + 0.76), zc - 0.18, zc + 0.18, { mat: 'oak' });
  MAT = 'metal';
  furn(R(x - 0.16, y, x - 0.13, y + 0.72), zc - 0.015, zc + 0.015);
  furn(R(x + 0.13, y, x + 0.16, y + 0.72), zc - 0.015, zc + 0.015);
  furn(R(x - 0.15, y + 0.3, x + 0.15, y + 0.32), zc - 0.015, zc + 0.015);
  MAT = null;
}
function pendant(x, yCeil, yShade, zc, r = 0.2) {
  furn(R(x - 0.008, yShade + 0.22, x + 0.008, yCeil), zc - 0.008, zc + 0.008, { mat: 'metal' });
  furn([[x - r, yShade], [x + r, yShade], [x + r * 0.4, yShade + 0.22], [x - r * 0.4, yShade + 0.22]], zc - r, zc + r, { mat: 'brass' });
}
function bed(xHead, y, z0, z1, dir = 1) {       // headboard at xHead, the bed runs to +x
  const X = v => xHead + dir * v, r = (a, b, c, d) => (dir > 0 ? R(X(a), b, X(c), d) : R(X(c), b, X(a), d));
  const o = { mat: 'oak' };
  furn(r(0, y, 0.12, y + 1.1), z0, z1, o);
  furn(r(0.12, y + 0.08, 2.2, y + 0.34), z0 + 0.05, z1 - 0.05, o);
  furn(r(0.14, y, 0.2, y + 0.08), z0 + 0.1, z0 + 0.14, o);
  furn(r(2.1, y, 2.16, y + 0.08), z0 + 0.1, z0 + 0.14, o);
  furn([[X(0.14), y + 0.34], [X(2.18), y + 0.34], [X(2.18), y + 0.56], [X(2.12), y + 0.6], [X(0.2), y + 0.6], [X(0.14), y + 0.56]].map(p => p), z0 + 0.08, z1 - 0.08, { mat: 'linen' });
  furn([[X(0.2), y + 0.6], [X(0.7), y + 0.6], [X(0.72), y + 0.72], [X(0.66), y + 0.78], [X(0.24), y + 0.78], [X(0.18), y + 0.7]], z0 + 0.2, z1 - 0.2, { mat: 'linen2' });
  furn([[X(0.9), y + 0.6], [X(2.24), y + 0.6], [X(2.26), y + 0.3], [X(2.3), y + 0.3], [X(2.28), y + 0.64], [X(2.2), y + 0.68], [X(0.92), y + 0.68]], z0 + 0.02, z1 - 0.02, { mat: 'ochre' });
}
function sofa(xBack, y, z0, z1, dir = 1) { as('fabric', () => {   // back at xBack, the seat faces dir
  const X = v => xBack + dir * v, r = (a, b, c, d) => (dir > 0 ? R(X(a), b, X(c), d) : R(X(c), b, X(a), d));
  furn([[X(0), y + 0.08], [X(0.98), y + 0.08], [X(0.98), y + 0.38], [X(0.22), y + 0.38], [X(0.22), y + 0.8], [X(0), y + 0.8]], z0 + 0.2, z1 - 0.2);
  furn([[X(0.24), y + 0.38], [X(0.96), y + 0.38], [X(0.98), y + 0.48], [X(0.94), y + 0.52], [X(0.26), y + 0.52]], z0 + 0.2, z1 - 0.2);
  furn([[X(0.24), y + 0.52], [X(0.4), y + 0.52], [X(0.44), y + 0.86], [X(0.38), y + 0.9], [X(0.24), y + 0.86]], z0 + 0.22, z1 - 0.22);
  const arm = [[X(0), y + 0.08], [X(0.98), y + 0.08], [X(0.98), y + 0.52], [X(0.95), y + 0.59], [X(0.88), y + 0.62], [X(0.1), y + 0.62], [X(0.03), y + 0.59], [X(0), y + 0.52]];
  const armPts = dir > 0 ? arm : arm.slice().reverse();          // rounded arms, so the sofa is not a stack of boxes
  furn(armPts, z0, z0 + 0.2);
  furn(armPts, z1 - 0.2, z1);
  furn(r(0.04, y, 0.08, y + 0.08), z0 + 0.05, z0 + 0.09);
  furn(r(0.9, y, 0.94, y + 0.08), z0 + 0.05, z0 + 0.09, { mat: 'oak' });
}); }
function lounger(x0, y, z0, z1, dir = 1) { MAT = 'teak';
  const X = v => x0 + dir * v;
  furn([[X(0), y + 0.3], [X(1.4), y + 0.3], [X(1.9), y + 0.82], [X(1.84), y + 0.86], [X(1.36), y + 0.38], [X(0), y + 0.38]], z0, z1);
  furn(dir > 0 ? R(X(0.05), y, X(0.09), y + 0.3) : R(X(0.09), y, X(0.05), y + 0.3), z0 + 0.04, z0 + 0.08);
  furn(dir > 0 ? R(X(1.3), y, X(1.34), y + 0.3) : R(X(1.34), y, X(1.3), y + 0.3), z0 + 0.04, z0 + 0.08);
  MAT = null;
}
function units(x0, x1, y0, y1, n, z0, z1, gap = 0.006) {   // cupboard doors seen face on
  const w = (x1 - x0) / n;
  for (let i = 0; i < n; i++) furn(R(x0 + i * w + gap, y0, x0 + (i + 1) * w - gap, y1), z0, z1);
}
function books(x0, x1, y, z0, z1) {
  let x = x0;
  while (x < x1 - 0.06) {
    if (rnd() < 0.08) { x += 0.12 + rnd() * 0.2; continue; }
    const w = 0.02 + rnd() * 0.035, h = 0.18 + rnd() * 0.14;
    furn(R(x, y, x + w, y + h), z0 + rnd() * 0.04, z1, { light: true, mat: 'book', tone: rnd() });
    x += w + 0.004;
  }
}

// L2, kitchen and dining at +6.60
const L2 = 6.6;
as('terrazzo', () => {
  furn(R(2.0, L2, 3.8, L2 + 0.1), -6.3, -3.3);
  furn(R(1.9, L2 + 0.1, 3.9, L2 + 0.88), -6.4, -3.2);
  furn(R(1.75, L2 + 0.88, 4.35, L2 + 0.93), -6.5, -3.1, { mat: 'stone' });
});
stool(4.55, L2, -5.9); stool(4.55, L2, -5.0); stool(4.55, L2, -3.7);
pendant(2.9, 9.6, 8.25, -5.8); pendant(2.9, 9.6, 8.25, -3.6);
as('sage', () => {
  units(0.6, 5.0, L2 + 0.1, L2 + 0.88, 7, -9.7, -9.1);
  furn(R(0.55, L2 + 0.88, 5.05, L2 + 0.92), -9.7, -9.05, { mat: 'stone' });
  furn(R(0.6, L2, 5.0, L2 + 0.1), -9.7, -9.15);
  units(0.45, 1.45, L2 + 1.3, L2 + 2.4, 2, -9.7, -9.35);
  units(5.4, 6.05, L2, L2 + 2.4, 1, -9.7, -9.1);
});
table(6.1, 8.2, L2, -8.9, -6.9);
chair(5.75, L2, -8.4, 1); chair(5.75, L2, -7.4, 1); chair(8.55, L2, -8.4, -1); chair(8.55, L2, -7.4, -1);
pendant(7.15, 10.85, 8.1, -7.9, 0.28);                     // hangs from the lantern
// entrance bench and coat rail by the street door, near the front
as('oak', () => {
  furn(R(0.4, L2 + 0.42, 1.65, L2 + 0.47), -1.8, -0.6);      // a bench under the loggia
  furn(R(0.45, L2, 0.5, L2 + 0.42), -1.7, -0.7);
  furn(R(1.55, L2, 1.6, L2 + 0.42), -1.7, -0.7);
});
furn(R(0.3, L2 + 1.7, 1.2, L2 + 1.74), -3.6, -2.5, { mat: 'metal' });   // coat rail inside the door
// a reading chair by the terrace glass
furn([[7.3, L2 + 0.4], [8.1, L2 + 0.4], [8.15, L2 + 0.62], [7.45, L2 + 0.62], [7.35, L2 + 1.0], [7.25, L2 + 0.98]], -3.4, -2.6, { mat: 'ochre' });
as('oak', () => { furn(R(7.35, L2, 7.4, L2 + 0.4), -3.35, -3.3); furn(R(8.0, L2, 8.05, L2 + 0.4), -3.35, -3.3); });
furn(R(4.2, L2, 4.8, L2 + 0.75), -1.6, -1.0, { mat: 'terracotta' });   // a planter and a low table in the loggia
as('teak', () => { furn(R(5.6, L2 + 0.38, 6.8, L2 + 0.42), -1.5, -0.8); furn(R(5.7, L2, 5.75, L2 + 0.38), -1.4, -1.35); furn(R(6.65, L2, 6.7, L2 + 0.38), -1.4, -1.35); });

// L1, bedrooms at +3.30
const L1 = 3.3;
bed(5.35, L1, -9.6, -7.8);
furn(R(5.35, L1, 5.85, L1 + 0.5), -7.7, -7.25, { mat: 'oak' });
pendant(5.6, 6.25, 4.6, -7.45, 0.12);
as('linen', () => units(9.0, 10.6, L1, L1 + 2.3, 2, -9.7, -9.1));
table(12.9, 14.4, L1, -6.45, -5.75, 0.75);
chair(13.65, L1, -5.45, -1);
// the gallery: a reading corner over the living room
furn([[17.0, L1 + 0.4], [17.8, L1 + 0.4], [17.85, L1 + 0.62], [17.15, L1 + 0.62], [17.05, L1 + 1.0], [16.95, L1 + 0.98]], -2.4, -1.6, { mat: 'ochre' });
as('oak', () => { furn(R(17.05, L1, 17.1, L1 + 0.4), -2.35, -2.3); furn(R(17.7, L1, 17.75, L1 + 0.4), -2.35, -2.3); });
table(18.4, 19.8, L1, -2.6, -1.4, 0.72);
furn(R(15.2, L1, 16.4, L1 + 2.2), -0.5, -0.2, { light: true, mat: 'oak' });
bed(5.35, L1, -3.5, -1.3);                 // the second bedroom, cut lengthwise by a front section

// L0, dining and the double height living room at ±0.00
const L0 = 0;
table(11.2, 13.2, L0, -3.4, -1.8);
chair(10.85, L0, -3.0, 1); chair(10.85, L0, -2.2, 1); chair(13.55, L0, -3.0, -1); chair(13.55, L0, -2.2, -1);
pendant(12.2, 2.95, 1.5, -2.6, 0.3);                       // off the courtyard tree's axis
furn(R(11.8, L0, 13.2, L0 + 0.45), -9.2, -8.0, { mat: 'stone' });   // the courtyard's planter
as('oak', () => {
  furn(R(10.3, L0, 10.34, 2.5), GALLERY, -0.4);              // library shelving along the retaining wall
  for (const y of [0.06, 0.5, 0.94, 1.38, 1.82, 2.26]) {
    furn(R(10.34, y, 10.64, y + 0.03), GALLERY, -0.4);
    if (y < 2.2) furn(R(10.36, y + 0.03, 10.58, y + 0.3), GALLERY + 0.1, -0.5, { light: true, mat: 'book', tone: (y * 7.3) % 1 });
  }
});
furn(R(17.2, L0, 21.0, L0 + 0.015), -7.6, -3.6, { mat: 'rug' });   // rug
sofa(17.4, L0, -7.3, -4.0, 1);
as('oak', () => { furn(R(18.9, L0 + 0.32, 20.1, L0 + 0.38), -6.4, -4.9); furn(R(19.1, L0, 19.9, L0 + 0.32), -6.2, -5.1); });
furn([[21.6, L0 + 0.1], [20.85, L0 + 0.1], [20.8, L0 + 0.42], [21.45, L0 + 0.44], [21.75, L0 + 0.95], [21.85, L0 + 0.92]], -6.3, -5.5, { mat: 'ochre' });
as('oak', () => { furn(R(21.4, L0, 21.45, L0 + 0.1), -6.25, -6.2); furn(R(20.9, L0, 20.95, L0 + 0.1), -6.25, -6.2); });
furn(R(18.6, 3.1, 19.8, 3.16), -6.2, -5.0, { mat: 'brass' });   // the big pendant in the double height
furn(R(19.19, 3.16, 19.21, 6.25), -5.61, -5.59, { mat: 'metal' });
as('oak', () => {
  furn(R(15.4, L0, 21.8, L0 + 0.04), -9.7, -9.35);            // bookshelf on the back wall
  for (let i = 0; i <= 5; i++) furn(R(15.4, 0.5 + i * 0.5, 21.8, 0.53 + i * 0.5), -9.7, -9.35);
  for (const sx of [15.4, 17.5, 19.65, 21.76]) furn(R(sx, L0, sx + 0.04, 3.03), -9.7, -9.35);
  for (let i = 0; i < 5; i++) books(15.5, 21.7, 0.53 + i * 0.5, -9.7, -9.42);
  furn(R(15.4, L0 + 0.04, 21.8, L0 + 0.5), -9.7, -9.35);
  furn(R(15.4, L0, 18.0, L0 + 0.75), -1.0, -0.45);            // sideboard by the front wall
});

// terrace over the living room at +6.60
furn(R(9.3, L2, 10.5, L2 + 0.55), -9.6, -7.4, { mat: 'terracotta' });   // planter, on solid deck beside the courtyard
table(15.0, 17.4, L2, -2.8, -1.2, 0.74, 'teak');
chair(14.65, L2, -2.4, 1, 'teak'); chair(14.65, L2, -1.6, 1, 'teak'); chair(17.75, L2, -2.4, -1, 'teak'); chair(17.75, L2, -1.6, -1, 'teak');

// garden
// (the garden lounger went: in the elevation it stood in front of the walker)

// ---------------------------------------------------------------- coursing on the stone of the south front
export const coursing = [];
function course(x0, y0, x1, y1, holes) {
  const h = 0.28, z = D1 + 0.004;
  const inHole = (x, y) => holes.some(([a, b, c, d]) => x > a && x < c && y > b && y < d);
  for (let y = y0 + h, row = 0; y < y1 - 0.05; y += h, row++) {          // bed joints, broken by the windows
    let x = x0;
    while (x < x1) {
      const hole = holes.find(([a, b, c, d]) => y > b && y < d && x >= a - 1e-6 && x < c);
      if (hole) { x = hole[2]; continue; }
      const next = Math.min(x1, ...holes.filter(([a, b, c, d]) => y > b && y < d && a > x).map(q => q[0]));
      coursing.push(x, y, z, next, y, z); x = next;
    }
  }
  for (let y = y0, row = 0; y < y1 - 0.05; y += h, row++) {              // head joints, staggered row by row
    let x = x0 + (row % 2 ? 0.35 : 0.7) + rnd() * 0.2;
    while (x < x1 - 0.1) {
      const yt = Math.min(y + h, y1);
      if (!inHole(x, (y + yt) / 2)) coursing.push(x, y, z, x, yt, z);
      x += 0.55 + rnd() * 0.45;
    }
  }
}
course(5.3, 3.3, 14.75, 6.25, [[6.5, 4.2, 9.5, 5.8]]);
course(10.3, 0, 15.0, 2.95, [[11.2, 0.6, 14.2, 2.4]]);
course(15.0, 0, 22.85, 6.25, [[16, 0.4, 22, 5.6]]);

// ---------------------------------------------------------------- floors with a tile grid
floors.push({ x0: 10.3, x1: 22.85, z0: D0 + 0.3, z1: D1 - 0.3, y: 0, step: 0.6 });
floors.push({ x0: 5.3, x1: 10.3, z0: D0 + 0.3, z1: D1 - 0.3, y: L1, step: 0.5 });
floors.push({ x0: 13.6, x1: 14.75, z0: PATIO.z1, z1: D1 - 0.3, y: L1, step: 0.5 });
floors.push({ x0: PATIO.x1, x1: 14.75, z0: D0 + 0.3, z1: PATIO.z1, y: L1, step: 0.5 });
floors.push({ x0: 10.3, x1: 13.6, z0: PATIO.z1, z1: LANE[0], y: L1, step: 0.5 });
floors.push({ x0: 10.3, x1: PATIO.x0, z0: D0 + 0.3, z1: PATIO.z1, y: L1, step: 0.5 });
floors.push({ x0: 15.0, x1: 22.0, z0: GALLERY, z1: D1 - 0.3, y: L1, step: 0.5 });
floors.push({ x0: 10.3, x1: 13.6, z0: LANE[1], z1: D1 - 0.3, y: L1, step: 0.5 });
floors.push({ x0: 0.3, x1: 5.3, z0: D0 + 0.3, z1: D1 - 0.3, y: L2, step: 0.6 });
floors.push({ x0: 5.3, x1: 8.6, z0: D0 + 0.3, z1: LANE[0], y: L2, step: 0.6 });
floors.push({ x0: 5.3, x1: 8.6, z0: LANE[1], z1: D1 - 0.3, y: L2, step: 0.6 });
floors.push({ x0: 9.0, x1: 22.9, z0: PATIO.z1, z1: D1, y: L2, step: 0.6 });
floors.push({ x0: 9.0, x1: PATIO.x0, z0: D0, z1: PATIO.z1, y: L2, step: 0.6 });
floors.push({ x0: PATIO.x1, x1: 22.9, z0: D0, z1: PATIO.z1, y: L2, step: 0.6 });
floors.push({ x0: 23.2, x1: 24.75, z0: D0 - 0.3, z1: D1 + 0.3, y: 0, step: 0.6 });

// ---------------------------------------------------------------- entourage
const nat = x => { for (let i = 0; i < natural.length - 1; i++) { const [ax, ay] = natural[i], [bx, by] = natural[i + 1]; if ((x - ax) * (x - bx) <= 0 && ax !== bx && ay > -6 && by > -6) return ay + (by - ay) * (x - ax) / (bx - ax); } return 0; };
sprites.push({ type: 'walk', x: -7.5, y: 6.45, z: -6.5, h: 1.72 });
sprites.push({ type: 'stand', x: 1.4, y: L2, z: -7.0, h: 1.68, flip: true });      // the cook, beside the island and clear of the pendants from every camera
sprites.push({ type: 'stair', x: 8.1, y: upper.at(8.1), z: -4.62, h: 1.74 });             // low enough that the head clears the slab
sprites.push({ type: 'sit', x: 17.85, y: L0 + 0.02, z: -6.2, h: 1.7 });
sprites.push({ type: 'standDress', x: 16.1, y: L0, z: -4.62, h: 1.66 });          // at the cut for scale, clear of the chairs and the other figure
sprites.push({ type: 'sit', x: 10.85, y: L0, z: -2.2, h: 1.68 });
sprites.push({ type: 'cypress', x: 12.9, y: 0.45, z: -8.6, h: 7.6, tag: 'court' });                      // one slim tree, inside the courtyard glass, up past the terrace
sprites.push({ type: 'walk', x: 1.6, y: L2, z: -1.1, h: 1.72, flip: true });               // arriving under the loggia
sprites.push({ type: 'sit', x: 17.45, y: L1, z: -2.0, h: 1.66 });                          // reading on the gallery
sprites.push({ type: 'stand', x: 21.6, y: L2, z: -5.6, h: 1.76, tag: 'terrace' });
sprites.push({ type: 'standDress', x: 20.9, y: L2, z: -5.9, h: 1.64, flip: true, tag: 'terrace' });
sprites.push({ type: 'walk', x: 33.2, y: 0, z: -3.0, h: 1.7, flip: true });
sprites.push({ type: 'tree', x: 9.9, y: L2 + 0.55, z: -8.5, h: 3.2, tag: 'terrace' });
sprites.push({ type: 'tree', x: 41.5, y: nat(41.5), z: -14, h: 5.0, flip: true });
sprites.push({ type: 'cypress', x: -9.5, y: 6.45, z: -9.5, h: 6.4 });
sprites.push({ type: 'cypress', x: -18.0, y: nat(-18), z: -18, h: 10.5 });
sprites.push({ type: 'cypress', x: 32.4, y: nat(32.4), z: -19, h: 10.5 });
sprites.push({ type: 'cypress', x: 33.5, y: nat(33.5), z: -22, h: 7.5 });
sprites.push({ type: 'tree', x: 16.5, y: nat(16.5), z: -16, h: 4.8, flip: true });     // low enough to stay behind the house
sprites.push({ type: 'tree', x: -6.6, y: 6.45, z: -12, h: 5.4 });
sprites.push({ type: 'plant', x: 22.25, y: L0, z: -8.8, h: 1.5 });
sprites.push({ type: 'plant', x: 0.9, y: L2, z: -8.6, h: 1.2 });

// ---------------------------------------------------------------- drawing notes
export const levels = [
  { y: 0, text: '±0.00', note: 'GARDEN' },
  { y: 3.3, text: '+3.30', note: 'BEDROOM' },
  { y: 6.6, text: '+6.60', note: 'STREET' },
  { y: 10.1, text: '+10.10', note: 'ROOF' },
];
export const grid = [['A', 0.15], ['B', 5.15], ['C', 10.15], ['D', 14.88], ['E', 22.95]];
// [name, places to try in order, the depths of cut it belongs to (optional)]
export const labels = [
  ['KITCHEN', [[0.7, 9.2], [0.7, 7.75]], [D0, LOGGIA]], ['DINING', [[6.2, 9.15], [6.6, 7.6], [6.2, 8.0], [5.0, 9.15]], [D0, LOGGIA]],
  ['LOGGIA', [[0.7, 9.2], [3.4, 9.2]], [LOGGIA, D1]],
  ['BEDROOM', [[7.95, 5.85], [8.65, 5.85], [10.4, 5.85], [5.6, 4.75]]], 
  ['GALLERY', [[17.2, 5.85], [19.6, 5.85]], [GALLERY, D1]],
  ['LIBRARY', [[10.72, 2.55], [11.2, 2.5], [12.4, 2.5]], [LANE[1], D1]], ['HALL', [[10.45, 2.5], [10.45, 1.6], [13.4, 2.5]], [PATIO.z1, LANE[1]]],
  ['PATIO', [[10.95, 2.5], [10.95, 1.4], [13.75, 2.5], [10.95, 5.85]], [PATIO.z0, PATIO.z1]],
  ['LIVING', [[16.0, 3.13], [19.4, 3.13], [16.0, 5.0], [16.0, 2.5]], [D0, GALLERY]],
  ['LIVING', [[15.4, 2.55], [18.6, 2.55], [15.4, 1.7]], [GALLERY, D1]],      // under the gallery, the room keeps its name
  ['TERRACE', [[18.4, 7.05], [13.2, 7.05], [15.6, 7.05]]],      // the open deck first, never under the table
  ['STREET', [[-3.4, 6.75], [-6.4, 6.75]]], ['POOL', [[25.3, 0.4], [27.4, 0.4]]],
];
export const LANE_Z = LANE;
