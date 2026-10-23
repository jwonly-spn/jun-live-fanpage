// 그림 칸(캐릭터 무대 SVG · 옷 한 벌 · 함께하는 펫)과 글 도우미 — 캐릭터 페이지·옷 도감·입혀 보기·큰 사진 카드(views/feed.js)가 함께 쓴다.
// DOM 은 함수 안에서만 쓴다(노드 시험에서 이 파일을 불러 글 도우미를 쓴다). 그림은 화면 가까이 왔을 때 그린다(그림 파일이 커서 휴대폰 메모리를 아끼려고).
import { h, icon, toast } from '../lib/dom.js';
import { characterMarkup, itemMarkup, expressionFor, paintMarkup, splitScene, svgNode, motionOf, petStage, preloadImage, MOTIONS_READY } from '../lib/kiugi-draw.js';
import { svgUrls } from '../kiugi/kiugi-art.js';
import { loadLite, liteUrl, photoBox, itemPlanOf } from '../lib/raster.js';
import { upgradeStage } from '../lib/kiugi-hd.js';

export const baseOf = (id) => String(id ?? '').split('#')[0];
const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
export const heartText = (n) => `♥ ${fmt(n)}`;
// 카드 한 줄 글: 레벨과 (보이는) 표정 이름만(애정도 숫자는 보이지 않는다) — exp: 고른 표정(열려 있으면 그 이름)
export const levelLine = (catalog, seasonId, level, exp = null) => `Lv.${level} ${expressionFor(catalog, seasonId, level, exp).name}`;

// 아이디 글: 앞 부분은 크게, "#캐릭터 이름"은 작게(읽으면 그대로 "밤톨#먼치")
export function idText(id) {
  const s = String(id ?? ''), i = s.indexOf('#');
  return i < 0 ? [s] : [s.slice(0, i), h('span', { class: 'kg-id-tag' }, s.slice(i))];
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

// 그림 글의 그림 주소를 가벼운 사본으로(있는 것만 — lib/raster.js liteUrl)
export async function liteMarkup(markup, base = '/') {
  const lite = await loadLite(base);
  return String(markup).replace(/ href="([^"]+)"/g, (all, u) => { const l = liteUrl(u, lite, base); return l === u ? all : ` href="${l}"`; });
}
// ---- 큰 무대(고해상도) 그리기 — 2026-10-19 "눈 깜빡임" 고침 ----
//  R9 의 웃는 눈(eyes_*_smile)은 호환 그림이 감은 초승달 눈, 고해상도 그림이 뜬 눈이라 호환 그림 → 고해상도로 바뀔 때 눈을 감았다 뜨는 것처럼 보였다
//  (그림 원본 차이는 Codex 에 부탁 — 여기서는 바뀌는 순간이 보이지 않게만 한다):
//   · 새 캐릭터 칸은 숨긴 채(is-pending) 무대에 얹고 고해상도를 그린다 — 다 되면 고해상도로 바로 보인다(호환 그림은 보이지 않는다).
//     무대에는 그동안 은은한 자리 표시(is-holding). HD_HOLD_MS 안에 안 되면 호환 그림을 보이고, 고해상도가 오면 살며시 겹친다(canvas.is-late).
//     고해상도를 쓸 수 없는 조합·데이터 절약 모드·실패·보이지 않는 칸이면 바로 호환 그림.
//   · 이미 그려진 무대를 다시 그릴 때(입혀 보기에서 옷을 바꿀 때 · 새 답의 모습이 다를 때)는 옛 캐릭터(고해상도)를 그대로 두고, 새 캐릭터가 준비되면 바꿔 끼운다
//     (옛 그림을 지우고 호환 그림을 다시 보이지 않는다). 기다리는 시간은 조금 더 길게(HD_SWAP_MS — 그동안 옛 모습이 보인다).
//   · 보이는 동안 한 번만 살며시 나타난다(is-shown): 같은 무대 칸을 화면에 다시 붙여도(캐릭터 페이지가 새 답으로 다시 그릴 때) 다시 나타나지 않는다.
//   · 처음 그릴 때도 바탕(입은 배경 장면)은 캐릭터와 함께 나타난다(2026-10-19 사용자 "로딩하는 것처럼 다른 사진이 나왔다 바뀐다" — 예전에는
//     빈 무대 → 펫 → 배경만 → 캐릭터 → 고해상도로 여러 번 바뀌어 보였다). 그 전까지 무대는 자리 표시만(styles.css .is-hd-stage:not(.is-shown)), 펫도 함께 숨긴다.
//     기다리는 시간도 조금 늘려(1.8 → 2.5초) 휴대폰에서도 고해상도가 먼저 오면 한 번에 보이게 했다.
export const HD_HOLD_MS = 2500, HD_SWAP_MS = 2600;
export async function paintHdStage(stage, markup, { motion = null, hd = null, fallback = null, load = preloadImage, hold = HD_HOLD_MS, swap = HD_SWAP_MS } = {}) {
  const seq = (stage.kgPaintSeq || 0) + 1;
  stage.kgPaintSeq = seq;
  const failed = [];
  await Promise.all(svgUrls(markup).map((u) => Promise.resolve().then(() => load(u)).catch(() => { failed.push(u); })));
  if (stage.kgPaintSeq !== seq) return false;
  const nodes = actorNodes(markup, { motion });
  if (!nodes) { stage.replaceChildren(...(fallback ? [fallback] : [])); return true; }
  const [backdrop, actor] = nodes;
  const old = [...stage.children].filter((el) => !el.classList.contains('kg-stage-keep'));
  const hadActor = old.some((el) => el.classList.contains('kg-actor'));
  actor.classList.add('is-pending');
  // 바탕(입은 배경 장면)도 캐릭터와 함께 보인다(처음 그릴 때도 · 다시 그릴 때도 — 배경만 먼저 보였다가 캐릭터가 나타나 그림이 여러 번 바뀌어 보이지 않게)
  if (backdrop) backdrop.classList.add('is-pending');
  if (!hadActor) { stage.replaceChildren(...[backdrop, actor].filter(Boolean)); stage.classList.add('is-holding'); }
  else stage.append(...[backdrop, actor].filter(Boolean));
  if (failed.length) stage.dataset.kgArtError = String(failed.length); else delete stage.dataset.kgArtError;
  let shown = false, timer = 0;
  const reveal = () => {
    if (shown || stage.kgPaintSeq !== seq) return;
    shown = true; clearTimeout(timer);
    for (const el of old) if (el.parentNode === stage) { el.remove(); el.querySelectorAll?.('canvas.kg-hd').forEach((c) => { c.width = 0; c.height = 0; }); }
    stage.classList.remove('is-holding');
    for (const el of [backdrop, actor]) if (el) {
      el.classList.remove('is-pending');
      // 처음이면 살며시 나타나고(한 번만), 바꿔 끼울 때는 바로(옛 모습과 같은 자리라 그대로 이어진다)
      if (!hadActor && !stage.classList.contains('is-shown')) el.classList.add('is-revealing');
    }
    stage.classList.add('is-shown');
    stage.dispatchEvent(new CustomEvent('kg-stage-shown'));
  };
  actor.addEventListener('animationend', () => actor.classList.remove('is-revealing'));
  backdrop?.addEventListener('animationend', () => backdrop.classList.remove('is-revealing'));
  timer = setTimeout(reveal, hadActor ? swap : hold);
  if (hd) upgradeStage(stage, { ...hd, actor, onState: () => reveal() });
  else reveal();
  return true;
}

