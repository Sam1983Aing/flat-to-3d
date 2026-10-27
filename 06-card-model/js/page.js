// Desk at Night, the whole page: the loader, the hero building itself on the desk, the dive to eye height,
// the turn (the card becomes the house, the lamp becomes the sun), the walk in to the study, and back to the desk.
// Everything on screen is a function of two numbers: t (seconds since the page started) and the scroll.
// Live, t is the clock. With ?rec the recorder sets both, one frame at a time (window.__rig.frame).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as D from './desk.js';
import * as RW from './real.js';
import { SWEEP, sweepSide } from './sweep.js';

const Q = new URLSearchParams(location.search);
const REC = Q.has('rec');
const L = window.__loader;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const sstep = (t) => t * t * (3 - 2 * t);
const eio = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const eio4 = (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - (-2 * t + 2) ** 4 / 2);
const eout = (t) => 1 - (1 - t) ** 3;
const eout4 = (t) => 1 - (1 - t) ** 4;
const eback = (t) => { const c = 1.6; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
const pw = (x, pts) => { if (x <= pts[0][0]) return pts[0][1]; for (let i = 0; i < pts.length - 1; i++) { const [a, ya] = pts[i], [b, yb] = pts[i + 1]; if (x <= b) return lerp(ya, yb, sstep((x - a) / (b - a))); } return pts[pts.length - 1][1]; };
const CAMQ = Q.get('cam') ? Q.get('cam').split(',').map(Number) : null;
const step = (p) => { if (!REC) L.target = Math.max(L.target, p); };

let phone = innerWidth < 760 || innerWidth / innerHeight < 0.8;

// ---------------------------------------------------------------- renderer and scene
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: REC });
let dpr = Q.has('dpr') ? +Q.get('dpr') : REC ? devicePixelRatio : Math.min(devicePixelRatio, phone ? 2 : 1.75);
renderer.setPixelRatio(dpr);
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
D.setAniso(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
step(0.3);

await Promise.all(['500 20px "IBM Plex Mono"', '600 20px "Chakra Petch"'].map((f) => document.fonts.load(f).catch(() => {})));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0a09);
const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const M = D.makeMaterials(env);
// a copy of the card materials for the little model on the study desk, which lives in the daylight world
const keep = (m) => { const c = m.clone(); c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey; return c; };
const Mtiny = {};
for (const k of ['card', 'cardPlain', 'acetate', 'board', 'burn', 'figure', 'mat', 'rule', 'lamp', 'lampInner', 'lampRim', 'bulb', 'spring']) Mtiny[k] = keep(M[k]);
step(0.42);

const desk = D.deskProps(M);
const house = D.cardHouse(M);
const layers = D.contourLayers(M);
const trees = D.modelTrees(M);
const figs = D.modelFigures(M);
scene.add(desk.group, house, ...layers, ...trees, ...figs);
step(0.52);

// the daylight world
const skyEnv = RW.skyEnv(renderer);
const R = RW.realMaterials(skyEnv);
for (const k in Mtiny) { Mtiny[k].envMap = skyEnv; }
const real = RW.realHouse(R);
const land = RW.terrain(R, phone);
const rtrees = RW.realTrees(R, phone);
const stage = RW.staging(R, Mtiny);
const sky = RW.skyDome(SWEEP);
sky.visible = false;
scene.add(real.group, land, rtrees, stage);
step(0.68);

// materials that fade in during the build get their own copies
const own = (m) => { const c = keep(m); c.userData.base = { transparent: m.transparent, opacity: m.opacity }; return c; };
for (const l of layers) l.material = l.material.map(own);
for (const c of house.children) c.material = own(c.material);
const treeMat = own(M.card);
for (const t of trees) t.material = treeMat;
const heroFig = figs[figs.length - 1];
heroFig.material = own(heroFig.material);
function fade(mat, k) {
  const b = mat.userData.base, tr = b.transparent || k < 0.999;
  if (mat.transparent !== tr) { mat.transparent = tr; mat.needsUpdate = true; }
  mat.opacity = b.opacity * k; mat.depthWrite = !b.transparent && k > 0.5;
}

// two sides of one front (see sweep.js): studio environment (walls, pinned drawings, desk props) gets seam: 0 so it never discards or draws an orange ring
const studioMeshes = sweepSide(desk.group, 'card', { seam: 0 });
const cardMeshes = [house, ...layers, ...trees, ...figs].flatMap((o) => sweepSide(o, 'card'));
const realMeshes = [real.group, land, rtrees, stage].flatMap((o) => sweepSide(o, 'real'));
const buildSet = new Set([...layers, ...trees, ...figs]);
for (const o of [...cardMeshes, ...studioMeshes]) for (const m of [].concat(o.material)) m.fog = false;
scene.fog = new THREE.FogExp2(new THREE.Color(0.08, 0.075, 0.07), 0.00035);

