# 먼치킨 키우기 사이트 — 설계서 (API 계약)

## 바뀐 것

### 2단계 (2026-10-08 밤)
- 사이트 이름 **먼치킨 키우기**(주소는 그대로). 메인 페이지(`/`)에 시즌 띠·아이디로 찾기(모든 방송)·지금 인기 있는 캐릭터(하트)·새로 꾸민 캐릭터·많이 입은 옷 TOP 5·키우기 중인 DJ. 새 화면: 캐릭터 페이지 `k/<주소>/<아이디 앞 부분>`(하트·링크 복사), 옷 도감 `items`.
- **애정도 숫자를 숨긴다**(스푼 답을 기다리는 동안, `lib.ts`의 `SHOW_LOVE = false`). 모든 공개 답에서 `love`가 빠진다. 1~3등 순서는 그대로 애정도 순.
- **캐릭터 이름은 사이트 전체에서 하나만**(먼저 쓴 방송이 가진다). 겹치면 409.
- **메인 페이지 노출 선택**(`main`). `false`면 메인 목록·전체 찾기에서 빠지고, DJ 페이지·캐릭터 페이지·하트는 그대로.
- **하트**: 한 브라우저는 한 캐릭터에 한국 날짜 하루 한 번, 시즌마다 새로. 되돌리기 없음.
- 새 SQL `supabase/kiugi-stage2.sql`(마이그레이션 이름 `kiugi_stage2`).

### 1단계 (2026-10-08)
스푼 답변(2026-10-08): Open API 정보는 개발사 서버에 저장할 수 없고, 청취자 정보와 이어진 팬 글도 서버에 둘 수 없다.
- **팬페이지 서비스를 마쳤다.** 사이트에서 팬 페이지(`p/<주소>…`)·DJ 꾸미기(`studio`)·휴대폰 가입(`app`)·사연 보내기를 뺐다. 그 주소로 오면 "팬페이지 서비스를 마쳤어요" 안내가 나온다. 서버 함수 `fanpage`는 `GET health`만 답하고 나머지는 모두 410(아래).
- **DJ 키우기는 청취자가 직접 만든 아이디만 쓴다.** 청취자가 DJ 방송 채팅에서 `!아이디 <한글 1~6자>`로 이번 시즌 아이디를 만들고, 먼치킨은 `<그 글자>#<DJ 캐릭터 이름>`(예: `밤톨#먼치`) 모양으로 올린다. 스푼 닉네임은 받지도 저장하지도 않는다. 올리는 내용은 v2, 예전 v1(스푼 닉네임)은 400으로 거절.
- 그대로인 것: 스푼 연결 페이지 `spoon.html`(스푼 동의 화면의 리디렉션 주소)과 함수 `spoon-link`.

## 사이트

- 주소: `https://키우기.com/`(xn--ok0bp87bn6g.com, BASE `/`, 2026-10-08부터 — 예전 `https://jwonly-spn.github.io/jun-live-fanpage/` 는 GitHub 가 새 주소로 넘김. `docs/`, GitHub Pages, 빌드 없음).
  GitHub Pages는 모르는 경로에 `404.html`을 주므로 `404.html`은 `index.html`과 같은 내용(SPA). 경로에서 BASE 경로(`/jun-live-fanpage/`)를 떼고 라우팅.
- 화면: `/`(메인, `views/intro.js` — 칸 목록 `LANDING_SECTIONS`) · `items`(옷 도감) · `k/<주소>`(DJ 키우기 페이지) · `k/<주소>/<아이디 앞 부분>`(캐릭터 페이지, 앞 부분 = 한글 1~6자) · `p/…`·`studio`·`app`(마친 서비스 안내) · 그 밖(없는 주소 안내). `spoon.html`은 따로 있는 페이지.
- 화면에는 레벨과 표정 이름만 보이고 애정도 숫자는 보이지 않는다.
- 하트: 사이트가 이 브라우저 저장소(localStorage)에 무작위 열쇠(32자, `kg_heart_token`)를 만들어 두고 `POST heart`에 실어 보낸다. 오늘 보낸 캐릭터는 `kg_hearted`에 기억해 "♥ 오늘 하트 보냈어요"로 보여 준다(저장소가 막혀 있으면 이번 창에서만).
- 옷 도감: 이름·값·레벨은 사이트에 복사된 시즌 목록 `docs/kiugi/season-*.json`(먼치킨 `rules.mjs`와 같게 — 시즌 옷은 등급표 `tiers`의 price·level, 시즌 보상은 보상 값과 `seasonRewardRule.minLevel`), 입은 사람 수는 `GET home`의 `items`(메인에 보이는 방송만).
- 그림: 화면 가까이 온 카드만 그린다(그림 파일이 1024px라 휴대폰 메모리를 아끼려고).
- 체험: `?demo=1`(localhost 에서는 늘) — `docs/mock.js`가 모든 길을 흉내 낸다. 지어낸 DJ 캐릭터 먼치(`nyangdj7`)·쿠키(`cuky2345`)·젤리(`jery2468`), 닫힌 페이지 `shutpg22`.

