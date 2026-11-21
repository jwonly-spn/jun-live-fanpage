// 새로 올린 파일이 바로 보이게(2026-10-18 — GitHub Pages 는 파일을 10분쯤 캐시해서, 올린 뒤에도 방문자 브라우저가 예전 styles.css·화면 모듈을 쓰던 것):
//  docs/index.html·404.html 에 파일마다 내용 해시를 붙인 주소를 적는다 — 바뀐 파일만 새로 받고, 그대로인 파일은 캐시를 그대로 쓴다.
//   · <link rel="stylesheet" href="/styles.css?v=<해시>"> · <script type="module" src="/app.js?v=<해시>">
//   · import map(<script type="importmap">): 화면 모듈마다 "/lib/dom.js" → "/lib/dom.js?v=<해시>" — 모듈끼리 부르는 import('./x.js') 도 이 표를 따른다.
//     (import map 을 모르는 예전 브라우저는 표를 건너뛰고 예전처럼 받는다.) 보안 규칙(CSP)은 이 표 글 하나만 sha256 으로 허용한다(script-src 'self' 'sha256-…').
//   · <link rel="modulepreload">: 화면 모듈을 처음부터 한꺼번에 받기 시작한다(모듈이 모듈을 부르는 차례를 기다리지 않게 — 체험용 mock.js 는 빼고,
//     app.js 에서 정적 import 로 닿지 않는 모듈도 빼고 — reachable).
//  같은 내용이면 다시 써도 그대로(두 번 돌려도 같다). tools/deploy-site.cjs 가 올리기 전에 저절로 부른다.
// 쓰는 법: node tools/stamp.cjs [--check]   (--check: 바꾸지 않고, 다시 찍어야 하면 1 로 끝난다)
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');

const DOCS = path.join(__dirname, '..', 'docs');
const START = '<!--kg-stamp-->', END = '<!--/kg-stamp-->';
const hash = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);
// 처음부터 받지 않는 것: 체험용 mock.js(이 PC 미리 보기만). 시즌 2(2026-11-15)부터 docs/kiugi/ 에는 화면 모듈이 없다(먼치킨 sync 가 넣는 시즌 목록·그림만) —
//  예전 R9 고해상도 모듈 이름(kiugi-hd.js · kiugi-r9-renderer*.js 등)이 다시 생겨도 처음부터 받지 않게 그 규칙은 남겨 둔다. 표(import map)에는 그대로 둔다.
const NO_PRELOAD = new Set(['/mock.js']);
const NO_PRELOAD_RE = /^\/kiugi\/kiugi-(?:hd|r\d+-(?:hd-data|renderer|renderer-hd|hair-color))\.js$/;
// 보스전 보기(2026-11-19): 보는 화면(views/boss.js)·무음 오디오·장면 모듈(kiugi/s2/battle/ — 먼치킨 저장소에서 옮김)은 그 화면에 갔을 때만 받는다.
//  표(import map)에는 넣는다 — 장면 모듈끼리 부르는 './timeline.js' 도 새 파일로 받게.
const LAZY = new Set(['/views/boss.js', '/lib/sound-unlock.js']);
const LAZY_RE = /^\/kiugi\/s2\/battle\//;
const preloadable = (m) => !NO_PRELOAD.has(m) && !NO_PRELOAD_RE.test(m) && !LAZY.has(m) && !LAZY_RE.test(m);

