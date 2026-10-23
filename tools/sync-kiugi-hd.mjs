// 고해상도 그림(DJ 키우기 새 그림체 R9 — Codex 패키지 DJ_STYLE_20261018_REDO_R9)을 사이트 docs/kiugi-hd/ 에 넣는다(2026-10-18).
//  Codex 지시(클로드_고해상도_작업지시.txt): 큰 화면은 renderer-hd.js 의 DJStyleHDRenderer 가 등록부(03_hd_assets/*_manifest.json)의 원본(native) 그림을
//   각자의 rect(1024 논리 좌표)에 바로 그린다. renderer.js · hair-color.js · renderer-hd.js 는 고치지 않고 바이트 그대로, 등록부의 상대 경로도 그대로 둔다.
//  넣는 것(패키지 상대 경로 그대로 — docs/kiugi-hd/<경로>):
//   · 02_클로드인계/renderer.js · hair-color.js · renderer-hd.js · assets.json(그리는 코드와 호환 그림 목록 — 호환 그림·마스크는 docs/kiugi/<판>/ 사본을 쓴다, lib/kiugi-hd.js)
//   · 03_hd_assets/ 전부(등록부 7개 + 원본 그림) · 등록부가 가리키는 03_제작기록/… 원본(머리 몇 종·종아리)
//  그리고 docs/kiugi-hd/index.json(사이트가 처음에 받는 작은 표 — 코드·등록부 주소의 ?v=) · files.json(패키지 런타임 파일 해시 전부 — 시험이 사본을 확인한다).
//  확인: 두 HANDOFF_READY(02_클로드인계·맨 위)가 ready·같은 packageId·같은 해시 · 두 STATUS ready · 모든 파일 SHA-256 = RUNTIME_FILES.json ·
//   READY 의 코드·등록부 해시 · 등록부가 가리키는 길이 모두 런타임 파일에 있다(빠진 것 0) · 한 파일 100MB 넘지 않는다(GitHub).
//  docs/kiugi-hd/ 안의 다른 파일(예전 패키지)은 지운다. docs/kiugi/(먼치킨 저장소가 맞춰 쓰는 폴더)는 건드리지 않는다. 패키지 폴더에는 아무것도 쓰지 않는다.
// 쓰는 법: node tools/sync-kiugi-hd.mjs [패키지 사본 폴더] [--check]
//   패키지 폴더를 안 적으면 환경 변수 KIUGI_HD_PACKAGE → C:\Users\User\Documents\JUN LIVE 작업\기획\DJ키우기\그림체-R9-원본
//   --check: 쓰지 않고 같은지만(다르면 1 로 끝난다)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const DEFAULT_PACKAGE = 'C:\\Users\\User\\Documents\\JUN LIVE 작업\\기획\\DJ키우기\\그림체-R9-원본';
export const HD_DIR = 'kiugi-hd';
export const CODE = Object.freeze({ hairColor: '02_클로드인계/hair-color.js', renderer: '02_클로드인계/renderer.js', rendererHd: '02_클로드인계/renderer-hd.js', assets: '02_클로드인계/assets.json' });
// 등록부(renderer-hd.js 의 hdManifest 칸 이름 → 파일) — Codex 예제(02_검수/의상_HD실제합성.html)의 hdManifest 와 같은 묶음
export const MANIFESTS = Object.freeze({
  hair: '03_hd_assets/hair_manifest.json', face: '03_hd_assets/face_manifest.json', features: '03_hd_assets/feature_manifest.json',
  lowerLeg: '03_hd_assets/lowerleg_manifest.json', lowerBody: '03_hd_assets/lower_body_manifest.json',
  wardrobe: '03_hd_assets/wardrobe_manifest.json', defaultBody: '03_hd_assets/default_body_manifest.json',
});
// READY 의 해시 칸(있는 것만 본다)
const READY_KEYS = Object.freeze({ assetsSha256: CODE.assets, hdRendererSha256: CODE.rendererHd, hdHairManifestSha256: MANIFESTS.hair, hdFaceManifestSha256: MANIFESTS.face,
  hdFeatureManifestSha256: MANIFESTS.features, hdWardrobeManifestSha256: MANIFESTS.wardrobe, hdDefaultBodyManifestSha256: MANIFESTS.defaultBody, hdLowerBodyManifestSha256: MANIFESTS.lowerBody });
