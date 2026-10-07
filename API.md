# JUN LIVE 팬페이지 — 설계서 (API 계약)

모든 DJ가 쓰는 팬페이지 서비스. 사이트 하나(`docs/`, GitHub Pages)에 모든 DJ의 페이지가 들어간다.

- 사이트 주소: `https://jwonly-spn.github.io/jun-live-fanpage/` (BASE). 팬 페이지 `BASE + 'p/<slug>'`, DJ 편집 `BASE + 'studio'`.
  GitHub Pages는 모르는 경로에 `404.html`을 주므로 `404.html`은 `index.html`과 같은 내용(SPA). 경로에서 BASE 경로(`/jun-live-fanpage/`)를 떼고 라우팅.
- 서버: Supabase Edge Function `fanpage` — `API = https://aksegkhhugqvvaidgvro.supabase.co/functions/v1/fanpage/`
  모든 요청에 머리글 `apikey: sb_publishable_45cIqG4dGLSlev-rmNiVDg_uG8szVzD` (공개 키, 비밀 아님).
- 사진: 공개 버킷 `fp-photos`. 주소 = `https://aksegkhhugqvvaidgvro.supabase.co/storage/v1/object/public/fp-photos/<path>`
- 응답은 JSON. 오류는 `{error:"한국어 메시지"}` + HTTP 상태(400/401/403/404/409/413/429/503).
- 날짜·요일 계산은 한국 시간(Asia/Seoul).

## 설정 (config) — DJ가 꾸미는 내용 전체, draft/published 두 벌

```json
{
  "v": 1,
  "theme": "rose",                        // rose|peach|butter|mint|sky|lavender|mono|midnight
  "layout": "story",                      // story(이야기 중심)|photo(사진 중심)
  "profile": {
    "name": "하루",                        // 1~24자
    "intro": "당신의 하루 끝에,\n조금 더 다정한 시간.",   // ≤100
    "description": "…",                   // ≤300
    "quote": "좋은 목소리가 좋은 하루를 만든다.",  // ≤80, 선택
    "schedule": "매일 저녁 8시",            // 다음 약속, ≤60, 선택
    "spoonUrl": "https://www.spooncast.net/kr/channel/…",  // spooncast.net https만
    "avatar": {"path":"…","thumb":"…","w":800,"h":800} | null,
    "cover":  {"path":"…","thumb":"…","w":1600,"h":900} | null
  },
  "menus": [                              // 최대 12개, 홈은 고정이라 목록에 없음
    {
      "id": "m_x8k2",                     // [a-z0-9_]{2,24}, 페이지 안에서 고유
      "name": "추억", "description": "…",  // 이름 1~24, 설명 ≤80
      "form": "photo_text",               // 아래 양식 중 하나
      "visible": true,
      "options": { … }                    // 양식별
    }
  ]
}
```

양식(form)과 options:

| form | 이름 | options |
|---|---|---|
| `board` | 글 게시판 | `allowComments` |
| `photo_text` | 사진 + 글 | `categories: string[]`(≤8, 각 ≤12자), `allowComments`, `showOnHome` |
| `album` | 사진 앨범 | `categories`, `showOnHome` |
| `archive` | 박제판(인스타 피드) | `allowComments`, `showOnHome` |
| `lounge` | 팬 라운지 | `question`(오늘의 질문, ≤80), `showMissions`(오늘 할 일) |
| `attendance` | 출석 체크 | `rewards: [{at:15,label:"복권 1장"}]`(≤10) |
| `poll` | 투표 | (투표 내용은 owner/poll로 만든다) |
| `ranking` | 랭킹 | `support`(후원 랭킹 보이기), `activity`(애청지수 보이기) |
| `days` | 기념일 | `days: [{id,title,date:"2026-09-09",yearly:bool,note}]`(≤20) |
| `links` | 링크 모음 | `links: [{label,url}]`(≤12, https만) |

사진은 **절대 자르지 않는다**. 사진마다 `w`,`h`를 저장하고 화면은 그 비율로 칸을 만든다(피드: 폭 100%, 높이 = 폭×h/w, 최대 폭×1.5 — 넘으면 전체가 보이게 contain, 옆은 같은 사진 흐리게. 앨범: 2열(PC 3~4열) 메이슨리).

## 공개 API (로그인 없음)

