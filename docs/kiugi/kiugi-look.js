// DJ 키우기 캐릭터 모양 규칙(새 그림체 R7 → R9, 2026-10-18 — 그림 목록 kiugi-r9-data.js). 화면(kiugi-art.js·kiugi-ui.js·kiugi-creator.js)·엔진(src/bot/kiugi/rules.mjs)·키우기 사이트가 함께 쓴다(문서·DOM 없이).
// R9 캐릭터 = 성별(몸) + 머리 모양 1~10 + 눈 1~2 · 코 1~7 · 입 1~7 + 머리색. 머리·눈·코·입은 그 성별 전용 그림을 번호로 고른다(반대 성별 그림은 쓰지 않는다).
// 피부색은 고르지 않는다: 옷 그림에 드러난 맨살이 함께 그려져 있어 피부를 바꾸면 옷의 맨살과 어긋난다(패키지 기술연결가이드).
// 값은 모두 글자('1'~'10')로 둔다(키우기 사이트 서버가 모양 열쇠를 글자로만 받는다).
// 예전 그림(V3~V5)의 눈·코·입 3~10, 예전(V2) 열쇠(eyes:'round' 처럼)는 1번으로 읽는다 — 새 그림은 눈·코·입이 2가지씩이라(DJ 화면이 한 번 알리고 다시 고르게 한다 — faceReset).
//  머리는 예전처럼 1~10 그대로, V2 머리 열쇠(hair:'bob')는 가장 가까운 번호로(LEGACY). 저장된 값은 DJ 가 다시 저장할 때 바뀐다.
import {ART} from './kiugi-r9-data.js';
import {PALETTE, resolve as resolveHairColor} from './kiugi-hair-color.js';

