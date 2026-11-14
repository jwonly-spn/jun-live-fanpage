export const LAUNCH_AT = Date.parse('2026-12-01T00:00:00+09:00');

export function countdown(now = Date.now()) {
  const total = Math.max(0, Math.ceil((LAUNCH_AT - now) / 1000));
  return {
    started: total === 0,
    parts: [Math.floor(total / 86400), Math.floor(total / 3600) % 24, Math.floor(total / 60) % 60, total % 60],
  };
}

export function readStats(data) {
  if (!Array.isArray(data?.stats) || data.stats.length !== 7) throw new Error('기록을 확인해 주세요.');
  return data.stats.map(({ label, value, unit = '', prefix = '' }) => {
    if (typeof label !== 'string' || !Number.isSafeInteger(value) || value < 0 || typeof unit !== 'string' || typeof prefix !== 'string') throw new Error('기록을 확인해 주세요.');
    return { label, value, unit, prefix };
  });
}
