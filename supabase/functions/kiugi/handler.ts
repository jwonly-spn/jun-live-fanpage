// DJ 키우기 페이지 — 요청 처리(데이터베이스는 store 로 받는다: index.ts 가 Supabase 로, 노드 시험은 메모리로 넣는다).
// 길(모든 답에 CORS — 사이트가 부른다):
//  GET health · GET page?slug= · GET find?slug=&q= · GET person?slug=&id= · GET home · GET search?q=
//  POST heart {slug,id,token} · POST app(먼치킨이 서명해 올림, 내용 v2)
import * as v from './lib.ts';

export const SITE = 'https://xn--ok0bp87bn6g.com/';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Max-Age': '86400' };
const json = (body: unknown, status = 200, cache = 'no-store') => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' } });
// Cloudflare 가 넣는 cf-connecting-ip(사용자가 바꿀 수 없음) → 없으면 x-forwarded-for 첫 칸
const clientIp = (req: Request) => req.headers.get('cf-connecting-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
const CLOSED = 'DJ가 지금은 키우기 페이지를 닫아 두었어요.';
const NAME_TAKEN = '이 캐릭터 이름은 다른 방송이 이미 쓰고 있어요. 먼치킨에서 캐릭터 이름을 바꿔 주세요.';
const NO_PERSON = '이 아이디를 찾을 수 없어요. 이번 시즌 아이디가 맞는지 확인해 주세요.';

// store(모두 Promise):
//  ipSalt() → 주소 해시·하트 열쇠에 섞는 비밀 값 · hit(key, seconds, max) → 아직 한도 안이면 true · nonce(id, expires) → 처음 보는 요청 번호면 true
//  device(id) → {state, review} | null · devicesOf(ids) → {id: {state, review}}
//  pageByDevice(device) → {slug, updated} | null · createPage({slug, device_id, created}) → 'ok' | 'slug'(주소 겹침) | 'device'(이미 있음)
//  nameOwner(nameKey) → 그 캐릭터 이름을 가진 페이지 slug | null
//  saveSnapshot(slug, snap, now) → 'ok' | 'name'(캐릭터 이름 겹침 — 동시에 올린 경우)(updated·seen = now)
//  clearSnapshot(slug, now)(내용만 비움, 이름 열쇠·main 은 남김, seen = now)
//  publicPage(slug) → {slug, device_id, updated, name, season, character, top, count, main} | null
//  people(slug) / pageByNameKey(nameKey) → {slug, device_id, updated, name, season, character, main, people} | null
//  mainPages(withPeople) → main=true 이고 내용이 있는 페이지들 {slug, device_id, updated, name, season, character, count, summary(, people)}
//  heartRows(slugs) → [{slug, season, pid, hearts}] · topHearts(limit) → hearts>0 인 줄을 많은 순으로
//  heart(vote, expires, slug, season, pid, now) → {hearts, already} (투표 열쇠가 처음이면 +1, 한 번에 처리)
//  cleanVotes(now) · pruneHearts(slug, season, keep:Set) → 이 페이지의 지난 시즌·없어진 아이디 하트 줄 지우기
//  expire(before)(seen 이 before 보다 오래된 페이지: 내용·이름 열쇠·하트 지우기) · cleanNonces(now)
export function createHandler(store: Record<string, any>, opts: Record<string, any> = {}) {
  const now: () => number = opts.now || Date.now;
  const random: (n: number) => Uint8Array = opts.random || ((n: number) => crypto.getRandomValues(new Uint8Array(n)));
  const chance: () => number = opts.chance || Math.random;
  const later: (p: Promise<unknown>) => void = opts.later || ((p: Promise<unknown>) => { p.catch((e) => console.error(e)); });
  const site: string = opts.site || SITE;
  // 메인 페이지·전체 찾기 목록은 이 함수 안에서 잠깐(기본 30초) 기억해 둔다(보는 사람이 많아도 데이터베이스를 덜 부르게).
  const cacheMs: number = opts.cacheMs ?? 30000;
  const urlOf = (slug: string) => site + 'k/' + slug;
  const memo = new Map<string, { at: number; value: Promise<any> }>();
  function cached<T>(key: string, make: () => Promise<T>): Promise<T> {
    const t = now(), hit = memo.get(key);
    if (cacheMs > 0 && hit && t - hit.at < cacheMs) return hit.value;
    const value = make();
    if (cacheMs > 0) { memo.set(key, { at: t, value }); value.catch(() => memo.delete(key)); }
    return value;
  }

  async function ipHash(req: Request) { return (await v.sha256hex('ip:' + await store.ipSalt() + ':' + clientIp(req))).slice(0, 32); }
  async function limit(key: string, seconds: number, max: number, message = '요청이 많아요. 잠시 뒤에 다시 해 주세요.') {
    if (!await store.hit(key, seconds, max)) throw v.fail(429, message);
  }
  const approved = (dev: any) => dev?.state === 'approved' && !dev.review;
  // 승인된 기기가 올린 페이지만 보여 준다(관리 화면에서 차단하면 그 DJ 페이지도 닫힌다).
  async function shown(row: Record<string, any> | null) {
    if (!row) throw v.fail(404, '키우기 페이지를 찾을 수 없어요. 주소를 확인해 주세요.');
    if (row.updated === null || row.updated === undefined) throw v.fail(404, CLOSED, { closed: true });
    if (!approved(await store.device(row.device_id))) throw v.fail(404, CLOSED, { closed: true });
    return row;
  }
  // 메인 페이지에 보일 페이지들(main=true · 내용 있음 · 승인된 기기)
  async function mainPages(withPeople: boolean) {
    const rows: Record<string, any>[] = (await store.mainPages(withPeople)) || [];
    const devs = await store.devicesOf([...new Set(rows.map((r) => r.device_id))]);
    return rows.filter((r) => r.updated !== null && r.updated !== undefined && r.main !== false && approved(devs?.[r.device_id]));
  }
  // 여러 페이지의 하트 수: (slug → 그 페이지 시즌의 {찾기 열쇠: 하트})
  async function heartsFor(pages: { slug: string; season: any }[]) {
    const slugs = [...new Set(pages.map((p) => p.slug))];
    const rows = slugs.length ? await store.heartRows(slugs) : [];
    const out = new Map<string, Map<string, number>>();
    for (const p of pages) if (!out.has(p.slug)) out.set(p.slug, v.heartMap(rows, p.slug, p.season?.id));
    return out;
  }

  async function page(url: URL, req: Request) {
    const slug = v.slugOf(url.searchParams.get('slug'));
    await limit(`kg:p:${await ipHash(req)}`, 60, 60);
    const row = await shown(await store.publicPage(slug));
    const hearts = (await heartsFor([row as any])).get(slug);
    return json(v.pageOut(row, hearts), 200, 'public, max-age=30');
  }

  async function find(url: URL, req: Request) {
    const slug = v.slugOf(url.searchParams.get('slug'));
    const key = v.query(url.searchParams.get('q'));
    await limit(`kg:f:${await ipHash(req)}`, 60, 30, '찾기를 너무 자주 했어요. 잠시 뒤에 다시 해 주세요.');
    const row = await shown(await store.people(slug));
    const hearts = (await heartsFor([row as any])).get(slug) || new Map();
    return json(v.findPeople(row.people, key, v.FIND_LIMIT, (k) => hearts.get(k) || 0), 200, 'public, max-age=15');
  }

  // 캐릭터 한 명(캐릭터 페이지 k/<주소>/<아이디 앞 부분>). main=false 페이지도 열린다.
  async function person(url: URL, req: Request) {
    const slug = v.slugOf(url.searchParams.get('slug'));
    const key = v.query(url.searchParams.get('id'));
    await limit(`kg:c:${await ipHash(req)}`, 60, 60);
    const row = await shown(await store.people(slug));
    const hit = row.season ? v.findOne(row.people, key) : null;
    if (!hit) throw v.fail(404, NO_PERSON);
    const hearts = (await heartsFor([row as any])).get(slug)?.get(hit.p.k) || 0;
    return json({ id: hit.p.id, level: hit.p.level, worn: hit.p.worn || {}, titles: v.titles(hit.p.titles), hearts, season: row.season, dj: { slug: row.slug, name: row.name, character: row.character } }, 200, 'public, max-age=30');
  }

  // 메인 페이지: 지금 시즌 · 인기(하트) 12 · 새로 꾸민 8 · 옷마다 입은 수 · DJ 목록 · 합계
  async function buildHome() {
    const pages = await mainPages(false);
    const season = v.pickSeason(pages);
    // 인기·새로 꾸민·옷 수는 지금 시즌 페이지만(지난 시즌에 멈춘 페이지의 옷이 섞이지 않게)
    const inSeason = season ? pages.filter((p) => p.season?.id === season.id) : [];
    const bySlug = new Map(inSeason.map((p) => [p.slug, p]));
    // 인기: 하트 많은 줄부터, 지금 사람 목록에 있는 아이디만(지운 아이디의 하트는 빼고)
    const popular: Record<string, unknown>[] = [];
    const peopleOf = new Map<string, Person[] | null>();
    for (const r of (await store.topHearts(200)) || []) {
      if (popular.length >= v.HOME_POPULAR) break;
      const p = bySlug.get(r.slug);
      if (!p || r.season !== season?.id || !(r.hearts > 0)) continue;
      if (!peopleOf.has(r.slug)) peopleOf.set(r.slug, peopleOf.size < 40 ? ((await store.people(r.slug))?.people || []) : null);
      const hit = peopleOf.get(r.slug)?.find((x: any) => x && x.k === r.pid && v.FULL_ID.test(x.id));
      if (hit) popular.push(v.card(hit, r.slug, p.name, r.hearts));
    }
    // 새로 꾸민: 페이지마다 요약해 둔 8명을 모아 ch 최근 순으로 8명
    const recentRaw = inSeason.flatMap((p) => (Array.isArray(p.summary?.recent) ? p.summary.recent : []).map((x: any) => ({ ...x, slug: p.slug, djName: p.name })))
      .filter((x: any) => typeof x.id === 'string' && v.FULL_ID.test(x.id) && Number.isSafeInteger(x.ch))
      .sort((a: any, b: any) => b.ch - a.ch)
      .slice(0, v.HOME_RECENT);
    const recentHearts = await heartsFor(recentRaw.map((x: any) => bySlug.get(x.slug)!));
    const recent = recentRaw.map((x: any) => v.card(x, x.slug, x.djName, recentHearts.get(x.slug)?.get(x.k) || 0));
    // 옷마다 입은 사람 수(메인에 보이는 지금 시즌 페이지만)
    const tally: Record<string, number> = {};
    for (const p of inSeason) for (const [id, n] of Object.entries(p.summary?.items || {})) if (typeof id === 'string' && Number.isSafeInteger(n)) tally[id] = (tally[id] || 0) + (n as number);
    const items = Object.entries(tally).map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count || (a.id < b.id ? -1 : 1));
    const djs = pages.map((p) => ({ slug: p.slug, name: p.name, character: p.character, count: Number(p.count) || 0 }))
      .sort((a, b) => b.count - a.count || String(a.name).localeCompare(String(b.name)));
    return { season, popular, recent, items, djs, totals: { djs: djs.length, people: djs.reduce((s, d) => s + d.count, 0) } };
  }
  async function home(req: Request) {
    await limit(`kg:m:${await ipHash(req)}`, 60, 60);
    return json(await cached('home', buildHome), 200, 'public, max-age=60');
  }

  // 전체 찾기(메인에 보이는 페이지만): 전체 아이디는 캐릭터 이름 열쇠로 바로, 앞 부분만이면 같은 사람 먼저·들어 있는 사람 다음 10명
  async function search(url: URL, req: Request) {
    const key = v.query(url.searchParams.get('q'));
    await limit(`kg:s:${await ipHash(req)}`, 60, 30, '찾기를 너무 자주 했어요. 잠시 뒤에 다시 해 주세요.');
    let hits: { row: Record<string, any>; p: Person; exact: boolean }[] = [];
    if (key.includes('#')) {
      const row = await store.pageByNameKey(key.slice(key.indexOf('#') + 1));
      if (row && row.main !== false && row.updated !== null && row.updated !== undefined && row.season && approved(await store.device(row.device_id))) {
        const hit = v.findOne(row.people, key);
        if (hit) hits = [{ row, p: hit.p, exact: true }];
      }
    } else {
      const pages = await cached('search', () => mainPages(true));
      const exact: typeof hits = [], part: typeof hits = [];
      for (const row of pages) {
        if (!row.season) continue;
        for (const p of Array.isArray(row.people) ? row.people : []) {
          if (!p || typeof p.id !== 'string' || !v.FULL_ID.test(p.id)) continue;
          const base = String(p.k || '').split('#')[0];
          if (base === key) exact.push({ row, p, exact: true }); else if (base.includes(key)) part.push({ row, p, exact: false });
        }
      }
      const order = (a: any, b: any) => b.p.level - a.p.level || (a.p.id < b.p.id ? -1 : a.p.id > b.p.id ? 1 : 0);
      hits = [...exact.sort(order), ...part.sort(order)];
    }
    const shownHits = hits.slice(0, v.SEARCH_LIMIT);
    const hearts = await heartsFor(shownHits.map((h) => h.row as any));
    const results = shownHits.map((h) => v.card(h.p, h.row.slug, h.row.name, hearts.get(h.row.slug)?.get(h.p.k) || 0));
    return json({ results, exact: hits.filter((h) => h.exact).length, more: hits.length > v.SEARCH_LIMIT }, 200, 'public, max-age=30');
  }

  // 하트: 한 열쇠(브라우저)는 한 캐릭터에 한국 날짜 하루 한 번(시즌마다 새로). 되돌리기 없음.
  async function heart(req: Request) {
    if (!req.headers.get('content-type')?.startsWith('application/json')) throw v.fail(415, 'JSON 요청이 필요해요.');
    const text = await req.text();
    if (text.length > 2000) throw v.fail(413, '요청이 너무 커요.');
    let b: Record<string, any>;
    try { b = JSON.parse(text); } catch { throw v.fail(400, '요청을 읽지 못했어요.'); }
    const slug = v.slugOf(b?.slug);
    const key = v.query(b?.id);
    if (typeof b?.token !== 'string' || !v.HEART_TOKEN.test(b.token)) throw v.fail(400, '하트를 보낼 수 없어요. 페이지를 새로 열어 주세요.');
    const at = now();
    await limit(`kg:hi:${await ipHash(req)}`, 3600, 60, '하트를 너무 많이 보냈어요. 잠시 뒤에 다시 해 주세요.');
    await limit(`kg:ht:${(await v.sha256hex('t:' + b.token)).slice(0, 32)}`, 86400, 50, '오늘은 하트를 많이 보냈어요. 내일 다시 보내 주세요.');
    const row = await shown(await store.people(slug));
    if (!row.season) throw v.fail(409, '지금은 다음 시즌을 준비하고 있어서 하트를 보낼 수 없어요.');
    const hit = v.findOne(row.people, key);
    if (!hit) throw v.fail(404, NO_PERSON);
    const season = row.season.id, pid = hit.p.k;
    const vote = await v.sha256hex(`${await store.ipSalt()}:${b.token}:${v.kstDay(at)}:${season}:${slug}:${pid}`);
    const r = await store.heart(vote, v.nextKstMidnight(at) + 86400000, slug, season, pid, at);
    if (chance() < 0.02) later(store.cleanVotes(at));
    return json({ hearts: Number(r?.hearts) || 0, already: r?.already === true });
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
    // 끄면(또는 키우기를 끄면) 내용만 지운다. 주소·캐릭터 이름은 이 기기에 그대로 묶어 둔다(다시 켜면 같은 주소).
    // 끈 채로도 마지막으로 올린 때(seen)는 적는다 — 60일 동안 아무것도 안 올리면 캐릭터 이름을 놓아준다.
    if (!snap.enabled) {
      if (found) await store.clearSnapshot(found.slug, at);
      return json({ ok: true, enabled: false, slug: found?.slug || null, url: found ? urlOf(found.slug) : null });
    }
    // 캐릭터 이름은 사이트 전체에서 하나만(먼저 쓴 방송이 가진다)
    const owner = await store.nameOwner(snap.nameKey);
    if (owner && owner !== found?.slug) throw v.fail(409, NAME_TAKEN);
    for (let i = 0; !found && i < 6; i++) {
      const slug = v.makeSlug(random);
      const r = await store.createPage({ slug, device_id: device, created: at });
      if (r === 'ok') found = { slug, updated: null };
      else if (r === 'device') found = await store.pageByDevice(device);
    }
    if (!found) throw v.fail(503, '잠시 문제가 생겼어요. 조금 뒤에 다시 올려요.');
    // 지난번 사람 목록과 비교해 "새로 꾸민 때"를 붙이고, 메인 페이지 요약을 만든다
    const before = found.updated !== null && found.updated !== undefined ? await store.people(found.slug) : null;
    const people = v.withChanges(snap.people, before?.people, at);
    const saved = await store.saveSnapshot(found.slug, { ...snap, people, summary: v.summarize(people) }, at);
    if (saved === 'name') throw v.fail(409, NAME_TAKEN);
    // 지난 시즌·없어진 아이디의 하트 줄 정리(시즌이 바뀌었거나 가끔)
    if (snap.season && (before?.season?.id !== snap.season.id || chance() < 0.1)) later(store.pruneHearts(found.slug, snap.season.id, new Set(people.map((p) => p.k))));
    return json({ ok: true, enabled: true, slug: found.slug, url: urlOf(found.slug), count: snap.count });
  }

  return async function handle(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      const url = new URL(req.url);
      const route = url.pathname.replace(/^\/(functions\/v1\/)?kiugi\/?/, '').replace(/\/$/, '');
      if (req.method === 'GET') {
        if (route === 'health') return json({ service: 'jun-live-kiugi', v: v.PAYLOAD_VERSION, hearts: true });
        if (route === 'page') return await page(url, req);
        if (route === 'find') return await find(url, req);
        if (route === 'person') return await person(url, req);
        if (route === 'home') return await home(req);
        if (route === 'search') return await search(url, req);
      }
      if (req.method === 'POST' && route === 'heart') return await heart(req);
      if (req.method === 'POST' && route === 'app') return await upload(req);
      return json({ error: '찾을 수 없어요.' }, 404);
    } catch (error) {
      const e = error as v.Fail;
      if (!e?.status) console.error(error);
      return json({ error: e?.status ? e.message : '잠시 문제가 생겼어요. 조금 뒤에 다시 해 주세요.', ...(e?.extra || {}) }, e?.status || 503);
    }
  };
}

type Person = v.Person;
