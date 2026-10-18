// 2026-10-18 사이트 새 구조(SNS · 빠르게): 내 캐릭터(지난 방문 뒤 달라진 것)·연속 방문·하루 하트 미션(lib/me.js), 하트 바로 올리기(lib/hearts.js sendHeart),
//  서버 답 기억(lib/swr.js), 캐릭터 사진 칸·열쇠·가벼운 사본(lib/raster.js), 새로 올린 파일이 바로 보이게(tools/stamp.cjs), 메인·DJ 페이지 도우미.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { getMe, listMine, addMine, removeMine, clearMine, isMine, listFavs, addFav, removeFav, isFav, toggleFav, charKey, matchSaved, snapOf, diffSnap, observe, streakAfter, bumpStreak, missionOf,
  VISIT_GAP, HEART_GOAL, MINE_MAX, FAV_MAX, SNAP_SPARE } from '../docs/lib/me.js';
import { sendHeart, sentToday, sentCount, heartKey, markSent } from '../docs/lib/hearts.js';
import { swr, peekCached, sameData, primePreview, peekPreview, _resetSwr } from '../docs/lib/swr.js';
import { CROPS, cropOf, scaleFor, rasterKey, liteUrl, petFit, hashText, FEMALE, faceExtras } from '../docs/lib/raster.js';
import { ART } from '../docs/lib/kiugi-draw.js';

const require = createRequire(import.meta.url);
const docs = fileURLToPath(new URL('../docs/', import.meta.url));
const memStore = () => { const box = new Map(); return { box, getItem: (k) => (box.has(k) ? box.get(k) : null), setItem: (k, v) => box.set(k, String(v)), removeItem: (k) => box.delete(k), get length() { return box.size; }, key: (i) => [...box.keys()][i] ?? null }; };
const broken = { getItem() { throw new Error('막힘'); }, setItem() { throw new Error('막힘'); }, removeItem() { throw new Error('막힘'); } };
const T = Date.parse('2026-10-20T03:00:00Z'); // 한국 2026-10-20 12:00

const A = { slug: 'nyangdj7', id: '밤톨#먼치', djName: '먼치' }, B = { slug: 'cuky2345', id: '귤껍질#쿠키', djName: '쿠키' }, C = { slug: 'jery2468', id: '밤톨#젤리', djName: '젤리' };
const readJson = (s, k) => JSON.parse(s.getItem(k));

test('내 캐릭터 여러 명(lib/me.js): 주소·아이디 모양만 받고, 넣은 차례대로 · 같은 캐릭터는 한 번 · 12명까지 · 빼기와 되돌리기(같은 자리)', () => {
  const s = memStore();
  assert.deepEqual(listMine(s), []); assert.equal(getMe(s), null);
  assert.deepEqual(addMine(s, { slug: 'nyangdj7', id: '밤톨' }), { ok: false, reason: 'invalid' }, '아이디는 전체(밤톨#먼치)');
  assert.equal(addMine(s, { slug: 'NYANG', id: '밤톨#먼치' }).ok, false, '이상한 주소');
  const r = addMine(s, A, T);
  assert.deepEqual(r, { ok: true, entry: { slug: 'nyangdj7', id: '밤톨#먼치', base: '밤톨', djName: '먼치', at: T }, added: true, index: 0 });
  addMine(s, B, T + 1); addMine(s, C, T + 2);
  assert.deepEqual(listMine(s).map((e) => e.id), ['밤톨#먼치', '귤껍질#쿠키', '밤톨#젤리'], '넣은 차례(처음 정한 캐릭터가 맨 앞) — 같은 앞 이름이라도 방송이 다르면 다른 캐릭터');
  assert.equal(getMe(s).id, '밤톨#먼치', 'getMe = 첫 번째');
  const again = addMine(s, { ...A, id: '밤톨#먼치'.normalize('NFD'), djName: '먼치2' }, T + 9);
  assert.equal(again.added, false, '풀어 쓴 한글도 같은 캐릭터 — 한 번만'); assert.equal(listMine(s).length, 3);
  assert.equal(listMine(s)[0].djName, '먼치2', 'DJ 이름만 새로'); assert.equal(listMine(s)[0].at, T, '넣은 때는 그대로');
  assert.equal(isMine(s, 'cuky2345', '귤껍질#쿠키'), true); assert.equal(isMine(s, 'nyangdj7', '귤껍질#쿠키'), false, '다른 방송');
  // 빼기 → 되돌리기(같은 자리 · 같은 넣은 때)
  const gone = removeMine(s, 'cuky2345', '귤껍질#쿠키');
  assert.deepEqual(gone, { entry: { slug: 'cuky2345', id: '귤껍질#쿠키', base: '귤껍질', djName: '쿠키', at: T + 1 }, index: 1 });
  assert.equal(removeMine(s, 'cuky2345', '귤껍질#쿠키'), null, '없는 것');
  assert.deepEqual(listMine(s).map((e) => e.id), ['밤톨#먼치', '밤톨#젤리']);
  addMine(s, gone.entry, gone.entry.at, { index: gone.index });
  assert.deepEqual(listMine(s).map((e) => [e.id, e.at]), [['밤톨#먼치', T], ['귤껍질#쿠키', T + 1], ['밤톨#젤리', T + 2]]);
  // 12명까지
  const t = memStore();
  const names = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파'];
  for (let i = 0; i < MINE_MAX; i++) assert.equal(addMine(t, { slug: 'nyangdj7', id: `${names[i]}#먼치` }, T + i).ok, true);
  assert.deepEqual(addMine(t, { slug: 'nyangdj7', id: '파#먼치' }), { ok: false, reason: 'full', max: 12 });
  assert.equal(addMine(t, { slug: 'nyangdj7', id: '가#먼치' }).ok, true, '이미 있는 캐릭터는 가득 차도 괜찮다');
  // 저장소에 이상한 줄이 섞여 있어도 맞는 것만 · 같은 것은 한 번
  const u = memStore();
  u.setItem('kg_mine', JSON.stringify([A, { slug: 'x', id: '밤톨#먼치' }, { slug: 'nyangdj7', id: 5 }, null, A, B]));
  assert.deepEqual(listMine(u).map((e) => e.id), ['밤톨#먼치', '귤껍질#쿠키']);
  clearMine(s); assert.deepEqual(listMine(s), []); assert.equal(s.box.has('kg_mine_snap'), false);
});

