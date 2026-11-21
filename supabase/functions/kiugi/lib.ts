// DJ 키우기 페이지 — Supabase Edge Function "kiugi"의 순수 검사·모양 만들기(지울 수 있는 TypeScript 만).
// Edge Function(Deno)과 노드 시험(tests/kiugi-server.test.mjs)이 같이 쓴다. 암호는 WebCrypto(crypto.subtle)만 쓴다(Deno·Node 24 모두 있음).
// 올리는 쪽: 먼치킨(봇 프로그램)이 승인받은 기기 키로 서명해 한 페이지 분량(DJ 캐릭터 + 청취자 시즌 아이디·레벨·애정도·입은 옷)을 통째로 바꾼다.
// 시즌 아이디 = 청취자가 DJ 방송 채팅에서 "!아이디 <한글 1~6자>"로 직접 만든 이름 + "#" + DJ 캐릭터 이름(예: 밤톨#먼치).
// 스푼에서 받은 정보(이름·고유닉·번호)는 받지도 저장하지도 않는다. jl-번호·냥·출석도 받지 않는다.
// 2단계: 애정도 숫자 숨김(SHOW_LOVE), 캐릭터 이름 열쇠(nameKeyOf), 메인 노출(main), 새로 꾸민 때(withChanges·summarize), 하트(heartMap·kstDay).
export class Fail extends Error {
  status: number;
  extra: Record<string, unknown> | undefined;
  constructor(status: number, message: string, extra?: Record<string, unknown>) { super(message); this.status = status; this.extra = extra; }
}
export const fail = (status: number, message: string, extra?: Record<string, unknown>) => new Fail(status, message, extra);

