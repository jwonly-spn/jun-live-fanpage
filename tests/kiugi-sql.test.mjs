// DJ 키우기 SQL 마이그레이션 시험(2026-10-20) — 메모리 Postgres(PGlite)가 있을 때만 돈다: PGLITE_ENTRY = @electric-sql/pglite 의 dist/index.js 위치.
//  없으면 건너뛴다(server-schema.test.mjs 와 달리 멈추지 않는다). 실제 서버에는 닿지 않는다.
//  · 7칸 kg_heart(supabase/migrations/20261020_kiugi_heart_ip.sql): 같은 접속 주소 칸이 다 차면 세지 않는다 · 예전 6칸도 그대로 · anon 은 못 부른다
//  · 옛 함수 권한 거두기(supabase/migrations/20261020_revoke_legacy_definer.sql): 이름 목록의 함수(같은 이름 여럿 포함)만 anon·authenticated·public 에서 거둔다
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const entry = process.env.PGLITE_ENTRY;
const skip = entry ? false : 'PGLITE_ENTRY 가 없어 건너뜀(PGlite 위치를 주면 돈다)';
const sql = (p) => fs.readFileSync(fileURLToPath(new URL('../supabase/' + p, import.meta.url)), 'utf8');
const hex = (n) => n.toString(16).padStart(64, '0');
const arr = (list) => '{' + list.join(',') + '}';

async function fresh() {
  const { PGlite } = await import(pathToFileURL(entry).href);
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role;');
  for (const f of ['kiugi.sql', 'kiugi-stage2.sql', 'migrations/20261020_kiugi_heart_ip.sql']) await db.exec(sql(f));
  await db.query("insert into kg_pages(slug, device_id, created) values ('abcdefgh', $1, 0)", ['a'.repeat(64)]);
  return db;
}

test('7칸 kg_heart: 브라우저 열쇠 하루 한 번 + 같은 접속 주소 칸(3개)이 다 차면 세지 않는다 · 다른 주소 칸·빈 칸 목록은 예전처럼 · 6칸도 그대로', { skip }, async () => {
  const db = await fresh();
  const heart = async (vote, slots, pid = '밤톨#먼치') => (await db.query("select kg_heart($1, 9999999999999, 'abcdefgh', 's1', $2, 1, $3::text[]) r", [hex(vote), pid, arr(slots.map(hex))])).rows[0].r;
  const ipA = [101, 102, 103], ipB = [201, 202, 203];
  assert.deepEqual(await heart(1, ipA), { hearts: 1, already: false });
  assert.deepEqual(await heart(1, ipA), { hearts: 1, already: true }, '같은 브라우저 열쇠');
  assert.deepEqual(await heart(2, ipA), { hearts: 2, already: false });
  assert.deepEqual(await heart(3, ipA), { hearts: 3, already: false });
  assert.deepEqual(await heart(4, ipA), { hearts: 3, already: true }, '주소 칸 3개가 다 찼다');
  assert.deepEqual(await heart(4, ipB), { hearts: 4, already: false }, '막혔던 브라우저 열쇠는 다른 주소에서 센다');
  assert.deepEqual(await heart(5, []), { hearts: 5, already: false }, '칸 목록이 비면 주소 제한 없이');
  assert.deepEqual(await heart(6, [301, 302, 303], '달무리#먼치'), { hearts: 1, already: false }, '다른 캐릭터는 칸 열쇠가 다르다(함수가 캐릭터를 넣어 만든다)');
  assert.deepEqual(await heart(8, ipA, '달무리#먼치'), { hearts: 1, already: true }, '칸 열쇠가 차 있으면 어느 캐릭터든 세지 않는다(데이터베이스는 받은 열쇠만 본다)');
  const old = (await db.query("select kg_heart($1, 9999999999999, 'abcdefgh', 's1', '별사탕#먼치', 1) r", [hex(7)])).rows[0].r;
  assert.deepEqual(old, { hearts: 1, already: false }, '예전 6칸(함수 판 11)도 그대로 돈다');
  await db.exec('set role anon');
  await assert.rejects(() => db.query("select kg_heart($1, 9999999999999, 'abcdefgh', 's1', '밤톨#먼치', 1, '{}'::text[])", [hex(9)]));
  await db.exec('reset role');
});

test('옛 함수 권한 거두기: 이름 목록의 함수(같은 이름 여럿·인자 모양 상관없이)만 anon·authenticated 가 못 부르고, 다른 함수는 그대로 · 두 번 돌려도 된다', { skip }, async () => {
  const db = await fresh();
  await db.exec(`
    create function public.start_junlive_pairing(p text) returns int language sql security definer as 'select 1';
    create function public.has_junlive_access() returns boolean language sql security definer as 'select true';
    create function public.has_junlive_access(p uuid) returns boolean language sql security definer as 'select true';
    create function public.unused_photos(p_page uuid, p_days integer) returns setof text language sql security definer as 'select null::text where false';
    create function public.keep_me() returns int language sql security definer as 'select 1';
    grant execute on function public.start_junlive_pairing(text) to anon, authenticated;
    grant execute on function public.has_junlive_access() to anon;
    grant execute on function public.unused_photos(uuid, integer) to authenticated;
    grant execute on function public.keep_me() to anon;`);
  const can = async (role, sig) => (await db.query('select has_function_privilege($1, $2, $3) ok', [role, sig, 'execute'])).rows[0].ok;
  assert.equal(await can('anon', 'public.start_junlive_pairing(text)'), true);
  for (let i = 0; i < 2; i++) await db.exec(sql('migrations/20261020_revoke_legacy_definer.sql'));
  for (const sig of ['public.start_junlive_pairing(text)', 'public.has_junlive_access()', 'public.has_junlive_access(uuid)', 'public.unused_photos(uuid, integer)']) {
    for (const role of ['anon', 'authenticated']) assert.equal(await can(role, sig), false, `${role} ${sig}`);
  }
  assert.equal(await can('anon', 'public.keep_me()'), true, '목록에 없는 함수는 그대로');
  assert.equal(await can('service_role', 'public.kg_heart(text, bigint, text, text, text, bigint, text[])'), true, '지금 쓰는 kg_heart 는 그대로');
});
