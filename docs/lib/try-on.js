// 입혀 보기(캐릭터 페이지, 2026-10-09 사용자: "캐릭터 페이지에서 옷을 눌러 미리 입혀 보고, 마음에 들면 !옷장 상의11 하의3 같은 채팅을 한 번에 복사"):
//  지금 입은 옷 + 입혀 본 옷 → 미리 보기 모습, 방송 채팅 한 줄("!옷장 상의11 하의3 신발2"). DOM 없이(노드 시험에서 그대로 불러 쓴다).
// 먼치킨(0.15.66 + 여러 벌 !옷장) 규칙과 같게 — 봇 kiugi.mjs putOn·dressOf·#items:
//  · 한 줄에 번호 여러 개: "!옷장" + 띄어쓰기 하나로 나눈 번호(번호 안에는 띄어쓰기 없음 — itemCodeOf 글 그대로: 한벌N·상의N·하의N·신발N·악세N·배경N), 한 번에 8벌까지.
//  · 적은 차례대로 가진 옷은 입기만(냥을 쓰지 않음), 없는 옷은 사서 입는다. 냥이 모자란 옷은 빼고 나머지만(옷에는 레벨 조건이 없다 — 2026-10-10 먼치킨 값 통일).
//  · 칸마다 한 벌(악세사리는 머리·얼굴·목·손·왕관·날개·오라 자리마다 하나). 한벌옷을 입으면 상의·하의는 가려지고(기록에는 남는다),
//    상의·하의를 입으면 한벌옷을 벗는다. 왕관(악세11)을 쓰면 머리 장식은 가려진다. 배경은 장면 하나.
import { itemCodeOf, OLD_REWARD_IDS } from './kiugi-draw.js';

// 채팅 명령(views/items.js 의 chatHint 도 이것을 쓴다)
export const CLOSET_CMD = '!옷장';
// 한 줄에 번호 몇 개까지(먼치킨 CLOSET_MULTI_MAX 와 같게)
export const TRY_MAX = 8;
export const TRY_NOTE = '이미 가진 옷은 냥을 쓰지 않고 입기만 해요 · 냥이 모자란 옷은 빼고 나머지만 사서 입어요 · 한 번에 8벌까지';
export const TRY_FULL = `한 번에 ${TRY_MAX}벌까지 입혀 볼 수 있어요. 다른 옷을 하나 빼고 골라 주세요.`;
export const TRY_COPIED = '복사했어요 · 방송 채팅에 붙여 넣으면 사서 바로 입어요';
export const CROWN_NOTE = '왕관을 쓰면 머리 장식은 가려져요';

const TOPS = new Set(['top', 'bottom']);
const currentId = (id) => OLD_REWARD_IDS[id] || id;
const idOf = (item) => (typeof item === 'string' ? item : item?.id ?? null);
// 옷 id → 칸(시즌 목록에 없는 옷·칭호는 null)
export const slotOfItem = (catalog, id) => catalog?.items?.[currentId(id)]?.slot || null;

// 입은 옷(서버가 보낸 {칸: 옷id}) → 새 객체. 0.15.62 이하가 올린 예전 보상 id(pumpkin-crown 등)는 악세11~13 id 로. 모르는 옷 id 는 그대로 둔다(그림이 알아서 뺀다).
export function wornLook(worn) {
  const out = {};
  if (!worn || typeof worn !== 'object' || Array.isArray(worn)) return out;
  for (const [slot, id] of Object.entries(worn)) if (typeof id === 'string' && id) out[slot] = currentId(id);
  return out;
}
// 지금 입은 옷 id 모음
export const wornIds = (worn) => new Set(Object.values(wornLook(worn)));

// 같이 입을 수 없는 두 옷인가(입힐 옷 칸 slot · 다른 옷 칸 other): 같은 칸, 한벌옷 ↔ 상의·하의
const clashes = (slot, other) => other === slot || (slot === 'outfit' && TOPS.has(other)) || (TOPS.has(slot) && other === 'outfit');

// 미리 보기 모습: 입은 옷 위에 입혀 본 옷을 차례대로 입힌다(봇 putOn 과 같게 — 상의·하의를 입으면 한벌옷을 벗는다. 한벌옷·왕관이 가리는 것은 그림이 정한다).
export function applyTryOn(worn, tried, catalog) {
  const look = wornLook(worn);
  for (const item of Array.isArray(tried) ? tried : []) {
    const id = currentId(idOf(item)), slot = slotOfItem(catalog, id);
    if (!slot) continue;
    look[slot] = id;
    if (TOPS.has(slot)) delete look.outfit;
  }
  return look;
}

// 그 칸의 옷이 미리 보기에 보이는가(한벌옷이 상의·하의를, 왕관이 머리 장식을 가린다)
export function isShown(look, slot, catalog) {
  if (!look?.[slot] || !slotOfItem(catalog, look[slot])) return false;
  if (TOPS.has(slot) && slotOfItem(catalog, look.outfit) === 'outfit') return false;
  if (slot === 'head' && slotOfItem(catalog, look.crown) === 'crown') return false;
  return true;
}
// 옷 하나가 미리 보기에 보이는가
export const itemShown = (look, id, catalog) => { const slot = slotOfItem(catalog, id); return Boolean(slot) && look?.[slot] === currentId(id) && isShown(look, slot, catalog); };

