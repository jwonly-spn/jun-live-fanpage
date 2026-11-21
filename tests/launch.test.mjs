// 날짜로 저절로 바뀌기(2026-11-21): 2026-12-01 0시(한국) 전에는 예고 화면, 그때부터 시즌 2 화면 — 서버 시각으로 고른다.
//  진짜 오늘 날짜에 기대지 않는다(시계·서버 답·저장소를 모두 지어내 넘긴다).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { LAUNCH_AT, OPEN_KEY, GO_KEY, SKEW_KEY, CLOCK_FILE, pickScreen, parseServerDate, askClock, decideScreen, markStarted } from '../docs/lib/launch.js';
import { LAUNCH_AT as TEASER_AT } from '../docs/lib/teaser-time.js';
import { S2_START } from '../docs/lib/map-core.js';

const text = (name) => readFile(new URL('../docs/' + name, import.meta.url), 'utf8');
const kst = (s) => Date.parse(s + '+09:00');
const BEFORE = kst('2026-11-30T23:59:00'), AFTER = kst('2026-12-01T00:01:00'), MID = kst('2026-12-15T12:00:00');
// 지어낸 서버: Date 머리글로 serverNow() 를 답한다
const server = (serverNow, log = []) => async (url, opts) => { log.push({ url, opts }); return { headers: { get: (k) => (k.toLowerCase() === 'date' ? new Date(serverNow()).toUTCString() : null) } }; };
const store = (data = {}) => ({ data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } });
const ASK = 'https://example.invalid/notice.json';

test('시작 시각은 한 곳과 같다: 2026-12-01 00:00 한국 시각(예고 카운트다운 · 시즌 2 지도 · 맨 위 스크립트)', async () => {
  assert.equal(LAUNCH_AT, Date.parse('2026-12-01T00:00:00+09:00'));
  assert.equal(LAUNCH_AT, 1796050800000);
  assert.equal(TEASER_AT, LAUNCH_AT); assert.equal(S2_START, LAUNCH_AT);
  const stamp = createRequire(import.meta.url)('../tools/stamp.cjs');
  assert.equal(stamp.LAUNCH_AT, LAUNCH_AT);
  assert.equal(CLOCK_FILE, 'notice.json');
  assert.ok((await text(CLOCK_FILE)).length > 0, '서버 시각을 물을 파일이 있다');
});

test('화면 고르기: 11/30 23:59 = 예고 · 12/1 00:00 부터 시즌 2 · 12/15 = 시즌 2', () => {
  assert.equal(pickScreen(BEFORE), 'teaser');
  assert.equal(pickScreen(LAUNCH_AT - 1), 'teaser');
  assert.equal(pickScreen(LAUNCH_AT), 's2');
  assert.equal(pickScreen(AFTER), 's2');
  assert.equal(pickScreen(MID), 's2');
});

test('서버 시각(Date 머리글)으로 고른다 — 방문자 시계가 며칠 빠르거나 늦어도 같은 답', async () => {
  for (const [name, serverAt, want] of [['11/30 23:59', BEFORE, 'teaser'], ['12/1 00:01', AFTER, 's2'], ['12/15', MID, 's2']]) {
    for (const [skewName, skew] of [['맞는 시계', 0], ['3일 빠른 시계', 3 * 86400e3], ['3일 늦은 시계', -3 * 86400e3], ['20일 늦은 시계', -20 * 86400e3], ['40일 빠른 시계', 40 * 86400e3]]) {
      const log = [], local = store(), session = store();
      const r = await decideScreen({ fetchFn: server(() => serverAt, log), url: ASK, now: () => serverAt + skew, local, session });
      assert.equal(r.screen, want, `${name} · ${skewName}`);
      assert.equal(r.source, 'server');
      assert.ok(Math.abs(r.offset + skew) <= 1000, `시계 차이 ${r.offset}`);
      assert.deepEqual([log.length, log[0].url, log[0].opts.method, log[0].opts.cache], [1, ASK, 'HEAD', 'no-store'], '한 번만 · 머리글만 · 기억해 둔 답은 쓰지 않음');
      assert.equal(local.data[OPEN_KEY], want === 's2' ? '1' : undefined, '서버가 시작했다고 답했을 때만 적어 둔다');
    }
  }
});

