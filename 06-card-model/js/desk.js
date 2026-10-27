// Everything on the desk. The house keeps 1 unit = 1 m, so on the desk 1 unit = 1 cm,
// and every prop here (mat, rule, scalpel, lamp, mug, the wall) is built a hundred times its size.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { houseParts, makeRnd, PEOPLE, TREES } from './house.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rnd = makeRnd(23);
export const MAT_TOP = -9.6;   // the cutting mat's top face
export const DESK_TOP = -10.1;

// ---------------------------------------------------------------- textures
let ANISO = 8;
export function setAniso(a) { ANISO = a; }
export function canvasTex(w, h, draw, { tile = 0, srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (tile) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / tile, 1 / tile); }
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANISO;
  return t;
}
export function grain(g, w, h, amp) {
  const d = g.getImageData(0, 0, w, h);
  for (let i = 0; i < d.data.length; i += 4) { const k = (rnd() - 0.5) * amp; d.data[i] += k; d.data[i + 1] += k; d.data[i + 2] += k; }
  g.putImageData(d, 0, 0);
}
export function blotches(g, s, n, rgba, r0, r1) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * s, y = rnd() * s, r = r0 + rnd() * (r1 - r0);
    for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) {
      const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      gr.addColorStop(0, rgba); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
    }
  }
}
// short fibres, drawn wrapped so the tile has no seam
export function fibres(g, s, n, len, cols, width = 0.6) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * s, y = rnd() * s, a = rnd() * Math.PI, L = len * (0.4 + rnd());
    g.strokeStyle = cols[Math.floor(rnd() * cols.length)]; g.lineWidth = width;
    for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) {
      if (x + dx < -L || x + dx > s + L || y + dy < -L || y + dy > s + L) continue;
      g.beginPath(); g.moveTo(x + dx, y + dy);
      g.quadraticCurveTo(x + dx + Math.cos(a) * L * 0.5 + (rnd() - 0.5) * 3, y + dy + Math.sin(a) * L * 0.5 + (rnd() - 0.5) * 3, x + dx + Math.cos(a) * L, y + dy + Math.sin(a) * L);
      g.stroke();
    }
  }
}

