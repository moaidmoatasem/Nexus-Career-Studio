create extension if not exists pg_trgm with schema extensions;

-- profiles
create table public.profiles (
  id uuid primary key,
  full_name text not null default '',
  headline text not null default '',
  years_experience int not null default 0,
  target_domains text[] not null default '{}',
  requires_visa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- vault
create table public.vault_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  category text not null default 'experience' check (category in ('experience','achievement','skill','education','project','certification')),
  title text not null,
  organization text not null default '',
  start_date text not null default '',
  end_date text not null default '',
  is_current boolean not null default false,
  description text not null default '',
  metrics text[] not null default '{}',
  skills text[] not null default '{}',
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.vault_items(user_id);
grant select, insert, update, delete on public.vault_items to authenticated;
grant all on public.vault_items to service_role;
alter table public.vault_items enable row level security;
create policy "own vault" on public.vault_items for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- sponsors (public registry)
create table public.sponsors (
  id bigserial primary key,
  organisation_name text not null,
  organisation_normalized text not null,
  town_city text not null default '',
  county text not null default '',
  type_rating text not null default '',
  route text not null default ''
);
create index sponsors_norm_trgm on public.sponsors using gin (organisation_normalized extensions.gin_trgm_ops);
create index sponsors_norm_eq on public.sponsors (organisation_normalized);
grant select on public.sponsors to anon, authenticated;
grant all on public.sponsors to service_role;
alter table public.sponsors enable row level security;
create policy "public read sponsors" on public.sponsors for select to anon, authenticated using (true);

create or replace function public.normalize_company_name(raw text) returns text
language sql immutable set search_path = public as $$
  select trim(regexp_replace(
    regexp_replace(
      regexp_replace(lower(coalesce(raw,'')), '\m(limited|ltd|plc|llc|inc|incorporated|corp|corporation|group|holdings|services|uk|technologies|tech)\M', ' ', 'g'),
    '[.,/#!$%^&*;:{}=\-_`~()]', ' ', 'g'),
  '\s+', ' ', 'g'))
$$;

create or replace function public.match_sponsor_company_v3(search_term text, threshold real default 0.35, max_results int default 10)
returns table (id bigint, organisation_name text, town_city text, county text, type_rating text, route text, similarity real)
language plpgsql stable set search_path = public, extensions as $$
declare
  clean text := lower(trim(search_term));
  norm text := public.normalize_company_name(search_term);
  alias text;
begin
  if length(clean) <= 4 then
    alias := case clean
      when 'arm' then 'arm' when 'meta' then 'meta platforms ireland' when 'bp' then 'bp p l c'
      when 'x' then 'twitter' when 'aws' then 'amazon web' when 'bt' then 'bt'
      when 'hsbc' then 'hsbc' when 'gs' then 'goldman sachs international' when 'gds' then 'government digital' else null end;
    return query select s.id, s.organisation_name, s.town_city, s.county, s.type_rating, s.route, 1.0::real
      from sponsors s where s.organisation_normalized = coalesce(alias, clean) limit 1;
    if found then return; end if;
  end if;
  return query select s.id, s.organisation_name, s.town_city, s.county, s.type_rating, s.route, 1.0::real
    from sponsors s where s.organisation_normalized = norm limit 1;
  if found then return; end if;
  return query select s.id, s.organisation_name, s.town_city, s.county, s.type_rating, s.route,
      extensions.similarity(s.organisation_normalized, norm) as sim
    from sponsors s
    where extensions.similarity(s.organisation_normalized, norm) >= threshold
    order by sim desc limit max_results;
end $$;
grant execute on function public.match_sponsor_company_v3(text, real, int) to anon, authenticated;

-- jobs: shared catalog (user_id null) + user-added
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  title text not null,
  company_name text not null,
  location text not null default '',
  country text not null default 'UK',
  is_remote boolean not null default false,
  salary_range text,
  job_url text not null default '',
  description text not null default '',
  required_skills text[] not null default '{}',
  preferred_skills text[] not null default '{}',
  min_years_exp int not null default 0,
  domain text not null default '',
  source text not null default 'direct',
  discovered_at timestamptz not null default now()
);
grant select, insert, update, delete on public.jobs to authenticated;
grant all on public.jobs to service_role;
alter table public.jobs enable row level security;
create policy "read catalog or own jobs" on public.jobs for select to authenticated using (user_id is null or user_id = auth.uid());
create policy "insert own jobs" on public.jobs for insert to authenticated with check (user_id = auth.uid());
create policy "update own jobs" on public.jobs for update to authenticated using (user_id = auth.uid());
create policy "delete own jobs" on public.jobs for delete to authenticated using (user_id = auth.uid());

