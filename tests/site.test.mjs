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

test('주소 해석: 메인·옷 도감·DJ 키우기·캐릭터·마친 팬페이지 주소·없는 주소', () => {
  for (const p of ['/jun-live-fanpage/', '/jun-live-fanpage', '/jun-live-fanpage/index.html', '/jun-live-fanpage/404.html', '/']) assert.deepEqual(parseRoute(p, B), { name: 'intro' }, p);
  for (const p of ['/jun-live-fanpage/p/haru', '/jun-live-fanpage/p/haru/story', '/jun-live-fanpage/p/haru/post/p_1', '/jun-live-fanpage/studio', '/jun-live-fanpage/app', '/p/haru/m_x8k2']) assert.deepEqual(parseRoute(p, p.startsWith(B) ? B : '/'), { name: 'ended' }, p);
  for (const p of ['/jun-live-fanpage/xyz', '/jun-live-fanpage/k', '/jun-live-fanpage/kiugi/x', '/jun-live-fanpage/%E0%A4%A', '/jun-live-fanpage/items/x']) assert.equal(parseRoute(p, B).name, 'notfound', p);
  assert.deepEqual(parseRoute('/jun-live-fanpage/items', B), { name: 'items' });
  assert.deepEqual(parseRoute('/jun-live-fanpage/items/', B), { name: 'items' });
  assert.equal(buildPath(B, { name: 'intro' }), B);
  assert.equal(buildPath(B, { name: 'items' }), B + 'items');
  assert.equal(buildPath('/', { name: 'kiugi', slug: 'abcdefgh' }), '/k/abcdefgh');
});

test('캐릭터 페이지 주소 k/<주소>/<아이디 앞 부분>: 한글 1~6자만, 만들고 다시 읽기', () => {
  const path = buildPath(B, { name: 'character', slug: 'nyangdj7', base: '밤톨' });
  assert.equal(path, B + 'k/nyangdj7/' + encodeURIComponent('밤톨'));
  assert.deepEqual(parseRoute(path, B), { name: 'character', slug: 'nyangdj7', base: '밤톨' });
  assert.deepEqual(parseRoute('/k/nyangdj7/' + encodeURIComponent('밤톨'.normalize('NFD')), '/'), { name: 'character', slug: 'nyangdj7', base: '밤톨' }, '풀어 쓴 한글도 NFC 로');
  for (const bad of ['abc', '밤톨1', '가나다라마바사', encodeURIComponent('밤톨#먼치'), '밤톨/x']) assert.equal(parseRoute('/k/nyangdj7/' + bad, '/').name, 'notfound', bad);
  assert.equal(parseRoute('/k/nyangdj1/' + encodeURIComponent('밤톨'), '/').name, 'notfound', '이상한 페이지 주소');
});

test('모든 화면 모듈을 문법 오류 없이 읽고, 지운 팬페이지 모듈을 부르지 않는다', async () => {
  for (const f of (await siteScripts()).filter((x) => x !== 'app.js' && x !== 'spoon.js')) await import(`../docs/${f}`);
  for (const f of ['app.js', 'spoon.js']) {
    const r = spawnSync(process.execPath, ['--check', docs + f], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  }
  assert.deepEqual((await readdir(docs + 'views')).sort(), ['cards.js', 'character.js', 'common.js', 'intro.js', 'items.js', 'kiugi.js']);
  assert.deepEqual((await readdir(docs + 'lib')).sort(), ['dom.js', 'hearts.js', 'kiugi-draw.js', 'route.js', 'text.js']);
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
  assert.match(index, /<title>먼치킨 키우기<\/title>/);
  assert.match(index, /script-src 'self'/); assert.match(index, /connect-src 'self' https:\/\/aksegkhhugqvvaidgvro\.supabase\.co/);
  const intro = await text('views/intro.js');
  assert.match(intro, /'먼치킨 키우기'/, '메인 제목');
  assert.match(intro, /DJ가 알려 준 키우기 주소로 들어가면 청취자들이 꾸민 캐릭터를 볼 수 있어요\./);
  assert.match(intro, /스푼이 만든 서비스가 아니에요/);
  assert.match(intro, /\?demo=1/);
  assert.match(intro, /팬페이지 서비스를 마쳤어요/);
  for (const title of ['지금 인기 있는 캐릭터', '새로 꾸민 캐릭터', '많이 입은 옷 TOP 5', '키우기 중인 DJ', '아이디로 찾기']) assert.ok(intro.includes(title), title);
  // 메인은 칸 목록으로 그린다: 시즌 띠 · 찾기 · 인기 · 새로 꾸민 · 옷 TOP 5 · DJ · 예시
  const { LANDING_SECTIONS, EMPTY_POPULAR } = await import('../docs/views/intro.js');
  assert.deepEqual(LANDING_SECTIONS.map((f) => f.name), ['heroSection', 'seasonSection', 'searchSection', 'popularSection', 'recentSection', 'topItemsSection', 'djsSection', 'aboutSection']);
  assert.match(EMPTY_POPULAR, /첫 하트/);
});

test('화면에 애정도 숫자를 쓰지 않는다(레벨과 표정 이름만)', async () => {
  for (const f of ['views/kiugi.js', 'views/character.js', 'views/cards.js', 'views/intro.js', 'views/items.js']) {
    const src = await text(f);
    assert.doesNotMatch(src, /\.love\b|애정도 \$\{/, f);
  }
});

test('스푼 연결 페이지(spoon.html)는 그대로 있다', async () => {
  const html = await text('spoon.html');
  assert.match(html, /\/jun-live-fanpage\/spoon\.js/); assert.match(html, /\/jun-live-fanpage\/spoon\.css/);
  assert.match(await text('spoon.js'), /functions\/v1\/spoon-link\/callback/);
});
