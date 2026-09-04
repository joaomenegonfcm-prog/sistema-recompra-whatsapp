# Handoff de desenvolvimento — Sistema de Recompra por WhatsApp

**Objetivo:** migrar o desenvolvimento do projeto para o Claude preservando contexto de produto, arquitetura, decisões já aprovadas e o ponto exato de continuidade.

**Data de referência:** 24/08/2026

---

## 1. Visão geral do SaaS e arquitetura

### 1.1 Produto

O projeto é o **Sistema de Recompra por WhatsApp**, uma aplicação web single-tenant feita sob medida para uma microtorrefação de café especial.

O sistema existe para apoiar o ciclo manual de recompra:

1. cadastrar clientes e compras;
2. calcular/acompanhar ciclos de recompra;
3. identificar clientes que devem ser contatados;
4. abrir manualmente a conversa do WhatsApp por `wa.me`;
5. o usuário envia a mensagem manualmente;
6. o usuário volta ao sistema e registra a tentativa;
7. acompanhar histórico de compras, tentativas e alterações de status.

**Não é um SaaS multiempresa.**

**Não existe envio automático de WhatsApp.** A abertura do WhatsApp nunca registra automaticamente uma tentativa.

### 1.2 Stack

- React 19
- Vite 6
- TypeScript
- React Router
- Supabase Auth
- Supabase PostgreSQL
- `@supabase/supabase-js`
- PapaParse
- date-fns
- lucide-react
- clsx
- CSS existente, sem Tailwind
- npm com `package-lock.json`

### 1.3 Arquitetura funcional

A aplicação é organizada principalmente por features, com componentes UI compartilhados e serviços específicos de domínio.

Áreas principais conhecidas:

- Dashboard
- Contatos de Hoje
- Clientes
- Compras
- Importar CSV
- Histórico do cliente
- Configurações

Arquivos/áreas importantes:

- `src/features/customers/CustomersPage.tsx`
- `src/features/customers/CustomerHistoryPage.tsx`
- `src/features/purchases/PurchasesPage.tsx`
- `src/features/todayContacts/TodayContactsPage.tsx`
- `src/features/todayContacts/ContactCard.tsx`
- `src/features/todayContacts/todayContactsService.ts`
- `src/components/Layout/Sidebar.tsx`
- `src/components/UI/Input.tsx`
- `src/components/UI/Button.tsx`
- `src/components/UI/Modal.tsx`
- `src/components/UI/Badge.tsx`
- `src/styles/global.css`
- `supabase/sql/` para migrations SQL

O projeto possui `AGENTS.md` na raiz. Ele deve ser lido antes de qualquer mudança.

Skills instaladas em `.agents/skills`:

- `supabase`
- `supabase-postgres-best-practices`
- `ponytail`
- `ponytail-review`

**Ponytail deve permanecer em modo `lite`.** `full` e `ultra` não estão autorizados.

### 1.4 Regras funcionais críticas

Estas regras devem ser tratadas como invariantes:

- cada compra representa um ciclo de recompra;
- telefone é o principal identificador do cliente;
- criação de cliente/compra como ciclo passa pela RPC `create_purchase_cycle`;
- `purchases.status` nunca deve ser alterado diretamente pelo front-end;
- alterações manuais de status passam pela RPC `change_purchase_status`;
- `repurchased` não pode ser aplicado manualmente;
- uma tentativa válida é `status = 'sent'` e `voided_at is null`;
- tentativas anuladas preservam o registro e os campos `voided_*`;
- histórico, auditoria e snapshots devem ser preservados;
- opt-out bloqueia Contatos de Hoje e abertura do WhatsApp pelo sistema;
- remover opt-out não força contato imediato;
- abrir WhatsApp nunca registra automaticamente uma tentativa.

### 1.5 Limites técnicos já decididos

Nesta iniciativa de fundação visual não devem ser introduzidos:

- Tailwind;
- shadcn/ui;
- biblioteca visual/componentes externa;
- nova dependência visual;
- React Hook Form, Zod, Zustand ou TanStack Query;
- troca de stack;
- refatoração geral do front-end;
- automação do WhatsApp;
- alterações de schema, RLS ou RPC sem decisão funcional específica.

### 1.6 Direção visual

A direção aprovada é **padronização + reorganização de hierarquia**, não redesign amplo.

A identidade visual existente deve ser preservada.

