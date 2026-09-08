begin;

-- Only the account explicitly admitted by the owner can use this calendar.
create table if not exists public.calendar_members (email text primary key check (email = lower(email)));
alter table public.calendar_members enable row level security;
revoke all on public.calendar_members from anon, authenticated;

create or replace function public.is_calendar_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.calendar_members where email = lower(auth.jwt()->>'email'))
    and auth.uid() is not null;
$$;
revoke all on function public.is_calendar_member() from public, anon;
grant execute on function public.is_calendar_member() to authenticated;

create table if not exists public.calendar_research (
  id text primary key check (id = 'main'),
  payload jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.calendar_research enable row level security;
create policy research_read on public.calendar_research for select to authenticated using (public.is_calendar_member());
revoke all on public.calendar_research from anon, authenticated;
grant select on public.calendar_research to authenticated;

create table if not exists public.calendar_decisions (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null,
  payload jsonb not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key(user_id,event_id)
);
create table if not exists public.calendar_artists (
  user_id uuid not null references auth.users(id) on delete cascade,
  artist_id text not null,
  payload jsonb not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key(user_id,artist_id)
);
alter table public.calendar_decisions enable row level security;
alter table public.calendar_artists enable row level security;
create policy decisions_read on public.calendar_decisions for select to authenticated
  using (user_id = (select auth.uid()) and public.is_calendar_member());
create policy artists_read on public.calendar_artists for select to authenticated
  using (user_id = (select auth.uid()) and public.is_calendar_member());
revoke all on public.calendar_decisions, public.calendar_artists from anon, authenticated;
grant select on public.calendar_decisions, public.calendar_artists to authenticated;

-- All personal writes compare the version read by this device with the current version.
-- The transaction advisory lock covers new rows as well as updates.
create or replace function public.save_calendar_record(record_kind text, record_id text, expected_version bigint, new_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  table_name text;
  id_column text;
  current_row record;
  saved jsonb;
begin
  if not public.is_calendar_member() then raise exception 'Not authorized' using errcode='42501'; end if;
  if record_id is null or length(record_id) not between 1 and 250 or expected_version is null or expected_version < 0 then
    raise exception 'Invalid record identity';
  end if;
  if jsonb_typeof(new_payload) is distinct from 'object' or octet_length(new_payload::text) > 200000 then
    raise exception 'Invalid record payload';
  end if;
  if record_kind = 'decision' then
    table_name := 'calendar_decisions'; id_column := 'event_id';
    if coalesce(new_payload->>'status','') not in ('unreviewed','considering','will_book_need_date','booked','seen','would_go_but_cant','pass')
      or jsonb_typeof(new_payload->'notes') is distinct from 'string'
      or (new_payload ? 'visit_notes' and jsonb_typeof(new_payload->'visit_notes') is distinct from 'string') then
      raise exception 'Invalid decision';
    end if;
    if coalesce(new_payload->>'visited_on','') <> '' then
      if (new_payload->>'visited_on') !~ '^\d{4}-\d{2}-\d{2}$' or (new_payload->>'visited_on')::date > current_date then
        raise exception 'Invalid attendance date';
      end if;
    end if;
    if not exists(select 1 from public.calendar_research r, jsonb_array_elements(r.payload->'calendar'->'events') e where e->>'id'=record_id) then
      raise exception 'Unknown event';
    end if;
  elsif record_kind = 'artist' then
    table_name := 'calendar_artists'; id_column := 'artist_id';
    if jsonb_typeof(new_payload->'name') is distinct from 'string' or length(trim(new_payload->>'name')) not between 1 and 200
      or jsonb_typeof(new_payload->'following') is distinct from 'boolean'
      or jsonb_typeof(new_payload->'notes') is distinct from 'string'
      or jsonb_typeof(new_payload->'url') is distinct from 'string'
      or (coalesce(new_payload->>'url','') <> '' and (new_payload->>'url') !~ '^https?://[^ /]+') then
      raise exception 'Invalid artist';
    end if;
  else raise exception 'Invalid record kind'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text || ':' || record_kind || ':' || record_id,0));
  execute format('select version from public.%I where user_id=$1 and %I=$2',table_name,id_column)
    into current_row using actor,record_id;
  if coalesce(current_row.version,0) <> expected_version then
    raise exception 'This record changed on another device. Your draft has been kept.' using errcode='40001';
  end if;
  execute format('insert into public.%I(user_id,%I,payload,version) values($1,$2,$3,1)
    on conflict(user_id,%I) do update set payload=excluded.payload,version=%I.version+1,updated_at=now()
    returning jsonb_build_object(''payload'',payload,''version'',version,''updated_at'',updated_at)',table_name,id_column,id_column,table_name)
    into saved using actor,record_id,new_payload;
  return saved;
end;
$$;
revoke all on function public.save_calendar_record(text,text,bigint,jsonb) from public, anon;
grant execute on function public.save_calendar_record(text,text,bigint,jsonb) to authenticated;

-- This publishing function leaves personal tables untouched.
create or replace function public.publish_calendar_research(new_payload jsonb, expected_revision bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare current_revision bigint; next_revision bigint;
begin
  if jsonb_typeof(new_payload->'calendar'->'events') is distinct from 'array' then raise exception 'Missing events'; end if;
  perform pg_advisory_xact_lock(724620260908);
  select revision into current_revision from public.calendar_research where id='main';
  if coalesce(current_revision,0) <> expected_revision then raise exception 'Research changed since download' using errcode='40001'; end if;
  if exists(select 1 from public.calendar_research r, jsonb_array_elements(r.payload->'calendar'->'events') e
    where not exists(select 1 from jsonb_array_elements(new_payload->'calendar'->'events') n where n->>'id'=e->>'id')) then
    raise exception 'Research update would remove existing event IDs';
  end if;
  insert into public.calendar_research(id,payload,revision) values('main',new_payload,1)
    on conflict(id) do update set payload=excluded.payload,revision=calendar_research.revision+1,updated_at=now()
    returning revision into next_revision;
  return next_revision;
end;
$$;
revoke all on function public.publish_calendar_research(jsonb,bigint) from public,anon,authenticated;
grant execute on function public.publish_calendar_research(jsonb,bigint) to service_role;
commit;
