// 시즌 2 "몬스터 영토전" 지도 계산 — DOM 없이 동작(노드 시험이 그대로 부른다).
// 그리는 규칙은 기획 보고서(기획\시즌2-몬스터영토전\report.html)의 MapCore 를 옮겼다: 종이 결 · 물감처럼 번진 경계 · 식민지 줄무늬 · 산·나무·물결.
// 지도 파일 = 영토 서버가 공개 저장소에 올리는 tr-snap/map.json (약속 문서 spec.md 5절):
//   {season, updatedAt, endsAt, grid:{w,h}, owner:"RLE", col:"RLE", djs:[{id,name,color,cap,pct,colPct,ruledPct,dayDelta}], feed:[…], prize:{text}}
//   · owner·col 은 칸(가로 w × 세로 h, 왼쪽 위부터 줄마다)마다 값 하나를 "값*개수" 로 줄인 글: 예 "-2*240,-1*12,3*4,-1" (개수가 1이면 "*1" 생략)
//     owner 값: -2 바다 · -1 아무도 없는 숲 · 그 밖 = 그 칸을 가진 DJ(djs[].id). col 값: -1 = 식민지 아님 · 그 밖 = 원래 주인 DJ(djs[].id)
//     djs[].id 가 모두 정수가 아니면 값 = djs 차례 번호(0부터). 값 쌍 배열([[값,개수],…])·풀어 쓴 배열([값,…])도 받는다.
//   · owner 에 바다(-2)가 하나도 없으면 땅 모양은 사이트가 만든 절차 대륙(continent — report.html MapCore 와 같은 규칙)을 쓴다.
//     Codex 지도 그림(land_mask)이 오면 서버가 바다를 -2 로 넣어야 사이트가 같은 모양을 그린다.
// 청취자 정보는 다루지 않는다(DJ 이름·땅 비율·경계·식민지만).

export const GW = 120, GH = 75;
export const SEA = -2, WILD = -1;
export const S2_START = Date.parse('2026-12-01T00:00:00+09:00');
export const S2_END = Date.parse('2026-12-31T23:59:59+09:00');
export const PRIZE_TEXT = '1등 DJ에게 먼치킨 한 달 무료 이용권 + 상금 486스푼';
export const FEED_MAX = 20, NAME_MAX = 20;

