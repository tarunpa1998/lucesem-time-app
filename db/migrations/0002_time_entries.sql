create table if not exists time_entries (
  id uuid primary key,
  user_id uuid not null references app_users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete restrict,
  entry_date date not null,
  from_time time not null,
  to_time time not null,
  work_notes text not null default '',
  entry_mode text not null default 'CustomHours',
  status text not null default 'approved' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (to_time > from_time)
);
create index if not exists time_entries_user_date on time_entries (user_id, entry_date);
alter table time_entries enable row level security;
revoke all on time_entries from anon, authenticated;
