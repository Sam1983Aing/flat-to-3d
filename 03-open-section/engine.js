// The section engine: one house, one vertical cut, one camera that always looks straight at the cut.
//
// The cut is a clipping plane at depth `cut` (0 is the front facade, -10 the back wall). Everything in
// front of it is not drawn, and every solid it passes through gets a lid on the cut, filled black.
// The camera is described by what it must show on the cut (a rectangle), a lens, and where the lines
// vanish. Its distance is worked out from the lens, so the cut keeps its size while the lens opens.
//
// A second plane, `reveal`, sweeps left to right while the hero draws itself. Both planes exist from the
// first frame to the last: changing how many there are would rebuild every shader mid-scroll.

import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pieces, floors, sprites, groundLine, levels, grid, labels, coursing } from './house.js';
import { drawSprite } from './entourage.js';

export const PAPER = 0xf2efe7, INK = 0x1d1c19, ACCENT = 0xe85d04;

// The colour the drawing turns into once the CAD material scan passes. Furniture says what it is made of (house.js),
// the building is coloured by where a face is: floors by level, ceilings white, walls plaster, the roof gravel.
const MATS = {
  oak: 0xbf915d, teak: 0x9e7048, linen: 0xede6d9, linen2: 0xf5f0e7, ochre: 0xc9963e, fabric: 0xb8ab95,
  terracotta: 0xbc6c45, sage: 0x9bae94, terrazzo: 0xdad3c6, stone: 0xcfc5b3, metal: 0x383531, brass: 0xbe9750,
  bronze: 0x585047, rug: 0xa88f73,
};
const BOOKS = [0x7d8b6c, 0xb1573c, 0xc9a25a, 0x3f5566, 0xd9cbb1, 0x8a6a8c, 0x546b52, 0xb88a5a, 0xe2d6bf, 0x9c4a35];
function colourFor(p, nx, ny, nz, x, y) {
  if (p.kind === 'furn') {
    if (p.mat === 'book') return BOOKS[Math.floor((p.tone || 0) * BOOKS.length) % BOOKS.length];
    return MATS[p.mat] ?? 0xd9cfc0;
  }
  if (p.kind === 'earth') {
    if (ny > 0.5) {
      if (x < -1.6 && y > 6.3) return 0x9b968e;                 // the street
      if (x < 0.2 && y > 6.3) return 0xcfc6b5;                  // the pavement
      if (y > -0.05 && x > 23 && x < 25) return 0xd3c6ae;       // the pool terrace
      return 0xa4ab7c;                                          // grass and the hill
    }
    return 0xc6ad86;                                            // soil
  }
  if (p.mat === 'stone') return ny > 0.5 ? 0xc2bcb0 : 0xb5afa2; // local marès stone
  if (ny > 0.5) {                                               // floors, by level
    if (y > 9.8) return 0xb5ae9f;                               // the roofs, gravel
    if (Math.abs(y - 6.6) < 0.05) return x < 9 ? 0xcaa67b : 0xd5c8b0;   // kitchen oak, terrace stone
    if (Math.abs(y - 3.3) < 0.05) return 0xcaa67b;              // bedroom oak
    if (Math.abs(y) < 0.05) return 0xd9cfbe;                    // limestone below
    return 0xf0eae0;
  }
  if (ny < -0.5) return 0xf5f2eb;                               // ceilings
  return 0xf0eae0;                                              // plaster
}

// Material ID for procedural world-space architectural textures in fragment shader:
// 0: lime plaster, 1: marès stone / limestone pavers, 2: oak / teak planks, 3: terrazzo, 4: woven linen / fabric, 5: board-formed concrete / gravel, 6: earth
function matIdFor(p, nx, ny, nz, x, y) {
  if (p.kind === 'earth') return 6.0;
  if (p.mat === 'stone') return 1.0;
  if (p.mat === 'terrazzo') return 3.0;
  if (p.mat === 'oak' || p.mat === 'teak') return 2.0;
  if (p.mat === 'linen' || p.mat === 'linen2' || p.mat === 'fabric' || p.mat === 'ochre' || p.mat === 'rug') return 4.0;
  if (p.kind === 'furn') return 0.0;
  if (ny > 0.5) {
    if (y > 9.8) return 5.0;
    if ((Math.abs(y - 6.6) < 0.05 && x < 9) || Math.abs(y - 3.3) < 0.05) return 2.0;
    if ((Math.abs(y - 6.6) < 0.05 && x >= 9) || Math.abs(y) < 0.05) return 1.0;
    return 0.0;
  }
  if (ny < -0.5) return 5.0;
  return 0.0;
}

const LAYER_KEY = 1, LAYER_SPRITES = 2, LAYER_SKY = 3;     // the inset key sees ghosts and the accent plane, the page sees people and sky

