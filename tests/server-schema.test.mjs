// schema.sql in an in-memory Postgres (PGlite). PGLITE_ENTRY = path to @electric-sql/pglite dist/index.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL, fileURLToPath} from 'node:url';

const {PGlite} = await import(pathToFileURL(process.env.PGLITE_ENTRY).href);
const sql = fs.readFileSync(fileURLToPath(new URL('../supabase/schema.sql', import.meta.url)), 'utf8');

async function fresh() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;`);
  await db.exec(sql);
  const page = (await db.query(`insert into fp_pages(slug, draft) values ('haru', '{}'::jsonb) returning id`)).rows[0].id;
  const one = async (text, params) => (await db.query(text, params)).rows[0];
  return {db, page, one};
}

test('attendance: create, check once a day, wrong PINs lock the card', async () => {
  const {page, one} = await fresh();
  const call = (pin, action, nick = '별빛') => one(`select fp_attendance($1,'att',$2,$3,$4) r`, [page, nick, pin, action]).then(x => x.r);
  const made = await call('h1', 'create');
  assert.equal(made.total, 0);
  assert.deepEqual(await call('h1', 'create'), {error: 'exists'});
  const checked = await call('h1', 'check');
  assert.equal(checked.total, 1);
  assert.equal(checked.today, true);
  assert.equal(checked.month.length, 1);
  assert.equal((await call('h1', 'check')).total, 1, 'one stamp per day');
  for (let i = 0; i < 5; i++) assert.deepEqual(await call('bad', 'load'), {error: 'pin'});
  assert.deepEqual(await call('h1', 'load'), {error: 'locked'});
  assert.deepEqual(await call('h1', 'load', '없는사람'), {error: 'missing'});
});

test('likes toggle and comment counts follow inserts and deletes', async () => {
  const {db, page, one} = await fresh();
  const post = (await one(`insert into fp_posts(page_id, menu_id) values ($1,'m') returning id`, [page])).id;
  assert.deepEqual((await one(`select fp_like($1,'fan-aaaaaaaa') r`, [post])).r, {likes: 1, liked: true});
  assert.deepEqual((await one(`select fp_like($1,'fan-bbbbbbbb') r`, [post])).r, {likes: 2, liked: true});
  assert.deepEqual((await one(`select fp_like($1,'fan-aaaaaaaa') r`, [post])).r, {likes: 1, liked: false});
  const c = (await one(`insert into fp_comments(page_id, menu_id, post_id, nickname, body) values ($1,'m',$2,'별','안녕') returning id`, [page, post])).id;
  assert.equal((await one(`select comment_count from fp_posts where id=$1`, [post])).comment_count, 1);
  await db.query(`delete from fp_comments where id=$1`, [c]);
  assert.equal((await one(`select comment_count from fp_posts where id=$1`, [post])).comment_count, 0);
});

test('polls: one vote per fan, can change, closed polls refuse', async () => {
  const {db, page, one} = await fresh();
  const poll = (await one(`insert into fp_polls(page_id, menu_id, question, options) values ($1,'p','질문','["가","나"]') returning id`, [page])).id;
  assert.equal((await one(`select fp_vote($1,'fan-aaaaaaaa',0,'') r`, [poll])).r, true);
  assert.equal((await one(`select fp_vote($1,'fan-aaaaaaaa',1,'') r`, [poll])).r, true);
  assert.equal((await one(`select fp_vote($1,'fan-bbbbbbbb',1,'') r`, [poll])).r, true);
  assert.equal((await one(`select fp_vote($1,'fan-bbbbbbbb',5,'') r`, [poll])).r, false);
  const view = (await one(`select fp_poll_view($1,'fan-aaaaaaaa') r`, [poll])).r;
  assert.deepEqual(view.options, [{label: '가', votes: 0}, {label: '나', votes: 2}]);
  assert.equal(view.total, 2);
  assert.equal(view.voted, 1);
  await db.query(`update fp_polls set closed=true where id=$1`, [poll]);
  assert.equal((await one(`select fp_vote($1,'fan-cccccccc',0,'') r`, [poll])).r, false);
});

test('draft saves only on the expected revision', async () => {
  const {page, one} = await fresh();
  assert.equal((await one(`select fp_save_draft($1,'{"a":1}',0) r`, [page])).r, 1);
  assert.equal((await one(`select fp_save_draft($1,'{"a":2}',0) r`, [page])).r, null);
});

test('orphan photos: only old files nothing refers to', async () => {
  const {db, page} = await fresh();
  const p = n => `${page}/${n}`;
  await db.query(`update fp_pages set draft = jsonb_build_object('profile', jsonb_build_object('avatar', jsonb_build_object('path',$2::text,'thumb',$3::text))) where id=$1`, [page, p('a.jpg'), p('a_t.jpg')]);
  await db.query(`insert into fp_posts(page_id, menu_id, photos) values ($1,'m', jsonb_build_array(jsonb_build_object('path',$2::text,'thumb',$3::text)))`, [page, p('b.jpg'), p('b_t.jpg')]);
  for (const n of ['a.jpg', 'a_t.jpg', 'b.jpg', 'b_t.jpg', 'old.jpg']) await db.query(`insert into fp_photos(path,page_id,bytes,created) values ($1,$2,10, now() - interval '2 days')`, [p(n), page]);
  await db.query(`insert into fp_photos(path,page_id,bytes) values ($1,$2,10)`, [p('new.jpg'), page]);
  const rows = (await db.query(`select fp_orphan_photos($1) r`, [page])).rows.map(r => r.r);
  assert.deepEqual(rows, [p('old.jpg')]);
});

test('photo bytes are reserved atomically per page and for the whole service', async () => {
  const {page, one} = await fresh();
  const add = (n, quota = 100, total = 150) => one(`select fp_add_bytes($1,$2,$3,$4) r`, [page, n, quota, total]).then(x => x.r);
  assert.equal(await add(60), 'ok');
  assert.equal(await add(50), 'page');
  assert.equal(await add(40), 'ok');
  assert.equal(await add(10, 1000, 100), 'total');
  assert.equal(await add(-500), 'ok');
  assert.equal((await one(`select photo_bytes from fp_pages where id=$1`, [page])).photo_bytes, 0);
});

test('anon and signed-in roles cannot read tables or call functions', async () => {
  const {db, page} = await fresh();
  await db.exec(`set role anon`);
  await assert.rejects(() => db.query(`select * from fp_pages`));
  await assert.rejects(() => db.query(`select fp_like($1,'x')`, [page]));
  await db.exec(`reset role; set role authenticated`);
  await assert.rejects(() => db.query(`select * from fp_comments`));
});
