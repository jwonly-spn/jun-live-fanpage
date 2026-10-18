// 고해상도 그림(2026-10-18 R9 — Codex 패키지 DJ_STYLE_20261018_REDO_R9 · 클로드_고해상도_작업지시.txt): docs/kiugi-hd/ 사본 · 큰 무대·저장하기 연결(lib/kiugi-hd.js).
//  ① 그리는 코드(renderer.js · hair-color.js · renderer-hd.js)는 패키지와 바이트가 같다(해시) ② 등록부·원본 그림은 패키지 상대 경로 그대로, 해시가 같고 빠진 것이 없다
//  ③ 호환 그림·마스크(03_png_assets·04_masks)는 사이트 사본(docs/kiugi/<판>/)이 패키지와 바이트가 같고, renderer 의 bundle 표가 그것을 가리킨다
//  ④ renderer 상태·칸 셈·저장 그림 자리(노드 — DOM 없이). 실제 그리기(브라우저)는 시험 밖(숨은 Electron)에서 본다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ART, buildCatalog, expressionFor } from '../docs/lib/kiugi-draw.js';
import { hdState, hdExpression, hdFit, renderScaleFor, compatBundle, hdBundle, overlayOps, MASK_KEYS, HD_MAX_SCALE, HD_MAX_PIXELS, HD_DIR } from '../docs/lib/kiugi-hd.js';
import { characterPlan, renderSaveImage, placeCharacter, hdViewportOf, SAVE_LAYOUT, SAVE_W, SAVE_H } from '../docs/lib/kiugi-save.js';
import { SIZE } from '../docs/kiugi/kiugi-art.js';

const docs = fileURLToPath(new URL('../docs/', import.meta.url));
const hdRoot = docs + 'kiugi-hd/';
const sha = (b) => createHash('sha256').update(b).digest('hex');
const json = async (p) => JSON.parse(await readFile(p, 'utf8'));
// 패키지 HANDOFF_READY·RUNTIME_FILES 에 적힌 그리는 코드 해시(바꾸면 안 된다 — Codex 지시 "고치지 말고 그대로")
const CODE_SHA = Object.freeze({
  '02_클로드인계/renderer.js': '79de5cf48f90d34846eda3bee08509137f59fec3f3a600335d744e8da0705b35',
  '02_클로드인계/hair-color.js': '161babbe7d780e256947ed76f5cc6e9ba4c3626d5dbe3e6d6e175a90094408de',
  '02_클로드인계/renderer-hd.js': 'f86b7ff9a94d3c8a9b2444785eaa40e2ef350280757c1acf30f7e68f1ae40d39',
});
async function listFiles(dir, base = dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = dir + e.name;
    if (e.isDirectory()) out.push(...await listFiles(full + '/', base)); else out.push(full.slice(base.length));
  }
  return out;
}
const manifestOf = async () => json(hdRoot + '02_클로드인계/assets.json');
const hdOf = async () => {
  const index = await json(hdRoot + 'index.json');
  return Object.fromEntries(await Promise.all(Object.entries(index.manifests).map(async ([k, e]) => [k, (await json(hdRoot + e.path)).assets])));
};

