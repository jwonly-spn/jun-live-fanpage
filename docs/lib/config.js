// 팬페이지 설정(config) — 테마·양식 목록, 기본값, 검사. DOM 없이 동작(테스트 가능).
import { parseYmd } from './days.js';

export const THEMES = {
  rose: { name: '로즈', accent: '#c7385f', onAccent: '#ffffff', paper: '#fff6f8', card: '#ffffff', ink: '#2a1a20', muted: '#7d5e68', line: '#f3dce3', soft: '#fde8ee', bright: '#f7b8ca', accentText: '#c7385f' },
  peach: { name: '피치', accent: '#f4895f', onAccent: '#3a1a0c', paper: '#fff7f1', card: '#ffffff', ink: '#2e1e16', muted: '#7e6254', line: '#f5dfd1', soft: '#ffe9dc', bright: '#fbc3a6', accentText: '#a8481f' },
  butter: { name: '버터', accent: '#f2c94c', onAccent: '#3a2c05', paper: '#fffcf2', card: '#ffffff', ink: '#2b2515', muted: '#736a4e', line: '#f1e6c4', soft: '#fff3cc', bright: '#f8de8d', accentText: '#7d5f00' },
  mint: { name: '민트', accent: '#2bb38a', onAccent: '#06291f', paper: '#f3fbf8', card: '#ffffff', ink: '#12302a', muted: '#56736b', line: '#d3ede4', soft: '#ddf5ec', bright: '#9ee3cb', accentText: '#17785b' },
  sky: { name: '스카이', accent: '#2566e8', onAccent: '#ffffff', paper: '#f4f8ff', card: '#ffffff', ink: '#15223b', muted: '#5b6883', line: '#dae4f6', soft: '#e3edff', bright: '#a9c6fa', accentText: '#2566e8' },
  lavender: { name: '라벤더', accent: '#7c5ce6', onAccent: '#ffffff', paper: '#f8f6ff', card: '#ffffff', ink: '#231b3b', muted: '#6c6488', line: '#e5def8', soft: '#ede7ff', bright: '#c9b8f8', accentText: '#6a48d8' },
  mono: { name: '모노', accent: '#1c1c1e', onAccent: '#ffffff', paper: '#f7f7f5', card: '#ffffff', ink: '#1c1c1e', muted: '#6b6b70', line: '#e6e6e2', soft: '#eeeeeb', bright: '#d4d4cf', accentText: '#1c1c1e' },
  midnight: { name: '미드나잇', accent: '#b7a4ff', onAccent: '#1a1433', paper: '#0f1220', card: '#181c2e', ink: '#f1f2f8', muted: '#a2a8c2', line: '#2a3050', soft: '#232843', bright: '#3b4270', accentText: '#c4b5ff', dark: true },
};
export const THEME_IDS = Object.keys(THEMES);

export const LAYOUTS = {
  story: { name: '이야기 중심', desc: '소개글과 팬 한마디가 먼저 보여요' },
  photo: { name: '사진 중심', desc: '앨범 사진이 크게 먼저 보여요' },
};

export const FORMS = {
  board: { name: '글 게시판', desc: '글만 올려요. 공지·일기', posts: true },
  photo_text: { name: '사진 + 글', desc: '사진 여러 장과 글, 분류', posts: true },
  album: { name: '사진 앨범', desc: '사진을 모아 크게 보기', posts: true },
  archive: { name: '박제판', desc: '사진·함께한 후원자·한마디', posts: true },
  lounge: { name: '팬 라운지', desc: '팬 한마디·오늘의 질문·답글' },
  attendance: { name: '출석 체크', desc: '스탬프 모으고 보상 받기', tag: 'JUN LIVE 연동' },
  poll: { name: '투표', desc: '주간 투표' },
  ranking: { name: '랭킹', desc: '후원·애청지수 순위', tag: 'JUN LIVE 연동' },
  days: { name: '기념일', desc: 'D-day·생일 세기' },
  links: { name: '링크 모음', desc: '스푼·유튜브·SNS 바로가기' },
};
export const FORM_IDS = Object.keys(FORMS);
export const POST_FORMS = FORM_IDS.filter((f) => FORMS[f].posts);

export const LIMITS = {
  name: 24, intro: 100, description: 300, quote: 80, schedule: 60,
  menus: 12, menuName: 24, menuDesc: 80,
  categories: 8, category: 12, question: 80, rewards: 10, rewardLabel: 30,
  days: 20, dayTitle: 30, dayNote: 80, links: 12, linkLabel: 30, url: 500,
  nickname: 20, comment: 200, postTitle: 60, postBody: 3000, postPhotos: 10,
  supporter: 40, pollQuestion: 80, pollDesc: 200, pollOption: 40, pollMin: 2, pollMax: 6,
};

export const RESERVED_SLUGS = ['studio', 'p', 'api', 'admin'];

