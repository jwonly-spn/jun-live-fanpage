// 화면 도우미 — 모든 사용자 글은 textContent로만 넣는다(innerHTML 쓰지 않음).
import { THEMES } from './config.js';

const PROPS = new Set(['value', 'checked', 'disabled', 'hidden', 'selected', 'indeterminate', 'multiple']);

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') { for (const [p, val] of Object.entries(v)) if (val !== null && val !== undefined) el.style.setProperty(p, String(val)); }
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'ref') v(el);
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

export function clear(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

// 아이콘(고정 모양만)
const ICONS = {
  share: ['M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7', 'M12 3v12', 'M7 8l5-5 5 5'],
  headphone: ['M4 14v-2a8 8 0 0 1 16 0v2', 'rect:3,14,4,6', 'rect:17,14,4,6'],
  heart: ['M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z'],
  comment: ['M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z'],
  send: ['M21 3L10 14', 'M21 3l-7 18-4-7-7-4z'],
  back: ['M15 5l-7 7 7 7'],
  next: ['M9 5l7 7-7 7'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  plus: ['M12 5v14', 'M5 12h14'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13'],
  up: ['M12 19V5', 'M6 11l6-6 6 6'],
  down: ['M12 5v14', 'M6 13l6 6 6-6'],
  grip: ['dot:9,6', 'dot:15,6', 'dot:9,12', 'dot:15,12', 'dot:9,18', 'dot:15,18'],
  pin: ['M9 4h6l-1 6 4 3H6l4-3z', 'M12 13v7'],
  calendar: ['rect:3,5,18,16', 'M3 10h18', 'M8 3v4', 'M16 3v4'],
  link: ['M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1', 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'],
  eye: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z', 'circle:12,12,3'],
  eyeOff: ['M3 3l18 18', 'M10.6 6.1A10 10 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3 3.6', 'M6.6 6.6A17 17 0 0 0 2 12s3.6 6 10 6a9.7 9.7 0 0 0 4.4-1'],
  check: ['M5 12l5 5 9-10'],
  photo: ['rect:3,5,18,14', 'circle:9,10,2', 'M21 16l-5-5-8 8'],
};

const SVGNS = 'http://www.w3.org/2000/svg';
export function icon(name, { size = 20, fill = 'none', label } = {}) {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', fill);
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  if (label) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label); } else svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const d of ICONS[name] || []) {
    let node;
    if (d.startsWith('rect:')) {
      const [x, y, w, hh] = d.slice(5).split(',');
      node = document.createElementNS(SVGNS, 'rect');
      Object.entries({ x, y, width: w, height: hh, rx: 1.5 }).forEach(([k, v]) => node.setAttribute(k, v));
    } else if (d.startsWith('circle:')) {
      const [cx, cy, r] = d.slice(7).split(',');
      node = document.createElementNS(SVGNS, 'circle');
      Object.entries({ cx, cy, r }).forEach(([k, v]) => node.setAttribute(k, v));
    } else if (d.startsWith('dot:')) {
      const [cx, cy] = d.slice(4).split(',');
      node = document.createElementNS(SVGNS, 'circle');
      Object.entries({ cx, cy, r: 1.6, fill: 'currentColor', stroke: 'none' }).forEach(([k, v]) => node.setAttribute(k, v));
    } else {
      node = document.createElementNS(SVGNS, 'path');
      node.setAttribute('d', d);
    }
    svg.append(node);
  }
  return svg;
}

export function applyTheme(el, themeId) {
  const t = THEMES[themeId] || THEMES.rose;
  const map = { accent: t.accent, 'on-accent': t.onAccent, paper: t.paper, card: t.card, ink: t.ink, muted: t.muted, line: t.line, soft: t.soft, bright: t.bright, 'accent-text': t.accentText };
  for (const [k, v] of Object.entries(map)) el.style.setProperty('--' + k, v);
  el.style.setProperty('color-scheme', t.dark ? 'dark' : 'light');
  el.dataset.theme = themeId in THEMES ? themeId : 'rose';
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

// 확인 창(<dialog>) — Promise<boolean>
export function confirmDialog(message, { ok = '확인', cancel = '취소', danger = false, detail = '' } = {}) {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: 'confirm', 'aria-labelledby': 'cf-title' },
      h('form', { method: 'dialog', class: 'confirm-body' },
        h('p', { id: 'cf-title', class: 'confirm-title' }, message),
        detail ? h('p', { class: 'confirm-detail' }, detail) : null,
        h('div', { class: 'confirm-actions' },
          h('button', { type: 'submit', value: 'no', class: 'btn btn-line' }, cancel),
          h('button', { type: 'submit', value: 'yes', class: 'btn ' + (danger ? 'btn-danger' : 'btn-dark') }, ok))));
    document.body.append(dlg);
    dlg.addEventListener('close', () => { resolve(dlg.returnValue === 'yes'); dlg.remove(); });
    dlg.showModal();
  });
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = h('textarea', { class: 'sr-only', 'aria-hidden': 'true' });
    ta.value = text; document.body.append(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove(); return ok;
  }
}

export function downloadFile(name, text, type = 'text/calendar') {
  const url = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' }));
  const a = h('a', { href: url, download: name, class: 'sr-only' });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function debounce(fn, ms) {
  let t = 0;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.cancel = () => clearTimeout(t);
  return d;
}

// 글자 수 세는 입력칸
export function field({ label, value = '', max, multiline = false, rows = 3, placeholder = '', id, onInput, type = 'text', hint, required, autocomplete, inputmode, pattern }) {
  const fid = id || 'f_' + Math.random().toString(36).slice(2, 9);
  const counter = max ? h('span', { class: 'counter', 'aria-hidden': 'true' }) : null;
  const input = multiline
    ? h('textarea', { id: fid, rows, placeholder, maxlength: max, required })
    : h('input', { id: fid, type, placeholder, maxlength: max, required, autocomplete, inputmode, pattern });
  input.value = value ?? '';
  const upd = () => { if (counter) counter.textContent = `${Array.from(input.value).length} / ${max}`; };
  upd();
  input.addEventListener('input', () => { upd(); onInput?.(input.value, input); });
  const hintId = hint ? fid + '_hint' : null;
  if (hintId) input.setAttribute('aria-describedby', hintId);
  const wrap = h('div', { class: 'field' },
    h('div', { class: 'field-top' }, h('label', { for: fid }, label), counter),
    input,
    hint ? h('p', { class: 'field-hint', id: hintId }, hint) : null);
  wrap.input = input;
  return wrap;
}

export function toggle({ label, checked, onChange, hint }) {
  const input = h('input', { type: 'checkbox', checked: !!checked });
  input.addEventListener('change', () => onChange?.(input.checked));
  return h('label', { class: 'toggle' }, input, h('span', null, label, hint ? h('small', null, hint) : null));
}
