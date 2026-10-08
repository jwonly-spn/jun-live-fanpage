// DJ 키우기 페이지(k/<주소>): DJ 캐릭터 · 내 아이디로 찾기 · 이번 시즌 1~3등. 카드를 누르면 캐릭터 페이지(k/<주소>/<아이디 앞 부분>).
// DJ의 먼치킨(봇 프로그램)이 올린 것(DJ 캐릭터, 청취자가 방송에서 "!아이디"로 직접 만든 시즌 아이디·레벨·입은 옷)과 하트 수만 보여 준다.
// 아이디 모양: "<앞 한글 1~6자>#<캐릭터 이름>"(예: 밤톨#먼치). 애정도 숫자는 보이지 않는다(순서만 애정도 순). 스푼 정보는 쓰지 않는다. 로그인 없음.
import { h, icon, store } from '../lib/dom.js';
import { kiugiApi } from '../api.js';
import { relativeTime, formatDate } from '../lib/text.js';
import { loadCatalog, buildCatalog, expressionFor } from '../lib/kiugi-draw.js';
import { ilink, loading, errorBox, share } from './common.js';
import { art, heartText, baseOf } from './cards.js';

const MEDALS = ['🥇', '🥈', '🥉'];
const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
// 찾기 칸 규칙(서버와 같음): 앞 부분만("밤톨", 한글 1~6자) 또는 전체 아이디("밤톨#먼치"). 띄어쓰기는 뺀다.
export const QUERY_RULE = /^[가-힣]{1,6}(#[가-힣A-Za-z0-9]{1,8})?$/;
export const idKey = (s) => String(s ?? '').normalize('NFC').replace(/\s+/g, '');
// 찾은 아이디는 페이지·시즌마다 이 기기에 기억한다(시즌이 바뀌면 아이디도 새로 만들기 때문).
const savedKey = (slug, seasonId) => `kg_id:${slug}:${seasonId || '-'}`;

// 조사: 이름 끝 글자에 받침이 있으면 a(을·이), 없으면 b(를·가). 숫자는 읽는 소리로, 그 밖(영문 등)은 받침 없음으로 본다.
export function josa(word, a, b) {
  const c = String(word ?? '').trim().slice(-1), code = c.charCodeAt(0);
  const batchim = code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 !== 0 : /[013678]/.test(c);
  return String(word ?? '') + (batchim ? a : b);
}

// 찾기 결과 한 줄의 글(시험에서 바로 쓴다): 순위·아이디, 레벨·표정, 하트(애정도 숫자는 없음)
export function personLine(p, catalog, seasonId) {
  return { title: `${p.rank}등 · ${p.id}`, sub: `Lv.${p.level} ${expressionFor(catalog, seasonId, p.level).name} · ${heartText(p.hearts)}` };
}
export function seasonLine(season, now = Date.now()) {
  if (!season) return '다음 시즌 준비 중';
  const end = formatDate(season.endsAt, now);
  return end ? `${season.name} 시즌 · ${end}까지` : `${season.name} 시즌`;
}
// 찾기 칸 글 검사: 괜찮으면 null, 아니면 안내 글
export function checkQuery(q) {
  const key = idKey(q);
  if (!key) return '아이디를 적어 주세요.';
  if (!QUERY_RULE.test(key)) return '아이디는 한글 1~6자예요. 예: 먼치팬 또는 먼치팬#먼치';
  return null;
}

export async function renderKiugi(root, route, app) {
  document.title = 'DJ 키우기';
  store.remove('kg_nick'); // 예전 판이 이 기기에 남긴 찾기 글은 지운다
  const shell = h('div', { class: 'fp kg-site' });
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
  const ctx = { app, catalog, character: page.character, seasonId, slug: page.slug, name };

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
    h('div', { class: 'kg-hero-art' }, art(catalog, page.character, {}, 1, { seasonId, base: app.base, label: `${name} 캐릭터`, eager: true })));
  main.replaceChildren(hero);
  if (!page.paused) main.append(findCard(page, ctx), topCard(page, ctx));
  main.append(howCard(name));
  shell.append(h('footer', { class: 'fp-foot kg-foot' },
    h('p', null, `참여한 청취자 ${fmt(page.count)}명 · ${relativeTime(page.updatedAt) || '조금 전'} 업데이트`),
    h('p', null, '이 페이지에는 청취자가 방송에서 직접 만든 아이디와 레벨·입은 옷·하트만 보여요. 내 아이디를 빼고 싶으면 DJ에게 말해 주세요.'),
    h('p', null, ilink(app.link({ name: 'intro' }), { class: 'kg-foot-link' }, '먼치킨 키우기 메인'), ' · 스푼이 만든 서비스가 아니에요')));
}

