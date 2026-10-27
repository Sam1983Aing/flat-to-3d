// Direction sketches for The Build. One scene, three ways of showing it.
//   ?dir=a  The Programme: the Gantt on the left, the site on the right, one "today" line drives both.
//   ?dir=b  The Sheet is the Site: the foundation plan and programme printed at 1:1 on the ground.
//   ?dir=c  Site Camera: the builder's time-lapse, the programme as a band along the bottom.
// Other params: wk (week, 0 to 14), shot (camera), tod (hour of day), ghost (0 to 1), open (A: chart only), room (entry|living|kitchen|loft|overlook).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildHouse, groundWithPit, PHASES, WEEKS, C, dateAt, clamp01, smooth, HX, HZ, FL, RIDGE, MEZZ, BAYS, PIT } from './house.js';

const q = new URLSearchParams(location.search);
const DIR = q.get('dir') || 'a';
const INIT_WK = Math.min(WEEKS, Math.max(0, parseFloat(q.get('wk') ?? '7')));
const INIT_SHOT = q.get('shot') || 'sig';
const INIT_TOD = parseFloat(q.get('tod') ?? '15.5');
const INIT_GHOST = parseFloat(q.get('ghost') ?? (DIR === 'b' ? '1' : '0'));
const INIT_OPEN = q.has('open');
const INIT_ROOM = q.get('room') || null;

// ------------------------------------------------------------------ 5-Stop Multi-Room Interior Walkthrough Spline
const INTERIOR_STOPS = [
  {
    id: 'entry',
    u: 0.00,
    tab: '01 ENTRY',
    lv: 'STOP 01 // EL +0.15M THRESHOLD',
    title: 'Entry Threshold',
    spec: 'Hinged European oak front door · basalt threshold · view into the frame',
  },
  {
    id: 'living',
    u: 0.25,
    tab: '02 LIVING',
    lv: 'STOP 02 // EL +0.15M · 6.75M RIDGE',
    title: 'Living & Hearth',
    spec: 'Double-height GL28c spruce portals · cast-iron stove · bookcase · east gable',
  },
  {
    id: 'kitchen',
    u: 0.50,
    tab: '03 KITCHEN',
    lv: 'STOP 03 // EL +0.15M · UNDER CLT DECK',
    title: 'Kitchen & Dining',
    spec: 'Waterfall travertine & oak island · brass fixtures · 6-seat dining table',
  },
  {
    id: 'loft',
    u: 0.82,
    tab: '04 LOFT',
    lv: 'STOP 04 // EL +3.05M MEZZANINE',
    title: 'The Loft Suite',
    spec: '100mm 5-ply CLT deck · oak platform bed · architect’s study desk',
  },
  {
    id: 'overlook',
    u: 1.00,
    tab: '05 OVERLOOK',
    lv: 'STOP 05 // EL +3.05M GALLERY EDGE',
    title: 'Gallery Overlook',
    spec: 'Glass balustrade · double-height living room & eastern garden terrace',
  },
];

// Keyframes along the continuous Catmull-Rom interior walkthrough spline (u in [0, 1])
const TOUR_KEYS = [
  { u: 0.00, pos: [1.55, 1.58, 4.15],  at: [1.55, 1.56, -1.20], fov: 54 }, // 01 ENTRY THRESHOLD
  { u: 0.12, pos: [1.35, 1.56, 2.55],  at: [3.60, 1.62, -1.00], fov: 58 }, // Stepping through open oak door
  { u: 0.25, pos: [0.65, 1.58, 2.25],  at: [4.25, 1.65, -1.35], fov: 60 }, // 02 LIVING & HEARTH (bookcase + stove + sofa + east gable)
  { u: 0.38, pos: [0.45, 1.52, 1.95],  at: [-2.80, 1.42, -0.20], fov: 58 }, // Turning west around foot of stair
  { u: 0.50, pos: [-0.55, 1.50, 1.15], at: [-4.20, 1.38, -0.35], fov: 58 }, // 03 KITCHEN & DINING
  { u: 0.58, pos: [0.58, 1.68, 1.35],  at: [-1.20, 2.85, -1.20], fov: 58 }, // Stepping onto bottom tread of glulam stair
  { u: 0.67, pos: [0.58, 3.10, -0.55], at: [-2.60, 3.85, 0.35], fov: 58 }, // Ascending glulam stair
  { u: 0.74, pos: [0.35, 4.25, -1.85], at: [-3.50, 3.75, 0.45], fov: 60 }, // Top landing on mezzanine
  { u: 0.82, pos: [-0.45, 4.28, -1.75],at: [-3.85, 3.45, 0.95], fov: 62 }, // 04 THE LOFT SUITE (platform bed + study desk)
  { u: 1.00, pos: [-0.32, 4.48, 0.55], at: [4.85, 1.55, -0.55], fov: 60 }, // 05 GALLERY OVERLOOK (double-height view)
];

const tourPosCurve = new THREE.CatmullRomCurve3(TOUR_KEYS.map(k => new THREE.Vector3(...k.pos)), false, 'centripetal');
const tourAtCurve = new THREE.CatmullRomCurve3(TOUR_KEYS.map(k => new THREE.Vector3(...k.at)), false, 'centripetal');

function sampleTourSpline(u) {
  const uc = clamp01(u);
  // Map u piecewise-linearly to spline parameter t in [0, 1] across TOUR_KEYS
  let idx = 0;
  for (let i = 0; i < TOUR_KEYS.length - 1; i++) {
    if (uc >= TOUR_KEYS[i].u && uc <= TOUR_KEYS[i + 1].u) { idx = i; break; }
  }
  const k0 = TOUR_KEYS[idx], k1 = TOUR_KEYS[idx + 1];
  const localT = k1.u > k0.u ? (uc - k0.u) / (k1.u - k0.u) : 0;
  const splineT = (idx + localT) / (TOUR_KEYS.length - 1);
  const pos = tourPosCurve.getPoint(splineT);
  const at = tourAtCurve.getPoint(splineT);
  const fov = k0.fov + (k1.fov - k0.fov) * localT;
  return { pos: [pos.x, pos.y, pos.z], at: [at.x, at.y, at.z], fov };
}

function activeInteriorStop(u) {
  let best = INTERIOR_STOPS[0], minDist = Infinity;
  for (const st of INTERIOR_STOPS) {
    const d = Math.abs(u - st.u);
    if (d < minDist) { minDist = d; best = st; }
  }
  return best;
}

const initRoomObj = INIT_ROOM ? INTERIOR_STOPS.find(s => s.id === INIT_ROOM) : null;
const initTourVal = initRoomObj ? initRoomObj.u : (INIT_SHOT === 'inside' ? 0.25 : 0.0);

const state = {
  dir: DIR,
  wk: INIT_WK,
  targetWk: INIT_WK,
  shot: INIT_SHOT,
  camMode: q.has('shot') ? INIT_SHOT : 'auto',
  tod: INIT_TOD,
  ghost: INIT_GHOST,
  open: INIT_OPEN,
  playing: false,
  userMoved: false,
  tour: initTourVal,
  targetTour: initTourVal,
  roomPinned: !!initRoomObj,
};

