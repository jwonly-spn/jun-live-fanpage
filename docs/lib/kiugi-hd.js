// 고해상도 캐릭터(2026-10-18 — DJ 키우기 새 그림체 R9, Codex 패키지 DJ_STYLE_20261018_REDO_R9 · 클로드_고해상도_작업지시.txt):
//  큰 화면(캐릭터 페이지 전신 무대 · 캐릭터 옷장의 "현재 모습" · 입혀 보기 무대 · 저장하기 그림)만 패키지 renderer-hd.js 의 DJStyleHDRenderer 로 다시 그린다.
//   카드·목록·동그라미 같은 작은 그림은 지금처럼 호환 그림(docs/kiugi/<판>/ 1024 PNG — kiugi-art.js SVG · lib/raster.js 사진)으로(휴대폰 자료를 아끼게).
//  규칙(Codex 지시 그대로):
//   · renderer.js · hair-color.js · renderer-hd.js 는 바이트 그대로(docs/kiugi-hd/02_클로드인계/ — 시험이 해시를 본다) 불러 쓴다(고치거나 옮겨 적지 않는다).
//   · 등록부(03_hd_assets/*_manifest.json)의 원본 그림을 그 rect(1024 논리 좌표)에 바로 그린다 — 작은 그림을 늘려 고해상도인 척하지 않는다(CSS 확대·샤프닝 없음).
//   · 캔버스 실제 픽셀 = 그 칸의 화면 크기(CSS px) × devicePixelRatio. 칸에 보이는 부분만(viewport) 그리고, 배율(scale)은 4 를 넘지 않는다.
//     renderer 에는 정수 배율(1~4)로 그리게 하고 그 캔버스를 화면 크기로 한 번 고품질 축소한다(renderScaleFor — 소수 배율에서 생기는 가로줄을 피한다).
//   · 호환 그림·마스크(03_png_assets·04_masks)는 사이트에 이미 있는 사본(docs/kiugi/<판>/ — 패키지와 바이트가 같다, 시험이 본다)을 그 등록 길에 이어 준다(renderer 의 bundle 표).
//     호환 SVG 가 이미 받아 둔 그림이라 같은 주소 = 브라우저 캐시 그대로.
//  깜박이지 않게: 호환 그림(SVG)을 먼저 그려 두고, 고해상도가 다 그려지면 같은 자리에 캔버스를 겹치고 SVG 를 숨긴다. 못 받거나 실패하면 호환 그림 그대로.
//  레벨 표정: renderer 의 표정은 normal·smile·cry 하나(입은 smile 일 때만 웃는 입). 레벨 9 "감동"(눈물 눈 + 웃는 입)은 입 번호를 '03_smile' 처럼
//   웃는 입 그림 id 로 넘긴다(renderer 가 번호를 그대로 id 에 붙인다 — 앱 kiugi-hd.js 와 같은 방법). 웃는 눈 + 기본 입처럼 그림이 없는 조합이면 호환 그림 그대로.
//  레벨 표정 겹치기(볼 발그레 · 둥실 하트)는 패키지 그림이 아니라 사이트가 그린다(kiugi-save.js 와 같은 자리·모양) — 볼 발그레는 renderer 의 onLayer('hem')
//   (몸·얼굴·옷을 다 그린 뒤, 앞머리·악세사리·모자 앞)에 그려 호환 그림과 같은 차례. 둥실 하트는 다 그린 뒤 맨 위.
//  배경 옷(장면)은 패키지에 없는 공통 배경이라 지금처럼 무대 뒤 SVG(svg.kg-scene)로.
//  데이터 절약 모드(Save-Data)면 무대는 호환 그림만(저장하기는 고해상도).
// DOM·캔버스는 함수 안에서만 쓴다(노드 시험에서 이 파일을 불러 상태·칸·주소 셈을 시험한다).
import { ART, expressionFor } from './kiugi-draw.js';
import { characterPlan, paintPlan, artUrl } from './kiugi-save.js';
import { normalizeLook } from '../kiugi/kiugi-look.js';
import { resolveLook, faceVariants, ACCESSORY_ORDER, SIZE } from '../kiugi/kiugi-art.js';

