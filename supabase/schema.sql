create extension if not exists "pgcrypto";

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'inventory_variation'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.inventory_variation as enum ('silicone', 'colorida', 'carteira');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'log_reason'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.log_reason as enum ('venda', 'defeito', 'brinde', 'reposicao', 'ajuste');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'app_role'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.app_role as enum ('owner', 'manager', 'operator');
  end if;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role public.app_role;
begin
  if new.email = 'admin@gsm.com' then
    assigned_role := 'owner';
  else
    assigned_role := 'operator';
  end if;

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    assigned_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.app_role not null default 'operator',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  column_index integer not null check (column_index between 1 and 45),
  row_index integer not null check (row_index between 1 and 7),
  critical_silicone_threshold integer check (critical_silicone_threshold >= 0),
  critical_colorida_threshold integer check (critical_colorida_threshold >= 0),
  critical_carteira_threshold integer check (critical_carteira_threshold >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (brand_id, name),
  unique (column_index, row_index)
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models(id) on delete cascade,
  variation public.inventory_variation not null,
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (model_id, variation)
);

create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models(id) on delete cascade,
  variation public.inventory_variation not null,
  delta integer not null check (delta <> 0),
  reason public.log_reason not null,
  note text,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint logs_reason_delta_check check (
    (reason in ('venda', 'defeito', 'brinde') and delta < 0)
    or (reason in ('reposicao', 'ajuste') and delta > 0)
  )
);

alter table if exists public.profiles
  add column if not exists is_active boolean not null default true;

alter table if exists public.profiles
  add column if not exists role public.app_role not null default 'operator';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'models'
      and column_name = 'column'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'models'
      and column_name = 'column_index'
  ) then
    alter table public.models rename column "column" to column_index;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'models'
      and column_name = 'row'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'models'
      and column_name = 'row_index'
  ) then
    alter table public.models rename column "row" to row_index;
  end if;
end
$$;

alter table if exists public.models
  add column if not exists column_index integer;

alter table if exists public.models
  add column if not exists row_index integer;

alter table if exists public.models
  add column if not exists critical_silicone_threshold integer;

alter table if exists public.models
  add column if not exists critical_colorida_threshold integer;

alter table if exists public.models
  add column if not exists critical_carteira_threshold integer;

alter table if exists public.models
  add column if not exists created_by uuid;

alter table if exists public.models
  add column if not exists created_at timestamptz not null default timezone('utc', now());

alter table if exists public.models
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table if exists public.models
  add column if not exists brand_id uuid;

alter table if exists public.models
  add column if not exists name text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'models'
      and column_name = 'critical_threshold'
  ) then
    execute $sql$
      update public.models
      set
        critical_silicone_threshold = coalesce(critical_silicone_threshold, critical_threshold),
        critical_colorida_threshold = coalesce(critical_colorida_threshold, critical_threshold),
        critical_carteira_threshold = coalesce(critical_carteira_threshold, critical_threshold)
    $sql$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'models_created_by_fkey'
      and conrelid = 'public.models'::regclass
  ) then
    alter table public.models
      add constraint models_created_by_fkey
      foreign key (created_by) references public.profiles(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'models_column_index_check'
      and conrelid = 'public.models'::regclass
  ) then
    alter table public.models add constraint models_column_index_check check (column_index between 1 and 45) not valid;
    alter table public.models validate constraint models_column_index_check;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'models_row_index_check'
      and conrelid = 'public.models'::regclass
  ) then
    alter table public.models add constraint models_row_index_check check (row_index between 1 and 7) not valid;
    alter table public.models validate constraint models_row_index_check;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'models_critical_silicone_threshold_check'
      and conrelid = 'public.models'::regclass
  ) then
    alter table public.models
      add constraint models_critical_silicone_threshold_check
      check (critical_silicone_threshold is null or critical_silicone_threshold >= 0) not valid;
    alter table public.models validate constraint models_critical_silicone_threshold_check;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'models_critical_colorida_threshold_check'
      and conrelid = 'public.models'::regclass
  ) then
    alter table public.models
      add constraint models_critical_colorida_threshold_check
      check (critical_colorida_threshold is null or critical_colorida_threshold >= 0) not valid;
    alter table public.models validate constraint models_critical_colorida_threshold_check;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'models_critical_carteira_threshold_check'
      and conrelid = 'public.models'::regclass
  ) then
    alter table public.models
      add constraint models_critical_carteira_threshold_check
      check (critical_carteira_threshold is null or critical_carteira_threshold >= 0) not valid;
    alter table public.models validate constraint models_critical_carteira_threshold_check;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'models'
      and column_name = 'brand_id'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'models'
      and column_name = 'name'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'models_brand_id_name_key'
      and conrelid = 'public.models'::regclass
  ) then
    alter table public.models add constraint models_brand_id_name_key unique (brand_id, name);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'models_column_index_row_index_key'
      and conrelid = 'public.models'::regclass
  ) then
    alter table public.models add constraint models_column_index_row_index_key unique (column_index, row_index);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'models_brand_id_fkey'
      and conrelid = 'public.models'::regclass
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'brands'
      and column_name = 'id'
      and udt_name = 'uuid'
  ) then
    alter table public.models
      add constraint models_brand_id_fkey
      foreign key (brand_id) references public.brands(id) on delete cascade;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inventory'
      and column_name = 'model'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inventory'
      and column_name = 'model_id'
  ) then
    alter table public.inventory rename column model to model_id;
  end if;
