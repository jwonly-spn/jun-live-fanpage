// 스튜디오 · 메뉴 탭: 순서 바꾸기(끌기, Alt+↑/↓, 버튼), 추가·삭제·숨기기, 양식 고르기, 양식별 설정.
import { h, icon, clear, toast, confirmDialog, field, toggle } from '../lib/dom.js';
import { FORMS, FORM_IDS, LIMITS, newMenu, defaultOptions, safeHttpsUrl, randomId } from '../lib/config.js';
import { charCount } from '../lib/text.js';

export function menusTab(st) {
  const menus = st.draft.menus;
  if (!menus.find((m) => m.id === st.selectedMenu)) st.selectedMenu = menus[0]?.id || null;
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const list = h('ol', { class: 'menu-list', 'aria-label': '내 메뉴 (Alt+위/아래 화살표로 순서 바꾸기)' });
  const countEl = h('span', { class: 'small muted' });
  const addBtn = h('button', { type: 'button', class: 'dashed-btn st' }, icon('plus', { size: 18 }), '새 메뉴 만들기');
  const editor = h('section', { class: 'st-card st-stack menu-editor', 'aria-label': '메뉴 편집' });

  function move(from, to, focus = true) {
    if (to < 0 || to >= menus.length || from === to) return;
    const [m] = menus.splice(from, 1);
    menus.splice(to, 0, m);
    st.changed();
    drawList();
    live.textContent = `‘${m.name}’ 메뉴를 ${to + 1}번째로 옮겼어요.`;
    if (focus) list.querySelector(`[data-id="${m.id}"]`)?.focus();
  }

  function drawList() {
    clear(list);
    countEl.textContent = `${menus.length} / ${LIMITS.menus}개`;
    addBtn.disabled = menus.length >= LIMITS.menus;
    menus.forEach((m, i) => {
      const vis = h('input', { type: 'checkbox', checked: m.visible, 'aria-label': `${m.name} 보이기` });
      vis.addEventListener('change', () => { m.visible = vis.checked; st.changed(); drawList(); if (m.id === st.selectedMenu) drawEditor(); });
      const handle = h('span', { class: 'grip', title: '끌어서 순서 바꾸기', 'aria-hidden': 'true' }, icon('grip', { size: 16 }));
      const row = h('li', {
        class: 'menu-row' + (m.id === st.selectedMenu ? ' selected' : '') + (m.visible ? '' : ' hidden-menu'),
        tabindex: '0', dataset: { id: m.id }, 'aria-current': m.id === st.selectedMenu ? 'true' : null,
        'aria-label': `${i + 1}번째 메뉴 ${m.name}, ${FORMS[m.form]?.name}${m.visible ? '' : ', 숨김'}. 눌러서 고치기, Alt+화살표로 순서 바꾸기`,
      },
        handle,
        h('button', { type: 'button', class: 'menu-pick', onclick: () => select(m.id), tabindex: '-1' },
          h('b', null, m.name || '(이름 없음)'), h('span', { class: 'small muted' }, FORMS[m.form]?.name, m.visible ? '' : ' · 숨김')),
        h('span', { class: 'row-tools' },
          h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': `${m.name} 위로`, disabled: i === 0, onclick: (e) => { e.stopPropagation(); move(i, i - 1); } }, icon('up', { size: 16 })),
          h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': `${m.name} 아래로`, disabled: i === menus.length - 1, onclick: (e) => { e.stopPropagation(); move(i, i + 1); } }, icon('down', { size: 16 })),
          h('label', { class: 'vis', title: '보이기' }, vis, h('span', { 'aria-hidden': 'true' }, '보이기')),
          h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': `${m.name} 삭제`, onclick: (e) => { e.stopPropagation(); remove(m); } }, icon('trash', { size: 16 }))));
      row.addEventListener('keydown', (e) => {
        if (e.target !== row) return;
        if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); move(i, i - 1); }
        else if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); move(i, i + 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); row.previousElementSibling?.focus(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); row.nextElementSibling?.focus(); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(m.id); }
      });
      row.addEventListener('click', (e) => { if (!e.target.closest('button,input,label')) select(m.id); });
      dragOn(handle, row);
      list.append(row);
    });
  }

  // 손잡이를 끌어 순서 바꾸기(마우스·터치 모두)
  function dragOn(handle, row) {
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const from = [...list.children].indexOf(row);
      handle.setPointerCapture(e.pointerId);
      row.classList.add('dragging');
      const onMove = (ev) => {
        const rows = [...list.children];
        const target = rows.find((r) => r !== row && ev.clientY < r.getBoundingClientRect().top + r.offsetHeight / 2);
        if (target) { if (target !== row.nextElementSibling) list.insertBefore(row, target); } else if (list.lastElementChild !== row) list.append(row);
      };
      const onUp = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onUp);
        row.classList.remove('dragging');
        const to = [...list.children].indexOf(row);
        if (to !== from) { const [m] = menus.splice(from, 1); menus.splice(to, 0, m); st.changed(); live.textContent = `‘${m.name}’ 메뉴를 ${to + 1}번째로 옮겼어요.`; }
        drawList();
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    });
  }

  function select(id) { st.selectedMenu = id; drawList(); drawEditor(); editor.querySelector('input')?.focus(); }

  async function remove(m) {
    if (!(await confirmDialog(`‘${m.name}’ 메뉴를 지울까요?`, { ok: '지우기', danger: true, detail: '이 메뉴의 글·댓글은 팬 화면에서 더 이상 보이지 않아요.' }))) return;
    const i = menus.indexOf(m);
    menus.splice(i, 1);
    if (st.selectedMenu === m.id) st.selectedMenu = menus[Math.max(0, i - 1)]?.id || null;
    st.changed(); drawList(); drawEditor();
    toast(`‘${m.name}’ 메뉴를 지웠어요.`);
  }

  addBtn.addEventListener('click', () => {
    if (menus.length >= LIMITS.menus) return;
    const m = newMenu('photo_text', menus);
    menus.push(m);
    st.selectedMenu = m.id;
    st.changed(); drawList(); drawEditor();
    editor.querySelector('input')?.select();
  });

  function drawEditor() {
    clear(editor);
    const m = menus.find((x) => x.id === st.selectedMenu);
    if (!m) { editor.append(h('p', { class: 'muted' }, '왼쪽에서 메뉴를 고르거나 새로 만들어 주세요.')); return; }
    const title = h('h2', null, `메뉴 편집 · ${m.name}`);
    const refreshName = () => { title.textContent = `메뉴 편집 · ${m.name}`; drawList(); };
    editor.append(title,
      h('div', { class: 'grid-2' },
        field({ label: '메뉴 이름', value: m.name, max: LIMITS.menuName, onInput: (v) => { m.name = v; st.changed(); refreshName(); } }),
        field({ label: '한 줄 설명', value: m.description, max: LIMITS.menuDesc, onInput: (v) => { m.description = v; st.changed(); } })),
      h('div', { class: 'st-stack' },
        h('b', { class: 'small' }, '양식 고르기 ', h('span', { class: 'muted' }, '· 이 메뉴에 무엇을 올릴지 정해요')),
        h('div', { class: 'form-picker', role: 'radiogroup', 'aria-label': '양식' }, FORM_IDS.map((f) => {
          const on = m.form === f;
          const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(on), class: 'form-card', tabindex: on ? '0' : '-1' },
            h('b', null, FORMS[f].name), h('span', null, FORMS[f].desc), FORMS[f].tag ? h('em', null, FORMS[f].tag) : null);
          b.addEventListener('click', async () => {
            if (m.form === f) return;
            if (FORMS[m.form].posts && !(await confirmDialog('양식을 바꿀까요?', { ok: '바꾸기', detail: '양식별 설정이 처음 상태로 돌아가요. 이미 올린 글은 새 양식에 맞지 않으면 보이지 않을 수 있어요.' }))) return;
            const oldName = FORMS[m.form].name;
            m.form = f; m.options = defaultOptions(f);
            if (!m.name || m.name === oldName || m.name === '새 메뉴') m.name = FORMS[f].name;
            st.changed(); drawList(); drawEditor();
            editor.querySelector('[role=radio][aria-checked=true]')?.focus();
          });
          b.addEventListener('keydown', (e) => {
            const cards = [...b.parentElement.children];
            const i = cards.indexOf(b);
            if (['ArrowRight', 'ArrowDown'].includes(e.key)) { e.preventDefault(); cards[(i + 1) % cards.length].focus(); }
            if (['ArrowLeft', 'ArrowUp'].includes(e.key)) { e.preventDefault(); cards[(i - 1 + cards.length) % cards.length].focus(); }
          });
          return b;
        }))),
      optionsEditor(st, m, () => drawEditor()),
      h('div', { class: 'row gap end' },
        h('button', { type: 'button', class: 'btn btn-line', onclick: () => { m.visible = !m.visible; st.changed(); drawList(); drawEditor(); } }, m.visible ? '숨기기' : '보이기'),
        h('button', { type: 'button', class: 'btn btn-line danger-text', onclick: () => remove(m) }, '메뉴 지우기')));
  }

  drawList();
  drawEditor();
  return h('div', { class: 'menus-tab' },
    h('section', { class: 'st-card st-stack menu-side' },
      h('div', { class: 'sec-title-row' }, h('h2', null, '내 메뉴'), countEl),
      h('p', { class: 'small muted' }, '손잡이를 끌거나 ↑↓ 버튼, Alt+화살표로 순서를 바꿔요. 눌러서 이름과 양식을 고쳐요.'),
      h('div', { class: 'menu-row home-row' }, h('b', null, '홈'), h('span', { class: 'small muted' }, '항상 맨 앞 · 방송 상태·다음 약속·최근 소식')),
      list, addBtn, live),
    editor);
}

