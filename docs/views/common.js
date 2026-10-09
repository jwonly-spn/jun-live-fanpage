// 화면 공통 조각: 사이트 이름, 맨 위(비공식 한 줄 · 머리줄), 바닥글, 칸 제목, 순위 배지, 옆으로 넘기는 줄(rail), 사이트 안 링크, 불러오기 표시, 오류 상자, 공유.
// 모습(2026-10-09 두 번째 새 디자인): 거의 검정 바탕 + 아이보리 글 + 할로윈 주황 하나만 조금. 캐릭터가 주인공인 패션 잡지·컬렉션 앱 느낌.
// 장식 그림 파일 없음 — 모양은 모두 styles.css(보안 규칙상 style 속성을 쓰지 않는다).
import { h, icon, toast, copyText } from '../lib/dom.js';

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
  return [
    h('p', { class: 'kg-unofficial' }, UNOFFICIAL),
    h('header', { class: 'fp-top' },
      h('div', { class: 'fp-top-in' },
        ilink(home, { class: 'fp-brand', 'aria-label': `${BRAND} 처음으로` },
          h('span', { class: 'fp-logo', 'aria-hidden': 'true' }, icon('headphones', { size: 17 })),
          h('span', { class: 'fp-brand-name' }, BRAND)),
        h('nav', { class: 'fp-actions', 'aria-label': '바로 가기' },
          ilink(home + '#find', { class: 'fp-nav icon-only', 'aria-label': '아이디로 찾기' }, icon('search', { size: 19 })),
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

// 옆으로 넘기는 줄: 손가락으로 넘기고, 넓은 화면에서는 ‹ › 단추로도(칸 제목 오른쪽에 둔다).
// → {track(줄), controls(단추 묶음)}. 끝에 닿으면 그쪽 단추를 끈다.
export function rail(children, { label = '', className = '' } = {}) {
  const track = h('div', { class: 'kg-rail' + (className ? ' ' + className : ''), role: 'list', 'aria-label': label || null },
    ...children.map((c) => h('div', { class: 'kg-rail-item', role: 'listitem' }, c)));
  const step = (dir) => () => track.scrollBy({ left: dir * Math.max(200, track.clientWidth * 0.85), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  const prev = h('button', { type: 'button', class: 'kg-rail-btn', 'aria-label': `${label} 앞으로`, onclick: step(-1) }, icon('chevron-left', { size: 18 }));
  const next = h('button', { type: 'button', class: 'kg-rail-btn', 'aria-label': `${label} 다음으로`, onclick: step(1) }, icon('chevron-right', { size: 18 }));
  const sync = () => {
    const max = track.scrollWidth - track.clientWidth - 2;
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= max;
    controls.hidden = max <= 0;
  };
  const controls = h('div', { class: 'kg-rail-ctl' }, prev, next);
  track.addEventListener('scroll', sync, { passive: true });
  if (typeof ResizeObserver === 'function') new ResizeObserver(sync).observe(track);
  requestAnimationFrame(sync);
  return { track, controls };
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
