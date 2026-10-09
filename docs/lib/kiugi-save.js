// 캐릭터 이미지로 저장(캐릭터 페이지의 "저장하기" 단추 — 캐릭터 그림 바로 아래 따로, 2026-10-09): 1080×1350(4:5) PNG 한 장.
//  모습: 입은 배경(배경 옷)이 그림 전체를 채우고(잘라 채우기 — 없으면 사이트 무대처럼 어두운 그라데이션 + 위에서 비추는 빛),
//   그 위에 캐릭터를 크게 가운데(발밑에 옅은 그림자), 아래 반투명 어두운 띠에 "아이디#이름"(앞은 크게, #이름은 작고 옅게) ·
//   "Lv.N · 시즌" · 하트 수 · "스푼 DJ 키우기 · 키우기.com" · 비공식 표시.
//  캐릭터는 kiugi-art.js 와 같은 규칙으로 캔버스에 직접 그린다 — SVG 를 그림으로 캔버스에 올리면 SVG 안의 바깥 그림 파일(href)을 읽지 못한다.
//   그릴 차례·마스크는 kiugi-art.js 의 함수(resolveLook·partOf·normalizeLook)로 정한다(시험이 layersOf·characterSvg 와 같은지 본다).
//   머리색(그림 V5, 2026-10-09 — 패키지 머리색_수정연결가이드 tone-map-v1): 회색 머리를 1024 임시 캔버스에 그려 getImageData 로 읽고
//    kiugi-hair-color.js 의 recolor(RGB 만 256단계 표로, 알파는 원본 그대로)를 한 뒤 putImageData — 패키지 renderer.js 와 같은 방법.
//    예전의 곱하기(multiply fillRect + destination-in)는 없앴다. 물들인 머리는 packageId·판(tone-map-v1)·그림 id·해시·색으로 몇 장만 기억해 둔다.
//   그림 파일은 사이트와 같은 주소(같은 출처)라 캔버스가 막히지 않고, 화면이 이미 받아 둔 그림(preloadImage)을 그대로 쓴다.
//  저장(사용자 10/9 "저장하기 버튼을 따로" — 누르면 바로 저장, 따로 "공유" 단추는 없다):
//   PC·안드로이드 → 바로 내려받기(<a download> — 안드로이드는 갤러리의 다운로드 앨범에 들어간다).
//   바로 내려받을 수 없는 곳(아이폰·아이패드 — 사진 앱에 넣을 수 없다, 앱 안 브라우저(카카오톡 등)) → 파일을 담은 공유 창(“이미지 저장”을 고른다).
//   공유 창도 안 되면(예전 아이폰·앱 안 브라우저) → 그림을 보여 주고 길게 눌러 저장.
// DOM·캔버스는 함수 안에서만 쓴다(노드 시험에서 이 파일을 불러 그릴 차례·배치·글·파일 이름을 시험한다).
import { ART } from '../kiugi/kiugi-v5-data.js';
import hairColor, { recolor } from '../kiugi/kiugi-hair-color.js';
import { normalizeLook } from '../kiugi/kiugi-look.js';
import { SIZE, partOf, resolveLook, ACCESSORY_ORDER } from '../kiugi/kiugi-art.js';
import { preloadImage } from './kiugi-draw.js';
import { h, icon, toast } from './dom.js';

export const SAVE_W = 1080;
export const SAVE_H = 1350;
export const SITE_MARK = '스푼 DJ 키우기';
export const SITE_DOMAIN = '키우기.com';
export const UNOFFICIAL_MARK = '비공식 팬 사이트';
export const SAVE_LABEL = '저장하기';
export const SAVE_BUSY = '만드는 중…';
export const SAVED = '이미지를 저장했어요';
export const SAVE_FAILED = '이미지를 만들지 못했어요. 잠시 뒤에 다시 해 주세요.';
const BODY = Object.freeze({ f: 'female', m: 'male' });
const COLOR = Object.freeze({ text: '#f3efe8', text2: '#a9a6af', text3: '#8a8791', accent: '#ff7a2f', accentText: '#ff9a5c', accentInk: '#1b0c03', bg: '11, 11, 15' });
const FONT = '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", system-ui, sans-serif';

