// 메인·DJ 페이지·캐릭터 페이지가 같이 쓰는 SNS 조각(2026-10-18 사이트 새 구조 — "매일 들어와서 내 캐릭터를 확인하고 싶게"):
//  · 큰 사진 카드(postCard): 캐릭터 사진(머리 조금 위~허벅지 가운데 — lib/raster.js photo, 카드 크기는 크게: 휴대폰 한 장 · 태블릿 두 장 · PC 세 장) +
//    왼쪽 아래 작은 펫 칸 + 아래 줄(아이디 · 레벨 · 어느 방송 · 하트 단추). 사진을 누르면 캐릭터 페이지(전신), 휴대폰에서 두 번 톡톡 누르면 하트.
//    하트는 누르는 즉시 수가 오르고(서버 답이 오면 그 수로) 하트가 퐁 터진다. 같은 캐릭터의 다른 카드도 함께 바뀐다(kg-heart 알림).
//  · 오늘의 주인공(spotlight) · DJ 동그라미 줄(storyRings — 맨 앞은 내 캐릭터들, 오늘 본 DJ 는 옅게) · 오늘의 하트 미션과 연속 방문(todayStrip) ·
//    내 캐릭터(meSection — 여러 명, 캐릭터마다 지난 방문 뒤 달라진 것).
//  "이게 나예요"(내 캐릭터 — 여러 명)·☆ 즐겨찾기·연속 방문·미션은 이 브라우저에만 기억한다(lib/me.js — 서버로 보내지 않는다, IP 도 쓰지 않는다).
//  내 캐릭터가 바뀌면 'kg-me', 즐겨찾기가 바뀌면 'kg-fav' 알림(document) — 같은 화면의 단추·칸이 함께 바뀐다.
// DOM 은 함수 안에서만(노드 시험에서 글 도우미를 불러 쓴다).
import { h, icon, toast, store } from '../lib/dom.js';
import { kiugiApi, fastApi } from '../api.js';
import { expressionFor } from '../lib/kiugi-draw.js';
import { photoBox, petTile, prefetchLook } from '../lib/raster.js';
import { sendHeart, sentToday, heartKey, sentCount, kstDay } from '../lib/hearts.js';
import { listMine, addMine, removeMine, isMine, isFav, addFav, removeFav, charKey, missionOf, snapOf, observe, MINE_MAX, FAV_MAX } from '../lib/me.js';
import { primePreview } from '../lib/swr.js';
import { ilink, medal } from './common.js';
import { art, idText, baseOf, buddyOf } from './cards.js';

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
export function browserStore() { try { return window.localStorage; } catch { return null; } }
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const HEART_ALREADY = '오늘은 이미 하트를 보냈어요. 내일 또 보낼 수 있어요.';
export const PIN_DONE = '내 캐릭터에 넣었어요. 첫 화면에서 매일 달라진 점을 알려 드려요.';
export const PIN_LABEL = '이게 나예요';
export const PIN_MINE = '내 캐릭터예요';
export const PIN_ASK = '한 번 더 눌러 빼기';
export const PIN_GONE = '내 캐릭터에서 뺐어요.';
export const MINE_FULL = `내 캐릭터는 ${MINE_MAX}명까지예요. 첫 화면의 내 캐릭터에서 하나를 뺀 뒤 다시 눌러 주세요.`;
export const FAV_LABEL = '즐겨찾기';
export const FAV_DONE = '즐겨찾기에 넣었어요. 다음에 첫 화면 찾기 칸을 누르면 바로 보여요.';
export const FAV_GONE = '즐겨찾기에서 뺐어요.';
export const FAV_FULL = `즐겨찾기는 ${FAV_MAX}개까지예요. 첫 화면 찾기 칸에서 안 보는 캐릭터를 빼 주세요.`;
// 내 캐릭터(kind 'mine')·즐겨찾기('fav')가 바뀌었다고 알린다. detail = {key, added, from}
export function tellSaved(kind, detail = {}) { document.dispatchEvent(new CustomEvent(kind === 'fav' ? 'kg-fav' : 'kg-me', { detail })); }
// 화면에서 빠진 요소는 알림 듣기를 그만둔다(만든 뒤 한 번 붙었던 것만 — 아직 붙기 전에는 듣는다)
export function follow(node, type, fn) {
  const listen = (e) => { if (!node.isConnected && node.dataset.kgSeen) { document.removeEventListener(type, listen); return; } fn(e); };
  document.addEventListener(type, listen);
  queueMicrotask(() => { node.dataset.kgSeen = '1'; });
}

