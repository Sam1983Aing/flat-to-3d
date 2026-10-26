// A · One door. No. 7, a narrow brick townhouse between faint neighbours.
// The elevation drafts itself, gains relief, takes the sun at the drawing's own angle
// (hatching becomes shade), the sun moves on, the oak front door swings open, and the
// lens walks through the entrance hall, reception parlour, double-height kitchen atrium,
// and out to the walled rear courtyard garden.
import { createStage, run, THREE, span, ease, smooth, lerp, CONVENTION } from '../engine/elevation.js';

const S = createStage({ hatch: 0.11, hatchPhone: 0.12, drawSpan: [0, 12.2], wipe: [-11, 9], soft: 1.1 });

const h = S.house(0, {});
S.house(-6, { faint: true, par: 9.4, roof: 'none', door: 'right', brick: 0xa9a49b });
S.house(-12, { faint: true, par: 9.4, roof: 'none', first: 'frame', brick: 0x9c5e48 });
S.house(6, { faint: true, par: 10.6, roof: 'none', first: 'frame', door: 'right', brick: 0x9c5e48 });
S.house(12, { faint: true, par: 10.6, roof: 'none', brick: 0xa9a49b });
S.street(-40, 40);
S.figure(2.9, 2.2, 1, true);
S.aimSun(2.5, 4.5, 24);

// levels, on the sheet only
const pins = document.getElementById('pins');
[[0, '±0.00', 'Street'], [0.45, '+0.45', 'Ground floor'], [3.6, '+3.60', 'First floor'], [6.6, '+6.60', 'Second floor'], [9.1, '+9.10', 'Roof'], [12.0, '+12.00', 'Roof storey']]
  .forEach(([y, a, b]) => {
    const el = pins.appendChild(document.createElement('div'));
    el.className = 'lv'; el.innerHTML = `<em></em><i></i><b>${a}</b><span>${b}</span>`;
    S.pin(el, [6.25, y, 0.5]);
  });

const KEYS = [
  { p: 0, t: [1.2, 6.3, 0], fh: 15.4, fov: 2, phone: { t: [3, 7.0, 0], fh: 14, minW: 8.4 } },
  { p: 18, t: [1.2, 6.3, 0], fh: 15.4, fov: 2, phone: { t: [3, 7.0, 0], fh: 14, minW: 8.4 } },
  { p: 115, t: [3.1, 5.3, 0], fh: 13.2, fov: 16, yaw: 13, pitch: -5, phone: { t: [3.2, 5.4, 0], minW: 9.4 } },
  { p: 228, t: [2.9, 5.0, 0], fh: 12.6, fov: 18, yaw: 9, pitch: -5, phone: { t: [3.0, 5.0, 0], minW: 9.0 } },
  { p: 300, t: [2.5, 4.0, 0], fh: 10.2, fov: 26, yaw: 6, pitch: -6, phone: { minW: 7.4 } },
  { p: 385, t: [1.35, 1.78, -1.15], fh: 2.65, fov: 54, yaw: 4, pitch: -1 },
  { p: 455, t: [2.30, 1.66, -3.45], fh: 2.20, fov: 56, yaw: -20, pitch: -1 },
  { p: 540, t: [3.85, 1.62, -4.55], fh: 2.35, fov: 58, yaw: -24, pitch: -2 },
  { p: 640, t: [3.15, 1.78, -9.80], fh: 2.55, fov: 58, yaw: -4, pitch: 1 },
  { p: 740, t: [3.05, 1.74, -14.60], fh: 2.45, fov: 56, yaw: -5, pitch: 2 },
];

const LATE = new THREE.Vector3(-1.45, 0.62, 0.78).normalize(); // 16:40, the sun lower and more from the side
const sunDir = new THREE.Vector3();
const warm = new THREE.Color(0xffd6a0), white = new THREE.Color(0xfff1dc);

