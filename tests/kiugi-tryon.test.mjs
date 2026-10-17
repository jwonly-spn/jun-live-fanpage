// 캐릭터 페이지 "입혀 보기"(lib/try-on.js): 미리 보기 모습·누르기·채팅 한 줄("!옷장 상의11 하의3 신발2")·합계 — 먼치킨 !옷장 규칙과 같게.
// 시즌 목록은 사이트에 복사된 진짜 목록(docs/kiugi/season-s1.json). 아이디·이름은 쓰지 않는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCatalog, itemCodeOf, titleShopOpen, titleOpenDate } from '../docs/lib/kiugi-draw.js';
import { applyTryOn, toggleTry, canTry, isShown, itemShown, wornLook, wornIds, tryCodes, closetLine, tryTotal, tryNotes, slotOfItem, CLOSET_CMD, TRY_MAX, TRY_NOTE, TRY_FULL, TRY_COPIED,
  titleOf, titleCode, wornTitleOf, pickedTitle, shownTitle, toggleTitle, canTitle, tryLine, tryNote, copiedText, TITLE_SOON, TITLE_LEVEL } from '../docs/lib/try-on.js';
import { chatHint, itemGroups, TITLE_NOTE, CLOSET_CMD as ITEMS_CMD } from '../docs/views/items.js';

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
  assert.equal(closetLine(['한벌2']), '!옷장 한벌 2', '한 벌이면 띄어 쓴다(먼치킨 0.15.70~ — 붙여 쓴 하나는 사지 않고 설명만)');
  assert.equal(closetLine([]), ''); assert.equal(closetLine(null), '');
  assert.equal(closetLine(['상의 11', ' 악세12 ']), '!옷장 상의11 악세12', '번호 안 띄어쓰기는 붙인다');
  assert.equal(closetLine(['<script>', '', null, '상의', '11', 'top11', '배경4']), '!옷장 배경 4', '번호 모양이 아닌 것은 뺀다');
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
  assert.equal(ids.length, 130, '한벌옷·상의·하의·신발·모자·악세사리 20씩 · 배경 10');
  for (const id of ids) {
    const code = itemCodeOf(c, 's1', id);
    assert.match(code, /^(한벌|상의|하의|신발|모자|악세|배경)\d{1,2}$/, id);
    assert.equal(closetLine([code]), `!옷장 ${code.replace(/^(\D+?)(\d+)$/, '$1 $2')}`, id + '(한 벌이면 띄어 쓴다 — 먼치킨 0.15.70)');
    assert.equal(closetLine([code, code]), `!옷장 ${code} ${code}`, id + '(여러 벌이면 붙여 쓴다)');
  }
  assert.deepEqual(tryCodes(['top_11', 'bottom_03', 'shoe_02', 'hat_05', 'accessory_07', 'no-such', 'shoe2_02', 'title-halloween-insa'], c, 's1'), ['상의11', '하의3', '신발2', '모자5', '악세7'], '번호 없는 것(모르는 옷·예전 그림의 옷·칭호)은 뺀다');
  // 먼치킨 0.15.96+ R7 의 여러 벌 한 줄과 같은 모양
  assert.equal(closetLine(tryCodes(['top_11', 'bottom_03', 'shoe_02', 'hat_05', 'accessory_07'], c, 's1')), '!옷장 상의11 하의3 신발2 모자5 악세7');
});

