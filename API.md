# 먼치킨 DJ 키우기 사이트 — 설계서 (API 계약)

## 바뀐 것 (2026-10-08)

스푼 답변(2026-10-08): Open API 정보는 개발사 서버에 저장할 수 없고, 청취자 정보와 이어진 팬 글도 서버에 둘 수 없다.

- **팬페이지 서비스를 마쳤다.** 사이트에서 팬 페이지(`p/<주소>…`)·DJ 꾸미기(`studio`)·휴대폰 가입(`app`)·사연 보내기를 뺐다. 그 주소로 오면 "팬페이지 서비스를 마쳤어요" 안내가 나온다. 서버 함수 `fanpage`는 `GET health`만 답하고 나머지는 모두 410(아래).
- **DJ 키우기는 청취자가 직접 만든 아이디만 쓴다.** 청취자가 DJ 방송 채팅에서 `!아이디 <한글 1~6자>`로 이번 시즌 아이디를 만들고, 먼치킨은 `<그 글자>#<DJ 캐릭터 이름>`(예: `밤톨#먼치`) 모양으로 올린다. 스푼 닉네임은 받지도 저장하지도 않는다. 올리는 내용은 v2, 예전 v1(스푼 닉네임)은 400으로 거절.
- 사이트 첫 화면은 "먼치킨 DJ 키우기" 안내(체험 페이지 링크, "스푼이 만든 서비스가 아니에요"). 칸 목록(`views/intro.js`의 `LANDING_SECTIONS`)으로 그려서 나중에 "지금 인기 있는 캐릭터" 칸을 더할 수 있다.
- 그대로인 것: 스푼 연결 페이지 `spoon.html`(스푼 동의 화면의 리디렉션 주소)과 함수 `spoon-link`, 표 `kg_pages`(people 은 jsonb 라 모양만 바뀜).

## 사이트

- 주소: `https://jwonly-spn.github.io/jun-live-fanpage/` (BASE, `docs/`, GitHub Pages, 빌드 없음).
  GitHub Pages는 모르는 경로에 `404.html`을 주므로 `404.html`은 `index.html`과 같은 내용(SPA). 경로에서 BASE 경로(`/jun-live-fanpage/`)를 떼고 라우팅.
- 화면: `/`(첫 화면) · `k/<주소>`(DJ 키우기 페이지) · `p/…`·`studio`·`app`(마친 서비스 안내) · 그 밖(없는 주소 안내). `spoon.html`은 따로 있는 페이지.
- 체험: `k/nyangdj7?demo=1`(지어낸 아이디, 서버에 닿지 않음 — `docs/mock.js`).

## DJ 키우기 페이지 — Edge Function `kiugi` (v2, 2026-10-08)

청취자가 자기 아이디로 자기 키우기 캐릭터를 찾고, 1~3등은 늘 보이는 공개 페이지. 사이트 주소 `BASE + 'k/<주소>'`(주소 = 서버가 만든 8자, `[a-hjkmnp-z2-9]`, 헷갈리는 i·l·o·0·1 없음).
올리는 쪽은 먼치킨(봇 프로그램) 본체 `app/desktop/kiugi-fanpage.cjs`(먼치킨 저장소). 그림은 먼치킨과 같은 `kiugi-art.js`(사이트 `docs/kiugi/`, 먼치킨 저장소 `node tools/sync-kiugi-site.mjs`로 복사).

- 서버: `https://aksegkhhugqvvaidgvro.supabase.co/functions/v1/kiugi/` — 코드 `supabase/functions/kiugi/`(index.ts = Supabase 연결, handler.ts = 요청 처리, lib.ts = 검사), 표 `supabase/kiugi.sql`(`kg_pages`). 요청에 머리글 `apikey: sb_publishable_45cIqG4dGLSlev-rmNiVDg_uG8szVzD`(공개 키, 비밀 아님).
- 아이디: `<앞>#<캐릭터 이름>`. 앞 = 한글 완성 글자(가~힣)만 1~6자(청취자가 만든 부분), 캐릭터 이름 = 한글·영문·숫자 1~8자이고 올린 내용의 `character.name`과 글자 그대로 같아야 한다. NFC로 맞추고 앞뒤 공백만 뗀 뒤 검사한다. 모양이 틀리거나 뒤 이름이 다른 줄은 그 줄만 버린다. 같은 아이디가 두 번 오면 애정도 높은 줄만 남긴다.
- 저장하는 것: DJ 캐릭터(이름·모양 열쇠), 시즌(id·이름·끝나는 날), 청취자 줄 `{id, level(1~100), love, worn({칸: 옷 id}), k(찾기 열쇠 = 아이디를 NFC·영문 소문자·띄어쓰기 뺀 것)}`, 1~3등, 인원 수. 스푼 닉네임·고유닉·jl-번호·스푼 번호·냥·출석은 받지 않는다(보낸 줄의 다른 칸은 버림). 3,000명·본문 1.5MB까지.
- 주소는 처음 올린 기기에 묶인다(같은 PC가 다시 올리면 같은 주소에 통째로 바꿔 넣음). `{enabled:false}`를 올리면 내용만 지우고 주소는 남긴다. 60일 동안 올리지 않으면 내용을 지운다. 승인 서버에서 차단·대기로 바꾼 기기의 페이지는 닫힌다. 심사용 기기는 올리지 못한다.