run(S, {
  length: 760,
  heroOut: [14, 70],
  radar: {
    ox: 0,
    zones: [
      { id: 'street', label: 'STREET', tag: 'ELEVATION ±0.00M', at: 95, u0: -4.0, u1: 0.0 },
      { id: 'porch', label: 'PORCH', tag: 'THRESHOLD +0.45M', at: 385, u0: 0.0, u1: 2.0 },
      { id: 'parlour', label: 'PARLOUR', tag: 'PARLOUR +0.45M', at: 525, u0: 2.0, u1: 6.4 },
      { id: 'atrium', label: 'ATRIUM', tag: 'ATRIUM +0.45M', at: 635, u0: 6.4, u1: 12.0 },
      { id: 'garden', label: 'GARDEN', tag: 'COURTYARD +0.30M', at: 735, u0: 12.0, u1: 17.8 },
    ],
  },
  frame(p) {
    S.setCam(S.camAt(p, KEYS));
    S.U.uDepthCue.value = span(p, 22, 90) * (1 - span(p, 150, 205));
    // the sun arrives at the drawing's angle: hatching becomes shade
    const u = span(p, 118, 212);
    S.U.uSweep.value.z = u <= 0 ? -60 : u >= 1 ? 60 : lerp(-14, 10, smooth(u));
    // then it moves on, and the shadows slide
    const m = ease(span(p, 226, 300));
    sunDir.copy(CONVENTION).lerp(LATE, m).normalize();
    S.setSun(sunDir);
    S.sun.color.copy(white).lerp(warm, m);
    S.sun.intensity = lerp(3.4, 3.2, m);
    S.hemi.intensity = lerp(0.52, 0.48, m);
    // swing the fluted oak front door and rear Crittall garden doors open as the camera walks through
    h.setDoor(smooth(span(p, 345, 420)));
    h.setGardenDoor(smooth(span(p, 575, 665)));
  },
  beats: [
    { from: 72, to: 128, html: '<span class="n">01 &nbsp;·&nbsp; Relief</span><p>The porch sits a metre back. The balcony stands 900 mm out. The drawing already said so.</p>' },
    { from: 140, to: 222, html: '<span class="n">02 &nbsp;·&nbsp; The sun</span><p>Every shadow on the sheet was cast at 45 degrees. So is <em>this</em> sun.</p>' },
    { from: 236, to: 304, html: '<span class="n">03 &nbsp;·&nbsp; 16:40, late October</span><p>Then it moves, and the shadows move with it.</p>' },
    { from: 332, to: 438, html: '<span class="n">04 &nbsp;·&nbsp; The threshold</span><p>Three stone steps up. The fluted oak door swings inward into the <em>entrance hall.</em></p>' },
    { from: 462, to: 568, html: '<span class="n">05 &nbsp;·&nbsp; Reception parlour</span><p>Afternoon sun comes through the three-pane street window onto wide oak boards and floor-to-ceiling <em>bookcases.</em></p><div class="row"><div><span>Level</span>+0.45 m</div><div><span>Ceiling</span>3.00 m oak</div><div><span>Joinery</span>European oak</div></div>' },
    { from: 584, to: 672, html: '<span class="n">06 &nbsp;·&nbsp; Kitchen &amp; dining atrium</span><p>The ceiling opens to 6.4 metres under a glazed rooflight lantern above the <em>travertine island.</em></p><div class="row"><div><span>Atrium</span>6.40 m high</div><div><span>Island</span>Honed stone</div><div><span>Glazing</span>Crittall steel</div></div>' },
    { from: 686, to: 790, html: '<span class="n">07 &nbsp;·&nbsp; No. 7 Albion Row</span><p>Steel doors fold back to a walled Yorkstone courtyard and a multi-stem tree at the <em>rear.</em></p><div class="row"><div><span>Plot</span>6.0 × 17.8 m</div><div><span>Floor area</span>186 m²</div><div><span>Status</span>For sale</div></div><a class="pill solid" href="#">Book a viewing</a>' },
  ],
});
