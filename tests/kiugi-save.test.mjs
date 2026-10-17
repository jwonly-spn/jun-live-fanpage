// 캐릭터 이미지로 저장(lib/kiugi-save.js): 캔버스에 그릴 차례가 화면 그림(kiugi-art.js characterSvg·layersOf)과 같은지, 배치·글·파일 이름·저장 방법.
// 새 그림체 R7(2026-10-18): 그리는 규칙은 패키지 renderer.js(캔버스) 그대로 — 실제 브라우저에서 renderer.js 와 픽셀로 견준 것은 시험 밖(숨은 Electron)에서 한다.
// 아이디는 모두 지어낸 것(밤톨·사탕요정·달무리, 캐릭터 이름 먼치·쿠키).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { characterSvg, layersOf, svgUrls, hairColorOf, SIZE } from '../docs/kiugi/kiugi-art.js';
import hairColor, { recolor, table, PALETTE } from '../docs/kiugi/kiugi-hair-color.js';
import { ART } from '../docs/kiugi/kiugi-r7-data.js';
import { buildCatalog, characterMarkup, expressionFor } from '../docs/lib/kiugi-draw.js';
import {
  characterPlan, planSteps, planUrls, artUrl, paintPlan, tintedHair, tintKey, TINT_CACHE_MAX, coverRect, labelParts, levelParts, levelText, saveFileName, saveMode,
  SAVE_W, SAVE_H, SAVE_LAYOUT, SITE_MARK, SITE_DOMAIN, UNOFFICIAL_MARK, SAVE_LABEL, renderSaveImage, saveCharacterImage, canvasBlob, alphaBox, placeCharacter, characterCanvas,
} from '../docs/lib/kiugi-save.js';

const B = '/jun-live-fanpage/';
const read = async (p) => JSON.parse(await readFile(new URL('../docs/kiugi/' + p, import.meta.url), 'utf8'));
const catalog = async () => { const m = await read('manifest.json'); return buildCatalog(await Promise.all(m.seasons.map(read)), { files: m.files, adjust: {} }); };

// 지어낸 DJ 캐릭터와 입은 옷 묶음(체험 모드 옷 묶음 + 마스크·밑단·신발 목 자르기·모자·악세사리 자리가 걸리는 것)
const DJS = [
  { name: '먼치', gender: 'f', hair: '9', hairColor: 'pink', eyes: '2', nose: '1', mouth: '2' },
  { name: '쿠키', gender: 'm', hair: '5', hairColor: 'brown', eyes: '5', nose: '5', mouth: '8' }, // 예전 그림의 눈·코·입 번호 → 1번
  { name: '젤리', gender: 'f', hair: 'f_twin', hairColor: 'sky', skin: 's1', eyes: 'happy', nose: 'dot', mouth: 'cat' }, // 예전(V2) 값
  {},
];
const WORN = [
  {},
  { top: 'top_05', bottom: 'bottom_03', shoes: 'shoe_04', face: 'accessory_02', bg: 'background_01', hat: 'hat_09' }, // 밑단 하의 + 신발(신발 목 자르기) + 모자 + 얼굴 장식
  { outfit: 'outfit_03', shoes: 'shoe_06', neck: 'accessory_16' }, // 한벌옷 밑단
  { top: 'top_06', bottom: 'bottom_09', shoes: 'shoe_03', head: 'accessory_06', hand: 'accessory_09', bg: 'background_05' },
  { outfit: 'outfit_05', shoes: 'shoe_17', hat: 'hat_16', head: 'accessory_17' }, // 롱부츠 · 마녀 모자 + 머리 장식(함께 보인다)
  { top: 'top_03', bottom: 'bottom_05', shoes: 'shoe_01', face: 'accessory_10' }, // 하의 05 는 밑단이 있다
  { top: 'top_01', bottom: 'bottom_01', shoes: 'shoe_08', neck: 'accessory_07' },
  { outfit: 'outfit_21', top: 'top_25', shoes: 'shoe2_03', head: 'acc2_01', crown: 'acc2_11', wings: 'acc2_12', bg: 'halloween-night' }, // 예전 그림(V5)·V2 id → 그리지 않는다
  { hat: 'hat_06' }, // 모자 → 둥실 하트가 옆으로
  { top: 'top_17', bottom: 'bottom_19', shoes: 'shoe_15', face: 'accessory_12' },
  { top: 'top_11', bottom: 'bottom_02', bg: 'background_02' }, // 신발 없이 밑단(신발 목 자르기 없음)
  { top: 'top_02', bottom: 'bottom_20', shoes: 'shoe_18', hat: 'hat_12', head: 'accessory_06', face: 'accessory_02', neck: 'accessory_01', hand: 'accessory_05' }, // 악세사리 네 자리 + 모자
  { head: 'accessory_01', hat: 'accessory_02', neck: 'hat_03' }, // 칸과 맞지 않는 옷 → 그리지 않는다
];
const EXPR = [{ level: 1, parts: [] }, { level: 7, parts: ['eyes:smile', 'mouth:smile', 'exp-blush', 'exp-floating-hearts'] }, { level: 9, parts: ['eyes:cry', 'mouth:smile'] }];
const each = (fn) => { for (const dj of DJS) for (const worn of WORN) for (const ex of EXPR) fn(dj, { worn }, ex); };

const path = (m) => `${m.dir || ART.dir}${m.file}?v=${m.v}`;
// 계획을 SVG 와 같은 모양으로 펴기: 보이는 그림(차례대로 — 마스크 안 그림은 빼고) · 마스크에 쓰는 그림(겹치지 않게) · 머리색
function flat(plan) {
  const images = [], masks = new Set(), colors = new Set();
  if (plan.background) images.push(path(plan.background));
  const maskWalk = (ops) => { for (const op of ops) { if (op.ops) maskWalk(op.ops); if (op.src) masks.add(path(op.src)); if (op.mask) masks.add(path(op.mask)); } };
  const walk = (ops) => {
    for (const op of ops) {
      if (op.kind === 'layer') walk(op.ops);
      else if (op.kind === 'erase') { if (op.ops) maskWalk(op.ops); else masks.add(path(op.mask)); }
      else if (op.kind === 'hem') { masks.add(path(op.mask)); images.push(path(op.src)); }
      else if (op.src) { images.push(path(op.src)); if (op.kind === 'tint') colors.add(op.color); }
    }
  };
  walk(plan.ops);
  return { images, masks: [...masks].sort(), colors: [...colors] };
}
// layersOf 에 없는 단계(표정 겹치기 · 모자에 잘린 앞머리 · 악세사리를 앞머리로 지우기)를 뺀 차례
const comparable = (steps) => steps.filter((s) => !s.startsWith('exp-') && s !== 'hair.front.hat' && !s.endsWith('.clip'));

