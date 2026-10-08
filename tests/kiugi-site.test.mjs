// DJ 키우기 페이지(사이트): 주소 k/<주소> · 그림(kiugi-art.js 를 사이트 규칙에 맞게) · 체험 모드 가짜 서버 · 화면 글
// 아이디는 모두 지어낸 것(청취자가 방송에서 "!아이디"로 만드는 시즌 아이디 흉내, 모양 "<앞>#<캐릭터 이름>").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseRoute, buildPath, DEMO_KIUGI_SLUG } from '../docs/lib/route.js';
import { buildCatalog, expressionFor, cspSafeSvg, characterMarkup, STAGE, wornList, slotName } from '../docs/lib/kiugi-draw.js';
import { handle, KIUGI_DEMO } from '../docs/mock.js';
import { personLine, seasonLine, josa, checkQuery, idKey } from '../docs/views/kiugi.js';
import { levelLine, heartText, baseOf } from '../docs/views/cards.js';
import { itemGroups, wearLine } from '../docs/views/items.js';
import { heartToken, heartKey, sentToday, markSent, kstDay, makeToken } from '../docs/lib/hearts.js';

const B = '/jun-live-fanpage/';
const read = async (p) => JSON.parse(await readFile(new URL('../docs/kiugi/' + p, import.meta.url), 'utf8'));
const catalog = async () => {
  const manifest = await read('manifest.json');
  return buildCatalog(await Promise.all(manifest.seasons.map(read)), { files: { s1: ['base_f_s2.png', 's1_head_witch-hat.png'] }, adjust: { s1: {} } });
};

test('주소 k/<8자>: 헷갈리는 글자·다른 길이는 notfound, 만들고 다시 읽기', () => {
  assert.deepEqual(parseRoute('/jun-live-fanpage/k/nyangdj7', B), { name: 'kiugi', slug: 'nyangdj7' });
  assert.deepEqual(parseRoute('/k/nyangdj7/', '/'), { name: 'kiugi', slug: 'nyangdj7' });
  for (const bad of ['/jun-live-fanpage/k/nyangdj1', '/jun-live-fanpage/k/NYANGDJ7', '/jun-live-fanpage/k/nyangd', '/jun-live-fanpage/k/nyangdj7/x', '/jun-live-fanpage/k/']) assert.equal(parseRoute(bad, B).name, 'notfound', bad);
  assert.equal(buildPath(B, { name: 'kiugi', slug: 'nyangdj7' }), '/jun-live-fanpage/k/nyangdj7');
  assert.deepEqual(parseRoute(buildPath(B, { name: 'kiugi', slug: 'abcdefgh' }), B), { name: 'kiugi', slug: 'abcdefgh' });
  assert.equal(KIUGI_DEMO.slug, DEMO_KIUGI_SLUG);
});

test('사이트에 복사한 키우기 파일: 그림 스크립트·시즌 목록·목록(manifest)', async () => {
  const manifest = await read('manifest.json');
  assert.equal(manifest.v, 1); assert.ok(manifest.seasons.includes('season-s1.json')); assert.ok(Array.isArray(manifest.files.s1));
  const s1 = await read('season-s1.json');
  assert.equal(s1.season.id, 's1'); assert.ok(s1.items.length > 20);
  await readFile(new URL('../docs/kiugi/s1/adjust.json', import.meta.url));
});

test('옷 표·레벨 표정: 시즌 옷과 시즌 보상(보상 표시), 모르는 시즌은 마지막 시즌 표정', async () => {
  const c = await catalog();
  assert.deepEqual(c.items['witch-hat'], { slot: 'head', season: 's1', name: '마녀 모자', tier: 'fine', tierName: '고급', price: 600, level: 3 }, '값·레벨은 등급표에서(먼치킨 rules.mjs 와 같게)');
  assert.deepEqual(c.items['cat-ears'], { slot: 'head', season: 's1', name: '고양이 귀 머리띠', tier: 'basic', tierName: '기본', price: 50, level: 1 });
  assert.deepEqual(c.items['moonlight-aura'], { slot: 'aura', season: 's1', name: '달빛 오라', reward: true, price: 15000, level: 10 });
  assert.deepEqual(c.seasons.s1.rewardRule, { minLevel: 10, minAttendance: 20 });
  assert.deepEqual(c.seasons.s1.slots.map((s) => s.id), ['head', 'face', 'neck', 'top', 'bottom', 'outer', 'shoes', 'hand', 'bg']);
  assert.deepEqual(wornList(c, 's1', { bg: 'candy-shop', head: 'witch-hat', aura: 'moonlight-aura', top: 'no-such' }).map((w) => [w.slotName, w.name]),
    [['머리', '마녀 모자'], ['상의', 'no-such'], ['배경', '사탕 가게'], ['오라', '달빛 오라']], '시즌 칸 순서, 모르는 칸은 뒤로, 모르는 옷은 id 그대로');
  assert.equal(slotName(c, 's1', 'bottom'), '하의·원피스');
  assert.equal(expressionFor(c, 's1', 1).name, '기본'); assert.equal(expressionFor(c, 's1', 8).name, '하트 눈'); assert.equal(expressionFor(c, 's1', 99).name, '사랑 가득');
  assert.equal(expressionFor(c, 's9', 8).name, '하트 눈');
  assert.equal(expressionFor(buildCatalog([]), 's1', 5).name, '기본');
});