const pad2 = n => String(n).padStart(2, '0');
const fmtDay = d => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const weekNo = w => Math.min(WEEKS, Math.floor(w) + 1);
const activePhases = w => PHASES.filter(p => w >= p.w0 && w < p.w1);

// ------------------------------------------------------------------ renderer & PBR environment
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const bgCol = new THREE.Color(DIR === 'c' ? 0xE2E4DE : C.paper);
scene.background = bgCol;
scene.fog = new THREE.Fog(bgCol, 78, 210);

// Realistic interior/sky PBR reflections for VMZinc roof, anodized frames, glass, brass & oiled oak
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.65;

const hemi = new THREE.HemisphereLight(0xfffcf5, 0xd5cbb8, 1.25);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.65);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 140 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

// Cool sky fill light from S-SE so shaded facades retain crisp board & standing-seam relief
const fillLight = new THREE.DirectionalLight(0xe2ebf6, 0.62);
fillLight.position.set(16, 24, 28);
scene.add(fillLight);

function placeSun(hour, week) {
  const phi = (hour - 12) / 6 * Math.PI / 2;
  const elMax = THREE.MathUtils.degToRad(38 + 22 * week / WEEKS);
  const el = Math.max(THREE.MathUtils.degToRad(5), elMax * Math.sin(Math.PI * clamp01((hour - 5) / 15)));
  const d = new THREE.Vector3(-Math.sin(phi) * Math.cos(el), Math.sin(el), Math.cos(phi) * Math.cos(el));
  sun.position.copy(d.multiplyScalar(60));
  sun.target.position.set(0, 0, 0);
  const warm = 1 - clamp01((el - 0.12) / 0.5);
  sun.color.set(0xfff4e6).lerp(new THREE.Color(0xffc48a), warm * 0.8);
  sun.intensity = 2.65 * (0.55 + 0.45 * clamp01(el / 0.5));
  return el;
}

// ------------------------------------------------------------------ the house
const house = buildHouse({ ghost: DIR === 'b', lawn: DIR !== 'b' });
scene.add(house.root);

// ------------------------------------------------------------------ ground
const SHEET = { x0: -24, x1: 24, z0: -12, z1: 18 };
let sheetTex = null;
let sheetBaseCanvas = null;
let sheetWorkCanvas = null;
let groundMat;
if (DIR === 'b') {
  sheetTex = drawSheet(state.wk);
  groundMat = new THREE.MeshStandardMaterial({ map: sheetTex, roughness: 0.96, envMapIntensity: 0.25 });
  const us = new THREE.Shape([[-400, -400], [400, -400], [400, 400], [-400, 400]].map(([x, z]) => new THREE.Vector2(x, -z)));
  us.holes.push(new THREE.Path([[SHEET.x0, SHEET.z0], [SHEET.x0, SHEET.z1], [SHEET.x1, SHEET.z1], [SHEET.x1, SHEET.z0]].map(([x, z]) => new THREE.Vector2(x, -z))));
  const under = new THREE.Mesh(new THREE.ShapeGeometry(us).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xE5E0D5, roughness: 1, envMapIntensity: 0.2 }));
  under.position.y = -0.02; under.receiveShadow = true;
  scene.add(under);
} else if (DIR === 'c') {
  groundMat = new THREE.MeshStandardMaterial({ color: 0xD2CFB4, roughness: 0.96, envMapIntensity: 0.25 });
} else {
  groundMat = new THREE.MeshStandardMaterial({ color: C.paper, roughness: 0.96, envMapIntensity: 0.2 });
}
const uvSheet = (x, z) => [(x - SHEET.x0) / (SHEET.x1 - SHEET.x0), 1 - (z - SHEET.z0) / (SHEET.z1 - SHEET.z0)];
let ground, cap;
if (DIR === 'b') {
  const r = groundWithPit(groundMat, { size: 1, uv: uvSheet });
  const s = new THREE.Shape([[SHEET.x0, SHEET.z0], [SHEET.x1, SHEET.z0], [SHEET.x1, SHEET.z1], [SHEET.x0, SHEET.z1]].map(([x, z]) => new THREE.Vector2(x, -z)));
  s.holes.push(new THREE.Path([[PIT.x0, PIT.z0], [PIT.x0, PIT.z1], [PIT.x1, PIT.z1], [PIT.x1, PIT.z0]].map(([x, z]) => new THREE.Vector2(x, -z))));
  const g = new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2);
  const p = g.attributes.position, u = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const [a, b] = uvSheet(p.getX(i), p.getZ(i)); u.setXY(i, a, b); }
  ground = new THREE.Mesh(g, groundMat); ground.receiveShadow = true;
  cap = r.cap;
} else {
  ({ ground, cap } = groundWithPit(groundMat));
}
scene.add(ground, cap);

let mudMesh = null;
if (DIR === 'c') {
  const S = house.SITE;
  const s = new THREE.Shape([[S.x0, S.z0], [S.x1, S.z0], [S.x1, S.z1], [S.x0, S.z1]].map(([x, z]) => new THREE.Vector2(x, -z)));
  s.holes.push(new THREE.Path([[PIT.x0, PIT.z0], [PIT.x0, PIT.z1], [PIT.x1, PIT.z1], [PIT.x1, PIT.z0]].map(([x, z]) => new THREE.Vector2(x, -z))));
  mudMesh = new THREE.Mesh(new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: C.mud, roughness: 0.98, envMapIntensity: 0.2 }));
  mudMesh.position.y = 0.004; mudMesh.receiveShadow = true;
  mudMesh.visible = state.wk > 0.25 && state.wk < 13.3;
  scene.add(mudMesh);
}
if (DIR === 'a') {
  const S = house.SITE, y = 0.01, m = 1.5;
  const pts = [[S.x0 - m, S.z0 - m], [S.x1 + m, S.z0 - m], [S.x1 + m, S.z1 + m], [S.x0 - m, S.z1 + m], [S.x0 - m, S.z0 - m]].map(([x, z]) => new THREE.Vector3(x, y, z));
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: C.ink, dashSize: 1.2, gapSize: 0.4, transparent: true, opacity: 0.42 }));
  l.computeLineDistances();
  scene.add(l);
}

// ------------------------------------------------------------------ cameras
const SHOTS = {
  sig:      { pos: [19, 8.6, 21],     at: [0.2, 2.6, 0],     fov: 34 },
  a2:       { pos: [22, 15, 25],      at: [0, 0, 0.5],       fov: 32 },
  top:      { pos: [0, 48.5, 3.05],   at: [0, 0, 3.0],       fov: 34 },
  b2:       { pos: [6, 25, 24],       at: [0, 0, 3.0],       fov: 36 },
  b3:       { pos: [15.5, 9.8, 23],   at: [-1.2, 2.2, 3.4],  fov: 38 },
  inside:   sampleTourSpline(initTourVal),
  cam:      { pos: [18.5, 9.2, 20.5], at: [-0.6, 2.0, -0.6], fov: 37 },
  path:     { pos: [6.5, 1.65, 20.5], at: [1.2, 3.1, 0],     fov: 42 },
};

const curCamPos = new THREE.Vector3(...(SHOTS[state.shot] || SHOTS.sig).pos);
const curCamAt = new THREE.Vector3(...(SHOTS[state.shot] || SHOTS.sig).at);
let curCamFov = (SHOTS[state.shot] || SHOTS.sig).fov;

