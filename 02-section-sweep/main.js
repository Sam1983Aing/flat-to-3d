// Cota: a section drawing that swings into perspective, a scan that turns ink into material, a walk in through the
// cut, and back out to the drawing. Everything on screen is a function of two numbers: T (seconds since the page was
// first seen) and the scroll. ?offline hands both to window.__frame(T, s), so a recorder can step it frame by frame.
import * as THREE from 'three';
import { buildPieces, solids, CUT } from './house.js';
import { createDrawing } from './draw.js';
import { createLook } from './look.js';
import { createReal, SUN_DIR } from './real.js';

const Q = new URLSearchParams(location.search);
const OFF = Q.has('offline');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ramp = (t, t0, d) => cl((t - t0) / d);
const eOut = (x) => 1 - Math.pow(1 - cl(x), 3);
const eExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * cl(x)));
const eIO = (x) => { x = cl(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const eSine = (x) => 0.5 - 0.5 * Math.cos(Math.PI * cl(x));
const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const INK = '#1d1c19', PAPER = '#f2efe7', ACC = '#e85d04';

window.__mainOwns = true;
window.__loader.p = 0.3;

let W = Math.max(1, innerWidth), H = Math.max(1, innerHeight);
const DPR = Math.min(Q.has('dpr') ? +Q.get('dpr') : devicePixelRatio, 2);
const SMALL = Math.min(innerWidth, innerHeight) < 600 || matchMedia('(pointer: coarse)').matches;
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gl'), antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(DPR);
renderer.setSize(W, H, false);

// ---------------------------------------------------------------- the camera
// One perspective camera for the whole page. The flat section is a 0.12 degree lens about 12 km away.
// A pose is a position, a point to look at, a lens (vertical fov) and a lens shift in metres at the target.
const cam = new THREE.PerspectiveCamera();
cam.userData.fr = new THREE.Vector4();
const TAN0 = Math.tan((0.06 * Math.PI) / 180);
function placePose(P) {
  cam.position.copy(P.p); cam.up.set(0, 1, 0); cam.lookAt(P.t); cam.updateMatrixWorld();
  const dist = P.p.distanceTo(P.t), th = Math.tan((P.fov * Math.PI) / 360), asp = W / H;
  const near = P.near ?? Math.max(0.05, Math.min(dist - 45, dist * 0.5)), far = Math.max(dist + 170, 220);
  const l = -th * asp + (P.sx || 0) / dist, r = th * asp + (P.sx || 0) / dist, b = -th + (P.sy || 0) / dist, t = th + (P.sy || 0) / dist;
  cam.near = near; cam.far = far;
  cam.projectionMatrix.makePerspective(l * near, r * near, t * near, b * near, near, far);
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  cam.userData.fr.set(l, r, b, t);
  cam.userData.fov = P.fov;
}
// an orbit state (target, yaw, pitch, lens, distance or the height of the view at the target) as a pose
function orbitPose(st) {
  const th = Math.tan((st.fov * Math.PI) / 360), dist = st.dist ?? st.hgt / 2 / th;
  const yw = (st.yaw * Math.PI) / 180, pt = (st.pitch * Math.PI) / 180;
  const t = V3(st.t);
  const p = t.clone().add(new THREE.Vector3(Math.sin(yw) * Math.cos(pt), Math.sin(pt), Math.cos(yw) * Math.cos(pt)).multiplyScalar(dist));
  return { p, t, fov: st.fov, sx: st.sx || 0, sy: st.sy || 0 };
}

// Smooth ease-in that ends with positive velocity (f'(1) = 0.7) so the swing hands into the spline without stopping
const eInCont = (x) => { x = cl(x); return x * x * (2.3 - 1.3 * x); };

// framings: the hero (the flat sheet), the end of the dolly (f1), the section perspective the swing lands on
const F = {};
function frames() {
  W = Math.max(1, innerWidth); H = Math.max(1, innerHeight);
  const asp = W / H;
  F.portrait = asp < 0.9;
  if (!F.portrait) {
    const vw = Math.max(44, 25.3 * asp);
    F.hero = { t: [13, 1.2, 0], hgt: vw / asp, sx: 0, sy: 0 };
    F.f1 = 58;
    F.end = { t: [11.2, 1.1, -4.6], yaw: 39, pitch: 8.2, fov: 35, dist: 28.4 };
    F.sweep = { t: [13.8, 1.55, -4.1], yaw: 20, pitch: 4.2, fov: 45, dist: 17.5 };
    F.levels = { x0: 23.2, x1: 25.8, short: false };
  } else {
    const vw = 25.5, vh = vw / asp;
    F.hero = { t: [12.9, 1.2, 0], hgt: vh, sx: 0, sy: 1.8 + 0.04 * vh - 1.2 };
    F.f1 = 72;
    F.end = { t: [12.6, 2.2, -3.8], yaw: 49, pitch: 9, fov: 52, dist: 51 };
    F.sweep = { t: [14.2, 1.8, -3.6], yaw: 28, pitch: 6, fov: 56, dist: 31 };
    F.levels = { x0: 22.8, x1: 24.7, short: true };
  }
  F.slot = document.querySelector('#tb .kp').getBoundingClientRect();
}

// the swing: the dolly and the three-quarter orbit overlap smoothly and finish with positive velocity into the sweep
function swingState(sw) {
  const h = F.hero, e = F.end;
  const q1 = eIO(ramp(sw, 0.0, 0.56));
  const q2 = eInCont(ramp(sw, 0.16, 0.84));
  const u = lerp(TAN0, Math.tan((F.f1 * Math.PI) / 360), q1);
  const fovA = (2 * Math.atan(u) * 180) / Math.PI, distA = h.hgt / 2 / u;
  return {
    t: [0, 1, 2].map((i) => lerp(h.t[i], e.t[i], q2)),
    yaw: lerp(0, e.yaw, q2), pitch: lerp(0, e.pitch, q2),
    fov: lerp(fovA, e.fov, q2), dist: lerp(distA, e.dist, q2),
    sx: lerp(h.sx, 0, q2), sy: lerp(h.sy, 0, q2),
  };
}

// ---------------------------------------------------------------- the walk
// Keys at eye height (1.62 m above the floor). rest controls how gently the camera glides through a labelled room.
// Both the scan sweep (WK[0] -> WK[1]) and the interior walk run on one continuous C1-smooth spline with zero stops.
const EYE = 1.62;
function walkKeys() {
  const pf = (f) => (F.portrait ? Math.min(78, f * 1.22) : f); // a tall frame needs a wider lens, but not a fisheye
  const K = (p, t, fov, rest = 0, label = null) => ({ p: V3(p), t: V3(t), fov: pf(fov), rest, label });
  const sw = orbitPose(F.sweep), se = orbitPose(F.end);
  return [
    { p: se.p, t: se.t, fov: F.end.fov, rest: 0 },
    { p: sw.p, t: sw.t, fov: F.sweep.fov, rest: 0 },
    K([16.4, 1.75, 9.5], [14.3, 1.9, -4.0], 50, 30, ['±0.00', 'Through the cut', 'Section A-A, opened at eye height']),
    K([15.8, EYE, -0.4], [12.4, 1.85, -6.4], 54, 70, ['±0.00', 'The living room', '6.40 m high, the low sun of December']),
    K([11.9, EYE, -4.2], [7.0, 2.5, -7.1], 56, 0),
    K([8.4, 2.95, -7.05], [4.6, 5.0, -7.05], 58, 0),
    K([4.85, 3.2 + EYE, -7.0], [6.5, 4.6, -2.5], 58, 0),
    K([5.0, 3.2 + EYE, -5.5], [8.5, 4.5, -3.2], 56, 0),
    K([8.8, 3.2 + EYE, -4.6], [5.0, 4.3, 0.4], 52, 55, ['+3.20', 'The study', 'Books on the north wall, light from above']),
    K([10.42, 3.2 + EYE, -4.5], [13.4, 4.2, -2.0], 54, 0),
    K([11.5, 3.2 + EYE, -4.5], [13.6, 3.85, -1.6], 54, 65, ['+3.20', 'The upper lounge', 'Sunlit studio above the living space']),
    K([14.55, 3.2 + EYE, -4.8], [16.8, 0.3, -1.0], 56, 55, ['+3.20', 'Over the living room', 'From the mezzanine edge']),
    K([10.42, 3.2 + EYE, -4.5], [6.8, 4.3, -5.2], 56, 0),
    K([5.0, 3.2 + EYE, -5.4], [5.2, 4.4, -8.0], 58, 0),
    K([5.0, 3.2 + EYE, -6.95], [10.5, 2.0, -7.05], 58, 0),
    K([7.9, 3.4, -7.05], [12.0, 0.8, -7.05], 58, 0),
    K([10.9, EYE, -6.9], [8.0, 0.0, -5.8], 58, 0),
    K([8.4, 0.35, -5.8], [4.5, -2.4, -5.8], 58, 0),
    K([5.6, -3.2 + EYE, -4.8], [9.0, -2.0, -2.0], 56, 0),
    K([9.4, -3.2 + EYE, -4.75], [4.6, -2.5, -2.2], 52, 55, ['-3.20', 'The snug', 'A fire under the living room']),
    K([9.8, -3.2 + EYE, -2.25], [16.2, -2.2, -2.35], 54, 0),
    K([11.1, -3.2 + EYE, -2.15], [16.0, -2.3, -3.8], 54, 0),
    K([12.1, -3.2 + EYE, -1.9], [15.3, -2.5, -6.6], 52, 70, ['-3.20', 'The bedroom', 'Sleeping on the garden']),
    K([17.3, -3.2 + EYE, -2.95], [26, -1.8, -2.4], 54, 0),
    K([29.2, -1.5, 3.6], [15.0, 0.9, -2.8], 52, 70, ['-3.20', 'The lower garden', 'The house from below']),
    K([23.6, 1.9, 0.2], [14.0, 1.9, -2.4], 54, 0),
    K([20.4, 1.65, -1.0], [12.5, 1.9, -2.2], 54, 0),
    K([15.0, 1.65, -1.6], [14.6, 1.85, -7.6], 54, 0),
    K([15.8, 1.85, 8.8], [13.2, 2.1, -3.8], 50, 40, ['±0.00', 'Back through the cut', 'The house opens at A-A again']),
    { p: se.p, t: se.t, fov: F.end.fov, rest: 0 },
  ];
}
let WK = [], WALK = null;
function buildWalk() {
  WK = walkKeys();
  const n = WK.length;
  const pc = new THREE.CatmullRomCurve3(WK.map((k) => k.p), false, 'centripetal');
  const tc = new THREE.CatmullRomCurve3(WK.map((k) => k.t), false, 'centripetal');
  // Continuous C1-smooth scroll parameterization V[0..n-1] -> U[0..n-1] with strictly positive velocity everywhere
  const V = [0], U = [0];
  for (let i = 0; i < n - 1; i++) {
    let len;
    if (i === 0) {
      len = 210; // matched ~6.5 m/vh glide from F.end to F.sweep during the scan
    } else {
      const d = WK[i].p.distanceTo(WK[i + 1].p);
      const a0 = WK[i].t.clone().sub(WK[i].p).normalize(), a1 = WK[i + 1].t.clone().sub(WK[i + 1].p).normalize();
      const ang = (Math.acos(cl(a0.dot(a1), -1, 1)) * 180) / Math.PI;
      len = cl(9 * d + 0.55 * ang, 42, 145) + 0.65 * ((WK[i].rest || 0) + (WK[i + 1].rest || 0));
    }
    V.push(V[i] + len);
    U.push((i + 1) / (n - 1));
  }
  const L = V[n - 1];
  const sec = [];
  for (let i = 0; i < n - 1; i++) sec.push((U[i + 1] - U[i]) / (V[i + 1] - V[i]));
  const M = new Array(n);
  M[0] = 0.95 * sec[0];
  M[n - 1] = 0.95 * sec[n - 2];
  for (let i = 1; i < n - 1; i++) {
    const hMean = 2 / (1 / sec[i - 1] + 1 / sec[i]);
    // Gently slow to 52% cruise speed through labelled rooms so they read clearly without ever freezing the scroll
    M[i] = (WK[i].rest > 0 ? 0.52 : 1.0) * hMean;
  }
  const stops = [];
  for (let i = 0; i < n; i++) {
    if (WK[i].label) {
      const span = Math.max(42, WK[i].rest * 0.95);
      stops.push({ i, v: V[i], a: V[i] - span, b: V[i] + span, label: WK[i].label });
    }
  }
  WALK = { pc, tc, V, U, M, stops, L, n };
  // where the camera passes the cut plane going in and coming out: the front half of the house is shown in between
  let inAt = null, outAt = null;
  for (let v = V[1]; v <= L; v += 0.5) if (walkPose(v).p.z < CUT - 0.35) { if (inAt === null) inAt = v; outAt = v; }
  WALK.inAt = inAt; WALK.outAt = outAt;
}
function walkPose(v) {
  const { pc, tc, V, U, M, L, n } = WALK;
  const vc = cl(v, 0, L);
  let i = n - 2;
  for (let j = 0; j < n - 1; j++) if (vc <= V[j + 1]) { i = j; break; }
  const h = Math.max(1e-6, V[i + 1] - V[i]), t = cl((vc - V[i]) / h), du = U[i + 1] - U[i];
  const m0 = (M[i] * h) / du, m1 = (M[i + 1] * h) / du;
  const t2 = t * t, t3 = t2 * t;
  const s = (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) + (t3 - t2) * m1;
  const u = cl(U[i] + du * cl(s, 0, 1), 0, 1);
  const idx = u * (n - 1), kIdx = Math.min(n - 2, Math.floor(idx)), kf = idx - kIdx;
  const fov = lerp(WK[kIdx].fov, WK[kIdx + 1].fov, eSine(kf));
  const p = pc.getPoint(u), tg = tc.getPoint(u);
  // shoot like an architectural photographer inside the house: level camera with vertical lens shift,
  // smoothly blended in between WK[1] (F.sweep) and WK[2] (Through the cut) and out at the end.
  const lv = idx <= 1 ? 0 : idx < 2 ? eIO(idx - 1) : idx <= n - 2 ? 1 : 1 - eIO(idx - (n - 2));
  const tl = new THREE.Vector3(tg.x, lerp(tg.y, p.y, lv), tg.z);
  const d = Math.hypot(tl.x - p.x, tl.z - p.z);
  const sy = cl(tg.y - tl.y, -0.42 * d, 0.42 * d);
  return { p, t: tl, fov, sx: 0, sy };
}

// ---------------------------------------------------------------- the story on the scroll (in screen heights)
const CH = {};
function chapters() {
  CH.swing = [0, 2.5];
  CH.sweep = [CH.swing[1], CH.swing[1] + WALK.V[1] / 100];
  CH.walk = [CH.sweep[1], CH.swing[1] + WALK.L / 100];
  CH.rev = [CH.walk[1], CH.walk[1] + 3.4];
  CH.end = [CH.rev[1], CH.rev[1] + 1.2];
  document.getElementById('track').style.height = `${(CH.end[1] + 1) * 100}vh`;
}
const SCAN1 = -60;
// Single C1-continuous forward scan trajectory from x = 25.5 across the house (to 3.4) and out through the hill (-60)
function forwardScanX(sp) {
  if (sp <= 0) return 40;
  if (sp >= 1) return SCAN1;
  if (sp <= 0.82) return lerp(25.5, 3.4, eInCont(sp / 0.82));
  const t = (sp - 0.82) / 0.18;
  // C1 slope match at sp = 0.82: d/dt = -22.1 * 0.7 * (0.18 / 0.82) = -3.40
  return 3.4 - 3.4 * t - 60.0 * t * t;
}
// everything the frame needs, from the scroll position y (in screen heights)
function story(y) {
  const S = { y };
  const p = (r) => cl((y - r[0]) / (r[1] - r[0]));
  S.sw = p(CH.swing); S.sweep = p(CH.sweep); S.walk = p(CH.walk); S.rev = p(CH.rev); S.end = p(CH.end);
  S.chapter = y < CH.swing[1] ? 'swing' : y < CH.sweep[1] ? 'sweep' : y < CH.walk[1] ? 'walk' : y < CH.rev[1] ? 'rev' : 'end';
  // the camera: swing hands directly into the continuous WALK spline at CH.swing[1]
  if (S.chapter === 'swing') S.pose = orbitPose(swingState(S.sw));
  else if (S.chapter === 'sweep' || S.chapter === 'walk') { S.wv = cl((y - CH.swing[1]) * 100, 0, WALK.L); S.pose = walkPose(S.wv); }
  else S.pose = orbitPose(swingState(1 - eInCont(S.rev)));
  // the scan plane: one unbroken C1 sweep forward across the house and hill, and one smooth sweep back at the end
  const sp = cl((y - 2.0) / (CH.sweep[1] - 2.0));
  S.scanIn = ramp(sp, 0.01, 0.08);
  if (S.chapter === 'swing' || S.chapter === 'sweep') S.scanX = forwardScanX(sp);
  else if (S.chapter === 'walk') S.scanX = -100;
  else S.scanX = S.rev < 0.58 ? lerp(-18, 30, eIO(ramp(S.rev, 0, 0.58))) : 40;
  S.scanLine = S.chapter === 'swing' || S.chapter === 'sweep'
    ? S.scanIn * (1 - ramp(sp, 0.84, 0.12))
    : S.chapter === 'rev' ? ramp(S.rev, 0, 0.05) * (1 - ramp(S.rev, 0.52, 0.08)) : 0;
  S.real = S.chapter === 'swing' ? S.scanIn > 0 : S.chapter === 'rev' ? S.rev < 0.62 : S.chapter !== 'end';
  // the sunbeams come in smoothly as the scan passes the south glass
  S.shaft = S.chapter === 'end' ? 0 : eSine(ramp(18.4 - S.scanX, 0, 6));
  // the front half of the house, while the camera is inside or in the garden
  S.front = S.chapter === 'walk' && S.wv > WALK.inAt && S.wv < WALK.outAt;
  // the sheet (notes, title block): the swing parameter decides, so it comes back on the way out
  const swv = S.chapter === 'swing' ? S.sw : S.chapter === 'rev' ? 1 - eInCont(S.rev) : S.chapter === 'end' ? 0 : 1;
  S.swv = swv;
  S.sheet = 1 - eSine(ramp(swv, 0.45, 0.16));
  S.tb = 1 - eSine(ramp(swv, 0.48, 0.14));
  S.sunLines = S.chapter === 'walk' ? 0 : S.chapter === 'rev' || S.chapter === 'end'
    ? Math.max(S.sheet, 0.5 * ramp(S.scanX - 18.6, 0, 4))
    : lerp(1, 0.5, ramp(S.sw, 0.45, 0.3)) * (1 - ramp(18.6 - S.scanX, 0, 4));
  return S;
}

// ---------------------------------------------------------------- build
const pieces = buildPieces();
await new Promise((r) => setTimeout(r, 20));
const drawing = createDrawing(renderer, pieces);
const ACC_COL = new THREE.Color(ACC);
window.__loader.p = 0.5;
await new Promise((r) => setTimeout(r, 20));
const look = createLook(renderer, solids().filter((b) => b[2] < CUT && b[5] > CUT && b[6] !== 'glass'));
const real = createReal(renderer, look, pieces, cam, { ao: !SMALL && !Q.has('noao'), shadowSize: SMALL ? 2048 : 4096 });
window.__loader.p = 0.7;
// the lit house renders below the drawing's resolution (the ink stays sharp at full resolution on top): 1.2x on a retina screen
const REAL_SCALE = Q.has('rs') ? +Q.get('rs') : SMALL ? 0.6 : DPR >= 2 ? 0.6 : 0.75;
function sizes() {
  frames();
  renderer.setSize(W, H, false);
  const s = drawing.resize();
  real.resize(s.x, s.y, REAL_SCALE);
  buildWalk(); chapters();
}
sizes();

// ---------------------------------------------------------------- the notes on the sheet (SVG, projected from the world every frame)
const NS = 'http://www.w3.org/2000/svg';
const svg = document.getElementById('ov');
const mk = (tag, a = {}, parent = svg) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); parent.appendChild(e); return e; };
const set = (e, a) => { for (const k in a) e.setAttribute(k, typeof a[k] === 'number' ? +a[k].toFixed(2) : a[k]); };
const v3 = new THREE.Vector3();
const P = (x, y, z = 0) => { v3.set(x, y, z).project(cam); return [((v3.x + 1) / 2) * W, ((1 - v3.y) / 2) * H]; };
let notes = [];
let tB = Infinity;
function clipStart(a, b, m) {
  let t = 0;
  for (const [k, lo, hi] of [[0, m, W - m], [1, m, H - m]]) {
    const d = b[k] - a[k];
    if (a[k] < lo && d > 0) t = Math.max(t, (lo - a[k]) / d);
    if (a[k] > hi && d < 0) t = Math.max(t, (hi - a[k]) / d);
  }
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), t];
}
function buildNotes() {
  svg.innerHTML = '';
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  notes = [];
  const pt = F.portrait;
  const R = pt ? 7 : 10;
  [['A', 3.85], ['B', 11.0], ['C', 18.25], ['D', 22.5]].forEach(([l, x], i) => {
    const g = mk('g');
    const ln = mk('line', { stroke: INK, 'stroke-width': 0.5, 'stroke-dasharray': '14 4 2 4', opacity: 0.6 }, g);
    const bub = mk('g', {}, g);
    mk('circle', { r: R, fill: PAPER, stroke: INK, 'stroke-width': 0.8 }, bub);
    const tx = mk('text', { 'text-anchor': 'middle', y: pt ? 2.8 : 3.6, style: pt ? 'font-size:7.5px' : 'font-size:10px' }, bub); tx.textContent = l;
    notes.push((b, S) => {
      const pl = eOut(ramp(b, 0.2 + i * 0.06, 0.75)), pb = eOut(ramp(b, 0.55 + i * 0.06, 0.35));
      const vis = S.sheet;
      if (vis <= 0.001) { g.setAttribute('opacity', 0); return; }
      const top = P(x, pt ? 11.2 : 9.3), bot = P(x, -5.2);
      set(ln, { x1: top[0], y1: top[1] + R, x2: lerp(top[0], bot[0], pl), y2: lerp(top[1] + R, bot[1], pl) });
      set(bub, { transform: `translate(${top[0].toFixed(1)} ${top[1].toFixed(1)}) scale(${(0.6 + 0.4 * pb).toFixed(3)})`, opacity: pb });
      set(g, { opacity: (pl > 0 ? 1 : 0) * vis });
    });
  });
  const LV = [[8.0, '+8.00', 'Clerestory'], [6.4, '+6.40', 'Roof'], [3.2, '+3.20', 'Study'], [0, '±0.00', 'Entrance'], [-3.2, '-3.20', 'Garden']];
  LV.forEach(([y, v, name], i) => {
    const g = mk('g');
    const ln = mk('line', { stroke: INK, 'stroke-width': 0.5 }, g);
    const tri = mk('path', { fill: 'none', stroke: INK, 'stroke-width': 0.8 }, g);
    const tx = mk('text', F.levels.short ? { 'text-anchor': 'end' } : {}, g); tx.textContent = F.levels.short ? v : `${v}  ${name.toUpperCase()}`;
    notes.push((b, S) => {
      const vis = S.sheet;
      if (vis <= 0.001) { g.setAttribute('opacity', 0); return; }
      const pl = eOut(ramp(b, 1.45 + i * 0.07, 0.45)), pt2 = eOut(ramp(b, 1.7 + i * 0.07, 0.3));
      const a = P(F.levels.x0, y), e = P(F.levels.x1, y);
      set(ln, { x1: a[0], y1: a[1], x2: lerp(a[0], e[0], pl), y2: lerp(a[1], e[1], pl) });
      const k = pt ? 0.65 : 1;
      set(tri, { d: `M${e[0].toFixed(1)} ${e[1].toFixed(1)} l${-5 * k} ${-8 * k} h${10 * k} z`, opacity: pt2 });
      if (F.levels.short) set(tx, { x: e[0] - 5, y: e[1] - 4, opacity: pt2 }); else set(tx, { x: e[0] + 10, y: e[1] - 3, opacity: pt2 });
      set(g, { opacity: (pl > 0 ? 1 : 0) * vis });
    });
  });
  // sun angles: they draw from the sun's side, stay through the swing, and hand over to the real beams in the sweep
  [[15.1, 11.0, 8.8, 3.22, '21 MAR  51°'], [21.4, 12.0, 18.3, 2.4, '21 JUN  72°'], [30.2, 11.6, 7.3, 0.02, '21 DEC  27°']].forEach(([x0, y0, x1, y1, label], i) => {
    const ln = mk('line', { stroke: ACC, 'stroke-width': 0.75, 'stroke-dasharray': '6 4' });
    const tx = mk('text', { class: 'sun' }); tx.textContent = label;
    notes.push((b, S) => {
      const vis = S.sunLines;
      if (vis <= 0.001) { ln.setAttribute('opacity', 0); tx.setAttribute('opacity', 0); return; }
      const p = eIO(ramp(b, 1.85 + i * 0.16, 0.8)), pl = ramp(b, 2.45 + i * 0.16, 0.3);
      const A = P(x0, y0), B = P(x1, y1);
      set(ln, { x1: A[0], y1: A[1], x2: lerp(A[0], B[0], p), y2: lerp(A[1], B[1], p), opacity: (p > 0 ? 1 : 0) * vis });
      const c = clipStart(A, B, pt ? 12 : 24), onEdge = c[2] > 0.001;
      set(tx, { x: c[0] + (onEdge ? -4 : 6), y: c[1] - 7, 'text-anchor': onEdge ? 'end' : 'start', opacity: pl * S.sheet });
    });
  });
  const dy = -6.2;
  [[3.7, 11.0, '7.30'], [11.0, 18.3, '7.30'], [18.3, 22.5, '4.20']].forEach(([x0, x1, label], i) => {
    const g = mk('g');
    const ln = mk('line', { stroke: INK, 'stroke-width': 0.6 }, g);
    const t0 = mk('line', { stroke: INK, 'stroke-width': 1.2 }, g), t1 = mk('line', { stroke: INK, 'stroke-width': 1.2 }, g);
    const tx = mk('text', { 'text-anchor': 'middle' }, g); tx.textContent = label;
    notes.push((b, S) => {
      const vis = S.sheet;
      if (vis <= 0.001) { g.setAttribute('opacity', 0); return; }
      const p = eOut(ramp(b, 2.0 + i * 0.12, 0.5)), q = ramp(b, 2.3 + i * 0.12, 0.3);
      const A = P(x0, dy), B = P(x1, dy), E = [lerp(A[0], B[0], p), lerp(A[1], B[1], p)];
      set(ln, { x1: A[0], y1: A[1], x2: E[0], y2: E[1] });
      set(t0, { x1: A[0] - 4, y1: A[1] + 4, x2: A[0] + 4, y2: A[1] - 4, opacity: q });
      set(t1, { x1: B[0] - 4, y1: B[1] + 4, x2: B[0] + 4, y2: B[1] - 4, opacity: q });
      set(tx, { x: (A[0] + B[0]) / 2, y: A[1] - 6, opacity: q });
      set(g, { opacity: (p > 0 ? 1 : 0) * vis });
    });
  });
  const RM = [[16.5, 1.85, 'LIVING'], [12.8, 4.42, 'UPPER LOUNGE'], [7.0, 4.42, 'STUDY'], [12.1, -1.45, 'BEDROOM'], [9.0, -2.0, 'SNUG'], [21.1, 2.35, 'TERRACE'], [0.6, 0.42, 'UPPER COURT'], [24.0, -2.75, 'LOWER GARDEN']];
  RM.forEach(([x, y, label], i) => {
    if (pt && (label === 'UPPER COURT' || label === 'LOWER GARDEN')) return;
    const tx = mk('text', { class: 'room', 'text-anchor': 'middle' }); tx.textContent = label;
    notes.push((b, S) => {
      const vis = 1 - eSine(ramp(S.swv, 0.48, 0.1));
      if (vis <= 0.001) { tx.setAttribute('opacity', 0); return; }
      const p = eOut(ramp(b, 2.15 + i * 0.05, 0.45)), A = P(x, y);
      set(tx, { x: A[0], y: A[1] + (1 - p) * 5, opacity: p * vis });
    });
  });
  // the scan plane, drawn as its outline in the world
  const sg = mk('g', { opacity: 0 });
  const poly = mk('polygon', { fill: 'rgba(232,93,4,0.08)', stroke: ACC, 'stroke-width': 1.2 }, sg);
  const knock = mk('rect', { fill: INK, stroke: ACC, 'stroke-width': 0.8, opacity: 0.94, rx: 0 }, sg);
  const st1 = mk('text', { class: 'sun' }, sg);
  st1.textContent = 'CAD CUT PLANE';
  const st2 = mk('text', { class: 'sun', style: 'fill:#f2efe7' }, sg);
  notes.push((b, S) => {
    const vis = S.scanLine * (S.chapter === 'rev' ? 0.6 : 1);
    if (vis <= 0.001 || S.scanX > 39 || S.scanX < -50) { sg.setAttribute('opacity', 0); return; }
    const x = S.scanX;
    const c = [P(x, -6.4, -9.6), P(x, 8.9, -9.6), P(x, 8.9, 0.4), P(x, -6.4, 0.4)];
    set(poly, { points: c.map((q) => q.map((v) => v.toFixed(1)).join(',')).join(' ') });
    const top = P(x, 9.4, 0.4);
    const tx = cl(top[0], 18, W - 188);
    const ty = cl(top[1], 86, H - 44);
    set(knock, { x: tx - 8, y: ty - 31, width: 128, height: 35 });
    set(st1, { x: tx, y: ty - 17 }); set(st2, { x: tx, y: ty - 4 }); st2.textContent = `X = ${x.toFixed(2)} M`;
    set(sg, { opacity: vis });
  });
}

