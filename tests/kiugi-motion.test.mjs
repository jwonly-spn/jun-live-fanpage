// 캐릭터 숨쉬기·모션(2026-10-15 사용자 "캐릭터들이 2D 게임 대기 모션처럼 숨쉬듯이" · "청취자들이 모션을 살 수 있게 — 무릎 꿇고 울기·춤·손하트·스쿼트 …").
// 모션 목록·이름·값은 사이트에 복사된 시즌 목록(docs/kiugi/season-s1.json motions)에서만 — 시험도 값을 적어 두지 않고 그 파일에서 읽는다.
// 방송 채팅: "!모션 <이름>"(사서 바로 해요) · "!모션 끄기". 아이디·이름은 지어낸 것만.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { buildCatalog, characterMarkup, itemMarkup, splitScene, motionOf, motionList, motionDoing } from '../docs/lib/kiugi-draw.js';
import { motionLine, motionCommand, MOTION_CMD, MOTION_OFF, MOTION_COPIED } from '../docs/lib/try-on.js';
import { motionPriceText, MOTION_NOTE } from '../docs/views/items.js';
import { MOTION_FX, MOTION_EFFECTS } from '../docs/views/cards.js';
import { handle } from '../docs/mock.js';

const B = '/';
const read = async (p) => JSON.parse(await readFile(new URL('../docs/kiugi/' + p, import.meta.url), 'utf8'));
const src = (p) => readFile(new URL('../docs/' + p, import.meta.url), 'utf8');
const catalog = async () => {
  const manifest = await read('manifest.json');
  return buildCatalog(await Promise.all(manifest.seasons.map(read)), { files: manifest.files, adjust: {} });
};
const fmt = (n) => Number(n).toLocaleString('ko-KR');

test('모션 목록(buildCatalog motions): 시즌 목록 motions 그대로(차례·이름·그림 글자·값·설명), 이상한 줄은 빠지고, 모르는 id 는 모션 없음', async () => {
  const raw = (await read('season-s1.json')).motions, c = await catalog();
  assert.ok(Array.isArray(raw) && raw.length > 0, '시즌 목록에 모션이 있다');
  assert.deepEqual(motionList(c, 's1').map((m) => m.id), raw.map((m) => m.id), '시즌 목록 차례');
  for (const m of raw) assert.deepEqual(motionOf(c, m.id), { id: m.id, season: 's1', name: m.name, emoji: m.emoji, price: m.price, desc: m.desc }, m.id);
  for (const bad of ['moonwalk', '', null, undefined, 'toString', '__proto__', 'constructor', 7]) assert.equal(motionOf(c, bad), null, String(bad));
  assert.equal(motionOf(buildCatalog([]), 'dance'), null);
  // 이상한 줄은 빠진다(대문자·빈 이름·이름 없음), 뒤 시즌이 같은 id 를 덮는다, 그 시즌에 모션이 없으면 모든 시즌 모션
  const c2 = buildCatalog([
    { season: { id: 's1' }, motions: [{ id: 'dance', name: '춤', price: 10 }, { id: 'Bad', name: 'x' }, { id: 'nameless' }, { id: 'blank', name: '  ' }] },
    { season: { id: 's2' }, motions: [{ id: 'dance', name: '새 춤', emoji: '🕺', price: '20', desc: '새로' }] },
  ]);
  assert.deepEqual(Object.keys(c2.motions), ['dance']);
  assert.deepEqual(c2.motions.dance, { id: 'dance', season: 's2', name: '새 춤', emoji: '🕺', price: 20, desc: '새로' });
  assert.deepEqual(motionList(c2, 's1').map((m) => m.name), ['새 춤'], '그 시즌 모션이 없으면 모두');
  assert.deepEqual(buildCatalog([{ season: { id: 's1' }, motions: [{ id: 'cry', name: '울기' }] }]).motions.cry, { id: 'cry', season: 's1', name: '울기', emoji: '✨', price: 0, desc: '' }, '그림 글자·값이 없으면 기본');
  assert.deepEqual(buildCatalog([{ season: { id: 's1' } }]).motions, {});
});