end
$$;

alter table if exists public.inventory
  add column if not exists model_id uuid;

alter table if exists public.inventory
  add column if not exists variation public.inventory_variation;

alter table if exists public.inventory
  add column if not exists quantity integer;

alter table if exists public.inventory
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.inventory
set quantity = 0
where quantity is null;

alter table if exists public.inventory
  alter column quantity set default 0;

alter table if exists public.inventory
  alter column quantity set not null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inventory'
      and column_name = 'variation'
      and udt_name = 'text'
  ) then
    execute $sql$
      alter table public.inventory
      alter column variation type public.inventory_variation
      using lower(trim(variation))::public.inventory_variation
    $sql$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_model_id_fkey'
      and conrelid = 'public.inventory'::regclass
  ) then
    alter table public.inventory
      add constraint inventory_model_id_fkey
      foreign key (model_id) references public.models(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_quantity_check'
      and conrelid = 'public.inventory'::regclass
  ) then
    alter table public.inventory add constraint inventory_quantity_check check (quantity >= 0) not valid;
    alter table public.inventory validate constraint inventory_quantity_check;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_model_id_variation_key'
      and conrelid = 'public.inventory'::regclass
  ) then
    alter table public.inventory add constraint inventory_model_id_variation_key unique (model_id, variation);
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'logs'
      and column_name = 'model'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'logs'
      and column_name = 'model_id'
  ) then
    alter table public.logs rename column model to model_id;
  end if;
end
$$;

alter table if exists public.logs
  add column if not exists model_id uuid;

alter table if exists public.logs
  add column if not exists variation public.inventory_variation;

alter table if exists public.logs
  add column if not exists delta integer;

alter table if exists public.logs
  add column if not exists reason public.log_reason;

alter table if exists public.logs
  add column if not exists note text;

alter table if exists public.logs
  add column if not exists actor_id uuid;

alter table if exists public.logs
  add column if not exists created_at timestamptz not null default timezone('utc', now());

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'logs'
      and column_name = 'variation'
      and udt_name = 'text'
  ) then
    execute $sql$
      alter table public.logs
      alter column variation type public.inventory_variation
      using lower(trim(variation))::public.inventory_variation
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'logs'
      and column_name = 'reason'
      and udt_name = 'text'
  ) then
    execute $sql$
      alter table public.logs
      alter column reason type public.log_reason
      using lower(trim(reason))::public.log_reason
    $sql$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'logs_model_id_fkey'
      and conrelid = 'public.logs'::regclass
  ) then
    alter table public.logs
      add constraint logs_model_id_fkey
      foreign key (model_id) references public.models(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'logs_actor_id_fkey'
      and conrelid = 'public.logs'::regclass
  ) then
    alter table public.logs
      add constraint logs_actor_id_fkey
      foreign key (actor_id) references public.profiles(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'logs_delta_check'
      and conrelid = 'public.logs'::regclass
  ) then
    alter table public.logs add constraint logs_delta_check check (delta <> 0) not valid;
    alter table public.logs validate constraint logs_delta_check;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'logs_reason_delta_check'
      and conrelid = 'public.logs'::regclass
  ) then
    alter table public.logs
      add constraint logs_reason_delta_check
      check (
        (reason in ('venda', 'defeito', 'brinde') and delta < 0)
        or (reason in ('reposicao', 'ajuste') and delta > 0)
      ) not valid;
    alter table public.logs validate constraint logs_reason_delta_check;
  end if;