Foram criados tokens mínimos em `global.css` para:

- página, superfície, texto, texto secundário e bordas;
- primária, hover e foco;
- sucesso, informação, aviso e perigo;
- raios pequenos, médios e pill;
- escala de espaços de 4 a 32 px.

A adoção dos tokens é incremental, somente nos componentes/seletores tocados.

Breakpoint responsivo aprovado: **`820px`**.

---

## 2. O que já foi entregue na V1

### 2.1 Produto V1 em produção

A V1 foi colocada em produção e estabeleceu a base funcional do sistema.

Capacidades principais entregues na V1:

- cadastro de clientes;
- cadastro de compras/ciclos;
- importação por CSV;
- visualização de clientes e compras;
- identificação de Contatos de Hoje;
- abertura manual de conversa por `wa.me`;
- registro manual de tentativas depois da ação do usuário;
- histórico operacional do cliente;
- dashboard e configurações básicas.

### 2.2 V2.0 — segurança de edição/status e auditoria

A V2.0 trouxe a camada de edição segura e auditoria de status.

Entregas conhecidas:

- migration de histórico de status: `supabase/sql/06_purchase_status_history.sql`;
- RPC `change_purchase_status`;
- camada TypeScript de tipos e serviços:
  - `src/types/purchase.ts`
  - `src/types/database.ts`
  - `customersService.ts`
  - `purchasesService.ts`
- edição segura de dados no front-end;
- alteração de status com motivo obrigatório;
- histórico das alterações de status;
- melhorias de acessibilidade relacionadas aos modais/edição.

### 2.3 V2.2 — base visual e UX incremental

Antes da V2.3 foi construída e encerrada uma fundação visual em cinco entregas.

#### Entrega 1 — tokens e componentes básicos

Arquivos principais:

- `src/components/UI/Input.tsx`
- `src/styles/global.css`

Implementado:

- `helpText?: ReactNode`;
- `errorMessage?: ReactNode`;
- geração de `id` com `useId()` quando necessário;
- associação correta de label/input;
- composição de `aria-describedby`;
- `aria-invalid` quando aplicável;
- ajuda e erro com elementos e IDs próprios;
- tokens CSS mínimos;
- estados visuais de botões via CSS;
- foco visível consistente;
- sem alteração de API do `Button.tsx`.

Validações concluídas:

- lint aprovado;
- build aprovado;
- `git diff --check` aprovado;
- desktop, celular e teclado/foco aprovados manualmente.

Commit conhecido:

```text
 a15e40d feat: add initial UI foundation
```

#### Entrega 2 — navegação móvel e cabeçalhos

Branch usada:

```text
feat/ui-navigation-headers
```

Implementado:

- menu móvel recolhível abaixo de `820px`;
- sidebar desktop preservada;
- `aria-expanded` e `aria-controls`;
- ID correspondente no menu;
- fechamento ao selecionar uma rota;
- todas as rotas preservadas, inclusive Configurações;
- cabeçalhos padronizados;
- ações primárias compactas no desktop;
- ações primárias em largura total no celular;
- Contatos de Hoje sem ação primária de página;
- Histórico com `Registrar nova compra` no cabeçalho.

Validação manual concluída e produção validada.

#### Entrega 3 — piloto Contatos de Hoje

Branch usada:

```text
feat/today-contacts-pilot
```

Implementado:

- instrução operacional explícita;
- sequência `Abrir WhatsApp` → `Confirmar envio`;
- abertura do WhatsApp continua sem registrar tentativa;
- `Registrar recompra` continua visível;
- `Pausar contato` foi movido para `Mais ações`;
- `Mais ações` com estado local e controles acessíveis;
- `Pausar contato` passou de `window.confirm` para `Modal` compartilhado;
- proteção contra confirmação duplicada na pausa;
- layout desktop/celular responsivo.

Arquivos principais:

- `src/features/todayContacts/TodayContactsPage.tsx`
- `src/features/todayContacts/ContactCard.tsx`
- `src/styles/global.css`

Validação manual concluída e produção validada.

#### Entrega 4 — cartões mobile de Clientes e Compras

Branch usada:

```text
feat/mobile-cards-customers-purchases
```

Implementado:

- tabelas preservadas no desktop;
- cartões compactos abaixo de `820px`;
- somente uma representação ativa por breakpoint;
- Clientes e Compras usam a mesma coleção/filtros/ordenação;
- nenhum segundo fetch;
- prévia CSV permanece tabular;
- sem componente genérico `ResponsiveTable`;
- preservação das rotas e ações existentes;
- `Não contatar` permanece em Clientes e não é repetido em Compras.

Arquivos principais:

- `src/features/customers/CustomersPage.tsx`
- `src/features/purchases/PurchasesPage.tsx`
- `src/styles/global.css`

Validação manual concluída e produção validada.

#### Entrega 5 — Histórico do cliente e opt-out visual

Branch usada:

```text
feat/customer-history-opt-out
```

Implementado:

- métricas organizadas de forma responsiva;
- fatos curtos em duas colunas quando há espaço;
- observações em largura total;
- alterações de status inicialmente limitadas aos três registros mais recentes por `createdAt`;
- expansão para todo o histórico;
- tentativas inicialmente limitadas às três maiores `attempt_number`, mostradas em ordem crescente;
- expansão para todas as tentativas;
- estado de expansão independente por compra e por seção;
- IDs únicos e `aria-expanded`/`aria-controls`;
- opt-out visual contextual no Histórico;
- modal para marcar como não contatar;
- modal para permitir contato novamente;
- motivo obrigatório;
- proteção durante processamento;
- botão explícito `Cancelar`;
- espaçamento visual corrigido entre Cancelar e confirmação;
- retirar opt-out não força contato imediato;
- nenhum service/RPC/Supabase foi alterado.

Arquivos principais:

- `src/features/customers/CustomerHistoryPage.tsx`
- `src/styles/global.css`

Validação manual concluída e produção validada.

### 2.4 Estado atual da fundação visual

A fundação visual foi **encerrada e aprovada**.

Todas as cinco entregas:

1. tokens/componentes;
2. navegação/cabeçalhos;
3. piloto Contatos de Hoje;
4. cartões mobile;
5. Histórico/opt-out;

foram implementadas, revisadas, validadas manualmente, integradas à `main`, publicadas e verificadas em produção.

---

## 3. Status exato de onde paramos na V2

### 3.1 O que está concluído

O bloco de V2 tratado nesta etapa está concluído:

- V2.0: concluída;
- V2.2/fundação visual: concluída;
- cinco entregas visuais: concluídas;
- produção atualizada e validada após essas entregas.

A V2.3 foi definida como a **próxima fase funcional**.

### 3.2 Próxima etapa: V2.3 — Tags e Perfil Básico

A especificação da V2.3 já foi aprovada e parte da estrutura de banco/testes já existe.

Migration conhecida:

```text
supabase/sql/09_customer_tags_profiles.sql
```

Teste conhecido:

```text
supabase/tests/v2_3_a_customer_tags_profiles.sql
```

A V2.3 contempla, no perfil do cliente, campos estruturados opcionais:

- produto ou café preferido — texto com sugestão;
- moagem preferida — seleção única;
- método de preparo — seleção múltipla;
- frequência de consumo — seleção única;
- perfil sensorial — seleção múltipla;
- observações — texto livre.

### 3.3 Tags — decisões conhecidas

A paleta de tags deve ficar limitada a seis cores:

- neutral;
- blue;
- green;
- yellow;
- orange;
- purple.

Não criar novas cores fora dessa paleta sem nova decisão.

### 3.4 Classificação de clientes

Regras já decididas:

- **Ativo:** até 30 dias;
- **Em resfriamento:** até 90 dias;
- **Frio:** acima de 90 dias.

Quando o cliente estiver inativo por mais de 90 dias, deve ser pausado automaticamente e mostrar uma indicação visual.

### 3.5 Testes V2.3 já executados

Os testes iniciais de `v2_3_a_customer_tags_profiles.sql` tiveram problemas com UUIDs placeholder e contexto de role.

Foram corrigidos:

- referências temporárias;
- uso de `set_config` para `v2_3_a.user_a` e `user_b`.

Após as correções, os testes passaram.

### 3.6 O que está pendente/interrompido

Não há entrega visual pendente da fundação atual.

Não há uma implementação parcial conhecida da V2.3 de UI neste ponto. A próxima frente é iniciar a implementação funcional da V2.3 a partir da migration/especificação já aprovadas.

A segunda entrega visual, terceira, quarta e quinta foram todas encerradas. Não retomar essas branches como se estivessem incompletas.

