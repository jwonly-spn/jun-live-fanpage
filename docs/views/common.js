// 화면 공통 조각: 사이트 이름, 맨 위(비공식 한 줄 · 머리줄), 바닥글, 칸 제목, 순위 배지, 사이트 안 링크, 불러오기 표시, 오류 상자, 공유.
// 모습(2026-10-18 새 구조): 밝은 아이보리 바탕 · 먹색 글 · 장밋빛 하트 — SNS 처럼 큰 사진 카드(views/feed.js). 옆으로 넘기는 화살표 줄(rail)은 없앴다.
// 장식 그림 파일 없음 — 모양은 모두 styles.css(보안 규칙상 style 속성을 쓰지 않는다).
import { h, icon, toast, copyText } from '../lib/dom.js';
import { getMe } from '../lib/me.js';

// 사이트 이름(2026-10-08 사용자: "스푼 DJ 키우기" + 맨 위·아래에 비공식 표시)
export const BRAND = '스푼 DJ 키우기';
export const UNOFFICIAL = '스푼 공식 서비스가 아니에요';
export const DISCLAIMER = '스푼 DJ 키우기는 청취자들이 방송에서 키운 DJ 캐릭터를 모아 보는 비공식 팬 사이트예요. 스푼(Spoon)이 만든 서비스가 아니고, 스푼과 제휴 관계도 아니에요.';

// 사이트 안 링크(app.js가 가로채서 새로고침 없이 이동)
export function ilink(href, props, ...children) {
  return h('a', { ...props, href, 'data-link': '' }, ...children);
}

// 맨 위: 비공식 한 줄 + 머리줄(로고 · 찾기 · 옷 도감 · 그 페이지 단추). 머리줄은 화면 위에 붙어 있다(styles.css).
// actions = 오른쪽 끝에 더할 요소 목록(예: 공유 단추)
export function nightTop(app, { actions = [] } = {}) {
  const route = typeof document !== 'undefined' ? document.body?.dataset?.route : '';
  const home = app.link({ name: 'intro' });
  let me = null;
  try { me = getMe(window.localStorage); } catch { me = null; }
  return [
    h('p', { class: 'kg-unofficial' }, UNOFFICIAL),
    h('header', { class: 'fp-top' },
      h('div', { class: 'fp-top-in' },
        ilink(home, { class: 'fp-brand', 'aria-label': `${BRAND} 처음으로` },
          h('span', { class: 'fp-logo', 'aria-hidden': 'true' }, icon('headphones', { size: 17 })),
          h('span', { class: 'fp-brand-name' }, BRAND)),
        h('nav', { class: 'fp-actions', 'aria-label': '바로 가기' },
          ilink(home + '#find', { class: 'fp-nav icon-only', 'aria-label': '아이디로 찾기' }, icon('search', { size: 19 })),
          // 내 캐릭터(이 브라우저에 정해 둔 것 — lib/me.js)가 있으면 어느 화면에서든 한 번에
          me ? ilink(app.link({ name: 'character', slug: me.slug, base: me.base }), { class: 'fp-nav icon-only fp-me', 'aria-label': `내 캐릭터 ${me.id}`, 'aria-current': route === 'character' && location.pathname === app.link({ name: 'character', slug: me.slug, base: me.base }) ? 'page' : null }, icon('user', { size: 19 })) : null,
          ilink(app.link({ name: 'items' }), { class: 'fp-nav', 'aria-current': route === 'items' ? 'page' : null }, icon('hanger', { size: 19 }), h('span', null, '옷 도감')),
          ...actions))),
  ];
}

// 바닥글: 사이트 이름·바로 가기 · 그 페이지의 안내 줄 · 비공식 안내
export function siteFoot(app, ...lines) {
  return h('footer', { class: 'fp-foot' },
    h('div', { class: 'fp-foot-in' },
      h('div', { class: 'fp-foot-top' },
        ilink(app.link({ name: 'intro' }), { class: 'fp-foot-brand' }, h('span', { class: 'fp-logo small', 'aria-hidden': 'true' }, icon('headphones', { size: 14 })), BRAND),
        h('nav', { class: 'fp-foot-links', 'aria-label': '바닥 바로 가기' },
          ilink(app.link({ name: 'intro' }), null, '처음으로'),
          ilink(app.link({ name: 'items' }), null, '옷 도감'))),
      ...lines.filter(Boolean).map((t) => h('p', { class: 'fp-foot-note' }, t)),
      h('p', { class: 'fp-foot-legal' }, DISCLAIMER)));
}

// 칸 제목 줄: 제목 · 한 줄 설명 · 오른쪽(링크나 넘기기 단추)
export function secHead(title, sub = '', action = null, { id = null, level = 'h2' } = {}) {
  return h('div', { class: 'kg-sec-head' },
    h('div', { class: 'kg-sec-titles' },
      h(level, { class: 'sec-title', id }, title),
      sub ? h('p', null, sub) : null),
    action);
}

// 순위 배지: 1·2·3등은 금·은·동 색 작은 동그라미, 그 밖은 옅은 동그라미. 글자는 그대로 읽힌다.
export function medal(n, { className = '', label = null } = {}) {
  const tier = n === 1 ? 'm1' : n === 2 ? 'm2' : n === 3 ? 'm3' : 'mx';
  return h('span', { class: `kg-medal ${tier}${className ? ' ' + className : ''}`, 'aria-label': label }, String(n));
}

// 숫자 묶음 한 줄: [{value, label}]
export function statTiles(list) {
  return list.filter(Boolean).map((s) => h('div', { class: 'kg-stat' },
    h('span', { class: 'kg-stat-v' }, s.value),
    h('span', { class: 'kg-stat-l' }, s.label)));
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
