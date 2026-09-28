// Pure checks shared by the Edge Function and the node tests (plain, erasable TypeScript).
export class Fail extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
export const fail = (status: number, message: string) => new Fail(status, message);

export const THEMES = ['rose', 'peach', 'butter', 'mint', 'sky', 'lavender', 'mono', 'midnight'];
export const FORMS = ['board', 'photo_text', 'album', 'archive', 'lounge', 'attendance', 'poll', 'ranking', 'days', 'links'];
export const POST_FORMS = ['board', 'photo_text', 'album', 'archive'];
const RESERVED = ['studio', 'p', 'api', 'admin', 'www', 'jun-live', 'junlive', 'help'];

// Text: trim, drop control characters except newlines, enforce a length in characters.
export function text(value: unknown, max: number, { required = false, lines = false, label = '내용' } = {}): string {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') throw fail(400, `${label}을(를) 확인해 주세요.`);
  let s = value.replace(/\r\n?/g, '\n').replace(lines ? /[\u0000-\u0009\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g, '').trim();
  if (lines) s = s.replace(/\n{3,}/g, '\n\n');
  if (required && !s) throw fail(400, `${label}을(를) 입력해 주세요.`);
  if ([...s].length > max) throw fail(400, `${label}은(는) ${max}자까지 쓸 수 있어요.`);
  return s;
}
const bool = (v: unknown) => v === true;

export function slug(value: unknown): string {
  const s = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(s) || s.includes('--') || RESERVED.includes(s)) throw fail(400, '주소는 영문 소문자·숫자·하이픈으로 3~30자 입력해 주세요.');
  return s;
}

export function httpsUrl(value: unknown, { hosts }: { hosts?: string[] } = {}): string {
  const s = text(value, 300, { label: '주소' });
  if (!s) return '';
  let u: URL;
  try { u = new URL(s); } catch { throw fail(400, 'https:// 로 시작하는 주소를 입력해 주세요.'); }
  if (u.protocol !== 'https:' || u.username || u.password) throw fail(400, 'https:// 로 시작하는 주소를 입력해 주세요.');
  if (hosts && !hosts.includes(u.hostname)) throw fail(400, '스푼 주소(https://www.spooncast.net/…)를 입력해 주세요.');
  return u.href;
}

// A stored photo reference: paths must belong to this page.
export function photo(value: unknown, pageId: string, { optional = false } = {}) {
  if ((value === null || value === undefined) && optional) return null;
  const p = value as Record<string, unknown>;
  const ok = (s: unknown) => typeof s === 'string' && s.startsWith(pageId + '/') && /^[0-9a-f-]{36}\/[0-9a-f-]{36}(_t)?\.jpg$/.test(s);
  if (!p || !ok(p.path) || !ok(p.thumb) || !Number.isInteger(p.w) || !Number.isInteger(p.h) || (p.w as number) < 1 || (p.h as number) < 1 || (p.w as number) > 8000 || (p.h as number) > 8000) throw fail(400, '사진 정보를 확인해 주세요.');
  return { path: p.path as string, thumb: p.thumb as string, w: p.w as number, h: p.h as number };
}

const DEFAULT_OPTIONS: Record<string, Record<string, unknown>> = {
  board: { allowComments: true }, photo_text: { categories: [], allowComments: true, showOnHome: true }, album: { categories: [], showOnHome: true },
  archive: { allowComments: true, showOnHome: true }, lounge: { question: '', showMissions: true }, attendance: { rewards: [] }, poll: {},
  ranking: { support: true, activity: true }, days: { days: [] }, links: { links: [] }
};

