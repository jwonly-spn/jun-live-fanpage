// 시즌 2 영토 지도 그림 넣기(2026-11-15): Codex 대륙 그림(continent_s2.png 2400×1500)과 땅 마스크(land_mask.png — 땅 255 · 물 0)로 사이트 파일을 만든다.
//  · docs/s2/continent.webp  — 지도 바탕 그림(1600×1000, 휴대폰에서도 가볍게)
//  · docs/s2/land.png         — 땅 모양(1600×1000, 땅 = 불투명 흰색 · 바다·호수·강 = 투명): DJ 색 물감이 해안선 밖으로 넘치지 않게 자른다
//  · docs/s2/land-grid.json   — 보이지 않는 격자 120×75 의 땅 칸 {w, h, rule, land:"값*개수,…"}(값 1 땅 · 0 물). 칸 하나 = 원본 20×20 픽셀,
//                               그 안 땅 픽셀(마스크 128 이상)이 절반 이상이면 땅. 영토 서버(territory)도 같은 규칙을 쓰면 지도와 땅 % 가 어긋나지 않는다.
// 쓰는 법: <electron.exe> tools/make-map-art.cjs [대륙 그림 png] [땅 마스크 png]
//   숨은 창으로만 일한다(창·오류 상자를 띄우지 않는다). 기록은 임시 폴더의 kiugi-map-art.log.
'use strict';
const { app, BrowserWindow, nativeImage, dialog } = require('electron');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');

const SRC_DIR = 'C:\\Users\\User\\Documents\\JUN LIVE 작업\\기획\\시즌2-몬스터영토전\\시안\\02_지도';
const [srcMap = path.join(SRC_DIR, 'continent_s2.png'), srcMask = path.join(SRC_DIR, 'land_mask.png')] = process.argv.slice(2).filter((a) => !a.startsWith('--') && /\.png$/i.test(a));
const OUT = path.join(__dirname, '..', 'docs', 's2');
const W = 1600, H = 1000, GW = 120, GH = 75;
const logFile = path.join(os.tmpdir(), 'kiugi-map-art.log');
fs.writeFileSync(logFile, '');
const log = (m) => fs.appendFileSync(logFile, new Date().toISOString() + ' ' + m + '\n');
dialog.showErrorBox = (t, c) => log('오류 상자(띄우지 않음) ' + t + ' ' + c);
process.on('uncaughtException', (e) => { log('멈춤 ' + ((e && e.stack) || e)); app.exit(1); });
process.on('unhandledRejection', (e) => { log('멈춤 ' + ((e && e.stack) || e)); app.exit(1); });
setTimeout(() => { log('시간 초과'); app.exit(2); }, 90000).unref?.();
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});

function rle(values) {
  const out = [];
  for (let i = 0; i < values.length;) { let j = i + 1; while (j < values.length && values[j] === values[i]) j++; out.push(j - i > 1 ? `${values[i]}*${j - i}` : String(values[i])); i = j; }
  return out.join(',');
}

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const map = nativeImage.createFromPath(srcMap), mask = nativeImage.createFromPath(srcMask);
  if (map.isEmpty() || mask.isEmpty()) throw Error('그림을 읽지 못했어요: ' + srcMap + ' · ' + srcMask);
  const ms = mask.getSize(), mp = map.getSize();
  log(`원본 지도 ${mp.width}x${mp.height} · 마스크 ${ms.width}x${ms.height}`);
  if (ms.width !== mp.width || ms.height !== mp.height) throw Error('지도와 마스크 크기가 달라요');
  if (Math.abs(ms.width / ms.height - GW / GH) > 0.001) throw Error('지도 비율이 120:75 가 아니에요');
  // 1) 격자: 칸마다 땅 픽셀 비율(원본 해상도 그대로 — 테두리 흐림 없이)
  const mb = mask.toBitmap(), cw = ms.width / GW, ch = ms.height / GH, grid = new Array(GW * GH).fill(0);
  let landCells = 0;
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    let land = 0, all = 0;
    for (let y = Math.round(gy * ch); y < Math.round((gy + 1) * ch); y++) for (let x = Math.round(gx * cw); x < Math.round((gx + 1) * cw); x++) { all++; if (mb[(y * ms.width + x) * 4] >= 128) land++; }
    if (land * 2 >= all) { grid[gy * GW + gx] = 1; landCells++; }
  }
  fs.writeFileSync(path.join(OUT, 'land-grid.json'), JSON.stringify({ w: GW, h: GH, rule: '칸 하나 = 원본 지도 20×20 픽셀 · 그 안 땅 픽셀(land_mask 128 이상)이 절반 이상이면 땅(1)', source: path.basename(srcMask), land: rle(grid) }) + '\n');
  log(`격자 땅 칸 ${landCells} / ${GW * GH}`);
  // 2) 땅 모양(1600×1000, 알파 = 마스크)
  const small = mask.resize({ width: W, height: H, quality: 'best' }).toBitmap(), rgba = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) { rgba[i * 4] = 255; rgba[i * 4 + 1] = 255; rgba[i * 4 + 2] = 255; rgba[i * 4 + 3] = small[i * 4 + 2]; }
  fs.writeFileSync(path.join(OUT, 'land.png'), nativeImage.createFromBitmap(rgba, { width: W, height: H }).toPNG());
  // 3) 바탕 그림(WebP — 숨은 창의 캔버스로 만든다)
  const resized = map.resize({ width: W, height: H, quality: 'best' });
  const win = new BrowserWindow({ show: false, width: 400, height: 300, webPreferences: { offscreen: true, sandbox: true, contextIsolation: true } });
  await win.loadURL('data:text/html;charset=utf-8,<canvas></canvas>');
  const dataUrl = await win.webContents.executeJavaScript(`new Promise((ok, no) => { const i = new Image(); i.onload = () => { const c = document.querySelector('canvas'); c.width = ${W}; c.height = ${H}; c.getContext('2d').drawImage(i, 0, 0); ok(c.toDataURL('image/webp', 0.8)); }; i.onerror = () => no('그림 못 읽음'); i.src = ${JSON.stringify(resized.toDataURL())}; })`);
  if (!/^data:image\/webp;base64,/.test(dataUrl)) throw Error('WebP 를 만들지 못했어요');
  fs.writeFileSync(path.join(OUT, 'continent.webp'), Buffer.from(dataUrl.split(',')[1], 'base64'));
  for (const f of ['continent.webp', 'land.png', 'land-grid.json']) log(`저장 docs/s2/${f} ${fs.statSync(path.join(OUT, f)).size} bytes`);
  app.exit(0);
});
