import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kstDate, parseYmd, daysBetween, nextOccurrence, describeDay, sortDays, buildIcs, monthGrid, inYear } from '../docs/lib/days.js';

test('한국 날짜: UTC 15:00 = 다음 날 0시', () => {
  assert.equal(kstDate(Date.parse('2026-09-28T14:59:59Z')), '2026-09-28');
  assert.equal(kstDate(Date.parse('2026-09-28T15:00:00Z')), '2026-09-29');
  assert.equal(kstDate(Date.parse('2026-12-31T15:30:00Z')), '2027-01-01');
});

test('날짜 읽기 검사', () => {
  assert.deepEqual(parseYmd('2026-02-28'), { y: 2026, m: 2, d: 28 });
  assert.equal(parseYmd('2026-02-29'), null);
  assert.equal(parseYmd('2026-13-01'), null);
  assert.equal(parseYmd('26-1-1'), null);
});

test('날짜 차이', () => {
  assert.equal(daysBetween('2026-09-29', '2026-10-11'), 12);
  assert.equal(daysBetween('2026-09-29', '2026-09-29'), 0);
  assert.equal(daysBetween('2026-09-29', '2025-09-29'), -365);
});

test('해마다 돌아오는 날: 다음 날짜', () => {
  assert.equal(nextOccurrence('1999-11-02', '2026-09-29'), '2026-11-02');
  assert.equal(nextOccurrence('1999-03-14', '2026-09-29'), '2027-03-14');
  assert.equal(nextOccurrence('1999-09-29', '2026-09-29'), '2026-09-29', '오늘이면 오늘');
  assert.equal(nextOccurrence('2000-02-29', '2026-03-01'), '2027-02-28', '평년엔 2월 28일');
  assert.equal(nextOccurrence('2000-02-29', '2027-03-01'), '2028-02-29');
  assert.equal(inYear('2000-02-29', 2028), '2028-02-29');
});

test('D-day 설명', () => {
  const today = '2026-09-29';
  assert.deepEqual(describeDay({ date: '2026-10-11' }, today), { label: 'D-12', diff: 12, target: '2026-10-11', upcoming: true, years: 0 });
  assert.equal(describeDay({ date: '2026-09-29' }, today).label, 'D-DAY');
  assert.equal(describeDay({ date: '2026-06-21' }, today).label, 'D+100');
  const y = describeDay({ date: '2024-10-01', yearly: true }, today);
  assert.equal(y.label, 'D-2'); assert.equal(y.years, 2); assert.equal(y.target, '2026-10-01');
  assert.equal(describeDay({ date: '2020-09-29', yearly: true }, today).label, 'D-DAY');
  assert.equal(describeDay({ date: 'x' }, today), null);
});

test('정렬: 다가오는 날 가까운 순 → 지난 날 최근 순', () => {
  const today = '2026-09-29';
  const days = [{ id: 'a', date: '2026-01-01' }, { id: 'b', date: '2026-12-01' }, { id: 'c', date: '2026-10-01' }, { id: 'd', date: '2026-09-01' }, { id: 'e', date: '1999-09-30', yearly: true }];
  assert.deepEqual(sortDays(days, today).map((x) => x.day.id), ['e', 'c', 'b', 'd', 'a']);
});

test('캘린더 파일(.ics)', () => {
  const ics = buildIcs({ id: 'd1', title: '생일, 파티; 준비', date: '2026-11-02', yearly: true, note: '케이크\n모여요' }, { now: Date.parse('2026-09-29T00:00:00Z') });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261102\r\n/);
  assert.match(ics, /DTEND;VALUE=DATE:20261103\r\n/);
  assert.match(ics, /RRULE:FREQ=YEARLY\r\n/);
  assert.match(ics, /SUMMARY:생일\\, 파티\\; 준비\r\n/);
  assert.match(ics, /DESCRIPTION:케이크\\n모여요\r\n/);
  assert.match(ics, /DTSTAMP:20260929T000000Z/);
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  const once = buildIcs({ title: 'x', date: '2026-12-31' });
  assert.ok(!once.includes('RRULE'));
  assert.match(once, /DTEND;VALUE=DATE:20270101/);
  assert.match(buildIcs({ title: 'y', date: '2000-02-29', yearly: true }), /BYMONTHDAY=-1/);
});

test('이번 달 달력 칸', () => {
  const cells = monthGrid('2026-09-29'); // 2026-09-01 = 화요일
  assert.equal(cells.filter((c) => c === null).length, 2);
  assert.equal(cells.filter(Boolean).length, 30);
  assert.equal(cells[2], '2026-09-01');
});
