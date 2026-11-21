// 날짜로 저절로 바뀌는 사이트 확인 사진(2026-11-21): 가짜 시각으로 docs/ 를 열어 찍는다.
//  쓰는 법: <electron.exe> tools/shots-launch.cjs <사진 폴더> [--docs <docs 폴더>] [--set 기본|시계|넘김|비교]
//   · 이 PC 안의 작은 서버(127.0.0.1 임의 포트)가 docs/ 를 보여 주고, 답의 Date 머리글을 **가짜 서버 시각**으로 준다.
//   · 화면(방문자 기기) 시계도 가짜로 바꾼다(미리 넣는 스크립트가 Date 를 바꿈) — 서버 시각과 다르게 줄 수도 있다(틀린 시계 흉내).
//   · 영토·키우기 서버(supabase)로 가는 요청은 모두 막는다(진짜 서버에 묻지 않음). 127.0.0.1 에서는 사이트의 체험용 mock.js 가 지어낸 지도·보스전을 답한다.
//   · 숨은 창으로만 일한다. 결과: <사진 폴더>/*.png + 기록.json(사진마다 고른 화면·시계 출처·요청한 주소).
'use strict';
const { app, BrowserWindow, session, dialog, nativeImage } = require('electron');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');

const args = process.argv.slice(2);
const flag = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const OUT = path.resolve(args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')) && !/shots-launch\.cjs$/.test(a)) || path.join(os.tmpdir(), 'kiugi-launch-shots'));
const DOCS = path.resolve(flag('--docs', path.join(__dirname, '..', 'docs')));
const SET = flag('--set', '기본');
fs.mkdirSync(OUT, { recursive: true });
const logFile = path.join(OUT, '기록.log');
fs.writeFileSync(logFile, '');
const log = (m) => fs.appendFileSync(logFile, m + '\n');
dialog.showErrorBox = (t, c) => log('오류 상자(띄우지 않음) ' + t + ' ' + c);
process.on('uncaughtException', (e) => { log('멈춤 ' + ((e && e.stack) || e)); app.exit(1); });
process.on('unhandledRejection', (e) => { log('멈춤 ' + ((e && e.stack) || e)); app.exit(1); });
setTimeout(() => { log('시간 초과'); app.exit(2); }, 9 * 60e3).unref?.();
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});

const kst = (s) => Date.parse(s + '+09:00');
const T = { before: kst('2026-11-30T23:59:00'), after: kst('2026-12-01T00:01:00'), mid: kst('2026-12-15T21:00:00') };
const DAY = 86400e3;
const SIZES = { pc: { width: 1440, height: 900 }, 휴대폰: { width: 390, height: 844 } };
const SLUG = 'nyangdj7'; // 체험용 mock.js 의 지어낸 DJ 주소

// 가짜 서버 시각: 사진마다 정한다(지금 찍는 사진의 시작 시각에서 실제로 흐른 만큼 흐른다)
let serverBase = Date.now(), serverT0 = Date.now(), frozen = false;
const serverNow = () => (frozen ? serverBase : serverBase + (Date.now() - serverT0));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8' };
let clockOff = false; // true 면 Date 머리글을 주지 않는다(서버 시각을 못 받는 경우 흉내)
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  let file = path.normalize(path.join(DOCS, p)), status = 200;
  if (!file.startsWith(DOCS) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { file = path.join(DOCS, '404.html'); status = 404; }
  res.sendDate = false;
  const head = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' };
  if (!clockOff) head.Date = new Date(serverNow()).toUTCString();
  res.writeHead(status, head);
  res.end(req.method === 'HEAD' ? undefined : fs.readFileSync(file));
});

