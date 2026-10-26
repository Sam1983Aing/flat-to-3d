// B · The row. Albion Row, six townhouses for a developer, plots numbered with their status.
// The street elevation drafts itself house by house, turns to a view along the row,
// one sun crosses the six facades at the drawing's own angle, then the camera goes to plot 04
// (the open one, outlined in orange), swings open its oak door, and walks inside its parlour and atrium.
import { createStage, run, THREE, span, ease, smooth, lerp, CONVENTION } from '../engine/elevation.js';

const S = createStage({ hatch: 0.16, hatchPhone: 0.2, drawSpan: [-2, 47], drawDir: [1, 0.9], wipe: [-12, 26], soft: 1.6 });

const V = [
  { par: 10.0 }, { par: 10.6, first: 'frame', door: 'right', brick: 0xb9a48c }, { par: 10.0 },
  { par: 10.6, first: 'frame', door: 'right', brick: 0xb9a48c }, { par: 10.0 }, { par: 10.6, first: 'frame', door: 'right', brick: 0xb9a48c },
];
const houses = V.map((v, i) => S.house(i * 6, { ...v, setback: i % 2 ? -0.3 : 0, accent: i === 3, interior: i === 3 }));
const plot4 = houses[3];
S.house(-6, { faint: true, par: 12.4, roof: 'none', first: 'frame', brick: 0x9c5e48 });
S.house(36, { faint: true, par: 12.4, roof: 'none', brick: 0x9c5e48 });
S.street(-60, 80);
S.figure(8.2, 2.0, 1, false); S.figure(25.6, 2.3, 1, true); S.figure(26.1, 2.1, 0.94, true);
S.tree(32.6, 2.6, 7.4, 2.1);
S.aimSun(18, 5, 34);

const pins = document.getElementById('pins');
const STATUS = ['Sold', 'Sold', 'Reserved', 'Available', 'Sold', 'Available'];
STATUS.forEach((s, i) => {
  const el = pins.appendChild(document.createElement('div'));
  el.className = 'plot' + (i === 3 ? ' on' : '');
  el.innerHTML = `<b>0${i + 1}</b><span>${s}</span>`;
  S.pin(el, [i * 6 + 3, -0.7, 3.5]);
});

const KEYS = [
  { p: 0, t: [18, 8.2, 0], fh: 21.5, fov: 2, phone: { t: [18, 2, 0], minW: 37 } },
  { p: 18, t: [18, 8.2, 0], fh: 21.5, fov: 2, phone: { t: [18, 2, 0], minW: 37 } },
  { p: 110, t: [17, 5.4, 0], fh: 15.5, fov: 14, yaw: 22, pitch: -4, phone: { t: [22, 5.2, 0], minW: 14, yaw: 28 } },
  { p: 252, t: [16.5, 5.2, 0], fh: 14.8, fov: 16, yaw: 16, pitch: -4, phone: { t: [17, 5, 0], minW: 13 } },
  { p: 330, t: [21, 5.0, -0.3], fh: 12.4, fov: 28, yaw: 0, pitch: -4, phone: { minW: 7.6 } },
  { p: 405, t: [22.65, 1.78, -1.45], fh: 2.65, fov: 54, yaw: -4, pitch: -1 },
  { p: 480, t: [21.70, 1.66, -3.75], fh: 2.20, fov: 56, yaw: 20, pitch: -1 },
  { p: 560, t: [20.15, 1.62, -4.85], fh: 2.35, fov: 58, yaw: 24, pitch: -2 },
  { p: 645, t: [20.85, 1.78, -10.10], fh: 2.55, fov: 58, yaw: 4, pitch: 1 },
];

const LATE = new THREE.Vector3(-1.45, 0.62, 0.78).normalize();
const sunDir = new THREE.Vector3();
const warm = new THREE.Color(0xffd6a0), white = new THREE.Color(0xfff1dc);

run(S, {
  length: 660,
  heroOut: [14, 64],
  radar: {
    ox: 18,
    mirrorX: true,
    zones: [
      { id: 'street', label: 'ROW', tag: 'ALBION ROW 1:100', at: 105, u0: -4.0, u1: 0.0 },
      { id: 'porch', label: 'PLOT 04', tag: 'PLOT 04 PORCH', at: 405, u0: 0.0, u1: 2.2 },
      { id: 'parlour', label: 'PARLOUR', tag: 'PARLOUR +0.45M', at: 550, u0: 2.2, u1: 6.6 },
      { id: 'atrium', label: 'ATRIUM', tag: 'ATRIUM +0.45M', at: 635, u0: 6.6, u1: 12.2 },
      { id: 'garden', label: 'GARDEN', tag: 'SOUTH GARDEN', at: 655, u0: 12.2, u1: 17.8 },
    ],
  },
  frame(p) {
    S.setCam(S.camAt(p, KEYS));
    pins.style.opacity = (1 - span(p, 96, 136)).toFixed(3);
    S.U.uDepthCue.value = span(p, 22, 95) * (1 - span(p, 160, 230));
    // one sun crossing six facades, at the drawing's angle
    const u = span(p, 118, 255);
    S.U.uSweep.value.z = u <= 0 ? -60 : u >= 1 ? 60 : lerp(-12, 28, smooth(u));
    const m = ease(span(p, 262, 332));
    sunDir.copy(CONVENTION).lerp(LATE, m).normalize();
    S.setSun(sunDir);
    S.sun.color.copy(white).lerp(warm, m);
    S.sun.intensity = lerp(3.4, 3.2, m);
    plot4.setDoor(smooth(span(p, 365, 435)));
    plot4.setGardenDoor(smooth(span(p, 565, 640)));
  },
  beats: [
    { from: 62, to: 122, html: '<span class="n">01 &nbsp;·&nbsp; Albion Row</span><p>Six brick houses, each with a zinc roof room. Drawn at 1:100.</p>' },
    { from: 128, to: 252, html: '<span class="n">02 &nbsp;·&nbsp; One sun</span><p>The drawing\'s shadows were cast at 45 degrees. The sun comes in at the same angle, <em>one house at a time.</em></p>' },
    { from: 268, to: 350, html: '<span class="n">03 &nbsp;·&nbsp; Plot 04</span><p>Three bedrooms and a garden to the south. Outlined in <em>orange.</em></p><div class="row"><div><span>Bedrooms</span>3</div><div><span>Floor area</span>142 m²</div><div><span>Status</span>Available</div></div>' },
    { from: 368, to: 465, html: '<span class="n">04 &nbsp;·&nbsp; Open door</span><p>Plot 04 is the show house. Step up three stones and through the <em>oak door.</em></p>' },
    { from: 482, to: 575, html: '<span class="n">05 &nbsp;·&nbsp; Inside Plot 04</span><p>Wide oak boards, floor-to-ceiling library joinery and a limestone hearth in the <em>front parlour.</em></p>' },
    { from: 588, to: 690, html: '<span class="n">06 &nbsp;·&nbsp; South garden atrium</span><p>Double-height kitchen and dining room opening onto the walled courtyard.</p><div class="row"><div><span>Plot</span>04 of 06</div><div><span>Garden</span>South-facing</div><div><span>Status</span>Available</div></div><a class="pill solid" href="#">Reserve plot 04</a>' },
  ],
});
