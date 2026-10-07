-- DJ 키우기 팬페이지(Edge Function "kiugi", 2026-10-08). 여러 번 실행해도 된다.
-- 먼치킨(봇 프로그램)이 승인받은 기기 키로 서명해 한 페이지 분량을 통째로 바꾼다: DJ 캐릭터 + 청취자 닉네임·레벨·애정도·입은 옷.
-- 고유닉·jl-번호·스푼 번호·냥·출석은 없다. 페이지 주소(slug)는 처음 올린 기기에 묶인다(같은 PC가 다시 올리면 같은 주소).
-- 끄면(또는 60일 동안 올리지 않으면) 내용만 비운다(updated = null). 주소 묶음 줄은 남는다.
-- 표는 anon·authenticated 에 닫고 service_role(Edge Function)에만 연다. 이 프로젝트는 service_role 기본 권한이 없어 직접 준다.
create table if not exists public.kg_pages(
  slug text primary key check (slug ~ '^[a-hjkmnp-z2-9]{8}$'),
  device_id text not null unique check (device_id ~ '^[0-9a-f]{64}$'),
  created bigint not null,
  updated bigint,
  name text not null default '' check (length(name) <= 40),
  season jsonb,
  character jsonb,
  top jsonb not null default '[]'::jsonb,
  people jsonb not null default '[]'::jsonb,
  count integer not null default 0 check (count >= 0 and count <= 3000)
);
create index if not exists kg_pages_updated on public.kg_pages(updated) where updated is not null;
alter table public.kg_pages enable row level security;
revoke all on public.kg_pages from anon, authenticated;
grant select, insert, update, delete on public.kg_pages to service_role;

-- 함께 쓰는 것(승인 서버 schema 와 팬페이지 schema.sql 이 만든 것): 있을 때만 권한을 준다.
--  junlive_devices(기기 승인 상태 읽기) · junlive_access_nonces(같은 요청 두 번 막기, 지난 번호 청소) · junlive_secrets(주소 해시에 섞는 값) · fp_hit(횟수 제한)
do $$ begin
  if to_regclass('public.junlive_devices') is not null then grant select on public.junlive_devices to service_role; end if;
  if to_regclass('public.junlive_access_nonces') is not null then grant select, insert, delete on public.junlive_access_nonces to service_role; end if;
  if to_regclass('public.junlive_secrets') is not null then grant select on public.junlive_secrets to service_role; end if;
  if to_regprocedure('public.fp_hit(text,integer,integer)') is not null then grant execute on function public.fp_hit(text, integer, integer) to service_role; end if;
end $$;

notify pgrst, 'reload schema';
