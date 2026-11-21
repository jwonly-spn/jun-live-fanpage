// 예고 화면 색이 어두운 모드 기기에서도 지금 공개본(main 8e3e240)과 같은지 — 진짜 브라우저(Electron)로 계산값을 읽는다(2026-11-21 고침 1회차 I1·M1).
//  KIUGI_ELECTRON = electron.exe 위치가 있을 때만 돈다(없으면 건너뜀 — PGLITE_ENTRY 와 같은 방식).
//  가짜 시각: tools/shots-launch.cjs --set 색 이 작은 서버의 Date 머리글과 화면 시계를 지어낸다(예고 11/25 12:00 · 시즌 2 12/15) — 진짜 오늘 날짜에 안 기댐.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const exe = process.env.KIUGI_ELECTRON;
const skip = exe ? false : 'KIUGI_ELECTRON 이 없어 건너뜀(electron.exe 위치를 주면 돈다)';
const tool = fileURLToPath(new URL('../tools/shots-launch.cjs', import.meta.url));
const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));
const readLog = (dir) => { const f = path.join(dir, '기록.log'); return existsSync(f) ? readFileSync(f, 'utf8') : ''; };

// 지금 공개본(main 8e3e240) 예고에서 잰 값 — 밝은·어두운 모드 모두 같다(main 에는 어두운 모드 규칙이 없다)
const MAIN = { colorScheme: 'dark', htmlBg: 'rgb(7, 8, 15)', bodyBg: 'rgb(7, 8, 15)', bodyColor: 'rgb(236, 230, 214)', vars: { '--bg': '#07080f', '--text': '#ece6d6', '--text-2': '#a49e8f', '--ink': '#ece6d6', '--on-ink': '#07080f' } };
const INK = 'solid 2px rgb(236, 230, 214) 3px', GOLD = 'solid 2px rgb(255, 226, 163) 3px';
const MAIN_FOCUS = [['a.skip', INK], ['a.tz-brand', GOLD], ['a.tz-btn.tz-btn-gold', GOLD], ['a.tz-btn.tz-btn-ghost', GOLD], ['button.tz-war-toggle', GOLD], ['a.tz-scroll', INK], ['button.tz-war-toggle.tz-bv-toggle', GOLD]];
// 시즌 2 화면(12/1 뒤) — 고치기 전(49fda6d)에 잰 값 그대로: [바탕, 글색, 초점 테두리(강조색)]
const S2 = { light: ['rgb(241, 235, 223)', 'rgb(42, 34, 25)', 'rgb(168, 64, 44)'], dark: ['rgb(21, 18, 14)', 'rgb(239, 230, 214)', 'rgb(224, 128, 95)'] };

test('예고 화면 색은 어두운 모드에서도 지금 공개본과 같다(바탕·글색·색 변수·키보드 초점 테두리) · 시즌 2 화면(12/1 뒤)의 밝은·어두운 색은 그대로', { skip, timeout: 240e3 }, () => {
  const out = mkdtempSync(path.join(tmpdir(), 'kiugi-colors-'));
  try {
    const run = spawnSync(exe, [tool, out, '--set', '색'], { encoding: 'utf8', timeout: 230e3 });
    assert.equal(run.status, 0, `도구가 멈춤 ${run.error?.message || ''}\n${readLog(out)}`);
    const recs = JSON.parse(readFileSync(path.join(out, '기록-색.json'), 'utf8'));
    const get = (name) => { const r = recs.find((x) => x.name === name); assert.ok(r?.colors, name); return r.colors; };
    for (const scheme of ['light', 'dark']) {
      const c = get(`색-예고-${scheme}`);
      assert.equal(c.teaser, true, '11/25 = 예고 화면');
      assert.equal(c.dark, scheme === 'dark', '어두운 모드 흉내가 걸렸다');
      assert.deepEqual({ ...pick(c, ['colorScheme', 'htmlBg', 'bodyBg', 'bodyColor']), vars: pick(c.vars, Object.keys(MAIN.vars)) }, MAIN, `예고 ${scheme} 바탕·글색`);
      assert.deepEqual(c.focus.map((f) => [f.who.replace(/\[.*$/, ''), f.outline]), MAIN_FOCUS, `예고 ${scheme} 키보드 초점 테두리`);
      assert.ok(c.focus.every((f) => f.visible), ':focus-visible 이 걸린 채로 쟀다');
      assert.equal(c.focus.length, c.focusable.length, 'Tab 이 닿는 것을 모두 봤다');
    }
    for (const [scheme, [bg, color, accent]] of Object.entries(S2)) {
      const c = get(`색-시즌2-${scheme}`);
      assert.equal(c.teaser, false, '12/15 = 시즌 2 화면');
      assert.equal(c.dark, scheme === 'dark');
      assert.deepEqual([c.htmlBg, c.bodyColor], [bg, color], `시즌 2 ${scheme} 바탕·글색`);
      assert.ok(c.focus.length > 10, '시즌 2 첫 화면의 Tab 자리');
      const solid = c.focus.filter((f) => f.outline.startsWith('solid'));
      assert.deepEqual([...new Set(solid.map((f) => f.outline))], [`solid 2px ${accent} 3px`], `시즌 2 ${scheme} 초점 테두리 = 강조색`);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
