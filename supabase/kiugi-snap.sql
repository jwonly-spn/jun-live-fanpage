-- DJ 키우기 미리 만든 답(2026-10-18 "사이트 반응 빠르게"): 함수 kiugi 가 메인(home.json)·DJ 페이지(page/<slug>.json) 답을 이 공개 버킷에 덮어쓰고,
-- 사이트(키우기.com)는 이 파일을 먼저 읽는다(함수가 깨어나는 1~2초 없이). 내용은 함수의 공개 답과 같다(아이디·레벨·입은 옷·하트 수 — 닉네임 없음).
-- 쓰기는 함수의 service role 만(RLS 를 건너뜀). 읽기는 공개 주소(/storage/v1/object/public/kg-snap/…)로만 — 목록 보기 정책은 만들지 않는다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kg-snap', 'kg-snap', true, 1048576, array['application/json'])
on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = array['application/json'];
