import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, FORM_IDS, defaultConfig, newMenu, validateConfig, validateSlug, safeHttpsUrl, safeSpoonUrl, normalizeConfig, contrast, defaultOptions } from '../docs/lib/config.js';
import { escapeHtml, charCount, clip, initial, relativeTime, formatDate, percent } from '../docs/lib/text.js';

const paths = (cfg) => validateConfig(cfg).map((e) => e.path);

test('테마 8개, 이름과 값이 시안과 같음', () => {
  assert.deepEqual(Object.keys(THEMES), ['rose', 'peach', 'butter', 'mint', 'sky', 'lavender', 'mono', 'midnight']);
  assert.deepEqual(Object.values(THEMES).map((t) => t.name), ['로즈', '피치', '버터', '민트', '스카이', '라벤더', '모노', '미드나잇']);
  assert.equal(THEMES.rose.accent, '#c7385f');
  assert.equal(THEMES.midnight.paper, '#0f1220');
});

test('테마 글자 대비(WCAG AA)', () => {
  for (const [id, t] of Object.entries(THEMES)) {
    assert.ok(contrast(t.ink, t.paper) >= 7, `${id} 본문`);
    assert.ok(contrast(t.muted, t.card) >= 4.5, `${id} 흐린 글자`);
    assert.ok(contrast(t.accentText, t.paper) >= 4.5, `${id} 강조 글자`);
    assert.ok(contrast(t.accentText, t.card) >= 4.5, `${id} 강조 글자(카드)`);
    assert.ok(contrast(t.onAccent, t.accent) >= 4.5, `${id} 버튼 글자`);
    assert.ok(contrast(t.accentText, t.soft) >= 4, `${id} 연한 칸 위 강조`);
  }
});

test('기본 설정은 검사 통과', () => {
  const c = defaultConfig('하루');
  assert.deepEqual(validateConfig(c), []);
  assert.equal(c.profile.name, '하루');
  assert.ok(c.menus.length >= 1 && c.menus.length <= 12);
});

test('양식마다 기본 옵션', () => {
  for (const f of FORM_IDS) {
    const c = defaultConfig('x');
    c.menus = [newMenu(f, [])];
    assert.deepEqual(validateConfig(c), [], f);
    assert.equal(typeof defaultOptions(f), 'object');
  }
});

test('설정 검사: 글자 수와 값', () => {
  const c = defaultConfig('하루');
  c.profile.name = '';
  c.profile.intro = 'a'.repeat(101);
  c.profile.quote = '가'.repeat(81);
  c.profile.spoonUrl = 'https://evil.example.com/spooncast.net';
  c.theme = 'neon';
  const p = paths(c);
  for (const k of ['profile.name', 'profile.intro', 'profile.quote', 'profile.spoonUrl', 'theme']) assert.ok(p.includes(k), k);
  const ok = defaultConfig('가'.repeat(24));
  ok.profile.description = '가'.repeat(300);
  assert.deepEqual(validateConfig(ok), [], '한글 24자·300자는 통과(글자 수 기준)');
});

test('설정 검사: 메뉴', () => {
  const c = defaultConfig('하루');
  c.menus = Array.from({ length: 13 }, () => newMenu('board', []));
  assert.ok(paths(c).includes('menus'));
  const d = defaultConfig('하루');
  d.menus[1].id = d.menus[0].id;
  assert.ok(paths(d).some((x) => x.endsWith('.id')));
  const e = defaultConfig('하루');
  e.menus[0].id = 'Bad-ID';
  e.menus[1].form = 'guestbook';
  assert.ok(paths(e).includes('menus.0.id'));
  assert.ok(paths(e).includes('menus.1.form'));
});

