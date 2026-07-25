-- Mend — Supabase schema (Task 7).
--
-- RLS is intentionally left OFF on every table below. This is a synthetic,
-- single-tenant demo seeded with one fictional patient — there are no real
-- patients, no multi-tenant boundary to enforce, and no production data at
-- risk. Do not treat this schema as a template for a real clinical system
-- without adding RLS policies first.
--
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / guarded
-- seed insert), so this file can be pasted into the Supabase SQL editor
-- more than once without duplicating data or erroring.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- patients
-- ---------------------------------------------------------------------------
create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  procedure text not null,
  surgery_date date not null,
  phone text,
  caregiver_phone text
);

alter table patients disable row level security;

-- ---------------------------------------------------------------------------
-- vitals — a TIME SERIES. One row per reading, per patient. The trend engine
-- (lib/clinical/trends.ts) reads a patient's trailing history ordered by
-- recorded_at, so the (patient_id, recorded_at) composite index below is not
-- optional — without it every trend query degenerates into a full table scan
-- as check-in volume grows.
-- ---------------------------------------------------------------------------
create table if not exists vitals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id) on delete cascade,
  recorded_at timestamptz not null,
  hr integer,
  sbp integer,
  dbp integer,
  temp_c numeric(4, 1),
  spo2 integer,
  resp_rate integer,
  -- Optional 0-10 pain score at this timepoint. Voice check-ins write it;
  -- BLE/manual spot readings leave it null. Required for the pain-score
  -- trend slope over real history (lib/clinical/trends.ts). Constraint
  -- added below so both fresh creates and re-runs share one named check.
  pain_score integer,
  source text not null check (
    source in ('ble_heart_rate', 'manual', 'kardia_6l', 'simulated')
  ),
  device_label text,
  quality text not null check (quality in ('ok', 'poor', 'stale'))
);

alter table vitals disable row level security;

-- Additive, idempotent: older deployments that created `vitals` before
-- pain_score existed pick the column up on re-run.
alter table vitals
  add column if not exists pain_score integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vitals_pain_score_check'
      and conrelid = 'vitals'::regclass
  ) then
    alter table vitals
      add constraint vitals_pain_score_check
      check (pain_score is null or (pain_score >= 0 and pain_score <= 10));
  end if;
end $$;

-- Trailing-history lookups always filter by patient and sort by recency;
-- DESC matches that access pattern exactly (evaluateTrends reads the most
-- recent MAX_WINDOW readings).
create index if not exists vitals_patient_id_recorded_at_idx
  on vitals (patient_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- ecg_readings — one row per KardiaMobile 6L capture.
-- ---------------------------------------------------------------------------
create table if not exists ecg_readings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id) on delete cascade,
  recorded_at timestamptz not null,
  determination text not null check (
    determination in (
      'normal_sinus_rhythm',
      'atrial_fibrillation',
      'tachycardia',
      'bradycardia',
      'unclassified'
    )
  ),
  bpm integer,
  source text not null default 'kardia_6l' check (source = 'kardia_6l'),
  pdf_url text
);

alter table ecg_readings disable row level security;

create index if not exists ecg_readings_patient_id_recorded_at_idx
  on ecg_readings (patient_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- checkins — one row per voice check-in, carrying the full deterministic
-- audit trail (symptoms / vitals / decision / trend_findings) as jsonb
-- snapshots alongside the generated SBAR prose.
-- ---------------------------------------------------------------------------
create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id) on delete cascade,
  created_at timestamptz not null default now(),
  day_post_op integer not null,
  transcript text,
  symptoms jsonb not null default '{}'::jsonb,
  vitals jsonb,
  decision jsonb,
  trend_findings jsonb not null default '[]'::jsonb,
  sbar text
);

alter table checkins disable row level security;

create index if not exists checkins_patient_id_created_at_idx
  on checkins (patient_id, created_at desc);

-- ---------------------------------------------------------------------------
-- escalations — one row per amber/red decision that triggered a caregiver
-- notification.
-- ---------------------------------------------------------------------------
create table if not exists escalations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id) on delete cascade,
  checkin_id uuid references checkins (id) on delete set null,
  level text not null check (level in ('green', 'amber', 'red')),
  condition text,
  notified_caregiver_at timestamptz
);

alter table escalations disable row level security;

create index if not exists escalations_patient_id_idx on escalations (patient_id);

-- ---------------------------------------------------------------------------
-- demo_state — key/value store for console-selected demo scenario so the
-- choice survives across Vercel serverless isolates (see lib/sim/active-scenario.ts
-- and lib/sim/demo-state.sql). RLS off: synthetic single-tenant demo only.
-- ---------------------------------------------------------------------------
create table if not exists demo_state (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table demo_state disable row level security;

insert into demo_state (key, value)
values ('active_scenario', 'green')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Seed: one synthetic demo patient. Guarded by name so this block is safe
-- to re-run (no unique constraint on name is needed for that).
-- ---------------------------------------------------------------------------
insert into patients (name, procedure, surgery_date)
select 'Margaret (demo, synthetic)', 'hip hemiarthroplasty', current_date - 4
where not exists (
  select 1 from patients where name = 'Margaret (demo, synthetic)'
);
