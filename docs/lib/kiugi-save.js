// 캐릭터 이미지로 저장(캐릭터 페이지의 "저장하기" 단추 — 캐릭터 그림 바로 아래 따로, 2026-10-09): 1080×1350(4:5) PNG 한 장.
//  모습(2026-10-18 사이트 새 디자인 — 룩북·포토카드): 입은 배경(배경 옷)이 그림 전체를 채우고(잘라 채우기 — 없으면 사이트 무대와 같은 밝은 스튜디오
//   — 연보랏빛 회색 그라데이션 + 위에서 비추는 흰 빛), 그 위에 캐릭터를 크게 가운데(발밑에 옅은 그림자 — 예전보다 약 15% 크게).
//   맨 위 한 줄에 "스푼 DJ 키우기 · 키우기.com" · 비공식 표시, 맨 아래에 "아이디#이름"(앞은 크게, #이름은 작고 옅게) · "Lv.N · 시즌" · 하트 수.
//   글 색: 밝은 스튜디오는 먹색 글, 어두운 배경 장면은 흰 글(위·아래만 살짝 어둡게 깔아 글이 잘 읽히게 — 캐릭터 밑에 깐다).
//  캐릭터는 kiugi-art.js 와 같은 규칙으로 캔버스에 직접 그린다 — SVG 를 그림으로 캔버스에 올리면 SVG 안의 바깥 그림 파일(href)을 읽지 못한다.
//   새 그림체 R7(2026-10-18 — 먼치킨 docs/20261018-kiugi-r7.md): 규칙은 Codex 패키지 renderer.js(캔버스) 그대로 — kiugi-art.js(SVG)도 같은 규칙이다.
//    뒷머리(머리색, 모자를 쓰면 모자의 머리 지우기 마스크로 자른다) → 몸 칸(기준 몸을 옷마다의 몸 지우기 마스크로 지운다 — 몸만 지우고 옷은 지우지 않는다 ·
//    신발을 신고 한벌옷·하의에 밑단이 있으면 신발과 신발의 몸 지우기를 신발 목 자르기 마스크(shaft — 앱 가져오기 도구가 renderer.js shaftClip 그대로 미리 만든 것)로 자르고
//    기본 운동화(feet)를 지운다 → 한벌옷 또는 하의·상의 → 신발 → 밑단(그 옷을 밑단 마스크 안만 다시 — 신발이 없어도)) → 눈·코·입(레벨 표정의 웃는 눈·눈물 눈·웃는 입) →
//    볼 발그레 → 앞머리(머리색, 모자로 자른다) → 악세사리(목 → 손 → 얼굴 → 머리, 하나씩 앞머리 모양만큼 지운다) → 모자 → 둥실 하트.
//   그릴 차례·마스크는 kiugi-art.js 의 함수(resolveLook·partOf·faceVariants·anchorsOf)로 정한다(시험이 layersOf·characterSvg 와 같은지 본다).
//   머리색(tone-map-v1): 머리 그림을 1024 임시 캔버스에 그려 getImageData 로 읽고 kiugi-hair-color.js 의 recolor(밝기 → 256단계 표, 알파는 원본 그대로)를 한 뒤
//    putImageData — 패키지 renderer.js 와 같은 방법. 물들인 머리는 packageId·판(tone-map-v1)·그림 id·해시·색으로 몇 장만 기억해 둔다.
//   그림 파일은 사이트와 같은 주소(같은 출처)라 캔버스가 막히지 않고, 화면이 이미 받아 둔 그림(preloadImage)을 그대로 쓴다.
//  저장(사용자 10/9 "저장하기 버튼을 따로" — 누르면 바로 저장, 따로 "공유" 단추는 없다):
//   PC·안드로이드 → 바로 내려받기(<a download> — 안드로이드는 갤러리의 다운로드 앨범에 들어간다).
//   바로 내려받을 수 없는 곳(아이폰·아이패드 — 사진 앱에 넣을 수 없다, 앱 안 브라우저(카카오톡 등)) → 파일을 담은 공유 창(“이미지 저장”을 고른다).
//   공유 창도 안 되면(예전 아이폰·앱 안 브라우저) → 그림을 보여 주고 길게 눌러 저장.
// DOM·캔버스는 함수 안에서만 쓴다(노드 시험에서 이 파일을 불러 그릴 차례·배치·글·파일 이름을 시험한다).
import hairColor, { recolor } from '../kiugi/kiugi-hair-color.js';
import { normalizeLook } from '../kiugi/kiugi-look.js';
import { SIZE, partOf, resolveLook, faceVariants, anchorsOf, ACCESSORY_ORDER } from '../kiugi/kiugi-art.js';
import { preloadImage, ART } from './kiugi-draw.js';
import { h, icon, toast, copyText } from './dom.js';

export const SAVE_W = 1080;
export const SAVE_H = 1350;
export const SITE_MARK = '스푼 DJ 키우기';
export const SITE_DOMAIN = '키우기.com';
export const UNOFFICIAL_MARK = '비공식 팬 사이트';
export const SAVE_LABEL = '저장하기';
export const SAVE_BUSY = '만드는 중…';
export const SAVED = '이미지를 저장했어요';
export const SAVE_FAILED = '이미지를 만들지 못했어요. 잠시 뒤에 다시 해 주세요.';
// 글·표시 색: studio = 밝은 스튜디오(배경 옷 없음 — 사이트 styles.css 의 먹색 글·장밋빛 하트) · scene = 어두운 배경 장면(흰 글)
export const SAVE_TONES = Object.freeze({
  studio: Object.freeze({ text: '#211b28', text2: '#5b5462', text3: '#736c7a', pill: 'rgba(33, 27, 40, 0.08)', heart: '#c33d60', logo: '#211b28', logoInk: '#fbf7f1' }),
  scene: Object.freeze({ text: '#fbf7f1', text2: 'rgba(251, 247, 241, 0.8)', text3: 'rgba(251, 247, 241, 0.66)', pill: 'rgba(255, 255, 255, 0.16)', heart: '#f2738f', logo: 'rgba(251, 247, 241, 0.95)', logoInk: '#211b28' }),
});
const SCRIM = '20, 16, 26'; // 배경 장면 위·아래에 까는 어둠(먹색)
const FONT = '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", system-ui, sans-serif';

