// 보스전 보기 서버(kiugi 함수 v4, 2026-11-18 — 봇 저장소 docs/superpowers/specs/2026-11-18-bossview-design.md "서버"):
//  먼치킨 본체(app/desktop/kiugi-fight.cjs)가 서명해 보내는 fight-appear · fight-join · fight · fight-land · fight-drop 과 사이트가 읽는 GET fights · fights/<id>.
//  메모리 store(tests/kiugi-world.mjs)·먼치킨과 같은 서명으로만 — 실제 서버에 닿지 않는다. 이름은 모두 지어낸 것.
//  먼치킨은 408·429 말고 4xx 를 받으면 그 판 올리기를 멈춘다 → 늦은 참전 수·다시 보낸 대본·지운 판의 땅은 2xx(무시·덮어쓰기)여야 한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as v from '../supabase/functions/kiugi/lib.ts';
import { world, signed, deviceKey, body, syl } from './kiugi-world.mjs';

const T = Date.parse('2026-12-02T12:00:00+09:00');
const LK = crypto.createHash('sha256').update('kg-fight:지어낸방송1').digest('hex').slice(0, 32);
const LK2 = crypto.createHash('sha256').update('kg-fight:지어낸방송2').digest('hex').slice(0, 32);
const BOSS = { type: 'fire', name: '불꽃 대왕', aoe: '분화', stage: 2 };
const MEMBER = (i, label = `${syl(i)}톨#먼치`) => ({ label, sp: 'water_01', type: 'water', name: '물방울', stage: 1, lv: 5 + i });
// FightScript v1(봇 app/src/bot/kiugi/fight-script.mjs buildFightScript 모양 — 사건은 짧은 배열)
const SCRIPT = (team = [MEMBER(0), MEMBER(1)], extra = {}) => ({
  v: 1, k: 3, appearAt: T, joinUntil: T + 65000, startAt: T + 65000, boss: BOSS, team,
  buff: { b: 2, name: '삼위일체', a: 1.34, h: 1.25, hero: false }, hp: 1000, left: 0, win: true, rounds: 2, maxRounds: 6, mvp: { i: 0, dealt: 700 },
  events: [['h', 1, 0, 300, 2, 1000, 700], ['c', 1, 700], ['a', 1, 700, [[0, 50, 1, 0], [1, 60, 1, 1]]], ['b', 1, 0, 40, 1, 0, 0, 700], ['h', 2, 0, 700, 2, 700, 0]],
  land: null, ...extra
});
const V3 = (people = [{ id: '밤톨#먼치', lead: 'water_01', monsters: [{ sp: 'water_01', stage: 1, lv: 5 }] }]) => ({ enabled: true, v: 3, season: 's2', character: { name: '먼치' }, people });

// 시험 세계 + 페이지를 올린 승인 기기 하나. send(action, payload, {skew}) — skew: 먼치킨 PC 시계가 서버보다 그만큼 빠름(서명 시각)
async function setup({ chance, page = true, fightCacheMs } = {}) {
  const w = world({ now: T - 61000, chance, fightCacheMs }), key = w.approve();
  let slug = null;
  if (page) { const up = await w.upload(key, V3()); assert.equal(up.status, 200); slug = up.json.slug; }
  const send = async (action, payload, { skew = 0, k = key } = {}) => body(await w.post(signed(k, payload, { at: w.clock.now + skew, action })));
  const list = async () => body(await w.get('fights'));
  const one = async (id) => body(await w.get('fights/' + id));
  return { w, key, slug, send, list, one };
}
const appear = (s, extra = {}, opts) => s.send('fight-appear', { liveKey: LK, k: 3, boss: BOSS, joinUntil: s.w.clock.now + 65000, ...extra }, opts);

test('쓰기 확인: 서명·승인·심사용·모르는 action · 키우기 페이지가 없는 기기는 409 "키우기 사이트에 먼저 올려 주세요"', async () => {
  const s = await setup();
  // 승인되지 않은 기기
  const stranger = deviceKey();
  let r = await s.send('fight-appear', { liveKey: LK, k: 3, boss: BOSS, joinUntil: s.w.clock.now }, { k: stranger });
  assert.equal(r.status, 403); assert.match(r.json.error, /승인/);
  // 심사용
  const review = deviceKey(); s.w.store.devices.set(review.id, { state: 'approved', review: true });
  r = await s.send('fight-appear', { liveKey: LK, k: 3, boss: BOSS, joinUntil: s.w.clock.now }, { k: review });
  assert.equal(r.status, 403); assert.match(r.json.error, /심사용/);
  // 서명이 틀림(payload 를 바꿈)
  const bad = signed(s.key, { liveKey: LK, k: 3, boss: BOSS, joinUntil: s.w.clock.now }, { at: s.w.clock.now, action: 'fight-appear' });
  bad.payload.k = 4;
  r = await body(await s.w.post(bad));
  assert.equal(r.status, 403); assert.match(r.json.error, /기기 확인/);
  // 다른 action 의 서명은 다른 action 으로 쓸 수 없다
  const other = signed(s.key, { liveKey: LK, k: 3 }, { at: s.w.clock.now, action: 'fight-drop' });
  other.action = 'fight-join';
  assert.equal((await body(await s.w.post(other))).status, 403);
  // 모르는 action · 시계가 2분 넘게 틀림
  assert.equal((await s.send('fight-boom', { liveKey: LK, k: 3 })).status, 400);
  assert.equal((await appear(s, {}, { skew: 120000 })).status, 400);
  // 같은 요청 번호 두 번
  const once = signed(s.key, { liveKey: LK, k: 3 }, { at: s.w.clock.now, action: 'fight-drop' });
  assert.equal((await body(await s.w.post(once))).status, 200);
  assert.equal((await body(await s.w.post(once))).status, 409);
  // 키우기 페이지를 올린 적 없는 승인 기기
  const fresh = await setup({ page: false });
  for (const [action, payload] of [['fight-appear', { liveKey: LK, k: 3, boss: BOSS, joinUntil: fresh.w.clock.now }], ['fight', { liveKey: LK, k: 3, script: SCRIPT() }], ['fight-join', { liveKey: LK, k: 3, joined: 1 }]]) {
    r = await fresh.send(action, payload);
    assert.equal(r.status, 409, action); assert.equal(r.json.error, '키우기 사이트에 먼저 올려 주세요.');
  }
  assert.equal(fresh.w.store.fights.size, 0);
});

