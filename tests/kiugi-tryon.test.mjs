// 캐릭터 페이지 "입혀 보기"(lib/try-on.js): 미리 보기 모습·누르기·채팅 한 줄("!옷장 상의11 하의3 신발2")·합계 — 먼치킨 !옷장 규칙과 같게.
// 시즌 목록은 사이트에 복사된 진짜 목록(docs/kiugi/season-s1.json). 아이디·이름은 쓰지 않는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCatalog, itemCodeOf } from '../docs/lib/kiugi-draw.js';
import { applyTryOn, toggleTry, canTry, isShown, itemShown, wornLook, wornIds, tryCodes, closetLine, tryTotal, tryNotes, slotOfItem, CLOSET_CMD, TRY_MAX, TRY_NOTE, TRY_FULL, TRY_COPIED, CROWN_NOTE } from '../docs/lib/try-on.js';
import { chatHint, itemGroups, CLOSET_CMD as ITEMS_CMD } from '../docs/views/items.js';

const read = async (p) => JSON.parse(await readFile(new URL('../docs/kiugi/' + p, import.meta.url), 'utf8'));
const catalog = async () => {
  const manifest = await read('manifest.json');
  return buildCatalog(await Promise.all(manifest.seasons.map(read)), { files: manifest.files, adjust: {} });
};
// 여러 번 누르기
const press = (c, ids, worn = null, start = []) => ids.reduce((t, id) => toggleTry(t, id, c, { worn }), start);

test('채팅 한 줄(closetLine): "!옷장" + 띄어쓰기 하나로 나눈 번호, 번호 안에는 띄어쓰기 없음, 한 번에 8개까지', () => {
  assert.equal(CLOSET_CMD, '!옷장'); assert.equal(ITEMS_CMD, CLOSET_CMD, '옷 도감의 번호 복사도 같은 명령');
  assert.equal(TRY_MAX, 8);
  assert.equal(closetLine(['상의11', '하의3', '신발2']), '!옷장 상의11 하의3 신발2');
  assert.equal(closetLine(['한벌2']), '!옷장 한벌2');
  assert.equal(closetLine([]), ''); assert.equal(closetLine(null), '');
  assert.equal(closetLine(['상의 11', ' 악세12 ']), '!옷장 상의11 악세12', '번호 안 띄어쓰기는 붙인다');
  assert.equal(closetLine(['<script>', '', null, '상의', '11', 'top11', '배경4']), '!옷장 배경4', '번호 모양이 아닌 것은 뺀다');
  const ten = Array.from({ length: 10 }, (_, i) => `상의${i + 1}`);
  assert.equal(closetLine(ten), `!옷장 ${ten.slice(0, 8).join(' ')}`);
  assert.equal(closetLine(ten).split(' ').length, 9, '명령 + 번호 8개');
  // 한 벌만 고를 때의 옷 도감 복사 글(chatHint)은 그대로
  assert.equal(chatHint('상의11'), '!옷장 상의 11');
});

test('모든 옷 번호가 채팅 한 줄 모양(묶음 글 + 숫자, 띄어쓰기 없음) — itemCodeOf 와 같은 글', async () => {
  const c = await catalog();
  const { groups } = itemGroups(c, 's1');
  const ids = groups.flatMap((g) => g.items.map((it) => it.id));
  assert.equal(ids.length, 78);
  for (const id of ids) {
    const code = itemCodeOf(c, 's1', id);
    assert.match(code, /^(한벌|상의|하의|신발|악세|배경)\d{1,2}$/, id);
    assert.equal(closetLine([code]), `!옷장 ${code}`, id);
  }
  assert.deepEqual(tryCodes(['top_11', 'bottom_03', 'shoe2_02', 'no-such', 'title-halloween-insa'], c, 's1'), ['상의11', '하의3', '신발2'], '번호 없는 것(모르는 옷·칭호)은 뺀다');
});

