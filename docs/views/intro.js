// 메인 페이지(스푼 DJ 키우기): 첫 화면(시즌 · 사이트 이름 · 한 줄 설명 · 아이디 찾기 칸 · 숫자 · 인기 캐릭터 무대)
//  · 찾은 결과 · 지금 인기 있는 캐릭터 · 새로 꾸민 캐릭터 · 이렇게 키워요 · 많이 입은 옷 TOP 5 · 키우기 중인 DJ · 예시.
// 없는 주소(notfound)와 마친 팬페이지 주소(ended)도 맨 위에 안내 상자를 붙여 여기서 보여 준다.
// 첫 화면 아래 칸은 목록(LANDING_SECTIONS)으로 그린다 — 칸을 더하거나 빼려면 목록만 고치면 된다.
import { h, icon } from '../lib/dom.js';
import { buildPath, DEMO_KIUGI_SLUG } from '../lib/route.js';
import { kiugiApi } from '../api.js';
import { loadCatalog, buildCatalog, slotName } from '../lib/kiugi-draw.js';
import { ilink, errorBox, nightTop, siteFoot, secHead, medal, statTiles, rail, BRAND } from './common.js';
import { seasonLine, dDay } from './kiugi.js';
import { characterCard, djCard, art, itemArt, heartCount, idText, baseOf } from './cards.js';

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

const section = (cls, head, ...children) => h('section', { class: 'kg-sec' + (cls ? ' ' + cls : '') }, head, ...children);
// 카드에 그릴 DJ 캐릭터 모양(home.djs 에서 slug 로)
const looks = (home) => new Map((home?.djs || []).map((d) => [d.slug, d.character]));
const cards = (list, home, ctx, opts = {}) => {
  const look = looks(home), seasonId = home?.season?.id || null;
  return list.map((c, i) => characterCard(c, { app: ctx.app, catalog: ctx.catalog, character: look.get(c.slug), seasonId, rank: opts.ranked ? i + 1 : null }));
};

// 아이디 찾기: 찾기 칸(첫 화면 안)과 결과 칸(첫 화면 바로 아래, 찾은 뒤에만 보임)을 한 번만 만들어 둘이 함께 쓴다.
function searchParts(ctx) {
  if (ctx.search) return ctx.search;
  const input = h('input', { id: 'kg_gq', type: 'search', maxlength: 24, placeholder: '아이디 (예: 밤톨)', autocomplete: 'off', enterkeyhint: 'search', lang: 'ko', 'aria-describedby': 'kg_gq_help' });
  // 찾기 칸 바로 아래 알림(글 검사·오류) — 결과 칸은 첫 화면 아래라 휴대폰에서 안 보일 수 있다
  const status = h('p', { class: 'form-status kg-find-status', role: 'status', 'aria-live': 'polite' });
  const note = h('p', { class: 'kg-found-note' });
  const grid = h('div', { class: 'kg-grid' });
  const title = h('h2', { class: 'sec-title', id: 'kg_found' }, '찾은 캐릭터');
  const results = h('section', { class: 'kg-sec kg-found', 'aria-labelledby': 'kg_found', hidden: true }, h('div', { class: 'kg-sec-head' }, h('div', { class: 'kg-sec-titles' }, title, note)), grid);
  const submit = h('button', { type: 'submit', class: 'btn btn-accent' }, '찾기');
  let seq = 0;
  const form = h('form', { class: 'kg-find', role: 'search', novalidate: true },
    h('label', { for: 'kg_gq', class: 'sr-only' }, '아이디로 찾기'),
    h('div', { class: 'kg-find-row' }, h('span', { class: 'kg-find-icon', 'aria-hidden': 'true' }, icon('search', { size: 20 })), input, submit),
    status,
    h('p', { class: 'kg-help', id: 'kg_gq_help' }, '방송 채팅에서 ', h('code', { class: 'kg-cmd' }, '!아이디'), ' 로 만든 아이디로 찾아요.'));
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
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
      note.textContent = n ? (r.more ? '비슷한 아이디가 더 있어요. 정확히 적으면 더 잘 찾아요.' : '') : '이번 시즌 아이디가 맞는지 확인해 주세요. 방송에서 냥을 모으면 5분쯤 뒤에 보여요.';
      grid.replaceChildren(...cards(r.results || [], home, ctx));
      results.hidden = false;
      results.scrollIntoView({ block: 'start', behavior: reduce() ? 'auto' : 'smooth' });
    } catch (err) { if (my === seq) status.textContent = err.message; }
    finally { if (my === seq) submit.disabled = false; }
  });
  return (ctx.search = { form, results });
}