## DJ 키우기 — Edge Function `kiugi`

사이트 주소 `BASE + 'k/<주소>'`(주소 = 서버가 만든 8자, `[a-hjkmnp-z2-9]`, 헷갈리는 i·l·o·0·1 없음).
올리는 쪽은 먼치킨(봇 프로그램) 본체 `app/desktop/kiugi-fanpage.cjs`(먼치킨 저장소). 그림은 먼치킨과 같은 `kiugi-art.js`(사이트 `docs/kiugi/`, 먼치킨 저장소 `node tools/sync-kiugi-site.mjs`로 복사).

- 서버: `https://aksegkhhugqvvaidgvro.supabase.co/functions/v1/kiugi/` — 코드 `supabase/functions/kiugi/`(index.ts = Supabase 연결, handler.ts = 요청 처리, lib.ts = 검사), 표 `supabase/kiugi.sql` + `supabase/kiugi-stage2.sql`. 요청에 머리글 `apikey: sb_publishable_45cIqG4dGLSlev-rmNiVDg_uG8szVzD`(공개 키, 비밀 아님).
- 아이디: `<앞>#<캐릭터 이름>`. 앞 = 한글 완성 글자(가~힣)만 1~6자(청취자가 만든 부분), 캐릭터 이름 = 한글·영문·숫자 1~8자이고 올린 내용의 `character.name`과 글자 그대로 같아야 한다. NFC로 맞추고 앞뒤 공백만 뗀 뒤 검사한다. 모양이 틀리거나 뒤 이름이 다른 줄은 그 줄만 버린다. 같은 아이디가 두 번 오면 애정도 높은 줄만 남긴다.
- 캐릭터 이름 열쇠 `name_key` = 캐릭터 이름을 NFC + 영문 소문자로. 사이트 전체에서 하나만(유일 인덱스). 먼저 쓴 방송이 가진다 — 다른 방송이 같은 열쇠로 올리면 409 "이 캐릭터 이름은 다른 방송이 이미 쓰고 있어요. 먼치킨에서 캐릭터 이름을 바꿔 주세요."(동시에 올려 데이터베이스가 막아도 같은 409). 이름을 바꾸면 예전 열쇠는 풀린다. 끄기(`{enabled:false}`)는 열쇠를 지킨다. 60일 동안 아무것도 올리지 않으면(끈 채로도) 열쇠를 지운다.
- 저장하는 것(`kg_pages`): DJ 캐릭터(이름·모양 열쇠), `name_key`, `main`, 시즌(id·이름·끝나는 날), 청취자 줄 `{id, level(1~100), love, worn({칸: 옷 id}), k(찾기 열쇠), ch(새로 꾸민 때)}`, 1~3등, 인원 수, `summary`(메인용 요약: 새로 꾸민 8명 `{k,id,level,worn,ch}`·옷마다 입은 수), `updated`(마지막으로 내용을 올린 때), `seen`(마지막으로 무엇이든 올린 때 — 끄기 포함). 스푼 닉네임·고유닉·jl-번호·스푼 번호·냥·출석은 받지 않는다(보낸 줄의 다른 칸은 버림). 3,000명·본문 1.5MB까지.
- `ch`(새로 꾸민 때): 올릴 때 지난번 사람 목록과 찾기 열쇠로 비교해 처음 보는 사람이나 입은 옷이 바뀐 사람은 지금 시각, 그대로면 지난 값. 순서에만 쓰고 밖으로 내보내지 않는다. "새로 꾸민 캐릭터"에는 옷을 하나라도 입은 사람만.
- 주소는 처음 올린 기기에 묶인다(같은 PC가 다시 올리면 같은 주소에 통째로 바꿔 넣음). `{enabled:false}`를 올리면 내용만 지우고 주소·`name_key`·`main`은 남긴다. `seen`이 60일 지나면 내용·`name_key`·하트를 지운다(올릴 때 가끔 정리). 승인 서버에서 차단·대기로 바꾼 기기의 페이지는 닫힌다. 심사용 기기는 올리지 못한다.
- 하트(`kg_hearts (slug, season, pid, hearts)`, pid = 찾기 열쇠): 시즌 id가 열쇠에 들어 있어 시즌마다 0부터. 지운 아이디·지난 시즌의 하트 줄은 답에서 빼고, 올릴 때(시즌이 바뀌었거나 가끔) 지운다. 하루 한 번 막기는 `kg_heart_votes`(열쇠 = sha256(비밀값:브라우저 열쇠:한국 날짜:시즌:주소:pid), 다음 한국 자정 + 하루 뒤 만료, 가끔 지움). 투표 열쇠와 +1 은 함수 `kg_heart`가 한 번에 한다.

