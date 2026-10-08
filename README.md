# 먼치킨 키우기 사이트

먼치킨(스푼 DJ용 봇 프로그램)의 DJ 키우기 공개 사이트와 스푼 연결 페이지예요. 스푼이 만든 서비스가 아니에요.

- 사이트: https://키우기.com/ (영문 표기 xn--ok0bp87bn6g.com, 2026-10-08부터. 예전 https://jwonly-spn.github.io/jun-live-fanpage/ 는 자동으로 넘어감. `docs/`, GitHub Pages, 빌드 없음, `docs/CNAME`)
  - 메인 `/`(시즌·아이디로 찾기·인기 캐릭터·새로 꾸민 캐릭터·많이 입은 옷·키우기 중인 DJ), 옷 도감 `items`, DJ 키우기 페이지 `k/<주소>`, 캐릭터 페이지 `k/<주소>/<아이디 앞 부분>`(하트·링크 복사), 스푼 연결 `spoon.html`
- DJ 키우기 서버: Supabase Edge Function `kiugi` (`supabase/functions/kiugi/`), 표 `supabase/kiugi.sql` + `supabase/kiugi-stage2.sql`(하트·이름 하나만·메인 노출), 그림·시즌 목록 `docs/kiugi/`(먼치킨 저장소 `tools/sync-kiugi-site.mjs`로 복사 — 직접 고치지 않기)
- 애정도 숫자는 스푼 답을 기다리는 동안 숨김(`supabase/functions/kiugi/lib.ts`의 `SHOW_LOVE`)
- 팬페이지 서비스는 2026-10-08에 마쳤어요. 함수 `fanpage`는 health 말고 모두 410을 돌려줘요(`supabase/functions/fanpage/`). 예전 표 정의 `supabase/schema.sql`·`storage.sql`은 기록으로 남겨 둠(`fp_hit`·`junlive_secrets`는 `kiugi`가 씀)
- 설계서: `API.md`(맨 위 "바뀐 것", 올리는 순서)
- 검사: `node --test tests/*.test.mjs` (서버 SQL 검사 `server-schema.test.mjs`는 `PGLITE_ENTRY` 환경 변수로 PGlite 위치 지정). 서버 시험 도우미는 `tests/kiugi-world.mjs`
- 미리 보기: `node tools/serve.mjs` → http://127.0.0.1:5173/jun-live-fanpage/ (localhost 에서는 체험 모드 — 지어낸 DJ 먼치·쿠키·젤리)

청취자는 DJ 방송에서 `!아이디`로 만든 아이디(예: `밤톨#먼치`)로 자기 캐릭터를 찾고, 마음에 드는 캐릭터에 하루 한 번 하트를 보내요. 스푼 닉네임은 다루지 않아요.