test('예전 내 캐릭터(하나만 — kg_me)는 처음 읽을 때 목록 하나로 옮기고, 지난 모습(kg_me_snap)도 그 캐릭터 몫으로 — 예전 열쇠는 지운다', () => {
  const s = memStore();
  const snap = { base: { level: 3, hearts: 2, worn: {}, rank: null, pet: null, titles: [], season: 's1', at: T - 864e5 }, cur: { level: 4, hearts: 5, worn: {}, rank: null, pet: null, titles: [], season: 's1', at: T - 3600e3 }, curAt: T - 3600e3 };
  s.setItem('kg_me', JSON.stringify({ slug: 'nyangdj7', id: '밤톨#먼치', djName: '먼치', at: T - 5 * 864e5 }));
  s.setItem('kg_me_snap', JSON.stringify(snap));
  assert.deepEqual(listMine(s), [{ slug: 'nyangdj7', id: '밤톨#먼치', base: '밤톨', djName: '먼치', at: T - 5 * 864e5 }], '고른 캐릭터를 그대로');
  assert.equal(s.box.has('kg_me'), false); assert.equal(s.box.has('kg_me_snap'), false, '예전 열쇠는 지운다');
  assert.deepEqual(readJson(s, 'kg_mine_snap'), { 'nyangdj7/밤톨#먼치': snap });
  // 옮긴 지난 모습으로 바로 소식(1시간 전 마지막 모습 → 새 방문)
  const r = observe(s, listMine(s)[0], snapOf({ season: { id: 's1' }, level: 5, hearts: 9 }, {}, T), T);
  assert.equal(r.baseline.hearts, 5); assert.deepEqual(r.diff.changes.map((c) => [c.kind, c.from, c.to]), [['hearts', 5, 9], ['level', 4, 5]]);
  // 한 번 옮긴 뒤에는 다시 옮기지 않는다(다 빼도 빈 목록 그대로)
  removeMine(s, 'nyangdj7', '밤톨#먼치');
  s.setItem('kg_me', JSON.stringify({ slug: 'cuky2345', id: '귤껍질#쿠키' }));
  assert.deepEqual(listMine(s), [], '새 목록이 있으면 예전 열쇠는 보지 않는다');
  // 예전 값이 깨져 있으면 빈 목록 · 예전 값이 없으면 아무것도 쓰지 않는다
  const bad = memStore(); bad.setItem('kg_me', '{not json'); assert.deepEqual(listMine(bad), []);
  const none = memStore(); assert.deepEqual(listMine(none), []); assert.equal(none.box.size, 0);
  const odd = memStore(); odd.setItem('kg_me', JSON.stringify({ slug: 'NYANG', id: '밤톨' })); assert.deepEqual(listMine(odd), []); assert.deepEqual(readJson(odd, 'kg_mine'), []); assert.equal(odd.box.has('kg_me'), false);
});

test('내 캐릭터·즐겨찾기: 저장소가 막혀도(사생활 모드 등) 이번 창에서는 기억 · 다른 저장소에는 섞이지 않는다', () => {
  assert.equal(addMine(broken, A, T).ok, true);
  assert.equal(getMe(broken)?.id, '밤톨#먼치');
  assert.equal(addFav(broken, B, T).ok, true); assert.equal(isFav(broken, 'cuky2345', '귤껍질#쿠키'), true);
  assert.deepEqual(listMine(memStore()), [], '쓸 수 있는 저장소에는 이번 창 메모리가 섞이지 않는다');
  assert.deepEqual(listFavs(memStore()), []);
  removeFav(broken, 'cuky2345', '귤껍질#쿠키'); clearMine(broken);
  assert.equal(getMe(broken), null); assert.deepEqual(listFavs(broken), []);
  // 쓰기만 막힌 저장소(읽기는 됨 — 예전 사파리 사생활 모드): 이번 창 메모리 값이 보인다
  const ro = { ...memStore(), setItem() { throw new Error('꽉 참'); } };
  assert.equal(addMine(ro, B, T).ok, true); assert.equal(isMine(ro, 'cuky2345', '귤껍질#쿠키'), true);
  clearMine(ro);
});

