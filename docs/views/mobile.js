// /app — PC 없이 휴대폰만으로 JUN LIVE 쓰기(모바일 방송 도우미).
// 이 브라우저가 스스로 기기 열쇠를 만들고 승인을 받는다. 승인되면 팬페이지 꾸미기를 바로 연다.
import { h, applyTheme, store, toast } from '../lib/dom.js';
import { identity, nonce, sign, accessText, signedAction, supported, resetDevice } from '../lib/device.js';
import { API_BASE, API_KEY, isDemo } from '../api.js';

export const ACCESS_URL = 'https://aksegkhhugqvvaidgvro.supabase.co/functions/v1/junlive-access/api/device/check';
const PROFILE = 'jl_mobile_profile';
const STATE_TEXT = {
  pending: ['승인 기다리는 중', '관리자가 승인하면 바로 쓸 수 있어요. 잠시 뒤 ‘다시 확인’을 눌러 주세요.'],
  approved: ['승인 완료', '이 휴대폰에서 JUN LIVE를 쓸 수 있어요.'],
  revoked: ['사용이 멈춘 기기', '관리자에게 문의해 주세요.'],
};

// 닉네임·고유닉 검사(승인 서버와 같은 규칙)
export function checkProfile({ nickname, tag }) {
  const n = String(nickname || '').trim(), t = String(tag || '').trim().replace(/^@/, '');
  if (!n || n.length > 40 || /[\x00-\x1f]/.test(n)) return { error: '스푼 닉네임을 적어 주세요.' };
  if (!t || t.length > 40 || /[\s@\x00-\x1f]/.test(t)) return { error: '스푼 고유닉을 적어 주세요. (@ 뒤 영어·숫자)' };
  return { nickname: n, tag: t };
}

