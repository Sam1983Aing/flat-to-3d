// The world: one house as a list of parts, each carrying the week it is built, on a site that is dug,
// filled and planted by the same calendar. Everything that draws (the sheet) and everything that renders
// (the site) reads the weeks from here. A part shows when its week has come: one uniform, uNow, builds the house.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- the programme
export const { WEEKS, PROG, TILES } = window.SEQ;
const PHASE = { 1: [3, 6], 2: [6, 9], 3: [9, 11], 4: [11, 14.5], 5: [13.5, 16], 6: [16, 21], 7: [21, 25], 8: [25, 38] };
export const BACKFILL = 9.5; // the pit is filled against the lower level walls

// ---------------------------------------------------------------- random, noise
let seed = 11;
export const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

function vnoise(size, cells) {
  const L = new Float32Array(cells * cells); for (let i = 0; i < L.length; i++) L[i] = rnd();
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const fy = y / size * cells, iy = Math.floor(fy); let ty = fy - iy; ty = ty * ty * (3 - 2 * ty);
    const y0 = (iy % cells) * cells, y1 = ((iy + 1) % cells) * cells;
    for (let x = 0; x < size; x++) {
      const fx = x / size * cells, ix = Math.floor(fx); let tx = fx - ix; tx = tx * tx * (3 - 2 * tx);
      const x0 = ix % cells, x1 = (ix + 1) % cells;
      const a = L[y0 + x0] + (L[y0 + x1] - L[y0 + x0]) * tx, b = L[y1 + x0] + (L[y1 + x1] - L[y1 + x0]) * tx;
      out[y * size + x] = a + (b - a) * ty;
    }
  }
  return out;
}
function fbm(size, cells, oct, gain = 0.5) {
  const out = new Float32Array(size * size); let amp = 1, tot = 0;
  for (let o = 0; o < oct; o++) { const n = vnoise(size, cells << o); for (let i = 0; i < out.length; i++) out[i] += n[i] * amp; tot += amp; amp *= gain; }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}
function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise2(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z); let fx = x - ix, fz = z - iz; fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

// ---------------------------------------------------------------- textures & bump maps
let MAX_ANISO = 8;
function canvasTex(size, tile, draw, linear = false) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d', { willReadFrequently: true }); draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / tile, 1 / tile);
  t.colorSpace = linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = MAX_ANISO;
  return t;
}
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function ramp(g, s, field, c0, c1, c2, grain = 10) {
  const img = g.createImageData(s, s), d = img.data;
  for (let i = 0; i < s * s; i++) {
    const v = field(i);
    const c = v < 0.5 ? mixc(c0, c1, v * 2) : mixc(c1, c2, (v - 0.5) * 2);
    const k = (rnd() - 0.5) * grain;
    d[i * 4] = c[0] + k; d[i * 4 + 1] = c[1] + k; d[i * 4 + 2] = c[2] + k; d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
function stones(g, s, n, r0, r1, cols, shadow = 0.35) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * s, y = rnd() * s, r = r0 + Math.pow(rnd(), 2.5) * (r1 - r0), a = rnd() * Math.PI, e = 0.55 + rnd() * 0.4;
    const col = cols[Math.floor(rnd() * cols.length)];
    for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) {
      const X = x + dx, Y = y + dy; if (X < -r1 * 2 || X > s + r1 * 2 || Y < -r1 * 2 || Y > s + r1 * 2) continue;
      g.fillStyle = `rgba(30,22,15,${shadow})`; g.beginPath(); g.ellipse(X + r * 0.25, Y + r * 0.35, r, r * e, a, 0, 7); g.fill();
      g.fillStyle = col; g.beginPath(); g.ellipse(X, Y, r, r * e, a, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,250,240,0.18)'; g.beginPath(); g.ellipse(X - r * 0.25, Y - r * 0.3, r * 0.5, r * 0.5 * e, a, 0, 7); g.fill();
    }
  }
}

export function makeTextures(renderer, phone) {
  MAX_ANISO = renderer.capabilities.getMaxAnisotropy();
  const S = phone ? 512 : 1024;
  const T = {};
  // site earth, compacted with aggregate and subtle track grooves
  T.soil = canvasTex(S, 3.0, (g, s) => {
    const a = fbm(s, 4, 5), b = fbm(s, 24, 3), c = fbm(s, 96, 2);
    ramp(g, s, (i) => clamp(0.5 + (a[i] - 0.5) * 1.5 + (b[i] - 0.5) * 0.75 + (c[i] - 0.5) * 0.55, 0, 1), [92, 78, 62], [134, 117, 96], [166, 149, 126], 15);
    stones(g, s, s * 2.6, s / 900, s / 170, ['#9d9384', '#b5ab9b', '#7f766a', '#c7bca8', '#685e52']);
  });
  T.soilBump = canvasTex(512, 3.0, (g, s) => {
    const a = fbm(s, 8, 4), b = fbm(s, 48, 3);
    ramp(g, s, (i) => clamp(0.5 + (a[i] - 0.5) * 1.4 + (b[i] - 0.5) * 0.9, 0, 1), [40, 40, 40], [128, 128, 128], [220, 220, 220], 24);
  }, true);
  // cut subsoil clay: stratified warm earth
  T.clay = canvasTex(S, 2.8, (g, s) => {
    const a = fbm(s, 3, 5), b = fbm(s, 20, 3), c = fbm(s, 80, 2);
    ramp(g, s, (i) => {
      const y = Math.floor(i / s) / s;
      const strata = Math.sin(y * Math.PI * 16 + a[i] * 4) * 0.08;
      return clamp(0.5 + (a[i] - 0.5) * 1.3 + (b[i] - 0.5) * 0.85 + (c[i] - 0.5) * 0.5 + strata, 0, 1);
    }, [116, 88, 60], [156, 121, 84], [188, 154, 114], 12);
    stones(g, s, s * 1.1, s / 700, s / 130, ['#a8957c', '#8d7a63', '#c2ad8e'], 0.4);
  });
  // Mediterranean slope grass
  T.grass = canvasTex(S, 3.8, (g, s) => {
    const a = fbm(s, 4, 4), b = fbm(s, 28, 3);
    ramp(g, s, (i) => clamp(0.5 + (a[i] - 0.5) * 1.35 + (b[i] - 0.5) * 0.75, 0, 1), [84, 96, 56], [122, 128, 80], [158, 152, 104], 10);
    const n = s * s / 60;
    for (let i = 0; i < n; i++) {
      const x = rnd() * s, y = rnd() * s, l = s / 320 + rnd() * s / 130, ang = -Math.PI / 2 + (rnd() - 0.5) * 1.1;
      g.strokeStyle = rnd() < 0.55 ? `rgba(55,68,34,${0.25 + rnd() * 0.3})` : `rgba(198,188,136,${0.2 + rnd() * 0.28})`;
      g.lineWidth = 0.6 + rnd() * 0.9; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * l, y + Math.sin(ang) * l); g.stroke();
    }
  });
  // fair-faced architectural concrete, cast against 150 mm boards, tie holes on 600 mm grid + bump map
  T.conc = canvasTex(S, 2.4, (g, s) => {
    const a = fbm(s, 4, 4), b = fbm(s, 48, 2);
    ramp(g, s, (i) => clamp(0.5 + (a[i] - 0.5) * 0.65 + (b[i] - 0.5) * 0.4, 0, 1), [172, 169, 162], [189, 186, 179], [204, 201, 194], 8);
    const rows = 16, h = s / rows;
    for (let r = 0; r < rows; r++) {
      g.fillStyle = `rgba(${rnd() < 0.5 ? '70,66,60' : '240,236,228'},${0.025 + rnd() * 0.045})`; g.fillRect(0, r * h, s, h);
      g.fillStyle = 'rgba(55,52,46,0.20)'; g.fillRect(0, r * h, s, 1.3);
      g.fillStyle = 'rgba(245,242,235,0.14)'; g.fillRect(0, r * h + 1.3, s, 1.0);
      for (let k = 0; k < 7; k++) { g.fillStyle = `rgba(60,56,50,${0.025 + rnd() * 0.035})`; g.fillRect(0, r * h + rnd() * h, s, 1); }
    }
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const cx = (i + 0.5) * s / 4, cy = (j + 0.5) * s / 4;
      g.fillStyle = 'rgba(130,126,118,0.45)'; g.beginPath(); g.arc(cx, cy, s / 150, 0, 7); g.fill();
      g.fillStyle = 'rgba(42,39,35,0.65)'; g.beginPath(); g.arc(cx, cy, s / 240, 0, 7); g.fill();
    }
  });
  T.concBump = canvasTex(512, 2.4, (g, s) => {
    const a = fbm(s, 6, 3);
    ramp(g, s, (i) => clamp(0.5 + (a[i] - 0.5) * 0.5, 0, 1), [110, 110, 110], [135, 135, 135], [160, 160, 160], 10);
    const rows = 16, h = s / rows;
    for (let r = 0; r < rows; r++) {
      g.fillStyle = '#404040'; g.fillRect(0, r * h, s, 1.5);
      g.fillStyle = '#b0b0b0'; g.fillRect(0, r * h + 1.5, s, 1.2);
      for (let k = 0; k < 5; k++) { g.fillStyle = 'rgba(80,80,80,0.35)'; g.fillRect(0, r * h + rnd() * h, s, 1); }
    }
    g.fillStyle = '#181818';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.beginPath(); g.arc((i + 0.5) * s / 4, (j + 0.5) * s / 4, s / 200, 0, 7); g.fill(); }
  }, true);

  // European wide-plank oak flooring: even warm honey tone, natural grain + bump map
  T.oak = canvasTex(S, 3.2, (g, s) => {
    const rows = 14, h = s / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rnd() * s * 0.4;
      while (x < s) {
        const L = s * (0.45 + rnd() * 0.45), v = (rnd() - 0.5) * 2;
        g.fillStyle = `hsl(${31 + v * 1.8}, ${34 + v * 3}%, ${59 + v * 3.2}%)`;
        g.fillRect(x, r * h, L, h);
        for (let k = 0; k < 14; k++) {
          const gy = r * h + (k + 0.5) / 14 * h;
          g.fillStyle = `rgba(95, 60, 28, ${0.03 + rnd() * 0.045})`;
          g.fillRect(x, gy, L, 1 + rnd() * 1.2);
        }
        g.fillStyle = 'rgba(65, 42, 20, 0.32)'; g.fillRect(x, r * h, 1.2, h);
        x += L;
      }
      g.fillStyle = 'rgba(65, 42, 20, 0.28)'; g.fillRect(0, r * h, s, 1.2);
      g.fillStyle = 'rgba(235, 210, 175, 0.12)'; g.fillRect(0, r * h + 1.2, s, 1.0);
    }
  });
  T.oakBump = canvasTex(512, 3.2, (g, s) => {
    g.fillStyle = '#888'; g.fillRect(0, 0, s, s);
    const rows = 14, h = s / rows;
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < 12; k++) { g.fillStyle = 'rgba(60,60,60,0.35)'; g.fillRect(0, r * h + rnd() * h, s, 1); }
      g.fillStyle = '#222'; g.fillRect(0, r * h, s, 1.5);
    }
  }, true);

  // Honed Roman travertine stone
  T.travertine = canvasTex(512, 1.8, (g, s) => {
    const a = fbm(s, 6, 4), b = fbm(s, 32, 2);
    ramp(g, s, (i) => {
      const y = Math.floor(i / s) / s;
      const vein = Math.sin(y * Math.PI * 18 + a[i] * 5.5) * 0.14;
      return clamp(0.5 + (a[i] - 0.5) * 0.65 + (b[i] - 0.5) * 0.35 + vein, 0, 1);
    }, [198, 184, 162], [218, 206, 186], [234, 225, 208], 7);
    for (let i = 0; i < 180; i++) {
      g.fillStyle = `rgba(130, 114, 92, ${0.12 + rnd() * 0.18})`;
      g.fillRect(rnd() * s, rnd() * s, 3 + rnd() * 14, 1 + rnd() * 2);
    }
  });
  // Architectural walnut veneer
  T.walnut = canvasTex(512, 1.6, (g, s) => {
    const a = fbm(s, 4, 3);
    ramp(g, s, (i) => clamp(0.5 + (a[i] - 0.5) * 0.7, 0, 1), [72, 46, 29], [92, 61, 39], [112, 76, 50], 6);
    for (let i = 0; i < 140; i++) {
      g.fillStyle = `rgba(42, 24, 12, ${0.08 + rnd() * 0.12})`;
      g.fillRect(0, rnd() * s, s, 1 + rnd() * 2);
    }
  });
  // Woven bouclé / architectural linen textile
  T.linen = canvasTex(256, 0.45, (g, s) => {
    const a = fbm(s, 8, 2);
    ramp(g, s, (i) => clamp(0.5 + (a[i] - 0.5) * 0.35, 0, 1), [212, 203, 188], [224, 216, 202], [235, 228, 216], 12);
    for (let y = 0; y < s; y += 3) { g.fillStyle = 'rgba(120,108,92,0.08)'; g.fillRect(0, y, s, 1); }
    for (let x = 0; x < s; x += 3) { g.fillStyle = 'rgba(255,250,242,0.08)'; g.fillRect(x, 0, 1, s); }
  });
  T.linenBump = canvasTex(256, 0.45, (g, s) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 2) { g.fillStyle = y % 4 === 0 ? '#a8a8a8' : '#585858'; g.fillRect(0, y, s, 1); }
    for (let x = 0; x < s; x += 2) { g.fillStyle = x % 4 === 0 ? 'rgba(210,210,210,0.5)' : 'rgba(40,40,40,0.5)'; g.fillRect(x, 0, 1, s); }
  }, true);

  T.pave = canvasTex(512, 2.4, (g, s) => {
    const a = fbm(s, 6, 3);
    ramp(g, s, (i) => clamp(0.5 + (a[i] - 0.5) * 0.85, 0, 1), [196, 186, 168], [214, 205, 189], [228, 221, 207], 8);
    g.fillStyle = 'rgba(85,74,58,0.38)';
    for (let r = 0; r < 4; r++) g.fillRect(0, r * s / 4, s, 1.5);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) g.fillRect(c * s / 2 + (r % 2) * s / 4, r * s / 4, 1.5, s / 4);
  });
  // Large architectural canvas painting
  T.canvas = (() => {
    const c = document.createElement('canvas'); c.width = 520; c.height = 700; const g = c.getContext('2d');
    g.fillStyle = '#ede6d8'; g.fillRect(0, 0, 520, 700);
    g.fillStyle = '#c85a28'; g.fillRect(56, 310, 408, 330);
    g.fillStyle = '#d9a152'; g.beginPath(); g.arc(300, 245, 148, 0, 7); g.fill();
    g.fillStyle = '#ede6d8'; g.beginPath(); g.arc(170, 310, 62, 0, Math.PI); g.fill();
    g.fillStyle = '#23211e'; g.fillRect(396, 68, 20, 572);
    g.strokeStyle = '#23211e'; g.lineWidth = 3; g.strokeRect(56, 68, 408, 572);
    g.globalAlpha = 0.14; for (let i = 0; i < 3000; i++) { g.fillStyle = rnd() < 0.5 ? '#000' : '#fff'; g.fillRect(rnd() * 520, rnd() * 700, 1, 1); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MAX_ANISO; return t;
  })();
  T.rug = canvasTex(512, 1.1, (g, s) => {
    const a = fbm(s, 8, 3);
    ramp(g, s, (i) => clamp(0.5 + (a[i] - 0.5) * 0.5, 0, 1), [196, 184, 164], [210, 199, 180], [222, 213, 196], 18);
    for (let y = 0; y < s; y += 3) { g.fillStyle = 'rgba(78,64,46,0.07)'; g.fillRect(0, y, s, 1.5); }
  });
  T.concFresh = canvasTex(512, 2.4, (g, s) => {
    const a = fbm(s, 4, 4), b = fbm(s, 40, 2);
    ramp(g, s, (i) => clamp(0.5 + (a[i] - 0.5) * 0.75 + (b[i] - 0.5) * 0.45, 0, 1), [176, 172, 164], [194, 190, 182], [208, 205, 198], 10);
    for (let y = 0; y < s; y += s / 8) { g.fillStyle = 'rgba(60,55,50,0.08)'; g.fillRect(0, y, s, 1); }
  });
  // Industrial heavy machinery finish: weathered ochre-yellow with panel seams & grime
  T.machine = canvasTex(512, 1.6, (g, s) => {
    const a = fbm(s, 6, 3);
    ramp(g, s, (i) => clamp(0.5 + (a[i] - 0.5) * 0.35, 0, 1), [204, 142, 22], [222, 160, 30], [235, 176, 44], 8);
    g.strokeStyle = 'rgba(40,32,18,0.28)'; g.lineWidth = 2;
    g.strokeRect(12, 12, s - 24, s - 24);
    g.beginPath(); g.moveTo(0, s * 0.5); g.lineTo(s, s * 0.5); g. moveTo(s * 0.5, 0); g.lineTo(s * 0.5, s); g.stroke();
  });
  // Fine high-density safety debris mesh (no giant LEGO holes)
  T.net = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#df5618'; g.fillRect(0, 0, 128, 128);
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
    for (let y = 10; y < 120; y += 8) {
      for (let x = (y % 16 === 10 ? 4 : 8); x < 128; x += 8) {
        g.beginPath(); g.rect(x - 2.2, y - 2.2, 4.4, 4.4); g.fill();
      }
    }
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#c8460e'; g.fillRect(0, 0, 128, 8); g.fillRect(0, 120, 128, 8);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MAX_ANISO; return t;
  })();
  // Welded wire Heras fencing mesh
  T.wire = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
    g.clearRect(0, 0, 64, 128); g.fillStyle = '#c4c7c4';
    for (let x = 0; x < 64; x += 32) g.fillRect(x, 0, 2.5, 128);
    for (let y = 0; y < 128; y += 16) g.fillRect(0, y, 64, 2.5);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MAX_ANISO; return t;
  })();
  return T;
}