const camera = new THREE.PerspectiveCamera(curCamFov, innerWidth / innerHeight, 0.08, 600);

function getTargetCameraPose(shotKey) {
  if (shotKey === 'inside') {
    return sampleTourSpline(state.tour);
  }
  return SHOTS[shotKey] || SHOTS.sig;
}

function applyCamera(shotKey, lerpFactor = 1) {
  const s = getTargetCameraPose(shotKey);
  if (lerpFactor >= 0.999) {
    curCamPos.set(...s.pos);
    curCamAt.set(...s.at);
    curCamFov = s.fov;
  } else {
    curCamPos.lerp(new THREE.Vector3(...s.pos), lerpFactor);
    curCamAt.lerp(new THREE.Vector3(...s.at), lerpFactor);
    curCamFov += (s.fov - curCamFov) * lerpFactor;
  }
  camera.fov = curCamFov;
  camera.aspect = innerWidth / innerHeight;
  if (state.dir === 'a' && !state.open) {
    const yOff = state.shot === 'inside' ? Math.round(innerHeight * 0.05) : Math.round(innerHeight * 0.095);
    camera.setViewOffset(innerWidth, innerHeight, 0, yOff, innerWidth, innerHeight);
  } else {
    camera.clearViewOffset();
  }
  camera.updateProjectionMatrix();
  camera.position.copy(curCamPos);
  camera.lookAt(curCamAt);
}

// Compute automatic camera shot when user scrolls through the 14 weeks
function autoShotForWeek(w) {
  if (!state.userMoved) return state.shot;
  if (state.dir === 'a') {
    if (w < 1.8) return 'a2';
    if (w >= 13.38) return 'inside';
    return 'sig';
  } else if (state.dir === 'b') {
    if (w < 0.45 || w >= 13.6) return 'top';
    if (w < 2.6) return 'b2';
    return 'b3';
  } else {
    if (w >= 13.48) return 'inside';
    if (w >= 13.2) return 'path';
    return 'cam';
  }
}

function updateSceneForWeek(w, lerpCam = 1) {
  const targetShot = state.camMode === 'auto' ? autoShotForWeek(w) : state.camMode;
  state.shot = targetShot;

  // When entering the house automatically via scroll/scrub in week 13.38..14.0, drive the 5-room tour spline
  if (targetShot === 'inside' && state.userMoved && !state.roomPinned) {
    const startW = state.dir === 'c' ? 13.48 : 13.38;
    state.targetTour = clamp01((w - startW) / Math.max(0.01, WEEKS - startW));
    if (lerpCam >= 0.999) state.tour = state.targetTour;
  }

  applyCamera(targetShot, lerpCam);

  if (state.userMoved) {
    if (state.dir === 'c') {
      state.tod = 7.3 + (w / WEEKS) * 11.1;
    } else if (state.dir === 'b') {
      state.ghost = w < 0.35 || w > 13.5 ? 0 : w < 2.2 ? 0.45 : 1.0;
    }
  }
  const hour = state.dir === 'c' ? state.tod : state.dir === 'b' ? 13.6 : 15.5;
  placeSun(hour, w);
  hemi.intensity = state.shot === 'inside' ? 1.65 : 1.25;
  scene.environmentIntensity = state.shot === 'inside' ? 0.82 : 0.65;
  if (state.dir === 'c') hemi.color.set(0xf4f7ff);

  if (mudMesh) mudMesh.visible = w > 0.25 && w < 13.3;
  house.update(w, { ghost: state.ghost, cap });
}

updateSceneForWeek(state.wk, 1);

