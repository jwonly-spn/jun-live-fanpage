// 보스전 보기 — 전투 장면 모듈 (빌드 없이 쓰는 ES 모듈, 다른 꾸러미 안 씀). 키우기.com 과 봇 키우기 탭이 같이 쓴다.
// 쓰는 법:
//   const ctl = await playFight(칸, script, { sound:false, nameOf, live:{startAt, now}, land, onEnd });
//   script  = 싸움 대본(FightScript v1 — 봇 fight-script.mjs. events 는 짧은 배열 그대로)
//             모집 중이면 events 없이 { boss:{type,name,aoe,stage}, joinUntil, joined } 만 → 보스 등장 + 남은 시간 + 참전 수
//   nameOf  = (member, i) => 이름표 글. 없으면 member.label(사이트: 키우기 아이디 · 봇 탭: 닉네임), 그것도 없으면 몬스터 이름
//             기본 이름표(nameOf 없음)는 label 의 # 앞만 보인다("솜사탕#먼치" → "솜사탕"). nameOf 가 준 글은 그대로(비면 몬스터 이름)
//   live    = { startAt(싸움 시작 — 서버 ms), now(서버 시계 ms 를 주는 함수) } → 지금−시작만큼 건너뛰어 그 장면부터. 끝났으면 결과 장면만
//   land    = 땅 변화(영토 서버 답 — 대본에는 null 로 오고 나중에 따로 온다). 늦게 오면 ctl.setLand(land)
//   ctl     = { stop, pause, seek, layout, setSound, toggleSound, setMusicVolume, setLand, updateJoin, destroy, duration, marks, time, done, scene, audioState, usingReal, drawStats, portrait, canvas }
//   참전이 많으면(11/21) 같은 그림은 한 번 칠한 것을 다시 쓰고, 뒤에 오는 몬스터가 모두 덮는 몬스터는 그리지 않는다(화면 결과는 같다 — framePixels 머리말)
//   opts 더(11/19 — 휴대폰·스푼 앱 안 창. 키우기.com 이 쓴다, 안 주면 예전과 같다): maxDpr(화면 배율 상한 — 캔버스가 너무 커지지 않게) · particles(0~1, 입자 양 — 약한 기기는 줄임)
//             · audio(makeAudio 로 만든 소리를 밖에서 넘김 — 모집 중 → 싸움으로 장면을 바꿔도 같은 소리 길을 이어 씀. 넘긴 소리는 destroy 가 닫지 않는다)
//   끝난 결과 장면은 20초 뒤부터 1초에 8장만 그린다(IDLE — 스푼 앱 안 창에 30분까지 떠 있어도 가볍게). 새 상태(땅 결과·크기·건너뛰기)가 오면 잠깐 다시 모두 그린다.
//   못 받은 그림은 그 장면에서는 대신 그림으로 두고, 다음 장면(playFight 를 다시 부를 때)에 다시 받아 본다.
//   다시 보기는 없다(사용자 결정 11/18). 모집 중 → 싸움으로 넘어갈 때는 ctl.destroy() 뒤 대본 전체로 playFight 를 다시 부른다.
// 그림: battle/manifest.json(tools/battle-manifest.mjs 가 만듦)에 있는 도트만 받고, 없는 것은 대신 그림으로:
//   보스 → ../boss_<속성>.png 를 도트처럼 줄임 · 몬스터 → ../monster_<종>_<단계>.webp 를 도트처럼 줄임 · 배경·발판 → 속성별로 그려 냄
//   (11/19 본그림 1묶음: 보스 6 · 배경 6 + 발판 pad_<쪽>_<배경>(화산은 pad_<쪽>) · 효과 6 은 진짜 도트가 들어 있다 — 넣기: node tools/kiugi-battle-art-check.mjs <묶음> --넣기)
// 음악: music/ 의 8bit Action Boss Battle (MintoDog, CC0 — music/source.txt). 소리를 켤 때 비로소 받는다.
import { TIMING, buildTimeline, liveOffset, sceneAt, landLine, labelFor, joinWords } from './timeline.js';
export { TIMING, buildTimeline, liveOffset, sceneAt } from './timeline.js';

// ── 소리 크기 · 음악 (소리는 처음엔 꺼져 있고, 켤 때 비로소 음악 파일을 받아요) ──
export const AUDIO = {
  music: 0.5,       // 음악 크기(0~1). ctl.setMusicVolume(v) 로도 바꿈
  // 11/18 사용자 "배경음악 때문에 효과음이 잘 안 들려" — 재어 보니 효과음이 음악보다 8~9dB 작았다 →
  //  효과음 0.7 · 모든 효과음 밑에서 음악을 낮춤(보통 0.5배, 큰 효과음 0.3배) · 효과음 끝에 리미터. 사용자 "잘 들려" 한 값이라 바꾸지 않는다
  sfx: 0.7,         // 효과음 크기
  duck: 0.3,        // 큰 효과음(약점·광역기·포효 …)이 날 때 음악을 잠깐 이만큼으로 낮춤
  duckSoft: 0.5,    // 보통 효과음(때리기·맞기 …)이 날 때
  crossfade: 0.6,   // 곡이 바뀔 때 겹치는 시간(초)
  winFade: 0.35,    // 이겼을 때 음악이 빠지는 시간(승리 소리가 들리게 빨리)
  loseFade: 3.0,    // 졌을 때는 천천히
  tracks: { main: '8bit_action_boss_battle_bpm145.mp3', climax: '8bit_action_boss_battle_climax_bpm185.mp3' },
};

// 그림·음악 자리: 이 파일이 있는 폴더(battle/) 기준. playFight(..., { assets:{ base } }) 로 통째로, 또는 하나씩 바꿀 수 있어요
const HERE = new URL('.', import.meta.url).href.replace(/\/$/, '');
function assetDirs(a = {}) {
  const base = String(a.base || HERE).replace(/\/$/, '');
  return { base, sprites: `${base}/sprites`, effects: `${base}/effects`, bg: `${base}/bg`, music: `${base}/music`,
    placeholder: `${base}/..`, // 대신 그림: s2 폴더의 boss_<속성>.png · monster_<종>_<단계>.webp
    manifest: `${base}/manifest.json`, ...a, base };
}
export const DEFAULT_ASSETS = assetDirs();

// ── 좌우 뒤집기 표: 우리 몬스터는 오른쪽(보스 쪽)을 봐야 해요. 왼쪽을 보는 그림만 true ('*' = 따로 적지 않은 나머지 모두) ──
//   sprites = 도트 폴더의 진짜 그림 · placeholder = 대신 쓰는 그림.  playFight(..., { flip: {...} }) 로도 바꿀 수 있어요
export const FLIP = {
  sprites: {},                 // 뒷모습(싸울 때)
  front: {},                   // 앞모습(<이름>_front, 들어올 때)
  placeholder: { '*': true },  // 대신 그림을 뒷모습 자리에 쓸 때: 원래 그림이 왼쪽 앞을 봐서 뒤집음
  placeholderFront: {},        // 대신 그림을 앞모습으로 쓸 때(원래 앞모습이라 그대로)
  // 보스(왼쪽 = 우리 편을 봐야 함). 본그림 1묶음(11/19) 여섯 마리는 모두 왼쪽을 보거나(두꺼비·그루각·들소·고래) 정면(크라켄·뇌우라)이라 뒤집지 않는다
  boss: { boss_fire: false, boss_water: false, boss_grass: false, boss_earth: false, boss_wind: false, boss_electric: false },
};
const flipOf = (map, id) => !!(map[id] ?? map['*']);

const FONT_CSS = 'https://cdn.jsdelivr.net/npm/galmuri@2.40.3/dist/galmuri.css';
const FONT_L = '"Galmuri11","DungGeunMo","Malgun Gothic","Apple SD Gothic Neo",sans-serif';
const FONT_S = '"Galmuri9","Galmuri11","Malgun Gothic","Apple SD Gothic Neo",sans-serif';

// ── 색 ──
const C = {
  cream: '#fff1d6', ink: '#1a0b1e', gold: '#ffd24a', ember: '#ff7a2f', red: '#ff5a4a',
  teal: '#5ef0b4', dim: '#d9b8c4', grey: '#8a7684', hurt: '#ff9a7a',
};
const TYPE_COLOR = { fire: '#ff7a2f', water: '#5fc8ff', grass: '#8fe04a', electric: '#ffe65a', earth: '#e0a85a', wind: '#b8f0e0' };
const TYPE_RGB = { fire: '255,110,40', water: '70,170,255', grass: '120,220,70', electric: '255,226,80', earth: '224,160,80', wind: '170,240,225' };
const TYPE_RAMP = {
  fire: ['#fff3b0', '#ffd24a', '#ff7a2f', '#d8342c'],
  water: ['#f0fdff', '#9be4ff', '#4aa8f0', '#2b5fc0'],
  grass: ['#f2ffc0', '#b4f060', '#5cc24a', '#2a7a3c'],
  electric: ['#ffffff', '#fff7a0', '#ffd83a', '#f09a1c'],
  earth: ['#fff0c8', '#f0c878', '#c88a4a', '#7a4a2c'],
  wind: ['#ffffff', '#d8fff4', '#8fe0d0', '#4a9aa8'],
};
const rampOf = t => TYPE_RAMP[t] || TYPE_RAMP.fire;

// ── 보스 속성마다: 배경 · 광역기 연출 ──
const BG_OF = { fire: 'volcano', water: 'sea', grass: 'forest', earth: 'canyon', wind: 'sky', electric: 'storm' };
// 배경 그림(bg/<이름>.png)에서 땅이 시작하는 높이 — 세로 화면은 여기서 잘라 하늘은 그대로·땅은 2배로 늘린다(그림마다 달라서 재어 둠)
export const BG_HORIZON = { volcano: 112, sea: 116, forest: 102, canyon: 116, sky: 122, storm: 117 };
// 세로 화면에서 그림 위쪽의 남는 자리: 보통은 맨 윗줄 색으로 칠한다(하늘). 숲은 맨 위까지 나무라서 띠가 생기므로 그림 윗부분을 거울처럼 뒤집어 잇는다
const BG_TOP_MIRROR = { forest: true };
// 세로 화면에서 보스가 서는 높이(발 y). hz = 배경에서 땅이 시작하는 높이 · bodyH = 보스 몸 높이 · art = 배경 그림이 있는지
//  · 땅 선(2·hz − 40)보다 14 아래에 서되, 땅이 낮게 시작하는 그림(바다·협곡·하늘·뇌운)에서도 198 을 넘지 않는다
//    — 그 아래는 여럿일 때 무리 뒷줄(y 233, 머리 ≈ 213)이 서는 자리라 보스 발판(아래 끝 = y + 15)이 덮게 된다. 198 = 화산 견본의 자리
//  · 키 큰 보스가 위 글과 겹치지 않게 몸 + 62 는 지킨다. 숲 그림만(땅이 높게 시작해 보스가 올라감) 등장 글(이름·단계)까지 피하게 몸 + 92
const BOSS_Y_MAX = 198, BOSS_HEAD_ROOM = 62, BG_BOSS_HEAD_ROOM = { forest: 92 };
export function portraitBossY({ hz, bodyH, bg, art }) {
  return Math.max(Math.min(2 * hz - 40 + 14, BOSS_Y_MAX), bodyH + ((art && BG_BOSS_HEAD_ROOM[bg]) || BOSS_HEAD_ROOM));
}
//  icon = 광역기 이름 앞 그림 · strike = 몬스터마다 떨어지는 것 · lead = 맞기 얼마 전에 보이기 시작하는지(ms) · order = 맞는 차례
const AOE = {
  fire:     { title: '분화',       icon: '🌋', strike: 'rock', lead: 420, sfx: 'erupt',  hitSfx: 'rock',  flash: '#ffb060' }, // 등에서 용암이 솟고 바위가 쏟아짐
  water:    { title: '소용돌이',   icon: '🌊', strike: 'drop', lead: 520, sfx: 'splash', hitSfx: 'drip',  flash: '#9be4ff' }, // 발밑이 소용돌이치고 물줄기가 감겨 듦
  grass:    { title: '뿌리 지진', icon: '🌿', strike: 'root', lead: 330, sfx: 'quake',  hitSfx: 'rock',  flash: '#b4f060' }, // 땅이 갈라지고 뿌리가 솟음
  earth:    { title: '모래 폭풍', icon: '🌪', strike: 'sand', lead: 300, sfx: 'gale',   hitSfx: 'weak',  flash: '#f0c878' }, // 모래바람이 화면을 쓸고 지나감
  wind:     { title: '구름 행진', icon: '☁',  strike: 'gust', lead: 260, sfx: 'gale',   hitSfx: 'tick',  flash: '#d8fff4' }, // 구름 떼가 지나가며 돌풍을 내리꽂음
  electric: { title: '번개 그물', icon: '⚡', strike: 'bolt', lead: 70,  sfx: 'thunder', hitSfx: 'zap',   flash: '#fff7a0' }, // 번개가 몬스터 사이를 그물처럼 이음
};

// ── 자리 ──
const HI_SCALE = 0.66; // 무리 속 한 명이 주목받을 때 크기
const MON_BODY = [40, 54, 68]; // 대신 그림의 몸 크기(단계 1·2·3 — 진짜 도트와 같은 크기)

// ── 작은 도구 ──
const ease = {
  lin: p => p,
  out: p => 1 - Math.pow(1 - p, 3),
  in: p => p * p * p,
  back: p => { const c = 1.9; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// 장면 옵션(11/19): 화면 배율(상한 maxDpr 가 0 보다 클 때만 그 아래로) · 입자 양(0~1, 안 주면 1) · 입자 하나를 넣을지(양이 1 이면 늘 넣는다)
export const sceneDpr = (deviceDpr, maxDpr) => Math.min(deviceDpr || 1, maxDpr > 0 ? maxDpr : Infinity);
export const particleShare = (v) => (v == null ? 1 : clamp(+v || 0, 0, 1));
export const keepParticle = (k, rnd = Math.random) => !(k < 1 && rnd() >= k);
// 결과 장면 쉬기(2026-11-19): 끝나고 afterMs 가 지났고 움직이는 것(busy — 뜨는 글·입자·흔들림)이 없으면 frameMs 마다 한 장만(0 = 쉬지 않고 모두 그림).
//  새 상태가 오면(wake — 땅 결과·크기·건너뛰기·멈춤) wakeMs 동안은 다시 모두 그린다. 싸우는 중·모집 중(done 아님)은 늘 모두.
export const IDLE = Object.freeze({ afterMs: 20000, frameMs: 125, wakeMs: 2000 });
// 모집 화면 제목 크기: 두 배로 그린 너비(그림 글자까지)가 화면 너비에서 양옆 4씩 뺀 것에 들어가면 2, 넘치면 1(세로 화면 180 에서 "결과를 기다리는 중"이 잘리지 않게)
export const joinTitleScale = (wideAt2, W) => (wideAt2 <= W - 8 ? 2 : 1);
export const idleFrameMs = ({ done, busy, sinceDone, sinceWake }) => (done && !busy && sinceDone >= IDLE.afterMs && sinceWake >= IDLE.wakeMs ? IDLE.frameMs : 0);

// ── 무리 그리기 가볍게(2026-11-21 시즌 2 검수 S5 — 참전 수백 명이면 한 장면마다 모두를 하나씩 그렸다) ──
//  ① 같은 그림은 한 번만 만든다(playFight 의 tintedOf): 같은 그림·같은 장·같은 어둡기면 처음 칠한 것을 다시 쓴다(반짝임·금빛·번쩍임이 있을 때와
//     늘이거나 돌려 그릴 때만 예전처럼 작은 판에 그때그때 칠함 — GPU 는 늘인 그림에서 점 경계의 점을 판 크기에 따라 다르게 고를 수 있다).
//  ② 보이는 것만 그린다(markHidden): 나중에 그리는 몬스터부터 거꾸로 보며, 점 하나하나 그대로 놓이는 몬스터(정수 자리·크기 1·회전 없음)가 투명도 1 로 그리는
//     꽉 찬 점을 "덮개"에 적고, 몸의 모든 점과 발밑 그림자가 이미 덮인 몬스터는 그리지 않는다 — 그려도 뒤에 오는 몬스터가 모두 덮어 화면 결과는 같다.
//     셈할 수 없는 몬스터(늘이기·회전·땅에 잠김·점을 못 읽음)는 늘 그리고 덮개에도 적지 않는다. 아래는 순수 함수(node 시험이 본다).
// 그림 한 장의 점(줄마다 이어진 점 묶음): RGBA → {fw, fh, drawn:[j,i0,i1,…](조금이라도 보이는 점 — j 줄의 i0 이상 i1 미만), solid:[j,i0,i1,…](투명도 255 — 덮을 수 있는 점)}
export function framePixels(data, fw, fh) {
  const drawn = [], solid = [];
  const runs = (out, keep) => { for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) { if (!keep(data[(j * fw + i) * 4 + 3])) continue; const i0 = i; while (i + 1 < fw && keep(data[(j * fw + i + 1) * 4 + 3])) i++; out.push(j, i0, i + 1); } };
  runs(drawn, a => a > 0); runs(solid, a => a === 255);
  return { fw, fh, drawn: Int16Array.from(drawn), solid: Int16Array.from(solid) };
}
// 그림 왼쪽 끝 열: translate(x) 뒤 drawImage(…, −(fw>>1), …) · 뒤집으면 scale(−1,1)이라 i 번째 열이 x + (fw>>1) − 1 − i 에 온다
export const spriteLeft = (x, fw, flip) => (flip ? x + (fw >> 1) - fw : x - (fw >> 1));
// 점 하나하나 그대로 옮기는가: 크기 1·회전 없음·땅에 잠기지 않음(잘라 그리지 않음).
//  크기는 1 에서 0.001 까지 봐준다 — 웅크렸다 일어선 몬스터는 움직임이 끝나기 전에 다음 움직임이 와서 squash 가 0.00005 처럼 아주 조금 남는다(그림 크기 1.00001).
//  그림은 160 점을 넘지 않아(pixelsOf) 어긋남이 0.16 점보다 작다 — 점 가운데(0.5)를 넘지 못하니 캔버스가 칠하는 칸·고르는 점이 크기 1 과 같다
export const EXACT_SCALE = 1e-3;
export const exactPlace = (f, sink) => !f.rot && Math.abs(f.sx - 1) <= EXACT_SCALE && Math.abs(f.sy - 1) <= EXACT_SCALE && !sink;
// 캔버스가 투명도 255 로 그리는 값인가(늘어나던 값이 1 아래로 아주 조금 남아도 1)
export const fullAlpha = a => a >= 1 - 1e-9;
// 발밑 그림자 두 줄(drawActor 의 fillRect 두 번과 같은 자리) — 너비가 음수면 캔버스처럼 왼쪽으로 펼친 칸. out 을 주면 그 배열에 다시 채운다(장면마다 새로 만들지 않게)
export function shadowRects(x, gy, rw, out = [[], []]) {
  const put = (r, rx, ry, w, h) => { if (w < 0) { rx += w; w = -w; } r[0] = rx; r[1] = ry; r[2] = w; r[3] = h; r.length = 4; };
  put(out[0], x - rw, gy, rw * 2, 2); put(out[1], x - rw + 2, gy + 2, rw * 2 - 4, 1);
  return out;
}
// 줄 묶음 [i0, i1) 이 화면에서 놓이는 열 [x0, x1): 뒤집으면 i 번째 점이 left + fw − 1 − i 라서 [left + fw − i1, left + fw − i0)
const spanX0 = (px, left, flip, i0, i1) => (flip ? left + px.fw - i1 : left + i0);
// 몸의 보이는 점과 칸(rects — 그림자)이 모두 덮였는가(화면 밖 점은 그리지 않으니 보지 않는다)
export function allCovered(cover, W, H, px, left, top, flip, rects) {
  const d = px.drawn;
  for (let q = 0; q < d.length; q += 3) {
    const y = top + d[q]; if (y < 0 || y >= H) continue;
    const a = spanX0(px, left, flip, d[q + 1], d[q + 2]), x0 = Math.max(0, a), x1 = Math.min(W, a + d[q + 2] - d[q + 1]);
    for (let p = y * W + x0, e = y * W + x1; p < e; p++) if (!cover[p]) return false;
  }
  for (const [rx, ry, w, h] of rects) for (let y = Math.max(0, ry); y < Math.min(H, ry + h); y++) for (let x = Math.max(0, rx); x < Math.min(W, rx + w); x++) if (!cover[y * W + x]) return false;
  return true;
}
// 꽉 찬 점을 덮개에 적는다
export function addCover(cover, W, H, px, left, top, flip) {
  const s = px.solid;
  for (let q = 0; q < s.length; q += 3) {
    const y = top + s[q]; if (y < 0 || y >= H) continue;
    const a = spanX0(px, left, flip, s[q + 1], s[q + 2]), x0 = Math.max(0, a), x1 = Math.min(W, a + s[q + 2] - s[q + 1]);
    if (x0 < x1) cover.fill(1, y * W + x0, y * W + x1);
  }
}
// 그리는 차례대로 받은 items([{px, left, top, flip, rects, solid(투명도 1 로 그림)} | null(셈할 수 없음 — 그린다)])에서 건너뛸 것: [true|false]
export function hiddenList(items, cover, W, H) {
  cover.fill(0);
  const out = new Array(items.length).fill(false);
  for (let k = items.length - 1; k >= 0; k--) {
    const it = items[k]; if (!it) continue;
    if (allCovered(cover, W, H, it.px, it.left, it.top, it.flip, it.rects)) { out[k] = true; continue; }
    if (it.solid) addCover(cover, W, H, it.px, it.left, it.top, it.flip);
  }
  return out;
}
function rng(seed) { // 늘 같은 모양이 나오게 하는 난수
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function ctx2d(c) { const g = c.getContext('2d', { willReadFrequently: false }); g.imageSmoothingEnabled = false; return g; }
// 같은 주소는 한 번만 받음. 못 받은 그림(휴대폰 데이터가 잠깐 끊김 등)은 그 장면에서는 다시 받지 않고(null → 대신 그림), 다음 장면(nextImageRound)에서 다시 받아 본다
const imgCache = new Map(); // 주소 → { p(약속), failed, round(받기 시작한 장면 차례) }
let imgRound = 0;
export const nextImageRound = () => ++imgRound;
export function loadImage(url) {
  const hit = imgCache.get(url);
  if (hit && !(hit.failed && hit.round !== imgRound)) return hit.p;
  const e = { p: null, failed: false, round: imgRound };
  e.p = new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => { e.failed = true; res(null); }; im.src = url; });
  imgCache.set(url, e);
  return e.p;
}
async function loadJson(url) {
  try { const r = await fetch(url); if (!r.ok) return null; return await r.json(); } catch { return null; }
}
const mfCache = new Map();
function loadManifest(url) { // 그림 목록: 있으면 목록에 있는 것만 받는다(없는 그림을 찔러 보지 않게). 목록이 없으면 하나씩 받아 본다
  if (!url) return Promise.resolve(null);
  if (!mfCache.has(url)) mfCache.set(url, loadJson(url).then(m => (m && typeof m === 'object' && m.sprites ? m : null)));
  return mfCache.get(url);
}
const num = n => Math.round(n).toLocaleString('ko-KR');
const josaOf = nm => { const s = String(nm || ''); return (((s.charCodeAt(s.length - 1) - 0xAC00) % 28 + 28) % 28 ? '이' : '가'); };

