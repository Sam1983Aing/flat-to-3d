// The Elevation engine, shared by the three pages in 02 (a-one-door, b-the-row, c-the-face).
//
// One model, drawn two ways. Every surface is paper with 45 degree ink hatching wherever
// the sun does not reach, or its real lit material. A diagonal sweep decides which, pixel
// by pixel. The sun starts at the drawing convention (45 degrees in plan and elevation,
// 35.26 degrees high), so the hatched areas and the real shadows are the same areas.
//
// The hatching is never drawn by hand: it is read from the shadow map. Move the sun and
// the hatching moves.
//
// URL: ?at=VH jumps to a scroll position (vh) and skips the intro, ?skip skips the intro,
//      ?nolenis uses native scroll (recordings), ?debug shows p in the corner.
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import Lenis from 'https://cdn.jsdelivr.net/npm/lenis@1.1.14/dist/lenis.mjs';

export { THREE, mergeGeometries };
export const Q = new URLSearchParams(location.search);
export const num = (k, d) => (Q.has(k) ? parseFloat(Q.get(k)) : d);
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const span = (x, a, b) => clamp01((x - a) / (b - a));
export const smooth = (x) => x * x * (3 - 2 * x);
export const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const lerp = (a, b, t) => a + (b - a) * t;
export function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const raw = (hex) => new THREE.Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
export const CONVENTION = new THREE.Vector3(-1, 1, 1).normalize(); // towards the sun: upper left, in front

const GLSL_COMMON = /* glsl */`
  uniform vec3 uSun; uniform vec4 uSweep; uniform float uReal;
  uniform vec3 uPaper; uniform vec3 uInk; uniform vec3 uAccent; uniform float uHatch; uniform float uLinePx;
  uniform float uDraw; uniform vec2 uDrawSpan; uniform vec2 uDrawDir; uniform float uHatchIn; uniform vec2 uWipe; uniform float uDetailIn; uniform float uDepthCue;
  float sweepS(vec3 p) { return dot(p.xy, uSweep.xy); }
  float revealAt(vec3 p) {
    float s = sweepS(p);
    return clamp(uReal + 1.0 - smoothstep(uSweep.z - uSweep.w, uSweep.z + uSweep.w, s), 0.0, 1.0);
  }
  float lineAt(float c, float period, float px) {
    float t = c / period, fw = max(fwidth(t), 1e-5);
    float d = abs(fract(t) - 0.5);
    float hw = 0.5 * px * fw;
    return 1.0 - smoothstep(hw, hw + fw, 0.5 - d);
  }
  float lineFade(float c, float period, float minPx) {
    float px = period / max(fwidth(c), 1e-5);
    return smoothstep(minPx, minPx * 1.8, px);
  }
  float frontBand(vec3 p) {
    float bandOn = step(-35.0, uSweep.z) * (1.0 - step(35.0, uSweep.z)) * (1.0 - uReal);
    float sd = sweepS(p) - uSweep.z;
    float w = max(uSweep.w, 0.45);
    float laser = exp(-pow(sd / (w * 0.11), 2.0));
    float halo = exp(-pow(sd / (w * 0.55), 2.0)) * 0.34;
    float gridEnv = exp(-pow(sd / (w * 1.08), 2.0));
    float gx = lineAt(p.x, 0.5, uLinePx * 0.85);
    float gy = lineAt(p.y, 0.5, uLinePx * 0.85);
    float gz = lineAt(p.z, 0.25, uLinePx * 0.8);
    float grid = max(max(gx, gy) * 0.65, gz * 0.55) * gridEnv;
    return clamp(laser + halo + grid, 0.0, 1.0) * bandOn;
  }
  // the hatching pours in along the light, from the upper left
  float hatchWipe(vec3 p) {
    float ns = clamp((dot(p.xy, vec2(0.7071, -0.7071)) - uWipe.x) / (uWipe.y - uWipe.x), 0.0, 1.0);
    return clamp((uHatchIn * 1.3 - ns) / 0.3, 0.0, 1.0);
  }
  // courses and joints are laid in the same order as the lines were drawn
  float detailWipe(vec3 p) {
    float hn = clamp((dot(p.xy, uDrawDir) - uDrawSpan.x) / (uDrawSpan.y - uDrawSpan.x), 0.0, 1.0);
    return clamp((uDetailIn * 1.25 - hn) / 0.25, 0.0, 1.0);
  }
  float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y); }
  vec2 planeUV(vec3 p, vec3 n) {
    vec3 a = abs(n);
    if (a.y > 0.7) return p.xz;
    return a.x > a.z ? vec2(p.z, p.y) : vec2(p.x, p.y);
  }
`;

