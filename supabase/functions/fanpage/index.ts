// JUN LIVE 팬페이지 — Supabase Edge Function "fanpage" (API.md is the contract).
// Deploy with JWT verification OFF: fans need no login, DJs use a session token
// issued to an approved JUN LIVE device, the app signs with its device key.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as v from './lib.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const SITE = 'https://jwonly-spn.github.io/jun-live-fanpage/';
const BUCKET = 'fp-photos';
// 한 페이지가 전체 저장 공간을 차지하지 못하게 페이지당 100MB(무료 저장 공간 전체는 850MB).
const PHOTO_QUOTA = 100 * 1024 * 1024, TOTAL_PHOTO_QUOTA = 850 * 1024 * 1024, MAX_PAGES = 3000;
const enc = new TextEncoder();
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-junlive-admin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Max-Age': '86400' };
const json = (body: unknown, status = 200, cache = 'no-store') => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' } });
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const sha = async (s: string | Uint8Array) => hex(await crypto.subtle.digest('SHA-256', typeof s === 'string' ? enc.encode(s) : s));
const decode64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const token = () => { const b = crypto.getRandomValues(new Uint8Array(32)); return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };

async function q<T = any>(p: PromiseLike<{ data: T; error: any }>): Promise<T> {
  const { data, error } = await p;
  if (error) { console.error(error); throw v.fail(503, '잠시 문제가 생겼어요. 조금 뒤에 다시 시도해 주세요.'); }
  return data;
}
async function body(req: Request, max = 64 * 1024) {
  if (!req.headers.get('content-type')?.startsWith('application/json')) throw v.fail(415, 'JSON 요청이 필요해요.');
  const t = await req.text();
  if (t.length > max) throw v.fail(413, '요청이 너무 커요.');
  try { return JSON.parse(t) ?? {}; } catch { throw v.fail(400, '요청을 읽지 못했어요.'); }
}
// Cloudflare sets cf-connecting-ip (clients cannot); the gateway rewrites x-forwarded-for with it first.
const clientIp = (req: Request) => req.headers.get('cf-connecting-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
// 주소는 비밀 값을 섞어 저장한다(그냥 해시하면 모든 IPv4를 넣어 보고 되돌릴 수 있음).
let saltPromise: Promise<string> | null = null;
const ipSalt = () => (saltPromise ||= (async () => { const r = await q(db.from('junlive_secrets').select('value').eq('key', 'ip_salt').maybeSingle()); if (!r?.value) throw v.fail(503, '잠시 문제가 생겼어요.'); return r.value as string; })().catch((e) => { saltPromise = null; throw e; }));
const ipHash = async (req: Request) => (await sha('ip:' + await ipSalt() + ':' + clientIp(req))).slice(0, 32);
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;
const later = (p: Promise<unknown>) => { const safe = p.catch(e => console.error(e)); try { EdgeRuntime?.waitUntil(safe); } catch { /* local */ } };
async function limit(key: string, seconds: number, max: number, message = '요청이 많아요. 잠시 후 다시 해 주세요.') {
  if (!await q(db.rpc('fp_hit', { p_key: key, p_seconds: seconds, p_max: max }))) throw v.fail(429, message);
}
const publicUrl = (path: string) => db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

// ---------- shaping ----------
const postOut = (p: any) => ({ id: p.id, menu: p.menu_id, title: p.title, body: p.body, photos: p.photos, category: p.category, pinned: p.pinned, supporter: p.supporter, eventDate: p.event_date, likes: p.likes, comments: p.comment_count, created: p.created });
const commentOut = (c: any, owner = false) => ({ id: c.id, menu: c.menu_id, post: c.post_id, nickname: c.nickname, body: c.body, created: c.created, hearted: c.hearted, reply: c.reply, ...(owner ? { hidden: c.hidden } : {}) });
const storyOut = (s: any) => ({ id: s.id, nickname: s.nickname, tag: s.tag, body: s.body, photo: s.photo ? { ...s.photo, url: publicUrl(s.photo.path), thumbUrl: publicUrl(s.photo.thumb) } : null, created: s.created });
async function livePage(pageId: unknown) {
  const id = v.uuid(pageId, '페이지');
  const page = await q(db.from('fp_pages').select('id,slug,published,blocked').eq('id', id).maybeSingle());
  if (!page || page.blocked || !page.published) throw v.fail(404, '팬페이지를 찾을 수 없어요.');
  return page;
}

// ---------- public ----------
async function getPage(url: URL) {
  const slug = v.slug(url.searchParams.get('slug'));
  const page = await q(db.from('fp_pages').select('id,slug,published,published_at,blocked').eq('slug', slug).maybeSingle());
  if (!page || page.blocked || !page.published) throw v.fail(404, '아직 공개되지 않은 팬페이지예요.');
  const live = await q(db.from('fp_live').select('on_air,title,rankings,updated').eq('page_id', page.id).maybeSingle());
  const fresh = live && Date.now() - Date.parse(live.updated) < 15 * 60 * 1000;
  return json({ page: { id: page.id, slug: page.slug, config: v.publicConfig(page.published), updated: page.published_at }, live: live ? { on: Boolean(live.on_air && fresh), title: live.title, updated: live.updated } : null, rankings: null }, 200, 'public, max-age=30');
}
async function getHome(url: URL) {
  const page = await livePage(url.searchParams.get('page'));
  const menus = (page.published.menus || []).filter((m: any) => m.visible && v.POST_FORMS.includes(m.form) && m.options?.showOnHome !== false);
  const out: Record<string, unknown[]> = {};
  for (const m of menus) out[m.id] = (await q(db.from('fp_posts').select('*').eq('page_id', page.id).eq('menu_id', m.id).order('created', { ascending: false }).limit(3))).map(postOut);
  const lounge = (page.published.menus || []).filter((m: any) => m.visible && m.form === 'lounge').map((m: any) => m.id);
  const comments = lounge.length ? (await q(db.from('fp_comments').select('*').eq('page_id', page.id).in('menu_id', lounge).is('post_id', null).eq('hidden', false).order('created', { ascending: false }).limit(4))).map((c: any) => commentOut(c)) : [];
  const pinned = (await q(db.from('fp_posts').select('*').eq('page_id', page.id).eq('pinned', true).in('menu_id', menus.map((m: any) => m.id).concat(['_'])).order('created', { ascending: false }).limit(3))).map(postOut);
  return json({ menus: out, comments, pinned }, 200, 'public, max-age=20');
}
async function getPosts(url: URL) {
  const page = await livePage(url.searchParams.get('page'));
  const menu = v.menuOf(page.published, url.searchParams.get('menu'), v.POST_FORMS, { visibleOnly: true });
  const before = v.before(url.searchParams.get('before'));
  const category = url.searchParams.get('category') || '';
  let pinned: any[] = [];
  if (!before) { let pq = db.from('fp_posts').select('*').eq('page_id', page.id).eq('menu_id', menu.id).eq('pinned', true); if (category) pq = pq.eq('category', category); pinned = await q(pq.order('created', { ascending: false }).limit(10)); }
  let qq = db.from('fp_posts').select('*').eq('page_id', page.id).eq('menu_id', menu.id).eq('pinned', false);
  if (category) qq = qq.eq('category', category);
  if (before) qq = qq.lt('created', before);
  const rows = await q(qq.order('created', { ascending: false }).limit(21));
  return json({ posts: [...pinned, ...rows.slice(0, 20)].map(postOut), more: rows.length > 20 }, 200, 'public, max-age=15');
}
async function getPost(url: URL) {
  const id = v.uuid(url.searchParams.get('id'), '글');
  const post = await q(db.from('fp_posts').select('*').eq('id', id).maybeSingle());
  if (!post) throw v.fail(404, '글을 찾을 수 없어요.');
  // 다른 팬페이지의 글을 이 페이지 이름으로 보여 주지 않게(page를 주면 맞는지 확인)
  const pageParam = url.searchParams.get('page');
  if (pageParam && pageParam !== post.page_id) throw v.fail(404, '글을 찾을 수 없어요.');
  const page = await livePage(post.page_id);
  v.menuOf(page.published, post.menu_id, undefined, { visibleOnly: true });
  return json({ post: postOut(post) }, 200, 'public, max-age=15');
}
async function getComments(url: URL) {
  const page = await livePage(url.searchParams.get('page'));
  const menu = v.menuOf(page.published, url.searchParams.get('menu'), undefined, { visibleOnly: true });
  const before = v.before(url.searchParams.get('before'));
  const post = url.searchParams.get('post');
  let qq = db.from('fp_comments').select('*').eq('page_id', page.id).eq('menu_id', menu.id).eq('hidden', false);
  qq = post ? qq.eq('post_id', v.uuid(post, '글')) : qq.is('post_id', null);
  if (before) qq = qq.lt('created', before);
  const rows = await q(qq.order('created', { ascending: false }).limit(21));
  return json({ comments: rows.slice(0, 20).map((c: any) => commentOut(c)), more: rows.length > 20 });
}
async function postComment(req: Request) {
  const b = await body(req);
  const page = await livePage(b.page);
  const menu = v.menuOf(page.published, b.menu, undefined, { visibleOnly: true });
  let postId: string | null = null;
  if (b.post) {
    postId = v.uuid(b.post, '글');
    if (!menu.options?.allowComments) throw v.fail(403, '이 메뉴는 댓글을 받지 않아요.');
    const post = await q(db.from('fp_posts').select('id').eq('id', postId).eq('page_id', page.id).eq('menu_id', menu.id).maybeSingle());
    if (!post) throw v.fail(404, '글을 찾을 수 없어요.');
  } else if (!['lounge', 'board'].includes(menu.form) || (menu.form === 'board' && !menu.options?.allowComments)) throw v.fail(403, '이 메뉴는 한마디를 받지 않아요.');
  const nickname = v.text(b.nickname, 20, { required: true, label: '닉네임' });
  const text = v.text(b.body, 200, { required: true, lines: true, label: '한마디' });
  const fan = v.fanId(b.fan);
  const ip = await ipHash(req);
  const blocked = await q(db.from('fp_blocks').select('key').eq('page_id', page.id).in('key', ['ip:' + ip, 'nick:' + nickname.toLowerCase(), 'fan:' + fan]));
  if (blocked.length) throw v.fail(403, '이 팬페이지에 글을 남길 수 없어요.');
  await limit(`c:${page.id}:${ip}`, 600, 5, '한마디는 10분에 5개까지 남길 수 있어요.');
  await limit(`c:${page.id}`, 60, 60);
  const row = await q(db.from('fp_comments').insert({ page_id: page.id, menu_id: menu.id, post_id: postId, nickname, body: text, ip_hash: ip, fan }).select('*').single());
  // 30일 지난 한마디의 주소 흔적은 지운다(가끔 한 번씩).
  if (Math.random() < 0.02) later(db.from('fp_comments').update({ ip_hash: '' }).lt('created', new Date(Date.now() - 30 * 86400000).toISOString()).neq('ip_hash', ''));
  return json({ comment: commentOut(row) });
}
async function postLike(req: Request) {
  const b = await body(req);
  const id = v.uuid(b.post, '글'), fan = v.fanId(b.fan);
  const post = await q(db.from('fp_posts').select('page_id').eq('id', id).maybeSingle());
  if (!post) throw v.fail(404, '글을 찾을 수 없어요.');
  await livePage(post.page_id);
  const ip = await ipHash(req);
  await limit(`l:${ip}`, 60, 60);
  // 같은 주소에서 한 글에 좋아요를 수없이 누르지 못하게(가족·통신사 공유 주소를 생각해 하루 3번까지)
  await limit(`l:${id}:${ip}`, 86400, 3, '이 글에는 좋아요를 더 누를 수 없어요.');
  return json(await q(db.rpc('fp_like', { p_post: id, p_fan: fan })));
}
async function postAttendance(req: Request) {
  const b = await body(req);
  const page = await livePage(b.page);
  const menu = v.menuOf(page.published, b.menu, ['attendance'], { visibleOnly: true });
  const nickname = v.text(b.nickname, 20, { required: true, label: '닉네임' });
  if (typeof b.pin !== 'string' || !/^\d{4}$/.test(b.pin)) throw v.fail(400, '숫자 4자리를 입력해 주세요.');
  if (!['create', 'load', 'check'].includes(b.action)) throw v.fail(400, '요청을 확인해 주세요.');
  const ip = await ipHash(req);
  await limit(`a:${page.id}:${ip}`, 600, b.action === 'create' ? 10 : 40);
  const r = await q(db.rpc('fp_attendance', { p_page: page.id, p_menu: menu.id, p_nickname: nickname, p_pin_hash: await sha(`pin:${page.id}:${menu.id}:${nickname}:${b.pin}`), p_action: b.action }));
  const errors: Record<string, [number, string]> = { exists: [409, '이미 있는 닉네임이에요. "기록 불러오기"로 열어 주세요.'], missing: [404, '카드를 찾지 못했어요. 닉네임을 확인하거나 새로 만들어 주세요.'], pin: [403, '숫자 4자리가 맞지 않아요.'], locked: [429, '여러 번 틀려서 10분 동안 잠겼어요.'] };
  if (r.error) throw v.fail(...(errors[r.error] || [400, '요청을 확인해 주세요.']));
  return json({ card: { ...r, next: v.nextReward(menu.options?.rewards || [], r.total) } });
}
async function getPoll(url: URL) {
  const page = await livePage(url.searchParams.get('page'));
  const menu = v.menuOf(page.published, url.searchParams.get('menu'), ['poll'], { visibleOnly: true });
  const fan = url.searchParams.get('fan') || '';
  const latest = await q(db.from('fp_polls').select('id').eq('page_id', page.id).eq('menu_id', menu.id).order('created', { ascending: false }).limit(1));
  if (!latest.length) return json({ poll: null });
  return json({ poll: await q(db.rpc('fp_poll_view', { p_poll: latest[0].id, p_fan: /^[A-Za-z0-9_-]{8,64}$/.test(fan) ? fan : '' })) });
}
async function postVote(req: Request) {
  const b = await body(req);
  const id = v.uuid(b.poll, '투표'), fan = v.fanId(b.fan);
  const poll = await q(db.from('fp_polls').select('page_id,menu_id').eq('id', id).maybeSingle());
  if (!poll) throw v.fail(404, '투표를 찾을 수 없어요.');
  v.menuOf((await livePage(poll.page_id)).published, poll.menu_id, ['poll'], { visibleOnly: true });
  const ip = await ipHash(req);
  await limit(`v:${id}:${ip}`, 3600, 20);
  if (!Number.isInteger(b.option) || !await q(db.rpc('fp_vote', { p_poll: id, p_fan: fan, p_option: b.option, p_ip: ip }))) throw v.fail(409, '이미 끝난 투표이거나 고를 수 없는 항목이에요.');
  return json({ poll: await q(db.rpc('fp_poll_view', { p_poll: id, p_fan: fan })) });
}

// ---------- DJ (owner) ----------
type Owner = { device: string; spoon: any; page: any | null; tokenHash: string };
async function owner(req: Request): Promise<Owner> {
  const m = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.get('authorization') || '');
  if (!m) throw v.fail(401, 'JUN LIVE에서 "팬페이지 꾸미기"를 눌러 다시 열어 주세요.');
  const s = await q(db.from('fp_sessions').select('device_id,spoon,expires').eq('token_hash', await sha(m[1])).maybeSingle());
  if (!s || Date.parse(s.expires) < Date.now()) throw v.fail(401, '로그인이 끝났어요. JUN LIVE에서 "팬페이지 꾸미기"를 눌러 다시 열어 주세요.');
  const dev = await q(db.from('junlive_devices').select('state').eq('id', s.device_id).maybeSingle());
  if (dev?.state !== 'approved') throw v.fail(403, 'JUN LIVE 사용 승인이 취소되어 팬페이지를 고칠 수 없어요.');
  const link = await q(db.from('fp_page_devices').select('page_id').eq('device_id', s.device_id).maybeSingle());
  const page = link ? await q(db.from('fp_pages').select('*').eq('id', link.page_id).single()) : null;
  if (page?.blocked) throw v.fail(403, '이 팬페이지는 운영 정책으로 멈춰 있어요.');
  return { device: s.device_id, spoon: s.spoon, page, tokenHash: await sha(m[1]) };
}
const needPage = (o: Owner) => { if (!o.page) throw v.fail(409, '먼저 팬페이지 주소를 정하고 저장해 주세요.'); return o.page; };
const pageOut = (p: any) => p && ({ id: p.id, slug: p.slug, draft: p.draft, published: p.published, revision: p.revision, publishedAt: p.published_at, blocked: p.blocked, photoBytes: p.photo_bytes });

