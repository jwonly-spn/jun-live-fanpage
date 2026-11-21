// 시즌 2 영토 지도 계산(docs/lib/map-core.js — DOM 없음) · 체험 지도(docs/mock.js simulate) · 그림 지도 땅 칸(docs/s2/land-grid.json)
//  지도 파일 약속(spec.md 5절 — 영토 서버 tr-snap/map.json): owner·col = "값*개수" 줄인 글, 바다 -2 · 숲 -1 · DJ = djs[].id
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as mc from '../docs/lib/map-core.js';
import { simulate, DEMO_DJS } from '../docs/mock.js';

const docs = new URL('../docs/', import.meta.url);
const grid = JSON.parse(await readFile(new URL('s2/land-grid.json', docs), 'utf8'));
const land = mc.landFromGrid(grid);

test('줄인 글(RLE): "값*개수" 와 값 쌍·풀어 쓴 배열을 읽고, 길이가 다르거나 모양이 틀리면 null · 만들고 다시 읽으면 같다', () => {
  assert.deepEqual([...mc.decodeRle('-2*3,-1,4*2', 6)], [-2, -2, -2, -1, 4, 4]);
  assert.deepEqual([...mc.decodeRle(' 1 * 2 , 0 ', 3)], [1, 1, 0]);
  assert.deepEqual([...mc.decodeRle([[5, 2], [-1, 1]], 3)], [5, 5, -1]);
  assert.deepEqual([...mc.decodeRle([1, 2, 3], 3)], [1, 2, 3]);
  // 칸 3개짜리: 모자람 · 넘침 · 글자 · 개수 0 · 빈 글 · 빈 칸 · 모양이 아님
  for (const bad of ['1*2', '1*5', 'x', '1*0,1*3', '', '1,,2', '1.5*3', null, 3, { a: 1 }, [[1, 2, 3]]]) assert.equal(mc.decodeRle(bad, 3), null, JSON.stringify(bad));
  const v = [-2, -2, -1, 3, 3, 3, -1, 7, -2];
  assert.equal(mc.encodeRle(v), '-2*2,-1,3*3,-1,7,-2');
  assert.deepEqual([...mc.decodeRle(mc.encodeRle(v), v.length)], v);
});

test('그림 지도 땅 칸(docs/s2/land-grid.json): 120×75, 0·1 만, 땅이 절반쯤 · 규칙 글 · 절차 대륙은 그대로(서버와 같은 모양)', () => {
  assert.ok(land, 'land-grid.json 을 읽는다');
  assert.equal(land.w, 120); assert.equal(land.h, 75);
  const n = land.land.reduce((s, x) => s + x, 0);
  assert.ok(n > 3500 && n < 6500, `땅 칸 ${n}`);
  assert.match(grid.rule, /20×20 픽셀/);
  // 절차 대륙(그림이 없을 때 — report.html MapCore 와 같은 식): 바뀌면 서버와 어긋나니 칸 수를 고정해 둔다
  const c = mc.continent();
  assert.equal(c.length, 9000);
  assert.equal(c.reduce((s, x) => s + x, 0), 3715);
});

test('지도 파일 읽기: DJ id 로 칸 잇기 · 바다(-2)가 있으면 그 모양 · %·식민지 % 는 서버 값, 없으면 칸으로 셈 · 모르는 값은 숲', () => {
  const w = 10, h = 8, N = w * h;
  const owner = Array(N).fill(-2), col = Array(N).fill(-1);
  for (let y = 2; y < 6; y++) for (let x = 2; x < 8; x++) owner[y * w + x] = -1;
  for (const i of [22, 23, 32, 33]) owner[i] = 7;
  for (const i of [26, 27, 36]) owner[i] = 9;
  owner[37] = 55; // 모르는 DJ → 숲
  col[36] = 7; // 9가 가진 칸, 원래 주인 7(식민지)
  const m = mc.parseMap({ grid: { w, h }, owner: mc.encodeRle(owner), col: mc.encodeRle(col), djs: [{ id: 7, name: ' 별사탕 ', color: '#e34948', pct: 12.5, cap: 22 }, { id: 9, name: '구름빵', dayDelta: 0.6 }], feed: ['보스 토벌 성공', { text: '영지전', at: '2026-12-02T12:00:00Z' }, 3], prize: {} });
  assert.equal(m.landCells, 24);
  assert.equal(m.djs[0].name, '별사탕');
  assert.equal(m.djs[0].pct, 12.5, '서버가 준 % 그대로');
  assert.equal(m.djs[1].cells, 3); assert.equal(Math.round(m.djs[1].pct * 100) / 100, 12.5, '칸으로 셈(3/24)');
  assert.equal(m.djs[1].colPct, (1 / 24) * 100); assert.equal(m.djs[0].ruledPct, (1 / 24) * 100);
  assert.equal(m.owner[37], mc.WILD);
  assert.equal(m.djs[0].cap, 22); assert.equal(m.djs[1].cap, null);
  assert.equal(m.feed.length, 2); assert.equal(m.feed[1].at, Date.parse('2026-12-02T12:00:00Z'));
  assert.equal(m.prize, mc.PRIZE_TEXT);
  assert.equal(mc.deltaText(m.djs[1].dayDelta), '어제보다 +0.6%');
  assert.equal(mc.deltaText(-0.44), '어제보다 −0.4%'); assert.equal(mc.deltaText(0.01), '어제와 같아요'); assert.equal(mc.deltaText(null), '');
  // id 가 정수가 아니면 차례 번호
  const m2 = mc.parseMap({ grid: { w, h }, owner: mc.encodeRle(owner.map((v) => (v === 7 ? 0 : v === 9 ? 1 : v === 55 ? -1 : v))), djs: [{ id: 'a', name: '가' }, { name: '나' }] });
  assert.equal(m2.djs[0].cells, 4); assert.equal(m2.djs[1].cells, 3);
  // 모양이 틀리면 null
  for (const bad of [null, [], { owner: '1*3' }, { grid: { w: 5, h: 5 }, owner: '-1*25' }, { grid: { w, h }, owner: '-1*79' }]) assert.equal(mc.parseMap(bad), null, JSON.stringify(bad));
});