// ---------------------------------------------------------------- the land
export function natural(x, z) {
  let y = -3.2 * smooth(4.2, 18.5, x);        // the court at 0 down to the garden at -3.20
  y += -2.5 * smooth(26, 46, x);               // on down to the olives
  y += -16 * smooth(46, 260, x);               // and the valley
  y += 22 * smooth(-30, -260, x);              // the hill behind the court
  y += 60 * smooth(420, 1300, x);              // the ridge across the valley
  y += 30 * smooth(300, 1400, -x) * (0.6 + 0.4 * Math.sin(z * 0.004));
  const far = smooth(34, 140, Math.hypot(x - 12, (z + 2) * 1.2));
  y += far * (2.6 * Math.sin(z * 0.021 + 1.3) + 1.6 * Math.sin(x * 0.017 + z * 0.011) + 0.8 * Math.sin(z * 0.07 - x * 0.03) + 1.2 * (noise2(x * 0.03, z * 0.03) - 0.5));
  return y;
}
const HEAP = [-6.5, 10.5, 3.6, 2.1];
export function heapH(x, z) {
  const d = Math.hypot((x - HEAP[0]) * 1.0, (z - HEAP[1]) * 1.25) / HEAP[2];
  if (d >= 1) return 0;
  const k = Math.cos(d * Math.PI / 2); return HEAP[3] * k * k * (1 + 0.12 * (noise2(x * 1.3, z * 1.3) - 0.5)) * Math.min(1, (1 - d) * 6);
}
export const PIT = { x0: 2.6, x1: 20.4, z0: -9.6, z1: 5.6, y: -4.3, k: 1.15 };
export function pitY(x, z) {
  const dx = Math.max(PIT.x0 - x, 0, x - PIT.x1), dz = Math.max(PIT.z0 - z, 0, z - PIT.z1);
  const y = PIT.y + Math.hypot(dx, dz) * PIT.k;
  const rz = Math.max(Math.abs(z) - 2.2, 0);
  const ramp = PIT.y + Math.max(0, x - PIT.x1) * 0.19 + Math.hypot(Math.max(PIT.x0 - x, 0), rz) * PIT.k + rz * (x > PIT.x1 ? PIT.k : 0);
  return Math.min(y, ramp);
}
const ruts = (x, z) => 0.03 * (noise2(x * 0.9, z * 0.9) - 0.5) + 0.018 * (noise2(x * 3.1, z * 3.1) - 0.5);

// ---------------------------------------------------------------- drawing materials (the sheet)
export const PAPER = new THREE.Color('#f2efe7');
export const INK = new THREE.Color('#1d1c19');
export const ACCENT = new THREE.Color('#e85d04');
export const U = {
  uNow: { value: 99 }, uNewFrom: { value: 99 }, uTintOn: { value: 1 },
  uBlock: { value: new THREE.Vector4(-10, -20, 34, 14) },
  uPaper: { value: new THREE.Vector3(0xf2 / 255, 0xef / 255, 0xe7 / 255) },
  uInk: { value: new THREE.Vector3(0x1d / 255, 0x1c / 255, 0x19 / 255) },
  uTint: { value: new THREE.Vector3(0xf0 / 255, 0xd8 / 255, 0xc4 / 255) },
  real: { value: 6 },
};
const DRAW_VS = `
  attribute float aWeek; attribute float aOut;
  varying float vWeek; varying float vOut; varying vec3 vW; varying vec3 vV;
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.); vW = wp.xyz; vWeek = aWeek; vOut = aOut;
    vec4 mv = viewMatrix * wp; vV = mv.xyz; gl_Position = projectionMatrix * mv;
  }`;
const DRAW_HEAD = `
  uniform float uNow, uNewFrom, uTintOn, uClip, uContour, uHatch, uWeight; uniform vec4 uBlock; uniform vec3 uPaper, uInk, uTint;
  varying float vWeek; varying float vOut; varying vec3 vW; varying vec3 vV;
  bool gone(){
    if (vWeek > uNow + 1e-4) return true;
    if (vOut > .5 && uNow >= vOut) return true;
    if (uClip > .5 && (vW.x < uBlock.x || vW.x > uBlock.z || vW.z < uBlock.y || vW.z > uBlock.w)) return true;
    return false;
  }`;
function drawMat(kind, o = {}) {
  const uniforms = {
    uNow: U.uNow, uNewFrom: U.uNewFrom, uBlock: U.uBlock, uPaper: U.uPaper, uInk: U.uInk, uTint: U.uTint,
    uTintOn: o.tint === false ? { value: 0 } : U.uTintOn, uClip: { value: o.clip ? 1 : 0 },
    uContour: { value: o.contour ? 1 : 0 }, uHatch: { value: o.hatch ? 1 : 0 }, uWeight: { value: o.weight ?? 1.0 },
  };
  const fs = kind === 'nd' ? `${DRAW_HEAD}
    void main(){
      if (gone()) discard;
      vec3 n = normalize(cross(dFdx(vV), dFdy(vV)));
      gl_FragColor = vec4(n.xy * .5 + .5, uWeight, 1.);
    }` : `${DRAW_HEAD}
    float lines(float f, float wid){ float w = max(fwidth(f), 1e-5); float d = abs(fract(f + .5) - .5); return 1. - smoothstep(w * (wid - .5), w * (wid + .5), d); }
    void main(){
      if (gone()) discard;
      vec3 c = uPaper;
      if (uTintOn > .5 && vWeek > uNewFrom + 1e-3) c = uTint;
      if (uContour < .5 && uHatch < .5) {
        vec3 wn = normalize(cross(dFdx(vW), dFdy(vW)));
        float shade = clamp((wn.z * 0.5 - wn.x * 0.45) * 0.032, -0.02, 0.028);
        c -= shade;
      }
      if (uContour > .5) {
        float k = lines((vW.y - .25) / .5, .9) * .28 + lines((vW.y - .25) / 2.5, 1.45) * .34;
        c = mix(c, uInk, clamp(k, 0., .62));
      }
      if (uHatch > .5) c = mix(c, uInk, lines((vW.x + vW.y + vW.z) / 1.1, 1.0) * .45);
      gl_FragColor = vec4(c, clamp((vWeek + 2.) / 42., 0., 1.));
    }`;
  return new THREE.ShaderMaterial({ uniforms, vertexShader: DRAW_VS, fragmentShader: fs, side: THREE.DoubleSide });
}
export const DM = {
  paper: drawMat('paper'),
  nd: drawMat('nd', { weight: 1.0 }),
  ndFrame: drawMat('nd', { weight: 0.52 }),
  ndProp: drawMat('nd', { weight: 0.58 }),
  ndFurn: drawMat('nd', { weight: 0.34 }),
  land: drawMat('paper', { clip: true, contour: true, tint: false }),
  landNew: drawMat('paper', { clip: true, contour: true }),
  ndLand: drawMat('nd', { clip: true, weight: 0.85 }),
  hatch: drawMat('paper', { hatch: true }),
};

// ---------------------------------------------------------------- real materials
let ENV = null;
const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.88, metalness: 0, envMap: ENV, envMapIntensity: 0.32 }, o));
const WEEKLY = (s) => {
  s.uniforms.uNow = U.real;
  s.vertexShader = s.vertexShader.replace('void main() {', 'uniform float uNow; attribute float aWeek; attribute float aOut; varying float vWk; varying float vOt;\nvoid main() {\n  vWk = aWeek; vOt = aOut;');
  s.fragmentShader = s.fragmentShader.replace('void main() {', 'uniform float uNow; varying float vWk; varying float vOt;\nvoid main() {\n  if (vWk > uNow + 1e-4 || (vOt > .5 && uNow >= vOt)) discard;');
};
export function weekly(m) { m.onBeforeCompile = WEEKLY; m.customProgramCacheKey = () => 'weekly'; return m; }
export const DEPTH_WEEKLY = weekly(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));

export function makeMaterials(T, env) {
  ENV = env;
  const R = {
    concFresh: std({ map: T.concFresh, bumpMap: T.concBump, bumpScale: 0.012, roughness: 0.82 }),
    conc: std({ map: T.conc, bumpMap: T.concBump, bumpScale: 0.015, roughness: 0.78 }),
    oak: std({ map: T.oak, bumpMap: T.oakBump, bumpScale: 0.008, roughness: 0.42, envMapIntensity: 0.52 }),
    floorL: std({ map: T.travertine, roughness: 0.5 }),
    plaster: std({ color: 0xede8df, roughness: 0.92 }),
    gravel: std({ color: 0x8f8a82, roughness: 0.98 }),
    pave: std({ map: T.pave, bumpMap: T.concBump, bumpScale: 0.01, roughness: 0.8 }),
    sofa: std({ map: T.linen, bumpMap: T.linenBump, bumpScale: 0.006, roughness: 0.9, envMapIntensity: 0.18 }),
    sofaDark: std({ color: 0xb7a892, bumpMap: T.linenBump, bumpScale: 0.005, roughness: 0.9 }),
    rugM: std({ map: T.rug, bumpMap: T.linenBump, bumpScale: 0.012, roughness: 0.98, envMapIntensity: 0.1 }),
    travertine: std({ map: T.travertine, bumpMap: T.concBump, bumpScale: 0.006, roughness: 0.48, envMapIntensity: 0.4 }),
    cushionA: std({ color: 0xb85228, bumpMap: T.linenBump, bumpScale: 0.005, roughness: 0.88 }),
    cushionB: std({ color: 0xcba466, bumpMap: T.linenBump, bumpScale: 0.005, roughness: 0.88 }),
    cushionC: std({ color: 0xe6dfd2, bumpMap: T.linenBump, bumpScale: 0.005, roughness: 0.92 }),
    brass: std({ color: 0xc29b61, metalness: 0.92, roughness: 0.26, envMapIntensity: 1.0 }),
    ceramic: std({ color: 0xefe9de, roughness: 0.28, envMapIntensity: 0.45 }),
    terracotta: std({ color: 0xad623e, roughness: 0.82 }),
    art: std({ map: T.canvas, roughness: 0.85, envMapIntensity: 0.12 }),
    sheer: std({ color: 0xf1ece0, roughness: 0.96, side: THREE.DoubleSide, envMapIntensity: 0.12 }),
    shade: std({ color: 0xfff5e0, emissive: 0xffc885, emissiveIntensity: 0, roughness: 0.5 }),
    soilPot: std({ color: 0x3b2f25, roughness: 1 }),
    ink: std({ color: 0x1f1e1c, roughness: 0.42, metalness: 0.2 }),
    steel: std({ color: 0x242422, metalness: 0.68, roughness: 0.38, envMapIntensity: 0.55 }),
    glass: new THREE.MeshBasicMaterial({ color: 0xcfe2e6, envMap: env, combine: THREE.MixOperation, reflectivity: 0.26, transparent: true, opacity: 0.09, depthWrite: false }),
    fabric: std({ map: T.linen, roughness: 0.9 }),
    rug: std({ color: 0xb9a88e }),
    walnut: std({ map: T.walnut, bumpMap: T.oakBump, bumpScale: 0.006, roughness: 0.48, envMapIntensity: 0.42 }),
    leather: std({ color: 0x824829, bumpMap: T.linenBump, bumpScale: 0.003, roughness: 0.46, envMapIntensity: 0.48 }),
    linen: std({ map: T.linen, bumpMap: T.linenBump, bumpScale: 0.005, roughness: 0.9 }),
    stone: std({ map: T.travertine, roughness: 0.32, envMapIntensity: 0.45 }),
    white: std({ color: 0xf4f2ee, roughness: 0.25 }),
    mirror: std({ color: 0xffffff, metalness: 1, roughness: 0.02, envMapIntensity: 1.2 }),
    teak: std({ map: T.oak, color: 0xc29a72, roughness: 0.62 }),
    book0: std({ color: 0x8e3b2a, roughness: 0.6 }),
    book1: std({ color: 0x2f4a5a, roughness: 0.6 }),
    book2: std({ color: 0xd8cfb8, roughness: 0.6 }),
    book3: std({ color: 0x5c6b4a, roughness: 0.6 }),
    book4: std({ color: 0x1f1e1c, roughness: 0.6 }),
    ply: std({ color: 0xc49866, bumpMap: T.oakBump, bumpScale: 0.005, roughness: 0.82 }),
    prop: std({ color: 0xdba028, roughness: 0.46, metalness: 0.35, envMapIntensity: 0.45 }),
    yellow: std({ map: T.machine, bumpMap: T.concBump, bumpScale: 0.004, roughness: 0.38, metalness: 0.22, envMapIntensity: 0.65 }),
    dark: std({ color: 0x383b3f, roughness: 0.46, metalness: 0.42, envMapIntensity: 0.65 }),
    rubber: std({ color: 0x2a2b2d, roughness: 0.65, metalness: 0.35, envMapIntensity: 0.45 }),
    chrome: std({ color: 0xe6e8ea, metalness: 0.98, roughness: 0.12, envMapIntensity: 1.2 }),
    cabGlass: new THREE.MeshBasicMaterial({ color: 0x8cb0bd, envMap: env, combine: THREE.MixOperation, reflectivity: 0.45, transparent: true, opacity: 0.34, depthWrite: false }),
    beacon: std({ color: 0xff6d00, emissive: 0xe85d04, emissiveIntensity: 0.6, roughness: 0.2 }),
    rebar: std({ color: 0x563826, roughness: 0.7, metalness: 0.38 }),
    cap: std({ color: 0xe85d04, roughness: 0.45 }),
    timber: std({ map: T.oak, color: 0xc8a276, roughness: 0.85 }),
    galv: std({ color: 0xc4c6c4, metalness: 0.62, roughness: 0.42, envMapIntensity: 0.45 }),
    wire: std({ map: T.wire, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.48 }),
    net: std({ map: T.net, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.65, envMapIntensity: 0.15 }),
    block: std({ map: T.conc, color: 0xa8a59e, roughness: 0.9 }),
    blinding: std({ map: T.concFresh, color: 0x96938c, roughness: 0.92 }),
    cabin: std({ color: 0xe8e5de, roughness: 0.55 }),
    cabinTrim: std({ color: 0x2f363b, roughness: 0.55 }),
    leaf: std({ color: 0x677542, roughness: 0.85, flatShading: true }),
    leafDark: std({ color: 0x3b4829, roughness: 0.85, flatShading: true }),
    olive: std({ color: 0x6c7a4f, roughness: 0.85, flatShading: true }),
    bark: std({ color: 0x5a4f43, roughness: 0.96 }),
  };
  for (const k in R) weekly(R[k]);
  return R;
}