// 배치(1080×1350). 캐릭터는 1024 캔버스 전체를 1.1배 캔버스에 그린 뒤, 실제로 그려진 곳(알파 상자 — 왕관·날개·오라·둥실 하트 포함)을 재서
//  그 가운데가 그림 한가운데(540, 675)에 오게 놓는다(2026-10-09 사용자 "이미지 저장할 때 캐릭터를 정 중앙에"). 위로 fit.top, 아래 띠 위 fit.bottom 안에 들어가지 않으면 그만큼 줄인다(placeCharacter).
//  아래 띠는 220px(예전 258px)로 얇게 — 가운데에 둔 캐릭터가 거의 줄지 않게.
const CHAR_S = 1.1;
export const SAVE_LAYOUT = Object.freeze({
  pad: 64,
  char: Object.freeze({ s: CHAR_S }),
  center: Object.freeze({ x: SAVE_W / 2, y: SAVE_H / 2 }),
  fit: Object.freeze({ top: 36, bottom: 1114, side: 40 }),
  shadow: Object.freeze({ rx: 200, ry: 28 }),
  fade: Object.freeze({ from: 960, to: 1130 }), // 아래 띠로 이어지는 어둠(캐릭터 밑에 깔아 배경만 어둡게)
  band: Object.freeze({ y: 1130 }),
  id: Object.freeze({ y: 1214, size: 82, tag: 0.6, min: 0.55 }), // 아이디 글 아랫줄(앞 82px · #이름 0.6배), 길면 0.55배까지 줄인다
  sub: Object.freeze({ y: 1262, size: 28, pill: 40 }),
  rule: Object.freeze({ y: 1290 }),
  mark: Object.freeze({ y: 1328, size: 23, logo: 32 }),
});
// 그린 캐릭터 캔버스의 알파 상자 {x0, y0, x1, y1}(그 캔버스 픽셀) · 아무것도 없으면 캔버스 전체
export function alphaBox(data, w, hgt, min = 16) {
  let x0 = w, y0 = hgt, x1 = -1, y1 = -1;
  for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > min) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? { x0: 0, y0: 0, x1: w, y1: hgt } : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}
// 알파 상자 → 그릴 자리 {x, y, f(줄이는 배수 ≤ 1), bottom(발끝 y)}: 상자 가운데 = 그림 가운데, 위·아래·옆 여백 안에 들어가게.
export function placeCharacter(box) {
  const L = SAVE_LAYOUT, w = box.x1 - box.x0, hgt = box.y1 - box.y0;
  const half = Math.min(L.center.y - L.fit.top, L.fit.bottom - L.center.y);
  const f = Math.min(1, (2 * half) / Math.max(1, hgt), (SAVE_W - 2 * L.fit.side) / Math.max(1, w));
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
  return { x: L.center.x - cx * f, y: L.center.y - cy * f, f, bottom: L.center.y + (hgt * f) / 2 };
}

// 그림(정사각형) → 칸을 빈틈없이 채우는 자리(잘라 채우기, 가운데)
export function coverRect(sw, sh, dw = SAVE_W, dh = SAVE_H) {
  const s = Math.max(dw / sw, dh / sh), w = sw * s, h2 = sh * s;
  return { x: (dw - w) / 2, y: (dh - h2) / 2, w, h: h2 };
}

// ── 그릴 차례(kiugi-art.js characterSvg 와 같은 차례·같은 규칙) ──
// 레벨 표정 겹치기(kiugi-art.js 의 blush·floatingHearts 와 같은 셈 — 시험이 SVG 글과 같은지 본다)
function blushSpots(g) {
  const A = ART.anchors[BODY[g]], y = (A.nose[1] + A.mouth[1]) / 2 - 4, dx = (A.eye_right[0] - A.eye_left[0]) / 2 + 9, cx = A.nose[0];
  return [cx - dx, cx + dx].map((x) => ({ cx: Number(x.toFixed(1)), cy: Number(y.toFixed(1)), rx: 15, ry: 8 }));
}
const heartPath = (x, y, s) => `M${x} ${y + 0.9 * s} C${x - 1.2 * s} ${y + 0.1 * s} ${x - 0.9 * s} ${y - 0.9 * s} ${x} ${y - 0.3 * s} C${x + 0.9 * s} ${y - 0.9 * s} ${x + 1.2 * s} ${y + 0.1 * s} ${x} ${y + 0.9 * s}Z`;
function floatingHearts(g, tall) {
  const A = ART.anchors[BODY[g]], top = A.skull_top[1], cx = A.skull_top[0];
  const spots = tall ? [[cx - 150, top + 30, 13, '#FF8FB1'], [cx + 150, top + 10, 15, '#FF6F9C'], [cx + 132, top + 82, 11, '#FF8FB1']]
    : [[cx - 100, top - 34, 13, '#FF8FB1'], [cx + 4, top - 88, 16, '#FF6F9C'], [cx + 102, top - 44, 12, '#FF8FB1']];
  return spots.map(([x, y, s, fill]) => ({ d: heartPath(x, y, s), fill }));
}
const tallHead = (R) => Boolean(R.rewards.front || (R.acc.head && R.acc.head.box && R.acc.head.box[1] < 110));