test('미리 보기 모습(applyTryOn): 입은 옷 위에 차례대로 — 상의·하의를 입으면 한벌옷을 벗고, 한벌옷은 상의·하의를 가리고, 왕관은 머리 장식을 가린다', async () => {
  const c = await catalog();
  const worn = { outfit: 'outfit_01', top: 'top_02', bottom: 'bottom_01', shoes: 'shoe2_06' };
  // 먼치킨은 한벌옷 아래 상의·하의도 올린다(기록에 남은 것) → 상의를 입히면 한벌옷을 벗고 입던 하의가 다시 보인다
  const a = applyTryOn(worn, ['top_11'], c);
  assert.deepEqual(a, { top: 'top_11', bottom: 'bottom_01', shoes: 'shoe2_06' });
  assert.deepEqual(worn, { outfit: 'outfit_01', top: 'top_02', bottom: 'bottom_01', shoes: 'shoe2_06' }, '입은 옷은 바꾸지 않는다');
  // 한벌옷을 입히면 상의·하의는 남아 있지만 보이지 않는다
  const b = applyTryOn({ top: 'top_02', bottom: 'bottom_01' }, ['outfit_03'], c);
  assert.deepEqual(b, { top: 'top_02', bottom: 'bottom_01', outfit: 'outfit_03' });
  assert.equal(isShown(b, 'top', c), false); assert.equal(isShown(b, 'bottom', c), false); assert.equal(isShown(b, 'outfit', c), true);
  // 왕관(악세11)은 머리 장식만 가린다(얼굴·목·손은 그대로)
  const k = applyTryOn({ crown: 'acc2_11', face: 'acc2_04' }, ['acc2_01'], c);
  assert.equal(isShown(k, 'head', c), false); assert.equal(isShown(k, 'face', c), true); assert.equal(isShown(k, 'crown', c), true);
  assert.equal(itemShown(k, 'acc2_01', c), false); assert.equal(itemShown(k, 'acc2_04', c), true);
  // 악세사리는 자리마다 하나 — 같은 자리 옷은 바뀌고 다른 자리는 함께
  assert.deepEqual(applyTryOn({ head: 'acc2_01', neck: 'acc2_06' }, ['acc2_02', 'acc2_04', 'acc2_12', 'acc2_13', 'background_04'], c),
    { head: 'acc2_02', neck: 'acc2_06', face: 'acc2_04', wings: 'acc2_12', aura: 'acc2_13', bg: 'background_04' });
  // 예전 보상 id(0.15.62 이하가 올린 것)는 악세11~13 으로, 모르는 옷 id 는 그대로 둔다(그림이 뺀다), 모르는 입혀 본 옷은 무시
  assert.deepEqual(applyTryOn({ crown: 'pumpkin-crown', head: 'witch-hat' }, ['no-such', 'title-candy-plz'], c), { crown: 'acc2_11', head: 'witch-hat' });
  assert.deepEqual(wornLook(null), {}); assert.deepEqual(wornLook(['top_01']), {}); assert.deepEqual([...wornIds({ wings: 'shadow-wings' })], ['acc2_12']);
  assert.equal(slotOfItem(c, 'acc2_09'), 'hand'); assert.equal(slotOfItem(c, 'moonlight-aura'), 'aura'); assert.equal(slotOfItem(c, 'title-candy-plz'), null);
});

test('먼치킨 !옷장 과 같은 결과: 한 줄의 번호를 차례대로 입히면(putOn) 미리 보기 모습과 같다', async () => {
  const c = await catalog();
  // 먼치킨 kiugi.mjs putOn 과 같은 규칙(칸에 넣고, 상의·하의면 한벌옷을 벗긴다)
  const putOn = (w, slot, id) => { const o = { ...w, [slot]: id }; if (slot === 'top' || slot === 'bottom') delete o.outfit; return o; };
  const cases = [
    [{ outfit: 'outfit_02', top: 'top_01' }, ['bottom_05', 'shoe2_03', 'acc2_11']],
    [{ top: 'top_01', bottom: 'bottom_02', head: 'acc2_03' }, ['outfit_04', 'acc2_05', 'background_02']],
    [{}, ['top_20', 'bottom_20', 'shoe2_10', 'acc2_01', 'acc2_04', 'acc2_06', 'acc2_09', 'background_10']],
  ];
  for (const [worn, clicks] of cases) {
    const tried = press(c, clicks, worn);
    const byBot = tried.reduce((w, id) => putOn(w, c.items[id].slot, id), { ...worn });
    assert.deepEqual(applyTryOn(worn, tried, c), byBot, clicks.join(' '));
  }
});

test('옷 누르기(toggleTry): 입혀 보기·다시 누르면 벗기, 칸마다 한 벌, 한벌옷 ↔ 상의·하의, 누른 차례 = 채팅 차례', async () => {
  const c = await catalog();
  assert.deepEqual(press(c, ['top_11', 'bottom_03', 'shoe2_02']), ['top_11', 'bottom_03', 'shoe2_02']);
  assert.deepEqual(press(c, ['top_11', 'bottom_03', 'top_11']), ['bottom_03'], '다시 누르면 뺀다');
  assert.deepEqual(press(c, ['top_11', 'top_05']), ['top_05'], '같은 칸은 바꾼다');
  assert.deepEqual(press(c, ['top_11', 'bottom_03', 'shoe2_02', 'outfit_02']), ['shoe2_02', 'outfit_02'], '한벌옷을 입히면 입혀 본 상의·하의를 뺀다');
  assert.deepEqual(press(c, ['outfit_02', 'shoe2_02', 'bottom_07']), ['shoe2_02', 'bottom_07'], '상의·하의를 입히면 입혀 본 한벌옷을 뺀다');
  assert.deepEqual(press(c, ['acc2_01', 'acc2_02', 'acc2_04', 'acc2_11']), ['acc2_02', 'acc2_04', 'acc2_11'], '악세사리는 자리(머리·얼굴·왕관)마다 하나');
  assert.deepEqual(press(c, ['background_01', 'background_09']), ['background_09'], '배경은 하나');
  assert.deepEqual(press(c, ['no-such', 'title-candy-plz']), [], '모르는 옷·칭호는 입혀 볼 수 없다');
  assert.deepEqual(toggleTry(['top_11'], { id: 'top_11' }, c), [], '옷 객체({id})도 받는다');
  assert.equal(closetLine(tryCodes(press(c, ['top_11', 'bottom_03', 'shoe2_02']), c, 's1')), '!옷장 상의11 하의3 신발2');
});