// ---------------------------------------------------------------- geometry helpers
export function stamp(geo, week, out = 0) {
  const p = geo.attributes.position, n = p.count, a = new Float32Array(n), o = new Float32Array(n);
  for (let i = 0; i < n; i++) { a[i] = typeof week === 'function' ? week(p.getX(i), p.getY(i), p.getZ(i)) : week; o[i] = typeof out === 'function' ? out(p.getX(i), p.getY(i), p.getZ(i)) : out; }
  geo.setAttribute('aWeek', new THREE.BufferAttribute(a, 1)); geo.setAttribute('aOut', new THREE.BufferAttribute(o, 1));
  return geo;
}
export function worldUV(g) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (ax >= ay && ax >= az) { uv[i * 2] = z; uv[i * 2 + 1] = y; } else if (ay >= az) { uv[i * 2] = x; uv[i * 2 + 1] = z; } else { uv[i * 2] = x; uv[i * 2 + 1] = y; }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
export const merge = (list) => mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)));
export function addMesh(group, geo, sets, o = {}) {
  const m = new THREE.Mesh(geo, sets.main || sets.paper || sets.nd);
  m.userData.sets = sets; m.castShadow = o.shadow !== false && !!sets.main; m.receiveShadow = true;
  if (sets.main) m.customDepthMaterial = DEPTH_WEEKLY;
  if (o.glass) m.userData.glass = true;
  m.frustumCulled = o.cull ?? true;
  group.add(m); return m;
}

// ---------------------------------------------------------------- the house as a list of parts
// Levels: garden -3.20, entrance 0.00, study 3.20, roof 6.40. The house spans x 3.7 to 18.3, z -8 to 4.
function houseParts() {
  const P = [];
  const box = (x0, y0, z0, x1, y1, z1, m, k = 'struct', ph = 2) => P.push({ b: [x0, y0, z0, x1, y1, z1], m, k, ph });
  const carve = (a0, a1, b0, b1, holes) => {
    const cuts = [...new Set([a0, a1, ...holes.flatMap((h) => [h[0], h[1]])].filter((v) => v >= a0 && v <= a1))].sort((p, q) => p - q);
    const out = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const p0 = cuts[i], p1 = cuts[i + 1], mid = (p0 + p1) / 2;
      const hs = holes.filter((h) => h[0] < mid && h[1] > mid).map((h) => [h[2], h[3]]).sort((p, q) => p[0] - q[0]);
      let y = b0;
      for (const [q0, q1] of hs) { if (q0 > y) out.push([p0, p1, y, q0]); y = Math.max(y, q1); }
      if (y < b1) out.push([p0, p1, y, b1]);
    }
    return out;
  };
  const wall = (axis, t0, t1, a0, a1, b0, b1, holes, m, ph) => {
    for (const [p0, p1, q0, q1] of carve(a0, a1, b0, b1, holes)) axis === 'x' ? box(t0, q0, p0, t1, q1, p1, m, 'struct', ph) : box(p0, q0, t0, p1, q1, t1, m, 'struct', ph);
    for (const h of holes) {
      const tm = (t0 + t1) / 2, f = 0.04;
      if (axis === 'x') {
        if (h[3] - h[2] > 2.3 && h[2] <= b0 + 0.01) continue; // doors stay open
        box(tm - 0.035, h[2], h[0], tm + 0.035, h[2] + f, h[1], 'steel', 'frame', 7); box(tm - 0.035, h[3] - f, h[0], tm + 0.035, h[3], h[1], 'steel', 'frame', 7);
        box(tm - 0.035, h[2] + f, h[0], tm + 0.035, h[3] - f, h[0] + f, 'steel', 'frame', 7); box(tm - 0.035, h[2] + f, h[1] - f, tm + 0.035, h[3] - f, h[1], 'steel', 'frame', 7);
        box(tm - 0.01, h[2] + f, h[0] + f, tm + 0.01, h[3] - f, h[1] - f, 'glass', 'glass', 7);
      } else {
        box(h[0], h[2], tm - 0.035, h[1], h[2] + f, tm + 0.035, 'steel', 'frame', 7); box(h[0], h[3] - f, tm - 0.035, h[1], h[3], tm + 0.035, 'steel', 'frame', 7);
        box(h[0], h[2] + f, tm - 0.035, h[0] + f, h[3] - f, tm + 0.035, 'steel', 'frame', 7); box(h[1] - f, h[2] + f, tm - 0.035, h[1], h[3] - f, tm + 0.035, 'steel', 'frame', 7);
        if (h[1] - h[0] > 3) { const m = (h[0] + h[1]) / 2; box(m - 0.02, h[2] + f, tm - 0.035, m + 0.02, h[3] - f, tm + 0.035, 'steel', 'frame', 7); }
        box(h[0] + f, h[2] + f, tm - 0.01, h[1] - f, h[3] - f, tm + 0.01, 'glass', 'glass', 7);
      }
    }
  };
  const SL = { all: 'conc', top: 'floorL', bot: 'plaster' }, SG = { all: 'conc', top: 'oak', bot: 'plaster' };
  // footings (non-overlapping corners)
  box(3.1, -4.3, -8.4, 4.6, -3.6, 4.4, 'conc', 'struct', 1);
  box(17.7, -4.3, -8.4, 18.9, -3.6, 4.4, 'conc', 'struct', 1);
  box(4.6, -4.3, -8.4, 17.7, -3.6, -7.4, 'conc', 'struct', 1);
  box(4.6, -4.3, 3.4, 17.7, -3.6, 4.4, 'conc', 'struct', 1);
  // slabs (strictly bounded inside outer walls to prevent coplanar Z-fighting)
  box(4.0, -3.6, -7.7, 18.3, -3.2, 3.7, SL, 'struct', 2);
  box(4.0, -0.35, -6.4, 18.3, 0, 3.7, SG, 'struct', 3);
  box(4.0, -0.35, -7.7, 5.5, 0, -6.4, SG, 'struct', 3);
  box(10.3, -0.35, -7.7, 18.3, 0, -6.4, SG, 'struct', 3);
  box(18.3, -0.35, -8.0, 22.5, 0, 1.5, { all: 'conc', top: 'pave' }, 'struct', 3);
  box(4.0, 2.85, -6.4, 11.0, 3.2, 3.7, SG, 'struct', 5);
  box(4.0, 2.85, -7.7, 5.5, 3.2, -6.4, SG, 'struct', 5);
  box(10.3, 2.85, -7.7, 11.0, 3.2, -6.4, SG, 'struct', 5);
  // roof slabs and clerestory (non-overlapping segments)
  const RF = { all: 'conc', top: 'gravel', bot: 'plaster' };
  box(4.0, 6.4, -8.0, 8.3, 6.8, 4.0, RF, 'struct', 6);
  box(8.3, 6.4, -8.0, 8.55, 8.0, 4.0, 'conc', 'struct', 6);
  box(8.55, 7.6, -8.0, 12.25, 8.0, 4.0, RF, 'struct', 6);
  box(8.55, 6.4, -8.0, 12.0, 7.6, -7.7, 'conc', 'struct', 6);
  box(8.55, 6.4, 3.7, 12.0, 7.6, 4.0, 'conc', 'struct', 6);
  box(12.0, 6.4, -8.0, 19.6, 6.8, 4.0, RF, 'struct', 6);
  // walls
  wall('x', 3.7, 4.0, -8.0, 4.0, -3.6, 0, [], 'conc', 2);
  wall('x', 3.7, 4.0, -8.0, 4.0, 0, 6.8, [[-1.2, 1.2, 0, 2.4], [-5.6, -2.4, 4.3, 5.9]], 'conc', 4);
  wall('z', -8.0, -7.7, 4.0, 18.3, -3.6, -0.35, [[13.0, 17.2, -2.3, -0.9]], 'conc', 2);
  wall('z', -8.0, -7.7, 4.0, 18.3, -0.35, 6.4, [[12.6, 17.4, 0.9, 5.6], [4.6, 10.8, 4.9, 5.8]], 'conc', 4);
  wall('z', 3.7, 4.0, 4.0, 18.3, -3.6, -0.35, [[13.0, 17.2, -2.3, -0.9]], 'conc', 2);
  wall('z', 3.7, 4.0, 4.0, 18.3, -0.35, 6.4, [[12.6, 17.4, 0.9, 5.6], [5.0, 9.4, 0.9, 2.2]], 'conc', 4);
  wall('x', 11.0, 11.15, -7.7, 3.7, -3.2, -0.35, [[-2.4, -1.4, -3.2, -1.1]], 'plaster', 4);

  // Slim architectural glazing frames (thinner sightlines)
  const glassRun = (x, y0, y1, z0, z1, step, door = null) => {
    for (let z = z0; z < z1 - 1e-3; z += step) {
      const za = z, zb = Math.min(z1, z + step);
      if (door && za > door[0] - 1e-3 && zb < door[1] + 1e-3) {
        box(x - 0.015, door[2], za + 0.02, x + 0.015, y1 - 0.04, zb - 0.02, 'glass', 'glass', 7);
        box(x - 0.045, door[2] - 0.045, za, x + 0.045, door[2], zb, 'steel', 'frame', 7);
      } else {
        box(x - 0.015, y0 + 0.04, za + 0.02, x + 0.015, y1 - 0.04, zb - 0.02, 'glass', 'glass', 7);
      }
    }
    for (let z = z0; z <= z1 + 1e-3; z += step) {
      box(x - 0.045, y0, Math.max(z0, z - 0.022), x + 0.045, y1, Math.min(z1, z + 0.022), 'steel', 'frame', 7);
    }
    box(x - 0.045, y0, z0, x + 0.045, y0 + 0.045, z1, 'steel', 'frame', 7);
    box(x - 0.045, y1 - 0.045, z0, x + 0.045, y1, z1, 'steel', 'frame', 7);
  };
  glassRun(18.24, -3.2, -0.35, -7.7, 3.7, 1.9);
  glassRun(18.24, 0, 6.4, -7.7, 3.7, 1.9, [-3.9, -2.0, 2.7]);
  box(18.19, 3.13, -7.7, 18.29, 3.2, 3.7, 'steel', 'frame', 7);
  glassRun(12.0, 6.8, 7.6, -7.7, 3.7, 1.9);

  // Glass balustrades with recessed steel base shoe channels and top rails
  // Terrace front & side balustrade
  box(22.40, 0, -8.0, 22.48, 0.07, 1.5, 'steel', 'frame', 7);
  box(22.42, 0.07, -7.98, 22.46, 1.05, 1.48, 'glass', 'glass', 7);
  box(22.39, 1.05, -8.0, 22.49, 1.09, 1.5, 'steel', 'frame', 7);
  // Mezzanine balustrade
  box(10.94, 3.2, -6.4, 11.02, 3.27, 3.7, 'steel', 'frame', 7);
  box(10.96, 3.27, -6.38, 11.0, 4.25, 3.68, 'glass', 'glass', 7);
  box(10.93, 4.25, -6.4, 11.03, 4.29, 3.7, 'steel', 'frame', 7);
  // Stair void balustrade (ground floor & second floor)
  box(5.5, 0, -6.44, 10.3, 0.07, -6.36, 'steel', 'frame', 7);
  box(5.5, 0.07, -6.42, 10.3, 1.0, -6.38, 'glass', 'glass', 7);
  box(5.5, 1.0, -6.44, 10.3, 1.04, -6.36, 'steel', 'frame', 7);
  box(5.5, 3.2, -6.44, 10.3, 3.27, -6.36, 'steel', 'frame', 7);
  box(5.5, 3.27, -6.42, 10.3, 4.25, -6.38, 'glass', 'glass', 7);
  box(5.5, 4.25, -6.44, 10.3, 4.29, -6.36, 'steel', 'frame', 7);

  // Stairs with clean oak treads and concrete carriage
  const n = 18, run = 4.8 / n, rise = 3.2 / n;
  for (let i = 0; i < n; i++) {
    const t = (i + 1) * rise;
    box(10.3 - (i + 1) * run, Math.max(0, t - 0.42), -7.68, 10.3 - i * run, t, -6.48, { all: 'conc', top: 'oak' }, 'stair', 5);
    box(5.5 + i * run, Math.max(-3.2, -3.2 + t - 0.42), -7.68, 5.5 + (i + 1) * run, -3.2 + t, -6.48, { all: 'conc', top: 'oak' }, 'stair', 5);
  }

  // Architectural Built-in Joinery: Second-Floor Library (Wk 30.1-30.8) & First-Floor Kitchen (Wk 34.0-34.65)
  const F = (x0, y0, z0, x1, y1, z1, m, drawIt = true, wk = null) => P.push({ b: [x0, y0, z0, x1, y1, z1], m, k: drawIt ? 'furn' : 'furnReal', ph: 8, wk });

  // 1. Second-Floor (Mezzanine) Full-Height Walnut & Travertine Library Wall (x = 4.0..4.52, z = -2.2..3.3)
  F(4.0, 3.20, -2.2, 4.48, 3.26, 3.3, 'ink', false, 30.05); // recessed shadow plinth
  F(4.0, 3.26, -2.2, 4.50, 3.92, 3.3, 'walnut', true, 30.12); // lower credenza cabinets
  F(4.0, 3.92, -2.2, 4.53, 3.97, 3.3, 'travertine', true, 30.25); // honed travertine display ledge
  F(4.0, 3.97, -2.2, 4.05, 5.86, 3.3, 'walnut', true, 30.35); // thin walnut back panel
  F(4.0, 5.82, -2.2, 4.42, 5.86, 3.3, 'walnut', true, 30.40); // top cornice cap
  for (let zv = -2.18; zv <= 3.28; zv += 1.08) {
    F(4.05, 3.97, zv, 4.42, 5.82, zv + 0.032, 'walnut', true, 30.45); // vertical bay dividers
  }
  for (let s = 0; s < 4; s++) {
    const y = 3.97 + s * 0.45;
    if (s > 0) F(4.05, y, -2.2, 4.41, y + 0.03, 3.3, 'walnut', true, 30.50 + s * 0.04);
    let z = -2.08;
    while (z < 3.12) {
      if (Math.abs(((z + 2.18) % 1.08)) < 0.06) { z += 0.08; continue; }
      const w = 0.035 + rnd() * 0.055, h = 0.20 + rnd() * 0.14;
      if (rnd() < 0.78) F(4.08, y + 0.03, z, 4.36, y + 0.03 + h, z + w, 'book' + Math.floor(rnd() * 5), false, 30.66 + s * 0.03);
      z += w + 0.012 + (rnd() < 0.22 ? 0.16 : 0);
    }
  }

  // 2. First-Floor Kitchen Tall Walnut Run along back wall x = 4.0..4.68, z = -6.1..-1.8 (Weeks 34.0-34.4)
  F(4.0, 0, -6.1, 4.62, 0.08, -1.8, 'ink', false, 34.00); // recessed plinth
  F(4.0, 0.08, -6.1, 4.66, 2.68, -4.85, 'walnut', true, 34.05); // tall fridge & pantry column
  F(4.66, 0.75, -4.92, 4.69, 1.85, -4.89, 'brass', false, 34.12); // vertical brass pull
  // Integrated oven tower
  F(4.0, 0.08, -4.84, 4.66, 0.88, -3.95, 'walnut', true, 34.14);
  F(4.0, 0.88, -4.84, 4.67, 1.52, -3.95, 'ink', true, 34.18); // matte black oven + steam oven
  F(4.67, 0.94, -4.78, 4.69, 1.46, -4.01, 'cabGlass', false, 34.20); // oven glass door
  F(4.0, 1.52, -4.84, 4.66, 2.68, -3.95, 'walnut', true, 34.22);
  // Worktop niche with travertine counter, travertine splashback, upper walnut cupboards & open shelf
  F(4.0, 0.08, -3.94, 4.66, 0.88, -1.8, 'walnut', true, 34.26); // lower cabinets
  F(4.0, 0.88, -3.94, 4.69, 0.93, -1.8, 'travertine', true, 34.30); // travertine worktop
  F(4.0, 0.93, -3.94, 4.06, 1.68, -1.8, 'travertine', false, 34.34); // travertine splashback
  F(4.06, 1.38, -3.85, 4.34, 1.41, -1.9, 'walnut', false, 34.38); // open walnut spice/ceramic shelf
  F(4.0, 1.68, -3.94, 4.46, 2.68, -1.8, 'walnut', true, 34.40); // upper wall cabinets
  F(4.0, 2.68, -6.1, 4.68, 2.85, -1.8, 'plaster', false, 34.42); // shadow-gap bulkhead to mezzanine soffit

  // 3. First-Floor Waterfall Travertine Kitchen Island (x = 6.14..9.46, z = -4.68..-3.62, Weeks 34.45-34.65)
  F(6.22, 0, -4.58, 9.38, 0.08, -3.72, 'ink', false, 34.44); // island recessed plinth
  F(6.2, 0.08, -4.62, 9.4, 0.88, -3.7, 'walnut', true, 34.48); // fluted walnut island core
  F(6.14, 0, -4.68, 6.2, 0.94, -3.62, 'travertine', true, 34.52); // left waterfall leg
  F(9.4, 0, -4.68, 9.46, 0.94, -3.62, 'travertine', true, 34.54); // right waterfall leg
  F(6.14, 0.88, -4.68, 9.46, 0.94, -3.62, 'travertine', true, 34.58); // thick honed travertine island top with bar overhang
  F(7.4, 0.94, -4.35, 8.1, 0.95, -3.95, 'ink', false, 34.62); // induction hob

  // 4. Lower level bedroom & snug joinery
  F(13.2, -3.2, -7.7, 15.8, -2.1, -7.6, 'walnut', true, 30.2);
  F(13.4, -3.2, -7.6, 15.6, -2.8, -5.5, 'walnut', true, 30.4);
  F(13.45, -2.8, -7.3, 15.55, -2.66, -5.45, 'linen', true, 30.6);
  F(13.6, -2.8, -7.55, 14.4, -2.6, -7.1, 'linen', false, 30.7);
  F(14.6, -2.8, -7.55, 15.4, -2.6, -7.1, 'linen', false, 30.7);
  F(12.7, -3.2, -7.7, 13.2, -2.75, -7.25, 'walnut', false, 30.8);
  F(15.8, -3.2, -7.7, 16.3, -2.75, -7.25, 'walnut', false, 30.8);
  F(6.6, -3.2, -5.2, 8.4, -2.65, -4.4, 'travertine', false, 30.9);
  F(4.0, -2.6, -3.6, 4.6, -2.3, -2.0, 'walnut', false, 31.0);
  F(4.0, -2.1, -3.5, 4.03, -1.0, -2.1, 'mirror', false, 31.1);

  // Exterior stone paving slabs (8cm thick so terrain never clips through)
  box(-7, -0.05, -6.5, 3.7, 0.03, 3.5, 'pave', 'land', 8);
  box(18.3, -3.25, -7.7, 24.8, -3.16, 3.7, 'pave', 'land', 8);
  return P;
}