function missing(e, retry, app) {
  const notFound = e.status === 404;
  return h('div', { class: 'fp-missing' },
    h('h1', { class: 'sec-title' }, e.closed ? '키우기 페이지가 닫혀 있어요' : notFound ? '키우기 페이지를 찾을 수 없어요' : '키우기 페이지를 열지 못했어요'),
    h('p', { class: 'muted' }, e.closed ? 'DJ가 지금은 키우기 페이지를 닫아 두었어요. 다시 열리면 이 주소로 볼 수 있어요.' : notFound ? '주소가 맞는지 확인해 주세요.' : e.message),
    notFound ? null : h('button', { type: 'button', class: 'btn btn-line', onclick: retry }, '다시 해 보기'),
    ilink(app.link({ name: 'intro' }), { class: 'btn btn-line' }, '먼치킨 키우기 메인으로'));
}

// 내 아이디로 찾기(마지막으로 찾은 아이디는 이 기기에 기억해 다음에 바로 보여 준다)
function findCard(page, ctx) {
  const saved = savedKey(page.slug, ctx.seasonId);
  const input = h('input', { id: 'kg_q', type: 'search', maxlength: 24, placeholder: '예: 먼치팬', autocomplete: 'off', enterkeyhint: 'search', lang: 'ko', 'aria-describedby': 'kg_q_help' });
  input.value = store.get(saved, '') || '';
  const status = h('p', { class: 'form-status', role: 'status', 'aria-live': 'polite' });
  const results = h('div', { class: 'kg-results' });
  const submit = h('button', { type: 'submit', class: 'btn btn-accent' }, '찾기');
  const form = h('form', { class: 'kg-find', role: 'search', novalidate: true },
    h('label', { for: 'kg_q', class: 'kg-find-label' }, '내 아이디'),
    h('div', { class: 'kg-find-row' }, input, submit), status);
  let seq = 0;
  async function search(q) {
    const my = ++seq;
    const problem = checkQuery(q);
    if (problem) { status.textContent = problem; results.replaceChildren(); input.focus(); return; }
    const key = idKey(q);
    submit.disabled = true; status.textContent = '찾는 중…'; results.replaceChildren();
    try {
      const r = await kiugiApi.find(page.slug, key);
      if (my !== seq) return;
      store.set(saved, key);
      status.textContent = '';
      if (!r.results?.length) {
        results.replaceChildren(h('p', { class: 'empty' }, `'${key}' 아이디를 찾지 못했어요. 이번 시즌 아이디가 맞는지 확인해 주세요. 방송에서 냥을 모으면 5분쯤 뒤에 여기 보여요.`));
      } else {
        results.replaceChildren(...r.results.map((p, i) => resultItem(p, ctx, i === 0 && r.exact > 0)),
          ...(r.more ? [h('p', { class: 'note' }, '비슷한 아이디가 더 있어요. 아이디를 정확히 적으면 더 잘 찾아요.')] : []));
      }
    } catch (e) { if (my === seq) { status.textContent = ''; results.replaceChildren(errorBox(e.message, () => search(q))); } }
    finally { if (my === seq) submit.disabled = false; }
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); void search(input.value); });
  if (input.value) queueMicrotask(() => void search(input.value));
  return h('section', { class: 'card pad stack kg-find-card', id: 'find' },
    h('h2', { class: 'sec-title' }, '내 아이디로 찾기'),
    h('p', { class: 'muted small', id: 'kg_q_help' }, '방송에서 !아이디 로 만든 아이디를 적어 주세요(시즌마다 새로 만들어요).'),
    form, results);
}