test('흐름: 등장 → 참전 수 → 대본 → 땅 · 목록과 대본 · DJ 이름은 키우기 페이지에서 · 시작 시각은 서버 시계 · 기기 번호·방송 열쇠는 밖으로 안 나감', async () => {
  const s = await setup();
  let r = await s.list();
  assert.equal(r.status, 200); assert.deepEqual(r.json, { now: s.w.clock.now, fights: [] });
  assert.equal(r.headers.get('cache-control'), 'public, max-age=5');
  // 먼치킨 PC 시계가 서버보다 20초 빠르다: 마감 시각은 서버 시계로 고쳐 적는다
  const appearAt = s.w.clock.now;
  r = await s.send('fight-appear', { liveKey: LK, k: 3, boss: { ...BOSS, nickname: '달빛소녀' }, joinUntil: appearAt + 20000 + 65000 }, { skew: 20000 });
  assert.equal(r.status, 200); assert.equal(r.json.ok, true);
  const id = r.json.id;
  assert.match(id, v.FIGHT_ID);
  r = await s.list();
  assert.deepEqual(r.json.fights, [{ id, dj: { slug: s.slug, name: '먼치' }, boss: { type: 'fire', name: '불꽃 대왕', stage: 2 }, phase: 'join', joined: 0, appearAt, joinUntil: appearAt + 65000, startAt: null }]);
  // 모집 중 보기(대본은 아직 없음)
  r = await s.one(id);
  assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'public, max-age=5');
  assert.equal(r.json.fight.phase, 'join'); assert.equal(r.json.fight.script, null); assert.equal(r.json.fight.land, null);
  assert.deepEqual(r.json.fight.boss, { type: 'fire', name: '불꽃 대왕', stage: 2, aoe: '분화' }, '보는 화면은 광역기 이름도');
  // 참전 수
  s.w.clock.now += 10000;
  assert.equal((await s.send('fight-join', { liveKey: LK, k: 3, joined: 3 })).status, 200);
  assert.equal((await s.list()).json.fights[0].joined, 3);
  // 대본(시작 시각은 서버가 받은 때) — 참전 수는 대본의 참전 줄 수로
  s.w.clock.now += 50000;
  const startAt = s.w.clock.now;
  const script = SCRIPT([{ ...MEMBER(0), nickname: '달빛소녀', tag: 'moon_01' }, MEMBER(1, null)], { dj: { slug: 'zzzzzzzz', name: '가짜이름' }, id: 'zzzzzzzzzzzz' });
  r = await s.send('fight', { liveKey: LK, k: 3, script }, { skew: 20000 });
  assert.equal(r.status, 200); assert.equal(r.json.id, id, '같은 판(같은 id)');
  r = await s.list();
  assert.deepEqual(r.json.fights, [{ id, dj: { slug: s.slug, name: '먼치' }, boss: { type: 'fire', name: '불꽃 대왕', stage: 2 }, phase: 'fight', joined: 2, appearAt, joinUntil: appearAt + 65000, startAt }]);
  r = await s.one(id);
  const f = r.json.fight;
  assert.equal(r.json.now, s.w.clock.now);
  assert.equal(f.phase, 'fight'); assert.equal(f.startAt, startAt); assert.equal(f.land, null);
  assert.deepEqual(f.script.team, [MEMBER(0), MEMBER(1, null)], '참전 줄은 아이디·몬스터만(닉네임·고유닉은 버린다)');
  assert.deepEqual(f.script.events, SCRIPT().events);
  assert.equal(f.script.v, 1); assert.equal(f.script.id, id); assert.deepEqual(f.script.dj, { slug: s.slug, name: '먼치' }); assert.equal(f.script.k, 3);
  assert.equal(f.script.startAt, startAt, '대본의 시각도 서버 시계(먼치킨이 보낸 시각이 아님)');
  assert.equal(f.script.appearAt, appearAt); assert.equal(f.script.joinUntil, appearAt + 65000);
  assert.deepEqual(f.script.boss, BOSS); assert.deepEqual(f.script.buff, SCRIPT().buff); assert.deepEqual(f.script.mvp, { i: 0, dealt: 700 });
  assert.equal(f.script.win, true); assert.equal(f.script.rounds, 2); assert.equal(f.script.maxRounds, 6);
  // 땅
  s.w.clock.now += 30000;
  assert.equal((await s.send('fight-land', { liveKey: LK, k: 3, land: { addedPct: 1.25, pct: 12.5 } })).status, 200);
  r = await s.one(id);
  assert.deepEqual(r.json.fight.land, { addedPct: 1.25, pct: 12.5 });
  assert.deepEqual(r.json.fight.script.land, { addedPct: 1.25, pct: 12.5 }, '대본 안 땅도 같은 값');
  const text = JSON.stringify([await s.list(), r].map((x) => x.json));
  assert.doesNotMatch(text, /달빛소녀|moon_01|nickname|"tag"|device|live_?key|expires|가짜이름|zzzz/i, '보낸 dj·id 는 믿지 않는다(서버가 채움)');
  assert.doesNotMatch(text, new RegExp(LK), '방송 열쇠는 내보내지 않는다');
  assert.doesNotMatch(text, new RegExp(s.key.id), '기기 번호는 내보내지 않는다');
});

