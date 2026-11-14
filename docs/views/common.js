// 화면 공통 조각: 사이트 이름, 맨 위(공지 · 비공식 한 줄 · 머리줄), 바닥글, 칸 제목, 사이트 안 링크, 불러오기 표시, 오류 상자, 공유.
// 모습(2026-11-15 시즌 2 "몬스터 영토전"): 오래된 지도 종이 같은 바탕 · 먹색 글 · 붉은 밤색 강조 하나. 지도는 밝은·어두운 화면 모두 같은 종이 색.
// 모양은 styles.css. style 속성은 쓰지 않는다(보안 규칙).
import { h, icon, toast, copyText } from '../lib/dom.js';

// 사이트 이름(2026-10-08 사용자: "스푼 DJ 키우기" + 맨 위·아래에 비공식 표시)
export const BRAND = '스푼 DJ 키우기';
export const SEASON_TITLE = '몬스터 영토전';
export const UNOFFICIAL = '스푼 공식 서비스가 아니에요';
export const DISCLAIMER = '스푼 DJ 키우기는 먼치킨을 쓰는 DJ 방송들의 몬스터 영토전 지도와 청취자가 키운 몬스터를 모아 보는 비공식 팬 사이트예요. 스푼(Spoon)이 만든 서비스가 아니고, 스푼과 제휴 관계도 아니에요.';

// 사이트 안 링크(app.js가 가로채서 새로고침 없이 이동)
export function ilink(href, props, ...children) {
  return h('a', { ...props, href, 'data-link': '' }, ...children);
}

// 공지(2026-10-18 사용자 "키우기 페이지 제일 상단에 공지 쓸 수 있도록"): docs/notice.json 을 고쳐 올리면 모든 화면 맨 위에 한 줄로 나온다.
//  {id, text, from?, until} — 글이 비었거나 from(ISO 시각) 전이거나 until 이 지나면 안 보인다(from 은 2026-11-15 더함 — 미리 올려 두는 시즌 시작 공지).
//  ×로 닫으면 이 브라우저에서는 그 공지(id)를 다시 안 보인다.
//  GitHub Pages 가 파일을 10분쯤 기억하므로 1분마다 다른 주소(?t=)로 받는다. 글은 글자로만 넣는다(HTML 아님). 한 화면 묶음에서 한 번만 받는다.
export const NOTICE_FILE = 'notice.json', NOTICE_CLOSED = 'kg_notice_closed', NOTICE_MAX = 140;
export function parseNotice(j, now = Date.now()) {
  if (!j || typeof j !== 'object' || typeof j.text !== 'string') return null;
  const text = j.text.replace(/\s+/g, ' ').trim().slice(0, NOTICE_MAX);
  if (!text) return null;
  const until = typeof j.until === 'string' ? Date.parse(j.until) : NaN;
  if (Number.isFinite(until) && now > until) return null;
  const from = typeof j.from === 'string' ? Date.parse(j.from) : NaN;
  if (Number.isFinite(from) && now < from) return null;
  return { id: typeof j.id === 'string' && j.id.trim() ? j.id.trim().slice(0, 40) : text, text };
}
let noticeJob = null;
function loadNotice(base) {
  if (!noticeJob) noticeJob = fetch(`${base}${NOTICE_FILE}?t=${Math.floor(Date.now() / 60000)}`, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null)).then((j) => parseNotice(j)).catch(() => null);
  return noticeJob;
}
function noticeBar(app) {
  const host = h('div', { class: 'kg-topnote', role: 'status', hidden: true });
  if (typeof fetch !== 'function') return host;
  loadNotice(app.base || '/').then((n) => {
    let closed = null;
    try { closed = window.localStorage.getItem(NOTICE_CLOSED); } catch { closed = null; }
    if (!n || closed === n.id) return;
    host.replaceChildren(
      h('div', { class: 'kg-topnote-in' },
        h('span', { class: 'kg-topnote-tag' }, '공지'),
        h('p', { class: 'kg-topnote-text' }, n.text),
        h('button', { type: 'button', class: 'kg-topnote-x', 'aria-label': '공지 닫기', onclick: () => {
          try { window.localStorage.setItem(NOTICE_CLOSED, n.id); } catch { /* 이번 창에서만 */ }
          host.hidden = true;
        } }, icon('close', { size: 16 }))));
    host.hidden = false;
  });
  return host;
}

