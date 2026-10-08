// 옷 도감(items): 이번 시즌 옷을 칸마다 — 옷 그림·이름·값(냥)·몇 레벨부터·입은 사람 수. 시즌 보상은 따로.
// 이름·값·레벨은 사이트에 복사된 시즌 목록(docs/kiugi/season-*.json, 먼치킨과 같은 값)에서, 입은 사람 수는 메인 페이지 자료(home.items)에서.
// 입은 사람 수는 메인 페이지에 보이는 방송(main)만 센다. 옷 그림은 여자·남자 캐릭터용을 단추로 바꿔 본다(상의·하의·겉옷·신발).
import { h } from '../lib/dom.js';
import { kiugiApi } from '../api.js';
import { loadCatalog, buildCatalog } from '../lib/kiugi-draw.js';
import { loading, nightTop, siteFoot, secHead, BRAND } from './common.js';
import { seasonLine } from './kiugi.js';
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

export async function renderItems(root, app) {
  document.title = `옷 도감 · ${BRAND}`;
  const pill = h('span', { class: 'kg-pill season' }, '시즌 정보를 불러오는 중…');
  const sexes = h('div', { class: 'kg-toggle', role: 'group', 'aria-label': '옷 그림' });
  const main = h('main', { id: 'main', class: 'fp-main kg-main', tabindex: '-1' }, loading());
  root.replaceChildren(h('div', { class: 'fp kg-site' },
    h('div', { class: 'kg-night' }, ...nightTop(app),
      h('div', { class: 'kg-wrap' },
        h('section', { class: 'kg-hero small' },
          h('div', { class: 'kg-hero-copy' }, pill, h('h1', { class: 'display' }, '옷 도감'),
            h('p', { class: 'intro' }, '이번 시즌에 살 수 있는 옷을 칸마다 모았어요. 방송 채팅에 번호를 치면 사서 바로 입어요.'), sexes)))),
    main,
    siteFoot(app, '입은 사람 수는 메인 페이지에 보이는 방송만 세요.')));
  const [catalog, home] = await Promise.all([loadCatalog(app.base).catch(() => buildCatalog([])), kiugiApi.home().catch(() => null)]);
  const seasonId = home?.season?.id || catalog.last;
  const counts = new Map((home?.items || []).map((x) => [x.id, x.count]));
  const { groups, rewards, rule } = itemGroups(catalog, seasonId, counts);
  const season = catalog.seasons[seasonId];
  pill.textContent = season ? '🎃 ' + seasonLine(home?.season || { name: season.name, endsAt: season.endsAt }) : '🍂 다음 시즌 준비 중';
  let gender = 'f';
  const itemCard = (it, reward = false) => h('li', { class: 'kg-item' + (reward ? ' reward' : '') },
    itemArt(catalog, it.id, { base: app.base, label: it.name, gender }),
    h('span', { class: 'kg-item-body' },
      h('b', { class: 'kg-item-name' }, it.name),
      h('span', { class: 'kg-chips' },
        h('span', { class: 'kg-chip nyang' }, `${fmt(it.price)}냥`),
        h('span', { class: 'kg-chip' }, `Lv.${it.level}`),
        !reward && it.tierName ? h('span', { class: 'kg-chip soft' }, it.tierName) : null),
      h('span', { class: 'kg-item-count' + (it.count ? '' : ' none') }, wearLine(it.count))));
  const paint = () => main.replaceChildren(
    ...(groups.length ? groups : [{ name: '옷', items: [], empty: true }]).map((g) => h('section', { class: 'kg-sec' },
      secHead(g.name, g.empty ? '' : `${g.items.length}벌`),
      g.empty ? h('p', { class: 'empty' }, '옷 목록을 불러오지 못했어요.') : h('ul', { class: 'kg-items' }, ...g.items.map((it) => itemCard(it))))),
    rewards.length ? h('section', { class: 'kg-sec' },
      secHead('시즌 보상', `Lv.${rule.minLevel}${rule.minAttendance ? ` · 출석 ${rule.minAttendance}번` : ''}부터 살 수 있고, 시즌이 끝나도 남아요.`),
      h('ul', { class: 'kg-items' }, ...rewards.map((it) => itemCard(it, true)))) : null,
    home ? null : h('p', { class: 'note' }, '지금은 입은 사람 수를 불러오지 못했어요. 이름·값·레벨만 보여요.'));
  const sexBtn = (v, label) => h('button', { type: 'button', 'aria-pressed': String(v === gender), onclick: () => { gender = v; for (const b of sexes.children) b.setAttribute('aria-pressed', String(b === btns[v])); paint(); } }, label);
  const btns = { f: sexBtn('f', '여자 캐릭터 옷'), m: sexBtn('m', '남자 캐릭터 옷') };
  sexes.replaceChildren(btns.f, btns.m);
  paint();
}
