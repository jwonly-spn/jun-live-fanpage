// 보스전 보기 사이트 화면(2026-11-19 — 봇 저장소 docs/superpowers/specs/2026-11-18-bossview-design.md "사이트" · "채팅 링크 · 스푼 앱 안 창"):
//  주소(/boss · /boss/<판 번호> · /b/<DJ 주소>) · 첫 화면 "지금 보스전" 띠(판이 있을 때만, 3개까지) · 목록 없음 글 · 404 글 · 이름표(아이디의 # 앞만)
//  · 다시 읽는 간격 · 스푼 앱 안 창(아이폰·갤럭시) 대비 · 장면 모듈과 그림(docs/kiugi/s2/battle).
//  DOM 없이 — 순수 도우미(docs/lib/boss-core.js)와 소스 글만 본다. 이름은 모두 지어낸 것.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseRoute, buildPath } from '../docs/lib/route.js';

const docs = fileURLToPath(new URL('../docs/', import.meta.url));
const text = (p) => readFile(docs + p, 'utf8');
const ID = 'abcdefghjkmn', SLUG = 'nyangdj7';
const T = Date.parse('2026-12-02T21:00:00+09:00');
const F = (o = {}) => ({ id: ID, dj: { slug: SLUG, name: '먼치' }, boss: { type: 'water', name: '심해 크라켄', stage: 9 }, phase: 'fight', joined: 10, appearAt: T - 70000, joinUntil: T - 5000, startAt: T - 3000, ...o });

test('주소: /boss(목록) · /boss/<판 번호>(보기) · /b/<DJ 주소>(채팅 링크 — 그 DJ 의 지금 판) · 모양이 틀리면 보기는 빈 번호(없는 보스전 글), 채팅 링크는 없는 주소', () => {
  assert.deepEqual(parseRoute('/boss', '/'), { name: 'boss' });
  assert.deepEqual(parseRoute('/boss/', '/'), { name: 'boss' });
  assert.deepEqual(parseRoute('/jun-live-fanpage/boss', '/jun-live-fanpage/'), { name: 'boss' });
  assert.deepEqual(parseRoute('/boss/' + ID, '/'), { name: 'watch', fight: ID });
  assert.deepEqual(parseRoute('/boss/' + ID.toUpperCase(), '/'), { name: 'watch', fight: ID }, '대문자로 와도');
  for (const bad of ['x', 'abc', ID + 'a', 'abcdefghijkl', '%3Cb%3E']) assert.deepEqual(parseRoute('/boss/' + bad, '/'), { name: 'watch', fight: '' }, bad);
  assert.equal(parseRoute('/boss/' + ID + '/x', '/').name, 'notfound');
  assert.deepEqual(parseRoute('/b/' + SLUG, '/'), { name: 'live', slug: SLUG });
  assert.deepEqual(parseRoute('/b/' + SLUG + '/', '/', '?x=1'), { name: 'live', slug: SLUG });
  assert.deepEqual(parseRoute('/b/' + SLUG.toUpperCase(), '/'), { name: 'live', slug: SLUG });
  for (const bad of ['/b', '/b/', '/b/abc', '/b/nyangdj1', '/b/' + SLUG + '/x']) assert.equal(parseRoute(bad, '/').name, 'notfound', bad);
  assert.equal(buildPath('/', { name: 'boss' }), '/boss');
  assert.equal(buildPath('/', { name: 'watch', fight: ID }), '/boss/' + ID);
  assert.equal(buildPath('/', { name: 'watch', fight: '<b>' }), '/boss', '이상한 번호는 주소에 넣지 않는다');
  assert.equal(buildPath('/jun-live-fanpage/', { name: 'live', slug: SLUG }), '/jun-live-fanpage/b/' + SLUG);
  assert.equal(buildPath('/', { name: 'live', slug: '../x' }), '/boss');
});

