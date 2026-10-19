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
  // 2026-10-18 새 구조: views/feed.js(큰 사진 카드·DJ 동그라미·내 캐릭터) · lib/me.js(내 캐릭터·연속 방문) · lib/raster.js(캐릭터 사진) · lib/swr.js(서버 답 기억)
  assert.deepEqual((await readdir(docs + 'views')).sort(), ['album.js', 'cards.js', 'character.js', 'common.js', 'feed.js', 'intro.js', 'items.js', 'kiugi.js']);
  // 2026-10-18 R9: lib/kiugi-hd.js(큰 무대·저장하기 고해상도 — 패키지 renderer-hd.js 를 docs/kiugi-hd/ 에서 불러 쓴다)
  assert.deepEqual((await readdir(docs + 'lib')).sort(), ['dom.js', 'hearts.js', 'kiugi-draw.js', 'kiugi-hd.js', 'kiugi-save.js', 'me.js', 'raster.js', 'route.js', 'swr.js', 'text.js', 'try-on.js']);
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
  assert.doesNotMatch(intro, /\?demo=1/, '실제 사이트에는 예시 페이지 링크가 없다(2026-10-15)');
  assert.match(intro, /팬페이지 서비스를 마쳤어요/);
  for (const title of ['지금 인기 있는 캐릭터', '새로 꾸민 캐릭터', '이렇게 키워요', '많이 입은 옷 TOP 5', '키우기 중인 DJ', '아이디로 찾기']) assert.ok(intro.includes(title), title);
  // 메인(2026-10-18 새 구조): 첫 화면(heroSection — DJ 동그라미 줄 · 글 · 찾기 · 오늘의 주인공) 아래 칸 목록 —
  //  찾은 결과 · 내 캐릭터와 오늘의 하트 미션 · 둘러보기(탭: 인기 · 새로 꾸민 · DJ별) · 옷 TOP 5 · 이렇게 키워요. 예시 페이지 칸은 2026-10-15 뺐다.
  const { LANDING_SECTIONS, EMPTY_POPULAR, HERO_TEXT, heroSection, FEED_TABS } = await import('../docs/views/intro.js');
  assert.equal(typeof heroSection, 'function');
  assert.deepEqual(LANDING_SECTIONS.map((f) => f.name), ['searchSection', 'meBlock', 'feedBlock', 'topItemsSection', 'howSection']);
  assert.deepEqual(FEED_TABS.map((t) => [t.id, t.name]), [['popular', '인기'], ['recent', '새로 꾸민'], ['djs', 'DJ별']]);
  assert.doesNotMatch(intro, /rail\(|kg-rail/, '화살표로 넘기는 줄은 없앴다');
  assert.match(EMPTY_POPULAR, /첫 하트/);
  assert.match(HERO_TEXT, /하트/);
});

