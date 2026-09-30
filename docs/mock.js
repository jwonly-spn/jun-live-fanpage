// 체험 모드용 가짜 서버 — API.md 전체를 브라우저 안에서 흉내 낸다(실제 서버와 통신하지 않음).
import { validateConfig, validateSlug, LIMITS, RESERVED_SLUGS } from './lib/config.js';
import { samplePhoto, SAMPLE_RANKINGS } from './lib/samples.js';
import { kstDate, addDays } from './lib/days.js';
import { charCount } from './lib/text.js';

const KEY = 'fp_mock_db_v2';
const PAGE = 20;
const now = () => Date.now();
const iso = (t = now()) => new Date(t).toISOString();
const ago = (h) => iso(now() - h * 3600e3);
const rid = (p) => p + Math.random().toString(36).slice(2, 10);
const clone = (x) => JSON.parse(JSON.stringify(x));

function demoConfig() {
  const year = Number(kstDate().slice(0, 4));
  return {
    v: 1, theme: 'rose', layout: 'story',
    profile: {
      name: '하루', intro: '당신의 하루 끝에,\n조금 더 다정한 시간.',
      description: '오늘의 이야기를 편하게 나눠요.\n우리의 작은 추억이 쌓이는 곳.',
      quote: '좋은 목소리가 좋은 하루를 만든다.', schedule: '매일 저녁 8시 · 주말은 밤 10시',
      spoonUrl: 'https://www.spooncast.net/kr',
      avatar: samplePhoto(0, '하루'), cover: { ...samplePhoto(3, '') },
    },
    menus: [
      { id: 'm_lounge', name: '하루에게', description: '출석 스탬프를 모으고, 투표하고, 오늘의 마음을 남겨요.', form: 'lounge', visible: true, options: { question: '요즘 가장 자주 듣는 노래는 뭐예요?', showMissions: true } },
      { id: 'm_memory', name: '추억', description: '함께한 순간들을 모아두는 공간이에요.', form: 'photo_text', visible: true, options: { categories: ['방송', '이벤트', '일상'], allowComments: true, showOnHome: true } },
      { id: 'm_album', name: '추억 앨범', description: '사진으로 모아두는 우리의 순간들', form: 'album', visible: true, options: { categories: ['방송', '일상'], showOnHome: true } },
      { id: 'm_archive', name: '박제관', description: '오래 기억하고 싶은 방송의 순간', form: 'archive', visible: true, options: { allowComments: true, showOnHome: true } },
      { id: 'm_notice', name: '공지', description: '방송 일정과 소식', form: 'board', visible: true, options: { allowComments: true } },
      { id: 'm_attend', name: '출석 체크', description: '매일 도장 찍고 보상 받아요', form: 'attendance', visible: true, options: { rewards: [{ at: 7, label: '복권 1장' }, { at: 15, label: '복권 3장' }, { at: 30, label: '신청곡 우선권' }] } },
      { id: 'm_poll', name: '이번 주 투표', description: '다음 방송 주제를 골라 주세요', form: 'poll', visible: true, options: {} },
      { id: 'm_rank', name: '팬 랭킹', description: '늘 고마운 이름들', form: 'ranking', visible: true, options: { support: true, activity: true } },
      { id: 'm_days', name: '특별한 날', description: '함께 세어가는 우리의 기념일', form: 'days', visible: true, options: { days: [
        { id: 'd1', title: '하루 생일', date: '1999-' + kstDate(now() + 12 * 86400e3).slice(5), yearly: true, note: '케이크 들고 모여요' },
        { id: 'd2', title: '첫 방송', date: addDays(kstDate(), -100), yearly: false, note: '' },
        { id: 'd3', title: '데뷔 기념일', date: `${year - 2}-03-14`, yearly: true, note: '' },
        { id: 'd4', title: '500회 방송', date: addDays(kstDate(), 40), yearly: false, note: '특별 게스트' },
      ] } },
      { id: 'm_links', name: '링크 모음', description: '어디서든 하루를 만나요', form: 'links', visible: true, options: { links: [{ label: '스푼 채널', url: 'https://www.spooncast.net/kr' }, { label: '유튜브', url: 'https://www.youtube.com/' }, { label: '인스타그램', url: 'https://www.instagram.com/' }] } },
    ],
  };
}