test('즐겨찾기(lib/me.js): 새로 넣은 것이 맨 앞 · 같은 캐릭터는 한 번 · 30개까지 · 빼기와 되돌리기 · 누를 때마다 넣었다 뺐다 · 찾기 칸 글로 거르기', () => {
  const s = memStore();
  assert.equal(addFav(s, { slug: 'nyangdj7', id: '밤톨' }).reason, 'invalid');
  addFav(s, A, T); addFav(s, B, T + 1);
  assert.deepEqual(listFavs(s).map((e) => e.id), ['귤껍질#쿠키', '밤톨#먼치'], '새로 넣은 것이 앞');
  assert.equal(addFav(s, A, T + 5).added, false); assert.equal(listFavs(s).length, 2);
  assert.equal(isFav(s, 'nyangdj7', '밤톨#먼치'), true); assert.equal(isMine(s, 'nyangdj7', '밤톨#먼치'), false, '즐겨찾기와 내 캐릭터는 따로');
  const g = removeFav(s, 'cuky2345', '귤껍질#쿠키');
  assert.equal(g.index, 0); assert.deepEqual(listFavs(s).map((e) => e.id), ['밤톨#먼치']);
  addFav(s, g.entry, g.entry.at, { index: g.index });
  assert.deepEqual(listFavs(s).map((e) => e.id), ['귤껍질#쿠키', '밤톨#먼치'], '되돌리면 같은 자리');
  assert.deepEqual(toggleFav(s, C, T), { ok: true, on: true, entry: { slug: 'jery2468', id: '밤톨#젤리', base: '밤톨', djName: '젤리', at: T } });
  assert.deepEqual(toggleFav(s, C, T), { ok: true, on: false });
  // 30개까지(넘으면 넣지 않는다 — 오래된 것을 몰래 지우지 않는다)
  const t = memStore(), syl = '가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허고노도'.split('');
  for (let i = 0; i < FAV_MAX; i++) assert.equal(addFav(t, { slug: 'nyangdj7', id: `${syl[i]}#먼치` }, T + i).ok, true);
  assert.deepEqual(toggleFav(t, { slug: 'nyangdj7', id: '로#먼치' }, T), { ok: false, on: false, reason: 'full', max: 30 });
  assert.equal(listFavs(t).length, 30);
  // 찾기 칸 글로 거르기: 아이디 · DJ 이름(띄어쓰기 뺌), 빈 글은 모두
  const e = listFavs(s)[1];
  assert.equal(matchSaved(e, ''), true); assert.equal(matchSaved(e, '밤'), true); assert.equal(matchSaved(e, '밤톨#먼'), true); assert.equal(matchSaved(e, ' 먼 치 '), true, 'DJ 이름');
  assert.equal(matchSaved(e, '귤'), false); assert.equal(matchSaved(e, '밤톨'.normalize('NFD')), true);
  assert.equal(charKey('nyangdj7', '밤톨#먼치'.normalize('NFD')), 'nyangdj7/밤톨#먼치');
});

test('지난 방문 뒤 달라진 것(diffSnap): 하트·레벨·옷·인기 순위·펫·칭호, 시즌이 바뀌면 견주지 않는다, 처음이면 first', () => {
  const prev = snapOf({ season: { id: 's1' }, level: 6, hearts: 3, worn: { top: 'top_01', bottom: 'bottom_02' }, pet: { id: 'ghost', stage: 1 }, titles: [] }, { rank: 5 }, T);
  assert.deepEqual(diffSnap(null, prev), { first: true, newSeason: false, changes: [], up: false });
  const same = diffSnap(prev, { ...prev });
  assert.deepEqual(same.changes, []); assert.equal(same.up, false);
  const now = snapOf({ season: { id: 's1' }, level: 7, hearts: 8, worn: { top: 'top_05', bottom: 'bottom_02', hat: 'hat_09' }, pet: { id: 'ghost', stage: 2 }, titles: ['title-candy-plz'] }, { rank: 2 }, T);
  const d = diffSnap(prev, now);
  assert.deepEqual(d.changes.map((c) => [c.kind, c.from, c.to]), [['hearts', 3, 8], ['level', 6, 7], ['worn', 0, 2], ['rank', 5, 2], ['pet', 1, 2], ['title', null, 'title-candy-plz']]);
  assert.equal(d.up, true);
  // 순위만 내려가거나 빠지면 자란 것이 아니다
  assert.equal(diffSnap(prev, { ...prev, rank: 9 }).up, false);
  assert.deepEqual(diffSnap(prev, { ...prev, rank: null }).changes, [{ kind: 'rank', from: 5, to: null }]);
  assert.equal(diffSnap({ ...prev, rank: null }, { ...prev, rank: 4 }).up, true, '처음 인기에 들면 자란 것');
  // 새 펫(다른 펫과 함께) · 옷을 벗기만 한 칸은 "새 옷"이 아니다
  assert.deepEqual(diffSnap(prev, { ...prev, pet: { id: 'bat', stage: 1 } }).changes, [{ kind: 'pet', from: null, to: 1, id: 'bat' }]);
  assert.deepEqual(diffSnap(prev, { ...prev, worn: { top: 'top_01' } }).changes, []);
  // 시즌이 바뀌면
  assert.deepEqual(diffSnap(prev, { ...now, season: 's2' }), { first: false, newSeason: true, changes: [], up: false });
  // 모양: 이상한 값은 버린다
  assert.deepEqual(snapOf({ level: 'x', hearts: -3, worn: { top: 5, bottom: 'bottom_01' }, pet: { id: 3 } }, { rank: 0 }, T), { season: null, level: 1, hearts: 0, worn: { bottom: 'bottom_01' }, rank: null, pet: null, titles: [], at: T });
});

test('방문 기준(observe): 30분 안에 다시 보면 같은 기준(새로 고쳐도 같은 소식), 30분 넘게 지나 오면 지난번 마지막 모습이 새 기준', () => {
  const s = memStore();
  addMine(s, A, T);
  const a = snapOf({ level: 3, hearts: 1 }, {}, T);
  assert.equal(observe(s, A, a, T).diff.first, true, '처음 정한 뒤 첫 방문');
  const b = snapOf({ level: 3, hearts: 4 }, {}, T + 5 * 60e3);
  assert.equal(observe(s, A, b, T + 5 * 60e3).diff.first, true, '같은 방문(30분 안) — 기준 그대로(없음)');
  const c = snapOf({ level: 4, hearts: 6 }, {}, T + 3 * 3600e3);
  const r = observe(s, A, c, T + 3 * 3600e3);
  assert.deepEqual(r.baseline.hearts, 4, '새 방문 — 지난번 마지막 모습(하트 4)이 기준');
  assert.deepEqual(r.diff.changes.map((x) => x.kind), ['hearts', 'level']);
  assert.deepEqual(observe(s, A, c, T + 3 * 3600e3 + 60e3).diff.changes.map((x) => x.kind), ['hearts', 'level'], '같은 방문 안에서는 같은 소식');
  assert.equal(VISIT_GAP, 30 * 60e3);
  // 막힌 저장소에서도 멈추지 않는다 · 모양이 틀린 캐릭터는 적지 않는다
  assert.equal(observe(broken, A, a, T).diff.first !== undefined, true);
  const before = s.getItem('kg_mine_snap');
  assert.equal(observe(s, { slug: 'x', id: '밤톨' }, a, T).diff.first, true); assert.equal(s.getItem('kg_mine_snap'), before);
});

