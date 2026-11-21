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
// 채팅 링크를 막 열었을 때(2026-11-19): 보스 등장 글의 링크를 누르고 온 사람 — 판이 서버에 올라오기까지 몇 초 걸린다(봇 2초 + 서버 기억 3초).
//  연 뒤 90초 동안은 3초마다 묻고(참전 모집이 65초쯤), 처음 10초는 "없어요" 대신 "찾는 중"이라고 한다.
export const FAST_POLL_MS = 3000, FAST_FOR_MS = 90000, SEEK_MS = 10000;
// openMs = 화면을 연 뒤 지난 시간(안 주면 예전처럼 15초·30초만)
export const waitPollMs = (idleMs, openMs = Infinity) => (openMs < FAST_FOR_MS ? FAST_POLL_MS : idleMs > IDLE_AFTER_MS ? IDLE_POLL_MS : LIST_POLL_MS);
// 기다림 화면 글: 큰 글·아랫줄·작은 글 + 정보 줄(status)
export function waitWords(openMs) {
  if (openMs < SEEK_MS) return { seeking: true, title: '보스를 찾는 중…', sub: '잠깐만 기다려 주세요', extra: '', status: '보스를 찾는 중이에요' };
  const [title, sub] = emptyLines();
  return { seeking: false, title, sub, extra: '보스가 나오면 여기서 바로 시작돼요', status: '보스를 기다리는 중이에요' };
}
// 읽기에 실패했을 때 다음까지 기다림: 한도에 걸렸으면(429) 30초 쉰다 · 아니면 usual(기본 5초)
export const FAIL_RETRY_MS = 5000, LIMIT_WAIT_MS = 30000;
export const failWaitMs = (e, usual = FAIL_RETRY_MS) => (e?.status === 429 ? LIMIT_WAIT_MS : usual);
// 장면 모듈을 못 받았을 때: 저절로 다시 해 보는 것은 두 번까지(브라우저가 실패한 받기를 기억해 두면 다시 해도 같다) — 그 뒤로는 멈추고 "다시 시도" 단추(새로 고침)만
export const LOAD_RETRY_MAX = 2;
export const loadRetryPlan = (fails) => (fails <= LOAD_RETRY_MAX ? { poll: LIST_POLL_MS, status: '15초 뒤에 다시 해 봐요' } : { poll: 0, status: '다시 시도를 눌러 주세요' });
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

// 상태 글. now(서버 시계)를 주면 참전 마감이 지난 모집 판은 "결과를 기다리는 중"(장면의 joinWords 와 같은 글 — 봇이 꺼져 대본이 안 와도 "모집 중"이라고 하지 않는다)
export const WAIT_RESULT = '결과를 기다리는 중';
export const phaseText = (f, now) => (f.phase !== 'join' ? '싸우는 중' : Number.isFinite(now) && Number.isFinite(Number(f.joinUntil)) && now > Number(f.joinUntil) ? WAIT_RESULT : '모집 중');
export const djText = (f) => `${f.dj.name} 방송`;
// 보스 stage = 시즌 며칠째 보스(봇 글 "📅 12월 12일 보스 (12일째)" · 장면 "12일째"와 같은 말 — 2026-11-21 검수 S7b. 몬스터 진화 "n단계"와 헷갈리지 않게)
export const bossText = (f) => `${f.boss.name}${Number(f.boss.stage) > 0 ? ` ${Math.trunc(f.boss.stage)}일째` : ''}`;
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

// 시계 맞춤은 가장 빨리 온 답 하나로만(2026-11-19): 답이 느릴수록 "가운데"가 틀린다 — 느린 답 하나에 장면이 되감기거나 건너뛰지 않게.
//  prev = {offset, rtt} | null → 더 빨리 온 답이면 새 값, 아니면 prev 그대로. now 가 수가 아니거나 받은 때가 보낸 때보다 앞이면(기기 시계가 바뀜) 버린다.
export function bestClock(prev, serverNow, sentAt, gotAt) {
  const rtt = gotAt - sentAt;
  if (typeof serverNow !== 'number' || !Number.isFinite(serverNow) || !(rtt >= 0)) return prev;
  return prev && rtt >= prev.rtt ? prev : { offset: clockOffset(serverNow, sentAt, gotAt), rtt };
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
