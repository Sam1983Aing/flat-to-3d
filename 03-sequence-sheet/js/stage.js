// What arrives on site besides the house: the engineered scaffold stair to the terrace, stacks of material,
// and in the final weeks the bespoke furniture, lighting and planting that stage the living room for handover.
// Everything is stamped with the weeks it is there, like the house.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { V, stamp, merge, addMesh, worldUV, canopy, DM, rnd, natural, BACKFILL } from './world.js';

const rb = (w, h, d, r, x = 0, y = 0, z = 0, seg = 4) => {
  const g = new RoundedBoxGeometry(w, h, d, seg, Math.max(0.002, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)));
  g.translate(x, y, z);
  return g;
};
const bx = (w, h, d, x = 0, y = 0, z = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
const cyl = (r0, r1, h, x = 0, y = 0, z = 0, seg = 20) => { const g = new THREE.CylinderGeometry(r0, r1, h, seg); g.translate(x, y + h / 2, z); return g; };
const lathe = (pts, x, y, z, seg = 28) => { const g = new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg); g.translate(x, y, z); return g; };
const tube = (a, b, r, seg = 10) => {
  const d = b.clone().sub(a), len = d.length();
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
};

export function buildStage(R) {
  const group = new THREE.Group();
  const drawn = {}, real = {};
  // `piece` places geometries in world space, applies world-metre UVs so textures & bump maps show crisp grain,
  // and routes clean architectural forms to `drawn` (for Tile 06) and fine accessories to `real` (so Tile 06 stays uncluttered).
  const piece = (bucket, list, x, y, z, ry, week, out = 0) => {
    const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
    for (const [mat, g, realOnlyItem] of list) {
      g.applyMatrix4(m);
      if (mat !== 'art') worldUV(g);
      stamp(g, week, out);
      const target = realOnlyItem ? real : bucket;
      (target[mat] || (target[mat] = [])).push(g);
    }
  };
  const lights = [];

  // Reusable sculpted walnut & saddle-leather lounge chair builder (ordered bottom-up: frame -> arms -> seat -> back -> bolster)
  const loungeChair = () => {
    const L = [];
    for (const sx of [-0.41, 0.41]) {
      L.push(['walnut', tube(V(sx, 0.0, 0.34), V(sx, 0.55, 0.24), 0.024, 10)]);
      L.push(['walnut', tube(V(sx, 0.0, -0.36), V(sx, 0.55, -0.22), 0.024, 10)]);
      L.push(['walnut', tube(V(sx, 0.24, -0.29), V(sx, 0.24, 0.29), 0.018, 8), true]);
    }
    L.push(['walnut', tube(V(-0.41, 0.26, 0.18), V(0.41, 0.26, 0.18), 0.018, 8), true]);
    L.push(['walnut', tube(V(-0.41, 0.32, -0.24), V(0.41, 0.32, -0.24), 0.018, 8), true]);
    for (const sx of [-0.41, 0.41]) {
      const arm = rb(0.065, 0.038, 0.78, 0.016, 0, 0, 0);
      arm.rotateX(0.04); arm.translate(sx, 0.56, 0.0); L.push(['walnut', arm]);
    }
    const seat = rb(0.76, 0.13, 0.74, 0.055, 0, 0, 0);
    seat.rotateX(0.08); seat.translate(0, 0.36, 0.02); L.push(['leather', seat]);
    const back = rb(0.74, 0.56, 0.13, 0.055, 0, 0, 0);
    back.rotateX(-0.26); back.translate(0, 0.66, -0.31); L.push(['leather', back]);
    const bolster = new THREE.CylinderGeometry(0.065, 0.065, 0.62, 16);
    bolster.rotateZ(Math.PI / 2); bolster.translate(0, 0.84, -0.32); L.push(['leather', bolster, true]);
    return L;
  };

  // ================================================================ SECOND FLOOR (MEZZANINE, y = 3.20): STUDIO & LOUNGE (Weeks 30.85 to 33.4)
  {
    // M1. Woven wool studio rug under the architect's desk (Wk 30.85)
    piece(real, [
      ['rugM', rb(2.8, 0.018, 2.2, 0.006, 0, 0.012, 0, 2), true],
    ], 6.75, 3.203, -3.65, 0, 30.85);

    // M2. Sculpted Cantilevered Walnut & Travertine Architect's Studio Desk (Wk 31.10)
    piece(drawn, [
      ['travertine', cyl(0.24, 0.26, 0.72, -0.18, 0, -0.68, 28)], // fluted travertine drum pedestal
      ['steel', bx(0.76, 0.71, 0.045, 0.0, 0.355, 0.74)],        // matte steel blade leg
      ['steel', bx(0.62, 0.04, 1.38, 0.0, 0.69, 0.04), true],     // under-desk spine
      ['walnut', rb(1.10, 0.052, 2.24, 0.02, 0, 0.74, 0)],        // cantilevered walnut desktop
    ], 6.85, 3.20, -3.65, 0, 31.10);

    // M3. Sculpted Saddle-Leather Studio Chair + Architectural Scale Model & Brass Task Lamp (Wk 31.40)
    piece(drawn, loungeChair(), 5.85, 3.20, -3.65, Math.PI / 2, 31.38);
    piece(real, [
      // Architectural scale model of the hillside house on a timber plinth
      ['timber', rb(0.48, 0.032, 0.38, 0.006, 0.08, 0.782, 0.28), true],
      ['ceramic', bx(0.28, 0.09, 0.22, 0.10, 0.84, 0.28), true],
      ['ceramic', bx(0.14, 0.04, 0.22, 0.06, 0.90, 0.28), true],
      // Stacked monographs & sketchpad
      ['book2', rb(0.34, 0.028, 0.25, 0.005, -0.12, 0.78, -0.22), true],
      ['book0', rb(0.28, 0.026, 0.21, 0.005, -0.10, 0.808, -0.22), true],
      // Brushed brass studio task lamp
      ['brass', cyl(0.09, 0.10, 0.025, 0.18, 0.766, -0.68, 20), true],
      ['brass', tube(V(0.18, 0.78, -0.68), V(0.08, 1.22, -0.58), 0.010, 8), true],
      ['shade', lathe([[0.13, 0], [0.08, 0.16], [0.075, 0.16], [0.125, 0]], 0.08, 1.12, -0.58), true],
    ], 6.85, 3.20, -3.65, 0, 31.56);
    lights.push({ p: V(6.93, 4.30, -4.23), k: 0.75 });

    // M4. Large Woven Wool Mezzanine Lounge Rug (Wk 31.80)
    piece(drawn, [
      ['rugM', rb(3.5, 0.020, 2.8, 0.008, 0, 0.012, 0, 2)],
    ], 7.45, 3.203, 0.85, 0, 31.80);

    // M5. Sculpted Bouclé Mezzanine Lounge Sofa / Daybed facing the library & studio (Wk 32.05)
    {
      const L = [
        ['steel', bx(2.26, 0.05, 0.84, 0, 0.025, 0), true],
        ['sofa', rb(2.44, 0.17, 0.98, 0.055, 0, 0.135, 0)],
        ['sofa', rb(0.24, 0.52, 0.98, 0.085, -1.12, 0.30, 0)],
        ['sofa', rb(0.24, 0.52, 0.98, 0.085, 1.12, 0.30, 0)],
        ['sofa', rb(2.24, 0.50, 0.22, 0.085, 0, 0.46, -0.38)],
        ['sofa', rb(1.00, 0.19, 0.84, 0.08, -0.51, 0.30, 0.05)],
        ['sofa', rb(1.00, 0.19, 0.84, 0.08, 0.51, 0.30, 0.05)],
      ];
      for (const x of [-0.51, 0.51]) {
        const b = rb(0.96, 0.42, 0.20, 0.085, 0, 0, 0);
        b.rotateX(-0.15); b.translate(x, 0.58, -0.23); L.push(['sofa', b, true]);
      }
      for (const [mat, x, z, rx, rz] of [
        ['cushionA', -0.78, -0.06, -0.24, 0.12],
        ['cushionC', -0.44, -0.04, -0.26, -0.06],
        ['cushionB', 0.74, -0.06, -0.22, -0.14],
      ]) {
        const c = rb(0.42, 0.38, 0.14, 0.06, 0, 0, 0);
        c.rotateX(rx); c.rotateZ(rz); c.translate(x, 0.54, z); L.push([mat, c, true]);
      }
      piece(drawn, L, 7.45, 3.20, 2.10, Math.PI, 32.05);
    }

    // M6. Fluted Travertine Mezzanine Coffee Table + Ceramics & Books (Wk 32.38)
    piece(drawn, [
      ['travertine', cyl(0.19, 0.19, 0.30, -0.30, 0, 0, 24)],
      ['travertine', cyl(0.15, 0.15, 0.30, 0.32, 0, 0.02, 24)],
      ['travertine', rb(1.24, 0.05, 0.72, 0.022, 0, 0.32, 0)],
      ['terracotta', lathe([[0, 0], [0.10, 0], [0.16, 0.05], [0.17, 0.08], [0, 0.02]], -0.22, 0.345, 0.04), true],
      ['ceramic', lathe([[0, 0], [0.07, 0], [0.10, 0.08], [0.06, 0.24], [0.07, 0.26], [0, 0.26]], 0.24, 0.345, -0.05), true],
      ['book1', rb(0.28, 0.035, 0.22, 0.005, 0.02, 0.362, 0.06), true],
    ], 7.45, 3.20, 0.78, 0, 32.38);

    // M7. Pair of Sculpted Walnut & Saddle-Leather Mezzanine Lounge Chairs (Wk 32.65 & 32.78)
    piece(drawn, loungeChair(), 5.75, 3.20, 0.55, Math.atan2(7.45 - 5.75, 0.78 - 0.55), 32.65);
    piece(drawn, loungeChair(), 9.12, 3.20, 0.55, Math.atan2(7.45 - 9.12, 0.78 - 0.55), 32.78);

    // M8. Mezzanine Floor Lamp & Potted Olive / Ficus Trees along the Glass Balustrade (Wk 32.98)
    piece(drawn, [
      ['travertine', cyl(0.18, 0.19, 0.06, 0, 0, 0, 24), true],
      ['brass', cyl(0.012, 0.012, 1.48, 0, 0.06, 0, 10), true],
      ['shade', lathe([[0.20, 0], [0.14, 0.24], [0.135, 0.24], [0.195, 0]], 0, 1.42, 0), true],
    ], 9.35, 3.20, 2.15, 0, 32.95);
    lights.push({ p: V(9.35, 4.72, 2.15), k: 0.85 });

    piece(drawn, [
      ['terracotta', lathe([[0, 0], [0.22, 0], [0.28, 0.44], [0.29, 0.48], [0, 0.44]], 0, 0, 0)],
      ['soilPot', cyl(0.25, 0.25, 0.02, 0, 0.44, 0, 20), true],
      ['bark', merge([tube(V(0, 0.44, 0), V(0.06, 1.35, 0.04), 0.042, 7), tube(V(0.06, 1.35, 0.04), V(0.32, 1.82, 0.16), 0.026, 6), tube(V(0.06, 1.35, 0.04), V(-0.24, 1.86, -0.12), 0.026, 6)]), true],
      ['olive', canopy([[0, 1.95, 0, 0.68, 0.44, 0.64, 180], [0.32, 2.15, 0.15, 0.44, 0.32, 0.42, 90]], 0.045, 0.085), true],
    ], 9.95, 3.20, -5.25, 0.3, 33.10);

    piece(drawn, [
      ['ceramic', lathe([[0, 0], [0.18, 0], [0.22, 0.38], [0, 0.38]], 0, 0, 0)],
      ['bark', tube(V(0, 0.36, 0), V(0.04, 1.18, 0.02), 0.022, 6), true],
      ['leaf', canopy([[0.04, 1.32, 0, 0.40, 0.48, 0.40, 65]], 0.08, 0.14), true],
    ], 9.95, 3.20, 2.85, 0, 33.18);

    // M9. Suspended Alabaster & Brass Globes over the Mezzanine (Wk 33.30)
    for (const z of [-3.65, -1.35, 0.85]) {
      piece(real, [
        ['ink', cyl(0.003, 0.003, 0.92, 0, 2.28, 0, 6), true],
        ['brass', cyl(0.026, 0.026, 0.06, 0, 2.24, 0, 12), true],
        ['shade', (() => { const g = new THREE.SphereGeometry(0.15, 24, 16); g.translate(0, 2.10, 0); return g; })(), true],
      ], 7.45, 3.20, z, 0, 33.30);
    }
  }

  // ================================================================ FIRST FLOOR (GROUND LEVEL, y = 0.00): KITCHEN, DINING & LIVING (Weeks 34.6 to 37.7)
  // Zone 1 & 2: Kitchen Island Barstools, Faucet, Dining Table, Chairs & Pendants (Weeks 34.6 to 35.85)
  {
    // Brushed brass gooseneck kitchen faucet & ceramic vessel on the waterfall island (Wk 34.64)
    piece(real, [
      ['brass', cyl(0.014, 0.016, 0.28, 0, 0.94, 0, 12), true],
      ['brass', rb(0.025, 0.025, 0.22, 0.01, 0, 1.21, 0.09), true],
      ['ceramic', lathe([[0, 0], [0.11, 0], [0.14, 0.08], [0, 0.08]], -0.85, 0.94, 0.05), true],
    ], 8.65, 0, -4.25, 0, 34.64);

    // Three sculpted walnut & leather barstools at the kitchen island (Wk 34.74 to 34.86)
    [6.9, 7.8, 8.7].forEach((x, idx) => {
      piece(real, [
        ['walnut', tube(V(-0.14, 0, -0.14), V(-0.10, 0.63, -0.10), 0.015, 8), true],
        ['walnut', tube(V(0.14, 0, -0.14), V(0.10, 0.63, -0.10), 0.015, 8), true],
        ['walnut', tube(V(-0.14, 0, 0.14), V(-0.10, 0.63, 0.10), 0.015, 8), true],
        ['walnut', tube(V(0.14, 0, 0.14), V(0.10, 0.63, 0.10), 0.015, 8), true],
        ['brass', cyl(0.13, 0.13, 0.012, 0, 0.24, 0, 20), true],
        ['walnut', cyl(0.185, 0.185, 0.025, 0, 0.625, 0, 24), true],
        ['leather', cyl(0.18, 0.19, 0.055, 0, 0.65, 0, 24), true],
      ], x, 0, -3.32, 0, 34.74 + idx * 0.06);
    });

    // Three brushed brass pendant cylinders over the kitchen island (Wk 34.96)
    for (const x of [6.9, 7.8, 8.7]) {
      piece(real, [
        ['ink', cyl(0.003, 0.003, 0.68, 0, 2.17, 0, 6), true],
        ['brass', cyl(0.035, 0.055, 0.22, 0, 1.96, 0, 16), true],
        ['shade', cyl(0.048, 0.048, 0.02, 0, 1.95, 0, 16), true],
      ], x, 0, -4.15, 0, 34.96);
    }
    lights.push({ p: V(7.8, 1.85, -4.15), k: 0.85 });

    // Woven dining area rug (Wk 35.10)
    piece(real, [['rugM', rb(3.4, 0.018, 2.2, 0.006, 0, 0.012, 0, 2), true]], 7.8, 0.002, -1.65, 0, 35.10);

    // Solid oak dining table with bevelled top and tapered cylindrical oak legs (Wk 35.28)
    const L = [
      ['oak', tube(V(-1.12, 0, -0.40), V(-1.04, 0.73, -0.36), 0.032, 12)],
      ['oak', tube(V(-1.12, 0, 0.40), V(-1.04, 0.73, 0.36), 0.032, 12)],
      ['oak', tube(V(1.12, 0, -0.40), V(1.04, 0.73, -0.36), 0.032, 12)],
      ['oak', tube(V(1.12, 0, 0.40), V(1.04, 0.73, 0.36), 0.032, 12)],
      ['oak', rb(2.65, 0.048, 1.04, 0.018, 0, 0.74, 0)],
      ['ceramic', lathe([[0, 0], [0.09, 0], [0.12, 0.14], [0.07, 0.30], [0.08, 0.32], [0, 0.32]], 0.2, 0.764, 0), true],
      ['terracotta', lathe([[0, 0], [0.12, 0], [0.16, 0.06], [0, 0.06]], -0.35, 0.764, 0.05), true],
    ];
    piece(drawn, L, 7.8, 0, -1.65, 0, 35.28);

    // Six Sculpted Danish oak & leather dining chairs (Wk 35.48 to 35.66)
    const dchair = () => {
      const L2 = [];
      for (const sx of [-0.20, 0.20]) {
        L2.push(['oak', tube(V(sx, 0, 0.20), V(sx, 0.44, 0.18), 0.017, 8), true]);
        L2.push(['oak', tube(V(sx, 0, -0.22), V(sx, 0.78, -0.21), 0.017, 8), true]);
      }
      L2.push(
        ['oak', rb(0.46, 0.035, 0.46, 0.015, 0, 0.44, 0)],
        ['oak', rb(0.46, 0.16, 0.032, 0.014, 0, 0.74, -0.21)],
        ['leather', rb(0.42, 0.038, 0.42, 0.015, 0, 0.475, 0.01), true],
      );
      return L2;
    };
    [7.0, 7.8, 8.6].forEach((x, idx) => {
      piece(drawn, dchair(), x, 0, -2.38, 0, 35.48 + idx * 0.05);
      piece(drawn, dchair(), x, 0, -0.92, Math.PI, 35.56 + idx * 0.05);
    });

    // Three warm glowing alabaster pendant globes over the dining table (Wk 35.80)
    for (const x of [7.0, 7.8, 8.6]) {
      piece(real, [
        ['shade', (() => { const g = new THREE.SphereGeometry(0.145, 24, 16); g.translate(0, 1.98, 0); return g; })(), true],
        ['brass', cyl(0.025, 0.025, 0.06, 0, 2.11, 0, 12), true],
        ['ink', cyl(0.003, 0.003, 0.70, 0, 2.15, 0, 6), true],
      ], x, 0, -1.65, 0, 35.80);
    }
    lights.push({ p: V(7.8, 1.82, -1.65), k: 1.05 });
  }

  // Zone 3: Double-Height Living Room, South Credenza & Terrace (Weeks 36.0 to 37.7)
  // 1. Large woven wool area rug under the main living group (Wk 36.00)
  piece(drawn, [
    ['rugM', rb(4.8, 0.022, 3.6, 0.008, 0, 0.014, 0, 2)],
    ['sofaDark', bx(4.84, 0.012, 0.04, 0, 0.009, -1.8), true],
    ['sofaDark', bx(4.84, 0.012, 0.04, 0, 0.009, 1.8), true],
  ], 14.6, 0.003, -5.4, 0, 36.00);

  // 2. Sculpted L-Shaped Modular Bouclé Sofa (Wk 36.20)
  {
    const L = [
      ['steel', bx(3.46, 0.055, 0.88, 0, 0.028, 0), true],
      ['steel', bx(0.92, 0.055, 0.56, -1.11, 0.028, 0.72), true],
      ['sofa', rb(3.68, 0.18, 1.06, 0.06, 0, 0.14, 0)],
      ['sofa', rb(1.10, 0.18, 0.70, 0.06, -1.11, 0.14, 0.77)],
      ['sofa', rb(0.26, 0.56, 1.06, 0.09, -1.74, 0.31, 0)],
      ['sofa', rb(0.26, 0.56, 1.06, 0.09, 1.74, 0.31, 0)],
      ['sofa', rb(3.48, 0.54, 0.24, 0.09, 0, 0.48, -0.41)],
    ];
    L.push(['sofa', rb(1.10, 0.20, 1.54, 0.085, -1.11, 0.31, 0.36)]);
    L.push(['sofa', rb(1.10, 0.20, 0.88, 0.085, 0.0, 0.31, 0.06)]);
    L.push(['sofa', rb(1.10, 0.20, 0.88, 0.085, 1.11, 0.31, 0.06)]);
    for (const x of [-1.11, 0, 1.11]) {
      const b = rb(1.06, 0.46, 0.22, 0.095, 0, 0, 0);
      b.rotateX(-0.16); b.translate(x, 0.62, -0.25);
      L.push(['sofa', b, true]);
    }
    for (const [mat, x, z, w, h, rx, rz] of [
      ['cushionA', -1.36, -0.10, 0.48, 0.42, -0.24, 0.14],
      ['cushionC', -0.96, -0.06, 0.44, 0.38, -0.28, -0.08],
      ['cushionB', -0.08, -0.08, 0.46, 0.40, -0.25, 0.06],
      ['cushionC', 1.02, -0.08, 0.45, 0.39, -0.26, -0.07],
      ['cushionA', 1.38, -0.06, 0.48, 0.42, -0.22, -0.15],
    ]) {
      const c = rb(w, h, 0.15, 0.065, 0, 0, 0);
      c.rotateX(rx); c.rotateZ(rz); c.translate(x, 0.56, z);
      L.push([mat, c, true]);
    }
    const bolsterG = new THREE.CylinderGeometry(0.085, 0.085, 0.64, 20);
    bolsterG.rotateZ(Math.PI / 2); bolsterG.rotateY(0.18); bolsterG.translate(-1.12, 0.47, 0.38);
    L.push(['cushionB', bolsterG, true]);
    piece(drawn, L, 14.6, 0, -6.78, 0, 36.20);
  }

  // 3. Sculpted Twin-Pedestal Travertine Coffee Table + Styled Objects (Wk 36.48)
  {
    const topSlab = rb(1.66, 0.055, 0.88, 0.025, 0, 0.335, 0);
    const L = [
      ['travertine', cyl(0.22, 0.22, 0.31, -0.44, 0.0, -0.04, 28)],
      ['travertine', cyl(0.18, 0.18, 0.31, 0.46, 0.0, 0.05, 28)],
      ['travertine', topSlab],
      ['book1', rb(0.36, 0.042, 0.27, 0.006, -0.44, 0.383, 0.08), true],
      ['book2', rb(0.32, 0.036, 0.24, 0.006, -0.43, 0.422, 0.08), true],
      ['book0', rb(0.28, 0.032, 0.21, 0.006, -0.42, 0.456, 0.07), true],
      ['brass', (() => { const g = new THREE.SphereGeometry(0.038, 16, 12); g.translate(-0.42, 0.51, 0.07); return g; })(), true],
      ['ceramic', lathe([[0, 0], [0.09, 0], [0.12, 0.07], [0.105, 0.22], [0.055, 0.32], [0.05, 0.38], [0.065, 0.40], [0, 0.40]], 0.38, 0.36, -0.10), true],
      ['terracotta', lathe([[0, 0], [0.11, 0], [0.18, 0.05], [0.19, 0.085], [0.175, 0.085], [0.10, 0.02], [0, 0.02]], 0.04, 0.36, 0.16), true],
    ];
    for (let i = 0; i < 6; i++) {
      const a = -0.6 + i * 0.25, l = 0.45 + rnd() * 0.25;
      L.push(['bark', tube(V(0.38, 0.68, -0.10), V(0.38 + Math.sin(a) * l * 0.5, 0.68 + l, -0.10 + Math.cos(a * 2) * 0.12), 0.005, 5), true]);
      const leaves = canopy([[0.38 + Math.sin(a) * l * 0.42, 0.68 + l * 0.82, -0.10, 0.09, 0.16, 0.07, 36]], 0.012, 0.022);
      L.push(['olive', leaves, true]);
    }
    piece(drawn, L, 14.65, 0, -4.75, 0, 36.48);
  }

  // 4. Pair of Sculpted Walnut & Saddle-Leather Lounge Chairs (Wk 36.72 & 36.88)
  piece(drawn, loungeChair(), 12.35, 0, -4.05, Math.atan2(14.65 - 12.35, -4.75 + 4.05), 36.72);
  piece(drawn, loungeChair(), 16.95, 0, -4.00, Math.atan2(14.65 - 16.95, -4.75 + 4.00), 36.88);

  // 5. Fluted Walnut & Travertine Credenza along the south wall (+Z) (Wk 37.02)
  {
    const L = [
      ['ink', bx(3.84, 0.07, 0.42, 0, 0.035, 0), true],
      ['walnut', rb(4.0, 0.48, 0.48, 0.02, 0, 0.31, 0)],
      ['travertine', rb(4.04, 0.035, 0.50, 0.01, 0, 0.565, 0)],
      ['ceramic', lathe([[0, 0], [0.12, 0], [0.15, 0.12], [0.10, 0.38], [0.06, 0.50], [0.07, 0.52], [0, 0.52]], -1.4, 0.58, 0), true],
      ['terracotta', lathe([[0, 0], [0.10, 0], [0.13, 0.10], [0.07, 0.28], [0.08, 0.30], [0, 0.30]], -1.08, 0.58, 0.04), true],
      ['book0', rb(0.32, 0.05, 0.24, 0.005, 0.18, 0.605, 0), true],
      ['book3', rb(0.28, 0.045, 0.22, 0.005, 0.18, 0.652, 0), true],
      ['ceramic', lathe([[0, 0], [0.085, 0], [0.105, 0.10], [0.065, 0.28], [0.025, 0.32], [0, 0.32]], 1.45, 0.58, 0), true],
      ['shade', lathe([[0.18, 0], [0.13, 0.24], [0.125, 0.24], [0.175, 0]], 1.45, 0.86, 0), true],
    ];
    piece(drawn, L, 14.9, 0, 3.38, Math.PI, 37.02);
    lights.push({ p: V(13.45, 1.05, 3.25), k: 0.75 });
  }

  // 6. Sculpted Travertine & Brass Side Table + Warm Table Lamp by the right lounge chair (Wk 37.14)
  piece(drawn, [
    ['travertine', cyl(0.11, 0.14, 0.48, 0, 0, 0, 24)],
    ['travertine', cyl(0.24, 0.24, 0.045, 0, 0.48, 0, 28)],
    ['brass', cyl(0.08, 0.09, 0.22, 0, 0.525, 0, 20), true],
    ['shade', lathe([[0.16, 0], [0.12, 0.22], [0.115, 0.22], [0.155, 0]], 0, 0.72, 0), true],
  ], 17.62, 0, -4.95, 0, 37.14);
  lights.push({ p: V(17.62, 0.88, -4.95), k: 0.85 });

  // 7. Sculpted Brass & Travertine Arc Floor Lamp over the sofa (Wk 37.24)
  {
    const a = V(0, 0.05, 0), c = new THREE.QuadraticBezierCurve3(a, V(0.15, 2.55, 0.2), V(0.95, 2.02, 1.0));
    const t = new THREE.TubeGeometry(c, 40, 0.014, 10, false);
    piece(drawn, [
      ['travertine', cyl(0.20, 0.21, 0.07, 0, 0, 0, 28), true],
      ['brass', t, true],
      ['shade', (() => { const g = new THREE.SphereGeometry(0.24, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.1); g.scale(1, 0.7, 1); g.translate(0.95, 1.90, 1.0); return g; })(), true],
    ], 17.0, 0, -7.28, -Math.PI / 2, 37.24);
    lights.push({ p: V(16.0, 1.75, -6.32), k: 1.15 });
  }

  // 8. Large Framed Artwork on the solid concrete pier beside the stair (Wk 37.32)
  piece(drawn, [
    ['walnut', rb(1.36, 1.81, 0.045, 0.006, 0, 0, -0.005, 2)],
    ['art', bx(1.28, 1.73, 0.04, 0, 0, 0.005), true],
  ], 11.82, 1.98, -7.66, 0, 37.32);

  // 9. Architectural Olive Tree & South Ficus Plant + Sheer Linen Drapery (Wk 37.42 to 37.54)
  {
    const L = [
      ['terracotta', lathe([[0, 0], [0.27, 0], [0.34, 0.52], [0.36, 0.58], [0.33, 0.58], [0.29, 0.52], [0, 0.52]], 0, 0, 0)],
      ['soilPot', cyl(0.30, 0.30, 0.02, 0, 0.52, 0, 24), true],
    ];
    const tr = []; let p = V(0, 0.52, 0);
    for (let i = 0; i < 5; i++) { const q = p.clone().add(V((rnd() - 0.5) * 0.22, 0.32, (rnd() - 0.5) * 0.22)); tr.push(tube(p, q, 0.058 - i * 0.008, 8)); p = q; }
    for (const [dx, dz] of [[0.48, 0.2], [-0.38, 0.28], [0.1, -0.45]]) tr.push(tube(p, p.clone().add(V(dx, 0.48, dz)), 0.028, 6));
    L.push(['bark', merge(tr), true]);
    L.push(['olive', canopy([[0, 2.45, 0, 0.88, 0.52, 0.78, 280], [0.48, 2.72, 0.2, 0.58, 0.38, 0.48, 130], [-0.38, 2.68, 0.28, 0.52, 0.38, 0.48, 110]], 0.048, 0.095), true]);
    piece(drawn, L, 17.42, 0, -6.95, 0.4, 37.42);
  }
  piece(drawn, [
    ['ceramic', lathe([[0, 0], [0.20, 0], [0.24, 0.42], [0, 0.42]], 0, 0, 0)],
    ['bark', tube(V(0, 0.40, 0), V(0.05, 1.32, 0.03), 0.025, 6), true],
    ['leaf', canopy([[0.05, 1.48, 0, 0.45, 0.55, 0.45, 70]], 0.09, 0.16), true],
  ], 17.52, 0, 2.92, 0, 37.48);

  for (const [z0, z1] of [[-7.62, -6.72], [2.82, 3.62]]) {
    const g = new THREE.PlaneGeometry(z1 - z0, 6.28, 40, 1); g.rotateY(Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i) + (z0 + z1) / 2;
      p.setXYZ(i, 18.02 + 0.042 * Math.sin((z - z0) * 26), p.getY(i) + 3.16, z);
    }
    g.computeVertexNormals(); stamp(g, 37.54); (real.sheer || (real.sheer = [])).push(g);
  }

  // 10. Terrace Teak & Linen Sunloungers + Terrace Olive Planter + Garden Shrubs (Wk 37.60 to 37.72)
  for (const z of [-6.45, -5.05]) {
    const L = [
      ['teak', rb(1.96, 0.065, 0.74, 0.02, 0, 0.29, 0)],
      ['sofa', rb(1.32, 0.095, 0.68, 0.04, 0.2, 0.37, 0)],
    ];
    const back = rb(0.62, 0.095, 0.68, 0.04, 0, 0, 0);
    back.rotateZ(-0.72); back.translate(-0.72, 0.58, 0); L.push(['sofa', back]);
    for (const sx of [-0.84, 0.84]) for (const sz of [-0.31, 0.31]) L.push(['teak', cyl(0.024, 0.03, 0.27, sx, 0, sz, 10), true]);
    piece(drawn, L, 20.4, 0, z, 0, 37.60);
  }
  piece(drawn, [['travertine', cyl(0.26, 0.26, 0.36, 0, 0, 0, 28)]], 20.5, 0, -5.75, 0, 37.62);

  piece(real, [
    ['terracotta', rb(0.92, 0.62, 0.92, 0.03, 0, 0.31, 0)],
    ['soilPot', bx(0.84, 0.02, 0.84, 0, 0.61, 0)],
    ['bark', merge([tube(V(0, 0.6, 0), V(0.1, 1.6, 0.05), 0.07, 7), tube(V(0.1, 1.6, 0.05), V(0.45, 2.2, 0.2), 0.04, 6), tube(V(0.1, 1.6, 0.05), V(-0.3, 2.3, -0.1), 0.04, 6)])],
    ['olive', canopy([[0, 2.4, 0, 1.0, 0.6, 0.9, 340], [0.4, 2.7, 0.2, 0.6, 0.4, 0.6, 140]], 0.05, 0.1)],
  ], 21.85, 0, -7.35, 0, 37.68);

  piece(real, [
    ['olive', canopy([
      [0, 0.35, 0, 0.9, 0.38, 1.8, 180],
      [0.2, 0.4, 2.6, 0.85, 0.42, 1.6, 160],
      [-0.1, 0.35, -2.8, 0.85, 0.36, 1.7, 160],
    ], 0.06, 0.12), true],
  ], 24.9, -3.2, -2.0, 0, 37.72);

  // ---------------------------------------------------------------- the sliding door in the glass, opened for handover
  const door = new THREE.Group();
  {
    const F = [bx(0.05, 2.64, 0.05, 0, 1.32, -0.93), bx(0.05, 2.64, 0.05, 0, 1.32, 0.93), bx(0.05, 0.05, 1.91, 0, 0.025, 0), bx(0.05, 0.05, 1.91, 0, 2.615, 0), bx(0.035, 0.045, 0.22, 0.045, 1.1, -0.8)];
    const f = merge(F); stamp(f, 23.6); addMesh(door, f, { main: R.steel, paper: null, nd: null });
    const g = bx(0.018, 2.54, 1.81, 0, 1.32, 0); stamp(g, 23.6); addMesh(door, g, { main: R.glass, paper: null, nd: null }, { glass: true, shadow: false });
    door.position.set(18.24, 0, -2.95); group.add(door);
  }

  // ---------------------------------------------------------------- engineered scaffold stair from the garden to the terrace
  {
    const T = [], B = [];
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    const stTube = (a, b, r, seg, w0, w1, o0 = 29.3, o1 = 29.9) => {
      const g = tube(a, b, r, seg);
      const p = g.attributes.position, ab = b.clone().sub(a), lenSq = Math.max(1e-6, ab.lengthSq());
      stamp(g, (x, y, z) => {
        const u = clamp01(((x - a.x) * ab.x + (y - a.y) * ab.y + (z - a.z) * ab.z) / lenSq);
        return w0 + (w1 - w0) * u;
      }, (x, y, z) => {
        const u = clamp01(((x - a.x) * ab.x + (y - a.y) * ab.y + (z - a.z) * ab.z) / lenSq);
        return o1 + (o0 - o1) * u;
      });
      T.push(g);
    };
    const stBox = (w, h, d, cx, cy, cz, w0, w1, ax = 0, o0 = 29.2, o1 = 29.8) => {
      const g = bx(w, h, d, cx, cy, cz);
      const lo = [cx - w / 2, cy - h / 2, cz - d / 2][ax], span = Math.max(1e-5, [w, h, d][ax]);
      stamp(g, (x, y, z) => w0 + (w1 - w0) * clamp01(([x, y, z][ax] - lo) / span), o0);
      B.push(g);
    };

    const x0 = 26.9, x1 = 22.45, y0 = -3.2, y1 = 0, n = 18, zA = 1.68, zB = 2.72;
    const stepX = (x0 - x1) / n, stepY = (y1 - y0) / n;
    // 18 stair treads ripple smoothly from bottom step (i = 0) up to terrace landing (i = 17)
    for (let i = 0; i < n; i++) {
      const u = i / n, wStep = 10.24 + u * 0.44;
      stBox(stepX + 0.02, 0.04, zB - zA - 0.02, x0 - (i + 0.5) * stepX, y0 + (i + 1) * stepY - 0.02, (zA + zB) / 2, wStep, wStep + 0.06, 0, 29.15 + (1 - u) * 0.35);
    }
    for (const z of [zA - 0.03, zB + 0.03]) {
      const zOff = z > 2 ? 0.03 : 0;
      // Inclined stringer channels shoot up from bottom sole pad to landing deck
      stTube(V(x0 + 0.1, y0 + 0.05, z), V(x1, y1 - 0.05, z), 0.032, 8, 9.96 + zOff, 10.30 + zOff);
      // Mid and top stair guardrails sweep up after treads
      stTube(V(x0, y0 + 0.52, z), V(x1, y1 + 0.52, z), 0.02, 8, 10.42 + zOff, 10.74 + zOff);
      stTube(V(x0, y0 + 1.02, z), V(x1, y1 + 1.02, z), 0.024, 8, 10.48 + zOff, 10.82 + zOff);
      for (const t of [0, 0.5, 1]) {
        const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, yn = natural(x, z);
        const xProg = clamp01((x - 18.4) / 8.6);
        const wSole = 9.52 + xProg * 0.24 + zOff;
        // Sole board lands on compacted backfill first, then vertical standard grows upward from sole board
        stBox(0.22, 0.04, 0.22, x, yn + 0.02, z, wSole, wSole + 0.06, 1, 29.85);
        stTube(V(x, yn, z), V(x, y + 1.06, z), 0.024, 8, wSole + 0.05, wSole + 0.52);
      }
    }
    // Cross transoms under stair flight
    for (const t of [0, 0.5, 1]) {
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      const wTr = 9.88 + (1 - t) * 0.22;
      stTube(V(x, y - 0.05, zA - 0.03), V(x, y - 0.05, zB + 0.03), 0.022, 8, wTr, wTr + 0.08);
    }
    // Landing deck next to the terrace, on standards, with guardrails, transoms, diagonal braces and toe boards
    const dx0 = 18.4, dx1 = 22.45, dz0 = 1.6, dz1 = 2.8;
    for (let x = dx0; x < dx1 - 0.01; x += 0.22) {
      const u = clamp01((x - dx0) / (dx1 - dx0)), wPlank = 10.04 + u * 0.28;
      stBox(0.21, 0.04, dz1 - dz0, x + 0.11, -0.02, (dz0 + dz1) / 2, wPlank, wPlank + 0.05, 2, 29.25);
    }
    for (let x = dx0 + 0.05; x <= dx1 + 0.01; x += (dx1 - dx0) / 2) {
      const u = clamp01((x - dx0) / (dx1 - dx0));
      const wBase = 9.50 + u * 0.16;
      for (const z of [dz0 + 0.05, dz1 - 0.05]) {
        const yn = natural(x, z), zOff = z > 2 ? 0.03 : 0;
        stBox(0.22, 0.04, 0.22, x, yn + 0.02, z, wBase + zOff, wBase + zOff + 0.05, 1, 29.85);
        stTube(V(x, yn, z), V(x, z > 2 ? 1.06 : -0.04, z), 0.024, 8, wBase + zOff + 0.04, wBase + zOff + (z > 2 ? 0.54 : 0.40));
      }
      stTube(V(x, -1.6, dz0 + 0.05), V(x, -1.6, dz1 - 0.05), 0.022, 8, wBase + 0.24, wBase + 0.32);
      stTube(V(x, -0.06, dz0 + 0.05), V(x, -0.06, dz1 - 0.05), 0.022, 8, wBase + 0.38, wBase + 0.46);
    }
    for (const h of [0.52, 1.02]) {
      const wRail = h < 0.8 ? 10.32 : 10.42;
      stTube(V(dx0, h, dz1 - 0.05), V(dx1, h, dz1 - 0.05), 0.022, 8, wRail, wRail + 0.24);
    }
    stBox(dx1 - dx0, 0.15, 0.03, (dx0 + dx1) / 2, 0.075, dz1 - 0.04, 10.28, 10.50, 0, 29.20); // toe board
    for (const z of [dz0 + 0.05, dz1 - 0.05]) {
      const zOff = z > 2 ? 0.03 : 0;
      stTube(V(dx0, -1.6, z), V(dx1, -1.6, z), 0.022, 8, 9.76 + zOff, 9.96 + zOff);
      stTube(V(dx0, -3.0, z), V(dx1, -0.1, z), 0.02, 8, 9.72 + zOff, 10.04 + zOff);
    }
    const t = merge(T); addMesh(group, t, { main: R.galv, paper: null, nd: null });
    const b = merge(B); worldUV(b); addMesh(group, b, { main: R.timber, paper: null, nd: null });
  }

  // ---------------------------------------------------------------- material stacks on site
  {
    const L = [];
    for (let i = 0; i < 40; i++) {
      const g = new THREE.CylinderGeometry(0.008, 0.008, 6, 5);
      g.rotateZ(Math.PI / 2);
      g.translate(25.0 + (rnd() - 0.5) * 0.04, -3.2 + 0.12 + (i % 5) * 0.018, 9.6 + Math.floor(i / 5) * 0.022);
      L.push(g);
    }
    const r = merge(L); stamp(r, 1.5, 8); addMesh(group, r, { main: R.rebar, paper: null, nd: null });
    const be = merge([bx(0.1, 0.1, 0.5, 23.2, -3.15, 9.68), bx(0.1, 0.1, 0.5, 26.8, -3.15, 9.68)]);
    stamp(be, 1.5, 8); addMesh(group, be, { main: R.timber, paper: null, nd: null });
    // Pallets of masonry blocks by the garden track (arrive progressively after backfill reaches garden grade)
    const P = [], K = [];
    const pallets = [[26.6, -9.6], [27.9, -9.6], [26.6, -10.9]];
    for (let pi = 0; pi < pallets.length; pi++) {
      const [px, pz] = pallets[pi], wPal = 9.65 + pi * 0.14;
      const pg0 = bx(1.2, 0.14, 1.0, px, -3.2 + 0.07, pz);
      stamp(pg0, (x, y) => wPal + 0.06 * Math.max(0, Math.min(1, (y - (-3.2)) / 0.14)), 21 - pi * 0.15);
      P.push(pg0);
      for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 4; c++) {
        const bg0 = bx(0.42, 0.2, 0.2, px - 0.36 + a * 0.44 * 0.82, -3.06 + 0.1 + b * 0.205, pz - 0.36 + c * 0.24);
        const wBlk = wPal + 0.08 + b * 0.12 + (a * 4 + c) * 0.015;
        stamp(bg0, (x, y) => wBlk + 0.05 * Math.max(0, Math.min(1, (y - (-3.06 + b * 0.205)) / 0.2)), 20.8 - pi * 0.15);
        K.push(bg0);
      }
    }
    const pg = merge(P); worldUV(pg); addMesh(group, pg, { main: R.timber, paper: null, nd: null });
    const kg = merge(K); worldUV(kg); addMesh(group, kg, { main: R.block, paper: null, nd: null });
  }

  // Merge meshes: `drawn` uses DM.ndFurn so Tile 06 renders delicate interior line weights, `real` renders 3D only
  for (const k in drawn) addMesh(group, merge(drawn[k]), { main: R[k], paper: DM.paper, nd: DM.ndFurn }, { shadow: k !== 'sheer' && k !== 'rugM' });
  for (const k in real) addMesh(group, merge(real[k]), { main: R[k], paper: null, nd: null }, { shadow: k !== 'sheer' && k !== 'rugM' });
  group.userData.door = door; group.userData.lights = lights;
  return group;
}
