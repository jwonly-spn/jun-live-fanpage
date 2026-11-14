// 몬스터 그림·이름 조각(첫 화면 찾기 결과 · 몬스터 도감). 목록·그림 이름 규칙은 lib/monsters.js.
//  그림이 아직 없으면 속성 색 동그라미(자리 그림) — 1024² PNG 를 칸 크기로 줄여 보이고, 화면 가까이 올 때 받는다(loading=lazy).
import { h } from '../lib/dom.js';
import { readSiteJson } from '../api.js';
import { TYPE, artFiles, readCatalog, monsterArt, bossArt, typeLabel, powerOf, speciesOf, beats, beatenBy } from '../lib/monsters.js';

// 사이트에 복사된 그림 목록(docs/kiugi/manifest.json)·시즌 2 목록(docs/kiugi/season-s2.json) — 한 번만 받는다
let ctxJob = null;
export function monsterCtx(base) {
  if (!ctxJob) ctxJob = Promise.all([readSiteJson(base, 'manifest.json'), readSiteJson(base, 'season-s2.json')])
    .then(([manifest, season]) => ({ base, files: artFiles(manifest), catalog: readCatalog(season) }));
  return ctxJob;
}
export const speciesInfo = (ctx, sp) => ctx.catalog.species.find((s) => s.sp === sp) || null;
export function stageName(ctx, sp, stage) {
  const s = speciesInfo(ctx, sp);
  return s ? s.stages[Math.max(1, Math.min(3, stage)) - 1] || s.name : sp;
}

// 그림 하나: {size: 's'|'m'|'l', shadow: 못 만난 것(그림자)} → <figure>
export function monsterArtEl(ctx, sp, stage, { size = 'm', shadow = false, alt = '' } = {}) {
  const sinfo = speciesOf(sp), type = sinfo?.type || 'none', art = monsterArt(ctx.base, ctx.files, sp, stage);
  const cls = `mon-art mon-${size} t-${TYPE[type] ? type : 'none'}${shadow ? ' is-shadow' : ''}`;
  if (art) return h('span', { class: cls }, h('img', { src: art.url, alt, loading: 'lazy', decoding: 'async', width: 256, height: 256 }));
  return placeholder(cls, type, stage, alt);
}
export function bossArtEl(ctx, type, { size = 'm', alt = '' } = {}) {
  const art = bossArt(ctx.base, ctx.files, type), cls = `mon-art mon-${size} is-boss t-${TYPE[type] ? type : 'none'}`;
  if (art) return h('span', { class: cls }, h('img', { src: art.url, alt, loading: 'lazy', decoding: 'async', width: 256, height: 256 }));
  return placeholder(cls, type, 0, alt);
}
// 자리 그림: 속성 색 동그라미 + 속성 그림 글자 + 단계 점(보스는 왕관 점)
function placeholder(cls, type, stage, alt) {
  return h('span', { class: cls + ' is-ph', role: alt ? 'img' : null, 'aria-label': alt || null, 'aria-hidden': alt ? null : 'true' },
    h('span', { class: 'mon-ph-ball' }, h('span', { class: 'mon-ph-mark' }, TYPE[type]?.emoji || '?')),
    stage > 0 ? h('span', { class: 'mon-ph-pips' }, ...[1, 2, 3].map((n) => h('i', { class: n <= stage ? 'on' : '' }))) : h('span', { class: 'mon-ph-pips boss' }, h('i', { class: 'on' })));
}
// 그림이 그 단계 것이 아니면(2단계 12-07 · 3단계 12-14 에 더해진다) 한 줄
export function soonNote(ctx, sp, stage) {
  const art = monsterArt(ctx.base, ctx.files, sp, stage);
  return art && art.soon ? h('p', { class: 'mon-soon' }, '곧 진화 모습이 나와요') : null;
}
export const typeChip = (type) => (TYPE[type] ? h('span', { class: `mon-type t-${type}` }, typeLabel(type)) : null);
// 한 마리 요약 줄: "2단계 · Lv.14 · 힘 92"
export const statLine = (m) => `${m.stage}단계 · Lv.${m.lv} · 힘 ${powerOf(m.lv, m.stage).toLocaleString('ko-KR')}`;
// 상성 한 줄: "🌿 풀에 강해요 · 🌪 바람에 약해요"
export function matchup(type) {
  if (!TYPE[type]) return '';
  return `${typeLabel(beats(type))}에 강해요 · ${typeLabel(beatenBy(type))}에 약해요`;
}