test('서버가 시작했다고 답한 브라우저는 다음부터 묻지 않고 바로 시즌 2(시계가 거꾸로 가 있어도)', async () => {
  let asked = 0;
  const never = async () => { asked++; throw new Error('묻지 않아야 한다'); };
  const r = await decideScreen({ fetchFn: never, url: ASK, now: () => BEFORE, local: store({ [OPEN_KEY]: '1' }), session: store() });
  assert.deepEqual([r.screen, r.source, asked], ['s2', 'remembered', 0]);
  const r2 = await decideScreen({ fetchFn: never, url: ASK, now: () => BEFORE, local: store(), session: store({ [GO_KEY]: '1' }) });
  assert.deepEqual([r2.screen, r2.source, asked], ['s2', 'remembered', 0]);
});

test('서버에 못 닿으면 방문자 시계로 고르고(source: local) 적어 두지 않는다 — 못 닿음 · 머리글 없음 · 깨진 머리글 · 늦은 답', async () => {
  const cases = {
    '못 닿음': async () => { throw new TypeError('Failed to fetch'); },
    '머리글 없음': async () => ({ headers: { get: () => null } }),
    '깨진 머리글': async () => ({ headers: { get: () => '어제쯤' } }),
    '늦은 답': () => new Promise(() => {}),
  };
  for (const [name, fetchFn] of Object.entries(cases)) {
    for (const [at, want] of [[BEFORE, 'teaser'], [AFTER, 's2']]) {
      const local = store();
      const r = await decideScreen({ fetchFn, url: ASK, now: () => at, local, session: store(), timeoutMs: 20 });
      assert.deepEqual([r.screen, r.source, r.offset], [want, 'local', 0], name);
      assert.equal(local.data[OPEN_KEY], undefined, name + ': 방문자 시계로 고른 것은 적어 두지 않는다');
    }
  }
  assert.deepEqual(await askClock({ fetchFn: null, url: ASK }), { offset: 0, source: 'local' });
  assert.equal(parseServerDate('Mon, 30 Nov 2026 15:00:00 GMT'), LAUNCH_AT + 500, '초 단위로 잘린 머리글은 가운데(0.5초)로 본다');
  assert.equal(parseServerDate(''), null); assert.equal(parseServerDate(null), null);
});

test('막힌 저장소(사생활 모드)에서도 고르기는 된다', async () => {
  const blocked = { getItem() { throw new Error('막힘'); }, setItem() { throw new Error('막힘'); } };
  const r = await decideScreen({ fetchFn: server(() => AFTER), url: ASK, now: () => AFTER, local: blocked, session: blocked });
  assert.equal(r.screen, 's2');
  assert.equal(markStarted({ source: 'server', local: blocked, session: blocked }), false, '못 적었으면 false — app.js 가 새로 고치지 않는다(되풀이 방지)');
});

test('예고를 켜 둔 채 0시를 넘김: 적어 두고(true) 새로 고치면 바로 시즌 2 — 방문자 시계로 센 것이면 이 창에만 적는다', async () => {
  const local = store(), session = store();
  assert.equal(markStarted({ source: 'server', local, session }), true);
  assert.deepEqual([local.data[OPEN_KEY], session.data[GO_KEY]], ['1', '1']);
  const l2 = store(), s2 = store();
  assert.equal(markStarted({ source: 'local', local: l2, session: s2 }), true);
  assert.deepEqual([l2.data[OPEN_KEY], s2.data[GO_KEY]], [undefined, '1']);
  const r = await decideScreen({ fetchFn: async () => { throw new Error('묻지 않는다'); }, url: ASK, now: () => LAUNCH_AT - 400, local: l2, session: s2 });
  assert.equal(r.screen, 's2', '새로 고친 뒤 서버 머리글이 1초쯤 늦게 보여도 다시 예고로 돌아가지 않는다');
});