test('그리는 코드(renderer.js · hair-color.js · renderer-hd.js)는 패키지와 바이트가 같다 · index.json 은 같은 패키지 · 주소 ?v= 는 해시 앞 12자', async () => {
  const files = (await json(hdRoot + 'files.json')).files, index = await json(hdRoot + 'index.json');
  for (const [rel, want] of Object.entries(CODE_SHA)) {
    assert.equal(sha(await readFile(hdRoot + rel)), want, rel + ' 은 패키지 그대로(고치지 않는다)');
    assert.equal(files[rel], want, rel);
  }
  assert.equal(index.packageId, 'DJ_STYLE_20261018_REDO_R9');
  assert.equal(index.packageId, ART.packageId, '고해상도와 호환 그림은 같은 패키지');
  for (const e of [...Object.values(index.code), ...Object.values(index.manifests)]) assert.equal(e.v, files[e.path].slice(0, 12), e.path);
  assert.deepEqual(Object.keys(index.code).sort(), ['assets', 'hairColor', 'renderer', 'rendererHd']);
  assert.deepEqual(Object.keys(index.manifests).sort(), ['defaultBody', 'face', 'features', 'hair', 'lowerBody', 'lowerLeg', 'wardrobe']);
  // 저장소에 올릴 때 줄바꿈을 바꾸지 않는다(renderer*.js · assets.json · 등록부는 CRLF — 바뀌면 올린 사이트의 파일이 패키지와 달라진다)
  assert.match(await readFile(new URL('../.gitattributes', import.meta.url), 'utf8'), /^docs\/kiugi-hd\/\*\* -text$/m);
  // 코드는 전역 스크립트(classic) — 화면 모듈 목록(import map · modulepreload)에 넣지 않는다(모든 화면이 받지 않게)
  const html = await readFile(docs + 'index.html', 'utf8');
  assert.doesNotMatch(html, /kiugi-hd\//, '첫 화면은 고해상도 파일(docs/kiugi-hd/)을 미리 받지 않는다(작은 연결 모듈 lib/kiugi-hd.js 만)');
  assert.match(html, /"\/lib\/kiugi-hd\.js":"\/lib\/kiugi-hd\.js\?v=[0-9a-f]{10}"/);
});

test('찍기(tools/stamp.cjs): 고해상도 쪽 파일은 처음부터 미리 받지 않는다(먼치킨 sync 가 docs/kiugi/ 에 넣는 고해상도 모듈·그리는 코드 사본·목록 포함) — 화면 모듈은 그대로', async () => {
  const { createRequire } = await import('node:module');
  const { preloadable } = createRequire(import.meta.url)('../tools/stamp.cjs');
  for (const m of ['/kiugi/kiugi-hd.js', '/kiugi/kiugi-r9-renderer.js', '/kiugi/kiugi-r9-renderer-hd.js', '/kiugi/kiugi-r9-hair-color.js', '/kiugi/kiugi-r9-hd-data.js', '/mock.js']) assert.equal(preloadable(m), false, m);
  for (const m of ['/kiugi/kiugi-art.js', '/kiugi/kiugi-r9-data.js', '/kiugi/kiugi-hair-color.js', '/kiugi/kiugi-look.js', '/lib/kiugi-hd.js', '/views/character.js']) assert.equal(preloadable(m), true, m);
});

test('고해상도 사본(docs/kiugi-hd/): 모든 파일이 패키지 해시와 같고, 등록부가 가리키는 그림이 하나도 빠지지 않고, 한 파일 100MB 를 넘지 않는다', async () => {
  const files = (await json(hdRoot + 'files.json')).files;
  const have = (await listFiles(hdRoot)).filter((p) => p !== 'index.json' && p !== 'files.json');
  let bytes = 0;
  for (const rel of have) {
    assert.ok(files[rel], rel + ' 은 패키지 런타임 파일');
    const b = await readFile(hdRoot + rel);
    assert.equal(sha(b), files[rel], rel);
    assert.ok(b.length < 100 * 1024 * 1024, rel + ' 100MB 미만(GitHub)');
    bytes += b.length;
  }
  // 패키지의 03_hd_assets · 03_제작기록 런타임 파일과 그리는 코드는 모두 있다(호환 그림 03_png_assets·04_masks 는 docs/kiugi/ 사본을 쓴다)
  const need = Object.keys(files).filter((p) => /^(03_hd_assets|03_제작기록)\//.test(p) || p in CODE_SHA || p === '02_클로드인계/assets.json');
  assert.deepEqual(need.filter((p) => !have.includes(p)), [], '빠진 고해상도 파일 없음');
  assert.ok(have.every((p) => !/^(03_png_assets|04_masks)\//.test(p)), '호환 그림은 두 번 넣지 않는다');
  const hd = await hdOf();
  const paths = Object.keys(hdBundle(hd, '/'));
  assert.ok(paths.length > 700, '등록부 그림 ' + paths.length);
  for (const p of paths) assert.ok(have.includes(p), p + ' (등록부가 가리키는 그림)');
  assert.ok(bytes > 150e6 && bytes < 250e6, `고해상도 사본 ${(bytes / 1e6).toFixed(1)}MB`);
});

test('호환 그림 이어 주기(bundle ①): 패키지 assets.json 의 그림·마스크 길 → docs/kiugi/<판>/ 사본(바이트가 패키지와 같다)', async () => {
  const manifest = await manifestOf(), files = (await json(hdRoot + 'files.json')).files, B = '/x/';
  const bundle = compatBundle(manifest, ART, B);
  let n = 0;
  for (const a of manifest.assets) {
    const keys = [a.path, ...Object.keys(MASK_KEYS).filter((k) => a[k]).map((k) => a[k])];
    for (const p of keys) {
      const url = bundle[p];
      assert.ok(url, p + ' 이 사이트 사본에 이어진다');
      const m = /^\/x\/(kiugi\/[a-z0-9]+\/[a-z0-9_]+\.png)\?v=([0-9a-f]{12})$/.exec(url);
      assert.ok(m, url);
      const b = await readFile(docs + m[1]);
      assert.equal(sha(b), files[p], `${p} = ${m[1]}`);
      assert.equal(m[2], files[p].slice(0, 12), url + ' 의 ?v= 는 해시');
      n++;
    }
  }
  assert.equal(n, 336 + 236, '그림 336 + 마스크 236');
});

test('원본 그림 주소(bundle ②): 등록부의 길 그대로 docs/kiugi-hd/ 아래 · ?v= 는 그 그림 sha256 앞 12자 · 한글 길은 주소로 바꾼다', async () => {
  const hd = await hdOf(), dir = '/' + HD_DIR, b = hdBundle(hd, dir);
  const e = hd.hair.female_hair_01_front;
  assert.equal(b[e.path], `${dir}${encodeURI(e.path)}?v=${e.sha256.slice(0, 12)}`);
  assert.match(e.path, /^03_제작기록\//, '머리 원본 일부는 03_제작기록 아래(등록부 길 그대로)');
  const w = hd.wardrobe.top_01_female;
  assert.equal(b[w.path], `${dir}${w.path}?v=${w.sha256.slice(0, 12)}`);
  assert.ok(b[w.bodyCompanion.replacementMask.path], '옷마다 딸린 마스크도');
  assert.ok(b[hd.face.female.path] && b[hd.defaultBody.male.path] && b[hd.lowerLeg.female.replacementMask.path]);
  for (const [p, u] of Object.entries(b)) { assert.match(p, /^03_(hd_assets|제작기록)\//); assert.match(u, /\?v=[0-9a-f]{12}$/, p); }
});

test('renderer 상태: DJ 캐릭터 + 입은 옷 + 레벨 표정 → DJStyleHDRenderer 의 state (배경 빼고) · 만들 수 없는 표정은 null(호환 그림)', async () => {
  const read = async (p) => JSON.parse(await readFile(new URL('../docs/kiugi/' + p, import.meta.url), 'utf8'));
  const m = await read('manifest.json'), c = buildCatalog(await Promise.all(m.seasons.map(read)), { files: m.files, adjust: {} });
  const dj = { name: '먼치', gender: 'f', hair: '6', hairColor: 'blond', eyes: '2', nose: '4', mouth: '6' };
  assert.deepEqual(hdState(dj, { worn: { top: 'top_05', bottom: 'bottom_03', shoes: 'shoe_04', face: 'accessory_02', hat: 'hat_09', bg: 'background_01', head: 'accessory_06', neck: 'accessory_16' } }, expressionFor(c, 's1', 1)),
    { body: 'female', hair: 6, hairColor: 'blond', eyes: 2, nose: 4, mouth: 6, expression: 'normal', outfit: null, top: 5, bottom: 3, shoe: 4, hat: 9, accessory: [16, 2, 6] },
    '악세사리는 겹치는 차례(목 → 손 → 얼굴 → 머리) · 배경은 빼고(무대 뒤 장면)');
  assert.deepEqual(hdState({ gender: 'm', hair: 'curly', eyes: '5', nose: '9', mouth: 'cat' }, { worn: { outfit: 'outfit_03', top: 'top_01', shoes: 'shoe2_03', crown: 'acc2_11' } }, null),
    { body: 'male', hair: 3, hairColor: 'brown', eyes: 1, nose: 1, mouth: 1, expression: 'normal', outfit: 3, top: null, bottom: null, shoe: null, hat: null, accessory: [] },
    '한벌옷이 상의를 덮고, 예전 그림의 옷·없는 번호는 그리지 않는다(호환 그림과 같은 규칙 — resolveLook)');
  const ids = new Set((await manifestOf()).assets.map((a) => a.id)), pad = (n) => String(n).padStart(2, '0');
  // 레벨 표정: 1~8·10 은 renderer 표정(normal · smile)으로, 9 "감동"(눈물 눈 + 웃는 입)은 표정 cry + 입 번호를 웃는 입 그림 id('06_smile')로
  const got = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((lv) => [lv, hdExpression(expressionFor(c, 's1', lv))?.expression]));
  assert.deepEqual(got, { 1: 'normal', 2: 'normal', 3: 'smile', 4: 'smile', 5: 'smile', 6: 'smile', 7: 'smile', 8: 'smile', 9: 'cry', 10: 'smile' });
  const lv9 = hdState(dj, {}, expressionFor(c, 's1', 9));
  assert.equal(lv9.expression, 'cry'); assert.equal(lv9.mouth, '06_smile');
  assert.ok(ids.has(`female_mouth_${lv9.mouth}`) && ids.has('female_eyes_02_cry'), '패키지에 있는 그림 id(renderer 가 번호를 그대로 붙인다)');
  assert.deepEqual(hdExpression({ parts: ['eyes:cry'] }), { expression: 'cry', mouthSmile: false });
  assert.deepEqual(hdExpression({ parts: ['mouth:smile'] }), { expression: 'normal', mouthSmile: true }, '웃는 입만이면 입 번호로');
  assert.equal(hdExpression({ parts: ['eyes:smile'] }), null, '웃는 눈 + 기본 입은 renderer 로 만들 수 없다(호환 그림)');
  assert.equal(hdState(dj, {}, { parts: ['eyes:smile'] }), null);
  // renderer 가 아는 id 만 쓴다(패키지 assets.json)
  for (const s of [hdState(dj, { worn: { top: 'top_20', bottom: 'bottom_20', shoes: 'shoe_20', hat: 'hat_20', hand: 'accessory_05' } }, null), hdState({ gender: 'm', hair: '10', nose: '7', mouth: '7' }, { worn: { outfit: 'outfit_20' } }, null)]) {
    for (const k of ['top', 'bottom', 'outfit', 'shoe', 'hat']) if (s[k] !== null) assert.ok(ids.has(`${k}_${pad(s[k])}_${s.body}`), k);
    for (const n of s.accessory) assert.ok(ids.has(`accessory_${pad(n)}_${s.body}`));
    for (const k of ['eyes', 'nose', 'mouth']) assert.ok(ids.has(`${s.body}_${k}_${pad(s[k])}`), k);
    assert.ok(ids.has(`${s.body}_hair_${pad(s.hair)}_front`));
  }
});

test('칸 셈(hdFit): 무대에 보이는 부분만 · 캔버스 픽셀 = 화면 크기 × 화면 배율 · 배율 4 까지 · 픽셀 수 한도', () => {
  const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
  // 휴대폰 캐릭터 페이지(무대 361×541.5, 캔버스 칸 154.8387% — styles.css .kg-stage.char), 화면 배율 3
  const stage = rect(16, 100, 361, 541.5), art = rect(16 - 361 * 0.274194, 100 - 541.5 * 0.008065, 361 * 1.548387, 361 * 1.548387);
  const f = hdFit(stage, art, 3);
  assert.deepEqual(f.viewport, [179, 6, 666, 997], '가로 가운데 661 · 세로 8~1000 (+2 여유)');
  assert.ok(Math.abs(f.scale - (art.width / SIZE) * 3) < 0.002, '캔버스 픽셀 = CSS 크기 × 3');
  // 여자(무대에서 0.91 배 — 화면 크기에 든 변형 그대로)
  const fem = hdFit(stage, rect(art.left + art.width * 0.045, art.top, art.width * 0.91, art.height * 0.91), 3);
  assert.ok(fem.scale < f.scale && Math.abs(fem.scale - (art.width * 0.91 / SIZE) * 3) < 0.002);
  // 큰 PC 화면 · 배율 4 이상이 필요해도 4
  assert.equal(hdFit(rect(0, 0, 2000, 3000), rect(-500, 0, 3100, 3100), 2, { maxPixels: 1e9 }).scale, HD_MAX_SCALE);
  // 픽셀 수 한도(휴대폰 메모리)
  const big = hdFit(rect(0, 0, 1200, 1800), rect(-300, 0, 1900, 1900), 3);
  assert.ok(big.viewport[2] * big.viewport[3] * big.scale ** 2 <= HD_MAX_PIXELS + 1);
  // renderer 에는 정수 배율로 그리게 하고 화면 크기로 줄인다(소수 배율 가로줄 피하기) — 픽셀 한도를 넘으면 원하는 배율 그대로, 늘리지는 않는다
  assert.equal(renderScaleFor([179, 6, 666, 997], 1.49), 2); assert.equal(renderScaleFor([179, 6, 666, 997], 0.55), 1); assert.equal(renderScaleFor([0, 0, 100, 100], 3.2), 4);
  assert.equal(renderScaleFor([0, 0, 100, 100], 2), 2, '정수면 그대로'); assert.equal(renderScaleFor([0, 0, 1024, 1024], 2.5), 2.5, '한도를 넘으면 원하는 배율 그대로');
  assert.equal(renderScaleFor([0, 0, 10, 10], 9), HD_MAX_SCALE);
  // 무대 밖이면 그리지 않는다
  assert.equal(hdFit(rect(0, 0, 100, 100), rect(500, 500, 100, 100), 2), null);
  assert.equal(hdFit(stage, rect(0, 0, 0, 0), 2), null);
});

test('레벨 표정 겹치기(overlayOps): 볼 발그레·둥실 하트는 호환 그림·저장하기와 같은 자리(kiugi-save.js characterPlan) · 볼 발그레는 renderer onLayer("hem") 에(앞머리·악세사리·모자 아래)', async () => {
  const ex7 = { parts: ['eyes:smile', 'mouth:smile', 'exp-blush', 'exp-floating-hearts'] };
  const o = overlayOps({ gender: 'f', hair: '2' }, { worn: { hat: 'hat_16' } }, ex7), plan = characterPlan({ gender: 'f', hair: '2' }, { worn: { hat: 'hat_16' } }, ex7);
  assert.deepEqual(o.blush, plan.ops.filter((x) => x.kind === 'blush')); assert.deepEqual(o.hearts, plan.ops.filter((x) => x.kind === 'hearts'));
  assert.equal(o.blush.length, 1); assert.equal(o.blush[0].spots.length, 2); assert.equal(o.hearts[0].hearts.length, 3);
  assert.deepEqual(overlayOps({ gender: 'm' }, {}, { parts: [] }), { blush: [], hearts: [] });
  const src = await readFile(docs + 'lib/kiugi-hd.js', 'utf8');
  assert.match(src, /label === 'hem' && over\.blush\.length/, '볼 발그레는 몸·얼굴·옷 칸에(앞머리 앞)');
  assert.match(src, /renderer\.render\(work, state, \{ viewport, scale: rs, onLayer \}\)/);
});

test('저장하기 고해상도(hd 함수를 넘길 때): 자리·크기는 호환 그림의 알파 상자로 정하고, 그 칸을 저장 그림 배율로 바로 그린 캔버스를 늘이지 않고 올린다 · 못 그리면 호환 그림', async () => {
  globalThis.Path2D ??= class { constructor(d) { this.d = d; } };
  const s = SAVE_LAYOUT.char.s, rect = { x0: 360, y0: 60, x1: 670, y1: 975 };
  const make = () => {
    const grad = { addColorStop() {} };
    return {
      createElement() {
        const c = { width: 0, height: 0, draws: [] };
        const base = { canvas: c, drawImage(im, ...a) { c.draws.push({ im, w: im?.width, a }); },
          getImageData(x, y, w, hgt) { const d = new Uint8ClampedArray(w * hgt * 4); if (c.width === SIZE) for (let yy = rect.y0; yy < rect.y1; yy++) for (let xx = rect.x0; xx < rect.x1; xx++) d[(yy * w + xx) * 4 + 3] = 255; return { data: d }; },
          measureText: () => ({ width: 10 }), createLinearGradient: () => grad, createRadialGradient: () => grad };
        c.getContext = () => new Proxy(base, { get: (t, p) => (p in t ? t[p] : () => grad) });
        return c;
      },
    };
  };
  const card = { id: '밤톨#먼치', character: { gender: 'f', hair: '2', nose: '4', mouth: '6' }, worn: { top: 'top_05', bottom: 'bottom_03' }, level: 3, expression: { level: 3, parts: ['eyes:smile', 'mouth:smile'] }, seasonName: '할로윈', hearts: 3 };
  const at = placeCharacter({ x0: rect.x0 * s, y0: rect.y0 * s, x1: rect.x1 * s, y1: rect.y1 * s }), S = s * at.f, v = hdViewportOf(rect);
  assert.deepEqual(v, [356, 56, 318, 923]);
  let asked = null;
  const hdCanvas = { width: Math.round(v[2] * S), height: Math.round(v[3] * S), hd: true };
  const out = await renderSaveImage(card, { base: '/', doc: make(), load: async (u) => ({ url: u }), hd: async (q) => { asked = q; return { canvas: hdCanvas }; } });
  assert.deepEqual([out.width, out.height], [SAVE_W, SAVE_H]);
  assert.deepEqual(asked.viewport, v); assert.ok(Math.abs(asked.scale - S) < 1e-9, '저장 그림 배율 그대로(≤ 4)'); assert.ok(asked.scale <= 4);
  assert.deepEqual(asked.look, { worn: card.worn }); assert.equal(asked.expression, card.expression);
  const hdDraw = out.draws.find((d) => d.im === hdCanvas);
  assert.deepEqual(hdDraw.a, [Math.round(at.x + v[0] * S), Math.round(at.y + v[1] * S)], '늘이거나 줄이지 않고(크기 인자 없음) 제자리에');
  assert.equal(out.draws.filter((d) => d.w === SIZE).length, 0, '호환 1024 캐릭터는 올리지 않는다');
  // 고해상도로 못 그리면(null · 오류) 호환 그림 그대로
  for (const hd of [async () => null, async () => { throw Error('x'); }]) {
    const o = await renderSaveImage(card, { base: '/', doc: make(), load: async (u) => ({ url: u }), hd });
    assert.equal(o.draws.filter((d) => d.w === SIZE).length, 1);
  }
});