export const PREFIX = 'JUN-LIVE-KIUGI/1';
// 서명한 요청의 action: upload(키우기 페이지) · 보스전 보기(함수 v4, 2026-11-18 — 아래 "보스전 보기")
export const FIGHT_ACTIONS = ['fight-appear', 'fight-join', 'fight', 'fight-land', 'fight-drop'];
export const ACTIONS = ['upload', ...FIGHT_ACTIONS];
// 올리기 판(2026-11-15 시즌 2): v3 = 시즌 2 몬스터(아이디·대표·몬스터 종류·단계·레벨만 — 닉네임 없음) · v2 = 시즌 1 옷(2026-12-01 0시(한국)부터 받지 않음)
export const PAYLOAD_VERSION = 3, V2 = 2;
export const S2_START = Date.parse('2026-12-01T00:00:00+09:00');
export const S2_SEASON = { id: 's2', name: '몬스터 영토전', endsAt: '2026-12-31T14:59:59.000Z' };
// 몬스터: 종류 "<속성>_<두 자리>"(예 fire_01 — 속성 이름표는 먼치킨 season-s2.json 이 정한다), 단계 1~3, 레벨 1 이상 정수. 한 사람 몬스터는 24마리까지(같은 종류는 하나).
export const MONSTER_SP = /^[a-z]{1,12}_[0-9]{2}$/, MONSTERS_MAX = 24, MONSTER_STAGE_MAX = 3, MONSTER_LV_MAX = 9999;
// 주소(slug): 헷갈리는 글자(i·l·o·0·1)를 뺀 소문자·숫자 8자. 서버가 처음 올릴 때 만들어 그 기기에 묶는다.
export const SLUG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export const SLUG = /^[a-hjkmnp-z2-9]{8}$/;
// 시즌 아이디 = "<앞>#<DJ 캐릭터 이름>".
//  앞: 한글 완성 글자(가~힣)만 1~6자(청취자가 만든 부분). 캐릭터 이름: 한글·영문·숫자 1~8자이고 올린 내용의 character.name 과 같아야 한다.
//  띄어쓰기·기호·보이지 않는 글자가 섞이거나 뒤 이름이 이 페이지 캐릭터와 다르면 그 줄은 버린다.
export const ID_MAX = 6, CHARACTER_NAME_MAX = 8;
export const CHARACTER_NAME = /^[가-힣A-Za-z0-9]{1,8}$/;
export const FULL_ID = /^[가-힣]{1,6}#[가-힣A-Za-z0-9]{1,8}$/;
// 찾기 글(찾기 열쇠 모양 — 영문은 소문자): 앞 부분만("밤톨") 또는 전체("밤톨#먼치")
const QUERY_KEY = /^[가-힣]{1,6}(#[가-힣a-z0-9]{1,8})?$/;
export const MAX_PEOPLE = 3000, MAX_PAYLOAD_BYTES = 1_500_000, MAX_BODY_CHARS = 1_600_000;
export const NAME_MAX = 20, QUERY_MAX = 40, FIND_LIMIT = 5, TOP = 3, LEVEL_MAX = 100, LOVE_MAX = 1_000_000_000;
// 애정도 숫자를 밖으로 보일지(스푼 답을 기다리는 동안 false — 순서는 그대로 애정도 순)
export const SHOW_LOVE = false;
// 메인 페이지·전체 찾기 개수
export const HOME_POPULAR = 12, HOME_RECENT = 8, SEARCH_LIMIT = 10;
export const KEEP_MS = 60 * 86400000, CLOCK_SKEW_MS = 60000, NONCE_MS = 120000;

const enc = new TextEncoder();
// 화면에 보이지 않는 글자·줄바꿈·글 방향 바꾸기 글자(시즌 이름·찾기 글에서 뺀다 — 남을 흉내 내지 못하게).
// 글자 번호로 만든다(올리기 도구가 소스의 유니코드 표기를 글자로 풀어 정규식이 깨진 적이 있음).
const HIDDEN_RANGES = [[0x00, 0x1f], [0x7f, 0x9f], [0xad, 0xad], [0x200b, 0x200f], [0x2028, 0x202e], [0x2060, 0x206f], [0xfeff, 0xfeff]];
const HIDDEN = new RegExp('[' + HIDDEN_RANGES.map(([a, b]) => String.fromCharCode(a) + '-' + String.fromCharCode(b)).join('') + ']', 'g');
export function clean(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const s = value.replace(HIDDEN, '').replace(/\s+/g, ' ').trim();
  if (!s || [...s].length > max) return null;
  return s;
}
// 찾기 열쇠: 한글 모양을 맞추고(NFC) 영문은 소문자, 띄어쓰기·보이지 않는 글자는 뺀다("밤 톨#먼치" = "밤톨#먼치").
export const searchKey = (s: string) => String(s ?? '').normalize('NFC').replace(HIDDEN, '').toLowerCase().replace(/\s+/g, '');
// 시즌 아이디 검사: NFC 로 맞추고 앞뒤 공백만 뗀 뒤 "<한글 1~6자>#<캐릭터 이름>" 이고 뒤 이름이 이 페이지의 캐릭터 이름과 같은지. 아니면 null.
export function listenerId(value: unknown, characterName: string): string | null {
  if (typeof value !== 'string' || typeof characterName !== 'string') return null;
  const s = value.normalize('NFC').trim();
  if (!FULL_ID.test(s)) return null;
  return s.slice(s.indexOf('#') + 1) === characterName.normalize('NFC') ? s : null;
}
// 찾기 열쇠의 앞 부분("밤톨#먼치" → "밤톨")
const baseOf = (k: string) => k.split('#')[0];

// 모양 열쇠·옷 id: 영문 소문자·숫자·-·_ (예: 머리 'm_two-block', 'f_half-up')
const TOKEN = /^[a-z0-9][a-z0-9_-]{0,23}$/;
const SLOT = /^[a-z]{2,12}$/, ITEM = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const CHARACTER_FIELDS = ['gender', 'hair', 'hairColor', 'skin', 'eyes', 'nose', 'mouth'];
const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

// DJ 캐릭터: 이름(한글·영문·숫자 1~8자 — 청취자 아이디 뒤에 붙는다) + 모양 열쇠(영문 소문자·숫자·-)만.
// 모르는 칸은 버린다(새 모양이 생겨도 서버를 고치지 않아도 되게 이름표만 본다).
export function character(value: unknown) {
  if (!isObject(value)) throw fail(400, 'DJ 캐릭터를 확인해 주세요.');
  const name = typeof value.name === 'string' ? value.name.normalize('NFC').trim() : '';
  if (!CHARACTER_NAME.test(name)) throw fail(400, `DJ 캐릭터 이름을 확인해 주세요(한글·영문·숫자 1~${CHARACTER_NAME_MAX}자).`);
  const out: Record<string, string> = { name };
  for (const key of CHARACTER_FIELDS) { const x = value[key]; if (typeof x === 'string' && TOKEN.test(x)) out[key] = x; }
  return out;
}

export function season(value: unknown) {
  if (value === null || value === undefined) return null;
  if (!isObject(value)) throw fail(400, '시즌 정보를 확인해 주세요.');
  const id = typeof value.id === 'string' && TOKEN.test(value.id) ? value.id : null;
  const name = clean(value.name, NAME_MAX);
  const ends = typeof value.endsAt === 'string' ? Date.parse(value.endsAt) : NaN;
  if (!id || !name || !Number.isFinite(ends)) throw fail(400, '시즌 정보를 확인해 주세요.');
  return { id, name, endsAt: new Date(ends).toISOString() };
}

// 입은 옷: {칸: 옷 id}. 이름표에 맞지 않는 칸은 버리고, 12칸까지.
export function worn(value: unknown) {
  const out: Record<string, string> = {};
  if (!isObject(value)) return out;
  let n = 0;
  for (const [slot, id] of Object.entries(value)) {
    if (n >= 12) break;
    if (SLOT.test(slot) && typeof id === 'string' && ITEM.test(id)) { out[slot] = id; n++; }
  }
  return out;
}

// 칭호(2026-10-09 사용자 "시즌 보상은 칭호로"): 지금 효과가 있는 칭호 id 만(먼치킨이 얻은 시즌 + 다음 시즌 것만 보낸다). 옷 id 모양, 3개까지, 겹치면 하나.
export const TITLES_MAX = 3;
export function titles(value: unknown): string[] {
  const out: string[] = [];
  for (const x of Array.isArray(value) ? value : []) {
    if (out.length >= TITLES_MAX) break;
    if (typeof x === 'string' && ITEM.test(x) && !out.includes(x)) out.push(x);
  }
  return out;
}
// 펫(2026-10-15 사용자 "키우기.com 에서 자기 펫도 직접 볼 수 있게"): pets {펫 id(영문 소문자 1~20자): 단계 1~5}(10개까지) ·
//  pet {id, stage} 함께하는 펫 — pets 에 같은 단계로 있을 때만. 만난 횟수는 앱이 보내지 않는다. 펫이 없으면 두 칸 다 없다.
export const PETS_MAX = 10;
const PET_ID = /^[a-z]{1,20}$/;
export function petsField(value: unknown): { pets?: Record<string, number>; pet?: { id: string; stage: number } } {
  const pets: Record<string, number> = {};
  if (isObject(value) && isObject(value.pets)) {
    for (const [id, stage] of Object.entries(value.pets).slice(0, PETS_MAX)) if (PET_ID.test(id) && Number.isSafeInteger(stage) && (stage as number) >= 1 && (stage as number) <= 5) pets[id] = stage as number;
  }
  if (!Object.keys(pets).length) return {};
  const raw = isObject(value) && isObject(value.pet) ? value.pet : null;
  const pet = raw && typeof raw.id === 'string' && pets[raw.id] === raw.stage ? { id: raw.id, stage: raw.stage as number } : null;
  return { pets, ...(pet ? { pet } : {}) };
}
// 모션(2026-10-15 사용자 "청취자들이 모션을 살 수 있게"): 지금 모션 id 하나(영문 소문자 1~20자 — 시즌 목록 motions). 없으면 칸도 없다.
const MOTION_ID = /^[a-z]{1,20}$/;
export function motionField(value: unknown): { motion?: string } {
  return isObject(value) && typeof value.motion === 'string' && MOTION_ID.test(value.motion) ? { motion: value.motion } : {};
}
// 고른 표정(2026-10-19 사용자 "옷 입히기처럼 사이트에서 고르고 명령어로 바로 복사"): 시즌 목록 expressions 의 레벨 번호 1~10(정수)만.
//  먼치킨 !표정 으로 고른 사람만 보낸다(없으면 자동 = 레벨 표정). 그 사람 레벨보다 높은지는 사이트가 본다(높으면 레벨 표정으로 그린다).
export const EXP_MAX = 10;
export function expField(value: unknown): { exp?: number } {
  const x = isObject(value) ? value.exp : undefined;
  return Number.isSafeInteger(x) && (x as number) >= 1 && (x as number) <= EXP_MAX ? { exp: x as number } : {};
}
// 시즌 2 몬스터(v3): [{sp, stage, lv}] — 모양이 틀린 줄은 그 줄만 뺀다, 같은 종류는 처음 것만.
export type Monster = { sp: string; stage: number; lv: number };
export function monsters(value: unknown): Monster[] {
  const out: Monster[] = [], seen = new Set<string>();
  for (const m of Array.isArray(value) ? value : []) {
    if (out.length >= MONSTERS_MAX) break;
    if (!isObject(m) || typeof m.sp !== 'string' || !MONSTER_SP.test(m.sp) || seen.has(m.sp)) continue;
    const stage = m.stage, lv = m.lv;
    if (!Number.isSafeInteger(stage) || (stage as number) < 1 || (stage as number) > MONSTER_STAGE_MAX) continue;
    if (!Number.isSafeInteger(lv) || (lv as number) < 1 || (lv as number) > MONSTER_LV_MAX) continue;
    seen.add(m.sp); out.push({ sp: m.sp, stage: stage as number, lv: lv as number });
  }
  return out;
}
// 밖으로 내보낼 몬스터 칸: v3 사람이면 {lead(대표 — 가진 몬스터일 때만, 아니면 null), monsters}, 시즌 1 사람이면 칸이 없다
export function monsterField(value: unknown): { lead?: string | null; monsters?: Monster[] } {
  if (!isObject(value) || !Array.isArray(value.monsters)) return {};
  const list = monsters(value.monsters);
  const lead = typeof value.lead === 'string' && list.some((m) => m.sp === value.lead) ? value.lead : null;
  return { lead, monsters: list };
}
// ch = 이 사람이 마지막으로 새로 나타나거나 옷을 바꾼 때(서버 시각). "새로 꾸민 캐릭터" 순서에만 쓰고 밖으로 내보내지 않는다.
// 시즌 2(v3) 사람은 worn {} · love 0 · level = 가장 높은 몬스터 레벨(찾기 순서용) + lead·monsters.
export type Person = { id: string; level: number; love: number; worn: Record<string, string>; titles?: string[]; pets?: Record<string, number>; pet?: { id: string; stage: number }; motion?: string; exp?: number; lead?: string | null; monsters?: Monster[]; k: string; ch?: number };
// 청취자 한 줄 → {id, level, love, worn, titles?, k}. 이 칸만 새로 만들어 담는다(보낸 줄의 다른 칸은 버린다). 칭호가 없으면 titles 칸도 없다.
// 모양이 이상한 줄(아이디 모양이 아니거나 뒤 이름이 이 캐릭터가 아님 등)은 그 줄만 뺀다(한 사람 때문에 전체가 막히지 않게).
export function person(value: unknown, characterName: string): Person | null {
  if (!isObject(value)) return null;
  const id = listenerId(value.id, characterName);
  const level = value.level, love = value.love;
  if (!id || !Number.isSafeInteger(level) || (level as number) < 1 || (level as number) > LEVEL_MAX) return null;
  if (!Number.isSafeInteger(love) || (love as number) < 0 || (love as number) > LOVE_MAX) return null;
  const t = titles(value.titles);
  return { id, level: level as number, love: love as number, worn: worn(value.worn), ...(t.length ? { titles: t } : {}), ...petsField(value), ...motionField(value), ...expField(value), k: searchKey(id) };
}
// 시즌 2 청취자 한 줄(v3) → {id, level, love:0, worn:{}, lead, monsters, k}. 아이디·대표·몬스터만 담는다(닉네임 등 다른 칸은 버린다). 아이디 모양이 틀리면 null.
export function personV3(value: unknown, characterName: string): Person | null {
  if (!isObject(value)) return null;
  const id = listenerId(value.id, characterName);
  if (!id) return null;
  const f = monsterField({ lead: value.lead, monsters: Array.isArray(value.monsters) ? value.monsters : [] });
  const level = Math.max(1, ...(f.monsters || []).map((m) => m.lv));
  return { id, level, love: 0, worn: {}, lead: f.lead ?? null, monsters: f.monsters || [], k: searchKey(id) };
}
const titlesOf = (p: { titles?: unknown }) => { const t = titles(p.titles); return t.length ? { titles: t } : {}; };
// 밖으로 내보내는 한 사람: {rank, id, level, worn, titles?, pets?, pet?, motion?, exp?, hearts?}. 애정도 숫자는 SHOW_LOVE 가 true 일 때만(스푼 답을 기다리는 동안 숨김 — 순서는 그대로 애정도 순).
export function publicPerson(p: Pick<Person, 'id' | 'level' | 'love' | 'worn' | 'titles' | 'pets' | 'pet' | 'motion' | 'exp' | 'lead' | 'monsters'>, rank: number, hearts?: number) {
  const out: Record<string, unknown> = { rank, id: p.id, level: p.level, worn: isObject(p.worn) ? p.worn : {}, ...titlesOf(p), ...petsField(p), ...motionField(p), ...expField(p), ...monsterField(p) };
  if (SHOW_LOVE) out.love = p.love;
  if (hearts !== undefined) out.hearts = hearts;
  return out;
}
// 메인 페이지·전체 찾기의 카드 한 장: {slug, djName, id, level, worn, titles?, pet?, motion?, exp?, hearts} — 카드에는 함께하는 펫만
const petOf = (p: { pets?: unknown; pet?: unknown }) => { const f = petsField(p); return f.pet ? { pet: f.pet } : {}; };
//  시즌 2(2026-11-15): 몬스터를 가진 사람(v3)은 카드에 대표·몬스터도(lead · monsters) — 사이트 아이디 찾기가 카드만으로 몬스터를 그린다
export const card = (p: Pick<Person, 'id' | 'level' | 'worn' | 'titles' | 'pets' | 'pet' | 'motion' | 'exp' | 'lead' | 'monsters'>, slug: string, djName: string, hearts: number) =>
  ({ slug, djName, id: p.id, level: p.level, worn: isObject(p.worn) ? p.worn : {}, ...titlesOf(p), ...petOf(p), ...motionField(p), ...expField(p), ...monsterField(p), hearts });

// 캐릭터 이름 열쇠(사이트 전체에서 하나만): NFC + 영문 소문자
export const nameKeyOf = (name: string) => String(name ?? '').normalize('NFC').toLowerCase();

// 먼치킨이 보낸 내용(v2) → 저장할 모양. {enabled:false} 는 "지워 주세요".
// v2 = {enabled:true, v:2, at, paused, main?, season:{id,name,endsAt}|null, character:{name,...}, people:[{id:"밤톨#먼치", level, love, worn, titles?}]}
//  titles(0.15.63~): 지금 효과가 있는 칭호 id. 예전 판은 보내지 않는다(없으면 칭호 없음).
// main: 메인 페이지(인기·새로 꾸민·DJ 목록·전체 찾기)에 보일지. 없으면 true. false 여도 DJ 페이지·캐릭터 페이지는 그대로 열린다.
// v3(시즌 2, 2026-11-15) = {enabled:true, v:3, at?, paused?, main?, season:'s2' | {id,name,endsAt}, character:{name} | name:"먼치"(아이디 뒤 이름),
//   people:[{id:"밤톨#먼치", lead:"water_01"|null, monsters:[{sp:"water_01", stage:1~3, lv}]}]} — 청취자 닉네임·냥·경험치는 받지 않는다(줄의 다른 칸은 버린다).
//  character 는 이름만 남긴다(시즌 2 에는 DJ 캐릭터 모양이 없다). 순서는 보낸 그대로(먼치킨이 정한 순서).
// now(밀리초)를 주면 시즌 1 v2 는 2026-12-01 0시(한국)부터 받지 않는다(끄기 {enabled:false} 는 그대로 받는다).
export const V2_CLOSED = '시즌 1이 끝났어요. 먼치킨을 새 버전으로 업데이트하면 시즌 2 몬스터가 올라가요.';
function seasonV3(value: unknown) {
  if (value === 's2') return { ...S2_SEASON };
  if (typeof value === 'string') throw fail(400, '시즌 정보를 확인해 주세요.');
  return season(value);
}
export function snapshot(value: unknown, now?: number, v2Until: number = S2_START) {
  if (!isObject(value)) throw fail(400, '올릴 내용을 확인해 주세요.');
  if (value.enabled === false) return { enabled: false as const };
  // v1(0.15.49~0.15.50)은 스푼에서 받은 청취자 이름을 올렸다 → 2026-10-08 스푼 답변(Open API 정보 서버 저장 불가)으로 받지 않는다.
  if (value.enabled !== true || (value.v !== PAYLOAD_VERSION && value.v !== V2)) throw fail(400, '먼치킨을 새 버전으로 업데이트한 뒤 다시 올려 주세요.');
  const v3 = value.v === PAYLOAD_VERSION;
  if (!v3 && typeof now === 'number' && now >= v2Until) throw fail(400, V2_CLOSED);
  const ch = v3 ? { name: character(isObject(value.character) ? value.character : { name: value.name }).name } : character(value.character);
  const se = value.paused === true ? null : v3 ? seasonV3(value.season) : season(value.season);
  const list = Array.isArray(value.people) ? value.people : [];
  const people = se ? list.map((x) => (v3 ? personV3(x, ch.name) : person(x, ch.name))).filter((x): x is Person => x !== null) : [];
  // 애정도 높은 순(같으면 보낸 순서 그대로 — 먼저 모은 사람이 앞)
  people.sort((a, b) => b.love - a.love);
  // 같은 아이디가 두 번 오면 애정도 높은(먼저 온) 줄만 남긴다
  const seen = new Set<string>();
  const unique = people.filter((p) => (seen.has(p.k) ? false : (seen.add(p.k), true)));
  const kept = unique.slice(0, MAX_PEOPLE);
  // top 은 서버 안에 저장하는 모양(애정도 포함). 밖으로는 pageOut 이 SHOW_LOVE 에 맞춰 내보낸다.
  const top = kept.slice(0, TOP).map((p, i) => ({ rank: i + 1, id: p.id, level: p.level, love: p.love, worn: p.worn, ...titlesOf(p), ...petsField(p), ...motionField(p), ...expField(p), ...monsterField(p) }));
  return { enabled: true as const, name: ch.name, nameKey: nameKeyOf(ch.name), main: value.main !== false, character: ch, season: se, people: kept, top, count: kept.length };
}

// 옷 모양 비교용 글(칸 순서와 상관없이 같으면 같은 글)
const wornKey = (w: unknown) => JSON.stringify(Object.entries(isObject(w) ? w : {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
// 지난번 올린 줄과 비교해 ch(새로 꾸민 때)를 붙인다: 처음 보는 사람이나 입은 옷·고른 표정이 바뀐 사람은 now, 그대로면 지난 값.
export function withChanges(people: Person[], previous: unknown, now: number): Person[] {
  const before = new Map<string, any>();
  for (const p of Array.isArray(previous) ? previous : []) if (p && typeof p.k === 'string') before.set(p.k, p);
  return people.map((p) => {
    const old = before.get(p.k);
    // 시즌 2: 대표·몬스터(종류·단계·레벨)가 바뀌어도 새 시각
    const same = old && wornKey(old.worn) === wornKey(p.worn) && (expField(old).exp ?? 0) === (p.exp ?? 0) && JSON.stringify(monsterField(old)) === JSON.stringify(monsterField(p)) && Number.isSafeInteger(old.ch);
    return { ...p, ch: same ? old.ch : now };
  });
}
// 메인 페이지용 요약(올릴 때 한 번 만든다): 새로 꾸민 사람 8명(옷을 하나라도 입은 사람만, ch 최근 순)과 옷마다 입은 사람 수,
//  하트 받은 사람 카드 hot(2026-10-20 — 하트 많은 순 HOME_HOT 명, 이번 시즌 하트 hearts {찾기 열쇠: 수}로): 메인 "인기"를 만들 때 페이지마다 사람 목록 전체를
//  다시 받지 않게(home 이 느리던 것). 올린 뒤에 처음 하트를 받은 사람은 hot 에 없으니 메인이 그 페이지만 예전처럼 사람 목록에서 찾는다.
//  items 는 옷 id → 수(옷 id 가 'constructor' 같은 이름이어도 섞이지 않게 원형 없는 객체로 센 뒤 보통 객체로 담는다).
export const HOME_HOT = 20;
export function summarize(people: Person[], hearts: Map<string, number> = new Map()) {
  const count: Record<string, number> = Object.create(null);
  for (const p of people) for (const id of Object.values(p.worn || {})) count[id] = (count[id] || 0) + 1;
  const items: Record<string, number> = { ...count };
  const recent = people
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => Object.keys(p.worn || {}).length > 0 && Number.isSafeInteger(p.ch))
    .sort((a, b) => (b.p.ch as number) - (a.p.ch as number) || a.i - b.i)
    .slice(0, HOME_RECENT)
    .map(({ p }) => ({ k: p.k, id: p.id, level: p.level, worn: p.worn, ...titlesOf(p), ...petsField(p), ...motionField(p), ...expField(p), ch: p.ch }));
  const heartsOf = (p: Person) => hearts.get(p.k) || 0;
  const hot = people
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => heartsOf(p) > 0)
    .sort((a, b) => heartsOf(b.p) - heartsOf(a.p) || a.i - b.i)
    .slice(0, HOME_HOT)
    .map(({ p }) => ({ k: p.k, id: p.id, level: p.level, worn: p.worn, ...titlesOf(p), ...petsField(p), ...motionField(p), ...expField(p), ...monsterField(p) }));
  return { recent, items, hot };
}

// 찾기 글: 띄어쓰기를 뺀 뒤 앞 부분만(한글 1~6자, "밤톨") 또는 전체 아이디("밤톨#먼치").
export function query(value: unknown) {
  const raw = typeof value === 'string' ? value : '';
  const key = searchKey(raw);
  if ([...raw].length > QUERY_MAX || !QUERY_KEY.test(key)) throw fail(400, `아이디를 한글 1~${ID_MAX}자로 적어 주세요. 예: 밤톨 또는 밤톨#먼치`);
  return key;
}
// 한 사람의 찾기 열쇠가 찾는 글과 같은지: 전체로 찾으면 전체끼리, 앞 부분만 적으면 앞 부분끼리.
const target = (k: string, key: string) => (key.includes('#') ? k : baseOf(k));
const validPerson = (p: any): p is Person => Boolean(p) && typeof p.id === 'string' && FULL_ID.test(p.id);
const keyOf = (p: Person) => (typeof p.k === 'string' ? p.k : searchKey(p.id));
type HeartsOf = (k: string) => number;
// 찾기: 정확히 같은 아이디 먼저, 그다음 그 글이 들어 있는 아이디(둘 다 순위 순). 5명까지.
//  전체("밤톨#먼치")로 찾으면 아이디 전체와 비교하고, 앞 부분만("밤톨") 적으면 앞 부분끼리만 비교한다
//  (뒤의 캐릭터 이름은 모두 같으니 "치"를 적었다고 모두 나오지 않게).
export function findPeople(people: unknown, key: string, limit = FIND_LIMIT, heartsOf?: HeartsOf) {
  const exact: Record<string, unknown>[] = [], part: Record<string, unknown>[] = [];
  (Array.isArray(people) ? people : []).forEach((p: Person, i: number) => {
    if (!validPerson(p)) return;
    const k = keyOf(p), t = target(k, key);
    const out = () => publicPerson(p, i + 1, heartsOf ? heartsOf(k) : undefined);
    if (t === key) exact.push(out()); else if (t.includes(key)) part.push(out());
  });
  const all = [...exact, ...part];
  return { results: all.slice(0, limit), exact: exact.length, more: all.length > limit };
}
// 한 페이지에서 한 사람 찾기(캐릭터 페이지·하트): 전체 아이디는 그대로, 앞 부분만이면 앞 부분이 같은 사람(한 페이지 안에서는 한 명).
export function findOne(people: unknown, key: string): { p: Person; rank: number } | null {
  const list = Array.isArray(people) ? people : [];
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (validPerson(p) && target(keyOf(p), key) === key) return { p, rank: i + 1 };
  }
  return null;
}

// 하트 줄 → 이 페이지·이번 시즌의 {찾기 열쇠: 하트 수}. 다른 시즌·다른 페이지 줄은 빼고 센다.
export function heartMap(rows: unknown, slug: string, seasonId: string | null | undefined) {
  const out = new Map<string, number>();
  if (!seasonId) return out;
  for (const r of Array.isArray(rows) ? rows : []) {
    if (r && r.slug === slug && r.season === seasonId && typeof r.pid === 'string' && Number.isSafeInteger(r.hearts) && r.hearts > 0) out.set(r.pid, r.hearts);
  }
  return out;
}

// 공개 페이지 모양(청취자 전체 목록·찾기 열쇠·기기 번호는 넣지 않는다).
// 1~3등은 {rank, id, level, worn, hearts}(애정도는 SHOW_LOVE 일 때만) — 아이디가 없는 예전 줄은 내보내지 않는다.
export function pageOut(row: Record<string, any>, hearts: Map<string, number> = new Map()) {
  const top = (Array.isArray(row.top) ? row.top : [])
    .filter(validPerson)
    .map((p: any, i: number) => publicPerson(p, Number.isSafeInteger(p.rank) ? p.rank : i + 1, hearts.get(searchKey(p.id)) || 0));
  return { slug: row.slug, name: row.name, season: row.season ?? null, paused: !row.season, character: row.character, top, count: Number(row.count) || 0, updatedAt: new Date(Number(row.updated)).toISOString() };
}

// 메인 페이지의 "지금 시즌": 보이는 페이지들 중 가장 많이 쓰는 시즌(같으면 끝나는 날이 늦은 쪽).
export function pickSeason(pages: Record<string, any>[]) {
  const tally = new Map<string, { season: any; n: number }>();
  for (const p of pages) {
    const s = p?.season;
    if (!s || typeof s.id !== 'string') continue;
    const t = tally.get(s.id) || { season: s, n: 0 };
    t.n++; tally.set(s.id, t);
  }
  let best: { season: any; n: number } | null = null;
  for (const t of tally.values()) {
    if (!best || t.n > best.n || (t.n === best.n && Date.parse(t.season.endsAt) > Date.parse(best.season.endsAt))) best = t;
  }
  return best ? { id: best.season.id, name: best.season.name, endsAt: best.season.endsAt } : null;
}

// 하트: 브라우저가 만든 무작위 열쇠(32자) · 한국 날짜
export const HEART_TOKEN = /^[A-Za-z0-9_-]{32}$/;
// 같은 접속 주소(IP)는 한 캐릭터에 한국 날짜 하루 이만큼까지만 새 하트로 센다(2026-10-20 — 브라우저 열쇠는 누구나 새로 만들 수 있어서).
//  공유 와이파이·한 집이면 세 명까지는 되는 셈. 넘으면 수는 그대로 already:true(조용히).
export const HEART_IP_DAY = 3;
const KST = 9 * 3600000, DAY = 86400000;
export const kstDay = (t: number) => new Date(t + KST).toISOString().slice(0, 10);
// 다음 한국 자정(이 날의 투표 열쇠는 그다음 하루까지 두었다가 지운다)
export const nextKstMidnight = (t: number) => (Math.floor((t + KST) / DAY) + 1) * DAY - KST;

export function slugOf(value: unknown) {
  const s = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!SLUG.test(s)) throw fail(404, '키우기 페이지를 찾을 수 없어요. 주소를 확인해 주세요.');
  return s;
}
// 고르게 뽑는다(31 글자 → 248 이상 바이트는 버림)
export function makeSlug(random: (n: number) => Uint8Array) {
  let out = '';
  while (out.length < 8) for (const b of random(16)) { if (b < 248 && out.length < 8) out += SLUG_ALPHABET[b % 31]; }
  return out;
}

