// 몬스터 도감(spec.md 7절): 12종 × 3단계 + 보스 6, 속성별 · 상성 고리 · 자주 만나는 산책 길.
//  주소 ?id=밤톨#먼치 로 오면 그 청취자가 데려간 몬스터는 색, 아직 못 만난 몬스터(또는 아직 닿지 않은 단계)는 그림자로.
//  보스는 데려가는 몬스터가 아니라서 늘 그대로 보인다.
import { h, icon } from '../lib/dom.js';
import { kiugiApi } from '../api.js';
import { ID_QUERY, cleanId } from '../lib/route.js';
import { TYPES, RING, STAGE_EXP, beatenBy, metOf, typeLabel, walkCommand } from '../lib/monsters.js';
import { nightTop, siteFoot, secHead, ilink, errorBox, loading } from './common.js';
import { monsterCtx, monsterArtEl, bossArtEl, stageName, matchup } from './monster-ui.js';

export const DEX_TITLE = '몬스터 도감';

export async function renderDex(root, app, route) {
  const main = h('main', { id: 'main', class: 's2-dex', tabindex: '-1' }, loading());
  root.replaceChildren(...nightTop(app), main, siteFoot(app, '몬스터 그림은 시즌 중에 더해져요. 2단계는 12월 7일, 3단계는 12월 14일쯤이에요.'));
  document.title = `${DEX_TITLE} · 스푼 DJ 키우기`;
  const ctx = await monsterCtx(app.base);
  const id = route.id && ID_QUERY.test(cleanId(route.id)) ? cleanId(route.id) : '';
  const who = h('div', { class: 's2-dex-who', 'aria-live': 'polite' });
  const body = h('div', { class: 's2-dex-body' });
  const paint = (met) => body.replaceChildren(ringSection(), ...TYPES.map((t) => typeSection(ctx, t, met)), growthSection());
  main.replaceChildren(
    h('header', { class: 's2-page-head' },
      h('p', { class: 's2-eyebrow' }, '키우기 시즌 2 · 몬스터 영토전'),
      h('h1', { class: 's2-page-title' }, DEX_TITLE),
      h('p', { class: 's2-page-sub' }, `몬스터 ${ctx.catalog.species.length}종 × 3단계 + 보스 ${ctx.catalog.bosses.length}마리 · 속성은 6가지예요.${ctx.catalog.named ? '' : ' 이름은 그림과 함께 곧 정해져요.'}`)),
    who, body);
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
    const met = metOf(person.monsters);
    who.replaceChildren(h('div', { class: 's2-dex-banner is-me' },
      h('p', null, h('b', null, person.id), ` 님이 데려간 몬스터 ${met.size} / ${ctx.catalog.species.length}`),
      h('p', { class: 'note' }, '색으로 보이는 것이 데려간 몬스터(닿은 단계까지)예요. 그림자는 아직 못 만난 몬스터예요.'),
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
      ...species.map((s) => {
        const got = met ? met.get(s.sp) || 0 : 3;
        return h('article', { class: 's2-sp' + (met && !got ? ' is-unmet' : '') },
          h('h3', null, got || !met ? s.name : '아직 못 만난 몬스터'),
          h('ol', { class: 's2-stages' }, ...[1, 2, 3].map((st) => h('li', { class: st <= got ? '' : 'is-off' },
            monsterArtEl(ctx, s.sp, st, { size: 'm', shadow: Boolean(met) && st > got, alt: st <= got ? stageName(ctx, s.sp, st) : '' }),
            h('b', null, st <= got || !met ? stageName(ctx, s.sp, st) : '???'),
            h('small', null, st === 1 ? '1단계' : `${st}단계 · 경험치 ${STAGE_EXP[st - 1].toLocaleString('ko-KR')}`)))),
          met && got ? h('p', { class: 's2-sp-me' }, `${got}단계까지 키웠어요`) : null);
      }),
      boss ? h('article', { class: 's2-sp is-boss' },
        h('h3', null, boss.name),
        h('div', { class: 's2-boss-row' }, bossArtEl(ctx, t.id, { size: 'l', alt: boss.name }),
          h('div', null, h('p', null, h('span', { class: 's2-badge' }, '보스')), h('p', null, `약점: ${typeLabel(beatenBy(t.id))}`), h('p', { class: 'note' }, '방송을 시작하고 1시간 뒤에 나와요. 약점 속성 몬스터가 많을수록 이기기 쉬워요.')))) : null));
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
