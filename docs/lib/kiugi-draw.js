// DJ 키우기 그림(사이트) — 먼치킨과 같은 그림 규칙 kiugi-art.js 를 그대로 쓴다(docs/kiugi/: 먼치킨 저장소의 tools/sync-kiugi-site.mjs 가 복사한다).
// 사이트 보안 규칙(CSP: 인라인 style 금지)과 사이트 주소(BASE) 때문에 그린 SVG 글을 조금 고친다(cspSafeSvg).
// DOM 은 함수 안에서만 쓴다(노드 시험에서 이 파일을 그대로 불러 쓴다).
import { characterSvg, itemSvg, svgUrls } from '../kiugi/kiugi-art.js';
import { formatDate } from './text.js';

export const STAGE = '#EFE9F8';
const DEFAULT_EXPRESSION = { level: 1, name: '기본', parts: [] };

// 시즌 목록(season-*.json 원본, 차례대로)과 그림 목록(manifest.files·시즌 폴더의 adjust.json) → 그림·옷 도감에 쓰는 것
//  items: {옷id: {slot, cat, number?, season, name, style?, price, reward?, level?}} (뒤 시즌이 같은 id 를 덮는다 · 시즌 보상은 그 보상이 나온 시즌 폴더)
//   값은 먼치킨(rules.mjs)과 같게(2026-10-10 값 통일): 시즌 옷은 묶음(categories)마다 값 하나(price) — 옷에는 레벨 조건이 없다(level 칸 없음, 예전 등급표 tiers 는 없앴다).
//   style = 느낌 이름(시즌 목록 styles: 귀여움·멋짐·장난). 칸이 있는 예전 모양 시즌 보상만 보상 값과 보상 규칙의 최소 레벨(level).
//  seasons: {시즌id: {id, name, endsAt, expressions, slots:[{id,name}], categories:[{id,name,code,price}], rewardRule:{minLevel, minAttendance, lasts, opensAt}}} · last: 마지막 시즌 id
//   rewardRule.opensAt = 칭호 상점이 열리는 때(ms — 시즌 목록 seasonRewardRule.opensAt, 없으면 season.rewardShopOpensAt · 모르면 null = 처음부터 열림). 먼치킨은 그때부터 시즌 끝까지 칭호를 판다.
//  그림 V3·V4(2026-10-09): 옷은 묶음(categories — V4 는 한벌옷·상의·하의·신발·악세사리)과 디자인 번호(number)가 있다. 묶음이 없는 예전 목록이면 칸마다 한 묶음.
//  titles: {칭호id: {id, season, number, name, icon, perk, desc, price, level, minAttendance}} — 2026-10-09 사용자 "시즌 보상은 칭호로 통일":
//   시즌 보상(seasonRewards)에 칸(slot)이 없으면 칭호(입지 않는다). 얻은 시즌과 다음 시즌까지 효과(rewardRule.lasts = 2). 칸이 있는 예전 목록의 보상은 예전처럼 옷.
export const TITLE_MIN_LEVEL = 10;
// 0.15.62 이하 먼치킨이 올린 예전 시즌 보상 id → 0.15.63 의 악세11~13(같은 그림·같은 칸). 입은 옷 칸·번호를 새 id 로 읽는다.
export const OLD_REWARD_IDS = Object.freeze({ 'pumpkin-crown': 'acc2_11', 'shadow-wings': 'acc2_12', 'moonlight-aura': 'acc2_13' });
const currentId = (id) => OLD_REWARD_IDS[id] || id;
// 칭호 효과 줄: perks(줄 목록) 또는 perk(글 — 줄바꿈·" · "로 나눈다)
const perksOf = (r) => (Array.isArray(r?.perks) ? r.perks : String(r?.perk || '').split(/\n| · /)).map((s) => String(s).trim()).filter(Boolean);
// 칭호 효과가 남는 마지막 시즌 이름("시즌2까지"): 얻은 시즌의 차례(1부터) + lasts − 1
export const titleUntil = (catalog, seasonId, lasts = 2) => { const i = Object.keys(catalog?.seasons || {}).indexOf(seasonId); return `시즌${(i < 0 ? 0 : i) + Math.max(1, lasts)}까지`; };
// 때 글(ISO 또는 ms) → ms, 읽지 못하면 null
const timeOf = (v) => { const t = typeof v === 'number' ? v : typeof v === 'string' && v ? Date.parse(v) : NaN; return Number.isFinite(t) ? t : null; };
// 칭호 상점이 열렸는가(여는 때를 모르면 열린 것으로 본다)
export const titleShopOpen = (rule, now = Date.now()) => !rule?.opensAt || now >= rule.opensAt;
// 칭호 상점이 아직 열리지 않았으면 여는 날 글("10월 30일" — 한국 날짜, 해가 다르면 "2027년 1월 1일"), 열렸거나 모르면 ''
export const titleOpenDate = (rule, now = Date.now()) => (titleShopOpen(rule, now) ? '' : formatDate(new Date(rule.opensAt).toISOString(), now));
// 펫(2026-10-15): 시즌 목록 walk.pets → {id: {id, season, name, emoji, names:[단계 이름 ×5]}}. 먼치킨이 보낸 pets {id: 단계}·pet {id, stage} 를 이 표로 읽는다.
//  펫 그림(Codex 패키지)이 오기 전에는 그림 글자(emoji)로 보인다.
const petsOfSeason = (raw, season) => (Array.isArray(raw?.walk?.pets) ? raw.walk.pets : [])
  .filter((p) => typeof p?.id === 'string' && /^[a-z]{1,20}$/.test(p.id) && Array.isArray(p.names) && p.names.length === 5)
  .map((p) => ({ id: p.id, season, name: String(p.name || p.id), emoji: String(p.emoji || '🐾'), names: p.names.map(String) }));
