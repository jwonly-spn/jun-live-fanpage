// DJ 키우기 페이지(사이트): 주소 k/<주소> · 그림(kiugi-art.js 를 사이트 규칙에 맞게) · 체험 모드 가짜 서버 · 화면 글
// 아이디는 모두 지어낸 것(청취자가 방송에서 "!아이디"로 만드는 시즌 아이디 흉내, 모양 "<앞>#<캐릭터 이름>").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseRoute, buildPath, DEMO_KIUGI_SLUG } from '../docs/lib/route.js';
import { buildCatalog, expressionFor, cspSafeSvg, characterMarkup, itemMarkup, paintMarkup, STAGE, wornList, slotName, itemCodeOf, titleList, titleUntil, titleImageUrl } from '../docs/lib/kiugi-draw.js';
import { handle, KIUGI_DEMO } from '../docs/mock.js';
import { personLine, seasonLine, josa, checkQuery, idKey } from '../docs/views/kiugi.js';
import { levelLine, heartText, baseOf } from '../docs/views/cards.js';
import { itemGroups, wearLine, unit, groupPrice, REWARD_NOTE, TITLE_NOTE, TITLE_WORD, chatHint } from '../docs/views/items.js';
import { heartToken, heartKey, sentToday, markSent, kstDay, makeToken } from '../docs/lib/hearts.js';

const B = '/jun-live-fanpage/';
const read = async (p) => JSON.parse(await readFile(new URL('../docs/kiugi/' + p, import.meta.url), 'utf8'));
const catalog = async () => {
  const manifest = await read('manifest.json');
  return buildCatalog(await Promise.all(manifest.seasons.map(read)), { files: manifest.files, adjust: {} });
};

test('새 그림체 R7 그림 목록(2026-10-18 Codex R7 → 같은 날 R8 DJ_STYLE_20261018_LINES_R8 — 파일·id 그대로): 몸 2·머리 40·눈 12·코 4·입 8·옷 240 + 공통 배경 10, 주소 ?v= 는 해시 앞 12자, 그림·마스크가 모두 사이트에 있다', async () => {
  const { ART } = await import('../docs/kiugi/kiugi-r7-data.js');
  const manifest = await read('manifest.json');
  assert.equal(ART.packageId, 'DJ_STYLE_20261018_LINES_R8'); assert.equal(ART.version, 'r7'); assert.equal(ART.dir, '/kiugi/r7/'); assert.equal(ART.size, 1024);
  const count = {};
  for (const a of ART.assets) count[a.category] = (count[a.category] || 0) + 1;
  assert.deepEqual(count, { body: 2, eyes: 12, nose: 4, mouth: 8, hair: 40, top: 40, bottom: 40, shoe: 40, accessory: 40, hat: 40, outfit: 40, background: 10 });
  const r7 = new Set(manifest.files.r7), bg = new Set(manifest.files.bg);
  for (const a of ART.assets) {
    assert.match(a.v, /^[0-9a-f]{12}$/, a.id);
    assert.ok((a.category === 'background' ? bg : r7).has(a.file), a.file);
    if (a.category === 'background') assert.equal(a.dir, '/kiugi/bg/', a.id + ' 공통 배경은 kiugi/bg/');
    for (const k of ['cut', 'hem', 'hair', 'feet', 'shaft']) if (a[k]) { assert.ok(r7.has(a[k].file), a[k].file); assert.match(a[k].v, /^[0-9a-f]{12}$/); }
  }
  assert.equal(manifest.files.r7.length, 576, '그림 306 + 마스크 236 + 신발 목 자르기 34');
  assert.equal(manifest.files.bg.length, 10);
  // 기준점(anchors.json — 볼 발그레·둥실 하트 자리): 남녀 모두 얼굴 축·정수리·턱·눈·코·입
  for (const g of ['female', 'male']) for (const k of ['faceAxisX', 'hairCrown', 'chin', 'eyes', 'nose', 'mouth', 'floorY']) assert.ok(ART.anchors[g][k] !== undefined, `${g}.${k}`);
});

test('주소 k/<8자>: 헷갈리는 글자·다른 길이는 notfound, 만들고 다시 읽기', () => {
  assert.deepEqual(parseRoute('/jun-live-fanpage/k/nyangdj7', B), { name: 'kiugi', slug: 'nyangdj7' });
  assert.deepEqual(parseRoute('/k/nyangdj7/', '/'), { name: 'kiugi', slug: 'nyangdj7' });
  for (const bad of ['/jun-live-fanpage/k/nyangdj1', '/jun-live-fanpage/k/NYANGDJ7', '/jun-live-fanpage/k/nyangd', '/jun-live-fanpage/k/nyangdj7/x', '/jun-live-fanpage/k/']) assert.equal(parseRoute(bad, B).name, 'notfound', bad);
  assert.equal(buildPath(B, { name: 'kiugi', slug: 'nyangdj7' }), '/jun-live-fanpage/k/nyangdj7');
  assert.deepEqual(parseRoute(buildPath(B, { name: 'kiugi', slug: 'abcdefgh' }), B), { name: 'kiugi', slug: 'abcdefgh' });
  assert.equal(KIUGI_DEMO.slug, DEMO_KIUGI_SLUG);
});

test('사이트에 복사한 키우기 파일(새 그림체 R7): 그림 스크립트·모양 규칙·머리색(tone-map-v1)·그림 목록·시즌 목록·manifest, 예전 V5·V4·V3·V2 그림 폴더는 없다', async () => {
  const manifest = await read('manifest.json');
  assert.equal(manifest.v, 1); assert.ok(manifest.seasons.includes('season-s1.json'));
  for (const old of ['v5', 'v4', 'v3', 's1']) assert.equal(manifest.files[old], undefined, `예전 그림 폴더 ${old} 는 사이트에서도 뺐다`);
  const s1 = await read('season-s1.json');
  assert.equal(s1.season.id, 's1'); assert.equal(s1.art, 'r7'); assert.equal(s1.items.length, 130, '한벌옷·상의·하의·신발·모자·악세사리 20씩 · 배경 10');
  for (const f of ['top_20_male.png', 'bottom_20_female_hem.png', 'bottom_20_female_shaft.png', 'hat_16_female.png', 'hat_16_female_hair.png', 'accessory_17_male.png', 'female_eyes_02_cry.png', 'male_mouth_01_smile.png', 'female_body_feet.png']) assert.ok(manifest.files.r7.includes(f), f);
  // 시즌 칭호 5개(입는 칸 없음): 배지 그림은 titles/<id>.png — manifest 의 titles 목록과 파일이 모두 있다
  assert.equal(s1.seasonRewards.length, 5);
  for (const r of s1.seasonRewards) { assert.equal(r.slot, undefined, r.id + ' 칸 없음(칭호)'); assert.equal(r.image, `titles/${r.id}.png`, r.id); }
  assert.deepEqual([...manifest.files.titles].sort(), s1.seasonRewards.map((r) => r.id + '.png').sort());
  for (const f of manifest.files.titles) assert.deepEqual([...(await readFile(new URL('../docs/kiugi/titles/' + f, import.meta.url))).subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], f + ' PNG');
  for (const name of ['kiugi-art.js', 'kiugi-look.js', 'kiugi-hair-color.js', 'kiugi-r7-data.js']) await readFile(new URL('../docs/kiugi/' + name, import.meta.url));
  await assert.rejects(readFile(new URL('../docs/kiugi/kiugi-v5-data.js', import.meta.url)));
  await assert.rejects(readFile(new URL('../docs/kiugi/v5/hair-color-luts.json', import.meta.url)));
  await assert.rejects(readFile(new URL('../docs/kiugi/kiugi-v4-data.js', import.meta.url)));
  await assert.rejects(readFile(new URL('../docs/kiugi/kiugi-v3-data.js', import.meta.url)));
  await assert.rejects(readFile(new URL('../docs/kiugi/s1/adjust.json', import.meta.url)));
});

