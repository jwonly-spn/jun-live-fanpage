// 보스전 보기(2026-11-19 — 봇 저장소 docs/superpowers/specs/2026-11-18-bossview-design.md "사이트" · "채팅 링크 · 스푼 앱 안 창"):
//  · /boss            지금 보스전 목록(15초마다 — 화면이 숨으면 쉼). 없으면 "지금은 보스전이 없어요 — 방송 시작 30분 뒤부터 30분마다 나와요".
//  · /boss/<판 번호>   한 판 보기: 모집 중이면 보스 등장 장면 + 참전 수(3초마다) → 대본이 오면 그만 읽고 생중계(서버 시계에 맞춰 그 장면부터)
//                      → 땅 답이 아직이면 10초마다 → 끝나면 결과 장면 + "지금 다른 보스전". 없는 판은 "끝났거나 없는 보스전이에요". 다시 보는 단추는 없다.
//  · /b/<DJ 주소>      채팅 생중계 링크: 그 DJ 의 지금 판을 바로. 없으면 기다림 화면(15초마다) — 판이 생기면 저절로 장면이 시작된다.
//  스푼 앱 안 창(아이폰 WKWebView · 갤럭시 WebView)에서 먼저 잘 보이게: 장면이 맨 위에 폭 가득(세로 화면은 세로 장면), 바로 아래 보스 이름·상태·소리 단추가
//  스크롤 없이 한눈에. 틀·상자 없음, 어두운 바탕. 소리는 처음엔 꺼짐 — 켤 때 음악을 받고 "방송 소리와 겹칠 수 있어요" 한 줄.
//  장면 모듈(kiugi/s2/battle/battle-scene.js — 먼치킨 저장소에서 옮김)과 그림·음악은 이 화면에서만 받는다. 이름표는 키우기 아이디의 # 앞만.
import { h, icon } from '../lib/dom.js';
import { kiugiApi } from '../api.js';
import { EMPTY_BOSS, emptyLines, GONE_BOSS, BROKEN_BOSS, SOUND_NOTE, LIST_POLL_MS, OTHERS_POLL_MS, NEXT_MS, waitPollMs, listOf, phaseText, djText, bossText, joinedText, pickFight, watchPlan, clockOffset, sceneQuality, nameOf, playWithSound } from '../lib/boss-core.js';
import { unlockAudio, lockAudio } from '../lib/sound-unlock.js';
import { nightTop, siteFoot, ilink, BRAND, UNOFFICIAL } from './common.js';

// 그림 글자는 화면 읽기가 읽지 않게(제목은 글만)
const ogre = () => h('span', { 'aria-hidden': 'true' }, '👹 ');
const LOAD_FAILED = '장면을 불러오지 못했어요';
const RETRY_MS = 5000;      // 읽기에 실패했을 때
const NOTE_MS = 6000;       // 소리 한 줄이 보이는 시간
const DARK = '#0d0a10';     // 보는 화면 바탕(브라우저 위쪽 막대 색도)

export async function renderBoss(root, app, route) {
  if (route.name === 'boss') return listPage(root, app);
  return watchPage(root, app, route);
}

// 화면이 보일 때만 도는 되풀이. fn() 이 다음까지 기다릴 ms 를 돌려준다(0 = 그만 — kick() 으로 다시 시작). 화면을 떠나면 저절로 멈춘다
function poller(el, fn) {
  let timer = 0, busy = false, again = false, pending = false, stopped = false;
  async function run() {
    clearTimeout(timer);
    if (stopped) return;
    if (!el.isConnected) return stop();
    if (busy) { again = true; return; }
    if (document.hidden) { pending = true; return; } // 숨어 있으면 쉬고, 다시 보이면 바로
    busy = true;
    let ms = RETRY_MS;
    try { ms = await fn(); } catch { ms = RETRY_MS; }
    busy = false;
    if (stopped) return;
    if (again) { again = false; return run(); }
    if (ms > 0) timer = setTimeout(run, ms);
  }
  const onVis = () => { if (!el.isConnected) return stop(); if (document.visibilityState === 'visible' && pending) { pending = false; run(); } };
  function stop() { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVis); }
  document.addEventListener('visibilitychange', onVis);
  return { start: run, kick: run, stop };
}

