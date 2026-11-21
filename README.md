# 먼치킨 키우기 사이트

먼치킨(스푼 DJ용 봇 프로그램)의 DJ 키우기 공개 사이트와 스푼 연결 페이지예요. 스푼이 만든 서비스가 아니에요.

## 12월 1일 0시에 저절로 바뀌기 (2026-11-21)

- 이 사이트는 **2026-12-01 00:00(한국) 전에는 시즌 2 예고 화면**(모든 주소), **그때부터는 시즌 2 화면**(지도 `/` · 도감 `/dex` · 보스전 보기 `/boss` · `/b/<DJ 주소>`)을 보여 줘요. 미리 올려 두면 0시에 아무도 안 해도 바뀌어요.
- 지금 시각은 방문자 기기 시계가 아니라 **서버 시각**(이 사이트 서버 답의 `Date` 머리글 — `notice.json` 을 HEAD 로 한 번)으로 봐요. 서버에 못 닿으면 방문자 시계로 고르고 console 에 한 줄 남겨요. 코드: `docs/lib/launch.js`(고르기) · `docs/app.js`(시작점) · `docs/s2-app.js`(시즌 2 길잡이 — 예전 app.js) · `docs/lib/clock.js`(서버 시각에 맞춘 시계 — 시즌 2 첫 화면의 "남은 날") · `tools/stamp.cjs` 의 BOOT(맨 위 작은 스크립트 — 첫 색·미리 받기만 기기 시계로 미리 고름).
- 예고 화면: `docs/views/teaser.js` · `docs/lib/teaser-*.js` · `docs/lib/me.js` · `docs/lib/hearts.js` · `docs/teaser/` · `styles.css` 맨 끝 "예고 화면" 덩어리(`html.s2-teaser` 일 때만). 시즌 1 숫자는 `docs/teaser/s1-stats.json`.
- 검색·공유용 글(`index.html` 의 meta·og)은 날짜로 못 바꿔서 두 때 모두 맞는 말로 적었어요. 미리보기 그림(`og:image`·`og:image:alt`)만 12월 1일 전에는 지금 그대로 `teaser/og.png`(COMING SOON — 2026-11-21 사용자 결정), 지도 그림 `og.png` 는 정리 때 쓰려고 둬요.
- **12월 1일이 지난 뒤 정리(급하지 않음)**: `app.js` 를 `s2-app.js` 내용으로 바꾸고 위 예고 파일·`lib/launch.js`·스타일 덩어리·BOOT 의 예고 갈래를 지워요. `index.html` 의 `class="s2-teaser"` 와 theme-color 도 시즌 2 값으로. **`teaser/` 를 지우기 전에** `index.html`·`404.html` 의 `og:image` 를 `og.png` 로, `og:image:alt` 를 지도 그림 설명으로(시험 `launch.test.mjs`·`site.test.mjs` 의 og 줄도). 예고 색 시험(`tests/teaser-colors.test.mjs`, `launch.test.mjs` 의 "어두운 모드 색과 공용 초점 테두리" 시험)도 지우고, `styles.css` 어두운 모드 덩어리의 `:not(.s2-teaser)` 는 떼도 돼요.
- 시험: `tests/launch.test.mjs`(날짜 전·후 화면 고르기 — 지어낸 시계·서버 답) · `tests/teaser-colors.test.mjs`(예고 색이 어두운 모드에서도 지금과 같은지 — 진짜 브라우저 계산값, `KIUGI_ELECTRON`=electron.exe 위치가 있을 때만) · 사진: `tools/shots-launch.cjs`(Electron — 가짜 시각 11/30 23:59 · 12/1 00:01 · 12/15, `--dark` 면 어두운 모드).