async function exchange(req: Request) {
  const b = await body(req);
  if (typeof b.code !== 'string' || !/^[A-Za-z0-9_-]{20,64}$/.test(b.code)) throw v.fail(400, '연결 코드가 올바르지 않아요.');
  await limit(`x:${await ipHash(req)}`, 600, 30);
  const hash = await sha(b.code);
  const c = await q(db.from('fp_codes').update({ used: true }).eq('code_hash', hash).eq('used', false).gt('expires', new Date().toISOString()).select('device_id,spoon').maybeSingle());
  if (!c) throw v.fail(401, '연결 코드가 만료됐어요. JUN LIVE에서 "팬페이지 꾸미기"를 다시 눌러 주세요.');
  const t = token(), expires = new Date(Date.now() + 30 * 86400000).toISOString();
  await q(db.from('fp_sessions').insert({ token_hash: await sha(t), device_id: c.device_id, spoon: c.spoon, expires }));
  await q(db.from('fp_codes').delete().lt('expires', new Date(Date.now() - 3600000).toISOString()));
  await q(db.from('fp_sessions').delete().lt('expires', new Date().toISOString()));
  const link = await q(db.from('fp_page_devices').select('page_id').eq('device_id', c.device_id).maybeSingle());
  const page = link ? await q(db.from('fp_pages').select('id,slug').eq('id', link.page_id).single()) : null;
  return json({ token: t, expires, page });
}
async function savePage(req: Request, o: Owner) {
  const b = await body(req, 256 * 1024);
  if (!o.page) {
    const slug = v.slug(b.slug);
    await limit(`pc:${await ipHash(req)}`, 86400, 3, '팬페이지는 하루에 3개까지 만들 수 있어요.');
    const total = await q(db.from('fp_pages').select('id', { count: 'exact', head: true }).then((r: any) => ({ data: r.count, error: r.error })));
    if (total >= MAX_PAGES) throw v.fail(503, '새 팬페이지 만들기를 잠시 멈췄어요. 운영자에게 알려 주세요.');
    if (await q(db.from('fp_pages').select('id').eq('slug', slug).maybeSingle())) throw v.fail(409, '이미 쓰고 있는 주소예요. 다른 주소를 정해 주세요.');
    const id = crypto.randomUUID();
    const draft = v.config(b.draft ?? v.starterConfig(o.spoon?.nickname || ''), id);
    const page = await q(db.from('fp_pages').insert({ id, slug, draft, spoon: o.spoon, revision: 1 }).select('*').single());
    const { error } = await db.from('fp_page_devices').insert({ device_id: o.device, page_id: page.id });
    if (error) { await db.from('fp_pages').delete().eq('id', page.id); throw v.fail(409, '이 PC는 이미 다른 팬페이지와 연결돼 있어요.'); }
    return json({ page: pageOut(page) });
  }
  const draft = v.config(b.draft, o.page.id);
  if (!Number.isInteger(b.revision)) throw v.fail(400, '저장 정보를 확인해 주세요.');
  const r = await q(db.rpc('fp_save_draft', { p_page: o.page.id, p_draft: draft, p_revision: b.revision }));
  if (r === null) throw v.fail(409, '다른 곳에서 바뀌었어요. 새로고침해 주세요.');
  return json({ page: pageOut({ ...o.page, draft, revision: r }) });
}
async function publish(o: Owner, on: boolean) {
  const page = needPage(o);
  const draft = on ? v.config(page.draft, page.id) : null;
  const row = await q(db.from('fp_pages').update(on ? { published: draft, published_at: new Date().toISOString() } : { published: null, published_at: null }).eq('id', page.id).select('*').single());
  return json({ page: pageOut(row) });
}
async function uploadPhoto(req: Request, o: Owner) {
  const page = needPage(o);
  await limit(`u:${page.id}`, 3600, 300, '사진은 한 시간에 300장까지 올릴 수 있어요.');
  await limit(`ud:${page.id}`, 86400, 150, '사진은 하루에 150장까지 올릴 수 있어요.');
  const b = await body(req, 3 * 1024 * 1024);
  const p = await storePhoto(page.id, b);
  later(cleanPhotos(page.id));
  return json({ ...p, url: publicUrl(p.path), thumbUrl: publicUrl(p.thumb) });
}
// 사진 저장(DJ 사진 올리기와 팬 사연 사진이 같이 쓴다): 용량 확보 → 기록 → 업로드
async function storePhoto(pageId: string, b: any) {
  const page = { id: pageId };
  const full = v.b64(b.data, 1.6 * 1024 * 1024), thumb = v.b64(b.thumb, 220 * 1024);
  const size = v.jpegSize(full), tsize = v.jpegSize(thumb);
  if (!size || !tsize) throw v.fail(400, 'JPG 사진만 올릴 수 있어요.');
  if (Math.max(size.w, size.h) > 2100 || Math.max(tsize.w, tsize.h) > 700) throw v.fail(413, '사진이 너무 커요.');
  if (Math.abs(size.w / size.h - tsize.w / tsize.h) > 0.05) throw v.fail(400, '사진 정보를 확인해 주세요.');
  // Reserve the bytes atomically; parallel uploads cannot slip past the quota.
  const bytes = full.length + thumb.length;
  const reserved = await q(db.rpc('fp_add_bytes', { p_page: page.id, p_bytes: bytes, p_quota: PHOTO_QUOTA, p_total: TOTAL_PHOTO_QUOTA }));
  if (reserved === 'page') throw v.fail(413, '사진 저장 공간(100MB)이 가득 찼어요. 안 쓰는 글을 지워 주세요.');
  if (reserved !== 'ok') throw v.fail(503, '사진 저장 공간이 부족해요. 운영자에게 알려 주세요.');
  const id = crypto.randomUUID(), path = `${page.id}/${id}.jpg`, tpath = `${page.id}/${id}_t.jpg`;
  // 기록을 먼저 남기고 올린다: 중간에 실패해도 정리 대상에서 빠진 파일이 생기지 않는다.
  const { error: rowError } = await db.from('fp_photos').insert([{ path, page_id: page.id, bytes: full.length }, { path: tpath, page_id: page.id, bytes: thumb.length }]);
  if (rowError) {
    console.error(rowError);
    await db.rpc('fp_add_bytes', { p_page: page.id, p_bytes: -bytes, p_quota: PHOTO_QUOTA, p_total: TOTAL_PHOTO_QUOTA });
    throw v.fail(503, '사진을 올리지 못했어요. 다시 시도해 주세요.');
  }
  for (const [p, data] of [[path, full], [tpath, thumb]] as const) {
    const { error } = await db.storage.from(BUCKET).upload(p, data, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
    if (error) {
      console.error(error);
      await db.storage.from(BUCKET).remove([path, tpath]);
      await db.from('fp_photos').delete().eq('page_id', page.id).in('path', [path, tpath]);
      await db.rpc('fp_add_bytes', { p_page: page.id, p_bytes: -bytes, p_quota: PHOTO_QUOTA, p_total: TOTAL_PHOTO_QUOTA });
      throw v.fail(503, '사진을 올리지 못했어요. 다시 시도해 주세요.');
    }
  }
  return { path, thumb: tpath, w: size.w, h: size.h };
}
// ---------- 사연함 ----------
async function getStorybox(url: URL) {
  const page = await livePage(url.searchParams.get('page'));
  const box = await q(db.from('fp_storybox').select('open,note').eq('page_id', page.id).maybeSingle());
  return json({ open: Boolean(box?.open), note: box?.note || '' });
}
async function postStory(req: Request) {
  const b = await body(req, 3 * 1024 * 1024);
  const page = await livePage(b.page);
  const box = await q(db.from('fp_storybox').select('open').eq('page_id', page.id).maybeSingle());
  if (!box?.open) throw v.fail(403, '지금은 사연을 받지 않아요. DJ가 사연함을 열면 보낼 수 있어요.');
  const nickname = v.text(b.nickname, 20, { required: true, label: '닉네임' });
  const tag = v.text(b.tag, 40, { label: '스푼 고유닉' }).replace(/^@/, '').toLowerCase();
  if (tag && !/^[a-z0-9._-]{1,40}$/.test(tag)) throw v.fail(400, '스푼 고유닉은 영문·숫자로 적어 주세요.');
  const text = v.text(b.body, 300, { lines: true, label: '사연' });
  if (!text && !b.data) throw v.fail(400, '사연 글이나 사진을 넣어 주세요.');
  const fan = v.fanId(b.fan);
  const ip = await ipHash(req);
  const blocked = await q(db.from('fp_blocks').select('key').eq('page_id', page.id).in('key', ['ip:' + ip, 'nick:' + nickname.toLowerCase(), 'fan:' + fan]));
  if (blocked.length) throw v.fail(403, '이 팬페이지에 사연을 보낼 수 없어요.');
  await limit(`s:${page.id}:${ip}`, 600, 3, '사연은 10분에 3개까지 보낼 수 있어요.');
  await limit(`s:${page.id}`, 3600, 60, '지금 사연이 많이 몰렸어요. 잠시 뒤에 다시 보내 주세요.');
  const photo = b.data ? await storePhoto(page.id, b) : null;
  const row = await q(db.from('fp_stories').insert({ page_id: page.id, nickname, tag, body: text, photo, ip_hash: ip, fan }).select('*').single());
  return json({ story: storyOut(row) });
}
// 7일 지난 사연은 사진과 함께 지운다.
async function cleanStories(pageId: string) {
  const old = await q(db.from('fp_stories').delete().eq('page_id', pageId).lt('created', new Date(Date.now() - 7 * 86400000).toISOString()).select('photo'));
  await dropPhotos(pageId, (old || []).flatMap((r: any) => r.photo ? [r.photo.path, r.photo.thumb] : []));
}
async function cleanPhotos(pageId: string, now = false) {
  const orphans: string[] = now ? [] : (await q(db.rpc('fp_orphan_photos', { p_page: pageId }))).map((r: any) => typeof r === 'string' ? r : r.fp_orphan_photos);
  await dropPhotos(pageId, orphans);
}
async function dropPhotos(pageId: string, paths: string[]) {
  if (!paths.length) return;
  const rows = await q(db.from('fp_photos').select('path,bytes').eq('page_id', pageId).in('path', paths));
  if (!rows.length) return;
  await db.storage.from(BUCKET).remove(rows.map((r: any) => r.path));
  await q(db.from('fp_photos').delete().eq('page_id', pageId).in('path', rows.map((r: any) => r.path)));
  const freed = rows.reduce((s: number, r: any) => s + r.bytes, 0);
  await q(db.rpc('fp_add_bytes', { p_page: pageId, p_bytes: -freed, p_quota: PHOTO_QUOTA, p_total: TOTAL_PHOTO_QUOTA }));
}
async function savePost(req: Request, o: Owner) {
  const page = needPage(o);
  const b = await body(req);
  const menu = v.menuOf(page.draft, b.menu, v.POST_FORMS);
  const photos = (Array.isArray(b.photos) ? b.photos : []);
  if (photos.length > 10) throw v.fail(400, '사진은 한 글에 10장까지 올릴 수 있어요.');
  const row: Record<string, unknown> = {
    page_id: page.id, menu_id: menu.id,
    title: v.text(b.title, 60, { label: '제목' }), body: v.text(b.body, 3000, { lines: true, label: '글' }),
    photos: photos.map((p: unknown) => v.photo(p, page.id)),
    category: menu.options?.categories?.includes(b.category) ? b.category : '',
    pinned: b.pinned === true, supporter: v.text(b.supporter, 40, { label: '함께한 후원자' }),
    event_date: typeof b.eventDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.eventDate) ? b.eventDate : null, updated: new Date().toISOString()
  };
  if (menu.form !== 'board' && !(row.photos as unknown[]).length) throw v.fail(400, '사진을 한 장 이상 올려 주세요.');
  if (menu.form === 'board' && !row.title && !row.body) throw v.fail(400, '제목이나 글을 입력해 주세요.');
  const known = await q(db.from('fp_photos').select('path').eq('page_id', page.id).in('path', (row.photos as any[]).flatMap(p => [p.path, p.thumb]).concat(['_'])));
  if (known.length !== (row.photos as unknown[]).length * 2) throw v.fail(400, '사진을 다시 올려 주세요.');
  let saved;
  if (b.id) {
    saved = await q(db.from('fp_posts').update(row).eq('id', v.uuid(b.id, '글')).eq('page_id', page.id).select('*').maybeSingle());
    if (!saved) throw v.fail(404, '글을 찾을 수 없어요.');
  } else {
    const count = await q(db.from('fp_posts').select('id', { count: 'exact', head: true }).eq('page_id', page.id).then((r: any) => ({ data: r.count, error: r.error })));
    if (count >= 3000) throw v.fail(413, '글은 3000개까지 올릴 수 있어요.');
    saved = await q(db.from('fp_posts').insert(row).select('*').single());
  }
  return json({ post: postOut(saved) });
}
async function deletePost(req: Request, o: Owner) {
  const page = needPage(o);
  const b = await body(req);
  const post = await q(db.from('fp_posts').delete().eq('id', v.uuid(b.id, '글')).eq('page_id', page.id).select('photos').maybeSingle());
  if (!post) throw v.fail(404, '글을 찾을 수 없어요.');
  const paths = (post.photos || []).flatMap((p: any) => [p.path, p.thumb]);
  const others = await q(db.from('fp_posts').select('photos').eq('page_id', page.id));
  const stillUsed = JSON.stringify([page.draft?.profile, page.published?.profile, others.map((x: any) => x.photos)]);
  await dropPhotos(page.id, paths.filter((p: string) => !stillUsed.includes(p)));
  return json({ ok: true });
}
async function ownerPosts(url: URL, o: Owner) {
  const page = needPage(o);
  const menu = v.menuOf(page.draft, url.searchParams.get('menu'), v.POST_FORMS);
  const before = v.before(url.searchParams.get('before'));
  let qq = db.from('fp_posts').select('*').eq('page_id', page.id).eq('menu_id', menu.id);
  if (before) qq = qq.lt('created', before);
  const rows = await q(qq.order('created', { ascending: false }).limit(31));
  return json({ posts: rows.slice(0, 30).map(postOut), more: rows.length > 30 });
}
async function ownerComments(url: URL, o: Owner) {
  const page = needPage(o);
  const before = v.before(url.searchParams.get('before'));
  const menu = url.searchParams.get('menu');
  let qq = db.from('fp_comments').select('*').eq('page_id', page.id);
  if (menu) qq = qq.eq('menu_id', menu);
  if (before) qq = qq.lt('created', before);
  const rows = await q(qq.order('created', { ascending: false }).limit(31));
  return json({ comments: rows.slice(0, 30).map((c: any) => commentOut(c, true)), more: rows.length > 30 });
}
async function ownerComment(req: Request, o: Owner, action: 'edit' | 'delete' | 'block') {
  const page = needPage(o);
  const b = await body(req);
  const id = v.uuid(action === 'block' ? b.comment : b.id, '댓글');
  const c = await q(db.from('fp_comments').select('*').eq('id', id).eq('page_id', page.id).maybeSingle());
  if (!c) throw v.fail(404, '댓글을 찾을 수 없어요.');
  if (action === 'delete') { await q(db.from('fp_comments').delete().eq('id', id)); return json({ ok: true }); }
  if (action === 'block') {
    const keys = ['nick:' + c.nickname.toLowerCase(), ...(c.ip_hash ? ['ip:' + c.ip_hash] : []), ...(c.fan ? ['fan:' + c.fan] : [])];
    await q(db.from('fp_blocks').upsert(keys.map(key => ({ page_id: page.id, key })), { ignoreDuplicates: true }));
    await q(db.from('fp_comments').update({ hidden: true }).eq('id', id));
    return json({ ok: true });
  }
  const patch: Record<string, unknown> = {};
  if (typeof b.hearted === 'boolean') patch.hearted = b.hearted;
  if (typeof b.hidden === 'boolean') patch.hidden = b.hidden;
  if (b.reply !== undefined) { const r = v.text(b.reply, 200, { lines: true, label: '답글' }); patch.reply = r || null; patch.replied_at = r ? new Date().toISOString() : null; }
  const row = await q(db.from('fp_comments').update(patch).eq('id', id).select('*').single());
  return json({ comment: commentOut(row, true) });
}
async function ownerPoll(req: Request, o: Owner, close: boolean) {
  const page = needPage(o);
  const b = await body(req);
  const menu = v.menuOf(page.draft, b.menu, ['poll']);
  await q(db.from('fp_polls').update({ closed: true }).eq('page_id', page.id).eq('menu_id', menu.id).eq('closed', false));
  if (close) return json({ ok: true });
  const options = Array.isArray(b.options) ? b.options.map((x: unknown) => v.text(x, 40, { required: true, label: '선택지' })) : [];
  if (options.length < 2 || options.length > 6) throw v.fail(400, '선택지는 2~6개로 정해 주세요.');
  const row = await q(db.from('fp_polls').insert({ page_id: page.id, menu_id: menu.id, question: v.text(b.question, 80, { required: true, label: '투표 질문' }), description: v.text(b.description, 200, { lines: true, label: '투표 설명' }), options }).select('id').single());
  return json({ poll: await q(db.rpc('fp_poll_view', { p_poll: row.id, p_fan: '' })) });
}
async function ownerAttendance(url: URL, o: Owner) {
  const page = needPage(o);
  const menu = v.menuOf(page.draft, url.searchParams.get('menu'), ['attendance']);
  const cards = await q(db.from('fp_cards').select('id,nickname,created,fp_stamps(day)').eq('page_id', page.id).eq('menu_id', menu.id).limit(2000));
  const month = v.koreaDay().slice(0, 7);
  const rewards = menu.options?.rewards || [];
  return json({ cards: cards.map((c: any) => { const days = (c.fp_stamps || []).map((s: any) => s.day).sort(); return { nickname: c.nickname, total: days.length, monthCount: days.filter((d: string) => d.startsWith(month)).length, last: days.at(-1) || null, rewards: rewards.filter((r: any) => r.at <= days.length).map((r: any) => r.label) }; }).sort((a: any, b: any) => b.total - a.total) });
}

