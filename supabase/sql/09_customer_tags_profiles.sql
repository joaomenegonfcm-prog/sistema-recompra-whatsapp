begin;

create unique index if not exists customers_id_user_id_idx
  on public.customers (id, user_id);

create table if not exists public.customer_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_tags_name_not_blank check (btrim(name) <> ''),
  constraint customer_tags_name_length check (char_length(btrim(name)) <= 40),
  constraint customer_tags_color_check
    check (color in ('neutral', 'blue', 'green', 'yellow', 'orange', 'purple'))
);

create unique index if not exists customer_tags_user_name_unique_idx
  on public.customer_tags (user_id, lower(btrim(name)));

create unique index if not exists customer_tags_id_user_id_idx
  on public.customer_tags (id, user_id);

create table if not exists public.customer_tag_assignments (
  customer_id uuid not null,
  tag_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, tag_id),
  constraint customer_tag_assignments_customer_fkey
    foreign key (customer_id, user_id)
    references public.customers (id, user_id)
    on delete cascade,
  constraint customer_tag_assignments_tag_fkey
    foreign key (tag_id, user_id)
    references public.customer_tags (id, user_id)
    on delete cascade
);

create index if not exists customer_tag_assignments_tag_id_idx
  on public.customer_tag_assignments (tag_id);

create index if not exists customer_tag_assignments_user_id_idx
  on public.customer_tag_assignments (user_id);

create or replace function public.normalize_customer_profile_array(p_values text[])
returns text[]
language sql
immutable
set search_path = public
as $$
  select coalesce(array_agg(distinct value order by value), array[]::text[])
  from (
    select btrim(value) as value
    from unnest(coalesce(p_values, array[]::text[])) as input(value)
    where nullif(btrim(value), '') is not null
  ) normalized;
$$;

create or replace function public.customer_profile_array_has_unique_values(p_values text[])
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(cardinality(p_values), 0) = (
    select count(distinct value)::integer
    from unnest(coalesce(p_values, array[]::text[])) as input(value)
  );
$$;

create table if not exists public.customer_profiles (
  customer_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  preferred_product text null,
  preferred_grind text null,
  preparation_methods text[] not null default array[]::text[],
  consumption_frequency text null,
  sensory_profiles text[] not null default array[]::text[],
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_profiles_customer_fkey
    foreign key (customer_id, user_id)
    references public.customers (id, user_id)
    on delete cascade,
  constraint customer_profiles_preferred_product_length
    check (preferred_product is null or char_length(preferred_product) <= 120),
  constraint customer_profiles_notes_length
    check (notes is null or char_length(notes) <= 1000),
  constraint customer_profiles_preferred_grind_check
    check (
      preferred_grind is null
      or preferred_grind in (
        'beans',
        'extra_fine',
        'fine',
        'medium_fine',
        'medium',
        'medium_coarse',
        'coarse'
      )
    ),
  constraint customer_profiles_preparation_methods_check
    check (
      array_position(preparation_methods, null) is null
      and public.customer_profile_array_has_unique_values(preparation_methods)
      and preparation_methods <@ array[
        'espresso',
        'electric_coffee_maker',
        'cloth_filter',
        'paper_filter',
        'french_press',
        'moka',
        'aeropress',
        'v60',
        'chemex',
        'other'
      ]::text[]
    ),
  constraint customer_profiles_consumption_frequency_check
    check (
      consumption_frequency is null
      or consumption_frequency in (
        'occasional',
        'few_times_week',
        'once_day',
        'twice_day',
        'three_plus_day'
      )
    ),
  constraint customer_profiles_sensory_profiles_check
    check (
      array_position(sensory_profiles, null) is null
      and public.customer_profile_array_has_unique_values(sensory_profiles)
      and sensory_profiles <@ array[
        'sweet',
        'fruity',
        'citrus',
        'floral',
        'chocolate',
        'caramel',
        'nuts',
        'intense',
        'mild'
      ]::text[]
    )
);

create index if not exists customer_profiles_user_id_idx
  on public.customer_profiles (user_id);

create or replace function public.normalize_customer_tag()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.name = btrim(new.name);
  new.color = btrim(new.color);
  return new;
end;
$$;