test('모양: 보안 규칙상 style 속성을 쓰지 않고, 화면 클래스는 styles.css 에 있다', async () => {
  const css = await text('styles.css');
  // 2026-10-18 새 구조(SNS): 큰 사진 카드(kg-post · kg-photo · kg-heart-pill · kg-pet-tile · kg-burst) · DJ 동그라미(kg-rings · kg-ring) · 오늘의 주인공(kg-spot) ·
  //  내 캐릭터(kg-me · kg-me-news · kg-me-cta) · 오늘의 하트 미션(kg-today · kg-mission · kg-streak) · 탭(kg-tabs · kg-tab) · DJ 프로필(kg-profile) · 옆으로 넘겨 보기(kg-swipe)
  for (const cls of ['kg-night', 'kg-unofficial', 'fp-logo', 'kg-hero', 'kg-panel', 'kg-medal', 'kg-stage', 'kg-steps', 'kg-bubble', 'kg-rank-bar', 'kg-worn-one', 'kg-items', 'kg-chip', 'kg-toggle', 'fp-foot-legal',
    'kg-post', 'kg-post-media', 'kg-photo', 'kg-heart-pill', 'kg-pet-tile', 'kg-burst', 'kg-rings', 'kg-ring', 'kg-spot', 'kg-me', 'kg-me-news', 'kg-me-cta', 'kg-today', 'kg-mission', 'kg-streak',
    'kg-tabs', 'kg-tab', 'kg-feed-grid', 'kg-profile', 'kg-swipe', 'kg-pin-btn',
    // 2026-10-18 내 캐릭터 여러 명(kg-me-list · kg-me-item · kg-me-gone · kg-ring-mine) · ☆ 즐겨찾기(kg-fav-btn) · 찾기 칸 아래 저장한 캐릭터(kg-saved)
    'kg-me-host', 'kg-me-list', 'kg-me-item', 'kg-me-count', 'kg-me-gone', 'kg-ring-mine', 'kg-fav-btn', 'kg-saved', 'kg-saved-row', 'kg-saved-link', 'kg-saved-x'])
    assert.match(css, new RegExp(`\\.${cls}[\\s{.:,\\[]`), cls);
  for (const gone of ['kg-cast', 'kg-rail', 'kg-card', 'kg-podium']) assert.doesNotMatch(css, new RegExp(`\\.${gone}[\\s{.:,\\[-]`), gone + ' 는 없앴다');
  for (const f of await siteScripts()) assert.doesNotMatch(await text(f), /\bstyle:\s*['"`]|setAttribute\(\s*['"]style/, f + ': style 속성 없음');
});

test('내 캐릭터·즐겨찾기는 이 브라우저에만(2026-10-18 사용자 "동일 접속 IP 활용해서 하는 건가?" — 아니다): lib/me.js 는 서버에 묻지 않고, 찾기 칸 아래 목록도 받아 둔 답만 쓴다', async () => {
  const me = await text('lib/me.js');
  assert.doesNotMatch(me, /fetch\(|XMLHttpRequest|kiugiApi|fastApi|sendBeacon|navigator\./, 'me.js 는 서버로 아무것도 보내지 않는다');
  assert.deepEqual([...me.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]), ['./hearts.js'], 'me.js 가 부르는 것은 날짜 도우미뿐');
  assert.match(me, /localStorage/);
  const intro = await text('views/intro.js');
  const from = intro.indexOf('function savedPanel(');
  const panel = intro.slice(from, intro.indexOf('\nexport function heroSection(', from));
  assert.ok(panel.length > 200, 'savedPanel 이 있다');
  assert.doesNotMatch(panel, /kiugiApi|fastApi\.(home|page|person)\(/, '찾기 칸 아래 목록은 서버에 묻지 않는다(그림은 받아 둔 답이 있을 때만 — cachedLook)');
  assert.match(panel, /cachedLook\(e\)/);
  // 찾기 칸 · 캐릭터 페이지 · 찾은 카드에 단추
  const feed = await text('views/feed.js'), character = await text('views/character.js');
  assert.match(feed, /pinButton\(\{ slug: c\.slug, id: c\.id, djName \}\), favButton\(\{ slug: c\.slug, id: c\.id, djName \}, \{ compact: true \}\)/, '찾은 카드: 이게 나예요 + ☆');
  assert.match(character, /favButton\(\{ slug: dj\.slug, id: data\.id, djName: dj\.name \}\)/, '캐릭터 페이지: ☆ 즐겨찾기');
  assert.match(intro, /const saved = savedPanel\(ctx, \{ form, input \}\)/, '메인 찾기 칸 아래');
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
  const js = await text('spoon.js');
  assert.match(js, /functions\/v1\/spoon-link\/callback/);
  // 프로그램 이름은 먼치킨(2026-10-20 — 예전 이름 JUN LIVE 가 남아 있었다)
  for (const [f, src] of [['spoon.html', html], ['spoon.js', js]]) {
    assert.doesNotMatch(src, /JUN LIVE/, f + ': 예전 프로그램 이름');
    assert.match(src, /먼치킨/, f);
  }
  assert.match(html, /<title>먼치킨 스푼 연결<\/title>/);
  assert.match(html, /스푼이 만든 공식 서비스가 아니에요/, '비공식 표시');
});

test('앨범·할로윈 디자인이 실제 사이트 기본 화면(2026-10-18 사용자 "이대로 반영"): 미리 보기 포트·design=album 조건 없음 · 처음부터 클래스', async () => {
  const common = await text('views/common.js');
  assert.doesNotMatch(common, /5184|design'\) === 'album'/, '미리 보기 조건이 남아 있으면 실제 사이트에는 예전 화면이 나온다');
  assert.match(common, /design'\) === 'classic'/, '예전 화면은 ?design=classic 으로만');
  for (const f of ['index.html', '404.html']) assert.match(await text(f), /<html lang="ko" class="album-preview halloween-season">/, f + ': 자료가 오기 전에도 새 디자인 색');
});

test('공지(docs/notice.json): 모든 화면 맨 위(비공식 한 줄보다 먼저) · 글자로만 · until 지나면·빈 글이면 안 보임 · ×로 닫으면 그 공지는 이 브라우저에서 안 보임', async () => {
  const { parseNotice, NOTICE_MAX } = await import('../docs/views/common.js');
  const j = JSON.parse(await text('notice.json'));
  assert.equal(typeof j.text, 'string');
  assert.ok(j.text.trim().length > 0 && j.text.length <= NOTICE_MAX, '공지 글 길이');
  assert.doesNotMatch(j.text, /닉네임|<|>/);
  const now = Date.parse('2026-10-18T20:00:00+09:00');
  assert.deepEqual(parseNotice({ id: 'a', text: '  점검  중이에요 ', until: '2026-10-19T06:00:00+09:00' }, now), { id: 'a', text: '점검 중이에요' });
  assert.equal(parseNotice({ id: 'a', text: '점검', until: '2026-10-18T19:00:00+09:00' }, now), null, '시각이 지나면 안 보인다');
  assert.equal(parseNotice({ text: '   ' }, now), null);
  assert.equal(parseNotice(null, now), null);
  assert.equal(parseNotice({ text: 'x'.repeat(300) }, now).text.length, NOTICE_MAX);
  const common = await text('views/common.js');
  assert.match(common, /return \[\s*noticeBar\(app\),\s*h\('p', \{ class: 'kg-unofficial' \}/, '공지가 맨 위, 그다음 비공식 한 줄');
  assert.match(common, /h\('p', \{ class: 'kg-topnote-text' \}, n\.text\)/, '공지 글은 글자로만');
  for (const f of ['views/kiugi.js', 'views/character.js']) assert.doesNotMatch(await text(f), /nightTop\([^)]*\)\[\d\]/, f + ': 머리줄을 번호로 고르면 공지 때문에 엉뚱한 줄이 바뀐다 — .at(-1)');
  const css = await text('styles.css');
  for (const cls of ['.kg-topnote ', '.kg-topnote-text', '.kg-topnote-x']) assert.ok(css.includes(cls), cls);
});