// ---------- JUN LIVE app (device-signed) ----------
async function app(req: Request) {
  const b = await body(req);
  const now = Date.now();
  if (!['login', 'sync', 'storybox', 'stories', 'story_delete'].includes(b.action) || !Number.isSafeInteger(b.timestamp) || Math.abs(now - b.timestamp) > 60000 || !/^[-_A-Za-z0-9]{32}$/.test(b.nonce) || !/^[-_A-Za-z0-9]{122}$/.test(b.publicKey) || !/^[-_A-Za-z0-9]{86}$/.test(b.signature)) throw v.fail(400, '요청이 만료되었거나 올바르지 않아요. PC 시간을 확인해 주세요.');
  const message = `JUN-LIVE-FANPAGE/1\n${b.action}\n${b.timestamp}\n${b.nonce}\n${b.publicKey}\n${await sha(JSON.stringify(b.payload ?? null))}`;
  let valid = false;
  try { const key = await crypto.subtle.importKey('spki', decode64url(b.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']); valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, decode64url(b.signature), enc.encode(message)); } catch { /* bad key */ }
  if (!valid) throw v.fail(403, '기기 확인에 실패했어요.');
  const device = await sha(decode64url(b.publicKey));
  await limit(`d:${device}`, 60, 20);
  const { error } = await db.from('junlive_access_nonces').insert({ id: 'fp:' + device + ':' + b.nonce, expires: now + 120000 });
  if (error) throw v.fail(409, '이미 처리한 요청이에요.');
  if (Math.random() < 0.05) later(db.from('junlive_access_nonces').delete().lt('expires', now));
  const dev = await q(db.from('junlive_devices').select('state').eq('id', device).maybeSingle());
  if (dev?.state !== 'approved') throw v.fail(403, 'JUN LIVE 사용 승인을 먼저 받아 주세요.');
  const link = await q(db.from('fp_page_devices').select('page_id').eq('device_id', device).maybeSingle());
  if (b.action === 'login') {
    const s = b.payload?.spoon || {};
    const spoon = { id: /^\d{1,20}$/.test(String(s.id ?? '')) ? String(s.id) : '', tag: v.text(s.tag, 40, { label: '고유닉' }), nickname: v.text(s.nickname, 40, { label: '닉네임' }) };
    const code = token();
    await q(db.from('fp_codes').insert({ code_hash: await sha(code), device_id: device, spoon, expires: new Date(now + 180000).toISOString() }));
    if (link) await q(db.from('fp_pages').update({ spoon }).eq('id', link.page_id));
    return json({ code, url: SITE + 'studio#code=' + code });
  }
  if (!link) return json({ ok: false });
  if (b.action === 'storybox') {
    const open = b.payload?.open === true;
    // 주제를 안 보내면(채팅 !사연) 저장해 둔 주제를 그대로 둔다.
    const existing = b.payload?.note === undefined ? await q(db.from('fp_storybox').select('note').eq('page_id', link.page_id).maybeSingle()) : null;
    const note = b.payload?.note === undefined ? (existing?.note || '') : v.text(b.payload?.note, 80, { label: '사연 주제' });
    await q(db.from('fp_storybox').upsert({ page_id: link.page_id, open, note, updated: new Date().toISOString() }));
    const page = await q(db.from('fp_pages').select('slug,published').eq('id', link.page_id).single());
    return json({ ok: true, open, note, url: page.published ? SITE + 'p/' + page.slug + '/story' : null });
  }
  if (b.action === 'stories') {
    later(cleanStories(link.page_id));
    const box = await q(db.from('fp_storybox').select('open,note').eq('page_id', link.page_id).maybeSingle());
    const page = await q(db.from('fp_pages').select('slug,published').eq('id', link.page_id).single());
    const rows = await q(db.from('fp_stories').select('*').eq('page_id', link.page_id).order('created', { ascending: false }).limit(200));
    return json({ ok: true, open: Boolean(box?.open), note: box?.note || '', url: page.published ? SITE + 'p/' + page.slug + '/story' : null, stories: rows.map(storyOut) });
  }
  if (b.action === 'story_delete') {
    const id = v.uuid(b.payload?.id, '사연');
    const row = await q(db.from('fp_stories').delete().eq('id', id).eq('page_id', link.page_id).select('photo').maybeSingle());
    if (row?.photo) await dropPhotos(link.page_id, [row.photo.path, row.photo.thumb]);
    return json({ ok: true });
  }
  const live = b.payload?.live || {};
  // 스푼 답변(2026-10-02 1-나): 순위를 개발사 서버에 저장·공개하지 않는다. 예전 판이 보내도 받지 않는다.
  await q(db.from('fp_live').upsert({ page_id: link.page_id, on_air: live.on === true, title: v.text(live.title, 80, { label: '방송 제목' }), rankings: null, updated: new Date().toISOString() }));
  const page = await q(db.from('fp_pages').select('slug,published').eq('id', link.page_id).single());
  return json({ ok: true, slug: page.slug, url: page.published ? SITE + 'p/' + page.slug : null });
}

// ---------- service admin ----------
async function admin(req: Request) {
  const given = req.headers.get('x-junlive-admin') || '';
  const stored = await q(db.rpc('junlive_admin_token_hash', {}));
  const actual = given.length >= 32 ? await sha(given) : '';
  let diff = actual.length === 64 && typeof stored === 'string' && stored.length === 64 ? 0 : 1;
  for (let i = 0; i < 64; i++) diff |= (actual.charCodeAt(i) || 0) ^ (typeof stored === 'string' ? stored.charCodeAt(i) || 0 : 0);
  if (diff) throw v.fail(403, '관리자 키가 맞지 않아요.');
}

async function handle(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  try {
    const url = new URL(req.url);
    const route = url.pathname.replace(/^\/(functions\/v1\/)?fanpage\/?/, '').replace(/\/$/, '');
    const G = req.method === 'GET', P = req.method === 'POST';
    if (G && route === 'health') return json({ service: 'jun-live-fanpage', v: 6 });
    if (G && route === 'storybox') return await getStorybox(url);
    if (P && route === 'story') return await postStory(req);
    if (G && route === 'page') return await getPage(url);
    if (G && route === 'home') return await getHome(url);
    if (G && route === 'posts') return await getPosts(url);
    if (G && route === 'post') return await getPost(url);
    if (G && route === 'comments') return await getComments(url);
    if (G && route === 'poll') return await getPoll(url);
    if (P && route === 'comment') return await postComment(req);
    if (P && route === 'like') return await postLike(req);
    if (P && route === 'attendance') return await postAttendance(req);
    if (P && route === 'vote') return await postVote(req);
    if (P && route === 'app') return await app(req);
    if (P && route === 'owner/exchange') return await exchange(req);
    if (route.startsWith('owner/')) {
      const o = await owner(req);
      if (G && route === 'owner/page') return json({ page: pageOut(o.page), spoon: { nickname: o.spoon?.nickname || '', tag: o.spoon?.tag || '' } });
      if (P && route === 'owner/page') return await savePage(req, o);
      if (P && route === 'owner/publish') return await publish(o, true);
      if (P && route === 'owner/unpublish') return await publish(o, false);
      if (P && route === 'owner/photo') return await uploadPhoto(req, o);
      if (G && route === 'owner/posts') return await ownerPosts(url, o);
      if (P && route === 'owner/post') return await savePost(req, o);
      if (P && route === 'owner/post/delete') return await deletePost(req, o);
      if (G && route === 'owner/comments') return await ownerComments(url, o);
      if (P && route === 'owner/comment') return await ownerComment(req, o, 'edit');
      if (P && route === 'owner/comment/delete') return await ownerComment(req, o, 'delete');
      if (P && route === 'owner/block') return await ownerComment(req, o, 'block');
      if (P && route === 'owner/poll') return await ownerPoll(req, o, false);
      if (P && route === 'owner/poll/close') return await ownerPoll(req, o, true);
      if (G && route === 'owner/attendance') return await ownerAttendance(url, o);
      if (G && route === 'owner/poll') {
        const page = needPage(o), menu = v.menuOf(page.draft, url.searchParams.get('menu'), ['poll']);
        const latest = await q(db.from('fp_polls').select('id').eq('page_id', page.id).eq('menu_id', menu.id).order('created', { ascending: false }).limit(1));
        return json({ poll: latest.length ? await q(db.rpc('fp_poll_view', { p_poll: latest[0].id, p_fan: '' })) : null });
      }
      if (P && route === 'owner/logout') { await q(db.from('fp_sessions').delete().eq('token_hash', o.tokenHash)); return json({ ok: true }); }
    }
    if (route.startsWith('admin/')) {
      await admin(req);
      if (G && route === 'admin/pages') {
        const qs = (url.searchParams.get('q') || '').trim().slice(0, 40);
        let qq = db.from('fp_pages').select('id,slug,blocked,published_at,photo_bytes,spoon,updated,fp_page_devices(device_id)');
        if (qs) qq = qq.ilike('slug', `%${qs.replace(/[%_]/g, '')}%`);
        return json({ pages: await q(qq.order('updated', { ascending: false }).limit(200)) });
      }
      if (P && route === 'admin/page') {
        const b = await body(req); const id = v.uuid(b.id, '페이지');
        if (typeof b.blocked === 'boolean') await q(db.from('fp_pages').update({ blocked: b.blocked }).eq('id', id));
        if (b.linkCode !== undefined) {
          // A DJ on a new PC tells the owner the request code JUN LIVE shows.
          const code = typeof b.linkCode === 'string' ? b.linkCode.trim().toUpperCase() : '';
          if (!/^[0-9A-F]{4}(-[0-9A-F]{4}){5}$/.test(code)) throw v.fail(400, '요청 코드(XXXX-XXXX-…)를 확인해 주세요.');
          const dev = await q(db.from('junlive_devices').select('id,state').eq('code', code).maybeSingle());
          if (!dev || dev.state !== 'approved') throw v.fail(404, '승인된 PC의 요청 코드가 아니에요.');
          await q(db.from('fp_page_devices').upsert({ device_id: dev.id, page_id: id }));
        }
        return json({ ok: true });
      }
    }
    return json({ error: '찾을 수 없어요.' }, 404);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (!status) console.error(error);
    return json({ error: status ? (error as Error).message : '잠시 문제가 생겼어요. 조금 뒤에 다시 시도해 주세요.' }, status || 503);
  }
}

Deno.serve(handle);
