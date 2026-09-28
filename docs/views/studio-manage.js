// 스튜디오 · 글·사진 올리기, 팬 댓글 관리, 투표, 출석 현황.
import { h, icon, clear, toast, confirmDialog, field, toggle } from '../lib/dom.js';
import { FORMS, POST_FORMS, LIMITS } from '../lib/config.js';
import { formatDate, relativeTime, charCount, percent, clip } from '../lib/text.js';
import { prepareImage } from '../lib/image.js';
import { api, photoUrl } from '../api.js';

function menuSelect(menus, current, onPick, label = '메뉴') {
  const id = 'ms_' + Math.random().toString(36).slice(2, 7);
  const sel = h('select', { id }, menus.map((m) => h('option', { value: m.id, selected: m.id === current }, `${m.name} · ${FORMS[m.form].name}${m.visible ? '' : ' (숨김)'}`)));
  sel.addEventListener('change', () => onPick(sel.value));
  return h('div', { class: 'field inline' }, h('label', { for: id }, label), sel);
}

function needMenu(st, el, forms, text) {
  el.append(h('div', { class: 'st-card st-stack' }, h('p', null, text), h('button', { type: 'button', class: 'btn btn-dark', onclick: () => st.setTab('menus') }, '메뉴 탭으로 가기')));
  void forms;
}

const statusLine = () => h('p', { class: 'small', role: 'status', 'aria-live': 'polite' });

