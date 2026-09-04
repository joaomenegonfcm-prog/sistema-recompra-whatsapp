# Configuração do banco no Supabase

Execute os arquivos abaixo, nesta ordem, no SQL Editor do Supabase:

1. `01_schema.sql`
2. `02_rls_policies.sql`
3. `03_functions.sql`
4. `04_views.sql`
5. `06_purchase_status_history.sql`
6. `07_fix_purchase_status_permissions.sql`
7. `08_customer_opt_out.sql`
8. `09_customer_tags_profiles.sql`
9. `10_customer_activity_auto_pause.sql`
10. `05_daily_summary_cron.sql` somente depois de publicar a Edge Function `send-daily-summary`

Os scripts preparam os tipos, tabelas, índices, gatilhos, políticas de segurança, funções RPC, a view `today_contacts` e o agendamento opcional do resumo diário por e-mail.

Na V2.0, execute `06_purchase_status_history.sql` para criar a base de auditoria e alteração segura de status. Em seguida, execute `07_fix_purchase_status_permissions.sql` para reforçar as permissões finais da tabela de histórico e da RPC `change_purchase_status`.

Na V2.2, execute `08_customer_opt_out.sql` para adicionar opt-out por cliente, criar a RPC `set_customer_opt_out` e atualizar a view `today_contacts` para excluir clientes marcados como não contatar.

Na V2.3-A, execute `09_customer_tags_profiles.sql` para criar o catalogo de tags por usuario, associacoes entre clientes e tags, perfil basico opcional do cliente, RLS, grants e RPCs seguras de gravacao.

Na V2.3-B, execute `10_customer_activity_auto_pause.sql` para criar o resumo de atividade do cliente, pausar automaticamente ciclos de clientes frios, proteger tentativas/reativacoes e excluir clientes frios de `today_contacts`. Se `pg_cron` ainda nao estiver ativo no projeto, a migration mantem `pause_cold_customers()` pronta; ative `pg_cron` no Supabase e agende `select public.pause_cold_customers();` diariamente as 03:15 UTC, equivalente a 00:15 em America/Sao_Paulo.

## Checklist manual

- [ ] Criar um usuário de teste pelo app ou pelo Supabase Auth.
- [ ] Verificar se um registro em `settings` foi criado automaticamente para o usuário.
- [ ] Cadastrar uma compra quando essa funcionalidade for implementada em uma fase futura.
- [ ] Confirmar no painel do Supabase que o RLS está ativo em `customers`, `purchases`, `contact_attempts` e `settings`.
- [ ] Publicar a Edge Function `send-daily-summary` antes de ativar `05_daily_summary_cron.sql`.
- [ ] Executar os testes manuais de `supabase/tests/v2_3_a_customer_tags_profiles.sql` em um ambiente de teste antes de aplicar a V2.3-A em producao.
- [ ] Executar os testes manuais de `supabase/tests/v2_3_b_customer_activity_auto_pause.sql` em um ambiente de teste antes de aplicar a V2.3-B em producao.

> Estes scripts foram preparados para uma instalação nova. Execute cada arquivo apenas uma vez no projeto Supabase.