function partWeeks(p) {
  const cx = (p.b[0] + p.b[3]) / 2, u = clamp((cx - 3) / 20, 0, 1);
  const ext = [p.b[3] - p.b[0], p.b[4] - p.b[1], p.b[5] - p.b[2]];
  const ax = ext[1] > ext[0] && ext[1] > ext[2] ? 1 : ext[0] >= ext[2] ? 0 : 2;
  if (p.k === 'furn' || p.k === 'furnReal') {
    const w0 = p.wk ?? (31.5 + 4.8 * clamp(u * 0.7 + rnd() * 0.3, 0, 1)), w1 = w0 + 0.015;
    const lo = p.b[1], hi = Math.max(lo + 1e-6, p.b[4]);
    return (x, y) => w0 + (w1 - w0) * clamp((y - lo) / (hi - lo), 0, 1);
  }
  if (p.k === 'land') {
    const w0 = 32.0 + 1.8 * u, w1 = w0 + 0.8, lo = p.b[ax], hi = Math.max(lo + 1e-6, p.b[ax + 3]);
    return (x, y, z) => w0 + (w1 - w0) * clamp(([x, y, z][ax] - lo) / (hi - lo), 0, 1);
  }
  if (p.k === 'stair') {
    return (x, y) => 13.85 + 1.95 * clamp((y - (-3.6)) / 6.8, 0, 1);
  }
  // Unified world-space affine wavefronts per structural phase so carved wall segments, slabs, and footings
  // share the exact same week value across every seam and build in one continuous, unbroken motion.
  if (p.ph === 1) {
    return (x, y) => 3.10 + 2.45 * clamp((x - 3.1) / 15.8, 0, 1) + 0.15 * clamp((y - (-4.3)) / 0.7, 0, 1);
  }
  if (p.ph === 2) {
    const isSlab = p.b[4] <= -3.15;
    if (isSlab) return (x, y) => 6.02 + 0.68 * clamp((x - 4.0) / 14.3, 0, 1) + 0.08 * clamp((y - (-3.6)) / 0.4, 0, 1);
    return (x, y) => 6.55 + 2.00 * clamp((x - 3.7) / 14.6, 0, 1) + 0.22 * clamp((y - (-3.6)) / 3.6, 0, 1);
  }
  if (p.ph === 3) {
    return (x, y) => 9.08 + 1.58 * clamp((x - 4.0) / 18.5, 0, 1) + 0.10 * clamp((y - (-0.35)) / 0.35, 0, 1);
  }
  if (p.ph === 4) {
    return (x, y) => 11.05 + 2.85 * clamp((x - 3.7) / 14.6, 0, 1) + 0.35 * clamp((y - (-3.2)) / 10.0, 0, 1);
  }
  if (p.ph === 5) {
    return (x, y) => 13.65 + 1.25 * clamp((x - 4.0) / 7.0, 0, 1) + 0.10 * clamp((y - 2.85) / 0.35, 0, 1);
  }
  if (p.ph === 6) {
    return (x, y) => 16.68 + 1.05 * clamp((x - 4.0) / 15.6, 0, 1) + 0.18 * clamp((y - 6.4) / 1.6, 0, 1);
  }
  if (p.ph === 7) {
    return (x, y) => 21.10 + 3.20 * clamp((x - 3.7) / 18.8, 0, 1) + 0.35 * clamp((y - (-3.2)) / 10.8, 0, 1);
  }
  const [a, b] = PHASE[p.ph], span = b - a;
  const w0 = a + span * 0.68 * u, w1 = w0 + span * 0.3, lo = p.b[ax], hi = Math.max(lo + 1e-6, p.b[ax + 3]);
  return (x, y, z) => w0 + (w1 - w0) * clamp(([x, y, z][ax] - lo) / (hi - lo), 0, 1);
}
const FINISH = { plaster: [25.2, 2.2], gravel: [21.3, 1.2], floorL: [26.5, 2.0], oak: [27.8, 2.6], pave: [31.8, 1.5] };
const finishWeek = (k, x) => FINISH[k][0] + FINISH[k][1] * clamp((x - 3) / 20, 0, 1);

const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], s: 'all' },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], s: 'all' },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 'top' },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 'bot' },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: 'all' },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], s: 'all' },
];
function bucketsOf(parts, keyOf, finishes = false) {
  const B = {};
  const emit = (key, p, f, wk, out, nOff = 0) => {
    const b = B[key] || (B[key] = { pos: [], nor: [], uv: [], wk: [], out: [], idx: [] });
    const base = b.pos.length / 3;
    for (const c of f.c) {
      const x = p.b[c[0] * 3] + f.n[0] * nOff;
      const y = p.b[1 + c[1] * 3] + f.n[1] * nOff;
      const z = p.b[2 + c[2] * 3] + f.n[2] * nOff;
      b.pos.push(x, y, z); b.nor.push(...f.n);
      if (f.n[0]) b.uv.push(z, y); else if (f.n[1]) b.uv.push(x, z); else b.uv.push(x, y);
      b.wk.push(wk(x, y, z)); b.out.push(out(x, y, z));
    }
    b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  for (const p of parts) {
    const spec = typeof p.m === 'string' ? { all: p.m } : p.m;
    const wk = p.weeks;
    for (const f of FACES) {
      const k0 = spec[f.s] || spec.all, key = keyOf(k0, p); if (!key) continue;
      if (finishes && FINISH[k0] && p.k !== 'land') {
        emit(key, p, f, wk, (x) => finishWeek(k0, x) + 0.02, 0);
        emit(k0, p, f, (x) => finishWeek(k0, x), () => 0, 0.0025);
      } else emit(key, p, f, wk, () => p.out || 0, 0);
    }
  }
  const out = {};
  for (const k in B) {
    const b = B[k], g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2)); g.setAttribute('aWeek', new THREE.Float32BufferAttribute(b.wk, 1));
    g.setAttribute('aOut', new THREE.Float32BufferAttribute(b.out, 1)); g.setIndex(b.idx);
    out[k] = g;
  }
  return out;
}

// ---------------------------------------------------------------- temporary works: telescopic steel props & H20 formwork
// Z-coordinates of prop lines leave a wide 2.7m clear central aisle around z = -2.85 so the camera never collides with a post
const PROP_ZS = [-7.15, -5.75, -4.35, -1.45, -0.05, 1.35, 2.75];

function propsGeo(x0, x1, z0, z1, yb, yt, wIn, out, stepX = 1.35) {
  const list = [], ply = [];
  const hTot = yt - yb - 0.22;
  const collarH = Math.min(1.65, hTot * 0.52);
  const zs = PROP_ZS.filter((z) => z >= z0 + 0.3 && z <= z1 - 0.3);

  for (let x = x0 + 0.45; x <= x1 - 0.35; x += stepX) {
    for (const z of zs) {
      // Base plate on floor slab
      const bp = new THREE.BoxGeometry(0.16, 0.014, 0.16); bp.translate(x, yb + 0.007, z); list.push(bp);
      // Outer lower telescopic tube
      const c1 = new THREE.CylinderGeometry(0.034, 0.034, collarH, 8, 1, true); c1.translate(x, yb + 0.014 + collarH / 2, z); list.push(c1);
      // Threaded collar nut & pin
      const col = new THREE.CylinderGeometry(0.048, 0.048, 0.09, 8); col.translate(x, yb + 0.014 + collarH, z); list.push(col);
      // Inner upper telescopic tube reaching up to U-head
      const remH = Math.max(0.1, hTot - collarH - 0.014);
      const c2 = new THREE.CylinderGeometry(0.027, 0.027, remH, 8, 1, true); c2.translate(x, yb + 0.014 + collarH + remH / 2, z); list.push(c2);
      // U-head fork plate cradling the H20 beam
      const uh = new THREE.BoxGeometry(0.16, 0.016, 0.14); uh.translate(x, yt - 0.228, z); list.push(uh);
    }
    // Primary H20 timber girder spanning continuously across Z right up to the plywood soffit
    const bm = new THREE.BoxGeometry(0.09, 0.20, z1 - z0 - 0.2);
    bm.translate(x, yt - 0.12, (z0 + z1) / 2);
    list.push(bm);
  }
  // Plywood formwork deck directly contacting underside of concrete slab (yt - 0.02 to yt)
  const p = new THREE.BoxGeometry(x1 - x0, 0.02, z1 - z0);
  p.translate((x0 + x1) / 2, yt - 0.01, (z0 + z1) / 2);
  worldUV(p); ply.push(p);

  const wk = (x, y) => wIn[0] + (wIn[1] - wIn[0]) * (0.75 * clamp((x - x0) / (x1 - x0), 0, 1) + 0.25 * clamp((y - yb) / (yt - yb), 0, 1));
  const outw = (x) => out + 0.9 * clamp((x - x0) / (x1 - x0), 0, 1);
  const g = merge(list); worldUV(g); stamp(g, wk, outw);
  const pg = merge(ply); stamp(pg, wk, outw);
  return { posts: g, deck: pg };
}