// ================= 글·사진 올리기 =================
export function postsTab(st) {
  const el = h('div', { class: 'st-stack' });
  if (!st.requirePage(el)) return el;
  const menus = st.draft.menus.filter((m) => POST_FORMS.includes(m.form));
  if (!menus.length) { needMenu(st, el, POST_FORMS, '글을 올릴 메뉴가 없어요. 메뉴 탭에서 ‘글 게시판’, ‘사진 + 글’, ‘사진 앨범’, ‘박제판’ 양식의 메뉴를 만들어 주세요.'); return el; }
  if (!menus.some((m) => m.id === st.postMenu)) st.postMenu = menus[0].id;
  const listBox = h('div', { class: 'st-stack' });
  const editorBox = h('div');
  el.append(h('div', { class: 'st-card row gap wrap center' }, menuSelect(menus, st.postMenu, (id) => { st.postMenu = id; drawList(); editorBox.replaceChildren(); }, '올릴 메뉴')), h('div', { class: 'posts-tab' }, listBox, editorBox));

  let before = null;
  function drawList() {
    const menu = menus.find((m) => m.id === st.postMenu);
    before = null;
    const ul = h('ul', { class: 'st-post-list' });
    const more = h('button', { type: 'button', class: 'btn btn-line', hidden: true }, '더 보기');
    const status = statusLine();
    listBox.replaceChildren(h('section', { class: 'st-card st-stack' },
      h('div', { class: 'sec-title-row' }, h('h2', null, `${menu.name}의 글`), h('button', { type: 'button', class: 'btn btn-primary', onclick: () => openEditor(menu, null) }, icon('plus', { size: 16 }), '새 글 쓰기')),
      ul, status, more));
    const load = async () => {
      status.textContent = '불러오는 중…'; more.disabled = true;
      try {
        const r = await api.ownerPosts({ page: st.page.id, menu: menu.id, before: before || undefined });
        const posts = r.posts || [];
        const plain = posts.filter((p) => !p.pinned);
        if (plain.length) before = plain.at(-1).created; else if (posts.length) before = posts.at(-1).created;
        posts.forEach((p) => ul.append(h('li', null, h('button', { type: 'button', class: 'st-post-row', onclick: () => openEditor(menu, p) },
          p.photos?.[0] ? h('img', { src: photoUrl(p.photos[0].thumb), alt: '', width: p.photos[0].w, height: p.photos[0].h, style: { 'aspect-ratio': `${p.photos[0].w} / ${p.photos[0].h}` } }) : h('span', { class: 'thumb-empty', 'aria-hidden': 'true' }, icon('comment', { size: 18 })),
          h('span', { class: 'col grow' }, h('b', null, p.title || clip(p.body, 26) || '(제목 없음)'), h('span', { class: 'small muted' }, `${formatDate(p.created)}${p.photos?.length ? ` · 사진 ${p.photos.length}` : ''} · ♡ ${p.likes || 0} · 댓글 ${p.comments || 0}`)),
          p.pinned ? h('span', { class: 'st-badge' }, '고정') : null))));
        status.textContent = ul.children.length ? '' : '아직 올린 글이 없어요. ‘새 글 쓰기’를 눌러 보세요.';
        more.hidden = !r.more;
      } catch (e) { status.textContent = e.message; }
      more.disabled = false;
    };
    more.onclick = load;
    load();
  }

  function openEditor(menu, post) {
    const photoForm = menu.form !== 'board';
    const d = post ? JSON.parse(JSON.stringify(post)) : { title: '', body: '', photos: [], category: '', pinned: false, supporter: '', eventDate: '' };
    const items = d.photos.map((p) => ({ photo: p }));
    const status = statusLine();
    const photoList = h('ul', { class: 'photo-edit', 'aria-label': '사진 목록' });
    const fileIn = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, class: 'sr-only', id: 'post_files' });
    const addLabel = h('label', { for: 'post_files', class: 'btn btn-line' }, icon('photo', { size: 18 }), '사진 고르기');
    const photoCount = h('span', { class: 'small muted' });
    const saveBtn = h('button', { type: 'submit', class: 'btn btn-primary' }, post ? '고친 내용 저장' : '올리기');
    const busy = () => items.some((it) => !it.photo && !it.error);

    function drawPhotos() {
      clear(photoList);
      items.forEach((it, i) => {
        const p = it.photo;
        photoList.append(h('li', { class: 'pe-item' },
          h('div', { class: 'pe-view', style: p ? { 'aspect-ratio': `${p.w} / ${p.h}` } : null },
            p ? h('img', { src: photoUrl(p.thumb), alt: `${i + 1}번째 사진`, width: p.w, height: p.h })
              : h('span', { class: 'small' }, it.error ? '⚠ ' + it.error : it.status),
            !p && !it.error ? h('progress', { max: 100, value: Math.round((it.progress || 0) * 100), 'aria-label': `${i + 1}번째 사진 올리는 중` }) : null),
          h('div', { class: 'pe-tools' },
            h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': `${i + 1}번째 사진 앞으로`, disabled: i === 0 || !p, onclick: () => { [items[i - 1], items[i]] = [items[i], items[i - 1]]; drawPhotos(); } }, icon('back', { size: 16 })),
            h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': `${i + 1}번째 사진 뒤로`, disabled: i === items.length - 1 || !p, onclick: () => { [items[i + 1], items[i]] = [items[i], items[i + 1]]; drawPhotos(); } }, icon('next', { size: 16 })),
            h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': `${i + 1}번째 사진 빼기`, disabled: !p && !it.error, onclick: () => { items.splice(i, 1); drawPhotos(); } }, icon('close', { size: 16 })))));
      });
      photoCount.textContent = `${items.length} / ${LIMITS.postPhotos}장`;
      fileIn.disabled = items.length >= LIMITS.postPhotos;
      addLabel.classList.toggle('disabled', items.length >= LIMITS.postPhotos);
      saveBtn.disabled = busy();
    }

    fileIn.addEventListener('change', async () => {
      const files = [...(fileIn.files || [])];
      fileIn.value = '';
      const room = LIMITS.postPhotos - items.length;
      if (files.length > room) toast(`사진은 ${LIMITS.postPhotos}장까지예요. ${room}장만 올릴게요.`, 'error');
      const jobs = files.slice(0, room).map((f) => { const it = { status: '기다리는 중…', progress: 0 }; items.push(it); return [f, it]; });
      drawPhotos();
      for (const [f, it] of jobs) {
        try {
          it.status = '줄이는 중…'; drawPhotos();
          const img = await prepareImage(f);
          it.status = '올리는 중…'; drawPhotos();
          const r = await api.uploadPhoto({ data: img.data, thumb: img.thumb, w: img.w, h: img.h }, (x) => { it.progress = x; const bar = photoList.children[items.indexOf(it)]?.querySelector('progress'); if (bar) bar.value = Math.round(x * 100); });
          it.photo = { path: r.path, thumb: r.thumb, w: r.w, h: r.h };
        } catch (e) { it.error = e.message; }
        drawPhotos();
      }
      status.textContent = items.some((i) => i.error) ? '올리지 못한 사진이 있어요. ×로 빼고 다시 골라 주세요.' : '';
    });

    const cats = menu.options.categories || [];
    const catSel = cats.length ? (() => {
      const sel = h('select', { id: 'post_cat' }, h('option', { value: '' }, '분류 없음'), cats.map((c) => h('option', { value: c, selected: c === d.category }, c)));
      return h('div', { class: 'field' }, h('label', { for: 'post_cat' }, '분류'), sel);
    })() : null;
    const title = field({ label: menu.form === 'board' ? '제목' : '제목 (선택)', value: d.title, max: LIMITS.postTitle });
    const body = field({ label: '글', value: d.body, max: LIMITS.postBody, multiline: true, rows: 6 });
    const supporter = menu.form === 'archive' ? field({ label: '함께한 후원자 (선택)', value: d.supporter, max: LIMITS.supporter, placeholder: '후원자 닉네임' }) : null;
    const date = field({ label: '그날 날짜 (선택)', value: d.eventDate, type: 'date' });
    let pinned = !!d.pinned;
    const form = h('form', { class: 'st-card st-stack', novalidate: true },
      h('div', { class: 'sec-title-row' }, h('h2', null, post ? '글 고치기' : '새 글 쓰기'), h('button', { type: 'button', class: 'btn btn-line', onclick: () => editorBox.replaceChildren() }, '닫기')),
      title, body,
      h('div', { class: 'st-stack' },
        h('div', { class: 'sec-title-row' }, h('b', { class: 'small' }, photoForm ? '사진 (1장 이상)' : '사진 (선택)'), photoCount),
        h('p', { class: 'small muted' }, '여러 장을 한 번에 고를 수 있어요. 사진은 잘리지 않고 원래 비율로 보여요.'),
        photoList, fileIn, addLabel),
      catSel, supporter, date,
      toggle({ label: '맨 위에 고정', checked: pinned, onChange: (v) => { pinned = v; } }),
      h('div', { class: 'row gap end wrap' },
        post ? h('button', { type: 'button', class: 'btn btn-line danger-text', onclick: async () => {
          if (!(await confirmDialog('이 글을 지울까요?', { ok: '지우기', danger: true, detail: '사진과 댓글도 함께 지워지고 되돌릴 수 없어요.' }))) return;
          try { await api.deletePost(post.id); toast('글을 지웠어요.'); editorBox.replaceChildren(); drawList(); } catch (e) { status.textContent = e.message; }
        } }, '지우기') : null,
        saveBtn),
      status);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy()) { status.textContent = '사진을 올리는 중이에요. 잠시만 기다려 주세요.'; return; }
      const photos = items.filter((i) => i.photo).map((i) => i.photo);
      const t = title.input.value.trim(), b = body.input.value;
      if (menu.form === 'board' && !t) { status.textContent = '제목을 적어 주세요.'; title.input.focus(); return; }
      if (photoForm && !photos.length) { status.textContent = '사진을 한 장 이상 올려 주세요.'; return; }
      if (charCount(t) > LIMITS.postTitle || charCount(b) > LIMITS.postBody) { status.textContent = '글자 수를 줄여 주세요.'; return; }
      saveBtn.disabled = true; status.textContent = '저장 중…';
      try {
        if (!(await st.flush())) throw new Error('메뉴 설정을 먼저 저장하지 못했어요. 위의 저장 상태를 확인해 주세요.');
        await api.savePost({
          id: post?.id, menu: menu.id, title: t, body: b, photos, category: catSel ? catSel.querySelector('select').value : '',
          pinned, supporter: supporter ? supporter.input.value.trim() : '', eventDate: date.input.value || '',
        });
        toast(post ? '고친 내용을 저장했어요.' : '올렸어요!');
        editorBox.replaceChildren(); drawList();
      } catch (err) { status.textContent = err.message; saveBtn.disabled = false; }
    });
    drawPhotos();
    editorBox.replaceChildren(form);
    title.input.focus();
  }

  drawList();
  return el;
}