test('지난 모습은 캐릭터마다 따로 · 뺀 캐릭터 기록은 최근 6개까지 남겨 다시 넣으면 이어서', () => {
  const s = memStore();
  addMine(s, A, T); addMine(s, B, T);
  observe(s, A, snapOf({ level: 2, hearts: 1 }, {}, T), T);
  observe(s, B, snapOf({ level: 7, hearts: 50 }, {}, T), T);
  const later = T + 2 * 3600e3;
  const ra = observe(s, A, snapOf({ level: 3, hearts: 4 }, {}, later), later);
  const rb = observe(s, B, snapOf({ level: 7, hearts: 50 }, {}, later), later);
  assert.deepEqual(ra.diff.changes.map((c) => [c.kind, c.from, c.to]), [['hearts', 1, 4], ['level', 2, 3]], '밤톨#먼치 는 그 기록과');
  assert.deepEqual(rb.diff.changes, [], '귤껍질#쿠키 는 그 기록과(그대로)');
  assert.deepEqual(Object.keys(readJson(s, 'kg_mine_snap')).sort(), ['cuky2345/귤껍질#쿠키', 'nyangdj7/밤톨#먼치']);
  // 빼도 기록은 남는다 → 다시 넣고 다음 방문에 이어서
  removeMine(s, 'nyangdj7', '밤톨#먼치');
  observe(s, B, snapOf({ level: 7, hearts: 51 }, {}, later + 60e3), later + 60e3);
  assert.ok(readJson(s, 'kg_mine_snap')['nyangdj7/밤톨#먼치'], '뺀 캐릭터 기록도 남아 있다');
  addMine(s, A, later + 120e3);
  const back = observe(s, A, snapOf({ level: 4, hearts: 9 }, {}, later + 3 * 3600e3), later + 3 * 3600e3);
  assert.equal(back.diff.first, false); assert.equal(back.baseline.hearts, 4, '다시 넣으면 지난번 마지막 모습부터');
  // 내 캐릭터가 아닌 기록은 최근 본 6개까지만
  const t = memStore(), syl = '가나다라마바사아자차'.split('');
  addMine(t, A, T);
  syl.forEach((x, i) => observe(t, { slug: 'nyangdj7', id: `${x}#먼치` }, snapOf({ level: 1, hearts: i }, {}, T + i), T + i));
  observe(t, A, snapOf({ level: 1, hearts: 0 }, {}, T + 100), T + 100);
  const keys = Object.keys(readJson(t, 'kg_mine_snap'));
  assert.equal(keys.length, 1 + SNAP_SPARE); assert.ok(keys.includes('nyangdj7/밤톨#먼치'));
  assert.ok(keys.includes('nyangdj7/차#먼치') && !keys.includes('nyangdj7/가#먼치'), '오래된 것부터 지운다');
});

test('연속 방문(streakAfter·bumpStreak, 한국 날짜)과 하루 하트 미션(missionOf)', () => {
  assert.deepEqual(streakAfter(null, '2026-10-20'), { day: '2026-10-20', n: 1, best: 1, today: true });
  assert.deepEqual(streakAfter({ day: '2026-10-19', n: 4, best: 6 }, '2026-10-20'), { day: '2026-10-20', n: 5, best: 6, today: true });
  assert.deepEqual(streakAfter({ day: '2026-10-20', n: 5, best: 6 }, '2026-10-20'), { day: '2026-10-20', n: 5, best: 6, today: false }, '같은 날은 그대로');
  assert.deepEqual(streakAfter({ day: '2026-10-17', n: 9, best: 9 }, '2026-10-20'), { day: '2026-10-20', n: 1, best: 9, today: true }, '하루 빠지면 1부터');
  assert.deepEqual(streakAfter({ day: 'x', n: 'y' }, '2026-11-01').n, 1);
  assert.deepEqual(streakAfter({ day: '2026-10-31', n: 2, best: 2 }, '2026-11-01').n, 3, '달이 바뀌어도 어제');
  const s = memStore();
  assert.equal(bumpStreak(s, T).n, 1); assert.equal(bumpStreak(s, T + 864e5).n, 2); assert.equal(bumpStreak(s, T + 864e5 + 3600e3).n, 2);
  assert.equal(bumpStreak(broken, T).n, 1, '막힌 저장소');
  assert.equal(HEART_GOAL, 3);
  assert.deepEqual(missionOf(0), { sent: 0, goal: 3, done: false, left: 3 });
  assert.deepEqual(missionOf(4), { sent: 4, goal: 3, done: true, left: 0 });
  // 오늘 보낸 하트 수
  const h = memStore();
  assert.equal(sentCount(h, T), 0);
  markSent(h, heartKey('nyangdj7', '밤톨#먼치', 's1'), T); markSent(h, heartKey('cuky2345', '귤껍질#쿠키', 's1'), T);
  assert.equal(sentCount(h, T), 2); assert.equal(sentCount(h, T + 864e5), 0, '다음 날은 0');
});

