// DJ 키우기 2단계(서버): 애정도 숫자 숨김 · 캐릭터 이름 하나만 · 메인 페이지 노출 선택 · 새로 꾸민 때 · 하트 · 메인 페이지·캐릭터·전체 찾기.
// 메모리 store(tests/kiugi-world.mjs)로 handler.ts 를 돌린다. 이름은 모두 지어낸 것(먼치·쿠키·젤리, 밤톨·사탕요정·달무리·귤껍질·여름밤·별사탕).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from '../supabase/functions/kiugi/lib.ts';
import { T0, SEASON, PERSON, PAYLOAD, world, body, TOKEN, syl } from './kiugi-world.mjs';

const enc = encodeURIComponent;
const DAY = 86400000;
const S0 = { id: 's0', name: '여름', endsAt: '2026-09-30T14:59:59.000Z' };
const noSecrets = (o) => assert.doesNotMatch(JSON.stringify(o), /"love"|"ch"|"k"|device|nickname|name_key|summary/, '애정도·새로 꾸민 때·찾기 열쇠·기기 번호는 밖으로 나가지 않는다');

// DJ 셋(먼치·쿠키·젤리)을 올린 세계
async function threeDjs(opts) {
  const w = world(opts);
  const a = w.approve(), b = w.approve(), c = w.approve();
  const A = (await w.upload(a, PAYLOAD([PERSON('밤톨', 900, { worn: { head: 'witch-hat', top: 'bat-blouse' } }), PERSON('사탕요정', 500, { worn: { head: 'cat-ears' } }), PERSON('달무리', 300, { worn: {} })]))).json.slug;
  const B = (await w.upload(b, PAYLOAD([PERSON('귤껍질', 800, { worn: { head: 'witch-hat' } }, '쿠키'), PERSON('여름밤', 100, { worn: { hand: 'lollipop' } }, '쿠키'), PERSON('밤톨', 50, {}, '쿠키')], { name: '쿠키' }))).json.slug;
  const C = (await w.upload(c, PAYLOAD([PERSON('별사탕', 400, { worn: { bg: 'candy-shop' } }, '젤리')], { name: '젤리' }))).json.slug;
  return { w, a, b, c, A, B, C };
}

test('작은 도구: 한국 날짜·다음 자정, 이름 열쇠, 시즌 고르기, 새로 꾸민 때, 요약', () => {
  assert.equal(v.kstDay(T0), '2026-10-20'); // 12:00Z = 한국 21:00
  assert.equal(v.kstDay(Date.parse('2026-10-20T15:00:00Z')), '2026-10-21'); // 한국 자정
  assert.equal(v.nextKstMidnight(T0), Date.parse('2026-10-20T15:00:00Z'));
  assert.equal(v.nameKeyOf('Munchi7'), 'munchi7'); assert.equal(v.nameKeyOf('먼치'.normalize('NFD')), '먼치');
  assert.deepEqual(v.pickSeason([{ season: SEASON }, { season: S0 }, { season: SEASON }, { season: null }]), SEASON);
  assert.equal(v.pickSeason([{ season: S0 }, { season: SEASON }]).id, 's1', '같은 수면 끝나는 날이 늦은 쪽');
  assert.equal(v.pickSeason([]), null);
  const people = [{ id: '밤톨#먼치', k: '밤톨#먼치', level: 3, love: 9, worn: { head: 'a', top: 'b' } }, { id: '달무리#먼치', k: '달무리#먼치', level: 1, love: 1, worn: {} }];
  const first = v.withChanges(people, [], 100);
  assert.deepEqual(first.map((p) => p.ch), [100, 100]);
  const again = v.withChanges([{ ...people[0], worn: { top: 'b', head: 'a' } }, { ...people[1], worn: { hand: 'c' } }], first, 200);
  assert.deepEqual(again.map((p) => p.ch), [100, 200], '칸 순서만 바뀐 옷은 그대로, 바뀐 옷은 새 시각');
  const sum = v.summarize(again);
  assert.deepEqual(sum.items, { a: 1, b: 1, c: 1 });
  assert.deepEqual(sum.recent.map((p) => [p.id, p.ch]), [['달무리#먼치', 200], ['밤톨#먼치', 100]]);
  assert.equal(v.summarize(first).recent.length, 1, '아무것도 안 입은 사람은 새로 꾸민 목록에 없다');
});

