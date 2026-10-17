// DJ 키우기 그림(새 그림체 R7, 2026-10-18 — Codex 패키지 DJ_STYLE_TEST_20261017_EDGES_R7, 사용자 승인. 다음 R8 은 외곽선만 굵게 — 파일 이름·id·번호가 같아 이 규칙 그대로).
//  방송 관리 창과 키우기 사이트가 같은 파일로 그린다(문서·DOM 없이 SVG 글을 만든다).
// 그림 파일: app/public/kiugi/r7/*.png(tools/import-kiugi-r7.mjs 가 패키지에서 해시를 확인해 복사) + 공통 배경 app/public/kiugi/bg/(그림체와 상관없는 장면 10장 — V5 에서 옮김),
//  목록은 kiugi-r7-data.js(만든 파일), 머리색은 kiugi-hair-color.js(패키지 hair-color.js 와 같은 결과 — 가져오기 도구가 확인).
// 규칙(패키지 renderer.js 를 그대로 SVG 로 — 실제 브라우저에서 renderer.js 와 픽셀로 견줘 확인, docs/20261018-kiugi-r7.md):
//  · 모든 PNG·마스크는 같은 1024×1024 캔버스의 (0,0)에 그대로 겹친다. 그림마다 잘라 내거나 가운데 맞추지 않는다(화면 크기는 캔버스 전체를 줄일 뿐).
//  · 순서: 배경(공통, 불투명 — 패키지에는 없고 앱이 맨 아래에 깐다) → 뒷머리(머리색) → 기준 몸(지우기 마스크로 몸만 지운다) → 한벌옷 또는 하의·상의 → 신발 →
//    밑단(한벌옷·하의의 밑단 마스크로 남긴 부분을 신발 위에) → 눈 → 코 → 입 → 앞머리(머리색) → 악세사리(자리마다 하나, 앞머리에 가린다) → 모자.
//  · 지우기 마스크(bodyCutoutMask)는 기준 몸만 지운다(먼저 그린 옷을 지우지 않는다 — renderer.js 의 몸 캔버스). 한벌옷을 입으면 상의·하의는 그리지 않는다.
//  · 신발을 신고 한벌옷·하의에 밑단 마스크가 있으면: 신발(과 신발의 몸 지우기)을 신발 목 자르기 마스크(shaft — 가져오기 도구가 renderer.js shaftClip 그대로 미리 만든 것)로 자르고,
//    기준 몸의 기본 운동화(defaultFootwearMask)를 지운다. 밑단은 신발을 골랐든 아니든 밑단 마스크가 있으면 다시 그린다(renderer.js 그대로).
//  · 모자를 쓰면 앞·뒷머리를 모자의 머리 지우기 마스크(hairCutoutMask)로 자른다. 악세사리는 (모자에 잘린) 앞머리 모양만큼 지운다 — 앞머리 가닥 위에 떠 보이지 않게.
//  · 머리색(tone-map-v1): 머리 그림의 밝기 l = 0.2126R + 0.7152G + 0.0722B 를 색마다 정한 256단계 표로 바꾸고 알파는 그대로(renderer.js 의 캔버스 recolor 와 같은 표).
//    R7 머리 그림은 아주 옅은 색이 섞여 있어(완전한 회색이 아니다) 밝기를 먼저 구한다(feColorMatrix → feComponentTransfer table, sRGB). 몸·옷·눈에는 쓰지 않는다.
//  · 마스크는 그림의 알파만 쓴다. SVG 에서는 <mask mask-type="alpha"> 안에서 흰색 + 알파 뒤집기(지우기 = 1−a) 또는 그대로(남기기)로 쓴다.
//  · 머리·눈·코·입은 캐릭터 성별 전용 그림(반대 성별 id 를 쓰지 않는다). 옷·신발·모자·악세사리는 디자인 번호를 지키고 캐릭터 성별의 몸 버전을 고른다.
//  · 그림 주소는 /kiugi/r7/(배경은 /kiugi/bg/) + ?v=<해시 앞 12자> — 예전 그림이 캐시에 남지 않는다(마스크도 마스크 파일 해시).
// 옷 id = 그림 디자인 이름: outfit_01~20(한벌옷) · top_01~20(상의) · bottom_01~20(하의) · shoe_01~20(신발) · hat_01~20(모자) · accessory_01~20(악세사리 — 자리는 그림 목록) · background_01~10(배경).
//  예전 그림(V2~V5)의 옷 id(acc2_·shoe2_·reward_·V3 accessory_ 의 예전 뜻 등)는 R7 로 바꿀 때 한 번 냥을 돌려주고 지웠다(features/kiugi.mjs migrateArt) — 그림 목록에 없는 id 는 그리지 않는다.
// 입은 옷 = {outfit, top, bottom, shoes, hat, head, face, neck, hand, bg}. 배경 background_01~10 은 남녀가 같은 그림(성별을 바꿔도 그대로).
// 레벨 표정: 눈·코·입은 DJ 가 고른 번호 그대로 두고 표정 판(눈 웃음·울음, 입 웃음 — 그림에 있는 것)만 바꾼다 + 볼 발그레·둥실 하트는 얼굴 기준점(anchors.json)에 맞춰 겹친다.
import {ART} from './kiugi-r7-data.js';
import hairColor, {table as hairTable} from './kiugi-hair-color.js';
import {normalizeLook, HAIR_COLORS, HAIR_COLOR_NAMES, HAIR_SWATCHES, hairSwatch, hairColorKey, LOOK_DEFAULT} from './kiugi-look.js';
export {HAIR_COLORS, HAIR_COLOR_NAMES, HAIR_SWATCHES, hairSwatch, hairColorKey};

