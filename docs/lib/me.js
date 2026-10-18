// "내 캐릭터"·"즐겨찾기"(2026-10-18 사이트 새 구조 — 매일 들어와 내 캐릭터를 확인하고 싶게): 이 브라우저(localStorage)에만 기억한다.
//  서버로 보내지 않고, 접속 주소(IP)도 쓰지 않는다 — 로그인 없음. 다른 기기·다른 브라우저에서는 따로 정한다.
//  · 내 캐릭터(여러 명 — 2026-10-18 사용자 "한 사람이 여러 방에서 여러 디제이를 키울 수도 있잖아"): 캐릭터 페이지·찾은 결과의 "이게 나예요" → 목록에 더한다(12명까지).
//    kg_mine = [{slug, id, djName, at}](넣은 차례). 예전에 하나만 기억하던 kg_me(+ 지난 모습 kg_me_snap)는 처음 읽을 때 목록 하나로 옮기고 예전 열쇠는 지운다.
//  · 지난 방문 뒤 달라진 것(캐릭터마다 따로 — kg_mine_snap = {"<slug>/<아이디>": {base, cur, curAt}}): 내 캐릭터를 볼 때마다 그때 모습(레벨·하트·입은 옷·인기 순위·펫·칭호)을 적어 두고,
//    30분 넘게 지나 다시 오면 "지난번 마지막 모습"과 견줘 달라진 것(하트 +n · 레벨 업 · 새 옷 · 순위)을 보여 준다. 같은 방문 안(30분)에는 같은 기준이라 새로 고쳐도 같은 소식.
//    내 캐릭터에서 뺀 캐릭터의 기록도 최근 것 6개는 남겨 둔다(되돌리기·다시 넣으면 이어서).
//  · 즐겨찾기(kg_fav = [{slug, id, djName, at}], 30개까지, 새로 넣은 것이 앞): 캐릭터 페이지·찾은 결과의 ☆ → 다음에 첫 화면 찾기 칸을 누르면 바로 아래에 보인다.
//  · 연속 방문(한국 날짜): 어제도 왔으면 +1, 하루 빠지면 1부터.
//  저장소가 막혀 있으면(사생활 모드 등) 이번 창에서만 기억한다. DOM 없이 동작(저장소를 넘겨받는다 — 노드 시험).
import { kstDay } from './hearts.js';

export const ME_KEY = 'kg_me', SNAP_KEY = 'kg_me_snap', STREAK_KEY = 'kg_streak';
export const MINE_KEY = 'kg_mine', SNAPS_KEY = 'kg_mine_snap', FAV_KEY = 'kg_fav';
export const MINE_MAX = 12, FAV_MAX = 30, SNAP_SPARE = 6;
export const VISIT_GAP = 30 * 60 * 1000;
const SLUG = /^[a-hjkmnp-z2-9]{8}$/, ID = /^[가-힣]{1,6}#[가-힣A-Za-z0-9]{1,8}$/;
// 이번 창 메모리(저장소마다 따로 — 저장소가 없으면 하나)
const memories = new WeakMap(), bare = new Map();
function memOf(storage) {
  if (!storage || (typeof storage !== 'object' && typeof storage !== 'function')) return bare;
  let m = memories.get(storage);
  if (!m) memories.set(storage, (m = new Map()));
  return m;
}

// 저장소 감싸기: 읽을 때는 저장소 먼저(없으면 이번 창 메모리). 저장소에 쓰면 메모리 사본은 지운다(다른 탭이 바꾼 것을 옛 사본이 덮지 않게).
//  못 쓰면(막힘·꽉 참) 이번 창 메모리에만 두고, 저장소의 예전 값은 지운다(메모리 값이 보이게).
function safe(storage) {
  const memory = memOf(storage);
  return {
    get(k) {
      try { const v = storage?.getItem?.(k); if (v !== null && v !== undefined) return JSON.parse(v); } catch { /* 막힌 저장소·깨진 글 */ }
      return memory.has(k) ? memory.get(k) : null;
    },
    set(k, v) {
      try {
        if (typeof storage?.setItem !== 'function') throw new Error('저장소 없음');
        storage.setItem(k, JSON.stringify(v));
        memory.delete(k);
      } catch {
        memory.set(k, v);
        try { storage?.removeItem?.(k); } catch { /* 무시 */ }
      }
    },
    remove(k) { memory.delete(k); try { storage?.removeItem?.(k); } catch { /* 무시 */ } },
  };
}
const norm = (id) => String(id ?? '').normalize('NFC');
const baseOf = (id) => norm(id).split('#')[0];
// 캐릭터 열쇠: "<DJ 페이지 주소>/<전체 아이디>"
export const charKey = (slug, id) => `${slug}/${norm(id)}`;
const same = (e, slug, id) => e.slug === slug && e.id === norm(id);

