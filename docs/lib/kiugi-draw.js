// DJ 키우기 그림(사이트) — 먼치킨과 같은 그림 규칙 kiugi-art.js 를 그대로 쓴다(docs/kiugi/: 먼치킨 저장소의 tools/sync-kiugi-site.mjs 가 복사한다).
// 사이트 보안 규칙(CSP: 인라인 style 금지)과 사이트 주소(BASE) 때문에 그린 SVG 글을 조금 고친다(cspSafeSvg).
// DOM 은 함수 안에서만 쓴다(노드 시험에서 이 파일을 그대로 불러 쓴다).
import { characterSvg, itemSvg } from '../kiugi/kiugi-art.js';

export const STAGE = '#EFE9F8';
const DEFAULT_EXPRESSION = { level: 1, name: '기본', parts: [] };

// 시즌 목록(season-*.json 원본, 차례대로)과 그림 목록(manifest.files·시즌 폴더의 adjust.json) → 그림·옷 도감에 쓰는 것
//  items: {옷id: {slot, season, name, price, level, tier?, tierName?, reward?}} (뒤 시즌이 같은 id 를 덮는다 · 시즌 보상은 그 보상이 나온 시즌 폴더)
//   값·레벨은 먼치킨(rules.mjs)과 같게: 시즌 옷은 등급표(tiers)의 price·level, 시즌 보상은 보상 값과 보상 규칙의 최소 레벨
//  seasons: {시즌id: {id, name, endsAt, expressions, slots:[{id,name}], rewardRule:{minLevel, minAttendance}}} · last: 마지막 시즌 id
export function buildCatalog(raws = [], art = { files: {}, adjust: {} }) {
  const items = {}, seasons = {};
  let last = null;
  for (const raw of Array.isArray(raws) ? raws : []) {
    const id = raw?.season?.id;
    if (typeof id !== 'string' || !id) continue;
    last = id;
    const tiers = raw.tiers && typeof raw.tiers === 'object' ? raw.tiers : {};
    const rule = raw.seasonRewardRule && typeof raw.seasonRewardRule === 'object' ? raw.seasonRewardRule : {};
    const minLevel = Number(rule.minLevel) || 1;
    seasons[id] = {
      id, name: raw.season.name || id, endsAt: raw.season.endsAt || null,
      expressions: Array.isArray(raw.expressions) ? raw.expressions : [],
      slots: (Array.isArray(raw.slots) ? raw.slots : []).filter((s) => s?.id).map((s) => ({ id: s.id, name: s.name || s.id })),
      rewardRule: { minLevel, minAttendance: Number(rule.minAttendance) || 0 },
    };
    for (const it of Array.isArray(raw.items) ? raw.items : []) {
      if (!it?.id) continue;
      const t = tiers[it.tier] || {};
      items[it.id] = { slot: it.slot, season: id, name: it.name, tier: it.tier, tierName: t.name || it.tier, price: Number(t.price) || 0, level: Number(t.level) || 1 };
    }
    for (const r of Array.isArray(raw.seasonRewards) ? raw.seasonRewards : []) if (r?.id) items[r.id] = { slot: r.slot, season: id, name: r.name, reward: true, price: Number(r.price) || 0, level: minLevel };
  }
  return { items, seasons, last, art: { files: art?.files || {}, adjust: art?.adjust || {} } };
}

// 칸 이름(시즌 목록에 없는 칸 — 시즌 보상의 오라 등 — 은 여기서)
const SLOT_FALLBACK = { aura: '오라' };
export function slotName(catalog, seasonId, slot) {
  const s = (catalog?.seasons?.[seasonId] || catalog?.seasons?.[catalog?.last])?.slots || [];
  return s.find((x) => x.id === slot)?.name || SLOT_FALLBACK[slot] || slot;
}
// 입은 옷 → [{slot, slotName, id, name}] (시즌 칸 순서대로, 모르는 옷은 id 그대로)
export function wornList(catalog, seasonId, worn) {
  const order = ((catalog?.seasons?.[seasonId] || catalog?.seasons?.[catalog?.last])?.slots || []).map((s) => s.id);
  const rank = (slot) => { const i = order.indexOf(slot); return i < 0 ? order.length : i; };
  return Object.entries(worn && typeof worn === 'object' ? worn : {})
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([slot, id]) => ({ slot, slotName: slotName(catalog, seasonId, slot), id, name: catalog?.items?.[id]?.name || id }));
}