test('옷 표·레벨 표정(새 그림체 R7): 한벌옷·상의·하의·신발·모자·악세사리(묶음·번호, 악세사리 자리 머리·얼굴·목·손), 입은 옷 칸(시즌 칸 차례), 모르는 시즌은 마지막 시즌 표정', async () => {
  const c = await catalog();
  // 값은 묶음마다 하나(먼치킨 rules.mjs 와 같게): 한벌옷 2,500 · 상의·하의·신발 700 · 모자 500 · 악세사리 400 · 배경 500. 옷에는 레벨 조건이 없다(level·등급 칸 없음).
  assert.deepEqual(c.items.outfit_02, { slot: 'outfit', cat: 'outfit', number: 2, season: 's1', name: '모노 워크 점프수트', style: '데일리', price: 2500 }, '값은 묶음 값(먼치킨 rules.mjs 와 같게)');
  assert.deepEqual(c.items.accessory_06, { slot: 'head', cat: 'acc', number: 6, season: 's1', name: '배트윙 실버 이어커프', style: '할로윈', price: 400 });
  assert.deepEqual(c.items.accessory_02, { slot: 'face', cat: 'acc', number: 2, season: 's1', name: '블랙 슬림 스퀘어 안경', style: '데일리', price: 400 });
  assert.deepEqual(c.items.top_05, { slot: 'top', cat: 'top', number: 5, season: 's1', name: '올리브 포켓 워크 재킷', style: '데일리', price: 700 });
  assert.deepEqual(c.items.bottom_15, { slot: 'bottom', cat: 'bottom', number: 15, season: 's1', name: '그래파이트 카고 미니스커트', style: '데일리', price: 700 });
  // 모자(R7 에서 새 칸 — 묶음 말 "모자", 한 번에 하나)
  assert.deepEqual(c.items.hat_16, { slot: 'hat', cat: 'hat', number: 16, season: 's1', name: '레이스 문라이트 마녀모자', style: '할로윈', price: 500 });
  const PRICE = { outfit: 2500, top: 700, bottom: 700, shoes: 700, hat: 500, acc: 400, bg: 500 };
  for (const [id, it] of Object.entries(c.items)) { assert.equal(it.price, PRICE[it.cat], id); assert.equal(it.level, undefined, id + ' 레벨 조건 없음'); assert.equal(it.tier, undefined, id); }
  // 악세사리 자리는 시즌 목록(그림 목록) 그대로: 목 8 · 손 6 · 얼굴 4 · 머리 2
  const places = {}; for (const it of Object.values(c.items)) if (it.cat === 'acc') places[it.slot] = (places[it.slot] || 0) + 1;
  assert.deepEqual(places, { neck: 8, face: 4, hand: 6, head: 2 });
  // 예전 그림의 옷(V5 상의·하의 21~30 · 신발 shoe2_ · 악세 acc2_ — 왕관·날개·오라 포함)과 예전 시즌 보상 id 는 목록에 없다
  for (const old of ['top_21', 'bottom_30', 'shoe2_01', 'acc2_01', 'acc2_11', 'acc2_12', 'acc2_13', 'outfit_21', 'pumpkin-crown', 'shadow-wings', 'moonlight-aura']) assert.equal(c.items[old], undefined, old);
  assert.ok(!Object.values(c.items).some((it) => it.reward), '이 시즌에는 보상 옷이 없다(시즌 보상 = 칭호)');
  assert.equal(c.seasons.s1.rewardRule.lasts, 2, '칭호는 얻은 시즌과 다음 시즌까지'); assert.equal(c.seasons.s1.rewardRule.minAttendance, 0, '칭호는 출석 조건 없음');
  assert.deepEqual(c.seasons.s1.slots.map((s) => s.id), ['outfit', 'top', 'bottom', 'shoes', 'hat', 'head', 'face', 'neck', 'hand', 'bg']);
  assert.deepEqual(c.seasons.s1.categories.map((s) => [s.id, s.code, s.price]), [['outfit', '한벌', 2500], ['top', '상의', 700], ['bottom', '하의', 700], ['shoes', '신발', 700], ['hat', '모자', 500], ['acc', '악세', 400], ['bg', '배경', 500]]);
  assert.deepEqual(c.items.background_04, { slot: 'bg', cat: 'bg', number: 4, season: 's1', name: '벨벳 고딕 홀', price: 500 });
  assert.deepEqual(wornList(c, 's1', { bg: 'background_04', hand: 'accessory_09', crown: 'acc2_11', outfit: 'outfit_01', head: 'witch-hat', top: 'no-such', shoes: 'shoe2_03', hat: 'hat_16', neck: 'accessory_02', wings: 'acc2_12' }).map((w) => [w.slotName, w.name]),
    [['한벌옷', '어반 테일러 셋업'], ['모자', '레이스 문라이트 마녀모자'], ['손 장식', '호박 캔디 미니버킷'], ['배경', '벨벳 고딕 홀']], '시즌 칸 순서, 목록에 없는 옷(예전 그림의 옷)·칸과 맞지 않는 옷(목 칸의 안경)은 뺀다');
  assert.equal(slotName(c, 's1', 'neck'), '목 장식'); assert.equal(slotName(c, 's1', 'hat'), '모자'); assert.equal(slotName(c, 's1', 'crown'), 'crown', '모르는 칸은 칸 id 그대로');
  assert.equal(expressionFor(c, 's1', 1).name, '기본'); assert.equal(expressionFor(c, 's1', 8).name, '하트 가득'); assert.equal(expressionFor(c, 's1', 99).name, '사랑 가득');
  assert.equal(expressionFor(c, 's9', 8).name, '하트 가득');
  assert.equal(expressionFor(buildCatalog([]), 's1', 5).name, '기본');
});

