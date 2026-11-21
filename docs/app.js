// 시작점(2026-11-21): 2026-12-01 0시(한국) 전에는 시즌 2 예고 화면(views/teaser.js — 모든 주소), 그때부터는 시즌 2 화면(s2-app.js — 지도·도감·보스전 보기).
//  어느 쪽인지는 서버 시각으로 고른다(lib/launch.js — 방문자 시계가 틀려도 같은 때에 바뀐다). 스푼 연결은 별도 HTML이다.
//  12월 1일이 지나 예고 화면을 걷어낼 때: 이 파일을 s2-app.js 내용으로 바꾸고 views/teaser.js · lib/teaser-*.js · lib/me.js · lib/hearts.js · lib/launch.js · teaser/ 와 styles.css 의 "시즌 2 예고" 덩어리를 지운다(teaser/ 를 지우기 전에 index.html·404.html 의 og:image 를 og.png 로 — 지금 미리보기 그림이 teaser/og.png).
import { decideScreen, markStarted, LAUNCH_AT } from './lib/launch.js';

const root = document.documentElement;
const stores = () => { try { return { local: window.localStorage, session: window.sessionStorage }; } catch { return { local: null, session: null }; } };

// 맨 위 작은 스크립트가 기기 시계로 미리 고른 색을 서버 시각으로 고른 화면에 맞춘다
function paint(screen) {
  root.classList.toggle('s2-teaser', screen === 'teaser');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', screen === 'teaser' ? '#07080f' : '#f1ebdf');
}

async function start() {
  const { local, session } = stores();
  // 묻는 동안 예고 화면 모듈도 같이 받는다(기다리는 시간이 겹치게) — 이미 시작한 것이 분명하면 받지 않는다
  const early = root.classList.contains('s2-teaser') ? import('./views/teaser.js').catch(() => null) : null;
  const pick = await decideScreen({ url: new URL('./notice.json', import.meta.url).href, local, session });
  if (pick.source === 'local') console.info('[키우기] 서버 시각을 받지 못해 이 기기 시계로 화면을 골랐어요.');
  root.dataset.clock = pick.source;
  paint(pick.screen);
  if (pick.screen === 's2') { await import('./s2-app.js'); return; }
  const mod = (await early) || await import('./views/teaser.js');
  mod.renderTeaser(document.getElementById('app'), {
    now: () => Date.now() + pick.offset,
    // 카운트다운이 끝나면(= 서버 시각 12월 1일 0시) 한 번 새로 고쳐 시즌 2 화면으로
    onStart: () => { if (Date.now() + pick.offset >= LAUNCH_AT && markStarted({ source: pick.source, local, session })) location.reload(); },
  });
}

start().catch((e) => {
  console.error(e);
  document.getElementById('app').replaceChildren(Object.assign(document.createElement('p'), { className: 'boot-error', textContent: '화면을 여는 중에 문제가 생겼어요. 새로고침해 주세요.' }));
});
