// 첫 화면 "전쟁 지도": Codex 대륙 그림 위에 지어낸 DJ 6명의 땅이 하루씩(3.2초) 번져 간다. 31일이 지나면 처음부터.
//  그리기는 시즌 2 사이트와 같은 MapStage(teaser-war-draw.js) · 흉내는 teaser-war-sim.js.
//  화면 밖·숨긴 탭·움직임 줄이기·멈춤 단추일 때는 멈춘다.
import { h } from './dom.js';
import { loadMapArt, MapStage } from './teaser-war-draw.js';
import { createWar, LAST_DAY } from './teaser-war-sim.js';
import { pctText } from './teaser-war-core.js';

export async function startMap(root, motion) {
  const host = root.querySelector('.tz-war-stage');
  if (!host) return;
  const art = await loadMapArt('/');
  const stage = new MapStage(host, { art });
  const war = createWar({ land: art?.grid?.land || null });
  const toggle = root.querySelector('.tz-war-toggle'), dayEl = root.querySelector('.tz-war-day'), newsEl = root.querySelector('.tz-war-news');
  const dot = root.querySelector('.tz-live');
  let timeout = 0, paused = false, visible = true;

  function show(animate) {
    stage.setMap(war.map(), { animate });
    const rank = war.ranking();
    stage.setLabel(`예시 지도 12월 ${war.day()}일: ` + rank.map((r) => `${r.name} ${pctText(r.pct)}`).join(', '));
    dayEl.textContent = `12월 ${war.day()}일`;
    newsEl.replaceChildren(...war.news().slice(0, 2).map((t) => h('li', {}, t)));
  }
  const canPlay = () => !paused && !motion.matches && visible && !document.hidden;
  function schedule() {
    clearTimeout(timeout);
    if (canPlay()) timeout = setTimeout(advance, war.day() >= LAST_DAY ? 6000 : 3200);
  }
  function advance() {
    if (!canPlay()) return;
    if (!war.step()) war.reset();
    show(true);
    schedule();
  }
  function sync() {
    clearTimeout(timeout);
    toggle.disabled = motion.matches;
    toggle.textContent = motion.matches ? '움직임 줄임' : paused ? '움직임 재생' : '움직임 멈추기';
    toggle.setAttribute('aria-pressed', String(paused || motion.matches));
    dot.classList.toggle('is-paused', paused || motion.matches);
    schedule();
  }
  show(false);
  sync();
  toggle.addEventListener('click', () => { paused = !paused; sync(); });
  motion.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(host);
  }
}
