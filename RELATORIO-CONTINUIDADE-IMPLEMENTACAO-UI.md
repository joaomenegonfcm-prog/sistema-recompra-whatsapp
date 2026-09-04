# Relatório de continuidade — Fundação visual e piloto Contatos de Hoje

Data de referência: 20/07/2026

## 1. Objetivo deste documento

Transferir para outro chat todo o contexto necessário para continuar a melhoria visual incremental do Sistema de Recompra por WhatsApp sem reabrir decisões já aprovadas e sem confundir trabalho concluído com trabalho ainda pendente.

## 2. Estado executivo

- A auditoria do front-end foi concluída.
- A direção visual foi aprovada: **padronização mais reorganização de hierarquia**, sem redesign amplo.
- A especificação `ESPECIFICACAO-UI-FUNDACAO-E-PILOTO.md` foi aprovada, corrigida após validação técnica e adicionada ao projeto.
- A primeira entrega de código foi implementada: tokens CSS mínimos e evolução do `Input`, além de estados visuais dos botões via CSS.
- A primeira entrega passou por lint, build e validação visual/manual em desktop, celular e teclado/foco.
- A segunda entrega **não foi iniciada**.
- Não há confirmação, neste histórico, de que o commit da primeira entrega, o merge na `main` e o push de produção tenham sido executados. O novo chat deve verificar o Git antes de afirmar que a produção foi atualizada.

## 3. Contexto do produto

O sistema é uma ferramenta web single-tenant feita sob medida para uma microtorrefação de café especial.

Função principal:

- cadastrar clientes e compras;
- calcular ciclos de recompra;
- listar contatos que devem ser abordados;
- abrir manualmente conversas por `wa.me`;
- registrar tentativas somente depois da ação manual do usuário.

O produto não é um SaaS multiempresa e não envia mensagens automaticamente.

Estado funcional informado:

- V1 em produção;
- V2.0 concluída;
- V2.2 concluída;
- próxima fase funcional: V2.3 — tags e perfil básico;
- antes da V2.3 está sendo criada uma fundação visual pequena e consistente.

## 4. Stack e limites

Stack atual:

- React 19;
- Vite 6;
- TypeScript;
- React Router;
- Supabase Auth e PostgreSQL;
- CSS existente;
- `@supabase/supabase-js`, PapaParse, date-fns, lucide-react e clsx;
- npm com `package-lock.json`.

Não adicionar nesta iniciativa:

- Tailwind;
- shadcn/ui;
- biblioteca de componentes;
- dependência visual;
- React Hook Form, Zod, Zustand ou TanStack Query;
- troca de stack;
- alteração de schema, RLS, RPCs ou dados do Supabase;
- mudança das regras de negócio;
- refatoração geral do front-end;
- automação do WhatsApp.

## 5. Instruções e Skills do projeto

O repositório possui `AGENTS.md` na raiz. Ele deve ser lido antes de qualquer trabalho.

Ordem de prioridade:

1. pedido atual e decisões explícitas do usuário;
2. especificação aprovada da fase;
3. regras de negócio e segurança do `AGENTS.md`;
4. Skills oficiais de Supabase e Postgres;
5. Ponytail.

Skills instaladas em `.agents/skills`:

- `supabase`;
- `supabase-postgres-best-practices`;
- `ponytail`;
- `ponytail-review`.

Ponytail deve permanecer em modo `lite`. Os modos `full` e `ultra` não estão autorizados.

Commits de configuração já conhecidos e enviados anteriormente à `main`:

- `a023988 chore: add Codex project skills and guidance`;
- `6a0376e docs: align SQL setup instructions`.

## 6. Regras de negócio que não podem ser afetadas

- Cada compra representa um ciclo de recompra.
- O telefone é o principal identificador do cliente.
- Criação de cliente/compra como ciclo passa pela RPC `create_purchase_cycle`.
- `purchases.status` nunca deve ser alterado diretamente pelo front-end.
- Alterações manuais de status passam pela RPC `change_purchase_status`.
- `repurchased` não pode ser aplicado manualmente.
- Uma tentativa válida é `status = 'sent'` e `voided_at is null`.
- Tentativas anuladas preservam o registro original e os campos `voided_*`.
- Histórico, auditoria e snapshots devem ser preservados.
- O opt-out bloqueia Contatos de Hoje e abertura do WhatsApp pelo sistema.
- Remover opt-out não força contato imediato.
- Abrir WhatsApp nunca registra automaticamente uma tentativa.

