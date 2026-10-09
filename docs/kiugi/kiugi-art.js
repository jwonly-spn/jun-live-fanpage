// DJ 키우기 그림(그림 V5, 2026-10-09 저녁 — Codex 패키지 DJ_V3_20261009_V5_CLOTH20: 캐릭터 238 + 공통 배경 10, 상의·하의 디자인 20개씩). 방송 관리 창과 키우기 사이트가 같은 파일로 그린다(문서·DOM 없이 SVG 글을 만든다).
// 그림 파일: app/public/kiugi/v5/*.png(tools/import-kiugi-v5.mjs 가 패키지에서 해시를 확인해 복사), 목록은 kiugi-v5-data.js(만든 파일), 머리색은 kiugi-hair-color.js(패키지 hair-color.mjs 그대로).
// 규칙(패키지 기술연결가이드·renderer.js·머리색_수정연결가이드를 그대로 옮김):
//  · 모든 PNG 는 같은 1024×1024 캔버스의 (0,0)에 그대로 겹친다. 그림마다 잘라 내거나 가운데 맞추지 않는다(화면 크기는 캔버스 전체를 줄일 뿐).
//  · 순서: 배경(공통, 불투명) → 보상 오라(aura) → 보상 날개(back) → 뒷머리(머리색 명도 표) →
//    [몸 칸: 기준 몸 → 한벌옷이면 (한벌옷 몸 지우기 마스크 → 한벌옷), 아니면 (하의 지우기 → 하의 → 상의 지우기 → 상의) →
//     신발을 골랐으면 (신발 지우기 → 신발 → 한벌옷 또는 하의에 밑단 마스크가 있으면 그 마스크로 잘라 낸 밑단을 신발 위에)] →
//    몸 칸 → 눈 → 코 → 입 → 앞머리(머리색 명도 표) → 악세사리(자리마다 하나) → 보상 왕관(front).
//  · 한벌옷을 입으면 상의·하의는 그리지 않는다(기록에는 남아 한벌옷을 벗으면 다시 보인다). 상의·하의를 입으면 한벌옷을 벗는다(엔진이 정한다).
//  · 왕관(보상 01)을 쓰면 머리 자리 악세사리만 가린다(얼굴·목·손은 그대로). 보상은 층(오라·날개·왕관)마다 하나, 셋을 함께 쓸 수 있다.
//  · 마스크는 흰 그림의 알파만 쓰고 몸 칸만 지운다(뒷머리·날개·오라를 지우지 않는다). SVG 에서는 <mask> 안에서 알파를 뒤집거나(지우기) 그대로(밑단) 쓴다.
//    마스크 그림은 필터로 흰색으로 맞춰 두어 알파 마스크·밝기 마스크 어느 쪽으로 읽혀도 같은 값이 된다.
//  · 머리만 색을 입힌다(tone-map-v1): 회색 머리의 R·G·B 를 색마다 정한 256단계 표로 바꾸고 알파는 원본 그대로(feComponentTransfer table · feFuncA identity · sRGB).
//    앞·뒷머리는 같은 필터(같은 표) 하나를 쓴다. 예전 곱하기 필터(feFlood·feBlend multiply·feComposite)는 없앴고 다른 필터·CSS 색과 겹치지 않는다. 몸·옷·눈·보상에는 쓰지 않는다.
//  · 머리·눈·코·입은 캐릭터 성별 전용 그림(반대 성별 id 를 쓰지 않는다). 옷·신발·악세사리·보상은 디자인 번호(pair)를 지키고 캐릭터 성별의 몸 버전을 고른다.
//  · 그림 주소는 /kiugi/v5/(패키지 판 폴더) + ?v=<해시 앞 12자> — 예전 그림(V4 의 뒷머리 13장 등)이 캐시에 남지 않는다(마스크도 마스크 파일 해시).
// 옷 id 는 패키지의 pair 그대로: outfit_01~05(한벌옷) · top_01~20(상의) · bottom_01~20(하의) · shoe2_01~10(신발) · acc2_01~10(악세사리).
//  번호는 두 자리로 읽고, 그 번호의 그림이 목록(kiugi-v5-data.js)에 있을 때만 옷으로 본다(상의·하의 11~20 도 01~10 과 똑같이).
//  악세11~13(acc2_11 왕관 · acc2_12 날개 · acc2_13 오라, 2026-10-09 사용자 "시즌 보상은 전부 악세사리로"): 예전 시즌 보상 그림 reward_01~03 을 그대로 쓴다
//   (같은 층·같은 차례 — 오라·날개는 몸 뒤, 왕관은 맨 위이고 머리 장식을 가린다). 그림 목록(만든 파일)은 바꾸지 않고 ACC_REWARD_ART 로 잇는다.
//  예전 시즌 보상 id(pumpkin-crown·shadow-wings·moonlight-aura)와 패키지 pair(reward_01~03)도 그대로 받는다(사이트에 남은 예전 올림·예전 기록).
// 입은 옷 = {outfit, top, bottom, shoes, head, face, neck, hand, crown, wings, aura, bg}. 배경 background_01~10 은 남녀가 같은 그림(성별을 바꿔도 그대로).
//  예전(V2) 칸 bg 의 옛 배경 id(halloween-night 등)는 그리지 않는다.
// 그리지 않는 것: V4 에서 지운 옛 id(의상 outfit_06~10 · 신발 shoe_* · 악세사리 accessory_* — 새 그림에 이어 붙이지 않는다), 예전(V2) 옷 id, 칸과 맞지 않는 옷.
// 레벨 표정: 눈·코·입은 DJ 가 고른 것을 그대로 쓰고, 볼 발그레·둥실 하트만 얼굴 기준점에 맞춰 겹친다.
import {ART} from './kiugi-v5-data.js';
import hairColor, {svgFilter} from './kiugi-hair-color.js';
import {normalizeLook, HAIR_COLORS, HAIR_COLOR_NAMES, HAIR_SWATCHES, hairSwatch, hairColorKey, LOOK_DEFAULT} from './kiugi-look.js';
export {HAIR_COLORS, HAIR_COLOR_NAMES, HAIR_SWATCHES, hairSwatch, hairColorKey};