// 배치(1080×1350). 캐릭터는 1024 캔버스 전체를 1.1배(char.s) 크기로 놓는다고 보고, 실제로 그려진 곳(알파 상자 — 모자·손 장식·둥실 하트 포함)을 재서
//  그 가운데가 그림 한가운데(540, 675)에 오게 놓는다(2026-10-09 사용자 "이미지 저장할 때 캐릭터를 정 중앙에"). 위로 fit.top, 아래 띠 위 fit.bottom 안에 들어가지 않으면 그만큼 줄인다(placeCharacter).
//  2026-10-18 새 디자인: 사이트 표시(로고 · 스푼 DJ 키우기 · 키우기.com · 비공식)는 맨 위 한 줄로 옮기고, 아래 글 칸(band — 아이디 · 레벨 줄)만 남겨
//   위아래로 쓸 수 있는 높이를 넓혔다 → 캐릭터 머리끝~발끝이 그림 높이의 약 74%(예전 65%). 가운데 자리(540, 675)는 그대로(사용자 10/9 "정 중앙에").
//  R7(2026-10-18): 캐릭터는 1024 캔버스에 겹쳐 그린 뒤(패키지 renderer.js 와 픽셀이 같다) 마지막에 한 번만 늘이고 줄인다 —
//   예전처럼 그림마다 1.1배로 늘린 뒤 마스크로 지우면 옷·몸 가장자리에 1px 테두리 차이가 생겼다. 그 뒤 줄이는 배수(f)와 합쳐 한 번(7등신이라 거의 0.98배).
const CHAR_S = 1.1;
export const SAVE_LAYOUT = Object.freeze({
  pad: 64,
  char: Object.freeze({ s: CHAR_S }),
  center: Object.freeze({ x: SAVE_W / 2, y: SAVE_H / 2 }),
  fit: Object.freeze({ top: 118, bottom: 1180, side: 40 }),
  shadow: Object.freeze({ rx: 190, ry: 26 }),
  scrim: Object.freeze({ top: 190 }), // 배경 장면일 때 맨 위 어둠(위 한 줄 글이 잘 읽히게 — 캐릭터 밑에 깐다)
  fade: Object.freeze({ from: 1010, to: SAVE_H }), // 배경 장면일 때 아래 글 칸으로 이어지는 어둠(캐릭터 밑에 깔아 배경만 어둡게)
  band: Object.freeze({ y: 1194 }), // 아래 글 칸(아이디 · 레벨 줄) 위 끝 — 캐릭터 발끝(fit.bottom)은 이보다 위
  id: Object.freeze({ y: 1268, size: 76, tag: 0.58, min: 0.55 }), // 아이디 글 아랫줄(앞 76px · #이름 0.58배), 길면 0.55배까지 줄인다
  sub: Object.freeze({ y: 1314, size: 28, pill: 40 }),
  mark: Object.freeze({ y: 78, size: 23, logo: 34 }), // 맨 위 사이트 표시 줄(글 아랫줄)
});
// 그린 캐릭터 캔버스의 알파 상자 {x0, y0, x1, y1}(그 캔버스 픽셀) · 아무것도 없으면 캔버스 전체
export function alphaBox(data, w, hgt, min = 16) {
  let x0 = w, y0 = hgt, x1 = -1, y1 = -1;
  for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > min) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? { x0: 0, y0: 0, x1: w, y1: hgt } : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}
// 고해상도로 그릴 칸(1024 좌표 [x, y, w, h] — 정수): 호환 그림의 알파 상자를 조금(4) 넉넉히, 캔버스 안
export function hdViewportOf(box, pad = 4) {
  const x0 = Math.max(0, Math.floor(box.x0) - pad), y0 = Math.max(0, Math.floor(box.y0) - pad);
  const x1 = Math.min(SIZE, Math.ceil(box.x1) + pad), y1 = Math.min(SIZE, Math.ceil(box.y1) + pad);
  return [x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)];
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

