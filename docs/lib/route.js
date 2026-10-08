// 주소 해석 — BASE(예: /jun-live-fanpage/)를 떼고 경로를 나눈다. DOM 없이 동작.
// 화면: 메인(intro) · 옷 도감(items) · DJ 키우기 페이지(k/<주소>) · 캐릭터 페이지(k/<주소>/<아이디 앞 부분>).
// 예전 팬페이지 주소(p/…, studio, app)는 'ended'(서비스를 마쳤다는 안내).

// app.js 가 있는 폴더 경로 = 사이트 BASE
export function computeBase(scriptPath) {
  const p = String(scriptPath || '/');
  const i = p.lastIndexOf('/');
  return i >= 0 ? p.slice(0, i + 1) : '/';
}

export function stripBase(pathname, base) {
  let p = String(pathname || '/');
  const b = String(base || '/');
  if (b !== '/' && (p === b.slice(0, -1) || p.startsWith(b))) p = p.slice(b.length - 1);
  return p.replace(/^\/+/, '').replace(/\/+$/, '');
}

// DJ 키우기 페이지 주소(k/<주소>): 서버가 만든 8자(헷갈리는 i·l·o·0·1 없음)
export const KIUGI_SLUG = /^[a-hjkmnp-z2-9]{8}$/;
// 캐릭터 페이지의 아이디 앞 부분(청취자가 만든 한글 1~6자)
export const ID_BASE = /^[가-힣]{1,6}$/;
// 체험 페이지(?demo=1 — 서버 없이 지어낸 아이디로 보여 준다)
export const DEMO_KIUGI_SLUG = 'nyangdj7';
// 마친 팬페이지 서비스의 주소: 팬 페이지 p/<주소>…, DJ 꾸미기 studio, 휴대폰 가입 app
const ENDED = new Set(['p', 'studio', 'app']);

function decode(s) {
  try { return decodeURIComponent(s); } catch { return null; }
}

export function parseRoute(pathname, base = '/') {
  const rel = stripBase(pathname, base);
  if (rel === '' || rel === 'index.html' || rel === '404.html') return { name: 'intro' };
  const parts = rel.split('/').map(decode);
  if (parts.some((x) => x === null)) return { name: 'notfound' };
  if (parts[0] === 'items' && parts.length === 1) return { name: 'items' };
  if (parts[0] === 'k' && KIUGI_SLUG.test(parts[1] || '')) {
    if (parts.length === 2) return { name: 'kiugi', slug: parts[1] };
    const idBase = parts.length === 3 ? parts[2].normalize('NFC') : '';
    if (ID_BASE.test(idBase)) return { name: 'character', slug: parts[1], base: idBase };
  }
  if (ENDED.has(parts[0])) return { name: 'ended' };
  return { name: 'notfound' };
}

export function buildPath(base, route) {
  const b = base.endsWith('/') ? base : base + '/';
  if (route.name === 'kiugi') return `${b}k/${encodeURIComponent(route.slug)}`;
  if (route.name === 'character') return `${b}k/${encodeURIComponent(route.slug)}/${encodeURIComponent(route.base)}`;
  if (route.name === 'items') return `${b}items`;
  return b;
}
