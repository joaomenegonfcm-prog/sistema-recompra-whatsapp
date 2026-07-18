create table if not exists public.purchase_status_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  changed_by uuid not null references auth.users(id) on delete cascade,
  old_status public.purchase_status not null,
  new_status public.purchase_status not null,
  reason text not null,
  attempt_handling text not null default 'keep',
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint purchase_status_history_attempt_handling_check
    check (attempt_handling in ('keep', 'void_attempts'))
);

create index if not exists purchase_status_history_purchase_id_idx
  on public.purchase_status_history (purchase_id);

create index if not exists purchase_status_history_user_id_idx
  on public.purchase_status_history (user_id);

create index if not exists purchase_status_history_created_at_idx
  on public.purchase_status_history (created_at);

alter table public.purchase_status_history enable row level security;

revoke insert, update, delete on public.purchase_status_history from anon, authenticated;
grant select on public.purchase_status_history to authenticated;

drop policy if exists "purchase_status_history_select_own" on public.purchase_status_history;
create policy "purchase_status_history_select_own"
on public.purchase_status_history for select
using ((select auth.uid()) = user_id);

alter table public.contact_attempts
  add column if not exists voided_at timestamptz null,
  add column if not exists voided_by uuid null,
  add column if not exists voided_reason text null,
  add column if not exists voided_status_change_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'contact_attempts_voided_by_fkey'
      and conrelid = 'public.contact_attempts'::regclass
  ) then
    alter table public.contact_attempts
      add constraint contact_attempts_voided_by_fkey
      foreign key (voided_by)
      references auth.users(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'contact_attempts_voided_status_change_id_fkey'
      and conrelid = 'public.contact_attempts'::regclass
  ) then
    alter table public.contact_attempts
      add constraint contact_attempts_voided_status_change_id_fkey
      foreign key (voided_status_change_id)
      references public.purchase_status_history(id)
      on delete set null
      deferrable initially deferred;
  end if;
end;
$$;

create index if not exists contact_attempts_voided_at_idx
  on public.contact_attempts (voided_at);

create index if not exists contact_attempts_voided_status_change_id_idx
  on public.contact_attempts (voided_status_change_id);

alter table public.contact_attempts
  drop constraint if exists contact_attempts_unique,
  drop constraint if exists contact_attempts_purchase_id_attempt_number_key;

create unique index if not exists contact_attempts_valid_purchase_attempt_number_idx
  on public.contact_attempts (purchase_id, attempt_number)
  where status = 'sent' and voided_at is null;

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
    raise exception 'Usuário não autenticado';
  end if;

  v_reason := trim(coalesce(p_reason, ''));
  v_attempt_handling := trim(coalesce(p_attempt_handling, ''));

  if v_reason = '' then
    raise exception 'Motivo é obrigatório';
  end if;

  if p_new_status is null then
    raise exception 'Status é obrigatório';
  end if;

  if v_attempt_handling not in ('keep', 'void_attempts') then
    raise exception 'Tratamento de tentativas inválido';
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
    raise exception 'Compra não encontrada';
  end if;

  if v_old_status = 'repurchased' or p_new_status = 'repurchased' then
    raise exception 'O status Recomprado é controlado automaticamente pelo sistema e não pode ser alterado manualmente.';
  end if;

  if p_new_status = v_old_status then
    raise exception 'O novo status deve ser diferente do status atual';
  end if;

  if v_attempt_handling = 'void_attempts'
    and not (v_old_status = 'in_followup' and p_new_status = 'active') then
    raise exception 'A anulação de tentativas só é permitida ao corrigir uma compra de Em acompanhamento para Ativo.';
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
    raise exception 'Transição de status não permitida';
  end if;

  if v_old_status = 'paused' and p_new_status = 'in_followup' then
    if v_valid_attempts_before < 1 or v_valid_attempts_before >= v_max_attempts then
      raise exception 'Para voltar para Em acompanhamento, a compra precisa ter tentativas válidas abaixo do limite máximo.';
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
      raise exception 'Não é possível reativar esta compra porque existe uma compra mais recente para este cliente.';
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
    v_metadata
  );

  return v_status_change_id;
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
  left join attempt_summary a on a.purchase_id = p.id
  left join public.settings s on s.user_id = p.user_id
  where p.status in ('active', 'in_followup')
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
  user_id
from contacts
where next_contact_date <= current_date;

revoke all on function public.change_purchase_status(uuid, public.purchase_status, text, text) from public;
grant execute on function public.change_purchase_status(uuid, public.purchase_status, text, text) to authenticated;

grant select on public.today_contacts to authenticated;
