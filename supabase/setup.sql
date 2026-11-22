-- Apply in a NEW dedicated Supabase project using SQL Editor.
begin;
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(), slug text not null unique, title text not null
);
create table if not exists public.participants (
  id uuid primary key references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  need text not null check (char_length(btrim(need)) between 8 and 500),
  offer text not null check (char_length(btrim(offer)) between 8 and 500),
  recognition text not null default '' check (char_length(recognition) <= 140),
  answer_version integer not null default 1,
  interpretation jsonb,
  updated_at timestamptz not null default now(),
  analysis_requested_at timestamptz
);
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id),
  participant_a uuid not null references public.participants(id), participant_b uuid not null references public.participants(id),
  created_at timestamptz not null default now(),
  check (participant_a < participant_b), unique(participant_a, participant_b)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id),
  sender_id uuid not null references public.participants(id), body text not null check (char_length(btrim(body)) between 1 and 2000),
  client_id uuid not null, created_at timestamptz not null default now(), unique(sender_id, client_id)
);
create index if not exists messages_conversation_created on public.messages(conversation_id, created_at);
create index if not exists messages_sender_created on public.messages(sender_id, created_at);
create index if not exists participants_event on public.participants(event_id);
create table if not exists public.conversation_reads (
  conversation_id uuid not null references public.conversations(id), participant_id uuid not null references public.participants(id),
  last_read_at timestamptz not null default now(), primary key(conversation_id, participant_id)
);

create or replace function public.current_event_id() returns uuid language sql stable security definer set search_path = '' as $$
  select event_id from public.participants where id = auth.uid()
$$;
create or replace function public.is_conversation_member(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.conversations where id = p_id and auth.uid() in (participant_a, participant_b))
$$;
alter table public.events enable row level security;
alter table public.participants enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_reads enable row level security;
drop policy if exists event_member on public.events;
create policy event_member on public.events for select to authenticated using (id = public.current_event_id());
drop policy if exists profile_event on public.participants;
create policy profile_event on public.participants for select to authenticated using (event_id = public.current_event_id());
drop policy if exists profile_owner on public.participants;
create policy profile_owner on public.participants for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists conversation_member on public.conversations;
create policy conversation_member on public.conversations for select to authenticated using (auth.uid() in (participant_a, participant_b));
drop policy if exists message_member on public.messages;
create policy message_member on public.messages for select to authenticated using (public.is_conversation_member(conversation_id));
drop policy if exists own_receipts on public.conversation_reads;
create policy own_receipts on public.conversation_reads for select to authenticated using (participant_id = auth.uid() and public.is_conversation_member(conversation_id));

create or replace function public.profile_changed() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.need is distinct from old.need or new.offer is distinct from old.offer then
    if auth.role() <> 'service_role' and old.updated_at > now() - interval '5 seconds' then raise exception 'Please wait a few seconds before editing again.'; end if;
    new.answer_version := old.answer_version + 1;
    new.interpretation := null;
  end if;
  if new.name is distinct from old.name or new.need is distinct from old.need or new.offer is distinct from old.offer or new.recognition is distinct from old.recognition then new.updated_at := now(); end if;
  return new;
end $$;
drop trigger if exists profile_changed on public.participants;
create trigger profile_changed before update on public.participants for each row execute function public.profile_changed();

create or replace function public.join_event(p_slug text, p_name text, p_need text, p_offer text, p_recognition text default '') returns public.participants
language plpgsql security definer set search_path = '' as $$
declare v_event uuid; v_row public.participants;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select id into v_event from public.events where slug = p_slug;
  if v_event is null then raise exception 'This event link is not available.'; end if;
  if exists(select 1 from public.participants where id = auth.uid() and event_id <> v_event) then raise exception 'This browser has joined a different event. Use a separate browser session.'; end if;
  insert into public.participants(id,event_id,name,need,offer,recognition)
  values(auth.uid(),v_event,btrim(p_name),btrim(p_need),btrim(p_offer),btrim(p_recognition))
  on conflict(id) do nothing returning * into v_row;
  if v_row.id is null then select * into v_row from public.participants where id = auth.uid(); end if;
  return v_row;
end $$;

