// C · The face is the product. Kiln & Course, an invented brick brand. KC-06 Diaper: burnt headers
// standing 60 mm proud in a diaper lattice.
// The 1:20 detail is laid course by course, the sun arrives at the drawing's angle
// (every header's small hatched shadow becomes a real one), then drops low and rakes across the
// wall until the pattern stands out, the lens inspects the proud headers, and steps through the open oak door.
import { createStage, run, THREE, span, ease, smooth, lerp, CONVENTION } from '../engine/elevation.js';

const S = createStage({ hatch: 0.045, hatchPhone: 0.05, drawSpan: [0, 6.2], wipe: [-5, 7], soft: 0.7, envScale: 0.55 });

const h0 = S.house(0, { relief: 0.06, brick: 0xc2ab90, header: 0x7e5a4a, first: 'frame' });
S.house(6, { relief: 0.06, brick: 0xc2ab90, header: 0x7e5a4a, door: 'right', interior: false });
S.street(0, 30, false);
S.figure(3.25, 1.6, 1, true);
S.aimSun(3.5, 2.5, 14);
S.hemi.intensity = 0.28; S.sun.intensity = 4.0;

const KEYS = [
  { p: 0, t: [2.3, 2.55, 0], fh: 5.9, fov: 2, phone: { t: [2.7, 2.9, 0], fh: 5.9, minW: 3.7 } },
  { p: 18, t: [2.3, 2.55, 0], fh: 5.9, fov: 2, phone: { t: [2.7, 2.9, 0], fh: 5.9, minW: 3.7 } },
  { p: 92, t: [2.7, 2.4, 0], fh: 5.2, fov: 10, yaw: 16, pitch: -3, phone: { t: [2.9, 2.4, 0], minW: 3.6 } },
  { p: 205, t: [2.8, 2.4, 0], fh: 5.0, fov: 12, yaw: 20, pitch: -3, phone: { t: [3.0, 2.4, 0], minW: 3.5 } },
  { p: 292, t: [3.2, 2.5, 0], fh: 4.4, fov: 14, yaw: 24, pitch: -4, phone: { minW: 3.0 } },
  { p: 375, t: [6.0, 2.05, 0], fh: 1.05, fov: 28, yaw: 26, pitch: -8, phone: { fh: 1.2, minW: 0.75 } },
  { p: 455, t: [1.35, 1.78, -1.15], fh: 2.55, fov: 52, yaw: 8, pitch: -1 },
  { p: 525, t: [2.55, 1.66, -3.65], fh: 2.25, fov: 56, yaw: -20, pitch: -1 },
];

// low, nearly along the wall from the left: each header throws a long streak to the right
const RAKE = new THREE.Vector3(-2.0, 0.62, 0.42).normalize();
const sunDir = new THREE.Vector3();
const warm = new THREE.Color(0xffcf96), white = new THREE.Color(0xfff1dc);

run(S, {
  length: 540,
  heroOut: [14, 64],
  radar: {
    ox: 0,
    zones: [
      { id: 'street', label: '1:20 WALL', tag: 'DIAPER RELIEF 1:20', at: 92, u0: -4.0, u1: -1.2 },
      { id: 'porch', label: 'RAKE SUN', tag: 'RAKING LIGHT', at: 280, u0: -1.2, u1: 0.0 },
      { id: 'parlour', label: 'HEADER', tag: '60MM PROUD HEADER', at: 375, u0: 0.0, u1: 2.0 },
      { id: 'atrium', label: 'PORCH', tag: 'PORCH REVEAL', at: 455, u0: 2.0, u1: 6.4 },
      { id: 'garden', label: 'INTERIOR', tag: 'SUNLIT HALLWAY', at: 520, u0: 6.4, u1: 17.8 },
    ],
  },
  frame(p) {
    S.setCam(S.camAt(p, KEYS));
    S.U.uDepthCue.value = span(p, 22, 80) * (1 - span(p, 120, 180));
    const u = span(p, 100, 198);
    S.U.uSweep.value.z = u <= 0 ? -60 : u >= 1 ? 60 : lerp(-4.8, 6.5, smooth(u));
    const m = ease(span(p, 208, 292));
    sunDir.copy(CONVENTION).lerp(RAKE, m).normalize();
    S.setSun(sunDir);
    S.sun.color.copy(white).lerp(warm, m);
    S.sun.intensity = lerp(4.0, 4.4, m);
    h0.setDoor(smooth(span(p, 395, 465)));
  },
  beats: [
    { from: 52, to: 108, html: '<span class="n">01 &nbsp;·&nbsp; Drawn at 1:20</span><p>Every brick on the sheet. Every header stands 60 mm proud, so every header has its own shadow.</p>' },
    { from: 116, to: 202, html: '<span class="n">02 &nbsp;·&nbsp; The same sun</span><p>Cast at 45 degrees on paper. Cast at 45 degrees on the wall.</p>' },
    { from: 214, to: 298, html: '<span class="n">03 &nbsp;·&nbsp; Low sun</span><p>Head on, the wall reads flat. When the light rakes, <em>the diaper comes out.</em></p>' },
    { from: 315, to: 410, html: '<span class="n">04 &nbsp;·&nbsp; KC-06 Diaper</span><p>Burnt headers in a buff stretcher bond, 60 mm proud of the face.</p><div class="row"><div><span>Header</span>215 × 102 × 65</div><div><span>Proud</span>60 mm</div><div><span>Lattice</span>1.35 × 0.9 m</div></div>' },
    { from: 430, to: 570, html: '<span class="n">05 &nbsp;·&nbsp; Into the reveal</span><p>The bond turns into the deep porch reveal and opens into the sunlit <em>oak hallway.</em></p><div class="row"><div><span>Bond</span>Flemish diaper</div><div><span>Mortar</span>10 mm lime</div><div><span>Sample</span>3-brick box</div></div><a class="pill solid" href="#">Order a sample panel</a>' },
  ],
});
