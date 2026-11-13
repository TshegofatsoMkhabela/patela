-- Application data; first-party identity tables are added in 003_auth.sql.
create table if not exists profiles (
  id uuid primary key,
  email text not null,
  full_name text not null default '',
  role text not null default 'buyer' check (role in ('buyer','supplier','warehouse','carrier','verifier','admin')),
  wallet_address text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists wallet_challenges (
  id uuid primary key,
  user_id uuid not null references profiles(id),
  wallet_address text not null,
  nonce text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists wallet_challenges_user_idx on wallet_challenges(user_id, expires_at);

create table if not exists orders (
  id uuid primary key,
  chain_order_id text not null unique,
  buyer_id uuid not null references profiles(id),
  buyer_wallet_address text not null,
  amount_wei numeric(78,0) not null check (amount_wei > 0),
  token_address text not null,
  chain_id integer not null,
  status text not null default 'awaiting_funding'
    check (status in ('awaiting_funding','funded','in_progress','delivered','refunded','disputed')),
  funding_deadline timestamptz not null,
  refund_deadline timestamptz not null,
  funding_tx_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_buyer_created_idx on orders(buyer_id, created_at desc);

create table if not exists order_participants (
  order_id uuid not null references orders(id) on delete cascade,
  user_id uuid not null references profiles(id),
  primary key (order_id, user_id)
);
create index if not exists order_participants_user_idx on order_participants(user_id, order_id);

create table if not exists handoffs (
  id uuid primary key,
  order_id uuid not null references orders(id) on delete cascade,
  stage_index smallint not null check (stage_index between 1 and 4),
  from_user_id uuid not null references profiles(id),
  to_user_id uuid not null references profiles(id),
  payee_user_id uuid references profiles(id),
  from_wallet_address text not null,
  to_wallet_address text not null,
  payee_wallet_address text,
  payout_wei numeric(78,0) not null check (payout_wei >= 0),
  status text not null default 'waiting'
    check (status in ('waiting','issued','awaiting_chain','confirmed')),
  nonce text,
  challenge_expires_at timestamptz,
  from_signature text,
  to_signature text,
  tx_hash text,
  confirmed_at timestamptz,
  unique (order_id, stage_index),
  check (from_user_id <> to_user_id)
);
create index if not exists handoffs_order_idx on handoffs(order_id, stage_index);

create table if not exists chain_events (
  chain_id integer not null,
  tx_hash text not null,
  log_index integer not null,
  order_id uuid not null references orders(id),
  event_name text not null,
  stage_index smallint,
  amount_wei numeric(78,0) not null,
  block_number numeric(78,0) not null,
  block_hash text not null,
  observed_at timestamptz not null default now(),
  primary key (chain_id, tx_hash, log_index)
);
create index if not exists chain_events_order_idx on chain_events(order_id, observed_at);

create table if not exists disputes (
  id uuid primary key,
  order_id uuid not null references orders(id) on delete cascade,
  raised_by uuid not null references profiles(id),
  reason text not null,
  status text not null default 'open' check (status in ('open','reviewed')),
  decision text check (decision in ('release','refund','reject')),
  reviewer_id uuid references profiles(id),
  review_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create unique index if not exists disputes_one_open_per_order_idx
  on disputes(order_id) where status='open';
create index if not exists disputes_status_created_idx on disputes(status, created_at);

-- Browser/PostgREST roles receive no table policies. All application access
-- passes through the backend, which authenticates the caller and checks order
-- membership before using its server-side database connection.
alter table profiles enable row level security;
alter table wallet_challenges enable row level security;
alter table orders enable row level security;
alter table order_participants enable row level security;
alter table handoffs enable row level security;
alter table chain_events enable row level security;
alter table disputes enable row level security;