// ---- 보스전 보기(함수 v4, 2026-11-18 — 봇 저장소 docs/superpowers/specs/2026-11-18-bossview-design.md "서버") ----
// 먼치킨 본체(app/desktop/kiugi-fight.cjs)가 보스가 나올 때·참전 수가 바뀔 때·마감에 계산한 싸움 대본·땅 결과를 서명해 올리고, 사이트(키우기.com)가 생중계로 튼다.
//  한 판 = (기기, 방송 열쇠, 칸 k) 하나. 방송 열쇠 = 봇이 sha256('kg-fight:' + 방송 번호) 16진 앞 32자로 보낸 것(방송 번호 원문은 받지 않는다 — 밖으로도 내보내지 않는다).
//  대본(FightScript v1 — 봇 app/src/bot/kiugi/fight-script.mjs): 이름은 키우기 아이디("한글 1~6자#캐릭터 이름") 또는 null 만. 아는 칸만 새로 담고 다른 칸(닉네임 같은 것)은 버린다.
//   사건은 짧은 배열: h[round,i,dmg,e,before,after] · b[round,i,dmg,e,ko,oneShot,hp] · c[round,hp] · a[round,hp,[[i,dmg,e,ko],…]] — e 0·1·2, ko·oneShot 0·1.
// 크기: 대본 JSON 의 UTF-8 바이트 수(봇 FIGHT_MAX_BYTES·scriptBytes 와 같은 셈) 256KB 까지.
export const FIGHT_MAX_BYTES = 256 * 1024;
// 화면 길이 상한(시작 + 90초 = 끝) · 끝난 판은 끝 + 10분까지 대본을 읽을 수 있다(늦게 온 사람에게 결과 한 장면) · 대본이 오지 않은 모집 판은 등장 + 15분에 사라진다
export const FIGHT_VIEW_MS = 90000, FIGHT_KEEP_MS = 10 * 60000, FIGHT_JOIN_KEEP_MS = 15 * 60000;
// 모집 마감은 서버 시계로 고쳐 적는다(봇 시계 + 서명 시각과의 차이). 받은 때부터 이만큼 뒤까지만(봇은 60초 + 유예).
export const FIGHT_JOIN_MAX_MS = 5 * 60000;
// 목록(GET fights)에 모집 중 판을 두는 때: 마감(join_until) + 90초까지(봇의 2초 읽기 + 5/10/30초 다시 하기를 덮는 만큼).
//  봇이 멈춰 대본이 오지 않으면 그 뒤로 목록에서 빠진다(줄은 expires 까지 남아 늦은 대본이 오면 다시 목록에 — 보기 fights/<id> 는 expires 까지 열린다).
export const FIGHT_JOIN_GRACE_MS = 90000;
// 기기당 한 시간 쓰기 수
export const FIGHT_HOURLY = 60;
// 읽기(GET fights · fights/<id> — 2026-11-19): 같은 목록(전체·DJ 주소마다)·같은 판 답은 함수 안에서 3초 기억한다(사이트가 3초마다 묻는다 — 보는 사람이 많아도 데이터베이스는 3초에 한 번).
//  한 IP 가 1분에 목록 240번 · 한 판 240번까지(한 사람은 3초마다 = 20번 — 같은 통신사 주소를 여럿이 같이 써도 넉넉하게).
export const FIGHT_READ_MS = 3000, FIGHT_READ_PER_MIN = 240;
// 판 번호: 헷갈리는 글자를 뺀 소문자·숫자 12자(주소 slug 와 같은 글자)
export const FIGHT_ID = /^[a-hjkmnp-z2-9]{12}$/;
export const LIVE_KEY = /^[0-9a-f]{32}$/;
export const FIGHT_NAME_MAX = 20;
const INT4_MAX = 2147483647;
// 몬스터·보스 속성(봇 TYPE_IDS — water·fire·grass·earth·electric·wind): 이름표 모양만 본다(새 속성이 생겨도 서버를 고치지 않아도 되게)
const TYPE_ID = /^[a-z]{1,12}$/;
const nat = (x: unknown, max = Number.MAX_SAFE_INTEGER): x is number => Number.isSafeInteger(x) && (x as number) >= 0 && (x as number) <= max;
const BAD_FIGHT = '보스전 내용을 확인해 주세요.', BAD_BOSS = '보스 정보를 확인해 주세요.', BAD_SCRIPT = '보스전 대본을 확인해 주세요.';
export const BAD_LABEL = '보스전에 올리는 이름은 키우기 아이디(글)나 빈칸만 쓸 수 있어요.', BAD_LAND = '땅 결과를 확인해 주세요.';

