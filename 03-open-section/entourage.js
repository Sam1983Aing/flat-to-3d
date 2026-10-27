// Entourage: people, trees and plants drawn as clean line figures on canvas.
//
// One trick does the outline: every shape is first drawn in ink a little fatter than it is,
// then again in white at its true size. What is left of the ink is the outline of the union,
// so limbs join the body without a seam. Limbs on the far side of the body are drawn first,
// on their own, so a step forward still shows where one leg crosses the other.

const INK = '#1c1b19', FILL = '#fbfaf6';

// Poses in metres for a 1.75 m person, feet at y = 0. cap: [x0, y0, x1, y1, width], poly: [[x, y], ...]
const POSES = {
  stand: {
    back: [],
    front: [
      { poly: [[-0.2, 1.45], [0.2, 1.45], [0.17, 1.1], [0.15, 0.92], [-0.15, 0.92], [-0.17, 1.1]] },
      { cap: [0, 1.5, 0, 1.42, 0.09] }, { head: [0, 1.63, 0.105] },
      { cap: [-0.08, 0.95, -0.09, 0.5, 0.15] }, { cap: [-0.09, 0.5, -0.1, 0.07, 0.11] }, { cap: [-0.1, 0.04, -0.17, 0.03, 0.08] },
      { cap: [0.08, 0.95, 0.09, 0.5, 0.15] }, { cap: [0.09, 0.5, 0.1, 0.07, 0.11] }, { cap: [0.1, 0.04, 0.17, 0.03, 0.08] },
      { cap: [-0.19, 1.4, -0.24, 1.12, 0.095] }, { cap: [-0.24, 1.12, -0.25, 0.84, 0.075] },
      { cap: [0.19, 1.4, 0.24, 1.12, 0.095] }, { cap: [0.24, 1.12, 0.25, 0.84, 0.075] },
    ],
  },
  standDress: {
    back: [],
    front: [
      { poly: [[-0.13, 1.68], [0.13, 1.68], [0.14, 1.4], [-0.14, 1.4]] },
      { poly: [[-0.18, 1.43], [0.18, 1.43], [0.15, 1.05], [0.25, 0.42], [-0.25, 0.42], [-0.15, 1.05]] },
      { cap: [0, 1.5, 0, 1.42, 0.085] }, { head: [0, 1.62, 0.1] },
      { cap: [-0.07, 0.45, -0.07, 0.07, 0.09] }, { cap: [-0.07, 0.04, -0.13, 0.03, 0.07] },
      { cap: [0.07, 0.45, 0.07, 0.07, 0.09] }, { cap: [0.07, 0.04, 0.13, 0.03, 0.07] },
      { cap: [-0.17, 1.38, -0.21, 1.12, 0.08] }, { cap: [-0.21, 1.12, -0.18, 0.86, 0.065] },
      { cap: [0.17, 1.38, 0.21, 1.12, 0.08] }, { cap: [0.21, 1.12, 0.18, 0.86, 0.065] },
    ],
  },
  walk: {
    back: [
      { cap: [0, 0.95, -0.08, 0.52, 0.15] }, { cap: [-0.08, 0.52, -0.22, 0.1, 0.11] }, { cap: [-0.25, 0.08, -0.1, 0.03, 0.075] },
      { cap: [-0.01, 1.4, -0.09, 1.14, 0.09] }, { cap: [-0.09, 1.14, -0.16, 0.9, 0.07] },
    ],
    front: [
      { poly: [[-0.1, 1.46], [0.11, 1.46], [0.1, 1.15], [0.09, 0.92], [-0.1, 0.92], [-0.12, 1.2]] },
      { cap: [0.01, 1.5, 0, 1.42, 0.1] }, { head: [0.03, 1.63, 0.105] },
      { cap: [0.02, 0.95, 0.15, 0.53, 0.15] }, { cap: [0.15, 0.53, 0.22, 0.08, 0.11] }, { cap: [0.19, 0.04, 0.34, 0.04, 0.075] },
      { cap: [0.01, 1.4, 0.1, 1.14, 0.09] }, { cap: [0.1, 1.14, 0.2, 0.92, 0.07] },
    ],
  },
  sit: {
    back: [
      { cap: [0, 0.5, 0.4, 0.52, 0.15] }, { cap: [0.4, 0.5, 0.37, 0.07, 0.11] }, { cap: [0.36, 0.04, 0.5, 0.04, 0.075] },
    ],
    front: [
      { poly: [[-0.11, 1.1], [0.1, 1.1], [0.1, 0.75], [0.12, 0.5], [-0.12, 0.47], [-0.13, 0.8]] },
      { cap: [0.01, 1.15, 0, 1.06, 0.1] }, { head: [0.03, 1.27, 0.105] },
      { cap: [0, 0.5, 0.43, 0.49, 0.16] }, { cap: [0.43, 0.48, 0.45, 0.07, 0.11] }, { cap: [0.43, 0.04, 0.58, 0.04, 0.075] },
      { cap: [0, 1.04, 0.05, 0.76, 0.09] }, { cap: [0.05, 0.76, 0.3, 0.62, 0.07] },
    ],
  },
};
// walking down a stair to the right: the back foot on this tread, the front foot one riser lower
POSES.stair = {
  back: [
    { cap: [0, 0.95, -0.02, 0.52, 0.15] }, { cap: [-0.02, 0.52, -0.06, 0.08, 0.11] }, { cap: [-0.13, 0.04, 0.02, 0.03, 0.075] },
    { cap: [-0.01, 1.4, -0.08, 1.14, 0.09] }, { cap: [-0.08, 1.14, -0.13, 0.9, 0.07] },
  ],
  front: [
    { poly: [[-0.1, 1.46], [0.11, 1.46], [0.1, 1.15], [0.09, 0.92], [-0.1, 0.92], [-0.12, 1.2]] },
    { cap: [0.01, 1.5, 0.01, 1.42, 0.1] }, { head: [0.04, 1.63, 0.105] },
    { cap: [0.03, 0.95, 0.2, 0.5, 0.15] }, { cap: [0.2, 0.5, 0.26, -0.13, 0.11] }, { cap: [0.22, -0.17, 0.37, -0.17, 0.075] },
    { cap: [0.01, 1.4, 0.09, 1.15, 0.09] }, { cap: [0.09, 1.15, 0.17, 0.95, 0.07] },
  ],
};
POSES.standBack = POSES.stand;
POSES.child = {
  back: [],
  front: POSES.stand.front.map(s => (s.head ? { head: [0, 1.6, 0.14] } : s)),
};

