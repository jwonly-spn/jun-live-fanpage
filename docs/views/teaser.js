// 키우기 시즌 2 「몬스터 영토전」 예고 사이트(2026-11-15 새로 그림 — 어두운 게임 티저).
//  차례: (예전 주소로 왔으면 안내) → 첫 화면(제목·카운트다운·할 일 한 줄·전쟁 지도) → 시즌 1 기록(맨 앞에 냥 안내) → 시즌 2 미리 보기(영지전·보스전·산책·속성·도감) → 1등 보상 → 바닥.
//  2026-11-16 화면 점검 고침: 냥 삭제 안내를 시즌 1 기록 칸 맨 앞으로 · 영어 꾸밈 글을 한글로(남은 시간 일·시간·분·초) · 지도 소식·예시 표시는 지도 그림 밖으로.
//  2026-11-19 정보 조금 풀기: 보스전 칸에 키우기.com 생중계 예시 장면(진짜 장면 모듈 — lib/teaser-boss.js) · 도감은 속성마다 1단계 한 마리와 보스 그림자를 먼저 공개.
//  글은 모두 textContent(h·svg 도우미)로만 넣는다. 예시 이름은 모두 지어낸 것.
import { h } from '../lib/dom.js';
import { countdown, readStats } from '../lib/teaser-time.js';
import { startMap } from '../lib/teaser-map.js';
import { startBossDemo } from '../lib/teaser-boss.js';
import { listMine } from '../lib/me.js';
import { UNOFFICIAL } from './common.js';

// 예고 화면 바닥 글(시즌 2 화면의 바닥 글은 views/common.js DISCLAIMER — 지도·몬스터 이야기라 예고에는 예전 글을 그대로 쓴다)
export const DISCLAIMER = '키우기.com은 먼치킨과 함께하는 비공식 팬 사이트예요. 스푼(Spoon)이 만든 서비스가 아니고, 스푼과 제휴 관계도 아니에요.';

const asset = (file) => new URL('../teaser/' + file, import.meta.url).href;
const s2art = (file) => new URL('../kiugi/s2/' + file, import.meta.url).href; // 시즌 2 사이트와 같은 자리·같은 파일
const SVGNS = 'http://www.w3.org/2000/svg';
function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) el.setAttribute(k, String(v));
  for (const c of children.flat()) if (c) el.append(c);
  return el;
}
const tx = (t, attrs) => { const el = s('text', attrs); el.textContent = t; return el; };

