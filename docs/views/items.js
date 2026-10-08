// 옷 도감(items): 이번 시즌 옷을 칸마다 — 이름·값(냥)·몇 레벨부터·입은 사람 수. 시즌 보상은 따로.
// 이름·값·레벨은 사이트에 복사된 시즌 목록(docs/kiugi/season-*.json, 먼치킨과 같은 값)에서, 입은 사람 수는 메인 페이지 자료(home.items)에서.
// 입은 사람 수는 메인 페이지에 보이는 방송(main)만 센다.
import { h } from '../lib/dom.js';
import { kiugiApi } from '../api.js';
import { loadCatalog, buildCatalog } from '../lib/kiugi-draw.js';
import { ilink, loading } from './common.js';
import { seasonLine } from './kiugi.js';

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

export async function renderItems(root, app) {
  document.title = '옷 도감 · 먼치킨 키우기';
  const main = h('main', { id: 'main', class: 'fp-main kg-main', tabindex: '-1' }, loading());
  root.replaceChildren(h('div', { class: 'fp kg-site' },
    h('header', { class: 'fp-top' }, ilink(app.link({ name: 'intro' }), { class: 'fp-brand' }, '먼치킨 키우기')),
    main,
    h('footer', { class: 'fp-foot' }, '스푼이 만든 서비스가 아니에요.')));
  const [catalog, home] = await Promise.all([loadCatalog(app.base).catch(() => buildCatalog([])), kiugiApi.home().catch(() => null)]);
  const seasonId = home?.season?.id || catalog.last;
  const counts = new Map((home?.items || []).map((x) => [x.id, x.count]));
  const { groups, rewards, rule } = itemGroups(catalog, seasonId, counts);
  const season = catalog.seasons[seasonId];
  const itemCard = (it, reward = false) => h('li', { class: 'kg-item' },
    h('b', { class: 'kg-item-name' }, it.name),
    h('span', { class: 'kg-item-meta' }, `${fmt(it.price)}냥 · Lv.${it.level}부터` + (reward ? '' : it.tierName ? ` · ${it.tierName}` : '')),
    h('span', { class: 'kg-item-count' + (it.count ? '' : ' none') }, wearLine(it.count)));
  main.replaceChildren(
    h('section', { class: 'card pad stack' },
      h('h1', { class: 'display' }, '옷 도감'),
      season ? h('span', { class: 'chip-soft' }, '🎃 ' + seasonLine(home?.season || { name: season.name, endsAt: season.endsAt })) : null,
      h('p', { class: 'muted small' }, home ? '입은 사람 수는 메인 페이지에 보이는 방송만 세요.' : '지금은 입은 사람 수를 불러오지 못했어요. 이름·값·레벨만 보여요.')),
    ...(groups.length ? groups : [{ name: '옷', items: [], empty: true }]).map((g) => h('section', { class: 'card pad stack' },
      h('h2', { class: 'sec-title sm' }, g.name),
      g.empty ? h('p', { class: 'empty' }, '옷 목록을 불러오지 못했어요.') : h('ul', { class: 'kg-items' }, ...g.items.map((it) => itemCard(it))))),
    rewards.length ? h('section', { class: 'card pad stack' },
      h('h2', { class: 'sec-title sm' }, '시즌 보상'),
      h('p', { class: 'muted small' }, `Lv.${rule.minLevel}${rule.minAttendance ? ` · 출석 ${rule.minAttendance}번` : ''}부터 살 수 있고, 시즌이 끝나도 남아요.`),
      h('ul', { class: 'kg-items' }, ...rewards.map((it) => itemCard(it, true)))) : null);
}
