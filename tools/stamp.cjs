// 새로 올린 파일이 바로 보이게(2026-10-18 — GitHub Pages 는 파일을 10분쯤 캐시해서, 올린 뒤에도 방문자 브라우저가 예전 styles.css·화면 모듈을 쓰던 것):
//  docs/index.html·404.html 에 파일마다 내용 해시를 붙인 주소를 적는다 — 바뀐 파일만 새로 받고, 그대로인 파일은 캐시를 그대로 쓴다.
//   · <link rel="stylesheet" href="/styles.css?v=<해시>"> · <script type="module" src="/app.js?v=<해시>">
//   · import map(<script type="importmap">): 화면 모듈마다 "/lib/dom.js" → "/lib/dom.js?v=<해시>" — 모듈끼리 부르는 import('./x.js') 도 이 표를 따른다.
//     (import map 을 모르는 예전 브라우저는 표를 건너뛰고 예전처럼 받는다.) 보안 규칙(CSP)은 이 표 글 하나만 sha256 으로 허용한다(script-src 'self' 'sha256-…').
//   · <link rel="modulepreload">: 화면 모듈을 처음부터 한꺼번에 받기 시작한다(모듈이 모듈을 부르는 차례를 기다리지 않게 — 체험용 mock.js 는 빼고).
//  같은 내용이면 다시 써도 그대로(두 번 돌려도 같다). tools/deploy-site.cjs 가 올리기 전에 저절로 부른다.
// 쓰는 법: node tools/stamp.cjs [--check]   (--check: 바꾸지 않고, 다시 찍어야 하면 1 로 끝난다)
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');

const DOCS = path.join(__dirname, '..', 'docs');
const START = '<!--kg-stamp-->', END = '<!--/kg-stamp-->';
const hash = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);
const NO_PRELOAD = new Set(['/mock.js']);

// 화면 모듈(사이트 맨 앞 기준 주소): 맨 위 app.js·api.js·mock.js + lib/ · views/ · kiugi/ 의 .js (spoon.js 는 따로 있는 페이지라 뺀다)
function modules(docs = DOCS) {
  const out = [];
  for (const f of ['app.js', 'api.js', 'mock.js']) if (fs.existsSync(path.join(docs, f))) out.push('/' + f);
  for (const dir of ['lib', 'views', 'kiugi']) {
    const full = path.join(docs, dir);
    if (!fs.existsSync(full)) continue;
    for (const f of fs.readdirSync(full).filter((x) => x.endsWith('.js')).sort()) out.push(`/${dir}/${f}`);
  }
  return out;
}
// 찍을 내용: {css, app, map(import map 글), preload[주소], cspHash}
function plan(docs = DOCS) {
  const read = (p) => fs.readFileSync(path.join(docs, p.replace(/^\//, '')));
  const list = modules(docs), imports = {};
  for (const m of list) imports[m] = `${m}?v=${hash(read(m))}`;
  const map = JSON.stringify({ imports });
  return {
    css: `/styles.css?v=${hash(read('/styles.css'))}`,
    app: imports['/app.js'],
    map,
    preload: list.filter((m) => !NO_PRELOAD.has(m)).map((m) => imports[m]),
    cspHash: `'sha256-${crypto.createHash('sha256').update(map).digest('base64')}'`,
  };
}
// index.html 글 → 찍은 글
function stampHtml(html, p) {
  let out = html;
  // 보안 규칙: script-src 'self' 뒤의 예전 해시를 바꾼다
  out = out.replace(/script-src 'self'(?: 'sha256-[A-Za-z0-9+/=]+')*;/, `script-src 'self' ${p.cspHash};`);
  out = out.replace(/<link rel="stylesheet" href="\/styles\.css(?:\?v=[0-9a-f]+)?">/, `<link rel="stylesheet" href="${p.css}">`);
  const block = [START, `<script type="importmap">${p.map}</script>`, ...p.preload.map((u) => `<link rel="modulepreload" href="${u}">`), END].join('\n');
  if (out.includes(START)) out = out.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block);
  else out = out.replace(/<script type="module" src="\/app\.js(?:\?v=[0-9a-f]+)?"><\/script>/, (s) => `${block}\n${s}`);
  out = out.replace(/<script type="module" src="\/app\.js(?:\?v=[0-9a-f]+)?"><\/script>/, `<script type="module" src="${p.app}"></script>`);
  return out;
}
function stamp({ docs = DOCS, check = false, log = console.log } = {}) {
  const p = plan(docs), file = path.join(docs, 'index.html');
  const before = fs.readFileSync(file, 'utf8'), after = stampHtml(before, p);
  const stale = after !== before || fs.readFileSync(path.join(docs, '404.html'), 'utf8') !== after;
  if (!check && stale) { fs.writeFileSync(file, after); fs.writeFileSync(path.join(docs, '404.html'), after); }
  log(stale ? (check ? '다시 찍어야 해요: node tools/stamp.cjs' : `찍었어요: 모듈 ${p.preload.length + 1}개 · ${p.css}`) : '그대로예요(이미 찍혀 있음).');
  return { stale, plan: p };
}
module.exports = { stamp, plan, stampHtml, modules };

if (require.main === module) {
  const { stale } = stamp({ check: process.argv.includes('--check') });
  if (stale && process.argv.includes('--check')) process.exit(1);
}
