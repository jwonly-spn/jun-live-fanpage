// 캐릭터 페이지(k/<주소>/<아이디 앞 부분>): 무대 위 큰 캐릭터(바로 아래 저장하기) · 아이디 · 레벨과 표정 · 정보 칸 · 하트(하루 한 번) · 입은 옷(칸마다, 빈 칸도) · DJ 페이지 링크 · 링크 복사.
// 애정도 숫자는 보이지 않는다. 하트 열쇠는 이 브라우저 저장소에만 둔다(lib/hearts.js). 로그인 없음.
// 저장하기(2026-10-09 사용자: "저장하기 버튼을 따로"): 캐릭터 그림 바로 아래 따로 있는 단추 하나 — 캐릭터 + 배경 + "아이디#이름" 이 든 1080×1350 PNG(lib/kiugi-save.js).
//  하트·링크 복사 단추 줄과 섞지 않는다(휴대폰에서는 넓게, PC 에서는 보통 너비).
// 입혀 보기(2026-10-09 사용자: "옷을 눌러 미리 입혀 보고, 마음에 들면 !옷장 상의11 하의3 같은 채팅을 한 번에 복사"): "입은 옷" 제목 옆 단추로 여는 칸.
//  묶음 탭(시즌 목록 categories) · 옷 칸(그림·번호·이름·값, 입은 옷은 "입는 중" — 옷에는 레벨 조건이 없다, 2026-10-10) · 누르면 미리 보기에 입혀 보고 다시 누르면 벗긴다 · 원래대로.
//  규칙(lib/try-on.js — 먼치킨 !옷장 과 같게): 칸마다 한 벌, 한벌옷 ↔ 상의·하의, 왕관이 머리 장식을 가림, 옷과 칭호를 합쳐 한 번에 8개까지.
//  칭호 탭(2026-10-14 사용자: "입혀 보기에서 칭호도 고르게"): 옷 묶음 뒤에 "칭호" — 배지 그림·번호(칭호2)·이름·값·Lv.10(상점이 열리기 전이면 "10월 30일부터").
//   하나만 고른다(다른 칭호를 누르면 바뀌고, 다시 누르면 뺀다). 지금 단 칭호는 "다는 중"(입은 옷처럼 — 살 것이 없다). 고른 칭호(없으면 단 칭호)는 미리 보기 위에 배지로,
//   채팅 한 줄 맨 끝에 번호("!옷장 상의11 하의3 칭호2", 칭호만이면 "!옷장 칭호 2"), 값은 합계에.
//  휴대폰: 미리 보기·채팅 한 줄·탭이 위에 붙어 있고 옷 칸이 아래로. 넓은 화면: 왼쪽에 붙은 미리 보기, 오른쪽에 옷 칸.
import { h, icon, toast, copyText } from '../lib/dom.js';
import { kiugiApi } from '../api.js';
import { loadCatalog, buildCatalog, wornList, expressionFor, itemCodeOf, titleList, titleImageUrl, titleOpenDate, characterMarkup, paintMarkup } from '../lib/kiugi-draw.js';
import { copyCode, chatHint, titleEffects, itemGroups } from './items.js';
import { applyTryOn, toggleTry, canTry, itemShown, wornIds, tryCodes, tryLine, tryTotal, tryNotes, tryNote, copiedText,
  toggleTitle, canTitle, pickedTitle, shownTitle, titleOf, wornTitleOf, TRY_MAX, TRY_FULL, TITLE_WORN } from '../lib/try-on.js';
import { heartToken, heartKey, sentToday, markSent } from '../lib/hearts.js';
import { saveCharacterImage, SAVE_LABEL, SAVE_BUSY, SAVE_FAILED } from '../lib/kiugi-save.js';
import { ilink, loading, nightTop, siteFoot, secHead, BRAND } from './common.js';
import { art, itemArt, copyLink, idText } from './cards.js';

// 이 브라우저 저장소(막혀 있으면 null — lib/hearts.js 가 이번 창에서만 기억)
function browserStorage() { try { return window.localStorage; } catch { return null; } }
export const HEART_SENT = '오늘 하트 보냈어요';
export const HEART_SEND = '하트 보내기';

