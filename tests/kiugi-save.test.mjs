// 캐릭터 이미지로 저장(lib/kiugi-save.js): 캔버스에 그릴 차례가 화면 그림(kiugi-art.js characterSvg·layersOf)과 같은지, 배치·글·파일 이름·저장 방법.
// 아이디는 모두 지어낸 것(밤톨·사탕요정·달무리, 캐릭터 이름 먼치·쿠키).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { characterSvg, layersOf, svgUrls, hairColorOf, SIZE } from '../docs/kiugi/kiugi-art.js';
import hairColor, { svgFilter, recolor, PALETTE } from '../docs/kiugi/kiugi-hair-color.js';
import { ART } from '../docs/kiugi/kiugi-v5-data.js';
import { buildCatalog, characterMarkup, expressionFor } from '../docs/lib/kiugi-draw.js';
import {
  characterPlan, planSteps, planUrls, artUrl, paintPlan, tintedHair, tintKey, TINT_CACHE_MAX, coverRect, labelParts, levelParts, levelText, saveFileName, saveMode,
  SAVE_W, SAVE_H, SAVE_LAYOUT, SITE_MARK, SITE_DOMAIN, UNOFFICIAL_MARK, SAVE_LABEL, renderSaveImage, saveCharacterImage, canvasBlob,
} from '../docs/lib/kiugi-save.js';

const B = '/jun-live-fanpage/';
const read = async (p) => JSON.parse(await readFile(new URL('../docs/kiugi/' + p, import.meta.url), 'utf8'));
const catalog = async () => { const m = await read('manifest.json'); return buildCatalog(await Promise.all(m.seasons.map(read)), { files: m.files, adjust: {} }); };

// 지어낸 DJ 캐릭터와 입은 옷 묶음(체험 모드 옷 묶음 + 마스크·밑단·왕관이 걸리는 것)
const DJS = [
  { name: '먼치', gender: 'f', hair: '9', hairColor: 'pink', eyes: '2', nose: '1', mouth: '2' },
  { name: '쿠키', gender: 'm', hair: '5', hairColor: 'brown', eyes: '5', nose: '5', mouth: '8' },
  { name: '젤리', gender: 'f', hair: 'f_twin', hairColor: 'sky', skin: 's1', eyes: 'happy', nose: 'dot', mouth: 'cat' }, // 예전(V2) 값
  {},
];
const WORN = [
  {},
  { top: 'top_05', bottom: 'bottom_03', shoes: 'shoe2_04', face: 'acc2_04', bg: 'background_01', crown: 'pumpkin-crown', wings: 'shadow-wings', aura: 'moonlight-aura' },
  { outfit: 'outfit_03', shoes: 'shoe2_06', neck: 'acc2_06' },
  { top: 'top_06', bottom: 'bottom_09', shoes: 'shoe2_03', head: 'acc2_01', hand: 'acc2_10', bg: 'background_05' },
  { outfit: 'outfit_05', shoes: 'shoe2_02', head: 'acc2_03', crown: 'pumpkin-crown' }, // 한벌옷 밑단 · 왕관이 머리 장식을 가림
  { top: 'top_03', bottom: 'bottom_05', shoes: 'shoe2_01', head: 'acc2_02' }, // 남자 하의 05 는 밑단이 있다
  { top: 'top_01', bottom: 'bottom_01', shoes: 'shoe2_08', neck: 'acc2_07', wings: 'shadow-wings' },
  { outfit: 'outfit_07', shoes: 'shoe_03', head: 'accessory_01', bg: 'halloween-night' }, // V4 에서 지운 옷·예전 배경 → 그리지 않는다
  { head: 'acc2_01' }, // 높은 모자 → 둥실 하트가 옆으로
  { top: 'top_17', bottom: 'bottom_19', shoes: 'shoe2_04', face: 'acc2_04' }, // 새 상의·하의(V5 11~20) — 하의 19 는 밑단이 있다
  { top: 'top_11', bottom: 'bottom_13', bg: 'background_02' },
];
const EXPR = [{ level: 1, parts: [] }, { level: 7, parts: ['exp-floating-hearts', 'exp-blush'] }, { level: 10, parts: ['eyes:heart', 'exp-blush', 'exp-floating-hearts', 'mouth:grin'] }];
const each = (fn) => { for (const dj of DJS) for (const worn of WORN) for (const ex of EXPR) fn(dj, { worn }, ex); };