// ---- 하트 단추(카드·스포트라이트·캐릭터 페이지) ----
// card = {slug, id, seasonId, hearts}. onSent() = 보낼 때(하트 터뜨리기 등). → {el, send, set}
export function heartPill(card, { onSent = null, big = false } = {}) {
  const storage = browserStore(), key = heartKey(card.slug, card.id, card.seasonId);
  let hearts = Math.max(0, Number(card.hearts) || 0), sent = sentToday(storage, key), busy = false;
  const num = h('span', { class: 'kg-heart-n' }, fmt(hearts));
  const btn = h('button', { type: 'button', class: 'kg-heart-pill' + (big ? ' big' : '') }, icon('heart', { size: big ? 22 : 19, filled: true }), num);
  const paint = () => {
    num.textContent = fmt(hearts);
    btn.classList.toggle('is-sent', sent);
    btn.setAttribute('aria-pressed', String(sent));
    btn.setAttribute('aria-label', `하트 ${fmt(hearts)}개 · ${sent ? '오늘 보냈어요' : '하트 보내기'}`);
  };
  const tell = () => document.dispatchEvent(new CustomEvent('kg-heart', { detail: { key, hearts, sent, from: btn } }));
  const send = () => {
    if (busy) return;
    const r = sendHeart({ ...card, hearts }, { send: kiugiApi.heart, storage });
    if (r.already) { sent = true; paint(); toast(HEART_ALREADY); btn.classList.remove('nudge'); void btn.offsetWidth; btn.classList.add('nudge'); return; }
    busy = true; sent = true; hearts = r.optimistic; paint(); tell(); onSent?.();
    btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
    r.done.then((res) => {
      busy = false;
      if (!res.ok) { sent = false; hearts = res.hearts; paint(); tell(); toast(res.error?.message || '하트를 보내지 못했어요. 잠시 뒤에 다시 해 주세요.', 'error'); return; }
      hearts = res.hearts; paint(); tell();
      if (!res.already) toast('하트를 보냈어요!');
    });
  };
  btn.addEventListener('click', send);
  // 같은 캐릭터의 다른 단추가 보냈으면 같이 바꾼다(화면에서 빠진 단추는 듣기를 그만둔다)
  const listen = (e) => { if (!btn.isConnected && btn.dataset.kgSeen) { document.removeEventListener('kg-heart', listen); return; } if (e.detail?.key === key && e.detail.from !== btn) { hearts = e.detail.hearts; sent = e.detail.sent; paint(); } };
  document.addEventListener('kg-heart', listen);
  queueMicrotask(() => { btn.dataset.kgSeen = '1'; });
  paint();
  return { el: btn, send, set: (n) => { hearts = Math.max(0, Number(n) || 0); paint(); } };
}
// 하트 터지기(사진 위 — 두 번 톡톡·하트 단추, 캐릭터 페이지 무대도)
export function burstLayer() {
  const el = h('span', { class: 'kg-burst', 'aria-hidden': 'true' }, icon('heart', { size: 120, filled: true }),
    ...[1, 2, 3, 4, 5, 6].map((i) => h('i', { class: 'p' + i })));
  return { el, go: () => { el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); } };
}

