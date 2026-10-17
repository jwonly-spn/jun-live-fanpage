// 캐릭터 사진(2026-10-18 사이트 새 구조 — "빠릿빠릿하게"): 메인·목록 카드와 DJ 동그라미 그림은 캐릭터를 캔버스에 한 번만 그려 작은 그림 파일(WebP, 안 되면 JPEG)로 만들어 둔다.
//  예전에는 카드마다 SVG(1024 그림 10여 장 + 마스크·머리색 필터)를 화면이 다시 그려 휴대폰에서 스크롤·첫 화면이 느렸다.
//  그리는 규칙은 저장하기와 같은 함수(lib/kiugi-save.js characterPlan · paintPlan — 패키지 renderer.js 와 같은 차례·마스크·머리색)를 그대로 쓴다. 이 파일은 칸 자르기·크기·캐시만 정한다.
//  사진 칸(CROPS — 1024 캔버스 좌표 [x, y, 너비, 높이]):
//   photo = 머리 조금 위(레벨 둥실 하트가 잘리지 않게 y 4부터)~허벅지 가운데(2:3 — 2026-10-18 사용자 "딱 이 정도 비율로": 사람만 당겨 찍고 카드 크기·모양은 그대로)
//   · bust = 얼굴·어깨(정사각형 — DJ 동그라미) · full = 전신(2:3)
//   여자 캐릭터는 무대처럼 발바닥 기준 0.91배(남녀 키 차이 — styles.css .kg-actor.is-f 와 같은 셈) — 같은 칸이라 여자 머리가 조금 아래에 온다(그대로 둔다).
//  함께하는 펫은 사진 안에 세우지 않고 카드 왼쪽 아래 작은 펫 칸(petTile — 펫 그림의 보이는 곳만 맞춰 담은 작은 그림)에 따로 보인다.
//  바탕: 입은 배경 장면(공통 배경 — WebP 사본 docs/kiugi-lite/ 가 있으면 그것) 또는 사이트 무대와 같은 밝은 스튜디오 그라데이션 — 사진은 불투명(그래서 JPEG 도 된다).
//  캐시: 이번 창은 메모리(같은 모습이면 다시 그리지 않는다), 다음 방문은 이 브라우저의 IndexedDB(그림 주소의 ?v= 해시가 열쇠에 들어 있어 그림이 바뀌면 저절로 새로 그린다).
//   저장소가 막혀 있으면(사생활 모드 등) 이번 창에서만. 서버로는 아무것도 보내지 않는다.
//  그리기 차례: 화면 가까이 온 칸부터, 화면 가운데에 가까운 것 먼저, 한 번에 하나씩(그 사이에 화면이 멈추지 않게 쉰다). 그림 파일 받기는 미리 함께.
// DOM·캔버스는 함수 안에서만 쓴다(노드 시험에서 이 파일을 불러 칸·열쇠·자리 셈을 시험한다).
import { characterPlan, planUrls, paintPlan, artUrl, savePetUrl, alphaBox } from './kiugi-save.js';
import { recolor } from '../kiugi/kiugi-hair-color.js';
import { ART } from '../kiugi/kiugi-r7-data.js';
import { expressionFor, preloadImage } from './kiugi-draw.js';

export const SIZE = 1024;
export const CROPS = Object.freeze({
  photo: Object.freeze([309, 4, 406, 609]),
  bust: Object.freeze([392, 34, 240, 240]),
  full: Object.freeze([181, 8, 661, 992]),
});
// 여자 캐릭터 줄이기(무대 .kg-actor.is-f 와 같게): 발바닥(512, 974) 기준 0.91배 + 14px 올림
export const FEMALE = Object.freeze({ s: 0.91, ox: 512, oy: 974, dy: -14 });
const isFemale = (character) => String(character?.gender || 'f') !== 'm';
// 칸 [x, y, w, h](남녀 같은 칸)
export const cropOf = (kind) => [...(CROPS[kind] || CROPS.photo)];
// 그릴 배율: 칸 화면 너비(CSS px) × 화면 배율(3까지) ÷ 칸 너비 → 정해 둔 단계로 올림(비슷한 크기는 같은 그림을 다시 쓴다), 1024 원본보다 크게는 그리지 않는다
export const SCALES = Object.freeze([0.25, 0.35, 0.5, 0.7, 1]);
export function scaleFor(cssWidth, dpr, cropW) {
  const want = (Math.max(1, Number(cssWidth) || 360) * Math.min(3, Math.max(1, Number(dpr) || 1))) / cropW;
  return SCALES.find((s) => s >= want - 1e-6) || 1;
}
// 펫 칸(카드 왼쪽 아래 작은 칸 — 2026-10-18 사용자 "펫은 장면 안에 세우지 말고 따로 작은 칸에"): 펫 그림(512 — 단계마다 그림 속 펫 크기가 다르다)의
//  보이는 상자(알파 상자)를 재서, 정사각형 칸에 여백 10%를 두고 가운데·아래 맞춤으로 담는다 → 어느 단계든 칸에 꽉 차게 보인다.
//  box = 512 칸 좌표 {x0, y0, x1, y1} → 칸 크기 n 에 그릴 자리 {x, y, size(512 그림을 그릴 크기)}
export function petFit(box, n) {
  const b = box && box.x1 > box.x0 && box.y1 > box.y0 ? box : { x0: 0, y0: 0, x1: 512, y1: 512 };
  const w = b.x1 - b.x0, hgt = b.y1 - b.y0, k = (n * 0.8) / Math.max(w, hgt), size = 512 * k;
  return { size, x: n / 2 - ((b.x0 + b.x1) / 2) * k, y: n * 0.92 - b.y1 * k };
}