- 사이트: https://키우기.com/ (영문 표기 xn--ok0bp87bn6g.com, 2026-10-08부터 · 2026-11-08 Cloudflare 로 https. 예전 https://jwonly-spn.github.io/jun-live-fanpage/ 는 자동으로 넘어감. `docs/`, GitHub Pages, 빌드 없음, `docs/CNAME`)
  - **시즌 2 "몬스터 영토전"(2026-12-01~12-31)**: 첫 화면 `/` = 영토 지도(화면 가득 — Codex 대륙 그림 위에 DJ 땅을 물감으로, 식민지 줄무늬, DJ 이름·%·어제보다, 남은 날, 1등 상) → 아이디로 몬스터 찾기(`/?id=밤톨`) → 땅 순위·지도 소식 → 땅을 넓히는 법 · 몬스터 도감 `/dex`(`?id=` 면 데려간 몬스터는 색, 못 만난 것은 그림자) · 스푼 연결 `spoon.html`
  - 시즌 1 화면(캐릭터 페이지·DJ 페이지·옷 도감·입혀 보기·저장하기)과 그림은 2026-11-15 걷어냈다. 예전 주소는 첫 화면으로(캐릭터 주소면 그 아이디로 찾기).
- 지도 = 영토 서버(먼치킨 저장소 `server/territory-supabase`)가 올리는 공개 파일 `tr-snap/map.json`(모양은 `API.md` "시즌 2"). 그리기 `docs/lib/map-core.js`(계산 — DOM 없음) · `docs/lib/map-draw.js`(캔버스·이름표·번지듯 바뀌기)
- 그림 지도: `docs/s2/continent.webp`·`land.png`·`land-grid.json` = `<electron.exe> tools/make-map-art.cjs [continent_s2.png] [land_mask.png]`(Codex 대륙 그림이 바뀌면 다시)
- 몬스터 그림·시즌 2 목록: `docs/kiugi/`(먼치킨 저장소 `tools/sync-kiugi-site.mjs`로 복사 — 직접 고치지 않기). 없으면 속성 색 동그라미·자리 이름(`docs/lib/monsters.js`)
- DJ 키우기 서버: Supabase Edge Function `kiugi` (`supabase/functions/kiugi/`) — 올리기 v3(시즌 2 몬스터), 시즌 1 v2 는 2026-12-01 0시(한국)까지만. 표 `supabase/kiugi.sql` + `supabase/kiugi-stage2.sql`(이름 하나만·메인 노출·하트) + `supabase/migrations/`(보스전 보기 `kg_fights` — 함수 v4, API.md "보스전 보기")
- 팬페이지 서비스는 2026-10-08에 마쳤어요. 함수 `fanpage`는 health 말고 모두 410을 돌려줘요(`supabase/functions/fanpage/`). 예전 표 정의 `supabase/schema.sql`·`storage.sql`은 기록으로 남겨 둠(`fp_hit`·`junlive_secrets`는 `kiugi`가 씀)
- 설계서: `API.md`(맨 위 "바뀐 것", 올리는 순서)
- 검사: `node --test tests/*.test.mjs` (서버 SQL 검사 `server-schema.test.mjs`는 `PGLITE_ENTRY` 환경 변수로 PGlite 위치 지정 · 예고 색 시험은 `KIUGI_ELECTRON` 으로 electron.exe 위치 지정). 서버 시험 도우미는 `tests/kiugi-world.mjs`
- 미리 보기: `node tools/serve.mjs [포트]` → http://127.0.0.1:5173/ (localhost 에서는 체험 모드 — 지어낸 DJ 별사탕·구름빵 등이 한 달을 흉내 낸 지도, 지어낸 아이디 밤톨#먼치 등. 주소 `?day=1~31`·`?djs=3~40`·`?still=1`(다시 읽어도 날이 안 넘어감)·`?empty=1`(지도 파일 없음)·`?art=0`(그림 지도 없이) · `?demo=0` 은 진짜 서버)
- 공유 미리보기 그림(`docs/og.png` — 12월 1일 뒤 정리 때부터 씀, 그 전에는 `docs/teaser/og.png`): `<electron.exe> tools/og-image/render.cjs`(원본 `tools/og-image/og.html` + `map.jpg` = 체험 지도 칸을 찍은 것)
- 올리기 전 찍기: `node tools/stamp.cjs`(파일 내용 해시 주소 · import map — `tools/deploy-site.cjs` 가 저절로 부른다)

청취자는 DJ 방송에서 `!아이디`로 만든 아이디(예: `밤톨#먼치`)로 자기 몬스터를 찾아봐요. 스푼 계정 정보는 다루지 않아요.