// ================= 팬 댓글 관리 =================
export function commentsTab(st) {
  const el = h('div', { class: 'st-stack' });
  if (!st.requirePage(el)) return el;
  const menus = st.draft.menus.filter((m) => m.form === 'lounge' || (FORMS[m.form].posts && m.options.allowComments));
  const nameOf = (id) => st.draft.menus.find((m) => m.id === id)?.name || '지운 메뉴';
  const listEl = h('ul', { class: 'st-comments' });
  const status = statusLine();
  const more = h('button', { type: 'button', class: 'btn btn-line', hidden: true }, '더 보기');
  let menu = st.commentMenu || '';
  let before = null;
  const sel = h('select', { id: 'cm_menu' }, h('option', { value: '' }, '모든 메뉴'), menus.map((m) => h('option', { value: m.id, selected: m.id === menu }, m.name)));
  sel.addEventListener('change', () => { menu = sel.value; st.commentMenu = menu; reload(); });

  function item(c) {
    const li = h('li', { class: 'st-comment' + (c.hidden ? ' is-hidden' : '') });
    const draw = () => {
      li.className = 'st-comment' + (c.hidden ? ' is-hidden' : '');
      const replyBox = h('div', { class: 'reply-edit', hidden: true });
      const heart = h('button', { type: 'button', class: 'mini-btn' + (c.hearted ? ' on' : ''), 'aria-pressed': String(!!c.hearted) }, c.hearted ? '♥ 마음 남김' : '♡ 마음 남기기');
      heart.onclick = () => act({ id: c.id, hearted: !c.hearted });
      const replyBtn = h('button', { type: 'button', class: 'mini-btn', 'aria-expanded': 'false' }, c.reply ? '답글 고치기' : '답글');
      replyBtn.onclick = () => {
        const f = field({ label: 'DJ의 답글', value: c.reply || '', max: LIMITS.comment, multiline: true, rows: 2 });
        replyBox.replaceChildren(f, h('div', { class: 'row gap end' },
          c.reply ? h('button', { type: 'button', class: 'mini-btn', onclick: () => act({ id: c.id, reply: null }) }, '답글 지우기') : null,
          h('button', { type: 'button', class: 'mini-btn', onclick: () => { replyBox.hidden = true; replyBtn.setAttribute('aria-expanded', 'false'); } }, '취소'),
          h('button', { type: 'button', class: 'mini-btn dark', onclick: () => { const v = f.input.value.trim(); if (charCount(v) > LIMITS.comment) return; act({ id: c.id, reply: v || null }); } }, '저장')));
        replyBox.hidden = false; replyBtn.setAttribute('aria-expanded', 'true'); f.input.focus();
      };
      li.replaceChildren(
        h('div', { class: 'row gap center wrap' }, h('b', null, c.nickname), h('span', { class: 'small muted' }, `${relativeTime(c.created)} · ${nameOf(c.menu)}${c.post ? ' · 글 댓글' : ''}`),
          c.hidden ? h('span', { class: 'st-badge' }, '숨김') : null, c.ipBlocked ? h('span', { class: 'st-badge bad' }, '차단됨') : null),
        h('p', { class: 'comment-body' }, c.body),
        c.reply ? h('p', { class: 'small reply-view' }, h('b', null, 'DJ의 답글 · '), c.reply) : null,
        h('div', { class: 'row gap wrap' },
          heart, replyBtn,
          h('button', { type: 'button', class: 'mini-btn', onclick: () => act({ id: c.id, hidden: !c.hidden }) }, c.hidden ? '다시 보이기' : '숨기기'),
          h('button', { type: 'button', class: 'mini-btn danger-text', onclick: async () => {
            if (!(await confirmDialog('이 댓글을 지울까요?', { ok: '지우기', danger: true, detail: '되돌릴 수 없어요.' }))) return;
            try { await api.deleteComment(c.id); li.remove(); toast('지웠어요.'); } catch (e) { toast(e.message, 'error'); }
          } }, '삭제'),
          c.ipBlocked ? null : h('button', { type: 'button', class: 'mini-btn danger-text', onclick: async () => {
            if (!(await confirmDialog(`‘${c.nickname}’님을 차단할까요?`, { ok: '차단하기', danger: true, detail: '이 사람의 인터넷 주소와 닉네임으로는 더 이상 댓글을 남길 수 없어요.' }))) return;
            try { await api.block(c.id); c.ipBlocked = true; draw(); toast('차단했어요.'); } catch (e) { toast(e.message, 'error'); }
          } }, '차단')),
        replyBox);
    };
    async function act(body) {
      li.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      try { const r = await api.ownerComment(body); Object.assign(c, r.comment); } catch (e) { toast(e.message, 'error'); }
      draw();
    }
    draw();
    return li;
  }

  async function load() {
    status.textContent = '불러오는 중…'; more.disabled = true;
    try {
      const r = await api.ownerComments({ menu: menu || undefined, before: before || undefined });
      r.comments.forEach((c) => listEl.append(item(c)));
      if (r.comments.length) before = r.comments.at(-1).created;
      status.textContent = listEl.children.length ? '' : '아직 댓글이 없어요.';
      more.hidden = !r.more;
    } catch (e) { status.textContent = e.message; }
    more.disabled = false;
  }
  function reload() { before = null; clear(listEl); load(); }
  more.onclick = load;
  el.append(h('section', { class: 'st-card st-stack' },
    h('div', { class: 'sec-title-row wrap' }, h('h2', null, '팬 댓글 관리'), h('div', { class: 'field inline' }, h('label', { for: 'cm_menu' }, '메뉴'), sel)),
    h('p', { class: 'small muted' }, '♡ 마음을 남기면 팬 화면에 “DJ가 마음을 남겼어요”가 보여요. 숨긴 댓글은 팬에게 보이지 않아요.'),
    listEl, status, more));
  load();
  return el;
}