// 옷을 눌렀을 때 입혀 본 옷 목록(새 배열, 누른 차례 = 채팅 한 줄의 차례):
//  · 입혀 본 옷이면 뺀다.
//  · 지금 입은 옷이면(opts.worn) 그 자리를 차지한·가린 입혀 본 옷을 빼서 원래 옷으로 되돌린다(명령은 필요 없다).
//    그래도 가려 있으면(입은 한벌옷 아래의 상의·하의) 다시 입는 것으로 더한다 — 봇이 냥 없이 입히고 한벌옷을 벗긴다. 왕관 아래 머리 장식은 그대로(왕관이 가린다).
//  · 아니면 더한다 — 같은 칸 옷, 한벌옷 ↔ 상의·하의는 빼고. 그래도 TRY_MAX 를 넘으면 그대로(canTry 가 false).
function step(tried, item, catalog, worn) {
  const list = (Array.isArray(tried) ? tried : []).map((x) => currentId(idOf(x))).filter(Boolean);
  const id = currentId(idOf(item)), slot = slotOfItem(catalog, id);
  if (!id || !slot) return { list, full: false };
  if (list.includes(id)) return { list: list.filter((x) => x !== id), full: false };
  const other = (x) => slotOfItem(catalog, x);
  const next = list.filter((x) => !clashes(slot, other(x)) && !(wornIds(worn).has(id) && slot === 'head' && other(x) === 'crown'));
  if (wornIds(worn).has(id) && (slot === 'head' || itemShown(applyTryOn(worn, next, catalog), id, catalog))) return { list: next, full: false };
  return next.length >= TRY_MAX ? { list, full: true } : { list: [...next, id], full: false };
}
export const toggleTry = (tried, item, catalog, { worn = null } = {}) => step(tried, item, catalog, worn).list;
// 더 입혀 볼 수 있는가(한 번에 TRY_MAX 벌까지 — 같은 칸 옷을 바꾸거나 빼는 것은 늘 된다)
export const canTry = (tried, item, catalog, { worn = null } = {}) => !step(tried, item, catalog, worn).full;

// 입혀 본 옷 → 채팅 번호(상의11 …, 번호 없는 옷은 뺀다)
export const tryCodes = (tried, catalog, seasonId) => (Array.isArray(tried) ? tried : []).map((x) => itemCodeOf(catalog, seasonId, idOf(x))).filter(Boolean);
// 번호들 → 방송 채팅 한 줄: "!옷장 상의11 하의3 신발2"(번호 안 띄어쓰기 없음, 한 번에 TRY_MAX 개까지). 번호가 없으면 ''.
//  한 벌이면 "!옷장 상의 11"(띄어 쓴다): 먼치킨 0.15.70 부터 "!옷장 상의11" 처럼 하나만 붙여 쓰면 목록 쪽(상의 11쪽)이라서다(2026-10-10 쪽 나누기).
const CODE = /^[가-힣]+\d{1,3}$/;
export function closetLine(codes) {
  const list = (Array.isArray(codes) ? codes : []).map((c) => String(c ?? '').normalize('NFC').replace(/\s+/g, '')).filter((c) => CODE.test(c)).slice(0, TRY_MAX);
  if (list.length === 1) return `${CLOSET_CMD} ${list[0].replace(/^(\D+?)(\d+)$/, '$1 $2')}`;
  return list.length ? `${CLOSET_CMD} ${list.join(' ')}` : '';
}
// 입혀 본 옷 값: {count(벌), price(합계 냥 — 지금 입은 옷은 가진 옷이라 빼고)}. 옷에는 레벨 조건이 없어(2026-10-10) 레벨은 세지 않는다.
export function tryTotal(tried, catalog, { worn = null } = {}) {
  const have = wornIds(worn);
  const all = (Array.isArray(tried) ? tried : []).map((x) => currentId(idOf(x))).filter((id) => catalog?.items?.[id]), buy = all.filter((id) => !have.has(id));
  return { count: all.length, price: buy.reduce((n, id) => n + (Number(catalog.items[id].price) || 0), 0) };
}
// 미리 보기에 알릴 것(입혀 본 옷이 가려져 보이지 않을 때)
export function tryNotes(worn, tried, catalog) {
  const look = applyTryOn(worn, tried, catalog), slots = new Set((Array.isArray(tried) ? tried : []).map((x) => slotOfItem(catalog, idOf(x))));
  const notes = [];
  if (look.head && slotOfItem(catalog, look.head) === 'head' && slotOfItem(catalog, look.crown) === 'crown' && (slots.has('head') || slots.has('crown'))) notes.push(CROWN_NOTE);
  return notes;
}