// 보스전 글은 시즌 파일 이름만(2026-11-21 키우기 시즌 2 검수 S7c — 보안-보고 MEDIUM-6 · 봇 저장소 S6 검토 "컨트롤러 판단 의견 ②"):
//  먼치킨은 보스·광역기·몬스터 이름을 시즌 파일(season-s2.json)에서, 인원 버프 이름을 버프 표(봇 app/src/bot/kiugi/boss.mjs BUFF_NAMES)에서 그대로 꺼내 보낸다.
//  그래서 아래 표에 있는 이름만 그대로 두고, 없는 이름(고친 봇·직접 서명한 요청의 광고·욕 글)은 그 글만 대신 글로 바꾸고 판은 받는다
//  (먼치킨은 408·429 말고 4xx 를 받으면 그 판 올리기를 멈춘다 — 정상 DJ 를 막지 않게. 정상 봇은 늘 표 안의 이름을 보내 잘못 걸림이 없다).
//  대신 글: 보스·광역기 = 그 속성 보스의 이름·광역기(표에 없는 속성이면 "보스"·"공격") · 몬스터 = 그 종·단계 이름(표에 없는 종이면 "몬스터")
//   · 버프 = 그 인원의 버프 이름(인원 1~9 밖이면 9명 이름). "공격"·"몬스터"는 먼치킨이 이름을 모를 때 쓰는 말이라(봇 monsters.mjs loadMonsters·monsterName) 그대로 받는다.
//  이름이 어느 속성·종의 것인지까지는 보지 않는다(시즌 파일 이름이면 무해). 견주기 전에 NFC 로 맞춘다(풀어 쓴 한글도 같은 이름).
//  표는 docs/kiugi/season-s2.json(봇 app/src/bot/kiugi/season-s2.json 과 같은 파일)을 옮긴 것 — tests/kiugi-fights.test.mjs 가 같은지 견준다.
//  시즌 파일·버프 표의 이름이 바뀌거나 다음 시즌이 오면 여기도 고치고 함수 kiugi 를 다시 올린다(안 고치면 새 이름이 대신 글로 보인다).
//  Map 으로 둔다(모양만 맞으면 받는 속성 이름표 "constructor" 같은 글이 Object 의 것을 꺼내지 않게).
const bossNames = (name: string, aoe: string) => Object.freeze({ name, aoe });
export const S2_BOSS_NAMES: ReadonlyMap<string, Readonly<{ name: string; aoe: string }>> = new Map([
  ['fire', bossNames('화산 두꺼비', '화구분출')],
  ['water', bossNames('심해 크라켄', '산호해일')],
  ['grass', bossNames('그루각', '꽃뿔쇄도')],
  ['earth', bossNames('협곡 들소', '사암폭풍')],
  ['wind', bossNames('천해신 벨', '구름대진군')],
  ['electric', bossNames('뇌우라', '천둥그물')]
]);
// 몬스터 종 → 단계 1·2·3 이름(시즌 파일 stageNames)
export const S2_MONSTER_NAMES: ReadonlyMap<string, readonly string[]> = new Map([
  ['fire_01', Object.freeze(['홍룡이', '화룡이', '파라곤'])],
  ['fire_02', Object.freeze(['너굴잉', '화구리', '태구리'])],
  ['fire_03', Object.freeze(['홍깃', '화깃', '태화깃'])],
  ['water_01', Object.freeze(['물꼬달', '여울달', '해울달'])],
  ['water_02', Object.freeze(['개골', '깨골', '큰깨골'])],
  ['water_03', Object.freeze(['솟나루', '물솟나루', '큰너울'])],
  ['grass_01', Object.freeze(['새싹곰', '그루곰', '거목곰'])],
  ['grass_02', Object.freeze(['이끼잠', '덩굴잠', '녹림잠'])],
  ['grass_03', Object.freeze(['빵빵이', '다람이', '숲지람'])],
  ['earth_01', Object.freeze(['돌몽이', '황토치', '바위든'])],
  ['earth_02', Object.freeze(['층모루', '판모루', '성모루'])],
  ['earth_03', Object.freeze(['어금니', '송곳니', '뿔뿔이'])],
  ['wind_01', Object.freeze(['삐리링', '회오링', '천풍'])],
  ['wind_02', Object.freeze(['휘부이', '휘나래', '학도령'])],
  ['wind_03', Object.freeze(['몽실람', '날래람', '창공람'])],
  ['electric_01', Object.freeze(['찌릿냥', '자뢰냥', '뇌관묘'])],
  ['electric_02', Object.freeze(['자릿꼬', '자릿쏜', '자릿섬'])],
  ['electric_03', Object.freeze(['또르매', '뇌깃솔', '천뢰깃'])]
]);
// 인원 버프 이름(봇 boss.mjs BUFF_NAMES — 인원 1~9, 10명부터는 버프 없음)
export const BUFF_NAMES: ReadonlyMap<number, string> = new Map([
  [1, '영웅 출현'], [2, '삼위일체'], [3, '삼위일체'], [4, '오성진'], [5, '오성진'], [6, '북두칠성'], [7, '북두칠성'], [8, '십시일반'], [9, '십시일반']
]);
const BUFF_TOP = 9;
const BOSS_NAME_SET: ReadonlySet<string> = new Set([...S2_BOSS_NAMES.values()].map((b) => b.name));
const AOE_SET: ReadonlySet<string> = new Set([...[...S2_BOSS_NAMES.values()].map((b) => b.aoe), '공격']);
const MONSTER_NAME_SET: ReadonlySet<string> = new Set([...[...S2_MONSTER_NAMES.values()].flat(), '몬스터']);
const BUFF_NAME_SET: ReadonlySet<string> = new Set(BUFF_NAMES.values());
// 표에 있는 이름이면 그 이름(NFC), 없으면 대신 글
const knownName = (name: string, names: ReadonlySet<string>, instead: string) => { const s = name.normalize('NFC'); return names.has(s) ? s : instead; };