// DJ 캐릭터 + 입은 옷({worn}) + 레벨 표정 → {background(배경 그림 또는 null), ops:[{step, kind, …}]}
//  kind: image(그대로) · tint(머리색 명도 표 tone-map-v1, 알파 그대로) · layer(몸 칸 — 따로 그려 한 번에 올린다) · erase(몸 칸 지우기 마스크) · hem(밑단: 그 옷을 마스크 알파로 잘라 다시) · blush · hearts
export function characterPlan(dj = {}, look = {}, expression = null) {
  const L = normalizeLook(dj), g = L.gender, R = resolveLook(look, g);
  const parts = new Set(Array.isArray(expression?.parts) ? expression.parts : []);
  const color = L.hairColor; // 팔레트 열쇠(blond 등 — normalizeLook 이 예전 값도 열쇠로 맞춘다)
  const ops = [];
  const img = (step, a) => { if (a) ops.push({ step, kind: 'image', src: a }); };
  const tint = (step, a) => { if (a) ops.push({ step, kind: 'tint', src: a, color }); };
  img('reward.aura', R.rewards.aura);
  img('reward.back', R.rewards.back);
  tint('hair.back', partOf('hair', g, L.hair, 'back'));
  const body = [];
  const bodyA = partOf('body', g, 1);
  if (bodyA) body.push({ step: 'body', kind: 'image', src: bodyA });
  const wear = (name, a) => {
    if (!a) return;
    if (a.cut) body.push({ step: name + '.cut', kind: 'erase', mask: a.cut });
    body.push({ step: name, kind: 'image', src: a });
  };
  if (R.outfit) wear('outfit', R.outfit);
  else { wear('bottom', R.bottom); wear('top', R.top); }
  if (R.shoe) {
    wear('shoe', R.shoe);
    const hemOf = R.outfit || R.bottom;
    if (hemOf?.hem) body.push({ step: (R.outfit ? 'outfit' : 'bottom') + '.hem', kind: 'hem', src: hemOf, mask: hemOf.hem });
  }
  ops.push({ step: 'dressed', kind: 'layer', ops: body });
  for (const c of ['eyes', 'nose', 'mouth']) img(c, partOf(c, g, L[c]));
  if (parts.has('exp-blush')) ops.push({ step: 'exp-blush', kind: 'blush', spots: blushSpots(g) });
  tint('hair.front', partOf('hair', g, L.hair, 'front'));
  for (const s of ACCESSORY_ORDER) img('accessory.' + s, R.acc[s]);
  img('reward.front', R.rewards.front);
  if (parts.has('exp-floating-hearts')) ops.push({ step: 'exp-floating-hearts', kind: 'hearts', hearts: floatingHearts(g, tallHead(R)) });
  return { background: R.background || null, ops };
}
// 차례를 한 줄로(몸 칸 안 단계 포함) — 시험·확인용
export function planSteps(plan) {
  const out = [];
  const walk = (ops) => { for (const op of ops) { if (op.kind === 'layer') walk(op.ops); else out.push(op.step); } };
  if (plan.background) out.push('background');
  walk(plan.ops);
  return out;
}
// 그림 파일 주소(사이트 BASE 아래 — 화면 SVG 와 같은 글이라 이미 받아 둔 그림을 그대로 쓴다). 배경 → 차례대로, 겹치지 않게.
export const artUrl = (m, base = '/') => `${ART.dir}${m.file}?v=${m.v}`.replace(/^\/kiugi\//, (String(base).endsWith('/') ? base : base + '/') + 'kiugi/');
export function planUrls(plan, base = '/') {
  const out = [];
  const add = (m) => { if (m) { const u = artUrl(m, base); if (!out.includes(u)) out.push(u); } };
  add(plan.background);
  const walk = (ops) => { for (const op of ops) { if (op.kind === 'layer') walk(op.ops); else { add(op.src); add(op.mask); } } };
  walk(plan.ops);
  return out;
}

// 머리 물들이기(패키지 renderer.js tinted 와 같은 방법): 회색 머리 그림을 1024 캔버스에 그려 픽셀을 읽고 recolor(RGB 만 표로, 알파 그대로) → putImageData.
//  같은 머리·같은 색은 다시 만들지 않는다(packageId · 판 · 그림 id · 해시 · 색으로 몇 장만 기억 — 휴대폰 메모리를 아끼게 오래된 것부터 비운다).
export const TINT_CACHE_MAX = 4;
const TINTS = new Map();
export const tintKey = (asset, color) => [ART.packageId, hairColor.VERSION, asset.id, asset.v, color].join(':');
export function tintedHair(doc, img, asset, color, cache = TINTS) {
  const key = tintKey(asset, color);
  if (cache.has(key)) { const c = cache.get(key); cache.delete(key); cache.set(key, c); return c; }
  const c = canvasOf(doc, SIZE, SIZE), x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, SIZE, SIZE);
  const px = x.getImageData(0, 0, SIZE, SIZE);
  px.data.set(recolor(px.data, color));
  x.putImageData(px, 0, 0);
  cache.set(key, c);
  while (cache.size > TINT_CACHE_MAX) { const [k, old] = cache.entries().next().value; cache.delete(k); free(old); }
  return c;
}

