// DJ 편집 화면(팬페이지 꾸미기). 자동 임시 저장, 공개하기, 오른쪽 미리보기.
import { h, icon, clear, toast, copyText, confirmDialog, debounce, field, store } from '../lib/dom.js';
import { THEMES, THEME_IDS, LAYOUTS, LIMITS, defaultConfig, validateConfig, validateSlug, safeSpoonUrl } from '../lib/config.js';
import { readCodeFromHash } from '../lib/route.js';
import { relativeTime } from '../lib/text.js';
import { sampleHome, SAMPLE_RANKINGS } from '../lib/samples.js';
import { prepareImage } from '../lib/image.js';
import { api, auth, isDemo, photoUrl } from '../api.js';
import { previewHome } from './fan.js';
import { menusTab } from './studio-menus.js';
import { postsTab, commentsTab, pollsTab, attendanceTab } from './studio-manage.js';

const TABS = [
  ['basic', '기본 정보'], ['design', '디자인'], ['menus', '메뉴'], ['posts', '글·사진 올리기'],
  ['comments', '팬 댓글 관리'], ['polls', '투표'], ['attendance', '출석 현황'],
];

const clone = (x) => JSON.parse(JSON.stringify(x));

export async function renderStudio(root, app) {
  document.title = '팬페이지 꾸미기 · JUN LIVE';
  document.documentElement.removeAttribute('style');
  const wrap = h('div', { class: 'studio-gate' }, h('div', { class: 'gate-card' }, h('b', null, 'JUN LIVE 팬페이지'), h('div', null, '연결하는 중…')));
  root.replaceChildren(wrap);

  // 1회용 코드 → 토큰
  const code = readCodeFromHash(location.hash);
  if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
  if (code) {
    try {
      const r = await api.exchange(code);
      auth.set(r.token, r.expires);
    } catch (e) {
      if (!auth.get()) return gate(root, e.status === 400 || e.status === 401 || e.status === 404 ? '연결 코드가 만료됐어요. JUN LIVE 프로그램에서 "팬페이지 꾸미기"를 다시 눌러 주세요.' : e.message);
    }
  }
  if (!auth.get() && isDemo()) auth.set('demo-token', new Date(Date.now() + 30 * 86400e3).toISOString());
  if (!auth.get()) return gate(root);

  let data;
  try { data = await api.ownerPage(); } catch (e) {
    if (e.status === 401) return gate(root, '로그인이 끝났어요. JUN LIVE 프로그램에서 "팬페이지 꾸미기"를 다시 눌러 열어 주세요.');
    return gate(root, e.message, () => renderStudio(root, app));
  }
  new Studio(root, app, data).mount();
}

function gate(root, message, retry) {
  root.replaceChildren(h('div', { class: 'studio-gate' }, h('div', { class: 'gate-card' },
    h('b', null, 'JUN LIVE 팬페이지'),
    h('h1', null, '팬페이지 꾸미기'),
    h('p', null, message || 'JUN LIVE 프로그램에서 \'팬페이지 꾸미기\'를 눌러 열어 주세요.'),
    retry ? h('button', { type: 'button', class: 'btn btn-dark', onclick: retry }, '다시 해 보기') : null,
    h('p', { class: 'small muted' }, '이 화면은 팬페이지 주인(DJ)만 쓸 수 있어요.'))));
}

class Studio {
  constructor(root, app, data) {
    this.root = root; this.app = app;
    this.page = data.page;
    this.spoon = data.spoon || {};
    this.draft = this.page ? clone(this.page.draft) : defaultConfig(this.spoon.nickname || '');
    this.revision = this.page ? this.page.revision : 0;
    this.slug = this.page?.slug || '';
    this.tab = store.get('fp_studio_tab', 'basic');
    if (!TABS.some(([id]) => id === this.tab) || !this.page) this.tab = 'basic';
    this.state = this.page ? 'saved' : 'needSlug';
    this.savedAt = Date.now();
    this.version = 0; this.savedVersion = 0;
    this.saving = null;
    this.previewMode = 'phone';
    this.autosave = debounce(() => this.save(), 1500);
    this.refreshPreview = debounce(() => this.drawPreview(), 250);
    this.selectedMenu = this.draft.menus[0]?.id || null;
    setInterval(() => this.paintStatus(), 30000);
    window.addEventListener('beforeunload', (e) => { if (this.version !== this.savedVersion && this.page) { e.preventDefault(); e.returnValue = ''; } });
  }