function chipsEditor(st, arr, { max, maxLen, label, placeholder }) {
  const box = h('div', { class: 'st-stack' });
  const draw = () => {
    const input = h('input', { placeholder, maxlength: maxLen, 'aria-label': `${label} 이름` });
    const msg = h('span', { class: 'small bad', 'aria-live': 'polite' });
    const add = () => {
      const v = input.value.trim();
      if (!v) return;
      if (charCount(v) > maxLen) { msg.textContent = `${maxLen}자까지예요.`; return; }
      if (arr.includes(v)) { msg.textContent = '이미 있어요.'; return; }
      if (arr.length >= max) { msg.textContent = `${max}개까지예요.`; return; }
      arr.push(v); st.changed(); draw(); box.querySelector('input')?.focus();
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    box.replaceChildren(
      h('div', { class: 'row gap wrap center' },
        h('span', { class: 'small opt-label' }, label),
        arr.map((c, i) => h('span', { class: 'st-chip' }, c, h('button', { type: 'button', class: 'chip-x', 'aria-label': `${c} 지우기`, onclick: () => { arr.splice(i, 1); st.changed(); draw(); } }, '×'))),
        arr.length < max ? h('span', { class: 'row gap-s' }, input, h('button', { type: 'button', class: 'mini-btn', onclick: add }, `+ ${label} 추가`)) : null),
      msg);
  };
  draw();
  return box;
}

function rowsEditor(st, arr, { max, addLabel, make, cells, empty }) {
  const box = h('div', { class: 'st-stack' });
  const draw = () => {
    box.replaceChildren(
      arr.length ? h('ul', { class: 'rows-edit' }, arr.map((item, i) => h('li', { class: 'row-edit' }, cells(item, i, draw),
        h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': '지우기', onclick: () => { arr.splice(i, 1); st.changed(); draw(); } }, icon('trash', { size: 16 }))))) : h('p', { class: 'small muted' }, empty),
      arr.length < max ? h('button', { type: 'button', class: 'mini-btn', onclick: () => { arr.push(make()); st.changed(); draw(); box.querySelector('li:last-child input')?.focus(); } }, addLabel) : h('p', { class: 'small muted' }, `${max}개까지 넣을 수 있어요.`));
  };
  draw();
  return box;
}

function cellInput(label, value, onInput, props = {}) {
  const id = 'c_' + Math.random().toString(36).slice(2, 8);
  const input = h('input', { id, ...props });
  input.value = value ?? '';
  input.addEventListener('input', () => onInput(input.value, input));
  return h('span', { class: 'cell' }, h('label', { for: id, class: 'small' }, label), input);
}

function optionsEditor(st, m, redraw) {
  const o = m.options;
  const box = h('div', { class: 'opt-box st-stack' }, h('b', { class: 'small' }, `${FORMS[m.form].name} 양식 설정`));
  const tog = (key, label, hint) => toggle({ label, checked: !!o[key], hint, onChange: (v) => { o[key] = v; st.changed(); } });
  switch (m.form) {
    case 'board':
      box.append(tog('allowComments', '팬 댓글 허용'));
      break;
    case 'photo_text':
      o.categories ||= [];
      box.append(chipsEditor(st, o.categories, { max: LIMITS.categories, maxLen: LIMITS.category, label: '분류', placeholder: '예: 방송' }),
        h('div', { class: 'row gap wrap' }, tog('allowComments', '팬 댓글 허용'), tog('showOnHome', '홈에 최근 글 보여주기')));
      break;
    case 'album':
      o.categories ||= [];
      box.append(chipsEditor(st, o.categories, { max: LIMITS.categories, maxLen: LIMITS.category, label: '분류', placeholder: '예: 일상' }),
        tog('showOnHome', '홈에 최근 사진 보여주기'));
      break;
    case 'archive':
      box.append(h('div', { class: 'row gap wrap' }, tog('allowComments', '팬 댓글 허용'), tog('showOnHome', '홈에 최근 박제 보여주기')));
      break;
    case 'lounge':
      box.append(field({ label: '오늘의 질문', value: o.question, max: LIMITS.question, placeholder: '요즘 가장 자주 듣는 노래는 뭐예요?', onInput: (v) => { o.question = v; st.changed(); } }),
        tog('showMissions', '오늘 할 일 보여주기', '출석·투표·질문 답하기를 체크리스트로 보여줘요'));
      break;
    case 'attendance':
      o.rewards ||= [];
      box.append(h('p', { class: 'small muted' }, '출석 횟수가 채워지면 받을 보상이에요. JUN LIVE로 지급해요.'),
        rowsEditor(st, o.rewards, {
          max: LIMITS.rewards, addLabel: '+ 보상 추가', empty: '아직 보상이 없어요.',
          make: () => ({ at: (o.rewards.at(-1)?.at || 0) + 7, label: '' }),
          cells: (r) => [
            cellInput('몇 번째 출석', r.at, (v, el) => { const n = parseInt(v, 10); r.at = Number.isFinite(n) ? n : 0; el.setAttribute('aria-invalid', String(!(n >= 1 && n <= 1000))); st.changed(); }, { type: 'number', min: 1, max: 1000, inputmode: 'numeric', class: 'num' }),
            cellInput('보상', r.label, (v) => { r.label = v; st.changed(); }, { maxlength: LIMITS.rewardLabel, placeholder: '복권 1장' })],
        }));
      break;
    case 'poll':
      box.append(h('p', { class: 'small' }, '투표 질문과 선택지는 ‘투표’ 탭에서 만들어요.'),
        h('button', { type: 'button', class: 'mini-btn', onclick: async () => { await st.flush(); st.setTab('polls', { pollMenu: m.id }); } }, '투표 탭으로 가기'));
      break;
    case 'ranking':
      box.append(h('p', { class: 'small muted' }, 'JUN LIVE 방송 기록으로 자동으로 바뀌어요. 후원 금액은 보이지 않아요.'),
        h('div', { class: 'row gap wrap' }, tog('support', '후원 랭킹 보이기'), tog('activity', '애청지수 랭킹 보이기')));
      break;
    case 'days':
      o.days ||= [];
      box.append(rowsEditor(st, o.days, {
        max: LIMITS.days, addLabel: '+ 기념일 추가', empty: '아직 기념일이 없어요.',
        make: () => ({ id: randomId('d_', 5), title: '', date: new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10), yearly: true, note: '' }),
        cells: (d) => {
          const yearly = h('input', { type: 'checkbox', checked: !!d.yearly });
          yearly.addEventListener('change', () => { d.yearly = yearly.checked; st.changed(); });
          return [
            cellInput('이름', d.title, (v) => { d.title = v; st.changed(); }, { maxlength: LIMITS.dayTitle, placeholder: '데뷔 기념일' }),
            cellInput('날짜', d.date, (v) => { d.date = v; st.changed(); }, { type: 'date' }),
            h('label', { class: 'toggle sm' }, yearly, h('span', null, '매년')),
            cellInput('메모 (선택)', d.note, (v) => { d.note = v; st.changed(); }, { maxlength: LIMITS.dayNote })];
        },
      }));
      break;
    case 'links':
      o.links ||= [];
      box.append(rowsEditor(st, o.links, {
        max: LIMITS.links, addLabel: '+ 링크 추가', empty: '아직 링크가 없어요.',
        make: () => ({ label: '', url: 'https://' }),
        cells: (l) => [
          cellInput('이름', l.label, (v) => { l.label = v; st.changed(); }, { maxlength: LIMITS.linkLabel, placeholder: '유튜브' }),
          cellInput('주소 (https만)', l.url, (v, el) => { l.url = v.trim(); el.setAttribute('aria-invalid', String(!safeHttpsUrl(v))); st.changed(); }, { type: 'url', placeholder: 'https://', 'aria-invalid': String(!safeHttpsUrl(l.url)) })],
      }));
      break;
    default: break;
  }
  void redraw;
  return box;
}