// ---------------------------------------------------------------- light
// directional order matters (sweep.js): the sun casts shadows so it comes first, then the moon, then the fill
const lamp = desk.lamp;
SWEEP.C.value.copy(lamp.bulbPos);
const sun = new THREE.DirectionalLight(0xffc690, 4.0);
sun.position.copy(V(12, -1, -2)).addScaledVector(RW.SUN_DIR, 220); sun.target.position.set(12, -1, -2);
sun.castShadow = true;
sun.shadow.mapSize.set(phone ? 2048 : 4096, phone ? 2048 : 4096);
Object.assign(sun.shadow.camera, { left: -46, right: 46, top: 40, bottom: -40, near: 120, far: 330 });
sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.035;
scene.add(sun, sun.target);

const spot = new THREE.SpotLight(0xffe1c0, 0, 0, 0.78, 0.55, 2);
spot.position.copy(lamp.bulbPos).addScaledVector(lamp.aim, 1.5);
spot.target.position.copy(lamp.aimAt);
spot.castShadow = true;
spot.shadow.mapSize.set(phone ? 2048 : 4096, phone ? 2048 : 4096);
spot.shadow.camera.near = 8; spot.shadow.camera.far = 240;
spot.shadow.bias = -0.00005; spot.shadow.normalBias = 0.025;

// Silver-blue moonlight from the studio window (ramps up when the desk lamp clicks off at the end)
const moon = new THREE.DirectionalLight(0x8eb4e8, 0.5);
moon.position.set(90, 110, -150); moon.target.position.set(10, -6, 0);
scene.add(moon, moon.target);

// Warm bounce fill from the camera's side so card cut faces and contour risers keep rich shadow detail
const fill = new THREE.DirectionalLight(0xffd8b2, 0);
fill.position.set(130, 42, 105); fill.target.position.set(10, -5, 0);
scene.add(fill, fill.target);

const hemi = new THREE.HemisphereLight(0x64748c, 0xb89e82, 0.28); // night: cool sky / warm board bounce
const hemiDay = new THREE.HemisphereLight(0xb8cce6, 0x918270, 0.38);
scene.add(hemi, hemiDay);

// the lamp's spill on the wall behind, soft and without shadows
const spill = new THREE.SpotLight(0xffd9b0, 0, 0, 0.95, 1, 2);
spill.position.copy(lamp.head); spill.target.position.set(-72, 18, -60);

// Warm interior hearth glow inside the 1:100 card model that softly illuminates the card rooms when the desk lamp clicks off
const cardInner = new THREE.SpotLight(0xffae5e, 0, 22, 1.15, 0.95, 1.6);
cardInner.position.set(11.8, 3.8, -3.6);
cardInner.target.position.set(17.5, -0.5, -2.0);
scene.add(spot, spot.target, spill, spill.target, cardInner, cardInner.target);

// lamps inside the real house, on in the afternoon + dedicated warm pool of light from the miniature lamp on the study desk
for (const [x, y, z, i, dist] of [
  [12.9, 1.45, -6.6, 4.2, 0],
  [7.8, 1.7, -1.65, 3.0, 0],
  [12.95, -2.4, -7.2, 2.2, 0],
  [16.05, -2.4, -7.2, 2.2, 0],
  [7.2, 5.4, -2.0, 2.0, 0],
  [6.22, 4.58, -1.46, 0.95, 2.5], // miniature anglepoise lamp illuminating the 1:100 model on the study desk
]) {
  const l = new THREE.PointLight(0xffc98a, i, dist, 2); l.position.set(x, y, z); scene.add(l);
}

function setLamp(k, endGlow = 0) {
  spot.intensity = 6800 * k;
  spill.intensity = 3400 * k;
  M.bulb.emissiveIntensity = 16 * k;
  M.lampInner.emissiveIntensity = 0.52 * k;
  M.lampRim.emissiveIntensity = 1.65 * k;
  hemi.intensity = 0.28 + 0.34 * k;
  fill.intensity = 0.58 * k + 0.14 * endGlow;
  moon.intensity = lerp(1.38, 0.32, k);
  cardInner.intensity = 52 * endGlow * (1 - k);
  // dim studio environment reflections on acetate and metal when the desk lamp is switched off
  for (const c of house.children) {
    if (c.material && c.material.userData?.base?.transparent) c.material.envMapIntensity = 0.32 + 1.58 * k;
  }
  M.rule.envMapIntensity = 0.45 + 0.95 * k;
  M.blade.envMapIntensity = 0.5 + 1.15 * k;
}

// ---------------------------------------------------------------- the scroll, in vh
// hero 0-40, dive 40-460, the turn 460-880, the walk 880-1500 (the study holds to 1520), back to the desk 1520-1960, the end
const CH = { dive: [40, 460], turn: [460, 880], walk: [880, 1500], back: [1520, 1960], end: [1960, 2030] };
const GARDEN = D.groundAt(D.HERO_FIG[0], D.HERO_FIG[1]); // the ground the little figure stands on

