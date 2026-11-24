-- Additive: apply before deploying review revision 3. Revision 2 functions stay
-- available for the old deployment/rollback. No profiles or messages are changed.
begin;
alter table public.match_reviews add column if not exists worker_id uuid references auth.users(id);
-- Private scheduling state must not update participants: that table is in the
-- realtime publication, so heartbeat writes would cause event-wide refresh loops.
create table if not exists public.match_review_worker_state (
  event_id uuid not null references public.events(id),
  participant_id uuid primary key references public.participants(id) on delete cascade,
  review_requested_at timestamptz,
  review_claimed_at timestamptz
);
alter table public.match_review_worker_state enable row level security;
revoke all on public.match_review_worker_state from public,anon,authenticated;
grant all on public.match_review_worker_state to service_role;
create index if not exists match_review_workers on public.match_reviews(event_id,revision,lease_until) where status='processing';

create or replace function public.claim_match_reviews_v3(p_limit integer default 8)
returns setof public.match_reviews language plpgsql security definer set search_path = '' as $$
declare v_event uuid; v_batch uuid := gen_random_uuid(); v_capacity integer; v_claimed integer;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  v_event := public.current_event_id();
  if v_event is null then return; end if;
  -- One atomic scheduler per event; leases survive separate Vercel instances.
  perform pg_advisory_xact_lock(hashtextextended(v_event::text, 52));
  if exists(select 1 from public.match_reviews where event_id=v_event and revision=3
    and worker_id=auth.uid() and status='processing' and lease_until>now()) then return; end if;
  insert into public.match_review_worker_state(event_id,participant_id,review_requested_at)
  values(v_event,auth.uid(),clock_timestamp())
  on conflict(participant_id) do update set review_requested_at=excluded.review_requested_at;
  select 8-count(distinct lease_id) into v_capacity from public.match_reviews
    where event_id=v_event and revision=3 and status='processing' and lease_until>now();
  if v_capacity<=0 then return; end if;
  -- Fair admission under fixed polling order: waiting browsers get a turn
  -- before workers that already consumed batches. Demand expires after 15s.
  if auth.uid() not in (
    select p.participant_id from public.match_review_worker_state p
    where p.event_id=v_event
      and p.review_requested_at>now()-interval '15 seconds'
      and p.review_requested_at>coalesce(p.review_claimed_at,'epoch'::timestamptz)
      and not exists(select 1 from public.match_reviews r where r.event_id=v_event and r.revision=3
        and r.worker_id=p.participant_id and r.status='processing' and r.lease_until>now())
    order by p.review_claimed_at nulls first,p.participant_id
    limit v_capacity
  ) then return; end if;
  return query
  with candidates as (
    select a.id requester_id,b.id helper_id,a.answer_version requester_version,b.answer_version helper_version,
      (a.id=auth.uid()) direction,
      case when exists(select 1 from jsonb_array_elements(a.interpretation->'needs') n
        cross join jsonb_array_elements(b.interpretation->'offers') o where n->>'topic'=o->>'topic') then 0 else 1 end priority,
      greatest(a.updated_at,b.updated_at) updated_at
    from public.participants a join public.participants b on a.event_id=b.event_id and a.id<>b.id
    where a.event_id=v_event and auth.uid() in(a.id,b.id)
      and a.interpretation->>'pipeline'='2' and b.interpretation->>'pipeline'='2'
      and (a.interpretation->>'version')::integer=a.answer_version
      and (b.interpretation->>'version')::integer=b.answer_version
      and jsonb_array_length(a.interpretation->'needs')>0 and jsonb_array_length(b.interpretation->'offers')>0
      and not exists(select 1 from public.match_reviews r where r.requester_id=a.id and r.helper_id=b.id
        and r.requester_version=a.answer_version and r.helper_version=b.answer_version and r.revision=3
        and (r.status='ready' or r.lease_until>now()))
  ), balanced as (
    select *,row_number() over(partition by direction order by priority,updated_at desc,requester_id,helper_id) turn
    from candidates
  ), chosen as (
    select * from balanced order by turn,priority,direction limit greatest(1,least(coalesce(p_limit,8),8))
  )
  insert into public.match_reviews(event_id,requester_id,helper_id,requester_version,helper_version,revision,status,lease_id,lease_until,worker_id)
  select v_event,requester_id,helper_id,requester_version,helper_version,3,'processing',v_batch,now()+interval '90 seconds',auth.uid() from chosen
  on conflict(requester_id,helper_id,requester_version,helper_version,revision)
  do update set status='processing',lease_id=excluded.lease_id,lease_until=excluded.lease_until,
    worker_id=excluded.worker_id,decision=null,updated_at=now()
  where public.match_reviews.status<>'ready' and public.match_reviews.lease_until<=now()
  returning *;
  get diagnostics v_claimed = row_count;
  if v_claimed>0 then
    update public.match_review_worker_state set review_claimed_at=clock_timestamp() where participant_id=auth.uid();
  else
    update public.match_review_worker_state set review_requested_at=null where participant_id=auth.uid();
  end if;
end $$;
revoke all on function public.claim_match_reviews_v3(integer) from public,anon;
grant execute on function public.claim_match_reviews_v3(integer) to authenticated;

create or replace function public.current_match_reviews_v3()
returns setof public.match_reviews language sql stable security definer set search_path = '' as $$
 select r.* from public.match_reviews r
 join public.participants a on a.id=r.requester_id and a.answer_version=r.requester_version and a.event_id=r.event_id
 join public.participants b on b.id=r.helper_id and b.answer_version=r.helper_version and b.event_id=r.event_id
 where r.event_id=public.current_event_id() and auth.uid() in(r.requester_id,r.helper_id) and r.revision=3
$$;
revoke all on function public.current_match_reviews_v3() from public,anon;
grant execute on function public.current_match_reviews_v3() to authenticated;
commit;
