// 화면 도우미 — 모든 글은 textContent로만 넣는다(innerHTML 쓰지 않음). 색은 styles.css 의 :root 에 있다.

const PROPS = new Set(['value', 'checked', 'disabled', 'hidden', 'selected']);

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (PROPS.has(k)) el[k] = v;
      else if ((k === 'href' || k === 'src') && /^\s*(javascript|vbscript):/i.test(String(v))) continue;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false || c === true) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// 아이콘(고정 모양만). filled: 속을 채운 모양(하트 등)
const ICONS = {
  share: ['M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7', 'M12 3v12', 'M7 8l5-5 5 5'],
  search: ['M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z', 'M21 21l-5.2-5.2'],
  arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
  'chevron-left': ['M15 5l-7 7 7 7'],
  'chevron-right': ['M9 5l7 7-7 7'],
  book: ['M4 19V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2v0a2 2 0 0 0 2 2h14', 'M8 7h8'],
  hanger: ['M10 6a2 2 0 1 1 2 2v1.2', 'M12 9.2 3.6 15a1.2 1.2 0 0 0 .7 2.2h15.4a1.2 1.2 0 0 0 .7-2.2L12 9.2Z'],
  heart: ['M12 20.2s-7.6-4.5-7.6-10.4A4.3 4.3 0 0 1 12 7.1a4.3 4.3 0 0 1 7.6 2.7c0 5.9-7.6 10.4-7.6 10.4Z'],
  link: ['M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1', 'M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1'],
  download: ['M12 4v11', 'M7 10.5l5 5 5-5', 'M5 20h14'],
  headphones: ['M4 15v-3a8 8 0 0 1 16 0v3', 'M4 15a2 2 0 0 1 2-2h1v7H6a2 2 0 0 1-2-2Z', 'M20 15a2 2 0 0 0-2-2h-1v7h1a2 2 0 0 0 2-2Z'],
  copy: ['M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1Z', 'M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1'],
  undo: ['M9 14 4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  // 2026-10-18 새 구조: 연속 방문(불꽃) · 더하기 · 확인 · 내 캐릭터 · 왕관(오늘의 주인공) · 반짝(달라진 것)
  flame: ['M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.2 2.2-5.3 3.7-7.3.3 1.9 1.2 3 2.3 3.6.2-3 1.6-5.6 4.1-7.6-.3 2.8.8 4.6 2.2 6.4 1.2 1.6 1.7 3.1 1.7 4.9 0 3.6-2.6 6.2-7.5 6.2Z'],
  plus: ['M12 5v14', 'M5 12h14'],
  check: ['M5 12.5l4.2 4.2L19 7'],
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4.5 20.5c1.4-3.6 4.2-5.5 7.5-5.5s6.1 1.9 7.5 5.5'],
  crown: ['M4 18h16', 'M4.5 15 3 7l5 3.5L12 5l4 5.5L21 7l-1.5 8h-15Z'],
  sparkle: ['M12 3v4', 'M12 17v4', 'M3 12h4', 'M17 12h4', 'M12 8.5 13.4 10.6 15.5 12 13.4 13.4 12 15.5 10.6 13.4 8.5 12 10.6 10.6Z'],
  // 즐겨찾기(별 — 넣으면 채운 별)
  star: ['M12 3.8l2.5 5.1 5.6.8-4.05 3.95.96 5.58L12 16.6l-5.01 2.63.96-5.58L3.9 9.7l5.6-.8L12 3.8Z'],
  // 2026-10-19: 잠긴 표정(자물쇠) · 표정(웃는 얼굴)
  lock: ['M7 11V8a5 5 0 0 1 10 0v3', 'M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z'],
  smile: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8', 'M9 9.5h.01', 'M15 9.5h.01'],
};

const SVGNS = 'http://www.w3.org/2000/svg';
export function icon(name, { size = 20, label, filled = false } = {}) {
  const svg = document.createElementNS(SVGNS, 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: size, height: size, fill: filled ? 'currentColor' : 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', focusable: 'false' })) svg.setAttribute(k, v);
  if (label) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label); } else svg.setAttribute('aria-hidden', 'true');
  for (const d of ICONS[name] || []) {
    const path = document.createElementNS(SVGNS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

// 저장소(사생활 모드 등에서 실패해도 괜찮게)
export const store = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  },
  remove(key) { try { localStorage.removeItem(key); } catch { /* 무시 */ } },
};

// 알림(화면 아래 잠깐)
let toastEl = null, toastTimer = 0;
export function toast(message, kind = 'info') {
  if (!toastEl) {
    toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(toastEl);
  }
  toastEl.textContent = message;
  toastEl.dataset.kind = kind;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = h('textarea', { class: 'sr-only', 'aria-hidden': 'true' });
    ta.value = text; document.body.append(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove(); return ok;
  }
}
