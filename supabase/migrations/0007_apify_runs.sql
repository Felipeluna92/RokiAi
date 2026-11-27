-- Buscas feitas na Apify (Google Maps Scraper): andamento, quantidade e custo.
create table public.apify_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  run_id text not null unique,
  city text not null,
  category text not null,
  max_places int not null,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed', 'aborted')),
  scraped int,
  cost_usd numeric(10,4),
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index apify_runs_owner_created_idx on public.apify_runs (owner_id, created_at desc);
alter table public.apify_runs enable row level security;
create policy "owner_all" on public.apify_runs for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

alter table public.settings add column apify_monthly_alert_usd numeric(10,2) not null default 4.5;