export const ART_VERSION = 'r7';
// 머리색 방식 판(캐시·시험용): 패키지 hair-color 의 VERSION('tone-map-v1')
export const HAIR_TONE_VERSION = hairColor.VERSION;
export const SIZE = 1024;
const BODY = Object.freeze({f: 'female', m: 'male'});
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
// 그림 찾기 열쇠: 종류|몸|번호|판(머리는 front·back, 눈·입은 smile·cry — 기본 표정은 빈 칸)
const variantOf = (a) => (a.category === 'hair' ? a.layer : a.expression && a.expression !== 'normal' ? a.expression : '');
const PART = new Map(ART.assets.map((a) => [`${a.category}|${a.body}|${a.number}|${variantOf(a)}`, a]));
// 그림 한 장(카테고리·성별·번호, 머리는 앞/뒤 · 눈·입은 표정 판). 없으면 null. 공통 배경(background)은 body 'shared' — 성별과 관계없이 같은 그림.
export function partOf(category, gender, number, variant = '') {
  const body = category === 'background' ? 'shared' : BODY[gender === 'm' ? 'm' : 'f'];
  return PART.get(`${category}|${body}|${Number(number)}|${variant === 'normal' ? '' : variant}`) || null;
}
export const assetUrl = (a) => `${a.dir || ART.dir}${a.file}?v=${a.v}`;
const maskUrl = (m) => `${ART.dir}${m.file}?v=${m.v}`;
// 기준점(패키지 anchors.json 의 bodies): faceAxisX · hairCrown · chin · eyes{left,right} · nose · mouth · neck · shoulders · waist · ankles · floorY …
export const anchorsOf = (gender) => ART.anchors[BODY[gender === 'm' ? 'm' : 'f']] || ART.anchors.female;
// 입은 옷 칸 → 그 칸에 들어가는 카테고리
export const SLOT_CATEGORY = Object.freeze({outfit: 'outfit', top: 'top', bottom: 'bottom', shoes: 'shoe', hat: 'hat', head: 'accessory', face: 'accessory', neck: 'accessory', hand: 'accessory', bg: 'background'});
export const WEAR_SLOTS = Object.freeze(Object.keys(SLOT_CATEGORY));
export const ACCESSORY_SLOTS = Object.freeze(['head', 'face', 'neck', 'hand']);
// 악세사리를 겹치는 차례(앞머리 위, 모자 아래): 목 → 손 → 얼굴 → 머리
export const ACCESSORY_ORDER = Object.freeze(['neck', 'hand', 'face', 'head']);
// 두 자리 번호(01~99)로 읽고, 실제 그림 목록에 그 종류·번호가 있는지로 확인한다(번호 범위를 여기 적지 않는다)
const PAIR = /^(outfit|top|bottom|shoe|hat|accessory|background)_(\d{2})$/;
// 옷 id → {category, number} · 모르는 id(예전 그림의 id 포함 — 그림이 없으면) 면 null
export function pairOf(id) {
  const m = PAIR.exec(String(id ?? ''));
  if (!m) return null;
  const category = m[1], number = Number(m[2]);
  return partOf(category, 'f', number) ? {category, number} : null;
}
// 입은 칸의 옷 → 이 성별 몸 버전 그림(칸과 맞지 않으면 null — 예: 악세사리를 다른 자리에 적은 줄)
export function wornAsset(slot, id, gender) {
  const p = pairOf(id), want = SLOT_CATEGORY[slot];
  if (!p || !want || p.category !== want) return null;
  const a = partOf(p.category, gender, p.number);
  if (!a) return null;
  if (p.category === 'accessory') return a.slot === slot ? a : null;
  return a;
}
// 옷 id 가 들어가는 칸(한벌옷 outfit · 상의 top · 하의 bottom · 신발 shoes · 모자 hat · 악세사리 자리 · 배경 bg). 모르면 null.
export function slotOfPair(id) {
  const p = pairOf(id);
  if (!p) return null;
  if (p.category === 'accessory') return partOf('accessory', 'f', p.number)?.slot || null;
  return Object.keys(SLOT_CATEGORY).find((s) => SLOT_CATEGORY[s] === p.category) || null;
}

