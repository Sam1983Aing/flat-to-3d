// Shared pieces for the three direction sketches: renderer, materials, merged parts with ink edges,
// the long-lens camera, and the labels that follow the layers.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
export { THREE, LineSegments2, LineSegmentsGeometry };

export const D2R = Math.PI / 180;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const ease2 = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
export const easeOut = t => 1 - Math.pow(1 - t, 3);
export const win = (p, a, b) => clamp((p - a) / (b - a));
export const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const INK = '#1d1c19';
export const PAPER = '#f2efe7';
export const ACCENT = '#e85d04';

export const ctx = { W: innerWidth, H: innerHeight, res: new THREE.Vector2(innerWidth, innerHeight), lineMats: new Set(), shadows: false, phone: innerWidth < 700 };

// ---------- the plotter. Everything is drawn in by a front that sweeps through the model: lines first
// (with an orange pen tip), then the fills behind them. order = dot(world, dir) + radial * distance from c.
export const DRAW = {
  uDraw: { value: 1e5 }, uDrawFill: { value: 1e5 }, uDrawSoft: { value: 1.2 },
  uDrawDir: { value: new THREE.Vector4(0, 1, 0, 0) }, uDrawC: { value: new THREE.Vector3() },
  uPen: { value: new THREE.Color('#e85d04') },
  uWash: { value: 0 },          // 1 = the fills are a light colour wash on paper, as on a drawing
};
const DRAW_GLSL = `uniform float uDraw; uniform float uDrawFill; uniform float uDrawSoft; uniform vec4 uDrawDir; uniform vec3 uDrawC; uniform vec3 uPen; uniform float uWash;
  varying vec3 vWD;
  float drawOrder(vec3 w) { return dot(w, uDrawDir.xyz) + uDrawDir.w * length(w.xz - uDrawC.xz); }
`;
const addDraw = (sh) => { Object.assign(sh.uniforms, DRAW); };
function patchFill(m, o = {}) {
  const prev = m.onBeforeCompile;
  const grainAmt = o.grain ?? 0.022;
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    addDraw(sh);
    sh.uniforms.uGrain = { value: grainAmt };
    sh.vertexShader = 'varying vec3 vWD; varying vec3 vLP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vWD = (modelMatrix * vec4(transformed, 1.0)).xyz;\n vLP = transformed;');
    sh.fragmentShader = DRAW_GLSL + 'uniform float uGrain; varying vec3 vLP;\nfloat hash3(vec3 p){ p = fract(p * vec3(443.897, 441.423, 437.195)); p += dot(p, p.yzx + 19.19); return fract((p.x + p.y) * p.z); }\n' + sh.fragmentShader
      .replace('#include <clipping_planes_fragment>', 'if (drawOrder(vWD) > uDrawFill) discard;\n#include <clipping_planes_fragment>')
      .replace('#include <map_fragment>', (o.wash === false ? '#include <map_fragment>' : '#include <map_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, mix(mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))), 0.5), vec3(0.975, 0.962, 0.94), 0.4), uWash);')
        + '\n diffuseColor.rgb *= 1.0 + (hash3(floor(vLP * 140.0)) - 0.5) * uGrain * (1.0 - 0.5 * uWash);');
  };
  return m;
}
function patchLine(m) {
  m.onBeforeCompile = (sh) => {
    addDraw(sh);
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying vec3 vWD;\nvoid main() {\n vWD = (modelMatrix * vec4((position.y < 0.5) ? instanceStart : instanceEnd, 1.0)).xyz;');
    sh.fragmentShader = DRAW_GLSL + sh.fragmentShader.replace('#include <color_fragment>', `{ float k = uDraw - drawOrder(vWD); if (k < 0.0) discard;
        diffuseColor.rgb = mix(uPen, diffuseColor.rgb, smoothstep(0.0, uDrawSoft, k)); }
      #include <color_fragment>`);
  };
  return m;
}
export { patchFill };

export const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
export const scene = new THREE.Scene();
scene.background = new THREE.Color(PAPER);
export const camera = new THREE.PerspectiveCamera(30, 1, 1, 1000);

let _studioEnv = null;
export function ensureEnv() {
  if (_studioEnv) return _studioEnv;
  const envScene = new THREE.Scene();
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#fffdf9'); gr.addColorStop(0.5, '#f2ece0'); gr.addColorStop(1, '#d6cbb8');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(40, 24, 12), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide })));
  const card = (w, h, p, col) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
    m.position.set(...p); m.lookAt(0, 0, 0); envScene.add(m);
  };
  card(24, 14, [28, 18, 16], 0xffffff);
  card(20, 12, [-22, 16, 20], 0xfff5e4);
  _studioEnv = new THREE.PMREMGenerator(renderer).fromScene(envScene, 0.03).texture;
  return _studioEnv;
}

