// 캐릭터 카드·DJ 카드·그림 칸(메인·DJ 페이지·찾기 결과가 함께 쓴다). DOM 은 함수 안에서만 쓴다(노드 시험에서 이 파일을 불러 글 도우미를 쓴다).
// 그림은 화면 가까이 왔을 때 그린다(그림 파일이 커서 휴대폰 메모리를 아끼려고).
// 카드 모양(styles.css): 패션 앱 상품 카드 — 위는 부드러운 무대 위 캐릭터(세로 3:4로 잘라 크게), 아래는 글 세 줄(어느 방송 · 아이디 · 레벨과 하트).
import { h, icon, toast } from '../lib/dom.js';
import { characterMarkup, itemMarkup, expressionFor, paintMarkup, splitScene, svgNode, motionOf, petStage, MOTIONS_READY } from '../lib/kiugi-draw.js';
import { ilink, medal } from './common.js';

export const baseOf = (id) => String(id ?? '').split('#')[0];
const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
export const heartText = (n) => `♥ ${fmt(n)}`;
// 카드 한 줄 글: 레벨과 표정 이름만(애정도 숫자는 보이지 않는다)
export const levelLine = (catalog, seasonId, level) => `Lv.${level} ${expressionFor(catalog, seasonId, level).name}`;

// 아이디 글: 앞 부분은 크게, "#캐릭터 이름"은 작게(읽으면 그대로 "밤톨#먼치")
export function idText(id) {
  const s = String(id ?? ''), i = s.indexOf('#');
  return i < 0 ? [s] : [s.slice(0, i), h('span', { class: 'kg-id-tag' }, s.slice(i))];
}
// 하트 수(작은 하트 그림 + 숫자). 화면 읽기에는 "하트 n개"
export function heartCount(n, { className = '' } = {}) {
  return h('span', { class: 'kg-hearts' + (className ? ' ' + className : ''), 'aria-label': `하트 ${fmt(n)}개` },
    icon('heart', { size: 14, filled: true }), h('span', { 'aria-hidden': 'true' }, fmt(n)));
}

