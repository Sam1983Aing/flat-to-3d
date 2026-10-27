// The house, part by part.
// Every part carries the phase that builds it and its place inside that phase.
// PHASES is the programme: the Gantt chart is drawn from it, and update(week)
// decides from it which parts exist. Same table, so the chart is the build.
import * as THREE from 'three';

export const START = new Date(2027, 2, 1);   // Monday 1 March 2027
export const WEEKS = 14;                     // handover Friday 4 June 2027
export const PHASES = [
  { n: 0, code: 'TR-01', wbs: 'PRELIM', name: 'Site set-up',       w0: 0.0,  w1: 0.8,  spec: 'Heras perimeter · welfare cabin · datum profiles' },
  { n: 1, code: 'TR-02', wbs: 'GROUND', name: 'Excavation',        w0: 0.6,  w1: 1.8,  spec: '750mm reduced-level dig · 84 m³ spoil heap' },
  { n: 2, code: 'TR-03', wbs: 'SUBSTR', name: 'Foundations',       w0: 1.6,  w1: 3.6,  spec: 'C35 RC pad footings · 600×450 ring beam · 100 EPS · 300 slab' },
  { n: 3, code: 'TR-04', wbs: 'TIMBER', name: 'Structure',         w0: 3.6,  w1: 5.4,  spec: '5× GL28c spruce portal frames · steel base shoes' },
  { n: 4, code: 'TR-05', wbs: 'DECK',   name: 'Floors',            w0: 5.2,  w1: 6.4,  spec: '100mm 5-ply CLT mezzanine deck · glulam straight stair' },
  { n: 5, code: 'TR-06', wbs: 'ENVEL',  name: 'Walls',             w0: 6.2,  w1: 8.2,  spec: '240mm closed-panel timber cassettes · OSB/3 sheathing' },
  { n: 6, code: 'TR-07', wbs: 'ROOF',   name: 'Roof',              w0: 7.8,  w1: 9.6,  spec: '260mm insulated cassettes · standing-seam VMZinc' },
  { n: 7, code: 'TR-08', wbs: 'GLAZE',  name: 'Windows and doors', w0: 9.4,  w1: 10.6, spec: 'Triple-glazed alu frames · east gable curtain wall' },
  { n: 8, code: 'TR-09', wbs: 'FITOUT', name: 'Finishes',          w0: 10.4, w1: 13.2, spec: 'Charred larch cladding · lime plaster · European oak' },
  { n: 9, code: 'TR-10', wbs: 'HANDVR', name: 'Furniture',         w0: 13.1, w1: 13.5, spec: 'Bespoke joinery · cast-iron hearth · key handover' },
];

export const C = {
  paper: 0xf2efe7, ink: 0x1d1c19, accent: 0xe85d04,
  earth: 0x9B8468, earthDark: 0x7E6850, concrete: 0xBDB8AE, eps: 0xEFECE4,
  glulam: 0xC89B62, clt: 0xDAB98B, sheathing: 0xD8C7A4, cladding: 0x35312D,
  roof: 0x4E5358, frame: 0x262523, glass: 0xC6DCE0, plaster: 0xF4F1EA,
  oak: 0xC9A679, deck: 0xAA8A67, lawn: 0x8F9C6E, gravel: 0xCEC6B6,
  plant: 0x67784C, fabric: 0xE2DDD2, dark: 0x242321, machine: 0xCF9E3E,
  cabin: 0xC2C8C9, mud: 0xD3C6B0, steel: 0x565B60, stone: 0x3D3A36,
  travertine: 0xDDD0B8, brass: 0xCFA862, leather: 0x8A5232, terracotta: 0xB85D3B,
};

const DAY = 864e5;
// The programme counts working days: five a week, the last one is Friday 4 June.
export const dateAt = w => {
  const d = Math.min(Math.floor(Math.max(0, w) * 5 + 1e-6), WEEKS * 5 - 1);
  return new Date(START.getTime() + (Math.floor(d / 5) * 7 + (d % 5)) * DAY);
};
export const clamp01 = v => Math.min(1, Math.max(0, v));
export const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut = s => 1 - Math.pow(1 - s, 3);

// House dimensions, metres. x runs west to east along the ridge, z north to south.
export const HX = 6, HZ = 3.5, FL = 0.15, EAVE = 3.4, RIDGE = EAVE + HZ, MEZZ = 2.95;
export const BAYS = [-6, -3, 0, 3, 6];
export const PIT = { x0: -6.7, x1: 6.7, z0: -4.2, z1: 4.2, depth: 0.75 };
export const DOOR = { x: 1.55, z: HZ };

