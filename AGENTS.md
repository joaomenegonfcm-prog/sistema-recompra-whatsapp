# AGENTS.md — Sistema de Recompra por WhatsApp

## Projeto

Ferramenta web single-tenant feita sob medida para uma microtorrefação de café especial.

O sistema cadastra compras, calcula ciclos de recompra e ajuda o lojista a entrar em contato manualmente por links `wa.me`. Não é um SaaS multiempresa e não envia mensagens automaticamente.

## Prioridade das instruções

Ao trabalhar neste repositório, respeite esta ordem:

1. Pedido atual e decisões explícitas do usuário.
2. Especificação aprovada da fase em desenvolvimento.
3. Regras de negócio e invariantes de segurança deste arquivo.
4. Recomendações das Skills oficiais de Supabase e Postgres.
5. Recomendações de simplicidade da Ponytail.

Se uma recomendação de Skill contradizer uma especificação aprovada ou uma regra de segurança, preserve a especificação e informe o conflito.

Não trate o README da V1 como especificação completa da V2.

## Stack autorizada

- React 19
- Vite 6
- TypeScript
- React Router
- Supabase Auth e PostgreSQL
- `@supabase/supabase-js`
- PapaParse
- date-fns
- lucide-react
- clsx
- CSS existente do projeto
- npm e `package-lock.json`

Reutilize as dependências e os padrões já presentes antes de considerar código ou bibliotecas novas.

## Dependências e tecnologias fora do escopo

Não adicionar sem aprovação explícita:

- Next.js
- Tailwind CSS
- shadcn/ui
- React Hook Form
- Zod
- Zustand
- TanStack Query
- bibliotecas de componentes ou design systems
- Baileys
- WhatsApp Cloud API
- Meta Business
- Redis
- automação de disparos
- integrações de e-commerce
- recursos de SaaS multi-tenant
- novas dependências para comportamentos cobertos pelo navegador, pela plataforma ou pelas bibliotecas já instaladas

Não trocar ferramentas, bibliotecas ou padrões existentes incidentalmente durante outra tarefa.

## Regras de negócio protegidas

- Cada compra representa um ciclo de recompra.
- O telefone é o identificador principal do cliente.
- Uma nova compra do mesmo telefone pode encerrar o ciclo anterior como `repurchased`, independentemente do produto.
- O envio de WhatsApp continua manual por `wa.me`.
- A criação de um ciclo de recompra e a resolução ou criação do respectivo cliente devem passar pela RPC `create_purchase_cycle`; esse fluxo não deve inserir diretamente em `customers` ou `purchases`.
- Edições explícitas de dados cadastrais do cliente ou de campos não-status da compra podem usar updates diretos pelos services existentes, desde que preservem RLS, propriedade do usuário e as regras aplicáveis.
- `purchases.status` nunca deve ser alterado diretamente pelo front-end; alterações manuais de status devem passar pela RPC `change_purchase_status`.
- O status `repurchased` não pode ser aplicado manualmente.
- Transições de status não podem ser ampliadas ou simplificadas sem especificação aprovada.
- Uma tentativa operacional válida é `attempt_status = 'sent' and voided_at is null`.
- Tentativas anuladas devem preservar o registro original e preencher os campos `voided_*`.
- Histórico, auditoria e snapshots são requisitos de integridade, não duplicação descartável.
- O opt-out bloqueia Contatos de Hoje e qualquer abertura manual de WhatsApp pelo sistema.
- Remover o opt-out não deve forçar contato imediato.
- Mesmo sendo single-tenant, o isolamento por usuário e as políticas de RLS devem ser preservados.

Não alterar essas regras como efeito colateral de refatoração, melhoria visual ou simplificação de código.

## Supabase e SQL

Os scripts SQL incrementais ficam em `supabase/sql/`.

Enquanto o README raiz estiver defasado, use `supabase/sql/README.md` como fonte de referência para a ordem de execução dos scripts SQL.

Ao fazer uma alteração de banco:

- inspecione os scripts anteriores antes de criar SQL novo;
- prefira um novo arquivo numerado para mudanças já aplicadas em produção;
- não reescreva silenciosamente scripts já executados;
- mantenha a ordem numérica e documente dependências;
- preserve atomicidade em operações relacionadas;
- use constraints e validações no banco quando protegem invariantes;
- habilite e revise RLS em toda nova tabela exposta;
- revise `USING` e `WITH CHECK`;
- revise grants e permissões de execução de RPCs;
- em funções `security definer`, fixe um `search_path` seguro e qualifique objetos quando necessário;
- valide `auth.uid()` e propriedade dos registros no banco;
- não confie somente em filtros do front-end;
- verifique views quanto a RLS e privilégios do proprietário;
- não aplique otimizações, índices, pooling ou estratégias de escala sem necessidade demonstrada.

