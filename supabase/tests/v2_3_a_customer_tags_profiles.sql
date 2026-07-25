-- V2.3-A - Manual SQL tests for customer tags and basic profiles.
--
-- Run only in a test Supabase project or a local database.
-- 1. Apply supabase/sql/09_customer_tags_profiles.sql first.
-- 2. Create two test users in Supabase Auth.
-- 3. Replace v2_3_a.user_a and v2_3_a.user_b below with those users' auth.users.id values.
-- 4. Run the whole file. It is wrapped in a transaction and ends with rollback.

begin;

select set_config(
  'v2_3_a.user_a',
  'a4e0198b-595c-4801-bdcc-18e6bc3b4837',
  true
);

select set_config(
  'v2_3_a.user_b',
  'c5d30cde-efcd-4b70-8c56-24b786058977',
  true
);

select
  current_setting('v2_3_a.user_a')::uuid as user_a,
  current_setting('v2_3_a.user_b')::uuid as user_b;

select
  exists (
    select 1
    from auth.users
    where id = current_setting('v2_3_a.user_a')::uuid
  ) as user_a_exists,
  exists (
    select 1
    from auth.users
    where id = current_setting('v2_3_a.user_b')::uuid
  ) as user_b_exists;

do $$
declare
  v_user_a uuid := current_setting('v2_3_a.user_a')::uuid;
  v_user_b uuid := current_setting('v2_3_a.user_b')::uuid;
  v_customer_a uuid := '10000000-0000-0000-0000-000000000001';
  v_customer_b uuid := '10000000-0000-0000-0000-000000000002';
  v_tag_a uuid := '20000000-0000-0000-0000-000000000001';
  v_tag_b uuid := '20000000-0000-0000-0000-000000000002';