// 입은 옷(+1시간 트릭 분장 — 2026-10-09 부터 없지만 예전 모양을 받는다) → 실제로 그릴 그림. 패키지 우선 규칙을 여기 한 곳에서 정한다.
//  트릭 분장은 그 칸을 덮는다(상의·하의 분장이면 한벌옷을 벗긴 모습). 한벌옷이 있으면 상의·하의는 그리지 않는다.
export function resolveLook(look = {}, gender = 'f') {
  const worn = {...(look?.worn && typeof look.worn === 'object' ? look.worn : {})};
  const trick = look?.trick;
  if (trick?.item && trick.slot && SLOT_CATEGORY[trick.slot]) {
    worn[trick.slot] = trick.item;
    if (trick.slot === 'top' || trick.slot === 'bottom') delete worn.outfit;
  }
  const g = gender === 'm' ? 'm' : 'f', get = (slot) => wornAsset(slot, worn[slot], g);
  const outfit = get('outfit'), acc = {};
  for (const s of ACCESSORY_SLOTS) { const a = get(s); if (a) acc[s] = a; }
  return {background: get('bg'), outfit, top: outfit ? null : get('top'), bottom: outfit ? null : get('bottom'), shoe: get('shoes'), hat: get('hat'), acc};
}

// 레벨 표정(시즌 목록 expressions 의 parts): 'eyes:smile' · 'eyes:cry' · 'mouth:smile' = 그림의 표정 판, 'exp-blush' · 'exp-floating-hearts' = 겹치는 그림
export const EXPRESSION_PARTS = Object.freeze(['exp-blush', 'exp-floating-hearts']);
export const FACE_PARTS = Object.freeze(['eyes:smile', 'eyes:cry', 'mouth:smile']);
export function faceVariants(expression) {
  const parts = new Set(Array.isArray(expression?.parts) ? expression.parts : []);
  return {eyes: parts.has('eyes:cry') ? 'cry' : parts.has('eyes:smile') ? 'smile' : '', mouth: parts.has('mouth:smile') ? 'smile' : '', blush: parts.has('exp-blush'), hearts: parts.has('exp-floating-hearts')};
}

// 그릴 차례(시험·그림 확인용): [{step, id}] — 마스크 단계도 적는다(body.cut:<옷> · body.feet · shoe.shaft · <옷>.hem · hair.hat · accessory.<자리>.clip).
export function layersOf(dj = {}, look = {}, {expression = null} = {}) {
  const L = normalizeLook(dj), g = L.gender, R = resolveLook(look, g), V = faceVariants(expression), out = [];
  const add = (step, a) => { if (a) out.push({step, id: a.id}); };
  const hem = R.outfit || R.bottom, shaft = Boolean(R.shoe && hem?.hem);
  add('background', R.background);
  add('hair.back', partOf('hair', g, L.hair, 'back'));
  if (R.hat?.hair) out.push({step: 'hair.back.hat', id: R.hat.id});
  add('body', partOf('body', g, 1));
  for (const a of [R.outfit, R.bottom, R.top, R.shoe]) if (a?.cut) out.push({step: 'body.cut', id: a.id});
  if (shaft) out.push({step: 'body.feet', id: partOf('body', g, 1).id});
  for (const [name, a] of [['outfit', R.outfit], ['bottom', R.bottom], ['top', R.top], ['shoe', R.shoe]]) add(name, a);
  if (shaft && hem.shaft) out.push({step: 'shoe.shaft', id: hem.id});
  if (hem?.hem) out.push({step: (R.outfit ? 'outfit' : 'bottom') + '.hem', id: hem.id});
  add('eyes', partOf('eyes', g, L.eyes, V.eyes)); add('nose', partOf('nose', g, L.nose)); add('mouth', partOf('mouth', g, L.mouth, V.mouth));
  add('hair.front', partOf('hair', g, L.hair, 'front'));
  for (const s of ACCESSORY_ORDER) add('accessory.' + s, R.acc[s]);
  add('hat', R.hat);
  return out;
}