// ---------- geometry
export function bx(x0, y0, z0, x1, y1, z1) {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}
// a square-section member from a to b: w across (stays horizontal when it can), d the other way
export function beam(a, b, w, d) {
  const dir = b.clone().sub(a); const L = dir.length(); dir.normalize();
  const g = new THREE.BoxGeometry(w, d, L);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), dir));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}
export function cyl(r, h, x, y, z, seg = 28, r2 = r) {
  const g = new THREE.CylinderGeometry(r2, r, h, seg); g.translate(x, y + h / 2, z); return g;
}
export function ball(r, x, y, z, detail = 3) { const g = new THREE.IcosahedronGeometry(r, detail); g.translate(x, y, z); return g; }

const pts = a => a.map(([u, v]) => new THREE.Vector2(u, v));
// a flat panel drawn in (u, v) and extruded th along +w. Holes are point lists or {c:[u,v], r}.
export function panel(outline, holes = [], th = 0.12) {
  const s = outline instanceof THREE.Shape ? outline : new THREE.Shape(pts(outline));
  for (const h of holes) {
    if (h.r) { const p = new THREE.Path(); p.absarc(h.c[0], h.c[1], h.r, 0, Math.PI * 2, true); s.holes.push(p); }
    else s.holes.push(new THREE.Path(pts(h)));
  }
  return new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: false, curveSegments: 40 });
}
export function ring(r0, r1, th) {
  const s = new THREE.Shape(); s.absarc(0, 0, r1, 0, Math.PI * 2, false);
  const h = new THREE.Path(); h.absarc(0, 0, r0, 0, Math.PI * 2, true); s.holes.push(h);
  return new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: false, curveSegments: 40 });
}
// placements for panels: u along x at z0 (w goes +z) / u along z with w going -x from x1 / lying flat (v = -z, w up)
export const M = {
  alongX: (z0, y0 = 0) => new THREE.Matrix4().makeTranslation(0, y0, z0),
  alongZ: (x1, y0 = 0) => new THREE.Matrix4().makeTranslation(x1, y0, 0).multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2)),
  flat: (y0 = 0) => new THREE.Matrix4().makeTranslation(0, y0, 0).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2)),
};