test('애정도 숫자 숨김: 1~3등·찾기·캐릭터·메인·전체 찾기 어디에도 love 가 없고, 순서는 애정도 순 그대로', async () => {
  const { w, A } = await threeDjs();
  const page = (await body(await w.get('page?slug=' + A))).json;
  assert.deepEqual(page.top.map((p) => p.id), ['밤톨#먼치', '사탕요정#먼치', '달무리#먼치']);
  noSecrets(page);
  noSecrets((await body(await w.get(`find?slug=${A}&q=${enc('밤톨')}`))).json);
  noSecrets((await body(await w.get(`person?slug=${A}&id=${enc('밤톨')}`))).json);
  noSecrets((await body(await w.get('home'))).json);
  noSecrets((await body(await w.get('search?q=' + enc('밤톨')))).json);
  assert.ok(w.store.pages.get(A).people.every((p) => Number.isSafeInteger(p.love) && Number.isSafeInteger(p.ch)), '서버 안에는 애정도·새로 꾸민 때가 그대로 있다');
});

test('캐릭터 이름은 사이트 전체에서 하나만: 먼저 쓴 방송이 가진다(대소문자·NFC 같으면 같은 이름), 끄기는 이름을 지키고 60일 지나면 놓아준다', async () => {
  let roll = 0.5;
  const w = world({ chance: () => roll });
  const a = w.approve(), b = w.approve();
  const A = (await w.upload(a, PAYLOAD([PERSON('밤톨', 10, {}, 'Munchi')], { name: 'Munchi' }))).json.slug;
  assert.equal(w.store.pages.get(A).name_key, 'munchi');
  for (const name of ['munchi', 'MUNCHI']) {
    const r = await w.upload(b, PAYLOAD([PERSON('달무리', 10, {}, name)], { name }));
    assert.equal(r.status, 409, name); assert.equal(r.json.error, '이 캐릭터 이름은 다른 방송이 이미 쓰고 있어요. 먼치킨에서 캐릭터 이름을 바꿔 주세요.');
  }
  assert.equal(w.store.pages.size, 1, '이름이 겹치면 새 주소를 만들지 않는다');
  assert.equal((await w.upload(a, PAYLOAD([PERSON('밤톨', 20, {}, 'Munchi')], { name: 'Munchi' }))).status, 200, '같은 방송은 계속 쓴다');
  // 끄기: 이름은 그대로 지킨다
  assert.equal((await w.upload(a, { enabled: false })).status, 200);
  assert.equal(w.store.pages.get(A).name_key, 'munchi');
  assert.equal((await w.upload(b, PAYLOAD([PERSON('달무리', 10, {}, 'munchi')], { name: 'munchi' }))).status, 409);
  // 한글 이름: 풀어 쓴 모양도 같은 이름
  const c = w.approve();
  assert.equal((await w.upload(c, PAYLOAD(undefined, { name: '먼치' }))).status, 200);
  const nfd = '먼치'.normalize('NFD');
  assert.equal((await w.upload(b, PAYLOAD([{ id: '여름밤#' + nfd, level: 1, love: 1, worn: {} }], { name: nfd }))).status, 409);
  // 동시에 같은 이름으로 올려 데이터베이스가 막은 경우도 409
  w.store.nextSave = 'name';
  assert.equal((await w.upload(b, PAYLOAD([PERSON('여름밤', 10, {}, '쿠키')], { name: '쿠키' }))).status, 409);
  // 이름을 바꾸면 예전 이름은 풀린다
  assert.equal((await w.upload(c, PAYLOAD([PERSON('별사탕', 1, {}, '젤리')], { name: '젤리' }))).status, 200);
  assert.equal((await w.upload(b, PAYLOAD([PERSON('귤껍질', 1)], { name: '먼치' }))).status, 200, '바뀐 뒤에는 다른 방송이 쓸 수 있다');
  // 끈 채로 60일이 지나면 이름 열쇠를 지운다(누가 올릴 때 가끔 정리 — 여기서는 정리가 돌게 chance 0)
  w.clock.now += v.KEEP_MS + 1000;
  assert.equal(w.store.pages.get(A).name_key, 'munchi');
  const d = w.approve();
  roll = 0;
  assert.equal((await w.upload(d, PAYLOAD([PERSON('여름밤', 1, {}, 'MUNCHI')], { name: 'MUNCHI' }))).status, 200, '60일 지난 이름은 새 방송이 쓸 수 있다');
  assert.equal(w.store.pages.get(A).name_key, null);
});

