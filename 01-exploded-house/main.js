import { renderer, scene, camera, ctx, camAt, applyCam, resize, Labels, clamp, lerp, ease, easeOut, win, DRAW } from './core.js';

const Q = new URLSearchParams(location.search);
const DIR = (Q.get('dir') || 'a').toLowerCase();
const FIXED = Q.has('p') ? parseFloat(Q.get('p')) : null;
const DRIVE = Q.has('drive');                         // a recorder sets time and scroll for every frame
const T_FIXED = Q.has('t') ? parseFloat(Q.get('t')) : (FIXED != null ? 99 : null);

await Promise.all([
  document.fonts.load('500 20px "IBM Plex Mono"'), document.fonts.load('600 20px "IBM Plex Mono"'),
  document.fonts.load('600 40px "Chakra Petch"'), document.fonts.load('700 20px "Chakra Petch"'),
]).catch(() => {});

resize();
const labels = new Labels();
const mod = await import(`./dir-${DIR}.js`);
const S = await mod.build(labels);

// ---- page chrome from the direction. Headline lines sit in masks so they can slide up.
const $ = id => document.getElementById(id);
const C = S.chrome;
const DWG_CODES = { a: 'AXO.04', b: 'ELEV.02', c: 'SEC.500' };
if ($('dwgBadge')) $('dwgBadge').textContent = C.dwg || DWG_CODES[DIR] || 'AXO.04';
document.querySelectorAll('#dirSwitch a').forEach(a => {
  a.classList.toggle('active', a.dataset.dir === DIR);
});
$('brand').textContent = C.brand; $('brandSub').textContent = C.brandSub;
$('nav').textContent = C.nav; $('cta').textContent = C.cta;
$('kicker').textContent = C.kicker; $('lede').textContent = C.lede;
$('h1').innerHTML = C.h1.split('<br>').map(l => `<span class="ln"><span>${l}</span></span>`).join('');
$('spec').innerHTML = (C.spec || []).map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
$('hint').textContent = C.hint;
document.title = C.title || document.title;
addEventListener('resize', resize);

// ---- interactive CAD mini-radar (#cad-map)
const cadMap = $('cad-map'), cmLbl = $('cm-lbl'), cmScale = $('cm-scale');
const cmSvg = $('cm-svg'), cmZonesG = $('cm-zones'), cmPlan = $('cm-plan'), cmCone = $('cm-cone'), cmDot = $('cm-dot'), cmStops = $('cm-stops');
let hoverTag = '';
if (S.radar && cadMap) {
  const R = S.radar;
  if (R.scale && cmScale) cmScale.textContent = R.scale;
  if (R.viewBox && cmSvg) cmSvg.setAttribute('viewBox', R.viewBox);
  if (R.plan && cmPlan) {
    cmPlan.setAttribute('d', R.plan);
    if (R.strokeW) cmPlan.setAttribute('stroke-width', String(R.strokeW));
  }
  if (R.dotR && cmDot) cmDot.setAttribute('r', String(R.dotR));
  if (R.coneW && cmCone) cmCone.setAttribute('stroke-width', String(R.coneW));
  if (R.zones && cmZonesG) {
    cmZonesG.innerHTML = R.zones.map(z =>
      `<rect class="cm-zone" data-stop="${z.stop}" data-p="${z.p}" data-tag="${z.tag}" x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}"/>`
    ).join('');
  }
  if (R.stops && cmStops) {
    cmStops.style.gridTemplateColumns = `repeat(${R.stops.length}, 1fr)`;
    cmStops.innerHTML = R.stops.map(s =>
      `<button type="button" class="cm-btn" data-stop="${s.stop}" data-p="${s.p}" data-tag="${s.tag}">${s.label}</button>`
    ).join('');
  }
}
function jumpToP(targetP, smooth = true) {
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  window.scrollTo({ top: clamp(targetP, 0, 1) * maxScroll, behavior: smooth ? 'smooth' : 'auto' });
}
window.__jumpTo = (stopOrP, smooth = true) => {
  if (typeof stopOrP === 'number') { jumpToP(stopOrP, smooth); return stopOrP; }
  const btn = document.querySelector(`#cad-map [data-stop="${stopOrP}"]`);
  if (btn) { const tp = parseFloat(btn.dataset.p); jumpToP(tp, smooth); return tp; }
  return null;
};
if (cadMap) {
  cadMap.querySelectorAll('[data-p]').forEach(el => {
    el.addEventListener('mouseenter', () => { hoverTag = el.dataset.tag || ''; });
    el.addEventListener('mouseleave', () => { hoverTag = ''; });
    el.addEventListener('click', e => { e.stopPropagation(); jumpToP(parseFloat(el.dataset.p)); });
  });
}

