// 사이트 전체(2026-11-15 시즌 2 "몬스터 영토전"): 첫 화면(영토 지도 · 아이디로 몬스터 찾기 · 땅 순위·소식 · 넓히는 법) · 몬스터 도감 · 스푼 연결 페이지(spoon.html).
// 시즌 1 화면(캐릭터 페이지 · DJ 페이지 · 옷 도감 · 입혀 보기 · 저장하기)과 그림은 걷어냈다 → 예전 주소는 첫 화면으로.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { computeBase, stripBase, parseRoute, buildPath } from '../docs/lib/route.js';

const B = '/jun-live-fanpage/';
const docs = fileURLToPath(new URL('../docs/', import.meta.url));
const text = (p) => readFile(docs + p, 'utf8');
async function siteScripts() {
  const out = ['app.js', 's2-app.js', 'api.js', 'mock.js', 'spoon.js'];
  for (const dir of ['lib', 'views']) for (const f of (await readdir(docs + dir)).filter((x) => x.endsWith('.js'))) out.push(`${dir}/${f}`);
  return out;
}

test('BASE 와 BASE 떼기', () => {
  assert.equal(computeBase('/jun-live-fanpage/app.js'), B);
  assert.equal(computeBase('/app.js'), '/');
  assert.equal(stripBase('/jun-live-fanpage/dex', B), 'dex');
  assert.equal(stripBase('/jun-live-fanpage', B), '');
  assert.equal(stripBase('/dex/', '/'), 'dex');
});

test('주소: 첫 화면·도감(?id= 아이디) · 시즌 1·예전 팬페이지 주소는 old(첫 화면으로 — 캐릭터 주소면 그 아이디) · 없는 주소', () => {
  for (const p of ['/jun-live-fanpage/', '/jun-live-fanpage', '/jun-live-fanpage/index.html', '/jun-live-fanpage/404.html']) assert.deepEqual(parseRoute(p, B), { name: 'home', id: '' }, p);
  assert.deepEqual(parseRoute('/', '/'), { name: 'home', id: '' });
  assert.deepEqual(parseRoute('/', '/', '?id=' + encodeURIComponent('밤톨')), { name: 'home', id: '밤톨' });
  assert.deepEqual(parseRoute('/dex', '/', '?id=' + encodeURIComponent('밤톨#먼치')), { name: 'dex', id: '밤톨#먼치' });
  assert.deepEqual(parseRoute('/dex/', '/', '?id=abc'), { name: 'dex', id: '' }, '아이디 모양이 아니면 빈칸');
  assert.deepEqual(parseRoute('/dex', '/', '?id=' + encodeURIComponent('밤 톨'.normalize('NFD'))), { name: 'dex', id: '밤톨' }, '풀어 쓴 한글·띄어쓰기 정리');
  for (const p of ['/items', '/k/nyangdj7', '/k/nyangdj7/x', '/p/haru', '/p/haru/story', '/studio', '/app']) assert.deepEqual(parseRoute(p, '/'), { name: 'old', id: '' }, p);
  assert.deepEqual(parseRoute('/k/nyangdj7/' + encodeURIComponent('밤톨'), '/'), { name: 'old', id: '밤톨' }, '시즌 1 캐릭터 주소 → 그 아이디로 찾기');
  for (const p of ['/xyz', '/dex/x', '/%E0%A4%A', '/kiugi/x']) assert.equal(parseRoute(p, '/').name, 'notfound', p);
  assert.equal(buildPath(B, { name: 'home' }), B);
  assert.equal(buildPath('/', { name: 'home', id: '밤톨' }), '/?id=' + encodeURIComponent('밤톨'));
  assert.equal(buildPath('/', { name: 'dex', id: '밤톨#먼치' }), '/dex?id=' + encodeURIComponent('밤톨#먼치'));
  assert.equal(buildPath('/', { name: 'dex', id: '<b>' }), '/dex', '이상한 아이디는 주소에 넣지 않는다');
});