test('맞춘 시계: 서버에 물었을 때의 시계 차이를 이 창에 적어 두고, 시즌 2 화면의 "남은 날"이 그 시계를 쓴다(기기 시계가 2분 늦어도 0시 뒤에 "시작 전"이라고 하지 않는다)', async () => {
  const { SKEW_KEY: K2, setSkew, siteNow } = await import('../docs/lib/clock.js');
  assert.equal(K2, SKEW_KEY);
  // 기기 시계가 2분 늦은 방문자가 23:59:50(서버)에 예고를 열었다
  const slow = -120e3, local = store(), session = store();
  const first = await decideScreen({ fetchFn: server(() => LAUNCH_AT - 10e3), url: ASK, now: () => LAUNCH_AT - 10e3 + slow, local, session });
  assert.equal(first.screen, 'teaser');
  assert.ok(Math.abs(Number(session.data[SKEW_KEY]) + slow) <= 1000, '차이를 이 창에 적어 둔다');
  assert.equal(local.data[SKEW_KEY], undefined, '오래 남는 저장소에는 적지 않는다(나중에 시계를 고치면 틀린 값이 된다)');
  // 0시가 되어 새로 고침 → 묻지 않고 시즌 2, 적어 둔 차이를 이어 쓴다
  markStarted({ source: 'server', local, session });
  const again = await decideScreen({ fetchFn: async () => { throw new Error('묻지 않는다'); }, url: ASK, now: () => LAUNCH_AT + 5e3 + slow, local, session });
  assert.deepEqual([again.screen, again.source], ['s2', 'remembered']);
  assert.ok(Math.abs(again.offset + slow) <= 1000);
  // 차이가 없으면 0
  assert.equal((await decideScreen({ fetchFn: null, url: ASK, now: () => MID, local: store({ [OPEN_KEY]: '1' }), session: store() })).offset, 0);
  // 맞춘 시계
  const realNow = Date.now;
  try {
    Date.now = () => LAUNCH_AT + 5e3 + slow; // 기기는 아직 11/30 23:58:05
    assert.equal(setSkew(session.data[SKEW_KEY]), Number(session.data[SKEW_KEY]));
    assert.ok(siteNow() >= LAUNCH_AT, '맞춘 시계는 0시를 넘었다');
    const { seasonClock } = await import('../docs/lib/map-core.js');
    assert.equal(seasonClock(null, siteNow()).state, 'during');
    assert.equal(seasonClock(null, Date.now()).state, 'before', '(기기 시계 그대로면 "시작 전"으로 보였을 것)');
    assert.equal(setSkew('깨진 값'), 0); assert.equal(setSkew(null), 0);
    assert.equal(siteNow(), Date.now());
  } finally { Date.now = realNow; setSkew(0); }
  assert.match(await text('views/home.js'), /map\.updatedAt : siteNow\(\), c = seasonClock\(map, now\)/);
  assert.match(await text('s2-app.js'), /try \{ setSkew\(window\.sessionStorage\.getItem\(SKEW_KEY\)\); \} catch \{ setSkew\(0\); \}/);
});

test('시작점(app.js): 서버 시각으로 고른 화면만 그린다 · 예고에는 맞춘 시계와 "시작" 알림을 넘긴다 · 시즌 2 길잡이는 그때만 받는다', async () => {
  const app = await text('app.js');
  assert.match(app, /decideScreen\(\{ url: new URL\('\.\/notice\.json', import\.meta\.url\)\.href, local, session \}\)/);
  assert.match(app, /if \(pick\.screen === 's2'\) \{ await import\('\.\/s2-app\.js'\); return; \}/);
  assert.match(app, /now: \(\) => Date\.now\(\) \+ pick\.offset/);
  assert.match(app, /Date\.now\(\) \+ pick\.offset >= LAUNCH_AT && markStarted\(\{ source: pick\.source, local, session \}\)\) location\.reload\(\)/);
  assert.match(app, /classList\.toggle\('s2-teaser', screen === 'teaser'\)/);
  assert.doesNotMatch(app, /^import [^\n]*(teaser|s2-app|route|api)\.js/m, '두 화면 모듈은 고른 뒤에만 받는다(정적 import 없음)');
  assert.doesNotMatch(app, /location\.search|URLSearchParams|\?now=/, '주소로 날짜를 속이는 길은 없다');
  const teaser = await text('views/teaser.js');
  assert.match(teaser, /export function renderTeaser\(root, \{ now = \(\) => Date\.now\(\), onStart = null \} = \{\}\)/);
  assert.match(teaser, /countdown\(now\(\)\)/);
  assert.match(teaser, /if \(started\) \{ clearInterval\(ticker\); try \{ onStart\?\.\(\); \}/);
  const s2 = await text('s2-app.js');
  for (const s of ["import('./views/boss.js')", "import('./views/dex.js')", "import('./views/home.js')"]) assert.ok(s2.includes(s), s);
  assert.doesNotMatch(s2, /teaser/);
});

