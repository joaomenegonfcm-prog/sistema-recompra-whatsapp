begin;

alter table public.purchase_status_history
  add column if not exists change_source text not null default 'manual',
  add column if not exists metadata jsonb;

update public.purchase_status_history
set metadata = '{}'::jsonb
where metadata is null;

alter table public.purchase_status_history
  alter column changed_by drop not null,
  alter column metadata set default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'purchase_status_history_change_source_check'
      and conrelid = 'public.purchase_status_history'::regclass
  ) then
    alter table public.purchase_status_history
      add constraint purchase_status_history_change_source_check
      check (change_source in ('manual', 'system_inactivity', 'contact_attempt', 'new_purchase'));
  end if;
end;
$$;

create index if not exists purchases_customer_purchase_date_created_at_idx
  on public.purchases (customer_id, purchase_date desc, created_at desc, id);

create index if not exists purchase_status_history_purchase_created_at_idx
  on public.purchase_status_history (purchase_id, created_at desc);

create or replace view public.customer_activity_summary
with (security_invoker = true)
as
with purchase_totals as (
  select
    p.customer_id,
    p.user_id,
    max(p.purchase_date) as last_purchase_date,
    count(*)::integer as total_purchases
  from public.purchases p
  group by p.customer_id, p.user_id
),
latest_purchase as (
  select distinct on (p.customer_id, p.user_id)
    p.customer_id,
    p.user_id,
    p.id as latest_purchase_id,
    p.status as latest_purchase_status
  from public.purchases p
  order by p.customer_id, p.user_id, p.purchase_date desc, p.created_at desc, p.id desc
),
auto_pause_history as (
  select
    p.customer_id,
    h.user_id,
    true as has_auto_paused_purchase,
    max(h.created_at) as last_auto_pause_at
  from public.purchase_status_history h
  join public.purchases p
    on p.id = h.purchase_id
   and p.user_id = h.user_id
  where h.change_source = 'system_inactivity'
  group by p.customer_id, h.user_id
)
select
  c.id as customer_id,
  c.user_id,
  pt.last_purchase_date,
  case
    when pt.last_purchase_date is null then null
    else (timezone('America/Sao_Paulo', now())::date - pt.last_purchase_date)::integer
  end as days_since_last_purchase,
  case
    when pt.last_purchase_date is null then 'no_purchases'
    when (timezone('America/Sao_Paulo', now())::date - pt.last_purchase_date) <= 30 then 'active'
    when (timezone('America/Sao_Paulo', now())::date - pt.last_purchase_date) <= 90 then 'cooling'
    else 'cold'
  end as activity_status,
  lp.latest_purchase_id,
  lp.latest_purchase_status,
  coalesce(pt.total_purchases, 0) as total_purchases,
  coalesce(aph.has_auto_paused_purchase, false) as has_auto_paused_purchase,
  aph.last_auto_pause_at
from public.customers c
left join purchase_totals pt
  on pt.customer_id = c.id
 and pt.user_id = c.user_id
left join latest_purchase lp
  on lp.customer_id = c.id
 and lp.user_id = c.user_id
left join auto_pause_history aph
  on aph.customer_id = c.id
 and aph.user_id = c.user_id;

revoke all on table public.customer_activity_summary from public;
revoke all on table public.customer_activity_summary from anon, authenticated;
grant select on table public.customer_activity_summary to authenticated;
grant select on table public.customer_activity_summary to service_role;

