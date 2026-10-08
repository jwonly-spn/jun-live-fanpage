// 하트 — 이 브라우저의 무작위 열쇠(32자)와 "오늘 하트를 보낸 캐릭터" 기억. DOM 없이 동작(저장소를 넘겨받는다).
// 저장소(localStorage)가 막혀 있으면(사생활 모드 등) 이번 창에서만 기억한다. 하루 한 번은 서버가 정하고, 여기 기억은 단추 모양용.
const TOKEN_KEY = 'kg_heart_token', SENT_KEY = 'kg_hearted';
const TOKEN = /^[A-Za-z0-9_-]{32}$/;
const memory = new Map();

// 한국 날짜(서버와 같은 셈)
export const kstDay = (t = Date.now()) => new Date(t + 9 * 3600000).toISOString().slice(0, 10);

function safe(storage) {
  return {
    get(k) { try { const v = storage?.getItem?.(k); if (v !== null && v !== undefined) return v; } catch { /* 막힌 저장소 */ } return memory.has(k) ? memory.get(k) : null; },
    set(k, v) { memory.set(k, v); try { storage?.setItem?.(k, v); } catch { /* 막힌 저장소 — 이번 창에서만 */ } },
  };
}

// 24바이트 → base64url 32자
export function makeToken(random = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  const b = random(24);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function heartToken(storage, random) {
  const s = safe(storage);
  let t = s.get(TOKEN_KEY);
  if (!TOKEN.test(t || '')) { t = makeToken(random); s.set(TOKEN_KEY, t); }
  return t;
}

// 캐릭터마다 기억 열쇠(시즌이 바뀌면 다시 보낼 수 있게 시즌도 넣는다)
export const heartKey = (slug, id, seasonId = '') => `${slug}/${String(id ?? '').normalize('NFC').toLowerCase()}/${seasonId || ''}`;
function readSent(s) { try { const v = JSON.parse(s.get(SENT_KEY) || 'null'); return v && typeof v === 'object' && Array.isArray(v.keys) ? v : null; } catch { return null; } }
export function sentToday(storage, key, now = Date.now()) {
  const v = readSent(safe(storage));
  return Boolean(v) && v.day === kstDay(now) && v.keys.includes(key);
}
export function markSent(storage, key, now = Date.now()) {
  const s = safe(storage), day = kstDay(now);
  const v = readSent(s);
  const keys = v && v.day === day ? v.keys.filter((k) => k !== key) : [];
  keys.push(key);
  s.set(SENT_KEY, JSON.stringify({ day, keys: keys.slice(-500) }));
}