// 미리 받기는 app.js 에서 import 로 실제로 닿는 모듈만(2026-11-16 점검 S9 — 시즌 2 예고 화면이 쓰지 않는 시즌 1 화면 코드 21개를 처음부터 받던 것).
//  정적 import · export from 과, 글자로 적은 import('./x.js')(화면을 그때 부르는 사이트 — 시즌 2 사이트 app.js 의 home·dex)를 따라간다.
//  표(import map)에는 모든 모듈이 그대로 있다.
const STATIC_IMPORT = /(?:(?:^|[;\n])\s*(?:import|export)\s+(?:[^'"`;]*?\sfrom\s*)?|\bimport\(\s*)['"](\.{1,2}\/[^'"]+|\/[^'"]+)['"]/g;
//  skip: 따라가지 않을 모듈(날짜로 갈리는 두 화면 — 예고 쪽을 셀 때는 시즌 2 길잡이를, 시즌 2 쪽을 셀 때는 예고 화면을 건너뛴다).
function reachable(docs = DOCS, entry = '/app.js', skip = []) {
  const seen = new Set(), todo = [entry], no = new Set(skip);
  while (todo.length) {
    const m = todo.pop();
    if (seen.has(m) || no.has(m)) continue;
    const file = path.join(docs, m.replace(/^\//, ''));
    if (!fs.existsSync(file)) continue;
    seen.add(m);
    const src = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const [, spec] of src.matchAll(STATIC_IMPORT)) {
      const next = spec.startsWith('/') ? spec.split('?')[0] : path.posix.join(path.posix.dirname(m), spec).split('?')[0];
      if (!seen.has(next)) todo.push(next);
    }
  }
  return seen;
}

// 화면 모듈(사이트 맨 앞 기준 주소): 맨 위 app.js·api.js·mock.js + lib/ · views/ · kiugi/ 의 .js (spoon.js 는 따로 있는 페이지라 뺀다)
function modules(docs = DOCS) {
  const out = [];
  for (const f of ['app.js', 's2-app.js', 'api.js', 'mock.js']) if (fs.existsSync(path.join(docs, f))) out.push('/' + f);
  for (const dir of ['lib', 'views', 'kiugi', 'kiugi/s2/battle']) {
    const full = path.join(docs, dir);
    if (!fs.existsSync(full)) continue;
    for (const f of fs.readdirSync(full).filter((x) => x.endsWith('.js')).sort()) out.push(`/${dir}/${f}`);
  }
  return out;
}
// 날짜로 저절로 바뀌기(2026-11-21 — docs/lib/launch.js): 2026-12-01 0시(한국) 전에는 예고 화면, 그때부터 시즌 2 화면.
//  index.html 맨 위의 작은 스크립트(BOOT)가 **첫 색과 미리 받기만** 기기 시계로 미리 고른다(진짜 화면 고르기는 app.js 가 서버 시각으로 — 틀렸으면 app.js 가 바로잡는다).
//   · 시작 전: <html class="s2-teaser"> 그대로 + 예고 화면 모듈만 미리 받기(지금 올라가 있는 예고 사이트와 같은 모습·같은 받기).
//   · 시작 뒤(기기 시계가 12월 1일 0시를 넘었거나, 서버가 시작했다고 답한 적이 있는 브라우저): s2-teaser 를 떼고, 시즌 2 화면 모듈·지도 파일을 미리 받기.
//  보안 규칙(CSP)은 이 스크립트 글도 sha256 으로 허용한다(import map 글과 함께 두 개).
const LAUNCH_AT = Date.parse('2026-12-01T00:00:00+09:00');
const TEASER_ENTRY = '/views/teaser.js', S2_ENTRY = '/s2-app.js';
const SUPABASE = 'https://aksegkhhugqvvaidgvro.supabase.co', MAP_FILE = SUPABASE + '/storage/v1/object/public/tr-snap/map.json';
function bootScript({ teaser, s2 }) {
  return `(function(){var d=document,r=d.documentElement,o=Date.now()>=${LAUNCH_AT};`
    + `try{o=o||localStorage.getItem('kg_s2_open')==='1'||sessionStorage.getItem('kg_s2_go')==='1'}catch(e){}`
    + `function add(rel,href,as){var l=d.createElement('link');l.rel=rel;l.href=href;if(as){l.as=as}if(rel!=='modulepreload'){l.crossOrigin='anonymous'}d.head.appendChild(l)}`
    + `if(o){r.classList.remove('s2-teaser');add('preconnect','${SUPABASE}');add('preload','${MAP_FILE}','fetch')}`
    + `(o?${JSON.stringify(s2)}:${JSON.stringify(teaser)}).forEach(function(u){add('modulepreload',u)})})();`;
}
const sha = (text) => `'sha256-${crypto.createHash('sha256').update(text).digest('base64')}'`;
// 찍을 내용: {css, app, map(import map 글), preloadTeaser[주소] · preloadS2[주소](미리 받기 — 화면마다), boot(맨 위 작은 스크립트 글), cspHash(import map) · bootHash}
function plan(docs = DOCS) {
  const read = (p) => fs.readFileSync(path.join(docs, p.replace(/^\//, '')));
  const list = modules(docs), imports = {};
  for (const m of list) imports[m] = `${m}?v=${hash(read(m))}`;
  const map = JSON.stringify({ imports });
  const pick = (used) => list.filter((m) => preloadable(m) && used.has(m)).map((m) => imports[m]);
  const preloadTeaser = pick(reachable(docs, '/app.js', [S2_ENTRY])), preloadS2 = pick(reachable(docs, '/app.js', [TEASER_ENTRY]));
  const boot = bootScript({ teaser: preloadTeaser, s2: preloadS2 });
  return {
    css: `/styles.css?v=${hash(read('/styles.css'))}`,
    app: imports['/app.js'],
    map, preloadTeaser, preloadS2, boot,
    cspHash: sha(map), bootHash: sha(boot),
  };
}
// index.html 글 → 찍은 글
function stampHtml(html, p) {
  let out = html;
  // 보안 규칙: script-src 'self' 뒤의 예전 해시를 바꾼다
  out = out.replace(/script-src 'self'(?: 'sha256-[A-Za-z0-9+/=]+')*;/, `script-src 'self' ${p.cspHash} ${p.bootHash};`);
  out = out.replace(/<link rel="stylesheet" href="\/styles\.css(?:\?v=[0-9a-f]+)?">/, `<link rel="stylesheet" href="${p.css}">`);
  const block = [START, `<script type="importmap">${p.map}</script>`, `<script>${p.boot}</script>`, END].join('\n');
  if (out.includes(START)) out = out.replace(new RegExp(`${START}[\\s\\S]*?${END}`), () => block);
  else out = out.replace(/<script type="module" src="\/app\.js(?:\?v=[0-9a-f]+)?"><\/script>/, (s) => `${block}\n${s}`);
  out = out.replace(/<script type="module" src="\/app\.js(?:\?v=[0-9a-f]+)?"><\/script>/, `<script type="module" src="${p.app}"></script>`);
  return out;
}
function stamp({ docs = DOCS, check = false, log = console.log } = {}) {
  const p = plan(docs), file = path.join(docs, 'index.html');
  const before = fs.readFileSync(file, 'utf8'), after = stampHtml(before, p);
  const stale = after !== before || fs.readFileSync(path.join(docs, '404.html'), 'utf8') !== after;
  if (!check && stale) { fs.writeFileSync(file, after); fs.writeFileSync(path.join(docs, '404.html'), after); }
  log(stale ? (check ? '다시 찍어야 해요: node tools/stamp.cjs' : `찍었어요: 미리 받기 예고 ${p.preloadTeaser.length}개 · 시즌 2 ${p.preloadS2.length}개 · ${p.css}`) : '그대로예요(이미 찍혀 있음).');
  return { stale, plan: p };
}
module.exports = { stamp, plan, stampHtml, modules, preloadable, reachable, bootScript, LAUNCH_AT };

if (require.main === module) {
  const { stale } = stamp({ check: process.argv.includes('--check') });
  if (stale && process.argv.includes('--check')) process.exit(1);
}