test('하트 바로 올리기(sendHeart): 누르는 즉시 +1, 서버 답이 오면 그 수로·오늘 보냄 기억, 실패하면 원래 수로(기억 안 함), 오늘 이미 보냈으면 묻지 않는다', async () => {
  // (앞 시험이 밤톨#먼치 를 보낸 것으로 메모리에 적어 두어 — 이 시험은 다른 아이디로)
  const s = memStore(), card = { slug: 'nyangdj7', id: '별사탕#먼치', seasonId: 's1', hearts: 12 };
  let calls = 0;
  const ok = sendHeart(card, { storage: s, now: T, send: async (slug, id, token) => { calls++; assert.equal(slug, 'nyangdj7'); assert.match(token, /^[A-Za-z0-9_-]{32}$/); return { hearts: 15, already: false }; } });
  assert.equal(ok.already, false); assert.equal(ok.optimistic, 13, '바로 +1');
  assert.deepEqual(await ok.done, { ok: true, hearts: 15, already: false }, '서버 수로 맞춘다');
  assert.equal(sentToday(s, heartKey('nyangdj7', '별사탕#먼치', 's1'), T), true);
  const again = sendHeart({ ...card, hearts: 15 }, { storage: s, now: T, send: async () => { calls++; return {}; } });
  assert.equal(again.already, true); assert.equal(again.optimistic, 15); assert.equal(calls, 1, '오늘 보낸 캐릭터는 서버에 묻지 않는다');
  // (hearts.js 는 저장소가 막혀도 이번 창에서 기억하려고 메모리에도 적는다 — 그래서 실패는 다른 캐릭터로 본다)
  const f = memStore(), other = { ...card, id: '사탕요정#먼치' };
  const bad = sendHeart(other, { storage: f, now: T, send: async () => { throw Object.assign(new Error('잠시 뒤에 다시 해 주세요.'), { status: 429 }); } });
  assert.equal(bad.optimistic, 13);
  const r = await bad.done;
  assert.equal(r.ok, false); assert.equal(r.hearts, 12, '실패하면 원래 수'); assert.equal(r.error.status, 429);
  assert.equal(sentToday(f, heartKey('nyangdj7', '사탕요정#먼치', 's1'), T), false, '실패는 기억하지 않는다(다시 누를 수 있게)');
  // 저장소가 막혀도 보낼 수 있다
  const b = sendHeart({ ...card, id: '달무리#먼치' }, { storage: broken, now: T, send: async () => ({ hearts: 13 }) });
  assert.equal((await b.done).ok, true);
});

test('서버 답 기억(lib/swr.js): 지난 답으로 먼저 그리고 새 답을 받는다, 같은 것을 동시에 두 번 묻지 않는다, 아주 최근 답이면 묻지 않는다, 저장소가 막혀도 동작', async () => {
  _resetSwr();
  const s = memStore();
  let n = 0, t = 1000;
  const fetcher = async () => { n++; return { v: n }; };
  const a = swr('home', fetcher, { storage: s, now: () => t });
  assert.equal(a.cached, undefined, '처음엔 지난 답 없음');
  const b = swr('home', fetcher, { storage: s, now: () => t });
  assert.equal(await a.fresh, await b.fresh, '동시에 물은 것은 하나로'); assert.equal(n, 1);
  t += 5000;
  const c = swr('home', fetcher, { storage: s, now: () => t, fresh: 15000 });
  assert.deepEqual(c.cached, { v: 1 }); assert.deepEqual(await c.fresh, { v: 1 }); assert.equal(n, 1, '15초 안 — 다시 묻지 않는다');
  t += 60000;
  const d = swr('home', fetcher, { storage: s, now: () => t });
  assert.deepEqual(d.cached, { v: 1 }, '지난 답으로 먼저'); assert.deepEqual(await d.fresh, { v: 2 }, '그 사이 새 답'); assert.equal(d.age, 65000);
  // 다음 방문(메모리 비움) — 저장소에서 읽는다
  _resetSwr();
  assert.deepEqual(peekCached('home', { storage: s, now: () => t }), { v: 2 });
  assert.equal(peekCached('home', { storage: s, now: () => t + 8 * 864e5 }), undefined, '7일 지난 답은 쓰지 않는다');
  // 실패: 지난 답은 그대로 두고 새 답만 실패
  const e = swr('home', async () => { throw new Error('인터넷 연결을 확인해 주세요.'); }, { storage: s, now: () => t + 120000 });
  assert.deepEqual(e.cached, { v: 2 }); await assert.rejects(e.fresh, /인터넷/);
  // 막힌 저장소
  _resetSwr();
  const x = swr('page:abc', async () => ({ ok: 1 }), { storage: broken });
  assert.deepEqual(await x.fresh, { ok: 1 });
  assert.equal(sameData({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] }), true); assert.equal(sameData({ a: 1 }, { a: 2 }), false);
  // 미리 보기(카드가 아는 것) — 캐릭터 페이지가 바로 그린다
  primePreview('nyangdj7', '밤톨', { id: '밤톨#먼치', level: 3 });
  assert.deepEqual(peekPreview('nyangdj7', '밤톨'.normalize('NFD')), { id: '밤톨#먼치', level: 3 }, '풀어 쓴 한글도 같은 열쇠');
  assert.equal(peekPreview('nyangdj7', '사탕요정'), null);
});