function seed() {
  const cfg = demoConfig();
  const posts = [];
  let photo = 1;
  const add = (menu, n, fn) => { for (let i = 0; i < n; i++) posts.push({ id: rid('p_'), menu, page: 'pg_demo', likes: (i * 7) % 23, comments: 0, pinned: false, supporter: '', eventDate: '', category: '', created: ago(6 + i * 19 + menu.length), ...fn(i) }); };
  add('m_memory', 7, (i) => ({ title: ['첫 방송 날', '100일 이벤트', '비 오는 밤', '생일 파티', '공개 방송', '새벽 라디오', '봄 소풍'][i], body: '그날의 이야기를 여기에 남겨요.\n함께해 줘서 고마워요.', category: ['방송', '이벤트', '일상'][i % 3], pinned: i === 1, photos: Array.from({ length: 1 + (i % 3) }, () => samplePhoto(photo++)) }));
  add('m_album', 26, (i) => ({ title: `추억 ${i + 1}`, body: '', category: i % 3 === 0 ? '일상' : '방송', pinned: i === 0, photos: [samplePhoto(photo++)] }));
  add('m_archive', 6, (i) => ({ title: ['1주년 방송', '밤샘 라디오', '첫 선물 박제', '노래 신청의 밤', '비밀 이야기', '팬미팅'][i], body: '와 주셔서 정말 고마웠어요. 여러분 덕분에 오늘도 웃었어요. 오래오래 기억할게요. 다음에도 꼭 같이해요! 이 글은 두 줄보다 길어서 더 보기로 열 수 있어요.', supporter: ['별빛', '달빛', '구름', '새벽', '하늘', '노을'][i], eventDate: addDays(kstDate(), -10 * i - 3), photos: Array.from({ length: [3, 1, 2, 1, 4, 1][i] }, () => samplePhoto(photo++)) }));
  add('m_notice', 4, (i) => ({ title: ['이번 주 방송 일정', '팬페이지를 열었어요', '추석 특집 안내', '신청곡 받는 방법'][i], body: '안녕하세요, 하루예요.\n\n이번 주 방송은 평소처럼 저녁 8시에 시작해요. 금요일은 한 시간 늦게 만나요.', pinned: i === 0, photos: i === 2 ? [samplePhoto(photo++)] : [] }));
  const comments = [];
  const names = ['별빛', '달빛', '구름', '새벽', '하늘', '노을', '바람', '소나기'];
  const bodies = ['오늘 방송도 따뜻했어요.', '내일도 들으러 갈게요!', '요즘 이 노래만 들어요 🎵', '하루님 목소리 최고예요', '출석 도장 쾅!', '비 오는 날 라디오 좋아요', '생일 축하 미리 해요', '늘 응원해요'];
  for (let i = 0; i < 25; i++) comments.push({ id: rid('c_'), page: 'pg_demo', menu: 'm_lounge', post: null, nickname: names[i % 8], body: bodies[i % 8], created: ago(1 + i * 7), hearted: i % 3 === 0, reply: i % 4 === 0 ? '고마워요, 또 만나요!' : null, hidden: false, ipBlocked: false, fan: 'seed' + (i % 8) });
  for (const p of posts.filter((x) => x.menu === 'm_archive' || x.menu === 'm_memory').slice(0, 5)) {
    for (let i = 0; i < 3; i++) { comments.push({ id: rid('c_'), page: 'pg_demo', menu: p.menu, post: p.id, nickname: names[(i + 3) % 8], body: bodies[(i + 2) % 8], created: ago(2 + i * 5), hearted: i === 0, reply: null, hidden: false, ipBlocked: false, fan: 'seed' + i }); p.comments++; }
  }
  const month = [];
  const today = kstDate();
  for (let d = 1; d < Number(today.slice(8)); d += 2) month.push(today.slice(0, 8) + String(d).padStart(2, '0'));
  return {
    pages: [{ id: 'pg_demo', slug: 'haru', owner: 'demo-token', draft: cfg, published: clone(cfg), revision: 1, publishedAt: ago(48), blocked: false, updated: ago(2), live: { on: true, title: '하루의 밤 라디오', updated: ago(0.3) }, rankings: SAMPLE_RANKINGS }],
    posts, comments, likes: {},
    cards: [{ page: 'pg_demo', menu: 'm_attend', nickname: '별빛', pin: '1234', dates: month, fails: 0, lockedUntil: 0 }],
    polls: [{ id: 'poll_1', page: 'pg_demo', menu: 'm_poll', question: '다음 주 특집은 뭘로 할까요?', description: '가장 많이 고른 주제로 준비할게요.', options: ['신청곡 특집', '고민 상담', '옛날 노래 여행'], votes: { s1: 0, s2: 0, s3: 1, s4: 2, s5: 0 }, closed: false, created: ago(30) }],
    blocked: [],
    rate: {},
  };
}