// ---- 큰 사진 카드 ----
// c = 카드 {slug, djName, id, level, worn, hearts, pet?, titles?, rank?} · ctx = {app, catalog, seasonId, season?, lookOf(slug) → DJ 캐릭터}
// opts: rank(1~3 메달, 그 밖 숫자) · tag(사진 위 작은 글 — "새로 꾸밈"·"찾았어요") · variant('feed'|'spot'|'me') · eager · showDj · pin(“이게 나예요” + ☆ 즐겨찾기 단추)
export function postCard(c, ctx, opts = {}) {
  const { app, catalog, seasonId = null } = ctx;
  const character = c.character || ctx.lookOf?.(c.slug) || null;
  const level = Math.max(1, Number(c.level) || 1), expr = expressionFor(catalog, seasonId, level).name;
  const base = baseOf(c.id), href = app.link({ name: 'character', slug: c.slug, base });
  const djName = c.djName || ctx.djNameOf?.(c.slug) || '';
  const pet = character ? buddyOf(catalog, c.pet) : null;
  const label = `${c.id} 캐릭터 · Lv.${level} ${expr}`;
  // 캐릭터 페이지가 바로 그릴 수 있게 아는 것을 미리 둔다(서버 답은 그 뒤에 — 1~2초)
  primePreview(c.slug, base, { id: c.id, level, worn: c.worn || {}, hearts: c.hearts, pet: c.pet || null, ...(c.titles ? { titles: c.titles } : {}), season: ctx.season || (seasonId ? { id: seasonId } : null), dj: { slug: c.slug, name: djName, character } });
  const photo = photoBox({ catalog, character, worn: c.worn, level, seasonId, base: app.base, kind: 'photo' }, {
    eager: opts.eager, label,
    // 캔버스로 그리지 못하면(예전 브라우저 등) 예전 SVG 그림으로 — 같은 칸 자르기(styles.css .kg-stage.photo-cut)
    onFail: (box) => box.replaceWith(art(catalog, character, c.worn, level, { seasonId, base: app.base, label, eager: true, kind: 'photo-cut' })),
  });
  const burst = burstLayer();
  const heart = heartPill({ slug: c.slug, id: c.id, seasonId, hearts: c.hearts }, { onSent: burst.go, big: opts.variant === 'spot' });
  const warm = () => { void fastApi.person(c.slug, c.id).fresh.catch(() => {}); prefetchLook({ catalog, character, worn: c.worn, level, seasonId, base: app.base }); };
  // 사진 전체를 덮는 링크(화면 읽기·키보드는 아래 아이디 링크 하나로 — 같은 곳이라 두 번 읽지 않게)
  const cover = h('a', { class: 'kg-post-cover', href, 'data-link': '', tabindex: '-1', 'aria-hidden': 'true' });
  let lastTap = 0, tapTimer = 0, ptype = '';
  cover.addEventListener('pointerdown', (e) => { ptype = e.pointerType || ''; warm(); }, { passive: true });
  cover.addEventListener('mouseenter', warm, { once: true, passive: true });
  cover.addEventListener('click', (e) => {
    if (ptype !== 'touch' || e.button !== 0) return; // 마우스는 바로 이동(app.js)
    e.preventDefault();
    const now = performance.now();
    if (now - lastTap < 320) { clearTimeout(tapTimer); lastTap = 0; heart.send(); return; }
    lastTap = now;
    tapTimer = setTimeout(() => { lastTap = 0; app.navigate(href); }, 260);
  });
  const rank = opts.rank ? medal(opts.rank, { className: 'kg-post-rank', label: `${opts.rank}등` }) : null;
  const tag = opts.tag ? h('span', { class: 'kg-post-tag' }, opts.tag) : null;
  const petEl = pet ? petTile(pet, app.base, { label: `함께하는 펫 ${pet.name} ${'★'.repeat(pet.stage)}` }) : null;
  const media = h('div', { class: 'kg-post-media' + (character ? '' : ' no-art') }, photo, rank, tag, petEl, burst.el, cover);
  const who = ilink(href, { class: 'kg-post-who', 'aria-label': `${c.id} · Lv.${level} ${expr}${djName ? ` · ${djName} 키우기` : ''} — 캐릭터 보기` },
    h('b', { class: 'kg-post-id' }, ...idText(c.id)),
    h('span', { class: 'kg-post-sub' }, h('span', { class: 'kg-lv' }, `Lv.${level}`), h('span', { class: 'kg-post-expr' }, expr),
      djName && opts.showDj !== false ? h('span', { class: 'kg-post-dj' }, `${djName} 키우기`) : null));
  who.addEventListener('pointerdown', warm, { passive: true });
  const bar = h('div', { class: 'kg-post-bar' }, who, heart.el);
  const more = opts.pin ? h('div', { class: 'kg-post-more' }, pinButton({ slug: c.slug, id: c.id, djName }), favButton({ slug: c.slug, id: c.id, djName }, { compact: true })) : null;
  const card = h('article', { class: `kg-post ${opts.variant || 'feed'}${opts.rank ? ` ranked r${Math.min(opts.rank, 4)}` : ''}` }, media, bar, more);
  card.kgHeart = heart;
  return card;
}