test('60일 정리는 끈 페이지도 마지막으로 올린 때(seen)로 센다, 올릴 때 가끔 돈다', async () => {
  let roll = 0.5;
  const w = world({ chance: () => roll });
  const a = w.approve(), b = w.approve();
  const A = (await w.upload(a, PAYLOAD())).json.slug;
  await w.upload(a, { enabled: false });
  assert.equal(w.store.pages.get(A).seen, w.clock.now);
  w.clock.now += v.KEEP_MS - 120000; // w.upload 가 61초를 더 넘긴다
  roll = 0; await w.upload(b, PAYLOAD([PERSON('귤껍질', 1, {}, '쿠키')], { name: '쿠키' })); await new Promise((r) => setImmediate(r));
  assert.equal(w.store.pages.get(A).name_key, '먼치', '아직 60일 안 지남');
  w.clock.now += 10000;
  await w.upload(b, PAYLOAD([PERSON('귤껍질', 2, {}, '쿠키')], { name: '쿠키' })); await new Promise((r) => setImmediate(r));
  assert.equal(w.store.pages.get(A).name_key, null);
});

test('메인 페이지 노출 선택: main:false 는 메인 목록·전체 찾기에서 빠지고, DJ 페이지·캐릭터 페이지·하트는 그대로', async () => {
  const w = world();
  const a = w.approve(), b = w.approve();
  const A = (await w.upload(a, PAYLOAD([PERSON('밤톨', 100, { worn: { head: 'witch-hat' } })], { main: false }))).json.slug;
  const B = (await w.upload(b, PAYLOAD([PERSON('밤톨', 50, { worn: { head: 'cat-ears' } }, '쿠키')], { name: '쿠키', main: 'yes' }))).json.slug;
  assert.equal(w.store.pages.get(A).main, false); assert.equal(w.store.pages.get(B).main, true, 'false 가 아니면 보인다');
  assert.equal((await w.heart(A, '밤톨', TOKEN(1))).status, 200);
  const home = (await body(await w.get('home'))).json;
  assert.deepEqual(home.djs.map((d) => d.slug), [B]);
  assert.ok(home.popular.every((c) => c.slug !== A) && home.recent.every((c) => c.slug !== A));
  assert.deepEqual(home.items, [{ id: 'cat-ears', count: 1 }]);
  assert.deepEqual((await body(await w.get('search?q=' + enc('밤톨')))).json.results.map((r) => r.slug), [B]);
  assert.deepEqual((await body(await w.get('search?q=' + enc('밤톨#먼치')))).json.results, [], '전체 아이디로도 메인에 안 보이는 페이지는 안 나온다');
  assert.equal((await w.get('page?slug=' + A)).status, 200);
  assert.equal((await body(await w.get(`person?slug=${A}&id=${enc('밤톨')}`))).json.hearts, 1);
  // 다시 보이게
  await w.upload(a, PAYLOAD([PERSON('밤톨', 100, { worn: { head: 'witch-hat' } })]));
  assert.equal(w.store.pages.get(A).main, true, 'main 이 없으면 true');
});