let observer = null;
// 그림 칸: make() 가 SVG 글을 돌려준다. eager 면 바로, 아니면 화면 가까이 왔을 때. kind: 무대 모양(styles.css .kg-stage.<kind>)
//  그림 V3(2026-10-09): 그림 파일을 모두 받은 뒤 한 번에 넣는다(paintMarkup — 반쯤 그려진 모습이 보이지 않게).
//  actor: 캐릭터 그림이면 true — 바탕과 캐릭터를 나눠 캐릭터만 숨쉬게(motion = 모션 id). 옷 한 벌 그림(옷 도감 칸)은 움직이지 않는다.
//  lite: 사이트 BASE — 주면 공통 배경 그림을 가벼운 사본(docs/kiugi-lite/ WebP — 1.5MB → 0.15MB)으로 바꿔 그린다. 사본을 못 받으면 원본으로 다시 그린다.
//  hd: 큰 무대(캐릭터 페이지 전신 · 캐릭터 옷장 현재 모습)면 {character, worn, level, exp, catalog, seasonId, base} — 고해상도로 그린다(위 paintHdStage · lib/kiugi-hd.js)
export function lazyStage(make, label, { eager = false, kind = '', actor = false, motion = null, lite = null, hd = null } = {}) {
  const stage = h('div', { class: 'kg-stage' + (kind ? ' ' + kind : '') + (hd && actor ? ' is-hd-stage' : '') });
  const noart = () => h('span', { class: 'kg-noart' }, label);
  const draw = async () => {
    let markup = null;
    try { markup = make(); } catch (e) { console.error(e); }
    if (!markup) { stage.replaceChildren(noart()); return; }
    const opts = { fallback: noart(), ...(actor ? { make: (m) => actorNodes(m, { motion }) } : {}) };
    try {
      const light = lite ? await liteMarkup(markup, lite) : markup;
      if (hd && actor) {
        // 배경 사본을 못 받으면 원본으로(그림을 다 받은 뒤 한 번에)
        const ok = await Promise.all(svgUrls(light).map((u) => preloadImage(u).then(() => true, () => false)));
        await paintHdStage(stage, ok.every(Boolean) ? light : markup, { motion, hd, fallback: noart() });
        return;
      }
      let done = await paintMarkup(stage, light, opts);
      if (light !== markup && stage.dataset.kgArtError) done = await paintMarkup(stage, markup, opts);
    } catch (e) { console.error(e); stage.replaceChildren(noart()); }
  };
  stage.kgRepaint = (nextMake, nextHd) => { make = nextMake; hd = nextHd; return draw(); };
  if (eager || typeof IntersectionObserver !== 'function') { draw(); return stage; }
  // 휴대폰(좁은 화면)은 보이는 곳 가까이(120px)만 미리 그린다 — 칸마다 SVG 필터·마스크라 한꺼번에 많이 그리면 아이폰 사파리가 메모리로 페이지를 죽인다(2026-10-20)
  observer ||= new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { observer.unobserve(e.target); e.target.kgDraw?.(); }
  }, { rootMargin: (typeof innerWidth === 'number' && innerWidth <= 720) ? '120px 0px' : '400px 400px' });
  stage.kgDraw = draw;
  observer.observe(stage);
  return stage;
}
// DJ 캐릭터에 옷을 입힌 그림(바탕 없이 — 무대는 styles.css). 캐릭터 칸은 세로(char)로 잘라 크게 보인다. kind: 무대 모양 더하기(hero·bare 등)
//  캐릭터는 늘 숨쉰다. motion: 그 사람이 하는 모션 id(먼치킨이 보낸 것 — 시즌 목록에 있는 것만, 모르면 숨쉬기만)
//  hd: true 면 큰 무대 — 고해상도(R9 원본 그림 — lib/kiugi-hd.js · 위 paintHdStage)로 그린다. 카드·목록 같은 작은 칸은 쓰지 않는다(자료를 아끼게).
//  exp: 고른 표정(먼치킨 !표정 — 열려 있으면 그 표정, 아니면 레벨 표정)
//  큰 무대는 stage.kgRedraw(worn, level, exp) 로 같은 칸에 다시 그린다(옛 모습을 둔 채 새 모습이 준비되면 바꿔 끼운다).
export function art(catalog, character, worn, level, { seasonId = null, base = '/', label = '', eager = false, kind = '', motion = null, hd = false, exp = null } = {}) {
  const cls = 'char' + (kind ? ' ' + kind : '');
  if (!character) return h('div', { class: 'kg-stage ' + cls }, h('span', { class: 'kg-noart' }, label));
  const makeOf = (w, l, x) => () => characterMarkup(catalog, character, w, l, { seasonId, base, label, stage: null, exp: x });
  const hdOf = (w, l, x) => (hd ? { character, worn: w, level: l, exp: x, catalog, seasonId, base } : null);
  const stage = lazyStage(makeOf(worn, level, exp), label,
    { eager, kind: cls, actor: true, motion: MOTIONS_READY ? motionOf(catalog, motion)?.id || null : null, lite: base, hd: hdOf(worn, level, exp) });
  stage.kgRedraw = (w, l, x = null) => stage.kgRepaint(makeOf(w, l, x), hdOf(w, l, x));
  return stage;
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

// 옷 한 벌 그림(옷 도감·입은 옷·입혀 보기 칸·옷 TOP 5). dj: DJ 캐릭터(성별이 같으면 그 얼굴·머리로 입혀 보인다). tall: 세로 칸(전신 의상 — 양옆 빈 곳만 잘라 크게)
//  2026-10-23: 그림이 있는 옷은 캔버스로 칸 크기만큼만 그린 작은 사진(lib/raster.js photoBox · item)으로 — 예전 SVG(캐릭터 전체 + 필터·마스크를 당겨 보이기)는
//  아이폰 사파리가 신발·모자 칸에서 메모리를 넘겨 페이지를 죽였다(raster.js 맨 위 설명). 사진을 못 만들면 이름 자리 표시.
//  그림이 없는 옷(예전 그림의 옷 id — 이름 자리 표시 SVG, 그림 파일 없음)만 예전처럼 SVG.
export function itemArt(catalog, id, { base = '/', label = '', gender = 'f', dj = null, tall = false } = {}) {
  const it = itemPlanOf(id, { gender, dj, tall });
  if (it) {
    const stage = h('div', { class: 'kg-stage item' + (tall ? ' tall' : '') });
    stage.append(photoBox({ item: { id, gender, dj, tall }, character: it.face, base, kind: 'item' },
      { onFail: (box) => box.replaceWith(h('span', { class: 'kg-noart' }, label)) }));
    return stage;
  }
  // 배경 옷은 가벼운 사본(WebP)으로 — 옷 도감·TOP 5 에 배경 열 장이 다 나와도 1.5MB 씩 받지 않게
  return lazyStage(() => itemMarkup(catalog, id, { base, label, gender, dj }), label, { kind: tall ? 'item tall' : 'item', lite: base });
}

// 메인·DJ 페이지·찾기 결과의 큰 사진 카드는 views/feed.js postCard(2026-10-18 새 구조 — 예전 작은 카드 characterCard·djCard 는 없앴다).

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
