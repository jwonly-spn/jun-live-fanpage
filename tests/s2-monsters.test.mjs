// 시즌 2 몬스터 목록·상성·그림 이름(docs/lib/monsters.js — spec.md 2절) · 실제 목록(docs/kiugi/season-s2.json, 2026-11-15 확정 18종)·그림(WebP 54장)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
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

test('자리 목록(season-s2.json 이 없을 때): 18종(속성마다 _01·_02·_03) × 3단계 + 보스 6, 자리 이름 · 설화 없음', () => {
  for (const c of [M.defaultCatalog(), M.readCatalog(null), M.readCatalog({}), M.readCatalog({ monsters: [{ id: 'nope_01', name: '없음' }, { id: 'fire_1' }, 'x'] })]) {
    assert.equal(c.species.length, 18); assert.equal(c.bosses.length, 6); assert.equal(c.named, false); assert.equal(c.intro, '');
    assert.deepEqual(c.species.slice(0, 3).map((s) => [s.sp, s.name]), [['fire_01', '불 몬스터 1'], ['fire_02', '불 몬스터 2'], ['fire_03', '불 몬스터 3']]);
    assert.ok(c.species.every((s) => !s.rare && s.lore === '' && s.dex.length === 3 && s.dex.every((d) => d === '')));
  }
  assert.deepEqual(M.defaultCatalog().bosses.map((b) => b.id), ['boss_fire', 'boss_water', 'boss_grass', 'boss_earth', 'boss_wind', 'boss_electric']);
  assert.deepEqual(M.defaultCatalog().species.filter((s) => s.type === 'electric').map((s) => s.sp), ['electric_01', 'electric_02', 'electric_03']);
});

test('season-s2.json 은 넉넉한 모양으로 읽는다: 파일에 있는 몬스터만(파일 차례) · stageNames/stages/names · rare · lore/dex · 같은 id 두 번·모르는 속성은 버림', () => {
  const a = M.readCatalog({
    intro: ` 아주 먼 옛날,\n이름 없는 대륙에 ${String.fromCharCode(0x200b)}여섯 기운이 깃들었어요. `,
    monsters: [
      { id: 'water_03', name: '솟나루', stageNames: ['솟나루', '물솟나루', '큰너울'], rare: true, animal: '범고래', lore: '여울 설화', dex: ['하나', { text: '둘' }, 3] },
      { id: 'fire_01', name: '모루온', stages: ['모루온', '모루탄', { name: '모루칸' }] },
      { sp: 'water_01', name: '여울롤', rare: 'yes' }, { id: 'nope_01', name: '없음' }, { id: 'fire_01', name: '두 번째' }, null],
    bosses: [{ type: 'fire', name: '화산 골렘' }, { id: 'boss_water', name: '' }] });
  assert.equal(a.named, true);
  assert.deepEqual(a.species.map((s) => s.sp), ['water_03', 'fire_01', 'water_01'], '파일 차례 · 같은 id 는 처음 것만');
  assert.equal(a.intro, '아주 먼 옛날, 이름 없는 대륙에 여섯 기운이 깃들었어요.', '줄바꿈은 띄어쓰기로 · 보이지 않는 글자는 뺀다');
  const w3 = a.species[0];
  assert.deepEqual([w3.name, w3.stages, w3.rare, w3.animal, w3.lore, w3.dex], ['솟나루', ['솟나루', '물솟나루', '큰너울'], true, '범고래', '여울 설화', ['하나', '둘', '']]);
  assert.deepEqual(a.species[1].stages, ['모루온', '모루탄', '모루칸']);
  assert.equal(a.species[2].name, '여울롤'); assert.equal(a.species[2].rare, false, 'rare 는 true 일 때만');
  assert.equal(a.bosses[0].name, '화산 골렘'); assert.equal(a.bosses[1].name, '물 보스');
  const b = M.readCatalog({ monsters: { grass_01: '잎고리', earth_02: { names: ['돌돌', '돌돌이'] } } });
  assert.equal(b.species.find((s) => s.sp === 'grass_01').name, '잎고리');
  assert.deepEqual(b.species.find((s) => s.sp === 'earth_02').stages, ['돌돌', '돌돌이', '땅 몬스터 2']);
  assert.equal(M.readCatalog({ monsters: [{ id: 'fire_01', name: `  모루${String.fromCharCode(0x200b)}온  ` }] }).species[0].name, '모루온', '보이지 않는 글자는 뺀다');
  const long = M.readCatalog({ monsters: [{ id: 'fire_01', name: '가'.repeat(40), lore: '나'.repeat(3000), dex: ['다'.repeat(3000)] }] }).species[0];
  assert.equal([...long.name].length, 16); assert.equal(long.lore.length, M.LORE_MAX); assert.equal(long.dex[0].length, M.LORE_MAX);
});