begin
  if not exists (select 1 from auth.users where id = v_user_a)
    or not exists (select 1 from auth.users where id = v_user_b) then
    raise exception 'Replace v_user_a and v_user_b with existing test auth.users IDs before running this file.';
  end if;

  if to_regclass('public.customer_tags') is null
    or to_regclass('public.customer_tag_assignments') is null
    or to_regclass('public.customer_profiles') is null then
    raise exception 'V2.3-A tables are missing';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('customer_tags', 'customer_tag_assignments', 'customer_profiles')
      and c.relrowsecurity
    group by n.nspname
    having count(*) = 3
  ) then
    raise exception 'RLS is not enabled on all V2.3-A tables';
  end if;

  if not has_table_privilege('authenticated', 'public.customer_tags', 'SELECT')
    or not has_table_privilege('authenticated', 'public.customer_tag_assignments', 'SELECT')
    or not has_table_privilege('authenticated', 'public.customer_profiles', 'SELECT') then
    raise exception 'authenticated must have direct SELECT on all V2.3-A tables';
  end if;

  if has_table_privilege('authenticated', 'public.customer_tags', 'INSERT')
    or has_table_privilege('authenticated', 'public.customer_tags', 'UPDATE')
    or has_table_privilege('authenticated', 'public.customer_tags', 'DELETE')
    or has_table_privilege('authenticated', 'public.customer_tag_assignments', 'INSERT')
    or has_table_privilege('authenticated', 'public.customer_tag_assignments', 'UPDATE')
    or has_table_privilege('authenticated', 'public.customer_tag_assignments', 'DELETE')
    or has_table_privilege('authenticated', 'public.customer_profiles', 'INSERT')
    or has_table_privilege('authenticated', 'public.customer_profiles', 'UPDATE')
    or has_table_privilege('authenticated', 'public.customer_profiles', 'DELETE') then
    raise exception 'authenticated must not have direct write privileges on V2.3-A tables';
  end if;

  if has_table_privilege('anon', 'public.customer_tags', 'SELECT')
    or has_table_privilege('anon', 'public.customer_tag_assignments', 'SELECT')
    or has_table_privilege('anon', 'public.customer_profiles', 'SELECT') then
    raise exception 'anon must not have direct table access';
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
    where n.nspname = 'public'
      and c.relname in ('customer_tags', 'customer_tag_assignments', 'customer_profiles')
      and a.grantee = 0
      and a.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
  ) then
    raise exception 'PUBLIC must not have direct table access';
  end if;

  if not has_table_privilege('service_role', 'public.customer_tags', 'SELECT, INSERT, UPDATE, DELETE')
    or not has_table_privilege('service_role', 'public.customer_tag_assignments', 'SELECT, INSERT, UPDATE, DELETE')
    or not has_table_privilege('service_role', 'public.customer_profiles', 'SELECT, INSERT, UPDATE, DELETE') then
    raise exception 'service_role table access was not preserved';
  end if;

  if not has_function_privilege('authenticated', 'public.create_customer_tag(text, text)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.update_customer_tag(uuid, text, text)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.delete_customer_tag(uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.ensure_default_customer_tags()', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.set_customer_tags(uuid, uuid[])', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.upsert_customer_profile(uuid, text, text, text[], text, text[], text)', 'EXECUTE') then
    raise exception 'authenticated must execute all V2.3-A RPCs';
  end if;

  if has_function_privilege('anon', 'public.create_customer_tag(text, text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.update_customer_tag(uuid, text, text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.delete_customer_tag(uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.ensure_default_customer_tags()', 'EXECUTE')
    or has_function_privilege('anon', 'public.set_customer_tags(uuid, uuid[])', 'EXECUTE')
    or has_function_privilege('anon', 'public.upsert_customer_profile(uuid, text, text, text[], text, text[], text)', 'EXECUTE') then
    raise exception 'anon must not execute V2.3-A RPCs';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where n.nspname = 'public'
      and p.proname in (
        'create_customer_tag',
        'update_customer_tag',
        'delete_customer_tag',
        'ensure_default_customer_tags',
        'set_customer_tags',
        'upsert_customer_profile'
      )
      and a.grantee = 0
      and a.privilege_type = 'EXECUTE'
  ) then
    raise exception 'PUBLIC must not execute V2.3-A RPCs';
  end if;

  insert into public.customers (id, user_id, name, phone)
  values
    (v_customer_a, v_user_a, 'Cliente Tags A', '+550000000001'),
    (v_customer_b, v_user_b, 'Cliente Tags B', '+550000000002');

  insert into public.customer_tags (id, user_id, name, color)
  values
    (v_tag_a, v_user_a, 'Tag Admin A', 'green'),
    (v_tag_b, v_user_b, 'Tag Admin B', 'blue');

  insert into public.customer_tag_assignments (customer_id, tag_id, user_id)
  values
    (v_customer_a, v_tag_a, v_user_a),
    (v_customer_b, v_tag_b, v_user_b);

  insert into public.customer_profiles (
    customer_id,
    user_id,
    preferred_product,
    preparation_methods,
    sensory_profiles
  )
  values
    (v_customer_a, v_user_a, 'Produto A', array['v60'], array['sweet']),
    (v_customer_b, v_user_b, 'Produto B', array['espresso'], array['chocolate']);

  raise notice 'admin setup and privilege metadata checks passed';
end;
$$;

do $$
declare
  v_user_a uuid := current_setting('v2_3_a.user_a')::uuid;
  v_tag_a uuid := '20000000-0000-0000-0000-000000000001';
  v_tag_a_user_id uuid;
  v_total_tag_a_count integer;
begin
  select user_id
  into v_tag_a_user_id
  from public.customer_tags
  where id = v_tag_a;

  select count(*)
  into v_total_tag_a_count
  from public.customer_tags
  where id = v_tag_a;

  raise notice
    'diagnostic admin before user A RLS: tag_a_exists=%, tag_a_id=%, tag_a_user_id=%, v_user_a=%, total_tag_a_count_as_postgres=%',
    v_total_tag_a_count > 0,
    v_tag_a,
    v_tag_a_user_id,
    v_user_a,
    v_total_tag_a_count;
end;
$$;

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  current_setting('v2_3_a.user_a'),
  true
);

