begin;

-- Remove todos os privilégios diretos dos papéis públicos.
revoke all privileges
on table public.purchase_status_history
from anon, authenticated;

-- Usuários autenticados podem apenas consultar o próprio histórico.
-- A política RLS filtra os registros por user_id = auth.uid().
grant select
on table public.purchase_status_history
to authenticated;

-- Remove permissões automáticas ou previamente concedidas à RPC.
revoke all privileges
on function public.change_purchase_status(
  uuid,
  public.purchase_status,
  text,
  text
)
from public;

revoke all privileges
on function public.change_purchase_status(
  uuid,
  public.purchase_status,
  text,
  text
)
from anon;

revoke all privileges
on function public.change_purchase_status(
  uuid,
  public.purchase_status,
  text,
  text
)
from authenticated;

-- Apenas usuários autenticados podem executar a RPC.
grant execute
on function public.change_purchase_status(
  uuid,
  public.purchase_status,
  text,
  text
)
to authenticated;

commit;