export function defaultOptions(form) {
  switch (form) {
    case 'board': return { allowComments: true };
    case 'photo_text': return { categories: [], allowComments: true, showOnHome: true };
    case 'album': return { categories: [], showOnHome: true };
    case 'archive': return { allowComments: true, showOnHome: true };
    case 'lounge': return { question: '', showMissions: true };
    case 'attendance': return { rewards: [] };
    case 'poll': return {};
    case 'ranking': return { support: true, activity: true };
    case 'days': return { days: [] };
    case 'links': return { links: [] };
    default: return {};
  }
}

export function randomId(prefix = 'm_', len = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  const buf = new Uint8Array(len);
  (globalThis.crypto || { getRandomValues: (a) => a.map(() => Math.floor(Math.random() * 256)) }).getRandomValues(buf);
  for (const b of buf) s += chars[b % chars.length];
  return prefix + s;
}

export function newMenu(form = 'photo_text', existing = []) {
  const ids = new Set(existing.map((m) => m.id));
  let id = randomId();
  while (ids.has(id)) id = randomId();
  return { id, name: FORMS[form]?.name || '새 메뉴', description: '', form, visible: true, options: defaultOptions(form) };
}

export function defaultConfig(name = '') {
  const menus = [];
  const add = (form, nm, description, extra = {}) => {
    const m = newMenu(form, menus);
    m.name = nm; m.description = description; Object.assign(m.options, extra);
    menus.push(m);
  };
  add('lounge', '팬들의 한마디', '팬들이 남겨주는 다정한 한마디', { question: '오늘 하루는 어땠어요?' });
  add('album', '추억 앨범', '사진으로 모아두는 우리의 순간들');
  add('archive', '박제판', '오래 기억하고 싶은 방송의 순간');
  add('ranking', '팬 랭킹', '늘 고마운 이름들');
  add('days', '특별한 날', '함께 세어가는 우리의 기념일');
  return {
    v: 1, theme: 'rose', layout: 'story',
    profile: { name: String(name || '').slice(0, LIMITS.name), intro: '', description: '', quote: '', schedule: '', spoonUrl: '', avatar: null, cover: null },
    menus,
  };
}

const len = (s) => Array.from(String(s ?? '')).length;

export function safeHttpsUrl(value) {
  const v = String(value ?? '').trim();
  if (!v || v.length > LIMITS.url) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:' || u.username || u.password || !u.hostname.includes('.')) return null;
    return u.href;
  } catch { return null; }
}

export function safeSpoonUrl(value) {
  const href = safeHttpsUrl(value);
  if (!href) return null;
  const host = new URL(href).hostname;
  return host === 'spooncast.net' || host.endsWith('.spooncast.net') ? href : null;
}

export function validateSlug(slug) {
  const s = String(slug ?? '');
  if (!/^[a-z0-9-]{3,30}$/.test(s)) return '주소는 영문 소문자·숫자·하이픈으로 3~30자예요.';
  if (RESERVED_SLUGS.includes(s)) return '이 주소는 쓸 수 없어요. 다른 주소를 골라 주세요.';
  return null;
}

function checkPhoto(p) {
  return p === null || p === undefined || (typeof p === 'object' && typeof p.path === 'string' && p.path && typeof p.thumb === 'string' && Number(p.w) > 0 && Number(p.h) > 0);
}

