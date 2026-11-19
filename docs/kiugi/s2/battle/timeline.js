// 보스전 보기 — 장면 시간표 (순수: 화면·봇 모듈을 쓰지 않는다. battle-scene.js 와 node 시험이 같이 읽는다)
//  싸움 대본(FightScript v1 — app/src/bot/kiugi/fight-script.mjs)을 받아 "언제 무엇을 보여 줄지"만 정한다. 그리기는 battle-scene.js.
//  buildTimeline(script, timing) → { duration, marks:[{t,name}], steps:[{t,kind,…}], result, big, frontIdx, dealt, ko, joinOnly }
//   marks  = 장면이 바뀌는 시각: opening → join → (buff) → turn → battle → round1 … (charge → aoe) … → ending
//   steps  = 그릴 걸음: opening · present(앞줄 한 명 등장) · crowd(무리 등장) · buff · turn · round · hit · volley · boss · charge · aoe · ending
//            모집 중(appear 만 받은 대본)은 opening · joinWait 둘뿐
//   result = 'win' | 'timeout'(라운드 안에 못 잡음 — "버텼어요") | 'wipe'(모두 쓰러짐) | 'empty'(참전 0명) | null(모집 중)

// ── 시간 값(ms)은 여기 한곳 ──
export const TIMING = {
  fadeIn: 900,        // 검은 화면에서 열리기
  bossDropAt: 650,    // 보스가 떨어지기 시작하는 때
  bossDrop: 380,      // 떨어지는 시간
  bossCaption: 1500,  // "보스 출현!"
  bossName: 1700,     // 보스 이름 · 단계
  present: 2100,      // 참가한 한 명이 앞으로 나와 자기 몬스터(앞모습)를 보여 주는 한 장면
  turn: 800,          // 싸움 직전: 모두 보스 쪽으로 돌아서기
  buff: 2700,         // 파티 버프 글
  roundCue: 1000,     // "라운드 n/6"
  lastRoundCue: 1700, // "마지막 라운드!"
  hit: 2300,          // 몬스터가 때리는 한 줄
  hitImpact: 300,     // 그 안에서 맞는 순간
  boss: 2700,         // 보스가 때리는 한 줄
  bossImpact: 430,
  koExtra: 700,       // 쓰러질 때 더 쓰는 시간
  charge: 1800,       // 보스가 힘을 모으기 시작(광역기 예고)
  aoe: 4800,          // 광역기 한 장면
  hitStop: 110,       // 약점일 때 잠깐 멈춤
  hpDrain: 380,       // 체력 막대가 줄어드는 시간
  hpGhostDelay: 420,  // 잔상이 따라오기 전 기다림
  hpGhost: 520,
  endLead: 500,       // 마지막 줄 뒤 숨 고르기
  endWin: 5200,       // 승리 연출
  endLose: 4200,      // 패배 연출(모두 쓰러짐)
  endTimeout: 8600,   // 패배 연출(라운드 안에 못 잡음: 남은 체력 → 보스 포효 → 결과)
  endEmpty: 4200,     // 아무도 참전하지 않은 판
  idleFrame: 480,     // 가만히 있을 때 한 장 길이
  // ↓ 여럿(4명부터)일 때: 길이가 늘지 않게 묶어서 보여 줌
  crowdJoin: 2400,    // 뒤의 무리가 몰려 들어오는 시간 + "참전 n명"
  spot: 1500,         // 한 명씩 보여 주는 큰 장면(약점·큰 한 방)
  spotImpact: 260,
  volley: 1500,       // 여럿이 한꺼번에 때리는 장면
  maxTotal: 80000,    // 한 판 길이 목표(이 안에 들도록 큰 장면 수·한 줄 길이를 정함)
  hardMax: 90000,     // 한 판 길이 한도(넘으면 더 묶는다)
  bigHit: 1.4,        // 중간값의 몇 배부터 "큰 한 방"으로 볼지(채팅 중계와 같은 규칙)
};

