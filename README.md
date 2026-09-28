# JUN LIVE 팬페이지

스푼 DJ가 JUN LIVE 프로그램에서 만드는 팬페이지 서비스예요.

- 사이트: https://jwonly-spn.github.io/jun-live-fanpage/ (`docs/`, GitHub Pages, 빌드 없음)
- 서버: Supabase Edge Function `fanpage` (`supabase/functions/fanpage/`), 데이터 `supabase/schema.sql`, 사진 버킷 `supabase/storage.sql`
- 설계서: `API.md`
- 검사: `node --test tests/` (서버 SQL 검사는 `PGLITE_ENTRY` 환경 변수로 PGlite 위치 지정)

DJ는 JUN LIVE의 "팬페이지 꾸미기"로 로그인 없이 편집하고, 팬은 로그인 없이 닉네임으로 참여해요.
