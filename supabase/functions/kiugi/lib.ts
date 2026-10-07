// DJ 키우기 팬페이지 — Supabase Edge Function "kiugi"의 순수 검사·모양 만들기(지울 수 있는 TypeScript 만).
// Edge Function(Deno)과 노드 시험(tests/kiugi-server.test.mjs)이 같이 쓴다. 암호는 WebCrypto(crypto.subtle)만 쓴다(Deno·Node 24 모두 있음).
// 올리는 쪽: 먼치킨(봇 프로그램)이 승인받은 기기 키로 서명해 한 페이지 분량(DJ 캐릭터 + 청취자 닉네임·레벨·애정도·입은 옷)을 통째로 바꾼다.
// 고유닉·jl-번호·스푼 번호·냥·출석은 받지도 저장하지도 않는다.
export class Fail extends Error {
  status: number;
  extra: Record<string, unknown> | undefined;
  constructor(status: number, message: string, extra?: Record<string, unknown>) { super(message); this.status = status; this.extra = extra; }
}
export const fail = (status: number, message: string, extra?: Record<string, unknown>) => new Fail(status, message, extra);

export const PREFIX = 'JUN-LIVE-KIUGI/1';
export const ACTIONS = ['upload'];
// 주소(slug): 헷갈리는 글자(i·l·o·0·1)를 뺀 소문자·숫자 8자. 서버가 처음 올릴 때 만들어 그 기기에 묶는다.
export const SLUG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export const SLUG = /^[a-hjkmnp-z2-9]{8}$/;
export const MAX_PEOPLE = 3000, MAX_PAYLOAD_BYTES = 1_500_000, MAX_BODY_CHARS = 1_600_000;
export const NICK_MAX = 100, NAME_MAX = 20, QUERY_MAX = 40, FIND_LIMIT = 5, TOP = 3, LEVEL_MAX = 100, LOVE_MAX = 1_000_000_000;
export const KEEP_MS = 60 * 86400000, CLOCK_SKEW_MS = 60000, NONCE_MS = 120000;

const enc = new TextEncoder();
// 화면에 보이지 않는 글자·줄바꿈·글 방향 바꾸기 글자는 뺀다(닉네임으로 남을 흉내 내지 못하게).
// 글자 번호로 만든다(올리기 도구가 소스의 유니코드 표기를 글자로 풀어 정규식이 깨진 적이 있음).
const HIDDEN_RANGES = [[0x00, 0x1f], [0x7f, 0x9f], [0xad, 0xad], [0x200b, 0x200f], [0x2028, 0x202e], [0x2060, 0x206f], [0xfeff, 0xfeff]];
const HIDDEN = new RegExp('[' + HIDDEN_RANGES.map(([a, b]) => String.fromCharCode(a) + '-' + String.fromCharCode(b)).join('') + ']', 'g');
export function clean(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const s = value.replace(HIDDEN, '').replace(/\s+/g, ' ').trim();
  if (!s || [...s].length > max) return null;
  return s;
}
// 찾기 열쇠: 한글 모양을 맞추고(NFC) 영문은 소문자, 띄어쓰기는 모두 뺀다("밤 톨이" = "밤톨이").
export const searchKey = (s: string) => String(s ?? '').normalize('NFC').replace(HIDDEN, '').toLowerCase().replace(/\s+/g, '');

// 모양 열쇠·옷 id: 영문 소문자·숫자·-·_ (예: 머리 'm_two-block', 'f_half-up')
const TOKEN = /^[a-z0-9][a-z0-9_-]{0,23}$/;
const SLOT = /^[a-z]{2,12}$/, ITEM = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const CHARACTER_FIELDS = ['gender', 'hair', 'hairColor', 'skin', 'eyes', 'nose', 'mouth'];
const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