/* =========================================================================== */
export function createStage(cfg = {}) {
  const S = {};
  const DPR = Math.min(2, Math.max(1, devicePixelRatio || 1));
  let W = innerWidth, H = innerHeight;
  const phone = () => W / H < 0.8;
  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(DPR);
  renderer.setSize(W, H, false);
  renderer.setClearColor(0xf2efe7, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  const scene = new THREE.Scene();
  const root = new THREE.Group(); scene.add(root);

  const hatch0 = (phone() ? cfg.hatchPhone || cfg.hatch : cfg.hatch) || 0.11;
  const U = {
    uSun: { value: CONVENTION.clone() },
    uSweep: { value: new THREE.Vector4(Math.SQRT1_2, -Math.SQRT1_2, -999, cfg.soft || 0.8) },
    uReal: { value: num('real', 0) },
    uPaper: { value: raw(0xf2efe7) },
    uInk: { value: raw(0x1d1c19) },
    uAccent: { value: raw(0xe85d04) },
    uHatch: { value: hatch0 * (DPR < 1.5 ? 1.3 : 1) },
    uLinePx: { value: 1.05 * DPR },
    uDraw: { value: 1 },
    uDrawSpan: { value: new THREE.Vector2(...(cfg.drawSpan || [0, 12])) },
    uDrawDir: { value: new THREE.Vector2(...(cfg.drawDir || [0, 1])) },
    uHatchIn: { value: 1 },
    uWipe: { value: new THREE.Vector2(...(cfg.wipe || [-12, 8])) },
    uDetailIn: { value: 1 },
    uDepthCue: { value: 0 },
    uBump: { value: 1.25 },
  };

  /* ---------- environment and light ---------- */
  {
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(12, 40, 20), new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec3 vP; void main() {
        vec3 d = normalize(vP);
        float h = d.y;
        vec3 horizon = vec3(0.88, 0.86, 0.82);
        vec3 zenith = vec3(0.28, 0.44, 0.68);
        vec3 ground = mix(vec3(0.34, 0.31, 0.28), vec3(0.52, 0.47, 0.41), smoothstep(-0.8, 0.0, h));
        vec3 sky = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.65));
        float sunGlow = pow(max(0.0, dot(d, normalize(vec3(-0.7, 0.55, 0.7)))), 12.0);
        sky += vec3(0.32, 0.24, 0.14) * sunGlow;
        gl_FragColor = vec4(h > 0.0 ? sky : ground, 1.0);
      }`,
    })));
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(envScene, 0.015).texture;
  }
  const sun = new THREE.DirectionalLight(0xfff1dc, 3.5);
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xdce7f3, 0xbba98e, 0.52); scene.add(hemi);
  const sunAim = { t: new THREE.Vector3(), ext: 24 };
  function aimSun(cx, cy, ext, map = 4096) {
    sunAim.t.set(cx, cy, -3.5); sunAim.ext = ext;
    sun.castShadow = true;
    sun.shadow.mapSize.set(map, map);
    sun.shadow.bias = -0.00035; sun.shadow.normalBias = 0.014;
    const c = sun.shadow.camera;
    c.left = -ext; c.right = ext; c.top = ext; c.bottom = -ext; c.near = 6; c.far = 210;
    c.updateProjectionMatrix();
    placeSun();
  }
  function placeSun() {
    sun.target.position.copy(sunAim.t);
    sun.position.copy(U.uSun.value).multiplyScalar(90).add(sunAim.t);
    sun.target.updateMatrixWorld();
  }
  function setSun(dir) { U.uSun.value.copy(dir).normalize(); placeSun(); }

  /* ---------- materials ---------- */
  const KIND = {
    plain: 0, brick: 1, stone: 2, glass: 3, zinc: 4, wood: 5, paving: 6,
    sky: 7, foliage: 8, steel: 9, interior: 10, oakFloor: 11, plaster: 12, travertine: 13, linen: 14,
  };
  const BASE = {
    brick: { color: 0xc8b196, roughness: 0.88 },
    stone: { color: 0xdad3c4, roughness: 0.76 },
    glass: { color: 0xffffff, roughness: 0.06, metalness: 0.05 },
    zinc: { color: 0x676b6f, roughness: 0.48, metalness: 0.45 },
    wood: { color: 0x96643e, roughness: 0.58 },
    paving: { color: 0xc5beb0, roughness: 0.86 },
    sky: { color: 0xbfd2e3, roughness: 1 },
    foliage: { color: 0x5c7144, roughness: 0.88, flatShading: true },
    steel: { color: 0x262523, roughness: 0.38, metalness: 0.68 },
    plain: { color: 0xe8e2d6, roughness: 0.84 },
    interior: { color: 0xf4e3c6, roughness: 0.9, emissive: 0x523618, emissiveIntensity: 0.65 },
    oakFloor: { color: 0xc69c6d, roughness: 0.52 },
    plaster: { color: 0xf1ede4, roughness: 0.86 },
    travertine: { color: 0xdcd3c3, roughness: 0.58 },
    linen: { color: 0xe3dcd0, roughness: 0.92 },
  };
  const MATS = {};
  function mat(kind, o = {}) {
    const key = kind + JSON.stringify(o);
    if (MATS[key]) return MATS[key];
    const m = new THREE.MeshStandardMaterial({ ...BASE[kind], polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    m.envMapIntensity = ({ glass: 1.55, steel: 1.05, zinc: 0.95, wood: 0.55, oakFloor: 0.65, travertine: 0.55 }[kind] || 0.45) * (cfg.envScale || 1);
    if (o.color) m.color.setHex(o.color);
    const K = KIND[kind];
    const faint = o.faint ? 1 : 0, realOnly = o.realOnly ? 1 : 0, drawOnly = o.drawOnly ? 1 : 0;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'varying vec3 vWP; varying vec3 vWN;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 wpp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wpp = instanceMatrix * wpp;
        #endif
        vWP = (modelMatrix * wpp).xyz;
        vWN = normalize(mat3(modelMatrix) * objectNormal);`);
      sh.fragmentShader = `#define KIND ${K}\n#define FAINT ${faint}\n#define REAL_ONLY ${realOnly}\n#define DRAW_ONLY ${drawOnly}\nvarying vec3 vWP; varying vec3 vWN; uniform float uBump;\n${GLSL_COMMON}
        // brick: running bond 215 x 65, 10 mm joints. x: along the course, y: up
        vec4 brickAt(vec2 q) {
          float course = floor(q.y / 0.075);
          float bx = q.x / 0.225 + mod(course, 2.0) * 0.5;
          return vec4(floor(bx), course, fract(bx) * 0.225, fract(q.y / 0.075) * 0.075);
        }
        float brickHeight(vec2 q) {
          vec4 b = brickAt(q);
          float ex = min(b.z, 0.225 - b.z + 0.011), ey = min(b.w, 0.075 - b.w + 0.011);
          float e = min(ex - 0.0055, ey - 0.0055);
          float face = smoothstep(0.0035, 0.0095, e);
          float tilt = (hash12(b.xy + 9.2) - 0.5) * 0.0014;
          float crease = (vnoise(vec2(q.x * 55.0, q.y * 190.0) + b.xy * 5.3) - 0.5) * 0.0009;
          float grain = (vnoise(q * 380.0) - 0.5) * 0.0007 + (vnoise(q * 95.0 + b.xy * 7.0) - 0.5) * 0.0010 + crease + tilt;
          float mortarGrain = -0.0085 + (vnoise(q * 420.0) - 0.5) * 0.0005;
          return mix(mortarGrain, grain, face);
        }
        float matHeight(vec2 q) {
          #if KIND == 1
            return brickHeight(q);
          #elif KIND == 2 || KIND == 13
            float jx = smoothstep(0.004, 0.001, abs(fract(q.x / 0.9 + 0.5) - 0.5) * 0.9);
            float pores = (vnoise(q * 140.0) - 0.5) * 0.0007 + (vnoise(vec2(q.x * 12.0, q.y * 48.0)) - 0.5) * 0.0006;
            return pores - jx * 0.003;
          #elif KIND == 4
            float sx = abs(fract(q.x / 0.43 + 0.5) - 0.5) * 0.43;
            float rib = smoothstep(0.014, 0.003, sx) * 0.008;
            float wave = sin(q.y * 5.5 + floor(q.x / 0.43) * 2.1) * 0.0005;
            return rib + wave;
          #elif KIND == 5
            float gx = abs(fract(q.x / 0.095 + 0.5) - 0.5) * 0.095;
            float groove = -smoothstep(0.005, 0.001, gx) * 0.0045;
            float cath = (vnoise(vec2(q.x * 160.0, q.y * 14.0)) - 0.5) * 0.0007;
            return groove + cath;
          #elif KIND == 11
            float gx = abs(fract(q.x / 0.165 + 0.5) - 0.5) * 0.165;
            float gy = abs(fract((q.y + floor(q.x / 0.165) * 0.55) / 1.45 + 0.5) - 0.5) * 1.45;
            float groove = -smoothstep(0.004, 0.001, min(gx, gy)) * 0.0035;
            float cath = (vnoise(vec2(q.x * 140.0, q.y * 12.0)) - 0.5) * 0.0006;
            return groove + cath;
          #elif KIND == 6
            vec2 g = abs(fract(q / vec2(0.6, 0.6) + 0.5) - 0.5) * 0.6;
            float j = smoothstep(0.008, 0.002, min(g.x, g.y));
            return (vnoise(q * 95.0) - 0.5) * 0.0008 - j * 0.004;
          #elif KIND == 12
            return (vnoise(q * 32.0) - 0.5) * 0.0004 + (vnoise(q * 150.0) - 0.5) * 0.0003;
          #elif KIND == 14
            return (sin(q.x * 260.0) * sin(q.y * 260.0)) * 0.0005 + (vnoise(q * 90.0) - 0.5) * 0.0006;
          #else
            return 0.0;
          #endif
        }
      ` + sh.fragmentShader
          .replace('#include <shadowmap_pars_fragment>', '#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>')
          .replace('void main() {', `void main() {
            float rv = revealAt(vWP);
            #if REAL_ONLY
              if (rv < 0.5) discard;
            #endif
            #if DRAW_ONLY
              if (rv > 0.5 || uHatchIn < 0.02) discard;
            #endif`)
          .replace('#include <color_fragment>', `#include <color_fragment>
            {
              vec2 q = planeUV(vWP, vWN);
              #if KIND == 1
                vec4 b = brickAt(q);
                float fw = max(fwidth(q.x), fwidth(q.y)) * 1.15;
                float brickVis = smoothstep(0.045, 0.015, fw);
                float jointVis = smoothstep(0.013, 0.004, fw);
                float jx = 1.0 - smoothstep(0.0095 - fw, 0.0095 + fw, b.z);
                float jy = 1.0 - smoothstep(0.0095 - fw, 0.0095 + fw, b.w);
                float joint = max(jx, jy);
                float h = hash12(b.xy), h2 = hash12(b.xy + 17.3), h3 = hash12(b.xy + 41.7), h4 = hash12(b.xy + 83.9);
                vec3 base = diffuseColor.rgb * (0.95 + 0.09 * (vnoise(q * 0.65) - 0.5)) * (0.96 + 0.04 * smoothstep(0.0, 2.5, q.y));
                float kilnDark = smoothstep(0.80, 0.98, h4) * 0.22;
                vec3 bc = base * (0.85 + 0.26 * h - kilnDark) * vec3(1.0 + 0.08 * (h2 - 0.5), 1.0 - 0.025 * (h3 - 0.5), 1.0 - 0.10 * (h2 - 0.5));
                bc *= 0.92 + 0.16 * vnoise(vec2(q.x * 55.0, q.y * 140.0) + b.xy * 3.1) * jointVis;
                float bedShade = (1.0 - smoothstep(0.009, 0.015, b.w)) * step(0.009, b.w) * 0.14 * jointVis;
                bc *= 1.0 - bedShade;
                vec3 mortar = vec3(0.66, 0.63, 0.57) * (0.94 + 0.12 * vnoise(q * 180.0));
                vec3 far = mix(base, mortar, 0.13);
                vec3 mid = mix(bc, mortar, 0.13);
                vec3 nearC = mix(bc, mortar * 0.92, joint);
                diffuseColor.rgb = mix(mix(far, mid, brickVis), nearC, jointVis);
              #elif KIND == 4
                float fwz = max(fwidth(q.x) * 1.4, 0.005);
                float sx = fract(q.x / 0.43 + 0.5) - 0.5;
                float seamDark = 1.0 - smoothstep(0.0, fwz, abs(sx) * 0.43);
                float seamHi = 1.0 - smoothstep(0.0, fwz * 1.4, abs(sx * 0.43 - 0.007));
                float welt = 1.0 - smoothstep(0.0, max(fwidth(q.y) * 1.4, 0.005), abs(fract(q.y / 1.45 + 0.3) - 0.5) * 1.45);
                float patina = 0.94 + 0.10 * vnoise(vec2(q.x * 18.0, q.y * 2.2)) + 0.04 * (vnoise(q * 4.0) - 0.5);
                diffuseColor.rgb *= patina * (1.0 - 0.42 * seamDark - 0.18 * welt) + 0.10 * seamHi;
              #elif KIND == 5
                float pitch = 0.095;
                float board = floor(q.x / pitch);
                float grain = vnoise(vec2(q.x * 95.0, q.y * 4.5 + board * 3.7));
                float fine = vnoise(vec2(q.x * 260.0, q.y * 16.0));
                diffuseColor.rgb *= (0.85 + 0.25 * hash12(vec2(board, 3.0))) * (0.90 + 0.14 * grain + 0.06 * fine);
                float groove = 1.0 - smoothstep(0.0, max(fwidth(q.x) * 1.2, 0.0025), abs(fract(q.x / pitch + 0.5) - 0.5) * pitch);
                diffuseColor.rgb *= 1.0 - 0.48 * groove;
              #elif KIND == 11
                float pw = 0.165, pl = 1.45;
                float colIdx = floor(q.x / pw);
                float rowIdx = floor((q.y + colIdx * 0.55) / pl);
                float bh = hash12(vec2(colIdx, rowIdx));
                float grain = vnoise(vec2(q.x * 85.0, q.y * 3.8 + bh * 9.0));
                float cath = vnoise(vec2(q.x * 28.0 + sin(q.y * 2.2) * 0.6, q.y * 2.5));
                diffuseColor.rgb *= (0.88 + 0.20 * bh) * (0.91 + 0.12 * grain + 0.07 * cath);
                float gx = 1.0 - smoothstep(0.0, max(fwidth(q.x) * 1.2, 0.002), abs(fract(q.x / pw + 0.5) - 0.5) * pw);
                float gy = 1.0 - smoothstep(0.0, max(fwidth(q.y) * 1.2, 0.003), abs(fract((q.y + colIdx * 0.55) / pl + 0.5) - 0.5) * pl);
                diffuseColor.rgb *= 1.0 - 0.38 * max(gx, gy * 0.75);
              #elif KIND == 6
                float rowP = floor(q.y / 0.6);
                vec2 pq = vec2(q.x + mod(rowP, 2.0) * 0.45, q.y);
                vec2 cell = floor(pq / vec2(0.9, 0.6));
                vec2 g = abs(fract(pq / vec2(0.9, 0.6) + 0.5) - 0.5) * vec2(0.9, 0.6);
                float j = 1.0 - smoothstep(0.0, max(max(fwidth(q.x), fwidth(q.y)) * 1.2, 0.005), min(g.x, g.y));
                float sh = hash12(cell);
                vec3 flagCol = diffuseColor.rgb * (0.88 + 0.18 * sh) * vec3(1.0 + 0.04 * (sh - 0.5), 1.0, 1.0 - 0.04 * (sh - 0.5));
                flagCol *= 0.95 + 0.09 * vnoise(q * 22.0);
                diffuseColor.rgb = mix(flagCol, vec3(0.50, 0.48, 0.44), j * 0.65);
              #elif KIND == 7
                float k = clamp((vWP.y + 4.0) / 40.0, 0.0, 1.0);
                diffuseColor.rgb = mix(vec3(0.86, 0.87, 0.85), vec3(0.42, 0.58, 0.76), pow(k, 0.8));
              #elif KIND == 2
                float blockJ = 1.0 - smoothstep(0.0, max(fwidth(q.x) * 1.3, 0.003), abs(fract(q.x / 0.9 + 0.5) - 0.5) * 0.9);
                float bed = vnoise(vec2(q.x * 4.0, q.y * 26.0));
                float oolite = vnoise(q * 75.0);
                diffuseColor.rgb *= (0.95 + 0.06 * bed + 0.04 * (oolite - 0.5)) * (1.0 - 0.18 * blockJ);
              #elif KIND == 12
                float blotch = vnoise(q * 1.8) * 0.04 + vnoise(q * 9.5) * 0.025;
                diffuseColor.rgb *= 0.97 + blotch;
              #elif KIND == 13
                float vein = vnoise(vec2(q.x * 3.5 + sin(q.y * 4.0) * 0.25, q.y * 22.0));
                float fleck = vnoise(q * 85.0);
                diffuseColor.rgb *= 0.93 + 0.10 * vein + 0.05 * (fleck - 0.5);
              #elif KIND == 14
                float weave = (vnoise(vec2(q.x * 120.0, q.y * 18.0)) - 0.5) * 0.07 + (vnoise(vec2(q.x * 18.0, q.y * 120.0)) - 0.5) * 0.07;
                diffuseColor.rgb *= 0.98 + weave;
              #elif KIND == 3
                float k = fract((vWP.y - 0.45) / 3.0);
                vec3 skyRefl = mix(vec3(0.10, 0.12, 0.14), vec3(0.32, 0.40, 0.48), smoothstep(0.22, 0.92, k));
                float warmZone = smoothstep(0.05, 0.45, k) * (1.0 - smoothstep(0.55, 0.92, k));
                float roomVar = 0.6 + 0.4 * sin(vWP.x * 1.7 + floor((vWP.y - 0.45) / 3.0) * 2.3);
                vec3 warmRoom = vec3(0.42, 0.30, 0.18) * warmZone * roomVar * (FAINT == 1 ? 0.25 : 0.75);
                diffuseColor.rgb = skyRefl + warmRoom;
                diffuseColor.rgb += 0.065 * smoothstep(0.18, 0.0, abs(fract((vWP.x - vWP.y * 0.6) / 2.7) - 0.5));
              #elif KIND == 9
                diffuseColor.rgb *= 0.94 + 0.10 * vnoise(q * 45.0);
              #endif
            }`)
          .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
            #if KIND == 1
            {
              vec2 qr = planeUV(vWP, vWN);
              vec4 br = brickAt(qr);
              float jr = max(1.0 - smoothstep(0.008, 0.012, br.z), 1.0 - smoothstep(0.008, 0.012, br.w));
              roughnessFactor = mix(0.76 + 0.14 * hash12(br.xy + 5.1), 0.96, jr);
            }
            #elif KIND == 4
            {
              vec2 qr = planeUV(vWP, vWN);
              roughnessFactor = 0.42 + 0.14 * vnoise(vec2(qr.x * 20.0, qr.y * 3.0));
            }
            #elif KIND == 5 || KIND == 11
            {
              vec2 qr = planeUV(vWP, vWN);
              roughnessFactor = 0.44 + 0.16 * vnoise(vec2(qr.x * 80.0, qr.y * 6.0));
            }
            #endif`)
          .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
            #if KIND == 1 || KIND == 2 || KIND == 4 || KIND == 5 || KIND == 6 || KIND == 11 || KIND == 12 || KIND == 13 || KIND == 14
            {
              vec2 q = planeUV(vWP, normalize(vWN));
              float near = smoothstep(0.025, 0.004, max(fwidth(q.x), fwidth(q.y)));
              if (near > 0.0) {
                float hb = matHeight(q) * uBump * near;
                vec3 vp = -vViewPosition;
                vec3 dpx = dFdx(vp), dpy = dFdy(vp);
                vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
                float det = dot(dpx, r1);
                vec3 grad = sign(det) * (dFdx(hb) * r1 + dFdy(hb) * r2);
                normal = normalize(abs(det) * normal - grad);
              }
            }
            #endif`)
          .replace('#include <aomap_fragment>', `#include <aomap_fragment>
            {
              // porch & reveal recess gets deep sky occlusion around z = -0.08..-1.05, recovering inside the sunlit rooms
              float porchAo = smoothstep(-0.08, -0.95, vWP.z) * (1.0 - smoothstep(-1.15, -2.1, vWP.z));
              float roomCornerAo = smoothstep(0.38, 0.0, abs(vWP.y - 0.45)) * 0.16 * step(-12.0, vWP.z) * step(vWP.z, -1.05);
              float ao = 1.0 - 0.52 * porchAo - roomCornerAo;
              reflectedLight.indirectDiffuse *= ao; reflectedLight.indirectSpecular *= ao;
            }`)
          .replace('#include <dithering_fragment>', `#include <dithering_fragment>
            {
              vec3 N = normalize(vWN);
              float ndl = dot(N, uSun);
              float lit = getShadowMask() * smoothstep(-0.02, 0.06, ndl);
              float shade = 1.0 - lit;
              vec2 q = planeUV(vWP, N);
              vec3 col = uPaper;
              float hw = hatchWipe(vWP) * step(0.001, uHatchIn);
              #if KIND == 3
                col *= mix(1.0, 0.955, hw);
              #endif
              #if KIND == 7
                shade = 0.0;
              #endif
              // depth cue: what sits back gets a little grey, so the relief reads before the lens moves
              col *= 1.0 - uDepthCue * 0.11 * smoothstep(0.0, -1.1, vWP.z) * (FAINT == 1 ? 0.4 : 1.0);
              float hatchK = FAINT == 1 ? 0.18 : 0.85;
              float hl = lineAt(q.x + q.y, uHatch, uLinePx * 0.95);
              float dense = 1.0 - lineFade(q.x + q.y, uHatch, 3.5);
              hl = mix(hl, 0.32, dense);
              col = mix(col, col * 0.93, shade * hw * (FAINT == 1 ? 0.3 : 1.0));
              col = mix(col, uInk, hl * shade * hatchK * hw);
              float det = detailWipe(vWP) * (FAINT == 1 ? 0.3 : 1.0);
              #if KIND == 1
                if (abs(N.y) < 0.7) {
                  float c4 = lineAt(q.y, 0.3, uLinePx * 0.7) * lineFade(q.y, 0.3, 5.0);
                  float c1 = lineAt(q.y, 0.075, uLinePx * 0.6) * lineFade(q.y, 0.075, 7.0);
                  float crs = floor(q.y / 0.075);
                  float c2 = lineAt(q.x + mod(crs, 2.0) * 0.1125, 0.225, uLinePx * 0.6) * lineFade(q.y, 0.075, 9.0);
                  col = mix(col, uInk, max(max(c4 * 0.22, c1 * 0.2), c2 * 0.16) * det);
                }
              #elif KIND == 4
                col = mix(col, uInk, lineAt(q.x, 0.43, uLinePx * 0.7) * 0.3 * lineFade(q.x, 0.43, 5.0) * det);
              #elif KIND == 5 || KIND == 11
                col = mix(col, uInk, lineAt(q.x, 0.095, uLinePx * 0.6) * 0.25 * lineFade(q.x, 0.095, 5.0) * det);
              #elif KIND == 6
                vec2 g6 = vec2(lineAt(q.x, 0.6, uLinePx * 0.6), lineAt(q.y, 0.6, uLinePx * 0.6));
                col = mix(col, uInk, max(g6.x, g6.y) * 0.12 * lineFade(q.x, 0.6, 6.0) * det);
              #endif
              gl_FragColor.rgb = mix(col, gl_FragColor.rgb, rv);
              #if KIND != 7
                float fb = frontBand(vWP);
                vec3 scanCol = mix(uAccent, vec3(1.0, 0.55, 0.18), smoothstep(0.42, 0.92, fb));
                gl_FragColor.rgb = mix(gl_FragColor.rgb, scanCol, clamp(fb * 0.85, 0.0, 0.94));
              #endif
            }`);
    };
    m.customProgramCacheKey = () => `elev-${K}-${faint}-${realOnly}-${drawOnly}`;
    return (MATS[key] = m);
  }

  const clearGlassMat = new THREE.MeshStandardMaterial({
    color: 0xdbe7f0,
    roughness: 0.08,
    metalness: 0.1,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });

  // Lines draft themselves on: each segment starts at a time set by its height (bottom first)
  // and a little randomness, then grows along its length. o.first: drawn before everything (the ground line).
  const LMATS = [];
  const lineCache = {};
  function lineMat(px, o = {}) {
    const key = px + JSON.stringify(o);
    if (lineCache[key]) return lineCache[key];
    const m = new LineMaterial({ color: o.color || 0x1d1c19, linewidth: px * DPR, transparent: true, toneMapped: false });
    m.resolution.set(W * DPR, H * DPR);
    const drawOnly = o.drawOnly ? 1 : 0, first = o.first ? 1 : 0;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.uniforms.uLineReal = { value: o.realLines == null ? 0.0 : o.realLines };
      sh.uniforms.uOrder = { value: o.order == null ? -1 : o.order };
      sh.vertexShader = 'varying vec3 vLW; varying float vT; varying float vT0;\nuniform vec2 uDrawSpan; uniform vec2 uDrawDir; uniform float uOrder;\n' + sh.vertexShader.replace('void main() {', `void main() {
        vec3 wS = (modelMatrix * vec4(instanceStart, 1.0)).xyz, wE = (modelMatrix * vec4(instanceEnd, 1.0)).xyz;
        vLW = position.y < 0.5 ? wS : wE;
        vT = position.y < 0.5 ? 0.0 : 1.0;
        float hn = clamp((min(dot(wS.xy, uDrawDir), dot(wE.xy, uDrawDir)) - uDrawSpan.x) / (uDrawSpan.y - uDrawSpan.x), 0.0, 1.0);
        float rnd = fract(sin(dot(wS.xy + wE.yx * 1.7, vec2(12.9898, 78.233))) * 43758.5453);
        vT0 = ${first ? '0.0' : '0.13 + 0.6 * (uOrder >= 0.0 ? uOrder : hn) + 0.12 * rnd'};`);
      sh.fragmentShader = `#define DRAW_ONLY ${drawOnly}\n#define FIRST ${first}\nvarying vec3 vLW; varying float vT; varying float vT0; uniform float uLineReal;\n${GLSL_COMMON}\n` + sh.fragmentShader.replace('#include <colorspace_fragment>', `#include <colorspace_fragment>
        float rv = revealAt(vLW);
        float vis = DRAW_ONLY == 1 ? 1.0 - rv : mix(1.0, uLineReal, rv);
        float grow = (uDraw - vT0) / (FIRST == 1 ? 0.16 : 0.12);
        if (vT > grow) discard;
        if (vis < 0.01) discard;
        gl_FragColor.a *= vis;`);
    };
    m.customProgramCacheKey = () => `eline-${drawOnly}-${first}`;
    LMATS.push(m);
    return (lineCache[key] = m);
  }

  /* ---------- geometry helpers ---------- */
  const box = (x0, y0, z0, x1, y1, z1) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const rect = (x0, y0, x1, y1) => { const s = new THREE.Shape(); s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.closePath(); return s; };
  const hole = (x0, y0, x1, y1) => { const p = new THREE.Path(); p.moveTo(x0, y0); p.lineTo(x0, y1); p.lineTo(x1, y1); p.lineTo(x1, y0); p.closePath(); return p; };
  function panel(outer, holes, z0, z1) {
    const s = rect(...outer); holes.forEach((h) => s.holes.push(hole(...h)));
    return new THREE.ExtrudeGeometry(s, { depth: z1 - z0, bevelEnabled: false }).translate(0, 0, z0);
  }
  function add(geo, m, lw = 1, o = {}) {
    const mesh = new THREE.Mesh(geo, m);
    mesh.castShadow = o.cast !== false; mesh.receiveShadow = o.receive !== false;
    (o.parent || root).add(mesh);
    if (lw > 0) {
      const eg = new THREE.EdgesGeometry(geo, o.angle || 25);
      const lg = new LineSegmentsGeometry().fromEdgesGeometry(eg);
      const l = new LineSegments2(lg, lineMat(lw, { color: o.lineColor, drawOnly: o.drawOnlyLines, realLines: o.realLines }));
      l.renderOrder = 2;
      (o.parent || root).add(l);
    }
    return mesh;
  }
  function lines(segs, lw, o = {}) {
    const lg = new LineSegmentsGeometry(); lg.setPositions(segs);
    const l = new LineSegments2(lg, lineMat(lw, { drawOnly: o.drawOnly !== false, color: o.color, first: o.first, realLines: o.realLines }));
    l.renderOrder = 3;
    (o.parent || root).add(l);
    return l;
  }
  const loop = (pts, z) => { const s = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s.push(a[0], a[1], z, b[0], b[1], z); } return s; };

  /* ---------- the townhouse ---------- */
  // x along the street, y up, z towards the street. Facade plane z = 0 (or the setback).
  // Ground floor +0.45 (three steps up), first +3.60, second +6.60, roof +9.10, parapet +10.00.
  const T = 0.4;
  function windowIn(g, x0, y0, x1, y1, recess, o) {
    const fw = 0.062, fw2 = 0.032, z1 = -recess, z0 = z1 - 0.075;
    const lw = o.faint ? 0 : 0.7;
    const fm = mat('steel', { faint: o.faint });
    // outer architectural casement frame
    add(panel([x0, y0, x1, y1], [[x0 + fw, y0 + fw, x1 - fw, y1 - fw]], z0, z1), fm, lw, { parent: g, lineColor: o.lc, realLines: o.rl });
    // inner stepped sash sub-frame for realistic architectural depth
    if (!o.faint) {
      add(panel([x0 + fw, y0 + fw, x1 - fw, y1 - fw], [[x0 + fw + fw2, y0 + fw + fw2, x1 - fw - fw2, y1 - fw - fw2]], z0 - 0.015, z1 - 0.022), fm, 0, { parent: g, cast: false });
    }
    const n = o.panes || (x1 - x0 > 1.5 ? 2 : 1);
    for (let i = 1; i < n; i++) {
      const mx = x0 + (x1 - x0) * i / n;
      add(box(mx - 0.028, y0 + fw, z0 + 0.008, mx + 0.028, y1 - fw, z1), fm, lw, { parent: g, lineColor: o.lc, realLines: o.rl });
    }
    if (o.transom) add(box(x0 + fw, o.transom - 0.028, z0 + 0.008, x1 - fw, o.transom + 0.028, z1), fm, lw, { parent: g, lineColor: o.lc, realLines: o.rl });
    add(new THREE.PlaneGeometry(x1 - x0 - 0.02, y1 - y0 - 0.02).translate((x0 + x1) / 2, (y0 + y1) / 2, z0 + 0.035), mat('glass', { faint: o.faint }), 0, { parent: g, cast: false });
    if (!o.faint) {
      const segs = [];
      for (let i = 0; i < n; i++) {
        const px0 = x0 + (x1 - x0) * i / n + 0.14, py1 = (o.transom || y1) - 0.16;
        const L = Math.min(0.5, (x1 - x0) / n * 0.4);
        segs.push(px0, py1 - L, 0.02 - recess, px0 + L, py1, 0.02 - recess);
        segs.push(px0 + 0.1, py1 - L - 0.02, 0.02 - recess, px0 + L + 0.08, py1 - 0.04, 0.02 - recess);
      }
      lines(segs, 0.6, { parent: g });
    }
    if (o.sill) {
      const st = mat('stone', { faint: o.faint });
      add(box(x0 - 0.06, y0 - 0.068, -T + 0.06, x1 + 0.06, y0 + 0.012, 0.065), st, o.faint ? 0 : 0.9, { parent: g, lineColor: o.lc, realLines: o.rl });
      if (!o.faint) {
        add(box(x0 - 0.05, y0 - 0.082, 0.0, x1 + 0.05, y0 - 0.068, 0.048), st, 0, { parent: g });
      }
    }
  }

  // Build full 3D townhouse interior + rear courtyard garden for active show houses
  function buildInterior(g, ox, v, doorL, PAR, O) {
    const X = (x) => (doorL ? x : 6 - x);
    const bM = (x0, y0, z0, x1, y1, z1) => (doorL ? box(x0, y0, z0, x1, y1, z1) : box(6 - x1, y0, z0, 6 - x0, y1, z1));
    const addM = (x0, y0, z0, x1, y1, z1, m, lw = 0, opts = {}) => add(bM(x0, y0, z0, x1, y1, z1), m, lw, { parent: g, ...opts });

    const oakFl = mat('oakFloor', { color: 0xc49a6c });
    const oakJoinery = mat('wood', { color: 0xb07d4f });
    const darkWalnut = mat('wood', { color: 0x5c3e26 });
    const plaster = mat('plaster', { color: 0xf1ede4 });
    const plasterCeil = mat('plaster', { color: 0xf6f3ec });
    const trav = mat('travertine', { color: 0xdcd3c3 });
    const stone = mat('stone');
    const brick = mat('brick', { color: v.brick || 0xc8b196 });
    const steel = mat('steel');
    const linenSofa = mat('linen', { color: 0xe4ddd0 });
    const woolRug = mat('linen', { color: 0xcfc5b3 });
    const warmGlow = mat('interior', { realOnly: true });
    const paving = mat('paving');

    // 1. Structural Shell: Ground floor oak slab, party walls, upper floor backing above z = -6.8
    addM(0.0, 0.0, -12.0, 6.0, 0.45, -0.4, oakFl, 0.5, O);
    // Honed stone entrance threshold mat inside the doorway
    addM(0.55, 0.445, -1.55, 2.05, 0.455, -0.95, trav, 0);

    // West & East Party Walls (x = 0..0.24 and x = 5.76..6.0)
    addM(0.0, 0.45, -12.0, 0.24, 6.60, -0.4, plaster, 0.5, O);
    addM(5.76, 0.45, -12.0, 6.0, 6.60, -0.4, plaster, 0.5, O);
    // Upper stories solid backing above y = 6.60 so exterior windows on 2nd/roof floors stay backed
    addM(0.0, 6.45, -12.0, 6.0, PAR - 0.9, -1.12, plaster, 0);

    // Exposed London stock brick feature wall panel in the double-height dining atrium (east wall)
    addM(5.71, 0.45, -11.8, 5.76, 6.40, -6.6, brick, 0.5, O);

    // Shadow-gap dark steel & oak skirting along party walls
    addM(0.24, 0.45, -11.9, 0.26, 0.54, -1.0, steel, 0);
    addM(5.74, 0.45, -11.9, 5.76, 0.54, -0.4, steel, 0);

    // Inner front facade plaster lining + deep oak window bench under the 3-pane front window
    addM(2.15, 0.45, -0.46, 5.76, 0.92, -0.38, plaster, 0);
    addM(2.55, 0.88, -0.68, 5.50, 0.96, -0.22, oakJoinery, 0.6, O);

    // 2. First-Floor Slab & Ceiling over Hall & Reception Parlour (z = -6.8 .. -0.4, y = 3.45 .. 3.65)
    addM(0.24, 3.45, -6.8, 5.76, 3.65, -0.4, plasterCeil, 0.6, O);
    // Acoustic oak ceiling slat coffers in the Reception Parlour ceiling
    const ceilingSlats = [];
    for (let x = 2.55; x <= 5.35; x += 0.18) {
      ceilingSlats.push(bM(x, 3.41, -5.8, x + 0.06, 3.45, -1.0));
    }
    add(mergeGeometries(ceilingSlats), oakJoinery, 0, { parent: g, cast: false });
    // Warm recessed linear LED ceiling coves
    addM(1.15, 3.43, -5.4, 1.30, 3.45, -1.4, warmGlow, 0, { cast: false });
    addM(2.42, 3.43, -5.8, 2.50, 3.45, -1.0, warmGlow, 0, { cast: false });

    // Mezzanine Gallery Balustrade overlooking the Double-Height Atrium at z = -6.8
    addM(1.25, 3.65, -6.85, 5.76, 3.74, -6.72, oakJoinery, 0.6, O);
    addM(1.25, 4.58, -6.84, 5.76, 4.64, -6.74, oakJoinery, 0.6, O);
    const mezBars = [];
    for (let x = 1.35; x <= 5.65; x += 0.16) {
      mezBars.push(bM(x, 3.74, -6.80, x + 0.022, 4.58, -6.778));
    }
    add(mergeGeometries(mezBars), steel, 0, { parent: g });

    // First-floor gallery wall backdrop (z = -5.2) with a framed architectural print visible from below
    addM(2.2, 4.15, -4.4, 3.8, 5.45, -4.34, steel, 0.5, O);
    addM(2.26, 4.21, -4.42, 3.74, 5.39, -4.39, plasterCeil, 0);
    addM(2.55, 4.45, -4.43, 3.45, 5.15, -4.41, mat('plain', { color: 0xe85d04 }), 0);

    // 3. Double-Height Atrium Roof & Glazed Rooflight Lantern (z = -12.0 .. -6.8, y = 6.40 .. 6.88)
    addM(0.24, 6.40, -12.0, 1.55, 6.62, -6.8, plasterCeil, 0);
    addM(4.55, 6.40, -12.0, 5.76, 6.62, -6.8, plasterCeil, 0);
    addM(1.55, 6.40, -7.6, 4.55, 6.62, -6.8, plasterCeil, 0);
    addM(1.55, 6.40, -12.0, 4.55, 6.62, -10.8, plasterCeil, 0);
    // Rooflight steel upstand curb & oak rafters casting diagonal skylight bars
    addM(1.50, 6.38, -10.85, 4.60, 6.85, -10.75, steel, 0.5, O);
    addM(1.50, 6.38, -7.65, 4.60, 6.85, -7.55, steel, 0.5, O);
    addM(1.50, 6.38, -10.85, 1.60, 6.85, -7.55, steel, 0.5, O);
    addM(4.50, 6.38, -10.85, 4.60, 6.85, -7.55, steel, 0.5, O);
    for (let z = -10.2; z <= -8.1; z += 0.68) {
      addM(1.58, 6.42, z - 0.035, 4.52, 6.78, z + 0.035, oakJoinery, 0.4, O);
    }
    add(bM(1.58, 6.82, -10.75, 4.52, 6.85, -7.65), clearGlassMat, 0, { parent: g, cast: false, receive: false });

    // 4. Entrance Hall & Architectural Portal into Reception Parlour (x = 2.04 .. 2.22)
    // Front pier behind porch
    addM(2.04, 0.45, -1.65, 2.22, 3.45, -0.4, plaster, 0.6, O);
    // Portal header beam above the wide opening (z = -1.65 .. -5.15)
    addM(2.04, 3.08, -5.15, 2.22, 3.45, -1.65, plaster, 0.6, O);
    // Rear pier separating Parlour and Atrium
    addM(2.04, 0.45, -6.35, 2.22, 3.45, -5.15, plaster, 0.6, O);
    // Warm oak portal liner framing the wide opening between Hall and Parlour
    addM(2.02, 0.45, -1.71, 2.24, 3.10, -1.65, oakJoinery, 0.5, O);
    addM(2.02, 0.45, -5.15, 2.24, 3.10, -5.09, oakJoinery, 0.5, O);
    addM(2.02, 3.04, -5.15, 2.24, 3.10, -1.65, oakJoinery, 0.5, O);

    // Entrance Hall Console Table & Framed Elevation Artwork on West Wall (x = 0.24 .. 0.68, z = -2.0 .. -3.3)
    addM(0.26, 1.18, -3.25, 0.66, 1.24, -1.95, trav, 0.5, O);
    addM(0.30, 0.45, -3.18, 0.62, 1.18, -3.10, steel, 0.4, O);
    addM(0.30, 0.45, -2.10, 0.62, 1.18, -2.02, steel, 0.4, O);
    // Sculptural ceramic vessel on console
    add(new THREE.CylinderGeometry(0.09, 0.07, 0.28, 12).translate(X(0.46), 1.38, -2.45), mat('stone', { color: 0xd8cfc0 }), 0.4, O);
    // Framed architectural study on hall wall
    addM(0.24, 1.52, -3.10, 0.28, 2.48, -2.10, steel, 0.5, O);
    addM(0.28, 1.57, -3.05, 0.295, 2.43, -2.15, plasterCeil, 0);
    addM(0.295, 1.72, -2.90, 0.305, 2.28, -2.30, mat('brick', { color: 0xb85a28 }), 0);

    // Open-Riser Solid Oak & Blackened Steel Staircase (x = 0.28 .. 1.24, z = -3.55 .. -6.80, y = 0.45 .. 3.60)
    const stairTreads = [], stairSteel = [];
    const nSteps = 14;
    for (let i = 0; i < nSteps; i++) {
      const f = i / nSteps;
      const sz0 = lerp(-3.55, -6.75, f), sz1 = sz0 - 0.24;
      const sy = lerp(0.66, 3.58, f);
      stairTreads.push(bM(0.30, sy - 0.045, sz1, 1.20, sy, sz0));
      // Stringer supports & vertical balustrade spindles
      stairSteel.push(bM(0.34, sy - 0.22, sz1 + 0.04, 0.40, sy - 0.045, sz0 - 0.04));
      stairSteel.push(bM(1.10, sy - 0.22, sz1 + 0.04, 1.16, sy - 0.045, sz0 - 0.04));
      stairSteel.push(bM(1.17, sy, sz0 - 0.12, 1.195, sy + 0.92, sz0 - 0.095));
      // Slanted oak handrail segment
      if (i < nSteps - 1) {
        const syNext = lerp(0.66, 3.58, (i + 1) / nSteps);
        stairTreads.push(bM(1.15, (sy + syNext) * 0.5 + 0.90, sz1 - 0.04, 1.21, (sy + syNext) * 0.5 + 0.95, sz0 + 0.04));
      }
    }
    add(mergeGeometries(stairTreads), oakJoinery, 0.5, O);
    add(mergeGeometries(stairSteel), steel, 0.4, O);

    // 5. Front Reception Parlour & Bespoke Library (x = 2.22 .. 5.76, z = -0.4 .. -6.4)
    // Floor-to-ceiling bespoke oak bookcase along East Wall (x = 5.34 .. 5.76, z = -0.65 .. -3.95)
    addM(5.32, 0.45, -3.95, 5.76, 1.12, -0.65, oakJoinery, 0.6, O); // lower credenza cabinets
    addM(5.30, 1.12, -3.97, 5.76, 1.16, -0.63, trav, 0.5, O); // travertine counter ledge
    const shelfGeo = [];
    for (let y = 1.58; y <= 3.38; y += 0.44) {
      shelfGeo.push(bM(5.36, y, -3.95, 5.76, y + 0.032, -0.65));
    }
    for (let z = -3.95; z <= -0.65; z += 0.66) {
      shelfGeo.push(bM(5.36, 1.16, z - 0.018, 5.76, 3.40, z + 0.018));
    }
    add(mergeGeometries(shelfGeo), oakJoinery, 0.5, O);

    // Architectural monographs & books on the library shelves
    const R = mulberry(71);
    const booksA = [], booksB = [], booksC = [];
    for (let s = 0; s < 4; s++) {
      const sy = 1.16 + s * 0.44 + (s > 0 ? 0.032 : 0);
      for (let b = 0; b < 5; b++) {
        let bz = -3.88 + b * 0.66;
        const zEnd = bz + 0.56;
        while (bz < zEnd - 0.05) {
          if (R() < 0.22) { bz += 0.08 + R() * 0.1; continue; }
          const thick = 0.024 + R() * 0.028;
          const bh = 0.22 + R() * 0.14;
          const depth = 0.22 + R() * 0.06;
          const gBook = bM(5.74 - depth, sy, bz, 5.74, sy + bh, bz + thick);
          const pick = R();
          if (pick < 0.42) booksA.push(gBook);
          else if (pick < 0.76) booksB.push(gBook);
          else booksC.push(gBook);
          bz += thick + 0.004;
        }
      }
    }
    if (booksA.length) add(mergeGeometries(booksA), mat('linen', { color: 0xd9d1c3 }), 0.35, O);
    if (booksB.length) add(mergeGeometries(booksB), mat('plain', { color: 0x3b444b }), 0.35, O);
    if (booksC.length) add(mergeGeometries(booksC), mat('brick', { color: 0xc25929 }), 0.35, O);

    // Monolithic Fluted Limestone Fireplace & Hearth on East Wall (x = 5.22 .. 5.76, z = -4.15 .. -5.75)
    addM(5.12, 0.45, -5.80, 5.76, 0.58, -4.10, trav, 0.6, O); // raised stone hearth slab
    addM(5.26, 0.58, -5.68, 5.76, 3.45, -5.25, trav, 0.6, O); // left chimney breast cheek
    addM(5.26, 0.58, -4.65, 5.76, 3.45, -4.22, trav, 0.6, O); // right chimney breast cheek
    addM(5.26, 1.38, -5.25, 5.76, 3.45, -4.65, trav, 0.6, O); // chimney breast overmantel
    addM(5.48, 0.58, -5.25, 5.76, 1.38, -4.65, steel, 0.4, O); // dark steel firebox
    addM(5.54, 0.58, -5.12, 5.72, 0.78, -4.78, warmGlow, 0, { cast: false }); // warm amber fire glow

    // Hand-loomed wool area rug in Reception Parlour (x = 3.15 .. 5.20, z = -1.35 .. -5.45)
    addM(3.15, 0.45, -5.45, 5.20, 0.468, -1.35, woolRug, 0.4, O);

    // Tailored Belgian-linen sofa (x = 3.42 .. 4.32, z = -1.55 .. -3.95, facing East library/hearth)
    addM(3.44, 0.47, -3.95, 4.30, 0.58, -1.55, oakJoinery, 0.5, O); // solid oak plinth base
    addM(3.42, 0.58, -3.95, 3.64, 1.24, -1.55, linenSofa, 0.6, O); // tailored back rest
    addM(3.42, 0.58, -1.75, 4.30, 1.08, -1.55, linenSofa, 0.6, O); // north arm rest
    addM(3.42, 0.58, -3.95, 4.30, 1.08, -3.75, linenSofa, 0.6, O); // south arm rest
    // Three deep linen seat & back cushions
    for (let i = 0; i < 3; i++) {
      const cz0 = -1.76 - i * 0.66, cz1 = cz0 - 0.64;
      addM(3.64, 0.58, cz1, 4.32, 0.86, cz0, linenSofa, 0.5, O);
      addM(3.62, 0.86, cz1 + 0.03, 3.80, 1.28, cz0 - 0.03, linenSofa, 0.45, O);
    }
    // Terracotta & charcoal accent cushions
    addM(3.76, 0.86, -2.18, 3.96, 1.16, -1.84, mat('brick', { color: 0xc85a28 }), 0.4, O);
    addM(3.76, 0.86, -3.66, 3.96, 1.16, -3.32, mat('plain', { color: 0x3b444b }), 0.4, O);

    // Honed Travertine Plinth Coffee Table (x = 4.46 .. 5.04, z = -2.05 .. -3.45)
    addM(4.52, 0.47, -3.38, 4.98, 0.74, -2.12, oakJoinery, 0.4, O);
    addM(4.46, 0.74, -3.45, 5.04, 0.82, -2.05, trav, 0.6, O);
    // Architectural folio book & vessel on coffee table
    addM(4.58, 0.82, -2.65, 4.88, 0.86, -2.28, mat('brick', { color: 0xd95818 }), 0.35, O);
    add(new THREE.CylinderGeometry(0.08, 0.06, 0.16, 12).translate(X(4.74), 0.90, -3.05), steel, 0.35, O);

    // Sculptural Oak & Linen Lounge Armchair near Hearth (x = 3.65 .. 4.42, z = -4.45 .. -5.22)
    addM(3.65, 0.47, -5.22, 4.42, 0.78, -4.45, oakJoinery, 0.5, O);
    addM(3.68, 0.72, -5.18, 4.38, 0.92, -4.48, linenSofa, 0.5, O);
    addM(3.68, 0.92, -5.22, 4.38, 1.28, -5.02, linenSofa, 0.5, O);

    // Minimalist Brass/Steel & Opal Pendant Chandelier in Parlour
    addM(4.48, 2.75, -2.77, 4.52, 3.45, -2.73, steel, 0);
    addM(4.15, 2.72, -3.15, 4.85, 2.76, -2.35, steel, 0.4, O);
    add(new THREE.SphereGeometry(0.11, 14, 10).translate(X(4.22), 2.74, -2.42), warmGlow, 0, { parent: g, cast: false });
    add(new THREE.SphereGeometry(0.11, 14, 10).translate(X(4.78), 2.74, -3.08), warmGlow, 0, { parent: g, cast: false });

    // 6. Double-Height Kitchen & Dining Atrium (x = 0.24 .. 5.76, z = -6.4 .. -12.0, y = 0.45 .. 6.40)
    // West Wall Bespoke Tall Walnut & Oak Kitchen Cabinetry (x = 0.24 .. 0.88, z = -7.1 .. -11.4)
    addM(0.24, 0.45, -11.4, 0.88, 3.20, -10.4, darkWalnut, 0.6, O); // tall appliance tower S
    addM(0.24, 0.45, -8.1, 0.88, 3.20, -7.1, darkWalnut, 0.6, O);  // tall pantry tower N
    addM(0.24, 0.45, -10.4, 0.88, 1.35, -8.1, darkWalnut, 0.6, O);  // base cabinets
    addM(0.24, 1.35, -10.4, 0.90, 1.41, -8.1, trav, 0.5, O);        // travertine worktop
    addM(0.24, 1.41, -10.4, 0.32, 2.25, -8.1, trav, 0.4, O);        // travertine splashback
    addM(0.24, 2.25, -10.4, 0.68, 3.20, -8.1, oakJoinery, 0.6, O);  // upper oak wall cabinets
    addM(0.32, 2.22, -10.3, 0.58, 2.25, -8.2, warmGlow, 0, { cast: false }); // under-cabinet LED strip

    // Monolithic Waterfall Honed-Travertine Kitchen Island (x = 1.35 .. 2.25, z = -7.6 .. -10.8, y = 0.45 .. 1.36)
    addM(1.35, 0.45, -10.75, 2.15, 1.30, -7.65, darkWalnut, 0.5, O);
    addM(1.33, 1.30, -10.80, 2.26, 1.37, -7.60, trav, 0.7, O);      // waterfall top slab
    addM(1.33, 0.45, -7.68, 2.26, 1.30, -7.60, trav, 0.6, O);       // north waterfall leg
    addM(1.33, 0.45, -10.80, 2.26, 1.30, -10.72, trav, 0.6, O);     // south waterfall leg
    // Dark steel architectural tap & sink basin on island
    addM(1.55, 1.37, -9.25, 1.59, 1.68, -9.21, steel, 0.4, O);
    addM(1.55, 1.64, -9.25, 1.74, 1.68, -9.21, steel, 0.4, O);
    // 3 Oak & Blackened-Steel Counter Stools along the island overhang
    for (let i = 0; i < 3; i++) {
      const sz = -8.15 - i * 0.95;
      addM(2.18, 0.45, sz - 0.18, 2.52, 0.98, sz + 0.18, steel, 0.4, O);
      addM(2.16, 0.98, sz - 0.20, 2.54, 1.04, sz + 0.20, oakJoinery, 0.5, O);
    }
    // Linear suspended brass/steel island pendant light
    addM(1.76, 2.48, -10.3, 1.82, 2.54, -8.1, steel, 0.5, O);
    addM(1.77, 2.45, -10.2, 1.81, 2.48, -8.2, warmGlow, 0, { cast: false });

    // Sculptural Solid Oak Dining Table & 6 Chairs under the Atrium Rooflight (x = 3.50 .. 5.30, z = -7.8 .. -10.7)
    addM(3.85, 1.16, -10.65, 4.95, 1.22, -7.85, oakJoinery, 0.7, O); // thick solid oak tabletop
    addM(4.02, 0.45, -10.35, 4.78, 1.16, -10.25, oakJoinery, 0.5, O); // south trestle leg
    addM(4.02, 0.45, -8.25, 4.78, 1.16, -8.15, oakJoinery, 0.5, O);   // north trestle leg
    addM(4.36, 0.62, -10.25, 4.44, 0.69, -8.25, oakJoinery, 0.4, O);  // stretcher beam
    // Sculptural travertine bowl centerpiece on dining table
    add(new THREE.CylinderGeometry(0.22, 0.12, 0.11, 16).translate(X(4.40), 1.275, -9.25), trav, 0.4, O);

    // 6 Architectural Oak Dining Chairs (3 on each side)
    const chairsGeo = [], chairCushions = [];
    for (let i = 0; i < 3; i++) {
      const cz = -8.35 - i * 0.90;
      // West side chairs (x = 3.48 .. 3.84)
      chairsGeo.push(bM(3.48, 0.45, cz - 0.22, 3.54, 1.28, cz + 0.22)); // back & rear legs
      chairsGeo.push(bM(3.78, 0.45, cz - 0.22, 3.84, 0.90, cz + 0.22)); // front legs
      chairCushions.push(bM(3.50, 0.90, cz - 0.23, 3.85, 0.95, cz + 0.23));
      // East side chairs (x = 4.96 .. 5.32)
      chairsGeo.push(bM(5.26, 0.45, cz - 0.22, 5.32, 1.28, cz + 0.22)); // back & rear legs
      chairsGeo.push(bM(4.96, 0.45, cz - 0.22, 5.02, 0.90, cz + 0.22)); // front legs
      chairCushions.push(bM(4.95, 0.90, cz - 0.23, 5.30, 0.95, cz + 0.23));
    }
    add(mergeGeometries(chairsGeo), oakJoinery, 0.45, O);
    add(mergeGeometries(chairCushions), linenSofa, 0.35, O);

    // Cluster of 3 warm architectural pendant globes dropping from the double-height atrium
    [[-8.6, 2.55], [-9.25, 2.38], [-9.9, 2.68]].forEach(([pz, py]) => {
      addM(4.39, py, pz - 0.01, 4.41, 6.40, pz + 0.01, steel, 0);
      add(new THREE.SphereGeometry(0.13, 14, 10).translate(X(4.40), py, pz), warmGlow, 0, { parent: g, cast: false });
    });

    // 7. Full-Width Crittall Steel & Glass Rear Garden Wall at z = -12.0 (x = 0.24 .. 5.76, y = 0.45 .. 6.40)
    // Top plaster spandrel above y = 5.85
    addM(0.24, 5.85, -12.08, 5.76, 6.40, -11.88, brick, 0.6, O);
    addM(0.20, 5.76, -12.12, 5.80, 5.85, -11.86, stone, 0.6, O);
    // Fixed Crittall side bays (x = 0.24..2.15 and x = 3.85..5.76) + upper transom bays (y = 2.65..5.76)
    const crittall = [];
    // Outer frame & main horizontal transoms at y = 0.45, 2.65, 3.70, 4.75, 5.76
    [0.47, 2.65, 3.70, 4.75, 5.73].forEach((ty) => {
      crittall.push(bM(0.24, ty - 0.03, -12.04, 5.76, ty + 0.03, -11.96));
    });
    // Vertical mullions across fixed bays and upper bays
    [0.27, 1.20, 2.15, 3.85, 4.80, 5.73].forEach((mx) => {
      crittall.push(bM(mx - 0.03, 0.45, -12.04, mx + 0.03, 5.76, -11.96));
    });
    // Center mullion in upper transom above the double garden doors (y = 2.65..5.76)
    crittall.push(bM(2.97, 2.65, -12.04, 3.03, 5.76, -11.96));
    // Intermediate Crittall glazing bars on fixed side panels
    [1.15, 1.90].forEach((gy) => {
      crittall.push(bM(0.27, gy - 0.018, -12.03, 2.15, gy + 0.018, -11.97));
      crittall.push(bM(3.85, gy - 0.018, -12.03, 5.73, gy + 0.018, -11.97));
    });
    add(mergeGeometries(crittall), steel, 0.6, O);
    // Clear glazing in fixed side & upper bays
    add(bM(0.28, 0.48, -12.01, 2.14, 2.64, -11.99), clearGlassMat, 0, { parent: g, cast: false, receive: false });
    add(bM(3.86, 0.48, -12.01, 5.72, 2.64, -11.99), clearGlassMat, 0, { parent: g, cast: false, receive: false });
    add(bM(0.28, 2.66, -12.01, 5.72, 5.72, -11.99), clearGlassMat, 0, { parent: g, cast: false, receive: false });

    // Pivoting Double Crittall Garden Doors (x = 2.15 .. 3.85, y = 0.45 .. 2.65, z = -12.0)
    const gDoorL = new THREE.Group();
    const gDoorR = new THREE.Group();
    const gxL = X(2.15), gxR = X(3.85);
    gDoorL.position.set( Math.min(gxL, gxR), 0, -12.0 );
    gDoorR.position.set( Math.max(gxL, gxR), 0, -12.0 );
    g.add(gDoorL, gDoorR);
    {
      const dw = 0.84;
      const lBars = [
        box(0, 0.46, -0.03, dw, 0.54, 0.03),
        box(0, 2.59, -0.03, dw, 2.64, 0.03),
        box(0, 0.46, -0.03, 0.045, 2.64, 0.03),
        box(dw - 0.045, 0.46, -0.03, dw, 2.64, 0.03),
        box(0, 1.15, -0.02, dw, 1.18, 0.02),
        box(0, 1.88, -0.02, dw, 1.91, 0.02),
        box(dw - 0.08, 1.05, 0.02, dw - 0.05, 1.45, 0.06),
      ];
      add(mergeGeometries(lBars), steel, 0.6, { parent: gDoorL, lineColor: O.lineColor, realLines: O.realLines });
      add(box(0.04, 0.52, -0.005, dw - 0.04, 2.60, 0.005), clearGlassMat, 0, { parent: gDoorL, cast: false, receive: false });

      const rBars = [
        box(-dw, 0.46, -0.03, 0, 0.54, 0.03),
        box(-dw, 2.59, -0.03, 0, 2.64, 0.03),
        box(-0.045, 0.46, -0.03, 0, 2.64, 0.03),
        box(-dw, 0.46, -0.03, -dw + 0.045, 2.64, 0.03),
        box(-dw, 1.15, -0.02, 0, 1.18, 0.02),
        box(-dw, 1.88, -0.02, 0, 1.91, 0.02),
        box(-dw + 0.05, 1.05, 0.02, -dw + 0.08, 1.45, 0.06),
      ];
      add(mergeGeometries(rBars), steel, 0.6, { parent: gDoorR, lineColor: O.lineColor, realLines: O.realLines });
      add(box(-dw + 0.04, 0.52, -0.005, -0.04, 2.60, 0.005), clearGlassMat, 0, { parent: gDoorR, cast: false, receive: false });
    }

    // 8. Rear Courtyard Garden (x = 0.0 .. 6.0, z = -12.0 .. -17.8, y = 0.25 .. 2.75)
    // Upper Yorkstone dining terrace (z = -12.0 .. -14.2) & lower garden terrace (z = -14.2 .. -17.8)
    addM(0.0, 0.0, -14.2, 6.0, 0.42, -12.0, paving, 0.5, O);
    addM(0.0, 0.0, -17.8, 6.0, 0.28, -14.2, paving, 0.5, O);
    addM(0.22, 0.28, -14.26, 5.78, 0.43, -14.12, stone, 0.5, O); // dressed stone terrace step nosing

    // London Stock Brick Courtyard Boundary Walls + Dressed Stone Coping
    addM(0.0, 0.28, -17.8, 0.24, 2.65, -12.0, brick, 0.6, O);
    addM(-0.02, 2.65, -17.82, 0.26, 2.73, -12.0, stone, 0.5, O);
    addM(5.76, 0.28, -17.8, 6.0, 2.65, -12.0, brick, 0.6, O);
    addM(5.74, 2.65, -17.82, 6.02, 2.73, -12.0, stone, 0.5, O);
    addM(0.0, 0.28, -17.8, 6.0, 2.65, -17.52, brick, 0.6, O);
    addM(-0.02, 2.65, -17.82, 6.02, 2.73, -17.50, stone, 0.5, O);

    // Raised Limestone Courtyard Planter Bed & Multi-stem Courtyard Tree
    addM(3.55, 0.28, -17.52, 5.76, 0.86, -14.35, trav, 0.6, O);
    addM(3.68, 0.28, -17.40, 5.64, 0.80, -14.48, mat('foliage'), 0);
    tree(ox + X(4.65), (v.setback || 0) - 15.6, 6.4, 1.9);

    // Architectural Teak & Blackened-Steel Courtyard Bench (x = 0.48 .. 2.25, z = -15.4 .. -14.8)
    addM(0.48, 0.70, -15.42, 2.25, 0.76, -14.82, oakJoinery, 0.5, O);
    addM(0.56, 0.28, -15.36, 0.64, 0.70, -14.88, steel, 0.4, O);
    addM(2.08, 0.28, -15.36, 2.16, 0.70, -14.88, steel, 0.4, O);
    // Warm architectural garden bollard lantern
    addM(3.25, 0.28, -14.65, 3.38, 0.92, -14.52, steel, 0.4, O);
    addM(3.27, 0.76, -14.63, 3.36, 0.88, -14.54, warmGlow, 0, { cast: false });

    // 9. Warm Interior PointLights for rich specular & diffuse depth
    const ptHall = new THREE.PointLight(0xffe2ba, 1.9, 7.5, 1.4);
    ptHall.position.set(X(1.45), 2.85, -1.9);
    const ptParlour = new THREE.PointLight(0xffdfba, 2.6, 9.5, 1.3);
    ptParlour.position.set(X(3.85), 3.05, -3.5);
    const ptAtrium = new THREE.PointLight(0xfff0d6, 3.2, 13.5, 1.2);
    ptAtrium.position.set(X(3.25), 4.65, -9.2);
    g.add(ptHall, ptParlour, ptAtrium);

    return { gDoorL, gDoorR };
  }

  function house(ox, v = {}) {
    const g = new THREE.Group(); g.position.set(ox, 0, v.setback || 0); root.add(g);
    const faint = !!v.faint, lc = faint ? 0xb9b3a8 : v.accent ? 0xe85d04 : undefined, LW = faint ? 0.8 : 1.5, lw = faint ? 0.6 : 0.8;
    const rl = v.accent ? 0.75 : undefined;
    const PAR = v.par || 10.0, ROOF = PAR - 0.9;
    const doorL = v.door !== 'right';
    const dx0 = doorL ? 0.6 : 4.0, dx1 = dx0 + 1.4;
    const wx0 = doorL ? 2.7 : 0.6, wx1 = wx0 + 2.7;
    const holes = [[dx0, 0.45, dx1, 3.1], [wx0, 0.95, wx1, 3.05]];
    const first = v.first || 'balcony';
    const ff = first === 'frame' ? [[0.9, 3.85, 5.1, 6.2]] : [[0.8, 3.75, 2.6, 6.25], [3.4, 3.75, 5.2, 6.25]];
    const sf = [[0.8, 6.95, 1.9, 8.85], [2.45, 6.95, 3.55, 8.85], [4.1, 6.95, 5.2, 8.85]];
    holes.push(...ff, ...sf);
    const brick = mat('brick', { faint, color: v.brick });
    const O = { parent: g, lineColor: lc, realLines: rl };
    add(panel([0, 0, 6, PAR], holes, -T, 0), brick, LW, O);
    const st = mat('stone', { faint });
    const stm = mat('steel', { faint });

    // dressed stone base plinth + top water-table cap ledge
    add(box(0, 0, 0, dx0, 0.45, 0.026), st, lw, O);
    add(box(dx1, 0, 0, 6, 0.45, 0.026), st, lw, O);
    if (!faint) {
      add(box(0, 0.43, 0.026, dx0, 0.46, 0.042), st, 0, { parent: g });
      add(box(dx1, 0.43, 0.026, 6, 0.46, 0.042), st, 0, { parent: g });
    }

    // parapet coping stone + corbelled bed course + party-wall parapet upstands
    add(box(0, PAR, -T - 0.04, 6, PAR + 0.085, 0.055), st, LW, O);
    if (!faint) {
      add(box(0, PAR - 0.035, 0, 6, PAR, 0.028), st, 0, { parent: g });
      add(box(0.0, PAR + 0.085, -T, 0.22, PAR + 0.24, 0.03), brick, 0.6, O);
      add(box(5.78, PAR + 0.085, -T, 6.0, PAR + 0.24, 0.03), brick, 0.6, O);
      add(box(-0.01, PAR + 0.24, -T - 0.02, 0.23, PAR + 0.28, 0.045), st, 0.6, O);
      add(box(5.77, PAR + 0.24, -T - 0.02, 6.01, PAR + 0.28, 0.045), st, 0.6, O);
    }

    // recessed entrance porch (pz = -1.0)
    const pz = -1.0;
    add(box(dx0 - 0.2, 0.45, pz, dx0, 3.1, -T), brick, lw, O);
    add(box(dx1, 0.45, pz, dx1 + 0.2, 3.1, -T), brick, lw, O);
    add(box(dx0 - 0.2, 3.1, pz, dx1 + 0.2, 3.35, -T), st, lw, O);
    add(box(dx0, 0.3, pz, dx1, 0.45, 0), st, lw, O);

    // front door: stationary outer steel jamb + pivoting fluted oak door leaf inside doorPivot
    const wd = mat('wood', { faint, color: v.door_color });
    const doorPivot = new THREE.Group();
    const hingeX = doorL ? dx0 + 0.055 : dx1 - 0.055;
    doorPivot.position.set(hingeX, 0, pz);
    g.add(doorPivot);

    const leafX0 = (dx0 + 0.055) - hingeX;
    const leafX1 = (dx1 - 0.055) - hingeX;
    add(box(leafX0, 0.45, -0.075, leafX1, 2.56, 0), wd, lw, { parent: doorPivot, lineColor: lc, realLines: rl });
    windowIn(g, dx0, 2.62, dx1, 3.1, -pz - 0.02, { faint, lc, rl, panes: 1 });
    if (!faint) {
      // Stationary dark steel outer door frame & threshold weather bar on g
      add(panel([dx0, 0.45, dx1, 2.62], [[dx0 + 0.055, 0.45, dx1 - 0.055, 2.56]], pz - 0.08, pz + 0.024), stm, 0, { parent: g });
      // Kickplate & vertical pull hardware on both sides of doorPivot so it pivots open cleanly
      add(box(leafX0 + 0.01, 0.45, -0.082, leafX1 - 0.01, 0.56, 0.012), stm, 0, { parent: doorPivot });
      const hx = (doorL ? dx1 - 0.22 : dx0 + 0.22) - hingeX;
      // Front pull bar
      add(box(hx - 0.018, 1.08, 0.045, hx + 0.018, 1.92, 0.075), stm, 0.6, { parent: doorPivot });
      add(box(hx - 0.014, 1.18, 0, hx + 0.014, 1.21, 0.05), stm, 0, { parent: doorPivot });
      add(box(hx - 0.014, 1.80, 0, hx + 0.014, 1.83, 0.05), stm, 0, { parent: doorPivot });
      // Interior pull bar
      add(box(hx - 0.018, 1.08, -0.145, hx + 0.018, 1.92, -0.115), stm, 0.6, { parent: doorPivot });
      add(box(hx - 0.014, 1.18, -0.12, hx + 0.014, 1.21, -0.075), stm, 0, { parent: doorPivot });
      add(box(hx - 0.014, 1.80, -0.12, hx + 0.014, 1.83, -0.075), stm, 0, { parent: doorPivot });
      // House number plaque on the porch reveal wall
      const px = doorL ? dx1 - 0.015 : dx0 + 0.002;
      add(box(px, 1.62, -0.32, px + 0.013, 1.76, -0.16), st, 0.5, { parent: g });
      // Warm recessed porch soffit downlight glow (real mode only)
      add(box((dx0 + dx1) / 2 - 0.14, 3.08, -0.68, (dx0 + dx1) / 2 + 0.14, 3.10, -0.48), mat('interior', { realOnly: true }), 0, { parent: g, cast: false });
    }

    // three stone entrance steps + bullnose tread nosings
    const sp = new THREE.Shape([[0, 0], [0.9, 0], [0.9, 0.15], [0.6, 0.15], [0.6, 0.3], [0.3, 0.3], [0.3, 0.45], [0, 0.45]].map((p) => new THREE.Vector2(p[0], p[1])));
    add(new THREE.ExtrudeGeometry(sp, { depth: dx1 - dx0, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(dx1, 0, 0), st, lw, O);
    if (!faint) {
      add(box(dx0, 0.125, 0.6, dx1, 0.152, 0.922), st, 0, { parent: g });
      add(box(dx0, 0.275, 0.3, dx1, 0.302, 0.622), st, 0, { parent: g });
      add(box(dx0, 0.425, 0.0, dx1, 0.452, 0.322), st, 0, { parent: g });
    }

    windowIn(g, wx0, 0.95, wx1, 3.05, 0.22, { faint, lc, rl, sill: true, panes: 3 });
    if (first === 'frame') {
      add(panel([0.72, 3.67, 5.28, 6.38], [[0.9, 3.85, 5.1, 6.2]], 0, 0.38), mat('stone', { faint, color: 0xcfc6b4 }), LW, O);
      if (!faint) {
        add(panel([0.85, 3.80, 5.15, 6.25], [[0.9, 3.85, 5.1, 6.2]], 0, 0.22), mat('stone', { faint, color: 0xc5bca9 }), 0, { parent: g });
      }
      windowIn(g, 0.9, 3.85, 5.1, 6.2, 0.16, { faint, lc, rl, panes: 3, transom: 5.5 });
    } else {
      ff.forEach((w) => windowIn(g, ...w, 0.2, { faint, lc, rl, panes: 2, transom: 5.6 }));
      add(box(0.5, 3.44, 0, 5.5, 3.6, 0.9), st, LW, O);
      if (!faint) {
        add(box(0.54, 3.41, 0.0, 5.46, 3.44, 0.84), st, 0, { parent: g });
      }
      const bars = [];
      for (let x = 0.53; x < 5.48; x += 0.12) bars.push(box(x, 3.6, 0.85, x + 0.022, 4.62, 0.872));
      for (let z = 0.05; z < 0.84; z += 0.12) { bars.push(box(0.5, 3.6, z, 0.522, 4.62, z + 0.022)); bars.push(box(5.478, 3.6, z, 5.5, 4.62, z + 0.022)); }
      if (!faint) {
        bars.push(box(0.5, 3.66, 0.845, 5.5, 3.688, 0.878));
      }
      add(mergeGeometries(bars), stm, faint ? 0 : 0.55, O);
      add(box(0.5, 4.62, 0.84, 5.5, 4.66, 0.9), stm, faint ? 0 : 0.8, O);
      add(box(0.5, 4.62, 0.0, 0.522, 4.66, 0.84), stm, 0, { parent: g });
      add(box(5.478, 4.62, 0.0, 5.5, 4.66, 0.84), stm, 0, { parent: g });
    }
    sf.forEach((w) => windowIn(g, ...w, 0.2, { faint, lc, rl, sill: true, panes: 1 }));
    if (v.roof !== 'none') {
      const rz0 = -9, rz1 = -2.2;
      const zm = mat('zinc', { faint });
      add(box(0.5, ROOF, rz0, 5.5, ROOF + 2.9, rz1), zm, LW, O);
      if (!faint) {
        add(box(0.46, ROOF + 2.86, rz0 - 0.04, 5.54, ROOF + 2.94, rz1 + 0.045), zm, 0.6, O);
        const ribs = [];
        for (let rx = 0.86; rx < 5.4; rx += 0.43) {
          if (rx > 1.15 && rx < 4.85) {
            ribs.push(box(rx - 0.012, ROOF + 2.45, rz1, rx + 0.012, ROOF + 2.86, rz1 + 0.024));
          } else {
            ribs.push(box(rx - 0.012, ROOF, rz1, rx + 0.012, ROOF + 2.86, rz1 + 0.024));
          }
        }
        if (ribs.length) add(mergeGeometries(ribs), zm, 0, { parent: g });
      }
      windowIn(g, 1.2, ROOF + 0.15, 4.8, ROOF + 2.45, -rz1 - 0.05, { faint, lc, rl, panes: 3 });
    }

    let gardenDoors = null;
    if (!faint && v.interior !== false) {
      gardenDoors = buildInterior(g, ox, v, doorL, PAR, O);
    } else {
      add(box(0, 0, -12, 6, PAR - 0.9, -1.12), mat('plain', { faint }), 0, { parent: g });
    }

    if (v.relief) {
      const bricks = [];
      const inHole = (x, y) => holes.some(([a, b, c, d]) => x > a - 0.12 && x < c + 0.12 && y > b - 0.12 && y < d + 0.1) || y < 0.5 || y > PAR - 0.1;
      for (let c = 0; c * 0.075 < PAR; c++) {
        const off = (c % 2) * 0.5;
        for (let i = -1; i < 28; i++) {
          const u = 2 * i + 1 - 2 * off, P = 12;
          if ((((u + c) % P) + P) % P !== 1 && (((u - c) % P) + P) % P !== 1) continue;
          const x = (i - off) * 0.225 + 0.01, y = c * 0.075 + 0.01;
          if (x < 0 || x + 0.215 > 6) continue;
          if (inHole(x + 0.1, y + 0.03)) continue;
          bricks.push(box(x, y, 0, x + 0.215, y + 0.065, v.relief));
        }
      }
      add(mergeGeometries(bricks), mat('brick', { faint, color: v.header || 0x8a6a55 }), faint ? 0 : 0.55, O);
    }

    return {
      g, PAR, ROOF, ox,
      door: [ox + (dx0 + dx1) / 2, 1.8, (v.setback || 0) - 1.0],
      doorX: [ox + dx0, ox + dx1],
      setDoor(open01) {
        const a = clamp01(open01) * (82 * Math.PI / 180);
        doorPivot.rotation.y = (doorL ? 1 : -1) * a;
      },
      setGardenDoor(open01) {
        if (!gardenDoors) return;
        const a = clamp01(open01) * (76 * Math.PI / 180);
        gardenDoors.gDoorL.rotation.y = a;
        gardenDoors.gDoorR.rotation.y = -a;
      },
    };
  }

  function street(x0, x1, sky = true) {
    add(box(x0, -0.15, 0, x1, 0, 3.2), mat('paving'), 0, { cast: false });
    add(box(x0, -0.15, 3.2, x1, 0.01, 3.38), mat('stone'), 0, { cast: false });
    add(new THREE.PlaneGeometry(x1 - x0, 30).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, -0.15, 18.4), mat('plain', { color: 0x484643 }), 0, { cast: false });
    if (sky) add(new THREE.PlaneGeometry(400, 120).translate(0, 40, -60), mat('sky'), 0, { cast: false });
    lines([x0, 0, 3.4, x1, 0, 3.4], 2.6, { first: true });
  }

  function figure(x, z, s = 1, flip = false) {
    const P = [[0, 1.75], [0.07, 1.73], [0.1, 1.66], [0.09, 1.58], [0.06, 1.53], [0.2, 1.47], [0.24, 1.36], [0.26, 1.06], [0.24, 0.84], [0.2, 0.86], [0.2, 1.2], [0.18, 1.0], [0.17, 0.84], [0.14, 0.45], [0.13, 0.06], [0.17, 0.0], [0.03, 0.0], [0.02, 0.8]];
    const pts = [...P, ...P.slice(1, -1).reverse().map(([a, b]) => [-a, b])].map(([a, b]) => [x + (flip ? -a : a) * s, b * s]);
    const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], p[1])));
    add(new THREE.ShapeGeometry(shape).translate(0, 0, z), mat('plain', { drawOnly: true, color: 0xf2efe7 }), 0, { cast: false });
    lines(loop(pts, z + 0.01), 0.9);
  }

  function tree(x, z, h = 7.5, r = 2.3) {
    const R = mulberry(Math.round(x * 100) + 7);
    add(new THREE.CylinderGeometry(0.1, 0.17, h * 0.62, 8).translate(x, h * 0.31, z), mat('wood', { realOnly: true, color: 0x5d4b3c }), 0);
    const blobs = [];
    for (let i = 0; i < 70; i++) {
      const a = R() * Math.PI * 2, e = (R() - 0.5) * 2.4, rr = r * (0.25 + 0.65 * Math.sqrt(R()));
      blobs.push(new THREE.IcosahedronGeometry(0.32 + R() * 0.4, 1).translate(x + Math.cos(a) * rr, h - r + Math.sin(e) * r * 0.75, z + Math.sin(a) * rr * 0.7));
    }
    add(mergeGeometries(blobs), mat('foliage', { realOnly: true }), 0);
    const zz = z + 0.3, segs = [];
    segs.push(x - 0.11, 0, zz, x - 0.06, h - r * 1.1, zz, x + 0.13, 0, zz, x + 0.07, h - r * 1.1, zz);
    segs.push(x - 0.05, h - r * 1.2, zz, x - r * 0.45, h - r * 0.55, zz, x + 0.05, h - r * 1.05, zz, x + r * 0.5, h - r * 0.35, zz, x, h - r * 0.9, zz, x - r * 0.05, h - r * 0.1, zz);
    const pts = [];
    for (let i = 0; i < 120; i++) {
      const a = i / 120 * Math.PI * 2, bump = Math.pow(Math.abs(Math.sin(a * 6.5 + 0.4)), 0.6);
      pts.push([x + Math.cos(a) * r * (0.9 + 0.1 * bump), h - r + Math.sin(a) * r * 1.02 * (0.9 + 0.1 * bump)]);
    }
    segs.push(...loop(pts, zz));
    lines(segs, 0.75);
  }

  /* ---------- camera ---------- */
  // A key: target t, frame height fh at the target (metres), fov (degrees), yaw and pitch (degrees,
  // where the camera sits around the target). fh and fov blend in log space, so going from a 2 degree
  // lens to a 50 degree one keeps the picture's size: the dolly zoom.
  const camera = new THREE.PerspectiveCamera(2, W / H, 1, 3000);
  const D2R = Math.PI / 180;
  function keyFor(k) { return phone() && k.phone ? { ...k, ...k.phone } : k; }
  function fitFh(k) { return Math.max(k.fh, (k.minW || 0) / (W / H)); }
  function camAt(p, keys) {
    let a = keyFor(keys[0]), b = a, u = 0;
    for (let i = 0; i < keys.length - 1; i++) {
      if (p >= keys[i].p) { a = keyFor(keys[i]); b = keyFor(keys[i + 1]); u = span(p, keys[i].p, keys[i + 1].p); }
    }
    if (p >= keys[keys.length - 1].p) { a = b = keyFor(keys[keys.length - 1]); u = 0; }
    const e = (a.ease || ease)(u);
    const L = (x, y) => lerp(x, y, e), LL = (x, y) => Math.exp(lerp(Math.log(x), Math.log(y), e));
    return {
      t: [L(a.t[0], b.t[0]), L(a.t[1], b.t[1]), L(a.t[2], b.t[2])],
      fh: LL(fitFh(a), fitFh(b)), fov: LL(a.fov, b.fov), yaw: L(a.yaw || 0, b.yaw || 0), pitch: L(a.pitch || 0, b.pitch || 0),
    };
  }
  const lastTarget = new THREE.Vector3();
  function setCam(c) {
    camera.fov = c.fov; camera.aspect = W / H;
    const d = (c.fh / 2) / Math.tan(c.fov * D2R / 2);
    lastTarget.set(...c.t);
    const dir = new THREE.Vector3(Math.sin(c.yaw * D2R) * Math.cos(c.pitch * D2R), Math.sin(c.pitch * D2R), Math.cos(c.yaw * D2R) * Math.cos(c.pitch * D2R));
    camera.position.copy(lastTarget).addScaledVector(dir, d);
    camera.near = Math.max(0.05, d - 80, d * 0.03); camera.far = d + 260;
    camera.lookAt(lastTarget); camera.updateProjectionMatrix();
    S.camDist = d;
    S.camTarget = lastTarget;
  }

  /* ---------- overlay pins ---------- */
  const pins = [];
  function pin(el, p, o = {}) { pins.push({ el, p: new THREE.Vector3(...p), ...o }); return el; }
  const v3 = new THREE.Vector3();
  function placePins() {
    pins.forEach((q) => {
      v3.copy(q.p).project(camera);
      const x = (v3.x + 1) / 2 * W, y = (1 - v3.y) / 2 * H;
      q.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) ${q.tf || ''}`;
      q.el.style.visibility = v3.z > 1 ? 'hidden' : '';
    });
  }

  function resize() {
    W = innerWidth; H = innerHeight;
    renderer.setSize(W, H, false);
    LMATS.forEach((m) => m.resolution.set(W * DPR, H * DPR));
  }
  addEventListener('resize', resize);

  Object.assign(S, {
    THREE, U, scene, root, renderer, camera, sun, hemi, DPR, phone, get W() { return W; }, get H() { return H; },
    mat, lineMat, add, lines, loop, box, panel, house, street, figure, tree, aimSun, setSun, camAt, setCam, pin, placePins,
    render() { placePins(); renderer.render(scene, camera); },
  });
  return S;
}

/* =========================================================================== */
// The page: a tall track for native scroll (Lenis on top), the loader, the drafting intro,
// then frame(p) every frame with p in vh scrolled.
export function run(S, o) {
  const $ = (s) => document.querySelector(s);
  const html = document.documentElement;
  const track = $('#track');
  track.style.height = `${o.length + 100}vh`;
  const skip = Q.has('at') || Q.has('skip');
  const debug = Q.has('debug') ? Object.assign(document.body.appendChild(document.createElement('div')), { className: 'debug' }) : null;

  // Inject CAD sheet corner registration frame & live solar/optical telemetry HUD
  let hudSun = null, hudOptic = null;
  if (!$('.sheet-frame')) {
    const sf = document.createElement('div');
    sf.className = 'sheet-frame';
    sf.setAttribute('aria-hidden', 'true');
    sf.innerHTML = `
      <span class="reg tl"></span><span class="reg tr"></span><span class="reg bl"></span><span class="reg br"></span>
      <div class="sheet-hud">
        <span class="scale-bar"><i></i><b>CAD // ELV.02</b></span>
        <span>SUN <b id="hudSun">ALT 35.3° · AZ 135°</b></span>
        <span>OPTIC <b id="hudOptic">2.0° ORTHO</b></span>
      </div>`;
    document.body.appendChild(sf);
    hudSun = sf.querySelector('#hudSun');
    hudOptic = sf.querySelector('#hudOptic');
  }

  let lenis = null;
  if (!Q.has('nolenis')) {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
  }
  const scrollP = () => ((lenis ? lenis.animatedScroll : scrollY) / innerHeight) * 100;
  function jumpToP(targetP) {
    const y = (targetP / 100) * innerHeight;
    if (lenis) lenis.scrollTo(y);
    else window.scrollTo({ top: y, behavior: 'smooth' });
  }
  window.__jumpToP = jumpToP;

  // Inject bottom-right Live CAD Townhouse Plan/Section Mini-Radar (#cad-map)
  const radarCfg = o.radar || {
    ox: 0,
    zones: [
      { id: 'street', label: 'STREET', tag: 'ELEVATION ±0.00M', at: 95, u0: -4.0, u1: 0.0 },
      { id: 'porch', label: 'PORCH', tag: 'PORCH +0.45M', at: 385, u0: 0.0, u1: 2.0 },
      { id: 'parlour', label: 'PARLOUR', tag: 'PARLOUR +0.45M', at: 530, u0: 2.0, u1: 6.4 },
      { id: 'atrium', label: 'ATRIUM', tag: 'ATRIUM +0.45M', at: 635, u0: 6.4, u1: 12.0 },
      { id: 'garden', label: 'GARDEN', tag: 'COURTYARD +0.30M', at: 730, u0: 12.0, u1: 17.8 },
    ],
  };
  let cmLbl = null, cmDot = null, cmCone = null, cmScan = null, cmZones = [], cmBtns = [], hoverTag = '';
  if (!$('#cad-map')) {
    const cm = document.createElement('div');
    cm.id = 'cad-map';
    cm.setAttribute('aria-label', 'Interactive CAD townhouse plan radar');
    const zoneRects = radarCfg.zones.map((z) =>
      `<rect class="cm-zone" data-id="${z.id}" data-tag="${z.tag}" data-at="${z.at}" x="${z.u0}" y="0" width="${(z.u1 - z.u0).toFixed(2)}" height="6.0"/>`
    ).join('');
    const zoneBtns = radarCfg.zones.map((z) =>
      `<button type="button" class="cm-btn" data-id="${z.id}" data-tag="${z.tag}" data-at="${z.at}">${z.label}</button>`
    ).join('');
    cm.innerHTML = `
      <div id="cm-lbl"><span>CAD PLAN // 1:100</span><b id="cm-pos">STREET ±0.00M</b></div>
      <svg viewBox="-4.2 -0.6 22.4 7.2">
        ${zoneRects}
        <!-- Townhouse architectural floor plan walls & furniture -->
        <path d="M-4.0 0 H17.6 M-4.0 6.0 H17.6 M0 0 V0.6 M0 2.0 V6.0 M1.0 0.6 V2.0 M12.0 0 V2.15 M12.0 3.85 V6.0 M17.6 0 V6.0" fill="none" stroke="#f2efe7" stroke-width="0.28" opacity="0.82" pointer-events="none"/>
        <!-- Entrance steps, door swing arc, hall partition, staircase, bookcase, sofa, island, dining table, courtyard tree -->
        <path d="M-0.9 0.6 H0 M-0.6 0.6 V2.0 M-0.3 0.6 V2.0 M1.0 0.6 L2.0 1.4 M1.65 2.1 H5.15 M3.55 0.3 H6.75 V1.2 H3.55 Z M0.65 5.35 H3.95 V5.75 H0.65 Z M1.55 3.45 H3.95 V4.32 H1.55 Z M7.6 1.35 H10.8 V2.25 H7.6 Z M7.85 3.85 H10.65 V4.95 H7.85 Z M14.2 0 V6.0" fill="none" stroke="#f2efe7" stroke-width="0.16" opacity="0.48" pointer-events="none"/>
        <circle cx="15.6" cy="4.6" r="1.05" fill="none" stroke="#f2efe7" stroke-width="0.16" stroke-dasharray="0.4 0.3" opacity="0.55" pointer-events="none"/>
        <line id="cm-scan" x1="0" y1="-0.5" x2="0" y2="6.5" stroke="#e85d04" stroke-width="0.28" stroke-dasharray="0.6 0.4" opacity="0" pointer-events="none"/>
        <polygon id="cm-cone" points="-2.5,3.0 0.5,1.8 0.5,4.2" fill="rgba(232,93,4,0.28)" stroke="#e85d04" stroke-width="0.18" pointer-events="none"/>
        <circle id="cm-dot" cx="-2.5" cy="3.0" r="0.52" fill="#e85d04" stroke="#f2efe7" stroke-width="0.14" pointer-events="none"/>
      </svg>
      <div class="cm-pills">${zoneBtns}</div>`;
    document.body.appendChild(cm);
    cmLbl = cm.querySelector('#cm-pos');
    cmDot = cm.querySelector('#cm-dot');
    cmCone = cm.querySelector('#cm-cone');
    cmScan = cm.querySelector('#cm-scan');
    cmZones = [...cm.querySelectorAll('.cm-zone')];
    cmBtns = [...cm.querySelectorAll('.cm-btn')];
    [...cmZones, ...cmBtns].forEach((el) => {
      el.addEventListener('mouseenter', () => { hoverTag = el.dataset.tag || ''; });
      el.addEventListener('mouseleave', () => { hoverTag = ''; });
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        jumpToP(parseFloat(el.dataset.at || '0'));
      });
    });
  }

  // beats: captions that live between two scroll positions
  const beats = (o.beats || []).map((b) => {
    const el = document.createElement('div');
    el.className = 'beat ' + (b.cls || '');
    el.innerHTML = b.html;
    $('#beats').appendChild(el);
    return { ...b, el };
  });

  S.U.uDraw.value = skip ? 1.2 : 0;
  S.U.uHatchIn.value = skip ? 1 : 0;
  S.U.uDetailIn.value = skip ? 1 : 0;
  html.classList.add('locked');
  if (skip) { html.classList.add('in', 'done'); $('#loader')?.classList.add('gone'); }

  let p = 0, t0 = performance.now(), introT = -1;
  function tick(now) {
    if (lenis) lenis.raf(now);
    p = scrollP();
    // intro clock
    if (introT >= 0 && !skip) {
      const t = (now - introT) / 1000;
      S.U.uDraw.value = Math.min(1.2, ease(span(t, 0, 3.3)) * 1.2);
      S.U.uHatchIn.value = ease(span(t, 2.4, 3.8));
      S.U.uDetailIn.value = ease(span(t, 2.6, 3.8));
      if (t > 0.35) $('#loader')?.classList.add('gone');
      if (t > 1.9) html.classList.add('in');
      if (t > 3.9 && !html.classList.contains('done')) {
        html.classList.add('done'); html.classList.remove('locked');
        window.__introDone = true;
      }
    }
    o.frame(p, S, now);
    if (hudSun && hudOptic) {
      const sd = S.U.uSun.value;
      const alt = (Math.asin(Math.max(-1, Math.min(1, sd.y))) * 180 / Math.PI).toFixed(1);
      const az = (((Math.atan2(-sd.x, sd.z) * 180 / Math.PI) + 90 + 360) % 360).toFixed(0);
      hudSun.textContent = `ALT ${alt}° · AZ ${az}°`;
      const fov = S.camera.fov;
      hudOptic.textContent = `${fov.toFixed(1)}° ${fov < 4 ? 'ORTHO' : fov < 22 ? 'RELIEF' : 'PERSP'}`;
    }
    if (cmDot && cmCone && cmLbl) {
      // Map camera position to plan radar coordinates: u = depth into plot (-z), v = x inside house
      const camPos = S.camera.position;
      const camTgt = S.camTarget || S.camera.position;
      const u = Math.max(-3.6, Math.min(17.0, -camPos.z));
      const rawV = camPos.x - (radarCfg.ox || 0);
      const v = Math.max(0.4, Math.min(5.6, radarCfg.mirrorX ? 6 - rawV : rawV));
      cmDot.setAttribute('cx', u.toFixed(2));
      cmDot.setAttribute('cy', v.toFixed(2));

      const du = (-camTgt.z) - (-camPos.z);
      const dv = (radarCfg.mirrorX ? -1 : 1) * (camTgt.x - camPos.x);
      const ang = Math.atan2(dv, du);
      const r = 2.8, sp = 0.42;
      const u1 = u + Math.cos(ang - sp) * r, v1 = v + Math.sin(ang - sp) * r;
      const u2 = u + Math.cos(ang + sp) * r, v2 = v + Math.sin(ang + sp) * r;
      cmCone.setAttribute('points', `${u.toFixed(2)},${v.toFixed(2)} ${u1.toFixed(2)},${v1.toFixed(2)} ${u2.toFixed(2)},${v2.toFixed(2)}`);

      // Active zone highlight
      let activeZone = radarCfg.zones[0];
      for (const z of radarCfg.zones) {
        if (u >= z.u0 && u <= z.u1) { activeZone = z; break; }
      }
      if (p > 340 && u < 0.2) activeZone = radarCfg.zones[1] || activeZone;
      cmZones.forEach((el) => el.classList.toggle('active', el.dataset.id === activeZone.id));
      cmBtns.forEach((el) => el.classList.toggle('active', el.dataset.id === activeZone.id));

      const swZ = S.U.uSweep.value.z;
      if (hoverTag) {
        cmLbl.textContent = `JUMP // ${hoverTag}`;
      } else if (swZ > -30 && swZ < 30) {
        cmLbl.textContent = `SWEEP // S:${swZ.toFixed(1)}M`;
      } else if (S.camera.fov < 22) {
        cmLbl.textContent = `${activeZone.label} · ${S.camera.fov.toFixed(0)}° LENS`;
      } else {
        cmLbl.textContent = `${activeZone.label} · Z:${(-camPos.z >= 0 ? '+' : '')}${(-camPos.z).toFixed(1)}M`;
      }

      // Sweep scan line indicator
      if (swZ > -30 && swZ < 30) {
        const su = lerp(-3.5, 16.5, clamp01((swZ + 14) / 28));
        cmScan.setAttribute('x1', su.toFixed(2));
        cmScan.setAttribute('x2', su.toFixed(2));
        cmScan.setAttribute('opacity', '0.9');
      } else {
        cmScan.setAttribute('opacity', '0');
      }
    }
    beats.forEach((b) => {
      const f = b.fade || 14;
      const v = Math.min(span(p, b.from - f, b.from), 1 - span(p, b.to - f, b.to));
      b.el.style.opacity = v.toFixed(3);
      b.el.style.transform = `translate3d(0, ${((1 - v) * 14).toFixed(1)}px, 0)`;
      b.el.style.visibility = v <= 0.001 ? 'hidden' : 'visible';
    });
    html.style.setProperty('--hero-out', span(p, o.heroOut?.[0] ?? 12, o.heroOut?.[1] ?? 60).toFixed(3));
    if (debug) debug.textContent = `p ${p.toFixed(1)} vh`;
    S.render();
    requestAnimationFrame(tick);
  }

  // loader: a percent above the ground line. Fonts, a first frame, every shader built.
  const fill = $('#loadPct');
  const minT = 1100;
  const fonts = Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
  o.frame(0, S, 0);
  S.renderer.compile(S.scene, S.camera);
  let shown = 0;
  const count = setInterval(() => { shown = Math.min(99, shown + 3 + Math.random() * 7); if (fill) fill.textContent = `${Math.floor(shown)}%`; }, 70);
  fonts.then(() => new Promise((r) => setTimeout(r, Math.max(0, minT - (performance.now() - t0))))).then(() => {
    clearInterval(count); if (fill) fill.textContent = '100%';
    S.render();
    window.__ready = true;
    if (skip) {
      html.classList.remove('locked'); window.__introDone = true;
      const at = num('at', 0);
      requestAnimationFrame(() => { const y = at / 100 * innerHeight; if (lenis) lenis.scrollTo(y, { immediate: true }); else scrollTo(0, y); });
    } else {
      setTimeout(() => { introT = performance.now(); }, 250);
    }
    requestAnimationFrame(tick);
  });
  // hold the scroll during the intro (Lenis has to stop too)
  const guard = () => { if (html.classList.contains('locked')) { if (lenis) lenis.stop(); } else if (lenis) lenis.start(); };
  new MutationObserver(guard).observe(html, { attributes: true, attributeFilter: ['class'] }); guard();
  window.__stage = S; window.__p = () => p;
}
