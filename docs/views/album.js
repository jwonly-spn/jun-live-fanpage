// 옷장과 수집 앨범 시안. 기존 검색·하트·저장·사진 renderer를 그대로 사용한다.
import { h, icon } from '../lib/dom.js';
import { fastApi } from '../api.js';
import { loadCatalog, buildCatalog, wornList, itemCodeOf } from '../lib/kiugi-draw.js';
import { sameData } from '../lib/swr.js';
import { charKey } from '../lib/me.js';
import { ilink, nightTop, siteFoot, errorBox, BRAND, applySeasonTheme } from './common.js';
import { art, itemArt, idText, buddyOf } from './cards.js';
import { petTile } from '../lib/raster.js';
import { storyRings, todayStrip, postCard } from './feed.js';
import { searchParts, feedBlock, meBlock, howSection } from './intro.js';
import { seasonLine, dDay } from './kiugi.js';

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');

// stage: 캐릭터 페이지가 넘겨 주는 "현재 모습" 무대 칸(같은 모습이면 다시 그릴 때 같은 칸을 그대로 쓴다 — views/character.js). 없으면 여기서 만든다.
export function characterWardrobe(card, { app, catalog, onTry, onCopyCode, stage: given = null }) {
  const ctx = { app, catalog };
  const dj = card.dj || {};
  const character = dj.character;
  const seasonId = card.season?.id || catalog.last;
  const pieces = wornList(ctx.catalog, seasonId, card.worn);
  const level = h('span', { class: 'album-level' }, `Lv.${card.level || 1}`);
  const pet = buddyOf(ctx.catalog, card.pet);
  const person = h('div', { class: 'album-person' },
    h('div', { class: 'album-person-name' }, h('span', null, `${dj?.name || card.djName || 'DJ'} 키우기`),
      h('h3', null, ...idText(card.id))),
    ilink(app.link({ name: 'items' }), { class: 'album-detail-catalog' }, '옷 도감', icon('arrow', { size: 15 })));
  // 현재 모습(전신 — 큰 칸): 고해상도(R9 원본 그림)로 · 고른 표정(exp)이 열려 있으면 그 표정
  const stage = given || art(ctx.catalog, character, card.worn, card.level, { seasonId, base: ctx.app.base, eager: true, label: `${card.id} 전신 캐릭터`, kind: 'album-body', hd: true, exp: Number.isInteger(card.exp) ? card.exp : null });
  const look = h('div', { class: 'album-look' },
    h('div', { class: 'album-look-top' }, h('span', { class: 'album-sticker' }, icon('hanger', { size: 14 }), '현재 모습'), level),
    h('div', { class: 'album-fullbody' }, stage,
      pet ? petTile(pet, ctx.app.base, { label: `함께하는 펫 ${pet.name}` }) : null), person);
  const clothes = h('section', { class: 'album-clothes', 'aria-labelledby': 'album_worn_t' },
    h('div', { class: 'album-clothes-head' }, h('h3', { id: 'album_worn_t' }, icon('hanger', { size: 18 }), '입은 옷'), h('span', null, `${pieces.length}벌`)),
    h('div', { class: 'album-clothes-grid' }, ...pieces.map((it) => {
      const code = itemCodeOf(ctx.catalog, seasonId, it.id);
      return h('div', { class: 'album-piece' },
        h('button', { type: 'button', class: 'album-piece-preview', 'aria-label': `${it.name} · 입혀 보기`, onclick: onTry },
          h('span', { class: 'album-piece-slot' }, it.slotName),
          itemArt(ctx.catalog, it.id, { base: ctx.app.base, gender: character?.gender || 'f', label: it.name })),
        h('span', { class: 'album-piece-name' }, it.name),
        code ? h('button', { type: 'button', class: 'album-piece-code', 'aria-label': `${code} 명령 복사`, onclick: () => onCopyCode?.(code) }, icon('copy', { size: 12 }), code) : null);
    }),
      pieces.length < 4 ? ilink(ctx.app.link({ name: 'items' }), { class: 'album-piece album-piece-more' },
        icon('hanger', { size: 30 }), h('span', null, '다른 옷 보기'), icon('arrow', { size: 16 })) : null),
    !pieces.length ? h('p', { class: 'album-plain' }, '기본 옷을 입고 있어요.') : null,
    h('button', { type: 'button', class: 'album-try', onclick: onTry }, '입혀 보기', icon('arrow', { size: 18 })));
  const board = h('div', { class: 'album-lookboard' }, look, clothes);
  return board;
}