test('캐릭터 사진(lib/raster.js): 칸(머리 조금 위~허벅지 가운데 2:3 · 얼굴 · 전신), 배율 단계, 그림이 바뀌면 열쇠도 바뀐다, 가벼운 사본은 원본 해시가 같을 때만', async () => {
  assert.deepEqual([...CROPS.photo], [309, 4, 406, 609]); assert.equal(CROPS.photo[3] / CROPS.photo[2], 1.5, '2:3');
  assert.deepEqual(cropOf('bust'), [392, 34, 240, 240]); assert.deepEqual(cropOf('nope'), [...CROPS.photo]);
  assert.equal(CROPS.full[3] / CROPS.full[2] > 1.49 && CROPS.full[3] / CROPS.full[2] < 1.51, true);
  assert.deepEqual(FEMALE, { s: 0.91, ox: 512, oy: 974, dy: -14 }, '무대(styles.css .kg-actor.is-f)와 같은 여자 줄이기');
  // 1024 원본보다 크게 그리지 않고, 비슷한 크기는 같은 단계(캐시를 같이 쓴다)
  assert.equal(scaleFor(361, 3, 406), 1); assert.equal(scaleFor(384, 1, 406), 1); assert.equal(scaleFor(82, 2, 240), 0.7); assert.equal(scaleFor(82, 1, 240), 0.35); assert.equal(scaleFor(0, 1, 406), 1, '칸 크기를 모르면 큰 카드 크기');
  // 남자 카드 칸(2026-10-19 사용자 "얼굴 잘 보이게"): 같은 2:3 을 조금 좁게(늘이지 않고 자르기만) · 가로 가운데 512 그대로 · 위는 모자·하트가 잘리지 않게 y 2부터
  assert.deepEqual([...CROPS.photoMale], [322, 2, 380, 570]); assert.equal(CROPS.photoMale[3] / CROPS.photoMale[2], 1.5, '2:3');
  assert.equal(CROPS.photoMale[0] + CROPS.photoMale[2] / 2, 512); assert.equal(CROPS.photo[0] + CROPS.photo[2] / 2, 512);
  assert.deepEqual(cropOf('photo', { gender: 'm' }), [...CROPS.photoMale]); assert.deepEqual(cropOf('photo', { gender: 'f' }), [...CROPS.photo]);
  assert.deepEqual(cropOf('photo'), [...CROPS.photo], '모르면 예전 칸'); assert.deepEqual(cropOf('bust', { gender: 'm' }), [...CROPS.bust], '얼굴 동그라미는 남녀 같은 칸');
  // 남자 머리(꼭대기 80 ~ 턱 208, anchors.json)가 카드 칸에서 차지하는 몫 ≥ 여자(0.91배 — 146.5 ~ 266.6)
  const headShare = (crop, top, chin) => (chin - top) / crop[3];
  assert.ok(headShare(CROPS.photoMale, 80, 208) > headShare(CROPS.photo, 146.5, 266.6), '남자 얼굴이 여자보다 작아 보이지 않는다');
  const urls = ['/kiugi/r7/female_body.png?v=5be43a8c2163', '/kiugi/r7/female_hair_02_front.png?v=16864895ecdf'];
  const k = rasterKey(urls, { kind: 'photo', s: 1, female: true });
  assert.match(k, /^r2:photo:1:f:[0-9a-f]{16}$/, 'r2(2026-10-19 — 남자 칸·표정 겹치기): 예전 사진은 쓰지 않는다');
  // 표정 겹치기(볼 발그레·둥실 하트 — 그림 파일이 아니라 주소가 같다)가 다르면 열쇠도 다르다
  assert.notEqual(rasterKey(urls, { kind: 'photo', s: 1, female: true, face: faceExtras({ parts: ['exp-blush'] }) }), k);
  assert.equal(faceExtras({ parts: ['eyes:smile', 'exp-floating-hearts', 'mouth:smile', 'exp-blush'] }), 'exp-blush,exp-floating-hearts');
  assert.equal(faceExtras({ parts: [] }), ''); assert.equal(faceExtras(null), '');
  assert.notEqual(rasterKey([urls[0], urls[1].replace('16864895ecdf', '000000000000')], { kind: 'photo', s: 1, female: true }), k, '그림 해시가 바뀌면 새 열쇠');
  assert.notEqual(rasterKey(urls, { kind: 'bust', s: 1, female: true }), k); assert.notEqual(rasterKey(urls, { kind: 'photo', s: 0.7, female: true }), k);
  assert.equal(hashText('abc'), hashText('abc')); assert.notEqual(hashText('abc'), hashText('abd'));
  const lite = { files: { '/kiugi/bg/background_01.png': { v: 'aaaaaaaaaaaa', file: 'bg/background_01.webp', t: 'bbbbbbbbbbbb' } } };
  assert.equal(liteUrl('/kiugi/bg/background_01.png?v=aaaaaaaaaaaa', lite, '/'), '/kiugi-lite/bg/background_01.webp?v=bbbbbbbbbbbb');
  assert.equal(liteUrl('/kiugi/bg/background_01.png?v=cccccccccccc', lite, '/'), '/kiugi/bg/background_01.png?v=cccccccccccc', '원본이 바뀌었으면(사본을 다시 만들지 않았으면) 원본 그대로');
  assert.equal(liteUrl('/kiugi/r7/female_body.png?v=5be43a8c2163', lite, '/'), '/kiugi/r7/female_body.png?v=5be43a8c2163');
  assert.equal(liteUrl('/x/kiugi/bg/background_01.png?v=aaaaaaaaaaaa', lite, '/x/'), '/x/kiugi-lite/bg/background_01.webp?v=bbbbbbbbbbbb', '사이트 BASE 아래');
  // 펫 칸: 보이는 펫(작은 ★1 이든 큰 ★5 든)이 칸의 80% 안에 가운데·아래 맞춤
  for (const box of [{ x0: 170, y0: 250, x1: 340, y1: 470 }, { x0: 40, y0: 30, x1: 470, y1: 470 }, null]) {
    const n = 160, f = petFit(box, n), b = box || { x0: 0, y0: 0, x1: 512, y1: 512 }, k2 = f.size / 512;
    const L = f.x + b.x0 * k2, R = f.x + b.x1 * k2, top = f.y + b.y0 * k2, bot = f.y + b.y1 * k2;
    assert.ok(Math.abs((L + R) / 2 - n / 2) < 0.01, '가운데'); assert.ok(Math.abs(bot - n * 0.92) < 0.01, '아래 맞춤');
    assert.ok(Math.max(R - L, bot - top) <= n * 0.8 + 0.01 && Math.max(R - L, bot - top) >= n * 0.8 - 0.01, '긴 쪽이 칸의 80%');
  }
});

