# Sistema de Recompra por WhatsApp

MVP web para lojistas cadastrarem compras, acompanharem ciclos de recompra e abrirem o WhatsApp manualmente com uma mensagem pronta.

## Stack

- React, Vite e TypeScript
- React Router
- Supabase Auth e PostgreSQL
- PapaParse, date-fns, lucide-react e clsx

## Requisitos

- Node.js 20 ou superior
- Um projeto no Supabase

## Configuração local

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Crie `.env.local` na raiz usando `.env.example` como referência:

   ```env
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anon
   ```

   Use somente a chave pública `anon`. Nunca coloque uma chave `service_role` no front-end.

3. No SQL Editor do Supabase, execute os arquivos nesta ordem:

   1. `supabase/sql/01_schema.sql`
   2. `supabase/sql/02_rls_policies.sql`
   3. `supabase/sql/03_functions.sql`
   4. `supabase/sql/04_views.sql`
   5. `supabase/sql/05_daily_summary_cron.sql` somente depois de publicar a Edge Function de resumo diário

4. Inicie o ambiente local:

   ```bash
   npm run dev
   ```

5. Acesse `http://localhost:5173`.

## Verificações

```bash
npm run lint
npm run build
npm run preview
```

O build de produção é criado em `dist/`.

## Deploy

Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no provedor de hospedagem e use:

- Comando de build: `npm run build`
- Diretório de saída: `dist`

Como o app usa React Router, a hospedagem deve redirecionar rotas desconhecidas para `index.html`. No Supabase Auth, configure a URL pública do app em **Authentication > URL Configuration**.

## Resumo diário por e-mail

O projeto inclui uma Edge Function chamada `send-daily-summary`. Ela envia um e-mail interno para cada lojista com os clientes que precisam ser chamados naquele dia. Ela não envia mensagens para clientes e não automatiza WhatsApp.

### Secrets da função

Configure os secrets no Supabase:

```bash
supabase secrets set RESEND_API_KEY=sua-chave-resend
supabase secrets set DAILY_SUMMARY_FROM_EMAIL="Sistema de Recompra <resumo@seudominio.com>"
supabase secrets set DAILY_SUMMARY_ENABLED=true
```

O Supabase já disponibiliza `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` para Edge Functions. Não coloque `RESEND_API_KEY` nem `service_role` no front-end React.

### Deploy e teste manual

Publique a função:

```bash
supabase functions deploy send-daily-summary
```

Teste manualmente:

```bash
curl -X POST "https://SEU_PROJETO.supabase.co/functions/v1/send-daily-summary" \
  -H "Authorization: Bearer SUA_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source":"manual"}'
```

A resposta retorna `success`, `usersProcessed`, `emailsSent` e `errors`.

### Agendamento diário

Depois do deploy da função, abra `supabase/sql/05_daily_summary_cron.sql`, substitua `{{SUPABASE_PROJECT_URL}}` e `{{SUPABASE_ANON_KEY}}`, e execute no SQL Editor do Supabase.

O agendamento está configurado como `0 9 * * *`, que equivale a 06:00 no horário de São Paulo. Para desativar:

```sql
select cron.unschedule('send-daily-summary-0600');
```

### Checklist final

- [ ] Criar o projeto no Supabase.
- [ ] Executar os scripts SQL na ordem documentada.
- [ ] Confirmar que o RLS está ativo nas tabelas do app.
- [ ] Configurar `RESEND_API_KEY`, `DAILY_SUMMARY_FROM_EMAIL` e `DAILY_SUMMARY_ENABLED` nos secrets do Supabase.
- [ ] Publicar a Edge Function `send-daily-summary`.
- [ ] Testar manualmente o resumo diário por e-mail.
- [ ] Ativar `05_daily_summary_cron.sql` se o resumo diário estiver habilitado.
- [ ] Configurar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` na hospedagem.
- [ ] Configurar a URL pública e os redirecionamentos no Supabase Auth.
- [ ] Executar `npm run lint` e `npm run build`.
- [ ] Publicar o diretório `dist` com fallback SPA para `index.html`.
- [ ] Testar cadastro, confirmação de e-mail, login e logout em produção.
- [ ] Testar uma compra manual e confirmar o ciclo no Supabase.
- [ ] Testar Contatos de Hoje, abertura do WhatsApp e registro de tentativa.
- [ ] Testar importação CSV, clientes, histórico e configurações.

## Escopo da V1

A V1 não envia mensagens automaticamente e não utiliza Baileys ou WhatsApp Cloud API. O sistema apenas gera e abre um link `wa.me`; o usuário confirma o envio manualmente no WhatsApp e depois registra a tentativa no app.
