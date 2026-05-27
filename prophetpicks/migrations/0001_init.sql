-- ProphetPicks initial Neon Postgres schema.
-- Apply with: psql "$DATABASE_URL" -f migrations/0001_init.sql
--
-- All tables are namespaced `prophetpicks_*` so the database can host
-- other projects on the same Neon branch without colliding.

create extension if not exists "pgcrypto";

create table if not exists prophetpicks_bets (
  id            text primary key,
  match         text not null,
  market        text not null,
  type          text not null,
  stake         text not null,
  price         text not null,
  profit_loss   text not null,
  status        text not null,
  placed_at     timestamptz not null default now(),
  user_handle   text default 'demo'
);

create index if not exists prophetpicks_bets_placed_at_idx
  on prophetpicks_bets (placed_at desc);

create table if not exists prophetpicks_slips (
  id            text primary key,
  mode          text not null check (mode in ('simple', 'combined')),
  stake_cents   integer not null check (stake_cents >= 0),
  saved_at      timestamptz not null default now(),
  user_handle   text default 'demo'
);

create table if not exists prophetpicks_slip_legs (
  slip_id          text not null references prophetpicks_slips(id) on delete cascade,
  position         smallint not null,
  event_id         text not null,
  market_id        text not null,
  selection_id     text not null,
  selection_label  text not null,
  decimal_odds     numeric(8, 4) not null check (decimal_odds > 1),
  primary key (slip_id, position)
);

create index if not exists prophetpicks_slip_legs_event_idx
  on prophetpicks_slip_legs (event_id);