test('글: 목록 없음 · 끝났거나 없는 판 · 볼 수 없는 판 · 소리 한 줄', async () => {
  const c = await import('../docs/lib/boss-core.js');
  assert.equal(c.EMPTY_BOSS, '지금은 보스전이 없어요 — 방송 시작 30분 뒤부터 30분마다 나와요');
  assert.deepEqual(c.emptyLines(), ['지금은 보스전이 없어요', '방송 시작 30분 뒤부터 30분마다 나와요']);
  assert.match(c.GONE_BOSS, /^끝났거나 없는 보스전이에요/);
  assert.match(c.BROKEN_BOSS, /볼 수 없는 판/);
  assert.equal(c.SOUND_NOTE, '방송 소리와 겹칠 수 있어요');
  const view = await text('views/boss.js');
  for (const s of ['EMPTY_BOSS', 'emptyLines()', 'GONE_BOSS', 'BROKEN_BOSS', 'SOUND_NOTE', '지금 다른 보스전', '지금 보스전']) assert.ok(view.includes(s), s);
});

test('이름표: 키우기 아이디의 # 앞만(솜사탕#먼치 → 솜사탕) · 아이디가 없으면 몬스터 이름', async () => {
  const { fightName, nameOf } = await import('../docs/lib/boss-core.js');
  assert.equal(fightName('솜사탕#먼치'), '솜사탕');
  assert.equal(fightName('밤톨#Cookie88'), '밤톨');
  assert.equal(fightName('솜사탕'), '솜사탕');
  for (const none of [null, undefined, '', '#먼치', 7, {}]) assert.equal(fightName(none), '', String(none));
  assert.equal(nameOf({ label: '솜사탕#먼치', name: '물솟나루' }), '솜사탕');
  assert.equal(nameOf({ label: null, name: '찌릿냥' }), '찌릿냥');
  assert.equal(nameOf({ label: null }), '몬스터');
  assert.match(await text('views/boss.js'), /nameOf\b/, '장면에 이름표 함수를 넘긴다');
});

test('첫 화면 띠: 판이 있을 때만 · 3개까지 · 틀 없이 · 한 줄 = 방송 · 보스 · 상태', async () => {
  const { stripItems, STRIP_MAX, phaseText, djText, listOf } = await import('../docs/lib/boss-core.js');
  assert.equal(STRIP_MAX, 3);
  assert.deepEqual(stripItems([]), { items: [], more: 0 });
  assert.deepEqual(stripItems(null), { items: [], more: 0 });
  const five = [1, 2, 3, 4, 5].map((n) => F({ id: ID.slice(0, 11) + 'abcde'[n - 1], phase: n === 2 ? 'join' : 'fight' }));
  const s = stripItems(five);
  assert.equal(s.items.length, 3); assert.equal(s.more, 2);
  assert.deepEqual(s.items.map((f) => f.id), five.slice(0, 3).map((f) => f.id));
  assert.equal(phaseText(five[0]), '싸우는 중'); assert.equal(phaseText(five[1]), '모집 중');
  assert.equal(djText(five[0]), '먼치 방송');
  // 모양이 이상한 줄은 버린다
  assert.deepEqual(listOf({ fights: [F(), null, { id: 'x' }, F({ id: '../../x' }), F({ dj: null }), F({ boss: { type: 'nope', name: 'x', stage: 1 } })] }).map((f) => f.id), [ID]);
  assert.deepEqual(listOf(null), []); assert.deepEqual(listOf({ fights: 'x' }), []);
  const home = await text('views/home.js');
  assert.match(home, /bossStrip\(app\)/);
  assert.match(home, /el\.hidden = !items\.length/, '판이 없으면 띠가 없다');
  assert.match(home, /👹 지금 보스전/); assert.match(home, /모두 보기/);
  assert.match(home, /kiugiApi\.fights\(\)/);
  const css = await text('styles.css');
  const strip = /\.s2-boss-strip \{([^}]*)\}/.exec(css)?.[1] || '';
  assert.ok(strip, '.s2-boss-strip 모양');
  assert.doesNotMatch(strip, /border(?!-radius)|box-shadow|outline/, '띠에는 틀·상자가 없다');
});