// 찾기 결과 한 줄 → 캐릭터 페이지 링크
function resultItem(p, ctx, found) {
  const line = personLine(p, ctx.catalog, ctx.seasonId);
  return ilink(ctx.app.link({ name: 'character', slug: ctx.slug, base: baseOf(p.id) }), { class: 'kg-result' + (found ? ' found' : '') },
    art(ctx.catalog, ctx.character, p.worn, p.level, { seasonId: ctx.seasonId, base: ctx.app.base, label: `${p.id} 캐릭터` }),
    h('span', { class: 'kg-result-text' },
      found ? h('span', { class: 'eyebrow' }, '찾았어요!') : null,
      h('b', null, line.title),
      h('span', { class: 'muted small' }, line.sub),
      h('span', { class: 'kg-result-go' }, '캐릭터 보기 ›')));
}

function topCard(page, ctx) {
  const top = Array.isArray(page.top) ? page.top.slice(0, 3) : [];
  return h('section', { class: 'card pad stack', 'aria-labelledby': 'kg_top' },
    h('h2', { class: 'sec-title', id: 'kg_top' }, '이번 시즌 1~3등'),
    h('p', { class: 'muted small' }, '애정도(이번 시즌에 받은 냥)가 높은 순서예요. 애정도 숫자는 지금은 보여 주지 않아요.'),
    top.length
      ? h('ol', { class: 'kg-top' }, ...top.map((p, i) => h('li', { class: 'kg-top-item' },
        ilink(ctx.app.link({ name: 'character', slug: ctx.slug, base: baseOf(p.id) }), { class: 'kg-top-link', 'aria-label': `${i + 1}등 ${p.id} 캐릭터 보기` },
          art(ctx.catalog, ctx.character, p.worn, p.level, { seasonId: ctx.seasonId, base: ctx.app.base, label: `${i + 1}등 ${p.id} 캐릭터`, eager: true }),
          h('b', null, `${MEDALS[i] || ''} ${i + 1}등`),
          h('span', { class: 'kg-top-name' }, p.id),
          h('span', { class: 'muted small' }, `Lv.${p.level} ${expressionFor(ctx.catalog, ctx.seasonId, p.level).name}`),
          h('span', { class: 'kg-card-hearts' }, heartText(p.hearts))))))
      : h('p', { class: 'empty' }, '아직 순위가 없어요. 방송에서 냥을 모아 보세요!'));
}

function howCard(name) {
  const cmd = (t) => h('code', { class: 'kg-cmd' }, t);
  return h('section', { class: 'card pad stack' },
    h('h2', { class: 'sec-title sm' }, '어떻게 키워요?'),
    h('ul', { class: 'kg-how' },
      h('li', null, '먼저 방송 채팅에 ', cmd('!아이디 먼치팬'), ' 처럼 쳐서 이번 시즌 아이디를 만들어요(한글 1~6자). 이 페이지에는 ', cmd(`먼치팬#${name}`), ' 처럼 보여요.'),
      h('li', null, '방송에서 채팅·좋아요·하트·스푼·출석으로 냥을 모아요.'),
      h('li', null, '채팅에 ', cmd(`!${name}상점`), ' 을 치면 옷 목록이 나와요. ', cmd(`!${name}구매 옷이름`), ' 으로 사면 바로 입어요.'),
      h('li', null, '애정도가 오르면 레벨이 오르고 표정이 바뀌어요(Lv.10까지).'),
      h('li', null, '방송 중에 내 ', name, ' 보기: ', cmd(`!${name}`), ' · 순위: ', cmd(`!${name}순위`)),
      h('li', null, '마음에 드는 캐릭터에게는 캐릭터 페이지에서 하루 한 번 하트를 보낼 수 있어요.')),
    h('p', { class: 'note' }, '냥은 현금·스푼으로 바꿀 수 없어요. 시즌이 끝나면 아이디도 냥도 새로 시작하고 시즌 보상만 남아요. 이 페이지는 5분쯤마다 새로 올라와요.'));
}