const X0 = -0.6, X1 = 0.75, Y0 = -0.25, Y1 = 1.85;     // the frame every figure is drawn in, in metres at 1.75 m

// Draws a sprite and says how big it is in the world.
// o is the outline in canvas pixels, chosen by the caller so it lands near one screen pixel.
export function drawSprite(type, h, outlinePx) {
  if (POSES[type]) return person(type, h, outlinePx);
  if (type === 'cypress') return cypress(h, outlinePx);
  if (type === 'plant') return plant(h, outlinePx);
  return tree(h, outlinePx);
}

function person(type, h, o) {
  const s = h / 1.75, ppm = 300;
  const c = document.createElement('canvas');
  c.width = Math.round((X1 - X0) * ppm); c.height = Math.round((Y1 - Y0) * ppm);
  const g = c.getContext('2d');
  g.setTransform(ppm, 0, 0, -ppm, -X0 * ppm, Y1 * ppm);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const pose = POSES[type], d = o / ppm;
  const pass = (shapes, colour, grow) => {
    g.fillStyle = g.strokeStyle = colour;
    for (const sh of shapes) {
      if (sh.cap) { const [a, b, cc, dd, w] = sh.cap; g.lineWidth = w + 2 * grow; g.beginPath(); g.moveTo(a, b); g.lineTo(cc, dd); g.stroke(); }
      if (sh.head) { const [x, y, r] = sh.head; g.beginPath(); g.arc(x, y, r + grow, 0, Math.PI * 2); g.fill(); }
      if (sh.poly) {
        g.beginPath(); sh.poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
        if (grow) { g.lineWidth = 2 * grow; g.stroke(); }
      }
    }
  };
  for (const group of [pose.back, pose.front]) { pass(group, INK, d); pass(group, FILL, 0); }
  return { canvas: c, w: (X1 - X0) * s, h: (Y1 - Y0) * s, ox: (X0 + X1) / 2 * s, oy: (Y0 + Y1) / 2 * s };
}

function frame(wm, hm, maxPx = 1100) {
  const ppm = Math.min(maxPx / hm, maxPx / wm);
  const c = document.createElement('canvas');
  c.width = Math.round(wm * ppm); c.height = Math.round(hm * ppm);
  const g = c.getContext('2d');
  g.setTransform(ppm, 0, 0, -ppm, wm / 2 * ppm, hm * ppm);
  g.lineCap = 'round'; g.lineJoin = 'round';
  return { c, g, ppm };
}