let db = null;
function load() {
  if (db) return db;
  try { const s = localStorage.getItem(KEY); if (s) db = JSON.parse(s); } catch { db = null; }
  if (!db || !Array.isArray(db.pages)) db = seed();
  return db;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* 사진이 커서 못 담으면 이번 창에서만 유지 */ }
}
export function resetDemo() { db = seed(); save(); }

const ok = (json) => ({ status: 200, json });
const fail = (status, error) => ({ status, json: { error } });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function publicPost(p) {
  const { page, ...rest } = p;
  return clone(rest);
}
function publicComment(c, owner = false) {
  const out = { id: c.id, menu: c.menu, post: c.post, nickname: c.nickname, body: c.body, created: c.created, hearted: !!c.hearted, reply: c.reply ?? null };
  if (owner) { out.hidden = !!c.hidden; out.ipBlocked = !!c.ipBlocked; }
  return out;
}
function ownerPage(p) {
  return p ? { id: p.id, slug: p.slug, draft: clone(p.draft), published: p.published ? clone(p.published) : null, revision: p.revision, publishedAt: p.publishedAt, blocked: p.blocked } : null;
}
function cardView(c, menuCfg) {
  const today = kstDate();
  const month = c.dates.filter((d) => d.slice(0, 7) === today.slice(0, 7));
  const total = c.dates.length;
  const rewards = (menuCfg?.options?.rewards || []).slice().sort((a, b) => a.at - b.at);
  const next = rewards.find((r) => r.at > total) || null;
  return { nickname: c.nickname, total, month, today: c.dates.includes(today), next: next ? { at: next.at, label: next.label } : null };
}
function pollView(p, fan) {
  const counts = p.options.map(() => 0);
  for (const v of Object.values(p.votes)) if (counts[v] !== undefined) counts[v]++;
  const total = counts.reduce((a, b) => a + b, 0);
  return { id: p.id, question: p.question, description: p.description, options: p.options.map((label, i) => ({ label, votes: counts[i] })), total, voted: fan && p.votes[fan] !== undefined ? p.votes[fan] : null, closed: !!p.closed };
}
function menuOf(page, id, which = 'published') {
  return (page[which]?.menus || []).find((m) => m.id === id) || null;
}

