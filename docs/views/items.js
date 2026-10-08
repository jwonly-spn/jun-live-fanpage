// 옷 도감(items): 이번 시즌 옷을 칸마다 — 옷 그림·이름·값(냥)·몇 레벨부터·입은 사람 수. 시즌 보상은 따로.
// 이름·값·레벨은 사이트에 복사된 시즌 목록(docs/kiugi/season-*.json, 먼치킨과 같은 값)에서, 입은 사람 수는 메인 페이지 자료(home.items)에서.
// 입은 사람 수는 메인 페이지에 보이는 방송(main)만 센다. 옷 그림은 여자·남자 캐릭터용을 단추로 바꿔 본다(상의·하의·겉옷·신발).
import { h } from '../lib/dom.js';
import { kiugiApi } from '../api.js';
import { loadCatalog, buildCatalog } from '../lib/kiugi-draw.js';
import { loading, nightTop, siteFoot, secHead, statTiles, BRAND } from './common.js';
import { seasonLine, seasonKicker } from './kiugi.js';
import { itemArt } from './cards.js';

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');

// 도감 묶음(시험에서 바로 쓴다): [{slot, name, items:[{id, name, price, level, tierName, count}]}] + 시즌 보상 묶음
export function itemGroups(catalog, seasonId, counts = new Map()) {
  const season = catalog?.seasons?.[seasonId];
  if (!season) return { groups: [], rewards: [] };
  const mine = Object.entries(catalog.items || {}).filter(([, it]) => it.season === seasonId);
  const row = ([id, it]) => ({ id, name: it.name, price: it.price, level: it.level, tierName: it.tierName || '', count: counts.get(id) || 0 });
  const groups = season.slots.map((s) => ({ slot: s.id, name: s.name, items: mine.filter(([, it]) => !it.reward && it.slot === s.id).map(row) })).filter((g) => g.items.length);
  const rewards = mine.filter(([, it]) => it.reward).map(row);
  return { groups, rewards, rule: season.rewardRule };
}
export const wearLine = (n) => (n > 0 ? `${fmt(n)}명이 입고 있어요` : '아직 입은 사람이 없어요');

// 등급(기본·일반·고급·희귀) → 카드 테두리 색(styles.css .kg-item.tier-<등급>)
const TIER_CLASS = new Set(['basic', 'normal', 'fine', 'rare']);