test('미리 보기 모습(applyTryOn): 입은 옷 위에 차례대로 — 상의·하의를 입으면 한벌옷을 벗고, 한벌옷은 상의·하의를 가리고, 모자는 하나 · 악세사리는 자리마다 하나(모자와 머리 장식은 함께)', async () => {
  const c = await catalog();
  const worn = { outfit: 'outfit_01', top: 'top_02', bottom: 'bottom_01', shoes: 'shoe_06' };
  // 먼치킨은 한벌옷 아래 상의·하의도 올린다(기록에 남은 것) → 상의를 입히면 한벌옷을 벗고 입던 하의가 다시 보인다
  const a = applyTryOn(worn, ['top_11'], c);
  assert.deepEqual(a, { top: 'top_11', bottom: 'bottom_01', shoes: 'shoe_06' });
  assert.deepEqual(worn, { outfit: 'outfit_01', top: 'top_02', bottom: 'bottom_01', shoes: 'shoe_06' }, '입은 옷은 바꾸지 않는다');
  // 한벌옷을 입히면 상의·하의는 남아 있지만 보이지 않는다
  const b = applyTryOn({ top: 'top_02', bottom: 'bottom_01' }, ['outfit_03'], c);
  assert.deepEqual(b, { top: 'top_02', bottom: 'bottom_01', outfit: 'outfit_03' });
  assert.equal(isShown(b, 'top', c), false); assert.equal(isShown(b, 'bottom', c), false); assert.equal(isShown(b, 'outfit', c), true);
  // 모자와 머리 장식은 함께 보인다(가리지 않는다)
  const k = applyTryOn({ hat: 'hat_01', face: 'accessory_02' }, ['accessory_06'], c);
  assert.equal(isShown(k, 'head', c), true); assert.equal(isShown(k, 'hat', c), true); assert.equal(isShown(k, 'face', c), true);
  assert.equal(itemShown(k, 'accessory_06', c), true); assert.equal(itemShown(k, 'hat_01', c), true);
  // 악세사리는 자리마다 하나(자리 = 시즌 목록의 그 악세사리 slot) — 같은 자리 옷은 바뀌고 다른 자리는 함께 · 모자도 하나
  assert.deepEqual(applyTryOn({ head: 'accessory_06', neck: 'accessory_01', hat: 'hat_01' }, ['accessory_17', 'accessory_02', 'accessory_05', 'hat_09', 'background_04'], c),
    { head: 'accessory_17', neck: 'accessory_01', hat: 'hat_09', face: 'accessory_02', hand: 'accessory_05', bg: 'background_04' });
  // 모르는 옷 id(예전 그림의 옷 — 먼치킨을 아직 업데이트하지 않은 방송)는 그대로 둔다(그림이 뺀다), 모르는 입혀 본 옷은 무시
  assert.deepEqual(applyTryOn({ crown: 'pumpkin-crown', head: 'acc2_01' }, ['no-such', 'title-candy-plz', 'shoe2_03'], c), { crown: 'pumpkin-crown', head: 'acc2_01' });
  assert.equal(isShown({ head: 'acc2_01' }, 'head', c), false, '예전 그림의 옷은 보이지 않는다');
  assert.equal(isShown({ neck: 'accessory_02' }, 'neck', c), false, '칸과 맞지 않는 옷(목 칸의 안경)도 보이지 않는다');
  assert.deepEqual(wornLook(null), {}); assert.deepEqual(wornLook(['top_01']), {}); assert.deepEqual([...wornIds({ wings: 'shadow-wings' })], ['shadow-wings']);
  assert.equal(slotOfItem(c, 'accessory_09'), 'hand'); assert.equal(slotOfItem(c, 'hat_03'), 'hat'); assert.equal(slotOfItem(c, 'acc2_09'), null); assert.equal(slotOfItem(c, 'title-candy-plz'), null); assert.equal(slotOfItem(c, 'constructor'), null);
});

test('먼치킨 !옷장 과 같은 결과: 한 줄의 번호를 차례대로 입히면(putOn) 미리 보기 모습과 같다', async () => {
  const c = await catalog();
  // 먼치킨 kiugi.mjs putOn 과 같은 규칙(칸에 넣고, 상의·하의면 한벌옷을 벗긴다)
  const putOn = (w, slot, id) => { const o = { ...w, [slot]: id }; if (slot === 'top' || slot === 'bottom') delete o.outfit; return o; };
  const cases = [
    [{ outfit: 'outfit_02', top: 'top_01' }, ['bottom_05', 'shoe_03', 'hat_11']],
    [{ top: 'top_01', bottom: 'bottom_02', head: 'accessory_06', hat: 'hat_02' }, ['outfit_04', 'accessory_17', 'hat_16', 'background_02']],
    [{}, ['top_20', 'bottom_20', 'shoe_10', 'hat_07', 'accessory_06', 'accessory_02', 'accessory_01', 'accessory_05']],
  ];
  for (const [worn, clicks] of cases) {
    const tried = press(c, clicks, worn);
    const byBot = tried.reduce((w, id) => putOn(w, c.items[id].slot, id), { ...worn });
    assert.deepEqual(applyTryOn(worn, tried, c), byBot, clicks.join(' '));
  }
});

test('옷 누르기(toggleTry): 입혀 보기·다시 누르면 벗기, 칸마다 한 벌, 한벌옷 ↔ 상의·하의, 누른 차례 = 채팅 차례', async () => {
  const c = await catalog();
  assert.deepEqual(press(c, ['top_11', 'bottom_03', 'shoe_02']), ['top_11', 'bottom_03', 'shoe_02']);
  assert.deepEqual(press(c, ['top_11', 'bottom_03', 'top_11']), ['bottom_03'], '다시 누르면 뺀다');
  assert.deepEqual(press(c, ['top_11', 'top_05']), ['top_05'], '같은 칸은 바꾼다');
  assert.deepEqual(press(c, ['top_11', 'bottom_03', 'shoe_02', 'outfit_02']), ['shoe_02', 'outfit_02'], '한벌옷을 입히면 입혀 본 상의·하의를 뺀다');
  assert.deepEqual(press(c, ['outfit_02', 'shoe_02', 'bottom_07']), ['shoe_02', 'bottom_07'], '상의·하의를 입히면 입혀 본 한벌옷을 뺀다');
  assert.deepEqual(press(c, ['accessory_06', 'accessory_17', 'accessory_02', 'hat_05']), ['accessory_17', 'accessory_02', 'hat_05'], '악세사리는 자리(머리·얼굴)마다 하나, 모자와 머리 장식은 함께');
  assert.deepEqual(press(c, ['hat_01', 'hat_09']), ['hat_09'], '모자는 하나');
  assert.deepEqual(press(c, ['background_01', 'background_09']), ['background_09'], '배경은 하나');
  assert.deepEqual(press(c, ['no-such', 'title-candy-plz', 'acc2_01', 'shoe2_02']), [], '모르는 옷·칭호·예전 그림의 옷은 입혀 볼 수 없다');
  assert.deepEqual(toggleTry(['top_11'], { id: 'top_11' }, c), [], '옷 객체({id})도 받는다');
  assert.equal(closetLine(tryCodes(press(c, ['top_11', 'bottom_03', 'shoe_02', 'hat_09']), c, 's1')), '!옷장 상의11 하의3 신발2 모자9');
});

