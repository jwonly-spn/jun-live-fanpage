// 날짜 계산 — 모두 한국 시간(Asia/Seoul, UTC+9, 서머타임 없음). DOM 없이 동작.

const KST = 9 * 3600 * 1000;
const DAY = 86400000;

export function kstDate(now = Date.now()) {
  return new Date(Number(now) + KST).toISOString().slice(0, 10);
}

export function parseYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

const toUtc = (p) => Date.UTC(p.y, p.m - 1, p.d);
const ymd = (y, m, d) => `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// b - a (일)
export function daysBetween(a, b) {
  const A = parseYmd(a), B = parseYmd(b);
  if (!A || !B) return NaN;
  return Math.round((toUtc(B) - toUtc(A)) / DAY);
}

export function addDays(s, n) {
  const p = parseYmd(s);
  if (!p) return null;
  return new Date(toUtc(p) + n * DAY).toISOString().slice(0, 10);
}

const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

// 해마다 돌아오는 날의 y년 날짜(2월 29일은 평년엔 2월 28일)
export function inYear(date, y) {
  const p = parseYmd(date);
  if (!p) return null;
  const d = p.m === 2 && p.d === 29 && !isLeap(y) ? 28 : p.d;
  return ymd(y, p.m, d);
}

// 오늘 이후(오늘 포함) 가장 가까운 날
export function nextOccurrence(date, today) {
  const t = parseYmd(today);
  if (!t || !parseYmd(date)) return null;
  const thisYear = inYear(date, t.y);
  return daysBetween(today, thisYear) >= 0 ? thisYear : inYear(date, t.y + 1);
}

// 화면용 설명 {label, diff, target, upcoming, years}
export function describeDay(day, today) {
  const date = day?.date;
  if (!parseYmd(date) || !parseYmd(today)) return null;
  if (day.yearly) {
    const target = nextOccurrence(date, today);
    const diff = daysBetween(today, target);
    const years = parseYmd(target).y - parseYmd(date).y;
    return { label: diff === 0 ? 'D-DAY' : `D-${diff}`, diff, target, upcoming: true, years };
  }
  const diff = daysBetween(today, date);
  if (diff > 0) return { label: `D-${diff}`, diff, target: date, upcoming: true, years: 0 };
  if (diff === 0) return { label: 'D-DAY', diff, target: date, upcoming: true, years: 0 };
  return { label: `D+${-diff}`, diff, target: date, upcoming: false, years: 0 };
}

// 다가오는 날 먼저(가까운 순), 지난 날은 뒤(최근 순)
export function sortDays(days, today) {
  return days
    .map((d) => ({ day: d, info: describeDay(d, today) }))
    .filter((x) => x.info)
    .sort((a, b) => (a.info.upcoming === b.info.upcoming ? (a.info.upcoming ? a.info.diff - b.info.diff : b.info.diff - a.info.diff) : a.info.upcoming ? -1 : 1));
}

export function formatKoreanDate(s, withYear = true) {
  const p = parseYmd(s);
  if (!p) return '';
  const wd = '일월화수목금토'[new Date(toUtc(p)).getUTCDay()];
  return `${withYear ? p.y + '년 ' : ''}${p.m}월 ${p.d}일 (${wd})`;
}

function icsText(s) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// 75바이트 줄 접기(간단히 글자 수 기준)
function fold(line) {
  const chars = Array.from(line);
  if (chars.length <= 60) return line;
  const out = [];
  for (let i = 0; i < chars.length; i += 60) out.push((i ? ' ' : '') + chars.slice(i, i + 60).join(''));
  return out.join('\r\n');
}

// 캘린더 파일(.ics) 내용
export function buildIcs(day, { now = Date.now(), uid, calName = 'JUN LIVE 팬페이지' } = {}) {
  const p = parseYmd(day?.date);
  if (!p) return '';
  const start = day.date.replace(/-/g, '');
  const end = addDays(day.date, 1).replace(/-/g, '');
  const stamp = new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//JUN LIVE//Fanpage//KO', 'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${icsText(calName)}`,
    'BEGIN:VEVENT',
    `UID:${icsText(uid || `${start}-${day.id || 'day'}@jun-live-fanpage`)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${icsText(day.title)}`,
  ];
  if (day.note) lines.push(`DESCRIPTION:${icsText(day.note)}`);
  if (day.yearly) lines.push(p.m === 2 && p.d === 29 ? 'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1' : 'RRULE:FREQ=YEARLY');
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

// 이번 달 달력 칸(월요일 시작 아님, 일요일 시작) — [{date|null}]
export function monthGrid(today) {
  const t = parseYmd(today);
  if (!t) return [];
  const first = Date.UTC(t.y, t.m - 1, 1);
  const startWd = new Date(first).getUTCDay();
  const daysIn = new Date(Date.UTC(t.y, t.m, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < startWd; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) cells.push(ymd(t.y, t.m, d));
  return cells;
}
