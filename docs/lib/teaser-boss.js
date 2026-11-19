// 예고 화면 "보스전 생중계 예시": 12월 1일부터 키우기.com 에서 볼 진짜 장면 모듈(kiugi/s2/battle/battle-scene.js — 시즌 2 사이트와 같은 파일)로
//  지어낸 한 판(teaser/boss-demo.json)을 되풀이해 튼다. 소리는 늘 끔(음악 파일을 받지 않는다).
//  · 그 칸이 화면 가까이 올 때 비로소 모듈·그림을 받는다(첫 화면이 무거워지지 않게).
//  · 화면 밖·숨긴 탭·멈춤 단추일 때는 멈춘다. 움직임 줄이기면 장면을 띄우지 않고 정지 그림(teaser/boss-demo.png)만 보여 준다.
//  · 모듈·대본·그림을 못 받아도 정지 그림이 그대로 남는다(단추는 숨김).
const here = (file) => new URL(file, import.meta.url).href;
export const BOSS_DEMO = Object.freeze({
  script: '../teaser/boss-demo.json',
  scene: '../kiugi/s2/battle/battle-scene.js',
  againMs: 4200,     // 결과 장면을 보여 준 뒤 처음부터 다시 틀기까지
  nearMargin: '300px 0px', // 화면에 닿기 이만큼 전부터 받기 시작
});

// 약한 휴대폰은 캔버스 배율·입자를 줄인다(시즌 2 사이트 boss-core.js sceneQuality 와 같은 기준 — 아이폰은 코어 수를 낮춰 말하므로 코어 수로 보지 않는다)
export function demoQuality(nav) {
  const cores = Number(nav?.hardwareConcurrency), mem = Number(nav?.deviceMemory);
  const ios = /iPad|iPhone|iPod/.test(String(nav?.userAgent || '')) || (nav?.platform === 'MacIntel' && nav?.maxTouchPoints > 1);
  const weak = (!ios && cores > 0 && cores <= 4) || (mem > 0 && mem <= 3);
  return { maxDpr: weak ? 1.5 : 2, particles: weak ? 0.5 : 1 };
}
// 지금 틀어도 되는지: 멈춤 단추 · 움직임 줄이기 · 화면 밖 · 숨긴 탭이면 쉰다
export const demoCanPlay = ({ paused, calm, visible, hidden }) => !paused && !calm && !!visible && !hidden;
// 단추 글(전쟁 지도 단추와 같은 말)
export const demoToggleText = ({ paused, calm }) => (calm ? '움직임 줄임' : paused ? '움직임 재생' : '움직임 멈추기');

export function startBossDemo(root, motion) {
  const frame = root.querySelector('.tz-bv-frame'), stage = root.querySelector('.tz-bv-stage'), toggle = root.querySelector('.tz-bv-toggle');
  if (!frame || !stage || !toggle || !('IntersectionObserver' in window)) { if (toggle) toggle.hidden = true; return; }
  const narrow = matchMedia('(max-width: 639px)');
  let paused = false, held = false, visible = false, near = false, failed = false;
  let ctl = null, wrap = null, loading = null, script = null, mod = null, again = 0, due = false;
  const can = () => !held && demoCanPlay({ paused, calm: motion.matches, visible, hidden: document.hidden });

  // 새 장면을 예전 장면 위에 띄우고, 다 뜬 뒤 예전 것을 치운다(다시 틀 때 깜빡이지 않게)
  async function mount() {
    if (!script) { const r = await fetch(here(BOSS_DEMO.script)); if (!r.ok) throw new Error('대본을 받지 못했어요'); script = await r.json(); }
    if (!mod) mod = await import(BOSS_DEMO.scene);
    const next = document.createElement('div');
    next.className = 'tz-bv-scene';
    stage.append(next);
    const opts = {
      sound: false, land: script.land, ...demoQuality(navigator),
      get orientation() { return narrow.matches ? 'portrait' : 'landscape'; }, // 휴대폰 폭은 세로 장면(글씨가 크게), 넓으면 가로 장면
      onEnd: () => { clearTimeout(again); again = setTimeout(() => { due = true; sync(); }, BOSS_DEMO.againMs); },
    };
    let c;
    try { c = await mod.playFight(next, script, opts); } catch (e) { next.remove(); throw e; }
    c.canvas.setAttribute('aria-hidden', 'true'); // 설명은 틀(role=img)의 이름이 한다
    try { ctl?.destroy(); } catch { /* 무시 */ }
    wrap?.remove();
    ctl = c; wrap = next;
    frame.classList.add('is-live');
  }
  function load() {
    if (loading || failed) return;
    due = false;
    loading = mount().catch(() => { if (!ctl) { failed = true; toggle.hidden = true; } }).finally(() => { loading = null; sync(); });
  }
  function sync() {
    toggle.disabled = motion.matches;
    toggle.textContent = demoToggleText({ paused, calm: motion.matches });
    toggle.setAttribute('aria-pressed', String(paused || motion.matches));
    const play = can();
    if (ctl) ctl.pause(!play);
    if (failed || loading) return;
    if (!ctl ? (near && !motion.matches && !paused && !document.hidden) : (play && due)) load();
  }
  toggle.addEventListener('click', () => { paused = !paused; sync(); });
  motion.addEventListener('change', sync);
  narrow.addEventListener('change', () => { try { ctl?.layout(); } catch { /* 무시 */ } });
  document.addEventListener('visibilitychange', sync);
  new IntersectionObserver(([e]) => { near = e.isIntersecting; sync(); }, { rootMargin: BOSS_DEMO.nearMargin }).observe(frame);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }).observe(frame);
  // 화면 찍는 도구가 장면을 그 시각에 세울 수 있게(tools — 화면에는 영향 없음)
  frame.tzDemo = { get ctl() { return ctl; }, hold(v = true) { held = !!v; clearTimeout(again); sync(); } };
  sync();
}
