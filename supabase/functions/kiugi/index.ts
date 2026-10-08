// DJ 키우기 페이지 — Supabase Edge Function "kiugi" (API.md "DJ 키우기 페이지").
// JWT 확인을 끄고 올린다(verify_jwt false): 보는 사람은 로그인하지 않고, 먼치킨은 승인받은 기기 키로 서명한다.
// people 칸(jsonb)에는 청취자가 직접 만든 시즌 아이디·레벨·애정도·입은 옷·찾기 열쇠만 들어간다(lib.ts person).
// 표: kg_pages(supabase/kiugi.sql). 함께 쓰는 것: junlive_devices·junlive_access_nonces(승인 서버), fp_hit·junlive_secrets(팬페이지 schema.sql).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as v from './lib.ts';
import { createHandler } from './handler.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

async function q<T = any>(p: PromiseLike<{ data: T; error: any }>): Promise<T> {
  const { data, error } = await p;
  if (error) { console.error(error); throw v.fail(503, '잠시 문제가 생겼어요. 조금 뒤에 다시 해 주세요.'); }
  return data;
}
const EMPTY = { updated: null, name: '', season: null, character: null, top: [], people: [], count: 0 };
let saltPromise: Promise<string> | null = null;

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
    console.error(error); throw v.fail(503, '잠시 문제가 생겼어요. 조금 뒤에 다시 해 주세요.');
  },
  device: (id: string) => q(db.from('junlive_devices').select('state,review').eq('id', id).maybeSingle()),
  pageByDevice: (device: string) => q(db.from('kg_pages').select('slug,updated').eq('device_id', device).maybeSingle()),
  createPage: async (row: { slug: string; device_id: string; created: number }) => {
    const { error } = await db.from('kg_pages').insert(row);
    if (!error) return 'ok';
    if (error.code !== '23505') { console.error(error); throw v.fail(503, '잠시 문제가 생겼어요. 조금 뒤에 다시 해 주세요.'); }
    // 겹친 것이 기기면(동시에 두 번 올림) 이미 있는 주소를 쓰고, 주소면 새 주소로 다시
    return (await q(db.from('kg_pages').select('slug').eq('device_id', row.device_id).maybeSingle())) ? 'device' : 'slug';
  },
  saveSnapshot: (slug: string, s: Record<string, any>, now: number) => q(db.from('kg_pages').update({ updated: now, name: s.name, season: s.season, character: s.character, top: s.top, people: s.people, count: s.count }).eq('slug', slug)),
  clearSnapshot: (slug: string) => q(db.from('kg_pages').update(EMPTY).eq('slug', slug)),
  publicPage: (slug: string) => q(db.from('kg_pages').select('slug,device_id,updated,name,season,character,top,count').eq('slug', slug).maybeSingle()),
  people: (slug: string) => q(db.from('kg_pages').select('device_id,updated,people').eq('slug', slug).maybeSingle()),
  // 60일 동안 새로 올리지 않은 페이지는 내용을 지운다(주소 묶음은 남긴다 — 다시 올리면 같은 주소)
  expire: (before: number) => q(db.from('kg_pages').update(EMPTY).lt('updated', before)),
  cleanNonces: (now: number) => q(db.from('junlive_access_nonces').delete().lt('expires', now))
};

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;
const later = (p: Promise<unknown>) => { const safe = p.catch((e) => console.error(e)); try { EdgeRuntime?.waitUntil(safe); } catch { /* local */ } };

Deno.serve(createHandler(store, { later }));
