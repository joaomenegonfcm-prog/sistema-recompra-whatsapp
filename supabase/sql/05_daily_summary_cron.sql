create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Antes de executar este arquivo, substitua os placeholders abaixo:
--   {{SUPABASE_PROJECT_URL}} pela URL do projeto, exemplo: https://seu-projeto.supabase.co
--   {{SUPABASE_ANON_KEY}} pela chave anon pública do projeto
--
-- A Edge Function usa secrets próprios para acessar Supabase e Resend.
-- Não coloque RESEND_API_KEY nem service_role neste SQL.
--
-- O pg_cron agenda em UTC. 09:00 UTC equivale a 06:00 em America/Sao_Paulo.

select cron.unschedule('send-daily-summary-0600')
where exists (
  select 1
  from cron.job
  where jobname = 'send-daily-summary-0600'
);

select cron.schedule(
  'send-daily-summary-0600',
  '0 9 * * *',
  $$
  select net.http_post(
    url := '{{SUPABASE_PROJECT_URL}}/functions/v1/send-daily-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer {{SUPABASE_ANON_KEY}}'
    ),
    body := jsonb_build_object('source', 'pg_cron')
  );
  $$
);

-- Para desativar o agendamento:
-- select cron.unschedule('send-daily-summary-0600');