// 화면 시계 바꾸기(창마다 미리 넣는 스크립트 파일)
function preloadFile(deviceAt, freeze) {
  const f = path.join(os.tmpdir(), `kiugi-shot-preload-${process.pid}-${Math.random().toString(36).slice(2)}.js`);
  fs.writeFileSync(f, `(() => { const R = Date, base = ${deviceAt}, t0 = ${Date.now()}, freeze = ${freeze ? 'true' : 'false'};
    const now = () => (freeze ? base : base + (R.now() - t0));
    class D extends R { constructor(...a) { if (a.length === 0) super(now()); else super(...a); } static now() { return now(); } }
    window.Date = D; })();`);
  return f;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let shotN = 0;
const records = [];
// 한 장 찍기. opt: { name, size, path, serverAt, deviceAt(없으면 서버와 같음), settle(ms), full(긴 사진도), calm(움직임 줄이기), freeze(시계 멈춤), noClock, storage({local:{…}}), steps(async (win) => …) }
async function shot(port, opt) {
  const size = SIZES[opt.size];
  serverBase = opt.serverAt; serverT0 = Date.now(); frozen = Boolean(opt.freeze); clockOff = Boolean(opt.noClock);
  const part = `shot-${process.pid}-${++shotN}`;
  const ses = session.fromPartition(part);
  const asked = [];
  ses.webRequest.onBeforeRequest((d, cb) => {
    const u = new URL(d.url);
    if (u.hostname === '127.0.0.1') { asked.push(`${d.method} ${u.pathname}`); cb({}); return; }
    asked.push(`${d.method} ${u.origin}${u.pathname}`);
    cb({ cancel: /supabase\.co$/.test(u.hostname) }); // 진짜 서버에는 묻지 않는다(글꼴 CDN 만 그대로)
  });
  const pre = preloadFile(opt.deviceAt ?? opt.serverAt, opt.freeze);
  const win = new BrowserWindow({ show: false, frame: false, useContentSize: true, width: size.width, height: size.height, webPreferences: { offscreen: true, partition: part, preload: pre, contextIsolation: false, sandbox: false, nodeIntegration: false, backgroundThrottling: false } });
  win.webContents.setAudioMuted(true);
  const errors = [];
  win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) errors.push(String(message).slice(0, 300)); });
  const origin = `http://127.0.0.1:${port}`;
  // 화면 크기 흉내는 글 하나를 먼저 연 뒤에 건다(빈 창에 바로 걸면 이 Electron 이 멈춘다)
  await win.loadURL(origin + '/robots.txt');
  const dbg = win.webContents.debugger;
  dbg.attach('1.3');
  if (opt.size === '휴대폰') await dbg.sendCommand('Emulation.setDeviceMetricsOverride', { width: size.width, height: size.height, deviceScaleFactor: 2, mobile: true });
  else await dbg.sendCommand('Emulation.setDeviceMetricsOverride', { width: size.width, height: size.height, deviceScaleFactor: 1, mobile: false });
  if (opt.calm) await dbg.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  if (opt.storage) { // 저장해 둔 값이 있는 브라우저 흉내: 먼저 연 글(같은 주소)에서 적어 둔다
    await win.webContents.executeJavaScript(`(() => { const s = ${JSON.stringify(opt.storage)}; for (const [k, v] of Object.entries(s.local || {})) localStorage.setItem(k, v); for (const [k, v] of Object.entries(s.session || {})) sessionStorage.setItem(k, v); })()`);
  }
  asked.length = 0;
  await win.loadURL(origin + opt.path).catch((e) => log(`${opt.name}: 열기 ${e.message}`));
  await wait(opt.settle ?? 3500);
  const grab = async (suffix, full) => {
    let clip;
    if (full) {
      const m = await dbg.sendCommand('Page.getLayoutMetrics');
      const h = Math.min(Math.ceil(m.cssContentSize.height), 14000);
      clip = { x: 0, y: 0, width: size.width, height: h, scale: 1 };
    }
    const r = await dbg.sendCommand('Page.captureScreenshot', { format: 'png', ...(full ? { captureBeyondViewport: true, clip } : {}) });
    const file = path.join(OUT, `${opt.name}${suffix}.png`);
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    return file;
  };
  const state = () => win.webContents.executeJavaScript(`({ teaser: document.documentElement.classList.contains('s2-teaser'), clock: document.documentElement.dataset.clock || null, route: document.body.dataset.route || null, title: document.title, path: location.pathname + location.search + location.hash, theme: document.querySelector('meta[name="theme-color"]')?.content, h1: (document.querySelector('h1')?.textContent || '').trim().slice(0, 60), countdown: [...document.querySelectorAll('[data-time]')].map((e) => e.textContent).join(':'), started: document.querySelector('.tz-started') ? !document.querySelector('.tz-started').hidden : null, open: (() => { try { return localStorage.getItem('kg_s2_open'); } catch { return null; } })() })`);
  const rec = { name: opt.name, size: opt.size, url: opt.path, server: new Date(opt.serverAt).toISOString(), device: new Date(opt.deviceAt ?? opt.serverAt).toISOString(), files: [] };
  rec.files.push(path.basename(await grab('', false)));
  rec.state = await state();
  if (opt.steps) await opt.steps({ win, grab, state, rec, wait });
  if (opt.full) rec.files.push(path.basename(await grab('-긴', true)));
  rec.asked = [...new Set(asked)];
  rec.supabase = rec.asked.filter((x) => /supabase/.test(x));
  rec.errors = errors;
  records.push(rec);
  log(`${opt.name}: ${rec.state.teaser ? '예고' : '시즌 2'} · 시계 ${rec.state.clock} · ${rec.state.title}`);
  try { dbg.detach(); } catch { /* 이미 떼어짐 */ }
  win.destroy();
  try { fs.unlinkSync(pre); } catch { /* 무시 */ }
  return rec;
}

