// 팬 화면: 홈, 메뉴 화면, 글 하나 화면. 미리보기(스튜디오)에서도 같은 함수로 홈을 그린다.
import { h, icon, applyTheme } from '../lib/dom.js';
import { normalizeConfig, FORMS } from '../lib/config.js';
import { formatDate, clip } from '../lib/text.js';
import { api, photoUrl } from '../api.js';
import { framedPhoto, photoStrip, openViewer } from './photos.js';
import { ilink, extLink, loading, errorBox, empty, sectionHead, avatar, share, commentItem } from './common.js';
import { FORM_VIEWS, postDetail, daysList } from './forms.js';

const cache = new Map(); // slug → {data, at}

export function makeCtx(app, data, { preview = false } = {}) {
  const config = normalizeConfig(data.page.config);
  const slug = data.page.slug;
  return {
    app, preview, config, slug, pageId: data.page.id, live: data.live || null, rankings: data.rankings || null,
    menus: config.menus.filter((m) => m.visible),
    href: (r = {}) => app.link({ name: 'fan', slug, ...r }),
    menu(id) { return this.menus.find((m) => m.id === id) || null; },
  };
}

async function loadPage(slug, force = false) {
  const hit = cache.get(slug);
  if (hit && !force && Date.now() - hit.at < 60000) return hit.data;
  const data = await api.page(slug);
  cache.set(slug, { data, at: Date.now() });
  return data;
}

// 진입점
export async function renderFan(root, route, app) {
  const shell = h('div', { class: 'fp' });
  applyTheme(shell, 'rose');
  shell.append(h('main', { id: 'main', class: 'fp-main' }, loading()));
  root.replaceChildren(shell);
  let data;
  try { data = await loadPage(route.slug); } catch (e) {
    const main = shell.querySelector('main');
    main.replaceChildren(h('div', { class: 'fp-missing' },
      h('h1', { class: 'sec-title' }, e.status === 404 ? '팬페이지를 찾을 수 없어요' : '팬페이지를 열지 못했어요'),
      h('p', { class: 'muted' }, e.status === 404 ? '주소가 맞는지 확인해 주세요. 아직 공개되지 않았거나 잠시 닫혀 있을 수 있어요.' : e.message),
      e.status === 404 ? null : h('button', { type: 'button', class: 'btn btn-line', onclick: () => renderFan(root, route, app) }, '다시 해 보기'),
      ilink(app.link({ name: 'intro' }), { class: 'btn btn-line' }, 'JUN LIVE 팬페이지 알아보기')));
    document.title = 'JUN LIVE 팬페이지';
    return;
  }
  const ctx = makeCtx(app, data);
  applyTheme(shell, ctx.config.theme);
  applyTheme(document.documentElement, ctx.config.theme);
  const name = ctx.config.profile.name;
  document.title = `${name}의 팬페이지`;
  const main = h('main', { id: 'main', class: 'fp-main', tabindex: '-1' });
  shell.replaceChildren(topBar(ctx), main);

  if (route.postId) await renderPost(ctx, route.postId, main);
  else if (route.menuId) renderMenu(ctx, route.menuId, main);
  else main.append(homeView(ctx, null));
  if (!route.menuId && !route.postId) loadHome(ctx, main);
  shell.append(footer());
}