// ── 그릴 차례(kiugi-art.js characterSvg · 패키지 renderer.js 와 같은 차례·같은 규칙) ──
// 레벨 표정 겹치기(kiugi-art.js 의 blush·floatingHearts 와 같은 셈 — 얼굴 기준점 anchors.json 으로 자리·크기, 시험이 SVG 글과 같은지 본다)
const f1 = (v) => v.toFixed(1);
function blushSpots(g) {
  const A = anchorsOf(g), eye = A.eyes.right[0] - A.eyes.left[0], k = eye / 63, y = (A.nose[1] + A.mouth[1]) / 2 - 4 * k, dx = eye / 2 + 9 * k, cx = A.faceAxisX;
  return [cx - dx, cx + dx].map((x) => ({ cx: Number(f1(x)), cy: Number(f1(y)), rx: Number(f1(15 * k)), ry: Number(f1(8 * k)) }));
}
const heartPath = (x, y, s) => `M${f1(x)} ${f1(y + 0.9 * s)} C${f1(x - 1.2 * s)} ${f1(y + 0.1 * s)} ${f1(x - 0.9 * s)} ${f1(y - 0.9 * s)} ${f1(x)} ${f1(y - 0.3 * s)} C${f1(x + 0.9 * s)} ${f1(y - 0.9 * s)} ${f1(x + 1.2 * s)} ${f1(y + 0.1 * s)} ${f1(x)} ${f1(y + 0.9 * s)}Z`;
// 둥실 하트: 머리 위·옆(예전 그림의 머리 크기 162 를 1로 둔 자리 × R7 머리 크기). 모자를 쓰면 모자 챙 밖 머리 양옆으로. 테두리도 같은 비율.
const HEART_SPOTS = Object.freeze({
  flat: [[-100, -30, 13, '#FF8FB1'], [4, -72, 16, '#FF6F9C'], [102, -40, 12, '#FF8FB1']],
  tall: [[-186, 40, 13, '#FF8FB1'], [186, 20, 15, '#FF6F9C'], [184, 100, 11, '#FF8FB1']],
});
function floatingHearts(g, tall) {
  const A = anchorsOf(g), top = A.hairCrown[1], cx = A.faceAxisX, k = (A.chin[1] - top) / 162;
  return { width: Number((2 * k).toFixed(2)), hearts: HEART_SPOTS[tall ? 'tall' : 'flat'].map(([x, y, s, fill]) => ({ d: heartPath(cx + x * k, top + y * k, s * k), fill })) };
}