// ---------------------------------------------------------------- camera
// The dive: keys of position and target. The walk and the way back: keys of position and a look point,
// turned into yaw and pitch so the camera can turn round on the spot without flipping.
const KEYS = {
  desk: {
    pre:  { p: V(114, 49, 98), t: V(7.5, -2.2, 5.5), f: 30 },
    hero: { p: V(87, 31, 73), t: V(1.2, -3.6, 1.4), f: 27.8, fp: V(13, -2, -1), ap: 0.00028, mb: 0.009 },
    path: [
      { p: V(87, 31, 73), t: V(1.2, -3.6, 1.4) },
      { p: V(64, 15, 46), t: V(6, -2.5, 0) },
      { p: V(50, 3, 24), t: V(10, 0, -2) },
      { p: V(46, -2.0, 16), t: V(11, 1.2, -3) },
      { p: V(41.5, -2.9, 10.5), t: V(11, 1.6, -3.4) },
      { p: V(37.6, -3.2, 6.6), t: V(11, 1.8, -3.5) },
    ],
    eye: { f: 50, fp: V(18.3, 1, -2), ap: 0.0004, mb: 0.008 },
    turnF: 50, walkF: [50, 56], backF: 56,
  },
  phone: {
    pre:  { p: V(108, 57, 96), t: V(11.5, -1.2, 0.5), f: 48 },
    hero: { p: V(88, 41, 76), t: V(9.2, 0.6, 2.0), f: 46.5, fp: V(12, -1, -1), ap: 0.00026, mb: 0.009 },
    path: [
      { p: V(88, 41, 76), t: V(9.2, 0.6, 2.0) },
      { p: V(66, 18, 50), t: V(11, 0, -1) },
      { p: V(52, 4, 27), t: V(11.5, 1, -2.5) },
      { p: V(47, -2, 16), t: V(12, 2, -3) },
      { p: V(43.5, -2.9, 12), t: V(12, 2.3, -3.3) },
      { p: V(40.5, -3.2, 9.5), t: V(12, 2.4, -3.5) },
    ],
    eye: { f: 62, fp: V(18.3, 1, -2), ap: 0.00045, mb: 0.009 },
    turnF: 64, walkF: [64, 68], backF: 68,
  },
};
// where the figure stood: the turn ends here, and the walk starts here
const SPOT = { p: V(33.0, -3.15, 6.3), t: V(12, 2.0, -3.2) };
const WALK = [
  SPOT,
  { p: V(28.4, -1.3, 3.7), t: V(13, 2.1, -2.4) },
  { p: V(23.8, 1.62, -0.55), t: V(12, 2.1, -2.2) },      // up on the terrace
  { p: V(20.3, 1.66, -1.05), t: V(10, 1.95, -2.6) },     // at the open sliding door
  { p: V(16.6, 1.66, -1.25), t: V(9.2, 1.72, -3.8) },    // in the living room, level gaze across the staged room
  { p: V(14.5, 1.74, -1.45), t: V(7.8, 1.85, -3.5) },    // holding in the living room before ascending
  { p: V(12.6, 3.35, -1.0), t: V(6.5, 3.85, -2.0) },     // rising cleanly through the double-height void
  { p: V(11.2, 4.74, -0.78), t: V(5.8, 4.18, -1.5) },    // over the mezzanine balustrade
  { p: V(9.2, 4.68, -0.72), t: V(5.9, 4.08, -1.48) },
  { p: V(7.62, 4.46, -0.86), t: V(6.18, 4.04, -1.48) },  // arriving at the study desk: the 1:100 model centered in frame
  { p: V(7.02, 4.28, -1.04), t: V(6.16, 4.02, -1.48) },  // close dwell on the lit miniature model on the desk
  { p: V(10.15, 4.58, -0.55), t: V(18, 4.22, 0.2) },     // turned round: the double height, the glass, the afternoon sun
];
const BACK = [
  WALK[WALK.length - 1],
  { p: V(11.35, 4.74, -0.75), t: V(20, 3.5, -0.6) },     // clears the 4.28 m mezzanine balustrade rail with 46 cm margin
  { p: V(14.2, 3.25, -0.95), t: V(23, 2.6, -0.6) },
  { p: V(16.8, 2.02, -1.05), t: V(26, 2.2, -0.5) },
  { p: V(18.5, 1.82, -0.95), t: V(25, 2.1, 0.4) },       // out through the sliding door
  { p: V(22.2, 2.65, 1.6), t: V(15.2, 2.0, -2.4) },      // pivoting on the terrace so the house stays in frame
  { p: V(27.5, 5.6, 5.8), t: V(12.2, 1.2, -2.6) },       // pulling back facing the house
  { p: V(44, 13.5, 25), t: V(10, -1, -1.8) },
  { p: V(63, 21.5, 49), t: V(5, -2.8, 0.2) },
];
// a shot: positions on a curve, the look as yaw and pitch on a second curve, the scroll spent by an effort
// (distance, divided by the height above the garden when it moves through scale, plus a cost for turning)
function makeShot(keys, { scale = false, turnCost = 2.2 } = {}) {
  const P = new THREE.CatmullRomCurve3(keys.map((k) => k.p), false, 'centripetal');
  let prev = null;
  const A = new THREE.CatmullRomCurve3(keys.map((k) => {
    const d = k.t.clone().sub(k.p); let yaw = Math.atan2(d.z, d.x);
    if (prev !== null) { while (yaw - prev > Math.PI) yaw -= Math.PI * 2; while (yaw - prev < -Math.PI) yaw += Math.PI * 2; }
    prev = yaw; return V(yaw, Math.atan2(d.y, Math.hypot(d.x, d.z)), 0);
  }), false, 'catmullrom', 0.5);
  const N = 800, eff = new Float32Array(N + 1);
  let p0 = P.getPoint(0), a0 = A.getPoint(0);
  for (let i = 1; i <= N; i++) {
    const p1 = P.getPoint(i / N), a1 = A.getPoint(i / N);
    const h = Math.max(0.2, (p0.y + p1.y) / 2 - GARDEN);
    eff[i] = eff[i - 1] + p1.distanceTo(p0) / (scale ? h + 3 : 1) + turnCost * Math.hypot(a1.x - a0.x, a1.y - a0.y) / (scale ? 4 : 1);
    p0 = p1; a0 = a1;
  }
  for (let i = 0; i <= N; i++) eff[i] /= eff[N];
  const uAt = (s) => { let lo = 0, hi = N; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (eff[m] < s) lo = m; else hi = m; } return (lo + clamp((s - eff[lo]) / Math.max(1e-6, eff[hi] - eff[lo]))) / N; };
  return {
    at(s) { const u = uAt(clamp(s)), p = P.getPoint(u), a = A.getPoint(u); return { p, dir: V(Math.cos(a.y) * Math.cos(a.x), Math.sin(a.y), Math.cos(a.y) * Math.sin(a.x)) }; },
  };
}
const look = (k) => ({ p: k.p.clone(), dir: k.t.clone().sub(k.p).normalize() });
let K, pathP, pathT, turnP, turnT, effort = null, walkShot, backShot;
// The dive moves through scale, not distance: a step of the path costs its length divided by the lens height,
// so going from 32 cm to 16 cm takes as much scroll as going from 3.2 cm to 1.6 cm.
function measurePath() {
  const N = 600;
  effort = new Float32Array(N + 1);
  let prev = pathP.getPoint(0);
  for (let i = 1; i <= N; i++) {
    const q = pathP.getPoint(i / N), h = Math.max(0.2, (prev.y + q.y) / 2 - GARDEN);
    effort[i] = effort[i - 1] + q.distanceTo(prev) / (h + 3); prev = q;
  }
  for (let i = 0; i <= N; i++) effort[i] /= effort[N];
}
function pathU(d) { // d (0..1 of the dive) to the curve's own parameter
  const N = effort.length - 1;
  let lo = 0, hi = N;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (effort[m] < d) lo = m; else hi = m; }
  const f = (d - effort[lo]) / Math.max(1e-6, effort[hi] - effort[lo]);
  return (lo + clamp(f)) / N;
}
function useKeys() {
  K = phone ? KEYS.phone : KEYS.desk;
  pathP = new THREE.CatmullRomCurve3(K.path.map((k) => k.p), false, 'centripetal');
  pathT = new THREE.CatmullRomCurve3(K.path.map((k) => k.t), false, 'centripetal');
  const eyeK = K.path[K.path.length - 1];
  const midK1 = phone
    ? { p: V(36.8, -3.22, 7.9), t: V(11.8, 2.55, -3.4) }
    : { p: V(35.2, -3.22, 6.5), t: V(11.4, 2.38, -3.35) };
  const midK2 = phone
    ? { p: V(34.5, -3.18, 6.9), t: V(11.9, 2.22, -3.28) }
    : { p: V(33.9, -3.18, 6.38), t: V(11.8, 2.14, -3.25) };
  turnP = new THREE.CatmullRomCurve3([eyeK.p, midK1.p, midK2.p, SPOT.p], false, 'centripetal');
  turnT = new THREE.CatmullRomCurve3([eyeK.t, midK1.t, midK2.t, SPOT.t], false, 'centripetal');
  measurePath();
  walkShot = makeShot(WALK, { turnCost: 1.1 });
  backShot = makeShot([...BACK, { p: K.hero.p, t: K.hero.t }], { scale: true, turnCost: 1.8 });
}
useKeys();
const camera = new THREE.PerspectiveCamera(K.hero.f, innerWidth / innerHeight, 0.1, 4000);
camera.position.copy(K.hero.p); camera.lookAt(K.hero.t);