// ---- the plotter loader: black lifts, the sheet is plotted, then the page arrives
const D = S.draw;
DRAW.uDrawDir.value.set(D.dir[0], D.dir[1], D.dir[2], D.radial || 0);
DRAW.uDrawC.value.set(...(D.c || [0, 0, 0]));
DRAW.uDrawSoft.value = D.soft || 1.2;
const lines = [...document.querySelectorAll('#h1 .ln > span')];
function intro(T) {
  const sm = x => x * x * (3 - 2 * x);
  const plot = sm(win(T, 0.35, 3.0)), fill = sm(win(T, 0.8, 3.35));
  const span = D.max - D.min + 2;
  DRAW.uDraw.value = T > 3.6 ? 1e5 : D.min - 1 + plot * (span + DRAW.uDrawSoft.value);
  DRAW.uDrawFill.value = T > 3.6 ? 1e5 : D.min - 1 + fill * span;
  $('fade').style.opacity = 1 - win(T, 0, 0.7);
  const lo = 1 - win(T, 3.15, 3.55);
  $('loader').style.opacity = lo * win(T, 0.2, 0.5);
  $('ltext').textContent = `${C.loader} · ${String(Math.round(plot * 100)).padStart(3, '0')}%`;
  $('lbar').style.transform = `scaleX(${plot})`;
  const o = (a, d = 0.5) => win(T, a, a + d);
  if ($('cad-frame')) $('cad-frame').style.opacity = o(1.8, 0.7);
  document.querySelector('.top').style.opacity = o(2.2, 0.6);
  $('kicker').style.opacity = o(2.5);
  lines.forEach((l, i) => {
    const u = easeOut(win(T, 2.65 + i * 0.12, 3.45 + i * 0.12));
    l.style.transform = `translateY(${(1 - u) * 125}%)`;
    l.style.opacity = u > 0.005 ? '1' : '0';
  });
  $('lede').style.opacity = o(3.25); $('lede').style.transform = `translateY(${(1 - easeOut(o(3.25, 0.7))) * 14}px)`;
  $('spec').style.opacity = o(3.45);
  if (cadMap) {
    const cmOp = o(3.55, 0.55);
    cadMap.style.opacity = cmOp;
    cadMap.classList.toggle('interactive', cmOp > 0.25);
  }
  document.querySelector('.bottom').style.opacity = o(3.7);
  S.introHook?.(T);
  return (i) => o(3.0 + i * 0.11, 0.35);
}

