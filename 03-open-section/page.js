// The full demos: loader, the hero drawing itself, each direction's journey through the house, the section
// rendered in material and light, then the studio's closing section.
//
//   ?dir=a   Open the lens: the lens opens while the cut keeps its size, then a 3D tour, room by room and depth by depth.
//   ?dir=c   Down the stair: scroll down is down, the camera rides the stair to the living room and out to the pool.
//
// &p=0.4 freezes the page at 40% of its journey, &skip jumps past the loader (both for stills).
// Every moment below is placed in vh of scroll, so the pacing reads the same as checkpoint 1.

import * as THREE from 'three';
import { createEngine } from './engine.js';

const Q = new URLSearchParams(location.search);
const DIR = ['a', 'c'].includes(Q.get('dir')) ? Q.get('dir') : 'a';
document.body.dataset.dir = DIR;
document.querySelectorAll('.dirs a').forEach(a => a.classList.toggle('on', a.dataset.dir === DIR));

const E = createEngine(document.getElementById('gl'), document.getElementById('ov'));
const phone = () => E.W < 700;

// ---- camera states. rect: what must show on the cut. at: where its middle sits on screen. ----
const HERO = { rect: [-10.9, -5.8, 37.9, 22.2], at: [0.5, 0.5], lens: 1.6, vp: [13.4, 4.2], cut: -4.6, fog: 34 };
const HERO_P = { rect: [-0.6, -2.2, 17.4, 10.6], at: [0.5, 0.6], lens: 1.6, vp: [8.4, 4.2], cut: -4.6, fog: 34 };
const PAN = [-11.6, -9.2, 37.2, 18.8];          // the hero's frame, moved down so the house sits in the middle
const at = (rect, lens, vp, fog = 20, cut = -4.6) => ({ rect, lens, vp, cut, fog });
const PH_L = { rect: [-1.5, -2.5, 13.5, 11], at: [0.5, 0.46], lens: 1.6, vp: [6, 4.2], cut: -4.6, fog: 34 };
const PH_R = { rect: [17.0, -2.5, 32.0, 11], at: [0.5, 0.46], lens: 1.6, vp: [24.5, 4.2], cut: -4.6, fog: 34 };

