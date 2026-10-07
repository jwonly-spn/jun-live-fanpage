// DJ 키우기 페이지(k/<주소>): DJ 캐릭터 · 닉네임으로 내 캐릭터 찾기 · 이번 시즌 1~3등.
// DJ의 먼치킨(봇 프로그램)이 올린 것(DJ 캐릭터, 청취자 닉네임·레벨·애정도·입은 옷)만 보여 준다. 로그인 없음.
import { h, icon, applyTheme, store } from '../lib/dom.js';
import { kiugiApi } from '../api.js';
import { relativeTime, formatDate } from '../lib/text.js';
import { loadCatalog, buildCatalog, characterMarkup, expressionFor, svgNode } from '../lib/kiugi-draw.js';
import { ilink, loading, errorBox, share } from './common.js';

const NICK = 'kg_nick';
const MEDALS = ['🥇', '🥈', '🥉'];
const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
// 조사: 이름 끝 글자에 받침이 있으면 a(을·이), 없으면 b(를·가). 숫자는 읽는 소리로, 그 밖(영문 등)은 받침 없음으로 본다.
export function josa(word, a, b) {
  const c = String(word ?? '').trim().slice(-1), code = c.charCodeAt(0);
  const batchim = code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 !== 0 : /[013678]/.test(c);
  return String(word ?? '') + (batchim ? a : b);
}

// 찾기 결과 한 줄의 글(시험에서 바로 쓴다)
export function personLine(p, catalog, seasonId) {
  return { title: `${p.rank}등 · ${p.nickname}`, sub: `Lv.${p.level} ${expressionFor(catalog, seasonId, p.level).name} · 애정도 ${fmt(p.love)}` };
}
export function seasonLine(season, now = Date.now()) {
  if (!season) return '다음 시즌 준비 중';
  const end = formatDate(season.endsAt, now);
  return end ? `${season.name} 시즌 · ${end}까지` : `${season.name} 시즌`;
}

export async function renderKiugi(root, route, app) {
  document.title = 'DJ 키우기';
  const shell = h('div', { class: 'fp kg-site' });
  applyTheme(shell, 'lavender'); applyTheme(document.documentElement, 'lavender');
  const main = h('main', { id: 'main', class: 'fp-main kg-main', tabindex: '-1' }, loading());
  shell.append(main);
  root.replaceChildren(shell);
  let page;
  const catalogJob = loadCatalog(app.base).catch(() => buildCatalog([]));
  try { page = await kiugiApi.page(route.slug); }
  catch (e) { main.replaceChildren(missing(e, () => renderKiugi(root, route, app), app)); return; }
  const catalog = await catalogJob;
  const name = page.name || page.character?.name || 'DJ';
  const seasonId = page.season?.id || null;
  document.title = `${name} 키우기`;
  const href = location.origin + app.link({ name: 'kiugi', slug: page.slug });
  const draw = (worn, level, label) => {
    const node = svgNode(characterMarkup(catalog, page.character, worn, level, { seasonId, base: app.base, label }));
    return h('div', { class: 'kg-stage' }, node || h('span', { class: 'kg-noart' }, label));
  };

  shell.replaceChildren(
    h('header', { class: 'fp-top' },
      ilink(app.link({ name: 'kiugi', slug: page.slug }), { class: 'fp-brand' }, `${name} 키우기`),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': '공유하기', onclick: () => share(href, `${name} 키우기`) }, icon('share'))),
    main);
  const hero = h('section', { class: 'card pad kg-hero' },
    h('div', { class: 'kg-hero-text' },
      h('span', { class: 'chip-soft' }, (page.season ? '🎃 ' : '🍂 ') + seasonLine(page.season)),
      h('h1', { class: 'display' }, `${name} 키우기`),
      h('p', { class: 'muted' }, page.paused ? '다음 시즌을 준비하고 있어요. 새 시즌이 시작되면 다시 만나요!' : `방송에서 모은 냥으로 청취자마다 자기 ${josa(name, '을', '를')} 꾸며요.`)),
    h('div', { class: 'kg-hero-art' }, draw({}, 1, `${name} 캐릭터`)));
  main.replaceChildren(hero);
  if (!page.paused) {
    main.append(findCard(page, catalog, seasonId, name, draw), topCard(page, catalog, seasonId, draw));
  }
  main.append(howCard(name));
  shell.append(h('footer', { class: 'fp-foot kg-foot' },
    h('p', null, `참여한 청취자 ${fmt(page.count)}명 · ${relativeTime(page.updatedAt) || '조금 전'} 업데이트`),
    h('p', null, `이 페이지에는 DJ의 먼치킨이 올린 닉네임·레벨·애정도·입은 옷만 보여요. 내 닉네임을 빼고 싶으면 DJ에게 말해 주세요.`),
    h('p', null, 'JUN LIVE 팬페이지')));
}

function missing(e, retry, app) {
  const notFound = e.status === 404;
  return h('div', { class: 'fp-missing' },
    h('h1', { class: 'sec-title' }, e.closed ? '키우기 페이지가 닫혀 있어요' : notFound ? '키우기 페이지를 찾을 수 없어요' : '키우기 페이지를 열지 못했어요'),
    h('p', { class: 'muted' }, e.closed ? 'DJ가 지금은 키우기 페이지를 닫아 두었어요. 다시 열리면 이 주소로 볼 수 있어요.' : notFound ? '주소가 맞는지 확인해 주세요.' : e.message),
    notFound ? null : h('button', { type: 'button', class: 'btn btn-line', onclick: retry }, '다시 해 보기'),
    ilink(app.link({ name: 'intro' }), { class: 'btn btn-line' }, 'JUN LIVE 팬페이지 알아보기'));
}

// 닉네임으로 내 캐릭터 찾기(마지막으로 찾은 닉네임은 이 기기에 기억해 다음에 바로 보여 준다)
function findCard(page, catalog, seasonId, name, draw) {
  const input = h('input', { id: 'kg_q', type: 'search', maxlength: 40, placeholder: '방송 닉네임', autocomplete: 'nickname', enterkeyhint: 'search' });
  input.value = store.get(NICK, '') || '';
  const status = h('p', { class: 'form-status', role: 'status', 'aria-live': 'polite' });
  const results = h('div', { class: 'kg-results' });
  const submit = h('button', { type: 'submit', class: 'btn btn-accent' }, '찾기');
  const form = h('form', { class: 'kg-find', role: 'search', novalidate: true },
    h('label', { for: 'kg_q', class: 'kg-find-label' }, '내 닉네임'),
    h('div', { class: 'kg-find-row' }, input, submit), status);
  let seq = 0;
  async function search(q) {
    const my = ++seq;
    if (!q) { status.textContent = '닉네임을 적어 주세요.'; input.focus(); return; }
    if ([...q].length > 40) { status.textContent = '40자까지 적을 수 있어요.'; return; }
    submit.disabled = true; status.textContent = '찾는 중…'; results.replaceChildren();
    try {
      const r = await kiugiApi.find(page.slug, q);
      if (my !== seq) return;
      store.set(NICK, q);
      status.textContent = '';
      if (!r.results?.length) {
        results.replaceChildren(h('p', { class: 'empty' }, `'${q}'(으)로 찾은 청취자가 없어요. 방송에서 냥을 모으면 5분쯤 뒤에 여기 보여요.`));
      } else {
        results.replaceChildren(...r.results.map((p, i) => resultItem(p, catalog, seasonId, draw, i === 0 && r.exact > 0)),
          ...(r.more ? [h('p', { class: 'note' }, '비슷한 닉네임이 더 있어요. 닉네임을 정확히 적으면 더 잘 찾아요.')] : []));
      }
    } catch (e) { if (my === seq) { status.textContent = ''; results.replaceChildren(errorBox(e.message, () => search(q))); } }
    finally { if (my === seq) submit.disabled = false; }
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); void search(input.value.trim()); });
  if (input.value) queueMicrotask(() => void search(input.value.trim()));
  return h('section', { class: 'card pad stack kg-find-card', id: 'find' },
    h('h2', { class: 'sec-title' }, `내 ${name} 찾기`),
    h('p', { class: 'muted small' }, `스푼 방송에서 쓰는 닉네임을 적으면 내가 꾸민 ${josa(name, '이', '가')} 보여요.`),
    form, results);
}

