// The drawing is not drawn. It is the house rendered once into a float target (normal, depth, what the surface is),
// then one full-screen pass finds the edges and inks them on paper. The same pass mixes in the lit house (real.js)
// on the far side of the scan plane, adds the sunbeams, and keeps the scale figures drawn: they stay paper cut-outs
// inside the real house, the way architects collage people into a render.
import * as THREE from 'three';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { mergePieces } from './house.js';

const srgb = (h) => new THREE.Vector3(((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255);
const FULL_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';

const ND_MAT = () => new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  uniforms: { uB: { value: 0 } },
  vertexShader: `attribute float aId; varying vec3 vN; varying float vD; varying float vId;
    void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vD = -mv.z; vN = normalize(normalMatrix * normal); vId = aId; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uB; varying vec3 vN; varying float vD; varying float vId;
    void main(){ vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n; gl_FragColor = vec4(n.xy, vD - uB, vId); }`,
});

const INK = {
  uniforms: {
    tND: { value: null }, tReal: { value: null }, tShaft: { value: null }, res: { value: new THREE.Vector2(1, 1) }, uB: { value: 0 },
    uCamWorld: { value: new THREE.Matrix4() }, uFr: { value: new THREE.Vector4(-1, 1, -1, 1) },
    dK: { value: 1.6 }, px: { value: 1 }, uDpr: { value: 1 },
    uPoche: { value: 1 }, uLines: { value: 99 }, uEarth: { value: 1 }, uGrain: { value: 1 },
    uScanX: { value: 100 }, uScan: { value: 0 }, uReal: { value: 0 }, uShaft: { value: 0 }, uShaftK: { value: 1 },
    uSweepMode: { value: 0 }, uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    cPaper: { value: srgb(0xf2efe7) }, cInk: { value: srgb(0x1d1c19) }, cPoche: { value: srgb(0x161513) }, cAccent: { value: srgb(0xd4501e) }, cSun: { value: srgb(0xffd9a8) },
  },
  vertexShader: FULL_VS,
  fragmentShader: `
    precision highp float;
    uniform sampler2D tND, tReal, tShaft; uniform vec2 res; uniform float uB; uniform mat4 uCamWorld; uniform vec4 uFr;
    uniform float dK, px, uDpr, uPoche, uLines, uEarth, uGrain, uScanX, uScan, uReal, uShaft, uShaftK, uSweepMode, uTime;
    uniform vec3 uSunDir, cPaper, cInk, cPoche, cAccent, cSun;
    varying vec2 vUv;
    vec4 nd(vec2 uv){ return texture2D(tND, uv); }
    vec3 nrm(vec4 t){ return vec3(t.xy, sqrt(max(0., 1. - dot(t.xy, t.xy)))); }
    float foot(float s){ return (uB + s) * (uFr.w - uFr.z) / res.y; }
    vec3 worldAt(vec2 uv, float s){ float z = uB + s; return (uCamWorld * vec4(mix(uFr.x, uFr.y, uv.x) * z, mix(uFr.z, uFr.w, uv.y) * z, -z, 1.)).xyz; }
    float bend(float a, float b, float c){ return (2. * c - a - b) + (c - a) * (c - a) / (uB + a) + (c - b) * (c - b) / (uB + b); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float hash3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
    bool isP(vec4 t){ return t.z > 0. && t.w > 4.5 && t.w < 6.5; }
    bool isL(vec4 t){ return abs(t.w - 6.) < .5; }
    vec3 edgeAt(vec2 uv, vec4 c){
      vec2 o = px / res;
      if (c.z <= 0.) {
        float s = 1e9, p = 0.; vec4 t;
        t = nd(uv + vec2(o.x, 0.)); if (t.z > 0.) { s = min(s, t.z); if (isP(t)) p = 1.; }
        t = nd(uv - vec2(o.x, 0.)); if (t.z > 0.) { s = min(s, t.z); if (isP(t)) p = 1.; }
        t = nd(uv + vec2(0., o.y)); if (t.z > 0.) { s = min(s, t.z); if (isP(t)) p = 1.; }
        t = nd(uv - vec2(0., o.y)); if (t.z > 0.) { s = min(s, t.z); if (isP(t)) p = 1.; }
        return s < 1e8 ? vec3(1., s, p) : vec3(0.);
      }
      vec3 nc = nrm(c); float e = 0., sMin = c.z, f = foot(c.z), p = isP(c) ? 1. : 0.;
      bool leafy = isL(c);
      for (int i = 0; i < 4; i++) {
        vec2 d = i == 0 ? vec2(o.x, 0.) : i == 1 ? vec2(0., o.y) : i == 2 ? o : vec2(o.x, -o.y);
        vec4 a = nd(uv + d), b = nd(uv - d);
        if (isP(a) || isP(b)) p = 1.;
        if (a.z <= 0. || b.z <= 0.) { e = 1.; continue; }
        sMin = min(sMin, min(a.z, b.z));
        bool inCrown = leafy && isL(a) && isL(b);
        float bd = abs(bend(a.z, b.z, c.z));
        e = max(e, inCrown ? smoothstep(.7, 1.4, bd) : smoothstep(dK, dK * 2., bd / f));
        if (!inCrown) { float dn = max(1. - dot(nc, nrm(a)), 1. - dot(nc, nrm(b))); e = max(e, smoothstep(.1, .28, dn)); }
      }
      return vec3(e, sMin, p);
    }
    void main(){
      vec4 c = nd(vUv);
      bool geo = c.z > 0.;
      vec3 cam = uCamWorld[3].xyz;
      vec3 rdir = normalize(worldAt(vUv, 1.) - cam);
      float tw = rdir.z < -.05 ? (-30. - cam.z) / rdir.z : 60.;
      vec3 wp = geo ? worldAt(vUv, c.z) : cam + rdir * clamp(tw, 10., 90.);
      float sw = geo ? .015 : 5.;
      float m = uReal > .5 ? 1. - smoothstep(uScanX - sw, uScanX + sw, wp.x) : 1.;
      vec3 E = edgeAt(vUv, c);
      vec3 dcol = cPaper;
      if (geo && c.w > 1.5 && c.w < 3.5) {
        float rank = clamp((c.w - 2.) / .9, 0., 1.);
        float p = clamp((uPoche - rank * .62) / .38, 0., 1.);
        float sp = 6. * uDpr, t = fract((gl_FragCoord.x - gl_FragCoord.y) / sp);
        float cov = mix(.14, 1.08, smoothstep(.15, 1., p));
        float fill = cov >= 1. ? 1. : 1. - smoothstep(cov - 1. / sp, cov, t);
        dcol = mix(cPaper, cPoche, fill * smoothstep(0., .08, p));
      } else if (geo && c.w > 3.5 && c.w < 4.5) {
        float sp = .31, k = (wp.x + wp.y) / sp;
        float dpx = abs(fract(k + .5) - .5) * sp * .7071 / foot(c.z);
        float a = clamp(.55 * uDpr + .5 - dpx, 0., 1.);
        float rev = smoothstep(-.5, 0., wp.y - mix(.8, -11., uEarth));
        dcol = mix(cPaper, cInk, a * .5 * rev);
      }
      dcol += (hash(floor(gl_FragCoord.xy / uDpr)) - .5) * .024 * uGrain;
      float ink = 0.;
      if (E.x > 0.) {
        float layer = max(0., -worldAt(vUv, E.y).z);
        float w = mix(1., .46, smoothstep(.4, 12., layer));
        float rv = 1. - smoothstep(uLines - 1.4, uLines, layer);
        ink = E.x * .93 * w * rv;
      }
      vec3 col = mix(dcol, cInk, ink);
      if (uReal > .5 && m < .999) {
        vec3 real = texture2D(tReal, vUv).rgb;
        if (uSweepMode > .5) {
          // crisper architectural contrast and warm gallery white balance
          real = pow(clamp(real * 1.04, 0., 1.), vec3(1.05));
        }
        if (uShaft > 0.) {
          vec3 rd = normalize(wp - cam); float mu = dot(rd, uSunDir), g = .55;
          float ph = (1. - g * g) / pow(1. + g * g - 2. * g * mu, 1.5) * .25;
          float shVal = texture2D(tShaft, vUv).r;
          float sc = shVal * (uSweepMode > .5 ? .135 : .11) * uShaft * uShaftK * (.4 + ph * .6);
          real += cSun * (1. - exp(-sc)) * (uSweepMode > .5 ? .48 : .42);
        }
        col = mix(real, col, m);
      }
      if (geo && uScan > 0.) {
        float fx = max(fwidth(wp.x), 1e-5), dx = abs(wp.x - uScanX) / fx;
        bool isPoche = c.w > 1.5 && c.w < 3.5;
        if (uSweepMode > 0.5 && uSweepMode < 1.5) {
          // Option 01 (Stencil & Laid): 3D laser construction grid + glowing orange edge + ink-to-material wave
          float band = 1.65;
          float u = (wp.x - (uScanX - 0.35)) / band;
          if (u > 0. && u < 1. && !isPoche) {
            float env = sin(u * 3.14159);
            float gx = 1. - smoothstep(0.0, 0.06, abs(fract(wp.x * 1.25) - 0.5));
            float gy = 1. - smoothstep(0.0, 0.06, abs(fract(wp.y * 1.25) - 0.5));
            float gz = 1. - smoothstep(0.0, 0.06, abs(fract(wp.z * 1.25) - 0.5));
            float grid = max(gx, max(gy, gz)) * env * 0.65;
            float edgeGlow = E.x * env * 0.92;
            col = mix(col, cAccent, clamp(max(grid, edgeGlow) + env * 0.14, 0., 1.) * uScan);
          }
          float line = clamp(1.8 * uDpr + .5 - dx, 0., 1.);
          col = mix(col, cAccent, line * uScan);
        } else if (uSweepMode > 1.5 && uSweepMode < 2.5) {
          // Option 02 (Swiss Monograph): X-Ray architectural cross-hatching wave
          float band = 1.8;
          float u = (wp.x - (uScanX - 0.5)) / band;
          if (u > 0. && u < 1. && !isPoche) {
            float env = sin(u * 3.14159);
            float h1 = 1. - smoothstep(0.0, 0.14, abs(fract((gl_FragCoord.x + gl_FragCoord.y) / (5.5 * uDpr)) - 0.5));
            float h2 = 1. - smoothstep(0.0, 0.14, abs(fract((gl_FragCoord.x - gl_FragCoord.y) / (5.5 * uDpr)) - 0.5));
            float hatch = max(h1, h2 * step(0.4, u)) * env * 0.55;
            vec3 xcol = mix(dcol, cAccent, max(hatch, E.x * 0.95));
            col = mix(col, xcol, env * 0.82 * uScan);
          }
          float line = clamp(2.0 * uDpr + .5 - dx, 0., 1.);
          col = mix(col, cAccent, line * uScan);
        } else if (uSweepMode > 2.5) {
          // Option 03 (CAD Terminal): Crisp laser cut plane with glowing orange wireframe & 1m elevation datum ticks
          float band = 1.15;
          float u = (wp.x - (uScanX - 0.15)) / band;
          if (u > 0. && u < 1. && !isPoche) {
            float env = sin(u * 3.14159);
            float contour = 1. - smoothstep(0.0, 0.035, abs(fract(wp.y) - 0.5));
            float wire = clamp(E.x * 0.95 + contour * 0.38, 0., 1.);
            col = mix(col, vec3(0.11, 0.11, 0.10), env * 0.16 * uScan);
            col = mix(col, cAccent, clamp(wire * env * 0.92 + env * 0.12, 0., 1.) * uScan);
          }
          float line = clamp(1.65 * uDpr + .5 - dx, 0., 1.);
          col = mix(col, cAccent, line * uScan);
        } else {
          float wash = uReal > .5 ? (1. - smoothstep(0., .4, wp.x - uScanX)) * step(uScanX, wp.x) * .16 : 0.;
          col = mix(col, cAccent, max(wash, clamp(1.2 * uDpr + .5 - dx, 0., 1.)) * uScan);
        }
      }
      gl_FragColor = vec4(col, 1.);
    }`,
};