// ---- 숨쉬기·모션(2026-10-15 사용자 "캐릭터들이 2D 게임 대기 모션처럼 숨쉬듯이" · "청취자들이 모션을 살 수 있게") ----
// 캐릭터 무대 = .kg-stage > svg.kg-scene(바탕·입은 배경 — 가만히, 없으면 없음) + .kg-actor(무대 그림 칸과 같은 자리·크기 = 1024 캔버스)
//   .kg-actor > .kg-body(캐릭터 — 숨쉬기 또는 모션, 발끝 기준) > svg + .kg-fx.on-body(캐릭터와 같이 움직이는 효과: 눈물·가슴 하트·땀·머리 둘레 별)
//             > .kg-fx.around(캐릭터 둘레에 떠 있는 효과: 음표·떨어지는 쓰레기·💢·반짝이)
// 움직임은 모두 styles.css 의 CSS 애니메이션(transform·opacity — 그림을 다시 그리지 않는다, 자바스크립트 반복 없음).
// 효과 자리는 캔버스 1024 기준 퍼센트(예전 그림체 V5 의 눈 482·540/230, 아래 눈꺼풀 241, 가슴 511/385, 발 바닥 956 — 남녀 같은 자리)라 칸 크기와 관계없이 같은 곳.
//  (새 그림체 R7 은 얼굴이 더 위·작다 — 모션을 다시 켤 때(MOTIONS_READY) R7 기준점 anchors 로 다시 맞춘다. 지금은 모션이 꺼져 있어 보이지 않는다.)
// 숨쉬기는 카드마다 박자를 조금씩 어긋나게(kg-b0~4 — 칸이 여럿이어도 한꺼번에 숨쉬지 않게). 동작 줄이기 설정이면 모두 멈춘다(styles.css).
// 모션 효과: [클래스(첫 낱말 = kg-fx-<이름>), 그림]. 그림은 Codex 효과 그림(2026-10-15 패키지 DJ_MOTION_S1_20261015_BLINK_FX — kiugi/motion/fx_*.png, 256² 투명).
//  모르는 모션은 효과 없이 숨쉬기만. 울기의 눈물 시작은 우는 눈 그림(<눈>_cry.png)에 있고, 떨어지는 방울만 fx_tear.
const FX = Object.freeze({
  dance: { around: [['note n1', 'fx_note_1'], ['note n2', 'fx_note_2'], ['note n3', 'fx_note_2'], ['note n4', 'fx_note_1']] },
  heart: { body: [['rise r1', 'fx_heart_2'], ['rise r2', 'fx_heart_1'], ['rise r3', 'fx_heart_2'], ['chest', 'fx_heart_1']] },
  cry: { body: [['tear e1 d1', 'fx_tear_2'], ['tear e1 d2', 'fx_tear_1'], ['tear e2 d1', 'fx_tear_2'], ['tear e2 d2', 'fx_tear_1']] },
  squat: { body: [['sweat', 'fx_sweat']] },
  trash: { body: [['dizzy', 'fx_dizzy']], around: [['trash k1', 'fx_trash_can'], ['trash k2', 'fx_trash_banana'], ['trash k3', 'fx_trash_paper'], ['trash k4', 'fx_trash_sock'], ['trash k5', 'fx_trash_fishbone'], ['pop', 'fx_anger']] },
  kkang: { around: [['spark s1', 'fx_sparkle_1'], ['spark s2', 'fx_sparkle_2'], ['spark s3', 'fx_sparkle_1']] },
});
export const MOTION_FX = Object.keys(FX);
export const MOTION_EFFECTS = FX;
// 모션 그림이 있는 곳(사이트 주소 앞부분 + kiugi/motion/) — 캐릭터 그림의 눈 주소에서 앞부분을 따온다(없으면 사이트 맨 앞)
const motionDir = (prefix) => `${prefix || '/'}kiugi/motion/`;
const fxNodes = (list, prefix) => (list || []).map(([cls, name]) => h('span', { class: cls.split(' ').map((c, i) => (i ? c : 'kg-fx-' + c)).join(' ') },
  h('img', { src: motionDir(prefix) + name + '.png', alt: '', decoding: 'async', draggable: 'false' })));