function resultItem(p, catalog, seasonId, draw, found) {
  const line = personLine(p, catalog, seasonId);
  return h('article', { class: 'kg-result' + (found ? ' found' : '') },
    draw(p.worn, p.level, `${p.nickname}님의 캐릭터`),
    h('div', { class: 'kg-result-text' },
      found ? h('span', { class: 'eyebrow' }, '찾았어요!') : null,
      h('b', null, line.title),
      h('span', { class: 'muted small' }, line.sub)));
}

function topCard(page, catalog, seasonId, draw) {
  const top = Array.isArray(page.top) ? page.top.slice(0, 3) : [];
  return h('section', { class: 'card pad stack', 'aria-labelledby': 'kg_top' },
    h('h2', { class: 'sec-title', id: 'kg_top' }, '이번 시즌 1~3등'),
    h('p', { class: 'muted small' }, '애정도(이번 시즌에 받은 냥)가 높은 순서예요.'),
    top.length
      ? h('ol', { class: 'kg-top' }, ...top.map((p, i) => h('li', { class: 'kg-top-item' },
        draw(p.worn, p.level, `${i + 1}등 ${p.nickname}님의 캐릭터`),
        h('b', null, `${MEDALS[i] || ''} ${i + 1}등`),
        h('span', { class: 'kg-top-name' }, p.nickname),
        h('span', { class: 'muted small' }, `Lv.${p.level} ${expressionFor(catalog, seasonId, p.level).name}`),
        h('span', { class: 'muted small' }, `애정도 ${fmt(p.love)}`))))
      : h('p', { class: 'empty' }, '아직 순위가 없어요. 방송에서 냥을 모아 보세요!'));
}

function howCard(name) {
  const cmd = (t) => h('code', { class: 'kg-cmd' }, t);
  return h('section', { class: 'card pad stack' },
    h('h2', { class: 'sec-title sm' }, '어떻게 키워요?'),
    h('ul', { class: 'kg-how' },
      h('li', null, '방송에서 채팅·좋아요·하트·스푼·출석으로 냥을 모아요.'),
      h('li', null, '채팅에 ', cmd(`!${name}상점`), ' 을 치면 옷 목록이 나와요. ', cmd(`!${name}구매 옷이름`), ' 으로 사면 바로 입어요.'),
      h('li', null, '애정도가 오르면 레벨이 오르고 표정이 바뀌어요(Lv.10까지).'),
      h('li', null, '방송 중에 내 ', name, ' 보기: ', cmd(`!${name}`), ' · 순위: ', cmd(`!${name}순위`))),
    h('p', { class: 'note' }, '냥은 현금·스푼으로 바꿀 수 없어요. 시즌이 끝나면 새로 시작하고 시즌 보상만 남아요. 이 페이지는 5분쯤마다 새로 올라와요.'));
}
