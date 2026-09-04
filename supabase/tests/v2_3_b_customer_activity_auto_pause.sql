-- V2.3-B - Manual SQL tests for customer activity and automatic pause.
--
-- Run only in a test Supabase project or a local database.
-- 1. Apply supabase/sql/10_customer_activity_auto_pause.sql first.
-- 2. Replace v2_3_b.user_a and v2_3_b.user_b below with existing auth.users.id values.
-- 3. Run the whole file. It is wrapped in a transaction and ends with rollback.

begin;

select set_config(
  'v2_3_b.user_a',
  '00000000-0000-0000-0000-000000000001',
  true
);

select set_config(
  'v2_3_b.user_b',
  '00000000-0000-0000-0000-000000000002',
  true
);

select
  current_setting('v2_3_b.user_a')::uuid as user_a,
  current_setting('v2_3_b.user_b')::uuid as user_b;

select
  exists (
    select 1
    from auth.users
    where id = current_setting('v2_3_b.user_a')::uuid
  ) as user_a_exists,
  exists (
    select 1
    from auth.users
    where id = current_setting('v2_3_b.user_b')::uuid
  ) as user_b_exists;

do $$
declare
  v_count integer;
begin
  if current_setting('v2_3_b.user_a')::uuid = '00000000-0000-0000-0000-000000000001'
    or current_setting('v2_3_b.user_b')::uuid = '00000000-0000-0000-0000-000000000002' then
    raise exception 'Replace v2_3_b.user_a and v2_3_b.user_b with existing test auth.users IDs before running this file.';
  end if;

  if not exists (select 1 from auth.users where id = current_setting('v2_3_b.user_a')::uuid)
    or not exists (select 1 from auth.users where id = current_setting('v2_3_b.user_b')::uuid) then
    raise exception 'Configured V2.3-B test users must exist in auth.users.';
  end if;

  if to_regclass('public.customer_activity_summary') is null then
    raise exception 'customer_activity_summary view is missing';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'customer_activity_summary'
      and c.reloptions @> array['security_invoker=true']
  ) then
    raise exception 'customer_activity_summary must use security_invoker';
  end if;

  select count(*)::integer
  into v_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'customer_activity_summary'
    and column_name in (
      'customer_id',
      'user_id',
      'last_purchase_date',
      'days_since_last_purchase',
      'activity_status',
      'latest_purchase_id',
      'latest_purchase_status',
      'total_purchases',
      'has_auto_paused_purchase',
      'last_auto_pause_at'
    );

  if v_count <> 10 then
    raise exception 'customer_activity_summary does not expose all expected columns';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'purchase_status_history'
      and column_name = 'change_source'
  ) then
    raise exception 'purchase_status_history.change_source is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'purchase_status_history'
      and column_name = 'changed_by'
      and is_nullable = 'YES'
  ) then
    raise exception 'purchase_status_history.changed_by must accept NULL for system actions';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'purchase_status_history_change_source_check'
      and conrelid = 'public.purchase_status_history'::regclass
  ) then
    raise exception 'purchase_status_history change_source constraint is missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'purchases'
      and indexname = 'purchases_customer_purchase_date_created_at_idx'
  ) then
    raise exception 'purchases customer/date index is missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'purchase_status_history'
      and indexname = 'purchase_status_history_purchase_created_at_idx'
  ) then
    raise exception 'purchase_status_history purchase/created_at index is missing';
  end if;

  if has_table_privilege('anon', 'public.customer_activity_summary', 'SELECT')
    or not has_table_privilege('authenticated', 'public.customer_activity_summary', 'SELECT')
    or not has_table_privilege('service_role', 'public.customer_activity_summary', 'SELECT') then
    raise exception 'customer_activity_summary grants are incorrect';
  end if;

  if has_function_privilege('anon', 'public.pause_cold_customers()', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.pause_cold_customers()', 'EXECUTE') then
    raise exception 'pause_cold_customers must not be executable by anon or authenticated';
  end if;

  if not has_function_privilege('postgres', 'public.pause_cold_customers()', 'EXECUTE') then
    raise exception 'pause_cold_customers must be executable by postgres for internal scheduling';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where n.nspname = 'public'
      and p.proname = 'pause_cold_customers'
      and a.grantee = 0
      and a.privilege_type = 'EXECUTE'
  ) then
    raise exception 'PUBLIC must not execute pause_cold_customers';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.change_purchase_status(uuid, public.purchase_status, text, text)',
    'EXECUTE'
  )
    or not has_function_privilege(
      'authenticated',
      'public.register_contact_attempt(uuid, text)',
      'EXECUTE'
    ) then
    raise exception 'authenticated must keep execute access to normal RPCs';
  end if;

  if to_regclass('cron.job') is null
    or to_regprocedure('cron.schedule(text,text,text)') is null then
    raise notice 'pg_cron metadata is unavailable; cron job check skipped';
  else
    if not exists (
      select 1
      from cron.job
      where jobname = 'pause-cold-customers-daily'
        and schedule = '15 3 * * *'
        and command = 'select public.pause_cold_customers();'
        and active
    ) then
      raise exception 'pause-cold-customers-daily cron job metadata is incorrect';
    end if;
  end if;

  raise notice 'V2.3-B structure, grants, indexes, and cron metadata checks passed';