// ------------------------------------------------------------------ the programme SVG, drawn from PHASES
function programmeSVG(T, W, H, o = {}) {
  const compact = !!o.compact;
  const showDur = o.showDur ?? !compact;
  const labelW = o.labelW ?? (compact ? 176 : 210);
  const durW = showDur ? 48 : 0;
  const headH = compact ? 22 : 54;
  const rows = PHASES.length;
  const msH = compact ? 0 : 34;
  const rowH = Math.max(12, (H - headH - msH) / rows);
  const x0 = labelW, x1 = Math.max(x0 + 50, W - durW);
  const X = w => x0 + (x1 - x0) * w / WEEKS;
  const Y = i => headH + i * rowH;
  const ink = 'var(--ink)', acc = 'var(--accent)';

  let s = `<svg class="gantt-svg" data-x0="${x0}" data-x1="${x1}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
  s += `<defs><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="rgba(29,28,25,0.3)" stroke-width="1"/></pattern></defs>`;

  if (!compact) {
    s += `<line x1="0" y1="${headH - 2}" x2="${W}" y2="${headH - 2}" stroke="${ink}" stroke-width="1.2"/>`;
    s += `<text x="0" y="${headH - 23}" font-family="IBM Plex Mono" font-size="10" font-weight="600" fill="rgba(29,28,25,0.68)">WBS // PHASE</text>`;
    s += `<text x="0" y="${headH - 9}" font-family="IBM Plex Mono" font-size="8.5" fill="rgba(29,28,25,0.5)">CRITICAL PATH</text>`;
    s += `<text x="${W}" y="${headH - 23}" font-family="IBM Plex Mono" font-size="10" font-weight="600" fill="rgba(29,28,25,0.68)" text-anchor="end">DUR</text>`;
  } else {
    s += `<line x1="0" y1="${headH - 2}" x2="${W}" y2="${headH - 2}" stroke="rgba(29,28,25,0.28)" stroke-width="1"/>`;
    s += `<text x="0" y="14" font-family="IBM Plex Mono" font-size="9.5" font-weight="600" fill="rgba(29,28,25,0.68)">WBS // CRITICAL PATH</text>`;
    if (showDur) s += `<text x="${W}" y="14" font-family="IBM Plex Mono" font-size="9.5" font-weight="600" fill="rgba(29,28,25,0.68)" text-anchor="end">DUR</text>`;
  }

  for (let k = 0; k <= WEEKS; k++) {
    const x = X(k);
    s += `<line x1="${x}" y1="${compact ? 0 : headH - 10}" x2="${x}" y2="${H - msH}" stroke="rgba(29,28,25,${k % 4 === 0 ? 0.24 : 0.1})" stroke-width="1"/>`;
    if (k < WEEKS) {
      const d = dateAt(k);
      if (compact) {
        s += `<text x="${X(k + 0.5)}" y="14" font-family="IBM Plex Mono" font-size="9.5" font-weight="600" fill="${ink}" text-anchor="middle">WK ${pad2(k + 1)}</text>`;
      } else {
        s += `<text x="${X(k + 0.5)}" y="${headH - 23}" font-family="IBM Plex Mono" font-size="10.5" font-weight="600" fill="${ink}" text-anchor="middle">${pad2(k + 1)}</text>`;
        const prev = k ? dateAt(k - 1) : null;
        if (o.dates) {
          s += `<text x="${X(k + 0.5)}" y="${headH - 9}" font-family="IBM Plex Mono" font-size="8.5" fill="rgba(29,28,25,0.55)" text-anchor="middle">${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}</text>`;
        } else if (!prev || prev.getMonth() !== d.getMonth()) {
          s += `<text x="${X(k) + 3}" y="${headH - 9}" font-family="IBM Plex Mono" font-size="8.5" font-weight="500" fill="rgba(29,28,25,0.58)">${d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}</text>`;
        }
      }
    }
  }

  PHASES.forEach((p, i) => {
    const y = Y(i), bh = rowH * (compact ? 0.58 : 0.45), by = y + (rowH - bh) / 2;
    const live = T >= p.w0 && T < p.w1, done = T >= p.w1;
    s += `<g class="gantt-row" data-phase="${p.n}" data-w0="${p.w0}" data-w1="${p.w1}">`;
    s += `<rect class="row-bg" x="0" y="${y}" width="${W}" height="${rowH}" fill="${live ? 'rgba(232,93,4,0.08)' : 'transparent'}"/>`;
    s += `<line x1="0" y1="${y + rowH}" x2="${W}" y2="${y + rowH}" stroke="rgba(29,28,25,0.11)"/>`;

    const fs = compact ? 11 : 13.5;
    s += `<text x="0" y="${y + rowH / 2 + fs * 0.35}" font-family="IBM Plex Mono" font-size="${compact ? 9.5 : 10.5}" fill="${live ? acc : done ? ink : 'rgba(29,28,25,0.55)'}" font-weight="${live ? 600 : 500}">${pad2(p.n)}</text>`;
    s += `<text x="${compact ? 24 : 30}" y="${y + rowH / 2 + fs * 0.35}" font-family="Chakra Petch" font-size="${fs}" fill="${ink}" font-weight="${live ? 700 : 600}" letter-spacing="0.03em">${p.name.toUpperCase()}</text>`;

    s += `<rect x="${X(p.w0)}" y="${by}" width="${Math.max(2, X(p.w1) - X(p.w0))}" height="${bh}" fill="url(#hatch)" stroke="${ink}" stroke-width="1"/>`;
    const pe = Math.min(T, p.w1);
    if (pe > p.w0) {
      s += `<rect x="${X(p.w0)}" y="${by}" width="${Math.max(1, X(pe) - X(p.w0))}" height="${bh}" fill="${live ? acc : ink}"/>`;
    }
    if (showDur) {
      const days = Math.round((p.w1 - p.w0) * 5);
      s += `<text x="${W}" y="${y + rowH / 2 + 3.5}" font-family="IBM Plex Mono" font-size="9.5" fill="${live ? acc : 'rgba(29,28,25,0.65)'}" font-weight="${live ? 600 : 400}" text-anchor="end">${days}d</text>`;
    }
    if (i < rows - 1) {
      const n = PHASES[i + 1];
      if (n.w0 >= p.w1 - 0.25) {
        s += `<path d="M${X(p.w1)} ${by + bh / 2} H${X(n.w0) - 5} V${Y(i + 1) + rowH / 2}" fill="none" stroke="rgba(29,28,25,0.38)" stroke-width="1"/>`;
      } else {
        s += `<path d="M${X(n.w0) - 5} ${by + bh} V${Y(i + 1) + rowH / 2} H${X(n.w0)}" fill="none" stroke="rgba(29,28,25,0.38)" stroke-width="1"/>`;
      }
    }
    s += `</g>`;
  });

  if (!compact) {
    const my = H - msH / 2 + 3;
    s += `<text x="0" y="${my + 4}" font-family="IBM Plex Mono" font-size="10" font-weight="600" fill="rgba(29,28,25,0.65)">MILESTONES</text>`;
    for (const [w, name] of [[3.6, 'M1 · Slab'], [10.6, 'M2 · Weathertight'], [14, 'M3 · Keys']]) {
      const x = X(w), on = T >= w - 0.02;
      s += `<path d="M${x} ${my - 6} L${x + 6} ${my} L${x} ${my + 6} L${x - 6} ${my} Z" fill="${on ? acc : 'var(--paper)'}" stroke="${ink}" stroke-width="1.2"/>`;
      s += `<text x="${x + (w > 10 ? -10 : 10)}" y="${my + 4}" font-family="IBM Plex Mono" font-size="10" font-weight="${on ? 600 : 400}" fill="${ink}" text-anchor="${w > 10 ? 'end' : 'start'}">${name.toUpperCase()}</text>`;
    }
  }

  const tx = X(T);
  s += `<line x1="${tx}" y1="0" x2="${tx}" y2="${H - (compact ? 0 : msH - 6)}" stroke="${acc}" stroke-width="${compact ? 2 : 2}"/>`;
  const lab = `TODAY · ${fmtDay(dateAt(T)).toUpperCase()}`;
  const lw = lab.length * 6.2 + 12;
  const lx = Math.min(Math.max(tx - lw / 2, x0), W - lw);
  s += `<rect x="${lx}" y="${compact ? -10 : -6}" width="${lw}" height="15" fill="${acc}"/>`;
  s += `<text x="${lx + lw / 2}" y="${compact ? 1 : 6}" font-family="IBM Plex Mono" font-size="9" font-weight="600" fill="#fff" text-anchor="middle" letter-spacing="0.04em">${lab}</text>`;
  return s + '</svg>';
}

// ------------------------------------------------------------------ CAD Mode & Telemetry Control Bar + HUD
const hud = document.getElementById('hud');

function renderCadHudBrackets() {
  return `<div id="cad-hud"><div class="ch-c tl"></div><div class="ch-c tr"></div><div class="ch-c bl"></div><div class="ch-c br"></div></div>`;
}

function renderCadBar() {
  const centerTop = state.dir === 'b' || state.dir === 'c' || state.open;
  const wkStr = `WK ${pad2(Math.floor(state.wk))}.${Math.floor((state.wk % 1) * 10)}`;
  return `
    <div class="cad-bar ${centerTop ? 'center-top' : ''}">
      <div class="grp">
        <span class="grp-lbl">DIR</span>
        <button class="cad-btn ${state.dir === 'a' ? 'on' : ''}" data-dir="a" title="Direction A: The Programme">A // PROG</button>
        <button class="cad-btn ${state.dir === 'b' ? 'on' : ''}" data-dir="b" title="Direction B: 1:1 Site Sheet">B // 1:1 SHEET</button>
        <button class="cad-btn ${state.dir === 'c' ? 'on' : ''}" data-dir="c" title="Direction C: Site Camera">C // CAM</button>
      </div>
      <div class="grp grp-cam">
        <span class="grp-lbl">CAM</span>
        <button class="cad-btn ${state.camMode === 'auto' ? 'on' : ''}" data-cam="auto">AUTO</button>
        <button class="cad-btn ${state.camMode === 'sig' ? 'on' : ''}" data-cam="sig">ISO</button>
        <button class="cad-btn ${state.camMode === 'a2' ? 'on' : ''}" data-cam="a2">HIGH</button>
        <button class="cad-btn ${state.camMode === 'top' ? 'on' : ''}" data-cam="top">TOP</button>
        <button class="cad-btn ${state.camMode === 'path' ? 'on' : ''}" data-cam="path">PATH</button>
        <button class="cad-btn ${state.camMode === 'inside' || state.shot === 'inside' ? 'on' : ''}" data-cam="inside">INSIDE</button>
      </div>
      <div class="grp">
        <button class="cad-btn play-btn ${state.playing ? 'on' : ''}" data-action="play">${state.playing ? '❚❚ PAUSE' : '▶ BUILD'}</button>
        <div class="cad-scrub">
          <input type="range" min="0" max="14" step="0.02" value="${state.wk.toFixed(2)}" aria-label="Scrub build week">
          <span class="wk-readout">${wkStr}</span>
        </div>
      </div>
    </div>`;
}

