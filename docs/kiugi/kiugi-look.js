// DJ 키우기 캐릭터 모양 규칙(그림 V3, 2026-10-09). 화면(kiugi-art.js·kiugi-ui.js)·엔진(src/bot/kiugi/rules.mjs)·키우기 사이트가 함께 쓴다(문서·DOM 없이).
// V3 캐릭터 = 성별(몸) + 머리 모양 1~10 + 눈·코·입 1~10 + 머리색. 머리·눈·코·입은 그 성별 전용 그림을 번호로 고른다(반대 성별 그림은 쓰지 않는다).
// 피부색은 고르지 않는다: V3 의상 그림에 드러난 맨살이 함께 그려져 있어 피부를 바꾸면 옷의 맨살과 어긋난다(패키지 기술연결가이드).
// 값은 모두 글자('1'~'10')로 둔다(키우기 사이트 서버가 모양 열쇠를 글자로만 받는다).
// 예전(V2) 값(hair:'bob', eyes:'round' 처럼 저장된 DJ 캐릭터·예전 앱이 올린 사이트 자료)은 가장 가까운 V3 번호로 읽는다(LEGACY). 저장된 값은 DJ 가 다시 저장할 때 바뀐다.
import {V3} from './kiugi-v3-data.js';

export const NUMBERS = Object.freeze(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
export const GENDERS = Object.freeze({f: '여자', m: '남자'});
// 머리색: 회색 머리 그림에 이 색을 곱한다(결과 = 원본 × 색 ÷ 255, 알파는 그대로 — 패키지 renderer.js 와 같은 셈). 2026-10-08 부터 같은 표.
export const HAIR_COLORS = Object.freeze({black: '#55434C', brown: '#A07052', light: '#C2A476', blond: '#F2D58E', pink: '#F5A6C0', purple: '#9B87AE', sky: '#92CCF0', silver: '#F0F2F6'});
export const HAIR_COLOR_NAMES = Object.freeze({black: '검정', brown: '갈색', light: '밝은 갈색', blond: '금발', pink: '분홍', purple: '보라', sky: '하늘', silver: '은발'});
// 머리색 고르기 칸의 동그라미 색(화면 전용): 곱하기 색 그대로 칠하면 실제 머리보다 너무 밝아 회색 머리 그림의 보통 밝기(약 0.8)를 곱한다.
export const HAIR_SWATCH_GRAY = 0.8;
export const hairSwatch = (hex) => { const m = /^#([0-9a-f]{6})$/i.exec(String(hex || '')); if (!m) return '#808080'; return '#' + [0, 2, 4].map((i) => Math.round(parseInt(m[1].slice(i, i + 2), 16) * HAIR_SWATCH_GRAY).toString(16).padStart(2, '0').toUpperCase()).join(''); };
export const HAIR_SWATCHES = Object.freeze(Object.fromEntries(Object.entries(HAIR_COLORS).map(([k, v]) => [k, hairSwatch(v)])));

const frozen = (o) => Object.freeze(Object.fromEntries(NUMBERS.map((n) => [n, o?.[n] || n + '번'])));
// 이름표(패키지 assets.json 의 name): 머리는 성별마다 다르고, 눈·코·입은 남녀가 같은 이름이다(그림은 성별마다 따로).
export const HAIR_NAMES = Object.freeze({f: frozen(V3.names.hair?.f), m: frozen(V3.names.hair?.m)});
export const FACE_NAMES = Object.freeze({eyes: frozen(V3.names.eyes?.f), nose: frozen(V3.names.nose?.f), mouth: frozen(V3.names.mouth?.f)});

// 예전 V2 열쇠 → V3 번호(사용자 확인 필요: 가장 가까운 것으로 골랐다).
//  머리: V2 웹툰풍 20종과 V3 머리 20종은 이름·차례가 같다(여자 10번 '시크 픽시'는 V3 에서 '페이스라인 레이어드 보브'로 바뀌었다 — 픽시를 되살리지 않는다).
//   예전에는 다른 성별 머리도 고를 수 있었다 → 그 머리의 번호를 지금 성별 그림으로 쓴다.
//  눈·코·입: 이름이 비슷한 것(동그란 눈 → 동그란 브라운 등). 표정용 열쇠(happy·wink·heart)도 받는다(예전 사이트 예시 자료).
export const LEGACY = Object.freeze({
  hair: Object.freeze({bob: '1', long: '2', pony: '3', 'f_half-up': '4', f_twin: '5', f_braid: '6', f_bun: '7', f_hush: '8', f_wave: '9', f_pixie: '10',
    short: '1', part: '2', curly: '3', m_comma: '4', 'm_two-block': '5', m_curtain: '6', m_wolf: '7', m_messy: '8', m_slick: '9', m_wave: '10'}),
  eyes: Object.freeze({round: '5', smile: '7', sparkle: '1', sleepy: '4', cat: '6', happy: '7', wink: '7', heart: '1'}),
  nose: Object.freeze({dot: '1', tri: '4', round: '5'}),
  mouth: Object.freeze({smile: '1', grin: '8', cat: '5', o: '6', tongue: '5'}),
});
export const LOOK_KEYS = Object.freeze(['gender', 'hair', 'hairColor', 'eyes', 'nose', 'mouth']);
export const LOOK_DEFAULT = Object.freeze({gender: 'f', hair: '1', hairColor: 'brown', eyes: '1', nose: '1', mouth: '1'});

// 한 칸의 값 → V3 값(글자). 모르는 값이면 null. 번호는 1~10(글자·숫자 모두), 예전 열쇠는 LEGACY 로.
export function lookValue(key, value) {
  if (key === 'gender') return value === 'f' || value === 'm' ? value : null;
  if (key === 'hairColor') return typeof value === 'string' && Object.hasOwn(HAIR_COLORS, value) ? value : null;
  if (!['hair', 'eyes', 'nose', 'mouth'].includes(key)) return null;
  const v = typeof value === 'number' && Number.isInteger(value) ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (NUMBERS.includes(v)) return v;
  return Object.hasOwn(LEGACY[key], v) ? LEGACY[key][v] : null;
}
// DJ 캐릭터(저장된 값·사이트 자료 무엇이든) → {gender, hair, hairColor, eyes, nose, mouth}. 빈 칸·모르는 값은 기본값(1번·갈색·여자).
export function normalizeLook(dj = {}) {
  const out = {...LOOK_DEFAULT};
  for (const key of LOOK_KEYS) { const v = lookValue(key, dj?.[key]); if (v !== null) out[key] = v; }
  return out;
}
// 예전 값이 들어 있는지(화면 안내용 — "예전 캐릭터를 새 그림으로 바꿔 읽었어요")
export const isLegacyLook = (dj = {}) => ['hair', 'eyes', 'nose', 'mouth'].some((k) => typeof dj?.[k] === 'string' && Object.hasOwn(LEGACY[k], dj[k])) || Object.hasOwn(dj || {}, 'skin');
