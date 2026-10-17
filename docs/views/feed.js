// 메인·DJ 페이지·캐릭터 페이지가 같이 쓰는 SNS 조각(2026-10-18 사이트 새 구조 — "매일 들어와서 내 캐릭터를 확인하고 싶게"):
//  · 큰 사진 카드(postCard): 캐릭터 사진(머리 조금 위~허벅지 가운데 — lib/raster.js photo, 카드 크기는 크게: 휴대폰 한 장 · 태블릿 두 장 · PC 세 장) +
//    왼쪽 아래 작은 펫 칸 + 아래 줄(아이디 · 레벨 · 어느 방송 · 하트 단추). 사진을 누르면 캐릭터 페이지(전신), 휴대폰에서 두 번 톡톡 누르면 하트.
//    하트는 누르는 즉시 수가 오르고(서버 답이 오면 그 수로) 하트가 퐁 터진다. 같은 캐릭터의 다른 카드도 함께 바뀐다(kg-heart 알림).
//  · 오늘의 주인공(spotlight) · DJ 동그라미 줄(storyRings — 오늘 본 DJ 는 옅게) · 오늘의 하트 미션과 연속 방문(todayStrip) · 내 캐릭터(meSection — 지난 방문 뒤 달라진 것).
//  "이게 나예요"(내 캐릭터 고르기)·연속 방문·미션은 이 브라우저에만 기억한다(lib/me.js — 서버로 보내지 않는다).
// DOM 은 함수 안에서만(노드 시험에서 글 도우미를 불러 쓴다).
import { h, icon, toast, store } from '../lib/dom.js';
import { kiugiApi, fastApi } from '../api.js';
import { expressionFor } from '../lib/kiugi-draw.js';
import { photoBox, petTile, prefetchLook } from '../lib/raster.js';
import { sendHeart, sentToday, heartKey, sentCount, kstDay } from '../lib/hearts.js';
import { getMe, setMe, clearMe, isMe, missionOf, snapOf, observe } from '../lib/me.js';
import { primePreview } from '../lib/swr.js';
import { ilink, medal } from './common.js';
import { art, idText, baseOf, buddyOf } from './cards.js';

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
export function browserStore() { try { return window.localStorage; } catch { return null; } }
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const HEART_ALREADY = '오늘은 이미 하트를 보냈어요. 내일 또 보낼 수 있어요.';
export const PIN_DONE = '내 캐릭터로 정했어요. 첫 화면에서 매일 달라진 점을 알려 드려요.';
export const PIN_LABEL = '이게 나예요';

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
// opts: rank(1~3 메달, 그 밖 숫자) · tag(사진 위 작은 글 — "새로 꾸밈"·"찾았어요") · variant('feed'|'spot'|'me') · eager · showDj · pin(“이게 나예요” 단추)
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
  const pinBtn = opts.pin ? pinButton({ slug: c.slug, id: c.id, djName }) : null;
  const card = h('article', { class: `kg-post ${opts.variant || 'feed'}${opts.rank ? ` ranked r${Math.min(opts.rank, 4)}` : ''}` }, media, bar, pinBtn ? h('div', { class: 'kg-post-more' }, pinBtn) : null);
  card.kgHeart = heart;
  return card;
}