let SEQ = 0;
const image = (href, extra = '') => `<image href="${esc(href)}" x="0" y="0" width="${SIZE}" height="${SIZE}"${extra}/>`;
const region = `x="0" y="0" width="${SIZE}" height="${SIZE}"`;
// 머리색 필터(tone-map-v1): sRGB 에서 밝기(0.2126·0.7152·0.0722)로 R=G=B 를 만든 뒤 R·G·B 만 256단계 표(table)로 바꾸고 알파는 그대로(feFuncA identity).
//  색은 팔레트 열쇠(blond 등). 모르는 값이면 갈색(normalizeLook 이 먼저 열쇠로 맞춘다). 표 숫자는 패키지 svgFilter 와 같은 모양(소수 8자리).
export const hairColorOf = (dj = {}) => normalizeLook(dj).hairColor;
const LUMA = '0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0';
export function hairFilter(id, color) {
  const lut = hairTable(hairColorKey(color) || LOOK_DEFAULT.hairColor);
  const fn = ['R', 'G', 'B'].map((c, i) => `<feFunc${c} type="table" tableValues="${lut.map((v) => (v[i] / 255).toFixed(8)).join(' ')}"/>`).join('');
  return `<filter id="${id}" ${region} filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${LUMA}"/><feComponentTransfer>${fn}<feFuncA type="identity"/></feComponentTransfer></filter>`;
}
// 마스크 그림 필터: inv = 흰색 + 알파 뒤집기(1−a, 지우기) · keep = 흰색 + 알파 그대로(남기기)
const maskFilters = (id) => `<filter id="${id}inv" ${region} filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 -1 1"/></filter>` +
  `<filter id="${id}keep" ${region} filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter>`;
const maskDef = (id, name, content) => `<mask id="${id}${name}" maskUnits="userSpaceOnUse" ${region} mask-type="alpha">${content}</mask>`;