// ---------- materials
export function lineMat(o = {}) {
  const m = new LineMaterial({
    color: new THREE.Color(o.color ?? INK), linewidth: o.w ?? 1, dashed: !!o.dashed,
    dashSize: o.dash ?? 0.3, gapSize: o.gap ?? 0.22, transparent: true, opacity: o.opacity ?? 1,
    depthTest: o.depthTest ?? true, depthWrite: false,
  });
  m.userData.w = o.w ?? 1; m.resolution.copy(ctx.res); ctx.lineMats.add(m);
  if (ctx.phone) m.linewidth = m.userData.w * 0.72;
  return patchLine(m);
}
// The drawing's own shading: directional sun + cool sky fill + procedural local-space architectural texture
// mode: 0 = paper/plaster, 1 = timber/oak/glulam, 2 = cast concrete, 3 = standing-seam zinc, 4 = woven textile, 5 = glass
export function toneMat(hex, o = {}) {
  const op = o.opacity ?? 1;
  const mode = o.mode ?? 0;
  const sc = o.scale ?? 1.0;
  return new THREE.ShaderMaterial({
    uniforms: {
      uCol: { value: new THREE.Color(hex) },
      uOp: { value: op },
      uMode: { value: mode },
      uScale: { value: sc },
      ...DRAW,
    },
    vertexShader: `varying vec3 vN; varying vec3 vWD; varying vec3 vLP;
      void main(){
        vN = normalize(mat3(modelMatrix) * normal);
        vLP = position;
        vWD = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: DRAW_GLSL + `uniform vec3 uCol; uniform float uOp; uniform float uMode; uniform float uScale;
      varying vec3 vN; varying vec3 vLP;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p){
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h2(i), h2(i + vec2(1,0)), f.x), mix(h2(i + vec2(0,1)), h2(i + vec2(1,1)), f.x), f.y);
      }
      void main(){
        if (drawOrder(vWD) > uDrawFill) discard;
        vec3 n = normalize(vN);
        vec3 L1 = normalize(vec3(-0.38, 1.0, 0.55));
        vec3 L2 = normalize(vec3(0.45, 0.35, -0.65));
        float sun = max(dot(n, L1), 0.0);
        float sky = max(dot(n, L2), 0.0);
        float top = clamp(n.y, 0.0, 1.0);
        float shade = 0.80 + 0.17 * sun + 0.04 * sky + 0.03 * top;
        vec3 p = vLP * uScale;
        vec2 uv = abs(n.y) > 0.7 ? p.xz : (abs(n.x) > 0.7 ? p.zy : p.xy);
        float tex = 0.0;
        if (uMode > 0.5 && uMode < 1.5) {
          // Mode 1: architectural timber / oak / glulam grain & plank variation
          float plankId = floor(uv.y * 5.0);
          float plankTone = (h2(vec2(plankId, floor(uv.x * 0.4))) - 0.5) * 0.045;
          float wave = sin(uv.x * 3.5 + n2(uv * 2.2) * 4.5);
          float grain = (n2(vec2(uv.x * 4.0, uv.y * 38.0 + wave * 1.8)) - 0.5) * 0.042;
          float seam = smoothstep(0.035, 0.0, fract(uv.y * 5.0)) * -0.045;
          tex = plankTone + grain + seam;
        } else if (uMode >= 1.5 && uMode < 2.5) {
          // Mode 2: cast concrete with lift lines and mineral aggregate stipple
          float lift = smoothstep(0.03, 0.0, fract(p.y * 2.5)) * -0.05;
          float blotch = (n2(uv * 3.2) - 0.5) * 0.045;
          float stipple = (h2(floor(uv * 65.0)) - 0.5) * 0.048;
          tex = lift + blotch + stipple;
        } else if (uMode >= 2.5 && uMode < 3.5) {
          // Mode 3: standing-seam zinc roof panels
          float pan = sin(uv.x * 14.0) * 0.018;
          float stria = (n2(vec2(uv.x * 45.0, uv.y * 3.0)) - 0.5) * 0.025;
          tex = pan + stria + 0.02 * top;
        } else if (uMode >= 3.5 && uMode < 4.5) {
          // Mode 4: woven textile / upholstery / rug
          float w1 = sin(uv.x * 90.0) * sin(uv.y * 90.0) * 0.022;
          float w2 = (n2(uv * 16.0) - 0.5) * 0.03;
          tex = w1 + w2;
        } else if (uMode >= 4.5) {
          // Mode 5: architectural triple glazing with diagonal skylight sheen
          float sheen = smoothstep(0.45, 0.55, sin((vLP.x + vLP.y * 1.35 + vLP.z) * 1.8)) * 0.08;
          gl_FragColor = vec4(uCol * (shade + sheen), uOp + sheen * 0.45);
          #include <colorspace_fragment>
          return;
        } else {
          // Mode 0: warm paper / lime plaster micro-grain
          tex = (n2(uv * 5.5) - 0.5) * 0.018 + (h2(floor(uv * 90.0)) - 0.5) * 0.016;
        }
        vec3 col = uCol * (shade + tex);
        gl_FragColor = vec4(col, uOp);
        #include <colorspace_fragment>
      }`,
    transparent: op < 1, depthWrite: op >= 1, side: o.side ?? THREE.FrontSide,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });
}
export function stdMat(hex, o = {}) {
  const m = new THREE.MeshStandardMaterial({
    color: hex, roughness: o.rough ?? 0.82, metalness: o.metal ?? 0, map: o.map ?? null,
    bumpMap: o.bumpMap ?? null, bumpScale: o.bumpScale ?? 0.016,
    roughnessMap: o.roughnessMap ?? null,
    envMap: o.envMap ?? ensureEnv(), envMapIntensity: o.env ?? 0.42,
    transparent: o.opacity != null, opacity: o.opacity ?? 1, depthWrite: o.opacity == null,
    side: o.side ?? THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    emissive: o.emissive ?? 0x000000, emissiveIntensity: o.emissiveIntensity ?? 1,
  });
  return patchFill(m, o);
}
// silhouettes for round things: the back faces pushed out a fixed number of pixels
export function hullMat(px = 1, color = INK) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = s => {
    s.uniforms.uPx = { value: px }; s.uniforms.uRes = { value: ctx.res }; addDraw(s);
    s.fragmentShader = DRAW_GLSL + s.fragmentShader.replace('#include <clipping_planes_fragment>', 'if (drawOrder(vWD) > uDrawFill) discard;\n#include <clipping_planes_fragment>');
    s.vertexShader = 'varying vec3 vWD;\n' + s.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vWD = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.vertexShader = 'uniform float uPx; uniform vec2 uRes;\n' + s.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      { vec4 cn = projectionMatrix * vec4(normalize(normalMatrix * normal), 0.0);
        vec2 d = cn.xy; float l = length(d); if (l > 1e-5) gl_Position.xy += d / l * uPx * 2.0 / uRes * gl_Position.w; }`);
  };
  return m;
}

