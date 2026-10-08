// 캐릭터 페이지(k/<주소>/<아이디 앞 부분>): 밤하늘 무대의 큰 그림 · 아이디 · 레벨과 표정 · 하트(하루 한 번) · 입은 옷(옷 그림) · DJ 페이지 링크 · 링크 복사.
// 애정도 숫자는 보이지 않는다. 하트 열쇠는 이 브라우저 저장소에만 둔다(lib/hearts.js). 로그인 없음.
import { h, icon, toast } from '../lib/dom.js';
import { kiugiApi } from '../api.js';
import { loadCatalog, buildCatalog, wornList } from '../lib/kiugi-draw.js';
import { heartToken, heartKey, sentToday, markSent } from '../lib/hearts.js';
import { ilink, loading, nightTop, siteFoot, secHead, BRAND } from './common.js';
import { art, itemArt, heartText, levelLine, copyLink } from './cards.js';

// 이 브라우저 저장소(막혀 있으면 null — lib/hearts.js 가 이번 창에서만 기억)
function browserStorage() { try { return window.localStorage; } catch { return null; } }
export const HEART_SENT = '♥ 오늘 하트 보냈어요';
export const HEART_SEND = '♥ 하트 보내기';

export async function renderCharacter(root, route, app) {
  document.title = BRAND;
  const night = h('div', { class: 'kg-night' }, ...nightTop(app));
  const main = h('main', { id: 'main', class: 'fp-main kg-main', tabindex: '-1' }, loading());
  const shell = h('div', { class: 'fp kg-site' }, night, main);
  root.replaceChildren(shell);
  const catalogJob = loadCatalog(app.base).catch(() => buildCatalog([]));
  let data;
  try { data = await kiugiApi.person(route.slug, route.base); }
  catch (e) { main.replaceChildren(missing(e, route, app)); return; }
  const catalog = await catalogJob;
  const dj = data.dj || {}, seasonId = data.season?.id || null;
  const djLink = app.link({ name: 'kiugi', slug: dj.slug });
  const url = location.origin + app.link({ name: 'character', slug: dj.slug, base: route.base });
  document.title = `${data.id} · ${dj.name} 키우기`;

  const worn = wornList(catalog, seasonId, data.worn);
  const gender = dj.character?.gender === 'm' ? 'm' : 'f';
  const storage = browserStorage();
  const key = heartKey(dj.slug, data.id, seasonId);
  const count = h('span', { class: 'kg-heart-count', 'aria-live': 'polite' }, heartText(data.hearts));
  const status = h('p', { class: 'form-status', role: 'status', 'aria-live': 'polite' });
  const copyBox = h('div', { class: 'kg-copy-box' });
  const heartBtn = h('button', { type: 'button', class: 'btn kg-heart-btn' }, HEART_SEND);
  const done = () => { heartBtn.disabled = true; heartBtn.textContent = HEART_SENT; heartBtn.classList.add('sent'); };
  if (sentToday(storage, key)) done();
  heartBtn.addEventListener('click', async () => {
    if (heartBtn.disabled) return;
    heartBtn.disabled = true; status.textContent = '';
    try {
      const r = await kiugiApi.heart(dj.slug, data.id, heartToken(storage));
      count.textContent = heartText(r.hearts);
      markSent(storage, key);
      done();
      if (!r.already) toast('하트를 보냈어요!');
    } catch (e) { heartBtn.disabled = false; status.textContent = e.message; }
  });

  night.replaceChildren(...nightTop(app),
    h('div', { class: 'kg-wrap' },
      h('section', { class: 'kg-hero char' },
        h('div', { class: 'kg-hero-art' }, art(catalog, dj.character, data.worn, data.level, { seasonId, base: app.base, label: `${data.id} 캐릭터`, eager: true, kind: 'night' })),
        h('div', { class: 'kg-hero-copy' },
          ilink(djLink, { class: 'kg-pill season' }, `${dj.name} 키우기`, icon('arrow', { size: 14 })),
          h('h1', { class: 'display kg-char-id' }, data.id),
          h('p', { class: 'kg-char-level' }, levelLine(catalog, seasonId, data.level)),
          h('div', { class: 'kg-heart-row' }, heartBtn, count),
          h('p', { class: 'kg-hero-stats' }, '하트는 하루에 한 번 보낼 수 있어요.'),
          status))));
  main.replaceChildren(
    h('section', { class: 'kg-sec' },
      secHead('입은 옷', worn.length ? `${worn.length}벌을 입고 있어요.` : ''),
      worn.length
        ? h('ul', { class: 'kg-worn' }, ...worn.map((w) => h('li', { class: 'kg-worn-one' },
          itemArt(catalog, w.id, { base: app.base, label: w.name, gender }),
          h('span', { class: 'kg-worn-text' }, h('span', { class: 'kg-worn-slot' }, w.slotName), h('b', null, w.name)))))
        : h('p', { class: 'empty' }, '아직 아무것도 입지 않았어요.')),
    h('section', { class: 'kg-panel kg-share' },
      h('div', null, h('b', null, '친구에게 알려 주기'), h('p', null, '링크를 보내서 하트를 부탁해 보세요.')),
      h('div', { class: 'row wrap gap' },
        h('button', { type: 'button', class: 'btn btn-accent', onclick: () => copyLink(url, copyBox) }, '링크 복사'),
        ilink(djLink, { class: 'btn btn-line' }, `${dj.name} 키우기 보기`)),
      copyBox));
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