test('그림 글을 사이트 규칙(CSP: 인라인 style 금지)과 사이트 주소에 맞게: style→fill, 그림 파일은 BASE/kiugi/r7(배경 bg) 아래, 마스크는 속성으로', async () => {
  assert.equal(cspSafeSvg('<svg><rect style="fill:var(--kg-stage,#EFE9F8)"/><image href="/kiugi/r7/a.png?v=0123456789ab"/><image href="/kiugi/bg/b.png?v=0123456789ab"/><g style="opacity:.5"/></svg>', B),
    '<svg><rect fill="#EFE9F8"/><image href="/jun-live-fanpage/kiugi/r7/a.png?v=0123456789ab"/><image href="/jun-live-fanpage/kiugi/bg/b.png?v=0123456789ab"/><g/></svg>');
  const c = await catalog();
  // 예전 판 먼치킨이 올린 DJ 캐릭터(V2 값 long·skin)도 가장 비슷한 그림으로 · 밑단 한벌옷 + 신발(신발 목 자르기 · 기본 운동화 지우기) · 모자(머리 지우기) · 머리 장식
  const svg = characterMarkup(c, { name: '먼치', gender: 'f', hair: 'long', hairColor: 'pink', skin: 's2' }, { outfit: 'outfit_03', top: 'top_01', shoes: 'shoe_02', head: 'accessory_06', face: '<script>', hat: 'hat_16', aura: 'moonlight-aura' }, 8, { seasonId: 's1', base: B, label: '밤톨이님의 "캐릭터"' });
  assert.doesNotMatch(svg, / style="/); assert.match(svg, new RegExp(`fill="${STAGE}"`));
  for (const f of ['female_body', 'female_body_feet', 'female_hair_02_back', 'female_hair_02_front', 'outfit_03_female', 'outfit_03_female_cut', 'outfit_03_female_hem', 'outfit_03_female_shaft', 'shoe_02_female', 'shoe_02_female_cut', 'accessory_06_female', 'hat_16_female', 'hat_16_female_hair'])
    assert.match(svg, new RegExp(`href="/jun-live-fanpage/kiugi/r7/${f}\\.png\\?v=[0-9a-f]{12}"`), f);
  assert.doesNotMatch(svg, /top_01_female/, '한벌옷이 상의를 덮는다');
  assert.match(svg, /mask="url\(#kg[a-z0-9]+_c0\)"/); assert.match(svg, /mask-type="alpha"/);
  assert.doesNotMatch(svg, /href="\/kiugi\//);
  assert.match(svg, /aria-label="밤톨이님의 &quot;캐릭터&quot;"/);
  assert.doesNotMatch(svg, /<script/, '이상한 옷 id 는 그리지 않는다');
  assert.match(svg, /^<svg viewBox="0 0 1024 1024"/);
  assert.ok(svg.indexOf('data-step="accessory.head"') < svg.indexOf('data-step="hat"'), '모자는 머리 장식 위(맨 위)');
  // 옷 한 벌(도감): 기본 캐릭터가 그 옷만 입은 모습, 성별 버전, 예전 그림의 옷·예전 시즌 보상 id 는 이름 자리 표시(그림 없음)
  assert.match(itemMarkup(c, 'outfit_05', { base: B, gender: 'm' }), /kiugi\/r7\/outfit_05_male\.png/);
  assert.match(itemMarkup(c, 'top_05', { base: B }), /kiugi\/r7\/top_05_female\.png/);
  assert.match(itemMarkup(c, 'hat_05', { base: B, gender: 'm' }), /kiugi\/r7\/hat_05_male\.png/);
  assert.match(itemMarkup(c, 'accessory_09', { base: B }), /kiugi\/r7\/accessory_09_female\.png/);
  for (const id of ['pumpkin-crown', 'acc2_11', 'shoe2_03', 'top_25']) assert.doesNotMatch(itemMarkup(c, id, { base: B, gender: 'm' }), /<image/, id + ' 는 예전 그림의 옷 — 이름 자리 표시');
  assert.match(itemMarkup(c, 'witch-hat', { base: B }), />witch-hat</);
  // 배경(BG10 — 그림체와 상관없는 공통 배경 kiugi/bg/): 맨 아래 장면(남녀 같은 그림), 옷 도감 칸은 장면 전체
  const withBg = characterMarkup(c, { gender: 'm' }, { bg: 'background_03', top: 'top_02' }, 1, { base: B, stage: null });
  assert.match(withBg, /href="\/jun-live-fanpage\/kiugi\/bg\/background_03\.png\?v=[0-9a-f]{12}"[^>]*data-step="background"/);
  assert.ok(withBg.indexOf('data-step="background"') < withBg.indexOf('data-step="hair.back"'));
  assert.match(itemMarkup(c, 'background_03', { base: B }), /viewBox="0 0 1024 1024"/);
  assert.doesNotMatch(characterMarkup(c, { gender: 'f' }, { bg: 'halloween-night' }, 1, { base: B }), /background_/, '예전(V2) 배경 id 는 그리지 않는다');
});

test('그림 칸 넣기(paintMarkup): 그림을 다 받은 뒤 한 번에, 빨리 여러 번 그리면 마지막 것만, 못 받은 그림은 칸에 표시', async () => {
  const c = await catalog();
  const stage = { dataset: {}, kids: null, replaceChildren(...k) { this.kids = k; } };
  const a = characterMarkup(c, { gender: 'f' }, { outfit: 'outfit_01' }, 1, { base: B }), b = characterMarkup(c, { gender: 'm' }, { outfit: 'outfit_02' }, 1, { base: B });
  const slow = (u) => new Promise((r) => setTimeout(r, u.includes('outfit_01') ? 30 : 1));
  const [ra, rb] = await Promise.all([paintMarkup(stage, a, { load: slow, make: (m) => ({ m }) }), paintMarkup(stage, b, { load: slow, make: (m) => ({ m }) })]);
  assert.deepEqual([ra, rb], [false, true]); assert.equal(stage.kids[0].m, b);
  await paintMarkup(stage, a, { load: (u) => (u.includes('outfit_01_female.png') ? Promise.reject(new Error('x')) : Promise.resolve()), make: (m) => ({ m }) });
  assert.equal(stage.dataset.kgArtError, '1');
});

test('체험 모드 가짜 서버: 열린 페이지·닫힌 페이지·없는 페이지·아이디로 찾기(정확히 같은 아이디 먼저)', async () => {
  const page = await handle('GET', 'kiugi/page', { slug: KIUGI_DEMO.slug });
  assert.equal(page.status, 200);
  assert.deepEqual(Object.keys(page.json).sort(), ['character', 'count', 'name', 'paused', 'season', 'slug', 'top', 'updatedAt']);
  assert.equal(page.json.name, '먼치');
  assert.equal(page.json.top.length, 3); assert.equal(page.json.top[0].rank, 1);
  assert.deepEqual(page.json.top.map((p) => p.id), ['밤톨#먼치', '사탕요정#먼치', '달무리#먼치']);
  // 서버(publicPerson)와 같은 모양: 단 칭호가 있는 사람만 titles 칸이 있다
  for (const p of page.json.top) { assert.deepEqual(Object.keys(p).filter((k) => !['titles', 'motion', 'pets', 'pet'].includes(k)).sort(), ['hearts', 'id', 'level', 'rank', 'worn']); assert.match(p.id, /^[가-힣]{1,6}#먼치$/); }
  // 펫(2026-10-16 — 서버 publicPerson 처럼 1~3등도 pets·pet): 체험 자료는 1~3등만 펫이 있다
  assert.deepEqual(page.json.top.map((p) => p.pet?.id ?? null), ['ghost', 'blackcat', 'mummy']);
  assert.deepEqual(page.json.top.map((p) => p.titles ?? null), [['title-halloween-insa'], ['title-candy-plz'], null]);
  // 모션(2026-10-15): 하는 모션이 있는 사람만 motion 칸(모션 id 하나)
  assert.deepEqual(page.json.top.map((p) => p.motion ?? null), ['dance', 'cry', 'trash']);
  assert.doesNotMatch(JSON.stringify(page.json), /nickname/);
  const closed = await handle('GET', 'kiugi/page', { slug: 'shutpg22' });
  assert.equal(closed.status, 404); assert.equal(closed.json.closed, true);
  assert.equal((await handle('GET', 'kiugi/page', { slug: 'abcdefgh' })).status, 404);
  const found = (await handle('GET', 'kiugi/find', { slug: KIUGI_DEMO.slug, q: ' 밤 톨 ' })).json;
  assert.deepEqual(found.results.map((p) => p.id), ['밤톨#먼치', '밤톨이네#먼치', '작은밤톨#먼치'], '앞 부분이 같은 사람 먼저, 그다음 들어 있는 사람');
  assert.equal(found.exact, 1);
  assert.deepEqual(Object.keys(found.results[0]).sort(), ['hearts', 'id', 'level', 'motion', 'pet', 'pets', 'rank', 'titles', 'worn']);
  assert.deepEqual(found.results[0].titles, ['title-halloween-insa']);
  assert.equal(Object.hasOwn(found.results[1], 'titles'), false, '칭호 없는 사람은 titles 칸이 없다');
  assert.deepEqual((await handle('GET', 'kiugi/find', { slug: KIUGI_DEMO.slug, q: '사탕요정#먼치' })).json.results.map((p) => p.id), ['사탕요정#먼치'], '전체 아이디로');
  assert.equal((await handle('GET', 'kiugi/find', { slug: KIUGI_DEMO.slug, q: '먼치팬' })).json.results[0].id, '먼치팬#먼치', '안내 예시 아이디로 찾을 수 있다');
  assert.deepEqual((await handle('GET', 'kiugi/find', { slug: KIUGI_DEMO.slug, q: '먼치' })).json.results.map((p) => p.id), ['먼치팬#먼치'], '캐릭터 이름으로 찾아도 모두가 나오지 않는다(앞 부분끼리만 비교)');
  for (const q of ['', 'Pumpkin', '가'.repeat(7), '#먼치', '밤톨#']) {
    const r = await handle('GET', 'kiugi/find', { slug: KIUGI_DEMO.slug, q });
    assert.equal(r.status, 400, q); assert.match(r.json.error, /아이디.*1~6자/);
  }
});

test('화면 글: 순위·아이디·레벨 표정·하트(애정도 숫자 없음), 시즌 끝나는 날, 찾기 칸 검사', async () => {
  const c = await catalog();
  assert.deepEqual(personLine({ rank: 4, id: '사탕요정#먼치', level: 7, love: 2345, hearts: 3 }, c, 's1'), { title: '4등 · 사탕요정#먼치', sub: 'Lv.7 두근두근 · ♥ 3' });
  assert.equal(levelLine(c, 's1', 8), 'Lv.8 하트 가득'); assert.equal(heartText(1234), '♥ 1,234'); assert.equal(baseOf('밤톨#먼치'), '밤톨');
  assert.equal(seasonLine({ name: '할로윈', endsAt: '2026-11-30T14:59:59.000Z' }, Date.parse('2026-10-20T00:00:00Z')), '할로윈 시즌 · 11월 30일까지');
  assert.equal(seasonLine(null), '다음 시즌 준비 중');
  assert.equal(josa('먼치킨', '을', '를'), '먼치킨을'); assert.equal(josa('먼치', '을', '를'), '먼치를');
  assert.equal(josa('먼치킨', '이', '가'), '먼치킨이'); assert.equal(josa('DJ', '이', '가'), 'DJ가'); assert.equal(josa('루나7', '이', '가'), '루나7이');
  assert.equal(checkQuery(' 달 무리 '), null); assert.equal(idKey(' 달 무리 '), '달무리');
  assert.equal(checkQuery('밤톨'.normalize('NFD')), null);
  assert.match(checkQuery(''), /적어 주세요/); assert.match(checkQuery('   '), /적어 주세요/);
  assert.equal(checkQuery('먼치팬#먼치'), null); assert.equal(checkQuery(' 먼치팬 # Munchi7 '), null);
  for (const bad of ['abc', '밤톨1', '가나다라마바사', 'ㅂㅌ', '#먼치', '밤톨#', '밤톨#먼치#먼치', '밤톨#가나다라마바사아자']) assert.match(checkQuery(bad), /한글 1~6자/, bad);
});

test('체험 모드: 메인(home)·캐릭터(person)·전체 찾기(search)·하트(heart) — 지어낸 DJ 셋(먼치·쿠키·젤리)', async () => {
  const home = (await handle('GET', 'kiugi/home', {})).json;
  assert.deepEqual(Object.keys(home).sort(), ['djs', 'items', 'popular', 'recent', 'season', 'totals']);
  assert.deepEqual(home.djs.map((d) => d.name).sort(), ['먼치', '젤리', '쿠키']);
  assert.ok(home.popular.length > 0 && home.popular.length <= 12);
  assert.ok(home.popular.every((c, i, a) => c.hearts > 0 && (i === 0 || a[i - 1].hearts >= c.hearts)), '하트 많은 순');
  // 카드 모양(서버 card 와 같게): 단 칭호가 있는 사람만 titles 칸
  //  함께하는 펫이 있는 사람만 pet 칸(만난 펫 목록 pets 는 카드에 없다 — 서버 card 의 petOf, 2026-10-16 메인 카드에 펫)
  for (const card of [...home.popular, ...home.recent]) assert.deepEqual(Object.keys(card).filter((k) => !['titles', 'motion', 'pet'].includes(k)).sort(), ['djName', 'hearts', 'id', 'level', 'slug', 'worn'], card.id);
  assert.deepEqual(home.popular[0].pet, { id: 'ghost', stage: 3 }, '1등(밤톨#먼치)은 장난 유령과 함께');
  assert.ok([...home.popular, ...home.recent].some((x) => !Object.hasOwn(x, 'pet')), '펫이 없는 사람은 pet 칸이 없다');
  assert.equal(home.popular[0].motion, 'dance', '카드에도 하는 모션(사이트 카드는 숨쉬기만)');
  assert.deepEqual(home.popular[0].titles, ['title-halloween-insa'], '1등(밤톨#먼치)은 칭호를 달았다');
  assert.ok(home.popular.some((x) => !Object.hasOwn(x, 'titles')));
  assert.ok(home.recent.length > 0 && home.recent.length <= 8);
  assert.ok(home.items.length > 0 && home.items.every((x, i, a) => i === 0 || a[i - 1].count >= x.count));
  assert.equal(home.totals.djs, 3);
  assert.doesNotMatch(JSON.stringify(home), /"love"|"ch"|"k"|nickname/);
  const person = await handle('GET', 'kiugi/person', { slug: 'cuky2345', id: '귤껍질' });
  assert.equal(person.status, 200);
  // 펫(2026-10-15): 체험 모드 1~3등은 만난 펫(pets)·함께하는 펫(pet)이 있다
  assert.deepEqual(Object.keys(person.json).sort(), ['dj', 'hearts', 'id', 'level', 'motion', 'pet', 'pets', 'season', 'titles', 'worn']);
  assert.equal(person.json.motion, 'cry');
  assert.equal(person.json.id, '귤껍질#쿠키'); assert.equal(person.json.dj.name, '쿠키');
  // 캐릭터(person)는 서버처럼 titles 를 늘 배열로(단 칭호 하나 또는 빈 배열)
  assert.deepEqual(person.json.titles, ['title-halloween-insa']);
  assert.deepEqual((await handle('GET', 'kiugi/person', { slug: 'cuky2345', id: '별사탕' })).json.titles, []);
  assert.deepEqual((await handle('GET', 'kiugi/person', { slug: KIUGI_DEMO.slug, id: '새벽달' })).json.titles, ['title-kiugi-master']);
  // 체험 자료의 칭호 id 는 모두 시즌 목록에 있는 칭호(화면이 이름·그림을 찾을 수 있다)
  const c = await catalog();
  const people = (await Promise.all(['nyangdj7', 'cuky2345', 'jery2468'].map((slug) => handle('GET', 'kiugi/page', { slug })))).flatMap((r) => r.json.top);
  for (const p of people) for (const t of p.titles || []) assert.ok(c.titles[t], t);
  assert.deepEqual(titleList(c, person.json.titles).map((t) => [t.name, t.code, t.until]), [['할로윈 인싸', '칭호1', '시즌2까지']]);
  assert.equal((await handle('GET', 'kiugi/person', { slug: 'cuky2345', id: '없는사람' })).status, 404);
  const s = (await handle('GET', 'kiugi/search', { q: '여름밤' })).json;
  assert.deepEqual(s.results.map((r) => r.djName).sort(), ['젤리', '쿠키']); assert.equal(s.exact, 2);
  assert.deepEqual((await handle('GET', 'kiugi/search', { q: '달무리#젤리' })).json.results.map((r) => r.slug), ['jery2468']);
  assert.equal((await handle('GET', 'kiugi/search', { q: 'abc' })).status, 400);
  const token = 'demoTOKENdemoTOKENdemoTOKEN12345';
  const before = person.json.hearts;
  assert.deepEqual((await handle('POST', 'kiugi/heart', {}, { slug: 'cuky2345', id: '귤껍질#쿠키', token })).json, { hearts: before + 1, already: false });
  assert.deepEqual((await handle('POST', 'kiugi/heart', {}, { slug: 'cuky2345', id: '귤껍질', token })).json, { hearts: before + 1, already: true });
  assert.equal((await handle('POST', 'kiugi/heart', {}, { slug: 'cuky2345', id: '귤껍질', token: 'x' })).status, 400);
});

test('하트 기억(lib/hearts.js): 브라우저 열쇠 32자, 오늘 보낸 캐릭터, 날짜가 바뀌면 다시, 저장소가 막혀도 동작', () => {
  const box = new Map();
  const storage = { getItem: (k) => (box.has(k) ? box.get(k) : null), setItem: (k, v) => box.set(k, String(v)) };
  const t = heartToken(storage, (n) => new Uint8Array(n).fill(7));
  assert.match(t, /^[A-Za-z0-9_-]{32}$/); assert.equal(heartToken(storage), t, '한 번 만들면 그대로');
  assert.match(makeToken(), /^[A-Za-z0-9_-]{32}$/);
  const key = heartKey('nyangdj7', '밤톨#먼치', 's1');
  const T = Date.parse('2026-10-20T12:00:00Z');
  assert.equal(kstDay(T), '2026-10-20');
  assert.equal(sentToday(storage, key, T), false);
  markSent(storage, key, T);
  assert.equal(sentToday(storage, key, T), true);
  assert.equal(sentToday(storage, heartKey('nyangdj7', '밤톨#먼치', 's2'), T), false, '시즌이 바뀌면 다시');
  assert.equal(sentToday(storage, key, T + 3 * 3600000), false, '한국 자정이 지나면 다시');
  const broken = { getItem() { throw new Error('막힘'); }, setItem() { throw new Error('막힘'); } };
  const t2 = heartToken(broken);
  assert.match(t2, /^[A-Za-z0-9_-]{32}$/); assert.equal(heartToken(broken), t2, '막힌 저장소는 이번 창에서만 기억');
  markSent(broken, 'x/y/z', T); assert.equal(sentToday(broken, 'x/y/z', T), true);
  assert.equal(sentToday(null, 'nope', T), false);
});

test('첫 화면 숫자 칸(시즌 번호·남은 날, 한국 날짜)과 캐릭터 페이지 입은 옷 칸(빈 칸 포함)', async () => {
  // (2026-10-09 두 번째 새 디자인: 영문 머리글 "SEASON 01" 은 없앴다 — 시즌 띠는 seasonLine 글 + D-52)
  const { seasonNo, daysLeft, dDay } = await import('../docs/views/kiugi.js');
  const { loadoutSlots } = await import('../docs/views/character.js');
  const s = { id: 's1', name: '할로윈', endsAt: '2026-11-30T23:59:59+09:00' };
  assert.equal(seasonNo(s), 1); assert.equal(seasonNo(null), null);
  assert.equal(daysLeft(s, Date.parse('2026-10-09T00:00:00Z')), 52); assert.equal(dDay(s, Date.parse('2026-10-09T00:00:00Z')), 'D-52');
  assert.equal(dDay(s, Date.parse('2026-11-29T15:30:00Z')), 'D-DAY', '한국 날짜로 마지막 날');
  assert.equal(daysLeft(s, Date.parse('2026-12-05T00:00:00Z')), 0, '지나면 0');
  assert.equal(daysLeft({ endsAt: 'x' }), null);
  const c = await catalog();
  // 모자(R7 새 칸)도 시즌 칸 — 신발 뒤·머리 장식 앞, 빈 칸으로도 보인다. 예전 그림의 옷(acc2_ 등)은 칸에 넣지 않는다.
  const slots = loadoutSlots(c, 's1', { head: 'accessory_06', hat: 'hat_09', top: 'witch-hat', aura: 'acc2_13', face: 'acc2_04' });
  assert.deepEqual(slots.map((w) => [w.slot, w.id]), [['outfit', null], ['top', null], ['bottom', null], ['shoes', null], ['hat', 'hat_09'], ['head', 'accessory_06'], ['face', null], ['neck', null], ['hand', null], ['bg', null]]);
  assert.equal(slots[5].slotName, '머리 장식'); assert.equal(slots[5].name, '배트윙 실버 이어커프'); assert.equal(slots[0].slotName, '한벌옷');
  assert.deepEqual([slots[4].slotName, slots[4].name, slots.at(-1).slotName], ['모자', '옵시디언 혼 비니', '배경']);
  // 한벌옷을 입으면 상의·하의 칸은 "한벌옷이 덮고 있어요" — 모자와 머리 장식은 함께 보인다(가리지 않는다)
  const covered = loadoutSlots(c, 's1', { outfit: 'outfit_01', hat: 'hat_16', head: 'accessory_17' });
  assert.deepEqual(covered.filter((w) => w.covered).map((w) => [w.slot, w.covered]), [['top', '한벌옷이 덮고 있어요'], ['bottom', '한벌옷이 덮고 있어요']]);
  // 입은 옷 칸의 채팅 번호(캐릭터 페이지가 "!옷장 상의 11" 로 복사): 시즌 목록의 번호 그대로
  assert.deepEqual(covered.filter((w) => w.id).map((w) => itemCodeOf(c, 's1', w.id)), ['한벌1', '모자16', '악세17']);
});

const PERKS = ['채팅으로 받는 냥 한도 1.5배', '받는 냥 +10%', '이벤트 보상 2배 (5% 확률)'];
const TITLE_NAMES = ['할로윈 인싸', '여장남자', '남장여자', '사탕내놧', '키우기장인'];

test('옷 도감 묶음(새 그림체 R7): 한벌옷·상의·하의·신발·모자·악세사리(20씩)·배경(10) 차례로, 번호(한벌1·상의3·모자5·악세11)·값(묶음마다 하나 — 레벨 조건 없음)·느낌·악세사리 자리·입은 사람 수, 시즌 칭호는 따로', async () => {
  const c = await catalog();
  const { groups, rewards, titles, rule } = itemGroups(c, 's1', new Map([['outfit_02', 4], ['hat_05', 7], ['acc2_12', 9]]));
  assert.deepEqual(groups.map((g) => [g.name, g.code, g.items.length]), [['한벌옷', '한벌', 20], ['상의', '상의', 20], ['하의', '하의', 20], ['신발', '신발', 20], ['모자', '모자', 20], ['악세사리', '악세', 20], ['배경', '배경', 10]]);
  // 묶음 제목 옆 "각 N냥"(묶음 안 값이 모두 같다)
  assert.deepEqual(groups.map((g) => [g.price, groupPrice(g)]), [[2500, 2500], [700, 700], [700, 700], [700, 700], [500, 500], [400, 400], [500, 500]]);
  assert.equal(groupPrice({ items: [{ price: 300 }, { price: 500 }] }), 0, '값이 다르면 0'); assert.equal(groupPrice({ items: [] }), 0);
  assert.deepEqual(groups[6].items.find((x) => x.id === 'background_08'), { id: 'background_08', name: '네온 유령 세탁소', price: 500, count: 0, code: '배경8' });
  assert.deepEqual(groups[0].items.find((x) => x.id === 'outfit_02'), { id: 'outfit_02', name: '모노 워크 점프수트', price: 2500, style: '데일리', count: 4, code: '한벌2' });
  assert.deepEqual(groups[2].items.find((x) => x.id === 'bottom_05'), { id: 'bottom_05', name: '샌드 핀턱 치노', price: 700, style: '데일리', count: 0, code: '하의5' });
  assert.deepEqual(groups[4].items.find((x) => x.id === 'hat_05'), { id: 'hat_05', name: '블랙 시티 페도라', price: 500, style: '데일리', count: 7, code: '모자5' });
  assert.deepEqual(groups[5].items.find((x) => x.id === 'accessory_02'), { id: 'accessory_02', name: '블랙 슬림 스퀘어 안경', price: 400, style: '데일리', count: 0, code: '악세2', place: '얼굴 장식' });
  for (const g of groups) for (const it of g.items) { assert.equal(it.level, undefined, it.id + ' 레벨 조건 없음'); assert.equal(it.tierName, undefined, it.id); }
  // 악세사리: 먼치킨 채팅 상점과 같은 번호(악세1~20), 자리 이름(머리·얼굴·목·손 장식) — 예전 그림의 왕관·날개·오라 자리는 없다
  const acc = groups[5].items;
  assert.deepEqual(acc.map((x) => x.code), Array.from({ length: 20 }, (_, i) => `악세${i + 1}`), '번호 차례 그대로');
  assert.deepEqual([...new Set(acc.map((x) => x.place))].sort(), ['머리 장식', '목 장식', '손 장식', '얼굴 장식']);
  assert.deepEqual(acc.find((x) => x.id === 'accessory_17'), { id: 'accessory_17', name: '문라이트 크리스털 이어링', price: 400, style: '할로윈', count: 0, code: '악세17', place: '머리 장식' });
  assert.ok(!groups.some((g) => g.items.some((x) => x.id === 'acc2_12')), '예전 그림의 옷은 입은 사람 수가 있어도 도감에 없다');
  // 모든 옷 번호 = itemCodeOf(캐릭터 페이지가 쓰는 것)와 같은 글, 겹치지 않는다
  const codes = groups.flatMap((g) => g.items.map((x) => [x.id, x.code]));
  for (const [id, code] of codes) assert.equal(itemCodeOf(c, 's1', id), code, id);
  assert.equal(new Set(codes.map((x) => x[1])).size, codes.length);
  assert.deepEqual(['outfit', 'top', 'bottom', 'shoes', 'hat', 'acc', 'bg'].map(unit), ['벌', '벌', '벌', '켤레', '개', '개', '장']);
  // 시즌 칭호 5개: 채팅 번호 칭호1~5(시즌 목록 차례), 효과 3줄, "시즌2까지", 3,000냥
  assert.deepEqual(rewards, [], '이 시즌에는 입는 시즌 보상이 없다');
  assert.deepEqual(titles.map((t) => [t.code, t.name]), TITLE_NAMES.map((n, i) => [`칭호${i + 1}`, n]));
  for (const t of titles) {
    assert.deepEqual(t.perks, PERKS, t.id); assert.equal(t.until, '시즌2까지'); assert.equal(t.price, 3000); assert.equal(t.minAttendance, 0);
    assert.equal(t.image, `titles/${t.id}.png`); assert.equal(titleImageUrl(t, B), `/jun-live-fanpage/kiugi/titles/${t.id}.png`);
  }
  assert.equal(TITLE_WORD, '칭호');
  assert.match(TITLE_NOTE(rule), /다음 시즌까지 효과/); assert.doesNotMatch(TITLE_NOTE(rule), /출석/, '출석 조건 없음');
  assert.match(TITLE_NOTE({ minLevel: 10, minAttendance: 5 }), /^Lv\.10 · 이번 시즌 출석 5번부터 살 수 있어요/);
  // 2026-10-09 먼치킨 0.15.66: 채팅 사기·입기는 어느 방송에서나 "!옷장 상의 11"(DJ 캐릭터 이름이 필요 없다)
  assert.equal(chatHint('상의11'), '!옷장 상의 11'); assert.equal(chatHint('칭호1'), '!옷장 칭호 1'); assert.equal(chatHint('악세12'), '!옷장 악세 12'); assert.equal(chatHint('모자5'), '!옷장 모자 5');
  // 예전 모양 시즌 보상(입는 옷)의 안내 글은 그대로
  assert.match(REWARD_NOTE({ minLevel: 10, minAttendance: 20 }), /^Lv\.10 · 출석 20번부터 살 수 있고/); assert.match(REWARD_NOTE({ minLevel: 10 }), /사면 캐릭터가 바로 입어요/); assert.doesNotMatch(REWARD_NOTE({ minLevel: 10 }), /배지/);
  assert.equal(wearLine(0), '아직 입은 사람이 없어요'); assert.equal(wearLine(1200), '1,200명이 입고 있어요');
  assert.deepEqual(itemGroups(c, 's9'), { groups: [], rewards: [], titles: [] });
});

// 지어낸 시즌 목록 두 개(s1 = 칭호 · 효과 줄 모양 여러 가지, s2 = 칸이 있는 예전 모양 보상 + 칭호 하나)
const RAW_S1 = {
  season: { id: 's1', name: '할로윈', endsAt: '2026-11-30T23:59:59+09:00' },
  categories: [{ id: 'acc', name: '악세사리', code: '악세', price: 300 }],
  slots: [{ id: 'head', name: '머리 장식', cat: 'acc' }],
  items: [{ id: 'acc2_01', cat: 'acc', slot: 'head', number: 1, name: '고양이 머리띠' }],
  seasonRewards: [
    { id: 'title-a', name: '첫 칭호', price: 3000, image: 'titles/title-a.png' },
    { id: 'title-b', name: '둘째 칭호', price: 1000, image: '../secret.png', perk: '받는 냥 +10% · 채팅 냥 한도 1.5배' },
    { id: 'title-c', price: 2000, image: 'https://x.example/a.png', perks: [' 하나 ', '', '둘'] },
    { name: 'id 없는 것' },
  ],
  seasonRewardRule: { lasts: 2, perks: PERKS },
};
const RAW_S2 = {
  season: { id: 's2', name: '겨울', endsAt: '2026-12-31T23:59:59+09:00' },
  slots: [{ id: 'crown', name: '왕관' }],
  seasonRewards: [{ id: 'snow-crown', slot: 'crown', name: '눈꽃 왕관', price: 15000 }, { id: 'title-snow', name: '눈사람' }],
  seasonRewardRule: { minLevel: 10, minAttendance: 20 },
};

test('시즌 칭호 목록(buildCatalog titles): 칸 없는 시즌 보상 = 칭호(번호 = 시즌 목록 차례), 효과 줄은 perks·perk·규칙 차례로, 그림은 titles/ 아래 이름만, 칸 있는 예전 보상은 옷', () => {
  const c = buildCatalog([RAW_S1, RAW_S2]);
  assert.deepEqual(Object.keys(c.titles), ['title-a', 'title-b', 'title-c', 'title-snow']);
  const { level: _l, ...a } = c.titles['title-a'];
  assert.deepEqual(a, { id: 'title-a', season: 's1', number: 1, name: '첫 칭호', image: 'titles/title-a.png', perks: PERKS, desc: '', price: 3000, minAttendance: 0 }, '효과 줄이 없으면 규칙의 perks');
  assert.deepEqual(c.titles['title-b'].perks, ['받는 냥 +10%', '채팅 냥 한도 1.5배'], 'perk 글은 " · " 로 나눈다');
  assert.equal(c.titles['title-b'].image, '', '"../" 같은 경로는 쓰지 않는다'); assert.equal(c.titles['title-c'].image, '', '바깥 주소도 쓰지 않는다');
  assert.deepEqual(c.titles['title-c'].perks, ['하나', '둘'], 'perks 줄은 앞뒤 공백·빈 줄 정리');
  assert.equal(c.titles['title-c'].name, 'title-c', '이름이 없으면 id');
  assert.equal(c.titles['title-c'].number, 3);
  // 칸이 있는 예전 모양 보상은 칭호가 아니라 입는 옷(reward) — 값·레벨은 보상 규칙대로
  assert.deepEqual(c.items['snow-crown'], { slot: 'crown', season: 's2', name: '눈꽃 왕관', reward: true, price: 15000, level: 10 });
  assert.equal(c.titles['snow-crown'], undefined);
  assert.deepEqual([c.titles['title-snow'].number, c.titles['title-snow'].minAttendance, c.titles['title-snow'].perks], [2, 20, []]);
  assert.deepEqual([c.seasons.s1.rewardRule.lasts, c.seasons.s2.rewardRule.lasts], [2, 2], 'lasts 가 없으면 2(얻은 시즌 + 다음 시즌)');
  const g2 = itemGroups(c, 's2');
  assert.deepEqual([g2.rewards.map((r) => r.id), g2.titles.map((t) => [t.code, t.until])], [['snow-crown'], [['칭호2', '시즌3까지']]]);
  assert.deepEqual(itemGroups(c, 's1').titles.map((t) => t.code), ['칭호1', '칭호2', '칭호3']);
  assert.deepEqual(buildCatalog([]).titles, {});
});

test('칭호 도구: titleUntil("시즌N까지")·titleList(단 칭호 → 이름·그림·효과·번호)·titleImageUrl, 옷 번호 itemCodeOf(먼치킨 채팅 상점과 같은 글)', async () => {
  const two = buildCatalog([RAW_S1, RAW_S2]);
  assert.equal(titleUntil(two, 's1'), '시즌2까지', '시즌 1에 얻으면 시즌 2까지');
  assert.equal(titleUntil(two, 's2'), '시즌3까지');
  assert.equal(titleUntil(two, 's1', 1), '시즌1까지'); assert.equal(titleUntil(two, 's2', 3), '시즌4까지');
  assert.equal(titleUntil(two, 's1', 0), '시즌1까지', '적어도 얻은 시즌');
  assert.equal(titleUntil(two, 'nope'), '시즌2까지', '모르는 시즌은 첫 시즌처럼');
  const c = await catalog();
  // 서버가 보낸 칭호 id 차례 그대로, 모르는 id 는 뺀다
  assert.deepEqual(titleList(c, ['title-candy-plz', 'title-nope', 'title-halloween-insa']), [
    { id: 'title-candy-plz', name: '사탕내놧', image: 'titles/title-candy-plz.png', perks: PERKS, until: '시즌2까지', code: '칭호4' },
    { id: 'title-halloween-insa', name: '할로윈 인싸', image: 'titles/title-halloween-insa.png', perks: PERKS, until: '시즌2까지', code: '칭호1' },
  ]);
  for (const bad of [undefined, null, 'title-candy-plz', {}, [], ['acc2_11']]) assert.deepEqual(titleList(c, bad), [], JSON.stringify(bad));
  assert.deepEqual(titleList(two, ['title-snow']).map((t) => [t.code, t.until]), [['칭호2', '시즌3까지']]);
  assert.equal(titleImageUrl({ image: 'titles/a.png' }), '/kiugi/titles/a.png');
  assert.equal(titleImageUrl({ image: 'titles/a.png' }, '/jun-live-fanpage'), '/jun-live-fanpage/kiugi/titles/a.png');
  assert.equal(titleImageUrl({ image: 'titles/a.png' }, B), '/jun-live-fanpage/kiugi/titles/a.png');
  assert.equal(titleImageUrl({ image: '' }), ''); assert.equal(titleImageUrl(null), '');
  // 옷 번호: 묶음 줄임말 + 디자인 번호(두 자리 번호도 그대로)
  for (const [id, code] of [['outfit_05', '한벌5'], ['top_11', '상의11'], ['bottom_20', '하의20'], ['shoe_10', '신발10'], ['hat_16', '모자16'], ['accessory_03', '악세3'], ['accessory_20', '악세20'], ['background_04', '배경4']]) assert.equal(itemCodeOf(c, 's1', id), code, id);
  for (const id of ['title-halloween-insa', 'witch-hat', 'outfit_21', 'shoe2_10', 'acc2_11', 'pumpkin-crown', '', undefined]) assert.equal(itemCodeOf(c, 's1', id), null, String(id));
  assert.equal(itemCodeOf(c, 's9', 'top_11'), '상의11', '옷이 나온 시즌의 묶음으로');
  assert.equal(itemCodeOf(two, 's2', 'snow-crown'), null, '번호 없는 예전 보상');
  assert.equal(itemCodeOf(buildCatalog([]), 's1', 'top_11'), null);
});

test('시즌 칭호 상점은 Lv.10부터(먼치킨 rules.mjs titleShop.minLevel · 첫 화면 "Lv.10이 되면 시즌 칭호를 살 수 있어요"와 같게)', async () => {
  const c = await catalog();
  const { titles, rule } = itemGroups(c, 's1');
  assert.deepEqual(titles.map((t) => t.level), [10, 10, 10, 10, 10]);
  assert.match(TITLE_NOTE(rule), /^Lv\.10부터 살 수 있어요/);
});

test('먼치킨을 아직 업데이트하지 않은 방송이 올린 예전 그림의 옷(V5 shoe2_·acc2_·상의 21~30 · 예전 시즌 보상 pumpkin-crown 등)은 입은 옷 칸·번호·그림에 나오지 않는다', async () => {
  const { loadoutSlots } = await import('../docs/views/character.js');
  const c = await catalog();
  const worn = { top: 'top_11', bottom: 'bottom_25', shoes: 'shoe2_04', head: 'acc2_01', crown: 'pumpkin-crown', wings: 'acc2_12', aura: 'moonlight-aura', hat: 'hat_03' };
  assert.deepEqual(wornList(c, 's1', worn).map((w) => [w.slot, w.id]), [['top', 'top_11'], ['hat', 'hat_03']], 'R7 목록에 있는 옷만');
  for (const id of ['pumpkin-crown', 'acc2_01', 'shoe2_04', 'bottom_25']) assert.equal(itemCodeOf(c, 's1', id), null, id);
  const slots = loadoutSlots(c, 's1', worn);
  assert.deepEqual(slots.map((s) => s.slot), ['outfit', 'top', 'bottom', 'shoes', 'hat', 'head', 'face', 'neck', 'hand', 'bg'], '예전 칸(왕관·날개·오라)은 칸으로도 나오지 않는다');
  assert.ok(!slots.some((s) => s.covered), '가리는 칸 없음');
  const svg = characterMarkup(c, { gender: 'f' }, worn, 1, { base: B });
  assert.doesNotMatch(svg, /acc2_|shoe2_|reward_|bottom_25|pumpkin/, '그림도 그리지 않는다');
  assert.match(svg, /top_11_female\.png/); assert.match(svg, /hat_03_female\.png/);
});

test('화면 글: 첫 화면 4단계(칭호 달기), 옷 도감·캐릭터 페이지의 번호 복사 단추, 키우기 페이지 안내', async () => {
  const src = (p) => readFile(new URL('../docs/' + p, import.meta.url), 'utf8');
  const intro = await src('views/intro.js');
  assert.match(intro, /h\('ol', \{ class: 'kg-steps four' \}/);
  const steps = [...intro.matchAll(/step\('(\d)', '([^']+)'/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(steps, [['1', '아이디 만들기'], ['2', '냥 모으기'], ['3', '옷 입히기'], ['4', '칭호 달기']]);
  assert.match(intro, /'!옷장 상의11 하의3 모자5'\)/); assert.match(intro, /'!옷장 칭호 1'\)/); assert.match(intro, /입혀 보기/); assert.doesNotMatch(intro, /!옷장 상의2|한 쪽씩|몇 벌씩/, '없앤 옷장 목록 명령(2026-10-11) 안내 없음'); assert.match(intro, /Lv\.10이 되면 시즌 칭호를 살 수 있어요/); assert.doesNotMatch(intro, /상점 칭호|!먼치 상의/, '예전 명령 안내 없음');
  const css = await src('styles.css');
  for (const cls of ['kg-steps.four', 'kg-item-code.accent', 'kg-worn-code', 'kg-char-title', 'kg-char-title-img', 'kg-title-list', 'kg-title-media', 'kg-title-img', 'kg-title-word', 'kg-title-effects', 'kg-title-until']) assert.match(css, new RegExp(`\\.${cls.replace('.', '\\.')}[\\s{.:,\\[]`), cls);
  const items = await src('views/items.js');
  assert.match(items, /codeButton\(it\.code\)/, '옷 번호는 누르면 복사되는 단추'); assert.match(items, /codeButton\(t\.code, \{ accent: true \}\)/, '칭호 번호도');
  assert.match(items, /'시즌 칭호'/);
  const character = await src('views/character.js');
  assert.match(character, /itemCodeOf\(catalog, seasonId, w\.id\)/); assert.match(character, /copyCode\(code\)/, '"!옷장 상의 11" 로 복사'); assert.match(character, /import \{ copyCode, chatHint, titleEffects(, \w+)* \} from '\.\/items\.js'/);
  assert.match(character, /titleList\(catalog, data\.titles\)/); assert.match(character, /titles\.slice\(0, 1\)/, '단 칭호 하나');
  assert.match(await src('views/kiugi.js'), /시즌 칭호는 얻은 시즌과 다음 시즌까지 효과가 있어요/);
});

test('펫 그림(2026-10-15 Codex DJ_PET_S1_20261015_HALLOWEEN): 시즌 펫 5종 × 5단계 그림이 pets/<시즌>/ 에 있고, 함께하는 펫·펫 칸이 그 그림을 쓴다(못 만난 펫은 1단계 그림 실루엣)', async () => {
  const cat = await catalog();
  const { petList, petImageUrl } = await import('../docs/views/character.js');
  const pets = Object.values(cat.pets);
  assert.equal(pets.length, 5);
  for (const p of pets) for (let s = 1; s <= 5; s++) {
    const url = petImageUrl({ ...p, stage: s }, s, B);
    assert.equal(url, `${B}pets/s1/pet_${p.id}_${s}.png`);
    const png = await readFile(new URL(`../docs/pets/s1/pet_${p.id}_${s}.png`, import.meta.url));
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20), png[25]], [512, 512, 6], '512×512 RGBA');
  }
  const list = petList(cat, { pets: { ghost: 3, bat: 1 }, pet: { id: 'ghost', stage: 3 } });
  const ghost = list.find((p) => p.id === 'ghost'), cat2 = list.find((p) => p.id === 'blackcat');
  assert.deepEqual([ghost.stage, ghost.active, ghost.season], [3, true, 's1']);
  assert.equal(petImageUrl(ghost, ghost.stage, B), `${B}pets/s1/pet_ghost_3.png`);
  assert.equal(cat2.stage, 0);
  assert.equal(petImageUrl(cat2, cat2.stage, B), `${B}pets/s1/pet_blackcat_1.png`, '못 만난 펫은 1단계 그림(실루엣)');
  const css = await readFile(new URL('../docs/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.kg-pet\.is-unmet \.kg-pet-img \{ filter: brightness\(0\) invert\(1\);/);
  // 2026-10-16 사용자 "펫 좀 크게"(40% → 58%) → "지금보다 2배로": ★1 은 칸 116%(정확히 2배), 위 단계는 덜 자라게(캐릭터를 다 가리지 않게)
  assert.match(css, /\.kg-pet-buddy \{ --ps: 1; --pw: 116%; --pm: \.30; --pe: 2%; position: absolute; right: calc\(var\(--pe\) - var\(--pw\) \* var\(--ps\) \* var\(--pm\)\);/);
  for (const [st, pw] of [[2, 100], [3, 89], [4, 81], [5, 75]]) assert.match(css, new RegExp(`\\.kg-pet-buddy\\.st${st} \\{ --pw: ${pw}%;`), '★' + st);
  assert.match(css, /\.kg-hero-stage \{ position: relative; overflow: hidden;/, '무대보다 큰 칸은 무대 모서리로 자른다(휴대폰 옆 스크롤 없게)');
  const cardsSrc = await readFile(new URL('../docs/views/cards.js', import.meta.url), 'utf8');
  assert.match(cardsSrc, /'kg-pet-buddy st' \+ Math\.min\(5, Math\.max\(1, pet\.stage \|\| 1\)\)/, '단계 클래스');
});

test('함께하는 펫이 메인 화면에도 보인다(2026-10-16 사용자 "캐릭터 클릭했을 때 말고 메인 화면에서도"): 카드·첫 화면 1~3등 무대에 그림만(이름표 없이)', async () => {
  const cat = await catalog();
  const { buddyOf } = await import('../docs/views/cards.js');
  assert.deepEqual(buddyOf(cat, { id: 'ghost', stage: 3 }), { id: 'ghost', season: 's1', emoji: cat.pets.ghost.emoji, name: cat.pets.ghost.names[2], stage: 3 });
  for (const bad of [null, undefined, {}, { id: 'ghost' }, { id: 'ghost', stage: 0 }, { id: 'ghost', stage: 6 }, { id: 'ghost', stage: '3' }, { id: 'nope', stage: 1 }, { id: 'constructor', stage: 1 }, { id: '__proto__', stage: 1 }]) {
    assert.equal(buddyOf(cat, bad), null, JSON.stringify(bad) + ' 는 그리지 않음');
  }
  const src = (p) => readFile(new URL('../docs/' + p, import.meta.url), 'utf8');
  const cards = await src('views/cards.js'), intro = await src('views/intro.js');
  assert.match(cards, /const pet = character \? buddyOf\(catalog, c\.pet\) : null;/, '카드: 함께하는 펫(c.pet)');
  assert.match(cards, /pet \? petBuddy\(pet, app\.base, \{ label: false, eager \}\) : null/);
  assert.match(intro, /buddyOf\(ctx\.catalog, x\.c\.pet\)/, '첫 화면 1~3등 무대');
  assert.match(intro, /petBuddy\(pet, ctx\.app\.base, \{ label: false \}\)/);
  const css = await readFile(new URL('../docs/styles.css', import.meta.url), 'utf8');
  for (const rule of ['.kg-card-media .kg-pet-buddy {', '.kg-cast-one .kg-pet-buddy {', '.kg-cast-one.left .kg-pet-buddy {', '.kg-pet-buddy.bare .kg-pet-img {']) assert.ok(css.includes(rule), rule);
  // 체험 서버도 실제 서버(lib.ts)처럼: 카드는 pet 만, 1~3등은 pets·pet
  const mock = await src('mock.js');
  assert.match(mock, /const card = \(p, page\) => \(\{[^\n]*\.\.\.\(p\.pet \? \{ pet: p\.pet \} : \{\}\)/);
  assert.doesNotMatch(mock.match(/const card = [^\n]*/)[0], /pets:/, '카드에는 만난 펫 목록을 넣지 않는다');
  assert.match(mock, /const pub = \(p, rank, slug\) => \(\{[^\n]*\.\.\.\(p\.pets \? \{ pets: p\.pets \} : \{\}\), \.\.\.\(p\.pet \? \{ pet: p\.pet \} : \{\}\)/);
});
