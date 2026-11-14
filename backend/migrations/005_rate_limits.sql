create table if not exists api_rate_limits (
  key_hash text primary key,
  count integer not null check (count > 0),
  expires_at timestamptz not null
);

create index if not exists api_rate_limits_expires_at_idx on api_rate_limits (expires_at);