// 눈 깜빡임·우는 눈(2026-10-15 Codex 패키지 — kiugi/motion/<원래 눈>_closed.png · _cry.png, 원래 눈과 같은 1024 캔버스·자리):
//  원래 눈(kg-eye-open)은 그대로 두고 그 뒤에 감은 눈·우는 눈을 같은 자리에 더한다. 한 번에 하나만 보인다(styles.css — 감은 눈이 보일 때 열린 눈은 숨긴다, 덧그리지 않는다).
//  이 그림(motion/)은 예전 그림체 V5 의 눈이라 새 그림체 R7 의 눈(kiugi/r7/)에는 붙이지 않는다(주소가 kiugi/v5/ 일 때만 — R7 눈은 감은 눈 그림이 아직 없다.
//   우는 눈은 R7 레벨 표정 판 eyes:cry 로 그림에 있다). 모션을 다시 켤 때(MOTIONS_READY) R7 감은 눈 그림을 받아 여기를 고친다.
function addEyeStates(svg) {
  const open = svg?.querySelector?.('image[data-step="eyes"]');
  if (!open) return null;
  const href = open.getAttribute('href') || open.getAttribute('xlink:href') || '';
  const m = /^(.*?)kiugi\/v5\/((?:female|male)_eyes_\d\d)\.png/.exec(href);
  if (!m) return null;
  open.classList.add('kg-eye-open');
  let at = open;
  for (const state of ['closed', 'cry']) {
    const img = open.cloneNode(false);
    img.setAttribute('href', `${motionDir(m[1])}${m[2]}_${state}.png`);
    img.removeAttribute('xlink:href');
    img.setAttribute('class', 'kg-eye-' + state);
    img.removeAttribute('data-step');
    at.after(img); at = img;
  }
  return m[1];
}
// 캐릭터 칸(.kg-actor)의 모션을 바꾼다: id = 모션 id(시즌 목록에서 확인한 것) 또는 null(숨쉬기만). 다시 그리지 않고 클래스·효과만 바꾼다.
export function setActorMotion(actor, id = null) {
  if (!actor) return;
  for (const c of [...actor.classList]) if (c.startsWith('m-')) actor.classList.remove(c);
  if (id) actor.classList.add('m-' + id);
  const fx = (id && FX[id]) || {}, prefix = actor.dataset?.kgPrefix || '/';
  actor.querySelector('.kg-fx.on-body')?.replaceChildren(...fxNodes(fx.body, prefix));
  actor.querySelector('.kg-fx.around')?.replaceChildren(...fxNodes(fx.around, prefix));
}
// 무대 안 캐릭터 칸의 모션 바꾸기(아직 그리는 중이면 아무것도 하지 않는다 — 다 그린 뒤 그때의 모션으로 그린다)
export const setStageMotion = (stage, id = null) => setActorMotion(stage?.querySelector?.(':scope > .kg-actor'), id);
// 캐릭터 그림 글 → 무대에 넣을 요소 [바탕 SVG(없으면 null), 캐릭터 칸]. 읽지 못하면 null(paintMarkup 이 대신 글을 넣는다).
//  사용자 10/15 밤 "모션은 그만 — 가만히": 캐릭터는 움직이지 않는다. 감은 눈·우는 눈은 표정을 쓸 때(MOTIONS_READY)만 더한다(안 쓰는 그림을 받지 않게).
export function actorNodes(markup, { motion = null } = {}) {
  const { scene, body } = splitScene(markup);
  const art = svgNode(body);
  if (!art) return null;
  const prefix = MOTIONS_READY ? addEyeStates(art) : null;
  const backdrop = scene ? svgNode(scene) : null;
  backdrop?.classList.add('kg-scene');
  // 여자 몸 그림이면 is-f(styles.css — 무대에서 남자와 키 차이가 나게 조금 줄인다)
  const female = /female_body\.png/.test(body);
  const actor = h('div', { class: 'kg-actor' + (female ? ' is-f' : ''), ...(prefix !== null ? { 'data-kg-prefix': prefix } : {}) },
    h('div', { class: 'kg-body' }, art, h('span', { class: 'kg-fx on-body', 'aria-hidden': 'true' })),
    h('span', { class: 'kg-fx around', 'aria-hidden': 'true' }));
  setActorMotion(actor, motion);
  return [backdrop, actor];
}