// ── 사건 되돌리기 — 봇 fight-script.mjs 의 unpackEvents 와 같은 규칙(시험이 두 결과를 견준다) ──
//  h[round,i,dmg,e,before,after] · b[round,i,dmg,e,ko,oneShot,hp] · c[round,hp] · a[round,hp,[[i,dmg,e,ko],…]] — e: 0→0.75, 1→1, 2→1.5
const E_UNPACK = [0.75, 1, 1.5];
const eUnpack = v => E_UNPACK[v] ?? 1;
export function unpackEvents(rows) {
  return (rows || []).map(r => {
    if (!Array.isArray(r)) return r; // 이미 풀린 사건은 그대로
    switch (r[0]) {
      case 'h': return { round: r[1], kind: 'hit', i: r[2], dmg: r[3], eff: eUnpack(r[4]), before: r[5], after: r[6] };
      case 'b': return { round: r[1], kind: 'boss', i: r[2], dmg: r[3], eff: eUnpack(r[4]), ko: r[5] === 1, oneShot: r[6] === 1, before: r[7], after: r[7] };
      case 'c': return { round: r[1], kind: 'charge', before: r[2], after: r[2] };
      case 'a': return { round: r[1], kind: 'aoe', hits: r[3].map(h => ({ i: h[0], dmg: h[1], eff: eUnpack(h[2]), ko: h[3] === 1 })), before: r[2], after: r[2] };
      default: throw new Error('모르는 사건 줄: ' + r[0]);
    }
  });
}

// 모집 중(봇이 appear 만 올린 때 — 보스 · 참전 마감 시각 · 참전 수): 싸움 사건이 아직 없다
// 이름표 글: 키우기 아이디 "솜사탕#먼치" 는 # 앞("솜사탕")만 보인다. # 이 없으면 그대로, 비면 ''(부른 쪽이 몬스터 이름으로)
export const labelText = v => String(v ?? '').split('#')[0].trim();
// 이름표: nameOf(member, i) 를 주면 그 글 그대로(부른 쪽이 정한 것 — 봇 탭의 스푼 닉네임은 # 이 있어도 온전히). 안 주면 대본 label 의 # 앞.
//  어느 쪽이든 비면 몬스터 이름
export function labelFor(m, i, nameOf) {
  const name = String(m?.name || '몬스터');
  if (typeof nameOf !== 'function') return labelText(m?.label) || name;
  let v = null; try { v = nameOf(m, i); } catch { /* 몬스터 이름으로 */ }
  return String(v ?? '').trim() || name;
}

export const isJoinOnly = script => !Array.isArray(script?.events);

// 생중계: 지금(서버 시계) − 싸움 시작 = 건너뛸 ms. live = {startAt, now(함수 또는 수 — 없으면 이 기기 시계)}. 모르면 null
export function liveOffset(live) {
  if (!live || typeof live !== 'object') return null;
  const start = Number(live.startAt);
  if (live.startAt == null || !Number.isFinite(start)) return null;
  const now = Number(typeof live.now === 'function' ? live.now() : live.now ?? Date.now());
  return Number.isFinite(now) ? now - start : null;
}

// 그 시각에 보이는 장면 이름: 시작 전 'waiting' · 끝난 뒤 'result'(늦게 온 사람은 결과 한 장면만) · 그 사이는 marks 의 이름
export function sceneAt(tl, ms) {
  if (!(ms >= 0)) return 'waiting';
  if (!tl.joinOnly && ms >= tl.duration) return 'result';
  let name = tl.marks[0].name;
  for (const m of tl.marks) { if (m.t <= ms) name = m.name; else break; }
  return name;
}

// 모집 화면 글(2026-11-19): 남은 초 → 그림 글자·제목·아랫줄·채팅 안내. 마감이 지나면(0 이하) 모집은 끝났으니 "모집 중"·"!참전" 을 내리고 기다린다고만 한다
//  (봇이 꺼져 대본이 오지 않아도 틀린 말이 되지 않게 — "곧 싸움이 시작돼요" 도 쓰지 않는다). 마감을 모르면(null) 시간 줄만 없다.
export function joinWords(leftS) {
  if (leftS != null && leftS <= 0) return { icon: '⏳', title: '결과를 기다리는 중', sub: null, hint: null, open: false };
  return { icon: '⚔', title: '참전 모집 중', sub: leftS == null ? null : `남은 시간 ${leftS}초`, hint: '방송 채팅에 !참전', open: true };
}

// 땅 % 글 — 봇 boss.mjs landPct 와 같은 규칙(0.1% 보다 작으면 소수 둘째 자리까지)
const landPct = v => { const n = Math.abs(Number(v)) || 0, d = n > 0 && n < 0.1 ? 2 : 1; return `${(Math.round(n * 10 ** d) / 10 ** d).toLocaleString('ko-KR', { maximumFractionDigits: d })}%`; };
// 결과 장면의 땅 한 줄(봇 resultLines 와 같은 뜻). land: {addedPct,pct} | {lostPct,pct} | {capped:true} | {} | null(모름 → 줄 없음)
export function landLine(win, land) {
  if (!land || typeof land !== 'object') return '';
  const to = Number.isFinite(Number(land.pct)) ? ` → ${landPct(land.pct)}` : '';
  if (win) return Number(land.addedPct) > 0 ? `땅 +${landPct(land.addedPct)}${to}` : '';
  if (land.capped === true) return '오늘은 이미 한 번 져서 땅은 그대로예요';
  if (Number(land.lostPct) > 0) return `땅 −${landPct(land.lostPct)}${to}`;
  return '땅은 그대로예요';
}

