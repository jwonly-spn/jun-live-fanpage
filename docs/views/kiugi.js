// DJ 키우기 페이지(k/<주소>): DJ 캐릭터 · 내 아이디로 찾기 · 이번 시즌 1~3등. 카드를 누르면 캐릭터 페이지(k/<주소>/<아이디 앞 부분>).
// DJ의 먼치킨(봇 프로그램)이 올린 것(DJ 캐릭터, 청취자가 방송에서 "!아이디"로 직접 만든 시즌 아이디·레벨·입은 옷)과 하트 수만 보여 준다.
// 아이디 모양: "<앞 한글 1~6자>#<캐릭터 이름>"(예: 밤톨#먼치). 애정도 숫자는 보이지 않는다(순서만 애정도 순). 스푼 정보는 쓰지 않는다. 로그인 없음.
import { h, icon, store } from '../lib/dom.js';
import { kiugiApi } from '../api.js';
import { relativeTime, formatDate } from '../lib/text.js';
import { loadCatalog, buildCatalog, expressionFor } from '../lib/kiugi-draw.js';
import { ilink, loading, errorBox, share, nightTop, siteFoot, secHead, statTiles, BRAND } from './common.js';
import { art, heartText, heartCount, baseOf, idText, characterCard } from './cards.js';

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
// 시즌 번호(s1 → 1)와 끝날 때까지 남은 날(한국 날짜 기준, 지났으면 0, 모르면 null)
export function seasonNo(season) {
  const m = /^s(\d+)$/.exec(String(season?.id ?? ''));
  return m ? Number(m[1]) : null;
}
export function daysLeft(season, now = Date.now()) {
  const end = Date.parse(season?.endsAt ?? '');
  if (Number.isNaN(end)) return null;
  const day = (t) => Math.floor((t + 9 * 3600000) / 86400000);
  return Math.max(0, day(end) - day(now));
}
export const dDay = (season, now) => { const d = daysLeft(season, now); return d === null ? null : d === 0 ? 'D-DAY' : `D-${d}`; };
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
// 시즌 띠(첫 화면 맨 위): 점 · "할로윈 시즌 · 11월 30일까지" · D-52
export function seasonBadge(season) {
  const left = season ? dDay(season) : null;
  return h('p', { class: 'kg-season' }, h('span', { class: 'kg-dot', 'aria-hidden': 'true' }), h('span', { class: 'kg-season-text' }, seasonLine(season)), left ? h('span', { class: 'kg-dday' }, left) : null);
}
// 찾기 칸 글 검사: 괜찮으면 null, 아니면 안내 글
export function checkQuery(q) {
  const key = idKey(q);
  if (!key) return '아이디를 적어 주세요.';
  if (!QUERY_RULE.test(key)) return '아이디는 한글 1~6자예요. 예: 먼치팬 또는 먼치팬#먼치';
  return null;
}

