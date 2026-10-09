// 옷 도감(items): 이번 시즌 옷을 묶음마다(그림 V5: 한벌옷·상의·하의·신발·악세사리·배경 — 상의·하의는 20벌씩) — 옷 그림·번호(상의1)·이름·값(냥)·느낌·악세사리 자리·입은 사람 수. 시즌 칭호는 따로.
// 이름·값은 사이트에 복사된 시즌 목록(docs/kiugi/season-*.json, 먼치킨과 같은 값)에서, 입은 사람 수는 메인 페이지 자료(home.items)에서.
// 2026-10-10 먼치킨 값 통일: 값은 묶음마다 하나(한벌옷 2,000 · 상의·하의·신발 500 · 악세사리 300 · 배경 400 · 칭호 3,000), 옷에는 레벨 조건이 없다(Lv 표시는 칭호에만 — Lv.10).
// 입은 사람 수는 메인 페이지에 보이는 방송(main)만 센다. 옷 그림은 여자·남자 캐릭터용을 단추로 바꿔 본다(같은 번호 옷의 남녀 몸 버전).
// 묶음 이름·차례는 시즌 목록(categories)에서 그대로 읽는다 — 묶음이 바뀌어도(상의·하의 등) 이 화면은 고치지 않아도 된다.
// 2026-10-09 사용자 "키우기.com 이랑 방송 채팅창에서 보여지는 상품 번호를 같게 해서 바로 번호로 구매": 번호(상의11·칭호1)는 먼치킨 채팅 상점과 같은 글이고, 누르면 복사된다.
//  "시즌 보상은 칭호로 통일": 황금 호박 왕관·그림자 날개·달빛 오라는 악세사리(악세11~13)로, 시즌 칭호는 그림 없이 따로(얻은 시즌과 다음 시즌까지 효과).
import { h, toast } from '../lib/dom.js';
import { kiugiApi } from '../api.js';
import { loadCatalog, buildCatalog, titleUntil, titleImageUrl } from '../lib/kiugi-draw.js';
import { CLOSET_CMD } from '../lib/try-on.js';
import { loading, nightTop, siteFoot, secHead, statTiles, BRAND } from './common.js';
import { seasonBadge } from './kiugi.js';
import { itemArt } from './cards.js';

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');

