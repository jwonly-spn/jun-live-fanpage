// DJ 키우기 서버 시험 도우미(시험 파일이 아님): 먼치킨과 같은 서명, 메모리 store(index.ts 의 Supabase store 와 같은 약속), 요청 보내기.
// 실제 서버·스푼에 닿지 않는다. 이름은 모두 지어낸 것.
import crypto from 'node:crypto';
import { createHandler } from '../supabase/functions/kiugi/handler.ts';

export const SITE = 'https://xn--ok0bp87bn6g.com/';
export const BASE = 'https://x.supabase.co/functions/v1/kiugi/';
export const T0 = Date.parse('2026-10-20T12:00:00Z');

export function deviceKey() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const spki = publicKey.export({ type: 'spki', format: 'der' });
  return { privateKey, publicKey: spki.toString('base64url'), id: crypto.createHash('sha256').update(spki).digest('hex') };
}
// 먼치킨(app/desktop/kiugi-fanpage.cjs)과 같은 서명
export function signed(key, payload, { at = T0, nonce = crypto.randomBytes(24).toString('base64url'), action = 'upload' } = {}) {
  const body = { action, payload, publicKey: key.publicKey, timestamp: at, nonce };
  const digest = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  body.signature = crypto.sign('sha256', Buffer.from(`JUN-LIVE-KIUGI/1\n${action}\n${at}\n${nonce}\n${key.publicKey}\n${digest}`), { key: key.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return body;
}
export const syl = (i) => String.fromCharCode(0xac00 + i); // 한글 완성 글자 하나(가, 각, 갂 …)
export const SEASON = { id: 's1', name: '할로윈', endsAt: '2026-11-30T14:59:59.000Z' };
export const LOOK = { gender: 'f', hair: 'bob', hairColor: 'brown', skin: 's2', eyes: 'round', nose: 'dot', mouth: 'smile' };
// 사람 한 줄(아이디 = 앞 부분 + "#" + 캐릭터 이름)
export const PERSON = (base, love, extra = {}, name = '먼치') => ({ id: base + '#' + name, level: 1 + Math.min(9, Math.floor(love / 100)), love, worn: { head: 'cat-ears' }, ...extra });
export const PAYLOAD = (people = [PERSON('밤톨', 50), PERSON('사탕요정', 300), PERSON('달무리', 120)], { name = '먼치', season = SEASON, ...rest } = {}) =>
  ({ enabled: true, v: 2, at: T0, paused: false, season, character: { name, ...LOOK }, people, ...rest });

const PAGE_COLUMNS = ['slug', 'device_id', 'updated', 'name', 'season', 'character', 'main', 'people'];
const MAIN_COLUMNS = ['slug', 'device_id', 'updated', 'name', 'season', 'character', 'count', 'main', 'summary'];
const EMPTY = () => ({ updated: null, name: '', season: null, character: null, top: [], people: [], count: 0, summary: {} });
const pick = (p, cols) => (p ? structuredClone(Object.fromEntries(cols.map((c) => [c, p[c]]))) : null);

export function memoryStore(clock) {
  const s = { pages: new Map(), devices: new Map(), nonces: new Set(), hits: new Map(), hearts: new Map(), votes: new Map(), calls: [], nextSave: null };
  const byNameKey = (key) => [...s.pages.values()].find((p) => p.name_key === key) || null;
  return Object.assign(s, {
    ipSalt: async () => 'salt',
    hit: async (key, seconds, max) => { const k = key + ':' + Math.floor(clock.now / 1000 / seconds); const n = (s.hits.get(k) || 0) + 1; s.hits.set(k, n); return n <= max; },
    nonce: async (id) => { if (s.nonces.has(id)) return false; s.nonces.add(id); return true; },
    device: async (id) => s.devices.get(id) || null,
    devicesOf: async (ids) => Object.fromEntries(ids.filter((id) => s.devices.has(id)).map((id) => [id, s.devices.get(id)])),
    pageByDevice: async (device) => { for (const p of s.pages.values()) if (p.device_id === device) return { slug: p.slug, updated: p.updated }; return null; },
    nameOwner: async (key) => byNameKey(key)?.slug || null,
    createPage: async (row) => {
      if ([...s.pages.values()].some((p) => p.device_id === row.device_id)) return 'device';
      if (s.pages.has(row.slug)) return 'slug';
      s.pages.set(row.slug, { ...row, ...EMPTY(), name_key: null, main: true, seen: row.created }); return 'ok';
    },
    saveSnapshot: async (slug, snap, now) => {
      // 시험에서 "동시에 같은 이름" 을 흉내 낼 때: nextSave 에 'name' 을 넣어 둔다
      if (s.nextSave) { const r = s.nextSave; s.nextSave = null; return r; }
      const other = byNameKey(snap.nameKey);
      if (other && other.slug !== slug) return 'name';
      Object.assign(s.pages.get(slug), structuredClone({ updated: now, seen: now, name: snap.name, name_key: snap.nameKey, main: snap.main, season: snap.season, character: snap.character, top: snap.top, people: snap.people, count: snap.count, summary: snap.summary }));
      s.calls.push('save'); return 'ok';
    },
    clearSnapshot: async (slug, now) => { Object.assign(s.pages.get(slug), EMPTY(), { seen: now }); s.calls.push('clear'); },
    publicPage: async (slug) => pick(s.pages.get(slug), ['slug', 'device_id', 'updated', 'name', 'season', 'character', 'top', 'count', 'main']),
    people: async (slug) => pick(s.pages.get(slug), PAGE_COLUMNS),
    pageByNameKey: async (key) => pick(byNameKey(key), PAGE_COLUMNS),
    mainPages: async (withPeople) => [...s.pages.values()].filter((p) => p.main && p.updated !== null).map((p) => pick(p, withPeople ? [...MAIN_COLUMNS, 'people'] : MAIN_COLUMNS)),
    heartRows: async (slugs) => [...s.hearts.values()].filter((h) => slugs.includes(h.slug) && h.hearts > 0).map((h) => ({ ...h })),
    topHearts: async (limit) => [...s.hearts.values()].filter((h) => h.hearts > 0).sort((a, b) => b.hearts - a.hearts || b.updated - a.updated).slice(0, limit).map((h) => ({ ...h })),
    heart: async (vote, expires, slug, season, pid, now) => {
      const key = `${slug}|${season}|${pid}`;
      if (s.votes.has(vote)) return { hearts: s.hearts.get(key)?.hearts || 0, already: true };
      s.votes.set(vote, expires);
      const h = s.hearts.get(key) || { slug, season, pid, hearts: 0, updated: 0 };
      h.hearts++; h.updated = now; s.hearts.set(key, h);
      return { hearts: h.hearts, already: false };
    },
    cleanVotes: async (now) => { for (const [k, e] of s.votes) if (e < now) s.votes.delete(k); },
    pruneHearts: async (slug, season, keep) => { for (const [k, h] of s.hearts) if (h.slug === slug && (h.season !== season || !keep.has(h.pid))) s.hearts.delete(k); },
    expire: async (before) => {
      for (const p of s.pages.values()) {
        if (!(p.seen < before) || (p.updated === null && p.name_key === null)) continue;
        Object.assign(p, EMPTY(), { name_key: null });
        for (const [k, h] of s.hearts) if (h.slug === p.slug) s.hearts.delete(k);
      }
    },
    cleanNonces: async () => {}
  });
}

// 시험 세계: 시계·store·handler. cacheMs 0(메인·전체 찾기 목록을 기억하지 않음), chance 0.5(가끔 하는 정리는 안 함)
export function world({ chance = () => 0.5, cacheMs = 0 } = {}) {
  const clock = { now: T0 }, store = memoryStore(clock);
  let seed = 1;
  const handle = createHandler(store, { now: () => clock.now, chance, site: SITE, cacheMs, random: (n) => Uint8Array.from({ length: n }, () => (seed = (seed * 1103515245 + 12345) % 2147483648) % 256) });
  const post = (body, headers = {}, path = 'app') => handle(new Request(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
  const get = (path, ip = '1.1.1.1') => handle(new Request(BASE + path, { headers: { 'cf-connecting-ip': ip } }));
  // 승인된 기기 하나 만들고 올리기(1분에 2번 한도를 피하려고 시계를 61초 넘긴다)
  const approve = (key = deviceKey()) => { store.devices.set(key.id, { state: 'approved', review: false }); return key; };
  const upload = async (key, payload) => { clock.now += 61000; return body(await post(signed(key, payload, { at: clock.now }))); };
  const heart = (slug, id, token, ip = '1.1.1.1') => handle(new Request(BASE + 'heart', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip }, body: JSON.stringify({ slug, id, token }) }));
  return { store, clock, handle, post, get, approve, upload, heart };
}
export const body = async (r) => ({ status: r.status, json: await r.json(), headers: r.headers });
export const TOKEN = (n = 0) => ('t' + String(n)).padEnd(32, 'A');