  // ---- 틀 ----
  mount() {
    this.statusEl = h('span', { class: 'save-chip', role: 'status', 'aria-live': 'polite' });
    this.addrEl = h('div', { class: 'addr' });
    this.pubEl = h('div', { class: 'top-actions' });
    this.tabBar = h('div', { class: 'st-tabs', role: 'tablist', 'aria-label': '꾸미기 메뉴' });
    this.panel = h('div', { class: 'st-panel-body', role: 'tabpanel', tabindex: '-1' });
    this.previewBox = h('div', { class: 'pv-stage' });
    this.previewPane = h('aside', { class: 'st-preview', 'aria-label': '팬 화면 미리보기' },
      h('div', { class: 'pv-toggle', role: 'group', 'aria-label': '미리보기 크기' },
        ...[['phone', '휴대폰'], ['pc', 'PC']].map(([id, label]) => h('button', { type: 'button', 'aria-pressed': String(id === this.previewMode), dataset: { mode: id }, onclick: () => { this.previewMode = id; this.previewPane.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === id))); this.drawPreview(); } }, label))),
      this.previewBox,
      h('p', { class: 'pv-note' }, '미리보기 · 글과 사진은 예시예요'),
      h('button', { type: 'button', class: 'btn btn-line pv-close', onclick: () => this.root.querySelector('.studio').classList.remove('show-preview') }, '미리보기 닫기'));
    this.banner = h('div', { class: 'st-banner', role: 'alert', hidden: true });
    const shell = h('div', { class: 'studio' },
      h('header', { class: 'st-top' },
        h('b', { class: 'st-title' }, '팬페이지 꾸미기'),
        this.statusEl, this.addrEl, this.pubEl),
      this.banner,
      h('div', { class: 'st-body' },
        h('section', { class: 'st-panel' }, this.tabBar, this.panel),
        this.previewPane));
    this.root.replaceChildren(shell);
    this.paintTop();
    this.paintStatus();
    this.paintTabs();
    this.drawTab();
    this.drawPreview();
    if (this.page?.blocked) this.showBanner('이 팬페이지는 지금 닫혀 있어요. 팬들에게 보이지 않아요. 서비스 관리자에게 문의해 주세요.');
  }

  showBanner(text, action) {
    this.banner.hidden = false;
    this.banner.replaceChildren(h('span', null, text), action || '');
  }

  publicUrl() {
    return location.origin + this.app.link({ name: 'fan', slug: this.slug || 'haru' });
  }

  paintTop() {
    clear(this.addrEl);
    const base = (location.host + this.app.base).replace(/\/$/, '');
    if (this.page) {
      this.addrEl.append(h('span', { class: 'addr-text' }, `${base}/p/`, h('b', null, this.slug)),
        h('button', { type: 'button', class: 'mini-btn', onclick: async () => toast((await copyText(this.publicUrl())) ? '주소를 복사했어요.' : '복사하지 못했어요.') }, '주소 복사'));
    } else this.addrEl.append(h('span', { class: 'addr-text muted' }, '아직 주소가 없어요'));
    clear(this.pubEl);
    const published = !!this.page?.published;
    const changed = published && JSON.stringify(this.page.published) !== JSON.stringify(this.draft);
    this.pubEl.append(
      h('button', { type: 'button', class: 'btn btn-line pv-open', onclick: () => this.root.querySelector('.studio').classList.add('show-preview') }, '미리보기'),
      h('button', { type: 'button', class: 'btn btn-line', onclick: () => this.fanView() }, '팬 화면으로 보기'),
      published ? h('button', { type: 'button', class: 'btn btn-line', onclick: () => this.unpublish() }, '공개 중지') : null,
      h('button', { type: 'button', class: 'btn btn-primary', disabled: !this.page || (published && !changed), onclick: () => this.publish() },
        !published ? '공개하기' : changed ? '바뀐 내용 공개하기' : '공개 중 ✓'));
  }

  paintStatus() {
    const s = this.state;
    const txt = {
      saved: `임시 저장됨 · ${relativeTime(new Date(this.savedAt).toISOString())}`,
      dirty: '고치는 중…', saving: '저장 중…', needSlug: '주소를 만들면 저장돼요',
      invalid: `저장 전에 고칠 곳이 있어요: ${this.invalidMsg || ''}`,
      error: `저장하지 못했어요 · ${this.errorMsg || ''}`,
      conflict: '다른 곳에서 바뀌었어요. 새로고침해 주세요.',
    }[s];
    this.statusEl.textContent = txt;
    this.statusEl.dataset.state = s;
  }

  paintTabs() {
    clear(this.tabBar);
    for (const [id, label] of TABS) {
      const b = h('button', { type: 'button', role: 'tab', id: 'tab_' + id, 'aria-selected': String(id === this.tab), 'aria-controls': 'st_panel', tabindex: id === this.tab ? '0' : '-1', onclick: () => this.setTab(id) }, label);
      this.tabBar.append(b);
    }
    this.panel.id = 'st_panel';
    this.panel.setAttribute('aria-labelledby', 'tab_' + this.tab);
    this.tabBar.onkeydown = (e) => {
      const ids = TABS.map((t) => t[0]);
      const i = ids.indexOf(this.tab);
      let n = null;
      if (e.key === 'ArrowRight') n = ids[(i + 1) % ids.length];
      if (e.key === 'ArrowLeft') n = ids[(i - 1 + ids.length) % ids.length];
      if (n) { e.preventDefault(); this.setTab(n); this.tabBar.querySelector('#tab_' + n).focus(); }
    };
  }

  setTab(id, opts = {}) {
    this.tab = id;
    store.set('fp_studio_tab', id);
    Object.assign(this, opts);
    this.paintTabs();
    this.drawTab();
  }

  drawTab() {
    clear(this.panel);
    const map = { basic: () => this.basicTab(), design: () => this.designTab(), menus: () => menusTab(this), posts: () => postsTab(this), comments: () => commentsTab(this), polls: () => pollsTab(this), attendance: () => attendanceTab(this) };
    const el = map[this.tab]();
    this.panel.append(el);
    this.panel.scrollTop = 0;
  }

  // ---- 저장 ----
  changed({ preview = true, top = true } = {}) {
    this.version++;
    if (this.state === 'conflict') return;
    if (!this.page) { this.state = 'needSlug'; this.paintStatus(); if (preview) this.refreshPreview(); return; }
    this.state = 'dirty';
    this.paintStatus();
    this.autosave();
    if (preview) this.refreshPreview();
    if (top) this.paintTopSoon();
  }

  paintTopSoon() {
    clearTimeout(this._tt);
    this._tt = setTimeout(() => this.paintTop(), 400);
  }

  async save({ slug } = {}) {
    if (this.state === 'conflict') return false;
    if (this.saving) { this.pendingSave = true; return this.saving; }
    const errs = validateConfig(this.draft);
    if (errs.length) { this.state = 'invalid'; this.invalidMsg = errs[0].message; this.paintStatus(); return false; }
    if (!this.page && !slug) { this.state = 'needSlug'; this.paintStatus(); return false; }
    const v = this.version;
    this.state = 'saving'; this.paintStatus();
    this.saving = (async () => {
      try {
        const body = { draft: this.draft, revision: this.revision };
        if (!this.page) body.slug = slug;
        const r = await api.savePage(body);
        const created = !this.page;
        this.page = r.page; this.revision = r.page.revision; this.slug = r.page.slug;
        this.savedVersion = v; this.savedAt = Date.now();
        this.state = this.version === v ? 'saved' : 'dirty';
        if (created) { toast('주소를 만들었어요. 이제부터 자동으로 저장돼요.'); this.drawTab(); }
        this.paintTop();
        return true;
      } catch (e) {
        if (e.status === 409 && this.page) {
          this.state = 'conflict';
          this.showBanner('다른 곳에서 바뀌었어요. 새로고침해 주세요.', h('button', { type: 'button', class: 'btn btn-line', onclick: () => location.reload() }, '새로고침'));
        } else if (e.status === 401) {
          this.state = 'error'; this.errorMsg = '다시 로그인해 주세요';
          this.showBanner('로그인이 끝났어요. JUN LIVE 프로그램에서 "팬페이지 꾸미기"를 다시 눌러 주세요. (고친 내용은 저장되지 않았어요)');
        } else { this.state = 'error'; this.errorMsg = e.message; if (!this.page) throw e; }
        return false;
      } finally {
        this.saving = null;
        this.paintStatus();
        if (this.pendingSave || (this.state === 'dirty')) { this.pendingSave = false; if (this.page && this.state !== 'conflict') this.autosave(); }
      }
    })();
    return this.saving;
  }

  // 지금 바로 저장(글 올리기·투표 전에)
  async flush() {
    this.autosave.cancel();
    if (!this.page) { toast('먼저 기본 정보 탭에서 주소를 만들어 주세요.', 'error'); return false; }
    if (this.saving) await this.saving;
    if (this.version === this.savedVersion) return true;
    return this.save();
  }

  async publish() {
    if (!(await this.flush())) { toast('저장하지 못해서 공개할 수 없어요. 위의 안내를 확인해 주세요.', 'error'); return; }
    const first = !this.page.published;
    if (first && !(await confirmDialog('팬페이지를 공개할까요?', { ok: '공개하기', detail: '주소를 아는 누구나 볼 수 있어요.' }))) return;
    try {
      const r = await api.publish();
      this.page = r.page;
      toast(first ? '공개했어요! 주소를 팬들에게 알려 주세요.' : '바뀐 내용을 공개했어요.');
      this.paintTop();
    } catch (e) { toast(e.message, 'error'); }
  }

  async unpublish() {
    if (!(await confirmDialog('공개를 멈출까요?', { ok: '공개 중지', danger: true, detail: '팬들이 페이지를 볼 수 없게 돼요. 내용은 그대로 남아요.' }))) return;
    try { const r = await api.unpublish(); this.page = r.page; toast('공개를 멈췄어요.'); this.paintTop(); } catch (e) { toast(e.message, 'error'); }
  }

  fanView() {
    const opener = document.activeElement;
    const body = h('div', { class: 'fanview-body' }, previewHome(this.app, this.previewData()));
    const dlg = h('dialog', { class: 'fanview', 'aria-label': '팬 화면 미리보기' },
      h('div', { class: 'fanview-bar' },
        h('b', null, '팬 화면 미리보기'),
        h('span', { class: 'small muted' }, '지금 고치는 내용 · 글은 예시'),
        this.page?.published ? h('a', { href: this.publicUrl(), target: '_blank', rel: 'noopener', class: 'btn btn-line' }, '공개된 페이지 열기') : null,
        h('button', { type: 'button', class: 'btn btn-dark', onclick: () => dlg.close() }, '닫기')),
      body);
    dlg.addEventListener('close', () => { dlg.remove(); opener?.focus?.(); });
    document.body.append(dlg);
    dlg.showModal();
  }

  previewData() {
    return { config: this.draft, slug: this.slug || 'preview', home: sampleHome(this.draft), rankings: SAMPLE_RANKINGS, live: null };
  }

  drawPreview() {
    const content = previewHome(this.app, this.previewData());
    if (this.previewMode === 'phone') {
      this.previewBox.replaceChildren(h('div', { class: 'pv-phone' }, h('div', { class: 'pv-screen' }, content)));
    } else {
      const inner = h('div', { class: 'pv-pc-inner' }, content);
      const outer = h('div', { class: 'pv-pc' }, inner);
      this.previewBox.replaceChildren(outer);
      const fit = () => { const s = Math.min(1, (outer.clientWidth || 380) / 1100); inner.style.transform = `scale(${s})`; outer.style.height = Math.min(900, inner.scrollHeight) * s + 'px'; };
      requestAnimationFrame(fit);
      if (!this._pcRO) { this._pcRO = new ResizeObserver(() => { const o = this.previewBox.querySelector('.pv-pc'); if (o) { const i = o.firstChild; const s = Math.min(1, o.clientWidth / 1100); i.style.transform = `scale(${s})`; o.style.height = Math.min(900, i.scrollHeight) * s + 'px'; } }); this._pcRO.observe(this.previewBox); }
    }
  }

  requirePage(el) {
    if (this.page) return true;
    el.append(h('div', { class: 'st-card' }, h('p', null, '먼저 기본 정보 탭에서 팬페이지 주소를 만들어 주세요.'), h('button', { type: 'button', class: 'btn btn-dark', onclick: () => this.setTab('basic') }, '기본 정보로 가기')));
    return false;
  }

  // ---- 기본 정보 ----
  basicTab() {
    const p = this.draft.profile;
    const el = h('div', { class: 'st-stack' });
    if (!this.page) el.append(this.slugCard());
    const set = (k) => (v) => { p[k] = v; this.changed(); };
    const spoonHint = h('p', { class: 'field-hint', id: 'spoon_hint' }, 'https://www.spooncast.net/ 으로 시작하는 내 채널 주소');
    const spoon = field({ label: '스푼 주소', value: p.spoonUrl, placeholder: 'https://www.spooncast.net/kr/channel/…', type: 'url', onInput: (v) => { p.spoonUrl = v.trim(); spoonHint.textContent = !v.trim() || safeSpoonUrl(v) ? 'https://www.spooncast.net/ 으로 시작하는 내 채널 주소' : '⚠ spooncast.net 의 https 주소만 넣을 수 있어요.'; spoonHint.classList.toggle('bad', !!v.trim() && !safeSpoonUrl(v)); this.changed(); } });
    spoon.input.setAttribute('aria-describedby', 'spoon_hint');
    spoon.append(spoonHint);
    el.append(
      h('section', { class: 'st-card st-stack' },
        h('h2', null, '프로필'),
        field({ label: '이름', value: p.name, max: LIMITS.name, required: true, onInput: set('name') }),
        field({ label: '한 줄 소개', value: p.intro, max: LIMITS.intro, multiline: true, rows: 2, placeholder: '당신의 하루 끝에,\n조금 더 다정한 시간.', onInput: set('intro') }),
        field({ label: '소개글', value: p.description, max: LIMITS.description, multiline: true, rows: 4, onInput: set('description') }),
        field({ label: '좋아하는 한마디 (선택)', value: p.quote, max: LIMITS.quote, onInput: set('quote') }),
        field({ label: '다음 약속 · 방송 일정 (선택)', value: p.schedule, max: LIMITS.schedule, placeholder: '매일 저녁 8시', onInput: set('schedule') }),
        spoon),
      h('section', { class: 'st-card st-stack' },
        h('h2', null, '사진'),
        h('p', { class: 'small muted' }, '사진은 자르지 않고 원래 모양 그대로 보여요. 올리기 전에 알맞은 크기로 줄여요.'),
        this.photoPicker('avatar', '프로필 사진'),
        this.photoPicker('cover', '커버 사진')));
    return el;
  }

  slugCard() {
    const input = h('input', { id: 'slug_in', value: this.slug, placeholder: 'haru', autocomplete: 'off', spellcheck: 'false', maxlength: 30, 'aria-describedby': 'slug_msg' });
    const msg = h('p', { class: 'field-hint', id: 'slug_msg', 'aria-live': 'polite' }, '영문 소문자·숫자·하이픈 3~30자. 처음 한 번 정하면 바꿀 수 없어요.');
    const btn = h('button', { type: 'button', class: 'btn btn-primary' }, '이 주소로 만들기');
    input.addEventListener('input', () => {
      input.value = input.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
      const e = validateSlug(input.value);
      msg.textContent = input.value && e ? '⚠ ' + e : '영문 소문자·숫자·하이픈 3~30자. 처음 한 번 정하면 바꿀 수 없어요.';
      msg.classList.toggle('bad', !!(input.value && e));
    });
    btn.addEventListener('click', async () => {
      const e = validateSlug(input.value);
      if (e) { msg.textContent = '⚠ ' + e; msg.classList.add('bad'); input.focus(); return; }
      btn.disabled = true; btn.textContent = '만드는 중…';
      try {
        const ok = await this.save({ slug: input.value });
        if (!ok) { msg.textContent = '⚠ ' + (this.state === 'invalid' ? this.invalidMsg : this.errorMsg || '만들지 못했어요.'); msg.classList.add('bad'); }
      } catch (err) { msg.textContent = '⚠ ' + err.message; msg.classList.add('bad'); this.state = 'needSlug'; this.paintStatus(); }
      btn.disabled = false; btn.textContent = '이 주소로 만들기';
    });
    const base = (location.host + this.app.base).replace(/\/$/, '');
    return h('section', { class: 'st-card st-stack accent-card' },
      h('h2', null, '팬페이지 주소 만들기'),
      h('p', { class: 'small' }, `${this.spoon.nickname ? this.spoon.nickname + '님, ' : ''}반가워요! 팬들이 들어올 주소를 정해 주세요. 주소를 만들면 그때부터 자동으로 저장돼요.`),
      h('label', { for: 'slug_in', class: 'field-label' }, '페이지 주소'),
      h('div', { class: 'slug-row' }, h('span', { class: 'slug-prefix' }, `${base}/p/`), input),
      msg, btn);
  }

  photoPicker(key, label) {
    const p = this.draft.profile;
    const box = h('div', { class: 'photo-pick' });
    const draw = (status = '', progress = null) => {
      const ph = p[key];
      const fileIn = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', class: 'sr-only', id: 'pick_' + key, disabled: !this.page || progress !== null });
      fileIn.addEventListener('change', () => { const f = fileIn.files?.[0]; if (f) upload(f); });
      box.replaceChildren(
        h('div', { class: 'photo-pick-view ' + key }, ph
          ? h('img', { src: photoUrl(ph.thumb), alt: `${label} 미리보기`, width: ph.w, height: ph.h, style: { 'aspect-ratio': `${ph.w} / ${ph.h}` } })
          : h('span', { class: 'muted small' }, '사진 없음')),
        h('div', { class: 'col gap-s' },
          h('b', null, label),
          fileIn,
          h('div', { class: 'row gap' },
            h('label', { for: 'pick_' + key, class: 'btn btn-line' + (!this.page || progress !== null ? ' disabled' : '') }, ph ? '바꾸기' : '사진 고르기'),
            ph ? h('button', { type: 'button', class: 'btn btn-line', disabled: progress !== null, onclick: () => { p[key] = null; this.changed(); draw(); } }, '지우기') : null),
          !this.page ? h('span', { class: 'small muted' }, '주소를 만든 뒤에 올릴 수 있어요.') : null,
          progress !== null ? h('progress', { max: 100, value: Math.round(progress * 100), 'aria-label': `${label} 올리는 중` }) : null,
          h('span', { class: 'small', role: 'status', 'aria-live': 'polite' }, status)));
    };
    const upload = async (file) => {
      draw('사진 줄이는 중…', 0);
      try {
        const img = await prepareImage(file);
        draw('올리는 중… 0%', 0.02);
        const r = await api.uploadPhoto({ data: img.data, thumb: img.thumb, w: img.w, h: img.h }, (f) => draw(`올리는 중… ${Math.round(f * 100)}%`, f));
        p[key] = { path: r.path, thumb: r.thumb, w: r.w, h: r.h };
        this.changed();
        draw('올렸어요.');
      } catch (e) { draw('⚠ ' + e.message); }
    };
    draw();
    return box;
  }

  // ---- 디자인 ----
  designTab() {
    const el = h('div', { class: 'st-stack' });
    const sw = h('div', { class: 'swatches', role: 'group', 'aria-label': '테마 색' });
    const drawSw = () => sw.replaceChildren(...THEME_IDS.map((id) => {
      const t = THEMES[id];
      const on = this.draft.theme === id;
      const b = h('button', { type: 'button', class: 'swatch', 'aria-pressed': String(on), 'aria-label': t.name, style: { background: t.paper, color: t.ink } },
        h('span', { class: 'sw-dots', 'aria-hidden': 'true' }, h('i', { style: { background: t.accent } }), h('i', { style: { background: t.bright } })),
        h('span', { class: 'sw-name' }, t.name));
      b.addEventListener('click', () => { this.draft.theme = id; this.changed(); drawSw(); });
      return b;
    }));
    drawSw();
    const lay = h('div', { class: 'layouts', role: 'group', 'aria-label': '배치' });
    const drawLay = () => lay.replaceChildren(...Object.entries(LAYOUTS).map(([id, l]) => {
      const on = this.draft.layout === id;
      return h('button', { type: 'button', class: 'layout-card', 'aria-pressed': String(on), onclick: () => { this.draft.layout = id; this.changed(); drawLay(); } },
        h('span', { class: 'layout-pic ' + id, 'aria-hidden': 'true' }, ...Array.from({ length: id === 'photo' ? 6 : 4 }, () => h('i'))),
        h('b', null, l.name), h('span', { class: 'small muted' }, l.desc));
    }));
    drawLay();
    el.append(
      h('section', { class: 'st-card st-stack' }, h('h2', null, '테마 색'), sw),
      h('section', { class: 'st-card st-stack' }, h('h2', null, '배치'), lay));
    return el;
  }
}
