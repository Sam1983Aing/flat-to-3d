// Sequence: one scroll through thirty-eight weeks.
// The loader is the programme being written. The sheet draws itself week by week (all six drawings at once,
// each stopping at its own week). Scroll dives into drawing 01 down to the edge of the excavation, then walks
// the site while the house goes up, enters the forest of props at week 18, glides through the room as props
// strip away, oak floors lay and bespoke furniture stages the interior to handover at week 38, and pulls back
// out until the house is drawing 06 again.
//   ?v=12.5  jump to a scroll position in screen heights      ?still   skip the loader and the drawing, for stills
//   ?offline  the page runs on a virtual clock that tools/offline.mjs steps one frame at a time
import * as THREE from 'three';
import { makeTextures, makeMaterials, buildWorld, U, PROG, TILES, WEEKS, V, natural, propsAt } from './world.js';
import { buildStage } from './stage.js';
import { makePipe, aim } from './pipe.js';

const SEQ = window.SEQ, pad = SEQ.pad;
const Q = new URLSearchParams(location.search);
const STILL = Q.has('still'), OFFLINE = Q.has('offline');
const PHONE = innerWidth <= 700;
const DPR = Math.min(+(Q.get('dpr') || devicePixelRatio || 1), 2);
let DPR_REAL = PHONE ? DPR : Math.min(DPR, 1.5);
const raf = () => new Promise((r) => requestAnimationFrame(r));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const setP = (p) => { SEQ.real = true; SEQ.progress = Math.max(SEQ.progress, p); };
const C = (h) => new THREE.Color(h);

// ---------------------------------------------------------------- boot
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.04;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
renderer.setClearColor(0xf2efe7, 1);
setP(0.34); await raf();

// sky, sun, haze. Crisp morning while the house goes up, warm golden hour by handover.
const SUN_AM = V(0.62, 0.42, -0.66).normalize(), SUN_MID = V(0.24, 0.32, 0.91).normalize(), SUN_PM = V(0.72, 0.25, 0.65).normalize();
const SKY = { am: { zen: C('#4274b0'), hor: C('#e2dbca'), glow: C('#ffcf94') }, pm: { zen: C('#4a6fa0'), hor: C('#edd4ae'), glow: C('#ffab5c') } };
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { uSun: { value: SUN_AM.clone() }, uZen: { value: SKY.am.zen.clone() }, uHor: { value: SKY.am.hor.clone() }, uGlow: { value: SKY.am.glow.clone() }, uGround: { value: C('#746654') }, uEnv: { value: 0 } },
  vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform vec3 uSun, uZen, uHor, uGlow, uGround; uniform float uEnv; varying vec3 vD;
    void main(){ vec3 d = normalize(vD); float h = d.y;
      vec3 c = mix(uHor, uZen, pow(smoothstep(-.02, .55, h), .5));
      vec2 q = d.xz / max(d.y + .06, .02) * 1.6 + vec2(3.1, 7.4);
      float n = 0., a = .55; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
      for (int i = 0; i < 5; i++) { vec2 f = fract(q), ip = floor(q); f = f * f * (3. - 2. * f);
        float h00 = fract(sin(dot(ip, vec2(127.1, 311.7))) * 43758.5), h10 = fract(sin(dot(ip + vec2(1, 0), vec2(127.1, 311.7))) * 43758.5);
        float h01 = fract(sin(dot(ip + vec2(0, 1), vec2(127.1, 311.7))) * 43758.5), h11 = fract(sin(dot(ip + vec2(1, 1), vec2(127.1, 311.7))) * 43758.5);
        n += a * mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y); q = m * q; a *= .5; }
      float cl = smoothstep(.56, .82, n) * smoothstep(.0, .06, h) * (1. - smoothstep(.25, .6, h)) * (1. - uEnv);
      c = mix(c, mix(uHor * 1.06, vec3(1.), .5) * (.92 + .1 * smoothstep(.6, .9, n)), cl * .85);
      float s = max(dot(d, uSun), 0.);
      c += uGlow * (pow(s, 5.) * .32 + pow(s, 64.) * .5) * smoothstep(-.1, .2, h);
      if (uEnv > .5) c = mix(uGround, c, smoothstep(-.06, .02, h));
      gl_FragColor = vec4(c, 1.); }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), skyMat);
sky.scale.setScalar(2400); sky.renderOrder = -1; sky.frustumCulled = false;
sky.userData.sets = { main: skyMat, paper: null, nd: null }; sky.userData.sky = true;

