// 아이폰 무음 스위치 대비(보스전 보기 소리 단추 — views/boss.js 가 누르는 손길 안에서 부른다).
//  아이폰은 옆의 무음 스위치가 켜져 있으면 WebAudio(장면의 효과음·음악)가 소리를 내지 않는다. 소리 없는 HTML 오디오를 먼저 틀어 두면
//  같은 페이지의 소리가 "재생" 길로 나가 무음 스위치와 상관없이 들린다(널리 쓰는 방법).
//  갤럭시(안드로이드)는 무음 스위치가 없고, HTML 오디오를 틀면 스푼 방송 소리의 오디오 포커스를 뺏을 수 있어 하지 않는다.
//  아이폰에서 스푼 앱 안 창이 방송 소리를 멈추게 하는지는 실제 기기에서만 알 수 있다(2026-11-23 확인).
// 0.25초짜리 소리 없는 WAV(8kHz 8bit 모노)를 그 자리에서 만든다 — 파일을 따로 받지 않는다. 보안 규칙(CSP)은 media-src data: 만 연다.
function silentWav() {
  const n = 2000, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
  const put = (at, s) => { for (let i = 0; i < s.length; i++) b[at + i] = s.charCodeAt(i); };
  put(0, 'RIFF'); v.setUint32(4, 36 + n, true); put(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); put(36, 'data'); v.setUint32(40, n, true);
  b.fill(128, 44); // 8bit 는 128 이 소리 없음
  let s = ''; for (const x of b) s += String.fromCharCode(x);
  return 'data:audio/wav;base64,' + btoa(s);
}

export function isIos(nav = typeof navigator !== 'undefined' ? navigator : null) {
  if (!nav) return false;
  return /iPad|iPhone|iPod/.test(nav.userAgent || '') || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1); // 아이패드는 맥이라고 말한다
}

let el = null;
// 소리를 켜는 손길(click) 안에서, AudioContext 를 깨우기 전에 부른다
export function unlockAudio() {
  if (!isIos()) return false;
  try {
    if (!el) { el = new Audio(silentWav()); el.loop = true; el.preload = 'auto'; el.setAttribute('playsinline', ''); el.setAttribute('x-webkit-airplay', 'deny'); }
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
    return true;
  } catch { return false; }
}
// 소리를 끄거나 화면을 떠날 때
export function lockAudio() {
  try { if (el) el.pause(); } catch { /* 무시 */ }
}