// 캔버스에 그리기(ctx 는 1024 좌표 — 그리는 쪽이 줄이고 늘리는 변환을 걸어 둔다). get(그림 정보) → 받아 둔 그림, layer() → 같은 크기·같은 변환의 빈 캔버스 ctx,
//  tint(그림 정보, 색) → 물들인 1024 머리 캔버스(tintedHair)
//  마스크: 지우기 = destination-out(그때까지 몸 칸에 그린 것 × (1 − 마스크 알파)), 밑단 = destination-in(그 옷 × 마스크 알파) — SVG <mask mask-type="alpha"> 와 같다.
//  머리색: 물들인 머리 캔버스를 그대로 올린다(SVG 의 feComponentTransfer 명도 표 필터와 같은 표 — 다른 곱하기·자르기를 다시 하지 않는다).
export function paintPlan(ctx, ops, { get, layer, tint }) {
  const blit = (to, from) => { to.save(); to.setTransform(1, 0, 0, 1, 0, 0); to.globalCompositeOperation = 'source-over'; to.drawImage(from.canvas, 0, 0); to.restore(); };
  const full = (c, im) => c.drawImage(im, 0, 0, SIZE, SIZE);
  for (const op of ops) {
    if (op.kind === 'image') full(ctx, get(op.src));
    else if (op.kind === 'tint') full(ctx, tint(op.src, op.color));
    else if (op.kind === 'layer') {
      const t = layer();
      paintPlan(t, op.ops, { get, layer, tint });
      blit(ctx, t);
    } else if (op.kind === 'erase') {
      ctx.save(); ctx.globalCompositeOperation = 'destination-out'; full(ctx, get(op.mask)); ctx.restore();
    } else if (op.kind === 'hem') {
      const t = layer();
      full(t, get(op.src));
      t.globalCompositeOperation = 'destination-in'; full(t, get(op.mask));
      blit(ctx, t);
    } else if (op.kind === 'blush') {
      for (const s of op.spots) {
        ctx.save(); ctx.translate(s.cx, s.cy); ctx.scale(s.rx, s.ry);
        const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        gr.addColorStop(0, 'rgba(255, 111, 142, 0.5)'); gr.addColorStop(1, 'rgba(255, 111, 142, 0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    } else if (op.kind === 'hearts') {
      ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = '#FFFFFF'; ctx.miterLimit = 4; // SVG 기본 miterlimit 4(캔버스 기본 10 — 하트 끝이 뾰족하게 길어지지 않게)
      for (const ht of op.hearts) { const p = new Path2D(ht.d); ctx.fillStyle = ht.fill; ctx.fill(p); ctx.stroke(p); }
      ctx.restore();
    }
  }
}

// ── 글 ──
// "밤톨#먼치" → {head:'밤톨', tag:'#먼치'} (# 가 없으면 tag '')
export function labelParts(id) {
  const s = String(id ?? '').trim(), i = s.indexOf('#');
  return i < 0 ? { head: s, tag: '' } : { head: s.slice(0, i), tag: s.slice(i) };
}
// 아래 띠 둘째 줄: "Lv.10" 과 "할로윈 시즌"(시즌 이름이 없으면 빈 글)
export function levelParts(level, seasonName) {
  const n = Math.max(1, Math.floor(Number(level) || 1));
  const s = String(seasonName ?? '').trim();
  return { lv: `Lv.${n}`, season: s ? (/시즌$/.test(s) ? s : `${s} 시즌`) : '' };
}
export const levelText = (level, seasonName) => { const p = levelParts(level, seasonName); return p.season ? `${p.lv} · ${p.season}` : p.lv; };
// 파일 이름: "키우기-밤톨-먼치.png" (한글·영문·숫자만, 나머지는 뺀다)
export function saveFileName(id) {
  const clean = (s) => String(s ?? '').normalize('NFC').replace(/[^0-9A-Za-z가-힣]+/g, '').slice(0, 20);
  const { head, tag } = labelParts(id);
  const parts = [clean(head), clean(tag)].filter(Boolean);
  return `키우기-${parts.length ? parts.join('-') : '캐릭터'}.png`;
}

// 저장 방법: download(바로 내려받기) · share(바로 내려받을 수 없는 곳 — 파일을 담은 공유 창) · preview(공유도 안 되면 그림을 보여 주고 길게 눌러 저장)
export function saveMode({ ua = '', touchPoints = 0, canShareFiles = false } = {}) {
  const apple = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && touchPoints > 1);
  const inApp = /KAKAOTALK|Instagram|FBAN|FBAV|NAVER\(inapp|\bLine\/|DaumApps|; wv\)/i.test(ua);
  if (apple || inApp) return canShareFiles ? 'share' : 'preview';
  return 'download';
}

// ── 그리기(브라우저) ──
const canvasOf = (doc, w, hgt) => { const c = doc.createElement('canvas'); c.width = w; c.height = hgt; return c; };
const free = (c) => { try { c.width = 0; c.height = 0; } catch { /* 무시 */ } }; // 아이폰 캔버스 메모리를 바로 돌려준다
function setFont(ctx, weight, size, spacing = 0) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
}
function ellipseGlow(ctx, cx, cy, rx, ry, stops) {
  ctx.save();
  ctx.setTransform(rx, 0, 0, ry, cx, cy);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(-cx / rx, -cy / ry, SAVE_W / rx, SAVE_H / ry);
  ctx.restore();
}
// 배경 옷이 없을 때: 사이트 무대(--stage)와 같은 어두운 그라데이션 + 위에서 비추는 빛 + 위쪽 주황 빛(조금) + 발밑이 조금 밝은 바닥
function drawStage(ctx) {
  const lg = ctx.createLinearGradient(0, 0, 0, SAVE_H);
  lg.addColorStop(0, '#26242e'); lg.addColorStop(0.62, '#1a1920'); lg.addColorStop(1, '#15141a');
  ctx.fillStyle = lg; ctx.fillRect(0, 0, SAVE_W, SAVE_H);
  ellipseGlow(ctx, SAVE_W * 0.5, SAVE_H * 0.36, SAVE_W * 0.8, SAVE_H * 0.58, [[0, 'rgba(255, 255, 255, 0.11)'], [0.7, 'rgba(255, 255, 255, 0)']]);
  ellipseGlow(ctx, SAVE_W * 0.5, 0, SAVE_W * 0.7, SAVE_H * 0.46, [[0, 'rgba(255, 122, 47, 0.13)'], [0.72, 'rgba(255, 122, 47, 0)']]);
  ellipseGlow(ctx, SAVE_W * 0.5, SAVE_LAYOUT.fit.bottom - 40, 430, 120, [[0, 'rgba(255, 255, 255, 0.06)'], [1, 'rgba(255, 255, 255, 0)']]);
}
// 캐릭터(1024 캔버스 전체, 배경 빼고)를 s 배 크기의 캔버스에 — 그림마다 한 번만 줄이고 늘린다(흐려지지 않게)
function drawCharacter(doc, plan, images, base, s) {
  const px = Math.ceil(SIZE * s), made = [];
  const layer = () => { const c = canvasOf(doc, px, px), x = c.getContext('2d'); x.setTransform(s, 0, 0, s, 0, 0); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; made.push(c); return x; };
  const ctx = layer();
  paintPlan(ctx, plan.ops, { get: (m) => images.get(artUrl(m, base)), layer, tint: (m, color) => tintedHair(doc, images.get(artUrl(m, base)), m, color) });
  for (const c of made.slice(1)) free(c);
  return ctx.canvas;
}
// 글자 그리기: 왼쪽부터 조각들을 이어서. → 끝 x
function drawRun(ctx, x, y, pieces) {
  for (const p of pieces) {
    setFont(ctx, p.weight, p.size, p.spacing || 0);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, x, y);
    x += ctx.measureText(p.text).width + (p.gap || 0);
  }
  return x;
}
function runWidth(ctx, pieces) {
  let w = 0;
  for (const p of pieces) { setFont(ctx, p.weight, p.size, p.spacing || 0); w += ctx.measureText(p.text).width + (p.gap || 0); }
  return w;
}
function roundRect(ctx, x, y, w, hgt, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hgt, r); ctx.arcTo(x + w, y + hgt, x, y + hgt, r);
  ctx.arcTo(x, y + hgt, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
// 아이콘 길(dom.js 의 24칸 아이콘과 같은 모양)
const HEART_ICON = 'M12 20.2s-7.6-4.5-7.6-10.4A4.3 4.3 0 0 1 12 7.1a4.3 4.3 0 0 1 7.6 2.7c0 5.9-7.6 10.4-7.6 10.4Z';
const HEADPHONES_ICON = ['M4 15v-3a8 8 0 0 1 16 0v3', 'M4 15a2 2 0 0 1 2-2h1v7H6a2 2 0 0 1-2-2Z', 'M20 15a2 2 0 0 0-2-2h-1v7h1a2 2 0 0 0 2-2Z'];
function drawIcon(ctx, paths, x, y, size, { fill = null, stroke = null, width = 1.8 } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size / 24, size / 24);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = width;
  for (const d of paths) { const p = new Path2D(d); if (fill) { ctx.fillStyle = fill; ctx.fill(p); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(p); } }
  ctx.restore();
}
function drawBand(ctx, card) {
  const L = SAVE_LAYOUT, left = L.pad, right = SAVE_W - L.pad, maxW = right - left;
  ctx.fillStyle = `rgba(${COLOR.bg}, 0.86)`; ctx.fillRect(0, L.band.y, SAVE_W, SAVE_H - L.band.y);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  // 1) 아이디: 앞 부분은 크게, "#이름"은 작고 옅게(사이트 글과 같은 모양). 길면 같이 줄인다.
  const { head, tag } = labelParts(card.id);
  const idPieces = (k) => [
    { text: head, weight: 800, size: Math.round(L.id.size * k), color: COLOR.text, spacing: -Math.round(L.id.size * k * 0.03) },
    ...(tag ? [{ text: tag, weight: 600, size: Math.round(L.id.size * L.id.tag * k), color: COLOR.text2, spacing: -1 }] : []),
  ];
  let k = 1;
  const w = runWidth(ctx, idPieces(1));
  if (w > maxW) k = Math.max(L.id.min, maxW / w);
  drawRun(ctx, left, L.id.y, idPieces(k));
  // 2) "Lv.10"(옅은 동그라미 안) · "할로윈 시즌" ……… 오른쪽 하트 수
  const lp = levelParts(card.level, card.seasonName);
  setFont(ctx, 800, L.sub.size);
  const lvW = ctx.measureText(lp.lv).width, pillW = lvW + 32, pillY = L.sub.y - L.sub.pill / 2 - Math.round(L.sub.size * 0.36);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; roundRect(ctx, left, pillY, pillW, L.sub.pill, L.sub.pill / 2); ctx.fill();
  drawRun(ctx, left + 16, L.sub.y, [{ text: lp.lv, weight: 800, size: L.sub.size, color: COLOR.text }]);
  if (lp.season) drawRun(ctx, left + pillW + 16, L.sub.y, [{ text: lp.season, weight: 600, size: L.sub.size, color: COLOR.text2 }]);
  const hearts = Number(card.hearts);
  if (Number.isFinite(hearts) && hearts > 0) {
    const num = Math.floor(hearts).toLocaleString('ko-KR');
    setFont(ctx, 700, L.sub.size);
    const nw = ctx.measureText(num).width, ic = 34;
    drawIcon(ctx, [HEART_ICON], right - nw - ic - 8, L.sub.y - ic + 6, ic, { fill: COLOR.accent, stroke: COLOR.accent });
    drawRun(ctx, right - nw, L.sub.y, [{ text: num, weight: 700, size: L.sub.size, color: COLOR.text }]);
  }
  // 3) 가는 선 + 사이트 표시(주황 로고 · 스푼 DJ 키우기 · 키우기.com) …… 오른쪽 "비공식 팬 사이트"
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'; ctx.fillRect(left, L.rule.y, maxW, 1.5);
  const lg = L.mark.logo, ly = L.mark.y - lg + 7;
  ctx.fillStyle = COLOR.accent; roundRect(ctx, left, ly, lg, lg, 10); ctx.fill();
  drawIcon(ctx, HEADPHONES_ICON, left + 6, ly + 6, lg - 12, { stroke: COLOR.accentInk, width: 2.2 });
  drawRun(ctx, left + lg + 14, L.mark.y, [
    { text: SITE_MARK, weight: 700, size: L.mark.size, color: COLOR.text, gap: 10 },
    { text: '·', weight: 500, size: L.mark.size, color: COLOR.text3, gap: 10 },
    { text: SITE_DOMAIN, weight: 600, size: L.mark.size, color: COLOR.text2 },
  ]);
  setFont(ctx, 500, 22);
  ctx.fillStyle = COLOR.text3; ctx.textAlign = 'right'; ctx.fillText(UNOFFICIAL_MARK, right, L.mark.y); ctx.textAlign = 'left';
}

