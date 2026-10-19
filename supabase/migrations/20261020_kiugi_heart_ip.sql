-- DJ 키우기 하트 — 같은 접속 주소(IP)는 한 캐릭터에 한국 날짜 하루 몇 번까지만 새 하트로 센다(2026-10-20, 1.0.0 점검 "하트 열쇠는 누구나 무한히 만들 수 있다").
-- 마이그레이션 이름 kiugi_heart_ip. kiugi.sql · kiugi-stage2.sql 다음에, 함수 kiugi 판 12 를 올리기 전에 실행한다. 여러 번 실행해도 된다.
--
-- 새 7칸 kg_heart(…, p_slots text[]):
--  · p_vote  = 브라우저 열쇠 투표(예전과 같음 — 하루·시즌·주소·캐릭터·브라우저마다 하나, sha256 hex 64자).
--  · p_slots = 함수가 만든 "주소 칸" 열쇠 n개(sha256 hex 64자 — 하루·시즌·주소·캐릭터·접속 주소 해시·칸 번호마다 하나, 지금 n = 3).
--    브라우저 열쇠가 오늘 처음이면 비어 있는 주소 칸 하나를 차지해야 +1. 칸이 모두 차 있으면 수는 그대로 already:true(조용히 — 브라우저 열쇠는 쓰지 않은 것으로 둔다).
--    p_slots 가 비어 있거나 null 이면 주소 제한 없이 예전처럼.
--  · 칸 열쇠도 kg_heart_votes 에 투표 열쇠와 같은 만료로 넣는다(따로 표를 만들지 않음 — 함수가 가끔 지우는 것도 그대로).
--  · 같은 브라우저 열쇠가 동시에 두 번 오면 둘 다 칸을 잡을 수 있지만, 투표 열쇠를 넣은 쪽만 +1 하고 다른 쪽은 잡은 칸을 돌려준다.
--
-- 예전 6칸 kg_heart(kiugi-stage2.sql)는 지우지 않는다: 이 SQL 을 실행하고 함수 판 12 를 올리기 전까지 판 11 이 계속 그것을 부른다.
--  (이름이 같아도 인자 이름이 달라 PostgREST 가 헷갈리지 않는다 — 새 함수의 p_slots 에 기본값을 주지 말 것.)
--  판 12 를 올려 하트가 되는 것을 확인한 뒤 정리 때: drop function if exists public.kg_heart(text, bigint, text, text, text, bigint);

create or replace function public.kg_heart(p_vote text, p_expires bigint, p_slug text, p_season text, p_pid text, p_now bigint, p_slots text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare n integer; s text; taken text := null;
begin
  -- 이 브라우저 열쇠는 오늘 이 캐릭터에 이미 보냈다
  if exists (select 1 from kg_heart_votes where key = p_vote) then
    select hearts into n from kg_hearts where slug = p_slug and season = p_season and pid = p_pid;
    return jsonb_build_object('hearts', coalesce(n, 0), 'already', true);
  end if;
  -- 같은 접속 주소의 칸: 빈 칸 하나를 차지한다. 모두 차 있으면 세지 않는다.
  if coalesce(cardinality(p_slots), 0) > 0 then
    foreach s in array p_slots loop
      insert into kg_heart_votes(key, expires) values (s, p_expires) on conflict (key) do nothing;
      if found then taken := s; exit; end if;
    end loop;
    if taken is null then
      select hearts into n from kg_hearts where slug = p_slug and season = p_season and pid = p_pid;
      return jsonb_build_object('hearts', coalesce(n, 0), 'already', true);
    end if;
  end if;
  insert into kg_heart_votes(key, expires) values (p_vote, p_expires) on conflict (key) do nothing;
  if not found then
    -- 같은 브라우저 열쇠가 동시에 먼저 들어갔다: 잡은 칸을 돌려준다
    if taken is not null then delete from kg_heart_votes where key = taken; end if;
    select hearts into n from kg_hearts where slug = p_slug and season = p_season and pid = p_pid;
    return jsonb_build_object('hearts', coalesce(n, 0), 'already', true);
  end if;
  insert into kg_hearts(slug, season, pid, hearts, updated) values (p_slug, p_season, p_pid, 1, p_now)
  on conflict (slug, season, pid) do update set hearts = kg_hearts.hearts + 1, updated = excluded.updated
  returning hearts into n;
  return jsonb_build_object('hearts', n, 'already', false);
end $$;
revoke execute on function public.kg_heart(text, bigint, text, text, text, bigint, text[]) from public, anon, authenticated;
grant execute on function public.kg_heart(text, bigint, text, text, text, bigint, text[]) to service_role;

notify pgrst, 'reload schema';

-- 확인(읽기만): 두 개가 보이고(6칸 · 7칸), anon 은 둘 다 실행할 수 없어야 한다(false).
-- select p.oid::regprocedure, has_function_privilege('anon', p.oid, 'execute') as anon_exec from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = 'kg_heart';
