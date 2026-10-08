// DJ 키우기 페이지 서버(supabase/functions/kiugi): 검사·모양(lib.ts) + 요청 처리(handler.ts)를 메모리 store 로(tests/kiugi-world.mjs).
// 서명은 먼치킨과 같은 방법(node:crypto, ieee-p1363)으로 만든다. 실제 서버·스푼에 닿지 않는다.
// 청취자 줄은 v2: 아이디 = 청취자가 방송에서 "!아이디"로 만든 앞 부분(한글 1~6자) + "#" + DJ 캐릭터 이름(예: 밤톨#먼치).
// 아래 이름은 모두 지어낸 것. 2단계(하트·메인 페이지·이름 하나만)는 tests/kiugi-stage2.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from '../supabase/functions/kiugi/lib.ts';
import { SITE, BASE, T0, deviceKey, signed, syl, PERSON, PAYLOAD as MAKE, world, body } from './kiugi-world.mjs';

const ZW = String.fromCharCode(0x200b), RLO = String.fromCharCode(0x202e); // 보이지 않는 글자·글 방향 바꾸기 글자
const PAYLOAD = (people) => MAKE(people);
const find = (w, slug, q, ip) => w.get('find?slug=' + slug + '&q=' + encodeURIComponent(q), ip);

test('아이디 검사: "<한글 1~6자>#<캐릭터 이름>", 뒤 이름은 이 캐릭터와 같아야 한다, NFC·앞뒤 공백만 정리', () => {
  assert.equal(v.listenerId('먼치팬#먼치', '먼치'), '먼치팬#먼치');
  assert.equal(v.listenerId('  달무리#먼치 ', '먼치'), '달무리#먼치');
  assert.equal(v.listenerId('밤톨#먼치'.normalize('NFD'), '먼치'), '밤톨#먼치', '풀어 쓴 한글도 NFC 로 맞추면 통과');
  assert.equal(v.listenerId('밤톨#먼치', '먼치'.normalize('NFD')), '밤톨#먼치');
  assert.equal(v.listenerId('가나다라마바#먼치', '먼치'), '가나다라마바#먼치', '앞 부분 6자까지');
  assert.equal(v.listenerId('밤톨#Munchi7', 'Munchi7'), '밤톨#Munchi7', '캐릭터 이름은 영문·숫자도');
  assert.equal(v.listenerId('밤톨#가나다라마바사아', '가나다라마바사아'), '밤톨#가나다라마바사아', '캐릭터 이름 8자까지');
  for (const bad of ['먼치팬', '먼치팬#', '#먼치', '먼치팬#두부', '먼치팬#먼치킨', '가나다라마바사#먼치', 'abc#먼치', 'Bam#먼치', '밤톨1#먼치', '밤 톨#먼치', '밤톨#먼 치', '밤톨 #먼치',
    '밤톨##먼치', '밤톨#먼치#먼치', '밤톨!#먼치', 'ㅂㅌ#먼치', ZW + '밤톨#먼치', '밤' + RLO + '톨#먼치', '밤톨#먼치' + ZW, '🎃호박#먼치', '', '   ', null, undefined, 123, ['밤톨#먼치'], { id: '밤톨#먼치' }]) {
    assert.equal(v.listenerId(bad, '먼치'), null, JSON.stringify(bad));
  }
  assert.equal(v.listenerId('밤톨#munchi7', 'Munchi7'), null, '캐릭터 이름은 글자 그대로 같아야');
  assert.equal(v.listenerId('밤톨#가나다라마바사아자', '가나다라마바사아자'), null, '캐릭터 이름 9자는 모양이 아님');
});

