// 시즌 2 몬스터 목록·상성·그림 이름(docs/lib/monsters.js — spec.md 2절)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../docs/lib/monsters.js';

test('속성 6 · 상성 고리 물 › 불 › 풀 › 땅 › 전기 › 바람 › 물 · 강하면 1.5배 · 약하면 0.75배 · 보스 약점', () => {
  assert.deepEqual(M.TYPES.map((t) => t.id), ['fire', 'water', 'grass', 'earth', 'wind', 'electric']);
  assert.deepEqual(M.TYPES.map((t) => t.name), ['불', '물', '풀', '땅', '바람', '전기']);
  assert.deepEqual(M.RING, ['water', 'fire', 'grass', 'earth', 'electric', 'wind']);
  const chain = [['water', 'fire'], ['fire', 'grass'], ['grass', 'earth'], ['earth', 'electric'], ['electric', 'wind'], ['wind', 'water']];
  for (const [a, b] of chain) { assert.equal(M.beats(a), b); assert.equal(M.multiplier(a, b), 1.5, `${a}>${b}`); assert.equal(M.multiplier(b, a), 0.75, `${b}<${a}`); }
  assert.equal(M.multiplier('fire', 'earth'), 1); assert.equal(M.multiplier('fire', 'fire'), 1); assert.equal(M.multiplier('x', 'fire'), 1);
  // 보고서: 불 보스의 약점은 물, 물 보스의 약점은 바람
  assert.equal(M.beatenBy('fire'), 'water'); assert.equal(M.beatenBy('water'), 'wind');
});

test('경험치·레벨·힘: 2단계 4,500 · 3단계 14,000 · 레벨 = 1 + floor(√경험치 / 4) · 힘 = (10 + 레벨×4) × 1 / 1.25 / 1.5', () => {
  assert.deepEqual(M.STAGE_EXP, [0, 4500, 14000]);
  assert.equal(M.levelOf(0), 1); assert.equal(M.levelOf(15), 1); assert.equal(M.levelOf(16), 2); assert.equal(M.levelOf(4500), 17); assert.equal(M.levelOf(14000), 30);
  assert.equal(M.powerOf(1, 1), 14); assert.equal(M.powerOf(14, 2), 83); assert.equal(M.powerOf(22, 3), 147);
});

test('기본 목록: 12종(속성마다 _01·_02) × 3단계 + 보스 6, 자리 이름 · season-s2.json 이름은 넉넉한 모양으로 읽는다', () => {
  const c = M.defaultCatalog();
  assert.equal(c.species.length, 12); assert.equal(c.bosses.length, 6); assert.equal(c.named, false);
  assert.deepEqual(c.species.slice(0, 2).map((s) => [s.sp, s.name]), [['fire_01', '불 몬스터 1'], ['fire_02', '불 몬스터 2']]);
  assert.deepEqual(c.bosses.map((b) => b.id), ['boss_fire', 'boss_water', 'boss_grass', 'boss_earth', 'boss_wind', 'boss_electric']);
  const a = M.readCatalog({ monsters: [{ id: 'fire_01', name: '모루온', stages: ['모루온', '모루탄', { name: '모루칸' }] }, { sp: 'water_01', name: '여울롤' }, { id: 'nope_01', name: '없음' }, null], bosses: [{ type: 'fire', name: '화산 골렘' }, { id: 'boss_water', name: '' }] });
  assert.equal(a.named, true);
  assert.deepEqual(a.species[0].stages, ['모루온', '모루탄', '모루칸']);
  assert.equal(a.species.find((s) => s.sp === 'water_01').name, '여울롤');
  assert.equal(a.bosses[0].name, '화산 골렘'); assert.equal(a.bosses[1].name, '물 보스');
  const b = M.readCatalog({ monsters: { grass_01: '잎고리', earth_02: { names: ['돌돌', '돌돌이'] } } });
  assert.equal(b.species.find((s) => s.sp === 'grass_01').name, '잎고리');
  assert.deepEqual(b.species.find((s) => s.sp === 'earth_02').stages, ['돌돌', '돌돌이', '땅 몬스터 2']);
  assert.equal(M.readCatalog(null).named, false);
  assert.equal(M.readCatalog({ monsters: [{ id: 'fire_01', name: `  모루${String.fromCharCode(0x200b)}온  ` }] }).species[0].name, '모루온', '보이지 않는 글자는 뺀다');
});

test('그림 이름(monster_<속성>_<nn>_<단계>.png · boss_<속성>.png) · 없는 단계는 앞 단계 그림 + 곧 진화 · 하나도 없으면 null(동그라미)', () => {
  assert.equal(M.monsterFile('fire_01', 2), 'monster_fire_01_2.png');
  assert.equal(M.bossFile('water'), 'boss_water.png');
  const files = M.artFiles({ files: { s2: ['monster_fire_01_1.png', 'monster_fire_01_2.png', 'boss_fire.png', 3] } });
  assert.deepEqual(M.monsterArt('/', files, 'fire_01', 2), { url: '/kiugi/s2/monster_fire_01_2.png', stage: 2, soon: false });
  assert.deepEqual(M.monsterArt('/', files, 'fire_01', 3), { url: '/kiugi/s2/monster_fire_01_2.png', stage: 2, soon: true });
  assert.equal(M.monsterArt('/', files, 'water_01', 1), null);
  assert.deepEqual(M.bossArt('/b/', files, 'fire'), { url: '/b/kiugi/s2/boss_fire.png', stage: 1, soon: false });
  assert.equal(M.bossArt('/', files, 'grass'), null);
  assert.equal(M.artFiles(null).size, 0);
});

test('한 사람 몬스터: 대표 먼저 · 레벨 높은 순 · 모르는 몬스터·이상한 값은 뺀다 · 도감에 만난 단계', () => {
  const list = [{ sp: 'fire_02', stage: 1, lv: 6 }, { sp: 'water_01', stage: 2, lv: 14 }, { sp: 'grass_01', stage: 1, lv: 9 }, { sp: 'boss_x', stage: 1, lv: 1 }, { sp: 'fire_01', stage: 'x', lv: 2 }, null];
  assert.deepEqual(M.sortMonsters(list, 'fire_02').map((m) => m.sp), ['fire_02', 'water_01', 'grass_01']);
  assert.equal(M.sortMonsters(list, 'fire_02')[0].lead, true);
  assert.deepEqual([...M.metOf(list)], [['water_01', 2], ['grass_01', 1], ['fire_02', 1]]);
  assert.equal(M.walkCommand('wind'), '!산책 바람');
  assert.equal(M.speciesOf('electric_02').type, 'electric'); assert.equal(M.speciesOf('fire_1'), null);
});