const path = (m) => `${ART.dir}${m.file}?v=${m.v}`;
// 계획을 SVG 와 같은 모양으로 펴기: 보이는 그림(차례대로) · 마스크 그림(차례대로) · 머리색
function flat(plan) {
  const images = [], masks = [], colors = new Set();
  if (plan.background) images.push(path(plan.background));
  const walk = (ops) => {
    for (const op of ops) {
      if (op.kind === 'layer') walk(op.ops);
      else if (op.kind === 'erase') masks.push(path(op.mask));
      else if (op.kind === 'hem') { masks.push(path(op.mask)); images.push(path(op.src)); }
      else if (op.src) { images.push(path(op.src)); if (op.kind === 'tint') colors.add(op.color); }
    }
  };
  walk(plan.ops);
  return { images, masks, colors: [...colors] };
}

test('그릴 차례 = 화면 그림의 차례(layersOf): 보상 오라·날개 → 뒷머리 → 몸 칸(지우기·옷·신발·밑단) → 눈·코·입 → 앞머리 → 악세사리 → 왕관', () => {
  let n = 0;
  each((dj, look, ex) => {
    const plan = characterPlan(dj, look, ex);
    assert.deepEqual(planSteps(plan).filter((s) => !s.startsWith('exp-')), layersOf(dj, look).map((x) => x.step), JSON.stringify(look.worn));
    n++;
  });
  assert.ok(n >= 100);
  // 몸 칸은 한 묶음(뒷머리·날개·오라를 지우지 않게)
  const plan = characterPlan(DJS[1], { worn: WORN[5] }, null);
  const body = plan.ops.find((o) => o.kind === 'layer');
  assert.deepEqual(body.ops.map((o) => o.step), ['body', 'bottom.cut', 'bottom', 'top.cut', 'top', 'shoe.cut', 'shoe', 'bottom.hem']);
  assert.equal(plan.ops.findIndex((o) => o.step === 'hair.back') < plan.ops.indexOf(body), true);
  // 왕관이 머리 장식을 가리고, 한벌옷이 상의·하의를 덮는다
  const crowned = planSteps(characterPlan(DJS[0], { worn: { ...WORN[4], top: 'top_01', bottom: 'bottom_01' } }, null));
  assert.ok(!crowned.includes('accessory.head') && !crowned.includes('top') && crowned.includes('outfit.hem') && crowned.includes('reward.front'));
  // 지운 옷·예전 배경은 그리지 않는다
  assert.deepEqual(planSteps(characterPlan(DJS[0], { worn: WORN[7] }, null)), planSteps(characterPlan(DJS[0], { worn: {} }, null)));
});

