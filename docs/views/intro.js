// 메인 페이지(스푼 DJ 키우기): 밤하늘 첫 화면(시즌·참여 수·인기 캐릭터 무대) · 아이디로 찾기 · 지금 인기 있는 캐릭터 · 새로 꾸민 캐릭터
//  · 이렇게 키워요 · 많이 입은 옷 TOP 5 · 키우기 중인 DJ · 예시.
// 없는 주소(notfound)와 마친 팬페이지 주소(ended)도 맨 위에 안내 상자를 붙여 여기서 보여 준다.
// 첫 화면 아래 칸은 목록(LANDING_SECTIONS)으로 그린다 — 칸을 더하거나 빼려면 목록만 고치면 된다.
import { h, icon } from '../lib/dom.js';
import { buildPath, DEMO_KIUGI_SLUG } from '../lib/route.js';
import { kiugiApi } from '../api.js';
import { loadCatalog, buildCatalog, slotName } from '../lib/kiugi-draw.js';
import { ilink, errorBox, nightTop, siteFoot, secHead, crest, statTiles, BRAND } from './common.js';
import { seasonLine, seasonKicker, dDay } from './kiugi.js';
import { characterCard, djCard, art, itemArt } from './cards.js';

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

const section = (head, ...children) => h('section', { class: 'kg-sec' }, head, ...children);
// 카드에 그릴 DJ 캐릭터 모양(home.djs 에서 slug 로)
const looks = (home) => new Map((home?.djs || []).map((d) => [d.slug, d.character]));
const cards = (list, home, ctx, opts = {}) => {
  const look = looks(home), seasonId = home?.season?.id || null;
  return list.map((c, i) => characterCard(c, { app: ctx.app, catalog: ctx.catalog, character: look.get(c.slug), seasonId, rank: opts.ranked ? i + 1 : null }));
};

