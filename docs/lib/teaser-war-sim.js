// 예고 사이트 첫 화면의 "전쟁 지도" 흉내 — 지어낸 DJ 6명이 12월 한 달 동안 땅을 넓히는 모습(실제 기록 아님).
//  규칙은 시즌 2 사이트 체험(mock.js simulate)·기획 보고서 MapCore 와 같다:
//  보스 토벌 성공 = 남은 숲 × 3% ÷ 참가 DJ 수 · 영지전 = 진 DJ 땅 10% + 판돈 1만 냥마다 5%(25%까지) → 식민지, 되갚으면 독립.
//  하루씩(step) 나아가며 영토 서버 tr-snap/map.json 과 같은 모양을 만들고 parseMap 으로 그릴 수 있게 돌려준다.
// 이름은 모두 지어낸 것(실제 DJ 이름 아님).
import { GW, GH, SEA, WILD, continent, terrain, encodeRle, hash, parseMap } from './teaser-war-core.js';

export const WAR_DJS = ['별사탕', '구름빵', '초코칩', '달무리', '호박죽', '솜사탕'];
export const LAST_DAY = 31;
const GAMES = ['가위바위보', '하나빼기', '몬스터 대전'];

function rng(seed) {
  let s = seed | 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);

export function createWar({ land: given = null, seed = 20261201 } = {}) {
  const w = GW, h = GH, N = w * h, ND = WAR_DJS.length;
  const land = given && given.length === N ? given : continent(w, h), T = terrain(land, w, h);
  const nb4 = (i, cb) => { const x = i % w, y = (i - x) / w; if (x > 0) cb(i - 1); if (x < w - 1) cb(i + 1); if (y > 0) cb(i - w); if (y < h - 1) cb(i + w); };
  let LAND = 0; for (const v of land) LAND += v;
  // 기지: 바다에서 먼 곳 중 서로 멀리
  const cand = []; for (let i = 0; i < N; i++) if (land[i] && T.coast[i] >= 6) cand.push(i);
  if (!cand.length) for (let i = 0; i < N; i++) if (land[i]) cand.push(i);
  const caps = [cand[Math.floor(hash(3, 9, 1) * cand.length)]];
  while (caps.length < ND) {
    let bi = -1, bd = -1;
    for (const c of cand) { let md = 1e9; for (const p of caps) { const dx = (c % w) - (p % w), dy = Math.floor(c / w) - Math.floor(p / w); md = Math.min(md, dx * dx + dy * dy); } if (md > bd) { bd = md; bi = c; } }
    caps.push(bi);
  }
  const capDist = caps.map((p) => { const px = p % w, py = Math.floor(p / w), a = new Float32Array(N); for (let i = 0; i < N; i++) a[i] = Math.hypot((i % w) - px, Math.floor(i / w) - py); return a; });
  const ACT = [0.95, 0.62, 0.9, 0.85, 0.5, 0.75];
  let owner, base, col, rnd, day, yesterday, news;
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
    const ok = new Uint8Array(N); let start = -1, bd = 1e9;
    for (let i = 0; i < N; i++) if (owner[i] === lose && !base[i] && col[i] < 0) { ok[i] = 1; if (capDist[win][i] < bd) { bd = capDist[win][i]; start = i; } }
    if (start < 0 || n < 1) return { n: 0 };
    const inF = new Uint8Array(N), F = [start]; let got = 0; inF[start] = 1;
    while (got < n && F.length) {
      let bj = 0, bs = 1e9;
      for (let j = 0; j < F.length; j++) { const c = F[j], s = capDist[win][c] + T.lobe[c] * 8; if (s < bs) { bs = s; bj = j; } }
      const c2 = F[bj]; F[bj] = F[F.length - 1]; F.pop(); owner[c2] = win; col[c2] = lose; got++;
      nb4(c2, (m) => { if (ok[m] && !inF[m] && owner[m] === lose) { inF[m] = 1; F.push(m); } });
    }
    return { n: got };
  }
  function reset() {
    owner = Int16Array.from(land, (v) => (v ? WILD : SEA)); base = new Uint8Array(N); col = new Int16Array(N).fill(-1);
    rnd = rng(seed); day = 1; news = ['12월 1일 · 모두 기지 1%에서 시작해요'];
    caps.forEach((c, k) => { owner[c] = k; grow(k, Math.round(LAND * 0.01) - 1, true); for (let j = 0; j < N; j++) if (owner[j] === k) base[j] = 1; });
    yesterday = new Array(ND).fill(1);
  }
  // 하루 나아가기 — 마지막 날이면 false
  function step() {
    if (day >= LAST_DAY) return false;
    day++;
    yesterday = Array.from({ length: ND }, (_, k) => pct(k));
    const on = [], G = 0.03 / ND; news = [];
    for (let k = 0; k < ND; k++) {
      if (rnd() > ACT[k]) continue;
      on.push(k);
      const before = pct(k); let ok = 0;
      if (rnd() < 0.82) { grow(k, Math.max(1, Math.round(LAND * G * wildPct() / 100))); ok++; }
      news.push(ok ? `${WAR_DJS[k]} · 보스 토벌 성공 · 땅 +${f1(pct(k) - before)}%` : `${WAR_DJS[k]} · 보스 토벌 실패`);
    }
    const pool = on.slice();
    while (pool.length >= 2 && rnd() < 0.65) {
      const a = pool.splice(Math.floor(rnd() * pool.length), 1)[0], b = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      const r0 = rnd(), game = r0 < 0.45 ? 0 : r0 < 0.85 ? 1 : 2, winner = rnd() < 0.5 ? a : b, loser = winner === a ? b : a, bet = (2 + Math.floor(rnd() * 29)) * 1000;
      const share = Math.min(0.25, 0.1 + 0.05 * Math.floor(bet / 10000)), r = war(winner, loser, Math.round(own(loser) * share));
      news.push(`${WAR_DJS[winner]} 영지전 승리 · ${GAMES[game]}` + (r.free ? ' · 식민지 독립!' : r.n ? ` · ${WAR_DJS[loser]} 땅 ${f1((r.n / LAND) * 100)}% 식민지로` : ''));
    }
    return true;
  }
  // 지금 지도(그릴 수 있는 모양) — 영토 서버 map.json 과 같은 모양을 parseMap 에 넣는다
  function map() {
    const idOf = (k) => k + 1;
    return parseMap({
      season: 's2', grid: { w, h },
      owner: encodeRle(Array.from(owner, (v) => (v >= 0 ? idOf(v) : v))), col: encodeRle(Array.from(col, (v) => (v >= 0 ? idOf(v) : -1))),
      djs: WAR_DJS.map((name, k) => ({ id: idOf(k), name, cap: caps[k], pct: Math.round(pct(k) * 100) / 100, dayDelta: day > 1 ? Math.round((pct(k) - yesterday[k]) * 100) / 100 : null })),
    });
  }
  // 땅 순위(넓은 순)
  function ranking() { return WAR_DJS.map((name, k) => ({ name, pct: pct(k) })).sort((a, b) => b.pct - a.pct); }
  reset();
  return { reset, step, map, ranking, day: () => day, news: () => news.slice(), LAND };
}