export async function renderKiugi(root, route, app) {
  document.title = `DJ 키우기 · ${BRAND}`;
  store.remove('kg_nick'); // 예전 판이 이 기기에 남긴 찾기 글은 지운다
  const top = nightTop(app);
  const night = h('div', { class: 'kg-night' });
  const main = h('main', { id: 'main', class: 'fp-main kg-main', tabindex: '-1' }, loading());
  const shell = h('div', { class: 'fp kg-site' }, ...top, night, main);
  root.replaceChildren(shell);
  let page;
  const catalogJob = loadCatalog(app.base).catch(() => buildCatalog([]));
  try { page = await kiugiApi.page(route.slug); }
  catch (e) { main.replaceChildren(missing(e, () => renderKiugi(root, route, app), app)); shell.append(siteFoot(app)); return; }
  const catalog = await catalogJob;
  const name = page.name || page.character?.name || 'DJ';
  const seasonId = page.season?.id || null;
  document.title = `${name} 키우기 · ${BRAND}`;
  const href = location.origin + app.link({ name: 'kiugi', slug: page.slug });
  const ctx = { app, catalog, character: page.character, seasonId, slug: page.slug, name };
  const shareBtn = h('button', { type: 'button', class: 'fp-nav icon-only', 'aria-label': '공유하기', onclick: () => share(href, `${name} 키우기`) }, icon('share', { size: 19 }));

  // 머리줄에 공유 단추를 더한다(비공식 한 줄은 그대로)
  top[1].replaceWith(nightTop(app, { actions: [shareBtn] })[1]);
  night.replaceChildren(
    h('div', { class: 'kg-wrap' },
      // 휴대폰: 시즌 띠 / 제목·설명 + 오른쪽 DJ 캐릭터 / 숫자 · 넓은 화면: 왼쪽 글, 오른쪽 큰 캐릭터(styles.css 의 grid-template-areas)
      h('section', { class: 'kg-hero dj' },
        h('div', { class: 'kg-hero-badge' }, seasonBadge(page.season)),
        h('div', { class: 'kg-hero-copy' },
          h('h1', { class: 'display' }, `${name} 키우기`),
          h('p', { class: 'intro' }, page.paused ? '다음 시즌을 준비하고 있어요. 새 시즌이 시작되면 다시 만나요!' : `방송에서 모은 냥으로 청취자마다 자기 ${josa(name, '을', '를')} 꾸며요.`)),
        h('div', { class: 'kg-hero-art' }, art(catalog, page.character, {}, 1, { seasonId, base: app.base, label: `${name} 캐릭터`, eager: true, kind: 'hero' })),
        h('div', { class: 'kg-hero-stats' }, ...statTiles([
          { value: fmt(page.count), label: '참여한 청취자' },
          { value: relativeTime(page.updatedAt) || '조금 전', label: '마지막 업데이트' }])))));
  main.replaceChildren();
  if (!page.paused) main.append(findCard(page, ctx), topCard(page, ctx));
  main.append(howCard(name));
  shell.append(siteFoot(app, '이 페이지에는 청취자가 방송에서 직접 만든 아이디와 레벨·입은 옷·하트만 보여요. 내 아이디를 빼고 싶으면 DJ에게 말해 주세요.'));
}

function missing(e, retry, app) {
  const notFound = e.status === 404;
  return h('div', { class: 'kg-panel fp-missing' },
    h('h1', { class: 'sec-title' }, e.closed ? '키우기 페이지가 닫혀 있어요' : notFound ? '키우기 페이지를 찾을 수 없어요' : '키우기 페이지를 열지 못했어요'),
    h('p', { class: 'muted' }, e.closed ? 'DJ가 지금은 키우기 페이지를 닫아 두었어요. 다시 열리면 이 주소로 볼 수 있어요.' : notFound ? '주소가 맞는지 확인해 주세요.' : e.message),
    h('div', { class: 'row wrap gap' },
      notFound ? null : h('button', { type: 'button', class: 'btn btn-line', onclick: retry }, '다시 해 보기'),
      ilink(app.link({ name: 'intro' }), { class: 'btn btn-accent' }, `${BRAND} 메인으로`)));
}

// 내 아이디로 찾기(마지막으로 찾은 아이디는 이 기기에 기억해 다음에 바로 보여 준다)
function findCard(page, ctx) {
  const saved = savedKey(page.slug, ctx.seasonId);
  const input = h('input', { id: 'kg_q', type: 'search', maxlength: 24, placeholder: '내 아이디 (예: 먼치팬)', autocomplete: 'off', enterkeyhint: 'search', lang: 'ko', 'aria-describedby': 'kg_q_help' });
  input.value = store.get(saved, '') || '';
  const status = h('p', { class: 'form-status', role: 'status', 'aria-live': 'polite' });
  const results = h('div', { class: 'kg-results' });
  const submit = h('button', { type: 'submit', class: 'btn btn-accent' }, '찾기');
  const form = h('form', { class: 'kg-find', role: 'search', novalidate: true },
    h('label', { for: 'kg_q', class: 'sr-only' }, '내 아이디'),
    h('div', { class: 'kg-find-row' }, h('span', { class: 'kg-find-icon', 'aria-hidden': 'true' }, icon('search', { size: 20 })), input, submit), status);
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
  return h('section', { class: 'kg-panel kg-search', id: 'find' },
    secHead('내 아이디로 찾기'),
    h('p', { class: 'kg-help', id: 'kg_q_help' }, '방송에서 ', h('code', { class: 'kg-cmd' }, '!아이디'), ' 로 만든 아이디를 적어 주세요(시즌마다 새로 만들어요).'),
    form, results);
}

