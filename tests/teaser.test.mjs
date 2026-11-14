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

test('티저 내용·순서: 첫 화면, 기록, 대격변, 1등 보상, 냥 안내, 비공식 바닥', async () => {
  const src = await text('views/teaser.js');
  assert.match(src, /hero\(\), records\(\), previews\(\), prize\(\)/);
  for (const line of [
    'COMING SOON', '한 번 입히고 끝인 옷 입히기?', '시즌 2는 완전히 다릅니다.',
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