// ---------------------------------------------------------------- the small print
const $ = (q) => document.querySelector(q);
const el = { brand: $('.brand'), cta: $('.cta'), lines: [...document.querySelectorAll('.head .ln > span')], head: $('.head'), sub: $('.sub'), chip: $('.chip'), hint: $('.hint'),
  tb: $('#tb'), frame: $('#tb .frame'), fades: [...document.querySelectorAll('#tb .fade')], t1: $('#tb .t1'), scale: $('#tb .scale'), kp: $('#kp'),
  room: $('.room'), stamp: $('#tb .stamp'), rlv: $('.room .lv'), rname: $('.room b'), rnote: $('.room .nt'), end: $('.end'), endLines: [...document.querySelectorAll('.end .ln > span')], endSub: $('.end .sub2'), endBtn: $('.end .btn'),
  cadMap: $('#cad-map'), cmLbl: $('#cm-lbl'), cmScan: $('#cm-scan'), cmDot: $('#cm-dot'), cmCone: $('#cm-cone'), cmZones: [...document.querySelectorAll('#cad-map .cm-zone')] };
let tbMode = 0, tbSwap = -9, hintMode = -1, hintSwap = -9, roomKey = '', roomSwap = -9, hoverTag = '';
const op = (e, v) => { if (e) e.style.opacity = (+v).toFixed(3); };