// "이게 나예요" 단추: 누르면 내 캐릭터에 넣는다(여러 명 — 12명까지). 이미 내 캐릭터면 "내 캐릭터예요",
//  그때 누르면 "한 번 더 눌러 빼기"(4초) — 한 번 더 누르면 뺀다(잘못 눌러 빠지지 않게). onPin(entry) = 넣었을 때.
export function pinButton({ slug, id, djName = '' }, { onPin = null, className = 'btn btn-line kg-pin-btn' } = {}) {
  const storage = browserStore(), key = charKey(slug, id);
  const label = h('span', { class: 'kg-pin-text' }, PIN_LABEL);
  const btn = h('button', { type: 'button', class: className }, icon('user', { size: 18 }), label);
  let asking = 0;
  const stopAsking = () => { clearTimeout(asking); asking = 0; };
  const sync = () => {
    const mine = isMine(storage, slug, id);
    if (!mine) stopAsking();
    btn.classList.toggle('is-me', mine);
    btn.classList.toggle('is-asking', Boolean(asking));
    btn.setAttribute('aria-pressed', String(mine));
    label.textContent = asking ? PIN_ASK : mine ? PIN_MINE : PIN_LABEL;
  };
  btn.addEventListener('click', () => {
    if (!isMine(storage, slug, id)) {
      const r = addMine(storage, { slug, id, djName });
      if (!r.ok) { toast(r.reason === 'full' ? MINE_FULL : '이 캐릭터는 넣을 수 없어요.', 'error'); return; }
      toast(PIN_DONE);
      tellSaved('mine', { key, added: true, from: btn });
      onPin?.(r.entry);
      return;
    }
    if (!asking) { asking = setTimeout(() => { asking = 0; sync(); }, 4000); sync(); return; }
    stopAsking();
    removeMine(storage, slug, id);
    toast(PIN_GONE);
    tellSaved('mine', { key, added: false, from: btn });
  });
  follow(btn, 'kg-me', sync);
  sync();
  return btn;
}
// ☆ 즐겨찾기 단추: 누를 때마다 넣었다 뺐다(채운 별 = 넣음). 즐겨찾기는 첫 화면 찾기 칸을 누르면 바로 아래에 보인다.
//  compact: 카드 안(별 그림만 — 이름은 화면 읽기에 그대로)
export function favButton({ slug, id, djName = '' }, { compact = false } = {}) {
  const storage = browserStore(), key = charKey(slug, id);
  const btn = h('button', { type: 'button', class: 'btn btn-line kg-fav-btn' + (compact ? ' compact' : '') }, icon('star', { size: 19 }), h('span', { class: compact ? 'sr-only' : null }, FAV_LABEL));
  const sync = () => {
    const on = isFav(storage, slug, id);
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.title = on ? '즐겨찾기에서 빼기' : '즐겨찾기에 넣기';
  };
  btn.addEventListener('click', () => {
    if (isFav(storage, slug, id)) { removeFav(storage, slug, id); toast(FAV_GONE); tellSaved('fav', { key, added: false, from: btn }); return; }
    const r = addFav(storage, { slug, id, djName });
    if (!r.ok) { toast(r.reason === 'full' ? FAV_FULL : '이 캐릭터는 넣을 수 없어요.', 'error'); return; }
    toast(FAV_DONE);
    tellSaved('fav', { key, added: true, from: btn });
    btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
  });
  follow(btn, 'kg-fav', sync);
  sync();
  return btn;
}

// ---- 오늘의 주인공 ----
export function spotlight(c, ctx, { why = '하트 1위' } = {}) {
  return h('section', { class: 'kg-spot', 'aria-labelledby': 'kg_spot_t' },
    h('div', { class: 'kg-spot-head' },
      h('span', { class: 'kg-spot-eyebrow', id: 'kg_spot_t' }, icon('crown', { size: 16 }), '오늘의 주인공'),
      h('span', { class: 'kg-spot-why' }, why)),
    postCard(c, ctx, { variant: 'spot', eager: true }));
}

// ---- DJ 동그라미 줄 ----
const SEEN_KEY = 'kg_seen_dj';
export function seenDjs(now = Date.now()) { const v = store.get(SEEN_KEY, null); return v && v.day === kstDay(now) && Array.isArray(v.slugs) ? v.slugs : []; }
export function markDjSeen(slug, now = Date.now()) { const list = seenDjs(now).filter((s) => s !== slug); list.push(slug); store.set(SEEN_KEY, { day: kstDay(now), slugs: list.slice(-50) }); }
// djs = home.djs [{slug, name, character, count}] · mine = 내 캐릭터들 [{entry, look(그림을 그릴 수 있으면), news(새 소식 수)}] — 맨 앞에 하나씩
//  onMine(entry) = 내 캐릭터 동그라미를 누를 때 · onAdd() = 내 캐릭터가 없을 때 "+ 내 캐릭터"를 누를 때
export function storyRings(djs, ctx, { mine = [], onMine = null, onAdd = null } = {}) {
  const seen = new Set(seenDjs());
  // cssWidth: 동그라미 크기(그리기 전에도 같은 배율 — 이 브라우저 사진 캐시 열쇠가 바뀌지 않게)
  const pic = (character, worn = {}, level = 1, label = '') => h('span', { class: 'kg-ring-pic' }, photoBox({ catalog: ctx.catalog, character, worn, level, seasonId: ctx.seasonId, base: ctx.app.base, kind: 'bust', cssWidth: 82 }, { label, eager: true, low: true }));
  const items = [];
  for (const { entry: e, look = null, news = 0 } of mine) {
    const tag = e.id.slice(e.id.indexOf('#'));
    const face = look ? pic(look.character, look.worn, look.level) : h('span', { class: 'kg-ring-pic plain' }, icon('user', { size: 26 }));
    // 동그라미 오른쪽 아래 작은 사람 표시 = 내 캐릭터(DJ 동그라미와 구별)
    face.append(h('span', { class: 'kg-ring-mine', 'aria-hidden': 'true' }, icon('user', { size: 12 })));
    items.push(h('li', null, h('button', { type: 'button', class: 'kg-ring is-me' + (news ? ' has-news' : ''), onclick: () => onMine?.(e), 'aria-label': `내 캐릭터 ${e.id}${news ? ` · 새 소식 ${news}개` : ''}` },
      face,
      news ? h('span', { class: 'kg-ring-badge', 'aria-hidden': 'true' }, String(news)) : null,
      h('span', { class: 'kg-ring-name' }, e.base),
      h('span', { class: 'kg-ring-sub', 'aria-hidden': 'true' }, tag))));
  }
  if (!mine.length) {
    items.push(h('li', null, h('button', { type: 'button', class: 'kg-ring is-add', onclick: () => onAdd?.(), 'aria-label': '내 캐릭터 찾기' },
      h('span', { class: 'kg-ring-pic plain' }, icon('plus', { size: 26 })), h('span', { class: 'kg-ring-name' }, '내 캐릭터'))));
  }
  for (const d of djs || []) {
    items.push(h('li', null, ilink(ctx.app.link({ name: 'kiugi', slug: d.slug }), { class: 'kg-ring' + (seen.has(d.slug) ? ' is-seen' : ''), 'aria-label': `${d.name} 키우기 · 청취자 ${fmt(d.count)}명` },
      pic(d.character, {}, 1),
      h('span', { class: 'kg-ring-name' }, d.name),
      h('span', { class: 'kg-ring-sub', 'aria-hidden': 'true' }, `${fmt(d.count)}명`))));
  }
  return h('nav', { class: 'kg-rings', 'aria-label': '키우기 중인 DJ' }, h('ul', null, ...items));
}

