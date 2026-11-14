import { h, icon } from '../lib/dom.js';
import { countdown, readStats } from '../lib/teaser-time.js';
import { startMap } from '../lib/teaser-map.js';
import { UNOFFICIAL, DISCLAIMER } from './common.js';

const asset = (file) => new URL('../teaser/' + file, import.meta.url).href;
const sectionTag = (number, title) => h('p', { class: 's2-kicker' }, h('span', {}, number), title);
export const ELEMENTS = [
  ['fire', '불', 'flame'], ['water', '물', 'water'], ['grass', '풀', 'leaf'],
  ['earth', '땅', 'mountain'], ['wind', '바람', 'wind'], ['electric', '전기', 'bolt'],
];
const GLYPHS = { flame: '✦', water: '◒', leaf: '❧', mountain: '▲', wind: '≋', bolt: 'ϟ' };
const REVEALED = -1;

function hero() {
  const values = ['D', 'H', 'M', 'S'].map((unit, i) => h('div', { class: 's2-time-part' },
    h('strong', { 'data-time': i }, '00'), h('span', { 'aria-hidden': 'true' }, unit)));
  return h('section', { class: 's2-hero', 'aria-labelledby': 'teaser-title' },
    h('div', { class: 's2-hero-copy' },
      h('p', { class: 's2-eyebrow' }, h('span', { class: 's2-spark', 'aria-hidden': 'true' }, '✦'), '새로운 모험이 곧 시작돼요'),
      h('h1', { id: 'teaser-title' }, h('span', { class: 's2-season' }, '키우기 시즌 2'),
        h('span', { class: 's2-coming', lang: 'en' }, 'COMING', h('br'), 'SOON', h('span', { class: 's2-period' }, '.'))),
      h('p', { class: 's2-hero-sub' }, '몬스터를 만나고, 함께 싸우고.', h('br'), '우리 DJ의 이름으로 땅을 넓혀요.'),
      h('p', { class: 's2-open' }, h('time', { datetime: '2026-12-01T00:00:00+09:00' }, '2026. 12. 01'), ' · 한국 시각 00:00'),
      h('div', { class: 's2-countdown', role: 'timer', 'aria-label': '시즌 2 시작까지 남은 시간' }, values),
      h('p', { class: 's2-started', role: 'status', hidden: true }, '시즌 2가 시작됐어요')),
    h('figure', { class: 's2-map-figure' },
      h('div', { class: 's2-map-heading' }, h('span', {}, '모험이 펼쳐질 땅'), h('span', { class: 's2-map-day' }, '12월 1일')),
      h('div', { class: 's2-map-paper' }, h('canvas', { id: 'territory-map', role: 'img', 'aria-label': '다섯 DJ의 땅이 넓어지는 예시 지도', width: 720, height: 450 }, '다섯 DJ가 보스를 잡고 영지전에서 이기며 땅을 넓혀요.')),
      h('figcaption', {}, h('span', {}, h('span', { class: 's2-live-dot', 'aria-hidden': 'true' }), '예시 화면 · 지어낸 DJ 5명'),
        h('button', { class: 's2-map-toggle', type: 'button', 'aria-pressed': 'false' }, '움직임 멈추기')),
      h('p', { class: 's2-map-caption' }, '작은 기지에서 시작하는, 커다란 이야기.')),
    h('a', { class: 's2-scroll', href: '#season-one' }, '다음 이야기를 만나 보세요', icon('arrow', { size: 18 })));
}

function records() {
  return h('section', { id: 'season-one', class: 's2-section s2-records', 'aria-labelledby': 'records-title' },
    sectionTag('01', '함께 쓴 첫 번째 이야기'),
    h('div', { class: 's2-section-head' }, h('h2', { id: 'records-title' }, '시즌 1,', h('br'), '이만큼 함께했어요'), h('p', {}, '작은 시작에 모인 마음들.', h('br'), '함께해 줘서 고마워요.')),
    h('div', { class: 's2-stats', 'aria-busy': 'true' }, h('p', { class: 's2-stats-loading' }, '시즌 1의 기록을 불러오고 있어요.')));
}