// Interactive CAD radar room jump targets
function jumpToStop(stopName, smooth = true) {
  for (const g of WALK.stops) {
    if (g.label[1] === stopName) {
      const targetY = CH.swing[1] + g.v / 100;
      window.scrollTo({ top: targetY * innerHeight, behavior: smooth && !REDUCED ? 'smooth' : 'auto' });
      return targetY;
    }
  }
  return null;
}
window.__jumpTo = jumpToStop;
el.cmZones.forEach((z) => {
  z.addEventListener('mouseenter', () => { hoverTag = z.dataset.tag || ''; });
  z.addEventListener('mouseleave', () => { hoverTag = ''; });
  z.addEventListener('click', (e) => { e.stopPropagation(); jumpToStop(z.dataset.stop); });
});

function hud(T, S) {
  const b = T - tB;
  op(el.brand, eOut(ramp(b, 0.1, 0.6)));
  const endIn = S.chapter === 'end' ? 1 : S.chapter === 'rev' ? ramp(S.rev, 0.86, 0.14) : 0;
  op(el.cta, eOut(ramp(b, 0.2, 0.6)) * (1 - ramp(endIn, 0, 0.25)));
  el.stamp.style.opacity = eOut(ramp(endIn, 0.55, 0.3)).toFixed(3);
  el.stamp.style.transform = `rotate(-8deg) scale(${(1.25 - 0.25 * eOut(ramp(endIn, 0.55, 0.3))).toFixed(3)})`;
  // the headline: each line slides up out of its own mask, and leaves as the scroll starts
  const out = S.chapter === 'swing' ? eIO(ramp(S.sw, 0, 0.1)) : 1;
  el.lines.forEach((ln, i) => {
    const s = eExpo(ramp(b, 0.45 + i * 0.17, 1.0));
    ln.style.transform = `translateY(${(125 * (1 - s)).toFixed(2)}%)`;
    ln.style.opacity = s > 0.005 ? '1' : '0';
  });
  el.head.style.transform = `translateY(${(-26 * out).toFixed(1)}px)`; op(el.head, b > 0.44 ? 1 - out : 0);
  el.sub.style.transform = `translateY(${(10 * (1 - eOut(ramp(b, 1.15, 0.6))) - 26 * out).toFixed(1)}px)`;
  op(el.sub, eOut(ramp(b, 1.15, 0.6)) * (1 - out));
  // the lens readout: a 35 mm equivalent focal length (24 mm high frame)
  const fov = cam.userData.fov, mm = 12 / Math.tan((fov * Math.PI) / 360), flat = fov < 1.2;
  el.chip.innerHTML = S.chapter === 'walk'
    ? `Eye height ${EYE.toFixed(2)} m &nbsp;/&nbsp; Lens <b>${Math.round(mm)} mm</b>`
    : `A-A &nbsp;/&nbsp; Lens <b>${Math.round(mm).toLocaleString('en-US')} mm</b> &nbsp;/&nbsp; ${flat ? '1:100' : 'Not to scale'}`;
  op(el.chip, eOut(ramp(b, 2.5, 0.5)) * (1 - ramp(S.end, 0.2, 0.4)));
  // the hint at the start of the page
  const hv = S.chapter === 'swing' ? eOut(ramp(b, 2.8, 0.5)) * (1 - ramp(S.sw, 0, 0.06)) : 0;
  op(el.hint, hv);
  el.hint.style.transform = `translate(-50%, ${REDUCED ? 0 : (Math.sin(T * 2.2) * 2.5).toFixed(2)}px)`;
  // the title block: draws its frame, then its text. Its scale stops being true the moment the lens opens.
  el.frame.style.clipPath = `inset(0 0 0 ${(100 * (1 - eIO(ramp(b, 0.55, 0.6)))).toFixed(2)}%)`;
  const m = flat ? 0 : 1;
  if (m !== tbMode) { tbMode = m; tbSwap = T; el.t1.textContent = m ? 'Section perspective' : 'Section A-A'; el.scale.textContent = m ? 'Not to scale' : 'Scale 1:100'; }
  const swapK = OFF || S.tb > 0.8 ? 1 : ramp(T - tbSwap, 0, 0.35), tv = eOut(ramp(b, 0.9, 0.5));
  el.fades.forEach((f) => op(f, tv * (f === el.t1 || f.classList.contains('rows') ? lerp(0.15, 1, swapK) : 1)));
  const tbVis = cl((S.tb - 0.38) / 0.62);
  op(el.tb, tbVis); op(el.kp, tbVis);
  // the room you are in, as the camera glides through each stop
  let rk = '', rv = 0, activeStop = '';
  if (S.chapter === 'walk') for (const g of WALK.stops) {
    const v = eSine(ramp(S.wv, g.a, 24)) * (1 - eSine(ramp(S.wv, g.b - 24, 24)));
    if (v > rv) { rv = v; rk = g.label.join('|'); activeStop = g.label[1]; }
  }
  if (rk && rk !== roomKey) { roomKey = rk; roomSwap = T; const [lv, name, note] = rk.split('|'); el.rlv.textContent = lv; el.rname.textContent = name; el.rnote.textContent = note; }
  op(el.room, rv);
  el.room.style.transform = `translateY(${(8 * (1 - rv)).toFixed(1)}px)`;

  // Live CAD section radar updates
  const camX = S.chapter === 'walk' ? cl(cam.position.x, 2.5, 28.5) : 13.5;
  const camY = S.chapter === 'walk' ? cl(cam.position.y, -2.6, 6.2) : 1.6;
  if (el.cadMap) {
    const mapVis = eOut(ramp(b, 1.8, 0.6)) * cl(1 - S.tb * 1.8) * (1 - ramp(S.end, 0.2, 0.4));
    op(el.cadMap, mapVis);
    el.cadMap.classList.toggle('interactive', mapVis > 0.25);
    el.cmLbl.textContent = hoverTag
      ? `JUMP // ${hoverTag}`
      : S.chapter === 'walk'
        ? `POS X:${cam.position.x.toFixed(1)} Y:${cam.position.y.toFixed(1)}M`
        : `SCAN X:${cl(S.scanX, -20, 30).toFixed(1)}M // ${Math.round(mm)}MM`;
    const sx = cl(S.scanX, 1.8, 28.2);
    set(el.cmScan, { x1: sx, x2: sx, opacity: S.scanLine > 0.01 ? 1 : 0.25 });
    set(el.cmDot, { cx: camX, cy: camY });
    if (el.cmCone) {
      const dx = S.pose.t.x - S.pose.p.x, dy = (S.pose.t.y - S.pose.p.y) + (S.pose.sy || 0);
      const ang = S.chapter === 'walk' ? Math.atan2(dy, dx) : Math.PI;
      const r = 3.8, sp = 0.38;
      const x1 = camX + Math.cos(ang - sp) * r, y1 = camY + Math.sin(ang - sp) * r;
      const x2 = camX + Math.cos(ang + sp) * r, y2 = camY + Math.sin(ang + sp) * r;
      el.cmCone.setAttribute('points', `${camX.toFixed(2)},${camY.toFixed(2)} ${x1.toFixed(2)},${y1.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)}`);
      set(el.cmCone, { opacity: S.chapter === 'walk' ? 1 : 0 });
    }
    el.cmZones.forEach((z) => z.classList.toggle('active', z.dataset.stop === activeStop));
  }

  // the end: the sheet is back, with the call to action
  const ev = S.chapter === 'end' ? 1 : S.chapter === 'rev' ? ramp(S.rev, 0.86, 0.14) : 0;
  el.end.style.visibility = ev > 0 ? 'visible' : 'hidden';
  el.endLines.forEach((ln, i) => { ln.style.transform = `translateY(${(110 * (1 - eOut(ramp(ev, 0.1 + i * 0.18, 0.6)))).toFixed(2)}%)`; });
  op(el.endSub, eOut(ramp(ev, 0.45, 0.4))); op(el.endBtn, eOut(ramp(ev, 0.6, 0.4)));
  el.endBtn.style.transform = `translateY(${(10 * (1 - eOut(ramp(ev, 0.6, 0.4)))).toFixed(1)}px)`;
}