// ---- 오늘의 하트 미션 · 연속 방문 ----
export function todayStrip({ streak = null } = {}) {
  const storage = browserStore();
  const dots = h('span', { class: 'kg-dots', 'aria-hidden': 'true' });
  const line = h('b', null), sub = h('small', null);
  const mission = h('div', { class: 'kg-mission', role: 'status', 'aria-live': 'polite' }, h('span', { class: 'kg-mission-ic', 'aria-hidden': 'true' }, icon('heart', { size: 18, filled: true })), h('span', { class: 'kg-mission-text' }, line, sub), dots);
  const paint = () => {
    const m = missionOf(sentCount(storage));
    mission.classList.toggle('is-done', m.done);
    line.textContent = m.done ? '오늘의 하트 미션 완료!' : `오늘의 하트 ${Math.min(m.sent, m.goal)}/${m.goal}`;
    sub.textContent = m.done ? `오늘 ${fmt(m.sent)}명에게 보냈어요 · 내일 또 만나요` : `하트를 ${m.left}번 더 보내면 완료`;
    dots.replaceChildren(...Array.from({ length: m.goal }, (_, i) => h('i', { class: i < m.sent ? 'on' : '' })));
  };
  const streakEl = streak ? h('div', { class: 'kg-streak' + (streak.n >= 2 ? ' hot' : '') }, h('span', { class: 'kg-streak-ic', 'aria-hidden': 'true' }, icon('flame', { size: 18 })),
    h('span', null, h('b', null, `${fmt(streak.n)}일`), streak.n >= 2 ? ' 연속 방문' : ' 첫 방문'), streak.best > streak.n ? h('small', null, `최고 ${fmt(streak.best)}일`) : null) : null;
  const el = h('div', { class: 'kg-today' }, mission, streakEl);
  const listen = () => { if (!el.isConnected && el.dataset.kgSeen) { document.removeEventListener('kg-heart', listen); return; } paint(); };
  document.addEventListener('kg-heart', listen);
  queueMicrotask(() => { el.dataset.kgSeen = '1'; });
  paint();
  return el;
}

