// JUN LIVE 팬페이지 — Supabase Edge Function "fanpage". 서비스를 마쳤다(2026-10-08).
// 스푼 답변(2026-10-08): Open API 정보는 개발사 서버에 둘 수 없고, 청취자 정보와 이어진 팬 글도 서버에 둘 수 없다 → 팬페이지 서비스를 닫는다.
// 남은 것: GET health(닫힌 것을 확인하는 곳)와 CORS. 그 밖의 모든 길(예전 먼치킨·송출의 app 요청, 사이트 요청, 관리자 요청)은 410.
// JWT 확인을 끄고 올린다(verify_jwt false). 데이터베이스는 쓰지 않는다.
export const CLOSED_MESSAGE = '팬페이지 서비스를 마쳤어요.';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-junlive-admin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Max-Age': '86400' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

export function handle(req: Request): Response {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const route = new URL(req.url).pathname.replace(/^\/(functions\/v1\/)?fanpage\/?/, '').replace(/\/$/, '');
  if (req.method === 'GET' && route === 'health') return json({ service: 'jun-live-fanpage', closed: true });
  return json({ error: CLOSED_MESSAGE }, 410);
}

// Supabase(Deno)에서만 서버를 연다. 노드 시험(tests/fanpage-closed.test.mjs)은 handle 만 불러 쓴다.
const deno = (globalThis as unknown as { Deno?: { serve(h: (req: Request) => Response): unknown } }).Deno;
if (deno) deno.serve(handle);
