-- First-party authentication data. Tokens and one-time codes are stored only as hashes.
create unique index if not exists profiles_email_lower_unique on profiles (lower(email));

create table if not exists auth_identities (
  provider text not null check (provider in ('google','email')),
  subject text not null,
  user_id uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  primary key (provider, subject)
);
create index if not exists auth_identities_user_idx on auth_identities(user_id);

create table if not exists auth_sessions (
  id uuid primary key,
  user_id uuid not null references profiles(id),
  access_hash text not null unique,
  refresh_hash text not null unique,
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists auth_sessions_user_idx on auth_sessions(user_id, refresh_expires_at);

create table if not exists email_otp_challenges (
  id uuid primary key,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts smallint not null default 0,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists email_otp_email_idx on email_otp_challenges(email, created_at desc);

alter table auth_identities enable row level security;
alter table auth_sessions enable row level security;
alter table email_otp_challenges enable row level security;