// 도감 묶음(시험에서 바로 쓴다): [{slot(묶음 id), name, code, price(묶음 값), items:[{id, name, price, count, style?, code?, place?}]}] + 시즌 보상 묶음
//  묶음 = 시즌 목록의 categories(한벌옷·상의·하의·신발·악세사리·배경). code = 채팅 번호(한벌1·상의3·악세3), style = 느낌(귀여움·멋짐·장난), place = 악세사리 자리 이름(머리 장식 등)
//  titles = 시즌 칭호 [{id, name, image, perks, until('시즌2까지'), price, level, minAttendance, code: '칭호1'}] (채팅 번호 차례)
export function itemGroups(catalog, seasonId, counts = new Map()) {
  const season = catalog?.seasons?.[seasonId];
  if (!season) return { groups: [], rewards: [], titles: [] };
  const mine = Object.entries(catalog.items || {}).filter(([, it]) => it.season === seasonId);
  const cats = season.categories?.length ? season.categories : season.slots.map((s) => ({ id: s.id, name: s.name, code: s.name }));
  const slotNames = new Map(season.slots.map((s) => [s.id, s.name]));
  const row = (cat) => ([id, it]) => ({ id, name: it.name, price: it.price, count: counts.get(id) || 0, ...(it.style ? { style: it.style } : {}),
    ...(cat && Number.isInteger(it.number) ? { code: `${cat.code}${it.number}` } : {}), ...(cat?.id === 'acc' ? { place: slotNames.get(it.slot) || it.slot } : {}) });
  const groups = cats.map((c) => ({ slot: c.id, name: c.name, code: c.code, price: Number(c.price) || 0, items: mine.filter(([, it]) => !it.reward && (it.cat || it.slot) === c.id).map(row(c)) })).filter((g) => g.items.length);
  // 칸이 있는 예전 모양 시즌 보상(입는 옷)만 레벨 조건이 있다(보상 규칙의 최소 레벨)
  const rewards = mine.filter(([, it]) => it.reward).map(([id, it]) => ({ ...row(null)([id, it]), level: it.level }));
  const titles = Object.values(catalog.titles || {}).filter((t) => t.season === seasonId).sort((a, b) => a.number - b.number)
    .map((t) => ({ id: t.id, name: t.name, image: t.image, perks: t.perks, until: titleUntil(catalog, seasonId, season.rewardRule?.lasts), price: t.price, level: t.level, minAttendance: t.minAttendance, code: `${TITLE_WORD}${t.number}` }));
  return { groups, rewards, titles, rule: season.rewardRule };
}
export const wearLine = (n) => (n > 0 ? `${fmt(n)}명이 입고 있어요` : '아직 입은 사람이 없어요');
// 묶음 안 옷 값이 모두 같으면 그 값(묶음 제목 옆 "각 500냥"), 다르면 0
export const groupPrice = (g) => { const set = new Set((g?.items || []).map((it) => Number(it.price) || 0)); return set.size === 1 ? [...set][0] : 0; };
// 묶음 단위(한벌옷 5벌 · 상의·하의 20벌 · 신발 10켤레 · 배경 10장 · 그 밖 10개 — 개수는 시즌 목록에서 센다)
export const unit = (slot) => (['outfit', 'top', 'bottom'].includes(slot) ? '벌' : slot === 'shoes' ? '켤레' : slot === 'bg' ? '장' : '개');
export const REWARD_NOTE = (rule) => `Lv.${rule.minLevel}${rule.minAttendance ? ` · 출석 ${rule.minAttendance}번` : ''}부터 살 수 있고, 시즌이 끝나도 남아요. 사면 캐릭터가 바로 입어요(오라·날개·왕관을 함께 입을 수 있고, 왕관을 쓰면 머리 장식은 가려져요).`;
// 시즌 칭호(먼치킨 채팅의 "칭호1"과 같은 번호)
export const TITLE_WORD = '칭호';
export const TITLE_NOTE = (rule) => `Lv.${rule.minLevel}${rule.minAttendance ? ` · 이번 시즌 출석 ${rule.minAttendance}번` : ''}부터 살 수 있어요. 칭호는 얻은 시즌과 다음 시즌까지 효과가 있어요(시즌 1에 얻으면 시즌 2까지).`;
// 채팅에 칠 글(번호를 누르면 복사): "!옷장 상의 11"(2026-10-09 먼치킨 0.15.66 — 사기·입기는 어느 방송에서나 !옷장 으로 통일, DJ 캐릭터 이름이 필요 없다)
//  여러 벌을 한 줄로("!옷장 상의11 하의3")는 캐릭터 페이지 입혀 보기(lib/try-on.js closetLine)
export { CLOSET_CMD };
export const chatHint = (code) => `${CLOSET_CMD} ${String(code).replace(/^(\D+?)(\d+)$/, '$1 $2')}`;
export async function copyCode(code) {
  const hint = chatHint(code);
  try { await navigator.clipboard.writeText(hint); toast(`${hint} 복사했어요 · 방송 채팅에 붙여 넣으면 사서 바로 입어요`); }
  catch { toast(`방송 채팅에 ${hint} 처럼 쳐요`); }
}
// 칭호 효과 줄(첫 줄 "시즌2까지" 굵게, 다음 줄마다 효과 하나) — 캐릭터 페이지도 같이 쓴다
export const titleEffects = (t) => h('ul', { class: 'kg-title-effects' },
  t.until ? h('li', { class: 'kg-title-until' }, t.until) : null, ...(t.perks || []).map((p) => h('li', null, p)));
const codeButton = (code, { accent = false } = {}) => h('button', { type: 'button', class: 'kg-item-code' + (accent ? ' accent' : ''), title: `번호 복사 · ${chatHint(code)}`, 'aria-label': `${code} 번호 복사`, onclick: () => copyCode(code) }, code);

