// 체험 모드(이 PC 미리 보기 — localhost 에서만, api.js isDemo): 서버 없이 지어낸 지도·몬스터로 답한다.
//  · 지도: 영토 서버의 tr-snap/map.json 과 같은 모양을 만든다 — 기획 보고서 MapCore 의 시험판처럼 지어낸 DJ 들이
//    12월 한 달 동안 보스 토벌(숲의 일부)·영지전(식민지·독립)으로 땅을 넓힌다. 주소 ?day=<1~31>(처음 날짜) · ?djs=<DJ 수, 3~40> · ?empty=1(지도 파일 없음).
//    체험 모드에서는 지도를 다시 읽을 때마다 하루가 지난다(경계가 번지는 모습을 보려고). ?still=1 이면 그대로.
//  · 찾기(kiugi/search) · 한 사람(kiugi/person): 지어낸 아이디(밤톨#먼치 등)와 몬스터.
// 이름은 모두 지어낸 것(실제 DJ·청취자 이름 아님).
import { GW, GH, SEA, WILD, continent, terrain, encodeRle, hash, landFromGrid } from './lib/map-core.js';

export const DEMO_DJS = ['별사탕', '구름빵', '초코칩', '달무리', '호박죽', '솜사탕', '꿀떡', '단팥빵', '크림빵', '말랑', '젤리곰', '꽈배기', '붕어빵', '호떡', '찹쌀떡',
  '보름달', '모래알', '이슬비', '봄바람', '은하수', '새싹', '조약돌', '물방울', '초승달', '눈송이', '햇살', '노을', '파도', '산들', '들꽃',
  '도토리', '마카롱', '쿠키', '라떼', '바닐라', '딸기잼', '귤껍질', '감자칩', '옥수수', '고구마'];
const GAMES = ['가위바위보', '가위바위보 하나빼기', '몬스터 대전'];