// ---------- parts: geometry collected per material, merged, with ink edges on top
export class Part {
  constructor(parent, pal, line, weights = {}) { this.parent = parent; this.pal = pal; this.line = line; this.weights = weights; this.b = new Map(); }
  add(key, ...gs) {
    const spec = this.pal[key];
    for (let g of gs) {
      if (g.index) g = g.toNonIndexed();
      if (spec?.uvScale) boxUV(g, spec.uvScale, spec.uvAlong);
      for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n);
      if (!this.b.has(key)) this.b.set(key, []);
      this.b.get(key).push(g);
    }
    return this;
  }
  build() {
    for (const [key, list] of this.b) {
      const spec = this.pal[key]; if (!spec) throw new Error('no material ' + key);
      const geo = mergeGeometries(list, false);
      const mesh = new THREE.Mesh(geo, spec.mat);
      mesh.castShadow = spec.cast ?? true; mesh.receiveShadow = spec.receive ?? true;
      this.parent.add(mesh);
      if (spec.edges !== false) {
        const eg = new THREE.EdgesGeometry(geo, spec.thr ?? 30);
        const l = new LineSegments2(new LineSegmentsGeometry().fromEdgesGeometry(eg), spec.line || (spec.w && this.weights[spec.w]) || this.line);
        this.parent.add(l);
      }
      if (spec.hull) this.parent.add(new THREE.Mesh(geo, spec.hullMat || (spec.hullMat = hullMat(spec.hull === true ? 1 : spec.hull, spec.hullColor))));
    }
    this.b.clear();
    return this;
  }
}
// loose line segments (hatching, board joints): [[x0,y0,z0,x1,y1,z1], ...]
export function segs(parent, list, mat) {
  if (!list.length) return null;
  const g = new LineSegmentsGeometry(); g.setPositions(list.flat());
  const l = new LineSegments2(g, mat); parent.add(l); return l;
}
// a dashed line we move every frame
export function liveLine(mat) {
  const g = new LineSegmentsGeometry(); g.setPositions([0, 0, 0, 0, 0.001, 0]);
  const l = new LineSegments2(g, mat); l.frustumCulled = false; scene.add(l);
  l.set = (list) => { if (!list.length) { l.visible = false; return; } l.visible = true; g.setPositions(list.flat()); l.computeLineDistances(); };
  return l;
}

