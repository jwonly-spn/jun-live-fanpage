import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frameRatio, frameSize, masonry, columnsFor, fitWithin, base64Bytes, IMAGE_SPEC } from '../docs/lib/photo.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('피드 칸: 사진 비율 그대로', () => {
  const s = frameSize(390, 1200, 1200);
  near(s.height, 390); assert.equal(s.capped, false); near(s.photoWidth, 390);
  const w = frameSize(390, 1600, 900);
  near(w.height, 390 * 900 / 1600); assert.equal(w.capped, false);
  const t = frameSize(390, 1200, 1800); // 2:3 = 정확히 1.5
  near(t.height, 585); assert.equal(t.capped, false);
});

test('피드 칸: 폭×1.5를 넘으면 칸은 1.5에서 멈추고 사진은 전체(contain)', () => {
  const s = frameSize(390, 900, 1800); // 1:2
  near(s.height, 585); assert.equal(s.capped, true);
  near(s.photoHeight, 585); near(s.photoWidth, 292.5);
  assert.ok(s.photoWidth <= s.width && s.photoHeight <= s.height, '사진이 칸 밖으로 나가지 않음(잘리지 않음)');
  const r = frameRatio(900, 1600);
  assert.equal(r.capped, true); near(r.ratio, 1.5); near(r.natural, 1600 / 900);
});

test('잘못된 크기는 1:1로', () => {
  assert.deepEqual(frameRatio(0, 0), { ratio: 1, natural: 1, capped: false });
  assert.deepEqual(frameRatio('x', 5), { ratio: 1, natural: 1, capped: false });
});

test('앨범 열 수: 휴대폰 2, 태블릿 3, PC 4', () => {
  assert.equal(columnsFor(360), 2);
  assert.equal(columnsFor(639), 2);
  assert.equal(columnsFor(768), 3);
  assert.equal(columnsFor(1023), 3);
  assert.equal(columnsFor(1280), 4);
});

test('메이슨리: 가장 짧은 열에 차례로', () => {
  const items = [{ w: 1, h: 2 }, { w: 1, h: 1 }, { w: 1, h: 1 }, { w: 2, h: 1 }, { w: 1, h: 1 }];
  const cols = masonry(items, 2);
  // 0 → 열0(2), 1 → 열1(1), 2 → 열1(2), 3 → 열0(동점이면 앞 열, 2.5), 4 → 열1(3)
  assert.deepEqual(cols, [[0, 3], [1, 2, 4]]);
  const flat = cols.flat().sort((a, b) => a - b);
  assert.deepEqual(flat, [0, 1, 2, 3, 4], '모든 사진이 한 번씩');
});

test('메이슨리: 열 높이 차이가 가장 큰 사진 하나를 넘지 않음', () => {
  const items = Array.from({ length: 40 }, (_, i) => ({ w: [1200, 1200, 900, 1600, 1200][i % 5], h: [1200, 1800, 1800, 900, 1600][i % 5] }));
  for (const n of [2, 3, 4]) {
    const cols = masonry(items, n);
    const heights = cols.map((c) => c.reduce((s, i) => s + items[i].h / items[i].w, 0));
    const tallest = Math.max(...items.map((it) => it.h / it.w));
    assert.ok(Math.max(...heights) - Math.min(...heights) <= tallest + 1e-9, `${n}열`);
    cols.forEach((c) => assert.deepEqual(c, c.slice().sort((a, b) => a - b), '열 안에서는 순서 유지'));
  }
});

test('사진 줄이기 크기: 긴 변 기준, 비율 유지, 키우지 않음', () => {
  assert.deepEqual(fitWithin(4032, 3024, IMAGE_SPEC.main.maxEdge), { w: 2048, h: 1536 });
  assert.deepEqual(fitWithin(3024, 4032, IMAGE_SPEC.thumb.maxEdge), { w: 480, h: 640 });
  assert.deepEqual(fitWithin(800, 600, 2048), { w: 800, h: 600 });
  assert.deepEqual(fitWithin(10000, 10, 640), { w: 640, h: 1 });
});

test('base64 바이트 수', () => {
  assert.equal(base64Bytes('QUJD'), 3);
  assert.equal(base64Bytes('QUI='), 2);
  assert.equal(base64Bytes('QQ=='), 1);
  assert.equal(base64Bytes(Buffer.alloc(1000).toString('base64')), 1000);
});