// ================= 투표 =================
export function pollsTab(st) {
  const el = h('div', { class: 'st-stack' });
  if (!st.requirePage(el)) return el;
  const menus = st.draft.menus.filter((m) => m.form === 'poll');
  if (!menus.length) { needMenu(st, el, ['poll'], '투표 메뉴가 없어요. 메뉴 탭에서 ‘투표’ 양식의 메뉴를 만들어 주세요.'); return el; }
  if (!menus.some((m) => m.id === st.pollMenu)) st.pollMenu = menus[0].id;
  const current = h('section', { class: 'st-card st-stack', 'aria-live': 'polite' });
  const make = h('section', { class: 'st-card st-stack' });
  el.append(menus.length > 1 ? h('div', { class: 'st-card' }, menuSelect(menus, st.pollMenu, (id) => { st.pollMenu = id; loadCurrent(); }, '투표 메뉴')) : '', current, make);
  let poll = null;

  async function loadCurrent() {
    current.replaceChildren(h('p', { class: 'small' }, '불러오는 중…'));
    try {
      await st.flush();
      const r = await api.ownerPoll({ page: st.page.id, menu: st.pollMenu });
      poll = r.poll;
      drawCurrent();
    } catch (e) { current.replaceChildren(h('p', { class: 'small bad' }, e.message)); }
  }
  function drawCurrent() {
    if (!poll) { current.replaceChildren(h('h2', null, '지금 투표'), h('p', { class: 'small muted' }, '아직 만든 투표가 없어요. 아래에서 새 투표를 만들어 주세요.')); return; }
    current.replaceChildren(
      h('div', { class: 'sec-title-row' }, h('h2', null, poll.closed ? '지난 투표 · 마감됨' : '지금 진행 중인 투표'),
        poll.closed ? null : h('button', { type: 'button', class: 'btn btn-line', onclick: async () => {
          if (!(await confirmDialog('투표를 마감할까요?', { ok: '마감하기', detail: '팬들이 더 이상 투표할 수 없어요. 결과는 계속 보여요.' }))) return;
          try { await api.closePoll(st.pollMenu); toast('투표를 마감했어요.'); loadCurrent(); } catch (e) { toast(e.message, 'error'); }
        } }, '마감하기')),
      h('b', null, poll.question),
      poll.description ? h('p', { class: 'small muted' }, poll.description) : null,
      h('ul', { class: 'st-poll' }, poll.options.map((o) => {
        const pct = percent(o.votes, poll.total);
        return h('li', null, h('span', { class: 'st-poll-bar', style: { width: pct + '%' }, 'aria-hidden': 'true' }), h('span', { class: 'grow' }, o.label), h('b', null, `${o.votes}표 · ${pct}%`));
      })),
      h('p', { class: 'small muted' }, `모두 ${poll.total}명 참여`));
  }
  function drawMake() {
    const options = ['', ''];
    const q = field({ label: '질문', max: LIMITS.pollQuestion, placeholder: '다음 주 특집은 뭘로 할까요?' });
    const desc = field({ label: '설명 (선택)', max: LIMITS.pollDesc, multiline: true, rows: 2 });
    const optBox = h('div', { class: 'st-stack' });
    const status = statusLine();
    const drawOpts = () => optBox.replaceChildren(
      ...options.map((v, i) => {
        const id = 'po_' + i;
        const input = h('input', { id, maxlength: LIMITS.pollOption, placeholder: `선택지 ${i + 1}` });
        input.value = v;
        input.addEventListener('input', () => { options[i] = input.value; });
        return h('div', { class: 'row gap center' }, h('label', { for: id, class: 'small opt-num' }, `${i + 1}`), input,
          options.length > LIMITS.pollMin ? h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': `선택지 ${i + 1} 빼기`, onclick: () => { options.splice(i, 1); drawOpts(); } }, icon('close', { size: 16 })) : null);
      }),
      options.length < LIMITS.pollMax ? h('button', { type: 'button', class: 'mini-btn', onclick: () => { options.push(''); drawOpts(); optBox.querySelector(`#po_${options.length - 1}`)?.focus(); } }, '+ 선택지 추가') : h('p', { class: 'small muted' }, `선택지는 ${LIMITS.pollMax}개까지예요.`));
    drawOpts();
    const btn = h('button', { type: 'submit', class: 'btn btn-primary' }, '투표 시작하기');
    const form = h('form', { class: 'st-stack', novalidate: true }, h('h2', null, '새 투표 만들기'), q, desc, h('b', { class: 'small' }, `선택지 (${LIMITS.pollMin}~${LIMITS.pollMax}개)`), optBox, h('div', { class: 'row end' }, btn), status);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const question = q.input.value.trim();
      const opts = options.map((o) => o.trim()).filter(Boolean);
      if (!question) { status.textContent = '질문을 적어 주세요.'; q.input.focus(); return; }
      if (opts.length < LIMITS.pollMin) { status.textContent = '선택지를 2개 이상 적어 주세요.'; return; }
      if (new Set(opts).size !== opts.length) { status.textContent = '같은 선택지가 있어요.'; return; }
      if (poll && !poll.closed && !(await confirmDialog('새 투표를 시작할까요?', { ok: '시작하기', detail: '지금 진행 중인 투표는 마감돼요.' }))) return;
      btn.disabled = true; status.textContent = '만드는 중…';
      try {
        if (!(await st.flush())) throw new Error('메뉴 설정을 먼저 저장하지 못했어요.');
        await api.createPoll({ menu: st.pollMenu, question, description: desc.input.value.trim(), options: opts });
        toast('새 투표를 시작했어요!');
        drawMake(); loadCurrent();
      } catch (err) { status.textContent = err.message; btn.disabled = false; }
    });
    make.replaceChildren(form);
  }
  loadCurrent();
  drawMake();
  return el;
}