do $$
declare
  v_tag_a uuid := '20000000-0000-0000-0000-000000000001';
  v_visible_tag_a_count integer;
begin
  if auth.uid() <> current_setting('v2_3_a.user_a')::uuid then
    raise exception 'authenticated user A context mismatch';
  end if;

  select count(*)
  into v_visible_tag_a_count
  from public.customer_tags
  where id = v_tag_a;

  raise notice
    'diagnostic authenticated before user A RLS: current_user=%, auth_uid=%, tag_a_id=%, visible_tag_a_count_as_authenticated=%',
    current_user,
    auth.uid(),
    v_tag_a,
    v_visible_tag_a_count;
end;
$$;

do $$
declare
  v_customer_a uuid := '10000000-0000-0000-0000-000000000001';
  v_customer_b uuid := '10000000-0000-0000-0000-000000000002';
  v_tag_a uuid := '20000000-0000-0000-0000-000000000001';
  v_tag_b uuid := '20000000-0000-0000-0000-000000000002';
  v_rpc_tag_a uuid;
  v_rpc_tag_second uuid;
  v_count integer;
  v_profile public.customer_profiles%rowtype;
begin
  select count(*) into v_count from public.customer_tags where id = v_tag_a;
  if v_count <> 1 then raise exception 'user A should see own tag'; end if;

  select count(*) into v_count from public.customer_tags where id = v_tag_b;
  if v_count <> 0 then raise exception 'user A should not see user B tag'; end if;

  select count(*) into v_count
  from public.customer_tag_assignments
  where customer_id = v_customer_a and tag_id = v_tag_a;
  if v_count <> 1 then raise exception 'user A should see own assignment'; end if;

  select count(*) into v_count
  from public.customer_tag_assignments
  where customer_id = v_customer_b and tag_id = v_tag_b;
  if v_count <> 0 then raise exception 'user A should not see user B assignment'; end if;

  select count(*) into v_count from public.customer_profiles where customer_id = v_customer_a;
  if v_count <> 1 then raise exception 'user A should see own profile'; end if;

  select count(*) into v_count from public.customer_profiles where customer_id = v_customer_b;
  if v_count <> 0 then raise exception 'user A should not see user B profile'; end if;

  begin
    insert into public.customer_tags (user_id, name, color)
    values (auth.uid(), 'Direta A', 'green');
    raise exception 'direct insert into customer_tags was accepted';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on customer_tags insert, got: %', sqlerrm;
  end;

  begin
    update public.customer_tags set color = 'blue' where id = v_tag_a;
    raise exception 'direct update on customer_tags was accepted';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on customer_tags update, got: %', sqlerrm;
  end;

  begin
    delete from public.customer_tags where id = v_tag_a;
    raise exception 'direct delete from customer_tags was accepted';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on customer_tags delete, got: %', sqlerrm;
  end;

  begin
    insert into public.customer_tag_assignments (customer_id, tag_id, user_id)
    values (v_customer_a, v_tag_a, auth.uid());
    raise exception 'direct insert into customer_tag_assignments was accepted';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on assignment insert, got: %', sqlerrm;
  end;

  begin
    delete from public.customer_tag_assignments
    where customer_id = v_customer_a and tag_id = v_tag_a;
    raise exception 'direct delete from customer_tag_assignments was accepted';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on assignment delete, got: %', sqlerrm;
  end;

  begin
    insert into public.customer_profiles (customer_id, user_id)
    values (v_customer_a, auth.uid());
    raise exception 'direct insert into customer_profiles was accepted';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on profile insert, got: %', sqlerrm;
  end;

  begin
    update public.customer_profiles set preferred_product = 'Direto' where customer_id = v_customer_a;
    raise exception 'direct update on customer_profiles was accepted';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on profile update, got: %', sqlerrm;
  end;

  begin
    delete from public.customer_profiles where customer_id = v_customer_a;
    raise exception 'direct delete from customer_profiles was accepted';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on profile delete, got: %', sqlerrm;
  end;

  select id into v_rpc_tag_a
  from public.create_customer_tag('  RPC A  ', 'green');

  if not exists (
    select 1
    from public.customer_tags
    where id = v_rpc_tag_a and name = 'RPC A' and user_id = auth.uid()
  ) then
    raise exception 'authenticated user A could not create own tag by RPC';
  end if;

  select id into v_rpc_tag_a
  from public.update_customer_tag(v_rpc_tag_a, 'RPC A Atualizada', 'purple');

  select id into v_rpc_tag_second
  from public.create_customer_tag('RPC A Segunda', 'orange');

  perform public.ensure_default_customer_tags();
  perform public.set_customer_tags(v_customer_a, array[v_rpc_tag_a, v_rpc_tag_second, v_rpc_tag_a]);

  select count(*) into v_count
  from public.customer_tag_assignments
  where customer_id = v_customer_a
    and tag_id in (v_rpc_tag_a, v_rpc_tag_second);

  if v_count <> 2 then
    raise exception 'authenticated user A could not set own tags by RPC';
  end if;

  select *
  into v_profile
  from public.upsert_customer_profile(
    v_customer_a,
    '  Produto RPC A  ',
    'medium',
    array['v60', 'v60', 'paper_filter'],
    'once_day',
    array['sweet', 'sweet', 'chocolate'],
    '  Perfil salvo por RPC  '
  );

  if v_profile.customer_id <> v_customer_a
    or v_profile.user_id <> auth.uid()
    or v_profile.preferred_product <> 'Produto RPC A'
    or v_profile.preparation_methods <> array['paper_filter', 'v60']
    or v_profile.sensory_profiles <> array['chocolate', 'sweet'] then
    raise exception 'authenticated user A could not save own profile by RPC';
  end if;

  begin
    perform public.update_customer_tag(v_tag_b, 'Outro usuario editado', 'green');
    raise exception 'user A updated user B tag';
  exception when others then
    if sqlerrm = 'user A updated user B tag' then raise; end if;
  end;

  begin
    perform public.delete_customer_tag(v_tag_b);
    raise exception 'user A deleted user B tag';
  exception when others then
    if sqlerrm = 'user A deleted user B tag' then raise; end if;
  end;

  begin
    perform public.set_customer_tags(v_customer_a, array[v_tag_b]);
    raise exception 'user A associated user B tag';
  exception when others then
    if sqlerrm = 'user A associated user B tag' then raise; end if;
  end;

  begin
    perform public.set_customer_tags(v_customer_b, array[v_rpc_tag_a]);
    raise exception 'user A changed user B customer tags';
  exception when others then
    if sqlerrm = 'user A changed user B customer tags' then raise; end if;
  end;

  begin
    perform public.upsert_customer_profile(v_customer_b);
    raise exception 'user A saved profile for user B customer';
  exception when others then
    if sqlerrm = 'user A saved profile for user B customer' then raise; end if;
  end;

  perform public.delete_customer_tag(v_rpc_tag_second);

  raise notice 'authenticated user A RLS, direct privilege block, and RPC checks passed';
