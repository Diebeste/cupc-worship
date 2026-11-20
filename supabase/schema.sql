-- CUPC Mississauga Worship — Supabase schema
-- Run this in the Supabase SQL editor after creating your project.
-- See SETUP.md for the full walkthrough.

create extension if not exists pgcrypto;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  team_id uuid references public.teams (id) on delete set null,
  display_name text,
  role text not null default 'member' check (role in ('admin', 'member')),
  can_edit boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.songs (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  title text not null,
  artist text not null default '',
  original_key text not null default '',
  bpm text not null default '',
  notes text not null default '',
  sections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  name text not null,
  date date,
  type text not null default 'sunday',
  leader text not null default '',
  notes text not null default '',
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists songs_team_id_idx on public.songs (team_id);
create index if not exists services_team_id_idx on public.services (team_id);
create index if not exists services_date_idx on public.services (date desc);
create index if not exists profiles_team_id_idx on public.profiles (team_id);

-- Helpers (security definer so RLS can call them without recursion)
create or replace function public.my_team_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select team_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_team_editor(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and team_id = tid
      and (role = 'admin' or can_edit = true)
  )
$$;

-- Auto-create a profile row for every new auth user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- First admin creates a team and becomes its admin
create or replace function public.create_team(p_name text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
  code text := upper(trim(p_code));
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if code is null or length(code) < 4 then
    raise exception 'Join code must be at least 4 characters';
  end if;
  insert into public.teams (name, join_code)
  values (coalesce(nullif(trim(p_name), ''), 'CUPC Mississauga Worship'), code)
  returning id into tid;

  insert into public.profiles (id, team_id, display_name, role, can_edit)
  values (auth.uid(), tid, null, 'admin', true)
  on conflict (id) do update
    set team_id = excluded.team_id,
        role = 'admin',
        can_edit = true;

  return jsonb_build_object('team_id', tid, 'role', 'admin', 'join_code', code);
end;
$$;

-- Members join an existing team with the shared code
create or replace function public.join_team_with_code(p_code text, p_display_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
  r text;
  edit boolean;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select id into tid from public.teams where join_code = upper(trim(p_code));
  if tid is null then
    raise exception 'Unknown join code';
  end if;

  insert into public.profiles (id, team_id, display_name, role, can_edit)
  values (auth.uid(), tid, p_display_name, 'member', false)
  on conflict (id) do update
    set team_id = excluded.team_id,
        display_name = coalesce(excluded.display_name, public.profiles.display_name);

  select role, can_edit into r, edit from public.profiles where id = auth.uid();
  return jsonb_build_object('team_id', tid, 'role', r, 'can_edit', edit);
end;
$$;

-- Row level security
alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.songs enable row level security;
alter table public.services enable row level security;

drop policy if exists teams_select_member on public.teams;
create policy teams_select_member on public.teams
  for select using (id = public.my_team_id());

drop policy if exists profiles_select_team on public.profiles;
create policy profiles_select_team on public.profiles
  for select using (id = auth.uid() or team_id = public.my_team_id());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_admin_update_team on public.profiles;
create policy profiles_admin_update_team on public.profiles
  for update using (public.is_team_editor(team_id))
  with check (public.is_team_editor(team_id));

drop policy if exists songs_select on public.songs;
create policy songs_select on public.songs
  for select using (team_id = public.my_team_id());

drop policy if exists songs_write on public.songs;
create policy songs_write on public.songs
  for all using (public.is_team_editor(team_id))
  with check (public.is_team_editor(team_id));

drop policy if exists services_select on public.services;
create policy services_select on public.services
  for select using (team_id = public.my_team_id());

drop policy if exists services_write on public.services;
create policy services_write on public.services
  for all using (public.is_team_editor(team_id))
  with check (public.is_team_editor(team_id));

-- Recommended: leave the anon key in the app (it is public).
-- RLS plus “Confirm email” on the Auth settings is what protects the data.
grant usage on schema public to anon, authenticated;
grant select on public.teams, public.profiles, public.songs, public.services to authenticated;
grant insert, update, delete on public.songs, public.services to authenticated;
grant insert, update on public.profiles to authenticated;
grant execute on function public.join_team_with_code(text, text) to authenticated;
grant execute on function public.create_team(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- v2 migration (safe to re-run): service roles, members, schedule month notes
-- ---------------------------------------------------------------------------

alter table public.services add column if not exists voices jsonb not null default '[]'::jsonb;
alter table public.services add column if not exists instruments jsonb not null default '[]'::jsonb;
alter table public.services add column if not exists ujier text not null default '';
alter table public.services add column if not exists subtitle text not null default '';
alter table public.services add column if not exists schedule_pin text not null default '';

update public.services set type = 'service' where type = 'adhoc';

create table if not exists public.members (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.schedule_meta (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  month text not null,
  practice_notes text not null default '',
  banner text not null default '',
  updated_at timestamptz not null default now(),
  unique (team_id, month)
);

create index if not exists members_team_id_idx on public.members (team_id);
create index if not exists schedule_meta_team_id_idx on public.schedule_meta (team_id);

alter table public.members enable row level security;
alter table public.schedule_meta enable row level security;

drop policy if exists members_select on public.members;
create policy members_select on public.members
  for select using (team_id = public.my_team_id());

drop policy if exists members_write on public.members;
create policy members_write on public.members
  for all using (public.is_team_editor(team_id))
  with check (public.is_team_editor(team_id));

drop policy if exists schedule_meta_select on public.schedule_meta;
create policy schedule_meta_select on public.schedule_meta
  for select using (team_id = public.my_team_id());

drop policy if exists schedule_meta_write on public.schedule_meta;
create policy schedule_meta_write on public.schedule_meta
  for all using (public.is_team_editor(team_id))
  with check (public.is_team_editor(team_id));

grant select on public.members, public.schedule_meta to authenticated;
grant insert, update, delete on public.members, public.schedule_meta to authenticated;


-- ---------------------------------------------------------------------------
-- v3 (safe to re-run): pre-seed the CUPC team; first person to join becomes admin
-- ---------------------------------------------------------------------------

insert into public.teams (name, join_code)
values ('CUPC Mississauga Worship', 'CUPC-ALABANZA')
on conflict (join_code) do nothing;

create or replace function public.join_team_with_code(p_code text, p_display_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
  r text;
  edit boolean;
  become_admin boolean;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select id into tid from public.teams where join_code = upper(trim(p_code));
  if tid is null then
    raise exception 'Unknown join code';
  end if;

  select not exists (
    select 1 from public.profiles where team_id = tid and role = 'admin'
  ) into become_admin;

  insert into public.profiles (id, team_id, display_name, role, can_edit)
  values (
    auth.uid(),
    tid,
    p_display_name,
    case when become_admin then 'admin' else 'member' end,
    become_admin
  )
  on conflict (id) do update
    set team_id = excluded.team_id,
        display_name = coalesce(excluded.display_name, public.profiles.display_name),
        role = case
          when public.profiles.role = 'admin' then 'admin'
          when become_admin then 'admin'
          else public.profiles.role
        end,
        can_edit = case
          when public.profiles.role = 'admin' or public.profiles.can_edit or become_admin then true
          else public.profiles.can_edit
        end;

  select role, can_edit into r, edit from public.profiles where id = auth.uid();
  return jsonb_build_object('team_id', tid, 'role', r, 'can_edit', edit);
end;
$$;


-- ---------------------------------------------------------------------------
-- v4 (safe to re-run): revoke SECURITY DEFINER execute from the anonymous role
-- ---------------------------------------------------------------------------

revoke all on function public.create_team(text, text) from public, anon;
revoke all on function public.join_team_with_code(text, text) from public, anon;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.my_team_id() from public, anon;
revoke all on function public.is_team_editor(uuid) from public, anon;

grant execute on function public.create_team(text, text) to authenticated;
grant execute on function public.join_team_with_code(text, text) to authenticated;
grant execute on function public.my_team_id() to authenticated;
grant execute on function public.is_team_editor(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- v5 (safe to re-run): hashed leader/editor code, anonymous-friendly join,
-- admin rotate/remove helpers. Do not grant EXECUTE to the anon role.
-- Anonymous signed-in users use the authenticated role (JWT is_anonymous).
-- ---------------------------------------------------------------------------

alter table public.teams add column if not exists editor_code_hash text;

-- Brandon's existing email account must remain admin.
create or replace function public.is_protected_admin(uid uuid)
returns boolean
language sql
stable
as $$
  select uid = '6d0a3785-7884-4705-89eb-f38697abbac6'::uuid
$$;

create or replace function public.is_team_admin(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and team_id = tid
      and role = 'admin'
  )
$$;

-- Team code alone = view-only member. Valid editor code sets can_edit.
-- Existing admins (including the protected account) are never demoted.
drop function if exists public.join_team_with_code(text, text);

create or replace function public.join_team_with_code(
  p_code text,
  p_display_name text default null,
  p_editor_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
  r text;
  edit boolean;
  editor_ok boolean := false;
  stored_hash text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select id, editor_code_hash into tid, stored_hash
    from public.teams
   where join_code = upper(trim(p_code));
  if tid is null then
    raise exception 'Unknown join code';
  end if;

  if p_editor_code is not null and length(trim(p_editor_code)) > 0 then
    if stored_hash is null or stored_hash = '' then
      raise exception 'Unknown editor code';
    end if;
    editor_ok := (stored_hash = crypt(upper(trim(p_editor_code)), stored_hash));
    if not editor_ok then
      raise exception 'Unknown editor code';
    end if;
  end if;

  insert into public.profiles (id, team_id, display_name, role, can_edit)
  values (
    auth.uid(),
    tid,
    p_display_name,
    'member',
    editor_ok
  )
  on conflict (id) do update
    set team_id = excluded.team_id,
        display_name = coalesce(excluded.display_name, public.profiles.display_name),
        role = case
          when public.is_protected_admin(public.profiles.id) then 'admin'
          when public.profiles.role = 'admin' then 'admin'
          else 'member'
        end,
        can_edit = case
          when public.is_protected_admin(public.profiles.id) then true
          when public.profiles.role = 'admin' then true
          when editor_ok then true
          else public.profiles.can_edit
        end;

  -- Guarantee the protected account stays admin even if it joined some other way.
  if public.is_protected_admin(auth.uid()) then
    update public.profiles
       set role = 'admin', can_edit = true, team_id = tid
     where id = auth.uid();
  end if;

  select role, can_edit into r, edit from public.profiles where id = auth.uid();
  return jsonb_build_object('team_id', tid, 'role', r, 'can_edit', edit);
end;
$$;

create or replace function public.claim_editor_code(p_editor_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
  stored_hash text;
  r text;
  edit boolean;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select team_id into tid from public.profiles where id = auth.uid();
  if tid is null then
    raise exception 'Join a team first';
  end if;
  select editor_code_hash into stored_hash from public.teams where id = tid;
  if stored_hash is null or stored_hash = ''
     or stored_hash <> crypt(upper(trim(p_editor_code)), stored_hash) then
    raise exception 'Unknown editor code';
  end if;
  update public.profiles
     set can_edit = true,
         role = case when public.is_protected_admin(id) or role = 'admin' then 'admin' else role end
   where id = auth.uid();
  select role, can_edit into r, edit from public.profiles where id = auth.uid();
  return jsonb_build_object('team_id', tid, 'role', r, 'can_edit', edit);
end;
$$;

create or replace function public.random_team_code(p_prefix text, p_len int)
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea;
  out text := '';
  i int;
begin
  bytes := gen_random_bytes(p_len);
  for i in 0..p_len-1 loop
    out := out || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return p_prefix || out;
end;
$$;

create or replace function public.rotate_editor_code()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
  new_code text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  tid := public.my_team_id();
  if tid is null or not public.is_team_admin(tid) then
    raise exception 'Only a team admin can rotate codes';
  end if;
  new_code := public.random_team_code('CUPC-ED-', 8);
  update public.teams
     set editor_code_hash = crypt(upper(new_code), gen_salt('bf'))
   where id = tid;
  return jsonb_build_object('editor_code', new_code);
end;
$$;

create or replace function public.rotate_join_code()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
  new_code text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  tid := public.my_team_id();
  if tid is null or not public.is_team_admin(tid) then
    raise exception 'Only a team admin can rotate codes';
  end if;
  new_code := public.random_team_code('CUPC-', 8);
  update public.teams set join_code = new_code where id = tid;
  return jsonb_build_object('join_code', new_code);
end;
$$;

create or replace function public.team_admin_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
  rec record;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  tid := public.my_team_id();
  if tid is null or not public.is_team_admin(tid) then
    raise exception 'Only a team admin can view team codes';
  end if;
  select name, join_code, (editor_code_hash is not null and editor_code_hash <> '') as has_editor_code
    into rec
    from public.teams where id = tid;
  return jsonb_build_object(
    'team_id', tid,
    'name', rec.name,
    'join_code', rec.join_code,
    'has_editor_code', rec.has_editor_code
  );
end;
$$;

create or replace function public.list_team_members()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  tid := public.my_team_id();
  if tid is null or not public.is_team_admin(tid) then
    raise exception 'Only a team admin can list members';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'display_name', p.display_name,
      'role', p.role,
      'can_edit', p.can_edit,
      'protected', public.is_protected_admin(p.id)
    ) order by p.role desc, p.display_name)
    from public.profiles p
    where p.team_id = tid
  ), '[]'::jsonb);
end;
$$;

create or replace function public.remove_team_member(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
  admin_count int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  tid := public.my_team_id();
  if tid is null or not public.is_team_admin(tid) then
    raise exception 'Only a team admin can remove members';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot remove yourself';
  end if;
  if public.is_protected_admin(p_user_id) then
    raise exception 'That member cannot be removed';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and team_id = tid) then
    raise exception 'Member not found';
  end if;
  select count(*) into admin_count from public.profiles where team_id = tid and role = 'admin';
  if admin_count <= 1 and exists (select 1 from public.profiles where id = p_user_id and team_id = tid and role = 'admin') then
    raise exception 'Cannot remove the last admin';
  end if;
  update public.profiles
     set team_id = null, role = 'member', can_edit = false
   where id = p_user_id and team_id = tid;
  return jsonb_build_object('removed', p_user_id);
end;
$$;

-- RLS already keys off auth.uid() / my_team_id() / is_team_editor(), which works
-- for both magic-link and anonymous JWTs (auth.jwt()->>'is_anonymous' = 'true').
-- Writes stay limited to can_edit / admin. Re-assert policies are present.

drop policy if exists songs_select on public.songs;
create policy songs_select on public.songs
  for select using (team_id = public.my_team_id());

drop policy if exists songs_write on public.songs;
create policy songs_write on public.songs
  for all using (public.is_team_editor(team_id))
  with check (public.is_team_editor(team_id));

drop policy if exists services_select on public.services;
create policy services_select on public.services
  for select using (team_id = public.my_team_id());

drop policy if exists services_write on public.services;
create policy services_write on public.services
  for all using (public.is_team_editor(team_id))
  with check (public.is_team_editor(team_id));

revoke all on function public.join_team_with_code(text, text, text) from public, anon;
revoke all on function public.claim_editor_code(text) from public, anon;
revoke all on function public.rotate_editor_code() from public, anon;
revoke all on function public.rotate_join_code() from public, anon;
revoke all on function public.team_admin_state() from public, anon;
revoke all on function public.list_team_members() from public, anon;
revoke all on function public.remove_team_member(uuid) from public, anon;
revoke all on function public.is_team_admin(uuid) from public, anon;
revoke all on function public.is_protected_admin(uuid) from public, anon;
revoke all on function public.random_team_code(text, int) from public, anon, authenticated;

grant execute on function public.join_team_with_code(text, text, text) to authenticated;
grant execute on function public.claim_editor_code(text) to authenticated;
grant execute on function public.rotate_editor_code() to authenticated;
grant execute on function public.rotate_join_code() to authenticated;
grant execute on function public.team_admin_state() to authenticated;
grant execute on function public.list_team_members() to authenticated;
grant execute on function public.remove_team_member(uuid) to authenticated;

create or replace function public.is_protected_admin(uid uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select uid = '6d0a3785-7884-4705-89eb-f38697abbac6'::uuid
$$;

create or replace function public.random_team_code(p_prefix text, p_len int)
returns text
language plpgsql
set search_path = public
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea;
  out text := '';
  i int;
begin
  bytes := gen_random_bytes(p_len);
  for i in 0..p_len-1 loop
    out := out || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return p_prefix || out;
end;
$$;

revoke all on function public.is_team_admin(uuid) from public, anon, authenticated;
revoke all on function public.is_protected_admin(uuid) from public, anon, authenticated;
revoke all on function public.random_team_code(text, int) from public, anon, authenticated;
