-- Durable demo scenario for Mend console selection across serverless isolates.
-- Safe to re-run. Paste into the Supabase SQL editor (or append via schema.sql).
-- Without this table, active-scenario.ts degrades to the in-process store.

create table if not exists demo_state (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table demo_state disable row level security;

insert into demo_state (key, value)
values ('active_scenario', 'green')
on conflict (key) do nothing;