// 오류 목록 [{path, message}] — 비어 있으면 통과
export function validateConfig(cfg) {
  const errors = [];
  const err = (path, message) => errors.push({ path, message });
  if (!cfg || typeof cfg !== 'object') { err('', '설정을 읽을 수 없어요.'); return errors; }
  if (!THEME_IDS.includes(cfg.theme)) err('theme', '테마 색을 골라 주세요.');
  if (!(cfg.layout in LAYOUTS)) err('layout', '배치를 골라 주세요.');
  const p = cfg.profile || {};
  const name = String(p.name ?? '').trim();
  if (!name) err('profile.name', '이름을 적어 주세요.');
  else if (len(name) > LIMITS.name) err('profile.name', `이름은 ${LIMITS.name}자까지예요.`);
  for (const k of ['intro', 'description', 'quote', 'schedule']) {
    if (len(p[k]) > LIMITS[k]) err('profile.' + k, `${LIMITS[k]}자까지 쓸 수 있어요.`);
  }
  if (p.spoonUrl && !safeSpoonUrl(p.spoonUrl)) err('profile.spoonUrl', 'https://www.spooncast.net/ 으로 시작하는 스푼 주소를 넣어 주세요.');
  if (!checkPhoto(p.avatar)) err('profile.avatar', '프로필 사진을 다시 올려 주세요.');
  if (!checkPhoto(p.cover)) err('profile.cover', '커버 사진을 다시 올려 주세요.');
  const menus = Array.isArray(cfg.menus) ? cfg.menus : [];
  if (!Array.isArray(cfg.menus)) err('menus', '메뉴 목록을 읽을 수 없어요.');
  if (menus.length > LIMITS.menus) err('menus', `메뉴는 ${LIMITS.menus}개까지 만들 수 있어요.`);
  const ids = new Set();
  menus.forEach((m, i) => {
    const at = `menus.${i}`;
    if (!m || typeof m !== 'object') { err(at, '메뉴를 읽을 수 없어요.'); return; }
    if (!/^[a-z0-9_]{2,24}$/.test(String(m.id))) err(at + '.id', '메뉴 번호가 올바르지 않아요.');
    if (ids.has(m.id)) err(at + '.id', '메뉴 번호가 겹쳐요.');
    ids.add(m.id);
    const nm = String(m.name ?? '').trim();
    if (!nm || len(nm) > LIMITS.menuName) err(at + '.name', `메뉴 이름은 1~${LIMITS.menuName}자예요.`);
    if (len(m.description) > LIMITS.menuDesc) err(at + '.description', `설명은 ${LIMITS.menuDesc}자까지예요.`);
    if (!FORM_IDS.includes(m.form)) { err(at + '.form', '양식을 골라 주세요.'); return; }
    const o = m.options || {};
    if (o.categories !== undefined) {
      if (!Array.isArray(o.categories) || o.categories.length > LIMITS.categories) err(at + '.categories', `분류는 ${LIMITS.categories}개까지예요.`);
      else if (o.categories.some((c) => !String(c).trim() || len(c) > LIMITS.category)) err(at + '.categories', `분류 이름은 1~${LIMITS.category}자예요.`);
      else if (new Set(o.categories).size !== o.categories.length) err(at + '.categories', '같은 이름의 분류가 있어요.');
    }
    if (m.form === 'lounge' && len(o.question) > LIMITS.question) err(at + '.question', `오늘의 질문은 ${LIMITS.question}자까지예요.`);
    if (m.form === 'attendance') {
      const r = o.rewards || [];
      if (!Array.isArray(r) || r.length > LIMITS.rewards) err(at + '.rewards', `보상은 ${LIMITS.rewards}개까지예요.`);
      else r.forEach((x, j) => {
        if (!Number.isInteger(x?.at) || x.at < 1 || x.at > 1000) err(`${at}.rewards.${j}`, '보상 출석 횟수는 1~1000 사이 숫자예요.');
        if (!String(x?.label ?? '').trim() || len(x.label) > LIMITS.rewardLabel) err(`${at}.rewards.${j}`, `보상 이름은 1~${LIMITS.rewardLabel}자예요.`);
      });
    }
    if (m.form === 'days') {
      const d = o.days || [];
      if (!Array.isArray(d) || d.length > LIMITS.days) err(at + '.days', `기념일은 ${LIMITS.days}개까지예요.`);
      else d.forEach((x, j) => {
        if (!String(x?.title ?? '').trim() || len(x.title) > LIMITS.dayTitle) err(`${at}.days.${j}`, `기념일 이름은 1~${LIMITS.dayTitle}자예요.`);
        if (!parseYmd(x?.date)) err(`${at}.days.${j}`, '날짜를 골라 주세요.');
        if (len(x?.note) > LIMITS.dayNote) err(`${at}.days.${j}`, `메모는 ${LIMITS.dayNote}자까지예요.`);
      });
    }
    if (m.form === 'links') {
      const l = o.links || [];
      if (!Array.isArray(l) || l.length > LIMITS.links) err(at + '.links', `링크는 ${LIMITS.links}개까지예요.`);
      else l.forEach((x, j) => {
        if (!String(x?.label ?? '').trim() || len(x.label) > LIMITS.linkLabel) err(`${at}.links.${j}`, `링크 이름은 1~${LIMITS.linkLabel}자예요.`);
        if (!safeHttpsUrl(x?.url)) err(`${at}.links.${j}`, 'https:// 로 시작하는 주소만 넣을 수 있어요.');
      });
    }
  });
  return errors;
}

// 화면에 그리기 전 방어적으로 정리(모르는 값은 기본값으로)
export function normalizeConfig(cfg) {
  const c = cfg && typeof cfg === 'object' ? cfg : {};
  const p = c.profile || {};
  const photo = (x) => (checkPhoto(x) && x ? { path: x.path, thumb: x.thumb || x.path, w: Number(x.w), h: Number(x.h) } : null);
  return {
    v: 1,
    theme: THEME_IDS.includes(c.theme) ? c.theme : 'rose',
    layout: c.layout === 'photo' ? 'photo' : 'story',
    profile: {
      name: String(p.name ?? '').trim() || '이름 없음',
      intro: String(p.intro ?? ''), description: String(p.description ?? ''),
      quote: String(p.quote ?? ''), schedule: String(p.schedule ?? ''),
      spoonUrl: safeSpoonUrl(p.spoonUrl) || '',
      avatar: photo(p.avatar), cover: photo(p.cover),
    },
    menus: (Array.isArray(c.menus) ? c.menus : [])
      .filter((m) => m && FORM_IDS.includes(m.form) && typeof m.id === 'string')
      .slice(0, LIMITS.menus)
      .map((m) => ({ id: m.id, name: String(m.name ?? ''), description: String(m.description ?? ''), form: m.form, visible: m.visible !== false, options: { ...defaultOptions(m.form), ...(m.options || {}) } })),
  };
}

// 색 대비(WCAG) — 테스트와 테마 점검용
export function contrast(a, b) {
  const lum = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      .map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
      .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
