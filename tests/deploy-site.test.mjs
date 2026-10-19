// 올리기 도구(tools/deploy-site.cjs)의 도우미만 — git·GitHub 로그인·인터넷은 쓰지 않는다(파일을 불러오기만 해서는 올리기가 돌지 않는다).
//  · .gitignore 는 없을 때만 만들고, 있으면 빠진 줄만 더한다(2026-10-20 — 예전에는 매번 덮어썼다)
//  · 새로 올라갈 파일 중 docs/ 밖이거나 5MB 넘는 것은 --force 없이는 올리지 않는다(2026-10-09 화면 확인 사진이 공개 저장소에 올라간 사고)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ensureGitignore, newPaths, riskyNew, IGNORE, BIG } = require('../tools/deploy-site.cjs');

test('.gitignore: 없으면 만들고, 있으면 손으로 넣은 줄은 두고 빠진 줄만 끝에 더한다(원래 줄바꿈을 따른다) · 두 번 해도 같다', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kg-deploy-'));
  try {
    const file = join(dir, '.gitignore');
    assert.deepEqual(ensureGitignore(dir), IGNORE);
    assert.equal(await readFile(file, 'utf8'), IGNORE.join('\n') + '\n');
    assert.ok(IGNORE.includes('확인/'), '화면 확인 사진 폴더');
    assert.deepEqual(ensureGitignore(dir), [], '이미 다 있으면 그대로');
    // 손으로 넣은 줄(예: Codex 디자인 사진 폴더)은 지키고 빠진 줄만 — 끝에 줄바꿈이 없던 파일도
    await writeFile(file, '_디자인사진/\nnode_modules/');
    assert.deepEqual(ensureGitignore(dir), IGNORE.filter((x) => x !== 'node_modules/'));
    assert.equal(await readFile(file, 'utf8'), '_디자인사진/\nnode_modules/\n' + IGNORE.filter((x) => x !== 'node_modules/').join('\n') + '\n');
    // CRLF 파일(이 PC 의 git 은 core.autocrlf=true)은 CRLF 로 더한다
    await writeFile(file, 'node_modules/\r\n*.log\r\n');
    ensureGitignore(dir);
    const crlf = await readFile(file, 'utf8');
    assert.equal(crlf, ['node_modules/', '*.log', '.DS_Store', '.claude/', '확인/'].join('\r\n') + '\r\n');
    assert.deepEqual(ensureGitignore(dir), []);
    assert.equal(await readFile(file, 'utf8'), crlf);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('새로 올라갈 파일: git status -z 에서 아직 모르는 파일(??)·새로 담아 둔 파일(A)만 · 이름 바꾸기 줄의 옛 이름은 건너뛴다 · 한글 경로 그대로', () => {
  const z = ['?? docs/kiugi/new.png', ' M tools/stamp.cjs', 'R  docs/b.js', 'docs/a.js', 'A  supabase/x.sql', 'AM docs/c.json', '?? 확인/사진 1.png', ' D old.txt', ''].join('\0');
  assert.deepEqual(newPaths(z), ['docs/kiugi/new.png', 'supabase/x.sql', 'docs/c.json', '확인/사진 1.png']);
  assert.deepEqual(newPaths(''), []);
  assert.deepEqual(newPaths(undefined), []);
});

test('살펴볼 새 파일: docs/ 밖이거나 5MB 넘는 것만(사이트 그림은 그대로 올라간다)', () => {
  const sizes = { 'docs/kiugi/new.png': 300_000, 'docs/kiugi-hd/huge.png': BIG + 1, 'docs/ok-5mb.png': BIG, '확인/사진.png': 10, 'tools/new.cjs': 1200 };
  const out = riskyNew(Object.keys(sizes), (p) => sizes[p]);
  assert.deepEqual(out, [{ path: 'docs/kiugi-hd/huge.png', size: BIG + 1 }, { path: '확인/사진.png', size: 10 }, { path: 'tools/new.cjs', size: 1200 }]);
  assert.equal(BIG, 5 * 1024 * 1024);
});

test('올리기 도구를 불러오기만 해서는 올리지 않는다(require.main 일 때만) · --force 는 멈춘 목록을 보여 준 뒤에만', async () => {
  const src = await readFile(new URL('../tools/deploy-site.cjs', import.meta.url), 'utf8');
  assert.match(src, /if \(require\.main === module\) main\(\)/);
  assert.match(src, /\['credential', 'fill'\]/);
  assert.doesNotMatch(src.slice(0, src.indexOf('async function main(')), /\['credential', 'fill'\]/, '로그인 정보는 main 안에서만 읽는다');
  assert.doesNotMatch(src, /writeFileSync\(path\.join\(ROOT, '\.gitignore'\)/, '.gitignore 를 덮어쓰지 않는다');
  const addAt = src.indexOf("git('add', '-A')");
  assert.ok(addAt > src.indexOf('riskyNew(newPaths(') && addAt > src.indexOf('ensureGitignore()'), '.gitignore 확인 · 새 파일 살피기가 담기(add -A)보다 먼저');
});
