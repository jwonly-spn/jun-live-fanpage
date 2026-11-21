// 영토 지도 그리기(화면 — 캔버스 두 장 + 이름표). 계산은 lib/map-core.js(DOM 없음).
//  · 지도가 바뀌면 경계가 물감 번지듯 움직인다: 빠른 기기는 옛 경계 → 새 경계를 0.9초 동안 섞어 그리고(mixFields),
//    한 장 그리기가 오래 걸리는 기기(휴대폰 등)는 새 지도를 뒤 캔버스에 한 번 그려 1.2초 동안 겹쳐 바꾼다. 움직임 줄이기를 켠 기기는 바로 바꾼다.
//  · 이름표(DJ 이름·%·어제보다)와 식민지 글("○○ 땅 · △△ 지배 중")은 HTML 글자(캔버스 위) — 위치는 지도 비율(%), 크기는 지도 너비(cqi).
//  · 위치·크기는 CSSOM(el.style.left 등)으로만 바꾼다(HTML style 속성 아님 — 보안 규칙 그대로).
//  · 바탕(2026-11-15 Codex 대륙 그림): docs/s2/continent.webp 를 깔고, DJ 땅만 물감 층(renderOverlay — 120×75 격자를 8배로 그린 투명 층)을 늘려 덧칠한다.
//    물감은 docs/s2/land.png(땅 = 불투명)로 잘라 바다·호수·강 위로 넘치지 않는다. 그림을 못 받으면 예전처럼 컴퓨터가 그린 대륙·산·나무(renderMap).
import { h } from './dom.js';
import { terrain, paperTexture, fieldsOf, mixFields, renderMap, renderOverlay, labelsOf, coloniesOf, colonyText, capOf, pctText, cssColor, landFromGrid, setDefaultLand } from './map-core.js';

const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const landKey = (land) => { let s = land.length; for (let i = 0; i < land.length; i++) if (land[i]) s = (Math.imul(s, 31) + i) | 0; return s; };
const loadImage = (src) => new Promise((ok, no) => { const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = () => no(Error('그림을 받지 못했어요: ' + src)); i.src = src; });

// 그림 지도(바탕 그림 · 땅 모양 · 땅 칸) — 하나라도 못 받으면 null(컴퓨터가 그린 대륙으로). 땅 칸은 지도 계산의 기본 땅으로도 쓴다(setDefaultLand).
//  주소에 ?art=0 이면 쓰지 않는다(비교·시험용).
let artJob = null;
export function loadMapArt(base) {
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('art') === '0') return Promise.resolve(null);
  if (!artJob) artJob = (async () => {
    try {
      const [grid, img, mask] = await Promise.all([fetch(`${base}s2/land-grid.json`).then((r) => (r.ok ? r.json() : null)).then(landFromGrid), loadImage(`${base}s2/continent.webp`), loadImage(`${base}s2/land.png`)]);
      if (!grid || Math.abs(img.naturalWidth / img.naturalHeight - grid.w / grid.h) > 0.01) return null;
      setDefaultLand(grid);
      return { grid, img, mask, W: img.naturalWidth, H: img.naturalHeight };
    } catch { return null; }
  })();
  return artJob;
}

export class MapStage {
  constructor(host, { S = 8, art = null } = {}) {
    this.host = host; this.S = S; this.art = art;
    host.classList.toggle('has-art', Boolean(art));
    this.canvases = [0, 1].map((n) => h('canvas', { class: 's2-canvas' + (n === 0 ? ' is-front' : ''), role: n === 0 ? 'img' : null, 'aria-hidden': n === 0 ? null : 'true' }));
    this.front = 0;
    this.labelBox = h('div', { class: 's2-labels', 'aria-hidden': 'true' });
    host.append(...this.canvases, this.labelBox);
    this.geo = null; this.geoKey = null; this.F = null; this.map = null; this.lastMs = 0; this.busy = null;
    this.ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.#declutter()) : null;
    this.ro?.observe(host);
  }
  get canvas() { return this.canvases[this.front]; }
  destroy() { this.ro?.disconnect(); this.busy = null; }