function previews() {
  return h('section', { id: 'preview', class: 's2-section s2-preview', 'aria-labelledby': 'preview-title' },
    sectionTag('02', '시즌 2 대격변 미리 보기'),
    h('h2', { id: 'preview-title', class: 's2-manifesto' }, '한 번 입히고 끝인 옷 입히기? 시즌 2는 완전히 다릅니다.'),
    h('article', { class: 's2-feature s2-war' },
      h('div', { class: 's2-feature-copy' }, h('p', { class: 's2-feature-label' }, '01 / 영지전'),
        h('h3', {}, '청취자들의 도파민을 책임질 영지전.'),
        h('p', {}, 'DJ끼리 냥을 걸고 가위바위보·하나빼기·몬스터 대전으로 겨뤄요. 이기면 진 DJ 땅 일부가 식민지가 돼요.')),
      h('div', { class: 's2-war-art', 'aria-label': '별사탕 땅을 구름빵이 지배하는 영지전 예시' },
        h('div', { class: 's2-versus' }, h('span', {}, icon('crown', { size: 30 }), '별사탕'), h('b', {}, 'VS'), h('span', {}, icon('crown', { size: 30 }), '구름빵')),
        h('div', { class: 's2-colony' }, h('span', { 'aria-hidden': 'true' }, '⚑'), '별사탕 땅 · 구름빵 지배 중'), h('small', {}, '예시 화면'))),
    h('article', { class: 's2-feature s2-boss' },
      h('div', { class: 's2-feature-copy' }, h('p', { class: 's2-feature-label' }, '02 / 보스전'),
        h('h3', {}, '최애 DJ에게 영광을 가져다줄 보스전.'),
        h('p', {}, '방송을 시작하고 1시간 뒤, 보스가 나타나요. 청취자 몬스터들이 함께 싸우고 전투를 채팅으로 중계해요. 이기면 DJ 땅이 넓어져요.')),
      h('div', { class: 's2-boss-art' }, h('div', { class: 's2-boss-clock' }, h('span', {}, '방송 시작 후'), h('strong', {}, '1', h('small', {}, '시간')), h('span', {}, '보스 등장')),
        h('div', { class: 's2-party', 'aria-hidden': 'true' }, icon('star'), icon('star'), icon('star')), h('p', {}, '함께 이기면, 더 넓은 우리 땅.'))),
    h('article', { class: 's2-walk' },
      h('div', {}, h('p', { class: 's2-feature-label' }, '03 / 산책하며 몬스터 만나기'), h('h3', {}, '첫 만남은,', h('br'), '산책 한 번에서.'),
        h('p', {}, '방송 채팅에 ', h('code', {}, '!산책'), '을 보내 보세요. 길에서 만난 몬스터를 데려가고, 경험치로 키워요. 냥으로도 경험치를 살 수 있어요.')),
      h('div', { class: 's2-evolution' }, h('span', { class: 's2-chat' }, '!산책'),
        h('ol', {}, [1, 2, 3].map((n) => h('li', {}, h('span', { class: 's2-evo-icon', 'aria-hidden': 'true' }, icon(n === 3 ? 'crown' : 'sparkle', { size: 20 + n * 8 })), h('strong', {}, `${n}단계`)))),
        h('p', {}, '세 번의 모습, 더 커지는 우리 모험.'))),
    h('div', { class: 's2-elements' }, h('div', { class: 's2-section-head' }, h('h3', {}, '여섯 속성,', h('br'), '서로 다른 힘.'), h('p', {}, '속성을 알면, 승부가 달라져요.', h('br'), '화살표 방향으로 강해요.')),
      h('p', { class: 's2-element-list' }, '불 · 물 · 풀 · 땅 · 바람 · 전기'),
      h('ol', { class: 's2-type-cycle', 'aria-label': '상성 고리: 물은 불에, 불은 풀에, 풀은 땅에, 땅은 전기에, 전기는 바람에, 바람은 물에 강해요.' },
        [ELEMENTS[1], ELEMENTS[0], ELEMENTS[2], ELEMENTS[3], ELEMENTS[5], ELEMENTS[4], ELEMENTS[1]].map(([type, name, glyph], i) => h('li', { class: `s2-type s2-${type}` }, h('span', { class: 's2-type-symbol', 'aria-hidden': 'true' }, GLYPHS[glyph]), h('span', {}, name), i < 6 ? h('b', { class: 's2-type-arrow', 'aria-hidden': 'true' }, '›') : null)))),
    h('div', { class: 's2-monsters' }, h('p', { class: 's2-feature-label' }, '몬스터 미리 보기'), h('h3', {}, '너와 함께할 첫 친구.'),
      // 공개할 몬스터 차례(ELEMENTS 안 번호). -1 = 모두 미공개(2026-11-15: 새 그림체 시안을 다시 그리는 중)
      h('div', { class: 's2-monster-grid' }, ELEMENTS.map(([type, name, glyph], i) => h('article', { class: `s2-monster s2-${type} ${i === REVEALED ? 's2-revealed' : ''}` },
        h('div', { class: 's2-monster-top' }, h('span', {}, GLYPHS[glyph], ' ', name), h('span', {}, i === REVEALED ? '첫 공개' : '미공개')),
        i === REVEALED ? h('div', { class: 's2-monster-image' }, h('img', { src: asset('monster_fire_01_1.png'), alt: '불 속성 몬스터', width: 1024, height: 1024, loading: 'lazy', decoding: 'async' })) : h('div', { class: 's2-mystery', 'aria-hidden': 'true' }, h('span', {}, '?')),
        h('p', {}, i === REVEALED ? '작은 불꽃, 큰 모험' : '곧 공개'))))));
}

