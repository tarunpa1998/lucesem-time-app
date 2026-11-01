-- Link time entries to board tasks (issues)
alter table time_entries
  add column if not exists task_id uuid references board_tasks(id) on delete set null;

create index if not exists idx_time_entries_task on time_entries(task_id);