const PLAN = {
  a: {
    total: 1600,
    desk: [HERO, { ...HERO, rect: PAN, lens: 64 },
      at([-1.84, -3.1, 24.64, 12.1], 60, [13.4, 3.5], 30),     // the whole house in sectional perspective
      at([1.6, 0.2, 17.8, 9.4], 66, [9.5, 4.9]),               // 01: the stair landing
      at([0.2, 6.0, 9.6, 11.0], 68, [4.2, 8.2]),               // 02: the kitchen & lantern
      at([4.6, 2.6, 15.2, 6.9], 68, [9.6, 4.9]),               // 03: the bedrooms & patio
      at([10.0, -0.8, 23.6, 7.0], 66, [17.4, 1.6], 22),        // 04: the living room
      at([17.5, -2.6, 33.5, 7.2], 56, [25.5, 1.6], 26),        // 05: the garden and the pool
      HERO, HERO],
    phone: [HERO_P, { ...HERO_P, at: [0.5, 0.5], lens: 64 },
      at([4.5, 0, 14.5, 11], 60, [10.0, 3.6], 30),
      at([6.4, -0.5, 12.6, 10.5], 66, [9.5, 4.9]),
      at([0.8, 6.0, 8.4, 11.0], 68, [4.2, 8.2]),
      at([6.4, 2.8, 13.4, 6.8], 68, [9.8, 4.9]),
      at([14.0, -0.6, 22.4, 7.0], 66, [18.0, 1.6], 22),
      at([22.0, -2.4, 32.0, 6.0], 56, [27.0, 1.6], 26),
      PH_L, PH_R],
    // [from vh, to vh, from state, to state]
    track: [[45, 255, 0, 1], [255, 375, 1, 2], [430, 560, 2, 3], [620, 740, 3, 4], [800, 920, 4, 5], [980, 1100, 5, 6], [1160, 1280, 6, 7], [1330, 1440, 7, 8], [1450, 1550, 8, 9]],
    colour: [135, 355], flatAgain: 1400,
    stops: [555, 735, 915, 1095, 1270],
    captions: [[50, 250, 'The lens opens. The cut keeps its size.'], [265, 425, 'Material and sunlight sweep into the 3D section.'], [440, 615, 'Closer, at the stair spine.'],
      [630, 795, 'Up to the kitchen and roof lantern, at street level.'], [810, 975, 'Down to the bedroom floor and courtyard patio.'], [990, 1155, 'Down again, to the 6.25m living room.'],
      [1170, 1325, 'Out to the limestone terrace and pool.'], [1340, 1445, 'Back to the 1:100 section plane.'], [1450, 1700, 'The same section, rendered in material and light.']],
    rooms: [[470, 615, '01 // CUT A–A · STAIR SPINE', 'The stair', 'One flight per level · 16 risers of 206 mm · a rooflight over the top'],
      [660, 795, '02 // LEVEL +6.60M · STREET LEVEL', 'The kitchen & lantern', 'Street level · terrazzo island, oak floor · double-height lantern over the dining table'],
      [840, 975, '03 // LEVEL +3.30M · COURTYARD', 'The bedroom & patio', 'The stair lands here · bedroom and study off the landing · cypress courtyard beyond the glass'],
      [1020, 1155, '04 // LEVEL ±0.00M · DOUBLE HEIGHT', 'The living room', '6.25 m high · oak library wall · full-height glass to the garden'],
      [1200, 1325, '05 // LEVEL ±0.00M · TERRACE', 'The garden & pool', 'Cantilevered 6 m pool on the limestone terrace · the valley below']],
  },
  c: {
    total: 1250,
    desk: [HERO, { ...HERO, rect: PAN, lens: 12 },
      at([0.4, 3.25, 11.6, 11.2], 72, [6.0, 8.2], 18),
      at([4.6, 1.4, 15.0, 8.0], 74, [9.8, 4.9], 18),
      at([9.0, -0.9, 21.6, 7.0], 74, [14.6, 1.6], 18),
      at([18.0, -2.4, 31.5, 6.6], 66, [25.0, 1.6], 24),
      HERO, HERO],
    phone: [HERO_P, { ...HERO_P, at: [0.5, 0.5], lens: 12 },
      at([2.6, 6.0, 9.6, 9.6], 70, [6.1, 8.2], 18),
      at([6.4, 3.0, 13.4, 6.6], 72, [9.8, 4.9], 18),
      at([13.5, 0.2, 18.5, 6.9], 72, [15.6, 1.6], 18),
      at([22.5, -2.0, 31.5, 5.0], 66, [27.0, 1.6], 24),
      PH_L, PH_R],
    track: [[40, 90, 0, 1], [90, 200, 1, 2], [280, 440, 2, 3], [520, 680, 3, 4], [760, 880, 4, 5], [940, 1050, 5, 6], [1060, 1160, 6, 7]],
    colour: [60, 200], flatAgain: 1010,
    stops: [155, 240, 480, 720, 905],
    captions: [[45, 200, 'Into the stair and roof lantern, at street level.'], [285, 520, 'Scroll down is down · past the courtyard patio.'], [525, 760, 'The living room, double height.'],
      [765, 940, 'Across the limestone floor and out to the pool.'], [945, 1055, 'Back up, to the whole house.'], [1060, 1400, 'The same section, rendered in material and light.']],
    rooms: [[200, 280, 'LEVEL +6.60M // STREET LEVEL', 'Street level & lantern', 'The kitchen · terrazzo and oak · double-height lantern over the table'],
      [440, 520, 'LEVEL +3.30M // BEDROOM FLOOR', 'The bedroom & patio', 'The stair lands here · bedroom, study, and glazed cypress courtyard'],
      [680, 760, 'LEVEL ±0.00M // LIVING ROOM', 'The living room', '6.25 m high · library wall · glass to the garden'],
      [880, 940, 'LEVEL ±0.00M // TERRACE', 'The garden & pool', 'A 6 m cantilevered pool on the slope']],
  },
}[DIR];
const T = PLAN.total;
document.querySelector('.track').style.height = T + 'vh';