// ---------------------------------------------------------------- the frame
let tReady = null;
function loaderStep(T) {
  const p = Math.min(window.__loader.p, cl((T - 0.6) / 1.0));
  if (OFF && window.__loader.p >= 1) { tReady = 1.6; tB = 1.8; }
  else if (p >= 1 && tReady === null) { tReady = T; tB = T + 0.2; }
  window.__drawLoader(T, p, tB < Infinity ? ramp(T - tB, 0, 0.95) : 0, F.slot);
}
let lastY = -1, dirty = true, curS = null;
function update(T, y, force = false) {
  loaderStep(T);
  const b = T - tB;
  const S = story(y); curS = S;
  placePose(S.pose);
  for (const n of notes) n(b, S);
  hud(T, S);
  const building = !(b > 3.8);
  if (building || Math.abs(y - lastY) > 1e-6 || dirty || force) {
    drawing.parts.front.visible = S.front; real.setFront(S.front);
    const nd = drawing.renderND(cam);
    let rr = null;
    if (S.real) rr = real.render(nd, S.front);
    drawing.compose(cam, {
      cAccent: ACC_COL,
      uEarth: eOut(ramp(b, 0.15, 0.85)),
      uLines: -1.6 + 2.7 * eOut(ramp(b, 0.25, 0.6)) + 26 * eIO(ramp(b, 0.85, 1.45)),
      uPoche: eIO(ramp(b, 0.5, 1.3)),
      uScanX: S.scanX, uScan: S.scanLine, uReal: S.real ? 1 : 0, uShaft: S.shaft, uSunDir: SUN_DIR,
      uSweepMode: 3, uTime: T,
      tReal: rr ? rr.color : null, tShaft: rr ? rr.shafts : null,
      uDpr: DPR, px: 1, dK: 1.6, uShaftK: F.portrait ? 0.65 : 1,
    });
    dirty = false;
  }
  lastY = y;
  window.__st = { T, y: +y.toFixed(3), b, chapter: S.chapter, fov: +cam.userData.fov.toFixed(2), pos: cam.position.toArray().map((v) => +v.toFixed(2)), scanX: +S.scanX.toFixed(2), front: S.front };
}

