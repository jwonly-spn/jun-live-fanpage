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

test('첫 화면 띠: 판이 있을 때만 · 3개까지 · 틀 없이 · 한 줄 = 방송 · 보스 · 참전 n명 · 상태 · 다시 보이면 바로 새로', async () => {
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
  assert.match(home, /djText\(f\)\), h\('span', \{ class: 's2-boss-name' \}, f\.boss\.name\), h\('span', \{ class: 's2-boss-n' \}, joinedText\(f\)\), h\('em', null, phaseText\(f\)\)/, '방송 · 보스 · 참전 n명 · 상태');
  assert.match(home, /visibilityState === 'visible'\) read\(\)/, '다시 보이면 바로 새로');
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
  assert.ok(view.includes("if (live) { skip.add(curId); curId = ''; return NEXT_MS; }"),'채팅 링크: 끝난 뒤 그 DJ 의 다음 판을 기다린다');
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
  // 아이폰·아이패드는 코어 수를 낮춰 말할 수 있다 → 코어 수로는 약하다고 보지 않는다
  assert.equal(sceneQuality({ hardwareConcurrency: 4, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }).weak, false);
  assert.equal(sceneQuality({ hardwareConcurrency: 2, platform: 'MacIntel', maxTouchPoints: 5 }).weak, false);
  assert.equal(sceneQuality({ hardwareConcurrency: 4, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A156N)' }).weak, true);
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
  assert.match(view, /playWithSound\(\(o\) => m\.playFight\(wrap, script, o\), sharedAudio, \(\) => sound,/, '모집 중 → 싸움으로 바뀌어도 같은 소리 길 · 띄우는 동안 누른 소리 고름이 이긴다');
  assert.match(view, /'aria-label': '소리', 'aria-pressed': 'false'/, '소리 단추 이름은 늘 같고 상태는 aria-pressed 로만');
  assert.doesNotMatch(view, /setAttribute\('aria-label'/);
  assert.match(view, /stateEl = h\('em', \{ role: 'status', 'aria-live': 'polite' \}\)/, '토벌 성공·실패는 화면 읽기에 알린다');
  assert.match(view, /sharedAudio\?\.halt\(\)/, '장면을 치우면 곡도 내린다');
  assert.match(view, /loadFailed/, '장면 모듈을 못 받은 것은 볼 수 없는 판이 아니다(다시 시도)');
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

// 장면이 뜨는 동안(그림·글꼴을 받는 동안) 소리 단추를 누르면 — 장면 모듈은 다 받은 뒤에야 처음 값(opts.sound)을 소리에 넣는다. 나중 고름이 이겨야 한다.
test('소리 고름: 장면을 띄우는 동안 켜면 켜진 채로 · 끄면 꺼진 채로(처음 값이 덮지 않는다) · 안 바꾸면 그대로', async () => {
  const { playWithSound } = await import('../docs/lib/boss-core.js');
  const stubAudio = () => { const a = { on: false, calls: [], set(v) { a.on = !!v; a.calls.push(!!v); } }; return a; };
  // 장면 모듈 흉내: 그림을 받는 동안(gate) 기다렸다가 opts.sound 를 소리에 넣는다(battle-scene.js playFight 와 같은 차례)
  const scene = (gate) => async (o) => { await gate; o.audio.set(!!o.sound); return { sound: o.sound, nameOf: o.nameOf }; };
  const open = () => { let go; const gate = new Promise((res) => { go = res; }); return { gate, go }; };

  // 1) 처음 들어와 장면이 뜨는 동안 "소리" 를 켬
  let sound = false, audio = stubAudio(), g = open();
  let job = playWithSound(scene(g.gate), audio, () => sound, { nameOf: 'x' });
  sound = true; audio.set(true);            // 손길: 단추가 곧바로 소리를 켠다
  g.go();
  const ctl = await job;
  assert.equal(audio.on, true, '켠 채로 남는다(단추는 켜짐인데 소리는 꺼짐이 되지 않는다)');
  assert.deepEqual(audio.calls, [true, false, true], '장면이 처음 값(꺼짐)을 넣은 뒤 지금 고름으로 다시 맞춘다');
  assert.equal(ctl.nameOf, 'x', '다른 옵션은 그대로 넘어간다'); assert.equal(ctl.sound, false);

  // 2) 모집 → 싸움으로 바뀌는 동안 소리를 끔
  sound = true; audio = stubAudio(); audio.set(true); g = open();
  job = playWithSound(scene(g.gate), audio, () => sound, {});
  sound = false; audio.set(false);
  g.go(); await job;
  assert.equal(audio.on, false, '끈 채로 남는다(장면이 다시 켜지 않는다)');

  // 3) 그동안 안 바꿨으면 한 번만 넣는다
  sound = true; audio = stubAudio(); audio.set(true); g = open();
  job = playWithSound(scene(g.gate), audio, () => sound, {}); g.go(); await job;
  assert.equal(audio.on, true); assert.deepEqual(audio.calls, [true, true]);

  // 4) 장면이 못 뜨면 오류는 그대로 올라온다
  await assert.rejects(playWithSound(async () => { throw new Error('대본'); }, stubAudio(), () => false, {}), /대본/);
});

test('채팅 링크 기다림: 15초마다 · 10분 넘게 판이 없으면 30초마다 · 다른 보스전 목록은 1분마다 · 없는 판은 여럿이어도 다시 고르지 않는다', async () => {
  const c = await import('../docs/lib/boss-core.js');
  assert.equal(c.waitPollMs(0), 15000); assert.equal(c.waitPollMs(600000), 15000); assert.equal(c.waitPollMs(600001), 30000);
  assert.deepEqual([c.OTHERS_POLL_MS, c.IDLE_AFTER_MS, c.IDLE_POLL_MS], [60000, 600000, 30000]);
  assert.ok(c.NEXT_MS >= 500, '다음 판으로 넘어갈 때 바로 되부르지 않는다');
  const a = F({ id: 'aaaaaaaaaaaa', appearAt: T - 1000 }), b = F({ id: 'bbbbbbbbbbbb', appearAt: T });
  const skip = new Set(['bbbbbbbbbbbb']);
  assert.equal(c.pickFight([a, b], SLUG, skip).id, 'aaaaaaaaaaaa');
  skip.add('aaaaaaaaaaaa');
  assert.equal(c.pickFight([a, b], SLUG, skip), null, '둘 다 없는 판이면 번갈아 고르지 않는다');
  const view = await text('views/boss.js');
  assert.match(view, /othersAt > OTHERS_POLL_MS - 1000/); assert.match(view, /return waitPollMs\(Date\.now\(\) - idleSince, Date\.now\(\) - openedAt\)/);
  assert.match(view, /visibilityState === 'visible'\) idleSince = 0/, '다시 보면 15초 간격으로');
  assert.doesNotMatch(view, /return tick\(\)/, '쉬지 않고 되부르지 않는다');
});

// ---- 2026-11-19 마지막 점검 뒤 ----
test('채팅 링크를 막 열었을 때(I2): 연 뒤 90초 동안은 3초마다 · 그 뒤 15초 · 10분 넘게 없으면 30초 · 처음 10초는 "보스를 찾는 중" 그 뒤 "지금은 보스전이 없어요"', async () => {
  const c = await import('../docs/lib/boss-core.js');
  assert.deepEqual([c.FAST_POLL_MS, c.FAST_FOR_MS, c.SEEK_MS], [3000, 90000, 10000]);
  assert.equal(c.waitPollMs(0, 0), 3000); assert.equal(c.waitPollMs(60000, 89999), 3000);
  assert.equal(c.waitPollMs(60000, 90000), 15000); assert.equal(c.waitPollMs(600001, 700000), 30000);
  assert.equal(c.waitPollMs(0), 15000, '연 때를 모르면 예전처럼');
  const seek = c.waitWords(0), none = c.waitWords(10000);
  assert.deepEqual(seek, { seeking: true, title: '보스를 찾는 중…', sub: '잠깐만 기다려 주세요', extra: '', status: '보스를 찾는 중이에요' });
  assert.deepEqual(c.waitWords(9999), seek);
  assert.deepEqual(none, { seeking: false, title: '지금은 보스전이 없어요', sub: '방송 시작 30분 뒤부터 30분마다 나와요', extra: '보스가 나오면 여기서 바로 시작돼요', status: '보스를 기다리는 중이에요' });
  const view = await text('views/boss.js');
  assert.match(view, /const w = waitWords\(Date\.now\(\) - openedAt\); say\('wait', w\.title, w\.sub, w\.extra\); plain\(w\.status\);/);
  assert.match(view, /return waitPollMs\(Date\.now\(\) - idleSince, Date\.now\(\) - openedAt\)/);
});

test('한도에 걸리면(429 — I3) 30초 쉬었다 다시 · 다른 실패는 5초 · 화면 셋(보는 화면·목록·첫 화면 띠) 모두', async () => {
  const c = await import('../docs/lib/boss-core.js');
  assert.deepEqual([c.FAIL_RETRY_MS, c.LIMIT_WAIT_MS], [5000, 30000]);
  assert.equal(c.failWaitMs({ status: 429 }), 30000);
  for (const e of [{ status: 0 }, { status: 503 }, {}, null, undefined]) assert.equal(c.failWaitMs(e), 5000);
  assert.equal(c.failWaitMs({ status: 429 }, 15000), 30000); assert.equal(c.failWaitMs({ status: 503 }, 15000), 15000, '둘째 값 = 보통 때 기다림(목록·띠는 15초)');
  const view = await text('views/boss.js'), home = await text('views/home.js'), api = await text('api.js');
  assert.match(view, /try \{ ms = await fn\(\); \} catch \(e\) \{ ms = failWaitMs\(e\); \}/, '되풀이(poller)');
  assert.match(view, /if \(e\?\.status !== 404\) return failWaitMs\(e\);/, '한 판 읽기');
  assert.match(view, /wait = failWaitMs\(e, LIST_POLL_MS\);/, '목록');
  assert.match(home, /wait = failWaitMs\(e, LIST_POLL_MS\);/, '첫 화면 띠');
  assert.match(home, /timer = setTimeout\(read, wait\)/);
  assert.match(api, /429: '[^']*[가-힣][^']*'/, '서버 글이 없어도 한국어 글');
});

test('서버 시계 맞춤(M1): 가장 빨리 온 답으로만 — 느린 답 하나가 와도 그대로 · 더 빠른 답이 오면 바꾼다 · now 가 없거나 시계가 거꾸로 간 답은 버린다', async () => {
  const c = await import('../docs/lib/boss-core.js');
  const first = c.bestClock(null, T + 5000, T, T + 200);
  assert.deepEqual(first, { offset: 4900, rtt: 200 });
  // 느린 답(3초 걸림 — 서버는 받자마자 답했는데 내려오는 길이 막힘): 가운데로 셈하면 1.4초나 틀린다 → 버린다
  const slow = c.bestClock(first, T + 10000 + 5000 + 100, T + 10000, T + 13000);
  assert.equal(slow, first, '느린 답은 버린다');
  assert.equal(c.clockOffset(T + 15100, T + 10000, T + 13000), 3600, '옛 셈이면 1.3초 뒤로 튀었다(장면이 되감김)');
  const fast = c.bestClock(first, T + 20000 + 4950, T + 20000, T + 20080);
  assert.deepEqual(fast, { offset: 4910, rtt: 80 });
  assert.equal(c.bestClock(fast, T + 30000 + 4950, T + 30000, T + 30080), fast, '같은 빠르기면 그대로(자잘하게 흔들리지 않게)');
  assert.equal(c.bestClock(fast, 'x', T, T + 10), fast); assert.equal(c.bestClock(fast, undefined, T, T + 10), fast);
  assert.equal(c.bestClock(fast, T + 5000, T + 100, T), fast, '받은 때가 보낸 때보다 앞(기기 시계가 바뀜)');
  assert.equal(c.bestClock(null, 'x', T, T + 10), null);
  const view = await text('views/boss.js');
  assert.match(view, /clock = bestClock\(clock, now, sentAt, Date\.now\(\)\)/);
  assert.match(view, /const serverNow = \(\) => Date\.now\(\) \+ \(clock \? clock\.offset : 0\);/);
  assert.doesNotMatch(view, /offset = clockOffset\(/, '답마다 새로 맞추지 않는다');
});

test('참전 마감 뒤(M2): 정보 줄이 "모집 중" 대신 "결과를 기다리는 중" · 마감 전·싸우는 중·시각을 모를 때는 그대로', async () => {
  const c = await import('../docs/lib/boss-core.js');
  const j = F({ phase: 'join', startAt: null, joinUntil: T });
  assert.equal(c.phaseText(j, T), '모집 중'); assert.equal(c.phaseText(j, T - 1), '모집 중');
  assert.equal(c.phaseText(j, T + 1), '결과를 기다리는 중'); assert.equal(c.phaseText(j, T + 89000), '결과를 기다리는 중');
  assert.equal(c.phaseText(j), '모집 중', '지금을 안 주면(목록·띠) 예전처럼');
  assert.equal(c.phaseText(F(), T + 1), '싸우는 중');
  const view = await text('views/boss.js');
  assert.match(view, /: phaseText\(last, serverNow\(\)\);/);
  // 장면도 같은 글(먼치킨 원본에서 옮긴 사본)
  const { joinWords } = await import('../docs/kiugi/s2/battle/timeline.js');
  assert.equal(joinWords(0).title, c.phaseText(j, T + 1)); assert.equal(joinWords(0).hint, null); assert.equal(joinWords(5).title, '참전 ' + c.phaseText(j, T));
});

test('장면 모듈을 못 받을 때(T7): 저절로 다시 해 보는 것은 두 번까지 · 그 뒤로는 멈추고 "다시 시도" 단추만(글도 그렇게)', async () => {
  const c = await import('../docs/lib/boss-core.js');
  assert.equal(c.LOAD_RETRY_MAX, 2);
  assert.deepEqual(c.loadRetryPlan(1), { poll: 15000, status: '15초 뒤에 다시 해 봐요' });
  assert.deepEqual(c.loadRetryPlan(2), { poll: 15000, status: '15초 뒤에 다시 해 봐요' });
  assert.deepEqual(c.loadRetryPlan(3), { poll: 0, status: '다시 시도를 눌러 주세요' });
  assert.deepEqual(c.loadRetryPlan(9), { poll: 0, status: '다시 시도를 눌러 주세요' });
  const view = await text('views/boss.js');
  assert.match(view, /const plan = loadRetryPlan\(\+\+loadFails\);/);
  assert.match(view, /plain\(plan\.status\);\s+return plan\.poll;/);
  assert.equal((view.match(/15초 뒤에 다시 해 봐요/g) || []).length, 0, '글은 한 곳(boss-core)에만');
  assert.match(view, /onclick: \(\) => location\.reload\(\) \}, '다시 시도'\)/);
  // 기다리는 동안 미리 받기도 두 번 못 받으면 그만(3초마다 되받지 않는다)
  assert.match(view, /if \(preFails < LOAD_RETRY_MAX\) loadScene\(\)\.catch\(\(\) => \{ preFails\+\+; \}\);/);
});

test('보스 날짜 말(2026-11-21 검수 S7b — 봇 s2-fix 와 같게): 보스는 "n일째"(몬스터 진화 "n단계"와 다른 말) · 목록·장면·도감 풀이 모두', async () => {
  const { bossText } = await import('../docs/lib/boss-core.js');
  assert.equal(bossText(F()), '심해 크라켄 9일째');
  assert.equal(bossText(F({ boss: { type: 'water', name: '심해 크라켄', stage: 0 } })), '심해 크라켄', '날을 모르면 이름만');
  const scene = await text('kiugi/s2/battle/battle-scene.js');
  assert.equal((scene.match(/\$\{boss0\.stage\}일째/g) || []).length, 3, '장면: 읽어 주는 이름 · 등장 글 · 왼쪽 위 이름 옆');
  assert.doesNotMatch(scene, /\$\{boss0\.stage\}단계/);
  const dex = await text('views/dex.js');
  assert.match(dex, /날마다 조금씩 세져요\(12월 n일 = n일째 보스\)/); assert.doesNotMatch(dex, /한 단계씩/);
});