test('모든 화면 모듈을 문법 오류 없이 읽는다 · 시즌 1 화면·그림·도구는 없다 · 사이트는 닉네임을 다루지 않는다', async () => {
  for (const f of (await siteScripts()).filter((x) => x !== 'app.js' && x !== 's2-app.js' && x !== 'spoon.js')) await import(`../docs/${f}`);
  for (const f of ['app.js', 's2-app.js', 'spoon.js']) {
    const r = spawnSync(process.execPath, ['--check', docs + f], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  }
  // 2026-11-21: 12월 1일 0시 전까지 보여 줄 예고 화면(views/teaser.js · lib/teaser-*.js · lib/me.js · lib/hearts.js)과 날짜 갈래(lib/launch.js)를 함께 둔다
  assert.deepEqual((await readdir(docs + 'views')).sort(), ['boss.js', 'common.js', 'dex.js', 'home.js', 'monster-ui.js', 'teaser.js']);
  assert.deepEqual((await readdir(docs + 'lib')).sort(), ['boss-core.js', 'dom.js', 'hearts.js', 'launch.js', 'map-core.js', 'map-draw.js', 'me.js', 'monsters.js', 'route.js', 'sound-unlock.js', 'teaser-boss.js', 'teaser-map.js', 'teaser-time.js', 'teaser-war-core.js', 'teaser-war-draw.js', 'teaser-war-sim.js', 'text.js']);
  for (const gone of ['kiugi-hd', 'kiugi-lite', 'pets', 'design', 'kiugi/r9', 'kiugi/kiugi-art.js', 'kiugi/season-s1.json']) assert.equal(existsSync(docs + gone), false, gone + ' 는 걷어냈다(시즌 1 그림)');
  for (const gone of ['make-lite-art.cjs', 'sync-kiugi-hd.mjs']) assert.equal(existsSync(fileURLToPath(new URL('../tools/' + gone, import.meta.url))), false, gone);
  for (const f of await siteScripts()) {
    const src = await text(f);
    assert.doesNotMatch(src, /views\/(character|items|kiugi|feed|cards|album|intro)\.js|lib\/(kiugi-draw|kiugi-hd|kiugi-save|try-on|raster|swr)\.js/, f + ': 걷어낸 시즌 1 모듈을 부르지 않는다');
    // lib/me.js · lib/hearts.js 는 예고 화면(views/teaser.js — 예전 주소 안내의 "저장한 내 아이디")만 쓴다. 시즌 2 화면은 부르지 않는다.
    if (f !== 'views/teaser.js' && f !== 'lib/me.js') assert.doesNotMatch(src, /\/(me|hearts)\.js'/, f + ': 예고 화면만 쓰는 모듈');
    assert.doesNotMatch(src, /functions\/v1\/fanpage|fp-photos|팬페이지 꾸미기/, f);
    assert.doesNotMatch(src, /닉네임|nickname/i, f + ': 사이트는 스푼 닉네임을 다루지 않는다');
  }
});

test('index.html = 404.html(SPA) · 보안 규칙 · 사이트 이름 "스푼 DJ 키우기"와 비공식 표시(맨 위·아래) · 화면마다 머리줄·바닥글', async () => {
  const index = await text('index.html');
  assert.equal(await text('404.html'), index);
  assert.match(index, /<html lang="ko" class="s2-teaser">/, '처음 색은 예고(12월 1일 0시부터는 맨 위 작은 스크립트·app.js 가 뗀다) · 시즌 1 할로윈 클래스 없음');
  assert.match(index, /<title>키우기 시즌 2 · 몬스터 영토전 \| 스푼 DJ 키우기<\/title>/);
  assert.match(index, /스푼 공식 서비스가 아니에요/, '검색 설명에도 비공식');
  assert.match(index, /script-src 'self' 'sha256-[A-Za-z0-9+/=]+' 'sha256-[A-Za-z0-9+/=]+';/, 'import map 글 + 맨 위 작은 스크립트(첫 색·미리 받기) 두 개만'); assert.match(index, /connect-src 'self' https:\/\/aksegkhhugqvvaidgvro\.supabase\.co/);
  assert.match(index, /img-src 'self' data:;/, '그림은 이 사이트 것만(몬스터·지도 그림 docs/)');
  assert.match(index, /href="https:\/\/cdn\.jsdelivr\.net\/npm\/pretendard@1\.3\.9\/dist\/web\/variable\/pretendardvariable-dynamic-subset\.css" integrity="sha384-[A-Za-z0-9+/=]{64}" crossorigin="anonymous"/, '글꼴 Pretendard(고정 판 + SRI)');
  assert.match(index, /style-src 'self' https:\/\/cdn\.jsdelivr\.net; font-src https:\/\/cdn\.jsdelivr\.net;/);
  const { plan } = (await import('node:module')).createRequire(import.meta.url)('../tools/stamp.cjs');
  assert.ok(index.includes(plan().cspHash), '찍은 import map 해시가 지금 파일과 같다(node tools/stamp.cjs)');
  const common = await import('../docs/views/common.js');
  assert.equal(common.BRAND, '스푼 DJ 키우기');
  assert.equal(common.UNOFFICIAL, '스푼 공식 서비스가 아니에요');
  assert.match(common.DISCLAIMER, /스푼\(Spoon\)이 만든 서비스가 아니고, 스푼과 제휴 관계도 아니에요/);
  const commonSrc = await text('views/common.js');
  assert.match(commonSrc, /'kg-unofficial' \}, UNOFFICIAL/, '맨 위 비공식 한 줄');
  assert.match(commonSrc, /'fp-foot-legal' \}, DISCLAIMER/, '맨 아래 비공식 안내');
  for (const f of ['views/home.js', 'views/dex.js', 'views/boss.js']) {
    const src = await text(f);
    assert.match(src, /nightTop\(app/, f + ': 맨 위 비공식 한 줄이 있는 머리줄');
    assert.match(src, /siteFoot\(app/, f + ': 바닥글');
  }
  const intro = await text('views/home.js');
  assert.doesNotMatch(intro, /\?demo=1/, '실제 사이트에는 예시 페이지 링크가 없다(2026-10-15)');
});

test('첫 화면(spec.md 7절): 지도 → 바로 아래 아이디 찾기 → 땅 순위·소식 → 넓히는 법 · 지도는 tr-snap/map.json 을 3분마다 · 1등 상 문구 · 남은 날', async () => {
  const { HOME_SECTIONS } = await import('../docs/views/home.js');
  assert.deepEqual(HOME_SECTIONS, ['mapHero', 'findSection', 'boardSection', 'howSection']);
  const home = await text('views/home.js');
  assert.match(home, /main\.append\(hero\.el, findSection\(app, route\.id, [^)]*\)[^,]*\), hero\.board, howSection\(app\)\)/, '차례는 그대로(찾기 칸에 시즌 1 주소 안내만 더함 — 2026-11-16)');
  assert.match(home, /readMapFile\(\{ fresh \}\)/); assert.match(home, /visibilitychange/, '화면이 숨으면 쉬고 다시 보이면 읽는다');
  const api = await import('../docs/api.js');
  assert.equal(api.MAP_URL, 'https://aksegkhhugqvvaidgvro.supabase.co/storage/v1/object/public/tr-snap/map.json');
  assert.equal(api.MAP_POLL_MS, 3 * 60e3);
  const mc = await import('../docs/lib/map-core.js');
  assert.equal(mc.PRIZE_TEXT, '1등 DJ에게 먼치킨 한 달 무료 이용권 + 상금 486스푼');
  for (const s of ['땅 순위', '지도 소식', '아이디로 몬스터 찾기', '땅은 이렇게 넓혀요', '!산책', '!훈련 500', '!대표 이름', '!몬스터', '!참전']) assert.ok(home.includes(s), s);
  // 그림 지도(Codex 대륙): 바탕 그림 · 땅 모양 · 땅 칸 — 휴대폰에서도 가볍게
  for (const [f, max] of [['s2/continent.webp', 400e3], ['s2/land.png', 250e3], ['s2/land-grid.json', 8e3]]) { const s = await stat(docs + f); assert.ok(s.size > 0 && s.size < max, `${f} ${s.size}`); }
  const draw = await text('lib/map-draw.js');
  assert.match(draw, /destination-in/, '물감은 땅 모양으로 잘라 바다 위로 넘치지 않는다');
});