// 첫 화면: 시즌 · 사이트 이름 · 한 줄 설명 · 찾기 칸 · 숫자 · 무대(인기 캐릭터 1~3등, 없으면 DJ 캐릭터). 자료는 받은 뒤에 채운다.
// heading: 위에 알림 상자가 있으면 'h2'(제목이 두 번 h1 이 되지 않게).
export function heroSection(ctx) {
  const season = h('span', { class: 'kg-season-text' }, '시즌 정보를 불러오는 중…');
  const dday = h('span', { class: 'kg-dday', hidden: true });
  const stats = h('div', { class: 'kg-hero-stats' });
  const cast = h('div', { class: 'kg-cast' });
  const caption = h('div', { class: 'kg-cast-caption' });
  const castWrap = h('div', { class: 'kg-cast-wrap' }, cast, caption);
  // 보여 줄 캐릭터가 없으면(아직 DJ 0명 · 못 받음) 빈 무대 대신 글만 한 칸으로
  const solo = () => { castWrap.hidden = true; hero.classList.add('solo'); };
  ctx.home().then((home) => {
    season.textContent = seasonLine(home.season);
    const left = home.season ? dDay(home.season) : null;
    if (left) { dday.textContent = left; dday.hidden = false; }
    if (home.totals?.djs) {
      stats.replaceChildren(...statTiles([
        { value: fmt(home.totals.djs), label: '키우기 중인 DJ' },
        { value: fmt(home.totals.people), label: '함께 키우는 청취자' }]));
    } else stats.replaceChildren(h('p', { class: 'kg-hero-note' }, '아직 키우기를 연 DJ가 없어요. 곧 만나요!'));
    const look = looks(home), seasonId = home.season?.id || null;
    const top = (home.popular?.length ? home.popular : home.recent || []).slice(0, 3)
      .map((c) => ({ c, character: look.get(c.slug), href: ctx.app.link({ name: 'character', slug: c.slug, base: baseOf(c.id) }) }));
    const list = top.length ? top : (home.djs || []).slice(0, 3).map((d) => ({ c: { id: `${d.name} 키우기`, worn: {}, level: 1 }, character: d.character, href: ctx.app.link({ name: 'kiugi', slug: d.slug }) }));
    if (!list.length) { solo(); return; }
    // 1등을 가운데에 크게(읽는 차례는 1·2·3등)
    cast.replaceChildren(...list.map((x, i) => ilink(x.href, { class: 'kg-cast-one' + (i === 0 ? ' lead' : i === 1 ? ' left' : ' right'), 'aria-label': `${top.length ? `${i + 1}등 ` : ''}${x.c.id} 보기` },
      art(ctx.catalog, x.character, x.c.worn, x.c.level, { seasonId, base: ctx.app.base, eager: true, kind: 'bare' }))));
    const lead = list[0];
    if (lead && top.length) {
      caption.replaceChildren(ilink(lead.href, { class: 'kg-cast-tag' },
        medal(1, { label: '1등' }),
        h('span', { class: 'kg-cast-name' }, ...idText(lead.c.id)),
        heartCount(lead.c.hearts),
        icon('arrow', { size: 16 })));
    }
  }).catch(() => { season.textContent = '지금은 시즌 정보를 불러오지 못했어요'; solo(); });
  // 휴대폰: 글 → 무대 → 숫자(무대가 첫 화면에 더 많이 보이게) · 넓은 화면: 왼쪽 글·숫자, 오른쪽 무대(styles.css)
  const hero = h('section', { class: 'kg-hero home' },
    h('div', { class: 'kg-hero-copy' },
      h('p', { class: 'kg-season' }, h('span', { class: 'kg-dot', 'aria-hidden': 'true' }), season, dday),
      h(ctx.heading, { class: 'display' }, BRAND),
      h('p', { class: 'intro' }, HERO_TEXT),
      h('div', { class: 'kg-hero-find', id: 'find' }, searchParts(ctx).form)),
    castWrap,
    stats);
  return hero;
}
// 찾은 결과(첫 화면 찾기 칸에서 찾으면 여기 보인다 — 찾기 전에는 숨김)
function searchSection(ctx) {
  return searchParts(ctx).results;
}
// 지금 인기 있는 캐릭터(하트 많은 순, 옆으로 넘겨 보기)
async function popularSection(ctx) {
  let home; try { home = await ctx.home(); } catch { return h('section', { class: 'kg-sec' }, errorBox('지금은 목록을 불러오지 못했어요. 잠시 뒤에 다시 해 주세요.', () => ctx.app.navigate(location.pathname + location.search, { replace: true }))); }
  if (!home.popular?.length) return section('', secHead('지금 인기 있는 캐릭터', '하트를 많이 받은 순서예요.'), h('p', { class: 'empty' }, EMPTY_POPULAR));
  const { track, controls } = rail(cards(home.popular, home, ctx, { ranked: true }), { label: '지금 인기 있는 캐릭터', className: 'lg' });
  return section('', secHead('지금 인기 있는 캐릭터', '하트를 많이 받은 순서예요. 하트는 하루에 한 번 보낼 수 있어요.', controls), track);
}
// 새로 꾸민 캐릭터(옆으로 넘겨 보기)
async function recentSection(ctx) {
  let home; try { home = await ctx.home(); } catch { return null; }
  if (!home.recent?.length) return section('', secHead('새로 꾸민 캐릭터', '방금 옷을 갈아입은 캐릭터예요.'), h('p', { class: 'empty' }, '아직 새로 꾸민 캐릭터가 없어요.'));
  const { track, controls } = rail(cards(home.recent, home, ctx), { label: '새로 꾸민 캐릭터', className: 'sm' });
  return section('', secHead('새로 꾸민 캐릭터', '방금 옷을 갈아입은 캐릭터예요.', controls), track);
}
// 이렇게 키워요(채팅 예시의 "먼치"는 DJ마다 다른 캐릭터 이름)
function howSection() {
  const step = (n, title, body, bubble, tag = '채팅') => h('li', { class: 'kg-step' },
    h('span', { class: 'kg-step-n', 'aria-hidden': 'true' }, n), h('b', null, title), h('p', null, body),
    bubble ? h('span', { class: 'kg-bubble' }, h('span', { class: 'kg-bubble-tag' }, tag), h('span', { class: 'kg-bubble-text' }, bubble)) : null);
  return section('kg-how', secHead('이렇게 키워요', 'DJ 방송 채팅에서 바로 할 수 있어요.'),
    h('ol', { class: 'kg-steps four' },
      step('1', '아이디 만들기', '방송 채팅에 아이디를 만들면 이번 시즌 동안 그 이름으로 보여요.', '!아이디 밤톨'),
      step('2', '냥 모으기', '채팅·좋아요·하트·후원·출석으로 냥이 모여요. 애정도가 오르면 레벨이 오르고 표정이 바뀌어요.', '!먼치', '내 캐릭터 보기'),
      step('3', '옷 입히기', '!옷장 을 치면 한벌옷·상의·하의·신발·악세사리·배경이 몇 벌씩 있는지, !옷장 상의 처럼 치면 번호와 함께 목록이 한 쪽씩 나와요(다음 쪽은 !옷장 상의2). 번호를 띄어 치면(!옷장 상의 11) 사서 바로 입어요. 옷 도감의 번호도 똑같아요.', '!옷장 상의 11'),
      step('4', '칭호 달기', 'Lv.10이 되면 시즌 칭호를 살 수 있어요. 칭호가 있으면 받는 냥이 늘어나고, 다음 시즌까지 효과가 있어요.', '!옷장 칭호')),
    h('p', { class: 'note' }, '예시의 "먼치"는 DJ마다 다른 캐릭터 이름이에요.'));
}
// 많이 입은 옷 TOP 5(막대는 1등 기준)
async function topItemsSection(ctx) {
  let home; try { home = await ctx.home(); } catch { return null; }
  const seasonId = home.season?.id || ctx.catalog.last;
  // 이번 시즌 목록에 있는 옷만(예전 판 먼치킨이 올린 예전 옷 id 는 그림·이름이 없어 뺀다)
  const top = (home.items || []).filter((x) => ctx.catalog.items[x.id]).slice(0, 5), max = Math.max(1, ...top.map((x) => Number(x.count) || 0));
  return section('kg-top-items', secHead('많이 입은 옷 TOP 5', '메인에 보이는 방송의 캐릭터가 입은 옷이에요.',
    ilink(ctx.app.link({ name: 'items' }), { class: 'kg-more' }, '옷 도감', icon('arrow', { size: 16 }))),
    top.length
      ? h('ol', { class: 'kg-rank' }, ...top.map((x, i) => {
        const it = ctx.catalog.items[x.id];
        return h('li', null,
          h('span', { class: 'kg-rank-art', 'aria-hidden': 'true' }, itemArt(ctx.catalog, x.id, { base: ctx.app.base, label: it?.name || x.id }), medal(i + 1, { className: 'kg-rank-n' })),
          h('span', { class: 'kg-rank-name' }, h('b', null, it?.name || x.id), it ? h('small', null, slotName(ctx.catalog, seasonId, it.slot)) : null),
          h('span', { class: 'kg-rank-count' }, `${fmt(x.count)}명`),
          h('progress', { class: 'kg-rank-bar', max, value: Number(x.count) || 0, 'aria-hidden': 'true' }));
      }))
      : h('p', { class: 'empty' }, '아직 옷을 입은 캐릭터가 없어요.'));
}
// 키우기 중인 DJ
async function djsSection(ctx) {
  let home; try { home = await ctx.home(); } catch { return null; }
  const seasonId = home.season?.id || null;
  return section('', secHead('키우기 중인 DJ', 'DJ 캐릭터를 누르면 그 방송의 키우기 페이지로 가요.'),
    home.djs?.length ? h('div', { class: 'kg-grid kg-djs' }, ...home.djs.map((d) => djCard(d, { app: ctx.app, catalog: ctx.catalog, seasonId }))) : h('p', { class: 'empty' }, '아직 키우기를 연 DJ가 없어요.'));
}
// 예시와 알림
function aboutSection(ctx) {
  const demo = buildPath(ctx.app.base, { name: 'kiugi', slug: DEMO_KIUGI_SLUG }) + '?demo=1';
  return h('section', { class: 'kg-banner' },
    h('div', { class: 'kg-banner-text' }, h('b', null, 'DJ 키우기 페이지는 이렇게 생겼어요'), h('p', null, '예시 페이지의 캐릭터와 아이디는 모두 지어낸 것이에요.')),
    ilink(demo, { class: 'btn btn-line' }, '예시 페이지 보기', icon('arrow', { size: 16 })));
}