export const ART_VERSION = 'v5';
// 머리색 방식 판(캐시·시험용): 패키지 hair-color 의 VERSION('tone-map-v1')
export const HAIR_TONE_VERSION = hairColor.VERSION;
export const SIZE = 1024;
const BODY = Object.freeze({f: 'female', m: 'male'});
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const PART = new Map(ART.assets.map((a) => [`${a.category}|${a.body}|${a.number}|${a.category === 'hair' ? a.layer : ''}`, a]));
// 그림 한 장(카테고리·성별·번호, 머리는 앞/뒤). 없으면 null. 공통 배경(background)은 body 'shared' — 성별과 관계없이 같은 그림.
export function partOf(category, gender, number, layer = '') {
  const body = category === 'background' ? 'shared' : BODY[gender === 'm' ? 'm' : 'f'];
  return PART.get(`${category}|${body}|${Number(number)}|${category === 'hair' ? layer : ''}`) || null;
}
export const assetUrl = (a) => `${ART.dir}${a.file}?v=${a.v}`;
// 입은 옷 칸 → 그 칸에 들어가는 카테고리
export const SLOT_CATEGORY = Object.freeze({outfit: 'outfit', top: 'top', bottom: 'bottom', shoes: 'shoe', head: 'accessory', face: 'accessory', neck: 'accessory', hand: 'accessory', crown: 'reward', wings: 'reward', aura: 'reward', bg: 'background'});
export const WEAR_SLOTS = Object.freeze(Object.keys(SLOT_CATEGORY));
export const ACCESSORY_SLOTS = Object.freeze(['head', 'face', 'neck', 'hand']);
// 보상 칸 → 겹치는 층(패키지 layer)
export const REWARD_SLOT_LAYER = Object.freeze({aura: 'aura', wings: 'back', crown: 'front'});
// 예전 시즌 보상 id(0.15.58~) → 패키지 보상 번호·칸
export const REWARD_ART = Object.freeze({'pumpkin-crown': Object.freeze({number: 1, slot: 'crown'}), 'shadow-wings': Object.freeze({number: 2, slot: 'wings'}), 'moonlight-aura': Object.freeze({number: 3, slot: 'aura'})});
// 왕관·날개·오라 악세사리(악세11~13) → 같은 보상 그림 번호·칸
export const ACC_REWARD_ART = Object.freeze({acc2_11: Object.freeze({number: 1, slot: 'crown'}), acc2_12: Object.freeze({number: 2, slot: 'wings'}), acc2_13: Object.freeze({number: 3, slot: 'aura'})});
// 악세사리를 겹치는 차례(앞머리 위): 목 → 손 → 얼굴 → 머리
export const ACCESSORY_ORDER = Object.freeze(['neck', 'hand', 'face', 'head']);
const PREFIX_CATEGORY = Object.freeze({outfit: 'outfit', top: 'top', bottom: 'bottom', shoe2: 'shoe', acc2: 'accessory', reward: 'reward', background: 'background'});
// 두 자리 번호(01~99)로 읽고, 실제 그림 목록에 그 종류·번호가 있는지로 확인한다(상의·하의 11~20 — 번호 범위를 여기 적지 않는다)
const PAIR = /^(outfit|top|bottom|shoe2|acc2|reward|background)_(\d{2})$/;
// 옷 id(pair 또는 시즌 보상 id) → {category, number} · 모르는 id(V4 에서 지운 옛 id 포함 — 그림이 없으면) 면 null
export function pairOf(id) {
  const s = String(id ?? '');
  if (Object.hasOwn(REWARD_ART, s)) return {category: 'reward', number: REWARD_ART[s].number};
  if (Object.hasOwn(ACC_REWARD_ART, s)) return {category: 'reward', number: ACC_REWARD_ART[s].number};
  const m = PAIR.exec(s);
  if (!m) return null;
  const category = PREFIX_CATEGORY[m[1]], number = Number(m[2]);
  return partOf(category, 'f', number) ? {category, number} : null;
}
// 입은 칸의 옷 → 이 성별 몸 버전 그림(칸과 맞지 않으면 null — 예: 악세사리를 다른 자리에 적은 줄, 날개를 왕관 칸에 적은 줄)
export function wornAsset(slot, id, gender) {
  const p = pairOf(id), want = SLOT_CATEGORY[slot];
  if (!p || !want || p.category !== want) return null;
  const a = partOf(p.category, gender, p.number);
  if (!a) return null;
  if (p.category === 'accessory') return a.slot === slot ? a : null;
  if (p.category === 'reward') return a.layer === REWARD_SLOT_LAYER[slot] ? a : null;
  return a;
}
// 옷 id 가 들어가는 칸(한벌옷 outfit · 상의 top · 하의 bottom · 신발 shoes · 악세사리 자리 · 보상 crown/wings/aura). 모르면 null.
export function slotOfPair(id) {
  const p = pairOf(id);
  if (!p) return null;
  if (p.category === 'accessory') return partOf('accessory', 'f', p.number)?.slot || null;
  if (p.category === 'reward') return Object.keys(REWARD_SLOT_LAYER).find((s) => REWARD_SLOT_LAYER[s] === partOf('reward', 'f', p.number)?.layer) || null;
  return Object.keys(SLOT_CATEGORY).find((s) => SLOT_CATEGORY[s] === p.category) || null;
}