// ================= 출석 현황 =================
export function attendanceTab(st) {
  const el = h('div', { class: 'st-stack' });
  if (!st.requirePage(el)) return el;
  const menus = st.draft.menus.filter((m) => m.form === 'attendance');
  if (!menus.length) { needMenu(st, el, ['attendance'], '출석 체크 메뉴가 없어요. 메뉴 탭에서 ‘출석 체크’ 양식의 메뉴를 만들어 주세요.'); return el; }
  if (!menus.some((m) => m.id === st.attMenu)) st.attMenu = menus[0].id;
  const box = h('section', { class: 'st-card st-stack' });
  el.append(box);
  async function load() {
    const menu = menus.find((m) => m.id === st.attMenu);
    box.replaceChildren(h('p', { class: 'small' }, '불러오는 중…'));
    try {
      await st.flush();
      const r = await api.ownerAttendance(menu.id);
      const cards = (r.cards || []).slice().sort((a, b) => b.total - a.total);
      box.replaceChildren(
        h('div', { class: 'sec-title-row wrap' }, h('h2', null, '출석 현황'),
          h('div', { class: 'row gap center' }, menus.length > 1 ? menuSelect(menus, st.attMenu, (id) => { st.attMenu = id; load(); }, '메뉴') : null,
            h('button', { type: 'button', class: 'btn btn-line', onclick: load }, '새로고침'))),
        h('p', { class: 'small muted' }, `카드 ${cards.length}장 · 보상을 받을 사람을 확인해요.`),
        cards.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'st-table' },
          h('caption', { class: 'sr-only' }, `${menu.name} 출석 카드`),
          h('thead', null, h('tr', null, ['닉네임', '누적', '이번 달', '마지막 출석', '받을 보상'].map((t) => h('th', { scope: 'col' }, t)))),
          h('tbody', null, cards.map((c) => h('tr', null,
            h('th', { scope: 'row' }, c.nickname), h('td', null, `${c.total}번`), h('td', null, `${c.monthCount}번`),
            h('td', null, c.last || '-'), h('td', null, c.rewards?.length ? c.rewards.join(', ') : '-')))))) : h('p', { class: 'small muted' }, '아직 출석 카드가 없어요.'));
    } catch (e) { box.replaceChildren(h('p', { class: 'small bad' }, e.message)); }
  }
  load();
  return el;
}
