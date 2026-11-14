// 키우기 시즌 2 「몬스터 영토전」 예고 사이트(2026-11-15 새로 그림 — 어두운 게임 티저).
//  차례: 첫 화면(제목·카운트다운·전쟁 지도) → 시즌 1 기록 → 대격변 미리 보기(영지전·보스전·산책·속성·도감) → 1등 보상 → 냥 안내 → 바닥.
//  글은 모두 textContent(h·svg 도우미)로만 넣는다. 예시 이름은 모두 지어낸 것.
import { h } from '../lib/dom.js';
import { countdown, readStats } from '../lib/teaser-time.js';
import { startMap } from '../lib/teaser-map.js';
import { UNOFFICIAL, DISCLAIMER } from './common.js';

const asset = (file) => new URL('../teaser/' + file, import.meta.url).href;
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
      h('b', {}, who || '먼치킨', who ? null : h('em', {}, 'BOT')),
      h('p', {}, text)))));
}

function hero() {
  const parts = ['D', 'H', 'M', 'S'].map((unit, i) => h('div', { class: 'tz-time' },
    h('strong', { 'data-time': i }, '00'), h('span', { 'aria-hidden': 'true' }, unit)));
  return h('section', { class: 'tz-hero', 'aria-labelledby': 'teaser-title' },
    h('div', { class: 'tz-sky', 'aria-hidden': 'true' }, h('i', { class: 'tz-glow-a' }), h('i', { class: 'tz-glow-b' }), h('i', { class: 'tz-glow-c' })),
    h('div', { class: 'tz-embers', 'aria-hidden': 'true' }, Array.from({ length: 18 }, () => h('i'))),
    h('div', { class: 'tz-hero-in' },
      h('div', { class: 'tz-hero-copy' },
        h('p', { class: 'tz-eyebrow', lang: 'en' }, h('i', { 'aria-hidden': 'true' }), 'KIUGI · SEASON 2'),
        h('h1', { id: 'teaser-title' }, h('span', { class: 'tz-h1-pre' }, '키우기 시즌 2'), h('span', { class: 'tz-h1-main' }, '몬스터', h('br'), '영토전')),
        h('p', { class: 'tz-coming', lang: 'en' }, 'COMING SOON'),
        h('p', { class: 'tz-tagline' }, '몬스터를 만나고, 보스를 쓰러뜨리고,', h('br'), '우리 DJ의 이름으로 대륙을 칠하세요.'),
        h('div', { class: 'tz-countdown', role: 'timer', 'aria-label': '시즌 2 시작까지 남은 시간' }, parts),
        h('p', { class: 'tz-open' }, h('time', { datetime: '2026-12-01T00:00:00+09:00' }, '2026. 12. 01 00:00'), h('span', {}, '한국 시각 오픈')),
        h('p', { class: 'tz-started', role: 'status', hidden: true }, '시즌 2가 시작됐어요'),
        h('div', { class: 'tz-cta' },
          h('a', { class: 'tz-btn tz-btn-gold', href: '#preview' }, '대격변 미리 보기'),
          h('a', { class: 'tz-btn tz-btn-ghost', href: '#season-one' }, '시즌 1 기록'))),
      h('figure', { class: 'tz-war' },
        h('div', { class: 'tz-war-frame' },
          h('div', { class: 'tz-war-stage' }),
          h('div', { class: 'tz-war-hud', 'aria-hidden': 'true' },
            h('span', { class: 'tz-live' }, h('i'), 'LIVE'), h('strong', { class: 'tz-war-day' }, '12월 1일'), h('span', { class: 'tz-war-sample' }, '예시')),
          h('ol', { class: 'tz-war-news', 'aria-hidden': 'true' }),
          h('i', { class: 'tz-war-vignette', 'aria-hidden': 'true' })),
        h('figcaption', {}, h('span', {}, '지어낸 DJ 6명이 한 달 동안 땅을 넓히는 예시 화면이에요.'),
          h('button', { class: 'tz-war-toggle', type: 'button', 'aria-pressed': 'false' }, '움직임 멈추기')))),
    h('a', { class: 'tz-scroll', href: '#season-one', 'aria-label': '아래로' }, h('span', { lang: 'en' }, 'SCROLL'), h('i', { 'aria-hidden': 'true' })));
}

const head = (no, en, title, sub) => h('header', { class: 'tz-head' },
  h('p', { class: 'tz-chapter' }, h('b', {}, no), h('span', { lang: 'en' }, en)),
  h('h2', {}, title), sub ? h('p', { class: 'tz-head-sub' }, sub) : null);

