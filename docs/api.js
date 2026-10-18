// 서버와 이야기하기(API.md "DJ 키우기 페이지"). 체험 모드(이 PC 미리 보기 — localhost)에서는 mock.js가 대신 답한다.
// 로그인 없음. 올리는 쪽은 DJ의 먼치킨(봇 프로그램)이고, 사이트는 읽기와 하트 보내기만 한다.
import { swr, peekCached, remember } from './lib/swr.js';

export const API_KEY = 'sb_publishable_45cIqG4dGLSlev-rmNiVDg_uG8szVzD';
// DJ 키우기 서버: 메인·DJ 페이지·캐릭터·찾기·하트
export const KIUGI_BASE = 'https://aksegkhhugqvvaidgvro.supabase.co/functions/v1/kiugi/';

// 체험 모드(지어낸 예시 DJ·캐릭터)는 이 PC 의 미리 보기(localhost)에서만(2026-10-15 사용자 "이런 거 너가 만든 거 같은데 얘네도 다 삭제해라"):
//  예전에는 실제 사이트에서도 ?demo=1 로 켜지고 이 탭이 그 표시를 기억해, 진짜 키우기.com 에 예시 캐릭터가 보였다. 실제 사이트는 늘 진짜 서버만 쓰고, 남아 있는 표시도 지운다.
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];
export function isDemo() {
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
  409: '지금은 할 수 없어요.',
  429: '잠시 뒤에 다시 해 주세요.',
  503: '서버가 잠시 쉬고 있어요. 조금 뒤에 다시 해 주세요.',
};

let mockMod = null;
async function mock() {
  if (!mockMod) mockMod = await import('./mock.js');
  return mockMod;
}

function qs(query) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== null && v !== '') u.set(k, String(v));
  const s = u.toString();
  return s ? '?' + s : '';
}

// 체험 모드에서는 mock.js 가 'kiugi/<길>' 로 받는다.
async function request(method, path, { query, body, timeout = 20000 } = {}) {
  let status, json;
  if (demoNow()) {
    ({ status, json } = await (await mock()).handle(method, 'kiugi/' + path, query || {}, body));
  } else {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeout);
    let res;
    try {
      const headers = { apikey: API_KEY };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      res = await fetch(KIUGI_BASE + path + qs(query), { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl.signal, cache: 'no-store' });
    } catch (e) {
      throw new ApiError(e?.name === 'AbortError' ? '응답이 늦어요. 잠시 뒤에 다시 해 주세요.' : '인터넷 연결을 확인해 주세요.', 0);
    } finally { clearTimeout(timer); }
    status = res.status;
    try { json = await res.json(); } catch { json = null; }
  }
  if (status < 200 || status >= 300) {
    const msg = json && typeof json.error === 'string' && json.error ? json.error : STATUS_MESSAGE[status] || '문제가 생겼어요. 잠시 뒤에 다시 해 주세요.';
    // closed: 키우기 페이지가 있지만 DJ가 닫아 둔 것(없는 주소와 구별)
    throw Object.assign(new ApiError(msg, status), { closed: json?.closed === true });
  }
  return json || {};
}

// 체험 모드 고르기(이 PC 미리 보기만): 주소에 ?demo=0 을 붙여 열면 이번 탭은 진짜 서버로(다른 화면으로 가도 이어서 — 속도 재기용)
const LIVE_FLAG = 'kg_live_tab';
function liveTab() {
  try {
    const q = new URLSearchParams(location.search).get('demo');
    if (q === '0') sessionStorage.setItem(LIVE_FLAG, '1'); else if (q === '1') sessionStorage.removeItem(LIVE_FLAG);
    return sessionStorage.getItem(LIVE_FLAG) === '1';
  } catch { return false; }
}
const demoNow = () => isDemo() && !liveTab();

// DJ 키우기(로그인 없음)
export const kiugiApi = {
  page: (slug) => request('GET', 'page', { query: { slug } }),
  find: (slug, q) => request('GET', 'find', { query: { slug, q } }),
  person: (slug, id) => request('GET', 'person', { query: { slug, id } }),
  home: () => request('GET', 'home'),
  search: (q) => request('GET', 'search', { query: { q } }),
  heart: (slug, id, token) => request('POST', 'heart', { body: { slug, id, token } }),
};