// 레벨 표정 겹치기(얼굴 기준점): 볼 발그레 · 둥실 하트. 크기는 기준점에 맞춘다(눈 사이·머리 높이 — 예전 그림의 값을 R7 얼굴 크기로 줄였다).
const heart = (x, y, s, fill, w) => `<path d="M${x.toFixed(1)} ${(y + 0.9 * s).toFixed(1)} C${(x - 1.2 * s).toFixed(1)} ${(y + 0.1 * s).toFixed(1)} ${(x - 0.9 * s).toFixed(1)} ${(y - 0.9 * s).toFixed(1)} ${x.toFixed(1)} ${(y - 0.3 * s).toFixed(1)} C${(x + 0.9 * s).toFixed(1)} ${(y - 0.9 * s).toFixed(1)} ${(x + 1.2 * s).toFixed(1)} ${(y + 0.1 * s).toFixed(1)} ${x.toFixed(1)} ${(y + 0.9 * s).toFixed(1)}Z" fill="${fill}" stroke="#FFFFFF" stroke-width="${w.toFixed(2)}"/>`;
function blush(id, g) {
  const A = anchorsOf(g), eye = A.eyes.right[0] - A.eyes.left[0], k = eye / 63, y = (A.nose[1] + A.mouth[1]) / 2 - 4 * k, dx = eye / 2 + 9 * k, cx = A.faceAxisX;
  return `<radialGradient id="${id}blush"><stop offset="0" stop-color="#FF6F8E" stop-opacity=".5"/><stop offset="1" stop-color="#FF6F8E" stop-opacity="0"/></radialGradient>` +
    `<g data-step="exp-blush"><ellipse cx="${(cx - dx).toFixed(1)}" cy="${y.toFixed(1)}" rx="${(15 * k).toFixed(1)}" ry="${(8 * k).toFixed(1)}" fill="url(#${id}blush)"/><ellipse cx="${(cx + dx).toFixed(1)}" cy="${y.toFixed(1)}" rx="${(15 * k).toFixed(1)}" ry="${(8 * k).toFixed(1)}" fill="url(#${id}blush)"/></g>`;
}
// 둥실 하트: 머리 위·옆. 모자를 쓰면(머리 위가 높고 넓다 — 마녀 모자 챙 x 396~646) 모자 챙 밖 머리 양옆으로 비킨다.
//  자리는 예전 그림의 머리 크기(정수리~턱 162)를 1로 둔 값 × R7 머리 크기(k) — 하트 크기·테두리도 같은 비율로 줄인다.
function floatingHearts(g, tall) {
  const A = anchorsOf(g), top = A.hairCrown[1], cx = A.faceAxisX, k = (A.chin[1] - top) / 162, w = 2 * k;
  const spots = tall ? [[-186, 40, 13, '#FF8FB1'], [186, 20, 15, '#FF6F9C'], [184, 100, 11, '#FF8FB1']] : [[-100, -30, 13, '#FF8FB1'], [4, -72, 16, '#FF6F9C'], [102, -40, 12, '#FF8FB1']];
  return `<g data-step="exp-floating-hearts">${spots.map(([x, y, s, f]) => heart(cx + x * k, top + y * k, s * k, f, w)).join('')}</g>`;
}
// 보기: full = 캔버스 전체 · bust = 얼굴·어깨(작은 칸용 — 마녀 모자 끝 y 19 부터 어깨 아래까지) · char = 캐릭터 전신(위아래 여백 조금) · 그 밖은 "x y w h" 그대로
const VIEWS = Object.freeze({full: `0 0 ${SIZE} ${SIZE}`, bust: '387 18 250 250', char: '262 12 500 1000'});

