import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { countdown, LAUNCH_AT, readStats } from '../docs/lib/teaser-time.js';
import { MapCore } from '../docs/lib/teaser-mapcore.js';
import { ELEMENTS } from '../docs/views/teaser.js';

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
  assert.deepEqual(stats.map((s) => s.value), [12, 59, 80, 181, 130, 10, 3]);
  assert.deepEqual(stats.map((s) => s.unit), ['곳', '명', '벌', '마리', '개', '', '명']);
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

test('제공받은 MapCore: 다섯 DJ, 31일 진행, 땅 확대, 마지막 날 이후 멈춤, 같은 처음으로 초기화', () => {
  const m = MapCore();
  m.reset();
  assert.equal(m.NAMES.length, 5);
  assert.equal(new Set(m.NAMES).size, 5);
  const initial = m.labels().map((l) => l.pct);
  const first = Array.from(m.owner());
  for (let day = 2; day <= 31; day++) {
    assert.equal(m.step(), true);
    assert.equal(m.day(), day);
    assert.ok(m.labels().every((l) => l.pct >= 0 && l.pct <= 100));
  }
  assert.ok(m.labels().some((l, i) => l.pct > initial[i]));
  assert.equal(m.step(), false);
  const fields = m.fields();
  const pixels = new Uint8ClampedArray(m.CW * m.CH * 4);
  m.render(pixels, fields, fields, 1);
  assert.ok(pixels.some((v) => v > 0));
  assert.ok(m.decor().trees.length && m.decor().mts.length && m.decor().waves.length);
  m.reset();
  assert.equal(m.day(), 1);
  assert.deepEqual(Array.from(m.owner()), first);
});

test('티저 내용·순서: 첫 화면, 기록, 대격변, 1등 보상, 냥 안내, 비공식 바닥', async () => {
  const src = await text('views/teaser.js');
  assert.match(src, /hero\(\), records\(\), previews\(\), prize\(\)/);
  for (const line of [
    '한 번 입히고 끝인 옷 입히기? 시즌 2는 완전히 다릅니다.',
    '청취자들의 도파민을 책임질 영지전.',
    '최애 DJ에게 영광을 가져다줄 보스전.',
    '시즌 1에 모아 둔 냥은 시즌 2가 시작되면 전부 삭제돼요. 아이디는 그대로 이어져요.',
    '시즌 2가 시작됐어요', '1등 DJ 보상 · ', '먼치킨 1달 이용권 + ', '486', '!산책',
  ]) assert.ok(src.includes(line), line);
  assert.deepEqual(ELEMENTS.map((e) => e[1]), ['불', '물', '풀', '땅', '바람', '전기']);
  assert.match(src, /\[ELEMENTS\[1\], ELEMENTS\[0\], ELEMENTS\[2\], ELEMENTS\[3\], ELEMENTS\[5\], ELEMENTS\[4\], ELEMENTS\[1\]\]/);
  // 2026-11-15: 새 그림체 시안을 다시 그리는 동안 모두 미공개(REVEALED = -1). 공개할 때 번호만 바꾼다.
  assert.match(src, /const REVEALED = -?\d+;/);
  assert.match(src, /i === REVEALED \? h\('div', \{ class: 's2-monster-image'/);
  assert.match(src, /'s2-unofficial' \}, UNOFFICIAL/);
  assert.match(src, /'s2-footer'[\s\S]*UNOFFICIAL[\s\S]*DISCLAIMER/);
  assert.doesNotMatch(src, /innerHTML|setAttribute\(['"]style|\bstyle:|닉네임|nickname/i);
});

test('지도는 3.2초마다 하루씩·31일 후 반복, 화면 밖·숨긴 탭·움직임 줄이기·정지 때 멈춘다', async () => {
  const src = await text('lib/teaser-map.js');
  assert.match(src, /setTimeout\(advance, 3200\)/);
  assert.match(src, /if \(!M.step\(\)\) M.reset\(\)/);
  assert.match(src, /!paused && !motion.matches && visible && !document.hidden/);
  assert.match(src, /cancelAnimationFrame\(animation\)/);
  assert.match(src, /visibilitychange/);
  assert.match(src, /motion.addEventListener\('change', sync\)/);
  assert.match(src, /IntersectionObserver/);
});

test('티저 JS도 stamp 대상이며 import map 해시가 CSP와 일치한다', async () => {
  const { plan, stampHtml } = await import('../tools/stamp.cjs');
  const p = plan(), html = await text('index.html');
  assert.equal(stampHtml(html, p), html);
  const imports = JSON.parse(p.map).imports;
  for (const file of ['/views/teaser.js', '/lib/teaser-map.js', '/lib/teaser-mapcore.js', '/lib/teaser-time.js']) {
    assert.match(imports[file], /\?v=[a-f0-9]{10}$/);
  }
  const map = html.match(/<script type="importmap">([^<]+)<\/script>/)[1];
  assert.ok(html.includes(`'sha256-${createHash('sha256').update(map).digest('base64')}'`));
  assert.doesNotMatch(html, /\sstyle=|\sonclick=|<script>(?!<)/);
});
