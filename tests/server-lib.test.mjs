import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from '../supabase/functions/fanpage/lib.ts';

const PAGE = '11111111-2222-3333-4444-555555555555';
const PH = {path: `${PAGE}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg`, thumb: `${PAGE}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee_t.jpg`, w: 1200, h: 1800};

test('config keeps known fields, fills option defaults and drops the rest', () => {
  const c = v.config({theme: 'nope', layout: 'photo', evil: 1, profile: {name: ' 하루 ', intro: 'a\n\n\n\nb', spoonUrl: 'https://www.spooncast.net/kr/channel/1', avatar: PH},
    menus: [{id: 'memories', name: '추억', form: 'photo_text', options: {categories: ['방송', '방송', '일상'], showOnHome: false, x: 1}}, {id: 'att', name: '출석', form: 'attendance', options: {rewards: [{at: 15, label: '복권'}, {at: 5, label: '룰렛'}]}}]}, PAGE);
  assert.equal(c.theme, 'rose');
  assert.equal(c.layout, 'photo');
  assert.equal(c.evil, undefined);
  assert.equal(c.profile.name, '하루');
  assert.equal(c.profile.intro, 'a\n\nb');
  assert.deepEqual(c.profile.avatar, PH);
  assert.deepEqual(c.menus[0].options, {allowComments: true, showOnHome: false, categories: ['방송', '일상']});
  assert.deepEqual(c.menus[1].options.rewards.map(r => r.at), [5, 15]);
});

test('config refuses bad input', () => {
  const base = {profile: {name: '하루'}, menus: []};
  assert.throws(() => v.config({...base, profile: {name: ''}}, PAGE), /활동 이름/);
  assert.throws(() => v.config({...base, profile: {name: '하루', spoonUrl: 'https://evil.example/'}}, PAGE), /스푼/);
  assert.throws(() => v.config({...base, profile: {name: '하루', spoonUrl: 'javascript:alert(1)'}}, PAGE));
  assert.throws(() => v.config({...base, profile: {name: '하루', avatar: {...PH, path: 'other-page/x.jpg'}}}, PAGE), /사진/);
  assert.throws(() => v.config({...base, menus: [{id: 'a1', name: 'x', form: 'shop'}]}, PAGE), /양식/);
  assert.throws(() => v.config({...base, menus: [{id: 'a1', name: 'x', form: 'board'}, {id: 'a1', name: 'y', form: 'board'}]}, PAGE), /메뉴 구성/);
  assert.throws(() => v.config({...base, menus: Array.from({length: 13}, (_, i) => ({id: 'm' + i, name: 'x', form: 'board'}))}, PAGE), /12개/);
  assert.throws(() => v.config({...base, menus: [{id: 'l1', name: 'x', form: 'links', options: {links: [{label: 'a', url: 'http://x.com'}]}}]}, PAGE), /https/);
});

test('slug rules', () => {
  assert.equal(v.slug(' Haru-1 '), 'haru-1');
  for (const bad of ['ab', 'studio', '-abc', 'abc-', 'a--b', '한글이', 'a'.repeat(31)]) assert.throws(() => v.slug(bad), bad);
});

test('starter config passes validation', () => {
  const c = v.config(v.starterConfig('별빛'), PAGE);
  assert.equal(c.profile.name, '별빛');
  assert.equal(c.menus.length, 5);
});

test('jpeg size reader and base64 limits', () => {
  // SOI, APP0 (len 16), SOF0 with h=300 w=200
  const app0 = [0xff, 0xe0, 0x00, 0x10, ...new Array(14).fill(0)];
  const sof = [0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x2c, 0x00, 0xc8, 0x03, ...new Array(9).fill(0)];
  const jpeg = new Uint8Array([0xff, 0xd8, ...app0, ...sof, 0xff, 0xd9]);
  assert.deepEqual(v.jpegSize(jpeg), {w: 200, h: 300});
  assert.equal(v.jpegSize(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), null);
  assert.equal(v.b64(Buffer.from('hello').toString('base64'), 100).length, 5);
  assert.throws(() => v.b64(Buffer.alloc(200).toString('base64'), 100), /너무 커요/);
  assert.throws(() => v.b64('not base64!', 100));
});

test('rankings keep names and levels only, 20 each', () => {
  const r = v.rankings({support: {week: [{nickname: '별', spoons: 999}], month: Array.from({length: 30}, (_, i) => ({nickname: 'n' + i}))}, activity: [{nickname: '달', level: 12, exp: 5}]});
  assert.deepEqual(r.support.week, [{nickname: '별'}]);
  assert.equal(r.support.month.length, 20);
  assert.deepEqual(r.support.all, []);
  assert.deepEqual(r.activity, [{nickname: '달', level: 12}]);
});

test('next reward and Korea day', () => {
  assert.deepEqual(v.nextReward([{at: 5, label: 'a'}, {at: 15, label: 'b'}], 5), {at: 15, label: 'b'});
  assert.equal(v.nextReward([{at: 5, label: 'a'}], 9), null);
  assert.equal(v.koreaDay(new Date('2026-09-28T15:30:00Z')), '2026-09-29');
});