function tree(h, o) {
  const wm = h * 0.86, { c, g, ppm } = frame(wm, h), d = o / ppm;
  let seed = Math.round(h * 97);
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const cy = h * 0.66, R = h * 0.31, blobs = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + rnd() * 0.3, rr = R * (0.55 + rnd() * 0.18);
    blobs.push([Math.cos(a) * rr * 0.95, cy + Math.sin(a) * rr * 0.72, R * (0.36 + rnd() * 0.14)]);
  }
  blobs.push([0, cy, R * 0.6]);
  const trunk = [[0, 0, 0, h * 0.5, h * 0.05], [0, h * 0.4, -h * 0.13, h * 0.6, h * 0.028], [0, h * 0.46, h * 0.12, h * 0.64, h * 0.026]];
  const lit = g.createLinearGradient(-R * 1.2, 0, R * 1.2, 0);
  lit.addColorStop(0, '#ffffff'); lit.addColorStop(1, '#dcdcdc');          // the crown is lit from the left, where the sun is
  const draw = (colour, grow) => {
    g.fillStyle = g.strokeStyle = colour === FILL ? lit : colour;
    for (const [a, b, cc, dd, w] of trunk) { g.lineWidth = w + 2 * grow; g.beginPath(); g.moveTo(a, b); g.lineTo(cc, dd); g.stroke(); }
    for (const [x, y, r] of blobs) { g.beginPath(); g.arc(x, y, r + grow, 0, Math.PI * 2); g.fill(); }
  };
  draw(INK, d); draw(FILL, 0);
  // a few branches seen through the crown, lighter than the outline
  g.strokeStyle = 'rgba(28,27,25,0.42)'; g.lineWidth = d * 0.9;
  for (const [a, b, cc, dd] of [[0, h * 0.48, -h * 0.16, h * 0.74], [0, h * 0.52, h * 0.15, h * 0.76], [0, h * 0.5, 0.01 * h, h * 0.84], [-h * 0.07, h * 0.6, -h * 0.22, h * 0.66], [h * 0.06, h * 0.6, h * 0.21, h * 0.62]]) {
    g.beginPath(); g.moveTo(a, b); g.quadraticCurveTo((a + cc) / 2 + h * 0.02, (b + dd) / 2, cc, dd); g.stroke();
  }
  return { canvas: c, w: wm, h, ox: 0, oy: h / 2 };
}

function cypress(h, o) {
  const wm = h * 0.3, { c, g, ppm } = frame(wm, h), d = o / ppm;
  const path = () => {
    g.beginPath();
    g.moveTo(0, h);
    g.bezierCurveTo(-h * 0.06, h * 0.8, -h * 0.13, h * 0.42, -h * 0.1, h * 0.12);
    g.quadraticCurveTo(-h * 0.07, h * 0.05, 0, h * 0.05);
    g.quadraticCurveTo(h * 0.07, h * 0.05, h * 0.1, h * 0.12);
    g.bezierCurveTo(h * 0.13, h * 0.42, h * 0.06, h * 0.8, 0, h);
    g.closePath();
  };
  g.fillStyle = g.strokeStyle = INK;
  g.lineWidth = h * 0.024 + 2 * d; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, h * 0.1); g.stroke();
  path(); g.fill(); g.lineWidth = 2 * d; g.stroke();
  const lit = g.createLinearGradient(-h * 0.12, 0, h * 0.12, 0);
  lit.addColorStop(0, '#ffffff'); lit.addColorStop(1, '#d9d9d9');
  g.fillStyle = g.strokeStyle = lit;
  g.lineWidth = h * 0.024; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, h * 0.1); g.stroke();
  path(); g.fill();
  g.strokeStyle = 'rgba(28,27,25,0.35)'; g.lineWidth = d * 0.9;
  for (const k of [-0.05, -0.02, 0.025, 0.055]) {
    g.beginPath(); g.moveTo(k * h, h * 0.16); g.quadraticCurveTo(k * h * 1.3, h * 0.5, k * h * 0.4, h * 0.86); g.stroke();
  }
  return { canvas: c, w: wm, h, ox: 0, oy: h / 2 };
}

function plant(h, o) {
  const wm = h * 0.9, { c, g, ppm } = frame(wm, h, 600), d = o / ppm;
  const pot = [[-h * 0.14, 0], [h * 0.14, 0], [h * 0.18, h * 0.3], [-h * 0.18, h * 0.3]];
  const leaves = [];
  for (let i = 0; i < 9; i++) {
    const a = -1.15 + i * 0.29, L = h * (0.42 + 0.22 * Math.cos(i * 1.7) ** 2);
    leaves.push([Math.sin(a) * L * 0.75, h * 0.3 + Math.cos(a) * L, a]);
  }
  const draw = (colour, grow) => {
    g.fillStyle = g.strokeStyle = colour;
    for (const [x, y, a] of leaves) {
      g.save(); g.translate(x / 2, h * 0.3 + (y - h * 0.3) / 2); g.rotate(-a);
      g.beginPath(); g.ellipse(0, 0, h * 0.045 + grow, (y - h * 0.3) / 2 + grow, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
    g.beginPath(); pot.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
    if (grow) { g.lineWidth = 2 * grow; g.stroke(); }
  };
  draw(INK, d); draw(FILL, 0);
  return { canvas: c, w: wm, h, ox: 0, oy: h / 2 };
}
