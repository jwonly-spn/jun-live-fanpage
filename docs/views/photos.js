// 사진 칸·넘겨보기·전체 화면 보기·메이슨리. 사진은 절대 자르지 않는다(contain + 같은 사진 흐리게 배경).
import { h, icon, clear } from '../lib/dom.js';
import { frameRatio, frameSize, masonry, columnsFor, FEED_CAP } from '../lib/photo.js';
import { photoUrl } from '../api.js';

function img(photo, { full = false, cls = 'frame-img', alt = '', lazy = true } = {}) {
  return h('img', {
    class: cls, src: photoUrl(full ? photo.path : photo.thumb || photo.path), alt,
    width: Math.round(photo.w) || 1, height: Math.round(photo.h) || 1,
    loading: lazy ? 'lazy' : null, decoding: 'async', draggable: 'false',
  });
}

// 한 장짜리 칸: 높이 = 폭×h/w (최대 폭×cap). 넘치면 전체가 보이게 + 옆은 흐린 같은 사진
export function framedPhoto(photo, { cap = FEED_CAP, alt = '', onOpen, label = '사진 크게 보기', badge } = {}) {
  const { ratio, capped } = frameRatio(photo.w, photo.h, cap);
  const tag = onOpen ? 'button' : 'div';
  const el = h(tag, { class: 'frame' + (capped ? ' capped' : ''), type: onOpen ? 'button' : null, 'aria-label': onOpen ? label : null, onclick: onOpen || null, style: { 'aspect-ratio': `1 / ${ratio.toFixed(5)}` } },
    capped ? img(photo, { cls: 'frame-blur' }) : null,
    img(photo, { alt }),
    badge ? h('span', { class: 'frame-badge' }, badge) : null,
    capped && onOpen ? h('span', { class: 'frame-hint' }, '누르면 전체 크기로 보기') : null);
  return el;
}

// 여러 장 넘겨보기. 칸 높이는 지금 사진 비율로 부드럽게 바뀐다.
export function carousel(photos, { onOpen, alt = '' } = {}) {
  let index = 0;
  const n = photos.length;
  const track = h('div', { class: 'car-track' });
  photos.forEach((p, i) => track.append(h('div', { class: 'car-slide', 'aria-roledescription': 'slide', 'aria-label': `${i + 1} / ${n}` },
    img(p, { cls: 'frame-blur' }), img(p, { alt: alt ? `${alt} (${i + 1}/${n})` : `사진 ${i + 1}/${n}`, lazy: i > 0 }))));
  const counter = n > 1 ? h('span', { class: 'frame-badge' }, `1/${n}`) : null;
  const prev = n > 1 ? h('button', { type: 'button', class: 'car-btn prev', 'aria-label': '이전 사진', onclick: (e) => { e.stopPropagation(); go(index - 1); } }, icon('back', { size: 18 })) : null;
  const next = n > 1 ? h('button', { type: 'button', class: 'car-btn next', 'aria-label': '다음 사진', onclick: (e) => { e.stopPropagation(); go(index + 1); } }, icon('next', { size: 18 })) : null;
  const tallHint = h('span', { class: 'frame-hint', hidden: true }, '누르면 전체 크기로 보기');
  const el = h('div', { class: 'carousel', role: 'region', 'aria-roledescription': 'carousel', 'aria-label': '사진', tabindex: '0', style: { 'aspect-ratio': `1 / ${frameRatio(photos[0].w, photos[0].h).ratio.toFixed(5)}` } }, track, counter, prev, next, tallHint);
  const dots = h('span', { class: 'dots', 'aria-hidden': 'true' }, photos.map(() => h('i')));
  const live = h('span', { class: 'sr-only', 'aria-live': 'polite' });
  el.append(live);

  let width = 0;
  function layout() {
    width = el.clientWidth || width;
    if (!width) return;
    const p = photos[index];
    const s = frameSize(width, p.w, p.h);
    el.style.height = s.height + 'px';
    tallHint.hidden = !(s.capped && onOpen);
  }
  function go(i, announce = true) {
    index = Math.max(0, Math.min(n - 1, i));
    track.style.transform = `translateX(${-index * 100}%)`;
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k === index));
    if (counter) counter.textContent = `${index + 1}/${n}`;
    if (prev) prev.disabled = index === 0;
    if (next) next.disabled = index === n - 1;
    if (announce && n > 1) live.textContent = `${index + 1}번째 사진`;
    layout();
  }
  new ResizeObserver(() => layout()).observe(el);

  // 손가락으로 넘기기
  let sx = 0, sy = 0, dx = 0, dragging = false, moved = false, pid = null;
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('.car-btn')) return;
    sx = e.clientX; sy = e.clientY; dx = 0; dragging = true; moved = false; pid = e.pointerId;
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== pid) return;
    dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (!moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { moved = true; el.setPointerCapture?.(pid); track.classList.add('dragging'); }
    if (moved && n > 1) track.style.transform = `translateX(calc(${-index * 100}% + ${dx}px))`;
  });
  const end = (e) => {
    if (!dragging || e.pointerId !== pid) return;
    dragging = false;
    track.classList.remove('dragging');
    if (moved) { if (Math.abs(dx) > Math.max(40, width * 0.15)) go(index + (dx < 0 ? 1 : -1)); else go(index, false); }
    else if (e.type === 'pointerup' && onOpen && !e.target.closest('.car-btn')) onOpen(index);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
    else if ((e.key === 'Enter' || e.key === ' ') && onOpen && e.target === el) { e.preventDefault(); onOpen(index); }
  });
  go(0, false);
  return { el, dots: n > 1 ? dots : null, go };
}