// DJ 캐릭터: 이름(20자) + 모양 열쇠(영문 소문자·숫자·-)만. 모르는 칸은 버린다(새 모양이 생겨도 서버를 고치지 않아도 되게 이름표만 본다).
export function character(value: unknown) {
  if (!isObject(value)) throw fail(400, 'DJ 캐릭터를 확인해 주세요.');
  const name = clean(value.name, NAME_MAX);
  if (!name) throw fail(400, 'DJ 캐릭터 이름을 확인해 주세요.');
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

export type Person = { nickname: string; level: number; love: number; worn: Record<string, string>; k: string };
// 청취자 한 줄. 모양이 이상한 줄은 그 줄만 뺀다(한 사람 때문에 전체가 막히지 않게).
export function person(value: unknown): Person | null {
  if (!isObject(value)) return null;
  const nickname = clean(value.nickname, NICK_MAX);
  const level = value.level, love = value.love;
  if (!nickname || !Number.isSafeInteger(level) || (level as number) < 1 || (level as number) > LEVEL_MAX) return null;
  if (!Number.isSafeInteger(love) || (love as number) < 0 || (love as number) > LOVE_MAX) return null;
  return { nickname, level: level as number, love: love as number, worn: worn(value.worn), k: searchKey(nickname) };
}
export const publicPerson = (p: Person, index: number) => ({ rank: index + 1, nickname: p.nickname, level: p.level, love: p.love, worn: p.worn });

// 먼치킨이 보낸 내용(GET /api/bot/f/kiugi/fanpage 의 답) → 저장할 모양. {enabled:false} 는 "지워 주세요".
export function snapshot(value: unknown) {
  if (!isObject(value)) throw fail(400, '올릴 내용을 확인해 주세요.');
  if (value.enabled === false) return { enabled: false as const };
  if (value.enabled !== true || value.v !== 1) throw fail(400, '먼치킨을 새 버전으로 업데이트한 뒤 다시 올려 주세요.');
  const ch = character(value.character);
  const se = value.paused === true ? null : season(value.season);
  const list = Array.isArray(value.people) ? value.people : [];
  const people = se ? list.map((x) => person(x)).filter((x): x is Person => x !== null) : [];
  // 애정도 높은 순(같으면 보낸 순서 그대로 — 먼저 모은 사람이 앞)
  people.sort((a, b) => b.love - a.love);
  const kept = people.slice(0, MAX_PEOPLE);
  return { enabled: true as const, name: ch.name, character: ch, season: se, people: kept, top: kept.slice(0, TOP).map(publicPerson), count: kept.length };
}

// 찾기: 정확히 같은 닉네임 먼저(순위 순), 그다음 닉네임에 들어 있는 사람(순위 순). 5명까지.
export function query(value: unknown) {
  const raw = typeof value === 'string' ? value.replace(HIDDEN, '').trim() : '';
  const key = searchKey(raw);
  if (!raw || !key || [...raw].length > QUERY_MAX) throw fail(400, `닉네임을 1~${QUERY_MAX}자로 적어 주세요.`);
  return key;
}
export function findPeople(people: unknown, key: string, limit = FIND_LIMIT) {
  const exact: ReturnType<typeof publicPerson>[] = [], part: ReturnType<typeof publicPerson>[] = [];
  (Array.isArray(people) ? people : []).forEach((p: Person, i: number) => {
    if (!p || typeof p.nickname !== 'string') return;
    const k = typeof p.k === 'string' ? p.k : searchKey(p.nickname);
    if (k === key) exact.push(publicPerson(p, i)); else if (k.includes(key)) part.push(publicPerson(p, i));
  });
  const all = [...exact, ...part];
  return { results: all.slice(0, limit), exact: exact.length, more: all.length > limit };
}

// 공개 페이지 모양(청취자 전체 목록·찾기 열쇠·기기 번호는 넣지 않는다)
export function pageOut(row: Record<string, any>) {
  return { slug: row.slug, name: row.name, season: row.season ?? null, paused: !row.season, character: row.character, top: Array.isArray(row.top) ? row.top : [], count: Number(row.count) || 0, updatedAt: new Date(Number(row.updated)).toISOString() };
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