end;
$$;

reset role;

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  current_setting('v2_3_a.user_b'),
  true
);

do $$
declare
  v_tag_a uuid := '20000000-0000-0000-0000-000000000001';
  v_tag_b uuid := '20000000-0000-0000-0000-000000000002';
  v_count integer;
begin
  if auth.uid() <> current_setting('v2_3_a.user_b')::uuid then
    raise exception 'authenticated user B context mismatch';
  end if;

  select count(*) into v_count from public.customer_tags where id = v_tag_b;
  if v_count <> 1 then raise exception 'user B should see own tag'; end if;

  select count(*) into v_count from public.customer_tags where id = v_tag_a;
  if v_count <> 0 then raise exception 'user B should not see user A tag'; end if;

  raise notice 'authenticated user B RLS check passed';
end;
$$;

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);

do $$
begin
  begin
    perform public.create_customer_tag('Sem usuario', 'green');
    raise exception 'RPC without auth.uid was accepted';
  exception when others then
    if sqlerrm = 'RPC without auth.uid was accepted' then raise; end if;
  end;

  raise notice 'authenticated role without auth.uid is rejected by internal RPC validation';
end;
$$;

reset role;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);

do $$
declare
  v_customer_a uuid := '10000000-0000-0000-0000-000000000001';
  v_user_a uuid := current_setting('v2_3_a.user_a')::uuid;
  v_tag_a uuid := '20000000-0000-0000-0000-000000000001';