Para Edge Functions que usam `SUPABASE_SERVICE_ROLE_KEY`, revise autorização, escopo da operação e filtros aplicados. A service role nunca deve ser exposta ao front-end, logs ou respostas.

Use as Skills `supabase` e `supabase-postgres-best-practices` como apoio técnico, não como substitutas das regras do produto.

Nunca declare que um SQL foi executado ou validado no Supabase se apenas o arquivo local foi criado.

## Front-end e interface

Antes de criar um componente, procure por uma implementação existente em `src/components/UI/`.

Componentes compartilhados atuais:

- `Badge`
- `Button`
- `Card`
- `EmptyState`
- `Input`
- `Loading`
- `Modal`

Regras:

- reutilize e evolua os componentes existentes;
- evite CSS isolado e inconsistente por tela;
- preserve a estrutura React, Vite e CSS atual;
- não introduza uma biblioteca visual;
- como padrão, mantenha uma única ação primária por contexto visual principal; exceções devem corresponder a ações realmente equivalentes e ser justificadas pela tarefa;
- use menor peso visual para ações secundárias;
- separe ações destrutivas e exija confirmação quando necessário;
- apresente erros próximos ao campo ou ação correspondente;
- preserve dados digitados em erros recuperáveis;
- bloqueie duplo envio enquanto uma operação estiver carregando;
- mantenha foco visível e navegação por teclado;
- use HTML semântico, labels e nomes acessíveis;
- valide comportamento em desktop e celular;
- não altere regras de negócio durante uma melhoria visual.

A melhoria do front-end deve ser incremental. Comece pelos componentes compartilhados e migre uma tela por vez.

## Uso da Ponytail

Neste projeto, trate a Skill `ponytail` como modo `lite`.

Ela pode:

- apontar uma alternativa mais simples;
- recomendar reutilização;
- evitar dependências e abstrações desnecessárias;
- reduzir o tamanho de uma implementação sem mudar seu comportamento.

Ela não pode:

- remover requisito aprovado;
- substituir uma decisão de produto;
- reduzir auditoria, histórico ou snapshots;
- enfraquecer validação, RLS ou segurança;
- remover acessibilidade;
- trocar correção por menor quantidade de linhas;
- aplicar os modos `full` ou `ultra` sem pedido explícito;
- criar comentários `ponytail:` sem necessidade aprovada.

A Skill `ponytail-review` é apenas uma revisão complementar de excesso de engenharia. Antes dela, sempre faça:

1. revisão funcional;
2. revisão das regras de negócio;
3. revisão de segurança e RLS quando aplicável;
4. verificações disponíveis.

Não aceite uma recomendação da `ponytail-review` apenas porque reduz linhas.

## Fluxo de trabalho

Antes de editar:

- leia os arquivos diretamente relacionados;
- procure usos e chamadores do código afetado;
- verifique `git status`;
- preserve alterações existentes do usuário;
- confirme a causa raiz antes de corrigir um sintoma.

Durante a implementação:

- mantenha o menor escopo compatível com a especificação;
- evite refatorações incidentais;
- não crie abstrações para necessidades futuras hipotéticas;
- não altere contratos públicos sem revisar todos os consumidores;
- não leia, imprima ou exponha secrets de `.env.local`;
- nunca coloque `service_role` ou `RESEND_API_KEY` no front-end;
- não faça commit, push, deploy ou alteração remota sem pedido explícito.

Depois da implementação:

- revise o diff;
- execute as verificações proporcionais ao risco;
- informe claramente o que foi e o que não foi validado;
- registre qualquer teste manual ainda necessário.

## Comandos do projeto

- Instalar dependências existentes: `npm install`
- Desenvolvimento local: `npm run dev`
- Lint: `npm run lint`
- Build de produção: `npm run build`
- Pré-visualização do build: `npm run preview`

O build já executa `tsc -b` antes do Vite.

## Verificação mínima

O projeto não possui atualmente um script automatizado de testes. Não declare que testes automatizados passaram.

Para mudanças comuns de front-end, execute pelo menos:

- `npm run lint`
- `npm run build`

Para mudanças visuais, complemente com validação em desktop e celular, navegação por teclado, foco visível e estados de carregamento, erro e desabilitado.

Para mudanças de banco, complemente com revisão do SQL, das políticas RLS, das permissões de RPC e um checklist manual. Só declare validação no Supabase quando ela tiver sido realmente executada e autorizada.
