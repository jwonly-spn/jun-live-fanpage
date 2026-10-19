# 운영 절차 — DJ 키우기 서버(kiugi)

운영자(사용 승인 관리 화면을 쓰는 사람)와 Claude 가 보는 짧은 절차서예요. SQL 은 Supabase 대시보드의 SQL Editor(서비스 권한)에서 실행해요. 값은 `<…>` 를 바꿔 넣어요.

## 1. 캐릭터 이름이 다른 PC 에 묶여 409 가 날 때 (PC 교체·윈도우 재설치·"이 PC 로 다시 등록")

증상: 먼치킨 키우기 화면에 "이 캐릭터 이름은 다른 방송이 이미 쓰고 있어요. 먼치킨에서 캐릭터 이름을 바꿔 주세요." — 그런데 그 이름은 그 DJ 가 예전 PC 에서 쓰던 것.

### 먼저 확인 (읽기만)
```sql
select slug, device_id, name_key, updated, seen, count from public.kg_pages where name_key = '<캐릭터 이름 — 영문은 소문자>';
```
```sql
select id, state, review, tag from public.junlive_devices where id in ('<위에서 나온 device_id>', '<새 PC 의 device_id — 관리 화면에서 확인>');
```
- 함수 판 12 부터는 두 기기의 `tag`(등록할 때 적힌 스푼 고유닉)가 같으면 새 PC 의 다음 올리기에서 저절로 넘어가요(같은 DJ).
- `tag` 가 다르거나 비어 있고, 예전 PC 가 `approved` 이면 409 그대로예요(꺼 둔 것만으로는 넘어가지 않아요 — "끄기는 이름을 지킨다").

### 풀어 주기 — 함수 판 12 부터 (SQL 없이)
1. 그 DJ 에게 예전 PC 가 맞는지 확인해요(스푼 계정·디스코드로 — 남의 이름을 뺏지 않게).
2. 사용 승인 관리 화면에서 **예전 PC(위 device_id) 를 차단**해요.
3. 새 PC 의 먼치킨이 다음에 올릴 때(실패 뒤 1분 → 2분 → … 최대 30분 간격, 키우기 화면의 "지금 올리기"를 누르면 바로) 이름을 넘겨받아요.
   - 예전 페이지는 내용·이름·하트를 비우고 닫혀요(예전 주소 `k/<예전 주소>` 는 "닫아 두었어요"). 새 PC 는 **새 주소**를 받아요 — 청취자에게 새 주소를 다시 알려 주세요.

### 풀어 주기 — SQL 한 줄 (함수 판 11 이하이거나 바로 풀어야 할 때)
예전 페이지의 내용·이름 열쇠를 비우고 그 페이지 하트 줄도 지워요(주소 묶음 줄은 남아요 — 예전 PC 가 다시 켜면 같은 주소로 빈 페이지부터).
```sql
with p as (update public.kg_pages set updated = null, name = '', season = null, character = null, top = '[]'::jsonb, people = '[]'::jsonb, count = 0, summary = '{}'::jsonb, name_key = null where slug = '<예전 주소 8자>' returning slug) delete from public.kg_hearts h using p where h.slug = p.slug;
```
- 실행 뒤 위 "먼저 확인" 첫 줄을 다시 돌려 아무 줄도 안 나오면 풀린 거예요.
- SQL 로 풀면 미리 만든 답 `kg-snap/page/<예전 주소>.json` 은 그대로 남아요 → 사이트가 최대 10분 동안 예전 내용을 보여 줄 수 있어요(10분 지난 파일은 쓰지 않고 서버에 물어 "닫아 두었어요"가 나와요).

## 2. 하트를 누군가 몰아 보낸 것 같을 때
- 함수 판 12 부터 같은 접속 주소(IP)는 한 캐릭터에 한국 날짜 하루 3번까지만 새 하트로 세요(넘으면 조용히 "이미 보냈어요"). 같은 주소에서 1시간 60번 · 브라우저 열쇠마다 하루 50번 한도는 그대로예요.
- 이동통신 주소를 계속 바꾸거나 기기가 여러 대면 여전히 더 보낼 수 있어요(더 막으려면 Cloudflare Turnstile 같은 사람 확인 — 결정 필요).
- 하트 줄 보기(읽기만):
```sql
select slug, season, pid, hearts, updated from public.kg_hearts order by hearts desc limit 20;
```
