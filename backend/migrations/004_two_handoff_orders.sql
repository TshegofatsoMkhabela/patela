-- Two-handoff demo orders (specs/INTERFACES.md): supplier -> driver (pickup), driver -> buyer (delivery).
-- The buyer creates the order here first; the supplier and driver join by emailed accept links.
-- On-chain order IDs are uint256 counters assigned by the escrow, stored as decimal text.
-- The old four-stage `handoffs` table is left in place but no longer written.

alter table orders alter column chain_order_id drop not null;
alter table orders alter column funding_deadline drop not null;
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check check (status in (
  'awaiting_supplier','awaiting_chain','awaiting_funding','funded','accepted',
  'driver_assigned','in_progress','delivered','refunded'));
-- Disputes live in the disputes table; 'disputed' was never written, so it is dropped from the list.

alter table orders add column if not exists supplier_email text;
alter table orders add column if not exists supplier_id uuid references profiles(id);
alter table orders add column if not exists supplier_wallet_address text;
alter table orders add column if not exists driver_id uuid references profiles(id);
alter table orders add column if not exists driver_wallet_address text;
alter table orders add column if not exists driver_at_pickup_wei numeric(78,0) check (driver_at_pickup_wei >= 0);
alter table orders add column if not exists supplier_at_pickup_wei numeric(78,0) check (supplier_at_pickup_wei >= 0);
alter table orders add column if not exists supplier_at_delivery_wei numeric(78,0) check (supplier_at_delivery_wei >= 0);
alter table orders add column if not exists agreement_text text;
alter table orders add column if not exists agreement_hash text;
alter table orders add column if not exists stages_done smallint not null default 0 check (stages_done between 0 and 2);

-- One-time accept links for an order's supplier or driver. Only a SHA-256 hash of the token is stored.
create table if not exists order_invitations (
  id uuid primary key,
  order_id uuid not null references orders(id) on delete cascade,
  role text not null check (role in ('supplier','driver')),
  email text not null,
  token_hash text not null unique,
  invited_by uuid not null references profiles(id),
  expires_at timestamptz not null,
  accepted_by uuid references profiles(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists order_invitations_order_idx on order_invitations(order_id, role);

-- QR handshake sessions. The giver's browser creates the nonce; the contract spends it on release.
create table if not exists handoff_sessions (
  id uuid primary key,
  order_id uuid not null references orders(id) on delete cascade,
  stage smallint not null check (stage between 1 and 2),
  nonce text not null unique,
  expires_at timestamptz not null,
  giver_evidence jsonb not null,
  receiver_evidence jsonb,
  evidence_hash text,
  receiver_sig text,
  created_at timestamptz not null default now()
);
create index if not exists handoff_sessions_order_idx on handoff_sessions(order_id, stage);

alter table email_outbox add column if not exists attempts integer not null default 0;
alter table email_outbox add column if not exists last_error text;
alter table email_outbox add column if not exists sent_at timestamptz;

alter table order_invitations enable row level security;
alter table handoff_sessions enable row level security;

-- Rows queued before any sender existed were documented as never delivered. Close them out so turning
-- on Gmail doesn't mail a backlog of stale codes and invites, or delay a fresh sign-in code behind them.
update email_outbox set status='failed', last_error='Queued before email delivery existed; not sent'
  where status='pending';