export const petStage = (pet, stage) => (pet && Number.isInteger(stage) && stage >= 1 && stage <= 5 ? pet.names[stage - 1] : pet?.name || '');
// 모션(2026-10-15 사용자 "청취자들이 모션을 살 수 있게 — 춤·손하트·울기·스쿼트 …"): 시즌 목록 motions → {id: {id, season, name, emoji, price, desc}}.
//  이름·값은 시즌 목록에서만(화면 글에 적어 두지 않는다). 먼치킨이 보낸 사람의 motion(모션 id)은 이 표에 있을 때만 쓴다(모르는 id = 모션 없음).
const motionsOfSeason = (raw, season) => (Array.isArray(raw?.motions) ? raw.motions : [])
  .filter((m) => typeof m?.id === 'string' && /^[a-z][a-z0-9-]{0,23}$/.test(m.id) && typeof m.name === 'string' && m.name.trim())
  .map((m) => ({ id: m.id, season, name: m.name.trim(), emoji: String(m.emoji || '✨'), price: Math.max(0, Number(m.price) || 0), desc: String(m.desc || '') }));
export function buildCatalog(raws = [], art = { files: {}, adjust: {} }) {
  const items = {}, seasons = {}, titles = {}, pets = {}, motions = {};
  let last = null;
  for (const raw of Array.isArray(raws) ? raws : []) {
    const id = raw?.season?.id;
    if (typeof id !== 'string' || !id) continue;
    last = id;
    const styles = raw.styles && typeof raw.styles === 'object' ? raw.styles : {};
    const rule = raw.seasonRewardRule && typeof raw.seasonRewardRule === 'object' ? raw.seasonRewardRule : {};
    // 시즌 칭호는 먼치킨 규칙(KIUGI_RULES.titleShop.minLevel)과 같게 Lv.10 — 시즌 목록에 값이 없어도 Lv.1 로 보이지 않게
    const minLevel = Number(rule.minLevel) || TITLE_MIN_LEVEL;
    const slots = (Array.isArray(raw.slots) ? raw.slots : []).filter((s) => s?.id).map((s) => ({ id: s.id, name: s.name || s.id, cat: s.cat || s.id }));
    const categories = (Array.isArray(raw.categories) && raw.categories.length ? raw.categories : slots).filter((c) => c?.id).map((c) => ({ id: c.id, name: c.name || c.id, code: c.code || c.name || c.id, price: Math.max(0, Number(c.price) || 0) }));
    const catPrice = new Map(categories.map((c) => [c.id, c.price]));
    seasons[id] = {
      id, name: raw.season.name || id, endsAt: raw.season.endsAt || null,
      expressions: Array.isArray(raw.expressions) ? raw.expressions : [],
      slots: slots.map(({ id: sid, name }) => ({ id: sid, name })), categories,
      rewardRule: { minLevel, minAttendance: Number(rule.minAttendance) || 0, lasts: Number(rule.lasts) || 2, opensAt: timeOf(rule.opensAt ?? raw.season.rewardShopOpensAt) },
    };
    for (const it of Array.isArray(raw.items) ? raw.items : []) {
      if (!it?.id) continue;
      const cat = it.cat || slots.find((s) => s.id === it.slot)?.cat || it.slot, style = typeof styles[it.style] === 'string' ? styles[it.style] : '';
      items[it.id] = { slot: it.slot, cat, ...(Number.isInteger(it.number) ? { number: it.number } : {}), season: id, name: it.name, ...(style ? { style } : {}), price: catPrice.get(cat) || 0 };
    }
    for (const p of petsOfSeason(raw, id)) pets[p.id] = p;
    for (const m of motionsOfSeason(raw, id)) motions[m.id] = m;
    (Array.isArray(raw.seasonRewards) ? raw.seasonRewards : []).forEach((r, i) => {
      if (!r?.id) return;
      if (r.slot) items[r.id] = { slot: r.slot, season: id, name: r.name, reward: true, price: Number(r.price) || 0, level: minLevel };
      else titles[r.id] = { id: r.id, season: id, number: i + 1, name: r.name || r.id, image: typeof r.image === 'string' && /^[a-z0-9/_-]+\.png$/.test(r.image) ? r.image : '', perks: perksOf(r).length ? perksOf(r) : perksOf(rule), desc: r.desc || '', price: Number(r.price) || 0, level: minLevel, minAttendance: Number(rule.minAttendance) || 0 };
    });
  }
  return { items, titles, seasons, pets, motions, last, art: { files: art?.files || {}, adjust: art?.adjust || {} } };
}