function records() {
  return h('section', { id: 'season-one', class: 'tz-sec tz-archive', 'aria-labelledby': 'records-title' },
    head('01', 'ARCHIVE · SEASON 1', h('span', { id: 'records-title' }, '시즌 1, 이만큼 함께했어요'), '옷 입히기로 시작한 첫 번째 시즌이 11월 15일에 막을 내렸어요. 함께해 줘서 고마워요.'),
    h('div', { class: 'tz-stats', 'aria-busy': 'true' }, h('p', { class: 'tz-stats-loading' }, '시즌 1의 기록을 불러오고 있어요.')),
    h('p', { class: 'tz-stamp', 'aria-hidden': 'true', lang: 'en' }, 'SEASON 1 · CLEAR'));
}

function bossArt() {
  const L = 'M0 300L30 250Q60 215 110 205L95 175L130 195Q150 190 158 180Q150 160 152 140L140 120L156 118Q158 100 168 92C140 70 110 40 80 10C125 35 160 55 182 78Q200 72 218 78C240 55 275 35 320 10C290 40 260 70 232 92Q242 100 244 118L260 120L248 140Q250 160 242 180Q250 190 270 195L305 175L290 205Q340 215 370 250L400 300Z';
  return h('div', { class: 'tz-boss-art', 'aria-hidden': 'true' },
    h('div', { class: 'tz-boss-glow' }),
    s('svg', { class: 'tz-boss-svg', viewBox: '0 0 400 300' },
      s('defs', {}, s('linearGradient', { id: 'tzBossFill', x1: '0', y1: '0', x2: '0', y2: '1' }, s('stop', { offset: '0', 'stop-color': '#2a0f14' }), s('stop', { offset: '1', 'stop-color': '#050407' }))),
      s('path', { d: L, fill: 'url(#tzBossFill)', class: 'tz-boss-body' }),
      s('path', { d: 'M165 132L191 141L168 147Z M235 132L209 141L232 147Z', class: 'tz-boss-eyes' }),
      s('path', { d: 'M174 170L184 177L194 170L204 177L214 170L224 177', class: 'tz-boss-mouth' })),
    h('div', { class: 'tz-boss-bar' }, h('span', {}, h('b', {}, '보스 「???」'), h('em', {}, '약점 공개는 등장할 때')), h('div', { class: 'tz-hp' }, h('i'))),
    h('div', { class: 'tz-boss-clock' }, h('span', {}, '방송 시작'), h('i'), h('strong', {}, '60:00'), h('i'), h('span', {}, '보스 등장')));
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
    head('02', 'SEASON 2 · CHANGES', h('span', { id: 'preview-title', class: 'tz-manifesto' }, h('span', {}, '한 번 입히고 끝인 옷 입히기?'), h('strong', {}, '시즌 2는 완전히 다릅니다.'))),
    h('article', { class: 'tz-feature tz-f-war' },
      h('div', { class: 'tz-f-copy' },
        h('p', { class: 'tz-f-no', lang: 'en' }, 'I · TERRITORY WAR'),
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
        h('p', { class: 'tz-f-no', lang: 'en' }, 'II · BOSS RAID'),
        h('h3', {}, '최애 DJ에게 영광을 가져다줄 보스전.'),
        h('p', {}, '방송을 켜고 정확히 1시간 뒤, 보스가 나타나요. 청취자들의 몬스터가 한꺼번에 덤비고, 전투는 채팅으로 생중계돼요. 쓰러뜨리면 DJ 땅이 넓어져요.'),
        h('ul', { class: 'tz-points' },
          h('li', {}, h('b', {}, '방송마다 한 번'), '시작 60분 뒤, 놓치면 다음 방송에서'),
          h('li', {}, h('b', {}, '약점 속성'), '보스의 약점을 찌르면 피해가 1.5배'),
          h('li', {}, h('b', {}, '생중계'), '한방에 나가떨어지는 순간까지 채팅으로'))),
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
        h('p', { class: 'tz-f-no', lang: 'en' }, 'III · MONSTERS'),
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
        h('p', { class: 'tz-f-no', lang: 'en' }, 'IV · SIX ELEMENTS'),
        h('h3', {}, '여섯 속성, 서로 물고 물리는 힘.'),
        h('p', { class: 'tz-element-list' }, '불 · 물 · 풀 · 땅 · 바람 · 전기'),
        h('p', {}, '화살표 방향으로 강해요. 상대 약점을 찌르면 1.5배, 거꾸로면 약해져요. 보스도, 영지전 몬스터 대전도 속성을 알면 이겨요.')),
      ringArt()),
    h('div', { class: 'tz-dex' },
      h('div', { class: 'tz-dex-head' }, h('p', { class: 'tz-f-no', lang: 'en' }, 'V · MONSTER DEX'), h('h3', {}, '12종 몬스터 × 3단계, 그리고 보스 6.'), h('p', {}, '어떤 모습일지는 12월 1일에 공개돼요.')),
      h('ul', { class: 'tz-dex-grid' }, ELEMENTS.map((el) => h('li', { class: `tz-card tz-${el[0]}` },
        h('span', { class: 'tz-card-tag' }, elementIcon(el, 16), `${el[1]} 속성`),
        h('div', { class: 'tz-card-shadow', 'aria-hidden': 'true' }, h('i'), h('b', {}, '?')),
        h('p', {}, h('strong', { lang: 'en' }, 'SEALED'), h('span', {}, '12.01 공개')))))));
}