test('실제 목록(docs/kiugi/season-s2.json — 먼치킨 sync): 18종 · 속성마다 3종 · _03 만 드문 몬스터 · 이름 3단계 · 설화·도감 글 · 대륙 이야기 · 그림 54장(WebP)', async () => {
  const docs = new URL('../docs/kiugi/', import.meta.url);
  const c = M.readCatalog(JSON.parse(await readFile(new URL('season-s2.json', docs), 'utf8')));
  assert.equal(c.species.length, 18); assert.equal(c.named, true); assert.ok(c.intro.length > 50, '대륙 이야기');
  for (const t of M.TYPES) assert.deepEqual(c.species.filter((s) => s.type === t.id).map((s) => s.nn), ['01', '02', '03'], t.id);
  for (const s of c.species) {
    assert.equal(s.rare, s.nn === '03', `${s.sp} 드문 몬스터는 _03`);
    assert.equal(s.stages.length, 3); assert.ok(s.stages.every((n) => n && !/몬스터 \d/.test(n)), `${s.sp} 단계 이름`);
    assert.ok(s.lore.length > 50, `${s.sp} 설화`); assert.ok(s.dex.every((d) => d.length > 20), `${s.sp} 도감 글`); assert.ok(s.animal, s.sp);
  }
  assert.equal(c.species.find((s) => s.sp === 'fire_01').name, '홍룡이');
  const files = M.artFiles(JSON.parse(await readFile(new URL('manifest.json', docs), 'utf8')));
  for (const s of c.species) for (const st of [1, 2, 3]) {
    const f = M.monsterFile(s.sp, st);
    assert.ok(files.has(f), `manifest ${f}`);
    const st2 = await stat(new URL(`s2/${f}`, docs));
    assert.ok(st2.size > 1000 && st2.size < 60e3, `${f} ${st2.size}`);
    assert.deepEqual(M.monsterArt('/', files, s.sp, st), { url: `/kiugi/s2/${f}`, stage: st, soon: false });
  }
});

test('그림 이름(monster_<속성>_<nn>_<단계>.webp · boss_<속성>.png) · 없는 단계는 앞 단계 그림 + 곧 진화 · 하나도 없으면 null(동그라미)', () => {
  assert.equal(M.monsterFile('fire_01', 2), 'monster_fire_01_2.webp');
  assert.equal(M.monsterFile('wind_03', 3), 'monster_wind_03_3.webp');
  assert.equal(M.monsterFile('fire_1', 1), '');
  assert.equal(M.bossFile('water'), 'boss_water.png');
  const files = M.artFiles({ files: { s2: ['monster_fire_01_1.webp', 'monster_fire_01_2.webp', 'monster_water_01_1.png', 'boss_fire.png', 3] } });
  assert.deepEqual(M.monsterArt('/', files, 'fire_01', 2), { url: '/kiugi/s2/monster_fire_01_2.webp', stage: 2, soon: false });
  assert.deepEqual(M.monsterArt('/', files, 'fire_01', 3), { url: '/kiugi/s2/monster_fire_01_2.webp', stage: 2, soon: true });
  assert.equal(M.monsterArt('/', files, 'water_01', 1), null, '예전 PNG 이름은 쓰지 않는다');
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