export async function renderItems(root, app) {
  document.title = `옷 도감 · ${BRAND}`;
  const kicker = h('span', { class: 'kg-kicker', 'aria-hidden': 'true' }, 'COLLECTION');
  const pill = h('span', { class: 'kg-pill season' }, '시즌 정보를 불러오는 중…');
  const sexes = h('div', { class: 'kg-toggle', role: 'group', 'aria-label': '옷 그림' });
  const stats = h('div', { class: 'kg-hero-stats' });
  const feature = h('div', { class: 'kg-feature', 'aria-hidden': 'true' });
  const filters = h('div', { class: 'kg-filters', role: 'group', 'aria-label': '칸 고르기' });
  const list = h('div', { class: 'kg-item-list' }, loading());
  const main = h('main', { id: 'main', class: 'fp-main kg-main items-main', tabindex: '-1' },
    h('div', { class: 'kg-toolbar' }, filters), list);
  root.replaceChildren(h('div', { class: 'fp kg-site' },
    h('div', { class: 'kg-night' }, ...nightTop(app),
      h('div', { class: 'kg-wrap' },
        h('section', { class: 'kg-hero small' },
          h('div', { class: 'kg-hero-copy' }, kicker, pill, h('h1', { class: 'display' }, '옷 도감'),
            h('p', { class: 'intro' }, '이번 시즌에 살 수 있는 옷을 칸마다 모았어요. 방송 채팅에 번호를 치면 사서 바로 입어요.'), sexes, stats),
          feature))),
    main,
    siteFoot(app, '입은 사람 수는 메인 페이지에 보이는 방송만 세요.')));
  const [catalog, home] = await Promise.all([loadCatalog(app.base).catch(() => buildCatalog([])), kiugiApi.home().catch(() => null)]);
  const seasonId = home?.season?.id || catalog.last;
  const counts = new Map((home?.items || []).map((x) => [x.id, x.count]));
  const { groups, rewards, rule } = itemGroups(catalog, seasonId, counts);
  const season = catalog.seasons[seasonId];
  const seasonInfo = home?.season || (season ? { id: seasonId, name: season.name, endsAt: season.endsAt } : null);
  kicker.textContent = season ? `${seasonKicker(seasonInfo)} · COLLECTION` : 'COLLECTION';
  pill.textContent = season ? seasonLine(seasonInfo) : '다음 시즌 준비 중';
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  if (total) stats.replaceChildren(...statTiles([
    { value: fmt(total), label: '이번 시즌 옷' },
    { value: fmt(groups.length), label: '꾸밀 수 있는 칸' },
    rewards.length ? { value: fmt(rewards.length), label: '시즌 보상' } : null]));
  // 넓은 화면의 첫 화면 오른쪽: 시즌 보상 진열(장식 — 같은 내용은 아래 "시즌 보상" 칸에 있다)
  if (rewards.length) feature.replaceChildren(h('span', { class: 'kg-kicker' }, 'SEASON REWARD'),
    h('div', { class: 'kg-feature-row' }, ...rewards.slice(0, 3).map((it) => h('div', { class: 'kg-item reward kg-feature-one' },
      itemArt(catalog, it.id, { base: app.base, label: it.name }), h('span', { class: 'kg-feature-name' }, it.name)))));
  else feature.remove();
  let gender = 'f', pick = 'all';
  const tierOf = (id) => { const t = catalog.items[id]?.tier; return TIER_CLASS.has(t) ? ' tier-' + t : ''; };
  const itemCard = (it, reward = false) => h('li', { class: 'kg-item' + (reward ? ' reward' : tierOf(it.id)) },
    itemArt(catalog, it.id, { base: app.base, label: it.name, gender }),
    h('span', { class: 'kg-item-body' },
      h('b', { class: 'kg-item-name' }, it.name),
      h('span', { class: 'kg-chips' },
        h('span', { class: 'kg-chip nyang' }, `${fmt(it.price)}냥`),
        h('span', { class: 'kg-chip' }, `Lv.${it.level}`),
        reward ? h('span', { class: 'kg-chip tier' }, '시즌 보상') : it.tierName ? h('span', { class: 'kg-chip soft tier' }, it.tierName) : null),
      h('span', { class: 'kg-item-count' + (it.count ? '' : ' none') }, wearLine(it.count))));
  const rewardGroup = rewards.length ? { slot: 'reward', name: '시즌 보상', items: rewards, reward: true } : null;
  const all = [...groups, ...(rewardGroup ? [rewardGroup] : [])];
  // replaceChildren 에 null 을 넘기면 "null" 글자가 생기므로 빈 것은 뺀다
  const paint = () => list.replaceChildren(...[
    ...(groups.length ? all.filter((g) => pick === 'all' || g.slot === pick) : [{ name: '옷', items: [], empty: true }]).map((g) => h('section', { class: 'kg-sec' + (g.reward ? ' kg-rewards' : '') },
      g.reward
        ? secHead('시즌 보상', `Lv.${rule.minLevel}${rule.minAttendance ? ` · 출석 ${rule.minAttendance}번` : ''}부터 살 수 있고, 시즌이 끝나도 남아요.`, null, { kicker: 'SEASON REWARD' })
        : secHead(g.name, g.empty ? '' : `${g.items.length}벌`),
      g.empty ? h('p', { class: 'empty' }, '옷 목록을 불러오지 못했어요.') : h('ul', { class: 'kg-items' }, ...g.items.map((it) => itemCard(it, Boolean(g.reward)))))),
    home ? null : h('p', { class: 'note' }, '지금은 입은 사람 수를 불러오지 못했어요. 이름·값·레벨만 보여요.')].filter(Boolean));
  // 칸 고르기(전체 · 머리 · 얼굴 … · 시즌 보상)
  const filterBtn = (v, label, n) => h('button', { type: 'button', class: 'kg-filter', 'aria-pressed': String(v === pick), dataset: { v },
    onclick: () => {
      pick = v; for (const b of filters.children) b.setAttribute('aria-pressed', String(b.dataset.v === v)); paint();
      // 막대가 화면 맨 위에 붙어 있을 때(아래로 내려 본 뒤) 고르면 목록 처음으로
      if (filters.getBoundingClientRect().top < 40) main.scrollIntoView({ block: 'start' });
    } },
    label, h('span', { class: 'kg-filter-n' }, fmt(n)));
  if (all.length) filters.replaceChildren(filterBtn('all', '전체', total + rewards.length), ...all.map((g) => filterBtn(g.slot, g.name, g.items.length)));
  else filters.remove();
  const sexBtn = (v, label) => h('button', { type: 'button', 'aria-pressed': String(v === gender), onclick: () => { gender = v; for (const b of sexes.children) b.setAttribute('aria-pressed', String(b === btns[v])); paint(); } }, label);
  const btns = { f: sexBtn('f', '여자 캐릭터 옷'), m: sexBtn('m', '남자 캐릭터 옷') };
  sexes.replaceChildren(btns.f, btns.m);
  paint();
}