let observer = null;
// 그림 칸: make() 가 SVG 글을 돌려준다. eager 면 바로, 아니면 화면 가까이 왔을 때. kind: 무대 모양(styles.css .kg-stage.<kind>)
//  그림 V3(2026-10-09): 그림 파일을 모두 받은 뒤 한 번에 넣는다(paintMarkup — 반쯤 그려진 모습이 보이지 않게).
//  actor: 캐릭터 그림이면 true — 바탕과 캐릭터를 나눠 캐릭터만 숨쉬게(motion = 모션 id). 옷 한 벌 그림(옷 도감 칸)은 움직이지 않는다.
export function lazyStage(make, label, { eager = false, kind = '', actor = false, motion = null } = {}) {
  const stage = h('div', { class: 'kg-stage' + (kind ? ' ' + kind : '') });
  const noart = () => h('span', { class: 'kg-noart' }, label);
  const draw = () => {
    let markup = null;
    try { markup = make(); } catch (e) { console.error(e); }
    if (!markup) { stage.replaceChildren(noart()); return; }
    paintMarkup(stage, markup, { fallback: noart(), ...(actor ? { make: (m) => actorNodes(m, { motion }) } : {}) }).catch((e) => { console.error(e); stage.replaceChildren(noart()); });
  };
  if (eager || typeof IntersectionObserver !== 'function') { draw(); return stage; }
  observer ||= new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { observer.unobserve(e.target); e.target.kgDraw?.(); }
  }, { rootMargin: '400px 400px' });
  stage.kgDraw = draw;
  observer.observe(stage);
  return stage;
}
// DJ 캐릭터에 옷을 입힌 그림(바탕 없이 — 무대는 styles.css). 캐릭터 칸은 세로(char)로 잘라 크게 보인다. kind: 무대 모양 더하기(hero·bare 등)
//  캐릭터는 늘 숨쉰다. motion: 그 사람이 하는 모션 id(먼치킨이 보낸 것 — 시즌 목록에 있는 것만, 모르면 숨쉬기만)
export function art(catalog, character, worn, level, { seasonId = null, base = '/', label = '', eager = false, kind = '', motion = null } = {}) {
  const cls = 'char' + (kind ? ' ' + kind : '');
  if (!character) return h('div', { class: 'kg-stage ' + cls }, h('span', { class: 'kg-noart' }, label));
  return lazyStage(() => characterMarkup(catalog, character, worn, level, { seasonId, base, label, stage: null }), label, { eager, kind: cls, actor: true, motion: MOTIONS_READY ? motionOf(catalog, motion)?.id || null : null });
}
// ---- 함께하는 펫(캐릭터 페이지 무대 · 입혀 보기 · 메인 카드 · 메인 첫 화면 1등 — 2026-10-16 사용자 "펫 좀 크게 · 메인 화면에서도 보이게") ----
// 펫 그림(2026-10-15 Codex 패키지 DJ_PET_S1_20261015_HALLOWEEN): pets/<시즌>/pet_<id>_<단계>.png — 512×512 투명, 모든 단계가 같은 바닥선(y=470)·같은 배율이라
//  단계가 오를수록 커 보인다(따로 늘리지 않는다). 못 만난 펫은 1단계 그림 모양만 옅게(실루엣 — styles.css). 그림을 못 읽으면 그림 글자(emoji)로.
export const stars = (n) => '★'.repeat(n);
export const petImageUrl = (pet, stage, base = '') => `${base}pets/${pet.season}/pet_${pet.id}_${Math.min(5, Math.max(1, stage || 1))}.png`;
export function petImage(pet, base, { cls = '', eager = false } = {}) {
  const img = h('img', { class: 'kg-pet-img' + (cls ? ' ' + cls : ''), src: petImageUrl(pet, pet.stage, base), alt: '', width: 512, height: 512, decoding: 'async', ...(eager ? {} : { loading: 'lazy' }) });
  img.addEventListener('error', () => img.replaceWith(h('span', { class: 'kg-pet-emoji', 'aria-hidden': 'true' }, pet.emoji)), { once: true });
  return img;
}
// 먼치킨이 보낸 함께하는 펫 {id, stage} → 그릴 펫 {id, season, emoji, name(단계 이름), stage}. 시즌 목록에 없는 펫·틀린 단계면 null(그리지 않는다).
export function buddyOf(catalog, pet) {
  const pets = catalog?.pets, id = pet?.id, stage = pet?.stage;
  if (!pets || typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(pets, id) || !Number.isInteger(stage) || stage < 1 || stage > 5) return null;
  const p = pets[id];
  return { id: p.id, season: p.season, emoji: p.emoji, name: petStage(p, stage), stage };
}
// 함께하는 펫: 캐릭터 오른쪽 아래에 선다(styles.css 가 칸마다 크기·자리를 정한다). label 이 true 면 그림 아래 이름·★(캐릭터 페이지),
//  false 면 그림만(카드·메인 첫 화면 — 작은 칸이라 이름표가 캐릭터를 가리지 않게. 이름은 마우스를 올리면·화면 읽기로).
export function petBuddy(pet, base, { label = true, eager = true } = {}) {
  if (!pet) return null;
  const text = `함께하는 펫 ${pet.name} ${stars(pet.stage)}`;
  // st1~st5: 단계마다 그림 양옆 빈 칸이 달라(★1 은 512 중 가운데 35%만) 칸을 얼마나 내보낼지 styles.css 가 단계로 정한다
  return h('figure', { class: 'kg-pet-buddy st' + Math.min(5, Math.max(1, pet.stage || 1)) + (label ? '' : ' bare'), title: text, ...(label ? {} : { 'aria-label': text }) },
    petImage(pet, base, { eager }),
    label ? h('figcaption', { class: 'kg-pet-name' }, pet.name, h('i', null, stars(pet.stage))) : null);
}

