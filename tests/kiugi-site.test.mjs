// DJ 키우기 페이지(사이트): 주소 k/<주소> · 그림(kiugi-art.js 를 사이트 규칙에 맞게) · 체험 모드 가짜 서버 · 화면 글
// 아이디는 모두 지어낸 것(청취자가 방송에서 "!아이디"로 만드는 시즌 아이디 흉내, 모양 "<앞>#<캐릭터 이름>").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseRoute, buildPath, DEMO_KIUGI_SLUG } from '../docs/lib/route.js';
import { buildCatalog, expressionFor, cspSafeSvg, characterMarkup, itemMarkup, paintMarkup, STAGE, wornList, slotName } from '../docs/lib/kiugi-draw.js';
import { handle, KIUGI_DEMO } from '../docs/mock.js';
import { personLine, seasonLine, josa, checkQuery, idKey } from '../docs/views/kiugi.js';
import { levelLine, heartText, baseOf } from '../docs/views/cards.js';
import { itemGroups, wearLine, unit, REWARD_NOTE } from '../docs/views/items.js';
import { heartToken, heartKey, sentToday, markSent, kstDay, makeToken } from '../docs/lib/hearts.js';

const B = '/jun-live-fanpage/';
const read = async (p) => JSON.parse(await readFile(new URL('../docs/kiugi/' + p, import.meta.url), 'utf8'));
const catalog = async () => {
  const manifest = await read('manifest.json');
  return buildCatalog(await Promise.all(manifest.seasons.map(read)), { files: manifest.files, adjust: {} });
};

test('주소 k/<8자>: 헷갈리는 글자·다른 길이는 notfound, 만들고 다시 읽기', () => {
  assert.deepEqual(parseRoute('/jun-live-fanpage/k/nyangdj7', B), { name: 'kiugi', slug: 'nyangdj7' });
  assert.deepEqual(parseRoute('/k/nyangdj7/', '/'), { name: 'kiugi', slug: 'nyangdj7' });
  for (const bad of ['/jun-live-fanpage/k/nyangdj1', '/jun-live-fanpage/k/NYANGDJ7', '/jun-live-fanpage/k/nyangd', '/jun-live-fanpage/k/nyangdj7/x', '/jun-live-fanpage/k/']) assert.equal(parseRoute(bad, B).name, 'notfound', bad);
  assert.equal(buildPath(B, { name: 'kiugi', slug: 'nyangdj7' }), '/jun-live-fanpage/k/nyangdj7');
  assert.deepEqual(parseRoute(buildPath(B, { name: 'kiugi', slug: 'abcdefgh' }), B), { name: 'kiugi', slug: 'abcdefgh' });
  assert.equal(KIUGI_DEMO.slug, DEMO_KIUGI_SLUG);
});

test('사이트에 복사한 키우기 파일(그림 V5): 그림 스크립트·모양 규칙·머리색(tone-map-v1)·그림 목록·시즌 목록·manifest, 예전 V4·V3·V2 그림 폴더는 없다', async () => {
  const manifest = await read('manifest.json');
  assert.equal(manifest.v, 1); assert.ok(manifest.seasons.includes('season-s1.json')); assert.equal(manifest.files.v5.length, 379, '파츠 248(캐릭터 238 + 배경 10) + 마스크 131'); assert.equal(manifest.files.v4, undefined, '예전 V4 그림(가장자리 정리 전 뒷머리 포함)은 뺐다'); assert.equal(manifest.files.s1, undefined); assert.equal(manifest.files.v3, undefined, '예전 V3 그림(V4 에서 지운 옷 포함)은 사이트에서도 뺐다');
  const s1 = await read('season-s1.json');
  assert.equal(s1.season.id, 's1'); assert.equal(s1.art, 'v5'); assert.equal(s1.items.length, 75, '한벌옷 5 · 상의 20 · 하의 20 · 신발 10 · 악세 10 · 배경 10');
  for (const name of ['kiugi-art.js', 'kiugi-look.js', 'kiugi-hair-color.js', 'kiugi-v5-data.js', 'v5/hair-color-luts.json']) await readFile(new URL('../docs/kiugi/' + name, import.meta.url));
  await assert.rejects(readFile(new URL('../docs/kiugi/kiugi-v4-data.js', import.meta.url)));
  await assert.rejects(readFile(new URL('../docs/kiugi/kiugi-v3-data.js', import.meta.url)));
  await assert.rejects(readFile(new URL('../docs/kiugi/s1/adjust.json', import.meta.url)));
});

