// 사이트 전체: 남은 화면은 첫 화면(먼치킨 DJ 키우기 안내)과 키우기 페이지(k/<주소>), 스푼 연결 페이지(spoon.html).
// 팬페이지 서비스(p/…, studio, app, 사연 보내기)는 마쳤다 → 그 주소는 'ended' 안내.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { computeBase, stripBase, parseRoute, buildPath } from '../docs/lib/route.js';

const B = '/jun-live-fanpage/';
const docs = fileURLToPath(new URL('../docs/', import.meta.url));
const text = (p) => readFile(docs + p, 'utf8');
async function siteScripts() {
  const out = ['app.js', 'api.js', 'mock.js', 'spoon.js'];
  for (const dir of ['lib', 'views']) for (const f of (await readdir(docs + dir)).filter((x) => x.endsWith('.js'))) out.push(`${dir}/${f}`);
  return out;
}

test('BASE 와 BASE 떼기', () => {
  assert.equal(computeBase('/jun-live-fanpage/app.js'), B);
  assert.equal(computeBase('/app.js'), '/');
  assert.equal(stripBase('/jun-live-fanpage/k/nyangdj7', B), 'k/nyangdj7');
  assert.equal(stripBase('/jun-live-fanpage', B), '');
  assert.equal(stripBase('/k/nyangdj7/', '/'), 'k/nyangdj7');
});

test('주소 해석: 첫 화면·키우기·마친 팬페이지 주소·없는 주소', () => {
  for (const p of ['/jun-live-fanpage/', '/jun-live-fanpage', '/jun-live-fanpage/index.html', '/jun-live-fanpage/404.html', '/']) assert.deepEqual(parseRoute(p, B), { name: 'intro' }, p);
  for (const p of ['/jun-live-fanpage/p/haru', '/jun-live-fanpage/p/haru/story', '/jun-live-fanpage/p/haru/post/p_1', '/jun-live-fanpage/studio', '/jun-live-fanpage/app', '/p/haru/m_x8k2']) assert.deepEqual(parseRoute(p, p.startsWith(B) ? B : '/'), { name: 'ended' }, p);
  for (const p of ['/jun-live-fanpage/xyz', '/jun-live-fanpage/k', '/jun-live-fanpage/kiugi/x', '/jun-live-fanpage/%E0%A4%A']) assert.equal(parseRoute(p, B).name, 'notfound', p);
  assert.equal(buildPath(B, { name: 'intro' }), B);
  assert.equal(buildPath('/', { name: 'kiugi', slug: 'abcdefgh' }), '/k/abcdefgh');
});

test('모든 화면 모듈을 문법 오류 없이 읽고, 지운 팬페이지 모듈을 부르지 않는다', async () => {
  for (const f of (await siteScripts()).filter((x) => x !== 'app.js' && x !== 'spoon.js')) await import(`../docs/${f}`);
  for (const f of ['app.js', 'spoon.js']) {
    const r = spawnSync(process.execPath, ['--check', docs + f], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  }
  assert.deepEqual((await readdir(docs + 'views')).sort(), ['common.js', 'intro.js', 'kiugi.js']);
  assert.deepEqual((await readdir(docs + 'lib')).sort(), ['dom.js', 'kiugi-draw.js', 'route.js', 'text.js']);
  for (const f of await siteScripts()) {
    const src = await text(f);
    assert.doesNotMatch(src, /views\/(fan|studio|mobile|story|forms|photos)|lib\/(config|days|device|image|photo|samples)\.js/, f);
    assert.doesNotMatch(src, /functions\/v1\/fanpage|fp-photos|owner\/|팬페이지 꾸미기/, f);
    assert.doesNotMatch(src, /닉네임|nickname/i, f + ': 사이트는 스푼 닉네임을 다루지 않는다');
  }
});

test('index.html = 404.html(SPA), 화면 보안 규칙, 첫 화면 글', async () => {
  const index = await text('index.html');
  assert.equal(await text('404.html'), index);
  assert.match(index, /<title>먼치킨 DJ 키우기<\/title>/);
  assert.match(index, /script-src 'self'/); assert.match(index, /connect-src 'self' https:\/\/aksegkhhugqvvaidgvro\.supabase\.co/);
  const intro = await text('views/intro.js');
  assert.match(intro, /DJ가 알려 준 키우기 주소로 들어가면 청취자들이 꾸민 캐릭터를 볼 수 있어요\./);
  assert.match(intro, /스푼이 만든 서비스가 아니에요/);
  assert.match(intro, /\?demo=1/);
  assert.match(intro, /팬페이지 서비스를 마쳤어요/);
  // 첫 화면은 칸 목록으로 그린다(나중에 "지금 인기 있는 캐릭터" 칸을 더할 자리)
  const { LANDING_SECTIONS } = await import('../docs/views/intro.js');
  assert.ok(Array.isArray(LANDING_SECTIONS) && LANDING_SECTIONS.length >= 1 && LANDING_SECTIONS.every((f) => typeof f === 'function'));
});

test('스푼 연결 페이지(spoon.html)는 그대로 있다', async () => {
  const html = await text('spoon.html');
  assert.match(html, /\/jun-live-fanpage\/spoon\.js/); assert.match(html, /\/jun-live-fanpage\/spoon\.css/);
  assert.match(await text('spoon.js'), /functions\/v1\/spoon-link\/callback/);
});