function makeTextures() {
  const T = {};
  // white mount board: formation clouds, two fibre families and fine tooth, 1 tile = 4 cm on the desk
  T.card = canvasTex(1024, 1024, (g, s) => {
    g.fillStyle = '#f3f0e8'; g.fillRect(0, 0, s, s);
    blotches(g, s, 110, 'rgba(105,94,78,0.042)', 14, 72);
    blotches(g, s, 80, 'rgba(255,255,255,0.075)', 10, 52);
    fibres(g, s, 6800, 10, ['rgba(90,80,66,0.085)', 'rgba(255,255,255,0.16)', 'rgba(125,114,98,0.065)'], 0.65);
    fibres(g, s, 3200, 4.5, ['rgba(75,66,54,0.07)', 'rgba(255,255,255,0.12)'], 0.45);
    grain(g, s, s, 9);
  }, { tile: 4 });
  // greyboard: recycled fibre, pulp flecks, 1 tile = 6 cm
  T.board = canvasTex(1024, 1024, (g, s) => {
    g.fillStyle = '#aba69e'; g.fillRect(0, 0, s, s);
    blotches(g, s, 140, 'rgba(58,52,45,0.065)', 10, 62);
    blotches(g, s, 95, 'rgba(205,198,186,0.07)', 10, 52);
    fibres(g, s, 8200, 7.5, ['rgba(52,45,38,0.18)', 'rgba(195,188,176,0.18)', 'rgba(124,114,100,0.22)'], 0.8);
    for (let i = 0; i < 1100; i++) { g.fillStyle = ['rgba(42,36,30,0.52)', 'rgba(218,212,200,0.48)', 'rgba(72,82,106,0.36)', 'rgba(136,64,52,0.32)'][Math.floor(rnd() * 4)]; const r = 0.6 + rnd() * 1.7; g.fillRect(rnd() * s, rnd() * s, r, r * (0.5 + rnd())); }
    grain(g, s, s, 13);
  }, { tile: 6 });
  // cut greyboard edge: warm pressed-pulp strata, vertical blade score micro-lines, and top-edge crush highlight
  T.burn = canvasTex(512, 512, (g, s) => {
    g.fillStyle = '#82705e'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 2) {
      g.fillStyle = `rgba(${rnd() < 0.5 ? '42,33,25' : '158,140,120'},${0.10 + rnd() * 0.16})`;
      g.fillRect(0, y, s, 1 + rnd() * 2.2);
    }
    for (let x = 0; x < s; x += 3) {
      if (rnd() < 0.45) {
        g.fillStyle = `rgba(${rnd() < 0.5 ? '50,40,30' : '175,160,142'},${0.05 + rnd() * 0.08})`;
        g.fillRect(x, 0, 1, s);
      }
    }
    const topGr = g.createLinearGradient(0, 0, 0, s);
    topGr.addColorStop(0, 'rgba(235,224,208,0.32)');
    topGr.addColorStop(0.08, 'rgba(210,198,180,0.08)');
    topGr.addColorStop(0.5, 'rgba(40,32,24,0.08)');
    topGr.addColorStop(0.92, 'rgba(200,188,170,0.06)');
    topGr.addColorStop(1, 'rgba(230,218,200,0.26)');
    g.fillStyle = topGr; g.fillRect(0, 0, s, s);
    grain(g, s, s, 15);
  }, { tile: 1.6 });
  // the cutting mat: 150 x 110 cm, a 1 cm grid, numbers, angle lines
  T.mat = canvasTex(4096, 3004, (g, w, h) => {
    const k = w / 150;
    g.fillStyle = '#2b463b'; g.fillRect(0, 0, w, h);
    blotches(g, w, 40, 'rgba(20,36,30,0.10)', 80, 300);
    // subtle knife score marks on the self-healing mat near the model
    g.strokeStyle = 'rgba(18,32,26,0.35)'; g.lineWidth = 1.2;
    for (let i = 0; i < 45; i++) {
      const sx = w * (0.25 + rnd() * 0.5), sy = h * (0.25 + rnd() * 0.5), ang = (rnd() - 0.5) * 0.4, len = 40 + rnd() * 180;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len); g.stroke();
    }
    const m0 = 3 * k; // a 3 cm border without grid
    g.save(); g.beginPath(); g.rect(m0, m0, w - 2 * m0, h - 2 * m0); g.clip();
    for (let i = 0; i <= 150; i++) {
      const x = i * k, major = i % 10 === 0, mid = i % 5 === 0;
      g.fillStyle = major ? 'rgba(214,226,206,0.62)' : mid ? 'rgba(214,226,206,0.42)' : 'rgba(214,226,206,0.22)';
      g.fillRect(x - (major ? 1.6 : 0.8), 0, major ? 3.2 : 1.6, h);
    }
    for (let j = 0; j <= 110; j++) {
      const y = j * k, major = j % 10 === 0, mid = j % 5 === 0;
      g.fillStyle = major ? 'rgba(214,226,206,0.62)' : mid ? 'rgba(214,226,206,0.42)' : 'rgba(214,226,206,0.22)';
      g.fillRect(0, y - (major ? 1.6 : 0.8), w, major ? 3.2 : 1.6);
    }
    g.strokeStyle = 'rgba(214,226,206,0.35)'; g.lineWidth = 2;
    for (const a of [45, 60, 30]) { g.beginPath(); g.moveTo(m0, h - m0); g.lineTo(m0 + Math.cos(a * Math.PI / 180) * 3000, h - m0 - Math.sin(a * Math.PI / 180) * 3000); g.stroke(); }
    g.restore();
    g.fillStyle = 'rgba(214,226,206,0.7)'; g.font = `500 ${Math.round(k * 0.62)}px "IBM Plex Mono", monospace`; g.textAlign = 'center';
    for (let i = 4; i < 147; i++) { g.fillText(String(i - 3), i * k, m0 - k * 0.6); g.fillText(String(i - 3), i * k, h - m0 + k * 1.2); }
    g.textAlign = 'right';
    for (let j = 4; j < 107; j++) g.fillText(String(j - 3), m0 - k * 0.5, j * k + k * 0.2);
    g.font = `600 ${Math.round(k * 0.9)}px "Chakra Petch", sans-serif`; g.textAlign = 'left';
    g.fillText('SELF-HEALING  A0  CUTTING MAT', m0 + k * 4, h - m0 + k * 2.6);
    grain(g, w, h, 6);
  });
  // a dark oak desk
  T.desk = canvasTex(2048, 1024, (g, w, h) => {
    g.fillStyle = '#3a2a1f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      const y = rnd() * h, a = 0.03 + rnd() * 0.09;
      g.strokeStyle = `rgba(${rnd() < 0.6 ? '18,11,7' : '110,80,55'},${a})`; g.lineWidth = 0.6 + rnd() * 2.2;
      g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 64) g.lineTo(x, y + Math.sin(x * 0.004 + y) * 6 + (rnd() - 0.5) * 1.5); g.stroke();
    }
    grain(g, w, h, 8);
  });
  T.desk.wrapS = T.desk.wrapT = THREE.RepeatWrapping; T.desk.repeat.set(1 / 160, 1 / 80);
  // the steel rule: 60 cm brushed stainless steel, mm & half-mm ticks, numbers every cm, plus roughness map
  T.rule = canvasTex(4096, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#d8dde2'); gr.addColorStop(0.18, '#c2c7cc'); gr.addColorStop(0.52, '#b4b9be'); gr.addColorStop(0.85, '#cdd2d7'); gr.addColorStop(1, '#aeb3b8');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) {
      g.fillStyle = `rgba(${rnd() < 0.55 ? '255,255,255' : '35,38,42'},${0.03 + rnd() * 0.08})`;
      g.fillRect(0, rnd() * h, w, 0.7 + rnd() * 1.4);
    }
    // subtle diagonal sheen variation along the rule length
    const lgr = g.createLinearGradient(0, 0, w, 0);
    lgr.addColorStop(0, 'rgba(255,255,255,0.06)'); lgr.addColorStop(0.35, 'rgba(255,255,255,0.18)');
    lgr.addColorStop(0.65, 'rgba(30,34,38,0.08)'); lgr.addColorStop(1, 'rgba(255,255,255,0.12)');
    g.fillStyle = lgr; g.fillRect(0, 0, w, h);
    const k = w / 60;
    g.fillStyle = 'rgba(18,20,22,0.92)'; g.font = `600 ${Math.round(k * 0.38)}px "IBM Plex Mono", monospace`; g.textAlign = 'center';
    for (let i = 0; i <= 600; i++) {
      const major = i % 10 === 0, mid = i % 5 === 0;
      const L = major ? 0.38 : mid ? 0.27 : 0.17;
      g.fillRect(i * k / 10 - (major ? 1.4 : 0.9), 0, major ? 2.8 : 1.8, h * L);
      if (i < 600) g.fillRect((i + 0.5) * k / 10 - 0.5, 0, 1.0, h * 0.10);
      if (major || mid) g.fillRect(i * k / 10 - (major ? 1.2 : 0.8), h * (1 - L * 0.65), major ? 2.4 : 1.6, h * L * 0.65);
    }
    for (let i = 1; i < 60; i++) g.fillText(String(i), i * k, h * 0.60);
    g.font = `500 ${Math.round(k * 0.22)}px "IBM Plex Mono", monospace`;
    g.fillText('STAINLESS TEMPERED   600 mm   1:100', w * 0.22, h * 0.82);
    grain(g, w, h, 7);
  });
  T.ruleRough = canvasTex(2048, 128, (g, w, h) => {
    g.fillStyle = '#383838'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const v = Math.round(36 + rnd() * 55);
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, rnd() * h, w, 1 + rnd() * 1.5);
    }
    const k = w / 60;
    g.fillStyle = '#d8d8d8';
    for (let i = 0; i <= 600; i++) {
      const L = i % 10 === 0 ? 0.38 : i % 5 === 0 ? 0.27 : 0.17;
      g.fillRect(i * k / 10 - 1, 0, 2, h * L);
    }
  }, { srgb: false });
  return T;
}

