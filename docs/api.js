// 서버와 이야기하기 — 시즌 2(2026-12-01~) 키우기.com. 로그인 없음. 읽기만 한다.
//  · 지도: 영토 서버(territory 함수 — 먼치킨 저장소 server/territory-supabase)가 공개 저장소에 올리는 tr-snap/map.json(spec.md 5절).
//    함수를 부르지 않고 저장소 파일만 읽는다(머리글 없는 GET — 미리 묻기 없음, 0.2초 안팎).
//  · 아이디로 몬스터 찾기: DJ 키우기 서버(kiugi 함수) GET search?q= · person?slug=&id= (API.md "시즌 2").
// 체험 모드(이 PC 미리 보기 — localhost)에서는 mock.js 가 대신 답한다(지어낸 지도·아이디).
export const API_KEY = 'sb_publishable_45cIqG4dGLSlev-rmNiVDg_uG8szVzD';
export const KIUGI_BASE = 'https://aksegkhhugqvvaidgvro.supabase.co/functions/v1/kiugi/';
// 지도 파일(index.html·404.html 이 처음부터 미리 받는다 — 같은 주소여야 그 답을 그대로 쓴다)
export const MAP_URL = 'https://aksegkhhugqvvaidgvro.supabase.co/storage/v1/object/public/tr-snap/map.json';
// 지도를 다시 읽는 간격: 3분(서버는 바뀌면 15초씩 모아 올린다). 화면이 숨어 있으면 쉬고, 다시 보이면 1분 넘었을 때 바로 읽는다.
export const MAP_POLL_MS = 3 * 60e3, MAP_WAKE_MS = 60e3, DEMO_POLL_MS = 20e3;

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];
export function isDemo() {
  if (typeof location === 'undefined') return false;
  const local = LOCAL_HOSTS.includes(location.hostname);
  try { if (!local) sessionStorage.removeItem('fp_demo'); } catch { /* 무시 */ }
  return local && new URLSearchParams(location.search).get('demo') !== '0';
}

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
const STATUS_MESSAGE = {
  400: '입력한 내용을 다시 확인해 주세요.',
  404: '찾을 수 없어요.',
  429: '잠시 뒤에 다시 해 주세요.',
  503: '서버가 잠시 쉬고 있어요. 조금 뒤에 다시 해 주세요.',
};

let mockMod = null;
const mock = async () => (mockMod ||= await import('./mock.js'));

function qs(query) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== null && v !== '') u.set(k, String(v));
  const s = u.toString();
  return s ? '?' + s : '';
}
// 읽기(GET)는 머리글 없이 공개 키를 주소 쿼리(?apikey=)로 보낸다 — 브라우저가 미리 묻기(OPTIONS)를 따로 보내지 않게(2026-10-20부터 그대로)
async function request(path, query, { timeout = 20000, fetchImpl = (u, o) => fetch(u, o) } = {}) {
  let status, json;
  if (isDemo()) ({ status, json } = await (await mock()).handle('GET', 'kiugi/' + path, query || {}));
  else {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeout);
    let res;
    try { res = await fetchImpl(KIUGI_BASE + path + qs({ ...query, apikey: API_KEY }), { signal: ctl.signal, cache: 'no-store' }); }
    catch (e) { throw new ApiError(e?.name === 'AbortError' ? '응답이 늦어요. 잠시 뒤에 다시 해 주세요.' : '인터넷 연결을 확인해 주세요.', 0); }
    finally { clearTimeout(timer); }
    status = res.status;
    try { json = await res.json(); } catch { json = null; }
  }
  if (status < 200 || status >= 300) throw new ApiError(json && typeof json.error === 'string' && json.error ? json.error : STATUS_MESSAGE[status] || '문제가 생겼어요. 잠시 뒤에 다시 해 주세요.', status);
  return json || {};
}

export const kiugiApi = {
  // → {results:[{slug, djName, id, lead, monsters:[{sp, stage, lv}]}], exact, more}
  search: (q) => request('search', { q }),
  // → {id, lead, monsters, season, dj:{slug, name}}
  person: (slug, id) => request('person', { slug, id }),
};

// 지도 파일 읽기 → json | null(아직 없음 — 시즌 시작 전) · 실패는 ApiError. fresh 면 브라우저 기억을 건너뛴다(1분마다 다른 주소).
export async function readMapFile({ fresh = false, fetchImpl = (u, o) => fetch(u, o), timeout = 8000 } = {}) {
  if (isDemo()) return (await mock()).demoMap();
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const url = fresh ? `${MAP_URL}?t=${Math.floor(Date.now() / 60000)}` : MAP_URL;
    const r = await fetchImpl(url, { signal: ctl.signal, ...(fresh ? { cache: 'no-store' } : {}) });
    if (r.status === 400 || r.status === 404) return null; // 저장소는 없는 파일에 400/404 를 준다
    if (!r.ok) throw new ApiError(STATUS_MESSAGE[r.status] || '지도를 불러오지 못했어요.', r.status);
    return await r.json();
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(e?.name === 'AbortError' ? '지도 응답이 늦어요.' : '지도를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.', 0);
  } finally { clearTimeout(timer); }
}
// 사이트에 복사된 시즌 2 목록·그림 목록(먼치킨 저장소 → tools/sync-kiugi-site.mjs → docs/kiugi/). 없으면 null(자리 이름·자리 그림).
export async function readSiteJson(base, name) {
  try { const r = await fetch(`${base}kiugi/${name}`, { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch { return null; }
}
export const pollMs = () => (isDemo() ? DEMO_POLL_MS : MAP_POLL_MS);
