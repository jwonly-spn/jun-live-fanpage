// 체험 모드용 가짜 서버 — API.md "DJ 키우기 페이지"를 브라우저 안에서 흉내 낸다(실제 서버와 통신하지 않음).
// 이름은 모두 지어낸 것(실제 청취자·DJ 이름 아님): DJ 캐릭터 먼치·쿠키·젤리, 청취자 아이디 밤톨·사탕요정·달무리·귤껍질·여름밤·별사탕 등.
// 서버와 같은 약속: 애정도 숫자는 내보내지 않음(SHOW_LOVE false), 하트는 브라우저 열쇠마다 한 캐릭터에 하루 한 번.
import { DEMO_KIUGI_SLUG } from './lib/route.js';

export const KIUGI_DEMO = { slug: DEMO_KIUGI_SLUG };
const CLOSED_SLUG = 'shutpg22'; // DJ가 닫아 둔 페이지 흉내
const SEASON = { id: 's1', name: '할로윈', endsAt: '2026-11-30T14:59:59.000Z' };
// 찾기 글: 앞 부분만("밤톨") 또는 전체 아이디("밤톨#먼치") — 서버(lib.ts query)와 같은 규칙
const QUERY_KEY = /^[가-힣]{1,6}(#[가-힣a-z0-9]{1,8})?$/;
const BAD_QUERY = '아이디를 한글 1~6자로 적어 주세요. 예: 밤톨 또는 밤톨#먼치';
const NO_PAGE = '키우기 페이지를 찾을 수 없어요. 주소를 확인해 주세요.';
const NO_PERSON = '이 아이디를 찾을 수 없어요. 이번 시즌 아이디가 맞는지 확인해 주세요.';
// 서버(lib.ts searchKey)와 같은 찾기 열쇠: NFC, 영문 소문자, 띄어쓰기 뺌
const searchKey = (s) => String(s ?? '').normalize('NFC').toLowerCase().replace(/\s+/g, '');
const baseOf = (k) => String(k).split('#')[0];
const ok = (json) => ({ status: 200, json });
const fail = (status, error, extra = {}) => ({ status, json: { error, ...extra } });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const kstDay = (t) => new Date(t + 9 * 3600000).toISOString().slice(0, 10);

// 입은 옷(그림 V5 옷 id = 패키지 pair: outfit_01~05 한벌옷 · top_01~20 상의 · bottom_01~20 하의 · shoe2_01~10 신발 · acc2_01~10 악세사리
//  — 자리는 머리·얼굴·목·손 중 그 악세사리 자리, 악세11~13(왕관·날개·오라)은 crown·wings·aura 칸, 배경 background_01~10 은 bg 칸 — 남녀 같은 배경). 먼치킨이 올리는 모양 그대로: 한벌옷에 가려진 상의·하의, 왕관에 가려진 머리 장식은 올리지 않는다.
//  마지막 줄은 예전 판이 올린 자료 흉내 — V4 에서 지운 옷(의상 07·신발 shoe_03·악세사리 accessory_01)과 예전(V2) 배경 id 라 그리지 않는다.
const OUTFITS = [
  { top: 'top_17', bottom: 'bottom_19', shoes: 'shoe2_04', face: 'acc2_04', bg: 'background_01', crown: 'acc2_11', wings: 'acc2_12', aura: 'acc2_13' },
  { outfit: 'outfit_03', shoes: 'shoe2_06', neck: 'acc2_06' },
  { top: 'top_11', bottom: 'bottom_12', shoes: 'shoe2_03', head: 'acc2_01', hand: 'acc2_10', bg: 'background_05' },
  { outfit: 'outfit_04', shoes: 'shoe2_02', face: 'acc2_05' },
  { top: 'top_14', bottom: 'bottom_16', shoes: 'shoe2_08', neck: 'acc2_07', wings: 'acc2_12' },
  { top: 'top_20', bottom: 'bottom_18', shoes: 'shoe2_10', head: 'acc2_03', bg: 'background_10' },
  { top: 'top_05', bottom: 'bottom_03', shoes: 'shoe2_06' },
  {}, { outfit: 'outfit_02', hand: 'acc2_09', shoes: 'shoe2_05' },
  { top: 'top_12', bottom: 'bottom_15', shoes: 'shoe2_01', head: 'acc2_02' },
  { outfit: 'outfit_07', shoes: 'shoe_03', head: 'accessory_01', bg: 'halloween-night' },
];
// DJ 캐릭터(그림 V3 값: 머리·눈·코·입 번호 1~10). 젤리는 일부러 예전(V2) 값 — 예전 판 먼치킨이 올린 자료도 가장 비슷한 V3 그림으로 그리는지 보려고.
const DJS = [
  { slug: DEMO_KIUGI_SLUG, character: { name: '먼치', gender: 'f', hair: '9', hairColor: 'pink', eyes: '2', nose: '1', mouth: '2' },
    bases: ['밤톨', '사탕요정', '달무리', '먼치팬', '호박꽃', '별사탕', '새벽달', '구름빵', '보름달', '솜사탕', '밤하늘', '유령친구', '마녀수프', '박쥐날개', '꿀호떡', '달빛소나기', '호박등', '사탕유령', '밤톨이네', '작은밤톨', '초코칩'] },
  { slug: 'cuky2345', character: { name: '쿠키', gender: 'm', hair: '5', hairColor: 'brown', eyes: '5', nose: '5', mouth: '8' },
    bases: ['귤껍질', '여름밤', '별사탕', '밤톨', '솜사탕', '초코칩'] },
  { slug: 'jery2468', character: { name: '젤리', gender: 'f', hair: 'f_twin', hairColor: 'sky', skin: 's1', eyes: 'happy', nose: 'dot', mouth: 'cat' },
    bases: ['달무리', '사탕요정', '여름밤', '꿀호떡'] },
];
// 처음 하트(체험용): "<slug>|<찾기 열쇠>" → 수
const SEED_HEARTS = { 'nyangdj7|밤톨#먼치': 12, 'nyangdj7|사탕요정#먼치': 5, 'nyangdj7|달무리#먼치': 2, 'nyangdj7|먼치팬#먼치': 1, 'cuky2345|귤껍질#쿠키': 9, 'cuky2345|여름밤#쿠키': 4, 'jery2468|달무리#젤리': 7, 'jery2468|사탕요정#젤리': 3 };

// 한 페이지의 사람들(애정도 순). ch = 새로 꾸민 때(서버처럼 순서에만 쓰고 밖으로 안 냄)
function pagesNow() {
  const t = Date.now();
  return DJS.map((dj, d) => {
    const people = dj.bases.map((base, i) => {
      const love = Math.max(0, (d === 0 ? 5200 : 3100 - d * 600) - i * 260 - (i % 3) * 37);
      let level = 1; while (level < 10 && love >= 50 * (level + 1) * level) level++;
      const id = `${base}#${dj.character.name}`;
      // 단 칭호(먼치킨이 올리는 모양 — 지금 효과가 있는 단 칭호 하나): 1·2등과 몇 사람만
      const titles = i === 0 ? ['title-halloween-insa'] : i === 1 ? ['title-candy-plz'] : i === 6 ? ['title-kiugi-master'] : [];
      return { id, k: searchKey(id), level, love, worn: OUTFITS[(i + d * 3) % OUTFITS.length], ...(titles.length ? { titles } : {}), ch: t - (i * 3 + d) * 1700e3 };
    });
    return { slug: dj.slug, name: dj.character.name, character: dj.character, season: SEASON, people, count: people.length, updatedAt: new Date(t - (d + 1) * 300e3).toISOString() };
  });
}
const hearts = new Map(Object.entries(SEED_HEARTS));
const votes = new Set();
const heartsOf = (slug, k) => hearts.get(`${slug}|${k}`) || 0;
const pub = (p, rank, slug) => ({ rank, id: p.id, level: p.level, worn: p.worn, ...(p.titles ? { titles: p.titles } : {}), hearts: heartsOf(slug, p.k) });
const card = (p, page) => ({ slug: page.slug, djName: page.name, id: p.id, level: p.level, worn: p.worn, ...(p.titles ? { titles: p.titles } : {}), hearts: heartsOf(page.slug, p.k) });
const target = (k, key) => (key.includes('#') ? k : baseOf(k));
const pageOf = (slug) => pagesNow().find((p) => p.slug === slug) || null;
function queryKey(value) {
  const raw = String(value ?? ''), key = searchKey(raw);
  return [...raw].length > 40 || !QUERY_KEY.test(key) ? null : key;
}

export async function handle(method, path, q = {}, body = {}) {
  await wait(typeof window === 'undefined' ? 0 : 120 + Math.random() * 220);
  const route = method + ' ' + path;
  switch (route) {
    // nyangdj7(먼치)·cuky2345(쿠키)·jery2468(젤리) = 열린 페이지, shutpg22 = DJ가 닫아 둔 페이지
    case 'GET kiugi/page': {
      if (q.slug === CLOSED_SLUG) return fail(404, 'DJ가 지금은 키우기 페이지를 닫아 두었어요.', { closed: true });
      const page = pageOf(q.slug);
      if (!page) return fail(404, NO_PAGE);
      const { people, ...rest } = page;
      return ok({ ...rest, paused: false, top: people.slice(0, 3).map((p, i) => pub(p, i + 1, page.slug)) });
    }
    case 'GET kiugi/find': {
      const page = pageOf(q.slug);
      if (!page) return fail(404, NO_PAGE);
      const key = queryKey(q.q);
      if (!key) return fail(400, BAD_QUERY);
      const all = page.people.map((p, i) => ({ p, rank: i + 1, t: target(p.k, key) }));
      const exact = all.filter((x) => x.t === key), part = all.filter((x) => x.t !== key && x.t.includes(key));
      const hits = [...exact, ...part];
      return ok({ results: hits.slice(0, 5).map((x) => pub(x.p, x.rank, page.slug)), exact: exact.length, more: hits.length > 5 });
    }
    case 'GET kiugi/person': {
      const page = pageOf(q.slug);
      if (!page) return fail(404, NO_PAGE);
      const key = queryKey(q.id);
      if (!key) return fail(400, BAD_QUERY);
      const p = page.people.find((x) => target(x.k, key) === key);
      if (!p) return fail(404, NO_PERSON);
      return ok({ id: p.id, level: p.level, worn: p.worn, titles: p.titles || [], hearts: heartsOf(page.slug, p.k), season: page.season, dj: { slug: page.slug, name: page.name, character: page.character } });
    }
    case 'GET kiugi/home': {
      const pages = pagesNow();
      const everyone = pages.flatMap((page) => page.people.map((p) => ({ p, page })));
      const popular = everyone.filter((x) => heartsOf(x.page.slug, x.p.k) > 0)
        .sort((a, b) => heartsOf(b.page.slug, b.p.k) - heartsOf(a.page.slug, a.p.k)).slice(0, 12).map((x) => card(x.p, x.page));
      const recent = everyone.filter((x) => Object.keys(x.p.worn).length).sort((a, b) => b.p.ch - a.p.ch).slice(0, 8).map((x) => card(x.p, x.page));
      const tally = {};
      for (const { p } of everyone) for (const id of Object.values(p.worn)) tally[id] = (tally[id] || 0) + 1;
      const items = Object.entries(tally).map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count || (a.id < b.id ? -1 : 1));
      const djs = pages.map((p) => ({ slug: p.slug, name: p.name, character: p.character, count: p.count })).sort((a, b) => b.count - a.count);
      return ok({ season: SEASON, popular, recent, items, djs, totals: { djs: djs.length, people: djs.reduce((s, d) => s + d.count, 0) } });
    }
    case 'GET kiugi/search': {
      const key = queryKey(q.q);
      if (!key) return fail(400, BAD_QUERY);
      const pages = pagesNow();
      let hits = [];
      if (key.includes('#')) {
        const page = pages.find((p) => searchKey(p.name) === key.slice(key.indexOf('#') + 1));
        const p = page?.people.find((x) => x.k === key);
        if (p) hits = [{ p, page, exact: true }];
      } else {
        const exact = [], part = [];
        for (const page of pages) for (const p of page.people) {
          const base = baseOf(p.k);
          if (base === key) exact.push({ p, page, exact: true }); else if (base.includes(key)) part.push({ p, page, exact: false });
        }
        const order = (a, b) => b.p.level - a.p.level || (a.p.id < b.p.id ? -1 : 1);
        hits = [...exact.sort(order), ...part.sort(order)];
      }
      return ok({ results: hits.slice(0, 10).map((x) => card(x.p, x.page)), exact: hits.filter((x) => x.exact).length, more: hits.length > 10 });
    }
    case 'POST kiugi/heart': {
      const page = pageOf(body?.slug);
      if (!page) return fail(404, NO_PAGE);
      const key = queryKey(body?.id);
      if (!key) return fail(400, BAD_QUERY);
      if (!/^[A-Za-z0-9_-]{32}$/.test(String(body?.token || ''))) return fail(400, '하트를 보낼 수 없어요. 페이지를 새로 열어 주세요.');
      const p = page.people.find((x) => target(x.k, key) === key);
      if (!p) return fail(404, NO_PERSON);
      const vote = `${body.token}|${kstDay(Date.now())}|${page.season.id}|${page.slug}|${p.k}`;
      if (votes.has(vote)) return ok({ hearts: heartsOf(page.slug, p.k), already: true });
      votes.add(vote);
      hearts.set(`${page.slug}|${p.k}`, heartsOf(page.slug, p.k) + 1);
      return ok({ hearts: heartsOf(page.slug, p.k), already: false });
    }
    default:
      return fail(404, '없는 요청이에요.');
  }
}
