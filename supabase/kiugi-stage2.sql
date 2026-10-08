-- DJ 키우기 2단계(Edge Function "kiugi", 2026-10-08). 마이그레이션 이름 kiugi_stage2. kiugi.sql 다음에 실행한다. 여러 번 실행해도 된다.
--  · 캐릭터 이름은 사이트 전체에서 하나만(name_key = NFC + 영문 소문자, 먼저 쓴 방송이 가진다)
--  · 메인 페이지에 보일지(main, 없으면 true)
--  · 메인 페이지 요약(summary = 새로 꾸민 8명·옷마다 입은 수 — 올릴 때 서버가 만든다)
--  · 마지막으로 무엇이든 올린 때(seen, 끈 것 포함 — 60일 지나면 내용·이름 열쇠·하트를 지운다)
--  · 하트(kg_hearts: 페이지·시즌·아이디마다 수, kg_heart_votes: 하루 한 번 막는 열쇠, 함수 kg_heart: 한 번에 +1)
-- 표는 anon·authenticated 에 닫고(RLS 켜고 정책 없음) service_role(Edge Function)에만 연다. 이 프로젝트는 service_role 기본 권한이 없어 직접 준다.

alter table public.kg_pages add column if not exists name_key text;
alter table public.kg_pages add column if not exists main boolean not null default true;
alter table public.kg_pages add column if not exists summary jsonb not null default '{}'::jsonb;
alter table public.kg_pages add column if not exists seen bigint;
-- 이미 있는 줄: 마지막으로 올린 때를 지금 아는 값으로 채운다
update public.kg_pages set seen = coalesce(updated, created) where seen is null;
-- 캐릭터 이름 열쇠는 하나만(비어 있는 줄은 여럿이어도 됨)
create unique index if not exists kg_pages_name_key on public.kg_pages(name_key);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kg_pages_name_key_len') then
    alter table public.kg_pages add constraint kg_pages_name_key_len check (name_key is null or length(name_key) between 1 and 8);
  end if;
end $$;
create index if not exists kg_pages_seen on public.kg_pages(seen);

create table if not exists public.kg_hearts(
  slug text not null references public.kg_pages(slug) on delete cascade,
  season text not null check (season ~ '^[a-z0-9][a-z0-9_-]{0,23}$'),
  pid text not null check (length(pid) between 3 and 20),
  hearts integer not null default 0 check (hearts >= 0),
  updated bigint not null default 0,
  primary key (slug, season, pid)
);
create index if not exists kg_hearts_top on public.kg_hearts(hearts desc) where hearts > 0;

create table if not exists public.kg_heart_votes(
  key text primary key check (key ~ '^[0-9a-f]{64}$'),
  expires bigint not null
);
create index if not exists kg_heart_votes_expires on public.kg_heart_votes(expires);

alter table public.kg_hearts enable row level security;
alter table public.kg_heart_votes enable row level security;
revoke all on public.kg_hearts from anon, authenticated;
revoke all on public.kg_heart_votes from anon, authenticated;
grant select, insert, update, delete on public.kg_hearts to service_role;
grant select, insert, update, delete on public.kg_heart_votes to service_role;

-- 하트 한 번: 투표 열쇠(하루·시즌·캐릭터·브라우저마다 하나)가 처음이면 그 캐릭터 하트 +1, 이미 있으면 그대로.
-- 둘을 한 번에 해서 동시에 눌러도 두 번 세지 않는다. 돌려주는 것 {hearts, already}.
create or replace function public.kg_heart(p_vote text, p_expires bigint, p_slug text, p_season text, p_pid text, p_now bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into kg_heart_votes(key, expires) values (p_vote, p_expires) on conflict (key) do nothing;
  if not found then
    select hearts into n from kg_hearts where slug = p_slug and season = p_season and pid = p_pid;
    return jsonb_build_object('hearts', coalesce(n, 0), 'already', true);
  end if;
  insert into kg_hearts(slug, season, pid, hearts, updated) values (p_slug, p_season, p_pid, 1, p_now)
  on conflict (slug, season, pid) do update set hearts = kg_hearts.hearts + 1, updated = excluded.updated
  returning hearts into n;
  return jsonb_build_object('hearts', n, 'already', false);
end $$;
revoke execute on function public.kg_heart(text, bigint, text, text, text, bigint) from public, anon, authenticated;
grant execute on function public.kg_heart(text, bigint, text, text, text, bigint) to service_role;

notify pgrst, 'reload schema';