test('모션 채팅(motionLine): "!모션 <이름>" · 모션 없이를 고르면 "!모션 끄기" · 지금 하는 모션과 같으면 명령 없음 · 옷 한 줄과 따로', async () => {
  const c = await catalog(), [a, b] = motionList(c, 's1');
  assert.equal(MOTION_CMD, '!모션'); assert.equal(MOTION_OFF, '!모션 끄기');
  assert.equal(motionCommand(a), `!모션 ${a.name}`); assert.equal(motionCommand(null), '');
  assert.equal(motionLine(c, a.id), `!모션 ${a.name}`, '모션이 없을 때 고르면 사기');
  assert.equal(motionLine(c, b.id, a.id), `!모션 ${b.name}`, '다른 모션으로 바꾸기');
  assert.equal(motionLine(c, a.id, a.id), '', '지금 하는 모션 그대로면 명령이 필요 없다');
  assert.equal(motionLine(c, null, a.id), MOTION_OFF, '모션 없이 → 끄기');
  assert.equal(motionLine(c, null, null), '');
  assert.equal(motionLine(c, 'moonwalk', null), '', '모르는 모션은 모션 없음');
  assert.equal(motionLine(c, null, 'moonwalk'), '', '사이트가 모르는 모션을 하고 있어도 끄기 명령을 만들지 않는다');
  assert.equal(motionLine(c, a.id, 'moonwalk'), `!모션 ${a.name}`);
  assert.match(MOTION_COPIED(`!모션 ${a.name}`), /사서 바로 해요/); assert.match(MOTION_COPIED(MOTION_OFF), /멈춰요/);
  // 지금 하는 모션 한마디(캐릭터 페이지 칩)
  assert.equal(motionDoing(motionOf(c, 'dance')), '춤추는 중'); assert.equal(motionDoing(motionOf(c, 'cry')), '우는 중');
  assert.equal(motionDoing({ id: 'x', name: '물구나무' }), '물구나무 하는 중'); assert.equal(motionDoing(null), '');
});

test('모션 값 글: 시즌 목록 값을 그대로("하나에 N냥" — 값이 다르면 쓰지 않는다), 옷 도감 모션 칸 설명', async () => {
  const c = await catalog(), list = motionList(c, 's1'), prices = new Set(list.map((m) => m.price));
  assert.equal(motionPriceText(list), prices.size === 1 ? `하나에 ${fmt([...prices][0])}냥` : '');
  assert.equal(motionPriceText([{ price: 100 }, { price: 200 }]), '');
  assert.equal(motionPriceText([{ price: 12345 }, { price: 12345 }]), '하나에 12,345냥');
  assert.equal(motionPriceText([]), '');
  const note = MOTION_NOTE(list);
  assert.ok(note.startsWith(`${list.length}가지`)); assert.ok(note.includes(motionCommand(list[0]))); assert.ok(note.includes(MOTION_OFF));
});

test('숨쉬기: 캐릭터 그림을 바탕(입은 배경·바탕 색)과 캐릭터로 나눈다(splitScene) — 캐릭터만 움직이고 바탕은 가만히', async () => {
  const c = await catalog();
  const withBg = characterMarkup(c, { gender: 'm' }, { bg: 'background_03', top: 'top_02' }, 1, { base: B, stage: null });
  const { scene, body } = splitScene(withBg);
  assert.match(scene, /^<svg viewBox="0 0 1024 1024" xmlns="http:\/\/www\.w3\.org\/2000\/svg" aria-hidden="true"><image [^>]*background_03\.png[^>]*data-step="background"\/><\/svg>$/);
  assert.doesNotMatch(body, /data-step="background"/); assert.match(body, /data-step="hair\.back"/); assert.match(body, /<defs>/);
  assert.match(body, /^<svg viewBox="0 0 1024 1024"[^>]* role="img"/, '이름(aria)은 캐릭터 쪽에');
  assert.equal(body.length + scene.length - '<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"></svg>'.length, withBg.length, '둘을 겹치면 원래 그림');
  // 바탕 색 사각형(stage 색)도 바탕 쪽으로
  const solid = splitScene(characterMarkup(c, { gender: 'f' }, { bg: 'background_01' }, 1, { base: B }));
  assert.match(solid.scene, /<rect [^>]*\/><image [^>]*data-step="background"\/>/); assert.doesNotMatch(solid.body, /<rect width/);
  // 배경이 없으면 나누지 않는다
  const plain = characterMarkup(c, { gender: 'f' }, { outfit: 'outfit_01' }, 1, { base: B, stage: null });
  assert.deepEqual(splitScene(plain), { scene: null, body: plain });
  assert.deepEqual(splitScene('<p>x</p>'), { scene: null, body: '<p>x</p>' });
  // 옷 한 벌 그림(옷 도감 칸)은 나누지 않는다(바탕이 없다)
  assert.equal(splitScene(itemMarkup(c, 'top_05', { base: B })).scene, null);
});