export const HD_DIR = 'kiugi-hd/';
export const HD_MAX_SCALE = 4;
// 한 번에 그리는 캔버스의 최대 픽셀(휴대폰 메모리 — renderer 가 같은 크기 칸을 여러 장 만든다): 2048 × 2048
export const HD_MAX_PIXELS = 2048 * 2048;
// 칸 크기가 이만큼(비율) 바뀌면 다시 그린다(돌리기·창 크기)
export const HD_RESIZE = 0.12;
// 패키지 assets.json 의 마스크 칸 → 사이트 그림 목록(ART)의 마스크 이름
export const MASK_KEYS = Object.freeze({ bodyCutoutMask: 'cut', shoeOcclusionMask: 'hem', hairCutoutMask: 'hair', defaultFootwearMask: 'feet' });
const root = (base) => (String(base).endsWith('/') ? base : base + '/');

// ── 상태(노드 시험) ──
// 레벨 표정(시즌 목록 parts) → {expression(renderer 표정), mouthSmile(입 번호에 _smile 을 붙일지)} · 그림이 없는 조합이면 null
//  renderer: 눈 = expression, 입은 expression 이 smile 일 때만 웃는 입.
export function hdExpression(expression) {
  const V = faceVariants(expression);
  if (V.eyes === 'smile') return V.mouth === 'smile' ? { expression: 'smile', mouthSmile: false } : null;
  return { expression: V.eyes === 'cry' ? 'cry' : 'normal', mouthSmile: V.mouth === 'smile' };
}
// DJ 캐릭터 + 입은 옷({worn}) + 레벨 표정 → renderer 상태(배경 빼고) · 만들 수 없으면 null.
//  옷은 kiugi-art.js resolveLook 그대로(한벌옷이면 상의·하의 없음 · 칸과 맞지 않는 옷·예전 그림 id 는 없음) · 악세사리는 겹치는 차례(목 → 손 → 얼굴 → 머리)대로.
//  눈물 눈 + 웃는 입(레벨 9)은 mouth 를 '03_smile' 글자로(renderer 의 id `<몸>_mouth_${pad(mouth)}` → female_mouth_03_smile — 패키지에 있는 그림·원본).
export function hdState(dj = {}, look = {}, expression = null) {
  const L = normalizeLook(dj), g = L.gender, R = resolveLook(look, g), ex = hdExpression(expression);
  if (!ex) return null;
  const n = (a) => (a ? a.number : null), mouth = ex.mouthSmile ? `${String(L.mouth).padStart(2, '0')}_smile` : Number(L.mouth);
  return {
    body: g === 'm' ? 'male' : 'female', hair: Number(L.hair), hairColor: L.hairColor, eyes: Number(L.eyes), nose: Number(L.nose), mouth, expression: ex.expression,
    outfit: n(R.outfit), top: n(R.top), bottom: n(R.bottom), shoe: n(R.shoe), hat: n(R.hat), accessory: ACCESSORY_ORDER.map((s) => n(R.acc[s])).filter((x) => x !== null),
  };
}
// 칸에 보이는 부분 → {viewport:[x, y, w, h](1024 논리 좌표, 정수), scale} · 보이는 곳이 없으면 null
//  stageRect: 무대 칸(넘치는 곳은 잘린다) · artRect: 1024 캔버스 전체가 놓인 칸(호환 SVG — 여자 0.91 배 줄이기 같은 변형까지 든 화면 크기)
export function hdFit(stageRect, artRect, dpr = 1, { maxScale = HD_MAX_SCALE, maxPixels = HD_MAX_PIXELS, pad = 2 } = {}) {
  if (!stageRect || !artRect || !(artRect.width > 0) || !(artRect.height > 0)) return null;
  const kx = SIZE / artRect.width, ky = SIZE / artRect.height, clamp = (v) => Math.max(0, Math.min(SIZE, v));
  const x0 = clamp(Math.floor((stageRect.left - artRect.left) * kx) - pad), x1 = clamp(Math.ceil((stageRect.right - artRect.left) * kx) + pad);
  const y0 = clamp(Math.floor((stageRect.top - artRect.top) * ky) - pad), y1 = clamp(Math.ceil((stageRect.bottom - artRect.top) * ky) + pad);
  const w = x1 - x0, h = y1 - y0;
  if (w <= 0 || h <= 0) return null;
  let scale = Math.min(maxScale, (artRect.width / SIZE) * Math.max(1, Number(dpr) || 1));
  if (w * h * scale * scale > maxPixels) scale = Math.sqrt(maxPixels / (w * h));
  scale = Math.floor(scale * 1000) / 1000;
  return scale > 0 ? { viewport: [x0, y0, w, h], scale } : null;
}
// renderer 의 bundle 표 ①: 패키지 assets.json 의 호환 그림·마스크 길 → 사이트 사본 주소(docs/kiugi/<판>/ — 그림 목록 ART 의 같은 id 그림·마스크)
export function compatBundle(manifest, art = ART, base = '/') {
  const byId = new Map((art?.assets || []).map((a) => [a.id, a])), out = {};
  for (const a of manifest?.assets || []) {
    const r = byId.get(a.id);
    if (!r) continue;
    out[a.path] = artUrl(r, base);
    for (const [k, short] of Object.entries(MASK_KEYS)) if (a[k] && r[short]) out[a[k]] = artUrl(r[short], base);
  }
  return out;
}
// renderer 의 bundle 표 ②: 등록부의 원본 그림 길 → docs/kiugi-hd/<같은 길>?v=<그 그림 sha256 앞 12자>(그림이 바뀌면 주소도 바뀐다)
export function hdBundle(hd, dir) {
  const out = {};
  (function walk(o) {
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (!o || typeof o !== 'object') return;
    if (typeof o.path === 'string' && /^03_(hd_assets|제작기록)\//.test(o.path)) out[o.path] = `${dir}${encodeURI(o.path)}${/^[0-9a-f]{64}$/.test(o.sha256 || '') ? `?v=${o.sha256.slice(0, 12)}` : ''}`;
    for (const [k, v] of Object.entries(o)) if (k !== 'path') walk(v);
  })(hd);
  return out;
}
// 레벨 표정 겹치기(kiugi-save.js characterPlan 의 볼 발그레 · 둥실 하트 — 호환 그림·저장하기와 같은 자리·모양) → {blush:[op], hearts:[op]}
export function overlayOps(dj = {}, look = {}, expression = null) {
  const ops = characterPlan(dj || {}, look || {}, expression).ops;
  return { blush: ops.filter((o) => o.kind === 'blush'), hearts: ops.filter((o) => o.kind === 'hearts') };
}
// 캔버스 ctx 에 1024 좌표 그대로(viewport·scale 변환) 겹치기 그림을 그린다(그림 파일이 필요 없는 것만 — 볼 발그레 · 둥실 하트)
function paintOverlay(ctx, ops, v, s) {
  if (!ops.length) return;
  ctx.save();
  ctx.setTransform(s, 0, 0, s, -v[0] * s, -v[1] * s);
  ctx.globalCompositeOperation = 'source-over';
  paintPlan(ctx, ops, { get: () => null, layer: () => ctx });
  ctx.restore();
}

// ── 불러오기(브라우저) ──
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
export const freeCanvas = (c) => { try { if (c) { c.width = 0; c.height = 0; } } catch { /* 무시 */ } };
const script = (src) => new Promise((resolve, reject) => {
  const s = document.createElement('script');
  s.src = src; s.async = false;
  s.onload = () => resolve(); s.onerror = () => reject(Error('고해상도 그리는 코드를 받지 못했어요: ' + src));
  document.head.append(s);
});
const getJson = async (url) => { const r = await fetch(url); if (!r.ok) throw Error('고해상도 목록을 받지 못했어요: ' + url); return r.json(); };
let hdJob = null;
// → DJStyleHDRenderer(한 번만 만든다 — 받은 그림은 renderer 가 기억한다). 사이트 그림 목록(ART)과 다른 패키지면 쓰지 않는다(호환 그림 그대로).
export function loadHd(base = '/') {
  return hdJob ||= (async () => {
    const dir = root(base) + HD_DIR;
    const index = await fetch(dir + 'index.json', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw Error('고해상도 목록이 없어요'); return r.json(); });
    if (index?.packageId !== ART.packageId) throw Error(`고해상도 그림(${index?.packageId})과 사이트 그림(${ART.packageId})의 패키지가 달라요`);
    const url = (e) => `${dir}${encodeURI(e.path)}?v=${e.v}`;
    if (typeof window.DJStyleHDRenderer !== 'function') for (const k of ['hairColor', 'renderer', 'rendererHd']) await script(url(index.code[k]));
    const keys = Object.keys(index.manifests || {});
    const [manifest, ...lists] = await Promise.all([getJson(url(index.code.assets)), ...keys.map((k) => getJson(url(index.manifests[k])))]);
    if (manifest.packageId !== ART.packageId) throw Error('고해상도 assets.json 의 패키지가 달라요');
    const hd = Object.fromEntries(keys.map((k, i) => [k, lists[i]?.assets || {}]));
    const bundle = { ...hdBundle(hd, dir), ...compatBundle(manifest, ART, base) };
    return new window.DJStyleHDRenderer(manifest, dir, bundle, hd);
  })().catch((e) => { hdJob = null; throw e; });
}
// 한 번에 하나씩 그린다(휴대폰 메모리 — 무대 둘이 한꺼번에 그리지 않게)
let chain = Promise.resolve();
const queued = (fn) => { const job = chain.then(fn, fn); chain = job.catch(() => {}); return job; };