Também não há motivo para reabrir decisões da fundação visual sem um problema concreto encontrado em produção.

### 3.7 Próximas etapas recomendadas

Ao assumir o projeto no Claude:

**Etapa 1 — diagnóstico do estado atual**

Executar:

```powershell
git status --short
git branch --show-current
git branch -vv
git log -5 --oneline --decorate
git diff --name-only
git diff --cached --name-only
```

Confirmar que a `main` está alinhada com `origin/main` antes de abrir a V2.3.

Importante: o histórico desta conversa registra o hash exato da primeira entrega (`a15e40d`), mas não registra os hashes das quatro entregas visuais seguintes. Não inventar esses hashes; obtê-los diretamente do Git.

**Etapa 2 — ler as regras do projeto**

Antes de codar:

1. ler `AGENTS.md`;
2. ler a especificação aprovada da V2.3;
3. ler as migrations/testes de V2.3;
4. verificar o estado real do banco/Supabase no repositório;
5. verificar as branches e commits presentes no Git.

**Etapa 3 — iniciar V2.3**

A V2.3 deve ser tratada como evolução funcional, não como continuação da fundação visual.

Prioridades:

- tags;
- perfil básico do cliente;
- RLS/políticas já previstas na migration;
- UI de edição/exibição do perfil;
- classificação visual conforme as regras aprovadas;
- pausar automaticamente clientes frios conforme decisão funcional;
- testes de regressão sem quebrar o fluxo atual de recompra.

### 3.8 O que NÃO fazer ao retomar

Não:

- reabrir a fundação visual inteira;
- trocar o stack;
- introduzir Tailwind/shadcn;
- criar um design system novo;
- adicionar biblioteca de formulários/estado sem decisão explícita;
- misturar V2.3 com paginação ou otimizações de histórico;
- alterar as regras de tentativa/status sem requisito funcional;
- assumir que um commit existe sem verificar Git;
- afirmar que produção está atualizada sem confirmação do deploy.

---

## 4. Regras e decisões de design/código tomadas até aqui

### 4.1 Processo de implementação

As entregas devem ser incrementais e revisáveis.

Princípios já adotados:

- separar implementação local de validação manual;
- separar validação de lint/build de validação em produção;
- separar commit, merge, push, deploy e smoke test como etapas distintas;
- não misturar várias entregas sem checkpoint;
- não usar `git add .` quando existem arquivos pessoais/documentos não rastreados na pasta do projeto;
- nunca inventar estado do Git ou do deploy sem evidência.

### 4.2 Git e publicação

Fluxo de publicação utilizado:

1. branch específica da entrega;
2. alterações limitadas ao escopo;
3. lint/build/diff-check;
4. validação manual;
5. commit;
6. `main` atualizada por `git merge --ff-only`;
7. nova validação na `main`;
8. revisão de `origin/main..main`;
9. push da `main`;
10. deploy automático;
11. smoke test em produção.

O push de `main` dispara o deploy automático de produção.

### 4.3 Acessibilidade

Decisões recorrentes:

- preferência por HTML semântico e elementos nativos;
- `button` nativo para ações;
- `type="button"` quando a ação não deve submeter formulário;
- `aria-expanded`/`aria-controls` para regiões recolhíveis;
- IDs únicos para controles;
- conteúdo visualmente oculto deve deixar de participar da árvore/foco quando apropriado;
- foco visível deve ser preservado;
- não adicionar ARIA desnecessária quando HTML semântico resolve;
- modais existentes devem ser reutilizados;
- botões de cancelamento explícitos quando confirmação é destrutiva/relevante.

### 4.4 Responsividade

Breakpoint aprovado:

```text
820px
```

Acima de 820px:

- desktop preserva a estrutura atual;
- tabelas permanecem tabelas;
- sidebar permanece lateral;
- ações primárias são compactas e alinhadas à direita quando aplicável.

Em 820px ou menos:

- navegação vira menu vertical recolhível;
- ações primárias passam a ocupar largura total;
- Clientes e Compras usam cartões;
- Histórico reorganiza métricas/fatos e controles recolhíveis;
- ações de Contatos de Hoje ficam empilhadas;
- evitar rolagem horizontal inesperada.

### 4.5 Cabeçalhos de página

Padrão:

**Desktop**

- título/descrição à esquerda;
- ação principal à direita.

**Celular**