test('검사(v2): 청취자 줄은 아이디·레벨·애정도·입은 옷만, nickname 같은 다른 칸은 버린다, 이상한 줄은 그 줄만 빠진다', () => {
  const s = v.snapshot(PAYLOAD([
    PERSON('밤톨', 50, { nickname: '스푼에서온이름', tag: 'jl-1', nyang: 10, userId: 3 }), PERSON('사탕요정', 300),
    { nickname: '닉네임만있는줄', level: 1, love: 1 }, PERSON('  ', 1), PERSON('Candy', 1), PERSON('일곱글자아이디', 1), PERSON('밤 톨', 1), PERSON(ZW + '유령', 1),
    { id: '보름달', level: 1, love: 900 }, { id: '보름달#두부', level: 1, love: 900 }, { id: '보름달#먼치킨', level: 1, love: 900 },
    PERSON('보름달', 1, { level: 0 }), PERSON('보름달', 1, { love: -1 }), PERSON('보름달', 1, { level: 1.5 }),
    { id: ' 달무리#먼치 ', level: 2, love: 120, worn: { head: 'witch-hat', Bad: 'x', face: '<script>', bg: 'halloween-night', aura: 'moonlight-aura' } }, PERSON('호박꽃', 300)
  ]));
  assert.equal(s.enabled, true); assert.equal(s.count, 4); assert.equal(s.name, '먼치');
  assert.deepEqual(s.people.map((p) => p.id), ['사탕요정#먼치', '호박꽃#먼치', '달무리#먼치', '밤톨#먼치']);
  for (const p of s.people) assert.deepEqual(Object.keys(p).sort(), ['id', 'k', 'level', 'love', 'worn']);
  assert.deepEqual(s.people[2].worn, { head: 'witch-hat', bg: 'halloween-night', aura: 'moonlight-aura' });
  assert.equal(s.people[2].k, '달무리#먼치');
  assert.doesNotMatch(JSON.stringify(s), /nickname|스푼에서온이름|닉네임만있는줄|jl-|nyang|userId|tag|두부|먼치킨/);
  assert.deepEqual(s.top, [
    { rank: 1, id: '사탕요정#먼치', level: 4, love: 300, worn: { head: 'cat-ears' } },
    { rank: 2, id: '호박꽃#먼치', level: 4, love: 300, worn: { head: 'cat-ears' } },
    { rank: 3, id: '달무리#먼치', level: 2, love: 120, worn: { head: 'witch-hat', bg: 'halloween-night', aura: 'moonlight-aura' } }
  ], '공개 1~3등에는 찾기 열쇠가 없다');
  // 같은 아이디가 두 번 오면 애정도 높은 줄만
  const dup = v.snapshot(PAYLOAD([PERSON('밤톨', 10), PERSON('밤톨', 500), PERSON('밤톨'.normalize('NFD'), 900)]));
  assert.deepEqual(dup.people.map((p) => [p.id, p.love]), [['밤톨#먼치', 900]]);
  // 아이디가 없는(이름만 있는) 줄만 오면 아무도 싣지 않는다
  assert.equal(v.snapshot(PAYLOAD([{ nickname: '밤톨', level: 1, love: 5 }])).count, 0);
  // 영문 캐릭터 이름: 찾기 열쇠는 소문자, 보이는 아이디는 그대로
  const en = v.snapshot({ ...PAYLOAD([{ id: '별사탕#Munchi7', level: 1, love: 5 }, { id: '구름빵#munchi7', level: 1, love: 5 }]), character: { name: 'Munchi7' } });
  assert.deepEqual(en.people.map((p) => [p.id, p.k]), [['별사탕#Munchi7', '별사탕#munchi7']]);
});

