// 옷장과 수집 앨범 시안. 기존 검색·하트·저장·사진 renderer를 그대로 사용한다.
import { h, icon } from '../lib/dom.js';
import { fastApi } from '../api.js';
import { loadCatalog, buildCatalog, wornList, itemCodeOf } from '../lib/kiugi-draw.js';
import { sameData } from '../lib/swr.js';
import { charKey } from '../lib/me.js';
import { ilink, nightTop, siteFoot, errorBox, BRAND } from './common.js';
import { art, itemArt, baseOf, idText, buddyOf } from './cards.js';
import { petTile } from '../lib/raster.js';
import { heartPill, pinButton, favButton, storyRings, todayStrip } from './feed.js';
import { searchParts, feedBlock, meBlock, topItemsSection, spotlightPick } from './intro.js';
import { seasonLine, dDay } from './kiugi.js';

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');

function wardrobe(card, home, ctx) {
  const dj = home.djs?.find((d) => d.slug === card.slug);
  const character = card.character || dj?.character;
  const seasonId = home.season?.id || ctx.catalog.last;
  const href = ctx.app.link({ name: 'character', slug: card.slug, base: baseOf(card.id) });
  const pieces = wornList(ctx.catalog, seasonId, card.worn).filter((it) => it.slot !== 'bg').slice(0, 4);
  const heart = heartPill({ slug: card.slug, id: card.id, seasonId, hearts: card.hearts }, { big: true });
  const level = h('span', { class: 'album-level' }, `Lv.${card.level || 1}`);
  const pet = buddyOf(ctx.catalog, card.pet);
  const person = h('div', { class: 'album-person' },
    h('div', { class: 'album-person-name' }, h('span', null, `${dj?.name || card.djName || 'DJ'} 키우기`),
      ilink(href, null, h('h3', null, ...idText(card.id)))), heart.el);
  const stage = art(ctx.catalog, character, card.worn, card.level, { seasonId, base: ctx.app.base, eager: true, label: `${card.id} 전신 캐릭터`, kind: 'album-body' });
  const look = h('div', { class: 'album-look' },
    h('div', { class: 'album-look-top' }, h('span', { class: 'album-sticker' }, icon('sparkle', { size: 14 }), '오늘의 캐릭터'), level),
    ilink(href, { class: 'album-fullbody', 'aria-label': `${card.id} 캐릭터 보기` }, stage,
      pet ? petTile(pet, ctx.app.base, { label: `함께하는 펫 ${pet.name}` }) : null), person);
  const clothes = h('section', { class: 'album-clothes', 'aria-labelledby': 'album_worn_t' },
    h('div', { class: 'album-clothes-head' }, h('h3', { id: 'album_worn_t' }, icon('hanger', { size: 18 }), '입은 옷'), h('span', null, `${pieces.length}벌`)),
    h('div', { class: 'album-clothes-grid' }, ...pieces.map((it) => ilink(href + '#try', { class: 'album-piece', 'aria-label': `${it.name} · 입혀 보기` },
      h('span', { class: 'album-piece-slot' }, it.slotName),
      itemArt(ctx.catalog, it.id, { base: ctx.app.base, gender: character?.gender || 'f', label: it.name }),
      h('span', { class: 'album-piece-code' }, itemCodeOf(ctx.catalog, seasonId, it.id) || it.slotName))),
      pieces.length < 4 ? ilink(ctx.app.link({ name: 'items' }), { class: 'album-piece album-piece-more' },
        icon('hanger', { size: 30 }), h('span', null, '다른 옷 보기'), icon('arrow', { size: 16 })) : null),
    !pieces.length ? h('p', { class: 'album-plain' }, '기본 옷을 입고 있어요.') : null,
    ilink(href + '#try', { class: 'album-try' }, '입혀 보기', icon('arrow', { size: 18 })),
    h('div', { class: 'album-person-actions' }, pinButton({ slug: card.slug, id: card.id, djName: dj?.name || card.djName }), favButton({ slug: card.slug, id: card.id, djName: dj?.name || card.djName }, { compact: true })));
  const board = h('div', { class: 'album-lookboard' }, look, clothes);
  board.kgHeart = heart;
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
  const board = h('div', { class: 'album-board-host' }, h('div', { class: 'album-board-loading', role: 'status' }, '옷장을 여는 중…'));
  const rings = h('div', { class: 'album-broadcasts' });
  const mine = meBlock(ctx);
  const albumCount = h('span', { class: 'album-count' });
  const header = h('header', { class: 'album-heading' },
    h(notice ? 'h2' : 'h1', null, BRAND),
    h('div', { class: 'album-search', id: 'find' }, search.form));
  const cover = h('section', { class: 'album-wardrobe', 'aria-labelledby': 'album_wardrobe_t' },
    h('div', { class: 'album-section-head' },
      h('h2', { id: 'album_wardrobe_t' }, icon('hanger', { size: 20 }), '캐릭터 옷장'),
      ilink(app.link({ name: 'items' }), null, '옷장 도감', icon('arrow', { size: 16 }))), board);
  const collection = h('section', { class: 'album-collection', id: 'album', 'aria-labelledby': 'album_collection_t' },
    h('div', { class: 'album-section-head' }, h('h2', { id: 'album_collection_t' }, '캐릭터 앨범', albumCount),
      h('span', { class: 'album-pocket-note' }, icon('heart', { size: 15 }), '하루 한 번, 하트')), feedBlock(ctx));
  content.append(header, search.results, cover,
    h('section', { class: 'album-broadcast-section', 'aria-label': '방송별 캐릭터' }, h('h2', null, '방송별 앨범'), rings),
    h('div', { class: 'album-mobile-today' }, todayStrip()),
    h('div', { class: 'album-mine' }, mine), collection,
    h('section', { class: 'album-closet-picks' }, topItemsSection(ctx)));
  let last = null, signature = '';
  const paint = (home) => {
    last = home;
    season.textContent = seasonLine(home.season);
    const days = home.season ? dDay(home.season) : null;
    ending.textContent = days || '';
    counters.replaceChildren(h('div', null, h('b', null, fmt(home.totals?.djs)), h('span', null, '방송')),
      h('div', null, h('b', null, fmt(home.totals?.people)), h('span', null, '캐릭터')));
    albumCount.textContent = fmt(home.totals?.people);
    const fc = { ...ctx, season: home.season, seasonId: home.season?.id || catalog.last, lookOf: (slug) => home.djs?.find((d) => d.slug === slug)?.character };
    const pick = spotlightPick(home);
    if (pick) {
      const next = JSON.stringify([pick.card.slug, pick.card.id, pick.card.worn, pick.card.level, home.djs?.find((d) => d.slug === pick.card.slug)?.character]);
      if (signature !== next) { signature = next; board.replaceChildren(wardrobe(pick.card, home, ctx)); }
      else board.firstElementChild?.kgHeart?.set(pick.card.hearts);
    } else board.replaceChildren(h('p', { class: 'empty' }, '아직 앨범에 캐릭터가 없어요. 방송에서 아이디를 만들면 보여요.'));
    const state = ctx.meState || { mine: [], looks: new Map(), news: new Map() };
    rings.replaceChildren(storyRings(home.djs, fc, {
      mine: state.mine.map((entry) => ({ entry, look: state.looks.get(charKey(entry.slug, entry.id)), news: state.news.get(charKey(entry.slug, entry.id)) || 0 })),
      onMine: (e) => ctx.meFocus?.(charKey(e.slug, e.id)), onAdd: search.focus,
    }));
    ctx.paintFeed?.(home);
    ctx.paintTop?.(home);
  };
  ctx.repaintHero = () => { if (last) paint(last); };
  if (job.cached) paint(job.cached);
  try { const fresh = await job.fresh; if (!job.cached || !sameData(fresh, job.cached)) paint(fresh); }
  catch (e) { if (!job.cached) board.replaceChildren(errorBox('옷장을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.', () => app.navigate(location.pathname, { replace: true }))); }
}