// ---- 내 캐릭터 ----
// 달라진 것 글(lib/me.js diffSnap 의 changes 하나 → [큰 글, 작은 글])
export function newsText(ch, { catalog = null, seasonId = null } = {}) {
  if (ch.kind === 'hearts') return [`하트 +${fmt(ch.to - ch.from)}`, `지금 ${fmt(ch.to)}개`];
  if (ch.kind === 'level') return [`Lv.${ch.from} → Lv.${ch.to}`, `표정: ${expressionFor(catalog, seasonId, ch.to).name}`];
  if (ch.kind === 'worn') return [`새 옷 ${fmt(ch.to)}벌`, '옷을 갈아입었어요'];
  if (ch.kind === 'rank') {
    if (ch.to === null) return ['인기 순위 밖', `지난번 인기 ${ch.from}위`];
    if (ch.from === null) return [`인기 ${ch.to}위`, '인기 캐릭터에 들었어요'];
    return [`인기 ${ch.from}위 → ${ch.to}위`, ch.to < ch.from ? `${ch.from - ch.to}계단 올랐어요` : `${ch.to - ch.from}계단 내려갔어요`];
  }
  if (ch.kind === 'pet') { const p = catalog?.pets?.[ch.id]; const name = p ? p.names[ch.to - 1] || p.name : '펫'; return ch.from ? [`${name} ★${ch.from} → ★${ch.to}`, '펫이 자랐어요'] : [`새 펫 ${name}`, '함께하는 펫이 생겼어요']; }
  if (ch.kind === 'title') { const t = catalog?.titles?.[ch.to]; return [`칭호 ${t?.name || ''}`.trim(), '새 칭호를 달았어요']; }
  return ['', ''];
}
export function newsHead(diff) {
  if (!diff || diff.first) return ['내 캐릭터로 정했어요', '다음에 오면 그동안 달라진 점(하트·레벨·옷·순위)을 여기 알려 드려요.'];
  if (diff.newSeason) return ['새 시즌이 시작됐어요', '이번 시즌에도 방송에서 냥을 모아 키워 보세요.'];
  if (!diff.changes.length) return ['지난 방문과 그대로예요', '방송에서 냥을 모으면 레벨이 오르고 표정이 바뀌어요. 링크를 보내 친구에게 하트를 부탁해 보세요.'];
  return diff.up ? ['지난 방문 뒤로 이만큼 자랐어요!', ''] : ['지난 방문 뒤로 달라진 것', ''];
}
// 캐릭터 그림에 쓸 것(DJ 캐릭터 · 입은 옷 · 레벨 · 시즌) — 캐릭터 답에서
export const lookOfPerson = (data) => (data?.dj?.character ? { character: data.dj.character, worn: data.worn || {}, level: data.level, seasonId: data.season?.id || null } : null);
// 이 브라우저가 이미 받아 둔 답에서만 찾는다(서버에 묻지 않는다): 캐릭터 답 → 메인 인기·새로 꾸민 카드 + DJ 캐릭터 → DJ 페이지 1~3등. 없으면 null.
export function cachedLook(entry) {
  const p = lookOfPerson(fastApi.peekPerson(entry.slug, entry.id));
  if (p) return p;
  const isIt = (c) => String(c?.id ?? '').normalize('NFC') === entry.id;
  const home = fastApi.peekHome();
  const dj = (home?.djs || []).find((d) => d.slug === entry.slug);
  const c = [...(home?.popular || []), ...(home?.recent || [])].find((x) => x.slug === entry.slug && isIt(x));
  if (dj?.character && c) return { character: dj.character, worn: c.worn || {}, level: c.level, seasonId: home.season?.id || null };
  const page = fastApi.peekPage(entry.slug), t = (page?.top || []).find(isIt);
  if (page?.character && t) return { character: page.character, worn: t.worn || {}, level: t.level, seasonId: page.season?.id || null };
  return null;
}