test('한 번에 8벌까지: 9벌째는 더하지 않고(canTry false), 같은 칸 바꾸기·빼기는 된다', async () => {
  const c = await catalog();
  const eight = ['top_01', 'bottom_01', 'shoe2_01', 'acc2_01', 'acc2_04', 'acc2_06', 'acc2_09', 'background_01'];
  const full = press(c, eight);
  assert.equal(full.length, 8);
  assert.equal(canTry(full, 'acc2_12', c), false);
  assert.deepEqual(toggleTry(full, 'acc2_12', c), full, '9벌째는 그대로');
  assert.equal(canTry(full, 'top_02', c), true); assert.deepEqual(toggleTry(full, 'top_02', c), [...eight.slice(1), 'top_02'], '같은 칸은 바꾼다(뒤로 간다)');
  assert.equal(canTry(full, 'outfit_01', c), true, '한벌옷은 상의·하의 둘을 빼고 들어간다');
  assert.equal(toggleTry(full, 'outfit_01', c).length, 7);
  assert.equal(canTry(full, 'top_01', c), true); assert.equal(toggleTry(full, 'top_01', c).length, 7, '빼기는 늘 된다');
  assert.equal(closetLine(tryCodes(full, c, 's1')).split(' ').length, 9);
  assert.match(TRY_FULL, /한 번에 8벌까지/);
});

test('지금 입은 옷: 누르면 원래 옷으로 되돌린다(명령 없음), 입은 한벌옷 아래 상의·하의는 다시 입기로 더한다, 값은 세지 않는다', async () => {
  const c = await catalog();
  const worn = { outfit: 'outfit_01', top: 'top_02', bottom: 'bottom_01', head: 'acc2_03' };
  // 상의를 입혀 본 뒤 입은 한벌옷을 누르면 → 입혀 본 상의를 빼서 원래대로
  assert.deepEqual(toggleTry(['top_11', 'shoe2_02'], 'outfit_01', c, { worn }), ['shoe2_02']);
  // 왕관을 입혀 본 뒤 입은 머리 장식을 누르면 → 왕관을 뺀다(머리 장식이 다시 보인다)
  assert.deepEqual(toggleTry(['acc2_11'], 'acc2_03', c, { worn }), []);
  // 한벌옷 아래의 입은 상의를 누르면 → 다시 입는 줄로 더한다(먼치킨: 가진 옷이라 냥 없이 입히고 한벌옷을 벗긴다)
  const back = toggleTry([], 'top_02', c, { worn });
  assert.deepEqual(back, ['top_02']);
  assert.equal(itemShown(applyTryOn(worn, back, c), 'top_02', c), true);
  assert.equal(closetLine(tryCodes(back, c, 's1')), '!옷장 상의2');
  assert.deepEqual(tryTotal(back, c, { worn }), { count: 1, price: 0 }, '입은 옷은 값을 세지 않는다');
  // 입은 왕관 아래 머리 장식은 다시 입어도 가려진다 → 더하지 않는다
  assert.deepEqual(toggleTry([], 'acc2_03', c, { worn: { crown: 'acc2_11', head: 'acc2_03' } }), []);
});

