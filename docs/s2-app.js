// 시작점: 주소를 읽고 알맞은 화면을 그린다(history.pushState 방식, 새로고침 없이 이동).
// 시즌 2(2026-12-01~) 화면: 첫 화면(영토 지도 · 아이디로 몬스터 찾기 — views/home.js) · 몬스터 도감(views/dex.js).
//  보스전 보기(2026-11-19): /boss(지금 보스전 목록) · /boss/<판 번호> · /b/<DJ 주소>(채팅 생중계 링크) — views/boss.js(그 화면에 갈 때만 받는다).
// 시즌 1 주소(k/…, items)·예전 팬페이지 주소(p/…, studio, app)는 첫 화면으로 바꾸고(캐릭터 주소였으면 그 아이디로 찾기) 한 줄 알린다.
import { computeBase, parseRoute, buildPath } from './lib/route.js';

const BASE = computeBase(new URL(import.meta.url).pathname);
const root = document.getElementById('app');

const app = {
  base: BASE,
  onLeave: null,
  link: (route) => buildPath(BASE, route),
  navigate(href, { replace = false } = {}) {
    if (replace) history.replaceState(null, '', href); else history.pushState(null, '', href);
    render({ scroll: true });
  },
};

// 없는 주소는 잠깐 알림(toast). 시즌 1 주소(old)는 2026-11-16 화면 점검(S2)부터 알림 대신 찾기 칸 맨 위에 남는 안내 + 이 브라우저에 저장한 내 아이디(views/home.js oldNote).
const MOVED = {
  notfound: '찾는 페이지가 없어서 첫 화면으로 왔어요.',
};

let token = 0, lastPath = location.pathname + location.search;
async function render({ scroll = false } = {}) {
  const my = ++token;
  // 떠나는 화면이 맡긴 뒷정리(보스전 보기: 장면·소리·다시 읽기를 멈춘다)
  const leave = app.onLeave; app.onLeave = null;
  try { leave?.(); } catch (e) { console.error(e); }
  let route = parseRoute(location.pathname, BASE, location.search), moved = null;
  if (route.name === 'old' || route.name === 'notfound') {
    moved = route.name;
    // 시즌 1 주소는 찾기 칸(#find)으로 — 안내와 아이디 찾기가 거기 있다
    history.replaceState(null, '', app.link({ name: 'home', id: route.id }) + (route.id || moved === 'old' ? '#find' : ''));
    route = parseRoute(location.pathname, BASE, location.search);
    if (moved === 'notfound') import('./lib/dom.js').then(({ toast }) => toast(MOVED.notfound)).catch(() => {});
  }
  lastPath = location.pathname + location.search;
  document.body.dataset.route = route.name;
  try {
    if (route.name === 'boss' || route.name === 'watch' || route.name === 'live') {
      const { renderBoss } = await import('./views/boss.js');
      if (my === token) await renderBoss(root, app, route);
    } else if (route.name === 'dex') {
      const { renderDex } = await import('./views/dex.js');
      if (my === token) await renderDex(root, app, route);
    } else {
      const { renderHome } = await import('./views/home.js');
      if (my === token) await renderHome(root, app, { ...route, moved });
    }
  } catch (e) {
    console.error(e);
    root.replaceChildren(Object.assign(document.createElement('p'), { className: 'boot-error', textContent: '화면을 여는 중에 문제가 생겼어요. 새로고침해 주세요.' }));
  }
  if (scroll || location.hash) {
    if (location.hash && location.hash.length > 1) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
    else window.scrollTo(0, 0);
    document.getElementById('main')?.focus?.({ preventScroll: true });
  }
}

// 사이트 안 링크 가로채기
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('a[data-link]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank') return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return;
  e.preventDefault();
  if (url.pathname === location.pathname && url.hash) {
    history.replaceState(null, '', url.pathname + location.search + url.hash);
    const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    target?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    // 머리줄의 찾기 단추(#find): 찾기 칸으로 가면서 바로 적을 수 있게
    target?.querySelector('input')?.focus({ preventScroll: true });
    return;
  }
  app.navigate(url.pathname + url.search + url.hash);
});

// #find 같은 같은 페이지 안 이동은 다시 그리지 않는다(쓰던 찾기 글이 지워지지 않게)
window.addEventListener('popstate', () => { if (location.pathname + location.search === lastPath) return; render(); });

// 빠르게: 화면 모듈을 받는 동안 몬스터 목록·그림 목록을 미리 묻는다(지도 파일은 index.html 이 처음부터 미리 받는다)
import('./views/monster-ui.js').then((m) => m.monsterCtx(BASE)).catch(() => {});
render();