begin
  begin
    perform 1 from public.customer_tags limit 1;
    raise exception 'anon selected customer_tags';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on anon customer_tags select, got: %', sqlerrm;
  end;

  begin
    perform 1 from public.customer_tag_assignments limit 1;
    raise exception 'anon selected customer_tag_assignments';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on anon assignments select, got: %', sqlerrm;
  end;

  begin
    perform 1 from public.customer_profiles limit 1;
    raise exception 'anon selected customer_profiles';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on anon profiles select, got: %', sqlerrm;
  end;

  begin
    insert into public.customer_tags (user_id, name, color)
    values (v_user_a, 'Anon', 'green');
    raise exception 'anon inserted customer_tags';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on anon customer_tags insert, got: %', sqlerrm;
  end;

  begin
    update public.customer_tags set color = 'blue';
    raise exception 'anon updated customer_tags';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on anon customer_tags update, got: %', sqlerrm;
  end;

  begin
    delete from public.customer_tags;
    raise exception 'anon deleted customer_tags';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on anon customer_tags delete, got: %', sqlerrm;
  end;

  begin
    insert into public.customer_tag_assignments (customer_id, tag_id, user_id)
    values (
      v_customer_a,
      v_tag_a,
      v_user_a
    );
    raise exception 'anon inserted customer_tag_assignments';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on anon assignment insert, got: %', sqlerrm;
  end;

  begin
    update public.customer_tag_assignments
    set user_id = v_user_a;
    raise exception 'anon updated customer_tag_assignments';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on anon assignment update, got: %', sqlerrm;
  end;

  begin
    delete from public.customer_tag_assignments;
    raise exception 'anon deleted customer_tag_assignments';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on anon assignment delete, got: %', sqlerrm;
  end;

  begin
    insert into public.customer_profiles (customer_id, user_id)
    values (v_customer_a, v_user_a);
    raise exception 'anon inserted customer_profiles';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on anon profile insert, got: %', sqlerrm;
  end;

  begin
    update public.customer_profiles set preferred_product = 'Anon';
    raise exception 'anon updated customer_profiles';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on anon profile update, got: %', sqlerrm;
  end;

  begin
    delete from public.customer_profiles;
    raise exception 'anon deleted customer_profiles';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on anon profile delete, got: %', sqlerrm;
  end;

  begin
    perform public.create_customer_tag('Anon', 'green');
    raise exception 'anon executed create_customer_tag';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on anon create_customer_tag, got: %', sqlerrm;
  end;

  begin
    perform public.update_customer_tag(v_tag_a, 'Anon', 'green');
    raise exception 'anon executed update_customer_tag';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on anon update_customer_tag, got: %', sqlerrm;
  end;

  begin
    perform public.delete_customer_tag(v_tag_a);
    raise exception 'anon executed delete_customer_tag';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on anon delete_customer_tag, got: %', sqlerrm;
  end;

  begin
    perform public.ensure_default_customer_tags();
    raise exception 'anon executed ensure_default_customer_tags';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on anon ensure_default_customer_tags, got: %', sqlerrm;
  end;

  begin
    perform public.set_customer_tags(v_customer_a, array[]::uuid[]);
    raise exception 'anon executed set_customer_tags';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on anon set_customer_tags, got: %', sqlerrm;
  end;

  begin
    perform public.upsert_customer_profile(v_customer_a);
    raise exception 'anon executed upsert_customer_profile';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'expected insufficient_privilege on anon upsert_customer_profile, got: %', sqlerrm;
  end;

  raise notice 'anon table and RPC privilege checks passed';
end;
$$;

reset role;

rollback;
