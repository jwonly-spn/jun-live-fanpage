// 첫 화면(시즌 2 "몬스터 영토전" — spec.md 7절): 영토 지도를 화면 가득 → 바로 아래 아이디로 몬스터 찾기 → 땅 순위 · 지도 소식 → 땅을 넓히는 법.
//  · 지도 = 영토 서버의 tr-snap/map.json(api.js readMapFile). 3분마다 다시 읽고(화면이 숨어 있으면 쉼) 바뀌면 경계가 번지듯 바뀐다(lib/map-draw.js).
//  · 지도 파일이 아직 없으면(시즌 시작 전) 아무도 없는 대륙 + "12월 1일 0시에 시작해요".
//  · 맨 위 "지금 보스전" 띠(판이 있을 때만 — kiugi 함수 fights, 15초마다) → 보스전 보기(views/boss.js).
//  · 아이디 찾기 = kiugi 함수 search(아이디와 몬스터만 — 스푼 계정 정보는 없음). 주소 ?id= 로 와도 바로 찾는다.
import { h, icon } from '../lib/dom.js';
import { relativeTime, formatDate } from '../lib/text.js';
import { kiugiApi, readMapFile, pollMs, isDemo, MAP_WAKE_MS } from '../api.js';
import { parseMap, emptyMap, sameMap, ranking, seasonClock, clockText, pctText, deltaText, cssColor, f1 } from '../lib/map-core.js';
import { MapStage, loadMapArt } from '../lib/map-draw.js';
import { ID_QUERY, cleanId } from '../lib/route.js';
import { LIST_POLL_MS, listOf, stripItems, phaseText, djText } from '../lib/boss-core.js';
import { RING, TYPE, sortMonsters } from '../lib/monsters.js';
import { nightTop, siteFoot, secHead, ilink, errorBox, loading, SEASON_TITLE } from './common.js';
import { monsterCtx, monsterArtEl, stageName, typeChip, rareChip, statLine, soonNote } from './monster-ui.js';

// 차례: 지도(화면 가득) → 바로 아래 아이디 찾기 → 땅 순위·지도 소식 → 땅을 넓히는 법
export const HOME_SECTIONS = ['mapHero', 'findSection', 'boardSection', 'howSection'];
export const EMPTY_FIND = '아이디를 찾지 못했어요. 방송에서 만든 이번 시즌 아이디(예: 밤톨#먼치)가 맞는지 확인해 주세요.';
export const NO_MONSTER = '아직 몬스터가 없어요. 방송에서 !산책 으로 첫 몬스터를 만나 보세요.';

export async function renderHome(root, app, route) {
  const main = h('main', { id: 'main', class: 's2-home', tabindex: '-1' });
  const hero = mapHero(app);
  main.append(hero.el, findSection(app, route.id), hero.board, howSection(app));
  root.replaceChildren(...nightTop(app), main, siteFoot(app, '지도에는 참가한 방송의 이름과 땅 비율·경계·식민지만 보여요. 청취자 정보는 올라가지 않아요.'));
  document.title = `${SEASON_TITLE} · 스푼 DJ 키우기`;
  // 맨 위 "지금 보스전" 띠(판이 있을 때만 — 없으면 자리도 차지하지 않는다)
  const strip = bossStrip(app);
  main.prepend(strip.el);
  strip.start();
  hero.start();
}

// ---- 지금 보스전 띠(2026-11-19 보스전 보기): 판이 있을 때만 · 3개까지 · 틀 없이 한 줄씩 → 누르면 보기. 15초마다(화면이 숨으면 쉼) ----
function bossStrip(app) {
  const list = h('ul', { class: 's2-boss-list' });
  const all = ilink(app.link({ name: 'boss' }), { class: 's2-boss-item is-more' }, '모두 보기');
  const el = h('section', { class: 's2-boss-strip', 'aria-label': '지금 보스전', hidden: true }, h('h2', { class: 's2-boss-h' }, h('span', { 'aria-hidden': 'true' }, '👹 '), '지금 보스전'), list, all); // 👹 지금 보스전
  let timer = 0;
  async function read() {
    clearTimeout(timer);
    if (!el.isConnected) return;
    if (document.visibilityState !== 'hidden') {
      try {
        const { items, more } = stripItems(listOf(await kiugiApi.fights()));
        list.replaceChildren(...items.map((f) => h('li', null, ilink(app.link({ name: 'watch', fight: f.id }), { class: 's2-boss-item' },
          h('i', { class: 's2-boss-dot' + (f.phase === 'fight' ? ' is-fight' : ''), 'aria-hidden': 'true' }),
          h('b', null, djText(f)), h('span', null, f.boss.name), h('em', null, phaseText(f))))));
        all.textContent = more ? `${more}개 더 보기` : '모두 보기';
        el.hidden = !items.length;
      } catch { /* 띠는 없어도 되는 것 — 다음에 다시 */ }
    }
    if (el.isConnected) timer = setTimeout(read, LIST_POLL_MS);
  }
  return { el, start: read };
}