const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function mix(A, B, t) {
  const ta = Math.tan(THREE.MathUtils.degToRad(A.lens / 2)), tb = Math.tan(THREE.MathUtils.degToRad(B.lens / 2));
  return {
    cx: lerp(A.cx, B.cx, t), cy: lerp(A.cy, B.cy, t), frameH: lerp(A.frameH, B.frameH, t),
    vp: A.vp.map((v, i) => lerp(v, B.vp[i], t)),
    lens: THREE.MathUtils.radToDeg(2 * Math.atan(lerp(ta, tb, t))),   // perspective grows evenly, not all at the start
    cut: lerp(A.cut, B.cut, t), fog: lerp(A.fog, B.fog, t),
  };
}
function stateAt(vh) {
  const list = (phone() ? PLAN.phone : PLAN.desk).map(E.resolve);
  let st = list[0];
  for (const [v0, v1, i, j] of PLAN.track) if (vh >= v0) st = mix(list[i], list[j], smooth(0, 1, (vh - v0) / (v1 - v0)));
  return st;
}
const colourAt = vh => (vh < PLAN.colour[0] ? -1000 : vh > PLAN.colour[1] ? 1000 : lerp(-12, 38.5, ease((vh - PLAN.colour[0]) / (PLAN.colour[1] - PLAN.colour[0]))));

// ---- what the page says as it goes ----
const capEl = document.getElementById('caption'), hudEl = document.getElementById('hud'), roomEl = document.getElementById('room');
const heroEl = document.querySelector('.hero'), fadeEls = document.querySelectorAll('.fade-on-scroll');
const cadKeyEl = document.getElementById('cad-key'), ckVpEl = document.getElementById('ck-vp');
const ckLblEl = document.getElementById('ck-lbl'), ckLensEl = document.getElementById('ck-lens');
const ckBtns = cadKeyEl ? Array.from(cadKeyEl.querySelectorAll('.ck-nav button')) : [];

let capNow = '', roomNow = '';
function words(vh, st, closing) {
  heroEl.style.opacity = 1 - smooth(2, 25, vh);
  heroEl.style.transform = `translateY(${-24 * smooth(2, 25, vh)}px)`;
  fadeEls.forEach(el => (el.style.opacity = (1 - smooth(2, 20, vh)) + (el.classList.contains('once') ? 0 : smooth(PLAN.flatAgain + 20, PLAN.flatAgain + 60, vh) * (1 - closing))));
  const c = PLAN.captions.find(([a, b]) => vh >= a && vh < b);
  const txt = c ? c[2] : '';
  if (txt !== capNow) { capNow = txt; capEl.classList.remove('show'); if (txt) requestAnimationFrame(() => { capEl.textContent = txt; capEl.classList.add('show'); }); }
  const rIdx = PLAN.rooms.findIndex(([a, b]) => vh >= a && vh < b);
  const r = rIdx >= 0 ? PLAN.rooms[rIdx] : null;
  const key = r ? r[3] : '';
  if (key !== roomNow) {
    roomNow = key; roomEl.classList.remove('show');
    if (r) setTimeout(() => { roomEl.innerHTML = `<span class="k mono">${r[2]}</span><b>${r[3]}</b><span class="m mono">${r[4]}</span>`; roomEl.classList.add('show'); }, FREEZE !== null ? 0 : 160);
  }
  const fmt = v => v.toFixed(2);
  const lensTxt = st.lens < 10 ? st.lens.toFixed(1) : Math.round(st.lens);
  if (DIR === 'a') {
    hudEl.innerHTML = vh > PLAN.flatAgain + 30
      ? `SEC A–A // <b>1:100 MATERIAL SECTION</b>`
      : `SEC A–A // LENS <b>${lensTxt}°</b> · CUT Z <b>${fmt(st.cut)}M</b>`;
  }
  if (DIR === 'c') {
    let lv = st.vp[1] - 1.6;
    lv = [0, 3.3, 6.6].find(L => Math.abs(lv - L) < 0.12) ?? lv;
    hudEl.innerHTML = vh < 170 || vh > PLAN.flatAgain - 20
      ? (vh > PLAN.flatAgain + 30 ? 'SEC A–A // <b>1:100 MATERIAL SECTION</b>' : 'SEC A–A // <b>SCALE 1:100</b>')
      : `LEVEL <b>${lv > 0.05 ? '+' + fmt(lv) : '±0.00'}M</b> · CUT Z <b>${fmt(st.cut)}M</b>`;
  }
  if (ckLblEl && ckLensEl) {
    ckLblEl.textContent = `SEC A-A // CUT Z ${fmt(st.cut)}M`;
    ckLensEl.textContent = `LENS ${lensTxt}°`;
  }
  if (ckBtns.length) {
    const activeStop = DIR === 'a' ? rIdx : (rIdx >= 0 ? rIdx + 1 : (vh >= 80 && vh < 200 ? 0 : -1));
    ckBtns.forEach((btn, i) => btn.classList.toggle('on', i === activeStop));
  }
  // the closing section takes over: the drawing's words step back
  for (const el of [capEl, hudEl, roomEl, cadKeyEl, document.querySelector('.dirs')]) if (el) el.style.visibility = closing > 0.98 ? 'hidden' : '';
  document.body.style.setProperty('--closing', closing.toFixed(3));
}