// ------------------------------------------------------------------ deterministic PRNG & procedural material library
let _seed = 42;
const rnd = () => {
  _seed = (_seed + 0x6D2B79F5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

let _texCache = null;
function getTextures() {
  if (_texCache) return _texCache;
  _seed = 42;

  const makeTex = (w, h, rx, ry, draw, srgb = true) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };

  const addGrain = (g, w, h, amp) => {
    const id = g.getImageData(0, 0, w, h);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const k = (rnd() - 0.5) * amp;
      d[i] = Math.min(255, Math.max(0, d[i] + k));
      d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + k));
      d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + k));
    }
    g.putImageData(id, 0, 0);
  };

  // 1. Shuttered / board-formed C35 architectural concrete
  const concreteMap = makeTex(512, 512, 1 / 2.2, 1 / 2.2, (g, w, h) => {
    g.fillStyle = '#eeece6'; g.fillRect(0, 0, w, h);
    const rows = 12;
    for (let r = 0; r < rows; r++) {
      const y = r * (h / rows), v = Math.round(232 + (rnd() - 0.5) * 16);
      g.fillStyle = `rgb(${v},${v - 1},${v - 4})`;
      g.fillRect(0, y, w, h / rows);
      for (let k = 0; k < 14; k++) {
        g.fillStyle = `rgba(85,78,68,${0.03 + rnd() * 0.04})`;
        g.fillRect(0, y + rnd() * (h / rows), w, 1 + rnd() * 1.6);
      }
      g.fillStyle = 'rgba(38,34,30,0.24)';
      g.fillRect(0, y, w, 2);
      g.fillStyle = 'rgba(255,253,248,0.24)';
      g.fillRect(0, y + 2, w, 1.5);
    }
    for (let c = 0; c < 2; c++) {
      const x = c * (w / 2);
      g.fillStyle = 'rgba(38,34,30,0.20)';
      g.fillRect(x, 0, 2, h);
    }
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const cx = (c + 0.5) * (w / 4), cy = (r + 0.5) * (h / 4);
      g.fillStyle = 'rgba(32,29,25,0.46)';
      g.beginPath(); g.arc(cx, cy, 4.2, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.32)'; g.lineWidth = 1.4;
      g.beginPath(); g.arc(cx, cy, 5.8, 0, Math.PI * 2); g.stroke();
    }
    addGrain(g, w, h, 14);
  });
  const concreteBump = makeTex(512, 512, 1 / 2.2, 1 / 2.2, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 12; r++) {
      const y = r * (h / 12);
      g.fillStyle = '#222222'; g.fillRect(0, y, w, 2.4);
      g.fillStyle = '#c4c4c4'; g.fillRect(0, y + 2.4, w, 1.8);
    }
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const cx = (c + 0.5) * (w / 4), cy = (r + 0.5) * (h / 4);
      g.fillStyle = '#141414';
      g.beginPath(); g.arc(cx, cy, 4.4, 0, Math.PI * 2); g.fill();
    }
    addGrain(g, w, h, 24);
  }, false);

  // 2. Earth / excavation strata & trench floor
  const earthMap = makeTex(256, 256, 1 / 2.0, 1 / 1.2, (g, w, h) => {
    g.fillStyle = '#ebe5dc'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) {
      const v = Math.round(222 + Math.sin(y * 0.09) * 14 + (rnd() - 0.5) * 16);
      g.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
      g.fillRect(0, y, w, 8);
    }
    for (let i = 0; i < 320; i++) {
      const x = rnd() * w, y = rnd() * h, r = 1.2 + rnd() * 3.2;
      g.fillStyle = rnd() > 0.45 ? 'rgba(55,42,28,0.28)' : 'rgba(255,250,240,0.26)';
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    addGrain(g, w, h, 24);
  });
  const earthBump = makeTex(256, 256, 1 / 2.0, 1 / 1.2, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 420; i++) {
      const x = rnd() * w, y = rnd() * h, r = 1.5 + rnd() * 3.5;
      g.fillStyle = rnd() > 0.5 ? '#c8c8c8' : '#303030';
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    addGrain(g, w, h, 32);
  }, false);

  // 3. EPS rigid cellular insulation board grid
  const epsMap = makeTex(256, 256, 1 / 1.8, 1 / 1.8, (g, w, h) => {
    g.fillStyle = '#f7f7f4'; g.fillRect(0, 0, w, h);
    const rows = 4, cols = 2;
    for (let r = 0; r < rows; r++) {
      const y = r * (h / rows);
      g.fillStyle = 'rgba(40,38,34,0.28)'; g.fillRect(0, y, w, 2);
      const off = (r % 2) * (w / 4);
      for (let c = 0; c < cols; c++) {
        const x = (c * (w / cols) + off) % w;
        g.fillRect(x, y, 2, h / rows);
      }
    }
    addGrain(g, w, h, 12);
  });

  // 4. Compacted gravel / crushed aggregate
  const gravelMap = makeTex(256, 256, 1 / 1.4, 1 / 1.4, (g, w, h) => {
    g.fillStyle = '#ece8df'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const x = rnd() * w, y = rnd() * h, rw = 2 + rnd() * 4.5, rh = 1.8 + rnd() * 3.8;
      const v = Math.round(190 + rnd() * 60);
      g.fillStyle = `rgb(${v},${v - 2},${v - 5})`;
      g.fillRect(x, y, rw, rh);
    }
    addGrain(g, w, h, 22);
  });

  // 5. Glulam / engineered spruce timber (laminations + warm cathedral grain)
  const glulamMap = makeTex(512, 512, 1 / 2.4, 1 / 0.65, (g, w, h) => {
    g.fillStyle = '#f4ede0'; g.fillRect(0, 0, w, h);
    const lams = 12;
    const lh = h / lams;
    for (let r = 0; r < lams; r++) {
      const y = r * lh, v = Math.round(236 + (rnd() - 0.5) * 20);
      g.fillStyle = `rgb(${v},${v - 5},${v - 13})`;
      g.fillRect(0, y, w, lh);
      for (let k = 0; k < 34; k++) {
        const gy = y + rnd() * lh;
        g.fillStyle = `rgba(92,54,18,${0.045 + rnd() * 0.08})`;
        g.fillRect(0, gy, w, 0.8 + rnd() * 1.8);
      }
      for (let k = 0; k < 10; k++) {
        const gy = y + rnd() * lh;
        g.fillStyle = `rgba(255,244,225,${0.04 + rnd() * 0.06})`;
        g.fillRect(0, gy, w, 1.0 + rnd() * 2.2);
      }
      g.fillStyle = 'rgba(68,38,14,0.34)';
      g.fillRect(0, y, w, 1.5);
    }
    addGrain(g, w, h, 9);
  });
  const woodBump = makeTex(512, 512, 1 / 2.4, 1 / 0.65, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    const lams = 12, lh = h / lams;
    for (let r = 0; r < lams; r++) {
      const y = r * lh;
      g.fillStyle = '#282828'; g.fillRect(0, y, w, 1.8);
      g.fillStyle = '#b8b8b8'; g.fillRect(0, y + 1.8, w, 1.2);
      for (let k = 0; k < 32; k++) {
        g.fillStyle = 'rgba(28,28,28,0.28)';
        g.fillRect(0, y + rnd() * lh, w, 1.1);
      }
    }
    addGrain(g, w, h, 15);
  }, false);

  // 6. CLT panels & wide-plank European Oak floorboards
  const plankMap = makeTex(512, 512, 1 / 2.2, 1 / 1.4, (g, w, h) => {
    g.fillStyle = '#f3ede2'; g.fillRect(0, 0, w, h);
    const rows = 10, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      const y = r * rh;
      let x = -rnd() * w * 0.5;
      while (x < w) {
        const bw = w * (0.48 + rnd() * 0.55);
        const v = Math.round(234 + (rnd() - 0.5) * 20);
        g.fillStyle = `rgb(${v},${v - 4},${v - 11})`;
        g.fillRect(x, y, bw, rh);
        for (let k = 0; k < 28; k++) {
          g.fillStyle = `rgba(82,48,18,${0.045 + rnd() * 0.075})`;
          g.fillRect(x, y + rnd() * rh, bw, 1.0 + rnd() * 1.5);
        }
        for (let k = 0; k < 8; k++) {
          g.fillStyle = `rgba(255,244,225,${0.04 + rnd() * 0.05})`;
          g.fillRect(x, y + rnd() * rh, bw, 1.2 + rnd() * 2.0);
        }
        g.fillStyle = 'rgba(38,22,8,0.44)';
        g.fillRect(x, y, 2.0, rh);
        x += bw;
      }
      g.fillStyle = 'rgba(38,22,8,0.42)';
      g.fillRect(0, y, w, 1.8);
    }
    addGrain(g, w, h, 9);
  });

  // 7. OSB / structural wall sheathing cassettes (1.2m × 2.4m panel grid + strand texture)
  const sheathingMap = makeTex(512, 512, 1 / 2.4, 1 / 2.4, (g, w, h) => {
    g.fillStyle = '#f2ede2'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      const x = rnd() * w, y = rnd() * h;
      const sw = 4 + rnd() * 12, sh = 1.5 + rnd() * 3.5;
      g.fillStyle = rnd() > 0.48 ? 'rgba(125,88,42,0.13)' : 'rgba(255,248,232,0.20)';
      g.fillRect(x, y, sw, sh);
    }
    for (let c = 0; c < 2; c++) {
      const x = c * (w / 2);
      g.fillStyle = 'rgba(42,32,18,0.42)';
      g.fillRect(x, 0, 2.6, h);
      g.fillStyle = 'rgba(42,32,18,0.16)';
      for (let ny = 12; ny < h; ny += 24) {
        g.fillRect(x + w / 4, ny, 2, 2);
      }
    }
    g.fillStyle = 'rgba(42,32,18,0.32)';
    g.fillRect(0, 0, w, 2.4);
    addGrain(g, w, h, 11);
  });

  // 8. Vertical charred-larch board-on-batten cladding (Shou Sugi Ban)
  const claddingMap = makeTex(512, 512, 1 / 1.1, 1 / 2.4, (g, w, h) => {
    g.fillStyle = '#e6e4e0'; g.fillRect(0, 0, w, h);
    const boards = 10, bw = w / boards;
    for (let i = 0; i < boards; i++) {
      const x = i * bw;
      const v = 208 + ((i * 37) % 5) * 9;
      g.fillStyle = `rgb(${v},${v - 2},${v - 4})`;
      g.fillRect(x + 4, 0, bw - 4, h);
      for (let k = 0; k < 36; k++) {
        const gx = x + 4 + rnd() * (bw - 6);
        g.fillStyle = 'rgba(0,0,0,0.09)';
        g.fillRect(gx, 0, 1.4, h);
      }
      g.fillStyle = 'rgba(0,0,0,0.68)';
      g.fillRect(x, 0, 4.2, h);
      g.fillStyle = 'rgba(255,255,255,0.24)';
      g.fillRect(x + 4.2, 0, 2.0, h);
    }
    addGrain(g, w, h, 11);
  });
  const claddingBump = makeTex(512, 512, 1 / 1.1, 1 / 2.4, (g, w, h) => {
    g.fillStyle = '#b4b4b4'; g.fillRect(0, 0, w, h);
    const boards = 10, bw = w / boards;
    for (let i = 0; i < boards; i++) {
      const x = i * bw;
      g.fillStyle = '#080808';
      g.fillRect(x, 0, 5, h);
      g.fillStyle = '#ececec';
      g.fillRect(x + 5, 0, 2.5, h);
      for (let k = 0; k < 28; k++) {
        g.fillStyle = 'rgba(35,35,35,0.28)';
        g.fillRect(x + 5 + rnd() * (bw - 7), 0, 1.2, h);
      }
    }
    addGrain(g, w, h, 15);
  }, false);

  // 9. Standing-seam VMZinc roof cassettes
  const roofMap = makeTex(512, 512, 1 / 1.6, 1 / 2.4, (g, w, h) => {
    g.fillStyle = '#e2e5e8'; g.fillRect(0, 0, w, h);
    const bays = 4, bw = w / bays;
    for (let i = 0; i < bays; i++) {
      const x = i * bw, v = 222 + ((i * 19) % 4) * 6;
      g.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
      g.fillRect(x, 0, bw, h);
      // subtle brushed zinc longitudinal grain
      for (let k = 0; k < 24; k++) {
        g.fillStyle = 'rgba(30,36,42,0.04)';
        g.fillRect(x + rnd() * bw, 0, 1.5, h);
      }
      g.fillStyle = 'rgba(12,15,18,0.62)';
      g.fillRect(x, 0, 4.5, h);
      g.fillStyle = 'rgba(255,255,255,0.48)';
      g.fillRect(x + 4.5, 0, 3.0, h);
    }
    g.fillStyle = 'rgba(20,22,25,0.24)';
    g.fillRect(0, h / 2, w, 2.0);
    addGrain(g, w, h, 8);
  });
  const roofBump = makeTex(512, 512, 1 / 1.6, 1 / 2.4, (g, w, h) => {
    g.fillStyle = '#787878'; g.fillRect(0, 0, w, h);
    const bays = 4, bw = w / bays;
    for (let i = 0; i < bays; i++) {
      const x = i * bw;
      g.fillStyle = '#ffffff';
      g.fillRect(x, 0, 5.0, h);
      g.fillStyle = '#141414';
      g.fillRect(x + 5.0, 0, 3.5, h);
    }
    g.fillStyle = '#383838';
    g.fillRect(0, h / 2, w, 2.5);
    addGrain(g, w, h, 10);
  }, false);

  // 10. Troweled lime plaster
  const plasterMap = makeTex(512, 512, 1 / 2.5, 1 / 2.5, (g, w, h) => {
    g.fillStyle = '#f7f4ed'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 45; i++) {
      g.fillStyle = i % 2 ? 'rgba(255,253,248,0.06)' : 'rgba(185,174,156,0.05)';
      g.beginPath(); g.arc(rnd() * w, rnd() * h, 20 + rnd() * 55, 0, Math.PI * 2); g.fill();
    }
    addGrain(g, w, h, 6);
  });
  const plasterBump = makeTex(512, 512, 1 / 2.5, 1 / 2.5, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 65; i++) {
      g.fillStyle = i % 2 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
      g.beginPath(); g.arc(rnd() * w, rnd() * h, 16 + rnd() * 44, 0, Math.PI * 2); g.fill();
    }
    addGrain(g, w, h, 12);
  }, false);

  // 11. Woven Belgian linen & hand-loomed Berber wool rug
  const fabricBump = makeTex(256, 256, 1 / 0.4, 1 / 0.4, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) { g.fillStyle = 'rgba(255,255,255,0.24)'; g.fillRect(0, y, w, 1.5); }
    for (let x = 0; x < w; x += 4) { g.fillStyle = 'rgba(0,0,0,0.24)'; g.fillRect(x, 0, 1.5, h); }
    addGrain(g, w, h, 24);
  }, false);

  const rugMap = makeTex(512, 512, 1 / 1.6, 1 / 1.6, (g, w, h) => {
    g.fillStyle = '#d4c8b4'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) {
      g.fillStyle = y % 8 === 0 ? 'rgba(255,250,240,0.22)' : 'rgba(78,66,50,0.16)';
      g.fillRect(0, y, w, 2.0);
      for (let x = (y % 8 === 0 ? 0 : 3); x < w; x += 6) {
        g.fillStyle = rnd() < 0.5 ? 'rgba(250,244,232,0.18)' : 'rgba(82,70,54,0.16)';
        g.fillRect(x, y, 3.2, 2.0);
      }
    }
    g.strokeStyle = 'rgba(78,65,48,0.36)'; g.lineWidth = 8; g.strokeRect(16, 16, w - 32, h - 32);
    addGrain(g, w, h, 16);
  });

  // 12. Travertine stone
  const travertineMap = makeTex(512, 512, 1 / 1.4, 1 / 1.4, (g, w, h) => {
    g.fillStyle = '#e4d8c2'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2 + rnd() * 5) {
      g.fillStyle = `rgba(${rnd() < 0.5 ? '148,126,95' : '248,238,220'},${0.10 + rnd() * 0.12})`;
      g.fillRect(0, y, w, 1 + rnd() * 2.5);
    }
    for (let i = 0; i < 320; i++) {
      g.fillStyle = 'rgba(105,86,62,0.38)';
      g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 14, 1 + rnd() * 1.6);
    }
    addGrain(g, w, h, 8);
  });

  // 13. Striped garden lawn turf & dappled foliage bump
  const lawnMap = makeTex(512, 512, 1 / 3.4, 1 / 3.4, (g, w, h) => {
    g.fillStyle = '#dce2cb'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 === 0 ? 'rgba(235,238,195,0.14)' : 'rgba(48,64,26,0.08)';
      g.fillRect(0, i * (h / 8), w, h / 8);
    }
    for (let i = 0; i < 6000; i++) {
      const r = rnd();
      g.fillStyle = r < 0.45 ? 'rgba(42,58,20,0.18)' : 'rgba(165,178,108,0.16)';
      g.fillRect(rnd() * w, rnd() * h, 1.2, 2.5 + rnd() * 3.0);
    }
    addGrain(g, w, h, 14);
  });

  const foliageBump = makeTex(256, 256, 1 / 0.9, 1 / 0.9, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = i % 2 === 0 ? 'rgba(245,245,245,0.38)' : 'rgba(20,20,20,0.38)';
      g.beginPath(); g.arc(rnd() * w, rnd() * h, 2.2 + rnd() * 4.5, 0, Math.PI * 2); g.fill();
    }
    addGrain(g, w, h, 24);
  }, false);

  // 14. Framed architectural artworks for the interior walls
  const art1 = makeTex(512, 512, 1, 1, (g, w, h) => {
    g.fillStyle = '#f1e9da'; g.fillRect(0, 0, w, h);
    const pad = 28;
    g.fillStyle = '#e6dccb'; g.fillRect(pad, pad, w - pad * 2, h - pad * 2);
    g.fillStyle = '#c84b24'; g.fillRect(pad + 14, pad + 14, 210, h - pad * 2 - 28);
    g.fillStyle = '#dba456'; g.fillRect(pad + 236, pad + 14, w - pad * 2 - 250, 190);
    g.fillStyle = '#242320'; g.fillRect(pad + 236, pad + 216, w - pad * 2 - 250, h - pad * 2 - 230);
    g.fillStyle = '#f4ede0'; g.beginPath(); g.arc(pad + 230, h * 0.52, 54, 0, Math.PI * 2); g.fill();
    addGrain(g, w, h, 12);
  });
  art1.wrapS = art1.wrapT = THREE.ClampToEdgeWrapping;

  _texCache = {
    concreteMap, concreteBump,
    earthMap, earthBump,
    epsMap,
    gravelMap,
    glulamMap, woodBump,
    plankMap,
    sheathingMap,
    claddingMap, claddingBump,
    roofMap, roofBump,
    plasterMap, plasterBump,
    fabricBump,
    rugMap,
    travertineMap,
    lawnMap,
    foliageBump,
    art1,
  };
  return _texCache;
}