// 한 칸 → {slug, id, base, djName, at} (모양이 틀리면 null)
function entryOf(v) {
  if (!v || typeof v !== 'object' || !SLUG.test(v.slug) || !ID.test(norm(v.id))) return null;
  const id = norm(v.id);
  return { slug: v.slug, id, base: baseOf(id), djName: typeof v.djName === 'string' ? v.djName.slice(0, 20) : '', at: Number(v.at) || 0 };
}
const packed = (e) => ({ slug: e.slug, id: e.id, djName: e.djName, at: e.at });
// 목록 고르기: 모양이 맞는 것만 · 같은 캐릭터는 한 번 · 최대 수까지
function cleanList(raw, max) {
  const out = [], seen = new Set();
  for (const v of Array.isArray(raw) ? raw : []) {
    const e = entryOf(v);
    if (!e) continue;
    const k = charKey(e.slug, e.id);
    if (seen.has(k)) continue;
    seen.add(k); out.push(e);
    if (out.length >= max) break;
  }
  return out;
}
// 목록에 넣기(같은 캐릭터면 그대로 — DJ 이름만 새로). index 가 있으면 그 자리에(되돌리기), 없으면 front ? 맨 앞 : 맨 뒤.
//  → {ok:true, entry, added, index} | {ok:false, reason:'invalid'|'full', max}
function putIn(s, key, list, max, { slug, id, djName = '' } = {}, at, { index = null, front = false } = {}) {
  const e = entryOf({ slug, id, djName, at });
  if (!e) return { ok: false, reason: 'invalid' };
  const i = list.findIndex((x) => same(x, e.slug, e.id));
  if (i >= 0) {
    if (e.djName && list[i].djName !== e.djName) { list[i] = { ...list[i], djName: e.djName }; s.set(key, list.map(packed)); }
    return { ok: true, entry: list[i], added: false, index: i };
  }
  if (list.length >= max) return { ok: false, reason: 'full', max };
  const where = Number.isInteger(index) ? Math.max(0, Math.min(index, list.length)) : front ? 0 : list.length;
  list.splice(where, 0, e);
  s.set(key, list.map(packed));
  return { ok: true, entry: e, added: true, index: where };
}
function takeOut(s, key, list, slug, id) {
  const i = list.findIndex((x) => same(x, slug, id));
  if (i < 0) return null;
  const [entry] = list.splice(i, 1);
  s.set(key, list.map(packed));
  return { entry, index: i };
}

// ---- 내 캐릭터(여러 명) ----
export function listMine(storage) {
  const s = safe(storage), raw = s.get(MINE_KEY);
  if (Array.isArray(raw)) return cleanList(raw, MINE_MAX);
  // 예전(하나만 기억하던 때 — kg_me): 그 하나를 목록으로, 그 지난 모습(kg_me_snap)은 그 캐릭터 몫으로 옮기고 예전 열쇠는 지운다.
  const oldRaw = s.get(ME_KEY);
  if (oldRaw === null) return [];
  const old = entryOf(oldRaw), list = old ? [old] : [];
  s.set(MINE_KEY, list.map(packed));
  const snap = s.get(SNAP_KEY);
  if (old && snap && typeof snap === 'object' && (okSnap(snap.cur) || okSnap(snap.base))) s.set(SNAPS_KEY, { ...snapsOf(s), [charKey(old.slug, old.id)]: snap });
  s.remove(ME_KEY); s.remove(SNAP_KEY);
  return list;
}
export const isMine = (storage, slug, id) => listMine(storage).some((e) => same(e, slug, id));
// 넣기(맨 뒤 — 처음 정한 캐릭터가 늘 맨 앞). at = 넣은 때(되돌리기는 예전 값 그대로)
export function addMine(storage, who, at = Date.now(), { index = null } = {}) {
  return putIn(safe(storage), MINE_KEY, listMine(storage), MINE_MAX, who, at, { index });
}
// 빼기 → {entry, index}(되돌리기용) | null. 지난 모습 기록은 바로 지우지 않는다(다시 넣으면 이어서 — observe 가 오래된 것을 정리).
export const removeMine = (storage, slug, id) => takeOut(safe(storage), MINE_KEY, listMine(storage), slug, id);
export function clearMine(storage) { const s = safe(storage); s.set(MINE_KEY, []); s.remove(SNAPS_KEY); s.remove(ME_KEY); s.remove(SNAP_KEY); }
// 첫 번째 내 캐릭터(예전 하나만 쓰던 곳 — 없으면 null)
export const getMe = (storage) => listMine(storage)[0] || null;

