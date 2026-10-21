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
//  깜박이지 않게: 호환 그림(SVG)을 그려 두고, 고해상도가 다 그려지면 같은 자리에 캔버스를 겹치고 SVG 를 숨긴다. 못 받거나 실패하면 호환 그림 그대로.
//   2026-10-19: R9 웃는 눈이 호환 그림(감은 눈)과 고해상도(뜬 눈)에서 달라 바뀌는 순간 눈을 깜빡이는 것처럼 보였다 → 큰 무대는 새 캐릭터를 숨긴 채 이 함수로
//   고해상도를 그린 뒤 보인다(views/cards.js paintHdStage — onState 로 알린다, 늦으면 호환 그림을 보이고 고해상도는 살며시 겹친다).
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
// 휴대폰(손가락 화면)은 더 작게(2026-10-21 — 아이폰 사파리에서 입혀 보기 옷을 몇 번 누르면 "문제가 반복적으로 발생"으로 페이지가 죽었다:
//  한 번 그릴 때마다 renderer 가 무대 크기 캔버스를 9장쯤 새로 만들고, 다 쓴 캔버스와 받아 둔 그림을 사파리가 바로 놓지 않아 쌓였다).
//  이 한도를 넘는 정수 배율이면 소수 배율 대신 한 단계 낮은 정수 배율로 그린다(renderScaleFor floor — 가로줄 없이 메모리를 아낀다).
export const HD_MOBILE_PIXELS = 1800 * 1800;
// 받아 둔 그림 기억 한도(장 수 — 지금 모습에 쓰는 그림은 빼고 센다) · 머리색 입힌 그림·신발 목 자르기 칸(1024² 캔버스) 기억 한도
export const HD_IMAGE_KEEP = { mobile: 12, desktop: 80 }, HD_CANVAS_KEEP = { mobile: 3, desktop: 8 };
export const isCoarse = () => { try { return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches; } catch { return false; } };
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
//  floor: 넘으면 한 단계 낮은 정수 배율(1 아래로는 내리지 않는다 — 휴대폰: 메모리를 아끼고 가로줄도 없게)
export function renderScaleFor(viewport, scale, { maxScale = HD_MAX_SCALE, maxPixels = HD_MAX_PIXELS, floor = false } = {}) {
  const want = Math.min(maxScale, scale), up = Math.min(maxScale, Math.ceil(want - 1e-9));
  if (viewport[2] * viewport[3] * up * up <= maxPixels) return up;
  return floor ? Math.max(1, Math.floor(want + 1e-9)) : want;
}
// 다 그린 뒤 정리(휴대폰 메모리): ① 그리는 동안 renderer 가 만든 무대 크기 캔버스(겹 칸)를 바로 비운다(사파리는 버린 캔버스를 늦게 놓는다)
//  ② 받아 둔 그림이 한도를 넘으면 지금 모습에 쓰지 않는 오래된 것부터 놓는다 ③ 머리색 입힌 그림·신발 목 자르기 칸도 한도를 넘으면 오래된 것부터 비운다.
//  renderer 코드는 고치지 않는다(바이트 그대로) — 기억 표(Map)에서 빼기만 하고, 다음에 필요하면 renderer 가 다시 받는다(브라우저 캐시).
const cachedCanvases = (renderer) => new Set([renderer.nativeTint, renderer.tintCache, renderer.shaftClipCache].flatMap((m) => (m instanceof Map ? [...m.values()] : [])));
export function freeScratch(made, keep = [], renderer = {}) {
  const held = cachedCanvases(renderer), skip = new Set(keep);
  let n = 0;
  for (const c of made) if (c && !skip.has(c) && !held.has(c) && !c.isConnected && c.width * c.height > 0) { freeCanvas(c); n++; }
  return n;
}
export function trimCaches(renderer, keepPaths = [], { images = HD_IMAGE_KEEP.desktop, canvases = HD_CANVAS_KEEP.desktop } = {}) {
  const keep = new Set(keepPaths);
  const cache = renderer?.cache;
  if (cache instanceof Map) {
    let extra = [...cache.keys()].filter((k) => !keep.has(k)).length;
    for (const [k, p] of [...cache]) {
      if (extra <= images) break;
      if (keep.has(k)) continue;
      cache.delete(k); extra--;
      Promise.resolve(p).then((im) => { try { if (im && typeof im === 'object' && 'src' in im) im.src = ''; } catch { /* 무시 */ } }, () => {});
    }
  }
  for (const m of [renderer?.nativeTint, renderer?.tintCache, renderer?.shaftClipCache]) {
    if (!(m instanceof Map)) continue;
    for (const [k, c] of [...m]) { if (m.size <= canvases) break; m.delete(k); freeCanvas(c); }
  }
}
// 미리 받기(2026-10-19 — 눈 깜빡임 고침): renderer 는 그림을 하나씩 차례로(await) 받아 휴대폰에서는 처음 그리기가 몇 초 걸린다(그동안 호환 그림이 보인다).
//  이 모습에 쓸 수 있는 그림 길(등록부의 path · 호환 그림·마스크)을 미리 모아 renderer.image() 로 한꺼번에 받기 시작한다 — renderer 가 같은 길을 같은 약속(캐시)으로 쓴다.
//  renderer 코드는 고치지 않는다(바이트 그대로). 'source'(제작 기록 원본)는 그리는 데 쓰지 않아 받지 않는다. 쓰지 않을 수도 있는 그림(옷의 다른 짝 마스크 등)도 조금 섞인다.
const MASK_FIELDS = ['bodyCutoutMask', 'shoeOcclusionMask', 'hairCutoutMask', 'defaultFootwearMask'];
export function hdWarmPaths(hd = {}, byId = new Map(), state = {}) {
  const out = new Set(), pad = (n) => String(n).padStart(2, '0'), g = state.body === 'male' ? 'male' : 'female';
  const take = (o) => {
    (function walk(x) {
      if (Array.isArray(x)) { x.forEach(walk); return; }
      if (!x || typeof x !== 'object') return;
      for (const [k, v] of Object.entries(x)) {
        if ((k === 'path' || k === 'compatibilityPath') && typeof v === 'string' && /^03_/.test(v)) out.add(v);
        else if (v && typeof v === 'object') walk(v);
      }
    })(o);
  };
  const compat = (id) => { const a = byId.get?.(id); if (!a) return; if (typeof a.path === 'string') out.add(a.path); for (const m of MASK_FIELDS) if (typeof a[m] === 'string') out.add(a[m]); };
  for (const layer of ['front', 'back']) { const id = `${g}_hair_${pad(state.hair)}_${layer}`; take(hd.hair?.[id]); compat(id); }
  take(hd.face?.[g]); take(hd.defaultBody?.[g]); take(hd.lowerBody?.[g]); take(hd.lowerLeg?.[g]); compat(`${g}_body`);
  const ex = state.expression || 'normal';
  const ids = [`${g}_eyes_${pad(state.eyes)}${ex === 'normal' ? '' : '_' + ex}`, `${g}_nose_${pad(state.nose)}`,
    typeof state.mouth === 'string' ? `${g}_mouth_${state.mouth}` : `${g}_mouth_${pad(state.mouth)}${ex === 'smile' ? '_smile' : ''}`];
  for (const id of ids) { take(hd.features?.[id]); compat(id); }
  const worn = [['outfit', state.outfit], ['top', state.top], ['bottom', state.bottom], ['shoe', state.shoe], ['hat', state.hat], ...(state.accessory || []).map((n) => ['accessory', n])];
  for (const [kind, n] of worn) if (n !== null && n !== undefined) { const id = `${kind}_${pad(n)}_${g}`; take(hd.wardrobe?.[id]); compat(id); }
  return [...out];
}
function warmHd(renderer, state) {
  try { for (const p of hdWarmPaths(renderer.hd || {}, renderer.byId || new Map(), state)) renderer.image(p).catch(() => {}); } catch { /* 미리 받기는 덤 */ }
}