// ---- 열쇠 ----
// 짧은 해시(FNV-1a 두 번 — 열쇠 길이만 줄인다, 보안용 아님)
export function hashText(s) {
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 2246822519); }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}
// 사진 한 장의 열쇠: 그림 주소(?v= 해시 포함 — 그림이 바뀌면 열쇠도 바뀐다) · 칸 · 배율 · 펫 · 그리는 방법 판
export const RASTER_VERSION = 'r1';
export function rasterKey(urls, { kind = 'photo', s = 1, female = false, pet = null } = {}) {
  return `${RASTER_VERSION}:${kind}:${s}:${female ? 'f' : 'm'}:${hashText([...urls, pet || ''].join('|'))}`;
}

// ---- 가벼운 사본(docs/kiugi-lite/index.json — tools/make-lite-art.cjs) ----
let liteJob = null;
export function loadLite(base = '/') {
  return liteJob ||= fetch((String(base).endsWith('/') ? base : base + '/') + 'kiugi-lite/index.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : { files: {} })).catch(() => ({ files: {} }));
}
// 원본 주소 → 사본 주소(원본의 ?v= 가 사본 목록의 v 와 같을 때만, 아니면 원본 그대로)
export function liteUrl(url, lite, base = '/') {
  const m = /^(.*?)(\/kiugi\/[a-z0-9_/]+\.png)\?v=([0-9a-f]+)$/.exec(String(url));
  const f = m && lite?.files?.[m[2]];
  if (!f || f.v !== m[3] || !/^[a-z0-9_/]+\.webp$/.test(f.file)) return url;
  return `${m[1]}/kiugi-lite/${f.file}?v=${f.t}`;
}

// ---- 이 브라우저의 사진 캐시(IndexedDB) ----
const DB = 'kg-raster', STORE = 'r', KEEP = 160;
let dbJob = null;
function db() {
  if (dbJob) return dbJob;
  dbJob = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => { const s = req.result.createObjectStore(STORE, { keyPath: 'k' }); s.createIndex('at', 'at'); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbJob;
}
async function dbGet(k) {
  const d = await db();
  if (!d) return null;
  return new Promise((resolve) => {
    try { const r = d.transaction(STORE).objectStore(STORE).get(k); r.onsuccess = () => resolve(r.result || null); r.onerror = () => resolve(null); } catch { resolve(null); }
  });
}
let pruned = false;
async function dbPut(rec) {
  const d = await db();
  if (!d) return;
  try {
    const tx = d.transaction(STORE, 'readwrite'), s = tx.objectStore(STORE);
    s.put(rec);
    // 오래된 사진은 지운다(이 브라우저에 한 번만 — KEEP 장까지)
    if (!pruned) {
      pruned = true;
      const c = s.count();
      c.onsuccess = () => {
        let extra = c.result - KEEP;
        if (extra <= 0) return;
        s.index('at').openCursor().onsuccess = (e) => { const cur = e.target.result; if (cur && extra-- > 0) { cur.delete(); cur.continue(); } };
      };
    }
  } catch { /* 막힌 저장소 */ }
}

// ---- 그리기 ----
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
const free = (c) => { try { c.width = 0; c.height = 0; } catch { /* 무시 */ } };
// 머리 물들이기(tone-map-v1 — kiugi-save.js tintedHair 와 같은 방법, 크기만 칸 배율에 맞춘다). 몇 장만 기억(DJ 마다 앞·뒷머리).
const TINTS = new Map(), TINT_MAX = 10;
function tinted(img, asset, color, n) {
  const key = [ART.packageId, asset.id, asset.v, color, n].join(':');
  if (TINTS.has(key)) { const c = TINTS.get(key); TINTS.delete(key); TINTS.set(key, c); return c; }
  const c = canvasOf(n, n), x = c.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingQuality = 'high';
  x.drawImage(img, 0, 0, n, n);
  const px = x.getImageData(0, 0, n, n);
  px.data.set(recolor(px.data, color));
  x.putImageData(px, 0, 0);
  TINTS.set(key, c);
  while (TINTS.size > TINT_MAX) { const [k, old] = TINTS.entries().next().value; TINTS.delete(k); free(old); }
  return c;
}
// 사이트 무대(styles.css --stage)와 같은 밝은 스튜디오: 연보랏빛 회색 그라데이션 + 위쪽 흰 빛
function drawStudio(ctx, w, h) {
  const lg = ctx.createLinearGradient(0, 0, 0, h);
  lg.addColorStop(0, '#eee9f1'); lg.addColorStop(0.62, '#e4dde9'); lg.addColorStop(1, '#d8d0de');
  ctx.fillStyle = lg; ctx.fillRect(0, 0, w, h);
  ctx.save(); ctx.setTransform(w * 0.64, 0, 0, h * 0.44, w * 0.5, h * 0.3);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, 'rgba(255, 255, 255, 0.9)'); g.addColorStop(0.72, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g; ctx.fillRect(-1 / 0.64, -0.3 / 0.44, 1 / 0.32, 1 / 0.44); ctx.restore();
}
// 펫 그림의 보이는 상자(512 칸 기준) — 펫 그림마다 한 번
function petBox(img) {
  try { const c = canvasOf(128, 128), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, 128, 128); const b = alphaBox(x.getImageData(0, 0, 128, 128).data, 128, 128); free(c); return { x0: b.x0 * 4, y0: b.y0 * 4, x1: b.x1 * 4, y1: b.y1 * 4 }; } catch { return null; }
}
let encodeType = null;
function pickType() {
  if (encodeType) return encodeType;
  try { encodeType = canvasOf(2, 2).toDataURL('image/webp').startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg'; } catch { encodeType = 'image/jpeg'; }
  return encodeType;
}
// 그림 파일 → data: 주소(사이트 보안 규칙 CSP 는 그림을 같은 출처와 data: 만 허용 — blob: 은 쓰지 않는다)
const dataUrl = (blob) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(r.error); r.readAsDataURL(blob); });
const toBlob = (c) => new Promise((resolve, reject) => {
  const type = pickType();
  try { c.toBlob((b) => (b ? resolve(b) : reject(Error('사진을 만들지 못했어요.'))), type, type === 'image/webp' ? 0.9 : 0.92); } catch (e) { reject(e); }
});