- título/descrição primeiro;
- ação abaixo;
- ação em largura total.

Exceção:

- Contatos de Hoje não possui ação primária de página.

### 4.6 Clientes e Compras

No desktop:

- tabelas preservadas.

No mobile:

- cartões compactos;
- tabela e cartões usam a mesma coleção/ordenção/filtros;
- não existe segunda consulta;
- somente uma representação é ativa no layout/árvore de acessibilidade;
- prévia CSV permanece tabular;
- não existe componente genérico `ResponsiveTable`.

### 4.7 Contatos de Hoje

Fluxo operacional aprovado:

```text
Abrir WhatsApp
→ enviar mensagem manualmente
→ voltar ao sistema
→ Confirmar envio
```

Regras:

- abrir WhatsApp não registra tentativa;
- confirmação não depende de detectar abertura;
- `Registrar recompra` continua visível e secundária;
- `Pausar contato` fica em `Mais ações`;
- `Mais ações` é uma revelação simples e acessível, não um dropdown genérico;
- pausa usa `Modal`, não `window.confirm`.

### 4.8 Histórico do cliente

- preservar todo o histórico;
- recolhimento é visual, não otimização de rede/banco;
- status: três mais recentes por `createdAt`, mais recentes primeiro;
- tentativas: três de maior `attempt_number`, em ordem crescente;
- expansão independente por compra/seção;
- não mutar arrays originais ao ordenar;
- não implementar paginação/novos índices/carregamento sob demanda nesta fundação.

### 4.9 Opt-out

Cliente sem opt-out:

- ação `Marcar como não contatar`;
- modal com explicação;
- motivo obrigatório;
- confirmação explícita.

Cliente com opt-out:

- badge `Não contatar` próximo ao nome;
- ação `Permitir contato novamente`;
- remoção não força contato imediato;
- histórico é preservado.

Onde mostrar:

- Clientes: badge discreto;
- Histórico: badge + ação contextual;
- Compras: não repetir badge em cada compra;
- Contatos de Hoje: normalmente excluído; proteção defensiva se aparecer.

### 4.10 CSS

Decisões:

- reutilizar tokens existentes;
- classes específicas para o contexto;
- evitar seletores excessivamente globais;
- evitar duplicação de regras;
- não substituir CSS inteiro mecanicamente;
- não usar cor como único indicador de estado;
- preservar estados de foco, hover, disabled e erro;
- evitar abstrações visuais grandes.

### 4.11 Componentes compartilhados

Não criar abstrações genéricas apenas para reduzir poucas linhas.

Exemplos explicitamente rejeitados:

- `ResponsiveTable` genérico;
- dropdown genérico para `Mais ações`;
- accordion genérico;
- design system próprio;
- componente genérico de loading.

A preferência é por pequenas funções/componentes locais quando o ganho for concreto e mantiver a arquitetura simples.

### 4.12 Dados e desempenho

Decisões importantes:

- recolhimento visual não é considerado otimização de backend;
- não usar paginação sem volume comprovado;
- se no futuro o histórico ficar lento, a primeira alternativa considerada é carregar detalhes por compra sob demanda;
- paginação fica para volume maior comprovado;
- não adicionar índices ou consultas novas por antecipação.

### 4.13 Segurança e integridade de dados

Não contornar:

- RPCs de mudança de status;
- auditoria;
- snapshots;
- RLS;
- opt-out;
- regras de tentativa.

A UI nunca deve assumir poderes que pertencem ao banco/RPC/service.

---

## Resumo de handoff para o Claude

**Estado:** V1 em produção + V2.0 concluída + fundação visual concluída e publicada + próximo passo é V2.3.

**Próximo trabalho:** iniciar a implementação funcional da V2.3 (tags + perfil básico + classificação/pausa de clientes conforme especificação existente).

**Não há entrega visual pendente.**

**Antes de qualquer código:** verificar `git`, ler `AGENTS.md`, ler a especificação da V2.3, revisar migration/testes V2.3 e confirmar o estado real do repositório/produção.

**Regra operacional central:** WhatsApp é manual; abrir conversa não registra tentativa.

**Regra de segurança central:** status e histórico seguem RPCs/auditoria; UI não altera `purchases.status` diretamente.

**Regra de design central:** melhorias incrementais, CSS existente, breakpoint `820px`, sem nova biblioteca visual e sem redesign amplo.