test('다시 읽기: 목록 15초 · 모집 중 3초 · 싸움이 오면 그만(땅이 아직이면 10초마다) · 숨으면 쉼 · 오래된 모집 판은 없는 판', async () => {
  const c = await import('../docs/lib/boss-core.js');
  assert.deepEqual([c.LIST_POLL_MS, c.JOIN_POLL_MS, c.LAND_POLL_MS], [15000, 3000, 10000]);
  const script = { v: 1, boss: F().boss, team: [], events: [], hp: 10 };
  assert.deepEqual(c.watchPlan(F({ phase: 'join', startAt: null, joinUntil: T + 30000, script: null }), T), { mode: 'join', poll: 3000 });
  assert.deepEqual(c.watchPlan(F({ phase: 'join', startAt: null, joinUntil: T - 60000, script: null }), T), { mode: 'join', poll: 3000 }, '마감 뒤 90초까지는 대본을 기다린다');
  assert.deepEqual(c.watchPlan(F({ phase: 'join', startAt: null, joinUntil: T - 90001, script: null }), T), { mode: 'gone', poll: 0 }, '대본이 끝내 안 온 판');
  assert.deepEqual(c.watchPlan(F({ script, land: null }), T), { mode: 'fight', poll: 10000 });
  assert.deepEqual(c.watchPlan(F({ script, land: { addedPct: 0.4, pct: 3.2 } }), T), { mode: 'fight', poll: 0 });
  assert.deepEqual(c.watchPlan(F({ script, land: {} }), T), { mode: 'fight', poll: 0 }, '빈 땅 답도 답이다');
  for (const bad of [null, {}, F({ script: { events: 'x' } }), F({ phase: 'fight', script: null }), F({ boss: null })]) assert.equal(c.watchPlan(bad, T).mode, 'gone');
  // 서버 시계 맞춤: 답의 now 와 이 기기 시계의 차이(보내고 받은 시각의 가운데)
  assert.equal(c.clockOffset(T + 5000, T, T + 200), 4900);
  assert.equal(c.clockOffset('x', T, T + 200), 0);
  // 채팅 링크(/b/<주소>): 그 DJ 의 지금 판 — 방금 본(끝난) 판은 다시 틀지 않는다
  const a = F({ id: 'aaaaaaaaaaaa', appearAt: T - 1000 }), b = F({ id: 'bbbbbbbbbbbb', appearAt: T });
  assert.equal(c.pickFight([a, b], SLUG).id, 'bbbbbbbbbbbb', '가장 새 판');
  assert.equal(c.pickFight([a, b], SLUG, 'bbbbbbbbbbbb').id, 'aaaaaaaaaaaa');
  assert.equal(c.pickFight([a], SLUG, 'aaaaaaaaaaaa'), null);
  assert.equal(c.pickFight([F({ dj: { slug: 'cookie88', name: '쿠키' } })], SLUG), null, '다른 DJ 판은 아니다');
  const view = await text('views/boss.js');
  assert.match(view, /visibilitychange/); assert.match(view, /document\.hidden|visibilityState/);
  assert.match(view, /kiugiApi\.fights\(/); assert.match(view, /kiugiApi\.fight\(/);
  assert.match(view, /setLand\(/); assert.match(view, /updateJoin\(/);
  assert.doesNotMatch(view, /다시 보기|replay/i, '다시 보기는 없다');
  assert.ok(view.includes("if (live) { doneId = curId; curId = ''; return tick(); }"),'채팅 링크: 끝난 뒤 그 DJ 의 다음 판을 기다린다');
});

test('api: fights() · fights(주소) · fight(번호) — 머리글 없는 GET · 404 글은 서버 글 그대로', async () => {
  const api = await import('../docs/api.js');
  const calls = [], real = globalThis.fetch;
  globalThis.fetch = async (u) => { calls.push(String(u)); return /fights\/zzzz/.test(u) ? new Response(JSON.stringify({ error: '끝났거나 없는 보스전이에요.' }), { status: 404 }) : new Response(JSON.stringify({ now: T, fights: [] })); };
  try {
    assert.deepEqual(await api.kiugiApi.fights(), { now: T, fights: [] });
    await api.kiugiApi.fights(SLUG);
    await assert.rejects(api.kiugiApi.fight('zzzz'), (e) => e instanceof api.ApiError && e.status === 404 && e.message === '끝났거나 없는 보스전이에요.');
  } finally { globalThis.fetch = real; }
  assert.equal(calls[0], api.KIUGI_BASE + 'fights?apikey=' + api.API_KEY);
  assert.equal(calls[1], api.KIUGI_BASE + `fights?slug=${SLUG}&apikey=` + api.API_KEY);
  assert.equal(calls[2], api.KIUGI_BASE + 'fights/zzzz?apikey=' + api.API_KEY);
});

test('약한 기기: 화면 배율 상한 · 코어 4개 이하나 메모리 3GB 이하면 입자 줄임', async () => {
  const { sceneQuality } = await import('../docs/lib/boss-core.js');
  assert.deepEqual(sceneQuality({ hardwareConcurrency: 8, deviceMemory: 8 }), { maxDpr: 2, particles: 1, weak: false });
  assert.deepEqual(sceneQuality({ hardwareConcurrency: 4, deviceMemory: 8 }), { maxDpr: 1.5, particles: 0.5, weak: true });
  assert.deepEqual(sceneQuality({ hardwareConcurrency: 8, deviceMemory: 3 }), { maxDpr: 1.5, particles: 0.5, weak: true });
  assert.deepEqual(sceneQuality({}), { maxDpr: 2, particles: 1, weak: false }, '모르면(아이폰은 메모리를 안 알려 줌) 보통으로');
  assert.deepEqual(sceneQuality(undefined), { maxDpr: 2, particles: 1, weak: false });
  const view = await text('views/boss.js');
  assert.match(view, /maxDpr: q\.maxDpr/); assert.match(view, /particles: q\.particles/);
});

test('스푼 앱 안 창(아이폰·갤럭시): safe-area · 100dvh(+100vh 대비) · 글자 크기 자동 키움 막기 · 44px 단추 · 새 창·저장소 없음 · 소리는 처음엔 꺼짐 · 음악은 켤 때만', async () => {
  const index = await text('index.html'), css = await text('styles.css'), view = await text('views/boss.js'), unlock = await text('lib/sound-unlock.js');
  assert.match(index, /viewport-fit=cover/);
  assert.match(index, /media-src data:;/, '무음 오디오(아이폰 무음 스위치 대비)만 허용');
  assert.doesNotMatch(index, /\.mp3|modulepreload" href="\/(kiugi\/s2\/battle|views\/boss|lib\/sound-unlock)/, '음악·장면 모듈을 처음부터 받지 않는다(표에만 있다)');
  assert.match(css, /-webkit-text-size-adjust: 100%/);
  for (const cls of ['bv', 'bv-stage', 'bv-host', 'bv-info', 'bv-boss', 'bv-status', 'bv-sound', 'bv-note', 'bv-msg', 'bv-more', 'bv-list', 'bv-scene', 's2-boss-strip', 's2-boss-item', 'bl', 'bl-row', 'bl-empty'])
    assert.match(css, new RegExp(`\\.${cls}[\\s{.:,\\[>]`), cls);
  assert.match(css, /env\(safe-area-inset-top\)/); assert.match(css, /env\(safe-area-inset-bottom\)/); assert.match(css, /env\(safe-area-inset-left\)/);
  assert.match(css, /min-height: 100vh; min-height: 100dvh/, '100dvh 를 모르는 창은 100vh');
  const sound = /\.bv-sound \{([^}]*)\}/.exec(css)?.[1] || '';
  assert.match(sound, /min-width: 48px/); assert.match(sound, /min-height: 48px/);
  const row = /\.bl-row \{([^}]*)\}/.exec(css)?.[1] || '';
  assert.match(row, /min-height: (4[4-9]|[5-9]\d)px/, '목록 한 줄은 손가락 크기');
  assert.doesNotMatch(css.split('\n').filter((l) => /\.bv|\.bl-|s2-boss/.test(l)).join('\n'), /:hover/, '마우스를 올려야만 보이는 것은 없다(눌렀을 때 :active 만)');
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.s2-boss-dot/, '움직임 줄이기');
  for (const [f, src] of [['views/boss.js', view], ['lib/sound-unlock.js', unlock], ['lib/boss-core.js', await text('lib/boss-core.js')]]) {
    assert.doesNotMatch(src, /window\.open|target:\s*'_blank'|alert\(|confirm\(/, f + ': 새 창·팝업 없음');
    assert.doesNotMatch(src, /localStorage|sessionStorage|indexedDB/, f + ': 저장소를 쓰지 않는다');
  }
  assert.match(view, /sound = false/, '소리는 처음엔 꺼짐');
  assert.match(view, /import\('\.\.\/kiugi\/s2\/battle\/battle-scene\.js'\)/, '장면 모듈은 보는 화면에서만 받는다');
  // 아이폰 무음 스위치: 누르는 손길 안에서 무음 오디오를 먼저 틀고 → 소리 켜기. 갤럭시에서는 하지 않는다(방송 소리의 오디오 포커스를 뺏지 않게)
  assert.match(unlock, /new Audio\(/); assert.match(unlock, /data:audio\/wav;base64,/); assert.match(unlock, /iPad|iPhone/);
  const tap = view.slice(view.indexOf('function toggleSound'));
  assert.ok(tap.indexOf('unlockAudio(') > 0 && tap.indexOf('unlockAudio(') < tap.indexOf('.set('), '무음 오디오가 먼저');
  assert.match(view, /audio: /, '모집 중 → 싸움으로 바뀌어도 같은 소리 길(고른 소리 그대로)');
});

test('장면 모듈과 그림(docs/kiugi/s2/battle): 모듈 2 · 목록 · 도트·효과·배경·음악 — 미리보기는 옮기지 않는다 · 사이트가 쓰는 손잡이가 있다 · 찍기(stamp)에 들어가고 처음부터 받지는 않는다', async () => {
  const dir = docs + 'kiugi/s2/battle/';
  assert.deepEqual((await readdir(dir)).sort(), ['battle-scene.js', 'bg', 'effects', 'manifest.json', 'music', 'sprites', 'timeline.js']);
  assert.equal(existsSync(dir + 'preview.html'), false); assert.equal(existsSync(dir + '_preview'), false);
  const mf = JSON.parse(await readFile(dir + 'manifest.json', 'utf8'));
  for (const id of Object.keys(mf.sprites)) for (const ext of ['png', 'json']) assert.ok((await stat(`${dir}sprites/${id}.${ext}`)).size > 0, id);
  for (const id of Object.keys(mf.effects)) assert.ok((await stat(`${dir}effects/${id}.png`)).size > 0, id);
  for (const id of mf.bg) assert.ok((await stat(`${dir}bg/${id}.png`)).size > 0, id);
  const scene = await readFile(dir + 'battle-scene.js', 'utf8');
  for (const t of Object.values(/tracks: \{([^}]*)\}/.exec(scene)[1].match(/'[^']+\.mp3'/g))) assert.ok((await stat(dir + 'music/' + t.slice(1, -1))).size > 100000, t);
  for (const s of ['export async function playFight', 'export function makeAudio', 'opts.maxDpr', 'opts.particles', 'opts.audio', 'updateJoin(n)', 'setLand(v)', 'opts.maxHeight', 'live.now']) assert.ok(scene.includes(s), s);
  assert.doesNotMatch(scene, /replay|다시 보기 단추/i);
  const tl = await import('../docs/kiugi/s2/battle/timeline.js');
  assert.equal(tl.buildTimeline({ boss: F().boss, joinUntil: T }).joinOnly, true);
  assert.ok(tl.TIMING.hardMax <= 90000);
  // 대신 그림(도트가 아직 없는 몬스터·보스)은 사이트에 이미 있는 그림
  for (const t of ['fire', 'water', 'grass', 'electric', 'earth', 'wind']) assert.ok(existsSync(`${docs}kiugi/s2/boss_${t}.png`), t);
  const { modules, preloadable } = (await import('node:module')).createRequire(import.meta.url)('../tools/stamp.cjs');
  const list = modules();
  for (const m of ['/kiugi/s2/battle/battle-scene.js', '/kiugi/s2/battle/timeline.js', '/views/boss.js', '/lib/boss-core.js', '/lib/sound-unlock.js']) assert.ok(list.includes(m), m);
  assert.equal(preloadable('/kiugi/s2/battle/battle-scene.js'), false); assert.equal(preloadable('/kiugi/s2/battle/timeline.js'), false);
  assert.equal(preloadable('/views/boss.js'), false, '보는 화면 모듈도 그 화면에서만'); assert.equal(preloadable('/lib/sound-unlock.js'), false);
  assert.equal(preloadable('/lib/boss-core.js'), true, '첫 화면 띠가 쓴다');
});

test('체험 모드(이 PC 미리 보기): 지어낸 보스전 — 목록 · DJ 주소로 거르기 · 모집 → 싸움 · 끝난 판 · 없는 판 404 · 대본은 장면 시간표가 읽는 모양', async () => {
  const mock = await import('../docs/mock.js');
  const { buildTimeline } = await import('../docs/kiugi/s2/battle/timeline.js');
  const { listOf, watchPlan, fightName } = await import('../docs/lib/boss-core.js');
  const sc = mock.demoScript({ n: 10, type: 'water', seed: 7 });
  const tl = buildTimeline(sc);
  assert.equal(tl.joinOnly, false); assert.ok(tl.duration > 20000 && tl.duration <= 90000, String(tl.duration));
  assert.ok(['win', 'timeout', 'wipe'].includes(tl.result));
  assert.equal(sc.team.length, 10);
  for (const m of sc.team) { assert.ok(m.label === null || /^[가-힣]{1,6}#[가-힣A-Za-z0-9]{1,8}$/.test(m.label), String(m.label)); assert.match(m.sp, /^(fire|water|grass|electric|earth|wind)_0[1-3]$/); }
  assert.ok(sc.team.some((m) => m.label === null) && sc.team.some((m) => fightName(m.label)), '아이디가 있는 사람·없는 사람');
  assert.equal(buildTimeline(mock.demoScript({ n: 50, type: 'fire', seed: 3 })).duration <= 90000, true, '50명도 90초 안');
  // 시각표: t0(페이지를 연 때) 기준
  const world = mock.demoFights({ t0: T });
  const at = (ms, q = {}) => world.list(T + ms, q).json, one = (ms, id) => world.one(T + ms, id);
  assert.ok(listOf(at(0)).length >= 2, '처음부터 판이 있다');
  assert.deepEqual(new Set(listOf(at(0)).map((f) => f.phase)), new Set(['join', 'fight']));
  const mine = listOf(at(0, { slug: mock.DEMO_BOSS_SLUG }));
  assert.ok(mine.length >= 1 && mine.every((f) => f.dj.slug === mock.DEMO_BOSS_SLUG));
  const joining = listOf(at(0)).find((f) => f.phase === 'join');
  assert.equal(watchPlan(one(0, joining.id).json.fight, T).mode, 'join');
  const later = one(joining.joinUntil - T + 3000, joining.id).json;
  assert.equal(watchPlan(later.fight, later.now).mode, 'fight', '마감 뒤 대본이 온다');
  assert.equal(later.fight.script.id, joining.id); assert.equal(later.fight.script.startAt, later.fight.startAt);
  assert.equal(one(0, 'zzzzzzzzzzzz').status, 404); assert.equal(one(0, 'zzzzzzzzzzzz').json.error, '끝났거나 없는 보스전이에요.');
  assert.equal(one(0, mock.DEMO_ENDED_ID).status, 200, '끝난 판은 결과 한 장면');
  assert.ok(T - one(0, mock.DEMO_ENDED_ID).json.fight.startAt > 90000);
  // ?fights=0: 판 없음 · ?wait=<초>: 그 뒤에 내 판이 생긴다
  assert.deepEqual(mock.demoFights({ t0: T, none: true }).list(T, {}).json.fights, []);
  const w = mock.demoFights({ t0: T, wait: 20 });
  assert.deepEqual(w.list(T + 19000, { slug: mock.DEMO_BOSS_SLUG }).json.fights, []);
  assert.equal(w.list(T + 21000, { slug: mock.DEMO_BOSS_SLUG }).json.fights.length, 1);
});
