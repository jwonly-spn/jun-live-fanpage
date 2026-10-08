// DJ 키우기 그림(그림 V3, 2026-10-09 — Codex 패키지 DJ_V3_20261009_FINAL). 방송 관리 창과 키우기 사이트가 같은 파일로 그린다(문서·DOM 없이 SVG 글을 만든다).
// 그림 파일: app/public/kiugi/v3/*.png(tools/import-kiugi-v3.mjs 가 패키지에서 해시를 확인해 복사), 목록은 kiugi-v3-data.js(만든 파일).
// 규칙(패키지 기술연결가이드·renderer.js 를 그대로 옮김):
//  · 모든 PNG 는 같은 1024×1024 캔버스의 (0,0)에 그대로 겹친다. 그림마다 잘라 내거나 가운데 맞추지 않는다(화면 크기는 캔버스 전체를 줄일 뿐).
//  · 순서: 뒷머리(머리색 곱하기) → [몸 칸: 기준 몸 → 의상 몸 지우기 마스크(destination-out) → 의상 → 신발을 골랐으면 신발 몸 지우기 마스크 → 신발 →
//    의상에 밑단 마스크가 있으면 그 마스크로 잘라 낸 의상 밑단을 신발 위에] → 몸 칸을 뒷머리 위에 → 눈 → 코 → 입 → 앞머리(머리색 곱하기) → 악세사리.
//  · 마스크는 흰 그림의 알파만 쓰고 몸 칸만 지운다(뒷머리·장면 전체를 지우지 않는다). SVG 에서는 <mask> 안에서 알파를 뒤집거나(지우기) 그대로(밑단) 쓴다.
//    마스크 그림은 필터로 흰색으로 맞춰 두어 알파 마스크·밝기 마스크 어느 쪽으로 읽혀도 같은 값이 된다.
//  · 머리만 색을 입힌다(회색 × 색 ÷ 255, 알파 그대로). 몸·옷·눈에는 곱하지 않는다.
//  · 머리·눈·코·입은 캐릭터 성별 전용 그림(반대 성별 id 를 쓰지 않는다). 의상·신발·악세사리는 디자인 번호(pair)를 지키고 캐릭터 성별의 몸 버전을 고른다.
//  · 악세사리는 자리(머리·얼굴·목·손)마다 하나. 의상에 그려진 목걸이·팔찌와 따로 산 악세사리는 겹칠 수 있다(패키지 그대로).
//  · 그림 주소 뒤에 ?v=<해시 앞 12자> 를 붙여 예전 그림이 캐시에 남지 않게 한다.
// 옷 id 는 패키지의 pair 그대로: outfit_01~10(의상) · shoe_01~10(신발) · accessory_01~10(악세사리). 입은 옷 = {outfit, shoes, head, face, neck, hand}.
// 예전(V2) 옷 id·시즌 보상(왕관·날개·오라)은 V3 몸에 맞지 않아 캐릭터에 그리지 않는다(기록은 그대로). 시즌 보상은 상점 칸에서만 작은 배지 그림으로 보인다.
// 레벨 표정: V3 눈·코·입은 DJ 가 고른 것을 그대로 쓰고, 볼 발그레·둥실 하트만 V3 얼굴 기준점에 맞춰 겹친다(예전 윙크·하트 눈 같은 표정 조각은 V3 그림이 없다).
import {V3} from './kiugi-v3-data.js';
import {normalizeLook, HAIR_COLORS, HAIR_SWATCHES, hairSwatch, HAIR_SWATCH_GRAY, LOOK_DEFAULT} from './kiugi-look.js';
export {HAIR_COLORS, HAIR_SWATCHES, hairSwatch, HAIR_SWATCH_GRAY};

