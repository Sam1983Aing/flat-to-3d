// The material world: textures painted on canvases at load (no image files), materials, sky, and procedural bump relief.
// Every texture is in metres: uv comes from world position (house.js), so `tile` is the size of one repeat.
import * as THREE from 'three';

let seed = 7;
const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export function createLook(renderer, sectionBoxes = []) {
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const tex = (size, tile, draw, srgb = true) => {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'); draw(g, size);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / tile, 1 / tile);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    return t;
  };
  const grain = (g, s, amp) => {
    const d = g.getImageData(0, 0, s, s);
    for (let i = 0; i < d.data.length; i += 4) { const k = (rnd() - 0.5) * amp; d.data[i] += k; d.data[i + 1] += k; d.data[i + 2] += k; }
    g.putImageData(d, 0, 0);
  };
  const blotches = (g, s, n, rgba, r0, r1) => {
    for (let i = 0; i < n; i++) {
      const x = rnd() * s, y = rnd() * s, r = r0 + rnd() * (r1 - r0);
      for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) {
        const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        gr.addColorStop(0, rgba); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      }
    }
  };
  // wood: rows of boards of random length, each with its own tone, cathedral grain, and matching bump map
  const woodPair = (hue, sat, lit, rows, tile, size = 1024) => {
    const cb = document.createElement('canvas'); cb.width = cb.height = size;
    const gb = cb.getContext('2d');
    const col = tex(size, tile, (g, s) => {
      const h = s / rows;
      gb.fillStyle = '#808080'; gb.fillRect(0, 0, s, s);
      for (let r = 0; r < rows; r++) {
        let x = -rnd() * s;
        while (x < s) {
          const L = s * (0.68 + rnd() * 0.85), v = rnd();
          g.fillStyle = `hsl(${hue + (v - 0.5) * 4.5},${sat + (v - 0.5) * 6}%,${lit + (v - 0.5) * 8.5}%)`; g.fillRect(x, r * h, L, h);
          gb.fillStyle = `rgb(${Math.round(108 + v * 36)},${Math.round(108 + v * 36)},${Math.round(108 + v * 36)})`; gb.fillRect(x, r * h, L, h);
          for (let k = 0; k < 58; k++) {
            const yy = r * h + rnd() * h, gh = 0.6 + rnd() * 1.6;
            g.fillStyle = `rgba(68,38,16,${0.045 + rnd() * 0.085})`; g.fillRect(x, yy, L, gh);
            gb.fillStyle = 'rgba(22,22,22,0.32)'; gb.fillRect(x, yy, L, gh);
          }
          for (let k = 0; k < 16; k++) {
            const yy = r * h + rnd() * h, gh = 0.9 + rnd() * 2.0;
            g.fillStyle = `rgba(255,242,220,${0.035 + rnd() * 0.055})`; g.fillRect(x, yy, L, gh);
            gb.fillStyle = 'rgba(228,228,228,0.22)'; gb.fillRect(x, yy, L, gh);
          }
          g.fillStyle = 'rgba(28,15,6,0.58)'; g.fillRect(x, r * h, 2.2, h);
          gb.fillStyle = '#080808'; gb.fillRect(x, r * h, 2.8, h);
          gb.fillStyle = '#c8c8c8'; gb.fillRect(x + 2.8, r * h, 1.6, h);
          x += L;
        }
        g.fillStyle = 'rgba(28,15,6,0.52)'; g.fillRect(0, r * h, s, 2.0);
        gb.fillStyle = '#080808'; gb.fillRect(0, r * h, s, 2.6);
        gb.fillStyle = '#cecece'; gb.fillRect(0, r * h + 2.6, s, 1.4);
      }
      grain(g, s, 11); grain(gb, s, 18);
    });
    const bump = new THREE.CanvasTexture(cb);
    bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(1 / tile, 1 / tile); bump.anisotropy = aniso;
    return { map: col, bump };
  };
  const veneer = (base, streak, tile, gaps) => tex(1024, tile, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let k = 0; k < 1300; k++) { const x = rnd() * s; g.fillStyle = `rgba(${streak},${0.03 + rnd() * 0.075})`; g.fillRect(x, 0, 0.6 + rnd() * 1.8, s); }
    for (let k = 0; k < 95; k++) { const x = rnd() * s; g.fillStyle = `rgba(255,238,214,${0.025 + rnd() * 0.045})`; g.fillRect(x, 0, 1.8 + rnd() * 5.5, s); }
    if (gaps) {
      for (let i = 0; i < gaps; i++) {
        const gx = (i * s) / gaps;
        g.fillStyle = 'rgba(12,6,2,0.88)'; g.fillRect(gx, 0, 3.2, s);
        g.fillStyle = 'rgba(255,235,210,0.09)'; g.fillRect(gx + 3.2, 0, 2.0, s);
      }
    }
    grain(g, s, 7);
  });
  const noise = (base, amp, tile, size = 256, fibres = 0) => tex(size, tile, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let i = 0; i < fibres; i++) {
      const horiz = i % 2 === 0;
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)';
      g.fillRect(rnd() * s, rnd() * s, horiz ? 2 + rnd() * 3 : 1, horiz ? 1 : 2 + rnd() * 3);
    }
    grain(g, s, amp);
  });

  const oakP = woodPair(31, 38, 58, 12, 2.2);
  const oakFurnP = woodPair(31, 40, 61, 8, 1.2, 512);
  const walnutP = woodPair(22, 35, 26, 8, 1.3, 512);
  const teakP = woodPair(28, 34, 40, 6, 1.2, 512);

  const concBump = tex(512, 2.4, (g, s) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += s / 16) { g.fillStyle = '#1e1e1e'; g.fillRect(0, y, s, 2.4); g.fillStyle = '#c8c8c8'; g.fillRect(0, y + 2.4, s, 1.8); }
    for (let x = 0; x < s; x += s / 4) { g.fillStyle = 'rgba(30,30,30,0.35)'; g.fillRect(x, 0, 1.5, s); }
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      g.fillStyle = '#121212'; g.beginPath(); g.arc((c + 0.5) * s / 4, (r + 0.5) * s / 4, 3.6, 0, 7); g.fill();
      g.strokeStyle = '#b0b0b0'; g.lineWidth = 1.2; g.beginPath(); g.arc((c + 0.5) * s / 4, (r + 0.5) * s / 4, 4.6, 0, 7); g.stroke();
    }
    grain(g, s, 24);
  }, false);

  const plasterBump = tex(512, 2.2, (g, s) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, s, s);
    blotches(g, s, 55, 'rgba(255,255,255,0.08)', 18, 68);
    blotches(g, s, 55, 'rgba(0,0,0,0.08)', 16, 64);
    grain(g, s, 14);
  }, false);

  const fabricBump = tex(256, 0.35, (g, s) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 4) { g.fillStyle = 'rgba(255,255,255,0.24)'; g.fillRect(0, y, s, 1.5); }
    for (let x = 0; x < s; x += 4) { g.fillStyle = 'rgba(0,0,0,0.24)'; g.fillRect(x, 0, 1.5, s); }
    grain(g, s, 28);
  }, false);

  const rugBump = tex(512, 0.75, (g, s) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, s, s);
    // tactile hand-loomed wool loop ribs and cross-weft knots
    for (let y = 0; y < s; y += 6) {
      g.fillStyle = '#c4c4c4'; g.fillRect(0, y, s, 2.8);
      g.fillStyle = '#383838'; g.fillRect(0, y + 3.0, s, 2.4);
      for (let x = (y % 12 === 0 ? 0 : 4); x < s; x += 8) {
        g.fillStyle = rnd() < 0.5 ? 'rgba(245,245,245,0.52)' : 'rgba(25,25,25,0.52)';
        g.fillRect(x, y, 4.5, 2.8);
      }
    }
    grain(g, s, 28);
  }, false);

  const stoneBump = tex(512, 1.4, (g, s) => {
    g.fillStyle = '#888888'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 420; i++) { g.fillStyle = 'rgba(18,18,18,0.5)'; g.fillRect(rnd() * s, rnd() * s, 2 + rnd() * 15, 1 + rnd() * 2.2); }
    grain(g, s, 20);
  }, false);

  const T = {
    conc: tex(512, 2.4, (g, s) => {
      g.fillStyle = '#beb9b0'; g.fillRect(0, 0, s, s);
      // clean architectural board-formed concrete with subtle board-to-board mineral tone and formwork seams
      for (let i = 0; i < 16; i++) {
        const y = i * (s / 16), v = (rnd() - 0.5) * 9;
        g.fillStyle = `rgb(${Math.round(191 + v)},${Math.round(186 + v)},${Math.round(177 + v)})`;
        g.fillRect(0, y, s, s / 16);
        for (let k = 0; k < 18; k++) {
          g.fillStyle = `rgba(95,88,78,${0.025 + rnd() * 0.035})`;
          g.fillRect(0, y + rnd() * (s / 16), s, 0.8 + rnd() * 1.4);
        }
        g.fillStyle = 'rgba(40,35,30,0.20)'; g.fillRect(0, y, s, 1.5);
        g.fillStyle = 'rgba(255,252,245,0.12)'; g.fillRect(0, y + 1.5, s, 1.2);
      }
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const cx = (c + 0.5) * s / 4, cy = (r + 0.5) * s / 4;
        g.fillStyle = 'rgba(48,43,38,0.38)'; g.beginPath(); g.arc(cx, cy, 3.0, 0, 7); g.fill();
      }
      grain(g, s, 12);
    }),
    plaster: tex(512, 2.6, (g, s) => {
      g.fillStyle = '#f3efe8'; g.fillRect(0, 0, s, s);
      blotches(g, s, 45, 'rgba(255,252,246,0.06)', 24, 90);
      blotches(g, s, 45, 'rgba(185,174,156,0.05)', 24, 90);
      grain(g, s, 5);
    }),
    walnutV: veneer('#543724', '26,13,6', 1.2, 0),
    walnutDoors: veneer('#543724', '26,13,6', 1.2, 4),
    oakV: veneer('#caa67c', '100,64,32', 1.2, 0),
    curtain: tex(512, 0.55, (g, s) => {
      g.fillStyle = '#efe8dc'; g.fillRect(0, 0, s, s);
      // vertical woven Belgian linen warp threads and subtle vertical slub shading
      for (let x = 0; x < s; x += 3) {
        g.fillStyle = x % 6 === 0 ? 'rgba(255,252,246,0.14)' : 'rgba(130,116,96,0.10)';
        g.fillRect(x, 0, 1.5, s);
      }
      for (let i = 0; i < 900; i++) {
        g.fillStyle = rnd() < 0.5 ? 'rgba(255,250,240,0.12)' : 'rgba(120,106,88,0.10)';
        g.fillRect(rnd() * s, rnd() * s, 1, 6 + rnd() * 18);
      }
      grain(g, s, 8);
    }),
    artSection: (() => {
      // a print of section A-A, drawn from the same boxes as the house, flipped horizontally to match the wall normal
      const c = document.createElement('canvas'); c.width = 1024; c.height = 576; const g = c.getContext('2d');
      g.fillStyle = '#f2eee4'; g.fillRect(0, 0, 1024, 576);
      g.translate(1024, 0); g.scale(-1, 1);
      const X = (x) => 70 + (x + 3) / 29 * 884, Y = (y) => 420 - (y + 1) * 32;
      g.strokeStyle = 'rgba(29,28,25,0.55)'; g.lineWidth = 1;
      for (let i = -40; i < 80; i++) { g.beginPath(); g.moveTo(X(i * 0.6), Y(-6.5)); g.lineTo(X(i * 0.6 + 3.4), Y(-3.1)); g.stroke(); }
      g.fillStyle = '#f2eee4'; g.fillRect(0, 0, X(3.7), Y(0)); g.fillRect(X(3.7), 0, 1024, Y(-3.2)); g.fillRect(0, Y(-6.5), 1024, 576);
      g.fillStyle = '#1b1a17';
      for (const b of sectionBoxes) g.fillRect(X(b[0]), Y(b[4]), Math.max(1.5, X(b[3]) - X(b[0])), Math.max(1.5, Y(b[1]) - Y(b[4])));
      g.fillStyle = '#1b1a17'; g.font = '500 20px monospace'; g.fillText('SECTION A-A', 70, 520); g.font = '14px monospace'; g.fillText('HOUSE ON A SLOPE  1:100', 70, 545);
      g.strokeStyle = '#d4501e'; g.lineWidth = 1.5; g.setLineDash([6, 4]); g.beginPath(); g.moveTo(X(30), Y(11.6)); g.lineTo(X(7.3), Y(0)); g.stroke();
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t;
    })(),
    oak: oakP.map, oakBump: oakP.bump,
    oakFurn: oakFurnP.map, oakFurnBump: oakFurnP.bump,
    walnut: walnutP.map, walnutBump: walnutP.bump,
    teak: teakP.map,
    stoneFloor: tex(512, 1.8, (g, s) => {
      g.fillStyle = '#cfc5b4'; g.fillRect(0, 0, s, s);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,248,235' : '105,90,72'},${0.06 + rnd() * 0.06})`; g.fillRect(c * s / 3, r * s / 3, s / 3, s / 3); }
      blotches(g, s, 55, 'rgba(120,104,82,0.065)', 10, 42);
      g.fillStyle = 'rgba(62,53,42,0.52)'; for (let i = 0; i < 3; i++) { g.fillRect(0, i * s / 3, s, 2.0); g.fillRect(i * s / 3, 0, 2.0, s); }
      grain(g, s, 10);
    }),
    pave: tex(512, 2.4, (g, s) => {
      g.fillStyle = '#d6ccb9'; g.fillRect(0, 0, s, s);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,250,240,0.09)' : 'rgba(110,95,70,0.07)'; g.fillRect(c * s / 2, r * s / 4, s / 2, s / 4); }
      g.fillStyle = 'rgba(75,64,50,0.38)'; for (let r = 0; r < 4; r++) g.fillRect(0, r * s / 4, s, 1.5);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) g.fillRect(c * s / 2 + (r % 2) * s / 4, r * s / 4, 1.5, s / 4);
      grain(g, s, 10);
    }),
    grass: tex(512, 3.4, (g, s) => {
      g.fillStyle = '#78864e'; g.fillRect(0, 0, s, s);
      // subtle directional lawn striping and organic meadow patches
      for (let i = 0; i < 8; i++) {
        g.fillStyle = i % 2 === 0 ? 'rgba(215,212,145,0.055)' : 'rgba(42,56,22,0.055)';
        g.fillRect(0, i * (s / 8), s, s / 8);
      }
      blotches(g, s, 48, 'rgba(54,70,28,0.09)', 16, 64);
      blotches(g, s, 36, 'rgba(178,176,106,0.08)', 14, 52);
      for (let i = 0; i < 20000; i++) {
        const r = rnd();
        g.fillStyle = r < 0.42 ? 'rgba(38,54,18,0.26)' : r < 0.78 ? 'rgba(138,152,82,0.22)' : 'rgba(206,198,128,0.18)';
        g.fillRect(rnd() * s, rnd() * s, 1 + (r > 0.7 ? 0.6 : 0), 2.2 + rnd() * 3.2);
      }
      grain(g, s, 10);
    }),
    earth: tex(512, 3.2, (g, s) => {
      // monolithic cast-in-place architectural concrete (cool mineral grey with square form panels and tie cones, no horizontal floorboards)
      g.fillStyle = '#8d9092'; g.fillRect(0, 0, s, s);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
        const px = c * (s / 2), py = r * (s / 2), v = (rnd() - 0.5) * 7;
        g.fillStyle = `rgb(${Math.round(140 + v)},${Math.round(143 + v)},${Math.round(145 + v)})`;
        g.fillRect(px, py, s / 2, s / 2);
      }
      blotches(g, s, 65, 'rgba(175,180,184,0.08)', 18, 72);
      blotches(g, s, 65, 'rgba(72,76,80,0.08)', 16, 68);
      // crisp square formwork panel seams
      g.fillStyle = 'rgba(42,45,48,0.38)';
      for (let i = 0; i < 2; i++) {
        g.fillRect(0, i * (s / 2), s, 2.0);
        g.fillRect(i * (s / 2), 0, 2.0, s);
      }
      g.fillStyle = 'rgba(220,225,230,0.18)';
      for (let i = 0; i < 2; i++) {
        g.fillRect(0, i * (s / 2) + 2.0, s, 1.2);
        g.fillRect(i * (s / 2) + 2.0, 0, 1.2, s);
      }
      // form-tie cone holes inside each square concrete panel
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const cx = (c + 0.5) * (s / 4), cy = (r + 0.5) * (s / 4);
        g.fillStyle = 'rgba(38,41,44,0.52)'; g.beginPath(); g.arc(cx, cy, 3.4, 0, 7); g.fill();
        g.strokeStyle = 'rgba(210,215,220,0.28)'; g.lineWidth = 1.2; g.beginPath(); g.arc(cx, cy, 4.6, 0, 7); g.stroke();
      }
      grain(g, s, 13);
    }),
    marble: tex(512, 1.6, (g, s) => {
      g.fillStyle = '#f0ede8'; g.fillRect(0, 0, s, s);
      for (let k = 0; k < 14; k++) {
        g.strokeStyle = `rgba(105,98,90,${0.16 + rnd() * 0.24})`; g.lineWidth = 0.6 + rnd() * 1.6; g.beginPath();
        let x = rnd() * s, y = 0; g.moveTo(x, y);
        while (y < s) { x += (rnd() - 0.5) * 38; y += 10 + rnd() * 28; g.lineTo(x, y); }
        g.stroke();
      }
      grain(g, s, 5);
    }),
    travertine: tex(512, 1.4, (g, s) => {
      g.fillStyle = '#ddd0b8'; g.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 2 + rnd() * 5) { g.fillStyle = `rgba(${rnd() < 0.5 ? '148,126,95' : '248,238,220'},${0.10 + rnd() * 0.12})`; g.fillRect(0, y, s, 1 + rnd() * 2.5); }
      for (let i = 0; i < 360; i++) { g.fillStyle = 'rgba(110,90,65,0.42)'; g.fillRect(rnd() * s, rnd() * s, 2 + rnd() * 14, 1 + rnd() * 1.6); }
      grain(g, s, 7);
    }),
    boucle: noise('#ebe5d8', 17, 0.42, 256, 6200),
    linen: noise('#f4f0e8', 9, 0.48, 256, 2600),
    duvet: noise('#ece6dc', 9, 0.48, 256, 2600),
    rug: tex(512, 1.6, (g, s) => {
      // hand-loomed warm oatmeal berber wool rug with ribbed bouclé loops and woven border bands
      g.fillStyle = '#cfc3ae'; g.fillRect(0, 0, s, s);
      blotches(g, s, 60, 'rgba(105,90,70,0.06)', 14, 52);
      blotches(g, s, 60, 'rgba(255,248,236,0.06)', 14, 52);
      for (let y = 0; y < s; y += 4) {
        g.fillStyle = y % 8 === 0 ? 'rgba(255,250,240,0.22)' : 'rgba(78,66,50,0.18)';
        g.fillRect(0, y, s, 2.0);
        for (let x = (y % 8 === 0 ? 0 : 3); x < s; x += 6) {
          g.fillStyle = rnd() < 0.5 ? 'rgba(250,244,232,0.18)' : 'rgba(82,70,54,0.16)';
          g.fillRect(x, y, 3.2, 2.0);
        }
      }
      g.strokeStyle = 'rgba(88,75,58,0.34)'; g.lineWidth = 6; g.strokeRect(14, 14, s - 28, s - 28);
      grain(g, s, 18);
    }),
    rugDark: tex(512, 1.6, (g, s) => {
      g.fillStyle = '#b2a48e'; g.fillRect(0, 0, s, s);
      blotches(g, s, 60, 'rgba(72,60,46,0.07)', 14, 52);
      for (let y = 0; y < s; y += 4) {
        g.fillStyle = y % 8 === 0 ? 'rgba(255,250,240,0.18)' : 'rgba(58,48,36,0.20)';
        g.fillRect(0, y, s, 2.0);
        for (let x = (y % 8 === 0 ? 0 : 3); x < s; x += 6) {
          g.fillStyle = rnd() < 0.5 ? 'rgba(245,238,225,0.16)' : 'rgba(55,45,34,0.18)';
          g.fillRect(x, y, 3.2, 2.0);
        }
      }
      g.strokeStyle = 'rgba(68,56,42,0.38)'; g.lineWidth = 6; g.strokeRect(14, 14, s - 28, s - 28);
      grain(g, s, 18);
    }),
    headboard: noise('#c2b5a1', 14, 0.44, 256, 4400),
    art1: tex(1024, 1, (g, s) => {
      // architectural relief painting in vermilion, warm ochre, charcoal, and linen
      g.fillStyle = '#f1e9da'; g.fillRect(0, 0, s, s);
      const field = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
      field(s * 0.05, s * 0.08, s * 0.52, s * 0.84, '#c84b24');
      field(s * 0.61, s * 0.08, s * 0.34, s * 0.40, '#dba456');
      field(s * 0.61, s * 0.52, s * 0.34, s * 0.40, '#27312d');
      // subtle architectural datum lines across the canvas
      g.strokeStyle = 'rgba(241,233,218,0.45)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(s * 0.05, s * 0.52); g.lineTo(s * 0.57, s * 0.52); g.stroke();
      blotches(g, s, 60, 'rgba(255,245,230,0.05)', 20, 80);
      grain(g, s, 16);
    }),
    art2: tex(512, 1, (g, s) => {
      g.fillStyle = '#f3ede3'; g.fillRect(0, 0, s, s); g.strokeStyle = 'rgba(28,26,23,0.85)'; g.lineWidth = 3.5;
      g.beginPath(); g.arc(s * 0.5, s * 0.42, s * 0.22, 0, 7); g.stroke(); g.fillStyle = '#c84b24'; g.fillRect(s * 0.28, s * 0.7, s * 0.44, s * 0.045);
      grain(g, s, 10);
    }),
    art3: (() => {
      // horizontal rectangular abstract architectural painting for the study partition wall
      const w = 1024, h = 544, c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.fillStyle = '#f0e8d9'; g.fillRect(0, 0, w, h);
      // warm linen border mat (subtle gallery margin inside the frame)
      const pad = 34;
      g.fillStyle = '#e7decb'; g.fillRect(pad, pad, w - pad * 2, h - pad * 2);
      // balanced modernist geometric color fields (terracotta, charcoal, warm ochre, sage, and parchment)
      g.fillStyle = '#c2512b'; g.fillRect(pad + 18, pad + 18, 410, h - pad * 2 - 36);
      g.fillStyle = '#d9a452'; g.fillRect(pad + 444, pad + 18, 280, 210);
      g.fillStyle = '#23221f'; g.fillRect(pad + 740, pad + 18, w - pad * 2 - 758, 300);
      g.fillStyle = '#6c7858'; g.fillRect(pad + 444, pad + 244, 280, h - pad * 2 - 262);
      g.fillStyle = '#f5efe3'; g.fillRect(pad + 740, pad + 334, w - pad * 2 - 758, h - pad * 2 - 352);
      // overlapping architectural relief planes and datum lines
      g.fillStyle = '#23221f'; g.fillRect(pad + 310, pad + 145, 195, 240);
      g.fillStyle = '#f4ede0'; g.beginPath(); g.arc(pad + 408, pad + 265, 58, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(244,237,224,0.65)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(pad + 18, pad + 265); g.lineTo(pad + 310, pad + 265); g.stroke();
      g.strokeStyle = 'rgba(35,34,31,0.75)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(pad + 505, pad + 265); g.lineTo(w - pad - 18, pad + 265); g.stroke();
      blotches(g, w, 55, 'rgba(255,248,235,0.05)', 22, 85);
      grain(g, w, 14);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t;
    })(),
    art4: (() => {
      // wide horizontal abstract triptych-relief painting centered above the bedroom headboard
      const w = 1024, h = 460, c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.fillStyle = '#f2ebde'; g.fillRect(0, 0, w, h);
      const pad = 28;
      g.fillStyle = '#e6dccb'; g.fillRect(pad, pad, w - pad * 2, h - pad * 2);
      // serene warm architectural color blocks (warm sand, terracotta, deep charcoal, sage olive, and cream)
      g.fillStyle = '#d8a452'; g.fillRect(pad + 16, pad + 16, 290, h - pad * 2 - 32);
      g.fillStyle = '#f5efe3'; g.fillRect(pad + 322, pad + 16, 340, 195);
      g.fillStyle = '#737f60'; g.fillRect(pad + 322, pad + 225, 340, h - pad * 2 - 241);
      g.fillStyle = '#c1522c'; g.fillRect(pad + 678, pad + 16, w - pad * 2 - 694, 245);
      g.fillStyle = '#24221f'; g.fillRect(pad + 678, pad + 275, w - pad * 2 - 694, h - pad * 2 - 291);
      // sculptural charcoal arch and fine datum lines bridging the composition
      g.fillStyle = '#24221f';
      g.beginPath(); g.arc(pad + 314, pad + 218, 92, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f5efe3';
      g.beginPath(); g.arc(pad + 342, pad + 218, 48, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(36,34,31,0.72)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(pad + 16, pad + 218); g.lineTo(pad + 222, pad + 218); g.stroke();
      g.strokeStyle = 'rgba(245,239,227,0.70)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(pad + 678, pad + 145); g.lineTo(w - pad - 16, pad + 145); g.stroke();
      blotches(g, w, 55, 'rgba(255,248,235,0.05)', 20, 80);
      grain(g, w, 14);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t;
    })(),
  };
  for (const k of ['art1', 'art2', 'art3', 'art4', 'artSection']) { T[k].wrapS = T[k].wrapT = THREE.ClampToEdgeWrapping; }

  const skyCanvas = document.createElement('canvas'); skyCanvas.width = 4; skyCanvas.height = 512;
  { const g = skyCanvas.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 512); for (const [t, col] of [[0, '#7ea0bd'], [0.40, '#c8ceca'], [0.5, '#f6e3c6'], [0.54, '#c2b5a0'], [1, '#948774']]) gr.addColorStop(t, col); g.fillStyle = gr; g.fillRect(0, 0, 4, 512); }
  const envScene = new THREE.Scene();
  const domeTex = new THREE.CanvasTexture(skyCanvas); domeTex.colorSpace = THREE.SRGBColorSpace;
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ map: domeTex, side: THREE.BackSide })));
  // bright architectural light cards in the PMREM environment so grazing specular reflections pop on wood, stone, leather, and plaster
  const addEnvCard = (w, h, pos, look, col) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...look); envScene.add(m);
  };
  addEnvCard(28, 18, [36, 18, 12], [0, 0, 0], 0xffffff);
  addEnvCard(24, 14, [-24, 20, 26], [0, 0, 0], 0xfff3de);
  addEnvCard(30, 10, [0, 32, -16], [0, 0, 0], 0xf7efe2);
  const env = new THREE.PMREMGenerator(renderer).fromScene(envScene, 0.02).texture;
  const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.82, metalness: 0, envMap: env, envMapIntensity: 0.62 }, o));
  const M = {
    conc: std({ map: T.conc, bumpMap: concBump, bumpScale: 0.028, roughness: 0.68, envMapIntensity: 0.68 }),
    plaster: std({ map: T.plaster, bumpMap: plasterBump, bumpScale: 0.012, color: 0xf7f4ee, roughness: 0.74, envMapIntensity: 0.78 }),
    ceiling: std({ map: T.plaster, bumpMap: plasterBump, bumpScale: 0.008, color: 0xfaf7f2, roughness: 0.82, envMapIntensity: 0.85, emissive: 0xf3eadc, emissiveIntensity: 0.34 }),
    walnutDoors: std({ map: T.walnutDoors, bumpMap: T.walnutBump, bumpScale: 0.022, roughness: 0.28, envMapIntensity: 0.88 }),
    curtain: std({ map: T.curtain, bumpMap: fabricBump, bumpScale: 0.018, roughness: 0.84, envMapIntensity: 0.52, side: THREE.DoubleSide }),
    fire: std({ color: 0xff9436, emissive: 0xff5a12, emissiveIntensity: 2.2 }),
    brass: std({ color: 0xcfa862, metalness: 0.92, roughness: 0.2, envMapIntensity: 1.25 }),
    ceramicDark: std({ color: 0x2e2b28, roughness: 0.22, envMapIntensity: 0.85 }),
    artSection: std({ map: T.artSection, roughness: 0.75 }),
    floorL: std({ map: T.oak, bumpMap: T.oakBump, bumpScale: 0.036, roughness: 0.32, color: 0xead8c0, envMapIntensity: 0.88 }),
    oak: std({ map: T.oak, bumpMap: T.oakBump, bumpScale: 0.032, roughness: 0.30, envMapIntensity: 0.90 }),
    oakFurn: std({ map: T.oakV, bumpMap: T.oakFurnBump, bumpScale: 0.020, roughness: 0.32, envMapIntensity: 0.82 }),
    walnut: std({ map: T.walnutV, bumpMap: T.walnutBump, bumpScale: 0.022, roughness: 0.28, envMapIntensity: 0.88 }),
    teak: std({ map: T.teak, bumpMap: T.oakFurnBump, bumpScale: 0.020, roughness: 0.54, envMapIntensity: 0.65 }),
    stoneFloor: std({ map: T.stoneFloor, bumpMap: stoneBump, bumpScale: 0.024, roughness: 0.48, envMapIntensity: 0.62 }),
    gravel: std({ color: 0x8f8a82, bumpMap: stoneBump, bumpScale: 0.025, roughness: 0.92 }),
    pave: std({ map: T.pave, bumpMap: stoneBump, bumpScale: 0.022, roughness: 0.66, envMapIntensity: 0.55 }),
    grass: std({ map: T.grass, bumpMap: fabricBump, bumpScale: 0.024, roughness: 0.86, envMapIntensity: 0.32 }),
    earthCut: std({ map: T.earth, bumpMap: stoneBump, bumpScale: 0.028, color: 0xbec3c7, roughness: 0.76, envMapIntensity: 0.45 }),
    steel: std({ color: 0x222220, metalness: 0.74, roughness: 0.30, envMapIntensity: 0.92 }),
    blackSteel: std({ color: 0x181817, metalness: 0.68, roughness: 0.32, envMapIntensity: 0.88 }),
    glass: new THREE.MeshBasicMaterial({ color: 0xd4e5e4, transparent: true, opacity: 0.17, envMap: env, reflectivity: 0.52, combine: THREE.MixOperation, depthWrite: false }),
    marble: std({ map: T.marble, bumpMap: stoneBump, bumpScale: 0.009, roughness: 0.16, envMapIntensity: 1.05 }),
    travertine: std({ map: T.travertine, bumpMap: stoneBump, bumpScale: 0.024, roughness: 0.38, envMapIntensity: 0.80 }),
    boucle: std({ map: T.boucle, bumpMap: fabricBump, bumpScale: 0.028, roughness: 0.88, envMapIntensity: 0.45 }),
    linen: std({ map: T.linen, bumpMap: fabricBump, bumpScale: 0.018, roughness: 0.86, envMapIntensity: 0.45 }),
    duvet: std({ map: T.duvet, bumpMap: fabricBump, bumpScale: 0.018, roughness: 0.86, envMapIntensity: 0.45 }),
    linenOut: std({ map: T.linen, bumpMap: fabricBump, bumpScale: 0.018, roughness: 0.88, color: 0xeae4d8 }),
    rug: std({ map: T.rug, bumpMap: rugBump, bumpScale: 0.048, roughness: 0.92 }),
    rugDark: std({ map: T.rugDark, bumpMap: rugBump, bumpScale: 0.048, roughness: 0.92 }),
    headboard: std({ map: T.headboard, bumpMap: fabricBump, bumpScale: 0.026, roughness: 0.88 }),
    leather: std({ color: 0x764528, bumpMap: stoneBump, bumpScale: 0.012, roughness: 0.34, envMapIntensity: 0.85 }),
    cognac: std({ color: 0x91532b, bumpMap: stoneBump, bumpScale: 0.012, roughness: 0.32, envMapIntensity: 0.88 }),
    cushionRust: std({ map: T.boucle, bumpMap: fabricBump, bumpScale: 0.024, color: 0xc65a32, roughness: 0.88 }),
    cushionSage: std({ map: T.boucle, bumpMap: fabricBump, bumpScale: 0.024, color: 0x8f9a7c, roughness: 0.88 }),
    throwOchre: std({ map: T.linen, bumpMap: fabricBump, bumpScale: 0.020, color: 0xcca446, roughness: 0.86 }),
    ceramic: std({ color: 0xded6c8, roughness: 0.2, envMapIntensity: 0.88 }),
    white: std({ color: 0xf6f4f0, roughness: 0.16, envMapIntensity: 0.88 }),
    mirror: std({ color: 0xffffff, metalness: 1, roughness: 0.02, envMapIntensity: 1.1 }),
    terracotta: std({ color: 0xa86446, bumpMap: stoneBump, bumpScale: 0.016, roughness: 0.74, envMapIntensity: 0.48 }),
    shade: std({ color: 0xfff3dc, emissive: 0xffcf8a, emissiveIntensity: 1.7, side: THREE.DoubleSide }),
    opal: std({ color: 0xfff8ec, emissive: 0xffd9a0, emissiveIntensity: 2.3 }),
    leaf: std({ color: 0x5f6e3c, roughness: 0.66, envMapIntensity: 0.48, flatShading: true }),
    leafDark: std({ color: 0x3f4d2a, roughness: 0.70, envMapIntensity: 0.44, flatShading: true }),
    olive: std({ color: 0x8b9670, roughness: 0.68, envMapIntensity: 0.48, flatShading: true }),
    bark: std({ color: 0x5d5246, bumpMap: fabricBump, bumpScale: 0.014, roughness: 0.82, envMapIntensity: 0.35 }),
    figure: std({ color: 0xd5c5ae, roughness: 0.38, metalness: 0.06, envMapIntensity: 0.85 }),
    poche: new THREE.MeshBasicMaterial({ color: 0x161513 }),
    art1: std({ map: T.art1, bumpMap: fabricBump, bumpScale: 0.014, roughness: 0.68, envMapIntensity: 0.6 }),
    art2: std({ map: T.art2, bumpMap: fabricBump, bumpScale: 0.010, roughness: 0.72, envMapIntensity: 0.55 }),
    art3: std({ map: T.art3, bumpMap: fabricBump, bumpScale: 0.012, roughness: 0.68, envMapIntensity: 0.62 }),
    art4: std({ map: T.art4, bumpMap: fabricBump, bumpScale: 0.012, roughness: 0.68, envMapIntensity: 0.62 }),
    book0: std({ color: 0x8e3b2a, roughness: 0.55 }), book1: std({ color: 0x2f4a5a, roughness: 0.55 }), book2: std({ color: 0xd8cfb8, roughness: 0.6 }), book3: std({ color: 0x5c6b4a, roughness: 0.55 }), book4: std({ color: 0x1f1e1c, roughness: 0.5 }),
  };
  const c = document.createElement('canvas'); c.width = 4; c.height = 512; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512);
  for (const [t, col] of [[0, '#7ea0bd'], [0.42, '#c8ceca'], [0.56, '#eedbc0'], [1, '#f0dcbc']]) gr.addColorStop(t, col);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 512);
  const sky = new THREE.CanvasTexture(c); sky.colorSpace = THREE.SRGBColorSpace;
  return { M, T, env, sky };
}
