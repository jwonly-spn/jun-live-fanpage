// 보스전 보기 — 화면 없이 도는 도우미(시험이 DOM 없이 읽는다). 화면은 views/boss.js · 첫 화면 띠는 views/home.js.
//  서버(kiugi 함수 v4)의 GET fights · fights?slug= · fights/<id> 답을 살펴 "무엇을 보여 줄지 · 언제 다시 읽을지"만 정한다.
import { FIGHT_ID, DJ_SLUG } from './route.js';

export const EMPTY_BOSS = '지금은 보스전이 없어요 — 방송 시작 30분 뒤부터 30분마다 나와요';
export const emptyLines = () => EMPTY_BOSS.split(' — ');
export const GONE_BOSS = '끝났거나 없는 보스전이에요.';
export const BROKEN_BOSS = '볼 수 없는 판이에요. 잠시 뒤에 다시 열어 주세요.';
export const SOUND_NOTE = '방송 소리와 겹칠 수 있어요';

// 다시 읽는 간격(ms): 목록 15초 · 모집 중인 판 3초 · 싸움 대본을 받은 뒤에는 땅 답이 올 때까지만 10초
export const LIST_POLL_MS = 15000, JOIN_POLL_MS = 3000, LAND_POLL_MS = 10000;
// 모집 마감 뒤 이만큼 지나도 대본이 안 오면 없는 판으로 본다(서버 목록도 마감 + 90초에 뺀다)
export const JOIN_GRACE_MS = 90000;
export const STRIP_MAX = 3;
// 채팅 링크(/b/<주소>)에서 판을 기다릴 때: "지금 다른 보스전"은 1분마다만 · 10분 넘게 판이 없으면 30초마다(화면을 다시 보거나 판이 생기면 15초로)
export const OTHERS_POLL_MS = 60000, IDLE_AFTER_MS = 600000, IDLE_POLL_MS = 30000;
export const waitPollMs = (idleMs) => (idleMs > IDLE_AFTER_MS ? IDLE_POLL_MS : LIST_POLL_MS);
// 없는 판·다 본 판에서 다음으로 넘어갈 때 잠깐 쉰다(바로 되부르지 않는다)
export const NEXT_MS = 1000;

const TYPES = new Set(['fire', 'water', 'grass', 'electric', 'earth', 'wind']);
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

// 이름표: 키우기 아이디의 # 앞만(솜사탕#먼치 → 솜사탕 — 그 방은 모두 같은 DJ). 아이디가 없으면 ''
export function fightName(label) {
  if (typeof label !== 'string') return '';
  return label.split('#')[0].trim();
}
// 장면 모듈에 넘기는 이름표 함수: 아이디가 없으면 몬스터 이름
export const nameOf = (m) => fightName(m?.label) || (typeof m?.name === 'string' && m.name) || '몬스터';

// 목록 한 줄이 쓸 만한가(주소에 넣을 번호·그림 고를 속성까지)
function okFight(f) {
  return isObj(f) && typeof f.id === 'string' && FIGHT_ID.test(f.id) && isObj(f.dj) && typeof f.dj.slug === 'string' && DJ_SLUG.test(f.dj.slug) && typeof f.dj.name === 'string'
    && isObj(f.boss) && TYPES.has(f.boss.type) && typeof f.boss.name === 'string' && (f.phase === 'join' || f.phase === 'fight');
}
export const listOf = (json) => (isObj(json) && Array.isArray(json.fights) ? json.fights.filter(okFight) : []);

export const phaseText = (f) => (f.phase === 'join' ? '모집 중' : '싸우는 중');
export const djText = (f) => `${f.dj.name} 방송`;
export const bossText = (f) => `${f.boss.name}${Number(f.boss.stage) > 0 ? ` ${Math.trunc(f.boss.stage)}단계` : ''}`;
export const joinedText = (f) => `참전 ${Math.max(0, Math.trunc(Number(f.joined) || 0))}명`;