// ═════════════ 그림 불러오기 (진짜 도트 → 없으면 대신 그림) ═════════════

// 그림 한 장(큰 일러스트)을 도트처럼: 줄이고 → 테두리 또렷하게 → 색 단계 줄이고 → 어두운 외곽선
function pixelize(img, bodyH, fw, fh, baseline) {
  const out = mkCanvas(fw, fh), og = ctx2d(out);
  try {
    // 먼저 안 보이는 가장자리를 잘라 내기
    const full = mkCanvas(img.width, img.height), fg = full.getContext('2d');
    fg.drawImage(img, 0, 0);
    const fd = fg.getImageData(0, 0, full.width, full.height).data;
    let x0 = full.width, y0 = full.height, x1 = 0, y1 = 0;
    for (let y = 0; y < full.height; y++) for (let x = 0; x < full.width; x++) {
      if (fd[(y * full.width + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const sc = Math.min(bodyH / bh, (fw - 4) / bw);
    const tw = Math.max(1, Math.round(bw * sc)), th = Math.max(1, Math.round(bh * sc));
    const small = mkCanvas(tw, th), sg = small.getContext('2d');
    sg.imageSmoothingEnabled = true; sg.imageSmoothingQuality = 'high';
    sg.drawImage(full, x0, y0, bw, bh, 0, 0, tw, th);
    const id = sg.getImageData(0, 0, tw, th), d = id.data;
    const q = v => clamp(Math.round(v / 28) * 28, 0, 255);
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 120) { d[i + 3] = 0; continue; }
      d[i + 3] = 255; d[i] = q(d[i]); d[i + 1] = q(d[i + 1]); d[i + 2] = q(d[i + 2]);
    }
    // 외곽선
    const src = new Uint8ClampedArray(d);
    const op = (x, y) => x >= 0 && y >= 0 && x < tw && y < th && src[(y * tw + x) * 4 + 3] > 0;
    sg.putImageData(id, 0, 0);
    const ox = Math.round((fw - tw) / 2), oy = baseline - th;
    og.fillStyle = '#1c0c20';
    for (let y = -1; y <= th; y++) for (let x = -1; x <= tw; x++) {
      if (!op(x, y) && (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1))) og.fillRect(ox + x, oy + y, 1, 1);
    }
    og.drawImage(small, ox, oy);
  } catch {
    // 그림 점을 못 읽는 곳(file:// 등)에서는 그냥 줄여서
    const sc = bodyH / img.height;
    og.drawImage(img, Math.round((fw - img.width * sc) / 2), baseline - bodyH, img.width * sc, bodyH);
  }
  return out;
}

// 그림이 하나도 없을 때 쓰는 덩어리
function blobSprite(type, fw, fh, baseline, bodyH) {
  const out = mkCanvas(fw, fh), g = ctx2d(out), ramp = rampOf(type);
  const rx = Math.round(bodyH * 0.45), ry = Math.round(bodyH * 0.5), cx = fw >> 1, cy = baseline - ry;
  for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
    const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
    if (d > 1) continue;
    g.fillStyle = d > 0.82 ? '#1c0c20' : (x + y < -rx * 0.3 ? ramp[1] : x + y > rx * 0.6 ? ramp[3] : ramp[2]);
    g.fillRect(cx + x, cy + y, 1, 1);
  }
  g.fillStyle = '#1c0c20'; g.fillRect(cx - 5, cy - 4, 3, 4); g.fillRect(cx + 3, cy - 4, 3, 4);
  return out;
}

function measureTop(img, fw, fh) { // 첫 장에서 몸이 시작하는 높이
  try {
    const c = mkCanvas(fw, fh), g = c.getContext('2d');
    g.drawImage(img, 0, 0, fw, fh, 0, 0, fw, fh);
    const d = g.getImageData(0, 0, fw, fh).data;
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (d[(y * fw + x) * 4 + 3] > 40) return y;
  } catch { /* 못 읽으면 어림값 */ }
  return Math.round(fh * 0.2);
}

// id = 'boss_<속성>' 또는 '<종>_<단계>' · variant 'front' = 앞모습(<id>_front — 3장: idle 0·1, pose 2)
async function loadSprite(id, role, type, stage, A, F, mf, variant) {
  const front = variant === 'front', file = front ? `${id}_front` : id;
  const fwD = role === 'boss' ? 128 : 80, blD = role === 'boss' ? 120 : 74;
  const known = mf ? mf.sprites[file] : undefined; // 목록이 있으면 거기 있는 것만 받는다
  const png = id && (!mf || known) ? await loadImage(`${A.sprites}/${file}.png`) : null;
  if (png) { // 진짜 도트: 가로로 7장(앞모습 3장)
    const meta = known || (await loadJson(`${A.sprites}/${file}.json`)) || {};
    const frames = meta.frames || (front ? 3 : 7);
    const fw = meta.frameW || Math.round(png.width / frames), fh = meta.frameH || png.height;
    const baseline = meta.baseline ?? Math.round(fh * blD / fwD);
    const anims = meta.anims || (front ? { idle: [0, 1], pose: [2] } : { idle: [0, 1], attack: [2, 3, 4], hit: [5], down: [6] });
    const top = measureTop(png, fw, fh);
    return { real: true, img: png, fw, fh, baseline, anims, frames, bodyH: baseline - top, flip: flipOf(role === 'boss' ? F.boss : front ? F.front : F.sprites, id) };
  }
  // 대신 그림: 지금 있는 큰 그림을 도트처럼 줄임
  const bodyH = role === 'boss' ? 98 : MON_BODY[clamp((stage | 0) - 1, 0, 2)];
  const ph = id ? await loadImage(role === 'boss' ? `${A.placeholder}/${id}.png` : `${A.placeholder}/monster_${id}.webp`) : null;
  const img = ph ? pixelize(ph, bodyH, fwD, fwD, blD) : blobSprite(type, fwD, fwD, blD, bodyH);
  const top = measureTop(img, fwD, fwD);
  return { real: false, img, fw: fwD, fh: fwD, baseline: blD, anims: null, frames: 1, bodyH: blD - top, flip: role === 'boss' ? flipOf(F.boss, id) : flipOf(front ? F.placeholderFront : F.placeholder, id) };
}

// 무리용 작은 그림: 곱게 줄인 뒤 테두리를 또렷하게 + 외곽선 (그냥 줄이면 점이 뭉개져요)
function makeMini(spr, sc) {
  const fw = Math.max(4, Math.round(spr.fw * sc)), fh = Math.max(4, Math.round(spr.fh * sc)), n = spr.frames || 1;
  const c = mkCanvas(fw * n, fh), g = c.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  for (let i = 0; i < n; i++) g.drawImage(spr.img, i * spr.fw, 0, spr.fw, spr.fh, i * fw, 0, fw, fh);
  try {
    const id = g.getImageData(0, 0, c.width, fh), d = id.data, w = c.width;
    for (let i = 0; i < d.length; i += 4) d[i + 3] = d[i + 3] > 105 ? 255 : 0;
    const src = new Uint8ClampedArray(d);
    const op = (x, y, f) => x >= f * fw && x < (f + 1) * fw && y >= 0 && y < fh && src[(y * w + x) * 4 + 3] > 0;
    for (let f = 0; f < n; f++) for (let y = 0; y < fh; y++) for (let x = f * fw; x < (f + 1) * fw; x++) {
      if (op(x, y, f)) continue;
      if (op(x - 1, y, f) || op(x + 1, y, f) || op(x, y - 1, f) || op(x, y + 1, f)) { const i = (y * w + x) * 4; d[i] = 28; d[i + 1] = 12; d[i + 2] = 32; d[i + 3] = 255; }
    }
    g.putImageData(id, 0, 0);
  } catch { /* 못 읽으면 줄인 그대로 */ }
  return { ...spr, img: c, fw, fh, baseline: Math.round(spr.baseline * sc), bodyH: Math.round(spr.bodyH * sc), mini: sc };
}

async function loadEffect(type, A, mf) {
  const known = mf ? mf.effects[type] : undefined;
  if (mf && !known) return null;
  const png = await loadImage(`${A.effects}/${type}.png`);
  if (!png) return null;
  const meta = known || (await loadJson(`${A.effects}/${type}.json`)) || {};
  const frames = meta.frames || 6;
  return { img: png, frames, fw: meta.frameW || Math.round(png.width / frames), fh: meta.frameH || png.height };
}

// ═════════════ 대신 쓰는 배경 (속성마다 그려 냄 — 그림이 오면 bg/<이름>.png 가 대신한다) ═════════════
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const HZ = 106; // 그려 내는 배경에서 땅이 시작하는 높이
const W0 = 320, H0 = 180;
function ditherFill(g, y0, y1, pal, pow, amt) {
  for (let y = y0; y < y1; y++) for (let x = 0; x < W0; x++) {
    const v = Math.pow((y - y0) / (y1 - y0), pow) * (pal.length - 1) + (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * amt;
    g.fillStyle = pal[clamp(Math.round(v), 0, pal.length - 1)]; g.fillRect(x, y, 1, 1);
  }
}
// 속성별 색과 꾸밈. pad = 발판 색(그림자 · 옆면 빛 · 옆면 · 윗면 3단계) · amb = 흐르는 점(먼 것 둘 · 가까운 것 셋, dir −1 = 위로)
const THEME = {
  volcano: { pad: ['#0f0613', '#c8442c', '#2a1228', '#5b2c48', '#6f3a56', '#84486a'], amb: { far: ['rgba(255,190,90,.55)', 'rgba(255,110,60,.5)'], near: ['#ffe07a', '#ff9e48', '#e2502e'], dir: -1 },
    dust: ['#e8b89a', '#a8686a', '#5b2c48'], void: '#1b0e2c' },
  sea: { sky: ['#030a1c', '#051228', '#071c38', '#0a2a4c', '#0e3a60', '#124c72', '#186082', '#20748e', '#2c8a98'], ground: ['#1c5068', '#184458', '#143848', '#102c3a', '#0c222e', '#081822'],
    pad: ['#040c14', '#2aa0a8', '#0e2c3c', '#1c5a6c', '#267282', '#348a96'], amb: { far: ['rgba(160,230,255,.5)', 'rgba(90,180,230,.45)'], near: ['#e0fbff', '#9be4ff', '#4aa8f0'], dir: -1 },
    dust: ['#bfe8f0', '#5a9ab0', '#1c4a60'], void: '#030a1c' },
  forest: { sky: ['#07140e', '#0a1c12', '#0e2816', '#14361a', '#1c461e', '#2a5a24', '#42742c', '#6a923a', '#a4b454'], ground: ['#2c4a22', '#263e1e', '#20341a', '#1a2a16', '#142012', '#0e180e'],
    pad: ['#060c06', '#8aa83c', '#1a2a16', '#3a5226', '#4c6830', '#607e3a'], amb: { far: ['rgba(220,255,140,.5)', 'rgba(150,220,90,.4)'], near: ['#f2ffc0', '#b4f060', '#5cc24a'], dir: 1 },
    dust: ['#d8e0a0', '#7a8a4a', '#2c3e1e'], void: '#07140e' },
  canyon: { sky: ['#2a1630', '#3e1c38', '#58243c', '#783040', '#9c4240', '#bc5c40', '#d87c44', '#eca054', '#f8c874'], ground: ['#a85a34', '#94482c', '#7e3a28', '#682e24', '#52241e', '#3e1a18'],
    pad: ['#1c0c0c', '#f0a050', '#52241e', '#a05a36', '#b87044', '#cc8854'], amb: { far: ['rgba(255,220,160,.45)', 'rgba(230,160,100,.4)'], near: ['#fff0c8', '#f0c878', '#c88a4a'], dir: -1 },
    dust: ['#f8dca8', '#c88a5a', '#7a4a2c'], void: '#2a1630' },
  sky: { sky: ['#2a4c9c', '#3460b0', '#4074c2', '#508ad0', '#64a0dc', '#7eb6e6', '#9ccaee', '#bcdcf4', '#def0fa'], ground: ['#f4fafc', '#dcecf4', '#c0d8e8', '#a2c0d8', '#86a8c8', '#6c90b8'],
    pad: ['#3a5a8c', '#ffffff', '#86a8c8', '#c8dcec', '#dceaf4', '#f0f8fc'], amb: { far: ['rgba(255,255,255,.6)', 'rgba(210,240,255,.5)'], near: ['#ffffff', '#e8f8ff', '#bcdcf4'], dir: -1 },
    dust: ['#ffffff', '#c8dcec', '#86a8c8'], void: '#2a4c9c' },
  storm: { sky: ['#0a0816', '#100c20', '#18122c', '#221a3a', '#2c2448', '#383054', '#463e60', '#584e6c', '#6e6478'], ground: ['#3a3450', '#302a44', '#262238', '#1e1a2e', '#161424', '#100e1a'],
    pad: ['#06050c', '#ffe65a', '#1e1a2e', '#443c5c', '#564e70', '#6a6284'], amb: { far: ['rgba(255,240,150,.5)', 'rgba(170,150,255,.4)'], near: ['#ffffff', '#fff7a0', '#ffd83a'], dir: -1 },
    dust: ['#c8c0e0', '#6a6284', '#2c2448'], void: '#0a0816' },
};

function drawVolcanoBg() { // 해 질 녘 화산 (견본 그대로)
  const c = mkCanvas(W0, H0), g = ctx2d(c), r = rng(7), W = W0, H = H0;
  const sky = ['#1b0e2c', '#27103a', '#3a1446', '#57194c', '#7c2150', '#a52f4c', '#cf4a44', '#ee7a3c', '#fbb04c'];
  ditherFill(g, 0, HZ, sky, 1.25, 0.95);
  for (let i = 0; i < 26; i++) { g.fillStyle = i % 4 ? '#8a5a8a' : '#e8c8e0'; g.fillRect((r() * W) | 0, (r() * 44) | 0, 1, 1); }
  const sx = 246, sy = 84, sr = 34, sun = ['#fff3b0', '#ffe07a', '#ffc65a', '#ff9e48'];
  for (let y = -sr; y <= sr; y++) for (let x = -sr; x <= sr; x++) {
    const d = Math.sqrt(x * x + y * y); if (d > sr || sy + y >= HZ) continue;
    if (y > 6 && ((y - 6) % 6) < Math.min(3, (y - 6) / 6)) continue; // 아래쪽 가로 줄무늬
    g.fillStyle = sun[clamp(Math.floor((y + sr) / (sr * 2) * 4), 0, 3)]; g.fillRect(sx + x, sy + y, 1, 1);
  }
  for (let i = 0; i < 9; i++) {
    const cy = 30 + ((r() * 60) | 0), cx = (r() * W) | 0, len = 18 + ((r() * 46) | 0);
    g.fillStyle = cy > 70 ? '#f6925a' : cy > 50 ? '#8e2a52' : '#4a1848';
    g.fillRect(cx, cy, len, 1); g.fillRect(cx + 5, cy + 1, len - 12, 1);
  }
  const px = 88, py = 36; // 먼 화산 (왼쪽)
  for (let x = 0; x < 215; x++) {
    const dx = Math.abs(x - px);
    let top = dx < 9 ? py + (dx < 5 ? 3 : 1) : py + Math.pow(dx - 9, 0.92) * 0.9 + Math.sin(x * 0.7) * 1.2 + (r() - 0.5) * 1.5;
    top = Math.round(top);
    for (let y = top; y < HZ; y++) {
      const edge = y - top;
      g.fillStyle = edge < 1 ? (x > px ? '#7a2a50' : '#45183f') : (x > px + (y - py) * 0.2 ? '#2d1236' : '#231030');
      if (edge >= 1 && ((x * 7 + y * 13) % 23 === 0)) g.fillStyle = '#371740';
      g.fillRect(x, y, 1, 1);
    }
  }
  for (let k = 0; k < 4; k++) { // 흘러내리는 용암
    let lx = px - 5 + k * 3.4, ly = py + 3;
    const dir = (k - 1.5) * 0.5;
    while (ly < HZ - 2) {
      g.fillStyle = ly < py + 14 ? '#ffe07a' : ly < py + 34 ? '#ff9e48' : '#e2502e';
      g.fillRect(Math.round(lx), ly, ly < py + 22 ? 2 : 1, 1);
      g.fillStyle = 'rgba(255,90,40,.25)'; g.fillRect(Math.round(lx) - 1, ly, 4, 1);
      ly++; lx += dir * (0.5 + r() * 0.7) + (r() - 0.5) * 0.8;
      if (k % 2 && ly > py + 40 + k * 8) break;
    }
  }
  for (let x = 0; x < W; x++) { // 지평선의 톱니 바위
    const h = 3 + Math.abs(Math.sin(x * 0.21) * 3 + Math.sin(x * 0.057) * 4) + (r() < 0.08 ? 3 : 0);
    g.fillStyle = '#1d0c26'; g.fillRect(x, HZ - Math.round(h), 1, Math.round(h));
  }
  ditherFill(g, HZ, H, ['#4a1c38', '#3c1732', '#30132c', '#261026', '#1d0c20', '#16091a'], 0.7, 0.9);
  for (let y = HZ; y < HZ + 9; y++) { // 해가 땅에 비친 빛
    const half = 44 - (y - HZ) * 2.5;
    for (let x = -half; x < half; x++) {
      if (BAYER[(y & 3) * 4 + ((sx + (x | 0)) & 3)] > 7 - (y - HZ) * 0.5 + (Math.abs(x) < half * 0.5 ? 3 : 0)) continue;
      g.fillStyle = y - HZ < 3 ? '#e2683c' : '#8e2e3e'; g.fillRect((sx + x) | 0, y, 1, 1);
    }
  }
  groundCracks(g, r, 9, '#7a2434', '#ff9e48', '#e2502e');
  pebbles(g, r, 40, '#5a2644', '#120716');
  return c;
}
function groundCracks(g, r, n, edge, hot, cool) {
  for (let k = 0; k < n; k++) {
    let x = (r() * W0) | 0, y = HZ + 6 + ((r() * (H0 - HZ - 10)) | 0);
    const len = 14 + ((r() * 40) | 0), depth = (y - HZ) / (H0 - HZ);
    for (let i = 0; i < len; i++) {
      g.fillStyle = edge; g.fillRect(x - 1, y, 3, 1 + (depth > 0.5 ? 1 : 0));
      g.fillStyle = depth > 0.4 ? hot : cool; g.fillRect(x, y, 1, 1);
      x += 1; if (r() < 0.3) y += r() < 0.5 ? 1 : -1;
      if (y < HZ + 3 || y > H0 - 2 || x >= W0) break;
    }
  }
}
function pebbles(g, r, n, light, dark) {
  for (let i = 0; i < n; i++) {
    const x = (r() * W0) | 0, y = HZ + 3 + ((r() * (H0 - HZ - 4)) | 0);
    g.fillStyle = light; g.fillRect(x, y, 2, 1); g.fillStyle = dark; g.fillRect(x, y + 1, 3, 1);
  }
}
function disc(g, cx, cy, rad, colOf, maxY = HZ) {
  for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
    if (x * x + y * y > rad * rad || cy + y >= maxY || cy + y < 0) continue;
    const col = colOf(x, y); if (col) { g.fillStyle = col; g.fillRect(cx + x, cy + y, 1, 1); }
  }
}
function puff(g, cx, cy, w, cols) { // 뭉게구름 한 덩이(위가 밝고 아래가 어두움)
  const lobes = Math.max(2, Math.round(w / 9));
  for (let k = 0; k < lobes; k++) {
    const px = cx - w / 2 + (k + 0.5) * w / lobes, rad = Math.round(4 + ((k * 37) % 5) + (k === (lobes >> 1) ? 3 : 0));
    disc(g, Math.round(px), cy, rad, (x, y) => (y < -rad * 0.35 ? cols[0] : y < rad * 0.3 ? cols[1] : cols[2]), cy + 3);
  }
  g.fillStyle = cols[2]; g.fillRect(Math.round(cx - w / 2), cy + 2, Math.round(w), 1);
}
function drawThemeBg(name) {
  if (name === 'volcano' || !THEME[name]) return drawVolcanoBg();
  const th = THEME[name], c = mkCanvas(W0, H0), g = ctx2d(c), r = rng(name.length * 977 + name.charCodeAt(0));
  ditherFill(g, 0, HZ, th.sky, name === 'sky' ? 1 : 1.2, 0.95);
  if (name === 'sea') { // 심해: 위에서 비치는 빛줄기 · 산호 기둥 · 바닥 물결
    for (let k = 0; k < 5; k++) { // 빛줄기
      const x0 = 30 + k * 62 + ((r() * 20) | 0), wd = 6 + ((r() * 10) | 0);
      for (let y = 0; y < HZ; y++) for (let x = 0; x < wd; x++) {
        const xx = x0 + x - Math.round(y * 0.35);
        if (BAYER[(y & 3) * 4 + (xx & 3)] < 5 - y / 30) { g.fillStyle = 'rgba(150,230,240,.16)'; g.fillRect(xx, y, 1, 1); }
      }
    }
    for (let k = 0; k < 9; k++) { // 먼 산호·바위 기둥
      const cx = 8 + k * 38 + ((r() * 16) | 0), h = 14 + ((r() * 34) | 0), wd = 5 + ((r() * 9) | 0), far = k % 2;
      for (let y = 0; y < h; y++) {
        const w2 = Math.round(wd * (0.5 + 0.5 * Math.sin((y / h) * 2.6 + 0.4)) + Math.sin(y * 0.9 + k) * 1.2);
        g.fillStyle = far ? '#0c2c44' : '#082034'; g.fillRect(cx - w2, HZ - y, w2 * 2, 1);
        g.fillStyle = far ? '#16405a' : '#0e3048'; g.fillRect(cx - w2, HZ - y, 1, 1);
      }
      if (!far) for (let b = 0; b < 3; b++) { g.fillStyle = b % 2 ? '#e0607a' : '#f08a6a'; g.fillRect(cx - 3 + b * 3, HZ - h - 2 - (b % 2) * 2, 1, 3 + (b % 2) * 2); g.fillRect(cx - 4 + b * 3, HZ - h - 3 - (b % 2) * 2, 3, 1); }
    }
    for (let i = 0; i < 30; i++) { g.fillStyle = i % 3 ? 'rgba(150,220,240,.5)' : '#d8f8ff'; g.fillRect((r() * W0) | 0, (r() * 96) | 0, 1, 1); }
    ditherFill(g, HZ, H0, th.ground, 0.7, 0.9);
    for (let k = 0; k < 16; k++) { // 바닥의 물결 무늬
      const y = HZ + 3 + ((r() * (H0 - HZ - 6)) | 0), x = (r() * W0) | 0, len = 10 + ((r() * 30) | 0);
      g.fillStyle = y < HZ + 20 ? '#2a7488' : '#1c5266'; g.fillRect(x, y, len, 1); g.fillRect(x + 4, y + 1, len - 9, 1);
    }
    for (let k = 0; k < 10; k++) { // 해초
      const x = (r() * W0) | 0, y = HZ + 8 + ((r() * (H0 - HZ - 12)) | 0), h = 5 + ((r() * 8) | 0);
      for (let i = 0; i < h; i++) { g.fillStyle = i > h - 3 ? '#3ac0a0' : '#1c8a7a'; g.fillRect(x + (Math.sin(i * 0.9 + k) > 0 ? 1 : 0), y - i, 1, 1); }
    }
    pebbles(g, r, 26, '#2a6a7c', '#06141c');
  } else if (name === 'forest') { // 고목 숲: 굵은 나무 기둥 사이로 비치는 빛 · 이끼 땅
    disc(g, 236, 70, 40, (x, y) => (BAYER[((y + 64) & 3) * 4 + ((x + 64) & 3)] < 9 - Math.hypot(x, y) / 5 ? '#d4dc7a' : null));
    const trunks = [[-4, 26, 0], [38, 14, 1], [70, 22, 0], [112, 12, 1], [150, 18, 0], [196, 13, 1], [228, 10, 1], [284, 24, 0], [314, 16, 1]];
    for (const [tx, wd, far] of trunks.filter(t => t[2]).concat(trunks.filter(t => !t[2]))) {
      for (let y = 0; y < HZ; y++) {
        const flare = y > HZ - 14 ? Math.round(Math.pow((y - (HZ - 14)) / 14, 2) * 7) : 0;
        g.fillStyle = far ? '#16301a' : '#0a160c'; g.fillRect(tx - flare, y, wd + flare * 2, 1);
        g.fillStyle = far ? '#224426' : '#142418'; g.fillRect(tx + wd - 2 + flare, y, 2, 1);
        if (!far && (y * 7 + tx) % 11 < 2) { g.fillStyle = '#060e08'; g.fillRect(tx + 3 + ((y * 3) % Math.max(1, wd - 6)), y, 1, 3); }
      }
    }
    for (let k = 0; k < 22; k++) puffLeaves(g, (r() * W0) | 0, (r() * 22) | 0, 10 + ((r() * 16) | 0), k % 3 ? '#0c1e10' : '#163420');
    for (let i = 0; i < 24; i++) { g.fillStyle = i % 3 ? 'rgba(200,240,120,.6)' : '#f2ffc0'; g.fillRect((r() * W0) | 0, 26 + ((r() * 70) | 0), 1, 1); }
    ditherFill(g, HZ, H0, th.ground, 0.7, 0.9);
    for (let k = 0; k < 40; k++) { // 풀·이끼
      const x = (r() * W0) | 0, y = HZ + 2 + ((r() * (H0 - HZ - 4)) | 0);
      g.fillStyle = y < HZ + 22 ? '#5a8a34' : '#3a6226'; g.fillRect(x, y, 1, 2); g.fillRect(x + 2, y + 1, 1, 1);
    }
    for (let k = 0; k < 7; k++) { // 굵은 뿌리
      let x = (r() * W0) | 0, y = HZ + 8 + ((r() * (H0 - HZ - 14)) | 0); const len = 16 + ((r() * 30) | 0);
      for (let i = 0; i < len; i++) { g.fillStyle = '#0e180e'; g.fillRect(x, y + 1, 2, 2); g.fillStyle = '#3a2c1c'; g.fillRect(x, y, 2, 1); x++; if (r() < 0.3) y += r() < 0.5 ? 1 : -1; if (y < HZ + 4 || y > H0 - 3) break; }
    }
    pebbles(g, r, 18, '#4c6830', '#0a120a');
  } else if (name === 'canyon') { // 협곡: 층층이 쌓인 사암 절벽 · 붉은 땅
    disc(g, 250, 82, 30, (x, y) => (y > 8 && ((y - 8) % 6) < 2 ? null : ['#fff3c8', '#ffe2a0', '#ffc878', '#f8a85c'][clamp(Math.floor((y + 30) / 15), 0, 3)]));
    for (let i = 0; i < 7; i++) { const cy = 22 + ((r() * 50) | 0), cx = (r() * W0) | 0, len = 20 + ((r() * 50) | 0); g.fillStyle = cy > 54 ? '#f4b06a' : '#a04a48'; g.fillRect(cx, cy, len, 1); g.fillRect(cx + 6, cy + 1, len - 14, 1); }
    const mesa = (x0, x1, top, body, edge, strata) => {
      for (let x = x0; x < x1; x++) {
        const tt = top + Math.round(Math.sin(x * 0.5) * 0.8) + ((x - x0 < 4 || x1 - x < 4) ? 4 - Math.min(x - x0, x1 - x) : 0);
        for (let y = tt; y < HZ; y++) { g.fillStyle = y === tt ? edge : (y - top) % 9 === 6 ? strata : body; g.fillRect(x, y, 1, 1); }
      }
    };
    mesa(-6, 60, 34, '#5a2434', '#8a3a3c', '#481c2c'); mesa(84, 150, 52, '#6a2c36', '#9a4640', '#54222e'); mesa(176, 226, 44, '#5a2434', '#8a3a3c', '#481c2c'); mesa(286, 326, 38, '#5a2434', '#8a3a3c', '#481c2c');
    mesa(40, 104, 72, '#3e1a28', '#6a2c36', '#321422'); mesa(140, 196, 80, '#3e1a28', '#6a2c36', '#321422'); mesa(246, 300, 76, '#3e1a28', '#6a2c36', '#321422');
    for (let x = 0; x < W0; x++) { const h = 2 + Math.abs(Math.sin(x * 0.17) * 3 + Math.sin(x * 0.043) * 3); g.fillStyle = '#2c121c'; g.fillRect(x, HZ - Math.round(h), 1, Math.round(h)); }
    ditherFill(g, HZ, H0, th.ground, 0.7, 0.9);
    for (let k = 0; k < 14; k++) { const y = HZ + 3 + ((r() * (H0 - HZ - 6)) | 0), x = (r() * W0) | 0, len = 12 + ((r() * 40) | 0); g.fillStyle = y < HZ + 18 ? '#c87a48' : '#8a4a30'; g.fillRect(x, y, len, 1); }
    groundCracks(g, r, 8, '#3e1a18', '#52241e', '#52241e');
    pebbles(g, r, 36, '#cc8854', '#32140f');
  } else if (name === 'sky') { // 하늘: 구름 바다 위 · 멀리 뜬 섬 · 흰 구름 땅
    disc(g, 248, 40, 16, (x, y) => (Math.hypot(x, y) > 13 ? '#fff8d8' : '#ffffff'));
    for (let k = 0; k < 9; k++) puff(g, (r() * W0) | 0, 18 + ((r() * 56) | 0), 22 + ((r() * 30) | 0), k % 2 ? ['#ffffff', '#e4f2fa', '#b4d2e8'] : ['#eef8fc', '#cfe4f2', '#9cc0dc']);
    for (const [ix, iy, iw] of [[52, 58, 26], [150, 46, 18], [296, 64, 22]]) { // 뜬 섬
      for (let y = 0; y < iw * 0.7; y++) { const w2 = Math.round((iw / 2) * (1 - y / (iw * 0.7))); g.fillStyle = y < 2 ? '#7ac06a' : y < 5 ? '#8a7a6a' : '#6a5a5a'; g.fillRect(ix - w2, iy + y, w2 * 2, 1); }
      g.fillStyle = '#a4e08a'; g.fillRect(ix - iw / 2, iy - 1, iw, 1);
    }
    for (let x = -10; x < W0 + 20; x += 17) puff(g, x + ((r() * 8) | 0), HZ - 3 + ((r() * 4) | 0), 26, ['#ffffff', '#eef8fc', '#cfe4f2']); // 지평선의 구름 둑
    ditherFill(g, HZ, H0, th.ground, 0.8, 0.9);
    for (let k = 0; k < 22; k++) { const y = HZ + 3 + ((r() * (H0 - HZ - 6)) | 0), x = (r() * W0) | 0, len = 10 + ((r() * 34) | 0); g.fillStyle = y < HZ + 24 ? '#ffffff' : '#b4cce0'; g.fillRect(x, y, len, 1); g.fillRect(x + 3, y + 1, Math.max(1, len - 8), 1); }
    for (let i = 0; i < 20; i++) { const x = (r() * W0) | 0, y = HZ + 4 + ((r() * (H0 - HZ - 6)) | 0); g.fillStyle = '#7e9cc0'; g.fillRect(x, y, 3, 1); }
  } else { // storm — 뇌운: 낮게 깔린 먹구름 · 뾰족한 산 · 젖은 돌 땅
    for (let k = 0; k < 16; k++) puff(g, (r() * W0) | 0, 4 + ((r() * 34) | 0), 30 + ((r() * 40) | 0), k % 2 ? ['#3a3052', '#2a2240', '#1a1430'] : ['#4a4062', '#342a4c', '#201a36']);
    for (let k = 0; k < 3; k++) { // 멀리 굳어 있는 번개 자국
      let x = 40 + k * 110 + ((r() * 30) | 0), y = 30;
      while (y < HZ - 8) { const nx = x + ((r() * 9) | 0) - 4, ny = y + 3 + ((r() * 5) | 0); g.fillStyle = 'rgba(255,240,170,.35)'; for (let s = 0; s < 5; s++) g.fillRect(Math.round(x + (nx - x) * s / 5), Math.round(y + (ny - y) * s / 5), 1, 1); x = nx; y = ny; }
    }
    for (let x = 0; x < W0; x++) { // 뾰족한 산
      const h = 10 + Math.abs(((x * 0.9) % 46) - 23) * 0.9 + Math.sin(x * 0.11) * 6 + Math.sin(x * 0.7) * 1.2, top = HZ - Math.round(h);
      for (let y = top; y < HZ; y++) { g.fillStyle = y === top ? '#5a5074' : ((x + y) % 7 === 0 ? '#2a2440' : '#1c1830'); g.fillRect(x, y, 1, 1); }
    }
    ditherFill(g, HZ, H0, th.ground, 0.7, 0.9);
    for (let k = 0; k < 12; k++) { const y = HZ + 4 + ((r() * (H0 - HZ - 8)) | 0), x = (r() * W0) | 0, len = 10 + ((r() * 26) | 0); g.fillStyle = '#5a5278'; g.fillRect(x, y, len, 1); g.fillStyle = 'rgba(255,240,150,.25)'; g.fillRect(x + 2, y, 3, 1); } // 물웅덩이
    groundCracks(g, r, 7, '#100e1a', '#fff7a0', '#8a7ad0');
    pebbles(g, r, 34, '#564e70', '#08060e');
  }
  return c;
}
function puffLeaves(g, cx, cy, w, col) { disc(g, cx, cy, Math.round(w / 2), (x, y) => ((x * 5 + y * 3) % 7 === 0 ? null : col), HZ); }

