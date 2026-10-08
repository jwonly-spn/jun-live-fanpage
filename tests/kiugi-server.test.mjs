// DJ 키우기 팬페이지 서버(supabase/functions/kiugi): 검사·모양(lib.ts) + 요청 처리(handler.ts)를 메모리 store 로.
// 서명은 먼치킨과 같은 방법(node:crypto, ieee-p1363)으로 만든다. 실제 서버·스푼에 닿지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as v from '../supabase/functions/kiugi/lib.ts';
import { createHandler } from '../supabase/functions/kiugi/handler.ts';

const SITE = 'https://jwonly-spn.github.io/jun-live-fanpage/';
const BASE = 'https://x.supabase.co/functions/v1/kiugi/';
const T0 = Date.parse('2026-10-20T12:00:00Z');

function deviceKey() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const spki = publicKey.export({ type: 'spki', format: 'der' });
  return { privateKey, publicKey: spki.toString('base64url'), id: crypto.createHash('sha256').update(spki).digest('hex') };
}
// 먼치킨(app/desktop/kiugi-fanpage.cjs)과 같은 서명
function signed(key, payload, { at = T0, nonce = crypto.randomBytes(24).toString('base64url'), action = 'upload' } = {}) {
  const body = { action, payload, publicKey: key.publicKey, timestamp: at, nonce };
  const digest = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  body.signature = crypto.sign('sha256', Buffer.from(`JUN-LIVE-KIUGI/1\n${action}\n${at}\n${nonce}\n${key.publicKey}\n${digest}`), { key: key.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return body;
}
const PERSON = (n, love, extra = {}) => ({ nickname: '팬' + n, level: 1 + Math.min(9, Math.floor(love / 100)), love, worn: { head: 'cat-ears' }, ...extra });
const PAYLOAD = (people = [PERSON(1, 50), PERSON(2, 300), PERSON(3, 120)]) => ({ enabled: true, v: 1, at: T0, paused: false, season: { id: 's1', name: '할로윈', endsAt: '2026-11-30T14:59:59.000Z' }, character: { name: '먼치', gender: 'f', hair: 'bob', hairColor: 'brown', skin: 's2', eyes: 'round', nose: 'dot', mouth: 'smile' }, people, top: [] });

function memoryStore(clock) {
  const s = { pages: new Map(), devices: new Map(), nonces: new Set(), hits: new Map(), calls: [] };
  return Object.assign(s, {
    ipSalt: async () => 'salt',
    hit: async (key, seconds, max) => { const k = key + ':' + Math.floor(clock.now / 1000 / seconds); const n = (s.hits.get(k) || 0) + 1; s.hits.set(k, n); return n <= max; },
    nonce: async (id) => { if (s.nonces.has(id)) return false; s.nonces.add(id); return true; },
    device: async (id) => s.devices.get(id) || null,
    pageByDevice: async (device) => { for (const p of s.pages.values()) if (p.device_id === device) return { slug: p.slug, updated: p.updated }; return null; },
    createPage: async (row) => {
      if ([...s.pages.values()].some((p) => p.device_id === row.device_id)) return 'device';
      if (s.pages.has(row.slug)) return 'slug';
      s.pages.set(row.slug, { ...row, updated: null, name: '', season: null, character: null, top: [], people: [], count: 0 }); return 'ok';
    },
    saveSnapshot: async (slug, snap, now) => { const p = s.pages.get(slug); Object.assign(p, { updated: now, name: snap.name, season: snap.season, character: snap.character, top: snap.top, people: snap.people, count: snap.count }); s.calls.push('save'); },
    clearSnapshot: async (slug) => { Object.assign(s.pages.get(slug), { updated: null, name: '', season: null, character: null, top: [], people: [], count: 0 }); s.calls.push('clear'); },
    publicPage: async (slug) => { const p = s.pages.get(slug); if (!p) return null; const { people, ...rest } = p; return structuredClone(rest); },
    people: async (slug) => { const p = s.pages.get(slug); return p ? { device_id: p.device_id, updated: p.updated, people: structuredClone(p.people) } : null; },
    expire: async (before) => { for (const p of s.pages.values()) if (p.updated !== null && p.updated < before) Object.assign(p, { updated: null, people: [], top: [], count: 0 }); },
    cleanNonces: async () => {}
  });
}
function world({ chance = () => 0.5 } = {}) {
  const clock = { now: T0 }, store = memoryStore(clock);
  let seed = 1;
  const handle = createHandler(store, { now: () => clock.now, chance, site: SITE, random: (n) => Uint8Array.from({ length: n }, () => (seed = (seed * 1103515245 + 12345) % 2147483648) % 256) });
  const post = (body, headers = {}) => handle(new Request(BASE + 'app', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
  const get = (path, ip = '1.1.1.1') => handle(new Request(BASE + path, { headers: { 'cf-connecting-ip': ip } }));
  return { store, clock, handle, post, get };
}
const body = async (r) => ({ status: r.status, json: await r.json(), headers: r.headers });

test('검사: 청취자 줄은 닉네임·레벨·애정도·입은 옷만, 이상한 줄은 그 줄만 빠진다, 애정도 순·같으면 보낸 순서', () => {
  const s = v.snapshot(PAYLOAD([
    PERSON(1, 50, { tag: 'jl-1', nyang: 10, userId: 3 }), PERSON(2, 300), { nickname: '  ', level: 1, love: 1 }, { nickname: 'x', level: 0, love: 1 }, { nickname: 'y', level: 1, love: -1 },
    { nickname: '\u202e가짜\u200b 이름 ', level: 2, love: 120, worn: { head: 'witch-hat', Bad: 'x', face: '<script>', bg: 'halloween-night', aura: 'moonlight-aura' } }, PERSON(4, 300)
  ]));
  assert.equal(s.enabled, true); assert.equal(s.count, 4); assert.equal(s.name, '먼치');
  assert.deepEqual(s.people.map((p) => p.nickname), ['팬2', '팬4', '가짜 이름', '팬1']);
  assert.deepEqual(s.people[2].worn, { head: 'witch-hat', bg: 'halloween-night', aura: 'moonlight-aura' });
  assert.equal(s.people[2].k, '가짜이름');
  assert.doesNotMatch(JSON.stringify(s), /jl-|nyang|userId|tag/);
  assert.deepEqual(s.top.map((p) => [p.rank, p.nickname]), [[1, '팬2'], [2, '팬4'], [3, '가짜 이름']]);
  assert.equal(s.top[0].k, undefined, '공개 1~3등에는 찾기 열쇠가 없다');
  assert.deepEqual(v.snapshot({ enabled: false, extra: 1 }), { enabled: false });
  assert.throws(() => v.snapshot({ enabled: true, v: 2 }), /업데이트/);
  assert.throws(() => v.snapshot({ ...PAYLOAD(), character: { name: '' } }), /캐릭터 이름/);
  assert.throws(() => v.snapshot({ ...PAYLOAD(), season: { id: 's1', name: '할로윈', endsAt: 'nope' } }), /시즌/);
  const paused = v.snapshot({ ...PAYLOAD(), paused: true, season: null });
  assert.equal(paused.season, null); assert.equal(paused.count, 0, '시즌이 없으면 청취자를 싣지 않는다');
  const big = v.snapshot(PAYLOAD(Array.from({ length: 3100 }, (_, i) => PERSON(i, 5000 - i))));
  assert.equal(big.count, 3000); assert.equal(big.people.at(-1).nickname, '팬2999');
  // 캐릭터는 이름표에 맞는 모양 열쇠만
  assert.deepEqual(v.character({ name: '먼치', hair: 'bob', skin: 'S2', evil: 'x', eyes: '<b>' }), { name: '먼치', hair: 'bob' });
  assert.deepEqual(v.character({ name: '두부', gender: 'm', hair: 'm_two-block' }), { name: '두부', gender: 'm', hair: 'm_two-block' }, '성별 머리 열쇠(밑줄)');
  assert.deepEqual(v.worn({ head: 'm_witch-hat', top: 'a b' }), { head: 'm_witch-hat' });
});

test('찾기: 정확히 같은 닉네임 먼저, 띄어쓰기·대소문자 무시, 5명까지, 순위 번호', () => {
  const s = v.snapshot(PAYLOAD([PERSON('a', 900, { nickname: '밤톨이 팬' }), PERSON('b', 800, { nickname: 'Bam' }), PERSON('c', 700, { nickname: '밤톨이' }), ...Array.from({ length: 8 }, (_, i) => PERSON(i, 100 - i, { nickname: '밤톨이' + i }))]));
  const r = v.findPeople(s.people, v.query(' 밤 톨이 '));
  assert.equal(r.results.length, 5); assert.equal(r.more, true); assert.equal(r.exact, 1);
  assert.deepEqual(r.results.slice(0, 2).map((p) => [p.rank, p.nickname]), [[3, '밤톨이'], [1, '밤톨이 팬']]);
  assert.deepEqual(v.findPeople(s.people, v.query('bAM')).results.map((p) => p.nickname), ['Bam']);
  assert.deepEqual(v.findPeople(s.people, v.query('없는사람')).results, []);
  assert.throws(() => v.query(''), /1~40/); assert.throws(() => v.query('가'.repeat(41)), /1~40/); assert.throws(() => v.query('\u200b'), /1~40/);
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
  await assert.rejects(() => v.verify({ ...b, payload: { ...b.payload, v: 2 } }, T0), /기기 확인/);
  await assert.rejects(() => v.verify(b, T0 + 61000), /만료/);
  await assert.rejects(() => v.verify({ ...b, publicKey: deviceKey().publicKey }, T0), /기기 확인/);
  await assert.rejects(() => v.verify({ ...b, action: 'login' }, T0), /올바르지/);
});

test('올리기: 승인된 기기만, 처음 올리면 주소를 만들어 묶고, 다시 올리면 같은 주소에 바꿔 넣는다', async () => {
  const w = world(), key = deviceKey();
  let r = await body(await w.post(signed(key, PAYLOAD())));
  assert.equal(r.status, 403); assert.match(r.json.error, /승인/);
  assert.equal(w.store.nonces.size + w.store.hits.size, 0, '승인 안 된 키는 횟수·요청 번호 표에 쓰지 못한다');
  w.store.devices.set(key.id, { state: 'approved', review: false });
  r = await body(await w.post(signed(key, PAYLOAD())));
  assert.equal(r.status, 200, JSON.stringify(r.json)); assert.match(r.json.slug, v.SLUG); assert.equal(r.json.url, SITE + 'k/' + r.json.slug); assert.equal(r.json.count, 3);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  const slug = r.json.slug;
  w.clock.now += 61000;
  r = await body(await w.post(signed(key, PAYLOAD([PERSON(9, 999)]), { at: w.clock.now })));
  assert.equal(r.json.slug, slug); assert.equal(w.store.pages.size, 1); assert.deepEqual(w.store.pages.get(slug).people.map((p) => p.nickname), ['팬9']);
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

test('공개 페이지·찾기: 1~3등과 DJ 캐릭터, 전체 목록·찾기 열쇠·기기 번호는 내보내지 않는다. 차단된 기기의 페이지는 닫힌다', async () => {
  const w = world(), key = deviceKey(); w.store.devices.set(key.id, { state: 'approved', review: false });
  const slug = (await body(await w.post(signed(key, PAYLOAD([PERSON(1, 50), PERSON(2, 300), PERSON(3, 120), PERSON(4, 10)]))))).json.slug;
  let r = await body(await w.get('page?slug=' + slug));
  assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'public, max-age=30');
  assert.deepEqual(Object.keys(r.json).sort(), ['character', 'count', 'name', 'paused', 'season', 'slug', 'top', 'updatedAt']);
  assert.equal(r.json.count, 4); assert.deepEqual(r.json.top.map((p) => p.nickname), ['팬2', '팬3', '팬1']); assert.equal(r.json.updatedAt, new Date(T0).toISOString());
  assert.doesNotMatch(JSON.stringify(r.json), new RegExp(key.id + '|"k"|device'));
  r = await body(await w.get('find?slug=' + slug + '&q=' + encodeURIComponent('팬4')));
  assert.deepEqual(r.json, { results: [{ rank: 4, nickname: '팬4', level: 1, love: 10, worn: { head: 'cat-ears' } }], exact: 1, more: false });
  assert.equal((await w.get('find?slug=' + slug + '&q=')).status, 400);
  assert.equal((await w.get('page?slug=nope')).status, 404);
  assert.equal((await w.get('page?slug=abcdefgh')).status, 404);
  assert.equal((await w.get('health')).status, 200);
  assert.equal((await w.handle(new Request(BASE + 'page', { method: 'OPTIONS' }))).status, 204);
  // 주소마다 찾기는 1분에 30번
  for (let i = 0; i < 29; i++) await w.get('find?slug=' + slug + '&q=x', '9.9.9.9');
  assert.equal((await w.get('find?slug=' + slug + '&q=x', '9.9.9.9')).status, 200);
  assert.equal((await w.get('find?slug=' + slug + '&q=x', '9.9.9.9')).status, 429);
  assert.equal((await w.get('find?slug=' + slug + '&q=x', '8.8.8.8')).status, 200, '다른 주소는 따로 센다');
  w.store.devices.set(key.id, { state: 'revoked', review: false });
  assert.equal((await w.get('page?slug=' + slug)).status, 404);
  assert.equal((await w.get('find?slug=' + slug + '&q=팬')).status, 404);
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