// Tower crane: lattice mast, triangular jib, counter-jib with ballast blocks, operator cab, and hook block
function craneGeo(h, L, Lc) {
  const Y = [], D = [], G = [];
  const bar = (list, a, b, r) => { const d = b.clone().sub(a), len = d.length(); const g = new THREE.BoxGeometry(r, len, r); g.translate(0, len / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize())); g.translate(a.x, a.y, a.z); list.push(g); };
  const s = 0.8;
  for (const [cx, cz] of [[-s, -s], [s, -s], [s, s], [-s, s]]) bar(Y, V(cx, 0, cz), V(cx, h, cz), 0.12);
  for (let y = 0; y < h - 0.1; y += 1.6) {
    const c = [V(-s, y, -s), V(s, y, -s), V(s, y, s), V(-s, y, s)];
    for (let i = 0; i < 4; i++) { bar(Y, c[i], c[(i + 1) % 4], 0.06); bar(Y, c[i], c[(i + 1) % 4].clone().add(V(0, 1.6, 0)), 0.045); }
  }
  const tt = new THREE.BoxGeometry(2.2, 0.7, 2.2); tt.translate(0, h + 0.35, 0); Y.push(tt);
  const cab = new THREE.BoxGeometry(1.7, 1.9, 1.5); cab.translate(1.5, h - 0.4, 1.3); Y.push(cab);
  const win = new THREE.BoxGeometry(0.05, 1.1, 1.3); win.translate(2.36, h - 0.2, 1.3); G.push(win);
  const jy = h + 0.7, th = 1.4;
  for (const z of [-0.55, 0.55]) bar(Y, V(0.9, jy, z), V(L, jy, z), 0.1);
  bar(Y, V(0.9, jy + th, 0), V(L - 1, jy + 0.25, 0), 0.09);
  for (let u = 0.9; u < L - 1.6; u += 1.8) {
    const t1 = th * (1 - (u - 0.9) / (L - 0.9)) + 0.25 * (u - 0.9) / (L - 0.9), u2 = u + 1.8, t2 = th * (1 - (u2 - 0.9) / (L - 0.9)) + 0.25 * (u2 - 0.9) / (L - 0.9);
    bar(Y, V(u, jy, -0.55), V(u, jy, 0.55), 0.05);
    bar(Y, V(u, jy, -0.55), V(u2, jy + t2, 0), 0.045); bar(Y, V(u, jy, 0.55), V(u2, jy + t2, 0), 0.045);
    bar(Y, V(u, jy + t1, 0), V(u2, jy, -0.55), 0.045); bar(Y, V(u, jy + t1, 0), V(u2, jy, 0.55), 0.045);
  }
  for (const z of [-0.55, 0.55]) bar(Y, V(-0.9, jy, z), V(-Lc, jy, z), 0.12);
  for (let u = -0.9; u > -Lc; u -= 1.5) bar(Y, V(u, jy, -0.55), V(u, jy, 0.55), 0.06);
  const blk = new THREE.BoxGeometry(2.6, 1.6, 1.6); blk.translate(-Lc + 1.6, jy - 0.5, 0); G.push(blk);
  bar(Y, V(-0.7, jy, -0.6), V(0, jy + 5, 0), 0.14); bar(Y, V(-0.7, jy, 0.6), V(0, jy + 5, 0), 0.14);
  bar(Y, V(0.7, jy, -0.6), V(0, jy + 5, 0), 0.14); bar(Y, V(0.7, jy, 0.6), V(0, jy + 5, 0), 0.14);
  bar(D, V(0, jy + 5, 0), V(L * 0.62, jy + th * 0.4, 0), 0.04); bar(D, V(0, jy + 5, 0), V(-Lc + 0.5, jy + 0.1, 0), 0.04);
  const tx = L * 0.42;
  const tr = new THREE.BoxGeometry(1.0, 0.3, 1.0); tr.translate(tx, jy - 0.2, 0); D.push(tr);
  bar(D, V(tx - 0.12, jy - 0.3, 0), V(tx - 0.12, jy - 9.5, 0), 0.025); bar(D, V(tx + 0.12, jy - 0.3, 0), V(tx + 0.12, jy - 9.5, 0), 0.025);
  const hk = new THREE.BoxGeometry(0.5, 0.7, 0.3); hk.translate(tx, jy - 9.8, 0); Y.push(hk);
  const pad = new THREE.BoxGeometry(5, 1.0, 5); pad.translate(0, -0.5, 0); G.push(pad);
  return { yellow: merge(Y), dark: merge(D), grey: merge(G), glass: win };
}

// High-detail 22-tonne Tracked Hydraulic Excavator (Volvo EC220 / CAT 320 architectural grade)
function excavatorGeo(pose) {
  const K = { yellow: [], dark: [], rubber: [], chrome: [], cabGlass: [], beacon: [] };
  const box = (k, w, h, d, x, y, z, rz = 0, ry = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rz) g.rotateZ(rz);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    worldUV(g);
    K[k].push(g);
    return g;
  };
  const cylZ = (k, r, len, x, y, z, seg = 20) => {
    const g = new THREE.CylinderGeometry(r, r, len, seg);
    g.rotateX(Math.PI / 2); g.translate(x, y, z); K[k].push(g);
  };
  const cylY = (k, r0, r1, len, x, y, z, seg = 20) => {
    const g = new THREE.CylinderGeometry(r0, r1, len, seg);
    g.translate(x, y + len / 2, z); K[k].push(g);
  };
  const seg = (k, a, b, w, h0, h1 = h0, x0 = 0, x1 = 0) => {
    const d = b.clone().sub(a), len = d.length(), ang = Math.atan2(d.y, d.x);
    const L = len + x0 + x1;
    const g = new THREE.BoxGeometry(L, 1, w);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = (p.getX(i) + L / 2) / L;
      const h = h0 + (h1 - h0) * u;
      p.setY(i, p.getY(i) * h);
    }
    g.computeVertexNormals();
    g.translate((len + x1 - x0) / 2, 0, 0);
    g.rotateZ(ang);
    g.translate(a.x, a.y, a.z);
    worldUV(g);
    K[k].push(g);
  };
  const rod = (k, a, b, r, segs = 12) => {
    const d = b.clone().sub(a), len = d.length();
    const g = new THREE.CylinderGeometry(r, r, len, segs);
    g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()));
    g.translate(a.x, a.y, a.z);
    K[k].push(g);
  };

  // 1. Heavy-duty X-frame Undercarriage & Track Assemblies
  for (const s of [-1, 1]) {
    const z = s * 1.28;
    // Track belt core & rounded idler/sprocket ends
    box('rubber', 4.05, 0.84, 0.64, 0, 0.42, z);
    cylZ('rubber', 0.42, 0.64, -2.02, 0.42, z, 24);
    cylZ('rubber', 0.42, 0.64, 2.02, 0.42, z, 24);
    // Final drive planetary hub (rear) & idler hub (front)
    cylZ('dark', 0.30, 0.68, -2.02, 0.42, z, 18);
    cylZ('dark', 0.24, 0.66, 2.02, 0.42, z, 18);
    // Sculpted steel track roller frame & rock guard
    box('dark', 3.65, 0.38, 0.46, 0, 0.45, z);
    box('yellow', 3.3, 0.16, 0.50, 0, 0.62, z);
    box('dark', 3.1, 0.08, 0.54, 0, 0.32, z); // bottom rock guard
    // 7 Bottom track rollers + 2 top carrier rollers
    for (let i = -3; i <= 3; i++) cylZ('dark', 0.12, 0.68, i * 0.52, 0.15, z, 12);
    for (const x of [-0.85, 0.85]) cylZ('dark', 0.10, 0.58, x, 0.74, z, 12);
    // Triple-grouser steel track shoes around top, bottom, and ends
    for (let i = 0; i < 30; i++) {
      const tx = -2.0 + i * 0.138;
      box('dark', 0.09, 0.045, 0.66, tx, 0.85, z);
      box('dark', 0.03, 0.065, 0.66, tx - 0.02, 0.86, z);
      box('dark', 0.03, 0.065, 0.66, tx + 0.02, 0.86, z);
      box('dark', 0.09, 0.035, 0.66, tx, 0.02, z);
    }
    for (let a = 0; a < 8; a++) {
      const ang = -Math.PI / 2 + (a + 0.5) / 8 * Math.PI;
      for (const end of [-1, 1]) {
        const ex = end * 2.02 + end * Math.cos(ang) * 0.43;
        const ey = 0.42 + Math.sin(ang) * 0.43;
        box('dark', 0.04, 0.09, 0.66, ex, ey, z, end * ang);
      }
    }
    // Track tie-down lugs
    box('yellow', 0.14, 0.14, 0.08, 1.55, 0.58, z + s * 0.28);
    box('yellow', 0.14, 0.14, 0.08, -1.55, 0.58, z + s * 0.28);
  }
  // X-frame center carbody & heavy slewing ring
  box('dark', 2.1, 0.34, 2.05, 0, 0.72, 0);
  box('dark', 2.4, 0.24, 0.55, 0, 0.68, 0, 0, 0.62);
  box('dark', 2.4, 0.24, 0.55, 0, 0.68, 0, 0, -0.62);
  cylY('dark', 0.98, 1.02, 0.24, -0.1, 0.88, 0, 32);
  cylY('chrome', 0.94, 0.94, 0.05, -0.1, 1.08, 0, 32);

  // 2. Upper Structure (House), Counterweight, Engine Bay & Catwalks
  // Main chassis deck & anti-slip side catwalks
  box('dark', 3.15, 0.12, 2.58, -0.38, 1.18, 0);
  box('dark', 2.85, 0.05, 0.22, -0.25, 1.24, -1.32); // left catwalk step
  box('dark', 2.85, 0.05, 0.22, -0.25, 1.24, 1.32);  // right catwalk step
  // Sculpted rear counterweight in matte dark grey with lower amber trim
  box('dark', 0.88, 1.18, 2.54, -2.08, 1.82, 0);
  cylZ('dark', 0.59, 2.54, -2.32, 1.82, 0, 24);
  box('yellow', 0.92, 0.24, 2.56, -2.08, 1.36, 0);
  cylZ('yellow', 0.24, 2.56, -2.42, 1.36, 0, 16);
  // Counterweight recessed vents & tow cavity
  box('rubber', 0.15, 0.36, 0.42, -2.86, 1.68, 0);
  box('rubber', 0.12, 0.18, 1.6, -2.84, 2.18, 0);

  // Right-side hydraulic & fuel tanks + engine cowling
  box('yellow', 2.45, 0.98, 1.05, -0.35, 1.73, 0.74);
  box('yellow', 1.55, 0.36, 0.95, -0.05, 2.02, 0.74, -0.18); // sloped front right hood
  box('dark', 0.03, 0.72, 0.08, 0.35, 1.72, 1.27); // hydraulic oil sight glass
  cylY('dark', 0.06, 0.06, 0.08, 0.45, 2.22, 0.85, 12); // fuel cap
  // Center raised engine housing, cooling pack, louvers & exhaust stack
  box('yellow', 1.82, 0.48, 1.52, -0.95, 2.38, 0.22);
  box('dark', 0.75, 0.06, 1.05, -1.05, 2.63, 0.25); // top cooling grille
  for (let i = 0; i < 6; i++) {
    box('dark', 0.55, 0.04, 0.03, -0.95, 1.65 + i * 0.09, 1.27); // side intake louvers
    box('dark', 0.55, 0.04, 0.03, -1.25, 1.65 + i * 0.09, -1.25);
  }
  cylY('dark', 0.11, 0.11, 0.48, -1.15, 2.62, 0.68, 14); // muffler guard
  cylY('chrome', 0.055, 0.055, 0.68, -1.15, 2.62, 0.68, 12); // exhaust pipe
  box('chrome', 0.14, 0.02, 0.14, -1.15, 3.31, 0.68, 0.25); // exhaust rain cap
  // Left rear compartment behind cab
  box('yellow', 1.15, 1.02, 0.96, -1.12, 1.75, -0.76);

  // Safety handrails & mirrors on upper deck
  for (const x of [-1.55, -0.65, 0.25]) rod('dark', V(x, 2.22, 1.22), V(x, 2.72, 1.22), 0.018, 8);
  rod('dark', V(-1.55, 2.72, 1.22), V(0.55, 2.72, 1.22), 0.018, 8);
  rod('dark', V(0.55, 2.72, 1.22), V(0.75, 2.15, 1.22), 0.018, 8);
  rod('dark', V(0.82, 2.1, 1.22), V(0.82, 2.95, 1.22), 0.016, 8);
  box('dark', 0.06, 0.26, 0.16, 0.86, 2.82, 1.26); // right mirror

  // 3. Operator ROPS Cab (Left Side) with full interior detail
  const cx = 0.35, cz = -0.76;
  box('dark', 1.38, 0.14, 0.98, cx, 1.31, cz); // cab floor platform
  // Interior operator seat, armrests, joysticks & monitor
  box('dark', 0.42, 0.22, 0.44, cx - 0.08, 1.48, cz); // seat base
  box('rubber', 0.44, 0.10, 0.46, cx - 0.05, 1.64, cz); // seat cushion
  box('rubber', 0.10, 0.56, 0.44, cx - 0.24, 1.94, cz, 0.15); // seat backrest
  box('rubber', 0.08, 0.18, 0.28, cx - 0.29, 2.30, cz, 0.1); // headrest
  for (const sz of [-0.26, 0.26]) {
    box('dark', 0.34, 0.24, 0.10, cx + 0.06, 1.56, cz + sz); // joystick console
    rod('rubber', V(cx + 0.14, 1.68, cz + sz), V(cx + 0.20, 1.86, cz + sz), 0.018, 8);
  }
  rod('dark', V(cx + 0.44, 1.38, cz - 0.1), V(cx + 0.40, 1.88, cz - 0.1), 0.014, 8); // travel levers
  rod('dark', V(cx + 0.44, 1.38, cz + 0.1), V(cx + 0.40, 1.88, cz + 0.1), 0.014, 8);
  box('dark', 0.08, 0.22, 0.26, cx + 0.46, 1.96, cz - 0.28, -0.3, 0.35); // LCD monitor
  // Cab ROPS structural frame pillars (slender & angled front windshield)
  const pFL0 = V(cx + 0.66, 1.38, cz - 0.46), pFL1 = V(cx + 0.48, 3.08, cz - 0.45);
  const pFR0 = V(cx + 0.66, 1.38, cz + 0.46), pFR1 = V(cx + 0.48, 3.08, cz + 0.45);
  const pBL0 = V(cx - 0.64, 1.38, cz - 0.46), pBL1 = V(cx - 0.60, 3.08, cz - 0.45);
  const pBR0 = V(cx - 0.64, 1.38, cz + 0.46), pBR1 = V(cx - 0.60, 3.08, cz + 0.45);
  const pML0 = V(cx + 0.04, 1.38, cz - 0.46), pML1 = V(cx + 0.02, 3.08, cz - 0.45);
  for (const [a, b] of [[pFL0, pFL1], [pFR0, pFR1], [pBL0, pBL1], [pBR0, pBR1], [pML0, pML1]]) rod('dark', a, b, 0.036, 8);
  for (const [a, b] of [[pFL1, pBL1], [pFR1, pBR1], [pFL1, pFR1], [pBL1, pBR1]]) rod('dark', a, b, 0.038, 8);
  // Lower cab door kick-panel & roof cap
  box('yellow', 1.28, 0.42, 0.04, cx, 1.59, cz - 0.46);
  box('yellow', 1.14, 0.09, 0.94, cx - 0.06, 3.12, cz);
  cylY('beacon', 0.055, 0.065, 0.11, cx - 0.42, 3.16, cz - 0.28, 14); // amber strobe beacon
  // Tinted reflective safety glazing
  box('cabGlass', 0.02, 1.66, 0.88, cx + 0.57, 2.24, cz, -0.105); // angled front windshield
  box('cabGlass', 1.18, 1.24, 0.02, cx - 0.04, 2.42, cz - 0.46); // left door & rear window
  box('cabGlass', 1.18, 1.62, 0.02, cx - 0.04, 2.23, cz + 0.46); // right window
  box('cabGlass', 0.02, 1.62, 0.88, cx - 0.62, 2.23, cz); // back window
  // Cab grab handles & front work lights
  rod('chrome', V(cx + 0.62, 1.55, cz - 0.50), V(cx + 0.53, 2.35, cz - 0.50), 0.014, 8);
  box('chrome', 0.08, 0.08, 0.10, cx + 0.50, 3.06, cz - 0.34);
  box('chrome', 0.08, 0.08, 0.10, cx + 0.50, 3.06, cz + 0.34);

  // 4. Articulated Gooseneck Boom, Stick (Dipper Arm), Hydraulic Cylinders & 4-Bar Bucket Linkage
  const pv = V(0.95, 1.68, 0.12), knee = V(3.25, 4.45, 0.12), tip = pose.tip, wrist = pose.wrist;
  // Main boom lower & upper tapered box sections + side reinforcement baffle plates
  seg('yellow', pv, knee, 0.46, 0.52, 0.72, 0.28, 0.26);
  seg('yellow', knee, tip, 0.42, 0.68, 0.38, 0.22, 0.22);
  seg('dark', pv.clone().lerp(knee, 0.15), knee.clone().lerp(tip, 0.15), 0.50, 0.18, 0.18, 0, 0);
  // Hydraulic steel lines routed along top of boom
  for (const dz of [-0.24, 0.24]) {
    rod('dark', pv.clone().add(V(0, 0.28, dz)), knee.clone().add(V(0, 0.36, dz)), 0.016, 8);
    rod('dark', knee.clone().add(V(0, 0.36, dz)), tip.clone().add(V(0, 0.20, dz)), 0.016, 8);
  }
  // Stick (dipper arm) tapered section with ear brackets
  seg('yellow', tip, wrist, 0.34, 0.48, 0.30, 0.42, 0.18);
  // Heavy pivot pins with chrome end caps
  for (const [p, w] of [[pv, 0.72], [knee, 0.62], [tip, 0.58], [wrist, 0.52]]) {
    cylZ('dark', 0.13, w, p.x, p.y, p.z, 16);
    cylZ('chrome', 0.08, w + 0.04, p.x, p.y, p.z, 14);
  }
  // Twin boom lift hydraulic cylinders
  const bmAttach = pv.clone().lerp(knee, 0.56).add(V(0.08, -0.18, 0));
  for (const dz of [-0.28, 0.28]) {
    const c0 = V(1.32, 1.28, 0.12 + dz), c1 = bmAttach.clone().add(V(0, 0, dz));
    const mid = c0.clone().lerp(c1, 0.56);
    rod('dark', c0, mid, 0.095, 14);
    rod('chrome', mid, c1, 0.058, 14);
    cylZ('dark', 0.11, 0.18, c0.x, c0.y, c0.z, 12);
    cylZ('dark', 0.11, 0.18, c1.x, c1.y, c1.z, 12);
  }
  // Stick crowd cylinder above the boom
  const ac0 = knee.clone().add(V(-0.15, 0.48, 0)), ac1 = tip.clone().add(V(0.18, 0.48, 0));
  const acMid = ac0.clone().lerp(ac1, 0.58);
  rod('dark', ac0, acMid, 0.095, 14);
  rod('chrome', acMid, ac1, 0.058, 14);
  // Bucket curl cylinder & 4-bar linkage (power H-link + guide link)
  const along = wrist.clone().sub(tip).normalize(), side = V(-along.y, along.x, 0);
  const bc0 = tip.clone().addScaledVector(along, 0.32).addScaledVector(side, 0.34);
  const linkPin = wrist.clone().addScaledVector(along, -0.42).addScaledVector(side, 0.36);
  const stickPin = wrist.clone().addScaledVector(along, -0.38);
  const bcMid = bc0.clone().lerp(linkPin, 0.58);
  rod('dark', bc0, bcMid, 0.082, 14);
  rod('chrome', bcMid, linkPin, 0.048, 14);
  for (const dz of [-0.16, 0.16]) {
    rod('dark', stickPin.clone().add(V(0, 0, dz)), linkPin.clone().add(V(0, 0, dz)), 0.038, 10);
    rod('yellow', linkPin.clone().add(V(0, 0, dz)), wrist.clone().add(V(0.18, -0.15, dz)), 0.042, 10);
  }
  cylZ('chrome', 0.055, 0.44, linkPin.x, linkPin.y, linkPin.z, 12);

  // 5. Heavy-duty Rock & Earth Digging Bucket with Wear Plates & 5 Cast Teeth
  const bw = 1.12, ang = pose.bucket;
  for (let i = 0; i < 8; i++) {
    const a0 = ang + i * 0.34, a1 = a0 + 0.36, r = 0.64;
    const p0 = wrist.clone().add(V(Math.cos(a0) * r, Math.sin(a0) * r, 0.12));
    const p1 = wrist.clone().add(V(Math.cos(a1) * r, Math.sin(a1) * r, 0.12));
    seg('dark', p0, p1, bw, 0.055, 0.055);
    if (i >= 2 && i <= 5) seg('rubber', p0, p1, bw + 0.03, 0.025, 0.025); // outer wear strips
  }
  for (const z of [0.12 - bw / 2, 0.12 + bw / 2]) {
    const g = new THREE.CylinderGeometry(0.64, 0.64, 0.045, 20, 1, false, 0, 8 * 0.34 + 0.36);
    g.rotateX(Math.PI / 2); g.rotateZ(ang + Math.PI / 2); g.translate(wrist.x, wrist.y, z); K.dark.push(g);
  }
  const lip = ang + 8 * 0.34 + 0.02, tp = wrist.clone().add(V(Math.cos(lip) * 0.64, Math.sin(lip) * 0.64, 0));
  box('dark', 0.10, 0.06, bw + 0.04, tp.x, tp.y, 0.12, lip + Math.PI / 2); // cutting edge lip
  for (let i = 0; i < 5; i++) {
    const tz = 0.12 - 0.44 + i * 0.22;
    box('yellow', 0.12, 0.07, 0.07, tp.x + Math.cos(lip + 1.4) * 0.04, tp.y + Math.sin(lip + 1.4) * 0.04, tz, lip + Math.PI / 2);
    box('chrome', 0.18, 0.045, 0.06, tp.x + Math.cos(lip + 1.4) * 0.14, tp.y + Math.sin(lip + 1.4) * 0.14, tz, lip + Math.PI / 2);
  }
  const out = {}; for (const k in K) if (K[k].length) out[k] = merge(K[k]);
  return out;
}