// ---------- camera. A key is a target, a direction (az, el), a lens and the height of the frame at the
// target. Between keys the lens is interpolated in log and the distance follows from the frame height,
// so widening the lens while holding the frame is a dolly zoom. A 1.5 degree lens from 1 km is an axo.
export function eyeKey(at, E, T, fov, extra = {}) {
  const d = V(...E).sub(V(...T)); const D = d.length();
  const v = V(...T).sub(V(...E));
  return {
    at, t: T, pos: E, look: T,
    laz: Math.atan2(v.z, v.x) / D2R, lel: Math.asin(v.y / D) / D2R, ldist: D,
    az: Math.atan2(d.z, d.x) / D2R, el: Math.asin(d.y / D) / D2R,
    fov, h: 2 * D * Math.tan(fov * D2R / 2), sx: 0, sy: 0, ...extra,
  };
}
export function camAt(keys0, p) {
  const keys = ctx.phone ? keys0.map(k => k.ph ? { ...k, ...k.ph } : k) : keys0;
  let i = 0; while (i < keys.length - 1 && p > keys[i + 1].at) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
  const u = a === b ? 0 : (b.easeFn || ease)(clamp((p - a.at) / (b.at - a.at)));
  const L = (k) => lerp(a[k] ?? 0, b[k] ?? 0, u);
  const az = a.az + ((((b.az - a.az) % 360) + 540) % 360 - 180) * u;
  if (a.pos && b.pos) {
    const pos = [lerp(a.pos[0], b.pos[0], u), lerp(a.pos[1], b.pos[1], u), lerp(a.pos[2], b.pos[2], u)];
    const laz = (a.laz + ((((b.laz - a.laz) % 360) + 540) % 360 - 180) * u) * D2R;
    const lel = lerp(a.lel, b.lel, u) * D2R;
    const ldist = lerp(a.ldist, b.ldist, u);
    const t = [pos[0] + ldist * Math.cos(lel) * Math.cos(laz), pos[1] + ldist * Math.sin(lel), pos[2] + ldist * Math.cos(lel) * Math.sin(laz)];
    const fov = Math.exp(lerp(Math.log(a.fov), Math.log(b.fov), u));
    return {
      pos, t, az, el: L('el'), fov,
      h: 2 * ldist * Math.tan(fov * D2R / 2), w: L('w'), sx: L('sx'), sy: L('sy'), roll: L('roll'),
    };
  }
  return {
    t: [lerp(a.t[0], b.t[0], u), lerp(a.t[1], b.t[1], u), lerp(a.t[2], b.t[2], u)],
    az, el: L('el'), fov: Math.exp(lerp(Math.log(a.fov), Math.log(b.fov), u)),
    h: Math.exp(lerp(Math.log(a.h), Math.log(b.h), u)), w: L('w'), sx: L('sx'), sy: L('sy'), roll: L('roll'),
  };
}
export function applyCam(c, R = 80) {
  const aspect = ctx.W / ctx.H;
  const h = Math.max(c.h, (c.w || 0) / aspect);
  const D = h / (2 * Math.tan(c.fov * D2R / 2));
  if (c.pos) {
    camera.position.set(c.pos[0], c.pos[1], c.pos[2]);
  } else {
    const az = c.az * D2R, el = c.el * D2R;
    camera.position.set(c.t[0] + D * Math.cos(el) * Math.cos(az), c.t[1] + D * Math.sin(el), c.t[2] + D * Math.cos(el) * Math.sin(az));
  }
  camera.up.set(0, 1, 0); camera.lookAt(c.t[0], c.t[1], c.t[2]);
  camera.fov = c.fov; camera.aspect = aspect;
  camera.near = Math.max(0.04, D - R); camera.far = D + R * 3;
  camera.updateProjectionMatrix();
  // lens shift, as an architectural camera does it: the picture slides, the lines stay parallel
  camera.projectionMatrix.elements[8] -= c.sx || 0;
  camera.projectionMatrix.elements[9] -= c.sy || 0;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  camera.userData.D = D;
}

