import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { countdown, LAUNCH_AT, readStats } from '../docs/lib/teaser-time.js';
import { createWar, WAR_DJS, LAST_DAY } from '../docs/lib/teaser-war-sim.js';
import { landFromGrid } from '../docs/lib/teaser-war-core.js';

const text = (name) => readFile(new URL('../docs/' + name, import.meta.url), 'utf8');

test('시즌 2 카운트다운: 한국 시각 12월 1일 0시, 날짜 경계, 종료 이후 음수 없음', () => {
  assert.equal(LAUNCH_AT, Date.parse('2026-11-30T15:00:00Z'));
  assert.deepEqual(countdown(Date.parse('2026-11-30T00:00:00+09:00')), { started: false, parts: [1, 0, 0, 0] });
  assert.deepEqual(countdown(LAUNCH_AT - 1000), { started: false, parts: [0, 0, 0, 1] });
  assert.deepEqual(countdown(LAUNCH_AT - 1), { started: false, parts: [0, 0, 0, 1] });
  for (const now of [LAUNCH_AT, LAUNCH_AT + 1, LAUNCH_AT + 86400000]) {
    assert.deepEqual(countdown(now), { started: true, parts: [0, 0, 0, 0] });
  }
});

test('시즌 1 기록은 수정 가능한 JSON 한 곳에서 읽으며 잘못된 숫자는 거른다', async () => {
  const data = JSON.parse(await text('teaser/s1-stats.json'));
  const stats = readStats(data);
  assert.equal(stats.length, 7);
  assert.equal(stats[5].prefix, 'Lv.');
  for (const value of [-1, 1.5, '12', null, Infinity]) {
    assert.throws(() => readStats({ stats: stats.map((s, i) => i ? s : { ...s, value }) }));
  }
  assert.throws(() => readStats({ stats: [] }));
  const src = await text('views/teaser.js');
  assert.match(src, /fetch\(asset\('s1-stats.json'\), \{ cache: 'no-cache' \}\)/);
  assert.match(src, /if \(!motion.matches && 'IntersectionObserver' in window\)/);
  assert.match(src, /다시 불러오기/);
});

test('전쟁 지도 흉내: 대륙 그림의 땅 칸에서 DJ 6명, 31일 진행·땅 넓어짐·식민지, 마지막 날 뒤 멈춤, 처음으로 되돌리면 같은 모습', async () => {
  const grid = landFromGrid(JSON.parse(await text('s2/land-grid.json')));
  assert.ok(grid && grid.land.length === grid.w * grid.h);
  const war = createWar({ land: grid.land });
  const first = war.map();
  assert.equal(first.djs.length, WAR_DJS.length);
  assert.ok(first.djs.every((d) => d.pct > 0.5 && d.pct < 1.5), '모두 기지 1%에서 시작');
  let colonies = 0;
  for (let day = 2; day <= LAST_DAY; day++) {
    assert.equal(war.step(), true);
    assert.equal(war.day(), day);
    const m = war.map();
    assert.ok(m.djs.every((d) => d.pct >= 0 && d.pct <= 100));
    for (let i = 0; i < m.N; i++) if (m.col[i] >= 0) { colonies++; break; }
  }
  assert.equal(war.step(), false);
  assert.ok(war.ranking()[0].pct > 5, '한 달 뒤 1등은 5% 넘게');
  assert.ok(colonies > 0, '영지전 식민지가 생긴다');
  war.reset();
  assert.equal(war.day(), 1);
  assert.deepEqual(Array.from(war.map().owner), Array.from(first.owner));
});

