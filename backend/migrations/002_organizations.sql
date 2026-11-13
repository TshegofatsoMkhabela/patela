-- Businesses, staff membership, invitations and a demo email outbox.
-- A person (profile) and a business (organization) are separate. What a business
-- may do (buy, supply, store, carry) lives on the organization as capabilities,
-- and only an approved organization may trade.

-- Signing up no longer grants a trading role. profiles.role now only means
-- platform staff ('admin') or everyone else ('member'). Old per-person trading
-- roles are replaced by organization capabilities, so those rows become 'member'.
alter table profiles drop constraint if exists profiles_role_check;
update profiles set role='member' where role <> 'admin';
alter table profiles add constraint profiles_role_check check (role in ('member','admin'));
alter table profiles alter column role set default 'member';

create table if not exists organizations (
  id uuid primary key,
  legal_name text not null check (length(legal_name) between 2 and 200),
  registration_number text not null unique check (registration_number ~ '^\d{4}/\d{6}/\d{2}$'),
  vat_number text check (vat_number ~ '^4\d{9}$'),
  capabilities text[] not null check (
    cardinality(capabilities) between 1 and 4
    and capabilities <@ array['buyer','supplier','warehouse','carrier']::text[]
  ),
  status text not null default 'draft' check (status in ('draft','submitted','approved','rejected')),
  rejection_reason text,
  created_by uuid not null references profiles(id),
  submitted_at timestamptz,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists organizations_status_idx on organizations(status, submitted_at);

create table if not exists organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references profiles(id),
  member_role text not null check (member_role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index if not exists organization_members_user_idx on organization_members(user_id);

-- Only a SHA-256 hash of the invitation token is stored here.
create table if not exists invitations (
  id uuid primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  member_role text not null check (member_role in ('admin','member')),
  token_hash text not null unique,
  invited_by uuid not null references profiles(id),
  expires_at timestamptz not null,
  accepted_by uuid references profiles(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists invitations_org_idx on invitations(organization_id, created_at);

-- DEMO: rows are queued here and never delivered. A real sender would read
-- pending rows, send them through an email provider, and mark them sent.
create table if not exists email_outbox (
  id uuid primary key,
  to_email text not null,
  template text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  created_at timestamptz not null default now()
);
create index if not exists email_outbox_status_idx on email_outbox(status, created_at);

alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table invitations enable row level security;
alter table email_outbox enable row level security;