end;
$$;

do $$
declare
  v_user_a uuid := current_setting('v2_3_b.user_a')::uuid;
  v_user_b uuid := current_setting('v2_3_b.user_b')::uuid;
  v_today date := timezone('America/Sao_Paulo', now())::date;
begin
  insert into public.settings (user_id)
  values (v_user_a), (v_user_b)
  on conflict (user_id) do nothing;

  insert into public.customers (id, user_id, name, phone)
  values
    ('30000000-0000-0000-0000-000000000001', v_user_a, 'Boundary Hoje', '+559923000001'),
    ('30000000-0000-0000-0000-000000000002', v_user_a, 'Boundary 30', '+559923000002'),
    ('30000000-0000-0000-0000-000000000003', v_user_a, 'Boundary 31', '+559923000003'),
    ('30000000-0000-0000-0000-000000000004', v_user_a, 'Boundary 90', '+559923000004'),
    ('30000000-0000-0000-0000-000000000005', v_user_a, 'Boundary 91', '+559923000005'),
    ('30000000-0000-0000-0000-000000000006', v_user_a, 'Sem Compras', '+559923000006'),
    ('30000000-0000-0000-0000-000000000007', v_user_a, 'Multiplas Compras', '+559923000007'),
    ('30000000-0000-0000-0000-000000000008', v_user_a, 'Desempate Created', '+559923000008'),
    ('30000000-0000-0000-0000-000000000009', v_user_a, 'Cold Active', '+559923000009'),
    ('30000000-0000-0000-0000-000000000010', v_user_a, 'Cold Followup', '+559923000010'),
    ('30000000-0000-0000-0000-000000000011', v_user_a, 'Cold Paused', '+559923000011'),
    ('30000000-0000-0000-0000-000000000012', v_user_a, 'Cold Repurchased', '+559923000012'),
    ('30000000-0000-0000-0000-000000000013', v_user_a, 'Cooling Active', '+559923000013'),
    ('30000000-0000-0000-0000-000000000014', v_user_a, 'Active Active', '+559923000014'),
    ('30000000-0000-0000-0000-000000000015', v_user_a, 'Cold Today Contacts', '+559923000015'),
    ('30000000-0000-0000-0000-000000000016', v_user_a, 'Cooling Today Contacts', '+559923000016'),
    ('30000000-0000-0000-0000-000000000017', v_user_a, 'Cold Reactivate', '+559923000017'),
    ('30000000-0000-0000-0000-000000000018', v_user_b, 'User B Cold', '+559923000018');

  insert into public.purchases (
    id,
    user_id,
    customer_id,
    product,
    purchase_date,
    reorder_days,
    reorder_date,
    status,
    created_at
  )
  values
    ('40000000-0000-0000-0000-000000000001', v_user_a, '30000000-0000-0000-0000-000000000001', 'Cafe Hoje', v_today, 30, v_today + 30, 'active', now() - interval '1 hour'),
    ('40000000-0000-0000-0000-000000000002', v_user_a, '30000000-0000-0000-0000-000000000002', 'Cafe 30', v_today - 30, 30, v_today, 'active', now() - interval '1 hour'),
    ('40000000-0000-0000-0000-000000000003', v_user_a, '30000000-0000-0000-0000-000000000003', 'Cafe 31', v_today - 31, 30, v_today - 1, 'active', now() - interval '1 hour'),
    ('40000000-0000-0000-0000-000000000004', v_user_a, '30000000-0000-0000-0000-000000000004', 'Cafe 90', v_today - 90, 30, v_today - 60, 'active', now() - interval '1 hour'),
    ('40000000-0000-0000-0000-000000000005', v_user_a, '30000000-0000-0000-0000-000000000005', 'Cafe 91', v_today - 91, 30, v_today - 61, 'active', now() - interval '1 hour'),
    ('40000000-0000-0000-0000-000000000007', v_user_a, '30000000-0000-0000-0000-000000000007', 'Cafe Antigo', v_today - 120, 30, v_today - 90, 'repurchased', now() - interval '2 hours'),
    ('40000000-0000-0000-0000-000000000008', v_user_a, '30000000-0000-0000-0000-000000000007', 'Cafe Recente', v_today - 10, 30, v_today + 20, 'active', now() - interval '1 hour'),
    ('40000000-0000-0000-0000-000000000009', v_user_a, '30000000-0000-0000-0000-000000000008', 'Cafe Tie Old', v_today - 20, 30, v_today + 10, 'repurchased', now() - interval '2 hours'),
    ('40000000-0000-0000-0000-000000000010', v_user_a, '30000000-0000-0000-0000-000000000008', 'Cafe Tie New', v_today - 20, 30, v_today + 10, 'active', now() - interval '1 hour'),
    ('40000000-0000-0000-0000-000000000011', v_user_a, '30000000-0000-0000-0000-000000000009', 'Cafe Cold Active', v_today - 120, 30, v_today - 90, 'active', now() - interval '1 hour'),
    ('40000000-0000-0000-0000-000000000012', v_user_a, '30000000-0000-0000-0000-000000000010', 'Cafe Cold Followup', v_today - 120, 30, v_today - 90, 'in_followup', now() - interval '1 hour'),
    ('40000000-0000-0000-0000-000000000013', v_user_a, '30000000-0000-0000-0000-000000000011', 'Cafe Cold Paused', v_today - 120, 30, v_today - 90, 'paused', now() - interval '1 hour'),
    ('40000000-0000-0000-0000-000000000014', v_user_a, '30000000-0000-0000-0000-000000000012', 'Cafe Cold Repurchased', v_today - 120, 30, v_today - 90, 'repurchased', now() - interval '1 hour'),
    ('40000000-0000-0000-0000-000000000015', v_user_a, '30000000-0000-0000-0000-000000000013', 'Cafe Cooling Active', v_today - 31, 30, v_today - 1, 'active', now() - interval '1 hour'),
    ('40000000-0000-0000-0000-000000000016', v_user_a, '30000000-0000-0000-0000-000000000014', 'Cafe Active Active', v_today, 30, v_today + 30, 'active', now() - interval '1 hour'),
    ('40000000-0000-0000-0000-000000000017', v_user_a, '30000000-0000-0000-0000-000000000015', 'Cafe Cold Today', v_today - 120, 30, v_today - 90, 'active', now() - interval '1 hour'),
    ('40000000-0000-0000-0000-000000000018', v_user_a, '30000000-0000-0000-0000-000000000016', 'Cafe Cooling Today', v_today - 31, 30, v_today - 1, 'active', now() - interval '1 hour'),
    ('40000000-0000-0000-0000-000000000019', v_user_a, '30000000-0000-0000-0000-000000000017', 'Cafe Cold Reactivate', v_today - 120, 30, v_today - 90, 'paused', now() - interval '1 hour'),
    ('40000000-0000-0000-0000-000000000020', v_user_b, '30000000-0000-0000-0000-000000000018', 'Cafe B Cold', v_today - 120, 30, v_today - 90, 'active', now() - interval '1 hour');

  insert into public.contact_attempts (
    id,
    user_id,
    purchase_id,
    attempt_number,
    attempt_date,
    message,
    status
  )
  values (
    '50000000-0000-0000-0000-000000000001',
    v_user_a,
    '40000000-0000-0000-0000-000000000012',
    1,
    now() - interval '10 days',
    'Tentativa existente',
    'sent'
  );

  raise notice 'V2.3-B test data prepared';