test('설정 검사: 양식 옵션', () => {
  const c = defaultConfig('하루');
  const album = c.menus.find((m) => m.form === 'album');
  album.options.categories = ['방송', '방송'];
  const links = newMenu('links', c.menus); links.options.links = [{ label: '유튜브', url: 'http://youtube.com' }];
  const days = newMenu('days', c.menus); days.options.days = [{ id: 'd', title: '생일', date: '2026-02-30', yearly: true }];
  const att = newMenu('attendance', c.menus); att.options.rewards = [{ at: 0, label: '복권' }];
  c.menus.push(links, days, att);
  const p = paths(c);
  assert.ok(p.some((x) => x.endsWith('.categories')));
  assert.ok(p.some((x) => x.includes('.links.0')));
  assert.ok(p.some((x) => x.includes('.days.0')));
  assert.ok(p.some((x) => x.includes('.rewards.0')));
});

test('주소(slug) 검사', () => {
  assert.equal(validateSlug('haru'), null);
  assert.equal(validateSlug('my-dj-01'), null);
  assert.ok(validateSlug('ha'));
  assert.ok(validateSlug('Haru'));
  assert.ok(validateSlug('하루'));
  assert.ok(validateSlug('a'.repeat(31)));
  for (const r of ['studio', 'api', 'admin']) assert.ok(validateSlug(r), r);
});

test('https 주소만, 스푼은 spooncast.net만', () => {
  assert.equal(safeHttpsUrl('https://www.youtube.com/@x'), 'https://www.youtube.com/@x');
  assert.equal(safeHttpsUrl('http://a.com'), null);
  assert.equal(safeHttpsUrl('javascript:alert(1)'), null);
  assert.equal(safeHttpsUrl('https://user:pw@a.com'), null);
  assert.equal(safeHttpsUrl('https://localhost'), null);
  assert.ok(safeSpoonUrl('https://www.spooncast.net/kr/channel/123'));
  assert.ok(safeSpoonUrl('https://spooncast.net/kr'));
  assert.equal(safeSpoonUrl('https://spooncast.net.evil.com/'), null);
  assert.equal(safeSpoonUrl('https://evilspooncast.net/'), null);
  assert.equal(safeSpoonUrl('http://www.spooncast.net/'), null);
});

test('그리기 전 정리: 모르는 값은 기본으로', () => {
  const n = normalizeConfig({ theme: 'x', layout: 'y', profile: { name: '  ', spoonUrl: 'javascript:1', avatar: { path: '' } }, menus: [{ id: 'm_1', form: 'nope' }, { id: 'm_2', form: 'links', name: '링크' }] });
  assert.equal(n.theme, 'rose'); assert.equal(n.layout, 'story');
  assert.equal(n.profile.spoonUrl, ''); assert.equal(n.profile.avatar, null);
  assert.equal(n.menus.length, 1); assert.deepEqual(n.menus[0].options, { links: [] });
  assert.equal(normalizeConfig(null).menus.length, 0);
});

test('이스케이프', () => {
  assert.equal(escapeHtml('<img src=x onerror="a()">&\'`'), '&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;&#96;');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(5), '5');
});

test('글자 도우미', () => {
  assert.equal(charCount('가나다😀'), 4);
  assert.equal(clip('가나다라마', 3), '가나다…');
  assert.equal(initial(' 별빛'), '별');
  assert.equal(initial('moon'), 'M');
  assert.equal(percent(1, 3), 33);
  assert.equal(percent(0, 0), 0);
});

test('시간 표시(한국 시간)', () => {
  const now = Date.parse('2026-09-29T03:00:00Z'); // 한국 12:00
  assert.equal(relativeTime('2026-09-29T02:59:30Z', now), '방금');
  assert.equal(relativeTime('2026-09-29T02:30:00Z', now), '30분 전');
  assert.equal(relativeTime('2026-09-28T16:00:00Z', now), '11시간 전');
  assert.equal(relativeTime('2026-09-28T14:00:00Z', now), '어제', '한국 날짜로 어제');
  assert.equal(relativeTime('2026-09-25T03:00:00Z', now), '4일 전');
  assert.equal(relativeTime('2026-08-01T03:00:00Z', now), '8월 1일');
  assert.equal(formatDate('2025-12-31T16:00:00Z', now), '1월 1일', '한국 시간으로는 새해 첫날');
  assert.equal(formatDate('2025-12-31T14:00:00Z', now), '2025년 12월 31일');
});
