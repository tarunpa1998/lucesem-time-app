-- lucesem® core schema (Kimai-inspired). Idempotent.
create extension if not exists pgcrypto;

do $$ begin
  create type app_role as enum ('admin', 'team_lead', 'user');
exception when duplicate_object then null; end $$;
do $$ begin
  create type approval_state as enum ('Approved', 'Pending_Admin_Review', 'Rejected');
exception when duplicate_object then null; end $$;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  display_name text not null,
  weekly_target_hours numeric(5,2) not null default 38.5,
  work_days int[] not null default '{1,2,3,4,5}',
  vacation_days_per_year int not null default 25,
  include_carinthia boolean not null default true,
  requires_timesheet_approval boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists user_roles (
  user_id uuid not null references app_users(id) on delete cascade,
  role app_role not null,
  primary key (user_id, role)
);

create table if not exists sessions (
  id text primary key,
  user_id uuid not null references app_users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default 'lucesem',
  created_at timestamptz not null default now()
);

create table if not exists team_members (
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  is_lead boolean not null default false,
  primary key (team_id, user_id)
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_number text,
  vat_id text,
  street text, postal_code text, city text,
  country text not null default 'AT',
  contact_person text, email text, phone text, mobile text, fax text, website text,
  currency text not null default 'EUR',
  timezone text not null default 'Europe/Vienna',
  color text not null default 'lucesem',
  internal_comment text,
  time_budget_hours numeric(10,2),
  monetary_budget numeric(12,2),
  budget_type text not null default 'Total' check (budget_type in ('Total','Monthly')),
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists customer_teams (
  customer_id uuid not null references customers(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  primary key (customer_id, team_id)
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete restrict,
  name text not null,
  order_number text,
  order_date date, start_date date, end_date date,
  color text not null default 'lucesem',
  time_budget_hours numeric(10,2),
  monetary_budget numeric(12,2),
  hourly_rate numeric(10,2),
  is_visible boolean not null default true,
  allow_time_logging boolean not null default true,
  approval_state approval_state not null default 'Approved',
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists project_teams (
  project_id uuid not null references projects(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  primary key (project_id, team_id)
);

create table if not exists project_users (
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  primary key (project_id, user_id)
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  kind text not null,
  message text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id bigserial primary key,
  actor_id uuid references app_users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_projects_customer on projects(customer_id);
create index if not exists idx_team_members_user on team_members(user_id);
create index if not exists idx_notifications_user on notifications(user_id, read_at);

-- Lock down the Supabase Data API: only this Node.js server (via DATABASE_URL) touches these tables.
do $$ declare t text; begin
  foreach t in array array['app_users','user_roles','sessions','teams','team_members','customers','customer_teams','projects','project_teams','project_users','notifications','audit_log'] loop
    execute format('alter table %I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on %I from anon, authenticated', t);
    end if;
  end loop;
end $$;