export async function handle(method, path, q, body, token, onProgress) {
  load();
  await wait(typeof window === 'undefined' ? 0 : 120 + Math.random() * 220);
  const b = body ? clone(body) : {}; // 실제 서버처럼 받은 내용은 복사본으로
  const findPage = (id) => db.pages.find((p) => p.id === id);
  const mine = () => db.pages.find((p) => p.owner === token) || null;
  const route = method + ' ' + path;

  if (path.startsWith('owner/') && route !== 'POST owner/exchange') {
    if (!token || !['demo-token', 'demo-new'].includes(token)) return fail(401, '다시 로그인해 주세요. JUN LIVE 프로그램에서 "팬페이지 꾸미기"를 눌러 열어 주세요.');
  }

  switch (route) {
    case 'GET page': {
      const p = db.pages.find((x) => x.slug === q.slug);
      if (!p || !p.published || p.blocked) return fail(404, '팬페이지를 찾을 수 없어요.');
      const hasRanking = (p.published.menus || []).some((m) => m.form === 'ranking' && m.visible);
      return ok({ page: { id: p.id, slug: p.slug, config: clone(p.published), updated: p.updated }, live: p.live || null, rankings: hasRanking ? clone(p.rankings) : null });
    }
    case 'GET home': {
      const p = findPage(q.page);
      if (!p) return fail(404, '팬페이지를 찾을 수 없어요.');
      const cfg = p.published || p.draft;
      const menus = {};
      for (const m of cfg.menus) {
        if (!m.visible || !['photo_text', 'album', 'archive'].includes(m.form) || !m.options?.showOnHome) continue;
        menus[m.id] = db.posts.filter((x) => x.page === p.id && x.menu === m.id).sort((x, y) => y.created.localeCompare(x.created)).slice(0, 3).map(publicPost);
      }
      const comments = db.comments.filter((c) => c.page === p.id && !c.post && !c.hidden).sort((x, y) => y.created.localeCompare(x.created)).slice(0, 4).map((c) => publicComment(c));
      const visible = new Set(cfg.menus.filter((m) => m.visible).map((m) => m.id));
      const pinned = db.posts.filter((x) => x.page === p.id && x.pinned && visible.has(x.menu)).sort((x, y) => y.created.localeCompare(x.created)).slice(0, 3).map(publicPost);
      return ok({ menus, comments, pinned });
    }
    case 'GET owner/posts':
    case 'GET posts': {
      let list = db.posts.filter((x) => x.page === q.page && x.menu === q.menu);
      if (q.category) list = list.filter((x) => x.category === q.category);
      list.sort((x, y) => y.created.localeCompare(x.created));
      let pinned = [];
      if (!q.before) { pinned = list.filter((x) => x.pinned); list = list.filter((x) => !x.pinned); } else list = list.filter((x) => !x.pinned && x.created < q.before);
      const pageList = [...pinned, ...list.slice(0, Math.max(0, PAGE - pinned.length))];
      const more = list.length > PAGE - pinned.length;
      return ok({ posts: pageList.map(publicPost), more });
    }
    case 'GET post': {
      const p = db.posts.find((x) => x.id === q.id);
      return p ? ok({ post: publicPost(p) }) : fail(404, '글을 찾을 수 없어요.');
    }
    case 'GET comments': {
      let list = db.comments.filter((c) => c.page === q.page && c.menu === q.menu && !c.hidden && (q.post ? c.post === q.post : !c.post));
      list.sort((x, y) => y.created.localeCompare(x.created));
      if (q.before) list = list.filter((c) => c.created < q.before);
      return ok({ comments: list.slice(0, PAGE).map((c) => publicComment(c)), more: list.length > PAGE });
    }
    case 'POST comment': {
      const p = findPage(b.page);
      const m = p && menuOf(p, b.menu);
      if (!m) return fail(404, '메뉴를 찾을 수 없어요.');
      const nick = String(b.nickname || '').trim(), text = String(b.body || '').trim();
      if (!nick || charCount(nick) > LIMITS.nickname) return fail(400, '닉네임은 1~20자예요.');
      if (!text || charCount(text) > LIMITS.comment) return fail(400, '한마디는 1~200자예요.');
      if (m.form !== 'lounge' && !m.options?.allowComments) return fail(403, '이 메뉴는 댓글을 받지 않아요.');
      if (db.blocked.includes(nick) || db.blocked.includes(b.fan)) return fail(403, '댓글을 남길 수 없어요.');
      const key = b.fan || 'anon';
      db.rate[key] = (db.rate[key] || []).filter((t) => t > now() - 600e3);
      if (db.rate[key].length >= 5) return fail(429, '10분에 5개까지 남길 수 있어요. 잠시 뒤에 다시 해 주세요.');
      db.rate[key].push(now());
      const c = { id: rid('c_'), page: p.id, menu: m.id, post: b.post || null, nickname: nick, body: text, created: iso(), hearted: false, reply: null, hidden: false, ipBlocked: false, fan: b.fan };
      db.comments.push(c);
      if (c.post) { const post = db.posts.find((x) => x.id === c.post); if (post) post.comments++; }
      save();
      return ok({ comment: publicComment(c) });
    }
    case 'POST like': {
      const post = db.posts.find((x) => x.id === b.post);
      if (!post) return fail(404, '글을 찾을 수 없어요.');
      const set = new Set(db.likes[post.id] || []);
      let liked;
      if (set.has(b.fan)) { set.delete(b.fan); post.likes = Math.max(0, post.likes - 1); liked = false; } else { set.add(b.fan); post.likes++; liked = true; }
      db.likes[post.id] = [...set];
      save();
      return ok({ likes: post.likes, liked });
    }
    case 'POST attendance': {
      const p = findPage(b.page);
      const m = p && menuOf(p, b.menu);
      if (!m || m.form !== 'attendance') return fail(404, '출석 메뉴를 찾을 수 없어요.');
      const nick = String(b.nickname || '').trim();
      if (!nick || charCount(nick) > LIMITS.nickname) return fail(400, '닉네임은 1~20자예요.');
      if (!/^\d{4}$/.test(String(b.pin || ''))) return fail(400, '비밀 숫자는 4자리 숫자예요.');
      let card = db.cards.find((c) => c.page === p.id && c.menu === m.id && c.nickname === nick);
      if (b.action === 'create') {
        if (card) return fail(409, '이미 있는 닉네임이에요. "불러오기"를 눌러 주세요.');
        card = { page: p.id, menu: m.id, nickname: nick, pin: b.pin, dates: [], fails: 0, lockedUntil: 0 };
        db.cards.push(card); save();
        return ok({ card: cardView(card, m) });
      }
      if (!card) return fail(404, '카드를 찾을 수 없어요. 처음이면 "새 카드 만들기"를 눌러 주세요.');
      if (card.lockedUntil > now()) return fail(429, '비밀 숫자를 여러 번 틀렸어요. 10분 뒤에 다시 해 주세요.');
      if (card.pin !== b.pin) {
        card.fails++; if (card.fails >= 5) { card.lockedUntil = now() + 600e3; card.fails = 0; }
        save(); return fail(403, '비밀 숫자가 맞지 않아요.');
      }
      card.fails = 0;
      if (b.action === 'check') { const t = kstDate(); if (!card.dates.includes(t)) card.dates.push(t); save(); }
      else if (b.action !== 'load') return fail(400, '알 수 없는 요청이에요.');
      return ok({ card: cardView(card, m) });
    }
    case 'GET owner/poll':
    case 'GET poll': {
      const list = db.polls.filter((x) => x.page === q.page && x.menu === q.menu).sort((x, y) => y.created.localeCompare(x.created));
      return ok({ poll: list[0] ? pollView(list[0], q.fan) : null });
    }
    case 'POST vote': {
      const poll = db.polls.find((x) => x.id === b.poll);
      if (!poll) return fail(404, '투표를 찾을 수 없어요.');
      if (poll.closed) return fail(400, '마감된 투표예요.');
      if (!Number.isInteger(b.option) || b.option < 0 || b.option >= poll.options.length) return fail(400, '선택지를 골라 주세요.');
      poll.votes[b.fan] = b.option; save();
      return ok({ poll: pollView(poll, b.fan) });
    }
    // ---- DJ ----
    case 'POST owner/exchange': {
      if (!b.code) return fail(400, '코드가 없어요.');
      const token = b.code === 'newdj' ? 'demo-new' : 'demo-token';
      const p = db.pages.find((x) => x.owner === token);
      return ok({ token, expires: iso(now() + 30 * 86400e3), page: p ? { id: p.id, slug: p.slug } : null });
    }
    case 'GET owner/page': return ok({ page: ownerPage(mine()), spoon: { nickname: token === 'demo-new' ? '새벽달' : '하루', tag: token === 'demo-new' ? 'saebyeok' : 'haru_1' } });
    case 'POST owner/page': {
      let p = mine();
      const errs = validateConfig(b.draft);
      if (errs.length) return fail(400, errs[0].message);
      if (!p) {
        const e = validateSlug(b.slug);
        if (e) return fail(400, e);
        if (RESERVED_SLUGS.includes(b.slug) || db.pages.some((x) => x.slug === b.slug)) return fail(409, '이미 쓰는 주소예요. 다른 주소를 골라 주세요.');
        p = { id: rid('pg_'), slug: b.slug, owner: token, draft: b.draft, published: null, revision: 1, publishedAt: null, blocked: false, updated: iso(), live: null, rankings: SAMPLE_RANKINGS };
        db.pages.push(p); save();
        return ok({ page: ownerPage(p) });
      }
      if (b.revision !== p.revision) return fail(409, '다른 곳에서 바뀌었어요. 새로고침해 주세요.');
      p.draft = b.draft; p.revision++; p.updated = iso(); save();
      return ok({ page: ownerPage(p) });
    }
    case 'POST owner/publish': {
      const p = mine(); if (!p) return fail(404, '먼저 주소를 정하고 저장해 주세요.');
      p.published = clone(p.draft); p.publishedAt = iso(); p.updated = iso(); save();
      return ok({ page: ownerPage(p) });
    }
    case 'POST owner/unpublish': {
      const p = mine(); if (!p) return fail(404, '페이지가 없어요.');
      p.published = null; p.publishedAt = null; save();
      return ok({ page: ownerPage(p) });
    }
    case 'POST owner/photo': {
      if (!mine()) return fail(404, '먼저 주소를 정하고 저장해 주세요.');
      if (!b.data || !b.thumb || !(b.w > 0) || !(b.h > 0)) return fail(400, '사진을 읽을 수 없어요.');
      for (let i = 1; i <= 5; i++) { await wait(90); onProgress?.(i / 5); }
      return ok({ path: 'data:image/jpeg;base64,' + b.data, thumb: 'data:image/jpeg;base64,' + b.thumb, w: b.w, h: b.h });
    }
    case 'POST owner/post': {
      const p = mine(); if (!p) return fail(404, '먼저 주소를 정하고 저장해 주세요.');
      const m = menuOf(p, b.menu, 'draft');
      if (!m || !['board', 'photo_text', 'album', 'archive'].includes(m.form)) return fail(400, '글을 올릴 메뉴를 골라 주세요.');
      if (charCount(b.title) > LIMITS.postTitle) return fail(400, '제목은 60자까지예요.');
      if (charCount(b.body) > LIMITS.postBody) return fail(400, '글은 3000자까지예요.');
      if (!Array.isArray(b.photos) || b.photos.length > LIMITS.postPhotos) return fail(400, '사진은 10장까지예요.');
      if (m.form !== 'board' && !b.photos.length) return fail(400, '사진을 한 장 이상 올려 주세요.');
      if (m.form === 'board' && !String(b.title || '').trim()) return fail(400, '제목을 적어 주세요.');
      const fields = { menu: m.id, title: String(b.title || ''), body: String(b.body || ''), photos: b.photos, category: b.category || '', pinned: !!b.pinned, supporter: String(b.supporter || ''), eventDate: b.eventDate || '' };
      let post;
      if (b.id) {
        post = db.posts.find((x) => x.id === b.id && x.page === p.id);
        if (!post) return fail(404, '글을 찾을 수 없어요.');
        Object.assign(post, fields);
      } else {
        post = { id: rid('p_'), page: p.id, likes: 0, comments: 0, created: iso(), ...fields };
        db.posts.push(post);
      }
      save();
      return ok({ post: publicPost(post) });
    }
    case 'POST owner/post/delete': {
      const p = mine();
      const i = db.posts.findIndex((x) => x.id === b.id && x.page === p?.id);
      if (i < 0) return fail(404, '글을 찾을 수 없어요.');
      db.posts.splice(i, 1); db.comments = db.comments.filter((c) => c.post !== b.id); save();
      return ok({ ok: true });
    }
    case 'GET owner/comments': {
      const p = mine();
      let list = db.comments.filter((c) => c.page === p?.id && (!q.menu || c.menu === q.menu));
      list.sort((x, y) => y.created.localeCompare(x.created));
      if (q.before) list = list.filter((c) => c.created < q.before);
      return ok({ comments: list.slice(0, PAGE).map((c) => publicComment(c, true)), more: list.length > PAGE });
    }
    case 'POST owner/comment': {
      const p = mine();
      const c = db.comments.find((x) => x.id === b.id && x.page === p?.id);
      if (!c) return fail(404, '댓글을 찾을 수 없어요.');
      if (b.hearted !== undefined) c.hearted = !!b.hearted;
      if (b.hidden !== undefined) c.hidden = !!b.hidden;
      if (b.reply !== undefined) {
        const r = b.reply === null ? null : String(b.reply).trim();
        if (r && charCount(r) > LIMITS.comment) return fail(400, '답글은 200자까지예요.');
        c.reply = r || null;
      }
      save();
      return ok({ comment: publicComment(c, true) });
    }
    case 'POST owner/comment/delete': {
      const p = mine();
      const i = db.comments.findIndex((x) => x.id === b.id && x.page === p?.id);
      if (i < 0) return fail(404, '댓글을 찾을 수 없어요.');
      const [c] = db.comments.splice(i, 1);
      if (c.post) { const post = db.posts.find((x) => x.id === c.post); if (post) post.comments = Math.max(0, post.comments - 1); }
      save();
      return ok({ ok: true });
    }
    case 'POST owner/block': {
      const p = mine();
      const c = db.comments.find((x) => x.id === b.comment && x.page === p?.id);
      if (!c) return fail(404, '댓글을 찾을 수 없어요.');
      db.blocked.push(c.nickname, c.fan);
      for (const x of db.comments) if (x.fan === c.fan || x.nickname === c.nickname) x.ipBlocked = true;
      save();
      return ok({ ok: true });
    }
    case 'POST owner/poll': {
      const p = mine();
      const m = p && menuOf(p, b.menu, 'draft');
      if (!m || m.form !== 'poll') return fail(400, '투표 메뉴를 골라 주세요.');
      const question = String(b.question || '').trim();
      const options = (b.options || []).map((o) => String(o).trim()).filter(Boolean);
      if (!question || charCount(question) > LIMITS.pollQuestion) return fail(400, '질문은 1~80자예요.');
      if (options.length < 2 || options.length > 6) return fail(400, '선택지는 2~6개예요.');
      for (const x of db.polls) if (x.page === p.id && x.menu === m.id) x.closed = true;
      const poll = { id: rid('poll_'), page: p.id, menu: m.id, question, description: String(b.description || ''), options, votes: {}, closed: false, created: iso() };
      db.polls.push(poll); save();
      return ok({ poll: pollView(poll) });
    }
    case 'POST owner/poll/close': {
      const p = mine();
      for (const x of db.polls) if (x.page === p?.id && x.menu === b.menu) x.closed = true;
      save();
      return ok({ ok: true });
    }
    case 'GET owner/attendance': {
      const p = mine();
      const m = p && menuOf(p, q.menu, 'draft');
      const today = kstDate();
      const cards = db.cards.filter((c) => c.page === p?.id && c.menu === q.menu).map((c) => {
        const total = c.dates.length;
        return { nickname: c.nickname, total, monthCount: c.dates.filter((d) => d.slice(0, 7) === today.slice(0, 7)).length, last: c.dates.slice().sort().pop() || null, rewards: (m?.options?.rewards || []).filter((r) => r.at <= total).map((r) => r.label) };
      });
      return ok({ cards });
    }
    case 'GET storybox': return ok({ open: true, note: '첫 방송 때 기억나는 순간' });
    case 'POST story': {
      if (!String(b.nickname || '').trim()) return fail(400, '닉네임을 적어 주세요.');
      if (!String(b.body || '').trim() && !b.data) return fail(400, '사연 글이나 사진을 넣어 주세요.');
      return ok({ story: { id: rid('st_'), nickname: b.nickname, tag: b.tag || '', body: b.body || '', photo: null, created: iso() } });
    }
    default:
      return fail(404, '없는 요청이에요.');
  }
}