// 머리 모양 번호(1~10) · 눈 번호(1~2) · 코·입 번호(1~7 — 새 그림체 R9, 2026-10-18)
export const NUMBERS = Object.freeze(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
export const HAIR_NUMBERS = NUMBERS;
export const FACE_NUMBERS = Object.freeze(['1', '2']);
export const FACE_KEYS = Object.freeze(['eyes', 'nose', 'mouth']);
// 칸마다 고를 수 있는 번호(눈 1~2 · 코 1~7 · 입 1~7)
export const FACE_NUMBERS_OF = Object.freeze({eyes: FACE_NUMBERS, nose: Object.freeze(NUMBERS.slice(0, 7)), mouth: Object.freeze(NUMBERS.slice(0, 7))});
export const GENDERS = Object.freeze({f: '여자', m: '남자'});
// 머리색(tone-map-v1 — 패키지 hair-color.js 그대로): 머리 그림의 밝기(0~255)를 색마다 정한 256단계 표로 바꾼다(RGB 만 · 알파 그대로).
//  저장 값은 열쇠 8개(black·brown·light·blond·pink·purple·sky·silver). HAIR_COLORS 는 그 색의 대표색, 이름은 팔레트 이름.
export const HAIR_COLORS = Object.freeze(Object.fromEntries(Object.entries(PALETTE).map(([key, p]) => [key, p.base])));
export const HAIR_COLOR_NAMES = Object.freeze(Object.fromEntries(Object.entries(PALETTE).map(([key, p]) => [key, p.name])));
// 머리색 고르기 칸의 동그라미 색(화면 전용) = 그 색의 대표색. 열쇠(blond)·대표색(#E8C87A)·예전 곱하기 색(#F2D58E → 금발) 모두 받는다. 모르는 값은 회색.
export const hairSwatch = (color) => { try { return resolveHairColor(color).base; } catch { return '#808080'; } };
export const HAIR_SWATCHES = Object.freeze(Object.fromEntries(Object.keys(PALETTE).map((k) => [k, hairSwatch(k)])));
// 저장·사이트 자료의 머리색 값 → 팔레트 열쇠(예전 곱하기 색·대표색 #RRGGBB 도 열쇠로). 모르는 값이면 null.
export function hairColorKey(value) {
  if (typeof value !== 'string') return null;
  if (Object.hasOwn(PALETTE, value)) return value;
  if (!/^#[0-9a-f]{6}$/i.test(value)) return null;
  const p = resolveHairColor(value);
  return Object.keys(PALETTE).find((k) => PALETTE[k] === p) || null;
}

const named = (list, o) => Object.freeze(Object.fromEntries(list.map((n) => [n, o?.[n] || n + '번'])));
// 이름표(패키지 assets.json 의 name): 머리는 성별마다 다르고, 눈·코·입은 남녀가 같은 이름이다(그림은 성별마다 따로).
export const HAIR_NAMES = Object.freeze({f: named(NUMBERS, ART.names.hair?.f), m: named(NUMBERS, ART.names.hair?.m)});
export const FACE_NAMES = Object.freeze({eyes: named(FACE_NUMBERS_OF.eyes, ART.names.eyes?.f), nose: named(FACE_NUMBERS_OF.nose, ART.names.nose?.f), mouth: named(FACE_NUMBERS_OF.mouth, ART.names.mouth?.f)});

// 예전 V2 열쇠 → 번호. 머리: V2 웹툰풍 20종의 차례(그 번호의 지금 성별 그림). 눈·코·입: 새 그림은 2가지라 모두 1번(표정용 열쇠 happy·wink·heart 도).
const ONE = (keys) => Object.freeze(Object.fromEntries(keys.map((k) => [k, '1'])));
export const LEGACY = Object.freeze({
  hair: Object.freeze({bob: '1', long: '2', pony: '3', 'f_half-up': '4', f_twin: '5', f_braid: '6', f_bun: '7', f_hush: '8', f_wave: '9', f_pixie: '10',
    short: '1', part: '2', curly: '3', m_comma: '4', 'm_two-block': '5', m_curtain: '6', m_wolf: '7', m_messy: '8', m_slick: '9', m_wave: '10'}),
  eyes: ONE(['round', 'smile', 'sparkle', 'sleepy', 'cat', 'happy', 'wink', 'heart']),
  nose: ONE(['dot', 'tri', 'round']),
  mouth: ONE(['smile', 'grin', 'cat', 'o', 'tongue']),
});
export const LOOK_KEYS = Object.freeze(['gender', 'hair', 'hairColor', 'eyes', 'nose', 'mouth']);
export const LOOK_DEFAULT = Object.freeze({gender: 'f', hair: '1', hairColor: 'brown', eyes: '1', nose: '1', mouth: '1'});

// 한 칸의 값 → 지금 그림의 값(글자). 모르는 값이면 null.
//  머리 1~10(글자·숫자) · 예전 머리 열쇠는 LEGACY. 눈·코·입 1~2 · 예전 그림 번호 3~10 과 예전 열쇠는 1번.
export function lookValue(key, value) {
  if (key === 'gender') return value === 'f' || value === 'm' ? value : null;
  if (key === 'hairColor') return hairColorKey(value);
  if (key !== 'hair' && !FACE_KEYS.includes(key)) return null;
  const v = typeof value === 'number' && Number.isInteger(value) ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (key === 'hair') return NUMBERS.includes(v) ? v : Object.hasOwn(LEGACY.hair, v) ? LEGACY.hair[v] : null;
  if (FACE_NUMBERS_OF[key].includes(v)) return v;
  return NUMBERS.includes(v) || Object.hasOwn(LEGACY[key], v) ? '1' : null;
}
// DJ 캐릭터(저장된 값·사이트 자료 무엇이든) → {gender, hair, hairColor, eyes, nose, mouth}. 빈 칸·모르는 값은 기본값(1번·갈색·여자).
export function normalizeLook(dj = {}) {
  const out = {...LOOK_DEFAULT};
  for (const key of LOOK_KEYS) { const v = lookValue(key, dj?.[key]); if (v !== null) out[key] = v; }
  return out;
}
// 예전(V2) 값이 들어 있는지(화면 안내용 — "예전 캐릭터를 새 그림으로 바꿔 읽었어요")
export const isLegacyLook = (dj = {}) => ['hair', ...FACE_KEYS].some((k) => typeof dj?.[k] === 'string' && Object.hasOwn(LEGACY[k], dj[k])) || Object.hasOwn(dj || {}, 'skin');
// 저장된 눈·코·입 가운데 새 그림(1~2)에 없는 값이 있는지(예전 그림의 3~10 · 예전 열쇠) — DJ 화면이 "눈·코·입을 다시 골라 주세요"를 알린다(저장하면 사라진다)
export const faceReset = (dj = {}) => Boolean(dj) && FACE_KEYS.some((k) => dj[k] !== undefined && dj[k] !== null && dj[k] !== '' && !FACE_NUMBERS_OF[k].includes(typeof dj[k] === 'number' ? String(dj[k]) : String(dj[k]).trim()));