test('그림 글을 사이트 규칙(CSP: 인라인 style 금지)과 사이트 주소에 맞게: style→fill, 그림 파일은 BASE/kiugi/ 아래', async () => {
  assert.equal(cspSafeSvg('<svg><rect style="fill:var(--kg-stage,#EFE9F8)"/><image href="/kiugi/s1/a.png"/><g style="opacity:.5"/></svg>', B),
    '<svg><rect fill="#EFE9F8"/><image href="/jun-live-fanpage/kiugi/s1/a.png"/><g/></svg>');
  const c = await catalog();
  const svg = characterMarkup(c, { name: '먼치', gender: 'f', hair: 'long', hairColor: 'pink', skin: 's2' }, { head: 'witch-hat', aura: 'moonlight-aura', face: '<script>' }, 8, { seasonId: 's1', base: B, label: '밤톨이님의 "캐릭터"' });
  assert.doesNotMatch(svg, / style="/); assert.match(svg, new RegExp(`fill="${STAGE}"`));
  assert.match(svg, /href="\/jun-live-fanpage\/kiugi\/s1\/base_f_s2\.png"/); assert.match(svg, /href="\/jun-live-fanpage\/kiugi\/s1\/s1_head_witch-hat\.png"/);
  assert.doesNotMatch(svg, /href="\/kiugi\//);
  assert.match(svg, /aria-label="밤톨이님의 &quot;캐릭터&quot;"/);
  assert.doesNotMatch(svg, /<script/, '이상한 옷 이름은 글자로만(그림 태그가 되지 않는다)');
  assert.match(svg, /^<svg viewBox="0 0 1024 1024"/);
});

test('체험 모드 가짜 서버: 열린 페이지·닫힌 페이지·없는 페이지·아이디로 찾기(정확히 같은 아이디 먼저)', async () => {
  const page = await handle('GET', 'kiugi/page', { slug: KIUGI_DEMO.slug });
  assert.equal(page.status, 200);
  assert.deepEqual(Object.keys(page.json).sort(), ['character', 'count', 'name', 'paused', 'season', 'slug', 'top', 'updatedAt']);
  assert.equal(page.json.name, '먼치');
  assert.equal(page.json.top.length, 3); assert.equal(page.json.top[0].rank, 1);
  assert.deepEqual(page.json.top.map((p) => p.id), ['밤톨#먼치', '사탕요정#먼치', '달무리#먼치']);
  for (const p of page.json.top) { assert.deepEqual(Object.keys(p).sort(), ['hearts', 'id', 'level', 'rank', 'worn']); assert.match(p.id, /^[가-힣]{1,6}#먼치$/); }
  assert.doesNotMatch(JSON.stringify(page.json), /nickname/);
  const closed = await handle('GET', 'kiugi/page', { slug: 'shutpg22' });
  assert.equal(closed.status, 404); assert.equal(closed.json.closed, true);
  assert.equal((await handle('GET', 'kiugi/page', { slug: 'abcdefgh' })).status, 404);
  const found = (await handle('GET', 'kiugi/find', { slug: KIUGI_DEMO.slug, q: ' 밤 톨 ' })).json;
  assert.deepEqual(found.results.map((p) => p.id), ['밤톨#먼치', '밤톨이네#먼치', '작은밤톨#먼치'], '앞 부분이 같은 사람 먼저, 그다음 들어 있는 사람');
  assert.equal(found.exact, 1);
  assert.deepEqual(Object.keys(found.results[0]).sort(), ['hearts', 'id', 'level', 'rank', 'worn']);
  assert.deepEqual((await handle('GET', 'kiugi/find', { slug: KIUGI_DEMO.slug, q: '사탕요정#먼치' })).json.results.map((p) => p.id), ['사탕요정#먼치'], '전체 아이디로');
  assert.equal((await handle('GET', 'kiugi/find', { slug: KIUGI_DEMO.slug, q: '먼치팬' })).json.results[0].id, '먼치팬#먼치', '안내 예시 아이디로 찾을 수 있다');
  assert.deepEqual((await handle('GET', 'kiugi/find', { slug: KIUGI_DEMO.slug, q: '먼치' })).json.results.map((p) => p.id), ['먼치팬#먼치'], '캐릭터 이름으로 찾아도 모두가 나오지 않는다(앞 부분끼리만 비교)');
  for (const q of ['', 'Pumpkin', '가'.repeat(7), '#먼치', '밤톨#']) {
    const r = await handle('GET', 'kiugi/find', { slug: KIUGI_DEMO.slug, q });
    assert.equal(r.status, 400, q); assert.match(r.json.error, /아이디.*1~6자/);
  }
});

test('화면 글: 순위·아이디·레벨 표정·하트(애정도 숫자 없음), 시즌 끝나는 날, 찾기 칸 검사', async () => {
  const c = await catalog();
  assert.deepEqual(personLine({ rank: 4, id: '사탕요정#먼치', level: 7, love: 2345, hearts: 3 }, c, 's1'), { title: '4등 · 사탕요정#먼치', sub: 'Lv.7 두근두근 · ♥ 3' });
  assert.equal(levelLine(c, 's1', 8), 'Lv.8 하트 눈'); assert.equal(heartText(1234), '♥ 1,234'); assert.equal(baseOf('밤톨#먼치'), '밤톨');
  assert.equal(seasonLine({ name: '할로윈', endsAt: '2026-11-30T14:59:59.000Z' }, Date.parse('2026-10-20T00:00:00Z')), '할로윈 시즌 · 11월 30일까지');
  assert.equal(seasonLine(null), '다음 시즌 준비 중');
  assert.equal(josa('먼치킨', '을', '를'), '먼치킨을'); assert.equal(josa('먼치', '을', '를'), '먼치를');
  assert.equal(josa('먼치킨', '이', '가'), '먼치킨이'); assert.equal(josa('DJ', '이', '가'), 'DJ가'); assert.equal(josa('루나7', '이', '가'), '루나7이');
  assert.equal(checkQuery(' 달 무리 '), null); assert.equal(idKey(' 달 무리 '), '달무리');
  assert.equal(checkQuery('밤톨'.normalize('NFD')), null);
  assert.match(checkQuery(''), /적어 주세요/); assert.match(checkQuery('   '), /적어 주세요/);
  assert.equal(checkQuery('먼치팬#먼치'), null); assert.equal(checkQuery(' 먼치팬 # Munchi7 '), null);
  for (const bad of ['abc', '밤톨1', '가나다라마바사', 'ㅂㅌ', '#먼치', '밤톨#', '밤톨#먼치#먼치', '밤톨#가나다라마바사아자']) assert.match(checkQuery(bad), /한글 1~6자/, bad);
});

test('체험 모드: 메인(home)·캐릭터(person)·전체 찾기(search)·하트(heart) — 지어낸 DJ 셋(먼치·쿠키·젤리)', async () => {
  const home = (await handle('GET', 'kiugi/home', {})).json;
  assert.deepEqual(Object.keys(home).sort(), ['djs', 'items', 'popular', 'recent', 'season', 'totals']);
  assert.deepEqual(home.djs.map((d) => d.name).sort(), ['먼치', '젤리', '쿠키']);
  assert.ok(home.popular.length > 0 && home.popular.length <= 12);
  assert.ok(home.popular.every((c, i, a) => c.hearts > 0 && (i === 0 || a[i - 1].hearts >= c.hearts)), '하트 많은 순');
  assert.deepEqual(Object.keys(home.popular[0]).sort(), ['djName', 'hearts', 'id', 'level', 'slug', 'worn']);
  assert.ok(home.recent.length > 0 && home.recent.length <= 8);
  assert.ok(home.items.length > 0 && home.items.every((x, i, a) => i === 0 || a[i - 1].count >= x.count));
  assert.equal(home.totals.djs, 3);
  assert.doesNotMatch(JSON.stringify(home), /"love"|"ch"|"k"|nickname/);
  const person = await handle('GET', 'kiugi/person', { slug: 'cuky2345', id: '귤껍질' });
  assert.equal(person.status, 200);
  assert.deepEqual(Object.keys(person.json).sort(), ['dj', 'hearts', 'id', 'level', 'season', 'worn']);
  assert.equal(person.json.id, '귤껍질#쿠키'); assert.equal(person.json.dj.name, '쿠키');
  assert.equal((await handle('GET', 'kiugi/person', { slug: 'cuky2345', id: '없는사람' })).status, 404);
  const s = (await handle('GET', 'kiugi/search', { q: '여름밤' })).json;
  assert.deepEqual(s.results.map((r) => r.djName).sort(), ['젤리', '쿠키']); assert.equal(s.exact, 2);
  assert.deepEqual((await handle('GET', 'kiugi/search', { q: '달무리#젤리' })).json.results.map((r) => r.slug), ['jery2468']);
  assert.equal((await handle('GET', 'kiugi/search', { q: 'abc' })).status, 400);
  const token = 'demoTOKENdemoTOKENdemoTOKEN12345';
  const before = person.json.hearts;
  assert.deepEqual((await handle('POST', 'kiugi/heart', {}, { slug: 'cuky2345', id: '귤껍질#쿠키', token })).json, { hearts: before + 1, already: false });
  assert.deepEqual((await handle('POST', 'kiugi/heart', {}, { slug: 'cuky2345', id: '귤껍질', token })).json, { hearts: before + 1, already: true });
  assert.equal((await handle('POST', 'kiugi/heart', {}, { slug: 'cuky2345', id: '귤껍질', token: 'x' })).status, 400);
});

test('하트 기억(lib/hearts.js): 브라우저 열쇠 32자, 오늘 보낸 캐릭터, 날짜가 바뀌면 다시, 저장소가 막혀도 동작', () => {
  const box = new Map();
  const storage = { getItem: (k) => (box.has(k) ? box.get(k) : null), setItem: (k, v) => box.set(k, String(v)) };
  const t = heartToken(storage, (n) => new Uint8Array(n).fill(7));
  assert.match(t, /^[A-Za-z0-9_-]{32}$/); assert.equal(heartToken(storage), t, '한 번 만들면 그대로');
  assert.match(makeToken(), /^[A-Za-z0-9_-]{32}$/);
  const key = heartKey('nyangdj7', '밤톨#먼치', 's1');
  const T = Date.parse('2026-10-20T12:00:00Z');
  assert.equal(kstDay(T), '2026-10-20');
  assert.equal(sentToday(storage, key, T), false);
  markSent(storage, key, T);
  assert.equal(sentToday(storage, key, T), true);
  assert.equal(sentToday(storage, heartKey('nyangdj7', '밤톨#먼치', 's2'), T), false, '시즌이 바뀌면 다시');
  assert.equal(sentToday(storage, key, T + 3 * 3600000), false, '한국 자정이 지나면 다시');
  const broken = { getItem() { throw new Error('막힘'); }, setItem() { throw new Error('막힘'); } };
  const t2 = heartToken(broken);
  assert.match(t2, /^[A-Za-z0-9_-]{32}$/); assert.equal(heartToken(broken), t2, '막힌 저장소는 이번 창에서만 기억');
  markSent(broken, 'x/y/z', T); assert.equal(sentToday(broken, 'x/y/z', T), true);
  assert.equal(sentToday(null, 'nope', T), false);
});

test('옷 도감 묶음: 시즌 칸 순서대로, 값·레벨·입은 사람 수, 시즌 보상은 따로', async () => {
  const c = await catalog();
  const { groups, rewards, rule } = itemGroups(c, 's1', new Map([['witch-hat', 4]]));
  assert.deepEqual(groups.map((g) => g.name), ['머리', '얼굴', '목', '상의', '하의·원피스', '겉옷·등', '신발', '손 소품', '배경']);
  const hat = groups[0].items.find((x) => x.id === 'witch-hat');
  assert.deepEqual(hat, { id: 'witch-hat', name: '마녀 모자', price: 600, level: 3, tierName: '고급', count: 4 });
  assert.equal(groups.reduce((n, g) => n + g.items.length, 0), 83);
  assert.deepEqual(rewards.map((r) => [r.id, r.price, r.level]), [['pumpkin-crown', 15000, 10], ['shadow-wings', 15000, 10], ['moonlight-aura', 15000, 10]]);
  assert.deepEqual(rule, { minLevel: 10, minAttendance: 20 });
  assert.equal(wearLine(0), '아직 입은 사람이 없어요'); assert.equal(wearLine(1200), '1,200명이 입고 있어요');
  assert.deepEqual(itemGroups(c, 's9'), { groups: [], rewards: [] });
});