  // 땅 모양이 바뀔 때만 다시(산·나무·물결 자리, 종이 결)
  #ensureGeo(map) {
    const art = this.art && this.art.grid.w === map.w && this.art.grid.h === map.h ? this.art : null;
    const key = `${art ? 'art' : 'proc'}:${map.w}x${map.h}:${landKey(map.land)}`;
    if (this.geoKey === key) return;
    const S = this.S, CW = map.w * S, CH = map.h * S;
    const tex = this.geo && this.geo.CW === CW && this.geo.CH === CH ? this.geo.tex : paperTexture(CW, CH);
    this.geo = art ? { w: map.w, h: map.h, S, CW, CH, tex, art, OW: art.W, OH: art.H } : { ...terrain(map.land, map.w, map.h), S, CW, CH, tex, art: null, OW: CW, OH: CH };
    this.geoKey = key;
    for (const c of this.canvases) { c.width = this.geo.OW; c.height = this.geo.OH; }
    this.img = null; this.layer = null;
  }
  #draw(canvas, F, map) {
    const t0 = performance.now(), g = this.geo, cx = canvas.getContext('2d');
    if (g.art) {
      // 물감 층(작게) → 그림 크기로 늘림 → 땅 모양으로 자름 → 바탕 그림 위에
      if (!this.layer) {
        const small = h('canvas'), big = h('canvas');
        small.width = g.CW; small.height = g.CH; big.width = g.OW; big.height = g.OH;
        this.layer = { small, big, sx: small.getContext('2d'), bx: big.getContext('2d') };
        this.img = this.layer.sx.createImageData(g.CW, g.CH);
      }
      const { small, big, sx, bx } = this.layer;
      renderOverlay(this.img.data, g, F);
      sx.putImageData(this.img, 0, 0);
      bx.globalCompositeOperation = 'copy'; bx.imageSmoothingEnabled = true; bx.imageSmoothingQuality = 'high';
      bx.drawImage(small, 0, 0, g.OW, g.OH);
      bx.globalCompositeOperation = 'destination-in'; bx.drawImage(g.art.mask, 0, 0, g.OW, g.OH);
      bx.globalCompositeOperation = 'source-over';
      cx.drawImage(g.art.img, 0, 0, g.OW, g.OH);
      cx.drawImage(big, 0, 0);
    } else {
      if (!this.img) this.img = cx.createImageData(g.CW, g.CH);
      renderMap(this.img.data, g, F);
      cx.putImageData(this.img, 0, 0);
    }
    this.#decorate(cx, map);
    this.lastMs = performance.now() - t0;
  }
  // 지도 놓기: animate 면 경계가 번지듯
  async setMap(map, { animate = true } = {}) {
    const first = !this.map;
    this.#ensureGeo(map);
    const F = fieldsOf(map), Fo = this.F;
    this.map = map; this.F = F;
    const my = (this.busy = {});
    if (first || !animate || !Fo || reduceMotion()) { this.#draw(this.canvas, F, map); this.#labels(map); return; }
    this.#labels(map);
    if (this.lastMs > 0 && this.lastMs < 70) {
      // 빠른 기기: 옛 경계 → 새 경계로 섞어 그린다(한 장이 90ms 를 넘으면 바로 끝 모습)
      const t0 = performance.now(), dur = 900;
      await new Promise((done) => {
        const frame = () => {
          if (this.busy !== my) return done();
          const e = Math.min(1, (performance.now() - t0) / dur), te = e * e * (3 - 2 * e);
          this.#draw(this.canvas, mixFields(Fo, F, te), map);
          if (e < 1 && this.lastMs < 90) requestAnimationFrame(frame); else { if (e < 1) this.#draw(this.canvas, F, map); done(); }
        };
        requestAnimationFrame(frame);
      });
      return;
    }
    // 느린 기기: 뒤 캔버스에 새 지도를 그려 겹쳐 바꾼다(CSS opacity 1.2초 — styles.css .s2-canvas)
    const back = 1 - this.front;
    this.#draw(this.canvases[back], F, map);
    this.canvases[back].classList.add('is-front'); this.canvases[this.front].classList.remove('is-front');
    this.canvases[back].setAttribute('role', 'img'); this.canvases[back].removeAttribute('aria-hidden');
    this.canvases[this.front].removeAttribute('role'); this.canvases[this.front].setAttribute('aria-hidden', 'true');
    this.front = back;
  }
  setLabel(text) { this.canvases.forEach((c) => (c.getAttribute('role') === 'img' ? c.setAttribute('aria-label', text) : c.removeAttribute('aria-label'))); }

  // 그림 장식: 물결 · 나무(숲이 아니면 흐리게) · 산 · 나침반 · DJ 기지(성 — DJ 색)
  #decorate(cx, map) {
    const g = this.geo, S = g.OW / map.w, k8 = S / 8, CW = g.OW, CH = g.OH;
    cx.save(); cx.lineCap = 'round';
    if (g.art) { this.#compass(cx, CW, CH, k8); cx.restore(); this.#castles(cx, map, S, k8); return; } // 산·나무·물결은 그림에 이미 있다
    const { decor } = g, own = map.owner;
    cx.lineWidth = 1.4 * k8; cx.strokeStyle = 'rgba(48,86,104,.34)';
    for (const [gx, gy] of decor.waves) { const x = gx * S, y = gy * S, a = 9 * k8, b = 4 * k8; cx.beginPath(); cx.moveTo(x - a, y); cx.quadraticCurveTo(x - a / 2, y - b, x, y); cx.quadraticCurveTo(x + a / 2, y + b, x + a, y); cx.stroke(); }
    for (const [gx, gy, i] of decor.trees) {
      const a = own[i] === -1 ? 0.8 : 0.22, x = gx * S, y = gy * S;
      cx.strokeStyle = `rgba(60,72,44,${a})`; cx.lineWidth = 1.1 * k8;
      cx.beginPath(); cx.moveTo(x, y + 4.5 * k8); cx.lineTo(x, y + 1 * k8); cx.stroke();
      cx.beginPath(); cx.arc(x, y - 1.6 * k8, 3.4 * k8, 0, Math.PI * 2); cx.fillStyle = `rgba(104,128,78,${a * 0.75})`; cx.fill(); cx.stroke();
    }
    for (const [gx, gy, , size] of decor.mts) {
      const x = gx * S, y = gy * S, s = size * k8;
      const ridge = () => { cx.moveTo(x - s, y + s * 0.45); cx.lineTo(x - s * 0.15, y - s * 0.8); cx.lineTo(x + s * 0.3, y - s * 0.1); cx.lineTo(x + s * 0.55, y - s * 0.45); cx.lineTo(x + s, y + s * 0.45); };
      cx.beginPath(); ridge(); cx.closePath(); cx.fillStyle = 'rgba(240,230,205,.88)'; cx.fill();
      cx.beginPath(); cx.moveTo(x - s * 0.15, y - s * 0.8); cx.lineTo(x + s * 0.05, y + s * 0.45); cx.lineTo(x + s, y + s * 0.45); cx.lineTo(x + s * 0.55, y - s * 0.45); cx.lineTo(x + s * 0.3, y - s * 0.1); cx.closePath(); cx.fillStyle = 'rgba(96,78,54,.2)'; cx.fill();
      cx.beginPath(); ridge(); cx.strokeStyle = 'rgba(84,66,46,.8)'; cx.lineWidth = 1.3 * k8; cx.stroke();
    }
    this.#compass(cx, CW, CH, k8);
    cx.restore();
    this.#castles(cx, map, S, k8);
  }
  // 나침반(오른쪽 아래 바다)
  #compass(cx, CW, CH, k8) {
    cx.save();
    cx.translate(CW - 58 * k8, CH - 58 * k8); cx.strokeStyle = 'rgba(48,62,70,.7)'; cx.fillStyle = 'rgba(247,240,222,.75)'; cx.lineWidth = 1.2 * k8;
    cx.beginPath(); cx.arc(0, 0, 22 * k8, 0, Math.PI * 2); cx.fill(); cx.stroke();
    for (let k = 0; k < 4; k++) { cx.rotate(Math.PI / 2); cx.beginPath(); cx.moveTo(0, -30 * k8); cx.lineTo(5 * k8, 0); cx.lineTo(-5 * k8, 0); cx.closePath(); cx.fillStyle = k === 3 ? 'rgba(170,60,50,.85)' : 'rgba(48,62,70,.75)'; cx.fill(); }
    cx.restore();
  }
  // DJ 기지(성 — DJ 색)
  #castles(cx, map, S, k8) {
    map.djs.forEach((d, k) => { const c = capOf(map, k); if (c !== null) this.#castle(cx, ((c % map.w) + 0.5) * S, (Math.floor(c / map.w) + 0.5) * S, d.rgb, k8); });
  }
  #castle(cx, x, y, rgb, k8) {
    const w = 16 * k8, hgt = 12 * k8, t = y - hgt / 2, n = 3 * k8, m = 4 * k8, q = 2 * k8;
    cx.save(); cx.beginPath();
    cx.moveTo(x - w / 2, y + hgt / 2); cx.lineTo(x - w / 2, t - n); cx.lineTo(x - w / 2 + m, t - n); cx.lineTo(x - w / 2 + m, t); cx.lineTo(x - q, t); cx.lineTo(x - q, t - n); cx.lineTo(x + q, t - n); cx.lineTo(x + q, t);
    cx.lineTo(x + w / 2 - m, t); cx.lineTo(x + w / 2 - m, t - n); cx.lineTo(x + w / 2, t - n); cx.lineTo(x + w / 2, y + hgt / 2); cx.closePath();
    cx.fillStyle = cssColor(rgb); cx.fill(); cx.lineWidth = 1.6 * k8; cx.strokeStyle = 'rgba(52,40,28,.9)'; cx.stroke();
    cx.beginPath(); cx.moveTo(x, t - n); cx.lineTo(x, t - 13 * k8); cx.stroke();
    cx.beginPath(); cx.moveTo(x, t - 13 * k8); cx.lineTo(x + 8 * k8, t - 10 * k8); cx.lineTo(x, t - 7 * k8); cx.closePath(); cx.fillStyle = cssColor(rgb); cx.fill(); cx.stroke();
    cx.fillStyle = 'rgba(52,40,28,.85)'; cx.fillRect(x - q, y + hgt / 2 - 6 * k8, 2 * q, 6 * k8); cx.restore();
  }

  // 이름표: DJ(땅 넓을수록 큰 글씨) + 식민지 글
  #labels(map) {
    const L = labelsOf(map), C = coloniesOf(map), box = this.labelBox, old = new Map([...box.querySelectorAll('.s2-label')].map((e) => [e.dataset.key, e]));
    const keep = new Set();
    for (const l of L) {
      let el = old.get(l.key);
      if (!el) { el = h('div', { class: 's2-label', dataset: { key: l.key } }, h('b'), h('small')); box.append(el); }
      keep.add(l.key);
      el.querySelector('b').textContent = l.name;
      const delta = Number.isFinite(l.dayDelta) && Math.abs(l.dayDelta) >= 0.05 ? ` ${l.dayDelta > 0 ? '▲' : '▼'}${Math.abs(Math.round(l.dayDelta * 10) / 10).toFixed(1)}` : '';
      el.querySelector('small').textContent = pctText(l.pct) + delta;
      el.classList.toggle('up', l.dayDelta > 0.05); el.classList.toggle('down', l.dayDelta < -0.05);
      el.style.left = `${(l.x * 100).toFixed(2)}%`; el.style.top = `${(l.y * 100).toFixed(2)}%`;
      el.style.fontSize = `max(12px, ${Math.min(3.1, 1.6 + Math.sqrt(l.cells) * 0.045).toFixed(2)}cqi)`;
      el.dataset.cells = String(l.cells);
    }
    for (const [k, el] of old) if (!keep.has(k)) el.remove();
    box.querySelectorAll('.s2-col').forEach((e) => e.remove());
    for (const c of C) {
      const el = h('div', { class: 's2-col' }, colonyText(c));
      el.style.left = `${(c.x * 100).toFixed(2)}%`; el.style.top = `${(c.y * 100).toFixed(2)}%`;
      box.append(el);
    }
    requestAnimationFrame(() => this.#declutter());
    // 이름표가 새 자리로 옮겨 가는 동안(0.6초 — styles.css)엔 자리가 덜 정해져 있어 끝난 뒤 한 번 더
    clearTimeout(this.again); this.again = setTimeout(() => this.#declutter(), 700);
  }
  // 이름표가 겹치면 비킨다: DJ 이름(넓은 땅 먼저)을 위·아래로 조금 옮기고, 그래도 겹치면 % 줄을 숨긴다.
  //  식민지 글은 DJ 이름 다음 — 위·아래·옆으로 옮겨 보고 자리가 없으면 숨긴다(줄무늬와 땅 순위에는 그대로 보인다).
  #declutter() {
    const box = this.labelBox, W = box.clientWidth, H = box.clientHeight;
    if (!W || !H) return;
    const hostR = box.getBoundingClientRect(), placed = [];
    const hit = (r) => placed.some((p) => r.l < p.r && r.r > p.l && r.t < p.b && r.b > p.t);
    const place = (el, moves) => {
      el.style.translate = '';
      const base = el.getBoundingClientRect();
      const rect = ([dx, dy]) => ({ l: base.left - hostR.left + dx, r: base.right - hostR.left + dx, t: base.top - hostR.top + dy, b: base.bottom - hostR.top + dy });
      for (const m of moves(base)) { const r = rect(m); if (!hit(r) && r.t >= 0 && r.b <= H && r.l >= 0 && r.r <= W) { if (m[0] || m[1]) el.style.translate = `${Math.round(m[0])}px ${Math.round(m[1])}px`; placed.push(r); return true; } }
      return false;
    };
    const djs = [...box.querySelectorAll('.s2-label')].sort((a, b) => Number(b.dataset.cells) - Number(a.dataset.cells));
    for (const el of djs) {
      el.classList.remove('is-tight');
      const moves = (b) => [[0, 0], [0, b.height * 0.8], [0, -b.height * 0.8], [0, b.height * 1.5], [0, -b.height * 1.5]];
      if (place(el, moves)) continue;
      el.classList.add('is-tight');
      if (!place(el, moves)) { el.style.translate = ''; const b = el.getBoundingClientRect(); placed.push({ l: b.left - hostR.left, r: b.right - hostR.left, t: b.top - hostR.top, b: b.bottom - hostR.top }); }
    }
    for (const el of box.querySelectorAll('.s2-col')) {
      el.classList.remove('is-hidden');
      const ok = place(el, (b) => [[0, 0], [0, b.height * 1.2], [0, -b.height * 1.2], [b.width * 0.35, 0], [-b.width * 0.35, 0], [0, b.height * 2.4], [0, -b.height * 2.4]]);
      if (!ok) el.classList.add('is-hidden');
    }
  }
  // 그 DJ 이름표로(휴대폰에서 옆으로 밀어 보는 지도 — 가운데로) + 잠깐 반짝
  focus(key) {
    const el = [...this.labelBox.querySelectorAll('.s2-label')].find((e) => e.dataset.key === key);
    if (!el) return false;
    const scroller = this.host.closest('.s2-map-scroll');
    if (scroller && scroller.scrollWidth > scroller.clientWidth) {
      const x = el.offsetLeft - scroller.clientWidth / 2;
      scroller.scrollTo({ left: Math.max(0, x), behavior: reduceMotion() ? 'auto' : 'smooth' });
    }
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    return true;
  }
}
