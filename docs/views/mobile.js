// /app — 휴대폰 브라우저로 가입 신청하고 팬페이지를 꾸민다(승인 기기 = 이 브라우저의 열쇠).
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

// 빈 칸(null)을 글자로 넣지 않도록 뺀다
const fill = (el, ...kids) => el.replaceChildren(...kids.filter((k) => k !== null && k !== undefined && k !== false));
// ---------- 설명 ----------
const HELP = [
  ['고유닉이 뭐예요? 어디서 봐요?', '스푼 앱 아래쪽 MY → 내 프로필에서 닉네임 밑에 @로 시작하는 영어 아이디예요. @는 빼고 적어 주세요. 예: @jun_live → jun_live'],
  ['비밀번호나 개인정보가 필요해요?', '아니요. 스푼 닉네임과 고유닉만 받아요. 비밀번호·전화번호는 묻지 않아요. 적은 정보는 사용 승인과 팬페이지 연결에만 써요.'],
  ['승인은 얼마나 걸려요?', '지금(베타)은 보통 바로 승인돼요. "승인 기다리는 중"이 보이면 잠시 뒤 "다시 확인"을 눌러 주세요.'],
  ['휴대폰으로 방송할 때 봇은요?', '방송 봇은 PC의 JUN LIVE 프로그램에서 돌아가요. PC 프로그램에 봇용 부계정을 로그인해 두고 그 계정을 고정 매니저로 지정하면, 휴대폰으로 방송해도 PC가 켜져 있는 동안 봇이 방송에 들어가요.'],  ['휴대폰을 바꾸거나 브라우저 기록을 지웠어요', '이 화면에서 다시 가입하면 돼요. 팬페이지 내용은 그대로 남아 있어요.'],
];
function helpCard() {
  return h('section', { class: 'card pad stack m-help' },
    h('h2', { class: 'sec-title sm' }, '자주 묻는 질문'),
    ...HELP.map(([q, a]) => h('details', null, h('summary', null, q), h('p', { class: 'muted small' }, a))));
}
function guideCard() {
  const step = (n, title, text) => h('li', null, h('span', { class: 'm-num' }, n), h('div', null, h('b', null, title), h('p', { class: 'muted small' }, text)));
  return h('section', { class: 'card pad stack' },
    h('h2', { class: 'sec-title sm' }, '이렇게 시작해요'),
    h('ol', { class: 'm-guide' },
      step('1', '가입 신청', '스푼 닉네임과 고유닉을 적어요. 1분이면 끝나요.'),
      step('2', '팬페이지 꾸미기', '승인되면 팬들이 볼 나만의 팬페이지를 휴대폰에서 바로 꾸며요.'),
      step('3', '방송 봇은 PC에서', 'PC의 JUN LIVE 프로그램을 켜 두면 휴대폰 방송에도 봇이 들어가요.')));
}

export async function renderMobile(root, app) {
  document.title = '모바일 팬페이지 · JUN LIVE';
  const shell = h('div', { class: 'fp intro mobile-app' });
  applyTheme(shell, 'lavender');
  applyTheme(document.documentElement, 'lavender');
  const body = h('div', { class: 'stack' });
  const persistNote = h('p', { class: 'muted small' });
  const standalone = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; } };
  shell.append(h('main', { id: 'main', class: 'fp-main intro-main', tabindex: '-1' },
    h('section', { class: 'intro-hero' },
      h('span', { class: 'eyebrow' }, 'JUN LIVE 모바일'),
      h('h1', { class: 'display' }, '휴대폰으로\n팬페이지를 꾸며요'),
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
    h('h2', { class: 'sec-title sm' }, '가입 신청'),
    h('p', { class: 'muted small' }, '방송하는 스푼 계정 정보를 적어 주세요. 비밀번호·전화번호는 필요 없어요.'),
    h('div', { class: 'field' }, h('label', { for: 'm-nick' }, '스푼 닉네임'), nick,
      h('p', { class: 'field-hint' }, '방송에 보이는 이름 그대로 적어 주세요.')),
    h('div', { class: 'field' }, h('label', { for: 'm-tag' }, '스푼 고유닉 (@ 뒤 영어 아이디)'), tag,
      h('p', { class: 'field-hint' }, '스푼 앱 MY → 내 프로필에서 닉네임 밑 @아이디예요. @는 빼고 적어요.')),
    h('p', { class: 'field-hint' }, '한 번 신청한 닉네임·고유닉은 바꿀 수 없어요. 틀렸다면 신청 뒤 "정보 고치고 다시 가입"을 눌러 주세요.'),
    msg, btn));
    body.prepend(guideCard());
    body.append(helpCard());
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
      r.state === 'approved' ? h('p', { class: 'muted small' }, '팬페이지 꾸미기: 팬들이 볼 나만의 페이지를 만들고 공개해요.') : null,
      r.state === 'approved' ? openBtn : h('button', { class: 'btn btn-line', type: 'button', onclick: () => showStatus(p) }, '다시 확인'),
      r.state === 'revoked' ? h('p', { class: 'field-hint bad' }, '아래 휴대폰 코드를 관리자에게 알려 주세요.') : null,
      h('p', { class: 'muted small' }, '이 휴대폰 코드: ', h('code', { class: 'm-code' }, r.code || '')),
      r.state === 'approved' ? null : fixButton(p));
    body.append(
      h('section', { class: 'card pad stack' },
        h('h2', { class: 'sec-title sm' }, '꼭 읽어 주세요'),
        h('p', { class: 'muted small' }, '승인 열쇠는 지금 쓰는 브라우저 안에만 저장돼요. 사이트 데이터를 지우거나, 이 브라우저를 오래(아이폰은 7일 넘게) 안 쓰면 다시 가입해야 할 수 있어요.'),
        h('p', { class: 'muted small' }, standalone() ? '지금은 홈 화면 앱으로 열었어요. 앞으로도 이 아이콘으로 열어 주세요.' : '아이폰에서 ‘홈 화면에 추가’를 하면 그 아이콘은 따로 가입해야 해요. 홈 화면 아이콘으로 쓸 거라면 그 아이콘에서 가입해 주세요.'),
        persistNote),
      helpCard());
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