// 맨 위 작은 스크립트를 지어낸 브라우저에서 돌려 본다
function runBoot(boot, { now, local = {}, session = {}, blocked = false }) {
  const links = [], classes = new Set(['s2-teaser']);
  const storage = (data) => ({ getItem: (k) => { if (blocked) throw new Error('막힘'); return k in data ? data[k] : null; } });
  const ctx = {
    Date: { now: () => now },
    localStorage: storage(local), sessionStorage: storage(session),
    document: {
      documentElement: { classList: { remove: (c) => classes.delete(c) } },
      createElement: () => ({}),
      head: { appendChild: (l) => links.push(l) },
    },
  };
  vm.runInNewContext(boot, ctx);
  return { links, teaser: classes.has('s2-teaser') };
}

test('맨 위 작은 스크립트(첫 색·미리 받기): 시작 전에는 예고 색 그대로 + 예고 모듈만 · 지도 파일·서버 연결 없음 / 시작 뒤에는 시즌 2 모듈 + 지도 미리 받기', async () => {
  const { plan } = createRequire(import.meta.url)('../tools/stamp.cjs');
  const p = plan(), html = await text('index.html');
  assert.ok(html.includes(`<script>${p.boot}</script>`), '찍힌 글 = 지금 파일로 만든 글(node tools/stamp.cjs)');
  assert.ok(html.includes(p.bootHash), 'CSP 에 이 글의 해시');
  assert.ok(html.indexOf('<script type="importmap">') < html.indexOf(`<script>${p.boot}`), 'import map 이 먼저');
  assert.ok(html.indexOf(`<script>${p.boot}`) < html.indexOf('rel="stylesheet"'), '스타일을 기다리지 않게 스타일 링크보다 앞');
  assert.match(html, /<html lang="ko" class="s2-teaser">/);

  const before = runBoot(p.boot, { now: BEFORE });
  assert.equal(before.teaser, true);
  assert.deepEqual(before.links.map((l) => l.rel), p.preloadTeaser.map(() => 'modulepreload'));
  assert.deepEqual(before.links.map((l) => l.href), p.preloadTeaser);
  assert.ok(!before.links.some((l) => /supabase/.test(l.href)), '예고 화면은 서버에 연결하지 않는다');

  for (const [name, opt] of [['12/1 00:01', { now: AFTER }], ['12/15', { now: MID }], ['서버가 시작했다고 답한 적 있음', { now: BEFORE, local: { kg_s2_open: '1' } }], ['0시를 넘겨 새로 고침', { now: BEFORE, session: { kg_s2_go: '1' } }]]) {
    const r = runBoot(p.boot, opt);
    assert.equal(r.teaser, false, name);
    assert.deepEqual(r.links.slice(0, 2).map((l) => [l.rel, l.href, l.as, l.crossOrigin]), [
      ['preconnect', 'https://aksegkhhugqvvaidgvro.supabase.co', undefined, 'anonymous'],
      ['preload', 'https://aksegkhhugqvvaidgvro.supabase.co/storage/v1/object/public/tr-snap/map.json', 'fetch', 'anonymous'],
    ], name);
    assert.deepEqual(r.links.slice(2).map((l) => l.href), p.preloadS2, name);
  }
  // 막힌 저장소: 기기 시계만으로
  assert.equal(runBoot(p.boot, { now: BEFORE, blocked: true }).teaser, true);
  assert.equal(runBoot(p.boot, { now: AFTER, blocked: true }).teaser, false);
});

