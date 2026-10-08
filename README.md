# 먼치킨 DJ 키우기 사이트

먼치킨(스푼 DJ용 봇 프로그램)의 DJ 키우기 공개 페이지와 스푼 연결 페이지예요. 스푼이 만든 서비스가 아니에요.

- 사이트: https://jwonly-spn.github.io/jun-live-fanpage/ (`docs/`, GitHub Pages, 빌드 없음) — 첫 화면, DJ 키우기 페이지 `k/<주소>`, 스푼 연결 `spoon.html`
- DJ 키우기 서버: Supabase Edge Function `kiugi` (`supabase/functions/kiugi/`), 표 `supabase/kiugi.sql`, 그림 `docs/kiugi/`(먼치킨 저장소 `tools/sync-kiugi-site.mjs`로 복사 — 직접 고치지 않기)
- 팬페이지 서비스는 2026-10-08에 마쳤어요. 함수 `fanpage`는 health 말고 모두 410을 돌려줘요(`supabase/functions/fanpage/`). 예전 표 정의 `supabase/schema.sql`·`storage.sql`은 기록으로 남겨 둠(`fp_hit`·`junlive_secrets`는 `kiugi`가 씀)
- 설계서: `API.md`(맨 위 "바뀐 것", 올리는 순서)
- 검사: `node --test tests/` (서버 SQL 검사 `server-schema.test.mjs`는 `PGLITE_ENTRY` 환경 변수로 PGlite 위치 지정)
- 미리 보기: `node tools/serve.mjs` → http://127.0.0.1:5173/jun-live-fanpage/ (localhost 에서는 체험 모드)

청취자는 DJ 방송에서 `!아이디`로 만든 아이디(예: `밤톨#먼치`)로 자기 캐릭터를 찾아요. 스푼 닉네임은 다루지 않아요.