// 여덟 벌(칸이 모두 다른 옷): 상의·하의·신발·모자·머리·얼굴·목 장식·배경
const EIGHT = ['top_01', 'bottom_01', 'shoe_01', 'hat_01', 'accessory_06', 'accessory_02', 'accessory_01', 'background_01'];
test('한 번에 8벌까지: 9벌째는 더하지 않고(canTry false), 같은 칸 바꾸기·빼기는 된다', async () => {
  const c = await catalog();
  const eight = EIGHT;
  const full = press(c, eight);
  assert.equal(full.length, 8);
  assert.equal(canTry(full, 'accessory_05', c), false, '손 장식(9벌째)');
  assert.deepEqual(toggleTry(full, 'accessory_05', c), full, '9벌째는 그대로');
  assert.equal(canTry(full, 'top_02', c), true); assert.deepEqual(toggleTry(full, 'top_02', c), [...eight.slice(1), 'top_02'], '같은 칸은 바꾼다(뒤로 간다)');
  assert.equal(canTry(full, 'outfit_01', c), true, '한벌옷은 상의·하의 둘을 빼고 들어간다');
  assert.equal(toggleTry(full, 'outfit_01', c).length, 7);
  assert.equal(canTry(full, 'top_01', c), true); assert.equal(toggleTry(full, 'top_01', c).length, 7, '빼기는 늘 된다');
  assert.equal(closetLine(tryCodes(full, c, 's1')).split(' ').length, 9);
  assert.match(TRY_FULL, /옷과 칭호를 합쳐 한 번에 8개까지/);
});

test('지금 입은 옷: 누르면 원래 옷으로 되돌린다(명령 없음), 입은 한벌옷 아래 상의·하의는 다시 입기로 더한다, 값은 세지 않는다', async () => {
  const c = await catalog();
  const worn = { outfit: 'outfit_01', top: 'top_02', bottom: 'bottom_01', head: 'accessory_06', hat: 'hat_01' };
  // 상의를 입혀 본 뒤 입은 한벌옷을 누르면 → 입혀 본 상의를 빼서 원래대로
  assert.deepEqual(toggleTry(['top_11', 'shoe_02'], 'outfit_01', c, { worn }), ['shoe_02']);
  // 다른 머리 장식·모자를 입혀 본 뒤 입은 것을 누르면 → 입혀 본 것을 빼서 원래대로
  assert.deepEqual(toggleTry(['accessory_17', 'shoe_02'], 'accessory_06', c, { worn }), ['shoe_02']);
  assert.deepEqual(toggleTry(['hat_09'], 'hat_01', c, { worn }), []);
  // 한벌옷 아래의 입은 상의를 누르면 → 다시 입는 줄로 더한다(먼치킨: 가진 옷이라 냥 없이 입히고 한벌옷을 벗긴다)
  const back = toggleTry([], 'top_02', c, { worn });
  assert.deepEqual(back, ['top_02']);
  assert.equal(itemShown(applyTryOn(worn, back, c), 'top_02', c), true);
  assert.equal(closetLine(tryCodes(back, c, 's1')), '!옷장 상의 2');
  assert.deepEqual(tryTotal(back, c, { worn }), { count: 1, price: 0 }, '입은 옷은 값을 세지 않는다');
  // 입은 모자 아래 머리 장식은 가려지지 않는다 → 누르면 "지금 입은 옷"(명령 없음)
  assert.deepEqual(toggleTry([], 'accessory_06', c, { worn }), []);
});