test('검사(v2): 판 번호·캐릭터 이름·시즌·끄기·쉬는 중·인원 상한', () => {
  assert.deepEqual(v.snapshot({ enabled: false, extra: 1 }), { enabled: false });
  assert.throws(() => v.snapshot({ ...PAYLOAD(), v: 1 }), /업데이트/, 'v1(스푼 이름을 올리던 판)은 받지 않는다');
  assert.throws(() => v.snapshot({ ...PAYLOAD(), v: undefined }), /업데이트/);
  assert.throws(() => v.snapshot({ ...PAYLOAD(), v: '2' }), /업데이트/);
  assert.throws(() => v.snapshot({ ...PAYLOAD(), enabled: 'yes' }), /업데이트/);
  assert.throws(() => v.snapshot(null), /올릴 내용/);
  for (const name of ['', '   ', '먼치 킨', '가'.repeat(9), '먼치!', 'mun_chi', 123]) assert.throws(() => v.snapshot({ ...PAYLOAD(), character: { name } }), /캐릭터 이름.*1~8자/, String(name));
  assert.equal(v.character({ name: ' 먼치 ' }).name, '먼치');
  assert.equal(v.character({ name: '가나다라마바사아' }).name, '가나다라마바사아');
  assert.throws(() => v.snapshot({ ...PAYLOAD(), season: { id: 's1', name: '할로윈', endsAt: 'nope' } }), /시즌/);
  const paused = v.snapshot({ ...PAYLOAD(), paused: true, season: null });
  assert.equal(paused.season, null); assert.equal(paused.count, 0, '시즌이 없으면 청취자를 싣지 않는다');
  const big = v.snapshot(PAYLOAD(Array.from({ length: 3100 }, (_, i) => PERSON('팬' + syl(i), 5000 - i))));
  assert.equal(big.count, 3000); assert.equal(big.people.at(-1).id, '팬' + syl(2999) + '#먼치');
  // 캐릭터는 이름표에 맞는 모양 열쇠만
  assert.deepEqual(v.character({ name: '먼치', hair: 'bob', skin: 'S2', evil: 'x', eyes: '<b>' }), { name: '먼치', hair: 'bob' });
  assert.deepEqual(v.character({ name: '두부', gender: 'm', hair: 'm_two-block' }), { name: '두부', gender: 'm', hair: 'm_two-block' }, '성별 머리 열쇠(밑줄)');
  assert.deepEqual(v.worn({ head: 'm_witch-hat', top: 'a b' }), { head: 'm_witch-hat' });
});

test('찾기: 앞 부분만 또는 전체 아이디로, 정확히 같은 아이디 먼저, 띄어쓰기 무시, 5명까지, 순위 번호', () => {
  const s = v.snapshot(PAYLOAD([PERSON('밤톨이팬', 900), PERSON('사탕요정', 800), PERSON('밤톨이', 700), ...Array.from({ length: 8 }, (_, i) => PERSON('밤톨이' + syl(i), 100 - i))]));
  let r = v.findPeople(s.people, v.query(' 밤 톨이 '));
  assert.equal(r.results.length, 5); assert.equal(r.more, true); assert.equal(r.exact, 1);
  assert.deepEqual(r.results.slice(0, 2).map((p) => [p.rank, p.id]), [[3, '밤톨이#먼치'], [1, '밤톨이팬#먼치']]);
  assert.deepEqual(Object.keys(r.results[0]).sort(), ['id', 'level', 'rank', 'worn'], '애정도 숫자는 내보내지 않는다(SHOW_LOVE false)');
  assert.equal(v.SHOW_LOVE, false);
  assert.deepEqual(v.findPeople(s.people, '밤톨이', 5, (k) => (k === '밤톨이#먼치' ? 4 : 0)).results[0], { rank: 3, id: '밤톨이#먼치', level: 8, worn: { head: 'cat-ears' }, hearts: 4 });
  // 전체 아이디: 정확히 같은 사람 먼저, 그다음 그 글이 들어 있는 아이디
  r = v.findPeople(s.people, v.query('밤톨이#먼치'));
  assert.equal(r.exact, 1); assert.deepEqual(r.results.map((p) => p.id), ['밤톨이#먼치']);
  assert.deepEqual(v.findPeople(s.people, v.query('이팬#먼치')).results.map((p) => p.id), ['밤톨이팬#먼치']);
  assert.deepEqual(v.findPeople(s.people, v.query('밤톨이#두부')).results, [], '다른 캐릭터 이름이면 없음');
  // 앞 부분만 적으면 앞 부분끼리만 비교(캐릭터 이름 글자로 모두가 나오지 않는다)
  assert.deepEqual(v.findPeople(s.people, v.query('요정')).results.map((p) => p.id), ['사탕요정#먼치']);
  assert.deepEqual(v.findPeople(s.people, v.query('치')).results, []);
  assert.deepEqual(v.findPeople(s.people, v.query('없는사람')).results, []);
  assert.equal(v.query('밤톨'.normalize('NFD')), '밤톨');
  assert.equal(v.query(' 밤톨 # Munchi7 '), '밤톨#munchi7', '영문은 소문자로 맞춰 찾는다');
  for (const bad of ['', '   ', '가'.repeat(7), 'bam', '밤톨1', 'ㅂ', ZW, '#먼치', '밤톨#', '밤톨##먼치', '밤톨#먼치#먼치', '밤톨#가나다라마바사아자', '가 '.repeat(30) + '나'.repeat(11)]) {
    assert.throws(() => v.query(bad), /아이디.*1~6자/, bad);
  }
  assert.throws(() => v.query(undefined), /아이디/);
  // 예전 판(아이디 없는 줄)·모양이 다른 줄이 남아 있어도 찾기에 나오지 않는다
  assert.deepEqual(v.findPeople([{ nickname: '밤톨', level: 1, love: 1, worn: {}, k: '밤톨' }, { id: '밤톨', level: 1, love: 1, worn: {}, k: '밤톨' }], '밤톨').results, []);
});