export function makeFightId(random: (n: number) => Uint8Array) {
  let out = '';
  while (out.length < 12) for (const b of random(16)) { if (b < 248 && out.length < 12) out += SLUG_ALPHABET[b % 31]; }
  return out;
}

// 판 열쇠 {liveKey, k}
export function fightKey(value: unknown) {
  if (!isObject(value) || typeof value.liveKey !== 'string' || !LIVE_KEY.test(value.liveKey) || !nat(value.k, INT4_MAX)) throw fail(400, BAD_FIGHT);
  return { liveKey: value.liveKey, k: value.k as number };
}
export function fightJoined(value: unknown) {
  if (!nat(value, INT4_MAX)) throw fail(400, BAD_FIGHT);
  return value as number;
}
// 보스 {type, name, aoe(광역기 이름), stage(1~)} — 이름·광역기가 시즌 파일에 없으면 그 속성 보스의 것으로(위 "보스전 글은 시즌 파일 이름만")
export function fightBoss(value: unknown) {
  if (!isObject(value)) throw fail(400, BAD_BOSS);
  const name = clean(value.name, FIGHT_NAME_MAX), aoe = clean(value.aoe, FIGHT_NAME_MAX);
  if (typeof value.type !== 'string' || !TYPE_ID.test(value.type) || !name || !aoe || !nat(value.stage) || (value.stage as number) < 1) throw fail(400, BAD_BOSS);
  const type = value.type as string, own = S2_BOSS_NAMES.get(type);
  return { type, name: knownName(name, BOSS_NAME_SET, own?.name ?? '보스'), aoe: knownName(aoe, AOE_SET, own?.aoe ?? '공격'), stage: value.stage as number };
}
// 땅 결과: {addedPct, pct} | {lostPct, pct} | {capped:true} | {} — % 는 0~100(pct 칸은 꼭 있어야 하고 null 도 된다 — 영토 서버가 내 땅을 주지 않으면 봇의 NaN 이 JSON 에서 null). 다른 칸은 버린다.
const pctOf = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 100;
export function fightLand(value: unknown): Record<string, unknown> {
  if (!isObject(value)) throw fail(400, BAD_LAND);
  const now = value.pct === null ? null : pctOf(value.pct) ? value.pct : undefined;
  if ('capped' in value) { if (value.capped === true) return { capped: true }; throw fail(400, BAD_LAND); }
  if ('addedPct' in value) { if (pctOf(value.addedPct) && now !== undefined) return { addedPct: value.addedPct, pct: now }; throw fail(400, BAD_LAND); }
  if ('lostPct' in value) { if (pctOf(value.lostPct) && now !== undefined) return { lostPct: value.lostPct, pct: now }; throw fail(400, BAD_LAND); }
  return {};
}
// 참전 한 줄 {label(키우기 아이디 | null), sp, type, name(몬스터 이름), stage 1~3, lv}
//  label 이 글이지만 사이트 아이디 규칙(FULL_ID)에 맞지 않으면 그 이름만 null 로 바꾸고 판은 받는다
//  (먼치킨은 4xx 에 그 판 올리기를 통째로 멈춘다 — 2026-11-18 컨트롤러 결정). 글이 아닌 label(숫자·객체 등)은 모양이 틀린 것 → 400.
//  몬스터 이름이 시즌 파일에 없으면 그 종·단계 이름으로(위 "보스전 글은 시즌 파일 이름만").
function fightMember(value: unknown) {
  if (!isObject(value)) throw fail(400, BAD_SCRIPT);
  let label: string | null = null;
  if (value.label !== null && value.label !== undefined) {
    if (typeof value.label !== 'string') throw fail(400, BAD_LABEL);
    const s = value.label.normalize('NFC').trim(); // 키우기 페이지 아이디(listenerId)와 같은 정리: NFC 뒤 앞뒤 공백만 뗀다
    label = FULL_ID.test(s) ? s : null;
  }
  const name = clean(value.name, FIGHT_NAME_MAX);
  if (typeof value.sp !== 'string' || !MONSTER_SP.test(value.sp) || typeof value.type !== 'string' || !TYPE_ID.test(value.type) || !name
    || !nat(value.stage, MONSTER_STAGE_MAX) || (value.stage as number) < 1 || !nat(value.lv, MONSTER_LV_MAX) || (value.lv as number) < 1) throw fail(400, BAD_SCRIPT);
  const sp = value.sp as string, stage = value.stage as number;
  return { label, sp, type: value.type, name: knownName(name, MONSTER_NAME_SET, S2_MONSTER_NAMES.get(sp)?.[stage - 1] ?? '몬스터'), stage, lv: value.lv as number };
}
const eff = (x: unknown) => x === 0 || x === 1 || x === 2;
const bit = (x: unknown) => x === 0 || x === 1;
function fightEvent(r: unknown, n: number, maxRounds: number): unknown[] {
  const who = (i: unknown) => nat(i, n - 1);
  if (Array.isArray(r) && nat(r[1], maxRounds) && (r[1] as number) >= 1) {
    if (r[0] === 'h' && r.length === 7 && who(r[2]) && nat(r[3]) && eff(r[4]) && nat(r[5]) && nat(r[6])) return r.slice();
    if (r[0] === 'b' && r.length === 8 && who(r[2]) && nat(r[3]) && eff(r[4]) && bit(r[5]) && bit(r[6]) && nat(r[7])) return r.slice();
    if (r[0] === 'c' && r.length === 3 && nat(r[2])) return r.slice();
    if (r[0] === 'a' && r.length === 4 && nat(r[2]) && Array.isArray(r[3]) && r[3].every((h) => Array.isArray(h) && h.length === 4 && who(h[0]) && nat(h[1]) && eff(h[2]) && bit(h[3]))) {
      return ['a', r[1], r[2], r[3].map((h: unknown[]) => h.slice())];
    }
  }
  throw fail(400, BAD_SCRIPT);
}
const posNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0 && x <= 100;
// 대본 → 저장할 모양 {v:1, boss, team, buff, hp, left, win, rounds, maxRounds, mvp, events, land}.
//  판 번호·DJ(dj)·칸·시각(appearAt·joinUntil·startAt)은 받지 않는다 — 서버가 채운다(봇이 보낸 DJ 이름을 믿지 않음 · 시각은 서버 시계).
export function fightScript(value: unknown) {
  if (!isObject(value) || value.v !== 1 || !Array.isArray(value.team) || !Array.isArray(value.events)) throw fail(400, BAD_SCRIPT);
  const boss = fightBoss(value.boss);
  const team = value.team.map(fightMember), n = team.length;
  const maxRounds = value.maxRounds, rounds = value.rounds;
  if (!nat(maxRounds, 100) || (maxRounds as number) < 1 || !nat(rounds, maxRounds as number) || !nat(value.hp) || !nat(value.left) || typeof value.win !== 'boolean') throw fail(400, BAD_SCRIPT);
  let buff = null;
  if (value.buff !== null && value.buff !== undefined) {
    const b = value.buff, name = isObject(b) ? clean(b.name, FIGHT_NAME_MAX) : null;
    if (!isObject(b) || !nat(b.b, 99) || (b.b as number) < 1 || !name || !posNum(b.a) || !posNum(b.h)) throw fail(400, BAD_SCRIPT);
    // 버프 이름이 봇 버프 표에 없으면 그 인원의 이름으로(위 "보스전 글은 시즌 파일 이름만")
    const people = b.b as number;
    buff = { b: people, name: knownName(name, BUFF_NAME_SET, BUFF_NAMES.get(Math.min(people, BUFF_TOP)) as string), a: b.a, h: b.h, hero: b.hero === true };
  }
  let mvp = null;
  if (value.mvp !== null && value.mvp !== undefined) {
    const m = value.mvp;
    if (!isObject(m) || !nat(m.i, n - 1) || !nat(m.dealt)) throw fail(400, BAD_SCRIPT);
    mvp = { i: m.i as number, dealt: m.dealt as number };
  }
  const events = value.events.map((r) => fightEvent(r, n, maxRounds as number));
  const land = value.land === null || value.land === undefined ? null : fightLand(value.land);
  return { v: 1, boss, team, buff, hp: value.hp as number, left: value.left as number, win: value.win, rounds: rounds as number, maxRounds: maxRounds as number, mvp, events, land };
}

