// 체험 모드용 가짜 서버 — API.md "DJ 키우기 페이지"를 브라우저 안에서 흉내 낸다(실제 서버와 통신하지 않음).
// 청취자 아이디는 모두 지어낸 것(실제 청취자·DJ 이름 아님). 캐릭터 이름 "먼치"도 예시.
import { DEMO_KIUGI_SLUG } from './lib/route.js';

export const KIUGI_DEMO = { slug: DEMO_KIUGI_SLUG };
const CLOSED_SLUG = 'shutpg22'; // DJ가 닫아 둔 페이지 흉내
const NAME = '먼치';
// 찾기 글: 앞 부분만("밤톨") 또는 전체 아이디("밤톨#먼치") — 서버(lib.ts query)와 같은 규칙
const QUERY_KEY = /^[가-힣]{1,6}(#[가-힣a-z0-9]{1,8})?$/;
// 서버(lib.ts searchKey)와 같은 찾기 열쇠: NFC, 영문 소문자, 띄어쓰기 뺌
const searchKey = (s) => String(s ?? '').normalize('NFC').toLowerCase().replace(/\s+/g, '');
const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const ok = (json) => ({ status: 200, json });
const fail = (status, error, extra = {}) => ({ status, json: { error, ...extra } });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function kiugiDemo() {
  // 아이디 = 청취자가 만든 앞 부분(한글 1~6자) + "#" + 캐릭터 이름
  const ids = ['밤톨', '사탕요정', '달무리', '먼치팬', '호박꽃', '별사탕', '새벽달', '구름빵', '보름달', '솜사탕', '밤하늘', '유령친구', '마녀수프', '박쥐날개', '꿀호떡', '달빛소나기', '호박등', '사탕유령', '밤톨이네', '작은밤톨', '초코칩'].map((base) => `${base}#${NAME}`);
  const outfits = [
    { head: 'witch-hat', top: 'stage-jacket', bottom: 'witch-dress', hand: 'magic-wand', bg: 'halloween-night' },
    { head: 'cat-ears', face: 'blush', top: 'pumpkin-hoodie', bottom: 'check-skirt', shoes: 'pumpkin-slippers', bg: 'pumpkin-field' },
    { head: 'candle-crown', face: 'monocle', outer: 'dracula-cape', bottom: 'dracula-suit', bg: 'haunted-house' },
    { head: 'pumpkin-hat', top: 'candy-vest', bottom: 'overalls', hand: 'lollipop' },
    { head: 'ghost-pin', top: 'ghost-pajama', outer: 'ghost-wings', bg: 'candy-shop' },
    { face: 'mustache', top: 'belly-tee', bottom: 'ripped-jeans', hand: 'rubber-chicken' },
    {}, { head: 'bat-clips', top: 'bat-blouse', shoes: 'bat-shoes' },
  ];
  const people = ids.map((id, i) => {
    const love = Math.max(0, 5200 - i * 260 - (i % 3) * 37);
    let level = 1; while (level < 10 && love >= 50 * (level + 1) * level) level++;
    return { id, level, love, worn: outfits[i % outfits.length] };
  });
  return {
    slug: DEMO_KIUGI_SLUG, name: NAME, paused: false, count: people.length, updatedAt: ago(0.1),
    season: { id: 's1', name: '할로윈', endsAt: '2026-11-30T14:59:59.000Z' },
    character: { name: NAME, gender: 'f', hair: 'long', hairColor: 'pink', skin: 's2', eyes: 'sparkle', nose: 'dot', mouth: 'smile' },
    top: people.slice(0, 3).map((p, i) => ({ rank: i + 1, ...p })), people,
  };
}

export async function handle(method, path, q = {}) {
  await wait(typeof window === 'undefined' ? 0 : 120 + Math.random() * 220);
  const route = method + ' ' + path;
  switch (route) {
    // nyangdj7 = 열린 페이지, shutpg22 = DJ가 닫아 둔 페이지
    case 'GET kiugi/page': {
      if (q.slug === CLOSED_SLUG) return fail(404, 'DJ가 지금은 키우기 페이지를 닫아 두었어요.', { closed: true });
      if (q.slug !== DEMO_KIUGI_SLUG) return fail(404, '키우기 페이지를 찾을 수 없어요. 주소를 확인해 주세요.');
      const { people, ...page } = kiugiDemo();
      return ok(page);
    }
    case 'GET kiugi/find': {
      if (q.slug !== DEMO_KIUGI_SLUG) return fail(404, '키우기 페이지를 찾을 수 없어요. 주소를 확인해 주세요.');
      const raw = String(q.q ?? ''), key = searchKey(raw);
      if ([...raw].length > 40 || !QUERY_KEY.test(key)) return fail(400, '아이디를 한글 1~6자로 적어 주세요. 예: 밤톨 또는 밤톨#먼치');
      // 전체로 찾으면 아이디 전체와, 앞 부분만 적으면 앞 부분끼리 비교
      const whole = key.includes('#');
      const all = kiugiDemo().people.map((p, i) => ({ ...p, rank: i + 1, t: whole ? searchKey(p.id) : searchKey(p.id).split('#')[0] }));
      const exact = all.filter((p) => p.t === key), part = all.filter((p) => p.t !== key && p.t.includes(key));
      const hits = [...exact, ...part];
      return ok({ results: hits.slice(0, 5).map(({ rank, id, level, love, worn }) => ({ rank, id, level, love, worn })), exact: exact.length, more: hits.length > 5 });
    }
    default:
      return fail(404, '없는 요청이에요.');
  }
}