// ---- 즐겨찾기 ----
export const listFavs = (storage) => cleanList(safe(storage).get(FAV_KEY), FAV_MAX);
export const isFav = (storage, slug, id) => listFavs(storage).some((e) => same(e, slug, id));
// 넣기(새로 넣은 것이 맨 앞 — index 가 있으면 그 자리)
export function addFav(storage, who, at = Date.now(), { index = null } = {}) {
  return putIn(safe(storage), FAV_KEY, listFavs(storage), FAV_MAX, who, at, { index, front: true });
}
export const removeFav = (storage, slug, id) => takeOut(safe(storage), FAV_KEY, listFavs(storage), slug, id);
// 누를 때마다 넣었다 뺐다 → {ok, on, reason?}
export function toggleFav(storage, who, at = Date.now()) {
  if (isFav(storage, who?.slug, who?.id)) { removeFav(storage, who.slug, who.id); return { ok: true, on: false }; }
  const r = addFav(storage, who, at);
  return r.ok ? { ok: true, on: true, entry: r.entry } : { ok: false, on: false, reason: r.reason, max: r.max };
}

// ---- 지난 모습 ----
// 그때 모습(달라진 것을 견주는 데 쓰는 것만): 시즌 · 레벨 · 하트 · 입은 옷 · 인기 순위(메인 인기 12 안 — 없으면 null) · 함께하는 펫 · 단 칭호
export function snapOf(data, { rank = null } = {}, now = Date.now()) {
  const worn = {};
  for (const [k, v] of Object.entries(data?.worn && typeof data.worn === 'object' ? data.worn : {})) if (typeof v === 'string') worn[k] = v;
  const pet = data?.pet && typeof data.pet.id === 'string' && Number.isInteger(data.pet.stage) ? { id: data.pet.id, stage: data.pet.stage } : null;
  return { season: data?.season?.id || null, level: Math.max(1, Number(data?.level) || 1), hearts: Math.max(0, Number(data?.hearts) || 0), worn,
    rank: Number.isInteger(rank) && rank > 0 ? rank : null, pet, titles: Array.isArray(data?.titles) ? data.titles.filter((t) => typeof t === 'string').slice(0, 3) : [], at: now };
}
// 달라진 것: [{kind, from, to}] — kind: hearts(하트 늘어남) · level(레벨 업) · worn(바뀐 칸 수) · rank(인기 순위 — 처음 들어옴 from null · 올라감 · 내려감 · 빠짐 to null) · pet(단계 오름 · 새 펫) · title(새 칭호)
//  시즌이 바뀌었으면 견주지 않는다(newSeason). prev 가 없으면 first.
export function diffSnap(prev, now) {
  if (!prev) return { first: true, newSeason: false, changes: [], up: false };
  if (prev.season && now.season && prev.season !== now.season) return { first: false, newSeason: true, changes: [], up: false };
  const out = [];
  if (now.hearts > prev.hearts) out.push({ kind: 'hearts', from: prev.hearts, to: now.hearts });
  if (now.level > prev.level) out.push({ kind: 'level', from: prev.level, to: now.level });
  const slots = new Set([...Object.keys(prev.worn || {}), ...Object.keys(now.worn || {})]);
  let changed = 0; for (const k of slots) if ((prev.worn || {})[k] !== (now.worn || {})[k] && (now.worn || {})[k]) changed++;
  if (changed) out.push({ kind: 'worn', from: 0, to: changed });
  if (prev.rank !== now.rank && (prev.rank || now.rank)) out.push({ kind: 'rank', from: prev.rank, to: now.rank });
  if (now.pet && (!prev.pet || prev.pet.id !== now.pet.id || now.pet.stage > prev.pet.stage)) out.push({ kind: 'pet', from: prev.pet && prev.pet.id === now.pet.id ? prev.pet.stage : null, to: now.pet.stage, id: now.pet.id });
  const newTitle = (now.titles || []).find((t) => !(prev.titles || []).includes(t));
  if (newTitle) out.push({ kind: 'title', from: null, to: newTitle });
  const up = out.some((c) => c.kind !== 'rank' || (c.to !== null && (c.from === null || c.to < c.from)));
  return { first: false, newSeason: false, changes: out, up };
}
const okSnap = (x) => x && typeof x === 'object' && Number.isFinite(x.level) && Number.isFinite(x.hearts);
function snapsOf(s) { const v = s.get(SNAPS_KEY); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
// 남길 기록: 내 캐릭터 것은 모두, 그 밖(뺀 캐릭터)은 최근에 본 SNAP_SPARE 개까지
function pruneSnaps(all, mine, keep) {
  const own = new Set(mine.map((e) => charKey(e.slug, e.id)));
  own.add(keep);
  const out = {}, spare = [];
  for (const [k, v] of Object.entries(all)) {
    if (!v || typeof v !== 'object') continue;
    if (own.has(k)) out[k] = v; else spare.push([k, v]);
  }
  spare.sort((a, b) => (Number(b[1].curAt) || 0) - (Number(a[1].curAt) || 0));
  for (const [k, v] of spare.slice(0, SNAP_SPARE)) out[k] = v;
  return out;
}
// 내 캐릭터(who = {slug, id})를 볼 때마다: 그때 모습을 적고, 견줄 기준(baseline)을 돌려준다.
//  기록 {base, cur, curAt}: 마지막으로 본 때(curAt)에서 VISIT_GAP 넘게 지났으면 새 방문 — 기준 = 지난번 마지막 모습(cur). 같은 방문이면 기준 그대로.
export function observe(storage, who, snap, now = Date.now()) {
  if (!who || !SLUG.test(who.slug) || !ID.test(norm(who.id))) return { baseline: null, diff: diffSnap(null, snap) };
  const s = safe(storage), key = charKey(who.slug, who.id), all = snapsOf(s), rec = all[key];
  let baseline = okSnap(rec?.base) ? rec.base : null;
  const cur = okSnap(rec?.cur) ? rec.cur : null, curAt = Number(rec?.curAt) || 0;
  if (cur && now - curAt > VISIT_GAP) baseline = cur;
  all[key] = { base: baseline, cur: snap, curAt: now };
  s.set(SNAPS_KEY, pruneSnaps(all, listMine(storage), key));
  return { baseline, diff: diffSnap(baseline, snap) };
}

// ---- 연속 방문 · 하트 미션 ----
// 연속 방문(한국 날짜): prev {day, n, best} → 오늘 값. 같은 날이면 그대로, 어제면 +1, 그 밖은 1.
export function streakAfter(prev, today) {
  const ok = prev && /^\d{4}-\d{2}-\d{2}$/.test(prev.day) && Number.isInteger(prev.n) && prev.n > 0;
  if (ok && prev.day === today) return { day: today, n: prev.n, best: Math.max(prev.best || 0, prev.n), today: false };
  const y = new Date(Date.parse(today + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
  const n = ok && prev.day === y ? prev.n + 1 : 1;
  return { day: today, n, best: Math.max(ok ? prev.best || prev.n : 0, n), today: true };
}
export function bumpStreak(storage, now = Date.now()) {
  const s = safe(storage), next = streakAfter(s.get(STREAK_KEY), kstDay(now));
  s.set(STREAK_KEY, { day: next.day, n: next.n, best: next.best });
  return next;
}
// 하루 하트 미션: 오늘 하트를 몇 캐릭터에 보냈는지(hearts.js 기억) → 목표 3
export const HEART_GOAL = 3;
export const missionOf = (sent) => ({ sent, goal: HEART_GOAL, done: sent >= HEART_GOAL, left: Math.max(0, HEART_GOAL - sent) });

// 찾기 칸 아래 목록 거르기(적은 글이 아이디나 DJ 이름에 들어 있으면 — 띄어쓰기는 뺀다). 빈 글이면 모두.
export function matchSaved(entry, text) {
  const q = norm(text).replace(/\s+/g, '').toLowerCase();
  if (!q) return true;
  return norm(entry?.id).toLowerCase().includes(q) || norm(entry?.djName).replace(/\s+/g, '').toLowerCase().includes(q);
}