// DJ 캐릭터 + 입은 옷({worn}) + 레벨 표정 → {background(배경 그림 또는 null), ops:[{step, kind, …}]}
//  kind: image(그대로) · tint(머리색 tone-map-v1, 알파 그대로) · layer(따로 그려 한 번에 올리는 칸 — 몸 칸·모자에 잘린 머리·잘린 신발·앞머리에 가린 악세사리) ·
//   erase(그때까지 그린 칸을 mask 알파만큼 지우기 — mask 대신 ops 면 그 칸을 따로 그려 그 알파로 지운다) · hem(밑단: 그 옷을 마스크 알파 안만 다시) · blush · hearts
export function characterPlan(dj = {}, look = {}, expression = null) {
  const L = normalizeLook(dj), g = L.gender, R = resolveLook(look, g), V = faceVariants(expression);
  const color = L.hairColor; // 팔레트 열쇠(blond 등 — normalizeLook 이 예전 값도 열쇠로 맞춘다)
  const ops = [], hatHair = R.hat?.hair || null;
  const img = (step, a) => (a ? { step, kind: 'image', src: a } : null);
  // 머리(앞·뒤): 물들인 머리 — 모자를 쓰면 모자의 머리 지우기 마스크로 자른 칸
  const hair = (step, a) => { if (!a) return null; const t = { step, kind: 'tint', src: a, color }; return hatHair ? { step, kind: 'layer', ops: [t, { step: step + '.hat', kind: 'erase', mask: hatHair }] } : t; };
  const back = hair('hair.back', partOf('hair', g, L.hair, 'back'));
  if (back) ops.push(back);
  // 몸 칸: 기준 몸 → 지우기(옷마다 — 몸만) → 기본 운동화 지우기 → 옷 → 신발(신발 목 자르기) → 밑단
  const bodyA = partOf('body', g, 1), hem = R.outfit || R.bottom, footwear = Boolean(R.shoe && hem?.hem), shaft = footwear && hem.shaft ? hem.shaft : null;
  const body = [];
  if (bodyA) body.push(img('body', bodyA));
  for (const a of [R.outfit, R.bottom, R.top, R.shoe]) {
    if (!a?.cut) continue;
    // 신발의 몸 지우기는 신발 목 자르기만큼 덜 지운다(다리 맨살이 남는다 — renderer.js shoeLayer(bodyCutoutMask))
    body.push(a === R.shoe && shaft ? { step: 'body.cut', kind: 'erase', ops: [img('shoe.cut', a.cut), { step: 'shoe.cut.shaft', kind: 'erase', mask: shaft }] } : { step: 'body.cut', kind: 'erase', mask: a.cut });
  }
  if (footwear && bodyA?.feet) body.push({ step: 'body.feet', kind: 'erase', mask: bodyA.feet });
  for (const [name, a] of [['outfit', R.outfit], ['bottom', R.bottom], ['top', R.top]]) if (a) body.push(img(name, a));
  if (R.shoe) body.push(shaft ? { step: 'shoe', kind: 'layer', ops: [img('shoe', R.shoe), { step: 'shoe.shaft', kind: 'erase', mask: shaft }] } : img('shoe', R.shoe));
  if (hem?.hem) body.push({ step: (R.outfit ? 'outfit' : 'bottom') + '.hem', kind: 'hem', src: hem, mask: hem.hem });
  ops.push({ step: 'dressed', kind: 'layer', ops: body });
  // 눈·코·입(표정 판이 없으면 기본 그림 — characterSvg 와 같게)
  for (const [c, v] of [['eyes', V.eyes], ['nose', ''], ['mouth', V.mouth]]) { const a = img(c, partOf(c, g, L[c], v) || partOf(c, g, L[c])); if (a) ops.push(a); }
  if (V.blush) ops.push({ step: 'exp-blush', kind: 'blush', spots: blushSpots(g) });
  const frontA = partOf('hair', g, L.hair, 'front'), front = hair('hair.front', frontA);
  if (front) ops.push(front);
  // 악세사리: 하나씩, (모자에 잘린) 앞머리 모양만큼 지운다 — 안경테·끈이 앞머리 가닥 위에 떠 보이지 않게(renderer.js)
  const clip = frontA ? [img('hair.front.shape', frontA), ...(hatHair ? [{ step: 'hair.front.shape.hat', kind: 'erase', mask: hatHair }] : [])] : null;
  for (const s of ACCESSORY_ORDER) {
    const a = R.acc[s];
    if (!a) continue;
    ops.push(clip ? { step: 'accessory.' + s, kind: 'layer', ops: [img('accessory.' + s, a), { step: `accessory.${s}.clip`, kind: 'erase', ops: clip }] } : img('accessory.' + s, a));
  }
  if (R.hat) ops.push(img('hat', R.hat));
  if (V.hearts) ops.push({ step: 'exp-floating-hearts', kind: 'hearts', ...floatingHearts(g, Boolean(R.hat)) });
  return { background: R.background || null, ops };
}
// 차례를 한 줄로(칸 안 단계 포함 — 따로 그린 지우기 칸(erase 의 ops)은 그 단계 이름 하나) — 시험·확인용
export function planSteps(plan) {
  const out = [];
  const walk = (ops) => { for (const op of ops) { if (op.kind === 'layer') walk(op.ops); else out.push(op.step); } };
  if (plan.background) out.push('background');
  walk(plan.ops);
  return out;
}
// 그림 파일 주소(사이트 BASE 아래 — 화면 SVG 와 같은 글이라 이미 받아 둔 그림을 그대로 쓴다). 공통 배경은 /kiugi/bg/(그림 정보 dir), 그 밖·마스크는 /kiugi/r7/. 배경 → 차례대로, 겹치지 않게.
export const artUrl = (m, base = '/') => `${m.dir || ART.dir}${m.file}?v=${m.v}`.replace(/^\/kiugi\//, (String(base).endsWith('/') ? base : base + '/') + 'kiugi/');
export function planUrls(plan, base = '/') {
  const out = [];
  const add = (m) => { if (m) { const u = artUrl(m, base); if (!out.includes(u)) out.push(u); } };
  add(plan.background);
  const walk = (ops) => { for (const op of ops) { if (op.ops) walk(op.ops); add(op.src); add(op.mask); } };
  walk(plan.ops);
  return out;
}

// 머리 물들이기(패키지 renderer.js tinted 와 같은 방법): 머리 그림을 1024 캔버스에 그려 픽셀을 읽고 recolor(밝기 → RGB 표, 알파 그대로) → putImageData.
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
//  tint(그림 정보, 색) → 물들인 1024 머리 캔버스(tintedHair), done(ctx) → 다 쓴 칸(캔버스 메모리를 바로 돌려준다 — 없어도 된다)
//  마스크: 지우기 = destination-out(그때까지 그 칸에 그린 것 × (1 − 마스크 알파)), 밑단 = destination-in(그 옷 × 마스크 알파) — SVG <mask mask-type="alpha"> 와 같다.
//   지우기 마스크가 여러 그림을 겹친 것(erase 의 ops — 신발 목만큼 덜 지우는 신발 지우기 · 모자에 잘린 앞머리 모양)이면 그 칸을 따로 그려 그 알파로 지운다.
//  머리색: 물들인 머리 캔버스를 그대로 올린다(SVG 의 명도 표 필터와 같은 표 — 다른 곱하기를 다시 하지 않는다).
export function paintPlan(ctx, ops, opts) {
  const { get, layer, tint, done = null } = opts;
  const blit = (to, from, mode = 'source-over') => { to.save(); to.setTransform(1, 0, 0, 1, 0, 0); to.globalCompositeOperation = mode; to.drawImage(from.canvas, 0, 0); to.restore(); };
  const full = (c, im) => c.drawImage(im, 0, 0, SIZE, SIZE);
  const sub = (list) => { const t = layer(); paintPlan(t, list, opts); return t; };
  for (const op of ops) {
    if (op.kind === 'image') full(ctx, get(op.src));
    else if (op.kind === 'tint') full(ctx, tint(op.src, op.color));
    else if (op.kind === 'layer') { const t = sub(op.ops); blit(ctx, t); done?.(t); }
    else if (op.kind === 'erase') {
      if (op.ops) { const t = sub(op.ops); blit(ctx, t, 'destination-out'); done?.(t); }
      else { ctx.save(); ctx.globalCompositeOperation = 'destination-out'; full(ctx, get(op.mask)); ctx.restore(); }
    } else if (op.kind === 'hem') {
      const t = layer();
      full(t, get(op.src));
      t.globalCompositeOperation = 'destination-in'; full(t, get(op.mask));
      blit(ctx, t); done?.(t);
    } else if (op.kind === 'blush') {
      for (const s of op.spots) {
        ctx.save(); ctx.translate(s.cx, s.cy); ctx.scale(s.rx, s.ry);
        const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        gr.addColorStop(0, 'rgba(255, 111, 142, 0.5)'); gr.addColorStop(1, 'rgba(255, 111, 142, 0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    } else if (op.kind === 'hearts') {
      ctx.save(); ctx.lineWidth = op.width ?? 2; ctx.strokeStyle = '#FFFFFF'; ctx.miterLimit = 4; // SVG 기본 miterlimit 4(캔버스 기본 10 — 하트 끝이 뾰족하게 길어지지 않게)
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

// 앱 안 브라우저(2026-10-16 사용자: 스푼 앱 안에서 키우기 사이트를 열면 그림을 길게 눌러도 "이미지 저장"이 안 뜬다): 'ios' · 'android' · ''
//  아이폰 앱 안 브라우저는 UA 에 "Safari/" 가 없다(사파리·크롬·파이어폭스·엣지 앱은 있다). 안드로이드 앱 안 브라우저는 "; wv)".
const IN_APP = /KAKAOTALK|Instagram|FBAN|FBAV|NAVER\(inapp|\bLine\/|DaumApps/i;
export function inAppKind(ua = '', touchPoints = 0) {
  const apple = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && touchPoints > 1);
  if (apple) return !/Safari\//.test(ua) || IN_APP.test(ua) ? 'ios' : '';
  if (/Android/i.test(ua)) return /; wv\)/.test(ua) || IN_APP.test(ua) ? 'android' : '';
  return '';
}
// 이 페이지를 저장 안내(?save=1)와 함께 여는 주소
export function saveLinkUrl(href) {
  let u; try { u = new URL(href); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  u.searchParams.set('save', '1'); u.hash = '';
  return u.href;
}
// 바깥 브라우저로 여는 주소. 아이폰: x-safari-https://…(iOS 17 부터 사파리로 열린다) · 안드로이드: intent://…(기본 브라우저). 앱이 막으면 아무 일도 없다 → 주소 복사.
export function externalUrl(href, kind) {
  const link = saveLinkUrl(href);
  if (!link) return null;
  const u = new URL(link);
  if (kind === 'ios') return 'x-safari-' + u.href;
  if (kind === 'android') return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.slice(0, -1)};end`;
  return null;
}

// 함께하는 펫(2026-10-16 사용자 "펫도 같이 사진 찍게 해 줘"): 캐릭터 오른쪽에 같은 바닥선으로 서고, 둘을 한 무리로 가운데에 둔다.
//  펫 그림(pets/<시즌>/pet_<id>_<단계>.png)은 512×512 · 모든 단계가 같은 바닥선(y=470)·같은 배율이라 단계가 오를수록 커 보인다(따로 늘리지 않는다).
export const PET_GROUND = 470 / 512;
// 펫 캔버스 = 캐릭터 캔버스(1024 × 1.1 × 줄인 배수)의 0.46배 — 보이는 펫 높이가 캐릭터 키의 약 ★1 23% · ★3 33% · ★5 43%
//  (2026-10-18 새 그림체: 예전 0.66배는 ★3 부터 캐릭터 키의 절반을 넘어 펫이 캐릭터만큼 커 보였다)
export const PET_SCALE = 0.69; // 2026-10-18 사용자 "펫 1.5배 더" (0.46 → 0.69)
const PET_PART = /^[a-z0-9_-]{1,40}$/;
export function savePetUrl(pet, base = '/') {
  if (!pet || !PET_PART.test(String(pet.id || '')) || !PET_PART.test(String(pet.season || ''))) return null;
  const stage = Math.min(5, Math.max(1, Math.floor(Number(pet.stage)) || 1));
  return `${base}pets/${pet.season}/pet_${pet.id}_${stage}.png`;
}
// charBox: 캐릭터가 그려진 곳(그림 좌표 x0·x1) · petBox: 펫 캔버스 안 알파 상자 · size: 펫 캔버스 크기 · bottom: 발끝 y
//  → {dx(캐릭터를 옮길 만큼), x, y(펫 캔버스를 놓을 곳)}. 펫은 캐릭터와 12% 겹친다. 그림 옆 여백(fit.side) 안에 들어가게.
export function placePet(charBox, petBox, size, bottom, { side = SAVE_LAYOUT.fit.side } = {}) {
  const cw = charBox.x1 - charBox.x0, pw = petBox.x1 - petBox.x0, overlap = Math.round(pw * 0.12);
  const group = cw + pw - overlap;
  const left = Math.min(Math.max(side, (SAVE_W - group) / 2), SAVE_W - side - group);
  return { dx: Math.round(left - charBox.x0), x: Math.round(left + cw - overlap - petBox.x0), y: Math.round(bottom - size * PET_GROUND) };
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
// 배경 옷이 없을 때: 사이트 무대(styles.css --stage)와 같은 밝은 스튜디오 — 연보랏빛 회색 그라데이션(아래로 조금 짙게) + 위에서 비추는 흰 빛 +
//  벽과 바닥이 만나는 옅은 띠(발 조금 위부터 아래로) + 위 오른쪽의 아주 옅은 보랏빛
function drawStage(ctx) {
  const lg = ctx.createLinearGradient(0, 0, 0, SAVE_H);
  lg.addColorStop(0, '#eee9f1'); lg.addColorStop(0.62, '#e4dde9'); lg.addColorStop(1, '#d8d0de');
  ctx.fillStyle = lg; ctx.fillRect(0, 0, SAVE_W, SAVE_H);
  ellipseGlow(ctx, SAVE_W * 0.5, SAVE_H * 0.32, SAVE_W * 0.64, SAVE_H * 0.46, [[0, 'rgba(255, 255, 255, 0.9)'], [0.72, 'rgba(255, 255, 255, 0)']]);
  ellipseGlow(ctx, SAVE_W * 0.92, 0, SAVE_W * 0.6, SAVE_H * 0.34, [[0, 'rgba(176, 140, 214, 0.18)'], [1, 'rgba(176, 140, 214, 0)']]);
  const floor = SAVE_LAYOUT.fit.bottom - 170, fl = ctx.createLinearGradient(0, floor, 0, SAVE_H);
  fl.addColorStop(0, 'rgba(255, 255, 255, 0)'); fl.addColorStop(0.18, 'rgba(255, 255, 255, 0.22)'); fl.addColorStop(1, 'rgba(150, 132, 168, 0.18)');
  ctx.fillStyle = fl; ctx.fillRect(0, floor, SAVE_W, SAVE_H - floor);
}
// 배경 장면일 때 위·아래 어둠(글이 잘 읽히게 — 캐릭터 밑에 깔아 배경만 어둡게)
function drawScrims(ctx) {
  const L = SAVE_LAYOUT;
  const top = ctx.createLinearGradient(0, 0, 0, L.scrim.top);
  top.addColorStop(0, `rgba(${SCRIM}, 0.5)`); top.addColorStop(1, `rgba(${SCRIM}, 0)`);
  ctx.fillStyle = top; ctx.fillRect(0, 0, SAVE_W, L.scrim.top);
  const fade = ctx.createLinearGradient(0, L.fade.from, 0, L.fade.to);
  fade.addColorStop(0, `rgba(${SCRIM}, 0)`); fade.addColorStop(0.55, `rgba(${SCRIM}, 0.55)`); fade.addColorStop(1, `rgba(${SCRIM}, 0.8)`);
  ctx.fillStyle = fade; ctx.fillRect(0, L.fade.from, SAVE_W, L.fade.to - L.fade.from);
}
// 캐릭터(1024 캔버스 전체, 배경 빼고)를 s 배 크기의 캔버스에(저장하기는 s = 1 — 패키지 renderer.js 와 같은 1024 캔버스, 시험이 픽셀로 견준다). images: 주소(artUrl) → 받아 둔 그림.
//  다 쓴 칸은 바로 비운다(아이폰 캔버스 메모리 — 한꺼번에 살아 있는 칸은 몇 개뿐).
export function characterCanvas(doc, plan, images, { base = '/', s = 1 } = {}) {
  const px = Math.ceil(SIZE * s), made = new Set();
  const layer = () => { const c = canvasOf(doc, px, px), x = c.getContext('2d'); x.setTransform(s, 0, 0, s, 0, 0); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; made.add(c); return x; };
  const ctx = layer();
  made.delete(ctx.canvas);
  paintPlan(ctx, plan.ops, {
    get: (m) => images.get(artUrl(m, base)), layer,
    tint: (m, color) => tintedHair(doc, images.get(artUrl(m, base)), m, color),
    done: (t) => { made.delete(t.canvas); free(t.canvas); },
  });
  for (const c of made) free(c);
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
// 글(tone = studio | scene — SAVE_TONES): 맨 위 사이트 표시 한 줄 + 맨 아래 아이디 · 레벨 줄
function drawBand(ctx, card, tone = 'studio') {
  const L = SAVE_LAYOUT, C = SAVE_TONES[tone] || SAVE_TONES.studio, left = L.pad, right = SAVE_W - L.pad, maxW = right - left;
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  // 1) 맨 위: 로고(먹색 네모 — 배경 장면이면 흰 네모) · 스푼 DJ 키우기 · 키우기.com …… 오른쪽 "비공식 팬 사이트"
  const lg = L.mark.logo, ly = L.mark.y - lg + 8;
  ctx.fillStyle = C.logo; roundRect(ctx, left, ly, lg, lg, 10); ctx.fill();
  drawIcon(ctx, HEADPHONES_ICON, left + 6, ly + 6, lg - 12, { stroke: C.logoInk, width: 2.2 });
  drawRun(ctx, left + lg + 14, L.mark.y, [
    { text: SITE_MARK, weight: 800, size: L.mark.size, color: C.text, gap: 10, spacing: -0.5 },
    { text: '·', weight: 500, size: L.mark.size, color: C.text3, gap: 10 },
    { text: SITE_DOMAIN, weight: 600, size: L.mark.size, color: C.text2 },
  ]);
  setFont(ctx, 600, 21);
  ctx.fillStyle = C.text3; ctx.textAlign = 'right'; ctx.fillText(UNOFFICIAL_MARK, right, L.mark.y); ctx.textAlign = 'left';
  // 2) 아이디: 앞 부분은 크게, "#이름"은 작고 옅게(사이트 글과 같은 모양). 길면 같이 줄인다.
  const { head, tag } = labelParts(card.id);
  const idPieces = (k) => [
    { text: head, weight: 800, size: Math.round(L.id.size * k), color: C.text, spacing: -Math.round(L.id.size * k * 0.035) },
    ...(tag ? [{ text: tag, weight: 600, size: Math.round(L.id.size * L.id.tag * k), color: C.text2, spacing: -1 }] : []),
  ];
  let k = 1;
  const w = runWidth(ctx, idPieces(1));
  if (w > maxW) k = Math.max(L.id.min, maxW / w);
  drawRun(ctx, left, L.id.y, idPieces(k));
  // 3) "Lv.10"(옅은 동그라미 안) · "할로윈 시즌" ……… 오른쪽 하트 수
  const lp = levelParts(card.level, card.seasonName);
  setFont(ctx, 800, L.sub.size);
  const lvW = ctx.measureText(lp.lv).width, pillW = lvW + 32, pillY = L.sub.y - L.sub.pill / 2 - Math.round(L.sub.size * 0.36);
  ctx.fillStyle = C.pill; roundRect(ctx, left, pillY, pillW, L.sub.pill, L.sub.pill / 2); ctx.fill();
  drawRun(ctx, left + 16, L.sub.y, [{ text: lp.lv, weight: 800, size: L.sub.size, color: C.text }]);
  if (lp.season) drawRun(ctx, left + pillW + 16, L.sub.y, [{ text: lp.season, weight: 600, size: L.sub.size, color: C.text2 }]);
  const hearts = Number(card.hearts);
  if (Number.isFinite(hearts) && hearts > 0) {
    const num = Math.floor(hearts).toLocaleString('ko-KR');
    setFont(ctx, 800, L.sub.size);
    const nw = ctx.measureText(num).width, ic = 34;
    drawIcon(ctx, [HEART_ICON], right - nw - ic - 8, L.sub.y - ic + 6, ic, { fill: C.heart, stroke: C.heart });
    drawRun(ctx, right - nw, L.sub.y, [{ text: num, weight: 800, size: L.sub.size, color: C.text }]);
  }
}

// 글꼴(Pretendard — 쓰는 글자의 조각만 받는 글꼴이라 그릴 글자를 미리 받는다). 못 받으면 기기 글꼴로(최대 3초 기다림).
async function fontsReady(doc, text) {
  if (!doc.fonts?.load) return;
  const wait = Promise.all([800, 600].map((wgt) => doc.fonts.load(`${wgt} 40px "Pretendard Variable"`, text).catch(() => null))).then(() => doc.fonts.ready);
  await Promise.race([wait, new Promise((r) => setTimeout(r, 3000))]);
}

// 고해상도 캐릭터(2026-10-18 R9): hd({dj, look, expression, viewport, scale, base}) → {canvas} | null (lib/kiugi-hd.js renderHdCharacter — 캐릭터 페이지가 넘겨 준다).
//  자리·크기는 지금처럼 호환 그림(1024)의 알파 상자로 정하고, 그 칸만 고해상도로 저장 그림 크기(char.s × 줄인 배수)에 바로 그려 그대로 올린다(늘이고 줄이지 않는다).
//  고해상도로 그릴 수 없는 모습이거나 HD_WAIT 안에 못 그리면 호환 그림 그대로. hd 를 안 주면(노드 시험) 호환 그림.
export const HD_WAIT = 15000;
// card = {id, character(DJ 캐릭터), worn, level, expression(레벨 표정), seasonName, hearts, pet({id, season, stage} — 함께하는 펫, 없으면 null)} → 1080×1350 캔버스
export async function renderSaveImage(card, { base = '/', load = preloadImage, doc = document, hd = null } = {}) {
  const plan = characterPlan(card.character || {}, { worn: card.worn && typeof card.worn === 'object' ? card.worn : {} }, card.expression);
  const urls = planUrls(plan, base), images = new Map();
  await Promise.all(urls.map(async (u) => { images.set(u, await load(u)); }));
  // 펫 그림은 못 읽어도 캐릭터만으로 저장한다
  const petSrc = savePetUrl(card.pet, base);
  let petImg = null;
  if (petSrc) { try { petImg = await load(petSrc); } catch { petImg = null; } }
  const lp = levelParts(card.level, card.seasonName);
  await fontsReady(doc, [card.id, lp.lv, lp.season, SITE_MARK, SITE_DOMAIN, UNOFFICIAL_MARK, '·0123456789,'].join(''));
  const L = SAVE_LAYOUT, canvas = canvasOf(doc, SAVE_W, SAVE_H), ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  // 1) 배경: 입은 배경 옷(잘라 채우기) 또는 기본 무대
  if (plan.background) {
    const r = coverRect(SIZE, SIZE);
    ctx.drawImage(images.get(artUrl(plan.background, base)), r.x, r.y, r.w, r.h);
  } else drawStage(ctx);
  // 2) 캐릭터를 먼저 1024 캔버스에 그려 실제 크기를 재고(알파 상자 — char.s 배로 놓은 크기로 바꿔) 그림 한가운데 자리를 정한다
  const ch = characterCanvas(doc, plan, images, { base, s: 1 }), s = L.char.s;
  const raw = alphaBox(ch.getContext('2d').getImageData(0, 0, ch.width, ch.height).data, ch.width, ch.height);
  const chBox = { x0: raw.x0 * s, y0: raw.y0 * s, x1: raw.x1 * s, y1: raw.y1 * s };
  const at = placeCharacter(chBox);
  // 함께하는 펫: 캐릭터와 같은 비율로 그려 크기를 재고(알파 상자), 캐릭터 오른쪽에 같은 바닥선으로 — 둘을 한 무리로 가운데에
  let dx = 0, pet = null;
  if (petImg) {
    const size = Math.round(SIZE * L.char.s * at.f * PET_SCALE), pc = canvasOf(doc, size, size), px = pc.getContext('2d');
    px.imageSmoothingEnabled = true; px.imageSmoothingQuality = 'high';
    px.drawImage(petImg, 0, 0, size, size);
    const box = alphaBox(px.getImageData(0, 0, size, size).data, size, size);
    const spot = placePet({ x0: at.x + chBox.x0 * at.f, x1: at.x + chBox.x1 * at.f }, box, size, at.bottom);
    dx = spot.dx; pet = { canvas: pc, box, ...spot };
  }
  // 3) 배경 장면이면 위·아래 어둠(캐릭터 밑 — 글이 잘 읽히게) · 발밑 그림자(밝은 스튜디오는 옅은 보랏빛 그림자)
  const tone = plan.background ? 'scene' : 'studio';
  if (tone === 'scene') drawScrims(ctx);
  const shade = tone === 'scene' ? '0, 0, 0' : '58, 44, 72', deep = tone === 'scene' ? 0.55 : 0.32;
  ellipseGlow(ctx, L.center.x + dx, at.bottom - 6, L.shadow.rx * at.f, L.shadow.ry * at.f, [[0, `rgba(${shade}, ${deep})`], [1, `rgba(${shade}, 0)`]]);
  if (pet) ellipseGlow(ctx, pet.x + (pet.box.x0 + pet.box.x1) / 2, at.bottom - 4, (pet.box.x1 - pet.box.x0) * 0.42, L.shadow.ry * at.f * 0.8, [[0, `rgba(${shade}, ${deep - 0.04})`], [1, `rgba(${shade}, 0)`]]);
  // 4) 캐릭터(1024 그림을 char.s × 줄이는 배수로 한 번만 — 고해상도면 그 크기로 바로 그린 것) · 그 앞에 펫
  const S = s * at.f;
  let hdDone = false;
  if (hd) {
    const v = hdViewportOf(raw);
    let timer = 0;
    const job = Promise.resolve().then(() => hd({ dj: card.character || {}, look: { worn: card.worn && typeof card.worn === 'object' ? card.worn : {} }, expression: card.expression, viewport: v, scale: S, base }));
    try {
      const out = await Promise.race([job, new Promise((resolve) => { timer = setTimeout(() => resolve(null), HD_WAIT); })]);
      if (out?.canvas) { ctx.drawImage(out.canvas, Math.round(at.x + dx + v[0] * S), Math.round(at.y + v[1] * S)); free(out.canvas); hdDone = true; }
      else job.then((late) => free(late?.canvas), () => {}); // 늦게 끝난 고해상도 캔버스는 바로 비운다
    } catch (e) { console.warn('저장 그림을 고해상도로 그리지 못해 호환 그림으로 저장해요:', e?.message || e); }
    finally { clearTimeout(timer); }
  }
  if (!hdDone) ctx.drawImage(ch, at.x + dx, at.y, ch.width * S, ch.height * S);
  free(ch);
  if (pet) { ctx.drawImage(pet.canvas, pet.x, pet.y); free(pet.canvas); }
  // 5) 맨 위 사이트 표시 · 맨 아래 아이디 · 레벨 줄
  drawBand(ctx, card, tone);
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
//  앱 안 브라우저(스푼·카카오톡 등 — 길게 눌러도 저장이 안 뜨는 곳, 2026-10-16): Safari(브라우저)에서 열어 저장하기 · 주소 복사 · 이미지 복사(되는 곳만).
function previewSheet({ src, file, blob, alt, returnTo }) {
  const kind = inAppKind(navigator.userAgent, navigator.maxTouchPoints || 0);
  if (kind) return inAppSheet({ src, blob, alt, returnTo, kind });
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
export const OPEN_OUTSIDE = { ios: 'Safari에서 열어 저장하기', android: '브라우저에서 열어 저장하기' };
export const IN_APP_NOTE = '앱 안에서는 그림을 길게 눌러도 저장이 안 될 수 있어요. 위 단추를 누르면 이 캐릭터 페이지가 브라우저에서 열려요. 거기서 저장하기를 눌러 주세요.';
function inAppSheet({ src, blob, alt, returnTo, kind }) {
  const title = h('h2', { class: 'kg-save-title', id: 'kg-save-title' }, '이미지가 준비됐어요');
  const behind = document.getElementById('app');
  const close = () => { sheet.remove(); document.removeEventListener('keydown', onKey); if (behind) behind.inert = false; returnTo?.focus?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const outside = externalUrl(location.href, kind), link = saveLinkUrl(location.href);
  // 바깥 브라우저 열기: 앱이 막으면 아무 일도 없다 → 1.5초 뒤에도 이 화면이면 주소 복사를 권한다
  const open = outside ? h('a', {
    class: 'btn btn-accent kg-save-out', href: outside, rel: 'noopener',
    onclick: () => { setTimeout(() => { if (document.visibilityState === 'visible' && sheet.isConnected) toast('열리지 않으면 “주소 복사”를 눌러 Safari나 크롬 주소창에 붙여 넣어 주세요.'); }, 1500); },
  }, icon('share', { size: 18 }), OPEN_OUTSIDE[kind]) : null;
  const copyLink = link ? h('button', {
    type: 'button', class: 'btn btn-line',
    onclick: async () => { const ok = await copyText(link); toast(ok ? '주소를 복사했어요. Safari나 크롬 주소창에 붙여 넣어 열어 주세요.' : '복사하지 못했어요. 그림을 길게 눌러 저장해 보세요.', ok ? 'info' : 'error'); },
  }, icon('link', { size: 18 }), '주소 복사') : null;
  const canCopyImage = Boolean(blob && typeof ClipboardItem === 'function' && navigator.clipboard?.write);
  const copyImage = canCopyImage ? h('button', {
    type: 'button', class: 'btn btn-line',
    onclick: async () => {
      try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); toast('이미지를 복사했어요. 카카오톡 나와의 채팅이나 메모에 붙여 넣은 뒤 저장해 주세요.'); }
      catch { toast('이 앱에서는 이미지 복사가 안 돼요. 브라우저에서 열어 저장해 주세요.', 'error'); }
    },
  }, icon('copy', { size: 18 }), '이미지 복사') : null;
  const shut = h('button', { type: 'button', class: 'btn btn-line', onclick: close }, '닫기');
  const sheet = h('div', { class: 'kg-save-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'kg-save-title', onclick: (e) => { if (e.target === sheet) close(); } },
    h('div', { class: 'kg-save-card' },
      title,
      h('img', { class: 'kg-save-img', src, alt, width: String(SAVE_W), height: String(SAVE_H) }),
      open,
      h('p', { class: 'note' }, IN_APP_NOTE),
      h('div', { class: 'kg-save-actions kg-save-more' }, copyLink, copyImage),
      h('div', { class: 'kg-save-actions' }, shut)));
  document.body.append(sheet);
  if (behind) behind.inert = true;
  document.addEventListener('keydown', onKey);
  (open || copyLink || shut).focus();
  return sheet;
}
// 바깥 브라우저에서 ?save=1 로 열렸을 때(캐릭터 페이지): 저장하기 단추로 데려가 알려 준다(공유 창은 누를 때만 열 수 있어 저절로 열지는 않는다)
export function hintSaveButton(btn, search = location.search) {
  if (!btn || new URLSearchParams(search).get('save') !== '1') return false;
  setTimeout(() => { btn.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); btn.classList.add('kg-save-hint'); toast('저장하기를 누르면 사진에 저장돼요'); }, 400);
  return true;
}

// 만들고 저장하기. → 'shared' · 'downloaded' · 'preview' · 'cancelled'
export async function saveCharacterImage(card, { base = '/', returnTo = null, hd = null } = {}) {
  const canvas = await renderSaveImage(card, { base, hd });
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
  previewSheet({ src: await dataUrlOf(blob), file, blob, alt, returnTo });
  return 'preview';
}
