// DJ 키우기 페이지 — Supabase Edge Function "kiugi" (API.md "DJ 키우기 페이지").
// JWT 확인을 끄고 올린다(verify_jwt false): 보는 사람은 로그인하지 않고, 먼치킨은 승인받은 기기 키로 서명한다.
// people 칸(jsonb)에는 청취자가 직접 만든 시즌 아이디·레벨·애정도·입은 옷·찾기 열쇠·새로 꾸민 때만 들어간다(lib.ts person·withChanges).
// 표: kg_pages(supabase/kiugi.sql + kiugi-stage2.sql), kg_hearts·kg_heart_votes·함수 kg_heart(kiugi-stage2.sql).
// 함께 쓰는 것: junlive_devices·junlive_access_nonces(승인 서버), fp_hit·junlive_secrets(팬페이지 schema.sql).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as v from './lib.ts';
import { createHandler } from './handler.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const BROKEN = '잠시 문제가 생겼어요. 조금 뒤에 다시 해 주세요.';

async function q<T = any>(p: PromiseLike<{ data: T; error: any }>): Promise<T> {
  const { data, error } = await p;
  if (error) { console.error(error); throw v.fail(503, BROKEN); }
  return data;
}
// 끄기·60일 지남: 내용만 비운다(끄기는 캐릭터 이름 열쇠·main 을 남기고, 60일 지남은 이름 열쇠도 지운다)
const EMPTY = { updated: null, name: '', season: null, character: null, top: [], people: [], count: 0, summary: {} };
const PAGE_COLUMNS = 'slug,device_id,updated,name,season,character,main,people';
let saltPromise: Promise<string> | null = null;
const chunks = <T>(list: T[], n: number) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

const store = {
  ipSalt: () => (saltPromise ||= (async () => {
    const r = await q(db.from('junlive_secrets').select('value').eq('key', 'ip_salt').maybeSingle());
    if (!r?.value) throw v.fail(503, '잠시 문제가 생겼어요.');
    return r.value as string;
  })().catch((e) => { saltPromise = null; throw e; })),
  hit: async (key: string, seconds: number, max: number) => Boolean(await q(db.rpc('fp_hit', { p_key: key, p_seconds: seconds, p_max: max }))),
  nonce: async (id: string, expires: number) => {
    const { error } = await db.from('junlive_access_nonces').insert({ id, expires });
    if (!error) return true;
    if (error.code === '23505') return false;
    console.error(error); throw v.fail(503, BROKEN);
  },
  device: (id: string) => q(db.from('junlive_devices').select('state,review').eq('id', id).maybeSingle()),
  devicesOf: async (ids: string[]) => {
    const out: Record<string, any> = {};
    for (const part of chunks(ids, 100)) for (const d of await q(db.from('junlive_devices').select('id,state,review').in('id', part))) out[d.id] = d;
    return out;
  },
  pageByDevice: (device: string) => q(db.from('kg_pages').select('slug,updated').eq('device_id', device).maybeSingle()),
  nameOwner: async (nameKey: string) => (await q(db.from('kg_pages').select('slug').eq('name_key', nameKey).maybeSingle()))?.slug || null,
  createPage: async (row: { slug: string; device_id: string; created: number }) => {
    const { error } = await db.from('kg_pages').insert(row);
    if (!error) return 'ok';
    if (error.code !== '23505') { console.error(error); throw v.fail(503, BROKEN); }
    // 겹친 것이 기기면(동시에 두 번 올림) 이미 있는 주소를 쓰고, 주소면 새 주소로 다시
    return (await q(db.from('kg_pages').select('slug').eq('device_id', row.device_id).maybeSingle())) ? 'device' : 'slug';
  },
  saveSnapshot: async (slug: string, s: Record<string, any>, now: number) => {
    const { error } = await db.from('kg_pages').update({ updated: now, seen: now, name: s.name, name_key: s.nameKey, main: s.main, season: s.season, character: s.character, top: s.top, people: s.people, count: s.count, summary: s.summary }).eq('slug', slug);
    if (!error) return 'ok';
    // 바꾸는 줄의 slug·device_id 는 그대로라 겹칠 수 있는 것은 캐릭터 이름 열쇠뿐(동시에 같은 이름으로 올린 경우)
    if (error.code === '23505') return 'name';
    console.error(error); throw v.fail(503, BROKEN);
  },
  clearSnapshot: (slug: string, now: number) => q(db.from('kg_pages').update({ ...EMPTY, seen: now }).eq('slug', slug)),
  publicPage: (slug: string) => q(db.from('kg_pages').select('slug,device_id,updated,name,season,character,top,count,main').eq('slug', slug).maybeSingle()),
  people: (slug: string) => q(db.from('kg_pages').select(PAGE_COLUMNS).eq('slug', slug).maybeSingle()),
  pageByNameKey: (nameKey: string) => q(db.from('kg_pages').select(PAGE_COLUMNS).eq('name_key', nameKey).maybeSingle()),
  mainPages: (withPeople: boolean) => q(db.from('kg_pages').select('slug,device_id,updated,name,season,character,count,main,summary' + (withPeople ? ',people' : '')).eq('main', true).not('updated', 'is', null).limit(1000)),
  heartRows: async (slugs: string[]) => {
    const out: any[] = [];
    for (const part of chunks(slugs, 100)) out.push(...await q(db.from('kg_hearts').select('slug,season,pid,hearts').in('slug', part).gt('hearts', 0)));
    return out;
  },
  topHearts: (limit: number) => q(db.from('kg_hearts').select('slug,season,pid,hearts').gt('hearts', 0).order('hearts', { ascending: false }).order('updated', { ascending: false }).limit(limit)),
  heart: (vote: string, expires: number, slug: string, season: string, pid: string, now: number) =>
    q(db.rpc('kg_heart', { p_vote: vote, p_expires: expires, p_slug: slug, p_season: season, p_pid: pid, p_now: now })),
  cleanVotes: (now: number) => q(db.from('kg_heart_votes').delete().lt('expires', now)),
  // 이 페이지의 지난 시즌 하트 줄과, 지금 사람 목록에 없는 아이디의 하트 줄을 지운다
  pruneHearts: async (slug: string, season: string, keep: Set<string>) => {
    await q(db.from('kg_hearts').delete().eq('slug', slug).neq('season', season));
    const rows = await q(db.from('kg_hearts').select('pid').eq('slug', slug).eq('season', season));
    const gone = rows.map((r: any) => r.pid).filter((pid: string) => !keep.has(pid));
    for (const part of chunks(gone, 50)) await q(db.from('kg_hearts').delete().eq('slug', slug).eq('season', season).in('pid', part));
  },
  // 60일 동안 아무것도 올리지 않은(끈 것 포함) 페이지는 내용·캐릭터 이름 열쇠·하트를 지운다(주소 묶음은 남긴다 — 다시 올리면 같은 주소)
  expire: async (before: number) => {
    const rows = await q(db.from('kg_pages').update({ ...EMPTY, name_key: null }).lt('seen', before).or('updated.not.is.null,name_key.not.is.null').select('slug'));
    const slugs = (rows || []).map((r: any) => r.slug);
    for (const part of chunks(slugs, 100)) await q(db.from('kg_hearts').delete().in('slug', part));
  },
  cleanNonces: (now: number) => q(db.from('junlive_access_nonces').delete().lt('expires', now))
};

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;
const later = (p: Promise<unknown>) => { const safe = p.catch((e) => console.error(e)); try { EdgeRuntime?.waitUntil(safe); } catch { /* local */ } };

Deno.serve(createHandler(store, { later }));