// reflections come from the same sky, with the earth below the horizon
const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(new THREE.SphereGeometry(40, 48, 24), skyMat));
skyMat.uniforms.uEnv.value = 1;
const ENV = new THREE.PMREMGenerator(renderer).fromScene(envScene, 0.02).texture;
skyMat.uniforms.uEnv.value = 0;
const T = makeTextures(renderer, PHONE);
setP(0.48); await raf();
const R = makeMaterials(T, ENV);
const scene = new THREE.Scene();
scene.add(buildWorld({ R, T, phone: PHONE }));
const stage = buildStage(R);
scene.add(stage, sky);
setP(0.62); await raf();

scene.fog = new THREE.Fog(SKY.am.hor.clone(), 160, 1400);
const sun = new THREE.DirectionalLight(0xffe7cc, 3.2);
const sunAt = V(11, -2, -2);
sun.position.copy(sunAt).addScaledVector(SUN_AM, 140); sun.target.position.copy(sunAt);
sun.castShadow = true; sun.shadow.mapSize.set(PHONE ? 2048 : 4096, PHONE ? 2048 : 4096);
Object.assign(sun.shadow.camera, { left: -44, right: 44, top: 44, bottom: -44, near: 40, far: 260 });
sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.04;
const hemi = new THREE.HemisphereLight(0xd2e0ee, 0x8b7a63, 0.88);
scene.add(sun, sun.target, hemi);
const lamps = stage.userData.lights.map((l) => { const p = new THREE.PointLight(0xffc288, 0, 0, 2); p.position.copy(l.p); p.userData.k = l.k; scene.add(p); return p; });
U.real.value = 5.95;

// ---------------------------------------------------------------- cameras
const cam = new THREE.PerspectiveCamera(2, 1, 1, 2000);
const EYE_FOV = PHONE ? 64 : 50;
// the sheet's axonometric: centered vertically on the full house (pit -4.3 to upper roof +8.0) so tiles 04-06 never clip
const K0 = { T: V(13.6, 1.35, -1.1), az: 43.21, el: 33.52, h: 10.75, fov: 2 };
// inside drawing 01, the pit filling the screen
const K1 = { T: V(11.3, -3.2, -1.9), az: 43.21, el: 33.52, h: PHONE ? 16.8 : 8.9, fov: 2 };
const toK = (E, Tg, fov) => {
  const d = E.clone().sub(Tg), D = d.length();
  return { T: Tg.clone(), az: Math.atan2(d.z, d.x) * 180 / Math.PI, el: Math.asin(d.y / D) * 180 / Math.PI, h: D * Math.tan(fov * Math.PI / 360), fov };
};
const EDGE = [V(13.8, natural(13.8, 8.15) + 1.62, 8.15), V(10.6, -3.6, -2.8)];
const K3 = toK(EDGE[0], EDGE[1], EYE_FOV);
const lerpK = (a, b, t, o = {}) => {
  const tf = o.f ?? t, te = o.e ?? t, tt = o.T ?? t, th = o.h ?? t;
  return { T: a.T.clone().lerp(b.T, tt), az: lerp(a.az, b.az, te), el: lerp(a.el, b.el, te), h: lerp(a.h, b.h, th), fov: Math.exp(lerp(Math.log(a.fov), Math.log(b.fov), tf)) };
};

// ---------------------------------------------------------------- purposeful camera choreography: legs of keys [screen heights, eye, look]
const DIVE = 6; // the dive takes the first six screen heights
// Entry aisle centered at z = -2.95 (exact center of the 2.9m prop corridor and 1.9m sliding door bay, so zero posts or mullions block the view)
const THRESHOLD = [22.1, 1.62, -2.95, 12.0, 2.1, -3.1];
const PROPS_MID = [18.9, 1.60, -2.95, 10.2, 2.0, -3.8];
const PROPS_DEEP = [16.1, 1.60, -2.95, 9.2, 2.1, -3.8];

// Second-floor (mezzanine, y = 3.20) rise & furniture reveal keys (camera inside balustrade x = 10.52 so rail never blocks the view)
const MEZZ_RISE = [11.65, 4.76, -3.55, 5.8, 4.15, -1.65];
const MEZZ_NORTH = [10.52, 4.66, -4.25, 5.4, 4.08, -1.35];
const MEZZ_MID = [10.52, 4.64, -1.55, 5.4, 4.00, -0.55];
const MEZZ_SOUTH = [10.55, 4.62, 1.35, 6.2, 3.88, -0.55];