test('합계(tryTotal)·알림(tryNotes)·안내 글', async () => {
  const c = await catalog();
  // 2026-10-10 먼치킨 값 통일(묶음마다 값 하나, 옷에는 레벨 조건 없음): 상의11 500 + 하의5 500 + 악세11 300 + 한벌2 2,000 + 배경3 400
  assert.deepEqual(tryTotal(['top_11', 'bottom_05', 'acc2_11'], c), { count: 3, price: 1300 });
  assert.deepEqual(tryTotal(['outfit_02', 'background_03'], c), { count: 2, price: 2400 });
  assert.deepEqual(tryTotal([], c), { count: 0, price: 0 });
  assert.deepEqual(tryTotal(['top_11', 'no-such'], c, { worn: { top: 'top_11' } }), { count: 1, price: 0 });
  // 왕관과 머리 장식을 함께 고르면(또는 왕관을 쓴 채 머리 장식을) → 왕관이 머리 장식을 가린다는 알림
  assert.deepEqual(tryNotes({}, ['acc2_11', 'acc2_01'], c), [CROWN_NOTE]);
  assert.deepEqual(tryNotes({ crown: 'acc2_11' }, ['acc2_02'], c), [CROWN_NOTE]);
  assert.deepEqual(tryNotes({ head: 'acc2_02' }, ['acc2_11'], c), [CROWN_NOTE]);
  assert.deepEqual(tryNotes({ crown: 'acc2_11' }, ['top_01'], c), []);
  assert.deepEqual(tryNotes({}, ['acc2_12', 'acc2_01'], c), [], '날개는 아무것도 가리지 않는다');
  // 먼치킨이 못 산 옷은 빼고 나머지만 산다(코디네이터 2026-10-09)
  assert.equal(TRY_NOTE, '이미 가진 옷은 냥을 쓰지 않고 입기만 해요 · 냥이 모자란 옷은 빼고 나머지만 사서 입어요 · 한 번에 8벌까지');
  assert.equal(TRY_COPIED, '복사했어요 · 방송 채팅에 붙여 넣으면 사서 바로 입어요');
});

test('캐릭터 페이지가 입혀 보기를 잇는다: "입은 옷" 제목 옆 단추 · 숨은 칸 · 복사 · 원래대로 · 모양(styles.css)', async () => {
  const src = (p) => readFile(new URL('../docs/' + p, import.meta.url), 'utf8');
  const character = await src('views/character.js');
  assert.match(character, /from '\.\.\/lib\/try-on\.js'/);
  assert.match(character, /const tryOn = tryOnPanel\(\{ catalog, seasonId, dj, worn: data\.worn, level, app \}\)/);
  assert.match(character, /secHead\('입은 옷', [^\n]+, tryOn\?\.openBtn \|\| null\)/, '"입은 옷" 제목 옆 단추');
  assert.match(character, /tryOn\?\.section,/, '입은 옷 칸 바로 아래');
  assert.match(character, /\]\.filter\(Boolean\)\);/, '빈 칸(null)을 넣지 않는다');
  assert.match(character, /'aria-controls': 'try'/); assert.match(character, /'aria-expanded'/); assert.match(character, /'aria-pressed'/);
  assert.match(character, /closetLine\(codes\)/); assert.match(character, /copyText\(line\)/); assert.match(character, /toast\(TRY_COPIED\)/);
  assert.match(character, /selectNodeContents\(lineEl\)/, '복사가 안 되면 글을 골라 둔다');
  assert.match(character, /'원래대로'/); assert.match(character, /TRY_NOTE/); assert.match(character, /toast\(TRY_FULL/);
  assert.match(character, /itemGroups\(catalog, sid\)/, '탭 = 시즌 목록 묶음');
  assert.match(character, /'입는 중'/);
  // 옷에는 레벨 조건이 없다(2026-10-10): 입혀 보기 옷 칸·합계에 Lv 글이 없다
  assert.doesNotMatch(character, /it\.level|total\.level/);
  const { TRY_TITLE, TRY_EMPTY, tryOnPanel } = await import('../docs/views/character.js');
  assert.equal(TRY_TITLE, '입혀 보기'); assert.match(TRY_EMPTY, /채팅 한 줄/);
  // DJ 캐릭터나 옷 목록이 없으면 단추도 칸도 없다(DOM 없이 바로 돌아온다)
  const c = await catalog();
  assert.equal(tryOnPanel({ catalog: c, seasonId: 's1', dj: { character: null }, worn: {}, level: 1, app: { base: '/' } }), null);
  assert.equal(tryOnPanel({ catalog: buildCatalog([]), seasonId: 's1', dj: { character: { gender: 'f' } }, worn: {}, level: 1, app: { base: '/' } }), null);
  const css = await src('styles.css');
  for (const cls of ['kg-try-open', 'kg-try-top', 'kg-try-look', 'kg-try-line', 'kg-try-line.is-empty', 'kg-try-actions', 'kg-try-tabs', 'kg-try-n', 'kg-try-grid', 'kg-try-tile', 'kg-try-tile.is-on', 'kg-try-badge', 'kg-try-pick', 'kg-try-note'])
    assert.match(css, new RegExp(`\\.${cls.replace('.', '\\.')}[\\s{.:,\\[]`), cls);
  assert.match(css, /\.kg-try-top \{ position: sticky;/, '휴대폰: 미리 보기·채팅 한 줄이 위에 붙는다');
});