// ---- 노이즈(MapCore 와 같은 식 — 서버의 절차 대륙과 같은 모양이 나와야 한다) ----
export function hash(ix, iy, s) {
  let h = (Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vn(x, y, s) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
export function fbm(x, y, s, o) {
  let v = 0, amp = 0.5, f = 1, t = 0;
  for (let k = 0; k < o; k++) { v += amp * vn(x * f, y * f, s + k * 17); t += amp; f *= 2; amp *= 0.5; }
  return v / t;
}
// 네 이웃 칸
export function neighbors(w, h) {
  return (i, cb) => { const x = i % w, y = (i - x) / w; if (x > 0) cb(i - 1); if (x < w - 1) cb(i + 1); if (y > 0) cb(i - w); if (y < h - 1) cb(i + w); };
}
function blur(src, w, h) {
  const N = w * h, t = new Float32Array(N), o = new Float32Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; t[i] = (src[x > 0 ? i - 1 : i] + src[i] + src[x < w - 1 ? i + 1 : i]) / 3; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; o[i] = (t[y > 0 ? i - w : i] + t[i] + t[y < h - 1 ? i + w : i]) / 3; }
  return o;
}
export const blur2 = (a, w, h) => blur(blur(a, w, h), w, h);

// ---- 절차 대륙(Codex 지도 그림이 오기 전 — 서버와 같은 규칙) ----
export function continent(w = GW, h = GH) {
  const N = w * h, land = new Uint8Array(N), nb4 = neighbors(w, h);
  for (let cy = 0; cy < h; cy++) for (let cx = 0; cx < w; cx++) {
    const i = cy * w + cx, wx = cx + 16 * (fbm(cx * 0.03, cy * 0.03, 5, 3) - 0.5), wy = cy + 12 * (fbm(cx * 0.03 + 40, cy * 0.03 + 40, 6, 3) - 0.5);
    const nx = wx / w * 2 - 1, ny = wy / h * 2 - 1, d = Math.sqrt(nx * nx * 0.72 + ny * ny * 1.0);
    const hh = fbm(wx * 0.055, wy * 0.055, 11, 4) * 0.85 + 0.6 - d * 0.92;
    land[i] = (hh > 0.4 && cx > 3 && cy > 2 && cx < w - 4 && cy < h - 3) ? 1 : 0;
  }
  // 가장 큰 덩어리만 남긴다
  const comp = new Int32Array(N).fill(-1);
  let best = -1, bs = 0, id = 0;
  for (let s = 0; s < N; s++) {
    if (!land[s] || comp[s] >= 0) continue;
    const q = [s]; let sz = 0; comp[s] = id;
    while (q.length) { const c = q.pop(); sz++; nb4(c, (n) => { if (land[n] && comp[n] < 0) { comp[n] = id; q.push(n); } }); }
    if (sz > bs) { bs = sz; best = id; }
    id++;
  }
  for (let k = 0; k < N; k++) land[k] = comp[k] === best ? 1 : 0;
  return land;
}
let continentMemo = null, landOverride = null;
function defaultLand(w, h) {
  if (landOverride && landOverride.w === w && landOverride.h === h) return landOverride.land;
  if (w !== GW || h !== GH) return new Uint8Array(w * h).fill(1);
  return (continentMemo ||= continent(GW, GH));
}
// Codex 대륙 그림(docs/s2/land-grid.json — tools/make-map-art.cjs 가 land_mask 에서 만든 120×75 땅 칸)이 있으면 그 땅 모양을 쓴다(지도 파일 owner 에 바다가 없을 때·시즌 전)
export function landFromGrid(json) {
  const w = json?.w, h = json?.h;
  if (!Number.isSafeInteger(w) || !Number.isSafeInteger(h) || w < 8 || h < 8 || w > 400 || h > 400) return null;
  const v = decodeRle(json.land, w * h);
  return v && v.every((x) => x === 0 || x === 1) ? { w, h, land: Uint8Array.from(v) } : null;
}
export function setDefaultLand(grid) { landOverride = grid && grid.land?.length === grid.w * grid.h ? grid : null; }

// 땅 모양에서 나오는 것: 바다에서 거리(coast)·땅에서 거리(seaD)·산·경계 흔들림·흐린 땅 모양(Lb)·산 그림자(Mb)·장식 자리
export function terrain(land, w, h) {
  const N = w * h, nb4 = neighbors(w, h);
  const mount = new Float32Array(N), lobe = new Float32Array(N), jit = new Float32Array(N);
  for (let cy = 0; cy < h; cy++) for (let cx = 0; cx < w; cx++) {
    const i = cy * w + cx;
    mount[i] = fbm(cx * 0.09 + 7, cy * 0.09 + 3, 31, 3); lobe[i] = fbm(cx * 0.11, cy * 0.11, 77, 3); jit[i] = hash(cx, cy, 99);
  }
  const bfs = (seedTest) => {
    const d = new Int16Array(N).fill(-1), q = [];
    for (let k = 0; k < N; k++) if (seedTest(k)) { d[k] = 0; q.push(k); }
    for (let hd = 0; hd < q.length; hd++) { const c = q[hd]; nb4(c, (n) => { if (d[n] < 0) { d[n] = d[c] + 1; q.push(n); } }); }
    return d;
  };
  const coast = bfs((k) => !land[k]), seaD = bfs((k) => land[k]);
  const mv = [];
  for (let k = 0; k < N; k++) if (land[k] && coast[k] > 3) mv.push(mount[k]);
  mv.sort((a, b) => a - b);
  const MT = mv[Math.floor(mv.length * 0.8)] || 1;
  const Lb = blur2(Float32Array.from(land), w, h);
  const Mb = blur2(Float32Array.from(mount, (v, i) => (land[i] && coast[i] > 3 && v > MT ? Math.min(1, (v - MT) * 12 + 0.4) : 0)), w, h);
  // 장식 자리(칸 단위 좌표): 산 [x, y, 칸, 크기(8칸 그림 기준 px)] · 나무 [x, y, 칸] · 물결 [x, y]
  const mts = [], trees = [], waves = [];
  for (let y = 1; y < h - 1; y += 2) for (let x = 1; x < w - 1; x += 2) {
    const i = y * w + x, j = hash(x, y, 5), jx = x + 0.5 + (hash(x, y, 6) - 0.5) * 1.6, jy = y + 0.5 + (hash(x, y, 7) - 0.5) * 1.6;
    if (land[i] && coast[i] > 3 && mount[i] > MT && j < 0.55) mts.push([jx, jy, i, 8 + Math.min(1, (mount[i] - MT) * 10) * 6]);
    else if (land[i] && coast[i] > 1 && j < 0.42) trees.push([jx, jy, i]);
    else if (!land[i] && seaD[i] >= 3 && seaD[i] <= 10 && j < 0.1) waves.push([jx, jy]);
  }
  return { w, h, N, land, coast, seaD, mount, MT, lobe, jit, Lb, Mb, decor: { mts, trees, waves } };
}

// 종이 결(그림 칸 하나마다) — 칸 크기 S 에 따라 한 번만 만든다
export function paperTexture(CW, CH) {
  const tex = new Float32Array(CW * CH);
  for (let py = 0; py < CH; py++) for (let px = 0; px < CW; px++) tex[py * CW + px] = fbm(px * 0.018, py * 0.018, 21, 3) * 0.7 + hash(px, py, 3) * 0.3;
  return tex;
}

// ---- 줄인 글(RLE) ----
const TOKEN = /^\s*(-?\d{1,6})(?:\s*\*\s*(\d{1,6}))?\s*$/;
export function decodeRle(input, n) {
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  const out = new Int32Array(n);
  let at = 0;
  const put = (v, c) => {
    if (!Number.isSafeInteger(v) || !Number.isSafeInteger(c) || c < 1 || at + c > n) return false;
    out.fill(v, at, at + c); at += c; return true;
  };
  if (typeof input === 'string') {
    if (!input.trim()) return null;
    for (const t of input.split(',')) { const m = TOKEN.exec(t); if (!m || !put(Number(m[1]), m[2] === undefined ? 1 : Number(m[2]))) return null; }
  } else if (Array.isArray(input)) {
    for (const x of input) {
      if (Array.isArray(x)) { if (x.length !== 2 || !put(x[0], x[1])) return null; }
      else if (!put(x, 1)) return null;
    }
  } else return null;
  return at === n ? out : null;
}
export function encodeRle(values) {
  const out = [];
  for (let i = 0; i < values.length;) {
    let j = i + 1;
    while (j < values.length && values[j] === values[i]) j++;
    out.push(j - i > 1 ? `${values[i]}*${j - i}` : String(values[i]));
    i = j;
  }
  return out.join(',');
}

// ---- 색: DJ 가 많아도 서로 구별되게 · 바다와 헷갈리는 파랑 계열은 쓰지 않는다 ----
// 손으로 고른 처음 16색(밝기·채도를 섞어 이웃끼리 구별) → 그 뒤는 파랑을 뺀 색상 고리를 황금각으로 돌며 만든다.
//  빨강 · 호박 · 초록 · 보라 · 청록빛 초록 · 분홍 · 갈색 · 산호 · 주황 · 올리브 · 산딸기 · 먹회색 · 연두 · 황토 · 밤색 · 자홍
export const MAP_PALETTE = [
  [227, 73, 72], [237, 161, 0], [31, 138, 46], [160, 63, 191], [27, 173, 122], [224, 96, 126], [140, 90, 43], [250, 128, 96],
  [212, 86, 28], [107, 142, 35], [184, 51, 106], [92, 92, 98], [154, 205, 50], [200, 160, 110], [120, 50, 50], [208, 60, 168],
];
export function hueSat([r, g, b]) {
  const R = r / 255, G = g / 255, B = b / 255, max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  let hue = 0;
  if (d > 0) hue = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  hue = (hue * 60 + 360) % 360;
  const l = (max + min) / 2, s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { hue, sat: s, light: l };
}
// 파랑 계열(바다·하늘): 색상 175~265도이고 채도가 있는 색
export const isBlueish = (rgb) => { const { hue, sat } = hueSat(rgb); return sat > 0.18 && hue >= 175 && hue < 265; };
function hslRgb(hue, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((hue / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
export function paletteColor(seed) {
  const n = Math.abs(Math.trunc(Number(seed) || 0));
  if (n < MAP_PALETTE.length) return MAP_PALETTE[n].slice();
  const k = n - MAP_PALETTE.length, t = (k * 0.618033988749895) % 1;
  // 쓸 수 있는 색상: 0~175도 + 265~360도(파랑 175~265 빼고)
  let hue = t * 270; if (hue >= 175) hue += 90;
  const light = [0.42, 0.52, 0.34][k % 3], sat = [0.72, 0.6, 0.8][(k >> 1) % 3];
  return hslRgb(hue % 360, sat, light);
}
export function parseColor(value) {
  if (Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every((x) => Number.isFinite(x) && x >= 0 && x <= 255)) return value.slice(0, 3).map(Math.round);
  if (typeof value !== 'string') return null;
  let m = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (m) return [0, 2, 4].map((o) => parseInt(m[1].slice(o, o + 2), 16));
  m = /^#([0-9a-f]{3})$/i.exec(value.trim());
  if (m) return [...m[1]].map((c) => parseInt(c + c, 16));
  m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i.exec(value.trim());
  if (m) { const c = [m[1], m[2], m[3]].map(Number); return c.every((x) => x <= 255) ? c : null; }
  return null;
}
// 서버가 준 색이 있으면 그 색(파랑 계열이면 바꾼다), 없으면 고정 번호로 고른 색
export function djColor(value, seed) {
  const c = parseColor(value);
  return c && !isBlueish(c) ? c : paletteColor(seed);
}
export const cssColor = ([r, g, b], a = 1) => (a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`);

// ---- 지도 파일 읽기 ----
// 보이지 않는 글자·줄바꿈·글 방향 글자(글자 번호로 만든다 — 소스에 유니코드 표기를 쓰면 쓰는 도구가 글자로 풀어 정규식이 깨진다)
const HIDDEN = new RegExp('[' + [[0x00, 0x1f], [0x7f, 0x9f], [0xad, 0xad], [0x200b, 0x200f], [0x2028, 0x202e], [0x2060, 0x206f], [0xfeff, 0xfeff]].map(([a, b]) => String.fromCharCode(a) + '-' + String.fromCharCode(b)).join('') + ']', 'g');
export function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  // 줄바꿈·탭은 띄어쓰기로(붙지 않게), 그 밖의 보이지 않는 글자는 뺀다
  const s = value.replace(/[\t\n\v\f\r]+/g, ' ').replace(HIDDEN, '').replace(/\s+/g, ' ').trim();
  return [...s].slice(0, max).join('');
}
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
function timeOf(v, fallback) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : fallback;
}
function capIndex(v, w, h) {
  let x, y;
  if (Number.isSafeInteger(v)) { if (v < 0 || v >= w * h) return null; return v; }
  if (Array.isArray(v) && v.length >= 2) [x, y] = v;
  else if (v && typeof v === 'object') ({ x, y } = v);
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0 || x >= w || y >= h) return null;
  return y * w + x;
}
// json → 그릴 수 있는 지도 | null(모양이 틀림)
export function parseMap(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const w = Number.isSafeInteger(json.grid?.w) ? json.grid.w : GW, h = Number.isSafeInteger(json.grid?.h) ? json.grid.h : GH;
  if (w < 8 || h < 8 || w > 400 || h > 400) return null;
  const N = w * h;
  const ownerRaw = decodeRle(json.owner, N);
  if (!ownerRaw) return null;
  const colRaw = json.col === undefined || json.col === null ? null : decodeRle(json.col, N);
  const list = (Array.isArray(json.djs) ? json.djs : []).filter((d) => d && typeof d === 'object' && !Array.isArray(d)).slice(0, 500);
  const byId = list.length > 0 && list.every((d) => Number.isSafeInteger(d.id));
  const idx = new Map(byId ? list.map((d, i) => [d.id, i]) : list.map((_, i) => [i, i]));
  const djOf = (v) => (v >= 0 && idx.has(v) ? idx.get(v) : -1);
  let hasSea = false;
  for (let i = 0; i < N; i++) if (ownerRaw[i] <= SEA) { hasSea = true; break; }
  const land = hasSea ? Uint8Array.from(ownerRaw, (v) => (v > SEA ? 1 : 0)) : defaultLand(w, h);
  const owner = new Int16Array(N), col = new Int16Array(N).fill(-1), cells = new Array(list.length).fill(0), colCells = new Array(list.length).fill(0), ruledCells = new Array(list.length).fill(0);
  let landCells = 0;
  for (let i = 0; i < N; i++) {
    if (!land[i]) { owner[i] = SEA; continue; }
    landCells++;
    const k = djOf(ownerRaw[i]);
    owner[i] = k >= 0 ? k : WILD;
    if (k < 0) continue;
    cells[k]++;
    const c = colRaw ? djOf(colRaw[i]) : -1;
    if (c >= 0 && c !== k) { col[i] = c; colCells[k]++; ruledCells[c]++; }
  }
  const pctOf = (n) => (landCells ? (n / landCells) * 100 : 0);
  const djs = list.map((d, i) => {
    const seed = byId ? d.id : i;
    return {
      i, key: String(byId ? d.id : i), name: cleanText(d.name, NAME_MAX) || `DJ ${i + 1}`,
      rgb: djColor(d.color, seed), cap: capIndex(d.cap, w, h), cells: cells[i],
      pct: num(d.pct) ?? pctOf(cells[i]), colPct: num(d.colPct) ?? pctOf(colCells[i]), ruledPct: num(d.ruledPct) ?? pctOf(ruledCells[i]), dayDelta: num(d.dayDelta),
    };
  });
  const feed = (Array.isArray(json.feed) ? json.feed : []).map((x) => (typeof x === 'string' ? { text: cleanText(x, 160) } : x && typeof x === 'object' ? { text: cleanText(x.text, 160), at: timeOf(x.at, null) } : null))
    .filter((x) => x && x.text).slice(0, FEED_MAX);
  const prize = cleanText(json.prize?.text, 80) || PRIZE_TEXT;
  const season = typeof json.season === 'string' ? cleanText(json.season, 20) : cleanText(json.season?.id, 20) || 's2';
  return {
    w, h, N, land, owner, col, djs, landCells, feed, prize, season,
    startsAt: timeOf(json.startsAt ?? json.season?.startsAt, S2_START), endsAt: timeOf(json.endsAt ?? json.season?.endsAt, S2_END),
    updatedAt: timeOf(json.updatedAt, null), wildPct: pctOf(landCells - cells.reduce((s, n) => s + n, 0)), final: json.final === true,
  };
}
// 지도 파일이 없을 때(시즌 시작 전 등): 아무도 없는 땅
export function emptyMap(now = Date.now()) {
  const land = defaultLand(GW, GH), N = GW * GH; // 그림 지도가 있으면 그 땅 칸(setDefaultLand), 없으면 절차 대륙
  const owner = Int16Array.from(land, (v) => (v ? WILD : SEA));
  let landCells = 0; for (const v of land) landCells += v;
  return { w: GW, h: GH, N, land, owner, col: new Int16Array(N).fill(-1), djs: [], landCells, feed: [], prize: PRIZE_TEXT, season: 's2', startsAt: S2_START, endsAt: S2_END, updatedAt: null, wildPct: 100, final: false, empty: true, checkedAt: now };
}
// 같은 지도인가(바뀌었을 때만 다시 그린다)
export function sameMap(a, b) {
  if (!a || !b || a.N !== b.N || a.djs.length !== b.djs.length) return false;
  for (let i = 0; i < a.N; i++) if (a.owner[i] !== b.owner[i] || a.col[i] !== b.col[i]) return false;
  return a.djs.every((d, i) => d.key === b.djs[i].key && d.name === b.djs[i].name && d.rgb.join() === b.djs[i].rgb.join() && d.cap === b.djs[i].cap);
}

// ---- 물감 경계(흐린 땅 몫) ----
// 지도 → {wild, own: Map(DJ 열쇠 → 흐린 몫), col: Map(원래 주인 DJ 열쇠 → 흐린 몫), rgb: Map(열쇠 → 색)}
export function fieldsOf(map) {
  const { w, h, N, owner, col, djs } = map;
  const ind = (test) => { const a = new Float32Array(N); let any = false; for (let i = 0; i < N; i++) if (test(i)) { a[i] = 1; any = true; } return any ? blur2(a, w, h) : null; };
  const own = new Map(), colf = new Map(), rgb = new Map();
  djs.forEach((d, k) => {
    rgb.set(d.key, d.rgb);
    const f = ind((i) => owner[i] === k); if (f) own.set(d.key, f);
    const c = ind((i) => col[i] === k); if (c) colf.set(d.key, c);
  });
  return { N, wild: ind((i) => owner[i] === WILD) || new Float32Array(N), own, col: colf, rgb };
}
// 두 흐린 몫 사이(t=0 옛 지도, 1 새 지도) — 경계가 번지듯 움직인다
export function mixFields(a, b, t) {
  if (!a || t >= 1) return b;
  if (t <= 0) return a;
  const N = b.N, lerp = (x, y) => { const o = new Float32Array(N); for (let i = 0; i < N; i++) { const p = x ? x[i] : 0, q = y ? y[i] : 0; o[i] = p + (q - p) * t; } return o; };
  const mixMap = (A, B) => { const out = new Map(); for (const k of new Set([...A.keys(), ...B.keys()])) out.set(k, lerp(A.get(k), B.get(k))); return out; };
  return { N, wild: lerp(a.wild, b.wild), own: mixMap(a.own, b.own), col: mixMap(a.col, b.col), rgb: new Map([...a.rgb, ...b.rgb]) };
}

// ---- 그리기(픽셀) ----
// geo = {w, h, S, CW, CH, tex, Lb, Mb} · F = fieldsOf/mixFields 결과 · data = ImageData.data(CW×CH×4)
const K = 8, KC = 4, EPS = 0.002;
export function renderMap(data, geo, F) {
  const { w, h, S, CW, CH, tex, Lb, Mb } = geo, N = w * h;
  const layers = [...F.own.keys()], L = layers.length, lf = layers.map((k) => F.own.get(k)), lc = layers.map((k) => F.rgb.get(k) || [128, 128, 128]);
  const ckeys = [...F.col.keys()], cf = ckeys.map((k) => F.col.get(k)), cc = ckeys.map((k) => F.rgb.get(k) || [128, 128, 128]);
  // 칸마다 가까이 있는 주인 목록(숲 = L) — 그림 칸마다 모든 DJ 를 보지 않게
  const cand = new Int16Array(N * K).fill(-1), ccand = new Int16Array(N * KC).fill(-1);
  for (let i = 0; i < N; i++) {
    let n = 0;
    if (F.wild[i] > EPS) cand[i * K + n++] = L;
    for (let k = 0; k < L && n < K; k++) if (lf[k][i] > EPS) cand[i * K + n++] = k;
    let m = 0;
    for (let k = 0; k < ckeys.length && m < KC; k++) if (cf[k][i] > EPS) ccand[i * KC + m++] = k;
  }
  const seen = new Int32Array(L + 1).fill(-1), cseen = new Int32Array(ckeys.length + 1).fill(-1);
  let p = 0;
  for (let py = 0; py < CH; py++) {
    const gy = (py + 0.5) / S - 0.5, iy = Math.floor(gy), fy = gy - iy, y0 = iy < 0 ? 0 : iy, y1 = iy + 1 > h - 1 ? h - 1 : iy + 1;
    for (let px = 0; px < CW; px++, p++) {
      const gx = (px + 0.5) / S - 0.5, ix = Math.floor(gx), fx = gx - ix, x0 = ix < 0 ? 0 : ix, x1 = ix + 1 > w - 1 ? w - 1 : ix + 1;
      const A = y0 * w + x0, B = y0 * w + x1, C = y1 * w + x0, D = y1 * w + x1, w0 = (1 - fx) * (1 - fy), w1 = fx * (1 - fy), w2 = (1 - fx) * fy, w3 = fx * fy;
      const l = Lb[A] * w0 + Lb[B] * w1 + Lb[C] * w2 + Lb[D] * w3, T = tex[p];
      let r, g, b;
      if (l < 0.5) {
        const s = Math.min(1, (0.5 - l) * 2.6); r = 200 - 52 * s; g = 222 - 34 * s; b = 226 - 20 * s;
        const sh = 0.94 + 0.1 * T; r *= sh; g *= sh; b *= sh;
        if (l > 0.46) { const e = (l - 0.46) / 0.04; r += (68 - r) * e * 0.75; g += (78 - g) * e * 0.75; b += (80 - b) * e * 0.75; }
      } else {
        let bk = -1, bv = -1, sk = -1, sv = 0;
        for (const corner of [A, B, C, D]) for (let j = 0; j < K; j++) {
          const k = cand[corner * K + j]; if (k < 0) break;
          if (seen[k] === p) continue; seen[k] = p;
          const f = k === L ? F.wild : lf[k], v2 = f[A] * w0 + f[B] * w1 + f[C] * w2 + f[D] * w3;
          if (v2 > bv) { sk = bk; sv = bv < 0 ? 0 : bv; bk = k; bv = v2; } else if (v2 > sv) { sv = v2; sk = k; }
        }
        let mt = Mb[A] * w0 + Mb[B] * w1 + Mb[C] * w2 + Mb[D] * w3; if (mt > 1) mt = 1;
        r = 242 - 12 * mt; g = 233 - 20 * mt; b = 208 - 26 * mt;
        const edge = bv - sv;
        if (bk === L || bk < 0) {
          r += (196 - r) * 0.55; g += (208 - g) * 0.55; b += (160 - b) * 0.55;
          if (sk >= 0 && sk < L && edge < 0.08) { const c0 = lc[sk], z = (1 - edge / 0.08) * 0.7; r += (c0[0] * 0.62 - r) * z; g += (c0[1] * 0.62 - g) * z; b += (c0[2] * 0.62 - b) * z; }
        } else {
          const c1 = lc[bk]; let al = 0.3 + 0.34 * (1 - Math.min(1, edge / 0.5)); al *= 0.88 + 0.24 * T;
          r += (c1[0] - r) * al; g += (c1[1] - g) * al; b += (c1[2] - b) * al;
          // 식민지: 이긴 DJ 색 위에 원래 주인 색 줄무늬
          if (((px + py) % 16) < 6) {
            for (const corner of [A, B, C, D]) {
              let done = false;
              for (let j = 0; j < KC; j++) {
                const k = ccand[corner * KC + j]; if (k < 0) break;
                if (cseen[k] === p) continue; cseen[k] = p;
                const f = cf[k], cv = f[A] * w0 + f[B] * w1 + f[C] * w2 + f[D] * w3;
                if (cv > 0.5) { const c3 = cc[k]; r += (c3[0] - r) * 0.5; g += (c3[1] - g) * 0.5; b += (c3[2] - b) * 0.5; done = true; break; }
              }
              if (done) break;
            }
          }
          if (edge < 0.08) { const z2 = (1 - edge / 0.08) * 0.75; r += (c1[0] * 0.62 - r) * z2; g += (c1[1] * 0.62 - g) * z2; b += (c1[2] * 0.62 - b) * z2; }
        }
        const sh2 = 0.9 + 0.15 * T; r *= sh2; g *= sh2; b *= sh2;
        if (l < 0.53) { const e2 = 1 - (l - 0.5) / 0.03; r += (68 - r) * e2 * 0.75; g += (78 - g) * e2 * 0.75; b += (80 - b) * e2 * 0.75; }
      }
      const q4 = p * 4; data[q4] = r; data[q4 + 1] = g; data[q4 + 2] = b; data[q4 + 3] = 255;
    }
  }
}

// ---- 그림 지도 위에 덧칠할 물감(투명한 층) ----
// Codex 대륙 그림이 있으면 바탕은 그 그림, 이 층은 DJ 땅만 물감처럼 칠한다(숲·바다는 투명 — 그림이 그대로 보인다).
//  경계 가까이는 물감이 고인 듯 진하게, 경계선은 DJ 색을 어둡게, 식민지는 원래 주인 색 줄무늬. 해안선은 화면에서 land.png 로 자른다(lib/map-draw.js).
//  geo = {w, h, S, CW, CH, tex(종이 결 — 물감 얼룩)} · data = 투명 층 ImageData.data
export function renderOverlay(data, geo, F) {
  const { w, h, S, CW, CH, tex } = geo, N = w * h;
  const layers = [...F.own.keys()], L = layers.length, lf = layers.map((k) => F.own.get(k)), lc = layers.map((k) => F.rgb.get(k) || [128, 128, 128]);
  const ckeys = [...F.col.keys()], cf = ckeys.map((k) => F.col.get(k)), cc = ckeys.map((k) => F.rgb.get(k) || [128, 128, 128]);
  const cand = new Int16Array(N * K).fill(-1), ccand = new Int16Array(N * KC).fill(-1);
  for (let i = 0; i < N; i++) {
    let n = 0;
    if (F.wild[i] > EPS) cand[i * K + n++] = L;
    for (let k = 0; k < L && n < K; k++) if (lf[k][i] > EPS) cand[i * K + n++] = k;
    let m = 0;
    for (let k = 0; k < ckeys.length && m < KC; k++) if (cf[k][i] > EPS) ccand[i * KC + m++] = k;
  }
  const seen = new Int32Array(L + 1).fill(-1), cseen = new Int32Array(ckeys.length + 1).fill(-1);
  let p = 0;
  for (let py = 0; py < CH; py++) {
    const gy = (py + 0.5) / S - 0.5, iy = Math.floor(gy), fy = gy - iy, y0 = iy < 0 ? 0 : iy, y1 = iy + 1 > h - 1 ? h - 1 : iy + 1;
    for (let px = 0; px < CW; px++, p++) {
      const gx = (px + 0.5) / S - 0.5, ix = Math.floor(gx), fx = gx - ix, x0 = ix < 0 ? 0 : ix, x1 = ix + 1 > w - 1 ? w - 1 : ix + 1;
      const A = y0 * w + x0, B = y0 * w + x1, C = y1 * w + x0, D = y1 * w + x1, w0 = (1 - fx) * (1 - fy), w1 = fx * (1 - fy), w2 = (1 - fx) * fy, w3 = fx * fy;
      let bk = -1, bv = -1, sk = -1, sv = 0;
      for (const corner of [A, B, C, D]) for (let j = 0; j < K; j++) {
        const k = cand[corner * K + j]; if (k < 0) break;
        if (seen[k] === p) continue; seen[k] = p;
        const f = k === L ? F.wild : lf[k], v2 = f[A] * w0 + f[B] * w1 + f[C] * w2 + f[D] * w3;
        if (v2 > bv) { sk = bk; sv = bv < 0 ? 0 : bv; bk = k; bv = v2; } else if (v2 > sv) { sv = v2; sk = k; }
      }
      const T = tex[p], edge = bv - sv, q4 = p * 4;
      let r = 0, g = 0, b = 0, a = 0;
      if (bk >= 0 && bk < L) {
        const c1 = lc[bk];
        r = c1[0]; g = c1[1]; b = c1[2];
        a = (0.36 + 0.24 * (1 - Math.min(1, edge / 0.5))) * (0.84 + 0.32 * T);
        if (((px + py) % 16) < 6) {
          for (const corner of [A, B, C, D]) {
            let done = false;
            for (let j = 0; j < KC; j++) {
              const k = ccand[corner * KC + j]; if (k < 0) break;
              if (cseen[k] === p) continue; cseen[k] = p;
              const f = cf[k], cv = f[A] * w0 + f[B] * w1 + f[C] * w2 + f[D] * w3;
              if (cv > 0.5) { const c3 = cc[k]; r += (c3[0] - r) * 0.7; g += (c3[1] - g) * 0.7; b += (c3[2] - b) * 0.7; a = Math.max(a, 0.62); done = true; break; }
            }
            if (done) break;
          }
        }
        if (edge < 0.08) { const z = 1 - edge / 0.08; r += (c1[0] * 0.6 - r) * z; g += (c1[1] * 0.6 - g) * z; b += (c1[2] * 0.6 - b) * z; a += (0.82 - a) * z; }
      } else if (bk === L && sk >= 0 && sk < L && edge < 0.08) {
        const c0 = lc[sk], z = 1 - edge / 0.08;
        r = c0[0] * 0.6; g = c0[1] * 0.6; b = c0[2] * 0.6; a = 0.6 * z;
      }
      data[q4] = r; data[q4 + 1] = g; data[q4 + 2] = b; data[q4 + 3] = a * 255;
    }
  }
}

// ---- 이름 자리 ----
// inside(i) 인 칸 중 밖에서 가장 먼 칸(덩어리 한가운데)
export function pole(w, h, inside, fallback) {
  const N = w * h, nb4 = neighbors(w, h), dist = new Int16Array(N).fill(-1), q = [];
  for (let i = 0; i < N; i++) if (!inside(i)) { dist[i] = 0; q.push(i); }
  for (let hd = 0; hd < q.length; hd++) { const c = q[hd]; nb4(c, (m) => { if (dist[m] < 0) { dist[m] = dist[c] + 1; q.push(m); } }); }
  let bi = fallback, bd = -1;
  for (let i = 0; i < N; i++) if (inside(i) && dist[i] > bd) { bd = dist[i]; bi = i; }
  return bi;
}
// 기지(성) 자리: 서버가 준 cap, 없으면 자기 땅 한가운데
export function capOf(map, k) {
  const d = map.djs[k];
  if (d.cap !== null && d.cap !== undefined && map.owner[d.cap] === k) return d.cap;
  if (!d.cells) return null;
  return pole(map.w, map.h, (i) => map.owner[i] === k && map.col[i] < 0, pole(map.w, map.h, (i) => map.owner[i] === k, null));
}
// DJ 이름표: 땅이 있는 DJ 만 — {k, key, name, x, y(0~1 비율), cells, pct, colPct, ruledPct, dayDelta, cap}
export function labelsOf(map) {
  const { w, h } = map, out = [];
  map.djs.forEach((d, k) => {
    if (!d.cells) return;
    const cap = capOf(map, k);
    const bi = pole(w, h, (i) => map.owner[i] === k && map.col[i] < 0, cap ?? pole(w, h, (i) => map.owner[i] === k, 0));
    let lx = (bi % w) + 0.5, ly = Math.floor(bi / w) + 0.5;
    if (cap !== null) {
      const kx = (cap % w) + 0.5, ky = Math.floor(cap / w) + 0.5;
      if (Math.abs(lx - kx) < 5 && Math.abs(ly - ky) < 4) { lx = kx; ly = ky - 5.6; }
    }
    out.push({ k, key: d.key, name: d.name, x: lx / w, y: Math.max(0.04, ly / h), cells: d.cells, pct: d.pct, colPct: d.colPct, ruledPct: d.ruledPct, dayDelta: d.dayDelta, cap });
  });
  return out;
}
// 식민지 덩어리마다 "○○ 땅 · △△ 지배 중" (○○ = 원래 주인, △△ = 지금 가진 DJ) — 작은 조각(min 칸 아래)은 글을 쓰지 않는다
export function coloniesOf(map, min = 10) {
  const { w, h, N, owner, col } = map, nb4 = neighbors(w, h), seen = new Uint8Array(N), out = [];
  for (let s = 0; s < N; s++) {
    if (seen[s] || col[s] < 0) continue;
    const ruler = owner[s], from = col[s], q = [s], cells = [];
    seen[s] = 1;
    while (q.length) { const c = q.pop(); cells.push(c); nb4(c, (m) => { if (!seen[m] && owner[m] === ruler && col[m] === from) { seen[m] = 1; q.push(m); } }); }
    if (cells.length < min) continue;
    const set = new Set(cells), bi = pole(w, h, (i) => set.has(i), cells[0]);
    out.push({ ruler, from, rulerName: map.djs[ruler]?.name || '', fromName: map.djs[from]?.name || '', x: ((bi % w) + 0.5) / w, y: (Math.floor(bi / w) + 0.5) / h, cells: cells.length, pct: map.landCells ? (cells.length / map.landCells) * 100 : 0 });
  }
  return out;
}
export const colonyText = (c) => `${c.fromName} 땅 · ${c.rulerName} 지배 중`;

// ---- 글 ----
export const f1 = (v) => (Math.round((Number(v) || 0) * 10) / 10).toFixed(1);
export function pctText(v) { return `${f1(v)}%`; }
// 어제보다: +0.6% · −0.4% · 그대로
export function deltaText(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '';
  const r = Math.round(v * 10) / 10;
  if (r === 0) return '어제와 같아요';
  return `어제보다 ${r > 0 ? '+' : '−'}${Math.abs(r).toFixed(1)}%`;
}
const KST = 9 * 3600000, DAY = 86400000;
const kstDay = (t) => Math.floor((t + KST) / DAY);
// 남은 날: before(시작 전 — days = 시작까지) · during(days = 끝나는 날까지, 0 = 오늘이 마지막 날) · ended
export function seasonClock(map, now = Date.now()) {
  const starts = map?.startsAt ?? S2_START, ends = map?.endsAt ?? S2_END;
  if (map?.final || now > ends) return { state: 'ended', days: 0 };
  if (now < starts) return { state: 'before', days: kstDay(starts) - kstDay(now) };
  return { state: 'during', days: kstDay(ends) - kstDay(now) };
}
export function clockText(c) {
  if (c.state === 'ended') return '시즌이 끝났어요 · 마지막 지도예요';
  if (c.state === 'before') return c.days <= 0 ? '오늘 밤 0시에 시작해요' : `12월 1일 0시에 시작해요 · ${c.days}일 남았어요`;
  return c.days <= 0 ? '오늘이 마지막 날이에요 · 밤 11시 59분에 끝나요' : `12월 31일까지 ${c.days}일 남았어요`;
}
// 순위(땅 넓은 순, 같으면 이름 순)
export function ranking(map) {
  return map.djs.filter((d) => d.cells > 0 || d.pct > 0).slice().sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name, 'ko'));
}