// ---------------------------------------------------------------- post
const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: phone ? 0 : 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(dpr);
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
let gtao = null;
const glassy = [house.children[1], ...real.group.children.filter((m) => m.material === R.glass), ...real.door.children.filter((m) => m.material === R.glass), sky];
if (!phone && !Q.has('noao')) {
  gtao = new GTAOPass(scene, camera, innerWidth * dpr, innerHeight * dpr);
  gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.6, thickness: 1.4, scale: 1.15, samples: 16 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
  gtao.blendIntensity = 0.95;
  const r0 = gtao.render.bind(gtao);
  gtao.render = (...a) => { const v = glassy.map((m) => m.visible); glassy.forEach((m) => (m.visible = false)); r0(...a); glassy.forEach((m, i) => (m.visible = v[i])); };
  composer.addPass(gtao);
}
const bokeh = new BokehPass(scene, camera, { focus: 140, aperture: 0.0005, maxblur: 0.01 });
composer.addPass(bokeh);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.34, 0.48, 2.15);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, res: { value: new THREE.Vector2(innerWidth, innerHeight) }, seed: { value: 0 }, vig: { value: 0.52 }, grainK: { value: 0.02 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 res; uniform float seed, vig, grainK; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      vec2 q = vUv - .5; q.x *= res.x / res.y;
      c *= mix(1., 1. - smoothstep(.30, 1.10, length(q)), vig);
      float l = dot(c, vec3(.299, .587, .114));
      c += (vec3(-.009, -.001, .016) * (1. - l) + vec3(.010, .004, -.007) * l);
      c += (hash(floor(vUv * res) + seed) - .5) * grainK;
      gl_FragColor = vec4(c, 1.);
    }`,
});
composer.addPass(grade);
step(0.82);

// compile both worlds now, behind the loader, so the first frames of the turn do not stall
SWEEP.R.value = 60;
renderer.compile(scene, camera);
renderer.shadowMap.needsUpdate = true;
composer.render();
SWEEP.R.value = 0;
step(1);

// ---------------------------------------------------------------- the DOM
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const hud = {
  top: $('.top'), lines: $$('.hero h1 .ln > span'), sub: $('.hero .sub'), hero: $('.hero'),
  hint: $('.hint'), hintText: $('.hint b'), alt: $('.alt'), altMark: $('.alt .mark'), altCm: $('.alt .cm'), altM: $('.alt .m'),
  drift: $('.drift'), chip: $('.chip'), scrim: $('.scrim'),
  turnChip: $('.turn-chip'), scanR: $('.turn-chip .scan-r'), turnLine: $('.turn-line'), turnLines: $$('.turn-line .ln > span'),
  rooms: $$('.room'), backLine: $('.back-line'), end: $('.end'), endLines: $$('.end h2 .ln > span'), endRest: $$('.end .rise'),
};
const css = (el, o) => { for (const k in o) el.style[k] = o[k]; };
const show = (el, k, dy = 14) => css(el, { opacity: k, transform: `translate3d(0, ${(1 - k) * dy}px, 0)` });

// ---------------------------------------------------------------- the hero builds itself
// tb: seconds since the scalpel finished its line.
const LOAD_REC = 2.3; // how long the loader runs in a recording
const layerFrom = 13;
let shadowKey = '';
function heroBuild(tb) {
  // the loader: scalpel lifts, the card parts smoothly along its scored line
  const lift = seg(tb, 0, 0.38), open = seg(tb, 0.28, 1.36);
  L.paint(1, eout(lift), eio4(open));
  // the lamp clicks on with a warm tungsten filament ramp
  let k = 0;
  if (tb >= 1.48) k = eout(seg(tb, 1.48, 1.82));
  // the contour layers drop in, one by one, from the base board up
  let moving = false;
  layers.forEach((l, i) => {
    const t0 = 2.0 + i * 0.13, s = seg(tb, t0, t0 + 0.42), u = seg(tb, t0 + 0.42, t0 + 0.6);
    const y = s < 1 ? layerFrom * (1 - s * s) : layerFrom * 0.02 * Math.sin(Math.PI * u);
    l.position.y = y; l.visible = tb > t0;
    for (const m of l.material) fade(m, sstep(seg(s, 0, 0.4)));
    if (tb > t0 && u < 1) moving = true;
  });
  // the house slots into its cut-out, placed by hand: slow at the end
  {
    const t0 = 3.45, s = seg(tb, t0, t0 + 1.25);
    house.position.y = 15 * (1 - eout4(s));
    house.rotation.y = 0.045 * (1 - eout(s));
    house.position.x = 0.5 * (1 - eout(s));
    house.visible = tb > t0;
    for (const c of house.children) fade(c.material, sstep(seg(s, 0, 0.3)));
    if (tb > t0 && s < 1) moving = true;
  }
  // trees and figures stand up
  trees.forEach((m, i) => { const t0 = 4.45 + i * 0.045, s = seg(tb, t0, t0 + 0.45); m.scale.set(1, Math.max(1e-3, eback(s)), 1); m.visible = s > 0; if (s > 0 && s < 1) moving = true; });
  figs.forEach((m, i) => { const t0 = 4.9 + i * 0.07, s = seg(tb, t0, t0 + 0.4); m.scale.set(1, Math.max(1e-3, eback(s)), 1); m.visible = s > 0; if (s > 0 && s < 1) moving = true; });
  return { k, moving, key: layers.map((l) => (l.visible ? l.position.y.toFixed(3) : 'x')).join() + (house.visible ? house.position.y.toFixed(3) : 'x') + trees.map((m) => m.scale.y.toFixed(3)).join() + figs.map((m) => m.scale.y.toFixed(3)).join() };
}
// the headline lands line by line, in masked slides, then the rest of the page chrome
function heroCopy(tb, out) {
  hud.lines.forEach((el, i) => {
    const s = eout4(seg(tb, 5.1 + i * 0.14, 6.1 + i * 0.14));
    el.style.transform = `translate3d(0, ${(1 - s) * 125}%, 0)`;
    el.style.opacity = s > 0.005 ? '1' : '0';
  });
  const sub = eout(seg(tb, 5.75, 6.6));
  css(hud.sub, { opacity: sub * (1 - out), transform: `translate3d(0, ${(1 - sub) * 12}px, 0)` });
  css(hud.top, { opacity: eout(seg(tb, 5.4, 6.3)) });
  css(hud.hero, { opacity: tb > 5.05 ? 1 - out : 0, transform: `translate3d(0, ${-out * 40}px, 0)` });
}

// ---------------------------------------------------------------- the camera, chapter by chapter
const VH = () => innerHeight / 100;
let exact = 0, smooth = 0; // the scroll in vh, and its smoothed copy that drives everything
const readScroll = () => scrollY / VH();
const fwd = new THREE.Vector3();
function setFocus(fp, ap, mb) {
  camera.getWorldDirection(fwd);
  bokeh.uniforms.focus.value = Math.max(1, fp.clone().sub(camera.position).dot(fwd));
  bokeh.uniforms.aperture.value = ap * (phone ? 0.8 : 1);
  bokeh.uniforms.maxblur.value = mb;
  bokeh.enabled = ap > 1e-6;
}
function place(p, dir, fov) {
  if (CAMQ) { p = V(CAMQ[0], CAMQ[1], CAMQ[2]); dir = V(CAMQ[3], CAMQ[4], CAMQ[5]).sub(p).normalize(); fov = CAMQ[6]; }
  camera.position.copy(p); camera.lookAt(p.clone().add(dir)); camera.fov = fov; camera.updateProjectionMatrix();
}
function diveCamera(tb, d, t) {
  const H = K.hero;
  // the build's slow push-in from further back, then the dive along the path
  const pin = eio(seg(tb, 1.3, 6.6));
  const de = lerp(d, sstep(d), 0.5);
  const u = pathU(de);
  const p = d > 0 ? pathP.getPoint(u) : K.pre.p.clone().lerp(H.p, pin);
  const tg = d > 0 ? pathT.getPoint(u) : K.pre.t.clone().lerp(H.t, pin);
  // a slow breath while the hero waits
  const idle = 1 - sstep(seg(d, 0, 0.12));
  p.x += Math.sin(t * 0.37) * 0.9 * idle; p.y += Math.sin(t * 0.29 + 1) * 0.5 * idle; p.z += Math.cos(t * 0.31) * 0.9 * idle;
  const fu = sstep(seg(de, 0.1, 0.68));
  place(p, tg.clone().sub(p).normalize(), lerp(d > 0 ? H.f : lerp(K.pre.f, H.f, pin), K.eye.f, fu));
  // focus: on the house all the way, and the blur eases as the scale grows
  const a = sstep(seg(de, 0.15, 0.95));
  setFocus(H.fp.clone().lerp(K.eye.fp, sstep(seg(de, 0.2, 1))), lerp(H.ap, K.eye.ap, a), lerp(H.mb, K.eye.mb, a));
  return { ao: 0.95, aoR: lerp(0.9, 0.35, a) };
}
function turnCamera(tau) {
  // glide along a continuous multi-key Catmull-Rom curve from EYE() through the low-angle garden approach into SPOT
  const u = lerp(tau, sstep(tau), 0.55);
  const p = turnP.getPoint(u), tg = turnT.getPoint(u);
  const fovBreath = 2.0 * Math.sin(Math.PI * sstep(seg(tau, 0.02, 0.88)));
  place(p, tg.sub(p).normalize(), lerp(K.eye.f, K.turnF, u) - fovBreath);
  setFocus(K.eye.fp, K.eye.ap * (1 - sstep(seg(tau, 0, 0.35))), K.eye.mb);
  return { ao: 0.95 * (1 - sstep(seg(tau, 0, 0.12))) + 0.95 * sstep(seg(tau, 0.95, 1)), aoR: lerp(0.35, 0.6, sstep(seg(tau, 0.88, 1))) };
}
function walkCamera(w) {
  const wu = pw(w, [[0, 0], [0.258, 0.42], [0.435, 0.56], [0.823, 0.825], [1, 1]]);
  const s = walkShot.at(wu);
  place(s.p, s.dir, lerp(K.walkF[0], K.walkF[1], sstep(seg(w, 0.25, 0.55))));
  setFocus(K.eye.fp, 0, 0.01);
  return { ao: 0.95, aoR: 0.6 };
}
function backCamera(r, t) {
  const s = backShot.at(lerp(r, sstep(r), 0.5));
  const idle = sstep(seg(r, 0.96, 1));
  s.p.x += Math.sin(t * 0.37) * 0.9 * idle; s.p.y += Math.sin(t * 0.29 + 1) * 0.5 * idle; s.p.z += Math.cos(t * 0.31) * 0.9 * idle;
  place(s.p, s.dir, lerp(K.backF, K.hero.f, sstep(seg(r, 0.25, 0.92))));
  const a = sstep(seg(r, 0.78, 1));
  setFocus(K.hero.fp, K.hero.ap * a, K.hero.mb);
  return { ao: 0.95 * (1 - sstep(seg(r, 0.04, 0.12))) + 0.95 * sstep(seg(r, 0.86, 0.9)), aoR: lerp(0.6, 0.9, sstep(seg(r, 0.8, 1))) };
}
// the front's compressed radius from the bulb (see sweep.js): 43 reaches the lens, 47 the figure,
// 48 to 66 the house in true 1:1 metres, and 66 to 72.8 completes the grass slope and trees while keeping the dark studio environment
const R_MAX = 72.8;
const turnR = (tau) => pw(tau, [[0, 38], [0.10, 47.5], [0.40, 56.5], [0.68, 66.5], [0.88, 71.2], [1, R_MAX]]);
const backR = (r) => pw(r, [[0, R_MAX], [0.44, R_MAX], [0.58, 66.5], [0.7, 56.5], [0.78, 45], [0.88, 0]]);

// ---------------------------------------------------------------- the frame
let t0 = performance.now() / 1000, loadDone = REC ? LOAD_REC : -1, lastT = 0;
function update(t, dt) {
  // live: the loader follows real progress (painted by the inline script) until the line is finished
  if (!REC && loadDone < 0) { if (L.done) loadDone = t; else return false; }
  if (REC && t < LOAD_REC) { L.paint(eio(clamp(t / LOAD_REC)), 0, 0); }
  const tb = t - loadDone;
  let build = { k: 0, moving: true, key: 'pre' };
  if (tb < 0) { layers.forEach((l) => (l.visible = false)); house.visible = false; trees.forEach((m) => (m.visible = false)); figs.forEach((m) => (m.visible = false)); }
  else build = heroBuild(tb);
  if (tb > 1.25) document.body.classList.remove('locked');
  exact = readScroll();
  smooth = REC && dt === 0 ? exact : smooth + (exact - smooth) * (1 - Math.exp(-3.4 * dt));
  if (Math.abs(exact - smooth) < 1e-3) smooth = exact;
  const y = smooth, T = Math.max(0, tb);
  const d = seg(y, ...CH.dive), tau = seg(y, ...CH.turn), w = seg(y, ...CH.walk), r = seg(y, ...CH.back), e = seg(y, ...CH.end);

  // the camera
  let cam;
  if (y < CH.turn[0]) cam = diveCamera(T, d, t);
  else if (y < CH.walk[0]) cam = turnCamera(tau);
  else if (y < CH.back[0]) cam = walkCamera(w);
  else cam = backCamera(r, t);
  if (gtao) { gtao.blendIntensity = cam.ao; gtao.enabled = cam.ao > 0.01; gtao.updateGtaoMaterial({ radius: cam.aoR }); }

  // smoothly fade the foreground scale figure as we step into its exact position at the start of the turn
  if (tb > 5.4) fade(heroFig.material, 1 - sstep(seg(tau, 0.01, 0.14)) * (1 - sstep(seg(r, 0.78, 0.88))));

  // the front, and which world is drawn
  const Rv = y < CH.turn[0] ? 0 : y < CH.walk[0] ? turnR(tau) : y < CH.back[0] ? R_MAX : backR(r);
  SWEEP.R.value = Rv;
  SWEEP.glow.value = sstep(seg(Rv, 36, 41)) * (1 - 0.85 * sstep(seg(Rv, 70.5, 72.75)));
  for (const m of realMeshes) m.visible = Rv > 32;
  const cardOn = Rv < R_MAX - 0.3;
  for (const m of cardMeshes) m.visible = buildSet.has(m) ? m.visible && cardOn : cardOn; // the build decides first, the front second
  // smoothly cross-fade warm lamp glow into golden afternoon sun as the sweep passes over the camera and house
  const dayK = sstep(seg(Rv, 42, 66));
  sun.intensity = lerp(2.85, 4.15, dayK);
  hemiDay.intensity = lerp(0.25, 0.40, dayK);
  renderer.toneMappingExposure = lerp(1.02, 1.06, dayK);
  // the door slides open as we come up onto the terrace, and closes behind us on the way out
  const door = 1.85 * sstep(seg(w, 0.08, 0.22)) * (y < CH.back[0] ? 1 : 1 - sstep(seg(r, 0.22, 0.36)));
  real.door.position.z = door;

  // the lamp: on through the build and the whole journey, then clicks off once with a smooth tungsten decay into moonlight
  let k = build.k;
  const endGlow = sstep(seg(e, 0.2, 0.45));
  if (e > 0.2) k *= 1 - eout(seg(e, 0.2, 0.38));
  setLamp(k, endGlow);

  // shadows redraw when something that casts one has moved (a jump in time included)
  const key = build.key + '|' + Rv.toFixed(2) + '|' + door.toFixed(3);
  if (build.moving || key !== shadowKey) { renderer.shadowMap.needsUpdate = true; shadowKey = key; }

  heroCopy(T, sstep(seg(d, 0, 0.07)));
  copy(T, y, d, tau, w, r, e);
  grade.uniforms.seed.value = (t * 60) % 97;
  return true;
}

function copy(tb, y, d, tau, w, r, e) {
  // the dive: lens height, the drifting sentence, eye height
  const h = camera.position.y - GARDEN;
  const altOn = sstep(seg(d, 0.03, 0.12)) * (1 - sstep(seg(tau, 0.04, 0.14))) + sstep(seg(r, 0.5, 0.58)) * (1 - sstep(seg(r, 0.9, 0.98)));
  css(hud.alt, { opacity: y > CH.walk[0] && y < CH.back[0] ? 0 : altOn });
  hud.altCm.textContent = h.toFixed(1) + ' cm';
  hud.altM.textContent = h.toFixed(1) + ' m';
  hud.altMark.style.transform = `translate3d(0, ${(1 - clamp(h / 60)) * 100}%, 0)`;
  const dr = seg(d, 0.16, 0.62);
  const dop = sstep(seg(dr, 0, 0.18)) * (1 - sstep(seg(dr, 0.78, 1)));
  const driftX = phone ? lerp(3, -3, dr) : lerp(10, -10, dr);
  css(hud.drift, { opacity: dop, transform: `translate3d(${driftX}vw, 0, 0)` });
  show(hud.chip, sstep(seg(d, 0.92, 0.98)) * (1 - sstep(seg(tau, 0, 0.03))), 10);
  // the turn
  if (hud.scanR) hud.scanR.textContent = `SCAN R ${SWEEP.R.value.toFixed(1)}M`;
  show(hud.turnChip, sstep(seg(tau, 0.03, 0.10)) * (1 - sstep(seg(tau, 0.9, 1))), 10);
  const tl = sstep(seg(tau, 0.34, 0.48)) * (1 - sstep(seg(tau, 0.84, 0.95)));
  hud.turnLines.forEach((el, i) => { const s = eout4(seg(tau, 0.32 + i * 0.03, 0.46 + i * 0.03)); el.style.transform = `translate3d(0, ${(1 - s) * 112}%, 0)`; });
  css(hud.turnLine, { opacity: tl });
  hud.scrim.style.opacity = Math.max(dop, tl * 0.8);
  // the rooms
  show(hud.rooms[0], sstep(seg(w, 0.32, 0.39)) * (1 - sstep(seg(w, 0.56, 0.62))));
  show(hud.rooms[1], sstep(seg(w, 0.76, 0.82)) * (1 - sstep(seg(w, 0.93, 0.98))));
  // back to the desk
  show(hud.backLine, sstep(seg(r, 0.6, 0.68)) * (1 - sstep(seg(r, 0.84, 0.9))), 18);
  // the end: the lamp goes off, and the studio says what it does
  const en = sstep(seg(e, 0.4, 0.62));
  hud.end.style.opacity = en > 0 ? 1 : 0;
  hud.end.classList.toggle('live', en > 0.5);
  hud.endLines.forEach((el, i) => { const s = eout4(seg(e, 0.42 + i * 0.05, 0.66 + i * 0.05)); el.style.transform = `translate3d(0, ${(1 - s) * 112}%, 0)`; });
  hud.endRest.forEach((el, i) => show(el, eout(seg(e, 0.58 + i * 0.05, 0.8 + i * 0.05)), 16));
  // the hint
  const hint = eout(seg(tb, 6.6, 7.4));
  hud.hintText.textContent = d > 0.9 ? 'Scroll to walk in' : 'Scroll to shrink';
  css(hud.hint, { opacity: hint * (d < 0.06 ? 1 - d / 0.06 : d > 0.9 && tau <= 0 ? sstep(seg(d, 0.93, 1)) : 0) });
}
function render() { composer.render(); }

addEventListener('resize', () => {
  const was = phone; phone = innerWidth < 760 || innerWidth / innerHeight < 0.8;
  if (was !== phone) useKeys();
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false); composer.setSize(innerWidth, innerHeight);
  bloom.setSize(innerWidth / 2, innerHeight / 2);
  grade.uniforms.res.value.set(innerWidth, innerHeight);
  bokeh.uniforms.aspect.value = innerWidth / innerHeight;
});

const raf = () => new Promise((r) => requestAnimationFrame(r));
window.__rig = {
  ready: true, camera, scene, phone: () => phone, CH,
  // the recorder's frame: t in seconds since start, y in vh of scroll
  async frame(t, y, o = {}) {
    if (y != null) window.scrollTo(0, y * VH());
    const dt = t < lastT || o.snap ? 0 : Math.min(0.1, t - lastT);
    if (t < lastT || o.snap) smooth = readScroll();
    lastT = t;
    update(t, dt); render();
    await raf(); await raf();
    return { t, y: +smooth.toFixed(1), R: +SWEEP.R.value.toFixed(1), fov: +camera.fov.toFixed(2), cam: camera.position.toArray().map((v) => +v.toFixed(2)) };
  },
  // honest frame cost: reading one pixel back makes the GPU finish each frame
  bench(n = 60) { const gl = renderer.getContext(), px = new Uint8Array(4); const t0 = performance.now(); for (let i = 0; i < n; i++) { render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } return +((performance.now() - t0) / n).toFixed(2); },
  info() { renderer.info.autoReset = false; renderer.info.reset(); render(); const i = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, tex: renderer.info.memory.textures, geo: renderer.info.memory.geometries, progs: renderer.info.programs.length }; renderer.info.autoReset = true; return i; },
};

if (!REC) {
  let last = performance.now() / 1000, slow = 0;
  const loop = () => {
    const now = performance.now() / 1000, dt = Math.min(1 / 30, now - last); last = now;
    if (!document.hidden && innerWidth > 0 && innerHeight > 0) {
      if (update(now - t0, dt)) render();
      // quality governor: a lower render size if frames run long for two seconds
      slow = dt > 0.03 ? slow + dt : Math.max(0, slow - dt * 0.5);
      if (slow > 2 && dpr > 1) { dpr = Math.max(1, dpr - 0.25); renderer.setPixelRatio(dpr); composer.setPixelRatio(dpr); composer.setSize(innerWidth, innerHeight); slow = 0; }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