test('바다가 없는 지도 파일은 그림 지도 땅 칸(setDefaultLand), 그것도 없으면 절차 대륙 · 지도 파일이 없을 때(emptyMap)도 같은 땅', () => {
  const allWild = mc.encodeRle(Array(9000).fill(-1));
  mc.setDefaultLand(null);
  assert.equal(mc.parseMap({ owner: allWild }).landCells, 3715, '절차 대륙');
  mc.setDefaultLand(land);
  const n = land.land.reduce((s, x) => s + x, 0);
  assert.equal(mc.parseMap({ owner: allWild }).landCells, n, '그림 지도 땅 칸');
  assert.equal(mc.emptyMap().landCells, n);
  assert.equal(mc.emptyMap().empty, true);
  mc.setDefaultLand(null);
});

test('체험 지도(mock simulate): 지도 파일 모양 그대로 · 그림 지도 땅에서 · 식민지가 생기고 "○○ 땅 · △△ 지배 중" · 이름표 자리는 지도 안', () => {
  const j = simulate({ djs: 5, day: 20, land: land.land });
  assert.equal(typeof j.owner, 'string'); assert.equal(j.grid.w, 120);
  for (const d of j.djs) { assert.ok(Number.isInteger(d.id)); assert.ok(DEMO_DJS.includes(d.name)); assert.ok(Number.isFinite(d.pct)); }
  const m = mc.parseMap(j);
  assert.equal(m.landCells, land.land.reduce((s, x) => s + x, 0), '바다(-2)를 넣었다');
  for (let i = 0; i < m.N; i++) if (!land.land[i]) assert.equal(m.owner[i], mc.SEA);
  const col = mc.coloniesOf(m);
  assert.ok(col.length >= 1, '20일이면 식민지가 있다');
  for (const c of col) { assert.match(mc.colonyText(c), /^.+ 땅 · .+ 지배 중$/); assert.notEqual(c.ruler, c.from); }
  const L = mc.labelsOf(m);
  assert.equal(L.length, 5);
  for (const l of L) { assert.ok(l.x > 0 && l.x < 1 && l.y > 0 && l.y < 1, l.name); assert.equal(m.owner[l.cap], l.k, '기지는 자기 땅'); }
  const r = mc.ranking(m);
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].pct >= r[i].pct);
  // 같은 지도 / 다른 지도
  assert.equal(mc.sameMap(m, mc.parseMap(j)), true);
  assert.equal(mc.sameMap(m, mc.parseMap(simulate({ djs: 5, day: 21, land: land.land }))), false);
});

test('지도 색: 처음 16색은 모두 다르고 파랑 계열이 없다 · 그 뒤 만든 색도 파랑을 피한다 · 서버가 파랑을 주면 바꾼다 · 같은 번호는 늘 같은 색', () => {
  const key = (c) => c.join(',');
  assert.equal(new Set(mc.MAP_PALETTE.map(key)).size, 16);
  for (let i = 0; i < 200; i++) assert.equal(mc.isBlueish(mc.paletteColor(i)), false, `${i}: ${mc.paletteColor(i)}`);
  // 처음 16색끼리는 서로 충분히 멀다(빨강·초록·파랑 차이 합)
  for (let a = 0; a < 16; a++) for (let b = a + 1; b < 16; b++) {
    const [x, y] = [mc.MAP_PALETTE[a], mc.MAP_PALETTE[b]];
    assert.ok(Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]) > 60, `${a}·${b} 가 너무 비슷하다`);
  }
  assert.deepEqual(mc.djColor('#3b86d1', 4), mc.paletteColor(4), '파랑은 바꾼다');
  assert.deepEqual(mc.djColor('#e34948', 4), [227, 73, 72], '파랑이 아니면 서버 색');
  assert.deepEqual(mc.djColor('rgb(10, 200, 30)', 1), [10, 200, 30]);
  assert.deepEqual(mc.djColor('nope', 3), mc.paletteColor(3));
  assert.deepEqual(mc.paletteColor(40), mc.paletteColor(40));
});