// 찾기 결과 한 줄 → 캐릭터 페이지 링크
function resultItem(p, ctx, found) {
  const line = personLine(p, ctx.catalog, ctx.seasonId);
  return ilink(ctx.app.link({ name: 'character', slug: ctx.slug, base: baseOf(p.id) }), { class: 'kg-result' + (found ? ' found' : ''), 'aria-label': `${found ? '찾았어요. ' : ''}${line.title}, ${line.sub}` },
    art(ctx.catalog, ctx.character, p.worn, p.level, { seasonId: ctx.seasonId, base: ctx.app.base, label: `${p.id} 캐릭터` }),
    h('span', { class: 'kg-result-text', 'aria-hidden': 'true' },
      found ? h('span', { class: 'eyebrow' }, '찾았어요') : null,
      h('b', null, h('span', { class: 'kg-result-rank' }, `${p.rank}등`), ...idText(p.id)),
      h('span', { class: 'kg-result-sub' }, `Lv.${p.level} ${expressionFor(ctx.catalog, ctx.seasonId, p.level).name}`, heartCount(p.hearts))),
    h('span', { class: 'kg-result-go', 'aria-hidden': 'true' }, icon('arrow', { size: 18 })));
}

// 이번 시즌 1~3등: 1등은 크게(휴대폰에서는 가로로 넓게), 2·3등은 나란히. 읽는 차례는 1·2·3등.
function topCard(page, ctx) {
  const top = Array.isArray(page.top) ? page.top.slice(0, 3) : [];
  return h('section', { class: 'kg-sec', 'aria-labelledby': 'kg_top' },
    secHead('이번 시즌 1~3등', '애정도(이번 시즌에 받은 냥)가 높은 순서예요. 애정도 숫자는 지금은 보여 주지 않아요.', null, { id: 'kg_top' }),
    top.length
      ? h('ol', { class: 'kg-podium' }, ...top.map((p, i) => h('li', { class: `kg-podium-one p${i + 1}` },
        characterCard({ ...p, slug: ctx.slug }, { app: ctx.app, catalog: ctx.catalog, character: ctx.character, seasonId: ctx.seasonId, showDj: false, eager: true, rank: i + 1, label: i === 0 ? '이번 시즌 1등' : `${i + 1}등` }))))
      : h('p', { class: 'empty' }, '아직 순위가 없어요. 방송에서 냥을 모아 보세요!'));
}

function howCard(name) {
  const cmd = (t) => h('code', { class: 'kg-cmd' }, t);
  const step = (n, title, ...body) => h('li', { class: 'kg-step' }, h('span', { class: 'kg-step-n', 'aria-hidden': 'true' }, n), h('b', null, title), h('p', null, ...body));
  return h('section', { class: 'kg-sec kg-how' },
    secHead('어떻게 키워요?', `방송 채팅에 이렇게 쳐 보세요. ${name} 대신 다른 말을 치면 답하지 않아요.`),
    h('ol', { class: 'kg-steps four' },
      step('1', '아이디 만들기', cmd('!아이디 먼치팬'), ' 처럼 쳐서 이번 시즌 아이디를 만들어요(한글 1~6자). 이 페이지에는 ', cmd(`먼치팬#${name}`), ' 처럼 보여요.'),
      step('2', '냥 모으기', '방송에서 채팅·좋아요·하트·스푼·출석으로 냥을 모아요. 애정도가 오르면 레벨이 오르고 표정이 바뀌어요(Lv.10까지).'),
      step('3', '옷 입히기', cmd(`!${name} 상점 상의`), ' 처럼 치면 옷이 번호와 함께 나와요(한벌·하의·신발·악세·배경도). ', cmd(`!${name} 상의1`), ' · ', cmd(`!${name} 하의2`), ' · ', cmd(`!${name} 악세3`), ' (또는 옷 이름)으로 사면 바로 입고, 가진 옷이면 입기만 해요. 한벌옷을 입으면 상의·하의 대신 보여요.'),
      step('4', '보고 응원하기', '방송 중에 내 ', name, ' 보기: ', cmd(`!${name}`), ' · 순위: ', cmd(`!${name} 순위`), '. 마음에 드는 캐릭터에게는 캐릭터 페이지에서 하루 한 번 하트를 보낼 수 있어요.')),
    h('p', { class: 'note' }, '냥은 현금·스푼으로 바꿀 수 없어요. 시즌이 끝나면 아이디도 냥도 새로 시작하고 시즌 보상만 남아요. 이 페이지는 5분쯤마다 새로 올라와요.'));
}