// ---------------------------------------------------------------- materials
// The card shows a 3-ply mount board / foamboard core on every cut edge: aCore.x = 1 on an edge face, aCore.y = position across the thickness.
export function withCore(mat, coreTint) {
  mat.onBeforeCompile = (s) => {
    s.uniforms.uCoreTint = { value: coreTint };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aCore;\nvarying vec2 vCore;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCore = aCore;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vCore;\nuniform vec3 uCoreTint;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        if (vCore.x > 0.5) {
          float c = vCore.y;
          float fw = fwidth(c) * 1.15;
          float core = smoothstep(0.09 - fw, 0.09 + fw, c) * (1.0 - smoothstep(0.91 - fw, 0.91 + fw, c));
          float skinCrush = exp(-pow(c / max(0.025, fw), 2.0)) + exp(-pow((1.0 - c) / max(0.025, fw), 2.0));
          float glue = exp(-pow((c - 0.095) / max(0.014, fw), 2.0)) + exp(-pow((c - 0.905) / max(0.014, fw), 2.0));
          diffuseColor.rgb = mix(diffuseColor.rgb * (1.0 + 0.08 * skinCrush), diffuseColor.rgb * uCoreTint, core);
          diffuseColor.rgb *= 1.0 - 0.22 * clamp(glue, 0.0, 1.0);
        }`);
  };
  mat.customProgramCacheKey = () => 'core';
  return mat;
}

export function makeMaterials(env) {
  const T = makeTextures();
  const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.9, metalness: 0, envMap: env, envMapIntensity: 0.16 }, o));
  const M = { T };
  M.card = withCore(std({ color: 0xf4f1ea, map: T.card, bumpMap: T.card, bumpScale: 0.065, roughness: 0.91 }), new THREE.Color(0.86, 0.82, 0.75));
  M.cardPlain = std({ color: 0xf4f1ea, map: T.card, bumpMap: T.card, bumpScale: 0.065, roughness: 0.91 });
  M.acetate = new THREE.MeshPhysicalMaterial({
    color: 0xeaf2f4, roughness: 0.04, metalness: 0.04, clearcoat: 1.0, clearcoatRoughness: 0.03,
    ior: 1.56, reflectivity: 0.9, transparent: true, opacity: 0.21, envMap: env, envMapIntensity: 1.9,
    depthWrite: false, side: THREE.DoubleSide,
  });
  M.board = std({ color: 0xffffff, map: T.board, bumpMap: T.board, bumpScale: 0.06, roughness: 0.94, envMapIntensity: 0.14 });
  M.burn = std({ color: 0xffffff, map: T.burn, bumpMap: T.burn, bumpScale: 0.045, roughness: 0.84, envMapIntensity: 0.18 });
  M.figure = std({ color: 0xf0ede6, map: T.card, bumpMap: T.card, bumpScale: 0.025, roughness: 0.62, envMapIntensity: 0.22 });
  M.mat = std({ map: T.mat, bumpMap: T.mat, bumpScale: 0.015, roughness: 0.78, envMapIntensity: 0.14 });
  M.matEdge = std({ color: 0x264036, roughness: 0.82 });
  M.desk = std({ map: T.desk, bumpMap: T.desk, bumpScale: 0.03, roughness: 0.52, envMapIntensity: 0.2 });
  M.rule = std({ color: 0xe6ebf0, map: T.rule, roughnessMap: T.ruleRough, bumpMap: T.ruleRough, bumpScale: 0.018, metalness: 0.52, roughness: 0.34, envMapIntensity: 1.45 });
  M.steel = std({ color: 0xd4d9de, metalness: 0.62, roughness: 0.28, envMapIntensity: 1.25 });
  M.blade = std({ color: 0xe8ecef, metalness: 0.78, roughness: 0.16, envMapIntensity: 1.65 });
  M.pencil = std({ color: 0xd8a62a, roughness: 0.42 });
  M.pencilStripe = std({ color: 0x1c1b1a, roughness: 0.42 });
  M.wood = std({ color: 0xd9b78f, roughness: 0.78 });
  M.lead = std({ color: 0x2b2b2b, roughness: 0.35, metalness: 0.35 });
  M.trace = std({ color: 0xf1e7b2, map: T.card, roughness: 0.82, transparent: true, opacity: 0.93 });
  M.lamp = std({ color: 0x26282c, roughness: 0.28, metalness: 0.76, envMapIntensity: 1.05 });
  M.lampRim = std({ color: 0x26282c, roughness: 0.26, metalness: 0.76, envMapIntensity: 1.0, emissive: 0xffc68c, emissiveIntensity: 0 }); // the lip of the shade, lit from inside
  M.lampInner = new THREE.MeshStandardMaterial({ color: 0xf5f1e8, roughness: 0.38, emissive: 0xffd9a8, emissiveIntensity: 0, side: THREE.BackSide });
  M.spring = std({ color: 0xa6abb0, metalness: 0.92, roughness: 0.28, envMapIntensity: 0.85 });
  M.bulb = new THREE.MeshStandardMaterial({ color: 0x222018, emissive: 0xffe3b8, emissiveIntensity: 0, roughness: 0.25 });
  M.mug = std({ color: 0xeee9df, roughness: 0.22, envMapIntensity: 0.4 });
  M.coffee = std({ color: 0x1e120b, roughness: 0.08, envMapIntensity: 0.65 });
  M.wall = std({ color: 0x2c2926, roughness: 0.98, envMapIntensity: 0.05 });
  M.pin = std({ color: 0xc23b22, roughness: 0.32 });
  M.tape = std({ color: 0xe6dcc3, roughness: 0.88, transparent: true, opacity: 0.85 });
  M.night = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  M.frame = std({ color: 0x1b1a19, roughness: 0.7 });
  M.book1 = std({ color: 0x8a3524, map: T.card, bumpMap: T.card, bumpScale: 0.02, roughness: 0.78 });
  M.book2 = std({ color: 0xd9d2c3, map: T.card, bumpMap: T.card, bumpScale: 0.02, roughness: 0.82 });
  return M;
}

// ---------------------------------------------------------------- geometry helpers
// uv in units from world position, by the face's main axis, so textures run on across boxes
export function worldUV(g) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (ax >= ay && ax >= az) { uv[i * 2] = z; uv[i * 2 + 1] = y; }
    else if (ay >= az) { uv[i * 2] = x; uv[i * 2 + 1] = z; }
    else { uv[i * 2] = x; uv[i * 2 + 1] = y; }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
// a box of card: world uv, and the foamboard core on its cut edges
function cardBox(b) {
  const d = [b[3] - b[0], b[4] - b[1], b[5] - b[2]];
  const g = new THREE.BoxGeometry(d[0], d[1], d[2]);
  g.translate((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2); worldUV(g);
  const thin = d.indexOf(Math.min(...d)), th = d[thin];
  const others = d.filter((_, i) => i !== thin);
  const panel = th >= 0.15 && th <= 0.75 && Math.min(...others) > th * 1.6;
  const p = g.attributes.position, n = g.attributes.normal, core = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const na = [Math.abs(n.getX(i)), Math.abs(n.getY(i)), Math.abs(n.getZ(i))];
    const ax = na.indexOf(Math.max(...na));
    if (panel && ax !== thin) { core[i * 2] = 1; core[i * 2 + 1] = ([p.getX(i), p.getY(i), p.getZ(i)][thin] - b[thin]) / th; }
  }
  g.setAttribute('aCore', new THREE.BufferAttribute(core, 2));
  return g;
}
function plain(g) { // the attributes a merged card mesh needs
  if (!g.attributes.aCore) g.setAttribute('aCore', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g.index ? g.toNonIndexed() : g;
}
function mesh(geo, mat, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = receive; return m;
}

// ---------------------------------------------------------------- the card house
// The same list of parts as the real house. Furniture, paving and footings stay out of a card model.
export function cardHouse(M) {
  const card = [], acetate = [];
  for (const p of houseParts()) {
    if (p.k === 'furn' || p.k === 'land' || p.ph <= 1) continue;
    (p.k === 'glass' ? acetate : card).push(cardBox(p.b));
  }
  const g = new THREE.Group();
  g.add(mesh(mergeGeometries(card.map((q) => q.toNonIndexed())), M.card));
  const ac = mesh(mergeGeometries(acetate.map((q) => q.toNonIndexed())), M.acetate, { cast: false });
  ac.renderOrder = 2; g.add(ac);
  return g;
}

// ---------------------------------------------------------------- the site: stacked greyboard, one layer per 0.8 m
export const shiftZ = (z) => { const a = Math.max(0, Math.min(1, (Math.abs(z + 2) - 6) / 10)); return 2.8 * (1 - Math.cos(a * Math.PI)) / 2 + 0.7 * Math.sin(z * 0.33) * a; };
export const Xof = (t, z) => (t > -3.2 ? 4 + (-t) / 3.2 * 13 : 26 + (-3.2 - t) / 2.4 * 10) + shiftZ(z);
export const SITE = { x0: -14, x1: 40, z0: -20, z1: 14, base: -6.4 };
export const LAYER_TOPS = []; for (let t = -5.6; t <= 0.001; t += 0.8) LAYER_TOPS.push(+t.toFixed(2));
// the top of the stack at (x, z), ignoring the house's cut-out
export function groundAt(x, z) {
  let top = SITE.base;
  for (const t of LAYER_TOPS) if (x < Math.min(SITE.x1, Xof(t, z))) top = t;
  return top;
}
export function contourLayers(M) {
  const { x0: BX0, x1: BX1, z0: BZ0, z1: BZ1 } = SITE;
  const layers = [];
  const layer = (yb, t, pts, holes = []) => {
    const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    for (const h of holes) sh.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
    const geo = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false, curveSegments: 4 });
    geo.rotateX(-Math.PI / 2); geo.translate(0, yb, 0); worldUV(geo);
    const m = mesh(geo, [M.board, M.burn]); m.userData.top = yb + t; layers.push(m);
  };
  layer(-9.6, 3.2, [[BX0, BZ0], [BX1, BZ0], [BX1, BZ1], [BX0, BZ1]]);
  for (const t of LAYER_TOPS) {
    const zs = []; for (let z = BZ0; z <= BZ1 + 1e-6; z += 0.5) zs.push(+z.toFixed(2));
    const notch = t > -3.2 + 1e-6;
    const pts = [[BX0, BZ0]];
    for (const z of zs) {
      if (notch && z > -8 && z < 4) continue;
      pts.push([Math.min(BX1, Xof(t, z)), z]);
      if (notch && z === -8) pts.push([3.7, -8], [3.7, 4]);
    }
    pts.push([BX0, BZ1]);
    const holes = (!notch && t > -3.6) ? [[[3.7, -8], [18.3, -8], [18.3, 4], [3.7, 4]].reverse()] : [];
    layer(t - 0.8, 0.8, pts, holes);
  }
  return layers;
}

// ---------------------------------------------------------------- model trees: two laser-cut card profiles slotted in a cross
function crownOutline(kind) {
  const pts = [];
  if (kind === 'cypress') {
    const H = 6.6, R = 0.95, y0 = 0.9, N = 96;
    for (let i = 0; i <= N; i++) { const s = i / N, y = y0 + s * H; const w = R * Math.sin(Math.PI * s) ** 0.55 * (1 - s * 0.2); pts.push([w + 0.018 * Math.sin(s * 38), y]); }
    for (let i = N; i >= 0; i--) { const s = i / N, y = y0 + s * H; const w = R * Math.sin(Math.PI * s) ** 0.55 * (1 - s * 0.2); pts.push([-w - 0.018 * Math.sin(s * 35), y]); }
    return { pts, trunk: y0 + 0.1 };
  }
  const R = kind === 'olive' ? 1.55 : 1.35, cy = kind === 'olive' ? 2.9 : 3.15, sq = kind === 'olive' ? 0.72 : 0.95;
  const lobes = kind === 'olive' ? 7 : 9, amp = kind === 'olive' ? 0.068 : 0.035, ph = rnd() * 6, N = 180;
  for (let i = 0; i <= N; i++) {
    const a = -Math.PI / 2 + i / N * Math.PI * 2;
    const r = R * (1 + amp * Math.sin(a * lobes + ph) + (kind === 'olive' ? 0.045 * Math.sin(a * 3 + ph * 2) : 0.015 * Math.cos(a * 5)));
    pts.push([Math.cos(a) * r, cy + Math.sin(a) * r * sq]);
  }
  return { pts, trunk: cy - R * sq + 0.15 };
}
function withTreeCore(g, t) {
  const q = g.index ? g.toNonIndexed() : g;
  worldUV(q);
  const p = q.attributes.position, n = q.attributes.normal, core = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(n.getZ(i)) < 0.5) {
      core[i * 2] = 1;
      core[i * 2 + 1] = clamp((p.getZ(i) + t / 2) / t, 0, 1);
    }
  }
  q.setAttribute('aCore', new THREE.BufferAttribute(core, 2));
  return q;
}
function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }
function treeGeo(kind) {
  const { pts, trunk } = crownOutline(kind);
  const tw = kind === 'olive' ? 0.11 : 0.085;
  // one profile: trunk plus crown, as a single outline (trunk rectangle, then the crown drawn around)
  const sh = new THREE.Shape();
  sh.moveTo(-tw, 0); sh.lineTo(tw, 0); sh.lineTo(tw, trunk);
  const crown = pts.slice();
  let iR = crown.findIndex(([u, v]) => u > tw && v < trunk + 1.2);
  if (iR < 0) iR = 1;
  let iL = crown.length - 1 - crown.slice().reverse().findIndex(([u, v]) => u < -tw && v < trunk + 1.2);
  if (iL >= crown.length) iL = crown.length - 2;
  for (let i = iR; i <= iL; i++) sh.lineTo(crown[i][0], crown[i][1]);
  sh.lineTo(-tw, trunk); sh.closePath();
  const t = 0.12;
  const a = withTreeCore(new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false, curveSegments: 8 }).translate(0, 0, -t / 2), t);
  const b = a.clone(); b.rotateY(Math.PI / 2);
  const tab = plain(worldUV(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 28).translate(0, 0.03, 0))); // a little card disc it stands on
  return mergeGeometries([a, b, tab]);
}
const MORE_TREES = [['round', 30.5, -6.5], ['olive', 24.5, 10.5], ['cypress', 25.5, 12.2], ['round', -11.5, 9.5], ['olive', -2.5, 9.0], ['cypress', 1.5, -15.5], ['round', 24.5, -16], ['round', 36.8, 13.8], ['olive', 36.5, -3.2]];
// every tree on the model, [kind, x, z]: the real trees grow at the same spots
export function treeSpots() {
  const out = [];
  for (const [kind, x, , z] of TREES) out.push([kind, x, z]);
  for (const [kind, x, z] of MORE_TREES) out.push([kind, x, z]);
  return out;
}
export function modelTrees(M) {
  return treeSpots().map(([kind, x, z]) => {
    const g = treeGeo(kind); g.rotateY(rnd() * Math.PI);
    const m = mesh(g, M.card); m.position.set(x, groundAt(x, z), z);
    m.rotation.z = (rnd() - 0.5) * 0.025;
    return m;
  });
}

// ---------------------------------------------------------------- scale figures, 1.76 m (17.6 mm) tall, white
export function figureGeo() {
  const pts = [[0, 0], [0.12, 0], [0.135, 0.06], [0.13, 0.42], [0.145, 0.82], [0.185, 1.0], [0.205, 1.3], [0.2, 1.38], [0.15, 1.44], [0.065, 1.48], [0.062, 1.53], [0.095, 1.58], [0.1, 1.66], [0.08, 1.73], [0.04, 1.76], [0, 1.765]];
  const g = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 32);
  g.scale(1, 1, 0.62);
  return g;
}
// the hero's figure, in the lower garden where the dive ends
export const HERO_FIG = [32.8, 6.4, -1.99]; // x, z, facing (radians about y): on the -4.80 terrace, looking at the house
export function modelFigures(M) {
  const geo = figureGeo();
  const list = PEOPLE.filter((p) => p[0] !== 21.6).map(([x, y, z, r]) => [x, y, z, r]);
  list.push([HERO_FIG[0], groundAt(HERO_FIG[0], HERO_FIG[1]), HERO_FIG[1], HERO_FIG[2]]);
  return list.map(([x, y, z, r]) => { const m = mesh(geo, M.figure); m.position.set(x, y, z); m.rotation.y = r; return m; });
}

// ---------------------------------------------------------------- the desk, and what lies on it
export const LAMP = { base: V(88, DESK_TOP, 40), head: V(56, 36, 12), aimAt: V(14, -4.5, -2.5) };
export function deskProps(M) {
  const g = new THREE.Group();
  const put = (geo, mat, opts) => { const m = mesh(geo, mat, opts); g.add(m); return m; };
  // desk and mat
  const desk = new THREE.BoxGeometry(600, 4, 400); desk.translate(0, DESK_TOP - 2, -20); worldUV(desk); put(desk, M.desk);
  const mat = new THREE.BoxGeometry(150, 0.35, 110); mat.translate(12, MAT_TOP - 0.175, -2);
  put(mat, [M.matEdge, M.matEdge, M.mat, M.matEdge, M.matEdge, M.matEdge]);
  // steel rule, in front of the model, with a subtle bevelled top profile
  const rule = new THREE.BoxGeometry(60, 0.14, 3.2); rule.rotateY(0.16); rule.translate(18, MAT_TOP + 0.07, 30); put(rule, [M.steel, M.steel, M.rule, M.steel, M.steel, M.steel]);
  // scalpel: flat ribbed handle and a no. 10A blade
  const sc = new THREE.Group();
  const handle = new THREE.BoxGeometry(12.5, 0.55, 0.85); handle.translate(6.25, 0, 0); sc.add(mesh(handle, M.steel));
  for (let i = 0; i < 11; i++) { const rib = new THREE.BoxGeometry(0.16, 0.6, 0.9); rib.translate(5.2 + i * 0.55, 0, 0); sc.add(mesh(rib, M.steel)); }
  const bs = new THREE.Shape(); bs.moveTo(0, -0.32); bs.lineTo(-3.2, -0.32); bs.quadraticCurveTo(-3.9, -0.2, -4.2, 0.28); bs.lineTo(-2.4, 0.42); bs.lineTo(0, 0.32); bs.closePath();
  const blade = new THREE.ExtrudeGeometry(bs, { depth: 0.04, bevelEnabled: false }); blade.rotateX(-Math.PI / 2); blade.translate(0, 0, 0);
  sc.add(mesh(blade, M.blade));
  sc.position.set(47, MAT_TOP + 0.3, 21); sc.rotation.y = 0.55; g.add(sc);
  // pencil, hexagonal, yellow and black
  const pg = new THREE.Group();
  const body = new THREE.CylinderGeometry(0.42, 0.42, 15, 6); body.rotateZ(Math.PI / 2); pg.add(mesh(body, M.pencil));
  const end = new THREE.CylinderGeometry(0.425, 0.425, 0.5, 6); end.rotateZ(Math.PI / 2); end.translate(7.3, 0, 0); pg.add(mesh(end, M.pencilStripe));
  const cone = new THREE.ConeGeometry(0.42, 2.2, 6); cone.rotateZ(Math.PI / 2); cone.translate(-8.6, 0, 0); pg.add(mesh(cone, M.wood));
  const tip = new THREE.ConeGeometry(0.12, 0.6, 8); tip.rotateZ(Math.PI / 2); tip.translate(-9.95, 0, 0); pg.add(mesh(tip, M.lead));
  pg.position.set(-16, MAT_TOP + 0.42, 36); pg.rotation.y = -1.75; g.add(pg);
  // two rolls: one lying at the back, one standing on its end (a tower, seen from eye height)
  const roll = new THREE.CylinderGeometry(2.8, 2.8, 36, 40); roll.rotateZ(Math.PI / 2); roll.rotateY(0.5); roll.translate(-30, DESK_TOP + 2.8, -60); put(roll, M.trace);
  const core = new THREE.CylinderGeometry(1.1, 1.1, 36.4, 24); core.rotateZ(Math.PI / 2); core.rotateY(0.5); core.translate(-30, DESK_TOP + 2.8, -60); put(core, M.wood);
  const stand = new THREE.CylinderGeometry(3.1, 3.1, 46, 44); stand.translate(-58, DESK_TOP + 23, 12); put(stand, M.trace);
  const standCore = new THREE.CylinderGeometry(1.2, 1.2, 46.2, 24); standCore.translate(-58, DESK_TOP + 23.05, 12); put(standCore, M.wood);
  // a pot of pencils and pens
  const pot = new THREE.CylinderGeometry(4.2, 4.2, 11, 40, 1, true); pot.translate(-46, DESK_TOP + 5.5, 24); put(pot, M.lamp);
  const potBase = new THREE.CircleGeometry(4.2, 40); potBase.rotateX(-Math.PI / 2); potBase.translate(-46, DESK_TOP + 0.05, 24); put(potBase, M.lamp);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, r = 1.2 + (i % 3) * 0.9, L = 17 + rnd() * 5, lean = 0.06 + rnd() * 0.1;
    const pc = new THREE.CylinderGeometry(0.42, 0.42, L, 6); pc.translate(0, L / 2, 0); pc.rotateZ(Math.cos(a) * lean); pc.rotateX(Math.sin(a) * lean);
    pc.translate(-46 + Math.cos(a) * r, DESK_TOP + 0.6, 24 + Math.sin(a) * r); put(pc, i % 3 === 0 ? M.pencilStripe : i % 3 === 1 ? M.pencil : M.lamp);
  }
  // two monographs, the mug on top
  const BOOKS = V(-52, DESK_TOP, 0);
  const bk1 = new THREE.BoxGeometry(31, 3.6, 24); bk1.rotateY(0.12); bk1.translate(BOOKS.x, BOOKS.y + 1.8, BOOKS.z); worldUV(bk1); put(bk1, M.book1);
  const bk2 = new THREE.BoxGeometry(28, 3.0, 22); bk2.rotateY(-0.1); bk2.translate(BOOKS.x + 1, BOOKS.y + 5.1, BOOKS.z - 0.5); worldUV(bk2); put(bk2, M.book2);
  const mugP = V(-50, DESK_TOP + 6.6, 1);
  const lathe = new THREE.LatheGeometry([[0, 0], [3.6, 0], [3.9, 0.4], [4.05, 9.4], [4.15, 9.7], [3.75, 9.7], [3.6, 9.2], [3.45, 0.8], [0, 0.8]].map(([x, y]) => new THREE.Vector2(x, y)), 48);
  lathe.translate(mugP.x, mugP.y, mugP.z); put(lathe, M.mug);
  const coffee = new THREE.CircleGeometry(3.62, 40); coffee.rotateX(-Math.PI / 2); coffee.translate(mugP.x, mugP.y + 7.6, mugP.z); put(coffee, M.coffee, { cast: false });
  const hd = new THREE.TorusGeometry(2.3, 0.55, 14, 32, Math.PI * 1.15); hd.rotateZ(-Math.PI * 0.575); hd.rotateY(0.9); hd.translate(mugP.x + Math.cos(0.9) * 4.6, mugP.y + 5.0, mugP.z - Math.sin(0.9) * 4.6); put(hd, M.mug);
  // card offcuts near the model: window holes already cut out
  const off = (x, z, w, d, r, holes) => {
    const s = new THREE.Shape(); s.moveTo(-w / 2, -d / 2); s.lineTo(w / 2, -d / 2); s.lineTo(w / 2, d / 2); s.lineTo(-w / 2, d / 2); s.closePath();
    for (const [hx, hz, hw, hd2] of holes) { const p = new THREE.Path(); p.moveTo(hx, hz); p.lineTo(hx, hz + hd2); p.lineTo(hx + hw, hz + hd2); p.lineTo(hx + hw, hz); p.closePath(); s.holes.push(p); }
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.15, bevelEnabled: false }); geo.rotateX(-Math.PI / 2); geo.rotateY(r); geo.translate(x, MAT_TOP, z); put( withTreeCore(geo, 0.15), M.card);
  };
  off(52, 6, 14, 6.4, 0.3, [[-5.5, -1.6, 2.2, 3.0], [-2.4, -1.6, 2.2, 3.0], [0.7, -1.6, 2.2, 3.0]]);
  off(58, -8, 9, 4, -0.5, []);
  off(46, -18, 3.2, 12, 0.15, [[-0.9, -4, 1.8, 2.6]]);
  // the lamp
  const lamp = buildLamp(M, LAMP);
  g.add(lamp.group);
  // the studio walls, with the house's own drawings pinned to them
  const walls = studioWalls(M);
  g.add(walls);
  return { group: g, lamp, walls };
}

// An architect's balanced-arm lamp: weighted base, two arms of twin rods with springs, a conical shade.
export function buildLamp(M, L) {
  const g = new THREE.Group();
  const put = (geo, mat, opts) => { const m = mesh(geo, mat, opts); g.add(m); return m; };
  const rod = (a, b, r, mat = M.lamp) => { const d = b.clone().sub(a); const geo = new THREE.CylinderGeometry(r, r, d.length(), 12); geo.translate(0, d.length() / 2, 0); geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize())); geo.translate(a.x, a.y, a.z); return put(geo, mat); };
  const B = L.base, H = L.head;
  put(new THREE.CylinderGeometry(7.2, 7.8, 2.4, 56).translate(B.x, B.y + 1.2, B.z), M.lamp);
  put(new THREE.CylinderGeometry(2.2, 2.6, 2.2, 32).translate(B.x, B.y + 3.4, B.z), M.lamp);
  const P0 = B.clone().add(V(0, 5, 0));
  const hz = H.clone().sub(P0); hz.y = 0; const dir = hz.clone().normalize(); const side = V(-dir.z, 0, dir.x);
  const E = P0.clone().addScaledVector(dir, 9).add(V(0, 44, 0));
  const J = H.clone().addScaledVector(dir, 4.5).add(V(0, 4.5, 0)); // the joint behind the head
  for (const s of [-1.1, 1.1]) {
    rod(P0.clone().addScaledVector(side, s), E.clone().addScaledVector(side, s), 0.42);
    rod(E.clone().addScaledVector(side, s * 0.8), J.clone().addScaledVector(side, s * 0.8), 0.38);
  }
  // springs: helices along the lower arm
  const helix = (a, b, r, turns, off) => {
    const d = b.clone().sub(a), n = d.clone().normalize();
    const u = V(0, 1, 0).cross(n).normalize(), w = n.clone().cross(u);
    const pts = []; for (let i = 0; i <= turns * 12; i++) { const s = i / (turns * 12), an = s * turns * Math.PI * 2; pts.push(a.clone().addScaledVector(d, s).addScaledVector(u, Math.cos(an) * r).addScaledVector(w, Math.sin(an) * r).addScaledVector(side, off)); }
    put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 12, 0.09, 6, false), M.spring);
  };
  const sa = P0.clone().lerp(E, 0.12), sb = P0.clone().lerp(E, 0.55);
  helix(sa.clone().add(V(0, 0, 0)), sb, 0.55, 26, 2.4); helix(sa, sb, 0.55, 26, -2.4);
  put(new THREE.CylinderGeometry(0.9, 0.9, 3.4, 20).rotateX(Math.PI / 2).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), side)).translate(E.x, E.y, E.z), M.lamp);
  put(new THREE.CylinderGeometry(0.8, 0.8, 3.0, 20).rotateX(Math.PI / 2).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), side)).translate(J.x, J.y, J.z), M.lamp);
  // the head: a shade around the bulb, its axis along aim
  const aim = L.aimAt.clone().sub(H).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, -1, 0), aim);
  const prof = [[7.2, -7.0], [7.0, -6.6], [5.2, -2.6], [3.6, 1.2], [3.2, 3.2], [2.2, 4.0], [0.01, 4.2]].map(([x, y]) => new THREE.Vector2(x, y));
  const shade = new THREE.LatheGeometry(prof, 64); shade.applyQuaternion(q); shade.translate(H.x, H.y, H.z);
  put(shade, M.lamp);
  const inner = new THREE.LatheGeometry(prof.map((p) => new THREE.Vector2(p.x * 0.97, p.y - 0.05)), 64); inner.applyQuaternion(q); inner.translate(H.x, H.y, H.z);
  put(inner, M.lampInner, { cast: false });
  const rim = new THREE.TorusGeometry(7.1, 0.22, 10, 80); rim.rotateX(Math.PI / 2); rim.translate(0, -6.95, 0); rim.applyQuaternion(q); rim.translate(H.x, H.y, H.z); put(rim, M.lampRim, { cast: false });
  rod(J, H.clone().addScaledVector(aim, -3.6), 0.5);
  const bulbPos = H.clone().addScaledVector(aim, -0.6);
  const bulb = new THREE.SphereGeometry(2.3, 32, 20); bulb.scale(1, 1.15, 1); bulb.applyQuaternion(q); bulb.translate(bulbPos.x, bulbPos.y, bulbPos.z);
  const bulbMesh = put(bulb, M.bulb, { cast: false });
  g.traverse((o) => { if (o.isMesh && o !== bulbMesh) o.castShadow = true; });
  return { group: g, head: H, aim, bulbPos, aimAt: L.aimAt };
}

// ---------------------------------------------------------------- the studio walls and the drawings on them
export function sheetTexture(kind, trace) {
  const W = 1448, Hh = 1024;
  return canvasTex(W, Hh, (g) => drawSheet(g, W, Hh, kind, trace));
}
function drawSheet(g, W, H, kind, trace) {
  g.fillStyle = trace ? '#efe4b0' : '#efebe2'; g.fillRect(0, 0, W, H);
  blotches(g, Math.max(W, H), 30, trace ? 'rgba(160,140,80,0.05)' : 'rgba(120,110,95,0.04)', 40, 160);
  const ink = 'rgba(28,26,23,0.92)', thin = 'rgba(28,26,23,0.55)';
  g.strokeStyle = ink; g.lineWidth = 4; g.strokeRect(36, 36, W - 72, H - 72);
  // title block
  g.strokeRect(W - 360, H - 150, 324, 114); g.beginPath(); g.moveTo(W - 360, H - 106); g.lineTo(W - 36, H - 106); g.stroke();
  g.fillStyle = ink; g.font = '600 26px "Chakra Petch", sans-serif'; g.fillText({ plan: 'PLAN +0.00', section: 'SECTION A-A', elev: 'SOUTH ELEVATION', site: 'SITE PLAN', lower: 'PLAN -3.20' }[kind], W - 344, H - 120);
  g.font = '500 17px "IBM Plex Mono", monospace'; g.fillText('HOUSE ON A SLOPE  1:100', W - 344, H - 76); g.fillText('ATELIER 1:100  A-' + (200 + kind.length * 7), W - 344, H - 50);
  const parts = houseParts();
  const draw = (x0, x1, y0, y1, fn) => { // map a world rectangle into the sheet's drawing area
    const ax = 90, ay = 80, aw = W - 180, ah = H - 280;
    const k = Math.min(aw / (x1 - x0), ah / (y1 - y0));
    const ox = ax + (aw - (x1 - x0) * k) / 2, oy = ay + (ah - (y1 - y0) * k) / 2;
    fn((x) => ox + (x - x0) * k, (y) => oy + (y1 - y) * k, k);
  };
  if (kind === 'plan' || kind === 'lower') {
    const cut = kind === 'plan' ? 1.2 : -2.0;
    draw(-10, 26, -11, 6, (X, Y, k) => {
      const Z = (z) => Y(-z);
      for (const p of parts) { const b = p.b; if (b[1] > cut || b[4] < cut - 1.4) continue; if (p.k === 'struct' && b[4] <= cut) { g.strokeStyle = thin; g.lineWidth = 2.2; g.strokeRect(X(b[0]), Z(b[5]), (b[3] - b[0]) * k, (b[5] - b[2]) * k); } }
      for (const p of parts) {
        const b = p.b; if (!(b[1] < cut && b[4] > cut)) continue;
        if (p.k === 'glass') { g.strokeStyle = ink; g.lineWidth = 2.4; g.strokeRect(X(b[0]), Z(b[5]), Math.max(1, (b[3] - b[0]) * k), Math.max(1, (b[5] - b[2]) * k)); }
        else if (p.k === 'struct' || p.k === 'frame') { g.fillStyle = ink; g.fillRect(X(b[0]), Z(b[5]), (b[3] - b[0]) * k, (b[5] - b[2]) * k); }
        else if (p.k === 'furn') { g.strokeStyle = thin; g.lineWidth = 2.2; g.strokeRect(X(b[0]), Z(b[5]), (b[3] - b[0]) * k, (b[5] - b[2]) * k); }
      }
      for (const p of parts) if (p.k === 'stair') { const b = p.b; g.strokeStyle = thin; g.lineWidth = 2.2; g.strokeRect(X(b[0]), Z(b[5]), (b[3] - b[0]) * k, (b[5] - b[2]) * k); }
      g.fillStyle = ink; g.font = '500 15px "IBM Plex Mono", monospace';
      for (const [l, x] of [['A', 3.85], ['B', 11], ['C', 18.25]]) { g.beginPath(); g.arc(X(x), Z(-10.2), 13, 0, 7); g.stroke(); g.fillText(l, X(x) - 5, Z(-10.2) + 5); }
    });
  } else if (kind === 'section') {
    draw(-8, 30, -6, 9.5, (X, Y, k) => {
      g.fillStyle = 'rgba(28,26,23,0.12)';
      g.beginPath(); g.moveTo(X(-8), Y(0)); g.lineTo(X(3.7), Y(0)); g.lineTo(X(3.7), Y(-3.6)); g.lineTo(X(18.3), Y(-3.6)); g.lineTo(X(18.3), Y(-3.2)); g.lineTo(X(26), Y(-3.2)); g.lineTo(X(30), Y(-4.6)); g.lineTo(X(30), Y(-6)); g.lineTo(X(-8), Y(-6)); g.closePath(); g.fill();
      for (const p of parts) { const b = p.b; if (b[2] < 0 && b[5] <= 0 && (p.k === 'struct' || p.k === 'furn' || p.k === 'stair')) { g.strokeStyle = thin; g.lineWidth = 2.2; g.strokeRect(X(b[0]), Y(b[4]), (b[3] - b[0]) * k, (b[4] - b[1]) * k); } }
      for (const p of parts) { const b = p.b; if (b[2] < 0 && b[5] > 0 && p.k !== 'glass' && p.k !== 'land') { g.fillStyle = ink; g.fillRect(X(b[0]), Y(b[4]), (b[3] - b[0]) * k, (b[4] - b[1]) * k); } }
      g.strokeStyle = 'rgba(232,93,4,0.92)'; g.setLineDash([12, 8]); g.lineWidth = 2;
      g.beginPath(); g.moveTo(X(29), Y(9)); g.lineTo(X(8), Y(0.05)); g.stroke(); g.setLineDash([]);
    });
  } else if (kind === 'elev') {
    draw(-9, 5.5, -5, 9, (X, Y, k) => {
      const Zx = (z) => X(-z);
      const list = parts.filter((p) => p.k !== 'furn' && p.k !== 'land').sort((a, b) => a.b[3] - b.b[3]);
      for (const p of list) {
        const b = p.b, x = Zx(b[5]), y = Y(b[4]), w = (b[5] - b[2]) * k, h = (b[4] - b[1]) * k;
        if (p.k === 'glass') { g.fillStyle = 'rgba(120,140,150,0.18)'; g.fillRect(x, y, w, h); continue; }
        g.fillStyle = p.k === 'frame' ? ink : '#efebe2'; g.fillRect(x, y, w, h);
        g.strokeStyle = ink; g.lineWidth = 2.4; g.strokeRect(x, y, w, h);
      }
      g.strokeStyle = ink; g.lineWidth = 3; g.beginPath(); g.moveTo(Zx(9), Y(-3.2)); g.lineTo(Zx(-9), Y(-3.2)); g.stroke();
    });
  } else {
    draw(-14, 40, -20, 14, (X, Y, k) => {
      const Z = (z) => Y(-z);
      g.strokeStyle = thin; g.lineWidth = 2.4;
      for (const t of LAYER_TOPS) { g.beginPath(); for (let z = -20; z <= 14; z += 0.5) { const x = Math.min(40, Xof(t, z)); z === -20 ? g.moveTo(X(x), Z(z)) : g.lineTo(X(x), Z(z)); } g.stroke(); }
      g.save(); g.beginPath(); g.rect(X(3.7), Z(4), 14.6 * k, 12 * k); g.clip();
      g.strokeStyle = ink; g.lineWidth = 2; for (let i = -40; i < 60; i++) { g.beginPath(); g.moveTo(X(3.7) + i * 9, Z(4)); g.lineTo(X(3.7) + i * 9 + 12 * k, Z(4) + 12 * k); g.stroke(); }
      g.restore(); g.lineWidth = 4; g.strokeRect(X(3.7), Z(4), 14.6 * k, 12 * k);
      g.fillStyle = 'rgba(205,75,30,0.9)'; g.beginPath(); g.arc(X(32), Z(-14), 16, 0, 7); g.fill();
    });
  }
  grain(g, W, H, 8);
}
function studioWalls(M) {
  const g = new THREE.Group();
  const put = (geo, mat, opts = { cast: false }) => { const m = mesh(geo, mat, opts); g.add(m); return m; };
  const back = new THREE.PlaneGeometry(420, 260); back.rotateY(Math.PI / 2); back.translate(-72, 110, 60); put(back, M.wall);
  const side = new THREE.PlaneGeometry(420, 260); side.translate(130, 110, -84); put(side, M.wall);
  // the rest of the room, out of sight on the way down, but there when you look out of the house on the way back
  const front = new THREE.PlaneGeometry(420, 260); front.rotateY(-Math.PI / 2); front.translate(190, 110, 60); put(front, M.wall);
  const far = new THREE.PlaneGeometry(420, 260); far.rotateY(Math.PI); far.translate(130, 110, 150); put(far, M.wall);
  const ceil = new THREE.PlaneGeometry(420, 420); ceil.rotateX(Math.PI / 2); ceil.translate(60, 236, 30); put(ceil, M.wall);
  // drawings: [wall, u, v, width, kind, trace] — arranged so the card house roofline reads cleanly against the studio wall at eye-level
  const sheets = [['x', -54, 14, 52, 'section', false], ['x', 2, 18, 44, 'plan', false], ['x', 50, 14, 40, 'elev', true], ['x', 96, 15, 44, 'lower', false],
    ['x', 22, 60, 40, 'section', true], ['x', 72, 56, 36, 'plan', false],
    ['z', -40, 15, 48, 'elev', false], ['z', 12, 18, 40, 'plan', true], ['z', 62, 14, 44, 'site', false], ['z', -10, 58, 42, 'section', false],
    ['z', 114, 16, 46, 'plan', false], ['z', 88, 56, 40, 'elev', true],
    ['fx', -28, 18, 52, 'section', false], ['fx', 28, 16, 46, 'plan', true], ['fx', 82, 20, 48, 'site', false], ['fx', 4, 62, 44, 'elev', false]];
  for (const [wall, u, v, w, kind, trace] of sheets) {
    const h = w / 1.414, tex = sheetTexture(kind, trace);
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.94, envMapIntensity: 0.06 });
    const tilt = (rnd() - 0.5) * 0.025;
    const geo = new THREE.PlaneGeometry(w, h); geo.rotateZ(tilt);
    const pin = (du, dv) => { const p = new THREE.SphereGeometry(0.55, 12, 8); p.translate(du, dv, 0.5); return p; };
    const pins = mergeGeometries([pin(-w / 2 + 1.5, h / 2 - 1.5), pin(w / 2 - 1.5, h / 2 - 1.5)].map((p) => { p.rotateZ(tilt); return p; }));
    for (const [geo2, mat] of [[geo, m], [pins, M.pin]]) {
      if (wall === 'x') { geo2.rotateY(Math.PI / 2); geo2.translate(-71.6, v, u); }
      else if (wall === 'fx') { geo2.rotateY(-Math.PI / 2); geo2.translate(189.4, v, u); }
      else geo2.translate(u, v, -83.6);
      put(geo2, mat);
    }
  }
  return g;
}