// 글꼴(Pretendard — 쓰는 글자의 조각만 받는 글꼴이라 그릴 글자를 미리 받는다). 못 받으면 기기 글꼴로(최대 3초 기다림).
async function fontsReady(doc, text) {
  if (!doc.fonts?.load) return;
  const wait = Promise.all([800, 600].map((wgt) => doc.fonts.load(`${wgt} 40px "Pretendard Variable"`, text).catch(() => null))).then(() => doc.fonts.ready);
  await Promise.race([wait, new Promise((r) => setTimeout(r, 3000))]);
}

// card = {id, character(DJ 캐릭터), worn, level, expression(레벨 표정), seasonName, hearts} → 1080×1350 캔버스
export async function renderSaveImage(card, { base = '/', load = preloadImage, doc = document } = {}) {
  const plan = characterPlan(card.character || {}, { worn: card.worn && typeof card.worn === 'object' ? card.worn : {} }, card.expression);
  const urls = planUrls(plan, base), images = new Map();
  await Promise.all(urls.map(async (u) => { images.set(u, await load(u)); }));
  const lp = levelParts(card.level, card.seasonName);
  await fontsReady(doc, [card.id, lp.lv, lp.season, SITE_MARK, SITE_DOMAIN, UNOFFICIAL_MARK, '·0123456789,'].join(''));
  const L = SAVE_LAYOUT, canvas = canvasOf(doc, SAVE_W, SAVE_H), ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  // 1) 배경: 입은 배경 옷(잘라 채우기) 또는 기본 무대
  if (plan.background) {
    const r = coverRect(SIZE, SIZE);
    ctx.drawImage(images.get(artUrl(plan.background, base)), r.x, r.y, r.w, r.h);
  } else drawStage(ctx);
  // 2) 캐릭터를 먼저 그려 실제 크기를 재고(알파 상자) 그림 한가운데 자리를 정한다
  const ch = drawCharacter(doc, plan, images, base, L.char.s);
  const at = placeCharacter(alphaBox(ch.getContext('2d').getImageData(0, 0, ch.width, ch.height).data, ch.width, ch.height));
  // 3) 아래 띠로 이어지는 어둠(캐릭터 밑) · 발밑 그림자
  const fade = ctx.createLinearGradient(0, L.fade.from, 0, L.fade.to);
  fade.addColorStop(0, `rgba(${COLOR.bg}, 0)`); fade.addColorStop(1, `rgba(${COLOR.bg}, 0.86)`);
  ctx.fillStyle = fade; ctx.fillRect(0, L.fade.from, SAVE_W, L.fade.to - L.fade.from);
  ellipseGlow(ctx, L.center.x, at.bottom - 6, L.shadow.rx * at.f, L.shadow.ry * at.f, [[0, 'rgba(0, 0, 0, 0.55)'], [1, 'rgba(0, 0, 0, 0)']]);
  // 4) 캐릭터(줄여야 하면 한 번만 줄인다)
  ctx.drawImage(ch, at.x, at.y, ch.width * at.f, ch.height * at.f);
  free(ch);
  // 5) 아래 띠와 글
  drawBand(ctx, card);
  return canvas;
}
export function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    if (canvas.toBlob) canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG 를 만들지 못했어요.'))), 'image/png');
    else fetch(canvas.toDataURL('image/png')).then((r) => r.blob()).then(resolve, reject);
  });
}
const dataUrlOf = (blob) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(r.error); r.readAsDataURL(blob); });

