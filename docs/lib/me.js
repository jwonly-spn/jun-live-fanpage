// "내 캐릭터"(2026-10-18 사이트 새 구조 — 매일 들어와 내 캐릭터를 확인하고 싶게): 이 브라우저에만 기억한다(서버로 보내지 않는다 — 로그인 없음).
//  · 내 캐릭터 고르기: 캐릭터 페이지·찾은 결과의 "이게 나예요" → {slug, id, djName}(아이디는 청취자가 방송에서 직접 만든 것).
//  · 지난 방문 뒤 달라진 것: 내 캐릭터를 볼 때마다 그때 모습(레벨·하트·입은 옷·인기 순위·펫·칭호)을 적어 두고, 30분 넘게 지나 다시 오면
//    "지난번 마지막 모습"과 견줘 달라진 것(하트 +n · 레벨 업 · 새 옷 · 순위)을 보여 준다. 같은 방문 안(30분)에는 같은 기준이라 새로 고쳐도 같은 소식.
//  · 연속 방문(한국 날짜): 어제도 왔으면 +1, 하루 빠지면 1부터.
//  저장소(localStorage)가 막혀 있으면(사생활 모드 등) 이번 창에서만 기억한다. DOM 없이 동작(저장소를 넘겨받는다 — 노드 시험).
import { kstDay } from './hearts.js';

export const ME_KEY = 'kg_me', SNAP_KEY = 'kg_me_snap', STREAK_KEY = 'kg_streak';
export const VISIT_GAP = 30 * 60 * 1000;
const memory = new Map();
const SLUG = /^[a-hjkmnp-z2-9]{8}$/, ID = /^[가-힣]{1,6}#[가-힣A-Za-z0-9]{1,8}$/;

function safe(storage) {
  return {
    get(k) { try { const v = storage?.getItem?.(k); if (v !== null && v !== undefined) return JSON.parse(v); } catch { /* 막힌 저장소·깨진 글 */ } return memory.has(k) ? memory.get(k) : null; },
    set(k, v) { memory.set(k, v); try { storage?.setItem?.(k, JSON.stringify(v)); } catch { /* 이번 창에서만 */ } },
    remove(k) { memory.delete(k); try { storage?.removeItem?.(k); } catch { /* 무시 */ } },
  };
}
const base = (id) => String(id ?? '').split('#')[0];
const norm = (id) => String(id ?? '').normalize('NFC');

// 내 캐릭터
export function getMe(storage) {
  const v = safe(storage).get(ME_KEY);
  if (!v || !SLUG.test(v.slug) || !ID.test(norm(v.id))) return null;
  return { slug: v.slug, id: norm(v.id), base: base(norm(v.id)), djName: typeof v.djName === 'string' ? v.djName.slice(0, 20) : '', at: Number(v.at) || 0 };
}
export function setMe(storage, { slug, id, djName = '' }, now = Date.now()) {
  if (!SLUG.test(slug) || !ID.test(norm(id))) return null;
  const s = safe(storage), prev = getMe(storage);
  // 다른 캐릭터로 바꾸면 지난 모습 기록도 새로
  if (!prev || prev.slug !== slug || prev.id !== norm(id)) s.remove(SNAP_KEY);
  s.set(ME_KEY, { slug, id: norm(id), djName: String(djName || '').slice(0, 20), at: now });
  return getMe(storage);
}
export function clearMe(storage) { const s = safe(storage); s.remove(ME_KEY); s.remove(SNAP_KEY); }
export const isMe = (storage, slug, id) => { const m = getMe(storage); return Boolean(m) && m.slug === slug && m.id === norm(id); };

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
// 내 캐릭터를 볼 때마다: 그때 모습을 적고, 견줄 기준(baseline)을 돌려준다.
//  기록 {base, cur, curAt}: 마지막으로 본 때(curAt)에서 VISIT_GAP 넘게 지났으면 새 방문 — 기준 = 지난번 마지막 모습(cur). 같은 방문이면 기준 그대로.
export function observe(storage, snap, now = Date.now()) {
  const s = safe(storage), rec = s.get(SNAP_KEY);
  const ok = (x) => x && typeof x === 'object' && Number.isFinite(x.level) && Number.isFinite(x.hearts);
  let baseline = ok(rec?.base) ? rec.base : null;
  const cur = ok(rec?.cur) ? rec.cur : null, curAt = Number(rec?.curAt) || 0;
  if (cur && now - curAt > VISIT_GAP) baseline = cur;
  s.set(SNAP_KEY, { base: baseline, cur: snap, curAt: now });
  return { baseline, diff: diffSnap(baseline, snap) };
}

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
