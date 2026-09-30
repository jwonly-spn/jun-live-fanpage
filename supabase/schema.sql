-- JUN LIVE 팬페이지 (all DJs). Everything goes through the Edge Function
-- "fanpage" with the service role; anon/authenticated get nothing.
-- gen_random_uuid() is built into Postgres 13+.

create table if not exists public.fp_pages(
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'),
  draft jsonb not null,
  published jsonb,
  revision integer not null default 0,
  published_at timestamptz,
  blocked boolean not null default false,
  spoon jsonb not null default '{}'::jsonb,
  photo_bytes bigint not null default 0,
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);
-- One page per JUN LIVE device (the approved device key is the DJ's identity).
create table if not exists public.fp_page_devices(
  device_id text primary key check (device_id ~ '^[0-9a-f]{64}$'),
  page_id uuid not null references public.fp_pages(id) on delete cascade,
  created timestamptz not null default now()
);
create index if not exists fp_page_devices_page on public.fp_page_devices(page_id);
create table if not exists public.fp_codes(
  code_hash text primary key, device_id text not null, spoon jsonb not null, expires timestamptz not null, used boolean not null default false
);
create table if not exists public.fp_sessions(
  token_hash text primary key, device_id text not null, spoon jsonb not null, expires timestamptz not null, created timestamptz not null default now()
);
create index if not exists fp_sessions_device on public.fp_sessions(device_id);
create table if not exists public.fp_live(
  page_id uuid primary key references public.fp_pages(id) on delete cascade,
  on_air boolean not null default false, title text not null default '', rankings jsonb, updated timestamptz not null default now()
);
create table if not exists public.fp_posts(
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.fp_pages(id) on delete cascade,
  menu_id text not null,
  title text not null default '', body text not null default '',
  photos jsonb not null default '[]'::jsonb,
  category text not null default '', pinned boolean not null default false,
  supporter text not null default '', event_date date,
  likes integer not null default 0, comment_count integer not null default 0,
  created timestamptz not null default now(), updated timestamptz not null default now()
);
create index if not exists fp_posts_menu on public.fp_posts(page_id, menu_id, created desc);
create table if not exists public.fp_photos(
  path text primary key, page_id uuid not null references public.fp_pages(id) on delete cascade, bytes integer not null, created timestamptz not null default now()
);
create index if not exists fp_photos_page on public.fp_photos(page_id, created);
create table if not exists public.fp_likes(
  post_id uuid not null references public.fp_posts(id) on delete cascade, fan text not null, primary key(post_id, fan)
);
create table if not exists public.fp_comments(
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.fp_pages(id) on delete cascade,
  menu_id text not null,
  post_id uuid references public.fp_posts(id) on delete cascade,
  nickname text not null, body text not null, ip_hash text not null default '', fan text not null default '',
  hearted boolean not null default false, reply text, replied_at timestamptz, hidden boolean not null default false,
  created timestamptz not null default now()
);
create index if not exists fp_comments_page on public.fp_comments(page_id, created desc);
create index if not exists fp_comments_post on public.fp_comments(post_id, created desc);
create table if not exists public.fp_blocks(page_id uuid not null references public.fp_pages(id) on delete cascade, key text not null, created timestamptz not null default now(), primary key(page_id, key));
create table if not exists public.fp_cards(
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.fp_pages(id) on delete cascade,
  menu_id text not null, nickname text not null, pin_hash text not null,
  fails integer not null default 0, locked_until timestamptz, created timestamptz not null default now(),
  unique(page_id, menu_id, nickname)
);
create table if not exists public.fp_stamps(card_id uuid not null references public.fp_cards(id) on delete cascade, day date not null, primary key(card_id, day));
create table if not exists public.fp_polls(
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.fp_pages(id) on delete cascade,
  menu_id text not null, question text not null, description text not null default '', options jsonb not null,
  closed boolean not null default false, created timestamptz not null default now()
);
create index if not exists fp_polls_menu on public.fp_polls(page_id, menu_id, created desc);
create table if not exists public.fp_votes(poll_id uuid not null references public.fp_polls(id) on delete cascade, fan text not null, option integer not null, ip_hash text not null default '', primary key(poll_id, fan));
create table if not exists public.fp_limits(key text primary key, count integer not null, expires timestamptz not null);

do $$ declare t text; begin
  foreach t in array array['fp_pages','fp_page_devices','fp_codes','fp_sessions','fp_live','fp_posts','fp_photos','fp_likes','fp_comments','fp_blocks','fp_cards','fp_stamps','fp_polls','fp_votes','fp_limits'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;
-- The app login reuses the approval server's device list and nonce table (when present).
do $$ begin
  if to_regclass('public.junlive_access_nonces') is not null then grant select, insert on public.junlive_access_nonces to service_role; end if;
  if to_regclass('public.junlive_devices') is not null then grant select on public.junlive_devices to service_role; end if;
end $$;

-- Keeps comment counts on posts.
create or replace function public.fp_comment_count() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.post_id is not null then update fp_posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' and old.post_id is not null then update fp_posts set comment_count = greatest(0, comment_count - 1) where id = old.post_id;
  end if;
  return null;
end $$;
drop trigger if exists fp_comment_count on public.fp_comments;
create trigger fp_comment_count after insert or delete on public.fp_comments for each row execute function public.fp_comment_count();

-- Counter for a window; true while under the limit.
create or replace function public.fp_hit(p_key text, p_seconds integer, p_max integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare v integer; w bigint := floor(extract(epoch from now()) / p_seconds);
begin
  insert into fp_limits(key, count, expires) values (p_key || ':' || w, 1, now() + make_interval(secs => p_seconds * 2))
  on conflict (key) do update set count = fp_limits.count + 1 returning count into v;
  if random() < 0.02 then delete from fp_limits where key in (select key from fp_limits where expires < now() limit 500); end if;
  return v <= p_max;
end $$;

create or replace function public.fp_like(p_post uuid, p_fan text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n integer; liked boolean;
begin
  delete from fp_likes where post_id = p_post and fan = p_fan;
  get diagnostics n = row_count;
  if n = 0 then insert into fp_likes(post_id, fan) values (p_post, p_fan); liked := true; else liked := false; end if;
  update fp_posts set likes = greatest(0, likes + case when liked then 1 else -1 end) where id = p_post returning likes into n;
  return jsonb_build_object('likes', n, 'liked', liked);
end $$;

-- Saves the draft only if nobody saved in between.
create or replace function public.fp_save_draft(p_page uuid, p_draft jsonb, p_revision integer)
returns integer language plpgsql security definer set search_path = public as $$
declare r integer;
begin
  update fp_pages set draft = p_draft, revision = revision + 1, updated = now() where id = p_page and revision = p_revision returning revision into r;
  return r;
end $$;

-- Attendance card: create / load / check (today, Korea time). 5 wrong PINs lock the card for 10 minutes.
create or replace function public.fp_attendance(p_page uuid, p_menu text, p_nickname text, p_pin_hash text, p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c fp_cards; today date := (now() at time zone 'Asia/Seoul')::date;
begin
  select * into c from fp_cards where page_id = p_page and menu_id = p_menu and nickname = p_nickname for update;
  if p_action = 'create' then
    if found then return jsonb_build_object('error', 'exists'); end if;
    insert into fp_cards(page_id, menu_id, nickname, pin_hash) values (p_page, p_menu, p_nickname, p_pin_hash) returning * into c;
  else
    if not found then return jsonb_build_object('error', 'missing'); end if;
    if c.locked_until is not null and c.locked_until > now() then return jsonb_build_object('error', 'locked'); end if;
    -- A lock that has run out starts counting again from zero (one wrong PIN must not re-lock it).
    if c.locked_until is not null then update fp_cards set fails = 0, locked_until = null where id = c.id; c.fails := 0; end if;
    if c.pin_hash <> p_pin_hash then
      update fp_cards set fails = fails + 1, locked_until = case when fails + 1 >= 5 then now() + interval '10 minutes' else null end where id = c.id;
      return jsonb_build_object('error', 'pin');
    end if;
    if c.fails > 0 then update fp_cards set fails = 0, locked_until = null where id = c.id; end if;
    if p_action = 'check' then insert into fp_stamps(card_id, day) values (c.id, today) on conflict do nothing; end if;
  end if;
  return jsonb_build_object(
    'nickname', c.nickname,
    'total', (select count(*) from fp_stamps where card_id = c.id),
    'today', exists(select 1 from fp_stamps where card_id = c.id and day = today),
    'month', coalesce((select jsonb_agg(to_char(day, 'YYYY-MM-DD') order by day) from fp_stamps where card_id = c.id and date_trunc('month', day) = date_trunc('month', today)), '[]'::jsonb));
end $$;

create or replace function public.fp_vote(p_poll uuid, p_fan text, p_option integer, p_ip text)
returns boolean language plpgsql security definer set search_path = public as $$
declare p fp_polls;
begin
  select * into p from fp_polls where id = p_poll;
  if not found or p.closed or p_option < 0 or p_option >= jsonb_array_length(p.options) then return false; end if;
  -- New voters: at most 3 per poll from one address (households share addresses; bots do not get 20).
  if coalesce(p_ip, '') <> '' and not exists(select 1 from fp_votes where poll_id = p_poll and fan = p_fan)
     and (select count(*) from fp_votes where poll_id = p_poll and ip_hash = p_ip) >= 3 then return false; end if;
  insert into fp_votes(poll_id, fan, option, ip_hash) values (p_poll, p_fan, p_option, p_ip)
  on conflict (poll_id, fan) do update set option = excluded.option;
  return true;
end $$;

create or replace function public.fp_poll_view(p_poll uuid, p_fan text)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'question', p.question, 'description', p.description, 'closed', p.closed,
    'options', (select jsonb_agg(jsonb_build_object('label', o.value, 'votes', (select count(*) from fp_votes v where v.poll_id = p.id and v.option = o.ord - 1)) order by o.ord) from jsonb_array_elements_text(p.options) with ordinality o(value, ord)),
    'total', (select count(*) from fp_votes v where v.poll_id = p.id),
    'voted', (select v.option from fp_votes v where v.poll_id = p.id and v.fan = p_fan))
  from fp_polls p where p.id = p_poll
$$;

-- Reserves (or frees, with a negative size) photo bytes in one step:
-- 'ok', 'page' (this page is full) or 'total' (the service is full).
create or replace function public.fp_add_bytes(p_page uuid, p_bytes bigint, p_quota bigint, p_total bigint)
returns text language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if p_bytes <= 0 then update fp_pages set photo_bytes = greatest(0, photo_bytes + p_bytes) where id = p_page; return 'ok'; end if;
  perform pg_advisory_xact_lock(hashtext('fp_add_bytes'));
  if (select coalesce(sum(photo_bytes), 0) from fp_pages) + p_bytes > p_total then return 'total'; end if;
  update fp_pages set photo_bytes = photo_bytes + p_bytes where id = p_page and photo_bytes + p_bytes <= p_quota;
  get diagnostics n = row_count;
  return case when n = 1 then 'ok' else 'page' end;
end $$;

-- Photos of a page that nothing uses any more (older than a day, so uploads in progress stay).
create or replace function public.fp_orphan_photos(p_page uuid)
returns setof text language sql security definer set search_path = public as $$
  with used as (
    select jsonb_array_elements(photos) ph from fp_posts where page_id = p_page
    union all select draft->'profile'->'avatar' from fp_pages where id = p_page
    union all select draft->'profile'->'cover' from fp_pages where id = p_page
    union all select published->'profile'->'avatar' from fp_pages where id = p_page
    union all select published->'profile'->'cover' from fp_pages where id = p_page
  ), paths as (select ph->>'path' p from used union select ph->>'thumb' from used)
  select f.path from fp_photos f where f.page_id = p_page and f.created < now() - interval '1 day' and f.path not in (select p from paths where p is not null)
$$;

do $$ declare f text; begin
  foreach f in array array['fp_comment_count()','fp_hit(text,integer,integer)','fp_like(uuid,text)','fp_save_draft(uuid,jsonb,integer)','fp_attendance(uuid,text,text,text,text)','fp_vote(uuid,text,integer,text)','fp_poll_view(uuid,text)','fp_orphan_photos(uuid)','fp_add_bytes(uuid,bigint,bigint,bigint)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- Secret salt for visitor-address fingerprints (read by the function with the service role only).
create table if not exists public.junlive_secrets (key text primary key, value text not null);
alter table public.junlive_secrets enable row level security;
revoke all on public.junlive_secrets from anon, authenticated;
grant select on public.junlive_secrets to service_role;
insert into public.junlive_secrets(key, value) values ('ip_salt', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')) on conflict (key) do nothing;

-- 사연함(2026-09-30): DJ가 열어 두면 팬이 글·사진을 보낸다. 7일 뒤 자동 삭제.
create table if not exists public.fp_storybox(
  page_id uuid primary key references public.fp_pages(id) on delete cascade,
  open boolean not null default false, note text not null default '', updated timestamptz not null default now()
);
create table if not exists public.fp_stories(
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.fp_pages(id) on delete cascade,
  nickname text not null, tag text not null default '', body text not null default '',
  photo jsonb, ip_hash text not null default '', fan text not null default '',
  created timestamptz not null default now()
);
create index if not exists fp_stories_page on public.fp_stories(page_id, created desc);
do $$ declare t text; begin
  foreach t in array array['fp_storybox','fp_stories'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;
-- 사연 사진도 "쓰는 중"으로 본다(하루 뒤 고아 사진 정리에서 빠지지 않게).
create or replace function public.fp_orphan_photos(p_page uuid)
returns setof text language sql security definer set search_path = public as $$
  with used as (
    select jsonb_array_elements(photos) ph from fp_posts where page_id = p_page
    union all select photo from fp_stories where page_id = p_page and photo is not null
    union all select draft->'profile'->'avatar' from fp_pages where id = p_page
    union all select draft->'profile'->'cover' from fp_pages where id = p_page
    union all select published->'profile'->'avatar' from fp_pages where id = p_page
    union all select published->'profile'->'cover' from fp_pages where id = p_page
  ), paths as (select ph->>'path' p from used union select ph->>'thumb' from used)
  select f.path from fp_photos f where f.page_id = p_page and f.created < now() - interval '1 day' and f.path not in (select p from paths where p is not null)
$$;
revoke execute on function public.fp_orphan_photos(uuid) from public, anon, authenticated;
grant execute on function public.fp_orphan_photos(uuid) to service_role;
