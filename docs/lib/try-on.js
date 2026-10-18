// 입혀 보기(캐릭터 페이지, 2026-10-09 사용자: "캐릭터 페이지에서 옷을 눌러 미리 입혀 보고, 마음에 들면 !옷장 상의11 하의3 같은 채팅을 한 번에 복사"):
//  지금 입은 옷 + 입혀 본 옷 → 미리 보기 모습, 방송 채팅 한 줄("!옷장 상의11 하의3 신발2"). DOM 없이(노드 시험에서 그대로 불러 쓴다).
// 먼치킨(0.15.66 + 여러 벌 !옷장 · 새 그림체 R7 의 모자 칸) 규칙과 같게 — 봇 kiugi.mjs putOn·dressOf·#items:
//  · 한 줄에 번호 여러 개: "!옷장" + 띄어쓰기 하나로 나눈 번호(번호 안에는 띄어쓰기 없음 — itemCodeOf 글 그대로: 한벌N·상의N·하의N·신발N·모자N·악세N·배경N·칭호N), 한 번에 8개까지.
//  · 적은 차례대로 가진 옷은 입기만(냥을 쓰지 않음), 없는 옷은 사서 입는다. 냥이 모자란 옷은 빼고 나머지만(옷에는 레벨 조건이 없다 — 2026-10-10 먼치킨 값 통일).
//  · 칸마다 한 벌: 모자는 하나(모자 칸), 악세사리는 머리·얼굴·목·손 자리마다 하나(모자와 함께 쓴다 — 자리는 시즌 목록의 그 악세사리 slot).
//    한벌옷을 입으면 상의·하의는 가려지고(기록에는 남는다), 상의·하의를 입으면 한벌옷을 벗는다. 배경은 장면 하나.
//    (예전 그림의 왕관·날개·오라 — 악세11~13 — 은 R7 에 없다. 왕관이 머리 장식을 가리던 규칙도 없앴다.)
// 칭호(2026-10-14 사용자: "입혀 보기에서 칭호도 고르게"): 시즌 칭호를 하나 골라 미리 달아 보고, 채팅 한 줄 맨 끝에 번호를 붙인다("!옷장 상의11 하의3 칭호2").
//  먼치킨은 옷을 먼저 사고 입힌 뒤 칭호를 한다 — 가진 칭호는 달기만, 없으면 사서 단다. 한 줄에 칭호는 하나만, 옷과 칭호를 합쳐 TRY_MAX 개까지.
//  칭호는 상점이 열린 때(rewardRule.opensAt — 시즌 1은 10월 30일)부터 시즌 끝까지 팔고, Lv.10 이 되어야 산다(값은 시즌 목록 price).
//  지금 단 칭호(서버가 보낸 data.titles[0])는 입은 옷처럼 "다는 중" — 고를 것이 없고 값도 세지 않는다.
import { itemCodeOf, titleOpenDate, motionOf } from './kiugi-draw.js';

// 채팅 명령(views/items.js 의 chatHint 도 이것을 쓴다)
export const CLOSET_CMD = '!옷장';
// 한 줄에 번호 몇 개까지(먼치킨 CLOSET_MULTI_MAX 와 같게 — 칭호 번호도 하나로 센다)
export const TRY_MAX = 8;
export const TRY_NOTE = '이미 가진 옷은 냥을 쓰지 않고 입기만 해요 · 냥이 모자란 옷은 빼고 나머지만 사서 입어요 · 한 번에 8벌까지';
export const TRY_FULL = `옷과 칭호를 합쳐 한 번에 ${TRY_MAX}개까지 고를 수 있어요. 다른 것을 하나 빼고 골라 주세요.`;
export const TRY_COPIED = '복사했어요 · 방송 채팅에 붙여 넣으면 사서 바로 입어요';
// 칭호 번호 글(views/items.js TITLE_WORD 와 같은 "칭호")
export const TITLE_CODE_WORD = '칭호';
export const TITLE_WORN = '지금 달고 있는 칭호예요';

const TOPS = new Set(['top', 'bottom']);
const idOf = (item) => (typeof item === 'string' ? item : item?.id ?? null);
// 옷 id → 칸(시즌 목록에 없는 옷·칭호는 null — 예전 그림의 옷 id 도)
export const slotOfItem = (catalog, id) => (typeof id === 'string' && catalog?.items && Object.hasOwn(catalog.items, id) ? catalog.items[id].slot || null : null);