// ---------------------------------------------------------------- trees and foliage
export const FIG_GEO = (() => {
  const g = new THREE.LatheGeometry([[0, 0], [0.12, 0], [0.14, 0.1], [0.15, 0.82], [0.19, 1.0], [0.21, 1.36], [0.19, 1.44], [0.07, 1.5], [0.07, 1.54], [0.1, 1.6], [0.1, 1.7], [0.06, 1.75], [0, 1.76]].map(([x, y]) => new THREE.Vector2(x, y)), 16);
  g.scale(1, 1, 0.62); return g;
})();
export function workerGeo() {
  return { body: new THREE.BufferGeometry(), vest: new THREE.BufferGeometry(), hat: new THREE.BufferGeometry(), head: new THREE.BufferGeometry() };
}
export function canopy(clusters, s0, s1) {
  const list = [];
  for (const [cx, cy, cz, rx, ry, rz, n] of clusters) for (let i = 0; i < n; i++) {
    let x, y, z; do { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; } while (x * x + y * y + z * z > 1);
    const k = 0.6 + 0.4 * Math.sqrt(rnd());
    const g = new THREE.IcosahedronGeometry(s0 + rnd() * (s1 - s0), 0); g.scale(1, 0.55, 1); g.rotateX(rnd() * 3); g.rotateZ(rnd() * 3);
    g.translate(cx + x * rx * k, cy + y * ry * k, cz + z * rz * k); list.push(g);
  }
  return merge(list);
}

// ---------------------------------------------------------------- build it
// Temporary works: matched to the exact underside of each slab & clerestory (zero floating beams!)
export const PROPS = [
  [4.2, 18.0, -6.2, 3.6, -3.2, -0.35, [8.2, 9.0], 12.5],     // lower level under ground slab (clear of stair void)
  [4.2, 10.8, -6.2, 3.6, 0, 2.85, [13.25, 13.55], 19.2],     // ground floor under mezzanine slab
  [4.2, 8.2, -6.2, 3.6, 3.2, 6.4, [16.05, 16.35], 22.8],     // mezzanine under rear roof (y = 6.4)
  [8.6, 10.9, -6.2, 3.6, 3.2, 7.6, [16.25, 16.5], 22.9],     // mezzanine under clerestory roof (y = 7.6)
  [11.9, 18.0, -7.6, 3.6, 0, 6.4, [16.05, 16.6], 23.2],      // double-height living space under front roof (y = 6.4)
];
export function propsAt(week) {
  let n = 0;
  for (const [x0, x1, z0, z1, , , wIn, out] of PROPS) {
    const zs = PROP_ZS.filter((z) => z >= z0 + 0.3 && z <= z1 - 0.3);
    for (let x = x0 + 0.45; x <= x1 - 0.35; x += 1.35) for (let j = 0; j < zs.length; j++) {
      const u = (x - x0) / (x1 - x0);
      if (week >= wIn[0] + (wIn[1] - wIn[0]) * 0.75 * u && week < out + 0.9 * u) n++;
    }
  }
  return n;
}

export function buildWorld(o) {
  const { R, phone } = o;
  const group = new THREE.Group();
  const realOnly = (main) => ({ main, paper: null, nd: null });

  // the house: one geometry per material for the site, hierarchical line classes for the drawing
  const parts = houseParts();
  for (const p of parts) p.weeks = partWeeks(p);
  const STRUCT = { conc: 'conc', floorL: 'conc', oak: 'conc', plaster: 'conc', gravel: 'conc', pave: 'conc' };
  const real = bucketsOf(parts, (k, p) => (p.k === 'land' ? k : (p.k === 'furn' || p.k === 'furnReal' ? k : (STRUCT[k] || k))), true);
  for (const k in real) addMesh(group, real[k], realOnly(R[k] || R.conc), { glass: k === 'glass' || k === 'cabGlass', shadow: k !== 'glass' && k !== 'cabGlass' && k !== 'steel' });

  // Separate drawing meshes by architectural hierarchy so Tile 06 is crisp and uncluttered
  const drawnStruct = bucketsOf(parts.filter((p) => p.k === 'struct' || p.k === 'stair'), () => 'paper');
  if (drawnStruct.paper) addMesh(group, drawnStruct.paper, { main: null, paper: DM.paper, nd: DM.nd });

  const drawnFrame = bucketsOf(parts.filter((p) => p.k === 'frame'), () => 'paper');
  if (drawnFrame.paper) addMesh(group, drawnFrame.paper, { main: null, paper: DM.paper, nd: DM.ndFrame });

  const drawnFurn = bucketsOf(parts.filter((p) => p.k === 'furn'), () => 'paper');
  if (drawnFurn.paper) addMesh(group, drawnFurn.paper, { main: null, paper: DM.paper, nd: DM.ndFurn });

  // Temporary works (props & formwork decks)
  for (const [x0, x1, z0, z1, yb, yt, wIn, out] of PROPS) {
    const g = propsGeo(x0, x1, z0, z1, yb, yt, wIn, out);
    addMesh(group, g.posts, { main: R.prop, paper: DM.paper, nd: DM.ndProp });
    addMesh(group, g.deck, { main: R.ply, paper: DM.paper, nd: DM.ndProp });
  }

  // Footings detail, real only: blinding under them, starter bars with safety caps (encased at week 8.8 when lower walls finish)
  const bl = [];
  for (const b of [[3.1, -8.4, 4.6, 4.4], [17.7, -8.4, 18.9, 4.4], [4.6, -8.4, 17.7, -7.4], [4.6, 3.4, 17.7, 4.4]]) {
    const g = new THREE.BoxGeometry(b[2] - b[0] + 0.3, 0.04, b[3] - b[1] + 0.3); g.translate((b[0] + b[2]) / 2, -4.3 + 0.02, (b[1] + b[3]) / 2); bl.push(g);
  }
  const blg = merge(bl); worldUV(blg); stamp(blg, (x) => 2.9 + (x - 3) / 20 * 0.4, 9.30);
  addMesh(group, blg, realOnly(R.blinding), { shadow: false });
  const bars = [], caps = [];
  const bar = (x, z, w, outW) => {
    const c = new THREE.CylinderGeometry(0.009, 0.009, 0.92, 6, 1, true); c.translate(x, -3.6 + 0.46, z); stamp(c, w, outW); bars.push(c);
    const k = new THREE.CylinderGeometry(0.024, 0.018, 0.045, 8); k.translate(x, -3.6 + 0.92, z); stamp(k, w, outW); caps.push(k);
  };
  const fw = (x) => 3.26 + 2.45 * clamp((x - 3.1) / 15.8, 0, 1);
  const fOut = (x) => x > 18.0 ? 8.85 : 6.62 + 2.00 * clamp((x - 3.7) / 14.6, 0, 1);
  for (let z = -7.9; z <= 3.9; z += 0.35) { bar(3.78, z, fw(3.78), fOut(3.78)); bar(3.92, z + 0.15, fw(3.92), fOut(3.92)); }
  for (let x = 4.3; x <= 17.9; x += 0.35) { for (const z of [-7.94, -7.78, 3.78, 3.94]) bar(x, z, fw(x), fOut(x)); }
  for (const z of [-7.85, -1.95, 3.85]) for (const dx of [-0.12, 0, 0.12]) for (const dz of [-0.12, 0.12]) bar(18.24 + dx, z + dz, fw(18.24 + dx), 8.85);
  addMesh(group, merge(bars), realOnly(R.rebar), { shadow: true });
  addMesh(group, merge(caps), realOnly(R.cap), { shadow: false });

  // the land
  const land = buildLand(o);
  for (const m of land) group.add(m);

  // the site: crane, high-detail excavator, guardrails, perimeter fence, site office cabin
  const SITE_IN = 0.3;
  const cg = craneGeo(19.5, 34, 10);
  const crane = new THREE.Group();
  for (const [k, g] of [['yellow', cg.yellow], ['dark', cg.dark], ['block', cg.grey], ['cabGlass', cg.glass]]) { stamp(g, 4.5, 23); addMesh(crane, g, realOnly(R[k]), { glass: k === 'cabGlass', shadow: k !== 'cabGlass' }); }
  crane.position.set(-5.8, natural(-5.8, -12.6), -12.6); crane.rotation.y = -0.62; group.add(crane);

  // Excavator positioned inside the open excavation platform (clear of the poured footings & rebar), trimming the bank
  const ex = excavatorGeo({ tip: V(5.35, 3.55, 0.12), wrist: V(5.85, 1.05, 0.12), bucket: -2.25 });
  const exg = new THREE.Group();
  for (const k in ex) { stamp(ex[k], SITE_IN, 6.2); addMesh(exg, ex[k], realOnly(R[k]), { glass: k === 'cabGlass', shadow: k !== 'cabGlass' }); }
  exg.position.set(11.6, PIT.y, -2.2); exg.rotation.y = Math.PI * 0.93; group.add(exg);

  group.add(...barrier(R), ...fence(R));
  // Galvanised access ladder into the pit
  {
    const L = [], top = V(15.8, natural(15.8, 6.95) + 1.0, 6.95), bot = V(15.8, PIT.y, 5.3), d = top.clone().sub(bot), len = d.length();
    for (const s of [-0.22, 0.22]) { const g = new THREE.BoxGeometry(0.045, len, 0.065); g.translate(0, len / 2, 0); g.rotateX(-Math.atan2(d.z, d.y)); g.translate(bot.x + s, bot.y, bot.z); L.push(g); }
    for (let t = 0.3; t < len - 0.2; t += 0.3) { const g = new THREE.CylinderGeometry(0.015, 0.015, 0.44, 8); g.rotateZ(Math.PI / 2); g.translate(0, t, 0); g.rotateX(-Math.atan2(d.z, d.y)); g.translate(bot.x, bot.y, bot.z); L.push(g); }
    const g = merge(L); stamp(g, 3.0, (x, y) => 8.85 + 0.28 * clamp((y - PIT.y) / 3.2, 0, 1)); addMesh(group, g, realOnly(R.galv));
  }

  // Site office cabin on the court
  {
    const L = [], W = [], G = [];
    const b = (list, w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); list.push(g); };
    b(L, 6.0, 2.5, 2.4, 0, 1.45, 0); b(W, 6.1, 0.15, 2.5, 0, 2.75, 0); b(W, 6.1, 0.2, 2.5, 0, 0.1, 0);
    for (const x of [-1.8, 0.2, 2.0]) {
      b(G, 1.0, 0.85, 0.04, x, 1.75, 1.21);
      b(W, 1.08, 0.05, 0.06, x, 2.20, 1.21); b(W, 1.08, 0.05, 0.06, x, 1.30, 1.21);
    }
    b(W, 0.95, 2.0, 0.04, -2.55, 1.2, 1.21);
    for (const x of [-2.6, 2.6]) for (const z of [-0.9, 0.9]) b(W, 0.3, 0.3, 0.3, x, 0.0, z);
    const cab = new THREE.Group();
    for (const [list, m] of [[L, R.cabin], [W, R.cabinTrim], [G, R.cabGlass]]) { const g = merge(list); stamp(g, 0.6, 33); addMesh(cab, g, realOnly(m), { glass: m === R.cabGlass, shadow: m !== R.cabGlass }); }
    cab.position.set(-8.5, natural(-8.5, -4) + 0.05, -4); cab.rotation.y = Math.PI / 2; group.add(cab);
  }

  // Trees around the site & garden
  const trees = [];
  for (let z = -22; z <= 15; z += 3.5) trees.push(['cypress', -15 + Math.sin(z) * 0.6, z + (rnd() - 0.5), 0]);
  for (const t of [
    ['olive', -6, -23, 0], ['olive', -24, 4, 0], ['olive', 30, -17, 0], ['olive', 33, -10.5, 0],
    ['olive', 34, 13, 0], ['olive', -2.5, 19, 0], ['olive', 40, 2, 0], ['round', -22, -12, 0],
    ['olive', 46, -24, 0], ['olive', 52, 10, 0],
    // Garden trees planted during fit-out (Weeks 33-35) visible through the living room window!
    ['olive', 26.2, -6.2, 33.2], ['olive', 27.8, 2.2, 33.6], ['round', 31.5, -2.5, 34.0],
  ]) trees.push(t);
  const leafK = phone ? 0.55 : 1;
  for (const [kind, x, z, wIn] of trees) {
    const y = natural(x, z), t = new THREE.Group();
    if (kind === 'cypress') {
      const h = 0.85 + rnd() * 0.35;
      const c = canopy([[0, 0, 0, 0.72, 3.3 * h, 0.72, Math.round(420 * leafK)]], 0.11, 0.19); stamp(c, wIn); addMesh(t, c, realOnly(R.leafDark));
      const tr = new THREE.CylinderGeometry(0.1, 0.15, 1.5, 8); tr.translate(0, 0.75, 0); stamp(tr, wIn); addMesh(t, tr, realOnly(R.bark));
      t.children[0].position.y = 3.5 * h + 0.45;
    } else {
      const olive = kind === 'olive';
      const tr = new THREE.CylinderGeometry(0.11, 0.22, 2.4, 8); tr.rotateZ(olive ? 0.16 : 0.04); tr.translate(0, 1.2, 0);
      const br1 = new THREE.CylinderGeometry(0.05, 0.1, 1.6, 6); br1.rotateZ(-0.65); br1.translate(0.3, 2.35, 0);
      const br2 = new THREE.CylinderGeometry(0.04, 0.09, 1.4, 6); br2.rotateZ(0.55); br2.rotateY(1.2); br2.translate(-0.25, 2.25, 0.2);
      const tg = merge([tr, br1, br2]); stamp(tg, wIn); addMesh(t, tg, realOnly(R.bark));
      const cl = olive
        ? [[-0.4, 0, 0, 1.7, 0.9, 1.5, 380], [0.9, 0.4, 0.3, 1.2, 0.72, 1.1, 220], [-0.2, 0.82, -0.4, 1.1, 0.62, 1.1, 180]]
        : [[0, 0, 0, 1.8, 1.6, 1.7, 500], [0.5, 0.85, 0.3, 1.2, 0.95, 1.1, 220]];
      const c = canopy(cl.map((q) => [...q.slice(0, 6), Math.round(q[6] * leafK)]), olive ? 0.09 : 0.11, olive ? 0.17 : 0.20); stamp(c, wIn);
      addMesh(t, c, realOnly(olive ? R.olive : R.leaf)); t.children[1].position.y = olive ? 3.0 : 3.6;
    }
    t.position.set(x, y - 0.05, z); t.rotation.y = rnd() * 6.28; group.add(t);
  }
  return group;
}