// 첫 화면 띠: 3개까지 + 더 있는 수
export function stripItems(fights) {
  const all = Array.isArray(fights) ? fights : [];
  return { items: all.slice(0, STRIP_MAX), more: Math.max(0, all.length - STRIP_MAX) };
}

// 채팅 링크(/b/<주소>): 그 DJ 의 지금 판(가장 새 것). skip = 다 본 판·없는 판(번호 하나 또는 Set — 다시 틀지 않는다)
export function pickFight(fights, slug, skip = '') {
  const skipped = (id) => (skip instanceof Set ? skip.has(id) : id === skip);
  const mine = (Array.isArray(fights) ? fights : []).filter((f) => f.dj.slug === slug && !skipped(f.id));
  return mine.sort((a, b) => (Number(b.appearAt) || 0) - (Number(a.appearAt) || 0))[0] || null;
}

// 한 판 답(fights/<id> 의 fight)을 보고: 모집 장면(join) · 싸움 장면(fight) · 없는 판(gone) + 다음에 다시 읽을 간격(0 = 그만)
export function watchPlan(f, now) {
  const gone = { mode: 'gone', poll: 0 };
  if (!isObj(f) || !isObj(f.boss) || !TYPES.has(f.boss.type)) return gone;
  if (f.script != null) {
    if (!isObj(f.script) || !Array.isArray(f.script.events)) return gone;
    return { mode: 'fight', poll: f.land == null ? LAND_POLL_MS : 0 };
  }
  if (f.phase === 'join' && Number.isFinite(Number(f.joinUntil)) && now <= Number(f.joinUntil) + JOIN_GRACE_MS) return { mode: 'join', poll: JOIN_POLL_MS };
  return gone;
}

// 서버 시계 − 이 기기 시계(ms). sentAt·gotAt = 요청을 보낸·받은 때(이 기기 시계) — 그 가운데를 서버 now 로 본다
export function clockOffset(serverNow, sentAt, gotAt) {
  const n = Number(serverNow);
  return Number.isFinite(n) && typeof serverNow === 'number' ? Math.round(n - (sentAt + gotAt) / 2) : 0;
}

// 장면을 띄운다 — 그림을 받는 동안 보는 사람이 소리 단추를 눌렀으면 그 고름이 이긴다.
//  장면 모듈(playFight)은 그림·글꼴을 다 받은 뒤에야 opts.sound 를 소리에 넣는다 → 띄우기 시작할 때의 값이 나중 고름을 덮지 않게, 다 뜬 뒤 지금 고름으로 다시 맞춘다.
//  play(opts) = 장면 띄우기(약속) · audio = 장면들이 같이 쓰는 소리({on, set(v)}) · getSound() = 지금 고름
export async function playWithSound(play, audio, getSound, opts = {}) {
  const ctl = await play({ ...opts, sound: !!getSound(), audio });
  const want = !!getSound();
  if (audio && audio.on !== want) audio.set(want);
  return ctl;
}

// 약한 휴대폰: 캔버스 배율 상한을 낮추고 입자를 줄인다(코어 4개 이하 · 메모리 3GB 이하). 모르면 보통으로.
//  아이폰·아이패드는 코어 수를 줄여서 알려 줄 수 있어(사파리 엔진이 hardwareConcurrency 를 낮춰 말함) 코어 수로는 약하다고 보지 않는다 — 2026-11-23 실제 기기에서 버벅임 확인.
export function sceneQuality(nav) {
  const cores = Number(nav?.hardwareConcurrency), mem = Number(nav?.deviceMemory);
  const ios = /iPad|iPhone|iPod/.test(String(nav?.userAgent || '')) || (nav?.platform === 'MacIntel' && nav?.maxTouchPoints > 1);
  const weak = (!ios && cores > 0 && cores <= 4) || (mem > 0 && mem <= 3);
  return { maxDpr: weak ? 1.5 : 2, particles: weak ? 0.5 : 1, weak };
}