test('합계(tryTotal)·알림(tryNotes)·안내 글', async () => {
  const c = await catalog();
  // 먼치킨 값(묶음마다 값 하나, 옷에는 레벨 조건 없음): 상의11 700 + 하의5 700 + 악세11 400 · 한벌2 2,500 + 배경3 500 · 모자5 500 + 신발2 700
  assert.deepEqual(tryTotal(['top_11', 'bottom_05', 'accessory_11'], c), { count: 3, price: 1800 });
  assert.deepEqual(tryTotal(['outfit_02', 'background_03'], c), { count: 2, price: 3000 });
  assert.deepEqual(tryTotal(['hat_05', 'shoe_02'], c), { count: 2, price: 1200 });
  assert.deepEqual(tryTotal([], c), { count: 0, price: 0 });
  assert.deepEqual(tryTotal(['top_11', 'no-such', 'acc2_11'], c, { worn: { top: 'top_11' } }), { count: 1, price: 0 }, '모르는 옷·예전 그림의 옷은 세지 않는다');
  // 옷 알림: 예전 그림의 "왕관이 머리 장식을 가려요"는 없앴다 — 모자와 머리 장식을 함께 골라도 알림 없음
  assert.deepEqual(tryNotes({}, ['hat_01', 'accessory_06'], c), []);
  assert.deepEqual(tryNotes({ hat: 'hat_16' }, ['accessory_17'], c), []);
  // 먼치킨이 못 산 옷은 빼고 나머지만 산다(코디네이터 2026-10-09)
  assert.equal(TRY_NOTE, '이미 가진 옷은 냥을 쓰지 않고 입기만 해요 · 냥이 모자란 옷은 빼고 나머지만 사서 입어요 · 한 번에 8벌까지');
  assert.equal(TRY_COPIED, '복사했어요 · 방송 채팅에 붙여 넣으면 사서 바로 입어요');
});