test('모션 효과 표(views/cards.js): 시즌 목록의 모든 모션에 움직임이 있고, 효과 글자·모양 클래스는 styles.css 에 있다', async () => {
  const raw = (await read('season-s1.json')).motions, css = await src('styles.css');
  for (const m of raw) {
    assert.ok(MOTION_FX.includes(m.id), m.id + ' 효과 표');
    assert.match(css, new RegExp(`\\.kg-actor\\.m-${m.id} > \\.kg-body \\{ animation: kg-m-${m.id} `), m.id + ' 몸 움직임');
    assert.match(css, new RegExp(`@keyframes kg-m-${m.id} \\{`), m.id + ' 키프레임');
  }
  for (const [id, fx] of Object.entries(MOTION_EFFECTS)) for (const [cls, img] of [...(fx.body || []), ...(fx.around || [])]) {
    const [first, ...rest] = cls.split(' ');
    assert.match(css, new RegExp(`\\.kg-fx-${first}[\\s{.:,]`), `${id}: .kg-fx-${first}`);
    for (const r of rest) assert.match(css, new RegExp(`\\.kg-fx-${first}\\.${r}[\\s{.:,]`), `${id}: .kg-fx-${first}.${r}`);
    // 효과 그림은 Codex 패키지(DJ_MOTION_S1)의 fx_*.png — 사이트에 있어야 한다
    assert.match(img, /^fx_[a-z_0-9]+$/, `${id}: 그림 이름 ${img}`);
    assert.ok(existsSync(new URL(`../docs/kiugi/motion/${img}.png`, import.meta.url)), `${id}: kiugi/motion/${img}.png`);
  }
  // 울기 눈물은 두 눈(캔버스 눈 482·540 → 47%·53% 근처, 아래 눈꺼풀 241 → 23.5% 근처)에서
  const left = (sel) => Number(new RegExp(`\\.${sel.replace('.', '\\.')} \\{ left: ([0-9.]+)%`).exec(css)?.[1]);
  assert.ok(left('kg-fx-tear.e1') > 46 && left('kg-fx-tear.e1') < 48, 'kg-fx-tear.e1');
  assert.ok(left('kg-fx-tear.e2') > 52 && left('kg-fx-tear.e2') < 54, 'kg-fx-tear.e2');
  // 눈 깜빡임·울기 눈: 남녀 눈 10종마다 감은 눈·우는 눈 그림이 있고, 한 번에 한 눈만 보인다(원래 눈은 그대로 둠)
  for (const g of ['female', 'male']) for (let i = 1; i <= 10; i++) for (const st of ['closed', 'cry']) {
    const f = `${g}_eyes_${String(i).padStart(2, '0')}_${st}.png`;
    assert.ok(existsSync(new URL(`../docs/kiugi/motion/${f}`, import.meta.url)), f);
  }
  assert.match(css, /\.kg-eye-closed, ?\.kg-eye-cry \{ ?opacity: ?0;? ?\}/, '감은 눈·우는 눈은 처음엔 숨김');
  assert.match(css, /\.kg-actor\.m-cry \.kg-eye-cry \{ ?opacity: ?1;? ?\}/, '울기 모션에서만 우는 눈');
});

