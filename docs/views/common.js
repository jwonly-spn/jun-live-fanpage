// 팬 화면 공통 조각: 링크, 댓글, 좋아요, 공유, 불러오기 표시.
import { h, icon, store, toast, copyText, field } from '../lib/dom.js';
import { initial, relativeTime, charCount } from '../lib/text.js';
import { kstDate } from '../lib/days.js';
import { api, photoUrl } from '../api.js';
import { LIMITS } from '../lib/config.js';

// 사이트 안 링크(app.js가 가로채서 새로고침 없이 이동)
export function ilink(href, props, ...children) {
  return h('a', { ...props, href, 'data-link': '' }, ...children);
}

export function extLink(href, props, ...children) {
  return h('a', { ...props, href, target: '_blank', rel: 'noopener noreferrer' }, ...children);
}

export function loading(text = '불러오는 중…') {
  return h('div', { class: 'loading', role: 'status', 'aria-live': 'polite' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), text);
}

export function errorBox(message, retry) {
  return h('div', { class: 'error-box', role: 'alert' },
    h('p', null, message),
    retry ? h('button', { type: 'button', class: 'btn btn-line', onclick: retry }, '다시 해 보기') : null);
}

export function empty(text) {
  return h('p', { class: 'empty' }, text);
}

export function sectionHead(title, { href, more = '전체 보기', sub, level = 'h2' } = {}) {
  return h('div', { class: 'sec-head' },
    h('div', { class: 'sec-title-row' },
      h(level, { class: 'sec-title' }, title),
      href ? ilink(href, { class: 'sec-more' }, more) : null),
    sub ? h('p', { class: 'sec-sub' }, sub) : null);
}

export function avatar(config, size = 'md') {
  const p = config.profile;
  if (p.avatar) {
    return h('span', { class: `avatar ${size}` },
      h('img', { class: 'avatar-blur', src: photoUrl(p.avatar.thumb), alt: '', 'aria-hidden': 'true' }),
      h('img', { class: 'avatar-img', src: photoUrl(p.avatar.thumb), alt: `${p.name} 프로필 사진`, width: p.avatar.w, height: p.avatar.h }));
  }
  return h('span', { class: `avatar ${size} letter`, 'aria-hidden': 'true' }, initial(p.name));
}

export async function share(url, title) {
  if (navigator.share) {
    try { await navigator.share({ title, url }); return; } catch (e) { if (e?.name === 'AbortError') return; }
  }
  if (await copyText(url)) toast('주소를 복사했어요. 원하는 곳에 붙여 넣어 주세요.');
  else toast('주소를 복사하지 못했어요.', 'error');
}

// ---- 오늘 할 일(이 기기에서만, 오늘 날짜 기준) ----
export function missionKey(pageId) { return `fp_mission:${pageId}:${kstDate()}`; }
export function markMission(pageId, key) {
  const k = missionKey(pageId);
  const m = store.get(k, {}) || {};
  m[key] = true;
  store.set(k, m);
}
export function missions(pageId) { return store.get(missionKey(pageId), {}) || {}; }

// ---- 좋아요 ----
const LIKED = 'fp_liked';
function likedSet() { const a = store.get(LIKED, []); return new Set(Array.isArray(a) ? a : []); }
export function likeButton(post, { onChange } = {}) {
  let liked = likedSet().has(post.id);
  let likes = Number(post.likes) || 0;
  const btn = h('button', { type: 'button', class: 'icon-btn like', 'aria-pressed': String(liked), 'aria-label': '좋아요' }, icon('heart', { size: 24, fill: liked ? 'currentColor' : 'none' }));
  const paint = () => {
    btn.setAttribute('aria-pressed', String(liked));
    btn.classList.toggle('on', liked);
    btn.querySelector('svg').setAttribute('fill', liked ? 'currentColor' : 'none');
    onChange?.(likes, liked);
  };
  btn.addEventListener('click', async () => {
    if (btn.dataset.busy) return;
    btn.dataset.busy = '1';
    const before = [liked, likes];
    liked = !liked; likes += liked ? 1 : -1; paint();
    try {
      const r = await api.like(post.id);
      liked = !!r.liked; likes = Number(r.likes) || 0;
      const s = likedSet(); if (liked) s.add(post.id); else s.delete(post.id);
      store.set(LIKED, [...s].slice(-500));
    } catch (e) { [liked, likes] = before; toast(e.message, 'error'); }
    delete btn.dataset.busy;
    paint();
  });
  queueMicrotask(paint);
  return btn;
}

// ---- 댓글 ----
export function commentItem(c) {
  return h('article', { class: 'comment' },
    h('div', { class: 'comment-head' },
      h('span', { class: 'bubble', 'aria-hidden': 'true' }, initial(c.nickname)),
      h('b', null, c.nickname),
      h('time', { datetime: c.created }, relativeTime(c.created))),
    h('p', { class: 'comment-body' }, c.body),
    c.hearted ? h('span', { class: 'hearted' }, '♡ DJ가 마음을 남겼어요') : null,
    c.reply ? h('div', { class: 'reply' }, h('b', null, 'DJ의 답글'), ' · ', c.reply) : null);
}

