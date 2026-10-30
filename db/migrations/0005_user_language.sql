alter table app_users add column if not exists language text not null default 'de' check (language in ('de','en'));