// 첫 화면 아래 칸 목록(차례대로). 칸 = (ctx) => 요소 | null | Promise<요소 | null>.
// ctx = {app, heading, home: () => Promise(메인 자료, 한 번만 받음), catalog(시즌 목록)}.
// 서버에서 받아 오는 칸은 Promise 를 돌려주면 자리를 먼저 잡아 두었다가 받은 뒤에 채운다(실패하면 칸을 뺀다).
export const LANDING_SECTIONS = [searchSection, popularSection, recentSection, howSection, topItemsSection, djsSection, aboutSection];

function mount(main, make, ctx) {
  let out;
  try { out = make(ctx); } catch (e) { console.error(e); return; }
  if (!out || typeof out.then !== 'function') { if (out) main.append(out); return; }
  const slot = h('div', { class: 'intro-slot', 'aria-busy': 'true' });
  main.append(slot);
  out.then((node) => { if (node) slot.replaceWith(node); else slot.remove(); }, (e) => { console.error(e); slot.remove(); });
}

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
    siteFoot(app, '이 사이트에는 청취자가 방송에서 직접 만든 아이디와 레벨·입은 옷·하트만 보여요.')));
  let homeJob = null;
  const catalog = await loadCatalog(app.base).catch(() => buildCatalog([]));
  const ctx = { app, heading: box ? 'h2' : 'h1', catalog, home: () => (homeJob ||= kiugiApi.home()) };
  heroHost.replaceChildren(heroSection(ctx));
  for (const make of LANDING_SECTIONS) mount(main, make, ctx);
}