test('티저 내용·순서: (예전 주소 안내) 첫 화면, 기록(맨 앞에 냥 안내), 시즌 2 미리 보기, 1등 보상, 비공식 바닥', async () => {
  const src = await text('views/teaser.js');
  assert.match(src, /oldNote\(\), hero\(\), records\(\), previews\(\), prize\(\)/);
  for (const line of [
    'COMING SOON', '옷 입히기에서, 이제 몬스터와 함께', '시즌 2는 완전히 새로워요.',
    '청취자들의 도파민을 책임질 영지전.', '최애 DJ에게 영광을 가져다줄 보스전.',
    '시즌 1에 모아 둔 냥은 시즌 2가 시작되면 전부 삭제돼요. 아이디는 그대로 이어져요.',
    '시즌 2가 시작됐어요', '1등 DJ 보상', '먼치킨 1달 이용권 + ', '486', '!산책', '!가위 바위', '!빼기 바위',
  ]) assert.ok(src.includes(line), line);
  const { ELEMENTS } = await import('../docs/views/teaser.js').catch(() => ({ ELEMENTS: null })) ;
  if (ELEMENTS) assert.deepEqual(ELEMENTS.map((e) => e[1]), ['불', '물', '풀', '땅', '바람', '전기']);
  assert.match(src, /\[ELEMENTS\[1\], ELEMENTS\[0\], ELEMENTS\[2\], ELEMENTS\[3\], ELEMENTS\[5\], ELEMENTS\[4\], ELEMENTS\[1\]\]/);
  assert.match(src, /'tz-unofficial' \}, UNOFFICIAL/);
  assert.match(src, /'tz-footer'[\s\S]*UNOFFICIAL[\s\S]*DISCLAIMER/);
  assert.doesNotMatch(src, /innerHTML|setAttribute\(['"]style|\bstyle:|닉네임|nickname/i);
  assert.doesNotMatch(src, /효과가 굉장/, '다른 게임 대사를 쓰지 않는다');
});

test('지도는 3.2초마다 하루씩·31일 후 처음부터, 화면 밖·숨긴 탭·움직임 줄이기·정지 때 멈춘다', async () => {
  const src = await text('lib/teaser-map.js');
  assert.match(src, /setTimeout\(advance, war.day\(\) >= LAST_DAY \? 6000 : 3200\)/);
  assert.match(src, /if \(!war.step\(\)\) war.reset\(\)/);
  assert.match(src, /!paused && !motion.matches && visible && !document.hidden/);
  assert.match(src, /visibilitychange/);
  assert.match(src, /motion.addEventListener\('change', sync\)/);
  assert.match(src, /IntersectionObserver/);
  assert.match(await text('lib/teaser-war-draw.js'), /from '\.\/teaser-war-core\.js'/);
});

test('티저 JS도 stamp 대상이며 import map 해시가 CSP와 일치한다', async () => {
  const { plan, stampHtml } = await import('../tools/stamp.cjs');
  const p = plan(), html = await text('index.html');
  assert.equal(stampHtml(html, p), html);
  const imports = JSON.parse(p.map).imports;
  for (const file of ['/views/teaser.js', '/lib/teaser-map.js', '/lib/teaser-war-core.js', '/lib/teaser-war-draw.js', '/lib/teaser-war-sim.js', '/lib/teaser-time.js']) {
    assert.match(imports[file], /\?v=[a-f0-9]{10}$/);
  }
  const map = html.match(/<script type="importmap">([^<]+)<\/script>/)[1];
  assert.ok(html.includes(`'sha256-${createHash('sha256').update(map).digest('base64')}'`));
  assert.doesNotMatch(html, /\sstyle=|\sonclick=|<script>(?!<)/);
});

// 2026-11-16 화면 점검(S1~S14) 고침이 그대로 있는지
test('화면 점검 고침: 링크 글색이 단추·건너뛰기 링크를 덮지 않는다 · 12px 아래 한글 정보 글 없음 · 영어 머리글은 COMING SOON 한 곳', async () => {
  const css = await text('styles.css');
  const teaserCss = css.slice(css.indexOf('html.s2-teaser {'));
  assert.doesNotMatch(teaserCss, /^\.s2-teaser a \{ color: inherit; \}/m, '금색 단추·건너뛰기 링크 글색을 덮던 규칙(S1)');
  assert.match(teaserCss, /\.tz-btn-gold \{ color: #1b1206;/);
  // 읽는 글 12px 이상(S6) — 예고 칸의 글 크기 값 중 12px 아래가 없다(휴대폰에서 숨기는 font-size: 0 은 빼고)
  const tiny = [...teaserCss.matchAll(/font-size: (?:max\()?(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])).filter((n) => n > 0 && n < 12);
  assert.deepEqual(tiny, [], '12px 아래 글');
  assert.match(teaserCss, /\.tz-ring-name \{ fill: #fff; font-size: 18px;/, '속성 고리 이름은 그림 단위 18(휴대폰 약 13px)');
  const src = await text('views/teaser.js');
  assert.doesNotMatch(src, /lang: 'en' \}, '(?!COMING SOON'|VS')/, '영어 꾸밈 글은 COMING SOON 하나(+ 깃발 사이 VS 표시)만(S8)');
  for (const en of ['KIUGI', 'ARCHIVE', 'TERRITORY WAR', 'BOSS RAID', 'MONSTER DEX', 'SEALED', 'SEASON REWARD', "'SCROLL'", "'BOT'", "'LIVE'"]) assert.ok(!src.includes(en), en);
  const { TIME_UNITS } = await import('../docs/views/teaser.js');
  assert.deepEqual(TIME_UNITS, ['일', '시간', '분', '초'], '남은 시간 단위는 한글(S8)');
});

test('화면 점검 고침: 할 일 한 줄(!산책)은 첫 화면 단추 앞 · 냥 삭제 안내는 시즌 1 기록 칸 맨 앞 · 속성 목록은 고리 차례', async () => {
  const src = await text('views/teaser.js');
  const hero = src.slice(src.indexOf('function hero()'), src.indexOf('const head ='));
  assert.ok(hero.indexOf("'!산책'") > 0 && hero.indexOf("'!산책'") < hero.indexOf("'tz-cta'"), '첫 화면 단추 앞에 !산책 한 줄(S3)');
  assert.match(hero, /'시즌 2 미리 보기'/, '어려운 말(대격변) 대신 쉬운 단추 이름');
  const records = src.slice(src.indexOf('function records()'), src.indexOf('// 예전 주소('));
  assert.ok(records.indexOf('resetNote()') > 0 && records.indexOf('resetNote()') < records.indexOf("'tz-stats'"), '냥 삭제 안내가 기록 숫자보다 앞(S4)');
  assert.match(src, /RING\.map\(\(\[, name\], i\)/, '속성 목록은 고리(RING)와 같은 차례로 그린다(S14)');
  assert.doesNotMatch(src, /'불 · 물 · 풀 · 땅 · 바람 · 전기'/);
});

test('화면 점검 고침: 나타나기 문턱(2%·화면 아래 10% 미리) · 화면 밖 꾸밈 움직임 멈춤 · 지도 띠는 지도 그림 밖', async () => {
  const { REVEAL } = await import('../docs/views/teaser.js');
  assert.deepEqual(REVEAL, { threshold: 0.02, rootMargin: '0px 0px 10% 0px' });
  const src = await text('views/teaser.js'), css = await text('styles.css');
  assert.match(src, /classList\.toggle\('tz-still', !e\.isIntersecting\)/);
  assert.match(css, /\.tz-still \*[^{]*\{ animation-play-state: paused !important; \}/);
  const frame = src.slice(src.indexOf("h('div', { class: 'tz-war-frame' }"), src.indexOf("h('figcaption'"));
  assert.ok(!frame.slice(0, frame.indexOf("h('ol'")).includes('tz-war-news') && !frame.includes("'tz-war-hud'"), '소식 줄·예시 표시는 지도 틀 밖(S7)');
  assert.doesNotMatch(css, /animation: tz-ping|animation: tz-drift|rotateY\(-9deg\)/, '빨간 깜빡임·큰 빛 떠다님·지도 기울임 없음');
});

test('예전 주소(k/…, items)로 오면 안내 — 이 브라우저에 저장한 내 아이디만 보여 주고 서버에는 묻지 않는다', async () => {
  const { isOldAddress, oldNote, OLD_NOTE_TEXT } = await import('../docs/views/teaser.js');
  for (const p of ['/k/abcdefgh', '/k/abcdefgh/%EB%B0%A4%ED%86%A8', '/items', '/items/']) assert.equal(isOldAddress(p), true, p);
  for (const p of ['/', '/index.html', '/kiugi', '/spoon.html', '/dex']) assert.equal(isOldAddress(p), false, p);
  assert.equal(isOldAddress('/jun-live-fanpage/k/abcdefgh', '/jun-live-fanpage/'), true);
  assert.match(OLD_NOTE_TEXT, /11월 15일/);
  const src = await text('views/teaser.js');
  const fn = src.slice(src.indexOf('export function oldNote'), src.indexOf('function bossArt()'));
  assert.match(fn, /listMine\(storage\)/);
  assert.doesNotMatch(fn, /fetch|kiugiApi|fastApi/, '서버에 묻지 않는다');
  assert.equal(typeof oldNote, 'function');
});

test('미리 받기(modulepreload)는 예고 화면이 실제로 쓰는 모듈만 — 시즌 1 화면 코드는 표(import map)에만', async () => {
  const { plan, reachable } = await import('../tools/stamp.cjs');
  const used = reachable();
  for (const m of ['/app.js', '/views/teaser.js', '/lib/teaser-map.js', '/lib/teaser-war-draw.js', '/views/common.js', '/lib/me.js']) assert.ok(used.has(m), m);
  for (const m of ['/views/character.js', '/lib/raster.js', '/lib/kiugi-save.js', '/api.js']) assert.ok(!used.has(m), m);
  const html = await text('index.html'), p = plan();
  assert.ok(p.preload.length <= 12, `미리 받는 모듈 ${p.preload.length}개`);
  assert.doesNotMatch(html, /modulepreload" href="\/views\/character\.js/);
  assert.match(html, /"\/views\/character\.js":"\/views\/character\.js\?v=/, '표에는 그대로');
});