test('검색·공유용 글(meta)은 날짜로 못 바꾸므로 12월 1일 전에도 뒤에도 맞는 말 · 미리보기 그림만 12월 1일 전 올림본은 지금 공개본 그대로(COMING SOON)', async () => {
  const html = await text('index.html');
  const meta = (attr, name) => new RegExp(`<meta ${attr}="${name.replace(/[.:]/g, '\\$&')}" content="([^"]*)">`).exec(html)?.[1];
  const words = [meta('name', 'description'), meta('property', 'og:title'), meta('property', 'og:description'), /<title>([^<]*)<\/title>/.exec(html)[1], /<noscript>([\s\S]*?)<\/noscript>/.exec(html)[1]];
  for (const w of words) {
    assert.ok(w && w.length > 0);
    assert.doesNotMatch(w, /COMING SOON|곧 시작|시작됐어요|시작했어요|카운트다운|예고|진행 중|지금 열렸/, w);
  }
  assert.match(meta('name', 'description'), /2026년 12월 1일 0시~12월 31일/);
  assert.match(meta('property', 'og:description'), /2026년 12월 1일 0시부터 12월 31일까지/);
  // 미리보기 그림과 그 설명(alt)은 12월 1일까지 지금 공개본(main 8e3e240)과 같게 — 사용자 11/21 "추천대로"(12/1 뒤 정리 때 지도 그림 docs/og.png 로)
  assert.equal(meta('property', 'og:image'), 'https://www.xn--ok0bp87bn6g.com/teaser/og.png', '12/1 전 올림본의 og:image = teaser/og.png');
  assert.equal(meta('property', 'og:image:alt'), '키우기 시즌 2 COMING SOON — 12월 1일 시작, DJ의 땅이 펼쳐지는 예시 지도', '그림 설명도 그 그림에 맞는 main 글');
});

test('스타일: 시즌 2 의 어두운 모드 색과 공용 초점 테두리 색은 예고에 안 걸린다(어두운 모드 기기에서도 지금 예고 색 그대로 — 고침 1회차 I1·M1)', async () => {
  const raw = await text('styles.css');
  const at = raw.indexOf('/* ===== 아래는 예고 화면');
  assert.ok(at > 0);
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
  const dark = [...strip(raw).matchAll(/@media \(prefers-color-scheme: dark\)\s*\{\s*([^{]+?)\s*\{/g)].map((m) => m[1].trim());
  assert.ok(dark.length > 0, '시즌 2 어두운 모드 덩어리가 있다');
  for (const sel of dark) for (const one of sel.split(',')) assert.match(one, /:not\(\.s2-teaser\)/, `어두운 모드 규칙이 예고에도 걸림: ${one.trim()}`);
  assert.match(strip(raw.slice(at)), /:where\(\.s2-teaser\) :focus-visible \{ outline-color: var\(--ink\); \}/, '예고의 기본 초점 테두리는 지금처럼 --ink(밝은 글색)');
});

test('스타일: 예고 덩어리는 html.s2-teaser 일 때만 걸린다(시즌 2 화면의 규칙을 덮지 않는다)', async () => {
  const css = await text('styles.css');
  const at = css.indexOf('/* ===== 아래는 예고 화면');
  assert.ok(at > 0);
  const teaserCss = css.slice(at).replace(/\/\*[\s\S]*?\*\//g, '');
  const loose = [];
  for (const m of teaserCss.matchAll(/(?:^|[{}])\s*([^{}@]+?)\s*\{/g)) {
    for (const sel of m[1].split(',').map((x) => x.trim())) if (sel && !/s2-teaser|\.tz-|^(from|to|\d+(\.\d+)?%)$/.test(sel)) loose.push(sel);
  }
  assert.deepEqual(loose, [], '예고가 아닐 때도 걸리는 규칙');
  assert.match(css.slice(0, at), /^\.s2-label small \{/m, '시즌 2 화면의 이름표 규칙은 앞쪽에 그대로');
});
