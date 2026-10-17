// 캐릭터 페이지(k/<주소>/<아이디 앞 부분>): 무대 위 큰 캐릭터(바로 아래 저장하기) · 아이디 · 레벨과 표정 · 정보 칸 · 하트(하루 한 번) · 입은 옷(칸마다, 빈 칸도) · DJ 페이지 링크 · 링크 복사.
// 애정도 숫자는 보이지 않는다. 하트 열쇠는 이 브라우저 저장소에만 둔다(lib/hearts.js). 로그인 없음.
// 저장하기(2026-10-09 사용자: "저장하기 버튼을 따로"): 캐릭터 그림 바로 아래 따로 있는 단추 하나 — 캐릭터 + 배경 + "아이디#이름" 이 든 1080×1350 PNG(lib/kiugi-save.js).
//  하트·링크 복사 단추 줄과 섞지 않는다(휴대폰에서는 넓게, PC 에서는 보통 너비).
// 입혀 보기(2026-10-09 사용자: "옷을 눌러 미리 입혀 보고, 마음에 들면 !옷장 상의11 하의3 같은 채팅을 한 번에 복사"): "입은 옷" 제목 옆 단추로 여는 칸.
//  묶음 탭(시즌 목록 categories) · 옷 칸(그림·번호·이름·값, 입은 옷은 "입는 중" — 옷에는 레벨 조건이 없다, 2026-10-10) · 누르면 미리 보기에 입혀 보고 다시 누르면 벗긴다 · 원래대로.
//  규칙(lib/try-on.js — 먼치킨 !옷장 과 같게): 칸마다 한 벌(모자 하나 · 악세사리는 자리마다 하나), 한벌옷 ↔ 상의·하의, 옷과 칭호를 합쳐 한 번에 8개까지.
//  묶음 탭은 시즌 목록 차례 그대로(새 그림체 R7: 한벌옷·상의·하의·신발·모자·악세사리·배경 — 모자 탭은 시즌 목록에 모자 묶음이 생겨 저절로 생긴다).
//  칭호 탭(2026-10-14 사용자: "입혀 보기에서 칭호도 고르게"): 옷 묶음 뒤에 "칭호" — 배지 그림·번호(칭호2)·이름·값·Lv.10(상점이 열리기 전이면 "10월 30일부터").
//   하나만 고른다(다른 칭호를 누르면 바뀌고, 다시 누르면 뺀다). 지금 단 칭호는 "다는 중"(입은 옷처럼 — 살 것이 없다). 고른 칭호(없으면 단 칭호)는 미리 보기 위에 배지로,
//   채팅 한 줄 맨 끝에 번호("!옷장 상의11 하의3 칭호2", 칭호만이면 "!옷장 칭호 2"), 값은 합계에.
//  맨몸부터(2026-10-15 사용자 "아예 맨몸에서부터 시작하게 !다벗기"): 단추를 켜면 입은 옷을 모두 벗긴 모습(배경은 그대로)에서 입혀 보고 "!옷장 다벗기 상의11 하의3"
//   (고른 것이 없으면 "!다벗기")을 복사한다. 벗긴 옷은 "가진 옷"이라 다시 골라도 값에 들지 않는다. "원래대로"는 맨몸부터도 끈다.
//  휴대폰: 미리 보기·채팅 한 줄·탭이 위에 붙어 있고 옷 칸이 아래로. 넓은 화면: 왼쪽에 붙은 미리 보기, 오른쪽에 옷 칸.
import { h, icon, toast, copyText } from '../lib/dom.js';
import { kiugiApi, fastApi } from '../api.js';
import { sameData, peekPreview } from '../lib/swr.js';
import { observe, snapOf } from '../lib/me.js';
import { loadCatalog, buildCatalog, wornList, expressionFor, itemCodeOf, titleList, titleImageUrl, titleOpenDate, characterMarkup, paintMarkup, petStage, motionOf, motionList, motionDoing, MOTIONS_READY, MOTION_WAIT } from '../lib/kiugi-draw.js';
import { copyCode, chatHint, titleEffects, itemGroups, motionPriceText } from './items.js';
import { applyTryOn, toggleTry, canTry, itemShown, wornIds, bareWorn, BARE_NOTE, tryCodes, tryLine, tryTotal, tryNotes, tryNote, copiedText,
  toggleTitle, canTitle, pickedTitle, shownTitle, titleOf, wornTitleOf, TRY_MAX, TRY_FULL, TITLE_WORN,
  motionLine, motionCommand, MOTION_OFF, MOTION_COPIED } from '../lib/try-on.js';
import { heartKey, sentToday, sendHeart } from '../lib/hearts.js';
import { saveCharacterImage, hintSaveButton, SAVE_LABEL, SAVE_BUSY, SAVE_FAILED } from '../lib/kiugi-save.js';
import { ilink, loading, nightTop, siteFoot, secHead, share, BRAND } from './common.js';
import { art, itemArt, copyLink, idText, actorNodes, setStageMotion, stars, petImage, petImageUrl, petBuddy, buddyOf } from './cards.js';
import { postCard, pinButton, burstLayer, HEART_ALREADY } from './feed.js';