buildNotes();
addEventListener('resize', () => { sizes(); buildNotes(); dirty = true; });

// first frames behind the loader: build every shader (the drawing, the lit house, the beams) while nothing shows
update(0, 0, true);
update(0, CH.walk[0] + 0.5, true);
update(0, 0, true);
await document.fonts.ready;
window.__loader.p = 1;

// ---------------------------------------------------------------- design aids
// __frame(T, s): s is the scroll from 0 to 1 over the whole page. __at(y): y in screen heights. __ch: the chapters.
const total = () => CH.end[1];
let offT = 0, offY = 0;
window.__ch = CH;
window.__frame = (t, s) => new Promise((res) => { offT = t; offY = s * total(); update(t, offY, true); requestAnimationFrame(() => requestAnimationFrame(() => res(true))); });
window.__at = (t, y) => window.__frame(t, y / total());
window.__keys = () => WALK.stops.map((g) => ({ i: g.i, label: g.label[1], y: +(CH.swing[1] + g.v / 100).toFixed(3) }));
// the camera path against solid walls: every point closer than 0.18 m to a non-glass box
window.__checkPath = () => {
  const S = solids().filter((b) => b[6] !== 'glass'), hits = [];
  for (let v = WALK.V[1]; v <= WALK.L; v += 0.5) {
    const p = walkPose(v).p;
    for (const b of S) {
      const dx = Math.max(b[0] - p.x, 0, p.x - b[3]), dy = Math.max(b[1] - p.y, 0, p.y - b[4]), dz = Math.max(b[2] - p.z, 0, p.z - b[5]);
      if (Math.hypot(dx, dy, dz) < 0.18) { hits.push({ y: +(CH.swing[1] + v / 100).toFixed(2), p: p.toArray().map((q) => +q.toFixed(2)), box: b.slice(0, 6).map((q) => +q.toFixed(2)), kind: b[6] }); break; }
    }
  }
  return hits;
};
window.__bench = (n = 60, y0 = 0, y1 = total()) => {
  const gl = renderer.getContext(), px = new Uint8Array(4);
  renderer.info.autoReset = false; renderer.info.reset();
  const t0 = performance.now();
  for (let i = 0; i < n; i++) { update(9, lerp(y0, y1, i / (n - 1)), true); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
  const ms = (performance.now() - t0) / n;
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const out = { ms_per_frame: +ms.toFixed(2), buffer: [size.x, size.y], triangles_per_frame: Math.round(renderer.info.render.triangles / n), calls_per_frame: +(renderer.info.render.calls / n).toFixed(1) };
  renderer.info.autoReset = true;
  return out;
};
window.__ready = true;

let yCur = 0, last = performance.now();
function loop() {
  const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!OFF) {
    const T = (now - window.__T0) / 1000;
    const yT = scrollY / innerHeight;
    if (REDUCED) yCur = yT;
    else {
      yCur += (yT - yCur) * (1 - Math.exp(-dt * 6));
      if (Math.abs(yT - yCur) < 1e-4) yCur = yT;
    }
    update(T, yCur);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
