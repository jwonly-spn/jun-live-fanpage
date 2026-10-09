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
  assert.deepEqual((await readdir(docs + 'lib')).sort(), ['dom.js', 'hearts.js', 'kiugi-draw.js', 'kiugi-save.js', 'route.js', 'text.js', 'try-on.js']);
  for (const f of await siteScripts()) {
    const src = await text(f);
    assert.doesNotMatch(src, /views\/(fan|studio|mobile|story|forms|photos)|lib\/(config|days|device|image|photo|samples)\.js/, f);
    assert.doesNotMatch(src, /functions\/v1\/fanpage|fp-photos|owner\/|팬페이지 꾸미기/, f);
    assert.doesNotMatch(src, /닉네임|nickname/i, f + ': 사이트는 스푼 닉네임을 다루지 않는다');
  }
});

test('index.html = 404.html(SPA), 화면 보안 규칙, 첫 화면 글 · 사이트 이름 "스푼 DJ 키우기"와 비공식 표시(맨 위·아래)', async () => {
  const index = await text('index.html');
  assert.equal(await text('404.html'), index);
  assert.match(index, /<title>스푼 DJ 키우기<\/title>/);
  assert.match(index, /스푼 공식 서비스가 아니에요/, '검색 설명에도 비공식');
  assert.match(index, /script-src 'self'/); assert.match(index, /connect-src 'self' https:\/\/aksegkhhugqvvaidgvro\.supabase\.co/);
  // 글꼴(2026-10-09 두 번째 새 디자인): Pretendard — 고정 판(1.3.9)·무결성 해시(SRI), 보안 규칙은 그 CDN 만 더 허용
  assert.match(index, /href="https:\/\/cdn\.jsdelivr\.net\/npm\/pretendard@1\.3\.9\/dist\/web\/variable\/pretendardvariable-dynamic-subset\.css" integrity="sha384-[A-Za-z0-9+/=]{64}" crossorigin="anonymous"/, '글꼴 Pretendard(고정 판 + SRI)');
  assert.match(index, /style-src 'self' https:\/\/cdn\.jsdelivr\.net; font-src https:\/\/cdn\.jsdelivr\.net;/);
  assert.doesNotMatch(index, /Noto\+Serif|Barlow/, '예전 게임 화면 글꼴(명조·좁은 숫자 글꼴)은 쓰지 않는다');
  const common = await import('../docs/views/common.js');
  assert.equal(common.BRAND, '스푼 DJ 키우기');
  assert.equal(common.UNOFFICIAL, '스푼 공식 서비스가 아니에요');
  assert.match(common.DISCLAIMER, /스푼\(Spoon\)이 만든 서비스가 아니고, 스푼과 제휴 관계도 아니에요/);
  const commonSrc = await text('views/common.js');
  assert.match(commonSrc, /'kg-unofficial' \}, UNOFFICIAL/, '맨 위 비공식 한 줄');
  assert.match(commonSrc, /'fp-foot-legal' \}, DISCLAIMER/, '맨 아래 비공식 안내');
  for (const f of ['views/intro.js', 'views/kiugi.js', 'views/character.js', 'views/items.js']) {
    const src = await text(f);
    assert.match(src, /nightTop\(app/, f + ': 맨 위 비공식 한 줄이 있는 머리줄');
    assert.match(src, /siteFoot\(app/, f + ': 바닥글');
    assert.doesNotMatch(src, /먼치킨 키우기/, f + ': 예전 사이트 이름 없음');
  }
  const intro = await text('views/intro.js');
  assert.match(intro, /\?demo=1/);
  assert.match(intro, /팬페이지 서비스를 마쳤어요/);
  for (const title of ['지금 인기 있는 캐릭터', '새로 꾸민 캐릭터', '이렇게 키워요', '많이 입은 옷 TOP 5', '키우기 중인 DJ', '아이디로 찾기']) assert.ok(intro.includes(title), title);
  // 메인: 밤하늘 첫 화면(heroSection) 아래 칸 목록 — 찾기 · 인기 · 새로 꾸민 · 이렇게 키워요 · 옷 TOP 5 · DJ · 예시
  const { LANDING_SECTIONS, EMPTY_POPULAR, HERO_TEXT, heroSection } = await import('../docs/views/intro.js');
  assert.equal(typeof heroSection, 'function');
  assert.deepEqual(LANDING_SECTIONS.map((f) => f.name), ['searchSection', 'popularSection', 'recentSection', 'howSection', 'topItemsSection', 'djsSection', 'aboutSection']);
  assert.match(EMPTY_POPULAR, /첫 하트/);
  assert.match(HERO_TEXT, /하트/);
});

test('모양: 보안 규칙상 style 속성을 쓰지 않고, 화면 클래스는 styles.css 에 있다', async () => {
  const css = await text('styles.css');
  // 2026-10-09 두 번째 새 디자인: 방패 문장·하트 이름표 대신 순위 배지(kg-medal)·하트 수(kg-hearts)·옆으로 넘기는 줄(kg-rail)·무대(kg-stage)
  for (const cls of ['kg-night', 'kg-unofficial', 'fp-logo', 'kg-hero', 'kg-cast', 'kg-panel', 'kg-card', 'kg-rank-badge', 'kg-medal', 'kg-hearts', 'kg-rail', 'kg-stage', 'kg-steps', 'kg-bubble', 'kg-rank-bar', 'kg-podium', 'kg-worn-one', 'kg-items', 'kg-chip', 'kg-toggle', 'fp-foot-legal'])
    assert.match(css, new RegExp(`\\.${cls}[\\s{.:,\\[]`), cls);
  for (const f of await siteScripts()) assert.doesNotMatch(await text(f), /\bstyle:\s*['"`]|setAttribute\(\s*['"]style/, f + ': style 속성 없음');
});

test('화면에 애정도 숫자를 쓰지 않는다(레벨과 표정 이름만)', async () => {
  for (const f of ['views/kiugi.js', 'views/character.js', 'views/cards.js', 'views/intro.js', 'views/items.js']) {
    const src = await text(f);
    assert.doesNotMatch(src, /\.love\b|애정도 \$\{/, f);
  }
});

test('스푼 연결 페이지(spoon.html)는 그대로 있다', async () => {
  const html = await text('spoon.html');
  // 2026-10-08 키우기.com 으로 옮긴 뒤로는 사이트가 도메인 맨 앞(/)에 있다
  assert.match(html, /src="\/spoon\.js"/); assert.match(html, /href="\/spoon\.css"/);
  assert.match(await text('spoon.js'), /functions\/v1\/spoon-link\/callback/);
});