공개(로그인 없음, 주소 해시마다 횟수 제한). 사람 한 명 = `{rank, id, level, worn, hearts}`, 카드 한 장 = `{slug, djName, id, level, worn, hearts}`. `love`는 `SHOW_LOVE`가 true일 때만 붙는다(지금은 false).
- `GET page?slug=` (1분 60번, 캐시 30초) → `{slug,name,season:{id,name,endsAt}|null,paused,character,top:[사람…3명],count,updatedAt}` · 없으면 404, 닫혀 있으면 404 `{error,closed:true}`. 아이디 모양이 아닌 예전 줄은 top 에서 뺀다. `main=false`여도 열린다.
- `GET find?slug=&q=` (1분 30번, 캐시 15초) → `{results:[사람…5명까지],exact,more}`. q 는 띄어쓰기를 뺀 뒤 앞 부분만(`밤톨`, 한글 1~6자) 또는 전체 아이디(`밤톨#먼치`). 전체로 찾으면 아이디 전체와, 앞 부분만 적으면 앞 부분끼리 비교한다. 정확히 같은 사람 먼저, 그다음 그 글이 들어 있는 사람(둘 다 순위 순). 모양이 틀리면 400 "아이디를 한글 1~6자로 적어 주세요. 예: 밤톨 또는 밤톨#먼치".
- `GET person?slug=&id=` (1분 60번, 캐시 30초) → `{id, level, worn, hearts, season, dj:{slug, name, character}}`. id 는 앞 부분이나 전체 아이디. 없으면 404 "이 아이디를 찾을 수 없어요. 이번 시즌 아이디가 맞는지 확인해 주세요." `main=false`여도 열린다.
- `GET home` (1분 60번, 캐시 60초, 함수 안에서도 30초 기억) → `{season, popular, recent, items, djs, totals}`. 메인에 보이는 페이지(`main=true`·내용 있음·승인된 기기)만.
  - `season`: 그 페이지들 중 가장 많이 쓰는 시즌(같으면 끝나는 날이 늦은 쪽) `{id,name,endsAt}` 또는 null.
  - `popular`: 카드 12장까지, 하트 > 0, 하트 많은 순(지금 시즌 페이지만, 지금 사람 목록에 있는 아이디만).
  - `recent`: 카드 8장까지, 새로 꾸민 때 최근 순(지금 시즌 페이지만).
  - `items`: `[{id, count}]` 옷마다 입은 사람 수, 전부, 많은 순(지금 시즌 페이지만).
  - `djs`: `[{slug, name, character, count}]` 메인에 보이는 모든 페이지, 청취자 많은 순.
  - `totals`: `{djs, people}`.
- `GET search?q=` (1분 30번, 캐시 30초) → `{results:[카드…10장까지],exact,more}`. 메인에 보이는 페이지만. 전체 아이디(`밤톨#먼치`)는 `name_key`로 그 페이지를 바로 찾고, 앞 부분만이면 모든 방송에서 앞 부분이 같은 사람 먼저·들어 있는 사람 다음(각각 레벨 높은 순).
- `POST heart` 본문 `{slug, id, token}` → `{hearts, already}`. id = 앞 부분이나 전체 아이디, token = 브라우저가 만든 무작위 32자(base64url). 주소 해시마다 1시간 60번, 열쇠마다 하루 50번(넘으면 429). 사람이 보이는 페이지의 지금 사람 목록에 있어야 한다(없으면 404, 닫힌 페이지 404, 시즌 준비 중이면 409). 같은 날 두 번째부터 `already:true`(수는 그대로).
- `GET health` → `{service:"jun-live-kiugi",v:2,hearts:true}`