test('같은 그림 파일·마스크·머리색·표정 겹치기: characterSvg 가 만든 SVG 글과 하나하나 같다', () => {
  each((dj, look, ex) => {
    const plan = characterPlan(dj, look, ex), f = flat(plan);
    const svg = characterSvg(dj, look, { expression: ex, transparent: true });
    const [defs, body] = svg.split('</defs>');
    const label = JSON.stringify([dj.name, look.worn, ex.level]);
    assert.deepEqual(f.images, [...body.matchAll(/<image href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&')), label + ' 보이는 그림 차례');
    assert.deepEqual(f.masks, [...defs.matchAll(/<mask [^>]*><image href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&')), label + ' 마스크 차례');
    // 머리색: 계획의 색(팔레트 열쇠) = DJ 캐릭터 머리색, SVG 의 머리 필터 = 같은 색의 svgFilter 표(tone-map-v1) — 예전 곱하기(flood) 없음
    assert.deepEqual(f.colors, [hairColorOf(dj)], label + ' 머리색');
    const fid = /<filter id="(kg[a-z0-9]+_hair)"/.exec(defs)[1];
    assert.ok(defs.includes(svgFilter(fid, f.colors[0], SIZE)), label + ' 머리 필터 = 같은 표'); assert.doesNotMatch(defs, /flood-color|multiply/);
    // 마스크 종류: 지우기(inv) 마스크 수 = erase 수, 밑단(keep) = hem 수
    const kinds = [...defs.matchAll(/<mask id="kg[a-z0-9]+_(\w+)"[^>]*><image [^>]*filter="url\(#kg[a-z0-9]+_(inv|keep)\)"/g)].map((m) => m[2]);
    const want = []; const walk = (ops) => { for (const op of ops) { if (op.kind === 'layer') walk(op.ops); if (op.kind === 'erase') want.push('inv'); if (op.kind === 'hem') want.push('keep'); } }; walk(plan.ops);
    assert.deepEqual(kinds, want, label + ' 마스크 종류');
    // 볼 발그레(타원 자리) · 둥실 하트(길·색)
    const blush = /<g data-step="exp-blush">(.*?)<\/g>/.exec(body)?.[1];
    const pb = plan.ops.find((o) => o.kind === 'blush');
    assert.equal(Boolean(blush), Boolean(pb), label + ' 볼');
    if (pb) assert.deepEqual(pb.spots, [...blush.matchAll(/<ellipse cx="([\d.]+)" cy="([\d.]+)" rx="(\d+)" ry="(\d+)"/g)].map((m) => ({ cx: +m[1], cy: +m[2], rx: +m[3], ry: +m[4] })));
    const hearts = /<g data-step="exp-floating-hearts">(.*?)<\/g>/.exec(body)?.[1];
    const ph = plan.ops.find((o) => o.kind === 'hearts');
    assert.equal(Boolean(hearts), Boolean(ph), label + ' 하트');
    if (ph) assert.deepEqual(ph.hearts, [...hearts.matchAll(/<path d="([^"]+)" fill="([^"]+)" stroke="#FFFFFF" stroke-width="2"\/>/g)].map((m) => ({ d: m[1], fill: m[2] })));
    // 표정 겹치기의 SVG 안 차례: 볼은 입 다음·앞머리 앞, 하트는 맨 끝
    const steps = planSteps(plan);
    if (pb) assert.equal(steps.indexOf('exp-blush'), steps.indexOf('mouth') + 1);
    if (ph) assert.equal(steps.at(-1), 'exp-floating-hearts');
  });
});

test('그림 주소: 사이트 BASE 아래, 화면 SVG(characterMarkup)가 받는 주소와 같은 글(이미 받아 둔 그림을 그대로 쓴다)', async () => {
  const c = await catalog();
  for (const dj of DJS) for (const worn of WORN) {
    const ex = expressionFor(c, 's1', 10);
    const urls = planUrls(characterPlan(dj, { worn }, ex), B);
    const page = svgUrls(characterMarkup(c, dj, worn, 10, { seasonId: 's1', base: B, stage: null }));
    assert.deepEqual([...urls].sort(), [...page].sort(), JSON.stringify(worn));
    for (const u of urls) assert.match(u, /^\/jun-live-fanpage\/kiugi\/v5\/[a-z0-9_]+\.png\?v=[0-9a-f]{12}$/);
  }
  assert.equal(artUrl({ file: 'female_body.png', v: '0123456789ab' }, '/'), '/kiugi/v5/female_body.png?v=0123456789ab');
  assert.equal(artUrl({ file: 'female_body.png', v: '0123456789ab' }, '/x'), '/x/kiugi/v5/female_body.png?v=0123456789ab');
  // 배경은 맨 앞(잘라 채우기로 따로 그린다)
  const withBg = characterPlan(DJS[0], { worn: WORN[1] }, null);
  assert.equal(withBg.background.id, 'background_01');
  assert.match(planUrls(withBg, B)[0], /background_01\.png/);
  assert.equal(characterPlan(DJS[0], { worn: WORN[2] }, null).background, null);
});

test('캔버스에 그리기(paintPlan): 머리색 = 물들인 1024 머리 캔버스(tone-map-v1)를 그대로, 지우기 마스크 = destination-out, 밑단 = destination-in, 몸 칸은 따로 그려 한 번에', () => {
  const log = [];
  const fake = (name) => ({
    name, canvas: { name }, globalCompositeOperation: 'source-over',
    set fillStyle(v) { log.push([name, 'fillStyle', typeof v === 'string' ? v : 'gradient']); }, get fillStyle() { return null; },
    save() { log.push([name, 'save']); }, restore() { log.push([name, 'restore']); this.globalCompositeOperation = 'source-over'; },
    setTransform(...a) { log.push([name, 'setTransform', a.join(',')]); }, translate() {}, scale() {},
    drawImage(im, ...a) { log.push([name, 'draw', im.name || im, this.globalCompositeOperation, a.join(',')]); },
    fillRect() { log.push([name, 'fillRect', this.globalCompositeOperation]); },
    createRadialGradient() { return { addColorStop() {} }; }, beginPath() {}, arc() {}, fill() { log.push([name, 'fill']); }, stroke() { log.push([name, 'stroke', this.miterLimit]); },
  });
  let n = 0;
  globalThis.Path2D ??= class { constructor(d) { this.d = d; } };
  const plan = characterPlan(DJS[1], { worn: WORN[5] }, EXPR[1]);
  const root = fake('root');
  const tints = [];
  paintPlan(root, plan.ops, { get: (m) => m.file, layer: () => fake('L' + (++n)), tint: (m, color) => { tints.push([m.file, color]); return `T:${m.file}:${color}`; } });
  const draws = log.filter((x) => x[1] === 'draw');
  // 뒷머리·앞머리: 물들인 머리 캔버스(tint)를 바탕에 1024 그대로 한 번 — 곱하기·자르기를 다시 하지 않는다
  assert.deepEqual(tints, [['male_hair_05_back.png', 'brown'], ['male_hair_05_front.png', 'brown']], '앞·뒷머리 같은 색');
  for (const hair of ['male_hair_05_back.png', 'male_hair_05_front.png']) assert.deepEqual(draws.find((x) => x[2] === `T:${hair}:brown`), ['root', 'draw', `T:${hair}:brown`, 'source-over', `0,0,${SIZE},${SIZE}`]);
  assert.ok(!draws.some((x) => x[2] === 'male_hair_05_back.png' || x[2] === 'male_hair_05_front.png'), '회색 머리를 그대로 그리지 않는다');
  assert.ok(!log.some((x) => x[1] === 'fillRect' && x[2] === 'multiply'), '예전 곱하기 없음');
  assert.ok(draws.findIndex((x) => x[2] === 'T:male_hair_05_back.png:brown') < draws.findIndex((x) => x[0] === 'root' && /^L/.test(x[2])), '뒷머리는 몸 칸보다 먼저');
  // 몸 칸: 몸 → 하의 지우기(destination-out) → 하의 → 상의 지우기 → 상의 → 신발 지우기 → 신발 → 밑단(하의를 마스크로 잘라 다시)
  const body = draws.find((x) => x[2] === 'male_body.png')[0];
  const inBody = draws.filter((x) => x[0] === body).map((x) => [x[2], x[3]]);
  assert.deepEqual(inBody, [
    ['male_body.png', 'source-over'], ['bottom_05_male_cut.png', 'destination-out'], ['bottom_05_male.png', 'source-over'],
    ['top_03_male_cut.png', 'destination-out'], ['top_03_male.png', 'source-over'], ['shoe2_01_male_cut.png', 'destination-out'], ['shoe2_01_male.png', 'source-over'],
    [draws.find((x) => x[2] === 'bottom_05_male_hem.png')[0], 'source-over'],
  ]);
  const hem = draws.filter((x) => x[0] === inBody.at(-1)[0]).map((x) => [x[2], x[3]]);
  assert.deepEqual(hem, [['bottom_05_male.png', 'source-over'], ['bottom_05_male_hem.png', 'destination-in']]);
  // 바탕에 올릴 때는 변환 없이(같은 크기·같은 변환의 캔버스라 그대로 겹친다)
  assert.ok(log.some((x) => x[0] === 'root' && x[1] === 'setTransform' && x[2] === '1,0,0,1,0,0'));
  // 둥실 하트 테두리는 SVG 기본 miterlimit(4)
  assert.ok(log.some((x) => x[0] === 'root' && x[1] === 'stroke' && x[2] === 4));
  // 모든 그림은 1024 캔버스 전체 크기로
  for (const d of draws.filter((x) => x[0] !== 'root' || !String(x[2]).startsWith('L'))) if (String(d[2]).endsWith('.png')) assert.equal(d[4], `0,0,${SIZE},${SIZE}`);
});

test('머리 물들이기(tintedHair): 1024 캔버스에 그려 픽셀을 읽고 패키지 recolor(RGB 만 표로·알파 그대로) → putImageData · packageId·판·그림 해시·색으로 몇 장만 기억', () => {
  const made = [];
  const px = new Uint8ClampedArray([160, 160, 160, 255, 160, 160, 160, 40, 0, 0, 0, 0, 90, 90, 90, 128]);
  const doc = { createElement: () => { const c = { width: 0, height: 0, puts: [], draws: [] }; c.getContext = () => ({ drawImage: (im, ...a) => c.draws.push([im, a.join(',')]), getImageData: () => ({ data: new Uint8ClampedArray(px) }), putImageData: (d, x, y) => c.puts.push([[...d.data], x, y]) }); made.push(c); return c; } };
  const cache = new Map(), asset = { id: 'female_hair_09_back', v: '0123456789ab', file: 'female_hair_09_back.png' };
  const c = tintedHair(doc, 'IMG', asset, 'blond', cache);
  assert.deepEqual([c.width, c.height], [SIZE, SIZE]); assert.deepEqual(c.draws, [['IMG', `0,0,${SIZE},${SIZE}`]]);
  assert.deepEqual(c.puts, [[[...recolor(px, 'blond')], 0, 0]]);
  const out = c.puts[0][0];
  assert.deepEqual(out.slice(0, 8), [232, 200, 122, 255, 232, 200, 122, 40], '회색 160 = 금발 대표색 #E8C87A, 반투명 가장자리도 같은 색 · 알파 그대로');
  assert.deepEqual(out.slice(8, 12), [0, 0, 0, 0], '투명은 그대로'); assert.equal(out[15], 128);
  assert.equal(tintedHair(doc, 'IMG', asset, 'blond', cache), c, '같은 머리·같은 색은 다시 만들지 않는다');
  assert.equal(tintKey(asset, 'blond'), `${ART.packageId}:tone-map-v1:female_hair_09_back:0123456789ab:blond`); assert.equal(hairColor.VERSION, 'tone-map-v1');
  for (const k of ['black', 'pink', 'sky', 'silver']) tintedHair(doc, 'IMG', asset, k, cache);
  assert.equal(cache.size, TINT_CACHE_MAX); assert.equal(c.width, 0, '오래된 것부터 비운다(캔버스 메모리 돌려주기)');
  assert.deepEqual(Object.keys(PALETTE), ['black', 'brown', 'light', 'blond', 'pink', 'purple', 'sky', 'silver']);
  const save = readFileSync(new URL('../docs/lib/kiugi-save.js', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(save, /multiply|tintColor|HAIR_COLORS/, '예전 곱하기 없음');
});

test('배치(1080×1350): 배경은 잘라 채우기, 캐릭터(날개·오라·왕관·둥실 하트 포함)는 그림 안·아래 띠 위, 글 줄은 띠 안에 차례로', () => {
  assert.equal(SAVE_W, 1080); assert.equal(SAVE_H, 1350); assert.equal(ART.size, SIZE);
  assert.deepEqual(coverRect(1024, 1024), { x: -135, y: 0, w: 1350, h: 1350 });
  assert.deepEqual(coverRect(1600, 900, 1080, 1350), { x: -660, y: 0, w: 2400, h: 1350 });
  const L = SAVE_LAYOUT, c = L.char;
  const boxes = ART.assets.filter((a) => a.category !== 'background').map((a) => a.box);
  const heartsTop = Math.min(...characterPlan(DJS[0], { worn: {} }, EXPR[1]).ops.find((o) => o.kind === 'hearts').hearts.map((x) => Number(/^M[\d.]+ ([\d.]+)/.exec(x.d)[1]) - 30));
  const top = Math.min(heartsTop, ...boxes.map((b) => b[1])), bottom = Math.max(...boxes.map((b) => b[3]));
  const left = Math.min(...boxes.map((b) => b[0])), right = Math.max(...boxes.map((b) => b[2]));
  assert.ok(c.y + top * c.s >= 30, `캐릭터 위 끝 ${c.y + top * c.s}`);
  assert.ok(c.y + bottom * c.s < L.band.y, `발끝 ${c.y + bottom * c.s} < 띠 ${L.band.y}`);
  assert.ok(c.x + left * c.s >= 0 && c.x + right * c.s <= SAVE_W, '날개까지 가로 안');
  assert.ok(Math.abs(c.x + (SIZE / 2) * c.s - SAVE_W / 2) <= 1, '가운데');
  assert.ok(L.band.y < L.id.y && L.id.y < L.sub.y && L.sub.y < L.rule.y && L.rule.y < L.mark.y && L.mark.y < SAVE_H - 20);
  assert.ok(L.fade.from < L.fade.to && L.fade.to <= L.band.y);
  assert.ok(L.shadow.cy > c.y + 900 * c.s && L.shadow.cy < L.band.y);
});

test('글: 아이디(앞 · #이름), "Lv.N · 시즌", 파일 이름, 사이트 표시', () => {
  assert.deepEqual(labelParts('밤톨#먼치'), { head: '밤톨', tag: '#먼치' });
  assert.deepEqual(labelParts('사탕요정'), { head: '사탕요정', tag: '' });
  assert.deepEqual(labelParts(null), { head: '', tag: '' });
  assert.deepEqual(levelParts(10, '할로윈'), { lv: 'Lv.10', season: '할로윈 시즌' });
  assert.equal(levelText(3, '할로윈'), 'Lv.3 · 할로윈 시즌');
  assert.equal(levelText(3, '겨울 시즌'), 'Lv.3 · 겨울 시즌', '이름에 "시즌"이 있으면 두 번 쓰지 않는다');
  assert.equal(levelText(undefined, ''), 'Lv.1');
  assert.equal(levelText('7.9', null), 'Lv.7');
  assert.equal(saveFileName('밤톨#먼치'), '키우기-밤톨-먼치.png');
  assert.equal(saveFileName('달무리#Cookie7'), '키우기-달무리-Cookie7.png');
  assert.equal(saveFileName('밤 톨#먼/치?<>'), '키우기-밤톨-먼치.png', '띄어쓰기·파일 이름에 못 쓰는 글자는 뺀다');
  assert.equal(saveFileName('밤톨#먼치'.normalize('NFD')), '키우기-밤톨-먼치.png', '풀어 쓴 한글도 모아서');
  assert.equal(saveFileName(''), '키우기-캐릭터.png');
  assert.equal(saveFileName('../..'), '키우기-캐릭터.png');
  assert.equal(SITE_MARK, '스푼 DJ 키우기'); assert.equal(SITE_DOMAIN, '키우기.com'); assert.equal(UNOFFICIAL_MARK, '비공식 팬 사이트');
  assert.equal(SAVE_LABEL, '저장하기');
});

test('저장 방법: PC·안드로이드는 바로 내려받기, 바로 내려받을 수 없는 아이폰·아이패드·앱 안 브라우저는 파일 공유 창(안 되면 그림 보여 주기)', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
  const android = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
  const kakaoAndroid = 'Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36 KAKAOTALK 10.8.0';
  const kakaoIphone = iphone + ' KAKAOTALK 10.8.0';
  const pc = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
  assert.equal(saveMode({ ua: iphone, canShareFiles: true }), 'share');
  assert.equal(saveMode({ ua: iphone, canShareFiles: false }), 'preview');
  assert.equal(saveMode({ ua: ipad, touchPoints: 5, canShareFiles: true }), 'share', '데스크톱 모습의 아이패드');
  assert.equal(saveMode({ ua: ipad, touchPoints: 0, canShareFiles: true }), 'download', '맥 PC 는 내려받기');
  assert.equal(saveMode({ ua: kakaoIphone, canShareFiles: true }), 'share');
  assert.equal(saveMode({ ua: kakaoIphone, canShareFiles: false }), 'preview');
  assert.equal(saveMode({ ua: android, canShareFiles: true }), 'download', '공유가 되어도 바로 내려받기(갤러리 다운로드 앨범) — 따로 "공유"는 없다');
  assert.equal(saveMode({ ua: kakaoAndroid, canShareFiles: false }), 'preview', '앱 안 브라우저는 내려받기가 잘 안 된다');
  assert.equal(saveMode({ ua: kakaoAndroid, canShareFiles: true }), 'share');
  assert.equal(saveMode({ ua: pc, canShareFiles: true }), 'download');
  assert.equal(saveMode(), 'download');
});

test('캐릭터 페이지: 캐릭터 그림 바로 아래 따로 있는 "저장하기" 단추(하트·링크 복사 줄은 그대로), 모양은 styles.css, 그리기·저장 함수가 있다', async () => {
  const src = await readFile(new URL('../docs/views/character.js', import.meta.url), 'utf8');
  assert.match(src, /import \{ saveCharacterImage, SAVE_LABEL, SAVE_BUSY, SAVE_FAILED \} from '\.\.\/lib\/kiugi-save\.js'/);
  assert.match(src, /kind: 'hero' \}\),\s*saveBtn \? h\('div', \{ class: 'kg-save-row' \}, saveBtn\) : null\),/, '그림 칸(kg-hero-art) 안, 그림 바로 아래');
  assert.match(src, /h\('div', \{ class: 'kg-heart-row' \}, heartBtn,\s*h\('button', \{ type: 'button', class: 'btn btn-line kg-copy-btn', onclick: \(\) => copyLink\(url, copyBox\) \}, icon\('link', \{ size: 18 \}\), '링크 복사'\)\),/, '하트·링크 복사 줄은 예전 그대로(저장 단추를 섞지 않는다)');
  assert.match(src, /expression: look, seasonName: data\.season\?\.name \|\| '', hearts/, '화면과 같은 표정·시즌·지금 하트 수');
  const { saveButton } = await import('../docs/views/character.js');
  assert.equal(typeof saveButton, 'function');
  const css = await readFile(new URL('../docs/styles.css', import.meta.url), 'utf8');
  for (const cls of ['kg-save-row', 'kg-save-btn', 'kg-save-sheet', 'kg-save-card', 'kg-save-img', 'kg-save-actions']) assert.match(css, new RegExp(`\\.${cls}[\\s{.:,\\[]`), cls);
  assert.doesNotMatch(css, /has-save|kg-btn-label/, '아래에 붙은 하트 줄에 저장 그림 단추를 넣지 않는다');
  for (const fn of [renderSaveImage, saveCharacterImage, canvasBlob]) assert.equal(typeof fn, 'function');
  const save = await readFile(new URL('../docs/lib/kiugi-save.js', import.meta.url), 'utf8');
  assert.doesNotMatch(save, /innerHTML|crossOrigin/, '글은 textContent 로만, 그림은 같은 출처');
  // 화면 보안 규칙(CSP)은 그대로: 그림은 같은 출처(self)와 data:(그림 창) — blob: 그림은 쓰지 않는다
  const index = await readFile(new URL('../docs/index.html', import.meta.url), 'utf8');
  assert.match(index, /img-src 'self' data:;/);
  assert.doesNotMatch(save, /src: URL\.createObjectURL|\.src = URL\.createObjectURL/);
});