test('옷 표·레벨 표정(그림 V5): 한벌옷·상의·하의·신발·악세사리(묶음·번호)와 시즌 보상, 입은 옷 칸(보상 왕관·날개·오라는 뒤에), 모르는 시즌은 마지막 시즌 표정', async () => {
  const c = await catalog();
  assert.deepEqual(c.items.outfit_02, { slot: 'outfit', cat: 'outfit', number: 2, season: 's1', name: '크림슨 나이트 간호사', tier: 'fine', tierName: '고급', price: 600, level: 3 }, '값·레벨은 등급표에서(먼치킨 rules.mjs 와 같게)');
  assert.deepEqual(c.items.acc2_03, { slot: 'head', cat: 'acc', number: 3, season: 's1', name: '유령의 야근 머리띠', tier: 'basic', tierName: '기본', price: 50, level: 1 });
  assert.deepEqual(c.items.top_05, { slot: 'top', cat: 'top', number: 5, season: 's1', name: '미드나잇 블랙 집업', tier: 'fine', tierName: '고급', price: 600, level: 3 });
  assert.deepEqual(c.items['pumpkin-crown'], { slot: 'crown', season: 's1', name: '황금 호박 왕관', reward: true, price: 15000, level: 10 });
  assert.deepEqual(c.items.top_17, { slot: 'top', cat: 'top', number: 17, season: 's1', name: '스모키 라일락 트위드 재킷', tier: 'rare', tierName: '희귀', price: 2000, level: 6 }, '새 상의 11~20');
  assert.deepEqual(c.items.bottom_15, { slot: 'bottom', cat: 'bottom', number: 15, season: 's1', name: '블랙스완 새틴 롱스커트', tier: 'fine', tierName: '고급', price: 600, level: 3 }, '새 하의 11~20');
  for (const old of ['outfit_07', 'shoe_03', 'accessory_01']) assert.equal(c.items[old], undefined, old + ' — V4 에서 지운 옷');
  assert.deepEqual(c.items['moonlight-aura'], { slot: 'aura', season: 's1', name: '달빛 오라', reward: true, price: 15000, level: 10 });
  assert.deepEqual(c.seasons.s1.rewardRule, { minLevel: 10, minAttendance: 20 });
  assert.deepEqual(c.seasons.s1.slots.map((s) => s.id), ['outfit', 'top', 'bottom', 'shoes', 'head', 'face', 'neck', 'hand', 'bg']);
  assert.deepEqual(c.seasons.s1.categories.map((s) => [s.id, s.code]), [['outfit', '한벌'], ['top', '상의'], ['bottom', '하의'], ['shoes', '신발'], ['acc', '악세'], ['bg', '배경']]);
  assert.deepEqual(c.items.background_04, { slot: 'bg', cat: 'bg', number: 4, season: 's1', name: '벨벳 고딕 홀', tier: 'rare', tierName: '희귀', price: 2000, level: 6 });
  assert.deepEqual(wornList(c, 's1', { aura: 'moonlight-aura', hand: 'acc2_10', crown: 'pumpkin-crown', outfit: 'outfit_01', head: 'witch-hat', top: 'no-such', shoes: 'shoe_03', wings: 'shadow-wings' }).map((w) => [w.slotName, w.name]),
    [['한벌옷', '체크메이트 블랙 캣'], ['손 장식', '막차 호박 랜턴'], ['왕관', '황금 호박 왕관'], ['날개', '그림자 날개'], ['오라', '달빛 오라']], '시즌 칸 순서, 보상은 왕관·날개·오라 차례로 뒤에, 목록에 없는 옷(예전 V2 옷·V4 에서 지운 V3 신발 등)은 뺀다');
  assert.equal(slotName(c, 's1', 'neck'), '목 장식');
  assert.equal(expressionFor(c, 's1', 1).name, '기본'); assert.equal(expressionFor(c, 's1', 8).name, '하트 눈'); assert.equal(expressionFor(c, 's1', 99).name, '사랑 가득');
  assert.equal(expressionFor(c, 's9', 8).name, '하트 눈');
  assert.equal(expressionFor(buildCatalog([]), 's1', 5).name, '기본');
});

