import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { parseRoute, buildPath } from '../docs/lib/route.js';
import { accessText, b64url, codeOf, nonce, sha256hex } from '../docs/lib/device.js';
import { checkProfile, botStatusText } from '../docs/views/mobile.js';

test('/app 주소는 모바일 화면', () => {
  assert.deepEqual(parseRoute('/jun-live-fanpage/app', '/jun-live-fanpage/'), { name: 'mobile' });
  assert.equal(buildPath('/jun-live-fanpage/', { name: 'mobile' }), '/jun-live-fanpage/app');
  assert.equal(parseRoute('/jun-live-fanpage/app/x', '/jun-live-fanpage/').name, 'notfound');
});

test('가입 정보 검사는 승인 서버 규칙과 같다', () => {
  assert.deepEqual(checkProfile({ nickname: ' 준 ', tag: '@jun_live' }), { nickname: '준', tag: 'jun_live' });
  assert.ok(checkProfile({ nickname: '', tag: 'a' }).error);
  assert.ok(checkProfile({ nickname: '준', tag: 'a b' }).error);
  assert.ok(checkProfile({ nickname: '준', tag: 'x'.repeat(41) }).error);
});

test('휴대폰 서명은 서버가 검증하는 형식과 길이', async () => {
  const s = webcrypto.subtle;
  const pair = await s.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicKey = b64url(await s.exportKey('spki', pair.publicKey));
  const n = nonce();
  assert.match(publicKey, /^[-_A-Za-z0-9]{122}$/);
  assert.match(n, /^[-_A-Za-z0-9]{32}$/);
  const b = { timestamp: 1, nonce: n, publicKey, applicant: { nickname: '준', tag: 'jun' } };
  assert.equal(accessText(b), `JUN-LIVE-ACCESS/1\n1\n${n}\n${publicKey}\n{"nickname":"준","tag":"jun"}`);
  const sig = b64url(await s.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, new TextEncoder().encode(accessText(b))));
  assert.match(sig, /^[-_A-Za-z0-9]{86}$/);
  const id = await sha256hex(await s.exportKey('spki', pair.publicKey));
  assert.match(codeOf(id), /^([0-9A-F]{4}-){5}[0-9A-F]{4}$/);
});

test('봇 상태 문장', () => {
  assert.match(botStatusText({ status: { state: 'live' } }), /작동 중/);
  assert.match(botStatusText({ status: {} }), /자동으로 들어가요/);
  assert.equal(botStatusText({ status: { state: 'error', error: '봇 계정을 고정 매니저로' } }), '봇 계정을 고정 매니저로');
});