// ---------------------------------------------------------------- the land, as meshes
function buildLand(o) {
  const { T, phone } = o;
  const out = [];
  const step = phone ? 0.4 : 0.2;
  const X0 = -20, X1 = 40, Z0 = -26, Z1 = 20;
  const nx = Math.round((X1 - X0) / step), nz = Math.round((Z1 - Z0) / step);
  const terrainMat = makeTerrainMat(T);

  // Depress natural terrain slightly under paved areas so ground never clips through paving slabs
  const pavedDepress = (x, z) => {
    const inCourt = x >= -7.1 && x <= 4.0 && z >= -6.6 && z <= 3.6;
    const inGardenPave = x >= 18.1 && x <= 24.9 && z >= -7.8 && z <= 3.8;
    return (inCourt || inGardenPave) ? -0.09 : 0;
  };

  const W = nx + 1, NAT = new Float32Array(W * (nz + 1)), PITH = new Float32Array(W * (nz + 1)), VX = new Float32Array(W * (nz + 1)), VZ = new Float32Array(W * (nz + 1));
  const f = (x, z) => pitY(x, z) - natural(x, z), e = 0.004;
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    let x = X0 + i * step, z = Z0 + j * step; const k = j * W + i;
    const f0 = f(x, z);
    if (Math.abs(f0) < step * 3) {
      const gx = (f(x + e, z) - f(x - e, z)) / (2 * e), gz = (f(x, z + e) - f(x, z - e)) / (2 * e), g2 = gx * gx + gz * gz;
      if (g2 > 1e-6) { const dx = -f0 * gx / g2, dz = -f0 * gz / g2; if (dx * dx + dz * dz < (0.5 * step) ** 2) { x += dx; z += dz; } }
    }
    VX[k] = x; VZ[k] = z; NAT[k] = natural(x, z) + pavedDepress(x, z); PITH[k] = pitY(x, z);
  }
  const inPit = (k) => PITH[k] < NAT[k] - 2e-3;
  const quadPit = (i, j) => inPit(j * W + i) || inPit(j * W + i + 1) || inPit((j + 1) * W + i) || inPit((j + 1) * W + i + 1);
  const surface = (take, hf, wf, mixf, out_ = 0, truth = null) => {
    const outf = typeof out_ === 'function' ? out_ : () => out_, outs = [];
    const map = new Int32Array(W * (nz + 1)).fill(-1), pos = [], wk = [], mix = [], idx = [];
    const vid = (i, j) => {
      const k = j * W + i; if (map[k] >= 0) return map[k];
      const x = VX[k], z = VZ[k], y = hf(k, x, z);
      map[k] = pos.length / 3; pos.push(x, y, z); wk.push(wf(x, y, z, k)); mix.push(...mixf(x, y, z, k)); outs.push(outf(x, y, z, k)); return map[k];
    };
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      if (!take(i, j)) continue;
      const a = vid(i, j), b = vid(i + 1, j), c = vid(i + 1, j + 1), d = vid(i, j + 1);
      if (truth) {
        const y = (v) => pos[v * 3 + 1], mid = truth(X0 + (i + 0.5) * step, Z0 + (j + 0.5) * step);
        if (Math.abs((y(a) + y(c)) / 2 - mid) < Math.abs((y(b) + y(d)) / 2 - mid)) { idx.push(a, d, c, a, c, b); continue; }
      }
      idx.push(a, d, b, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aWeek', new THREE.Float32BufferAttribute(wk, 1));
    g.setAttribute('aOut', new THREE.Float32BufferAttribute(outs, 1));
    g.setAttribute('aMix', new THREE.Float32BufferAttribute(mix, 4));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  };
  const FENCE = [-12, 31, -20, 14];
  const grassW = (x, z) => {
    const d = Math.min(x - FENCE[0], FENCE[1] - x, z - FENCE[2], FENCE[3] - z);
    const n = noise2(x * 0.35, z * 0.35);
    let g = 1 - smooth(-0.6, 2.5 + n * 3, d);
    const away = Math.max(PIT.x0 - 6 - x, x - PIT.x1 - 6, PIT.z0 - 6 - z, z - PIT.z1 - 6);
    g = Math.max(g, 0.7 * smooth(0.55, 0.8, noise2(x * 0.22 + 7, z * 0.22)) * smooth(0, 4, away));
    if (Math.abs(z) < 2.6 && x > PIT.x1) g *= 0.15;
    return clamp(g, 0, 1);
  };
  const xw = (x) => clamp((x - (-10)) / 44, 0, 1), landW = (x) => -1.3 + 0.9 * xw(x), digW = (x) => 0.6 + 2.4 * clamp(x / 22, 0, 1), backW = (x) => BACKFILL + 0.3 * xw(x);

  // Target grade after backfill: matches NAT[k] outside the house, passes cleanly beneath the lower-level window sill (-2.30m),
  // and stays below the lower-level floor slab (-3.65m) inside the building footprint so dirt never enters the room.
  const backfillY = (k, x, z) => {
    let y = NAT[k];
    const winX = smooth(11.4, 12.8, x) * (1 - smooth(17.4, 18.3, x));
    const winZ = smooth(-9.2, -8.0, z) * (1 - smooth(4.0, 5.2, z));
    if (winX * winZ > 0) {
      const sill = -2.38 - 0.82 * clamp((x - 13.0) / 4.2, 0, 1);
      y += (Math.min(y, sill) - y) * (winX * winZ);
    }
    const inRoom = smooth(3.85, 4.15, x) * (1 - smooth(18.02, 18.28, x)) * smooth(-7.85, -7.55, z) * (1 - smooth(3.55, 3.85, z));
    if (inRoom > 0) y += (Math.min(y, -3.65) - y) * inRoom;
    return y;
  };

  // 2D sheet meshes (Tiles 01-06)
  const pitDraw = surface(quadPit, (k, x, z) => Math.min(PITH[k], NAT[k]) + (PITH[k] < NAT[k] - 0.05 ? ruts(x, z) * 0.6 : 0), (x, y, z, k) => (PITH[k] < NAT[k] - 2e-3 ? digW(x) : PITH[k] < NAT[k] + 2e-3 ? 0 : landW(x)),
    (x, y, z, k) => { const cut = NAT[k] - PITH[k]; const floor = y < PIT.y + 0.1 ? 1 : 0; return cut > 2e-3 ? [0, smooth(0.02, 0.3, cut), floor * 0.6, 0] : [grassW(x, z), 0, 0, 0]; }, (x) => backW(x), (x, z) => Math.min(pitY(x, z), natural(x, z)));
  const fillDraw = surface(quadPit, (k) => NAT[k], (x) => backW(x), (x, y, z) => [grassW(x, z), 0, 0, 0]);
  out.push(
    landMesh(pitDraw, null, true),
    landMesh(fillDraw, null, false)
  );

  // 3D pit & continuous bottom-up backfill mesh
  const pitReal = surface(quadPit, (k, x, z) => Math.min(PITH[k], NAT[k]) + (PITH[k] < NAT[k] - 0.05 ? ruts(x, z) * 0.6 : 0), (x, y, z, k) => (PITH[k] < NAT[k] - 2e-3 ? digW(x) : PITH[k] < NAT[k] + 2e-3 ? 0 : landW(x)),
    (x, y, z, k) => { const cut = NAT[k] - PITH[k]; const floor = y < PIT.y + 0.1 ? 1 : 0; return [grassW(x, z), cut > 2e-3 ? smooth(0.02, 0.3, cut) : 0, cut > 2e-3 ? floor * 0.6 : 0, 1]; }, 0, (x, z) => Math.min(pitY(x, z), natural(x, z)));
  const pitTarget = surface(quadPit, backfillY, () => 0, () => [0, 0, 0, 0], 0, (x, z) => Math.min(pitY(x, z), natural(x, z)));
  {
    const tp = pitTarget.attributes.position, tn = pitTarget.attributes.normal, nV = tp.count;
    const natY = new Float32Array(nV);
    for (let i = 0; i < nV; i++) natY[i] = tp.getY(i);
    pitReal.setAttribute('aNatY', new THREE.BufferAttribute(natY, 1));
    pitReal.setAttribute('aNatN', tn);
  }
  const nat = surface((i, j) => !quadPit(i, j), (k, x, z) => NAT[k] + ruts(x, z) * smooth(0.3, 1.5, PITH[k] - NAT[k]) * (1 - grassW(x, z)), landW,
    (x, y, z) => [grassW(x, z), 0, 0, 0]);
  const before = surface(quadPit, (k) => NAT[k], landW, (x, y, z) => [grassW(x, z), 0, 0, 0], (x) => digW(x));
  out.push(landMesh(pitReal, terrainMat, true, false), landMesh(nat, terrainMat), landMesh(before, terrainMat));

  // Spoil heap on the court (lowers smoothly into the court as its earth backfills the foundation hole)
  {
    const hs = phone ? 0.25 : 0.15, n = Math.ceil(HEAP[2] * 2.2 / hs);
    const g = new THREE.PlaneGeometry(HEAP[2] * 2.2, HEAP[2] * 2.2 / 1.25, n, Math.round(n / 1.25)); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, mix = [], natY = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + HEAP[0], z = p.getZ(i) + HEAP[1], h = heapH(x, z), yn = natural(x, z);
      p.setXYZ(i, x, yn + (h > 0.01 ? h + 0.015 : -0.08), z);
      natY.push(yn - 0.08);
      mix.push(0, 1, 0, 2);
    }
    g.setAttribute('aMix', new THREE.Float32BufferAttribute(mix, 4));
    g.setAttribute('aNatY', new THREE.Float32BufferAttribute(natY, 1));
    g.computeVertexNormals();
    stamp(g, (x, y, z) => 1.2 + 1.8 * clamp(1 - Math.hypot(x - HEAP[0], z - HEAP[1]) / HEAP[2], 0, 1), 10.30);
    out.push(landMesh(g, terrainMat, true));
  }

  // Far land to the horizon
  {
    const N = phone ? 120 : 180, E = 1800, warp = (u) => Math.sign(u) * Math.pow(Math.abs(u), 2.3) * E;
    const xs = [], zs = [];
    for (let i = 0; i <= N; i++) { xs.push(12 + warp(i / N * 2 - 1)); zs.push(-3 + warp(i / N * 2 - 1)); }
    const pos = [], mix = [], idx = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { const x = xs[i], z = zs[j]; pos.push(x, natural(x, z) - (x > X0 + 1 && x < X1 - 1 && z > Z0 + 1 && z < Z1 - 1 ? 0.6 : 0), z); mix.push(1, 0, 0, 0); }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (xs[i] >= X0 && xs[i + 1] <= X1 && zs[j] >= Z0 && zs[j + 1] <= Z1) continue;
      const a = j * (N + 1) + i, b = a + 1, c = a + N + 2, d = a + N + 1; idx.push(a, d, b, b, d, c);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aMix', new THREE.Float32BufferAttribute(mix, 4));
    g.setIndex(idx); g.computeVertexNormals(); stamp(g, 0);
    const m = new THREE.Mesh(g, terrainMat); m.userData.sets = { main: terrainMat, paper: null, nd: null }; m.receiveShadow = true; m.frustumCulled = false; out.push(m);
  }

  // Block sides with architectural section hatch (drawing only)
  {
    const [bx0, bz0, bx1, bz1] = [U.uBlock.value.x, U.uBlock.value.y, U.uBlock.value.z, U.uBlock.value.w], yb = -10, s = 0.5, list = [];
    const side = (pts) => {
      const pos = [], idx = [];
      pts.forEach(([x, z], i) => { pos.push(x, natural(x, z), z, x, yb, z); if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); } });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      stamp(g, landW); list.push(g);
    };
    const run = (a, b, f) => { const p = []; for (let t = a; t <= b + 1e-6; t += s) p.push(f(t)); return p; };
    side(run(bx0, bx1, (x) => [x, bz0])); side(run(bx0, bx1, (x) => [x, bz1])); side(run(bz0, bz1, (z) => [bx0, z])); side(run(bz0, bz1, (z) => [bx1, z]));
    const m = new THREE.Mesh(merge(list), DM.hatch); m.userData.sets = { main: null, paper: DM.hatch, nd: DM.ndLand }; m.frustumCulled = false; out.push(m);
  }
  return out;
}
function landMesh(g, mat, tint = false, draw = true) {
  const m = new THREE.Mesh(g, mat || DM.land);
  m.userData.sets = { main: mat, paper: draw ? (tint ? DM.landNew : DM.land) : null, nd: draw ? DM.ndLand : null };
  m.receiveShadow = !!mat; m.castShadow = !!mat;
  if (mat) m.customDepthMaterial = mat.userData.depthMat || DEPTH_WEEKLY;
  m.frustumCulled = false; return m;
}
function makeTerrainMat(T) {
  const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depthMat.onBeforeCompile = (s) => {
    WEEKLY(s);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aMix; attribute float aNatY;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float bf = smoothstep(9.05, 10.25, uNow);
        if (aMix.w > 0.5 && aMix.w < 1.5 && bf > 0.0) {
          float yLevel = bf < 0.52
            ? mix(-4.38, -3.12, smoothstep(0.0, 0.52, bf))
            : mix(-3.12, 0.12, smoothstep(0.52, 1.0, bf));
          float d = yLevel - transformed.y;
          float softRise = transformed.y + 0.5 * (d + sqrt(d * d + 0.012));
          transformed.y = mix(min(aNatY, softRise), aNatY, smoothstep(0.94, 1.0, bf));
        } else if (aMix.w > 1.5 && bf > 0.0) {
          transformed.y = mix(transformed.y, aNatY, smoothstep(0.0, 0.88, bf));
        }`);
  };
  depthMat.customProgramCacheKey = () => 'terrain-depth';

  const m = new THREE.MeshStandardMaterial({ map: T.soil, bumpMap: T.soilBump, bumpScale: 0.035, roughness: 0.95, metalness: 0, envMapIntensity: 0.14 });
  m.userData.depthMat = depthMat;
  m.onBeforeCompile = (s) => {
    WEEKLY(s);
    s.uniforms.tGrass = { value: T.grass }; s.uniforms.tClay = { value: T.clay };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aMix; attribute float aNatY; attribute vec3 aNatN; varying vec4 vMix; varying vec3 vWp; varying float vRisen;')
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float bfN = smoothstep(9.05, 10.25, uNow);
        if (aMix.w > 0.5 && aMix.w < 1.5 && bfN > 0.0) {
          float yLv = bfN < 0.52
            ? mix(-4.38, -3.12, smoothstep(0.0, 0.52, bfN))
            : mix(-3.12, 0.12, smoothstep(0.52, 1.0, bfN));
          float dN = yLv - position.y;
          float sRise = position.y + 0.5 * (dN + sqrt(dN * dN + 0.012));
          float yC = mix(min(aNatY, sRise), aNatY, smoothstep(0.94, 1.0, bfN));
          float onBed = smoothstep(-0.08, 0.08, dN) * (1.0 - smoothstep(aNatY - 0.14, aNatY, sRise));
          vec3 nCur = normalize(mix(objectNormal, vec3(0.0, 1.0, 0.0), onBed * 0.88));
          float atTop = smoothstep(aNatY - 0.16, aNatY - 0.005, yC);
          objectNormal = normalize(mix(nCur, aNatN, max(atTop, smoothstep(0.94, 1.0, bfN))));
        }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float bf = smoothstep(9.05, 10.25, uNow);
        float vPitY = transformed.y;
        vRisen = 0.0;
        if (aMix.w > 0.5 && aMix.w < 1.5 && bf > 0.0) {
          float yLevel = bf < 0.52
            ? mix(-4.38, -3.12, smoothstep(0.0, 0.52, bf))
            : mix(-3.12, 0.12, smoothstep(0.52, 1.0, bf));
          float d = yLevel - vPitY;
          float softRise = vPitY + 0.5 * (d + sqrt(d * d + 0.012));
          transformed.y = mix(min(aNatY, softRise), aNatY, smoothstep(0.94, 1.0, bf));
          vRisen = max(smoothstep(0.015, 0.10, transformed.y - vPitY), smoothstep(0.92, 1.0, bf));
        } else if (aMix.w > 1.5 && bf > 0.0) {
          transformed.y = mix(vPitY, aNatY, smoothstep(0.0, 0.88, bf));
        }
        vMix = aMix;
        vWp = (modelMatrix * vec4(transformed, 1.)).xyz;`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tGrass, tClay; varying vec4 vMix; varying vec3 vWp; varying float vRisen;')
      .replace('#include <map_fragment>', `
        vec2 q = vWp.xz;
        vec3 soil = texture2D(map, q / 3.0).rgb * mix(.84, 1.12, texture2D(map, q / 23.).r);
        vec3 grass = texture2D(tGrass, q / 3.8).rgb * mix(.86, 1.12, texture2D(tGrass, q / 29. + .37).g);
        vec3 clay = texture2D(tClay, q / 2.8).rgb * mix(.86, 1.1, texture2D(tClay, q / 19. + .5).r);
        float clayK = vMix.y * (1.0 - vRisen);
        float floorK = vMix.z * (1.0 - vRisen);
        float gard = smoothstep(32.5, 35.0, uNow - .03 * (vWp.x + 12.));
        vec3 base = mix(soil, grass, max(smoothstep(.15, .85, vMix.x), gard));
        base = mix(base, clay, clayK);
        base *= mix(vec3(1.), vec3(.90, 1.04, .82), gard * (1. - clayK));
        base *= 1. - floorK * .20;
        diffuseColor.rgb = base;`);
  };
  m.customProgramCacheKey = () => 'terrain';
  return m;
}