- `GET page?slug=<slug>` → `{page:{id,slug,config,updated}, live:{on,title,updated}|null, rankings:{support:{week:[],month:[],all:[]},activity:[]}|null}` (공개 안 됐거나 차단: 404). 랭킹 항목 `{nickname}`(애청지수는 `{nickname,level}`), 금액 없음, 최대 20명.
- `GET home?page=<id>` → `{menus:{<menuId>:[post…최신 3개]}, comments:[최근 한마디 4개], pinned:[고정 글 3개]}`
- `GET posts?page=<id>&menu=<menuId>&category=<선택>&before=<ISO 선택>` → `{posts:[Post], more:bool}` (20개씩, 고정 글 먼저는 첫 페이지만)
- `GET post?id=<id>` → `{post:Post}`
- `GET comments?page=<id>&menu=<menuId>&post=<선택>&before=<ISO>` → `{comments:[Comment], more}` (20개씩)
- `POST comment {page,menu,post?,nickname,body,fan}` → `{comment}` — 닉네임 1~20, 글 1~200. 같은 사람(ip) 10분에 5개까지. 차단된 ip/닉네임은 403.
- `POST like {post,fan}` → `{likes,liked}` (fan = 브라우저마다 만든 무작위 id, 누르면 켜고/끄기)
- `POST attendance {page,menu,nickname,pin,action}` — action `create`(새 카드) | `load`(불러오기) | `check`(오늘 출석). pin = 숫자 4자리(서버엔 해시만). → `{card:{nickname,total,month:["2026-09-01",…],today:bool,next:{at,label}|null}}`. 같은 닉네임+틀린 PIN 5번 → 10분 잠금.
- `GET poll?page=<id>&menu=<menuId>&fan=<fan>` → `{poll:{id,question,description,options:[{label,votes}],total,voted:index|null,closed}|null}`
- `POST vote {poll,option,fan}` → `{poll}` (한 사람 1표, 바꾸기 가능)
- `GET storybox?page=<id>` → `{open:bool, note}` — DJ가 사연함을 열어 두었는지.
- `POST story {page,nickname,tag?,body?,data?,thumb?,w?,h?,fan}` → `{story}` — 사연함이 열려 있을 때만(403). 닉네임 1~20, 고유닉(영문·숫자, 보상용) 선택, 글 ≤300(사진만도 가능), 사진은 owner/photo와 같은 규격. 같은 사람 10분에 3개, 페이지 시간당 60개. 7일 뒤 자동 삭제.
  Story = `{id,nickname,tag,body,photo:{path,thumb,w,h,url,thumbUrl}|null,created}` (사진 주소 `p/<slug>/story`)

Post = `{id,menu,title,body,photos:[{path,thumb,w,h}],category,pinned,supporter,eventDate,likes,comments,created}`
Comment = `{id,menu,post,nickname,body,created,hearted:bool,reply:string|null}`

## DJ API (머리글 `Authorization: Bearer <token>`)

- `POST owner/exchange {code}` → `{token,expires,page:{id,slug}|null}` — JUN LIVE가 연 주소 `BASE + 'studio#code=<code>'`의 1회용 코드(3분). 토큰은 30일, 브라우저 localStorage에 저장.
- `GET owner/page` → `{page:{id,slug,draft,published,revision,publishedAt,blocked}|null, spoon:{nickname,tag}}`
- `POST owner/page {slug?,draft,revision}` → `{page}` — 처음이면 slug 필요(영문 소문자·숫자·하이픈 3~30, 예약어 studio/p/api/admin 금지)해서 만든다. revision이 다르면 409.
- `POST owner/publish` → `{page}` (draft를 published로 복사) / `POST owner/unpublish`
- `POST owner/photo {data,thumb,w,h}` — data/thumb = base64 JPEG(원본 긴 변 ≤2048·≤1.5MB, 미리보기 긴 변 ≤640·≤200KB), 브라우저에서 줄여서 보낸다 → `{path,thumb,w,h}`. 페이지당 사진 총 200MB.
- `POST owner/post {id?,menu,title,body,photos,category,pinned,supporter,eventDate}` → `{post}` (제목 ≤60, 글 ≤3000, 사진 ≤10장)
- `POST owner/post/delete {id}` → `{ok}` (사진 파일도 지움)
- `GET owner/comments?menu=&before=` → `{comments:[Comment+{hidden,ipBlocked}],more}`
- `POST owner/comment {id,hearted?,reply?,hidden?}` → `{comment}` / `POST owner/comment/delete {id}` / `POST owner/block {comment}` (그 사람 ip·닉네임 차단)
- `POST owner/poll {menu,question,description,options:[..2~6]}` → 새 투표(이전 것 닫힘) / `POST owner/poll/close {menu}`
- `GET owner/attendance?menu=` → `{cards:[{nickname,total,monthCount,last,rewards:[label…]}]}` (보상 받을 사람 확인용)

## JUN LIVE 프로그램 API (기기 서명)

사용 승인 서버와 같은 기기 키(ECDSA P-256)로 서명. 기기는 `junlive_devices`에서 approved여야 함.
본문 `{action,payload,publicKey,timestamp,nonce,signature}`, 서명 문자열
`JUN-LIVE-FANPAGE/1\n{action}\n{timestamp}\n{nonce}\n{publicKey}\n{sha256hex(JSON.stringify(payload))}` (ieee-p1363, base64url).

