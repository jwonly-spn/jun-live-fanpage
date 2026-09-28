// 주소 해석 — BASE(예: /jun-live-fanpage/)를 떼고 경로를 나눈다. DOM 없이 동작.

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

const SLUG = /^[a-z0-9-]{3,30}$/;
const MENU = /^[a-z0-9_]{2,24}$/;
const POST = /^[A-Za-z0-9_-]{1,64}$/;

function decode(s) {
  try { return decodeURIComponent(s); } catch { return null; }
}

export function parseRoute(pathname, base = '/') {
  const rel = stripBase(pathname, base);
  if (rel === '' || rel === 'index.html' || rel === '404.html') return { name: 'intro' };
  const parts = rel.split('/').map(decode);
  if (parts.some((x) => x === null)) return { name: 'notfound' };
  if (parts[0] === 'studio' && parts.length === 1) return { name: 'studio' };
  if (parts[0] === 'app' && parts.length === 1) return { name: 'mobile' };
  if (parts[0] === 'p' && SLUG.test(parts[1] || '')) {
    const slug = parts[1];
    if (parts.length === 2) return { name: 'fan', slug };
    if (parts.length === 3 && MENU.test(parts[2])) return { name: 'fan', slug, menuId: parts[2] };
    if (parts.length === 4 && parts[2] === 'post' && POST.test(parts[3])) return { name: 'fan', slug, postId: parts[3] };
  }
  return { name: 'notfound' };
}

export function buildPath(base, route) {
  const b = base.endsWith('/') ? base : base + '/';
  const e = encodeURIComponent;
  switch (route.name) {
    case 'studio': return b + 'studio';
    case 'mobile': return b + 'app';
    case 'fan':
      if (route.postId) return `${b}p/${e(route.slug)}/post/${e(route.postId)}`;
      if (route.menuId) return `${b}p/${e(route.slug)}/${e(route.menuId)}`;
      return `${b}p/${e(route.slug)}`;
    default: return b;
  }
}

// studio#code=... 에서 코드 꺼내기
export function readCodeFromHash(hash) {
  const m = /(?:^#|&)code=([^&]+)/.exec(String(hash || ''));
  if (!m) return null;
  const v = decode(m[1]);
  return v && /^[A-Za-z0-9_.~-]{4,200}$/.test(v) ? v : null;
}
