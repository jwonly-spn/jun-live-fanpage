// 캐릭터 페이지(k/<주소>/<아이디 앞 부분>): 무대 위 큰 캐릭터 · 아이디 · 레벨과 표정 · 정보 칸 · 하트(하루 한 번) · 입은 옷(칸마다, 빈 칸도) · DJ 페이지 링크 · 링크 복사.
// 애정도 숫자는 보이지 않는다. 하트 열쇠는 이 브라우저 저장소에만 둔다(lib/hearts.js). 로그인 없음.
import { h, icon, toast } from '../lib/dom.js';
import { kiugiApi } from '../api.js';
import { loadCatalog, buildCatalog, wornList, expressionFor } from '../lib/kiugi-draw.js';
import { heartToken, heartKey, sentToday, markSent } from '../lib/hearts.js';
import { ilink, loading, nightTop, siteFoot, secHead, BRAND } from './common.js';
import { art, itemArt, copyLink, idText } from './cards.js';

// 이 브라우저 저장소(막혀 있으면 null — lib/hearts.js 가 이번 창에서만 기억)
function browserStorage() { try { return window.localStorage; } catch { return null; } }
export const HEART_SENT = '오늘 하트 보냈어요';
export const HEART_SEND = '하트 보내기';

// 입은 옷 칸 목록: 이번 시즌 칸 차례대로(입지 않은 칸은 빈 칸), 시즌 칸에 없는 것(시즌 보상 왕관·날개·오라)은 뒤에.
//  그림 V4: 한벌옷을 입으면 상의·하의 칸은 "한벌옷이 덮고 있어요", 왕관을 쓰면 머리 장식 칸은 "왕관이 가려요"(covered).
export const COVERED = Object.freeze({ outfit: '한벌옷이 덮고 있어요', crown: '왕관이 가려요' });
export function loadoutSlots(catalog, seasonId, worn) {
  const list = wornList(catalog, seasonId, worn);
  const slots = (catalog?.seasons?.[seasonId] || catalog?.seasons?.[catalog?.last])?.slots || [];
  const bySlot = new Map(list.map((w) => [w.slot, w]));
  const cover = (id) => (['top', 'bottom'].includes(id) && bySlot.has('outfit') ? COVERED.outfit : id === 'head' && bySlot.has('crown') ? COVERED.crown : null);
  const out = slots.map((s) => bySlot.get(s.id) || { slot: s.id, slotName: s.name, id: null, name: '', ...(cover(s.id) ? { covered: cover(s.id) } : {}) });
  for (const w of list) if (!slots.some((s) => s.id === w.slot)) out.push(w);
  return out;
}