function renderRoomOrPhaseCard(T, splitVp = false) {
  const isInside = state.shot === 'inside';
  const curStop = activeInteriorStop(state.tour);
  const showRoomTabs = isInside || T >= 13.1;
  const tabsHtml = showRoomTabs ? `
    <div class="room-tabs">
      ${INTERIOR_STOPS.map(st => `<button class="room-tab ${isInside && curStop.id === st.id ? 'on' : ''}" data-room="${st.id}">${st.tab}</button>`).join('')}
    </div>` : '';

  if (isInside) {
    return `
      <div class="room-card ${splitVp ? 'split-vp' : ''}">
        <span class="lv">${curStop.lv}</span>
        <b>${curStop.title}</b>
        <span class="nt">${curStop.spec}</span>
        ${tabsHtml}
      </div>`;
  }

  const pct = Math.round(100 * T / WEEKS);
  const livePhases = activePhases(T);
  const nowTitle = livePhases.length ? livePhases.map(p => p.name).join(' + ') : (T >= WEEKS ? 'Practical Completion' : 'Site Mobilisation');
  const activeSpec = livePhases.length ? livePhases[livePhases.length - 1].spec : (T >= WEEKS ? 'Keys handed over · Scroll or select a room below to tour inside' : 'Heras perimeter · welfare cabin · datum profiles');
  const activeCode = livePhases.length ? livePhases.map(p => p.code).join('+') : (T >= WEEKS ? 'TR-10' : 'TR-01');

  return `
    <div class="room-card ${splitVp ? 'split-vp' : ''}">
      <span class="lv">${activeCode} // WK ${pad2(weekNo(T))} · ${pct}% COMPLETE</span>
      <b>${nowTitle}</b>
      <span class="nt">${activeSpec}</span>
      ${tabsHtml}
    </div>`;
}

function renderHud() {
  const T = state.wk;
  const day = dateAt(T);
  const pct = Math.round(100 * T / WEEKS);
  const livePhases = activePhases(T);
  const nowNames = livePhases.map(p => p.name);
  const activeSpec = livePhases.length ? livePhases[livePhases.length - 1].spec : (T >= WEEKS ? 'Practical completion · Scroll or select a room to tour inside' : 'Site mobilisation · Heras perimeter');
  const activeCode = livePhases.length ? livePhases.map(p => p.code).join('+') : (T >= WEEKS ? 'TR-10' : 'TR-01');
  const curStop = activeInteriorStop(state.tour);
  const isInside = state.shot === 'inside';

  if (state.dir === 'a') {
    if (state.open) {
      hud.innerHTML = `
        ${renderCadHudBrackets()}
        ${renderCadBar()}
        <div class="prog full">
          <div class="top mono">
            <span class="brand-badge">PURLIN</span>
            <span class="dwg-tag">DWG 08-101 · REV C</span>
          </div>
          <h1>Your house in<br><em>14 weeks.</em></h1>
          <div class="meta mono">
            <span><b>FENWICK LANE</b></span>
            <span>START MON 1 MAR 2027</span>
            <span>KEYS FRI 4 JUN 2027</span>
            <span>GIA 142 M² · GL28c</span>
          </div>
          <div class="chart"></div>
          <div class="foot">
            <div class="hint mono"><i></i>Every bar is a part of the house. Scroll or drag the schedule to build it.</div>
            <div class="note mono">TIMBER PORTAL · 142 M² · 3 BED<span class="spec-line">CPM BASELINE // 70 WORKING DAYS</span></div>
          </div>
        </div>`;
      const ch = hud.querySelector('.chart');
      const r = ch.getBoundingClientRect();
      ch.innerHTML = programmeSVG(T, r.width, r.height, { labelW: 236, dates: true });
    } else {
      const sideLv = isInside ? curStop.lv : `${activeCode} // ${pct}% COMPLETE · CAM ${state.shot.toUpperCase()}`;
      const sideTitle = isInside ? curStop.title : (nowNames.join(' + ') || (T >= WEEKS ? 'Practical Completion' : 'Site Mobilisation'));
      const sideSpec = isInside ? curStop.spec : activeSpec;
      const roomTabsHtml = `<div class="room-tabs">${INTERIOR_STOPS.map(st => `<button class="room-tab ${isInside && curStop.id === st.id ? 'on' : ''}" data-room="${st.id}">${st.tab}</button>`).join('')}</div>`;

      hud.innerHTML = `
        ${renderCadHudBrackets()}
        ${renderCadBar()}
        <div class="prog-hero ${isInside ? 'inside-dim' : ''}">
          <div class="top-row mono">
            <span class="brand-badge">PURLIN</span>
            <span class="dwg-tag">DWG 08-101 · REV C</span>
          </div>
          <h1>Your house in <em>14 weeks.</em></h1>
          <div class="meta mono">
            <span><b>FENWICK LANE</b></span>
            <span>START 1 MAR 2027</span>
            <span>KEYS 4 JUN 2027</span>
            <span>GIA 142 M² · GL28c</span>
          </div>
        </div>
        <div class="prog">
          <div class="prog-side">
            <div class="side-top">
              <div class="count">Wk ${pad2(weekNo(T))}<small> / 14</small></div>
              <span class="date-badge">${fmtDay(day).toUpperCase()} 2027</span>
            </div>
            <div class="side-body">
              <span class="lv">${sideLv}</span>
              <b class="title">${sideTitle}</b>
              <span class="spec-line">${sideSpec}</span>
            </div>
            ${roomTabsHtml}
          </div>
          <div class="chart"></div>
        </div>`;
      const ch = hud.querySelector('.prog .chart');
      const r = ch.getBoundingClientRect();
      ch.innerHTML = programmeSVG(T, r.width, r.height, { compact: true, labelW: 184, showDur: true });
    }
  } else if (state.dir === 'b') {
    hud.innerHTML = `
      ${renderCadHudBrackets()}
      ${renderCadBar()}
      <div class="corner tl">
        <span class="brand-badge">PURLIN</span>
      </div>
      <div class="corner tr mono" style="color:var(--ink-2)">
        <b style="color:var(--ink)">DWG 08-101</b> · Foundation plan &amp; programme · Scale 1:1
      </div>
      ${renderRoomOrPhaseCard(T, false)}
      <div class="corner br mono" style="color:var(--ink-2)">
        <b style="color:var(--ink)">${fmtDay(day).toUpperCase()} 2027</b> · [${activeCode}]<br>Scroll or drag slider to build &amp; tour inside
      </div>`;
  } else {
    const hh = Math.floor(state.tod), mm = Math.round((state.tod - hh) * 60);
    const inside = state.shot === 'path' || state.shot === 'inside';
    const showTabs = inside || T >= 13.1;
    hud.innerHTML = `
      ${renderCadHudBrackets()}
      ${renderCadBar()}
      <div class="cam ${inside ? 'inside' : ''}">
        ${inside ? '' : '<div class="frame"></div>'}
        <div class="corner tl" style="top:28px;left:32px;padding:0;border:0;background:transparent">
          <span class="brand-badge">${inside ? 'PURLIN' : 'CAM 02'}</span>
        </div>
        <div class="corner tr stamp" style="top:28px;right:32px">${fmtDay(day).toUpperCase()} 2027 · ${pad2(hh)}:${pad2(mm)}</div>
        <div class="band">
          <div class="now">
            <div class="wk">Wk ${pad2(weekNo(T))}<small> / 14 · ${pct}%</small></div>
            <div class="ph mono">
              ${state.shot === 'inside'
                ? `<b>${curStop.title.toUpperCase()}</b><div style="color:rgba(242,239,231,0.78);font-size:9.5px;margin-top:2px">${curStop.spec}</div>`
                : `${T >= WEEKS ? '<b>KEYS HANDED OVER</b>' : `[${activeCode}] <b>${nowNames.join(' + ') || 'SITE ACTIVE'}</b>`}
                   <div style="color:rgba(242,239,231,0.78);font-size:9.5px;margin-top:2px">${activeSpec}</div>`}
              ${showTabs ? `<div class="room-tabs" style="margin-top:6px;padding-top:5px">${INTERIOR_STOPS.map(st => `<button class="room-tab ${state.shot === 'inside' && curStop.id === st.id ? 'on' : ''}" data-room="${st.id}">${st.tab}</button>`).join('')}</div>` : ''}
            </div>
          </div>
          <div class="chart"></div>
        </div>
      </div>`;
    const ch = hud.querySelector('.band .chart');
    const r = ch.getBoundingClientRect();
    ch.innerHTML = programmeSVG(T, r.width, r.height, { compact: true, labelW: 168 });
  }
  bindHudEvents();
}