end
$$;

create index if not exists idx_models_position on public.models (column_index, row_index);
create index if not exists idx_inventory_model on public.inventory (model_id);
create index if not exists idx_logs_created_at on public.logs (created_at desc);
create index if not exists idx_logs_model_variation on public.logs (model_id, variation, created_at desc);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_brands_updated_at on public.brands;
create trigger set_brands_updated_at
before update on public.brands
for each row
execute function public.set_updated_at();

drop trigger if exists set_models_updated_at on public.models;
create trigger set_models_updated_at
before update on public.models
for each row
execute function public.set_updated_at();

drop trigger if exists set_inventory_updated_at on public.inventory;
create trigger set_inventory_updated_at
before update on public.inventory
for each row
execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active = true
      and role in ('owner', 'manager', 'operator')
  );
$$;

create or replace function public.can_manage_catalog()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active = true
      and role in ('owner', 'manager')
  );
$$;

create or replace function public.apply_inventory_log(
  p_model_id uuid,
  p_variation public.inventory_variation,
  p_delta integer,
  p_reason public.log_reason,
  p_note text default null
)
returns public.logs
language plpgsql
security definer
set search_path = public
as $$
declare
  current_quantity integer;
  updated_log public.logs;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.is_staff() then
    raise exception 'INSUFFICIENT_PERMISSIONS';
  end if;

  if p_delta = 0 then
    raise exception 'DELTA_CANNOT_BE_ZERO';
  end if;

  if (
    (p_reason in ('venda', 'defeito', 'brinde') and p_delta > 0)
    or (p_reason = 'reposicao' and p_delta < 0)
  ) then
    raise exception 'INVALID_REASON_FOR_DELTA';
  end if;

  insert into public.inventory (model_id, variation, quantity)
  values (p_model_id, p_variation, 0)
  on conflict (model_id, variation) do nothing;

  select quantity
  into current_quantity
  from public.inventory
  where model_id = p_model_id
    and variation = p_variation
  for update;

  if current_quantity + p_delta < 0 then
    raise exception 'INSUFFICIENT_STOCK';
  end if;

  update public.inventory
  set quantity = quantity + p_delta
  where model_id = p_model_id
    and variation = p_variation;

  insert into public.logs (model_id, variation, delta, reason, note, actor_id)
  values (p_model_id, p_variation, p_delta, p_reason, p_note, auth.uid())
  returning *
  into updated_log;

  return updated_log;
end;
$$;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'brands' and column_name = 'id' and udt_name = 'uuid') and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'models' and column_name = 'brand_id' and udt_name = 'uuid') then
    execute $sql$
      create or replace view public.v_inventory_dashboard as
      select
        m.id as model_id,
        b.name as brand_name,
        m.name as model_name,
        m.column_index,
        m.row_index,
        m.critical_silicone_threshold,
        m.critical_colorida_threshold,
        m.critical_carteira_threshold,
        i.variation,
        i.quantity,
        (i.quantity = 0) as is_out_of_stock,
        (
          (i.variation = 'silicone' and m.critical_silicone_threshold is not null and i.quantity <= m.critical_silicone_threshold)
          or (i.variation = 'colorida' and m.critical_colorida_threshold is not null and i.quantity <= m.critical_colorida_threshold)
          or (i.variation = 'carteira' and m.critical_carteira_threshold is not null and i.quantity <= m.critical_carteira_threshold)
        ) as is_critical
      from public.models m
      join public.brands b on b.id = m.brand_id
      join public.inventory i on i.model_id = m.id;
    $sql$;
  else
    execute $sql$
      create or replace view public.v_inventory_dashboard as
      select
        null::uuid as model_id,
        null::text as brand_name,
        null::text as model_name,
        null::integer as column_index,
        null::integer as row_index,
        null::integer as critical_silicone_threshold,
        null::integer as critical_colorida_threshold,
        null::integer as critical_carteira_threshold,
        null::public.inventory_variation as variation,
        null::integer as quantity,
        null::boolean as is_out_of_stock,
        null::boolean as is_critical
      where false;
    $sql$;
  end if;