// 내 캐릭터 칸(여러 명 — 2026-10-18 사용자 "한 사람이 여러 방에서 여러 디제이를 키울 수도 있잖아"): 캐릭터마다 큰 사진 카드 + 지난 방문 뒤 달라진 것.
//  이 브라우저가 받아 둔 답으로 먼저 그리고, 새 답이 오면(서버에는 한 번에 셋씩 묻는다) 달라진 것을 보여 준다.
//  한 명이면 예전처럼 소식 · 카드 두 칸, 여럿이면 휴대폰은 옆으로 넘겨 보기 · 넓은 화면은 칸(styles.css .kg-me-list.one · .many).
//  캐릭터마다 "내 캐릭터에서 빼기"(뺀 자리에 "되돌리기"). 고르지 않았으면 고르는 법(찾기 칸으로).
//  'kg-me' 알림(다른 곳에서 넣고 뺌)이 오면 바뀐 캐릭터만 고친다(나머지 카드·사진은 그대로).
//  → {el, state() → {mine, looks: Map(열쇠 → 그림), news: Map(열쇠 → 새 소식 수), pending(되돌리기 자리 수)}, focusItem(열쇠)} · onState(state) = 그림·소식이 바뀔 때(첫 화면 동그라미 줄)
const ME_ASK_AT_ONCE = 3;
export function meSection(ctx, { onFind = null, rankOf = () => null, onState = null } = {}) {
  const storage = browserStore();
  const host = h('div', { class: 'kg-me-host', id: 'me' });
  const items = new Map(), gone = new Map();
  let order = [];
  const count = h('span', { class: 'kg-me-count' });
  const list = h('div', { class: 'kg-me-list' });
  const section = h('section', { class: 'kg-me', 'aria-labelledby': 'kg_me_t' },
    h('div', { class: 'kg-me-head' },
      h('h2', { class: 'sec-title', id: 'kg_me_t' }, '내 캐릭터 ', count),
      h('button', { type: 'button', class: 'btn btn-line kg-me-add', onclick: () => onFind?.(), 'aria-label': '내 캐릭터 더 넣기(아이디 찾기)' }, icon('plus', { size: 17 }), '추가')),
    list);
  const cta = h('section', { class: 'kg-me-cta', 'aria-labelledby': 'kg_me_cta_t' },
    h('span', { class: 'kg-me-cta-ic', 'aria-hidden': 'true' }, icon('sparkle', { size: 24 })),
    h('div', { class: 'kg-me-cta-text' }, h('h2', { class: 'kg-me-cta-title', id: 'kg_me_cta_t' }, '내 캐릭터'),
      h('p', null, '아이디를 찾아 ', h('b', null, PIN_LABEL), '를 눌러 두세요. 받은 하트와 달라진 모습을 모아 봐요.')),
    h('button', { type: 'button', class: 'btn btn-accent kg-me-cta-btn', onclick: () => onFind?.() }, icon('search', { size: 18 }), '내 아이디 찾기'));

  // 서버에 한 번에 셋씩 묻는다(내 캐릭터가 많아도 한꺼번에 몰리지 않게)
  let running = 0;
  const waiting = [];
  const ask = (fn) => new Promise((resolve, reject) => {
    const go = () => { running++; Promise.resolve().then(fn).then(resolve, reject).finally(() => { running--; waiting.shift()?.(); }); };
    if (running < ME_ASK_AT_ONCE) go(); else waiting.push(go);
  });
  let tick = 0;
  const state = () => {
    const looks = new Map(), news = new Map();
    for (const [k, it] of items) { if (it.look) looks.set(k, it.look); if (it.n) news.set(k, it.n); }
    // pending: 뺀 자리(되돌리기)가 남아 있는 수
    return { mine: order.map((k) => items.get(k)?.entry).filter(Boolean), looks, news, pending: gone.size };
  };
  const changed = () => { clearTimeout(tick); tick = setTimeout(() => onState?.(state()), 80); };

  const skeleton = () => h('div', { class: 'kg-post is-skeleton', 'aria-hidden': 'true' }, h('div', { class: 'kg-post-media' }, h('div', { class: 'kg-photo photo' })), h('div', { class: 'kg-post-bar' }));
  // replaceChildren 에 null 을 넘기면 "null" 글자가 생기므로 빈 것은 뺀다. 아래 줄(내 캐릭터 페이지 · 빼기)은 늘 끝에.
  const setNews = (it, kids) => it.news.replaceChildren(...kids.filter(Boolean), it.acts);
  function showCard(it, data) {
    const k = JSON.stringify([data.worn, data.level, data.pet, data.dj?.character]);
    if (k === it.shown) { it.cardHost.querySelector('.kg-post')?.kgHeart?.set(data.hearts); return; }
    it.shown = k;
    it.cardHost.replaceChildren(postCard({ ...data, slug: it.entry.slug, djName: data.dj?.name || it.entry.djName, character: data.dj?.character || null },
      { ...ctx, season: data.season, seasonId: data.season?.id || ctx.seasonId }, { variant: 'me', eager: it.eager }));
  }
  function showNews(it, diff, data) {
    const [title, sub] = newsHead(diff);
    it.news.classList.remove('is-loading');
    it.news.classList.toggle('is-up', Boolean(diff?.up));
    const sid = data.season?.id || ctx.seasonId;
    const chips = (diff?.changes || []).map((c) => { const [big, small] = newsText(c, { catalog: ctx.catalog, seasonId: sid }); return h('li', { class: 'kg-news-' + c.kind }, h('b', null, big), small ? h('small', null, small) : null); });
    setNews(it, [
      diff?.up ? h('span', { class: 'kg-confetti', 'aria-hidden': 'true' }, ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => h('i', { class: 'c' + i }))) : null,
      h('b', { class: 'kg-me-news-title' }, title), sub ? h('p', null, sub) : null,
      chips.length ? h('ul', { class: 'kg-news' }, ...chips) : null]);
  }
  function makeItem(entry, eager) {
    const key = charKey(entry.slug, entry.id);
    const it = { key, entry, eager, shown: null, look: cachedLook(entry), n: 0 };
    it.news = h('div', { class: 'kg-me-news is-loading' });
    it.cardHost = h('div', { class: 'kg-me-card' }, skeleton());
    it.el = h('article', { class: 'kg-me-item', 'aria-label': `내 캐릭터 ${entry.id}` }, it.cardHost, it.news);
    it.acts = h('div', { class: 'kg-me-acts' },
      ilink(ctx.app.link({ name: 'character', slug: entry.slug, base: entry.base }), { class: 'btn btn-line kg-me-go' }, '내 캐릭터 페이지', icon('arrow', { size: 16 })),
      h('button', { type: 'button', class: 'kg-me-change kg-me-remove', onclick: () => drop(it), 'aria-label': `${entry.id} 내 캐릭터에서 빼기` }, '내 캐릭터에서 빼기'));
    setNews(it, [h('b', { class: 'kg-me-news-title' }, '달라진 점을 확인하는 중…')]);
    const cached = fastApi.peekPerson(entry.slug, entry.id);
    if (cached) showCard(it, cached);
    ask(() => (items.get(key) === it ? fastApi.person(entry.slug, entry.id).fresh : null)).then((data) => {
      if (items.get(key) !== it || !data) return;
      showCard(it, data);
      it.look = lookOfPerson(data) || it.look;
      const { diff } = observe(storage, entry, snapOf(data, { rank: rankOf(entry) }));
      it.n = diff.changes.length;
      showNews(it, diff, data);
      changed();
    }).catch((e) => {
      if (items.get(key) !== it) return;
      it.news.classList.remove('is-loading');
      if (e?.status === 404) {
        it.cardHost.replaceChildren(h('div', { class: 'kg-post is-lost', 'aria-hidden': 'true' }, h('div', { class: 'kg-post-media' }, h('span', { class: 'kg-lost-mark' }, icon('user', { size: 40 }))),
          h('div', { class: 'kg-post-bar' }, h('b', { class: 'kg-post-id' }, ...idText(entry.id)))));
        setNews(it, [h('b', { class: 'kg-me-news-title' }, '이번 시즌 아이디를 찾을 수 없어요'), h('p', null, '시즌이 바뀌면 아이디를 새로 만들어요. 새 아이디를 찾아 다시 넣어 주세요.'),
          h('button', { type: 'button', class: 'btn btn-line kg-me-find', onclick: () => onFind?.() }, icon('search', { size: 16 }), '새 아이디 찾기')]);
      } else setNews(it, [h('b', { class: 'kg-me-news-title' }, '지금은 새 소식을 불러오지 못했어요'), h('p', null, e?.message || '잠시 뒤에 다시 들어와 주세요.')]);
    });
    return it;
  }
  // 빼기: 그 자리에 "뺐어요 · 되돌리기"(이 화면에 있는 동안)
  function drop(it) {
    const r = removeMine(storage, it.entry.slug, it.entry.id);
    if (!r) return;
    const undoBtn = h('button', { type: 'button', class: 'btn btn-line kg-me-undo', onclick: () => undo(it.key) }, icon('undo', { size: 16 }), '되돌리기');
    gone.set(it.key, { entry: r.entry, index: r.index, el: h('div', { class: 'kg-me-gone', role: 'status' }, h('p', null, h('b', null, ...idText(it.entry.id)), h('span', null, '내 캐릭터에서 뺐어요')), undoBtn) });
    tellSaved('mine', { key: it.key, added: false, from: host });
    undoBtn.focus({ preventScroll: true });
  }
  function undo(key) {
    const g = gone.get(key);
    if (!g) return;
    gone.delete(key);
    const r = addMine(storage, g.entry, g.entry.at, { index: g.index });
    if (!r.ok) toast(r.reason === 'full' ? MINE_FULL : '되돌리지 못했어요.', 'error');
    tellSaved('mine', { key, added: r.ok, from: host });
    if (r.ok) items.get(key)?.el.querySelector('.kg-post-who, .kg-me-remove')?.focus({ preventScroll: true });
  }
  // 지금 목록대로 맞추기(새로 넣은 캐릭터만 만들고, 뺀 캐릭터만 치운다)
  function sync() {
    const mine = listMine(storage), keys = mine.map((e) => charKey(e.slug, e.id));
    for (const k of [...items.keys()]) if (!keys.includes(k)) items.delete(k);
    mine.forEach((e, i) => {
      gone.delete(keys[i]);
      const it = items.get(keys[i]);
      if (it) it.entry = e; else items.set(keys[i], makeItem(e, items.size < 2));
    });
    order = keys;
    // 뺀 자리: 나중에 뺀 것부터 그 자리에 다시 끼우면 뺀 차례를 거꾸로 되돌린 것과 같다(여럿을 빼도 원래 차례대로)
    const kids = keys.map((k) => items.get(k).el);
    for (const g of [...gone.values()].reverse()) kids.splice(Math.min(g.index, kids.length), 0, g.el);
    if (keys.length) {
      list.className = 'kg-me-list ' + (keys.length === 1 && !gone.size ? 'one' : 'many');
      list.replaceChildren(...kids);
      count.textContent = String(keys.length);
      if (host.firstElementChild !== section || host.childElementCount !== 1) host.replaceChildren(section);
    } else host.replaceChildren(cta, ...kids);
    changed();
  }
  // 동그라미 줄에서 누르면: 이 칸으로 내려와 그 캐릭터를 보여 준다(옆으로 넘기는 줄이면 그 카드까지)
  function focusItem(key) {
    const behavior = reduced() ? 'auto' : 'smooth';
    host.scrollIntoView({ block: 'start', behavior });
    const it = items.get(key);
    if (!it) return;
    if (list.scrollWidth > list.clientWidth + 2) {
      const pad = parseFloat(getComputedStyle(list).paddingLeft) || 0;
      list.scrollBy({ left: it.el.getBoundingClientRect().left - list.getBoundingClientRect().left - pad, behavior });
    }
    it.el.classList.remove('is-flash'); void it.el.offsetWidth; it.el.classList.add('is-flash');
  }
  follow(host, 'kg-me', sync);
  sync();
  return { el: host, state, focusItem };
}
