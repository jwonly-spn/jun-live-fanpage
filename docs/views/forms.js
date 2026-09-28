// 메뉴 양식 10가지의 팬 화면.
import { h, icon, store, toast, field, downloadFile, clear } from '../lib/dom.js';
import { clip, formatDate, initial, percent, charCount } from '../lib/text.js';
import { kstDate, sortDays, formatKoreanDate, buildIcs, parseYmd, monthGrid } from '../lib/days.js';
import { safeHttpsUrl } from '../lib/config.js';
import { api } from '../api.js';
import { framedPhoto, carousel, openViewer, masonryGrid, photoTile } from './photos.js';
import {
  ilink, extLink, loading, errorBox, empty, avatar, share, likeButton, commentItem, commentForm, commentList,
  pagedPosts, categoryTabs, markMission, missions,
} from './common.js';

const postHref = (ctx, post) => ctx.href({ postId: post.id });
const postDate = (post) => (post.eventDate && parseYmd(post.eventDate) ? formatKoreanDate(post.eventDate, true).replace(/ \(.\)$/, '') : formatDate(post.created));

// ---- 박제판 카드(인스타 피드) — 사진 글 상세에도 쓴다 ----
export function feedCard(ctx, post, menu, { detail = false } = {}) {
  const cfg = ctx.config;
  const photos = post.photos || [];
  const car = photos.length ? carousel(photos, { onOpen: (i) => openViewer(photos, i, { caption: post.title }), alt: post.title }) : null;
  const likeCount = h('b', { class: 'likes' });
  const like = likeButton(post, { onChange: (n) => { likeCount.textContent = `좋아요 ${n}개`; } });
  const allowComments = menu?.options?.allowComments;
  const body = h('p', { class: 'caption' + (detail ? '' : ' clamp') }, post.title ? h('b', null, post.title, ' ') : null, post.body);
  const long = !detail && (charCount(post.body) > 70 || /\n/.test(post.body));
  const moreBtn = long ? h('button', { type: 'button', class: 'text-btn', onclick: () => { body.classList.remove('clamp'); moreBtn.remove(); } }, '더 보기') : null;
  return h('article', { class: 'feed-card' },
    h('div', { class: 'feed-head' },
      avatar(cfg, 'sm'),
      h('div', { class: 'feed-who' }, h('b', null, cfg.profile.name), h('span', null, `${postDate(post)} · ${menu?.name || ''}`)),
      post.pinned ? h('span', { class: 'pin-badge static' }, '고정') : null),
    car ? car.el : null,
    h('div', { class: 'feed-actions' },
      like,
      allowComments && !detail ? ilink(postHref(ctx, post), { class: 'icon-btn', 'aria-label': `댓글 ${post.comments || 0}개 보기` }, icon('comment', { size: 23 })) : null,
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': '공유', onclick: () => share(location.origin + postHref(ctx, post), post.title || cfg.profile.name) }, icon('send', { size: 22 })),
      car?.dots ? h('span', { class: 'dots-wrap' }, car.dots) : null),
    h('div', { class: 'feed-text' },
      likeCount,
      post.supporter ? h('div', { class: 'supporter' }, h('span', { class: 'chip-soft' }, '함께한 후원자'), post.supporter) : null,
      post.category ? h('span', { class: 'cat-label' }, post.category) : null,
      body, moreBtn,
      allowComments && !detail && post.comments > 0 ? ilink(postHref(ctx, post), { class: 'muted-link' }, `팬 댓글 ${post.comments}개 모두 보기`) : null));
}

// ---- 글 게시판 ----
function board(ctx, menu, root) {
  const list = h('ul', { class: 'board-list' });
  const pp = pagedPosts(ctx, menu, {
    renderInto: (posts) => posts.forEach((p) => list.append(h('li', null,
      ilink(postHref(ctx, p), { class: 'board-row' },
        p.pinned ? h('span', { class: 'pin-badge static' }, '고정') : null,
        h('span', { class: 'board-title' }, p.title || clip(p.body, 30) || '제목 없음'),
        h('span', { class: 'board-meta' }, formatDate(p.created), p.photos?.length ? ` · 사진 ${p.photos.length}` : '', menu.options.allowComments && p.comments ? ` · 댓글 ${p.comments}` : ''))))),
  });
  root.append(list, pp.status, pp.moreBtn);
  pp.load();
}

