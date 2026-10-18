// 2026-10-19 사용자 요청 묶음(표정 고르기 · 눈 깜빡임 · 칭호 · 얼굴 잘 보이게 · 밝은 바탕 흰 글씨):
//  ① 표정(exp — 먼치킨 !표정): 그리는 표정 = 고른 표정(그 사람 레벨 이하) 아니면 레벨 표정 · 입혀 보기 "표정" 탭과 "!표정 <이름>" 복사
//  ② 큰 무대 눈 깜빡임: 새 캐릭터를 숨긴 채 고해상도를 그린 뒤 보인다 · 같은 모습이면 다시 그리지 않는다 · 고해상도 그림은 미리 한꺼번에 받는다
//  ③ 칭호: 입혀 보기는 무대 바깥 위 띠 · 카드는 글 칸에 작게 ④ 보기(전신·상반신·얼굴) · 남자 카드 칸 ⑤ 밝은 바탕 글자는 진하게
// 시즌 목록·고해상도 등록부는 사이트에 복사된 진짜 파일. 아이디·이름은 지어낸 것.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildCatalog, expressionFor, shownExp, expressionList, characterMarkup, EXP_MAX, validExp } from '../docs/lib/kiugi-draw.js';
import { expLine, expCommand, EXP_CMD, EXP_AUTO, EXP_LOCKED, EXP_COPIED } from '../docs/lib/try-on.js';
import { hdState, hdWarmPaths, hdBundle, compatBundle } from '../docs/lib/kiugi-hd.js';
import { ART } from '../docs/lib/kiugi-draw.js';

const docs = fileURLToPath(new URL('../docs/', import.meta.url));
const src = (p) => readFile(docs + p, 'utf8');
const json = async (p) => JSON.parse(await readFile(docs + p, 'utf8'));
const catalog = async () => {
  const manifest = await json('kiugi/manifest.json');
  return buildCatalog(await Promise.all(manifest.seasons.map((n) => json('kiugi/' + n))), { files: manifest.files, adjust: {} });
};