// 고해상도 캐릭터 한 장 → {canvas(viewport 크기 × scale — 실제 픽셀), result(renderer 가 알려 준 것), renderScale} · 그릴 수 없는 모습이면 null
//  hearts: false 면 둥실 하트를 빼고 그린다(캐릭터 페이지 상반신·얼굴 보기 — 머리 위·옆 하트가 칸 가장자리에 잘려 보여서, 그때는 무대 칸 안에 따로 띄운다 · views/character.js)
export async function renderHdCharacter({ dj, look, expression = null, viewport, scale, base = '/', hearts = true }) {
  const state = hdState(dj, look, expression);
  if (!state) return null;
  const renderer = await loadHd(base);
  warmHd(renderer, state);
  return queued(async () => {
    const mobile = isCoarse();
    const rs = renderScaleFor(viewport, scale, mobile ? { maxPixels: HD_MOBILE_PIXELS, floor: true } : {}), work = document.createElement('canvas'), over = overlayOps(dj, look, expression);
    // 볼 발그레: renderer 가 몸·얼굴·옷을 다 그린 칸(onLayer 'hem' — 앞머리·악세사리·모자를 얹기 전)에 · 둥실 하트: 다 그린 뒤 맨 위
    const onLayer = (label, body) => { if (label === 'hem' && over.blush.length) paintOverlay(body.getContext('2d'), over.blush, viewport, rs); };
    // 그리는 동안 renderer 가 만드는 캔버스를 모아 두었다가(겹 칸 크기 — 다른 화면 코드의 캔버스는 크기가 달라 건드리지 않는다) 다 그리면 바로 비운다
    const made = [], orig = document.createElement, own = Object.prototype.hasOwnProperty.call(document, 'createElement');
    const lw = Math.round(viewport[2] * rs), lh = Math.round(viewport[3] * rs);
    document.createElement = function (tag, ...rest) { const el = orig.call(this, tag, ...rest); if (String(tag).toLowerCase() === 'canvas') made.push(el); return el; };
    let result;
    try { result = await renderer.render(work, state, { viewport, scale: rs, onLayer }); }
    finally {
      if (own) document.createElement = orig; else delete document.createElement;
      freeScratch(made.filter((c) => c.width === lw && c.height === lh), [work], renderer);
      try { trimCaches(renderer, hdWarmPaths(renderer.hd || {}, renderer.byId || new Map(), state), mobile ? { images: HD_IMAGE_KEEP.mobile, canvases: HD_CANVAS_KEEP.mobile } : {}); } catch { /* 정리는 덤 */ }
    }
    if (hearts !== false) paintOverlay(work.getContext('2d'), over.hearts, viewport, rs);
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
//  opts = {character(DJ 캐릭터), worn(입은 옷), level, exp(고른 표정), expression(주면 그대로), catalog, seasonId, base, force(데이터 절약 모드여도),
//          actor(그릴 캐릭터 칸 — 없으면 무대의 마지막 캐릭터 칸: 다시 그릴 때 새 칸을 옛 칸 위에 얹어 두기 때문),
//          onState(state) — 첫 결과를 한 번 알린다: 'on'(고해상도) · 'compat'(그림이 없는 조합) · 'save-data' · 'fail' · 'hidden'(칸이 보이지 않음)}
//  같은 무대에 다시 부르면(입혀 보기 — 옷을 바꿀 때마다) 앞 것은 버린다. 칸 크기가 바뀌면(돌리기·창 크기·보기 바꾸기) 다시 그린다(stage.kgHdRun() 으로 바로도).
export function upgradeStage(stage, opts = {}) {
  if (!stage || !opts.character || typeof document === 'undefined') return;
  const seq = (stage.kgHdSeq || 0) + 1;
  stage.kgHdSeq = seq;
  let told = false;
  const tell = (state) => { if (told) return; told = true; try { opts.onState?.(state); } catch (e) { console.error(e); } };
  if (saveData() && !opts.force) { stage.dataset.kgHd = 'save-data'; tell('save-data'); return; }
  const look = { worn: opts.worn && typeof opts.worn === 'object' ? opts.worn : {} };
  const expression = opts.expression || expressionFor(opts.catalog, opts.seasonId, Number(opts.level) || 1, opts.exp ?? null);
  if (!hdState(opts.character, look, expression)) { stage.dataset.kgHd = 'compat'; tell('compat'); return; }
  const actorOf = () => (opts.actor?.isConnected ? opts.actor : [...stage.querySelectorAll(':scope > .kg-actor')].at(-1) || null);
  let fitted = null, tries = 0;
  const run = async () => {
    const svg = actorOf()?.querySelector(':scope > .kg-body > svg');
    if (!svg || stage.kgHdSeq !== seq) return;
    const art = svg.getBoundingClientRect(), fit = hdFit(stage.getBoundingClientRect(), art, window.devicePixelRatio || 1, isCoarse() ? { maxPixels: HD_MOBILE_PIXELS } : {});
    // 아직 화면에 붙기 전이면(칸 크기 0) 몇 번 더 기다려 본다 — 그래도 안 보이는 칸(좁은 화면에서 숨긴 칸 등)이면 호환 그림으로 알린다
    if (!fit) { if (!fitted && tries++ < 3 && typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(run)); else tell('hidden'); return; }
    fitted = { width: art.width, dpr: window.devicePixelRatio || 1 };
    stage.dataset.kgHd = 'loading';
    let out = null;
    // 크게 보는 중(캐릭터 페이지 상반신·얼굴)이면 둥실 하트를 빼고 그린다(칸 가장자리에 잘려 보이지 않게 — 그때 하트는 views/character.js 가 칸 안에 따로)
    const zoomed = typeof stage.matches === 'function' && stage.matches('.view-upper, .view-face');
    try { out = await renderHdCharacter({ dj: opts.character, look, expression, ...fit, base: opts.base || '/', hearts: !zoomed }); }
    catch (e) { if (stage.kgHdSeq === seq) { stage.dataset.kgHd = 'fail'; tell('fail'); console.warn('고해상도 그림을 그리지 못해 호환 그림으로 보여요:', e?.message || e); } return; }
    if (!out || stage.kgHdSeq !== seq || !svg.isConnected) { freeCanvas(out?.canvas); return; }
    const c = out.canvas, [x, y, w, h] = fit.viewport;
    c.className = 'kg-hd';
    c.setAttribute('aria-hidden', 'true');
    // 자리(1024 캔버스 칸 안의 퍼센트 — 보안 규칙상 style 속성 대신 CSSOM)
    c.style.left = pct(x); c.style.top = pct(y); c.style.width = pct(w); c.style.height = pct(h);
    const old = svg.parentNode.querySelectorAll(':scope > canvas.kg-hd');
    const actor = svg.closest('.kg-actor');
    // 이미 보이는 캐릭터에 고해상도를 처음 얹을 때(호환 그림이 먼저 보인 뒤 — 늦게 받은 때)는 살며시 겹친다(갑자기 바뀌어 눈을 깜빡이는 것처럼 보이지 않게)
    const late = Boolean(!old.length && actor && !actor.classList.contains('is-pending'));
    if (late) c.classList.add('is-late');
    svg.after(c);
    for (const o of old) { o.remove(); freeCanvas(o); }
    // 늦게 온 고해상도는 살며시 겹치는 동안 호환 그림을 밑에 그대로 두었다가 다 겹친 뒤에 숨긴다
    //  (2026-10-19 사용자 "다른 사진이 나왔다가 바뀌어요" — 예전에는 겹치기 시작할 때 호환 그림을 바로 숨겨 0.35초 동안 캐릭터가 통째로 사라졌다)
    if (late) {
      let done = false;
      const finish = () => { if (done) return; done = true; if (c.isConnected && stage.kgHdSeq === seq) actor.classList.add('is-hd'); };
      c.addEventListener('animationend', finish, { once: true });
      setTimeout(finish, 700);
    } else actor?.classList.add('is-hd');
    stage.dataset.kgHd = 'on';
    stage.dataset.kgHdScale = String(fit.scale);
    stage.dataset.kgHdRender = String(out.renderScale);
    tell('on');
  };
  stage.kgHdRun = () => { if (stage.kgHdSeq === seq) run(); };
  run();
  // 칸 크기가 바뀌면 다시(조금 기다렸다가 한 번)
  stage.kgHdObserver?.disconnect();
  if (typeof ResizeObserver === 'function') {
    let timer = 0;
    const ro = new ResizeObserver(() => {
      if (stage.kgHdSeq !== seq || !stage.isConnected) { ro.disconnect(); return; }
      clearTimeout(timer);
      timer = setTimeout(() => {
        const svg = actorOf()?.querySelector(':scope > .kg-body > svg');
        if (!svg) return;
        // 처음에 칸이 보이지 않았던 무대(좁은 화면에서 숨긴 칸 등)가 보이게 되면 그때 그린다
        if (!fitted) { if (svg.getBoundingClientRect().width > 0) run(); return; }
        const wNow = svg.getBoundingClientRect().width, dpr = window.devicePixelRatio || 1;
        if (Math.abs(wNow - fitted.width) / Math.max(1, fitted.width) > HD_RESIZE || dpr !== fitted.dpr) run();
      }, 300);
    });
    ro.observe(stage);
    // 무대는 그대로인데 캐릭터 칸만 바뀌는 때(얼굴·상반신 보기 등)도
    const svg0 = actorOf()?.querySelector(':scope > .kg-body > svg');
    if (svg0) ro.observe(svg0);
    stage.kgHdObserver = ro;
  }
}
