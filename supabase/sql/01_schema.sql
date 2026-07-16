create extension if not exists "pgcrypto";

create type public.purchase_status as enum (
  'active',
  'in_followup',
  'repurchased',
  'paused',
  'cancelled'
);

create type public.attempt_status as enum (
  'sent',
  'failed',
  'cancelled'
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, phone)
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  product text not null,
  purchase_date date not null,
  reorder_days integer not null default 30,
  reorder_date date not null,
  status public.purchase_status not null default 'active',
  observation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchases_reorder_days_positive check (reorder_days > 0)
);

create table public.contact_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  attempt_number integer not null,
  attempt_date timestamptz not null default now(),
  channel text not null default 'whatsapp',
  message text not null,
  status public.attempt_status not null default 'sent',
  created_at timestamptz not null default now(),
  constraint contact_attempts_number_range check (attempt_number between 1 and 3),
  unique (purchase_id, attempt_number)
);

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  default_reorder_days integer not null default 30,
  second_attempt_after_days integer not null default 7,
  third_attempt_after_days integer not null default 15,
  max_attempts integer not null default 3,
  default_message_template text not null default E'Olá, {{cliente}}! Tudo bem? 😊\n\nJá faz um tempo desde sua compra de {{produto}}.\nGostaria de repor seu estoque?\n\nSe quiser, posso te ajudar por aqui mesmo.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index purchases_user_status_reorder_date_idx
  on public.purchases (user_id, status, reorder_date);

create index purchases_customer_status_idx
  on public.purchases (customer_id, status);

create index contact_attempts_purchase_status_idx
  on public.contact_attempts (purchase_id, status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create trigger purchases_set_updated_at
before update on public.purchases
for each row execute function public.set_updated_at();

create trigger settings_set_updated_at
before update on public.settings
for each row execute function public.set_updated_at();
