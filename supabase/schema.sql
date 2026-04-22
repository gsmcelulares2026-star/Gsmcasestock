create extension if not exists "pgcrypto";

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  column_index integer not null check (column_index between 1 and 45),
  row_index integer not null check (row_index between 1 and 7),
  critical_threshold integer not null default 2,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (brand_id, name),
  unique (column_index, row_index)
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models(id) on delete cascade,
  variation text not null check (variation in ('silicone', 'colorida', 'carteira')),
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (model_id, variation)
);

create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models(id) on delete cascade,
  variation text not null check (variation in ('silicone', 'colorida', 'carteira')),
  delta integer not null,
  reason text not null,
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_models_position on public.models (column_index, row_index);
create index if not exists idx_logs_created_at on public.logs (created_at desc);