test('그림 글을 사이트 규칙(CSP: 인라인 style 금지)과 사이트 주소에 맞게: style→fill, 그림 파일은 BASE/kiugi/v3 아래, 마스크는 속성으로', async () => {
  assert.equal(cspSafeSvg('<svg><rect style="fill:var(--kg-stage,#EFE9F8)"/><image href="/kiugi/v5/a.png?v=0123456789ab"/><g style="opacity:.5"/></svg>', B),
    '<svg><rect fill="#EFE9F8"/><image href="/jun-live-fanpage/kiugi/v5/a.png?v=0123456789ab"/><g/></svg>');
  const c = await catalog();
  // 예전 판 먼치킨이 올린 DJ 캐릭터(V2 값 long·skin)도 가장 비슷한 V3 그림으로
  const svg = characterMarkup(c, { name: '먼치', gender: 'f', hair: 'long', hairColor: 'pink', skin: 's2' }, { outfit: 'outfit_03', top: 'top_01', shoes: 'shoe2_02', head: 'acc2_01', face: '<script>', aura: 'moonlight-aura' }, 8, { seasonId: 's1', base: B, label: '밤톨이님의 "캐릭터"' });
  assert.doesNotMatch(svg, / style="/); assert.match(svg, new RegExp(`fill="${STAGE}"`));
  for (const f of ['female_body', 'female_hair_02_back', 'female_hair_02_front', 'outfit_03_female', 'outfit_03_female_cut', 'shoe2_02_female', 'shoe2_02_female_cut', 'acc2_01_female', 'reward_03_female']) assert.match(svg, new RegExp(`href="/jun-live-fanpage/kiugi/v5/${f}\\.png\\?v=[0-9a-f]{12}"`), f);
  assert.doesNotMatch(svg, /top_01_female/, '한벌옷이 상의를 덮는다');
  assert.match(svg, /mask="url\(#kg[a-z0-9]+_outfitc\)"/); assert.match(svg, /mask-type="alpha"/);
  assert.doesNotMatch(svg, /href="\/kiugi\//);
  assert.match(svg, /aria-label="밤톨이님의 &quot;캐릭터&quot;"/);
  assert.doesNotMatch(svg, /<script/, '이상한 옷 id 는 그리지 않는다');
  assert.match(svg, /^<svg viewBox="0 0 1024 1024"/);
  // 옷 한 벌(도감): 기본 캐릭터가 그 옷만 입은 모습, 성별 버전, 시즌 보상은 배지, 예전 옷은 이름 자리 표시
  assert.match(itemMarkup(c, 'outfit_05', { base: B, gender: 'm' }), /kiugi\/v5\/outfit_05_male\.png/);
  assert.match(itemMarkup(c, 'top_05', { base: B }), /kiugi\/v5\/top_05_female\.png/);
  assert.match(itemMarkup(c, 'pumpkin-crown', { base: B, gender: 'm' }), /kiugi\/v5\/reward_01_male\.png/, '시즌 보상도 그림(V5)');
  assert.match(itemMarkup(c, 'witch-hat', { base: B }), />witch-hat</);
  assert.doesNotMatch(itemMarkup(c, 'shoe_03', { base: B }), /<image/, 'V4 에서 지운 옛 신발은 이름 자리 표시');
  // 배경(BG10): 맨 아래 장면(남녀 같은 그림), 옷 도감 칸은 장면 전체
  const withBg = characterMarkup(c, { gender: 'm' }, { bg: 'background_03', top: 'top_02' }, 1, { base: B, stage: null });
  assert.match(withBg, /href="\/jun-live-fanpage\/kiugi\/v5\/background_03\.png\?v=[0-9a-f]{12}"[^>]*data-step="background"/);
  assert.ok(withBg.indexOf('data-step="background"') < withBg.indexOf('data-step="hair.back"'));
  assert.match(itemMarkup(c, 'background_03', { base: B }), /viewBox="0 0 1024 1024"/);
  assert.doesNotMatch(characterMarkup(c, { gender: 'f' }, { bg: 'halloween-night' }, 1, { base: B }), /background_/, '예전(V2) 배경 id 는 그리지 않는다');
});

test('그림 칸 넣기(paintMarkup): 그림을 다 받은 뒤 한 번에, 빨리 여러 번 그리면 마지막 것만, 못 받은 그림은 칸에 표시', async () => {
  const c = await catalog();
  const stage = { dataset: {}, kids: null, replaceChildren(...k) { this.kids = k; } };
  const a = characterMarkup(c, { gender: 'f' }, { outfit: 'outfit_01' }, 1, { base: B }), b = characterMarkup(c, { gender: 'm' }, { outfit: 'outfit_02' }, 1, { base: B });
  const slow = (u) => new Promise((r) => setTimeout(r, u.includes('outfit_01') ? 30 : 1));
  const [ra, rb] = await Promise.all([paintMarkup(stage, a, { load: slow, make: (m) => ({ m }) }), paintMarkup(stage, b, { load: slow, make: (m) => ({ m }) })]);
  assert.deepEqual([ra, rb], [false, true]); assert.equal(stage.kids[0].m, b);
  await paintMarkup(stage, a, { load: (u) => (u.includes('outfit_01_female.png') ? Promise.reject(new Error('x')) : Promise.resolve()), make: (m) => ({ m }) });
  assert.equal(stage.dataset.kgArtError, '1');
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

test('첫 화면 숫자 칸(시즌 번호·남은 날, 한국 날짜)과 캐릭터 페이지 입은 옷 칸(빈 칸 포함)', async () => {
  // (2026-10-09 두 번째 새 디자인: 영문 머리글 "SEASON 01" 은 없앴다 — 시즌 띠는 seasonLine 글 + D-52)
  const { seasonNo, daysLeft, dDay } = await import('../docs/views/kiugi.js');
  const { loadoutSlots } = await import('../docs/views/character.js');
  const s = { id: 's1', name: '할로윈', endsAt: '2026-11-30T23:59:59+09:00' };
  assert.equal(seasonNo(s), 1); assert.equal(seasonNo(null), null);
  assert.equal(daysLeft(s, Date.parse('2026-10-09T00:00:00Z')), 52); assert.equal(dDay(s, Date.parse('2026-10-09T00:00:00Z')), 'D-52');
  assert.equal(dDay(s, Date.parse('2026-11-29T15:30:00Z')), 'D-DAY', '한국 날짜로 마지막 날');
  assert.equal(daysLeft(s, Date.parse('2026-12-05T00:00:00Z')), 0, '지나면 0');
  assert.equal(daysLeft({ endsAt: 'x' }), null);
  const c = await catalog();
  const slots = loadoutSlots(c, 's1', { head: 'acc2_03', aura: 'moonlight-aura', top: 'witch-hat' });
  assert.deepEqual(slots.map((w) => [w.slot, w.id]), [['outfit', null], ['top', null], ['bottom', null], ['shoes', null], ['head', 'acc2_03'], ['face', null], ['neck', null], ['hand', null], ['bg', null], ['aura', 'moonlight-aura']]);
  assert.equal(slots[4].slotName, '머리 장식'); assert.equal(slots[4].name, '유령의 야근 머리띠'); assert.equal(slots[0].slotName, '한벌옷'); assert.equal(slots.at(-1).slotName, '오라');
  // 한벌옷을 입으면 상의·하의 칸은 "한벌옷이 덮고 있어요", 왕관을 쓰면 머리 장식 칸은 "왕관이 가려요"
  const covered = loadoutSlots(c, 's1', { outfit: 'outfit_01', crown: 'pumpkin-crown' });
  assert.deepEqual(covered.filter((w) => w.covered).map((w) => [w.slot, w.covered]), [['top', '한벌옷이 덮고 있어요'], ['bottom', '한벌옷이 덮고 있어요'], ['head', '왕관이 가려요']]);
  assert.ok(!loadoutSlots(c, 's1', { top: 'top_01' }).some((w) => w.covered));
});

test('옷 도감 묶음(그림 V4): 한벌옷·상의·하의·신발·악세사리 차례로, 번호(한벌1·상의3·악세3)·값·레벨·악세사리 자리·입은 사람 수, 시즌 보상은 따로', async () => {
  const c = await catalog();
  const { groups, rewards, rule } = itemGroups(c, 's1', new Map([['outfit_02', 4]]));
  assert.deepEqual(groups.map((g) => [g.name, g.code, g.items.length]), [['한벌옷', '한벌', 5], ['상의', '상의', 20], ['하의', '하의', 20], ['신발', '신발', 10], ['악세사리', '악세', 10], ['배경', '배경', 10]]);
  assert.deepEqual(groups[5].items.find((x) => x.id === 'background_08'), { id: 'background_08', name: '네온 유령 세탁소', price: 50, level: 1, tierName: '기본', count: 0, code: '배경8' });
  assert.deepEqual(groups[0].items.find((x) => x.id === 'outfit_02'), { id: 'outfit_02', name: '크림슨 나이트 간호사', price: 600, level: 3, tierName: '고급', count: 4, code: '한벌2' });
  assert.deepEqual(groups[2].items.find((x) => x.id === 'bottom_05'), { id: 'bottom_05', name: '벨벳 이클립스 랩스커트', price: 2000, level: 6, tierName: '희귀', count: 0, code: '하의5' });
  assert.deepEqual(groups[4].items.find((x) => x.id === 'acc2_04'), { id: 'acc2_04', name: '자정의 와인 안경', price: 200, level: 1, tierName: '일반', count: 0, code: '악세4', place: '얼굴 장식' });
  assert.deepEqual(['outfit', 'top', 'bottom', 'shoes', 'acc', 'bg'].map(unit), ['벌', '벌', '벌', '켤레', '개', '장']);
  assert.match(REWARD_NOTE(rule), /사면 캐릭터가 바로 입어요/); assert.doesNotMatch(REWARD_NOTE(rule), /배지/);
  assert.deepEqual(rewards.map((r) => [r.id, r.price, r.level]), [['pumpkin-crown', 15000, 10], ['shadow-wings', 15000, 10], ['moonlight-aura', 15000, 10]]);
  assert.deepEqual(rule, { minLevel: 10, minAttendance: 20 });
  assert.equal(wearLine(0), '아직 입은 사람이 없어요'); assert.equal(wearLine(1200), '1,200명이 입고 있어요');
  assert.deepEqual(itemGroups(c, 's9'), { groups: [], rewards: [] });
});