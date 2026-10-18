// 가벼운 그림 사본 만들기(2026-10-18 사이트 새 구조 — 빠르게): docs/kiugi/ 의 큰 그림 중 메인 카드에 자주 나오는 것을 WebP 로 줄여 docs/kiugi-lite/ 에 둔다.
//  지금은 공통 배경(kiugi/bg/background_XX.png — 1024 불투명 장면 그림, 한 장 1.4~1.9MB) → 같은 크기 WebP(품질 0.86, 한 장 약 0.1~0.2MB).
//  캐릭터 조각(몸·옷·머리·마스크)은 줄이지 않는다 — 카드 칸이 커서(휴대폰 한 장 · PC 3장) 1024 그대로가 필요하고, 저장하기 그림은 원본 PNG 와 픽셀이 같아야 한다.
//  docs/kiugi/ 는 먼치킨 저장소 tools/sync-kiugi-site.mjs 가 통째로 맞춰 쓰는 폴더라(모르는 파일은 지운다) 사본은 그 밖(docs/kiugi-lite/)에 둔다.
//  목록 docs/kiugi-lite/index.json = {v:1, files:{"/kiugi/bg/background_01.png": {v:<원본 ?v= 값>, file:"bg/background_01.webp", t:<사본 해시 앞 12자>}}}
//  — 사이트(lib/raster.js liteUrl)는 원본 주소의 ?v= 가 목록의 v 와 같을 때만 사본을 쓴다(원본 그림이 바뀌었는데 사본을 다시 만들지 않았으면 원본 그대로).
// 쓰는 법(그림이 바뀌면 — sync-kiugi-site 다음에):
//   <electron.exe> tools/make-lite-art.cjs [사이트 폴더(기본: 이 저장소)]
//   숨은 창으로만 그린다(창·오류 상자를 띄우지 않는다). 기록은 임시 폴더의 kiugi-make-lite.log(사이트에 올리지 않게 docs 밖).
const { app, BrowserWindow, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const site = path.resolve(process.argv.slice(2).find((a) => !a.startsWith('-') && !a.endsWith('.cjs')) || path.join(__dirname, '..'));
const docs = path.join(site, 'docs'), out = path.join(docs, 'kiugi-lite');
fs.mkdirSync(out, { recursive: true });
const logFile = path.join(require('os').tmpdir(), 'kiugi-make-lite.log');
fs.writeFileSync(logFile, '');
const log = (m) => fs.appendFileSync(logFile, new Date().toISOString() + ' ' + m + '\n');
dialog.showErrorBox = (t, c) => log('오류 상자(띄우지 않음) ' + t + ' ' + c);
process.on('uncaughtException', (e) => { log('멈춤 ' + (e && e.stack || e)); app.exit(1); });
process.on('unhandledRejection', (e) => { log('멈춤 ' + (e && e.stack || e)); app.exit(1); });
setTimeout(() => { log('시간 초과'); app.exit(2); }, 300000).unref?.();
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});

const QUALITY = 0.86;
// 원본 그림 목록: 그림 목록 파일(kiugi-<판>-data.js — R9 는 kiugi-r9-data.js)의 공통 배경(dir /kiugi/bg/)
function backgrounds() {
  const name = fs.readdirSync(path.join(docs, 'kiugi')).filter((n) => /^kiugi-[a-z]\d+-data\.js$/.test(n)).sort().pop();
  if (!name) throw Error('그림 목록(kiugi-<판>-data.js)이 없어요');
  const src = fs.readFileSync(path.join(docs, 'kiugi', name), 'utf8');
  const list = [];
  for (const m of src.matchAll(/\{[^{}]*"category":"background"[^{}]*\}/g)) {
    const a = JSON.parse(m[0]);
    if (a.dir === '/kiugi/bg/' && /^[a-z0-9_]+\.png$/.test(a.file) && /^[0-9a-f]{6,}$/.test(a.v)) list.push(a);
  }
  return list;
}
// docs/ 를 잠깐 내보내는 작은 서버(캔버스가 같은 출처 그림만 읽을 수 있어서)
function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const file = path.normalize(path.join(docs, p));
      if (!file.startsWith(docs + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': file.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

app.whenReady().then(async () => {
  const server = await serve(), port = server.address().port;
  const win = new BrowserWindow({ width: 200, height: 200, show: false, webPreferences: { backgroundThrottling: false } });
  await win.loadURL(`http://127.0.0.1:${port}/kiugi/manifest.json`);
  const index = { v: 1, quality: QUALITY, files: {} };
  let before = 0, after = 0;
  for (const a of backgrounds()) {
    const url = `/kiugi/bg/${a.file}`;
    const b64 = await win.webContents.executeJavaScript(`(async () => {
      const img = new Image(); img.src = ${JSON.stringify(url)} + '?v=' + ${JSON.stringify(a.v)};
      await img.decode();
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const blob = await new Promise((r) => c.toBlob(r, 'image/webp', ${QUALITY}));
      if (!blob || blob.type !== 'image/webp') return null;
      const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode(...buf.subarray(i, i + 32768));
      return btoa(s);
    })()`);
    if (!b64) { log('WebP 를 만들지 못함 ' + a.file); continue; }
    const bytes = Buffer.from(b64, 'base64'), name = 'bg/' + a.file.replace(/\.png$/, '.webp');
    fs.mkdirSync(path.join(out, 'bg'), { recursive: true });
    fs.writeFileSync(path.join(out, name), bytes);
    const srcSize = fs.statSync(path.join(docs, 'kiugi', 'bg', a.file)).size;
    before += srcSize; after += bytes.length;
    index.files[url] = { v: a.v, file: name, t: crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 12) };
    log(`${a.file} ${srcSize} → ${bytes.length}`);
  }
  // 목록에 없는 예전 사본은 지운다
  const keep = new Set(Object.values(index.files).map((f) => f.file));
  for (const name of fs.existsSync(path.join(out, 'bg')) ? fs.readdirSync(path.join(out, 'bg')) : []) if (!keep.has('bg/' + name)) fs.rmSync(path.join(out, 'bg', name));
  fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(index, null, 1) + '\n');
  log(`끝: ${Object.keys(index.files).length}장 ${before} → ${after} 바이트`);
  win.destroy(); server.close();
  app.exit(0);
});