// 맨 위: 공지(있을 때만) + 비공식 한 줄 + 머리줄(로고 · 찾기 · 지도 · 몬스터 도감). 머리줄(header)은 늘 마지막 — 다시 그릴 때는 nightTop(…).at(-1)
export function nightTop(app) {
  const route = typeof document !== 'undefined' ? document.body?.dataset?.route : '';
  const home = app.link({ name: 'home' });
  return [
    noticeBar(app),
    h('p', { class: 'kg-unofficial' }, UNOFFICIAL),
    h('header', { class: 'fp-top' },
      h('div', { class: 'fp-top-in' },
        ilink(home, { class: 'fp-brand', 'aria-label': `${BRAND} 처음으로` },
          h('span', { class: 'fp-logo', 'aria-hidden': 'true' }, icon('flag', { size: 17 })),
          h('span', { class: 'fp-brand-name' }, BRAND)),
        h('nav', { class: 'fp-actions', 'aria-label': '바로 가기' },
          ilink(home + '#find', { class: 'fp-nav icon-only', 'aria-label': '아이디로 몬스터 찾기' }, icon('search', { size: 19 })),
          ilink(home, { class: 'fp-nav', 'aria-current': route === 'home' ? 'page' : null }, icon('map', { size: 19 }), h('span', null, '지도')),
          ilink(app.link({ name: 'dex' }), { class: 'fp-nav', 'aria-current': route === 'dex' ? 'page' : null }, icon('book', { size: 19 }), h('span', null, '몬스터 도감'))))),
  ];
}

// 바닥글: 사이트 이름·바로 가기 · 그 페이지의 안내 줄 · 비공식 안내
export function siteFoot(app, ...lines) {
  return h('footer', { class: 'fp-foot' },
    h('div', { class: 'fp-foot-in' },
      h('div', { class: 'fp-foot-top' },
        ilink(app.link({ name: 'home' }), { class: 'fp-foot-brand' }, h('span', { class: 'fp-logo small', 'aria-hidden': 'true' }, icon('flag', { size: 14 })), BRAND),
        h('nav', { class: 'fp-foot-links', 'aria-label': '바닥 바로 가기' },
          ilink(app.link({ name: 'home' }), null, '영토 지도'),
          ilink(app.link({ name: 'dex' }), null, '몬스터 도감'))),
      ...lines.filter(Boolean).map((t) => h('p', { class: 'fp-foot-note' }, t)),
      h('p', { class: 'fp-foot-legal' }, DISCLAIMER)));
}

// 칸 제목 줄: 제목 · 한 줄 설명 · 오른쪽(링크 등)
export function secHead(title, sub = '', action = null, { id = null, level = 'h2' } = {}) {
  return h('div', { class: 'kg-sec-head' },
    h('div', { class: 'kg-sec-titles' },
      h(level, { class: 'sec-title', id }, title),
      sub ? h('p', null, sub) : null),
    action);
}

export function loading(text = '불러오는 중…') {
  return h('div', { class: 'loading', role: 'status', 'aria-live': 'polite' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), text);
}

export function errorBox(message, retry) {
  return h('div', { class: 'error-box', role: 'alert' },
    h('p', null, message),
    retry ? h('button', { type: 'button', class: 'btn btn-line', onclick: retry }, '다시 해 보기') : null);
}

export async function share(url, title) {
  if (navigator.share) {
    try { await navigator.share({ title, url }); return; } catch (e) { if (e?.name === 'AbortError') return; }
  }
  if (await copyText(url)) toast('주소를 복사했어요. 원하는 곳에 붙여 넣어 주세요.');
  else toast('주소를 복사하지 못했어요.', 'error');
}