export function buildTimeline(script, timing) {
  const T = { ...TIMING, ...(timing || {}) };
  const marks = [], steps = [];
  const mark = (t, name) => marks.push({ t, name });
  const step = (t, kind, o) => steps.push({ t, kind, ...o });

  // 1) 여는 장면: 보스가 떨어지고 → "보스 출현!" → 이름 · 단계
  const land = T.bossDropAt + T.bossDrop;
  let t = land + 150 + T.bossCaption + T.bossName;
  mark(0, 'opening'); step(0, 'opening', { dur: t, land });
  if (isJoinOnly(script)) { // 모집 중: 여기서 남은 시간 · 참전 수를 보여 주며 기다린다
    mark(t, 'join'); step(t, 'joinWait', {});
    return { duration: t, marks, steps, joinOnly: true, result: null, big: false, frontIdx: [], dealt: [], ko: [], hasLast: false, maxRounds: 0 };
  }

  const team = Array.isArray(script.team) ? script.team : [], n = team.length, big = n > 3;
  const okI = i => Number.isInteger(i) && i >= 0 && i < n;
  const events = unpackEvents(script.events).filter(e => e.kind === 'charge' || (e.kind === 'aoe' ? Array.isArray(e.hits) : okI(e.i)));
  for (const e of events) if (e.kind === 'aoe') e.hits = e.hits.filter(h => okI(h.i));
  const dealt = team.map(() => 0);
  for (const e of events) if (e.kind === 'hit') dealt[e.i] += e.dmg;
  const base = { joinOnly: false, big, dealt, maxRounds: Number(script.maxRounds) || 0 };

  if (!n) { // 아무도 참전하지 않음: 보스만 보이고 바로 결과
    t += T.endLead; mark(t, 'ending'); step(t, 'ending', { result: 'empty', dur: T.endEmpty });
    return { ...base, duration: t + T.endEmpty, marks, steps, result: 'empty', frontIdx: [], ko: [], hasLast: false };
  }

  // 앞줄: 3명까지는 그대로, 여럿이면 가장 많이 때린 셋(참전 차례대로 세움)
  const frontIdx = big ? team.map((m, i) => i).sort((a, b) => dealt[b] - dealt[a] || a - b).slice(0, 3).sort((a, b) => a - b) : team.map((m, i) => i);

  // 2) 들어오기(앞모습) → 3) 버프 → 돌아서기
  mark(t, 'join');
  for (const i of frontIdx) { step(t, 'present', { i, dur: T.present }); t += T.present; }
  if (big) { step(t, 'crowd', { n, dur: T.crowdJoin }); t += T.crowdJoin; }
  if (script.buff && script.buff.name) { mark(t, 'buff'); step(t, 'buff', { dur: T.buff }); t += T.buff; }
  mark(t, 'turn'); step(t, 'turn', { dur: T.turn }); t += T.turn;

  // 4) 싸움 — 길이가 목표 안에 들게 한 줄 길이·묶음을 정한다
  const win = script.win === true, maxR = base.maxRounds;
  const hitEvs = events.filter(e => e.kind === 'hit'), bossEvs = events.filter(e => e.kind === 'boss');
  const sorted = hitEvs.map(e => e.dmg).sort((a, b) => a - b), median = sorted.length ? sorted[sorted.length >> 1] : 0;
  const lastHit = hitEvs[hitEvs.length - 1];
  const roundsN = new Set(events.map(e => e.round)).size, lastR = events.length ? events[events.length - 1].round : 0;
  const hasLast = maxR > 1 && lastR >= maxR; // 마지막 라운드까지 간 판
  const koSet = new Set(bossEvs.filter(e => e.ko).map(e => e.i));
  for (const e of events) if (e.kind === 'aoe') for (const h of e.hits) if (h.ko) koSet.add(h.i);
  const result = win ? 'win' : team.some((m, i) => !koSet.has(i)) ? 'timeout' : 'wipe';
  const endDur = result === 'win' ? T.endWin : result === 'timeout' ? T.endTimeout : T.endLose;
  // 때리는 장면을 뺀 나머지 길이
  const fixed = t + roundsN * T.roundCue + (hasLast ? T.lastRoundCue - T.roundCue : 0)
    + events.filter(e => e.kind === 'charge').length * T.charge + events.filter(e => e.kind === 'aoe').length * T.aoe
    + bossEvs.reduce((s, e) => s + T.boss + (e.ko ? T.koExtra : 0), 0) + T.endLead + endDur;
  const t0 = t, m0 = marks.length, s0 = steps.length;

  // mode: {group:false, hit, imp} = 한 명씩 · {group:true, spotK, split} = 몰아치기(큰 장면 spotK 개 + 나머지는 한꺼번에)
  function lay(mode) {
    marks.length = m0; steps.length = s0; t = t0;
    mark(t, 'battle');
    let pending = [], round = 0;
    const flush = () => {
      const hits = pending; pending = [];
      if (!hits.length) return;
      if (!mode.group) { for (const ev of hits) { step(t, 'hit', { ev, dur: mode.hit, imp: mode.imp }); t += mode.hit; } return; }
      const fin = win && hits[hits.length - 1] === lastHit ? lastHit : null; // 끝내는 한 방은 늘 따로
      const pick = hits.filter(e => e !== fin && (e.eff > 1 || e.dmg >= T.bigHit * median)).sort((a, b) => b.dmg - a.dmg).slice(0, Math.max(0, mode.spotK - (fin ? 1 : 0)));
      const spots = hits.filter(e => pick.includes(e)), rest = hits.filter(e => e !== fin && !pick.includes(e));
      const half = mode.split && rest.length >= 8 ? Math.ceil(rest.length / 2) : rest.length;
      if (rest.length) { step(t, 'volley', { hits: rest.slice(0, half), dur: T.volley }); t += T.volley; }
      for (const ev of spots) { step(t, 'hit', { ev, dur: T.spot, imp: T.spotImpact, spot: true }); t += T.spot; }
      if (half < rest.length) { step(t, 'volley', { hits: rest.slice(half), dur: T.volley }); t += T.volley; }
      if (fin) { step(t, 'hit', { ev: fin, dur: T.hit, imp: T.hitImpact }); t += T.hit; }
    };
    for (const ev of events) {
      if (ev.round !== round) {
        flush(); round = ev.round;
        const last = maxR > 1 && round === maxR, dur = last ? T.lastRoundCue : T.roundCue;
        mark(t, `round${round}`); step(t, 'round', { n: round, last, dur }); t += dur;
      }
      if (ev.kind === 'hit') pending.push(ev);
      else if (ev.kind === 'boss') { flush(); const dur = T.boss + (ev.ko ? T.koExtra : 0); step(t, 'boss', { ev, dur }); t += dur; }
      else if (ev.kind === 'charge') { flush(); mark(t, 'charge'); step(t, 'charge', { dur: T.charge }); t += T.charge; } // 체력이 절반 아래로: 힘을 모으기 시작
      else if (ev.kind === 'aoe') { flush(); mark(t, 'aoe'); step(t, 'aoe', { ev, dur: T.aoe }); t += T.aoe; }          // 보스 차례: 광역기
    }
    flush();
    // 5) 끝
    t += T.endLead; mark(t, 'ending'); step(t, 'ending', { result, dur: endDur });
    return (t += endDur);
  }

  const modes = [];
  if (!big) { // 3명까지: 한 명씩. 길면 한 줄을 짧게(큰 장면 길이까지)
    const room = hitEvs.length ? Math.floor((T.maxTotal - fixed) / hitEvs.length) : T.hit;
    const hit = Math.max(Math.min(T.hit, T.spot), Math.min(T.hit, room)), k = T.hit > T.spot ? (hit - T.spot) / (T.hit - T.spot) : 1;
    modes.push({ group: false, hit, imp: Math.round(T.spotImpact + (T.hitImpact - T.spotImpact) * k) });
  }
  // 여럿: 한 구간에서 한 명씩 보여 줄 장면 수(견본 계산 그대로) → 그래도 한도를 넘으면 더 묶는다
  const spotK = Math.max(1, Math.min(4, Math.floor((T.maxTotal - fixed - roundsN * 2 * T.volley) / (Math.max(1, roundsN) * T.spot))));
  if (big) modes.push({ group: true, spotK, split: true });
  modes.push({ group: true, spotK: 1, split: true }, { group: true, spotK: 0, split: true }, { group: true, spotK: 0, split: false });
  let duration = 0;
  for (const mode of modes) { duration = lay(mode); if (duration <= T.hardMax) break; }

  return { ...base, duration, marks, steps, result, frontIdx, ko: [...koSet], hasLast };
}