test('도감: 18종 × 3단계 + 보스 6 · 속성별 · 상성 · 산책 길 · 대륙 이야기 · 드문 몬스터 · 설화(접어 둔 칸) · ?id= 면 만난 것은 색, 못 만난 것은 그림자(설화도 잠금)', async () => {
  const dex = await text('views/dex.js');
  for (const s of ['속성 상성', '자주 만나는 산책 길', '아직 못 만난 몬스터', '약점', 'shadow: Boolean(met)', '대륙 이야기', '설화 읽기', "h('details'", "h('summary'", '만나면 설화를 볼 수 있어요', "'???'"]) assert.ok(dex.includes(s), s);
  assert.doesNotMatch(dex, /12월 7일|12월 14일|곧 정해져요/, '그림·이름이 모두 나와 예전 안내는 뺐다');
  const ui = await text('views/monster-ui.js');
  assert.match(ui, /loading: 'lazy'/, '몬스터 그림은 화면 가까이 올 때 받는다');
  assert.match(ui, /곧 진화 모습이 나와요/); assert.match(ui, /드문 몬스터/);
  assert.match(ui, /'manifest\.json'/); assert.match(ui, /'season-s2\.json'/);
});

test('공유·검색용 머리 정보: 파비콘 · 테마 색 · 공통 미리보기(og 그림 1200x630 — 서버가 주는 사이트 주소와 같은 주소) · robots.txt(막지 않음)', async () => {
  const index = await text('index.html');
  const meta = (attr, name) => new RegExp(`<meta ${attr}="${name.replace(/[.:]/g, '\\$&')}" content="([^"]*)">`).exec(index)?.[1];
  assert.match(index, /<link rel="icon" href="\/favicon\.ico">/);
  assert.equal(meta('name', 'theme-color'), '#07080f'); // 처음은 예고 색 — 시즌 2 화면이 되면 app.js 가 #f1ebdf 로 바꾼다
  assert.equal(meta('property', 'og:site_name'), '스푼 DJ 키우기');
  assert.match(meta('property', 'og:title'), /몬스터 영토전/);
  assert.match(meta('property', 'og:description'), /비공식 팬 사이트.*스푼 공식 서비스가 아니에요/, '미리보기 글에도 비공식');
  assert.equal(meta('name', 'twitter:card'), 'summary_large_image');
  assert.deepEqual([meta('property', 'og:image:width'), meta('property', 'og:image:height')], ['1200', '630']);
  const { SITE } = await import('../supabase/functions/kiugi/handler.ts');
  assert.equal(SITE, 'https://xn--ok0bp87bn6g.com/');
  assert.equal(meta('property', 'og:image'), 'https://www.xn--ok0bp87bn6g.com/og.png', 'CNAME 과 같은 www 주소(2026-11-21)');
  assert.equal((await text('CNAME')).trim(), 'www.xn--ok0bp87bn6g.com');
  const png = await readFile(docs + 'og.png');
  assert.equal(png.toString('ascii', 1, 4), 'PNG');
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630]);
  assert.ok(png.length < 1024 * 1024, 'og.png 는 1MB 보다 작다');
  const ico = await readFile(docs + 'favicon.ico');
  assert.deepEqual([...ico.subarray(0, 4)], [0, 0, 1, 0], 'ICO 머리');
  const robots = await text('robots.txt');
  assert.match(robots, /^User-agent: \*$/m);
  assert.doesNotMatch(robots, /^Disallow: *\/\s*$/m);
  assert.doesNotMatch(robots + index, /닉네임/);
});

