// 키우기 서버 시즌 2(2026-11-15): 먼치킨 올리기 v3 = {v:3, season:'s2', character:{name}, people:[{id, lead, monsters:[{sp,stage,lv}]}]} — 닉네임 없음.
//  시즌 1 v2(옷)는 2026-12-01 0시(한국)부터 받지 않는다. 사이트 아이디 찾기(search)·한 사람(person)은 대표·몬스터를 준다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as v from '../supabase/functions/kiugi/lib.ts';
import { world, PAYLOAD, PERSON, body, T0 } from './kiugi-world.mjs';

const DEC1 = Date.parse('2026-12-01T00:00:00+09:00');
const M = (sp, stage, lv) => ({ sp, stage, lv });
const P3 = (base, monsters, lead = monsters[0]?.sp ?? null, extra = {}, name = '먼치') => ({ id: `${base}#${name}`, lead, monsters, ...extra });
const V3 = (people, { name = '먼치', season = 's2', ...rest } = {}) => ({ enabled: true, v: 3, season, character: { name }, people, ...rest });

test('검사(v3): 아이디·대표·몬스터만 담고 닉네임 같은 다른 칸은 버린다 · 이상한 몬스터 줄은 그 줄만 · 같은 종류는 하나 · 대표는 가진 몬스터일 때만', () => {
  const s = v.snapshot(V3([
    P3('밤톨', [M('water_01', 2, 14), M('fire_02', 1, 6), M('water_01', 1, 3), M('Fire_01', 1, 2), M('grass_01', 4, 1), M('earth_01', 1, 0), { sp: 'wind_01', stage: 1 }, 'x'], 'water_01', { nickname: '진짜 이름', exp: 999, nyang: 10 }),
    P3('사탕요정', [M('electric_01', 3, 22)], 'fire_01'),
    { id: '구름이#다른이름', lead: null, monsters: [] },
    P3('별빛', []),
  ]), T0);
  assert.equal(s.enabled, true);
  assert.deepEqual(s.season, v.S2_SEASON);
  assert.deepEqual(s.character, { name: '먼치' });
  assert.equal(s.count, 3, '뒤 이름이 이 방송이 아닌 줄은 뺀다');
  const [a, b, c] = s.people;
  assert.deepEqual(Object.keys(a).sort(), ['id', 'k', 'lead', 'level', 'love', 'monsters', 'worn']);
  assert.deepEqual(a.monsters, [M('water_01', 2, 14), M('fire_02', 1, 6)]);
  assert.equal(a.lead, 'water_01'); assert.equal(a.level, 14); assert.equal(a.love, 0);
  assert.equal(b.lead, null, '가지지 않은 몬스터는 대표가 아니다');
  assert.deepEqual(c.monsters, []); assert.equal(c.level, 1);
  assert.doesNotMatch(JSON.stringify(s), /진짜 이름|nickname|nyang/);
  // 순서는 보낸 그대로 · 1~3등에도 몬스터
  assert.deepEqual(s.people.map((p) => p.id), ['밤톨#먼치', '사탕요정#먼치', '별빛#먼치']);
  assert.deepEqual(s.top[0].monsters, a.monsters);
  // 이름은 name 칸으로도 · 시즌은 's2' 또는 {id,name,endsAt} · 모르는 시즌 글은 400 · 쉬는 중이면 사람 없음
  assert.deepEqual(v.snapshot({ enabled: true, v: 3, season: 's2', name: '쿠키', people: [P3('밤톨', [M('fire_01', 1, 1)], 'fire_01', {}, '쿠키')] }).character, { name: '쿠키' });
  assert.equal(v.snapshot(V3([], { season: { id: 's2', name: '몬스터 영토전', endsAt: '2026-12-31T14:59:59.000Z' } })).season.id, 's2');
  assert.throws(() => v.snapshot(V3([], { season: 's3' })), (e) => e.status === 400);
  assert.equal(v.snapshot(V3([P3('밤톨', [M('fire_01', 1, 1)])], { paused: true })).count, 0);
  assert.throws(() => v.snapshot({ enabled: true, v: 4, people: [] }), (e) => e.status === 400);
  // 한 사람 몬스터는 24마리까지
  assert.equal(v.monsters(Array.from({ length: 30 }, (_, i) => M(`fire_${String(i).padStart(2, '0')}`, 1, 1))).length, v.MONSTERS_MAX);
});