test('주소: 헷갈리는 글자 없이 8자, 고르게', () => {
  let n = 0;
  const slug = v.makeSlug((k) => Uint8Array.from({ length: k }, () => (n++ * 37) % 256));
  assert.match(slug, v.SLUG);
  assert.equal(v.slugOf(' ABCDEFGH '), 'abcdefgh');
  for (const bad of ['abcdefg', 'abcdefgi', 'abcdefg1', 'abcdefgo', '', null]) assert.throws(() => v.slugOf(bad), /찾을 수 없어요/, String(bad));
});

test('서명: 먼치킨 서명은 통과, 내용·시간·키가 다르면 거절', async () => {
  const key = deviceKey(), b = signed(key, PAYLOAD());
  assert.equal(await v.verify(b, T0), key.id);
  await assert.rejects(() => v.verify({ ...b, payload: { ...b.payload, v: 3 } }, T0), /기기 확인/);
  await assert.rejects(() => v.verify(b, T0 + 61000), /만료/);
  await assert.rejects(() => v.verify({ ...b, publicKey: deviceKey().publicKey }, T0), /기기 확인/);
  await assert.rejects(() => v.verify({ ...b, action: 'login' }, T0), /올바르지/);
});

test('올리기: 승인된 기기만, v2 만, 처음 올리면 주소를 만들어 묶고, 다시 올리면 같은 주소에 바꿔 넣는다', async () => {
  const w = world(), key = deviceKey();
  let r = await body(await w.post(signed(key, PAYLOAD())));
  assert.equal(r.status, 403); assert.match(r.json.error, /승인/);
  assert.equal(w.store.nonces.size + w.store.hits.size, 0, '승인 안 된 키는 횟수·요청 번호 표에 쓰지 못한다');
  w.store.devices.set(key.id, { state: 'approved', review: false });
  // 예전 판(v1, 스푼 이름)은 거절하고 아무것도 만들지 않는다
  r = await body(await w.post(signed(key, { ...PAYLOAD(), v: 1, people: [{ nickname: '밤톨', level: 1, love: 5, worn: {} }] })));
  assert.equal(r.status, 400); assert.match(r.json.error, /업데이트/); assert.equal(w.store.pages.size, 0);
  w.clock.now += 61000;
  r = await body(await w.post(signed(key, PAYLOAD(), { at: w.clock.now })));
  assert.equal(r.status, 200, JSON.stringify(r.json)); assert.match(r.json.slug, v.SLUG); assert.equal(r.json.url, SITE + 'k/' + r.json.slug); assert.equal(r.json.count, 3);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  const slug = r.json.slug;
  w.clock.now += 61000;
  r = await body(await w.post(signed(key, PAYLOAD([PERSON('먼치팬', 999, { nickname: '스푼이름' })]), { at: w.clock.now })));
  assert.equal(r.json.slug, slug); assert.equal(w.store.pages.size, 1);
  assert.deepEqual(w.store.pages.get(slug).people, [{ id: '먼치팬#먼치', level: 10, love: 999, worn: { head: 'cat-ears' }, k: '먼치팬#먼치', ch: w.clock.now }]);
  assert.doesNotMatch(JSON.stringify([...w.store.pages.values()]), /nickname|스푼이름/, '서버에 저장된 것에 스푼 이름이 없다');
  // 캐릭터 이름 모양이 틀리면 거절
  w.clock.now += 61000;
  r = await body(await w.post(signed(key, { ...PAYLOAD(), character: { name: '먼치 킨' } }, { at: w.clock.now })));
  assert.equal(r.status, 400); assert.match(r.json.error, /캐릭터 이름/);
  // 같은 요청 번호는 두 번 받지 않는다
  w.clock.now += 61000;
  const once = signed(key, PAYLOAD(), { at: w.clock.now });
  assert.equal((await w.post(once)).status, 200); assert.equal((await w.post(once)).status, 409);
  // 1분에 2번까지
  assert.equal((await w.post(signed(key, PAYLOAD(), { at: w.clock.now }))).status, 429);
  // 심사용 기기는 올리지 않는다
  const review = deviceKey(); w.store.devices.set(review.id, { state: 'approved', review: true });
  r = await body(await w.post(signed(review, PAYLOAD(), { at: w.clock.now })));
  assert.equal(r.status, 403); assert.match(r.json.error, /심사용/);
  // 서명이 틀리면 거절, 너무 크면 거절, JSON 이 아니면 거절
  assert.equal((await w.post({ ...signed(key, PAYLOAD(), { at: w.clock.now }), signature: 'A'.repeat(86) })).status, 403);
  assert.equal((await w.post('x'.repeat(v.MAX_BODY_CHARS + 1))).status, 413);
  assert.equal((await w.post('{', {})).status, 400);
  assert.equal((await w.handle(new Request(BASE + 'app', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' }))).status, 415);
});

test('끄기: {enabled:false} 는 내용만 지우고 주소는 남긴다, 다시 켜면 같은 주소. 올린 적 없으면 아무것도 만들지 않는다', async () => {
  const w = world(), key = deviceKey(); w.store.devices.set(key.id, { state: 'approved', review: false });
  let r = await body(await w.post(signed(key, { enabled: false })));
  assert.deepEqual(r.json, { ok: true, enabled: false, slug: null, url: null }); assert.equal(w.store.pages.size, 0);
  w.clock.now += 61000;
  const slug = (await body(await w.post(signed(key, PAYLOAD(), { at: w.clock.now })))).json.slug;
  w.clock.now += 61000;
  r = await body(await w.post(signed(key, { enabled: false }, { at: w.clock.now })));
  assert.equal(r.json.slug, slug); assert.equal(w.store.pages.get(slug).updated, null); assert.deepEqual(w.store.pages.get(slug).people, []);
  r = await body(await w.get('page?slug=' + slug));
  assert.equal(r.status, 404); assert.equal(r.json.closed, true); assert.match(r.json.error, /닫아 두었어요/);
  w.clock.now += 61000;
  assert.equal((await body(await w.post(signed(key, PAYLOAD(), { at: w.clock.now })))).json.slug, slug);
});

test('공개 페이지·찾기: 1~3등(아이디)과 DJ 캐릭터, 전체 목록·찾기 열쇠·기기 번호는 내보내지 않는다. 차단된 기기의 페이지는 닫힌다', async () => {
  const w = world(), key = deviceKey(); w.store.devices.set(key.id, { state: 'approved', review: false });
  const slug = (await body(await w.post(signed(key, PAYLOAD([PERSON('밤톨', 50), PERSON('사탕요정', 300), PERSON('달무리', 120), PERSON('호박꽃', 10)]))))).json.slug;
  let r = await body(await w.get('page?slug=' + slug));
  assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'public, max-age=30');
  assert.deepEqual(Object.keys(r.json).sort(), ['character', 'count', 'name', 'paused', 'season', 'slug', 'top', 'updatedAt']);
  assert.equal(r.json.count, 4); assert.deepEqual(r.json.top.map((p) => [p.rank, p.id]), [[1, '사탕요정#먼치'], [2, '달무리#먼치'], [3, '밤톨#먼치']]); assert.equal(r.json.updatedAt, new Date(T0).toISOString());
  for (const p of r.json.top) assert.deepEqual(Object.keys(p).sort(), ['hearts', 'id', 'level', 'rank', 'worn'], '애정도 숫자는 숨기고 하트 수를 싣는다');
  assert.doesNotMatch(JSON.stringify(r.json), new RegExp(key.id + '|"k"|"ch"|"love"|device|nickname'));
  const want = { results: [{ rank: 4, id: '호박꽃#먼치', level: 1, worn: { head: 'cat-ears' }, hearts: 0 }], exact: 1, more: false };
  assert.deepEqual((await body(await find(w, slug, '호박꽃'))).json, want, '앞 부분만');
  assert.deepEqual((await body(await find(w, slug, '호박꽃#먼치'))).json, want, '전체 아이디');
  r = await body(await find(w, slug, ''));
  assert.equal(r.status, 400); assert.match(r.json.error, /아이디.*1~6자/);
  assert.equal((await find(w, slug, 'abc')).status, 400);
  assert.equal((await w.get('page?slug=nope')).status, 404);
  assert.equal((await w.get('page?slug=abcdefgh')).status, 404);
  r = await body(await w.get('health'));
  assert.deepEqual(r.json, { service: 'jun-live-kiugi', v: 2, hearts: true });
  assert.equal((await w.handle(new Request(BASE + 'page', { method: 'OPTIONS' }))).status, 204);
  // 주소마다 찾기는 1분에 30번
  for (let i = 0; i < 29; i++) await find(w, slug, '밤', '9.9.9.9');
  assert.equal((await find(w, slug, '밤', '9.9.9.9')).status, 200);
  assert.equal((await find(w, slug, '밤', '9.9.9.9')).status, 429);
  assert.equal((await find(w, slug, '밤', '8.8.8.8')).status, 200, '다른 주소는 따로 센다');
  w.store.devices.set(key.id, { state: 'revoked', review: false });
  assert.equal((await w.get('page?slug=' + slug)).status, 404);
  assert.equal((await find(w, slug, '밤', '7.7.7.7')).status, 404);
});

test('예전 판(v1)으로 저장된 줄이 남아 있어도 공개 페이지·찾기에는 이름이 나가지 않는다', async () => {
  const w = world(), key = deviceKey(); w.store.devices.set(key.id, { state: 'approved', review: false });
  const slug = (await body(await w.post(signed(key, PAYLOAD())))).json.slug;
  Object.assign(w.store.pages.get(slug), { top: [{ rank: 1, nickname: '옛이름', level: 3, love: 9, worn: {} }], people: [{ nickname: '옛이름', level: 3, love: 9, worn: {}, k: '옛이름' }] });
  const r = await body(await w.get('page?slug=' + slug));
  assert.equal(r.status, 200); assert.deepEqual(r.json.top, []); assert.doesNotMatch(JSON.stringify(r.json), /옛이름|nickname/);
  assert.deepEqual((await body(await find(w, slug, '옛이름'))).json.results, []);
});

test('60일 동안 올리지 않은 페이지는 가끔 한 번씩 내용을 지운다', async () => {
  let roll = 0.5;
  const w = world({ chance: () => roll }), a = deviceKey(), b = deviceKey();
  for (const k of [a, b]) w.store.devices.set(k.id, { state: 'approved', review: false });
  const slugA = (await body(await w.post(signed(a, PAYLOAD())))).json.slug;
  w.clock.now += v.KEEP_MS + 1000; roll = 0;
  await body(await w.post(signed(b, PAYLOAD(), { at: w.clock.now })));
  await new Promise((r) => setImmediate(r));
  assert.equal(w.store.pages.get(slugA).updated, null);
  assert.equal((await w.get('page?slug=' + slugA)).status, 404);
});