const NICK = 'fp_nick';
export function commentForm(ctx, menu, { post = null, onPosted, label = '한마디', placeholder = '짧은 응원도 오래 기억할게요', id } = {}) {
  const status = h('p', { class: 'form-status', role: 'status', 'aria-live': 'polite' });
  const nick = field({ label: '닉네임', value: store.get(NICK, '') || '', max: LIMITS.nickname, placeholder: '방송 닉네임', autocomplete: 'nickname', id: id ? id + '_nick' : undefined });
  const body = field({ label, max: LIMITS.comment, multiline: true, rows: 3, placeholder });
  const submit = h('button', { type: 'submit', class: 'btn btn-accent' }, '남기기');
  const form = h('form', { class: 'comment-form', novalidate: true }, nick, body, h('div', { class: 'form-foot' }, status, submit));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nickname = nick.input.value.trim(), text = body.input.value.trim();
    if (!nickname) { status.textContent = '닉네임을 적어 주세요.'; nick.input.focus(); return; }
    if (charCount(nickname) > LIMITS.nickname) { status.textContent = '닉네임은 20자까지예요.'; return; }
    if (!text) { status.textContent = '한마디를 적어 주세요.'; body.input.focus(); return; }
    if (charCount(text) > LIMITS.comment) { status.textContent = '200자까지 쓸 수 있어요.'; return; }
    if (ctx.preview) return;
    submit.disabled = true; status.textContent = '남기는 중…';
    try {
      const r = await api.comment({ page: ctx.pageId, menu: menu.id, post, nickname, body: text });
      store.set(NICK, nickname);
      body.input.value = ''; body.input.dispatchEvent(new Event('input'));
      status.textContent = '남겼어요. 고마워요!';
      onPosted?.(r.comment);
    } catch (err) { status.textContent = err.message; }
    submit.disabled = false;
  });
  form.nickInput = nick.input;
  return form;
}

// 댓글 목록 + 더 보기
export function commentList(ctx, menu, { post = null, emptyText = '아직 남겨진 한마디가 없어요. 첫 한마디를 남겨 주세요.' } = {}) {
  const list = h('div', { class: 'comments' });
  const moreBtn = h('button', { type: 'button', class: 'btn btn-line more', hidden: true }, '더 보기');
  const box = h('div', { class: 'comment-list' }, list, moreBtn);
  let last = null;
  async function load() {
    moreBtn.disabled = true;
    const spin = loading();
    list.append(spin);
    try {
      const r = await api.comments({ page: ctx.pageId, menu: menu.id, post, before: last || undefined });
      spin.remove();
      if (!last && !r.comments.length) list.append(empty(emptyText));
      r.comments.forEach((c) => list.append(commentItem(c)));
      if (r.comments.length) last = r.comments[r.comments.length - 1].created;
      moreBtn.hidden = !r.more;
    } catch (e) { spin.remove(); list.append(errorBox(e.message)); }
    moreBtn.disabled = false;
  }
  moreBtn.addEventListener('click', load);
  box.prepend = (c) => { list.querySelector('.empty')?.remove(); list.prepend(commentItem(c)); };
  if (!ctx.preview) load();
  return box;
}

// "더 보기"가 있는 목록 불러오기(글)
export function pagedPosts(ctx, menu, { category, renderInto, emptyText = '아직 올라온 글이 없어요.' }) {
  const moreBtn = h('button', { type: 'button', class: 'btn btn-line more', hidden: true }, '더 보기');
  const status = h('div');
  let before = null;
  let all = [];
  async function load() {
    moreBtn.disabled = true;
    status.replaceChildren(loading());
    try {
      const r = await api.posts({ page: ctx.pageId, menu: menu.id, category: category || undefined, before: before || undefined });
      status.replaceChildren();
      const posts = r.posts || [];
      const plain = posts.filter((p) => !p.pinned);
      if (plain.length) before = plain[plain.length - 1].created;
      else if (posts.length) before = posts[posts.length - 1].created;
      all = all.concat(posts);
      if (!all.length) status.replaceChildren(empty(emptyText));
      renderInto(posts, all);
      moreBtn.hidden = !r.more;
    } catch (e) { status.replaceChildren(errorBox(e.message, load)); }
    moreBtn.disabled = false;
  }
  moreBtn.addEventListener('click', load);
  return { load, moreBtn, status };
}

export function categoryTabs(categories, current, onPick) {
  if (!categories?.length) return null;
  const all = ['', ...categories];
  const bar = h('div', { class: 'tabs-chips', role: 'tablist', 'aria-label': '분류' });
  all.forEach((c) => {
    const b = h('button', { type: 'button', role: 'tab', class: 'chip', 'aria-selected': String(c === current), onclick: () => onPick(c) }, c || '전체');
    bar.append(b);
  });
  bar.addEventListener('keydown', (e) => {
    const tabs = [...bar.children];
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); tabs[(i + 1) % tabs.length].focus(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); tabs[(i - 1 + tabs.length) % tabs.length].focus(); }
  });
  return bar;
}