// "이게 나예요" 단추: 누르면 내 캐릭터로(이미 내 캐릭터면 "내 캐릭터 ✓")
export function pinButton({ slug, id, djName = '' }, { onPin = null, className = 'btn btn-line kg-pin-btn' } = {}) {
  const storage = browserStore();
  const label = h('span', null, PIN_LABEL);
  const btn = h('button', { type: 'button', class: className }, icon('user', { size: 18 }), label);
  const sync = () => { const mine = isMe(storage, slug, id); btn.classList.toggle('is-me', mine); btn.setAttribute('aria-pressed', String(mine)); label.textContent = mine ? '내 캐릭터예요' : PIN_LABEL; };
  btn.addEventListener('click', () => {
    if (isMe(storage, slug, id)) { toast('이미 내 캐릭터예요. 첫 화면에서 매일 확인해 보세요.'); return; }
    setMe(storage, { slug, id, djName });
    toast(PIN_DONE);
    document.dispatchEvent(new CustomEvent('kg-me'));
    onPin?.();
  });
  document.addEventListener('kg-me', () => { if (btn.isConnected) sync(); });
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
// djs = home.djs [{slug, name, character, count}] · me = 내 캐릭터(+ 그림을 그릴 수 있으면 look) · onMe() = 내 캐릭터 동그라미를 누를 때
export function storyRings(djs, ctx, { me = null, meLook = null, news = 0, onMe = null } = {}) {
  const seen = new Set(seenDjs());
  // cssWidth: 동그라미 크기(그리기 전에도 같은 배율 — 이 브라우저 사진 캐시 열쇠가 바뀌지 않게)
  const pic = (character, worn = {}, level = 1, label = '') => h('span', { class: 'kg-ring-pic' }, photoBox({ catalog: ctx.catalog, character, worn, level, seasonId: ctx.seasonId, base: ctx.app.base, kind: 'bust', cssWidth: 82 }, { label, eager: true }));
  const items = [];
  if (me) {
    items.push(h('li', null, h('button', { type: 'button', class: 'kg-ring is-me' + (news ? ' has-news' : ''), onclick: () => onMe?.(), 'aria-label': `내 캐릭터 ${me.id}${news ? ` · 새 소식 ${news}개` : ''}` },
      meLook ? pic(meLook.character, meLook.worn, meLook.level) : h('span', { class: 'kg-ring-pic plain' }, icon('user', { size: 26 })),
      news ? h('span', { class: 'kg-ring-badge', 'aria-hidden': 'true' }, String(news)) : null,
      h('span', { class: 'kg-ring-name' }, '내 캐릭터'))));
  } else {
    items.push(h('li', null, h('button', { type: 'button', class: 'kg-ring is-add', onclick: () => onMe?.(), 'aria-label': '내 캐릭터 찾기' },
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
    sub.textContent = m.done ? `오늘 ${fmt(m.sent)}명에게 하트를 보냈어요. 내일 또 만나요.` : `마음에 드는 캐릭터에게 하트를 ${m.left}번 더 보내 보세요.`;
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
// 내 캐릭터 칸: 처음엔 지난번 답으로 바로 그리고, 새 답이 오면 달라진 것을 보여 준다. 고르지 않았으면 고르는 법(찾기 칸으로).
//  → {el, ready: Promise<{news(달라진 것 수), look}>}
export function meSection(ctx, { onFind = null, rankOf = () => null } = {}) {
  const storage = browserStore(), me = getMe(storage);
  if (!me) {
    const el = h('section', { class: 'kg-me-cta', id: 'me', 'aria-labelledby': 'kg_me_t' },
      h('span', { class: 'kg-me-cta-ic', 'aria-hidden': 'true' }, icon('sparkle', { size: 24 })),
      h('div', { class: 'kg-me-cta-text' }, h('h2', { class: 'kg-me-cta-title', id: 'kg_me_t' }, '내 캐릭터를 정해 두세요'),
        h('p', null, '내 아이디를 찾아 ', h('b', null, PIN_LABEL), '를 누르면, 들어올 때마다 그동안 받은 하트·오른 레벨·바뀐 옷·인기 순위를 알려 드려요.')),
      h('button', { type: 'button', class: 'btn btn-accent kg-me-cta-btn', onclick: () => onFind?.() }, icon('search', { size: 18 }), '내 아이디 찾기'));
    return { el, ready: Promise.resolve({ news: 0, look: null }) };
  }
  const head = h('div', { class: 'kg-me-head' },
    h('h2', { class: 'sec-title', id: 'kg_me_t' }, '내 캐릭터'),
    h('button', { type: 'button', class: 'kg-me-change', onclick: () => { clearMe(storage); document.dispatchEvent(new CustomEvent('kg-me')); toast('내 캐릭터를 풀었어요. 다시 찾아 정할 수 있어요.'); } }, '다른 캐릭터로'));
  const news = h('div', { class: 'kg-me-news is-loading', role: 'status', 'aria-live': 'polite' }, h('b', { class: 'kg-me-news-title' }, '달라진 점을 확인하는 중…'));
  const cardHost = h('div', { class: 'kg-me-card' });
  const el = h('section', { class: 'kg-me', id: 'me', 'aria-labelledby': 'kg_me_t' }, head, h('div', { class: 'kg-me-body' }, news, cardHost));
  const cardOf = (data) => postCard({ ...data, slug: me.slug, djName: data.dj?.name || me.djName, character: data.dj?.character || null }, { ...ctx, season: data.season, seasonId: data.season?.id || ctx.seasonId }, { variant: 'me', eager: true });
  const lookOf = (data) => (data?.dj?.character ? { character: data.dj.character, worn: data.worn || {}, level: data.level } : null);
  let shown = null;
  const showCard = (data) => {
    const k = JSON.stringify([data.worn, data.level, data.pet, data.dj?.character]);
    if (k === shown) { cardHost.querySelector('.kg-post')?.kgHeart?.set(data.hearts); return; }
    shown = k; cardHost.replaceChildren(cardOf(data));
  };
  const showNews = (diff, data) => {
    const [title, sub] = newsHead(diff);
    news.classList.remove('is-loading');
    news.classList.toggle('is-up', Boolean(diff?.up));
    const sid = data.season?.id || ctx.seasonId;
    const list = (diff?.changes || []).map((c) => { const [big, small] = newsText(c, { catalog: ctx.catalog, seasonId: sid }); return h('li', { class: 'kg-news-' + c.kind }, h('b', null, big), small ? h('small', null, small) : null); });
    // replaceChildren 에 null 을 넘기면 "null" 글자가 생기므로 빈 것은 뺀다
    news.replaceChildren(...[
      diff?.up ? h('span', { class: 'kg-confetti', 'aria-hidden': 'true' }, ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => h('i', { class: 'c' + i }))) : null,
      h('b', { class: 'kg-me-news-title' }, title), sub ? h('p', null, sub) : null,
      list.length ? h('ul', { class: 'kg-news' }, ...list) : null,
      ilink(ctx.app.link({ name: 'character', slug: me.slug, base: me.base }), { class: 'btn btn-line kg-me-go' }, '내 캐릭터 페이지', icon('arrow', { size: 16 }))].filter(Boolean));
  };
  const job = fastApi.person(me.slug, me.id);
  if (job.cached) showCard(job.cached);
  const ready = job.fresh.then((data) => {
    showCard(data);
    const { diff } = observe(storage, snapOf(data, { rank: rankOf(me) }));
    showNews(diff, data);
    return { news: diff.changes.length, look: lookOf(data) };
  }).catch((e) => {
    news.classList.remove('is-loading');
    if (e?.status === 404) {
      news.replaceChildren(h('b', { class: 'kg-me-news-title' }, '이번 시즌 아이디를 찾을 수 없어요'), h('p', null, '시즌이 바뀌면 아이디를 새로 만들어요. 새 아이디를 찾아 다시 정해 주세요.'),
        h('button', { type: 'button', class: 'btn btn-line', onclick: () => { clearMe(storage); document.dispatchEvent(new CustomEvent('kg-me')); onFind?.(); } }, '새 아이디 찾기'));
      if (!job.cached) cardHost.replaceChildren();
    } else news.replaceChildren(h('b', { class: 'kg-me-news-title' }, '지금은 새 소식을 불러오지 못했어요'), h('p', null, e?.message || '잠시 뒤에 다시 들어와 주세요.'));
    return { news: 0, look: lookOf(job.cached) };
  });
  return { el, ready, cachedLook: lookOf(job.cached) };
}