// 두 사진이 같은지(픽셀) — 다른 픽셀 수와 비율
function diffPng(a, b) {
  const A = nativeImage.createFromPath(a), B = nativeImage.createFromPath(b), sa = A.getSize(), sb = B.getSize();
  if (sa.width !== sb.width || sa.height !== sb.height) return { same: false, why: `크기 다름 ${sa.width}x${sa.height} / ${sb.width}x${sb.height}` };
  const x = A.toBitmap(), y = B.toBitmap();
  let n = 0, big = 0;
  for (let i = 0; i < x.length; i += 4) { const d = Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]); if (d > 0) n++; if (d > 48) big++; }
  return { same: n === 0, size: `${sa.width}x${sa.height}`, differ: n, big, pct: Number((100 * n / (x.length / 4)).toFixed(4)) };
}

app.whenReady().then(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  log(`docs ${DOCS} · 포트 ${port} · 묶음 ${SET}`);
  if (SET === '기본') {
    // 가짜 시각 셋 × 화면 셋 × PC·휴대폰
    for (const size of ['pc', '휴대폰']) {
      for (const [tn, at, home, boss, live] of [
        ['1130-2359', T.before, '/', '/boss', `/b/${SLUG}`],
        ['1201-0001', T.after, '/?empty=1&fights=0', '/boss?fights=0', `/b/${SLUG}?fights=0`],   // 0시 1분: 아직 땅을 가진 방·보스전이 없다
        ['1215', T.mid, '/?day=15&still=1', '/boss', `/b/${SLUG}`],                     // 시즌 한가운데(지어낸 지도·보스전)
      ]) {
        await shot(port, { name: `${tn}-첫화면-${size}`, size, path: home, serverAt: at, full: true, calm: false, settle: 4500 });
        await shot(port, { name: `${tn}-boss-${size}`, size, path: boss, serverAt: at, settle: 4000 });
        await shot(port, { name: `${tn}-b주소-${size}`, size, path: live, serverAt: at, settle: 9000 });
      }
    }
  } else if (SET === '시계') {
    // 방문자 시계가 틀린 경우: 서버 시각대로 골라야 한다
    await shot(port, { name: '시계-서버1130-기기1205(5일빠름)-pc', size: 'pc', path: '/', serverAt: T.before, deviceAt: T.before + 5 * DAY });
    await shot(port, { name: '시계-서버1130-기기1205(5일빠름)-boss-pc', size: 'pc', path: '/boss', serverAt: T.before, deviceAt: T.before + 5 * DAY });
    await shot(port, { name: '시계-서버1130-기기1205(5일빠름)-휴대폰', size: '휴대폰', path: `/b/${SLUG}`, serverAt: T.before, deviceAt: T.before + 5 * DAY });
    await shot(port, { name: '시계-서버1130-기기1120(10일늦음)-pc', size: 'pc', path: '/', serverAt: T.before, deviceAt: T.before - 10 * DAY });
    await shot(port, { name: '시계-서버1215-기기1125(20일늦음)-pc', size: 'pc', path: '/?day=15&still=1', serverAt: T.mid, deviceAt: T.mid - 20 * DAY });
    await shot(port, { name: '시계-서버1215-기기1125(20일늦음)-휴대폰', size: '휴대폰', path: `/b/${SLUG}`, serverAt: T.mid, deviceAt: T.mid - 20 * DAY, settle: 9000 });
    await shot(port, { name: '시계-서버1201-기기3분늦음-pc', size: 'pc', path: '/?empty=1', serverAt: T.after, deviceAt: T.after - 3 * 60e3 });
    // 서버 시각을 못 받는 경우(Date 머리글 없음): 방문자 시계로
    await shot(port, { name: '시계-서버답없음-기기1130-pc', size: 'pc', path: '/', serverAt: T.before, noClock: true });
    await shot(port, { name: '시계-서버답없음-기기1215-pc', size: 'pc', path: '/?day=15&still=1', serverAt: T.mid, noClock: true });
    // 서버가 시작했다고 답한 적 있는 브라우저(시계가 거꾸로 가 있어도 시즌 2)
    await shot(port, { name: '시계-시작기억있음-기기1125-pc', size: 'pc', path: '/?day=15&still=1', serverAt: T.mid, deviceAt: T.mid - 20 * DAY, storage: { local: { kg_s2_open: '1' } } });
  } else if (SET === '넘김') {
    // 예고 화면을 켜 둔 채 0시를 넘김: 23:59:52 에 열고 → 0시가 되면 저절로 시즌 2 화면
    for (const size of ['pc', '휴대폰']) {
      await shot(port, {
        name: `넘김-235952에열기-${size}`, size, path: '/?empty=1&fights=0', serverAt: kst('2026-11-30T23:59:52'), settle: 3000,
        steps: async ({ grab, state, rec, wait: w }) => { await w(11000); rec.files.push(path.basename(await grab('-0시뒤', false))); rec.after = await state(); },
      });
    }
    // 기기 시계가 2분 빠른 방문자: 카운트다운도 서버 시각에 맞는다(0시 전에는 넘어가지 않는다)
    await shot(port, { name: '넘김-기기2분빠름-서버235900-pc', size: 'pc', path: '/', serverAt: T.before, deviceAt: T.before + 2 * 60e3, settle: 5000 });
  } else if (SET === '비교') {
    // 지금 올라가 있는 예고(main)와 같은지 견주는 사진: 시계 멈춤 · 움직임 줄이기 · 긴 사진
    for (const size of ['pc', '휴대폰']) {
      await shot(port, { name: `비교-첫화면-${size}`, size, path: '/', serverAt: kst('2026-11-25T12:00:00'), freeze: true, calm: true, full: true, settle: 5000 });
      await shot(port, { name: `비교-예전주소-${size}`, size, path: '/k/abcdefgh', serverAt: kst('2026-11-25T12:00:00'), freeze: true, calm: true, settle: 4000 });
    }
    const other = flag('--with', '');
    if (other) {
      const out = {};
      for (const f of fs.readdirSync(OUT).filter((x) => x.endsWith('.png'))) if (fs.existsSync(path.join(other, f))) out[f] = diffPng(path.join(OUT, f), path.join(other, f));
      fs.writeFileSync(path.join(OUT, '비교-결과.json'), JSON.stringify(out, null, 1));
    }
  }
  fs.writeFileSync(path.join(OUT, `기록-${SET}.json`), JSON.stringify(records, null, 1));
  server.close();
  app.exit(0);
});
