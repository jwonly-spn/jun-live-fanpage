// Publishes this folder to GitHub (jwonly-spn/jun-live-fanpage) and serves docs/ with GitHub Pages.
// Uses this PC's GitHub login (git credential manager); prints no secrets.
// Usage: node tools/deploy-site.cjs "commit message"
'use strict';
const fs = require('node:fs'), path = require('node:path'), {spawnSync} = require('node:child_process');
const OWNER = 'jwonly-spn', NAME = 'jun-live-fanpage', ROOT = path.join(__dirname, '..');
const SITE = `https://${OWNER}.github.io/${NAME}/`;
const GIT = 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/git';
const env = {...process.env, GIT_EXEC_PATH: GIT + '/mingw64/bin', GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never'};
const git = (...args) => {
  const r = spawnSync(GIT + '/cmd/git.exe', ['-c', 'safe.directory=' + ROOT.replace(/\\/g, '/'), '-C', ROOT, ...args], {encoding: 'utf8', env, windowsHide: true, timeout: 120000});
  if (r.status !== 0) throw Error(`git ${args[0]} 실패: ${(r.stderr || r.stdout).trim().slice(0, 400)}`);
  return r.stdout.trim();
};
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

(async () => {
  for (const f of ['docs/index.html', 'docs/404.html', 'docs/.nojekyll']) if (!fs.existsSync(path.join(ROOT, f))) throw Error(f + ' 이 없어요.');
  if (fs.readFileSync(path.join(ROOT, 'docs/index.html'), 'utf8') !== fs.readFileSync(path.join(ROOT, 'docs/404.html'), 'utf8')) throw Error('404.html 이 index.html 과 달라요.');
  // Never publish secrets that might sit next to the site.
  const risky = spawnSync('cmd', ['/c', 'dir', '/s', '/b', ROOT], {encoding: 'utf8'}).stdout.split(/\r?\n/).filter(p => /(\.pem|\.env|관리자키|secret)/i.test(p));
  if (risky.length) throw Error('비밀 파일로 보이는 파일이 있어요: ' + risky.join(', '));
  if (!fs.existsSync(path.join(ROOT, '.git'))) { git('init', '-b', 'main'); }
  fs.writeFileSync(path.join(ROOT, '.gitignore'), 'node_modules/\n*.log\n.DS_Store\n.claude/\n');
  git('add', '-A');
  const status = git('status', '--porcelain');
  if (status) git('-c', 'user.name=JUN LIVE', '-c', 'user.email=jwonly-spn@users.noreply.github.com', 'commit', '-q', '-m', process.argv[2] || 'Update fan page site');
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
  const pages = await gh(`/repos/${OWNER}/${NAME}/pages`, {allowMissing: true});
  if (!pages) await gh(`/repos/${OWNER}/${NAME}/pages`, {method: 'POST', body: JSON.stringify({source: {branch: 'main', path: '/docs'}})});
  // Wait for the Pages build of this commit.
  for (let i = 0; i < 60; i++) {
    const b = await gh(`/repos/${OWNER}/${NAME}/pages/builds/latest`, {allowMissing: true});
    if (b && b.commit === head && b.status === 'built') break;
    if (b && b.commit === head && b.status === 'errored') throw Error('GitHub Pages 빌드 실패: ' + JSON.stringify(b.error));
    await new Promise(r => setTimeout(r, 5000));
  }
  const check = await fetch(SITE, {cache: 'no-store'});
  const deep = await fetch(SITE + 'p/test-page-check', {cache: 'no-store'});
  console.log('사이트 확인:', check.status, '/ 없는 주소(앱이 처리):', deep.status, (await deep.text()).includes('<script') ? '앱 로드됨' : '앱 없음');
  console.log('주소:', SITE);
})().catch(e => { console.error('실패:', e.message); process.exit(1); });