먼치킨(기기 서명, 기기 1분 2번):
- `POST app` 본문 `{action:"upload",payload,publicKey,timestamp,nonce,signature}`, 서명 문자열 `JUN-LIVE-KIUGI/1\n{action}\n{timestamp}\n{nonce}\n{publicKey}\n{sha256hex(JSON.stringify(payload))}` (ieee-p1363, base64url, 시간 ±60초, 같은 nonce 한 번) → `{ok,enabled,slug,url,count}`
- payload v2:
  ```json
  {
    "enabled": true, "v": 2, "at": 1792000000000, "paused": false, "main": true,
    "season": {"id": "s1", "name": "할로윈", "endsAt": "2026-11-30T14:59:59.000Z"},
    "character": {"name": "먼치", "gender": "f", "hair": "long", "hairColor": "pink", "skin": "s2", "eyes": "sparkle", "nose": "dot", "mouth": "smile"},
    "people": [{"id": "밤톨#먼치", "level": 3, "love": 420, "worn": {"head": "witch-hat"}}]
  }
  ```
  또는 `{enabled:false}`(내용 지우기). `main`은 넣지 않아도 되고(없으면 true), `false`일 때만 메인에서 빠진다. `at`은 받아도 쓰지 않는다(서버 시간 사용). `paused:true`이거나 시즌이 없으면 청취자를 싣지 않는다. `character.name`이 한글·영문·숫자 1~8자가 아니면 400(먼치킨 `rules.mjs`와 같은 규칙). 캐릭터 이름이 다른 방송 것이면 409. `v`가 2가 아니면 400 "먼치킨을 새 버전으로 업데이트한 뒤 다시 올려 주세요."

올리는 순서(배포 — 사용자 허락 뒤):
1. SQL: `supabase/kiugi-stage2.sql`(마이그레이션 이름 `kiugi_stage2`, `kiugi.sql` 다음, 여러 번 실행해도 됨). 함께 쓰는 `junlive_devices`·`junlive_access_nonces`·`junlive_secrets`·`fp_hit`이 이미 있어야 한다(승인 서버·팬페이지 schema).
2. Edge Function `kiugi` 배포: 파일 `index.ts`·`handler.ts`·`lib.ts` 세 개, JWT 확인 끔(`verify_jwt: false`). 소스에 유니코드 표기(백슬래시-u)를 넣지 않는다(올리기 도구가 글자로 풀어 버림). SQL 이 먼저여야 한다(새 함수가 `name_key`·`main`·`summary`·`seen`·`kg_hearts`를 쓴다).
3. 확인: `GET …/kiugi/health` → `{"service":"jun-live-kiugi","v":2,"hearts":true}`, `GET …/kiugi/home` → 200, `GET …/kiugi/page?slug=abcdefgh` → 404, `GET …/kiugi/search?q=abc` → 400.
4. 사이트: 먼치킨 저장소에서 `node tools/sync-kiugi-site.mjs`(그림·시즌 목록이 바뀔 때마다) → `node tools/deploy-site.cjs "메시지"`.

## 마친 서비스 — Edge Function `fanpage` (2026-10-08)

- `GET health` → 200 `{service:"jun-live-fanpage",closed:true}`
- 그 밖의 모든 길(예전 사이트·먼치킨·송출의 `app` 요청·`owner/…`·`admin/…` 포함) → 410 `{error:"팬페이지 서비스를 마쳤어요."}`. `OPTIONS`는 204. CORS 머리글은 그대로.
- 배포: 파일 `index.ts` 하나(예전 `lib.ts`는 지움), JWT 확인 끔. 데이터베이스를 쓰지 않는다.
- 예전 팬페이지 표(`fp_*`)·사진 버킷(`fp-photos`)은 지우지 않았다(`supabase/schema.sql`·`storage.sql`). `fp_hit`·`junlive_secrets`는 `kiugi`가 계속 쓴다. 남은 자료를 지울지는 사용자가 정한다.
