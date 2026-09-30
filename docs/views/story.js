// 사연 보내기: DJ가 방송 중 사연함을 열면, 팬이 로그인 없이 글·사진을 보낸다.
// 보상(복권·룰렛권 등)을 받으려면 스푼 고유닉을 적어야 DJ 프로그램이 누구인지 알 수 있다.
import { h, applyTheme, store, toast, field } from '../lib/dom.js';
import { api } from '../api.js';
import { prepareImage } from '../lib/image.js';
import { charCount } from '../lib/text.js';
import { ilink, loading, errorBox } from './common.js';

const NICK = 'fp_nick', TAG = 'fp_tag';
const LIMIT = 300;

export async function renderStory(root, route, app) {
  document.title = '사연 보내기 · JUN LIVE';
  const shell = h('div', { class: 'fp' });
  applyTheme(shell, 'rose');
  const main = h('main', { id: 'main', class: 'fp-main', tabindex: '-1' }, loading());
  shell.append(main);
  root.replaceChildren(shell);
  let page, box;
  try { page = await api.page(route.slug); box = await api.storybox(page.page.id); }
  catch (e) { main.replaceChildren(errorBox(e.status === 404 ? '팬페이지를 찾을 수 없어요. 주소를 확인해 주세요.' : e.message, () => renderStory(root, route, app))); return; }
  const theme = page.page.config?.theme || 'rose';
  applyTheme(shell, theme); applyTheme(document.documentElement, theme);
  const name = page.page.config?.profile?.name || 'DJ';
  document.title = `${name}에게 사연 보내기`;
  shell.prepend(h('header', { class: 'fp-top' }, ilink(app.link({ name: 'fan', slug: route.slug }), { class: 'fp-brand' }, `${name}의 팬페이지`)));
  const card = h('section', { class: 'card pad stack story-form' });
  main.replaceChildren(card);
  paint();

  function paint() {
    card.replaceChildren(h('h1', { class: 'sec-title' }, '📮 사연 보내기'));
    if (!box.open) {
      card.append(h('p', { class: 'muted' }, '지금은 사연을 받지 않아요. DJ가 방송 중에 사연함을 열면 여기서 보낼 수 있어요.'),
        h('button', { type: 'button', class: 'btn btn-line', onclick: async () => { try { box = await api.storybox(page.page.id); paint(); } catch (e) { toast(e.message, 'error'); } } }, '다시 확인'));
      return;
    }
    if (box.note) card.append(h('p', { class: 'story-note' }, '오늘의 주제: ', h('b', null, box.note)));
    card.append(h('p', { class: 'muted small' }, '글이나 사진으로 사연을 보내 주세요. DJ가 방송에서 읽고 화면에 보여 줄 수 있어요.'));
    card.append(form());
  }

  function form() {
    const status = h('p', { class: 'form-status', role: 'status', 'aria-live': 'polite' });
    const nick = field({ label: '닉네임', value: store.get(NICK, '') || '', max: 20, placeholder: '방송 닉네임', autocomplete: 'nickname', required: true });
    const tag = field({ label: '스푼 고유닉 (@ 뒤 영어 아이디)', value: store.get(TAG, '') || '', max: 40, placeholder: '예: jun_live', autocomplete: 'off', hint: '보상(복권·룰렛권 등)을 받으려면 꼭 적어 주세요. 스푼 앱 MY → 내 프로필에서 @ 뒤 아이디예요.' });
    tag.input.setAttribute('autocapitalize', 'none'); tag.input.setAttribute('spellcheck', 'false');
    const body = field({ label: '사연', max: LIMIT, multiline: true, rows: 5, placeholder: '들려주고 싶은 이야기를 적어 주세요' });
    const file = h('input', { type: 'file', accept: 'image/*', id: 'story_photo' });
    const preview = h('img', { class: 'story-preview', alt: '고른 사진', hidden: true });
    const removeBtn = h('button', { type: 'button', class: 'btn btn-line small', hidden: true, onclick: () => { photo = null; file.value = ''; preview.hidden = true; removeBtn.hidden = true; } }, '사진 빼기');
    const photoBox = h('div', { class: 'field' }, h('label', { for: 'story_photo' }, '사진 (선택)'), file, preview, removeBtn);
    let photo = null;
    file.addEventListener('change', async () => {
      const f = file.files?.[0]; if (!f) return;
      status.textContent = '사진을 준비하는 중…';
      try { photo = await prepareImage(f); preview.src = photo.preview; preview.hidden = false; removeBtn.hidden = false; status.textContent = ''; }
      catch (e) { photo = null; file.value = ''; status.textContent = e.message; }
    });
    const submit = h('button', { type: 'submit', class: 'btn btn-accent big' }, '사연 보내기');
    const form = h('form', { class: 'comment-form', novalidate: true }, nick, tag, body, photoBox, h('div', { class: 'form-foot' }, status, submit));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nickname = nick.input.value.trim(), tagValue = tag.input.value.trim().replace(/^@/, ''), text = body.input.value.trim();
      if (!nickname) { status.textContent = '닉네임을 적어 주세요.'; nick.input.focus(); return; }
      if (tagValue && !/^[A-Za-z0-9._-]{1,40}$/.test(tagValue)) { status.textContent = '고유닉은 영문·숫자로 적어 주세요. (@는 빼요)'; tag.input.focus(); return; }
      if (!text && !photo) { status.textContent = '사연 글이나 사진을 넣어 주세요.'; body.input.focus(); return; }
      if (charCount(text) > LIMIT) { status.textContent = `${LIMIT}자까지 쓸 수 있어요.`; return; }
      submit.disabled = true; status.textContent = '보내는 중…';
      try {
        await api.story({ page: page.page.id, nickname, tag: tagValue, body: text, ...(photo ? { data: photo.data, thumb: photo.thumb, w: photo.w, h: photo.h } : {}) }, (r) => { status.textContent = `보내는 중… ${Math.round(r * 100)}%`; });
        store.set(NICK, nickname); if (tagValue) store.set(TAG, tagValue);
        // replaceChildren는 null을 글자로 넣으므로 빈 칸은 뺀다
        card.replaceChildren(...[h('h1', { class: 'sec-title' }, '📮 보냈어요!'),
          h('p', null, `${nickname}님의 사연이 DJ에게 전해졌어요. 방송을 들으며 기다려 주세요.`),
          tagValue ? null : h('p', { class: 'muted small' }, '고유닉을 적지 않아서 이 사연은 보상을 받을 수 없어요.'),
          h('button', { type: 'button', class: 'btn btn-line', onclick: paint }, '하나 더 보내기'),
          ilink(app.link({ name: 'fan', slug: route.slug }), { class: 'btn btn-line' }, '팬페이지로')].filter(Boolean));
      } catch (err) { status.textContent = err.message; submit.disabled = false; }
    });
    return form;
  }
}