test('새로 꾸민 때(ch): 처음 보는 사람·옷이 바뀐 사람만 새 시각, 메인의 "새로 꾸민 캐릭터" 순서, 밖으로는 안 나감', async () => {
  const w = world();
  const a = w.approve();
  const A = (await w.upload(a, PAYLOAD([PERSON('밤톨', 900, { worn: { head: 'witch-hat' } }), PERSON('사탕요정', 500, { worn: { head: 'cat-ears' } }), PERSON('달무리', 300, { worn: {} })]))).json.slug;
  const t1 = w.clock.now;
  const chOf = () => Object.fromEntries(w.store.pages.get(A).people.map((p) => [p.id.split('#')[0], p.ch]));
  assert.deepEqual(chOf(), { 밤톨: t1, 사탕요정: t1, 달무리: t1 });
  await w.upload(a, PAYLOAD([PERSON('밤톨', 950, { worn: { head: 'witch-hat' } }), PERSON('사탕요정', 500, { worn: { head: 'pumpkin-hat' } }), PERSON('달무리', 300, { worn: {} }), PERSON('귤껍질', 10, { worn: { hand: 'lollipop' } })]));
  const t2 = w.clock.now;
  assert.deepEqual(chOf(), { 밤톨: t1, 사탕요정: t2, 달무리: t1, 귤껍질: t2 });
  const home = (await body(await w.get('home'))).json;
  assert.deepEqual(home.recent.map((c) => c.id), ['사탕요정#먼치', '귤껍질#먼치', '밤톨#먼치'], '최근 순(같으면 애정도 순), 아무것도 안 입은 사람은 빠짐');
  assert.deepEqual(home.recent[0], { slug: A, djName: '먼치', id: '사탕요정#먼치', level: 6, worn: { head: 'pumpkin-hat' }, hearts: 0 });
  noSecrets(home);
});

test('하트: 한 브라우저는 한 캐릭터에 하루 한 번, 다음 날 또, 시즌마다 새로, 되돌리기 없음', async () => {
  const { w, A, B } = await threeDjs();
  let r = await body(await w.heart(A, '밤톨', TOKEN(1)));
  assert.equal(r.status, 200); assert.deepEqual(r.json, { hearts: 1, already: false });
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  assert.deepEqual((await body(await w.heart(A, '밤톨#먼치', TOKEN(1)))).json, { hearts: 1, already: true }, '전체 아이디로 보내도 같은 캐릭터');
  assert.deepEqual((await body(await w.heart(A, '밤톨', TOKEN(2)))).json, { hearts: 2, already: false }, '다른 브라우저');
  assert.deepEqual((await body(await w.heart(B, '밤톨', TOKEN(1)))).json, { hearts: 1, already: false }, '다른 방송의 같은 앞 부분은 다른 캐릭터');
  w.clock.now += DAY;
  assert.deepEqual((await body(await w.heart(A, '밤톨', TOKEN(1)))).json, { hearts: 3, already: false }, '다음 날');
  assert.ok([...w.store.votes.keys()].every((k) => /^[0-9a-f]{64}$/.test(k)), '투표 열쇠는 해시만 남긴다');
  // 하트 수는 1~3등·찾기·캐릭터·메인 인기에 보인다
  assert.equal((await body(await w.get('page?slug=' + A))).json.top[0].hearts, 3);
  assert.equal((await body(await w.get(`find?slug=${A}&q=${enc('밤톨')}`))).json.results[0].hearts, 3);
  assert.equal((await body(await w.get(`person?slug=${A}&id=${enc('밤톨')}`))).json.hearts, 3);
  const home = (await body(await w.get('home'))).json;
  assert.deepEqual(home.popular.map((c) => [c.djName, c.id, c.hearts]), [['먼치', '밤톨#먼치', 3], ['쿠키', '밤톨#쿠키', 1]]);
});