// 목록 한 줄(틀 없이): 보스 그림 · 방송 이름 · 보스 · 참전 수 · 상태 → 누르면 보기
function fightRow(app, f) {
  return h('li', null, ilink(app.link({ name: 'watch', fight: f.id }), { class: 'bl-row' },
    h('img', { class: 'bl-boss', src: `${app.base}kiugi/s2/boss_${f.boss.type}.png`, alt: '', width: '52', height: '52', loading: 'lazy', decoding: 'async' }),
    h('span', { class: 'bl-text' }, h('b', null, djText(f)), h('small', null, h('span', null, bossText(f)), h('span', null, joinedText(f)))),
    h('span', { class: 'bl-phase' + (f.phase === 'fight' ? ' is-fight' : '') }, phaseText(f)),
    icon('chevron-right', { size: 18 })));
}
const emptyBox = () => { const [a, b] = emptyLines(); return h('div', { class: 'bl-empty', title: EMPTY_BOSS }, h('b', null, a), h('span', null, b)); };

// ---- /boss: 지금 보스전 목록 ----
function listPage(root, app) {
  const list = h('ul', { class: 'bl-list', 'aria-label': '지금 보스전' }), note = h('p', { class: 'note bl-note', role: 'status' });
  const body = h('div', { class: 'bl-body', 'aria-live': 'polite' }, h('p', { class: 'note' }, '불러오는 중…'));
  const main = h('main', { id: 'main', class: 'bl', tabindex: '-1' },
    h('div', { class: 'bl-head' }, h('h1', { class: 'bl-title' }, ogre(), '지금 보스전'), h('p', null, '방송에 보스가 나오면 여기에 떠요. 누르면 싸움을 바로 구경해요.')),
    body, note);
  root.replaceChildren(...nightTop(app), main, siteFoot(app, '보스전에는 방송 이름과 청취자가 만든 키우기 아이디·몬스터만 보여요.'));
  document.title = `지금 보스전 · ${BRAND}`;
  const poll = poller(main, async () => {
    try {
      const fights = listOf(await kiugiApi.fights());
      if (fights.length) { list.replaceChildren(...fights.map((f) => fightRow(app, f))); body.replaceChildren(list); } else body.replaceChildren(emptyBox());
      note.textContent = '';
    } catch (e) { note.textContent = `${e?.message || '목록을 불러오지 못했어요.'} 잠시 뒤에 다시 읽어요.`; }
    return LIST_POLL_MS;
  });
  app.onLeave = poll.stop;
  poll.start();
}