// ---- 사진 + 글 ----
function photoText(ctx, menu, root) {
  let category = '';
  const wrap = h('div');
  const draw = () => {
    const grid = h('div', { class: 'card-grid' });
    const pp = pagedPosts(ctx, menu, {
      category,
      renderInto: (posts) => posts.forEach((p) => {
        const photos = p.photos || [];
        grid.append(h('article', { class: 'pt-card' },
          photos[0] ? framedPhoto(photos[0], { onOpen: () => openViewer(photos, 0, { caption: p.title }), badge: photos.length > 1 ? `1/${photos.length}` : null, label: `${p.title || '사진'} 크게 보기` }) : null,
          ilink(postHref(ctx, p), { class: 'pt-body' },
            h('div', { class: 'pt-meta' }, p.pinned ? h('span', { class: 'pin-badge static' }, '고정') : null, p.category ? h('span', { class: 'cat-label' }, p.category) : null, h('span', null, postDate(p))),
            h('b', { class: 'pt-title' }, p.title || '제목 없음'),
            p.body ? h('p', { class: 'pt-excerpt' }, p.body) : null,
            h('span', { class: 'pt-stats' }, `♡ ${p.likes || 0}`, menu.options.allowComments ? ` · 댓글 ${p.comments || 0}` : ''))));
      }),
    });
    wrap.replaceChildren(grid, pp.status, pp.moreBtn);
    pp.load();
  };
  const tabs = categoryTabs(menu.options.categories, category, (c) => { category = c; tabs.querySelectorAll('[role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.textContent === (c || '전체')))); draw(); });
  root.append(tabs || '', wrap);
  draw();
}

// ---- 사진 앨범(메이슨리) ----
function album(ctx, menu, root) {
  let category = '';
  const wrap = h('div');
  const draw = () => {
    let items = [];
    const grid = masonryGrid([], (it) => photoTile(it.photo, {
      label: `${it.post.title || '사진'} 크게 보기`, title: it.post.title, pinned: it.post.pinned,
      badge: it.post.photos.length > 1 ? `${it.post.photos.length}장` : null,
      onOpen: () => openViewer(it.post.photos, 0, { caption: it.post.title }),
    }));
    const pp = pagedPosts(ctx, menu, {
      category, emptyText: '아직 올라온 사진이 없어요.',
      renderInto: (posts) => { items = items.concat(posts.filter((p) => p.photos?.length).map((p) => ({ post: p, photo: p.photos[0] }))); grid.setItems(items); },
    });
    wrap.replaceChildren(h('p', { class: 'note' }, '사진은 자르지 않고 원래 모양 그대로 쌓여요.'), grid, pp.status, pp.moreBtn);
    pp.load();
  };
  const tabs = categoryTabs(menu.options.categories, category, (c) => { category = c; tabs.querySelectorAll('[role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.textContent === (c || '전체')))); draw(); });
  root.append(tabs || '', wrap);
  draw();
}

// ---- 박제판 ----
function archive(ctx, menu, root) {
  const feed = h('div', { class: 'feed' });
  const pp = pagedPosts(ctx, menu, { emptyText: '아직 박제된 순간이 없어요.', renderInto: (posts) => posts.forEach((p) => feed.append(feedCard(ctx, p, menu))) });
  root.classList.add('bleed');
  root.append(feed, pp.status, pp.moreBtn);
  pp.load();
}

// ---- 팬 라운지 ----
function lounge(ctx, menu, root) {
  const o = menu.options;
  const attend = ctx.menus.find((m) => m.form === 'attendance');
  const poll = ctx.menus.find((m) => m.form === 'poll');
  const missionBox = h('div');
  const drawMissions = () => {
    if (!o.showMissions) return;
    const done = missions(ctx.pageId);
    const items = [
      attend && { key: 'attend', label: '오늘 출석 스탬프 받기', href: ctx.href({ menuId: attend.id }) },
      poll && { key: 'vote', label: '이번 주 투표 참여하기', href: ctx.href({ menuId: poll.id }) },
      { key: 'answer', label: o.question ? '오늘의 질문에 답하기' : '오늘의 한마디 남기기', href: '#write' },
    ].filter(Boolean);
    const count = items.filter((i) => done[i.key]).length;
    missionBox.replaceChildren(h('section', { class: 'card pad' },
      h('div', { class: 'sec-title-row' }, h('h2', { class: 'sec-title sm' }, '오늘 할 일'), h('span', { class: 'accent-text strong' }, `${count} / ${items.length} 완료`)),
      h('ul', { class: 'missions' }, items.map((i) => h('li', { class: done[i.key] ? 'done' : '' },
        h('span', { class: 'check', 'aria-hidden': 'true' }, done[i.key] ? '✓' : ''),
        i.href.startsWith('#') ? h('a', { href: i.href }, done[i.key] ? h('s', null, i.label) : i.label) : ilink(i.href, null, done[i.key] ? h('s', null, i.label) : i.label),
        h('span', { class: 'sr-only' }, done[i.key] ? '(완료)' : '(아직)')))),
      h('p', { class: 'note' }, '이 기기에서 오늘 한 일만 표시돼요.')));
  };
  drawMissions();
  const list = commentList(ctx, menu);
  const form = commentForm(ctx, menu, { onPosted: (c) => { list.prepend(c); markMission(ctx.pageId, 'answer'); drawMissions(); }, id: 'write' });
  root.append(missionBox,
    h('section', { class: 'card pad', id: 'write' },
      h('span', { class: 'eyebrow' }, o.question ? '오늘의 질문' : '한마디 남기기'),
      h('h2', { class: 'sec-title sm' }, o.question || `${ctx.config.profile.name}에게 한마디`),
      form),
    h('section', { class: 'stack' }, h('h2', { class: 'sec-title sm' }, '최근 팬 한마디'), list));
  if (location.hash === '#write') requestAnimationFrame(() => { document.getElementById('write')?.scrollIntoView({ block: 'start' }); form.nickInput.focus({ preventScroll: true }); });
}

// ---- 출석 체크 ----
function attendance(ctx, menu, root) {
  const key = `fp_att:${ctx.pageId}:${menu.id}`;
  const rewards = (menu.options.rewards || []).slice().sort((a, b) => a.at - b.at);
  const box = h('section', { class: 'card pad stack' });
  root.append(box);
  const saved = store.get(key);
  if (saved?.nickname && saved?.pin) run('load', saved.nickname, saved.pin, true);
  else loginForm();

  function loginForm(message = '') {
    const status = h('p', { class: 'form-status', role: 'status', 'aria-live': 'polite' }, message);
    const nick = field({ label: '방송 닉네임', max: 20, value: saved?.nickname || store.get('fp_nick', '') || '', autocomplete: 'nickname' });
    const pin = field({ label: '비밀 숫자 4자리', type: 'password', max: 4, inputmode: 'numeric', autocomplete: 'off', pattern: '[0-9]{4}', hint: '직접 정한 숫자예요. 다른 기기에서 불러올 때 필요해요.' });
    const remember = h('input', { type: 'checkbox', checked: true });
    const createBtn = h('button', { type: 'submit', class: 'btn btn-accent', value: 'create' }, '새 카드 만들기');
    const loadBtn = h('button', { type: 'submit', class: 'btn btn-line', value: 'load' }, '불러오기');
    const form = h('form', { class: 'stack', novalidate: true }, nick, pin,
      h('label', { class: 'toggle' }, remember, h('span', null, '이 기기에서 기억하기')),
      h('div', { class: 'row gap' }, createBtn, loadBtn), status);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const action = e.submitter?.value || 'load';
      const n = nick.input.value.trim(), p = pin.input.value.trim();
      if (!n) { status.textContent = '닉네임을 적어 주세요.'; nick.input.focus(); return; }
      if (!/^\d{4}$/.test(p)) { status.textContent = '비밀 숫자는 숫자 4자리예요.'; pin.input.focus(); return; }
      if (ctx.preview) return;
      createBtn.disabled = loadBtn.disabled = true; status.textContent = '확인하는 중…';
      run(action, n, p, remember.checked).finally(() => { createBtn.disabled = loadBtn.disabled = false; });
    });
    clear(box).append(
      h('h2', { class: 'sec-title sm' }, '출석 스탬프 카드'),
      h('p', { class: 'note' }, '처음이면 방송 닉네임과 직접 정한 숫자 4자리로 카드를 만들어요. 다른 기기에서도 같은 닉네임과 숫자로 불러올 수 있어요.'),
      form, rewardList(0));
  }

  async function run(action, nickname, pin, remember) {
    try {
      const r = await api.attendance({ page: ctx.pageId, menu: menu.id, nickname, pin, action });
      if (remember) store.set(key, { nickname, pin }); else store.remove(key);
      store.set('fp_nick', nickname);
      if (action === 'check') { markMission(ctx.pageId, 'attend'); toast('오늘 출석했어요!'); }
      showCard(r.card, { nickname, pin, remember });
    } catch (e) {
      if (action === 'load' && remember && e.status && e.status !== 0) store.remove(key);
      loginForm(e.message);
    }
  }

  function rewardList(total) {
    if (!rewards.length) return null;
    return h('div', { class: 'rewards' }, h('b', null, '출석 보상'),
      h('ul', null, rewards.map((r) => h('li', { class: total >= r.at ? 'got' : '' }, h('span', null, `${r.at}번째 출석`), h('span', null, r.label), total >= r.at ? h('span', { class: 'accent-text' }, '✓ 달성') : null))),
      h('p', { class: 'note' }, 'JUN LIVE로 자동 지급돼요.'));
  }

  function showCard(card, cred) {
    if (card.today) markMission(ctx.pageId, 'attend');
    const total = card.total || 0;
    const start = total > 0 ? Math.floor((total - 1) / 14) * 14 : 0;
    const rewardAt = new Map(rewards.map((r) => [r.at, r.label]));
    const stamps = h('div', { class: 'stamps', role: 'list', 'aria-label': '스탬프 14칸' },
      Array.from({ length: 14 }, (_, i) => {
        const n = start + i + 1;
        const on = n <= total;
        return h('span', { role: 'listitem', class: 'stamp' + (on ? ' on' : '') + (rewardAt.has(n) ? ' gift' : ''), 'aria-label': `${n}번째 ${on ? '출석함' : '아직'}${rewardAt.has(n) ? ' · 보상 ' + rewardAt.get(n) : ''}` }, on ? '✓' : rewardAt.has(n) ? '선물' : String(n));
      }));
    const today = kstDate();
    const monthSet = new Set(card.month || []);
    const cal = h('div', { class: 'month-cal', role: 'list', 'aria-label': '이번 달 출석', hidden: true },
      ['일', '월', '화', '수', '목', '금', '토'].map((d) => h('span', { class: 'wd', 'aria-hidden': 'true' }, d)),
      monthGrid(today).map((d) => d ? h('span', { role: 'listitem', class: 'day' + (monthSet.has(d) ? ' on' : '') + (d === today ? ' today' : ''), 'aria-label': `${Number(d.slice(8))}일 ${monthSet.has(d) ? '출석' : ''}` }, String(Number(d.slice(8)))) : h('span', { 'aria-hidden': 'true' })));
    const tabS = h('button', { type: 'button', role: 'tab', 'aria-selected': 'true', class: 'seg' }, '스탬프');
    const tabM = h('button', { type: 'button', role: 'tab', 'aria-selected': 'false', class: 'seg' }, '이번 달');
    const pick = (m) => { tabS.setAttribute('aria-selected', String(!m)); tabM.setAttribute('aria-selected', String(m)); stamps.hidden = m; cal.hidden = !m; };
    tabS.onclick = () => pick(false); tabM.onclick = () => pick(true);
    const checkBtn = h('button', { type: 'button', class: 'btn btn-accent big', disabled: !!card.today }, card.today ? '오늘 출석 완료 ✓' : '오늘 출석하기');
    checkBtn.addEventListener('click', async () => { checkBtn.disabled = true; checkBtn.textContent = '도장 찍는 중…'; await run('check', cred.nickname, cred.pin, cred.remember); });
    clear(box).append(
      h('h2', { class: 'sec-title sm' }, '출석 스탬프 카드'),
      h('div', { class: 'row gap center' }, h('span', { class: 'bubble lg', 'aria-hidden': 'true' }, initial(card.nickname)),
        h('div', { class: 'col' }, h('b', null, `${card.nickname}님`), h('span', { class: 'muted small' }, `이번 달 ${(card.month || []).length}번 · 모두 ${total}번 출석`))),
      h('div', { class: 'segs', role: 'tablist', 'aria-label': '보기 방식' }, tabS, tabM),
      stamps, cal,
      card.next ? h('div', { class: 'soft-box' }, '다음 보상까지 ', h('b', null, `${Math.max(0, card.next.at - total)}번`), ` · ${card.next.at}번째 출석에 `, h('b', null, card.next.label)) : rewards.length ? h('div', { class: 'soft-box' }, '모든 보상을 받았어요. 고마워요!') : null,
      checkBtn,
      h('button', { type: 'button', class: 'text-btn', onclick: () => { store.remove(key); loginForm(); } }, '다른 닉네임으로 바꾸기'),
      rewardList(total));
  }
}

// ---- 투표 ----
function poll(ctx, menu, root) {
  const box = h('section', { class: 'card pad stack', 'aria-live': 'polite' }, loading());
  root.append(box);
  let current = null;
  async function load() {
    try { const r = await api.poll({ page: ctx.pageId, menu: menu.id }); current = r.poll; draw(); } catch (e) { box.replaceChildren(errorBox(e.message, load)); }
  }
  function draw() {
    const p = current;
    if (!p) { box.replaceChildren(h('h2', { class: 'sec-title sm' }, menu.name), empty('아직 진행 중인 투표가 없어요.')); return; }
    const showResult = p.voted !== null && p.voted !== undefined || p.closed;
    const opts = h('div', { class: 'poll-opts', role: 'group', 'aria-label': '선택지' }, p.options.map((o, i) => {
      const pct = percent(o.votes, p.total);
      const btn = h('button', { type: 'button', class: 'poll-opt' + (p.voted === i ? ' picked' : ''), 'aria-pressed': String(p.voted === i), disabled: p.closed },
        showResult ? h('span', { class: 'poll-bar', style: { width: pct + '%' }, 'aria-hidden': 'true' }) : null,
        h('span', { class: 'poll-label' }, o.label, p.voted === i ? h('span', { class: 'sr-only' }, ' (내 선택)') : null),
        showResult ? h('b', { class: 'poll-pct' }, `${pct}%`) : null);
      btn.addEventListener('click', async () => {
        if (ctx.preview || p.voted === i) return;
        opts.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        try { const r = await api.vote(p.id, i); current = r.poll; markMission(ctx.pageId, 'vote'); toast(p.voted === null || p.voted === undefined ? '투표했어요!' : '선택을 바꿨어요.'); } catch (e) { toast(e.message, 'error'); }
        draw();
      });
      return btn;
    }));
    box.replaceChildren(
      h('span', { class: 'eyebrow' }, p.closed ? '마감된 투표' : '이번 주 투표'),
      h('h2', { class: 'sec-title sm' }, p.question),
      p.description ? h('p', { class: 'muted' }, p.description) : null,
      opts,
      h('p', { class: 'note' }, `${p.total}명 참여`, !p.closed && showResult ? ' · 다른 선택지를 누르면 바꿀 수 있어요' : '', !showResult ? ' · 투표하면 결과가 보여요' : ''));
  }
  load();
}

// ---- 랭킹 ----
export function rankingView(ctx, menu, root) {
  const r = ctx.rankings;
  const o = menu.options;
  const kinds = [o.support !== false && { id: 'support', label: '후원 랭킹' }, o.activity !== false && { id: 'activity', label: '애청지수 랭킹' }].filter(Boolean);
  if (!r || !kinds.length) { root.append(empty('아직 랭킹이 없어요. JUN LIVE로 방송하면 자동으로 채워져요.')); return; }
  let kind = kinds[0].id, period = 'week';
  const body = h('div', { class: 'stack' });
  const kindBar = h('div', { class: 'segs', role: 'tablist', 'aria-label': '랭킹 종류' });
  const periodBar = h('div', { class: 'tabs-chips', role: 'tablist', 'aria-label': '기간' });
  function draw() {
    kindBar.replaceChildren(...kinds.map((k) => h('button', { type: 'button', role: 'tab', class: 'seg', 'aria-selected': String(k.id === kind), onclick: () => { kind = k.id; draw(); } }, k.label)));
    periodBar.hidden = kind !== 'support';
    periodBar.replaceChildren(...[['week', '이번 주'], ['month', '이번 달'], ['all', '누적']].map(([id, label]) => h('button', { type: 'button', role: 'tab', class: 'chip', 'aria-selected': String(id === period), onclick: () => { period = id; draw(); } }, label)));
    const list = (kind === 'support' ? r.support?.[period] : r.activity) || [];
    if (!list.length) { body.replaceChildren(empty('아직 이 기간의 랭킹이 없어요.')); return; }
    const extra = (it) => (kind === 'activity' && it.level !== undefined ? h('span', { class: 'lv' }, `Lv.${it.level}`) : null);
    const top = list.slice(0, 3);
    const order = [1, 0, 2].filter((i) => top[i]);
    const podium = h('ol', { class: 'podium', 'aria-label': '1~3위' }, order.map((i) => h('li', { class: `place p${i + 1}`, value: i + 1 },
      h('span', { class: 'medal', 'aria-hidden': 'true' }, String(i + 1)),
      h('span', { class: 'sr-only' }, `${i + 1}위 `),
      h('span', { class: 'pname' }, top[i].nickname), extra(top[i]),
      h('span', { class: 'bar', 'aria-hidden': 'true' }))));
    const rest = list.slice(3, 20);
    body.replaceChildren(podium, rest.length ? h('ol', { class: 'rank-list', start: 4 }, rest.map((it, i) => h('li', null, h('b', { class: 'rank-n' }, String(i + 4)), h('span', null, it.nickname), extra(it)))) : null);
  }
  draw();
  root.append(h('section', { class: 'stack' }, kinds.length > 1 ? kindBar : null, periodBar, body,
    h('p', { class: 'note' }, '후원 금액은 숨기고 순위만 보여요. JUN LIVE 기록으로 자동으로 바뀌어요.')));
}

// ---- 기념일 ----
export function daysList(ctx, menu, { limit } = {}) {
  const today = kstDate();
  let items = sortDays(menu.options.days || [], today);
  if (limit) items = items.slice(0, limit);
  if (!items.length) return empty('아직 등록된 기념일이 없어요.');
  return h('ul', { class: 'days card' }, items.map(({ day, info }) => h('li', { class: 'day-row' },
    h('span', { class: 'dday' + (info.upcoming ? ' up' : '') }, info.label),
    h('div', { class: 'col grow' },
      h('b', null, day.title),
      h('span', { class: 'muted small' }, day.yearly ? `매년 ${formatKoreanDate(info.target, false).replace(/ \(.\)$/, '')}${info.years > 0 ? ` · ${info.years}주년` : ''}` : formatKoreanDate(day.date)),
      day.note && !limit ? h('span', { class: 'small' }, day.note) : null),
    limit ? null : h('button', { type: 'button', class: 'icon-btn', 'aria-label': `${day.title} 캘린더에 저장`, title: '캘린더에 저장', onclick: () => downloadFile(`${day.title.replace(/[\\/:*?"<>|]/g, '')}.ics`, buildIcs(day, { calName: `${ctx.config.profile.name}의 팬페이지` })) }, icon('calendar', { size: 20 })))));
}
function days(ctx, menu, root) {
  root.append(daysList(ctx, menu), h('p', { class: 'note' }, '달력 버튼을 누르면 휴대폰·PC 캘린더에 저장할 수 있는 파일을 받아요.'));
}

// ---- 링크 모음 ----
function links(ctx, menu, root) {
  const list = (menu.options.links || []).map((l) => ({ ...l, url: safeHttpsUrl(l.url) })).filter((l) => l.url);
  if (!list.length) { root.append(empty('아직 등록된 링크가 없어요.')); return; }
  root.append(h('ul', { class: 'link-list' }, list.map((l) => h('li', null,
    extLink(l.url, { class: 'link-btn' }, icon('link', { size: 18 }), h('span', { class: 'grow' }, l.label), h('span', { class: 'muted small' }, new URL(l.url).hostname.replace(/^www\./, '')))))));
}

export const FORM_VIEWS = { board, photo_text: photoText, album, archive, lounge, attendance, poll, ranking: rankingView, days, links };

// 글 하나(상세)
export function postDetail(ctx, post, menu) {
  const wrap = h('div', { class: 'stack' });
  if (!menu || menu.form === 'board') {
    const photos = post.photos || [];
    const likeCount = h('span', { class: 'muted small' });
    wrap.append(h('article', { class: 'card pad stack article' },
      h('div', { class: 'pt-meta' }, post.pinned ? h('span', { class: 'pin-badge static' }, '고정') : null, h('span', null, postDate(post))),
      h('h1', { class: 'sec-title' }, post.title || '제목 없음'),
      h('p', { class: 'article-body' }, post.body),
      photos.map((p, i) => framedPhoto(p, { onOpen: () => openViewer(photos, i, { caption: post.title }) })),
      h('div', { class: 'row gap center' }, likeButton(post, { onChange: (n) => { likeCount.textContent = `좋아요 ${n}개`; } }), likeCount)));
  } else {
    wrap.classList.add('bleed');
    wrap.append(feedCard(ctx, post, menu, { detail: true }));
  }
  if (menu?.options?.allowComments) {
    const list = commentList(ctx, menu, { post: post.id, emptyText: '아직 댓글이 없어요. 첫 댓글을 남겨 주세요.' });
    wrap.append(h('section', { class: 'stack pad-x', id: 'write' },
      h('h2', { class: 'sec-title sm' }, `팬 댓글 ${post.comments || 0}개`),
      h('div', { class: 'card pad' }, commentForm(ctx, menu, { post: post.id, label: '댓글', onPosted: (c) => list.prepend(c) })),
      list));
  }
  return wrap;
}

export { commentItem };
