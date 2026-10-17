// 서버 답 기억(2026-10-18 사이트 새 구조 — "빠릿빠릿하게"): 서버(뭄바이)가 한 번 답하는 데 1~2초 걸려서, 지난번 답을 이 브라우저에 두고
//  화면을 먼저 그린 뒤(그 사이 새 답을 받는다) 달라졌으면 고친다(stale-while-revalidate).
//  · 메모리(이번 창) + localStorage(다음 방문) — 키 'kg_c:<이름>', 7일 지난 것은 쓰지 않는다. 저장소가 막혀 있으면 메모리만.
//  · 같은 것을 동시에 두 번 묻지 않는다(하나로 묶음). 아주 최근(fresh ms 안)에 받은 답이면 서버에 다시 묻지 않는다.
//  · 기억은 공개 답(메인·DJ 페이지·캐릭터)만 — 이 브라우저 밖으로 보내지 않는다. 너무 많아지면 오래된 것부터 지운다.
//  · 미리 보기(peek/prime): 카드가 이미 아는 것(아이디·레벨·입은 옷·하트·펫·DJ 캐릭터)을 캐릭터 페이지가 바로 그릴 수 있게 메모리에만 둔다.
// DOM 없이 동작(저장소를 넘길 수 있다 — 노드 시험).
const PREFIX = 'kg_c:', MAX_AGE = 7 * 864e5, MAX_KEYS = 40;
const mem = new Map(), inflight = new Map(), previews = new Map();

function local() { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } }
function read(storage, key) {
  if (mem.has(key)) return mem.get(key);
  try {
    const raw = storage?.getItem?.(PREFIX + key);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || typeof v.at !== 'number' || !('v' in v)) return null;
    mem.set(key, v);
    return v;
  } catch { return null; }
}
function write(storage, key, value, now) {
  const rec = { at: now, v: value };
  mem.set(key, rec);
  try {
    storage?.setItem?.(PREFIX + key, JSON.stringify(rec));
    // 너무 많으면 오래된 것부터(메인 하나 + DJ 페이지 · 캐릭터 몇 개)
    const keys = [];
    for (let i = 0; i < (storage.length || 0); i++) { const k = storage.key(i); if (k && k.startsWith(PREFIX)) keys.push(k); }
    if (keys.length > MAX_KEYS) {
      const aged = keys.map((k) => { try { return [k, JSON.parse(storage.getItem(k)).at || 0]; } catch { return [k, 0]; } }).sort((a, b) => a[1] - b[1]);
      for (const [k] of aged.slice(0, keys.length - MAX_KEYS)) storage.removeItem(k);
    }
  } catch { /* 저장소가 꽉 찼거나 막힘 — 메모리만 */ }
}
// → {cached(지난 답 또는 undefined), age(ms), fresh: Promise(새 답 — 아주 최근 답이면 그것)}
export function swr(key, fetcher, { storage = local(), fresh = 15000, now = Date.now } = {}) {
  const rec = read(storage, key), t = now();
  const usable = rec && t - rec.at < MAX_AGE ? rec : null;
  let job;
  if (usable && t - usable.at < fresh) job = Promise.resolve(usable.v);
  else if (inflight.has(key)) job = inflight.get(key);
  else {
    job = Promise.resolve().then(fetcher).then((v) => { write(storage, key, v, now()); return v; });
    inflight.set(key, job);
    job.then(() => inflight.delete(key), () => inflight.delete(key));
  }
  return { cached: usable ? usable.v : undefined, age: usable ? t - usable.at : Infinity, fresh: job };
}
// 이미 받은 답만(없으면 undefined) — 화면을 먼저 그릴 때
export function peekCached(key, { storage = local(), now = Date.now } = {}) {
  const rec = read(storage, key);
  return rec && now() - rec.at < MAX_AGE ? rec.v : undefined;
}
// 같은 모양인가(새 답이 지난 답과 같으면 다시 그리지 않는다)
export const sameData = (a, b) => { try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; } };
// 미리 보기: 'slug/아이디 앞 부분' → 카드가 아는 캐릭터 정보
export const previewKey = (slug, base) => `${slug}/${String(base ?? '').normalize('NFC')}`;
export function primePreview(slug, base, data) { if (slug && base && data) previews.set(previewKey(slug, base), data); if (previews.size > 200) previews.delete(previews.keys().next().value); }
export const peekPreview = (slug, base) => previews.get(previewKey(slug, base)) || null;
// 시험용
export function _resetSwr() { mem.clear(); inflight.clear(); previews.clear(); }
