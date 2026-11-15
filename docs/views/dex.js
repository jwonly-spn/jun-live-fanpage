// 몬스터 도감(spec.md 7절): 18종(속성마다 3종 — _03 은 드문 몬스터) × 3단계 + 보스 6, 속성별 · 상성 고리 · 자주 만나는 산책 길.
//  대륙 이야기(season-s2.json intro) 한 칸 · 종마다 "📜 설화 읽기"(접어 둔 칸 — 계열 설화 lore + 단계마다 도감 글 dex).
//  주소 ?id=밤톨#먼치 로 오면 그 청취자가 데려간 몬스터는 색, 아직 못 만난 몬스터(또는 아직 닿지 않은 단계)는 그림자로.
//  못 만난 몬스터의 설화는 보여 주지 않고("만나면 설화를 볼 수 있어요"), 만난 몬스터도 닿지 않은 단계의 도감 글은 "???".
//  보스는 데려가는 몬스터가 아니라서 늘 그대로 보인다.
import { h, icon } from '../lib/dom.js';
import { kiugiApi } from '../api.js';
import { ID_QUERY, cleanId } from '../lib/route.js';
import { TYPES, RING, STAGE_EXP, beatenBy, metOf, typeLabel, walkCommand } from '../lib/monsters.js';
import { nightTop, siteFoot, secHead, ilink, errorBox, loading } from './common.js';
import { monsterCtx, monsterArtEl, bossArtEl, stageName, matchup, rareChip } from './monster-ui.js';

export const DEX_TITLE = '몬스터 도감';

export async function renderDex(root, app, route) {
  const main = h('main', { id: 'main', class: 's2-dex', tabindex: '-1' }, loading());
  root.replaceChildren(...nightTop(app), main, siteFoot(app));
  document.title = `${DEX_TITLE} · 스푼 DJ 키우기`;
  const ctx = await monsterCtx(app.base);
  const { species, bosses, intro } = ctx.catalog, rare = species.filter((s) => s.rare).length;
  const id = route.id && ID_QUERY.test(cleanId(route.id)) ? cleanId(route.id) : '';
  const who = h('div', { class: 's2-dex-who', 'aria-live': 'polite' });
  const body = h('div', { class: 's2-dex-body' });
  const paint = (met) => body.replaceChildren(ringSection(), ...TYPES.map((t) => typeSection(ctx, t, met)), growthSection());
  main.replaceChildren(
    h('header', { class: 's2-page-head' },
      h('p', { class: 's2-eyebrow' }, '키우기 시즌 2 · 몬스터 영토전'),
      h('h1', { class: 's2-page-title' }, DEX_TITLE),
      h('p', { class: 's2-page-sub' }, `몬스터 ${species.length}종 × 3단계 + 보스 ${bosses.length}마리 · 속성은 6가지예요.${rare ? ` 그중 ${rare}종은 드문 몬스터예요.` : ''}`)),
    who, intro ? introSection(intro) : null, body);
  paint(null);
  if (!id) { who.replaceChildren(idForm(app)); return; }
  who.replaceChildren(loading(`${id} 님의 몬스터를 찾는 중…`));
  try {
    const r = await kiugiApi.search(id);
    const list = (r.results || []).filter((p) => p && Array.isArray(p.monsters));
    const person = list.find((p) => cleanId(p.id) === id) || (list.length === 1 ? list[0] : null);
    if (!person) {
      who.replaceChildren(h('div', { class: 's2-dex-banner' }, h('p', null, list.length > 1 ? `${id} 아이디가 여러 방송에 있어요. 전체 아이디(예: ${list[0].id})로 다시 와 주세요.` : `${id} 아이디의 시즌 2 기록을 찾지 못했어요.`), idForm(app, id)));
      return;
    }
    const met = metOf(person.monsters), metCount = species.filter((s) => met.has(s.sp)).length;
    who.replaceChildren(h('div', { class: 's2-dex-banner is-me' },
      h('p', null, h('b', null, person.id), ` 님이 데려간 몬스터 ${metCount} / ${species.length}`),
      h('p', { class: 'note' }, '색으로 보이는 것이 데려간 몬스터(닿은 단계까지)예요. 그림자는 아직 못 만난 몬스터예요. 설화는 만난 몬스터만 읽을 수 있어요.'),
      ilink(app.link({ name: 'dex' }), { class: 'btn btn-line btn-sm' }, '모두 색으로 보기')));
    paint(met);
  } catch (e) {
    who.replaceChildren(errorBox(e.message || '찾지 못했어요.', () => renderDex(root, app, route)));
  }
}