end
$$;

create or replace function public.dashboard_summary()
returns table (
  total_models bigint,
  total_units bigint,
  occupied_hooks bigint,
  out_of_stock_items bigint,
  critical_items bigint
)
language sql
stable
as $$
  select
    (select count(*) from public.models) as total_models,
    coalesce((select sum(quantity)::bigint from public.inventory), 0) as total_units,
    (select count(*) from public.models) as occupied_hooks,
    (select count(*) from public.v_inventory_dashboard where is_out_of_stock) as out_of_stock_items,
    (select count(*) from public.v_inventory_dashboard where is_critical) as critical_items;
$$;

alter table public.profiles enable row level security;
alter table public.brands enable row level security;
alter table public.models enable row level security;
alter table public.inventory enable row level security;
alter table public.logs enable row level security;

drop policy if exists "profiles_select_self_or_staff" on public.profiles;
create policy "profiles_select_self_or_staff"
on public.profiles
for select
using (id = auth.uid() or public.can_manage_catalog());

drop policy if exists "profiles_update_self_or_staff" on public.profiles;
create policy "profiles_update_self_or_staff"
on public.profiles
for update
using (id = auth.uid() or public.can_manage_catalog())
with check (id = auth.uid() or public.can_manage_catalog());

drop policy if exists "staff_can_read_brands" on public.brands;
create policy "staff_can_read_brands"
on public.brands
for select
using (public.is_staff());

drop policy if exists "managers_can_manage_brands" on public.brands;
create policy "managers_can_manage_brands"
on public.brands
for all
using (public.can_manage_catalog())
with check (public.can_manage_catalog());

drop policy if exists "staff_can_read_models" on public.models;
create policy "staff_can_read_models"
on public.models
for select
using (public.is_staff());

drop policy if exists "managers_can_manage_models" on public.models;
create policy "managers_can_manage_models"
on public.models
for all
using (public.can_manage_catalog())
with check (public.can_manage_catalog());

drop policy if exists "staff_can_read_inventory" on public.inventory;
create policy "staff_can_read_inventory"
on public.inventory
for select
using (public.is_staff());

drop policy if exists "managers_can_seed_inventory" on public.inventory;
create policy "managers_can_seed_inventory"
on public.inventory
for insert
with check (public.can_manage_catalog());

drop policy if exists "staff_can_read_logs" on public.logs;
create policy "staff_can_read_logs"
on public.logs
for select
using (public.is_staff());

grant usage on schema public to anon, authenticated;
grant select on public.profiles to authenticated;
grant select on public.brands to authenticated;
grant select on public.models to authenticated;
grant select on public.inventory to authenticated;
grant select on public.logs to authenticated;
grant insert, update on public.profiles to authenticated;
grant insert, update, delete on public.brands to authenticated;
grant insert, update, delete on public.models to authenticated;
grant insert on public.inventory to authenticated;
grant select on public.v_inventory_dashboard to authenticated;
grant execute on function public.dashboard_summary() to authenticated;
grant execute on function public.apply_inventory_log(uuid, public.inventory_variation, integer, public.log_reason, text) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime'
      and n.nspname = 'public'
      and c.relname = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;

  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime'
      and n.nspname = 'public'
      and c.relname = 'brands'
  ) then
    alter publication supabase_realtime add table public.brands;
  end if;

  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime'
      and n.nspname = 'public'
      and c.relname = 'models'
  ) then
    alter publication supabase_realtime add table public.models;
  end if;

  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime'
      and n.nspname = 'public'
      and c.relname = 'inventory'
  ) then
    alter publication supabase_realtime add table public.inventory;
  end if;

  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime'
      and n.nspname = 'public'
      and c.relname = 'logs'
  ) then
    alter publication supabase_realtime add table public.logs;
  end if;
end
$$;