test('그릴 차례 = 화면 그림의 차례(layersOf): 뒷머리(모자로 자름) → 몸 칸(지우기·기본 운동화·옷·신발 목 자르기·밑단) → 눈·코·입 → 앞머리 → 악세사리(목·손·얼굴·머리) → 모자', () => {
  let n = 0;
  each((dj, look, ex) => {
    const plan = characterPlan(dj, look, ex);
    assert.deepEqual(comparable(planSteps(plan)), layersOf(dj, look, { expression: ex }).map((x) => x.step), JSON.stringify(look.worn));
    n++;
  });
  assert.ok(n >= 150);
  // 몸 칸은 한 묶음(뒷머리를 지우지 않게): 남자 하의 05(밑단·신발 목 자르기) + 상의 03 + 신발 01
  const plan = characterPlan(DJS[1], { worn: WORN[5] }, null);
  const body = plan.ops.find((o) => o.step === 'dressed');
  assert.deepEqual(body.ops.map((o) => [o.step, o.kind, o.ops ? 'ops' : o.mask?.file || o.src?.file]), [
    ['body', 'image', 'male_body.png'],
    ['body.cut', 'erase', 'bottom_05_male_cut.png'], ['body.cut', 'erase', 'top_03_male_cut.png'],
    ['body.cut', 'erase', 'ops'], // 신발의 몸 지우기는 신발 목 자르기만큼 덜 지운다
    ['body.feet', 'erase', 'male_body_feet.png'], // 기본 운동화 지우기(신발 + 밑단)
    ['bottom', 'image', 'bottom_05_male.png'], ['top', 'image', 'top_03_male.png'],
    ['shoe', 'layer', 'ops'], ['bottom.hem', 'hem', 'bottom_05_male_hem.png'],
  ]);
  assert.equal(body.ops[8].src.file, 'bottom_05_male.png', '밑단 = 그 하의를 밑단 마스크 안만 다시');
  assert.deepEqual(body.ops[3].ops.map((o) => [o.kind, o.src?.file || o.mask?.file]), [['image', 'shoe_01_male_cut.png'], ['erase', 'bottom_05_male_shaft.png']]);
  assert.deepEqual(body.ops[7].ops.map((o) => [o.kind, o.src?.file || o.mask?.file]), [['image', 'shoe_01_male.png'], ['erase', 'bottom_05_male_shaft.png']]);
  assert.equal(body.ops[8].mask.file, 'bottom_05_male_hem.png');
  assert.equal(plan.ops.findIndex((o) => o.step === 'hair.back') < plan.ops.indexOf(body), true);
  // 신발이 없으면 밑단만(신발 목 자르기·기본 운동화 지우기 없음)
  const noShoe = planSteps(characterPlan(DJS[0], { worn: WORN[10] }, null));
  assert.ok(noShoe.includes('bottom.hem') && !noShoe.includes('shoe.shaft') && !noShoe.includes('body.feet'));
  // 모자: 앞·뒷머리를 모자의 머리 지우기로 자르고, 악세사리는 (모자에 잘린) 앞머리 모양으로 지운다. 모자와 머리 장식은 함께 그린다. 모자는 맨 위.
  const hat = characterPlan(DJS[0], { worn: WORN[4] }, null), hs = planSteps(hat);
  assert.deepEqual(hs.slice(0, 2), ['hair.back', 'hair.back.hat']);
  assert.ok(hs.includes('hair.front.hat') && hs.includes('accessory.head') && hs.includes('accessory.head.clip') && hs.at(-1) === 'hat');
  const clip = hat.ops.find((o) => o.step === 'accessory.head').ops.find((o) => o.step === 'accessory.head.clip');
  assert.deepEqual(clip.ops.map((o) => o.src?.file || o.mask?.file), ['female_hair_09_front.png', 'hat_16_female_hair.png']);
  // 악세사리 차례: 목 → 손 → 얼굴 → 머리, 모두 앞머리로 지운다
  assert.deepEqual(planSteps(characterPlan(DJS[0], { worn: WORN[11] }, null)).filter((s) => s.startsWith('accessory.')),
    ['accessory.neck', 'accessory.neck.clip', 'accessory.hand', 'accessory.hand.clip', 'accessory.face', 'accessory.face.clip', 'accessory.head', 'accessory.head.clip']);
  // 예전 그림의 옷·예전 배경·칸과 맞지 않는 옷은 그리지 않는다
  for (const w of [WORN[7], WORN[12]]) assert.deepEqual(planSteps(characterPlan(DJS[0], { worn: w }, null)), planSteps(characterPlan(DJS[0], { worn: {} }, null)), JSON.stringify(w));
  // 남자 몸 버전 그림 · 예전 눈·코·입 번호는 1번
  const male = planUrls(characterPlan(DJS[1], { worn: { hat: 'hat_09', neck: 'accessory_01' } }, null), B);
  assert.ok(male.some((u) => /\/hat_09_male\.png\?/.test(u)) && male.some((u) => /\/accessory_01_male\.png\?/.test(u)));
  assert.ok(male.some((u) => /\/male_eyes_01\.png\?/.test(u)) && male.some((u) => /\/male_mouth_01\.png\?/.test(u)), '예전 번호(5·8)는 1번');
  // 레벨 표정: 웃는 눈·눈물 눈·웃는 입은 그림의 표정 판
  const smile = planUrls(characterPlan(DJS[0], { worn: {} }, EXPR[1]), B), cry = planUrls(characterPlan(DJS[0], { worn: {} }, EXPR[2]), B);
  assert.ok(smile.some((u) => /female_eyes_02_smile\.png/.test(u)) && smile.some((u) => /female_mouth_02_smile\.png/.test(u)));
  assert.ok(cry.some((u) => /female_eyes_02_cry\.png/.test(u)) && cry.some((u) => /female_mouth_02_smile\.png/.test(u)));
});

