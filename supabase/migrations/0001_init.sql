-- RokiAi: esquema inicial. Usuário único; todas as linhas pertencem a owner_id = auth.uid().

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique default auth.uid() references auth.users on delete cascade,
  business_name text,
  pix_key text,
  default_setup_price numeric(12,2),
  default_monthly_price numeric(12,2),
  google_price_per_request numeric(10,4) not null default 0.035,
  google_monthly_alert int not null default 1000,
  created_at timestamptz not null default now()
);

create table public.api_usage (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  month text not null,
  requests int not null default 0,
  created_at timestamptz not null default now(),
  unique (owner_id, month)
);

create table public.place_marks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  google_place_id text not null,
  status text not null default 'ignored' check (status in ('ignored')),
  created_at timestamptz not null default now(),
  unique (owner_id, google_place_id)
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  google_place_id text,
  name text not null,
  phone text,
  phone_is_mobile boolean not null default false,
  city text,
  category text,
  source text not null default 'manual' check (source in ('google', 'manual')),
  stage text not null default 'novo' check (stage in ('novo', 'contatado', 'proposta', 'fechado', 'perdido')),
  next_contact_at date,
  lost_reason text,
  contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index leads_owner_place_uidx on public.leads (owner_id, google_place_id) where google_place_id is not null;
create index leads_owner_stage_idx on public.leads (owner_id, stage);

create table public.lead_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  lead_id uuid not null references public.leads on delete cascade,
  type text not null check (type in ('note', 'stage_change', 'whatsapp')),
  body text,
  created_at timestamptz not null default now()
);
create index lead_events_lead_idx on public.lead_events (lead_id);

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('approach', 'followup', 'charge')),
  name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  lead_id uuid references public.leads on delete set null,
  company text not null,
  contact_name text,
  phone text,
  email text,
  city text,
  site_url text,
  setup_total numeric(12,2) not null default 0,
  setup_installments int not null default 1 check (setup_installments >= 1),
  monthly_fee numeric(12,2) not null default 0,
  due_day int check (due_day between 1 and 28),
  start_date date,
  status text not null default 'active' check (status in ('active', 'canceled')),
  canceled_at date,
  notes text,
  created_at timestamptz not null default now()
);
create index clients_lead_idx on public.clients (lead_id);

create table public.charges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  client_id uuid not null references public.clients on delete cascade,
  type text not null check (type in ('setup', 'monthly')),
  competence date,
  description text not null,
  amount numeric(12,2) not null,
  due_date date not null,
  paid_at date,
  method text not null default 'pix',
  notes text,
  created_at timestamptz not null default now()
);
create unique index charges_monthly_uidx on public.charges (client_id, type, competence) where type = 'monthly';
create index charges_client_idx on public.charges (client_id);
create index charges_owner_due_idx on public.charges (owner_id, due_date);

-- owner_id indexes para as policies
create index api_usage_owner_idx on public.api_usage (owner_id);
create index place_marks_owner_idx on public.place_marks (owner_id);
create index lead_events_owner_idx on public.lead_events (owner_id);
create index message_templates_owner_idx on public.message_templates (owner_id);
create index clients_owner_idx on public.clients (owner_id);

-- RLS
do $$
declare t text;
begin
  foreach t in array array['settings','api_usage','place_marks','leads','lead_events','message_templates','clients','charges'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner_all" on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;

-- contador de chamadas ao Google
create or replace function public.increment_api_usage(p_month text)
returns int
language sql
security invoker
set search_path = ''
as $$
  insert into public.api_usage (owner_id, month, requests)
  values ((select auth.uid()), p_month, 1)
  on conflict (owner_id, month) do update set requests = public.api_usage.requests + 1
  returning requests;
$$;

-- updated_at automático em leads
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger leads_touch before update on public.leads
for each row execute function public.touch_updated_at();