const MAX_FILE = 100 * 1024 * 1024;
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const v12 = (s) => s.slice(0, 12);
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
const SAFE = /^(?:02_클로드인계|03_hd_assets|03_제작기록)\/[0-9A-Za-z가-힣_./-]+$/;
// {길: 해시} 또는 [{path, sha256}] → Map
const hashMap = (files) => new Map(Array.isArray(files) ? files.map((f) => [f.path, f.sha256]) : Object.entries(files || {}).map(([p, v]) => [p, typeof v === 'string' ? v : v?.sha256]));

// 등록부 안의 모든 path(그림 길) — 칸 이름이 path 인 글자 값
export function manifestPaths(obj) {
  const out = new Set();
  (function walk(o) { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (k === 'path' && typeof v === 'string') out.add(v); else walk(v); } })(obj);
  return out;
}

export function readHdPackage(pkg = process.env.KIUGI_HD_PACKAGE || DEFAULT_PACKAGE) {
  const handoff = path.join(pkg, '02_클로드인계'), problems = [];
  const readyA = readJson(path.join(handoff, 'HANDOFF_READY.json')), readyB = readJson(path.join(pkg, 'HANDOFF_READY.json'));
  for (const [where, r] of [['02_클로드인계/HANDOFF_READY.json', readyA], ['HANDOFF_READY.json', readyB]]) if (r.ready !== true || r.status !== 'ready' || r.validationPassed !== true) problems.push(where + ' 가 준비되지 않았어요');
  if (JSON.stringify(readyA) !== JSON.stringify(readyB)) problems.push('두 HANDOFF_READY 가 달라요');
  for (const f of [path.join(handoff, 'STATUS.json'), path.join(pkg, 'STATUS.json')]) { const st = readJson(f); if (st.packageId !== readyA.packageId || st.ready !== true || st.status !== 'ready') problems.push(path.relative(pkg, f) + ' 가 준비 중이에요'); }
  // 런타임 목록: R9 는 02_클로드인계 안, R9 FIX1(2026-10-22)은 패키지 맨 위 — 둘 다 본다(안이 먼저)
  const rtFile = [path.join(handoff, 'RUNTIME_FILES.json'), path.join(pkg, 'RUNTIME_FILES.json')].find((f) => fs.existsSync(f));
  if (!rtFile) throw Object.assign(Error('패키지를 아직 가져올 수 없어요: RUNTIME_FILES.json 이 없어요'), { notReady: true });
  const rt = readJson(rtFile);
  if (rt.packageId !== readyA.packageId) problems.push('RUNTIME_FILES.json 패키지 이름');
  const runtime = hashMap(rt.files);
  if (problems.length) throw Object.assign(Error('패키지를 아직 가져올 수 없어요: ' + problems.join(' · ')), { notReady: true });
  const want = new Map(), take = (rel) => {
    if (!SAFE.test(rel) || rel.includes('..')) throw Error('이상한 길: ' + rel);
    const expected = runtime.get(rel);
    if (!expected) throw Error('RUNTIME_FILES.json 에 없는 파일: ' + rel);
    const bytes = fs.readFileSync(path.join(pkg, ...rel.split('/')));
    if (sha(bytes) !== expected) throw Error('해시가 달라요: ' + rel);
    if (bytes.length > MAX_FILE) throw Error('100MB 넘는 파일: ' + rel);
    want.set(rel, bytes);
    return bytes;
  };
  for (const rel of Object.values(CODE)) take(rel);
  for (const [k, rel] of Object.entries(READY_KEYS)) if (readyA[k] && readyA[k] !== runtime.get(rel)) throw Error(`${k} 가 READY 와 달라요`);
  const hd = {};
  for (const [key, rel] of Object.entries(MANIFESTS)) {
    const m = JSON.parse(take(rel).toString('utf8'));
    if (m.packageId !== readyA.packageId) throw Error(rel + ' 패키지 이름');
    hd[key] = m.assets;
  }
  // 등록부가 가리키는 그림 = 03_hd_assets/ · 03_제작기록/ 런타임 파일 전부(빠진 것도 남는 것도 없게)
  const refs = manifestPaths(hd), runtimeHd = [...runtime.keys()].filter((p) => /^(03_hd_assets|03_제작기록)\//.test(p) && !Object.values(MANIFESTS).includes(p));
  const missing = [...refs].filter((p) => !runtime.has(p));
  if (missing.length) throw Error('등록부가 가리키는데 런타임 파일에 없음: ' + missing.slice(0, 5).join(', '));
  // 등록부가 가리키지 않는 고해상도 파일: R9 FIX1(2026-10-22)은 고친 그림을 새 길(03_제작기록/r9_fix1/…)에 두고 등록부를 그리로 바꿨다 —
  //  예전 그림(03_hd_assets/hair/female_hair_02_back.png 등)은 런타임 목록에 남아 있지만 그리지 않으니 사이트에 넣지 않는다(알리기만)
  const extra = runtimeHd.filter((p) => !refs.has(p));
  if (extra.length) console.log(`등록부가 가리키지 않아 넣지 않는 고해상도 파일 ${extra.length}개(예: ${extra.slice(0, 3).join(', ')})`);
  for (const rel of refs) take(rel);
  const index = { v: 1, packageId: readyA.packageId, publishedAt: readyA.publishedAt || null,
    code: Object.fromEntries(Object.entries(CODE).map(([k, rel]) => [k, { path: rel, v: v12(runtime.get(rel)) }])),
    manifests: Object.fromEntries(Object.entries(MANIFESTS).map(([k, rel]) => [k, { path: rel, v: v12(runtime.get(rel)) }])) };
  // 목록: 호환 그림(03_png_assets·04_masks — docs/kiugi/<판>/ 사본이 같은지 시험이 본다)과 넣은 파일(want)만 — 등록부가 가리키지 않아 넣지 않은 예전 고해상도 그림은 뺀다(R9 FIX1)
  const listed = [...runtime].filter(([p]) => want.has(p) || /^(03_png_assets|04_masks)\//.test(p));
  const files = { packageId: readyA.packageId, note: '패키지 RUNTIME_FILES.json 의 해시(호환 그림 03_png_assets·04_masks 는 docs/kiugi/<판>/ 사본이 같은지 시험이 본다 · 고해상도는 넣은 것만)', files: Object.fromEntries(listed.sort(([a], [b]) => (a < b ? -1 : 1))) };
  return { packageId: readyA.packageId, want, index, files };
}

function listFiles(dir, base = dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(full, base)); else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

export function syncKiugiHd({ pkg, siteRoot = fileURLToPath(new URL('../', import.meta.url)), check = false, log = console.log } = {}) {
  const { packageId, want, index, files } = readHdPackage(pkg);
  const out = path.join(siteRoot, 'docs', HD_DIR);
  const all = new Map(want);
  all.set('index.json', Buffer.from(JSON.stringify(index, null, 1) + '\n'));
  all.set('files.json', Buffer.from(JSON.stringify(files, null, 1) + '\n'));
  const diff = [];
  for (const [rel, bytes] of all) { let same = false; try { same = fs.readFileSync(path.join(out, ...rel.split('/'))).equals(bytes); } catch {} if (!same) diff.push(rel); }
  const extra = listFiles(out).filter((rel) => !all.has(rel));
  const bytes = [...want.values()].reduce((n, b) => n + b.length, 0);
  if (check) { log(diff.length || extra.length ? `다른 것 ${diff.length} · 남는 것 ${extra.length}` : `고해상도 사본이 패키지와 같아요(${want.size}개 ${(bytes / 1e6).toFixed(1)}MB)`); return { ok: !diff.length && !extra.length, diff, extra }; }
  for (const rel of diff) { const f = path.join(out, ...rel.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, all.get(rel)); }
  for (const rel of extra) fs.rmSync(path.join(out, ...rel.split('/')));
  log(`${packageId}: 고해상도 ${want.size}개(${(bytes / 1e6).toFixed(1)}MB) · 바꾼 것 ${diff.length + extra.length}개 → ${out}`);
  return { ok: true, diff, extra, count: want.size, bytes };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  try { const r = syncKiugiHd({ pkg: args.find((a) => !a.startsWith('--')), check: args.includes('--check') }); if (!r.ok) process.exit(1); }
  catch (e) { console.error('실패:', e.message); process.exit(e.notReady ? 2 : 1); }
}