export const ART_VERSION = 'v3';
export const SIZE = 1024;
const BODY = Object.freeze({f: 'female', m: 'male'});
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const BY_ID = new Map(V3.assets.map((a) => [a.id, a]));
const PART = new Map(V3.assets.map((a) => [`${a.category}|${a.body}|${a.number}|${a.category === 'hair' ? a.layer : ''}`, a]));
// 그림 한 장(카테고리·성별·번호, 머리는 앞/뒤). 없으면 null.
export function partOf(category, gender, number, layer = '') {
  return PART.get(`${category}|${BODY[gender === 'm' ? 'm' : 'f']}|${Number(number)}|${category === 'hair' ? layer : ''}`) || null;
}
export const assetUrl = (a) => `${V3.dir}${a.file}?v=${a.v}`;
// 입은 옷 칸 → 그 칸에 들어가는 카테고리
export const SLOT_CATEGORY = Object.freeze({outfit: 'outfit', shoes: 'shoe', head: 'accessory', face: 'accessory', neck: 'accessory', hand: 'accessory'});
export const WEAR_SLOTS = Object.freeze(Object.keys(SLOT_CATEGORY));
// 악세사리를 겹치는 차례(앞머리 위): 목 → 손 → 얼굴 → 머리
export const ACCESSORY_ORDER = Object.freeze(['neck', 'hand', 'face', 'head']);
const PAIR = /^(outfit|shoe|accessory)_(0[1-9]|10)$/;
// 옷 id(pair) → {category, number} · 모르는 id 면 null
export function pairOf(id) { const m = PAIR.exec(String(id ?? '')); return m ? {category: m[1], number: Number(m[2])} : null; }
// 입은 칸의 옷 → 이 성별 몸 버전 그림(칸과 맞지 않으면 null — 예: 악세사리를 다른 자리에 적은 줄)
export function wornAsset(slot, id, gender) {
  const p = pairOf(id), want = SLOT_CATEGORY[slot];
  if (!p || !want || p.category !== want) return null;
  const a = partOf(p.category, gender, p.number);
  return a && (p.category !== 'accessory' || a.slot === slot) ? a : null;
}
// 옷 id 의 악세사리 자리(머리·얼굴·목·손), 의상은 outfit, 신발은 shoes
export function slotOfPair(id) { const p = pairOf(id); if (!p) return null; if (p.category === 'outfit') return 'outfit'; if (p.category === 'shoe') return 'shoes'; return partOf('accessory', 'f', p.number)?.slot || null; }

// 그릴 차례(시험·그림 확인용): [{step, id}] — 몸 칸 안의 마스크 단계도 적는다.
export function layersOf(dj = {}, look = {}) {
  const L = normalizeLook(dj), g = L.gender, worn = {...(look?.worn || {})};
  if (look?.trick?.item && look.trick.slot) worn[look.trick.slot] = look.trick.item;
  const outfit = wornAsset('outfit', worn.outfit, g), shoe = wornAsset('shoes', worn.shoes, g), out = [];
  const add = (step, a) => { if (a) out.push({step, id: a.id}); };
  add('hair.back', partOf('hair', g, L.hair, 'back'));
  add('body', partOf('body', g, 1));
  if (outfit) { if (outfit.cut) out.push({step: 'outfit.cut', id: outfit.id}); add('outfit', outfit); }
  if (shoe) { if (shoe.cut) out.push({step: 'shoe.cut', id: shoe.id}); add('shoe', shoe); if (outfit?.hem) out.push({step: 'outfit.hem', id: outfit.id}); }
  for (const c of ['eyes', 'nose', 'mouth']) add(c, partOf(c, g, L[c]));
  add('hair.front', partOf('hair', g, L.hair, 'front'));
  for (const s of ACCESSORY_ORDER) add('accessory.' + s, wornAsset(s, worn[s], g));
  return out;
}