// First-floor (ground level, y = 0.00) descent & full-floor tour keys (Kitchen -> Dining -> Living Room -> Full Floor Panorama -> Handover)
const MEZZ_EDGE = [10.62, 4.54, 0.85, 6.2, 3.78, -1.15];
const FLOOR1_DROP = [11.55, 1.96, -0.85, 6.0, 1.12, -3.75];
const FLOOR1_KITCHEN = [11.8, 1.56, -1.35, 5.6, 1.15, -4.05];
const FLOOR1_DINING = [12.4, 1.56, 0.35, 7.2, 1.00, -2.25];
const FLOOR1_PAN = [11.6, 1.56, -1.25, 15.0, 1.06, -5.15];
const FLOOR1_WIDE = PHONE ? [13.6, 1.62, 1.45, 12.2, 1.05, -4.45] : [14.0, 1.66, 1.95, 11.4, 1.08, -4.25];
const HANDOVER_B = PHONE ? [13.2, 1.50, -1.45, 15.4, 1.00, -5.35] : [13.0, 1.52, -1.15, 15.5, 1.02, -5.25];

const LEGS = [
  // Leg 0 (v = 6.0..12.2, Wk 06..18): from the pit edge down the long side to the garden, up the scaffold stair onto the terrace
  {
    keys: [
      [6.0, ...EDGE[0].toArray(), ...EDGE[1].toArray()],
      [6.5, 13.9, -0.71, 8.25, 10.4, -3.6, -3.0],
      [7.7, 21.6, -1.58, 12.4, 12.0, -0.8, -1.5],
      [8.9, 28.4, -1.60, 6.4, 16.5, 0.4, -2.0],
      [9.6, 27.1, -1.58, 2.2, 21.0, 1.0, 2.1],
      [10.35, 22.55, 1.62, 2.2, 16.8, 1.7, 0.6],
      [11.2, 22.15, 1.62, -0.8, 13.5, 2.6, -2.95],
      [12.2, ...THRESHOLD],
    ],
  },
  // Leg 1 (v = 12.2..15.5, Wk 18.0..19.0): walk forward into the props, then rise higher to overlook the second floor BEFORE the yellow props disappear
  {
    keys: [
      [12.2, ...THRESHOLD],
      [13.4, ...PROPS_MID],
      [14.5, ...PROPS_DEEP],
      [15.5, ...MEZZ_RISE],
    ],
  },
  // Leg 2 (v = 15.5..19.4, Wk 19.0..33.6): watch yellow props strip & oak floor lay on the second floor, then glide across the second floor as furniture appears one by one
  {
    keys: [
      [15.5, ...MEZZ_RISE],
      [16.5, ...MEZZ_NORTH],
      [17.9, ...MEZZ_MID],
      [19.4, ...MEZZ_SOUTH],
    ],
  },
  // Leg 3 (v = 19.4..25.0, Wk 33.6..38.0): lower camera down to the first floor and tour the whole floor (Kitchen -> Dining -> Living Room) as furniture appears one by one
  {
    keys: [
      [19.4, ...MEZZ_SOUTH],
      [19.72, ...MEZZ_EDGE],
      [20.08, ...FLOOR1_DROP],
      [20.5, ...FLOOR1_KITCHEN],
      [21.65, ...FLOOR1_DINING],
      [22.8, ...FLOOR1_PAN],
      [23.9, ...FLOOR1_WIDE],
      [25.0, ...HANDOVER_B],
    ],
  },
];
for (const leg of LEGS) {
  const P = leg.keys.map((k) => V(k[1], k[2], k[3])), L = leg.keys.map((k) => V(k[4], k[5], k[6]));
  leg.pos = new THREE.CatmullRomCurve3(P, false, 'centripetal'); leg.look = new THREE.CatmullRomCurve3(L, false, 'centripetal');
  leg.v0 = leg.keys[0][0]; leg.v1 = leg.keys[leg.keys.length - 1][0];
}
function walkAt(v) {
  const leg = LEGS.find((l) => v <= l.v1) || LEGS[LEGS.length - 1];
  const t = clamp((v - leg.v0) / (leg.v1 - leg.v0), 0, 1), te = lerp(t, ease(t), 0.35), vv = lerp(leg.v0, leg.v1, te);
  const k = leg.keys; let i = 0; while (i < k.length - 2 && vv > k[i + 1][0]) i++;
  const u = (i + clamp((vv - k[i][0]) / (k[i + 1][0] - k[i][0]), 0, 1)) / (k.length - 1);
  return { P: leg.pos.getPoint(u), L: leg.look.getPoint(u) };
}
// the week at each point of the scroll
const WEEK_KEYS = [
  [6.0, 5.95],
  [6.5, 6.05],
  [10.5, 16.0],
  [12.2, 18.0],
  [14.5, 18.2],  // Reaches deep prop position before yellow props disappear
  [15.5, 19.0],  // Camera has risen to the second floor while all yellow props are still standing
  [16.5, 30.0],  // Yellow props strip away, glazing & balustrade install, oak floor & plaster finish on second floor
  [19.4, 33.6],  // Second-floor library, studio desk, chair, lounge sofa, coffee table & armchairs appear one by one
  [20.4, 34.0],  // Camera lowers down from second floor to first floor
  [21.65, 35.85],// First-floor kitchen, waterfall island, barstools & dining room appear one by one
  [24.3, 37.8],  // First-floor living room, south credenza & terrace appear one by one across the whole floor
  [25.0, 38.0],  // Handover complete
];
function weekAt(v) {
  if (v <= WEEK_KEYS[0][0]) return WEEK_KEYS[0][1];
  for (let i = 1; i < WEEK_KEYS.length; i++) if (v <= WEEK_KEYS[i][0]) {
    const [a, wa] = WEEK_KEYS[i - 1], [b, wb] = WEEK_KEYS[i];
    return lerp(wa, wb, sm(0, 1, (v - a) / (b - a)) * 0.35 + (v - a) / (b - a) * 0.65);
  }
  return 38;
}
const END = { out: [25.0, 26.7], unpour: [26.7, 27.7], zoom: [27.7, 28.8], total: 29.4 };
const KW = toK(V(HANDOVER_B[0], HANDOVER_B[1], HANDOVER_B[2]), V(HANDOVER_B[3], HANDOVER_B[4], HANDOVER_B[5]), EYE_FOV);