// 미리 만든 답(2026-10-18 "사이트 반응을 빠르게"): 서버(kiugi 함수)가 메인·DJ 페이지 답을 공개 저장소(kg-snap)에 올려 두면 그 파일을 먼저 읽는다.
//  함수는 한동안 아무도 안 부르면 쉬다가 깨어나는 데 1~2초가 걸리지만, 저장소 파일은 0.2초 안팎(미리 묻기도 없음 — 머리글을 붙이지 않는 GET).
//  · 10분 안에 만든 파일이면 그 답으로 바로 그린다. 1분 넘은 것이면 그 뒤에 함수에도 물어 이 브라우저 기억만 새로(다음 화면부터).
//  · 파일이 없거나 · 모양이 틀리거나 · 닫힌 페이지({closed:true}) · 늦으면(2.5초) 예전처럼 함수에 묻는다. 체험 모드는 쓰지 않는다.
//  (먼치킨이 새 옷을 올리면 서버가 그 DJ 페이지 파일을 바로, 메인 파일은 15초에 한 번 새로 쓴다 — supabase/functions/kiugi/handler.ts)
export const SNAP_BASE = 'https://aksegkhhugqvvaidgvro.supabase.co/storage/v1/object/public/kg-snap/';
export const SNAP_USE_MS = 10 * 60e3, SNAP_STALE_MS = 60e3;
export async function readSnap(path, valid, { fetchImpl = (u, o) => fetch(u, o), now = Date.now, timeout = 2500 } = {}) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeout) : null;
  try {
    const r = await fetchImpl(SNAP_BASE + path, ctl ? { signal: ctl.signal } : {});
    if (!r || !r.ok) return null;
    const j = await r.json();
    if (!j || typeof j !== 'object' || j.closed || typeof j.snapAt !== 'number' || !valid(j)) return null;
    const age = now() - j.snapAt;
    if (!(age > -60e3 && age < SNAP_USE_MS)) return null;
    const { snapAt, ...data } = j;
    return { data, age };
  } catch { return null; } finally { if (timer) clearTimeout(timer); }
}
const SLUG_RE = /^[a-z0-9]{4,24}$/;
export const validHome = (j) => Array.isArray(j.popular) && Array.isArray(j.recent) && Array.isArray(j.djs) && j.totals && typeof j.totals === 'object';
export const validPage = (slug) => (j) => j.slug === slug && Array.isArray(j.top);
async function viaSnap(key, path, valid, live) {
  if (demoNow() || !path) return live();
  const s = await readSnap(path, valid);
  if (!s) return live();
  if (s.age > SNAP_STALE_MS) void live().then((v) => remember(key, v), () => {});
  return s.data;
}

// 빠른 길(2026-10-18 — lib/swr.js): 지난번 답으로 먼저 그리고 새 답을 받는다. → {cached, age, fresh: Promise}
//  체험 모드와 진짜 서버의 답은 섞이지 않게 열쇠를 나눈다. 새 답은 미리 만든 답(위) → 없으면 함수.
const scope = () => (demoNow() ? 'demo:' : '');
const idBase = (id) => String(id ?? '').normalize('NFC').split('#')[0];
export const fastApi = {
  home: () => { const key = scope() + 'home'; return swr(key, () => viaSnap(key, 'home.json', validHome, () => kiugiApi.home()), { fresh: 20000 }); },
  page: (slug) => { const key = `${scope()}page:${slug}`; return swr(key, () => viaSnap(key, SLUG_RE.test(String(slug)) ? `page/${slug}.json` : '', validPage(slug), () => kiugiApi.page(slug)), { fresh: 20000 }); },
  person: (slug, id) => swr(`${scope()}person:${slug}/${idBase(id)}`, () => kiugiApi.person(slug, idBase(id)), { fresh: 15000 }),
  // 받아 둔 것만(서버에 묻지 않는다)
  peekHome: () => peekCached(scope() + 'home'),
  peekPage: (slug) => peekCached(`${scope()}page:${slug}`),
  peekPerson: (slug, id) => peekCached(`${scope()}person:${slug}/${idBase(id)}`),
};