// 한 장 그리기 → 캔버스. job = {plan, images(원본 주소 → 그림), kind, s, character, base}
function paint(job) {
  const { plan, images, kind, s, character, base } = job;
  const [cx, cy, cw, ch] = cropOf(kind), W = cw * s, H = ch * s, female = kind !== 'bust' && isFemale(character);
  // 캐릭터 칸(칸 크기만 — 1024 전체를 그리지 않아 빠르다): 1024 좌표 → 칸 좌표(× s) · 여자는 발바닥 기준 0.91배
  const base0 = [s, 0, 0, s, -cx * s, -cy * s];
  const mat = female ? [s * FEMALE.s, 0, 0, s * FEMALE.s, s * (FEMALE.ox - FEMALE.ox * FEMALE.s) - cx * s, s * (FEMALE.oy - FEMALE.oy * FEMALE.s + FEMALE.dy) - cy * s] : base0;
  const made = new Set(), tintN = Math.min(SIZE, Math.ceil(SIZE * s * (female ? FEMALE.s : 1)));
  const layer = () => { const c = canvasOf(W, H), x = c.getContext('2d'); x.setTransform(...mat); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; made.add(c); return x; };
  const art = layer();
  paintPlan(art, plan.ops, {
    get: (m) => images.get(artUrl(m, base)), layer,
    tint: (m, color) => tinted(images.get(artUrl(m, base)), m, color, tintN),
    done: (t) => { made.delete(t.canvas); free(t.canvas); },
  });
  // 사진: 바탕(배경 장면 또는 스튜디오) → 캐릭터

  const out = canvasOf(W, H), o = out.getContext('2d');
  o.imageSmoothingEnabled = true; o.imageSmoothingQuality = 'high';
  if (plan.background) { o.setTransform(...base0); o.drawImage(images.get(artUrl(plan.background, base)), 0, 0, SIZE, SIZE); o.setTransform(1, 0, 0, 1, 0, 0); }
  else drawStudio(o, W, H);
  o.drawImage(art.canvas, 0, 0);

  for (const c of made) free(c);
  return out;
}