// ---- /boss/<판 번호> · /b/<DJ 주소>: 보는 화면 ----
function watchPage(root, app, route) {
  const live = route.name === 'live', slug = live ? route.slug : '';
  const q = sceneQuality(typeof navigator !== 'undefined' ? navigator : null);
  let sound = false;        // 소리는 처음엔 꺼짐(보는 사람이 켠다 — 장면이 바뀌어도 고른 대로)
  let mod = null, sharedAudio = null, ctl = null, sceneEl = null;
  let curId = live ? '' : route.fight, cur = null; // cur = 지금 띄운 장면 {id, phase:'join'|'fight', ended, landKnown, win, tries}
  let offset = 0, dead = false, noteTimer = 0, othersAt = 0, last = null, idleSince = 0;
  const skip = new Set(); // 다 본 판·없는 판·볼 수 없는 판(채팅 링크에서 다시 고르지 않는다)
  const serverNow = () => Date.now() + offset;

  const host = h('div', { class: 'bv-host' });
  const msg = h('div', { class: 'bv-msg', role: 'status', 'aria-live': 'polite' });
  const noteEl = h('p', { class: 'bv-note', role: 'status', hidden: true }, SOUND_NOTE);
  const stage = h('div', { class: 'bv-stage' }, host, msg, noteEl);
  const bossEl = h('h1', { class: 'bv-boss' }, ogre(), '보스전 생중계'), statusEl = h('p', { class: 'bv-status' }, '불러오는 중…');
  // 상태 글(모집 중 → 싸우는 중 → 토벌 성공/실패)만 화면 읽기에 알린다 — 3초마다 바뀌는 참전 수는 알리지 않는다
  const djEl = h('b'), stateEl = h('em', { role: 'status', 'aria-live': 'polite' }), countEl = h('span');
  const soundIcon = h('span', { class: 'bv-sound-ic', 'aria-hidden': 'true' }), soundText = h('span', null, '소리 꺼짐');
  // 켜고 끄는 단추: 이름은 늘 "소리", 상태는 aria-pressed 로만(보이는 글·그림은 지금 상태)
  const soundBtn = h('button', { type: 'button', class: 'bv-sound', 'aria-label': '소리', 'aria-pressed': 'false', disabled: true, onclick: toggleSound }, soundIcon, soundText);
  const info = h('div', { class: 'bv-info' }, h('div', { class: 'bv-text' }, bossEl, statusEl), soundBtn);
  const othersList = h('ul', { class: 'bl-list bv-list' }), othersBox = h('div', { class: 'bv-others', hidden: true }, h('h2', { class: 'bv-h' }, '지금 다른 보스전'), othersList);
  const more = h('section', { class: 'bv-more', 'aria-label': '더 보기' }, othersBox,
    h('p', { class: 'bv-links' },
      ilink(app.link({ name: 'boss' }), { class: 'btn btn-line btn-sm' }, '지금 보스전 모두 보기'),
      ilink(app.link({ name: 'home' }), { class: 'btn btn-line btn-sm' }, icon('map', { size: 16 }), '영토 지도')),
    h('p', { class: 'bv-unofficial' }, UNOFFICIAL));
  const main = h('main', { id: 'main', class: 'bv', tabindex: '-1', dataset: { state: 'loading' } }, stage, info, more);
  root.replaceChildren(main, siteFoot(app, '보스전에는 방송 이름과 청취자가 만든 키우기 아이디·몬스터만 보여요.'));
  document.title = `보스전 생중계 · ${BRAND}`;
  const themeMeta = document.querySelector('meta[name="theme-color"]'), themeWas = themeMeta?.getAttribute('content');
  themeMeta?.setAttribute('content', DARK);
  paintSound();

  // 장면 높이: 화면 높이에서 아래 정보 줄을 뺀 만큼(스크롤 없이 장면·보스 이름·소리 단추가 한눈에). 주소 막대가 접히며 높이가 조금씩 바뀌는 것은 따라가지 않는다
  let box = { w: 0, h: 0, max: 0 };
  function sceneMax() {
    const w = window.innerWidth, hh = window.innerHeight;
    if (w !== box.w || Math.abs(hh - box.h) > 100) {
      const pad = parseFloat(getComputedStyle(main).paddingTop) || 0;
      box = { w, h: hh, max: Math.max(180, hh - pad - (info.offsetHeight || 72)) };
    }
    return box.max;
  }
  function sizeStage() { // 장면이 뜨기 전·바뀌는 동안에도 같은 자리(화면이 덜컥거리지 않게)
    // 장면 모듈과 같은 셈(세로 화면 180×320 · 가로 320×180, 도트가 또렷하게 정수배로 맞으면 그 크기) — 위아래에 빈 띠가 남지 않게
    const portrait = window.innerHeight > window.innerWidth, W = portrait ? 180 : 320, H = portrait ? 320 : 180;
    const cw = stage.clientWidth || window.innerWidth, dpr = Math.min(window.devicePixelRatio || 1, q.maxDpr);
    const fitW = Math.min(cw, sceneMax() * W / H), dev = fitW * dpr, k = Math.floor(dev / W);
    const cssW = k >= 1 && (k * W) / dev >= 0.9 ? (k * W) / dpr : fitW;
    host.style.height = Math.ceil(cssW * H / W) + 'px';
  }
  window.addEventListener('resize', sizeStage);
  sizeStage();

  function paintSound() {
    soundBtn.setAttribute('aria-pressed', String(sound));
    soundText.textContent = sound ? '소리 켜짐' : '소리 꺼짐';
    soundIcon.replaceChildren(icon(sound ? 'sound-on' : 'sound-off', { size: 22 }));
  }
  // 소리 단추(누르는 손길 안에서): 아이폰은 무음 오디오를 먼저 틀어야 무음 스위치가 켜져 있어도 들린다 → 그다음 장면 소리(AudioContext)를 깨운다
  function toggleSound() {
    sound = !sound;
    if (sound) unlockAudio(); else lockAudio();
    if (sharedAudio) sharedAudio.set(sound);
    paintSound();
    clearTimeout(noteTimer);
    noteEl.hidden = !sound;
    if (sound) noteTimer = setTimeout(() => { noteEl.hidden = true; }, NOTE_MS);
  }

  function say(state, title, sub, extra, action) { // 장면 대신(또는 위에) 글: 기다림 · 없는 판 · 볼 수 없는 판 · 불러오지 못함(다시 시도 단추)
    main.dataset.state = state;
    msg.replaceChildren(...[title ? h('b', null, title) : null, sub ? h('span', null, sub) : null, extra ? h('small', null, extra) : null, action || null].filter(Boolean));
  }
  const plain = (text) => { statusEl.replaceChildren(text); }; // 판이 없을 때의 한 줄
  // 장면을 치운다: 울리던 곡도 내린다(기다림·없는 판 화면 위로 음악이 혼자 돌지 않게)
  function dropScene() { try { ctl?.destroy(); } catch { /* 무시 */ } try { sharedAudio?.halt(); } catch { /* 무시 */ } sceneEl?.remove(); ctl = null; sceneEl = null; cur = null; }
  function paintInfo(f) {
    last = f || last;
    if (!last) return;
    bossEl.replaceChildren(ogre(), bossText(last));
    const state = cur?.ended ? (cur.win ? '토벌 성공' : '토벌 실패') : phaseText(last);
    if (stateEl.parentNode !== statusEl) statusEl.replaceChildren(djEl, ' ', stateEl, ' ', countEl);
    djEl.textContent = djText(last); countEl.textContent = joinedText(last);
    if (stateEl.textContent !== state) stateEl.textContent = state; // 바뀔 때만(화면 읽기가 한 번만 읽게)
    document.title = `${djText(last)} 보스전 · ${BRAND}`;
  }

  async function loadScene() {
    if (!mod) {
      mod = await import('../kiugi/s2/battle/battle-scene.js');
      sharedAudio = mod.makeAudio(mod.DEFAULT_ASSETS.music, mod.AUDIO.tracks); // 장면이 바뀌어도 같은 소리 길
      sharedAudio.set(sound);
      soundBtn.disabled = false;
    }
    return mod;
  }
  // 새 장면을 지금 장면 위에 겹쳐 띄우고, 준비되면 예전 것을 치운다(자리·크기는 그대로)
  async function mount(script, opts) {
    let m = null;
    try { m = await loadScene(); } catch (e) { throw Object.assign(new Error('장면 모듈을 받지 못했어요'), { loadFailed: true, cause: e }); } // 대본 탓이 아니다
    if (dead) return false;
    sizeStage();
    const wrap = h('div', { class: 'bv-scene' });
    host.append(wrap);
    let next = null;
    // 띄우는 동안 소리 단추를 눌렀으면 그 고름이 이긴다(playWithSound — 다 뜬 뒤 지금 고름으로 다시 맞춤). 소리 길은 장면이 바뀌어도 같은 것(audio: sharedAudio)
    try { next = await playWithSound((o) => m.playFight(wrap, script, o), sharedAudio, () => sound, { nameOf, maxHeight: sceneMax, maxDpr: q.maxDpr, particles: q.particles, ...opts }); }
    catch (e) { wrap.remove(); throw e; }
    if (dead) { next.destroy(); wrap.remove(); return false; }
    try { ctl?.destroy(); } catch { /* 무시 */ }
    sceneEl?.remove();
    ctl = next; sceneEl = wrap;
    return true;
  }

  async function others() { // "지금 다른 보스전"(끝난 뒤 · 없는 판일 때)
    othersAt = Date.now();
    try {
      const rows = listOf(await kiugiApi.fights()).filter((f) => f.id !== curId && !skip.has(f.id) && f.id !== cur?.id);
      othersList.replaceChildren(...rows.map((f) => fightRow(app, f)));
      othersBox.hidden = !rows.length;
    } catch { /* 다음에 다시 */ }
  }
  const sync = (now, sentAt) => { if (typeof now === 'number') offset = clockOffset(now, sentAt, Date.now()); };

  // 한 번 읽고 정한다 → 다음까지 기다릴 ms
  async function tick() {
    if (dead) return 0;
    if (live && !curId) { // 그 DJ 의 지금 판 찾기
      const sent = Date.now(), r = await kiugiApi.fights(slug);
      sync(r.now, sent);
      const f = pickFight(listOf(r), slug, skip);
      if (!f) {
        if (!cur) { const [a, b] = emptyLines(); say('wait', a, b, '보스가 나오면 여기서 바로 시작돼요'); plain('보스를 기다리는 중이에요'); }
        if (Date.now() - othersAt > OTHERS_POLL_MS - 1000) others(); // 다른 보스전 목록은 1분마다만
        loadScene().catch(() => {}); // 기다리는 동안 장면 모듈을 미리 받아 둔다(소리 단추도 이때 켜진다)
        idleSince ||= Date.now();
        return waitPollMs(Date.now() - idleSince); // 15초마다 — 10분 넘게 판이 없으면 30초마다(다시 보면 15초로)
      }
      curId = f.id; idleSince = 0;
    }
    if (!curId) { dropScene(); say('gone', GONE_BOSS); plain('다른 보스전을 골라 주세요'); await others(); return LIST_POLL_MS; }
    if (cur?.id === curId && cur.ended && cur.landKnown) {
      if (live) { skip.add(curId); curId = ''; return NEXT_MS; } // 채팅 링크: 결과 장면은 둔 채 그 DJ 의 다음 판을 기다린다
      await others(); return LIST_POLL_MS;
    } // 끝난 뒤(보기 주소): 다른 보스전 목록만 새로
    let r = null;
    const sent = Date.now();
    try { r = await kiugiApi.fight(curId); } catch (e) {
      if (e?.status !== 404) return RETRY_MS; // 잠깐 끊김: 장면은 그대로 두고 다시
      r = null;
    }
    if (r) sync(r.now, sent);
    const f = r?.fight, plan = watchPlan(f, r?.now);
    if (plan.mode === 'gone') {
      if (cur?.ended) { cur.landKnown = true; return NEXT_MS; } // 결과 장면은 그대로 둔다(땅 답만 못 받음)
      const id = curId;
      dropScene();
      if (live) { skip.add(id); curId = ''; return NEXT_MS; }   // 채팅 링크: 다음 판을 기다린다(없는 판은 다시 고르지 않는다)
      say('gone', GONE_BOSS); plain('다른 보스전을 골라 주세요');
      curId = ''; await others();
      return LIST_POLL_MS;
    }
    try {
      if (plan.mode === 'join') {
        if (cur?.id !== f.id || cur.phase !== 'join') {
          if (!await mount({ boss: f.boss, joinUntil: f.joinUntil, joined: f.joined, dj: f.dj }, { live: { now: serverNow } })) return 0;
          cur = { id: f.id, phase: 'join' };
        } else ctl.updateJoin(f.joined);
      } else if (cur?.id !== f.id || cur.phase !== 'fight') {
        const my = { id: f.id, phase: 'fight', ended: false, landKnown: f.land != null, win: f.script.win === true, tries: 0 };
        // 서버 시계로 지금−시작만큼 건너뛰어 그 장면부터(끝난 판이면 결과 장면만). 끝나면 다른 보스전을 보여 주고, 채팅 링크는 다음 판을 기다린다
        if (!await mount(f.script, { live: { startAt: f.startAt, now: serverNow }, land: f.land, onEnd: () => { my.ended = true; if (cur === my) { main.dataset.state = 'done'; paintInfo(); poll.kick(); } } })) return 0;
        cur = my;
      } else if (f.land != null) { ctl.setLand(f.land); cur.landKnown = true; }
    } catch (e) {
      console.error(e);
      if (e?.loadFailed) { // 장면 모듈을 못 받음(인터넷 끊김 등): 판은 그대로 두고 다시 — 대본이 잘못된 것이 아니다
        say('retry', LOAD_FAILED, '인터넷 연결을 확인해 주세요.', '', h('button', { type: 'button', class: 'btn bv-retry', onclick: () => location.reload() }, '다시 시도'));
        plain('15초 뒤에 다시 해 봐요');
        return LIST_POLL_MS;
      }
      dropScene(); say('broken', BROKEN_BOSS); plain('다른 보스전을 골라 주세요');
      if (live) skip.add(curId);
      curId = ''; await others();
      return live ? LIST_POLL_MS : 0;
    }
    main.dataset.state = cur.ended ? 'done' : cur.phase; msg.replaceChildren();
    paintInfo(f);
    if (cur.phase === 'join') return plan.poll;
    if (!cur.ended) return cur.landKnown ? 0 : plan.poll; // 대본을 받았으면 그만 읽는다 — 땅 답이 아직이면 10초마다
    // 끝났다: 땅 답을 몇 번만 더 기다리고(늦게 온 영토 서버 답), 채팅 링크는 다음 판을 기다린다
    if (!cur.landKnown && ++cur.tries >= 3) cur.landKnown = true;
    main.dataset.state = 'done';
    if (live && cur.landKnown) { skip.add(curId); curId = ''; }
    others();
    return cur.landKnown ? LIST_POLL_MS : RETRY_MS;
  }
  const poll = poller(main, tick);
  const onSee = () => { if (document.visibilityState === 'visible') idleSince = 0; }; // 다시 보면 15초 간격으로
  document.addEventListener('visibilitychange', onSee);
  app.onLeave = () => {
    dead = true; poll.stop(); document.removeEventListener('visibilitychange', onSee); clearTimeout(noteTimer); window.removeEventListener('resize', sizeStage);
    try { ctl?.destroy(); } catch { /* 무시 */ }
    try { sharedAudio?.close(); } catch { /* 무시 */ }
    lockAudio();
    if (themeMeta && themeWas) themeMeta.setAttribute('content', themeWas);
  };
  if (!live && !curId) { say('gone', GONE_BOSS); plain('다른 보스전을 골라 주세요'); }
  else say('loading', '', '');
  poll.start();
}
