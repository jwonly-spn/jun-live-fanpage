// 캐릭터 카드·DJ 카드·그림 칸(메인·DJ 페이지·찾기 결과가 함께 쓴다). DOM 은 함수 안에서만 쓴다(노드 시험에서 이 파일을 불러 글 도우미를 쓴다).
// 그림은 화면 가까이 왔을 때 그린다(그림 파일이 커서 휴대폰 메모리를 아끼려고).
// 카드 모양(styles.css): 패션 앱 상품 카드 — 위는 부드러운 무대 위 캐릭터(세로 3:4로 잘라 크게), 아래는 글 세 줄(어느 방송 · 아이디 · 레벨과 하트).
import { h, icon, toast } from '../lib/dom.js';
import { characterMarkup, itemMarkup, expressionFor, paintMarkup } from '../lib/kiugi-draw.js';
import { ilink, medal } from './common.js';

export const baseOf = (id) => String(id ?? '').split('#')[0];
const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
export const heartText = (n) => `♥ ${fmt(n)}`;
// 카드 한 줄 글: 레벨과 표정 이름만(애정도 숫자는 보이지 않는다)
export const levelLine = (catalog, seasonId, level) => `Lv.${level} ${expressionFor(catalog, seasonId, level).name}`;

// 아이디 글: 앞 부분은 크게, "#캐릭터 이름"은 작게(읽으면 그대로 "밤톨#먼치")
export function idText(id) {
  const s = String(id ?? ''), i = s.indexOf('#');
  return i < 0 ? [s] : [s.slice(0, i), h('span', { class: 'kg-id-tag' }, s.slice(i))];
}
// 하트 수(작은 하트 그림 + 숫자). 화면 읽기에는 "하트 n개"
export function heartCount(n, { className = '' } = {}) {
  return h('span', { class: 'kg-hearts' + (className ? ' ' + className : ''), 'aria-label': `하트 ${fmt(n)}개` },
    icon('heart', { size: 14, filled: true }), h('span', { 'aria-hidden': 'true' }, fmt(n)));
}

let observer = null;
// 그림 칸: make() 가 SVG 글을 돌려준다. eager 면 바로, 아니면 화면 가까이 왔을 때. kind: 무대 모양(styles.css .kg-stage.<kind>)
//  그림 V3(2026-10-09): 그림 파일을 모두 받은 뒤 한 번에 넣는다(paintMarkup — 반쯤 그려진 모습이 보이지 않게).
export function lazyStage(make, label, { eager = false, kind = '' } = {}) {
  const stage = h('div', { class: 'kg-stage' + (kind ? ' ' + kind : '') });
  const noart = () => h('span', { class: 'kg-noart' }, label);
  const draw = () => {
    let markup = null;
    try { markup = make(); } catch (e) { console.error(e); }
    if (!markup) { stage.replaceChildren(noart()); return; }
    paintMarkup(stage, markup, { fallback: noart() }).catch((e) => { console.error(e); stage.replaceChildren(noart()); });
  };
  if (eager || typeof IntersectionObserver !== 'function') { draw(); return stage; }
  observer ||= new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { observer.unobserve(e.target); e.target.kgDraw?.(); }
  }, { rootMargin: '400px 400px' });
  stage.kgDraw = draw;
  observer.observe(stage);
  return stage;
}
// DJ 캐릭터에 옷을 입힌 그림(바탕 없이 — 무대는 styles.css). 캐릭터 칸은 세로(char)로 잘라 크게 보인다. kind: 무대 모양 더하기(hero·bare 등)
export function art(catalog, character, worn, level, { seasonId = null, base = '/', label = '', eager = false, kind = '' } = {}) {
  const cls = 'char' + (kind ? ' ' + kind : '');
  if (!character) return h('div', { class: 'kg-stage ' + cls }, h('span', { class: 'kg-noart' }, label));
  return lazyStage(() => characterMarkup(catalog, character, worn, level, { seasonId, base, label, stage: null }), label, { eager, kind: cls });
}
// 옷 한 벌 그림(옷 도감·입은 옷). dj: DJ 캐릭터(성별이 같으면 그 얼굴·머리로 입혀 보인다). tall: 세로 칸(전신 의상 — 양옆 빈 곳만 잘라 크게)
export function itemArt(catalog, id, { base = '/', label = '', gender = 'f', dj = null, tall = false } = {}) {
  return lazyStage(() => itemMarkup(catalog, id, { base, label, gender, dj }), label, { kind: tall ? 'item tall' : 'item' });
}

// 캐릭터 카드 {slug, djName, id, level, worn, hearts} → 캐릭터 페이지로 가는 링크. rank: 몇 등(1~3등은 금·은·동 배지)
// label: 맨 위 작은 줄(없으면 "<DJ> 키우기", showDj 가 false 면 없음)
export function characterCard(c, { app, catalog, character, seasonId, showDj = true, eager = false, rank = null, label = null }) {
  const href = app.link({ name: 'character', slug: c.slug, base: baseOf(c.id) });
  return ilink(href, { class: 'kg-card' + (rank ? ` ranked r${Math.min(rank, 4)}` : '') },
    h('div', { class: 'kg-card-media' },
      art(catalog, character, c.worn, c.level, { seasonId, base: app.base, label: `${c.id} 캐릭터`, eager }),
      rank ? medal(rank, { className: 'kg-rank-badge', label: `${rank}등` }) : null),
    h('div', { class: 'kg-card-info' },
      label ? h('span', { class: 'kg-card-dj' + (rank === 1 ? ' accent' : '') }, label) : showDj && c.djName ? h('span', { class: 'kg-card-dj' }, `${c.djName} 키우기`) : null,
      h('b', { class: 'kg-card-id' }, ...idText(c.id)),
      h('span', { class: 'kg-card-meta' },
        h('span', { class: 'kg-card-lv' }, h('b', null, `Lv.${c.level ?? 1}`), ' ', expressionFor(catalog, seasonId, c.level).name),
        heartCount(c.hearts))));
}

// DJ 카드 {slug, name, character, count} → DJ 키우기 페이지로 가는 링크
export function djCard(d, { app, catalog, seasonId }) {
  return ilink(app.link({ name: 'kiugi', slug: d.slug }), { class: 'kg-card kg-dj' },
    h('div', { class: 'kg-card-media' },
      art(catalog, d.character, {}, 1, { seasonId, base: app.base, label: `${d.name} 캐릭터`, kind: 'dj' })),
    h('div', { class: 'kg-card-info' },
      h('span', { class: 'kg-card-dj' }, 'DJ 캐릭터'),
      h('b', { class: 'kg-card-id' }, `${d.name} 키우기`),
      h('span', { class: 'kg-card-meta' },
        h('span', { class: 'kg-card-lv' }, `청취자 ${fmt(d.count)}명`),
        h('span', { class: 'kg-card-go', 'aria-hidden': 'true' }, icon('arrow', { size: 16 })))));
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