function rng(seed) {
  let s = seed | 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
const won = (v) => (v >= 10000 ? `${Math.round(v / 1000) / 10}만` : v.toLocaleString('ko-KR'));

// 한 달 흉내(2026-11-18 보스 규칙에 맞춤: 2시간 방송에 보스 3번 · 이기면 남은 숲 × 2% ÷ 참가 수 — 흉내라 실패한 땅은 줄이지 않고 소식만, 영지전은 진 DJ 땅 10%+판돈 1만 냥마다 5%(25%까지) → 식민지, 되갚으면 독립)
//  land: 땅 칸(Codex 그림의 docs/s2/land-grid.json — 없으면 절차 대륙)
export function simulate({ djs = 5, day = 12, land: given = null } = {}) {
  const w = GW, h = GH, N = w * h, ND = Math.max(2, Math.min(DEMO_DJS.length, djs));
  const land = given && given.length === N ? given : continent(w, h), T = terrain(land, w, h);
  const nb4 = (i, cb) => { const x = i % w, y = (i - x) / w; if (x > 0) cb(i - 1); if (x < w - 1) cb(i + 1); if (y > 0) cb(i - w); if (y < h - 1) cb(i + w); };
  let LAND = 0; for (const v of land) LAND += v;
  // 기지: 바다에서 먼 곳 중 서로 멀리
  const cand = []; for (let i = 0; i < N; i++) if (land[i] && T.coast[i] >= 6) cand.push(i);
  const caps = [cand[Math.floor(hash(3, 9, 1) * cand.length)]];
  while (caps.length < ND) {
    let bi = -1, bd = -1;
    for (const c of cand) { let md = 1e9; for (const p of caps) { const dx = (c % w) - (p % w), dy = Math.floor(c / w) - Math.floor(p / w); md = Math.min(md, dx * dx + dy * dy); } if (md > bd) { bd = md; bi = c; } }
    caps.push(bi);
  }
  const capDist = caps.map((p) => { const px = p % w, py = Math.floor(p / w), a = new Float32Array(N); for (let i = 0; i < N; i++) a[i] = Math.hypot((i % w) - px, Math.floor(i / w) - py); return a; });
  const owner = Int16Array.from(land, (v) => (v ? WILD : SEA)), base = new Uint8Array(N), col = new Int16Array(N).fill(-1);
  const cnt = (k) => { let c = 0; for (let i = 0; i < N; i++) if (owner[i] === k) c++; return c; };
  const pct = (k) => (cnt(k) / LAND) * 100, wildPct = () => (cnt(WILD) / LAND) * 100;
  const own = (k) => { let c = 0; for (let i = 0; i < N; i++) if (owner[i] === k && !base[i] && col[i] < 0) c++; return c; };
  function grow(k, n, pure) {
    if (n <= 0) return 0;
    const inF = new Uint8Array(N), F = []; let got = 0;
    for (let i = 0; i < N; i++) if (owner[i] === k) nb4(i, (m) => { if (owner[m] === WILD && !inF[m]) { inF[m] = 1; F.push(m); } });
    while (got < n && F.length) {
      let bj = 0, bs = 1e9;
      for (let j = 0; j < F.length; j++) { const c = F[j], s = capDist[k][c] + (pure ? 0 : T.lobe[c] * 30 + T.jit[c] * 3); if (s < bs) { bs = s; bj = j; } }
      const c2 = F[bj]; F[bj] = F[F.length - 1]; F.pop();
      if (owner[c2] !== WILD) continue;
      owner[c2] = k; got++;
      nb4(c2, (m) => { if (owner[m] === WILD && !inF[m]) { inF[m] = 1; F.push(m); } });
    }
    return got;
  }
  function war(win, lose, n) {
    let freed = 0;
    for (let i = 0; i < N; i++) if (owner[i] === lose && col[i] === win) { owner[i] = win; col[i] = -1; freed++; }
    if (freed) return { n: freed, free: true };
    const ok = new Uint8Array(N); let seed = -1, bd = 1e9;
    for (let i = 0; i < N; i++) if (owner[i] === lose && !base[i] && col[i] < 0) { ok[i] = 1; if (capDist[win][i] < bd) { bd = capDist[win][i]; seed = i; } }
    if (seed < 0 || n < 1) return { n: 0 };
    const inF = new Uint8Array(N), F = [seed]; let got = 0; inF[seed] = 1;
    while (got < n && F.length) {
      let bj = 0, bs = 1e9;
      for (let j = 0; j < F.length; j++) { const c = F[j], s = capDist[win][c] + T.lobe[c] * 8; if (s < bs) { bs = s; bj = j; } }
      const c2 = F[bj]; F[bj] = F[F.length - 1]; F.pop(); owner[c2] = win; col[c2] = lose; got++;
      nb4(c2, (m) => { if (ok[m] && !inF[m] && owner[m] === lose) { inF[m] = 1; F.push(m); } });
    }
    return { n: got };
  }
  const rnd = rng(20261115 + ND);
  caps.forEach((c, k) => { owner[c] = k; grow(k, Math.round(LAND * 0.01) - 1, true); for (let j = 0; j < N; j++) if (owner[j] === k) base[j] = 1; });
  const ACT = Array.from({ length: ND }, (_, k) => [0.95, 0.6, 0.9, 0.85, 0.45][k % 5] - (k >= 5 ? 0.05 * (k % 4) : 0));
  let feed = [{ text: '12월 1일 시즌 시작 · 모두 기지 1%에서 시작해요', day: 1 }];
  let yesterday = new Array(ND).fill(1);
  const target = Math.max(1, Math.min(31, day));
  for (let d = 2; d <= target; d++) {
    yesterday = Array.from({ length: ND }, (_, k) => pct(k));
    const news = [], on = [], G = 0.02 / ND;
    for (let k = 0; k < ND; k++) {
      if (rnd() > ACT[k]) continue;
      on.push(k);
      const casts = rnd() < 0.4 ? 2 : 1, before = pct(k); let ok = 0, miss = 0;
      for (let z = 0; z < casts * 3; z++) { if (rnd() < 0.1) continue; if (rnd() < 0.7) { grow(k, Math.max(1, Math.round(LAND * G * wildPct() / 100))); ok++; } else miss++; }
      if (ok) news.push(`${DEMO_DJS[k]} · 보스 토벌 성공 · 땅 +${f1(pct(k) - before)}%`);
      else if (miss) news.push(`${DEMO_DJS[k]} · 보스 토벌 실패`);
    }
    const pool = on.slice();
    while (pool.length >= 2 && rnd() < 0.6) {
      const a = pool.splice(Math.floor(rnd() * pool.length), 1)[0], b = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      const r0 = rnd(), game = r0 < 0.45 ? 0 : r0 < 0.85 ? 1 : 2, winner = rnd() < 0.5 ? a : b, loser = winner === a ? b : a, bet = (2 + Math.floor(rnd() * 29)) * 1000;
      const share = Math.min(0.25, 0.1 + 0.05 * Math.floor(bet / 10000)), r = war(winner, loser, Math.round(own(loser) * share));
      news.push(`${DEMO_DJS[a]} vs ${DEMO_DJS[b]} 영지전 · ${GAMES[game]} · ${DEMO_DJS[winner]} 승 · 판돈 ${won(bet)}냥` + (r.free ? ` · 식민지 ${f1((r.n / LAND) * 100)}%를 되찾았어요(독립)` : r.n ? ` · ${DEMO_DJS[loser]} 땅 ${f1((r.n / LAND) * 100)}%를 식민지로` : ''));
    }
    feed = [...news.map((text) => ({ text, day: d })), ...feed];
  }
  const colPct = (k) => { let c = 0; for (let i = 0; i < N; i++) if (owner[i] === k && col[i] >= 0) c++; return (c / LAND) * 100; };
  const ruledPct = (k) => { let c = 0; for (let i = 0; i < N; i++) if (col[i] === k) c++; return (c / LAND) * 100; };
  // 지도 파일 모양(spec.md 5절) — owner·col 값 = DJ 번호(id, 1부터), 바다 -2 · 숲 -1
  const idOf = (k) => k + 1;
  const at = Date.parse(`2026-12-${String(target).padStart(2, '0')}T21:30:00+09:00`);
  return {
    season: 's2', updatedAt: new Date(at).toISOString(), endsAt: '2026-12-31T23:59:59+09:00', grid: { w, h },
    owner: encodeRle(Array.from(owner, (v) => (v >= 0 ? idOf(v) : v))), col: encodeRle(Array.from(col, (v) => (v >= 0 ? idOf(v) : -1))),
    djs: Array.from({ length: ND }, (_, k) => ({ id: idOf(k), name: DEMO_DJS[k], cap: caps[k], pct: Math.round(pct(k) * 100) / 100, colPct: Math.round(colPct(k) * 100) / 100, ruledPct: Math.round(ruledPct(k) * 100) / 100, dayDelta: Math.round((pct(k) - yesterday[k]) * 100) / 100 })),
    feed: feed.slice(0, 20).map((x) => ({ text: x.text, at: new Date(Date.parse(`2026-12-${String(x.day).padStart(2, '0')}T21:00:00+09:00`)).toISOString() })),
    prize: { text: '1등 DJ에게 먼치킨 한 달 무료 이용권 + 상금 486스푼' },
    demoNow: at,
  };
}

// 체험 지도: 다시 읽을 때마다 하루씩(?still=1 이면 그대로)
let demoDay = null, gridJob = null;
function param(name) { try { return new URLSearchParams(location.search).get(name); } catch { return null; } }
export async function demoMap() {
  if (param('empty') === '1') return null;
  const start = Math.max(1, Math.min(31, Number(param('day')) || 12)), djs = Math.max(3, Math.min(40, Number(param('djs')) || 5));
  if (demoDay === null) demoDay = start; else if (param('still') !== '1' && demoDay < 31) demoDay++;
  // 그림 지도와 같은 땅에서 흉내(?art=0 이면 절차 대륙)
  if (!gridJob) gridJob = param('art') === '0' ? Promise.resolve(null) : fetch(new URL('./s2/land-grid.json', import.meta.url)).then((r) => (r.ok ? r.json() : null)).then((j) => landFromGrid(j)?.land || null).catch(() => null);
  return simulate({ djs, day: demoDay, land: await gridJob });
}

// ---- 몬스터(아이디 찾기) ----
const M = (sp, stage, lv) => ({ sp, stage, lv });
// 레벨은 단계와 맞춘다(2단계 = 경험치 4,500 → Lv.17 이상 · 3단계 = 14,000 → Lv.30 이상). _03 은 드문 몬스터.
export const DEMO_PEOPLE = [
  { slug: 'nyangdj7', djName: '먼치', id: '밤톨#먼치', lead: 'water_01', monsters: [M('water_01', 2, 18), M('fire_02', 1, 9), M('grass_01', 1, 6), M('grass_03', 1, 4)] },
  { slug: 'nyangdj7', djName: '먼치', id: '사탕요정#먼치', lead: 'electric_03', monsters: [M('electric_03', 3, 31), M('fire_01', 3, 30), M('wind_02', 2, 19), M('earth_01', 1, 11), M('water_02', 1, 7)] },
  { slug: 'nyangdj7', djName: '먼치', id: '구름이#먼치', lead: 'grass_02', monsters: [M('grass_02', 1, 3)] },
  { slug: 'cookie88', djName: '쿠키', id: '밤톨#쿠키', lead: 'fire_01', monsters: [M('fire_01', 1, 8), M('earth_02', 1, 4)] },
  { slug: 'cookie88', djName: '쿠키', id: '별빛#쿠키', lead: 'wind_01', monsters: [M('wind_01', 2, 21), M('fire_01', 2, 17), M('water_03', 1, 12), M('grass_01', 1, 9), M('electric_02', 1, 6), M('earth_03', 1, 5)] },
];
const key = (s) => String(s ?? '').normalize('NFC').toLowerCase().replace(/\s+/g, '');
export async function handle(method, path, query = {}) {
  await new Promise((r) => setTimeout(r, 120));
  if (method === 'GET' && path === 'kiugi/search') {
    const q = key(query.q);
    if (!/^[가-힣]{1,6}(#[가-힣a-z0-9]{1,8})?$/.test(q)) return { status: 400, json: { error: '아이디를 한글 1~6자로 적어 주세요. 예: 밤톨 또는 밤톨#먼치' } };
    const exact = [], part = [];
    for (const p of DEMO_PEOPLE) {
      const k = key(p.id), t = q.includes('#') ? k : k.split('#')[0];
      if (t === q) exact.push(p); else if (!q.includes('#') && t.includes(q)) part.push(p);
    }
    return { status: 200, json: { results: [...exact, ...part].slice(0, 10).map((p) => structuredClone(p)), exact: exact.length, more: false } };
  }
  if (method === 'GET' && path === 'kiugi/person') {
    const q = key(query.id), p = DEMO_PEOPLE.find((x) => x.slug === query.slug && (key(x.id) === q || key(x.id).split('#')[0] === q));
    if (!p) return { status: 404, json: { error: '이 아이디를 찾을 수 없어요. 이번 시즌 아이디가 맞는지 확인해 주세요.' } };
    return { status: 200, json: { id: p.id, lead: p.lead, monsters: structuredClone(p.monsters), season: { id: 's2', name: '몬스터 영토전', endsAt: '2026-12-31T14:59:59.000Z' }, dj: { slug: p.slug, name: p.djName } } };
  }
  if (method === 'GET' && (path === 'kiugi/fights' || path.startsWith('kiugi/fights/'))) {
    const skew = Number(param('skew')) || 0;
    demoWorld ||= demoFights({ t0: Date.now() + skew, none: param('fights') === '0', wait: param('wait') === null ? null : Number(param('wait')) || 0, every: param('every') });
    const now = Date.now() + skew;
    return path === 'kiugi/fights' ? demoWorld.list(now, query) : demoWorld.one(now, decodeURIComponent(path.slice('kiugi/fights/'.length)));
  }
  return { status: 404, json: { error: '찾을 수 없어요.' } };
}

// ---- 보스전 보기(2026-11-19) — 지어낸 판. 서버(kiugi 함수 v4) GET fights · fights?slug= · fights/<id> 와 같은 모양 ----
//  주소: ?fights=0(판 없음) · ?wait=<초>(그 뒤에 먼치 방송 판이 생긴다 — /b/<주소> 기다림 화면 확인) · ?every=<초>(먼치 방송 새 판 간격, 기본 200) · ?skew=<ms>(서버 시계가 이 PC 보다 그만큼 빠름)
//  기본: 먼치 방송(모집 중 → 25초 뒤 싸움 → 땅은 20초 뒤 · 200초마다 새 판) · 쿠키 방송(30명, 싸우는 중) · 달무리 방송(3명) · 솜사탕 방송(모집 중) · 끝난 판 하나
export const DEMO_BOSS_SLUG = 'nyangdj7', DEMO_ENDED_ID = 'endedfght222';
const BOSSES = { fire: ['화산 두꺼비', '화구분출'], water: ['심해 크라켄', '산호해일'], grass: ['그루각', '꽃뿔쇄도'], earth: ['협곡 들소', '사암폭풍'], wind: ['천해신 벨', '구름대진군'], electric: ['뇌우라', '천둥그물'] };
const MON_NAMES = { fire_01: ['홍룡이', '화룡이', '파라곤'], fire_02: ['너굴잉', '화구리', '태구리'], fire_03: ['홍깃', '화깃', '태화깃'], water_01: ['물꼬달', '여울달', '해울달'], water_02: ['개골', '깨골', '큰깨골'], water_03: ['솟나루', '물솟나루', '큰너울'],
  grass_01: ['새싹곰', '그루곰', '거목곰'], grass_02: ['이끼잠', '덩굴잠', '녹림잠'], grass_03: ['빵빵이', '다람이', '숲지람'], earth_01: ['돌몽이', '황토치', '바위든'], earth_02: ['층모루', '판모루', '성모루'], earth_03: ['어금니', '송곳니', '뿔뿔이'],
  wind_01: ['삐리링', '회오링', '천풍'], wind_02: ['휘부이', '휘나래', '학도령'], wind_03: ['몽실람', '날래람', '창공람'], electric_01: ['찌릿냥', '자뢰냥', '뇌관묘'], electric_02: ['자릿꼬', '자릿쏜', '자릿섬'], electric_03: ['또르매', '뇌깃솔', '천뢰깃'] };
const FANS = ['밤톨', '솜사탕', '보리차', '달고나', '호두', '모찌', '단추', '구름빵', '꿀단지', '조약돌', '별사탕', '콩떡', '누룽지', '감귤', '도토리', '찹쌀', '방울', '새벽달', '모래알', '눈꽃'];
const FAN_MORE = ['', '둘', '셋', '넷'];
const RING_T = ['water', 'fire', 'grass', 'earth', 'electric', 'wind']; // 왼쪽이 오른쪽에 강함(끝은 처음에)
const effOf = (att, def) => (RING_T[(RING_T.indexOf(att) + 1) % 6] === def ? 2 : RING_T[(RING_T.indexOf(def) + 1) % 6] === att ? 0 : 1); // 2 강함 · 0 약함 · 1 보통(짧은 사건의 e)
const E_MUL = [0.75, 1, 1.5];
// 싸움 대본(FightScript v1 — 봇 fight-script.mjs 와 같은 모양, 사건은 짧은 배열). 같은 씨앗이면 같은 판
export function demoScript({ n = 10, type = 'water', stage = 4, seed = 1, dj = '먼치', win = true } = {}) {
  const r = rng(seed * 7919 + n), [name, aoe] = BOSSES[type] || BOSSES.fire;
  const kinds = Object.keys(MON_NAMES);
  const team = Array.from({ length: n }, (_, i) => {
    const sp = kinds[Math.floor(r() * kinds.length)], st = 1 + Math.floor(r() * 3);
    const fan = FANS[i % FANS.length] + (FAN_MORE[Math.floor(i / FANS.length)] || '');
    return { label: i % 4 === 3 ? null : `${fan}#${dj}`, sp, type: sp.split('_')[0], name: MON_NAMES[sp][st - 1], stage: st, lv: [6, 18, 31][st - 1] + Math.floor(r() * 6) };
  });
  const atk = team.map((m) => 40 + m.lv * 4), full = team.map((m) => 140 + m.lv * 9), mhp = full.slice(), ko = team.map(() => false), dealt = team.map(() => 0);
  const per = atk.reduce((a, b) => a + b, 0), hp0 = Math.max(100, Math.round(per * (win ? 3.4 : 9)));
  const events = [], maxRounds = 6;
  let hp = hp0, charged = false, aoeDone = false, rounds = 0;
  for (let round = 1; round <= maxRounds && hp > 0 && ko.some((x) => !x); round++) {
    rounds = round;
    for (let i = 0; i < n && hp > 0; i++) {
      if (ko[i]) continue;
      const e = effOf(team[i].type, type), dmg = Math.min(hp, Math.max(1, Math.round(atk[i] * E_MUL[e] * (0.85 + r() * 0.3))));
      events.push(['h', round, i, dmg, e, hp, hp - dmg]); hp -= dmg; dealt[i] += dmg;
      if (!charged && hp > 0 && hp < hp0 / 2) { charged = true; events.push(['c', round, hp]); }
    }
    if (hp <= 0) break;
    const alive = team.map((m, i) => i).filter((i) => !ko[i]);
    if (charged && !aoeDone) {
      aoeDone = true;
      events.push(['a', round, hp, alive.map((i) => { const e = effOf(type, team[i].type), dmg = Math.round((win ? 40 : 150) * E_MUL[e] * (0.8 + r() * 0.4)); mhp[i] -= dmg; if (mhp[i] <= 0) ko[i] = true; return [i, dmg, e, ko[i] ? 1 : 0]; })]);
    } else {
      const i = alive[Math.floor(r() * alive.length)], e = effOf(type, team[i].type), dmg = Math.round((win ? 80 : 420) * E_MUL[e] * (0.8 + r() * 0.4)), fresh = mhp[i] === full[i];
      mhp[i] -= dmg; if (mhp[i] <= 0) ko[i] = true;
      events.push(['b', round, i, dmg, e, ko[i] ? 1 : 0, ko[i] && fresh ? 1 : 0, hp]);
    }
  }
  const top = dealt.indexOf(Math.max(...dealt));
  const buffs = { 1: ['영웅 출현', 2.2, 1.8, true], 3: ['삼위일체', 1.34, 1.25, false], 5: ['오성진', 1.2, 1.15, false], 7: ['북두칠성', 1.12, 1.1, false] };
  const bf = buffs[n] || (n > 7 && n <= 10 ? ['십시일반', 1.06, 1.05, false] : null);
  return { v: 1, boss: { type, name, aoe, stage }, team, buff: bf ? { b: n, name: bf[0], a: bf[1], h: bf[2], hero: bf[3] } : null, hp: hp0, left: Math.max(0, hp), win: hp <= 0, rounds, maxRounds,
    mvp: n ? { i: top, dealt: dealt[top] } : null, events, land: null };
}
let demoWorld = null;
export function demoFights({ t0, none = false, wait = null, every = 200 } = {}) {
  const P = Math.max(30, Number(every) || 200) * 1000; // 먼치 방송은 이만큼마다 새 판(?every=<초>)
  const mk = (id, slug, dj, type, stage, n, seed, appearAt, joinMs, win, land, landAfter = 0) => ({ id, slug, dj, type, stage, n, seed, appearAt, joinUntil: appearAt + joinMs, startAt: appearAt + joinMs + 2000, win, land, landAfter });
  const fixed = none || wait !== null ? [] : [
    mk('cukkyfght222', 'cukky888', '쿠키', 'fire', 6, 30, 3, t0 - 82000, 60000, true, { addedPct: 0.31, pct: 4.7 }),
    mk('darmuryfght2', 'darmury2', '달무리', 'grass', 2, 3, 5, t0 - 100000, 60000, false, { lostPct: 0.5, pct: 1.6 }),
    mk('ssatangfght2', 'ssatang2', '솜사탕', 'electric', 3, 5, 9, t0 - 15000, 60000, true, { addedPct: 0.2, pct: 2.2 }, 15000),
  ];
  const ended = none ? [] : [mk(DEMO_ENDED_ID, DEMO_BOSS_SLUG, '먼치', 'wind', 3, 7, 11, t0 - 400000, 60000, true, { addedPct: 0.44, pct: 3.9 })];
  const code = (k) => 'abc'[Math.floor(k / 9) % 3] + 'abc'[Math.floor(k / 3) % 3] + 'abc'[k % 3];
  // 먼치 방송의 k 번째 판: 처음 판은 열자마자 모집 중(35초 지남 · 25초 남음). ?wait= 이면 그 뒤에 나타나 20초 모집
  const mine = (k) => mk('munchfght' + code(k), DEMO_BOSS_SLUG, '먼치', ['water', 'fire', 'earth'][k % 3], 9, 10 + k * 8, 7 + k,
    (wait !== null ? t0 + wait * 1000 : t0 - 35000) + k * P, wait !== null ? 20000 : 60000, k % 2 === 0, k % 2 === 0 ? { addedPct: 0.42, pct: 3.1 } : { lostPct: 0.3, pct: 2.8 }, 20000);
  const all = (now) => { const out = [...fixed, ...ended]; for (let k = 0; !none && k < 27; k++) { const f = mine(k); if (f.appearAt > now) break; out.push(f); } return out; };
  const scripts = new Map();
  const scriptOf = (f) => { if (!scripts.has(f.id)) scripts.set(f.id, demoScript({ n: f.n, type: f.type, stage: f.stage, seed: f.seed, dj: f.dj, win: f.win })); return scripts.get(f.id); };
  const out = (f, now) => {
    const fight = now >= f.startAt, sc = scriptOf(f), span = f.joinUntil - f.appearAt;
    return { id: f.id, dj: { slug: f.slug, name: f.dj }, boss: { type: f.type, name: sc.boss.name, stage: f.stage }, phase: fight ? 'fight' : 'join',
      joined: fight ? f.n : Math.max(0, Math.min(f.n, Math.round(f.n * (now - f.appearAt) / span))), appearAt: f.appearAt, joinUntil: f.joinUntil, startAt: fight ? f.startAt : null };
  };
  return {
    list(now, query = {}) {
      const rows = all(now).filter((f) => now <= f.startAt + 90000 && (!query.slug || f.slug === query.slug)).sort((a, b) => b.appearAt - a.appearAt);
      return { status: 200, json: { now, fights: rows.map((f) => out(f, now)) } };
    },
    one(now, id) {
      const f = all(now).find((x) => x.id === id);
      if (!f || now > f.startAt + 90000 + 600000) return { status: 404, json: { error: '끝났거나 없는 보스전이에요.' } };
      const o = out(f, now), sc = scriptOf(f), land = o.phase === 'fight' && now >= f.startAt + f.landAfter ? f.land : null;
      const script = o.phase === 'fight' ? { ...structuredClone(sc), id: f.id, dj: o.dj, k: 1, appearAt: f.appearAt, joinUntil: f.joinUntil, startAt: f.startAt, land } : null;
      return { status: 200, json: { now, fight: { ...o, boss: { ...o.boss, aoe: sc.boss.aoe }, script, land } } };
    },
  };
}