// ---- the loop ----
const track = document.querySelector('.track'), closingEl = document.getElementById('closing');
let vTarget = 0, vh = 0, built = false, last = performance.now(), dirty = true;
const FREEZE = Q.has('p') ? Number(Q.get('p')) * T : null;
const readScroll = () => { const max = track.offsetHeight - innerHeight; vTarget = max > 0 ? THREE.MathUtils.clamp(scrollY / max, 0, 1) * T : 0; };
window.__at = v => v / T * (track.offsetHeight - innerHeight);     // scroll position of a moment, for the recorder & radar buttons
addEventListener('scroll', () => { readScroll(); dirty = true; }, { passive: true });
addEventListener('resize', () => { E.resize(); readScroll(); dirty = true; });

// Interactive 3D radar room buttons
ckBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const idx = Number(btn.dataset.idx);
    const targetVh = PLAN.stops[idx];
    if (typeof targetVh === 'number') {
      window.scrollTo({ top: window.__at(targetVh), behavior: 'smooth' });
      dirty = true;
    }
  });
});

function getRadarKey(vh, closing) {
  if (phone() || !cadKeyEl || !ckVpEl || !built) return null;
  const a = smooth(45, 95, vh) * (1 - smooth(PLAN.flatAgain - 45, PLAN.flatAgain, vh)) * (1 - smooth(0.05, 0.45, closing));
  cadKeyEl.classList.toggle('show', a > 0.05);
  if (a <= 0.01) return null;
  const r = ckVpEl.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height, a };
}

