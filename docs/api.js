// 서버와 이야기하기(API.md "DJ 키우기 페이지"). 체험 모드(?demo=1, localhost)에서는 mock.js가 대신 답한다.
// 읽기만 한다(로그인 없음). 올리는 쪽은 DJ의 먼치킨(봇 프로그램)이다.

export const API_KEY = 'sb_publishable_45cIqG4dGLSlev-rmNiVDg_uG8szVzD';
// DJ 키우기 페이지(k/<주소>) 서버: DJ 캐릭터·1~3등·시즌 아이디로 찾기
export const KIUGI_BASE = 'https://aksegkhhugqvvaidgvro.supabase.co/functions/v1/kiugi/';

export function isDemo() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('demo') === '1') sessionStorage.setItem('fp_demo', '1');
    if (q.get('demo') === '0') sessionStorage.removeItem('fp_demo');
    if (sessionStorage.getItem('fp_demo') === '1') return true;
  } catch { /* 무시 */ }
  return ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && new URLSearchParams(location.search).get('demo') !== '0';
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

// mockPath: 체험 모드에서 mock.js 가 받을 길('kiugi/page' 처럼 앞에 함수 이름을 붙인다).
async function get(path, query, { timeout = 20000, mockPath = 'kiugi/' + path } = {}) {
  let status, json;
  if (isDemo()) {
    ({ status, json } = await (await mock()).handle('GET', mockPath, query || {}));
  } else {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeout);
    let res;
    try {
      res = await fetch(KIUGI_BASE + path + qs(query), { method: 'GET', headers: { apikey: API_KEY }, signal: ctl.signal, cache: 'no-store' });
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

// DJ 키우기 페이지(로그인 없음)
export const kiugiApi = {
  page: (slug) => get('page', { slug }),
  find: (slug, q) => get('find', { slug, q }),
};