let SEQ = 0;
const image = (a, extra = '') => `<image href="${esc(assetUrl(a))}" x="0" y="0" width="${SIZE}" height="${SIZE}"${extra}/>`;
// 머리색 곱하기(패키지 renderer.js 와 같은 셈): 머리 그림 위에 색을 multiply 로 칠하고(feFlood + feBlend multiply) 머리 그림의 알파로 다시 자른다(feComposite in).
//  불투명한 곳은 원본 × 색 ÷ 255, 반투명 가장자리도 캔버스와 같은 값이 된다. 알파는 그대로.
export const tintColor = (hex) => (/^#[0-9a-f]{6}$/i.test(String(hex)) ? String(hex).toUpperCase() : HAIR_COLORS.brown);
const tintFilter = (id, hex) => `<filter id="${id}hair" x="0" y="0" width="${SIZE}" height="${SIZE}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
  `<feFlood flood-color="${tintColor(hex)}" result="c"/><feBlend in="SourceGraphic" in2="c" mode="multiply" result="m"/><feComposite in="m" in2="SourceGraphic" operator="in"/></filter>`;
// 마스크 그림 필터: inv = 흰색 + 알파 뒤집기(1−a, 지우기) · keep = 흰색 + 알파 그대로(밑단 남기기)
const maskFilters = (id) => `<filter id="${id}inv" x="0" y="0" width="${SIZE}" height="${SIZE}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 -1 1"/></filter>` +
  `<filter id="${id}keep" x="0" y="0" width="${SIZE}" height="${SIZE}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter>`;
const maskDef = (id, name, m, filter) => `<mask id="${id}${name}" maskUnits="userSpaceOnUse" x="0" y="0" width="${SIZE}" height="${SIZE}" mask-type="alpha"><image href="${esc(`${V3.dir}${m.file}?v=${m.v}`)}" x="0" y="0" width="${SIZE}" height="${SIZE}" filter="url(#${id}${filter})"/></mask>`;

// 레벨 표정 겹치기(V3 얼굴 기준점): 볼 발그레 · 둥실 하트
const heart = (x, y, s, fill) => `<path d="M${x} ${y + 0.9 * s} C${x - 1.2 * s} ${y + 0.1 * s} ${x - 0.9 * s} ${y - 0.9 * s} ${x} ${y - 0.3 * s} C${x + 0.9 * s} ${y - 0.9 * s} ${x + 1.2 * s} ${y + 0.1 * s} ${x} ${y + 0.9 * s}Z" fill="${fill}" stroke="#FFFFFF" stroke-width="2"/>`;
function blush(id, g) {
  const A = V3.anchors[BODY[g]], y = (A.nose[1] + A.mouth[1]) / 2 - 4, dx = (A.eye_right[0] - A.eye_left[0]) / 2 + 9, cx = A.nose[0];
  return `<radialGradient id="${id}blush"><stop offset="0" stop-color="#FF6F8E" stop-opacity=".5"/><stop offset="1" stop-color="#FF6F8E" stop-opacity="0"/></radialGradient>` +
    `<g data-step="exp-blush"><ellipse cx="${(cx - dx).toFixed(1)}" cy="${y.toFixed(1)}" rx="15" ry="8" fill="url(#${id}blush)"/><ellipse cx="${(cx + dx).toFixed(1)}" cy="${y.toFixed(1)}" rx="15" ry="8" fill="url(#${id}blush)"/></g>`;
}
function floatingHearts(g) {
  const A = V3.anchors[BODY[g]], top = A.skull_top[1], cx = A.skull_top[0];
  // 머리 위·옆(높이 올린 포니테일·고양이 귀·뿔과 겹치지 않게 머리 꼭대기보다 넉넉히 위, 옆 하트는 머리 장식 바깥)
  return `<g data-step="exp-floating-hearts">${heart(cx - 100, top - 34, 13, '#FF8FB1')}${heart(cx + 4, top - 88, 16, '#FF6F9C')}${heart(cx + 102, top - 44, 12, '#FF8FB1')}</g>`;
}
export const EXPRESSION_PARTS_V3 = Object.freeze(['exp-blush', 'exp-floating-hearts']);
// 보기: full = 캔버스 전체 · bust = 얼굴·어깨(작은 칸용) · 그 밖은 "x y w h" 그대로
const VIEWS = Object.freeze({full: `0 0 ${SIZE} ${SIZE}`, bust: '347 34 330 330'});

// 캐릭터 한 장. dj = DJ 캐릭터({gender, hair, hairColor, eyes, nose, mouth} — 예전 V2 값도 받는다), look = {worn:{칸:옷id}, trick:{item,slot}(1시간 장난 분장 — 그 칸을 덮는다)},
// expression = 레벨 표정({parts}). options: transparent(바탕 없음) · solid(바탕 색) · label(접근성 이름) · view('full'|'bust'|viewBox 글).
// items·art 는 예전(V2) 호출과 맞추려고 받기만 한다(V3 는 kiugi-v3-data.js 의 표로 그린다).
export function characterSvg(dj = {}, look = {}, {expression = null, transparent = false, solid = 'var(--kg-stage,#EFE9F8)', label = '', view = 'full'} = {}) {
  const L = normalizeLook(dj), g = L.gender, id = 'kg' + (++SEQ).toString(36) + '_';
  const worn = {...(look?.worn || {})};
  if (look?.trick?.item && look.trick.slot) worn[look.trick.slot] = look.trick.item;
  const bodyA = partOf('body', g, 1), back = partOf('hair', g, L.hair, 'back'), front = partOf('hair', g, L.hair, 'front');
  const outfit = wornAsset('outfit', worn.outfit, g), shoe = wornAsset('shoes', worn.shoes, g);
  const parts = new Set(Array.isArray(expression?.parts) ? expression.parts : []);
  const defs = [tintFilter(id, HAIR_COLORS[L.hairColor] || HAIR_COLORS.brown)];
  const tint = ` filter="url(#${id}hair)"`;
  // 몸 칸(뒷머리를 지우지 않게 따로 묶는다)
  let dressed = image(bodyA, ' data-step="body"');
  if (outfit) {
    if (outfit.cut) { defs.push(maskDef(id, 'oc', outfit.cut, 'inv')); dressed = `<g mask="url(#${id}oc)" data-step="outfit.cut">${dressed}</g>`; }
    dressed += image(outfit, ' data-step="outfit"');
  }
  if (shoe) {
    if (shoe.cut) { defs.push(maskDef(id, 'sc', shoe.cut, 'inv')); dressed = `<g mask="url(#${id}sc)" data-step="shoe.cut">${dressed}</g>`; }
    dressed += image(shoe, ' data-step="shoe"');
    if (outfit?.hem) { defs.push(maskDef(id, 'hm', outfit.hem, 'keep')); dressed += `<g mask="url(#${id}hm)" data-step="outfit.hem">${image(outfit)}</g>`; }
  }
  if ((outfit && outfit.cut) || (shoe && (shoe.cut || outfit?.hem))) defs.push(maskFilters(id));
  let o = transparent ? '' : `<rect width="${SIZE}" height="${SIZE}" style="fill:${solid}"/>`;
  if (back) o += image(back, ' data-step="hair.back"' + tint);
  o += `<g data-step="dressed">${dressed}</g>`;
  for (const c of ['eyes', 'nose', 'mouth']) { const a = partOf(c, g, L[c]); if (a) o += image(a, ` data-step="${c}"`); }
  if (parts.has('exp-blush')) o += blush(id, g);
  if (front) o += image(front, ' data-step="hair.front"' + tint);
  for (const s of ACCESSORY_ORDER) { const a = wornAsset(s, worn[s], g); if (a) o += image(a, ` data-step="accessory.${s}"`); }
  if (parts.has('exp-floating-hearts')) o += floatingHearts(g);
  const box = VIEWS[view] || (typeof view === 'string' && /^\d+ \d+ \d+ \d+$/.test(view) ? view : VIEWS.full);
  return `<svg viewBox="${box}" xmlns="http://www.w3.org/2000/svg" role="img"${label ? ` aria-label="${esc(label)}"` : ' aria-hidden="true"'}><defs>${defs.join('')}</defs>${o}</svg>`;
}

// ── 상점·도감의 옷 한 벌 ──
// 시즌 보상 배지(캐릭터에는 그리지 않는다 — V3 몸에 맞는 그림이 아직 없다). 작은 벡터 그림(예전 자리 그림을 그대로 씀).
const OUT = '#4A3426', s5 = ` stroke="${OUT}" stroke-width="5" stroke-linejoin="round"`, s6 = ` stroke="${OUT}" stroke-width="6" stroke-linejoin="round"`;
function star(cx, cy, r, fill, stroke = true) { const p = []; for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; p.push((cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy - rr * Math.sin(a)).toFixed(1)); } return `<polygon points="${p.join(' ')}" fill="${fill}"${stroke ? s5 : ''}/>`; }
const BADGES = Object.freeze({
  'pumpkin-crown': {box: '232 20 560 560', svg: () => `<path d="M356 216 L372 120 L440 172 L512 96 L584 172 L652 120 L668 216Z" fill="#F2C230"${s6}/><ellipse cx="512" cy="130" rx="40" ry="30" fill="#F28C28"${s5}/><rect x="506" y="92" width="12" height="16" rx="4" fill="#5E8C3A"/>${star(372, 110, 16, '#FFF8C2', false)}${star(652, 110, 16, '#FFF8C2', false)}${star(470, 70, 10, '#FFF8C2', false)}${star(560, 62, 12, '#FFF8C2', false)}`},
  // 어두운 화면(키우기 사이트)에서도 보이게 보랏빛 테두리
  'shadow-wings': {box: '92 300 840 840', svg: () => `<g fill="#2A1F3D" stroke="#A58CFF" stroke-width="7" stroke-linejoin="round"><path d="M440 600 Q300 380 120 420 Q200 470 190 540 Q260 520 280 590 Q330 560 360 640 Q400 600 440 660Z"/><path d="M584 600 Q724 380 904 420 Q824 470 834 540 Q764 520 744 590 Q694 560 664 640 Q624 600 584 660Z"/></g><path d="M140 420 Q200 400 260 430 M884 420 Q824 400 764 430" stroke="#A58CFF" stroke-width="8" stroke-linecap="round" opacity=".8"/>`},
  'moonlight-aura': {box: '92 0 840 840', svg: () => `<circle cx="512" cy="420" r="380" fill="#FFF6C8" opacity=".55"/><circle cx="512" cy="420" r="300" fill="#FFF9DC" opacity=".65"/>${star(190, 260, 14, '#FFE27A', false)}${star(840, 300, 16, '#FFE27A', false)}${star(250, 700, 10, '#FFFFFF', false)}${star(800, 720, 12, '#FFFFFF', false)}`},
});
export const isReward = (id) => Object.hasOwn(BADGES, id);
// 그림이 있는 옷인가(V3 옷 또는 시즌 보상 배지)
export const hasItemArt = (id) => Boolean(pairOf(id) && partOf(pairOf(id).category, 'f', pairOf(id).number)) || isReward(id);
const placeholder = (name) => `<g><rect x="262" y="472" width="500" height="80" rx="18" fill="#FFFFFF" fill-opacity=".85" stroke="#7353D9" stroke-dasharray="12 8" stroke-width="5"/><text x="512" y="526" text-anchor="middle" font-size="40" font-weight="700" fill="#7353D9">${esc(name)}</text></g>`;
// 미리 보기 칸: 그 옷의 투명하지 않은 상자(가져올 때 잰 값)를 넉넉히 감싼 정사각형. 의상은 머리부터 보이게(머리 없는 몸이 되지 않게).
export function thumbBox(a) {
  if (!a) return VIEWS.full;
  let [x0, y0, x1, y1] = Array.isArray(a.box) ? a.box : [0, 0, SIZE, SIZE];
  if (a.category === 'outfit') { const A = V3.anchors[a.body]; y0 = Math.min(y0, Math.round(A.skull_top[1]) - 50); }
  // 가장 작은 칸: 손 장식은 손목·손만 보이게 더 가까이(작은 팔찌가 보이게), 머리·얼굴·목 장식은 얼굴이 함께 보이게
  const w = x1 - x0, h = y1 - y0, min = a.category === 'accessory' ? (a.slot === 'hand' ? 170 : 230) : a.category === 'shoe' ? 320 : 300;
  const s = Math.min(SIZE, Math.max(min, Math.round(Math.max(w, h) * (a.category === 'outfit' ? 1.04 : 1.25))));
  const clamp = (v) => Math.max(0, Math.min(SIZE - s, Math.round(v)));
  return `${clamp((x0 + x1) / 2 - s / 2)} ${clamp((y0 + y1) / 2 - s / 2)} ${s} ${s}`;
}
// 상점·도감의 옷 한 벌: 캐릭터(dj — DJ 캐릭터, 없으면 그 성별의 기본 얼굴·머리)가 그 옷만 입은 모습을, 옷이 있는 곳만 보이게 잘라 보인다(그림 전체 캔버스를 줄였다 옮길 뿐 — 옷 그림은 자르지 않는다).
// gender: 'f'|'m'(DJ 캐릭터 성별이 다르면 그 성별 기본 캐릭터). 시즌 보상은 배지 그림, 모르는 옷은 이름 자리 표시.
export function itemSvg(id, {label = '', gender = 'f', dj = null, name = '', items = {}} = {}) {
  const g = gender === 'm' ? 'm' : 'f', aria = label ? ` aria-label="${esc(label)}"` : ' aria-hidden="true"';
  if (isReward(id)) { const b = BADGES[id]; return `<svg viewBox="${b.box}" xmlns="http://www.w3.org/2000/svg" role="img"${aria}>${b.svg()}</svg>`; }
  const p = pairOf(id), a = p ? partOf(p.category, g, p.number) : null;
  if (!a) return `<svg viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg" role="img"${aria}>${placeholder(name || items?.[id]?.name || id)}</svg>`;
  const face = dj && normalizeLook(dj).gender === g ? {...normalizeLook(dj)} : {...LOOK_DEFAULT, gender: g};
  const slot = p.category === 'outfit' ? 'outfit' : p.category === 'shoe' ? 'shoes' : a.slot;
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
