// DJ 키우기 페이지 — 요청 처리(데이터베이스는 store 로 받는다: index.ts 가 Supabase 로, 노드 시험은 메모리로 넣는다).
// 길(모든 답에 CORS — 사이트가 부른다):
//  GET health · GET page?slug= · GET find?slug=&q= · GET person?slug=&id= · GET home · GET search?q=
//  POST heart {slug,id,token} · POST app(먼치킨이 서명해 올림, 내용 v3 시즌 2 몬스터 — v2 시즌 1 옷은 2026-12-01 0시(한국)까지만)
//  시즌 2 사이트(키우기.com — 지도 첫 화면·아이디 찾기·도감)가 부르는 것은 search(카드에 lead·monsters) 하나뿐이다. person 도 몬스터를 준다.
//  page·find·home·heart 는 시즌 1 사이트가 쓰던 길 — 그대로 두지만 시즌 2 사이트는 부르지 않는다(API.md "시즌 2").
//  함수 v4(2026-11-18 보스전 보기): POST app 의 action fight-appear·fight-join·fight·fight-land·fight-drop(먼치킨이 서명) · GET fights · GET fights/<id>(API.md "보스전 보기")
import * as v from './lib.ts';

// 사이트 주소(올리기 답의 url). 2026-10-20 ~ 11-08 은 임시로 http 였다(GitHub Pages 인증서가 "new" 에서 멈춤).
//  2026-11-08 키우기.com 을 Cloudflare 로 옮겨 https 가 열렸고(항상 HTTPS — http 는 https 로, 키우기.com 은 www 로 넘어간다) 2026-11-09 https 로 되돌림.
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
//  nameOwner(nameKey) → 그 캐릭터 이름을 가진 페이지 {slug, device_id, updated, seen} | null
//  releaseName(slug, nameKey, updated) → 그 페이지의 이름 열쇠가 아직 nameKey 이고 updated 가 그대로일 때만 내용·이름 열쇠를 비우고 하트 줄을 지운다 → true | false(그사이 바뀜)
//  saveSnapshot(slug, snap, now) → 'ok' | 'name'(캐릭터 이름 겹침 — 동시에 올린 경우)(updated·seen = now)
//  clearSnapshot(slug, now)(내용만 비움, 이름 열쇠·main 은 남김, seen = now)
//  publicPage(slug) → {slug, device_id, updated, name, season, character, top, count, main} | null
//  people(slug) / pageByNameKey(nameKey) → {slug, device_id, updated, name, season, character, main, people} | null
//  mainPages(withPeople) → main=true 이고 내용이 있는 페이지들 {slug, device_id, updated, name, season, character, count, summary(, people)}
//  heartRows(slugs) → [{slug, season, pid, hearts}] · topHearts(limit) → hearts>0 인 줄을 많은 순으로
//  heart(vote, expires, slug, season, pid, now, slots) → {hearts, already} (투표 열쇠가 처음이고 주소 칸 열쇠(slots) 중 빈 것을 하나 차지하면 +1, 한 번에 처리)
//  cleanVotes(now) · pruneHearts(slug, season, keep:Set) → 이 페이지의 지난 시즌·없어진 아이디 하트 줄 지우기
//  expire(before)(seen 이 before 보다 오래된 페이지: 내용·이름 열쇠·하트 지우기) · cleanNonces(now)
//  putSnap(path, text)(있으면) — 공개 저장소 kg-snap 에 미리 만든 답(home.json · page/<slug>.json)을 덮어쓴다
//  보스전 보기(kg_fights): fight(device, liveKey, k) / fightById(id) → 줄 | null · insertFight(row) → 'ok' | 'exists'(같은 판·같은 id 가 이미 있음)
//   updateFight(id, {phase, updated}, patch) → 줄이 본 그대로일 때만 바꾸고 true | false · liveFights(now) → 모집 중·싸우는 중인 줄(목록 칸, expires 전, 끝 전)
//   cleanFights(now)(expires 지난 줄 지우기) · pagesOf(slugs) → [{slug, device_id, updated, name}]
export function createHandler(store: Record<string, any>, opts: Record<string, any> = {}) {
  const now: () => number = opts.now || Date.now;
  const random: (n: number) => Uint8Array = opts.random || ((n: number) => crypto.getRandomValues(new Uint8Array(n)));
  const chance: () => number = opts.chance || Math.random;
  const later: (p: Promise<unknown>) => void = opts.later || ((p: Promise<unknown>) => { p.catch((e) => console.error(e)); });
  const site: string = opts.site || SITE;
  // 시즌 1 올리기(v2)를 받는 마지막 때 — 실제 서버는 2026-12-01 0시(한국). 시험은 바꿔 넣을 수 있다(예전 시험은 시계를 몇 달 넘겨도 v2 로 올린다).
  const v2Until: number = opts.v2Until ?? v.S2_START;
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
  // 보는 사람 한도(주소 해시 → 횟수)를 데이터 읽기와 함께 묻는다(2026-10-18 "사이트 반응 빠르게": 예전에는 한도 → 페이지 → 하트를 차례로 물어 데이터베이스를 4~5번 오갔다)
  const limitBy = (req: Request, tag: string, max: number, message?: string) => (async () => limit(`kg:${tag}:${await ipHash(req)}`, 60, max, message))();

  // 미리 만든 답(같은 날): 메인·DJ 페이지 답을 공개 저장소(kg-snap)에도 올려 둔다 — 사이트가 이 파일을 먼저 읽어 서버가 깨어나는 1~2초를 건너뛴다.
  //  store.putSnap(path, text) 이 있을 때만. 같은 파일은 이 함수 안에서 snapGapMs(기본 15초)에 한 번(force 면 바로 — 먼치킨이 새 옷을 올렸을 때).
  //  파일에는 답 그대로 + snapAt(만든 때). 닫힌 페이지는 {closed:true} 로 덮는다(사이트는 그 파일을 쓰지 않고 서버에 묻는다).
  const snapGapMs: number = opts.snapGapMs ?? 15000;
  const snapAt = new Map<string, number>();
  function putSnap(path: string, body: Record<string, unknown>, force = false) {
    if (typeof store.putSnap !== 'function') return;
    const t = now();
    if (!force && t - (snapAt.get(path) || 0) < snapGapMs) return;
    snapAt.set(path, t);
    later(Promise.resolve().then(() => store.putSnap(path, JSON.stringify({ ...body, snapAt: t }))));
  }
  const snapPath = (slug: string) => `page/${slug}.json`;
  // 이 DJ 페이지의 미리 만든 답을 새로(올리기·하트 뒤) — 실패해도 조용히
  function refreshPageSnap(slug: string, force = false) {
    if (typeof store.putSnap !== 'function') return;
    if (!force && now() - (snapAt.get(snapPath(slug)) || 0) < snapGapMs) return;
    later((async () => {
      const [row, rows] = await Promise.all([store.publicPage(slug), store.heartRows([slug])]);
      if (!row || row.updated === null || row.updated === undefined || !approved(await store.device(row.device_id))) { putSnap(snapPath(slug), { closed: true }, true); return; }
      putSnap(snapPath(slug), v.pageOut(row, v.heartMap(rows || [], slug, row.season?.id)), force);
    })());
  }
  // 메인 미리 만든 답을 새로(올리기 뒤 — 이 함수의 30초 기억은 건드리지 않고 새로 만든다)
  function refreshHomeSnap() {
    if (typeof store.putSnap !== 'function' || now() - (snapAt.get('home.json') || 0) < snapGapMs) return;
    later((async () => putSnap('home.json', await buildHome()))());
  }
  const approved = (dev: any) => dev?.state === 'approved' && !dev.review;
  // 캐릭터 이름을 가진 페이지를 다른 기기가 넘겨받아도 되는지(2026-10-20 — PC 를 바꾼 DJ 가 60일 동안 409 만 받던 것). 둘 중 하나면 넘겨받는다:
  //  · 이름 주인 기기가 승인 상태가 아님(관리 화면에서 차단·대기, 심사용, 기록 없음) — PC 를 바꾼 DJ 는 운영자가 옛 PC 를 차단하면 바로 이어 간다
  //  · 60일 동안 아무것도 올리지 않음(가끔 도는 정리를 기다리지 않는다)
  //  끄기(내용 없음)·시즌 준비 중만으로는 넘겨주지 않는다 — "끄기는 이름을 지킨다"(잠깐 꺼 둔 DJ 가 이름을 뺏기지 않게).
  //  "같은 DJ 면 바로"는 넣지 않았다: 자기 신고 값(junlive_devices.tag)은 남이 적어 낼 수 있고, 스푼이 확인한 DJ 계정 값은 지금 어디에도 저장되지 않는다
  //  (스푼 연결 표 sp_links 는 기기 번호·잠긴 토큰·권한·때만 — 스푼 토큰 답에도 DJ 식별값이 없다). 넣으려면 spoon-link 가 그런 값을 남겨야 한다.
  async function releasable(owner: Record<string, any>, at: number) {
    if (Number.isSafeInteger(owner.seen) && owner.seen < at - v.KEEP_MS) return true;
    return !approved(await store.device(owner.device_id));
  }
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

  // 한도 확인 · 페이지 줄 · 하트 줄을 한꺼번에 묻고(데이터베이스 왕복 한 번), 기기 승인만 그 뒤에
  async function pageAndHearts(req: Request, tag: string, max: number, slug: string, read: (slug: string) => Promise<any>, message?: string) {
    const [, row, rows] = await Promise.all([limitBy(req, tag, max, message), read(slug), store.heartRows([slug])]);
    const shownRow = await shown(row);
    return { row: shownRow, hearts: v.heartMap(rows || [], slug, shownRow.season?.id) as Map<string, number> };
  }

  async function page(url: URL, req: Request) {
    const slug = v.slugOf(url.searchParams.get('slug'));
    const { row, hearts } = await pageAndHearts(req, 'p', 60, slug, store.publicPage);
    const out = v.pageOut(row, hearts);
    putSnap(snapPath(slug), out);
    return json(out, 200, 'public, max-age=10'); // 옷 입힌 것이 빨리 보이게(2026-10-16, 예전 30초)
  }

  async function find(url: URL, req: Request) {
    const slug = v.slugOf(url.searchParams.get('slug'));
    const key = v.query(url.searchParams.get('q'));
    const { row, hearts } = await pageAndHearts(req, 'f', 30, slug, store.people, '찾기를 너무 자주 했어요. 잠시 뒤에 다시 해 주세요.');
    return json(v.findPeople(row.people, key, v.FIND_LIMIT, (k) => hearts.get(k) || 0), 200, 'public, max-age=15');
  }

  // 캐릭터 한 명(캐릭터 페이지 k/<주소>/<아이디 앞 부분>). main=false 페이지도 열린다.
  async function person(url: URL, req: Request) {
    const slug = v.slugOf(url.searchParams.get('slug'));
    const key = v.query(url.searchParams.get('id'));
    const { row, hearts: heartsOf } = await pageAndHearts(req, 'c', 60, slug, store.people);
    const hit = row.season ? v.findOne(row.people, key) : null;
    if (!hit) throw v.fail(404, NO_PERSON);
    const hearts = heartsOf.get(hit.p.k) || 0;
    return json({ id: hit.p.id, level: hit.p.level, worn: hit.p.worn || {}, titles: v.titles(hit.p.titles), ...v.petsField(hit.p), ...v.motionField(hit.p), ...v.expField(hit.p), ...v.monsterField(hit.p), hearts, season: row.season, dj: { slug: row.slug, name: row.name, character: row.character } }, 200, 'public, max-age=10');
  }

  // 메인 페이지: 지금 시즌 · 인기(하트) 12 · 새로 꾸민 8 · 옷마다 입은 수 · DJ 목록 · 합계
  async function buildHome() {
    // 페이지 목록과 하트 많은 줄을 함께 묻는다(2026-10-18 — 예전에는 차례로)
    const [pages, topRows] = await Promise.all([mainPages(false), store.topHearts(200)]);
    const season = v.pickSeason(pages);
    // 인기·새로 꾸민·옷 수는 지금 시즌 페이지만(지난 시즌에 멈춘 페이지의 옷이 섞이지 않게)
    const inSeason = season ? pages.filter((p) => p.season?.id === season.id) : [];
    const bySlug = new Map(inSeason.map((p) => [p.slug, p]));
    // 인기: 하트 많은 줄부터, 지금 사람 목록에 있는 아이디만(지운 아이디의 하트는 빼고)
    const candidates = ((topRows || []) as any[]).filter((r) => bySlug.has(r.slug) && r.season === season?.id && r.hearts > 0);
    // 새로 꾸민: 페이지마다 요약해 둔 8명을 모아 ch 최근 순으로 8명
    const recentRaw = inSeason.flatMap((p) => (Array.isArray(p.summary?.recent) ? p.summary.recent : []).map((x: any) => ({ ...x, slug: p.slug, djName: p.name })))
      .filter((x: any) => typeof x.id === 'string' && v.FULL_ID.test(x.id) && Number.isSafeInteger(x.ch))
      .sort((a: any, b: any) => b.ch - a.ch)
      .slice(0, v.HOME_RECENT);
    // 인기 카드는 먼저 페이지 요약의 hot(올릴 때 만든 하트 받은 사람 카드)에서 찾는다(2026-10-20 — 예전에는 후보 페이지 40곳의 사람 목록 전체를 매번 받았다).
    //  hot 에 없는 후보(올린 뒤에 처음 하트를 받은 사람)나 hot 이 없는 예전 요약은 그 페이지만 사람 목록을 받아 찾는다(하트 많은 순으로 처음 나온 40곳까지).
    const hotOf = (slug: string, pid: string) => {
      const hot = bySlug.get(slug)?.summary?.hot;
      return Array.isArray(hot) ? hot.find((x: any) => x && x.k === pid && typeof x.id === 'string' && v.FULL_ID.test(x.id)) : undefined;
    };
    const needSlugs = [...new Set(candidates.filter((r) => !hotOf(r.slug, r.pid)).map((r) => r.slug as string))].slice(0, 40);
    const [peopleLists, recentHearts] = await Promise.all([
      Promise.all(needSlugs.map(async (slug) => [slug, ((await store.people(slug))?.people || []) as Person[]] as const)),
      heartsFor(recentRaw.map((x: any) => bySlug.get(x.slug)!))
    ]);
    const peopleOf = new Map<string, Person[]>(peopleLists);
    const popular: Record<string, unknown>[] = [];
    for (const r of candidates) {
      if (popular.length >= v.HOME_POPULAR) break;
      const hit = hotOf(r.slug, r.pid) || peopleOf.get(r.slug)?.find((x: any) => x && x.k === r.pid && v.FULL_ID.test(x.id));
      if (hit) popular.push(v.card(hit, r.slug, bySlug.get(r.slug)!.name, r.hearts));
    }
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
    const [, out] = await Promise.all([limitBy(req, 'm', 60), cached('home', buildHome)]);
    putSnap('home.json', out);
    return json(out, 200, 'public, max-age=60');
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
  //  같은 접속 주소(IP)는 한 캐릭터에 하루 HEART_IP_DAY 번까지만 새 열쇠를 센다(2026-10-20): 주소 칸 열쇠 n개(sha256(ip:소금:주소 해시:날짜:시즌:주소:캐릭터:칸 번호))를
  //  함께 보내 비어 있는 칸 하나를 차지해야 +1 — 칸이 모두 차 있으면 수는 그대로 already:true(조용히). 막힌 열쇠는 쓰지 않은 것으로 둔다(다른 주소에서는 센다).
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
    const ip = await ipHash(req);
    await limit(`kg:hi:${ip}`, 3600, 60, '하트를 너무 많이 보냈어요. 잠시 뒤에 다시 해 주세요.');
    await limit(`kg:ht:${(await v.sha256hex('t:' + b.token)).slice(0, 32)}`, 86400, 50, '오늘은 하트를 많이 보냈어요. 내일 다시 보내 주세요.');
    const row = await shown(await store.people(slug));
    if (!row.season) throw v.fail(409, '지금은 다음 시즌을 준비하고 있어서 하트를 보낼 수 없어요.');
    const hit = v.findOne(row.people, key);
    if (!hit) throw v.fail(404, NO_PERSON);
    const season = row.season.id, pid = hit.p.k, day = v.kstDay(at), salt = await store.ipSalt();
    const vote = await v.sha256hex(`${salt}:${b.token}:${day}:${season}:${slug}:${pid}`);
    const slots = await Promise.all(Array.from({ length: v.HEART_IP_DAY }, (_, i) => v.sha256hex(`ip:${salt}:${ip}:${day}:${season}:${slug}:${pid}:${i + 1}`)));
    const r = await store.heart(vote, v.nextKstMidnight(at) + 86400000, slug, season, pid, at, slots);
    if (chance() < 0.02) later(store.cleanVotes(at));
    if (r?.already !== true) refreshPageSnap(slug); // 미리 만든 DJ 페이지 답의 하트 수도(15초에 한 번)
    return json({ hearts: Number(r?.hearts) || 0, already: r?.already === true });
  }

  // 먼치킨이 서명해 보내는 요청(POST app): 몸통을 읽고 서명·기기 승인을 확인한 뒤 action 으로 나눈다 — upload(키우기 페이지) · fight-*(보스전 보기, 함수 v4)
  async function app(req: Request) {
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
    return b.action === 'upload' ? await upload(b, device, at) : await fightWrite(b, device, at);
  }

  async function upload(b: Record<string, any>, device: string, at: number) {
    // 1분에 6번까지(2026-10-16 — 먼치킨이 옷·레벨이 바뀌면 15초 뒤 바로 올린다. 예전 2번)
    await limit(`kg:u:${device}`, 60, 6, '조금 전에 올렸어요. 잠시 뒤에 다시 올려요.');
    if (!await store.nonce('kg:' + device + ':' + b.nonce, at + v.NONCE_MS)) throw v.fail(409, '이미 처리한 요청이에요.');
    if (chance() < 0.05) later(store.cleanNonces(at));
    if (v.bytes(JSON.stringify(b.payload ?? null)) > v.MAX_PAYLOAD_BYTES) throw v.fail(413, '올릴 내용이 너무 커요.');
    // 시즌 2(2026-11-15): v3(몬스터) 를 받고, 시즌 1 v2(옷)는 2026-12-01 0시(한국)부터 받지 않는다(lib.ts snapshot)
    const snap = v.snapshot(b.payload, at, v2Until);
    if (chance() < 0.02) later(store.expire(at - v.KEEP_MS));
    let found = await store.pageByDevice(device);
    // 끄면(또는 키우기를 끄면) 내용만 지운다. 주소·캐릭터 이름은 이 기기에 그대로 묶어 둔다(다시 켜면 같은 주소).
    // 끈 채로도 마지막으로 올린 때(seen)는 적는다 — 60일 동안 아무것도 안 올리면 캐릭터 이름을 놓아준다.
    if (!snap.enabled) {
      if (found) { await store.clearSnapshot(found.slug, at); putSnap(snapPath(found.slug), { closed: true }, true); refreshHomeSnap(); }
      return json({ ok: true, enabled: false, slug: found?.slug || null, url: found ? urlOf(found.slug) : null });
    }
    // 캐릭터 이름은 사이트 전체에서 하나만(먼저 쓴 방송이 가진다).
    // 넘겨받기(2026-10-20): 이름을 가진 페이지가 넘겨줄 수 있는 페이지(releasable — 주인 기기 승인 아님 · 60일)면 그 페이지를 닫고
    //  (내용·이름 열쇠·하트를 비우고 미리 만든 답은 {closed:true}) 이 기기가 이름을 쓴다. 그사이 그 페이지가 다시 올렸으면(updated 가 바뀜) 넘겨받지 않는다(409).
    const owner = await store.nameOwner(snap.nameKey);
    if (owner && owner.slug !== found?.slug) {
      if (!await releasable(owner, at)) throw v.fail(409, NAME_TAKEN);
      if (!await store.releaseName(owner.slug, snap.nameKey, owner.updated ?? null)) throw v.fail(409, NAME_TAKEN);
      putSnap(snapPath(owner.slug), { closed: true }, true);
    }
    for (let i = 0; !found && i < 6; i++) {
      const slug = v.makeSlug(random);
      const r = await store.createPage({ slug, device_id: device, created: at });
      if (r === 'ok') found = { slug, updated: null };
      else if (r === 'device') found = await store.pageByDevice(device);
    }
    if (!found) throw v.fail(503, '잠시 문제가 생겼어요. 조금 뒤에 다시 올려요.');
    // 지난번 사람 목록과 비교해 "새로 꾸민 때"를 붙이고, 메인 페이지 요약을 만든다(이번 시즌 하트 받은 사람 카드 hot 도 — 지난 목록과 하트 줄을 함께 묻는다)
    const pageSlug = found.slug;
    const [before, heartRows] = await Promise.all([
      found.updated !== null && found.updated !== undefined ? store.people(pageSlug) : null,
      snap.season ? store.heartRows([pageSlug]) : []
    ]);
    const people = v.withChanges(snap.people, before?.people, at);
    const saved = await store.saveSnapshot(pageSlug, { ...snap, people, summary: v.summarize(people, v.heartMap(heartRows || [], pageSlug, snap.season?.id)) }, at);
    if (saved === 'name') throw v.fail(409, NAME_TAKEN);
    // 지난 시즌·없어진 아이디의 하트 줄 정리(시즌이 바뀌었거나 가끔)
    if (snap.season && (before?.season?.id !== snap.season.id || chance() < 0.1)) later(store.pruneHearts(found.slug, snap.season.id, new Set(people.map((p) => p.k))));
    // 미리 만든 답: 이 DJ 페이지는 바로(새 옷이 사이트에 곧장 보이게), 메인은 15초에 한 번
    refreshPageSnap(found.slug, true);
    refreshHomeSnap();
    return json({ ok: true, enabled: true, slug: found.slug, url: urlOf(found.slug), count: snap.count });
  }

  // ---- 보스전 보기(함수 v4, 2026-11-18 — lib.ts "보스전 보기", API.md "보스전 보기") ----
  // 쓰기(서명·승인 기기·이 기기의 키우기 페이지가 있어야): fight-appear · fight-join · fight · fight-land · fight-drop.
  //  먼치킨은 408·429 말고 4xx 를 받으면 그 판 올리기를 멈춘다 → 모양이 틀린 것·너무 큰 것·한도만 4xx, 늦게 온 것·다시 온 것·지운 판에 온 것은 200(ignored — 아무것도 안 함)
  //  · 마감(joinUntil) 뒤·대본 뒤의 참전 수는 무시 · 같은 판 대본을 다시 받으면 덮어쓰되 시작·끝 시각은 처음 그대로 · 등장 없이 온 대본은 등장이 있었던 것으로 판을 만든다
  //  · 지운 판(fight-drop — "키우기 사이트에 올리기"를 끔)은 그 판에 무엇이 와도 그대로(대본·땅은 비운다) · 지난 판(expires)은 없는 판으로 본다(대본·등장은 새 판으로)
  // 같은 판 요청이 겹치면(먼치킨이 다시 보낸 것과 늦게 끝난 것) 줄을 본 그대로일 때만 바꾸고(phase·updated — updated 는 바꿀 때마다 커진다), 아니면 다시 읽어 정한다.
  // 읽기(누구나): GET fights(지금 판 목록) · GET fights/<id>(대본까지). DJ 이름은 키우기 페이지(kg_pages.name)에서 — 페이지를 닫았거나 기기가 승인 상태가 아니면 보이지 않는다.
  // 지우기: 보스전 요청이 올 때 1% 로 expires 지난 줄을 지운다(expires: 등장 + 15분 · 대본을 받으면 끝 + 10분).
  const FIGHT_GONE = '끝났거나 없는 보스전이에요.';
  const fightClean = (at: number) => { if (chance() < 0.01) later(store.cleanFights(at)); };
  // 봇 시계로 보낸 시각 → 서버 시계(서명 시각과 받은 때의 차이만큼 옮긴다)
  const serverTime = (t: number, b: Record<string, any>, at: number) => at + (t - b.timestamp);
  const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

  async function fightWrite(b: Record<string, any>, device: string, at: number) {
    await limit(`kg:fw:${device}`, 3600, v.FIGHT_HOURLY, '보스전 보기를 너무 자주 올렸어요. 잠시 뒤에 다시 올려요.');
    if (!await store.nonce('kg:' + device + ':' + b.nonce, at + v.NONCE_MS)) throw v.fail(409, '이미 처리한 요청이에요.');
    if (chance() < 0.05) later(store.cleanNonces(at));
    if (v.bytes(JSON.stringify(b.payload ?? null)) > v.FIGHT_MAX_BYTES + 1024) throw v.fail(413, '올릴 내용이 너무 커요.');
    // 모양 검사(데이터베이스를 부르기 전에)
    const action: string = b.action, p = b.payload;
    const key = v.fightKey(p);
    let boss: ReturnType<typeof v.fightBoss> | null = null, joinUntil = 0, joined = 0, script: ReturnType<typeof v.fightScript> | null = null, land: Record<string, unknown> | null = null;
    if (action === 'fight-appear') {
      boss = v.fightBoss(p.boss);
      if (!Number.isSafeInteger(p.joinUntil)) throw v.fail(400, '보스전 내용을 확인해 주세요.');
      joinUntil = clamp(serverTime(p.joinUntil, b, at), at, at + v.FIGHT_JOIN_MAX_MS);
    } else if (action === 'fight-join') joined = v.fightJoined(p.joined);
    else if (action === 'fight') {
      if (v.bytes(JSON.stringify(p.script ?? null)) > v.FIGHT_MAX_BYTES) throw v.fail(413, '보스전 대본이 너무 커요.');
      script = v.fightScript(p.script);
    } else if (action === 'fight-land') land = v.fightLand(p.land);
    const page = await store.pageByDevice(device);
    if (!page) throw v.fail(409, '키우기 사이트에 먼저 올려 주세요.');
    fightClean(at);
    const base = { device_id: device, slug: page.slug, live_key: key.liveKey, k: key.k };
    for (let tries = 0; tries < 4; tries++) {
      const row = await store.fight(device, key.liveKey, key.k);
      const live = row && row.expires > at ? row : null;
      const updated = Math.max(at, (Number(row?.updated) || 0) + 1);
      // 새 판(없거나 지난 판 자리에): 등장이면 모집 중, 대본이면 등장이 있었던 것으로
      let fresh: Record<string, any> | null = null, patch: Record<string, any> | null = null;
      if (action === 'fight-appear') {
        if (!live) fresh = { ...base, id: v.makeFightId(random), phase: 'join', boss, join_until: joinUntil, joined: 0, script: null, land: null, appear_at: at, start_at: null, end_at: null, updated: at, expires: at + v.FIGHT_JOIN_KEEP_MS };
        else if (live.phase === 'join') patch = { boss, join_until: joinUntil, slug: page.slug, updated };
      } else if (action === 'fight-join') {
        if (live?.phase === 'join' && at <= live.join_until) patch = { joined, updated };
      } else if (action === 'fight' && script) {
        const end = at + v.FIGHT_VIEW_MS, n = script.team.length;
        if (!live) fresh = { ...base, id: v.makeFightId(random), phase: 'fight', boss: script.boss, join_until: at, joined: n, script, land: null, appear_at: at, start_at: at, end_at: end, updated: at, expires: end + v.FIGHT_KEEP_MS };
        else if (live.phase === 'join') patch = { phase: 'fight', boss: script.boss, joined: n, script, start_at: at, end_at: end, expires: end + v.FIGHT_KEEP_MS, slug: page.slug, updated };
        else if (live.phase === 'fight') patch = { boss: script.boss, joined: n, script, updated };
      } else if (action === 'fight-land') {
        if (live && live.phase !== 'drop') patch = { land, updated };
      } else if (action === 'fight-drop') {
        if (live && live.phase !== 'drop') patch = { phase: 'drop', script: null, land: null, updated };
      }
      if (!fresh && !patch) return json({ ok: true, ignored: true });
      if (fresh && row) patch = { ...fresh, updated }; // 지난 판 자리를 새 판으로(같은 열쇠의 줄은 하나)
      if (patch) {
        if (await store.updateFight(row!.id, { phase: row!.phase, updated: row!.updated }, patch)) return json({ ok: true, id: patch.id || row!.id, phase: patch.phase || row!.phase });
      } else if (await store.insertFight(fresh) === 'ok') return json({ ok: true, id: fresh!.id, phase: fresh!.phase });
    }
    throw v.fail(503, '잠시 문제가 생겼어요. 조금 뒤에 다시 올려요.');
  }

  // 보이는 판만(키우기 페이지가 열려 있고 · 그 페이지가 이 기기 것이고 · 기기가 승인 상태): [{row, page}]
  async function shownFights(rows: Record<string, any>[]) {
    if (!rows.length) return [];
    const [pages, devs] = await Promise.all([store.pagesOf([...new Set(rows.map((r) => r.slug))]), store.devicesOf([...new Set(rows.map((r) => r.device_id))])]);
    const bySlug = new Map(((pages || []) as Record<string, any>[]).map((p) => [p.slug, p]));
    return rows.flatMap((row) => {
      const page = bySlug.get(row.slug);
      return page && page.device_id === row.device_id && page.updated !== null && page.updated !== undefined && approved(devs?.[row.device_id]) ? [{ row, page }] : [];
    });
  }
  // 목록 한 칸 {id, dj:{slug,name}, boss:{type,name,stage}, phase, joined, appearAt, joinUntil, startAt} — 기기 번호·방송 열쇠는 내보내지 않는다
  const fightOut = (row: Record<string, any>, page: Record<string, any>) => ({
    id: row.id, dj: { slug: page.slug, name: page.name }, boss: { type: row.boss?.type, name: row.boss?.name, stage: row.boss?.stage },
    phase: row.phase, joined: Number(row.joined) || 0, appearAt: row.appear_at, joinUntil: row.join_until, startAt: row.start_at ?? null
  });
  // 지금 판 목록: 모집 중이거나 싸우는 중(지운 것·지난 것·끝난 것(now > end_at) 빼고)
  async function fights() {
    const at = now();
    fightClean(at);
    const shown = await shownFights((await store.liveFights(at)) || []);
    return json({ now: at, fights: shown.map(({ row, page }) => fightOut(row, page)) }, 200, 'public, max-age=5');
  }
  // 한 판(대본까지): 끝난 판도 expires 까지(늦게 온 사람에게 결과 한 장면). 대본의 판 번호·DJ·칸·시각은 서버 값으로, 땅은 fight-land 로 받은 것(없으면 대본의 것).
  async function fight(id: string) {
    if (!v.FIGHT_ID.test(id)) throw v.fail(404, FIGHT_GONE);
    const at = now();
    fightClean(at);
    const row = await store.fightById(id);
    if (!row || row.phase === 'drop' || !(row.expires > at)) throw v.fail(404, FIGHT_GONE);
    const [hit] = await shownFights([row]);
    if (!hit) throw v.fail(404, FIGHT_GONE);
    const out = fightOut(row, hit.page), land = row.land ?? row.script?.land ?? null;
    const script = row.script ? { ...row.script, v: 1, id: row.id, dj: out.dj, k: row.k, appearAt: row.appear_at, joinUntil: row.join_until, startAt: row.start_at, land } : null;
    return json({ now: at, fight: { ...out, boss: { ...out.boss, aoe: row.boss?.aoe }, script, land } }, 200, 'public, max-age=5');
  }

  return async function handle(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      const url = new URL(req.url);
      const route = url.pathname.replace(/^\/(functions\/v1\/)?kiugi\/?/, '').replace(/\/$/, '');
      if (req.method === 'GET') {
        if (route === 'health') return json({ service: 'jun-live-kiugi', v: v.PAYLOAD_VERSION, s2: true, v2Until: Number.isFinite(v2Until) ? new Date(v2Until).toISOString() : null, hearts: true, pets: true, motions: true, exp: true, snaps: typeof store.putSnap === 'function' });
        if (route === 'fights') return await fights();
        if (route.startsWith('fights/')) return await fight(route.slice('fights/'.length));
        if (route === 'page') return await page(url, req);
        if (route === 'find') return await find(url, req);
        if (route === 'person') return await person(url, req);
        if (route === 'home') return await home(req);
        if (route === 'search') return await search(url, req);
      }
      if (req.method === 'POST' && route === 'heart') return await heart(req);
      if (req.method === 'POST' && route === 'app') return await app(req);
      return json({ error: '찾을 수 없어요.' }, 404);
    } catch (error) {
      const e = error as v.Fail;
      if (!e?.status) console.error(error);
      return json({ error: e?.status ? e.message : '잠시 문제가 생겼어요. 조금 뒤에 다시 해 주세요.', ...(e?.extra || {}) }, e?.status || 503);
    }
  };
}

type Person = v.Person;