// 옷 한 벌 그림(옷 도감·입은 옷). dj: DJ 캐릭터(성별이 같으면 그 얼굴·머리로 입혀 보인다). tall: 세로 칸(전신 의상 — 양옆 빈 곳만 잘라 크게)
export function itemArt(catalog, id, { base = '/', label = '', gender = 'f', dj = null, tall = false } = {}) {
  return lazyStage(() => itemMarkup(catalog, id, { base, label, gender, dj }), label, { kind: tall ? 'item tall' : 'item' });
}

// 캐릭터 카드 {slug, djName, id, level, worn, pet?, hearts} → 캐릭터 페이지로 가는 링크. rank: 몇 등(1~3등은 금·은·동 배지)
// label: 맨 위 작은 줄(없으면 "<DJ> 키우기", showDj 가 false 면 없음). pet: 함께하는 펫(있으면 그림 오른쪽 아래 — 2026-10-16)
export function characterCard(c, { app, catalog, character, seasonId, showDj = true, eager = false, rank = null, label = null }) {
  const href = app.link({ name: 'character', slug: c.slug, base: baseOf(c.id) });
  const pet = character ? buddyOf(catalog, c.pet) : null;
  return ilink(href, { class: 'kg-card' + (rank ? ` ranked r${Math.min(rank, 4)}` : '') },
    h('div', { class: 'kg-card-media' + (pet ? ' has-pet' : '') },
      art(catalog, character, c.worn, c.level, { seasonId, base: app.base, label: `${c.id} 캐릭터`, eager }),
      pet ? petBuddy(pet, app.base, { label: false, eager }) : null,
      rank ? medal(rank, { className: 'kg-rank-badge', label: `${rank}등` }) : null),
    h('div', { class: 'kg-card-info' },
      label ? h('span', { class: 'kg-card-dj' + (rank === 1 ? ' accent' : '') }, label) : showDj && c.djName ? h('span', { class: 'kg-card-dj' }, `${c.djName} 키우기`) : null,
      h('b', { class: 'kg-card-id' }, ...idText(c.id)),
      h('span', { class: 'kg-card-meta' },
        h('span', { class: 'kg-card-lv' }, h('b', null, `Lv.${c.level ?? 1}`), ' ', expressionFor(catalog, seasonId, c.level).name),
        heartCount(c.hearts))));
}

// DJ 카드 {slug, name, character, count} → DJ 키우기 페이지로 가는 링크
export function djCard(d, { app, catalog, seasonId }) {
  return ilink(app.link({ name: 'kiugi', slug: d.slug }), { class: 'kg-card kg-dj' },
    h('div', { class: 'kg-card-media' },
      art(catalog, d.character, {}, 1, { seasonId, base: app.base, label: `${d.name} 캐릭터`, kind: 'dj' })),
    h('div', { class: 'kg-card-info' },
      h('span', { class: 'kg-card-dj' }, 'DJ 캐릭터'),
      h('b', { class: 'kg-card-id' }, `${d.name} 키우기`),
      h('span', { class: 'kg-card-meta' },
        h('span', { class: 'kg-card-lv' }, `청취자 ${fmt(d.count)}명`),
        h('span', { class: 'kg-card-go', 'aria-hidden': 'true' }, icon('arrow', { size: 16 })))));
}

// 링크 복사: 클립보드가 되면 복사, 안 되면 주소 칸을 보여 주고 글자를 골라 둔다(길게 눌러 복사)
export async function copyLink(url, box) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('no clipboard');
    await navigator.clipboard.writeText(url);
    toast('링크를 복사했어요. 원하는 곳에 붙여 넣어 주세요.');
    return true;
  } catch {
    const input = h('input', { type: 'text', class: 'kg-copy-input', readonly: true, 'aria-label': '이 캐릭터 링크' });
    input.value = url;
    box.replaceChildren(input, h('p', { class: 'note' }, '복사하지 못했어요. 위 주소를 길게 눌러 복사해 주세요.'));
    input.focus(); input.select();
    try { input.setSelectionRange(0, url.length); } catch { /* 일부 브라우저 */ }
    return false;
  }
}