// 맨몸부터(2026-10-15 사용자 "아예 맨몸에서부터 시작하게 !다벗기"): 먼치킨 !다벗기 처럼 입은 옷·악세사리를 모두 벗긴 모습(배경은 그대로 — 몸에 입는 것이 아니다)에서
//  골라 입혀 보고, 채팅 한 줄은 "!옷장 다벗기 상의11 하의3"(고른 것이 없으면 "!다벗기"). 지금 입은 옷은 가진 옷이라 값에 넣지 않는다(다시 입기만).
export const UNDRESS_WORD = '다벗기';
export const UNDRESS_CMD = '!다벗기';
export const BARE_KEEP = Object.freeze(['bg']);
export const BARE_NOTE = '맨몸이에요 · 옷을 눌러 입혀 보세요';
// 입은 옷(서버가 보낸 {칸: 옷id}) → 새 객체. 모르는 옷 id(예전 그림의 옷 — 먼치킨을 아직 업데이트하지 않은 방송)는 그대로 둔다(그림이 알아서 뺀다).
export function wornLook(worn) {
  const out = {};
  if (!worn || typeof worn !== 'object' || Array.isArray(worn)) return out;
  for (const [slot, id] of Object.entries(worn)) if (typeof id === 'string' && id) out[slot] = id;
  return out;
}
// 지금 입은 옷 id 모음
export const wornIds = (worn) => new Set(Object.values(wornLook(worn)));
// 맨몸부터: 입은 옷에서 배경(BARE_KEEP)만 남긴 모습
export function bareWorn(worn) {
  const look = wornLook(worn), out = {};
  for (const s of BARE_KEEP) if (look[s]) out[s] = look[s];
  return out;
}

// 같이 입을 수 없는 두 옷인가(입힐 옷 칸 slot · 다른 옷 칸 other): 같은 칸, 한벌옷 ↔ 상의·하의
const clashes = (slot, other) => other === slot || (slot === 'outfit' && TOPS.has(other)) || (TOPS.has(slot) && other === 'outfit');

// 미리 보기 모습: 입은 옷 위에 입혀 본 옷을 차례대로 입힌다(봇 putOn 과 같게 — 상의·하의를 입으면 한벌옷을 벗는다. 한벌옷이 가리는 것은 그림이 정한다).
export function applyTryOn(worn, tried, catalog) {
  const look = wornLook(worn);
  for (const item of Array.isArray(tried) ? tried : []) {
    const id = idOf(item), slot = slotOfItem(catalog, id);
    if (!slot) continue;
    look[slot] = id;
    if (TOPS.has(slot)) delete look.outfit;
  }
  return look;
}

// 그 칸의 옷이 미리 보기에 보이는가(한벌옷이 상의·하의를 가린다 — 모자와 머리 장식은 함께 보인다)
export function isShown(look, slot, catalog) {
  if (!look?.[slot] || slotOfItem(catalog, look[slot]) !== slot) return false;
  if (TOPS.has(slot) && slotOfItem(catalog, look.outfit) === 'outfit') return false;
  return true;
}
// 옷 하나가 미리 보기에 보이는가
export const itemShown = (look, id, catalog) => { const slot = slotOfItem(catalog, id); return Boolean(slot) && look?.[slot] === id && isShown(look, slot, catalog); };

// 옷을 눌렀을 때 입혀 본 옷 목록(새 배열, 누른 차례 = 채팅 한 줄의 차례):
//  · 입혀 본 옷이면 뺀다.
//  · 지금 입은 옷이면(opts.worn) 그 자리를 차지한·가린 입혀 본 옷을 빼서 원래 옷으로 되돌린다(명령은 필요 없다).
//    그래도 가려 있으면(입은 한벌옷 아래의 상의·하의) 다시 입는 것으로 더한다 — 봇이 냥 없이 입히고 한벌옷을 벗긴다.
//  · 아니면 더한다 — 같은 칸 옷, 한벌옷 ↔ 상의·하의는 빼고. 그래도 TRY_MAX 를 넘으면 그대로(canTry 가 false). 칭호를 골라 두었으면(opts.title) 옷은 TRY_MAX − 1 벌까지.
function step(tried, item, catalog, worn, max = TRY_MAX) {
  const list = (Array.isArray(tried) ? tried : []).map(idOf).filter(Boolean);
  const id = idOf(item), slot = slotOfItem(catalog, id);
  if (!id || !slot) return { list, full: false };
  if (list.includes(id)) return { list: list.filter((x) => x !== id), full: false };
  const other = (x) => slotOfItem(catalog, x);
  const next = list.filter((x) => !clashes(slot, other(x)));
  if (wornIds(worn).has(id) && itemShown(applyTryOn(worn, next, catalog), id, catalog)) return { list: next, full: false };
  return next.length >= max ? { list, full: true } : { list: [...next, id], full: false };
}
// 옷이 몇 벌까지 들어가는가(골라 둔 칭호가 한 자리를 차지한다)
const clothesMax = (catalog, title, wornTitle) => TRY_MAX - (pickedTitle(catalog, title, wornTitle) ? 1 : 0);
export const toggleTry = (tried, item, catalog, { worn = null, title = null, wornTitle = null } = {}) => step(tried, item, catalog, worn, clothesMax(catalog, title, wornTitle)).list;
// 더 입혀 볼 수 있는가(옷과 칭호를 합쳐 TRY_MAX 개까지 — 같은 칸 옷을 바꾸거나 빼는 것은 늘 된다)
export const canTry = (tried, item, catalog, { worn = null, title = null, wornTitle = null } = {}) => !step(tried, item, catalog, worn, clothesMax(catalog, title, wornTitle)).full;