## 7. Auditoria visual concluída

Foram analisadas a arquitetura, o CSS, os componentes compartilhados e as telas principais. Também foram fornecidas capturas de:

- Clientes — desktop e celular;
- Compras — desktop e celular;
- Contatos de Hoje — desktop e celular;
- Histórico do cliente — desktop e celular.

Principais conclusões:

- a identidade atual é funcional e deve ser preservada;
- não é necessário redesign amplo;
- a navegação móvel horizontal fica cortada e precisa ser substituída;
- tabelas de Clientes e Compras ficam densas demais no celular;
- ações primárias ocupam largura excessiva no desktop;
- o histórico do cliente fica muito longo;
- Contatos de Hoje precisa deixar mais explícita a sequência operacional;
- componentes e mensagens possuem inconsistências que podem ser corrigidas progressivamente.

## 8. Decisões visuais aprovadas

### 8.1 Tokens

Adicionar tokens mínimos para:

- página, superfície, texto, texto secundário e bordas;
- cor primária, hover e foco;
- sucesso, informação, aviso e perigo;
- raios pequenos, médios e pill;
- escala de espaços de 4 a 32 px.

Adoção progressiva:

- somente componentes e seletores tocados;
- sem substituição mecânica de todo o CSS;
- sem tema escuro ou design system amplo.

### 8.2 Navegação

- Desktop: preservar a navegação lateral atual.
- Abaixo de 820 px: substituir a navegação horizontal rolável por menu vertical recolhível.
- Usar React, CSS e ícones existentes.
- Acionador com nome acessível, `aria-expanded` e `aria-controls`.
- Menu operável por teclado.
- Selecionar rota fecha o menu.
- Todas as rotas, inclusive Configurações, devem ser alcançáveis.

### 8.3 Cabeçalhos e ações primárias

Desktop:

- título e descrição à esquerda;
- ação primária compacta à direita.

Celular:

- título e descrição primeiro;
- ação primária em largura total abaixo.

Aplicação:

- Clientes: `Nova compra`;
- Compras: `Nova compra`;
- Histórico: `Registrar nova compra`;
- Contatos de Hoje: sem ação primária de página.

### 8.4 Clientes e Compras

- Desktop mantém tabelas.
- Celular usa cartões compactos.
- Somente uma representação participa do layout e da árvore de acessibilidade por breakpoint.
- Tabela e cartões derivam da mesma coleção e do mesmo mapeamento explícito de dados.
- Não criar abstração genérica `ResponsiveTable`.
- A prévia de CSV continua tabular com rolagem horizontal.

### 8.5 Histórico do cliente

- Métricas em duas colunas no celular quando houver espaço.
- Fatos curtos em duas colunas; observação em largura total.
- Alterações de status: mostrar inicialmente três registros mais recentes por `created_at`.
- Tentativas: usar as três de maior `attempt_number`, apresentadas em ordem crescente.
- Expansão disponibiliza todo o histórico.
- Aplicar recolhimento em desktop e celular.
- Não implementar paginação, novos índices ou carregamento sob demanda agora.

O recolhimento melhora organização, não o tempo de carregamento. Se medições futuras demonstrarem lentidão, a primeira opção será carregar detalhes por compra sob demanda; paginação fica para volume maior comprovado.

### 8.6 Contatos de Hoje — piloto

Instrução da página:

> Abra a conversa no WhatsApp, envie a mensagem e depois volte ao sistema para registrar o envio.

Sequência por cartão:

1. `Abrir WhatsApp`;
2. `Confirmar envio`.

Regras:

- abrir WhatsApp não registra tentativa;
- confirmação não pode depender de o sistema ter detectado a abertura;
- desktop pode apresentar as duas ações lado a lado;
- celular apresenta ações empilhadas e em largura total;
- `Registrar recompra` permanece secundária e visível;
- `Pausar contato` vai para `Mais ações`;
- `Mais ações` deve ser uma revelação simples e acessível, não um dropdown genérico;
- pausa deve usar o `Modal` compartilhado em vez de `window.confirm`.

### 8.7 Opt-out

Cliente disponível:

- ação `Marcar como não contatar`;
- modal explica exclusão de Contatos de Hoje, bloqueio do WhatsApp, preservação do histórico e reversibilidade.

Cliente bloqueado:

- badge `Não contatar` próximo ao nome;
- ação `Permitir contato novamente`;
- remoção não força contato imediato.

Onde mostrar:

- Clientes: badge discreto;
- Histórico: badge e ação contextual;
- Compras: não repetir badge em cada compra;
- Contatos de Hoje: normalmente excluído; se aparecer defensivamente, mostrar aviso e bloquear ações de contato.

## 9. Divisão aprovada das entregas

1. Tokens e componentes compartilhados.
2. Navegação móvel e cabeçalhos.
3. Piloto Contatos de Hoje.
4. Clientes e Compras em cartões no celular.
5. Histórico do cliente e opt-out visual.

Após o piloto, deve haver validação visual antes de propagar padrões às demais telas.

## 10. Primeira entrega — implementada e validada

Arquivos alterados:

- `src/components/UI/Input.tsx`;
- `src/styles/global.css`.

### 10.1 Input

Implementado de forma retrocompatível:

- `helpText?: ReactNode`;
- `errorMessage?: ReactNode`;
- `useId()` quando não existe `id` fornecido;
- associação entre label e input;
- combinação do `aria-describedby` recebido com IDs de ajuda e erro;
- `aria-invalid` automático quando existe erro, preservando valor explícito quando não há erro;
- ajuda e erro renderizados como `<span>` com IDs e classes próprios.

Uma primeira versão utilizava `<p>` dentro de `<label>`. Isso foi identificado na revisão e corrigido para `<span>`.

### 10.2 CSS

Implementado:

- tokens mínimos em `:root`;
- `:root` consumindo `--color-text` e `--color-page`;
- tokens aplicados somente aos seletores compartilhados tocados;
- `Button` preservando API e variantes `primary`, `secondary` e `ghost`;
- hover não aplicado a botões desabilitados;
- foco visível global usando `--color-focus`;
- regra duplicada `.button:focus-visible` removida após revisão;
- `.input:focus` alterando somente a borda;
- outline de teclado vindo da regra global `:focus-visible`;
- `.field-help` usando `--color-text-muted`;
- `.field-error` usando `--color-danger-text`;
- seletor do texto do label ajustado para não aplicar o estilo aos spans de ajuda e erro.

`Button.tsx` não foi alterado porque a API existente já era suficiente. Não foi criada prop genérica de loading.

### 10.3 Escopo preservado

Não foram alterados:

- telas;
- navegação;
- `Button.tsx`;
- `Modal` ou `Badge`;
- services;
- Supabase;
- regras de negócio;
- dependências.

### 10.4 Verificações concluídas

- `npm.cmd run lint`: passou.
- `npm.cmd run build`: passou fora do sandbox; 1981 módulos transformados.
- `git diff --check`: passou.
- Avisos LF → CRLF apareceram nos dois arquivos e foram tratados como normalização do Windows, não erro.
- Validação manual desktop: aprovada pelo usuário.
- Validação manual celular: aprovada pelo usuário.
- Validação por teclado e foco: aprovada pelo usuário.

O projeto não possui testes automatizados. Não declarar que testes automatizados passaram.

Último diff stat informado antes do commit:

```text
src/components/UI/Input.tsx | 44 ++++++++++++++++++++--
src/styles/global.css       | 90 ++++++++++++++++++++++++++++++++++-----------
2 files changed, 109 insertions(+), 25 deletions(-)
```

## 11. Estado Git que precisa ser confirmado

Antes da migração de chat, foi planejado:

1. criar commit local da primeira entrega na branch `feat/ui-foundation`;
2. integrar por fast-forward na `main`;
3. rodar lint e build na `main`;
4. fazer push da `main`;
5. o push na `main` aciona deploy automático de produção.

Entretanto, não foi fornecida saída confirmando a execução desses passos.

O novo chat deve começar com diagnóstico somente de leitura:

```powershell
git status --short
git branch --show-current
git branch -vv
git log -5 --oneline --decorate
git diff --name-only
git diff --cached --name-only
```

Não assumir que houve commit, merge, push ou deploy sem essas evidências.

Se os dois arquivos ainda estiverem modificados e não houver commit, o commit planejado é:

```text
feat: add initial UI foundation
```

Arquivos permitidos nesse commit:

```text
src/components/UI/Input.tsx
src/styles/global.css
```

## 12. Publicação de produção

Fluxo informado pelo usuário:

- push na branch `main` aciona automaticamente o deploy de produção.

Antes do push:

- `main` deve conter somente a entrega aprovada;
- `npm.cmd run lint` deve passar;
- `npm.cmd run build` deve passar;
- `git status --short` deve ficar limpo após commit/merge;
- revisar o intervalo que será enviado com `git log` e/ou `git diff origin/main..main`.

Depois do push:

- confirmar que `main` e `origin/main` apontam para o mesmo commit;
- aguardar o deploy automático;
- abrir a produção legitimamente;
- fazer smoke test sem alterar dados;
- verificar aparência geral, carregamento, login se aplicável, foco e campos existentes;
- não declarar produção validada apenas porque o push foi aceito.

## 13. Segunda entrega — não iniciada

A segunda entrega será:

- navegação móvel recolhível;
- padrão de cabeçalhos e ações primárias.

Ela não deve começar até a primeira entrega estar versionada e, se essa for a decisão atual, validada em produção.

Escopo da segunda entrega:

- preservar sidebar lateral no desktop;
- abaixo de 820 px, menu vertical recolhível;
- acessibilidade do acionador e do menu;
- fechamento ao navegar;
- cabeçalho/ação em Clientes, Compras e Histórico;
- nenhuma ação primária de página em Contatos de Hoje;
- classes CSS simples e compartilhadas.

Fora da segunda entrega:

- reorganização de Contatos de Hoje;
- `Mais ações` e modal de pausa;
- cartões móveis;
- histórico recolhível;
- opt-out visual;
- services, Supabase ou regras de negócio.

## 14. Arquivos prováveis das próximas entregas

Segunda entrega:

- `src/components/Layout/Sidebar.tsx`;
- possivelmente `src/components/Layout/Header.tsx` somente se necessário;
- `src/styles/global.css`;
- `src/features/customers/CustomersPage.tsx`;
- `src/features/purchases/PurchasesPage.tsx`;
- `src/features/customers/CustomerHistoryPage.tsx`.

Piloto Contatos de Hoje:

- `src/features/todayContacts/TodayContactsPage.tsx`;
- `src/features/todayContacts/ContactCard.tsx`;
- `src/components/UI/Modal.tsx` se a API precisar de descrição programática opcional;
- `src/styles/global.css`.

Entregas posteriores:

- `src/features/customers/CustomersPage.tsx`;
- `src/features/purchases/PurchasesPage.tsx`;
- `src/features/customers/CustomerHistoryPage.tsx`;
- `src/components/UI/Badge.tsx`;
- `src/styles/global.css`.

## 15. Riscos conhecidos

- Não permitir que abrir WhatsApp registre tentativa automaticamente.
- Não criar dependência local frágil entre abrir WhatsApp e habilitar confirmação.
- Não modificar contratos dos services ou RPCs durante mudanças visuais.
- Não duplicar leitura de tabela e cartões para leitores de tela.
- Não transformar `Mais ações` em um componente genérico complexo.
- Preservar ordenação e conteúdo completo do histórico.
- Não confundir tags futuras com badges de status.
- Não usar recolhimento visual como alegação de otimização de rede ou banco.
- Não misturar várias entregas sem checkpoints revisáveis.

## 16. Próxima ação recomendada no novo chat

1. Ler `AGENTS.md` e a especificação aprovada.
2. Executar o diagnóstico Git da seção 11.
3. Confirmar se a primeira entrega já foi commitada.
4. Se ainda não foi, revisar stage e criar somente o commit planejado.
5. Integrar na `main` por fast-forward quando possível.
6. Rodar lint e build na `main`.
7. Revisar o intervalo em relação a `origin/main`.
8. Fazer push da `main`, sabendo que isso publica em produção.
9. Validar o deploy e realizar smoke test.
10. Somente depois iniciar a segunda entrega.

## 17. Regra para afirmações no novo chat

Separar sempre:

- implementado localmente;
- validado por lint/build;
- validado manualmente;
- commitado;
- enviado ao GitHub;
- implantado;
- validado em produção.

Um estágio não prova automaticamente o seguinte.