// 입은 옷(+1시간 트릭 분장) → 실제로 그릴 그림. 패키지 우선 규칙을 여기 한 곳에서 정한다.
//  트릭 분장은 그 칸을 덮는다(상의·하의 분장이면 한벌옷을 벗긴 모습). 한벌옷이 있으면 상의·하의는 그리지 않는다. 왕관이 있으면 머리 장식은 그리지 않는다.
export function resolveLook(look = {}, gender = 'f') {
  const worn = {...(look?.worn && typeof look.worn === 'object' ? look.worn : {})};
  const trick = look?.trick;
  if (trick?.item && trick.slot && SLOT_CATEGORY[trick.slot]) {
    worn[trick.slot] = trick.item;
    if (trick.slot === 'top' || trick.slot === 'bottom') delete worn.outfit;
  }
  const g = gender === 'm' ? 'm' : 'f', get = (slot) => wornAsset(slot, worn[slot], g);
  const outfit = get('outfit');
  const rewards = {aura: get('aura'), back: get('wings'), front: get('crown')};
  const acc = {};
  for (const s of ACCESSORY_SLOTS) { const a = get(s); if (a && !(s === 'head' && rewards.front)) acc[s] = a; }
  return {background: get('bg'), outfit, top: outfit ? null : get('top'), bottom: outfit ? null : get('bottom'), shoe: get('shoes'), acc, rewards};
}

