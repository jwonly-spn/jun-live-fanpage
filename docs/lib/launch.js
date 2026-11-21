// 날짜로 저절로 바뀌기(2026-11-21): 2026-12-01 0시(한국) 전에는 시즌 2 예고 화면, 그때부터는 시즌 2 화면.
//  · 지금 시각은 방문자 기기 시계가 아니라 **서버 시각**으로 본다 — 이 사이트 서버가 답에 실어 주는 Date 머리글(notice.json 을 HEAD 로 한 번, 기억해 둔 답은 쓰지 않음).
//    방문자 시계가 틀려도(몇 분·몇 시간·며칠) 같은 때에 바뀐다. 서버에 못 닿으면(2.5초 안에 답이 없거나 머리글이 없으면) 방문자 시계로 고르고 console 에 한 줄 남긴다.
//  · 서버가 "시작했다"고 답한 브라우저는 그 사실을 적어 둔다(kg_s2_open = '1' — 시각은 거꾸로 가지 않으니 다음부터는 묻지 않고 바로 시즌 2 화면).
//  · 예고 화면을 켜 둔 채 0시를 넘기면 카운트다운이 끝나는 순간 한 번 새로 고쳐 시즌 2 화면으로 넘어간다(이 창에 kg_s2_go 를 적어 두어 되풀이해서 새로 고치지 않는다).
//  DOM 없이 동작(fetch·저장소·시계를 넘겨받는다 — 노드 시험). index.html 맨 위 작은 스크립트(tools/stamp.cjs BOOT)는 같은 시각·같은 열쇠로 "첫 색"만 미리 고른다.
export const LAUNCH_AT = Date.parse('2026-12-01T00:00:00+09:00'); // 1796050800000
export const OPEN_KEY = 'kg_s2_open', GO_KEY = 'kg_s2_go';
export const CLOCK_FILE = 'notice.json', CLOCK_TIMEOUT_MS = 2500;

// 어느 화면인지: 'teaser'(예고) | 's2'(시즌 2)
export const pickScreen = (now) => (now >= LAUNCH_AT ? 's2' : 'teaser');

const get = (storage, key) => { try { return storage?.getItem?.(key) ?? null; } catch { return null; } };
const set = (storage, key, value) => { try { storage?.setItem?.(key, value); } catch { /* 막힌 저장소: 이번에만 */ } };

// Date 머리글 → 서버의 지금(밀리초). 머리글은 초 단위로 잘려 오므로 0.5초를 더해 가운데로 본다. 못 읽으면 null.
export function parseServerDate(value) {
  const t = Date.parse(String(value ?? ''));
  return Number.isFinite(t) ? t + 500 : null;
}

// 서버 시각 묻기 → { offset(서버 − 기기, 밀리초), source: 'server' | 'local' }
export async function askClock({ fetchFn = globalThis.fetch, url, now = Date.now, timeoutMs = CLOCK_TIMEOUT_MS } = {}) {
  const local = { offset: 0, source: 'local' };
  if (typeof fetchFn !== 'function' || !url) return local;
  let timer = null;
  try {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const sent = now();
    const late = new Promise((_, no) => { timer = setTimeout(() => { ctl?.abort(); no(new Error('늦음')); }, timeoutMs); });
    const res = await Promise.race([fetchFn(url, { method: 'HEAD', cache: 'no-store', signal: ctl?.signal }), late]);
    const got = now(), server = parseServerDate(res?.headers?.get?.('date'));
    if (server === null) return local;
    return { offset: Math.round(server - (sent + got) / 2), source: 'server' };
  } catch { return local; } finally { clearTimeout(timer); }
}

// 화면 고르기 → { screen, offset, source: 'remembered' | 'server' | 'local' }
//  local = 지속 저장소(localStorage) · session = 이 창 저장소(sessionStorage)
export async function decideScreen({ fetchFn, url, now = Date.now, local = null, session = null, timeoutMs } = {}) {
  if (get(local, OPEN_KEY) === '1' || get(session, GO_KEY) === '1') return { screen: 's2', offset: 0, source: 'remembered' };
  const clock = await askClock({ fetchFn, url, now, timeoutMs });
  const screen = pickScreen(now() + clock.offset);
  if (screen === 's2' && clock.source === 'server') set(local, OPEN_KEY, '1');
  return { screen, ...clock };
}

// 예고 화면의 카운트다운이 끝났을 때: 이 창에 적어 두고 새로 고친다(서버 시각으로 센 것이면 다음 방문도 바로 시즌 2).
//  적은 것이 다시 읽히면 true — 저장소가 막혀 못 적었으면 false(그때는 새로 고치지 않는다: 새로 고칠 때마다 다시 예고가 떠서 되풀이될 수 있다. 예고의 "시즌 2가 시작됐어요" 한 줄이 남는다).
export function markStarted({ source, local = null, session = null } = {}) {
  set(session, GO_KEY, '1');
  if (source === 'server') set(local, OPEN_KEY, '1');
  return get(session, GO_KEY) === '1' || get(local, OPEN_KEY) === '1';
}