// 입혀 본 옷 → 채팅 번호(상의11 …, 번호 없는 옷은 뺀다)
export const tryCodes = (tried, catalog, seasonId) => (Array.isArray(tried) ? tried : []).map((x) => itemCodeOf(catalog, seasonId, idOf(x))).filter(Boolean);

// ---- 칭호 ----
// 칭호 id → 시즌 목록의 칭호(모르는 id 는 null)
export const titleOf = (catalog, id) => (typeof id === 'string' && catalog?.titles?.[id]) || null;
// 칭호 번호("칭호2" — 그 칭호가 나온 시즌의 차례, 옷 도감·먼치킨 채팅과 같은 글). 모르는 칭호는 null.
export const titleCode = (catalog, id) => { const t = titleOf(catalog, id); return t ? `${TITLE_CODE_WORD}${t.number}` : null; };
// 지금 단 칭호(서버가 보낸 단 칭호 목록 → 첫 번째, 시즌 목록에 있는 것만). 없으면 null.
export const wornTitleOf = (catalog, titles) => (Array.isArray(titles) ? titles.map((id) => titleOf(catalog, id)?.id).find(Boolean) : null) || null;
// 골라 둔 칭호가 채팅 한 줄에 들어가는가: 시즌 목록에 있고 지금 단 칭호가 아닐 때만 그 id, 아니면 null
export function pickedTitle(catalog, title, wornTitle = null) {
  const t = titleOf(catalog, title);
  return t && t.id !== wornTitle ? t.id : null;
}
// 미리 보기에 보이는 칭호: 골라 둔 칭호, 없으면 지금 단 칭호(둘 다 없으면 null)
export const shownTitle = (catalog, title, wornTitle = null) => pickedTitle(catalog, title, wornTitle) || titleOf(catalog, wornTitle)?.id || null;
// 칭호를 눌렀을 때 골라 둔 칭호(하나만): 고른 칭호를 다시 누르면 뺀다, 지금 단 칭호를 누르면 뺀다(단 칭호로 되돌린다 — 명령은 필요 없다), 다른 칭호면 바꾼다.
//  모르는 칭호는 그대로. 새로 고를 자리가 없으면(옷이 TRY_MAX 벌) 그대로(canTitle 이 false).
export function toggleTitle(title, id, catalog, { tried = [], wornTitle = null } = {}) {
  const now = pickedTitle(catalog, title, wornTitle), t = titleOf(catalog, id);
  if (!t) return now;
  if (t.id === now || t.id === wornTitle) return null;
  return canTitle(tried, now, t.id, catalog, { wornTitle }) ? t.id : now;
}
// 칭호를 더 고를 수 있는가: 칭호를 바꾸거나 빼는 것은 늘 되고, 새로 고를 때만 옷이 TRY_MAX − 1 벌 이하여야 한다
export function canTitle(tried, title, id, catalog, { wornTitle = null } = {}) {
  const t = titleOf(catalog, id);
  if (!t || t.id === wornTitle || pickedTitle(catalog, title, wornTitle)) return true;
  return (Array.isArray(tried) ? tried.length : 0) < TRY_MAX;
}
// 방송 채팅 한 줄: 입혀 본 옷 번호 + 맨 끝에 골라 둔 칭호 번호("!옷장 상의11 하의3 칭호2", 칭호만이면 "!옷장 칭호 2"). 옷이 많아도 칭호 자리는 남긴다.
//  bare(맨몸부터): "!옷장 다벗기 상의11 하의3 칭호2", 고른 것이 없으면 "!다벗기".
export function tryLine(tried, catalog, seasonId, { title = null, wornTitle = null, bare = false } = {}) {
  const code = titleCode(catalog, pickedTitle(catalog, title, wornTitle));
  const codes = tryCodes(tried, catalog, seasonId).slice(0, code ? TRY_MAX - 1 : TRY_MAX);
  return closetLine(code ? [...codes, code] : codes, { bare });
}
// 번호들 → 방송 채팅 한 줄: "!옷장 상의11 하의3 신발2"(번호 안 띄어쓰기 없음, 한 번에 TRY_MAX 개까지). 번호가 없으면 ''.
//  한 벌이면 "!옷장 상의 11"(띄어 쓴다): 먼치킨 0.15.70~0.15.72 에서 "!옷장 상의11" 처럼 하나만 붙여 쓰면 목록 쪽이었고, 목록 명령을 없앤 뒤(2026-10-11)에도
//  붙여 쓴 하나는 예전 버릇으로 옷을 사 버리지 않게 사지 않고 설명만 한다 — 사는 한 벌은 늘 띄어 쓴다.
//  bare: "!옷장 다벗기 …"(먼치킨 0.15.84 — 다벗기 뒤의 번호는 하나여도 붙여 써도 된다), 번호가 없으면 "!다벗기".
const CODE = /^[가-힣]+\d{1,3}$/;
export function closetLine(codes, { bare = false } = {}) {
  const list = (Array.isArray(codes) ? codes : []).map((c) => String(c ?? '').normalize('NFC').replace(/\s+/g, '')).filter((c) => CODE.test(c)).slice(0, TRY_MAX);
  if (bare) return list.length ? `${CLOSET_CMD} ${UNDRESS_WORD} ${list.join(' ')}` : UNDRESS_CMD;
  if (list.length === 1) return `${CLOSET_CMD} ${list[0].replace(/^(\D+?)(\d+)$/, '$1 $2')}`;
  return list.length ? `${CLOSET_CMD} ${list.join(' ')}` : '';
}
// 입혀 본 옷 값: {count(벌), price(합계 냥 — 지금 입은 옷은 가진 옷이라 빼고)}. 옷에는 레벨 조건이 없어(2026-10-10) 레벨은 세지 않는다.
//  골라 둔 칭호(opts.title)가 있으면 그 값도 합계에 더한다(지금 단 칭호는 빼고). count 는 옷 벌 수 그대로.
export function tryTotal(tried, catalog, { worn = null, title = null, wornTitle = null } = {}) {
  const have = wornIds(worn);
  const all = (Array.isArray(tried) ? tried : []).map(idOf).filter((id) => slotOfItem(catalog, id)), buy = all.filter((id) => !have.has(id));
  const t = titleOf(catalog, pickedTitle(catalog, title, wornTitle));
  return { count: all.length, price: buy.reduce((n, id) => n + (Number(catalog.items[id].price) || 0), 0) + (t ? Number(t.price) || 0 : 0) };
}
// 미리 보기에 알릴 것: 골라 둔 칭호를 아직 살 수 없을 때(상점이 열리기 전 · 레벨이 모자람 — opts.level 을 알 때만)
//  (예전 그림의 "왕관을 쓰면 머리 장식은 가려져요"는 왕관이 없어져 뺐다. worn·tried 는 예전처럼 받는다 — 옷 알림이 다시 생기면 쓴다.)
export const TITLE_SOON = (date) => `칭호는 ${date}부터 살 수 있어요`;
export const TITLE_LEVEL = (min) => `칭호는 Lv.${min}이 되어야 살 수 있어요`;
export function tryNotes(worn, tried, catalog, { title = null, wornTitle = null, level = null, now = Date.now() } = {}) {
  const notes = [];
  const t = titleOf(catalog, pickedTitle(catalog, title, wornTitle));
  if (t) {
    const date = titleOpenDate(catalog.seasons?.[t.season]?.rewardRule, now);
    if (date) notes.push(TITLE_SOON(date));
    if (Number.isFinite(Number(level)) && level !== null && Number(level) < (Number(t.level) || 0)) notes.push(TITLE_LEVEL(t.level));
  }
  return notes;
}
// 입혀 보기 안내 한 줄: 칭호가 없는 시즌이면 TRY_NOTE 그대로, 있으면 칭호 규칙(여는 날 — 열리기 전에만 · 레벨)과 "옷과 칭호를 합쳐 8개까지"
export function tryNote({ titles = false, rule = null, now = Date.now() } = {}) {
  if (!titles) return TRY_NOTE;
  const date = titleOpenDate(rule, now), min = Number(rule?.minLevel) || 10;
  return ['이미 가진 옷·칭호는 냥을 쓰지 않고 입거나 달기만 해요', '냥이 모자란 옷은 빼고 나머지만 사서 입어요',
    date ? `칭호는 ${date}부터 팔고, Lv.${min}이 되어야 살 수 있어요` : `칭호는 Lv.${min}이 되어야 살 수 있어요`,
    `옷과 칭호를 합쳐 한 번에 ${TRY_MAX}개까지`].join(' · ');
}
// ---- 모션(2026-10-15 사용자 "청취자들이 모션을 살 수 있게 — 무릎 꿇고 울기·춤·손하트·스쿼트 …") ----
//  방송 채팅 "!모션 춤"(모션 이름 그대로 — 사서 바로 해요) · "!모션 끄기"(그만해요). 옷 한 줄과는 따로 복사한다(먼치킨 명령이 다르다).
//  모션은 한 번에 하나. 값은 시즌 목록(motions[].price)에서.
export const MOTION_CMD = '!모션';
export const MOTION_OFF = `${MOTION_CMD} 끄기`;
export const motionCommand = (m) => (m?.name ? `${MOTION_CMD} ${m.name}` : '');
// 입혀 보기의 모션 한 줄: 고른 모션(pick — 모션 id, null = 모션 없이)이 지금 하는 모션(now)과 같으면 ''(명령이 필요 없다),
//  모션 없이를 고르면 "!모션 끄기", 아니면 "!모션 <이름>". 모르는 id 는 모션 없음으로 본다.
export function motionLine(catalog, pick, now = null) {
  const p = motionOf(catalog, pick), n = motionOf(catalog, now);
  if ((p?.id || null) === (n?.id || null)) return '';
  return p ? motionCommand(p) : MOTION_OFF;
}
export const MOTION_COPIED = (line) => (line === MOTION_OFF ? '복사했어요 · 방송 채팅에 붙여 넣으면 모션을 멈춰요' : '복사했어요 · 방송 채팅에 붙여 넣으면 모션을 사서 바로 해요');