// renderer 에 넘길 배율: 정수(1~4)로 그린 뒤 화면 크기로 줄인다(Codex 예제처럼 — 원본 → 정수 배율 합성 → 표시 크기로 고품질 축소).
//  소수 배율로 바로 그리면 renderer 안의 자르기 칸(예: 상의 복원 y 240)이 픽셀 사이에 걸려 옷 위에 옅은 가로줄이 생겼다(2026-10-18 휴대폰 화면에서 확인).
//  정수 배율이 픽셀 한도(HD_MAX_PIXELS)를 넘으면 원하는 배율 그대로(늘리지는 않는다).
export function renderScaleFor(viewport, scale, { maxScale = HD_MAX_SCALE, maxPixels = HD_MAX_PIXELS } = {}) {
  const want = Math.min(maxScale, scale), up = Math.min(maxScale, Math.ceil(want - 1e-9));
  return viewport[2] * viewport[3] * up * up <= maxPixels ? up : want;
}
// 고해상도 캐릭터 한 장 → {canvas(viewport 크기 × scale — 실제 픽셀), result(renderer 가 알려 준 것), renderScale} · 그릴 수 없는 모습이면 null
export async function renderHdCharacter({ dj, look, expression = null, viewport, scale, base = '/' }) {
  const state = hdState(dj, look, expression);
  if (!state) return null;
  const renderer = await loadHd(base);
  return queued(async () => {
    const rs = renderScaleFor(viewport, scale), work = document.createElement('canvas'), over = overlayOps(dj, look, expression);
    // 볼 발그레: renderer 가 몸·얼굴·옷을 다 그린 칸(onLayer 'hem' — 앞머리·악세사리·모자를 얹기 전)에 · 둥실 하트: 다 그린 뒤 맨 위
    const onLayer = (label, body) => { if (label === 'hem' && over.blush.length) paintOverlay(body.getContext('2d'), over.blush, viewport, rs); };
    const result = await renderer.render(work, state, { viewport, scale: rs, onLayer });
    paintOverlay(work.getContext('2d'), over.hearts, viewport, rs);
    const w = Math.max(1, Math.round(viewport[2] * Math.min(HD_MAX_SCALE, scale))), h = Math.max(1, Math.round(viewport[3] * Math.min(HD_MAX_SCALE, scale)));
    if (work.width === w && work.height === h) return { canvas: work, result, state, renderScale: rs };
    const canvas = canvasOf(w, h), x = canvas.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(work, 0, 0, w, h);
    freeCanvas(work);
    return { canvas, result, state, renderScale: rs };
  });
}