create or replace function public.normalize_customer_profile()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.preferred_product = nullif(btrim(coalesce(new.preferred_product, '')), '');
  new.preferred_grind = nullif(btrim(coalesce(new.preferred_grind, '')), '');
  new.consumption_frequency = nullif(btrim(coalesce(new.consumption_frequency, '')), '');
  new.notes = nullif(btrim(coalesce(new.notes, '')), '');
  new.preparation_methods = public.normalize_customer_profile_array(new.preparation_methods);
  new.sensory_profiles = public.normalize_customer_profile_array(new.sensory_profiles);
  return new;
end;
$$;

drop trigger if exists customer_tags_normalize on public.customer_tags;
create trigger customer_tags_normalize
before insert or update on public.customer_tags
for each row execute function public.normalize_customer_tag();

drop trigger if exists customer_tags_set_updated_at on public.customer_tags;
create trigger customer_tags_set_updated_at
before update on public.customer_tags
for each row execute function public.set_updated_at();

drop trigger if exists customer_profiles_normalize on public.customer_profiles;
create trigger customer_profiles_normalize
before insert or update on public.customer_profiles
for each row execute function public.normalize_customer_profile();

drop trigger if exists customer_profiles_set_updated_at on public.customer_profiles;
create trigger customer_profiles_set_updated_at
before update on public.customer_profiles
for each row execute function public.set_updated_at();

alter table public.customer_tags enable row level security;
alter table public.customer_tag_assignments enable row level security;
alter table public.customer_profiles enable row level security;

drop policy if exists "customer_tags_select_own" on public.customer_tags;
create policy "customer_tags_select_own"
on public.customer_tags for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "customer_tags_insert_own" on public.customer_tags;
create policy "customer_tags_insert_own"
on public.customer_tags for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "customer_tags_update_own" on public.customer_tags;
create policy "customer_tags_update_own"
on public.customer_tags for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "customer_tags_delete_own" on public.customer_tags;
create policy "customer_tags_delete_own"
on public.customer_tags for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "customer_tag_assignments_select_own" on public.customer_tag_assignments;
create policy "customer_tag_assignments_select_own"
on public.customer_tag_assignments for select
to authenticated
using (
  (select auth.uid()) = customer_tag_assignments.user_id
  and exists (
    select 1
    from public.customers c
    where c.id = customer_tag_assignments.customer_id
      and c.user_id = customer_tag_assignments.user_id
  )
  and exists (
    select 1
    from public.customer_tags t
    where t.id = customer_tag_assignments.tag_id
      and t.user_id = customer_tag_assignments.user_id
  )
);

drop policy if exists "customer_tag_assignments_insert_own" on public.customer_tag_assignments;
create policy "customer_tag_assignments_insert_own"
on public.customer_tag_assignments for insert
to authenticated
with check (
  (select auth.uid()) = customer_tag_assignments.user_id
  and exists (
    select 1
    from public.customers c
    where c.id = customer_tag_assignments.customer_id
      and c.user_id = customer_tag_assignments.user_id
  )
  and exists (
    select 1
    from public.customer_tags t
    where t.id = customer_tag_assignments.tag_id
      and t.user_id = customer_tag_assignments.user_id
  )
);

drop policy if exists "customer_tag_assignments_delete_own" on public.customer_tag_assignments;
create policy "customer_tag_assignments_delete_own"
on public.customer_tag_assignments for delete
to authenticated
using (
  (select auth.uid()) = customer_tag_assignments.user_id
  and exists (
    select 1
    from public.customers c
    where c.id = customer_tag_assignments.customer_id
      and c.user_id = customer_tag_assignments.user_id
  )
  and exists (
    select 1
    from public.customer_tags t
    where t.id = customer_tag_assignments.tag_id
      and t.user_id = customer_tag_assignments.user_id
  )
);

drop policy if exists "customer_profiles_select_own" on public.customer_profiles;
create policy "customer_profiles_select_own"
on public.customer_profiles for select
to authenticated
using (
  (select auth.uid()) = customer_profiles.user_id
  and exists (
    select 1
    from public.customers c
    where c.id = customer_profiles.customer_id
      and c.user_id = customer_profiles.user_id
  )
);