export function createDrawing(renderer, pieces) {
  const scene = new THREE.Scene();
  const ndMat = ND_MAT();
  const parts = {};
  for (const part of ['behind', 'front', 'people']) {
    const mesh = new THREE.Mesh(mergePieces(pieces.filter((p) => p.part === part && !p.glass), { id: true }), ndMat);
    mesh.frustumCulled = false;
    scene.add(mesh); parts[part] = mesh;
  }
  parts.front.visible = false;
  const quad = (mat) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); m.frustumCulled = false; const s = new THREE.Scene(); s.add(m); return s; };
  const ink = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.clone(INK.uniforms), vertexShader: INK.vertexShader, fragmentShader: INK.fragmentShader, depthTest: false, depthWrite: false });
  const fxaa = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.clone(FXAAShader.uniforms), vertexShader: FULL_VS, fragmentShader: FXAAShader.fragmentShader, depthTest: false, depthWrite: false });
  const inkScene = quad(ink), fxaaScene = quad(fxaa);
  const flat = new THREE.Camera();
  let ndRT = null, inkRT = null;
  const size = new THREE.Vector2();

  function resize() {
    renderer.getDrawingBufferSize(size);
    ndRT?.dispose(); inkRT?.dispose();
    ndRT = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, generateMipmaps: false });
    inkRT = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, generateMipmaps: false });
    ink.uniforms.res.value.copy(size);
    fxaa.uniforms.resolution.value.set(1 / size.x, 1 / size.y);
    return size;
  }
  function renderND(cam) {
    ndMat.uniforms.uB.value = cam.near;
    renderer.setRenderTarget(ndRT); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
    renderer.setRenderTarget(null);
    return ndRT.texture;
  }
  function compose(cam, u) {
    const iu = ink.uniforms;
    iu.uB.value = cam.near;
    iu.uCamWorld.value.copy(cam.matrixWorld);
    iu.uFr.value.copy(cam.userData.fr);
    for (const k in u) if (iu[k]) iu[k].value = u[k];
    iu.tND.value = ndRT.texture;
    renderer.setRenderTarget(inkRT); renderer.render(inkScene, flat);
    fxaa.uniforms.tDiffuse.value = inkRT.texture;
    renderer.setRenderTarget(null); renderer.render(fxaaScene, flat);
  }
  return { resize, renderND, compose, parts, uniforms: ink.uniforms };
}
