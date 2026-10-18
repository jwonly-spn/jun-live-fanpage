// DJ 키우기 페이지(k/<주소>) — 2026-10-18 사이트 새 구조(SNS 프로필처럼): DJ 동그라미 사진 · 이름 · 숫자 · 공유 / 내 아이디로 찾기(찾으면 "이게 나예요") /
//  이번 시즌 1~3등(큰 사진 카드 — 휴대폰 한 장 · 태블릿 두 장 · PC 세 장) / 이 방송의 다른 캐릭터(메인 인기·새로 꾸민 목록에서 이 방송 것) / 어떻게 키워요.
//  카드를 누르면 캐릭터 페이지(k/<주소>/<아이디 앞 부분> — 전신). 지난번 답(lib/swr.js — 이 브라우저)이 있으면 바로 그리고 새 답을 받는다.
// DJ의 먼치킨(봇 프로그램)이 올린 것(DJ 캐릭터, 청취자가 방송에서 "!아이디"로 직접 만든 시즌 아이디·레벨·입은 옷)과 하트 수만 보여 준다.
// 아이디 모양: "<앞 한글 1~6자>#<캐릭터 이름>"(예: 밤톨#먼치). 애정도 숫자는 보이지 않는다(순서만 애정도 순). 스푼 정보는 쓰지 않는다. 로그인 없음.
import { h, icon, store } from '../lib/dom.js';
import { kiugiApi, fastApi } from '../api.js';
import { relativeTime, formatDate } from '../lib/text.js';
import { loadCatalog, buildCatalog, expressionFor } from '../lib/kiugi-draw.js';
import { photoBox } from '../lib/raster.js';
import { sameData } from '../lib/swr.js';
import { ilink, loading, errorBox, share, nightTop, siteFoot, secHead, statTiles, BRAND, applySeasonTheme } from './common.js';
import { heartText } from './cards.js';
import { postCard, markDjSeen } from './feed.js';

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
// 이 방송의 다른 캐릭터: 메인 인기·새로 꾸민 목록에서 이 방송 것(1~3등은 빼고, 같은 사람은 한 번)
export function moreOf(home, slug, top = []) {
  const skip = new Set(top.map((p) => String(p.id).normalize('NFC')));
  const out = [];
  for (const c of [...(home?.popular || []), ...(home?.recent || [])]) {
    const id = String(c.id).normalize('NFC');
    if (c.slug !== slug || skip.has(id)) continue;
    skip.add(id); out.push(c);
  }
  return out;
}

export async function renderKiugi(root, route, app) {
  document.title = `DJ 키우기 · ${BRAND}`;
  store.remove('kg_nick'); // 예전 판이 이 기기에 남긴 찾기 글은 지운다
  const top = nightTop(app);
  const night = h('div', { class: 'kg-night compact' });
  const main = h('main', { id: 'main', class: 'fp-main kg-main dj-main', tabindex: '-1' }, loading());
  const shell = h('div', { class: 'fp kg-site' }, ...top, night, main);
  root.replaceChildren(shell);
  const catalogJob = loadCatalog(app.base).catch(() => buildCatalog([]));
  const job = fastApi.page(route.slug);
  let page = job.cached;
  if (!page) {
    try { page = await job.fresh; }
    catch (e) { main.replaceChildren(missing(e, () => renderKiugi(root, route, app), app)); shell.append(siteFoot(app)); return; }
  }
  const catalog = await catalogJob;
  markDjSeen(route.slug);
  const draw = (pg) => paintPage(pg, { app, catalog, top, night, main });
  draw(page);
  shell.append(siteFoot(app, '이 페이지에는 청취자가 방송에서 직접 만든 아이디와 레벨·입은 옷·하트만 보여요. 내 아이디를 빼고 싶으면 DJ에게 말해 주세요.'));
  // 새 답이 다르면 다시 그린다 — 찾기 칸에 글을 쓰는 중이면(쓰던 글이 지워지지 않게) 그대로 둔다
  if (job.cached) job.fresh.then((fresh) => {
    const typing = document.getElementById('kg_q');
    if (sameData(fresh, job.cached) || !main.isConnected || (typing && (typing === document.activeElement || typing.value))) return;
    draw(fresh);
  }, () => {});
}