const MEM = new Map(), WAIT = new Map();
// 이번 창에서 그린 사진 셈(속도 재기·시험용): mem(메모리) · db(이 브라우저 캐시) · drawn(새로 그림) · ms(새로 그린 시간 합)
export const rasterStats = { mem: 0, db: 0, drawn: 0, ms: 0 };
// 사진 한 장 → {url(data:), w, h} (같은 열쇠는 한 번만 그린다). opts = {catalog, character, worn, level, seasonId, base, kind, cssWidth, dpr}
export async function rasterize(opts) {
  const { catalog, character, worn = {}, level = 1, seasonId = null, base = '/', kind = 'photo' } = opts;
  const plan = characterPlan(character || {}, { worn: worn && typeof worn === 'object' ? worn : {} }, expressionFor(catalog, seasonId, level || 1));
  const crop = cropOf(kind), s = scaleFor(opts.cssWidth, opts.dpr, crop[2]);
  const urls = planUrls(plan, base);
  const key = rasterKey(urls, { kind, s, female: isFemale(character) });
  if (MEM.has(key)) { rasterStats.mem++; return MEM.get(key); }
  if (WAIT.has(key)) return WAIT.get(key);
  const job = (async () => {
    const t0 = typeof performance === 'object' ? performance.now() : 0;
    const saved = await dbGet(key);
    if (saved?.blob) { try { const r = { url: await dataUrl(saved.blob), w: saved.w, h: saved.h, cached: true }; MEM.set(key, r); rasterStats.db++; return r; } catch { /* 다시 그린다 */ } }
    const lite = await loadLite(base), images = new Map();
    // 그림 받기(사본이 있으면 사본 — 못 받으면 원본으로 한 번 더)
    await Promise.all(urls.map(async (u) => {
      const l = liteUrl(u, lite, base);
      let img;
      try { img = await preloadImage(l); } catch (e) { if (l === u) throw e; img = await preloadImage(u); }
      images.set(u, img);
    }));
    await turn();
    let canvas;
    try { canvas = paint({ plan, images, kind, s, character, base }); }
    finally { release(); }
    const blob = await toBlob(canvas);
    const r = { url: await dataUrl(blob), w: canvas.width, h: canvas.height, cached: false };
    free(canvas);
    MEM.set(key, r);
    rasterStats.drawn++; if (t0) rasterStats.ms += performance.now() - t0;
    void dbPut({ k: key, blob, w: r.w, h: r.h, at: Date.now() });
    return r;
  })();
  WAIT.set(key, job);
  try { return await job; } finally { WAIT.delete(key); }
}
// 캔버스 일은 한 번에 하나(그 사이에 한 번 쉬어 화면이 멈추지 않게) — 화면 가운데에 가까운 칸이 먼저(차례는 photoBox 가 정한다)
let busy = false;
const line = [];
function turn() { return new Promise((resolve) => { if (!busy) { busy = true; resolve(); } else line.push(resolve); }); }
function release() { setTimeout(() => { const next = line.shift(); if (next) next(); else busy = false; }, 0); }

