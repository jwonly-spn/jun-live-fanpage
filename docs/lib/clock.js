// 맞춘 시계(2026-11-21): 방문자 기기 시계가 틀려도 "남은 날"·"시작 전/중" 글이 맞게 — 서버 시각과의 차이(밀리초)를 더한 지금.
//  차이는 시작점(app.js → lib/launch.js)이 서버 시각을 물었을 때 이 창 저장소(kg_s2_skew)에 적어 둔 값을 s2-app.js 가 넣는다. 없으면 0(기기 시계 그대로).
//  DOM 없이 동작.
let skew = 0;
export const SKEW_KEY = 'kg_s2_skew';
export function setSkew(ms) { const n = Number(ms); skew = Number.isFinite(n) ? n : 0; return skew; }
export const siteNow = () => Date.now() + skew;