create or replace function public.pause_cold_customers()
returns table (
  customers_found integer,
  purchases_paused integer,
  executed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_executed_at timestamptz := now();
  v_reason text := 'Pausado automaticamente pelo sistema: cliente sem nova compra há mais de 90 dias.';
begin
  return query
  with cold_customers as (
    select
      s.customer_id,
      s.user_id,
      s.last_purchase_date,
      s.days_since_last_purchase
    from public.customer_activity_summary s
    where s.activity_status = 'cold'
  ),
  candidates as (
    select
      p.id as purchase_id,
      p.user_id,
      p.customer_id,
      p.status as old_status,
      c.last_purchase_date,
      c.days_since_last_purchase
    from public.purchases p
    join cold_customers c
      on c.customer_id = p.customer_id
     and c.user_id = p.user_id
    where p.status in ('active', 'in_followup')
  ),
  updated as (
    update public.purchases p
    set status = 'paused',
        updated_at = v_executed_at
    from candidates c
    where p.id = c.purchase_id
      and p.user_id = c.user_id
      and p.status in ('active', 'in_followup')
    returning
      p.id as purchase_id,
      p.user_id,
      p.customer_id,
      c.old_status,
      c.last_purchase_date,
      c.days_since_last_purchase
  ),
  inserted_history as (
    insert into public.purchase_status_history (
      user_id,
      purchase_id,
      changed_by,
      old_status,
      new_status,
      reason,
      attempt_handling,
      change_source,
      metadata,
      created_at
    )
    select
      u.user_id,
      u.purchase_id,
      null::uuid,
      u.old_status,
      'paused'::public.purchase_status,
      v_reason,
      'keep',
      'system_inactivity',
      jsonb_build_object(
        'source', 'system_inactivity',
        'customer_id', u.customer_id,
        'last_purchase_date', u.last_purchase_date,
        'days_since_last_purchase', u.days_since_last_purchase
      ),
      v_executed_at
    from updated u
    returning 1
  )
  select
    (select count(distinct customer_id)::integer from candidates),
    (select count(*)::integer from updated),
    v_executed_at;
end;
$$;

revoke all on function public.pause_cold_customers() from public;
revoke all on function public.pause_cold_customers() from anon;
revoke all on function public.pause_cold_customers() from authenticated;
revoke all on function public.pause_cold_customers() from service_role;
grant execute on function public.pause_cold_customers() to postgres;

create or replace function public.change_purchase_status(
  p_purchase_id uuid,
  p_new_status public.purchase_status,
  p_reason text,
  p_attempt_handling text default 'keep'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status_change_id uuid := gen_random_uuid();
  v_user_id uuid := auth.uid();
  v_old_status public.purchase_status;
  v_reason text;
  v_customer_id uuid;
  v_customer_phone text;
  v_purchase_date date;
  v_purchase_created_at timestamptz;
  v_customer_activity_status text;
  v_max_attempts integer;
  v_attempt_handling text;
  v_valid_attempts_before integer;
  v_voided_attempt_ids uuid[] := array[]::uuid[];
  v_voided_attempts integer := 0;
  v_metadata jsonb;
  v_transition_allowed boolean := false;
  v_has_newer_purchase boolean := false;
begin
  if v_user_id is null then
    raise exception 'Usuario nao autenticado';
  end if;

  v_reason := trim(coalesce(p_reason, ''));
  v_attempt_handling := trim(coalesce(p_attempt_handling, ''));

  if v_reason = '' then
    raise exception 'Motivo e obrigatorio';
  end if;

  if p_new_status is null then
    raise exception 'Status e obrigatorio';
  end if;

  if v_attempt_handling not in ('keep', 'void_attempts') then
    raise exception 'Tratamento de tentativas invalido';
  end if;

  select
    p.status,
    p.customer_id,
    p.purchase_date,
    p.created_at,
    c.phone
  into
    v_old_status,
    v_customer_id,
    v_purchase_date,
    v_purchase_created_at,
    v_customer_phone
  from public.purchases p
  join public.customers c
    on c.id = p.customer_id
   and c.user_id = p.user_id
  where p.id = p_purchase_id
    and p.user_id = v_user_id
  for update of p;

  if not found then
    raise exception 'Compra nao encontrada';
  end if;

  if v_old_status = 'repurchased' or p_new_status = 'repurchased' then
    raise exception 'O status Recomprado e controlado automaticamente pelo sistema e nao pode ser alterado manualmente.';
  end if;

  if p_new_status = v_old_status then
    raise exception 'O novo status deve ser diferente do status atual';
  end if;

  if v_attempt_handling = 'void_attempts'
    and not (v_old_status = 'in_followup' and p_new_status = 'active') then
    raise exception 'A anulacao de tentativas so e permitida ao corrigir uma compra de Em acompanhamento para Ativo.';
  end if;

  if p_new_status = 'active' then
    select s.activity_status
    into v_customer_activity_status
    from public.customer_activity_summary s
    where s.customer_id = v_customer_id
      and s.user_id = v_user_id;

    if v_customer_activity_status = 'cold' then
      raise exception 'O cliente continua classificado como Frio. Registre uma nova compra para iniciar um novo ciclo de recompra.';
    end if;
  end if;

  select count(*)::integer
  into v_valid_attempts_before
  from public.contact_attempts
  where purchase_id = p_purchase_id
    and user_id = v_user_id
    and status = 'sent'
    and voided_at is null;

  select coalesce(max_attempts, 3)
  into v_max_attempts
  from public.settings
  where user_id = v_user_id;

  v_max_attempts := coalesce(v_max_attempts, 3);

  v_transition_allowed :=
    (v_old_status = 'active' and p_new_status in ('paused', 'cancelled'))
    or (v_old_status = 'in_followup' and p_new_status in ('active', 'paused', 'cancelled'))
    or (v_old_status = 'paused' and p_new_status in ('active', 'in_followup', 'cancelled'))
    or (v_old_status = 'cancelled' and p_new_status = 'paused');

  if not v_transition_allowed then
    raise exception 'Transicao de status nao permitida';
  end if;

  if v_old_status = 'paused' and p_new_status = 'in_followup' then
    if v_valid_attempts_before < 1 or v_valid_attempts_before >= v_max_attempts then
      raise exception 'Para voltar para Em acompanhamento, a compra precisa ter tentativas validas abaixo do limite maximo.';
    end if;
  end if;

  if (v_old_status = 'paused' and p_new_status = 'active')
    or (v_old_status = 'in_followup' and p_new_status = 'active')
    or (v_old_status = 'cancelled' and p_new_status = 'paused') then
    select exists (
      select 1
      from public.purchases newer
      join public.customers newer_customer
        on newer_customer.id = newer.customer_id
       and newer_customer.user_id = newer.user_id
      where newer.user_id = v_user_id
        and newer.id <> p_purchase_id
        and (
          newer.purchase_date > v_purchase_date
          or (
            newer.purchase_date = v_purchase_date
            and newer.created_at > v_purchase_created_at
          )
        )
        and (
          newer.customer_id = v_customer_id
          or newer_customer.phone = v_customer_phone
        )
    )
    into v_has_newer_purchase;

    if v_has_newer_purchase then
      raise exception 'Nao e possivel reativar esta compra porque existe uma compra mais recente para este cliente.';
    end if;
  end if;

  if v_attempt_handling = 'void_attempts' then
    select coalesce(array_agg(id order by attempt_number, created_at), array[]::uuid[])
    into v_voided_attempt_ids
    from public.contact_attempts
    where purchase_id = p_purchase_id
      and user_id = v_user_id
      and status = 'sent'
      and voided_at is null;

    v_voided_attempts := cardinality(v_voided_attempt_ids);

    update public.contact_attempts
    set voided_at = now(),
        voided_by = v_user_id,
        voided_reason = v_reason,
        voided_status_change_id = v_status_change_id
    where id = any(v_voided_attempt_ids);

    v_metadata := jsonb_build_object(
      'validAttemptsBefore', v_valid_attempts_before,
      'voidedAttempts', v_voided_attempts,
      'voidedAttemptIds', to_jsonb(v_voided_attempt_ids),
      'source', 'manual'
    );
  else
    v_metadata := jsonb_build_object('source', 'manual');
  end if;

  update public.purchases
  set status = p_new_status,
      updated_at = now()
  where id = p_purchase_id
    and user_id = v_user_id;

  insert into public.purchase_status_history (
    id,
    user_id,
    purchase_id,
    changed_by,
    old_status,
    new_status,
    reason,
    attempt_handling,
    change_source,
    metadata
  )
  values (
    v_status_change_id,
    v_user_id,
    p_purchase_id,
    v_user_id,
    v_old_status,
    p_new_status,
    v_reason,
    v_attempt_handling,
    'manual',
    v_metadata
  );

  return v_status_change_id;
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
  v_customer_id uuid;
  v_customer_activity_status text;
begin
  if v_user_id is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if nullif(trim(p_message), '') is null then
    raise exception 'Mensagem e obrigatoria';
  end if;

  select p.customer_id
  into v_customer_id
  from public.purchases p
  where p.id = p_purchase_id
    and p.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Compra nao encontrada';
  end if;

  select s.activity_status
  into v_customer_activity_status
  from public.customer_activity_summary s
  where s.customer_id = v_customer_id
    and s.user_id = v_user_id;

  if v_customer_activity_status = 'cold' then
    raise exception 'O cliente esta classificado como Frio e nao pode receber uma nova tentativa de contato. Registre uma nova compra para iniciar um novo ciclo.';
  end if;

  select coalesce(max_attempts, 3)
  into v_max_attempts
  from public.settings
  where user_id = v_user_id;

  v_max_attempts := coalesce(v_max_attempts, 3);

  select count(*)::integer + 1
  into v_next_attempt
  from public.contact_attempts
  where purchase_id = p_purchase_id
    and user_id = v_user_id
    and status = 'sent'
    and voided_at is null;

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
  end,
      updated_at = now()
  where id = p_purchase_id
    and user_id = v_user_id;

  return v_attempt_id;
end;
$$;

create or replace view public.today_contacts
with (security_invoker = true)
as
with attempt_summary as (
  select
    purchase_id,
    count(*) filter (where status = 'sent' and voided_at is null)::integer as attempts_count,
    max(attempt_date) filter (where status = 'sent' and voided_at is null) as last_attempt_date
  from public.contact_attempts
  group by purchase_id
),
contacts as (
  select
    p.id as purchase_id,
    p.customer_id,
    c.name as customer_name,
    c.phone,
    coalesce(c.opt_out, false) as customer_opt_out,
    p.product,
    p.purchase_date,
    p.reorder_date,
    p.status,
    coalesce(a.attempts_count, 0) as attempts_count,
    case coalesce(a.attempts_count, 0)
      when 0 then 1
      when 1 then 2
      when 2 then 3
      else null
    end as next_attempt_number,
    case coalesce(a.attempts_count, 0)
      when 0 then p.reorder_date
      when 1 then (a.last_attempt_date::date + coalesce(s.second_attempt_after_days, 7))
      when 2 then (a.last_attempt_date::date + coalesce(s.third_attempt_after_days, 15))
      else null
    end as next_contact_date,
    p.user_id
  from public.purchases p
  join public.customers c
    on c.id = p.customer_id
   and c.user_id = p.user_id
  join public.customer_activity_summary activity
    on activity.customer_id = p.customer_id
   and activity.user_id = p.user_id
  left join attempt_summary a on a.purchase_id = p.id
  left join public.settings s on s.user_id = p.user_id
  where p.status in ('active', 'in_followup')
    and coalesce(c.opt_out, false) = false
    and activity.activity_status <> 'cold'
    and coalesce(a.attempts_count, 0) < coalesce(s.max_attempts, 3)
)
select
  purchase_id,
  customer_id,
  customer_name,
  phone,
  product,
  purchase_date,
  reorder_date,
  status,
  attempts_count,
  next_attempt_number,
  next_contact_date,
  user_id,
  customer_opt_out
from contacts
where next_contact_date <= current_date;

revoke all on table public.today_contacts from public;
revoke all on table public.today_contacts from anon, authenticated;
grant select on table public.today_contacts to authenticated;
grant select on table public.today_contacts to service_role;

revoke all on function public.change_purchase_status(uuid, public.purchase_status, text, text) from public;
revoke all on function public.change_purchase_status(uuid, public.purchase_status, text, text) from anon;
revoke all on function public.change_purchase_status(uuid, public.purchase_status, text, text) from authenticated;
grant execute on function public.change_purchase_status(uuid, public.purchase_status, text, text) to authenticated;

revoke all on function public.register_contact_attempt(uuid, text) from public;
revoke all on function public.register_contact_attempt(uuid, text) from anon;
revoke all on function public.register_contact_attempt(uuid, text) from authenticated;
grant execute on function public.register_contact_attempt(uuid, text) to authenticated;

do $$
begin
  if to_regclass('cron.job') is not null
    and to_regprocedure('cron.schedule(text,text,text)') is not null
    and to_regprocedure('cron.unschedule(text)') is not null then
    execute $cron$
      select cron.unschedule('pause-cold-customers-daily')
      where exists (
        select 1
        from cron.job
        where jobname = 'pause-cold-customers-daily'
      )
    $cron$;

    execute $cron$
      select cron.schedule(
        'pause-cold-customers-daily',
        '15 3 * * *',
        'select public.pause_cold_customers();'
      )
    $cron$;
  else
    raise notice 'pg_cron nao disponivel; execute select public.pause_cold_customers(); por rotina interna apos ativar pg_cron.';
  end if;
end;
$$;

commit;