// ------------------------------------------------------------------ B: the sheet printed on the site (cached static base + fast dynamic overlay)
function ensureSheetBase() {
  if (sheetBaseCanvas) return sheetBaseCanvas;
  const PX = 100;
  const cw = (SHEET.x1 - SHEET.x0) * PX, chh = (SHEET.z1 - SHEET.z0) * PX;
  const cv = document.createElement('canvas');
  cv.width = cw; cv.height = chh;
  const g = cv.getContext('2d');
  const X = x => (x - SHEET.x0) * PX, Z = z => (z - SHEET.z0) * PX;
  const INK = '#1d1c19';
  g.fillStyle = '#f2efe7'; g.fillRect(0, 0, cw, chh);
  let s = 19;
  const r01 = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 20000; i++) {
    g.fillStyle = `rgba(80,70,55,${r01() * 0.04})`;
    g.fillRect(r01() * cw, r01() * chh, 2, 2);
  }
  const line = (pts, w = 2, c = INK, dash = []) => { g.beginPath(); g.setLineDash(dash.map(d => d * PX)); pts.forEach(([x, z], i) => i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))); g.strokeStyle = c; g.lineWidth = w; g.stroke(); g.setLineDash([]); };
  const rectL = (x0, z0, x1, z1, w, c, dash) => line([[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]], w, c, dash);
  const text = (str, x, z, size, o = {}) => {
    g.font = `${o.weight || 500} ${size * PX}px ${o.font || "'IBM Plex Mono'"}`;
    g.fillStyle = o.color || INK; g.textAlign = o.align || 'left'; g.textBaseline = o.base || 'alphabetic';
    if (o.ls) g.letterSpacing = `${o.ls * PX}px`; else g.letterSpacing = '0px';
    g.fillText(str, X(x), Z(z));
  };
  rectL(SHEET.x0 + 0.8, SHEET.z0 + 0.8, SHEET.x1 - 0.8, SHEET.z1 - 0.8, 6);
  rectL(SHEET.x0 + 1.1, SHEET.z0 + 1.1, SHEET.x1 - 1.1, SHEET.z1 - 1.1, 2);

  const GL = ['A', 'B', 'C', 'D', 'E'];
  BAYS.forEach((x, i) => {
    line([[x, -7.0], [x, 5.4]], 2, 'rgba(29,28,25,0.55)', [0.9, 0.18, 0.12, 0.18]);
    g.beginPath(); g.arc(X(x), Z(-7.55), 0.5 * PX, 0, Math.PI * 2); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
    text(GL[i], x, -7.55, 0.52, { align: 'center', base: 'middle', font: "'Chakra Petch'", weight: 700 });
  });
  [-HZ, HZ].forEach((z, i) => {
    line([[-9.6, z], [9.6, z]], 2, 'rgba(29,28,25,0.55)', [0.9, 0.18, 0.12, 0.18]);
    g.beginPath(); g.arc(X(-10.15), Z(z), 0.5 * PX, 0, Math.PI * 2); g.lineWidth = 3; g.stroke();
    text(String(i + 1), -10.15, z, 0.52, { align: 'center', base: 'middle', font: "'Chakra Petch'", weight: 700 });
  });
  rectL(PIT.x0, PIT.z0, PIT.x1, PIT.z1, 2, 'rgba(29,28,25,0.5)', [0.3, 0.2]);
  for (const x of BAYS) for (const z of [-HZ, HZ]) rectL(x - 0.55, z - 0.55, x + 0.55, z + 0.55, 2.5, INK, [0.16, 0.1]);
  rectL(-HX - 0.3, -HZ - 0.3, HX + 0.3, HZ + 0.3, 2.5, INK, [0.16, 0.1]);
  rectL(-HX + 0.3, -HZ + 0.3, HX - 0.3, HZ - 0.3, 2.5, INK, [0.16, 0.1]);
  rectL(-HX - 0.2, -HZ - 0.2, HX + 0.2, HZ + 0.2, 7);

  const dz = -5.6;
  line([[-HX - 0.2, dz], [HX + 0.2, dz]], 2);
  [-HX - 0.2, ...BAYS.slice(1, 4), HX + 0.2].forEach(x => line([[x - 0.18, dz + 0.18], [x + 0.18, dz - 0.18]], 3));
  [-HX - 0.2, ...BAYS.slice(1, 4), HX + 0.2].forEach(x => line([[x, dz + 0.4], [x, dz - 0.25]], 1.5));
  ['3200', '3000', '3000', '3200'].forEach((t, i) => text(t, (BAYS[i] + BAYS[i + 1]) / 2 + (i === 0 ? -0.1 : i === 3 ? 0.1 : 0), dz - 0.22, 0.36, { align: 'center' }));
  line([[-HX - 0.2, dz - 1.2], [HX + 0.2, dz - 1.2]], 2);
  [-HX - 0.2, HX + 0.2].forEach(x => { line([[x - 0.18, dz - 1.02], [x + 0.18, dz - 1.38]], 3); line([[x, dz - 0.8], [x, dz - 1.45]], 1.5); });
  text('12 400', 0, dz - 1.42, 0.36, { align: 'center' });

  text('SLAB 300 RC ON 100 EPS, TOP OF SLAB +0.150', -HX + 0.6, -HZ + 1.1, 0.3);
  text('PAD F1 1100 × 1100 × 350 UNDER EACH FRAME POST', -HX + 0.6, -HZ + 1.6, 0.3);
  text('RING BEAM 600 × 450 ALL ROUND', -HX + 0.6, -HZ + 2.1, 0.3);
  text('FOUNDATION PLAN', 7.6, -1.0, 0.62, { font: "'Chakra Petch'", weight: 700 });
  text('SCALE 1:1. THIS DRAWING IS THE SITE.', 7.6, -0.25, 0.3);

  g.beginPath(); g.arc(X(19.6), Z(-7.6), 1.0 * PX, 0, Math.PI * 2); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
  g.beginPath(); g.moveTo(X(19.6), Z(-8.75)); g.lineTo(X(19.95), Z(-7.3)); g.lineTo(X(19.6), Z(-7.55)); g.lineTo(X(19.25), Z(-7.3)); g.closePath(); g.fillStyle = INK; g.fill();
  text('N', 19.6, -9.0, 0.45, { align: 'center', font: "'Chakra Petch'", weight: 700 });

  const P = { x0: -14.5, x1: 13.0, z0: 7.0, z1: 15.6 };
  const lab = 5.0;
  const wx = w => P.x0 + lab + (P.x1 - P.x0 - lab) * w / WEEKS;
  const rowH = (P.z1 - P.z0 - 1.2) / PHASES.length;
  text('PROGRAMME · 14 WEEKS · START MON 1 MAR 2027', P.x0, P.z0 - 0.45, 0.42, { weight: 600 });
  for (let k = 0; k <= WEEKS; k++) {
    line([[wx(k), P.z0 + 0.3], [wx(k), P.z1]], k % 4 === 0 ? 2.5 : 1.5, 'rgba(29,28,25,0.35)');
    if (k < WEEKS) text(pad2(k + 1), wx(k + 0.5), P.z0 + 0.82, 0.34, { align: 'center' });
  }
  PHASES.forEach((p, i) => {
    const z = P.z0 + 1.2 + i * rowH, bh = rowH * 0.5, bz = z + (rowH - bh) / 2;
    line([[P.x0, z + rowH], [P.x1, z + rowH]], 1.5, 'rgba(29,28,25,0.25)');
    g.strokeStyle = INK; g.lineWidth = 2.5;
    g.strokeRect(X(wx(p.w0)), Z(bz), (wx(p.w1) - wx(p.w0)) * PX, bh * PX);
    g.save(); g.beginPath(); g.rect(X(wx(p.w0)), Z(bz), (wx(p.w1) - wx(p.w0)) * PX, bh * PX); g.clip();
    g.strokeStyle = 'rgba(29,28,25,0.3)'; g.lineWidth = 2;
    for (let h = X(wx(p.w0)) - bh * PX; h < X(wx(p.w1)); h += 14) { g.beginPath(); g.moveTo(h, Z(bz + bh)); g.lineTo(h + bh * PX, Z(bz)); g.stroke(); }
    g.restore();
  });
  rectL(P.x0 - 0.4, P.z0 - 1.3, P.x1 + 0.4, P.z1 + 0.3, 3);

  const tb = { x0: 15.2, x1: 23.2, z0: 10.2, z1: 17.2 };
  rectL(tb.x0, tb.z0, tb.x1, tb.z1, 4);
  line([[tb.x0, tb.z0 + 2.0], [tb.x1, tb.z0 + 2.0]], 2);
  line([[tb.x0, tb.z0 + 4.4], [tb.x1, tb.z0 + 4.4]], 2);
  text('PURLIN', tb.x0 + 0.4, tb.z0 + 1.35, 0.9, { font: "'Chakra Petch'", weight: 700, ls: 0.12 });
  text('HOUSE AT FENWICK LANE', tb.x0 + 0.4, tb.z0 + 2.75, 0.34, { weight: 600 });
  text('FOUNDATION PLAN AND PROGRAMME', tb.x0 + 0.4, tb.z0 + 3.35, 0.3);
  text('TIMBER FRAME · 142 M² · 3 BED', tb.x0 + 0.4, tb.z0 + 3.9, 0.3);
  text('DWG 08-101   REV C   SCALE 1:1', tb.x0 + 0.4, tb.z0 + 5.2, 0.3);
  text('KEYS FRI 4 JUN 2027', tb.x0 + 0.4, tb.z0 + 5.8, 0.3, { color: '#e85d04', weight: 600 });

  sheetBaseCanvas = cv;
  return cv;
}