// 모션 id → 시즌 목록의 모션(모르는 id·빈 값은 null)
export const motionOf = (catalog, id) => (typeof id === 'string' && catalog?.motions && Object.hasOwn(catalog.motions, id) ? catalog.motions[id] : null);
// 그 시즌의 모션 목록(시즌 목록 차례). 그 시즌에 모션이 없으면 모든 시즌의 모션.
export function motionList(catalog, seasonId) {
  const all = Object.values(catalog?.motions || {}), mine = all.filter((m) => m.season === seasonId);
  return mine.length ? mine : all;
}
// "춤추는 중"처럼 지금 하는 모션 한마디(캐릭터 페이지 칩). 모르는 모션은 "<이름> 하는 중".
const DOING = Object.freeze({ dance: '춤추는 중', heart: '손하트 하는 중', cry: '우는 중', squat: '스쿼트 하는 중', trash: '쓰레기 맞는 중', kkang: '깡 춤 추는 중' });
export const motionDoing = (m) => (m ? DOING[m.id] || `${m.name} 하는 중` : '');

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
  return Object.entries(worn && typeof worn === 'object' ? worn : {}).map(([slot, id]) => [slot, catalog?.items?.[id] ? id : currentId(id)]).filter(([, id]) => Boolean(catalog?.items?.[id]))
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([slot, id]) => ({ slot, slotName: slotName(catalog, seasonId, slot), id, name: catalog?.items?.[id]?.name || id }));
}

// 옷 id → 먼치킨 채팅 상점과 같은 번호(상의11·악세12). 묶음·번호가 없는 옷(예전 목록)은 null.
export function itemCodeOf(catalog, seasonId, id) {
  const it = catalog?.items?.[id] || catalog?.items?.[currentId(id)], season = catalog?.seasons?.[it?.season] || catalog?.seasons?.[seasonId];
  const cat = it && Number.isInteger(it.number) ? season?.categories?.find((c) => c.id === it.cat) : null;
  return cat ? `${cat.code}${it.number}` : null;
}
// 단 칭호 id(서버가 보낸 것 — 지금 효과가 있는 것만) → [{id, name, image, perks, until, code}] (모르는 id 는 뺀다)
export function titleList(catalog, ids) {
  return (Array.isArray(ids) ? ids : []).map((id) => catalog?.titles?.[id]).filter(Boolean)
    .map((t) => ({ id: t.id, name: t.name, image: t.image, perks: t.perks, until: titleUntil(catalog, t.season, catalog.seasons?.[t.season]?.rewardRule?.lasts), code: `칭호${t.number}` }));
}
// 칭호 배지 그림 주소(사이트 BASE 아래 kiugi/titles/…)
export const titleImageUrl = (t, base = '/') => (t?.image ? (String(base).endsWith('/') ? base : base + '/') + 'kiugi/' + t.image : '');

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
// 캐릭터 그림 글 → {scene, body}(2026-10-15 사용자 "캐릭터들이 2D 게임 대기 모션처럼 숨쉬듯이"): 캐릭터만 움직이고 바탕은 가만히 있게 둘로 나눈다.
//  scene = 바탕 사각형·입은 배경(background) 만 든 SVG(없으면 null) · body = 나머지(오라·날개·머리·몸·옷·얼굴·악세사리 — 숨쉬기·모션으로 움직인다).
//  둘 다 같은 viewBox 라 같은 칸에 겹치면 원래 그림과 같다. 나눌 것이 없으면 그대로(scene null).
export function splitScene(markup) {
  const s = String(markup ?? ''), open = /^<svg [^>]*>/.exec(s), end = s.indexOf('</defs>');
  if (!open || end < 0) return { scene: null, body: s };
  const at = end + '</defs>'.length;
  const back = /^(?:<rect [^>]*\/>)?(?:<image [^>]*data-step="background"[^>]*\/>)?/.exec(s.slice(at))[0];
  if (!back) return { scene: null, body: s };
  const box = / viewBox="[^"]*"/.exec(open[0])?.[0] || '';
  return { scene: `<svg${box} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${back}</svg>`, body: s.slice(0, at) + s.slice(at + back.length) };
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
  // make 는 요소 하나 또는 요소 목록(캐릭터 무대: 바탕 SVG + 움직이는 캐릭터 칸 — views/cards.js actorNodes)
  const node = make(markup), nodes = Array.isArray(node) ? node.filter(Boolean) : node ? [node] : [];
  stage.replaceChildren(...(nodes.length ? nodes : fallback ? [fallback] : []));
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