export async function renderAlbumIntro(root, app, { notice = null } = {}) {
  document.title = BRAND;
  const sidebarToday = h('div', { class: 'album-today' });
  const counters = h('div', { class: 'album-counters' });
  const season = h('span', { class: 'album-season' }, '시즌을 불러오는 중…');
  const ending = h('span', { class: 'album-ending' });
  const nav = h('aside', { class: 'album-sidebar', 'aria-label': '앨범 목차' },
    h('div', { class: 'album-spine' }, icon('book', { size: 26 }), h('span', null, '나의 키우기')), 
    h('nav', { class: 'album-index' },
      ilink(app.link({ name: 'intro' }) + '#album', { class: 'is-active' }, icon('book', { size: 19 }), '캐릭터 앨범', h('span', null, '01')),
      ilink(app.link({ name: 'intro' }) + '#me', null, icon('user', { size: 19 }), '내 캐릭터', h('span', null, '02')),
      ilink(app.link({ name: 'items' }), null, icon('hanger', { size: 19 }), '옷장 도감', h('span', null, '03'))),
    h('div', { class: 'album-side-season' }, h('span', { class: 'album-season-dot', 'aria-hidden': 'true' }), season, ending),
    counters, sidebarToday);
  const content = h('main', { id: 'main', class: 'album-main', tabindex: '-1' });
  root.replaceChildren(h('div', { class: 'fp album-site' }, ...nightTop(app),
    h('div', { class: 'album-shell' }, nav, content),
    siteFoot(app, '내 캐릭터·즐겨찾기는 이 브라우저에만 기억해요. 옷은 방송 채팅에서 구매하고 입어요.')));
  const notices = {
    notfound: ['페이지를 찾을 수 없어요', '주소가 맞는지 확인해 주세요.'],
    ended: ['팬페이지 서비스를 마쳤어요', 'DJ가 알려 준 키우기 주소로 계속 볼 수 있어요.'],
  };
  if (notices[notice]) content.append(h('section', { class: 'kg-notice', role: 'alert' }, h('h1', { class: 'kg-notice-title' }, notices[notice][0]), h('p', null, notices[notice][1])));
  const catalog = await loadCatalog(app.base).catch(() => buildCatalog([]));
  const job = fastApi.home();
  const ctx = { app, catalog, home: () => job.fresh, todayHost: sidebarToday };
  const search = searchParts(ctx);
  const rings = h('div', { class: 'album-broadcasts' });
  const mine = meBlock(ctx);
  const podiumCards = h('div', { class: 'album-podium-cards' });
  const podium = h('section', { class: 'album-podium', 'aria-labelledby': 'album_podium_t' },
    h('div', { class: 'album-section-head' }, h('h2', { id: 'album_podium_t' }, icon('crown', { size: 19 }), '인기 캐릭터 1·2·3등'),
      h('span', { class: 'album-pocket-note' }, '하트를 많이 받은 순서예요')), podiumCards);
  const albumCount = h('span', { class: 'album-count' });
  const mainSeason = h('span', { class: 'album-main-season' }, '시즌을 불러오는 중…');
  const countdown = h('span', { class: 'album-countdown', hidden: true });
  const seasonMark = h('span', { class: 'album-season-mark', 'aria-hidden': 'true' });
  const seasonBanner = h('div', { class: 'album-season-banner' }, seasonMark, mainSeason, countdown);
  const header = h('header', { class: 'album-heading' },
    h('div', { class: 'album-title-block' }, seasonBanner, h(notice ? 'h2' : 'h1', null, BRAND)),
    h('section', { class: 'album-search', id: 'find', 'aria-labelledby': 'album_search_t' },
      h('h2', { id: 'album_search_t' }, '내 캐릭터 찾기'), search.form));
  const collection = h('section', { class: 'album-collection', id: 'album', 'aria-labelledby': 'album_collection_t' },
    h('div', { class: 'album-section-head' }, h('h2', { id: 'album_collection_t' }, '캐릭터 앨범', albumCount),
      h('span', { class: 'album-pocket-note' }, icon('heart', { size: 15 }), '하루 한 번, 하트')), feedBlock(ctx));
  content.append(header, search.results, podium, h('div', { class: 'album-mine' }, mine), collection,
    h('section', { class: 'album-broadcast-section', 'aria-label': '방송별 캐릭터' }, h('h2', null, '방송별 앨범'), rings),
    h('div', { class: 'album-mobile-today' }, todayStrip()), howSection(ctx));
  let last = null, podiumSignature = '';
  const paint = (home) => {
    last = home;
    season.textContent = seasonLine(home.season);
    const days = home.season ? dDay(home.season) : null;
    ending.textContent = days || '';
    mainSeason.textContent = seasonLine(home.season);
    countdown.hidden = !days;
    countdown.textContent = /^D-\d+$/.test(days || '') ? `종료까지 ${days.slice(2)}일` : (days || '');
    const halloween = /할로윈/.test(`${home.season?.name || ''} ${home.season?.theme || ''}`);
    applySeasonTheme(home.season);
    seasonBanner.classList.toggle('is-halloween', halloween);
    seasonMark.textContent = halloween ? '🎃' : '●';
    counters.replaceChildren(h('div', null, h('b', null, fmt(home.totals?.djs)), h('span', null, '방송')),
      h('div', null, h('b', null, fmt(home.totals?.people)), h('span', null, '캐릭터')));
    albumCount.textContent = fmt(home.totals?.people);
    const fc = { ...ctx, season: home.season, seasonId: home.season?.id || catalog.last,
      lookOf: (slug) => home.djs?.find((d) => d.slug === slug)?.character,
      djNameOf: (slug) => home.djs?.find((d) => d.slug === slug)?.name || '' };
    const winners = (home.popular || []).slice(0, 3);
    const nextPodium = JSON.stringify(winners.map(({ hearts, ...card }) => card));
    if (nextPodium !== podiumSignature) {
      podiumSignature = nextPodium;
      podiumCards.replaceChildren(...(winners.length
        ? winners.map((card, i) => postCard(card, fc, { rank: i + 1, eager: true }))
        : [h('p', { class: 'empty' }, '아직 하트를 받은 캐릭터가 없어요. 첫 하트를 보내 보세요.')]));
    } else [...podiumCards.querySelectorAll('.kg-post')].forEach((node, i) => node.kgHeart?.set(winners[i]?.hearts));
    const state = ctx.meState || { mine: [], looks: new Map(), news: new Map() };
    rings.replaceChildren(storyRings(home.djs, fc, {
      mine: state.mine.map((entry) => ({ entry, look: state.looks.get(charKey(entry.slug, entry.id)), news: state.news.get(charKey(entry.slug, entry.id)) || 0 })),
      onMine: (e) => ctx.meFocus?.(charKey(e.slug, e.id)), onAdd: search.focus,
    }));
    ctx.paintFeed?.(home);
  };
  ctx.repaintHero = () => { if (last) paint(last); };
  if (job.cached) paint(job.cached);
  try { const fresh = await job.fresh; if (!job.cached || !sameData(fresh, job.cached)) paint(fresh); }
  catch (e) { if (!job.cached) collection.replaceChildren(errorBox('캐릭터 앨범을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.', () => app.navigate(location.pathname, { replace: true }))); }
}