function drawSheet(T) {
  const base = ensureSheetBase();
  const PX = 100;
  if (!sheetWorkCanvas) {
    sheetWorkCanvas = document.createElement('canvas');
    sheetWorkCanvas.width = base.width;
    sheetWorkCanvas.height = base.height;
  }
  const g = sheetWorkCanvas.getContext('2d');
  g.drawImage(base, 0, 0);

  const X = x => (x - SHEET.x0) * PX, Z = z => (z - SHEET.z0) * PX;
  const INK = '#1d1c19', ACC = '#e85d04';
  const P = { x0: -14.5, x1: 13.0, z0: 7.0, z1: 15.6 };
  const lab = 5.0;
  const wx = w => P.x0 + lab + (P.x1 - P.x0 - lab) * w / WEEKS;
  const rowH = (P.z1 - P.z0 - 1.2) / PHASES.length;

  PHASES.forEach((p, i) => {
    const z = P.z0 + 1.2 + i * rowH, bh = rowH * 0.5, bz = z + (rowH - bh) / 2;
    const live = T >= p.w0 && T < p.w1;
    g.font = `${live ? 600 : 500} ${0.32 * PX}px 'IBM Plex Mono'`;
    g.fillStyle = live ? ACC : INK;
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillText(`${pad2(p.n)}  ${p.name.toUpperCase()}`, X(P.x0), Z(z + rowH * 0.66));
    const pe = Math.min(T, p.w1);
    if (pe > p.w0) {
      g.fillStyle = live ? ACC : INK;
      g.fillRect(X(wx(p.w0)), Z(bz), (wx(pe) - wx(p.w0)) * PX, bh * PX);
    }
  });
  g.beginPath();
  g.moveTo(X(wx(T)), Z(P.z0 + 0.2));
  g.lineTo(X(wx(T)), Z(P.z1 + 0.3));
  g.strokeStyle = ACC; g.lineWidth = 6; g.stroke();
  g.font = `600 ${0.3 * PX}px 'IBM Plex Mono'`;
  g.fillStyle = ACC;
  g.fillText(`TODAY ${fmtDay(dateAt(T)).toUpperCase()}`, X(wx(T) + 0.25), Z(P.z1 + 0.05));

  if (!sheetTex) {
    sheetTex = new THREE.CanvasTexture(sheetWorkCanvas);
    sheetTex.colorSpace = THREE.SRGBColorSpace;
    sheetTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  } else {
    sheetTex.needsUpdate = true;
  }
  return sheetTex;
}

// ------------------------------------------------------------------ Interactivity: Scroll, Gantt Scrub, Room Tour, Play, Controls
let lastSheetUpdateWk = state.wk;
let isDraggingGantt = false;

function setTargetWeek(w, immediate = false) {
  state.userMoved = true;
  state.roomPinned = false;
  if (state.dir === 'a' && state.open && w > 0.05) {
    state.open = false;
  }
  state.targetWk = Math.min(WEEKS, Math.max(0, w));
  if (immediate) state.wk = state.targetWk;
}

