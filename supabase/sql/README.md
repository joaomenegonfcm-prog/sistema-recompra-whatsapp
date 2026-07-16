# Configuração do banco no Supabase

Execute os arquivos abaixo, nesta ordem, no SQL Editor do Supabase:

1. `01_schema.sql`
2. `02_rls_policies.sql`
3. `03_functions.sql`
4. `04_views.sql`
5. `05_daily_summary_cron.sql` somente depois de publicar a Edge Function `send-daily-summary`

Os scripts preparam os tipos, tabelas, índices, gatilhos, políticas de segurança, funções RPC, a view `today_contacts` e o agendamento opcional do resumo diário por e-mail.

## Checklist manual

- [ ] Criar um usuário de teste pelo app ou pelo Supabase Auth.
- [ ] Verificar se um registro em `settings` foi criado automaticamente para o usuário.
- [ ] Cadastrar uma compra quando essa funcionalidade for implementada em uma fase futura.
- [ ] Confirmar no painel do Supabase que o RLS está ativo em `customers`, `purchases`, `contact_attempts` e `settings`.
- [ ] Publicar a Edge Function `send-daily-summary` antes de ativar `05_daily_summary_cron.sql`.

> Estes scripts foram preparados para uma instalação nova. Execute cada arquivo apenas uma vez no projeto Supabase.