// 레벨 표정(레벨마다 바뀐다): 그 시즌 목록에서 레벨 이하 중 가장 높은 것
export function expressionFor(catalog, seasonId, level) {
  const list = (catalog?.seasons?.[seasonId] || catalog?.seasons?.[catalog?.last])?.expressions || [];
  let pick = list[0] || DEFAULT_EXPRESSION;
  for (const e of list) if (Number(e.level) <= Number(level)) pick = e;
  return pick;
}

const attr = (s) => String(s).replace(/["<>&]/g, encodeURIComponent);
const color = (v) => { const m = /^var\(--[\w-]+,\s*([^)]+)\)$/.exec(String(v).trim()); return (m ? m[1] : String(v)).trim(); };
// 그린 SVG 글 → 사이트에 넣을 수 있는 글: 그림 파일 주소를 사이트 BASE 아래로, style="fill:…" 는 fill 속성으로(남은 style 은 뺀다)
export function cspSafeSvg(svg, base = '/') {
  const root = attr((String(base).endsWith('/') ? base : base + '/') + 'kiugi/');
  return String(svg)
    .replace(/ href="\/kiugi\//g, ` href="${root}`)
    .replace(/ style="fill:([^";]*);?"/g, (_, v) => ` fill="${attr(color(v))}"`)
    .replace(/ style="[^"]*"/g, '');
}

// 캐릭터 한 장(글): DJ 캐릭터에 청취자가 입힌 옷, 레벨 표정. stage: 바탕 색 · null 이면 바탕 없이(화면의 무대 그림이 보인다 — 배경 옷을 입으면 그 배경)
export function characterMarkup(catalog, character, worn, level, { seasonId = null, base = '/', label = '', stage = STAGE } = {}) {
  const svg = characterSvg(character || {}, { worn: worn && typeof worn === 'object' ? worn : {} },
    { items: catalog?.items || {}, art: catalog?.art || null, expression: expressionFor(catalog, seasonId, level || 1), solid: stage || STAGE, transparent: stage === null, label });
  return cspSafeSvg(svg, base);
}
// 옷 한 벌만(글): 옷 도감·입은 옷 칸. gender 'm' 이면 남자 캐릭터용 그림이 있는 옷은 그 그림(상의·하의·겉옷·신발)
export function itemMarkup(catalog, id, { base = '/', label = '', gender = 'f' } = {}) {
  // 옷 그림 뒤의 옅은 바탕 사각형은 빼서 화면의 무대 그림이 보이게 한다(배경 옷은 바탕이 없어 그대로)
  return cspSafeSvg(itemSvg(id, { items: catalog?.items || {}, art: catalog?.art || null, label, gender }), base).replace(/<rect x="-200" y="-200" width="1424" height="1424"[^>]*\/>/, '');
}

// 글 → 화면에 넣을 SVG 요소(XML 로 읽는다 — innerHTML 을 쓰지 않는다). 읽지 못하면 null.
export function svgNode(markup) {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const el = doc.documentElement;
  if (!el || el.localName !== 'svg' || doc.getElementsByTagName('parsererror').length) return null;
  return document.importNode(el, true);
}

// docs/kiugi/manifest.json → 시즌 목록·보정값을 한 번만 받아 둔다(실패하면 다음에 다시)
let catalogPromise = null;
export function loadCatalog(base = '/') {
  return catalogPromise ||= (async () => {
    const root = (String(base).endsWith('/') ? base : base + '/') + 'kiugi/';
    const get = async (name) => { const r = await fetch(root + name, { cache: 'no-cache' }); if (!r.ok) throw Error('키우기 그림 목록을 받지 못했어요.'); return r.json(); };
    const manifest = await get('manifest.json');
    const raws = await Promise.all((Array.isArray(manifest.seasons) ? manifest.seasons : []).filter((n) => /^season-[a-z0-9-]+\.json$/.test(n)).map(get));
    const files = manifest.files && typeof manifest.files === 'object' ? manifest.files : {}, adjust = {};
    await Promise.all(Object.keys(files).filter((s) => /^[a-z0-9][a-z0-9_-]*$/.test(s)).map(async (s) => { try { adjust[s] = await get(s + '/adjust.json'); } catch { adjust[s] = {}; } }));
    return buildCatalog(raws, { files, adjust });
  })().catch((e) => { catalogPromise = null; throw e; });
}
