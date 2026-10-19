// DJ 키우기 서버 — 빠르게(2026-10-18 "사이트 반응을 빠르게"): 데이터베이스를 한꺼번에 묻기 + 미리 만든 답(공개 저장소 kg-snap).
//  메모리 store(tests/kiugi-world.mjs)로만 — 실제 서버·저장소에 닿지 않는다. 이름은 모두 지어낸 것.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PAYLOAD, PERSON, world, body, settle, TOKEN } from './kiugi-world.mjs';

test('올리면: 이 DJ 페이지의 미리 만든 답(page/<주소>.json)을 바로 쓰고, 메인(home.json)도 쓴다 · 답 그대로 + snapAt', async () => {
  const w = world(); const key = w.approve();
  const up = await w.upload(key, PAYLOAD());
  assert.equal(up.status, 200); await settle();
  const slug = up.json.slug, snap = w.store.snaps.get(`page/${slug}.json`);
  assert.ok(snap, '페이지 미리 만든 답');
  const live = await body(await w.get('page?slug=' + slug));
  const { snapAt, ...rest } = snap;
  assert.equal(snapAt, w.clock.now);
  assert.deepEqual(rest, live.json, '함수의 공개 답과 같은 내용');
  assert.doesNotMatch(JSON.stringify(snap), /device|people|"k"/, '기기 번호·전체 사람 목록·찾기 열쇠는 없다');
  const home = w.store.snaps.get('home.json');
  assert.ok(home && Array.isArray(home.djs) && home.djs.some((d) => d.slug === slug), '메인 미리 만든 답에 이 DJ');
});

test('보는 사람이 페이지·메인을 열면 미리 만든 답을 새로 쓰지만, 같은 파일은 15초에 한 번만', async () => {
  const w = world(); const key = w.approve();
  const { json: { slug } } = await w.upload(key, PAYLOAD()); await settle();
  const first = w.store.snaps.get(`page/${slug}.json`).snapAt;
  w.clock.now += 5000; await w.get('page?slug=' + slug); await settle();
  assert.equal(w.store.snaps.get(`page/${slug}.json`).snapAt, first, '15초 안에는 다시 쓰지 않는다');
  w.clock.now += 11000; await w.get('page?slug=' + slug); await settle();
  assert.equal(w.store.snaps.get(`page/${slug}.json`).snapAt, w.clock.now, '15초가 지나면 새로');
  w.clock.now += 16000; await w.get('home'); await settle();
  assert.equal(w.store.snaps.get('home.json').snapAt, w.clock.now);
});

test('끄면 미리 만든 페이지 답을 {closed:true} 로 덮는다 · 관리 화면에서 막힌 기기는 다음에 새로 쓸 때 closed', async () => {
  const w = world(); const key = w.approve();
  const { json: { slug } } = await w.upload(key, PAYLOAD()); await settle();
  await w.upload(key, { enabled: false, v: 2 }); await settle();
  assert.equal(w.store.snaps.get(`page/${slug}.json`).closed, true);
  // 다시 켜면 다시 내용
  await w.upload(key, PAYLOAD()); await settle();
  assert.equal(w.store.snaps.get(`page/${slug}.json`).slug, slug);
  // 기기가 막히면(관리 화면) 하트 뒤 새로 쓸 때 closed
  w.store.devices.set(key.id, { state: 'revoked', review: false });
  w.clock.now += 16000;
  const r = await w.heart(slug, '사탕요정#먼치', TOKEN(1));
  assert.equal(r.status, 404, '막힌 페이지에는 하트도 못 보낸다'); await settle();
});

test('하트를 보내면 미리 만든 페이지 답의 하트 수도 새로(15초에 한 번)', async () => {
  const w = world(); const key = w.approve();
  const { json: { slug } } = await w.upload(key, PAYLOAD([PERSON('사탕요정', 300), PERSON('밤톨', 200), PERSON('달무리', 100)])); await settle();
  w.clock.now += 16000;
  const h = await body(await w.heart(slug, '사탕요정#먼치', TOKEN(2)));
  assert.equal(h.json.hearts, 1); await settle();
  const top = w.store.snaps.get(`page/${slug}.json`).top;
  assert.equal(top.find((p) => p.id === '사탕요정#먼치').hearts, 1);
});

test('빠르게: 페이지·캐릭터·찾기는 한도·페이지·하트를 한꺼번에 묻는다(코드) · 메인은 페이지 목록과 하트 줄을 함께, 사람 목록도 한꺼번에 · health 에 snaps', async () => {
  const src = await readFile(new URL('../supabase/functions/kiugi/handler.ts', import.meta.url), 'utf8');
  assert.match(src, /Promise\.all\(\[limitBy\(req, tag, max, message\), read\(slug\), store\.heartRows\(\[slug\]\)\]\)/);
  assert.match(src, /Promise\.all\(\[mainPages\(false\), store\.topHearts\(200\)\]\)/);
  assert.match(src, /needSlugs\.map\(async \(slug\)/);
  const w = world();
  assert.equal((await body(await w.get('health'))).json.snaps, true);
  const index = await readFile(new URL('../supabase/functions/kiugi/index.ts', import.meta.url), 'utf8');
  assert.match(index, /storage\.from\('kg-snap'\)\.upload\(path, new Blob/);
  assert.match(index, /cacheControl: '60'/, '2026-10-20: 저장소 CDN·브라우저 캐시 60초(예전 5초)');
});

test('미리 만든 답 캐시와 사이트의 "오래된 파일" 기준이 맞는다: CDN 캐시 + 다시 쓰는 간격(15초)보다 길어야 캐시가 내준 파일 때문에 보는 사람마다 함수를 부르지 않는다', async () => {
  const index = await readFile(new URL('../supabase/functions/kiugi/index.ts', import.meta.url), 'utf8');
  const cdnSeconds = Number(/cacheControl: '(\d+)'/.exec(index)?.[1]);
  const handler = await readFile(new URL('../supabase/functions/kiugi/handler.ts', import.meta.url), 'utf8');
  const gapMs = Number(/snapGapMs \?\? (\d+)/.exec(handler)?.[1]);
  const { SNAP_STALE_MS, SNAP_USE_MS } = await import('../docs/api.js');
  assert.equal(cdnSeconds, 60); assert.equal(gapMs, 15000);
  assert.ok(SNAP_STALE_MS > cdnSeconds * 1000 + gapMs, `오래된 파일 기준 ${SNAP_STALE_MS}ms > 캐시 ${cdnSeconds}s + 간격 ${gapMs}ms`);
  assert.equal(SNAP_STALE_MS, 3 * 60e3);
  assert.ok(SNAP_STALE_MS < SNAP_USE_MS, '10분 넘은 파일은 쓰지 않는다(그대로)');
});

test('한도는 그대로: 1분에 60번 넘게 페이지를 열면 429', async () => {
  const w = world(); const key = w.approve();
  const { json: { slug } } = await w.upload(key, PAYLOAD());
  let last;
  for (let i = 0; i < 61; i++) last = await w.get('page?slug=' + slug, '9.9.9.9');
  assert.equal(last.status, 429);
});
