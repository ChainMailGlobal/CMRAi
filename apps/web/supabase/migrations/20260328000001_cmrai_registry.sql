-- ============================================================
-- CMRAi Registry — Constitutional Identity Registry table
-- Migration: 20260328000001_cmrai_registry.sql
-- ============================================================

create table if not exists cmrai_registry (
  id                uuid         primary key default gen_random_uuid(),

  -- HOC / AIO linkage
  owner_hoc_id      text         not null,
  human_aio_id      text         not null default '',

  -- XRPL identity token
  cmid              text         not null default '',

  -- Scroll witness chain
  witness_hash      text         not null,
  scroll_tx_hash    text         not null default '',

  -- IPFS evidence
  ipfs_hash         text         not null default '',
  video_cid         text         not null default '',

  -- Contact
  email             text         not null default '',

  -- Device / network fingerprint
  imei              text         not null default '',   -- mobile IMEI if captured
  ip                text         not null default '',
  device_info       text         not null default '',   -- user-agent / device fingerprint

  -- Enrollee details
  web3_address      text         not null default '',
  home_address      text         not null default '',

  -- Verification scores
  face_match_score  double precision not null default 0,
  liveness_score    double precision not null default 0,

  -- Status
  status            text         not null default 'verified',

  -- Timestamps
  verified_at       timestamptz  not null default now(),
  created_at        timestamptz  not null default now()
);

-- ── Indexes ──────────────────────────────────────────────────
create index if not exists idx_cmrai_registry_hoc_id      on cmrai_registry (owner_hoc_id);
create index if not exists idx_cmrai_registry_aio_id      on cmrai_registry (human_aio_id);
create index if not exists idx_cmrai_registry_witness_hash on cmrai_registry (witness_hash);
create index if not exists idx_cmrai_registry_cmid         on cmrai_registry (cmid);
create index if not exists idx_cmrai_registry_web3         on cmrai_registry (web3_address);
create index if not exists idx_cmrai_registry_status       on cmrai_registry (status);
create index if not exists idx_cmrai_registry_created      on cmrai_registry (created_at desc);

-- ── RLS ──────────────────────────────────────────────────────
alter table cmrai_registry enable row level security;

-- Service role has full access (backend writes)
create policy "service_role_all" on cmrai_registry
  for all
  to service_role
  using (true)
  with check (true);

-- Anon / authenticated: read own record by HOC ID (for verification UI)
create policy "read_own_by_hoc" on cmrai_registry
  for select
  to anon, authenticated
  using (true);  -- public read for demo; tighten with auth.uid() in production

-- ── Comment ──────────────────────────────────────────────────
comment on table cmrai_registry is
  'CMRAi Constitutional Identity Registry — one row per verified human enrollment. '
  'Links HOC (Human Origin Certificate) → CMID (XRPL NFT) → Scroll witness anchor.';
