create view public.today_contacts
with (security_invoker = true)
as
with attempt_summary as (
  select
    purchase_id,
    count(*) filter (where status = 'sent')::integer as attempts_count,
    max(attempt_date) filter (where status = 'sent') as last_attempt_date
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

grant select on public.today_contacts to authenticated;
