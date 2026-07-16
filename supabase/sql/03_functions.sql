create or replace function public.create_default_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.create_default_settings();

create or replace function public.create_purchase_cycle(
  p_customer_name text,
  p_phone text,
  p_product text,
  p_purchase_date date,
  p_reorder_days integer default 30,
  p_observation text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_customer_id uuid;
  v_purchase_id uuid;
  v_purchase_created_at timestamptz;
  v_has_newer_purchase boolean;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if nullif(trim(p_customer_name), '') is null then
    raise exception 'Nome do cliente é obrigatório';
  end if;

  if nullif(trim(p_phone), '') is null then
    raise exception 'Telefone é obrigatório';
  end if;

  if nullif(trim(p_product), '') is null then
    raise exception 'Produto é obrigatório';
  end if;

  if p_purchase_date is null then
    raise exception 'Data da compra é obrigatória';
  end if;

  if p_reorder_days is null or p_reorder_days <= 0 then
    raise exception 'Dias para recompra deve ser maior que zero';
  end if;

  insert into public.customers (user_id, name, phone)
  values (v_user_id, trim(p_customer_name), trim(p_phone))
  on conflict (user_id, phone) do update
    set name = excluded.name,
        updated_at = now()
  returning id into v_customer_id;

  insert into public.purchases (
    user_id,
    customer_id,
    product,
    purchase_date,
    reorder_days,
    reorder_date,
    status,
    observation
  )
  values (
    v_user_id,
    v_customer_id,
    trim(p_product),
    p_purchase_date,
    p_reorder_days,
    p_purchase_date + p_reorder_days,
    'active',
    p_observation
  )
  returning id, created_at into v_purchase_id, v_purchase_created_at;

  update public.purchases
  set status = 'repurchased'
  where user_id = v_user_id
    and customer_id = v_customer_id
    and id <> v_purchase_id
    and status in ('active', 'in_followup')
    and (
      purchase_date < p_purchase_date
      or (
        purchase_date = p_purchase_date
        and created_at < v_purchase_created_at
      )
    );

  select exists (
    select 1
    from public.purchases
    where user_id = v_user_id
      and customer_id = v_customer_id
      and id <> v_purchase_id
      and (
        purchase_date > p_purchase_date
        or (
          purchase_date = p_purchase_date
          and created_at > v_purchase_created_at
        )
      )
  )
  into v_has_newer_purchase;

  if v_has_newer_purchase then
    update public.purchases
    set status = 'repurchased'
    where id = v_purchase_id
      and user_id = v_user_id;
  end if;

  return v_purchase_id;
end;
$$;

create or replace function public.register_contact_attempt(
  p_purchase_id uuid,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_max_attempts integer;
  v_next_attempt integer;
  v_attempt_id uuid;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if nullif(trim(p_message), '') is null then
    raise exception 'Mensagem é obrigatória';
  end if;

  perform 1
  from public.purchases
  where id = p_purchase_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Compra não encontrada';
  end if;

  select coalesce(max_attempts, 3)
  into v_max_attempts
  from public.settings
  where user_id = v_user_id;

  v_max_attempts := coalesce(v_max_attempts, 3);

  select coalesce(max(attempt_number), 0) + 1
  into v_next_attempt
  from public.contact_attempts
  where purchase_id = p_purchase_id
    and user_id = v_user_id;

  if v_next_attempt > v_max_attempts then
    update public.purchases
    set status = 'paused'
    where id = p_purchase_id
      and user_id = v_user_id;

    raise exception 'Limite de tentativas atingido';
  end if;

  insert into public.contact_attempts (
    user_id,
    purchase_id,
    attempt_number,
    message
  )
  values (
    v_user_id,
    p_purchase_id,
    v_next_attempt,
    p_message
  )
  returning id into v_attempt_id;

  update public.purchases
  set status = case
    when v_next_attempt < v_max_attempts then 'in_followup'::public.purchase_status
    else 'paused'::public.purchase_status
  end
  where id = p_purchase_id
    and user_id = v_user_id;

  return v_attempt_id;
end;
$$;

create or replace function public.pause_purchase(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  update public.purchases
  set status = 'paused'
  where id = p_purchase_id
    and user_id = auth.uid();
end;
$$;

create or replace function public.cancel_purchase(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  update public.purchases
  set status = 'cancelled'
  where id = p_purchase_id
    and user_id = auth.uid();
end;
$$;

revoke all on function public.create_default_settings() from public;
revoke all on function public.create_purchase_cycle(text, text, text, date, integer, text) from public;
revoke all on function public.register_contact_attempt(uuid, text) from public;
revoke all on function public.pause_purchase(uuid) from public;
revoke all on function public.cancel_purchase(uuid) from public;

grant execute on function public.create_purchase_cycle(text, text, text, date, integer, text) to authenticated;
grant execute on function public.register_contact_attempt(uuid, text) to authenticated;
grant execute on function public.pause_purchase(uuid) to authenticated;
grant execute on function public.cancel_purchase(uuid) to authenticated;