export async function renderItems(root, app) {
  document.title = `옷 도감 · ${BRAND}`;
  const badge = h('div', { class: 'kg-season-host' });
  const sexes = h('div', { class: 'kg-toggle', role: 'group', 'aria-label': '옷 그림 성별' });
  const stats = h('div', { class: 'kg-hero-stats inline' });
  const filters = h('div', { class: 'kg-filters', role: 'group', 'aria-label': '묶음 고르기' });
  const list = h('div', { class: 'kg-item-list' }, loading());
  const main = h('main', { id: 'main', class: 'fp-main kg-main items-main', tabindex: '-1' },
    h('div', { class: 'kg-toolbar' }, h('div', { class: 'kg-toolbar-in' }, filters, sexes)), list);
  root.replaceChildren(h('div', { class: 'fp kg-site' },
    ...nightTop(app),
    h('div', { class: 'kg-night compact' },
      h('div', { class: 'kg-wrap' },
        h('section', { class: 'kg-hero small' },
          h('div', { class: 'kg-hero-copy' }, badge, h('h1', { class: 'display' }, '옷 도감'),
            h('p', { class: 'intro' }, '이번 시즌에 살 수 있는 옷을 모았어요. 옷은 레벨과 관계없이 냥만 있으면 살 수 있어요. 번호는 방송 채팅의 !옷장 과 같아요 — 방송 채팅에 !옷장 상의 11 처럼 치면 사서 바로 입어요(번호를 누르면 복사돼요). 같은 번호 옷은 캐릭터 성별에 맞는 몸 버전으로 입혀져요.'), stats)))),
    main,
    siteFoot(app, '입은 사람 수는 메인 페이지에 보이는 방송만 세요.')));
  const [catalog, home] = await Promise.all([loadCatalog(app.base).catch(() => buildCatalog([])), kiugiApi.home().catch(() => null)]);
  const seasonId = home?.season?.id || catalog.last;
  const counts = new Map((home?.items || []).map((x) => [x.id, x.count]));
  const { groups, rewards, titles, rule } = itemGroups(catalog, seasonId, counts);
  const season = catalog.seasons[seasonId];
  const seasonInfo = home?.season || (season ? { id: seasonId, name: season.name, endsAt: season.endsAt } : null);
  badge.replaceChildren(seasonBadge(seasonInfo));
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  if (total) stats.replaceChildren(...statTiles([
    { value: fmt(total), label: '이번 시즌 옷' },
    titles.length ? { value: fmt(titles.length), label: '시즌 칭호' } : rewards.length ? { value: fmt(rewards.length), label: '시즌 보상' } : null]));
  let gender = 'f', pick = 'all';
  // 전신 의상 묶음(outfit)은 세로 칸으로 크게, 나머지는 정사각형
  const itemCard = (it, reward = false, tall = false) => h('li', { class: 'kg-item' + (reward ? ' reward' : '') },
    h('div', { class: 'kg-item-media' },
      itemArt(catalog, it.id, { base: app.base, label: it.name, gender, tall }),
      it.code ? codeButton(it.code) : null),
    h('div', { class: 'kg-item-body' },
      h('span', { class: 'kg-item-sub' + (reward ? ' accent' : '') }, reward ? '시즌 보상 · 시즌이 끝나도 남아요' : [it.style, it.place].filter(Boolean).join(' · ')),
      h('b', { class: 'kg-item-name' }, it.name),
      // 옷에는 레벨 조건이 없다(2026-10-10) — Lv 표시는 예전 모양 시즌 보상·칭호에만
      h('span', { class: 'kg-item-price' }, h('b', null, `${fmt(it.price)}냥`), reward && it.level > 1 ? h('span', { class: 'kg-chip' }, `Lv.${it.level}+`) : null),
      h('span', { class: 'kg-item-count' + (it.count ? '' : ' none') }, wearLine(it.count))));
  // 칭호 카드: 칭호 배지 그림(입는 것이 아니다) · 이름 · 효과(사용자 10/9: "시즌2까지 / 효과1 / 효과2" 처럼 줄마다) · 값
  const titleCard = (t) => h('li', { class: 'kg-item kg-title' },
    h('div', { class: 'kg-item-media kg-title-media' },
      t.image ? h('img', { class: 'kg-title-img', src: titleImageUrl(t, app.base), alt: t.name, loading: 'eager', decoding: 'async' }) : h('b', { class: 'kg-title-word' }, t.name),
      codeButton(t.code, { accent: true })),
    h('div', { class: 'kg-item-body' },
      h('b', { class: 'kg-item-name' }, t.name),
      titleEffects(t),
      h('span', { class: 'kg-item-price' }, h('b', null, `${fmt(t.price)}냥`), h('span', { class: 'kg-chip' }, `Lv.${t.level}+`), t.minAttendance ? h('span', { class: 'kg-chip' }, `출석 ${fmt(t.minAttendance)}번`) : null)));
  const rewardGroup = rewards.length ? { slot: 'reward', name: '시즌 보상', items: rewards, reward: true } : null;
  const titleGroup = titles.length ? { slot: 'title', name: '시즌 칭호', items: titles, title: true } : null;
  const all = [...groups, ...(rewardGroup ? [rewardGroup] : []), ...(titleGroup ? [titleGroup] : [])];
  // replaceChildren 에 null 을 넘기면 "null" 글자가 생기므로 빈 것은 뺀다
  const paint = () => list.replaceChildren(...[
    ...(groups.length ? all.filter((g) => pick === 'all' || g.slot === pick) : [{ name: '옷', items: [], empty: true }]).map((g) => h('section', { class: 'kg-sec' + (g.reward ? ' kg-rewards' : g.title ? ' kg-titles' : '') },
      g.title ? secHead('시즌 칭호', `${TITLE_NOTE(rule)} 방송 채팅에 ${chatHint(`${TITLE_WORD}1`)} 처럼 번호를 쳐요.`)
        : g.reward ? secHead('시즌 보상', REWARD_NOTE(rule))
        : secHead(g.name, g.empty ? '' : `${g.items.length}${unit(g.slot)}${groupPrice(g) ? ` · 각 ${fmt(groupPrice(g))}냥` : ''}${g.code ? ` · 방송 채팅에 ${chatHint(`${g.code}1`)} 처럼 번호를 쳐요` : ''}`),
      g.empty ? h('p', { class: 'empty' }, '옷 목록을 불러오지 못했어요.')
        : h('ul', { class: 'kg-items' + (g.title ? ' kg-title-list' : '') }, ...g.items.map((it) => (g.title ? titleCard(it) : itemCard(it, Boolean(g.reward), g.slot === 'outfit')))))),
    home ? null : h('p', { class: 'note' }, '지금은 입은 사람 수를 불러오지 못했어요. 이름·값만 보여요.')].filter(Boolean));
  // 묶음 고르기(전체 · 의상 · 신발 … · 시즌 칭호)
  const filterBtn = (v, label, n) => h('button', { type: 'button', class: 'kg-filter', 'aria-pressed': String(v === pick), dataset: { v },
    onclick: () => {
      pick = v; for (const b of filters.children) b.setAttribute('aria-pressed', String(b.dataset.v === v)); paint();
      // 막대가 화면 위에 붙어 있을 때(아래로 내려 본 뒤) 고르면 목록 처음으로
      if (filters.getBoundingClientRect().top < 120) main.scrollIntoView({ block: 'start' });
    } },
    label, h('span', { class: 'kg-filter-n' }, fmt(n)));
  if (all.length) filters.replaceChildren(filterBtn('all', '전체', total + rewards.length + titles.length), ...all.map((g) => filterBtn(g.slot, g.name, g.items.length)));
  else filters.remove();
  const sexBtn = (v, label) => h('button', { type: 'button', 'aria-pressed': String(v === gender), onclick: () => { gender = v; for (const b of sexes.children) b.setAttribute('aria-pressed', String(b === btns[v])); paint(); } }, label);
  const btns = { f: sexBtn('f', '여자'), m: sexBtn('m', '남자') };
  sexes.replaceChildren(btns.f, btns.m);
  paint();
}