drop policy if exists "customer_profiles_insert_own" on public.customer_profiles;
create policy "customer_profiles_insert_own"
on public.customer_profiles for insert
to authenticated
with check (
  (select auth.uid()) = customer_profiles.user_id
  and exists (
    select 1
    from public.customers c
    where c.id = customer_profiles.customer_id
      and c.user_id = customer_profiles.user_id
  )
);

drop policy if exists "customer_profiles_update_own" on public.customer_profiles;
create policy "customer_profiles_update_own"
on public.customer_profiles for update
to authenticated
using (
  (select auth.uid()) = customer_profiles.user_id
  and exists (
    select 1
    from public.customers c
    where c.id = customer_profiles.customer_id
      and c.user_id = customer_profiles.user_id
  )
)
with check (
  (select auth.uid()) = customer_profiles.user_id
  and exists (
    select 1
    from public.customers c
    where c.id = customer_profiles.customer_id
      and c.user_id = customer_profiles.user_id
  )
);

drop policy if exists "customer_profiles_delete_own" on public.customer_profiles;
create policy "customer_profiles_delete_own"
on public.customer_profiles for delete
to authenticated
using (
  (select auth.uid()) = customer_profiles.user_id
  and exists (
    select 1
    from public.customers c
    where c.id = customer_profiles.customer_id
      and c.user_id = customer_profiles.user_id
  )
);

create or replace function public.create_customer_tag(
  p_name text,
  p_color text
)
returns public.customer_tags
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_color text := btrim(coalesce(p_color, ''));
  v_tag public.customer_tags%rowtype;
begin
  if v_user_id is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if v_name = '' then
    raise exception 'Nome da tag e obrigatorio';
  end if;

  if char_length(v_name) > 40 then
    raise exception 'Nome da tag deve ter no maximo 40 caracteres';
  end if;

  if v_color not in ('neutral', 'blue', 'green', 'yellow', 'orange', 'purple') then
    raise exception 'Cor da tag invalida';
  end if;

  insert into public.customer_tags (user_id, name, color)
  values (v_user_id, v_name, v_color)
  returning * into v_tag;

  return v_tag;
exception
  when unique_violation then
    raise exception 'Tag ja existe para este usuario';
end;
$$;

create or replace function public.update_customer_tag(
  p_tag_id uuid,
  p_name text,
  p_color text
)
returns public.customer_tags
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_color text := btrim(coalesce(p_color, ''));
  v_tag public.customer_tags%rowtype;
begin
  if v_user_id is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if p_tag_id is null then
    raise exception 'Tag e obrigatoria';
  end if;

  if v_name = '' then
    raise exception 'Nome da tag e obrigatorio';
  end if;

  if char_length(v_name) > 40 then
    raise exception 'Nome da tag deve ter no maximo 40 caracteres';
  end if;

  if v_color not in ('neutral', 'blue', 'green', 'yellow', 'orange', 'purple') then
    raise exception 'Cor da tag invalida';
  end if;

  update public.customer_tags
  set name = v_name,
      color = v_color
  where id = p_tag_id
    and user_id = v_user_id
  returning * into v_tag;

  if not found then
    raise exception 'Tag nao encontrada';
  end if;

  return v_tag;
exception
  when unique_violation then
    raise exception 'Tag ja existe para este usuario';
end;
$$;