// ---------------------------------------------------------------- pipeline
const pipe = makePipe(renderer, scene, cam, { ao: !PHONE, samples: 4 });
pipe.onAim = (c) => {
  const D = c.userData.D; scene.fog.near = D + 110; scene.fog.far = D + 1450;
  sky.position.copy(c.position);
};
let W = innerWidth, H = innerHeight;
pipe.setSize(W, H, DPR, DPR_REAL);

// ---------------------------------------------------------------- the sheet's layout
const sheet = document.getElementById('sheet');
const frames = [...document.querySelectorAll('.frame')], caps = [...document.querySelectorAll('figcaption')];
const prog = document.getElementById('prog'), nowEl = prog.querySelector('.now'), nowTag = nowEl.querySelector('b');
const dones = [...prog.querySelectorAll('.done')];
const chip = document.getElementById('chip'), notes = document.getElementById('notes'), hint = document.getElementById('hint'), bar = document.querySelector('.bar');
let REST = [];
const measure = () => {
  sheet.style.transform = 'none';
  REST = frames.map((f) => { const r = f.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
};
measure();

function clock(week, show) {
  prog.classList.toggle('clock', show);
  const f = clamp(week / WEEKS, 0, 1);
  nowEl.style.left = `calc(var(--lab) + (100% - var(--lab)) * ${f})`;
  nowTag.textContent = 'Wk ' + pad(clamp(Math.ceil(week - 1e-3), 0, WEEKS));
  PROG.forEach(([, a, b], i) => { dones[i].style.transform = `scaleX(${clamp((week - a) / (b - a), 0, 1)})`; });
}

// ---------------------------------------------------------------- light by the week
let shadowKey = '';
function lightFor(week) {
  const pm = sm(27, 36, week);
  const dir = SUN_AM.clone().lerp(SUN_MID, sm(15.4, 17.4, week)).normalize().lerp(SUN_PM, pm).normalize();
  sun.position.copy(sunAt).addScaledVector(dir, 140);
  sun.color.set(0xffe7cc).lerp(C('#ffc68c'), pm); sun.intensity = lerp(3.15, 3.55, pm);
  hemi.intensity = lerp(0.88, 0.72, pm);
  skyMat.uniforms.uSun.value.copy(dir);
  skyMat.uniforms.uZen.value.copy(SKY.am.zen).lerp(SKY.pm.zen, pm);
  skyMat.uniforms.uHor.value.copy(SKY.am.hor).lerp(SKY.pm.hor, pm);
  skyMat.uniforms.uGlow.value.copy(SKY.am.glow).lerp(SKY.pm.glow, pm);
  scene.fog.color.copy(skyMat.uniforms.uHor.value);
  for (const l of lamps) {
    const on = l.position.y > 3.0 ? sm(32.4, 33.4, week) : (l.position.x < 10.5 ? sm(34.8, 35.9, week) : sm(37.0, 37.8, week));
    l.intensity = 7.5 * l.userData.k * on;
  }
  R.shade.emissiveIntensity = 2.6 * sm(32.4, 37.6, week);
  // the sliding door steps in, then slides open for handover
  const door = stage.userData.door;
  door.position.x = 18.24 - 0.11 * sm(37.3, 37.55, week);
  door.position.z = -2.95 - 1.84 * sm(37.55, 37.95, week);
  const key = (Math.round(week * 25) / 25).toFixed(2);
  if (key !== shadowKey) { shadowKey = key; renderer.shadowMap.needsUpdate = true; }
}

// ---------------------------------------------------------------- warm up behind the loader
const screenRect = () => ({ x: 0, y: 0, w: W, h: H });
pipe.draw(TILES.map((t, i) => ({ rect: REST[i], cam: K0, now: t.w1, newFrom: t.w0 })));
setP(0.78); await raf();
for (const w of [38, 18, 5.95]) {
  U.real.value = w; lightFor(w); renderer.shadowMap.needsUpdate = true;
  pipe.real({ cam: w === 38 ? KW : K3, rect: screenRect() });
}
pipe.real({ cam: K1, rect: screenRect() });
setP(0.94); await raf();
await document.fonts.ready;
setP(1);

// ---------------------------------------------------------------- the hero: dock, land, draw
const S = { now: -1.6, drawT: -1, drawn: false };
const DRAW_S = 5.8;
const nowAt = (t) => -1.6 + (WEEKS + 1.6) * (t <= 0 ? 0 : t >= 1 ? 1 : (1 - Math.cos(Math.PI * Math.pow(t, 1.12))) / 2);
const LOADER_MS = 1900;
let heroT0 = OFFLINE ? LOADER_MS : Math.max(performance.now() + 300, LOADER_MS);
const HERO = [
  [0, () => {
    SEQ.docked = true;
    prog.querySelectorAll('.plan').forEach((p) => p.classList.add('in'));
    prog.classList.add('fly'); SEQ.place('dock'); prog.classList.add('docked');
    document.body.classList.add('ready');
  }],
  [350, () => document.body.classList.add('sheeton')],
  [520, () => document.body.classList.add('landed')],
  [1050, (t) => { prog.classList.remove('fly'); S.drawT = t; caps.forEach((c) => c.classList.add('go')); }],
];
let heroStep = 0;
function heroTick(t) {
  if (OFFLINE && t < LOADER_MS) { SEQ.progress = Math.min(1, t / (LOADER_MS - 300)); SEQ.shown = SEQ.progress; }
  while (heroStep < HERO.length && t >= heroT0 + HERO[heroStep][0]) HERO[heroStep++][1](heroT0 + HERO[heroStep - 1][0]);
}
if (STILL) {
  SEQ.docked = true; SEQ.place('dock'); prog.classList.add('docked');
  document.body.classList.add('ready', 'landed', 'sheeton'); caps.forEach((c) => c.classList.add('go', 'done')); hint.classList.add('on');
  S.now = WEEKS; S.drawn = true; heroStep = HERO.length;
}
if (OFFLINE) { SEQ.real = true; SEQ.progress = 0; SEQ.shown = 0; }

// ---------------------------------------------------------------- scroll
const track = document.getElementById('track');
track.style.height = (END.total + 1) * 100 + 'vh';
if (Q.has('v')) { history.scrollRestoration = 'manual'; scrollTo(0, +Q.get('v') * innerHeight); }
let sv = scrollY / innerHeight, last = OFFLINE ? 0 : performance.now();

// annotations inside drawing 01, positioned cleanly with a paper halo so lines never strike through text
const NOTES = [
  { p: V(-0.2, 0, -6.5), t: '±0.00 COURT', dx: -22, dy: -28 },
  { p: V(10.4, -4.3, -0.4), t: '-4.30 FORMATION', dx: 24, dy: -32 },
  { p: V(13.8, -2.3, 6.8), t: '-2.30 ACCESS BENCH', dx: -24, dy: 28 },
  { p: V(25.2, -3.2, -6.5), t: '-3.20 GARDEN', dx: 20, dy: -26 },
  { p: V(14.8, -3.6, 4.4), t: 'STRIP FOOTING 1.0 × 0.7M', dx: 26, dy: 38, acc: true },
  { p: V(1.2, -2.3, -1.8), t: 'BATTER 1 : 1.15', dx: -26, dy: 32 },
];
notes.innerHTML = NOTES.map((n) => `<g><circle r="2.2" fill="#1d1c19"/><line stroke="#1d1c19" stroke-width=".9"/><rect class="nbg" rx="1" height="14"/><text ${n.acc ? 'class="acc"' : ''}>${n.t}</text></g>`).join('');
const noteEls = [...notes.children];
function drawNotes(alpha) {
  notes.style.opacity = alpha;
  if (alpha <= 0.001) return;
  const v = new THREE.Vector3();
  NOTES.forEach((n, i) => {
    v.copy(n.p).project(cam);
    const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H, g = noteEls[i];
    let dx = n.dx; if (x + dx < 140 && dx < 0) dx = -dx; if (x + dx > W - 170 && dx > 0) dx = -dx;
    const tx = x + dx, ty = y + n.dy;
    g.children[0].setAttribute('cx', x); g.children[0].setAttribute('cy', y);
    const ln = g.children[1]; ln.setAttribute('x1', x); ln.setAttribute('y1', y); ln.setAttribute('x2', tx); ln.setAttribute('y2', ty);
    const tt = g.children[3], bg = g.children[2];
    const txText = tx + (dx < 0 ? -5 : 5), tyText = ty + (n.dy < 0 ? -4 : 9);
    tt.setAttribute('x', txText); tt.setAttribute('y', tyText); tt.setAttribute('text-anchor', dx < 0 ? 'end' : 'start');
    const bw = n.t.length * 6.8 + 8;
    bg.setAttribute('x', dx < 0 ? txText - bw + 3 : txText - 3);
    bg.setAttribute('y', tyText - 10.5);
    bg.setAttribute('width', bw);
  });
}

// what the small print says at each point
const rowOf = (w) => { let n = PROG[0][0]; for (const [name, a] of PROG) if (w >= a) n = name; return n; };
function chipFor(v, week, pour, diving) {
  const wk = `Week ${pad(clamp(Math.ceil(week - 1e-3), 1, WEEKS))} &nbsp;//&nbsp; `;
  if (v >= END.zoom[0] + 0.3) return '';
  if (v >= END.out[0] + 0.15) return 'Drawing 06 &nbsp;//&nbsp; Glaze, fit out &nbsp;//&nbsp; <i>Wk 22–38</i>';
  if (v >= 23.8) return 'Week 38 &nbsp;//&nbsp; <i>Handover · First-floor showcase</i>';
  if (v >= LEGS[1].v0 - 0.4 && v <= LEGS[2].v0 + 0.05) return wk + `<i>Roof pour · ${propsAt(week)} props under slab</i>`;
  if (v > DIVE + 0.5) {
    if (week >= 9.05 && week < 10.15) return wk + '<i>Backfill &amp; compaction</i>';
    if (week >= 10.15 && week < 10.85) return wk + '<i>Scaffold stair &amp; terrace slab</i>';
    if (v > 14.5 && week < 19.6) return wk + `<i>Rising to second floor · ${propsAt(week)} props</i>`;
    if (week >= 19.6 && week < 25.0) return wk + '<i>Props struck · Glazing &amp; balustrade</i>';
    if (week >= 25.0 && week < 30.0) return wk + '<i>Wide-plank oak &amp; plaster finishes</i>';
    if (week >= 30.0 && week < 31.7) return wk + '<i>Second floor · Library &amp; architect studio</i>';
    if (week >= 31.7 && week < 33.55) return wk + '<i>Second floor · Mezzanine lounge suite</i>';
    if (week >= 33.55 && week < 34.05) return wk + '<i>Descending to first floor</i>';
    if (week >= 34.05 && week < 35.05) return wk + '<i>First floor · Kitchen &amp; waterfall island</i>';
    if (week >= 35.05 && week < 35.95) return wk + '<i>First floor · Dining room staging</i>';
    if (week >= 35.95) return wk + '<i>First floor · Living room &amp; terrace</i>';
    const n = propsAt(week);
    return wk + `<i>${rowOf(week)}${n ? ` · ${n} props` : ''}</i>`;
  }
  if (v > DIVE * 0.93) return 'Week 06 &nbsp;//&nbsp; <i>Excavation bench · -2.30m</i>';
  if (pour > 0) { const w = clamp(Math.ceil(pour), 1, 6); return `Week ${pad(w)} &nbsp;//&nbsp; <i>${w <= 3 ? 'Excavate' : 'Footings'}</i>`; }
  if (diving) return 'Drawing 01 &nbsp;//&nbsp; Excavate, footings &nbsp;//&nbsp; <i>Wk 01–06</i>';
  return '';
}

// ---------------------------------------------------------------- the frame
let lastKey = '';
const Q_ = { n: 0, t: 0, at: 0 };
function frame(now) {
  if (!OFFLINE) requestAnimationFrame(frame);
  heroTick(now);
  if (now - last > 120 && S.drawT > 0) (window.__hitches || (window.__hitches = [])).push([Math.round(now - last), +sv.toFixed(2), +S.now.toFixed(1)]);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const target = clamp(scrollY / innerHeight, 0, END.total);
  sv = STILL ? target : sv + (target - sv) * (1 - Math.exp(-dt * 5.5));
  if (Math.abs(target - sv) < 1e-5) sv = target;
  const ps = clamp(sv / DIVE, 0, 1);

  if (S.drawT > 0 && !S.drawn) {
    const t = (now - S.drawT) / 1000 / DRAW_S * (ps > 0.01 ? 3 : 1);
    if (ps > 0.01) S.drawT -= dt * 1000 * 2;
    S.now = nowAt(t);
    if (t >= 1) { S.drawn = true; S.now = WEEKS; hint.classList.add('on'); window.__heroDone = true; }
    caps.forEach((c, i) => c.classList.toggle('done', S.now >= TILES[i].w1));
  }
  if (STILL) window.__heroDone = true;

  const ending = sv >= END.out[0];
  const live = ending ? 5 : 0;
  let z, c, pour, l = 0, k, week, realOnly, rectL;
  const Rl = REST[live], sC = Math.max(W / Rl.w, H / Rl.h);
  const cL = { x: Rl.x + Rl.w / 2, y: Rl.y + Rl.h / 2 }, c1 = { x: W / 2, y: H / 2 };
  const F = { x: (c1.x - cL.x * sC) / (1 - sC), y: (c1.y - cL.y * sC) / (1 - sC) };
  const coverH = Rl.h * sC;
  if (!ending) {
    z = ease(sm(0.035, 0.24, ps)); c = sm(0.23, 0.40, ps);
    pour = lerp(-0.8, 6.6, clamp((ps - 0.40) / 0.185, 0, 1));
    l = clamp((ps - 0.585) / (0.975 - 0.585), 0, 1);
    week = sv > DIVE ? weekAt(sv) : 5.95;
    realOnly = pour >= 6.55;
    k = c > 0 ? lerpK(K0, K1, c) : K0;
    if (l > 0) k = lerpK(K1, K3, l, { f: sm(0, 0.62, l), e: sm(0.22, 1, l), T: sm(0.18, 1, l), h: sm(0.18, 1, l) });
    if (sv > DIVE) { const w = walkAt(sv); k = toK(w.P, w.L, EYE_FOV); }
  } else {
    week = 38;
    const lo = clamp((sv - END.out[0]) / (END.out[1] - END.out[0]), 0, 1);
    const lu = clamp((sv - END.unpour[0]) / (END.unpour[1] - END.unpour[0]), 0, 1);
    const lz = clamp((sv - END.zoom[0]) / (END.zoom[1] - END.zoom[0]), 0, 1);
    const K06s = { T: K0.T, az: K0.az, el: K0.el, h: K0.h * H / coverH, fov: 2 };
    k = lerpK(KW, K06s, lo, { f: sm(0, 0.78, lo), e: sm(0.3, 1, lo), T: sm(0.22, 1, lo), h: sm(0.22, 1, lo) });
    pour = lerp(38.8, -1.8, ease(lu));
    realOnly = lu <= 0;
    z = 1 - ease(lz); c = lz > 0 ? 1 : 0;
    if (lz > 0) k = K0;
  }
  U.real.value = week; lightFor(week);

  const s = Math.exp(Math.log(sC) * z);
  const zr = (r) => ({ x: F.x + (r.x - F.x) * s, y: F.y + (r.y - F.y) * s, w: r.w * s, h: r.h * s });
  sheet.style.transform = z > 0 ? `translate(${F.x * (1 - s)}px, ${F.y * (1 - s)}px) scale(${s})` : 'none';
  sheet.style.opacity = 1 - sm(0.5, 0.92, z);
  const rects = REST.map(zr);
  const cover = rects[live];
  if (!ending) rectL = c > 0 ? { x: lerp(cover.x, 0, c), y: lerp(cover.y, 0, c), w: lerp(cover.w, W, c), h: lerp(cover.h, H, c) } : cover;
  else rectL = sv < END.zoom[0] ? screenRect() : cover;
  rects[live] = rectL;

  const diving = z > 0.02 && !ending;
  document.body.classList.toggle('closing', ending && sv > END.zoom[0] + 0.45);
  const onSite = (pour > -0.5 || sv > DIVE) && !(ending && sv > END.unpour[0] + 0.3);
  if (onSite) {
    if (!prog.classList.contains('hud')) { prog.classList.add('hud'); placeHud(); }
    prog.style.opacity = ending ? 1 - sm(END.unpour[0], END.unpour[0] + 0.3, sv) : clamp((pour + 0.5) / 0.8, 0, 1);
    clock(sv > DIVE ? week : clamp(pour, 0, 5.95), true);
  } else {
    if (prog.classList.contains('hud')) { prog.classList.remove('hud'); SEQ.place('dock'); }
    if (ending) { SEQ.place('dock'); prog.style.opacity = sm(END.zoom[0] + 0.4, END.zoom[1], sv); clock(WEEKS, true); }
    else { prog.style.opacity = !diving ? 1 : 1 - clamp(z * 3, 0, 1); clock(S.now, S.drawT > 0 && !diving); }
  }
  const site = onSite && (!ending || sv < END.unpour[0] + 0.5);
  bar.classList.toggle('over', site); document.body.classList.toggle('site', site);
  const chipTxt = chipFor(sv, week, pour, diving);
  if (chip.dataset.t !== chipTxt) { chip.innerHTML = chipTxt; chip.dataset.t = chipTxt; }
  chip.classList.toggle('on', !!chipTxt);
  hint.classList.toggle('on', S.drawn && sv < 0.3);

  const key = [W, H, sv.toFixed(4), S.now.toFixed(3)].join(',');
  aim(cam, k, rectL, W, H);
  drawNotes(ending ? 0 : c * (1 - clamp((pour + 0.8) / 1.2, 0, 1)));
  if (key === lastKey) return;
  lastKey = key;
  const realOn = ending ? sv < END.zoom[0] : pour > -0.8;
  if (!realOnly) {
    const allTiles = !(ending ? sv < END.zoom[0] : c > 0.02);
    pipe.draw(TILES.map((t, i) => ({
      rect: rects[i], cam: i === live ? k : K0, hidden: i !== live && !allTiles,
      now: diving || ending ? t.w1 : Math.min(S.now, t.w1), newFrom: t.w0,
    })));
  }
  if (pipe.shafts) {
    const inHouse = sv > DIVE + 4 && !ending ? 1 : ending ? 1 - sm(END.out[0], END.out[0] + 0.6, sv) : 0;
    const dens = inHouse * (0.018 * sm(16.2, 17.2, week) * (1 - sm(20.5, 22.8, week)) + 0.006 * sm(34.5, 37.2, week));
    pipe.shafts.enabled = realOn && dens > 1e-4;
    if (pipe.shafts.enabled) {
      const u = pipe.shafts.uniforms;
      u.uDensity.value = dens; u.tShadow.value = sun.shadow.map ? sun.shadow.map.texture : null;
      u.uShadowMat.value.copy(sun.shadow.matrix); u.uSunCol.value.copy(sun.color).multiplyScalar(sun.intensity);
      u.uSunDir.value.copy(sun.position).sub(sun.target.position).normalize();
      if (!u.tShadow.value) pipe.shafts.enabled = false;
    }
  }
  if (realOn) pipe.real({ cam: k, rect: rectL });
  pipe.show({ rect0: rectL, now: diving || ending ? 99 : S.now, glow: diving || ending ? 0 : 1, pour, realOn, realOnly });
}
function placeHud() {
  const w = PHONE ? W - 28 : Math.min(580, W - 48);
  prog.style.transform = 'none'; prog.style.width = w + 'px';
  prog.style.left = (PHONE ? 14 : 24) + 'px';
  prog.style.top = H - prog.querySelector('.rows').offsetHeight - (PHONE ? 20 : 26) + 'px';
}
if (!OFFLINE) requestAnimationFrame(frame);
const animStart = new WeakMap();
window.__frame = (vt) => {
  frame(vt);
  for (const a of document.getAnimations()) { if (!animStart.has(a)) animStart.set(a, vt); a.pause(); a.currentTime = Math.max(0, vt - animStart.get(a)); }
};

addEventListener('resize', () => {
  W = innerWidth; H = innerHeight;
  renderer.setSize(W, H, false); pipe.setSize(W, H, DPR, DPR_REAL);
  measure(); if (prog.classList.contains('hud')) placeHud(); else SEQ.place(SEQ.docked ? 'dock' : 'loader'); lastKey = '';
});
window.__seq = { pipe, cam, scene, U, S, renderer, END, get sv() { return sv; } };
window.__ready = true;