// 그릴 차례(시험·그림 확인용): [{step, id}] — 몸 칸 안의 마스크 단계도 적는다.
export function layersOf(dj = {}, look = {}) {
  const L = normalizeLook(dj), g = L.gender, R = resolveLook(look, g), out = [];
  const add = (step, a) => { if (a) out.push({step, id: a.id}); };
  const wear = (name, a) => { if (!a) return; if (a.cut) out.push({step: name + '.cut', id: a.id}); add(name, a); };
  add('background', R.background);
  add('reward.aura', R.rewards.aura);
  add('reward.back', R.rewards.back);
  add('hair.back', partOf('hair', g, L.hair, 'back'));
  add('body', partOf('body', g, 1));
  if (R.outfit) wear('outfit', R.outfit);
  else { wear('bottom', R.bottom); wear('top', R.top); }
  if (R.shoe) {
    wear('shoe', R.shoe);
    const hem = R.outfit || R.bottom;
    if (hem?.hem) out.push({step: (R.outfit ? 'outfit' : 'bottom') + '.hem', id: hem.id});
  }
  for (const c of ['eyes', 'nose', 'mouth']) add(c, partOf(c, g, L[c]));
  add('hair.front', partOf('hair', g, L.hair, 'front'));
  for (const s of ACCESSORY_ORDER) add('accessory.' + s, R.acc[s]);
  add('reward.front', R.rewards.front);
  return out;
}

let SEQ = 0;
const image = (a, extra = '') => `<image href="${esc(assetUrl(a))}" x="0" y="0" width="${SIZE}" height="${SIZE}"${extra}/>`;
// 머리색(tone-map-v1, 패키지 머리색_수정연결가이드 "SVG 게임 연결" 그대로): svgFilter(id + 'hair', 색, 1024)
//  = sRGB 에서 feComponentTransfer 의 R·G·B 만 256단계 표(table)로 바꾸고 feFuncA identity 로 원본 투명도를 그대로 둔다(회색 머리 그림은 R=G=B 라 캔버스 recolor 와 같은 표).
//  색은 팔레트 열쇠(blond 등). 모르는 값이면 갈색(normalizeLook 이 먼저 열쇠로 맞춘다).
export const hairColorOf = (dj = {}) => normalizeLook(dj).hairColor;
const tintFilter = (id, color) => svgFilter(id + 'hair', hairColorKey(color) || LOOK_DEFAULT.hairColor, SIZE);
// 마스크 그림 필터: inv = 흰색 + 알파 뒤집기(1−a, 지우기) · keep = 흰색 + 알파 그대로(밑단 남기기)
const maskFilters = (id) => `<filter id="${id}inv" x="0" y="0" width="${SIZE}" height="${SIZE}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 -1 1"/></filter>` +
  `<filter id="${id}keep" x="0" y="0" width="${SIZE}" height="${SIZE}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter>`;