function scrubFromSvgEvent(e, svg) {
  const rect = svg.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (svg.viewBox.baseVal.width / rect.width);
  const x0 = parseFloat(svg.dataset.x0 || '190');
  const x1 = parseFloat(svg.dataset.x1 || String(svg.viewBox.baseVal.width));
  if (x < x0) {
    const row = e.target.closest('.gantt-row');
    if (row) {
      const w0 = parseFloat(row.dataset.w0), w1 = parseFloat(row.dataset.w1);
      setTargetWeek(w0 + (w1 - w0) * 0.55, true);
      syncVisuals(1);
    }
    return;
  }
  const w = clamp01((x - x0) / Math.max(1, x1 - x0)) * WEEKS;
  setTargetWeek(w, true);
  syncVisuals(1);
}

function bindHudEvents() {
  // Direction buttons
  hud.querySelectorAll('[data-dir]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const d = btn.dataset.dir;
      if (d === state.dir) return;
      const u = new URL(location.href);
      u.searchParams.set('dir', d);
      u.searchParams.set('wk', state.wk.toFixed(2));
      u.searchParams.delete('open');
      u.searchParams.delete('shot');
      location.href = u.toString();
    };
  });

  // Camera buttons
  hud.querySelectorAll('[data-cam]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      state.camMode = btn.dataset.cam;
      if (state.camMode === 'inside') {
        state.userMoved = true;
        if (state.wk < 13.45) {
          state.wk = 14.0;
          state.targetWk = 14.0;
        }
        state.roomPinned = true;
        if (state.tour < 0.05) { state.tour = 0.25; state.targetTour = 0.25; }
      } else {
        state.roomPinned = false;
      }
      if (state.dir === 'a' && state.open && state.camMode !== 'auto') state.open = false;
      syncVisuals(0.35);
    };
  });

  // Interior room walkthrough tabs (01 ENTRY .. 05 OVERLOOK)
  hud.querySelectorAll('[data-room]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const stop = INTERIOR_STOPS.find(s => s.id === btn.dataset.room);
      if (!stop) return;
      state.playing = false;
      state.userMoved = true;
      state.roomPinned = true;
      state.camMode = 'inside';
      state.shot = 'inside';
      if (state.wk < 13.5) {
        state.wk = 14.0;
        state.targetWk = 14.0;
      }
      state.targetTour = stop.u;
      renderHud();
    };
  });

  // Play / Pause button
  const playBtn = hud.querySelector('[data-action="play"]');
  if (playBtn) {
    playBtn.onclick = (e) => {
      e.stopPropagation();
      state.playing = !state.playing;
      state.userMoved = true;
      state.roomPinned = false;
      if (state.playing) {
        if (state.dir === 'a' && state.open) state.open = false;
        if (state.wk >= WEEKS - 0.02) { state.wk = 0; state.targetWk = 0; state.tour = 0; state.targetTour = 0; }
      }
      renderHud();
    };
  }

  // Range slider
  const slider = hud.querySelector('.cad-scrub input[type="range"]');
  if (slider) {
    slider.oninput = (e) => {
      state.playing = false;
      setTargetWeek(parseFloat(e.target.value), true);
      syncVisuals(1);
    };
  }

  // SVG Gantt chart click & drag scrubbing
  const svg = hud.querySelector('.gantt-svg');
  if (svg) {
    svg.onpointerdown = (e) => {
      isDraggingGantt = true;
      state.playing = false;
      svg.setPointerCapture(e.pointerId);
      scrubFromSvgEvent(e, svg);
    };
    svg.onpointermove = (e) => {
      if (!isDraggingGantt) return;
      scrubFromSvgEvent(e, svg);
    };
    svg.onpointerup = svg.onpointercancel = () => {
      isDraggingGantt = false;
    };
  }
}

window.addEventListener('wheel', (e) => {
  e.preventDefault();
  state.playing = false;
  const rawDelta = (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * 0.0045;
  if (state.dir === 'a' && state.open && rawDelta > 0) {
    state.open = false;
    state.userMoved = true;
    renderHud();
    return;
  }
  // If user is explicitly in INSIDE mode at Week 14, let wheel scroll smoothly along the 5-room spline
  if (state.camMode === 'inside') {
    state.userMoved = true;
    state.roomPinned = true;
    state.targetTour = clamp01(state.targetTour + rawDelta * 0.35);
    return;
  }
  // Slow down scroll step during the final handover walkthrough (wk >= 13.35) so all 5 rooms glide smoothly
  const stepScale = state.targetWk >= 13.35 ? 0.22 : 1.0;
  setTargetWeek(state.targetWk + rawDelta * stepScale, false);
}, { passive: false });

let touchY = null;
window.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1) touchY = e.touches[0].clientY;
}, { passive: true });
window.addEventListener('touchmove', (e) => {
  if (touchY == null || e.touches.length !== 1) return;
  const dy = touchY - e.touches[0].clientY;
  touchY = e.touches[0].clientY;
  state.playing = false;
  const stepScale = state.targetWk >= 13.35 ? 0.22 : 1.0;
  setTargetWeek(state.targetWk + dy * 0.018 * stepScale, false);
}, { passive: true });

window.addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  applyCamera(state.shot, 1);
  renderHud();
});

function syncVisuals(camLerp = 0.2) {
  updateSceneForWeek(state.wk, camLerp);
  if (state.dir === 'b' && Math.abs(state.wk - lastSheetUpdateWk) > 0.03) {
    lastSheetUpdateWk = state.wk;
    drawSheet(state.wk);
  }
  renderHud();
  window.__state = { DIR: state.dir, WK: state.wk, SHOT: state.shot, TOUR: state.tour, house };
}

// ------------------------------------------------------------------ go
await document.fonts.ready;
if (DIR === 'b') {
  sheetBaseCanvas = null;
  groundMat.map = drawSheet(state.wk);
  groundMat.needsUpdate = true;
  cap.material = groundMat;
}
renderHud();

let frames = 0;
let lastTime = performance.now();
function loop(now = performance.now()) {
  const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
  lastTime = now;

  const tourDiff = Math.abs(state.targetTour - state.tour);
  if (tourDiff > 0.001) {
    state.tour += (state.targetTour - state.tour) * Math.min(1, dt * 6.5);
    if (Math.abs(state.targetTour - state.tour) <= 0.001) state.tour = state.targetTour;
  }

  if (state.playing) {
    // Slow down playback during the handover interior walkthrough (13.38..14.0) so the camera glides through all 5 rooms
    const rate = state.wk >= 13.38 ? 0.095 : 1.15;
    state.targetWk = Math.min(WEEKS, state.targetWk + dt * rate);
    state.wk = state.targetWk;
    if (state.wk >= WEEKS) state.playing = false;
    syncVisuals(0.18);
  } else if (Math.abs(state.targetWk - state.wk) > 0.0015 || tourDiff > 0.001) {
    state.wk += (state.targetWk - state.wk) * Math.min(1, dt * 9);
    if (Math.abs(state.targetWk - state.wk) <= 0.0015) state.wk = state.targetWk;
    syncVisuals(0.18);
  } else if (frames >= 4 && curCamPos.distanceToSquared(new THREE.Vector3(...getTargetCameraPose(state.shot).pos)) > 0.005) {
    applyCamera(state.shot, 0.15);
  }

  renderer.render(scene, camera);
  if (++frames === 4) window.__ready = true;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.__state = { DIR: state.dir, WK: state.wk, SHOT: state.shot, TOUR: state.tour, house };