// ---------------------------------------------------------------- engineered edge-protection guardrail & safety mesh around the pit
function barrier(R) {
  const pts = [];
  const r0 = (x, z) => (natural(x, z) - PIT.y) / PIT.k + 1.1;
  const ring = [];
  for (let x = 19.6; x >= PIT.x0; x -= 0.5) ring.push([x, 1]);
  for (let a = 0; a <= Math.PI / 2 + 1e-6; a += Math.PI / 16) ring.push(['c1', a]);
  for (let z = PIT.z1; z >= PIT.z0; z -= 0.5) ring.push([z, 2]);
  for (let a = 0; a <= Math.PI / 2 + 1e-6; a += Math.PI / 16) ring.push(['c2', a]);
  for (let x = PIT.x0; x <= 19.6; x += 0.5) ring.push([x, 3]);
  for (const r of ring) {
    let x, z;
    for (let it = 0, rr = 3; it < 4; it++) {
      if (r[1] === 1) { x = r[0]; z = PIT.z1 + rr; } else if (r[1] === 3) { x = r[0]; z = PIT.z0 - rr; } else if (r[1] === 2) { x = PIT.x0 - rr; z = r[0]; }
      else if (r[0] === 'c1') { x = PIT.x0 - Math.sin(r[1]) * rr; z = PIT.z1 + Math.cos(r[1]) * rr; } else { x = PIT.x0 - Math.cos(r[1]) * rr; z = PIT.z0 - Math.sin(r[1]) * rr; }
      rr = r0(x, z);
    }
    const gap = r[1] === 1 && x > 11.0 && x < 16.6;
    pts.push([x, z, gap ? 0 : natural(x, z) - PIT.y]);
  }
  const runs = []; let cur = [];
  for (const p of pts) { if (p[2] > 1.25) cur.push(p); else if (cur.length) { runs.push(cur); cur = []; } }
  if (cur.length) runs.push(cur);
  const net = [], tubes = [], boards = [];
  const tubeSeg = (a, b, r) => {
    const d = b.clone().sub(a), len = d.length();
    const g = new THREE.CylinderGeometry(r, r, len, 6);
    g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()));
    g.translate(a.x, a.y, a.z);
    tubes.push(g);
  };
  for (const run of runs) {
    const pos = [], uv = [], idx = []; let u = 0;
    run.forEach(([x, z], i) => {
      const y = natural(x, z);
      if (i) {
        const [px, pz] = run[i - 1], py = natural(px, pz);
        u += Math.hypot(x - px, z - pz);
        // Top & mid galvanised safety rails
        tubeSeg(V(px, py + 1.05, pz), V(x, y + 1.05, z), 0.022);
        tubeSeg(V(px, py + 0.54, pz), V(x, y + 0.54, z), 0.018);
      }
      pos.push(x, y + 0.16, z, x, y + 0.96, z); uv.push(u / 0.5, 0, u / 0.5, 1);
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      if (i % 4 === 0 || i === run.length - 1) {
        const c = new THREE.CylinderGeometry(0.024, 0.024, 1.15, 8); c.translate(x, y + 0.56, z); tubes.push(c);
        const bp = new THREE.BoxGeometry(0.14, 0.02, 0.14); bp.translate(x, y + 0.01, z); boards.push(bp);
      }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals(); net.push(g.toNonIndexed());
  }
  const bOut = (x, y, z) => 8.70 + 0.42 * clamp((x - 2) / 18, 0, 1) + 0.15 * clamp((y - natural(x, z)) / 1.15, 0, 1);
  const ng = mergeGeometries(net); stamp(ng, 0.8, bOut);
  const tg = merge(tubes); stamp(tg, 0.8, bOut);
  const bg = merge(boards); stamp(bg, 0.8, bOut);
  const a = new THREE.Mesh(ng, R.net); a.userData.sets = { main: R.net, paper: null, nd: null }; a.castShadow = true; a.receiveShadow = true; a.customDepthMaterial = DEPTH_WEEKLY;
  const b = new THREE.Mesh(tg, R.galv); b.userData.sets = { main: R.galv, paper: null, nd: null }; b.castShadow = true; b.customDepthMaterial = DEPTH_WEEKLY;
  const c = new THREE.Mesh(bg, R.timber); c.userData.sets = { main: R.timber, paper: null, nd: null }; c.castShadow = true; c.customDepthMaterial = DEPTH_WEEKLY;
  return [a, b, c];
}

// the site fence: mesh panels on concrete feet, a gate where the track leaves
function fence(R) {
  const [x0, x1, z0, z1] = [-12, 31, -20, 14];
  const frame = [], wire = [], feet = [];
  const panel = (ax, az, bx, bz) => {
    const ya = natural(ax, az), yb = natural(bx, bz), len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bz - az, bx - ax);
    const q = new THREE.PlaneGeometry(len - 0.08, 1.9); q.translate(len / 2, 1.05, 0); q.rotateY(-ang); q.translate(ax, (ya + yb) / 2, az);
    const p = q.attributes.position, uv = q.attributes.uv;
    for (let i = 0; i < p.count; i++) { const t = ((p.getX(i) - ax) * (bx - ax) + (p.getZ(i) - az) * (bz - az)) / (len * len); p.setY(i, p.getY(i) + (yb - ya) * (t - 0.5)); uv.setXY(i, uv.getX(i) * len / 0.5, uv.getY(i) * 1.9 / 1.0); }
    wire.push(q);
    for (const [t] of [[0.01], [0.99]]) {
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ya + (yb - ya) * t;
      const c = new THREE.CylinderGeometry(0.022, 0.022, 2.0, 6); c.translate(x, y + 1.05, z); frame.push(c);
      const f = new THREE.BoxGeometry(0.62, 0.14, 0.2); f.rotateY(-ang + Math.PI / 2); f.translate(x, y + 0.07, z); feet.push(f);
    }
    for (const h of [0.08, 2.0]) { const r = new THREE.CylinderGeometry(0.02, 0.02, len, 6); r.rotateZ(Math.PI / 2); r.translate(len / 2, 0, 0); r.rotateY(-ang); r.translate(ax, 0, az); const rp = r.attributes.position; for (let i = 0; i < rp.count; i++) { const t = ((rp.getX(i) - ax) * (bx - ax) + (rp.getZ(i) - az) * (bz - az)) / (len * len); rp.setY(i, rp.getY(i) + ya + (yb - ya) * t + h); } frame.push(r); }
  };
  const edge = (ax, az, bx, bz, gap) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 3.45);
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, mx = ax + (bx - ax) * (t0 + t1) / 2, mz = az + (bz - az) * (t0 + t1) / 2;
      if (gap && gap(mx, mz)) continue;
      panel(ax + (bx - ax) * t0, az + (bz - az) * t0, ax + (bx - ax) * t1, az + (bz - az) * t1);
    }
  };
  edge(x0, z0, x1, z0); edge(x0, z1, x1, z1); edge(x0, z0, x0, z1); edge(x1, z0, x1, z1, (x, z) => Math.abs(z) < 3.2);
  const out = [];
  for (const [list, m, sh] of [[frame, R.galv, true], [wire, R.wire, true], [feet, R.block, true]]) {
    const g = merge(list); stamp(g, 0.2, 33);
    const mesh = new THREE.Mesh(g, m); mesh.userData.sets = { main: m, paper: null, nd: null }; mesh.castShadow = sh; mesh.receiveShadow = true; mesh.customDepthMaterial = DEPTH_WEEKLY; out.push(mesh);
  }
  return out;
}