const maskDef = (id, name, m, filter) => `<mask id="${id}${name}" maskUnits="userSpaceOnUse" x="0" y="0" width="${SIZE}" height="${SIZE}" mask-type="alpha"><image href="${esc(`${ART.dir}${m.file}?v=${m.v}`)}" x="0" y="0" width="${SIZE}" height="${SIZE}" filter="url(#${id}${filter})"/></mask>`;

// 레벨 표정 겹치기(얼굴 기준점): 볼 발그레 · 둥실 하트
const heart = (x, y, s, fill) => `<path d="M${x} ${y + 0.9 * s} C${x - 1.2 * s} ${y + 0.1 * s} ${x - 0.9 * s} ${y - 0.9 * s} ${x} ${y - 0.3 * s} C${x + 0.9 * s} ${y - 0.9 * s} ${x + 1.2 * s} ${y + 0.1 * s} ${x} ${y + 0.9 * s}Z" fill="${fill}" stroke="#FFFFFF" stroke-width="2"/>`;
function blush(id, g) {
  const A = ART.anchors[BODY[g]], y = (A.nose[1] + A.mouth[1]) / 2 - 4, dx = (A.eye_right[0] - A.eye_left[0]) / 2 + 9, cx = A.nose[0];
  return `<radialGradient id="${id}blush"><stop offset="0" stop-color="#FF6F8E" stop-opacity=".5"/><stop offset="1" stop-color="#FF6F8E" stop-opacity="0"/></radialGradient>` +
    `<g data-step="exp-blush"><ellipse cx="${(cx - dx).toFixed(1)}" cy="${y.toFixed(1)}" rx="15" ry="8" fill="url(#${id}blush)"/><ellipse cx="${(cx + dx).toFixed(1)}" cy="${y.toFixed(1)}" rx="15" ry="8" fill="url(#${id}blush)"/></g>`;
}
// 둥실 하트: 머리 위·옆(높이 올린 포니테일·뿔과 겹치지 않게 머리 꼭대기보다 넉넉히 위). 왕관·모자처럼 머리 위가 높은 것을 쓰면 머리 양옆으로 비킨다.
function floatingHearts(g, tall) {
  const A = ART.anchors[BODY[g]], top = A.skull_top[1], cx = A.skull_top[0];
  const spots = tall ? [[cx - 150, top + 30, 13, '#FF8FB1'], [cx + 150, top + 10, 15, '#FF6F9C'], [cx + 132, top + 82, 11, '#FF8FB1']]
    : [[cx - 100, top - 34, 13, '#FF8FB1'], [cx + 4, top - 88, 16, '#FF6F9C'], [cx + 102, top - 44, 12, '#FF8FB1']];
  return `<g data-step="exp-floating-hearts">${spots.map(([x, y, s, f]) => heart(x, y, s, f)).join('')}</g>`;
}
export const EXPRESSION_PARTS = Object.freeze(['exp-blush', 'exp-floating-hearts']);
// 머리 위로 높이 솟는 것(둥실 하트를 옆으로 비킨다): 왕관, 머리 위 악세사리(모자·머리띠)
const tallHead = (R) => Boolean(R.rewards.front || (R.acc.head && R.acc.head.box && R.acc.head.box[1] < 110));
// 보기: full = 캔버스 전체 · bust = 얼굴·어깨(작은 칸용) · 그 밖은 "x y w h" 그대로
// bust 는 왕관(위 끝 y 15)까지 들어가게 조금 넓다
const VIEWS = Object.freeze({full: `0 0 ${SIZE} ${SIZE}`, bust: '341 12 342 342'});