// 이 브라우저 저장소(막혀 있으면 null — lib/hearts.js 가 이번 창에서만 기억)
function browserStorage() { try { return window.localStorage; } catch { return null; } }
export const HEART_SENT = '오늘 하트 보냈어요';
export const HEART_SEND = '하트 보내기';

// 입은 옷 칸 목록: 이번 시즌 칸 차례대로(입지 않은 칸은 빈 칸 — R7: 한벌옷·상의·하의·신발·모자·머리·얼굴·목·손 장식·배경), 시즌 칸에 없는 칸은 뒤에.
//  한벌옷을 입으면 상의·하의 칸은 "한벌옷이 덮고 있어요"(covered). 예전 그림의 옷(목록에 없는 id)은 칸에 넣지 않는다(빈 칸 — 그림도 그리지 않는다).
//  입은 옷마다 채팅 번호(상의11)를 보이고, 누르면 "!옷장 상의 11" 이 복사된다(0.15.66 — !옷장 으로 통일). 칭호(지금 효과가 있는 것)는 아이디 아래에.
export const COVERED = Object.freeze({ outfit: '한벌옷이 덮고 있어요' });
// 펫(2026-10-15 사용자 "키우기.com 에서 자기 펫도 직접 볼 수 있게"): 먼치킨이 보낸 pets {id: 단계}·pet {id, stage} → 시즌 펫 차례대로
//  [{id, emoji, name(단계 이름 — 못 만났으면 기본 이름), stage(0 = 못 만남), active}]. 시즌 목록에 펫이 없으면 빈 목록(펫 칸을 그리지 않는다).
export function petList(catalog, data) {
  const got = data?.pets && typeof data.pets === 'object' ? data.pets : {}, active = data?.pet?.id;
  return Object.values(catalog?.pets || {}).map((p) => {
    const stage = Number.isInteger(got[p.id]) && got[p.id] >= 1 && got[p.id] <= 5 ? got[p.id] : 0;
    return { id: p.id, season: p.season, emoji: p.emoji, name: stage ? petStage(p, stage) : p.name, stage, active: stage > 0 && p.id === active };
  });
}
// 펫 그림·함께하는 펫(그림 아래 이름·★)은 cards.js 에 있다(메인 카드도 같이 쓴다 — 2026-10-16). petImageUrl 은 예전처럼 여기서도 내보낸다.
export { petImageUrl };
function petSection(pets, base) {
  if (!pets.length) return null;
  const met = pets.filter((p) => p.stage > 0).length;
  return h('section', { class: 'kg-sec' },
    // 2026-10-15: 펫 잡기(!잡기)·냥 진화(!펫진화)도 알린다
    secHead('펫', met ? `방송에서 만난 펫 ${met}마리예요. 만날수록 ★5까지 자라고, !펫진화 이름 으로 냥을 내고 진화할 수도 있어요.` : '아직 만난 펫이 없어요. 방송에서 !산책 하거나 펫이 나타났을 때 !잡기 로 할로윈 펫을 만나요.'),
    h('ul', { class: 'kg-pets' }, ...pets.map((p) => h('li', { class: 'kg-pet' + (p.stage ? '' : ' is-unmet') + (p.active ? ' is-active' : '') },
      h('span', { class: 'kg-pet-frame' }, petImage(p, base)),
      h('b', null, p.stage ? p.name : '???'),
      h('span', { class: 'kg-pet-stage' }, p.stage ? stars(p.stage) + (p.active ? ' · 함께' : '') : `아직 못 만난 ${p.name}`)))));
}
// 모션 안내(캐릭터 첫 화면 정보 칸 아래 한 줄, 2026-10-15): 방송 채팅 "!모션 춤"(시즌 첫 모션 이름) · 값(시즌 목록) · "!모션 끄기" · 입혀 보기에서 미리 보기. 모션이 없는 시즌이면 null.
export function motionGuide(catalog, seasonId) {
  const list = motionList(catalog, seasonId);
  if (!list.length) return null;
  // 2026-10-16 사용자 "모션 싹 다 없애. 나중에 추가할 거야": 모션을 보이지 않는 동안은 "업데이트 대기 중" 한 줄도 내지 않는다
  if (!MOTIONS_READY) return null;
  const cmd = (t) => h('code', { class: 'kg-cmd' }, t), price = motionPriceText(list);
  return h('p', { class: 'kg-motion-guide' }, h('b', null, '모션'), ' 방송 채팅에 ', cmd(motionCommand(list[0])), ` 처럼 치면 사서 바로 해요${price ? `(${price})` : ''}. 멈출 때는 `, cmd(MOTION_OFF), ' 를 쳐요. 아래 입혀 보기에서 미리 볼 수 있어요.');
}
export function loadoutSlots(catalog, seasonId, worn) {
  const list = wornList(catalog, seasonId, worn);
  const slots = (catalog?.seasons?.[seasonId] || catalog?.seasons?.[catalog?.last])?.slots || [];
  const bySlot = new Map(list.map((w) => [w.slot, w]));
  const cover = (id) => (['top', 'bottom'].includes(id) && bySlot.has('outfit') ? COVERED.outfit : null);
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
// 모션 탭(2026-10-15 사용자 "청취자들이 모션을 살 수 있게"): 칭호 뒤 맨 끝. "모션 없이" + 시즌 모션 — 누르면 미리 보기 캐릭터가 그 모션을 하고,
//  옷 한 줄과 따로 "!모션 춤"(모션 없이를 고르면 "!모션 끄기")을 복사한다. 지금 하는 모션(서버가 보낸 motion)은 "하는 중" — 미리 보기도 처음엔 그 모션.
export const MOTION_TAB = 'motion';
export const MOTION_EMPTY = '모션을 고르면 여기에 채팅 한 줄이 생겨요';
// pet(2026-10-15 사용자 "펫이 여기 같이 나와야 한다 귀엽고 이쁘게"): 함께하는 펫 — 미리 보기 오른쪽 아래에 같이 선다(옷과 상관없이 그대로)
// motion: 지금 하는 모션 id(서버가 보낸 것 — 시즌 목록에 없으면 모션 없음)
export function tryOnPanel({ catalog, seasonId, dj, worn, titles: wearing = [], level, app, pet = null, motion = null }) {
  const sid = catalog?.seasons?.[seasonId] ? seasonId : catalog?.last;
  const { groups, titles = [], rule = null } = itemGroups(catalog, sid);
  if (!dj?.character || !groups.length) return null;
  const gender = dj.character.gender === 'm' ? 'm' : 'f', have = wornIds(worn), fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
  const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 지금 단 칭호(시즌 목록에 있는 것만) · 칭호 상점이 열리기 전이면 여는 날("10월 30일")
  const wornTitle = wornTitleOf(catalog, wearing), openDate = titleOpenDate(rule);
  // 탭 = 옷 묶음들 + (칭호가 있는 시즌이면) 칭호
  const tabList = [...groups, ...(titles.length ? [{ slot: TITLE_TAB, name: '칭호', items: titles, title: true }] : [])];
  // + (모션이 있는 시즌이면) 모션 — 지금 하는 모션(nowMotion)과 미리 보는 모션(pickMotion)
  const motions = MOTIONS_READY ? motionList(catalog, sid) : [], nowMotion = MOTIONS_READY ? motionOf(catalog, motion)?.id || null : null;
  let pickMotion = nowMotion;
  if (motions.length) tabList.push({ slot: MOTION_TAB, name: '모션', items: motions, motion: true });
  // bare: 맨몸부터(2026-10-15 — 먼치킨 !다벗기) — 입은 옷을 모두 벗긴 모습(배경은 그대로)에서 입혀 보고, 채팅 한 줄은 "!옷장 다벗기 …"
  let tried = [], title = null, tab = groups[0].slot, built = false, line = '', bare = false;
  // 지금 미리 보기의 바탕(맨몸부터면 배경만 남긴 입은 옷)과 그 옷 id
  const base = () => (bare ? bareWorn(worn) : worn), onNow = () => wornIds(base());
  const openLabel = h('span', null, TRY_TITLE);
  const openBtn = h('button', { type: 'button', class: 'btn btn-accent kg-try-open', 'aria-expanded': 'false', 'aria-controls': 'try' }, icon('hanger', { size: 19 }), openLabel);
  const section = h('section', { class: 'kg-sec kg-try', id: 'try', hidden: true, tabindex: '-1', 'aria-labelledby': 'try-title' });
  // 미리 보기(위에 칭호 배지) · 채팅 한 줄 · 단추 · 합계
  const stage = h('div', { class: 'kg-stage char kg-try-stage' });
  const badgeImg = h('img', { class: 'kg-try-title-img', alt: '', decoding: 'async' });
  const badgeWord = h('b', { class: 'kg-title-word' });
  const titleTag = h('div', { class: 'kg-try-title', hidden: true });
  const lookEl = h('div', { class: 'kg-try-look' + (pet ? ' has-pet' : '') }, titleTag, stage, petBuddy(pet, app.base));
  const lineEl = h('p', { class: 'kg-try-line is-empty', id: 'try-line' }, TRY_EMPTY);
  const copyBtn = h('button', { type: 'button', class: 'btn btn-accent kg-try-copy', disabled: true, 'aria-describedby': 'try-line', onclick: () => copyLine() }, icon('copy', { size: 18 }), h('span', null, '복사'));
  const resetBtn = h('button', { type: 'button', class: 'btn btn-line kg-try-reset', disabled: true, onclick: () => { pickMotion = nowMotion; tried = []; title = null; bare = false; sync(); } }, icon('undo', { size: 18 }), h('span', null, '원래대로'));
  // 맨몸부터: 누르면 켜고 끄기(켜면 입은 옷이 모두 벗겨진 모습에서 시작 — 고른 옷은 그대로 둔다)
  const bareBtn = h('button', { type: 'button', class: 'btn btn-line kg-try-bare', 'aria-pressed': 'false', title: '입은 옷을 모두 벗긴 모습에서 입혀 봐요 (!다벗기)',
    onclick: () => { bare = !bare; sync(); } }, icon('hanger', { size: 18 }), h('span', null, '맨몸부터'));
  const sum = h('p', { class: 'kg-try-sum', role: 'status', 'aria-live': 'polite' });
  const hint = h('p', { class: 'kg-try-hint' });
  const tabs = h('div', { class: 'kg-try-tabs', role: 'group', 'aria-label': titles.length ? '옷·칭호 묶음 고르기' : '옷 묶음 고르기' });
  const gridHost = h('div', { class: 'kg-try-grid-host' });
  const top = h('div', { class: 'kg-try-top' },
    lookEl,
    h('div', { class: 'kg-try-cmd' }, h('span', { class: 'kg-try-label' }, '채팅에 붙여 넣기'), lineEl, h('div', { class: 'kg-try-actions' }, copyBtn, resetBtn, bareBtn), sum, hint),
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
  // 모션 탭: 위에 따로 복사하는 한 줄("!모션 춤" — 옷 한 줄과 다른 명령) + "모션 없이"·모션 칸(그림 글자·이름·한 줄 설명·값). 하나만 고른다.
  const motionTiles = new Map();
  let mLine = '';
  const mLineEl = h('p', { class: 'kg-try-line is-empty', id: 'try-motion-line' }, MOTION_EMPTY);
  const mCopyBtn = h('button', { type: 'button', class: 'btn btn-accent kg-try-copy', disabled: true, 'aria-describedby': 'try-motion-line', onclick: () => copyMotion() }, icon('copy', { size: 18 }), h('span', null, '복사'));
  const mSum = h('p', { class: 'kg-try-sum', role: 'status', 'aria-live': 'polite' });
  const motionTile = (m) => {
    const id = m?.id || null, mine = id === nowMotion;
    const badge = h('span', { class: 'kg-try-badge', 'aria-hidden': 'true' });
    const btn = h('button', { type: 'button', class: 'kg-try-pick', 'aria-pressed': 'false', onclick: () => pickMotionTile(id),
      'aria-label': m ? `모션 ${m.name} · ${fmt(m.price)}냥${mine ? ' · 지금 하는 중' : ''}` : `모션 없이${mine ? ' · 지금' : ` · ${MOTION_OFF}`}` }, m ? m.name : '모션 없이');
    const li = h('li', { class: 'kg-try-tile is-motion' + (mine ? ' is-worn' : '') },
      h('div', { class: 'kg-try-media kg-try-motion-media', 'aria-hidden': 'true' }, h('span', { class: 'kg-try-motion-emoji' }, m ? m.emoji : '🧍'), badge),
      btn,
      h('span', { class: 'kg-try-desc', 'aria-hidden': 'true' }, m ? m.desc : '숨쉬기만 해요'),
      h('span', { class: 'kg-try-price', 'aria-hidden': 'true' }, m ? h('b', null, `${fmt(m.price)}냥`) : h('span', { class: 'kg-chip' }, MOTION_OFF)));
    motionTiles.set(id, { li, btn, badge });
    return li;
  };
  const motionGrid = (g) => h('div', { class: 'kg-try-motions' },
    h('p', { class: 'kg-try-tab-note' }, '모션을 누르면 미리 보기 캐릭터가 그 모션을 해요. 옷 채팅과 따로, 이 한 줄을 복사해 방송 채팅에 붙여 넣어요.'),
    h('div', { class: 'kg-try-mcmd' }, h('span', { class: 'kg-try-label' }, '모션 채팅'), mLineEl, h('div', { class: 'kg-try-actions' }, mCopyBtn), mSum),
    h('ul', { class: 'kg-try-grid is-motions', 'aria-label': '모션' }, motionTile(null), ...g.items.map(motionTile)));
  // 모션 누르기: 고르기 / 고른 모션을 다시 누르면 지금 하는 모션으로 되돌리기(미리 보기는 다시 그리지 않고 움직임만 바꾼다)
  const pickMotionTile = (id) => { pickMotion = id === pickMotion ? nowMotion : id; sync({ paint: false }); };
  const copyMotion = async () => {
    if (!mLine) return;
    if (await copyText(mLine)) { toast(MOTION_COPIED(mLine)); return; }
    try { const sel = getSelection(), r = document.createRange(); r.selectNodeContents(mLineEl); sel.removeAllRanges(); sel.addRange(r); } catch { /* 고르기도 안 되는 브라우저 */ }
    toast('복사하지 못했어요. 위 채팅 글을 길게 눌러 복사해 주세요.', 'error');
  };
  const syncMotion = () => {
    for (const [id, t] of motionTiles) {
      const on = id === pickMotion;
      t.btn.setAttribute('aria-pressed', String(on));
      t.li.classList.toggle('is-on', on); t.li.classList.toggle('is-tried', on && id !== nowMotion);
      t.badge.textContent = id === nowMotion ? (id ? '하는 중' : '지금') : on ? '골라 봄' : '';
    }
    mLine = motionLine(catalog, pickMotion, nowMotion);
    mLineEl.textContent = mLine || MOTION_EMPTY; mLineEl.classList.toggle('is-empty', !mLine); mCopyBtn.disabled = !mLine;
    const m = motionOf(catalog, pickMotion), now = motionOf(catalog, nowMotion);
    mSum.textContent = mLine ? (m ? `${m.emoji} ${m.name} · ${fmt(m.price)}냥` : '지금 하는 모션을 멈춰요')
      : now ? `지금 ${motionDoing(now)}이에요` : '모션을 누르면 미리 볼 수 있어요';
    setStageMotion(stage, pickMotion);
  };
  const listOf = (g) => {
    if (!lists.has(g.slot)) lists.set(g.slot, g.title ? titleGrid(g) : g.motion ? motionGrid(g) : h('ul', { class: 'kg-try-grid', 'aria-label': `${g.name} 옷` }, ...g.items.map((it) => tile(it, g.slot === 'outfit'))));
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
    try { markup = characterMarkup(catalog, dj.character, look, level, { seasonId, base: app.base, label: codes.length ? `입혀 본 모습: ${codes.join(', ')}` : bare ? '맨몸' : '지금 입은 모습', stage: null }); } catch (e) { console.error(e); }
    if (!markup) { stage.replaceChildren(h('span', { class: 'kg-noart' }, '그림을 그리지 못했어요')); stage.removeAttribute('aria-busy'); return; }
    // 캐릭터는 숨쉬고, 고른 모션(pickMotion — 그림을 다 받은 때의 것)을 한다
    paintMarkup(stage, markup, { make: (m) => actorNodes(m, { motion: pickMotion }), fallback: h('span', { class: 'kg-noart' }, '그림을 그리지 못했어요') })
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
    const now = onNow(), look = applyTryOn(base(), tried, catalog), codes = tryCodes(tried, catalog, sid), picked = pickedTitle(catalog, title, wornTitle);
    for (const [id, t] of tiles) {
      const isTried = tried.includes(id), on = isTried || (now.has(id) && itemShown(look, id, catalog));
      t.btn.setAttribute('aria-pressed', String(on));
      t.li.classList.toggle('is-on', on); t.li.classList.toggle('is-tried', isTried && !have.has(id)); t.li.classList.toggle('is-off', now.has(id) && !on);
      // 맨몸부터에서 벗긴 옷은 "가진 옷"(다시 입어도 냥이 들지 않는다)
      t.badge.textContent = now.has(id) ? '입는 중' : isTried ? '입혀 봄' : have.has(id) ? '가진 옷' : '';
    }
    bareBtn.setAttribute('aria-pressed', String(bare)); bareBtn.classList.toggle('is-on', bare);
    for (const [id, t] of titleTiles) {
      const isPicked = id === picked, on = isPicked || (!picked && id === wornTitle);
      t.btn.setAttribute('aria-pressed', String(on));
      t.li.classList.toggle('is-on', on); t.li.classList.toggle('is-tried', isPicked); t.li.classList.toggle('is-off', id === wornTitle && !on);
      t.badge.textContent = id === wornTitle ? '다는 중' : isPicked ? '달아 봄' : '';
    }
    for (const g of tabList) {
      const b = tabBtns.get(g.slot), n = g.title ? (picked ? 1 : 0) : g.motion ? (pickMotion !== nowMotion ? 1 : 0) : g.items.filter((it) => tried.includes(it.id)).length, badge = b?.querySelector('.kg-try-n');
      if (!b) continue;
      badge.textContent = String(n); badge.hidden = !n;
      b.setAttribute('aria-label', n ? (g.title ? `${g.name}, 달아 본 칭호 1개` : g.motion ? `${g.name}, 골라 본 모션 있음` : `${g.name}, 입혀 본 옷 ${n}벌`) : g.name);
    }
    if (motions.length) syncMotion();
    line = tryLine(tried, catalog, sid, { title, wornTitle, bare });
    lineEl.textContent = line || TRY_EMPTY;
    lineEl.classList.toggle('is-empty', !line);
    copyBtn.disabled = !line; resetBtn.disabled = !tried.length && !picked && !bare && pickMotion === nowMotion;
    // 값: 지금 입은 옷은 가진 옷이라 빼고 센다(맨몸부터로 벗긴 옷을 다시 입어도 냥이 들지 않는다)
    const total = tryTotal(tried, catalog, { worn, title, wornTitle }), used = tried.length + (picked ? 1 : 0);
    sum.textContent = used
      ? [total.count ? `${total.count}벌` : null, picked ? '칭호 1개' : null, `합계 ${fmt(total.price)}냥`,
        used >= TRY_MAX ? (picked ? `옷과 칭호를 합쳐 ${TRY_MAX}개까지` : `한 번에 ${TRY_MAX}벌까지`) : null].filter(Boolean).join(' · ')
      : bare ? BARE_NOTE : '지금 입은 모습이에요';
    hint.textContent = tryNotes(base(), tried, catalog, { title, wornTitle, level }).join(' · ');
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
    const look = applyTryOn(base(), tried, catalog);
    if (!tried.includes(id) && onNow().has(id) && itemShown(look, id, catalog)) { toast('지금 입고 있는 옷이에요'); return; }
    if (!canTry(tried, id, catalog, { worn: base(), title, wornTitle })) { toast(TRY_FULL, 'error'); return; }
    tried = toggleTry(tried, id, catalog, { worn: base(), title, wornTitle });
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
    if (await copyText(line)) { toast(copiedText({ clothes: tryCodes(tried, catalog, sid).length, title: Boolean(pickedTitle(catalog, title, wornTitle)), bare })); return; }
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

// 캐릭터 페이지(2026-10-18 새 구조 — SNS 프로필, "빠릿빠릿"): 카드를 누르면 그 카드가 이미 아는 것(아이디·레벨·입은 옷·하트·펫·DJ 캐릭터 — lib/swr.js 미리 보기)이나
//  지난번 답으로 바로 그리고(전신 무대 · 아이디 · 레벨 · 하트 · 입은 옷), 서버 답이 오면(1~2초) 칭호·펫 칸·입혀 보기까지 채운다. 무대 그림은 같은 모습이면 다시 그리지 않는다.
//  더한 것: "이게 나예요"(내 캐릭터 — 첫 화면에서 매일 달라진 점) · 정보 칸(레벨 · 하트 · 입은 옷 · 펫) · 같은 방송의 다른 캐릭터(큰 카드 — 휴대폰은 옆으로 넘겨 보기) · 무대 두 번 톡톡 = 하트.
export async function renderCharacter(root, route, app) {
  document.title = BRAND;
  const night = h('div', { class: 'kg-night compact' });
  const main = h('main', { id: 'main', class: 'fp-main kg-main char-main', tabindex: '-1' }, loading());
  const shell = h('div', { class: 'fp kg-site' }, ...nightTop(app), night, main);
  root.replaceChildren(shell);
  const catalogJob = loadCatalog(app.base).catch(() => buildCatalog([]));
  const job = fastApi.person(route.slug, route.base);
  const pre = job.cached || peekPreview(route.slug, route.base);
  let footed = false;
  const foot = () => { if (footed) return; footed = true; shell.append(siteFoot(app, '청취자가 방송에서 직접 만든 아이디와 레벨·입은 옷·펫·하트만 보여요. 내 캐릭터는 이 브라우저에만 기억해요.')); };
  const env = { app, route, night, main, hero: null };
  const catalog = await catalogJob;
  let shown = null;
  if (pre?.dj) { shown = pre; paintCharacter(pre, catalog, env, { partial: !job.cached }); foot(); }
  let data;
  try { data = await job.fresh; }
  catch (e) {
    if (!shown || e.status === 404) { night.replaceChildren(); main.replaceChildren(missing(e, route, app)); foot(); }
    else env.status?.replaceChildren(h('span', null, '지금은 새 정보를 불러오지 못했어요. 잠시 뒤에 다시 들어와 주세요.'));
    return;
  }
  if (!main.isConnected) return;
  if (!shown || job.cached === undefined || !sameData(data, shown)) paintCharacter(data, catalog, env, { partial: false });
  foot();
}

function paintCharacter(data, catalog, env, { partial = false } = {}) {
  const { app, route, night, main } = env;
  const dj = data.dj || {}, seasonId = data.season?.id || null;
  const djLink = app.link({ name: 'kiugi', slug: dj.slug });
  const url = location.origin + app.link({ name: 'character', slug: dj.slug, base: route.base });
  document.title = `${data.id} · ${dj.name} 키우기`;
  // 머리줄에 공유 단추(휴대폰은 공유 창, 안 되면 주소 복사)
  const shareBtn = h('button', { type: 'button', class: 'fp-nav icon-only', 'aria-label': '이 캐릭터 공유하기', onclick: () => share(url, `${data.id} · ${dj.name} 키우기`) }, icon('share', { size: 19 }));
  document.querySelector('.fp-top')?.replaceWith(nightTop(app, { actions: [shareBtn] })[1]);

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
  env.status = status;
  const copyBox = h('div', { class: 'kg-copy-box' });
  const heartLabel = h('span', null, HEART_SEND);
  const heartBtn = h('button', { type: 'button', class: 'btn btn-accent kg-heart-btn' }, icon('heart', { size: 20, filled: true }), heartLabel);
  const done = () => { heartBtn.disabled = true; heartLabel.textContent = HEART_SENT; heartBtn.classList.add('sent'); };
  const undone = () => { heartBtn.disabled = false; heartLabel.textContent = HEART_SEND; heartBtn.classList.remove('sent'); };
  if (sentToday(storage, key)) done();
  const burst = burstLayer();
  // 하트: 누르는 즉시 수를 올리고(서버 답이 오면 그 수로), 무대 위로 하트가 퐁 — 실패하면 되돌린다
  const sendNow = () => {
    if (heartBtn.disabled && heartBtn.classList.contains('sent')) { toast(HEART_ALREADY); return; }
    const r = sendHeart({ slug: dj.slug, id: data.id, seasonId, hearts }, { send: kiugiApi.heart, storage });
    status.textContent = '';
    if (r.already) { done(); toast(HEART_ALREADY); return; }
    setCount(r.optimistic); done(); burst.go();
    r.done.then((res) => {
      if (!res.ok) { undone(); setCount(res.hearts); status.textContent = res.error?.message || '하트를 보내지 못했어요.'; return; }
      setCount(res.hearts);
      document.dispatchEvent(new CustomEvent('kg-heart', { detail: { key, hearts: res.hearts, sent: true, from: heartBtn } }));
      if (!res.already) toast('하트를 보냈어요!');
    });
  };
  heartBtn.addEventListener('click', sendNow);

  const titles = titleList(catalog, data.titles);
  const level = Number(data.level) || 1;
  const look = expressionFor(catalog, seasonId, level), expression = look.name;
  const fact = (label, value) => h('div', { class: 'kg-fact' }, h('dt', null, label), h('dd', null, value));
  // 저장하기: 화면의 캐릭터와 같은 것(DJ 캐릭터 · 입은 옷 · 레벨 표정)으로 그린다. DJ 캐릭터가 없으면(그림 없음) 단추도 없다.
  const pets = partial ? [] : petList(catalog, data), buddyCard = partial ? buddyOf(catalog, data.pet) : null;
  const buddy = pets.find((p) => p.active) || buddyCard || null;
  //  함께하는 펫도 같이 찍는다(2026-10-16 사용자 "펫도 같이 사진 찍게 해 줘")
  const saveBtn = dj.character ? saveButton(() => ({ id: data.id, character: dj.character, worn: data.worn, level, expression: look, seasonName: data.season?.name || '', hearts, pet: buddy ? { id: buddy.id, season: buddy.season, stage: buddy.stage } : null }), { base: app.base }) : null;
  // 앱 안 브라우저에서 "Safari에서 열어 저장하기"로 넘어왔으면(?save=1) 저장하기 단추를 알려 준다
  hintSaveButton(saveBtn);
  // 모션(2026-10-15): 지금 하는 모션(시즌 목록에 있는 것만) — 무대 캐릭터가 그 모션을 하고, 레벨 옆에 "💃 춤추는 중"
  const motion = MOTIONS_READY ? motionOf(catalog, data.motion) : null;
  const metPets = pets.filter((p) => p.stage > 0).length;
  // 무대(전신): 같은 모습이면 지난번 그림 칸을 그대로 쓴다(미리 보기 → 서버 답으로 바꿀 때 깜박이지 않게)
  const heroKey = JSON.stringify([dj.character, data.worn, level, motion?.id || null, buddy ? [buddy.id, buddy.stage] : null]);
  const reuse = env.hero && env.hero.key === heroKey ? env.hero.node : null;
  const heroStage = reuse || h('div', { class: 'kg-hero-stage' + (buddy ? ' has-pet' : '') },
    art(catalog, dj.character, data.worn, data.level, { seasonId, base: app.base, label: `${data.id} 캐릭터${motion ? ` · ${motionDoing(motion)}` : ''}`, eager: true, motion: motion?.id, kind: 'hero' }),
    petBuddy(buddy, app.base));
  if (!reuse) { heroStage.append(burst.el); env.hero = { key: heroKey, node: heroStage, go: burst.go }; }
  else burst.go = env.hero.go;
  // 무대 두 번 톡톡 = 하트(휴대폰)
  if (!heroStage.kgTap) { heroStage.kgTap = true; let last = 0; heroStage.addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch') return; const t = performance.now(); if (t - last < 320) { last = 0; heroStage.kgSend?.(); } else last = t; }); }
  heroStage.kgSend = sendNow;
  const pinRow = h('div', { class: 'kg-pin-row' }, pinButton({ slug: dj.slug, id: data.id, djName: dj.name }, { onPin: () => { if (!partial) observe(storage, snapOf(data, { rank: null })); } }));
  night.replaceChildren(
    h('div', { class: 'kg-wrap' },
      h('section', { class: 'kg-hero char' },
        h('div', { class: 'kg-hero-art' },
          // 함께하는 펫은 캐릭터 오른쪽 발치에 선다(캐릭터는 무대 한가운데 그대로 — 펫이 다리에 겹쳐도 된다, styles.css)
          heroStage,
          saveBtn ? h('div', { class: 'kg-save-row' }, saveBtn) : null),
        h('div', { class: 'kg-hero-copy' },
          ilink(djLink, { class: 'kg-crumb' }, `${dj.name} 키우기`, icon('arrow', { size: 14 })),
          h('h1', { class: 'display kg-char-id' }, ...idText(data.id)),
          h('p', { class: 'kg-char-level' }, h('span', { class: 'kg-lv' }, `Lv.${level}`), h('span', null, expression),
            motion ? h('span', { class: 'kg-motion-chip' }, h('span', { 'aria-hidden': 'true' }, motion.emoji), motionDoing(motion)) : null),
          // 단 칭호(먼치킨은 단 칭호 하나만 보낸다): 배지 그림 + "시즌2까지 / 효과…" 줄 — 아이디 아래(프로필처럼 아이디가 먼저)
          ...titles.slice(0, 1).map((t) => h('div', { class: 'kg-char-title' },
            t.image ? h('img', { class: 'kg-char-title-img', src: titleImageUrl(t, app.base), alt: `칭호 ${t.name}`, decoding: 'async' }) : h('b', { class: 'kg-title-word' }, t.name),
            titleEffects(t))),
          h('dl', { class: 'kg-facts four' },
            fact('레벨', `Lv.${level}`),
            fact('하트', count),
            fact('입은 옷', `${worn.length}벌`),
            fact('펫', partial ? '…' : metPets ? `${metPets}마리` : '—')),
          motionGuide(catalog, seasonId),
          h('div', { class: 'kg-heart-row' }, heartBtn,
            h('button', { type: 'button', class: 'btn btn-line kg-copy-btn', onclick: () => copyLink(url, copyBox) }, icon('link', { size: 18 }), '링크 복사')),
          pinRow,
          h('p', { class: 'kg-hero-note' }, '하트는 하루에 한 번 보낼 수 있어요(휴대폰은 캐릭터를 두 번 톡톡). 링크를 보내서 친구에게 하트를 부탁해 보세요.'),
          status, copyBox))));
  // 입혀 보기: "입은 옷" 제목 옆 단추로 열고, 칸은 입은 옷 바로 아래(주소가 #try 면 열어 둔다). 서버 답(단 칭호)을 받은 뒤에만.
  const tryOn = partial ? null : tryOnPanel({ catalog, seasonId, dj, worn: data.worn, titles: data.titles, level, app, pet: buddy, motion: motion?.id });
  main.replaceChildren(...[
    h('section', { class: 'kg-sec' },
      secHead('입은 옷', worn.length ? `${worn.length}벌을 입고 있어요. 번호를 누르면 같은 옷을 사는 채팅이 복사돼요.` : '아직 아무것도 입지 않았어요.', tryOn?.openBtn || null),
      // 입은 옷만 칸으로(그림 · 칸 이름 · 옷 이름 · 번호 복사), 빈 칸은 아래 한 줄로 모은다(2026-10-18 새 구조 — 빈 네모가 많아 어수선하지 않게)
      worn.length
        ? h('ul', { class: 'kg-worn' }, ...slots.filter((w) => w.id).map((w) => {
          const code = w.id ? itemCodeOf(catalog, seasonId, w.id) : null;
          return h('li', { class: 'kg-worn-one' },
            itemArt(catalog, w.id, { base: app.base, label: w.name, gender, dj: dj.character }),
            h('span', { class: 'kg-worn-text' }, h('span', { class: 'kg-worn-slot' }, w.slotName), h('b', null, w.name),
              code ? h('button', { type: 'button', class: 'kg-worn-code', title: `${chatHint(code)} 복사`, onclick: () => copyCode(code) }, chatHint(code)) : null));
        }))
        : h('p', { class: 'empty' }, '아직 아무것도 입지 않았어요.'),
      slots.some((w) => !w.id) ? h('p', { class: 'kg-worn-free' }, h('b', null, '비어 있는 칸'), ' ', slots.filter((w) => !w.id).map((w) => (w.covered ? `${w.slotName}(${w.covered})` : w.slotName)).join(' · ')) : null),
    tryOn?.section,
    petSection(pets, app.base),
    othersSection(data, catalog, env),
    h('section', { class: 'kg-banner' },
      h('div', { class: 'kg-banner-text' }, h('b', null, `${dj.name} 키우기`), h('p', null, '이번 시즌 1~3등과 내 아이디 찾기는 DJ 키우기 페이지에 있어요.')),
      ilink(djLink, { class: 'btn btn-line' }, `${dj.name} 키우기 보기`, icon('arrow', { size: 16 })))].filter(Boolean));
  if (tryOn && location.hash === '#try') tryOn.open({ scroll: false });
}

// 같은 방송의 다른 캐릭터: DJ 페이지 1~3등 + 메인 인기·새로 꾸민 목록에서 이 방송 것(지난번 답이 있으면 바로, 없으면 받아서). 나는 빼고 여섯까지.
function othersSection(data, catalog, env) {
  const dj = data.dj || {}, me = String(data.id).normalize('NFC');
  const host = h('div', { class: 'kg-others-host' });
  const ctx = { app: env.app, catalog, seasonId: data.season?.id || null, season: data.season, lookOf: () => dj.character || null, djNameOf: () => dj.name || '' };
  let shownKey = null;
  const fill = () => {
    const page = fastApi.peekPage(dj.slug), home = fastApi.peekHome();
    const seen = new Set([me]), list = [];
    for (const p of [...(page?.top || []), ...(home?.popular || []), ...(home?.recent || [])]) {
      if (p.slug && p.slug !== dj.slug) continue;
      const id = String(p.id).normalize('NFC');
      if (seen.has(id)) continue;
      seen.add(id); list.push({ ...p, slug: dj.slug, djName: dj.name });
      if (list.length >= 6) break;
    }
    const k = JSON.stringify(list.map((c) => [c.id, c.worn, c.level, c.hearts]));
    if (k === shownKey) return;
    shownKey = k;
    host.replaceChildren(...(list.length ? [h('section', { class: 'kg-sec' },
      secHead(`${dj.name} 키우기의 다른 캐릭터`, '같은 방송에서 키우는 캐릭터예요. 마음에 들면 하트를 보내 보세요.'),
      h('div', { class: 'kg-swipe' }, ...list.map((c) => postCard(c, ctx, { showDj: false, rank: c.rank && c.rank <= 3 ? c.rank : null }))))] : []));
  };
  fill();
  const a = fastApi.page(dj.slug), b = fastApi.home();
  Promise.allSettled([a.fresh, b.fresh]).then(() => { if (host.isConnected) fill(); });
  return host;
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