let build = { reveal: 1000, gridA: 1, sweep: null };
window.__gaps = [];                                                // frames slower than 60 ms, with where on the journey they happened
function frame(now) {
  if (built && now - last > 60) window.__gaps.push([Math.round(vh), Math.round(now - last)]);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (FREEZE !== null) vTarget = FREEZE;
  const k = FREEZE !== null ? 1 : 1 - Math.exp(-dt * 5.5);       // weighted: the camera catches up with the scroll
  const moving = Math.abs(vTarget - vh) > 1e-3;
  if (moving) vh += (vTarget - vh) * k; else vh = vTarget;
  const closing = THREE.MathUtils.clamp(1 - closingEl.getBoundingClientRect().top / innerHeight, 0, 1);
  if (moving || dirty || build.active) {
    dirty = false;
    const st = stateAt(vh), colourX = colourAt(vh);
    E.place({ ...st, reveal: build.reveal, colourX });
    // the drawing's notes belong to the flat drawing: there at the start, and again at the end
    const flat = (1 - smooth(20, 120, vh)) + smooth(PLAN.flatAgain, PLAN.flatAgain + 50, vh);
    const notesA = build.gridA * THREE.MathUtils.clamp(flat, 0, 1);
    const labelsA = notesA * (1 - smooth(-0.3, 0, st.cut));   // never on an elevation
    const pen = vh > PLAN.colour[0] && vh < PLAN.colour[1] ? 1 : 0;
    E.notes({ gridA: notesA, levelsA: notesA, labelsA: build.gridA * labelsA * smooth(23, 25, E.ppm), sweep: build.sweep, colourPen: pen });
    if (vh < 5 || vh > PLAN.flatAgain + 40) document.documentElement.style.setProperty('--m', E.ppm.toFixed(2) + 'px');   // one metre on the cut, for the bar scale
    const key = getRadarKey(vh, closing);
    E.render(key);
    if (built) words(vh, st, closing);
  } else if (built) words(vh, stateAt(vh), closing);
  requestAnimationFrame(frame);
}

// ---- loader, then the hero draws itself ----
const loader = document.getElementById('loader'), count = document.getElementById('count'), bar = document.getElementById('bar');
async function start() {
  document.documentElement.classList.add('locked');
  if (Q.has('skip') || FREEZE !== null) document.documentElement.classList.add('instant');
  const t0 = performance.now(), MIN = Q.has('skip') ? 0 : 1700;
  let ready = false;
  (function tick() {
    const u = Math.min(1, (performance.now() - t0) / MIN || 1);
    const lv = 10.1 * ease(u);
    count.textContent = lv < 0.005 ? '±0.00' : '+' + lv.toFixed(2);
    bar.style.transform = `scaleX(${ease(u)})`;
    if (u < 1 || !ready) requestAnimationFrame(tick);
  })();
  await document.fonts.ready;
  E.place({ ...stateAt(0), reveal: 1000, colourX: 1000 });
  E.buildSprites(E.ppm);
  E.place({ ...stateAt(0), reveal: 1000, colourX: 1000 });
  E.precompile();
  E.render();              // one frame with everything on, colour too, behind the loader, so no shader is built later
  E.place({ ...stateAt(0), reveal: 1000, colourX: -1000 });
  ready = true;
  const wait = Math.max(0, MIN - (performance.now() - t0));
  await new Promise(r => setTimeout(r, wait + (Q.has('skip') ? 0 : 250)));
  loader.classList.add('gone');

  if (Q.has('skip') || FREEZE !== null) {
    build = { reveal: 1000, gridA: 1, sweep: null, active: false };
    finish();
  } else {
    build = { reveal: [-12, -12, -12], gridA: 0, sweep: 1, active: true };
    const b0 = performance.now() + 300;
    (function grow(now) {
      const t = (now - b0) / 1000;
      const plot = delay => (t < delay ? -12 : lerp(-12, 38.5, ease(Math.min(1, (t - delay) / 1.7))));
      build.reveal = [plot(0), plot(0.45), plot(0.9)];
      build.sweep = t < 1.7 ? 1 : Math.max(0, 1 - (t - 1.7) / 0.3);
      build.gridA = smooth(1.9, 2.6, t);
      if (t > 2.0) document.body.classList.add('words-in');
      if (t < 2.9) requestAnimationFrame(grow);
      else { build = { reveal: 1000, gridA: 1, sweep: null, active: false }; dirty = true; finish(); }
    })(performance.now());
  }
  requestAnimationFrame(frame);
}
function finish() {
  document.body.classList.add('words-in', 'built');
  document.documentElement.classList.remove('locked');
  built = true; dirty = true;
  readScroll();
  if (Q.has('closing')) closingEl.scrollIntoView();     // for stills of the closing section
  window.__built = true;
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__ready = true; }));
}
start();