test('표정(exp): 고른 표정이 그 사람 레벨 이하면 그 표정, 아니면(없음·높음·이상한 값) 레벨 표정 · 표정 목록은 시즌 목록 그대로(열림 표시)', async () => {
  const c = await catalog(), list = c.seasons.s1.expressions;
  assert.equal(EXP_MAX, 10); assert.equal(list.length, 10);
  assert.equal(expressionFor(c, 's1', 10).name, '사랑 가득', '고르지 않으면 레벨 표정');
  assert.equal(expressionFor(c, 's1', 10, 3).name, '방긋');
  assert.equal(expressionFor(c, 's1', 10, 1).name, '기본', '1번(기본)도 고를 수 있다');
  assert.equal(expressionFor(c, 's1', 5, 9).name, list.find((e) => e.level === 5).name, '레벨보다 높은 표정은 레벨 표정(시즌이 바뀌어 레벨이 내려간 때 등)');
  for (const bad of [0, 11, 2.5, '3', null, undefined, NaN, -1]) assert.equal(expressionFor(c, 's1', 10, bad).name, '사랑 가득', String(bad));
  assert.equal(shownExp(c, 's1', 10, 3), 3); assert.equal(shownExp(c, 's1', 2, 3), null); assert.equal(shownExp(c, 's1', 10, null), null); assert.equal(shownExp(c, 's1', 10, 12), null);
  assert.equal(validExp(10), true); assert.equal(validExp(11), false);
  const el = expressionList(c, 's1', 4);
  assert.deepEqual(el.map((e) => e.level), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(el.map((e) => e.name), list.map((e) => e.name), '이름은 시즌 목록에서만');
  assert.deepEqual(el.map((e) => e.open), [true, true, true, true, false, false, false, false, false, false], 'Lv.4 면 1~4 만 열림');
  assert.deepEqual(expressionList(buildCatalog([]), 's1'), []);
  // 그림: 고른 표정이 그림에 그대로(웃는 눈·볼 발그레가 바뀐다)
  const dj = { name: '먼치', gender: 'f', hair: '2', hairColor: 'pink', eyes: '1', nose: '1', mouth: '1' };
  const lv10 = characterMarkup(c, dj, {}, 10, { seasonId: 's1' }), pick1 = characterMarkup(c, dj, {}, 10, { seasonId: 's1', exp: 1 }), pick9high = characterMarkup(c, dj, {}, 5, { seasonId: 's1', exp: 9 });
  const noId = (s) => s.replace(/kg[0-9a-z]+_/g, 'kg_');
  assert.notEqual(noId(lv10), noId(pick1), '고른 표정으로 그린다');
  assert.equal(noId(pick9high), noId(characterMarkup(c, dj, {}, 5, { seasonId: 's1' })), '잠긴 표정은 레벨 표정으로');
});

test('표정 채팅(expLine): "!표정 <이름>" · 자동을 고르면 "!표정 자동" · 지금과 같거나 잠긴 표정이면 명령 없음 · 옷 한 줄과 따로', async () => {
  const c = await catalog(), list = expressionList(c, 's1', 6);
  assert.equal(EXP_CMD, '!표정'); assert.equal(EXP_AUTO, '!표정 자동');
  assert.equal(expCommand({ name: '방긋' }), '!표정 방긋'); assert.equal(expCommand(null), '');
  assert.equal(expLine(list, 3), '!표정 방긋', '자동일 때 고르면');
  assert.equal(expLine(list, 4, 3), '!표정 방긋 발그레', '띄어쓴 이름도 시즌 목록 그대로');
  assert.equal(expLine(list, 3, 3), '', '지금 표정 그대로면 명령이 필요 없다');
  assert.equal(expLine(list, null, 3), EXP_AUTO, '자동으로 되돌리기');
  assert.equal(expLine(list, null, null), '');
  assert.equal(expLine(list, 9, null), '', 'Lv.6 은 9번(감동)을 아직 못 쓴다');
  assert.equal(expLine(list, 9, 3), '');
  assert.equal(EXP_LOCKED(7), 'Lv.7이 되면 쓸 수 있어요');
  assert.match(EXP_COPIED('!표정 방긋'), /표정이 바로 바뀌어요/); assert.match(EXP_COPIED(EXP_AUTO), /레벨 표정/);
  // 화면: 표정 탭 · 고른 표정으로 미리 보기 · 따로 복사 · 원래대로 · 잠긴 표정 알림 · 지금 고른 표정은 "쓰는 중"
  const character = await src('views/character.js');
  assert.match(character, /export const EXP_TAB = 'expression';/);
  assert.match(character, /const exps = expressionList\(catalog, sid, level\), nowExp = shownExp\(catalog, sid, level, exp\);/);
  assert.match(character, /characterMarkup\(catalog, dj\.character, look, level, \{[^\n]*exp: pickExp \}\)/, '미리 보기는 고른 표정');
  assert.match(character, /eLine = expLine\(exps, pickExp, nowExp\);/); assert.match(character, /toast\(EXP_COPIED\(eLine\)\)/);
  assert.match(character, /if \(e && !e\.open\) \{ toast\(EXP_LOCKED\(e\.level\)\); return; \}/);
  assert.match(character, /'쓰는 중'/); assert.match(character, /'골라 봄'/);
  // 캐릭터 페이지·카드·DJ 페이지·옷장·저장하기도 고른 표정
  assert.match(character, /const exp = shownExp\(catalog, seasonId, level, Number\.isInteger\(data\.exp\) \? data\.exp : null\);/);
  assert.match(character, /const look = expressionFor\(catalog, seasonId, level, exp\)/);
  const feed = await src('views/feed.js');
  assert.match(feed, /expressionFor\(catalog, seasonId, level, exp\)\.name/); assert.match(feed, /photoBox\(\{ catalog, character, worn: c\.worn, level, exp, seasonId/);
  assert.match(feed, /\.\.\.\(exp \? \{ exp \} : \{\}\)/, '캐릭터 페이지 미리 보기에도');
  assert.match(await src('views/kiugi.js'), /expressionFor\(catalog, seasonId, p\.level, Number\.isInteger\(p\.exp\) \? p\.exp : null\)/);
  assert.match(await src('lib/raster.js'), /const expression = expressionFor\(catalog, seasonId, level \|\| 1, exp\);/);
  assert.match(await src('lib/kiugi-hd.js'), /expressionFor\(opts\.catalog, opts\.seasonId, Number\(opts\.level\) \|\| 1, opts\.exp \?\? null\)/);
});

test('큰 무대 눈 깜빡임 고침: 숨긴 채 고해상도를 그린 뒤 보인다 · 늦으면 호환 그림 · 다시 그릴 때는 옛 그림을 두고 바꿔 끼운다 · 같은 모습이면 다시 그리지 않는다', async () => {
  const cards = await src('views/cards.js'), character = await src('views/character.js'), hd = await src('lib/kiugi-hd.js'), css = await src('styles.css');
  const { HD_HOLD_MS, HD_SWAP_MS } = await import('../docs/views/cards.js');
  assert.ok(HD_HOLD_MS >= 1000 && HD_HOLD_MS <= 2500, '기다리는 시간은 너무 길지 않게'); assert.ok(HD_SWAP_MS >= HD_HOLD_MS);
  assert.match(cards, /actor\.classList\.add\('is-pending'\);/);
  assert.match(cards, /if \(!hadActor\) \{ stage\.replaceChildren\(\.\.\.\[backdrop, actor\]\.filter\(Boolean\)\); stage\.classList\.add\('is-holding'\); \}\s*else stage\.append\(/, '다시 그릴 때는 옛 캐릭터를 그대로 두고 위에 얹는다');
  assert.match(cards, /timer = setTimeout\(reveal, hadActor \? swap : hold\);/);
  assert.match(cards, /upgradeStage\(stage, \{ \.\.\.hd, actor, onState: \(\) => reveal\(\) \}\)/);
  assert.match(cards, /stage\.kgRedraw = \(w, l, x = null\) => stage\.kgRepaint\(makeOf\(w, l, x\), hdOf\(w, l, x\)\);/);
  assert.match(hd, /tell\('on'\);/); assert.match(hd, /tell\('compat'\)/); assert.match(hd, /tell\('fail'\)/); assert.match(hd, /tell\('save-data'\)/); assert.match(hd, /tell\('hidden'\)/);
  assert.match(hd, /c\.classList\.add\('is-late'\)/, '호환 그림이 먼저 보인 뒤 온 고해상도는 살며시');
  // 캐릭터 페이지: 같은 캐릭터면 같은 무대 칸 — 모습이 다르면 같은 칸에 다시 그린다(새로 만들지 않는다) · 옷장 현재 모습도
  assert.match(character, /if \(same\.lookKey !== lookKey\) \{ same\.lookKey = lookKey; same\.art\.kgRedraw\?\.\(data\.worn, data\.level, exp\); \}/);
  assert.match(character, /closetStage\.kgRedraw\?\.\(data\.worn, data\.level, exp\)/);
  assert.match(character, /characterWardrobe\(data, \{ app, catalog, onTry: \(\) => tryOn\?\.open\(\), onCopyCode: copyCode, stage: closetStage \}\)/);
  // 무대를 화면에 다시 붙여도 다시 나타나지 않는다(기본 kg-fade 를 끄고 처음 한 번만 is-revealing)
  assert.match(css, /\.kg-stage\.is-hd-stage > svg, \.kg-stage\.is-hd-stage > \.kg-actor \{ animation: none; \}/);
  assert.match(css, /\.kg-stage > \.is-pending \{ opacity: 0;/); assert.match(css, /\.kg-stage > \.is-revealing \{ animation: kg-fade/);
  assert.match(css, /\.kg-stage\.is-holding::before \{/); assert.match(css, /:has\(> \.kg-stage\.is-holding\) > \.kg-pet-buddy \{ opacity: 0; \}/);
  // 입혀 보기 미리 보기도 같은 길(옷을 바꿀 때마다 호환 그림이 다시 보이지 않게) · 같은 모습이면 다시 그리지 않는다
  assert.match(character, /class: 'kg-stage char kg-try-stage is-hd-stage'/);
  assert.match(character, /const key = JSON\.stringify\(\[look, pickExp\]\);\s*if \(key === painted\) return;/);
});

test('고해상도 미리 받기(hdWarmPaths): 이 모습에 쓰는 등록부 그림·호환 그림·마스크만, 모두 renderer bundle 이 아는 길', async () => {
  const index = await json('kiugi-hd/index.json'), manifest = await json('kiugi-hd/02_클로드인계/assets.json');
  const hd = Object.fromEntries(await Promise.all(Object.entries(index.manifests).map(async ([k, e]) => [k, (await json('kiugi-hd/' + e.path)).assets])));
  const byId = new Map(manifest.assets.map((a) => [a.id, a]));
  const bundle = { ...hdBundle(hd, '/kiugi-hd/'), ...compatBundle(manifest, ART, '/') };
  const dj = { name: '먼치', gender: 'f', hair: '2', hairColor: 'pink', eyes: '2', nose: '4', mouth: '6' };
  const state = hdState(dj, { worn: { top: 'top_16', bottom: 'bottom_14', shoes: 'shoe_07', hat: 'hat_09', face: 'accessory_12' } }, { parts: ['eyes:smile', 'mouth:smile'] });
  const paths = hdWarmPaths(hd, byId, state);
  assert.ok(paths.length > 10 && paths.length < 80, String(paths.length));
  for (const p of paths) assert.ok(Object.hasOwn(bundle, p), p);
  assert.ok(paths.some((p) => /hair_02.*front/.test(p)) && paths.some((p) => /female_body/.test(p)));
  assert.ok(!paths.some((p) => /male_hair|_male\b/.test(p.replace(/female/g, ''))), '다른 몸 그림은 받지 않는다');
  assert.ok(!paths.some((p) => /03_제작기록\/r9\/wardrobe_hd\/generated\//.test(p)), '제작 기록 원본(source)은 받지 않는다');
  const male = hdState({ ...dj, gender: 'm', hair: '5' }, { worn: { outfit: 'outfit_10' } }, null);
  for (const p of hdWarmPaths(hd, byId, male)) assert.ok(Object.hasOwn(bundle, p), p);
  assert.deepEqual(hdWarmPaths({}, new Map(), {}), [], '등록부가 없으면 아무것도');
  assert.match(await src('lib/kiugi-hd.js'), /warmHd\(renderer, state\);\s*return queued\(/, '그리기 전에 한꺼번에 받기 시작');
});

test('칭호: 입혀 보기는 무대 바깥 위 띠(그림을 가리지 않는다) · 카드는 아이디 아래 글 칸에 작게(사진에 그리지 않는다)', async () => {
  const css = await src('styles.css'), character = await src('views/character.js'), feed = await src('views/feed.js'), raster = await src('lib/raster.js');
  const rule = /\n\.kg-try-title \{([^}]*)\}/.exec(css)?.[1] || '';
  assert.ok(rule && !/position:\s*absolute/.test(rule), '띠는 흐름 안(무대 위에 겹치지 않는다)');
  assert.doesNotMatch(css, /\.kg-try-look\.has-title \.kg-try-stage > svg/, '칭호 때문에 캐릭터를 줄이지 않는다');
  assert.match(character, /h\('div', \{ class: 'kg-try-look' \+ \(pet \? ' has-pet' : ''\) \}, titleTag, h\('div', \{ class: 'kg-try-stage-wrap' \}, stage, petBuddy\(pet, app\.base\)\)\)/);
  assert.match(feed, /const title = titleList\(catalog, c\.titles\)\[0\] \|\| null;/);
  assert.match(feed, /h\('b', \{ class: 'kg-post-id' \}, \.\.\.idText\(c\.id\)\),\s*titleEl,/, '아이디 바로 아래');
  assert.match(css, /\.kg-post-title \{/); assert.match(css, /\.kg-post-title-img \{/);
  assert.doesNotMatch(raster, /titleList|titles|titleImageUrl/, '카드 사진(raster)에는 칭호를 그리지 않는다');
});

test('보기(전신·상반신·얼굴): 무대 칸은 그대로, 캐릭터 칸만 키운다 — 칸 자리는 anchors.json 의 머리 꼭대기·얼굴 가운데(여자는 무대 0.91배)', async () => {
  const anchors = await json('kiugi-hd/02_클로드인계/anchors.json').catch(() => null);
  const css = await src('styles.css'), character = await src('views/character.js');
  const { HERO_VIEWS } = await import('../docs/views/character.js');
  assert.deepEqual(HERO_VIEWS.map(([v, n]) => [v, n]), [['full', '전신'], ['upper', '상반신'], ['face', '얼굴']]);
  assert.match(character, /dj\.character \? viewRow : null,/);
  const pct = (n) => Number(n.toFixed(4));
  const box = (x, y, w, h) => ({ width: pct(102400 / w), height: pct(102400 / h), left: pct(-100 * x / w), top: pct(-100 * y / h) });
  const crownM = anchors ? anchors.bodies.male.hairCrown[1] : 80, crownF0 = anchors ? anchors.bodies.female.hairCrown[1] : 80, axis = anchors ? anchors.bodies.male.faceAxisX : 512;
  const crownF = 974 - (974 - crownF0) * 0.91 - 14;
  const read = (sel) => { const m = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}').exec(css); return m ? m[1] : ''; };
  const num = (s, k) => Number(new RegExp(`${k}: (-?[0-9.]+)%`).exec(s)?.[1]);
  for (const [view, w, h, head] of [['upper', 1000 / 3, 500, 64], ['face', 160, 240, 50]]) {
    const m = read(`.kg-stage.char.hero.view-${view} > .kg-actor`), f = read(`.kg-stage.char.hero.view-${view} > .kg-actor.is-f`);
    const want = box(axis - w / 2, crownM - head, w, h), wantF = box(axis - w / 2, crownF - head, w, h);
    for (const k of ['width', 'height', 'left', 'top']) assert.ok(Math.abs(num(m, k) - want[k]) < 0.01, `${view} ${k} ${num(m, k)} ${want[k]}`);
    assert.ok(Math.abs(num(f, 'top') - wantF.top) < 0.01, `${view} 여자 top ${num(f, 'top')} ${wantF.top}`);
    assert.ok(w / h > 0.666 && w / h < 0.667, '무대와 같은 2:3');
  }
  assert.match(css, /\.kg-hero-stage\.is-zoom > \.kg-pet-buddy \{ opacity: 0; visibility: hidden; \}/, '펫은 전신에서만');
  // 보기를 바꾸는 동안 고해상도 그림 밖이 비지 않게 호환 그림을 밑에 둔다(새 고해상도는 kiugi-hd.js 가 칸 크기를 보고 다시 그린다)
  assert.match(character, /for \(const a of stage\.querySelectorAll\(':scope > \.kg-actor'\)\) a\.classList\.remove\('is-hd'\);/);
});

test('밝은 바탕 위 글자는 진하게(할로윈 색): 옷장 "현재 모습" 스티커 · Lv 동그라미 · 입혀 보기 표시', async () => {
  const css = await src('styles.css');
  assert.match(css, /\.album-sticker \{[^}]*color: #2b2030;/); assert.match(css, /\.album-level \{[^}]*color: #2b2030;/);
  assert.match(css, /\.halloween-season \.album-sticker, \.halloween-season \.album-level \{ color: #2b2030; \}/);
  assert.match(css, /\.halloween-season \.kg-try-badge \{ color: #2b2030; \}/);
});
