// 글자 처리 — 날짜 표시(한국 시간). DOM 없이 동작.

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