function topBar(ctx) {
  const name = ctx.config.profile.name;
  return h('header', { class: 'fp-top' },
    ilink(ctx.href(), { class: 'fp-brand' }, `${name}의 팬페이지`),
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': '공유하기', onclick: () => share(location.origin + ctx.href(), `${name}의 팬페이지`) }, icon('share')));
}

function footer() {
  return h('footer', { class: 'fp-foot' }, h('span', null, 'JUN LIVE로 만든 팬페이지'));
}

async function loadHome(ctx, main) {
  try {
    const home = await api.home(ctx.pageId);
    main.replaceChildren(homeView(ctx, home));
  } catch (e) {
    main.append(errorBox(e.message));
  }
}

// ---- 메뉴 칩 ----
export function menuNav(ctx, activeId = null) {
  return h('nav', { class: 'menu-nav', 'aria-label': '팬페이지 메뉴' },
    h('ul', null,
      h('li', null, ilink(ctx.href(), { class: 'chip nav', 'aria-current': activeId ? null : 'page' }, '홈')),
      ctx.menus.map((m) => h('li', null, ilink(ctx.href({ menuId: m.id }), { class: 'chip nav', 'aria-current': m.id === activeId ? 'page' : null }, m.name)))));
}

// ---- 홈 ----
export function homeView(ctx, home) {
  const cfg = ctx.config, p = cfg.profile;
  const photoFirst = cfg.layout === 'photo';
  const lounge = ctx.menus.find((m) => m.form === 'lounge');
  const loungeHref = lounge ? ctx.href({ menuId: lounge.id }) + '#write' : null;

  // 방송 중 + 다음 약속
  const liveOn = !!ctx.live?.on;
  const liveCard = (where) => liveOn || p.schedule ? h('section', { class: 'card live-card ' + where, 'aria-label': '방송 상태와 다음 약속' },
    liveOn ? h('div', { class: 'live-row' },
      h('span', { class: 'live-badge' }, h('i', { 'aria-hidden': 'true' }), 'LIVE'),
      h('div', { class: 'col grow' }, h('b', null, '지금 방송 중이에요'), ctx.live.title ? h('span', { class: 'muted small' }, ctx.live.title) : null),
      p.spoonUrl ? extLink(p.spoonUrl, { class: 'accent-text strong' }, '들으러 가기') : null) : null,
    p.schedule ? h('div', { class: 'next-row' + (liveOn ? ' divided' : '') }, h('span', { class: 'muted small' }, '다음 약속'), h('b', null, p.schedule)) : null) : null;

  // 프로필
  const coverEl = p.cover ? h('div', { class: 'cover' }, framedPhoto(p.cover, { cap: 0.5625, onOpen: () => openViewer([p.cover], 0), label: '커버 사진 크게 보기' })) : h('div', { class: 'cover empty-cover', 'aria-hidden': 'true' });
  const profile = h('section', { class: 'card profile' },
    coverEl,
    h('div', { class: 'profile-body' },
      avatar(cfg, 'lg'),
      h('h1', { class: 'display' }, p.name),
      p.intro ? h('p', { class: 'intro' }, p.intro) : null,
      p.description ? h('p', { class: 'desc-box wide-only' }, p.description) : null,
      h('div', { class: 'profile-actions' },
        p.spoonUrl ? extLink(p.spoonUrl, { class: 'btn btn-accent grow' }, icon('headphone', { size: 18 }), '스푼에서 듣기') : null,
        loungeHref ? ilink(loungeHref, { class: 'btn btn-line' }, '한마디 남기기') : null)));

  const nav = menuNav(ctx);
  const descBox = p.description ? h('section', { class: 'desc-box narrow-only' }, p.description) : null;
  const quote = p.quote ? h('figure', { class: 'quote' }, h('blockquote', null, p.quote), h('figcaption', null, '— ', p.name)) : null;

  // 고정 글
  const pinned = home?.pinned?.length ? h('section', { class: 'stack' },
    sectionHead('고정된 글'),
    h('ul', { class: 'pinned-list' }, home.pinned.map((post) => {
      const m = ctx.menu(post.menu);
      return h('li', null, ilink(ctx.href({ postId: post.id }), { class: 'pinned-row' },
        post.photos?.[0] ? h('img', { src: photoUrl(post.photos[0].thumb), alt: '', width: post.photos[0].w, height: post.photos[0].h, loading: 'lazy', style: { 'aspect-ratio': `${post.photos[0].w} / ${post.photos[0].h}` } }) : h('span', { class: 'pin-badge static' }, '고정'),
        h('span', { class: 'col grow' }, h('b', null, post.title || clip(post.body, 24) || '제목 없음'), h('span', { class: 'muted small' }, `${m?.name || ''} · ${formatDate(post.created)}`))));
    }))) : null;

  // 메뉴별 최근 글(홈에 보여주기 켠 메뉴)
  const photoSections = ctx.menus.filter((m) => m.options.showOnHome && home?.menus?.[m.id]?.length).map((m) => {
    const posts = home.menus[m.id];
    const items = posts.filter((x) => x.photos?.length).map((x) => ({ photo: x.photos[0], href: m.form === 'album' ? ctx.href({ menuId: m.id }) : ctx.href({ postId: x.id }), label: x.title || m.name }));
    return h('section', { class: 'stack' },
      sectionHead(m.name, { href: ctx.href({ menuId: m.id }), sub: m.description }),
      items.length ? photoStrip(items, { height: photoFirst ? 220 : 150 }) : h('ul', { class: 'board-list' }, posts.map((x) => h('li', null, ilink(ctx.href({ postId: x.id }), { class: 'board-row' }, h('span', { class: 'board-title' }, x.title || clip(x.body, 30)))))));
  });

  // 최근 한마디
  const comments = lounge ? h('section', { class: 'stack', id: 'guestbook' },
    sectionHead(lounge.name, { href: ctx.href({ menuId: lounge.id }), sub: lounge.description }),
    home?.comments?.length ? h('div', { class: 'comments' }, home.comments.map(commentItem)) : home ? empty('아직 남겨진 한마디가 없어요.') : null,
    h('a', { href: loungeHref, 'data-link': '', class: 'dashed-btn' }, icon('plus', { size: 18 }), '닉네임으로 한마디 남기기')) : null;

  // 이번 주 랭킹 요약
  const rankMenu = ctx.menus.find((m) => m.form === 'ranking' && m.options.support !== false);
  const week = ctx.rankings?.support?.week || [];
  const ranking = rankMenu && week.length ? h('section', { class: 'stack' },
    sectionHead('이번 주 고마운 이름', { href: ctx.href({ menuId: rankMenu.id }) }),
    h('ol', { class: 'rank-mini card' }, week.slice(0, 3).map((r, i) => h('li', null, h('span', { class: 'medal sm' + (i === 0 ? ' first' : '') }, String(i + 1)), h('span', null, r.nickname))))) : null;

  // 기념일
  const daysMenu = ctx.menus.find((m) => m.form === 'days' && m.options.days?.length);
  const daysSec = daysMenu ? h('section', { class: 'stack' }, sectionHead(daysMenu.name, { href: ctx.href({ menuId: daysMenu.id }), sub: daysMenu.description }), daysList(ctx, daysMenu, { limit: 2 })) : null;

  const loadingNote = home ? null : loading('소식을 불러오는 중…');
  const flow = photoFirst
    ? [photoSections, pinned, descBox, quote, comments, ranking, daysSec]
    : [descBox, quote, pinned, comments, photoSections, ranking, daysSec];
  return h('div', { class: 'home' + (photoFirst ? ' layout-photo' : ' layout-story') },
    liveCard('narrow-only'),
    h('div', { class: 'home-aside' }, profile),
    h('div', { class: 'home-main' }, liveCard('wide-only'), nav, loadingNote, flow.flat().filter(Boolean)));
}

// ---- 메뉴 화면 ----
function renderMenu(ctx, menuId, main) {
  const menu = ctx.menu(menuId);
  if (!menu) {
    main.append(menuNav(ctx), h('div', { class: 'fp-missing' }, h('h1', { class: 'sec-title' }, '메뉴를 찾을 수 없어요'), ilink(ctx.href(), { class: 'btn btn-line' }, '홈으로')));
    return;
  }
  document.title = `${menu.name} · ${ctx.config.profile.name}의 팬페이지`;
  const body = h('div', { class: 'menu-body form-' + menu.form });
  main.append(
    h('div', { class: 'page-head' },
      ilink(ctx.href(), { class: 'icon-btn', 'aria-label': '홈으로' }, icon('back')),
      h('h1', { class: 'page-title' }, menu.name),
      h('span', { class: 'muted small form-name' }, FORMS[menu.form].name)),
    menu.description ? h('p', { class: 'page-desc' }, menu.description) : null,
    menuNav(ctx, menu.id),
    body);
  FORM_VIEWS[menu.form](ctx, menu, body);
}

// ---- 글 하나 ----
async function renderPost(ctx, postId, main) {
  main.append(loading());
  try {
    const { post } = await api.post(postId, ctx.pageId);
    const menu = ctx.menu(post.menu);
    // 이 팬페이지의 (보이는) 메뉴 글이 아니면 보여 주지 않는다
    if (!menu) throw Object.assign(new Error('이 팬페이지의 글이 아니에요.'), { status: 404 });
    document.title = `${post.title || menu?.name || '글'} · ${ctx.config.profile.name}의 팬페이지`;
    main.replaceChildren(
      h('div', { class: 'page-head' },
        ilink(menu ? ctx.href({ menuId: menu.id }) : ctx.href(), { class: 'icon-btn', 'aria-label': menu ? `${menu.name}(으)로 돌아가기` : '홈으로' }, icon('back')),
        h('span', { class: 'page-title' }, menu?.name || '글')),
      postDetail(ctx, post, menu));
  } catch (e) {
    main.replaceChildren(h('div', { class: 'fp-missing' }, h('h1', { class: 'sec-title' }, e.status === 404 ? '글을 찾을 수 없어요' : '글을 열지 못했어요'), h('p', { class: 'muted' }, e.message), ilink(ctx.href(), { class: 'btn btn-line' }, '홈으로')));
  }
}

// 스튜디오 미리보기: 초안 설정으로 홈을 그린다(누를 수 없음)
export function previewHome(app, { config, slug = 'preview', pageId = 'preview', live, rankings, home }) {
  const ctx = makeCtx(app, { page: { id: pageId, slug, config }, live, rankings }, { preview: true });
  const shell = h('div', { class: 'fp preview-fp', inert: true });
  applyTheme(shell, ctx.config.theme);
  shell.append(topBar(ctx), h('main', { class: 'fp-main' }, homeView(ctx, home)), footer());
  return shell;
}