// 캐릭터 한 장. dj = DJ 캐릭터({gender, hair, hairColor, eyes, nose, mouth} — 예전 값도 받는다), look = {worn:{칸:옷id}, trick:{item,slot}},
// expression = 레벨 표정({parts}). options: transparent(바탕 없음) · solid(바탕 색) · label(접근성 이름) · view('full'|'bust'|'char'|viewBox 글).
export function characterSvg(dj = {}, look = {}, {expression = null, transparent = false, solid = 'var(--kg-stage,#EFE9F8)', label = '', view = 'full'} = {}) {
  const L = normalizeLook(dj), g = L.gender, id = 'kg' + (++SEQ).toString(36) + '_', R = resolveLook(look, g), V = faceVariants(expression);
  const bodyA = partOf('body', g, 1), back = partOf('hair', g, L.hair, 'back'), front = partOf('hair', g, L.hair, 'front');
  const defs = [hairFilter(id + 'hair', L.hairColor)], tint = ` filter="url(#${id}hair)"`;
  const hem = R.outfit || R.bottom, footwear = Boolean(R.shoe && hem?.hem), shaft = footwear && hem.shaft ? hem.shaft : null;
  let masks = false;
  const inv = (m) => image(maskUrl(m), ` filter="url(#${id}inv)"`);
  const wrap = (name, inner) => `<g mask="url(#${id}${name})">${inner}</g>`;
  // 모자의 머리 지우기(앞·뒷머리 둘 다) · 신발 목 자르기(신발과 신발의 몸 지우기)
  if (R.hat?.hair) { masks = true; defs.push(maskDef(id, 'hc', inv(R.hat.hair))); }
  if (shaft) { masks = true; defs.push(maskDef(id, 'sh', inv(shaft))); }
  const hairLayer = (a, step) => { if (!a) return ''; const img = image(assetUrl(a), ` data-step="${step}"` + tint); return R.hat?.hair ? wrap('hc', img) : img; };
  // 기준 몸: 지우기 마스크마다 한 겹(몸 그림만 — 옷은 그 뒤에 그린다). 신발의 몸 지우기는 신발 목 자르기만큼 덜 지운다. 기본 운동화는 신발 목을 자를 때 지운다.
  let body = image(assetUrl(bodyA), ' data-step="body"'), n = 0;
  for (const a of [R.outfit, R.bottom, R.top, R.shoe]) {
    if (!a?.cut) continue;
    masks = true; const name = 'c' + (n++);
    defs.push(maskDef(id, name, a === R.shoe && shaft ? `<g filter="url(#${id}inv)">${wrap('sh', image(maskUrl(a.cut)))}</g>` : inv(a.cut)));
    body = wrap(name, body);
  }
  if (footwear && bodyA.feet) { masks = true; defs.push(maskDef(id, 'ft', inv(bodyA.feet))); body = wrap('ft', body); }
  let o = transparent ? '' : `<rect width="${SIZE}" height="${SIZE}" style="fill:${solid}"/>`;
  if (R.background) o += image(assetUrl(R.background), ' data-step="background"');
  o += hairLayer(back, 'hair.back');
  o += body;
  for (const [name, a] of [['outfit', R.outfit], ['bottom', R.bottom], ['top', R.top]]) if (a) o += image(assetUrl(a), ` data-step="${name}"`);
  if (R.shoe) { const img = image(assetUrl(R.shoe), ' data-step="shoe"'); o += shaft ? wrap('sh', img) : img; }
  if (hem?.hem) { masks = true; defs.push(maskDef(id, 'hm', image(maskUrl(hem.hem), ` filter="url(#${id}keep)"`))); o += `<g mask="url(#${id}hm)" data-step="${R.outfit ? 'outfit' : 'bottom'}.hem">${image(assetUrl(hem))}</g>`; }
  for (const [c, v] of [['eyes', V.eyes], ['nose', ''], ['mouth', V.mouth]]) { const a = partOf(c, g, L[c], v) || partOf(c, g, L[c]); if (a) o += image(assetUrl(a), ` data-step="${c}"`); }
  if (V.blush) o += blush(id, g);
  o += hairLayer(front, 'hair.front');
  // 악세사리: (모자에 잘린) 앞머리 모양만큼 지운다(renderer.js — 안경테·끈이 앞머리 가닥 위에 떠 보이지 않게)
  const accs = ACCESSORY_ORDER.filter((s) => R.acc[s]);
  if (accs.length && front) { masks = true; const hair = image(assetUrl(front)); defs.push(maskDef(id, 'fh', `<g filter="url(#${id}inv)">${R.hat?.hair ? wrap('hc', hair) : hair}</g>`)); }
  for (const s of accs) { const img = image(assetUrl(R.acc[s]), ` data-step="accessory.${s}"`); o += front ? wrap('fh', img) : img; }
  if (R.hat) o += image(assetUrl(R.hat), ' data-step="hat"');
  if (V.hearts) o += floatingHearts(g, Boolean(R.hat));
  if (masks) defs.push(maskFilters(id));
  const box = VIEWS[view] || (typeof view === 'string' && /^\d+ \d+ \d+ \d+$/.test(view) ? view : VIEWS.full);
  return `<svg viewBox="${box}" xmlns="http://www.w3.org/2000/svg" role="img"${label ? ` aria-label="${esc(label)}"` : ' aria-hidden="true"'}><defs>${defs.join('')}</defs>${o}</svg>`;
}

