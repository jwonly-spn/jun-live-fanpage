// 주소 해석 — BASE(예: /jun-live-fanpage/)를 떼고 경로를 나눈다. DOM 없이 동작.
// 시즌 2(2026-12-01~) 화면: 첫 화면(영토 지도 · 아이디로 몬스터 찾기 — home) · 몬스터 도감(dex).
//  아이디는 주소 쿼리로: /?id=밤톨 (찾기) · /dex?id=밤톨%23먼치 (그 사람이 만난 몬스터를 도감에 색으로).
// 시즌 1 주소(캐릭터 페이지 k/<주소>/<아이디>, DJ 페이지 k/<주소>, 옷 도감 items)와 예전 팬페이지 주소(p/…, studio, app)는
//  'old' → app.js 가 첫 화면으로 바꾼다(캐릭터 주소였으면 그 아이디로 찾기).

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

// 아이디: 앞 부분(청취자가 만든 한글 1~6자) 또는 전체(밤톨#먼치 — 뒤는 한글·영문·숫자 1~8자)
export const ID_BASE = /^[가-힣]{1,6}$/;
export const ID_QUERY = /^[가-힣]{1,6}(#[가-힣A-Za-z0-9]{1,8})?$/;
export const cleanId = (s) => String(s ?? '').normalize('NFC').replace(/\s+/g, '');
const OLD = new Set(['k', 'items', 'p', 'studio', 'app']);

function decode(s) {
  try { return decodeURIComponent(s); } catch { return null; }
}
function idOf(search) {
  try { const v = cleanId(new URLSearchParams(search || '').get('id')); return ID_QUERY.test(v) ? v : ''; } catch { return ''; }
}

export function parseRoute(pathname, base = '/', search = '') {
  const rel = stripBase(pathname, base);
  if (rel === '' || rel === 'index.html' || rel === '404.html') return { name: 'home', id: idOf(search) };
  const parts = rel.split('/').map(decode);
  if (parts.some((x) => x === null)) return { name: 'notfound' };
  if (parts[0] === 'dex' && parts.length === 1) return { name: 'dex', id: idOf(search) };
  if (OLD.has(parts[0])) {
    // 시즌 1 캐릭터 주소(k/<주소>/<아이디 앞 부분>)였으면 그 아이디로 찾아 준다
    const base3 = parts[0] === 'k' && parts.length === 3 ? cleanId(parts[2]) : '';
    return { name: 'old', id: ID_BASE.test(base3) ? base3 : '' };
  }
  return { name: 'notfound' };
}

export function buildPath(base, route) {
  const b = base.endsWith('/') ? base : base + '/';
  const q = route.id && ID_QUERY.test(cleanId(route.id)) ? `?id=${encodeURIComponent(cleanId(route.id))}` : '';
  if (route.name === 'dex') return `${b}dex${q}`;
  return `${b}${q}`;
}
