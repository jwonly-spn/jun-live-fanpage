# 먼치킨 키우기 사이트

먼치킨(스푼 DJ용 봇 프로그램)의 DJ 키우기 공개 사이트와 스푼 연결 페이지예요. 스푼이 만든 서비스가 아니에요.

- 사이트: https://키우기.com/ (영문 표기 xn--ok0bp87bn6g.com, 2026-10-08부터 · 2026-11-08 Cloudflare 로 https. 예전 https://jwonly-spn.github.io/jun-live-fanpage/ 는 자동으로 넘어감. `docs/`, GitHub Pages, 빌드 없음, `docs/CNAME`)
  - **시즌 2 "몬스터 영토전"(2026-12-01~12-31)**: 첫 화면 `/` = 영토 지도(화면 가득 — Codex 대륙 그림 위에 DJ 땅을 물감으로, 식민지 줄무늬, DJ 이름·%·어제보다, 남은 날, 1등 상) → 아이디로 몬스터 찾기(`/?id=밤톨`) → 땅 순위·지도 소식 → 땅을 넓히는 법 · 몬스터 도감 `/dex`(`?id=` 면 데려간 몬스터는 색, 못 만난 것은 그림자) · 스푼 연결 `spoon.html`
  - 시즌 1 화면(캐릭터 페이지·DJ 페이지·옷 도감·입혀 보기·저장하기)과 그림은 2026-11-15 걷어냈다. 예전 주소는 첫 화면으로(캐릭터 주소면 그 아이디로 찾기).
- 지도 = 영토 서버(먼치킨 저장소 `server/territory-supabase`)가 올리는 공개 파일 `tr-snap/map.json`(모양은 `API.md` "시즌 2"). 그리기 `docs/lib/map-core.js`(계산 — DOM 없음) · `docs/lib/map-draw.js`(캔버스·이름표·번지듯 바뀌기)
- 그림 지도: `docs/s2/continent.webp`·`land.png`·`land-grid.json` = `<electron.exe> tools/make-map-art.cjs [continent_s2.png] [land_mask.png]`(Codex 대륙 그림이 바뀌면 다시)
- 몬스터 그림·시즌 2 목록: `docs/kiugi/`(먼치킨 저장소 `tools/sync-kiugi-site.mjs`로 복사 — 직접 고치지 않기). 없으면 속성 색 동그라미·자리 이름(`docs/lib/monsters.js`)
- DJ 키우기 서버: Supabase Edge Function `kiugi` (`supabase/functions/kiugi/`) — 올리기 v3(시즌 2 몬스터), 시즌 1 v2 는 2026-12-01 0시(한국)까지만. 표 `supabase/kiugi.sql` + `supabase/kiugi-stage2.sql`(이름 하나만·메인 노출·하트)
- 팬페이지 서비스는 2026-10-08에 마쳤어요. 함수 `fanpage`는 health 말고 모두 410을 돌려줘요(`supabase/functions/fanpage/`). 예전 표 정의 `supabase/schema.sql`·`storage.sql`은 기록으로 남겨 둠(`fp_hit`·`junlive_secrets`는 `kiugi`가 씀)
- 설계서: `API.md`(맨 위 "바뀐 것", 올리는 순서)
- 검사: `node --test tests/*.test.mjs` (서버 SQL 검사 `server-schema.test.mjs`는 `PGLITE_ENTRY` 환경 변수로 PGlite 위치 지정). 서버 시험 도우미는 `tests/kiugi-world.mjs`
- 미리 보기: `node tools/serve.mjs [포트]` → http://127.0.0.1:5173/ (localhost 에서는 체험 모드 — 지어낸 DJ 별사탕·구름빵 등이 한 달을 흉내 낸 지도, 지어낸 아이디 밤톨#먼치 등. 주소 `?day=1~31`·`?djs=3~40`·`?still=1`(다시 읽어도 날이 안 넘어감)·`?empty=1`(지도 파일 없음)·`?art=0`(그림 지도 없이) · `?demo=0` 은 진짜 서버)
- 공유 미리보기 그림(`docs/og.png`): `<electron.exe> tools/og-image/render.cjs`(원본 `tools/og-image/og.html` + `map.jpg` = 체험 지도 칸을 찍은 것)
- 올리기 전 찍기: `node tools/stamp.cjs`(파일 내용 해시 주소 · import map — `tools/deploy-site.cjs` 가 저절로 부른다)

청취자는 DJ 방송에서 `!아이디`로 만든 아이디(예: `밤톨#먼치`)로 자기 몬스터를 찾아봐요. 스푼 계정 정보는 다루지 않아요.