// ── 상점·도감의 옷 한 벌 ──
// 그림이 있는 옷인가(이번 그림의 옷·배경)
export const hasItemArt = (id) => Boolean(pairOf(id));
const placeholder = (name) => `<g><rect x="262" y="472" width="500" height="80" rx="18" fill="#FFFFFF" fill-opacity=".85" stroke="#7353D9" stroke-dasharray="12 8" stroke-width="5"/><text x="512" y="526" text-anchor="middle" font-size="40" font-weight="700" fill="#7353D9">${esc(name)}</text></g>`;
// 미리 보기 칸: 그 옷의 투명하지 않은 상자(가져올 때 잰 값)를 넉넉히 감싼 정사각형(그림을 자르지 않고 캔버스 전체를 옮겨 줄일 뿐).
//  한벌옷·상의는 얼굴이 함께 보이게 머리 꼭대기부터, 모자·머리·얼굴·목 장식은 얼굴 가운데로, 손 장식은 손 가까이, 배경은 장면 전체.
export function thumbBox(a) {
  if (!a) return VIEWS.full;
  if (a.category === 'background') return VIEWS.full; // 배경은 장면 전체(캐릭터와 함께)
  const A = anchorsOf(a.body === 'male' ? 'm' : 'f');
  let [x0, y0, x1, y1] = Array.isArray(a.box) ? a.box : [0, 0, SIZE, SIZE];
  let cx = (x0 + x1) / 2, pad = 1.25, min = 220;
  const head = Math.round(A.hairCrown[1]) - 20;
  if (a.category === 'outfit') { y0 = Math.min(y0, head); pad = 1.04; }
  else if (a.category === 'top') { y0 = Math.min(y0, head); y1 = Math.max(y1, Math.round(A.waist[1]) + 40); pad = 1.06; } // 짧은 상의도 허리 아래까지(상의 칸 크기가 고르게)
  else if (a.category === 'bottom') { pad = 1.12; min = 240; }
  else if (a.category === 'shoe') min = 200;
  else if (a.category === 'hat') { y1 = Math.max(y1, Math.round(A.chin[1]) + 24); min = 190; pad = 1.12; cx = A.faceAxisX; const half = Math.max(cx - x0, x1 - cx); x0 = cx - half; x1 = cx + half; }
  else if (a.category === 'accessory') {
    if (a.slot === 'hand') min = 150;
    else { min = 160; cx = A.faceAxisX; const half = Math.max(cx - x0, x1 - cx); x0 = cx - half; x1 = cx + half; }
  }
  const w = x1 - x0, h = y1 - y0;
  const s = Math.min(SIZE, Math.max(min, Math.round(Math.max(w, h) * pad)));
  const clamp = (v) => Math.max(0, Math.min(SIZE - s, Math.round(v)));
  return `${clamp(cx - s / 2)} ${clamp((y0 + y1) / 2 - s / 2)} ${s} ${s}`;
}
// 상점·도감의 옷 한 벌: 캐릭터(dj — DJ 캐릭터, 없으면 그 성별의 기본 얼굴·머리)가 그 옷만 입은 모습을, 옷이 있는 곳만 보이게(그림 전체 캔버스를 줄였다 옮길 뿐 — 옷 그림은 자르지 않는다).
// gender: 'f'|'m'(DJ 캐릭터 성별이 다르면 그 성별 기본 캐릭터). 모르는 옷(예전 그림의 옷)은 이름 자리 표시.
export function itemSvg(id, {label = '', gender = 'f', dj = null, name = '', items = {}} = {}) {
  const g = gender === 'm' ? 'm' : 'f', aria = label ? ` aria-label="${esc(label)}"` : ' aria-hidden="true"';
  const p = pairOf(id), a = p ? partOf(p.category, g, p.number) : null, slot = a ? slotOfPair(id) : null;
  if (!a || !slot) return `<svg viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg" role="img"${aria}>${placeholder(name || items?.[id]?.name || id)}</svg>`;
  const face = dj && normalizeLook(dj).gender === g ? {...normalizeLook(dj)} : {...LOOK_DEFAULT, gender: g};
  return characterSvg(face, {worn: {[slot]: id}}, {transparent: true, label, view: thumbBox(a)});
}

// ── 화면에 넣기(브라우저): 그림을 모두 받은 뒤 한 번에 바꾼다 ──
// 빨리 여러 번 고르면 늦게 끝난 앞 그림이 새 선택을 덮지 않게 칸마다 차례 번호를 둔다(패키지 렌더 순번). 그림을 못 받으면 칸에 알린다.
export function svgUrls(svg) { return [...new Set([...String(svg).matchAll(/ href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&')))]; }
const IMAGES = new Map();
function loadImage(url) {
  if (!IMAGES.has(url)) IMAGES.set(url, new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { IMAGES.delete(url); reject(Error('그림을 불러오지 못했어요: ' + url)); };
    img.src = url;
  }));
  return IMAGES.get(url);
}
const PAINTED = new WeakMap();
// el 에 svg 글을 넣는다. → {painted, failed:[주소]} (painted false = 더 새 그림이 이미 시작돼 이번 것은 버림)
export async function paintSvg(el, svg, {load = loadImage, onError = null} = {}) {
  const seq = (PAINTED.get(el) || 0) + 1;
  PAINTED.set(el, seq);
  const failed = [];
  await Promise.all(svgUrls(svg).map((u) => Promise.resolve().then(() => load(u)).catch(() => { failed.push(u); })));
  if (PAINTED.get(el) !== seq) return {painted: false, failed};
  el.innerHTML = svg;
  if (failed.length) { try { el.dataset.kgArtError = String(failed.length); } catch {} onError?.(failed); }
  else { try { delete el.dataset.kgArtError; } catch {} }
  return {painted: true, failed};
}
