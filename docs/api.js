// 서버와 이야기하기(API.md). 체험 모드(?demo=1, localhost)에서는 mock.js가 대신 답한다.
import { store } from './lib/dom.js';
import { uuid } from './lib/text.js';

export const API_BASE = 'https://aksegkhhugqvvaidgvro.supabase.co/functions/v1/fanpage/';
export const API_KEY = 'sb_publishable_45cIqG4dGLSlev-rmNiVDg_uG8szVzD';
export const PHOTO_BASE = 'https://aksegkhhugqvvaidgvro.supabase.co/storage/v1/object/public/fp-photos/';

const TOKEN_KEY = 'fp_owner';
const FAN_KEY = 'fp_fan';

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
  401: '다시 로그인해 주세요. JUN LIVE 프로그램에서 "팬페이지 꾸미기"를 눌러 열어 주세요.',
  403: '이 작업은 할 수 없어요.',
  404: '찾을 수 없어요.',
  409: '다른 곳에서 바뀌었어요. 새로고침해 주세요.',
  413: '사진이나 글이 너무 커요.',
  429: '잠시 뒤에 다시 해 주세요.',
  503: '서버가 잠시 쉬고 있어요. 조금 뒤에 다시 해 주세요.',
};

export function photoUrl(p) {
  const s = String(p || '');
  if (/^(data:image\/|blob:|https:\/\/)/.test(s)) return s;
  return PHOTO_BASE + s.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
}

export function fanId() {
  let id = store.get(FAN_KEY);
  if (typeof id !== 'string' || id.length < 8) { id = uuid(); store.set(FAN_KEY, id); }
  return id;
}

export const auth = {
  get() {
    const t = store.get(TOKEN_KEY);
    if (!t || typeof t.token !== 'string') return null;
    if (t.expires && Date.parse(t.expires) < Date.now()) { store.remove(TOKEN_KEY); return null; }
    return t;
  },
  set(token, expires, slug) { store.set(TOKEN_KEY, { token, expires, ...(slug ? { slug } : {}) }); },
  clear() { store.remove(TOKEN_KEY); },
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

// owner: true = 토큰 꼭 필요, 'optional' = 있으면 붙임(DJ가 아직 공개 안 한 자기 페이지 글을 볼 때)
async function call(method, path, { query, body, owner = false, onProgress, timeout = 20000 } = {}) {
  const token = owner ? auth.get()?.token : null;
  if (owner === true && !token) throw new ApiError(STATUS_MESSAGE[401], 401);
  let status, json;
  if (isDemo()) {
    const m = await mock();
    ({ status, json } = await m.handle(method, path, query || {}, body, token, onProgress));
  } else if (onProgress && body) {
    ({ status, json } = await xhr(method, API_BASE + path + qs(query), body, token, onProgress, timeout));
  } else {
    const headers = { apikey: API_KEY };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeout);
    let res;
    try {
      res = await fetch(API_BASE + path + qs(query), { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl.signal, cache: 'no-store' });
    } catch (e) {
      throw new ApiError(e?.name === 'AbortError' ? '응답이 늦어요. 잠시 뒤에 다시 해 주세요.' : '인터넷 연결을 확인해 주세요.', 0);
    } finally { clearTimeout(timer); }
    status = res.status;
    try { json = await res.json(); } catch { json = null; }
  }
  if (status < 200 || status >= 300) {
    if (status === 401 && token) auth.clear();
    const msg = json && typeof json.error === 'string' && json.error ? json.error : STATUS_MESSAGE[status] || '문제가 생겼어요. 잠시 뒤에 다시 해 주세요.';
    throw new ApiError(msg, status);
  }
  return json || {};
}

function xhr(method, url, body, token, onProgress, timeout) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open(method, url);
    x.timeout = Math.max(timeout, 60000);
    x.setRequestHeader('apikey', API_KEY);
    x.setRequestHeader('Content-Type', 'application/json');
    if (token) x.setRequestHeader('Authorization', 'Bearer ' + token);
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    x.onload = () => { let json = null; try { json = JSON.parse(x.responseText); } catch { json = null; } resolve({ status: x.status, json }); };
    x.onerror = () => reject(new ApiError('인터넷 연결을 확인해 주세요.', 0));
    x.ontimeout = () => reject(new ApiError('응답이 늦어요. 잠시 뒤에 다시 해 주세요.', 0));
    x.send(JSON.stringify(body));
  });
}

export const api = {
  // 공개
  page: (slug) => call('GET', 'page', { query: { slug } }),
  home: (page) => call('GET', 'home', { query: { page } }),
  posts: ({ page, menu, category, before }) => call('GET', 'posts', { query: { page, menu, category, before } }),
  post: (id, page) => call('GET', 'post', { query: { id, page } }),
  comments: ({ page, menu, post, before }) => call('GET', 'comments', { query: { page, menu, post, before } }),
  comment: (b) => call('POST', 'comment', { body: { ...b, fan: fanId() } }),
  like: (post) => call('POST', 'like', { body: { post, fan: fanId() } }),
  attendance: (b) => call('POST', 'attendance', { body: b }),
  poll: ({ page, menu }) => call('GET', 'poll', { query: { page, menu, fan: fanId() } }),
  vote: (poll, option) => call('POST', 'vote', { body: { poll, option, fan: fanId() } }),
  storybox: (page) => call('GET', 'storybox', { query: { page } }),
  story: (b, onProgress) => call('POST', 'story', { body: { ...b, fan: fanId() }, onProgress, timeout: 90000 }),
  // DJ
  exchange: (code) => call('POST', 'owner/exchange', { body: { code } }),
  ownerPage: () => call('GET', 'owner/page', { owner: true }),
  savePage: (b) => call('POST', 'owner/page', { body: b, owner: true }),
  publish: () => call('POST', 'owner/publish', { body: {}, owner: true }),
  unpublish: () => call('POST', 'owner/unpublish', { body: {}, owner: true }),
  uploadPhoto: (b, onProgress) => call('POST', 'owner/photo', { body: b, owner: true, onProgress, timeout: 90000 }),
  savePost: (b) => call('POST', 'owner/post', { body: b, owner: true }),
  deletePost: (id) => call('POST', 'owner/post/delete', { body: { id }, owner: true }),
  ownerPosts: ({ page, menu, category, before }) => call('GET', 'owner/posts', { query: { page, menu, category, before }, owner: true }),
  ownerPoll: ({ page, menu }) => call('GET', 'owner/poll', { query: { page, menu }, owner: true }),
  ownerComments:({ menu, before }) => call('GET', 'owner/comments', { query: { menu, before }, owner: true }),
  ownerComment: (b) => call('POST', 'owner/comment', { body: b, owner: true }),
  deleteComment: (id) => call('POST', 'owner/comment/delete', { body: { id }, owner: true }),
  block: (comment) => call('POST', 'owner/block', { body: { comment }, owner: true }),
  createPoll: (b) => call('POST', 'owner/poll', { body: b, owner: true }),
  closePoll: (menu) => call('POST', 'owner/poll/close', { body: { menu }, owner: true }),
  ownerAttendance: (menu) => call('GET', 'owner/attendance', { query: { menu }, owner: true }),
};
