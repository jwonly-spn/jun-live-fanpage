// 첫 화면: 먼치킨 DJ 키우기 안내. 없는 주소(notfound)와 마친 팬페이지 주소(ended)도 여기서 안내한다.
// 첫 화면은 칸(section) 목록으로 그린다 — 나중에 "지금 인기 있는 캐릭터"(모든 DJ) 같은 칸을 LANDING_SECTIONS 에 더하면 된다.
import { h } from '../lib/dom.js';
import { buildPath, DEMO_KIUGI_SLUG } from '../lib/route.js';
import { ilink } from './common.js';

const NOTICE = {
  notfound: ['페이지를 찾을 수 없어요', '주소가 맞는지 확인해 주세요.'],
  ended: ['팬페이지 서비스를 마쳤어요', '그동안 함께해 주셔서 고마워요. DJ 키우기 페이지는 DJ가 알려 준 주소로 계속 볼 수 있어요.'],
};

// 맨 위 안내 칸. heading: 위에 알림 상자가 있으면 'h2'(제목이 두 번 h1 이 되지 않게).
function heroSection(app, { heading = 'h1' } = {}) {
  const demo = buildPath(app.base, { name: 'kiugi', slug: DEMO_KIUGI_SLUG }) + '?demo=1';
  return h('section', { class: 'intro-hero' },
    h(heading, { class: 'display' }, '먼치킨 DJ 키우기'),
    h('p', { class: 'intro' }, 'DJ가 알려 준 키우기 주소로 들어가면 청취자들이 꾸민 캐릭터를 볼 수 있어요.'),
    h('div', { class: 'row gap wrap' }, ilink(demo, { class: 'btn btn-accent' }, '예시 페이지 보기')));
}

// 첫 화면 칸 목록(차례대로). 칸 = (app, opts) => 요소 | null | Promise<요소 | null>.
// 서버에서 받아 오는 칸(예: 인기 캐릭터)은 Promise 를 돌려주면 자리를 먼저 잡아 두었다가 받은 뒤에 채운다(실패하면 칸을 뺀다).
export const LANDING_SECTIONS = [heroSection];

function mount(main, make, app, opts) {
  let out;
  try { out = make(app, opts); } catch (e) { console.error(e); return; }
  if (!out || typeof out.then !== 'function') { if (out) main.append(out); return; }
  const slot = h('div', { class: 'intro-slot', 'aria-busy': 'true' });
  main.append(slot);
  out.then((node) => { if (node) slot.replaceWith(node); else slot.remove(); }, (e) => { console.error(e); slot.remove(); });
}

export function renderIntro(root, app, { notice = null } = {}) {
  const box = NOTICE[notice] || null;
  document.title = box ? `${box[0]} · 먼치킨 DJ 키우기` : '먼치킨 DJ 키우기';
  const main = h('main', { id: 'main', class: 'fp-main intro-main', tabindex: '-1' },
    box ? h('div', { class: 'card pad stack', role: 'alert' }, h('h1', { class: 'sec-title' }, box[0]), h('p', { class: 'muted' }, box[1])) : null);
  for (const make of LANDING_SECTIONS) mount(main, make, app, { heading: box ? 'h2' : 'h1' });
  root.replaceChildren(h('div', { class: 'fp intro' }, main, h('footer', { class: 'fp-foot' }, '스푼이 만든 서비스가 아니에요.')));
}
