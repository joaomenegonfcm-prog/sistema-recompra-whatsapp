alter table public.customers
  add column if not exists opt_out boolean not null default false,
  add column if not exists opt_out_at timestamptz null,
  add column if not exists opt_out_reason text null,
  add column if not exists opt_out_updated_at timestamptz null,
  add column if not exists opt_out_updated_by uuid null references auth.users(id) on delete set null;

create index if not exists customers_user_opt_out_idx
  on public.customers (user_id, opt_out);

create or replace function public.set_customer_opt_out(
  p_customer_id uuid,
  p_opt_out boolean,
  p_reason text
)
returns table (
  customer_id uuid,
  opt_out boolean,
  opt_out_at timestamptz,
  opt_out_reason text,
  opt_out_updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if p_customer_id is null then
    raise exception 'Cliente é obrigatório';
  end if;

  if p_opt_out is null then
    raise exception 'Status de opt-out é obrigatório';
  end if;

  if v_reason = '' then
    raise exception 'Motivo é obrigatório';
  end if;

  perform 1
  from public.customers
  where id = p_customer_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Cliente não encontrado';
  end if;

  update public.customers
  set opt_out = p_opt_out,
      opt_out_at = case when p_opt_out then now() else null end,
      opt_out_reason = v_reason,
      opt_out_updated_at = now(),
      opt_out_updated_by = v_user_id
  where id = p_customer_id
    and user_id = v_user_id
  returning
    customers.id,
    customers.opt_out,
    customers.opt_out_at,
    customers.opt_out_reason,
    customers.opt_out_updated_at
  into
    customer_id,
    opt_out,
    opt_out_at,
    opt_out_reason,
    opt_out_updated_at;

  return next;
end;
$$;

revoke all on function public.set_customer_opt_out(uuid, boolean, text) from public;
grant execute on function public.set_customer_opt_out(uuid, boolean, text) to authenticated;

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
  left join attempt_summary a on a.purchase_id = p.id
  left join public.settings s on s.user_id = p.user_id
  where p.status in ('active', 'in_followup')
    and coalesce(c.opt_out, false) = false
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

grant select on public.today_contacts to authenticated;