// ---- 표정(2026-10-19 사용자 "옷 입히기처럼 사이트에서 고르고 명령어로 바로 복사 붙여넣기 할 수 있게") ----
//  먼치킨 "!표정 방긋"(표정 이름 그대로 — 시즌 목록 expressions 의 name) · "!표정 자동"(레벨 표정으로 되돌리기). 냥은 들지 않는다.
//  고를 수 있는 것 = 지금 레벨까지 열린 표정(레벨 n 이면 1~n). 옷 한 줄과는 따로 복사한다(먼치킨 명령이 다르다).
export const EXP_CMD = '!표정';
export const EXP_AUTO = `${EXP_CMD} 자동`;
export const expCommand = (e) => (e?.name ? `${EXP_CMD} ${e.name}` : '');
export const EXP_LOCKED = (n) => `Lv.${n}이 되면 쓸 수 있어요`;
export const EXP_COPIED = (line) => (line === EXP_AUTO ? '복사했어요 · 방송 채팅에 붙여 넣으면 레벨 표정으로 돌아가요' : '복사했어요 · 방송 채팅에 붙여 넣으면 표정이 바로 바뀌어요');
// 표정 채팅 한 줄: 고른 표정 번호(pick — null = 자동)가 지금(now — 서버가 보낸 고른 표정, 열린 것만 · null = 자동)과 같으면 ''(명령이 필요 없다),
//  자동을 고르면 "!표정 자동", 아니면 "!표정 <이름>". list = expressionList(…) — 목록에 없거나 잠긴 번호는 명령을 만들지 않는다.
export function expLine(list, pick, now = null) {
  const p = Number.isInteger(pick) ? (list || []).find((e) => e.level === pick && e.open) || null : null;
  const n = Number.isInteger(now) ? (list || []).find((e) => e.level === now) || null : null;
  if ((p?.level ?? null) === (n?.level ?? null)) return '';
  if (Number.isInteger(pick) && !p) return '';
  return p ? expCommand(p) : EXP_AUTO;
}

// 복사했을 때 알림: 옷만 · 칭호만 · 둘 다 · 맨몸부터(bare)
export const copiedText = ({ clothes = 0, title = false, bare = false } = {}) =>
  (bare ? `복사했어요 · 방송 채팅에 붙여 넣으면 ${clothes || title ? '옷을 모두 벗고 고른 것만 입어요' : '옷을 모두 벗어요'}`
    : title ? `복사했어요 · 방송 채팅에 붙여 넣으면 ${clothes ? '옷을 사서 입고 칭호도 달아요' : '칭호를 사서 바로 달아요'}` : TRY_COPIED);
