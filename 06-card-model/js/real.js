// The house itself, in daylight: the same list of parts as the card model, in concrete, oak, glass and linen,
// on land graded from the same contour lines, under the sun that was the desk lamp.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { houseParts, makeRnd } from './house.js';
import { canvasTex, grain, blotches, worldUV, shiftZ, treeSpots, cardHouse, contourLayers, modelTrees, modelFigures, buildLamp, LAMP, sheetTexture } from './desk.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rnd = makeRnd(71);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// the sun sits where the lamp's light came from, lowered to a late afternoon
export const SUN_DIR = V(0.9456, 0.1305, 0.2981).normalize(); // 7.5 degrees up: low enough to show under the roof, from the study, through the big glass

// ---------------------------------------------------------------- land
// The contour layers are the land cut into 0.8 m steps. Undo the steps: the same lines, read as a slope,
// with a subtle memory of the 0.8 m contour benches near the house so card and land rhyme during the turn.
function noise2(x, z) { // value noise, smooth, deterministic
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const h = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return (h(xi, zi) * (1 - u) + h(xi + 1, zi) * u) * (1 - v) + (h(xi, zi + 1) * (1 - u) + h(xi + 1, zi + 1) * u) * v;
}
const fbm = (x, z) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < 5; i++) { s += a * noise2(x * f, z * f); f *= 2.03; a *= 0.5; } return s; };

export function landAt(x, z) {
  const u = x - shiftZ(z);
  let h;
  if (u <= 4) h = 0;
  else if (u <= 17) h = -(u - 4) / 13 * 3.2;
  else if (u <= 26) h = -3.2;
  else h = -3.2 - (u - 26) * 0.24;
  if (u > 40) h = -6.56 - 0.24 * (u - 40) / (1 + (u - 40) / 170);             // the valley falls away and eases out
  if (u < -14) h += Math.pow((-14 - u) / 44, 1.5) * 7;                          // the hill behind keeps rising
  h += sstep(260, 720, u) * 70 * (0.6 + 0.8 * fbm(z * 0.004 + 3, u * 0.002));  // hills on the far side of the valley
  const r = Math.hypot(x - 12, z + 2);
  h += sstep(38, 120, r) * (fbm(x * 0.012, z * 0.012) - 0.45) * 14;             // the far land rolls
  h += (fbm(x * 0.35, z * 0.35) - 0.5) * 0.12 * sstep(6, 14, r);               // a little unevenness, not near the house
  // subtle natural terrace inflection echoing the 0.8 m contour benches on the slope outside the house
  const bench = Math.round(h / 0.8) * 0.8;
  h = lerp(h, bench, 0.14 * sstep(14, 22, r) * (1 - sstep(32, 48, r)));
  // grade the earth snugly around the lower terrace stone plinth so it never floats above the slope
  const padX = sstep(17.5, 18.6, x) * (1 - sstep(24.2, 26.2, x));
  const padZ = sstep(-8.8, -7.5, z) * (1 - sstep(3.5, 5.0, z));
  h = lerp(h, -3.22, padX * padZ * 0.85);
  if (x > 3.62 && x < 18.36 && z > -8.06 && z < 4.06) h = Math.min(h, -3.7);   // dug out under the house
  return h;
}

function axis(c0, c1, step, far0, far1, nFar) { // dense samples near, growing spacing to the far edges
  const xs = [];
  for (let x = c0; x <= c1 + 1e-6; x += step) xs.push(+x.toFixed(3));
  const grow = (from, to) => { const out = []; let x = from, d = step; while ((to > from && x < to) || (to < from && x > to)) { d *= Math.pow(Math.abs(to - from) / step, 1 / nFar) > 1 ? 1.16 : 1; x += Math.sign(to - from) * d; out.push(x); } return out; };
  return [...grow(c0, far0).reverse(), ...xs, ...grow(c1, far1)];
}

export function terrain(R, phone) {
  const xs = axis(-40, 72, phone ? 0.8 : 0.5, -700, 1100, 40), zs = axis(-40, 40, phone ? 0.8 : 0.5, -900, 900, 40);
  for (const v of [3.62, 18.36, 24.5]) { xs.push(v - 0.04, v + 0.04); }
  for (const v of [-8.06, -7.7, 3.7, 4.06]) { zs.push(v - 0.04, v + 0.04); }
  xs.sort((a, b) => a - b); zs.sort((a, b) => a - b);
  const nx = xs.length, nz = zs.length, pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2);
  const c = new THREE.Color();
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = xs[i], z = zs[j], y = landAt(x, z), k = j * nx + i;
    pos.set([x, y, z], k * 3); uv.set([x, z], k * 2);
    const r = Math.hypot(x - 12, z + 2), dry = sstep(26, 150, r) * (0.45 + 0.7 * fbm(x * 0.02 + 9, z * 0.02));
    const patch = fbm(x * 0.055, z * 0.055), micro = fbm(x * 0.22 + 4.1, z * 0.22 - 2.7);
    c.setRGB(
      0.86 + 0.30 * dry - 0.13 * patch + 0.05 * (micro - 0.5),
      0.88 + 0.07 * dry - 0.09 * patch + 0.04 * (micro - 0.5),
      0.73 - 0.17 * dry - 0.08 * patch - 0.03 * (micro - 0.5)
    );
    col.set([c.r, c.g, c.b], k * 3);
  }
  const idx = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1; idx.push(a, d, b, b, d, e); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, R.land); m.receiveShadow = true; m.castShadow = true;
  return m;
}