// 전체 화면 보기(<dialog>): 사진 전체, 넘기기, 닫기, Esc
export function openViewer(photos, start = 0, { caption = '' } = {}) {
  if (!photos?.length) return;
  let index = start;
  const opener = document.activeElement;
  const pic = h('img', { class: 'viewer-img', alt: '' });
  const count = h('span', { class: 'viewer-count', 'aria-live': 'polite' });
  const close = h('button', { type: 'button', class: 'viewer-btn close', 'aria-label': '닫기', onclick: () => dlg.close() }, icon('close', { size: 22 }));
  const prev = h('button', { type: 'button', class: 'viewer-btn prev', 'aria-label': '이전 사진', onclick: () => show(index - 1) }, icon('back', { size: 24 }));
  const next = h('button', { type: 'button', class: 'viewer-btn next', 'aria-label': '다음 사진', onclick: () => show(index + 1) }, icon('next', { size: 24 }));
  const stage = h('div', { class: 'viewer-stage' }, pic);
  const dlg = h('dialog', { class: 'viewer', 'aria-label': '사진 전체 보기' },
    stage, h('div', { class: 'viewer-bar' }, count, caption ? h('span', { class: 'viewer-cap' }, caption) : null), close,
    photos.length > 1 ? prev : null, photos.length > 1 ? next : null);
  function show(i) {
    index = Math.max(0, Math.min(photos.length - 1, i));
    const p = photos[index];
    pic.src = photoUrl(p.path);
    pic.width = p.w; pic.height = p.h;
    pic.alt = `${caption ? caption + ' ' : ''}사진 ${index + 1}/${photos.length}`;
    count.textContent = photos.length > 1 ? `${index + 1} / ${photos.length}` : '';
    prev.disabled = index === 0; next.disabled = index === photos.length - 1;
  }
  let sx = 0, sy = 0, pid = null;
  stage.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; pid = e.pointerId; });
  stage.addEventListener('pointerup', (e) => {
    if (e.pointerId !== pid) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(index + (dx < 0 ? 1 : -1));
    else if (dy > 110) dlg.close();
    else if (Math.abs(dx) < 6 && Math.abs(dy) < 6 && e.target === stage) dlg.close();
  });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'ArrowRight') show(index + 1);
  });
  dlg.addEventListener('close', () => { dlg.remove(); document.documentElement.classList.remove('no-scroll'); opener?.focus?.(); });
  document.body.append(dlg);
  document.documentElement.classList.add('no-scroll');
  show(start);
  dlg.showModal();
  close.focus();
}

// 메이슨리: 열 수는 칸 폭으로(휴대폰 2, 태블릿 3, PC 4), 각 칸은 사진 비율 그대로
export function masonryGrid(items, renderTile, { extra = 0.18 } = {}) {
  const el = h('div', { class: 'masonry' });
  let cols = 0;
  let list = items.slice();
  function layout(force = false) {
    const w = el.clientWidth;
    if (!w) return;
    const c = columnsFor(w);
    if (c === cols && !force) return;
    cols = c;
    clear(el);
    el.style.setProperty('--cols', c);
    const assign = masonry(list.map((it) => it.photo), c, extra);
    for (const idxs of assign) el.append(h('div', { class: 'm-col' }, idxs.map((i) => renderTile(list[i], i))));
  }
  new ResizeObserver(() => layout()).observe(el);
  el.setItems = (next) => { list = next.slice(); layout(true); };
  queueMicrotask(() => layout(true));
  return el;
}

export function photoTile(photo, { onOpen, label, title, badge, pinned }) {
  return h('figure', { class: 'tile' },
    h('button', { type: 'button', class: 'tile-btn', 'aria-label': label, onclick: onOpen, style: { 'aspect-ratio': `${Math.max(1, photo.w)} / ${Math.max(1, photo.h)}` } },
      img(photo, { alt: '' }),
      pinned ? h('span', { class: 'pin-badge' }, '고정') : null,
      badge ? h('span', { class: 'frame-badge' }, badge) : null),
    title ? h('figcaption', null, title) : null);
}

// 가로 줄(홈): 높이 고정, 폭 = 높이×w/h
export function photoStrip(items, { height = 150, onOpen }) {
  return h('div', { class: 'strip', style: { '--strip-h': height + 'px' } },
    items.map((it) => {
      const p = it.photo;
      return h('a', { class: 'strip-item', href: it.href, 'data-link': '', 'aria-label': it.label, onclick: onOpen ? (e) => onOpen(e, it) : null, style: { 'aspect-ratio': `${Math.max(1, p.w)} / ${Math.max(1, p.h)}` } }, img(p, { alt: '' }));
    }));
}