function paintPage(page, { app, catalog, top, night, main }) {
  applySeasonTheme(page.season);
  const name = page.name || page.character?.name || 'DJ';
  const seasonId = page.season?.id || null;
  document.title = `${name} 키우기 · ${BRAND}`;
  const href = location.origin + app.link({ name: 'kiugi', slug: page.slug });
  const ctx = { app, catalog, character: page.character, seasonId, season: page.season, slug: page.slug, name, lookOf: () => page.character, djNameOf: () => name };
  const shareBtn = h('button', { type: 'button', class: 'fp-nav icon-only', 'aria-label': '공유하기', onclick: () => share(href, `${name} 키우기`) }, icon('share', { size: 19 }));
  // 머리줄에 공유 단추를 더한다(비공식 한 줄은 그대로)
  const header = document.querySelector('.fp-top');
  header?.replaceWith(nightTop(app, { actions: [shareBtn] }).at(-1));
  // 프로필: 휴대폰은 동그라미 사진 옆에 이름·숫자, 넓은 화면은 크게
  night.replaceChildren(
    h('div', { class: 'kg-wrap' },
      h('section', { class: 'kg-profile' },
        h('div', { class: 'kg-profile-pic' }, photoBox({ catalog, character: page.character, worn: {}, level: 1, seasonId, base: app.base, kind: 'bust', cssWidth: 176 }, { eager: true, label: `${name} 캐릭터` })),
        h('div', { class: 'kg-profile-head' },
          seasonBadge(page.season),
          h('h1', { class: 'display' }, `${name} 키우기`)),
        h('p', { class: 'intro' }, page.paused ? '다음 시즌을 준비하고 있어요. 새 시즌이 시작되면 다시 만나요!' : `방송에서 모은 냥으로 청취자마다 자기 ${josa(name, '을', '를')} 꾸며요.`),
        h('div', { class: 'kg-hero-stats' }, ...statTiles([
          { value: fmt(page.count), label: '참여한 청취자' },
          { value: relativeTime(page.updatedAt) || '조금 전', label: '마지막 업데이트' }])))));
  main.replaceChildren();
  if (!page.paused) main.append(findCard(page, ctx), topCard(page, ctx), moreCard(page, ctx));
  main.append(howCard(name));
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

// 내 아이디로 찾기(마지막으로 찾은 아이디는 이 기기에 기억해 다음에 바로 보여 준다). 찾은 카드에는 "이게 나예요".
function findCard(page, ctx) {
  const saved = savedKey(page.slug, ctx.seasonId);
  const input = h('input', { id: 'kg_q', type: 'search', maxlength: 24, placeholder: '내 아이디 (예: 먼치팬)', autocomplete: 'off', enterkeyhint: 'search', lang: 'ko', 'aria-describedby': 'kg_q_help' });
  input.value = store.get(saved, '') || '';
  const status = h('p', { class: 'form-status', role: 'status', 'aria-live': 'polite' });
  const results = h('div', { class: 'kg-find-results' });
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
        results.replaceChildren(h('div', { class: 'kg-feed-grid' }, ...r.results.map((p, i) => postCard({ ...p, slug: page.slug, djName: ctx.name }, ctx, { rank: p.rank, tag: i === 0 && r.exact > 0 ? '찾았어요' : null, showDj: false, pin: true, eager: i < 2 }))),
          ...(r.more ? [h('p', { class: 'note' }, '비슷한 아이디가 더 있어요. 아이디를 정확히 적으면 더 잘 찾아요.')] : []));
      }
    } catch (e) { if (my === seq) { status.textContent = ''; results.replaceChildren(errorBox(e.message, () => search(q))); } }
    finally { if (my === seq) submit.disabled = false; }
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); void search(input.value); });
  if (input.value) queueMicrotask(() => void search(input.value));
  return h('section', { class: 'kg-sec kg-search', id: 'find' },
    secHead('내 아이디로 찾기', '찾은 캐릭터에서 "이게 나예요"를 누르면 첫 화면에서 매일 달라진 점을 알려 드려요.'),
    h('div', { class: 'kg-panel kg-find-panel' },
      h('p', { class: 'kg-help', id: 'kg_q_help' }, '방송에서 ', h('code', { class: 'kg-cmd' }, '!아이디'), ' 로 만든 아이디를 적어 주세요(시즌마다 새로 만들어요).'),
      form),
    results);
}

