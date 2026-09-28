// 시작점: 주소를 읽고 알맞은 화면을 그린다(history.pushState 방식, 새로고침 없이 이동).
import { computeBase, parseRoute, buildPath } from './lib/route.js';
import { isDemo } from './api.js';

const BASE = computeBase(new URL(import.meta.url).pathname);
const root = document.getElementById('app');

const app = {
  base: BASE,
  link: (route) => buildPath(BASE, route) + (isDemo() && !['localhost', '127.0.0.1'].includes(location.hostname) ? '?demo=1' : ''),
  navigate(href, { replace = false } = {}) {
    if (replace) history.replaceState(null, '', href); else history.pushState(null, '', href);
    render({ scroll: true });
  },
};

let token = 0, lastPath = location.pathname + location.search;
async function render({ scroll = false } = {}) {
  const my = ++token;
  lastPath = location.pathname + location.search;
  // 다른 화면으로 가면 열려 있던 사진 보기·확인 창을 닫는다(아이폰 뒤로 밀기 등).
  for (const d of document.querySelectorAll('dialog[open]')) { try { d.close(); } catch { d.removeAttribute('open'); } }
  document.documentElement.classList.remove('no-scroll');
  const route = parseRoute(location.pathname, BASE);
  document.body.dataset.route = route.name;
  try {
    if (route.name === 'studio') {
      const { renderStudio } = await import('./views/studio.js');
      if (my === token) await renderStudio(root, app);
    } else if (route.name === 'mobile') {
      const { renderMobile } = await import('./views/mobile.js');
      if (my === token) await renderMobile(root, app);
    } else if (route.name === 'fan') {
      const { renderFan } = await import('./views/fan.js');
      if (my === token) await renderFan(root, route, app);
    } else {
      const { renderIntro } = await import('./views/intro.js');
      if (my === token) renderIntro(root, app, { notFound: route.name === 'notfound' });
    }
  } catch (e) {
    console.error(e);
    root.replaceChildren(Object.assign(document.createElement('p'), { className: 'boot-error', textContent: '화면을 여는 중에 문제가 생겼어요. 새로고침해 주세요.' }));
  }
  if (scroll) {
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
  if (url.pathname === location.pathname && url.search === location.search && url.hash) {
    history.replaceState(null, '', url.href);
    document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView({ behavior: 'smooth' });
    return;
  }
  app.navigate(url.pathname + url.search + url.hash);
});

// #main 같은 같은 페이지 안 이동은 다시 그리지 않는다(쓰던 한마디가 지워지지 않게).
window.addEventListener('popstate', () => { if (location.pathname + location.search === lastPath) return; render(); });
render();
