// DJ 키우기 그림(사이트) — 먼치킨과 같은 그림 규칙 kiugi-art.js 를 그대로 쓴다(docs/kiugi/: 먼치킨 저장소의 tools/sync-kiugi-site.mjs 가 복사한다).
// 사이트 보안 규칙(CSP: 인라인 style 금지)과 사이트 주소(BASE) 때문에 그린 SVG 글을 조금 고친다(cspSafeSvg).
// DOM 은 함수 안에서만 쓴다(노드 시험에서 이 파일을 그대로 불러 쓴다).
import { characterSvg, itemSvg, svgUrls } from '../kiugi/kiugi-art.js';

export const STAGE = '#EFE9F8';
const DEFAULT_EXPRESSION = { level: 1, name: '기본', parts: [] };

// 시즌 목록(season-*.json 원본, 차례대로)과 그림 목록(manifest.files·시즌 폴더의 adjust.json) → 그림·옷 도감에 쓰는 것
//  items: {옷id: {slot, season, name, price, level, tier?, tierName?, reward?}} (뒤 시즌이 같은 id 를 덮는다 · 시즌 보상은 그 보상이 나온 시즌 폴더)
//   값·레벨은 먼치킨(rules.mjs)과 같게: 시즌 옷은 등급표(tiers)의 price·level, 시즌 보상은 보상 값과 보상 규칙의 최소 레벨
//  seasons: {시즌id: {id, name, endsAt, expressions, slots:[{id,name}], categories:[{id,name,code}], rewardRule:{minLevel, minAttendance}}} · last: 마지막 시즌 id
//  그림 V3·V4(2026-10-09): 옷은 묶음(categories — V4 는 한벌옷·상의·하의·신발·악세사리)과 디자인 번호(number)가 있다. 묶음이 없는 예전 목록이면 칸마다 한 묶음.
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
    const slots = (Array.isArray(raw.slots) ? raw.slots : []).filter((s) => s?.id).map((s) => ({ id: s.id, name: s.name || s.id, cat: s.cat || s.id }));
    const categories = (Array.isArray(raw.categories) && raw.categories.length ? raw.categories : slots).filter((c) => c?.id).map((c) => ({ id: c.id, name: c.name || c.id, code: c.code || c.name || c.id }));
    seasons[id] = {
      id, name: raw.season.name || id, endsAt: raw.season.endsAt || null,
      expressions: Array.isArray(raw.expressions) ? raw.expressions : [],
      slots: slots.map(({ id: sid, name }) => ({ id: sid, name })), categories,
      rewardRule: { minLevel, minAttendance: Number(rule.minAttendance) || 0 },
    };
    for (const it of Array.isArray(raw.items) ? raw.items : []) {
      if (!it?.id) continue;
      const t = tiers[it.tier] || {}, cat = it.cat || slots.find((s) => s.id === it.slot)?.cat || it.slot;
      items[it.id] = { slot: it.slot, cat, ...(Number.isInteger(it.number) ? { number: it.number } : {}), season: id, name: it.name, tier: it.tier, tierName: t.name || it.tier, price: Number(t.price) || 0, level: Number(t.level) || 1 };
    }
    for (const r of Array.isArray(raw.seasonRewards) ? raw.seasonRewards : []) if (r?.id) items[r.id] = { slot: r.slot, season: id, name: r.name, reward: true, price: Number(r.price) || 0, level: minLevel };
  }
  return { items, seasons, last, art: { files: art?.files || {}, adjust: art?.adjust || {} } };
}

// 칸 이름(시즌 목록에 없는 칸 — 시즌 보상의 왕관·날개·오라 — 은 여기서. 그림 V4 부터 보상도 캐릭터가 입는다)
const SLOT_FALLBACK = { crown: '왕관', wings: '날개', aura: '오라' };
export function slotName(catalog, seasonId, slot) {
  const s = (catalog?.seasons?.[seasonId] || catalog?.seasons?.[catalog?.last])?.slots || [];
  return s.find((x) => x.id === slot)?.name || SLOT_FALLBACK[slot] || slot;
}
// 입은 옷 → [{slot, slotName, id, name}] (시즌 칸 순서대로). 시즌 목록에 없는 옷(예전 판 먼치킨이 올린 그림 V2 옷 id 등)은 그림·이름이 없어 뺀다.
export function wornList(catalog, seasonId, worn) {
  const order = ((catalog?.seasons?.[seasonId] || catalog?.seasons?.[catalog?.last])?.slots || []).map((s) => s.id);
  const extra = Object.keys(SLOT_FALLBACK), rank = (slot) => { const i = order.indexOf(slot); return i < 0 ? order.length + (extra.includes(slot) ? extra.indexOf(slot) : extra.length) : i; };
  return Object.entries(worn && typeof worn === 'object' ? worn : {}).filter(([, id]) => Boolean(catalog?.items?.[id]))
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
// 옷 한 벌만(글): 옷 도감·입은 옷 칸. 그림 V4: 기본 캐릭터(그 성별)가 그 옷(시즌 보상 포함)만 입은 모습을 옷이 있는 곳에 맞춰(옷 그림은 자르지 않는다).
//  gender 'm' 이면 같은 번호 옷의 남자 몸 버전. dj(DJ 캐릭터)를 주면 성별이 같을 때 그 얼굴·머리로. 모르는 옷(예전 판이 올린 지운 옷 등)은 이름 자리 표시.
export function itemMarkup(catalog, id, { base = '/', label = '', gender = 'f', dj = null } = {}) {
  // 바탕 없이(화면의 무대 그림이 보인다). 예전 판의 옅은 바탕 사각형이 있으면 뺀다.
  return cspSafeSvg(itemSvg(id, { label, gender, dj, name: catalog?.items?.[id]?.name || '' }), base).replace(/<rect x="-200" y="-200" width="1424" height="1424"[^>]*\/>/, '');
}

// 그림 칸에 넣기: 그림 파일을 모두 받은 뒤 한 번에 바꾼다(반쯤 그려진 모습 — 예: 몸 지우기 마스크가 늦게 와 회색 이너가 잠깐 보이는 것 — 을 보이지 않게).
// 같은 칸에 여러 번 그리면 마지막 것만(늦게 끝난 앞 그림이 덮지 않게 칸마다 차례 번호). 못 받은 그림이 있으면 칸에 data-kg-art-error.
const LOADS = new Map();
export function preloadImage(url) {
  if (!LOADS.has(url)) LOADS.set(url, new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { LOADS.delete(url); reject(new Error('그림을 불러오지 못했어요: ' + url)); };
    img.src = url;
  }));
  return LOADS.get(url);
}
const PAINTED = new WeakMap();
export async function paintMarkup(stage, markup, { load = preloadImage, make = svgNode, fallback = null } = {}) {
  const seq = (PAINTED.get(stage) || 0) + 1;
  PAINTED.set(stage, seq);
  const failed = [];
  await Promise.all(svgUrls(markup).map((u) => Promise.resolve().then(() => load(u)).catch(() => { failed.push(u); })));
  if (PAINTED.get(stage) !== seq) return false;
  const node = make(markup);
  stage.replaceChildren(...(node ? [node] : fallback ? [fallback] : []));
  if (failed.length) stage.dataset.kgArtError = String(failed.length); else delete stage.dataset.kgArtError;
  return true;
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