end;
$$;

do $$
begin
  if not exists (
    select 1 from public.customer_activity_summary
    where customer_id = '30000000-0000-0000-0000-000000000001'
      and activity_status = 'active'
      and days_since_last_purchase = 0
      and total_purchases = 1
      and latest_purchase_id = '40000000-0000-0000-0000-000000000001'
  ) then raise exception 'today purchase should be active'; end if;

  if not exists (
    select 1 from public.customer_activity_summary
    where customer_id = '30000000-0000-0000-0000-000000000002'
      and activity_status = 'active'
      and days_since_last_purchase = 30
  ) then raise exception '30 days should be active'; end if;

  if not exists (
    select 1 from public.customer_activity_summary
    where customer_id = '30000000-0000-0000-0000-000000000003'
      and activity_status = 'cooling'
      and days_since_last_purchase = 31
  ) then raise exception '31 days should be cooling'; end if;

  if not exists (
    select 1 from public.customer_activity_summary
    where customer_id = '30000000-0000-0000-0000-000000000004'
      and activity_status = 'cooling'
      and days_since_last_purchase = 90
  ) then raise exception '90 days should be cooling'; end if;

  if not exists (
    select 1 from public.customer_activity_summary
    where customer_id = '30000000-0000-0000-0000-000000000005'
      and activity_status = 'cold'
      and days_since_last_purchase = 91
  ) then raise exception '91 days should be cold'; end if;

  if not exists (
    select 1 from public.customer_activity_summary
    where customer_id = '30000000-0000-0000-0000-000000000006'
      and activity_status = 'no_purchases'
      and days_since_last_purchase is null
      and total_purchases = 0
  ) then raise exception 'customer without purchases should be no_purchases'; end if;

  if not exists (
    select 1 from public.customer_activity_summary
    where customer_id = '30000000-0000-0000-0000-000000000007'
      and activity_status = 'active'
      and last_purchase_date = timezone('America/Sao_Paulo', now())::date - 10
      and latest_purchase_id = '40000000-0000-0000-0000-000000000008'
      and total_purchases = 2
  ) then raise exception 'activity must use latest purchase date'; end if;

  if not exists (
    select 1 from public.customer_activity_summary
    where customer_id = '30000000-0000-0000-0000-000000000008'
      and latest_purchase_id = '40000000-0000-0000-0000-000000000010'
      and latest_purchase_status = 'active'
  ) then raise exception 'latest purchase tie-break by created_at failed'; end if;

  raise notice 'V2.3-B activity boundaries and latest purchase checks passed';