export async function renderCharacter(root, route, app) {
  document.title = BRAND;
  const night = h('div', { class: 'kg-night' });
  const main = h('main', { id: 'main', class: 'fp-main kg-main', tabindex: '-1' }, loading());
  const shell = h('div', { class: 'fp kg-site' }, ...nightTop(app), night, main);
  root.replaceChildren(shell);
  const catalogJob = loadCatalog(app.base).catch(() => buildCatalog([]));
  let data;
  try { data = await kiugiApi.person(route.slug, route.base); }
  catch (e) { main.replaceChildren(missing(e, route, app)); shell.append(siteFoot(app)); return; }
  const catalog = await catalogJob;
  const dj = data.dj || {}, seasonId = data.season?.id || null;
  const djLink = app.link({ name: 'kiugi', slug: dj.slug });
  const url = location.origin + app.link({ name: 'character', slug: dj.slug, base: route.base });
  document.title = `${data.id} · ${dj.name} 키우기`;

  const worn = wornList(catalog, seasonId, data.worn);
  const slots = loadoutSlots(catalog, seasonId, data.worn);
  const gender = dj.character?.gender === 'm' ? 'm' : 'f';
  const storage = browserStorage();
  const key = heartKey(dj.slug, data.id, seasonId);
  const fmtN = (n) => Number(n || 0).toLocaleString('ko-KR');
  const count = h('b', { class: 'kg-heart-num', 'aria-live': 'polite', 'aria-label': `하트 ${fmtN(data.hearts)}개` }, fmtN(data.hearts));
  const setCount = (n) => { count.textContent = fmtN(n); count.setAttribute('aria-label', `하트 ${fmtN(n)}개`); };
  const status = h('p', { class: 'form-status', role: 'status', 'aria-live': 'polite' });
  const copyBox = h('div', { class: 'kg-copy-box' });
  const heartLabel = h('span', null, HEART_SEND);
  const heartBtn = h('button', { type: 'button', class: 'btn btn-accent kg-heart-btn' }, icon('heart', { size: 20, filled: true }), heartLabel);
  const done = () => { heartBtn.disabled = true; heartLabel.textContent = HEART_SENT; heartBtn.classList.add('sent'); };
  if (sentToday(storage, key)) done();
  heartBtn.addEventListener('click', async () => {
    if (heartBtn.disabled) return;
    heartBtn.disabled = true; status.textContent = '';
    try {
      const r = await kiugiApi.heart(dj.slug, data.id, heartToken(storage));
      setCount(r.hearts);
      markSent(storage, key);
      done();
      if (!r.already) toast('하트를 보냈어요!');
    } catch (e) { heartBtn.disabled = false; status.textContent = e.message; }
  });

  const level = Number(data.level) || 1;
  const expression = expressionFor(catalog, seasonId, level).name;
  const fact = (label, value) => h('div', { class: 'kg-fact' }, h('dt', null, label), h('dd', null, value));
  night.replaceChildren(
    h('div', { class: 'kg-wrap' },
      h('section', { class: 'kg-hero char' },
        h('div', { class: 'kg-hero-art' },
          art(catalog, dj.character, data.worn, data.level, { seasonId, base: app.base, label: `${data.id} 캐릭터`, eager: true, kind: 'hero' })),
        h('div', { class: 'kg-hero-copy' },
          ilink(djLink, { class: 'kg-crumb' }, `${dj.name} 키우기`, icon('arrow', { size: 14 })),
          h('h1', { class: 'display kg-char-id' }, ...idText(data.id)),
          h('p', { class: 'kg-char-level' }, h('span', { class: 'kg-lv' }, `Lv.${level}`), h('span', null, expression)),
          h('dl', { class: 'kg-facts' },
            fact('하트', count),
            fact('입은 옷', `${worn.length}벌`),
            fact('시즌', data.season?.name || '—')),
          h('div', { class: 'kg-heart-row' }, heartBtn,
            h('button', { type: 'button', class: 'btn btn-line kg-copy-btn', onclick: () => copyLink(url, copyBox) }, icon('link', { size: 18 }), '링크 복사')),
          h('p', { class: 'kg-hero-note' }, '하트는 하루에 한 번 보낼 수 있어요. 링크를 보내서 친구에게 하트를 부탁해 보세요.'),
          status, copyBox))));
  main.replaceChildren(
    h('section', { class: 'kg-sec' },
      secHead('입은 옷', worn.length ? `${worn.length}벌을 입고 있어요.` : '아직 아무것도 입지 않았어요.'),
      slots.length
        ? h('ul', { class: 'kg-worn' }, ...slots.map((w) => h('li', { class: 'kg-worn-one' + (w.id ? '' : ' is-empty') },
          w.id ? itemArt(catalog, w.id, { base: app.base, label: w.name, gender, dj: dj.character }) : h('span', { class: 'kg-stage item kg-slot-empty', 'aria-hidden': 'true' }),
          h('span', { class: 'kg-worn-text' }, h('span', { class: 'kg-worn-slot' }, w.slotName), h('b', null, w.id ? w.name : w.covered || '비어 있음')))))
        : h('p', { class: 'empty' }, '아직 아무것도 입지 않았어요.')),
    h('section', { class: 'kg-banner' },
      h('div', { class: 'kg-banner-text' }, h('b', null, `${dj.name} 키우기의 다른 캐릭터`), h('p', null, '이번 시즌 1~3등과 내 아이디 찾기는 DJ 키우기 페이지에 있어요.')),
      ilink(djLink, { class: 'btn btn-line' }, `${dj.name} 키우기 보기`, icon('arrow', { size: 16 }))));
  shell.append(siteFoot(app, '청취자가 방송에서 직접 만든 아이디와 레벨·입은 옷·하트만 보여요.'));
}

function missing(e, route, app) {
  const notFound = e.status === 404;
  return h('div', { class: 'kg-panel fp-missing' },
    h('h1', { class: 'sec-title' }, e.closed ? '키우기 페이지가 닫혀 있어요' : notFound ? '캐릭터를 찾을 수 없어요' : '캐릭터를 불러오지 못했어요'),
    h('p', { class: 'muted' }, e.message || '주소가 맞는지 확인해 주세요.'),
    h('div', { class: 'row wrap gap' },
      e.closed ? null : ilink(app.link({ name: 'kiugi', slug: route.slug }), { class: 'btn btn-line' }, 'DJ 키우기 페이지로'),
      ilink(app.link({ name: 'intro' }), { class: 'btn btn-accent' }, `${BRAND} 메인으로`)));
}
