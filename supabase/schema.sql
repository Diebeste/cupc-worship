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
