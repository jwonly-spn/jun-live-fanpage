// 글자 처리 — 이스케이프, 날짜 표시 등. DOM 없이 동작.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"'`]/g, (c) => ESC[c]);
}

export function charCount(s) {
  return Array.from(String(s ?? '')).length;
}

export function clip(s, n) {
  const a = Array.from(String(s ?? ''));
  return a.length > n ? a.slice(0, n).join('') + '…' : a.join('');
}

export function initial(name) {
  const c = Array.from(String(name ?? '').trim())[0];
  return c ? c.toUpperCase() : '·';
}

const KST = 9 * 3600 * 1000;

export function kstParts(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t + KST);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), hh: d.getUTCHours(), mm: d.getUTCMinutes() };
}

export function formatDate(iso, now = Date.now()) {
  const p = kstParts(iso);
  if (!p) return '';
  const n = kstParts(new Date(now).toISOString());
  return p.y === n.y ? `${p.m}월 ${p.d}일` : `${p.y}년 ${p.m}월 ${p.d}일`;
}

export function relativeTime(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, (now - t) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  const a = kstParts(iso), b = kstParts(new Date(now).toISOString());
  const dayDiff = Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
  if (dayDiff === 0) return `${Math.floor(s / 3600)}시간 전`;
  if (dayDiff === 1) return '어제';
  if (dayDiff < 7) return `${dayDiff}일 전`;
  return formatDate(iso, now);
}

export function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const x = Array.from(b, (v) => v.toString(16).padStart(2, '0')).join('');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

export function percent(votes, total) {
  return total > 0 ? Math.round((votes / total) * 100) : 0;
}