test('모양: 보안 규칙상 style 속성을 쓰지 않고(위치·색은 CSSOM 만), 화면 클래스는 styles.css 에 있다 · 어두운 화면 색', async () => {
  const css = await text('styles.css');
  for (const cls of ['kg-unofficial', 'kg-topnote', 'kg-topnote-text', 'kg-topnote-x', 'fp-top', 'fp-logo', 'fp-foot-legal', 'kg-cmd', 'toast',
    's2-map-hero', 's2-map-head', 's2-map-scroll', 's2-map-stage', 's2-canvas', 's2-labels', 's2-label', 's2-col', 's2-map-overlay', 's2-legend', 's2-clock', 's2-prize',
    's2-board', 's2-rank', 's2-rank-row', 's2-feed', 's2-find', 's2-find-form', 's2-input', 's2-person', 's2-lead', 's2-mon-row', 's2-how-card', 's2-cmds', 's2-ring-line',
    'mon-art', 'mon-ph-ball', 'mon-ph-pips', 'mon-type', 'mon-soon', 's2-dex-banner', 's2-type', 's2-species', 's2-sp', 's2-stages', 's2-growth-list',
    's2-intro', 's2-intro-text', 's2-sp-head', 's2-rare', 's2-chips', 's2-lore', 's2-lore-in', 's2-lore-text', 's2-lore-stages', 's2-lore-stage', 's2-lore-dex', 's2-lore-locked'])
    assert.match(css, new RegExp(`\\.${cls}[\\s{.:,\\[]`), cls);
  assert.match(css, /@media \(prefers-color-scheme: dark\)/);
  for (const f of await siteScripts()) assert.doesNotMatch(await text(f), /\bstyle:\s*['"`]|setAttribute\(\s*['"]style|\.innerHTML\s*=|insertAdjacentHTML/, f + ': style 속성·HTML 글 넣기 없음');
});

test('스푼 연결 페이지(spoon.html)는 그대로 있다', async () => {
  const html = await text('spoon.html');
  assert.match(html, /src="\/spoon\.js"/); assert.match(html, /href="\/spoon\.css"/);
  const js = await text('spoon.js');
  assert.match(js, /functions\/v1\/spoon-link\/callback/);
  for (const [f, src] of [['spoon.html', html], ['spoon.js', js]]) { assert.doesNotMatch(src, /JUN LIVE/, f); assert.match(src, /먼치킨/, f); }
  assert.match(html, /스푼이 만든 공식 서비스가 아니에요/, '비공식 표시');
});

test('공지(docs/notice.json): 모든 화면 맨 위(비공식 한 줄보다 먼저) · 글자로만 · until 지나면·빈 글이면 안 보임', async () => {
  const { parseNotice, NOTICE_MAX } = await import('../docs/views/common.js');
  const j = JSON.parse(await text('notice.json'));
  assert.equal(typeof j.text, 'string');
  assert.ok(j.text.trim().length > 0 && j.text.length <= NOTICE_MAX);
  assert.doesNotMatch(j.text, /닉네임|<|>/);
  const now = Date.parse('2026-10-18T20:00:00+09:00');
  assert.deepEqual(parseNotice({ id: 'a', text: '  점검  중이에요 ', until: '2026-10-19T06:00:00+09:00' }, now), { id: 'a', text: '점검 중이에요' });
  assert.equal(parseNotice({ id: 'a', text: '점검', until: '2026-10-18T19:00:00+09:00' }, now), null);
  assert.equal(parseNotice({ text: '   ' }, now), null);
  // from(2026-11-15): 미리 올려 둔 시즌 시작 공지는 그때부터
  assert.equal(parseNotice({ id: 'b', text: '시작했어요', from: '2026-10-19T00:00:00+09:00' }, now), null);
  assert.deepEqual(parseNotice({ id: 'b', text: '시작했어요', from: '2026-10-18T00:00:00+09:00' }, now), { id: 'b', text: '시작했어요' });
  assert.equal(parseNotice(j, Date.parse('2026-11-30T23:59:00+09:00')), null, '지금 공지는 12월 1일부터');
  assert.ok(parseNotice(j, Date.parse('2026-12-01T09:00:00+09:00')));
  const common = await text('views/common.js');
  assert.match(common, /return \[\s*noticeBar\(app\),\s*h\('p', \{ class: 'kg-unofficial' \}/);
  assert.match(common, /h\('p', \{ class: 'kg-topnote-text' \}, n\.text\)/);
});

// 2026-11-16 화면 점검(예고 화면 S2·S6 와 같은 고침)
test('시즌 1 주소로 오면 잠깐 뜨는 알림 대신 찾기 칸 맨 위에 남는 안내 + 이 브라우저에 저장한 내 아이디(읽기만 — 고치거나 보내지 않음)', async () => {
  const app = await text('s2-app.js');
  assert.match(app, /moved = route\.name/);
  assert.match(app, /moved === 'old' \? '#find' : ''/, '시즌 1 주소는 찾기 칸으로');
  assert.match(app, /renderHome\(root, app, \{ \.\.\.route, moved \}\)/);
  assert.match(app, /if \(moved === 'notfound'\) import\('\.\/lib\/dom\.js'\)\.then\(\(\{ toast \}\) => toast\(MOVED\.notfound\)\)/, '없는 주소는 예전처럼 알림');
  const home = await text('views/home.js');
  assert.match(home, /findSection\(app, route\.id, route\.moved === 'old' \? oldNote\(app\) : null\)/);
  const { savedIds, OLD_NOTE_TEXT } = await import('../docs/views/home.js');
  assert.match(OLD_NOTE_TEXT, /11월 15일/);
  const writes = [];
  const store = (data) => ({ getItem: (k) => (k in data ? data[k] : null), setItem: (k) => writes.push(k), removeItem: (k) => writes.push(k) });
  const mine = JSON.stringify([{ slug: 'abcdefgh', id: '밤톨#먼치' }, { slug: 'abcdefgh', id: '<b>' }, { slug: 'bcdefghj', id: '사탕요정#쿠키' }, { slug: 'x', id: '밤톨#먼치' }]);
  assert.deepEqual(savedIds(store({ kg_mine: mine })), ['밤톨#먼치', '사탕요정#쿠키'], '모양이 맞는 아이디만, 한 번씩');
  assert.deepEqual(savedIds(store({ kg_me: JSON.stringify({ slug: 'abcdefgh', id: '달무리#먼치' }) })), ['달무리#먼치'], '예전 하나만 기억하던 kg_me 도');
  assert.deepEqual(savedIds(store({ kg_mine: '{깨진 글' })), []);
  assert.deepEqual(savedIds(null), []);
  assert.deepEqual(writes, [], '저장소는 읽기만');
  const fn = home.slice(home.indexOf('export function savedIds'), home.indexOf('// ---- 아이디로 몬스터 찾기'));
  assert.doesNotMatch(fn, /fetch|kiugiApi|setItem|removeItem/, '서버에 묻지 않고 저장소를 고치지 않는다');
  assert.match(await text('styles.css'), /\.s2-oldnote \{/);
});

test('읽는 글 12px 이상(지도 숫자·식민지 글·배지·단계 글·드문 표시)', async () => {
  const css = await text('styles.css');
  const tiny = [...css.matchAll(/font-size: (?:max\()?(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])).filter((n) => n > 0 && n < 12);
  assert.deepEqual(tiny, []);
});