// 입은 옷 칸 목록: 이번 시즌 칸 차례대로(입지 않은 칸은 빈 칸), 시즌 칸에 없는 것(예전 목록의 시즌 보상 왕관·날개·오라)은 뒤에.
//  그림 V4: 한벌옷을 입으면 상의·하의 칸은 "한벌옷이 덮고 있어요", 왕관을 쓰면 머리 장식 칸은 "왕관이 가려요"(covered).
//  2026-10-09: 왕관·날개·오라는 악세사리(악세11~13) — 시즌 칸(crown·wings·aura)에 들어 있다. 입은 옷마다 채팅 번호(상의11)를 보이고, 누르면 "!옷장 상의 11" 이 복사된다(0.15.66 — !옷장 으로 통일).
//  칭호(지금 효과가 있는 것)는 아이디 아래에.
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

// "저장하기" 단추: 누르면 그림을 만드는 동안 "만드는 중…"(두 번 눌러도 한 번만), 끝나면 바로 내려받기(아이폰은 공유 창 — lib/kiugi-save.js). 실패하면 알림.
//  card() → 그때의 캐릭터 정보(하트 수는 누른 때 것).
export function saveButton(card, { base = '/' } = {}) {
  const label = h('span', { class: 'kg-save-label' }, SAVE_LABEL);
  const btn = h('button', { type: 'button', class: 'btn btn-line kg-save-btn' }, icon('download', { size: 19 }), label);
  let busy = false;
  btn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.classList.add('is-busy'); label.textContent = SAVE_BUSY;
    try { await saveCharacterImage(card(), { base, returnTo: btn }); }
    catch (e) { console.error(e); toast(SAVE_FAILED, 'error'); }
    finally { busy = false; btn.disabled = false; btn.removeAttribute('aria-busy'); btn.classList.remove('is-busy'); label.textContent = SAVE_LABEL; }
  });
  return btn;
}