function options(form: string, raw: Record<string, unknown> = {}) {
  const o: Record<string, unknown> = {};
  const d = DEFAULT_OPTIONS[form];
  for (const k of ['allowComments', 'showOnHome', 'showMissions', 'support', 'activity']) if (k in d) o[k] = k in raw ? bool(raw[k]) : d[k];
  if ('categories' in d) {
    const list = Array.isArray(raw.categories) ? raw.categories : [];
    if (list.length > 8) throw fail(400, '분류는 8개까지 만들 수 있어요.');
    o.categories = [...new Set(list.map(c => text(c, 12, { required: true, label: '분류 이름' })))];
  }
  if (form === 'lounge') o.question = text(raw.question, 80, { label: '오늘의 질문' });
  if (form === 'attendance') {
    const list = Array.isArray(raw.rewards) ? raw.rewards : [];
    if (list.length > 10) throw fail(400, '보상은 10개까지 정할 수 있어요.');
    o.rewards = list.map((r: any) => {
      if (!Number.isInteger(r?.at) || r.at < 1 || r.at > 366) throw fail(400, '보상 출석 횟수는 1~366 사이로 정해 주세요.');
      return { at: r.at, label: text(r.label, 30, { required: true, label: '보상 이름' }) };
    }).sort((a, b) => a.at - b.at);
  }
  if (form === 'days') {
    const list = Array.isArray(raw.days) ? raw.days : [];
    if (list.length > 20) throw fail(400, '기념일은 20개까지 등록할 수 있어요.');
    o.days = list.map((x: any, i: number) => {
      if (typeof x?.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x.date) || Number.isNaN(Date.parse(x.date + 'T00:00:00Z'))) throw fail(400, '기념일 날짜를 확인해 주세요.');
      return { id: typeof x.id === 'string' && /^[a-z0-9_]{1,24}$/.test(x.id) ? x.id : 'd' + i, title: text(x.title, 30, { required: true, label: '기념일 이름' }), date: x.date, yearly: bool(x.yearly), note: text(x.note, 100, { label: '기념일 설명' }) };
    });
  }
  if (form === 'links') {
    const list = Array.isArray(raw.links) ? raw.links : [];
    if (list.length > 12) throw fail(400, '링크는 12개까지 넣을 수 있어요.');
    o.links = list.map((l: any) => ({ label: text(l?.label, 30, { required: true, label: '링크 이름' }), url: httpsUrl(l?.url) || (() => { throw fail(400, '링크 주소를 입력해 주세요.'); })() }));
  }
  return o;
}

// The whole page design as the DJ saves it; anything unknown is dropped.
export function config(value: unknown, pageId: string) {
  const c = value as Record<string, any>;
  if (!c || typeof c !== 'object' || Array.isArray(c)) throw fail(400, '팬페이지 설정을 확인해 주세요.');
  const p = c.profile || {};
  const menus = Array.isArray(c.menus) ? c.menus : [];
  if (menus.length > 12) throw fail(400, '메뉴는 12개까지 만들 수 있어요.');
  const ids = new Set<string>();
  return {
    v: 1,
    theme: THEMES.includes(c.theme) ? c.theme : 'rose',
    layout: c.layout === 'photo' ? 'photo' : 'story',
    profile: {
      name: text(p.name, 24, { required: true, label: '활동 이름' }),
      intro: text(p.intro, 100, { lines: true, label: '한 줄 소개' }),
      description: text(p.description, 300, { lines: true, label: '소개글' }),
      quote: text(p.quote, 80, { label: '대표 문구' }),
      schedule: text(p.schedule, 60, { label: '다음 약속' }),
      spoonUrl: httpsUrl(p.spoonUrl, { hosts: ['www.spooncast.net', 'spooncast.net'] }),
      avatar: photo(p.avatar, pageId, { optional: true }),
      cover: photo(p.cover, pageId, { optional: true })
    },
    menus: menus.map((m: any) => {
      if (typeof m?.id !== 'string' || !/^[a-z0-9_]{2,24}$/.test(m.id) || ids.has(m.id)) throw fail(400, '메뉴 구성을 확인해 주세요.');
      ids.add(m.id);
      if (!FORMS.includes(m.form)) throw fail(400, '메뉴 양식을 확인해 주세요.');
      return { id: m.id, name: text(m.name, 24, { required: true, label: '메뉴 이름' }), description: text(m.description, 80, { label: '메뉴 설명' }), form: m.form, visible: m.visible !== false, options: options(m.form, m.options && typeof m.options === 'object' ? m.options : {}) };
    })
  };
}