- `POST app {action:"login", payload:{spoon:{id,tag,nickname}}}` → `{code,url}` — 이 기기가 연결된 페이지가 있으면 그 페이지로, 없으면 새로 만들 수 있는 세션.
- `POST app {action:"sync", payload:{live:{on,title},rankings:{support:{week,month,all},activity}}}` → `{ok,slug}` — 연결된 페이지가 없으면 `{ok:false}`.
- `POST app {action:"storybox", payload:{open:bool, note?}}` → `{ok,open,note,url}` — 사연함 열기/닫기(url = 팬이 보낼 주소, 공개 전이면 null).
- `POST app {action:"stories"}` → `{ok,open,note,url,stories:[Story…최신 200개]}` (부를 때 7일 지난 사연 정리).
- `POST app {action:"story_delete", payload:{id}}` → `{ok}` (사진도 지움).

## 관리자 (서비스 주인) — 머리글 `x-junlive-admin` (사용 승인 서버와 같은 관리자 키)

- `GET admin/pages?q=` → 페이지 목록, `POST admin/page {id,blocked}`

## DJ 키우기 페이지 — Edge Function `kiugi` (2026-10-08)

청취자가 닉네임을 적어 자기 키우기 캐릭터를 보고, 1~3등은 늘 보이는 공개 페이지. 사이트 주소 `BASE + 'k/<주소>'`(주소 = 서버가 만든 8자, `[a-hjkmnp-z2-9]`, 헷갈리는 i·l·o·0·1 없음).
올리는 쪽은 먼치킨(봇 프로그램) 본체 `app/desktop/kiugi-fanpage.cjs`(먼치킨 저장소). 그림은 먼치킨과 같은 `kiugi-art.js`(사이트 `docs/kiugi/`, 먼치킨 저장소 `node tools/sync-kiugi-site.mjs`로 복사).

- 서버: `https://aksegkhhugqvvaidgvro.supabase.co/functions/v1/kiugi/` — 코드 `supabase/functions/kiugi/`(index.ts = Supabase 연결, handler.ts = 요청 처리, lib.ts = 검사), 표 `supabase/kiugi.sql`(`kg_pages`).
- 저장하는 것: DJ 캐릭터(이름·모양 열쇠), 시즌(id·이름·끝나는 날), 청취자 닉네임(≤100자)·레벨(1~100)·애정도·입은 옷({칸: 옷 id}), 1~3등, 인원 수. 고유닉·jl-번호·스푼 번호·냥·출석은 받지 않는다. 3,000명·본문 1.5MB까지.
- 주소는 처음 올린 기기에 묶인다(같은 PC가 다시 올리면 같은 주소에 통째로 바꿔 넣음). `{enabled:false}`를 올리면 내용만 지우고 주소는 남긴다. 60일 동안 올리지 않으면 내용을 지운다. 승인 서버에서 차단·대기로 바꾼 기기의 페이지는 닫힌다. 심사용 기기는 올리지 못한다.

공개(로그인 없음, 주소 해시마다 횟수 제한):
- `GET page?slug=` (1분 60번) → `{slug,name,season:{id,name,endsAt}|null,paused,character,top:[{rank,nickname,level,love,worn}],count,updatedAt}` · 없으면 404, 닫혀 있으면 404 `{error,closed:true}`
- `GET find?slug=&q=` (1분 30번, q 1~40자, 띄어쓰기·대소문자 무시) → `{results:[{rank,nickname,level,love,worn}…5명까지, 정확히 같은 닉네임 먼저],exact,more}`
- `GET health` → `{service:"jun-live-kiugi",v:1}`

먼치킨(기기 서명, 기기 1분 2번):
- `POST app` 본문 `{action:"upload",payload,publicKey,timestamp,nonce,signature}`, 서명 문자열 `JUN-LIVE-KIUGI/1\n{action}\n{timestamp}\n{nonce}\n{publicKey}\n{sha256hex(JSON.stringify(payload))}` (ieee-p1363, base64url, 시간 ±60초, 같은 nonce 한 번).
  payload = 엔진 `GET /api/bot/f/kiugi/fanpage`의 답에서 `{enabled:true,v:1,paused,season,character,people:[{nickname,level,love,worn}]}` 또는 `{enabled:false}` → `{ok,enabled,slug,url,count}`

올리는 순서(배포 — 사용자 허락 뒤):
1. SQL: `supabase/kiugi.sql` 실행(마이그레이션 이름 `kiugi_pages`). 여러 번 실행해도 된다. 함께 쓰는 `junlive_devices`·`junlive_access_nonces`·`junlive_secrets`·`fp_hit`이 이미 있어야 한다(승인 서버·팬페이지 schema).
2. Edge Function `kiugi` 배포: 파일 `index.ts`·`handler.ts`·`lib.ts` 세 개, JWT 확인 끔(`verify_jwt: false`).
3. 확인: `GET …/kiugi/health` → `{"service":"jun-live-kiugi","v":1}`, `GET …/kiugi/page?slug=abcdefgh` → 404.
4. 사이트: 먼치킨 저장소에서 `node tools/sync-kiugi-site.mjs`(그림이 바뀔 때마다) → `node tools/deploy-site.cjs "키우기 페이지"`.
5. 먼치킨 새 버전(봇 프로그램)에 `desktop/kiugi-fanpage.cjs`가 들어가야 실제로 올라간다.