test('가벼운 배경 사본(docs/kiugi-lite — tools/make-lite-art.cjs): 공통 배경 열 장 모두, 원본 해시(?v=)와 같은 판, 파일이 있고 WebP', async () => {
  const lite = JSON.parse(await readFile(docs + 'kiugi-lite/index.json', 'utf8'));
  const bgs = ART.assets.filter((a) => a.category === 'background');
  assert.equal(bgs.length, 10);
  for (const a of bgs) {
    const f = lite.files[`/kiugi/bg/${a.file}`];
    assert.ok(f, a.file + ' 사본');
    assert.equal(f.v, a.v, a.file + ' — 원본 그림이 바뀌었으면 node 로 tools/make-lite-art.cjs 를 Electron 으로 다시 돌린다');
    const buf = await readFile(docs + 'kiugi-lite/' + f.file);
    assert.equal(buf.toString('ascii', 0, 4), 'RIFF'); assert.equal(buf.toString('ascii', 8, 12), 'WEBP');
    assert.ok(buf.length < 400 * 1024, a.file + ' 는 400KB 보다 작다(원본 PNG 1.4~1.9MB)');
  }
});

test('새로 올린 파일이 바로 보이게(tools/stamp.cjs): 파일 내용 해시 주소 · import map · 보안 규칙(CSP) 해시가 표 글과 같다 · 표의 파일이 모두 있다 · 두 번 찍어도 같다', async () => {
  const { plan, stampHtml, modules } = require('../tools/stamp.cjs');
  const index = await readFile(docs + 'index.html', 'utf8');
  assert.equal(await readFile(docs + '404.html', 'utf8'), index);
  const map = /<script type="importmap">([^<]+)<\/script>/.exec(index)?.[1];
  assert.ok(map, 'import map');
  const crypto = await import('node:crypto');
  assert.ok(index.includes(`'sha256-${crypto.createHash('sha256').update(map).digest('base64')}'`), 'CSP 가 이 표 글만 허용');
  assert.match(index, /script-src 'self' 'sha256-[A-Za-z0-9+/=]+';/);
  assert.match(index, /img-src 'self' data:;/, '그림은 그대로 같은 출처와 data: 만');
  const imports = JSON.parse(map).imports;
  for (const [from, to] of Object.entries(imports)) {
    assert.match(to, new RegExp(`^${from.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\\?v=[0-9a-f]{10}$`), from);
    await access(docs + from.slice(1));
  }
  assert.ok(imports['/app.js'] && imports['/lib/raster.js'] && imports['/kiugi/kiugi-art.js']);
  assert.ok(!('/spoon.js' in imports), '스푼 연결 페이지는 따로');
  assert.match(index, /<script type="module" src="\/app\.js\?v=[0-9a-f]{10}"><\/script>/);
  assert.match(index, /<link rel="stylesheet" href="\/styles\.css\?v=[0-9a-f]{10}">/);
  assert.match(index, /<link rel="modulepreload" href="\/lib\/raster\.js\?v=[0-9a-f]{10}">/);
  assert.doesNotMatch(index, /modulepreload" href="\/mock\.js/, '체험용 mock.js 는 미리 받지 않는다');
  // 찍기는 같은 내용이면 그대로(두 번 찍어도 같다) · 지금 파일과 맞게 찍으면 표가 모든 모듈을 담는다
  const p = plan();
  const once = stampHtml(index, p);
  assert.equal(stampHtml(once, p), once);
  assert.deepEqual(Object.keys(JSON.parse(p.map).imports).sort(), modules().sort());
});

test('메인·DJ 페이지 도우미: 오늘의 주인공은 날짜마다(인기 6위 안), 내 캐릭터 인기 순위, DJ 페이지의 다른 캐릭터(1~3등·다른 방송 빼고 한 번씩)', async () => {
  const { spotlightPick, popularRank } = await import('../docs/views/intro.js');
  const { moreOf } = await import('../docs/views/kiugi.js');
  const pop = Array.from({ length: 9 }, (_, i) => ({ slug: 'nyangdj7', id: `가${'나'.repeat(i)}#먼치`, hearts: 20 - i }));
  const day = (d) => Date.parse(`2026-10-${String(d).padStart(2, '0')}T03:00:00Z`);
  const picks = new Set();
  for (let d = 1; d <= 12; d++) { const p = spotlightPick({ popular: pop }, day(d)); picks.add(p.card.id); assert.ok(pop.slice(0, 6).includes(p.card), '인기 6위 안'); assert.match(p.why, /^인기 \d위 · 하트 \d+개$/); }
  assert.equal(picks.size, 6, '날짜마다 바뀐다');
  assert.equal(spotlightPick({ popular: pop }, day(3)).card, spotlightPick({ popular: pop }, day(3) + 3600e3).card, '같은 날은 같은 캐릭터');
  assert.equal(spotlightPick({ popular: [], recent: [pop[0]] }, day(1)).why, '새로 꾸민 캐릭터');
  assert.equal(spotlightPick({}, day(1)), null);
  assert.equal(popularRank({ popular: pop }, { slug: 'nyangdj7', id: pop[2].id }), 3); assert.equal(popularRank({ popular: pop }, { slug: 'cuky2345', id: pop[2].id }), null);
  const home = { popular: [{ slug: 'a2345678', id: '밤톨#먼치' }, { slug: 'b2345678', id: '귤#쿠키' }, { slug: 'a2345678', id: '달무리#먼치' }], recent: [{ slug: 'a2345678', id: '달무리#먼치' }, { slug: 'a2345678', id: '새벽달#먼치' }] };
  assert.deepEqual(moreOf(home, 'a2345678', [{ id: '밤톨#먼치' }]).map((c) => c.id), ['달무리#먼치', '새벽달#먼치']);
  assert.deepEqual(moreOf(null, 'a2345678'), []);
});