// ---- 화면 칸 ----
// 사진 칸: <div class="kg-photo <kind>"> + <img data-kg-raster>. 화면 가까이 오면 그린다(eager 면 바로). 다 그린 뒤 살짝 나타난다(is-ready).
//  실패하면 onFail(칸) — 화면 쪽이 예전 SVG 그림으로 바꾼다. 칸 크기는 styles.css 가 정한다(그리기 전에도 같은 크기 — 화면이 밀리지 않게).
const queue = new Set(), ACTIVE_MAX = 4;
let observer = null, active = 0;
// 화면 가운데와의 거리(아직 화면에 붙지 않은 칸은 맨 뒤)
function distance(el) { if (!el.isConnected) return 1e9; const r = el.getBoundingClientRect(); return Math.abs(r.top + r.height / 2 - innerHeight / 2) + Math.abs(r.left + r.width / 2 - innerWidth / 2) * 0.5; }
// 한 번에 넷까지 그림을 받기 시작한다(화면 가운데에 가까운 칸부터) — 캔버스 일은 turn() 이 하나씩
function pump() {
  while (queue.size && active < ACTIVE_MAX) {
    let best = null, d = Infinity;
    for (const el of queue) { const x = distance(el); if (x < d) { d = x; best = el; } }
    queue.delete(best);
    active++;
    Promise.resolve(best.kgPaint?.()).finally(() => { active--; pump(); });
  }
}
const later = (fn) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => fn()) : setTimeout(fn, 0));export function photoBox(opts, { eager = false, label = '', onFail = null, className = '' } = {}) {
  const kind = opts.kind || 'photo';
  const img = document.createElement('img');
  img.className = 'kg-raster'; img.alt = ''; img.decoding = 'async'; img.draggable = false;
  img.setAttribute('data-kg-raster', '');
  const box = document.createElement('div');
  box.className = `kg-photo ${kind}${className ? ' ' + className : ''}`;
  if (label) { box.setAttribute('role', 'img'); box.setAttribute('aria-label', label); }
  box.append(img);
  if (!opts.character) { box.classList.add('is-empty'); return box; }
  let done = false;
  box.kgPaint = async () => {
    if (done) return;
    done = true;
    try {
      // 크기: 부른 쪽이 알려 준 크기(동그라미 — 늘 같은 배율) 또는 화면에 놓인 칸 너비(아직 칸이 놓이지 않았으면 큰 카드 크기)
      const r = await rasterize({ ...opts, kind, cssWidth: opts.cssWidth || box.getBoundingClientRect().width || 380, dpr: typeof devicePixelRatio === 'number' ? devicePixelRatio : 1 });
      img.width = r.w; img.height = r.h;
      img.src = r.url;
      try { await img.decode(); } catch { /* 그래도 보인다 */ }
      box.classList.add('is-ready');
      if (r.cached) box.classList.add('was-cached');
    } catch (e) { console.error(e); box.classList.add('is-failed'); onFail?.(box); }
  };
  if (eager || typeof IntersectionObserver !== 'function') { queue.add(box); later(pump); return box; }
  observer ||= new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { observer.unobserve(e.target); queue.add(e.target); }
    pump();
  }, { rootMargin: '900px 300px' });
  observer.observe(box);
  return box;
}
// 그림 받기만 미리(예: 캐릭터를 누르기 직전 — 캐릭터 페이지 큰 그림이 바로 뜨게)
export function prefetchLook({ catalog, character, worn = {}, level = 1, seasonId = null, base = '/' }) {
  try {
    const plan = characterPlan(character || {}, { worn: worn || {} }, expressionFor(catalog, seasonId, level || 1));
    for (const u of planUrls(plan, base)) preloadImage(u).catch(() => {});
  } catch { /* 무시 */ }
}

// ---- 펫 칸(카드 왼쪽 아래) ----
// 함께하는 펫 {id, season, stage} → 펫 그림의 보이는 곳만 정사각형 칸에 맞춰 담은 작은 그림(data:) — 단계마다 그림 속 크기가 달라도 칸에 꽉 차게(petFit).
const PET_TILES = new Map();
export function petTileUrl(pet, base = '/', px = 160) {
  const src = savePetUrl(pet, base);
  if (!src) return Promise.reject(Error('펫 그림 없음'));
  const key = `${src}@${px}`;
  if (!PET_TILES.has(key)) PET_TILES.set(key, preloadImage(src).then(async (img) => {
    const c = canvasOf(px, px), x = c.getContext('2d');
    const fit = petFit(petBox(img), px);
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(img, fit.x, fit.y, fit.size, fit.size);
    const blob = await new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(Error('펫 그림을 만들지 못했어요.'))), 'image/png'));
    free(c);
    return dataUrl(blob);
  }).catch((e) => { PET_TILES.delete(key); throw e; }));
  return PET_TILES.get(key);
}
// 펫 칸 요소: <span class="kg-pet-tile st<단계>"><img></span>(이름은 화면 읽기·마우스 올리기로). 그림을 못 만들면 원래 그림을 그대로(가운데 맞춤).
export function petTile(pet, base = '/', { label = '' } = {}) {
  const img = document.createElement('img');
  img.alt = ''; img.decoding = 'async'; img.draggable = false;
  const tile = document.createElement('span');
  tile.className = `kg-pet-tile st${Math.min(5, Math.max(1, pet?.stage || 1))}`;
  if (label) { tile.title = label; tile.setAttribute('role', 'img'); tile.setAttribute('aria-label', label); }
  tile.append(img);
  petTileUrl(pet, base).then((u) => { img.src = u; tile.classList.add('is-ready'); }, () => { const s = savePetUrl(pet, base); if (s) { img.src = s; tile.classList.add('is-ready', 'is-raw'); } });
  return tile;
}