공개(로그인 없음, 주소 해시마다 횟수 제한):
- `GET page?slug=` (1분 60번) → `{slug,name,season:{id,name,endsAt}|null,paused,character,top:[{rank,id,level,love,worn}],count,updatedAt}` · 없으면 404, 닫혀 있으면 404 `{error,closed:true}`. 아이디 모양이 아닌 예전 줄은 top 에서 뺀다.
- `GET find?slug=&q=` (1분 30번) → `{results:[{rank,id,level,love,worn}…5명까지],exact,more}`. q 는 띄어쓰기를 뺀 뒤 앞 부분만(`밤톨`, 한글 1~6자) 또는 전체 아이디(`밤톨#먼치`). 전체로 찾으면 아이디 전체와, 앞 부분만 적으면 앞 부분끼리 비교한다. 정확히 같은 사람 먼저, 그다음 그 글이 들어 있는 사람(둘 다 순위 순). 모양이 틀리면 400 "아이디를 한글 1~6자로 적어 주세요. 예: 밤톨 또는 밤톨#먼치".
- `GET health` → `{service:"jun-live-kiugi",v:2}`

먼치킨(기기 서명, 기기 1분 2번):
- `POST app` 본문 `{action:"upload",payload,publicKey,timestamp,nonce,signature}`, 서명 문자열 `JUN-LIVE-KIUGI/1\n{action}\n{timestamp}\n{nonce}\n{publicKey}\n{sha256hex(JSON.stringify(payload))}` (ieee-p1363, base64url, 시간 ±60초, 같은 nonce 한 번) → `{ok,enabled,slug,url,count}`
- payload v2:
  ```json
  {
    "enabled": true, "v": 2, "at": 1792000000000, "paused": false,
    "season": {"id": "s1", "name": "할로윈", "endsAt": "2026-11-30T14:59:59.000Z"},
    "character": {"name": "먼치", "gender": "f", "hair": "long", "hairColor": "pink", "skin": "s2", "eyes": "sparkle", "nose": "dot", "mouth": "smile"},
    "people": [{"id": "밤톨#먼치", "level": 3, "love": 420, "worn": {"head": "witch-hat"}}]
  }
  ```
  또는 `{enabled:false}`(내용 지우기). `at`은 받아도 쓰지 않는다(서버 시간 사용). `paused:true`이거나 시즌이 없으면 청취자를 싣지 않는다. `character.name`이 한글·영문·숫자 1~8자가 아니면 400. `v`가 2가 아니면 400 "먼치킨을 새 버전으로 업데이트한 뒤 다시 올려 주세요."

올리는 순서(배포 — 사용자 허락 뒤):
1. SQL: 표는 그대로라 새 마이그레이션은 없다(처음이면 `supabase/kiugi.sql`, 이름 `kiugi_pages`). 함께 쓰는 `junlive_devices`·`junlive_access_nonces`·`junlive_secrets`·`fp_hit`이 이미 있어야 한다(승인 서버·팬페이지 schema).
2. Edge Function `kiugi` 배포: 파일 `index.ts`·`handler.ts`·`lib.ts` 세 개, JWT 확인 끔(`verify_jwt: false`). 소스에 유니코드 표기(백슬래시-u)를 넣지 않는다(올리기 도구가 글자로 풀어 버림).
3. 확인: `GET …/kiugi/health` → `{"service":"jun-live-kiugi","v":2}`, `GET …/kiugi/page?slug=abcdefgh` → 404, `GET …/kiugi/find?slug=abcdefgh&q=abc` → 400.
4. 사이트: 먼치킨 저장소에서 `node tools/sync-kiugi-site.mjs`(그림이 바뀔 때마다) → `node tools/deploy-site.cjs "메시지"`.
5. 먼치킨 새 버전(봇 프로그램)이 v2(`!아이디`로 만든 아이디)를 올려야 실제로 보인다.

## 마친 서비스 — Edge Function `fanpage` (2026-10-08)

- `GET health` → 200 `{service:"jun-live-fanpage",closed:true}`
- 그 밖의 모든 길(예전 사이트·먼치킨·송출의 `app` 요청·`owner/…`·`admin/…` 포함) → 410 `{error:"팬페이지 서비스를 마쳤어요."}`. `OPTIONS`는 204. CORS 머리글은 그대로.
- 배포: 파일 `index.ts` 하나(예전 `lib.ts`는 지움), JWT 확인 끔. 데이터베이스를 쓰지 않는다.
- 예전 팬페이지 표(`fp_*`)·사진 버킷(`fp-photos`)은 지우지 않았다(`supabase/schema.sql`·`storage.sql`). `fp_hit`·`junlive_secrets`는 `kiugi`가 계속 쓴다. 남은 자료를 지울지는 사용자가 정한다.