create or replace function public.delete_customer_tag(p_tag_id uuid)
returns table (deleted_tag_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if p_tag_id is null then
    raise exception 'Tag e obrigatoria';
  end if;

  delete from public.customer_tags
  where id = p_tag_id
    and user_id = v_user_id
  returning id into deleted_tag_id;

  if not found then
    raise exception 'Tag nao encontrada';
  end if;

  return next;
end;
$$;

create or replace function public.ensure_default_customer_tags()
returns setof public.customer_tags
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Usuario nao autenticado';
  end if;

  insert into public.customer_tags (user_id, name, color)
  values
    (v_user_id, 'Cliente fiel', 'green'),
    (v_user_id, 'Cliente novo', 'blue'),
    (v_user_id, 'Compra mensal', 'purple'),
    (v_user_id, 'Compra esporádica', 'yellow'),
    (v_user_id, 'Alto valor', 'orange'),
    (v_user_id, 'Não respondeu', 'neutral'),
    (v_user_id, 'Prefere promoção', 'purple')
  on conflict do nothing;

  return query
  with default_tags(name, sort_order) as (
    values
      ('Cliente fiel', 1),
      ('Cliente novo', 2),
      ('Compra mensal', 3),
      ('Compra esporádica', 4),
      ('Alto valor', 5),
      ('Não respondeu', 6),
      ('Prefere promoção', 7)
  )
  select t.*
  from public.customer_tags t
  join default_tags d
    on lower(btrim(t.name)) = lower(btrim(d.name))
  where t.user_id = v_user_id
  order by d.sort_order;
end;
$$;

create or replace function public.set_customer_tags(
  p_customer_id uuid,
  p_tag_ids uuid[] default array[]::uuid[]
)
returns setof public.customer_tags
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tag_ids uuid[];
  v_invalid_tags integer;
begin
  if v_user_id is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if p_customer_id is null then
    raise exception 'Cliente e obrigatorio';
  end if;

  perform 1
  from public.customers
  where id = p_customer_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Cliente nao encontrado';
  end if;

  select coalesce(array_agg(distinct tag_id order by tag_id), array[]::uuid[])
  into v_tag_ids
  from unnest(coalesce(p_tag_ids, array[]::uuid[])) as input(tag_id)
  where tag_id is not null;

  select count(*)::integer
  into v_invalid_tags
  from unnest(v_tag_ids) as input(tag_id)
  left join public.customer_tags t
    on t.id = input.tag_id
   and t.user_id = v_user_id
  where t.id is null;

  if v_invalid_tags > 0 then
    raise exception 'Uma ou mais tags sao invalidas';
  end if;

  delete from public.customer_tag_assignments
  where customer_id = p_customer_id
    and user_id = v_user_id
    and not (tag_id = any(v_tag_ids));

  insert into public.customer_tag_assignments (customer_id, tag_id, user_id)
  select p_customer_id, tag_id, v_user_id
  from unnest(v_tag_ids) as input(tag_id)
  on conflict (customer_id, tag_id) do nothing;

  return query
  select t.*
  from public.customer_tags t
  join public.customer_tag_assignments a
    on a.tag_id = t.id
   and a.user_id = t.user_id
  where a.customer_id = p_customer_id
    and a.user_id = v_user_id
  order by lower(btrim(t.name)), t.created_at;
end;
$$;

create or replace function public.upsert_customer_profile(
  p_customer_id uuid,
  p_preferred_product text default null,
  p_preferred_grind text default null,
  p_preparation_methods text[] default array[]::text[],
  p_consumption_frequency text default null,
  p_sensory_profiles text[] default array[]::text[],
  p_notes text default null
)
returns public.customer_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_preferred_product text := nullif(btrim(coalesce(p_preferred_product, '')), '');
  v_preferred_grind text := nullif(btrim(coalesce(p_preferred_grind, '')), '');
  v_preparation_methods text[] := public.normalize_customer_profile_array(p_preparation_methods);
  v_consumption_frequency text := nullif(btrim(coalesce(p_consumption_frequency, '')), '');
  v_sensory_profiles text[] := public.normalize_customer_profile_array(p_sensory_profiles);
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_profile public.customer_profiles%rowtype;
begin
  if v_user_id is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if p_customer_id is null then
    raise exception 'Cliente e obrigatorio';
  end if;

  perform 1
  from public.customers
  where id = p_customer_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Cliente nao encontrado';
  end if;

  if v_preferred_product is not null and char_length(v_preferred_product) > 120 then
    raise exception 'Produto preferido deve ter no maximo 120 caracteres';
  end if;

  if v_notes is not null and char_length(v_notes) > 1000 then
    raise exception 'Notas devem ter no maximo 1000 caracteres';
  end if;

  if v_preferred_grind is not null
    and v_preferred_grind not in (
      'beans',
      'extra_fine',
      'fine',
      'medium_fine',
      'medium',
      'medium_coarse',
      'coarse'
    ) then
    raise exception 'Moagem preferida invalida';
  end if;

  if exists (
    select 1
    from unnest(v_preparation_methods) as input(value)
    where value not in (
      'espresso',
      'electric_coffee_maker',
      'cloth_filter',
      'paper_filter',
      'french_press',
      'moka',
      'aeropress',
      'v60',
      'chemex',
      'other'
    )
  ) then
    raise exception 'Metodo de preparo invalido';
  end if;

  if v_consumption_frequency is not null
    and v_consumption_frequency not in (
      'occasional',
      'few_times_week',
      'once_day',
      'twice_day',
      'three_plus_day'
    ) then
    raise exception 'Frequencia de consumo invalida';
  end if;

  if exists (
    select 1
    from unnest(v_sensory_profiles) as input(value)
    where value not in (
      'sweet',
      'fruity',
      'citrus',
      'floral',
      'chocolate',
      'caramel',
      'nuts',
      'intense',
      'mild'
    )
  ) then
    raise exception 'Perfil sensorial invalido';
  end if;

  insert into public.customer_profiles (
    customer_id,
    user_id,
    preferred_product,
    preferred_grind,
    preparation_methods,
    consumption_frequency,
    sensory_profiles,
    notes
  )
  values (
    p_customer_id,
    v_user_id,
    v_preferred_product,
    v_preferred_grind,
    v_preparation_methods,
    v_consumption_frequency,
    v_sensory_profiles,
    v_notes
  )
  on conflict (customer_id) do update
    set preferred_product = excluded.preferred_product,
        preferred_grind = excluded.preferred_grind,
        preparation_methods = excluded.preparation_methods,
        consumption_frequency = excluded.consumption_frequency,
        sensory_profiles = excluded.sensory_profiles,
        notes = excluded.notes,
        updated_at = now()
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on table public.customer_tags from public;
revoke all on table public.customer_tag_assignments from public;
revoke all on table public.customer_profiles from public;
revoke all on table public.customer_tags from anon, authenticated;
revoke all on table public.customer_tag_assignments from anon, authenticated;
revoke all on table public.customer_profiles from anon, authenticated;

revoke insert, update, delete, truncate, references, trigger
on table public.customer_tags
from authenticated;

revoke insert, update, delete, truncate, references, trigger
on table public.customer_tag_assignments
from authenticated;

revoke insert, update, delete, truncate, references, trigger
on table public.customer_profiles
from authenticated;

grant select on table public.customer_tags to authenticated;
grant select on table public.customer_tag_assignments to authenticated;
grant select on table public.customer_profiles to authenticated;

grant all on table public.customer_tags to service_role;
grant all on table public.customer_tag_assignments to service_role;
grant all on table public.customer_profiles to service_role;

revoke all on function public.normalize_customer_profile_array(text[]) from public;
revoke all on function public.customer_profile_array_has_unique_values(text[]) from public;
revoke all on function public.normalize_customer_tag() from public;
revoke all on function public.normalize_customer_profile() from public;
revoke all on function public.create_customer_tag(text, text) from public;
revoke all on function public.update_customer_tag(uuid, text, text) from public;
revoke all on function public.delete_customer_tag(uuid) from public;
revoke all on function public.ensure_default_customer_tags() from public;
revoke all on function public.set_customer_tags(uuid, uuid[]) from public;
revoke all on function public.upsert_customer_profile(uuid, text, text, text[], text, text[], text) from public;

revoke all on function public.create_customer_tag(text, text) from anon;
revoke all on function public.update_customer_tag(uuid, text, text) from anon;
revoke all on function public.delete_customer_tag(uuid) from anon;
revoke all on function public.ensure_default_customer_tags() from anon;
revoke all on function public.set_customer_tags(uuid, uuid[]) from anon;
revoke all on function public.upsert_customer_profile(uuid, text, text, text[], text, text[], text) from anon;

grant execute on function public.normalize_customer_profile_array(text[]) to authenticated, service_role;
grant execute on function public.customer_profile_array_has_unique_values(text[]) to authenticated, service_role;
grant execute on function public.create_customer_tag(text, text) to authenticated;
grant execute on function public.update_customer_tag(uuid, text, text) to authenticated;
grant execute on function public.delete_customer_tag(uuid) to authenticated;
grant execute on function public.ensure_default_customer_tags() to authenticated;
grant execute on function public.set_customer_tags(uuid, uuid[]) to authenticated;
grant execute on function public.upsert_customer_profile(uuid, text, text, text[], text, text[], text) to authenticated;

commit;