function idForm(app, value = '') {
  const input = h('input', { type: 'search', class: 's2-input', placeholder: '아이디 예: 밤톨#먼치', value, autocomplete: 'off', maxlength: '20', 'aria-label': '아이디', enterkeyhint: 'go' });
  const msg = h('p', { class: 'note' }, '아이디를 넣으면 데려간 몬스터는 색, 못 만난 몬스터는 그림자로 보여요.');
  return h('form', { class: 's2-find-form s2-dex-form', onsubmit: (e) => {
    e.preventDefault();
    const q = cleanId(input.value);
    if (!ID_QUERY.test(q)) { msg.textContent = '아이디를 한글 1~6자로 적어 주세요. 예: 밤톨#먼치'; return; }
    app.navigate(app.link({ name: 'dex', id: q }));
  } }, h('span', { class: 's2-input-wrap' }, icon('search', { size: 18 }), input), h('button', { type: 'submit', class: 'btn btn-accent' }, '내 도감 보기'), msg);
}

// 대륙 이야기(한 문단) — 조용한 칸 하나
function introSection(text) {
  return h('section', { class: 's2-intro-wrap', 'aria-labelledby': 's2-intro-h' },
    h('div', { class: 's2-intro' },
      h('h2', { class: 's2-intro-title', id: 's2-intro-h' }, icon('book', { size: 16 }), '대륙 이야기'),
      h('p', { class: 's2-intro-text' }, text)));
}

function ringSection() {
  return h('section', { class: 's2-panel s2-ring', 'aria-labelledby': 's2-ring-h' },
    secHead('속성 상성', '왼쪽이 오른쪽에 강해요. 강한 쪽으로 공격하면 1.5배, 약한 쪽이면 0.75배예요.', null, { id: 's2-ring-h' }),
    h('p', { class: 's2-ring-line big', 'aria-label': '물이 불에, 불이 풀에, 풀이 땅에, 땅이 전기에, 전기가 바람에, 바람이 물에 강해요' },
      ...RING.flatMap((t) => [h('span', { class: `mon-type t-${t}` }, typeLabel(t)), h('span', { class: 's2-ring-arrow', 'aria-hidden': 'true' }, '›')]),
      h('span', { class: `mon-type t-${RING[0]}` }, typeLabel(RING[0]))),
    h('p', { class: 'note' }, '물은 불을 끄고, 불은 풀을 태우고, 풀은 뿌리로 땅을 붙잡고, 땅은 전기를 흘려보내고, 전기는 바람을 가르고, 바람은 물결을 흩어요.'));
}

function typeSection(ctx, t, met) {
  const species = ctx.catalog.species.filter((s) => s.type === t.id), boss = ctx.catalog.bosses.find((b) => b.type === t.id);
  return h('section', { class: `s2-type t-${t.id}`, 'aria-labelledby': `s2-type-${t.id}` },
    h('div', { class: 's2-type-head' },
      h('h2', { class: 'sec-title', id: `s2-type-${t.id}` }, `${t.emoji} ${t.name} 속성`),
      h('p', null, matchup(t.id)),
      h('p', { class: 's2-walk' }, icon('paw', { size: 15 }), '자주 만나는 산책 길 ', h('code', { class: 'kg-cmd' }, walkCommand(t.id)))),
    h('div', { class: 's2-species' },
      ...species.map((s) => speciesCard(ctx, s, met)),
      boss ? h('article', { class: 's2-sp is-boss' },
        h('h3', null, boss.name),
        h('div', { class: 's2-boss-row' }, bossArtEl(ctx, t.id, { size: 'l', alt: boss.name }),
          h('div', null, h('p', null, h('span', { class: 's2-badge' }, '보스')), h('p', null, `약점: ${typeLabel(beatenBy(t.id))}`), h('p', { class: 'note' }, '방송을 시작하고 1시간 뒤에 나와요. 약점 속성 몬스터가 많을수록 이기기 쉬워요.')))) : null));
}