// ---------------------------------------------------------------- textures and materials
function makeTextures() {
  const T = {};
  // Architectural board-marked concrete: pine shuttering grain, lift seams, and recessed cone tie-rod holes
  T.conc = canvasTex(1024, 1024, (g, s) => {
    g.fillStyle = '#b9b4ab'; g.fillRect(0, 0, s, s);
    blotches(g, s, 95, 'rgba(255,252,246,0.038)', 28, 130);
    blotches(g, s, 95, 'rgba(56,52,46,0.042)', 24, 120);
    const boards = 16, bh = s / boards;
    for (let b = 0; b < boards; b++) {
      const y0 = b * bh, tone = (rnd() - 0.5) * 10;
      g.fillStyle = tone > 0 ? `rgba(255,252,245,${tone * 0.004})` : `rgba(45,40,35,${-tone * 0.004})`;
      g.fillRect(0, y0, s, bh);
      // subtle horizontal wood-grain transfer from formwork boards
      for (let k = 0; k < 14; k++) {
        const y = y0 + rnd() * bh;
        g.fillStyle = rnd() < 0.5 ? 'rgba(65,58,50,0.045)' : 'rgba(248,244,236,0.035)';
        g.fillRect(0, y, s, 1 + rnd() * 1.5);
      }
      // formwork board seam fin and shadow
      g.fillStyle = 'rgba(38,33,28,0.18)'; g.fillRect(0, y0, s, 1.5);
      g.fillStyle = 'rgba(255,252,246,0.09)'; g.fillRect(0, y0 + 1.5, s, 1.2);
    }
    for (let i = 0; i < 18; i++) {
      const y = Math.floor(rnd() * boards) * bh;
      g.fillStyle = 'rgba(40,35,30,0.12)'; g.fillRect(rnd() * s, y, 1.5, bh);
    }
    // architectural formwork tie holes in regular grid rows
    for (const ry of [0.18, 0.5, 0.82]) for (const rx of [0.16, 0.5, 0.84]) {
      const x = rx * s + (rnd() - 0.5) * 6, y = ry * s + (rnd() - 0.5) * 6;
      g.fillStyle = 'rgba(52,47,42,0.42)'; g.beginPath(); g.arc(x, y, 5.2, 0, 7); g.fill();
      g.strokeStyle = 'rgba(245,240,232,0.22)'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y + 0.6, 5.8, 0, 7); g.stroke();
      g.fillStyle = 'rgba(28,24,20,0.55)'; g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill();
    }
    for (let i = 0; i < 65; i++) {
      g.fillStyle = 'rgba(68,62,56,0.28)';
      g.beginPath(); g.arc(rnd() * s, rnd() * s, 0.8 + rnd() * 1.6, 0, 7); g.fill();
    }
    grain(g, s, s, 14);
  }, { tile: 2.4 });

  // Wide-plank European white oak flooring with natural cathedral grain and micro-bevel seams
  T.oak = canvasTex(1024, 1024, (g, s) => {
    const rows = 14, h = s / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rnd() * s * 0.4;
      while (x < s) {
        const L = s * (0.42 + rnd() * 0.55), v = rnd();
        g.fillStyle = `hsl(${31 + v * 4},${33 + v * 7}%,${56 + v * 6}%)`;
        g.fillRect(x, r * h, L, h);
        for (let k = 0; k < 18; k++) {
          const gy = r * h + rnd() * h;
          g.fillStyle = `rgba(88,54,24,${0.035 + rnd() * 0.065})`;
          g.fillRect(x, gy, L, 0.8 + rnd() * 1.4);
        }
        for (let k = 0; k < 6; k++) {
          g.fillStyle = `rgba(245,222,188,${0.04 + rnd() * 0.05})`;
          g.fillRect(x + rnd() * L * 0.5, r * h + rnd() * h, L * 0.4, 1);
        }
        g.fillStyle = 'rgba(48,28,14,0.28)'; g.fillRect(x, r * h, 1.5, h);
        x += L;
      }
      g.fillStyle = 'rgba(46,27,13,0.26)'; g.fillRect(0, r * h, s, 1.4);
      g.fillStyle = 'rgba(255,238,210,0.08)'; g.fillRect(0, r * h + 1.4, s, 1);
    }
    grain(g, s, s, 9);
  }, { tile: 3.6 });

  // Continuous book-matched solid oak slab for the study desk (no floor-plank butt joints)
  T.deskOak = canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = '#b99364'; g.fillRect(0, 0, w, h);
    for (let b = 0; b < 4; b++) {
      const y0 = (b * h) / 4, bh = h / 4, v = (b % 2) * 0.04;
      g.fillStyle = `rgba(198,158,108,${0.25 + v})`; g.fillRect(0, y0, w, bh);
      for (let i = 0; i < 48; i++) {
        const y = y0 + rnd() * bh;
        g.fillStyle = rnd() < 0.65 ? `rgba(86,52,22,${0.03 + rnd() * 0.055})` : `rgba(242,216,178,${0.03 + rnd() * 0.04})`;
        g.fillRect(0, y, w, 0.8 + rnd() * 1.8);
      }
      g.fillStyle = 'rgba(62,36,16,0.12)'; g.fillRect(0, y0, w, 1);
    }
    grain(g, w, h, 7);
  }, { tile: 2.2 });

  // Rich Mediterranean hillside turf texture (blended at dual non-repeating scales in shader)
  T.grass = canvasTex(1024, 1024, (g, s) => {
    g.fillStyle = '#868758'; g.fillRect(0, 0, s, s);
    blotches(g, s, 90, 'rgba(186,174,106,0.14)', 24, 110);
    blotches(g, s, 90, 'rgba(54,68,32,0.15)', 22, 100);
    blotches(g, s, 60, 'rgba(128,116,76,0.10)', 16, 70);
    for (let i = 0; i < 28000; i++) {
      const r = rnd();
      g.fillStyle = r < 0.45 ? 'rgba(42,56,22,0.24)' : r < 0.82 ? 'rgba(188,182,114,0.19)' : 'rgba(110,124,64,0.22)';
      const x = rnd() * s, y = rnd() * s;
      g.fillRect(x, y, 1 + (r > 0.85 ? 0.6 : 0), 2.2 + rnd() * 3.2);
    }
    grain(g, s, s, 10);
  }, { tile: 6.5 });

  // Honed limestone / travertine terrace slabs in running ashlar bond (replaces 2x4 checkerboard)
  T.pave = canvasTex(1024, 1024, (g, s) => {
    g.fillStyle = '#d8cfc0'; g.fillRect(0, 0, s, s);
    const rows = 6, rh = s / rows;
    for (let r = 0; r < rows; r++) {
      const shift = (r % 2) * (s * 0.28) + (r % 3) * (s * 0.11);
      const cols = 3, cw = s / cols;
      for (let c = -1; c <= cols; c++) {
        const x0 = c * cw + (shift % cw), y0 = r * rh;
        const dv = (rnd() - 0.5) * 0.07;
        g.fillStyle = dv > 0 ? `rgba(255,250,242,${dv})` : `rgba(112,98,78,${-dv})`;
        g.fillRect(x0, y0, cw, rh);
        // subtle travertine sedimentary veins
        for (let v = 0; v < 8; v++) {
          g.fillStyle = rnd() < 0.5 ? 'rgba(130,115,92,0.045)' : 'rgba(252,248,240,0.05)';
          g.fillRect(x0 + rnd() * cw * 0.3, y0 + rnd() * rh, cw * (0.4 + rnd() * 0.5), 1.2 + rnd() * 2);
        }
        g.fillStyle = 'rgba(78,68,56,0.34)'; g.fillRect(x0, y0, 1.6, rh);
        g.fillStyle = 'rgba(255,252,245,0.18)'; g.fillRect(x0 + 1.6, y0, 1.0, rh);
      }
      g.fillStyle = 'rgba(78,68,56,0.36)'; g.fillRect(0, r * rh, s, 1.6);
      g.fillStyle = 'rgba(255,252,245,0.2)'; g.fillRect(0, r * rh + 1.6, s, 1.0);
    }
    blotches(g, s, 55, 'rgba(125,110,88,0.04)', 14, 64);
    grain(g, s, s, 9);
  }, { tile: 3.2 });

  // Gnarled olive & cypress bark texture
  T.bark = canvasTex(512, 512, (g, s) => {
    g.fillStyle = '#5e5346'; g.fillRect(0, 0, s, s);
    blotches(g, s, 50, 'rgba(135,126,108,0.12)', 14, 60);
    blotches(g, s, 50, 'rgba(34,28,22,0.16)', 12, 55);
    for (let i = 0; i < 220; i++) {
      const x = rnd() * s, y = rnd() * s, h = 25 + rnd() * 90;
      g.fillStyle = rnd() < 0.55 ? 'rgba(30,24,18,0.28)' : 'rgba(148,138,120,0.16)';
      g.fillRect(x, y, 1.5 + rnd() * 2, h);
    }
    grain(g, s, s, 14);
  }, { tile: 0.8 });

  // the painting over the sofa: a terracotta sun, cut by a charcoal arc
  T.art = canvasTex(1024, 683, (g, w, h) => {
    g.fillStyle = '#ece5d6'; g.fillRect(0, 0, w, h); blotches(g, w, 40, 'rgba(160,140,110,0.06)', 30, 160);
    g.fillStyle = '#c4572c'; g.beginPath(); g.arc(w * 0.62, h * 0.46, h * 0.3, 0, 7); g.fill();
    g.strokeStyle = '#26231f'; g.lineWidth = 26; g.beginPath(); g.arc(w * 0.3, h * 1.1, h * 0.75, Math.PI * 1.25, Math.PI * 1.9); g.stroke();
    g.fillStyle = 'rgba(40,36,30,0.85)'; g.fillRect(w * 0.12, h * 0.18, w * 0.05, h * 0.5);
    grain(g, w, h, 14);
  });

  // second artwork for the lower bedroom & dining wall: warm limestone & ochre architectural study
  T.art2 = canvasTex(512, 680, (g, w, h) => {
    g.fillStyle = '#e8dfd0'; g.fillRect(0, 0, w, h);
    blotches(g, w, 30, 'rgba(140,120,92,0.07)', 20, 110);
    g.fillStyle = '#bf863f'; g.fillRect(w * 0.16, h * 0.18, w * 0.46, h * 0.38);
    g.fillStyle = '#2d2a26'; g.fillRect(w * 0.44, h * 0.42, w * 0.38, h * 0.4);
    g.strokeStyle = '#a34e2b'; g.lineWidth = 10;
    g.beginPath(); g.moveTo(w * 0.16, h * 0.74); g.lineTo(w * 0.82, h * 0.24); g.stroke();
    grain(g, w, h, 12);
  });
  return T;
}

