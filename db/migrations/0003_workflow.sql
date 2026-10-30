-- Late-entry unlocks, period locks, export locking, live timers, customer portal.
create table if not exists unlock_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  entry_date date not null,
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by uuid references app_users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists unlock_requests_user on unlock_requests (user_id, entry_date);

create table if not exists period_locks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete cascade, -- null = everyone
  from_date date not null,
  to_date date not null,
  note text not null default '',
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (to_date >= from_date)
);

alter table time_entries add column if not exists exported_at timestamptz;
alter table time_entries add column if not exists decided_by uuid references app_users(id) on delete set null;

create table if not exists active_timers (
  user_id uuid primary key references app_users(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  started_at timestamptz not null,
  work_notes text not null default ''
);

create table if not exists customer_portals (
  customer_id uuid primary key references customers(id) on delete cascade,
  token text not null unique,
  password_hash text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table unlock_requests enable row level security;
alter table period_locks enable row level security;
alter table active_timers enable row level security;
alter table customer_portals enable row level security;
revoke all on unlock_requests, period_locks, active_timers, customer_portals from anon, authenticated;
