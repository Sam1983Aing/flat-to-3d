// The lit house: the same pieces as the drawing, merged by material, a low sun, a few lamps, ambient occlusion
// on desktop. Rendered into a target (never to the screen): draw.js mixes it with the ink by the scan plane.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergePieces } from './house.js';

export const SUN_DIR = new THREE.Vector3(0.85, 0.44, 0.28).normalize();
const FULL_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';

export function createReal(renderer, look, pieces, cam, { ao = true, shadowSize = 4096 } = {}) {
  const scene = new THREE.Scene();
  scene.background = look.sky;
  // subtle atmospheric horizon fog so distant grass blends softly into the afternoon sky
  scene.fog = new THREE.FogExp2(0xe6d6be, 0.0045);
  const parts = { behind: new THREE.Group(), front: new THREE.Group(), people: new THREE.Group() };
  const buckets = {};
  for (const p of pieces) (buckets[p.part + '|' + p.mat] ||= []).push(p);
  for (const [k, list] of Object.entries(buckets)) {
    const [part, mat] = k.split('|');
    const m = look.M[mat] || look.M.conc;
    const mesh = new THREE.Mesh(mergePieces(list, { uv: true }), m);
    const glow = mat === 'shade' || mat === 'opal';
    mesh.castShadow = mat !== 'glass' && !glow;
    mesh.receiveShadow = !glow;
    if (mat === 'glass') mesh.userData.glass = true;
    parts[part].add(mesh);
  }
  scene.add(parts.behind, parts.front, parts.people);

  // light: a low warm sun, grazing specular fill light so surface bump textures catch reflections, and warm room lamps
  const target = new THREE.Vector3(11, 0, -2);
  const sun = new THREE.DirectionalLight(0xffd6a6, 4.1);
  sun.position.copy(target).addScaledVector(SUN_DIR, 90); sun.target.position.copy(target);
  sun.castShadow = true; sun.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 22, bottom: -18, near: 30, far: 160 });
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.025;
  const fillLight = new THREE.DirectionalLight(0xeef4fa, 0.85);
  fillLight.position.set(-18, 22, 28);
  scene.add(sun, sun.target, fillLight, new THREE.HemisphereLight(0xe4ebf0, 0xd2c4b0, 0.82), new THREE.AmbientLight(0xfff5e8, 0.2));
  for (const [x, y, z, i] of [
    [12.85, 1.58, -6.75, 2.8], [15.2, 2.1, -3.5, 2.4], [7.8, 1.72, -1.4, 5.2],
    [6.8, 4.8, -1.6, 2.8], [12.8, 5.0, -3.0, 4.4],
    [12.8, -2.25, -7.38, 2.2], [16.2, -2.25, -7.38, 2.2], [17.0, -1.72, -2.3, 1.8],
    [4.8, -2.6, -2.5, 5.2], [5.2, -1.72, -3.9, 2.2],
  ]) {
    const l = new THREE.PointLight(0xffc990, i, 0, 2); l.position.set(x, y, z); scene.add(l);
  }
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;

  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, rt);
  composer.renderToScreen = false;
  composer.addPass(new RenderPass(scene, cam));
  let gtao = null;
  if (ao) {
    gtao = new GTAOPass(scene, cam, 4, 4);
    gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.3, thickness: 1.0, scale: 1.2, samples: 8 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 8 });
    gtao.blendIntensity = 0.85;
    const r0 = gtao.render.bind(gtao);
    gtao.render = (...a) => { const hid = []; scene.traverse((m) => { if (m.userData.glass && m.visible) { m.visible = false; hid.push(m); } }); r0(...a); hid.forEach((m) => (m.visible = true)); };
    composer.addPass(gtao);
  }
  composer.addPass(new OutputPass());

  const sunCam = new THREE.OrthographicCamera(-24, 24, 20, -16, 30, 160);
  sunCam.position.copy(target).addScaledVector(SUN_DIR, 90); sunCam.lookAt(target); sunCam.updateMatrixWorld();
  const sunRT = new THREE.WebGLRenderTarget(1024, 1024, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const depthMat = new THREE.ShaderMaterial({ vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }', fragmentShader: 'void main(){ gl_FragColor = vec4(gl_FragCoord.z, 0., 0., 1.); }', side: THREE.DoubleSide });
  const sunMat = new THREE.Matrix4();
  function renderSunDepth() {
    const hid = []; scene.traverse((m) => { if (m.isMesh && (m.userData.glass || !m.castShadow) && m.visible) { m.visible = false; hid.push(m); } });
    const bg = scene.background; scene.background = null; scene.overrideMaterial = depthMat;
    renderer.setRenderTarget(sunRT); renderer.setClearColor(0xffffff, 1); renderer.clear(); renderer.render(scene, sunCam);
    scene.overrideMaterial = null; scene.background = bg; hid.forEach((m) => (m.visible = true));
    sunMat.multiplyMatrices(sunCam.projectionMatrix, sunCam.matrixWorldInverse);
  }

  const shaftMat = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { tND: { value: null }, tSun: { value: sunRT.texture }, uSunMat: { value: sunMat }, uCamWorld: { value: new THREE.Matrix4() }, uFr: { value: new THREE.Vector4() }, uB: { value: 0 },
      uBoxMin: { value: new THREE.Vector3(4.0, -3.2, -7.7) }, uBoxMax: { value: new THREE.Vector3(18.3, 7.6, 0) } },
    vertexShader: FULL_VS,
    fragmentShader: `precision highp float;
      uniform sampler2D tND, tSun; uniform mat4 uSunMat, uCamWorld; uniform vec4 uFr; uniform float uB; uniform vec3 uBoxMin, uBoxMax;
      varying vec2 vUv;
      float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }
      void main(){
        vec4 c = texture2D(tND, vUv);
        float z = c.z > 0. ? uB + c.z : 90.;
        vec3 ro = uCamWorld[3].xyz;
        vec3 pw = (uCamWorld * vec4(mix(uFr.x, uFr.y, vUv.x) * z, mix(uFr.z, uFr.w, vUv.y) * z, -z, 1.)).xyz;
        vec3 rd = pw - ro; float L = length(rd); rd /= L;
        vec3 inv = 1. / rd, t0 = (uBoxMin - ro) * inv, t1 = (uBoxMax - ro) * inv, lo = min(t0, t1), hi = max(t0, t1);
        float a = max(max(lo.x, lo.y), max(lo.z, 0.)), b = min(min(hi.x, hi.y), min(hi.z, L));
        if (b <= a) { gl_FragColor = vec4(0.); return; }
        const int N = 22; float dt = (b - a) / float(N), j = ign(gl_FragCoord.xy), acc = 0.;
        for (int i = 0; i < N; i++) {
          vec3 p = ro + rd * (a + (float(i) + j) * dt);
          vec4 s = uSunMat * vec4(p, 1.);
          vec3 q = s.xyz * .5 + .5;
          acc += step(q.z, texture2D(tSun, q.xy).r + .0015);
        }
        gl_FragColor = vec4(acc * dt, 0., 0., 1.);
      }`,
  });
  const shaftScene = new THREE.Scene(); const sq = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), shaftMat); sq.frustumCulled = false; shaftScene.add(sq);
  const flat = new THREE.Camera();
  const shaftRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });

  let shadowsDirty = true, sunDirty = true;
  function resize(w, h, scale) {
    composer.setPixelRatio(1);
    composer.setSize(Math.max(2, Math.round(w * scale)), Math.max(2, Math.round(h * scale)));
    shaftRT.setSize(Math.max(2, Math.round(w / 2)), Math.max(2, Math.round(h / 2)));
  }
  function setFront(v) { if (parts.front.visible !== v) { parts.front.visible = v; shadowsDirty = true; sunDirty = true; } }
  function render(ndTexture, inside) {
    if (sunDirty) { renderSunDepth(); sunDirty = false; }
    if (shadowsDirty) {
      renderer.shadowMap.needsUpdate = true;
      renderer.setRenderTarget(rt);
      renderer.render(scene, cam);
      renderer.setRenderTarget(null);
      shadowsDirty = false;
    }
    composer.render();
    const u = shaftMat.uniforms;
    u.tND.value = ndTexture; u.uB.value = cam.near; u.uCamWorld.value.copy(cam.matrixWorld); u.uFr.value.copy(cam.userData.fr);
    u.uBoxMax.value.z = inside ? 3.7 : 0;
    renderer.setRenderTarget(shaftRT); renderer.render(shaftScene, flat);
    renderer.setRenderTarget(null);
    return { color: composer.readBuffer.texture, shafts: shaftRT.texture };
  }
  return { scene, parts, sun, resize, render, setFront, gtao };
}