// 캐릭터 한 장. dj = DJ 캐릭터({gender, hair, hairColor, eyes, nose, mouth} — 예전 V2 값도 받는다), look = {worn:{칸:옷id}, trick:{item,slot}(1시간 장난 분장 — 그 칸을 덮는다)},
// expression = 레벨 표정({parts}). options: transparent(바탕 없음) · solid(바탕 색) · label(접근성 이름) · view('full'|'bust'|viewBox 글).
// items·art 는 예전(V2) 호출과 맞추려고 받기만 한다(V5 는 kiugi-v5-data.js 의 표로 그린다).
export function characterSvg(dj = {}, look = {}, {expression = null, transparent = false, solid = 'var(--kg-stage,#EFE9F8)', label = '', view = 'full'} = {}) {
  const L = normalizeLook(dj), g = L.gender, id = 'kg' + (++SEQ).toString(36) + '_', R = resolveLook(look, g);
  const bodyA = partOf('body', g, 1), back = partOf('hair', g, L.hair, 'back'), front = partOf('hair', g, L.hair, 'front');
  const parts = new Set(Array.isArray(expression?.parts) ? expression.parts : []);
  const defs = [tintFilter(id, L.hairColor)];
  const tint = ` filter="url(#${id}hair)"`;
  let masks = false;
  // 몸 칸(뒷머리·날개·오라를 지우지 않게 따로 묶는다). 지우기 마스크는 그때까지 몸 칸에 그린 것 전부를 감싼다(캔버스 destination-out 과 같다).
  let dressed = image(bodyA, ' data-step="body"');
  const wear = (name, a) => {
    if (!a) return;
    if (a.cut) { masks = true; defs.push(maskDef(id, name + 'c', a.cut, 'inv')); dressed = `<g mask="url(#${id}${name}c)" data-step="${name}.cut">${dressed}</g>`; }
    dressed += image(a, ` data-step="${name}"`);
  };
  if (R.outfit) wear('outfit', R.outfit);
  else { wear('bottom', R.bottom); wear('top', R.top); }
  if (R.shoe) {
    wear('shoe', R.shoe);
    const hemOf = R.outfit || R.bottom, kind = R.outfit ? 'outfit' : 'bottom';
    if (hemOf?.hem) { masks = true; defs.push(maskDef(id, 'hm', hemOf.hem, 'keep')); dressed += `<g mask="url(#${id}hm)" data-step="${kind}.hem">${image(hemOf)}</g>`; }
  }
  if (masks) defs.push(maskFilters(id));
  let o = transparent ? '' : `<rect width="${SIZE}" height="${SIZE}" style="fill:${solid}"/>`;
  if (R.background) o += image(R.background, ' data-step="background"');
  if (R.rewards.aura) o += image(R.rewards.aura, ' data-step="reward.aura"');
  if (R.rewards.back) o += image(R.rewards.back, ' data-step="reward.back"');
  if (back) o += image(back, ' data-step="hair.back"' + tint);
  o += `<g data-step="dressed">${dressed}</g>`;
  for (const c of ['eyes', 'nose', 'mouth']) { const a = partOf(c, g, L[c]); if (a) o += image(a, ` data-step="${c}"`); }
  if (parts.has('exp-blush')) o += blush(id, g);
  if (front) o += image(front, ' data-step="hair.front"' + tint);
  for (const s of ACCESSORY_ORDER) if (R.acc[s]) o += image(R.acc[s], ` data-step="accessory.${s}"`);
  if (R.rewards.front) o += image(R.rewards.front, ' data-step="reward.front"');
  if (parts.has('exp-floating-hearts')) o += floatingHearts(g, tallHead(R));
  const box = VIEWS[view] || (typeof view === 'string' && /^\d+ \d+ \d+ \d+$/.test(view) ? view : VIEWS.full);
  return `<svg viewBox="${box}" xmlns="http://www.w3.org/2000/svg" role="img"${label ? ` aria-label="${esc(label)}"` : ' aria-hidden="true"'}><defs>${defs.join('')}</defs>${o}</svg>`;
}

