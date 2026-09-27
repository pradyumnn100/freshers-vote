-- Run this whole file once in Supabase: Project -> SQL Editor -> New query -> paste -> Run

create extension if not exists pgcrypto;

create table candidates (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('mr','ms')),
  candidate_number text not null,
  name text not null,
  department text not null,
  tagline text,
  photo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- otp_* columns below are unused now that login checks list membership
-- instead of a mailed code (see app/api/login/route.js). Left in place
-- so this file still matches an already-deployed database; run the
-- cleanup block at the bottom of this file if you want them gone.
create table voters (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  otp_hash text,
  otp_expires_at timestamptz,
  otp_attempts int not null default 0,
  otp_send_count int not null default 0,
  otp_last_sent_at timestamptz,
  email_verified boolean not null default false,
  has_voted boolean not null default false,
  created_at timestamptz not null default now(),
  last_login timestamptz
);

create table votes (
  id uuid primary key default gen_random_uuid(),
  voter_id uuid not null references voters(id),
  candidate_id uuid not null references candidates(id),
  category text not null check (category in ('mr','ms')),
  created_at timestamptz not null default now(),
  unique (voter_id, category)
);

create table event_settings (
  id int primary key default 1,
  voting_start timestamptz,
  voting_end timestamptz,
  centre_lat double precision not null default 29.8681618,
  centre_lng double precision not null default 77.8909806,
  radius_m int not null default 100,
  public_results_enabled boolean not null default false,
  constraint single_row check (id = 1)
);
insert into event_settings (id) values (1) on conflict (id) do nothing;

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- Demo candidates (replace with real ones any time via SQL or a future admin UI)
insert into candidates (category, candidate_number, name, department, tagline) values
('mr','07','Arjun Sharma','Chemical Sciences','Making memories, not excuses.'),
('mr','11','Rohan Singh','Mechanical Engg.','Loud laugh, louder ambitions.'),
('mr','15','Kabir Jain','Civil Engineering','Built for the stage, coded for life.'),
('mr','19','Dev Malhotra','Electrical Engg.','Charged up since day one.'),
('mr','23','Aditya Rao','Architecture','Designing my own freshman story.'),
('ms','12','Riya Mehta','Computer Science','Here to make freshman year unforgettable.'),
('ms','18','Sanya Kapoor','Physics','Curious mind, confident stride.'),
('ms','22','Meher Gill','Design','Colouring outside the lines since day one.'),
('ms','26','Ananya Iyer','Biotechnology','Small campus, big dreams.'),
('ms','31','Ishita Verma','Metallurgy','Forged for this moment.');

-- Atomic vote-casting function: all checks + both inserts happen in one transaction.
-- Distance is computed here in SQL from coordinates the API route passes in,
-- so nothing about eligibility is decided by client-side code.
create or replace function cast_vote(
  p_voter_id uuid,
  p_mr_candidate_id uuid,
  p_ms_candidate_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision
) returns jsonb
language plpgsql
security definer
as $$
declare
  s event_settings;
  v voters;
  dist_m double precision;
begin
  select * into s from event_settings where id = 1;
  select * into v from voters where id = p_voter_id for update;

  if v is null or v.email_verified is not true then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if s.voting_start is null or s.voting_end is null
     or now() < s.voting_start or now() > s.voting_end then
    raise exception 'VOTING_CLOSED';
  end if;

  if p_accuracy is null or p_accuracy > 50 then
    raise exception 'LOCATION_ACCURACY_TOO_LOW';
  end if;

  -- Haversine distance in metres
  dist_m := 6371000 * acos(
    least(1.0, greatest(-1.0,
      cos(radians(s.centre_lat)) * cos(radians(p_lat)) *
      cos(radians(p_lng) - radians(s.centre_lng)) +
      sin(radians(s.centre_lat)) * sin(radians(p_lat))
    ))
  );

  if dist_m > s.radius_m then
    raise exception 'OUTSIDE_GEOFENCE';
  end if;

  if v.has_voted then
    raise exception 'ALREADY_VOTED';
  end if;

  if not exists (select 1 from candidates where id = p_mr_candidate_id and category = 'mr' and active) then
    raise exception 'INVALID_MR_CANDIDATE';
  end if;
  if not exists (select 1 from candidates where id = p_ms_candidate_id and category = 'ms' and active) then
    raise exception 'INVALID_MS_CANDIDATE';
  end if;

  insert into votes (voter_id, candidate_id, category) values (p_voter_id, p_mr_candidate_id, 'mr');
  insert into votes (voter_id, candidate_id, category) values (p_voter_id, p_ms_candidate_id, 'ms');

  update voters set has_voted = true where id = p_voter_id;

  return jsonb_build_object('ok', true, 'distance_m', round(dist_m::numeric, 1));
end;
$$;

-- Optional cleanup — run this manually in the SQL editor if your database
-- already exists and you want the now-dead OTP columns gone. Skip it on
-- a brand-new database (the create table above already omits them if you
-- remove the otp_* lines before running it for the first time).
-- alter table voters
--   drop column if exists otp_hash,
--   drop column if exists otp_expires_at,
--   drop column if exists otp_attempts,
--   drop column if exists otp_send_count,
--   drop column if exists otp_last_sent_at;
