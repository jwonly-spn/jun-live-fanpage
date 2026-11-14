// 시작점: 주소를 읽고 알맞은 화면을 그린다(history.pushState 방식, 새로고침 없이 이동).
// 시즌 2(2026-12-01~) 화면: 첫 화면(영토 지도 · 아이디로 몬스터 찾기 — views/home.js) · 몬스터 도감(views/dex.js).
// 시즌 1 주소(k/…, items)·예전 팬페이지 주소(p/…, studio, app)는 첫 화면으로 바꾸고(캐릭터 주소였으면 그 아이디로 찾기) 한 줄 알린다.
import { computeBase, parseRoute, buildPath } from './lib/route.js';

const BASE = computeBase(new URL(import.meta.url).pathname);
const root = document.getElementById('app');

const app = {
  base: BASE,
  link: (route) => buildPath(BASE, route),
  navigate(href, { replace = false } = {}) {
    if (replace) history.replaceState(null, '', href); else history.pushState(null, '', href);
    render({ scroll: true });
  },
};

const MOVED = {
  old: '시즌 1 화면은 끝났어요. 시즌 2 몬스터 영토전 지도로 왔어요.',
  notfound: '찾는 페이지가 없어서 첫 화면으로 왔어요.',
};

let token = 0, lastPath = location.pathname + location.search;
async function render({ scroll = false } = {}) {
  const my = ++token;
  let route = parseRoute(location.pathname, BASE, location.search);
  if (route.name === 'old' || route.name === 'notfound') {
    const why = MOVED[route.name];
    history.replaceState(null, '', app.link({ name: 'home', id: route.id }) + (route.id ? '#find' : ''));
    route = parseRoute(location.pathname, BASE, location.search);
    import('./lib/dom.js').then(({ toast }) => toast(why)).catch(() => {});
  }
  lastPath = location.pathname + location.search;
  document.body.dataset.route = route.name;
  try {
    if (route.name === 'dex') {
      const { renderDex } = await import('./views/dex.js');
      if (my === token) await renderDex(root, app, route);
    } else {
      const { renderHome } = await import('./views/home.js');
      if (my === token) await renderHome(root, app, route);
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