test('하트 거절: 이상한 열쇠·아이디, 없는 사람·주소, 닫힌 페이지, 시즌 준비 중, 횟수 제한', async () => {
  const { w, A, a } = await threeDjs();
  const bad = async (slug, id, token, status, re) => { const r = await body(await w.heart(slug, id, token)); assert.equal(r.status, status, `${slug} ${id} ${token}`); if (re) assert.match(r.json.error, re); };
  await bad(A, '밤톨', 'short', 400, /하트를 보낼 수 없어요/);
  await bad(A, '밤톨', 'x'.repeat(31) + '!', 400);
  await bad(A, 'abc', TOKEN(1), 400, /아이디/);
  await bad(A, '없는사람', TOKEN(1), 404, /이 아이디를 찾을 수 없어요/);
  await bad(A, '밤톨#쿠키', TOKEN(1), 404);
  await bad('abcdefgh', '밤톨', TOKEN(1), 404);
  await bad('nope', '밤톨', TOKEN(1), 404);
  assert.equal((await w.handle(new Request('https://x.supabase.co/functions/v1/kiugi/heart', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' }))).status, 415);
  assert.equal((await w.handle(new Request('https://x.supabase.co/functions/v1/kiugi/heart', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }))).status, 400);
  // 시즌 준비 중(쉬는 중)이면 하트를 못 보낸다
  await w.upload(a, { ...PAYLOAD(), paused: true, season: null });
  await bad(A, '밤톨', TOKEN(1), 409, /다음 시즌/);
  // 차단된 기기의 페이지
  w.store.devices.set(a.id, { state: 'revoked', review: false });
  await bad(A, '밤톨', TOKEN(1), 404, /닫아 두었어요/);
});

test('하트 횟수 제한: 주소마다 1시간 60번, 열쇠마다 하루 50번', async () => {
  const { w, A, B } = await threeDjs();
  for (let i = 0; i < 50; i++) assert.equal((await w.heart(A, '밤톨', TOKEN(7), `10.0.0.${i % 50}`)).status, 200);
  let r = await body(await w.heart(B, '귤껍질', TOKEN(7), '10.0.1.1'));
  assert.equal(r.status, 429); assert.match(r.json.error, /내일/);
  for (let i = 0; i < 60; i++) assert.equal((await w.heart(A, '사탕요정', TOKEN(100 + i), '9.9.9.9')).status, 200, String(i));
  r = await body(await w.heart(A, '사탕요정', TOKEN(999), '9.9.9.9'));
  assert.equal(r.status, 429); assert.match(r.json.error, /잠시 뒤/);
  assert.equal((await w.heart(A, '사탕요정', TOKEN(998), '9.9.9.8')).status, 200, '다른 주소는 따로 센다');
  assert.equal((await body(await w.get(`person?slug=${A}&id=${enc('사탕요정')}`))).json.hearts, 61);
});

test('하트는 시즌마다 새로, 지운 아이디의 하트는 보이지 않고 가끔 지운다', async () => {
  let roll = 0.5;
  const w = world({ chance: () => roll });
  const a = w.approve();
  const A = (await w.upload(a, PAYLOAD([PERSON('밤톨', 100, { worn: { head: 'witch-hat' } }), PERSON('달무리', 50, { worn: { head: 'cat-ears' } })]))).json.slug;
  await w.heart(A, '밤톨', TOKEN(1)); await w.heart(A, '달무리', TOKEN(1)); await w.heart(A, '달무리', TOKEN(2));
  // 달무리를 지운 목록을 올림(가끔 하는 정리는 아직 안 돔): 인기에 안 보이지만 줄은 남아 있음
  await w.upload(a, PAYLOAD([PERSON('밤톨', 100, { worn: { head: 'witch-hat' } })]));
  await new Promise((r) => setImmediate(r));
  assert.deepEqual((await body(await w.get('home'))).json.popular.map((c) => [c.id, c.hearts]), [['밤톨#먼치', 1]]);
  assert.equal(w.store.hearts.size, 2);
  roll = 0; // 정리가 돌게
  await w.upload(a, PAYLOAD([PERSON('밤톨', 100, { worn: { head: 'witch-hat' } })]));
  await new Promise((r) => setImmediate(r));
  assert.equal(w.store.hearts.size, 1, '지운 아이디의 하트 줄을 지웠다');
  roll = 0.5;
  // 새 시즌: 하트는 0부터(지난 시즌 줄은 시즌이 바뀔 때 지운다)
  const S2 = { id: 's2', name: '겨울', endsAt: '2026-12-31T14:59:59.000Z' };
  await w.upload(a, PAYLOAD([PERSON('밤톨', 10, { worn: { head: 'witch-hat' } })], { season: S2 }));
  await new Promise((r) => setImmediate(r));
  assert.equal((await body(await w.get('page?slug=' + A))).json.top[0].hearts, 0);
  assert.equal(w.store.hearts.size, 0);
  assert.deepEqual((await body(await w.heart(A, '밤톨', TOKEN(1)))).json, { hearts: 1, already: false }, '새 시즌에는 같은 날에도 다시 보낼 수 있다');
});

test('투표 열쇠는 하루 지나면 가끔 지운다', async () => {
  let roll = 0.5;
  const { w, A } = await threeDjs({ chance: () => roll });
  await w.heart(A, '밤톨', TOKEN(1));
  assert.equal(w.store.votes.size, 1);
  w.clock.now += 3 * DAY; roll = 0;
  await w.heart(A, '사탕요정', TOKEN(1)); await new Promise((r) => setImmediate(r));
  assert.equal(w.store.votes.size, 1, '지난 열쇠는 지우고 방금 것만 남음');
});

test('메인 페이지(home): 지금 시즌·인기 12·새로 꾸민 8·옷 수·DJ 목록·합계, 지난 시즌·차단·숨긴 페이지는 빠짐', async () => {
  const { w, A, B, C } = await threeDjs();
  // 지난 시즌에 멈춘 DJ(DJ 목록에만), 차단된 DJ(어디에도 없음)
  const old = w.approve(), gone = w.approve();
  const O = (await w.upload(old, PAYLOAD([PERSON('여름밤', 999, { worn: { head: 'old-hat' } }, '풀빵')], { name: '풀빵', season: S0 }))).json.slug;
  const G = (await w.upload(gone, PAYLOAD([PERSON('여름밤', 999, { worn: { head: 'witch-hat' } }, '호떡')], { name: '호떡' }))).json.slug;
  await w.heart(O, '여름밤', TOKEN(1)); await w.heart(G, '여름밤', TOKEN(1));
  w.store.devices.set(gone.id, { state: 'revoked', review: false });
  await w.heart(B, '귤껍질', TOKEN(1)); await w.heart(B, '귤껍질', TOKEN(2)); await w.heart(A, '사탕요정', TOKEN(1));
  const r = await body(await w.get('home'));
  assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'public, max-age=60');
  const h = r.json;
  assert.deepEqual(Object.keys(h).sort(), ['djs', 'items', 'popular', 'recent', 'season', 'totals']);
  assert.deepEqual(h.season, SEASON);
  assert.deepEqual(h.popular, [
    { slug: B, djName: '쿠키', id: '귤껍질#쿠키', level: 9, worn: { head: 'witch-hat' }, hearts: 2 },
    { slug: A, djName: '먼치', id: '사탕요정#먼치', level: 6, worn: { head: 'cat-ears' }, hearts: 1 }
  ], '하트 받은 캐릭터만, 많은 순, 지난 시즌·차단된 페이지는 빠짐');
  assert.ok(h.recent.length > 0 && h.recent.length <= 8 && h.recent.every((x) => [A, B, C].includes(x.slug)));
  assert.deepEqual(h.items.find((x) => x.id === 'witch-hat'), { id: 'witch-hat', count: 2 });
  assert.equal(h.items.some((x) => x.id === 'old-hat'), false, '지난 시즌 페이지의 옷은 세지 않는다');
  assert.deepEqual(h.djs.map((d) => d.name), ['먼치', '쿠키', '젤리', '풀빵'], '청취자 많은 순(같으면 이름 순), 지난 시즌 DJ 도 목록에는 있음');
  assert.deepEqual(h.djs.map((d) => d.slug), [A, B, C, O]);
  assert.deepEqual(h.djs.find((d) => d.slug === A), { slug: A, name: '먼치', character: { name: '먼치', gender: 'f', hair: 'bob', hairColor: 'brown', skin: 's2', eyes: 'round', nose: 'dot', mouth: 'smile' }, count: 3 });
  assert.deepEqual(h.totals, { djs: 4, people: 3 + 3 + 1 + 1 });
  noSecrets(h);
});

test('메인 페이지 인기는 12명까지, 1분에 60번, 함수 안에서 잠깐 기억', async () => {
  const w = world({ cacheMs: 30000 });
  const a = w.approve();
  const A = (await w.upload(a, PAYLOAD(Array.from({ length: 15 }, (_, i) => PERSON('팬' + syl(i), 1000 - i))))).json.slug;
  for (let i = 0; i < 15; i++) await w.heart(A, '팬' + syl(i), TOKEN(i), `8.8.${i}.1`);
  await w.heart(A, '팬' + syl(14), TOKEN(99), '8.8.99.1');
  let h = (await body(await w.get('home', '7.7.7.7'))).json;
  assert.equal(h.popular.length, 12); assert.equal(h.popular[0].id, '팬' + syl(14) + '#먼치');
  // 30초 안에는 기억해 둔 답(하트가 늘어도 그대로), 지나면 새로
  await w.heart(A, '팬' + syl(0), TOKEN(98), '8.8.98.1'); await w.heart(A, '팬' + syl(0), TOKEN(97), '8.8.97.1');
  assert.equal((await body(await w.get('home', '7.7.7.7'))).json.popular[0].id, '팬' + syl(14) + '#먼치');
  w.clock.now += 31000;
  h = (await body(await w.get('home', '7.7.7.7'))).json;
  assert.equal(h.popular[0].id, '팬' + syl(0) + '#먼치');
  for (let i = 0; i < 60; i++) assert.equal((await w.get('home', '6.6.6.6')).status, 200);
  assert.equal((await w.get('home', '6.6.6.6')).status, 429);
});

test('캐릭터(person): 앞 부분·전체 아이디, 하트·시즌·DJ, 없으면 404', async () => {
  const { w, A, B } = await threeDjs();
  await w.heart(A, '밤톨', TOKEN(1));
  // titles: 단 칭호(0.15.63~) — 캐릭터(person)는 칭호가 없어도 늘 배열로 내보낸다
  const want = { id: '밤톨#먼치', level: 10, worn: { head: 'witch-hat', top: 'bat-blouse' }, titles: [], hearts: 1, season: SEASON, dj: { slug: A, name: '먼치', character: { name: '먼치', gender: 'f', hair: 'bob', hairColor: 'brown', skin: 's2', eyes: 'round', nose: 'dot', mouth: 'smile' } } };
  let r = await body(await w.get(`person?slug=${A}&id=${enc('밤톨')}`));
  assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'public, max-age=30');
  assert.deepEqual(r.json, want);
  assert.deepEqual((await body(await w.get(`person?slug=${A}&id=${enc('밤톨#먼치')}`))).json, want);
  assert.equal((await body(await w.get(`person?slug=${B}&id=${enc('밤톨')}`))).json.id, '밤톨#쿠키');
  r = await body(await w.get(`person?slug=${A}&id=${enc('귤껍질')}`));
  assert.equal(r.status, 404); assert.match(r.json.error, /이 아이디를 찾을 수 없어요/);
  assert.equal((await w.get(`person?slug=${A}&id=${enc('밤톨#쿠키')}`)).status, 404);
  assert.equal((await w.get(`person?slug=${A}&id=abc`)).status, 400);
  assert.equal((await w.get(`person?slug=abcdefgh&id=${enc('밤톨')}`)).status, 404);
});

test('칭호(titles): 먼치킨이 올린 단 칭호가 캐릭터·1~3등·찾기·메인·전체 찾기에 그대로, 이상한 id 는 빠지고 칭호 없는 사람은 칸이 없다', async () => {
  const w = world();
  const k = w.approve();
  const slug = (await w.upload(k, PAYLOAD([
    PERSON('밤톨', 900, { worn: { crown: 'acc2_11', top: 'top_11' }, titles: ['title-halloween-insa', '<b>칭호</b>'] }),
    PERSON('사탕요정', 500, { worn: { wings: 'acc2_12' } }),
  ]))).json.slug;
  await w.heart(slug, '밤톨', TOKEN(1));
  const person = (await body(await w.get(`person?slug=${slug}&id=${enc('밤톨')}`))).json;
  assert.deepEqual([person.titles, person.worn], [['title-halloween-insa'], { crown: 'acc2_11', top: 'top_11' }]);
  assert.deepEqual((await body(await w.get(`person?slug=${slug}&id=${enc('사탕요정')}`))).json.titles, []);
  const page = (await body(await w.get('page?slug=' + slug))).json;
  assert.deepEqual(page.top.map((p) => p.titles ?? null), [['title-halloween-insa'], null]);
  assert.deepEqual((await body(await w.get(`find?slug=${slug}&q=${enc('밤톨')}`))).json.results[0].titles, ['title-halloween-insa']);
  const home = (await body(await w.get('home'))).json;
  assert.deepEqual(home.popular.map((c) => [c.id, c.titles ?? null]), [['밤톨#먼치', ['title-halloween-insa']]]);
  assert.deepEqual(home.recent.map((c) => [c.id, c.titles ?? null]), [['밤톨#먼치', ['title-halloween-insa']], ['사탕요정#먼치', null]]);
  assert.deepEqual((await body(await w.get('search?q=' + enc('밤톨')))).json.results.map((c) => c.titles ?? null), [['title-halloween-insa']]);
  noSecrets(person); noSecrets(page); noSecrets(home);
});

test('전체 찾기(search): 전체 아이디는 캐릭터 이름 열쇠로 바로, 앞 부분은 같은 사람 먼저·들어 있는 사람 다음, 10명까지', async () => {
  const { w, A, B, C } = await threeDjs();
  await w.heart(B, '밤톨', TOKEN(1));
  let r = await body(await w.get('search?q=' + enc('밤톨')));
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.results.map((x) => [x.djName, x.id]), [['먼치', '밤톨#먼치'], ['쿠키', '밤톨#쿠키']], '같은 앞 부분은 레벨 높은 순');
  assert.equal(r.json.exact, 2); assert.equal(r.json.more, false);
  assert.deepEqual(r.json.results[1], { slug: B, djName: '쿠키', id: '밤톨#쿠키', level: 1, worn: { head: 'cat-ears' }, hearts: 1 });
  r = await body(await w.get('search?q=' + enc('사탕')));
  assert.deepEqual(r.json.results.map((x) => x.id), ['사탕요정#먼치', '별사탕#젤리'], '앞 부분에 "사탕"이 들어 있는 사람, 레벨 높은 순');
  assert.equal(r.json.exact, 0);
  r = await body(await w.get('search?q=' + enc('사탕요정#먼치')));
  assert.deepEqual(r.json.results.map((x) => x.slug), [A]);
  r = await body(await w.get('search?q=' + enc('별사탕#젤리')));
  assert.deepEqual(r.json.results.map((x) => [x.slug, x.djName]), [[C, '젤리']]);
  assert.deepEqual((await body(await w.get('search?q=' + enc('밤톨#젤리')))).json.results, []);
  assert.deepEqual((await body(await w.get('search?q=' + enc('밤톨#없는이름')))).json.results, []);
  assert.equal((await w.get('search?q=abc')).status, 400);
  assert.equal((await w.get('search?q=')).status, 400);
  // 10명까지
  const many = w.approve();
  await w.upload(many, PAYLOAD(Array.from({ length: 12 }, (_, i) => PERSON('밤톨' + syl(i), 100 - i, {}, '곰젤리')), { name: '곰젤리' }));
  r = await body(await w.get('search?q=' + enc('밤톨'), '5.5.5.5'));
  assert.equal(r.json.results.length, 10); assert.equal(r.json.more, true); assert.equal(r.json.exact, 2);
  assert.deepEqual(r.json.results.slice(0, 2).map((x) => x.id), ['밤톨#먼치', '밤톨#쿠키'], '정확히 같은 사람 먼저');
  for (let i = 0; i < 30; i++) assert.equal((await w.get('search?q=' + enc('밤톨'), '4.4.4.4')).status, 200);
  assert.equal((await w.get('search?q=' + enc('밤톨'), '4.4.4.4')).status, 429);
});

test('사람 목록에 사람이 많아도 대표 정보만 저장된다(요약 8명·옷 수)', async () => {
  const w = world();
  const a = w.approve();
  const A = (await w.upload(a, PAYLOAD(Array.from({ length: 30 }, (_, i) => PERSON('팬' + syl(i), 1000 - i, { worn: { head: i % 2 ? 'cat-ears' : 'witch-hat' } }))))).json.slug;
  const s = w.store.pages.get(A).summary;
  assert.equal(s.recent.length, 8);
  assert.deepEqual(s.items, { 'witch-hat': 15, 'cat-ears': 15 });
});
