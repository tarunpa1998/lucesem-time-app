-- Kimai-style activities (task types), budget alert tracking.
create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade, -- null = available in all projects
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists activities_project on activities (project_id);
alter table time_entries add column if not exists activity_id uuid references activities(id) on delete set null;
alter table projects add column if not exists budget_alert_level int not null default 0;
alter table activities enable row level security;
revoke all on activities from anon, authenticated;