// 한 종 칸: 이름(드문 몬스터 표시) · 3단계 그림 · 내가 키운 단계 · 설화(접어 둔 칸)
function speciesCard(ctx, s, met) {
  const got = met ? met.get(s.sp) || 0 : 3, unmet = Boolean(met) && !got;
  return h('article', { class: 's2-sp' + (unmet ? ' is-unmet' : '') + (s.rare ? ' is-rare' : '') },
    h('div', { class: 's2-sp-head' },
      h('h3', null, unmet ? '아직 못 만난 몬스터' : s.name),
      rareChip(ctx, s.sp)),
    h('ol', { class: 's2-stages' }, ...[1, 2, 3].map((st) => h('li', { class: st <= got ? '' : 'is-off' },
      monsterArtEl(ctx, s.sp, st, { size: 'm', shadow: Boolean(met) && st > got, alt: st <= got ? stageName(ctx, s.sp, st) : '' }),
      h('b', null, st <= got || !met ? stageName(ctx, s.sp, st) : '???'),
      h('small', null, st === 1 ? '1단계' : `${st}단계 · 경험치 ${STAGE_EXP[st - 1].toLocaleString('ko-KR')}`)))),
    met && got ? h('p', { class: 's2-sp-me' }, `${got}단계까지 키웠어요`) : null,
    loreBox(ctx, s, got, unmet));
}

// 설화: 못 만난 몬스터는 잠금 한 줄 · 만난 몬스터는 닿은 단계까지 도감 글(그 뒤는 ???) · 설화가 없는 목록(자리 목록)이면 칸 없음
function loreBox(ctx, s, got, unmet) {
  if (!s.lore && !s.dex.some(Boolean)) return null;
  if (unmet) return h('p', { class: 's2-lore-locked' }, icon('lock', { size: 14 }), '만나면 설화를 볼 수 있어요');
  // 아직 닿지 않은 단계 이름은 설화·도감 글 속에서도 ???(2026-11-15 — 설화가 마지막 단계 이름을 부르는 글이 많아서). 긴 이름부터 바꾼다.
  const hide = [1, 2, 3].filter((st) => st > got).map((st) => stageName(ctx, s.sp, st)).filter(Boolean).sort((a, b) => b.length - a.length);
  const mask = (text) => hide.reduce((t, name) => t.split(name).join('???'), String(text || ''));
  const stages = [1, 2, 3].filter((st) => s.dex[st - 1]).map((st) => {
    const open = st <= got;
    return h('li', { class: open ? '' : 'is-off' },
      h('p', { class: 's2-lore-stage' }, h('b', null, open ? stageName(ctx, s.sp, st) : '???'), h('small', null, `${st}단계`)),
      h('p', { class: 's2-lore-dex' }, open ? mask(s.dex[st - 1]) : '???'));
  });
  return h('details', { class: 's2-lore' },
    h('summary', null, h('span', { class: 's2-lore-mark', 'aria-hidden': 'true' }, '📜'), '설화 읽기'),
    h('div', { class: 's2-lore-in' },
      s.lore ? h('p', { class: 's2-lore-text' }, mask(s.lore)) : null,
      stages.length ? h('ol', { class: 's2-lore-stages', 'aria-label': '단계마다 도감 글' }, ...stages) : null));
}

function growthSection() {
  return h('section', { class: 's2-panel s2-growth', 'aria-labelledby': 's2-growth-h' },
    secHead('몬스터 키우기', '경험치로 자라요. 냥 1 = 경험치 1이에요.', null, { id: 's2-growth-h' }),
    h('ul', { class: 's2-growth-list' },
      h('li', null, h('b', null, '2단계'), h('span', null, '경험치 4,500')),
      h('li', null, h('b', null, '3단계'), h('span', null, '경험치 14,000(모두 합쳐)')),
      h('li', null, h('b', null, '레벨'), h('span', null, '경험치가 쌓이면 올라요')),
      h('li', null, h('b', null, '힘'), h('span', null, '레벨이 높고 단계가 높을수록 세요(2단계 1.25배 · 3단계 1.5배)'))),
    h('p', { class: 'note' }, '같은 몬스터는 한 마리만 데려가요. 이미 있는 몬스터를 산책에서 또 만나면 그 몬스터 경험치가 올라요.'));
}