function drawThemePad(w, h, pal) {
  const c = mkCanvas(w, h), g = ctx2d(c);
  const rx = w / 2 - 1, cx = w / 2;
  const ell = (cy, ry, rxx, col, test) => {
    for (let y = -ry; y <= ry; y++) for (let x = -rxx; x <= rxx; x++) {
      if ((x * x) / (rxx * rxx) + (y * y) / (ry * ry) > 1) continue;
      if (test && !test(x, y)) continue;
      g.fillStyle = col; g.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
    }
  };
  const ry = h / 2 - 3, cy = h / 2 - 2;
  ell(cy + 4, ry, rx, pal[0]);            // 아래 그림자
  ell(cy + 2, ry, rx, pal[1]);            // 옆면의 빛
  ell(cy + 2, ry, rx, pal[2], (x, y) => ((x + 400) % 7) < 4 || y < ry * 0.5);
  ell(cy, ry, rx, pal[3]);                // 윗면
  ell(cy - 1, ry - 2, rx - 5, pal[4], (x, y) => BAYER[((y + 64) & 3) * 4 + ((x + 400) & 3)] < 9);
  ell(cy - 2, ry - 4, rx - 14, pal[5], (x, y) => BAYER[((y + 64) & 3) * 4 + ((x + 400) & 3)] < 5);
  return c;
}

// ═════════════ 소리 (효과음은 WebAudio 로 만드는 칩튠 — 파일 없음. 음악만 파일) ═════════════
//  hold(true) = 장면이 멈춘 동안(멈춤 · 탭 숨김 · stop) 소리를 통째로 쉬게 함 — 그리기(rAF)가 쉬면 곡을 내리는 때가 오지 않아 곡이 혼자 돌기 때문
export function makeAudio(musicDir, tracks) {
  let ac = null, master = null, on = false, held = false;
  // 음악: 곡마다 (소리 → 곡 크기 → 음악 묶음 → 스피커). 끊김 없이 돌도록 WebAudio 로 한 번만 풀어 둠
  let bus = null, musicVol = AUDIO.music, want = 'none', wantFade = AUDIO.crossfade, playing = null;
  const bufs = {}, loading = {}, live = []; // live = 지금 울리는 곡
  async function load(name) {
    if (bufs[name] || !tracks[name]) return bufs[name];
    if (!loading[name]) loading[name] = (async () => {
      try {
        const r = await fetch(`${musicDir}/${tracks[name]}`); if (!r.ok) return null;
        const b = await ac.decodeAudioData(await r.arrayBuffer());
        // mp3 앞뒤의 빈 소리를 빼고 돌려야 틈이 안 생김
        const d = b.getChannelData(0); let a = 0, z = d.length - 1;
        while (a < z && Math.abs(d[a]) < 0.002) a++; while (z > a && Math.abs(d[z]) < 0.002) z--;
        b._ls = a / b.sampleRate; b._le = (z + 1) / b.sampleRate;
        return (bufs[name] = b);
      } catch { return null; }
    })();
    return loading[name];
  }
  function fadeOutAll(sec) {
    const t = ac.currentTime;
    for (const x of live.splice(0)) {
      try { x.g.gain.cancelScheduledValues(t); x.g.gain.setValueAtTime(x.g.gain.value, t); x.g.gain.linearRampToValueAtTime(0, t + sec); x.src.stop(t + sec + 0.05); } catch { /* 이미 끝남 */ }
    }
    playing = null;
  }
  async function applyMusic() {
    if (!on || !ac) return;
    if (want === playing || (want === 'none' && !playing)) return;
    const name = want, sec = wantFade;
    if (name === 'none') { fadeOutAll(sec); return; }
    const buf = await load(name);
    if (!on || !ac || want !== name || playing === name) return; // 받는 사이에 바뀌었으면 그만
    if (!buf) return;
    fadeOutAll(sec);
    const src = ac.createBufferSource(), g = ac.createGain(), t = ac.currentTime;
    src.buffer = buf; src.loop = true; src.loopStart = buf._ls || 0; src.loopEnd = buf._le || buf.duration;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + Math.min(sec, 0.6));
    src.connect(g); g.connect(bus); src.start(t, src.loopStart);
    live.push({ src, g, name }); playing = name;
  }
  function duck(level = AUDIO.duck) { // 효과음 밑으로 음악을 잠깐 낮춤(이미 더 낮춰져 있으면 그대로 두고 늦게 돌아오게만)
    if (!bus || !playing) return;
    const t = ac.currentTime, to = Math.min(bus.gain.value, musicVol * level);
    bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(to, t + 0.04);
    bus.gain.setValueAtTime(to, t + 0.45); bus.gain.linearRampToValueAtTime(musicVol, t + 0.75);
  }
  const LOUD = { super: 1, erupt: 1, splash: 1, quake: 1, gale: 1, thunder: 1, roar: 1, crumble: 1, win: 1, land: 1, alarm: 1 };
  function ensure() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
      ac = new AC(); master = ac.createGain(); master.gain.value = AUDIO.sfx;
      // 리미터: 효과음이 몰려도(몰아치기·광역기) 소리가 찢어지지 않게
      const lim = ac.createDynamicsCompressor(); lim.threshold.value = -8; lim.knee.value = 6; lim.ratio.value = 8; lim.attack.value = 0.003; lim.release.value = 0.15;
      master.connect(lim); lim.connect(ac.destination);
      bus = ac.createGain(); bus.gain.value = musicVol; bus.connect(ac.destination);
    }
    if (ac.state === 'suspended' && !held) ac.resume();
    return true;
  }
  function tone(f, dur, o = {}) {
    const t = ac.currentTime + (o.at || 0), osc = ac.createOscillator(), gn = ac.createGain();
    osc.type = o.type || 'square'; osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    gn.gain.setValueAtTime(o.vol ?? 0.5, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gn); gn.connect(master); osc.start(t); osc.stop(t + dur + 0.02);
  }
  function noise(dur, o = {}) {
    const t = ac.currentTime + (o.at || 0), n = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    let hold = 0; const step = o.crush || 1;
    for (let i = 0; i < n; i++) { if (i % step === 0) hold = Math.random() * 2 - 1; d[i] = hold; }
    const src = ac.createBufferSource(), gn = ac.createGain(); src.buffer = buf;
    gn.gain.setValueAtTime(o.vol ?? 0.5, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(gn); gn.connect(master); src.start(t);
  }
  const arp = (notes, step, dur, o = {}) => notes.forEach((f, i) => tone(f, dur, { ...o, at: (o.at || 0) + i * step }));
  const S = {
    open() { tone(110, 0.5, { type: 'triangle', to: 55, vol: 0.6 }); },
    land() { noise(0.28, { crush: 14, vol: 0.8 }); tone(90, 0.3, { type: 'triangle', to: 38, vol: 0.9 }); },
    roar() { tone(190, 0.7, { type: 'sawtooth', to: 62, vol: 0.5 }); tone(197, 0.7, { type: 'square', to: 58, vol: 0.25 }); noise(0.6, { crush: 22, vol: 0.35 }); },
    join() { arp([523, 784], 0.07, 0.09, { vol: 0.35 }); },
    buff() { arp([523, 659, 784, 1047, 1319, 1568], 0.06, 0.12, { vol: 0.3 }); },
    round() { arp([392, 392], 0.11, 0.07, { vol: 0.25 }); },
    hit() { noise(0.12, { crush: 6, vol: 0.6 }); tone(330, 0.12, { to: 110, vol: 0.4 }); },
    turn() { arp([392, 523], 0.06, 0.08, { vol: 0.3 }); },
    alarm() { arp([880, 660, 880, 660, 880], 0.14, 0.12, { vol: 0.35 }); tone(110, 0.9, { type: 'sawtooth', to: 70, vol: 0.3 }); },
    charge() { tone(70, 1.2, { type: 'sawtooth', to: 220, vol: 0.35 }); arp([220, 277, 330, 415], 0.22, 0.2, { vol: 0.2, type: 'triangle' }); },
    erupt() { noise(1.3, { crush: 30, vol: 0.8 }); tone(140, 1.2, { type: 'triangle', to: 28, vol: 0.9 }); noise(0.3, { crush: 6, vol: 0.6, at: 0.05 }); },
    splash() { noise(1.2, { crush: 9, vol: 0.7 }); tone(300, 1.1, { type: 'triangle', to: 60, vol: 0.7 }); tone(520, 0.5, { type: 'sine', to: 180, vol: 0.3, at: 0.1 }); },
    quake() { noise(1.5, { crush: 40, vol: 0.85 }); tone(70, 1.5, { type: 'triangle', to: 30, vol: 0.9 }); tone(52, 1.0, { type: 'sawtooth', to: 40, vol: 0.3, at: 0.2 }); },
    gale() { noise(1.6, { crush: 3, vol: 0.6 }); tone(420, 1.4, { type: 'sine', to: 900, vol: 0.18 }); tone(200, 1.2, { type: 'triangle', to: 90, vol: 0.5 }); },
    thunder() { noise(0.14, { crush: 2, vol: 0.9 }); noise(1.2, { crush: 34, vol: 0.75, at: 0.08 }); tone(90, 1.1, { type: 'triangle', to: 30, vol: 0.8, at: 0.08 }); },
    rock() { noise(0.1, { crush: 16, vol: 0.45 }); tone(120, 0.1, { to: 60, vol: 0.35, type: 'triangle' }); },
    drip() { tone(700, 0.1, { type: 'sine', to: 240, vol: 0.4 }); noise(0.08, { crush: 5, vol: 0.3 }); },
    zap() { tone(1400, 0.09, { type: 'sawtooth', to: 300, vol: 0.35 }); noise(0.07, { crush: 3, vol: 0.45 }); },
    tick() { noise(0.06, { crush: 8, vol: 0.4 }); tone(260, 0.06, { to: 150, vol: 0.2 }); },
    weak() { noise(0.07, { crush: 12, vol: 0.3 }); tone(180, 0.09, { to: 120, vol: 0.25, type: 'triangle' }); },
    super() { noise(0.2, { crush: 5, vol: 0.8 }); tone(160, 0.25, { type: 'triangle', to: 50, vol: 0.9 }); arp([784, 1047, 1568], 0.05, 0.1, { vol: 0.35, at: 0.1 }); },
    bossAtk() { tone(140, 0.35, { type: 'sawtooth', to: 70, vol: 0.4 }); noise(0.35, { crush: 18, vol: 0.4, at: 0.05 }); },
    hurt() { noise(0.16, { crush: 9, vol: 0.6 }); tone(240, 0.16, { to: 80, vol: 0.4 }); },
    ko() { arp([440, 370, 294, 220, 147], 0.09, 0.14, { vol: 0.35, type: 'triangle' }); },
    crumble() { noise(0.9, { crush: 26, vol: 0.5 }); tone(120, 0.9, { type: 'triangle', to: 30, vol: 0.6 }); },
    win() { arp([523, 659, 784, 1047, 784, 1047, 1319], 0.11, 0.16, { vol: 0.35 }); tone(1568, 0.6, { at: 0.8, vol: 0.3 }); arp([262, 330, 392], 0.22, 0.3, { type: 'triangle', vol: 0.4 }); },
    lose() { arp([330, 294, 247, 196, 147], 0.2, 0.3, { type: 'triangle', vol: 0.45 }); },
  };
  return {
    get on() { return on; },
    set(v) { on = !!v; if (on) { if (ensure()) { if (held && ac.state === 'running') ac.suspend(); applyMusic(); } } else if (ac) fadeOutAll(0.15); },
    hold(v) { held = !!v; if (!ac) return; try { if (held) { if (ac.state === 'running') ac.suspend(); } else if (on && ac.state === 'suspended') ac.resume(); } catch { /* 이미 닫힘 */ } },
    halt() { want = 'none'; if (ac) fadeOutAll(0.1); }, // 곡을 내림(장면을 세울 때)
    play(name) { if (!on || held || !S[name] || !ensure()) return; try { S[name](); duck(LOUD[name] ? AUDIO.duck : AUDIO.duckSoft); } catch { /* 소리는 안 나도 그만 */ } },
    // 어떤 곡이 울려야 하는지 알려 줌: 'main' · 'climax' · 'none'. 소리가 꺼져 있으면 기억만 해 둠
    music(name, fadeSec) { if (name === want) return; want = name; wantFade = fadeSec ?? AUDIO.crossfade; applyMusic(); },
    setMusicVolume(v) { musicVol = clamp(+v || 0, 0, 1); if (bus) { const t = ac.currentTime; bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(musicVol, t); bus.gain.value = musicVol; } return musicVol; },
    get state() { return { on, held, want, track: playing, musicVolume: musicVol, sfxVolume: AUDIO.sfx, busGain: bus ? +bus.gain.value.toFixed(3) : null, loaded: Object.keys(bufs), ctx: ac ? ac.state : null,
      loop: live.map(x => [x.name, +x.src.loopStart.toFixed(3), +x.src.loopEnd.toFixed(3)]) }; },
    close() { try { ac && ac.close(); } catch { /* */ } ac = null; bus = null; live.length = 0; playing = null; },
  };
}

