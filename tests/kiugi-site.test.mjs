// DJ 키우기 페이지(사이트): 주소 k/<주소> · 그림(kiugi-art.js 를 사이트 규칙에 맞게) · 체험 모드 가짜 서버 · 화면 글
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseRoute, buildPath } from '../docs/lib/route.js';
import { buildCatalog, expressionFor, cspSafeSvg, characterMarkup, STAGE } from '../docs/lib/kiugi-draw.js';
import { handle, KIUGI_DEMO } from '../docs/mock.js';
import { personLine, seasonLine, josa } from '../docs/views/kiugi.js';

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
  assert.deepEqual(c.items['witch-hat'], { slot: 'head', season: 's1', name: '마녀 모자' });
  assert.deepEqual(c.items['moonlight-aura'], { slot: 'aura', season: 's1', name: '달빛 오라', reward: true });
  assert.equal(expressionFor(c, 's1', 1).name, '기본'); assert.equal(expressionFor(c, 's1', 8).name, '하트 눈'); assert.equal(expressionFor(c, 's1', 99).name, '사랑 가득');
  assert.equal(expressionFor(c, 's9', 8).name, '하트 눈');
  assert.equal(expressionFor(buildCatalog([]), 's1', 5).name, '기본');
});

test('그림 글을 사이트 규칙(CSP: 인라인 style 금지)과 사이트 주소에 맞게: style→fill, 그림 파일은 BASE/kiugi/ 아래', async () => {
  assert.equal(cspSafeSvg('<svg><rect style="fill:var(--kg-stage,#EFE9F8)"/><image href="/kiugi/s1/a.png"/><g style="opacity:.5"/></svg>', B),
    '<svg><rect fill="#EFE9F8"/><image href="/jun-live-fanpage/kiugi/s1/a.png"/><g/></svg>');
  const c = await catalog();
  const svg = characterMarkup(c, { name: '도담', gender: 'f', hair: 'long', hairColor: 'pink', skin: 's2' }, { head: 'witch-hat', aura: 'moonlight-aura', face: '<script>' }, 8, { seasonId: 's1', base: B, label: '밤톨이님의 "캐릭터"' });
  assert.doesNotMatch(svg, / style="/); assert.match(svg, new RegExp(`fill="${STAGE}"`));
  assert.match(svg, /href="\/jun-live-fanpage\/kiugi\/s1\/base_f_s2\.png"/); assert.match(svg, /href="\/jun-live-fanpage\/kiugi\/s1\/s1_head_witch-hat\.png"/);
  assert.doesNotMatch(svg, /href="\/kiugi\//);
  assert.match(svg, /aria-label="밤톨이님의 &quot;캐릭터&quot;"/);
  assert.doesNotMatch(svg, /<script/, '이상한 옷 이름은 글자로만(그림 태그가 되지 않는다)');
  assert.match(svg, /^<svg viewBox="0 0 1024 1024"/);
});

test('체험 모드 가짜 서버: 열린 페이지·닫힌 페이지·없는 페이지·찾기(정확히 같은 닉네임 먼저)', async () => {
  const page = await handle('GET', 'kiugi/page', { slug: KIUGI_DEMO.slug });
  assert.equal(page.status, 200);
  assert.deepEqual(Object.keys(page.json).sort(), ['character', 'count', 'name', 'paused', 'season', 'slug', 'top', 'updatedAt']);
  assert.equal(page.json.top.length, 3); assert.equal(page.json.top[0].rank, 1);
  const closed = await handle('GET', 'kiugi/page', { slug: 'shutpg22' });
  assert.equal(closed.status, 404); assert.equal(closed.json.closed, true);
  assert.equal((await handle('GET', 'kiugi/page', { slug: 'abcdefgh' })).status, 404);
  const found = (await handle('GET', 'kiugi/find', { slug: KIUGI_DEMO.slug, q: ' 밤 톨이 ' })).json;
  assert.equal(found.results[0].nickname, '밤톨이'); assert.equal(found.exact, 1); assert.ok(found.results.length >= 2);
  assert.equal((await handle('GET', 'kiugi/find', { slug: KIUGI_DEMO.slug, q: '' })).status, 400);
});

test('화면 글: 순위·레벨 표정·애정도, 시즌 끝나는 날', async () => {
  const c = await catalog();
  assert.deepEqual(personLine({ rank: 4, nickname: '사탕요정', level: 7, love: 2345 }, c, 's1'), { title: '4등 · 사탕요정', sub: 'Lv.7 두근두근 · 애정도 2,345' });
  assert.equal(seasonLine({ name: '할로윈', endsAt: '2026-11-30T14:59:59.000Z' }, Date.parse('2026-10-20T00:00:00Z')), '할로윈 시즌 · 11월 30일까지');
  assert.equal(seasonLine(null), '다음 시즌 준비 중');
  assert.equal(josa('도담', '을', '를'), '도담을'); assert.equal(josa('두부', '을', '를'), '두부를');
  assert.equal(josa('도담', '이', '가'), '도담이'); assert.equal(josa('DJ', '이', '가'), 'DJ가'); assert.equal(josa('루나7', '이', '가'), '루나7이');
});