end;
$$;

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  current_setting('v2_3_b.user_a'),
  true
);

do $$
declare
  v_count integer;
  v_history_count integer;
  v_new_purchase_id uuid;
begin
  if auth.uid() <> current_setting('v2_3_b.user_a')::uuid then
    raise exception 'authenticated user A context mismatch';
  end if;

  select count(*)::integer
  into v_count
  from public.customer_activity_summary
  where user_id = current_setting('v2_3_b.user_b')::uuid;

  if v_count <> 0 then
    raise exception 'user A should not see user B activity summary';
  end if;

  if exists (
    select 1
    from public.today_contacts
    where purchase_id = '40000000-0000-0000-0000-000000000017'
  ) then
    raise exception 'cold customer should not appear in today_contacts before auto pause';
  end if;

  if not exists (
    select 1
    from public.today_contacts
    where purchase_id = '40000000-0000-0000-0000-000000000018'
  ) then
    raise exception 'cooling customer should still appear in today_contacts';
  end if;

  begin
    perform public.register_contact_attempt(
      '40000000-0000-0000-0000-000000000011',
      'Mensagem bloqueada'
    );
    raise exception 'cold contact attempt was accepted';
  exception when others then
    if sqlerrm = 'cold contact attempt was accepted' then raise; end if;
    if sqlerrm <> 'O cliente esta classificado como Frio e nao pode receber uma nova tentativa de contato. Registre uma nova compra para iniciar um novo ciclo.' then
      raise exception 'unexpected cold contact attempt error: %', sqlerrm;
    end if;
  end;

  if exists (
    select 1
    from public.contact_attempts
    where purchase_id = '40000000-0000-0000-0000-000000000011'
  ) then
    raise exception 'cold contact attempt created a row';
  end if;

  if not exists (
    select 1
    from public.purchases
    where id = '40000000-0000-0000-0000-000000000011'
      and status = 'active'
  ) then
    raise exception 'cold contact attempt changed purchase status';
  end if;

  if exists (
    select 1
    from public.purchase_status_history
    where purchase_id = '40000000-0000-0000-0000-000000000011'
  ) then
    raise exception 'cold contact attempt created history';
  end if;

  perform public.register_contact_attempt(
    '40000000-0000-0000-0000-000000000015',
    'Mensagem permitida'
  );

  if not exists (
    select 1
    from public.contact_attempts
    where purchase_id = '40000000-0000-0000-0000-000000000015'
      and attempt_number = 1
      and status = 'sent'
      and voided_at is null
  ) then
    raise exception 'cooling contact attempt was not created';
  end if;

  if not exists (
    select 1
    from public.purchases
    where id = '40000000-0000-0000-0000-000000000015'
      and status = 'in_followup'
  ) then
    raise exception 'cooling contact attempt did not preserve previous status flow';
  end if;

  select count(*)::integer
  into v_history_count
  from public.purchase_status_history
  where purchase_id = '40000000-0000-0000-0000-000000000019';

  begin
    perform public.change_purchase_status(
      '40000000-0000-0000-0000-000000000019',
      'active',
      'Tentativa de reativacao',
      'keep'
    );
    raise exception 'cold reactivation was accepted';
  exception when others then
    if sqlerrm = 'cold reactivation was accepted' then raise; end if;
    if sqlerrm <> 'O cliente continua classificado como Frio. Registre uma nova compra para iniciar um novo ciclo de recompra.' then
      raise exception 'unexpected cold reactivation error: %', sqlerrm;
    end if;
  end;

  if not exists (
    select 1
    from public.purchases
    where id = '40000000-0000-0000-0000-000000000019'
      and status = 'paused'
  ) then
    raise exception 'cold reactivation changed purchase status';
  end if;

  if (
    select count(*)::integer
    from public.purchase_status_history
    where purchase_id = '40000000-0000-0000-0000-000000000019'
  ) <> v_history_count then
    raise exception 'cold reactivation created unexpected history';
  end if;

  v_new_purchase_id := public.create_purchase_cycle(
    'Cold Reactivate',
    '+559923000017',
    'Cafe Novo',
    timezone('America/Sao_Paulo', now())::date,
    30,
    null
  );

  if not exists (
    select 1
    from public.customer_activity_summary
    where customer_id = '30000000-0000-0000-0000-000000000017'
      and activity_status = 'active'
      and latest_purchase_id = v_new_purchase_id
  ) then
    raise exception 'new purchase should make cold customer active';
  end if;

  if not exists (
    select 1
    from public.purchases
    where id = '40000000-0000-0000-0000-000000000019'
      and status = 'paused'
  ) then
    raise exception 'new purchase reactivated old paused purchase';
  end if;

  raise notice 'user A RLS, today_contacts, contact attempt, and reactivation checks passed';
