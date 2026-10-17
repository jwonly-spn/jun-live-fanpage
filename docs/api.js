// 서버와 이야기하기(API.md "DJ 키우기 페이지"). 체험 모드(이 PC 미리 보기 — localhost)에서는 mock.js가 대신 답한다.
// 로그인 없음. 올리는 쪽은 DJ의 먼치킨(봇 프로그램)이고, 사이트는 읽기와 하트 보내기만 한다.
import { swr, peekCached } from './lib/swr.js';

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

// 빠른 길(2026-10-18 — lib/swr.js): 지난번 답으로 먼저 그리고 새 답을 받는다. → {cached, age, fresh: Promise}
//  체험 모드와 진짜 서버의 답은 섞이지 않게 열쇠를 나눈다.
const scope = () => (demoNow() ? 'demo:' : '');
const idBase = (id) => String(id ?? '').normalize('NFC').split('#')[0];
export const fastApi = {
  home: () => swr(scope() + 'home', () => kiugiApi.home(), { fresh: 20000 }),
  page: (slug) => swr(`${scope()}page:${slug}`, () => kiugiApi.page(slug), { fresh: 20000 }),
  person: (slug, id) => swr(`${scope()}person:${slug}/${idBase(id)}`, () => kiugiApi.person(slug, idBase(id)), { fresh: 15000 }),
  // 받아 둔 것만(서버에 묻지 않는다)
  peekHome: () => peekCached(scope() + 'home'),
  peekPage: (slug) => peekCached(`${scope()}page:${slug}`),
  peekPerson: (slug, id) => peekCached(`${scope()}person:${slug}/${idBase(id)}`),
};