// 밤하늘 첫 화면: 시즌 띠 · 사이트 이름 · 한 줄 설명 · 참여 수 · 무대(인기 캐릭터 1~3등, 없으면 DJ 캐릭터). 자료는 받은 뒤에 채운다.
// heading: 위에 알림 상자가 있으면 'h2'(제목이 두 번 h1 이 되지 않게).
export function heroSection(ctx) {
  const kicker = h('span', { class: 'kg-kicker', 'aria-hidden': 'true' }, 'SEASON');
  const pill = h('span', { class: 'kg-pill season' }, '시즌 정보를 불러오는 중…');
  const stats = h('div', { class: 'kg-hero-stats' });
  const cast = h('div', { class: 'kg-cast', 'aria-hidden': 'true' });
  ctx.home().then((home) => {
    kicker.textContent = seasonKicker(home.season);
    pill.textContent = seasonLine(home.season);
    const left = home.season ? dDay(home.season) : null;
    if (home.totals?.djs) {
      stats.replaceChildren(...statTiles([
        { value: fmt(home.totals.djs), label: '키우기 중인 DJ' },
        { value: fmt(home.totals.people), label: '함께 키우는 청취자' },
        left ? { value: left, label: '시즌 끝까지' } : null]));
    } else stats.replaceChildren(h('p', { class: 'kg-hero-note' }, '아직 키우기를 연 DJ가 없어요. 곧 만나요!'));
    const look = looks(home), seasonId = home.season?.id || null;
    const top = (home.popular?.length ? home.popular : home.recent || []).slice(0, 3)
      .map((c) => ({ character: look.get(c.slug), worn: c.worn, level: c.level }));
    const list = top.length ? top : (home.djs || []).slice(0, 3).map((d) => ({ character: d.character, worn: {}, level: 1 }));
    // 1등을 가운데에 크게
    const order = list.length === 3 ? [list[1], list[0], list[2]] : list;
    cast.replaceChildren(...order.map((c) => h('div', { class: 'kg-cast-one' + (c === list[0] ? ' lead' : '') },
      art(ctx.catalog, c.character, c.worn, c.level, { seasonId, base: ctx.app.base, eager: true, kind: 'night' }))));
  }).catch(() => { kicker.textContent = 'SEASON'; pill.textContent = '지금은 시즌 정보를 불러오지 못했어요'; });
  const home = ctx.app.link({ name: 'intro' });
  return h('section', { class: 'kg-hero home' },
    h('div', { class: 'kg-hero-copy' }, kicker, pill, h(ctx.heading, { class: 'display' }, BRAND), h('p', { class: 'intro' }, HERO_TEXT),
      h('div', { class: 'kg-hero-cta' },
        ilink(home + '#find', { class: 'btn btn-accent' }, icon('search', { size: 18 }), '내 캐릭터 찾기'),
        ilink(ctx.app.link({ name: 'items' }), { class: 'btn btn-line' }, '옷 도감 보기')),
      stats),
    h('div', { class: 'kg-cast-wrap' }, cast));
}
// 아이디로 찾기(메인에 보이는 모든 방송에서)
function searchSection(ctx) {
  const input = h('input', { id: 'kg_gq', type: 'search', maxlength: 24, placeholder: '예: 밤톨 또는 밤톨#먼치', autocomplete: 'off', enterkeyhint: 'search', lang: 'ko', 'aria-describedby': 'kg_gq_help' });
  const status = h('p', { class: 'form-status', role: 'status', 'aria-live': 'polite' });
  const results = h('div', { class: 'kg-grid' });
  const submit = h('button', { type: 'submit', class: 'btn btn-accent' }, icon('search', { size: 18 }), '찾기');
  let seq = 0;
  const form = h('form', { class: 'kg-find', role: 'search', novalidate: true },
    h('label', { for: 'kg_gq', class: 'sr-only' }, '내 아이디'),
    h('div', { class: 'kg-find-row' }, input, submit), status);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const my = ++seq, key = idKey(input.value);
    if (!key) { status.textContent = '아이디를 적어 주세요.'; input.focus(); return; }
    if (!QUERY_RULE.test(key)) { status.textContent = '아이디는 한글 1~6자예요. 예: 밤톨 또는 밤톨#먼치'; input.focus(); return; }
    submit.disabled = true; status.textContent = '찾는 중…'; results.replaceChildren();
    try {
      const [r, home] = await Promise.all([kiugiApi.search(key), ctx.home().catch(() => null)]);
      if (my !== seq) return;
      status.textContent = r.results?.length ? (r.more ? '비슷한 아이디가 더 있어요. 정확히 적으면 더 잘 찾아요.' : '') : `'${key}' 아이디를 찾지 못했어요. 이번 시즌 아이디가 맞는지 확인해 주세요.`;
      results.replaceChildren(...cards(r.results || [], home, ctx));
    } catch (err) { if (my === seq) status.textContent = err.message; }
    finally { if (my === seq) submit.disabled = false; }
  });
  return h('section', { class: 'kg-panel kg-search', id: 'find' },
    secHead('아이디로 찾기', '', null, { kicker: 'SEARCH' }),
    h('p', { class: 'kg-help', id: 'kg_gq_help' }, '방송에서 !아이디 로 만든 아이디를 적어 주세요. 여러 방송에 같은 아이디가 있으면 함께 보여요.'),
    form, results);
}
// 지금 인기 있는 캐릭터(하트 많은 순)
async function popularSection(ctx) {
  let home; try { home = await ctx.home(); } catch { return h('section', { class: 'kg-panel' }, errorBox('지금은 목록을 불러오지 못했어요. 잠시 뒤에 다시 해 주세요.', () => ctx.app.navigate(location.pathname + location.search, { replace: true }))); }
  return section(secHead('지금 인기 있는 캐릭터', '하트를 많이 받은 순서예요. 하트는 하루에 한 번 보낼 수 있어요.', null, { kicker: 'RANKING' }),
    home.popular?.length ? h('div', { class: 'kg-grid' }, ...cards(home.popular, home, ctx, { ranked: true })) : h('p', { class: 'empty' }, EMPTY_POPULAR));
}
// 새로 꾸민 캐릭터(옆으로 넘겨 보기)
async function recentSection(ctx) {
  let home; try { home = await ctx.home(); } catch { return null; }
  return section(secHead('새로 꾸민 캐릭터', '방금 옷을 갈아입은 캐릭터예요. 옆으로 넘겨 보세요.', null, { kicker: 'NEW LOOK' }),
    home.recent?.length ? h('div', { class: 'kg-strip' }, ...cards(home.recent, home, ctx)) : h('p', { class: 'empty' }, '아직 새로 꾸민 캐릭터가 없어요.'));
}
// 이렇게 키워요(채팅 예시의 "먼치"는 DJ마다 다른 캐릭터 이름)
function howSection() {
  const step = (n, title, body, bubble) => h('li', { class: 'kg-step' },
    h('span', { class: 'kg-step-n', 'aria-hidden': 'true' }, n), h('b', null, title), h('p', null, body),
    bubble ? h('span', { class: 'kg-bubble' }, h('span', { class: 'kg-bubble-tag', 'aria-hidden': 'true' }, '채팅'), bubble) : null);
  return section(secHead('이렇게 키워요', 'DJ 방송 채팅에서 바로 할 수 있어요.', null, { kicker: 'HOW TO PLAY' }),
    h('ol', { class: 'kg-steps' },
      step('1', '아이디 만들기', '방송 채팅에 아이디를 만들면 이번 시즌 동안 그 이름으로 보여요.', '!아이디 밤톨'),
      step('2', '냥 모으기', '채팅·좋아요·하트·후원·출석으로 냥이 모여요. 애정도가 오르면 표정이 바뀌어요.', null),
      step('3', '옷 입히기', 'DJ 캐릭터 이름 뒤에 상점을 붙이면 의상·신발·악세사리가 번호와 함께 나와요. 번호(의상1·악세3)를 치면 사서 바로 입어요.', '!먼치 상점 의상')),
    h('p', { class: 'note' }, '예시의 "먼치"는 DJ마다 다른 캐릭터 이름이에요.'));
}
// 많이 입은 옷 TOP 5(막대는 1등 기준)
async function topItemsSection(ctx) {
  let home; try { home = await ctx.home(); } catch { return null; }
  const seasonId = home.season?.id || ctx.catalog.last;
  // 이번 시즌 목록에 있는 옷만(예전 판 먼치킨이 올린 예전 옷 id 는 그림·이름이 없어 뺀다)
  const top = (home.items || []).filter((x) => ctx.catalog.items[x.id]).slice(0, 5), max = Math.max(1, ...top.map((x) => Number(x.count) || 0));
  return section(secHead('많이 입은 옷 TOP 5', '메인에 보이는 방송의 캐릭터가 입은 옷이에요.',
    ilink(ctx.app.link({ name: 'items' }), { class: 'kg-more' }, '옷 도감', icon('arrow', { size: 16 })), { kicker: 'MOST WORN' }),
    top.length
      ? h('ol', { class: 'kg-rank kg-panel' }, ...top.map((x, i) => {
        const it = ctx.catalog.items[x.id];
        return h('li', null,
          crest(i + 1, { className: 'kg-rank-n' }),
          h('span', { class: 'kg-rank-art', 'aria-hidden': 'true' }, itemArt(ctx.catalog, x.id, { base: ctx.app.base, label: it?.name || x.id })),
          h('span', { class: 'kg-rank-name' }, it?.name || x.id, it ? h('small', null, slotName(ctx.catalog, seasonId, it.slot)) : null),
          h('span', { class: 'kg-rank-count' }, `${fmt(x.count)}명`),
          h('progress', { class: 'kg-rank-bar', max, value: Number(x.count) || 0, 'aria-hidden': 'true' }));
      }))
      : h('p', { class: 'empty' }, '아직 옷을 입은 캐릭터가 없어요.'));
}
// 키우기 중인 DJ
async function djsSection(ctx) {
  let home; try { home = await ctx.home(); } catch { return null; }
  const seasonId = home.season?.id || null;
  return section(secHead('키우기 중인 DJ', 'DJ 캐릭터를 누르면 그 방송의 키우기 페이지로 가요.', null, { kicker: 'DJ LIST' }),
    home.djs?.length ? h('div', { class: 'kg-grid' }, ...home.djs.map((d) => djCard(d, { app: ctx.app, catalog: ctx.catalog, seasonId }))) : h('p', { class: 'empty' }, '아직 키우기를 연 DJ가 없어요.'));
}
// 예시와 알림
function aboutSection(ctx) {
  const demo = buildPath(ctx.app.base, { name: 'kiugi', slug: DEMO_KIUGI_SLUG }) + '?demo=1';
  return h('section', { class: 'kg-panel kg-about' },
    h('div', null, h('span', { class: 'kg-kicker', 'aria-hidden': 'true' }, 'PREVIEW'), h('b', null, 'DJ 키우기 페이지는 이렇게 생겼어요'), h('p', null, '예시 페이지의 캐릭터와 아이디는 모두 지어낸 것이에요.')),
    ilink(demo, { class: 'btn btn-line' }, '예시 페이지 보기'));
}

// 첫 화면(밤하늘) 아래 칸 목록(차례대로). 칸 = (ctx) => 요소 | null | Promise<요소 | null>.
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
  const main = h('main', { id: 'main', class: 'fp-main intro-main', tabindex: '-1' },
    box ? h('div', { class: 'kg-panel kg-notice', role: 'alert' }, h('h1', { class: 'sec-title' }, box[0]), h('p', null, box[1])) : null);
  root.replaceChildren(h('div', { class: 'fp intro' },
    h('div', { class: 'kg-night' }, ...nightTop(app), heroHost),
    main,
    siteFoot(app, '이 사이트에는 청취자가 방송에서 직접 만든 아이디와 레벨·입은 옷·하트만 보여요.')));
  let homeJob = null;
  const catalog = await loadCatalog(app.base).catch(() => buildCatalog([]));
  const ctx = { app, heading: box ? 'h2' : 'h1', catalog, home: () => (homeJob ||= kiugiApi.home()) };
  heroHost.replaceChildren(heroSection(ctx));
  for (const make of LANDING_SECTIONS) mount(main, make, ctx);
}