// ═════════════ 본체 ═════════════
export async function playFight(container, script, opts = {}) {
  nextImageRound();
  const fight = script || {};
  const boss0 = { type: 'fire', name: '보스', aoe: '', stage: 1, ...(fight.boss || {}) };
  const A = assetDirs(opts.assets);
  const TL = buildTimeline(fight, opts.timing);       // 언제 무엇을 보여 줄지(timeline.js)
  const T = { ...TIMING, ...(opts.timing || {}) };
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const calm = () => (opts.reducedMotion ?? mq.matches); // 움직임 줄이기
  const live = opts.live && typeof opts.live === 'object' ? opts.live : null;
  const nowMs = () => Number(live && typeof live.now === 'function' ? live.now() : Date.now());
  let land = opts.land ?? fight.land ?? null;          // 땅 변화(나중에 setLand 로도)
  let joinN = Math.max(0, Math.trunc(Number(fight.joined) || 0)); // 모집 중 참전 수(updateJoin 으로 올림)
  const bType = boss0.type, aoeStyle = AOE[bType] || AOE.fire, bgName = opts.bgId || BG_OF[bType] || 'volcano';

  // ── 글꼴 ──
  const fontCss = opts.fontCss === undefined ? FONT_CSS : opts.fontCss;
  if (fontCss && !document.querySelector(`link[href="${fontCss}"]`)) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = fontCss; document.head.appendChild(l);
  }

  // ── 캔버스 ──
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `보스전: ${boss0.name} ${boss0.stage}일째`);
  canvas.style.display = 'block'; canvas.style.margin = '0 auto';
  const out = canvas.getContext('2d');
  const scene = mkCanvas(320, 180), g = ctx2d(scene);
  let W = 320, H = 180;   // 장면 크기: 가로 화면 320×180, 세로 화면(폰을 세워 볼 때) 180×320
  let L = null, bg = null; // 지금 배치 · 배경
  let K = 2;              // 화면 캔버스는 장면의 K배(정수)
  const wantPortrait = () => opts.orientation === 'portrait' || (opts.orientation !== 'landscape' && window.innerHeight > window.innerWidth);

  // 자리 정하기(가로/세로). 숫자를 바꾸려면 여기만
  function makeLayout(portrait) {
    const caps = [10, 11, 9, 12, 8]; // 무리 줄마다 서는 수(잘 보이는 줄부터 채움)
    if (!portrait) {
      const rows = [[122, 0.36, 0.14], [116, 0.31, 0.24], [129, 0.4, 0.07], [112, 0.28, 0.32], [137, 0.45, 0]];
      return {
        portrait: false, W: 320, H: 180, bgOff: { x: 0, y: 0 },
        boss: { x: 244, y: clamp(bossSpr.bodyH + 6, 104, 124) },
        team: big ? [{ x: 40, y: 190 }, { x: 94, y: 187 }, { x: 148, y: 184 }] : [{ x: 40, y: 175 }, { x: 98, y: 170 }, { x: 156, y: 165 }],
        teamPad: { x: 98, y: 169 }, stage: { x: 112, y: 170 },
        // 무리는 앞줄 뒤(왼쪽 위)에 줄지어 서고, 보스 발판 앞은 비워 둠
        rows: rows.map((r, i) => ({ y: r[0], s: r[1], shade: r[2], x0: 4, x1: 172, cap: caps[i] })),
        cap: { x: 112, y: 40 }, cue: { x: 160, y: 50 }, atk: { x: 164, y: 36 },
        win: { x: 160, y: big ? 22 : 34, y0: big ? 54 : 70 }, lose: { x: 112, y: 44 }, live: { x: 312, y: 166 }, left: { x: 10, y: 45 },
        joinBox: { x: 112, y: 62 }, cloudY: 70, field: { x: 98, y: 150, rx: 92, ry: 26 },
      };
    }
    // 세로: 위쪽 절반에 보스, 아래쪽 절반에 우리 편. 배경은 하늘은 그대로·땅은 2배로 늘려 채움
    const hz = bgImg ? (opts.bgHorizon ?? BG_HORIZON[bgName] ?? 112) : HZ, top = 320 - hz - (180 - hz) * 2, hp = top + hz;
    const rows = [[246, 0.36, 0.14], [239, 0.31, 0.24], [254, 0.4, 0.07], [233, 0.28, 0.32], [263, 0.45, 0]];
    const by = portraitBossY({ hz, bodyH: bossSpr.bodyH, bg: bgName, art: !!bgImg });
    return {
      portrait: true, W: 180, H: 320, hz, top, bgOff: { x: -70, y: top },
      boss: { x: 98, y: by },
      team: big ? [{ x: 32, y: 332 }, { x: 90, y: 328 }, { x: 148, y: 324 }] : [{ x: 34, y: 310 }, { x: 90, y: 302 }, { x: 146, y: 294 }],
      teamPad: { x: 90, y: big ? 318 : 302 }, stage: { x: 90, y: 296 },
      rows: rows.map((r, i) => ({ y: r[0], s: r[1], shade: r[2], x0: 2, x1: 178, cap: caps[i] })),
      cap: { x: 90, y: 52 }, cue: { x: 90, y: 60 }, atk: { x: 90, y: 60 },
      win: { x: 90, y: 50, y0: 82 }, lose: { x: 90, y: 54 }, live: { x: 172, y: 9 }, left: { x: 10, y: 45 },
      joinBox: { x: 90, y: by + 30 }, cloudY: 196, field: { x: 90, y: 276, rx: 84, ry: 34 },
    };
  }
  function composeBg() {
    if (!L.portrait) return bgSrc;
    const c = mkCanvas(W, H), cg = ctx2d(c), hz = L.hz, gr = 180 - hz;
    let col = theme.void;
    try { const tc = mkCanvas(1, 1).getContext('2d'); tc.drawImage(bgSrc, -160, 0); const d = tc.getImageData(0, 0, 1, 1).data; col = `rgb(${d[0]},${d[1]},${d[2]})`; } catch { /* 기본 색 */ }
    cg.fillStyle = col; cg.fillRect(0, 0, W, L.top + 1);
    if (bgImg && BG_TOP_MIRROR[bgName]) { cg.save(); cg.translate(0, L.top); cg.scale(1, -1); cg.drawImage(bgSrc, 70, 0, 180, L.top, 0, 0, 180, L.top); cg.restore(); }
    cg.drawImage(bgSrc, 70, 0, 180, hz, 0, L.top, 180, hz);          // 하늘: 가운데를 잘라 그대로
    cg.drawImage(bgSrc, 115, hz, 90, gr, 0, L.top + hz, 180, gr * 2); // 땅: 2배(정수배)로
    return c;
  }
  function applyLayout() { // 가로↔세로가 바뀌면 자리를 다시 잡고, 보던 시각으로 이어서
    const portrait = wantPortrait();
    if (L && L.portrait === portrait) return;
    L = makeLayout(portrait); W = L.W; H = L.H;
    scene.width = W; scene.height = H; g.imageSmoothingEnabled = false;
    bg = composeBg();
    for (const e of amb.embers) { e.x = e.rx * W; e.y = e.ry * H; }
    if (S) jump(S.clock);
  }
  function layout() {
    if (!alive) return;
    applyLayout();
    const cw = container.clientWidth || W, dpr = sceneDpr(window.devicePixelRatio, opts.maxDpr);
    const maxH = typeof opts.maxHeight === 'function' ? opts.maxHeight() : opts.maxHeight; // 높이 한도(px) — 주면 그 안에 들게
    const fitW = maxH > 0 ? Math.min(cw, maxH * W / H) : cw, dev = fitW * dpr;
    const k = Math.floor(dev / W);
    let cssW;
    if (k >= 1 && (k * W) / dev >= 0.9) { cssW = (k * W) / dpr; K = Math.min(k, 8); canvas.style.imageRendering = 'pixelated'; } // 딱 정수배
    else { cssW = fitW; K = clamp(Math.ceil(dev / W), 1, 8); canvas.style.imageRendering = 'auto'; }                            // 폭을 꽉 채우고 곱게 줄임
    if (canvas.width !== W * K || canvas.height !== H * K) { canvas.width = W * K; canvas.height = H * K; }
    canvas.style.width = cssW + 'px'; canvas.style.height = (cssW * H / W) + 'px';
  }

  // ── 그림 ──
  const team = TL.joinOnly ? [] : (Array.isArray(fight.team) ? fight.team : []);
  const big = TL.big; // 여럿이면 앞줄 3 + 무리, 묶어서 보여 주기
  const frontIdx = TL.frontIdx, dealt = TL.dealt;
  const F = {}; for (const k of Object.keys(FLIP)) F[k] = { ...FLIP[k], ...(opts.flip?.[k] || {}) };
  const mf = await loadManifest(A.manifest);
  const has = (kind, id) => (mf ? (kind === 'bg' ? (mf.bg || []).includes(id) : id in (mf[kind] || {})) : true);
  const types = [...new Set([bType, ...team.map(m => m.type)])].filter(Boolean);
  const sprId = m => (m.sp ? `${m.sp}_${clamp(Math.trunc(Number(m.stage) || 1), 1, 3)}` : '');
  const sprCache = new Map(); // 같은 그림은 한 번만 만듦
  const getSpr = (m, v) => { const id = sprId(m), k = `${id}|${m.type}|${v || ''}`; if (!sprCache.has(k)) sprCache.set(k, loadSprite(id, 'monster', m.type, m.stage, A, F, mf, v)); return sprCache.get(k); };
  const padName = (side) => (has('bg', `pad_${side}_${bgName}`) ? `pad_${side}_${bgName}` : bgName === 'volcano' && has('bg', `pad_${side}`) ? `pad_${side}` : null);
  const [bossSpr, teamSpr, teamFront, fxList, bgImg, padBossImg, padTeamImg] = await Promise.all([
    loadSprite(`boss_${bType}`, 'boss', bType, 0, A, F, mf),
    Promise.all(team.map(m => getSpr(m))),
    Promise.all(team.map(m => getSpr(m, 'front'))),
    Promise.all(types.map(t => loadEffect(t, A, mf))),
    has('bg', bgName) ? loadImage(`${A.bg}/${bgName}.png`) : null,
    padName('boss') ? loadImage(`${A.bg}/${padName('boss')}.png`) : null,
    padName('team') ? loadImage(`${A.bg}/${padName('team')}.png`) : null,
  ]);
  const theme = THEME[bgName] || THEME.volcano;
  const miniCache = new Map();
  const mini = (spr, sc) => { let m = miniCache.get(spr); if (!m) miniCache.set(spr, m = new Map()); if (!m.has(sc)) m.set(sc, makeMini(spr, sc)); return m.get(sc); };
  const fxImg = {}; types.forEach((t, i) => { fxImg[t] = fxList[i]; });
  const bgSrc = bgImg || drawThemeBg(bgName);
  const padBoss = padBossImg || drawThemePad(120, 28, theme.pad);
  const padTeam = padTeamImg || drawThemePad(180, 30, theme.pad);
  const usingReal = {
    boss: bossSpr.real, team: [...new Set(teamSpr)].map(s => s.real), front: [...new Set(teamFront)].map(s => s.real), effects: types.filter(t => fxImg[t]),
    bg: !!bgImg, pads: !!(padBossImg && padTeamImg), manifest: !!mf,
  };

  // 이름표: 부르는 쪽이 정한 이름(nameOf) → 대본의 label → 몬스터 이름
  const labelOf = (m, i) => labelFor(m, i, opts.nameOf);
  const labels = team.map(labelOf);
  const djName = fight.dj && typeof fight.dj === 'object' ? fight.dj.name : null;
  // 글꼴이 준비될 때까지 잠깐만 기다림(안 오면 기본 글꼴로)
  try {
    const sample = [boss0.name, boss0.aoe, fight.buff?.name, djName, ...labels, ...team.map(m => m.name),
      '보스 출현! 단계 일째 라운드 약점 별로 토벌 성공 실패 땅 생중계 방송 공격 체력 피해 참전 명 연타 위 힘을 모으고 있어요 모두 마리가 쓰러졌어요 마지막 남은 버텼어요 안에 쓰러뜨리지 못했어요 모집 중 결과를 기다리는 시간 초 곧 싸움이 시작돼요 채팅에 아무도 하지 않았어요 오늘은 이미 한 번 져서 그대로예요 MVP Lv./0123456789%+−→…·×'].join('');
    await Promise.race([
      Promise.all([document.fonts.load(`12px "Galmuri11"`, sample), document.fonts.load(`10px "Galmuri9"`, sample)]),
      new Promise(r => setTimeout(r, 2500)),
    ]);
  } catch { /* 기본 글꼴로 */ }

  const ownAudio = !opts.audio; // 밖에서 넘긴 소리(opts.audio)는 장면이 끝나도 닫지 않는다
  const audio = opts.audio || makeAudio(A.music, { ...AUDIO.tracks, ...(opts.tracks || {}) }); audio.set(!!opts.sound);
  if (opts.musicVolume != null) audio.setMusicVolume(opts.musicVolume);
  const scratch = mkCanvas(160, 160), sg = ctx2d(scratch);
  // 무리 그리기 가볍게(2026-11-21 검수 S5 — 위 framePixels 머리말): tintCache 다 칠한 그림(그림 → 장·어둡기 → 판) · pixCache 그림의 점(그림 → 장 → framePixels | null)
  //  · cover 덮개(장면 크기) · dq 이번 장면에 그릴 몬스터 차례(장면마다 다시 채움) · drawStats 지난 장면에 그린 몬스터 수·가려서 건너뛴 수(확인용 ctl.drawStats)
  const tintCache = new Map(), pixCache = new Map(), dq = { m: [], hop: [], f: [], items: [], pool: [], n: 0 }, drawStats = { drawn: 0, hidden: 0 };
  let cover = null;

  // ── 상태 ──
  let S = null;        // 한 판의 상태
  let raf = 0, lastNow = 0, alive = true, total = 0, paused = false, muted = false, endFired = false;
  const amb = { t: 0, embers: [] }; // 판과 상관없이 늘 흐르는 것(불티·물방울·반딧불 …)
  const er = rng(99);
  const partK = particleShare(opts.particles); // 입자 양(약한 기기는 줄임)
  for (let i = 0, n = Math.round(46 * partK); i < n; i++) { const rx = er(), ry = er(); amb.embers.push({ rx, ry, x: rx * W, y: ry * H, v: 5 + er() * 14, ph: er() * 6.28, big: er() < 0.25, hot: er() }); }

  function newActor(spr, pos, dir, type) {
    return { spr, x: pos.x, y: pos.y, ox: 0, oy: 0, hy: 0, tx: 1, dir, type, anim: 'idle', animT0: 0, animDur: 400, flash: 0, tint: 0,
      alpha: 1, visible: false, ko: false, sink: 0, glow: 0, labelA: 0, labelDy: 0, phase: Math.random() * 900, squash: 0, shade: 0, crowd: false, top: false, facing: 'back' };
  }
  // 지금 보여 줄 그림 고르기: 앞모습/뒷모습 × (무리의 작은 그림 / 주목받을 때 큰 그림)
  function useSpr(m) { if (m.set) m.spr = m.set[m.facing][m.crowd ? (m.top ? 'hi' : 'lo') : 'full']; }

  function reset() {
    const boss = newActor(bossSpr, L.boss, -1, bType);
    const mons = team.map((m, i) => Object.assign(newActor(teamSpr[i], L.team[0], 1, m.type), { label: labels[i], lv: m.lv, idx: i, facing: 'front',
      set: { front: { full: teamFront[i] }, back: { full: teamSpr[i] } } }));
    frontIdx.forEach((ti, k) => { const p = L.team[k] || L.team[L.team.length - 1]; mons[ti].x = p.x; mons[ti].y = p.y; useSpr(mons[ti]); });
    // 무리 세우기: 많이 때린 순서로 잘 보이는 줄부터, 줄 안에서는 자리를 섞음
    const crowd = mons.filter(m => !frontIdx.includes(m.idx)).sort((a, b) => dealt[b.idx] - dealt[a.idx] || a.idx - b.idx);
    if (crowd.length) {
      let need = 1, capN = L.rows[0].cap; // 자리가 모자라지 않을 만큼만 줄을 씀
      while (need < L.rows.length && capN < crowd.length) capN += L.rows[need++].cap;
      const rows = L.rows.slice(0, need);
      const r0 = rng(crowd.length * 31 + 5);
      let k = 0;
      rows.forEach((row, ri) => {
        const left = crowd.length - k, capLeft = rows.slice(ri).reduce((n, r) => n + r.cap, 0);
        const cnt = ri === rows.length - 1 ? left : Math.min(left, Math.ceil(left * row.cap / capLeft));
        const slots = [...Array(cnt).keys()];
        for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(r0() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
        const span = row.x1 - row.x0;
        for (let c = 0; c < cnt; c++, k++) {
          const m = crowd[k];
          m.crowd = true; m.shade = row.shade;
          m.x = Math.round(row.x0 + (ri % 2 ? 4 : 0) + (slots[c] + 0.5) * span / cnt + (r0() - 0.5) * 3);
          m.y = row.y + Math.round((r0() - 0.5) * 2);
          for (const face of ['front', 'back']) { const full = m.set[face].full; m.set[face].lo = mini(full, row.s); m.set[face].hi = mini(full, HI_SCALE); }
          useSpr(m);
        }
      });
    }
    S = {
      clock: 0, cues: [], cueIdx: 0, tweens: [], floats: [], parts: [], fx: [], shots: [],
      boss, mons, hpMax: Math.max(1, Number(fight.hp) || 1), hp: Number(fight.hp) || 0, hpGhost: Number(fight.hp) || 0, ui: 0, bar: 0,
      iris: 0, shake: 0, stop: 0, flash: 0, flashCol: '#fff', dim: 0, celebrate: false, done: false, gold: 0,
      track: 'none', trackFade: AUDIO.crossfade, present: 0, countA: 0, count: 0, round: 0, tension: 0, charge: 0, chAcc: 0, strikes: [],
      set: null, quake: 0, joinA: 0,
      crowdSorted: crowd.slice().sort((a, b) => a.y - b.y),
      frontSorted: frontIdx.map(i => mons[i]).sort((a, b) => a.y - b.y),
    };
    total = build();
  }
  function jump(ms) { // 소리 없이 그 시각까지 빨리 감기
    muted = true; reset(); ms = Math.max(0, Math.min(ms, total + 16));
    while (S.clock < ms) { S.stop = 0; advance(16); }
    muted = false;
    audio.music(S.track, AUDIO.crossfade); // 건너뛴 시각에 맞는 곡으로
  }

  // ── 시간표(timeline.js 의 걸음)를 그림 동작으로 ──
  function build() {
    const { boss, mons } = S;
    const at = (t, fn) => S.cues.push({ t, fn });
    const tw = (t, dur, obj, props, e = ease.out) => at(t, () => {
      S.tweens = S.tweens.filter(x => !(x.obj === obj && Object.keys(props).some(k => k in x.props)));
      const from = {}; for (const k in props) from[k] = obj[k];
      S.tweens.push({ obj, props, from, t0: t, dur, e });
    });
    const sfx = (t, n) => at(t, () => { if (!muted) audio.play(n); });
    const shake = (t, amt) => at(t, () => { S.shake = Math.max(S.shake, amt * (calm() ? 0.25 : 1)); });
    const flash = (t, col, a) => { at(t, () => { S.flashCol = col; S.flash = a * (calm() ? 0.3 : 1); }); tw(t, 260, S, { flash: 0 }, ease.lin); };
    const setAnim = (t, a, anim, dur) => at(t, () => { a.anim = anim; a.animT0 = t; a.animDur = dur || 400; });
    const float = (t, f) => at(t, () => S.floats.push({ t0: t, dur: 1200, kind: 'cap', font: 'l', scale: 1, color: C.cream, align: 'center', ...f }));
    const center = a => ({ x: a.x, y: a.y - Math.round(a.spr.bodyH * 0.5) });
    for (const m of TL.marks) at(m.t, () => { if (!muted && opts.onPhase) opts.onPhase(m.name); }); // 장면이 바뀌는 시각
    const bRamp = rampOf(bType), bCol = TYPE_COLOR[bType] || C.ember;

    // 음악: 처음엔 본 곡 → 광역기 예고(없으면 마지막 라운드)부터 절정 곡 → 끝나면 빠짐
    const music = (tm, name, fade) => at(tm, () => { S.track = name; S.trackFade = fade ?? AUDIO.crossfade; });
    const hasCharge = TL.steps.some(s => s.kind === 'charge');
    music(0, 'main');
    const maxR = TL.maxRounds;
    const cOf = m => ({ x: m.x, y: Math.min(H - 14, m.y - Math.round(m.set.back[m.crowd ? 'hi' : 'full'].bodyH * 0.5)) }); // 주목받을 때의 몸 가운데
    let hpRun = S.hp; // 보여 준 순서대로 깎아 감(묶어서 보여 줘도 끝은 같음)
    const drain = (ti, dmg) => {
      hpRun = Math.max(0, hpRun - dmg); const to = hpRun;
      tw(ti, T.hpDrain, S, { hp: to }, ease.out);
      tw(ti + T.hpGhostDelay, T.hpGhost, S, { hpGhost: to }, ease.in);
    };
    const stepUp = (t0, m) => { if (m.crowd) { at(t0, () => { m.top = true; useSpr(m); }); tw(t0, 160, m, { labelA: 1 }, ease.out); } };
    const stepBack = (t1, m) => { if (m.crowd) { tw(t1 - 300, 250, m, { labelA: 0 }, ease.lin); at(t1 - 30, () => { m.top = false; useSpr(m); }); } };
    const shoot = (t0, m, to, dur) => at(t0, () => S.shots.push({ x0: m.x + 4, y0: m.y - m.spr.bodyH * 0.6, x1: to.x + (Math.random() - 0.5) * 36, y1: to.y + (Math.random() - 0.5) * 30,
      t0, dur, ramp: rampOf(m.type) }));

    const DO = {
      // 1) 여는 장면: 보스가 떨어져 내려앉고 이름이 뜸
      opening(st) {
        sfx(0, 'open');
        tw(0, T.fadeIn, S, { iris: 1 }, ease.out);
        at(0, () => { boss.visible = true; boss.oy = -boss.y - 30; });
        tw(T.bossDropAt, T.bossDrop, boss, { oy: 0 }, ease.in);
        const land0 = st.land;
        shake(land0, 7); sfx(land0, 'land'); sfx(land0 + 180, 'roar');
        at(land0, () => { boss.squash = 1; dust(boss.x, boss.y, 16, 46); });
        tw(land0, 420, boss, { squash: 0 }, ease.out);
        setAnim(land0 + 200, boss, 'attack', 600); setAnim(land0 + 800, boss, 'idle');
        float(land0 + 150, { icon: '👹', text: '보스 출현!', x: L.cap.x, y: L.cap.y + 6, scale: 2, color: C.gold, dur: T.bossCaption, slam: true });
        const t = land0 + 150 + T.bossCaption;
        float(t, { text: boss0.name, sub: `${boss0.stage}일째`, x: L.cap.x, y: L.cap.y + 6, scale: 2, dur: T.bossName, slam: true });
        tw(t + T.bossName - 500, 500, S, { ui: 1 }, ease.out);
        if (!TL.joinOnly && team.length) tw(t + T.bossName - 500, 500, S, { bar: 1 }, ease.out); // 체력 막대는 싸울 때만
      },
      // 모집 중: 남은 시간 · 참전 수를 보여 주며 기다림(글은 render 에서 지금 값으로)
      joinWait(st) { tw(st.t, 400, S, { joinA: 1 }, ease.out); sfx(st.t, 'join'); },
      // 2) 들어오기 — 한 명이 앞모습(보는 사람 쪽)으로 나와 자기 몬스터를 보여 줌
      present(st) {
        const t0 = st.t, P = st.dur, m = mons[st.i], info = team[m.idx], sub = `Lv.${m.lv}` + (info.name && info.name !== m.label ? `  ${info.name}` : '');
        if (big && st.i === frontIdx[0]) tw(t0, 300, S, { countA: 1 }, ease.out);
        at(t0, () => { m.visible = true; m.top = true; m.ox = -m.x - 50; m.oy = L.stage.y - m.y; S.count++; });
        tw(t0, 220, S, { present: 1 }, ease.out); tw(t0 + P - 640, 300, S, { present: 0 }, ease.out); // 먼저 온 몬스터는 잠깐 흐려져 주인공만 또렷하게
        tw(t0, 420, m, { ox: L.stage.x - m.x }, ease.out);          // 가운데로 뛰어나옴
        tw(t0, 150, m, { hy: -9 }, ease.out); tw(t0 + 150, 150, m, { hy: 0 }, ease.in);
        tw(t0 + 300, 70, m, { hy: -4 }, ease.out); tw(t0 + 370, 70, m, { hy: 0 }, ease.in);
        at(t0 + 440, () => { m.squash = 0.7; dust(m.x + m.ox, Math.min(m.y + m.oy, H - 2), 8, 22); });
        tw(t0 + 440, 260, m, { squash: 0 }, ease.out);
        sfx(t0 + 440, 'join');
        setAnim(t0 + 560, m, 'pose', 500);                           // 포즈 + 이름 · 레벨 · 몬스터 이름
        tw(t0 + 560, 130, m, { hy: -8 }, ease.out); tw(t0 + 690, 150, m, { hy: 0 }, ease.in);
        at(t0 + 560, () => sparkle(m.x + m.ox, m.y + m.oy - m.spr.bodyH * 0.6, 8, TYPE_COLOR[m.type] || C.gold));
        float(t0 + 480, { text: m.label, sub, x: L.cap.x, y: L.cap.y + 2, scale: 2, dur: P - 1000, slam: true });
        setAnim(t0 + P - 620, m, 'idle');
        tw(t0 + P - 600, 400, m, { ox: 0, oy: 0 }, ease.out);       // 제자리로 폴짝
        tw(t0 + P - 600, 200, m, { hy: -12 }, ease.out); tw(t0 + P - 400, 200, m, { hy: 0 }, ease.in);
        at(t0 + P - 200, () => { m.top = false; m.squash = 0.6; dust(m.x, Math.min(m.y, H - 2), 6, 18); });
        tw(t0 + P - 200, 240, m, { squash: 0 }, ease.out);
        tw(t0 + P - 200, 220, m, { labelA: 1 }, ease.back);
      },
      // 무리는 몇 명씩 묶여 제자리에 통통 나타남(앞모습), 참전 수가 올라감
      crowd(st) {
        const t = st.t, r1 = rng(77), order = S.crowdSorted.slice().sort(() => r1() - 0.5), per = 6;
        const gap = Math.min(260, 1500 / Math.ceil(order.length / per));
        order.forEach((m, i) => {
          const tt = t + Math.floor(i / per) * gap + (i % per) * 28;
          at(tt, () => { m.visible = true; m.squash = 0.8; S.count++; });
          tw(tt, 260, m, { squash: 0 }, ease.back);
          tw(tt, 100, m, { hy: -5 }, ease.out); tw(tt + 100, 120, m, { hy: 0 }, ease.in);
          if (i % per === 0) sfx(tt, 'join');
        });
        float(t + 1500, { icon: '👥', text: `참전 ${team.length}명`, x: L.cap.x, y: L.cap.y, scale: 2, dur: st.dur - 1600, slam: true });
      },
      // 3) 파티 버프
      buff(st) {
        const t = st.t, b = fight.buff, bits = [];
        if (b.a && b.a !== 1) bits.push(`공격 +${Math.round((b.a - 1) * 100)}%`);
        if (b.h && b.h !== 1) bits.push(`체력 +${Math.round((b.h - 1) * 100)}%`);
        float(t + 100, { icon: '✨', text: `${b.name}!`, sub: bits.join('   '), x: L.cap.x, y: L.cap.y - 6, scale: 2, color: C.gold, dur: st.dur - 400, slam: true });
        sfx(t + 100, 'buff'); flash(t + 100, C.gold, 0.3);
        tw(t + 100, 300, S, { gold: 1 }, ease.out); tw(t + st.dur - 700, 600, S, { gold: 0 }, ease.lin);
        const gap = Math.min(160, 900 / mons.length);
        mons.forEach((m, i) => {
          const tt = t + 250 + i * gap;
          at(tt, () => { m.tint = 1; sparkle(m.x, m.y - m.spr.bodyH * 0.5, m.crowd ? 4 : 14, C.gold); });
          tw(tt, 600, m, { tint: 0 }, ease.lin);
          tw(tt, 130, m, { oy: m.crowd ? -3 : -6 }, ease.out); tw(tt + 130, 150, m, { oy: 0 }, ease.in);
        });
      },
      // 싸움 직전: 모두 폴짝 뛰며 보스 쪽으로 돌아섬(뒷모습으로 바뀜)
      turn(st) {
        const t = st.t;
        mons.forEach((m, i) => {
          const d = m.crowd ? 140 + (i % 6) * 45 : frontIdx.indexOf(m.idx) * 90;
          tw(t + d, 120, m, { hy: m.crowd ? -4 : -9, tx: 0.1 }, ease.out);
          at(t + d + 120, () => { m.facing = 'back'; useSpr(m); });
          tw(t + d + 120, 140, m, { hy: 0, tx: 1 }, ease.in);
          at(t + d + 260, () => { m.squash = 0.4; if (!m.crowd) dust(m.x, Math.min(m.y, H - 2), 6, 18); });
          tw(t + d + 260, 220, m, { squash: 0 }, ease.out);
        });
        sfx(t, 'turn'); sfx(t + 200, 'turn');
      },
      round(st) {
        const t = st.t, rn = st.n;
        at(t, () => { S.round = rn; });
        if (st.last) { // 마지막 라운드: 붉게 조여 오는 화면 + 경고
          float(t + 80, { icon: '⚠', text: '마지막 라운드!', x: L.cue.x, y: L.cue.y - 6, scale: 2, color: C.red, dur: st.dur - 200, slam: true });
          if (!hasCharge) music(t, 'climax');
          sfx(t + 80, 'alarm'); flash(t + 80, C.red, 0.34); flash(t + 620, C.red, 0.22); shake(t + 80, 3);
          tw(t + 80, 500, S, { tension: 1 }, ease.out);
        } else {
          float(t + 80, { text: maxR ? `라운드 ${rn}/${maxR}` : `라운드 ${rn}`, x: L.cue.x, y: L.cue.y - (big ? 6 : 0), scale: big ? 2 : 1, color: C.cream, dur: st.dur - 150, wipe: true });
          sfx(t + 80, 'round');
        }
      },
      // 몬스터 한 마리가 보스를 때림
      hit(st) {
        const t0 = st.t, ev = st.ev, dur = st.dur, imp = st.imp;
        const m = mons[ev.i], strong = ev.eff > 1, weak = ev.eff < 1, ti = t0 + imp, bc = center(boss);
        setAnim(t0, m, 'attack', imp + 160);
        if (m.crowd) { // 무리 속 한 명: 커지며 앞으로 나와 이름표가 뜸
          stepUp(t0, m);
          tw(t0, 150, m, { oy: -12 }, ease.out);
          tw(t0 + 150, imp - 150, m, { ox: 8, oy: -8 }, ease.in);
          shoot(ti - 110, m, bc, 110);
          tw(ti + 120, 300, m, { ox: 0, oy: 0 }, ease.out);
          stepBack(t0 + dur, m);
        } else {
          tw(t0 + imp * 0.3, imp * 0.63, m, { ox: 18, oy: -10 }, ease.in);
          tw(ti + 40, 260, m, { ox: 0, oy: 0 }, ease.out);
        }
        setAnim(ti + 200, m, 'idle');
        at(ti, () => {
          S.fx.push({ type: m.type, x: bc.x, y: bc.y, t0: ti, dur: strong ? 560 : 440, seed: (Math.random() * 1e6) | 0, scale: strong ? 1.25 : weak ? 0.7 : 1 });
          burst(bc.x, bc.y, strong ? 22 : weak ? 5 : 12, rampOf(m.type), strong ? 95 : 60);
          boss.flash = weak ? 0.5 : 1; boss.ox = weak ? 2 : strong ? 8 : 5;
          if (strong && !calm()) S.stop = T.hitStop;
        });
        setAnim(ti, boss, 'hit', 380); setAnim(ti + (strong ? 460 : 340), boss, 'idle');
        tw(ti, 260, boss, { flash: 0 }, ease.lin);
        tw(ti + 40, 300, boss, { ox: 0 }, ease.out);
        shake(ti, strong ? 7 : weak ? 1.2 : 3.2);
        sfx(ti, strong ? 'super' : weak ? 'weak' : 'hit');
        if (strong) flash(ti, TYPE_COLOR[m.type] || '#fff', 0.42);
        float(ti, { kind: 'dmg', text: num(ev.dmg), x: bc.x - 20 + (ev.i * 9) % 20, y: bc.y - 34, scale: strong || big ? 2 : 1,
          color: strong ? C.gold : weak ? C.dim : C.cream, dur: Math.min(1100, dur - imp - 100) });
        if (strong) float(ti + 60, { text: '약점!', x: bc.x - 62, y: bc.y - 8, color: TYPE_COLOR[m.type] || C.gold, dur: Math.min(900, dur - imp - 150), slam: true });
        if (weak) float(ti + 60, { text: '별로…', x: bc.x - 58, y: bc.y - 6, font: 's', color: C.dim, dur: 800 });
        drain(ti, ev.dmg);
      },
      // 여럿이 한꺼번에: 모두 폴짝 + 작은 효과 여러 개 + 합친 숫자 하나
      volley(st) {
        const t0 = st.t, hits = st.hits;
        const bc = center(boss), ti = t0 + 480, sum = hits.reduce((n, e) => n + e.dmg, 0);
        const ms = [...new Set(hits.map(e => mons[e.i]).filter(Boolean))], r2 = rng(hits.length * 13 + Math.round(t0));
        for (const m of ms) {
          const d = r2() * 280;
          tw(t0 + d, 110, m, { oy: m.crowd ? -5 : -9 }, ease.out); tw(t0 + d + 110, 140, m, { oy: 0 }, ease.in);
          at(t0 + d, () => { m.flash = 0.75; }); tw(t0 + d, 240, m, { flash: 0 }, ease.lin);
          shoot(t0 + d + 100, m, bc, 300);
        }
        const nfx = clamp(Math.ceil(ms.length / 3), 3, 8);
        for (let k = 0; k < nfx; k++) {
          const tk = ti + k * 70, m = ms[Math.floor(r2() * ms.length)], fx0 = bc.x + (r2() - 0.5) * 56, fy0 = bc.y + (r2() - 0.5) * 46;
          at(tk, () => {
            S.fx.push({ type: m.type, x: fx0, y: fy0, t0: tk, dur: 360, seed: (Math.random() * 1e6) | 0, scale: 0.55 });
            burst(fx0, fy0, 4, rampOf(m.type), 50);
            boss.flash = 0.7; boss.ox = 3;
          });
          tw(tk, 60, boss, { flash: 0.2, ox: 1 }, ease.lin);
          shake(tk, 2.4); if (k < 5) sfx(tk, 'tick');
        }
        const tEnd = ti + nfx * 70;
        setAnim(ti, boss, 'hit', 380); setAnim(tEnd + 220, boss, 'idle');
        tw(tEnd, 200, boss, { flash: 0, ox: 0 }, ease.out);
        float(ti + 120, { kind: 'dmg', text: num(sum), sub2: `${hits.length}연타`, x: bc.x - 14, y: bc.y - 36, scale: 2, color: C.cream, dur: st.dur - 700 });
        drain(ti + 100, sum);
      },
      // 보스가 몬스터 한 마리를 때림
      boss(st) {
        const t0 = st.t, ev = st.ev, end = t0 + st.dur;
        const m = mons[ev.i], strong = ev.eff > 1, weak = ev.eff < 1, ti = t0 + T.bossImpact, mc = cOf(m);
        stepUp(t0, m);
        setAnim(t0, boss, 'attack', T.bossImpact + 200);
        float(t0, { text: '공격', x: L.atk.x, y: L.atk.y, color: C.ember, dur: 1000, slam: true });
        sfx(t0, 'bossAtk');
        tw(t0 + 120, T.bossImpact - 150, boss, { ox: -14, oy: 7 }, ease.in);
        tw(ti + 60, 320, boss, { ox: 0, oy: 0 }, ease.out);
        setAnim(ti + 260, boss, 'idle');
        at(ti, () => {
          S.fx.push({ type: bType, x: mc.x, y: mc.y, t0: ti, dur: 520, seed: (Math.random() * 1e6) | 0, scale: (strong ? 1.15 : 0.95) * (m.crowd ? 0.75 : 1) });
          burst(mc.x, mc.y, strong ? 18 : 10, bRamp, 70);
          m.flash = 1; m.ox = -6;
          if (strong && !calm()) S.stop = T.hitStop;
        });
        setAnim(ti, m, 'hit', 380);
        tw(ti, 260, m, { flash: 0 }, ease.lin);
        tw(ti + 40, 320, m, { ox: 0 }, ease.out);
        shake(ti, strong ? 6 : 3.5); sfx(ti, 'hurt');
        if (strong) flash(ti, bCol, 0.36);
        float(ti, { kind: 'dmg', text: num(ev.dmg), x: mc.x + 4, y: mc.y - 14, scale: strong ? 2 : 1, color: C.hurt, dur: 1100 });
        if (strong) float(ti + 60, { text: '약점!', x: mc.x + 42, y: mc.y + 6, color: C.ember, dur: 900, slam: true });
        if (weak) float(ti + 60, { text: '별로…', x: mc.x + 40, y: mc.y + 6, font: 's', color: C.dim, dur: 800 });
        if (ev.ko) {
          setAnim(ti + 420, m, 'down');
          at(ti + 420, () => { m.ko = true; dust(m.x, Math.min(m.y, H - 2), 8, 22); });
          sfx(ti + 420, 'ko');
          if (m.crowd) { // 무리 속에서는 그 자리에서 쓰러져 사라짐
            tw(ti + 1100, 900, m, { alpha: 0, labelA: 0 }, ease.in);
            at(end + 300, () => { m.top = false; m.visible = false; });
          } else { // 앞줄: 누운 그림 → 땅으로 가라앉음 → 이름표가 잿빛으로
            tw(ti + 900, 800, m, { sink: 26, alpha: 0 }, ease.in);
            if (!big) tw(ti + 900, 800, m, { labelDy: Math.min(m.spr.bodyH - 6, H - 22 - (m.y - m.spr.bodyH - 23)) }, ease.out);
          }
        } else {
          setAnim(ti + 400, m, 'idle');
          stepBack(end, m);
        }
      },
      // 광역기 예고: 보스가 웅크려 달아오르고, 빛이 빨려 들어감. 광역기를 쓸 때까지 이어짐
      charge(st) {
        const t0 = st.t, nm = boss0.name;
        music(t0, 'climax');
        setAnim(t0, boss, 'charge');
        tw(t0, 500, S, { charge: 1 }, ease.out);
        tw(t0, 700, boss, { glow: 1 }, ease.out);
        sfx(t0, 'charge'); flash(t0 + 60, bCol, 0.3); shake(t0 + 60, 3);
        float(t0 + 80, { icon: '⚠', text: `${nm}${josaOf(nm)}`, sub: '힘을 모으고 있어요!', subColor: C.gold, x: L.cap.x, y: L.cap.y + 2, color: C.ember, dur: st.dur - 250, slam: true });
      },
      // 광역기: 이름 외침 → 속성별 큰 장면(분화·소용돌이·뿌리 지진·모래 폭풍·구름 행진·번개 그물) → 온 팀이 맞음 → 쓰러짐 → 남은 몬스터가 다시 일어섬
      aoe(st) {
        const t0 = st.t, ev = st.ev, sty = aoeStyle;
        const bc = center(boss), name = boss0.aoe || sty.title, ramp = bRamp;
        const hits = (ev.hits || []).filter(h => mons[h.i]), quiet = calm();
        float(t0 + 60, { icon: sty.icon, text: `${name}!`, x: L.cap.x, y: L.cap.y, scale: 2, color: bType === 'fire' ? C.ember : bCol, dur: 1700, slam: true });
        setAnim(t0, boss, 'attack', 900); setAnim(t0 + 1000, boss, 'idle');
        sfx(t0, 'roar'); sfx(t0 + 520, sty.sfx);
        tw(t0 + 400, 500, S, { charge: 0 }, ease.lin); tw(t0 + 500, 600, boss, { glow: 0 }, ease.lin);
        tw(t0 + 300, 200, boss, { hy: -5 }, ease.out); tw(t0 + 500, 120, boss, { hy: 0 }, ease.in);
        at(t0 + 520, () => { // 터지는 순간: 보스 몸에서 속성 빛이 솟구침
          boss.squash = 0.8;
          const topY = boss.y - boss.spr.bodyH + 14, n = quiet ? 16 : 60, up = bType === 'fire' || bType === 'water' || bType === 'electric';
          for (let k = 0; k < n; k++) addPart({ x: boss.x + (Math.random() - 0.5) * 50, y: (up ? topY : boss.y - 6) + Math.random() * 10, vx: (Math.random() - (up ? 0.5 : 0.85)) * (up ? 130 : 260), vy: up ? -120 - Math.random() * 200 : -30 - Math.random() * 90, g: up ? 260 : 120,
            life: 0, max: 600 + Math.random() * 700, ramp, size: Math.random() < 0.5 ? 3 : 2, delay: Math.random() * 180 });
        });
        tw(t0 + 520, 400, boss, { squash: 0 }, ease.out);
        flash(t0 + 520, sty.flash, 0.6); shake(t0 + 520, 10); shake(t0 + 820, 6);
        tw(t0 + 700, 400, S, { dim: 0.22 }, ease.out); tw(t0 + 2700, 600, S, { dim: 0 }, ease.out); // 하늘이 잠깐 어두워짐
        // 큰 장면(땅·하늘에 깔리는 것): render 의 drawSet 이 그림
        at(t0 + 520, () => { S.set = { type: bType, t0: t0 + 520, dur: 2600, seed: (t0 | 0) + 11, pts: hits.slice(0, 14).map(h => { const m = mons[h.i]; return { x: m.x, y: m.y - m.spr.bodyH * 0.5 }; }) }; });
        at(t0 + 3200, () => { S.set = null; });
        if (bType === 'grass' || bType === 'earth') for (let k = 0; k < 9; k++) shake(t0 + 700 + k * 200, bType === 'grass' ? 4.5 : 2.2); // 땅이 계속 흔들림
        if (bType === 'electric' && !quiet) for (const d of [900, 1500, 2050]) flash(t0 + d, '#fff7a0', 0.2);
        // 맞는 차례: 보스 쪽(오른쪽)부터 퍼져 나감 — 소용돌이는 가운데를 돌며, 번개는 그물이 이어지는 대로
        const fc = L.field;
        const key = { water: h => Math.atan2((mons[h.i].y - fc.y) * 3, mons[h.i].x - fc.x), electric: h => (h.i * 7919) % 97 }[bType] || (h => -mons[h.i].x);
        const order = hits.slice().sort((a, b) => key(a) - key(b)), span = 950;
        let crowdSum = 0, crowdN = 0, koN = 0, cx = 0, cyMin = H;
        order.forEach((h, k) => {
          const m = mons[h.i], strong = h.eff > 1, mc = cOf(m);
          const ti = t0 + 1250 + (order.length > 1 ? (k / (order.length - 1)) * span : 0);
          at(ti - sty.lead, () => strike(sty.strike, m, ti - sty.lead, sty.lead));
          at(ti, () => {
            S.fx.push({ type: bType, x: m.x, y: m.y - m.spr.bodyH * 0.5, t0: ti, dur: 480, seed: (Math.random() * 1e6) | 0, scale: m.crowd ? 0.5 : strong ? 1.1 : 0.9 });
            burst(m.x, m.y - m.spr.bodyH * 0.4, m.crowd ? 4 : 12, ramp, 70);
            m.flash = 1; m.ox = m.crowd ? -3 : -6;
          });
          setAnim(ti, m, 'hit', 380);
          tw(ti, 280, m, { flash: 0 }, ease.lin);
          tw(ti + 40, 320, m, { ox: 0 }, ease.out);
          if (!m.crowd || k % 4 === 0) { shake(ti, m.crowd ? 2.5 : 5); sfx(ti, sty.hitSfx); }
          if (m.crowd) { crowdSum += h.dmg; crowdN++; cx += m.x; cyMin = Math.min(cyMin, m.y - m.spr.bodyH); }
          else { // 앞줄은 한 마리씩 숫자
            float(ti, { kind: 'dmg', text: num(h.dmg), x: mc.x + 4, y: mc.y - 16, scale: strong ? 2 : 1, color: C.hurt, dur: 1200 });
            if (strong) float(ti + 60, { text: '약점!', x: mc.x + 6, y: mc.y + 8, font: 's', color: C.ember, dur: 900 });
          }
          if (h.ko) {
            koN++;
            setAnim(ti + 380, m, 'down');
            at(ti + 380, () => { m.ko = true; if (!m.crowd) dust(m.x, Math.min(m.y, H - 2), 8, 22); });
            if (m.crowd) { tw(t0 + 3000 + (k % 5) * 60, 800, m, { alpha: 0 }, ease.in); at(t0 + st.dur, () => { m.visible = false; }); }
            else {
              tw(t0 + 3000, 800, m, { sink: 26, alpha: 0 }, ease.in);
              if (!big) tw(t0 + 3000, 800, m, { labelDy: Math.min(m.spr.bodyH - 6, H - 22 - (m.y - m.spr.bodyH - 23)) }, ease.out);
            }
          } else {
            setAnim(ti + 420, m, 'idle');
            // 버틴 몬스터는 잠깐 웅크렸다가 다시 일어섬
            tw(ti + 420, 200, m, { squash: 0.5 }, ease.out);
            tw(t0 + 3500 + (k % 6) * 50, 130, m, { squash: 0, hy: m.crowd ? -4 : -7 }, ease.out); tw(t0 + 3630 + (k % 6) * 50, 150, m, { hy: 0 }, ease.in);
          }
        });
        if (!quiet) for (let k = 0; k < 14; k++) { // 빗나간 것들(빈 땅에 떨어짐)
          const tk = t0 + 1000 + Math.random() * (span + 300), x1 = Math.random() * W, y1 = (L.portrait ? H * 0.66 : H * 0.6) + Math.random() * H * 0.34;
          at(tk, () => strike(sty.strike, { x: x1, y: y1, spr: { bodyH: 0 }, crowd: true }, tk, sty.lead, true));
          at(tk + sty.lead, () => { burst(x1, y1, 4, ramp, 50); dust(x1, y1, 3, 12); });
        }
        if (crowdN) float(t0 + 1250 + span * 0.55, { kind: 'dmg', text: `모두 −${num(crowdSum)}`, x: cx / crowdN, y: Math.max(L.portrait ? L.boss.y + 16 : 56, cyMin - 22), scale: 2, color: C.hurt, dur: 1500 });
        if (koN) { // 쓰러지는 순간을 한 박자 크게
          const tk = t0 + 1250 + span + 380;
          sfx(tk, 'ko'); shake(tk, koN > 1 ? 6 : 3);
          if (koN > 1) float(tk + 80, { text: `${koN}마리가 쓰러졌어요`, x: L.cue.x, y: L.cue.y, color: C.hurt, dur: 1500, slam: true });
        }
        sfx(t0 + 3550, 'join');
      },
      // 5) 끝: 결과
      ending(st) {
        const t = st.t, win = st.result === 'win';
        const rank = team.map((m, i) => ({ m, i })).sort((a, b) => dealt[b.i] - dealt[a.i] || a.i - b.i);
        const results = (t0, xc, landCol, y0) => { // MVP · (여럿이면 2·3위) · 땅(나중에 와도 그 자리에 뜸)
          let y = y0, tt = t0; xc = clamp(xc, 0, W);
          const mvI = fight.mvp ? fight.mvp.i : -1, mv = team[mvI];
          if (mv) { float(tt, { text: `MVP ${labels[mvI]}`, sub2: `${num(fight.mvp.dealt)} 피해`, x: xc, y, stay: true, slam: true }); y += big ? 15 : 18; tt += 550; }
          if (big) {
            let no = 2;
            for (const r of rank) {
              if (r.i === mvI) continue; if (no > 3) break;
              float(tt, { text: `${no}위 ${labels[r.i]}`, sub2: `${num(dealt[r.i])} 피해`, font: 's', x: xc, y, stay: true }); y += 11; tt += 280; no++;
            }
            y += 4; tt += 250;
          }
          float(tt, { icon: '🗺', textFn: () => landLine(win, land), x: xc, y, color: landCol, stay: true, slam: true });
        };
        tw(t, 500, S, { tension: 0 }, ease.lin);
        if (win) {
          const bc = center(boss);
          setAnim(t, boss, 'down');
          for (let k = 0; k < 4; k++) {
            at(t + k * 190, () => { boss.flash = 1; burst(bc.x + (Math.random() - 0.5) * 50, bc.y + (Math.random() - 0.5) * 40, 10, bRamp, 70); });
            tw(t + k * 190, 150, boss, { flash: 0 }, ease.lin);
            shake(t + k * 190, 3 + k); sfx(t + k * 190, 'hit');
          }
          at(t + 820, () => { dissolve(boss); boss.visible = false; });
          flash(t + 820, '#fff', 0.7); shake(t + 820, 8); sfx(t + 820, 'crumble');
          tw(t + 1100, 700, S, { ui: 0, bar: 0 }, ease.lin);
          tw(t + 1500, 600, S, { dim: 0.46 }, ease.out);
          mons.forEach(m => tw(t + 1300, 400, m, { labelA: 0 }, ease.lin)); // 결과 글과 겹치지 않게 이름표는 내림
          at(t + 1700, () => { S.celebrate = true; });
          music(t + 1300, 'none', AUDIO.winFade);
          sfx(t + 1750, 'win');
          float(t + 1750, { icon: '🏆', text: '토벌 성공!', x: L.win.x, y: L.win.y, scale: 2, color: C.gold, stay: true, slam: true });
          results(t + 2450, L.win.x, C.teal, L.win.y0);
          at(t + 1750, () => { for (let k = 0; k < 5; k++) sparkle(W * (0.12 + Math.random() * 0.76), 20 + Math.random() * 70, 6, C.gold); });
        } else if (st.result === 'timeout') {
          // 라운드 안에 못 잡고 진 판: ① 남은 체력에 눈길 → ② 보스가 포효하며 모두를 밀어냄 → ③ 결과 ("버텼어요" — 갑자기 지는 느낌이 없게)
          const left = Math.max(0, Math.round(fight.left ?? hpRun)), bc = center(boss), nm = boss0.name, koSet = new Set(TL.ko);
          tw(t, 400, S, { dim: 0.3 }, ease.out);
          float(t + 150, { text: `남은 체력 ${num(left)}`, x: L.left.x, y: L.left.y, align: 'left', color: C.red, dur: 3300, slam: true });
          sfx(t + 150, 'tick'); sfx(t + 450, 'tick'); sfx(t + 750, 'tick');
          const t1 = t + 1500;
          tw(t1, 300, S, { dim: 0 }, ease.out);
          setAnim(t1, boss, 'attack', 800); setAnim(t1 + 900, boss, 'idle');
          sfx(t1, 'roar'); shake(t1 + 150, 8); shake(t1 + 450, 5); flash(t1 + 150, C.red, 0.32);
          at(t1 + 150, () => burst(bc.x, bc.y, 44, bRamp, 190));
          float(t1 + 200, { text: `${nm}${josaOf(nm)} 버텼어요…`, x: L.cap.x, y: L.left.y + 17, dur: 1750, slam: true });
          for (const m of mons) { // 쓰러진 게 아니라 밀려나 주저앉음(쓰러진 그림은 쓰지 않음)
            if (koSet.has(m.idx)) continue;
            const d = 180 + Math.min(260, Math.abs(m.x - boss.x) * 0.9), back = m.crowd ? 4 : 10;
            at(t1 + d, () => { m.flash = 0.8; });
            tw(t1 + d, 240, m, { flash: 0 }, ease.lin);
            setAnim(t1 + d, m, 'hit', 420); setAnim(t1 + d + 420, m, 'idle');
            tw(t1 + d, 130, m, { ox: -back * 1.5, hy: -3 }, ease.out);
            tw(t1 + d + 130, 300, m, { ox: -back, hy: 0 }, ease.in);
            tw(t1 + d + 430, 400, m, { squash: 0.3, tint: 0 }, ease.out);
            at(t1 + d + 430, () => { m.shade = Math.max(m.shade, 0.2); });
          }
          const t2 = t1 + 2000;
          music(t2, 'none', AUDIO.loseFade);
          tw(t2, 600, S, { dim: 0.55 }, ease.out);
          mons.forEach(m => tw(t2 - 100, 400, m, { labelA: 0 }, ease.lin));
          sfx(t2 + 300, 'lose');
          float(t2 + 300, { icon: '💀', text: '토벌 실패', sub: maxR ? `${maxR}라운드 안에 쓰러뜨리지 못했어요` : '', subFont: 's', subColor: C.dim,
            x: L.lose.x, y: L.lose.y, scale: 2, color: C.hurt, stay: true, slam: true });
          results(t2 + 1100, L.lose.x, C.dim, L.lose.y + (maxR ? 44 : 34));
        } else { // 모두 쓰러짐(wipe) · 아무도 참전하지 않음(empty — 보스가 그냥 지나감, 실패가 아님)
          const empty = st.result === 'empty';
          setAnim(t + 100, boss, 'attack', 700); setAnim(t + 800, boss, 'idle');
          sfx(t + 100, 'roar'); shake(t + 250, 5);
          music(t + 600, 'none', AUDIO.loseFade);
          tw(t + 600, 700, S, { dim: 0.55 }, ease.out);
          mons.forEach(m => tw(t + 500, 400, m, { labelA: 0 }, ease.lin));
          sfx(t + 1100, 'lose');
          float(t + 1100, { icon: empty ? '💨' : '💀', text: empty ? '그냥 지나갔어요' : '토벌 실패', sub: '', subFont: 's', subColor: C.dim, x: L.lose.x, y: L.lose.y, scale: 2, color: C.hurt, stay: true, slam: true });
          results(t + 1800, L.lose.x, C.dim, L.lose.y + 34);
        }
      },
    };
    for (const st of TL.steps) DO[st.kind](st);
    if (!TL.joinOnly) at(TL.duration, () => { S.done = true; if (!endFired) { endFired = true; if (opts.onEnd) setTimeout(() => { try { opts.onEnd(fight); } catch { /* 부른 쪽 오류는 장면을 멈추지 않음 */ } }, 0); } });
    S.cues.sort((a, b) => a.t - b.t);
    return TL.duration;
  }

  // ── 작은 조각들 ──
  function addPart(p) { if (!keepParticle(partK)) return; if (S.parts.length < 5000) S.parts.push(p); }
  function burst(x, y, n, ramp, speed) {
    if (calm()) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, v = speed * (0.4 + Math.random() * 0.8);
      addPart({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, g: 160, life: 0, max: 300 + Math.random() * 380, ramp, size: Math.random() < 0.35 ? 2 : 1, delay: 0 });
    }
  }
  function dust(x, y, n, spread) {
    for (let i = 0; i < n; i++) {
      const d = Math.random() < 0.5 ? -1 : 1;
      addPart({ x: x + d * Math.random() * spread * 0.5, y: y - 1, vx: d * (15 + Math.random() * spread), vy: -8 - Math.random() * 22, g: 50, life: 0,
        max: 350 + Math.random() * 300, ramp: theme.dust, size: Math.random() < 0.5 ? 2 : 1, delay: 0 });
    }
  }
  function sparkle(x, y, n, col) {
    for (let i = 0; i < n; i++) {
      addPart({ x: x + (Math.random() - 0.5) * 34, y: y + (Math.random() - 0.5) * 36, vx: (Math.random() - 0.5) * 8, vy: -18 - Math.random() * 26, g: 0, life: 0,
        max: 500 + Math.random() * 600, ramp: ['#ffffff', col, col, '#c8842a'], size: 1, delay: Math.random() * 300, star: true });
    }
  }
  // 광역기에서 몬스터 하나에게 떨어지는 것(속성별 모양은 drawStrike)
  function strike(style, m, t0, lead, miss) {
    const y1 = m.y - m.spr.bodyH * 0.5, sd = (Math.random() * 1e6) | 0, size = m.crowd ? 3 : 5;
    const o = { style, x1: m.x, y1, foot: m.y, t0, dur: lead, size, miss: !!miss, seed: sd, h: Math.max(14, m.spr.bodyH * 0.9) };
    if (style === 'rock') { o.x0 = m.x + 46 + Math.random() * 30; o.y0 = -12; }
    else if (style === 'drop') { o.a0 = Math.random() * 6.283; o.r = 30 + Math.random() * 16; }
    else if (style === 'root') { o.dur = lead + 620; }           // 솟은 뒤 잠깐 서 있다가 들어감
    else if (style === 'sand') { o.dur = lead + 220; }
    else if (style === 'gust') { o.y0 = L.cloudY + 4; }
    else if (style === 'bolt') { o.dur = lead + 170; o.dx = (Math.random() - 0.5) * 50; }
    S.strikes.push(o);
  }
  function dissolve(a) { // 보스가 점으로 흩어짐
    const s = a.spr, fr = frameOf(a);
    try {
      sg.clearRect(0, 0, 160, 160);
      sg.drawImage(s.img, fr.frame * s.fw, 0, s.fw, s.fh, 0, 0, s.fw, s.fh);
      const d = sg.getImageData(0, 0, s.fw, s.fh).data, step = calm() ? 3 : 2;
      for (let y = 0; y < s.fh; y += step) for (let x = 0; x < s.fw; x += step) {
        const i = (y * s.fw + x) * 4; if (d[i + 3] < 100) continue;
        const col = `rgb(${d[i]},${d[i + 1]},${d[i + 2]})`;
        addPart({ x: a.x - s.fw / 2 + (s.flip ? s.fw - 1 - x : x), y: a.y - s.baseline + y, vx: (Math.random() - 0.5) * 26, vy: -14 - Math.random() * 44, g: -12, life: 0,
          max: 500 + Math.random() * 900, ramp: [col, col, col, '#ffd24a', '#ff7a2f'], size: step, delay: (y / s.fh) * 520 + Math.random() * 160 });
      }
    } catch { burst(a.x, a.y - 50, 60, rampOf(bType), 90); }
  }

  // ── 그리기 ──
  function frameOf(a) {
    const s = a.spr, tA = S.clock - a.animT0;
    const anim = a === S.boss && S.charge > 0.5 && a.anim === 'idle' ? 'charge' : a.anim; // 힘을 모으는 동안은 웅크린 채로
    let frame = 0, sx = 1, sy = 1, rot = 0, dark = 0;
    if (s.real) {
      const fr = s.anims[anim] || s.anims.idle || [0];
      if (anim === 'idle') frame = fr[Math.floor((amb.t + a.phase) / (S.tension > 0.5 ? T.idleFrame / 2 : T.idleFrame)) % fr.length];
      else if (anim === 'attack') frame = fr[clamp(Math.floor(tA / a.animDur * fr.length), 0, fr.length - 1)];
      else if (anim === 'charge') { frame = (s.anims.attack || fr)[0]; if (Math.floor(amb.t / 120) % 2) { sx = 1.02; sy = 0.98; } }
      else frame = fr[0];
    } else { // 한 장짜리 그림은 늘이고 기울여서 흉내
      if (anim === 'idle') { if (Math.floor((amb.t + a.phase) / (S.tension > 0.5 ? T.idleFrame / 2 : T.idleFrame)) % 2) { sy = 0.965; sx = 1.015; } }
      else if (anim === 'pose') { sx = 0.95; sy = 1.08; }
      else if (anim === 'charge') { sx = 1.1; sy = 0.86; if (Math.floor(amb.t / 120) % 2) { sx = 1.12; sy = 0.84; } }
      else if (anim === 'attack') {
        const p = clamp(tA / a.animDur, 0, 1);
        if (p < 0.3) { sx = 1.1; sy = 0.88; } else if (p < 0.7) { sx = 0.93; sy = 1.1; rot = a.dir * 0.13; } else { sx = 1.03; sy = 0.97; }
      } else if (anim === 'hit') { rot = -a.dir * 0.17; sx = 0.94; sy = 1.03; }
      else if (anim === 'down') { sx = 1.22; sy = 0.5; rot = -a.dir * 0.05; dark = 0.45; }
    }
    if (a.squash) { sx *= 1 + a.squash * 0.16; sy *= 1 - a.squash * 0.2; }
    sx *= a.tx; // 돌아설 때 옆으로 납작해졌다 펴짐
    return { frame, sx, sy, rot, dark };
  }
  // 그릴 자리(정수): 몸 기준점 x·y · 그림자 줄 gy · 그림자 반너비 rw — drawActor 와 덮개 셈(markHidden)이 같은 값을 쓴다
  function placeOf(a, hop) {
    const lift = clamp(1 + (a.hy + (hop || 0)) / 60, 0.2, 1);
    return { x: Math.round(a.x + a.ox), y: Math.round(a.y + a.oy + a.hy + (hop || 0)), gy: Math.round(a.y + a.oy), rw: Math.round(a.spr.fw * 0.26 * lift) };
  }
  // 그리는 투명도(앞줄 한 명이 나올 때는 나머지를 흐리게)
  const alphaOf = a => clamp(a.alpha, 0, 1) * (a !== S.boss && !a.top ? 1 - 0.75 * S.present : 1);
  // 같은 그림·같은 장·같은 어둡기 → 한 번 칠한 판(①). 작은 판(scratch 160)과 같은 한도로 자르고, 가장자리 2칸은 비워 둔다(작은 판처럼 그림 밖은 투명)
  function tintedOf(s, frame, dark) {
    let byImg = tintCache.get(s.img); if (!byImg) tintCache.set(s.img, byImg = new Map());
    const key = `${frame}|${dark}|${s.fw}|${s.fh}`; let c = byImg.get(key);
    if (!c) {
      c = mkCanvas(Math.min(160, s.fw + 2), Math.min(160, s.fh + 2)); const cg = ctx2d(c);
      cg.drawImage(s.img, frame * s.fw, 0, s.fw, s.fh, 0, 0, s.fw, s.fh);
      if (dark) { cg.globalCompositeOperation = 'source-atop'; cg.fillStyle = `rgba(30,14,36,${dark})`; cg.fillRect(0, 0, s.fw, s.fh); }
      byImg.set(key, c);
    }
    return c;
  }
  // 반짝임·금빛·흰 번쩍임처럼 시시각각 바뀌는 색이 있을 때: 예전처럼 작은 판에 그때그때 칠한다
  function paintLive(a, s, f, dark) {
    sg.globalCompositeOperation = 'source-over';
    sg.clearRect(0, 0, 160, 160);
    sg.drawImage(s.img, f.frame * s.fw, 0, s.fw, s.fh, 0, 0, s.fw, s.fh);
    sg.globalCompositeOperation = 'source-atop';
    if (dark) { sg.fillStyle = `rgba(30,14,36,${dark})`; sg.fillRect(0, 0, s.fw, s.fh); }
    if (a.glow > 0.02) { sg.fillStyle = `rgba(${TYPE_RGB[bType] || TYPE_RGB.fire},${a.glow * (0.3 + 0.22 * Math.sin(amb.t / 110))})`; sg.fillRect(0, 0, s.fw, s.fh); }
    if (a.tint > 0.02) { sg.fillStyle = `rgba(255,220,90,${a.tint * 0.75})`; sg.fillRect(0, 0, s.fw, s.fh); }
    if (a.flash > 0.02) { sg.fillStyle = `rgba(255,255,255,${clamp(a.flash, 0, 1) * (calm() ? 0.5 : 1)})`; sg.fillRect(0, 0, s.fw, s.fh); }
    sg.globalCompositeOperation = 'source-over';
    return scratch;
  }
  function drawActor(a, hop, f = frameOf(a)) {
    if (!a.visible || a.alpha <= 0.01) return;
    const s = a.spr, dark = Math.max(f.dark, a.ko ? 0.35 : 0, a.top ? 0 : a.shade || 0);
    // 다 칠한 판은 점을 그대로 옮길 때(exactPlace)만 — 늘이거나 돌리면 GPU 가 점 경계에서 고르는 점이 판 크기에 따라 달라질 수 있어 예전처럼 작은 판(160)으로
    const pic = a.glow > 0.02 || a.tint > 0.02 || a.flash > 0.02 || !exactPlace(f, a.sink) ? paintLive(a, s, f, dark) : tintedOf(s, f.frame, dark);
    const { x, y, gy, rw } = placeOf(a, hop);
    // 발밑 그림자
    if (!a.sink) {
      g.fillStyle = 'rgba(12,4,16,.45)'; g.fillRect(x - rw, gy, rw * 2, 2); g.fillRect(x - rw + 2, gy + 2, rw * 2 - 4, 1);
    }
    g.save();
    if (a.sink) { g.beginPath(); g.rect(x - s.fw, y - s.fh - 40, s.fw * 2, s.fh + 40 + 2); g.clip(); } // 땅 아래는 안 보이게
    g.globalAlpha = alphaOf(a);
    g.translate(x, y + Math.round(a.sink));
    if (f.rot) g.rotate(f.rot);
    g.scale(s.flip ? -f.sx : f.sx, f.sy); // 왼쪽을 보는 그림은 거울처럼 뒤집음
    g.drawImage(pic, 0, 0, s.fw, s.fh, -(s.fw >> 1), -s.baseline, s.fw, s.fh);
    g.restore();
  }
  // 그림 한 장의 점(②) — 못 읽거나(그림 주소가 다른 곳 등) 작은 판보다 큰 그림이면 null(그 몬스터는 늘 그리고 덮지 않는다)
  function pixelsOf(s, frame) {
    let byImg = pixCache.get(s.img); if (!byImg) pixCache.set(s.img, byImg = new Map());
    const key = `${frame}|${s.fw}|${s.fh}`;
    if (!byImg.has(key)) {
      let px = null;
      if (s.fw <= 160 && s.fh <= 160) {
        try { const c = mkCanvas(s.fw, s.fh), cg = c.getContext('2d', { willReadFrequently: true }); cg.drawImage(s.img, frame * s.fw, 0, s.fw, s.fh, 0, 0, s.fw, s.fh); px = framePixels(cg.getImageData(0, 0, s.fw, s.fh).data, s.fw, s.fh); } catch { px = null; }
      }
      byImg.set(key, px);
    }
    return byImg.get(key);
  }
  // 이번 장면에 그릴 차례(dq)에서 가려서 건너뛸 몬스터(②) → [true|false]. sx·sy = 흔들림(정수 — 장면 전체를 그만큼 옮겨 그린다)
  function markHidden(sx, sy) {
    const items = dq.items; items.length = dq.n;
    for (let k = 0; k < dq.n; k++) {
      const a = dq.m[k]; items[k] = null;
      if (!a.visible || a.alpha <= 0.01) continue;
      const f = dq.f[k] = frameOf(a);
      if (!exactPlace(f, a.sink)) continue;
      const s = a.spr, px = pixelsOf(s, f.frame); if (!px) continue;
      const p = placeOf(a, dq.hop[k]), it = dq.pool[k] || (dq.pool[k] = { rects: [[], []] }); // 장면마다 같은 그릇을 다시 쓴다
      it.px = px; it.left = sx + spriteLeft(p.x, s.fw, s.flip); it.top = sy + p.y - s.baseline; it.flip = !!s.flip; shadowRects(sx + p.x, sy + p.gy, p.rw, it.rects); it.solid = fullAlpha(alphaOf(a));
      items[k] = it;
    }
    if (!cover || cover.length !== W * H) cover = new Uint8Array(W * H);
    return hiddenList(items, cover, W, H);
  }
  function queue(m, hop) { const k = dq.n++; dq.m[k] = m; dq.hop[k] = hop; dq.f[k] = null; }

  // 기술 효과: 진짜 도트가 있으면 6장짜리, 없으면 점으로 그림
  function drawFx(f) {
    const p = clamp((S.clock - f.t0) / f.dur, 0, 0.999), im = fxImg[f.type];
    if (im) {
      const fr = Math.floor(p * im.frames), w = Math.round(im.fw * f.scale), h = Math.round(im.fh * f.scale);
      g.drawImage(im.img, fr * im.fw, 0, im.fw, im.fh, Math.round(f.x - w / 2), Math.round(f.y - h / 2), w, h);
      return;
    }
    const ramp = rampOf(f.type), r = rng(f.seed), sc = f.scale;
    const stepP = Math.floor(p * 6) / 6; // 6장짜리처럼 뚝뚝 끊어서
    const colAt = q => ramp[clamp(Math.floor(q * ramp.length), 0, ramp.length - 1)];
    const px = (x, y, s, c) => { g.fillStyle = c; g.fillRect(Math.round(f.x + x * sc), Math.round(f.y + y * sc), s, s); };
    if (stepP < 0.34) { // 처음의 하얀 번쩍임
      const rr = Math.round((6 + stepP * 30) * sc);
      g.fillStyle = ramp[0];
      for (let y = -rr; y <= rr; y++) { const hw = Math.round(Math.sqrt(rr * rr - y * y) * (1 - stepP)); g.fillRect(Math.round(f.x) - hw, Math.round(f.y) + y, hw * 2, 1); }
    }
    if (f.type === 'fire') {
      for (let i = 0; i < 26; i++) {
        const a = r() * 6.283, d = (6 + r() * 20) * (0.3 + stepP), up = stepP * (14 + r() * 16), q = clamp(stepP + r() * 0.3, 0, 0.99);
        px(Math.cos(a) * d, Math.sin(a) * d * 0.7 - up, q < 0.4 ? 3 : q < 0.75 ? 2 : 1, colAt(q));
      }
    } else if (f.type === 'water') {
      for (let i = 0; i < 20; i++) { // 퍼지는 물방울 고리
        const a = (i / 20) * 6.283 + r() * 0.2, d = 4 + stepP * 26;
        px(Math.cos(a) * d, Math.sin(a) * d * 0.55, stepP < 0.5 ? 2 : 1, colAt(stepP * 0.9));
      }
      for (let i = 0; i < 14; i++) { // 솟는 물기둥
        const x = (r() - 0.5) * 14, hgt = r() * 30 * Math.sin(Math.min(1, stepP * 1.4) * 3.1416);
        px(x, -hgt, 2, colAt(r() * 0.8));
      }
    } else if (f.type === 'grass') {
      for (let k = 0; k < 3; k++) { // 비스듬한 베기 세 줄
        const head = stepP * 1.5 - k * 0.18;
        for (let i = 0; i < 22; i++) {
          const q = i / 22; if (q > head || q < head - 0.55) continue;
          px(-22 + q * 44 + k * 6 - 6, 20 - q * 40 + k * 7 - 7, q > head - 0.15 ? 2 : 1, colAt(clamp((head - q) * 1.8, 0, 0.99)));
        }
      }
      for (let i = 0; i < 10; i++) { const a = r() * 6.283, d = stepP * (12 + r() * 20); px(Math.cos(a) * d, Math.sin(a) * d - stepP * 6, 2, colAt(0.3 + r() * 0.6)); }
    } else if (f.type === 'earth') { // 솟구쳤다 떨어지는 돌 조각 + 먼지 고리
      for (let i = 0; i < 16; i++) {
        const a = -1.57 + (r() - 0.5) * 2.4, v = 14 + r() * 22, q = stepP, x = Math.cos(a) * v * q, y = Math.sin(a) * v * q + q * q * 30;
        px(x, y, q < 0.5 ? 3 : 2, colAt(0.35 + r() * 0.6));
      }
      for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.283, d = 5 + stepP * 24; px(Math.cos(a) * d, 12 + Math.sin(a) * d * 0.3, stepP < 0.5 ? 2 : 1, colAt(0.1 + stepP * 0.5)); }
    } else if (f.type === 'wind') { // 감기는 바람 띠 두 줄
      for (let k = 0; k < 2; k++) for (let i = 0; i < 26; i++) {
        const q = i / 26, head = stepP * 1.4; if (q > head || q < head - 0.6) continue;
        const a = q * 7 + k * 3.14 + stepP * 2, d = 6 + q * 18;
        px(Math.cos(a) * d, Math.sin(a) * d * 0.6 - q * 6, q > head - 0.15 ? 2 : 1, colAt(clamp((head - q) * 1.6, 0, 0.99)));
      }
      for (let i = 0; i < 8; i++) px((r() - 0.5) * 50, (r() - 0.5) * 36, 1, colAt(r() * 0.5));
    } else { // 번개
      const flick = Math.floor(p * 12) % 2 === 0;
      for (let k = 0; k < 3; k++) {
        if (stepP > 0.75 && k) break;
        let x = (r() - 0.5) * 30 + (flick ? 2 : -2), y = -46;
        while (y < 6) {
          const nx = x + (r() - 0.5) * 14, ny = y + 5 + r() * 5, steps = 6;
          for (let s2 = 0; s2 < steps; s2++) px(x + (nx - x) * s2 / steps, y + (ny - y) * s2 / steps, k === 0 ? 2 : 1, flick ? ramp[0] : ramp[2]);
          x = nx; y = ny;
        }
      }
      for (let i = 0; i < 10; i++) { const a = r() * 6.283, d = 6 + stepP * 26; px(Math.cos(a) * d, Math.sin(a) * d * 0.7, 1, colAt(r())); }
    }
  }

  // 광역기에서 떨어지는 것 하나
  function pxLine(x0, y0, x1, y1, col, w = 1) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    g.fillStyle = col;
    for (let i = 0; i <= n; i++) g.fillRect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), w, w);
  }
  function drawStrike(o) {
    const q = clamp((S.clock - o.t0) / o.dur, 0, 1), ramp = rampOf(bType);
    if (o.style === 'rock') { // 용암 바위: 비스듬히 떨어짐
      const qq = q * q, x = o.x0 + (o.x1 - o.x0) * qq, y = o.y0 + (o.y1 - o.y0) * qq, dx = (o.x0 - o.x1) / 10, dy = (o.y0 - o.y1) / 10;
      for (let k = 4; k >= 1; k--) { g.fillStyle = k > 2 ? 'rgba(226,80,46,.55)' : '#ff9e48'; g.fillRect(Math.round(x + dx * k * 0.5), Math.round(y + dy * k * 0.5), k > 2 ? 1 : 2, k > 2 ? 1 : 2); }
      g.fillStyle = '#2a1228'; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, o.size, o.size);
      g.fillStyle = '#ffd24a'; g.fillRect(Math.round(x), Math.round(y), o.size - 2, o.size - 2);
    } else if (o.style === 'drop') { // 물줄기: 빙글빙글 감겨 듦
      for (let k = 5; k >= 0; k--) {
        const qq = Math.max(0, q - k * 0.05), a = o.a0 + qq * 6.6, rad = (1 - qq) * o.r;
        g.fillStyle = ramp[Math.min(3, k >> 1)]; const s = k < 2 ? (o.size > 3 ? 3 : 2) : 1;
        g.fillRect(Math.round(o.x1 + Math.cos(a) * rad), Math.round(o.y1 + Math.sin(a) * rad * 0.5 - (1 - qq) * 8), s, s);
      }
    } else if (o.style === 'root') { // 뿌리: 발밑에서 솟았다가 들어감
      const grow = o.dur > 0 ? clamp((S.clock - o.t0) / 300, 0, 1) : 1, back = clamp((o.t0 + o.dur - S.clock) / 200, 0, 1);
      const hgt = Math.round(o.h * ease.out(grow) * back), wd = o.size > 3 ? 3 : 2;
      for (let y = 0; y < hgt; y++) {
        const off = Math.round(Math.sin(y * 0.45 + o.seed) * 1.6), tip = y > hgt - 4;
        g.fillStyle = '#2a1a12'; g.fillRect(Math.round(o.x1) + off - 1, Math.round(o.foot) - y, wd + 2, 1);
        g.fillStyle = tip ? '#b4f060' : y % 5 === 0 ? '#8a6a3a' : '#5a3e24'; g.fillRect(Math.round(o.x1) + off, Math.round(o.foot) - y, tip ? Math.max(1, wd - 1) : wd, 1);
        if (y % 6 === 3 && y < hgt - 3) { g.fillStyle = '#5cc24a'; g.fillRect(Math.round(o.x1) + off + (y % 12 === 3 ? wd : -2), Math.round(o.foot) - y, 2, 1); }
      }
    } else if (o.style === 'sand') { // 모래바람: 오른쪽에서 쓸고 지나감
      const x = o.x1 + 90 - q * 150;
      for (let k = 0; k < 7; k++) {
        g.fillStyle = k % 3 === 0 ? ramp[0] : k % 3 === 1 ? ramp[1] : ramp[2];
        g.fillRect(Math.round(x + k * 6 + Math.sin(o.seed + k) * 3), Math.round(o.y1 + ((k * 5 + o.seed) % 9) - 4), 5 - (k % 3), 1);
      }
    } else if (o.style === 'gust') { // 돌풍: 구름에서 내리꽂힘
      const head = o.y0 + (o.y1 - o.y0) * q;
      for (let k = 0; k < 9; k++) {
        const yy = head - k * 3; if (yy < o.y0) break;
        g.fillStyle = k < 3 ? '#ffffff' : k < 6 ? ramp[1] : ramp[2];
        g.fillRect(Math.round(o.x1 + Math.sin(yy * 0.22 + o.seed) * 3), Math.round(yy), k < 3 ? 2 : 1, 2);
        g.fillRect(Math.round(o.x1 + 4 + Math.sin(yy * 0.22 + o.seed + 2) * 3), Math.round(yy - 2), 1, 2);
      }
    } else { // 번개: 하늘에서 지그재그로
      if (Math.floor((S.clock - o.t0) / 45) % 3 === 2) return;
      const r = rng(o.seed + Math.floor((S.clock - o.t0) / 90)), top = L.portrait ? L.boss.y - 40 : -4;
      let x = o.x1 + o.dx, y = top;
      while (y < o.y1 - 1) {
        const ny = Math.min(o.y1, y + 6 + r() * 8), k = (ny - top) / Math.max(1, o.y1 - top), nx = o.x1 + o.dx * (1 - k) + (ny >= o.y1 ? 0 : (r() - 0.5) * 16);
        pxLine(x, y, nx, ny, '#f09a1c', o.size > 3 ? 3 : 2); pxLine(x, y, nx, ny, q < 0.5 ? '#ffffff' : '#fff7a0', 1);
        x = nx; y = ny;
      }
    }
  }
  // 광역기의 큰 장면: under = 몬스터 아래(땅)에 깔리는 것 · over = 몬스터 위(하늘)에 덮이는 것
  function drawSet(layer) {
    const st = S.set; if (!st) return;
    const age = S.clock - st.t0, env = clamp(age / 350, 0, 1) * clamp((st.dur - age) / 500, 0, 1); if (env <= 0.01) return;
    const ramp = rampOf(st.type), fc = L.field, quiet = calm(), r = rng(st.seed);
    if (st.type === 'water' && layer === 'under') { // 소용돌이: 발밑에서 도는 물결 고리
      for (let ring = 0; ring < 4; ring++) {
        const rad = (0.35 + ring * 0.24) * env, n = 22 + ring * 8, spin = age / (300 + ring * 60) * (quiet ? 0.3 : 1);
        for (let k = 0; k < n; k++) {
          if ((k + ring) % 4 === 0) continue;
          const a = (k / n) * 6.283 + spin;
          g.fillStyle = ramp[(k + ring) % 3 === 0 ? 0 : ring % 2 ? 1 : 2];
          g.fillRect(Math.round(fc.x + Math.cos(a) * fc.rx * rad * 1.15), Math.round(fc.y + Math.sin(a) * fc.ry * rad * 1.3), ring > 1 ? 3 : 2, 1);
        }
      }
    } else if (st.type === 'grass' && layer === 'under') { // 뿌리 지진: 보스 발밑에서 뻗어 나오는 금
      const len = Math.round(110 * clamp(age / 700, 0, 1));
      for (let k = 0; k < 6; k++) {
        let x = S.boss.x - 20, y = S.boss.y + 2 + k * 2; const dir = L.portrait ? { x: (k - 2.5) * 0.45, y: 1 } : { x: -1, y: (k - 2) * 0.22 + 0.25 };
        for (let i = 0; i < len; i++) {
          g.fillStyle = `rgba(20,12,8,${env})`; g.fillRect(Math.round(x), Math.round(y), 2, 2);
          if (i % 7 === 3) { g.fillStyle = `rgba(180,240,96,${env})`; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
          x += dir.x + (r() - 0.5) * 1.4; y += dir.y + (r() - 0.5) * 1.6 + Math.sin(i * 0.35 + k * 2) * 0.5;
          if (x < 0 || y > H - 2 || x > W) break;
        }
      }
    } else if (st.type === 'earth' && layer === 'over') { // 모래 폭풍: 화면을 쓸고 가는 모래 띠
      g.fillStyle = `rgba(214,170,110,${env * 0.2})`; g.fillRect(0, 0, W, H);
      const n = quiet ? 24 : 80;
      for (let k = 0; k < n; k++) {
        const sp = 0.35 + r() * 0.5, len = 5 + ((r() * 14) | 0), y = (r() * H) | 0, x0 = r() * (W + 60);
        const x = (((x0 - age * sp) % (W + 60)) + (W + 60)) % (W + 60) - 30;
        g.fillStyle = `rgba(${k % 3 ? '240,200,120' : '255,240,200'},${env * (0.35 + r() * 0.4)})`; g.fillRect(Math.round(x), y + Math.round(Math.sin(age / 200 + k) * 2), len, 1);
      }
    } else if (st.type === 'wind' && layer === 'over') { // 구름 행진: 구름 떼가 오른쪽에서 왼쪽으로 줄지어 지나감
      const n = 7, gap = 46, run = W + n * gap + 80, x0 = W + 40 - (age / st.dur) * run;
      for (let k = 0; k < n; k++) {
        const cx = Math.round(x0 + k * gap), cy = L.cloudY + (k % 2) * 7 + Math.round(Math.sin(age / 240 + k) * 1.5), wd = 26 + (k % 3) * 6;
        if (cx < -40 || cx > W + 40) continue;
        for (let l = 0; l < 4; l++) {
          const px0 = cx - wd / 2 + (l + 0.5) * wd / 4, rad = 5 + ((k + l) % 3) + (l === 1 || l === 2 ? 2 : 0);
          for (let y = -rad; y <= 2; y++) { const hw = Math.round(Math.sqrt(rad * rad - y * y)); g.fillStyle = y < -rad * 0.4 ? '#ffffff' : y < 0 ? '#dff4f8' : '#9cc4d4'; g.fillRect(Math.round(px0) - hw, cy + y, hw * 2, 1); }
        }
        g.fillStyle = '#6a94ac'; g.fillRect(cx - wd / 2 + 2, cy + 3, wd - 4, 1);
      }
    } else if (st.type === 'electric' && layer === 'over') { // 번개 그물: 맞은 몬스터들을 잇는 번쩍이는 줄
      if (Math.floor(age / 60) % 3 === 0 || age < 600) return;
      const pts = st.pts, rr = rng(st.seed + Math.floor(age / 120));
      const link = (a, b) => {
        let x = a.x, y = a.y; const seg = 4;
        for (let s = 1; s <= seg; s++) {
          const nx = a.x + (b.x - a.x) * s / seg + (s < seg ? (rr() - 0.5) * 8 : 0), ny = a.y + (b.y - a.y) * s / seg + (s < seg ? (rr() - 0.5) * 8 : 0);
          pxLine(x, y, nx, ny, `rgba(255,216,58,${env})`, 1); x = nx; y = ny;
        }
      };
      for (let i = 0; i + 1 < pts.length; i++) link(pts[i], pts[i + 1]);
      for (let i = 0; i + 3 < pts.length; i += 2) link(pts[i], pts[i + 3]);
      for (const p of pts) { g.fillStyle = `rgba(255,255,255,${env})`; g.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 3); }
    }
  }

  // 글자(크게 키운 화면 캔버스에 바로 그려서 또렷하게)
  const emojiCache = new Map();
  function emojiCanvas(ch) { // 이모지도 작게 그려 도트처럼
    if (emojiCache.has(ch)) return emojiCache.get(ch);
    const n = 14, c = mkCanvas(n, n), cg = c.getContext('2d');
    cg.font = `11px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
    cg.textAlign = 'center'; cg.textBaseline = 'middle'; cg.fillText(ch, n / 2, n / 2 + 1);
    try {
      const id = cg.getImageData(0, 0, n, n), d = id.data;
      for (let i = 0; i < d.length; i += 4) d[i + 3] = d[i + 3] > 110 ? 255 : 0;
      cg.putImageData(id, 0, 0);
    } catch { /* 그대로 */ }
    emojiCache.set(ch, c); return c;
  }
  function setFont(font, scale) { out.font = `${(font === 's' ? 10 : 12) * scale * K}px ${font === 's' ? FONT_S : FONT_L}`; }
  function textW(str, font, scale) { setFont(font, scale); return out.measureText(str).width / K; }
  function text(str, x, y, o = {}) {
    const font = o.font || 'l', scale = o.scale || 1, th = Math.max(1, Math.round(scale)) * K;
    setFont(font, scale);
    out.textBaseline = 'top'; out.textAlign = 'left';
    const w = out.measureText(str).width;
    let X = Math.round(x) * K, Y = Math.round(y) * K;
    if (o.align === 'center') X -= Math.round(w / 2 / K) * K; else if (o.align === 'right') X -= Math.round(w / K) * K;
    out.globalAlpha = clamp(o.alpha ?? 1, 0, 1);
    out.fillStyle = o.ink || C.ink;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) out.fillText(str, X + dx * th, Y + dy * th);
    out.fillText(str, X, Y + 2 * th); out.fillText(str, X + th, Y + 2 * th); out.fillText(str, X - th, Y + 2 * th); // 아래로 떨어지는 그림자
    out.fillStyle = o.color || C.cream; out.fillText(str, X, Y);
    out.globalAlpha = 1;
    return w / K;
  }
  // 아이콘 + 글 한 줄을 가운데에 맞춰
  function line(icon, str, x, y, o) {
    const scale = o.scale || 1, iw = icon ? 15 * scale : 0, tw = textW(str, o.font || 'l', scale), full = iw + tw;
    let left = o.align === 'center' ? x - full / 2 : x;
    if (icon) {
      const ec = emojiCanvas(icon), s = scale * K;
      out.imageSmoothingEnabled = false; out.globalAlpha = clamp(o.alpha ?? 1, 0, 1);
      out.drawImage(ec, Math.round(left) * K, Math.round(y - 1 * scale) * K, 14 * s, 14 * s);
      out.globalAlpha = 1;
    }
    text(str, left + iw, y, { ...o, align: 'left' });
    return full;
  }
  function fit(str, font, maxW) { // 긴 이름은 … 으로
    if (textW(str, font, 1) <= maxW) return str;
    let s = str; while (s.length > 1 && textW(s + '…', font, 1) > maxW) s = s.slice(0, -1);
    return s + '…';
  }

  function drawFloat(f) {
    const age = S.clock - f.t0; if (age < 0) return true;
    if (!f.stay && age > f.dur) return false;
    const str = f.textFn ? f.textFn() : f.text; // textFn = 그릴 때마다 지금 값으로(나중에 오는 땅 변화)
    if (!str) return true;
    const p = f.stay ? 0 : age / f.dur;
    let alpha = 1, dy = 0, sc = f.scale, dx = 0;
    if (f.kind === 'dmg') {
      const pop = clamp(age / 130, 0, 1); sc = f.scale * (1.5 - 0.5 * pop);
      dy = -ease.out(p) * 16 - Math.sin(clamp(age / 260, 0, 1) * 3.1416) * 5;
      alpha = p > 0.72 ? 1 - (p - 0.72) / 0.28 : 1;
    } else {
      if (f.slam && !calm()) { const q = clamp(age / 150, 0, 1); sc = f.scale * (1.7 - 0.7 * ease.out(q)); alpha = q; }
      else alpha = clamp(age / 120, 0, 1);
      if (f.wipe) dx = (1 - ease.out(clamp(age / 220, 0, 1))) * -24;
      if (!f.stay && age > f.dur - 220) alpha = Math.max(0, (f.dur - age) / 220);
    }
    // 화면 밖으로 나가지 않게: 너무 길면 줄이고, 가장자리에서는 안쪽으로
    let fn = f.font || 'l'; const iw = f.icon ? 15 : 0;
    let full = iw * sc + textW(str, fn, sc);
    if (full > W - 6 && sc > 1) { sc = Math.max(1, sc * (W - 6) / full); full = iw * sc + textW(str, fn, sc); }
    if (full > W - 6 && fn === 'l') { fn = 's'; full = iw * sc + textW(str, fn, sc); }
    let fx = f.x + dx;
    if (f.align === 'center') fx = clamp(fx, Math.min(W / 2, full / 2 + 3), Math.max(W / 2, W - full / 2 - 3));
    const lh = 12 * sc, y = Math.max(3, f.y - (sc - f.scale) * 6 + dy);
    if (f.sub2 && f.kind !== 'dmg') { // 같은 줄 오른쪽에 붙는 작은 글까지 합쳐서 가운데로
      const w2 = textW(f.sub2, 's', 1), name = fit(str, fn, W - 6 - 7 - w2), w = textW(name, fn, f.scale), left = clamp(f.x - (w + 7 + w2) / 2, 3, Math.max(3, W - 3 - (w + 7 + w2)));
      text(name, left, f.y, { font: fn, color: f.color, alpha });
      text(f.sub2, left + w + 7, f.y + (fn === 'l' ? 2 : 0), { font: 's', color: C.gold, alpha });
      return true;
    }
    if (f.sub2) { const w = textW(str, fn, sc); text(f.sub2, Math.min(fx + w / 2 + 4, W - 36), y + lh - 11, { font: 's', color: C.dim, alpha }); }
    line(f.icon, str, fx, y, { font: fn, scale: sc, color: f.color, align: f.align, alpha });
    if (f.sub) {
      const sf = f.subFont || 'l', sub = fit(f.sub, sf, W - 6), sw = textW(sub, sf, 1);
      text(sub, clamp(f.x, Math.min(W / 2, sw / 2 + 3), Math.max(W / 2, W - sw / 2 - 3)), y + lh + 5, { font: sf, color: f.subColor || C.cream, align: 'center', alpha: alpha * clamp((age - 180) / 160, 0, 1) });
    }
    return true;
  }

  function render() {
    const { boss, mons } = S;
    const cm = calm();
    // 흔들림
    let shx = 0, shy = 0;
    if (S.shake > 0.3) { shx = Math.round((Math.random() * 2 - 1) * S.shake); shy = Math.round((Math.random() * 2 - 1) * S.shake * 0.7); }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.drawImage(bg, 0, 0, W, H);
    g.translate(shx, shy);
    if (shx || shy) g.drawImage(bg, 0, 0, W, H);

    if (!bgImg && bgName === 'volcano') { // 화산 불빛(그려 낸 배경일 때만 위치를 앎)
      g.save(); g.translate(L.bgOff.x, L.bgOff.y);
      const pulse = 0.5 + 0.5 * Math.sin(amb.t / 520);
      g.fillStyle = `rgba(255,200,110,${0.5 + pulse * 0.4})`; g.fillRect(84, 38, 9, 1);
      g.fillStyle = `rgba(255,120,50,${0.10 + pulse * 0.10})`; g.fillRect(82, 34, 13, 4); g.fillRect(85, 31, 7, 3);
      for (let i = 0; i < 6; i++) { // 연기
        const tt = (amb.t / 5200 + i / 6) % 1, sxk = 87 + Math.sin(tt * 4 + i * 2) * 3 + tt * 22, syk = 34 - tt * 30, sz = 1 + Math.floor(tt * 3);
        g.fillStyle = `rgba(96,44,92,${0.6 * (1 - tt)})`; g.fillRect(Math.round(sxk), Math.round(syk), sz + 1, sz);
      }
      g.restore();
    }
    if (bgName === 'storm' && !cm) { // 뇌운: 가끔 하늘이 번쩍
      const ph = (amb.t % 5300);
      if (ph < 70 || (ph > 150 && ph < 200)) { g.fillStyle = 'rgba(220,210,255,.16)'; g.fillRect(0, 0, W, L.portrait ? L.top + L.hz : HZ); }
    }
    // 멀리 흐르는 점(불티·물방울·반딧불 …)
    for (let i = 0; i < amb.embers.length; i += 2) {
      const e = amb.embers[i];
      g.fillStyle = theme.amb.far[e.hot > 0.5 ? 0 : 1];
      g.fillRect(Math.round(e.x + Math.sin(amb.t / 700 + e.ph) * 5), Math.round(e.y), 1, 1);
    }

    // 발판
    g.drawImage(padBoss, Math.round(L.boss.x - padBoss.width / 2), Math.round(L.boss.y - padBoss.height / 2 + 1));
    if (team.length) g.drawImage(padTeam, Math.round(L.teamPad.x - padTeam.width / 2), Math.round(L.teamPad.y - padTeam.height / 2 + 2));
    drawSet('under');
    if (S.gold > 0.02) { // 버프: 발판에서 올라오는 금빛 기둥
      for (const m of mons) if (m.visible && !m.ko) {
        const hw = Math.round(m.spr.fw * 0.2), hh = m.spr.bodyH;
        for (let y = 0; y < hh; y += 2) { g.fillStyle = `rgba(255,214,90,${S.gold * 0.34 * (1 - y / hh)})`; g.fillRect(m.x - hw + ((y / 2) % 2), m.y - y, hw * 2, 1); }
      }
    }

    drawActor(boss);
    // 먼 무리 → 가까운 무리 → 앞줄 → 지금 주목받는 한 명
    const hopOf = m => (S.celebrate && !m.ko ? -Math.round(Math.abs(Math.sin(amb.t / 190 + m.x)) * (cm ? 2 : 5) * (m.crowd ? 0.6 : 1)) : 0);
    dq.n = 0;
    for (const m of S.crowdSorted) if (!m.top) queue(m, hopOf(m));
    for (const m of S.frontSorted) if (!m.top) queue(m, hopOf(m));
    for (const m of mons) if (m.top) queue(m, 0);
    // 무리가 있을 때(4명부터)만 덮개 셈(②) — 뒤에 오는 몬스터가 모두 덮는 몬스터는 건너뛴다. 3명까지는 예전처럼 모두 그린다
    const skip = S.crowdSorted.length ? markHidden(shx, shy) : null;
    drawStats.drawn = 0; drawStats.hidden = 0;
    for (let k = 0; k < dq.n; k++) {
      const m = dq.m[k]; if (!m.visible || m.alpha <= 0.01) continue;
      if (skip && skip[k]) { drawStats.hidden++; continue; }
      drawActor(m, dq.hop[k], dq.f[k] || frameOf(m)); drawStats.drawn++;
    }

    // 날아가는 공격 점
    S.shots = S.shots.filter(o => S.clock - o.t0 < o.dur);
    for (const o of S.shots) {
      const q = clamp((S.clock - o.t0) / o.dur, 0, 1);
      for (let k = 0; k < 3; k++) {
        const qq = Math.max(0, q - k * 0.07), x = o.x0 + (o.x1 - o.x0) * qq, y = o.y0 + (o.y1 - o.y0) * qq - Math.sin(qq * 3.1416) * 10;
        g.fillStyle = o.ramp[k + (k ? 1 : 0)] || o.ramp[2]; g.fillRect(Math.round(x), Math.round(y), k ? 1 : 2, k ? 1 : 2);
      }
    }

    // 광역기: 떨어지는 것 · 하늘을 덮는 것
    S.strikes = S.strikes.filter(o => S.clock - o.t0 < o.dur);
    for (const o of S.strikes) drawStrike(o);
    drawSet('over');

    // 효과 · 조각
    S.fx = S.fx.filter(f => S.clock - f.t0 < f.dur);
    for (const f of S.fx) drawFx(f);
    for (const p of S.parts) {
      const q = p.delay > 0 ? 0 : p.life / p.max;
      if (p.star && Math.floor((p.life + p.x * 9) / 90) % 2) continue;
      g.fillStyle = p.ramp[clamp(Math.floor(q * p.ramp.length), 0, p.ramp.length - 1)];
      const sz = q > 0.7 ? 1 : p.size;
      g.fillRect(Math.round(p.x), Math.round(p.y), sz, sz);
      if (p.star && q < 0.5) { g.fillRect(Math.round(p.x) - 1, Math.round(p.y), 3, 1); g.fillRect(Math.round(p.x), Math.round(p.y) - 1, 1, 3); }
    }
    // 앞쪽에 흐르는 점
    for (let i = 1; i < amb.embers.length; i += 2) {
      const e = amb.embers[i], fl = Math.sin(amb.t / 160 + e.ph * 3) > -0.4;
      if (!fl) continue;
      g.fillStyle = theme.amb.near[e.hot > 0.6 ? 0 : e.hot > 0.25 ? 1 : 2];
      const s = e.big ? 2 : 1;
      g.fillRect(Math.round(e.x + Math.sin(amb.t / 600 + e.ph) * 7), Math.round(e.y), s, s);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);

    // 화면 전체 효과
    if (S.flash > 0.01) { g.globalAlpha = clamp(S.flash, 0, 1); g.fillStyle = S.flashCol; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    if (S.dim > 0.01) { g.fillStyle = `rgba(18,6,24,${S.dim})`; g.fillRect(0, 0, W, H); }
    if (S.celebrate) { // 결과 글 뒤로 내리는 금가루
      for (let i = 0; i < 26; i++) {
        const xx = (i * 53 + Math.sin(amb.t / 800 + i) * 6) % W, yy = ((amb.t / (14 + (i % 5) * 3)) + i * 37) % (H + 10) - 5;
        g.fillStyle = i % 3 ? '#ffd24a' : '#fff3b0'; g.fillRect(Math.round(xx), Math.round(yy), 1, i % 4 ? 1 : 2);
      }
    }
    if (S.tension > 0.02) { // 마지막 라운드: 가장자리가 붉게 조여 옴
      const pulse = cm ? 0.6 : 0.55 + 0.45 * Math.sin(amb.t / 240);
      for (let k = 0; k < 4; k++) {
        g.fillStyle = `rgba(255,60,50,${S.tension * pulse * (0.26 - k * 0.06)})`;
        const d = k * 3; g.fillRect(d, d, W - d * 2, 3); g.fillRect(d, H - d - 3, W - d * 2, 3); g.fillRect(d, d + 3, 3, H - d * 2 - 6); g.fillRect(W - d - 3, d + 3, 3, H - d * 2 - 6);
      }
    }
    // 보스 체력 막대 (틀 없이 얇게)
    if (S.bar > 0.02) {
      const bx = 10, by = 24, bw = 118, bh = 4, r = clamp(S.hp / S.hpMax, 0, 1), rg = clamp(S.hpGhost / S.hpMax, 0, 1);
      g.globalAlpha = S.bar;
      g.fillStyle = 'rgba(16,6,20,.55)'; g.fillRect(bx, by + 1, bw, bh);       // 바닥 그림자
      g.fillStyle = 'rgba(40,16,44,.85)'; g.fillRect(bx, by, bw, bh);
      const fw = Math.ceil(bw * r), gw = Math.ceil(bw * rg);
      if (gw > fw) { g.fillStyle = '#fff3b0'; g.fillRect(bx + fw, by, gw - fw, bh); } // 깎인 만큼 남는 잔상
      if (fw > 0) {
        const low = r <= 0.2, mid = r <= 0.5;
        const blink = low && Math.floor(amb.t / 220) % 2;
        g.fillStyle = low ? (blink ? '#ff8a6a' : '#ff5a4a') : mid ? '#ffd24a' : '#5ef0b4'; g.fillRect(bx, by, fw, bh);
        g.fillStyle = low ? '#ffc0a8' : mid ? '#fff0a8' : '#c8ffe6'; g.fillRect(bx, by, fw, 1);
        g.fillStyle = low ? '#b02c34' : mid ? '#d8962a' : '#2aa884'; g.fillRect(bx, by + bh - 1, fw, 1);
      }
      g.globalAlpha = 1;
    }

    if (S.iris < 0.995) { // 검은 화면이 동그랗게 열림
      const rad = S.iris * Math.hypot(W, H) * 0.66;
      g.fillStyle = '#0c0510'; g.beginPath(); g.rect(0, 0, W, H);
      if (rad > 0.5) g.arc(L.portrait ? L.boss.x : L.boss.x - 60, L.boss.y - 20, rad, 0, 6.2832, true);
      g.fill('evenodd');
    }

    // ── 화면 캔버스로 정수배 확대 + 글자 ──
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.imageSmoothingEnabled = false;
    out.drawImage(scene, 0, 0, W * K, H * K);

    if (S.ui > 0.02) {
      const nw = text(boss0.name, 10, 8, { alpha: S.ui });
      text(`${boss0.stage}일째`, 10 + nw + 5, 10, { font: 's', color: C.gold, alpha: S.ui });
      if (S.bar > 0.02) text(num(Math.max(0, S.hp)), 132, 20, { font: 's', color: C.cream, alpha: S.bar });
    }
    // 참전 수(들어오는 대로 올라감) · 라운드 표시 — 체력 막대 아래에 작게
    let ix = 9;
    if (S.countA > 0.02 && S.iris > 0.9) ix += line('👥', `참전 ${S.count}명`, ix, 33, { font: 's', scale: 1, color: C.dim, alpha: S.countA * 0.95 * (1 - S.dim * 0.5) }) + 8;
    if (S.round > 0 && S.bar > 0.02) {
      const mr = TL.maxRounds, last = mr > 1 && S.round >= mr;
      text(mr ? `라운드 ${S.round}/${mr}` : `라운드 ${S.round}`, ix + (big ? 0 : 1), 33, { font: 's', color: last ? C.red : C.dim, alpha: S.bar * 0.95 });
    }
    // 모집 중: 남은 시간 · 참전 수 (지금 값으로)
    if (S.joinA > 0.02) {
      const until = Number(fight.joinUntil), leftS = Number.isFinite(until) ? Math.ceil((until - nowMs()) / 1000) : null, a = S.joinA, jx = L.joinBox.x, jy = L.joinBox.y;
      const blink = cm || Math.floor(amb.t / 500) % 2 === 0;
      const jw = joinWords(leftS); // 마감이 지나면 "결과를 기다리는 중" 만(모집 중·!참전 안내를 내림)
      const ts = joinTitleScale(15 * 2 + textW(jw.title, 'l', 2), W);
      line(jw.icon, jw.title, jx, jy + (ts === 2 ? 0 : 10), { align: 'center', scale: ts, color: C.gold, alpha: a });
      if (jw.sub) text(jw.sub, jx, jy + 30, { align: 'center', color: leftS > 10 || blink ? C.cream : C.red, alpha: a });
      line('👥', `참전 ${joinN}명`, jx, jy + 46, { align: 'center', color: C.teal, alpha: a });
      if (jw.hint) text(jw.hint, jx, jy + 62, { font: 's', align: 'center', color: C.dim, alpha: a * 0.9 });
    }
    // 몬스터 이름표: 이름 + 레벨. 앞줄과 지금 주목받는 한 명만
    for (const m of mons) {
      if (m.labelA <= 0.02 || (S.dim > 0.3 && m.ko)) continue;
      const onBody = big && !m.crowd; // 여럿일 때 앞줄 이름표는 몸 아래쪽에(뒤의 무리를 가리지 않게)
      const ly = (onBody ? H - 23 : Math.max(40, m.y - m.spr.bodyH - 23) + m.labelDy) - (1 - Math.min(1, m.labelA)) * 4, lx = clamp(m.x, 26, W - 26);
      const a = Math.min(1, m.labelA) * (m.ko ? 0.75 : 1) * (S.dim > 0.01 ? 1 - S.dim * 0.5 : 1) * (m.top ? 1 : 1 - 0.85 * S.present);
      text(fit(m.label, 's', 54), lx, ly, { font: 's', align: 'center', color: m.ko ? C.grey : C.cream, alpha: a });
      text(`Lv.${m.lv}`, lx, ly + 10, { font: 's', align: 'center', color: m.ko ? C.grey : C.gold, alpha: a });
    }
    // 생중계 표시 (구석에 작게 — 생중계로 틀 때만, 끝나면 사라짐)
    if (live && !S.done && S.iris > 0.9) {
      const str = L.portrait || !djName ? '생중계' : `생중계 · ${fit(String(djName), 's', 120)} 방송`, w = textW(str, 's', 1), a = 0.9 * (1 - S.dim * 0.4), lx = L.live.x, ly = L.live.y;
      text(str, lx, ly, { font: 's', align: 'right', color: C.dim, alpha: a });
      if (Math.floor(amb.t / 600) % 2 === 0 || cm) {
        out.fillStyle = C.ink; out.fillRect((lx - w - 9) * K, (ly + 2) * K, 6 * K, 6 * K);
        out.fillStyle = C.red; out.fillRect((lx - w - 8) * K, (ly + 3) * K, 4 * K, 4 * K);
      }
    }
    if (waiting) text('곧 싸움이 시작돼요', W / 2, H / 2 - 6, { align: 'center', color: C.cream }); // 생중계인데 아직 시작 시각 전
    S.floats = S.floats.filter(drawFloat);
  }

  // ── 한 장씩 ──
  let waiting = false, doneAt = 0, wakeAt = 0, wakeAsked = true;
  const wake = () => { wakeAsked = true; }; // 새 상태가 왔다: 잠깐 다시 모두 그림
  function step(now) {
    if (!alive) return;
    raf = requestAnimationFrame(step);
    // 끝난 결과 장면은 천천히(IDLE): 움직이는 것이 없으면 frameMs 마다 한 장. 건너뛴 시간은 다음 장에 그대로 더한다(흐르는 점·깡충 뛰기 빠르기는 같다)
    if (wakeAsked) { wakeAsked = false; wakeAt = now; }
    if (!S || !S.done) doneAt = 0; else if (!doneAt) doneAt = now;
    const busy = !S || S.tweens.length > 0 || S.parts.length > 0 || S.shake > 0.05 || S.stop > 0 || S.cueIdx < S.cues.length || S.floats.some(f => !f.stay);
    const gapMs = idleFrameMs({ done: !!doneAt, busy, sinceDone: now - doneAt, sinceWake: now - wakeAt });
    if (gapMs && lastNow && now - lastNow < gapMs) return;
    const dt = Math.min(gapMs ? gapMs * 2 : 50, now - (lastNow || now)); lastNow = now;
    amb.t += dt;
    for (const e of amb.embers) {
      e.y += theme.amb.dir * e.v * dt / 1000;
      if (e.y < -3) { e.y = H + 2; e.x = Math.random() * W; } else if (e.y > H + 3) { e.y = -2; e.x = Math.random() * W; }
    }
    if (!S) return;
    if (!paused) {
      const off = TL.joinOnly ? null : liveOffset(live);
      if (off == null || S.done) advance(dt);
      else { // 생중계: 서버 시계를 따라감(탭이 쉬다 돌아와도 지금 장면으로)
        waiting = off < 0;
        const gap = off - S.clock;
        if (waiting) { /* 시작 시각까지 검은 화면에서 기다림 */ }
        else if (gap > 1200 || gap < -400) jump(off);
        else if (gap > 0) advance(Math.min(gap, 100));
      }
    }
    render();
  }
  function advance(dt) {
    let sim = dt;
    if (S.stop > 0) { S.stop -= dt; sim = 0; } // 약점: 잠깐 멈춤
    S.clock += sim;
    while (S.cueIdx < S.cues.length && S.cues[S.cueIdx].t <= S.clock) S.cues[S.cueIdx++].fn();
    for (let i = S.tweens.length - 1; i >= 0; i--) {
      const w = S.tweens[i], p = clamp((S.clock - w.t0) / w.dur, 0, 1), e = w.e(p);
      for (const k in w.props) w.obj[k] = w.from[k] + (w.props[k] - w.from[k]) * e;
      if (p >= 1) S.tweens.splice(i, 1);
    }
    if (!muted) audio.music(S.track, S.trackFade);
    S.shake *= Math.exp(-dt / 95);
    if (S.charge > 0.3 && sim && !calm()) { // 힘을 모으는 동안: 속성 빛이 보스에게 빨려 들어감
      S.chAcc += sim;
      const ramp = rampOf(bType).slice().reverse();
      while (S.chAcc > 45) {
        S.chAcc -= 45;
        const b = S.boss, cx = b.x, cy = b.y - b.spr.bodyH * 0.5, an = Math.random() * 6.283, r = 46 + Math.random() * 34;
        addPart({ x: cx + Math.cos(an) * r, y: cy + Math.sin(an) * r * 0.8, vx: -Math.cos(an) * r * 2, vy: -Math.sin(an) * r * 1.6, g: 0, life: 0, max: 480,
          ramp, size: Math.random() < 0.3 ? 2 : 1, delay: 0 });
        if (Math.random() < 0.4) addPart({ x: cx + (Math.random() - 0.5) * 44, y: b.y - b.spr.bodyH + 10, vx: (Math.random() - 0.5) * 10, vy: -26 - Math.random() * 20, g: -10, life: 0,
          max: 700 + Math.random() * 400, ramp: ['#8a6a7a', '#6a4a60', '#4a3048', '#2a1c2c'], size: 2, delay: 0 });
      }
    }
    if (sim) {
      for (let i = S.parts.length - 1; i >= 0; i--) {
        const p = S.parts[i];
        if (p.delay > 0) { p.delay -= sim; continue; }
        p.life += sim; if (p.life >= p.max) { S.parts.splice(i, 1); continue; }
        p.vy += p.g * sim / 1000; p.x += p.vx * sim / 1000; p.y += p.vy * sim / 1000;
      }
    }
  }

  container.appendChild(canvas);
  layout();
  const ro = 'ResizeObserver' in window ? new ResizeObserver(layout) : null;
  if (ro) ro.observe(container);
  window.addEventListener('resize', layout);
  // 장면이 쉬면 소리도 쉰다: 멈춤 · stop · 탭이 숨었을 때(그리기가 쉬어 곡을 내리는 때가 오지 않음). 돌아오면 이어서 — 생중계는 지금 장면의 곡으로 건너뜀
  const syncHold = () => audio.hold(paused || !alive || document.hidden);
  document.addEventListener('visibilitychange', syncHold);
  const unwatch = () => { if (ro) ro.disconnect(); window.removeEventListener('resize', layout); document.removeEventListener('visibilitychange', syncHold); };
  syncHold();
  reset();
  { // 생중계: 지금−시작만큼 건너뛰어 그 장면부터. 이미 끝난 판이면 결과 장면만
    const off = TL.joinOnly ? null : liveOffset(live);
    if (off != null) { if (off >= total) jump(total + 16); else if (off > 0) jump(off); else waiting = off < 0; }
  }
  raf = requestAnimationFrame(step);

  // ── 밖에서 쓰는 손잡이 (다시 보기는 없음) ──
  return {
    stop() { alive = false; cancelAnimationFrame(raf); audio.halt(); syncHold(); unwatch(); }, // 장면을 세움: 곡을 내리고 소리·지켜보기를 모두 뗌
    seek(ms) { wake(); jump(ms); render(); }, // 그 시각으로 건너뛰기
    pause(v = true) { wake(); paused = !!v; lastNow = 0; syncHold(); }, // 멈추면 음악도 멈추고, 풀면(소리가 켜져 있을 때) 이어서
    layout() { wake(); layout(); render(); },            // 크기 다시 잡기(칸을 숨긴 채 띄웠다가 보일 때 — 숨은 칸은 너비가 0)
    setLand(v) { wake(); land = v ?? null; },            // 땅 변화가 나중에 오면(결과 장면에 그 자리에 뜸)
    updateJoin(n) { joinN = Math.max(0, Math.trunc(Number(n) || 0)); return joinN; }, // 모집 중 참전 수
    setSound(v) { audio.set(v); return audio.on; },
    toggleSound() { audio.set(!audio.on); return audio.on; },
    setMusicVolume(v) { return audio.setMusicVolume(v); },
    get soundOn() { return audio.on; },
    get audioState() { return audio.state; }, // 확인용: 지금 곡 · 크기
    get portrait() { return L.portrait; },
    get marks() { return TL.marks.slice(); }, // [{t, name}] 여는 장면·참가·돌아서기·라운드·예고·광역기·끝
    get duration() { return total; },      // 한 판 길이(ms, 멈춤 시간 빼고). 모집 중이면 기다리기 시작하는 시각
    get time() { return S ? S.clock : 0; },
    get scene() { return waiting ? 'waiting' : sceneAt(TL, S ? S.clock : 0); }, // 지금 장면 이름
    get done() { return !!(S && S.done); },
    get joinOnly() { return TL.joinOnly; },
    get result() { return TL.result; },
    get usingReal() { return usingReal; }, // 어떤 그림이 진짜 도트로 들어왔는지
    get drawStats() { return { ...drawStats }; }, // 확인용: 지난 장면에 그린 몬스터 수 · 가려서 건너뛴 수(2026-11-21 검수 S5)
    canvas,
    destroy() {
      alive = false; cancelAnimationFrame(raf); if (ownAudio) audio.close(); unwatch();
      canvas.remove();
    },
  };
}