export function starterConfig(nickname: string) {
  const name = text(nickname, 24) || '나의 팬페이지';
  return {
    v: 1, theme: 'rose', layout: 'story',
    profile: { name, intro: '', description: '', quote: '', schedule: '', spoonUrl: '', avatar: null, cover: null },
    menus: [
      { id: 'lounge', name: '팬 라운지', description: '편하게 한마디 남겨 주세요.', form: 'lounge', visible: true, options: { question: '', showMissions: true } },
      { id: 'memories', name: '추억', description: '함께한 순간들을 모아두는 공간이에요.', form: 'photo_text', visible: true, options: { categories: ['방송', '이벤트', '일상'], allowComments: true, showOnHome: true } },
      { id: 'archive', name: '박제관', description: '잊고 싶지 않은 순간들을 여기에.', form: 'archive', visible: true, options: { allowComments: true, showOnHome: true } },
      { id: 'ranking', name: '팬 랭킹', description: '언제나 고마운, 소중한 이름들.', form: 'ranking', visible: true, options: { support: true, activity: true } },
      { id: 'days', name: '특별한 날', description: '함께 기억하고 기다리는 날들.', form: 'days', visible: true, options: { days: [] } }
    ]
  };
}

export function menuOf(cfg: any, menuId: unknown, forms?: string[], { visibleOnly = false } = {}) {
  const m = (cfg?.menus || []).find((x: any) => x.id === menuId && (!visibleOnly || x.visible !== false));
  if (!m || (forms && !forms.includes(m.form))) throw fail(404, '메뉴를 찾을 수 없어요.');
  return m;
}

// Rankings pushed by JUN LIVE: names (and levels) only, 20 each.
export function rankings(value: unknown) {
  const r = (value || {}) as any;
  // One odd name must not stop the whole sync: bad entries are skipped.
  const name = (x: any) => { try { return text(x?.nickname, 40, { required: true, label: '닉네임' }); } catch { return ''; } };
  const names = (list: unknown) => (Array.isArray(list) ? list : []).map(name).filter(Boolean).slice(0, 20).map(nickname => ({ nickname }));
  return {
    support: { week: names(r.support?.week), month: names(r.support?.month), all: names(r.support?.all) },
    activity: (Array.isArray(r.activity) ? r.activity : []).map((x: any) => ({ nickname: name(x), level: Number.isInteger(x?.level) && x.level >= 0 && x.level < 10000 ? x.level : 0 })).filter(x => x.nickname).slice(0, 20)
  };
}

export function b64(value: unknown, max: number): Uint8Array {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length > Math.ceil(max / 3) * 4 + 4) throw fail(413, '사진이 너무 커요.');
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  if (out.length > max) throw fail(413, '사진이 너무 커요.');
  return out;
}

// Reads width/height from a baseline or progressive JPEG; null if it is not one.
export function jpegSize(b: Uint8Array): { w: number; h: number } | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue; }
    const len = (b[i + 2] << 8) | b[i + 3];
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
    }
    i += 2 + len;
  }
  return null;
}

export function koreaDay(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

// What fans may see: hidden menus are left out entirely.
export const publicConfig = (cfg: any) => cfg && ({ ...cfg, menus: (cfg.menus || []).filter((m: any) => m.visible !== false) });

export function nextReward(rewards: { at: number; label: string }[], total: number) {
  return (rewards || []).find(r => r.at > total) || null;
}

export const fanId = (v: unknown) => { if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(v)) throw fail(400, '잠시 후 다시 시도해 주세요.'); return v; };
export const uuid = (v: unknown, label = '대상') => { if (typeof v !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v)) throw fail(400, `${label}을(를) 확인해 주세요.`); return v; };
export const before = (v: unknown) => { if (v === null || v === undefined || v === '') return null; if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) throw fail(400, '목록 위치를 확인해 주세요.'); return new Date(v).toISOString(); };
