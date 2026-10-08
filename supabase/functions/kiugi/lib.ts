// DJ 키우기 페이지 — Supabase Edge Function "kiugi"의 순수 검사·모양 만들기(지울 수 있는 TypeScript 만).
// Edge Function(Deno)과 노드 시험(tests/kiugi-server.test.mjs)이 같이 쓴다. 암호는 WebCrypto(crypto.subtle)만 쓴다(Deno·Node 24 모두 있음).
// 올리는 쪽: 먼치킨(봇 프로그램)이 승인받은 기기 키로 서명해 한 페이지 분량(DJ 캐릭터 + 청취자 시즌 아이디·레벨·애정도·입은 옷)을 통째로 바꾼다.
// 시즌 아이디 = 청취자가 DJ 방송 채팅에서 "!아이디 <한글 1~6자>"로 직접 만든 이름 + "#" + DJ 캐릭터 이름(예: 밤톨#먼치).
// 스푼에서 받은 정보(이름·고유닉·번호)는 받지도 저장하지도 않는다. jl-번호·냥·출석도 받지 않는다.
export class Fail extends Error {
  status: number;
  extra: Record<string, unknown> | undefined;
  constructor(status: number, message: string, extra?: Record<string, unknown>) { super(message); this.status = status; this.extra = extra; }
}
export const fail = (status: number, message: string, extra?: Record<string, unknown>) => new Fail(status, message, extra);

export const PREFIX = 'JUN-LIVE-KIUGI/1';
export const ACTIONS = ['upload'];
export const PAYLOAD_VERSION = 2;
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

export type Person = { id: string; level: number; love: number; worn: Record<string, string>; k: string };
// 청취자 한 줄 → {id, level, love, worn, k}. 이 다섯 칸만 새로 만들어 담는다(보낸 줄의 다른 칸은 버린다).
// 모양이 이상한 줄(아이디 모양이 아니거나 뒤 이름이 이 캐릭터가 아님 등)은 그 줄만 뺀다(한 사람 때문에 전체가 막히지 않게).
export function person(value: unknown, characterName: string): Person | null {
  if (!isObject(value)) return null;
  const id = listenerId(value.id, characterName);
  const level = value.level, love = value.love;
  if (!id || !Number.isSafeInteger(level) || (level as number) < 1 || (level as number) > LEVEL_MAX) return null;
  if (!Number.isSafeInteger(love) || (love as number) < 0 || (love as number) > LOVE_MAX) return null;
  return { id, level: level as number, love: love as number, worn: worn(value.worn), k: searchKey(id) };
}
export const publicPerson = (p: Person, index: number) => ({ rank: index + 1, id: p.id, level: p.level, love: p.love, worn: p.worn });

// 먼치킨이 보낸 내용(v2) → 저장할 모양. {enabled:false} 는 "지워 주세요".
// v2 = {enabled:true, v:2, at, paused, season:{id,name,endsAt}|null, character:{name,...}, people:[{id:"밤톨#먼치", level, love, worn}]}
export function snapshot(value: unknown) {
  if (!isObject(value)) throw fail(400, '올릴 내용을 확인해 주세요.');
  if (value.enabled === false) return { enabled: false as const };
  // v1(0.15.49~0.15.50)은 스푼에서 받은 청취자 이름을 올렸다 → 2026-10-08 스푼 답변(Open API 정보 서버 저장 불가)으로 받지 않는다.
  if (value.enabled !== true || value.v !== PAYLOAD_VERSION) throw fail(400, '먼치킨을 새 버전으로 업데이트한 뒤 다시 올려 주세요.');
  const ch = character(value.character);
  const se = value.paused === true ? null : season(value.season);
  const list = Array.isArray(value.people) ? value.people : [];
  const people = se ? list.map((x) => person(x, ch.name)).filter((x): x is Person => x !== null) : [];
  // 애정도 높은 순(같으면 보낸 순서 그대로 — 먼저 모은 사람이 앞)
  people.sort((a, b) => b.love - a.love);
  // 같은 아이디가 두 번 오면 애정도 높은(먼저 온) 줄만 남긴다
  const seen = new Set<string>();
  const unique = people.filter((p) => (seen.has(p.k) ? false : (seen.add(p.k), true)));
  const kept = unique.slice(0, MAX_PEOPLE);
  return { enabled: true as const, name: ch.name, character: ch, season: se, people: kept, top: kept.slice(0, TOP).map(publicPerson), count: kept.length };
}

// 찾기 글: 띄어쓰기를 뺀 뒤 앞 부분만(한글 1~6자, "밤톨") 또는 전체 아이디("밤톨#먼치").
export function query(value: unknown) {
  const raw = typeof value === 'string' ? value : '';
  const key = searchKey(raw);
  if ([...raw].length > QUERY_MAX || !QUERY_KEY.test(key)) throw fail(400, `아이디를 한글 1~${ID_MAX}자로 적어 주세요. 예: 밤톨 또는 밤톨#먼치`);
  return key;
}
// 찾기: 정확히 같은 아이디 먼저, 그다음 그 글이 들어 있는 아이디(둘 다 순위 순). 5명까지.
//  전체("밤톨#먼치")로 찾으면 아이디 전체와 비교하고, 앞 부분만("밤톨") 적으면 앞 부분끼리만 비교한다
//  (뒤의 캐릭터 이름은 모두 같으니 "치"를 적었다고 모두 나오지 않게).
export function findPeople(people: unknown, key: string, limit = FIND_LIMIT) {
  const exact: ReturnType<typeof publicPerson>[] = [], part: ReturnType<typeof publicPerson>[] = [];
  const whole = key.includes('#');
  (Array.isArray(people) ? people : []).forEach((p: Person, i: number) => {
    if (!p || typeof p.id !== 'string' || !FULL_ID.test(p.id)) return;
    const k = typeof p.k === 'string' ? p.k : searchKey(p.id);
    const target = whole ? k : baseOf(k);
    if (target === key) exact.push(publicPerson(p, i)); else if (target.includes(key)) part.push(publicPerson(p, i));
  });
  const all = [...exact, ...part];
  return { results: all.slice(0, limit), exact: exact.length, more: all.length > limit };
}

// 공개 페이지 모양(청취자 전체 목록·찾기 열쇠·기기 번호는 넣지 않는다).
// 1~3등은 {rank, id, level, love, worn} 만 — 아이디가 없는 예전 줄은 내보내지 않는다.
export function pageOut(row: Record<string, any>) {
  const top = (Array.isArray(row.top) ? row.top : [])
    .filter((p: any) => p && typeof p.id === 'string' && FULL_ID.test(p.id))
    .map((p: any, i: number) => ({ rank: Number.isSafeInteger(p.rank) ? p.rank : i + 1, id: p.id, level: p.level, love: p.love, worn: isObject(p.worn) ? p.worn : {} }));
  return { slug: row.slug, name: row.name, season: row.season ?? null, paused: !row.season, character: row.character, top, count: Number(row.count) || 0, updatedAt: new Date(Number(row.updated)).toISOString() };
}

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