// ── 상점·도감의 옷 한 벌 ──
export const isReward = (id) => Object.hasOwn(REWARD_ART, String(id ?? '')) || pairOf(id)?.category === 'reward';
// 그림이 있는 옷인가(V4 옷·시즌 보상·배경)
export const hasItemArt = (id) => Boolean(pairOf(id));
const placeholder = (name) => `<g><rect x="262" y="472" width="500" height="80" rx="18" fill="#FFFFFF" fill-opacity=".85" stroke="#7353D9" stroke-dasharray="12 8" stroke-width="5"/><text x="512" y="526" text-anchor="middle" font-size="40" font-weight="700" fill="#7353D9">${esc(name)}</text></g>`;
// 미리 보기 칸: 그 옷의 투명하지 않은 상자(가져올 때 잰 값)를 넉넉히 감싼 정사각형(그림을 자르지 않고 캔버스 전체를 옮겨 줄일 뿐).
//  한벌옷·상의·왕관은 얼굴이 함께 보이게 머리 꼭대기부터, 머리·얼굴·목 장식은 얼굴 가운데로, 손 장식은 손목 가까이, 날개·오라는 캐릭터와 함께 크게.
export function thumbBox(a) {
  if (!a) return VIEWS.full;
  const A = ART.anchors[a.body] || ART.anchors.female;
  let [x0, y0, x1, y1] = Array.isArray(a.box) ? a.box : [0, 0, SIZE, SIZE];
  let cx = (x0 + x1) / 2, pad = 1.25, min = 300;
  const head = Math.round(A.skull_top[1]) - 50;
  if (a.category === 'background') return VIEWS.full; // 배경은 장면 전체(캐릭터와 함께)
  if (a.category === 'outfit') { y0 = Math.min(y0, head); pad = 1.04; }
  else if (a.category === 'top') { y0 = Math.min(y0, head); y1 = Math.max(y1, Math.round(A.waist[1]) + 60); pad = 1.08; } // 짧은 상의도 허리 아래까지(상의 칸 크기가 고르게)
  else if (a.category === 'bottom') { pad = 1.14; min = 320; }
  else if (a.category === 'shoe') min = 320;
  else if (a.category === 'reward') {
    if (a.layer === 'front') { y1 = Math.max(y1, Math.round(A.chin[1]) + 40); min = 330; pad = 1.1; cx = A.skull_top[0]; }
    else { y0 = Math.min(y0, head); y1 = Math.max(y1, Math.round(A.waist[1]) + 60); pad = 1.03; }
  } else if (a.category === 'accessory') {
    if (a.slot === 'hand') min = 170;
    else { min = 230; cx = A.skull_top[0]; const half = Math.max(cx - x0, x1 - cx); x0 = cx - half; x1 = cx + half; }
  }
  const w = x1 - x0, h = y1 - y0;
  const s = Math.min(SIZE, Math.max(min, Math.round(Math.max(w, h) * pad)));
  const clamp = (v) => Math.max(0, Math.min(SIZE - s, Math.round(v)));
  return `${clamp(cx - s / 2)} ${clamp((y0 + y1) / 2 - s / 2)} ${s} ${s}`;
}
// 상점·도감의 옷 한 벌: 캐릭터(dj — DJ 캐릭터, 없으면 그 성별의 기본 얼굴·머리)가 그 옷만 입은 모습을, 옷이 있는 곳만 보이게 잘라 보인다(그림 전체 캔버스를 줄였다 옮길 뿐 — 옷 그림은 자르지 않는다).
// gender: 'f'|'m'(DJ 캐릭터 성별이 다르면 그 성별 기본 캐릭터). 모르는 옷(V4 에서 지운 옛 옷·예전 V2 옷)은 이름 자리 표시.
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
