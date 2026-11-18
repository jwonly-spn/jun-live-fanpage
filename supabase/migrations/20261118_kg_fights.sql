-- 보스전 보기(Edge Function "kiugi" 함수 v4, 2026-11-18 — 봇 저장소 docs/superpowers/specs/2026-11-18-bossview-design.md "서버").
-- 마이그레이션 이름 kg_fights. kiugi.sql · kiugi-stage2.sql 다음에, 함수 v4 를 올리기 전에 실행한다. 새 표만 더한다(있는 표는 바꾸지 않음). 여러 번 실행해도 된다.
--
-- 한 줄 = 한 판(보스 한 번): 먼치킨 본체(app/desktop/kiugi-fight.cjs)가 기기 키로 서명해 올린 것(handler.ts fightWrite)을 사이트(키우기.com)가 생중계로 읽는다.
--  · (device_id, live_key, k) 하나에 한 줄 — 같은 판을 다시 올리면 덮어쓴다. live_key = 봇이 sha256('kg-fight:' + 방송 번호) 16진 앞 32자로 보낸 것(방송 번호 원문은 없다).
--  · phase: 'join'(모집 중) · 'fight'(대본을 받음 — 끝 = end_at = 시작 + 90초) · 'drop'(DJ 가 "키우기 사이트에 올리기"를 끔 — 대본·땅을 비우고 줄은 expires 까지 남겨 그 판에 늦게 온 요청을 무시한다)
--  · boss = {type, name, aoe, stage} · joined = 참전 수 · script = 대본(FightScript v1 — 참전 이름은 키우기 아이디 또는 null, 닉네임·고유닉 없음) · land = 땅 결과
--  · 시각은 모두 서버 시계(밀리초): appear_at(나옴) · join_until(모집 마감) · start_at·end_at(싸움 화면 시작·끝) · updated(바꿀 때마다 커진다 — 겹친 요청 막기) · expires(지울 때)
--  · expires: 나온 뒤 15분(대본이 오지 않은 판) · 대본을 받으면 end_at + 10분. 함수가 보스전 요청 때 1% 로 지난 줄을 지운다.
-- 표는 anon·authenticated 에 닫고(RLS 켜고 정책 없음) service_role(Edge Function)에만 연다. 이 프로젝트는 service_role 기본 권한이 없어 직접 준다.

create table if not exists public.kg_fights(
  id text primary key check (id ~ '^[a-hjkmnp-z2-9]{12}$'),
  device_id text not null check (device_id ~ '^[0-9a-f]{64}$'),
  slug text not null references public.kg_pages(slug) on delete cascade,
  live_key text not null check (live_key ~ '^[0-9a-f]{32}$'),
  k integer not null check (k >= 0),
  phase text not null check (phase in ('join', 'fight', 'drop')),
  boss jsonb not null,
  join_until bigint not null,
  joined integer not null default 0 check (joined >= 0),
  script jsonb,
  land jsonb,
  appear_at bigint not null,
  start_at bigint,
  end_at bigint,
  updated bigint not null,
  expires bigint not null,
  unique (device_id, live_key, k)
);
create index if not exists kg_fights_expires on public.kg_fights(expires);

alter table public.kg_fights enable row level security;
revoke all on public.kg_fights from anon, authenticated;
grant select, insert, update, delete on public.kg_fights to service_role;

notify pgrst, 'reload schema';

-- 확인(읽기만): rls = true, anon_select = false, service_select = true
-- select c.relrowsecurity as rls, has_table_privilege('anon', 'public.kg_fights', 'select') as anon_select, has_table_privilege('service_role', 'public.kg_fights', 'select') as service_select from pg_class c where c.oid = 'public.kg_fights'::regclass;