// ── 무대 올리기(브라우저) ──
const saveData = () => { try { return navigator.connection?.saveData === true; } catch { return false; } };
const pct = (n) => `${((n / SIZE) * 100).toFixed(4)}%`;
// 호환 그림(SVG)이 다 그려진 무대(.kg-stage > .kg-actor > .kg-body > svg)에 고해상도 캔버스를 겹친다.
//  opts = {character(DJ 캐릭터), worn(입은 옷), level, catalog, seasonId, base, force(데이터 절약 모드여도)}
//  같은 무대에 다시 부르면(입혀 보기 — 옷을 바꿀 때마다) 앞 것은 버린다. 칸 크기가 바뀌면(돌리기·창 크기) 다시 그린다.
export function upgradeStage(stage, opts = {}) {
  if (!stage || !opts.character || typeof document === 'undefined') return;
  const seq = (stage.kgHdSeq || 0) + 1;
  stage.kgHdSeq = seq;
  if (saveData() && !opts.force) { stage.dataset.kgHd = 'save-data'; return; }
  const look = { worn: opts.worn && typeof opts.worn === 'object' ? opts.worn : {} };
  const expression = opts.expression || expressionFor(opts.catalog, opts.seasonId, Number(opts.level) || 1);
  if (!hdState(opts.character, look, expression)) { stage.dataset.kgHd = 'compat'; return; }
  let fitted = null;
  const run = async () => {
    const svg = stage.querySelector(':scope > .kg-actor > .kg-body > svg');
    if (!svg || stage.kgHdSeq !== seq) return;
    const art = svg.getBoundingClientRect(), fit = hdFit(stage.getBoundingClientRect(), art, window.devicePixelRatio || 1);
    if (!fit) return;
    fitted = { width: art.width, dpr: window.devicePixelRatio || 1 };
    stage.dataset.kgHd = 'loading';
    let out = null;
    try { out = await renderHdCharacter({ dj: opts.character, look, expression, ...fit, base: opts.base || '/' }); }
    catch (e) { if (stage.kgHdSeq === seq) { stage.dataset.kgHd = 'fail'; console.warn('고해상도 그림을 그리지 못해 호환 그림으로 보여요:', e?.message || e); } return; }
    if (!out || stage.kgHdSeq !== seq || !svg.isConnected) { freeCanvas(out?.canvas); return; }
    const c = out.canvas, [x, y, w, h] = fit.viewport;
    c.className = 'kg-hd';
    c.setAttribute('aria-hidden', 'true');
    // 자리(1024 캔버스 칸 안의 퍼센트 — 보안 규칙상 style 속성 대신 CSSOM)
    c.style.left = pct(x); c.style.top = pct(y); c.style.width = pct(w); c.style.height = pct(h);
    const old = svg.parentNode.querySelectorAll(':scope > canvas.kg-hd');
    svg.after(c);
    for (const o of old) { o.remove(); freeCanvas(o); }
    svg.closest('.kg-actor')?.classList.add('is-hd');
    stage.dataset.kgHd = 'on';
    stage.dataset.kgHdScale = String(fit.scale);
    stage.dataset.kgHdRender = String(out.renderScale);
  };
  run();
  // 칸 크기가 바뀌면 다시(조금 기다렸다가 한 번)
  stage.kgHdObserver?.disconnect();
  if (typeof ResizeObserver === 'function') {
    let timer = 0;
    const ro = new ResizeObserver(() => {
      if (stage.kgHdSeq !== seq || !stage.isConnected) { ro.disconnect(); return; }
      clearTimeout(timer);
      timer = setTimeout(() => {
        const svg = stage.querySelector(':scope > .kg-actor > .kg-body > svg');
        if (!svg || !fitted) return;
        const wNow = svg.getBoundingClientRect().width, dpr = window.devicePixelRatio || 1;
        if (Math.abs(wNow - fitted.width) / Math.max(1, fitted.width) > HD_RESIZE || dpr !== fitted.dpr) run();
      }, 300);
    });
    ro.observe(stage);
    // 무대는 그대로인데 캐릭터 칸만 바뀌는 때(입혀 보기에서 칭호를 달면 캐릭터 칸이 작아진다)도
    const svg0 = stage.querySelector(':scope > .kg-actor > .kg-body > svg');
    if (svg0) ro.observe(svg0);
    stage.kgHdObserver = ro;
  }
}