create or replace function public.start_conversation(p_other uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_event uuid; v_id uuid;
begin
  v_event := public.current_event_id();
  if v_event is null or p_other = auth.uid() or not exists(select 1 from public.participants where id = p_other and event_id = v_event) then raise exception 'Participant unavailable.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 1));
  select id into v_id from public.conversations where participant_a = least(auth.uid(),p_other) and participant_b = greatest(auth.uid(),p_other);
  if v_id is not null then return v_id; end if;
  if (select count(*) from public.conversations where auth.uid() in (participant_a,participant_b) and created_at > now() - interval '1 minute') >= 10 then raise exception 'Please wait a minute before starting more conversations.'; end if;
  insert into public.conversations(event_id,participant_a,participant_b) values(v_event,least(auth.uid(),p_other),greatest(auth.uid(),p_other))
  on conflict(participant_a,participant_b) do update set participant_a = excluded.participant_a returning id into v_id;
  return v_id;
end $$;

create or replace function public.send_message(p_conversation uuid, p_body text, p_client_id uuid) returns public.messages language plpgsql security definer set search_path = '' as $$
declare v_row public.messages;
begin
  if not public.is_conversation_member(p_conversation) then raise exception 'Conversation unavailable.'; end if;
  if p_body is null or char_length(btrim(p_body)) not between 1 and 2000 or p_client_id is null then raise exception 'Write between 1 and 2,000 characters.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 2));
  select * into v_row from public.messages where sender_id = auth.uid() and client_id = p_client_id;
  if v_row.id is not null then
    if v_row.conversation_id <> p_conversation or v_row.body <> btrim(p_body) then raise exception 'Message retry does not match.'; end if;
    return v_row;
  end if;
  if (select count(*) from public.messages where sender_id = auth.uid() and created_at > now() - interval '1 minute') >= 30 then raise exception 'Please wait a minute before sending more messages.'; end if;
  insert into public.messages(conversation_id,sender_id,body,client_id) values(p_conversation,auth.uid(),btrim(p_body),p_client_id) returning * into v_row;
  return v_row;
end $$;

create or replace function public.mark_read(p_conversation uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_conversation_member(p_conversation) then raise exception 'Conversation unavailable.'; end if;
  insert into public.conversation_reads(conversation_id,participant_id,last_read_at) values(p_conversation,auth.uid(),statement_timestamp())
  on conflict(conversation_id,participant_id) do update set last_read_at = excluded.last_read_at;
end $$;

create or replace function public.claim_analysis() returns boolean language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  update public.participants set analysis_requested_at = now()
  where id = auth.uid() and interpretation is null and (analysis_requested_at is null or analysis_requested_at < now() - interval '60 seconds') returning id into v_id;
  return v_id is not null;
end $$;

revoke all on public.events, public.participants, public.conversations, public.messages, public.conversation_reads from anon, authenticated;
grant select on public.events, public.participants, public.conversations, public.messages, public.conversation_reads to authenticated;
grant update(name,need,offer,recognition) on public.participants to authenticated;
grant all on public.events, public.participants, public.conversations, public.messages, public.conversation_reads to service_role;
revoke all on function public.current_event_id(), public.is_conversation_member(uuid), public.profile_changed(), public.join_event(text,text,text,text,text), public.start_conversation(uuid), public.send_message(uuid,text,uuid), public.mark_read(uuid), public.claim_analysis() from public, anon;
grant execute on function public.current_event_id(), public.is_conversation_member(uuid), public.join_event(text,text,text,text,text), public.start_conversation(uuid), public.send_message(uuid,text,uuid), public.mark_read(uuid), public.claim_analysis() to authenticated;

create or replace function public.get_inbox() returns table(conversation_id uuid, preview text, last_message_at timestamptz, unread bigint)
language sql stable security definer set search_path = '' as $$
  select c.id,
    (select m.body from public.messages m where m.conversation_id=c.id order by m.created_at desc, m.id desc limit 1),
    coalesce((select max(m.created_at) from public.messages m where m.conversation_id=c.id),c.created_at),
    (select count(*) from public.messages m where m.conversation_id=c.id and m.sender_id<>auth.uid() and m.created_at > coalesce(r.last_read_at,'epoch'::timestamptz))
  from public.conversations c left join public.conversation_reads r on r.conversation_id=c.id and r.participant_id=auth.uid()
  where auth.uid() in (c.participant_a,c.participant_b)
$$;
revoke all on function public.get_inbox() from public, anon;
grant execute on function public.get_inbox() to authenticated;

-- Keep this link private to participants; change the slug before printing the QR code.
insert into public.events(slug,title) values('ai-pilled-room-84e2c9b7','AI pilled') on conflict(slug) do nothing;
-- Realtime is optional: the app also polls every 5 seconds as a recovery path.
do $$ begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then alter publication supabase_realtime add table public.messages; end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='participants') then alter publication supabase_realtime add table public.participants; end if;
  end if;
end $$;
commit;