// 입혀 보기 칸 → {openBtn("입은 옷" 제목 옆 단추), section(처음엔 숨김), open()} · DJ 캐릭터나 이번 시즌 옷 목록이 없으면 null
//  worn: 서버가 보낸 입은 옷 · titles: 서버가 보낸 단 칭호(첫 번째가 지금 단 칭호) · level: 레벨 표정(칭호 레벨 알림에도) · seasonId: 이 캐릭터의 시즌(옷 목록은 그 시즌, 모르면 마지막 시즌)
export const TRY_TITLE = '입혀 보기';
export const TRY_EMPTY = '옷을 누르면 여기에 채팅 한 줄이 생겨요';
// 칭호 탭(옷 묶음 id 와 겹치지 않는 이름)
export const TITLE_TAB = 'title';
export function tryOnPanel({ catalog, seasonId, dj, worn, titles: wearing = [], level, app }) {
  const sid = catalog?.seasons?.[seasonId] ? seasonId : catalog?.last;
  const { groups, titles = [], rule = null } = itemGroups(catalog, sid);
  if (!dj?.character || !groups.length) return null;
  const gender = dj.character.gender === 'm' ? 'm' : 'f', have = wornIds(worn), fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
  const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 지금 단 칭호(시즌 목록에 있는 것만) · 칭호 상점이 열리기 전이면 여는 날("10월 30일")
  const wornTitle = wornTitleOf(catalog, wearing), openDate = titleOpenDate(rule);
  // 탭 = 옷 묶음들 + (칭호가 있는 시즌이면) 칭호
  const tabList = [...groups, ...(titles.length ? [{ slot: TITLE_TAB, name: '칭호', items: titles, title: true }] : [])];
  let tried = [], title = null, tab = groups[0].slot, built = false, line = '';
  const openLabel = h('span', null, TRY_TITLE);
  const openBtn = h('button', { type: 'button', class: 'btn btn-accent kg-try-open', 'aria-expanded': 'false', 'aria-controls': 'try' }, icon('hanger', { size: 19 }), openLabel);
  const section = h('section', { class: 'kg-sec kg-try', id: 'try', hidden: true, tabindex: '-1', 'aria-labelledby': 'try-title' });
  // 미리 보기(위에 칭호 배지) · 채팅 한 줄 · 단추 · 합계
  const stage = h('div', { class: 'kg-stage char kg-try-stage' });
  const badgeImg = h('img', { class: 'kg-try-title-img', alt: '', decoding: 'async' });
  const badgeWord = h('b', { class: 'kg-title-word' });
  const titleTag = h('div', { class: 'kg-try-title', hidden: true });
  const lookEl = h('div', { class: 'kg-try-look' }, titleTag, stage);
  const lineEl = h('p', { class: 'kg-try-line is-empty', id: 'try-line' }, TRY_EMPTY);
  const copyBtn = h('button', { type: 'button', class: 'btn btn-accent kg-try-copy', disabled: true, 'aria-describedby': 'try-line', onclick: () => copyLine() }, icon('copy', { size: 18 }), h('span', null, '복사'));
  const resetBtn = h('button', { type: 'button', class: 'btn btn-line kg-try-reset', disabled: true, onclick: () => { tried = []; title = null; sync(); } }, icon('undo', { size: 18 }), h('span', null, '원래대로'));
  const sum = h('p', { class: 'kg-try-sum', role: 'status', 'aria-live': 'polite' });
  const hint = h('p', { class: 'kg-try-hint' });
  const tabs = h('div', { class: 'kg-try-tabs', role: 'group', 'aria-label': titles.length ? '옷·칭호 묶음 고르기' : '옷 묶음 고르기' });
  const gridHost = h('div', { class: 'kg-try-grid-host' });
  const top = h('div', { class: 'kg-try-top' },
    lookEl,
    h('div', { class: 'kg-try-cmd' }, h('span', { class: 'kg-try-label' }, '채팅에 붙여 넣기'), lineEl, h('div', { class: 'kg-try-actions' }, copyBtn, resetBtn), sum, hint),
    tabs);
  const lists = new Map(), tiles = new Map(), titleTiles = new Map(), tabBtns = new Map();

  // 옷 칸 하나: 칸 전체가 단추(이름 단추의 ::after 가 칸을 덮는다 — styles.css), 그림은 화면 읽기에서 뺀다(이름·번호·값은 단추 이름에)
  const tile = (it, tall) => {
    const mine = have.has(it.id);
    const badge = h('span', { class: 'kg-try-badge', 'aria-hidden': 'true' });
    const btn = h('button', { type: 'button', class: 'kg-try-pick', 'aria-pressed': 'false', onclick: () => pick(it.id),
      'aria-label': `${it.code} ${it.name} · ${fmt(it.price)}냥${mine ? ' · 지금 입는 중' : ''}` }, it.name);
    const li = h('li', { class: 'kg-try-tile' + (mine ? ' is-worn' : '') },
      h('div', { class: 'kg-try-media', 'aria-hidden': 'true' }, itemArt(catalog, it.id, { base: app.base, label: it.name, gender, dj: dj.character, tall }), badge),
      h('span', { class: 'kg-try-code', 'aria-hidden': 'true' }, it.code, it.place ? h('span', { class: 'kg-try-place' }, ` · ${it.place}`) : null),
      btn,
      h('span', { class: 'kg-try-price', 'aria-hidden': 'true' }, h('b', null, `${fmt(it.price)}냥`)));
    tiles.set(it.id, { li, btn, badge });
    return li;
  };
  // 칭호 칸 하나: 배지 그림(가로로 긴 그림 — 칸도 가로로) · 번호 · 이름 · 값 · Lv.10 · (상점이 열리기 전이면) 여는 날. 지금 단 칭호는 "다는 중".
  const titleTile = (t) => {
    const mine = t.id === wornTitle;
    const badge = h('span', { class: 'kg-try-badge', 'aria-hidden': 'true' });
    const btn = h('button', { type: 'button', class: 'kg-try-pick', 'aria-pressed': 'false', onclick: () => pickTitle(t.id),
      'aria-label': [`${t.code} ${t.name}`, `${fmt(t.price)}냥`, `Lv.${t.level}부터`, openDate ? `${openDate}부터 팔아요` : null, mine ? '지금 다는 중' : null].filter(Boolean).join(' · ') }, t.name);
    const li = h('li', { class: 'kg-try-tile is-title' + (mine ? ' is-worn' : '') },
      h('div', { class: 'kg-try-media kg-try-title-media', 'aria-hidden': 'true' },
        t.image ? h('img', { class: 'kg-title-img', src: titleImageUrl(t, app.base), alt: '', loading: 'lazy', decoding: 'async' }) : h('b', { class: 'kg-title-word' }, t.name),
        badge),
      h('span', { class: 'kg-try-code', 'aria-hidden': 'true' }, t.code),
      btn,
      h('span', { class: 'kg-try-price', 'aria-hidden': 'true' }, h('b', null, `${fmt(t.price)}냥`),
        h('span', { class: 'kg-chip' }, `Lv.${t.level}`), openDate ? h('span', { class: 'kg-chip soon' }, `${openDate}부터`) : null));
    titleTiles.set(t.id, { li, btn, badge });
    return li;
  };
  // 칭호 탭: 칭호 효과가 모두 같으면 위에 한 줄로("칭호 효과(시즌2까지) …") + 칭호 칸
  const titleGrid = (g) => {
    const perks = g.items[0]?.perks || [], same = perks.length && g.items.every((t) => (t.perks || []).join('\n') === perks.join('\n'));
    return h('div', { class: 'kg-try-titles' },
      same ? h('p', { class: 'kg-try-tab-note' }, h('b', null, `칭호 효과(${g.items[0].until})`), ` ${perks.join(' · ')}`) : null,
      h('ul', { class: 'kg-try-grid is-titles', 'aria-label': '시즌 칭호' }, ...g.items.map(titleTile)));
  };
  const listOf = (g) => {
    if (!lists.has(g.slot)) lists.set(g.slot, g.title ? titleGrid(g) : h('ul', { class: 'kg-try-grid', 'aria-label': `${g.name} 옷` }, ...g.items.map((it) => tile(it, g.slot === 'outfit'))));
    return lists.get(g.slot);
  };
  const showTab = (slot, { scroll = false } = {}) => {
    tab = slot;
    for (const [v, b] of tabBtns) b.setAttribute('aria-pressed', String(v === slot));
    gridHost.replaceChildren(listOf(tabList.find((g) => g.slot === slot) || tabList[0]));
    sync({ paint: false });
    // 휴대폰(탭 줄이 옆으로 넘어갈 때): 고른 탭을 줄 가운데로
    const b = tabBtns.get(slot);
    if (b && tabs.scrollWidth > tabs.clientWidth) {
      const tr = tabs.getBoundingClientRect(), br = b.getBoundingClientRect();
      tabs.scrollBy({ left: br.left - tr.left - (tr.width - br.width) / 2, behavior: reduced() ? 'auto' : 'smooth' });
    }
    // 아래로 내려 본 뒤 탭을 바꾸면 옷 칸 처음으로 — 휴대폰은 위에 붙은 칸 바로 아래, 넓은 화면(왼쪽 칸 옆)은 머리줄 아래
    if (scroll) {
      const tr = top.getBoundingClientRect(), gr = gridHost.getBoundingClientRect();
      const stacked = gr.left < tr.right - 1;
      const gap = gr.top - (stacked ? tr.bottom + 12 : (parseFloat(getComputedStyle(top).top) || 0));
      if (gap < 0) window.scrollBy({ top: gap, behavior: reduced() ? 'auto' : 'smooth' });
    }
  };

  // 미리 보기 다시 그리기(그림 파일을 다 받은 뒤 한 번에 — 빨리 여러 번 눌러도 마지막 것만)
  const paint = (look, codes) => {
    stage.setAttribute('aria-busy', 'true');
    let markup = null;
    try { markup = characterMarkup(catalog, dj.character, look, level, { seasonId, base: app.base, label: codes.length ? `입혀 본 모습: ${codes.join(', ')}` : '지금 입은 모습', stage: null }); } catch (e) { console.error(e); }
    if (!markup) { stage.replaceChildren(h('span', { class: 'kg-noart' }, '그림을 그리지 못했어요')); stage.removeAttribute('aria-busy'); return; }
    paintMarkup(stage, markup, { fallback: h('span', { class: 'kg-noart' }, '그림을 그리지 못했어요') })
      .then((done) => { if (done) stage.removeAttribute('aria-busy'); })
      .catch((e) => { console.error(e); stage.removeAttribute('aria-busy'); });
  };
  // 미리 보기 위 칭호 배지: 고른 칭호, 없으면 지금 단 칭호(둘 다 없으면 숨김). 그림이 바뀔 때만 주소를 바꾼다(깜박이지 않게).
  let badgeShown = null;
  const showBadge = () => {
    const id = shownTitle(catalog, title, wornTitle), t = titleOf(catalog, id);
    lookEl.classList.toggle('has-title', Boolean(t));
    titleTag.hidden = !t;
    if (!t || id === badgeShown) return;
    badgeShown = id;
    const what = id === wornTitle ? '단 칭호' : '달아 본 칭호';
    if (t.image) { badgeImg.src = titleImageUrl(t, app.base); badgeImg.alt = `${what} ${t.name}`; titleTag.replaceChildren(badgeImg); }
    else { badgeWord.textContent = t.name; badgeWord.setAttribute('aria-label', `${what} ${t.name}`); titleTag.replaceChildren(badgeWord); }
  };
  // 입혀 본 옷·고른 칭호가 바뀌면: 옷·칭호 칸 표시 · 탭의 고른 수 · 채팅 한 줄 · 합계 · 알림 · 칭호 배지 · 미리 보기
  function sync({ paint: draw = true } = {}) {
    const look = applyTryOn(worn, tried, catalog), codes = tryCodes(tried, catalog, sid), picked = pickedTitle(catalog, title, wornTitle);
    for (const [id, t] of tiles) {
      const isTried = tried.includes(id), on = isTried || (have.has(id) && itemShown(look, id, catalog));
      t.btn.setAttribute('aria-pressed', String(on));
      t.li.classList.toggle('is-on', on); t.li.classList.toggle('is-tried', isTried && !have.has(id)); t.li.classList.toggle('is-off', have.has(id) && !on);
      t.badge.textContent = have.has(id) ? '입는 중' : isTried ? '입혀 봄' : '';
    }
    for (const [id, t] of titleTiles) {
      const isPicked = id === picked, on = isPicked || (!picked && id === wornTitle);
      t.btn.setAttribute('aria-pressed', String(on));
      t.li.classList.toggle('is-on', on); t.li.classList.toggle('is-tried', isPicked); t.li.classList.toggle('is-off', id === wornTitle && !on);
      t.badge.textContent = id === wornTitle ? '다는 중' : isPicked ? '달아 봄' : '';
    }
    for (const g of tabList) {
      const b = tabBtns.get(g.slot), n = g.title ? (picked ? 1 : 0) : g.items.filter((it) => tried.includes(it.id)).length, badge = b?.querySelector('.kg-try-n');
      if (!b) continue;
      badge.textContent = String(n); badge.hidden = !n;
      b.setAttribute('aria-label', n ? (g.title ? `${g.name}, 달아 본 칭호 1개` : `${g.name}, 입혀 본 옷 ${n}벌`) : g.name);
    }
    line = tryLine(tried, catalog, sid, { title, wornTitle });
    lineEl.textContent = line || TRY_EMPTY;
    lineEl.classList.toggle('is-empty', !line);
    copyBtn.disabled = !line; resetBtn.disabled = !tried.length && !picked;
    const total = tryTotal(tried, catalog, { worn, title, wornTitle }), used = tried.length + (picked ? 1 : 0);
    sum.textContent = used
      ? [total.count ? `${total.count}벌` : null, picked ? '칭호 1개' : null, `합계 ${fmt(total.price)}냥`,
        used >= TRY_MAX ? (picked ? `옷과 칭호를 합쳐 ${TRY_MAX}개까지` : `한 번에 ${TRY_MAX}벌까지`) : null].filter(Boolean).join(' · ')
      : '지금 입은 모습이에요';
    hint.textContent = tryNotes(worn, tried, catalog, { title, wornTitle, level }).join(' · ');
    showBadge();
    keepTab();
    if (draw) paint(look, codes);
  }
  // 휴대폰(탭 줄이 옆으로 넘어갈 때): 고른 수 표시로 탭이 넓어져 줄 끝에 걸리면(맨 끝 칭호 탭 등) 옆으로만 조금 넘겨 다 보이게
  function keepTab() {
    const b = tabBtns.get(tab);
    if (!b || tabs.scrollWidth <= tabs.clientWidth) return;
    const tr = tabs.getBoundingClientRect(), br = b.getBoundingClientRect(), pad = parseFloat(getComputedStyle(tabs).paddingRight) || 0;
    if (br.right > tr.right - pad) tabs.scrollBy({ left: br.right - tr.right + pad });
    else if (br.left < tr.left + pad) tabs.scrollBy({ left: br.left - tr.left - pad });
  }
  // 옷 누르기: 입혀 보기 / 벗기기 / 입은 옷으로 되돌리기
  const pick = (id) => {
    const look = applyTryOn(worn, tried, catalog);
    if (!tried.includes(id) && have.has(id) && itemShown(look, id, catalog)) { toast('지금 입고 있는 옷이에요'); return; }
    if (!canTry(tried, id, catalog, { worn, title, wornTitle })) { toast(TRY_FULL, 'error'); return; }
    tried = toggleTry(tried, id, catalog, { worn, title, wornTitle });
    sync();
  };
  // 칭호 누르기: 달아 보기 / 빼기 / 다른 칭호로 바꾸기 / 단 칭호로 되돌리기(캐릭터 그림은 그대로라 다시 그리지 않는다)
  const pickTitle = (id) => {
    if (id === wornTitle && !pickedTitle(catalog, title, wornTitle)) { toast(TITLE_WORN); return; }
    if (!canTitle(tried, title, id, catalog, { wornTitle })) { toast(TRY_FULL, 'error'); return; }
    title = toggleTitle(title, id, catalog, { tried, wornTitle });
    sync({ paint: false });
  };
  // 복사: 클립보드(안 되면 숨은 글 칸) → 그래도 안 되면 채팅 한 줄 글을 골라 두고 길게 눌러 복사하라고 알린다
  const copyLine = async () => {
    if (!line) return;
    if (await copyText(line)) { toast(copiedText({ clothes: tryCodes(tried, catalog, sid).length, title: Boolean(pickedTitle(catalog, title, wornTitle)) })); return; }
    try { const sel = getSelection(), r = document.createRange(); r.selectNodeContents(lineEl); sel.removeAllRanges(); sel.addRange(r); } catch { /* 고르기도 안 되는 브라우저 */ }
    toast('복사하지 못했어요. 위 채팅 글을 길게 눌러 복사해 주세요.', 'error');
  };
  const build = () => {
    built = true;
    for (const g of tabList) {
      const b = h('button', { type: 'button', class: 'kg-filter kg-try-tab' + (g.title ? ' is-title' : ''), 'aria-pressed': String(g.slot === tab), onclick: () => showTab(g.slot, { scroll: true }) },
        g.name, h('span', { class: 'kg-try-n', 'aria-hidden': 'true', hidden: true }));
      tabBtns.set(g.slot, b);
    }
    tabs.replaceChildren(...tabBtns.values());
    const closeBtn = h('button', { type: 'button', class: 'btn btn-line kg-try-close', onclick: () => setOpen(false) }, icon('close', { size: 18 }), h('span', null, '닫기'));
    section.replaceChildren(
      secHead(TRY_TITLE, titles.length
        ? '옷이나 칭호를 눌러 미리 입혀 보고, 마음에 들면 채팅 한 줄을 복사해 방송 채팅에 붙여 넣어요. 다시 누르면 빼요.'
        : '옷을 눌러 미리 입혀 보고, 마음에 들면 채팅 한 줄을 복사해 방송 채팅에 붙여 넣어요. 다시 누르면 벗겨요.', closeBtn, { id: 'try-title' }),
      h('p', { class: 'kg-try-note' }, tryNote({ titles: titles.length > 0, rule })),
      h('div', { class: 'kg-try-body' + (titles.length ? ' has-titles' : '') }, top, gridHost));
    showTab(tab);
    sync();
  };
  function setOpen(on, { scroll = true } = {}) {
    if (on && !built) build();
    section.hidden = !on;
    openBtn.setAttribute('aria-expanded', String(on));
    openLabel.textContent = on ? `${TRY_TITLE} 닫기` : TRY_TITLE;
    if (on) {
      if (scroll) section.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
      section.focus({ preventScroll: true });
    } else openBtn.focus();
  }
  openBtn.addEventListener('click', () => setOpen(section.hidden));
  return { openBtn, section, open: (opts) => setOpen(true, opts) };
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
  let hearts = Number(data.hearts) || 0;
  const count = h('b', { class: 'kg-heart-num', 'aria-live': 'polite', 'aria-label': `하트 ${fmtN(hearts)}개` }, fmtN(hearts));
  const setCount = (n) => { hearts = Number(n) || 0; count.textContent = fmtN(n); count.setAttribute('aria-label', `하트 ${fmtN(n)}개`); };
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

  const titles = titleList(catalog, data.titles);
  const level = Number(data.level) || 1;
  const look = expressionFor(catalog, seasonId, level), expression = look.name;
  const fact = (label, value) => h('div', { class: 'kg-fact' }, h('dt', null, label), h('dd', null, value));
  // 저장하기: 화면의 캐릭터와 같은 것(DJ 캐릭터 · 입은 옷 · 레벨 표정)으로 그린다. DJ 캐릭터가 없으면(그림 없음) 단추도 없다.
  const saveBtn = dj.character ? saveButton(() => ({ id: data.id, character: dj.character, worn: data.worn, level, expression: look, seasonName: data.season?.name || '', hearts }), { base: app.base }) : null;
  night.replaceChildren(
    h('div', { class: 'kg-wrap' },
      h('section', { class: 'kg-hero char' },
        h('div', { class: 'kg-hero-art' },
          art(catalog, dj.character, data.worn, data.level, { seasonId, base: app.base, label: `${data.id} 캐릭터`, eager: true, kind: 'hero' }),
          saveBtn ? h('div', { class: 'kg-save-row' }, saveBtn) : null),
        h('div', { class: 'kg-hero-copy' },
          ilink(djLink, { class: 'kg-crumb' }, `${dj.name} 키우기`, icon('arrow', { size: 14 })),
          // 단 칭호(먼치킨은 단 칭호 하나만 보낸다): 배지 그림 + "시즌2까지 / 효과…" 줄
          ...titles.slice(0, 1).map((t) => h('div', { class: 'kg-char-title' },
            t.image ? h('img', { class: 'kg-char-title-img', src: titleImageUrl(t, app.base), alt: `칭호 ${t.name}`, decoding: 'async' }) : h('b', { class: 'kg-title-word' }, t.name),
            titleEffects(t))),
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
  // 입혀 보기: "입은 옷" 제목 옆 단추로 열고, 칸은 입은 옷 바로 아래(주소가 #try 면 열어 둔다)
  const tryOn = tryOnPanel({ catalog, seasonId, dj, worn: data.worn, titles: data.titles, level, app });
  main.replaceChildren(...[
    h('section', { class: 'kg-sec' },
      secHead('입은 옷', worn.length ? `${worn.length}벌을 입고 있어요. 번호를 누르면 같은 옷을 사는 채팅이 복사돼요.` : '아직 아무것도 입지 않았어요.', tryOn?.openBtn || null),
      slots.length
        ? h('ul', { class: 'kg-worn' }, ...slots.map((w) => {
          const code = w.id ? itemCodeOf(catalog, seasonId, w.id) : null;
          return h('li', { class: 'kg-worn-one' + (w.id ? '' : ' is-empty') },
            w.id ? itemArt(catalog, w.id, { base: app.base, label: w.name, gender, dj: dj.character }) : h('span', { class: 'kg-stage item kg-slot-empty', 'aria-hidden': 'true' }),
            h('span', { class: 'kg-worn-text' }, h('span', { class: 'kg-worn-slot' }, w.slotName), h('b', null, w.id ? w.name : w.covered || '비어 있음'),
              code ? h('button', { type: 'button', class: 'kg-worn-code', title: `${chatHint(code)} 복사`, onclick: () => copyCode(code) }, chatHint(code)) : null));
        }))
        : h('p', { class: 'empty' }, '아직 아무것도 입지 않았어요.')),
    tryOn?.section,
    h('section', { class: 'kg-banner' },
      h('div', { class: 'kg-banner-text' }, h('b', null, `${dj.name} 키우기의 다른 캐릭터`), h('p', null, '이번 시즌 1~3등과 내 아이디 찾기는 DJ 키우기 페이지에 있어요.')),
      ilink(djLink, { class: 'btn btn-line' }, `${dj.name} 키우기 보기`, icon('arrow', { size: 16 })))].filter(Boolean));
  shell.append(siteFoot(app, '청취자가 방송에서 직접 만든 아이디와 레벨·입은 옷·하트만 보여요.'));
  if (tryOn && location.hash === '#try') tryOn.open({ scroll: false });
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
