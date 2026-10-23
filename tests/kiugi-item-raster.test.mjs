// 옷 한 벌 사진(2026-10-23 — 아이폰 사파리 "문제가 반복적으로 발생": 입혀 보기 신발 탭에서 페이지가 죽던 것).
//  옷 칸은 SVG(캐릭터 전체 + 머리색 필터·마스크를 옷 있는 곳만 크게 당겨 보이기)가 아니라 캔버스로 칸만큼 한 번 그린 작은 사진(lib/raster.js photoBox · item)이다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { itemPlanOf, rasterKey } from '../docs/lib/raster.js';
import { planSteps } from '../docs/lib/kiugi-save.js';
import { thumbBox, pairOf, partOf } from '../docs/kiugi/kiugi-art.js';

const docs = new URL('../docs/', import.meta.url);
const src = (p) => readFile(new URL(p, docs), 'utf8');

test('옷 한 벌 사진의 칸·계획: 옷이 있는 곳(thumbBox)만 · 전신 의상 세로 칸은 가운데 3/4 · 그 옷만 입은 모습(몸 지우기 포함) · 그림 없는 옷은 null', () => {
  for (const id of ['shoe_05', 'hat_03', 'accessory_09', 'top_05', 'bottom_11', 'outfit_02', 'background_03']) {
    const it = itemPlanOf(id);
    assert.ok(it, id);
    const p = pairOf(id), [x, y, w, h] = thumbBox(partOf(p.category, 'f', p.number)).split(' ').map(Number);
    assert.deepEqual(it.crop, [x, y, w, h], id + ' — 예전 SVG 와 같은 칸');
    assert.ok(it.crop.every((v) => v >= 0 && v <= 1024) && it.crop[0] + it.crop[2] <= 1024 && it.crop[1] + it.crop[3] <= 1024, id + ' 1024 안');
  }
  // 신발 칸은 작다(그래서 예전 SVG 가 크게 당겨 무거웠다) — 사진은 칸 크기만 그린다
  assert.ok(itemPlanOf('shoe_05').crop[2] <= 300);
  const steps = planSteps(itemPlanOf('shoe_05').plan);
  assert.ok(steps.includes('shoe') && steps.includes('body') && steps.includes('body.cut'), '신발과 몸 지우기: ' + steps.join(','));
  assert.ok(!steps.some((s) => /^(top|bottom|outfit|hat)$/.test(s)), '그 옷만 입는다');
  // 세로 칸(3:4): 예전 SVG 의 133.33% 너비 · −16.67% 자리와 같은 곳 — 가운데 3/4
  const sq = itemPlanOf('outfit_02').crop, tall = itemPlanOf('outfit_02', { tall: true }).crop;
  assert.deepEqual(tall, [sq[0] + sq[2] / 8, sq[1], sq[2] * 3 / 4, sq[3]]);
  assert.equal(tall[3] / tall[2], 4 / 3);
  // 그림 없는 옷(예전 그림의 옷 id)·모르는 id 는 null(이름 자리 표시 SVG)
  for (const id of ['shoe2_03', 'pumpkin-crown', 'nope']) assert.equal(itemPlanOf(id), null, id);
  // 얼굴: 성별이 같으면 DJ 얼굴·머리, 다르면 그 성별 기본(itemSvg 와 같은 규칙)
  assert.equal(itemPlanOf('shoe_05', { dj: { gender: 'f', hair: '10', hairColor: 'blond' } }).face.hair, '10');
  assert.equal(itemPlanOf('shoe_05', { gender: 'm', dj: { gender: 'f', hair: '10' } }).face.hair, '1');
  assert.equal(itemPlanOf('shoe_05', { gender: 'm' }).face.gender, 'm');
});

test('사진 열쇠: 머리색이 다르면 다른 사진(예전에는 같은 머리 그림이면 색이 달라도 같은 열쇠였다) · 옷 칸이 다르면 다른 사진', () => {
  const urls = ['/kiugi/r9/female_body.png?v=aaaaaaaaaaaa', '/kiugi/r9/female_hair_10_back.png?v=bbbbbbbbbbbb'];
  const a = rasterKey(urls, { kind: 'photo', s: 1, female: true, hair: 'brown' });
  assert.notEqual(rasterKey(urls, { kind: 'photo', s: 1, female: true, hair: 'blond' }), a);
  assert.notEqual(rasterKey(urls, { kind: 'item', s: 1, hair: 'brown', crop: [1, 2, 3, 4] }), rasterKey(urls, { kind: 'item', s: 1, hair: 'brown', crop: [1, 2, 3, 5] }));
});

test('화면: 옷 칸은 사진(photoBox) — 투명 PNG · 이 브라우저 캐시에는 두지 않음 · 휴대폰은 기억을 줄인다 · 그림 없는 옷만 SVG · 입는 중이 아닌 옷 흐리게도 사진에', async () => {
  const cards = await src('views/cards.js'), raster = await src('lib/raster.js'), css = await src('styles.css');
  assert.match(cards, /stage\.append\(photoBox\(\{ item: \{ id, gender, dj, tall \}, character: it\.face, base, kind: 'item' \}/);
  assert.match(cards, /const it = itemPlanOf\(id, \{ gender, dj, tall \}\);/);
  assert.match(raster, /blob = await toBlob\(canvas, Boolean\(it\)\);/, '옷 사진은 PNG(투명 — 칸 바탕이 비친다)');
  assert.match(raster, /if \(!it\) void dbPut\(/, '옷 사진은 IndexedDB 에 두지 않는다(카드 사진을 밀어내지 않게)');
  assert.match(raster, /MEM_MAX = coarse\(\) \? 60 : 300/); assert.match(raster, /TINT_MAX = coarse\(\) \? 4 : 10/);
  assert.match(raster, /else if \(!transparent\) drawStudio\(o, W, H\);/);
  assert.match(css, /\.kg-try-tile\.is-off \.kg-try-media \.kg-stage > \.kg-photo \{ opacity: \.55; \}/);
  // 입혀 보기 칸은 그대로 itemArt 를 쓴다(그래서 사진이 된다)
  assert.match(await src('views/character.js'), /itemArt\(catalog, it\.id, \{ base: app\.base, label: it\.name, gender, dj: dj\.character, tall \}\)/);
});
