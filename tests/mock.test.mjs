// 체험 모드 가짜 서버가 API.md 모양대로 답하는지 + 모든 모듈이 문법 오류 없이 읽히는지
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { handle, resetDemo } from '../docs/mock.js';

const call = (m, p, q = {}, b, token) => handle(m, p, q, b, token);

test('공개 API 모양', async () => {
  resetDemo();
  const pg = await call('GET', 'page', { slug: 'haru' });
  assert.equal(pg.status, 200);
  const { page, live, rankings } = pg.json;
  assert.ok(page.id && page.slug === 'haru' && page.config.menus.length);
  assert.equal(typeof live.on, 'boolean');
  assert.ok(Array.isArray(rankings.support.week) && !('amount' in rankings.support.week[0]));
  assert.equal((await call('GET', 'page', { slug: 'nobody' })).status, 404);

  const home = (await call('GET', 'home', { page: page.id })).json;
  assert.ok(home.menus && Array.isArray(home.comments) && home.comments.length <= 4 && Array.isArray(home.pinned));
  for (const list of Object.values(home.menus)) assert.ok(list.length <= 3);

  const first = (await call('GET', 'posts', { page: page.id, menu: 'm_album' })).json;
  assert.equal(first.posts.length, 20); assert.equal(first.more, true);
  assert.equal(first.posts[0].pinned, true, '고정 글 먼저');
  const p = first.posts[0];
  for (const k of ['id', 'menu', 'title', 'body', 'photos', 'category', 'pinned', 'supporter', 'eventDate', 'likes', 'comments', 'created']) assert.ok(k in p, k);
  for (const ph of p.photos) assert.ok(ph.w > 0 && ph.h > 0 && ph.path && ph.thumb);
  const before = first.posts.filter((x) => !x.pinned).at(-1).created;
  const second = (await call('GET', 'posts', { page: page.id, menu: 'm_album', before })).json;
  assert.equal(second.more, false);
  assert.equal(new Set([...first.posts, ...second.posts].map((x) => x.id)).size, 26, '겹치지 않고 모두');
});

test('댓글·좋아요·출석·투표', async () => {
  resetDemo();
  const page = 'pg_demo';
  const c = await call('POST', 'comment', {}, { page, menu: 'm_lounge', nickname: '테스트', body: '안녕하세요', fan: 'f1' });
  assert.equal(c.status, 200); assert.equal(c.json.comment.hearted, false); assert.equal(c.json.comment.reply, null);
  assert.equal((await call('POST', 'comment', {}, { page, menu: 'm_lounge', nickname: '', body: 'x', fan: 'f1' })).status, 400);
  assert.equal((await call('POST', 'comment', {}, { page, menu: 'm_lounge', nickname: 'a', body: 'x'.repeat(201), fan: 'f1' })).status, 400);
  for (let i = 0; i < 4; i++) await call('POST', 'comment', {}, { page, menu: 'm_lounge', nickname: 'a', body: 'b', fan: 'f1' });
  assert.equal((await call('POST', 'comment', {}, { page, menu: 'm_lounge', nickname: 'a', body: 'b', fan: 'f1' })).status, 429, '10분에 5개');

  const post = (await call('GET', 'posts', { page, menu: 'm_archive' })).json.posts[0];
  const l1 = (await call('POST', 'like', {}, { post: post.id, fan: 'f1' })).json;
  assert.equal(l1.liked, true); assert.equal(l1.likes, post.likes + 1);
  const l2 = (await call('POST', 'like', {}, { post: post.id, fan: 'f1' })).json;
  assert.equal(l2.liked, false); assert.equal(l2.likes, post.likes);

  const att = (b) => call('POST', 'attendance', {}, { page, menu: 'm_attend', ...b });
  const made = await att({ nickname: '새팬', pin: '0000', action: 'create' });
  assert.equal(made.status, 200); assert.equal(made.json.card.total, 0); assert.deepEqual(made.json.card.next, { at: 7, label: '복권 1장' });
  assert.equal((await att({ nickname: '새팬', pin: '0000', action: 'create' })).status, 409);
  const checked = (await att({ nickname: '새팬', pin: '0000', action: 'check' })).json.card;
  assert.equal(checked.today, true); assert.equal(checked.total, 1); assert.equal(checked.month.length, 1);
  assert.equal((await att({ nickname: '새팬', pin: '0000', action: 'check' })).json.card.total, 1, '하루 한 번');
  for (let i = 0; i < 5; i++) assert.equal((await att({ nickname: '새팬', pin: '1111', action: 'load' })).status, 403);
  assert.equal((await att({ nickname: '새팬', pin: '0000', action: 'load' })).status, 429, '5번 틀리면 잠금');
  assert.equal((await att({ nickname: '새팬', pin: '12a4', action: 'load' })).status, 400);

  const poll = (await call('GET', 'poll', { page, menu: 'm_poll', fan: 'f9' })).json.poll;
  assert.equal(poll.voted, null); assert.equal(poll.total, 5);
  const v = (await call('POST', 'vote', {}, { poll: poll.id, option: 1, fan: 'f9' })).json.poll;
  assert.equal(v.voted, 1); assert.equal(v.total, 6);
  const v2 = (await call('POST', 'vote', {}, { poll: poll.id, option: 2, fan: 'f9' })).json.poll;
  assert.equal(v2.voted, 2); assert.equal(v2.total, 6, '바꾸기');
});