test('같은 그림 파일·마스크·머리색·표정 겹치기: characterSvg 가 만든 SVG 글과 하나하나 같다', () => {
  each((dj, look, ex) => {
    const plan = characterPlan(dj, look, ex), f = flat(plan);
    const svg = characterSvg(dj, look, { expression: ex, transparent: true });
    const [defs, body] = svg.split('</defs>');
    const label = JSON.stringify([dj.name, look.worn, ex.level]);
    // 보이는 그림(마스크 밖, 그리는 차례) · 마스크에 쓰는 그림(defs 안 — 앞머리는 악세사리 지우기에 다시 쓴다)
    assert.deepEqual(f.images, [...body.matchAll(/<image href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&')), label + ' 보이는 그림 차례');
    assert.deepEqual(f.masks, [...new Set([...defs.matchAll(/<image href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&')))].sort(), label + ' 마스크 그림');
    // 머리색: 계획의 색(팔레트 열쇠) = DJ 캐릭터 머리색, SVG 머리 필터 표 = 같은 색의 table(tone-map-v1 — 캔버스 recolor 와 같은 표)
    assert.deepEqual(f.colors, [hairColorOf(dj)], label + ' 머리색');
    const R = /<feFuncR type="table" tableValues="([^"]+)"/.exec(defs)[1].split(' ').map(Number);
    assert.deepEqual(R.map((v) => Math.round(v * 255)), table(f.colors[0]).map((v) => v[0]), label + ' 머리 필터 = 같은 표'); assert.doesNotMatch(defs, /flood-color|multiply/);
    // 볼 발그레(타원 자리·크기) · 둥실 하트(길·색·테두리 두께)
    const blush = /<g data-step="exp-blush">(.*?)<\/g>/.exec(body)?.[1];
    const pb = plan.ops.find((o) => o.kind === 'blush');
    assert.equal(Boolean(blush), Boolean(pb), label + ' 볼');
    if (pb) assert.deepEqual(pb.spots, [...blush.matchAll(/<ellipse cx="([\d.]+)" cy="([\d.]+)" rx="([\d.]+)" ry="([\d.]+)"/g)].map((m) => ({ cx: +m[1], cy: +m[2], rx: +m[3], ry: +m[4] })));
    const hearts = /<g data-step="exp-floating-hearts">(.*?)<\/g>/.exec(body)?.[1];
    const ph = plan.ops.find((o) => o.kind === 'hearts');
    assert.equal(Boolean(hearts), Boolean(ph), label + ' 하트');
    if (ph) {
      const got = [...hearts.matchAll(/<path d="([^"]+)" fill="([^"]+)" stroke="#FFFFFF" stroke-width="([\d.]+)"\/>/g)];
      assert.deepEqual(ph.hearts, got.map((m) => ({ d: m[1], fill: m[2] })));
      for (const m of got) assert.equal(Number(m[3]), ph.width);
    }
    // 표정 겹치기의 차례: 볼은 입 다음·앞머리 앞, 하트는 맨 끝
    const steps = planSteps(plan);
    if (pb) assert.equal(steps.indexOf('exp-blush'), steps.indexOf('mouth') + 1);
    if (ph) assert.equal(steps.at(-1), 'exp-floating-hearts');
  });
});

test('그림 주소: 사이트 BASE 아래(공통 배경은 kiugi/bg/), 화면 SVG(characterMarkup)가 받는 주소와 같은 글(이미 받아 둔 그림을 그대로 쓴다)', async () => {
  const c = await catalog();
  for (const dj of DJS) for (const worn of WORN) {
    const ex = expressionFor(c, 's1', 10);
    const urls = planUrls(characterPlan(dj, { worn }, ex), B);
    const page = svgUrls(characterMarkup(c, dj, worn, 10, { seasonId: 's1', base: B, stage: null }));
    assert.deepEqual([...urls].sort(), [...page].sort(), JSON.stringify(worn));
    for (const u of urls) assert.match(u, /^\/jun-live-fanpage\/kiugi\/(r7|bg)\/[a-z0-9_]+\.png\?v=[0-9a-f]{12}$/);
  }
  assert.equal(artUrl({ file: 'female_body.png', v: '0123456789ab' }, '/'), '/kiugi/r7/female_body.png?v=0123456789ab');
  assert.equal(artUrl({ file: 'female_body.png', v: '0123456789ab' }, '/x'), '/x/kiugi/r7/female_body.png?v=0123456789ab');
  assert.equal(artUrl({ file: 'background_03.png', dir: '/kiugi/bg/', v: '0123456789ab' }, B), '/jun-live-fanpage/kiugi/bg/background_03.png?v=0123456789ab');
  // 배경은 맨 앞(잘라 채우기로 따로 그린다)
  const withBg = characterPlan(DJS[0], { worn: WORN[1] }, null);
  assert.equal(withBg.background.id, 'background_01');
  assert.match(planUrls(withBg, B)[0], /\/kiugi\/bg\/background_01\.png/);
  assert.equal(characterPlan(DJS[0], { worn: WORN[2] }, null).background, null);
});

test('캔버스에 그리기(paintPlan): 머리색 = 물들인 1024 머리 캔버스(tone-map-v1)를 그대로, 지우기 = destination-out(겹친 마스크는 따로 그린 칸으로), 밑단 = destination-in, 다 쓴 칸은 돌려준다', () => {
  const log = [];
  const fake = (name) => ({
    name, canvas: { name }, globalCompositeOperation: 'source-over',
    set fillStyle(v) { log.push([name, 'fillStyle', typeof v === 'string' ? v : 'gradient']); }, get fillStyle() { return null; },
    set lineWidth(v) { log.push([name, 'lineWidth', v]); }, get lineWidth() { return 1; },
    save() { log.push([name, 'save']); }, restore() { log.push([name, 'restore']); this.globalCompositeOperation = 'source-over'; },
    setTransform(...a) { log.push([name, 'setTransform', a.join(',')]); }, translate() {}, scale() {},
    drawImage(im, ...a) { log.push([name, 'draw', im.name || im, this.globalCompositeOperation, a.join(',')]); },
    fillRect() { log.push([name, 'fillRect', this.globalCompositeOperation]); },
    createRadialGradient() { return { addColorStop() {} }; }, beginPath() {}, arc() {}, fill() { log.push([name, 'fill']); }, stroke() { log.push([name, 'stroke', this.miterLimit]); },
  });
  let n = 0;
  globalThis.Path2D ??= class { constructor(d) { this.d = d; } };
  const plan = characterPlan(DJS[1], { worn: WORN[5] }, EXPR[1]);
  const root = fake('root'), done = [];
  const tints = [];
  paintPlan(root, plan.ops, { get: (m) => m.file, layer: () => fake('L' + (++n)), tint: (m, color) => { tints.push([m.file, color]); return `T:${m.file}:${color}`; }, done: (t) => done.push(t.name) });
  const draws = log.filter((x) => x[1] === 'draw');
  // 뒷머리·앞머리(모자 없음): 물들인 머리 캔버스(tint)를 바탕에 1024 그대로 한 번
  assert.deepEqual(tints, [['male_hair_05_back.png', 'brown'], ['male_hair_05_front.png', 'brown']], '앞·뒷머리 같은 색');
  for (const hair of ['male_hair_05_back.png', 'male_hair_05_front.png']) assert.deepEqual(draws.find((x) => x[2] === `T:${hair}:brown`), ['root', 'draw', `T:${hair}:brown`, 'source-over', `0,0,${SIZE},${SIZE}`]);
  assert.ok(!draws.some((x) => x[0] === 'root' && (x[2] === 'male_hair_05_back.png' || x[2] === 'male_hair_05_front.png')), '머리 그림을 물들이지 않고 바탕에 그리지 않는다');
  assert.equal(draws.filter((x) => x[2] === 'male_hair_05_front.png').length, 1, '물들이지 않은 앞머리는 악세사리를 지울 모양 칸에만(알파만 쓴다)');
  assert.ok(!log.some((x) => x[1] === 'fillRect' && x[2] === 'multiply'), '예전 곱하기 없음');
  // 몸 칸: 몸 → 지우기(하의·상의) → 신발 지우기(신발 목만큼 덜 — 따로 그린 칸) → 기본 운동화 지우기 → 하의 → 상의 → 잘린 신발 칸 → 밑단 칸
  const body = draws.find((x) => x[2] === 'male_body.png')[0];
  assert.ok(draws.findIndex((x) => x[2] === 'T:male_hair_05_back.png:brown') < draws.findIndex((x) => x[0] === 'root' && x[2] === body), '뒷머리는 몸 칸보다 먼저');
  const inBody = draws.filter((x) => x[0] === body).map((x) => [x[2], x[3]]);
  const layerOf = (file) => draws.find((x) => x[2] === file)[0];
  const shoeCut = layerOf('shoe_01_male_cut.png'), shoe = layerOf('shoe_01_male.png'), hem = layerOf('bottom_05_male_hem.png');
  assert.deepEqual(inBody, [
    ['male_body.png', 'source-over'], ['bottom_05_male_cut.png', 'destination-out'], ['top_03_male_cut.png', 'destination-out'],
    [shoeCut, 'destination-out'], ['male_body_feet.png', 'destination-out'],
    ['bottom_05_male.png', 'source-over'], ['top_03_male.png', 'source-over'], [shoe, 'source-over'], [hem, 'source-over'],
  ]);
  const inLayer = (name) => draws.filter((x) => x[0] === name).map((x) => [x[2], x[3]]);
  assert.deepEqual(inLayer(shoeCut), [['shoe_01_male_cut.png', 'source-over'], ['bottom_05_male_shaft.png', 'destination-out']]);
  assert.deepEqual(inLayer(shoe), [['shoe_01_male.png', 'source-over'], ['bottom_05_male_shaft.png', 'destination-out']]);
  assert.deepEqual(inLayer(hem), [['bottom_05_male.png', 'source-over'], ['bottom_05_male_hem.png', 'destination-in']]);
  // 악세사리(얼굴): 그 칸에 그리고 앞머리 모양 칸으로 지운 뒤 바탕에
  const acc = layerOf('accessory_10_male.png'), shape = layerOf('male_hair_05_front.png');
  assert.deepEqual(inLayer(acc), [['accessory_10_male.png', 'source-over'], [shape, 'destination-out']]);
  assert.deepEqual(done.sort(), [body, shoeCut, shoe, hem, acc, shape].sort(), '다 쓴 칸은 모두 돌려준다');
  // 바탕에 올릴 때는 변환 없이(같은 크기·같은 변환의 캔버스라 그대로 겹친다)
  assert.ok(log.some((x) => x[0] === 'root' && x[1] === 'setTransform' && x[2] === '1,0,0,1,0,0'));
  // 둥실 하트 테두리는 SVG 기본 miterlimit(4) · 두께는 계획 그대로(R7 머리 크기)
  assert.ok(log.some((x) => x[0] === 'root' && x[1] === 'stroke' && x[2] === 4));
  assert.ok(log.some((x) => x[0] === 'root' && x[1] === 'lineWidth' && x[2] === plan.ops.find((o) => o.kind === 'hearts').width));
  // 모든 그림은 1024 캔버스 전체 크기로
  for (const d of draws) if (String(d[2]).endsWith('.png') || String(d[2]).startsWith('T:')) assert.equal(d[4], `0,0,${SIZE},${SIZE}`, d[2]);
});

test('모자를 쓰면: 앞·뒷머리는 따로 그린 칸에서 모자의 머리 지우기로 자르고, 악세사리를 지울 앞머리 모양도 모자로 자른다', () => {
  const log = [];
  let n = 0;
  const fake = (name) => ({ name, canvas: { name }, globalCompositeOperation: 'source-over', save() {}, restore() { this.globalCompositeOperation = 'source-over'; }, setTransform() {},
    drawImage(im) { log.push([name, im.name || im, this.globalCompositeOperation]); } });
  const plan = characterPlan(DJS[0], { worn: WORN[4] }, null);
  paintPlan(fake('root'), plan.ops, { get: (m) => m.file, layer: () => fake('L' + (++n)), tint: (m) => `T:${m.file}` });
  const where = (im) => log.find((x) => x[1] === im)[0];
  for (const side of ['back', 'front']) {
    const L = where(`T:female_hair_09_${side}.png`);
    assert.notEqual(L, 'root', side + ' 따로 그린 칸');
    assert.deepEqual(log.filter((x) => x[0] === L).map((x) => [x[1], x[2]]), [[`T:female_hair_09_${side}.png`, 'source-over'], ['hat_16_female_hair.png', 'destination-out']]);
  }
  const shape = where('female_hair_09_front.png');
  assert.deepEqual(log.filter((x) => x[0] === shape).map((x) => [x[1], x[2]]), [['female_hair_09_front.png', 'source-over'], ['hat_16_female_hair.png', 'destination-out']]);
  assert.deepEqual(log.at(-1), ['root', 'hat_16_female.png', 'source-over'], '모자는 맨 위');
});

test('머리 물들이기(tintedHair): 1024 캔버스에 그려 픽셀을 읽고 패키지 recolor(밝기 → 표·알파 그대로) → putImageData · packageId·판·그림 해시·색으로 몇 장만 기억', () => {
  const made = [];
  const px = new Uint8ClampedArray([160, 160, 160, 255, 160, 160, 160, 40, 0, 0, 0, 0, 90, 90, 90, 128]);
  const doc = { createElement: () => { const c = { width: 0, height: 0, puts: [], draws: [] }; c.getContext = () => ({ drawImage: (im, ...a) => c.draws.push([im, a.join(',')]), getImageData: () => ({ data: new Uint8ClampedArray(px) }), putImageData: (d, x, y) => c.puts.push([[...d.data], x, y]) }); made.push(c); return c; } };
  const cache = new Map(), asset = { id: 'female_hair_09_back', v: '0123456789ab', file: 'female_hair_09_back.png' };
  const c = tintedHair(doc, 'IMG', asset, 'blond', cache);
  assert.deepEqual([c.width, c.height], [SIZE, SIZE]); assert.deepEqual(c.draws, [['IMG', `0,0,${SIZE},${SIZE}`]]);
  assert.deepEqual(c.puts, [[[...recolor(px, 'blond')], 0, 0]]);
  const out = c.puts[0][0];
  assert.deepEqual(out.slice(0, 8), [232, 200, 122, 255, 232, 200, 122, 40], '밝기 160 = 금발 대표색 #E8C87A, 반투명 가장자리도 같은 색 · 알파 그대로');
  assert.deepEqual(out.slice(8, 12), [0, 0, 0, 0], '투명은 그대로'); assert.equal(out[15], 128);
  assert.equal(tintedHair(doc, 'IMG', asset, 'blond', cache), c, '같은 머리·같은 색은 다시 만들지 않는다');
  assert.equal(tintKey(asset, 'blond'), `${ART.packageId}:tone-map-v1:female_hair_09_back:0123456789ab:blond`); assert.equal(hairColor.VERSION, 'tone-map-v1');
  assert.match(ART.packageId, /^DJ_STYLE_20261018_LINES_R8$/); // 2026-10-18 R8(외곽선·긴 머리) — 파일·id·좌표는 R7 그대로
  for (const k of ['black', 'pink', 'sky', 'silver']) tintedHair(doc, 'IMG', asset, k, cache);
  assert.equal(cache.size, TINT_CACHE_MAX); assert.equal(c.width, 0, '오래된 것부터 비운다(캔버스 메모리 돌려주기)');
  assert.deepEqual(Object.keys(PALETTE), ['black', 'brown', 'light', 'blond', 'pink', 'purple', 'sky', 'silver']);
  const save = readFileSync(new URL('../docs/lib/kiugi-save.js', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(save, /multiply|tintColor|HAIR_COLORS|kiugi-v5-data|reward/, '예전 곱하기·예전 그림 목록·시즌 보상 칸 없음');
});

test('캐릭터 캔버스(characterCanvas): 1024 캔버스에 겹쳐 그리고(저장하기는 s = 1 — 패키지 renderer.js 와 같은 픽셀), 다 쓴 칸은 바로 비운다', () => {
  const made = [];
  const grad = { addColorStop() {} };
  const doc = { createElement: () => {
    const c = { width: 0, height: 0 };
    const base = { canvas: c, getImageData: (x, y, w, hgt) => ({ data: new Uint8ClampedArray(w * hgt * 4) }) };
    c.getContext = () => new Proxy(base, { get: (t, p) => (p in t ? t[p] : () => grad) });
    made.push(c); return c;
  } };
  const plan = characterPlan(DJS[0], { worn: WORN[11] }, EXPR[1]);
  globalThis.Path2D ??= class { constructor(d) { this.d = d; } };
  const images = new Map(planUrls(plan, '/').map((u) => [u, { u }]));
  const out = characterCanvas(doc, plan, images, { base: '/', s: 1 });
  assert.deepEqual([out.width, out.height], [SIZE, SIZE]);
  const others = made.filter((c) => c !== out);
  assert.ok(others.length > 8, '칸을 따로 그린다(몸·잘린 머리·잘린 신발·악세사리 넷과 그 앞머리 모양)');
  // 남는 것은 물들인 머리(앞·뒤 — TINT_CACHE 가 몇 장만 따로 지킨다)뿐, 다 쓴 칸은 모두 비웠다
  assert.ok(others.filter((c) => c.width > 0).length <= 2, '다 쓴 칸은 비운다');
});

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} ≠ ${b}`);
// 놓은 자리(placeCharacter)가 지켜야 하는 것: 상자 가운데 = 그림 한가운데(540, 675), 줄이기만(늘리지 않음), 위·아래(띠 위)·옆 여백 안
function placedOk(box, label) {
  const L = SAVE_LAYOUT, at = placeCharacter(box), w = box.x1 - box.x0, hgt = box.y1 - box.y0;
  near(at.x + ((box.x0 + box.x1) / 2) * at.f, SAVE_W / 2, label + ' 가로 가운데');
  near(at.y + ((box.y0 + box.y1) / 2) * at.f, SAVE_H / 2, label + ' 세로 가운데');
  assert.ok(at.f > 0 && at.f <= 1, label + ' 줄이기만');
  const top = at.y + box.y0 * at.f, bottom = at.y + box.y1 * at.f, left = at.x + box.x0 * at.f, right = at.x + box.x1 * at.f;
  assert.ok(top >= L.fit.top - 1e-6, `${label} 위 끝 ${top}`);
  assert.ok(bottom <= L.fit.bottom + 1e-6 && bottom < L.band.y, `${label} 아래 끝 ${bottom} < 띠 ${L.band.y}`);
  assert.ok(left >= L.fit.side - 1e-6 && right <= SAVE_W - L.fit.side + 1e-6, `${label} 옆 ${left}~${right}`);
  assert.ok(right - left <= SAVE_W - 2 * L.fit.side + 1e-6, label + ' 너비');
  near(at.bottom, bottom, label + ' 발끝(그림자 자리)');
  near(w * at.f, right - left, label + ' 너비 그대로 줄임'); near(hgt * at.f, bottom - top, label + ' 높이 그대로 줄임');
  return at;
}

test('배치(1080×1350): 배경은 잘라 채우기, 캐릭터(모자·손 장식·둥실 하트 포함 — 7등신 R7)는 그림 한가운데·아래 띠 위, 글 줄은 띠 안에 차례로', () => {
  assert.equal(SAVE_W, 1080); assert.equal(SAVE_H, 1350); assert.equal(ART.size, SIZE);
  assert.deepEqual(coverRect(1024, 1024), { x: -135, y: 0, w: 1350, h: 1350 });
  assert.deepEqual(coverRect(1600, 900, 1080, 1350), { x: -660, y: 0, w: 2400, h: 1350 });
  const L = SAVE_LAYOUT, s = L.char.s;
  assert.deepEqual(L.center, { x: 540, y: 675 }, '그림 한가운데');
  assert.ok(L.fit.top >= 0 && L.fit.top < L.center.y && L.center.y < L.fit.bottom && L.fit.bottom < L.band.y && L.fit.side > 0);
  // 가장 큰 캐릭터: 모든 그림(배경 빼고 — 모자·악세사리 포함)과 둥실 하트(모자 없을 때 머리 위 · 모자 쓸 때 옆)를 합친 상자(char.s 배로 놓은 크기)
  const boxes = ART.assets.filter((a) => a.category !== 'background').map((a) => a.box);
  const heartYs = [EXPR[1]].flatMap((ex) => [{}, { hat: 'hat_16' }].flatMap((worn) => characterPlan(DJS[0], { worn }, ex).ops.find((o) => o.kind === 'hearts').hearts.map((x) => Number(/^M[\d.]+ ([\d.]+)/.exec(x.d)[1]) - 30)));
  const all = { x0: Math.min(...boxes.map((b) => b[0])) * s, y0: Math.min(...heartYs, ...boxes.map((b) => b[1])) * s, x1: Math.max(...boxes.map((b) => b[2])) * s, y1: Math.max(...boxes.map((b) => b[3])) * s };
  const at = placedOk(all, '모든 그림');
  assert.ok(at.f > 0.75, `너무 작게 줄이지 않는다(${at.f})`);
  // 그림 하나하나(몸 + 그 그림)도 같은 규칙
  for (const a of ART.assets.filter((x) => x.category !== 'background')) {
    const body = ART.assets.find((x) => x.category === 'body' && x.body === a.body)?.box || ART.assets.find((x) => x.category === 'body').box;
    const b = { x0: Math.min(body[0], a.box[0]) * s, y0: Math.min(body[1], a.box[1]) * s, x1: Math.max(body[2], a.box[2]) * s, y1: Math.max(body[3], a.box[3]) * s };
    placedOk(b, a.id);
  }
  assert.ok(L.band.y < L.id.y && L.id.y < L.sub.y && L.sub.y < L.rule.y && L.rule.y < L.mark.y && L.mark.y < SAVE_H - 20);
  assert.ok(L.fade.from < L.fade.to && L.fade.to <= L.band.y);
  assert.ok(at.bottom - 6 < L.band.y && L.shadow.rx > 0 && L.shadow.ry > 0, '발밑 그림자는 띠 위');
});

test('알파 상자(alphaBox)와 놓을 자리(placeCharacter): 정확히 한가운데(540, 675), 크면 줄이고, 띠·옆 여백을 넘지 않는다', () => {
  // 4×3 캔버스: (1,0)·(2,2) 는 보이고, (3,1) 은 알파 10(기준 16 이하라 빼는 옅은 가장자리)
  const px = (w, hgt, dots) => { const d = new Uint8ClampedArray(w * hgt * 4); for (const [x, y, a] of dots) d[(y * w + x) * 4 + 3] = a; return d; };
  const data = px(4, 3, [[1, 0, 255], [2, 2, 200], [3, 1, 10]]);
  assert.deepEqual(alphaBox(data, 4, 3), { x0: 1, y0: 0, x1: 3, y1: 3 }, '오른쪽·아래는 끝 다음 칸(너비 = x1 − x0)');
  assert.deepEqual(alphaBox(data, 4, 3, 5), { x0: 1, y0: 0, x1: 4, y1: 3 }, '기준을 낮추면 옅은 점도');
  assert.deepEqual(alphaBox(px(4, 3, [[2, 1, 17]]), 4, 3), { x0: 2, y0: 1, x1: 3, y1: 2 }, '한 점');
  assert.deepEqual(alphaBox(px(4, 3, [[0, 0, 16]]), 4, 3), { x0: 0, y0: 0, x1: 4, y1: 3 }, '아무것도 없으면(기준 이하뿐) 캔버스 전체');
  assert.deepEqual(alphaBox(new Uint8ClampedArray(0), 0, 0), { x0: 0, y0: 0, x1: 0, y1: 0 });
  const L = SAVE_LAYOUT, half = Math.min(L.center.y - L.fit.top, L.fit.bottom - L.center.y), maxW = SAVE_W - 2 * L.fit.side;
  // 작은 캐릭터: 늘리지 않고 그대로, 캔버스 어디에 그려졌든 한가운데로
  const small = placedOk({ x0: 300, y0: 100, x1: 500, y1: 400 }, '작은 캐릭터');
  assert.deepEqual(small, { x: 540 - 400, y: 675 - 250, f: 1, bottom: 675 + 150 });
  // 너무 큰 캐릭터: 위아래(띠 위까지의 반)에 맞춰 줄인다 — 발끝이 정확히 fit.bottom
  const tall = placedOk({ x0: 0, y0: 0, x1: 600, y1: 1127 }, '긴 캐릭터');
  near(tall.f, (2 * half) / 1127, '긴 캐릭터 배수'); near(tall.bottom, L.center.y + half, '긴 캐릭터 발끝');
  // 너무 넓은 캐릭터: 옆 여백에 맞춰 줄인다
  const wide = placedOk({ x0: 0, y0: 400, x1: 1127, y1: 700 }, '넓은 캐릭터');
  near(wide.f, maxW / 1127, '넓은 캐릭터 배수');
  // 크고 넓으면 더 많이 줄여야 하는 쪽으로
  const both = placedOk({ x0: 0, y0: 0, x1: 2000, y1: 1200 }, '크고 넓은 캐릭터');
  near(both.f, Math.min((2 * half) / 1200, maxW / 2000), '크고 넓은 캐릭터 배수');
  // 여러 크기·자리(1.1배로 놓은 캐릭터 1127 안팎)
  for (const w of [1, 37, 400, 999, 1000, 1001, 1127]) for (const hgt of [1, 120, 2 * half - 1, 2 * half, 2 * half + 1, 1127]) for (const x0 of [0, 64]) placedOk({ x0, y0: 13, x1: x0 + w, y1: 13 + hgt }, `${w}×${hgt}@${x0}`);
  // 빈 상자(그린 것 없음 — alphaBox 가 캔버스 전체를 준다)도 나누기 0 없이
  const empty = placeCharacter({ x0: 5, y0: 5, x1: 5, y1: 5 });
  assert.ok(Number.isFinite(empty.x) && Number.isFinite(empty.y) && empty.f === 1);
});

test('이미지 만들기(renderSaveImage): 1024 캔버스에 그린 캐릭터를 재서(알파 상자 × 1.1) 그 가운데를 그림 한가운데에, 1024 그림을 1.1 × 줄이는 배수로 한 번만', async () => {
  globalThis.Path2D ??= class { constructor(d) { this.d = d; } };
  const s = SAVE_LAYOUT.char.s;
  // 가짜 캔버스: 그리기는 적어 두기만, 1024 캐릭터 캔버스의 픽셀은 정한 상자만 보이게
  const run = async (card, rect) => {
    const grad = { addColorStop() {} };
    const doc = {
      createElement() {
        const c = { width: 0, height: 0, draws: [] };
        const base = {
          canvas: c,
          drawImage(im, ...a) { c.draws.push({ im, w: im?.width, a }); },
          getImageData(x, y, w, hgt) {
            const d = new Uint8ClampedArray(w * hgt * 4);
            if (c.width === SIZE) for (let yy = rect.y0; yy < rect.y1; yy++) for (let xx = rect.x0; xx < rect.x1; xx++) d[(yy * w + xx) * 4 + 3] = 255;
            return { data: d };
          },
          measureText: () => ({ width: 10 }), createLinearGradient: () => grad, createRadialGradient: () => grad,
        };
        c.getContext = () => new Proxy(base, { get: (t, p) => (p in t ? t[p] : () => grad) });
        return c;
      },
    };
    const out = await renderSaveImage(card, { base: B, doc, load: async (u) => ({ url: u }) });
    assert.deepEqual([out.width, out.height], [SAVE_W, SAVE_H]);
    const draws = out.draws.filter((d) => d.w === SIZE);
    assert.equal(draws.length, 1, '캐릭터는 바탕에 한 번만 올린다');
    return draws[0].a;
  };
  const card = { id: '밤톨#먼치', character: DJS[0], worn: WORN[1], level: 7, expression: EXPR[1], seasonName: '할로윈', hearts: 3 };
  const scale = (r) => ({ x0: r.x0 * s, y0: r.y0 * s, x1: r.x1 * s, y1: r.y1 * s });
  for (const rect of [{ x0: 360, y0: 60, x1: 670, y1: 975 }, { x0: 420, y0: 300, x1: 700, y1: 700 }, { x0: 0, y0: 0, x1: SIZE, y1: SIZE }]) {
    const [x, y, w, hgt] = await run(card, rect);
    const at = placeCharacter(scale(rect));
    assert.deepEqual([x, y, w, hgt], [at.x, at.y, SIZE * s * at.f, SIZE * s * at.f], JSON.stringify(rect));
    near(x + ((rect.x0 + rect.x1) / 2) * s * at.f, 540, '가로 한가운데'); near(y + ((rect.y0 + rect.y1) / 2) * s * at.f, 675, '세로 한가운데');
  }
  // 그린 것이 하나도 없으면 캔버스 전체를 가운데에
  const [x, y, w] = await run({ ...card, worn: {} }, { x0: 0, y0: 0, x1: 0, y1: 0 });
  const at = placeCharacter(scale({ x0: 0, y0: 0, x1: SIZE, y1: SIZE }));
  assert.deepEqual([x, y, w], [at.x, at.y, SIZE * s * at.f]);
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
  assert.match(src, /import \{ saveCharacterImage, hintSaveButton, SAVE_LABEL, SAVE_BUSY, SAVE_FAILED \} from '\.\.\/lib\/kiugi-save\.js'/);
  assert.match(src, /pet: buddy \? \{ id: buddy\.id, season: buddy\.season, stage: buddy\.stage \} : null/, '함께하는 펫도 같이 찍는다(2026-10-16)');
  assert.match(src, /hintSaveButton\(saveBtn\)/, '브라우저에서 ?save=1 로 열리면 저장하기를 알려 준다');
  // 2026-10-15: 그림과 함께하는 펫 표(kg-hero-stage) 바로 아래
  assert.match(src, /kind: 'hero' \}\),\s*petBuddy\(buddy, app\.base\)\),\s*saveBtn \? h\('div', \{ class: 'kg-save-row' \}, saveBtn\) : null\),/, '그림 칸(kg-hero-art) 안, 그림 바로 아래');
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

// 2026-10-16: 스푼 같은 앱 안 브라우저(길게 눌러도 저장이 안 뜸) → 브라우저에서 열어 저장하기 · 주소 복사 / 함께하는 펫도 같이 찍기
import { inAppKind, externalUrl, saveLinkUrl, savePetUrl, placePet, PET_GROUND, OPEN_OUTSIDE } from '../docs/lib/kiugi-save.js';
test('앱 안 브라우저 알아보기: 아이폰은 UA 에 Safari/ 가 없으면 앱 안, 안드로이드는 ; wv)', () => {
  const ios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
  assert.equal(inAppKind(ios), 'ios', '스푼 앱 안(사파리 표시 없음)');
  assert.equal(inAppKind(ios + ' Version/18.0 Safari/604.1'), '', '사파리');
  assert.equal(inAppKind(ios + ' CriOS/120.0 Safari/604.1'), '', '아이폰 크롬');
  assert.equal(inAppKind(ios + ' Safari/604.1 KAKAOTALK 10.0'), 'ios', '카카오톡');
  assert.equal(inAppKind('Mozilla/5.0 (Linux; Android 14; SM-S918N; wv) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'), 'android');
  assert.equal(inAppKind('Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'), '', '안드로이드 크롬');
  assert.equal(inAppKind('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'), '');
  assert.equal(inAppKind('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148', 5), 'ios', '아이패드 앱 안');
  assert.deepEqual(Object.keys(OPEN_OUTSIDE).sort(), ['android', 'ios']);
});
test('바깥 브라우저로 여는 주소: ?save=1 을 붙이고(다른 값은 그대로) 아이폰은 x-safari-, 안드로이드는 intent://', () => {
  const page = 'https://xn--ok0bp87bn6g.com/k/yfe5n74p/%ED%95%9C%EC%9D%B4%EC%A4%80?x=1#top';
  assert.equal(saveLinkUrl(page), 'https://xn--ok0bp87bn6g.com/k/yfe5n74p/%ED%95%9C%EC%9D%B4%EC%A4%80?x=1&save=1');
  assert.equal(externalUrl(page, 'ios'), 'x-safari-https://xn--ok0bp87bn6g.com/k/yfe5n74p/%ED%95%9C%EC%9D%B4%EC%A4%80?x=1&save=1');
  assert.equal(externalUrl(page, 'android'), 'intent://xn--ok0bp87bn6g.com/k/yfe5n74p/%ED%95%9C%EC%9D%B4%EC%A4%80?x=1&save=1#Intent;scheme=https;end');
  assert.equal(saveLinkUrl('https://xn--ok0bp87bn6g.com/k/a/b?save=1'), 'https://xn--ok0bp87bn6g.com/k/a/b?save=1', '두 번 붙이지 않는다');
  assert.equal(externalUrl(page, ''), null); assert.equal(saveLinkUrl('javascript:alert(1)'), null); assert.equal(saveLinkUrl('not a url'), null);
});
test('함께하는 펫: 그림 주소(이상한 id·시즌은 그리지 않음)와 자리(캐릭터 오른쪽 같은 바닥선, 둘을 한 무리로 가운데)', () => {
  assert.equal(savePetUrl({ id: 'ghost', season: 's1', stage: 3 }, '/'), '/pets/s1/pet_ghost_3.png');
  assert.equal(savePetUrl({ id: 'ghost', season: 's1', stage: 9 }, B), B + 'pets/s1/pet_ghost_5.png', '단계는 1~5');
  assert.equal(savePetUrl({ id: 'ghost', season: 's1' }, '/'), '/pets/s1/pet_ghost_1.png');
  assert.equal(savePetUrl({ id: '../x', season: 's1', stage: 1 }), null); assert.equal(savePetUrl({ id: 'ghost', season: 'a/b', stage: 1 }), null); assert.equal(savePetUrl(null), null);
  // 캐릭터 400px(가운데 340~740) · 펫 상자 200px(펫 캔버스 600 안 200~400) · 발끝 1100
  const at = placePet({ x0: 340, x1: 740 }, { x0: 200, x1: 400 }, 600, 1100);
  const overlap = 24, group = 400 + 200 - overlap, left = (SAVE_W - group) / 2;
  assert.equal(at.dx, Math.round(left - 340), '캐릭터는 왼쪽으로 비켜 선다');
  assert.equal(at.x + 200, Math.round(left + 400 - overlap), '펫은 캐릭터 오른쪽에 12% 겹쳐');
  assert.equal(at.y, Math.round(1100 - 600 * PET_GROUND), '펫 바닥선(470/512) = 캐릭터 발끝');
  assert.ok(at.x + 400 <= SAVE_W - SAVE_LAYOUT.fit.side, '그림 밖으로 나가지 않는다');
  // 아주 넓으면 오른쪽 여백 안으로
  const wide = placePet({ x0: 100, x1: 900 }, { x0: 0, x1: 500 }, 500, 1100);
  assert.ok(wide.x + 500 <= SAVE_W - SAVE_LAYOUT.fit.side);
});
