alter table public.customers enable row level security;
alter table public.purchases enable row level security;
alter table public.contact_attempts enable row level security;
alter table public.settings enable row level security;

create policy "customers_select_own"
on public.customers for select
using ((select auth.uid()) = user_id);

create policy "customers_insert_own"
on public.customers for insert
with check ((select auth.uid()) = user_id);

create policy "customers_update_own"
on public.customers for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "customers_delete_own"
on public.customers for delete
using ((select auth.uid()) = user_id);

create policy "purchases_select_own"
on public.purchases for select
using ((select auth.uid()) = user_id);

create policy "purchases_insert_own"
on public.purchases for insert
with check ((select auth.uid()) = user_id);

create policy "purchases_update_own"
on public.purchases for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "purchases_delete_own"
on public.purchases for delete
using ((select auth.uid()) = user_id);

create policy "contact_attempts_select_own"
on public.contact_attempts for select
using ((select auth.uid()) = user_id);

create policy "contact_attempts_insert_own"
on public.contact_attempts for insert
with check ((select auth.uid()) = user_id);

create policy "contact_attempts_update_own"
on public.contact_attempts for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "contact_attempts_delete_own"
on public.contact_attempts for delete
using ((select auth.uid()) = user_id);

create policy "settings_select_own"
on public.settings for select
using ((select auth.uid()) = user_id);

create policy "settings_insert_own"
on public.settings for insert
with check ((select auth.uid()) = user_id);

create policy "settings_update_own"
on public.settings for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