// ---- 지도 ----
function mapHero(app) {
  const clock = h('p', { class: 's2-clock' }), prize = h('p', { class: 's2-prize' }), stamp = h('p', { class: 's2-stamp' });
  const head = h('div', { class: 's2-map-head' },
    h('div', { class: 's2-head-a' }, h('p', { class: 's2-eyebrow' }, '키우기 시즌 2 · 12월 1일 ~ 12월 31일'), h('h1', { class: 's2-title' }, SEASON_TITLE)),
    h('div', { class: 's2-head-b' }, clock, prize, stamp));
  const stage = h('div', { class: 's2-map-stage' });
  // 지도 위 안내(시즌 전 등)는 밀어 보는 지도 밖 틀에 — 휴대폰에서도 보이는 칸 한가운데
  const overlay = h('div', { class: 's2-map-overlay', hidden: true });
  const scroller = h('div', { class: 's2-map-scroll', tabindex: '0', role: 'region', 'aria-label': '영토 지도(옆으로 밀어서 볼 수 있어요)' }, stage);
  const frame = h('div', { class: 's2-map-frame' }, scroller, overlay);
  const hint = h('p', { class: 's2-pan-hint' }, icon('arrow', { size: 14 }), '옆으로 밀어서 지도 전체를 보세요');
  const legend = h('ul', { class: 's2-legend', 'aria-label': '지도 보는 법' },
    h('li', null, h('i', { class: 'lg-wild' }), '숲(아무도 없는 땅 — 보스를 잡으면 우리 땅)'),
    h('li', null, h('i', { class: 'lg-dj' }), 'DJ 땅(물감으로 칠해요)'),
    h('li', null, h('i', { class: 'lg-col' }), '식민지(이긴 DJ 색 + 원래 주인 줄무늬)'),
    h('li', null, h('i', { class: 'lg-cap' }), '성 = 기지 1%(식민지가 되지 않아요)'));
  const el = h('section', { class: 's2-map-hero', 'aria-labelledby': 's2-title' }, h('div', { class: 's2-map-wrap' }, head, frame), h('div', { class: 's2-under' }, hint, legend));
  el.querySelector('.s2-title').id = 's2-title';

  const rankList = h('ol', { class: 's2-rank' }), feedList = h('ul', { class: 's2-feed' }), boardNote = h('p', { class: 'note' });
  const board = h('section', { class: 's2-board', 'aria-label': '땅 순위와 소식' },
    h('div', { class: 's2-panel' }, secHead('땅 순위', '땅은 보스 토벌과 영지전으로만 움직여요.', null, { level: 'h2' }), rankList, boardNote),
    h('div', { class: 's2-panel' }, secHead('지도 소식', '보스 토벌 · 영지전 결과예요.', null, { level: 'h2' }), feedList));

  let ms = null, shown = null, timer = 0, lastRead = 0, failed = false;
  const paint = (map, { error = null } = {}) => {
    const now = isDemo() && map.updatedAt ? map.updatedAt : Date.now(), c = seasonClock(map, now);
    clock.textContent = clockText(c);
    prize.replaceChildren(icon('trophy', { size: 17 }), h('span', null, map.prize));
    stamp.textContent = error ? error : map.updatedAt ? `${formatDate(new Date(map.updatedAt).toISOString(), now)} ${new Date(map.updatedAt + 9 * 3600e3).toISOString().slice(11, 16)} 기준 · 몇 분마다 새로 그려요` : '';
    stamp.classList.toggle('is-error', Boolean(error));
    // 지도 위 안내(시즌 전 · 참가한 방송 없음)
    const lines = map.empty || !map.djs.some((d) => d.cells > 0)
      ? (c.state === 'before' ? ['12월 1일 0시에 시작해요', '먼치킨을 쓰는 DJ 방송이 지도에 참가하면 기지 1%가 생기고, 보스 토벌과 영지전으로 땅을 넓혀요.'] : ['아직 땅을 가진 방송이 없어요', '방송에서 보스를 잡으면 이 대륙에 첫 땅이 생겨요.'])
      : null;
    overlay.hidden = !lines;
    if (lines) overlay.replaceChildren(h('div', { class: 's2-map-overlay-in' }, h('b', null, lines[0]), h('span', null, lines[1])));
    // 순위
    const rows = ranking(map);
    rankList.replaceChildren(...rows.map((d, n) => {
      const sub = [d.colPct >= 0.05 ? `식민지 ${f1(d.colPct)}%` : '', d.ruledPct >= 0.05 ? `지배당하는 땅 ${f1(d.ruledPct)}%` : '', deltaText(d.dayDelta)].filter(Boolean).join(' · ');
      const dot = h('span', { class: 's2-dot' }); dot.style.background = cssColor(d.rgb);
      return h('li', null, h('button', { type: 'button', class: 's2-rank-row' + (n === 0 ? ' is-top' : ''), onclick: () => ms?.focus(d.key) },
        h('span', { class: 's2-rank-n' }, String(n + 1)), dot,
        h('span', { class: 's2-rank-name' }, h('b', null, d.name), sub ? h('small', null, sub) : null),
        h('span', { class: 's2-rank-pct' }, pctText(d.pct))));
    }), h('li', { class: 'is-wild' }, h('div', { class: 's2-rank-row' }, h('span', { class: 's2-rank-n' }), h('span', { class: 's2-dot lg-wild' }), h('span', { class: 's2-rank-name' }, h('b', null, '숲'), h('small', null, '아무도 없는 땅')), h('span', { class: 's2-rank-pct' }, pctText(map.wildPct)))));
    boardNote.textContent = rows.length ? `12월 31일 밤 11시 59분에 가장 넓은 땅을 가진 DJ가 1등이에요. 땅이 같으면 그 땅에 먼저 닿은 DJ예요.` : '';
    feedList.replaceChildren(...(map.feed.length ? map.feed.map((f) => h('li', null, h('span', null, f.text), f.at ? h('time', { datetime: new Date(f.at).toISOString() }, relativeTime(new Date(f.at).toISOString(), now)) : null))
      : [h('li', { class: 'is-empty' }, c.state === 'before' ? '시즌이 시작되면 보스 토벌과 영지전 소식이 여기에 나와요.' : '아직 소식이 없어요.')]));
    const top = rows.slice(0, 5).map((d) => `${d.name} ${pctText(d.pct)}`).join(', ');
    ms?.setLabel(`영토 지도: ${top || '아직 땅을 가진 방송이 없어요'}${map.wildPct ? `, 숲 ${pctText(map.wildPct)}` : ''}`);
  };
  async function read(fresh) {
    lastRead = Date.now();
    let map = null, error = null;
    try { const j = await readMapFile({ fresh }); map = j ? parseMap(j) : emptyMap(); if (!map) error = '지도 파일 모양이 달라 그리지 못했어요.'; failed = false; }
    catch (e) { error = e.message || '지도를 불러오지 못했어요.'; failed = true; }
    if (!el.isConnected && shown) return;
    if (!map) map = shown || emptyMap();
    if (!shown || !sameMap(shown, map) || shown.empty !== map.empty) { await ms.setMap(map, { animate: Boolean(shown) }); }
    shown = map;
    paint(map, { error: error ? `${error} 잠시 뒤에 다시 읽어요.` : null });
  }
  const schedule = () => { clearTimeout(timer); timer = setTimeout(tick, failed ? 30e3 : pollMs()); };
  async function tick() {
    if (!el.isConnected) return stop();
    if (document.visibilityState === 'hidden') return schedule();
    await read(true); schedule();
  }
  const onVis = () => { if (!el.isConnected) return stop(); if (document.visibilityState === 'visible' && Date.now() - lastRead > MAP_WAKE_MS) { clearTimeout(timer); tick(); } };
  function stop() { clearTimeout(timer); document.removeEventListener('visibilitychange', onVis); ms?.destroy(); }
  return {
    el, board,
    async start() {
      // Codex 대륙 그림(있으면 바탕 — 땅 칸도 이 그림 기준). 지도 파일은 index.html 이 이미 미리 받고 있다.
      ms = new MapStage(stage, { art: await loadMapArt(app.base) });
      // 휴대폰처럼 좁은 화면: 지도가 화면보다 넓다 — 처음엔 가운데를 보인다
      requestAnimationFrame(() => { if (scroller.scrollWidth > scroller.clientWidth) scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2; });
      document.addEventListener('visibilitychange', onVis);
      await read(false);
      schedule();
    },
  };
}

