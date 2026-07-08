-- House Hadadi — Phase 1 schema
-- Run this in the Supabase SQL editor (or `supabase db push`) on a fresh project.
-- Implements PRD section 11.1 entities. Phase 1 uses manual CRUD only (no AI columns populated yet);
-- agent_event / inbound_message / bank_* tables are included now so Phase 2/3 don't need a migration.

create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- Core household & identity
-- ─────────────────────────────────────────────────────────────

create table household (
  id uuid primary key default uuid_generate_v4(),
  name text not null default 'House Hadadi',
  created_at timestamptz not null default now()
);

-- Mirrors auth.users 1:1 for the (exactly 2) household members.
create table app_user (
  id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null references household(id) on delete cascade,
  name text not null,
  email text not null,
  telegram_user_id text, -- populated in Phase 2
  google_calendar_connected boolean not null default false,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Food
-- ─────────────────────────────────────────────────────────────

create table recipe (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references household(id) on delete cascade,
  title text not null,
  source_url text,
  rating smallint check (rating between 1 and 5),
  notes text,
  created_at timestamptz not null default now()
);

create table meal_plan (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references household(id) on delete cascade,
  week_start date not null, -- always a Sunday
  status text not null default 'draft' check (status in ('draft', 'approved')),
  created_at timestamptz not null default now(),
  unique (household_id, week_start)
);

create table meal_plan_day (
  id uuid primary key default uuid_generate_v4(),
  plan_id uuid not null references meal_plan(id) on delete cascade,
  day_index smallint not null check (day_index between 0 and 6), -- 0 = Sunday
  recipe_id uuid references recipe(id) on delete set null,
  free_text text, -- used when no recipe box entry (e.g. "leftovers", "eating out")
  unique (plan_id, day_index)
);

create table grocery_item (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references household(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  added_by_user_id uuid references app_user(id) on delete set null,
  added_by_agent text, -- e.g. 'chef' — null for Phase 1 (manual only)
  source text not null default 'app' check (source in ('app', 'telegram', 'meal_plan')),
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Cleaning
-- ─────────────────────────────────────────────────────────────

create table chore (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references household(id) on delete cascade,
  title text not null,
  frequency text not null default 'weekly',
  effort_weight numeric not null default 1.0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table chore_assignment (
  id uuid primary key default uuid_generate_v4(),
  chore_id uuid not null references chore(id) on delete cascade,
  user_id uuid not null references app_user(id) on delete cascade,
  week_start date not null,
  day_index smallint check (day_index between 0 and 6),
  done_at timestamptz,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Finance
-- ─────────────────────────────────────────────────────────────

create table category (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references household(id) on delete cascade,
  name text not null,
  monthly_cap_agorot bigint not null default 0, -- budget cap stored in agorot (1 ILS = 100 agorot)
  sort_order smallint not null default 0
);

create table transaction (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references household(id) on delete cascade,
  amount_agorot bigint not null, -- always positive; direction determines sign
  direction text not null check (direction in ('expense', 'income')),
  description text not null,
  category_id uuid references category(id) on delete set null,
  payer_user_id uuid references app_user(id) on delete set null,
  source text not null default 'app' check (source in ('app', 'telegram', 'receipt', 'bank_import')),
  bank_transaction_id uuid, -- FK added below, after bank_transaction is created
  occurred_at date not null default current_date,
  corrected boolean not null default false,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Tasks
-- ─────────────────────────────────────────────────────────────

create table task (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references household(id) on delete cascade,
  title text not null,
  assignee_user_id uuid references app_user(id) on delete set null,
  due_date date,
  due_time time, -- optional — "walk Nala tomorrow at 8" vs. an all-day due date
  done_at timestamptz,
  source text not null default 'app' check (source in ('app', 'telegram')),
  google_calendar_event_id text, -- set once synced to the assignee's Google Calendar
  apple_calendar_event_uid text, -- set once synced to the assignee's Apple Calendar
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Notepad
-- ─────────────────────────────────────────────────────────────

create table link (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references household(id) on delete cascade,
  url text not null,
  title text,
  thumbnail_url text,
  note text,
  platform text, -- 'instagram' | 'youtube' | 'generic' ... used for fallback card styling
  saved_by_user_id uuid references app_user(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Agent / capture audit trail (unused in Phase 1, wired in Phase 2)
-- ─────────────────────────────────────────────────────────────

create table agent_event (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references household(id) on delete cascade,
  agent text not null check (agent in ('chef', 'home', 'finance', 'butler')),
  type text not null check (type in ('proposal', 'alert', 'digest', 'action')),
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table inbound_message (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references household(id) on delete cascade,
  telegram_message_id text,
  sender_user_id uuid references app_user(id) on delete set null,
  raw_text text not null,
  classified_intent text,
  confidence numeric,
  resulting_entity_id uuid,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Calendar integration (Phase 1.5 — Google Calendar; Apple via CalDAV, see README)
-- ─────────────────────────────────────────────────────────────

create table calendar_connection (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references app_user(id) on delete cascade,
  provider text not null check (provider in ('google', 'apple')),
  -- Google: OAuth refresh token. Apple: iCloud app-specific password (CalDAV has no OAuth).
  -- ⚠ Phase 1 stores this as plaintext for simplicity — move to Supabase Vault
  -- (or another secrets manager) before this leaves a 2-person household.
  secret text,
  caldav_username text, -- Apple only: the iCloud email used with the app-specific password
  caldav_principal_url text, -- Apple only: resolved on first connect
  calendar_id text, -- target calendar to write household events into
  connected_at timestamptz not null default now(),
  unique (user_id, provider)
);

-- ─────────────────────────────────────────────────────────────
-- Banking / credit card integration (Phase 3 pulled forward — see README)
--
-- Israeli banks/credit cards have no open-banking API, so this uses
-- https://github.com/eshaham/israeli-bank-scrapers, which logs in to each
-- institution's own site/app to read transactions. That means:
--  - `company_id` matches the library's CompanyTypes (hapoalim, leumi,
--    discount, isracard, max, cal, amex, ...).
--  - `credentials_encrypted` holds a JSON blob whose shape varies per bank
--    (e.g. Hapoalim wants {userCode, password}; Isracard wants {id, card6Digits,
--    password}) — encrypted application-side (AES-256-GCM, see
--    lib/integrations/israeli-bank-scrapers.ts) before it ever reaches this
--    table. The encryption key lives only in env vars, never in the DB.
--  - Sync runs as an offline script (scripts/bank-sync.ts on a cron), not a
--    Vercel route — Puppeteer/headless-Chrome doesn't fit serverless
--    function limits reliably. See README "Banking integration".
-- ─────────────────────────────────────────────────────────────

create table bank_connection (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references household(id) on delete cascade,
  company_id text not null, -- e.g. 'hapoalim', 'leumi', 'isracard', 'max', 'cal'
  display_name text not null, -- e.g. "Noam's Hapoalim checking"
  credentials_encrypted text not null,
  status text not null default 'active' check (status in ('active', 'error', 'disconnected')),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create table bank_transaction (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references household(id) on delete cascade,
  bank_connection_id uuid references bank_connection(id) on delete set null,
  provider_transaction_id text not null unique, -- library's `identifier`, for idempotent sync
  amount_agorot bigint not null,
  merchant_name text,
  raw_category text,
  status text not null default 'completed' check (status in ('completed', 'pending')),
  occurred_at date not null,
  matched_transaction_id uuid, -- set once reconciled against a manual `transaction` row
  created_at timestamptz not null default now()
);

alter table transaction
  add constraint transaction_bank_transaction_fk
  foreign key (bank_transaction_id) references bank_transaction(id) on delete set null;

-- ─────────────────────────────────────────────────────────────
-- Row Level Security — household-scoped (exactly one household in V1,
-- but written so a user only ever sees their own household's rows)
-- ─────────────────────────────────────────────────────────────

alter table household enable row level security;
alter table app_user enable row level security;
alter table recipe enable row level security;
alter table meal_plan enable row level security;
alter table meal_plan_day enable row level security;
alter table grocery_item enable row level security;
alter table chore enable row level security;
alter table chore_assignment enable row level security;
alter table category enable row level security;
alter table transaction enable row level security;
alter table task enable row level security;
alter table link enable row level security;
alter table agent_event enable row level security;
alter table inbound_message enable row level security;
alter table calendar_connection enable row level security;
alter table bank_connection enable row level security;
alter table bank_transaction enable row level security;

create or replace function current_household_id()
returns uuid
language sql stable
as $$
  select household_id from app_user where id = auth.uid()
$$;

create policy household_self_select on household
  for select using (id = current_household_id());

create policy app_user_household_select on app_user
  for select using (household_id = current_household_id());
create policy app_user_self_update on app_user
  for update using (id = auth.uid());

-- Same pattern for every household-scoped table: full CRUD within your own household.
create policy recipe_all on recipe for all using (household_id = current_household_id()) with check (household_id = current_household_id());
create policy meal_plan_all on meal_plan for all using (household_id = current_household_id()) with check (household_id = current_household_id());
create policy meal_plan_day_all on meal_plan_day for all using (plan_id in (select id from meal_plan where household_id = current_household_id())) with check (plan_id in (select id from meal_plan where household_id = current_household_id()));
create policy grocery_item_all on grocery_item for all using (household_id = current_household_id()) with check (household_id = current_household_id());
create policy chore_all on chore for all using (household_id = current_household_id()) with check (household_id = current_household_id());
create policy chore_assignment_all on chore_assignment for all using (chore_id in (select id from chore where household_id = current_household_id())) with check (chore_id in (select id from chore where household_id = current_household_id()));
create policy category_all on category for all using (household_id = current_household_id()) with check (household_id = current_household_id());
create policy transaction_all on transaction for all using (household_id = current_household_id()) with check (household_id = current_household_id());
create policy task_all on task for all using (household_id = current_household_id()) with check (household_id = current_household_id());
create policy link_all on link for all using (household_id = current_household_id()) with check (household_id = current_household_id());
create policy agent_event_all on agent_event for all using (household_id = current_household_id()) with check (household_id = current_household_id());
create policy inbound_message_all on inbound_message for all using (household_id = current_household_id()) with check (household_id = current_household_id());
create policy calendar_connection_all on calendar_connection for all using (user_id in (select id from app_user where household_id = current_household_id())) with check (user_id in (select id from app_user where household_id = current_household_id()));
create policy bank_connection_all on bank_connection for all using (household_id = current_household_id()) with check (household_id = current_household_id());
create policy bank_transaction_all on bank_transaction for all using (household_id = current_household_id()) with check (household_id = current_household_id());

-- ─────────────────────────────────────────────────────────────
-- Realtime — enable for the tables the UI subscribes to live
-- ─────────────────────────────────────────────────────────────

alter publication supabase_realtime add table grocery_item, task, transaction, chore_assignment, link, agent_event;