// 이번 시즌 1~3등: 큰 사진 카드(1·2·3등 메달). 읽는 차례는 1·2·3등.
function topCard(page, ctx) {
  const top = Array.isArray(page.top) ? page.top.slice(0, 3) : [];
  return h('section', { class: 'kg-sec', 'aria-labelledby': 'kg_top' },
    secHead('이번 시즌 1~3등', '애정도(이번 시즌에 받은 냥)가 높은 순서예요. 애정도 숫자는 지금은 보여 주지 않아요.', null, { id: 'kg_top' }),
    top.length
      ? h('ol', { class: 'kg-feed-grid kg-top3' }, ...top.map((p, i) => h('li', null, postCard({ ...p, slug: ctx.slug, djName: ctx.name }, ctx, { rank: i + 1, showDj: false, eager: i < 1 }))))
      : h('p', { class: 'empty' }, '아직 순위가 없어요. 방송에서 냥을 모아 보세요!'));
}

// 이 방송의 다른 캐릭터(메인에 보이는 방송이면 메인 인기·새로 꾸민 목록에서) — 없으면 칸을 그리지 않는다
function moreCard(page, ctx) {
  const host = h('div', { class: 'kg-more-host' });
  const fill = (home) => {
    const list = moreOf(home, page.slug, page.top || []);
    host.replaceChildren(...(list.length ? [h('section', { class: 'kg-sec' },
      secHead(`${ctx.name} 키우기의 다른 캐릭터`, '하트를 받았거나 방금 새로 꾸민 캐릭터예요.'),
      h('div', { class: 'kg-feed-grid' }, ...list.map((c) => postCard(c, ctx, { showDj: false }))))] : []));
  };
  const job = fastApi.home();
  if (job.cached) fill(job.cached);
  job.fresh.then((home) => { if (!job.cached || !sameData(home, job.cached)) fill(home); }, () => {});
  return host;
}

function howCard(name) {
  const cmd = (t) => h('code', { class: 'kg-cmd' }, t);
  const step = (n, title, ...body) => h('li', { class: 'kg-step' }, h('span', { class: 'kg-step-n', 'aria-hidden': 'true' }, n), h('b', null, title), h('p', null, ...body));
  return h('section', { class: 'kg-sec kg-how' },
    secHead('어떻게 키워요?', `방송 채팅에 이렇게 쳐 보세요. ${name} 대신 다른 말을 치면 답하지 않아요.`),
    h('ol', { class: 'kg-steps four' },
      step('1', '아이디 만들기', cmd('!아이디 먼치팬'), ' 처럼 쳐서 이번 시즌 아이디를 만들어요(한글 1~6자, 한 사람 한 아이디). 이 페이지에는 ', cmd(`먼치팬#${name}`), ' 처럼 보여요. 바꾸려면 ', cmd('!아이디변경 새아이디'), ' 를 쳐요.'),
      step('2', '냥 모으기', '방송에서 채팅·좋아요·하트·스푼·출석으로 냥을 모아요. ', cmd('!산책'), '으로 산책을 다녀와도 냥이 모이고(쉬는 시간은 DJ가 정해요), 갈림길이 나오면 ', cmd('!산책 1'), '·', cmd('!산책 2'), '로 길을 골라요. 애정도가 오르면 레벨이 오르고 표정이 바뀌어요(Lv.10까지).'),
      step('3', '옷 입히기', '옷 도감이나 내 캐릭터 페이지의 "입혀 보기"에서 직접 입어 보고, 마음에 드는 옷의 명령어(', cmd('!옷장 상의11 하의3 모자5'), ' 처럼)를 복사해 방송 채팅에 붙여 넣으면 바로 사서 입어요. 가진 옷이면 입기만 해요. 한벌옷을 입으면 상의·하의 대신 보여요. 모자는 하나, 악세사리는 머리·얼굴·목·손 자리마다 하나씩 써요. 방송 채팅에는 옷 목록이 나오지 않아요.'),
      step('4', '보고 응원하기', '방송 중에 내 ', name, ' 보기: ', cmd(`!${name}`), ' · 순위: ', cmd(`!${name} 순위`), '. 마음에 드는 캐릭터에게는 캐릭터 페이지에서 하루 한 번 하트를 보낼 수 있어요.')),
    h('p', { class: 'note' }, '냥은 현금·스푼으로 바꿀 수 없어요. 시즌이 끝나면 아이디·냥·옷이 새로 시작해요. 시즌 칭호는 얻은 시즌과 다음 시즌까지 효과가 있어요. 이 페이지는 5분쯤마다 새로 올라와요.'));
}