function prize() {
  return h('section', { class: 's2-prize', 'aria-labelledby': 'prize-title' },
    h('div', { class: 's2-prize-inner' }, h('div', { class: 's2-prize-medal', 'aria-hidden': 'true' }, icon('crown', { size: 64 }), h('span', {}, '1')),
      h('div', {}, h('p', { class: 's2-kicker' }, '가장 넓은 땅, 가장 빛나는 이름'),
        h('h2', { id: 'prize-title' }, h('span', {}, '1등 DJ 보상 · '), '먼치킨 1달 이용권 + ', h('strong', {}, '486', h('small', {}, '스푼'))),
        h('p', {}, '12월 31일, 가장 넓은 땅을 차지한 DJ에게 드려요.'))));
}

export function renderTeaser(root) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  root.replaceChildren(
    h('p', { class: 's2-unofficial' }, UNOFFICIAL),
    h('header', { class: 's2-header' }, h('a', { class: 's2-brand', href: '#main', 'aria-label': '키우기.com 처음으로' }, icon('sparkle', { size: 27 }), '키우기', h('small', {}, '.com')),
      h('span', { class: 's2-edition' }, '몬스터 영토전', h('span', {}, '시즌 2'))),
    h('main', { id: 'main', tabindex: '-1' }, hero(), records(), previews(), prize(),
      h('aside', { class: 's2-reset', 'aria-label': '시즌 전환 안내' }, h('span', {}, '새 시즌을 기다리는 분들께'),
        h('p', {}, '시즌 1에 모아 둔 냥은 시즌 2가 시작되면 전부 삭제돼요. 아이디는 그대로 이어져요.'))),
    h('footer', { class: 's2-footer' }, h('strong', {}, '키우기.com'), h('p', {}, UNOFFICIAL), h('p', {}, DISCLAIMER), h('small', {}, '먼치킨과 함께하는, 우리의 다음 모험.')));

  const timeParts = root.querySelectorAll('[data-time]');
  const timer = root.querySelector('.s2-countdown');
  let ticker;
  function tick() {
    const { started, parts } = countdown();
    parts.forEach((n, i) => { timeParts[i].textContent = String(n).padStart(2, '0'); });
    timer.setAttribute('aria-label', `시즌 2 시작까지 ${parts[0]}일 ${parts[1]}시간 ${parts[2]}분 ${parts[3]}초`);
    timer.hidden = started;
    root.querySelector('.s2-started').hidden = !started;
    if (started) clearInterval(ticker);
  }
  ticker = setInterval(tick, 1000);
  tick();
  startMap(root, motion);
  loadRecords(root.querySelector('.s2-stats'), motion);
}

async function loadRecords(host, motion) {
  try {
    const response = await fetch(asset('s1-stats.json'), { cache: 'no-cache' });
    if (!response.ok) throw new Error('기록을 불러오지 못했어요.');
    const stats = readStats(await response.json());
    host.replaceChildren(...stats.map((s, i) => h('div', { class: `s2-stat s2-stat-${i}` },
      h('p', { class: 's2-stat-value' }, h('span', { class: 'sr-only' }, `${s.prefix}${s.value}${s.unit}`),
        h('span', { class: 's2-stat-prefix', 'aria-hidden': 'true' }, s.prefix), h('strong', { 'data-stat': s.value, 'aria-hidden': 'true' }, s.value), h('span', { 'aria-hidden': 'true' }, s.unit)),
      h('p', { class: 's2-stat-label' }, s.label))));
    if (!motion.matches && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const nums = host.querySelectorAll('[data-stat]');
        function frame(now) {
          const progress = motion.matches ? 1 : Math.min(1, (now - start) / 1100);
          nums.forEach((el) => { el.textContent = Math.round(Number(el.dataset.stat) * (1 - (1 - progress) ** 3)).toLocaleString('ko-KR'); });
          if (progress < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      }, { threshold: 0.15 });
      observer.observe(host);
    }
  } catch {
    host.replaceChildren(h('p', { role: 'status' }, '기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'),
      h('button', { class: 's2-retry', type: 'button', onclick: () => loadRecords(host, motion) }, '다시 불러오기'));
  } finally {
    host.setAttribute('aria-busy', 'false');
  }
}
