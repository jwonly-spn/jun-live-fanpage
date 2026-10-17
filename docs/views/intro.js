// 메인 페이지(스푼 DJ 키우기) — 2026-10-18 사이트 새 구조(사용자 "화살표 넘기기 말고, 큰 게임 회사처럼 — 매일 들어와 내 캐릭터를 확인하고 싶게, 빠릿빠릿하게"):
//  첫 화면: DJ 동그라미 줄(키우기 중인 DJ — 맨 앞은 내 캐릭터) · 시즌 · 사이트 이름 · 한 줄 설명 · 아이디로 찾기 · 숫자 + 오늘의 주인공(하트 1위 큰 사진)
//  그 아래(LANDING_SECTIONS 차례): 찾은 결과 · 내 캐릭터(지난 방문 뒤 달라진 것 — 고르지 않았으면 고르는 법) · 오늘의 하트 미션·연속 방문 ·
//   둘러보기(탭: 인기 · 새로 꾸민 · DJ별 — 큰 사진 카드, 휴대폰 한 장 · 태블릿 두 장 · PC 세 장) · 많이 입은 옷 TOP 5 · 이렇게 키워요.
//  빠르게: 지난번 메인 답(lib/swr.js — 이 브라우저)으로 먼저 그리고 새 답이 오면 달라진 칸만 다시 그린다. 캐릭터 사진은 lib/raster.js(한 번 그려 기억).
// 없는 주소(notfound)와 마친 팬페이지 주소(ended)도 맨 위에 안내 상자를 붙여 여기서 보여 준다.
import { h, icon, store } from '../lib/dom.js';
import { kiugiApi, fastApi } from '../api.js';
import { loadCatalog, buildCatalog, slotName, titleOpenDate } from '../lib/kiugi-draw.js';
import { sameData } from '../lib/swr.js';
import { getMe, bumpStreak } from '../lib/me.js';
import { ilink, errorBox, nightTop, siteFoot, secHead, medal, statTiles, BRAND } from './common.js';
import { seasonLine, dDay } from './kiugi.js';
import { itemArt } from './cards.js';
import { postCard, spotlight, storyRings, todayStrip, meSection, browserStore, PIN_LABEL } from './feed.js';

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
const NOTICE = {
  notfound: ['페이지를 찾을 수 없어요', '주소가 맞는지 확인해 주세요.'],
  ended: ['팬페이지 서비스를 마쳤어요', '그동안 함께해 주셔서 고마워요. DJ 키우기 페이지는 DJ가 알려 준 주소로 계속 볼 수 있어요.'],
};
// 찾기 칸 규칙(서버와 같음): 앞 부분만("밤톨") 또는 전체 아이디("밤톨#먼치")
const QUERY_RULE = /^[가-힣]{1,6}(#[가-힣A-Za-z0-9]{1,8})?$/;
const idKey = (s) => String(s ?? '').normalize('NFC').replace(/\s+/g, '');
export const EMPTY_POPULAR = '아직 하트를 받은 캐릭터가 없어요. 마음에 드는 캐릭터에게 첫 하트를 보내 보세요!';
export const HERO_TEXT = '청취자가 방송에서 키운 DJ 캐릭터를 한곳에서 구경해요. 마음에 드는 캐릭터에게 하트를 보내 보세요.';
// 둘러보기 탭(이 브라우저에 마지막 탭을 기억)
export const FEED_TABS = Object.freeze([
  { id: 'popular', name: '인기', title: '지금 인기 있는 캐릭터', sub: '하트를 많이 받은 순서예요. 하트는 캐릭터마다 하루에 한 번 보낼 수 있어요.' },
  { id: 'recent', name: '새로 꾸민', title: '새로 꾸민 캐릭터', sub: '방금 옷을 갈아입은 캐릭터예요.' },
  { id: 'djs', name: 'DJ별', title: '키우기 중인 DJ', sub: '방송마다 이번 시즌 1~3등이에요. DJ를 누르면 그 방송의 키우기 페이지로 가요.' },
]);
const TAB_KEY = 'kg_tab';

const section = (cls, head, ...children) => h('section', { class: 'kg-sec' + (cls ? ' ' + cls : '') }, head, ...children);
// 카드에 그릴 DJ 캐릭터 모양·이름(home.djs 에서 slug 로)
function feedCtx(ctx, home) {
  const djs = new Map((home?.djs || []).map((d) => [d.slug, d]));
  return { app: ctx.app, catalog: ctx.catalog, season: home?.season || null, seasonId: home?.season?.id || null, lookOf: (slug) => djs.get(slug)?.character || null, djNameOf: (slug) => djs.get(slug)?.name || '' };
}
const cardKey = (c) => `${c.slug}/${c.id}`;
// 메인 인기 순위(내 캐릭터 소식 — 인기 12 안이면 몇 위)
export function popularRank(home, me) {
  const i = (home?.popular || []).findIndex((c) => c.slug === me?.slug && String(c.id).normalize('NFC') === me?.id);
  return i < 0 ? null : i + 1;
}
// 오늘의 주인공: 한국 날짜마다 바뀐다(매일 들어올 이유) — 인기 6위 안에서 날짜로 한 명(인기가 없으면 새로 꾸민 캐릭터에서). 같은 날은 누구에게나 같은 캐릭터.
export function spotlightPick(home, now = Date.now()) {
  const day = Math.floor((now + 9 * 3600000) / 86400000);
  const pop = (home?.popular || []).slice(0, 6), recent = (home?.recent || []).slice(0, 6);
  if (pop.length) { const i = day % pop.length; return { card: pop[i], why: `인기 ${i + 1}위 · 하트 ${fmt(pop[i].hearts)}개` }; }
  if (recent.length) return { card: recent[day % recent.length], why: '새로 꾸민 캐릭터' };
  return null;
}

// 아이디 찾기: 찾기 칸(첫 화면 안)과 결과 칸(첫 화면 바로 아래, 찾은 뒤에만 보임)을 한 번만 만들어 둘이 함께 쓴다.
//  찾은 카드에는 "이게 나예요"(내 캐릭터 고르기) 단추가 붙는다.
function searchParts(ctx) {
  if (ctx.search) return ctx.search;
  const input = h('input', { id: 'kg_gq', type: 'search', maxlength: 24, placeholder: '아이디 (예: 밤톨)', autocomplete: 'off', enterkeyhint: 'search', lang: 'ko', 'aria-describedby': 'kg_gq_help' });
  // 찾기 칸 바로 아래 알림(글 검사·오류) — 결과 칸은 첫 화면 아래라 휴대폰에서 안 보일 수 있다
  const status = h('p', { class: 'form-status kg-find-status', role: 'status', 'aria-live': 'polite' });
  const note = h('p', { class: 'kg-found-note' });
  const grid = h('div', { class: 'kg-feed-grid' });
  const title = h('h2', { class: 'sec-title', id: 'kg_found' }, '찾은 캐릭터');
  const results = h('section', { class: 'kg-sec kg-found', 'aria-labelledby': 'kg_found', hidden: true }, h('div', { class: 'kg-sec-head' }, h('div', { class: 'kg-sec-titles' }, title, note)), grid);
  const submit = h('button', { type: 'submit', class: 'btn btn-accent' }, '찾기');
  let seq = 0;
  const form = h('form', { class: 'kg-find', role: 'search', novalidate: true },
    h('label', { for: 'kg_gq', class: 'sr-only' }, '아이디로 찾기'),
    h('div', { class: 'kg-find-row' }, h('span', { class: 'kg-find-icon', 'aria-hidden': 'true' }, icon('search', { size: 20 })), input, submit),
    status,
    h('p', { class: 'kg-help', id: 'kg_gq_help' }, '방송 채팅에서 ', h('code', { class: 'kg-cmd' }, '!아이디'), ' 로 만든 아이디로 찾아요. 찾은 캐릭터에서 ', h('b', null, PIN_LABEL), '를 누르면 내 캐릭터가 돼요.'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const my = ++seq, key = idKey(input.value);
    if (!key) { status.textContent = '아이디를 적어 주세요.'; input.focus(); return; }
    if (!QUERY_RULE.test(key)) { status.textContent = '아이디는 한글 1~6자예요. 예: 밤톨 또는 밤톨#먼치'; input.focus(); return; }
    submit.disabled = true; status.textContent = '찾는 중…';
    try {
      const [r, home] = await Promise.all([kiugiApi.search(key), ctx.home().catch(() => null)]);
      if (my !== seq) return;
      const n = r.results?.length || 0;
      status.textContent = n ? `${n}${r.more ? '+' : ''}명을 찾았어요. 아래에서 보세요.` : `'${key}' 아이디를 찾지 못했어요.`;
      title.textContent = n ? `'${key}' 찾은 캐릭터` : `'${key}' 아이디를 찾지 못했어요`;
      note.textContent = n ? (r.more ? '비슷한 아이디가 더 있어요. 정확히 적으면 더 잘 찾아요.' : `내 캐릭터면 ${PIN_LABEL}를 눌러 두세요. 매일 달라진 점을 알려 드려요.`) : '이번 시즌 아이디가 맞는지 확인해 주세요. 방송에서 냥을 모으면 5분쯤 뒤에 보여요.';
      const fc = feedCtx(ctx, home);
      grid.replaceChildren(...(r.results || []).map((c, i) => postCard(c, fc, { pin: true, tag: i === 0 && r.exact ? '찾았어요' : null, eager: i < 2 })));
      results.hidden = false;
      results.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
    } catch (err) { if (my === seq) status.textContent = err.message; }
    finally { if (my === seq) submit.disabled = false; }
  });
  const focus = () => { const host = document.getElementById('find'); host?.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); input.focus({ preventScroll: true }); status.textContent = `내 아이디를 찾아 ${PIN_LABEL}를 눌러 주세요.`; };
  return (ctx.search = { form, results, focus });
}
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// 첫 화면: DJ 동그라미 줄 · 시즌 · 사이트 이름 · 한 줄 설명 · 찾기 칸 · 숫자 + 오늘의 주인공. 자료는 받은 뒤에 채운다(지난번 답이 있으면 바로).
// heading: 위에 알림 상자가 있으면 'h2'(제목이 두 번 h1 이 되지 않게).
export function heroSection(ctx) {
  const season = h('span', { class: 'kg-season-text' }, '시즌 정보를 불러오는 중…');
  const dday = h('span', { class: 'kg-dday', hidden: true });
  const stats = h('div', { class: 'kg-hero-stats' });
  const ringHost = h('div', { class: 'kg-ring-host' }, h('div', { class: 'kg-rings is-skeleton', 'aria-hidden': 'true' }, h('ul', null, ...[1, 2, 3, 4, 5].map(() => h('li', null, h('span', { class: 'kg-ring' }, h('span', { class: 'kg-ring-pic' }), h('span', { class: 'kg-ring-name' }, ' ')))))));
  const spotHost = h('div', { class: 'kg-spot-host' }, h('div', { class: 'kg-spot is-skeleton', 'aria-hidden': 'true' }, h('div', { class: 'kg-spot-head' }, h('span', { class: 'kg-spot-eyebrow' }, '오늘의 주인공')), h('div', { class: 'kg-post spot' }, h('div', { class: 'kg-post-media' }, h('div', { class: 'kg-photo photo' })), h('div', { class: 'kg-post-bar' }))));
  const hero = h('section', { class: 'kg-hero home' },
    h('div', { class: 'kg-hero-copy' },
      h('p', { class: 'kg-season' }, h('span', { class: 'kg-dot', 'aria-hidden': 'true' }), season, dday),
      h(ctx.heading, { class: 'display' }, BRAND),
      h('p', { class: 'intro' }, HERO_TEXT),
      h('div', { class: 'kg-hero-find', id: 'find' }, searchParts(ctx).form),
      stats));
  const meNews = h('div', { class: 'kg-me-ping', hidden: true });
  // 휴대폰: 동그라미 줄 → (새 소식) → 글·찾기 → 오늘의 주인공 · 넓은 화면: 왼쪽에 동그라미 줄·글·찾기, 오른쪽에 오늘의 주인공(styles.css .kg-top)
  const top = h('div', { class: 'kg-top' }, ringHost, meNews, hero, spotHost);
  // home 을 받을 때마다(지난번 답 → 새 답) 채운다
  ctx.paintHero = (home, { me = null, meLook = null, news = 0 } = {}) => {
    season.textContent = seasonLine(home.season);
    const left = home.season ? dDay(home.season) : null;
    dday.hidden = !left; if (left) dday.textContent = left;
    stats.replaceChildren(...(home.totals?.djs
      ? statTiles([{ value: fmt(home.totals.djs), label: '키우기 중인 DJ' }, { value: fmt(home.totals.people), label: '함께 키우는 청취자' }])
      : [h('p', { class: 'kg-hero-note' }, '아직 키우기를 연 DJ가 없어요. 곧 만나요!')]));
    const fc = feedCtx(ctx, home);
    // 내 캐릭터에 새 소식이 있으면 동그라미 줄 아래 한 줄(누르면 내 캐릭터 칸으로)
    meNews.hidden = !(me && news);
    if (me && news) meNews.replaceChildren(ilink(ctx.app.link({ name: 'intro' }) + '#me', { class: 'kg-me-ping-link' }, icon('sparkle', { size: 16 }), h('span', null, `내 캐릭터에 새 소식 ${news}개`), icon('arrow', { size: 16 })));
    ringHost.replaceChildren(storyRings(home.djs, fc, { me, meLook, news, onMe: () => (me ? document.getElementById('me')?.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }) : searchParts(ctx).focus()) }));
    const pick = spotlightPick(home);
    if (!pick) { spotHost.replaceChildren(); top.classList.add('solo'); return; }
    top.classList.remove('solo');
    const k = cardKey(pick.card) + JSON.stringify([pick.card.worn, pick.card.level, pick.card.pet]);
    if (spotHost.dataset.k === k) { spotHost.querySelector('.kg-post')?.kgHeart?.set(pick.card.hearts); return; }
    spotHost.dataset.k = k;
    spotHost.replaceChildren(spotlight(pick.card, fc, { why: pick.why }));
  };
  ctx.paintHeroFail = () => { season.textContent = '지금은 시즌 정보를 불러오지 못했어요'; spotHost.replaceChildren(); ringHost.replaceChildren(); top.classList.add('solo'); };
  return top;
}
// 찾은 결과(첫 화면 찾기 칸에서 찾으면 여기 보인다 — 찾기 전에는 숨김)
function searchSection(ctx) {
  return searchParts(ctx).results;
}
// 내 캐릭터(지난 방문 뒤 달라진 것 — 고르지 않았으면 고르는 법) + 오늘의 하트 미션 · 연속 방문(한국 날짜 — 이 브라우저에만).
//  "이게 나예요"·"다른 캐릭터로"를 누르면 내 캐릭터 칸을 다시 그린다.
function meBlock(ctx) {
  const slot = h('div', { class: 'kg-me-slot' });
  const host = h('div', { class: 'kg-daily' }, slot, todayStrip({ streak: bumpStreak(browserStore()) }));
  const draw = () => {
    const m = meSection(ctx, { onFind: () => searchParts(ctx).focus(), rankOf: (me) => popularRank(fastApi.peekHome(), me) });
    slot.replaceChildren(m.el);
    ctx.meState = { me: getMe(browserStore()), meLook: m.cachedLook || null, news: 0 };
    host.classList.toggle('has-me', Boolean(ctx.meState.me));
    m.ready.then((r) => { ctx.meState = { ...ctx.meState, meLook: r.look || ctx.meState.meLook, news: r.news }; ctx.repaintHero?.(); });
  };
  draw();
  const again = () => { if (!host.isConnected) { document.removeEventListener('kg-me', again); return; } draw(); ctx.repaintHero?.(); };
  document.addEventListener('kg-me', again);
  return host;
}
// 둘러보기: 탭(인기 · 새로 꾸민 · DJ별) + 큰 사진 카드. 카드는 같은 캐릭터면 다시 만들지 않는다(새 답이 와도 깜박이지 않게).
function feedBlock(ctx) {
  let tab = store.get(TAB_KEY, 'popular');
  if (!FEED_TABS.some((t) => t.id === tab)) tab = 'popular';
  const panel = h('div', { class: 'kg-feed-panel', role: 'tabpanel', id: 'kg_feed_panel', tabindex: '-1' });
  const btns = new Map();
  const tabs = h('div', { class: 'kg-tabs', role: 'tablist', 'aria-label': '캐릭터 둘러보기' }, ...FEED_TABS.map((t) => {
    const b = h('button', { type: 'button', role: 'tab', class: 'kg-tab', id: 'kg_tab_' + t.id, 'aria-controls': 'kg_feed_panel', 'aria-selected': String(t.id === tab), onclick: () => pick(t.id, true) }, t.name);
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const i = FEED_TABS.findIndex((x) => x.id === tab), next = FEED_TABS[(i + (e.key === 'ArrowRight' ? 1 : FEED_TABS.length - 1)) % FEED_TABS.length];
      pick(next.id, true); btns.get(next.id)?.focus();
    });
    btns.set(t.id, b);
    return b;
  }));
  const el = h('section', { class: 'kg-feed', id: 'feed', 'aria-label': '캐릭터 둘러보기' }, h('div', { class: 'kg-tabs-bar' }, tabs), panel);
  const cards = new Map();
  const card = (c, fc, opts) => {
    const k = cardKey(c) + JSON.stringify([c.worn, c.level, c.pet, opts.rank || 0, opts.tag || '']);
    let node = cards.get(k);
    if (!node) { node = postCard(c, fc, opts); cards.set(k, node); } else node.kgHeart?.set(c.hearts);
    return node;
  };
  let home = null;
  const head = (t) => h('div', { class: 'kg-feed-head' }, h('h2', { class: 'sec-title' }, t.title), h('p', null, t.sub));
  const paint = () => {
    const t = FEED_TABS.find((x) => x.id === tab);
    panel.setAttribute('aria-labelledby', 'kg_tab_' + t.id);
    if (!home) { panel.replaceChildren(head(t), h('div', { class: 'kg-feed-grid' }, ...[1, 2, 3].map(() => h('div', { class: 'kg-post is-skeleton', 'aria-hidden': 'true' }, h('div', { class: 'kg-post-media' }, h('div', { class: 'kg-photo photo' })), h('div', { class: 'kg-post-bar' }))))); return; }
    const fc = feedCtx(ctx, home);
    if (t.id === 'popular') {
      panel.replaceChildren(head(t), home.popular?.length
        ? h('div', { class: 'kg-feed-grid' }, ...home.popular.map((c, i) => card(c, fc, { rank: i + 1, eager: i < 1 })))
        : h('p', { class: 'empty' }, EMPTY_POPULAR));
    } else if (t.id === 'recent') {
      panel.replaceChildren(head(t), home.recent?.length
        ? h('div', { class: 'kg-feed-grid' }, ...home.recent.map((c, i) => card(c, fc, { tag: '새로 꾸밈', eager: i < 1 })))
        : h('p', { class: 'empty' }, '아직 새로 꾸민 캐릭터가 없어요.'));
    } else {
      panel.replaceChildren(head(t), home.djs?.length ? h('div', { class: 'kg-dj-feed' }, ...home.djs.map((d) => djRow(d, fc))) : h('p', { class: 'empty' }, '아직 키우기를 연 DJ가 없어요.'));
    }
  };
  // DJ별: DJ 마다 한 줄(동그라미 · 이름 · 청취자 수 · 페이지로) + 그 방송 1~3등 큰 카드(휴대폰은 옆으로 넘겨 보기 — 화살표 없이 손가락으로)
  const rows = new Map();
  const djRow = (d, fc) => {
    if (rows.has(d.slug)) return rows.get(d.slug);
    const list = h('div', { class: 'kg-dj-cards' }, ...[1, 2, 3].map(() => h('div', { class: 'kg-post is-skeleton', 'aria-hidden': 'true' }, h('div', { class: 'kg-post-media' }, h('div', { class: 'kg-photo photo' })), h('div', { class: 'kg-post-bar' }))));
    const row = h('section', { class: 'kg-dj-row', 'aria-label': `${d.name} 키우기` },
      ilink(ctx.app.link({ name: 'kiugi', slug: d.slug }), { class: 'kg-dj-row-head' },
        h('span', { class: 'kg-dj-row-name' }, h('b', null, `${d.name} 키우기`), h('small', null, `청취자 ${fmt(d.count)}명`)),
        h('span', { class: 'kg-more' }, '페이지 보기', icon('arrow', { size: 16 }))),
      list);
    const fill = (page) => {
      const top = Array.isArray(page?.top) ? page.top.slice(0, 3) : [];
      list.replaceChildren(...(top.length ? top.map((p, i) => postCard({ ...p, slug: d.slug, djName: d.name }, { ...fc, lookOf: () => page.character || d.character }, { rank: i + 1, showDj: false })) : [h('p', { class: 'empty' }, '아직 순위가 없어요.')]));
    };
    const job = fastApi.page(d.slug);
    if (job.cached) fill(job.cached);
    job.fresh.then((p) => { if (!job.cached || !sameData(p, job.cached)) fill(p); }, () => { if (!job.cached) list.replaceChildren(h('p', { class: 'empty' }, '지금은 이 방송을 불러오지 못했어요.')); });
    rows.set(d.slug, row);
    return row;
  };
  const pick = (id, user = false) => {
    tab = id; store.set(TAB_KEY, id);
    for (const [k, b] of btns) { b.setAttribute('aria-selected', String(k === id)); b.tabIndex = k === id ? 0 : -1; }
    paint();
    // 아래로 내려 본 뒤 탭을 바꾸면 목록 처음으로
    if (user && tabs.getBoundingClientRect().top <= (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--head-h')) || 56) + 4) el.scrollIntoView({ block: 'start' });
  };
  for (const [k, b] of btns) b.tabIndex = k === tab ? 0 : -1;
  ctx.paintFeed = (data) => { home = data; paint(); };
  paint();
  return el;
}
// 이렇게 키워요(채팅 예시의 "먼치"는 DJ마다 다른 캐릭터 이름). body 는 글 또는 [글, 명령어 칸, …]
//  2026-10-14: 냥 모으기에 !산책(10분에 한 번 산책을 다녀와 냥을 받는다), 칭호 달기에 상점 여는 날(시즌 목록 — 열리기 전에만)과 입혀 보기에서 달아 보기
function howSection(ctx) {
  const cmd = (t) => h('code', { class: 'kg-cmd' }, t);
  const step = (n, title, body, bubble, tag = '채팅') => h('li', { class: 'kg-step' },
    h('span', { class: 'kg-step-n', 'aria-hidden': 'true' }, n), h('b', null, title), h('p', null, body),
    bubble ? h('span', { class: 'kg-bubble' }, h('span', { class: 'kg-bubble-tag' }, tag), h('span', { class: 'kg-bubble-text' }, bubble)) : null);
  const opens = titleOpenDate(ctx?.catalog?.seasons?.[ctx?.catalog?.last]?.rewardRule);
  return section('kg-how', secHead('이렇게 키워요', 'DJ 방송 채팅에서 바로 할 수 있어요.'),
    h('ol', { class: 'kg-steps four' },
      step('1', '아이디 만들기', ['방송 채팅에 아이디를 만들면 이번 시즌 동안 그 이름으로 보여요(한 사람 한 아이디). 바꾸려면 ', cmd('!아이디변경 새아이디'), ' 를 쳐요.'], '!아이디 밤톨'),
      step('2', '냥 모으기', ['채팅·좋아요·하트·후원·출석으로 냥이 모여요. ', cmd('!산책'), '으로 산책을 다녀와도 냥을 받아요(쉬는 시간은 DJ가 정해요). 애정도가 오르면 레벨이 오르고 표정이 바뀌어요.'], '!먼치', '내 캐릭터 보기'),
      step('3', '옷 입히기', '옷은 여기 키우기.com에서 골라요. 옷 도감이나 내 캐릭터 페이지의 "입혀 보기"에서 직접 입어 보고, 마음에 드는 옷의 명령어를 복사해 방송 채팅에 붙여 넣으면 바로 사서 입어요. 모자도 하나 쓸 수 있어요. 방송 채팅에는 옷 목록이 나오지 않아요.', '!옷장 상의11 하의3 모자5'),
      step('4', '칭호 달기', `Lv.10이 되면 시즌 칭호를 살 수 있어요${opens ? `(${opens}부터 팔아요)` : ''}. 칭호가 있으면 받는 냥이 늘어나고, 다음 시즌까지 효과가 있어요. 칭호 번호는 옷 도감에서 복사하고, 입혀 보기에서 옷과 함께 달아 볼 수도 있어요.`, '!옷장 칭호 1')),
    h('p', { class: 'note' }, '예시의 "먼치"는 DJ마다 다른 캐릭터 이름이에요.'));
}
// 많이 입은 옷 TOP 5(막대는 1등 기준)
function topItemsSection(ctx) {
  const host = h('section', { class: 'kg-sec kg-top-items' }, secHead('많이 입은 옷 TOP 5', '메인에 보이는 방송의 캐릭터가 입은 옷이에요.',
    ilink(ctx.app.link({ name: 'items' }), { class: 'kg-more' }, '옷 도감', icon('arrow', { size: 16 }))));
  const body = h('div', { class: 'kg-rank-host' });
  host.append(body);
  let shown = null;
  ctx.paintTop = (home) => {
    const seasonId = home.season?.id || ctx.catalog.last;
    // 이번 시즌 목록에 있는 옷만(예전 판 먼치킨이 올린 예전 옷 id 는 그림·이름이 없어 뺀다)
    const top = (home.items || []).filter((x) => ctx.catalog.items[x.id]).slice(0, 5), max = Math.max(1, ...top.map((x) => Number(x.count) || 0));
    const k = JSON.stringify(top);
    if (k === shown) return;
    shown = k;
    body.replaceChildren(top.length
      ? h('ol', { class: 'kg-rank' }, ...top.map((x, i) => {
        const it = ctx.catalog.items[x.id];
        return h('li', null,
          h('span', { class: 'kg-rank-art', 'aria-hidden': 'true' }, itemArt(ctx.catalog, x.id, { base: ctx.app.base, label: it?.name || x.id }), medal(i + 1, { className: 'kg-rank-n' })),
          h('span', { class: 'kg-rank-name' }, h('b', null, it?.name || x.id), it ? h('small', null, slotName(ctx.catalog, seasonId, it.slot)) : null),
          h('span', { class: 'kg-rank-count' }, `${fmt(x.count)}명`),
          h('progress', { class: 'kg-rank-bar', max, value: Number(x.count) || 0, 'aria-hidden': 'true' }));
      }))
      : h('p', { class: 'empty' }, '아직 옷을 입은 캐릭터가 없어요.'));
  };
  return host;
}
// 첫 화면 아래 칸 목록(차례대로). 칸 = (ctx) => 요소 | null. 서버 자료는 ctx.paint*(home) 로 받은 뒤에 채운다.
// ctx = {app, heading, home: () => Promise(메인 자료), catalog(시즌 목록)}.
// 예시 페이지 칸("DJ 키우기 페이지는 이렇게 생겼어요 · 예시 페이지 보기")은 2026-10-15 뺐다(사용자 "지어낸 캐릭터들 다 삭제") — 실제 사이트에는 진짜 DJ·캐릭터만.
export const LANDING_SECTIONS = [searchSection, meBlock, feedBlock, topItemsSection, howSection];

export async function renderIntro(root, app, { notice = null } = {}) {
  const box = NOTICE[notice] || null;
  document.title = box ? `${box[0]} · ${BRAND}` : BRAND;
  const heroHost = h('div', { class: 'kg-wrap' });
  const main = h('main', { id: 'main', class: 'fp-main intro-main', tabindex: '-1' });
  root.replaceChildren(h('div', { class: 'fp intro' },
    ...nightTop(app),
    h('div', { class: 'kg-night' },
      box ? h('div', { class: 'kg-wrap' }, h('div', { class: 'kg-notice', role: 'alert' }, h('h1', { class: 'kg-notice-title' }, box[0]), h('p', null, box[1]))) : null,
      heroHost),
    main,
    siteFoot(app, '이 사이트에는 청취자가 방송에서 직접 만든 아이디와 레벨·입은 옷·하트만 보여요. 내 캐릭터·연속 방문·오늘 보낸 하트는 이 브라우저에만 기억해요.')));
  const catalog = await loadCatalog(app.base).catch(() => buildCatalog([]));
  const job = fastApi.home();
  const ctx = { app, heading: box ? 'h2' : 'h1', catalog, home: () => job.fresh };
  heroHost.replaceChildren(heroSection(ctx));
  for (const make of LANDING_SECTIONS) { try { const el = make(ctx); if (el) main.append(el); } catch (e) { console.error(e); } }
  let last = null;
  const paint = (home) => {
    last = home;
    ctx.paintHero(home, ctx.meState || {});
    ctx.paintFeed?.(home);
    ctx.paintTop?.(home);
  };
  ctx.repaintHero = () => { if (last) ctx.paintHero(last, ctx.meState || {}); };
  // 지난번 답이 있으면 바로 그리고, 새 답이 다르면 다시
  if (job.cached) paint(job.cached);
  try {
    const fresh = await job.fresh;
    if (!job.cached || !sameData(fresh, job.cached)) paint(fresh);
  } catch (e) {
    if (job.cached) return; // 지난번 모습 그대로 둔다
    ctx.paintHeroFail();
    main.querySelector('.kg-feed-panel')?.replaceChildren(errorBox('지금은 목록을 불러오지 못했어요. 잠시 뒤에 다시 해 주세요.', () => app.navigate(location.pathname + location.search, { replace: true })));
    main.querySelector('.kg-top-items')?.remove();
  }
}