test('시즌 1 v2 는 2026-12-01 0시(한국)부터 받지 않는다(끄기는 그대로) · v3 는 언제든 · health 에 판 3 과 마지막 때', async () => {
  assert.equal(v.S2_START, DEC1);
  assert.equal(v.snapshot(PAYLOAD(), DEC1 - 1).count, 3, '11-30 23:59:59 까지는 받는다');
  assert.throws(() => v.snapshot(PAYLOAD(), DEC1), (e) => e.status === 400 && e.message === v.V2_CLOSED);
  assert.equal(v.snapshot({ enabled: false }, DEC1 + 1).enabled, false);
  assert.equal(v.snapshot(V3([P3('밤톨', [M('fire_01', 1, 1)])]), DEC1 - 864e5).count, 1);
  // 실제 서버와 같은 마지막 때로 연 세계
  const w = world({ v2Until: DEC1, now: DEC1 - 120e3 }), key = w.approve();
  let r = await w.upload(key, PAYLOAD());
  assert.equal(r.status, 200, '11-30 23:59 에는 v2 도 받는다');
  w.clock.now = DEC1 + 1000;
  r = await w.upload(key, PAYLOAD());
  assert.equal(r.status, 400); assert.equal(r.json.error, v.V2_CLOSED);
  r = await w.upload(key, V3([P3('밤톨', [M('water_01', 1, 3)])]));
  assert.equal(r.status, 200); assert.equal(r.json.count, 1);
  r = await w.upload(key, { enabled: false });
  assert.equal(r.status, 200); assert.equal(r.json.enabled, false);
  const h = await body(await w.get('health'));
  assert.equal(h.json.v, 3); assert.equal(h.json.s2, true); assert.equal(h.json.v2Until, '2026-11-30T15:00:00.000Z');
});

test('아이디 찾기(search): 카드에 대표·몬스터 · 닉네임 없음 · 전체 아이디·앞 부분 · 여러 방송의 같은 앞 부분 · 한 사람(person)도 몬스터', async () => {
  const w = world({ v2Until: DEC1, now: DEC1 + 3600e3 }), k1 = w.approve(), k2 = w.approve();
  assert.equal((await w.upload(k1, V3([P3('밤톨', [M('water_01', 2, 14), M('fire_02', 1, 6)], 'water_01'), P3('사탕요정', [M('electric_01', 3, 22)])]))).status, 200);
  const up = await w.upload(k2, V3([P3('밤톨', [M('fire_01', 1, 5)], 'fire_01', {}, '쿠키')], { name: '쿠키' }));
  assert.equal(up.status, 200);
  let r = await body(await w.get('search?q=' + encodeURIComponent('밤톨')));
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.results.map((x) => x.id).sort(), ['밤톨#먼치', '밤톨#쿠키']);
  const mine = r.json.results.find((x) => x.id === '밤톨#먼치');
  assert.equal(mine.djName, '먼치'); assert.equal(mine.lead, 'water_01');
  assert.deepEqual(mine.monsters, [M('water_01', 2, 14), M('fire_02', 1, 6)]);
  assert.doesNotMatch(JSON.stringify(r.json), /"k"|device|love/);
  r = await body(await w.get('search?q=' + encodeURIComponent('밤톨#쿠키')));
  assert.equal(r.json.results.length, 1); assert.equal(r.json.results[0].lead, 'fire_01');
  r = await body(await w.get(`person?slug=${up.json.slug}&id=${encodeURIComponent('밤톨')}`));
  assert.equal(r.status, 200); assert.equal(r.json.lead, 'fire_01'); assert.deepEqual(r.json.monsters, [M('fire_01', 1, 5)]); assert.equal(r.json.season.id, 's2');
  // 시즌 1 사람(옷)에게는 몬스터 칸이 없다 — 사이트는 그 카드를 "시즌 2 기록이 아직 없어요"로
  const w1 = world(), k = w1.approve();
  await w1.upload(k, PAYLOAD([PERSON('밤톨', 50)]));
  r = await body(await w1.get('search?q=' + encodeURIComponent('밤톨')));
  assert.equal(r.json.results.length, 1); assert.equal('monsters' in r.json.results[0], false);
});

test('새로 꾸민 때(ch): 대표·몬스터(단계·레벨)가 바뀐 사람만 새 시각', () => {
  const a = v.snapshot(V3([P3('밤톨', [M('water_01', 1, 3)]), P3('별빛', [M('fire_01', 1, 2)])])).people;
  const first = v.withChanges(a, [], 1000);
  const b = v.snapshot(V3([P3('밤톨', [M('water_01', 1, 4)]), P3('별빛', [M('fire_01', 1, 2)])])).people;
  const next = v.withChanges(b, first, 2000);
  assert.equal(next[0].ch, 2000, '레벨이 바뀜');
  assert.equal(next[1].ch, 1000, '그대로');
});