function prize() {
  return h('section', { class: 'tz-prize', 'aria-labelledby': 'prize-title' },
    h('div', { class: 'tz-prize-in' },
      h('div', { class: 'tz-crown', 'aria-hidden': 'true' },
        s('svg', { viewBox: '0 0 64 64', width: 96, height: 96 }, s('path', { d: 'M8 46 4 18l16 12 12-20 12 20 16-12-4 28Z', class: 'tz-crown-body' }), s('path', { d: 'M8 52h48', class: 'tz-crown-base' })),
        h('b', {}, '1')),
      h('p', { class: 'tz-chapter' }, h('b', {}, '03'), h('span', { lang: 'en' }, 'SEASON REWARD')),
      h('h2', { id: 'prize-title' }, h('span', { class: 'tz-prize-label' }, '1등 DJ 보상'), h('span', { class: 'tz-prize-main' }, '먼치킨 1달 이용권 + ', h('strong', {}, '486', h('small', {}, '스푼')))),
      h('p', {}, '12월 31일 23:59, 대륙에서 가장 넓은 땅을 가진 DJ에게 드려요.'),
      h('ol', { class: 'tz-schedule' },
        h('li', {}, h('b', {}, '12.01 00:00'), h('span', {}, '시즌 2 시작 · 모두 기지 1%에서')),
        h('li', {}, h('b', {}, '12월 한 달'), h('span', {}, '보스전 · 영지전으로 땅 넓히기')),
        h('li', {}, h('b', {}, '12.31 23:59'), h('span', {}, '시즌 끝 · 땅 1등 DJ 보상')))));
}

export function renderTeaser(root) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  root.replaceChildren(
    h('p', { class: 'tz-unofficial' }, UNOFFICIAL),
    h('header', { class: 'tz-top' },
      h('a', { class: 'tz-brand', href: '#main', 'aria-label': '키우기.com 처음으로' }, h('i', { 'aria-hidden': 'true' }), '키우기', h('small', {}, '.com')),
      h('span', { class: 'tz-edition' }, h('b', { lang: 'en' }, 'SEASON 2'), '몬스터 영토전')),
    h('main', { id: 'main', tabindex: '-1' }, hero(), records(), previews(), prize(),
      h('aside', { class: 'tz-reset', 'aria-label': '시즌 전환 안내' },
        h('b', { 'aria-hidden': 'true' }, '!'),
        h('div', {}, h('strong', {}, '꼭 알아 두세요'), h('p', {}, '시즌 1에 모아 둔 냥은 시즌 2가 시작되면 전부 삭제돼요. 아이디는 그대로 이어져요.')))),
    h('footer', { class: 'tz-footer' }, h('strong', {}, '키우기.com'), h('p', {}, UNOFFICIAL), h('p', {}, DISCLAIMER), h('small', {}, '먼치킨과 함께하는, 우리의 다음 모험.')));

  const timeParts = root.querySelectorAll('[data-time]');
  const timer = root.querySelector('.tz-countdown');
  let ticker;
  function tick() {
    const { started, parts } = countdown();
    parts.forEach((n, i) => { timeParts[i].textContent = String(n).padStart(2, '0'); });
    timer.setAttribute('aria-label', `시즌 2 시작까지 ${parts[0]}일 ${parts[1]}시간 ${parts[2]}분 ${parts[3]}초`);
    timer.hidden = started;
    root.querySelector('.tz-started').hidden = !started;
    if (started) clearInterval(ticker);
  }
  ticker = setInterval(tick, 1000);
  tick();
  startMap(root, motion);
  reveal(root, motion);
  loadRecords(root.querySelector('.tz-stats'), motion);
  const top = root.querySelector('.tz-top');
  const onScroll = () => top.classList.toggle('is-solid', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
}

// 화면에 들어온 칸부터 차례로 나타난다(채팅은 한 줄씩). 움직임 줄이기면 처음부터 다 보인다.
function reveal(root, motion) {
  const items = root.querySelectorAll('.tz-head, .tz-feature, .tz-types, .tz-dex, .tz-prize-in, .tz-reset');
  if (motion.matches || !('IntersectionObserver' in window)) { items.forEach((el) => el.classList.add('is-in')); return; }
  root.classList.add('tz-anim');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
  items.forEach((el) => io.observe(el));
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
