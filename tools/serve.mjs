// 확인용 작은 정적 서버: node tools/serve.mjs [포트]
// docs/ 를 '/jun-live-fanpage/' 와 '/' 두 곳에서 모두 보여 준다. 없는 주소는 404.html(SPA)로.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../docs/', import.meta.url));
const PREFIX = '/jun-live-fanpage';
const PORT = Number(process.argv[2]) || 5173;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === PREFIX) path = PREFIX + '/';
  if (path.startsWith(PREFIX + '/')) path = path.slice(PREFIX.length);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT.replace(/[\\/]$/, '') + sep) && file !== ROOT) { res.writeHead(403).end(); return; }
  try {
    const s = await stat(file);
    if (!s.isFile()) throw new Error('dir');
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store' });
    res.end(await readFile(join(ROOT, '404.html')));
  }
}).listen(PORT, '127.0.0.1', () => console.log(`http://127.0.0.1:${PORT}${PREFIX}/`));
