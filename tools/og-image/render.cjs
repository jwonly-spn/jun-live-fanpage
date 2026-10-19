// 공유 미리보기 그림 만들기(2026-10-20): tools/og-image/og.html 을 숨은 창(화면 밖 그리기)에서 1200x630 으로 찍어 docs/og.png 로 둔다.
//  카카오톡·디스코드 등에 키우기.com 링크를 붙였을 때 보이는 그림(index.html·404.html 의 og:image). 캔버스로 합성하지 않고 글·그림을 HTML 그대로 찍는다.
//  글꼴은 이 PC 의 Noto Sans KR(없으면 맑은 고딕) — 인터넷에서 받지 않는다. 그림을 바꾸려면 og.html·chars/ 를 고친 뒤 다시 돌린다(예: 시즌이 바뀔 때).
// 쓰는 법: <electron.exe> tools/og-image/render.cjs
//   숨은 창으로만 그린다(창·오류 상자를 띄우지 않는다). 기록은 임시 폴더의 kiugi-og-image.log(사이트에 올리지 않게 docs 밖).
'use strict';
const { app, BrowserWindow, dialog } = require('electron');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');

const out = path.join(__dirname, '..', '..', 'docs', 'og.png');
const logFile = path.join(os.tmpdir(), 'kiugi-og-image.log');
fs.writeFileSync(logFile, '');
const log = (m) => fs.appendFileSync(logFile, new Date().toISOString() + ' ' + m + '\n');
dialog.showErrorBox = (t, c) => log('오류 상자(띄우지 않음) ' + t + ' ' + c);
process.on('uncaughtException', (e) => { log('멈춤 ' + ((e && e.stack) || e)); app.exit(1); });
process.on('unhandledRejection', (e) => { log('멈춤 ' + ((e && e.stack) || e)); app.exit(1); });
setTimeout(() => { log('시간 초과'); app.exit(2); }, 60000).unref?.();
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1200, height: 630, useContentSize: true, frame: false, webPreferences: { offscreen: true, sandbox: true, contextIsolation: true } });
  let last = null;
  win.webContents.on('paint', (_e, _dirty, image) => { last = image; });
  win.webContents.setFrameRate(30);
  await win.loadFile(path.join(__dirname, 'og.html'));
  const info = await win.webContents.executeJavaScript(`document.fonts.ready
    .then(() => Promise.all([...document.images].map((i) => i.decode().then(() => i.naturalWidth + 'x' + i.naturalHeight, () => 'fail'))))
    .then((imgs) => ({ imgs, w: innerWidth, h: innerHeight, dpr: devicePixelRatio }))`);
  log('쪽 ' + JSON.stringify(info));
  if (info.imgs.includes('fail')) throw Error('캐릭터 그림을 읽지 못했어요: ' + info.imgs.join(', '));
  win.webContents.invalidate();
  await new Promise((r) => setTimeout(r, 800));
  let img = await win.webContents.capturePage();
  if (img.isEmpty() && last) img = last;
  const { width, height } = img.getSize();
  if (width !== 1200 || height !== 630) throw Error(`크기가 ${width}x${height} 예요(1200x630 이어야 해요)`);
  fs.writeFileSync(out, img.toPNG());
  log('저장 ' + out + ' ' + fs.statSync(out).size + ' bytes');
  app.exit(0);
});
