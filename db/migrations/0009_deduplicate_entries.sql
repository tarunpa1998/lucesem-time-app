-- Remove duplicate time entries for the same user on the same date with the exact same time interval,
-- keeping the most recent one.
delete from time_entries a
using time_entries b
where a.user_id = b.user_id
  and a.entry_date = b.entry_date
  and a.from_time = b.from_time
  and a.to_time = b.to_time
  and a.created_at < b.created_at;

-- Enforce uniqueness of (user_id, entry_date, from_time, to_time) to permanently prevent duplicate slot entries.
create unique index if not exists idx_time_entries_unique_slot
  on time_entries (user_id, entry_date, from_time, to_time);