// ---- 아이디로 몬스터 찾기 ----
function findSection(app, startId) {
  const input = h('input', { type: 'search', name: 'id', class: 's2-input', placeholder: '아이디 예: 밤톨 또는 밤톨#먼치', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'search', maxlength: '20', 'aria-label': '아이디' });
  const out = h('div', { class: 's2-find-out', 'aria-live': 'polite' });
  let job = 0;
  async function run(raw) {
    const q = cleanId(raw);
    if (!ID_QUERY.test(q)) { out.replaceChildren(errorBox('아이디를 한글 1~6자로 적어 주세요. 예: 밤톨 또는 밤톨#먼치')); return; }
    // 주소에 아이디를 남긴다(공유·새로고침해도 같은 결과) — 다른 쿼리는 그대로
    try { const u = new URL(location.href); u.searchParams.set('id', q); u.hash = 'find'; history.replaceState(null, '', u.pathname + u.search + u.hash); } catch { /* 무시 */ }
    const my = ++job;
    out.replaceChildren(loading('찾는 중…'));
    try {
      const [r, ctx] = await Promise.all([kiugiApi.search(q), monsterCtx(app.base)]);
      if (my !== job) return;
      const people = (Array.isArray(r.results) ? r.results : []).filter((p) => p && typeof p.id === 'string' && Array.isArray(p.monsters));
      if (!people.length) { out.replaceChildren(h('p', { class: 'empty' }, (r.results?.length ? '이 아이디는 아직 시즌 2 기록이 없어요. 방송에서 !산책 으로 첫 몬스터를 만나 보세요.' : EMPTY_FIND))); return; }
      out.replaceChildren(...[h('p', { class: 's2-find-count' }, people.length > 1 ? `${people.length}명을 찾았어요. 아이디 뒤 이름이 방송마다 달라요.` : '찾았어요.'),
        h('div', { class: 's2-people' }, ...people.map((p) => personCard(app, ctx, p))), r.more ? h('p', { class: 'note' }, '더 있어요. 전체 아이디(예: 밤톨#먼치)로 찾으면 한 명만 나와요.') : null].filter(Boolean));
    } catch (e) {
      if (my === job) out.replaceChildren(errorBox(e.message || '찾지 못했어요.', () => run(q)));
    }
  }
  const form = h('form', { class: 's2-find-form', role: 'search', onsubmit: (e) => { e.preventDefault(); run(input.value); } },
    h('span', { class: 's2-input-wrap' }, icon('search', { size: 18 }), input),
    h('button', { type: 'submit', class: 'btn btn-accent' }, '찾기'));
  if (startId) { input.value = startId; queueMicrotask(() => run(startId)); }
  return h('section', { id: 'find', class: 's2-find', 'aria-labelledby': 's2-find-h' },
    secHead('아이디로 몬스터 찾기', '방송에서 !아이디 로 만든 아이디를 넣으면 그 청취자의 몬스터가 나와요.', null, { id: 's2-find-h' }),
    form, out);
}
export function personCard(app, ctx, p) {
  const list = sortMonsters(p.monsters, p.lead), lead = list.find((m) => m.lead) || null, rest = list.filter((m) => m !== lead);
  const dex = ilink(app.link({ name: 'dex', id: p.id }), { class: 'btn btn-line btn-sm' }, icon('book', { size: 16 }), '도감에서 보기');
  const head = h('div', { class: 's2-person-head' },
    h('div', null, h('p', { class: 's2-person-id' }, p.id), h('p', { class: 's2-person-dj' }, `${p.djName || p.id.split('#')[1] || ''} 방송에서 키워요 · 몬스터 ${list.length}마리`)), dex);
  if (!list.length) return h('article', { class: 's2-person' }, head, h('p', { class: 'note' }, NO_MONSTER));
  const leadBox = lead ? h('div', { class: 's2-lead' },
    monsterArtEl(ctx, lead.sp, lead.stage, { size: 'l', alt: stageName(ctx, lead.sp, lead.stage) }),
    h('div', { class: 's2-lead-text' },
      h('span', { class: 's2-badge' }, '대표 몬스터'),
      h('p', { class: 's2-mon-name' }, stageName(ctx, lead.sp, lead.stage)),
      h('p', { class: 's2-mon-stat' }, statLine(lead)),
      h('p', { class: 's2-chips' }, typeChip(lead.sp.split('_')[0]), rareChip(ctx, lead.sp)), soonNote(ctx, lead.sp, lead.stage))) : h('p', { class: 'note' }, '대표 몬스터를 아직 정하지 않았어요. 방송에서 !대표 이름 으로 정해요.');
  return h('article', { class: 's2-person' }, head, leadBox,
    rest.length ? h('ul', { class: 's2-mon-list', 'aria-label': '그 밖의 몬스터' }, ...rest.map((m) => h('li', { class: 's2-mon-row' },
      monsterArtEl(ctx, m.sp, m.stage, { size: 's' }),
      h('span', { class: 's2-mon-row-text' }, h('b', null, stageName(ctx, m.sp, m.stage)), h('small', null, statLine(m))),
      typeChip(m.sp.split('_')[0])))) : null);
}

