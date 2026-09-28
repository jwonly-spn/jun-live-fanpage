import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBase, stripBase, parseRoute, buildPath, readCodeFromHash } from '../docs/lib/route.js';

const B = '/jun-live-fanpage/';

test('BASE는 app.js가 있는 폴더', () => {
  assert.equal(computeBase('/jun-live-fanpage/app.js'), B);
  assert.equal(computeBase('/app.js'), '/');
});

test('BASE 떼기', () => {
  assert.equal(stripBase('/jun-live-fanpage/p/haru', B), 'p/haru');
  assert.equal(stripBase('/jun-live-fanpage', B), '');
  assert.equal(stripBase('/jun-live-fanpage/', B), '');
  assert.equal(stripBase('/p/haru/', '/'), 'p/haru');
  assert.equal(stripBase('/p/haru', B), 'p/haru', 'BASE가 없는 주소(로컬)도 그대로 읽기');
});

test('주소 해석', () => {
  assert.deepEqual(parseRoute('/jun-live-fanpage/', B), { name: 'intro' });
  assert.deepEqual(parseRoute('/jun-live-fanpage/index.html', B), { name: 'intro' });
  assert.deepEqual(parseRoute('/jun-live-fanpage/studio', B), { name: 'studio' });
  assert.deepEqual(parseRoute('/jun-live-fanpage/p/haru', B), { name: 'fan', slug: 'haru' });
  assert.deepEqual(parseRoute('/jun-live-fanpage/p/haru/', B), { name: 'fan', slug: 'haru' });
  assert.deepEqual(parseRoute('/jun-live-fanpage/p/haru/m_x8k2', B), { name: 'fan', slug: 'haru', menuId: 'm_x8k2' });
  assert.deepEqual(parseRoute('/jun-live-fanpage/p/haru/post/p_abc-12', B), { name: 'fan', slug: 'haru', postId: 'p_abc-12' });
  assert.deepEqual(parseRoute('/p/my-dj-01', '/'), { name: 'fan', slug: 'my-dj-01' });
});

test('이상한 주소는 notfound', () => {
  for (const p of ['/jun-live-fanpage/p/HA', '/jun-live-fanpage/p/ha', '/jun-live-fanpage/p/haru/M-X', '/jun-live-fanpage/p/haru/post/a/b', '/jun-live-fanpage/p/haru/post/a%20b','/jun-live-fanpage/xyz', '/jun-live-fanpage/studio/x', '/jun-live-fanpage/p/%E0%A4%A']) {
    assert.equal(parseRoute(p, B).name, 'notfound', p);
  }
});

test('주소 만들기와 다시 읽기', () => {
  const routes = [{ name: 'intro' }, { name: 'studio' }, { name: 'fan', slug: 'haru' }, { name: 'fan', slug: 'haru', menuId: 'm_1a' }, { name: 'fan', slug: 'haru', postId: 'p_9' }];
  for (const r of routes) {
    const path = buildPath(B, r);
    assert.ok(path.startsWith(B));
    assert.deepEqual(parseRoute(path, B), r);
    assert.deepEqual(parseRoute(buildPath('/', r), '/'), r);
  }
});

test('studio#code= 읽기', () => {
  assert.equal(readCodeFromHash('#code=abc123XYZ'), 'abc123XYZ');
  assert.equal(readCodeFromHash('#x=1&code=abcd-_.~'), 'abcd-_.~');
  assert.equal(readCodeFromHash('#code=<script>'), null);
  assert.equal(readCodeFromHash(''), null);
});