// ---------- labels: a column to the right of the drawing, or tags beside their anchors
const tmp = new THREE.Vector3();
export class Labels {
  constructor() { this.root = document.getElementById('labels'); this.svg = document.getElementById('leaders'); this.items = []; }
  add(o) {
    const el = document.createElement('div'); el.className = 'lab' + (o.mode === 'tag' ? ' tag' : '') + (o.cls ? ' ' + o.cls : '');
    el.innerHTML = `<span class="no">${o.no}</span><span class="nm">${o.name}</span>${o.short ? `<span class="nm-s">${o.short}</span>` : ''}${o.sub ? `<span class="sb">${o.sub}</span>` : ''}`;
    if (o.short) el.classList.add('has-s');
    this.root.appendChild(el);
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.innerHTML = '<polyline class="halo"/><polyline/><circle r="3.0" class="halo"/><circle r="2.2" class="dot"/><circle r="5.2" class="reticle"/><line class="tick"/>';
    this.svg.appendChild(g);
    const it = { ...o, el, g, op: 1, on: false }; this.items.push(it); return it;
  }
  update(colX) {
    const W = ctx.W, H = ctx.H;
    const vis = [];
    for (const it of this.items) {
      it.obj.updateWorldMatrix(true, false);
      tmp.copy(it.at).applyMatrix4(it.obj.matrixWorld).project(camera);
      it.ax = (tmp.x * .5 + .5) * W; it.ay = (-tmp.y * .5 + .5) * H;
      it.ly = it.ay + (it.dy || 0);
      if (it.op > 0.01 && tmp.z < 1) vis.push(it);
    }
    // keep column labels apart: sort by height, push down, then pull the block back up if it ran off
    const col = vis.filter(i => i.mode !== 'tag').sort((a, b) => (a.rank ?? a.ly) - (b.rank ?? b.ly) || a.ly - b.ly);
    const gap = ctx.phone ? 26 : 48;
    for (let k = 1; k < col.length; k++) col[k].ly = Math.max(col[k].ly, col[k - 1].ly + gap);
    const over = col.length ? col[col.length - 1].ly - (H - (ctx.phone ? 125 : 222)) : 0;
    if (over > 0) { col.forEach(i => i.ly -= over); for (let k = col.length - 2; k >= 0; k--) col[k].ly = Math.min(col[k].ly, col[k + 1].ly - gap); }
    for (const it of this.items) {
      const show = it.op > 0.01 && vis.includes(it);
      it.el.style.opacity = show ? it.op : 0; it.g.style.opacity = show ? it.op : 0;
      it.el.classList.toggle('on', it.on); it.g.classList.toggle('on', it.on);
      if (!show) continue;
      const [ph, pl, ch, c, ret, tick] = it.g.children;
      for (const e of [c, ch, ret]) { e.setAttribute('cx', it.ax); e.setAttribute('cy', it.ay); }
      if (it.mode === 'tag') {
        ret.style.display = 'none'; tick.style.display = 'none';
        const tk = ctx.phone ? 0.55 : 1, lx = it.ax + (it.tx ?? 18) * tk, ly = it.ay + (it.ty ?? -18) * tk;
        it.el.style.transform = (it.tx ?? 18) < 0 ? `translate(${lx - 6}px, ${ly - 8}px) translateX(-100%)` : `translate(${lx + 6}px, ${ly - 8}px)`;
        it.el.style.textAlign = (it.tx ?? 18) < 0 ? 'right' : 'left';
        for (const e of [pl, ph]) e.setAttribute('points', `${it.ax},${it.ay} ${lx},${ly}`);
      } else {
        ret.style.display = ''; tick.style.display = '';
        const x = colX(it);
        it.el.style.transform = `translate(${x + 10}px, ${it.ly - 8}px)`;
        const elbow = Math.max(it.ax + 16, x - 36);
        for (const e of [pl, ph]) e.setAttribute('points', `${it.ax},${it.ay} ${elbow},${it.ay} ${x - 10},${it.ly} ${x + 2},${it.ly}`);
        tick.setAttribute('x1', x + 2); tick.setAttribute('y1', it.ly - 6);
        tick.setAttribute('x2', x + 2); tick.setAttribute('y2', it.ly + 6);
      }
    }
  }
}

export function resize() {
  ctx.W = innerWidth; ctx.H = innerHeight; ctx.res.set(ctx.W, ctx.H); ctx.phone = ctx.W < 700;
  document.body.classList.toggle('phone', ctx.phone);
  renderer.setSize(ctx.W, ctx.H, false);
  for (const m of ctx.lineMats) { m.resolution.copy(ctx.res); m.linewidth = m.userData.w * (ctx.phone ? 0.72 : 1); }
}

// ---------- canvas textures
export function canvasTex(w, h, draw, o = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8; if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
// a small seeded random, so every load draws the same boards and books
export function rng(seed = 1) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// UVs from world position, projected along each face's main axis (metres * scale). For hatches, grain and
// laminations that must keep the same spacing on every box.
export function boxUV(g, scale = 1, along = null) {
  if (g.index) g = g.toNonIndexed();
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    if (along === 'z' && ay >= ax && ay >= az) { const t = u; u = v; v = t; }
    uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