test('움직임 모양(styles.css): 발끝 기준 숨쉬기 · 카드마다 박자 어긋남 · transform·opacity 만 움직임 · 동작 줄이기면 멈추고 효과 숨김 · 펫 통통', async () => {
  const css = await src('styles.css');
  assert.match(css, /\.kg-actor > \.kg-body \{ position: absolute; inset: 0; transform-origin: 50% 93\.4%; animation: kg-breathe 3\.6s ease-in-out infinite; \}/, '발 바닥(캔버스 y 956) 기준');
  assert.match(css, /@keyframes kg-breathe \{ 0%, 100% \{ transform: none; \} 50% \{ transform: scale\(\.995, 1\.013\); \} \}/);
  for (let i = 1; i < 5; i++) assert.match(css, new RegExp(`\\.kg-actor\\.kg-b${i} > \\.kg-body \\{ animation-delay: -`), 'kg-b' + i);
  assert.match(css, /\.kg-stage > svg, \.kg-stage > \.kg-actor \{ position: absolute;/, '캐릭터 칸은 그림 칸과 같은 자리');
  assert.match(css, /\.kg-stage\.char > svg, \.kg-stage\.char > \.kg-actor \{ width: 138\.6667%;/);
  assert.match(css, /\.kg-actor \{ container-type: size; \}/, '효과 글자 크기는 칸 너비(cqw)');
  assert.match(css, /@supports not \(width: 1cqw\) \{ \.kg-fx \{ display: none; \} \}/);
  // 숨쉬기·모션·효과·펫 키프레임은 transform·opacity 만(그림을 다시 그리지 않는다)
  const frames = [...css.matchAll(/@keyframes (kg-(?:breathe|m-[a-z]+|fx-[a-z0-9-]+|pet-hop)) \{/g)].map((m) => {
    let depth = 1, i = m.index + m[0].length;
    while (depth && i < css.length) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; i++; }
    return [m[0], m[1], css.slice(m.index + m[0].length, i - 1)];
  });
  assert.ok(frames.length >= 20, '키프레임 ' + frames.length);
  for (const [, name, body] of frames) for (const [, prop] of body.matchAll(/([a-z-]+):/g)) assert.ok(['transform', 'opacity', 'animation-timing-function'].includes(prop), `${name}: ${prop}`);
  // 동작 줄이기: 모든 애니메이션 멈춤 + 효과 숨김
  const reduce = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(css)?.[1] || '';
  assert.match(reduce, /animation: none !important/); assert.match(reduce, /\.kg-fx \{ display: none; \}/);
  assert.match(css, /\.kg-pet-buddy \.kg-pet-img \{ transform-origin: 50% 92%; animation: kg-pet-hop /);
  // 카드에 손을 올렸을 때 커지는 것도 캐릭터 칸 함께(바탕과 어긋나지 않게)
  assert.match(css, /\.kg-card:hover \.kg-card-media \.kg-stage > svg, \.kg-card:hover \.kg-card-media \.kg-stage > \.kg-actor \{ transform: scale\(1\.035\); \}/);
});

test('화면이 모션을 잇는다: 캐릭터 무대(모션)·레벨 옆 칩·안내 한 줄 · 입혀 보기 모션 탭(따로 복사) · 옷 도감 모션 칸 · 카드는 숨쉬기만', async () => {
  const character = await src('views/character.js'), items = await src('views/items.js'), cards = await src('views/cards.js'), kiugi = await src('views/kiugi.js'), intro = await src('views/intro.js');
  // 캐릭터 페이지
  assert.match(character, /const motion = motionOf\(catalog, data\.motion\);/, '모르는 모션은 모션 없음');
  assert.match(character, /eager: true, motion: motion\?\.id, kind: 'hero' \}\)/, '무대 캐릭터가 그 모션을 한다');
  assert.match(character, /motion \? h\('span', \{ class: 'kg-motion-chip' \}/); assert.match(character, /motionGuide\(catalog, seasonId\)/);
  // 입혀 보기: 모션 탭 · 미리 보기 캐릭터가 고른 모션 · 따로 복사(MOTION_COPIED) · 탭 id 가 옷 묶음과 겹치지 않는다
  const { MOTION_TAB, MOTION_EMPTY, TITLE_TAB, motionGuide } = await import('../docs/views/character.js');
  assert.equal(MOTION_TAB, 'motion'); assert.notEqual(MOTION_TAB, TITLE_TAB); assert.match(MOTION_EMPTY, /채팅 한 줄/);
  assert.equal(typeof motionGuide, 'function'); assert.equal(motionGuide(buildCatalog([]), 's1'), null, '모션이 없는 시즌은 안내도 없다');
  assert.match(character, /if \(motions\.length\) tabList\.push\(\{ slot: MOTION_TAB, name: '모션', items: motions, motion: true \}\);/);
  assert.match(character, /make: \(m\) => actorNodes\(m, \{ motion: pickMotion \}\)/);
  assert.match(character, /mLine = motionLine\(catalog, pickMotion, nowMotion\);/); assert.match(character, /setStageMotion\(stage, pickMotion\);/);
  assert.match(character, /toast\(MOTION_COPIED\(mLine\)\)/); assert.match(character, /selectNodeContents\(mLineEl\)/, '복사가 안 되면 글을 골라 둔다');
  // 옷 도감: 모션 묶음(필터 · 칸), 칸마다 움직이는 예시 캐릭터와 명령 복사
  assert.match(items, /const motionGroup = motions\.length \? \{ slot: 'motion', name: '모션', items: motions, motion: true \} : null;/);
  assert.match(items, /art\(catalog, \{ gender \}, \{\}, 1, \{ seasonId, base: app\.base, label: `\$\{m\.name\} 모션 예시`, kind: 'motion', motion: m\.id \}\)/);
  assert.match(items, /onclick: \(\) => copyMotion\(m\)/);
  // 카드·DJ 페이지·메인은 숨쉬기만(art 에 motion 을 넘기지 않는다), 옷 한 벌 그림은 움직이지 않는다
  assert.match(cards, /lazyStage\(\(\) => itemMarkup\(catalog, id, \{ base, label, gender, dj \}\), label, \{ kind: tall \? 'item tall' : 'item' \}\)/);
  assert.match(cards, /actor: true, motion: motionOf\(catalog, motion\)\?\.id \|\| null/);
  for (const [name, s] of [['kiugi.js', kiugi], ['intro.js', intro]]) assert.doesNotMatch(s, /[{,] motion:/, name);
  // 화면 글에 모션 값을 적어 두지 않는다(시즌 목록에서 — "N냥" 숫자 글 없음)
  for (const s of [character, items, cards, await src('lib/try-on.js')]) assert.doesNotMatch(s, /[0-9],?[0-9]{3}냥/);
});

test('체험 모드: 모션을 하는 지어낸 캐릭터(모션마다 한 명) · 사이트가 모르는 모션 id 는 숨쉬기만', async () => {
  const c = await catalog();
  const page = (await handle('GET', 'kiugi/find', { slug: 'nyangdj7', q: '밤톨' })).json;
  assert.equal(page.results[0].motion, 'dance');
  const ids = new Set();
  for (const slug of ['nyangdj7', 'cuky2345', 'jery2468']) for (const q of ['밤톨', '사탕요정', '달무리', '먼치팬', '호박꽃', '별사탕', '구름빵', '귤껍질', '여름밤', '꿀호떡', '초코칩', '솜사탕']) {
    const r = await handle('GET', 'kiugi/find', { slug, q });
    for (const p of r.json.results || []) if (p.motion) ids.add(p.motion);
  }
  for (const m of motionList(c, 's1')) assert.ok(ids.has(m.id), m.id + ' 를 하는 캐릭터가 있다');
  assert.ok(ids.has('moonwalk'), '모르는 모션 흉내');
  assert.equal(motionOf(c, 'moonwalk'), null);
});