-- applications
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  job_id uuid not null references public.jobs(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','tailored','applied','screening','interviewing','offered','rejected')),
  fit_score int not null default 0,
  tailored_pack jsonb,
  last_email_status text,
  next_action text,
  notes text,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);
grant select, insert, update, delete on public.applications to authenticated;
grant all on public.applications to service_role;
alter table public.applications enable row level security;
create policy "own applications" on public.applications for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into public.sponsors (organisation_name, organisation_normalized, town_city, county, type_rating, route)
select n, public.normalize_company_name(n), c, co, 'Worker (A rating)', 'Skilled Worker' from (values
('Arm Limited','Cambridge','Cambridgeshire'),('Google UK Limited','London','Greater London'),('Revolut Ltd','London','Greater London'),
('Meta Platforms Ireland Limited','London','Greater London'),('Amazon Web Services UK Limited','London','Greater London'),('BP P.L.C.','London','Greater London'),
('DeepMind Technologies Limited','London','Greater London'),('Monzo Bank Limited','London','Greater London'),('Wise Payments Ltd','London','Greater London'),
('Deliveroo','London','Greater London'),('Spotify UK Limited','London','Greater London'),('JPMorgan Chase Bank, N.A.','London','Greater London'),
('Goldman Sachs International','London','Greater London'),('Bloomberg L.P.','London','Greater London'),('AstraZeneca UK Limited','Cambridge','Cambridgeshire'),
('Stripe Payments UK Limited','London','Greater London'),('Palantir Technologies UK, Ltd.','London','Greater London'),('Datadog UK Limited','London','Greater London'),
('Cloudflare UK Limited','London','Greater London'),('GitLab UK Limited','Reading','Berkshire'),('Snowflake Computing UK Ltd','London','Greater London'),
('Cisco Systems Limited','Feltham','Middlesex'),('Microsoft Limited','Reading','Berkshire'),('Salesforce.com UK Ltd','London','Greater London'),
('BT Group PLC','London','Greater London'),('Starling Bank Limited','London','Greater London'),('Checkout.com','London','Greater London'),
('Graphcore Limited','Bristol','Bristol'),('Improbable Worlds Limited','London','Greater London'),('HSBC Holdings plc','London','Greater London'),
('Twitter UK Ltd','London','Greater London'),('Government Digital Service','London','Greater London')
) v(n,c,co);

insert into public.jobs (title, company_name, location, is_remote, salary_range, job_url, description, required_skills, preferred_skills, min_years_exp, domain, source) values
('Senior Full-Stack Engineer','Revolut Ltd','London',false,'£85k–£110k','https://www.revolut.com/careers','Build high-scale fintech products across the stack.','{TypeScript,React,Node.js,PostgreSQL}','{Kubernetes,Kafka}',5,'Fintech','greenhouse'),
('Machine Learning Engineer','DeepMind Technologies Limited','London',false,'£95k–£130k','https://deepmind.google/careers','Ship research models to production systems.','{Python,PyTorch,Machine Learning}','{JAX,Kubernetes}',4,'AI/ML','greenhouse'),
('Backend Engineer, Payments','Monzo Bank Limited','London',true,'£75k–£95k','https://monzo.com/careers','Own payment services in Go on Kubernetes.','{Go,PostgreSQL,Microservices}','{Kafka,AWS}',3,'Fintech','lever'),
('Platform Engineer','Cloudflare UK Limited','London',true,'£80k–£105k','https://www.cloudflare.com/careers','Build edge platform tooling.','{Rust,Kubernetes,Terraform}','{Go,Linux}',4,'Infrastructure','greenhouse'),
('Frontend Engineer','Spotify UK Limited','London',false,'£70k–£90k','https://www.lifeatspotify.com','Craft listener-facing web experiences.','{TypeScript,React,CSS}','{GraphQL,Testing}',3,'Consumer','ashby'),
('Data Engineer','Wise Payments Ltd','London',true,'£70k–£92k','https://wise.jobs','Build reliable data pipelines.','{Python,SQL,Airflow}','{Spark,dbt}',3,'Fintech','lever'),
('Staff Software Engineer','Arm Limited','Cambridge',false,'£100k–£135k','https://careers.arm.com','Lead architecture for developer tooling.','{C++,Python,System Design}','{Rust,Compilers}',8,'Semiconductors','direct'),
('Solutions Architect','Unknown Startup Labs','Remote',true,'£60k–£80k','https://example.com/jobs','Help customers adopt our platform.','{AWS,TypeScript,Communication}','{Terraform}',4,'SaaS','direct');