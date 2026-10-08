// 화면 공통 조각: 사이트 이름, 머리줄(비공식 한 줄 · 로고 · 바로 가기), 바닥글, 칸 제목, 사이트 안 링크, 불러오기 표시, 오류 상자, 공유, 문장(crest)·숫자 칸.
// 모습(2026-10-09): 짙은 남색 + 금색 테두리의 게임 화면 느낌. 장식은 모두 styles.css(그림 파일 없음).
import { h, icon, toast, copyText } from '../lib/dom.js';

// 사이트 이름(2026-10-08 사용자: "스푼 DJ 키우기" + 맨 위·아래에 비공식 표시)
export const BRAND = '스푼 DJ 키우기';
export const UNOFFICIAL = '스푼 공식 서비스가 아니에요';
export const DISCLAIMER = '스푼 DJ 키우기는 청취자들이 방송에서 키운 DJ 캐릭터를 모아 보는 비공식 팬 사이트예요. 스푼(Spoon)이 만든 서비스가 아니고, 스푼과 제휴 관계도 아니에요.';

// 사이트 안 링크(app.js가 가로채서 새로고침 없이 이동)
export function ilink(href, props, ...children) {
  return h('a', { ...props, href, 'data-link': '' }, ...children);
}

// 밤하늘 띠의 맨 위: 비공식 한 줄 + 머리줄(로고 · 오른쪽 단추들). actions = 요소 목록
export function nightTop(app, { actions = [] } = {}) {
  const onItems = typeof document !== 'undefined' && document.body?.dataset?.route === 'items';
  return [
    h('p', { class: 'kg-unofficial' }, UNOFFICIAL),
    h('header', { class: 'fp-top' },
      ilink(app.link({ name: 'intro' }), { class: 'fp-brand', 'aria-label': `${BRAND} 처음으로` },
        h('span', { class: 'fp-logo', 'aria-hidden': 'true' }, icon('headphones', { size: 18 })),
        h('span', { class: 'fp-brand-text' }, h('span', { class: 'fp-brand-name' }, BRAND), h('span', { class: 'fp-brand-sub' }, '비공식 팬 사이트'))),
      h('nav', { class: 'fp-actions', 'aria-label': '바로 가기' },
        ilink(app.link({ name: 'items' }), { class: 'fp-nav', 'aria-current': onItems ? 'page' : null }, icon('book', { size: 18 }), h('span', null, '옷 도감')),
        ...actions)),
  ];
}

// 바닥글: 그 페이지의 안내 줄 + 사이트 이름·비공식 안내
export function siteFoot(app, ...lines) {
  return h('footer', { class: 'fp-foot' },
    h('div', { class: 'fp-foot-in' },
      h('span', { class: 'fp-foot-crest', 'aria-hidden': 'true' }),
      ...lines.filter(Boolean).map((t) => h('p', null, t)),
      h('p', { class: 'fp-foot-brand' }, ilink(app.link({ name: 'intro' }), null, BRAND), h('span', { class: 'fp-foot-dot', 'aria-hidden': 'true' }), ilink(app.link({ name: 'items' }), null, '옷 도감')),
      h('p', { class: 'fp-foot-legal' }, DISCLAIMER)));
}

// 칸 제목 줄: (작은 영문 머리글) · 제목 · 한 줄 설명 · 오른쪽 링크
export function secHead(title, sub = '', action = null, { id = null, level = 'h2', kicker = '' } = {}) {
  return h('div', { class: 'kg-sec-head' },
    h('div', { class: 'kg-sec-titles' },
      kicker ? h('span', { class: 'kg-kicker', 'aria-hidden': 'true' }, kicker) : null,
      h(level, { class: 'sec-title', id }, title),
      sub ? h('p', null, sub) : null),
    action);
}

// 순위 문장(1~3등은 금·은·동, 그 밖은 강철색). 글자는 그대로 읽힌다.
export function crest(n, { className = '', label = null } = {}) {
  const tier = n === 1 ? 'r1' : n === 2 ? 'r2' : n === 3 ? 'r3' : 'r4';
  return h('span', { class: `kg-crest ${tier}${className ? ' ' + className : ''}`, 'aria-label': label },
    h('span', { class: 'kg-crest-in' }, String(n)));
}

// 숫자 칸 한 줄(첫 화면 아래 숫자 묶음): [{value, label}]
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
