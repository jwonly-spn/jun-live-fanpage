// 캐릭터 카드·DJ 카드·그림 칸(메인·DJ 페이지·찾기 결과가 함께 쓴다). DOM 은 함수 안에서만 쓴다(노드 시험에서 이 파일을 불러 글 도우미를 쓴다).
// 그림은 화면 가까이 왔을 때 그린다(그림 파일이 커서 휴대폰 메모리를 아끼려고).
import { h, toast } from '../lib/dom.js';
import { characterMarkup, expressionFor, svgNode } from '../lib/kiugi-draw.js';
import { ilink } from './common.js';

export const baseOf = (id) => String(id ?? '').split('#')[0];
const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
export const heartText = (n) => `♥ ${fmt(n)}`;
// 카드 한 줄 글: 레벨과 표정 이름만(애정도 숫자는 보이지 않는다)
export const levelLine = (catalog, seasonId, level) => `Lv.${level} ${expressionFor(catalog, seasonId, level).name}`;

let observer = null;
// 그림 칸: make() 가 SVG 요소를 돌려준다. eager 면 바로, 아니면 화면 가까이 왔을 때.
export function lazyStage(make, label, { eager = false } = {}) {
  const stage = h('div', { class: 'kg-stage' });
  const draw = () => { let node = null; try { node = make(); } catch (e) { console.error(e); } stage.replaceChildren(node || h('span', { class: 'kg-noart' }, label)); };
  if (eager || typeof IntersectionObserver !== 'function') { draw(); return stage; }
  observer ||= new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { observer.unobserve(e.target); e.target.kgDraw?.(); }
  }, { rootMargin: '400px 0px' });
  stage.kgDraw = draw;
  observer.observe(stage);
  return stage;
}
// DJ 캐릭터에 옷을 입힌 그림
export function art(catalog, character, worn, level, { seasonId = null, base = '/', label = '', eager = false } = {}) {
  if (!character) return h('div', { class: 'kg-stage' }, h('span', { class: 'kg-noart' }, label));
  return lazyStage(() => svgNode(characterMarkup(catalog, character, worn, level, { seasonId, base, label })), label, { eager });
}

// 캐릭터 카드 {slug, djName, id, level, worn, hearts} → 캐릭터 페이지로 가는 링크
export function characterCard(c, { app, catalog, character, seasonId, showDj = true, eager = false, rank = null }) {
  const href = app.link({ name: 'character', slug: c.slug, base: baseOf(c.id) });
  return ilink(href, { class: 'kg-card' },
    art(catalog, character, c.worn, c.level, { seasonId, base: app.base, label: `${c.id} 캐릭터`, eager }),
    h('span', { class: 'kg-card-body' },
      rank ? h('span', { class: 'kg-card-rank' }, `${rank}등`) : null,
      h('b', { class: 'kg-card-id' }, c.id),
      h('span', { class: 'kg-card-sub' }, levelLine(catalog, seasonId, c.level)),
      showDj && c.djName ? h('span', { class: 'kg-card-dj' }, `${c.djName} 키우기`) : null,
      h('span', { class: 'kg-card-hearts', 'aria-label': `하트 ${fmt(c.hearts)}개` }, heartText(c.hearts))));
}

// DJ 카드 {slug, name, character, count} → DJ 키우기 페이지로 가는 링크
export function djCard(d, { app, catalog, seasonId }) {
  return ilink(app.link({ name: 'kiugi', slug: d.slug }), { class: 'kg-card kg-dj' },
    art(catalog, d.character, {}, 1, { seasonId, base: app.base, label: `${d.name} 캐릭터` }),
    h('span', { class: 'kg-card-body' },
      h('b', { class: 'kg-card-id' }, `${d.name} 키우기`),
      h('span', { class: 'kg-card-sub' }, `청취자 ${fmt(d.count)}명`)));
}

// 링크 복사: 클립보드가 되면 복사, 안 되면 주소 칸을 보여 주고 글자를 골라 둔다(길게 눌러 복사)
export async function copyLink(url, box) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('no clipboard');
    await navigator.clipboard.writeText(url);
    toast('링크를 복사했어요. 원하는 곳에 붙여 넣어 주세요.');
    return true;
  } catch {
    const input = h('input', { type: 'text', class: 'kg-copy-input', readonly: true, 'aria-label': '이 캐릭터 링크' });
    input.value = url;
    box.replaceChildren(input, h('p', { class: 'note' }, '복사하지 못했어요. 위 주소를 길게 눌러 복사해 주세요.'));
    input.focus(); input.select();
    try { input.setSelectionRange(0, url.length); } catch { /* 일부 브라우저 */ }
    return false;
  }
}
