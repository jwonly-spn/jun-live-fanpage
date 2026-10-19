-- 옛 Codex 팬페이지(이 저장소에 정의가 없는 가장 옛 판)의 SECURITY DEFINER 함수 14개 — 익명(anon)·로그인(authenticated)·모두(public)의 실행 권한을 거둔다.
-- 2026-10-20, 1.0.0 점검(Supabase 보안 권고 WARN 22건: 공개 키만 있으면 /rest/v1/rpc/<이름> 으로 누구나 부를 수 있었다).
-- 마이그레이션 이름 revoke_legacy_definer. 여러 번 실행해도 된다(없는 함수는 건너뛴다 · 이미 거둔 권한을 다시 거둬도 오류가 아니다).
--
-- 하는 것: 아래 이름의 public 함수(인자 모양이 무엇이든 — 같은 이름이 여럿이면 모두)에서 EXECUTE 를 public · anon · authenticated 로부터 거둔다.
-- 하지 않는 것: 함수·표를 지우지 않는다(옛 표 fanpages·published_pages·entries·guest_messages·photo_reservations·junlive_pairings·pair_attempts·junlive_memberships,
--  fp_*·jl_*·cb_* 정리와 cloudbot 함수 삭제는 사용자 허락 뒤 — 1.0.0 계획 결정 13). service_role 권한은 건드리지 않는다(쓰는 곳이 없다).
-- 지금 쓰는 함수(kg_heart · fp_hit · junlive_device_check 등)는 이름 목록에 없어 그대로다.

do $$
declare
  r record;
  done integer := 0;
  names text[] := array[
    -- anon 이 부를 수 있던 것
    'start_junlive_pairing', 'complete_junlive_pairing', 'has_junlive_access', 'owns_fanpage', 'owns_photo', 'photo_referenced', 'public_menu', 'public_photo',
    -- authenticated 가 부를 수 있던 것
    'approve_junlive_pairing', 'publish_fanpage', 'release_photo', 'reserve_photo', 'unpublish_fanpage', 'unused_photos'
  ];
begin
  for r in
    select n.nspname as schema_name, p.proname as fn, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (names) and p.prokind = 'f'
  loop
    execute format('revoke execute on function %I.%I(%s) from public, anon, authenticated', r.schema_name, r.fn, r.args);
    done := done + 1;
  end loop;
  raise notice '실행 권한을 거둔 옛 함수: %개(이름 목록 %개)', done, cardinality(names);
end $$;

notify pgrst, 'reload schema';

-- 확인(읽기만): 모든 줄이 anon_exec = false · auth_exec = false 여야 한다(줄 수 = 실제로 있던 함수 수, 권고 기준 14).
-- select p.oid::regprocedure as fn, p.prosecdef as definer, has_function_privilege('anon', p.oid, 'execute') as anon_exec, has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname in ('start_junlive_pairing','complete_junlive_pairing','has_junlive_access','owns_fanpage','owns_photo','photo_referenced','public_menu','public_photo',
--   'approve_junlive_pairing','publish_fanpage','release_photo','reserve_photo','unpublish_fanpage','unused_photos') order by 1;
-- 그다음 Supabase 보안 권고(Advisors → Security)에서 "Function … executable by anon/authenticated" 류 경고가 이 14개만큼 줄었는지 본다.