test('캐릭터 페이지가 입혀 보기를 잇는다: "입은 옷" 제목 옆 단추 · 숨은 칸 · 복사 · 원래대로 · 모양(styles.css)', async () => {
  const src = (p) => readFile(new URL('../docs/' + p, import.meta.url), 'utf8');
  const character = await src('views/character.js');
  assert.match(character, /from '\.\.\/lib\/try-on\.js'/);
  // 2026-10-18 새 구조: 카드가 아는 것으로 먼저 그릴 때(partial — 단 칭호를 아직 모른다)는 입혀 보기를 서버 답이 온 뒤에 단다
  assert.match(character, /const tryOn = partial \? null : tryOnPanel\(\{ catalog, seasonId, dj, worn: data\.worn, titles: data\.titles, level, app, pet: buddy, motion: motion\?\.id \}\)/, '단 칭호·하는 모션도 넘긴다');
  assert.match(character, /secHead\('입은 옷', [^\n]+, tryOn\?\.openBtn \|\| null\)/, '"입은 옷" 제목 옆 단추');
  assert.match(character, /tryOn\?\.section,/, '입은 옷 칸 바로 아래');
  assert.match(character, /\]\.filter\(Boolean\)\);/, '빈 칸(null)을 넣지 않는다');
  assert.match(character, /'aria-controls': 'try'/); assert.match(character, /'aria-expanded'/); assert.match(character, /'aria-pressed'/);
  assert.match(character, /line = tryLine\(tried, catalog, sid, \{ title, wornTitle, bare \}\)/, '채팅 한 줄 = 옷 번호 + 맨 끝 칭호 번호(맨몸부터면 !옷장 다벗기 …)');
  assert.match(character, /copyText\(line\)/); assert.match(character, /toast\(copiedText\(/);
  assert.match(character, /selectNodeContents\(lineEl\)/, '복사가 안 되면 글을 골라 둔다');
  assert.match(character, /'원래대로'/); assert.match(character, /tryNote\(\{ titles: titles\.length > 0, rule \}\)/); assert.match(character, /toast\(TRY_FULL/);
  assert.match(character, /tried = \[\]; title = null; bare = false; sync\(\);/, '원래대로는 고른 칭호도 빼고 맨몸부터도 끈다');
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
  for (const cls of ['kg-try-open', 'kg-try-top', 'kg-try-look', 'kg-try-line', 'kg-try-line.is-empty', 'kg-try-actions', 'kg-try-tabs', 'kg-try-n', 'kg-try-grid', 'kg-try-tile', 'kg-try-tile.is-on', 'kg-try-badge', 'kg-try-pick', 'kg-try-note',
    'kg-try-title', 'kg-try-title-img', 'kg-try-look.has-title', 'kg-try-titles', 'kg-try-tab-note', 'kg-try-grid.is-titles', 'kg-try-title-media', 'kg-chip.soon'])
    assert.match(css, new RegExp(`\\.${cls.replace('.', '\\.')}[\\s{.:,\\[]`), cls);
  assert.match(css, /\.kg-try-top \{ position: sticky;/, '휴대폰: 미리 보기·채팅 한 줄이 위에 붙는다');
});

// ---- 칭호(2026-10-14: 입혀 보기에서 칭호도 고른다 — "!옷장 상의11 하의3 칭호2") ----
const BEFORE = Date.parse('2026-10-20T12:00:00+09:00'), AFTER = Date.parse('2026-11-02T12:00:00+09:00');
const T1 = 'title-halloween-insa', T2 = 'title-yeojang-namja', T4 = 'title-candy-plz';

test('칭호 상점 여는 때(rewardRule.opensAt): 시즌 목록에서 읽고, 열리기 전에만 여는 날 글("10월 30일")', async () => {
  const c = await catalog();
  const rule = c.seasons.s1.rewardRule;
  assert.equal(rule.opensAt, Date.parse('2026-10-30T00:00:00+09:00'), '시즌 목록 seasonRewardRule.opensAt');
  assert.equal(titleShopOpen(rule, BEFORE), false); assert.equal(titleShopOpen(rule, rule.opensAt), true); assert.equal(titleShopOpen(rule, AFTER), true);
  assert.equal(titleOpenDate(rule, BEFORE), '10월 30일'); assert.equal(titleOpenDate(rule, AFTER), '');
  assert.equal(titleOpenDate({ opensAt: Date.parse('2027-01-02T00:00:00+09:00') }, BEFORE), '2027년 1월 2일', '해가 다르면 해도');
  // 여는 때를 모르면 처음부터 열린 것으로 · ms 숫자도 받는다 · 없으면 season.rewardShopOpensAt
  assert.equal(titleShopOpen(null, BEFORE), true); assert.equal(titleOpenDate({}, BEFORE), '');
  const raw = (rule2, season = {}) => buildCatalog([{ season: { id: 's9', ...season }, seasonRewardRule: rule2 }]).seasons.s9.rewardRule.opensAt;
  assert.equal(raw({}), null); assert.equal(raw({ opensAt: 'nope' }), null); assert.equal(raw({ opensAt: 1700000000000 }), 1700000000000);
  assert.equal(raw({}, { rewardShopOpensAt: '2026-12-15T00:00:00+09:00' }), Date.parse('2026-12-15T00:00:00+09:00'));
});

test('칭호 고르기(toggleTitle): 하나만 — 다른 칭호면 바꾸고, 다시 누르면 빼고, 단 칭호를 누르면 단 칭호로 되돌린다', async () => {
  const c = await catalog();
  assert.equal(titleCode(c, T2), '칭호2'); assert.equal(titleCode(c, 'title-nope'), null); assert.equal(titleCode(c, 'top_11'), null, '옷은 칭호가 아니다');
  assert.equal(titleOf(c, T4).name, '사탕내놧'); assert.equal(titleOf(c, null), null);
  assert.equal(wornTitleOf(c, [T1]), T1); assert.equal(wornTitleOf(c, ['title-old', T4]), T4, '시즌 목록에 있는 첫 칭호'); assert.equal(wornTitleOf(c, []), null); assert.equal(wornTitleOf(c, null), null);
  assert.equal(toggleTitle(null, T2, c), T2);
  assert.equal(toggleTitle(T2, T4, c), T4, '다른 칭호면 바꾼다');
  assert.equal(toggleTitle(T4, T4, c), null, '다시 누르면 뺀다');
  assert.equal(toggleTitle(null, 'title-nope', c), null); assert.equal(toggleTitle(T2, 'top_11', c), T2, '모르는 것은 그대로');
  // 지금 단 칭호: 고를 것이 아니다 — 다른 칭호를 골라 둔 뒤 누르면 단 칭호로 되돌린다
  assert.equal(toggleTitle(null, T1, c, { wornTitle: T1 }), null);
  assert.equal(toggleTitle(T2, T1, c, { wornTitle: T1 }), null);
  assert.equal(pickedTitle(c, T1, T1), null, '단 칭호는 채팅 한 줄에 넣지 않는다'); assert.equal(pickedTitle(c, T2, T1), T2); assert.equal(pickedTitle(c, 'title-nope'), null);
  // 미리 보기 배지: 고른 칭호, 없으면 단 칭호
  assert.equal(shownTitle(c, T2, T1), T2); assert.equal(shownTitle(c, null, T1), T1); assert.equal(shownTitle(c, null, null), null); assert.equal(shownTitle(c, T1, T1), T1);
});

test('옷과 칭호를 합쳐 8개까지: 칭호를 골라 두면 옷은 7벌, 옷이 8벌이면 새 칭호는 못 고른다(바꾸기·빼기는 된다)', async () => {
  const c = await catalog();
  const eight = EIGHT;
  const seven = eight.slice(0, 7);
  // 옷 8벌 → 새 칭호는 안 된다(그대로), 단 칭호를 누르는 것은 된다(되돌리기)
  assert.equal(canTitle(eight, null, T2, c), false); assert.equal(toggleTitle(null, T2, c, { tried: eight }), null);
  assert.equal(canTitle(eight, null, T1, c, { wornTitle: T1 }), true);
  assert.equal(canTitle(seven, null, T2, c), true); assert.equal(toggleTitle(null, T2, c, { tried: seven }), T2);
  // 칭호를 골라 둔 뒤에는 바꾸기·빼기는 늘 된다(자리가 그대로)
  assert.equal(canTitle(seven, T2, T4, c), true); assert.equal(canTitle(seven, T2, T2, c), true);
  // 칭호를 골라 두면 8번째 옷은 더하지 않는다(같은 칸 바꾸기는 된다)
  assert.equal(canTry(seven, 'background_01', c, { title: T2 }), false);
  assert.deepEqual(toggleTry(seven, 'background_01', c, { title: T2 }), seven);
  assert.equal(canTry(seven, 'top_05', c, { title: T2 }), true);
  assert.equal(canTry(seven, 'background_01', c), true, '칭호가 없으면 8벌까지');
  assert.equal(canTry(seven, 'background_01', c, { title: T1, wornTitle: T1 }), true, '단 칭호는 자리를 차지하지 않는다');
  assert.equal(canTry(seven, 'background_01', c, { title: 'title-nope' }), true, '모르는 칭호도');
});

test('채팅 한 줄(tryLine): 옷 번호 다음 맨 끝에 칭호 번호, 칭호만이면 띄어 쓴다, 단 칭호는 넣지 않는다, 8개를 넘지 않는다', async () => {
  const c = await catalog();
  assert.equal(tryLine(['top_11', 'bottom_03'], c, 's1', { title: T2 }), '!옷장 상의11 하의3 칭호2');
  assert.equal(tryLine([], c, 's1', { title: T2 }), '!옷장 칭호 2', '칭호만이면 "!옷장 칭호 2"(옷 도감 복사와 같게)');
  assert.equal(tryLine([], c, 's1', { title: T4 }), chatHint('칭호4'));
  assert.equal(tryLine(['top_11'], c, 's1'), '!옷장 상의 11', '칭호가 없으면 예전 그대로');
  assert.equal(tryLine(['top_11', 'bottom_03'], c, 's1', { title: T1, wornTitle: T1 }), '!옷장 상의11 하의3', '단 칭호는 넣지 않는다');
  assert.equal(tryLine([], c, 's1', { title: T1, wornTitle: T1 }), '');
  assert.equal(tryLine([], c, 's1', { title: 'title-nope' }), '');
  const eight = EIGHT;
  const line = tryLine(eight, c, 's1', { title: T2 });
  assert.equal(line.split(' ').length, 1 + TRY_MAX, '번호는 8개까지'); assert.match(line, / 칭호2$/, '칭호 자리는 남긴다');
  assert.equal(closetLine(['상의11', '칭호2']), '!옷장 상의11 칭호2', '칭호 번호도 번호 모양');
});

test('칭호 값·알림: 합계에 칭호 값(단 칭호는 빼고), 상점이 열리기 전·Lv.10 아래면 알림, 안내 글·복사 알림', async () => {
  const c = await catalog();
  const price = (ids) => ids.reduce((n, id) => n + (c.items[id]?.price ?? c.titles[id].price), 0);
  assert.deepEqual(tryTotal(['top_11', 'bottom_03'], c, { title: T2 }), { count: 2, price: price(['top_11', 'bottom_03', T2]) });
  assert.deepEqual(tryTotal([], c, { title: T4 }), { count: 0, price: price([T4]) });
  assert.deepEqual(tryTotal(['top_11'], c, { title: T1, wornTitle: T1 }), { count: 1, price: price(['top_11']) }, '단 칭호는 가진 것이라 세지 않는다');
  assert.deepEqual(tryTotal(['top_11'], c, { worn: { top: 'top_11' }, title: T2 }), { count: 1, price: price([T2]) });
  // 알림: 상점이 열리기 전(10월 30일) · 레벨이 모자람(레벨을 알 때만) · 단 칭호·칭호 없음이면 없다
  assert.deepEqual(tryNotes({}, [], c, { title: T2, now: BEFORE }), [TITLE_SOON('10월 30일')]);
  assert.deepEqual(tryNotes({}, [], c, { title: T2, now: AFTER }), []);
  assert.deepEqual(tryNotes({}, [], c, { title: T2, now: AFTER, level: 7 }), [TITLE_LEVEL(10)]);
  assert.deepEqual(tryNotes({}, [], c, { title: T2, now: BEFORE, level: 3 }), [TITLE_SOON('10월 30일'), TITLE_LEVEL(10)]);
  assert.deepEqual(tryNotes({}, [], c, { title: T2, now: AFTER, level: 10 }), []);
  assert.deepEqual(tryNotes({}, [], c, { title: T1, wornTitle: T1, now: BEFORE, level: 1 }), [], '단 칭호');
  assert.deepEqual(tryNotes({}, ['hat_01', 'accessory_06'], c, { title: T2, now: AFTER }), [], '옷 알림 없음(칭호만)');
  assert.equal(TITLE_SOON('10월 30일'), '칭호는 10월 30일부터 살 수 있어요'); assert.equal(TITLE_LEVEL(10), '칭호는 Lv.10이 되어야 살 수 있어요');
  // 안내 한 줄: 칭호가 없는 시즌은 예전 그대로, 있으면 여는 날(열리기 전에만)·Lv.10·"옷과 칭호를 합쳐 8개까지" — 날짜는 시즌 목록에서
  const rule = c.seasons.s1.rewardRule;
  assert.equal(tryNote(), TRY_NOTE); assert.equal(tryNote({ titles: false, rule, now: BEFORE }), TRY_NOTE);
  assert.equal(tryNote({ titles: true, rule, now: BEFORE }), '이미 가진 옷·칭호는 냥을 쓰지 않고 입거나 달기만 해요 · 냥이 모자란 옷은 빼고 나머지만 사서 입어요 · 칭호는 10월 30일부터 팔고, Lv.10이 되어야 살 수 있어요 · 옷과 칭호를 합쳐 한 번에 8개까지');
  assert.match(tryNote({ titles: true, rule, now: AFTER }), / · 칭호는 Lv\.10이 되어야 살 수 있어요 · /); assert.doesNotMatch(tryNote({ titles: true, rule, now: AFTER }), /10월 30일/);
  assert.match(tryNote({ titles: true, rule: { ...rule, opensAt: Date.parse('2026-12-24T00:00:00+09:00') }, now: BEFORE }), /칭호는 12월 24일부터 팔고/, '날짜는 시즌 목록에서');
  assert.equal(copiedText({ clothes: 2 }), TRY_COPIED);
  assert.equal(copiedText({ clothes: 0, title: true }), '복사했어요 · 방송 채팅에 붙여 넣으면 칭호를 사서 바로 달아요');
  assert.equal(copiedText({ clothes: 3, title: true }), '복사했어요 · 방송 채팅에 붙여 넣으면 옷을 사서 입고 칭호도 달아요');
});

test('캐릭터 페이지 입혀 보기의 칭호 탭: 옷 묶음 뒤 "칭호" · 하나만 고르기 · 단 칭호는 "다는 중" · 미리 보기 위 배지 · 옷 도감 안내에 여는 날', async () => {
  const src = (p) => readFile(new URL('../docs/' + p, import.meta.url), 'utf8');
  const character = await src('views/character.js');
  assert.match(character, /const tabList = \[\.\.\.groups, \.\.\.\(titles\.length \? \[\{ slot: TITLE_TAB, name: '칭호', items: titles, title: true \}\] : \[\]\)\]/, '칭호가 있는 시즌만, 옷 묶음 뒤에');
  assert.match(character, /onclick: \(\) => pickTitle\(t\.id\)/); assert.match(character, /toast\(TITLE_WORN\)/, '단 칭호를 누르면 알림만');
  assert.match(character, /'다는 중'/); assert.match(character, /'달아 봄'/);
  assert.match(character, /titleOpenDate\(rule\)/, '여는 날은 시즌 목록에서'); assert.match(character, /`\$\{openDate\}부터`/);
  assert.match(character, /shownTitle\(catalog, title, wornTitle\)/, '미리 보기 배지 = 고른 칭호, 없으면 단 칭호');
  assert.match(character, /tryTotal\(tried, catalog, \{ worn, title, wornTitle \}\)/); assert.match(character, /tryNotes\(base\(\), tried, catalog, \{ title, wornTitle, level \}\)/);
  assert.match(character, /canTry\(tried, id, catalog, \{ worn: base\(\), title, wornTitle \}\)/); assert.match(character, /canTitle\(tried, title, id, catalog, \{ wornTitle \}\)/);
  const { TITLE_TAB } = await import('../docs/views/character.js');
  assert.equal(TITLE_TAB, 'title');
  const c = await catalog();
  assert.ok(!itemGroups(c, 's1').groups.some((g) => g.slot === TITLE_TAB), '옷 묶음 id 와 겹치지 않는다');
  // 옷 도감: 칭호 안내에 여는 날(열리기 전에만), 칭호 칸에 "10월 30일부터"
  const rule = c.seasons.s1.rewardRule;
  assert.match(TITLE_NOTE(rule, BEFORE), /^Lv\.10부터 살 수 있어요\(10월 30일부터 팔아요\)\. /);
  assert.match(TITLE_NOTE(rule, AFTER), /^Lv\.10부터 살 수 있어요\. /);
  const items = await src('views/items.js');
  assert.match(items, /h\('span', \{ class: 'kg-chip soon' \}, `\$\{openDate\}부터`\)/); assert.match(items, /입혀 보기에서 옷과 함께 달아 보고/);
});

test('냥 모으기 안내에 !산책(첫 화면·DJ 키우기 페이지), 화면 글에 예전 값·무료 냥 숫자를 적어 두지 않는다', async () => {
  const src = (p) => readFile(new URL('../docs/' + p, import.meta.url), 'utf8');
  const intro = await src('views/intro.js'), kiugi = await src('views/kiugi.js');
  assert.match(intro, /step\('2', '냥 모으기', \[[^\n]*cmd\('!산책'\)/);
  assert.match(kiugi, /step\('2', '냥 모으기', [^\n]*cmd\('!산책'\)[^\n]*cmd\('!산책 1'\)[^\n]*cmd\('!산책 2'\)/);
  // 값은 시즌 목록(docs/kiugi/season-*.json)에서만 — 화면 글에 옷 값·무료 냥 숫자를 박아 두지 않는다
  for (const f of ['views/intro.js', 'views/kiugi.js', 'views/items.js', 'views/character.js', 'views/cards.js', 'views/common.js', 'lib/try-on.js', 'index.html'])
    assert.doesNotMatch(await src(f), /[0-9],?[0-9]{3}냥|[0-9]{3}냥|하루 [0-9,]+냥|무료 냥/, f);
});

test('맨몸부터(2026-10-15 — 먼치킨 0.15.84 !다벗기): 입은 옷을 모두 벗긴 모습(배경만 남김)에서 입혀 보고, 채팅 한 줄은 "!옷장 다벗기 …"(고른 것이 없으면 "!다벗기") · 벗긴 옷은 가진 옷이라 값에 들지 않는다', async () => {
  const { bareWorn, BARE_KEEP, UNDRESS_CMD, UNDRESS_WORD, BARE_NOTE } = await import('../docs/lib/try-on.js');
  const c = await catalog(), sid = c.last;
  assert.deepEqual([...BARE_KEEP], ['bg']); assert.equal(UNDRESS_CMD, '!다벗기'); assert.equal(UNDRESS_WORD, '다벗기'); assert.match(BARE_NOTE, /맨몸/);
  const worn = { outfit: 'outfit_01', shoes: 'shoe_06', head: 'accessory_06', hat: 'hat_01', bg: 'background_02' };
  assert.deepEqual(bareWorn(worn), { bg: 'background_02' }, '배경만 남는다(모자도 벗는다)');
  assert.deepEqual(bareWorn({ top: 'top_02' }), {});
  assert.deepEqual(bareWorn(null), {});
  // 채팅 한 줄
  assert.equal(closetLine([], { bare: true }), '!다벗기', '고른 것이 없으면 모두 벗기만');
  assert.equal(closetLine(['상의11'], { bare: true }), '!옷장 다벗기 상의11', '한 벌도 붙여 쓴다(다벗기 뒤의 번호는 사기·입기로 읽는다)');
  assert.equal(closetLine(['상의11', '하의3', '칭호2'], { bare: true }), '!옷장 다벗기 상의11 하의3 칭호2');
  // 맨몸에서 입혀 보기: 입던 신발을 다시 고르면 "가진 옷"(값 0), 새 상의만 값
  const base = bareWorn(worn), tried = press(c, ['shoe_06', 'top_05'], base);
  assert.deepEqual(tried, ['shoe_06', 'top_05'], '맨몸에서는 입던 옷도 다시 고른다');
  assert.deepEqual(applyTryOn(base, tried, c), { bg: 'background_02', shoes: 'shoe_06', top: 'top_05' });
  assert.equal(tryLine(tried, c, sid, { bare: true }), '!옷장 다벗기 신발6 상의5');
  assert.deepEqual(tryTotal(tried, c, { worn }), { count: 2, price: c.items.top_05.price }, '입던 신발은 가진 옷이라 값에 들지 않는다');
  assert.equal(tryLine(tried, c, sid), '!옷장 신발6 상의5', '맨몸부터를 끄면 예전처럼');
  // 복사 알림
  assert.match(copiedText({ bare: true }), /옷을 모두 벗어요/);
  assert.match(copiedText({ bare: true, clothes: 2 }), /모두 벗고 고른 것만 입어요/);
  // 화면: 맨몸부터 단추 · 원래대로가 끈다 · 바탕은 base()
  const src = await readFile(new URL('../docs/views/character.js', import.meta.url), 'utf8');
  assert.match(src, /class: 'btn btn-line kg-try-bare', 'aria-pressed': 'false'/);
  assert.match(src, /onclick: \(\) => \{ pickMotion = nowMotion; tried = \[\]; title = null; bare = false; sync\(\); \}/, '원래대로는 고른 모션도 지금 하는 모션으로');
  assert.match(src, /tryLine\(tried, catalog, sid, \{ title, wornTitle, bare \}\)/);
  assert.match(src, /have\.has\(id\) \? '가진 옷' : ''/);
});
