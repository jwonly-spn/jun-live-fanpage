// 팬페이지 서버(supabase/functions/fanpage)는 서비스를 마쳤다: health 만 200, 나머지는 모두 410(CORS 는 그대로).
import test from 'node:test';
import assert from 'node:assert/strict';
import { handle, CLOSED_MESSAGE } from '../supabase/functions/fanpage/index.ts';

const BASE = 'https://x.supabase.co/functions/v1/fanpage/';
const call = (path, init = {}) => handle(new Request(BASE + path, init));

test('health 는 닫힌 것을 알려 준다', async () => {
  const r = call('health');
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { service: 'jun-live-fanpage', closed: true });
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  assert.equal(call('health/').status, 200);
  assert.equal(handle(new Request('https://x.supabase.co/fanpage/health')).status, 200);
});

test('그 밖의 모든 길은 410 + 한국어 안내, CORS 유지', async () => {
  assert.equal(CLOSED_MESSAGE, '팬페이지 서비스를 마쳤어요.');
  const json = { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"action":"login"}' };
  for (const [path, init] of [['page?slug=haru', {}], ['home?page=x', {}], ['posts', {}], ['storybox?page=x', {}], ['comment', json], ['story', json], ['attendance', json],
    ['app', json], ['owner/exchange', json], ['owner/page', {}], ['admin/pages', {}], ['', {}], ['nothing', {}], ['health', { method: 'POST' }]]) {
    const r = call(path, init);
    assert.equal(r.status, 410, path);
    assert.deepEqual(await r.json(), { error: CLOSED_MESSAGE }, path);
    assert.equal(r.headers.get('access-control-allow-origin'), '*', path);
    assert.equal(r.headers.get('cache-control'), 'no-store', path);
  }
});

test('브라우저 사전 요청(OPTIONS)은 204 + CORS', () => {
  const r = call('comment', { method: 'OPTIONS' });
  assert.equal(r.status, 204);
  assert.match(r.headers.get('access-control-allow-methods'), /POST/);
});
