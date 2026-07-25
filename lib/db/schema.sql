-- Mend — synthetic demo schema.
-- Run in the Supabase SQL editor. SYNTHETIC DATA ONLY: never put real patient
-- data in this table, in this project, or in any deployment of it.

create table if not exists patients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  procedure     text not null,
  surgery_date  date not null,
  discharged_on date
);

create table if not exists checkins (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid references patients(id),
  created_at  timestamptz default now(),
  day_post_op int not null,
  transcript  text,
  symptoms    jsonb not null,
  vitals      jsonb not null,
  decision    jsonb not null,
  sbar        text
);

create index if not exists checkins_patient_created_idx
  on checkins (patient_id, created_at desc);

-- Demo patient. 82F, hip-fracture hemiarthroplasty, discharged home POD 3.
insert into patients (name, procedure, surgery_date, discharged_on)
select
  'Margaret W. (demo, synthetic)',
  'Right hip hemiarthroplasty (neck of femur fracture)',
  current_date - 9,
  current_date - 6
where not exists (select 1 from patients where name like 'Margaret W.%');

-- RLS: this demo runs with a single synthetic patient and no auth, so policies
-- are intentionally out of scope. Do NOT carry this configuration into any
-- deployment that handles real data — enable RLS and write per-patient policies
-- before that point.