// ---- 땅을 넓히는 법 ----
function howSection(app) {
  const card = (ic, title, ...lines) => h('li', { class: 's2-how-card' }, h('span', { class: 's2-how-ic', 'aria-hidden': 'true' }, icon(ic, { size: 20 })), h('h3', null, title), ...lines.map((t) => h('p', null, t)));
  const cmd = (c, t) => h('li', null, h('code', { class: 'kg-cmd' }, c), h('span', null, t));
  return h('section', { class: 's2-how', 'aria-labelledby': 's2-how-h' },
    secHead('땅은 이렇게 넓혀요', '모든 일은 방송 중에만 일어나요. 꺼진 방송의 땅은 그대로예요.', ilink(app.link({ name: 'dex' }), { class: 'btn btn-line btn-sm' }, icon('book', { size: 16 }), '몬스터 도감'), { id: 's2-how-h' }),
    h('ol', { class: 's2-how-list' },
      card('flag', '보스 토벌', '방송을 시작하고 30분 뒤부터 30분마다 보스가 나와요(2시간 방송이면 3번).', '대표 몬스터로 참전해 이기면 숲의 일부가 우리 땅, 지면 땅이 줄어요(하루 첫 실패만). 사람이 적으면 버프를 받아요.'),
      card('swords', '영지전', '다른 방송과 냥을 걸고 겨뤄요(가위바위보 · 하나빼기 · 몬스터 대전).', '이기면 진 방송 땅의 10%(+판돈 1만 냥마다 5%, 최대 25%)가 우리 식민지가 돼요.'),
      card('map', '식민지와 독립', '식민지는 이긴 DJ 색 위에 원래 주인 색 줄무늬로 칠해요.', '진 DJ가 나중에 그 DJ를 이기면 식민지를 모두 되찾아요. 기지 1%는 식민지가 되지 않아요.'),
      card('trophy', '1등 상', '12월 31일에 땅이 가장 넓은 DJ에게 먼치킨 한 달 무료 이용권과 상금 486스푼을 드려요.', '같은 두 방송끼리 영지전은 하루 2번까지예요.')),
    h('div', { class: 's2-cmds' },
      h('h3', null, '청취자는 방송 채팅에서'),
      h('ul', null,
        cmd('!산책', '몬스터 만나기 · 경험치 · 냥 줍기 (10분에 한 번)'),
        cmd('!산책 불', '불 몬스터를 자주 만나는 길로'),
        cmd('!훈련 500', '냥 500으로 대표 몬스터 경험치 500'),
        cmd('!대표 이름', '보스·영지전에 나갈 몬스터 정하기'),
        cmd('!몬스터', '내 몬스터 보기'),
        cmd('!참전', '보스가 나오면 1분 안에 함께 싸우기'))),
    h('p', { class: 's2-ring-line', 'aria-label': '속성 상성: 물이 불에, 불이 풀에, 풀이 땅에, 땅이 전기에, 전기가 바람에, 바람이 물에 강해요' },
      ...RING.flatMap((t, i) => [h('span', { class: `mon-type t-${t}` }, `${TYPE[t].emoji} ${TYPE[t].name}`), h('span', { class: 's2-ring-arrow', 'aria-hidden': 'true' }, '›')]),
      h('span', { class: `mon-type t-${RING[0]}` }, `${TYPE[RING[0]].emoji} ${TYPE[RING[0]].name}`)));
}
