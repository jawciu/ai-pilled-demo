begin;
create table if not exists public.match_reviews (
  event_id uuid not null references public.events(id),
  requester_id uuid not null references public.participants(id),
  helper_id uuid not null references public.participants(id),
  requester_version integer not null,
  helper_version integer not null,
  revision integer not null default 2,
  status text not null check (status in ('processing','ready','failed')),
  lease_id uuid not null default gen_random_uuid(),
  lease_until timestamptz not null default now() + interval '90 seconds',
  decision jsonb,
  updated_at timestamptz not null default now(),
  primary key(requester_id,helper_id,requester_version,helper_version,revision),
  check(requester_id <> helper_id)
);
alter table public.match_reviews enable row level security;
drop policy if exists own_match_reviews on public.match_reviews;
create policy own_match_reviews on public.match_reviews for select to authenticated
using (event_id = public.current_event_id() and auth.uid() in (requester_id,helper_id));
revoke all on public.match_reviews from public,anon,authenticated;
grant select on public.match_reviews to authenticated;
grant all on public.match_reviews to service_role;

create or replace function public.claim_analysis() returns boolean language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  update public.participants set analysis_requested_at = now()
  where id = auth.uid()
    and (interpretation is null or interpretation->>'pipeline' is distinct from '2')
    and (analysis_requested_at is null or analysis_requested_at < now() - interval '60 seconds')
  returning id into v_id;
  return v_id is not null;
end $$;
revoke all on function public.claim_analysis() from public,anon;
grant execute on function public.claim_analysis() to authenticated;

create or replace function public.claim_match_reviews(p_limit integer default 8)
returns setof public.match_reviews language plpgsql security definer set search_path = '' as $$
declare v_event uuid; v_pair record; v_row public.match_reviews; v_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  v_event := public.current_event_id();
  if v_event is null then return; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_event::text, 52));
  for v_pair in
    select a.id as requester_id,b.id as helper_id,a.answer_version as requester_version,b.answer_version as helper_version,
      case when a.interpretation->'needs' @> '[{"specific":true}]'::jsonb and b.interpretation->'offers' @> '[{"specific":true}]'::jsonb then 0 else 1 end as priority
    from public.participants a join public.participants b on a.event_id=b.event_id and a.id<>b.id
    where a.event_id=v_event and auth.uid() in (a.id,b.id)
      and a.interpretation->>'pipeline'='2' and b.interpretation->>'pipeline'='2'
      and (a.interpretation->>'version')::integer=a.answer_version
      and (b.interpretation->>'version')::integer=b.answer_version
      and jsonb_array_length(a.interpretation->'needs')>0
      and jsonb_array_length(b.interpretation->'offers')>0
    order by priority,a.updated_at desc,b.updated_at desc,a.id,b.id
  loop
    insert into public.match_reviews(event_id,requester_id,helper_id,requester_version,helper_version,status)
    values(v_event,v_pair.requester_id,v_pair.helper_id,v_pair.requester_version,v_pair.helper_version,'processing')
    on conflict(requester_id,helper_id,requester_version,helper_version,revision)
    do update set status='processing',lease_id=gen_random_uuid(),lease_until=now()+interval '90 seconds',decision=null,updated_at=now()
    where public.match_reviews.status<>'ready' and public.match_reviews.lease_until < now()
    returning * into v_row;
    if found then
      return next v_row;
      v_count := v_count+1;
      if v_count >= greatest(1,least(p_limit,8)) then return; end if;
    end if;
  end loop;
end $$;
revoke all on function public.claim_match_reviews(integer) from public,anon;
grant execute on function public.claim_match_reviews(integer) to authenticated;
create or replace function public.current_match_reviews()
returns setof public.match_reviews language sql stable security definer set search_path = '' as $$
  select r.* from public.match_reviews r
  join public.participants a on a.id=r.requester_id and a.answer_version=r.requester_version and a.event_id=r.event_id
  join public.participants b on b.id=r.helper_id and b.answer_version=r.helper_version and b.event_id=r.event_id
  where r.event_id=public.current_event_id() and auth.uid() in(r.requester_id,r.helper_id) and r.revision=2
$$;
revoke all on function public.current_match_reviews() from public,anon;
grant execute on function public.current_match_reviews() to authenticated;
commit;