test('내 캐릭터 소식 글(views/feed.js): 달라진 것마다 큰 글·작은 글, 머리글(처음 · 새 시즌 · 그대로 · 자랐어요)', async () => {
  const { newsText, newsHead } = await import('../docs/views/feed.js');
  assert.deepEqual(newsText({ kind: 'hearts', from: 3, to: 1203 }), ['하트 +1,200', '지금 1,203개']);
  assert.deepEqual(newsText({ kind: 'worn', from: 0, to: 2 }), ['새 옷 2벌', '옷을 갈아입었어요']);
  assert.deepEqual(newsText({ kind: 'rank', from: 5, to: 2 }), ['인기 5위 → 2위', '3계단 올랐어요']);
  assert.deepEqual(newsText({ kind: 'rank', from: null, to: 4 }), ['인기 4위', '인기 캐릭터에 들었어요']);
  assert.deepEqual(newsText({ kind: 'rank', from: 4, to: null }), ['인기 순위 밖', '지난번 인기 4위']);
  assert.match(newsText({ kind: 'level', from: 6, to: 7 }, {})[0], /^Lv\.6 → Lv\.7$/);
  assert.equal(newsHead({ first: true })[0], '내 캐릭터로 정했어요');
  assert.equal(newsHead({ newSeason: true, changes: [] })[0], '새 시즌이 시작됐어요');
  assert.equal(newsHead({ changes: [] })[0], '지난 방문과 그대로예요');
  assert.equal(newsHead({ changes: [{ kind: 'hearts' }], up: true })[0], '지난 방문 뒤로 이만큼 자랐어요!');
});

test('DJ 동그라미 줄: 가장자리까지 넘기는 줄(음수 여백 + 안쪽 여백)이 맞춤(scroll-snap) 때문에 첫 칸을 화면 끝으로 밀지 않게 scroll-padding-inline 도 같은 여백', async () => {
  const css = await readFile(docs + 'styles.css', 'utf8');
  const rule = css.match(/\.kg-rings ul \{[^}]*\}/)?.[0] || '';
  assert.match(rule, /scroll-snap-type: x/);
  assert.match(rule, /scroll-padding-inline: var\(--gutter\)/);
});
test('미리 만든 답(api.js readSnap): 10분 안에 만든 파일만 · 닫힌 페이지·모양 틀림·없음·오류는 null(함수로) · snapAt 은 빼고 나이를 알려 준다', async () => {
  const { readSnap, validHome, validPage, SNAP_BASE } = await import('../docs/api.js');
  const now = () => T;
  const res = (j, ok = true) => async (url) => { assert.ok(url.startsWith(SNAP_BASE)); return { ok, json: async () => j }; };
  const home = { season: null, popular: [], recent: [], items: [], djs: [], totals: { djs: 0, people: 0 } };
  let r = await readSnap('home.json', validHome, { fetchImpl: res({ ...home, snapAt: T - 30000 }), now });
  assert.deepEqual(r, { data: home, age: 30000 });
  assert.equal(await readSnap('home.json', validHome, { fetchImpl: res({ ...home, snapAt: T - 11 * 60000 }), now }), null, '10분 넘은 파일은 쓰지 않는다');
  assert.equal(await readSnap('home.json', validHome, { fetchImpl: res({ popular: [], snapAt: T }), now }), null, '모양이 틀리면');
  assert.equal(await readSnap('home.json', validHome, { fetchImpl: res({ ...home }), now }), null, 'snapAt 없으면');
  assert.equal(await readSnap('page/abcdefgh.json', validPage('abcdefgh'), { fetchImpl: res({ closed: true, snapAt: T }), now }), null, '닫힌 페이지');
  assert.equal(await readSnap('page/abcdefgh.json', validPage('abcdefgh'), { fetchImpl: res({ slug: 'zzzzzzzz', top: [], snapAt: T }), now }), null, '다른 페이지');
  assert.equal(await readSnap('home.json', validHome, { fetchImpl: res(null, false), now }), null, '없는 파일(404 등)');
  assert.equal(await readSnap('home.json', validHome, { fetchImpl: async () => { throw new Error('끊김'); }, now }), null, '네트워크 오류');
  r = await readSnap('page/abcdefgh.json', validPage('abcdefgh'), { fetchImpl: res({ slug: 'abcdefgh', top: [], snapAt: T }), now });
  assert.equal(r.data.slug, 'abcdefgh'); assert.equal('snapAt' in r.data, false);
});

test('api.js: 메인·DJ 페이지 새 답은 미리 만든 답 → 없으면 함수 · 1분 넘은 파일이면 뒤에서 함수로 이 브라우저 기억만 새로 · 체험 모드는 쓰지 않는다 · 사이트가 서버에 미리 연결(preconnect)', async () => {
  const src = await readFile(docs + 'api.js', 'utf8');
  assert.match(src, /viaSnap\(key, 'home\.json', validHome, \(\) => kiugiApi\.home\(\)\)/);
  assert.match(src, /viaSnap\(key, SLUG_RE\.test\(String\(slug\)\) \? `page\/\$\{slug\}\.json` : '', validPage\(slug\), \(\) => kiugiApi\.page\(slug\)\)/);
  assert.match(src, /if \(s\.age > SNAP_STALE_MS\) void live\(\)\.then\(\(v\) => remember\(key, v\)/);
  assert.match(src, /if \(demoNow\(\) \|\| !path\) return live\(\);/);
  for (const f of ['index.html', '404.html']) assert.match(await readFile(docs + f, 'utf8'), /<link rel="preconnect" href="https:\/\/aksegkhhugqvvaidgvro\.supabase\.co" crossorigin>/, f);
  assert.match(await readFile(docs + 'index.html', 'utf8'), /<link rel="preload" href="https:\/\/aksegkhhugqvvaidgvro\.supabase\.co\/storage\/v1\/object\/public\/kg-snap\/home\.json" as="fetch" crossorigin>/, '첫 화면은 메인 미리 만든 답을 HTML 을 읽자마자 받기 시작');
});