end;
$$;

reset role;

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  current_setting('v2_3_b.user_b'),
  true
);

do $$
declare
  v_count integer;
begin
  if auth.uid() <> current_setting('v2_3_b.user_b')::uuid then
    raise exception 'authenticated user B context mismatch';
  end if;

  select count(*)::integer
  into v_count
  from public.customer_activity_summary
  where user_id = current_setting('v2_3_b.user_a')::uuid;

  if v_count <> 0 then
    raise exception 'user B should not see user A activity summary';
  end if;

  if not exists (
    select 1
    from public.customer_activity_summary
    where customer_id = '30000000-0000-0000-0000-000000000018'
      and activity_status = 'cold'
  ) then
    raise exception 'user B should see own cold summary';
  end if;

  raise notice 'user B RLS check passed';
end;
$$;

reset role;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);

do $$
begin
  begin
    perform 1 from public.customer_activity_summary limit 1;
    raise exception 'anon selected customer_activity_summary';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on anon activity summary select, got: %', sqlerrm;
  end;

  begin
    perform public.pause_cold_customers();
    raise exception 'anon executed pause_cold_customers';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on anon pause_cold_customers, got: %', sqlerrm;
  end;

  raise notice 'anon activity summary and pause permissions passed';
end;
$$;

reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  current_setting('v2_3_b.user_a'),
  true
);

do $$
begin
  begin
    perform public.pause_cold_customers();
    raise exception 'authenticated executed pause_cold_customers';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on authenticated pause_cold_customers, got: %', sqlerrm;
  end;

  raise notice 'authenticated pause permission block passed';
end;
$$;

reset role;

do $$
declare
  v_customers_found integer;
  v_purchases_paused integer;
  v_executed_at timestamptz;
  v_history_count_before integer;
  v_history_count_after integer;
  v_second_run_paused integer;
