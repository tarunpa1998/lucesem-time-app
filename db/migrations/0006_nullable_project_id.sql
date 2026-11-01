-- Allow absence entries (vacation, sick leave, compensatory time) to exist without a project.
alter table time_entries alter column project_id drop not null;
