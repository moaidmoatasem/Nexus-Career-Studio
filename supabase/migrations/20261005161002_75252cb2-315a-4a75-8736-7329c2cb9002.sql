alter table public.profiles
  add column target_titles text[] not null default '{}',
  add column target_locations text[] not null default '{}',
  add column remote_preference text not null default 'hybrid' check (remote_preference in ('onsite','hybrid','remote','any')),
  add column salary_floor integer,
  add column excluded_employers text[] not null default '{}',
  add column excluded_keywords text[] not null default '{}',
  add column discovery_frequency text not null default 'daily' check (discovery_frequency in ('manual','daily','weekly'));

create table public.source_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source text not null check (source in ('career_pages','linkedin','indeed','gmail','outlook')),
  enabled boolean not null default false,
  status text not null default 'not_connected' check (status in ('not_connected','ready','syncing','needs_attention')),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source)
);
grant select, insert, update, delete on public.source_connections to authenticated;
grant all on public.source_connections to service_role;
alter table public.source_connections enable row level security;
create policy "own source connections" on public.source_connections for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.discovery_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source text not null,
  status text not null default 'running' check (status in ('running','completed','partial','failed')),
  jobs_found integer not null default 0,
  jobs_added integer not null default 0,
  error_summary text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.discovery_runs to authenticated;
grant all on public.discovery_runs to service_role;
alter table public.discovery_runs enable row level security;
create policy "own discovery runs" on public.discovery_runs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.role_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  job_id uuid not null references public.jobs(id) on delete cascade,
  decision text not null check (decision in ('saved','dismissed')),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);
grant select, insert, update, delete on public.role_decisions to authenticated;
grant all on public.role_decisions to service_role;
alter table public.role_decisions enable row level security;
create policy "own role decisions" on public.role_decisions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.application_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  application_id uuid references public.applications(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  event_type text not null,
  title text not null,
  detail text,
  source text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.application_events to authenticated;
grant all on public.application_events to service_role;
alter table public.application_events enable row level security;
create policy "own application events" on public.application_events for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index source_connections_user_idx on public.source_connections(user_id);
create index discovery_runs_user_started_idx on public.discovery_runs(user_id, started_at desc);
create index role_decisions_user_decision_idx on public.role_decisions(user_id, decision);
create index application_events_user_created_idx on public.application_events(user_id, created_at desc);

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger source_connections_updated before update on public.source_connections for each row execute function public.set_updated_at();
create trigger discovery_runs_updated before update on public.discovery_runs for each row execute function public.set_updated_at();
create trigger role_decisions_updated before update on public.role_decisions for each row execute function public.set_updated_at();
create trigger application_events_updated before update on public.application_events for each row execute function public.set_updated_at();