// 내려받기(<a download> — 사이트 안 링크 가로채기(data-link)는 붙이지 않는다)
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name, rel: 'noopener', class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true' });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
const shareFile = (file) => navigator.share({ files: [file] });

// 그림을 보여 주는 창(앱 안 브라우저·공유가 안 될 때): 길게 눌러 저장 안내 + (공유가 되면) 저장하기 단추. 닫으면 단추로 초점을 돌려준다.
function previewSheet({ src, file, alt, returnTo }) {
  const canShare = Boolean(file && navigator.canShare?.({ files: [file] }));
  const title = h('h2', { class: 'kg-save-title', id: 'kg-save-title' }, '이미지가 준비됐어요');
  const behind = document.getElementById('app'); // 창이 열린 동안 뒤 화면은 누르거나 Tab 으로 갈 수 없게(inert)
  const close = () => { sheet.remove(); document.removeEventListener('keydown', onKey); if (behind) behind.inert = false; returnTo?.focus?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const shut = h('button', { type: 'button', class: 'btn btn-line', onclick: close }, '닫기');
  const save = canShare ? h('button', {
    type: 'button', class: 'btn btn-accent',
    onclick: async () => {
      try { await shareFile(file); close(); toast(SAVED); } catch (e) { if (e?.name !== 'AbortError') toast('저장하지 못했어요. 그림을 길게 눌러 저장해 주세요.', 'error'); }
    },
  }, icon('download', { size: 18 }), '저장하기') : null;
  const sheet = h('div', { class: 'kg-save-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'kg-save-title', onclick: (e) => { if (e.target === sheet) close(); } },
    h('div', { class: 'kg-save-card' },
      title,
      h('img', { class: 'kg-save-img', src, alt, width: String(SAVE_W), height: String(SAVE_H) }),
      h('p', { class: 'note' }, canShare ? '저장하기를 누르고 “이미지 저장”을 고르거나, 그림을 길게 눌러 저장해 주세요.' : '그림을 길게 눌러 “사진에 저장” 또는 “이미지 저장”을 골라 주세요.'),
      h('div', { class: 'kg-save-actions' }, save, shut)));
  document.body.append(sheet);
  if (behind) behind.inert = true;
  document.addEventListener('keydown', onKey);
  (save || shut).focus();
  return sheet;
}

// 만들고 저장하기. → 'shared' · 'downloaded' · 'preview' · 'cancelled'
export async function saveCharacterImage(card, { base = '/', returnTo = null } = {}) {
  const canvas = await renderSaveImage(card, { base });
  let blob;
  try { blob = await canvasBlob(canvas); } finally { free(canvas); }
  const name = saveFileName(card.id);
  const file = typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null;
  const canShareFiles = Boolean(file && navigator.canShare?.({ files: [file] }));
  const mode = saveMode({ ua: navigator.userAgent, touchPoints: navigator.maxTouchPoints || 0, canShareFiles });
  const alt = `${String(card.id ?? '')} 캐릭터 이미지`;
  if (mode === 'share') {
    try { await shareFile(file); toast(SAVED); return 'shared'; } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
      // 그리는 동안 단추를 누른 때가 지나 공유가 막히면(NotAllowedError) 그림 창의 저장하기 단추로 다시
    }
  }
  if (mode === 'download') { download(blob, name); toast(SAVED); return 'downloaded'; }
  previewSheet({ src: await dataUrlOf(blob), file, alt, returnTo });
  return 'preview';
}