// [영문, 이름, 그림 길]
export const ELEMENTS = [
  ['fire', '불', ['M12 2.2c1.1 4 5.3 5.6 5.3 10.4a5.3 5.3 0 0 1-10.6 0c0-2.6 1.4-3.9 2.1-5.6.9 1.7 1.7 2.2 2.5 2.4C11 6.9 12.1 4.6 12 2.2Z']],
  ['water', '물', ['M12 2.6c3.6 4.6 6.2 8 6.2 11.2a6.2 6.2 0 0 1-12.4 0c0-3.2 2.6-6.6 6.2-11.2Z']],
  ['grass', '풀', ['M5 19.5C4.6 10.6 10 5 20.2 4c.3 10.3-5.3 15.6-15.2 15.5Z', 'M5 19.5 14.5 10']],
  ['earth', '땅', ['M1.8 20.2 9 7.6l4.2 6.4 3-4.2 6 10.4Z']],
  ['wind', '바람', ['M3 8.2h11.2a3 3 0 1 0-3-3', 'M3 12.2h15.4a3.1 3.1 0 1 1-3.1 3.1', 'M3 16.2h6.6']],
  ['electric', '전기', ['M13.4 1.8 4.2 13.8h7.2l-1.2 8.4 9.6-12.4h-7.4Z']],
];
const elementIcon = ([type, , paths], size = 24) => s('svg', { class: `tz-el-icon tz-${type}`, viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true' },
  paths.map((d) => s('path', { d })));
// 상성 고리: 물 › 불 › 풀 › 땅 › 전기 › 바람 › 물 (화살표 방향으로 강해요)
const RING = [ELEMENTS[1], ELEMENTS[0], ELEMENTS[2], ELEMENTS[3], ELEMENTS[5], ELEMENTS[4], ELEMENTS[1]];

// 채팅 흉내(스푼 방송 채팅처럼). who 가 없으면 먼치킨(봇) 글 — 줄마다 한 가지(보고서 모양)
function chat(title, lines) {
  return h('div', { class: 'tz-chat', 'aria-label': title },
    h('div', { class: 'tz-chat-top', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('span', {}, title)),
    h('ol', { class: 'tz-chat-list' }, lines.map(([who, text], i) => h('li', { class: `tz-msg ${who ? 'is-user' : 'is-bot'}`, dataset: { n: String(i) } },
      h('b', {}, who || '먼치킨', who ? null : h('em', {}, '봇')),
      h('p', {}, text)))));
}

// 남은 시간 단위는 한글로(예전 D·H·M·S)
export const TIME_UNITS = ['일', '시간', '분', '초'];

function hero() {
  const parts = TIME_UNITS.map((unit, i) => h('div', { class: 'tz-time' },
    h('strong', { 'data-time': i }, '00'), h('span', { 'aria-hidden': 'true' }, unit)));
  return h('section', { class: 'tz-hero', 'aria-labelledby': 'teaser-title' },
    h('div', { class: 'tz-sky', 'aria-hidden': 'true' }, h('i', { class: 'tz-glow-a' }), h('i', { class: 'tz-glow-b' }), h('i', { class: 'tz-glow-c' })),
    h('div', { class: 'tz-embers', 'aria-hidden': 'true' }, Array.from({ length: 10 }, () => h('i'))),
    h('div', { class: 'tz-hero-in' },
      h('div', { class: 'tz-hero-copy' },
        h('h1', { id: 'teaser-title' }, h('span', { class: 'tz-h1-pre' }, '키우기 시즌 2'), h('span', { class: 'tz-h1-main' }, '몬스터', h('br'), '영토전')),
        h('p', { class: 'tz-coming', lang: 'en' }, 'COMING SOON'),
        h('p', { class: 'tz-tagline' }, '몬스터를 만나고, 보스를 쓰러뜨리고,', h('br'), '우리 DJ의 이름으로 대륙을 칠하세요.'),
        h('div', { class: 'tz-countdown', role: 'timer', 'aria-label': '시즌 2 시작까지 남은 시간' }, parts),
        h('p', { class: 'tz-open' }, h('time', { datetime: '2026-12-01T00:00:00+09:00' }, '2026. 12. 01 00:00'), h('span', {}, '한국 시각 오픈')),
        h('p', { class: 'tz-started', role: 'status', hidden: true }, '시즌 2가 시작됐어요'),
        // 청취자가 할 일 한 줄(예고 글에 이미 있는 명령만)
        h('p', { class: 'tz-how' }, '12월 1일부터 먼치킨을 쓰는 DJ 방송 채팅에 ', h('code', {}, '!산책'), '을 치면 시작해요.'),
        h('div', { class: 'tz-cta' },
          h('a', { class: 'tz-btn tz-btn-gold', href: '#preview' }, '시즌 2 미리 보기'),
          h('a', { class: 'tz-btn tz-btn-ghost', href: '#season-one' }, '시즌 1 기록'))),
      // 지도: 「예시 화면」 표시와 소식 줄은 지도 그림 밖(위·아래)에 — DJ 땅과 이름표를 가리지 않게
      h('figure', { class: 'tz-war' },
        h('div', { class: 'tz-war-hud', 'aria-hidden': 'true' },
          h('span', { class: 'tz-live' }, '예시 화면'), h('strong', { class: 'tz-war-day' }, '12월 1일')),
        h('div', { class: 'tz-war-frame' },
          h('div', { class: 'tz-war-stage' }),
          h('i', { class: 'tz-war-vignette', 'aria-hidden': 'true' })),
        h('ol', { class: 'tz-war-news', 'aria-hidden': 'true' }),
        h('figcaption', {}, h('span', {}, '지어낸 DJ 6명이 한 달 동안 땅을 넓히는 예시 화면이에요.'),
          h('button', { class: 'tz-war-toggle', type: 'button', 'aria-pressed': 'false' }, '움직임 멈추기')))),
    h('a', { class: 'tz-scroll', href: '#season-one', 'aria-label': '아래로' }, h('span', {}, '아래로'), h('i', { 'aria-hidden': 'true' })));
}

// 칸 머리: 번호 + 한글 이름(예전 영어 머리글) · 제목 · 한 줄 설명
const head = (no, label, title, sub) => h('header', { class: 'tz-head' },
  h('p', { class: 'tz-chapter' }, h('b', {}, no), h('span', {}, label)),
  h('h2', {}, title), sub ? h('p', { class: 'tz-head-sub' }, sub) : null);

// 청취자에게 직접 손해가 되는 안내(냥 삭제)는 시즌 1 기록 칸 맨 앞에(예전엔 페이지 맨 아래)
function resetNote() {
  return h('aside', { class: 'tz-reset', 'aria-label': '시즌 전환 안내' },
    h('b', { 'aria-hidden': 'true' }, '!'),
    h('div', {}, h('strong', {}, '꼭 알아 두세요'), h('p', {}, '시즌 1에 모아 둔 냥은 시즌 2가 시작되면 전부 삭제돼요. 아이디는 그대로 이어져요.')));
}

function records() {
  return h('section', { id: 'season-one', class: 'tz-sec tz-archive', 'aria-labelledby': 'records-title' },
    head('01', '시즌 1 기록', h('span', { id: 'records-title' }, '시즌 1, 이만큼 함께했어요'), '옷 입히기로 시작한 첫 번째 시즌이 11월 15일에 막을 내렸어요. 함께해 줘서 고마워요.'),
    resetNote(),
    h('div', { class: 'tz-stats', 'aria-busy': 'true' }, h('p', { class: 'tz-stats-loading' }, '시즌 1의 기록을 불러오고 있어요.')),
    h('p', { class: 'tz-stamp', 'aria-hidden': 'true' }, '시즌 1 완료'));
}

// 예전 주소(시즌 1 캐릭터·DJ 페이지 k/…, 옷 도감 items)로 왔는지 — 사이트 맨 앞(base)을 뗀 첫 칸으로 본다. DOM 없이 동작.
export function isOldAddress(pathname, base = '/') {
  let p = String(pathname || '/');
  const b = String(base || '/');
  if (b !== '/' && p.startsWith(b)) p = p.slice(b.length - 1);
  const first = p.replace(/^\/+/, '').split('/')[0];
  return first === 'k' || first === 'items';
}
// 예전 주소 안내: 왜 예고 화면이 나왔는지 + 이 브라우저에 저장해 둔 내 아이디(localStorage 만 — 서버에 묻지 않는다)
export const OLD_NOTE_TITLE = '시즌 2를 준비하고 있어요';
export const OLD_NOTE_TEXT = '시즌 1의 캐릭터 페이지와 옷 도감은 11월 15일에 닫혔어요. 아이디는 시즌 2로 그대로 이어지고, 12월 1일부터 여기서 아이디로 내 몬스터를 찾아볼 수 있어요.';
const OLD_NOTE_IDS = 3;
export function oldNote(pathname = location.pathname, storage = (() => { try { return window.localStorage; } catch { return null; } })()) {
  if (!isOldAddress(pathname, new URL('../', import.meta.url).pathname)) return null;
  let ids = [];
  try { ids = listMine(storage).map((e) => e.id); } catch { ids = []; }
  return h('aside', { class: 'tz-oldnote', 'aria-labelledby': 'oldnote-title' },
    h('div', { class: 'tz-oldnote-in' },
      h('strong', { id: 'oldnote-title' }, OLD_NOTE_TITLE),
      h('p', {}, OLD_NOTE_TEXT),
      ids.length ? h('p', { class: 'tz-oldnote-me' },
        h('span', {}, '이 브라우저에 저장한 내 아이디'),
        ...ids.slice(0, OLD_NOTE_IDS).map((id) => h('b', {}, id)),
        ids.length > OLD_NOTE_IDS ? h('span', {}, `외 ${ids.length - OLD_NOTE_IDS}개`) : null,
        h('span', {}, '그대로 이어져요')) : null));
}

// 보스전 생중계 예시(2026-11-19): 12월 1일부터 키우기.com 에서 볼 도트 장면을 미리 보여 준다. 장면은 lib/teaser-boss.js 가 화면 가까이 올 때 띄우고,
//  그 전·움직임 줄이기·못 받았을 때는 정지 그림(가로 boss-demo.png · 휴대폰 폭은 세로 boss-demo-m.png)이 보인다. 소리 없음.
export const BOSS_DEMO_ALT = '보스전 생중계 예시 장면: 지어낸 청취자 세 명의 몬스터가 불 속성 보스와 싸워서 이겨요.';
function bossArt() {
  return h('figure', { class: 'tz-bv' },
    h('div', { class: 'tz-war-hud', 'aria-hidden': 'true' }, h('span', { class: 'tz-live' }, '예시 화면'), h('strong', { class: 'tz-bv-title' }, '키우기.com 보스전 생중계')),
    h('div', { class: 'tz-bv-frame', role: 'img', 'aria-label': BOSS_DEMO_ALT },
      h('picture', { class: 'tz-bv-poster' },
        h('source', { media: '(max-width: 639px)', srcset: asset('boss-demo-m.png'), width: '360', height: '640' }),
        h('img', { src: asset('boss-demo.png'), alt: '', width: '640', height: '360', loading: 'lazy', decoding: 'async' })),
      h('div', { class: 'tz-bv-stage' })),
    h('figcaption', {}, h('span', {}, '12월 1일부터 키우기.com에서 이렇게 실시간으로 볼 수 있어요. 지어낸 이름으로 만든 예시예요.'),
      h('button', { class: 'tz-war-toggle tz-bv-toggle', type: 'button', 'aria-pressed': 'false' }, '움직임 멈추기')));
}

function ringArt() {
  const C = 200, R = 140, r = 38, nodes = RING.slice(0, 6);
  const at = (i) => { const a = (-90 + i * 60) * Math.PI / 180; return [C + R * Math.cos(a), C + R * Math.sin(a)]; };
  const arcs = nodes.map((_, i) => {
    const a0 = (-90 + i * 60 + 17) * Math.PI / 180, a1 = (-90 + (i + 1) * 60 - 17) * Math.PI / 180;
    return s('path', { class: 'tz-ring-arc', d: `M${C + R * Math.cos(a0)} ${C + R * Math.sin(a0)}A${R} ${R} 0 0 1 ${C + R * Math.cos(a1)} ${C + R * Math.sin(a1)}`, 'marker-end': 'url(#tzArrow)' });
  });
  return s('svg', { class: 'tz-ring', viewBox: '0 0 400 400', role: 'img', 'aria-label': '상성 고리: 물은 불에, 불은 풀에, 풀은 땅에, 땅은 전기에, 전기는 바람에, 바람은 물에 강해요.' },
    s('defs', {}, s('marker', { id: 'tzArrow', viewBox: '0 0 10 10', refX: '7', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' }, s('path', { d: 'M0 0L10 5L0 10Z', class: 'tz-ring-head' }))),
    s('circle', { cx: C, cy: C, r: R, class: 'tz-ring-track' }),
    arcs,
    nodes.map(([type, name, paths], i) => { const [x, y] = at(i); return s('g', { class: `tz-ring-node tz-${type}`, transform: `translate(${x} ${y})` },
      s('circle', { r, class: 'tz-ring-dot' }),
      s('g', { transform: 'translate(-14 -22) scale(1.17)' }, paths.map((d) => s('path', { d, class: 'tz-ring-icon' }))),
      tx(name, { y: 24, class: 'tz-ring-name', 'text-anchor': 'middle' })); }),
    tx('×1.5', { x: C, y: C - 6, class: 'tz-ring-mid', 'text-anchor': 'middle' }),
    tx('상성 피해', { x: C, y: C + 22, class: 'tz-ring-mid-sub', 'text-anchor': 'middle' }));
}

function previews() {
  return h('section', { id: 'preview', class: 'tz-sec tz-shift', 'aria-labelledby': 'preview-title' },
    head('02', '시즌 2에서 달라지는 것', h('span', { id: 'preview-title', class: 'tz-manifesto' }, h('span', {}, '옷 입히기에서, 이제 몬스터와 함께'), h('strong', {}, '시즌 2는 완전히 새로워요.'))),
    h('article', { class: 'tz-feature tz-f-war' },
      h('div', { class: 'tz-f-copy' },
        h('p', { class: 'tz-f-no' }, '영지전'),
        h('h3', {}, '청취자들의 도파민을 책임질 영지전.'),
        h('p', {}, 'DJ와 DJ가 냥을 걸고 정면으로 붙어요. 이긴 쪽은 진 DJ 땅을 떼어 가요. 빼앗긴 땅은 지도에 「지배 중」으로 남아요. 되찾을 때까지요.'),
        h('ul', { class: 'tz-points' },
          h('li', {}, h('b', {}, '가위바위보 · 하나빼기'), '판마다 무작위 게임, 가끔은 몬스터 대전'),
          h('li', {}, h('b', {}, '판돈이 클수록'), '더 많은 땅이 걸려요'),
          h('li', {}, h('b', {}, '식민지'), '다시 이기면 독립! 땅을 되찾아요'))),
      h('div', { class: 'tz-f-art' },
        h('div', { class: 'tz-vs', 'aria-hidden': 'true' },
          h('span', { class: 'tz-banner tz-banner-a' }, h('b', {}, '별사탕'), h('small', {}, '12.4%')),
          h('strong', { lang: 'en' }, 'VS'),
          h('span', { class: 'tz-banner tz-banner-b' }, h('b', {}, '구름빵'), h('small', {}, '9.8%'))),
        chat('영지전 · 하나빼기 (예시)', [
          [null, '⚔️ 영지전 · 별사탕 vs 구름빵\n🎮 이번 게임: 하나빼기\n✋ 두 손을 내세요 → !가위 바위'],
          ['밤톨', '!가위 바위'],
          [null, '🖐 두 손 공개\n별사탕: ✌️ 가위 · ✊ 바위\n구름빵: 🖐 보 · ✊ 바위\n✂️ 하나 빼세요 → !빼기 바위'],
          ['밤톨', '!빼기 바위'],
          [null, '🏆 별사탕 승리!\n✌️ 가위 > 🖐 보\n🚩 구름빵 땅 4.2% → 식민지'],
        ]))),
    h('article', { class: 'tz-feature tz-f-boss' },
      h('div', { class: 'tz-f-copy' },
        h('p', { class: 'tz-f-no' }, '보스전'),
        h('h3', {}, '최애 DJ에게 영광을 가져다줄 보스전.'),
        h('p', {}, '방송을 켜고 30분 뒤부터 30분마다 보스가 나타나요. 청취자들의 몬스터가 한꺼번에 덤비고, 전투는 채팅과 키우기.com에서 생중계돼요. 쓰러뜨리면 DJ 땅이 넓어지고, 지면 줄어들어요. 사람이 적으면 버프를 받아요.'),
        h('ul', { class: 'tz-points' },
          h('li', {}, h('b', {}, '30분마다 한 번'), '2시간 방송이면 3번, 날마다 세져요'),
          h('li', {}, h('b', {}, '약점 속성'), '보스의 약점을 찌르면 피해가 1.5배'),
          h('li', {}, h('b', {}, '두 곳에서 생중계'), '채팅에는 글로, 키우기.com에는 도트 화면으로'))),
      h('div', { class: 'tz-f-art' }, bossArt(),
        chat('보스 토벌 생중계 (예시)', [
          [null, '👹 보스 등장!\n🔥 불 속성 · 약점 💧물\n👉 !참전 → 대표 몬스터로 싸워요'],
          ['사탕요정', '!참전'],
          [null, '💧 사탕요정님 몬스터의 물대포!\n💥 약점을 찔렀어요 −1,240'],
          [null, '😵 보스의 강력한 일격!\n구름이님 몬스터가 한방에 나가떨어졌어요'],
          [null, '🏆 보스 토벌 성공!\n🗺 별사탕 땅 +0.6%\n✨ 참전 몬스터 경험치 +120'],
        ]))),
    h('article', { class: 'tz-feature tz-f-walk' },
      h('div', { class: 'tz-f-copy' },
        h('p', { class: 'tz-f-no' }, '몬스터'),
        h('h3', {}, '산책길에서 만난 몬스터, 끝까지 키워요.'),
        h('p', {}, '방송 채팅에 ', h('code', {}, '!산책'), '을 치면 길에서 야생 몬스터를 만나요. 데려간 몬스터는 경험치를 모아 세 번 모습이 바뀌어요. 냥으로도 경험치를 살 수 있어요.'),
        h('ol', { class: 'tz-evo', 'aria-label': '1단계에서 3단계까지 진화' }, [1, 2, 3].map((n) => h('li', {}, h('span', { class: `tz-egg tz-egg-${n}`, 'aria-hidden': 'true' }, '?'), h('b', {}, `${n}단계`))))),
      h('div', { class: 'tz-f-art' },
        chat('!산책 (예시)', [
          ['밤톨', '!산책'],
          [null, '🌿 밤톨님의 산책\n수풀이 바스락거려요…\n❓ 야생 몬스터를 만났어요!\n💧 물 속성 · 1단계\n👉 !산책 1 데려가기 · !산책 2 지나가기'],
          ['밤톨', '!산책 1'],
          [null, '🎉 새 친구가 생겼어요!\n⭐ 대표 몬스터로 정했어요\n⚔️ 이제 보스전·영지전에 나갈 수 있어요'],
        ]))),
    h('div', { class: 'tz-types' },
      h('div', { class: 'tz-types-copy' },
        h('p', { class: 'tz-f-no' }, '속성'),
        h('h3', {}, '여섯 속성, 서로 물고 물리는 힘.'),
        // 고리와 같은 차례(앞이 뒤에 강해요) — › 는 읽지 않고, 읽는 프로그램에는 「강한 차례」로
        h('p', { class: 'tz-element-list' }, h('span', { class: 'sr-only' }, '강한 차례: '),
          RING.map(([, name], i) => [i ? h('span', { class: 'tz-el-arrow', 'aria-hidden': 'true' }, '›') : null, h('span', {}, name)])),
        h('p', {}, '화살표 방향으로 강해요. 상대 약점을 찌르면 1.5배, 거꾸로면 약해져요. 보스도, 영지전 몬스터 대전도 속성을 알면 이겨요.')),
      ringArt()),
    dex());
}

// 도감 미리 공개(2026-11-19): 속성마다 1단계 한 마리(이름·모습)만 — 2·3단계와 나머지 종은 12월 1일. 보스 6은 그림자와 속성만(이름은 12월 1일).
//  [속성, 종, 1단계 이름] — 이름·수는 봇 season-s2.json(몬스터 18종 × 3단계 · 보스 6)과 같다
export const DEX_FIRST = [['fire', 'fire_01', '홍룡이'], ['water', 'water_01', '물꼬달'], ['grass', 'grass_01', '새싹곰'], ['earth', 'earth_01', '돌몽이'], ['wind', 'wind_01', '삐리링'], ['electric', 'electric_01', '찌릿냥']];
export const DEX_COUNT = { species: 18, stages: 3, bosses: 6 };
function dex() {
  const el = (type) => ELEMENTS.find((e) => e[0] === type);
  return h('div', { class: 'tz-dex' },
    h('div', { class: 'tz-dex-head' }, h('p', { class: 'tz-f-no' }, '도감'),
      h('h3', {}, `${DEX_COUNT.species}종 몬스터 × ${DEX_COUNT.stages}단계, 그리고 보스 ${DEX_COUNT.bosses}.`),
      h('p', {}, '속성마다 한 마리씩 먼저 공개해요. 진화한 모습과 나머지 몬스터는 12월 1일에 만나요.')),
    h('ul', { class: 'tz-dex-grid' }, DEX_FIRST.map(([type, sp, name]) => h('li', { class: `tz-card tz-${type}` },
      h('span', { class: 'tz-card-tag' }, elementIcon(el(type), 16), `${el(type)[1]} 속성`),
      h('div', { class: 'tz-card-art' }, h('img', { src: s2art(`monster_${sp}_1.webp`), alt: '', width: '256', height: '256', loading: 'lazy', decoding: 'async' })),
      h('p', { class: 'tz-card-name' }, h('strong', {}, name), h('span', {}, '1단계')),
      h('ol', { class: 'tz-card-next', 'aria-label': '2단계와 3단계 모습은 12월 1일 공개' },
        [2, 3].map((n) => h('li', {}, h('i', { 'aria-hidden': 'true' }, '?'), `${n}단계`)))))),
    h('div', { class: 'tz-bossdex' },
      h('div', { class: 'tz-bossdex-head' }, h('h4', {}, `보스 ${DEX_COUNT.bosses}`), h('p', {}, '그림자와 속성만 먼저 공개해요. 이름은 12월 1일에 밝혀져요.')),
      h('ul', { class: 'tz-boss-grid' }, ELEMENTS.map((e) => h('li', { class: `tz-bcard tz-${e[0]}` },
        h('div', { class: 'tz-bcard-art', 'aria-hidden': 'true' }, h('img', { src: asset(`boss-shadow-${e[0]}.png`), alt: '', width: '240', height: '240', loading: 'lazy', decoding: 'async' })),
        h('p', {}, h('span', { class: 'tz-card-tag' }, elementIcon(e, 16), `${e[1]} 속성`), h('strong', {}, h('span', { class: 'sr-only' }, '이름 비공개'), h('span', { 'aria-hidden': 'true' }, '???'))))))));
}

function prize() {
  return h('section', { class: 'tz-prize', 'aria-labelledby': 'prize-title' },
    h('div', { class: 'tz-prize-in' },
      h('div', { class: 'tz-crown', 'aria-hidden': 'true' },
        s('svg', { viewBox: '0 0 64 64', width: 96, height: 96 }, s('path', { d: 'M8 46 4 18l16 12 12-20 12 20 16-12-4 28Z', class: 'tz-crown-body' }), s('path', { d: 'M8 52h48', class: 'tz-crown-base' })),
        h('b', {}, '1')),
      h('p', { class: 'tz-chapter' }, h('b', {}, '03'), h('span', {}, '시즌 보상')),
      h('h2', { id: 'prize-title' }, h('span', { class: 'tz-prize-label' }, '1등 DJ 보상'), h('span', { class: 'tz-prize-main' }, '먼치킨 1달 이용권 + ', h('strong', {}, '486', h('small', {}, '스푼')))),
      h('p', {}, '12월 31일 23:59, 대륙에서 가장 넓은 땅을 가진 DJ에게 드려요.'),
      h('ol', { class: 'tz-schedule' },
        h('li', {}, h('b', {}, '12.01 00:00'), h('span', {}, '시즌 2 시작 · 모두 기지 1%에서')),
        h('li', {}, h('b', {}, '12월 한 달'), h('span', {}, '보스전 · 영지전으로 땅 넓히기')),
        h('li', {}, h('b', {}, '12.31 23:59'), h('span', {}, '시즌 끝 · 땅 1등 DJ 보상')))));
}

// now: 지금 시각(app.js 가 서버 시각에 맞춘 시계를 넘긴다 — 방문자 시계가 틀려도 카운트다운이 맞게) · onStart: 카운트다운이 끝났을 때 한 번(app.js 가 시즌 2 화면으로 넘긴다)
export function renderTeaser(root, { now = () => Date.now(), onStart = null } = {}) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  root.replaceChildren(
    h('p', { class: 'tz-unofficial' }, UNOFFICIAL),
    h('header', { class: 'tz-top' },
      h('a', { class: 'tz-brand', href: '#main', 'aria-label': '키우기.com 처음으로' }, h('i', { 'aria-hidden': 'true' }), '키우기', h('small', {}, '.com')),
      h('span', { class: 'tz-edition' }, h('b', {}, '시즌 2'), '몬스터 영토전')),
    h('main', { id: 'main', tabindex: '-1' }, oldNote(), hero(), records(), previews(), prize()),
    h('footer', { class: 'tz-footer' }, h('strong', {}, '키우기.com'), h('p', {}, UNOFFICIAL), h('p', {}, DISCLAIMER), h('small', {}, '먼치킨과 함께하는, 우리의 다음 모험.')));

  const timeParts = root.querySelectorAll('[data-time]');
  const timer = root.querySelector('.tz-countdown');
  let ticker;
  function tick() {
    const { started, parts } = countdown(now());
    parts.forEach((n, i) => { timeParts[i].textContent = String(n).padStart(2, '0'); });
    timer.setAttribute('aria-label', `시즌 2 시작까지 ${parts[0]}일 ${parts[1]}시간 ${parts[2]}분 ${parts[3]}초`);
    timer.hidden = started;
    root.querySelector('.tz-started').hidden = !started;
    if (started) { clearInterval(ticker); try { onStart?.(); } catch (e) { console.error(e); } }
  }
  ticker = setInterval(tick, 1000);
  tick();
  startMap(root, motion);
  startBossDemo(root, motion);
  reveal(root, motion);
  stillOffscreen(root);
  loadRecords(root.querySelector('.tz-stats'), motion);
  const top = root.querySelector('.tz-top');
  const onScroll = () => top.classList.toggle('is-solid', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
}

// 화면에 들어온 칸부터 차례로 나타난다(채팅은 한 줄씩). 움직임 줄이기면 처음부터 다 보인다.
//  2026-11-16: 긴 카드(휴대폰 1,100px 넘음)가 한참 빈 화면으로 남지 않게 — 조금만 닿아도(2%), 화면에 닿기 조금 전(아래 10%)부터 나타난다.
export const REVEAL = { threshold: 0.02, rootMargin: '0px 0px 10% 0px' };
function reveal(root, motion) {
  const items = root.querySelectorAll('.tz-head, .tz-feature, .tz-types, .tz-dex, .tz-prize-in, .tz-reset');
  if (motion.matches || !('IntersectionObserver' in window)) { items.forEach((el) => el.classList.add('is-in')); return; }
  root.classList.add('tz-anim');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }, REVEAL);
  items.forEach((el) => io.observe(el));
}

// 끝없이 도는 꾸밈 움직임(불씨·금테 반짝임·속성 고리·보상 빛)은 그 칸이 화면 밖이면 멈춘다(tz-still — styles.css).
function stillOffscreen(root) {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.target.classList.toggle('tz-still', !e.isIntersecting);
  });
  root.querySelectorAll('.tz-hero, .tz-feature, .tz-types, .tz-dex, .tz-prize-in').forEach((el) => io.observe(el));
}

async function loadRecords(host, motion) {
  try {
    const response = await fetch(asset('s1-stats.json'), { cache: 'no-cache' });
    if (!response.ok) throw new Error('기록을 불러오지 못했어요.');
    const stats = readStats(await response.json());
    host.replaceChildren(...stats.map((st, i) => h('div', { class: `tz-stat tz-stat-${i}` },
      h('p', { class: 'tz-stat-value' }, h('span', { class: 'sr-only' }, `${st.prefix}${st.value}${st.unit}`),
        h('span', { class: 'tz-stat-prefix', 'aria-hidden': 'true' }, st.prefix), h('strong', { 'data-stat': st.value, 'aria-hidden': 'true' }, st.value), h('span', { 'aria-hidden': 'true' }, st.unit)),
      h('p', { class: 'tz-stat-label' }, st.label))));
    if (!motion.matches && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const nums = host.querySelectorAll('[data-stat]');
        function frame(now) {
          const progress = motion.matches ? 1 : Math.min(1, (now - start) / 1400);
          nums.forEach((el) => { el.textContent = Math.round(Number(el.dataset.stat) * (1 - (1 - progress) ** 3)).toLocaleString('ko-KR'); });
          if (progress < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      }, { threshold: 0.15 });
      observer.observe(host);
    }
  } catch {
    host.replaceChildren(h('p', { role: 'status' }, '기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'),
      h('button', { class: 'tz-retry', type: 'button', onclick: () => loadRecords(host, motion) }, '다시 불러오기'));
  } finally {
    host.setAttribute('aria-busy', 'false');
  }
}