// ---- 서명 ----
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
export const sha256hex = async (s: string | Uint8Array) => hex(await crypto.subtle.digest('SHA-256', typeof s === 'string' ? enc.encode(s) : s));
export const decode64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
export const bytes = (s: string) => enc.encode(s).length;
export async function signedMessage(b: Record<string, any>) {
  return `${PREFIX}\n${b.action}\n${b.timestamp}\n${b.nonce}\n${b.publicKey}\n${await sha256hex(JSON.stringify(b.payload ?? null))}`;
}
// 요청 모양·시간·서명을 확인하고 기기 번호(공개키 DER 의 SHA-256, 승인 서버와 같은 번호)를 돌려준다.
export async function verify(b: unknown, now: number) {
  if (!isObject(b) || typeof b.action !== 'string' || !ACTIONS.includes(b.action) || !Number.isSafeInteger(b.timestamp) || Math.abs(now - (b.timestamp as number)) > CLOCK_SKEW_MS
    || typeof b.nonce !== 'string' || !/^[-_A-Za-z0-9]{32}$/.test(b.nonce) || typeof b.publicKey !== 'string' || !/^[-_A-Za-z0-9]{122}$/.test(b.publicKey)
    || typeof b.signature !== 'string' || !/^[-_A-Za-z0-9]{86}$/.test(b.signature)) throw fail(400, '요청이 만료되었거나 올바르지 않아요. PC 시간을 확인해 주세요.');
  let valid = false;
  try {
    const key = await crypto.subtle.importKey('spki', decode64url(b.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, decode64url(b.signature), enc.encode(await signedMessage(b)));
  } catch { /* 이상한 키 */ }
  if (!valid) throw fail(403, '기기 확인에 실패했어요.');
  return await sha256hex(decode64url(b.publicKey));
}