let p = FIXED ?? 0, T = T_FIXED ?? 0, frames = 0;
const t0 = performance.now();
const target = () => clamp(scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight));
function step() {
  const st = S.update(p) || {};
  const lab = intro(T);
  labels.items.forEach((it, i) => { it.op *= lab(it.order ?? i); });
  const camState = camAt(S.keys, p);
  applyCam(camState, S.R);
  // fog is measured from the camera, which stands a kilometre off for the axo: keep it behind the model
  if (scene.fog) { const D = camera.userData.D; scene.fog.near = D + (S.fog?.[0] ?? 60); scene.fog.far = D + (S.fog?.[1] ?? 340); }
  labels.update(S.colX || (() => ctx.W * 0.7));
  const hero = $('hero'); const ho = st.hero ?? 1;
  hero.style.opacity = ho; hero.style.transform = `translateY(${(1 - ho) * -20}px)`;
  $('counter').innerHTML = st.counter || '';
  $('legend').innerHTML = st.legend || ''; $('legend').style.opacity = st.legendOp ?? 0;
  const hint = st.hint ?? C.hint;
  if ($('hint').textContent !== hint) $('hint').textContent = hint;
  const hw = document.querySelector('.hint-wrap');
  if (hw) hw.style.opacity = hint ? '1' : '0';
  const cr = $('camReadout');
  if (cr) {
    const fov = camState.fov;
    const mode = fov < 6 ? 'PARALLEL AXO' : fov < 28 ? 'TRANSITION' : 'EYE-LEVEL PERSP';
    const pct = String(Math.round(p * 100)).padStart(3, '0');
    cr.innerHTML = `PROJ <b>${mode}</b> (${fov.toFixed(1)}°) &nbsp;//&nbsp; SEQ <b>${pct}%</b>`;
  }
  if (cadMap) {
    const R = S.radar || {};
    const clampX = R.clampX || [-7.8, 7.8], clampZ = R.clampZ || [-3.8, 3.8];
    const isPersp = camState.fov >= 18;
    const cx = isPersp ? clamp(camera.position.x, clampX[0], clampX[1]) : (R.axoDot?.[0] ?? 6.5);
    const cz = isPersp ? clamp(camera.position.z, clampZ[0], clampZ[1]) : (R.axoDot?.[1] ?? 2.6);
    if (cmDot) { cmDot.setAttribute('cx', cx.toFixed(2)); cmDot.setAttribute('cy', cz.toFixed(2)); }
    if (cmCone) {
      const tx = camState.t[0], tz = camState.t[2];
      const ang = isPersp ? Math.atan2(tz - camera.position.z, tx - camera.position.x) : (R.axoAng ?? -2.35);
      const rad = R.coneLen ?? 3.2, sp = 0.42;
      const x1 = cx + Math.cos(ang - sp) * rad, z1 = cz + Math.sin(ang - sp) * rad;
      const x2 = cx + Math.cos(ang + sp) * rad, z2 = cz + Math.sin(ang + sp) * rad;
      cmCone.setAttribute('points', `${cx.toFixed(2)},${cz.toFixed(2)} ${x1.toFixed(2)},${z1.toFixed(2)} ${x2.toFixed(2)},${z2.toFixed(2)}`);
    }
    if (cmLbl) {
      cmLbl.textContent = hoverTag
        ? `JUMP // ${hoverTag}`
        : st.radarLbl || (isPersp
          ? `POS X:${camera.position.x.toFixed(1)} Y:${camera.position.y.toFixed(1)}M`
          : `AXO // ${String(Math.round(p * 100)).padStart(3, '0')}%`);
    }
    const activeStop = st.stop || '';
    cadMap.querySelectorAll('[data-stop]').forEach(el => {
      el.classList.toggle('active', el.dataset.stop === activeStop);
    });
  }
  const cap = $('caption'); cap.style.opacity = st.capOp || 0; if (st.cap && cap.dataset.k !== st.cap) { cap.dataset.k = st.cap; cap.innerHTML = st.cap; }
  renderer.render(scene, camera);
}
function frame() {
  if (FIXED == null) p += (target() - p) * 0.12;
  if (T_FIXED == null) T = (performance.now() - t0) / 1000;
  step();
  if (++frames === 3) window.__ready = true;
  requestAnimationFrame(frame);
}
window.__S = S;
window.__frame = (t, pp) => { T = t; p = pp; step(); return true; };
if (DRIVE) { step(); window.__ready = true; } else requestAnimationFrame(frame);