export function createEngine(canvas, overlay) {
  let W = innerWidth, H = innerHeight;
  const DPR = Math.min(devicePixelRatio, 2);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(DPR);
  renderer.setSize(W, H, false);
  renderer.setClearColor(PAPER, 1);
  renderer.localClippingEnabled = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PAPER, 10, 40);
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 2000);
  const colourX = { value: -1000 };          // everything left of this x is in colour. The pen of the colour plot
  const uTime = { value: 0 };
  camera.layers.enable(LAYER_SPRITES); camera.layers.enable(LAYER_SKY);
  const keyCam = new THREE.PerspectiveCamera(23, 1.6, 1, 400);
  keyCam.layers.enable(LAYER_KEY);
  keyCam.position.set(44, 26, 32);
  keyCam.lookAt(11.6, 3.2, -5.0);

  const cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), -4.6);
  // the hero is plotted in drafting order: the poché first, then everything beyond the cut, then hatch and figures
  const revA = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1000);
  const revB = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1000);
  const revC = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1000);
  const both = [cutPlane, revB], onlyReveal = [revA], late = [revC], spritePlanes = [cutPlane, revC];

  // ---- materials ----
  // One material for the building, lit by sun, sky, and warm interior point lights. On the flat drawing it shows
  // its ink colour, unlit. Where the colour scan has passed it shows procedural architectural textures, lit, with cast shadows.
  const faces = new THREE.MeshLambertMaterial({ vertexColors: true, clippingPlanes: both, clipShadows: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const withColour = (m) => {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uColourX = colourX;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec3 color2;
          attribute float matId;
          uniform float uColourX;
          varying vec3 vInk;
          varying float vCm;
          varying vec3 vWPos;
          varying vec3 vWNorm;
          varying float vMatId;`)
        .replace('#include <color_vertex>', `#include <color_vertex>
          vInk = vColor;
          vColor = color2;
          vMatId = matId;
          vec4 wp4 = modelMatrix * vec4(position, 1.0);
          vWPos = wp4.xyz;
          vWNorm = normalize(mat3(modelMatrix) * normal);
          float wx = wp4.x;
          vCm = 1.0 - smoothstep(uColourX - 0.42, uColourX + 0.42, wx);`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform float uColourX;
          varying vec3 vInk;
          varying float vCm;
          varying vec3 vWPos;
          varying vec3 vWNorm;
          varying float vMatId;
          float h21(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
          }
          float vnoise(vec2 p) {
            vec2 i = floor(p), f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
                       mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
          }
          float procTex(vec3 wp, vec3 wn, float id) {
            if (id > 0.5 && id < 1.5) {
              // 1.0: Mallorcan marès stone coursing on walls, honed limestone pavers on floors
              if (wn.y > 0.5) {
                vec2 uv = wp.xz / 0.6;
                vec2 cell = floor(uv), f = fract(uv);
                float joint = step(0.03, f.x) * step(0.03, f.y);
                float tone = (h21(cell) - 0.5) * 0.055 + (vnoise(wp.xz * 3.5) - 0.5) * 0.04;
                return mix(0.88, 1.0 + tone, joint);
              } else {
                float row = floor(wp.y / 0.28);
                float u = (abs(wn.z) > 0.5 ? wp.x : wp.z) + mod(row, 2.0) * 0.34;
                float col = floor(u / 0.68);
                float fy = fract(wp.y / 0.28), fx = fract(u / 0.68);
                float mortar = smoothstep(0.0, 0.055, fy) * smoothstep(0.0, 0.035, fx);
                float blockTone = (h21(vec2(col, row)) - 0.5) * 0.09;
                float grain = (vnoise(vec2(u, wp.y) * 14.0) - 0.5) * 0.055;
                return mix(0.84, 1.0 + blockTone + grain, mortar);
              }
            } else if (id > 1.5 && id < 2.5) {
              // 2.0: Warm European oak planks & cathedral wood grain
              if (abs(wn.y) > 0.5) {
                float plankRow = floor(wp.z / 0.18);
                float plankCol = floor((wp.x + mod(plankRow, 3.0) * 0.65) / 1.85);
                float fz = fract(wp.z / 0.18), fx = fract((wp.x + mod(plankRow, 3.0) * 0.65) / 1.85);
                float seam = smoothstep(0.0, 0.06, fz) * smoothstep(0.0, 0.015, fx);
                float boardTone = (h21(vec2(plankCol, plankRow)) - 0.5) * 0.085;
                float grain = sin(wp.x * 6.5 + vnoise(wp.xz * vec2(2.5, 18.0)) * 5.5) * 0.032;
                return mix(0.84, 1.0 + boardTone + grain, seam);
              } else {
                float g = sin((wp.x + wp.z) * 10.0 + vnoise(wp.xy * 8.0) * 4.0) * 0.035;
                return 1.0 + g;
              }
            } else if (id > 2.5 && id < 3.5) {
              // 3.0: Terrazzo mineral speckle on kitchen island
              vec2 uv = (abs(wn.y) > 0.5 ? wp.xz : wp.xy + wp.zy) * 24.0;
              float c1 = h21(floor(uv));
              float c2 = h21(floor(uv * 2.3 + 7.1));
              float chip = c1 > 0.82 ? -0.11 : (c1 < 0.14 ? 0.08 : (c2 > 0.86 ? -0.06 : 0.0));
              return 1.0 + chip;
            } else if (id > 3.5 && id < 4.5) {
              // 4.0: Woven linen / upholstery / rug weave
              vec2 uv = abs(wn.y) > 0.5 ? wp.xz : wp.xy + vec2(wp.z, 0.0);
              float weave = sin(uv.x * 95.0) * sin(uv.y * 95.0) * 0.028;
              float fold = (vnoise(uv * 4.5) - 0.5) * 0.055;
              return 1.0 + weave + fold;
            } else if (id > 4.5 && id < 5.5) {
              // 5.0: Board-formed concrete soffit & roof gravel
              if (wn.y > 0.5) {
                return 1.0 + (h21(floor(wp.xz * 32.0)) - 0.5) * 0.08;
              } else {
                float fz = fract(wp.z / 0.16);
                float lift = smoothstep(0.0, 0.05, fz);
                float grain = (vnoise(wp.xz * vec2(3.0, 18.0)) - 0.5) * 0.04;
                return mix(0.92, 1.0 + grain, lift);
              }
            } else if (id > 5.5) {
              // 6.0: Mediterranean hillside grass & stratified soil
              if (wn.y > 0.5) {
                float tuft = (vnoise(wp.xz * 2.2) - 0.5) * 0.08 + (vnoise(wp.xz * 9.0) - 0.5) * 0.04;
                return 1.0 + tuft;
              } else {
                float strata = sin(wp.y * 5.5 + vnoise(wp.xy * 1.8) * 2.5) * 0.045;
                return 1.0 + strata;
              }
            }
            // 0.0: Lime plaster with subtle trowel movement & floor-corner ambient grounding
            float plaster = (vnoise(wp.xy * 1.6 + wp.z * 1.2) - 0.5) * 0.038;
            return 1.0 + plaster;
          }`)
        .replace('#include <colorspace_fragment>', `{
          float texK = procTex(vWPos, vWNorm, vMatId);
          vec3 litCol = gl_FragColor.rgb * texK;
          vec3 col = mix(vInk, litCol, vCm);
          // CAD amber contour & grid scan frontier when colourX sweeps across the house
          if (uColourX > -11.8 && uColourX < 38.2) {
            float dScan = uColourX - vWPos.x;
            if (dScan > -0.12 && dScan < 1.55) {
              float lead = exp(-pow(dScan / 0.055, 2.0));
              float band = smoothstep(1.55, 0.0, dScan) * step(0.0, dScan);
              float cy = 1.0 - smoothstep(0.0, 0.045, abs(fract(vWPos.y * 2.0 + 0.5) - 0.5));
              float cz = 1.0 - smoothstep(0.0, 0.045, abs(fract(vWPos.z * 2.0 + 0.5) - 0.5));
              float scanA = clamp(lead * 0.85 + band * max(cy, cz * 0.7) * 0.48, 0.0, 1.0);
              col = mix(col, vec3(0.91, 0.365, 0.016), scanA);
            }
          }
          gl_FragColor.rgb = col;
        }
        #include <colorspace_fragment>`);
    };
    return m;
  };
  const SUN_DIR = new THREE.Vector3(-0.40, 0.55, 0.73).normalize();      // from the front left, about 33 degrees up
  const LIGHT = { sky: Number(new URLSearchParams(location.search).get('sky') || 2.38), sun: Number(new URLSearchParams(location.search).get('sun') || 2.28) };
  const hemi = new THREE.HemisphereLight(0xf6f3eb, 0xcab99c, LIGHT.sky);     // warm Mediterranean sky & limestone bounce
  const sun = new THREE.DirectionalLight(0xfff3de, LIGHT.sun);
  sun.target.position.set(12, 3, -5);
  sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 45);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -36, right: 36, top: 26, bottom: -26, near: 1, far: 100 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(hemi, sun, sun.target);

  // Warm interior architectural point lights so rooms glow in depth behind the section cut
  const addWarmLight = (x, y, z, intensity, dist, color = 0xffdba4) => {
    const pt = new THREE.PointLight(color, intensity, dist, 1.4);
    pt.position.set(x, y, z);
    scene.add(pt);
  };
  addWarmLight(2.9, 8.35, -5.2, 1.6, 9.5);      // kitchen island pendants (+6.60m)
  addWarmLight(7.15, 8.6, -7.8, 2.2, 11.0);     // dining table & roof lantern (+6.60m)
  addWarmLight(6.4, 5.1, -7.5, 1.6, 9.0);       // bedroom pendant (+3.30m)
  addWarmLight(12.2, 5.2, -6.4, 1.5, 10.0);     // stair landing & courtyard glass (+3.30m)
  addWarmLight(19.1, 3.5, -5.6, 2.4, 13.5);     // double-height living room pendant (±0.00m)
  addWarmLight(12.2, 2.1, -2.6, 1.7, 9.0);      // lower dining & library wall (±0.00m)

  let shadowKey = '';
  withColour(faces);
  const glass = new THREE.MeshBasicMaterial({ color: 0xd3e0e2, transparent: true, opacity: 0.26, depthWrite: false, side: THREE.DoubleSide, clippingPlanes: both });
  const water = new THREE.MeshBasicMaterial({ color: 0xbcd0d1, transparent: true, opacity: 0.84, clippingPlanes: both, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  water.onBeforeCompile = (sh) => {
    sh.uniforms.uColourX = colourX;
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uColourX;\nuniform float uTime;\nvarying vec3 vWPos;')
      .replace('#include <colorspace_fragment>', `{
        float cm = 1.0 - smoothstep(uColourX - 0.45, uColourX + 0.45, vWPos.x);
        if (cm > 0.01) {
          float c1 = sin(vWPos.x * 5.2 + uTime * 1.7) * cos(vWPos.z * 4.8 - uTime * 1.3);
          float c2 = sin((vWPos.x - vWPos.z) * 8.5 + uTime * 2.3);
          float caustic = smoothstep(0.15, 0.85, (c1 + c2 * 0.5) * 0.5 + 0.5);
          float depthK = clamp((vWPos.y + 1.5) / 1.4, 0.0, 1.0);
          vec3 deepCol = mix(vec3(0.24, 0.49, 0.55), vec3(0.38, 0.64, 0.69), depthK);
          vec3 poolCol = deepCol + vec3(0.12, 0.16, 0.15) * caustic * (0.4 + 0.6 * depthK);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, poolCol, cm);
        }
      }
      #include <colorspace_fragment>`);
  };
  const capMat = {
    cut: new THREE.MeshBasicMaterial({ color: INK, side: THREE.DoubleSide, fog: false, clippingPlanes: onlyReveal }),
    furn: withColourCap(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false, clippingPlanes: onlyReveal })),
    layer: new THREE.MeshBasicMaterial({ color: 0xdcd5c7, side: THREE.DoubleSide, fog: false, clippingPlanes: onlyReveal }),
    glass: new THREE.MeshBasicMaterial({ color: 0x5f7177, side: THREE.DoubleSide, fog: false, clippingPlanes: onlyReveal }),
    water: new THREE.MeshBasicMaterial({ color: 0xb4cacb, side: THREE.DoubleSide, fog: false, clippingPlanes: onlyReveal }),
    earth: earthMaterial(),
  };
  function withColourCap(m) {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uColourX = colourX;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 color2;\nuniform float uColourX;')
        .replace('#include <color_vertex>', `#include <color_vertex>
          float wx = (modelMatrix * vec4(position, 1.0)).x;
          vColor = mix(vColor, color2, 1.0 - smoothstep(uColourX - 0.35, uColourX + 0.35, wx));`);
    };
    return m;
  }
  const DROP = { earth: 0.006, layer: 0.004, furn: 0.004, water: 0.004, glass: 0.003, cut: 0.002 };
  const BASE = { cut: 0xf8f5ef, furn: 0xf4f0e8, layer: 0xeee8dc, earth: 0xeae4d7 };

  const lineMats = [];
  function lineMat(color, width, { fog = true, planes = both, opacity = 1 } = {}) {
    const m = new LineMaterial({ color, linewidth: width, transparent: opacity < 1, opacity, clippingPlanes: planes });
    m.fog = fog;
    m.resolution.set(W, H);
    lineMats.push(m);
    return m;
  }
  const LINES = {
    beyond: lineMat(INK, 1.0),
    fine: lineMat(0xb7b0a3, 0.7),
    glass: lineMat(0x7d8b90, 0.8),
    earth: lineMat(0x8d877c, 0.8),
    light: lineMat(0x8a847a, 0.7),
    stone: lineMat(0x7f7a6e, 0.6),
    cap: lineMat(INK, 1.5, { fog: false, planes: onlyReveal }),
    ground: lineMat(INK, 2.2, { fog: false, planes: onlyReveal }),
    ghost: lineMat(INK, 0.85, { fog: false, planes: [], opacity: 0.22 }),
    red: lineMat(ACCENT, 1.8, { fog: false, planes: [] }),
    cam: lineMat(INK, 1.2, { fog: false, planes: [] }),
  };

  // The earth on the cut: a 45 degree hatch, computed per pixel, fading a few metres under the ground line.
  function earthMaterial() {
    const g = groundLine.flat();
    const m = new THREE.ShaderMaterial({
      side: THREE.DoubleSide, clipping: true, clippingPlanes: late,
      uniforms: { uInk: { value: new THREE.Color(INK) }, uPaper: { value: new THREE.Color(0xeae5da) }, uG: { value: g }, uDpr: { value: Math.min(devicePixelRatio, 2) },
        uSoil: { value: new THREE.Color(0xcdb38c) }, uSoilInk: { value: new THREE.Color(0x7d6243) }, uColourX: colourX },
      vertexShader: `#include <clipping_planes_pars_vertex>
        varying vec2 vXY;
        void main(){ vXY = (modelMatrix * vec4(position, 1.0)).xy; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <clipping_planes_vertex>
        }`,
      fragmentShader: `#include <clipping_planes_pars_fragment>
        uniform vec3 uInk, uPaper, uSoil, uSoilInk; uniform float uG[${g.length}], uDpr, uColourX; varying vec2 vXY;
        float toGround(vec2 p){
          float d = 1e9;
          for (int i = 0; i < ${g.length / 2 - 1}; i++){
            vec2 a = vec2(uG[i*2], uG[i*2+1]), b = vec2(uG[i*2+2], uG[i*2+3]), pa = p - a, ba = b - a;
            d = min(d, length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)));
          }
          return d;
        }
        float hatch(float s){
          float t = (vXY.x + vXY.y) / s, f = min(fract(t), 1.0 - fract(t)), px = fwidth(t);
          return 1.0 - smoothstep(0.6 * uDpr * px - 0.5 * px, 0.6 * uDpr * px + 0.5 * px, f);
        }
        void main(){
          #include <clipping_planes_fragment>
          float mpp = length(fwidth(vXY)) * 0.7071;                // metres per device pixel
          float lv = log2(10.0 * uDpr * mpp / 0.32), k = floor(lv);
          float s0 = 0.32 * exp2(k);
          float line = mix(hatch(s0), hatch(s0 * 2.0), lv - k);
          float fade = 1.0 - smoothstep(0.35, 3.2, toGround(vXY));
          float cm = 1.0 - smoothstep(uColourX - 0.35, uColourX + 0.35, vXY.x);
          vec3 base = mix(uPaper, uSoil, cm * smoothstep(-6.3, -5.9, vXY.y));     // even soil with one straight lower edge, as a section's ground ends
          vec3 col = mix(base, mix(uInk, uSoilInk, cm), line * fade * 0.78);
          if (uColourX > -11.8 && uColourX < 38.2) {
            float lead = exp(-pow((uColourX - vXY.x) / 0.06, 2.0));
            col = mix(col, vec3(0.91, 0.365, 0.016), lead * 0.75 * fade);
          }
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    return m;
  }

  // ---- the house, from its profiles ----
  const shade = (nx, ny, nz) => (nz > 0.5 ? 1.0 : ny > 0.5 ? 0.935 : ny < -0.5 ? 0.83 : nx > 0.5 ? 0.965 : nx < -0.5 ? 0.89 : 0.86);
  const solid = [], earthG = [], glassG = [], waterG = [];
  const seg = { beyond: [], fine: [], glass: [], earth: [], ghost: [], light: [] };
  const col = new THREE.Color(), col2 = new THREE.Color();
  for (const p of pieces) {
    const xs = p.pts.map(q => q[0]), ys = p.pts.map(q => q[1]);
    p.bb = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    p.shape = new THREE.Shape(p.pts.map(([x, y]) => new THREE.Vector2(x, y)));
    (p.holes || []).forEach(h => p.shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y)))));
    const geo = new THREE.ExtrudeGeometry(p.shape, { depth: p.z1 - p.z0, bevelEnabled: false, curveSegments: 1 });
    geo.translate(0, 0, p.z0);
    if (p.kind === 'glass') glassG.push(geo);
    else if (p.kind === 'water') waterG.push(geo);
    else {
      const n = geo.attributes.normal, pos = geo.attributes.position, c = new Float32Array(n.count * 3), c2 = new Float32Array(n.count * 3), mIds = new Float32Array(n.count);
      col.set(BASE[p.kind]);
      for (let i = 0; i < n.count; i++) {
        const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i), k = shade(nx, ny, nz);
        c[i * 3] = col.r * k; c[i * 3 + 1] = col.g * k; c[i * 3 + 2] = col.b * k;
        const tri = Math.floor(i / 3) * 3;      // the face's own height, not the vertex's, so a floor is one colour
        const fy = (pos.getY(tri) + pos.getY(tri + 1) + pos.getY(tri + 2)) / 3, fx = (pos.getX(tri) + pos.getX(tri + 1) + pos.getX(tri + 2)) / 3;
        col2.set(colourFor(p, nx, ny, nz, fx, fy));
        c2[i * 3] = col2.r; c2[i * 3 + 1] = col2.g; c2[i * 3 + 2] = col2.b;
        mIds[i] = matIdFor(p, nx, ny, nz, fx, fy);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
      geo.setAttribute('color2', new THREE.BufferAttribute(c2, 3));
      geo.setAttribute('matId', new THREE.BufferAttribute(mIds, 1));
      (p.kind === 'earth' ? earthG : solid).push(geo);
    }
    if (p.kind === 'earth') {
      for (const [x, y] of p.pts) if (y > -14 && x > -30 && x < 50) seg.earth.push(x, y, p.z0, x, y, p.z1);
    } else {
      const e = new THREE.EdgesGeometry(geo, 20).attributes.position.array;
      const into = p.kind === 'glass' || p.kind === 'water' ? seg.glass : p.light ? seg.light : seg.beyond;
      const ghost = p.kind === 'cut' || p.kind === 'layer' || p.kind === 'glass';     // the key shows the building, not the furniture
      for (let i = 0; i < e.length; i++) { into.push(e[i]); if (ghost) seg.ghost.push(e[i]); }
    }
    // the lid for this piece, made once, moved to wherever the cut is
    p.cap = new THREE.ShapeGeometry(p.shape, 1);
    if (p.kind === 'furn') {                       // grey on the drawing, its material a shade darker in colour
      const nv = p.cap.attributes.position.count, a = new Float32Array(nv * 3), b = new Float32Array(nv * 3);
      col.set(0xc8c1b3); col2.set(colourFor(p, 0, 0, 1, 0, 0)).multiplyScalar(0.82);
      for (let i = 0; i < nv; i++) { a.set([col.r, col.g, col.b], i * 3); b.set([col2.r, col2.g, col2.b], i * 3); }
      p.cap.setAttribute('color', new THREE.BufferAttribute(a, 3));
      p.cap.setAttribute('color2', new THREE.BufferAttribute(b, 3));
    }
    p.capLines = [];
    for (const ring of [p.pts, ...(p.holes || [])]) for (let i = 0; i < ring.length; i++) {
      const [ax, ay] = ring[i], [bx, by] = ring[(i + 1) % ring.length];
      if (p.kind === 'earth') { if (ay > -14 && by > -14 && ax > -30 && bx > -30 && ax < 50 && bx < 50) p.capLines.push(ax, ay, 0, bx, by, 0); }
      else if (p.kind !== 'cut') p.capLines.push(ax, ay, 0, bx, by, 0);
    }
  }
  const solidMesh = new THREE.Mesh(mergeGeometries(solid), faces);
  solidMesh.castShadow = solidMesh.receiveShadow = true;
  scene.add(solidMesh);
  // the land arrives with its hatch, in the last pass of the plot, or the hill behind shows as a flat block
  const earthFaces = withColour(faces.clone()); earthFaces.clippingPlanes = spritePlanes;
  const earthMesh = new THREE.Mesh(mergeGeometries(earthG), earthFaces);
  earthMesh.receiveShadow = true;
  scene.add(earthMesh);
  scene.add(new THREE.Mesh(mergeGeometries(glassG), glass));
  scene.add(new THREE.Mesh(mergeGeometries(waterG), water));
  for (const f of floors) {
    const y = f.y + 0.003;
    for (let x = f.x0 + f.step; x < f.x1 - 0.05; x += f.step) seg.fine.push(x, y, f.z0, x, y, f.z1);
    for (let z = f.z1 - f.step; z > f.z0 + 0.05; z -= f.step) seg.fine.push(f.x0, y, z, f.x1, y, z);
  }
  const addLines = (arr, mat, order, layer = 0) => {
    const l = new LineSegments2(new LineSegmentsGeometry().setPositions(arr), mat);
    l.renderOrder = order;
    if (layer) l.layers.set(layer);
    scene.add(l);
    return l;
  };
  addLines(seg.beyond, LINES.beyond, 1); addLines(seg.fine, LINES.fine, 1); addLines(seg.light, LINES.light, 1); addLines(seg.glass, LINES.glass, 2); addLines(seg.earth, LINES.earth, 1);
  addLines(seg.ghost, LINES.ghost, 3, LAYER_KEY);
  addLines(coursing, LINES.stone, 1);                    // the stone's coursing, on the south front

  // a sky that arrives with the colour, behind the hill. On the drawing it is the paper
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(260, 150), new THREE.ShaderMaterial({
    depthWrite: false,
    uniforms: { uColourX: colourX, uTop: { value: new THREE.Color(0xb8d0da) }, uLow: { value: new THREE.Color(0xf2e8d4) }, uPaper: { value: new THREE.Color(PAPER) } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uColourX; uniform vec3 uTop, uLow, uPaper; varying vec3 vW;
      void main(){
        vec3 s = mix(uLow, uTop, smoothstep(1.0, 24.0, vW.y));
        float cm = 1.0 - smoothstep(uColourX - 0.35, uColourX + 0.35, vW.x);
        gl_FragColor = vec4(mix(uPaper, s, cm), 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  sky.position.set(12, 20, -55); sky.renderOrder = -10; sky.layers.set(LAYER_SKY); scene.add(sky);

  // the accent cut plane and active camera window frame, only the inset 3D radar key sees them
  const redSheet = new THREE.Mesh(new THREE.PlaneGeometry(29, 15.4), new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }));
  redSheet.position.set(11.5, 4.5, 0); redSheet.layers.set(LAYER_KEY); scene.add(redSheet);
  const redFrame = new LineSegments2(new LineSegmentsGeometry().setPositions([-3, -3.2, 0, 26, -3.2, 0, 26, -3.2, 0, 26, 12.2, 0, 26, 12.2, 0, -3, 12.2, 0, -3, 12.2, 0, -3, -3.2, 0]), LINES.red);
  redFrame.layers.set(LAYER_KEY); redFrame.renderOrder = 6; scene.add(redFrame);
  const camBoxGeo = new LineSegmentsGeometry().setPositions([0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0]);
  const camBox = new LineSegments2(camBoxGeo, LINES.cam);
  camBox.layers.set(LAYER_KEY); camBox.renderOrder = 7; scene.add(camBox);

  // ---- lids: rebuilt only when the cut enters or leaves a piece, otherwise just moved ----
  const caps = new THREE.Group(); scene.add(caps);
  let capKey = '';
  function updateCaps(zc) {
    const on = pieces.filter(p => p.z0 < zc - 1e-4 && p.z1 > zc + 1e-4);
    const key = on.map(p => pieces.indexOf(p)).join(',');
    if (key !== capKey) {
      capKey = key;
      caps.children.slice().forEach(o => { caps.remove(o); o.geometry.dispose(); });
      const byKind = {}, out = [], ground = [];
      for (const p of on) {
        (byKind[p.kind] ||= []).push(p.cap);
        (p.kind === 'earth' ? ground : out).push(...p.capLines);
      }
      for (const k in byKind) {
        const m = new THREE.Mesh(mergeGeometries(byKind[k]), capMat[k]);
        m.userData.drop = DROP[k];
        m.renderOrder = k === 'earth' ? 0 : 1;
        caps.add(m);
      }
      for (const [arr, mat] of [[out, LINES.cap], [ground, LINES.ground]]) {
        if (!arr.length) continue;
        const l = new LineSegments2(new LineSegmentsGeometry().setPositions(arr), mat);
        l.userData.drop = 0.001; l.renderOrder = 4;
        caps.add(l);
      }
    }
    caps.children.forEach(o => { o.position.z = zc - o.userData.drop; });
  }

  // ---- entourage: two drawings of each figure, one for far and one for close ----
  const spriteMeshes = [];
  function buildSprites(refPxPerM) {
    for (const s of sprites) {
      const ref = s.type.startsWith('s') || s.type === 'walk' || s.type === 'child' ? 300 : 1100 / s.h;
      const tex = [1, 3.2].map(k => {
        const d = drawSprite(s.type, s.h, THREE.MathUtils.clamp(1.15 * ref / (refPxPerM * k), 1.2, 16));
        const t = new THREE.CanvasTexture(d.canvas);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = renderer.capabilities.getMaxAnisotropy();
        t.userData = d;
        renderer.initTexture(t);      // upload now, behind the loader, not the first time the camera comes close
        return t;
      });
      const d = tex[0].userData;
      const mat = new THREE.MeshBasicMaterial({ map: tex[0], transparent: true, alphaTest: 0.02, clippingPlanes: spritePlanes, side: THREE.DoubleSide });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(d.w, d.h), mat);
      const f = s.flip ? -1 : 1;
      m.scale.x = f;
      m.position.set(s.x + f * d.ox, s.y + d.oy - 0.005, s.z);
      m.renderOrder = 2;
      m.layers.set(LAYER_SPRITES);
      if (!GREENS[s.type]) {                     // people: a soft silhouette behind, to the right, as the sun from the left would leave
        const sh = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ map: tex[0], color: 0x2a241c, transparent: true, opacity: 0, alphaTest: 0.02, depthWrite: false, clippingPlanes: spritePlanes, side: THREE.DoubleSide }));
        sh.scale.x = f; sh.position.set(m.position.x + 0.14, m.position.y - 0.02, m.position.z - 0.06);
        sh.renderOrder = 1; sh.layers.set(LAYER_SPRITES);
        scene.add(sh);
        m.userData.shadow = sh;
      }
      m.userData = { ...m.userData, tex, refPxPerM, tag: s.tag, green: GREENS[s.type], box: s.type === 'tree' ? [0.62, 0.33, 0.97] : s.type === 'cypress' ? [0.5, 0.06, 1] : [0.5, 0, 0.95] };   // width, bottom, top: a tree's box is its crown
      scene.add(m);
      spriteMeshes.push(m);
    }
  }

  // ---- the camera, from a state ----
  // state: { rect: [x0, y0, x1, y1] on the cut, at: [ax, ay] where the rect's middle sits on screen (0..1),
  //          lens (deg), vp: [x, y] or null, cut, fog }
  const S = { cx: 0, cy: 0, frameH: 10, lens: 30, vp: [0, 0], cut: -4.6, fog: 34, reveal: 1000, colourX: -1000 };
  const WHITE = new THREE.Color(0xffffff), GLASS0 = new THREE.Color(0xd3e0e2), GLASS1 = new THREE.Color(0xd2e1e4), WATER_CAP0 = new THREE.Color(0xb4cacb), WATER_CAP1 = new THREE.Color(0x528d98), WATER0 = new THREE.Color(0xbcd0d1), WATER1 = new THREE.Color(0x4c8a96);
  const GREENS = { tree: new THREE.Color(0xa7b48a), cypress: new THREE.Color(0x8c9d76), plant: new THREE.Color(0x9fb386) };
  let frameH = 10, dist = 100, ppm = 40;
  const bands = () => (W < 700 ? [66, 132] : [80, 104]);              // px kept clear for the header and the captions
  function resolve(st) {
    const aspect = W / H, [x0, y0, x1, y1] = st.rect;
    let fh, at = st.at;
    if (at) fh = Math.max((y1 - y0) / 2, (x1 - x0) / 2 / aspect);
    else {
      const [mt, mb] = bands(), free = H - mt - mb;
      fh = Math.max((y1 - y0) / 2 * H / free, (x1 - x0) / 2 / aspect);
      at = [0.5, (mt + free / 2) / H];
    }
    const cx = (x0 + x1) / 2 + (at[0] - 0.5) * -2 * fh * aspect, cy = (y0 + y1) / 2 + (at[1] - 0.5) * 2 * fh;
    return { cx, cy, frameH: fh, vp: st.vp || [cx, cy], lens: st.lens, cut: st.cut, fog: st.fog };
  }
  function place(st) {
    Object.assign(S, st);
    const aspect = W / H, cx = S.cx, cy = S.cy;
    frameH = S.frameH;
    const half = THREE.MathUtils.degToRad(S.lens / 2);
    dist = frameH / Math.tan(half);
    const [vx, vy] = S.vp;
    camera.fov = S.lens; camera.aspect = aspect;
    camera.position.set(vx, vy, S.cut + dist);
    camera.lookAt(vx, vy, S.cut);
    ppm = H / (2 * frameH);
    camera.setViewOffset(W, H, (cx - vx) * ppm, -(cy - vy) * ppm, W, H);
    camera.near = Math.max(0.05, dist * 0.6); camera.far = dist + 160;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    scene.fog.near = dist; scene.fog.far = dist + S.fog;
    cutPlane.constant = S.cut;
    const [ra, rb, rc] = Array.isArray(S.reveal) ? S.reveal : [S.reveal, S.reveal, S.reveal];
    revA.constant = ra; revB.constant = rb; revC.constant = rc;
    updateCaps(S.cut);
    redSheet.position.z = S.cut + 0.01; redFrame.position.z = S.cut;
    // Update the active camera viewport box on the cut plane in the 3D radar key
    const fw = Math.min(14.0, S.frameH * aspect), fh = Math.min(7.5, S.frameH);
    const x0 = THREE.MathUtils.clamp(cx - fw, -2.8, 25.8), x1 = THREE.MathUtils.clamp(cx + fw, -2.8, 25.8);
    const y0 = THREE.MathUtils.clamp(cy - fh, -3.0, 12.0), y1 = THREE.MathUtils.clamp(cy + fh, -3.0, 12.0);
    camBoxGeo.setPositions([x0, y0, 0, x1, y0, 0, x1, y0, 0, x1, y1, 0, x1, y1, 0, x0, y1, 0, x0, y1, 0, x0, y0, 0]);
    camBox.position.z = S.cut + 0.02;

    colourX.value = S.colourX ?? -1000;
    const t = THREE.MathUtils.clamp((colourX.value + 12) / 50.5, 0, 1);
    glass.color.lerpColors(GLASS0, GLASS1, t); glass.opacity = 0.26 - 0.06 * t;
    const sk = [S.cut.toFixed(2), revA.constant, revB.constant].join();
    if (colourX.value > -12 && sk !== shadowKey) { shadowKey = sk; renderer.shadowMap.needsUpdate = true; }
    const tw = THREE.MathUtils.clamp((colourX.value - 25) / 6, 0, 1);
    water.color.lerpColors(WATER0, WATER1, tw);
    capMat.water.color.lerpColors(WATER_CAP0, WATER_CAP1, tw);
    for (const m of spriteMeshes) {
      const g = m.userData.green, c = THREE.MathUtils.clamp((colourX.value - m.position.x) / 1.5 + 0.5, 0, 1);
      if (g) m.material.color.lerpColors(WHITE, g, c);
      const fade = m.userData.tag === 'terrace' ? THREE.MathUtils.smoothstep(S.frameH, 6.2, 7.6) : 1;
      m.material.opacity = fade; m.visible = fade > 0.01;
      const sh = m.userData.shadow;
      if (sh) { sh.material.opacity = 0.17 * c * fade; sh.visible = sh.material.opacity > 0.005; }
    }
    const tanHalf = Math.tan(half);
    for (const m of spriteMeshes) {
      const px = DPR * H / (2 * Math.max(0.5, camera.position.z - m.position.z) * tanHalf);
      const want = px > m.userData.refPxPerM * DPR * 1.9 ? 1 : 0;
      if (m.material.map !== m.userData.tex[want]) { m.material.map = m.userData.tex[want]; m.material.needsUpdate = false; }
    }
  }

  // ---- drawing notes on the cut ----
  const g2 = overlay.getContext('2d');
  const P = new THREE.Vector3();
  const scr = (x, y) => { P.set(x, y, S.cut).project(camera); return [(P.x + 1) / 2 * W, (1 - P.y) / 2 * H]; };
  function notes({ gridA = 0, levelsA = 0, labelsA = 0, sweep = null, colourPen = 0 } = {}) {
    g2.setTransform(DPR, 0, 0, DPR, 0, 0);
    g2.clearRect(0, 0, W, H);
    const ink = a => `rgba(29,28,25,${a})`, mono = w => `${w} ${W < 700 ? 9 : 10}px "IBM Plex Mono", ui-monospace, monospace`;
    if (gridA > 0.01) {
      g2.lineWidth = 0.6; g2.strokeStyle = ink(0.5 * gridA); g2.setLineDash([14, 3, 2, 3]);
      for (const [, x] of grid) { const [ax, ay] = scr(x, 11.2), [bx, by] = scr(x, -2.6); g2.beginPath(); g2.moveTo(ax, ay); g2.lineTo(bx, by); g2.stroke(); }
      g2.setLineDash([]); g2.lineWidth = 0.9; g2.strokeStyle = ink(0.85 * gridA); g2.fillStyle = ink(0.9 * gridA);
      g2.font = mono(500); g2.textAlign = 'center'; g2.textBaseline = 'middle';
      const r = W < 700 ? 8 : 11;
      for (const [k, x] of grid) { const [ax, ay] = scr(x, 11.2); g2.beginPath(); g2.arc(ax, ay - r - 1, r, 0, Math.PI * 2); g2.stroke(); g2.fillText(k, ax, ay - r - 0.5); }
    }
    g2.textAlign = 'left'; g2.textBaseline = 'alphabetic';
    if (levelsA > 0.01 && W >= 700) for (const L of levels) {
      const [ax, ay] = scr(L.y === 0 ? 34.3 : 23.8, L.y), [bx] = scr(34.9, L.y);
      g2.lineWidth = 0.7; g2.strokeStyle = ink(0.55 * levelsA); g2.setLineDash([5, 4]);
      g2.beginPath(); g2.moveTo(ax, ay); g2.lineTo(bx, ay); g2.stroke(); g2.setLineDash([]);
      g2.fillStyle = `rgba(232,93,4,${0.95 * levelsA})`;
      g2.beginPath(); g2.moveTo(bx, ay); g2.lineTo(bx - 6, ay - 9); g2.lineTo(bx + 6, ay - 9); g2.closePath(); g2.fill();
      g2.fillStyle = ink(0.95 * levelsA);
      g2.font = mono(600); g2.fillText(L.text, bx + 12, ay - 3);
      g2.font = mono(500); g2.fillStyle = ink(0.6 * levelsA); g2.fillText(L.note, bx + 12, ay + 10);
    }
    if (labelsA > 0.01) {
      g2.font = mono(500); g2.fillStyle = ink(0.78 * labelsA);
      if ('letterSpacing' in g2) g2.letterSpacing = '1.5px';
      const rb = Array.isArray(S.reveal) ? S.reveal[1] : S.reveal, th = W < 700 ? 9 : 10;
      const taken = spriteBoxes(), solids = solidShapes(), top = 74, bottom = H - (W < 700 ? 124 : 96);
      const why = window.__labelWhy = [];
      for (const [t, spots, depth] of labels) {
        if (depth && !(S.cut >= depth[0] && S.cut <= depth[1])) continue;
        const w = g2.measureText(t).width;
        for (const [x, y] of spots) {
          if (x > rb) break;
          const [sx, sy] = scr(x, y), r = [sx - 3, sy - th - 2, sx + w + 3, sy + 3];
          if (r[0] < 10 || r[2] > W - 10 || r[1] < top || r[3] > bottom) { why.push([t, x, y, 'edge']); continue; }
          const tb = taken.findIndex(b => r[0] < b[2] && r[2] > b[0] && r[1] < b[3] && r[3] > b[1]);
          if (tb >= 0) { why.push([t, x, y, 'box ' + tb]); continue; }
          const hs = solids.findIndex(sh => hitsShape(r, sh));
          if (hs >= 0) { why.push([t, x, y, 'shape ' + solids[hs].name]); continue; }
          why.push([t, x, y, 'placed']);
          taken.push(r);
          g2.fillStyle = `rgba(242,239,231,${0.94 * labelsA})`;
          g2.beginPath(); g2.rect(r[0] - 1, r[1] + 1, r[2] - r[0] + 2, r[3] - r[1]); g2.fill();
          g2.fillStyle = ink(0.84 * labelsA); g2.fillText(t, sx, sy); break;
        }
      }
      if ('letterSpacing' in g2) g2.letterSpacing = '0px';
    }
    if (colourPen > 0.01 && S.colourX > -11.9 && S.colourX < 38.4) {
      const xr = S.colourX, [sx] = scr(xr, 0), [, py] = scr(xr, groundY(xr));
      g2.strokeStyle = g2.fillStyle = `rgba(232,93,4,${colourPen})`; g2.lineWidth = 1.5;
      g2.beginPath(); g2.moveTo(sx, 0); g2.lineTo(sx, H); g2.stroke();
      g2.beginPath(); g2.arc(sx, py, 3.5, 0, Math.PI * 2); g2.fill();
    }
    if (sweep !== null) {
      const passes = Array.isArray(S.reveal) ? S.reveal : [S.reveal];
      passes.forEach((xr, i) => {
        if (xr < -11.9 || xr > 38.4) return;
        const a = sweep * [1, 0.45, 0.3][i], [sx] = scr(xr, 0), [, py] = scr(xr, groundY(xr));
        g2.strokeStyle = g2.fillStyle = `rgba(232,93,4,${a})`; g2.lineWidth = i ? 1 : 1.5;
        g2.beginPath(); g2.moveTo(sx, 0); g2.lineTo(sx, H); g2.stroke();
        g2.beginPath(); g2.arc(sx, py, i ? 2.5 : 3.5, 0, Math.PI * 2); g2.fill();
      });
    }
  }

  const Q3 = new THREE.Vector3();
  const scrAt = (x, y, z) => { Q3.set(x, y, z).project(camera); return [(Q3.x + 1) / 2 * W, (1 - Q3.y) / 2 * H]; };
  let shapeCache = { key: '', list: [] };
  function solidShapes() {
    const c = S.cut, key = [c, S.cx, S.cy, S.frameH, S.lens, W, H].map(v => v.toFixed(4)).join();
    if (key === shapeCache.key) return shapeCache.list;
    const out = [];
    for (const p of pieces) {
      if (p.kind === 'earth' || p.kind === 'water') continue;
      let z;
      if (p.z0 < c && p.z1 > c) z = c;
      else if (p.kind === 'furn' && p.z1 <= c && p.z1 > c - 4) z = p.z1;
      else continue;
      const poly = p.pts.map(([x, y]) => scrAt(x, y, z));
      const xs = poly.map(q => q[0]), ys = poly.map(q => q[1]);
      const bb = [Math.min(...xs) - 2, Math.min(...ys) - 2, Math.max(...xs) + 2, Math.max(...ys) + 2];
      if (bb[2] < 0 || bb[0] > W || bb[3] < 0 || bb[1] > H) continue;
      out.push({ bb, poly, name: `${p.kind} ${p.bb.map(v => v.toFixed(2)).join(',')} z${p.z0},${p.z1}`, holes: (p.holes || []).map(h => h.map(([x, y]) => scrAt(x, y, z))) });
    }
    shapeCache = { key, list: out };
    return out;
  }
  const inPoly = (x, y, poly) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const segsCross = (a, b, c, d) => {
    const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
  };
  function hitsShape(r, s) {
    if (r[0] > s.bb[2] || r[2] < s.bb[0] || r[1] > s.bb[3] || r[3] < s.bb[1]) return false;
    const corners = [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]];
    const solid = (x, y) => inPoly(x, y, s.poly) && !s.holes.some(h => inPoly(x, y, h));
    if (corners.some(([x, y]) => solid(x, y))) return true;
    for (const ring of [s.poly, ...s.holes]) {
      if (ring.some(([x, y]) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3])) return true;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        for (let k = 0; k < 4; k++) if (segsCross(a, b, corners[k], corners[(k + 1) % 4])) return true;
      }
    }
    return false;
  }
  function spriteBoxes() {
    const out = [];
    for (const m of spriteMeshes) {
      if (m.position.z > S.cut || !m.visible) continue;
      if (m.position.z < S.cut - 3 && m.userData.tag !== 'court') continue;
      const { width: w, height: h } = m.geometry.parameters, [bw, b0, b1] = m.userData.box, y0 = m.position.y - h / 2;
      const [ax, ay] = scrAt(m.position.x - w / 2 * bw, y0 + h * b1, m.position.z), [bx, by] = scrAt(m.position.x + w / 2 * bw, y0 + h * b0, m.position.z);
      out.push([Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)]);
    }
    return out;
  }
  function groundY(x) {
    for (let i = 0; i < groundLine.length - 1; i++) {
      const [ax, ay] = groundLine[i], [bx, by] = groundLine[i + 1];
      if (x >= ax && x <= bx) return ay + (by - ay) * (x - ax) / Math.max(1e-4, bx - ax);
    }
    return 0;
  }

  // ---- render, with the optional 3D axonometric inset key in a corner ----
  function render(key = null) {
    uTime.value = performance.now() * 0.001;
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, W, H);
    scene.fog.near = dist; scene.fog.far = dist + S.fog;
    renderer.render(scene, camera);
    if (key && key.a > 0.01) {
      const { x, y, w, h } = key;           // css px from the top left
      keyCam.aspect = w / h; keyCam.updateProjectionMatrix();
      lineMats.forEach(m => m.resolution.set(w, h));
      LINES.ghost.opacity = 0.24 * key.a;
      LINES.cam.opacity = 0.75 * key.a;
      const fogN = scene.fog.near, fogF = scene.fog.far;
      scene.fog.near = 65; scene.fog.far = 140;
      renderer.setScissorTest(true);
      renderer.setScissor(x, H - y - h, w, h); renderer.setViewport(x, H - y - h, w, h);
      renderer.setClearColor(0xf2efe7, 1); renderer.clear();
      const saved = [revA.constant, revB.constant, revC.constant];
      revA.constant = revB.constant = revC.constant = 1000;
      renderer.render(scene, keyCam);
      [revA.constant, revB.constant, revC.constant] = saved;
      renderer.setClearColor(PAPER, 1);
      renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
      scene.fog.near = fogN; scene.fog.far = fogF;
      lineMats.forEach(m => m.resolution.set(W, H));
    }
  }

  function resize() {
    W = innerWidth; H = innerHeight;
    renderer.setSize(W, H, false);
    overlay.width = W * DPR; overlay.height = H * DPR;
    lineMats.forEach(m => m.resolution.set(W, H));
  }
  resize();

  return {
    renderer, scene, camera, place, resolve, notes, render, resize, buildSprites, scr,
    hideTags(tags) { spriteMeshes.forEach(m => { m.visible = !tags.includes(m.userData.tag); }); },
    get W() { return W; }, get H() { return H; }, get ppm() { return ppm; }, get dist() { return dist; }, get frameH() { return frameH; },
    precompile() { renderer.compile(scene, camera); renderer.compile(scene, keyCam); },
  };
}