test('DJ API: 저장 revision, 공개, 투표, 댓글 관리', async () => {
  resetDemo();
  assert.equal((await call('GET', 'owner/page')).status, 401);
  const ex = (await call('POST', 'owner/exchange', {}, { code: 'abc' })).json;
  const T = ex.token;
  assert.ok(T && ex.expires && ex.page.slug === 'haru');
  const own = (await call('GET', 'owner/page', {}, undefined, T)).json;
  const draft = own.page.draft;
  draft.profile.name = '하루하루';
  const saved = await call('POST', 'owner/page', {}, { draft, revision: own.page.revision }, T);
  assert.equal(saved.status, 200); assert.equal(saved.json.page.revision, own.page.revision + 1);
  assert.equal((await call('POST', 'owner/page', {}, { draft, revision: own.page.revision }, T)).status, 409, '예전 revision');
  draft.profile.name = '';
  assert.equal((await call('POST', 'owner/page', {}, { draft, revision: saved.json.page.revision }, T)).status, 400);
  const pub = (await call('POST', 'owner/publish', {}, {}, T)).json.page;
  assert.equal(pub.published.profile.name, '하루하루');
  await call('POST', 'owner/unpublish', {}, {}, T);
  assert.equal((await call('GET', 'page', { slug: 'haru' })).status, 404);

  const np = (await call('POST', 'owner/poll', {}, { menu: 'm_poll', question: '새 질문', description: '', options: ['가', '나'] }, T));
  assert.equal(np.status, 200); assert.equal(np.json.poll.options.length, 2);
  assert.equal((await call('POST', 'owner/poll', {}, { menu: 'm_poll', question: 'q', options: ['하나'] }, T)).status, 400);

  const cm = (await call('GET', 'owner/comments', { menu: 'm_lounge' }, undefined, T)).json;
  assert.ok('hidden' in cm.comments[0] && 'ipBlocked' in cm.comments[0]);
  const upd = (await call('POST', 'owner/comment', {}, { id: cm.comments[0].id, hearted: true, reply: '고마워요', hidden: true }, T)).json.comment;
  assert.equal(upd.hearted, true); assert.equal(upd.reply, '고마워요'); assert.equal(upd.hidden, true);
  assert.equal((await call('POST', 'owner/block', {}, { comment: cm.comments[1].id }, T)).status, 200);

  const att = (await call('GET', 'owner/attendance', { menu: 'm_attend' }, undefined, T)).json;
  assert.ok(att.cards.every((c) => 'nickname' in c && 'total' in c && 'monthCount' in c && Array.isArray(c.rewards)));

  // 새 DJ: 주소 만들기
  const N = (await call('POST', 'owner/exchange', {}, { code: 'newdj' })).json.token;
  assert.equal((await call('GET', 'owner/page', {}, undefined, N)).json.page, null);
  const cfg = draft; cfg.profile.name = '새벽달';
  assert.equal((await call('POST', 'owner/page', {}, { slug: 'studio', draft: cfg, revision: 0 }, N)).status, 400);
  assert.equal((await call('POST', 'owner/page', {}, { slug: 'haru', draft: cfg, revision: 0 }, N)).status, 409);
  const created = (await call('POST', 'owner/page', {}, { slug: 'saebyeok', draft: cfg, revision: 0 }, N)).json.page;
  assert.equal(created.slug, 'saebyeok'); assert.equal(created.revision, 1);
});

test('모든 화면 모듈을 문법 오류 없이 읽음', async () => {
  const docs = fileURLToPath(new URL('../docs/', import.meta.url));
  for (const dir of ['lib', 'views']) {
    for (const f of (await readdir(docs + dir)).filter((x) => x.endsWith('.js'))) await import(`../docs/${dir}/${f}`);
  }
  await import('../docs/api.js');
  const r = spawnSync(process.execPath, ['--check', docs + 'app.js'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});