// Patch terrain material with dual-scale rotated world UV sampling + procedural hillside macro/micro modulation
function patchLand(mat) {
  mat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLandPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLandPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vLandPos;
        float lHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float lNoise(vec2 p){
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(lHash(i), lHash(i + vec2(1.0, 0.0)), f.x),
                     mix(lHash(i + vec2(0.0, 1.0)), lHash(i + vec2(1.0, 1.0)), f.x), f.y);
        }`)
      .replace('#include <map_fragment>', `{
        vec2 uvA = vLandPos.xz * 0.16;
        vec2 uvB = (mat2(0.78, -0.62, 0.62, 0.78) * vLandPos.xz) * 0.058 + vec2(3.7, -1.9);
        vec4 texA = texture2D(map, uvA);
        vec4 texB = texture2D(map, uvB);
        float blend = smoothstep(0.28, 0.72, lNoise(vLandPos.xz * 0.085));
        vec3 grassCol = mix(texA.rgb, texB.rgb, blend);
        float meadow = lNoise(vLandPos.xz * 0.025) * 0.6 + lNoise(vLandPos.xz * 0.11) * 0.4;
        float blades = (lNoise(vLandPos.xz * 3.4) - 0.5) * 0.09;
        grassCol *= mix(vec3(0.91, 0.94, 0.86), vec3(1.09, 1.05, 0.94), meadow) + blades;
        diffuseColor.rgb *= grassCol;
      }`);
  };
  mat.customProgramCacheKey = () => 'land-dual-scale';
  return mat;
}

// Patch foliage materials with subtle per-leaf tonal variation, crown AO from vertex color, and warm sunlit subsurface scatter
function patchFoliage(mat, sssTint = [0.22, 0.24, 0.08]) {
  mat.vertexColors = true;
  mat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLeafW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLeafW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vLeafW;
        float fHash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float leafVar = fHash(floor(vLeafW * 9.0));
        diffuseColor.rgb *= mix(0.88, 1.12, leafVar);`)
      .replace('#include <opaque_fragment>', `
        vec3 sunD = normalize(vec3(0.9456, 0.1305, 0.2981));
        float backLight = pow( clamp( dot( normalize(vViewPosition), sunD ), 0.0, 1.0 ), 2.6 );
        float upRim = clamp( geometryNormal.y * 0.5 + 0.5, 0.0, 1.0 );
        outgoingLight += vec3(${sssTint.join(',')}) * (0.35 + 0.65 * backLight) * upRim * diffuseColor.rgb;
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'foliage-sss-' + sssTint[0];
  return mat;
}

export function realMaterials(env) {
  const T = makeTextures();
  const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.88, metalness: 0, envMap: env, envMapIntensity: 0.45 }, o));
  const R = {
    T,
    conc: std({ map: T.conc, bumpMap: T.conc, bumpScale: 0.011, roughness: 0.84 }),
    floorL: std({ color: 0xdcd6ca, roughness: 0.42 }),
    oak: std({ map: T.oak, bumpMap: T.oak, bumpScale: 0.005, roughness: 0.44 }),
    deskOak: std({ map: T.deskOak, bumpMap: T.deskOak, bumpScale: 0.004, roughness: 0.38, envMapIntensity: 0.65 }),
    plaster: std({ color: 0xece7dd, roughness: 0.92 }),
    gravel: std({ color: 0x938d84, roughness: 0.98 }),
    pave: std({ map: T.pave, bumpMap: T.pave, bumpScale: 0.008, roughness: 0.78 }),
    steel: std({ color: 0x262625, metalness: 0.68, roughness: 0.36, envMapIntensity: 0.85 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x16242b,
      roughness: 0.03,
      metalness: 0.0,
      ior: 1.5,
      reflectivity: 0.65,
      transparent: true,
      opacity: 0.11,
      envMap: env,
      envMapIntensity: 0.92,
      depthWrite: false,
    }),
    fabric: std({ color: 0xdcd2c2, roughness: 0.92 }),
    rug: std({ color: 0xbcaa8e, roughness: 0.96 }),
    walnut: std({ color: 0x5a3b25, roughness: 0.46, envMapIntensity: 0.6 }),
    leather: std({ color: 0x7e4627, roughness: 0.42, envMapIntensity: 0.65 }),
    linen: std({ color: 0xf2ede4, roughness: 0.9 }),
    curtain: new THREE.MeshStandardMaterial({ color: 0xf3eee5, roughness: 0.92, transparent: true, opacity: 0.76, side: THREE.DoubleSide }),
    stone: std({ color: 0xe6e0d5, roughness: 0.28, envMapIntensity: 0.6 }),
    white: std({ color: 0xf5f3ef, roughness: 0.24 }),
    mirror: std({ color: 0xffffff, metalness: 1, roughness: 0.02, envMapIntensity: 1.2 }),
    teak: std({ color: 0x8b643f, roughness: 0.62 }),
    shade: std({ color: 0xfff1d6, emissive: 0xffc980, emissiveIntensity: 0.52, roughness: 0.75, side: THREE.DoubleSide }),
    clay: std({ color: 0xb47454, roughness: 0.68 }),
    leaf: patchFoliage(std({ color: 0x4a5f2b, roughness: 0.78, envMapIntensity: 0.22 }), [0.10, 0.13, 0.03]),
    leafDS: std({ color: 0x384b24, roughness: 0.52, side: THREE.DoubleSide, envMapIntensity: 0.4 }),
    leafDark: patchFoliage(std({ color: 0x2d3d1b, roughness: 0.82, envMapIntensity: 0.18 }), [0.06, 0.09, 0.02]),
    olive: patchFoliage(std({ color: 0x586b3a, roughness: 0.76, envMapIntensity: 0.22 }), [0.11, 0.14, 0.05]),
    bark: std({ map: T.bark, bumpMap: T.bark, bumpScale: 0.015, roughness: 0.92 }),
    land: patchLand(std({ map: T.grass, vertexColors: true, roughness: 0.96, envMapIntensity: 0.25 })),
    ochre: std({ color: 0xbf8a3f, roughness: 0.86 }),
    rust: std({ color: 0xa24f2c, roughness: 0.86 }),
    sage: std({ color: 0x889272, roughness: 0.86 }),
    charcoal: std({ color: 0x2a2825, roughness: 0.5 }),
    ceramic: std({ color: 0xeae3d5, roughness: 0.3, envMapIntensity: 0.65 }),
    art: std({ map: T.art, roughness: 0.85 }),
    art2: std({ map: T.art2, roughness: 0.85 }),
    cork: std({ color: 0x9b7a55, roughness: 0.95 }),
    rattan: std({ color: 0xa7865a, roughness: 0.85 }),
    trace: std({ color: 0xefe5b8, roughness: 0.8 }),
    brass: std({ color: 0xb69156, metalness: 0.88, roughness: 0.28, envMapIntensity: 1.0 }),
    book0: std({ color: 0x7a3a2a }), book1: std({ color: 0x3b4a52 }), book2: std({ color: 0xdcd5c6 }), book3: std({ color: 0x8c877c }), book4: std({ color: 0x24221f }),
  };
  return R;
}

// ---------------------------------------------------------------- the house
// Every face goes to the bucket of its material, so the whole house is about twenty draw calls.
export function realHouse(R) {
  const buckets = new Map();
  const push = (key, g) => { if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(g); };
  const doorBoxes = [];
  const extra = [];
  const steelExtra = [];
  for (const p of houseParts()) {
    let boxes = [p.b];
    // a bookcase in the list is one solid box: build it open, so the books on its shelves show
    if (p.k === 'furn' && p.m === 'walnut' && p.b[3] - p.b[0] < 0.7 && p.b[4] - p.b[1] > 2.3) {
      const [x0, y0, z0, x1, y1, z1] = p.b, t = 0.028;
      extra.push([x0, y0, z0, x0 + t, y1, z1], [x0, y0, z0, x1, y1, z0 + t], [x0, y0, z1 - t, x1, y1, z1], [x0, y1 - t, z0, x1, y1, z1], [x0, y0, z0, x1, y0 + 0.08, z1]);
      // add vertical dividers for architectural rhythm
      const midZ = (z0 + z1) / 2;
      extra.push([x0 + t, y0 + 0.08, midZ - 0.012, x1 - 0.02, y1 - t, midZ + 0.012]);
      if (y0 < 1) for (let y = y0 + 0.42; y < y1 - 0.2; y += 0.42) extra.push([x0, y, z0, x1, y + t, z1]);
      continue;
    }
    // replace blocky 3-slab dining chairs, 2-box leather chair, and 2-box teak loungers with sculpted 1:1 furniture in staging()
    if (p.k === 'furn' && p.m === 'walnut' && p.b[2] >= -2.76 && p.b[5] <= -2.34 && p.b[0] > 6.5 && p.b[3] < 9.0) continue;
    if (p.k === 'furn' && p.m === 'leather') continue;
    if (p.k === 'furn' && p.m === 'teak') continue;
    // give the study desk top its own continuous solid-oak slab material
    let matOverride = null;
    if (p.k === 'furn' && p.m === 'oak' && p.b[1] > 3.8) matOverride = 'deskOak';
    // give the lower and upper stone paving slabs a solid stone plinth skirt so they sit firmly in the earth
    if (p.k === 'land' && p.m === 'pave') {
      const [x0, , z0, x1, y1, z1] = p.b;
      boxes = [[x0, y1 < -1 ? -3.62 : -0.28, z0, x1, y1, z1]];
    }
    // the upper south glass: one bay becomes a sliding door, the rest stays fixed
    if (p.k === 'glass' && Math.abs(p.b[0] - 18.22) < 0.005 && p.b[1] === 0 && p.b[4] === 6.4) {
      boxes = [[18.22, 3.2, -7.7, 18.26, 6.4, 3.7], [18.22, 0, -7.7, 18.26, 3.12, -2.0], [18.22, 0, -0.1, 18.26, 3.12, 3.7]];
      doorBoxes.push(['glass', [18.09, 0.02, -2.0, 18.11, 3.1, -0.1]]);
      for (const b of [
        [18.06, 0.02, -2.0, 18.14, 0.08, -0.1],
        [18.06, 3.04, -2.0, 18.14, 3.1, -0.1],
        [18.06, 0.02, -2.0, 18.14, 3.1, -1.94],
        [18.06, 0.02, -0.16, 18.14, 3.1, -0.1],
        [18.03, 0.95, -0.22, 18.06, 1.35, -0.19], // door pull handle
      ]) doorBoxes.push(['steel', b]);
    }
    for (const b of boxes) {
      const g = new THREE.BoxGeometry(b[3] - b[0], b[4] - b[1], b[5] - b[2]);
      g.translate((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2); worldUV(g);
      const f = g.toNonIndexed();
      if (p.k === 'glass') { push('glass', f); continue; }
      const rawM = matOverride || p.m;
      const spec = typeof rawM === 'string' ? { all: rawM } : rawM;
      const keys = [spec.all, spec.all, spec.top || spec.all, spec.bot || spec.all, spec.all, spec.all];
      for (let i = 0; i < 6; i++) {
        const face = new THREE.BufferGeometry();
        for (const a of ['position', 'normal', 'uv']) { const src = f.attributes[a]; face.setAttribute(a, new THREE.BufferAttribute(src.array.slice(i * 6 * src.itemSize, (i + 1) * 6 * src.itemSize), src.itemSize)); }
        push(keys[i], face);
      }
    }
  }
  // architectural steel stanchion posts for the stairwell balustrade, mezzanine balustrade, and balcony glass
  for (const x of [5.52, 7.1, 8.7, 10.28]) steelExtra.push([x - 0.02, 0, -6.43, x + 0.02, 1.04, -6.37]);
  for (const z of [-6.38, -4.4, -2.4, -0.4, 1.6, 3.66]) steelExtra.push([10.95, 3.2, z - 0.02, 11.01, 4.29, z + 0.02]);
  for (const z of [-7.96, -5.6, -3.2, -0.8, 1.46]) steelExtra.push([22.41, 0, z - 0.02, 22.47, 1.09, z + 0.02]);

  for (const b of extra) { const g = new THREE.BoxGeometry(b[3] - b[0], b[4] - b[1], b[5] - b[2]); g.translate((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2); worldUV(g); push('walnut', g.toNonIndexed()); }
  for (const b of steelExtra) { const g = new THREE.BoxGeometry(b[3] - b[0], b[4] - b[1], b[5] - b[2]); g.translate((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2); worldUV(g); push('steel', g.toNonIndexed()); }

  const group = new THREE.Group();
  for (const [key, list] of buckets) {
    const m = new THREE.Mesh(mergeGeometries(list), R[key] || R.conc);
    m.castShadow = key !== 'glass'; m.receiveShadow = true;
    if (key === 'glass') m.renderOrder = 2;
    group.add(m);
  }
  const door = new THREE.Group();
  for (const [key, b] of doorBoxes) { const g = new THREE.BoxGeometry(b[3] - b[0], b[4] - b[1], b[5] - b[2]); g.translate((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2); const m = new THREE.Mesh(g, R[key]); m.castShadow = key !== 'glass'; m.receiveShadow = true; if (key === 'glass') m.renderOrder = 2; door.add(m); }
  group.add(door);
  return { group, door };
}

// ---------------------------------------------------------------- staging: the rooms dressed like a lived-in architectural monograph
export function staging(R, Mcard) {
  const g = new THREE.Group();
  const put = (geo, mat, x = 0, y = 0, z = 0, o = {}) => { if (x || y || z) geo.translate(x, y, z); const m = new THREE.Mesh(geo, mat); m.castShadow = o.cast !== false; m.receiveShadow = true; g.add(m); return m; };
  const box = (x0, y0, z0, x1, y1, z1, mat, o) => put(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, o);
  const rbox = (w, h, d, r, mat, x, y, z, ry = 0, rx = 0, rz = 0) => { // a soft cushion or mattress with rounded edges
    const geo = new THREE.BoxGeometry(w, h, d, 6, 6, 4); const p = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const ax = Math.abs(v.x) / (w / 2), ay = Math.abs(v.y) / (h / 2); const s = 1 - r * ax * ax * ay * ay; v.z *= 0.78 + 0.22 * (1 - ax * ax) * (1 - ay * ay); v.x *= 1 - r * 0.22 * ay * ay; v.y *= 1 - r * 0.22 * ax * ax; p.setXYZ(i, v.x * s, v.y, v.z); }
    geo.computeVertexNormals(); if (rx) geo.rotateX(rx); if (rz) geo.rotateZ(rz); if (ry) geo.rotateY(ry); return put(geo, mat, x, y, z);
  };
  const lathe = (pts, seg, mat, x, y, z, o) => put(new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg), mat, x, y, z, o);

  // Sculpted walnut & woven-linen dining / study chair builder
  const addChair = (cx, cy, cz, ry = 0, seatMat = R.linen) => {
    const cg = [];
    const part = (geo, mat) => cg.push({ geo, mat });
    // four tapered turned walnut legs
    for (const [lx, lz, tx, tz] of [[-0.2, -0.19, -0.03, -0.03], [0.2, -0.19, 0.03, -0.03], [-0.19, 0.19, -0.02, 0.04], [0.19, 0.19, 0.02, 0.04]]) {
      const leg = new THREE.CylinderGeometry(0.014, 0.011, 0.45, 8);
      leg.translate(0, 0.225, 0); leg.rotateZ(tx); leg.rotateX(tz); leg.translate(lx, 0, lz);
      part(leg, R.walnut);
    }
    // rear stiles rising to support the curved backrest
    for (const lx of [-0.19, 0.19]) {
      const stile = new THREE.CylinderGeometry(0.012, 0.014, 0.38, 8);
      stile.translate(0, 0.19, 0); stile.rotateX(-0.1); stile.translate(lx, 0.44, 0.19);
      part(stile, R.walnut);
    }
    // seat frame & soft woven cushion
    const frame = new THREE.BoxGeometry(0.42, 0.032, 0.4); frame.translate(0, 0.44, 0); part(frame, R.walnut);
    const seat = new THREE.BoxGeometry(0.4, 0.035, 0.38, 4, 2, 4); seat.translate(0, 0.465, -0.005); part(seat, seatMat);
    // curved steam-bent walnut backrest
    const back = new THREE.CylinderGeometry(0.22, 0.22, 0.11, 16, 1, true, -Math.PI * 0.38, Math.PI * 0.76);
    back.scale(1, 1, 0.38); back.translate(0, 0.76, 0.125);
    part(back, R.walnut);
    const backIn = back.clone(); backIn.scale(0.96, 1, 0.94); part(backIn, R.walnut);
    for (const { geo, mat } of cg) { geo.rotateY(ry); put(geo, mat, cx, cy, cz); }
  };

  // 1. Exterior terrace & garden transition: slatted teak sun loungers, side table, stone steps
  for (const lz of [-6.45, -5.05]) {
    // teak frame rails and legs
    box(19.15, 0.22, lz - 0.34, 21.08, 0.27, lz - 0.30, R.teak);
    box(19.15, 0.22, lz + 0.30, 21.08, 0.27, lz + 0.34, R.teak);
    box(19.15, 0.22, lz - 0.34, 19.20, 0.27, lz + 0.34, R.teak);
    box(21.03, 0.22, lz - 0.34, 21.08, 0.27, lz + 0.34, R.teak);
    for (const [lx, zOff] of [[19.24, -0.31], [19.24, 0.31], [20.96, -0.31], [20.96, 0.31]]) {
      box(lx - 0.025, 0, lz + zOff - 0.02, lx + 0.025, 0.22, lz + zOff + 0.02, R.teak);
    }
    // individual teak deck slats
    for (let sx = 19.8; sx <= 21.0; sx += 0.075) box(sx, 0.265, lz - 0.31, sx + 0.052, 0.28, lz + 0.31, R.teak);
    // reclined backrest frame & mattress pad + bolster
    const backFrame = new THREE.BoxGeometry(0.68, 0.04, 0.64); backFrame.rotateZ(-0.52); put(backFrame, R.teak, 19.48, 0.45, lz);
    rbox(1.22, 0.075, 0.62, 0.2, R.linen, 20.42, 0.31, lz);
    rbox(0.64, 0.075, 0.62, 0.2, R.linen, 19.51, 0.49, lz, 0, 0, -0.52);
    rbox(0.16, 0.14, 0.46, 0.35, lz < -5.7 ? R.ochre : R.rust, 19.38, 0.61, lz, 0, 0, -0.52);
  }
  // low travertine & teak side table between the loungers
  put(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 28), R.stone, 19.75, 0.36, -5.75);
  put(new THREE.CylinderGeometry(0.16, 0.19, 0.34, 20), R.teak, 19.75, 0.17, -5.75);
  lathe([[0, 0], [0.045, 0], [0.055, 0.09], [0.045, 0.09], [0, 0.01]], 18, R.ceramic, 19.72, 0.375, -5.78);
  box(19.68, 0.375, -5.68, 19.86, 0.40, -5.54, R.book0);

  // Architectural stone steps connecting lower garden path to upper terrace on the south-east flank
  for (let i = 0; i < 8; i++) {
    const sx = 24.4 - i * 0.46, sy = -3.15 + i * 0.38;
    box(sx - 0.26, sy - 0.16, 1.65, sx + 0.26, sy, 3.45, R.pave);
  }

  // 2. Ground-floor bedroom (y = -3.2): visible through the lower south glass during the turn and approach
  box(12.35, -3.19, -7.55, 17.35, -3.175, -4.15, R.rug, { cast: false });
  // plush rounded mattress, folded throw blanket at foot of bed, and four layered pillows
  rbox(2.12, 0.24, 1.92, 0.18, R.linen, 14.5, -2.68, -6.42);
  rbox(2.16, 0.08, 0.62, 0.22, R.ochre, 14.5, -2.53, -5.78);
  rbox(0.72, 0.22, 0.42, 0.32, R.linen, 13.98, -2.48, -7.22, 0.04, 0.22);
  rbox(0.72, 0.22, 0.42, 0.32, R.linen, 15.02, -2.48, -7.22, -0.04, 0.22);
  rbox(0.56, 0.19, 0.34, 0.35, R.rust, 14.02, -2.46, -6.95, 0.08, 0.28);
  rbox(0.56, 0.19, 0.34, 0.35, R.sage, 14.98, -2.46, -6.95, -0.08, 0.28);
  // bedside lamp ceramic bases + brass stems + glowing shades
  for (const lx of [12.95, 16.05]) {
    lathe([[0, 0], [0.065, 0], [0.085, 0.08], [0.07, 0.18], [0.02, 0.2], [0, 0.2]], 20, R.ceramic, lx, -2.75, -7.45);
    put(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8), R.brass, lx, -2.52, -7.45);
    put(new THREE.CylinderGeometry(0.1, 0.135, 0.22, 22, 1, true), R.shade, lx, -2.42, -7.45, { cast: false });
  }
  // walnut & linen bench at the foot of the bed
  box(13.55, -2.86, -5.22, 15.45, -2.81, -4.78, R.walnut);
  rbox(1.86, 0.065, 0.42, 0.22, R.fabric, 14.5, -2.77, -5.0);
  for (const lx of [13.68, 15.32]) for (const lz of [-5.18, -4.82]) box(lx - 0.02, -3.2, lz - 0.02, lx + 0.02, -2.86, lz + 0.02, R.walnut);
  // framed artwork on the lower bedroom partition wall & sheer linen drapes by the glass
  box(11.15, -2.25, -6.15, 11.18, -0.95, -5.15, R.charcoal);
  put(new THREE.PlaneGeometry(0.94, 1.24).rotateY(Math.PI / 2), R.art2, 11.185, -1.6, -5.65, { cast: false });
  for (const cz of [-7.52, -3.95, 3.48]) {
    for (let f = 0; f < 5; f++) {
      const dr = new THREE.CylinderGeometry(0.045, 0.055, 2.82, 10, 1, true, 0, Math.PI);
      dr.rotateY(f % 2 ? 0.3 : -0.3);
      put(dr, R.curtain, 18.06 - (f % 2) * 0.03, -1.78, cz + f * 0.07, { cast: false });
    }
  }
  // planter in lower bedroom corner
  lathe([[0, 0], [0.18, 0], [0.22, 0.38], [0.2, 0.4], [0, 0.36]], 24, R.clay, 17.25, -3.2, -3.85);
  put(canopy([[0, 0, 0, 0.36, 0.42, 0.36, 95]], 0.055, 0.095), R.olive, 17.25, -2.42, -3.85, { cast: true });
  put(new THREE.CylinderGeometry(0.02, 0.03, 0.55, 6), R.bark, 17.25, -2.75, -3.85);

  // 3. Living room & dining room
  // Floor lamp by the sofa & three pendant lamps over the dining table
  put(new THREE.CylinderGeometry(0.014, 0.014, 1.52, 10), R.brass, 12.9, 0.76, -6.9);
  put(new THREE.CylinderGeometry(0.16, 0.26, 0.32, 28, 1, true), R.shade, 12.9, 1.55, -6.9, { cast: false });
  put(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 24), R.steel, 12.9, 0.01, -6.9);
  for (const [px, pz] of [[6.95, -1.65], [7.8, -1.65], [8.65, -1.65]]) {
    put(new THREE.CylinderGeometry(0.004, 0.004, 0.9, 6), R.steel, px, 2.4, pz, { cast: false });
    put(new THREE.CylinderGeometry(0.03, 0.04, 0.05, 12), R.brass, px, 2.02, pz, { cast: false });
    put(new THREE.SphereGeometry(0.13, 22, 14), R.shade, px, 1.88, pz, { cast: false });
  }
  // sofa cushions & draped throw
  rbox(0.62, 0.5, 0.18, 0.35, R.linen, 13.55, 0.78, -6.9, 0, -0.25);
  rbox(0.58, 0.48, 0.18, 0.35, R.ochre, 14.2, 0.77, -6.88, 0.12, -0.28);
  rbox(0.6, 0.5, 0.18, 0.35, R.sage, 15.55, 0.78, -6.9, -0.08, -0.25);
  rbox(0.5, 0.42, 0.16, 0.35, R.rust, 16.05, 0.74, -6.86, 0.2, -0.3);
  rbox(0.44, 0.06, 0.86, 0.25, R.ochre, 16.41, 0.64, -6.82);
  rbox(0.26, 0.34, 0.28, 0.25, R.ochre, 16.52, 0.47, -7.12);

  // Sculpted mid-century cognac leather & walnut lounge chair (replaces 2-box block)
  {
    const cx = 17.05, cz = -4.15, ry = -0.52;
    const lpart = (geo, mat) => { geo.rotateY(ry); put(geo, mat, cx, 0, cz); };
    for (const sx of [-0.36, 0.36]) {
      const legF = new THREE.BoxGeometry(0.035, 0.38, 0.045); legF.rotateX(0.14); legF.translate(sx, 0.19, -0.26); lpart(legF, R.walnut);
      const legB = new THREE.BoxGeometry(0.035, 0.42, 0.045); legB.rotateX(-0.22); legB.translate(sx, 0.20, 0.26); lpart(legB, R.walnut);
      const arm = new THREE.BoxGeometry(0.055, 0.032, 0.58); arm.rotateX(-0.06); arm.translate(sx, 0.52, 0.02); lpart(arm, R.walnut);
    }
    const shell = new THREE.BoxGeometry(0.74, 0.04, 0.62); shell.rotateX(-0.12); shell.translate(0, 0.34, 0); lpart(shell, R.walnut);
    const seatC = new THREE.BoxGeometry(0.68, 0.11, 0.58, 4, 3, 4); seatC.rotateX(-0.12); seatC.translate(0, 0.41, -0.02); lpart(seatC, R.leather);
    const backC = new THREE.BoxGeometry(0.68, 0.48, 0.11, 4, 4, 3); backC.rotateX(-0.34); backC.translate(0, 0.64, 0.24); lpart(backC, R.leather);
    const headC = new THREE.BoxGeometry(0.52, 0.14, 0.08, 4, 2, 2); headC.rotateX(-0.28); headC.translate(0, 0.88, 0.32); lpart(headC, R.leather);
  }

  // coffee table: art monographs, travertine bowl, olive branches in a charcoal vessel
  box(14.1, 0.36, -5.45, 14.55, 0.41, -5.1, R.book2); box(14.13, 0.41, -5.42, 14.5, 0.45, -5.12, R.book4); box(14.16, 0.45, -5.4, 14.47, 0.48, -5.15, R.rust);
  lathe([[0, 0], [0.12, 0.005], [0.18, 0.06], [0.2, 0.09], [0.185, 0.09], [0.165, 0.05], [0, 0.04]], 32, R.ceramic, 15.15, 0.36, -5.0);
  lathe([[0, 0], [0.07, 0], [0.1, 0.08], [0.09, 0.22], [0.045, 0.32], [0.05, 0.36], [0.04, 0.36], [0, 0.34]], 28, R.charcoal, 14.85, 0.36, -5.3);
  for (let i = 0; i < 6; i++) {
    const L = 0.6 + rnd() * 0.35, a = i * 1.05, t = 0.18 + rnd() * 0.12;
    const b = new THREE.CylinderGeometry(0.004, 0.006, L, 5); b.translate(0, L / 2, 0); b.rotateZ(Math.cos(a) * t); b.rotateX(Math.sin(a) * t); put(b, R.bark, 14.85, 0.68, -5.3);
    for (let k = 0; k < 7; k++) {
      const lf = new THREE.SphereGeometry(0.032, 6, 4); lf.scale(0.8, 0.32, 1.65);
      const h = L * (0.4 + k * 0.08);
      put(lf, R.olive, 14.85 + Math.sin(Math.cos(a) * t) * -h + (rnd() - 0.5) * 0.05, 0.68 + h, -5.3 + Math.sin(Math.sin(a) * t) * h + (rnd() - 0.5) * 0.05, { cast: false });
    }
  }
  // the painting over the sofa, on the back wall
  box(13.25, 1.35, -7.7, 16.35, 3.4, -7.66, R.charcoal);
  put(new THREE.PlaneGeometry(3.04, 1.99), R.art, 14.8, 2.375, -7.655, { cast: false });
  // sideboard under the east window, with ceramics & framed architectural relief above
  box(12.8, 0, 3.22, 17.0, 0.55, 3.7, R.walnut); box(12.8, 0.55, 3.22, 17.0, 0.58, 3.7, R.stone);
  lathe([[0, 0], [0.09, 0], [0.13, 0.12], [0.12, 0.3], [0.06, 0.42], [0.065, 0.48], [0, 0.48]], 28, R.ceramic, 13.4, 0.58, 3.45);
  lathe([[0, 0], [0.07, 0], [0.11, 0.1], [0.09, 0.2], [0.05, 0.24], [0, 0.24]], 28, R.clay, 13.75, 0.58, 3.48);
  box(15.9, 0.58, 3.3, 16.35, 0.64, 3.62, R.book1); box(15.94, 0.64, 3.32, 16.3, 0.69, 3.6, R.book2);

  // an olive tree in a big concrete planter by the glass (kept cleanly inside x < 18.0)
  lathe([[0, 0], [0.34, 0], [0.42, 0.06], [0.45, 0.62], [0.41, 0.64], [0.38, 0.1], [0, 0.1]], 40, R.conc, 17.25, 0, 2.65);
  put(gnarledBranch(V(0, 0.45, 0), V(0.06, 1.15, -0.04), V(-0.05, 1.85, 0.05), 0.085, 0.045, 7, 8), R.bark, 17.25, 0, 2.65);
  put(gnarledBranch(V(0.02, 1.35, -0.02), V(0.16, 1.65, 0.06), V(0.24, 1.98, 0.12), 0.04, 0.02, 5, 6), R.bark, 17.25, 0, 2.65);
  put(canopy([[0, 0, 0, 0.56, 0.46, 0.54, 220], [0.18, 0.28, 0.08, 0.42, 0.36, 0.4, 130]], 0.055, 0.095), R.olive, 17.25, 2.15, 2.65, { cast: true });

  // Sculpted fiddle-leaf fig by the stair (curved 3D botanical leaves instead of flat 7-gon discs)
  lathe([[0, 0], [0.22, 0], [0.26, 0.5], [0.24, 0.52], [0, 0.48]], 32, R.charcoal, 11.7, 0, -5.9);
  put(gnarledBranch(V(0, 0.4, 0), V(-0.05, 1.1, 0.04), V(0.04, 1.95, -0.03), 0.032, 0.014, 7, 7), R.bark, 11.7, 0, -5.9);
  put(gnarledBranch(V(-0.02, 1.0, 0.02), V(0.16, 1.45, 0.14), V(0.24, 1.8, 0.2), 0.02, 0.01, 5, 6), R.bark, 11.7, 0, -5.9);
  for (let i = 0; i < 42; i++) {
    const wL = 0.14 + rnd() * 0.07, hL = wL * 1.45;
    const lf = new THREE.PlaneGeometry(wL, hL, 3, 5);
    const pos = lf.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const lx = pos.getX(k), ly = pos.getY(k) + hL * 0.5;
      const u = ly / hL; // 0 at base, 1 at tip
      const violin = Math.sin(u * Math.PI) * (0.82 + 0.24 * Math.sin(u * Math.PI * 2.5));
      const cup = Math.abs(lx / (wL * 0.5)) * 0.022 - u * u * 0.055;
      pos.setXYZ(k, lx * violin, ly, cup);
    }
    lf.computeVertexNormals();
    const a = i * 2.399 + (rnd() - 0.5) * 0.25, r = 0.08 + Math.sqrt(i / 42) * 0.36, y = 0.95 + (i / 42) * 1.32;
    lf.rotateX(0.55 + rnd() * 0.55); lf.rotateY(a + Math.PI * 0.5);
    put(lf, R.leafDS, 11.7 + Math.cos(a) * r, y, -5.9 + Math.sin(a) * r, { cast: true });
  }

  // side table by the lounge chair
  put(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 32), R.stone, 17.55, 0.55, -2.95);
  put(new THREE.CylinderGeometry(0.02, 0.02, 0.54, 8), R.brass, 17.55, 0.27, -2.95);

  // Sculpted dining chairs on BOTH sides of the oak dining table + dining area rug + centerpiece
  box(5.75, 0, -3.05, 9.85, 0.012, -0.35, R.rug, { cast: false });
  for (const cx of [6.9, 7.8, 8.7]) {
    addChair(cx, 0, -2.56, Math.PI + (rnd() - 0.5) * 0.08, R.linen); // north side facing +z
    addChair(cx, 0, -0.84, (rnd() - 0.5) * 0.08, R.linen);           // south side facing -z
  }
  lathe([[0, 0], [0.14, 0.005], [0.22, 0.05], [0.2, 0.06], [0, 0.02]], 28, R.stone, 7.55, 0.77, -1.68);
  lathe([[0, 0], [0.05, 0], [0.075, 0.12], [0.04, 0.24], [0, 0.24]], 22, R.clay, 8.15, 0.77, -1.58);

  // Kitchen island bar stools & counter styling
  for (const cx of [6.7, 7.8, 8.9]) {
    put(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 24), R.leather, cx, 0.68, -3.25);
    put(new THREE.CylinderGeometry(0.015, 0.015, 0.66, 8), R.brass, cx, 0.33, -3.25);
    put(new THREE.TorusGeometry(0.15, 0.008, 8, 24).rotateX(Math.PI / 2), R.brass, cx, 0.24, -3.25);
  }
  box(6.6, 0.92, -4.4, 6.95, 1.0, -4.05, R.book2);
  lathe([[0, 0], [0.12, 0], [0.16, 0.05], [0, 0.04]], 24, R.ceramic, 8.6, 0.92, -4.15);

  // Curated books & varied sculptural objects on the walnut bookcase (no repeated identical white vase)
  let objIdx = 0;
  for (let y = 0.508; y < 2.2; y += 0.42) {
    let z = -5.92;
    while (z < -2.32) {
      if ( Math.abs(z - -4.1) < 0.12 ) { z += 0.16; continue; } // clear central vertical divider
      const mode = rnd();
      if (mode < 0.68) {
        // vertical cluster of 4-7 books
        const count = 4 + Math.floor(rnd() * 4);
        for (let b = 0; b < count && z < -2.35; b++) {
          const w = 0.026 + rnd() * 0.038, h = 0.21 + rnd() * 0.14, d = 0.24 + rnd() * 0.08;
          box(4.06, y, z, 4.06 + d, y + h, z + w, R['book' + Math.floor(rnd() * 5)]);
          z += w + 0.004;
        }
        z += 0.06;
      } else if (mode < 0.84) {
        // horizontal stack of 2-3 large art books
        const w = 0.24 + rnd() * 0.06;
        if (z + w < -2.35) {
          let sy = y;
          for (let s = 0; s < 3; s++) {
            const bh = 0.032 + rnd() * 0.015;
            box(4.08, sy, z, 4.44, sy + bh, z + w - s * 0.015, R['book' + ((objIdx + s) % 5)]);
            sy += bh + 0.002;
          }
        }
        z += w + 0.1;
      } else {
        // varied sculptural vessel or architectural object (5 distinct silhouettes and materials)
        const kind = objIdx++ % 5, cz = z + 0.12;
        if (kind === 0) lathe([[0, 0], [0.06, 0], [0.095, 0.09], [0.07, 0.22], [0.035, 0.26], [0, 0.26]], 22, R.clay, 4.32, y, cz);
        else if (kind === 1) lathe([[0, 0], [0.09, 0.01], [0.12, 0.06], [0.1, 0.08], [0, 0.03]], 24, R.stone, 4.32, y, cz);
        else if (kind === 2) {
          box(4.24, y, cz - 0.06, 4.4, y + 0.04, cz + 0.06, R.charcoal);
          put(new THREE.SphereGeometry(0.055, 18, 12), R.brass, 4.32, y + 0.095, cz);
        } else if (kind === 3) lathe([[0, 0], [0.05, 0], [0.07, 0.14], [0.065, 0.28], [0.03, 0.31], [0, 0.31]], 20, R.charcoal, 4.32, y, cz);
        else lathe([[0, 0], [0.055, 0], [0.08, 0.08], [0.05, 0.19], [0, 0.19]], 20, R.ceramic, 4.32, y, cz);
        z += 0.28;
      }
    }
  }

  // Diagonal architectural handrail with wall brackets ascending the stair wall (z = -7.66)
  {
    const rail = new THREE.CylinderGeometry(0.018, 0.018, 5.75, 10);
    rail.rotateZ(Math.atan2(3.2, 4.8));
    put(rail, R.walnut, 7.9, 2.48, -7.62);
    for (let i = 0; i < 4; i++) {
      const f = (i + 0.5) / 4, bx = 10.3 - f * 4.8, by = f * 3.2 + 0.85;
      box(bx - 0.015, by - 0.04, -7.7, bx + 0.015, by - 0.01, -7.61, R.brass);
    }
  }

  // 4. The study (+3.20 m): pinboard, reading corner, and the recursive 1:100 desk model
  box(5.8, 3.95, -7.7, 9.9, 4.86, -7.67, R.cork);
  [['section', false], ['plan', true], ['elev', false], ['lower', false]].forEach(([kind, trace], i) => {
    const m = new THREE.MeshStandardMaterial({ map: sheetTexture(kind, trace), roughness: 0.92, envMap: R.cork.envMap, envMapIntensity: 0.35 });
    const w = 0.84 + (i % 2) * 0.12; const sh = new THREE.PlaneGeometry(w, w / 1.414); sh.rotateZ((rnd() - 0.5) * 0.04);
    put(sh, m, 6.35 + i * 1.02, 4.42 + (i % 2) * 0.05, -7.662, { cast: false });
    // tiny brass push-pins at top corners of each pinned sheet
    for (const dx of [-w * 0.42, w * 0.42]) put(new THREE.SphereGeometry(0.012, 8, 6), R.brass, 6.35 + i * 1.02 + dx, 4.42 + (i % 2) * 0.05 + w / 2.828 - 0.03, -7.658, { cast: false });
  });

  // Rattan basket of hollow rolled architectural drawings tucked beside the study bookcase (clear of the camera path)
  const bx = 4.62, bz = -0.38;
  lathe([[0, 0], [0.17, 0], [0.19, 0.46], [0.18, 0.46], [0.16, 0.02], [0, 0.02]], 28, R.rattan, bx, 3.2, bz);
  for (let i = 0; i < 6; i++) {
    const L = 0.68 + rnd() * 0.26, a = i * 1.08, r = 0.026 + (i % 2) * 0.006;
    const tx = (rnd() - 0.5) * 0.18, tz = (rnd() - 0.5) * 0.18;
    // open-ended hollow paper tube + inner spiral layer + terracotta rubber band
    const outer = new THREE.CylinderGeometry(r, r, L, 16, 1, true);
    const inner = new THREE.CylinderGeometry(r * 0.72, r * 0.72, L * 1.01, 14, 1, true);
    const band = new THREE.CylinderGeometry(r * 1.03, r * 1.03, 0.018, 16, 1, true);
    for (const gRoll of [outer, inner, band]) { gRoll.rotateZ(tx); gRoll.rotateX(tz); }
    const matRoll = i % 2 === 0 ? R.trace : R.linen;
    const rx = bx + Math.cos(a) * 0.075, ry = 3.24 + L / 2, rz = bz + Math.sin(a) * 0.075;
    put(outer, matRoll, rx, ry, rz);
    put(inner, matRoll, rx, ry, rz);
    put(band, R.rust, rx, ry, rz);
  }

  // Study planter & reading lounge corner
  lathe([[0, 0], [0.2, 0], [0.24, 0.42], [0.22, 0.44], [0, 0.4]], 28, R.ceramic, 4.55, 3.2, 2.9);
  put(gnarledBranch(V(0, 0.35, 0), V(0.04, 0.78, -0.03), V(-0.03, 1.18, 0.02), 0.028, 0.015, 6, 6), R.bark, 4.55, 3.2, 2.9);
  put(canopy([[0, 0, 0, 0.42, 0.52, 0.42, 140]], 0.055, 0.1), R.leaf, 4.55, 4.35, 2.9, { cast: true });
  rbox(0.82, 0.42, 0.84, 0.18, R.linen, 9.6, 3.41, 2.32);
  rbox(0.82, 0.54, 0.22, 0.22, R.linen, 9.6, 3.88, 2.64, 0, -0.12);
  rbox(0.14, 0.26, 0.82, 0.2, R.linen, 9.24, 3.72, 2.32);
  rbox(0.14, 0.26, 0.82, 0.2, R.linen, 9.96, 3.72, 2.32);
  rbox(0.48, 0.38, 0.15, 0.35, R.rust, 9.6, 3.82, 2.44, 0, -0.2);
  put(new THREE.CylinderGeometry(0.012, 0.012, 1.45, 8), R.brass, 10.35, 3.92, 2.55);
  put(new THREE.CylinderGeometry(0.13, 0.2, 0.26, 24, 1, true), R.shade, 10.35, 4.7, 2.55, { cast: false });

  // The study desk area: rug, sculpted architect's chair (turned slightly aside so the view to the model is open),
  // and on the solid oak desk the 1:100 card model under its switched-on miniature anglepoise lamp
  box(4.6, 3.2, -2.6, 7.9, 3.21, -0.3, R.rug, { cast: false });
  addChair(6.62, 3.2, -0.52, 0.36, R.leather);

  // Switch on the miniature desk lamp materials so the 1:100 lamp glows warmly without blooming its outer shade
  if (Mcard.bulb) { Mcard.bulb.emissiveIntensity = 3.2; }
  if (Mcard.lampInner) { Mcard.lampInner.emissiveIntensity = 0.42; }
  if (Mcard.lampRim) { Mcard.lampRim.emissiveIntensity = 0.95; }

  const desk = new THREE.Group();
  const mat = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.003, 0.5), Mcard.mat);
  mat.position.set(6.32, 3.9715, -1.5);
  desk.add(mat);
  // miniature steel scale rule and brass pencil beside the cutting mat on the study desk
  const miniRule = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.0012, 0.028), Mcard.rule || R.steel);
  miniRule.position.set(6.36, 3.9726, -1.21); miniRule.rotation.y = 0.05;
  desk.add(miniRule);
  const miniPencil = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.17, 6).rotateZ(Math.PI / 2), R.ochre);
  miniPencil.position.set(6.72, 3.974, -1.36); miniPencil.rotation.y = -0.38;
  desk.add(miniPencil);
  const miniScale = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.26, 3).rotateZ(Math.PI / 2), R.white);
  miniScale.position.set(5.86, 3.976, -1.32); miniScale.rotation.y = 0.24;
  desk.add(miniScale);

  const tiny = new THREE.Group();
  tiny.add(cardHouse(Mcard));
  for (const l of contourLayers(Mcard)) tiny.add(l);
  for (const tr of modelTrees(Mcard)) tiny.add(tr);
  for (const fg of modelFigures(Mcard)) tiny.add(fg);
  tiny.scale.setScalar(0.01);
  tiny.position.set(6.32 - 0.13, 3.973 + 0.096, -1.5 + 0.03);
  desk.add(tiny);

  const lamp = buildLamp(Mcard, LAMP).group;
  lamp.scale.setScalar(0.01);
  lamp.rotation.y = Math.PI;
  lamp.position.set(6.02 + 0.88, 3.97 + 0.101, -1.85 + 0.4);
  desk.add(lamp); // reaching over the model from behind
  desk.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  // everything but the desk is static: one mesh per material
  const byMat = new Map();
  for (const m of [...g.children]) {
    if (!m.isMesh) continue;
    m.updateMatrix();
    const geo = m.geometry.clone().applyMatrix4(m.matrix);
    const q = geo.index ? geo.toNonIndexed() : geo;
    if (!q.attributes.uv) q.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2));
    if (m.material.vertexColors && !q.attributes.color) {
      const cols = new Float32Array(q.attributes.position.count * 3).fill(1);
      q.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    }
    for (const a of Object.keys(q.attributes)) {
      if (!['position', 'normal', 'uv', ...(m.material.vertexColors ? ['color'] : [])].includes(a)) q.deleteAttribute(a);
    }
    const k = m.material.uuid;
    if (!byMat.has(k)) byMat.set(k, { mat: m.material, list: [], cast: m.castShadow });
    byMat.get(k).list.push(q);
    g.remove(m);
  }
  for (const { mat: mMat, list, cast } of byMat.values()) {
    const m = new THREE.Mesh(mergeGeometries(list), mMat);
    m.castShadow = cast; m.receiveShadow = true;
    g.add(m);
  }
  g.add(desk);
  return g;
}

// ---------------------------------------------------------------- botanical trees & foreground meadow tufts
// Smooth curved tubular branch along a quadratic Bezier curve with natural taper
function gnarledBranch(p0, p1, p2, r0, r1, segs = 7, radSegs = 7) {
  const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
  const pts = curve.getPoints(segs), frames = curve.computeFrenetFrames(segs, false);
  const pos = [], norm = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const v = i / segs, r = lerp(r0, r1, Math.pow(v, 0.85));
    const P = pts[i], N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= radSegs; j++) {
      const u = j / radSegs, a = u * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const nx = N.x * ca + B.x * sa, ny = N.y * ca + B.y * sa, nz = N.z * ca + B.z * sa;
      const flute = 1 + 0.08 * Math.sin(a * 3 + v * 5);
      pos.push(P.x + nx * r * flute, P.y + ny * r * flute, P.z + nz * r * flute);
      norm.push(nx, ny, nz);
      uv.push(u, v * 2.5);
    }
  }
  const stride = radSegs + 1;
  for (let i = 0; i < segs; i++) for (let j = 0; j < radSegs; j++) {
    const a = i * stride + j, b = a + 1, c = a + stride, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g.toNonIndexed();
}

// Botanical foliage canopy with smooth leaf-cluster geometry, outward-blended crown normals, and vertex-color crown AO
export function canopy(clusters, s0, s1, r = rnd) {
  const list = [];
  const baseSprig = new THREE.SphereGeometry(1, 6, 4).toNonIndexed();
  const bPos = baseSprig.attributes.position, bNorm = baseSprig.attributes.normal;
  // sculpt base sprig into a ruffled 3-lobed botanical leaf cluster
  for (let i = 0; i < bPos.count; i++) {
    const vx = bPos.getX(i), vy = bPos.getY(i), vz = bPos.getZ(i);
    const ang = Math.atan2(vz, vx);
    const lobe = 0.86 + 0.22 * Math.cos(ang * 3);
    bPos.setXYZ(i, vx * lobe, vy * 0.56, vz * lobe);
  }
  baseSprig.computeVertexNormals();
  const nVerts = bPos.count;

  for (const [cx, cy, cz, rx, ry, rz, n] of clusters) {
    const count = Math.max(18, Math.round(n * 0.62));
    for (let i = 0; i < count; i++) {
      let x, y, z;
      do { x = r() * 2 - 1; y = r() * 2 - 1; z = r() * 2 - 1; } while (x * x + y * y + z * z > 1);
      // bias slightly toward the outer shell of the sub-crown for a crisp botanical silhouette
      const d = Math.hypot(x, y, z) || 1;
      const shell = lerp(0.52 + 0.48 * Math.cbrt(r()), 0.82 + 0.18 * r(), 0.55) / d;
      const lx = x * shell * rx, ly = y * shell * ry, lz = z * shell * rz;
      const px = cx + lx, py = cy + ly, pz = cz + lz;
      const sc = (s0 + r() * (s1 - s0)) * 1.18;

      const g = baseSprig.clone();
      g.scale(sc * (0.9 + 0.25 * r()), sc * (0.85 + 0.25 * r()), sc * (0.9 + 0.25 * r()));
      g.rotateX((r() - 0.5) * 1.3);
      g.rotateY(r() * Math.PI * 2);
      g.rotateZ((r() - 0.5) * 1.3);
      g.translate(px, py, pz);

      // blend normals 68% toward outward sub-crown vector so the canopy reads as a lush botanical cloud, not individual balls
      const gp = g.attributes.position, gn = g.attributes.normal;
      const cols = new Float32Array(nVerts * 3);
      const shadeVar = 0.9 + 0.2 * r();
      for (let v = 0; v < nVerts; v++) {
        const vx = gp.getX(v), vy = gp.getY(v), vz = gp.getZ(v);
        let ox = (vx - cx) / Math.max(0.2, rx), oy = (vy - cy) / Math.max(0.2, ry) + 0.25, oz = (vz - cz) / Math.max(0.2, rz);
        const ol = Math.hypot(ox, oy, oz) || 1;
        ox /= ol; oy /= ol; oz /= ol;
        const nx = lerp(gn.getX(v), ox, 0.68), ny = lerp(gn.getY(v), oy, 0.68), nz = lerp(gn.getZ(v), oz, 0.68);
        const nl = Math.hypot(nx, ny, nz) || 1;
        gn.setXYZ(v, nx / nl, ny / nl, nz / nl);

        // hemispherical crown ambient occlusion + sunlit crown top warmth
        const hNorm = clamp((vy - (cy - ry)) / Math.max(0.3, ry * 2), 0, 1);
        const radNorm = clamp(Math.hypot((vx - cx) / rx, (vy - cy) / ry, (vz - cz) / rz), 0, 1.2);
        const ao = (0.48 + 0.52 * hNorm) * (0.72 + 0.28 * radNorm) * shadeVar;
        cols[v * 3] = ao * (0.96 + 0.08 * hNorm);
        cols[v * 3 + 1] = ao;
        cols[v * 3 + 2] = ao * (0.94 - 0.04 * hNorm);
      }
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      list.push(g);
    }
  }
  return mergeGeometries(list);
}

function treeParts(kind, x, y, z, k, out) {
  const T = (geo, key) => { geo.translate(x, y, z); out[key].push(geo); };
  if (kind === 'cypress') {
    // Italian cypress: tall flame-shaped columnar spire built from tiered upward plumes
    const tiers = [
      [0, 1.9, 0, 0.68, 1.1, 0.68, Math.round(110 * k)],
      [0, 3.4, 0, 0.78, 1.35, 0.78, Math.round(140 * k)],
      [0, 4.9, 0, 0.62, 1.25, 0.62, Math.round(120 * k)],
      [0, 6.1, 0, 0.38, 0.95, 0.38, Math.round(80 * k)],
      [0, 6.85, 0, 0.18, 0.55, 0.18, Math.round(40 * k)],
    ];
    const c = canopy(tiers, 0.11 / Math.sqrt(k), 0.19 / Math.sqrt(k));
    T(c, 'leafDark');
    T(gnarledBranch(V(0, -0.1, 0), V(0.03, 1.2, -0.02), V(0, 2.8, 0), 0.16, 0.08, 6, 7), 'bark');
    return;
  }
  const olive = kind === 'olive';
  // Multi-branching gnarled Mediterranean trunk and primary boughs
  const lean = olive ? (rnd() - 0.3) * 0.28 : (rnd() - 0.5) * 0.12;
  const topX = lean * 1.4, topY = olive ? 1.85 : 2.15, topZ = (rnd() - 0.5) * 0.24;
  T(gnarledBranch(V(0, -0.12, 0), V(lean * 0.6, topY * 0.52, topZ * 0.5), V(topX, topY, topZ), olive ? 0.23 : 0.21, olive ? 0.12 : 0.13, 7, 8), 'bark');

  const boughs = olive
    ? [
        [V(topX, topY - 0.15, topZ), V(topX - 0.45, topY + 0.55, topZ + 0.1), V(-0.65, 2.85, 0.15), 0.095, 0.042],
        [V(topX, topY - 0.1, topZ), V(topX + 0.5, topY + 0.6, topZ + 0.2), V(0.92, 3.15, 0.32), 0.088, 0.038],
        [V(topX, topY - 0.08, topZ), V(topX - 0.12, topY + 0.75, topZ - 0.32), V(-0.22, 3.45, -0.45), 0.082, 0.035],
        [V(topX - 0.3, topY + 0.4, topZ + 0.08), V(-0.85, 2.75, -0.25), V(-1.15, 3.05, -0.38), 0.052, 0.022],
      ]
    : [
        [V(topX, topY - 0.15, topZ), V(topX - 0.4, topY + 0.7, topZ + 0.25), V(-0.6, 3.35, 0.4), 0.095, 0.042],
        [V(topX, topY - 0.1, topZ), V(topX + 0.42, topY + 0.85, topZ + 0.2), V(0.65, 3.95, 0.32), 0.09, 0.04],
        [V(topX, topY - 0.12, topZ), V(topX + 0.05, topY + 0.75, topZ - 0.45), V(0.1, 3.55, -0.65), 0.082, 0.036],
      ];
  for (const [p0, p1, p2, r0, r1] of boughs) T(gnarledBranch(p0, p1, p2, r0, r1, 6, 6), 'bark');

  const cl = olive
    ? [
        [-0.55, 2.95, 0.08, 1.55, 0.78, 1.38, 280],
        [0.88, 3.3, 0.3, 1.15, 0.66, 1.05, 190],
        [-0.22, 3.68, -0.42, 1.08, 0.58, 1.02, 160],
        [-1.1, 3.12, -0.32, 0.78, 0.48, 0.75, 95],
      ]
    : [
        [-0.35, 3.45, 0.2, 1.45, 1.25, 1.38, 280],
        [0.55, 4.25, 0.28, 1.18, 0.95, 1.12, 210],
        [0.08, 3.65, -0.48, 1.22, 1.05, 1.15, 180],
      ];
  const c = canopy(cl.map((q) => [...q.slice(0, 6), Math.round(q[6] * k)]), (olive ? 0.1 : 0.12) / Math.sqrt(k), (olive ? 0.17 : 0.21) / Math.sqrt(k));
  T(c, olive ? 'olive' : 'leaf');
}

// 3D grass & wild Mediterranean rosemary/fescue tufts around the foreground slope and garden approach
function buildMeadowTufts(out) {
  const bladeBase = new THREE.PlaneGeometry(0.055, 0.38, 1, 3).toNonIndexed();
  const bp = bladeBase.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const y = bp.getY(i) + 0.19, u = y / 0.38;
    bp.setXYZ(i, bp.getX(i) * (1 - u * 0.82), y, u * u * 0.11);
  }
  bladeBase.computeVertexNormals();
  const nV = bp.count;

  // place tufts around the foreground slope, scale figure spot, terrace edges, and close tree bases
  const spots = [];
  for (let i = 0; i < 165; i++) {
    const x = 18.4 + rnd() * 21.5, z = -9.5 + rnd() * 17.5;
    // skip the paved lower terrace pad itself
    if (x > 18.2 && x < 24.6 && z > -7.8 && z < 3.8) continue;
    spots.push([x, z, 0.75 + rnd() * 0.65]);
  }
  for (const [ , tx, tz] of treeSpots()) {
    if (tx > 15 && tx < 42 && Math.abs(tz) < 16) {
      for (let k = 0; k < 5; k++) {
        const a = rnd() * Math.PI * 2, rad = 0.25 + rnd() * 0.9;
        spots.push([tx + Math.cos(a) * rad, tz + Math.sin(a) * rad, 0.8 + rnd() * 0.5]);
      }
    }
  }
  for (const [tx, tz, sc] of spots) {
    const ty = landAt(tx, tz);
    const blades = 5 + Math.floor(rnd() * 4);
    const useOlive = rnd() < 0.45;
    for (let b = 0; b < blades; b++) {
      const g = bladeBase.clone();
      const hSc = sc * (0.7 + rnd() * 0.55);
      g.scale(sc, hSc, sc);
      g.rotateX(0.18 + rnd() * 0.35);
      g.rotateY((b / blades) * Math.PI * 2 + rnd() * 0.4);
      g.translate(tx + (rnd() - 0.5) * 0.14, ty - 0.03, tz + (rnd() - 0.5) * 0.14);
      const cols = new Float32Array(nV * 3);
      const gp = g.attributes.position, gn = g.attributes.normal;
      for (let v = 0; v < nV; v++) {
        const u = clamp((gp.getY(v) - ty) / (0.38 * hSc), 0, 1);
        const ao = 0.52 + 0.52 * u;
        cols[v * 3] = ao * (0.95 + 0.12 * u);
        cols[v * 3 + 1] = ao;
        cols[v * 3 + 2] = ao * (0.85 - 0.08 * u);
        gn.setXYZ(v, 0, 0.92, 0.38);
      }
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      out[useOlive ? 'olive' : 'leaf'].push(g);
    }
  }
}

export function realTrees(R, phone) {
  const out = { leafDark: [], leaf: [], olive: [], bark: [] };
  // the twins of the card trees, where they stood on the model
  for (const [kind, x, z] of treeSpots()) treeParts(kind, x, landAt(x, z), z, 1, out);
  // 3D foreground grass and Mediterranean herb tufts on the slope
  buildMeadowTufts(out);
  // cypress rows on the hill beside the house (within the 72.8m studio scan boundary)
  const far = [];
  for (let i = 0; i < 9; i++) far.push(['cypress', -30 - (i % 3) * 3.2, -38 + i * 4.6 + (rnd() - 0.5)]);
  for (let i = 0; i < 7; i++) far.push(['cypress', -8 + i * 3.4, -24 - (rnd() * 1.5)]);
  for (const [kind, x, z] of far) treeParts(kind, x, landAt(x, z), z, 0.38, out);
  const g = new THREE.Group();
  for (const key in out) { const m = new THREE.Mesh(mergeGeometries(out[key]), R[key]); m.castShadow = true; m.receiveShadow = true; g.add(m); }
  return g;
}

// ---------------------------------------------------------------- the sky: a late afternoon, the sun low over the valley
const SKY_GLSL = `
  uniform vec3 sunDir;
  vec3 skyColor(vec3 d) {
    float h = d.y;
    float sd = max(dot(d, sunDir), 0.), toward = pow(max(dot(normalize(d.xz + 1e-4), normalize(sunDir.xz)), 0.), 2.);
    vec3 zen = vec3(0.15, 0.31, 0.65), hor = mix(vec3(0.76, 0.81, 0.86), vec3(1.14, 0.83, 0.56), toward), low = vec3(0.46, 0.41, 0.34);
    vec3 col = mix(hor, zen, pow(clamp(h, 0., 1.), 0.52));
    col = mix(col, low, smoothstep(0.02, -0.10, h));
    col += vec3(1.4, 0.8, 0.4) * pow(sd, 8.) * 0.16 + vec3(2.0, 1.3, 0.7) * pow(sd, 160.) * 0.35;
    col += vec3(24., 18., 12.) * smoothstep(0.99955, 0.9998, sd);
    return col;
  }`;
export function skyDome(sweep) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: SUN_DIR }, uSweepC: sweep.C, uSweepR: sweep.R },
    vertexShader: 'varying vec3 vDir; varying vec3 vW; void main(){ vDir = normalize(position); vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying vec3 vDir; varying vec3 vW; uniform vec3 uSweepC; uniform float uSweepR; ${SKY_GLSL}
      void main(){ gl_FragColor = vec4(skyColor(normalize(vDir)), 1.); }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), mat);
  m.frustumCulled = false; m.renderOrder = -10;
  return m;
}
export function skyEnv(renderer) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(50, 48, 24), new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: SUN_DIR } }, side: THREE.BackSide,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `varying vec3 vDir; ${SKY_GLSL} void main(){ vec3 c = skyColor(normalize(vDir)); gl_FragColor = vec4(min(c, vec3(4.5)), 1.); }`,
  })));
  // the ground half of the environment: warm sunlit Mediterranean hillside and distant valley ridge for crisp glass reflections
  const gnd = new THREE.Mesh(new THREE.CircleGeometry(49, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.46, 0.43, 0.32) }));
  gnd.rotation.x = -Math.PI / 2; gnd.position.y = -5; s.add(gnd);
  return new THREE.PMREMGenerator(renderer).fromScene(s, 0.025).texture;
}