test('땅 모양: {addedPct,pct} · {lostPct,pct} · {capped:true} · {} 만 받는다(pct 가 null 이어도) · 아니면 400', async () => {
  const s = await setup();
  const { json: { id } } = await s.send('fight', { liveKey: LK, k: 3, script: SCRIPT() });
  for (const land of [{ lostPct: 0.5, pct: 3 }, { capped: true }, {}, { addedPct: 2, pct: null }, { addedPct: 2, pct: 40, extra: '버림' }]) {
    const r = await s.send('fight-land', { liveKey: LK, k: 3, land });
    assert.equal(r.status, 200, JSON.stringify(land));
    const { extra, ...want } = land;
    assert.deepEqual((await s.one(id)).json.fight.land, want);
  }
  for (const land of [null, 'win', [1], { addedPct: 'x', pct: 1 }, { addedPct: -1, pct: 1 }, { lostPct: 101, pct: 1 }, { addedPct: 1, pct: 'x' }, { addedPct: 1 }, { capped: 'yes' }]) {
    assert.equal((await s.send('fight-land', { liveKey: LK, k: 3, land })).status, 400, JSON.stringify(land));
  }
});

test('이름(label): 사이트 아이디 규칙(FULL_ID)에 맞지 않는 글은 그 이름만 null 로 바꾸고 판은 받는다(200) · 맞는 이름은 NFC 로 그대로', async () => {
  const s = await setup();
  // 봇 SITE_LABEL(^[가-힣]{1,6}#.+$)은 통과하지만 FULL_ID(뒤 이름 한글·영문·숫자 1~8자)에는 안 맞는 것 + 아이디 모양이 아닌 글
  const loose = ['밤톨#먼치#먼치', '밤톨#가나다라마바사아자', '밤톨#먼 치', '밤톨#🎃', '달빛소녀', 'moon_01', 'Bam#먼치', '밤톨#', '밤톨 #먼치', '가나다라마바사#먼치', ''];
  for (const x of loose.slice(0, 4)) { assert.match(x, /^[가-힣]{1,6}#.+$/, '봇 규칙은 통과'); assert.doesNotMatch(x, v.FULL_ID, '사이트 규칙은 안 맞음'); }
  for (const [i, label] of loose.entries()) {
    const r = await s.send('fight', { liveKey: LK, k: 10 + i, script: SCRIPT([MEMBER(0), MEMBER(1, label)]) });
    assert.equal(r.status, 200, JSON.stringify(label));
    const team = (await s.one(r.json.id)).json.fight.script.team;
    assert.equal(team[1].label, null, JSON.stringify(label));
    assert.equal(team[0].label, MEMBER(0).label, '맞는 이름은 그대로');
  }
  assert.equal(s.w.store.fights.size, loose.length);
  const r = await s.send('fight', { liveKey: LK2, k: 1, script: SCRIPT([MEMBER(0, '밤톨#먼치'.normalize('NFD')), MEMBER(1, null)]) });
  assert.equal(r.status, 200);
  assert.deepEqual((await s.one(r.json.id)).json.fight.script.team.map((m) => m.label), ['밤톨#먼치', null], '풀어 쓴 한글은 NFC 로');
  // 앞뒤 공백은 뗀다(키우기 페이지 아이디 listenerId 와 같은 정리 — NFC 뒤 trim)
  const t = await s.send('fight', { liveKey: LK2, k: 2, script: SCRIPT([MEMBER(0, ' 밤톨#먼치 '), MEMBER(1, '\t사탕요정#먼치'.normalize('NFD'))]) });
  assert.equal(t.status, 200);
  assert.deepEqual((await s.one(t.json.id)).json.fight.script.team.map((m) => m.label), ['밤톨#먼치', '사탕요정#먼치'], '앞뒤 공백을 떼고 아이디로');
});

test('모양 검사: 글이 아닌 label 은 400 · 방송 열쇠(16진 32자)·칸·보스·참전 수·대본 모양이 틀리면 400 · 대본이 256KB 를 넘으면 413', async () => {
  const s = await setup();
  for (const label of [12, true, ['밤톨#먼치'], { id: '밤톨#먼치' }]) {
    const r = await s.send('fight', { liveKey: LK, k: 3, script: SCRIPT([MEMBER(0), MEMBER(1, label)]) });
    assert.equal(r.status, 400, JSON.stringify(label)); assert.match(r.json.error, /아이디/);
  }
  assert.equal(s.w.store.fights.size, 0, '거절한 대본은 적지 않는다');
  const fresh = () => s.w.store.hits.clear(); // 한도(한 시간 60건)는 따로 시험한다 — 여기서는 묶음마다 비운다
  fresh();
  for (const liveKey of ['', 'A'.repeat(32), 'a'.repeat(31), 'a'.repeat(33), 'g'.repeat(32), 12, null]) {
    assert.equal((await s.send('fight-drop', { liveKey, k: 3 })).status, 400, String(liveKey));
  }
  for (const k of [-1, 1.5, '3', null, 2 ** 31]) assert.equal((await s.send('fight-drop', { liveKey: LK, k })).status, 400, String(k));
  for (const boss of [null, { ...BOSS, type: 'Fire' }, { ...BOSS, name: '' }, { ...BOSS, name: '가'.repeat(21) }, { ...BOSS, aoe: 3 }, { ...BOSS, stage: 0 }, { ...BOSS, stage: 1.5 }]) {
    assert.equal((await appear(s, { boss })).status, 400, JSON.stringify(boss));
  }
  assert.equal((await appear(s, { joinUntil: 'soon' })).status, 400);
  for (const joined of [-1, 1.5, '3', null]) assert.equal((await s.send('fight-join', { liveKey: LK, k: 3, joined })).status, 400, String(joined));
  fresh();
  const bads = [
    SCRIPT(undefined, { v: 2 }), SCRIPT(undefined, { team: 'x' }), SCRIPT(undefined, { boss: { ...BOSS, type: '' } }),
    SCRIPT([{ ...MEMBER(0), sp: 'Water_01' }, MEMBER(1)]), SCRIPT([{ ...MEMBER(0), stage: 4 }, MEMBER(1)]), SCRIPT([{ ...MEMBER(0), lv: 0 }, MEMBER(1)]), SCRIPT([{ ...MEMBER(0), name: '' }, MEMBER(1)]),
    SCRIPT([{ ...MEMBER(0), type: 'Fire!' }, MEMBER(1)]), SCRIPT([null, MEMBER(1)]),
    SCRIPT(undefined, { hp: -1 }), SCRIPT(undefined, { win: 'yes' }), SCRIPT(undefined, { rounds: 7 }), SCRIPT(undefined, { maxRounds: 0 }),
    SCRIPT(undefined, { mvp: { i: 2, dealt: 1 } }), SCRIPT(undefined, { buff: { b: 2, name: '삼위일체', a: 'x', h: 1 } }),
    SCRIPT(undefined, { events: [['h', 1, 2, 300, 2, 1000, 700]] }), SCRIPT(undefined, { events: [['h', 1, 0, 300, 3, 1000, 700]] }),
    SCRIPT(undefined, { events: [['h', 0, 0, 300, 2, 1000, 700]] }), SCRIPT(undefined, { events: [['z', 1]] }), SCRIPT(undefined, { events: [['c', 1]] }),
    SCRIPT(undefined, { events: [['a', 1, 700, [[0, 50, 1]]]] }), SCRIPT(undefined, { events: [['b', 1, 0, 40, 1, 2, 0, 700]] }), SCRIPT(undefined, { events: 'x' }),
    SCRIPT(undefined, { land: { addedPct: 'x' } }), null, 'script'
  ];
  for (const script of bads) assert.equal((await s.send('fight', { liveKey: LK, k: 3, script })).status, 400, JSON.stringify(script)?.slice(0, 80));
  assert.equal(s.w.store.fights.size, 0);
  fresh();
  // 크기: 대본 JSON 이 256KB(봇 fight-script.mjs FIGHT_MAX_BYTES 와 같은 셈)를 넘으면 413 · 딱 그 아래는 받는다
  assert.equal(v.FIGHT_MAX_BYTES, 256 * 1024);
  const fill = (n) => Array.from({ length: n }, () => ['c', 1, 700]);
  const sized = (bytes) => { const base = SCRIPT(undefined, { events: [] }), one = Buffer.byteLength(JSON.stringify(['c', 1, 700])) + 1; return SCRIPT(undefined, { events: fill(Math.floor((bytes - Buffer.byteLength(JSON.stringify(base))) / one)) }); };
  const big = sized(v.FIGHT_MAX_BYTES + 2000);
  assert.ok(Buffer.byteLength(JSON.stringify(big)) > v.FIGHT_MAX_BYTES);
  let r = await s.send('fight', { liveKey: LK, k: 3, script: big });
  assert.equal(r.status, 413); assert.match(r.json.error, /커요/);
  const fit = sized(v.FIGHT_MAX_BYTES - 50);
  assert.ok(Buffer.byteLength(JSON.stringify(fit)) <= v.FIGHT_MAX_BYTES);
  r = await s.send('fight', { liveKey: LK, k: 3, script: fit });
  assert.equal(r.status, 200);
  // 참전 0명 대본(사건 없음 · mvp 없음 · 버프 없음)
  r = await s.send('fight', { liveKey: LK2, k: 0, script: SCRIPT([], { events: [], mvp: null, buff: null, win: false, rounds: 0, hp: 0, left: 0 }) });
  assert.equal(r.status, 200);
  assert.deepEqual((await s.one(r.json.id)).json.fight.script.team, []);
});

test('같은 판을 다시 올리면 덮어쓴다(목록 1개 · 시작 시각은 처음 그대로) · 등장 없이 온 대본도 받는다 · 다른 칸·다른 방송은 다른 판', async () => {
  const s = await setup();
  // 등장 없이 대본부터(등장은 있었던 것으로)
  const startAt = s.w.clock.now;
  let r = await s.send('fight', { liveKey: LK, k: 3, script: SCRIPT() });
  assert.equal(r.status, 200);
  const id = r.json.id;
  let list = (await s.list()).json.fights;
  assert.equal(list.length, 1); assert.equal(list[0].phase, 'fight'); assert.equal(list[0].startAt, startAt); assert.equal(list[0].joined, 2);
  // 같은 판을 다시(대본이 바뀜) — 덮어쓰지만 시작 시각은 그대로
  s.w.clock.now += 20000;
  r = await s.send('fight', { liveKey: LK, k: 3, script: SCRIPT([MEMBER(0)], { win: false, mvp: { i: 0, dealt: 5 }, events: [['h', 1, 0, 5, 1, 1000, 995]] }) });
  assert.equal(r.status, 200); assert.equal(r.json.id, id);
  list = (await s.list()).json.fights;
  assert.equal(list.length, 1); assert.equal(list[0].startAt, startAt, '시작 시각은 처음 그대로'); assert.equal(list[0].joined, 1);
  const f = (await s.one(id)).json.fight;
  assert.equal(f.script.win, false); assert.deepEqual(f.script.team, [MEMBER(0)]);
  // 땅이 온 뒤 대본을 다시 올려도 땅은 남는다
  await s.send('fight-land', { liveKey: LK, k: 3, land: { capped: true } });
  await s.send('fight', { liveKey: LK, k: 3, script: SCRIPT() });
  assert.deepEqual((await s.one(id)).json.fight.land, { capped: true });
  // 싸우는 중에 늦게 온 등장 · 참전 수는 무시(200)
  assert.equal((await appear(s)).status, 200);
  assert.equal((await s.send('fight-join', { liveKey: LK, k: 3, joined: 9 })).status, 200);
  list = (await s.list()).json.fights;
  assert.equal(list.length, 1); assert.equal(list[0].phase, 'fight'); assert.equal(list[0].joined, 2);
  // 등장을 두 번(봇을 다시 켬): 판은 하나
  await appear(s, { liveKey: LK2 });
  await appear(s, { liveKey: LK2, boss: { ...BOSS, name: '불꽃 대왕 둘' } });
  list = (await s.list()).json.fights;
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((x) => x.boss.name).sort(), ['불꽃 대왕', '불꽃 대왕 둘']);
  // 다른 칸은 다른 판
  await appear(s, { liveKey: LK2, k: 4 });
  assert.equal((await s.list()).json.fights.length, 3);
  assert.equal(s.w.store.fights.size, 3);
});

test('늦게 온 참전 수(마감 뒤)·대본 뒤 참전 수는 무시(200) · 지운 판·없는 판의 참전 수·땅·대본도 200(아무것도 안 함)', async () => {
  const s = await setup();
  const { json: { id } } = await appear(s, { joinUntil: s.w.clock.now + 65000 });
  s.w.clock.now += 66000;
  let r = await s.send('fight-join', { liveKey: LK, k: 3, joined: 4 });
  assert.equal(r.status, 200); assert.equal(r.json.ignored, true);
  assert.equal((await s.list()).json.fights[0].joined, 0, '마감 뒤 참전 수는 무시');
  // 마감 뒤 대본은 받는다(마감 순간에 계산해 보낸다)
  assert.equal((await s.send('fight', { liveKey: LK, k: 3, script: SCRIPT() })).status, 200);
  assert.equal((await s.list()).json.fights[0].phase, 'fight');
  // 없는 판
  for (const [action, payload] of [['fight-join', { liveKey: LK2, k: 1, joined: 2 }], ['fight-land', { liveKey: LK2, k: 1, land: {} }], ['fight-drop', { liveKey: LK2, k: 1 }]]) {
    r = await s.send(action, payload);
    assert.equal(r.status, 200, action); assert.equal(r.json.ignored, true, action);
  }
  assert.equal(s.w.store.fights.size, 1, '없는 판의 참전 수·땅·지우기는 줄을 만들지 않는다');
  // 지우기(사이트 올리기를 끔): 목록·보기에서 빠지고, 그 판은 다시 오지 않는다
  r = await s.send('fight-drop', { liveKey: LK, k: 3 });
  assert.equal(r.status, 200);
  assert.deepEqual((await s.list()).json.fights, []);
  r = await s.one(id);
  assert.equal(r.status, 404); assert.equal(r.json.error, '끝났거나 없는 보스전이에요.');
  for (const [action, payload] of [['fight-join', { liveKey: LK, k: 3, joined: 2 }], ['fight-land', { liveKey: LK, k: 3, land: { capped: true } }], ['fight', { liveKey: LK, k: 3, script: SCRIPT() }], ['fight-appear', { liveKey: LK, k: 3, boss: BOSS, joinUntil: s.w.clock.now }], ['fight-drop', { liveKey: LK, k: 3 }]]) {
    r = await s.send(action, payload);
    assert.equal(r.status, 200, action); assert.equal(r.json.ignored, true, action);
  }
  assert.deepEqual((await s.list()).json.fights, []);
  assert.equal((await s.one(id)).status, 404);
  const row = [...s.w.store.fights.values()][0];
  assert.equal(row.phase, 'drop'); assert.equal(row.script, null, '지운 판의 대본은 비운다');
});

test('끝난 판(now > end_at = 시작 + 90초)은 목록에 없고, 대본 읽기는 expires(끝 + 10분)까지 · 대본이 안 온 판은 등장 + 15분까지 · 지난 줄은 1% 로 지운다', async () => {
  const s = await setup();
  const startAt = s.w.clock.now;
  const { json: { id } } = await s.send('fight', { liveKey: LK, k: 3, script: SCRIPT() });
  s.w.clock.now = startAt + 90000;
  assert.equal((await s.list()).json.fights.length, 1, '끝 순간까지는 목록에');
  s.w.clock.now = startAt + 90001;
  assert.deepEqual((await s.list()).json.fights, [], '끝나면 목록에서 빠진다');
  let r = await s.one(id);
  assert.equal(r.status, 200, '늦게 온 사람은 결과 한 장면을 볼 수 있다'); assert.equal(r.json.fight.startAt, startAt);
  s.w.clock.now = startAt + 90000 + 600000 - 1;
  assert.equal((await s.one(id)).status, 200);
  s.w.clock.now = startAt + 90000 + 600000 + 1;
  assert.equal((await s.one(id)).status, 404, 'expires 가 지나면 없다(지우기 전이어도)');
  // 대본이 끝내 오지 않은 모집 판(봇이 꺼짐): 목록은 마감 + 90초까지(아래 따로 시험), 보기·줄은 등장 + 15분까지
  const at = s.w.clock.now;
  const { json: { id: id2 } } = await appear(s, { liveKey: LK2 });
  s.w.clock.now = at + 65000 + v.FIGHT_JOIN_GRACE_MS + 1;
  assert.deepEqual((await s.list()).json.fights, [], '마감 + 90초가 지나면 목록에 없다');
  s.w.clock.now = at + 15 * 60000 - 1;
  assert.equal((await s.one(id2)).status, 200, '보기는 등장 + 15분 직전까지');
  s.w.clock.now = at + 15 * 60000 + 1;
  assert.deepEqual((await s.list()).json.fights, []);
  assert.equal((await s.one(id2)).status, 404);
  // 지난 판에 늦게 온 참전 수·땅은 무시, 대본은 새 판으로
  assert.equal((await s.send('fight-join', { liveKey: LK2, k: 3, joined: 3 })).json.ignored, true);
  assert.equal((await s.send('fight-land', { liveKey: LK2, k: 3, land: {} })).json.ignored, true);
  r = await s.send('fight', { liveKey: LK2, k: 3, script: SCRIPT() });
  assert.equal(r.status, 200); assert.notEqual(r.json.id, id2, '지난 줄을 새 판으로 바꾼다');
  assert.equal((await s.list()).json.fights.length, 1);
  // 1%: 요청이 올 때 chance() < 0.01 이면 expires 지난 줄을 지운다(시험 세계는 0.5 라 지우지 않았다)
  assert.equal(s.w.store.fights.size, 2);
  const c = await setup({ chance: () => 0 });
  await c.send('fight', { liveKey: LK, k: 3, script: SCRIPT() });
  c.w.clock.now += 90000 + 600000 + 1;
  await appear(c, { liveKey: LK2 });
  assert.ok(c.w.store.calls.includes('cleanFights'));
  assert.equal(c.w.store.fights.size, 1, '지난 줄은 지우고 새 판만 남는다');
});

test('보이는 것: 키우기 페이지를 닫았거나(올리기 끔) 기기가 막히면 목록·보기에서 빠진다 · DJ 이름은 지금 페이지 이름 · 없는 id 는 404', async () => {
  const s = await setup();
  const { json: { id } } = await s.send('fight', { liveKey: LK, k: 3, script: SCRIPT() });
  assert.equal((await s.list()).json.fights.length, 1);
  // 페이지 이름이 바뀌면 목록의 이름도
  s.w.store.pages.get(s.slug).name = '쿠키';
  assert.equal((await s.list()).json.fights[0].dj.name, '쿠키');
  s.w.store.pages.get(s.slug).name = '먼치';
  // 페이지를 닫음(키우기 사이트에 올리기 끔)
  const off = await s.w.upload(s.key, { enabled: false });
  assert.equal(off.status, 200);
  s.w.clock.now -= 61000; // upload 가 시계를 넘긴 만큼 되돌린다(아직 싸우는 중)
  assert.deepEqual((await s.list()).json.fights, []);
  assert.equal((await s.one(id)).status, 404);
  s.w.clock.now += 61000;
  await s.w.upload(s.key, V3());
  s.w.clock.now -= 122000;
  assert.equal((await s.list()).json.fights.length, 1, '다시 켜면 보인다');
  // 기기를 막음
  s.w.store.devices.set(s.key.id, { state: 'blocked', review: false });
  assert.deepEqual((await s.list()).json.fights, []);
  assert.equal((await s.one(id)).status, 404);
  // 모양이 틀린 id · 없는 id
  for (const bad of ['nope', 'ABCDEFGHJKMN', 'abcdefghjkmn', '../fights']) assert.equal((await s.one(encodeURIComponent(bad))).status, 404, bad);
});

test('한도: 기기당 한 시간에 60건 · 넘으면 429 · 다른 기기는 따로', async () => {
  const s = await setup();
  for (let i = 0; i < 60; i++) {
    const r = await s.send('fight-join', { liveKey: LK, k: 3, joined: i });
    assert.equal(r.status, 200, String(i));
  }
  const r = await s.send('fight-join', { liveKey: LK, k: 3, joined: 61 });
  assert.equal(r.status, 429); assert.match(r.json.error, /잠시 뒤/);
  // 다른 기기(페이지 있음)는 따로 센다
  const other = s.w.approve();
  const up = await s.w.upload(other, { enabled: true, v: 3, season: 's2', character: { name: '쿠키' }, people: [] });
  assert.equal(up.status, 200);
  assert.equal((await s.send('fight-join', { liveKey: LK, k: 3, joined: 1 }, { k: other })).status, 200);
  // 한 시간이 지나면 다시
  s.w.clock.now += 3600000;
  assert.equal((await s.send('fight-join', { liveKey: LK, k: 3, joined: 1 })).status, 200);
});

test('그사이 다른 요청이 줄을 바꾸면(동시에) 다시 읽고 정한다 — 늦게 끝난 참전 수가 대본을 덮지 않는다', async () => {
  const s = await setup();
  const { json: { id } } = await appear(s);
  // 참전 수 요청이 줄을 읽은 뒤, 적기 전에 대본 요청이 먼저 적은 것처럼
  s.w.store.beforeFightUpdate = () => {
    const row = s.w.store.fights.get(id);
    Object.assign(row, { phase: 'fight', updated: row.updated + 1, joined: 2, script: { v: 1, marker: '먼저 온 대본' }, start_at: s.w.clock.now, end_at: s.w.clock.now + 90000, expires: s.w.clock.now + 690000 });
  };
  const r = await s.send('fight-join', { liveKey: LK, k: 3, joined: 5 });
  assert.equal(r.status, 200); assert.equal(r.json.ignored, true, '다시 읽으니 싸우는 중 — 참전 수는 무시');
  const row = s.w.store.fights.get(id);
  assert.equal(row.phase, 'fight'); assert.equal(row.joined, 2); assert.equal(row.script.marker, '먼저 온 대본');
});

test('모집 중 판은 마감(join_until) + 90초까지만 목록에 — 봇이 멈춰 대본이 안 와도 목록에 14분 남지 않는다 · 보기는 expires 까지 · 늦은 대본이 오면 다시 목록에', async () => {
  const s = await setup();
  const at = s.w.clock.now;
  const { json: { id } } = await appear(s, { joinUntil: at + 65000 });
  assert.equal(v.FIGHT_JOIN_GRACE_MS, 90000);
  s.w.clock.now = at + 65000 + 90000;
  assert.equal((await s.list()).json.fights.length, 1, '마감 + 90초까지는 목록에');
  s.w.clock.now = at + 65000 + 90001;
  assert.deepEqual((await s.list()).json.fights, [], '그 뒤로는 목록에서 빠진다');
  let r = await s.one(id);
  assert.equal(r.status, 200, '보기는 expires(등장 + 15분)까지 — 오래된 모집을 어떻게 보일지는 사이트가 정한다');
  assert.equal(r.json.fight.phase, 'join');
  // 줄은 남아 있어 늦게 온 대본이 그 판에 들어가고 다시 목록에
  const late = s.w.clock.now;
  r = await s.send('fight', { liveKey: LK, k: 3, script: SCRIPT() });
  assert.equal(r.status, 200); assert.equal(r.json.id, id, '같은 판');
  const list = (await s.list()).json.fights;
  assert.equal(list.length, 1); assert.equal(list[0].phase, 'fight'); assert.equal(list[0].startAt, late);
  // 등장 + 15분이 지나면 보기도 없다
  const s2 = await setup();
  const { json: { id: id2 } } = await appear(s2, { joinUntil: s2.w.clock.now + 65000 });
  s2.w.clock.now += 15 * 60000 + 1;
  assert.equal((await s2.one(id2)).status, 404);
});

test('"메인에 보이기"를 끈 DJ(main=false)의 판은 목록에서 빠진다 · 보기(fights/<id>)는 page?slug= 처럼 열린다', async () => {
  const s = await setup();
  const { json: { id } } = await s.send('fight', { liveKey: LK, k: 3, script: SCRIPT() });
  assert.equal((await s.list()).json.fights.length, 1);
  const back = s.w.clock.now;
  assert.equal((await s.w.upload(s.key, { ...V3(), main: false })).status, 200);
  s.w.clock.now = back; // upload 가 넘긴 시계를 되돌린다(아직 싸우는 중)
  assert.equal(s.w.store.pages.get(s.slug).main, false);
  assert.deepEqual((await s.list()).json.fights, [], '목록에서 빠진다');
  const r = await s.one(id);
  assert.equal(r.status, 200, '보기는 열린다'); assert.equal(r.json.fight.dj.slug, s.slug);
  assert.equal((await s.w.upload(s.key, V3())).status, 200);
  s.w.clock.now = back;
  assert.equal((await s.list()).json.fights.length, 1, '다시 켜면 목록에');
});

test('같은 판 대본을 다시 받아도 끝(end_at)·expires 는 처음 그대로 — 목록은 처음 시작 + 90001 에 빠지고 보기는 처음 끝 + 10분까지', async () => {
  const s = await setup();
  const start = s.w.clock.now;
  const { json: { id } } = await s.send('fight', { liveKey: LK, k: 3, script: SCRIPT() });
  s.w.clock.now = start + 60000;
  assert.equal((await s.send('fight', { liveKey: LK, k: 3, script: SCRIPT([MEMBER(0)], { mvp: { i: 0, dealt: 5 }, events: [] }) })).status, 200);
  s.w.clock.now = start + 90000;
  assert.equal((await s.list()).json.fights.length, 1);
  s.w.clock.now = start + 90001;
  assert.deepEqual((await s.list()).json.fights, [], '처음 시작 + 90초 뒤 빠진다(다시 받은 때 + 90초가 아님)');
  s.w.clock.now = start + 90000 + 600000 - 1;
  assert.equal((await s.one(id)).status, 200);
  s.w.clock.now = start + 90000 + 600000 + 1;
  assert.equal((await s.one(id)).status, 404, '처음 끝 + 10분이 지나면 없다');
});

test('GET fights?slug=<DJ 주소>(채팅 생중계 링크 /b/<주소> 용): 그 DJ 의 판만 · "메인에 보이기"를 꺼도(main=false) 나온다 · 목록과 같은 모양 · 끝나면 빠진다 · 이상한 주소는 404', async () => {
  const s = await setup();
  // 같은 세계에 DJ 한 명 더(지어낸 이름)
  const key2 = s.w.approve();
  const up2 = await s.w.upload(key2, { enabled: true, v: 3, season: 's2', character: { name: '쿠키' }, people: [{ id: '밤톨#쿠키', lead: 'fire_01', monsters: [{ sp: 'fire_01', stage: 1, lv: 3 }] }] });
  assert.equal(up2.status, 200);
  const slug2 = up2.json.slug;
  const start = s.w.clock.now;
  const { json: { id } } = await s.send('fight', { liveKey: LK, k: 3, script: SCRIPT() });
  const { json: { id: id2 } } = await s.send('fight-appear', { liveKey: LK2, k: 1, boss: BOSS, joinUntil: s.w.clock.now + 65000 }, { k: key2 });
  const of = async (slug) => body(await s.w.get('fights?slug=' + slug));
  assert.equal((await s.list()).json.fights.length, 2);
  const a = await of(s.slug);
  assert.equal(a.status, 200);
  assert.deepEqual(a.json.fights.map((f) => f.id), [id], '그 DJ 의 판만');
  assert.equal(a.json.now, s.w.clock.now);
  assert.deepEqual(a.json.fights[0], (await s.list()).json.fights.find((f) => f.id === id), '목록 한 칸과 같은 모양');
  assert.deepEqual(Object.keys(a.json.fights[0]).sort(), ['appearAt', 'boss', 'dj', 'id', 'joinUntil', 'joined', 'phase', 'startAt']);
  assert.match(a.headers.get('cache-control') || '', /max-age=5/);
  const b = await of(slug2);
  assert.deepEqual(b.json.fights.map((f) => [f.id, f.phase, f.dj.slug, f.dj.name]), [[id2, 'join', slug2, '쿠키']]);
  // 메인에 보이기를 끈 DJ: 전체 목록에서는 빠지고, 자기 주소로는 나온다
  assert.equal((await s.w.upload(s.key, { ...V3(), main: false })).status, 200);
  s.w.clock.now = start;
  assert.deepEqual((await s.list()).json.fights.map((f) => f.id), [id2], '전체 목록에서는 빠진다');
  assert.deepEqual((await of(s.slug)).json.fights.map((f) => f.id), [id], '자기 주소로는 나온다');
  // 판이 없는 DJ · 끝난 판
  s.w.clock.now = start + 90001;
  assert.deepEqual((await of(s.slug)).json.fights, [], '끝나면(시작 + 90초) 빠진다');
  // 페이지를 닫으면(올리기 끔) 안 보인다
  s.w.clock.now = start;
  s.w.store.pages.get(s.slug).updated = null;
  assert.deepEqual((await of(s.slug)).json.fights, []);
  // 이상한 주소
  for (const bad of ['', 'ABC', 'aaaaaaa1', '../x']) assert.equal((await s.w.get('fights?slug=' + encodeURIComponent(bad))).status, 404, bad);
  // 기기 번호·방송 열쇠는 내보내지 않는다
  assert.doesNotMatch(JSON.stringify(b.json), new RegExp(`${key2.id}|${LK2}`));
});

// 2026-11-19 마지막 점검 I3: 읽기(GET fights · fights/<id>)도 다른 읽기처럼 잠깐 기억하고(함수 안 — 3초) IP 한도를 둔다
//  (키우기.com 첫 화면 띠가 15초마다 · /b 기다림 화면이 3초마다 묻는다 — 보는 사람이 많아도 데이터베이스는 3초에 한 번)
test('읽기 기억(3초): 같은 목록·같은 판은 3초 안에 데이터베이스를 다시 묻지 않는다 · now 는 늘 지금 · 주소(slug)·판마다 따로 · 3초가 지나면 새로 · 없는 판(404)은 기억하지 않는다', async () => {
  assert.equal(v.FIGHT_READ_MS, 3000);
  const s = await setup({ fightCacheMs: v.FIGHT_READ_MS });
  const asked = { list: 0, one: 0 }, { liveFights, fightById } = s.w.store;
  s.w.store.liveFights = (...a) => { asked.list++; return liveFights(...a); };
  s.w.store.fightById = (...a) => { asked.one++; return fightById(...a); };
  const of = async (slug) => body(await s.w.get('fights?slug=' + slug));
  const t0 = s.w.clock.now;
  assert.deepEqual((await s.list()).json, { now: t0, fights: [] }); assert.equal(asked.list, 1);
  assert.deepEqual((await of(s.slug)).json, { now: t0, fights: [] }); assert.equal(asked.list, 2, '주소마다 따로 기억');
  // 보스 등장 → 3초 안에는 예전 답(데이터베이스를 묻지 않는다) · now 는 지금
  const { json: { id } } = await appear(s);
  s.w.clock.now = t0 + 2999;
  let r = await s.list(); assert.deepEqual(r.json, { now: t0 + 2999, fights: [] }); assert.equal(asked.list, 2);
  r = await of(s.slug); assert.deepEqual(r.json, { now: t0 + 2999, fights: [] }); assert.equal(asked.list, 2);
  // 3초가 지나면 새로
  s.w.clock.now = t0 + 3000;
  r = await s.list(); assert.deepEqual(r.json.fights.map((f) => f.id), [id]); assert.equal(r.json.now, t0 + 3000); assert.equal(asked.list, 3);
  r = await of(s.slug); assert.deepEqual(r.json.fights.map((f) => f.id), [id]); assert.equal(asked.list, 4);
  // 한 판: 3초 안에는 참전 수가 예전 그대로 · now 는 지금 · 3초 뒤 새로
  const t1 = s.w.clock.now;
  r = await s.one(id); assert.equal(r.status, 200); assert.equal(r.json.fight.joined, 0); assert.equal(r.json.now, t1); assert.equal(asked.one, 1);
  assert.equal((await s.send('fight-join', { liveKey: LK, k: 3, joined: 4 })).status, 200);
  s.w.clock.now = t1 + 1500;
  r = await s.one(id); assert.equal(r.json.fight.joined, 0); assert.equal(r.json.now, t1 + 1500); assert.equal(asked.one, 1);
  s.w.clock.now = t1 + 3000;
  r = await s.one(id); assert.equal(r.json.fight.joined, 4); assert.equal(asked.one, 2);
  // 기억한 답을 고쳐 내보내지 않는다(같은 답을 두 번 받아도 같은 모양)
  assert.deepEqual((await s.one(id)).json.fight, r.json.fight); assert.equal(asked.one, 2);
  // 없는 판은 기억하지 않는다(올라오면 바로 보이게)
  assert.equal((await s.one('abcdefghjkmn')).status, 404); assert.equal((await s.one('abcdefghjkmn')).status, 404); assert.equal(asked.one, 4);
});

test('읽기 한도: 한 IP 가 1분에 목록 240번 · 한 판 240번까지(따로 센다) · 넘으면 429 와 한국어 글 · 다른 IP 는 따로 · 1분 뒤 다시', async () => {
  assert.equal(v.FIGHT_READ_PER_MIN, 240);
  const s = await setup({ fightCacheMs: v.FIGHT_READ_MS });
  const { json: { id } } = await appear(s);
  s.w.clock.now = Math.ceil(s.w.clock.now / 60000) * 60000; // 1분 칸의 처음
  for (let i = 0; i < 240; i++) assert.equal((await s.w.get(i % 2 ? 'fights' : 'fights?slug=' + s.slug)).status, 200, String(i));
  let r = await s.list(); assert.equal(r.status, 429); assert.equal(r.json.error, '요청이 많아요. 잠시 뒤에 다시 해 주세요.');
  assert.equal((await body(await s.w.get('fights?slug=' + s.slug))).status, 429);
  assert.equal((await s.one(id)).status, 200, '한 판 읽기는 따로 센다');
  assert.equal((await s.w.get('fights', '2.2.2.2')).status, 200, '다른 IP 는 따로');
  for (let i = 1; i < 240; i++) assert.equal((await s.w.get('fights/' + id)).status, 200, String(i));
  r = await s.one(id); assert.equal(r.status, 429); assert.match(r.json.error, /[가-힣]/);
  s.w.clock.now += 60000;
  assert.equal((await s.list()).status, 200); assert.equal((await s.one(id)).status, 200);
});
