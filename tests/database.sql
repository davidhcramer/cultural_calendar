-- Run in the Supabase SQL Editor. All test rows are rolled back.
begin;
insert into auth.users(id,email) values
 ('50000000-0000-4000-8000-000000000001','calendar-test-owner@example.invalid'),
 ('50000000-0000-4000-8000-000000000002','calendar-test-outsider@example.invalid');
insert into public.calendar_members(email) values ('calendar-test-owner@example.invalid');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000001","email":"calendar-test-owner@example.invalid","role":"authenticated"}',true);
do $$
declare eid text; saved jsonb; conflict boolean:=false; rejected boolean:=false;
begin
  select payload->'calendar'->'events'->0->>'id' into eid from public.calendar_research where id='main';
  if eid is null then raise exception 'Member cannot read calendar'; end if;
  saved:=public.save_calendar_record('decision',eid,0,'{"status":"seen","notes":"planning","visit_notes":"visit reflection","visited_on":"2026-09-08"}');
  if saved->>'version' <> '1' then raise exception 'First save version wrong'; end if;
  saved:=public.save_calendar_record('decision',eid,1,'{"status":"seen","notes":"updated","visit_notes":"visit reflection"}');
  if saved->>'version' <> '2' then raise exception 'Second save version wrong'; end if;
  begin perform public.save_calendar_record('decision',eid,1,'{"status":"pass","notes":"stale overwrite"}');
    exception when serialization_failure then conflict:=true; end;
  if not conflict then raise exception 'Stale write was accepted'; end if;
  if (select payload->>'notes' from public.calendar_decisions where event_id=eid) <> 'updated' then raise exception 'Stale write lost data'; end if;
  saved:=public.save_calendar_record('artist','test-artist',0,'{"name":"Test artist","url":"https://example.org","notes":"Follow prints","following":true}');
  if saved->>'version'<>'1' then raise exception 'Artist save failed'; end if;
  begin perform public.save_calendar_record('artist','bad-artist',0,'{"name":"Bad","url":"javascript:alert(1)","notes":"","following":true}');
    exception when raise_exception then rejected:=true; end;
  if not rejected then raise exception 'Unsafe artist URL accepted'; end if;
  if has_table_privilege('authenticated','public.calendar_decisions','INSERT') then raise exception 'Direct personal writes allowed'; end if;
  if has_function_privilege('authenticated','public.publish_calendar_research(jsonb,bigint)','EXECUTE') then raise exception 'Browser can publish research'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000002","email":"calendar-test-outsider@example.invalid","role":"authenticated"}',true);
do $$
declare rejected boolean:=false;
begin
  if exists(select 1 from public.calendar_research) then raise exception 'Outsider can read research'; end if;
  if exists(select 1 from public.calendar_decisions) or exists(select 1 from public.calendar_artists) then raise exception 'Outsider can read personal data'; end if;
  begin perform public.save_calendar_record('artist','unauthorized',0,'{"name":"Outsider","url":"","notes":"","following":true}');
    exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Outsider can write'; end if;
end $$;
reset role;
do $$ begin
  if has_table_privilege('anon','public.calendar_research','SELECT') or has_function_privilege('anon','public.save_calendar_record(text,text,bigint,jsonb)','EXECUTE') then raise exception 'Anonymous data access allowed'; end if;
end $$;
rollback;
select 'PASS: member access, notes, artists, stale-write rejection, outsider isolation, anonymous denial and research permissions' as result;