test('그리기: 컴퓨터 그림(renderMap)은 모든 칸을 칠하고, 그림 지도 물감 층(renderOverlay)은 DJ 땅만 칠한다(숲 한가운데·바다는 투명)', () => {
  mc.setDefaultLand(land);
  const j = simulate({ djs: 3, day: 6, land: land.land }), m = mc.parseMap(j), F = mc.fieldsOf(m);
  const S = 2, CW = m.w * S, CH = m.h * S, tex = mc.paperTexture(CW, CH);
  const a = new Uint8ClampedArray(CW * CH * 4);
  mc.renderMap(a, { ...mc.terrain(m.land, m.w, m.h), S, CW, CH, tex }, F);
  for (let p = 3; p < a.length; p += 4) assert.equal(a[p], 255);
  const o = new Uint8ClampedArray(CW * CH * 4);
  mc.renderOverlay(o, { w: m.w, h: m.h, S, CW, CH, tex }, F);
  const at = (cell) => { const x = (cell % m.w) * S + 1, y = Math.floor(cell / m.w) * S + 1; return o[(y * CW + x) * 4 + 3]; };
  const cap = m.djs[0].cap;
  assert.ok(at(cap) > 60, '기지 칸은 물감');
  assert.equal(at(0), 0, '구석 바다는 투명');
  // 숲 한가운데(주변 5칸 안에 DJ 땅이 없는 숲)
  const deep = [...Array(m.N).keys()].find((i) => { if (m.owner[i] !== mc.WILD) return false; const x = i % m.w, y = Math.floor(i / m.w); for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const k = (y + dy) * m.w + x + dx; if (m.owner[k] >= 0) return false; } return true; });
  assert.equal(at(deep), 0, '숲 한가운데는 투명(그림 그대로)');
  // 번지듯: 섞은 몫은 두 몫 사이
  const F2 = mc.fieldsOf(mc.parseMap(simulate({ djs: 3, day: 9, land: land.land }))), mid = mc.mixFields(F, F2, 0.5);
  const key = [...F2.own.keys()][0], i = cap;
  assert.ok(Math.abs(mid.own.get(key)[i] - ((F.own.get(key)?.[i] || 0) + F2.own.get(key)[i]) / 2) < 1e-6);
  assert.equal(mc.mixFields(F, F2, 1), F2);
  mc.setDefaultLand(null);
});

test('남은 날(한국 날짜): 시작 전 · 시즌 중 · 마지막 날 · 끝', () => {
  const m = { startsAt: mc.S2_START, endsAt: mc.S2_END };
  const at = (s) => mc.clockText(mc.seasonClock(m, Date.parse(s)));
  assert.equal(at('2026-11-20T10:00:00+09:00'), '12월 1일 0시에 시작해요 · 11일 남았어요');
  assert.equal(at('2026-11-30T23:00:00+09:00'), '12월 1일 0시에 시작해요 · 1일 남았어요');
  assert.equal(at('2026-12-01T00:00:00+09:00'), '12월 31일까지 30일 남았어요');
  assert.equal(at('2026-12-15T23:59:00+09:00'), '12월 31일까지 16일 남았어요');
  assert.equal(at('2026-12-31T08:00:00+09:00'), '오늘이 마지막 날이에요 · 밤 11시 59분에 끝나요');
  assert.equal(at('2027-01-01T00:00:01+09:00'), '시즌이 끝났어요 · 마지막 지도예요');
  assert.equal(mc.seasonClock({ ...m, final: true }, Date.parse('2026-12-20T00:00:00+09:00')).state, 'ended');
});

test('글 정리: 보이지 않는 글자·줄바꿈을 빼고 길이를 자른다(DJ 이름 20자)', () => {
  const zw = String.fromCharCode(0x200b), rtl = String.fromCharCode(0x202e);
  assert.equal(mc.cleanText(`  별${zw}사탕${rtl}\n방송 `, 20), '별사탕 방송');
  assert.equal([...mc.cleanText('가'.repeat(30), mc.NAME_MAX)].length, 20);
  assert.equal(mc.cleanText(3, 5), '');
});
