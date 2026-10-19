// Publishes this folder to GitHub (jwonly-spn/jun-live-fanpage) and serves docs/ with GitHub Pages.
// Uses this PC's GitHub login (git credential manager); prints no secrets.
// Usage: node tools/deploy-site.cjs "commit message" [--force]
//  --force: 새로 올라갈 파일 중 docs/ 밖이거나 5MB 넘는 것이 있어도 그대로 올린다(2026-10-20 — 없으면 그 목록을 보여 주고 멈춘다).
// 시험(tests/deploy-site.test.mjs)은 아래 도우미만 불러 쓴다 — 이 파일을 불러오기만 해서는 git·GitHub 로그인을 건드리지 않는다.
'use strict';
const fs = require('node:fs'), path = require('node:path'), {spawnSync} = require('node:child_process');
const OWNER = 'jwonly-spn', NAME = 'jun-live-fanpage', ROOT = path.join(__dirname, '..');
// 2026-10-08부터 키우기.com(영문 표기 xn--ok0bp87bn6g.com). docs/CNAME 과 GitHub Pages 의 사용자 도메인을 같게 둔다.
const DOMAIN = 'xn--ok0bp87bn6g.com';
const SITE = `https://${DOMAIN}/`;
// 인증서가 아직 없을 때(2026-10-08~ GitHub Pages 인증서 "new") 마지막 확인은 http 로 한다
const SITE_HTTP = `http://${DOMAIN}/`;
const GIT = 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/git';
const env = {...process.env, GIT_EXEC_PATH: GIT + '/mingw64/bin', GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never'};
const gitRun = (args, timeout = 120000) => {
  const r = spawnSync(GIT + '/cmd/git.exe', ['-c', 'safe.directory=' + ROOT.replace(/\\/g, '/'), '-C', ROOT, ...args], {encoding: 'utf8', env, windowsHide: true, timeout});
  if (r.status !== 0) throw Error(`git ${args[0]} 실패: ${(r.stderr || r.stdout || '').trim().slice(0, 400)}`);
  return r.stdout;
};
const git = (...args) => gitRun(args).trim();

// 저장소에 꼭 빼 둘 것(.gitignore). 확인/ = 화면 확인 사진(수십 MB) — 저장소에 올리지 않는다(2026-10-09).
const IGNORE = ['node_modules/', '*.log', '.DS_Store', '.claude/', '확인/'];
// .gitignore 는 없을 때만 만들고, 있으면 빠진 줄만 끝에 더한다(2026-10-20 — 예전에는 매번 위 내용으로 덮어써서 손으로 넣은 줄이 사라졌다).
//  원래 줄바꿈(CRLF/LF)을 따른다. 돌려주는 것 = 새로 넣은 줄.
function ensureGitignore(root = ROOT, need = IGNORE) {
  const file = path.join(root, '.gitignore');
  if (!fs.existsSync(file)) { fs.writeFileSync(file, need.join('\n') + '\n'); return need.slice(); }
  const have = fs.readFileSync(file, 'utf8');
  const lines = new Set(have.split(/\r?\n/).map((l) => l.trim()));
  const add = need.filter((x) => !lines.has(x));
  if (add.length) {
    const eol = have.includes('\r\n') ? '\r\n' : '\n';
    fs.writeFileSync(file, (have === '' || /\n$/.test(have) ? have : have + eol) + add.join(eol) + eol);
  }
  return add;
}
// `git status --porcelain=v1 -z --untracked-files=all` 글 → 이번에 새로 올라갈 파일(아직 git 이 모름 '??' · 새로 담아 둠 'A')
function newPaths(z) {
  const parts = String(z || '').split('\0'), out = [];
  for (let i = 0; i < parts.length; i++) {
    const e = parts[i];
    if (e.length < 4) continue;
    const xy = e.slice(0, 2);
    if (xy === '??' || xy[0] === 'A') out.push(e.slice(3));
    if (xy[0] === 'R' || xy[0] === 'C') i++; // 다음 칸은 옛 이름
  }
  return out;
}
// 새로 올라갈 파일 중 살펴볼 것: docs/ 밖(사이트가 아닌 것 — 사진 폴더·작업 파일) 또는 5MB 넘는 것. sizeOf(path) → 바이트
const BIG = 5 * 1024 * 1024;
const riskyNew = (paths, sizeOf) => paths.map((p) => ({path: p, size: sizeOf(p)})).filter((f) => !f.path.startsWith('docs/') || f.size > BIG);
const mb = (n) => (n / 1048576).toFixed(1) + 'MB';

async function main(argv = process.argv.slice(2)) {
  const force = argv.includes('--force');
  const message = argv.find((a) => !a.startsWith('--')) || 'Update fan page site';
  const auth = spawnSync(GIT + '/cmd/git.exe', ['credential', 'fill'], {input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', env, windowsHide: true, timeout: 15000});
  const cred = Object.fromEntries((auth.stdout || '').trim().split('\n').map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
  if (!cred.password) throw Error('GitHub 로그인 정보를 찾을 수 없어요.');
  const headers = {Authorization: 'Bearer ' + cred.password, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json'};
  async function gh(route, init = {}) {
    const r = await fetch('https://api.github.com' + route, {...init, headers: {...headers, ...init.headers}});
    if (r.status === 404 && init.allowMissing) return null;
    const text = await r.text();
    if (!r.ok && !(init.allow || []).includes(r.status)) throw Error(`GitHub ${r.status} ${route}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : {};
  }

  for (const f of ['docs/index.html', 'docs/404.html', 'docs/.nojekyll']) if (!fs.existsSync(path.join(ROOT, f))) throw Error(f + ' 이 없어요.');
  // 올린 파일이 방문자에게 바로 보이게(2026-10-18): index.html·404.html 에 파일 내용 해시를 붙인 주소·import map 을 다시 찍는다(tools/stamp.cjs)
  require('./stamp.cjs').stamp();
  if (fs.readFileSync(path.join(ROOT, 'docs/index.html'), 'utf8') !== fs.readFileSync(path.join(ROOT, 'docs/404.html'), 'utf8')) throw Error('404.html 이 index.html 과 달라요.');
  // Never publish secrets that might sit next to the site.
  const risky = spawnSync('cmd', ['/c', 'dir', '/s', '/b', ROOT], {encoding: 'utf8'}).stdout.split(/\r?\n/).filter(p => /(\.pem|\.env|관리자키|secret)/i.test(p));
  if (risky.length) throw Error('비밀 파일로 보이는 파일이 있어요: ' + risky.join(', '));
  if (!fs.existsSync(path.join(ROOT, '.git'))) { git('init', '-b', 'main'); }
  const added = ensureGitignore();
  if (added.length) console.log('.gitignore 에 더했어요:', added.join(' '));
  // 담기(add -A) 전에: 새로 올라갈 파일 중 docs/ 밖이거나 5MB 넘는 것이 있으면 멈춘다(2026-10-09 화면 확인 사진이 공개 저장소에 올라간 사고 — 2026-10-20)
  const fresh = riskyNew(newPaths(gitRun(['status', '--porcelain=v1', '-z', '--untracked-files=all'])), (p) => { try { return fs.statSync(path.join(ROOT, p)).size; } catch { return 0; } });
  if (fresh.length) {
    const list = fresh.map((f) => `  ${f.path} (${mb(f.size)})`).join('\n');
    if (!force) throw Error(`새로 올라갈 파일 중 docs/ 밖이거나 5MB 넘는 것이 있어요(공개 저장소에 그대로 올라가요):\n${list}\n올려도 되면 --force 를 붙여 다시 실행하세요. 올리면 안 되는 것이면 지우거나 .gitignore 에 넣으세요.`);
    console.log('--force: 그대로 올려요 —\n' + list);
  }
  git('add', '-A');
  const status = git('status', '--porcelain');
  if (status) git('-c', 'user.name=JUN LIVE', '-c', 'user.email=jwonly-spn@users.noreply.github.com', 'commit', '-q', '-m', message);
  let repo = await gh(`/repos/${OWNER}/${NAME}`, {allowMissing: true});
  if (!repo) {
    repo = await gh('/user/repos', {method: 'POST', body: JSON.stringify({name: NAME, description: 'JUN LIVE 팬페이지 — Spoon DJ fan pages', homepage: SITE, private: false, has_issues: false, has_wiki: false, has_projects: false, auto_init: false})});
    console.log('저장소를 만들었어요:', repo.html_url);
  }
  const remotes = git('remote');
  if (!remotes.split('\n').includes('origin')) git('remote', 'add', 'origin', `https://github.com/${OWNER}/${NAME}.git`);
  git('push', '-u', 'origin', 'main');
  const head = git('rev-parse', 'HEAD');
  console.log('올린 커밋:', head.slice(0, 7));
  let pages = await gh(`/repos/${OWNER}/${NAME}/pages`, {allowMissing: true});
  if (!pages) pages = await gh(`/repos/${OWNER}/${NAME}/pages`, {method: 'POST', body: JSON.stringify({source: {branch: 'main', path: '/docs'}})});
  if (fs.readFileSync(path.join(ROOT, 'docs/CNAME'), 'utf8').trim() !== DOMAIN) throw Error('docs/CNAME 이 ' + DOMAIN + ' 이 아니에요.');
  if (pages.cname !== DOMAIN) await gh(`/repos/${OWNER}/${NAME}/pages`, {method: 'PUT', body: JSON.stringify({cname: DOMAIN, source: {branch: 'main', path: '/docs'}})});
  // Wait for the Pages build of this commit.
  for (let i = 0; i < 60; i++) {
    const b = await gh(`/repos/${OWNER}/${NAME}/pages/builds/latest`, {allowMissing: true});
    if (b && b.commit === head && b.status === 'built') break;
    if (b && b.commit === head && b.status === 'errored') throw Error('GitHub Pages 빌드 실패: ' + JSON.stringify(b.error));
    await new Promise(r => setTimeout(r, 5000));
  }
  pages = await gh(`/repos/${OWNER}/${NAME}/pages`);
  if (!pages.https_enforced) {
    const r = await gh(`/repos/${OWNER}/${NAME}/pages`, {method: 'PUT', allow: [400, 404, 422], body: JSON.stringify({cname: DOMAIN, https_enforced: true, source: {branch: 'main', path: '/docs'}})});
    console.log('https 강제:', r && r.message ? '아직(인증서 준비 중) — ' + r.message : '켬');
  }
  // 마지막 확인: https 가 인증서 문제로 안 되면 http 로(예전에는 여기서 "fetch failed" 로 끝나 올리기가 실패한 것처럼 보였다 — 올리기 자체는 위에서 끝난 것)
  let base = SITE, check;
  try { check = await fetch(SITE, {cache: 'no-store'}); }
  catch (e) {
    console.log('https 로 열지 못했어요(인증서 준비 중일 수 있음):', e.cause?.code || e.message, '→ http 로 확인해요');
    base = SITE_HTTP; check = await fetch(SITE_HTTP, {cache: 'no-store'});
  }
  const deep = await fetch(base + 'p/test-page-check', {cache: 'no-store'});
  console.log('사이트 확인:', check.status, '/ 없는 주소(앱이 처리):', deep.status, (await deep.text()).includes('<script') ? '앱 로드됨' : '앱 없음');
  console.log('주소:', base);
}

module.exports = {ensureGitignore, newPaths, riskyNew, IGNORE, BIG};

if (require.main === module) main().catch(e => { console.error('실패:', e.message); process.exit(1); });