// World-scale / metric box UV projection so BoxGeometry and ExtrudeGeometry never stretch textures
function applyMetricUV(geo, mode = 'box') {
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  if (!pos || !norm) return geo;
  let uv = geo.attributes.uv;
  if (!uv || uv.count !== pos.count) {
    uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
    geo.setAttribute('uv', uv);
  }
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(norm.getX(i)), ny = Math.abs(norm.getY(i)), nz = Math.abs(norm.getZ(i));
    if (mode === 'beam') {
      if (nx > ny && nx > nz) uv.setXY(i, z, y);
      else if (ny >= nx && ny >= nz) uv.setXY(i, z, x);
      else uv.setXY(i, x, y);
    } else if (mode === 'post') {
      if (ny > nx && ny > nz) uv.setXY(i, x, z);
      else if (nx > nz) uv.setXY(i, y, z);
      else uv.setXY(i, y, x);
    } else {
      if (ny > nx && ny > nz) uv.setXY(i, x, z);
      else if (nx > nz) uv.setXY(i, z, y);
      else uv.setXY(i, x, y);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

// Create an organic multi-clustered foliage geometry with smooth botanical shading
function makeOrganicClusterGeo(rx, ry, rz, detail = 2) {
  const segW = detail >= 2 ? 24 : 16;
  const segH = detail >= 2 ? 18 : 12;
  const g = new THREE.SphereGeometry(1, segW, segH);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
    const n = 1 + 0.08 * Math.sin(vx * 3.2 + vy * 2.4) + 0.06 * Math.cos(vz * 3.6 - vx * 2.1);
    pos.setXYZ(i, vx * rx * n, vy * ry * (vy < 0 ? 0.82 : 1.04) * n, vz * rz * n);
  }
  g.computeVertexNormals();
  return applyMetricUV(g);
}

export function buildHouse(opts = {}) {
  const root = new THREE.Group();
  const parts = [];
  const ghostRoot = new THREE.Group();
  const accent = new THREE.Color(C.accent);
  const inkCol = new THREE.Color(C.ink);
  // Subtle 0.22 opacity architectural edge linework so 3D materials read realistically without cartoon outlines
  const ink = new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0.22 });
  const dash = new THREE.LineDashedMaterial({ color: C.ink, dashSize: 0.16, gapSize: 0.11, transparent: true, opacity: 0.45 });
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const TX = getTextures();

  // Map trade colors to realistic PBR textures, bump relief, roughness, and metalness
  function tradeProps(color) {
    switch (color) {
      case C.concrete:
        return { map: TX.concreteMap, bumpMap: TX.concreteBump, bumpScale: 0.022, roughness: 0.76, envMapIntensity: 0.55 };
      case C.earth:
      case C.earthDark:
      case C.mud:
        return { map: TX.earthMap, bumpMap: TX.earthBump, bumpScale: 0.028, roughness: 0.94, envMapIntensity: 0.25 };
      case C.eps:
        return { map: TX.epsMap, bumpMap: TX.concreteBump, bumpScale: 0.008, roughness: 0.74, envMapIntensity: 0.35 };
      case C.gravel:
        return { map: TX.gravelMap, bumpMap: TX.earthBump, bumpScale: 0.028, roughness: 0.90, envMapIntensity: 0.3 };
      case C.glulam:
        return { map: TX.glulamMap, bumpMap: TX.woodBump, bumpScale: 0.018, roughness: 0.46, envMapIntensity: 0.78 };
      case C.clt:
        return { map: TX.plankMap, bumpMap: TX.woodBump, bumpScale: 0.015, roughness: 0.52, envMapIntensity: 0.72 };
      case C.sheathing:
        return { map: TX.sheathingMap, bumpMap: TX.woodBump, bumpScale: 0.016, roughness: 0.72, envMapIntensity: 0.45 };
      case C.cladding:
        return { map: TX.claddingMap, bumpMap: TX.claddingBump, bumpScale: 0.032, roughness: 0.56, metalness: 0.08, envMapIntensity: 0.75 };
      case C.roof:
        return { map: TX.roofMap, bumpMap: TX.roofBump, bumpScale: 0.026, roughness: 0.36, metalness: 0.62, envMapIntensity: 1.05 };
      case C.oak:
        return { map: TX.plankMap, bumpMap: TX.woodBump, bumpScale: 0.020, roughness: 0.36, envMapIntensity: 0.88 };
      case C.deck:
        return { map: TX.plankMap, bumpMap: TX.woodBump, bumpScale: 0.022, roughness: 0.56, envMapIntensity: 0.65 };
      case C.plaster:
        return { map: TX.plasterMap, bumpMap: TX.plasterBump, bumpScale: 0.010, roughness: 0.78, envMapIntensity: 0.65 };
      case C.fabric:
        return { bumpMap: TX.fabricBump, bumpScale: 0.018, roughness: 0.86, envMapIntensity: 0.45 };
      case C.travertine:
        return { map: TX.travertineMap, bumpMap: TX.concreteBump, bumpScale: 0.016, roughness: 0.42, envMapIntensity: 0.78 };
      case C.stone:
        return { map: TX.concreteMap, bumpMap: TX.concreteBump, bumpScale: 0.018, roughness: 0.48, envMapIntensity: 0.72 };
      case C.brass:
        return { roughness: 0.22, metalness: 0.88, envMapIntensity: 1.25 };
      case C.leather:
        return { bumpMap: TX.plasterBump, bumpScale: 0.012, roughness: 0.36, envMapIntensity: 0.85 };
      case C.terracotta:
        return { bumpMap: TX.plasterBump, bumpScale: 0.014, roughness: 0.72, envMapIntensity: 0.48 };
      case C.lawn:
        return { map: TX.lawnMap, bumpMap: TX.earthBump, bumpScale: 0.016, roughness: 0.86, envMapIntensity: 0.32 };
      case C.plant:
        return { bumpMap: TX.foliageBump, bumpScale: 0.024, roughness: 0.72, envMapIntensity: 0.42 };
      case C.steel:
        return { roughness: 0.32, metalness: 0.78, envMapIntensity: 1.05 };
      case C.frame:
      case C.dark:
        return { roughness: 0.36, metalness: 0.55, envMapIntensity: 0.92 };
      default:
        return { roughness: 0.78, metalness: 0.04, envMapIntensity: 0.5 };
    }
  }

  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, ...tradeProps(color), ...o });
  function solid(geo, m, { edges = 28, cast = true, uvMode = 'box' } = {}) {
    if (uvMode) applyMetricUV(geo, uvMode);
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(geo, typeof m === 'number' ? mat(m) : m);
    mesh.castShadow = cast; mesh.receiveShadow = true;
    g.add(mesh);
    if (edges) g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, edges), ink));
    return g;
  }
  const boxGeo = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const box = (w, h, d, m, x = 0, y = 0, z = 0, o = {}) => {
    const uvMode = o.uvMode ?? (h > w * 1.8 && h > d * 1.8 ? 'post' : 'box');
    const g = solid(boxGeo(w, h, d), m, { ...o, uvMode });
    g.position.set(x, y, z);
    return g;
  };
  const cyl = (rt, rb, h, seg, m, x = 0, y = 0, z = 0, o = {}) => {
    const g = solid(new THREE.CylinderGeometry(rt, rb, h, seg).translate(0, h / 2, 0), m, { edges: 0, ...o });
    g.position.set(x, y, z);
    return g;
  };
  // A beam between two points, section w (sideways) by h (up).
  function beam(a, b, w, h, m, o = {}) {
    const g = solid(new THREE.BoxGeometry(w, h, a.distanceTo(b)), m, { ...o, uvMode: 'beam' });
    g.position.copy(a).add(b).multiplyScalar(0.5);
    g.lookAt(b);
    const outer = new THREE.Group(); outer.add(g); return outer;
  }
  // A flat panel from a 2D outline with openings, extruded by t.
  function panelGeo(outline, holes = [], t = 0.24) {
    const s = new THREE.Shape(outline.map(([u, v]) => new THREE.Vector2(u, v)));
    for (const h of holes) s.holes.push(new THREE.Path(h.map(([u, v]) => new THREE.Vector2(u, v))));
    return new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false });
  }
  const rect = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];

  // Register a part. how: 'drop' (craned in), 'rise' (grows up from its base),
  // 'grow' (scales from nothing), 'show' (just appears).
  function add(obj, phase, order, how = 'drop', o = {}) {
    const ph = PHASES[phase], span = ph.w1 - ph.w0;
    const lifted = how === 'drop' && phase >= 3 && phase <= 7;
    const d = o.d ?? (lifted ? 0.16 : Math.min(0.42, span * 0.3));
    const t0 = ph.w0 + clamp01(order) * (span - d);
    const pivot = new THREE.Group();
    const base = o.base ? o.base.clone() : obj.position.clone();
    pivot.position.copy(base);
    obj.position.sub(base);
    pivot.add(obj);
    root.add(pivot);
    const mats = [];
    const edgeMats = [];
    obj.traverse(c => {
      if (c.isMesh) {
        c.material = Array.isArray(c.material) ? c.material.map(m => m.clone()) : c.material.clone();
        for (const m of [c.material].flat()) { m.userData.base = m.color.clone(); mats.push(m); }
      } else if (c.isLineSegments && c.material === ink && (o.hot ?? true)) {
        c.material = ink.clone();
        edgeMats.push(c.material);
      }
    });
    root.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(pivot);
    const spanX = Math.max(0.4, (bb.max.x - bb.min.x) * 0.32);
    const spanZ = Math.max(0.4, (bb.max.z - bb.min.z) * 0.32);
    const p = { pivot, obj, phase, t0, t1: t0 + d, how, until: o.until ?? Infinity, out: o.out ?? 0.3,
      drop: o.h ?? 2.4, hot: o.hot ?? true, lift: o.lift ?? (how === 'drop' && phase >= 3 && phase <= 7),
      mats, edgeMats, home: obj.position.clone(),
      top: new THREE.Vector3((bb.min.x + bb.max.x) / 2, bb.max.y, (bb.min.z + bb.max.z) / 2),
      spanX, spanZ, s: 0 };
    if (o.ghost !== false && phase >= 2) {
      obj.traverse(c => {
        if (c.isLineSegments && (c.material === ink || edgeMats.includes(c.material))) {
          const gl = new THREE.LineSegments(c.geometry.clone(), dash);
          gl.applyMatrix4(c.matrixWorld);
          gl.computeLineDistances();
          ghostRoot.add(gl);
          (p.ghosts ||= []).push(gl);
        }
      });
    }
    parts.push(p);
    return p;
  }

  // ---------------------------------------------------------------- 0 site set-up
  const SITE = { x0: -19, x1: 19, z0: -16, z1: 14 };
  {
    const fence = [];
    const edge = (ax, az, bx, bz) => {
      const n = Math.round(Math.hypot(bx - ax, bz - az) / 3.4);
      for (let i = 0; i < n; i++) fence.push([ax + (bx - ax) * i / n, az + (bz - az) * i / n, ax + (bx - ax) * (i + 1) / n, az + (bz - az) * (i + 1) / n]);
    };
    edge(SITE.x0, SITE.z1, SITE.x1, SITE.z1); edge(SITE.x1, SITE.z1, SITE.x1, SITE.z0);
    edge(SITE.x1, SITE.z0, SITE.x0, SITE.z0); edge(SITE.x0, SITE.z0, SITE.x0, SITE.z1);
    const gate = [-0.5, 3.8];
    fence.forEach((f, i) => {
      const [ax, az, bx, bz] = f;
      if (az === SITE.z1 && bz === SITE.z1 && Math.max(ax, bx) > gate[0] && Math.min(ax, bx) < gate[1]) return;
      const g = new THREE.Group();
      const pts = [];
      const H = 2.0, k = 0.03;
      const P = (t, y) => V(ax + (bx - ax) * t, y, az + (bz - az) * t);
      pts.push(P(k, 0.12), P(k, H), P(k, H), P(1 - k, H), P(1 - k, H), P(1 - k, 0.12), P(1 - k, 0.12), P(k, 0.12));
      for (let j = 1; j < 14; j++) pts.push(P(j / 14, 0.12), P(j / 14, H));
      for (let j = 1; j < 9; j++) pts.push(P(k, j * H / 9), P(1 - k, j * H / 9));
      const ln = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0.32 }));
      g.add(ln);
      const foot = box(0.6, 0.12, 0.25, C.dark, ax, 0, az, { cast: false }); g.add(foot);
      add(g, 0, i / fence.length, 'rise', { base: V(ax, 0, az), until: 13.25, ghost: false, hot: false, d: 0.15 });
    });

    const cabin = new THREE.Group();
    cabin.add(box(6, 2.6, 2.5, C.cabin, 0, 0.15, 0));
    cabin.add(box(6.2, 0.15, 2.6, C.dark, 0, 0, 0));
    cabin.add(box(6.1, 0.08, 2.56, C.dark, 0, 2.75, 0));
    for (const wx of [-1.8, 0, 1.8]) {
      cabin.add(box(1.1, 0.85, 0.05, C.frame, wx, 1.3, 1.27, { cast: false }));
      cabin.add(box(0.98, 0.73, 0.06, C.glass, wx, 1.36, 1.27, { cast: false, edges: 0 }));
    }
    cabin.add(box(0.85, 2.05, 0.05, C.frame, 2.35, 0.2, 1.27, { cast: false }));
    cabin.position.set(-15.5, 0, 4.8);
    add(cabin, 0, 0.35, 'drop', { until: 13.3, ghost: false, h: 3 });
    const loo = box(1.1, 2.3, 1.1, 0x8FA0A6, -11.4, 0, 5.6);
    add(loo, 0, 0.45, 'drop', { until: 13.3, ghost: false });
    const skip = new THREE.Group();
    const sk = panelGeo([[-2, 0], [2, 0], [2.6, 1.4], [-2.6, 1.4]], [], 1.8);
    sk.translate(0, 0, -0.9);
    skip.add(solid(sk, C.machine));
    skip.position.set(-15, 0, -12.5);
    add(skip, 0, 0.6, 'drop', { until: 13.3, ghost: false });
    for (let i = 0; i < 3; i++) {
      const pal = new THREE.Group();
      pal.add(box(3.2, 0.15, 1.2, C.deck, 0, 0, 0));
      pal.add(box(3.0, 0.5, 1.1, C.sheathing, 0, 0.15, 0));
      pal.position.set(-13, 0, -9.5 + i * 1.6);
      add(pal, 0, 0.7 + i * 0.1, 'drop', { until: 8.4 + i * 0.4, ghost: false });
    }

    const so = new THREE.Group();
    const strings = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const ax = sx * (HX + 0.3), az = sz * (HZ + 1.6), bx = sx * (HX + 1.6), bz = sz * (HZ + 0.3);
      so.add(box(1.2, 0.12, 0.06, C.deck, ax, 0.55, az, { cast: false }));
      so.add(box(0.05, 0.7, 0.05, C.deck, ax - 0.55, 0, az, { cast: false }), box(0.05, 0.7, 0.05, C.deck, ax + 0.55, 0, az, { cast: false }));
      so.add(box(0.06, 0.12, 1.2, C.deck, bx, 0.55, bz, { cast: false }));
      so.add(box(0.05, 0.7, 0.05, C.deck, bx, 0, bz - 0.55, { cast: false }), box(0.05, 0.7, 0.05, C.deck, bx, 0, bz + 0.55, { cast: false }));
    }
    const y = 0.66;
    for (const sz of [-1, 1]) strings.push(V(-HX - 2.4, y, sz * HZ), V(HX + 2.4, y, sz * HZ));
    for (const sx of [-1, 1]) strings.push(V(sx * HX, y, -HZ - 2.4), V(sx * HX, y, HZ + 2.4));
    so.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(strings), new THREE.LineBasicMaterial({ color: C.accent })));
    add(so, 0, 0.9, 'show', { until: 1.0, ghost: false, out: 0.15, hot: false });
  }

  // ---------------------------------------------------------------- 1 excavation
  const pit = new THREE.Group();
  {
    const { x0, x1, z0, z1, depth } = PIT;
    const wallM = mat(C.earth, { side: THREE.DoubleSide });
    const walls = [
      [V(x0, 0, z0), V(x1, 0, z0)], [V(x1, 0, z0), V(x1, 0, z1)], [V(x1, 0, z1), V(x0, 0, z1)], [V(x0, 0, z1), V(x0, 0, z0)],
    ];
    for (const [a, b] of walls) {
      const g = applyMetricUV(new THREE.PlaneGeometry(a.distanceTo(b), depth));
      const m = new THREE.Mesh(g, wallM);
      m.position.copy(a).add(b).multiplyScalar(0.5); m.position.y = -depth / 2;
      m.lookAt(m.position.clone().add(V(-(b.z - a.z), 0, b.x - a.x)));
      m.receiveShadow = true;
      pit.add(m);
    }
    const cut = [V(x0, 0.01, z0), V(x1, 0.01, z0), V(x1, 0.01, z0), V(x1, 0.01, z1), V(x1, 0.01, z1), V(x0, 0.01, z1), V(x0, 0.01, z1), V(x0, 0.01, z0)];
    pit.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(cut), ink));
    const floor = new THREE.Mesh(applyMetricUV(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2)), mat(C.earthDark));
    floor.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    floor.receiveShadow = true;
    pit.add(floor);
    pit.userData.floor = floor;
    pit.userData.wallM = wallM;
    root.add(pit);
    pit.visible = false;
  }
  const spoil = new THREE.Group();
  {
    const g = makeOrganicClusterGeo(4.2, 1.55, 2.8, 2).translate(0, 0.65, 0);
    spoil.add(solid(g, C.earth, { edges: 0 }));
    spoil.position.set(-11, 0, -2);
    root.add(spoil);
  }
  const digger = new THREE.Group();
  {
    digger.add(box(2.6, 0.55, 0.5, C.dark, 0, 0, -0.75));
    digger.add(box(2.6, 0.55, 0.5, C.dark, 0, 0, 0.75));
    digger.add(box(2.4, 0.7, 2.0, C.machine, 0.1, 0.6, 0));
    digger.add(box(1.0, 1.1, 0.9, C.machine, 0.6, 1.3, 0.45));
    digger.add(box(0.9, 0.7, 0.04, C.glass, 0.6, 1.55, 0.92, { cast: false }));
    const arm1 = beam(V(-0.6, 1.2, -0.3), V(-2.4, 2.6, -0.3), 0.3, 0.35, C.machine);
    const arm2 = beam(V(-2.4, 2.6, -0.3), V(-3.6, 0.4, -0.3), 0.25, 0.3, C.machine);
    digger.add(arm1, arm2, box(0.7, 0.55, 0.8, C.dark, -3.6, 0.0, -0.3));
    digger.position.set(9.2, 0, 1.2);
    add(digger, 1, 0, 'drop', { until: 2.3, ghost: false, h: 0, d: 0.1, hot: false });
  }

  // ---------------------------------------------------------------- 2 foundations
  {
    const yb = -PIT.depth;
    let k = 0;
    for (const x of BAYS) for (const z of [-HZ, HZ]) {
      add(box(1.1, 0.35, 1.1, C.concrete, x, yb, z), 2, 0.0 + (k++) * 0.012, 'rise', { d: 0.25 });
    }
    const rb = [
      [0, yb, -HZ, 12.6, 0.6], [0, yb, HZ, 12.6, 0.6],
    ];
    rb.forEach(([x, y, z, w, d], i) => add(box(w, 0.45, d, C.concrete, x, y, z), 2, 0.18 + i * 0.05, 'rise', { d: 0.3 }));
    add(box(0.6, 0.45, 6.4, C.concrete, -HX, yb, 0), 2, 0.28, 'rise', { d: 0.3 });
    add(box(0.6, 0.45, 6.4, C.concrete, HX, yb, 0), 2, 0.3, 'rise', { d: 0.3 });
    add(box(11.4, 0.3, 6.4, C.eps, 0, yb + 0.15, 0), 2, 0.42, 'rise', { d: 0.3 });
    for (let i = 0; i < 3; i++) {
      add(box(12.4 / 3, 0.6, 7.4, C.concrete, -HX - 0.2 + 12.4 / 6 + i * 12.4 / 3, FL - 0.6, 0), 2, 0.6 + i * 0.12, 'rise', { d: 0.3 });
    }
    const { x0, x1, z0, z1, depth } = PIT;
    const bf = [
      [(x0 + x1) / 2, z0 + 0.25, x1 - x0, 0.5], [(x0 + x1) / 2, z1 - 0.25, x1 - x0, 0.5],
      [x0 + 0.25, 0, 0.5, z1 - z0 - 1], [x1 - 0.25, 0, 0.5, z1 - z0 - 1],
    ];
    bf.forEach(([x, z, w, d]) => add(box(w, depth - 0.02, d, C.gravel, x, -depth, z, { edges: 0, cast: false }), 2, 0.95, 'rise', { d: 0.2, hot: false, ghost: false }));
  }

  // ---------------------------------------------------------------- 3 structure
  // Five glulam portal frames, west to east, with galvanized steel post-base shoes and apex/eave flitch plates.
  const rafterLine = (z) => EAVE + (HZ - Math.abs(z));
  {
    BAYS.forEach((x, i) => {
      const f = new THREE.Group();
      for (const s of [-1, 1]) {
        f.add(box(0.32, 0.03, 0.32, C.steel, x, FL, s * HZ, { edges: 0, cast: false }));
        f.add(box(0.24, 0.18, 0.24, C.steel, x, FL + 0.03, s * HZ, { edges: 0, cast: false }));
        f.add(box(0.22, EAVE - FL, 0.22, C.glulam, x, FL, s * HZ));
        f.add(beam(V(x, EAVE - 0.5, s * (HZ + 0.5)), V(x, RIDGE, 0), 0.18, 0.32, C.glulam));
        f.add(box(0.24, 0.38, 0.38, C.steel, x, EAVE - 0.28, s * HZ, { edges: 0, cast: false }));
      }
      f.add(box(0.20, 0.34, 0.52, C.steel, x, RIDGE - 0.24, 0, { edges: 0, cast: false }));
      if (x > 0) f.add(beam(V(x, EAVE - 0.05, -HZ), V(x, EAVE - 0.05, HZ), 0.12, 0.14, C.glulam));
      f.position.set(0, 0, 0);
      add(f, 3, i / 6, 'drop', { base: V(x, FL, 0), h: 3.2 });
    });
    add(beam(V(-HX - 0.5, RIDGE - 0.1, 0), V(HX + 0.5, RIDGE - 0.1, 0), 0.22, 0.3, C.glulam), 3, 0.86, 'drop', { h: 2.5 });
    for (const s of [-1, 1]) add(beam(V(-HX - 0.2, EAVE - 0.18, s * HZ), V(HX + 0.2, EAVE - 0.18, s * HZ), 0.24, 0.3, C.glulam), 3, s < 0 ? 0.92 : 0.97, 'drop', { h: 2.5 });
  }

  // ---------------------------------------------------------------- 4 floors & bespoke glulam stair
  // Mezzanine loft over the west half: joists, 5-ply CLT deck, and an open glulam stair rising from z = 1.4 (south) to z = -2.1 (north).
  {
    for (let i = 0; i < 10; i++) {
      const x = -HX + 0.3 + i * 0.6;
      add(beam(V(x, MEZZ - 0.14, -HZ + 0.12), V(x, MEZZ - 0.14, HZ - 0.12), 0.08, 0.24, C.clt), 4, i * 0.03, 'drop', { h: 1.4, d: 0.2 });
    }
    for (let i = 0; i < 3; i++) add(box(2, 0.1, 6.8, C.clt, -HX + 1 + i * 2, MEZZ - 0.02, 0), 4, 0.4 + i * 0.12, 'drop', { h: 1.6 });

    const st = new THREE.Group();
    const n = 15, rise = (MEZZ + 0.08 - FL) / n;
    const zb = 1.4, zt = -2.1;
    for (let i = 0; i < n; i++) {
      const tz = zb + (i + 0.5) * (zt - zb) / n;
      const ty = FL + (i + 1) * rise - 0.05;
      st.add(box(0.92, 0.05, 0.26, C.clt, 0.58, ty, tz));
    }
    st.add(beam(V(0.12, FL, zb), V(0.12, MEZZ, zt), 0.06, 0.28, C.glulam));
    st.add(beam(V(1.04, FL, zb), V(1.04, MEZZ, zt), 0.06, 0.28, C.glulam));
    // Blackened-steel stair handrail and vertical balusters
    st.add(beam(V(1.04, FL + 0.92, zb), V(1.04, MEZZ + 1.0, zt), 0.035, 0.04, C.dark, { edges: 0 }));
    for (let i = 0; i < 6; i++) {
      const u = i / 5;
      const bz = zb + u * (zt - zb);
      const by = FL + u * (MEZZ - FL);
      st.add(box(0.025, 0.94, 0.025, C.dark, 1.04, by, bz, { edges: 0 }));
    }
    add(st, 4, 0.9, 'drop', { base: V(0.58, FL, -0.35), h: 2 });
  }

  // ---------------------------------------------------------------- 5 walls, 7 windows & hinged front door, 8 skins
  const T = 0.24;
  const longH = EAVE + 0.1 - FL;
  const W = (u0, v0, u1, v1, kind = 'win') => ({ u0, v0, u1, v1, kind });
  const SOUTH = [
    [W(0.6, 0.95, 2.4, 2.15)],
    [W(0.5, 0.03, 2.3, 2.45)],
    [W(1.0, 0.03, 2.1, 2.3, 'door'), W(2.25, 0.03, 2.65, 2.3)],
    [W(0.35, 0.03, 2.65, 2.7)],
  ];
  const NORTH = [[W(1.0, 1.2, 2.0, 2.15)], [], [W(0.8, 0.5, 2.2, 2.45)], [W(0.9, 0.4, 2.1, 2.5)]];
  const walls = [];
  BAYS.slice(0, 4).forEach((x, i) => {
    const len = 3 - 0.22;
    for (const [s, list] of [[1, SOUTH[i]], [-1, NORTH[i]]]) {
      const ops = list.map(o => ({ ...o, u0: o.u0 - 0.11, u1: o.u1 - 0.11 }));
      walls.push({
        side: s > 0 ? 'S' : 'N', order: i,
        outline: rect(0, 0, len, longH), ops,
        place(obj, off) { obj.position.set(x + 0.11, FL, s * (HZ + off)); obj.rotation.y = 0; },
        n: s, axis: 'z', x0: x + 0.11, len,
      });
    }
  });
  // West gable: two lower panels and the triangle.
  const gableOps = { low0: [], low1: [W(1.5, 0.95, 2.7, 2.15)], tri: [W(2.8, EAVE - FL + 0.45, 4.2, EAVE - FL + 1.75)] };
  walls.push({ side: 'W', order: 0, outline: rect(0, 0, HZ - 0.11, longH), ops: gableOps.low0, axis: 'x', u0: -HZ + 0.11, n: -1 });
  walls.push({ side: 'W', order: 1, outline: rect(0, 0, HZ - 0.11, longH), ops: gableOps.low1, axis: 'x', u0: 0, n: -1 });
  walls.push({ side: 'W', order: 2, outline: null, ops: gableOps.tri, axis: 'x', u0: -HZ, n: -1 });
  walls[walls.length - 1].outline = [[-0.12, longH], [2 * HZ + 0.12, longH], [HZ, longH + HZ + 0.12]];

  function onWall(w, geo, m, off, o) {
    const g = solid(geo, m, o);
    const holder = new THREE.Group();
    holder.add(g);
    if (w.axis === 'z') {
      if (w.n > 0) { g.position.set(w.x0, FL, HZ + off); }
      else { g.position.set(w.x0, FL, -HZ - off); g.scale.z = -1; }
    } else {
      g.rotation.y = -Math.PI / 2;
      g.position.set(-HX - off, FL, w.u0);
    }
    return holder;
  }
  const holes = w => w.ops.map(o => rect(o.u0, o.v0, o.u1, o.v1));
  const wallBase = w => w.axis === 'z' ? V(w.x0 + w.len / 2, FL, w.n * HZ) : V(-HX, FL, w.u0 + 1.7);

  const sideOrder = { S: 0, W: 0.38, N: 0.6 };
  walls.forEach(w => {
    const g = onWall(w, panelGeo(w.outline, holes(w), T), C.sheathing, -T / 2);
    const ord = sideOrder[w.side] + w.order * (w.side === 'W' ? 0.08 : 0.09);
    add(g, 5, ord, 'drop', { base: wallBase(w), h: 2.6 });
  });

  // Roof panels, bay by bay, south then north, with raised standing-seam zinc ribs & loft skylights.
  {
    const slope = HZ * Math.SQRT2 + 0.75;
    const thick = 0.26;
    BAYS.slice(0, 4).forEach((x, i) => {
      for (const s of [1, -1]) {
        const x0 = x - (i === 0 ? 0.45 : 0), x1 = x + 3 + (i === 3 ? 0.45 : 0);
        const a = -0.42, b = slope, c = (a + b) / 2;
        const R = mat(C.roof), U = mat(C.clt);
        const cassette = new THREE.Group();
        const g = solid(new THREE.BoxGeometry(x1 - x0, thick, b - a), [R, R, R, U, R, R]);
        cassette.add(g);
        const ribCount = Math.floor((x1 - x0) / 0.55);
        for (let r = 1; r < ribCount; r++) {
          const rx = -(x1 - x0) / 2 + r * ((x1 - x0) / ribCount);
          const rib = box(0.024, 0.034, b - a - 0.04, C.roof, rx, thick / 2, 0, { edges: 0, cast: false });
          cassette.add(rib);
        }
        // Flush architectural roof skylight over the mezzanine suite in Bay 1 (x = -3..0)
        if (i === 1) {
          cassette.add(box(1.15, 0.05, 1.35, C.frame, 0, thick / 2, -0.35, { edges: 0, cast: false }));
          cassette.add(box(1.02, 0.06, 1.22, C.glass, 0, thick / 2, -0.35, { edges: 0, cast: false }));
        }
        const off = 0.16 + thick / 2;
        cassette.position.set((x0 + x1) / 2, RIDGE - c / Math.SQRT2 + off / Math.SQRT2, s * (c + off) / Math.SQRT2);
        cassette.rotation.x = s * Math.PI / 4;
        const holder = new THREE.Group(); holder.add(cassette);
        add(holder, 6, i * 0.22 + (s > 0 ? 0 : 0.1), 'drop', { base: V((x0 + x1) / 2, RIDGE, s * 1.8), h: 2.8 });
      }
    });
  }

  // Windows and doors: triple-glazed alu frames, mullions, cills, hinged front door, and east glass gable.
  function frameGeo(o, depth = 0.08, f = 0.07) {
    return panelGeo(rect(o.u0, o.v0, o.u1, o.v1), [rect(o.u0 + f, o.v0 + (o.v0 < 0.05 ? 0.03 : f), o.u1 - f, o.v1 - f)], depth);
  }
  const glassM = () => mat(C.glass, { transparent: true, opacity: 0.26, roughness: 0.06, metalness: 0.15, envMapIntensity: 1.35, depthWrite: false, side: THREE.DoubleSide });
  let frontDoorPivot = null;
  const windows = [];
  walls.forEach(w => w.ops.forEach(o => windows.push({ w, o })));
  windows.forEach(({ w, o }, i) => {
    const g = new THREE.Group();
    g.add(onWall(w, frameGeo(o), C.frame, -0.02));
    const cillGeo = panelGeo(rect(o.u0 - 0.02, o.v0 - 0.03, o.u1 + 0.02, o.v0 + 0.01), [], 0.16);
    g.add(onWall(w, cillGeo, C.frame, -0.02, { edges: 0, cast: false }));
    if (o.kind === 'door') {
      // Hinged European oak & bronze front door pivoted at the east jamb (x = 2.03, z = HZ) so it swings open cleanly
      const dw = (o.u1 - o.u0) - 0.14;
      const dh = (o.v1 - o.v0) - 0.10;
      const hingeX = w.x0 + o.u1 - 0.07;
      const doorLeaf = new THREE.Group();
      doorLeaf.position.set(hingeX, FL + o.v0 + 0.03, HZ - 0.03);
      // Solid European oak door slab with vertical vision lite & brushed steel pull handle
      doorLeaf.add(box(dw, dh, 0.055, C.oak, -dw / 2, 0, 0));
      doorLeaf.add(box(dw + 0.01, dh + 0.01, 0.06, C.frame, -dw / 2, 0, 0, { edges: 0, cast: false }));
      doorLeaf.add(box(0.22, dh - 0.36, 0.065, C.glass, -dw * 0.32, 0.18, 0, { edges: 0, cast: false }));
      doorLeaf.add(box(0.03, 0.65, 0.04, C.brass, -dw + 0.11, 0.82, 0.045, { edges: 0, cast: false }));
      doorLeaf.add(box(0.03, 0.65, 0.04, C.brass, -dw + 0.11, 0.82, -0.045, { edges: 0, cast: false }));
      g.add(doorLeaf);
      frontDoorPivot = doorLeaf;
    } else {
      if (o.u1 - o.u0 > 1.45) {
        const um = (o.u0 + o.u1) / 2;
        g.add(onWall(w, panelGeo(rect(um - 0.025, o.v0 + 0.06, um + 0.025, o.v1 - 0.06), [], 0.07), C.frame, -0.02, { edges: 0, cast: false }));
      }
      const pg = new THREE.ShapeGeometry(new THREE.Shape(rect(o.u0 + 0.07, o.v0 + 0.07, o.u1 - 0.07, o.v1 - 0.07).map(([u, v]) => new THREE.Vector2(u, v))));
      pg.translate(0, 0, 0.04);
      const glass = onWall(w, pg, glassM(), -0.02, { edges: 0, cast: false, uvMode: false });
      g.add(glass);
    }
    const b = wallBase(w);
    add(g, 7, 0.45 + (i / windows.length) * 0.55, 'drop', { base: b, h: 0.9, d: 0.2 });
  });
  {
    const zs = [-3.5, -2.1, -0.7, 0.7, 2.1, 3.5];
    const xg = HX + 0.12;
    for (let k = 0; k < 5; k++) {
      const za = zs[k], zb = zs[k + 1];
      const col = new THREE.Group();
      const ya = rafterLine(za) - 0.22, yb = rafterLine(zb) - 0.22;
      const pts = [[za, FL], [zb, FL], [zb, yb], ...(za < 0 && zb > 0 ? [[0, RIDGE - 0.22]] : []), [za, ya]];
      const sh = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v)));
      const pg = new THREE.ShapeGeometry(sh);
      const pane = new THREE.Mesh(pg, glassM());
      pane.rotation.y = Math.PI / 2;
      pane.scale.x = -1;
      pane.position.set(xg, 0, 0);
      col.add(pane);
      const mtop = Math.min(ya, yb);
      col.add(box(0.07, mtop - FL, 0.09, C.frame, xg, FL, za));
      col.add(beam(V(xg, EAVE - 0.05, za), V(xg, EAVE - 0.05, zb), 0.09, 0.07, C.frame));
      col.add(beam(V(xg, FL + 0.03, za), V(xg, FL + 0.03, zb), 0.09, 0.07, C.frame));
      add(col, 7, k * 0.09, 'drop', { base: V(xg, FL, (za + zb) / 2), h: 1.4, d: 0.2 });
    }
  }

  // ---------------------------------------------------------------- 8 finishes & bespoke architectural joinery
  {
    const clad = () => mat(C.cladding);
    walls.forEach((w, i) => {
      const g = onWall(w, panelGeo(w.outline, holes(w), 0.04), clad(), T / 2 - 0.0, { edges: 20 });
      add(g, 8, 0.0 + i * 0.022, 'rise', { base: wallBase(w), d: 0.3 });
      const p = onWall(w, panelGeo(w.outline, holes(w), 0.02), C.plaster, -T / 2 - 0.03, { edges: 0, cast: false });
      add(p, 8, 0.3 + i * 0.01, 'show', { base: wallBase(w), d: 0.2, hot: false, ghost: false });
    });
    // Ridge cap, eave gutters, and downpipes.
    const trim = new THREE.Group();
    trim.add(box(2 * HX + 0.95, 0.1, 0.42, C.dark, 0, RIDGE + 0.5, 0));
    for (const s of [-1, 1]) {
      trim.add(box(2 * HX + 0.9, 0.09, 0.12, C.dark, 0, EAVE - 0.32, s * (HZ + 0.56), { edges: 0 }));
      trim.add(box(0.06, EAVE - 0.32, 0.06, C.dark, -HX + 0.18, 0, s * (HZ + 0.22), { edges: 0 }));
    }
    add(trim, 8, 0.08, 'drop', { base: V(0, RIDGE, 0), h: 1 });

    // Floors: wide-plank European oak downstairs and on the mezzanine loft, plus recessed basalt entry threshold mat.
    const floorsG = new THREE.Group();
    floorsG.add(box(2 * HX - 0.24, 0.02, 2 * HZ - 0.24, C.oak, 0, FL, 0, { edges: 0 }));
    floorsG.add(box(1.25, 0.023, 0.85, C.stone, DOOR.x, FL, HZ - 0.55, { edges: 0 }));
    // Entry hall console shelf & brass mirror on the south-east entry pier
    floorsG.add(box(0.72, 0.04, 0.26, C.oak, 2.52, FL + 0.82, HZ - 0.26, { edges: 0 }));
    floorsG.add(cyl(0.11, 0.08, 0.06, 16, C.terracotta, 2.52, FL + 0.86, HZ - 0.26));
    const mir = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.02, 28).rotateX(Math.PI / 2), mat(C.brass, { metalness: 0.95, roughness: 0.08 }));
    mir.position.set(2.52, FL + 1.48, HZ - 0.15);
    floorsG.add(mir);
    add(floorsG, 8, 0.36, 'show', { hot: false, d: 0.2 });

    add(box(6 - 0.15, 0.02, 2 * HZ - 0.3, C.oak, -3, MEZZ + 0.08, 0, { edges: 0 }), 8, 0.38, 'show', { hot: false, d: 0.2 });

    // Bespoke Kitchen Run (north wall under mezzanine) & Waterfall Stone/Oak Island
    const kit = new THREE.Group();
    // Full-height oak pantry & integrated oven column at west end
    kit.add(box(0.75, 2.25, 0.64, C.oak, -5.35, FL, -HZ + 0.46));
    kit.add(box(0.62, 0.58, 0.02, C.dark, -5.35, FL + 0.88, -HZ + 0.79, { edges: 0 }));
    // Base cabinets & honed dark stone worktop
    kit.add(box(3.8, 0.88, 0.62, C.dark, -3.05, FL, -HZ + 0.45));
    kit.add(box(3.84, 0.04, 0.66, C.travertine, -3.05, FL + 0.88, -HZ + 0.45));
    // Travertine slab backsplash
    kit.add(box(3.8, 0.58, 0.02, C.travertine, -3.05, FL + 0.92, -HZ + 0.15, { edges: 0 }));
    // Undermount sink & brushed-brass gooseneck mixer tap
    kit.add(box(0.68, 0.015, 0.44, C.steel, -2.8, FL + 0.915, -HZ + 0.45, { edges: 0 }));
    kit.add(box(0.03, 0.28, 0.03, C.brass, -2.8, FL + 0.92, -HZ + 0.22, { edges: 0 }));
    kit.add(box(0.03, 0.03, 0.16, C.brass, -2.8, FL + 1.17, -HZ + 0.29, { edges: 0 }));
    // Two open European oak wall shelves with ceramic bowls & vessels
    for (const sy of [FL + 1.48, FL + 1.86]) {
      kit.add(box(2.8, 0.035, 0.26, C.oak, -2.9, sy, -HZ + 0.28, { edges: 0 }));
    }
    kit.add(cyl(0.11, 0.08, 0.09, 14, C.plaster, -3.6, FL + 1.515, -HZ + 0.28));
    kit.add(cyl(0.09, 0.09, 0.14, 14, C.terracotta, -3.2, FL + 1.515, -HZ + 0.28));
    kit.add(cyl(0.12, 0.09, 0.10, 14, C.dark, -2.2, FL + 1.895, -HZ + 0.28));
    // Waterfall Oak & Travertine Kitchen Island + flush induction hob + 3 counter bar stools
    kit.add(box(2.5, 0.9, 1.02, C.oak, -3.35, FL, -0.55));
    kit.add(box(2.56, 0.045, 1.08, C.travertine, -3.35, FL + 0.9, -0.55));
    kit.add(box(0.76, 0.01, 0.46, 0x161616, -3.65, FL + 0.945, -0.6, { edges: 0 }));
    kit.add(cyl(0.16, 0.10, 0.08, 16, C.terracotta, -2.55, FL + 0.945, -0.48));
    for (let s = -1; s <= 1; s++) {
      const sx = -3.35 + s * 0.72, sz = 0.08;
      kit.add(box(0.38, 0.04, 0.36, C.oak, sx, FL + 0.62, sz, { edges: 0 }));
      for (const lx of [-0.15, 0.15]) for (const lz of [-0.14, 0.14]) {
        kit.add(box(0.03, 0.62, 0.03, C.dark, sx + lx, FL, sz + lz, { edges: 0 }));
      }
    }
    add(kit, 8, 0.45, 'drop', { base: V(-3.5, FL, -1), h: 0.8 });

    // Mezzanine Glass & Blackened-Steel Balustrade (from z = -1.25 south to +HZ - 0.15, leaving north landing for stair)
    const bal = new THREE.Group();
    bal.add(beam(V(0.02, MEZZ + 1.0, -1.25), V(0.02, MEZZ + 1.0, HZ - 0.18), 0.05, 0.05, C.dark));
    for (const pz of [-1.25, 0.25, 1.75, HZ - 0.2]) {
      bal.add(box(0.04, 0.94, 0.04, C.dark, 0.02, MEZZ + 0.08, pz, { edges: 0 }));
    }
    const bp = new THREE.ShapeGeometry(new THREE.Shape(rect(-1.25, MEZZ + 0.1, HZ - 0.18, MEZZ + 0.98).map(([u, v]) => new THREE.Vector2(u, v))));
    const bm = new THREE.Mesh(bp, glassM());
    bm.rotation.y = Math.PI / 2; bm.scale.x = -1; bm.position.x = 0.02;
    bal.add(bm);
    add(bal, 8, 0.5, 'drop', { base: V(0, MEZZ, 0), h: 0.6 });

    // Deck off the glass gable, path to the door.
    const deck = new THREE.Group();
    deck.add(box(4.2, 0.12, 2 * HZ + 0.6, C.deck, HX + 2.25, 0, 0));
    for (let i = 0; i < 26; i++) deck.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([V(HX + 0.15, 0.125, -HZ - 0.3 + i * 0.3), V(HX + 4.35, 0.125, -HZ - 0.3 + i * 0.3)]), ink));
    add(deck, 8, 0.56, 'rise', { base: V(HX + 2.2, 0, 0), d: 0.25 });
    for (let i = 0; i < (opts.lawn === false ? 2 : 9); i++) {
      add(box(1.1, 0.06, 0.7, C.gravel, DOOR.x + Math.sin(i * 0.5) * 0.35, 0, HZ + 1.0 + i * 1.05), 8, 0.62 + i * 0.008, 'show', { d: 0.1 });
    }
  }

  // Landscaping: a lawn that grows out from the house, multi-clustered organic shrubs, and architectural trees.
  const lawnShape = () => {
    const s = new THREE.Shape();
    const R = 15;
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const r = R * (1 + 0.05 * Math.sin(a * 3) + 0.03 * Math.cos(a * 5));
      const x = Math.cos(a) * r * 1.25, z = Math.sin(a) * r * 0.85;
      i ? s.lineTo(x, -z) : s.moveTo(x, -z);
    }
    s.holes.push(new THREE.Path(rect(-HX - 0.3, -HZ - 0.3, HX + 4.4, HZ + 0.3).map(([u, v]) => new THREE.Vector2(u, v))));
    return s;
  };
  const lawn = new THREE.Mesh(applyMetricUV(new THREE.ShapeGeometry(lawnShape(), 3).rotateX(-Math.PI / 2)), mat(C.lawn));
  lawn.receiveShadow = true;
  lawn.position.y = 0.012;
  const lawnG = new THREE.Group(); lawnG.add(lawn);
  if (opts.lawn !== false) add(lawnG, 8, 0.72, 'grow', { base: V(0, 0.012, 0), d: 0.5, hot: false, ghost: false });

  // Multi-mound organic garden shrubs
  const shrubs = [[-7.6, 4.6], [-7.2, -4.6], [3.8, 4.4], [-2.4, 4.5], [8.6, 4.6], [8.9, -4.4], [-4.8, -4.6]];
  const shrubCols = [0x67784C, 0x56673D, 0x78875B];
  shrubs.forEach(([x, z], i) => {
    const sh = new THREE.Group();
    const mounds = [
      [0, 0.38, 0, 0.65, 0.44, 0.58],
      [-0.35, 0.28, 0.18, 0.46, 0.34, 0.42],
      [0.32, 0.26, -0.15, 0.42, 0.32, 0.38],
    ];
    mounds.forEach(([mx, my, mz, rx, ry, rz], mIdx) => {
      const s = 0.88 + (i % 3) * 0.14;
      const g = makeOrganicClusterGeo(rx * s, ry * s, rz * s, 2).translate(mx * s, my * s, mz * s);
      sh.add(solid(g, mat(shrubCols[(i + mIdx) % 3], { bumpMap: TX.foliageBump, bumpScale: 0.025, roughness: 0.74 }), { edges: 0 }));
    });
    sh.position.set(x, 0, z);
    sh.rotation.y = i * 1.1;
    add(sh, 8, 0.8 + i * 0.02, 'grow', { d: 0.2, hot: false });
  });

  // ---------------------------------------------------------------- 9 richly furnished multi-room interior & warm lighting
  const warmLight1 = new THREE.PointLight(0xffdca8, 0, 12, 1.5);
  warmLight1.position.set(3.5, 2.8, -0.4);
  const warmLight2 = new THREE.PointLight(0xff9e44, 0, 8, 1.6);
  warmLight2.position.set(4.65, 0.85, -2.55);
  const warmLight3 = new THREE.PointLight(0xffdca8, 0, 10, 1.5);
  warmLight3.position.set(-3.1, 2.15, 0.5);
  const warmLight4 = new THREE.PointLight(0xffdca8, 0, 9, 1.5);
  warmLight4.position.set(-2.6, MEZZ + 1.85, 0.4);
  root.add(warmLight1, warmLight2, warmLight3, warmLight4);

  let fireEmberMat = null;
  {
    const F = (obj, order, base) => add(obj, 9, order, 'drop', { base, h: 0.65, d: 0.15 });
    const rugM = mat(0xD4C8B4, { map: TX.rugMap, bumpMap: TX.fabricBump, bumpScale: 0.032, roughness: 0.92 });
    const glowShadeM = () => new THREE.MeshStandardMaterial({ color: 0xfff3dc, emissive: 0xffcf8a, emissiveIntensity: 1.5, roughness: 0.4 });
    fireEmberMat = new THREE.MeshStandardMaterial({ color: 0xff9436, emissive: 0xff5a12, emissiveIntensity: 2.4, roughness: 0.3 });

    // 1. Living Room Area Rug
    const rug = box(3.6, 0.018, 2.8, rugM, 3.85, FL + 0.02, -0.35, { edges: 0, cast: false });
    F(rug, 0.0);

    // 2. Full-height bespoke oak bookcase on the north living room wall (x = 1.6..3.3, z = -3.18)
    const bookcase = new THREE.Group();
    const bw = 1.75, bh = 2.65, bd = 0.34;
    for (let s = 0; s <= 5; s++) {
      bookcase.add(box(bw, 0.032, bd, C.oak, 0, s * (bh / 5), 0));
    }
    for (let c = 0; c <= 3; c++) {
      bookcase.add(box(0.032, bh, bd, C.oak, -bw / 2 + c * (bw / 3), 0, 0));
    }
    const bookCols = [0x9E3E28, 0x2E4858, 0xD8CEB8, 0x5B6B4C, 0x242320, 0xC88A3E];
    for (let s = 0; s < 5; s++) {
      const sy = s * (bh / 5) + 0.032;
      for (let c = 0; c < 3; c++) {
        const cx = -bw / 2 + c * (bw / 3) + 0.05;
        if ((s + c) % 3 === 1) {
          // Sculpted ceramic vessel on shelf
          bookcase.add(cyl(0.07, 0.05, 0.22, 14, (s + c) % 2 ? C.terracotta : C.plaster, cx + 0.2, sy, 0.02));
        } else {
          let bx = cx;
          for (let b = 0; b < 6; b++) {
            const th = 0.032 + ((s * 7 + c * 3 + b) % 3) * 0.012;
            const ht = 0.22 + ((s + b) % 4) * 0.04;
            bookcase.add(box(th, ht, 0.22, bookCols[(s * 3 + c + b) % bookCols.length], bx + th / 2, sy, 0.02, { edges: 0 }));
            bx += th + 0.006;
          }
        }
      }
    }
    bookcase.position.set(2.45, FL + 0.02, -HZ + 0.28);
    F(bookcase, 0.08);

    // 3. Freestanding Cast-Iron Wood-Burning Fireplace, Basalt Hearth & Flue (north-east living room, x = 4.85, z = -2.85)
    const hearth = new THREE.Group();
    hearth.add(box(1.15, 0.08, 0.85, C.stone, 0, 0, 0));
    // Log storage plinth + stacked birch logs
    hearth.add(box(0.68, 0.36, 0.54, C.dark, -0.1, 0.08, -0.04));
    for (let l = 0; l < 4; l++) {
      hearth.add(cyl(0.045, 0.045, 0.44, 10, C.oak, -0.22 + (l % 2) * 0.14, 0.14 + Math.floor(l / 2) * 0.10, -0.04));
    }
    // Cast-iron firebox chamber & glowing ember core
    hearth.add(box(0.68, 0.62, 0.54, C.dark, -0.1, 0.44, -0.04));
    hearth.add(box(0.48, 0.36, 0.04, fireEmberMat, -0.1, 0.54, 0.22, { edges: 0, cast: false }));
    // Vertical blackened-steel flue rising cleanly to the sloped roof soffit
    hearth.add(cyl(0.095, 0.095, 2.88, 16, C.dark, -0.1, 1.06, -0.04));
    hearth.position.set(4.85, FL + 0.02, -HZ + 0.62);
    F(hearth, 0.14);

    // 4. Tailored Belgian-Linen Sofa with Bouclé Throw Pillows (facing south-east toward hearth & garden)
    const sofa = new THREE.Group();
    sofa.add(box(2.85, 0.24, 0.96, C.fabric, 0, 0, 0));
    for (let c = -1; c <= 1; c++) {
      sofa.add(box(0.84, 0.18, 0.76, C.fabric, c * 0.86, 0.24, 0.08));
      sofa.add(box(0.84, 0.38, 0.22, C.fabric, c * 0.86, 0.42, -0.32));
    }
    sofa.add(box(2.85, 0.42, 0.20, C.fabric, 0, 0.42, -0.38));
    sofa.add(box(0.24, 0.38, 0.96, C.fabric, -1.31, 0.24, 0));
    sofa.add(box(0.24, 0.38, 0.96, C.fabric, 1.31, 0.24, 0));
    // Terracotta & sage accent cushions
    sofa.add(box(0.38, 0.34, 0.16, C.terracotta, -1.02, 0.42, -0.16, { edges: 0 }));
    sofa.add(box(0.38, 0.34, 0.16, C.plant, 1.02, 0.42, -0.16, { edges: 0 }));
    sofa.position.set(3.85, FL + 0.03, -1.85);
    F(sofa, 0.22);

    // 5. Sculpted Travertine & European Oak Coffee Table
    const coffee = new THREE.Group();
    coffee.add(box(1.32, 0.045, 0.82, C.travertine, 0, 0.32, 0));
    coffee.add(box(0.28, 0.32, 0.54, C.oak, -0.36, 0, 0));
    coffee.add(box(0.28, 0.32, 0.54, C.oak, 0.36, 0, 0));
    coffee.add(box(0.34, 0.03, 0.26, C.accent, -0.26, 0.365, 0.06, { edges: 0 }));
    coffee.add(cyl(0.09, 0.07, 0.18, 16, C.brass, 0.28, 0.365, -0.08));
    coffee.position.set(3.85, FL + 0.03, -0.42);
    F(coffee, 0.30);

    // 6. Cognac Leather Lounge Armchair, Side Table & Warm Floor Reading Lamp
    const chair = new THREE.Group();
    chair.add(box(0.82, 0.38, 0.82, C.leather, 0, 0, 0));
    chair.add(box(0.82, 0.42, 0.20, C.leather, 0, 0.38, 0.31));
    chair.add(box(0.14, 0.32, 0.78, C.oak, -0.38, 0.18, 0));
    chair.add(box(0.14, 0.32, 0.78, C.oak, 0.38, 0.18, 0));
    chair.rotation.y = 0.38;
    chair.position.set(2.35, FL + 0.03, 0.72);
    F(chair, 0.38);

    const floorLamp = new THREE.Group();
    floorLamp.add(cyl(0.18, 0.18, 0.03, 20, C.brass, 0, 0, 0));
    floorLamp.add(cyl(0.018, 0.018, 1.55, 12, C.brass, 0, 0.03, 0));
    floorLamp.add(cyl(0.22, 0.26, 0.32, 20, glowShadeM(), 0, 1.48, 0, { cast: false }));
    floorLamp.position.set(2.15, FL + 0.03, -2.35);
    F(floorLamp, 0.44);

    // 7. 6-Seat European Oak Dining Table, Chairs, Linear Brass Chandelier & Framed Wall Art
    const dining = new THREE.Group();
    dining.add(box(2.25, 0.045, 0.98, C.oak, 0, 0.72, 0));
    for (const sx of [-1, 1]) dining.add(box(0.07, 0.72, 0.82, C.oak, sx * 0.92, 0, 0));
    dining.add(cyl(0.14, 0.10, 0.09, 16, C.travertine, -0.25, 0.765, 0));
    dining.add(cyl(0.07, 0.06, 0.22, 14, C.terracotta, 0.22, 0.765, 0.04));
    for (let i = 0; i < 3; i++) for (const sz of [-1, 1]) {
      const cx = -0.7 + i * 0.7, cz = sz * 0.74;
      dining.add(box(0.45, 0.04, 0.44, C.fabric, cx, 0.43, cz));
      for (const lx of [-0.18, 0.18]) for (const lz of [-0.18, 0.18]) {
        dining.add(box(0.035, 0.43, 0.035, C.oak, cx + lx, 0, cz + lz, { edges: 0 }));
      }
      dining.add(box(0.45, 0.36, 0.045, C.oak, cx, 0.46, sz * 0.94));
    }
    // Framed modernist relief painting on the west dining wall
    const frameArt = new THREE.Group();
    frameArt.add(box(0.03, 1.25, 1.25, C.dark, -2.96, 1.05, -0.1, { edges: 0 }));
    frameArt.add(box(0.035, 1.16, 1.16, mat(0xffffff, { map: TX.art1, roughness: 0.65 }), -2.95, 1.095, -0.1, { edges: 0, uvMode: false }));
    dining.add(frameArt);
    dining.position.set(-2.85, FL + 0.03, 1.95);
    F(dining, 0.54);

    // 8. Mezzanine Bedroom Platform Bed, Nightstands, Warm Lamps & Architect's Study Desk Suite
    const loftSuite = new THREE.Group();
    // Bedroom wool rug
    loftSuite.add(box(2.7, 0.015, 2.5, rugM, -4.15, MEZZ + 0.10, 0.15, { edges: 0, cast: false }));
    // Oak platform bed & wide headboard
    loftSuite.add(box(2.15, 0.32, 1.86, C.oak, -4.25, MEZZ + 0.10, 0.15));
    loftSuite.add(box(1.98, 0.18, 1.72, C.plaster, -4.20, MEZZ + 0.42, 0.15));
    // Terracotta throw blanket across foot of bed
    loftSuite.add(box(0.58, 0.20, 1.74, C.terracotta, -3.52, MEZZ + 0.42, 0.15, { edges: 0 }));
    loftSuite.add(box(0.10, 0.92, 2.65, C.oak, -5.32, MEZZ + 0.10, 0.15));
    for (const sz of [-0.44, 0.44]) {
      loftSuite.add(box(0.44, 0.13, 0.68, C.fabric, -4.92, MEZZ + 0.60, 0.15 + sz));
    }
    // Floating oak nightstands & glowing bedside lamps
    for (const sz of [-1.12, 1.12]) {
      loftSuite.add(box(0.42, 0.06, 0.44, C.oak, -5.08, MEZZ + 0.42, 0.15 + sz));
      loftSuite.add(cyl(0.08, 0.10, 0.14, 14, C.brass, -5.08, MEZZ + 0.48, 0.15 + sz));
      loftSuite.add(cyl(0.12, 0.14, 0.18, 16, glowShadeM(), -5.08, MEZZ + 0.62, 0.15 + sz, { cast: false }));
    }
    // Architect's oak study desk & chair in the south-east mezzanine bay (visible in the Loft Suite shot)
    loftSuite.add(box(1.50, 0.04, 0.72, C.oak, -2.15, MEZZ + 0.82, 2.05));
    loftSuite.add(box(0.06, 0.72, 0.68, C.oak, -2.85, MEZZ + 0.10, 2.05));
    loftSuite.add(box(0.06, 0.72, 0.68, C.oak, -1.45, MEZZ + 0.10, 2.05));
    // Miniature timber study model & brass task lamp on desk
    loftSuite.add(box(0.32, 0.16, 0.22, C.glulam, -2.35, MEZZ + 0.86, 2.05));
    loftSuite.add(cyl(0.09, 0.11, 0.34, 14, C.brass, -1.72, MEZZ + 0.86, 2.15));
    loftSuite.add(cyl(0.12, 0.14, 0.14, 14, glowShadeM(), -1.72, MEZZ + 1.16, 2.15, { cast: false }));
    // Study chair
    loftSuite.add(box(0.46, 0.04, 0.46, C.leather, -2.15, MEZZ + 0.54, 1.48));
    loftSuite.add(box(0.46, 0.38, 0.06, C.oak, -2.15, MEZZ + 0.56, 1.28));
    for (const lx of [-0.18, 0.18]) for (const lz of [-0.18, 0.18]) {
      loftSuite.add(box(0.035, 0.44, 0.035, C.oak, -2.15 + lx, MEZZ + 0.10, 1.48 + lz, { edges: 0 }));
    }
    F(loftSuite, 0.68, V(-3.0, MEZZ + 0.1, 0.8));

    // 9. Pendant Luminaires over Kitchen Island & Dining Table
    const lights = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const lx = -4.15 + i * 0.8;
      lights.add(cyl(0.14, 0.18, 0.22, 18, C.dark, lx, 2.12, -0.55));
      lights.add(cyl(0.11, 0.11, 0.06, 16, glowShadeM(), lx, 2.08, -0.55, { cast: false }));
      lights.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([V(lx, 2.34, -0.55), V(lx, MEZZ - 0.14, -0.55)]), ink));
    }
    // Linear brass pendant over dining table
    lights.add(box(1.45, 0.04, 0.05, C.brass, -2.85, 2.08, 1.95, { edges: 0 }));
    lights.add(box(1.38, 0.02, 0.04, glowShadeM(), -2.85, 2.06, 1.95, { edges: 0, cast: false }));
    lights.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([
      V(-3.4, 2.12, 1.95), V(-3.4, MEZZ - 0.14, 1.95),
      V(-2.3, 2.12, 1.95), V(-2.3, MEZZ - 0.14, 1.95),
    ]), ink));
    F(lights, 0.80, V(-3.35, 2.15, 0.5));

    // 10. Potted Architectural Olive Tree inside East Gable + Outdoor Terrace Lounge Chairs on Deck
    const terraceAndPlant = new THREE.Group();
    terraceAndPlant.add(cyl(0.26, 0.20, 0.52, 18, C.terracotta, 5.35, FL + 0.02, 2.65));
    terraceAndPlant.add(cyl(0.035, 0.05, 1.15, 10, 0x5D5246, 5.35, FL + 0.54, 2.65));
    const oliveCrown = makeOrganicClusterGeo(0.58, 0.48, 0.55, 2).translate(5.35, FL + 1.65, 2.65);
    terraceAndPlant.add(solid(oliveCrown, mat(0x7A885E, { bumpMap: TX.foliageBump, bumpScale: 0.024 }), { edges: 0 }));
    // Two teak & linen outdoor lounge chairs + low table on the eastern timber deck
    for (const sz of [-1.15, 1.15]) {
      terraceAndPlant.add(box(0.78, 0.28, 0.78, C.deck, HX + 1.85, 0.12, sz));
      terraceAndPlant.add(box(0.72, 0.10, 0.72, C.fabric, HX + 1.85, 0.40, sz));
      terraceAndPlant.add(box(0.16, 0.36, 0.72, C.fabric, HX + 2.16, 0.50, sz));
    }
    terraceAndPlant.add(box(0.68, 0.28, 0.68, C.deck, HX + 1.85, 0.12, 0));
    F(terraceAndPlant, 0.90, V(5.5, FL, 1.2));
  }

  // ---------------------------------------------------------------- surroundings: realistic multi-clustered architectural trees
  const trees = [];
  {
    const spots = [[-31, -18, 1.2], [-31, 2, 1.4], [-30, 22, 1.0], [32, -17, 1.3], [33, 4, 1.1], [31, 22, 1.5], [-6, -24, 1.2], [9, -27, 1.4],
      [-40, -10, 1.6], [42, -6, 1.5], [-18, -28, 1.3], [20, -30, 1.2], [38, 22, 1.2], [-36, 24, 1.3], [0, -36, 1.6]];
    const barkMat = mat(0x5D5246, { bumpMap: TX.woodBump, bumpScale: 0.022, roughness: 0.86 });
    const crownSpecs = [
      [0, 4.4, 0, 2.1, 1.65, 2.0, 0],
      [-1.15, 3.85, 0.65, 1.45, 1.22, 1.4, 1],
      [1.1, 3.95, -0.55, 1.5, 1.25, 1.42, 2],
      [0.35, 4.95, 0.85, 1.38, 1.18, 1.35, 0],
      [-0.65, 4.8, -0.9, 1.35, 1.15, 1.3, 1],
      [0.85, 3.45, 0.95, 1.22, 1.02, 1.18, 2],
    ];
    const springCols = [new THREE.Color(0xABA98E), new THREE.Color(0x9FA083), new THREE.Color(0xB5B298)];
    const summerCols = [new THREE.Color(0x6D7E52), new THREE.Color(0x5C6D42), new THREE.Color(0x7F8E63)];

    spots.forEach(([x, z, k], idx) => {
      const t = new THREE.Group();
      // Tapered trunk + 3 scaffold branches reaching into the canopy
      t.add(solid(new THREE.CylinderGeometry(0.11 * k, 0.22 * k, 3.1 * k, 10).translate(0, 1.55 * k, 0), barkMat, { edges: 0 }));
      t.add(beam(V(0, 2.1 * k, 0), V(-0.95 * k, 3.6 * k, 0.5 * k), 0.11 * k, 0.11 * k, barkMat, { edges: 0 }));
      t.add(beam(V(0, 2.2 * k, 0), V(0.9 * k, 3.7 * k, -0.45 * k), 0.10 * k, 0.10 * k, barkMat, { edges: 0 }));
      t.add(beam(V(0, 2.5 * k, 0), V(0.25 * k, 4.2 * k, 0.7 * k), 0.09 * k, 0.09 * k, barkMat, { edges: 0 }));

      const crown = new THREE.Group();
      const clusterMeshes = [];
      crownSpecs.forEach(([cx, cy, cz, rx, ry, rz, cIdx]) => {
        const geo = makeOrganicClusterGeo(rx * k, ry * k, rz * k, 2).translate(cx * k, cy * k, cz * k);
        const cm = new THREE.MeshStandardMaterial({
          color: springCols[cIdx].clone(),
          bumpMap: TX.foliageBump,
          bumpScale: 0.028,
          roughness: 0.74,
          envMapIntensity: 0.42,
        });
        const m = new THREE.Mesh(geo, cm);
        m.castShadow = true; m.receiveShadow = true;
        crown.add(m);
        clusterMeshes.push({ mesh: m, spring: springCols[cIdx], summer: summerCols[cIdx] });
      });
      t.add(crown);
      t.position.set(x, 0, z);
      t.rotation.y = idx * 0.85;
      root.add(t);
      trees.push({ t, crown, clusters: clusterMeshes });
    });
  }

  // The crane: a truck-mounted crane north-west of the house, its hook and 2-leg rigging sling over whatever is being placed.
  const crane = new THREE.Group();
  const boom = new THREE.Group();
  const cable = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints([V(), V(), V(), V(), V(), V()]),
    new THREE.LineBasicMaterial({ color: C.ink })
  );
  const hookBlock = box(0.28, 0.36, 0.22, C.accent, 0, 0, 0, { cast: false });
  const PIV = V(9.5, 3.0, -12);
  {
    crane.add(box(9, 1.3, 2.5, C.machine, PIV.x - 0.5, 0.6, PIV.z));
    crane.add(box(2.2, 1.6, 2.5, C.machine, PIV.x - 4.4, 1.9, PIV.z));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) crane.add(box(0.5, 0.65, 0.5, C.dark, PIV.x - 0.5 + sx * 3.6, 0, PIV.z + sz * 1.0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) crane.add(box(0.6, 0.15, 0.6, C.dark, PIV.x - 0.5 + sx * 3.2, 0, PIV.z + sz * 2.6));
    crane.add(box(2.6, 1.0, 2.2, C.machine, PIV.x, 1.9, PIV.z));
    const bg = new THREE.BoxGeometry(0.32, 0.38, 1).translate(0, 0, 0.5);
    const bm = solid(bg, C.machine);
    boom.add(bm);
    boom.position.copy(PIV);
    crane.add(boom);
    crane.add(cable);
    crane.add(hookBlock);
    root.add(crane);
  }

  const groundAt = new THREE.Vector3();
  let lastHook = V(0, RIDGE + 4, 0);

  function update(T, o = {}) {
    let active = null;
    for (const p of parts) {
      const s = clamp01((T - p.t0) / (p.t1 - p.t0));
      const gone = T > p.until ? clamp01((T - p.until) / p.out) : 0;
      p.s = s;
      p.pivot.visible = s > 0 && gone < 1;
      if (!p.pivot.visible) { if (p.ghosts) for (const g of p.ghosts) g.visible = (o.ghost ?? 0) > 0 && s <= 0; continue; }
      const e = easeOut(s);
      p.pivot.scale.set(1, 1, 1);
      p.obj.position.copy(p.home);
      p.obj.rotation.set(0, 0, 0);
      if (p.how === 'drop') {
        // Realistic crane lowering with subtle damped touchdown settle & gentle cable sway
        const settle = s > 0.76 && s < 1 ? Math.sin(((s - 0.76) / 0.24) * Math.PI * 2.5) * Math.exp(-(s - 0.76) * 14) * 0.04 : 0;
        p.obj.position.y += (1 - e) * p.drop + settle;
        if (p.lift && s < 1) {
          p.obj.rotation.z = Math.sin(s * Math.PI * 2.2) * (1 - e) * 0.022;
        }
      } else if (p.how === 'rise') {
        p.pivot.scale.y = Math.max(1e-3, e);
      } else if (p.how === 'grow') {
        p.pivot.scale.setScalar(Math.max(1e-3, e));
      }
      if (gone > 0) p.pivot.scale.multiplyScalar(Math.max(1e-3, 1 - easeOut(gone)));
      const ph = PHASES[p.phase];
      const heat = p.hot ? (s < 1 ? 1 : 0.28 * (1 - smooth(ph.w1 - 0.3, ph.w1, T)) + 0.72 * (1 - smooth(p.t1, p.t1 + 0.12, T))) : 0;
      const effHeat = T >= WEEKS ? 0 : heat;
      // Keep realistic material textures visible during craning with a subtle 0.22 warm tint + crisp #e85d04 CAD edge highlight
      for (const m of p.mats) m.color.copy(m.userData.base).lerp(accent, effHeat * 0.22);
      for (const em of p.edgeMats) {
        em.color.copy(inkCol).lerp(accent, effHeat);
        em.opacity = 0.22 + 0.68 * effHeat;
      }
      if (p.ghosts) for (const g of p.ghosts) g.visible = false;
      if (p.lift && s > 0 && s < 1 && (!active || p.t0 > active.t0)) active = p;
    }
    for (const g of ghostRoot.children) g.material.opacity = 0.45 * (o.ghost ?? 0);

    // Swing the front door open on its hinges as the build reaches handover (T >= 13.15)
    if (frontDoorPivot) {
      const doorOpen = easeOut(smooth(13.15, 13.45, T));
      frontDoorPivot.rotation.y = doorOpen * 1.36;
    }

    // Excavation: the pit deepens, the spoil heap grows, then the backfill takes it away.
    const dig = clamp01((T - PHASES[1].w0) / (PHASES[1].w1 - 0.2 - PHASES[1].w0));
    pit.visible = dig > 0;
    pit.userData.floor.position.y = -PIT.depth * Math.max(0.02, easeOut(dig));
    if (o.cap) { o.cap.visible = dig <= 0; }
    const heap = clamp01(dig) * (1 - smooth(3.2, 3.6, T));
    spoil.visible = heap > 0.01;
    spoil.scale.set(0.4 + 0.6 * heap, Math.max(1e-3, heap), 0.4 + 0.6 * heap);

    // Crane: arrives with the frames, leaves after the glazing.
    const cr = smooth(3.3, 3.55, T) * (1 - smooth(10.6, 10.9, T));
    crane.visible = cr > 0.5;
    if (crane.visible) {
      let hook = lastHook;
      if (active) {
        groundAt.copy(active.top); groundAt.y += active.obj.position.y - active.home.y + 0.05;
        hook = groundAt.clone();
        lastHook.copy(hook);
      } else hook = V(0, RIDGE + 3.5, 0);
      const tip = hook.clone(); tip.y = Math.max(hook.y + 4.5, RIDGE + 5);
      const tipW = tip.clone();
      boom.lookAt(tipW);
      boom.scale.z = PIV.distanceTo(tipW);
      boom.children[0].scale.z = 1;
      if (active) {
        const swivel = hook.clone().add(V(0, 1.15, 0));
        const legA = hook.clone().add(V(-active.spanX * 0.5, -0.02, -active.spanZ * 0.35));
        const legB = hook.clone().add(V(active.spanX * 0.5, -0.02, active.spanZ * 0.35));
        cable.geometry.setFromPoints([tipW, swivel, swivel, legA, swivel, legB]);
        hookBlock.position.copy(swivel);
        hookBlock.visible = true;
        cable.visible = true;
      } else {
        cable.visible = false;
        hookBlock.visible = false;
      }
    }

    // Warm interior lights and fireplace hearth glow ramp up at handover
    const glow = smooth(12.2, 13.5, T);
    warmLight1.intensity = 4.6 * glow;
    warmLight2.intensity = 3.8 * glow;
    warmLight3.intensity = 4.0 * glow;
    warmLight4.intensity = 3.4 * glow;
    if (fireEmberMat) fireEmberMat.emissiveIntensity = 2.4 * glow;

    // Multi-clustered trees come into leaf: early spring olive-taupe in March to lush architectural olive/sage by June.
    const leaf = smooth(2, 11, T);
    for (const tr of trees) {
      tr.crown.scale.setScalar(0.76 + 0.24 * leaf);
      for (const cl of tr.clusters) {
        cl.mesh.material.color.copy(cl.spring).lerp(cl.summer, leaf);
      }
    }
    return active;
  }

  if (opts.ghost) root.add(ghostRoot);
  return { root, parts, update, crane, trees, SITE, pit, ghostRoot };
}

// The ground with the pit cut out of it. uv(x, z) maps world to texture when a sheet is printed on it.
export function groundWithPit(material, { size = 600, uv } = {}) {
  const s = new THREE.Shape([[-size, -size], [size, -size], [size, size], [-size, size]].map(([x, z]) => new THREE.Vector2(x, -z)));
  const { x0, x1, z0, z1 } = PIT;
  s.holes.push(new THREE.Path([[x0, z0], [x0, z1], [x1, z1], [x1, z0]].map(([x, z]) => new THREE.Vector2(x, -z))));
  const g = new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2);
  const cap = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  if (uv) for (const geo of [g, cap]) {
    const p = geo.attributes.position, u = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) { const [a, b] = uv(p.getX(i), p.getZ(i)); u.setXY(i, a, b); }
    u.needsUpdate = true;
  }
  const ground = new THREE.Mesh(g, material);
  const capM = new THREE.Mesh(cap, material);
  ground.receiveShadow = capM.receiveShadow = true;
  return { ground, cap: capM };
}
