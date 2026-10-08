// DJ 키우기 페이지 — 요청 처리(데이터베이스는 store 로 받는다: index.ts 가 Supabase 로, 노드 시험은 메모리로 넣는다).
// 길: GET health · GET page?slug= · GET find?slug=&q=(청취자가 만든 시즌 아이디로 찾기) · POST app(먼치킨이 서명해 올림, 내용 v2).
// 모든 답에 CORS(사이트가 부른다).
import * as v from './lib.ts';

export const SITE = 'https://jwonly-spn.github.io/jun-live-fanpage/';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Max-Age': '86400' };
const json = (body: unknown, status = 200, cache = 'no-store') => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' } });
// Cloudflare 가 넣는 cf-connecting-ip(사용자가 바꿀 수 없음) → 없으면 x-forwarded-for 첫 칸
const clientIp = (req: Request) => req.headers.get('cf-connecting-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
const CLOSED = 'DJ가 지금은 키우기 페이지를 닫아 두었어요.';

// store(모두 Promise):
//  ipSalt() → 주소 해시에 섞는 비밀 값 · hit(key, seconds, max) → 아직 한도 안이면 true · nonce(id, expires) → 처음 보는 요청 번호면 true
//  device(id) → {state, review} | null · pageByDevice(device) → {slug, updated} | null · createPage({slug, device_id, created}) → 'ok' | 'slug'(주소 겹침) | 'device'(이미 있음)
//  saveSnapshot(slug, snap, now) · clearSnapshot(slug) · publicPage(slug) → {slug, device_id, updated, name, season, character, top, count} | null
//  people(slug) → {device_id, updated, people} | null · expire(before) · cleanNonces(now)
export function createHandler(store: Record<string, any>, opts: Record<string, any> = {}) {
  const now: () => number = opts.now || Date.now;
  const random: (n: number) => Uint8Array = opts.random || ((n: number) => crypto.getRandomValues(new Uint8Array(n)));
  const chance: () => number = opts.chance || Math.random;
  const later: (p: Promise<unknown>) => void = opts.later || ((p: Promise<unknown>) => { p.catch((e) => console.error(e)); });
  const site: string = opts.site || SITE;
  const urlOf = (slug: string) => site + 'k/' + slug;

  async function ipHash(req: Request) { return (await v.sha256hex('ip:' + await store.ipSalt() + ':' + clientIp(req))).slice(0, 32); }
  async function limit(key: string, seconds: number, max: number, message = '요청이 많아요. 잠시 뒤에 다시 해 주세요.') {
    if (!await store.hit(key, seconds, max)) throw v.fail(429, message);
  }
  // 승인된 기기가 올린 페이지만 보여 준다(관리 화면에서 차단하면 그 DJ 페이지도 닫힌다).
  async function shown(row: Record<string, any> | null) {
    if (!row) throw v.fail(404, '키우기 페이지를 찾을 수 없어요. 주소를 확인해 주세요.');
    if (row.updated === null || row.updated === undefined) throw v.fail(404, CLOSED, { closed: true });
    const dev = await store.device(row.device_id);
    if (dev?.state !== 'approved' || dev.review) throw v.fail(404, CLOSED, { closed: true });
    return row;
  }

  async function page(url: URL, req: Request) {
    const slug = v.slugOf(url.searchParams.get('slug'));
    await limit(`kg:p:${await ipHash(req)}`, 60, 60);
    const row = await shown(await store.publicPage(slug));
    return json(v.pageOut(row), 200, 'public, max-age=30');
  }

  async function find(url: URL, req: Request) {
    const slug = v.slugOf(url.searchParams.get('slug'));
    const key = v.query(url.searchParams.get('q'));
    await limit(`kg:f:${await ipHash(req)}`, 60, 30, '찾기를 너무 자주 했어요. 잠시 뒤에 다시 해 주세요.');
    const row = await shown(await store.people(slug));
    return json(v.findPeople(row.people, key), 200, 'public, max-age=15');
  }

  async function upload(req: Request) {
    if (!req.headers.get('content-type')?.startsWith('application/json')) throw v.fail(415, 'JSON 요청이 필요해요.');
    const text = await req.text();
    if (text.length > v.MAX_BODY_CHARS) throw v.fail(413, '올릴 내용이 너무 커요.');
    let b: Record<string, any>;
    try { b = JSON.parse(text); } catch { throw v.fail(400, '요청을 읽지 못했어요.'); }
    const at = now();
    const device = await v.verify(b, at);
    // 승인 확인(읽기만)을 먼저: 아무 키나 새로 만들어 보내는 요청은 횟수·요청 번호 표에 아무것도 쓰지 못한다.
    const dev = await store.device(device);
    if (dev?.review) throw v.fail(403, '심사용 먼치킨은 키우기 페이지를 올리지 않아요.');
    if (dev?.state !== 'approved') throw v.fail(403, '먼치킨 사용 승인을 먼저 받아 주세요.');
    await limit(`kg:u:${device}`, 60, 2, '조금 전에 올렸어요. 1분 뒤에 다시 올려요.');
    if (!await store.nonce('kg:' + device + ':' + b.nonce, at + v.NONCE_MS)) throw v.fail(409, '이미 처리한 요청이에요.');
    if (chance() < 0.05) later(store.cleanNonces(at));
    if (v.bytes(JSON.stringify(b.payload ?? null)) > v.MAX_PAYLOAD_BYTES) throw v.fail(413, '올릴 내용이 너무 커요.');
    const snap = v.snapshot(b.payload);
    if (chance() < 0.02) later(store.expire(at - v.KEEP_MS));
    let found = await store.pageByDevice(device);
    // 끄면(또는 키우기를 끄면) 내용만 지운다. 주소는 이 기기에 그대로 묶어 둔다(다시 켜면 같은 주소).
    if (!snap.enabled) {
      if (found && found.updated !== null && found.updated !== undefined) await store.clearSnapshot(found.slug);
      return json({ ok: true, enabled: false, slug: found?.slug || null, url: found ? urlOf(found.slug) : null });
    }
    for (let i = 0; !found && i < 6; i++) {
      const slug = v.makeSlug(random);
      const r = await store.createPage({ slug, device_id: device, created: at });
      if (r === 'ok') found = { slug, updated: null };
      else if (r === 'device') found = await store.pageByDevice(device);
    }
    if (!found) throw v.fail(503, '잠시 문제가 생겼어요. 조금 뒤에 다시 올려요.');
    await store.saveSnapshot(found.slug, snap, at);
    return json({ ok: true, enabled: true, slug: found.slug, url: urlOf(found.slug), count: snap.count });
  }

  return async function handle(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      const url = new URL(req.url);
      const route = url.pathname.replace(/^\/(functions\/v1\/)?kiugi\/?/, '').replace(/\/$/, '');
      if (req.method === 'GET' && route === 'health') return json({ service: 'jun-live-kiugi', v: v.PAYLOAD_VERSION });
      if (req.method === 'GET' && route === 'page') return await page(url, req);
      if (req.method === 'GET' && route === 'find') return await find(url, req);
      if (req.method === 'POST' && route === 'app') return await upload(req);
      return json({ error: '찾을 수 없어요.' }, 404);
    } catch (error) {
      const e = error as v.Fail;
      if (!e?.status) console.error(error);
      return json({ error: e?.status ? e.message : '잠시 문제가 생겼어요. 조금 뒤에 다시 해 주세요.', ...(e?.extra || {}) }, e?.status || 503);
    }
  };
}
