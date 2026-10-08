// 메인 페이지(먼치킨 키우기): 시즌 · 아이디로 찾기 · 지금 인기 있는 캐릭터 · 새로 꾸민 캐릭터 · 많이 입은 옷 TOP 5 · 키우기 중인 DJ · 예시.
// 없는 주소(notfound)와 마친 팬페이지 주소(ended)도 맨 위에 안내 상자를 붙여 여기서 보여 준다.
// 칸(section) 목록으로 그린다 — 칸을 더하거나 빼려면 LANDING_SECTIONS 만 고치면 된다.
import { h } from '../lib/dom.js';
import { buildPath, DEMO_KIUGI_SLUG } from '../lib/route.js';
import { kiugiApi } from '../api.js';
import { loadCatalog, buildCatalog, slotName } from '../lib/kiugi-draw.js';
import { ilink, errorBox } from './common.js';
import { seasonLine } from './kiugi.js';
import { characterCard, djCard } from './cards.js';

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
const NOTICE = {
  notfound: ['페이지를 찾을 수 없어요', '주소가 맞는지 확인해 주세요.'],
  ended: ['팬페이지 서비스를 마쳤어요', '그동안 함께해 주셔서 고마워요. DJ 키우기 페이지는 DJ가 알려 준 주소로 계속 볼 수 있어요.'],
};
// 찾기 칸 규칙(서버와 같음): 앞 부분만("밤톨") 또는 전체 아이디("밤톨#먼치")
const QUERY_RULE = /^[가-힣]{1,6}(#[가-힣A-Za-z0-9]{1,8})?$/;
const idKey = (s) => String(s ?? '').normalize('NFC').replace(/\s+/g, '');
export const EMPTY_POPULAR = '아직 하트를 받은 캐릭터가 없어요. 마음에 드는 캐릭터에게 첫 하트를 보내 보세요!';

const section = (title, ...children) => h('section', { class: 'card pad stack' }, h('h2', { class: 'sec-title sm' }, title), ...children);
// 카드에 그릴 DJ 캐릭터 모양(home.djs 에서 slug 로)
const looks = (home) => new Map((home?.djs || []).map((d) => [d.slug, d.character]));
const cards = (list, home, ctx, opts = {}) => {
  const look = looks(home), seasonId = home?.season?.id || null;
  return list.map((c, i) => characterCard(c, { app: ctx.app, catalog: ctx.catalog, character: look.get(c.slug), seasonId, rank: opts.ranked ? i + 1 : null }));
};

// 맨 위: 이름과 한 줄 설명. heading: 위에 알림 상자가 있으면 'h2'(제목이 두 번 h1 이 되지 않게).
function heroSection(ctx) {
  return h('section', { class: 'intro-hero' },
    h(ctx.heading, { class: 'display' }, '먼치킨 키우기'),
    h('p', { class: 'intro' }, 'DJ가 알려 준 키우기 주소로 들어가면 청취자들이 꾸민 캐릭터를 볼 수 있어요.'));
}
// 시즌 띠: 이번 시즌·끝나는 날·참여 수. 메인 자료를 못 받으면 다시 해 보기.
async function seasonSection(ctx) {
  try {
    const home = await ctx.home();
    return h('section', { class: 'card pad kg-season' },
      h('span', { class: 'chip-soft' }, (home.season ? '🎃 ' : '🍂 ') + seasonLine(home.season)),
      h('p', { class: 'muted small' }, home.totals?.djs ? `DJ ${fmt(home.totals.djs)}명과 청취자 ${fmt(home.totals.people)}명이 키우고 있어요.` : '아직 키우기를 연 DJ가 없어요.'));
  } catch (e) {
    return h('section', { class: 'card pad' }, errorBox('지금은 목록을 불러오지 못했어요. 잠시 뒤에 다시 해 주세요.', () => ctx.app.navigate(location.pathname + location.search, { replace: true })));
  }
}
// 아이디로 찾기(메인에 보이는 모든 방송에서)
function searchSection(ctx) {
  const input = h('input', { id: 'kg_gq', type: 'search', maxlength: 24, placeholder: '예: 밤톨 또는 밤톨#먼치', autocomplete: 'off', enterkeyhint: 'search', lang: 'ko', 'aria-describedby': 'kg_gq_help' });
  const status = h('p', { class: 'form-status', role: 'status', 'aria-live': 'polite' });
  const results = h('div', { class: 'kg-grid' });
  const submit = h('button', { type: 'submit', class: 'btn btn-accent' }, '찾기');
  let seq = 0;
  const form = h('form', { class: 'kg-find', role: 'search', novalidate: true },
    h('label', { for: 'kg_gq', class: 'kg-find-label' }, '내 아이디'),
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
  return section('아이디로 찾기', h('p', { class: 'muted small', id: 'kg_gq_help' }, '방송에서 !아이디 로 만든 아이디를 적어 주세요. 여러 방송에 같은 아이디가 있으면 함께 보여요.'), form, results);
}
// 지금 인기 있는 캐릭터(하트 많은 순)
async function popularSection(ctx) {
  let home; try { home = await ctx.home(); } catch { return null; }
  return section('지금 인기 있는 캐릭터',
    home.popular?.length ? h('div', { class: 'kg-grid' }, ...cards(home.popular, home, ctx, { ranked: true })) : h('p', { class: 'empty' }, EMPTY_POPULAR));
}
// 새로 꾸민 캐릭터(옆으로 넘겨 보기)
async function recentSection(ctx) {
  let home; try { home = await ctx.home(); } catch { return null; }
  return section('새로 꾸민 캐릭터',
    home.recent?.length ? h('div', { class: 'kg-strip' }, ...cards(home.recent, home, ctx)) : h('p', { class: 'empty' }, '아직 새로 꾸민 캐릭터가 없어요.'));
}
// 많이 입은 옷 TOP 5
async function topItemsSection(ctx) {
  let home; try { home = await ctx.home(); } catch { return null; }
  const seasonId = home.season?.id || ctx.catalog.last;
  const top = (home.items || []).slice(0, 5);
  return section('많이 입은 옷 TOP 5',
    top.length
      ? h('ol', { class: 'kg-rank' }, ...top.map((x, i) => {
        const it = ctx.catalog.items[x.id];
        return h('li', null, h('span', { class: 'kg-rank-n' }, `${i + 1}`), h('span', { class: 'kg-rank-name' }, it?.name || x.id, h('small', null, it ? slotName(ctx.catalog, seasonId, it.slot) : '')), h('span', { class: 'kg-rank-count' }, `${fmt(x.count)}명`));
      }))
      : h('p', { class: 'empty' }, '아직 옷을 입은 캐릭터가 없어요.'),
    ilink(ctx.app.link({ name: 'items' }), { class: 'btn btn-line' }, '옷 도감 전체 보기'));
}
// 키우기 중인 DJ
async function djsSection(ctx) {
  let home; try { home = await ctx.home(); } catch { return null; }
  const seasonId = home.season?.id || null;
  return section('키우기 중인 DJ',
    home.djs?.length ? h('div', { class: 'kg-grid' }, ...home.djs.map((d) => djCard(d, { app: ctx.app, catalog: ctx.catalog, seasonId }))) : h('p', { class: 'empty' }, '아직 키우기를 연 DJ가 없어요.'));
}
// 예시와 알림
function aboutSection(ctx) {
  const demo = buildPath(ctx.app.base, { name: 'kiugi', slug: DEMO_KIUGI_SLUG }) + '?demo=1';
  return h('section', { class: 'intro-about' },
    ilink(demo, { class: 'btn btn-line' }, '예시 페이지 보기'),
    h('p', { class: 'muted small' }, '예시 페이지의 캐릭터와 아이디는 모두 지어낸 것이에요.'));
}

// 메인 페이지 칸 목록(차례대로). 칸 = (ctx) => 요소 | null | Promise<요소 | null>.
// ctx = {app, heading, home: () => Promise(메인 자료, 한 번만 받음), catalog(시즌 목록)}.
// 서버에서 받아 오는 칸은 Promise 를 돌려주면 자리를 먼저 잡아 두었다가 받은 뒤에 채운다(실패하면 칸을 뺀다).
export const LANDING_SECTIONS = [heroSection, seasonSection, searchSection, popularSection, recentSection, topItemsSection, djsSection, aboutSection];

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
  document.title = box ? `${box[0]} · 먼치킨 키우기` : '먼치킨 키우기';
  const main = h('main', { id: 'main', class: 'fp-main intro-main', tabindex: '-1' },
    box ? h('div', { class: 'card pad stack', role: 'alert' }, h('h1', { class: 'sec-title' }, box[0]), h('p', { class: 'muted' }, box[1])) : null);
  root.replaceChildren(h('div', { class: 'fp intro' }, main, h('footer', { class: 'fp-foot' }, '먼치킨 키우기 · 스푼이 만든 서비스가 아니에요.')));
  let homeJob = null;
  const catalog = await loadCatalog(app.base).catch(() => buildCatalog([]));
  const ctx = { app, heading: box ? 'h2' : 'h1', catalog, home: () => (homeJob ||= kiugiApi.home()) };
  for (const make of LANDING_SECTIONS) mount(main, make, ctx);
}
