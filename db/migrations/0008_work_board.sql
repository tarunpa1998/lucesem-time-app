create table if not exists board_tasks (
  id uuid primary key default gen_random_uuid(),
  task_number serial,
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text not null default '',
  status text not null default 'pending',
  priority text not null default 'medium',
  created_by uuid not null references app_users(id) on delete cascade,
  assignee_ids uuid[] not null default '{}',
  github_issue_number int,
  github_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists board_task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references board_tasks(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  comment text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_board_tasks_project on board_tasks(project_id);
create index if not exists idx_board_tasks_status on board_tasks(status);
create index if not exists idx_board_tasks_created_by on board_tasks(created_by);
create index if not exists idx_board_task_comments_task on board_task_comments(task_id, created_at);

do $$ declare t text; begin
  foreach t in array array['board_tasks','board_task_comments'] loop
    execute format('alter table %I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on %I from anon, authenticated', t);
    end if;
  end loop;
end $$;