async function post(url, body) {
  let res;
  // 휴대폰 데이터가 불안정해도 '보내는 중…'에 멈춰 있지 않게 20초까지만 기다린다.
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 20000);
  try {
    res = await fetch(url, { method: 'POST', headers: { apikey: API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store', signal: ctl.signal });
  } catch (e) { throw new Error(e?.name === 'AbortError' ? '응답이 늦어요. 잠시 뒤에 다시 해 주세요.' : '인터넷 연결을 확인해 주세요.'); }
  finally { clearTimeout(timer); }
  let json = null;
  try { json = await res.json(); } catch { /* 빈 응답 */ }
  if (!res.ok) throw new Error(json?.error || '잠시 뒤에 다시 해 주세요.');
  return json || {};
}

async function checkAccess(profile) {
  if (isDemo()) return { state: 'approved', code: 'DEMO-DEMO-DEMO-DEMO-DEMO-DEMO' };
  const me = await identity();
  const b = { timestamp: Date.now(), nonce: nonce(), publicKey: me.publicKey, applicant: profile ? { nickname: profile.nickname, tag: profile.tag } : undefined };
  b.signature = await sign(accessText(b));
  return post(ACCESS_URL, b);
}

async function openStudio(profile, app) {
  if (isDemo()) { app.navigate(app.link({ name: 'studio' })); return; }
  const r = await post(API_BASE + 'app', await signedAction('JUN-LIVE-FANPAGE', 'login', { spoon: { id: '', tag: profile.tag, nickname: profile.nickname } }));
  let u = null;
  try { u = new URL(r.url); } catch { /* 아래에서 처리 */ }
  if (!u || !['https://jwonly-spn.github.io', location.origin].includes(u.origin) || !u.pathname.endsWith('/studio') || !u.hash.startsWith('#code=')) throw new Error('주소를 받지 못했어요. 다시 해 주세요.');
  // 꾸미기 화면이 '다시 열기' 안내를 PC 대신 이 휴대폰 도우미로 하도록 표시해 둔다.
  try { sessionStorage.setItem('fp_from_app', '1'); localStorage.setItem('fp_from_app', '1'); } catch { /* 선택 */ }
  // 같은 사이트면 이 사이트 안의 꾸미기 화면으로(주소 BASE 유지)
  location.assign(u.origin === location.origin ? u.href : app.link({ name: 'studio' }).replace(/\?.*$/, '') + u.hash);
}

// ---------- 방송 봇(공용 클라우드 봇) ----------
export const CLOUDBOT_URL = 'https://aksegkhhugqvvaidgvro.supabase.co/functions/v1/cloudbot/';
const DEMO_BOT = { dj: { tag: 'demo_dj', nickname: '체험 DJ', state: 'verified', found: true, code: null, enabled: true, followed: true, status: { state: 'idle' } }, bot: { nickname: 'JUN LIVE 봇', tag: 'junlive_bot' } };
async function botCall(action, payload) {
  if (isDemo()) return DEMO_BOT;
  return post(CLOUDBOT_URL, await signedAction('JUN-LIVE-CLOUDBOT', action, payload ?? {}));
}
const ROOM_TEXT = { idle: '방송을 켜면 봇이 자동으로 들어가요.', joining: '방송에 들어가는 중이에요…', verify: '봇이 들어왔어요. 아래 코드를 채팅에 입력해 주세요.', live: '지금 방송에서 봇이 작동 중이에요.', error: '' };

// 앱에 보이는 봇 상태 문장
export function botStatusText(dj) {
  const s = dj?.status || {};
  if (s.state === 'error') return s.error || '확인이 필요해요.';
  return ROOM_TEXT[s.state] || ROOM_TEXT.idle;
}

// replaceChildren는 null을 글자로 넣으므로 빈 칸은 뺀다
const fill = (el, ...kids) => el.replaceChildren(...kids.filter((k) => k !== null && k !== undefined && k !== false));
// 카드마다 자기 타이머를 가진다(다른 화면으로 갔다 와도 옛 카드가 새 카드를 멈추지 않게).
function schedule(card, fn, ms) {
  clearTimeout(card._timer);
  card._timer = setTimeout(() => {
    if (!card.isConnected) return;
    if (document.hidden) { schedule(card, fn, 5000); return; } // 화면이 꺼져 있으면 서명 요청을 보내지 않는다
    fn();
  }, ms);
}
function renderBot(card, profile, data) {
  clearTimeout(card._timer);
  if (!card.isConnected && data) return;
  const busy = (btn, fn) => async () => {
    btn.disabled = true;
    try { renderBot(card, profile, await fn()); } catch (err) { toast(err.message, 'bad'); btn.disabled = false; }
  };
  const title = h('h2', { class: 'sec-title sm' }, '방송 봇');
  const refresh = () => botCall('status').then((d) => {
    if (!card.isConnected) return;
    // 바뀐 것이 없으면 다시 그리지 않는다(누르던 버튼·읽어 주기 위치가 날아가지 않게).
    const key = JSON.stringify(d);
    if (key === card._last && !card._armed) { schedule(card, refresh, card._every || 30000); return; }
    renderBot(card, profile, d);
  }).catch((err) => { if (card.isConnected) fill(card, title, h('p', { class: 'field-hint bad' }, err.message), h('button', { class: 'btn btn-line', type: 'button', onclick: () => renderBot(card, profile) }, '다시 확인')); });
  if (!data) { fill(card, title, h('p', { class: 'muted' }, '확인하는 중…')); refresh(); return; }
  card._last = JSON.stringify(data); card._armed = false;
  const { dj, bot } = data;
  const botName = bot?.tag ? '@' + bot.tag : '봇 계정';
  const status = (text) => h('p', { class: 'muted', 'aria-live': 'polite' }, text);

  if (!dj || dj.state === 'notfound') {
    const tag = h('input', { id: 'm-bot-tag', autocapitalize: 'none', spellcheck: 'false', maxlength: '40', value: dj?.tag || profile.tag });
    const btn = h('button', { class: 'btn btn-accent', type: 'button' }, '봇 사용 신청');
    btn.onclick = busy(btn, () => { const c = checkProfile({ nickname: profile.nickname, tag: tag.value }); if (c.error) throw new Error(c.error); return botCall('register', { tag: c.tag }); });
    fill(card, title,
      h('p', { class: 'muted small' }, 'PC 없이도 봇이 방송에 매니저로 들어가 채팅 명령·출석·애청지수를 처리해요. (TTS·효과음 같은 소리 기능은 PC에서만 돼요)'),
      dj?.state === 'notfound' ? h('p', { class: 'field-hint bad' }, `@${dj.tag} 스푼 계정을 찾지 못했어요. 고유닉을 확인해 주세요.`) : null,
      h('div', { class: 'field' }, h('label', { for: 'm-bot-tag' }, '방송하는 스푼 고유닉'), tag), btn);
    return;
  }

  if (dj.state === 'pending') {
    const step = (done, text) => h('li', { class: done ? 'm-step done' : 'm-step' }, text);
    const newCode = h('button', { class: 'btn btn-line', type: 'button' }, '코드 새로 받기');
    newCode.onclick = busy(newCode, () => botCall('new-code'));
    let sure = 0;
    const cancel = h('button', { class: 'btn btn-line', type: 'button' }, '신청 취소·고유닉 바꾸기');
    cancel.onclick = () => {
      if (Date.now() - sure > 5000) { sure = Date.now(); card._armed = true; cancel.textContent = '한 번 더 누르면 취소'; return; }
      busy(cancel, () => botCall('remove'))();
    };
    fill(card, title,
      h('p', { class: 'muted small' }, `@${dj.tag} 로 신청했어요. 세 단계만 하면 끝나요.`),
      h('ol', { class: 'm-steps' },
        step(dj.found && dj.followed, dj.found ? (dj.followed ? `${botName}이 DJ님을 팔로우했어요.` : `${botName}이 DJ님을 팔로우하는 중이에요 (1분 안).`) : '스푼 계정을 찾는 중이에요 (1분 안).'),
        step(false, `스푼에서 ${botName}을 고정 매니저로 지정해 주세요.`),
        step(dj.status?.state === 'verify', '방송을 켜고, 봇이 들어오면 채팅에 아래 코드를 입력해 주세요.')),
      dj.code ? h('p', { class: 'm-bigcode', 'aria-label': '인증 코드' }, dj.code) : h('p', { class: 'muted' }, '코드를 준비하는 중이에요.'),
      dj.status?.state ? status(botStatusText(dj)) : null,
      h('div', { class: 'row gap wrap' }, h('button', { class: 'btn btn-line', type: 'button', onclick: () => renderBot(card, profile) }, '새로고침'), newCode, cancel));
    card._every = 15000; schedule(card, refresh, 15000);
    return;
  }

  if (dj.state !== 'verified') {
    fill(card, title, status('봇 상태를 확인하지 못했어요.'), h('button', { class: 'btn btn-line', type: 'button', onclick: () => renderBot(card, profile) }, '다시 확인'));
    return;
  }

  // 인증 완료
  const toggle = h('button', { class: 'btn ' + (dj.enabled ? 'btn-line' : 'btn-accent'), type: 'button' }, dj.enabled ? '봇 끄기' : '봇 켜기');
  toggle.onclick = busy(toggle, () => botCall('enable', { on: !dj.enabled }));
  let sure = 0;
  const remove = h('button', { class: 'btn btn-line', type: 'button' }, '봇 해제');
  remove.onclick = () => {
    if (Date.now() - sure > 5000) { sure = Date.now(); card._armed = true; remove.textContent = '한 번 더 누르면 해제'; return; }
    busy(remove, () => botCall('remove'))();
  };
  fill(card, title,
    h('div', { class: 'row gap wrap' }, h('span', { class: 'm-state', dataset: { state: dj.enabled ? 'approved' : '' } }, dj.enabled ? '사용 중' : '꺼짐'), h('b', null, dj.nickname || dj.tag), h('span', { class: 'muted' }, '@' + dj.tag)),
    status(dj.enabled ? botStatusText(dj) : '봇이 방송에 들어가지 않아요.'),
    h('p', { class: 'muted small' }, `봇 계정: ${botName} (고정 매니저로 지정돼 있어야 해요)`),
    h('div', { class: 'row gap wrap' }, toggle, remove));
  card._every = 30000; schedule(card, refresh, 30000);
}

export async function renderMobile(root, app) {
  document.title = '모바일 방송 도우미 · JUN LIVE';
  const shell = h('div', { class: 'fp intro mobile-app' });
  applyTheme(shell, 'lavender');
  applyTheme(document.documentElement, 'lavender');
  const body = h('div', { class: 'stack' });
  const persistNote = h('p', { class: 'muted small' });
  const standalone = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; } };
  shell.append(h('main', { id: 'main', class: 'fp-main intro-main', tabindex: '-1' },
    h('section', { class: 'intro-hero' },
      h('span', { class: 'eyebrow' }, 'JUN LIVE 모바일'),
      h('h1', { class: 'display' }, 'PC 없이\n휴대폰으로 시작해요'),
      h('p', { class: 'intro' }, '가입하고 승인받으면 팬페이지를 휴대폰에서 바로 꾸밀 수 있어요.')),
    body,
    h('footer', { class: 'fp-foot' }, 'JUN LIVE')));
  root.replaceChildren(shell);

  if (!supported()) {
    body.replaceChildren(h('div', { class: 'card pad stack', role: 'alert' },
      h('h2', { class: 'sec-title sm' }, '이 브라우저에서는 쓸 수 없어요'),
      h('p', { class: 'muted' }, '크롬이나 사파리 최신 버전에서 열어 주세요. (시크릿 모드는 안 돼요)')));
    return;
  }

  const profile = store.get(PROFILE);
  if (!profile) return showSignup();
  return showStatus(profile);

  function showSignup(error, prefill = {}) {
    const nick = h('input', { id: 'm-nick', autocomplete: 'nickname', maxlength: '40', required: true, value: prefill.nickname || '' });
    const tag = h('input', { id: 'm-tag', autocapitalize: 'none', autocomplete: 'off', spellcheck: 'false', maxlength: '40', required: true, placeholder: '예: jun_live', value: prefill.tag || '' });
    const msg = h('p', { class: 'field-hint bad', role: 'alert' }, error || '');
    const btn = h('button', { class: 'btn btn-accent', type: 'submit' }, '가입 신청하기');
    body.replaceChildren(h('form', {
      class: 'card pad stack', novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        const p = checkProfile({ nickname: nick.value, tag: tag.value });
        if (p.error) { msg.textContent = p.error; return; }
        btn.disabled = true; btn.textContent = '보내는 중…';
        try {
          const r = await checkAccess(p);
          store.set(PROFILE, p);
          showStatus(p, r);
        } catch (err) {
          msg.textContent = err.message; btn.disabled = false; btn.textContent = '가입 신청하기';
        }
      },
    },
    h('h2', { class: 'sec-title sm' }, '처음이에요 — 가입 신청'),
    h('p', { class: 'muted small' }, '방송하는 스푼 계정 정보를 적어 주세요. 비밀번호는 필요 없어요.'),
    h('div', { class: 'field' }, h('label', { for: 'm-nick' }, '스푼 닉네임'), nick),
    h('div', { class: 'field' }, h('label', { for: 'm-tag' }, '스푼 고유닉 (@ 뒤)'), tag),
    msg, btn));
  }

  async function showStatus(p, first) {
    const box = h('div', { class: 'card pad stack', 'aria-live': 'polite' }, h('p', { class: 'muted' }, '확인하는 중…'));
    body.replaceChildren(box);
    let r = first;
    try { r = r || await checkAccess(p); } catch (err) {
      box.replaceChildren(h('p', { class: 'field-hint bad', role: 'alert' }, err.message),
        h('button', { class: 'btn btn-line', type: 'button', onclick: () => showStatus(p) }, '다시 확인'));
      return;
    }
    const [title, desc] = STATE_TEXT[r.state] || ['확인 필요', '잠시 뒤에 다시 확인해 주세요.'];
    const openBtn = h('button', {
      class: 'btn btn-accent', type: 'button',
      onclick: async () => {
        openBtn.disabled = true; openBtn.textContent = '여는 중…';
        try { await openStudio(p, app); } catch (err) { toast(err.message, 'bad'); openBtn.disabled = false; openBtn.textContent = '팬페이지 꾸미기'; }
      },
    }, '팬페이지 꾸미기');
    fill(box,
      h('div', { class: 'row gap wrap' }, h('span', { class: 'm-state', dataset: { state: r.state || '' } }, title), h('b', null, p.nickname), h('span', { class: 'muted' }, '@' + p.tag)),
      h('p', { class: 'muted' }, desc),
      r.state === 'approved' ? openBtn : h('button', { class: 'btn btn-line', type: 'button', onclick: () => showStatus(p) }, '다시 확인'),
      r.state === 'revoked' ? h('p', { class: 'field-hint bad' }, '아래 휴대폰 코드를 관리자에게 알려 주세요.') : null,
      h('p', { class: 'muted small' }, '이 휴대폰 코드: ', h('code', { class: 'm-code' }, r.code || '')),
      r.state === 'approved' ? null : fixButton(p));
    const botCard = h('section', { class: 'card pad stack' });
    if (r.state === 'approved') renderBot(botCard, p);
    if (r.state === 'approved') body.append(botCard);
    body.append(
      h('section', { class: 'card pad stack' },
        h('h2', { class: 'sec-title sm' }, '꼭 읽어 주세요'),
        h('p', { class: 'muted small' }, '승인 열쇠는 지금 쓰는 브라우저 안에만 저장돼요. 사이트 데이터를 지우거나, 이 브라우저를 오래(아이폰은 7일 넘게) 안 쓰면 다시 가입해야 할 수 있어요.'),
        h('p', { class: 'muted small' }, standalone() ? '지금은 홈 화면 앱으로 열었어요. 앞으로도 이 아이콘으로 열어 주세요.' : '아이폰에서 ‘홈 화면에 추가’를 하면 그 아이콘은 따로 가입해야 해요. 홈 화면 아이콘으로 쓸 거라면 그 아이콘에서 가입해 주세요.'),
        persistNote));
    // 브라우저가 열쇠를 지울 수 있는 상태인지 알려 준다
    try { navigator.storage?.persisted?.().then((ok) => { if (ok === false && persistNote.isConnected) persistNote.textContent = '이 브라우저는 저장 공간을 정리할 때 열쇠를 지울 수 있어요. 자주 여는 브라우저에서 쓰는 게 안전해요.'; }).catch(() => {}); } catch { /* 선택 */ }
  }

  // 닉네임·고유닉을 잘못 적었거나 기기가 멈췄을 때: 이 휴대폰의 열쇠를 새로 만들어 다시 가입
  function fixButton(p) {
    let sure = 0;
    const b = h('button', { class: 'btn btn-line', type: 'button' }, '정보 고치고 다시 가입');
    b.onclick = async () => {
      if (Date.now() - sure > 5000) { sure = Date.now(); b.textContent = '한 번 더 누르면 새로 가입'; return; }
      b.disabled = true;
      try { await resetDevice(); } catch { /* 없던 열쇠 */ }
      store.remove(PROFILE);
      showSignup('', p);
    };
    return b;
  }
}