begin
  select count(*)::integer
  into v_history_count_before
  from public.purchase_status_history
  where change_source = 'system_inactivity';

  select r.customers_found, r.purchases_paused, r.executed_at
  into v_customers_found, v_purchases_paused, v_executed_at
  from public.pause_cold_customers() r;

  if v_customers_found <> 5 or v_purchases_paused <> 5 then
    raise exception 'pause_cold_customers expected 5 cold customers and 5 paused purchases, got customers=%, purchases=%',
      v_customers_found,
      v_purchases_paused;
  end if;

  if v_executed_at is null then
    raise exception 'pause_cold_customers returned null executed_at';
  end if;

  if not exists (
    select 1 from public.purchases
    where id = '40000000-0000-0000-0000-000000000011'
      and status = 'paused'
  ) then raise exception 'cold active purchase was not paused'; end if;

  if not exists (
    select 1 from public.purchases
    where id = '40000000-0000-0000-0000-000000000012'
      and status = 'paused'
  ) then raise exception 'cold in_followup purchase was not paused'; end if;

  if not exists (
    select 1 from public.purchases
    where id = '40000000-0000-0000-0000-000000000013'
      and status = 'paused'
  ) then raise exception 'cold paused purchase changed unexpectedly'; end if;

  if not exists (
    select 1 from public.purchases
    where id = '40000000-0000-0000-0000-000000000014'
      and status = 'repurchased'
  ) then raise exception 'cold repurchased purchase changed unexpectedly'; end if;

  if not exists (
    select 1 from public.purchases
    where id = '40000000-0000-0000-0000-000000000015'
      and status = 'in_followup'
  ) then raise exception 'cooling purchase changed unexpectedly'; end if;

  if not exists (
    select 1 from public.purchases
    where id = '40000000-0000-0000-0000-000000000016'
      and status = 'active'
  ) then raise exception 'active purchase changed unexpectedly'; end if;

  if not exists (
    select 1
    from public.contact_attempts
    where id = '50000000-0000-0000-0000-000000000001'
      and purchase_id = '40000000-0000-0000-0000-000000000012'
      and attempt_number = 1
      and status = 'sent'
      and voided_at is null
  ) then
    raise exception 'auto pause modified or voided existing contact attempt';
  end if;

  if not exists (
    select 1
    from public.purchase_status_history
    where purchase_id = '40000000-0000-0000-0000-000000000011'
      and old_status = 'active'
      and new_status = 'paused'
      and changed_by is null
      and reason = 'Pausado automaticamente pelo sistema: cliente sem nova compra há mais de 90 dias.'
      and change_source = 'system_inactivity'
      and metadata->>'source' = 'system_inactivity'
      and metadata->>'customer_id' = '30000000-0000-0000-0000-000000000009'
      and (metadata->>'days_since_last_purchase')::integer > 90
      and created_at is not null
  ) then
    raise exception 'auto pause history for cold active purchase is incorrect';
  end if;

  if not exists (
    select 1
    from public.purchase_status_history
    where purchase_id = '40000000-0000-0000-0000-000000000012'
      and old_status = 'in_followup'
      and new_status = 'paused'
      and changed_by is null
      and change_source = 'system_inactivity'
      and metadata->>'last_purchase_date' = (timezone('America/Sao_Paulo', now())::date - 120)::text
  ) then
    raise exception 'auto pause history for cold in_followup purchase is incorrect';
  end if;

  if not exists (
    select 1
    from public.customer_activity_summary
    where customer_id = '30000000-0000-0000-0000-000000000010'
      and has_auto_paused_purchase
      and last_auto_pause_at is not null
  ) then
    raise exception 'activity summary did not reflect auto pause history';
  end if;

  select count(*)::integer
  into v_history_count_after
  from public.purchase_status_history
  where change_source = 'system_inactivity';

  if v_history_count_after <> v_history_count_before + 5 then
    raise exception 'auto pause created unexpected history count';
  end if;

  select r.purchases_paused
  into v_second_run_paused
  from public.pause_cold_customers() r;

  if v_second_run_paused <> 0 then
    raise exception 'second auto pause run should pause zero purchases';
  end if;

  if (
    select count(*)::integer
    from public.purchase_status_history
    where change_source = 'system_inactivity'
  ) <> v_history_count_after then
    raise exception 'second auto pause run created duplicate history';
  end if;

  raise notice 'auto pause, history, attempts preservation, and idempotency checks passed';
end;
$$;

rollback;
