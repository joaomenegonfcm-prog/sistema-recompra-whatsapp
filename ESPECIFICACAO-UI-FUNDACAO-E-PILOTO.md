# Especificação de UI — Fundação visual e piloto Contatos de Hoje

Status: decisões de produto aprovadas e validação técnica de leitura concluída; pronta para implementação fatiada.

## 1. Objetivo

Criar uma fundação visual pequena e consistente antes da V2.3, corrigindo problemas transversais de hierarquia, responsividade, feedback e acessibilidade sem redesenhar o produto.

A primeira aplicação completa da fundação será a tela **Contatos de Hoje**. As demais telas serão adaptadas de forma incremental, conforme o plano desta especificação.

## 2. Contexto e princípios

- A V1 está em produção.
- V2.0 e V2.2 estão concluídas.
- A próxima fase funcional será V2.3 — tags e perfil básico.
- O produto continua single-tenant e voltado à operação manual de recompra por WhatsApp.
- O WhatsApp continua manual: abrir uma conversa nunca equivale a registrar que uma mensagem foi enviada.
- Regras de negócio, auditoria, histórico, snapshots, RLS e segurança têm prioridade sobre simplificações visuais.
- Aplicar Ponytail somente em modo `lite`.

## 3. Fora de escopo

Esta iniciativa não autoriza:

- Tailwind;
- shadcn/ui;
- biblioteca nova de componentes;
- dependência visual nova;
- troca de stack;
- redesign completo;
- tema escuro;
- refatoração geral do front-end;
- alteração de regras de negócio;
- mudança de schema, RPC, RLS, Edge Function ou dados do Supabase;
- alteração dos contratos atuais dos services e das RPCs acionadas pelos fluxos visuais;
- automação do WhatsApp;
- implementação antecipada de tags;
- paginação ou carregamento sob demanda do histórico sem evidência de desempenho que justifique a mudança;
- criação prematura de abstrações genéricas para tabelas, listas responsivas ou mensagens.

## 4. Estratégia de implementação

### Etapa A — Fundação compartilhada

Implementar somente os elementos necessários para sustentar o piloto:

1. tokens CSS mínimos;
2. navegação móvel recolhível;
3. padrão de cabeçalho de página e ação primária;
4. evolução dos componentes compartilhados tocados;
5. padronização progressiva de mensagens e estados;
6. correções essenciais de foco, nomes acessíveis e associação de erros a campos.

### Etapa B — Piloto Contatos de Hoje

Aplicar a fundação à tela, reorganizar a sequência operacional e validar desktop e celular.

### Etapa C — Adoção incremental

Depois de validar o piloto:

1. Clientes e Compras: cabeçalhos e representação móvel em cartões compactos;
2. Histórico do cliente: hierarquia, métricas, opt-out e recolhimento de eventos antigos;
3. demais telas: somente quando forem tocadas, reutilizando os padrões aprovados.

Cada etapa deve ser um conjunto de alterações revisável. Não misturar a fundação inteira, o piloto e todas as telas em uma única entrega.

## 5. Tokens CSS mínimos

Adicionar variáveis sem alterar intencionalmente a identidade visual atual:

```css
:root {
  --color-page: #f5f7f4;
  --color-surface: #ffffff;
  --color-text: #1f2722;
  --color-text-muted: #657067;
  --color-border: #dde5dd;
  --color-border-strong: #bdc9c0;

  --color-primary: #23533d;
  --color-primary-hover: #173d2d;
  --color-focus: #b9ddc6;

  --color-success-text: #17633d;
  --color-success-bg: #dff3e7;
  --color-success-border: #a8d0b5;

  --color-info-text: #205b8f;
  --color-info-bg: #e3effb;

  --color-warning-text: #765400;
  --color-warning-bg: #fff2cf;
  --color-warning-border: #e1d2a8;

  --color-danger-text: #963a30;
  --color-danger-bg: #fbe5e2;
  --color-danger-border: #e3b8b3;

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-pill: 999px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 32px;
}
```

Regras de adoção:

- aplicar primeiro aos componentes compartilhados e seletores alterados nesta iniciativa;
- não substituir mecanicamente todas as cores e medidas do CSS atual;
- preservar tipografia, densidade geral e aparência reconhecível;
- consolidar valores próximos somente quando o componente estiver sendo modificado;
- opt-out é um estado de negócio próprio, mesmo que use cores relacionadas a alerta ou bloqueio.

## 6. Navegação responsiva

### Desktop

- Preservar a navegação lateral atual no desktop.
- Manter indicação clara da rota ativa.
- Não alterar a arquitetura de rotas.

### Celular — abaixo de 820 px

- Substituir a navegação móvel atualmente rolável horizontalmente por um menu recolhível vertical.
- Usar React, CSS e os ícones já existentes.
- Não adicionar dependência.
- O acionador deve possuir nome acessível, `aria-expanded` e relação com o menu controlado.
- O menu deve ser operável por teclado e exibir foco visível.
- Selecionar uma rota deve fechar o menu.
- A rota ativa deve ser identificável sem depender apenas de cor.
- Todas as opções, inclusive Configurações, devem permanecer alcançáveis sem rolagem horizontal da página.

## 7. Cabeçalho de página e ação primária

### Desktop

- Título e descrição à esquerda.
- Uma ação primária compacta à direita quando a tela possuir uma ação principal.
- Evitar botão primário ocupando toda a largura em desktop.

### Celular

- Título e descrição primeiro.
- Ação primária abaixo, ocupando a largura disponível.

### Aplicação

- Clientes: `Nova compra`.
- Compras: `Nova compra`.
- Histórico do cliente: `Registrar nova compra`.
- Contatos de Hoje: não criar ação primária de página; as ações pertencem a cada contato.

O padrão pode ser implementado com CSS compartilhado simples. Não criar um componente abstrato se poucas classes resolverem o problema com clareza.

## 8. Componentes compartilhados

### Button — evoluir

- Preservar variantes `primary`, `secondary` e `ghost`.
- Garantir estados coerentes de `hover`, `focus-visible`, `disabled` e carregamento quando aplicável.
- Um botão desabilitado não pode parecer disponível.
- Ícone sem texto só é permitido com nome acessível.
- Manter área de toque adequada nos controles móveis.

### Input — evoluir

- Preservar o componente existente.
- Permitir texto de ajuda e mensagem de erro sem obrigar todas as telas a usá-los.
- Associar erro e ajuda ao campo por `aria-describedby`.
- Aplicar `aria-invalid` quando houver erro.
- Não usar placeholder como substituto de label em formulários.

### Badge — evoluir com moderação

- Preservar badges de status existentes.
- O texto deve transmitir o significado; cor não pode ser a única pista.
- Adicionar representação semântica de opt-out: `Não contatar`.
- Não misturar visualmente tags futuras com status operacionais.

### Card, EmptyState e Loading — preservar

- Reutilizar estrutura e identidade atuais.
- Ajustar somente espaçamento, semântica ou responsividade necessários.
- Loading deve ter anúncio acessível quando representar espera relevante.
- EmptyState deve indicar o estado e, quando houver, a próxima ação apropriada.

### Modal — preservar e reutilizar

- Usar o Modal existente para confirmações importantes.
- Preservar foco inicial, contenção de foco, Escape e retorno de foco ao acionador.
- Título e descrição devem explicar consequência, não apenas repetir o nome da ação.
- Se for necessária descrição programática, evoluir o Modal existente com prop opcional ou conteúdo associado, sem substituir o componente.
- Substituir o `window.confirm` existente no fluxo de pausa de Contatos de Hoje pelo Modal compartilhado e não introduzir novos `window.confirm` nos fluxos tocados.

### Mensagens

- Consolidar progressivamente estilos duplicados de erro, sucesso, aviso e informação.
- Erros devem ser associados ao campo ou região correspondente.
- Mensagens assíncronas relevantes devem usar semântica apropriada, sem anunciar conteúdo estático desnecessariamente.
- Não criar agora um sistema genérico complexo de notificações.

## 9. Listas densas e responsividade

### Clientes e Compras

- Desktop: preservar a tabela existente.
- Celular: renderizar uma representação em cartões compactos com o mesmo conjunto de dados operacional.
- Em cada breakpoint, somente a representação ativa deve participar do layout e da árvore de acessibilidade; tabela e cartões não podem produzir leitura duplicada.
- Tabela e cartões devem derivar da mesma coleção e de um mapeamento explícito dos campos para reduzir divergências, sem criar uma abstração genérica de tabela responsiva.
- Preservar o mesmo conteúdo e as mesmas ações disponíveis; a mudança é de apresentação.
- Priorizar nome/identificação, status e informação necessária à decisão.
- Dados secundários devem permanecer legíveis, sem simular uma tabela espremida.
- Não criar um componente universal `ResponsiveTable` nesta fase.

### Importação CSV

- Preservar a tabela de pré-visualização com rolagem horizontal quando necessário.
- Uma prévia tabular é apropriada porque o usuário precisa comparar colunas.
- Não converter a prévia em cartões.

### Breakpoints

- Usar 820 px como mudança principal entre navegação/layout amplo e móvel.
- Manter 480 px apenas para ajustes estreitos realmente necessários.
- Evitar novos breakpoints sem necessidade demonstrada.

## 10. Piloto — Contatos de Hoje

### 10.1 Tarefa principal

O usuário deve entender e executar esta sequência:

1. abrir a conversa no WhatsApp;
2. enviar a mensagem manualmente;
3. voltar ao sistema;
4. confirmar o envio.

### 10.2 Instrução da página

Exibir uma orientação única e curta:

> Abra a conversa no WhatsApp, envie a mensagem e depois volte ao sistema para registrar o envio.

Evitar repetir instruções extensas em todos os cartões.

### 10.3 Hierarquia por cartão

Apresentar visualmente as ações numeradas:

1. `Abrir WhatsApp`
2. `Confirmar envio`

Regras:

- abrir WhatsApp nunca registra automaticamente uma tentativa;
- não criar dependência frágil de estado local que bloqueie a confirmação apenas porque o sistema não observou a abertura;
- em desktop, as duas ações podem ficar lado a lado;
- em celular, devem ficar empilhadas e ocupar a largura disponível;
- `Registrar recompra` permanece visível como ação secundária;
- `Pausar contato` deve ficar em `Mais ações`;
- preferir uma revelação simples de ações secundárias, operável por teclado, em vez de introduzir um componente genérico de dropdown ou semântica de menu de aplicação;
- a confirmação de pausa deve usar o Modal existente;
- ações destrutivas ou de mudança de estado não devem competir visualmente com `Abrir WhatsApp`.

### 10.4 Estados do cartão

Validar e representar:

- carregamento;
- vazio;
- erro;
- sucesso após registro;
- ações desabilitadas durante requisição;
- contato em opt-out defensivo;
- status operacionais já existentes.

O estado desabilitado durante uma operação deve impedir duplo envio sem apagar o contexto da ação.

### 10.5 Opt-out defensivo

Clientes em opt-out normalmente não devem aparecer em Contatos de Hoje. Caso apareçam por estado transitório ou defensivo:

- exibir aviso persistente e textual;
- bloquear abertura do WhatsApp e confirmação de envio;
- não depender somente de cor ou do título do botão;
- explicar que o cliente está marcado como `Não contatar`.

## 11. Opt-out nas demais telas

Separar sempre **estado** e **ação**.

### Cliente disponível para contato

- Ação: `Marcar como não contatar`.
- Modal: explicar que o cliente será excluído de Contatos de Hoje, que o WhatsApp será bloqueado no sistema, que o histórico será preservado e que a decisão é reversível.

### Cliente em opt-out

- Badge próximo ao nome: `Não contatar`.
- Ação: `Permitir contato novamente`.
- Modal: explicar que remover o bloqueio não força contato imediato nem cria uma tentativa.

### Onde exibir

- Lista de Clientes: badge discreto junto à identificação.
- Histórico do cliente: badge e ação contextual.
- Compras: não repetir o badge em cada compra.

## 12. Histórico do cliente

### Organização

- Celular: métricas em grade de duas colunas quando houver espaço suficiente.
- Fatos curtos da compra: duas colunas no celular quando legíveis.
- Observação: sempre em largura total.
- Preservar ordem cronológica e acesso ao histórico completo.

### Eventos de tentativas e status

- Para alterações de status, mostrar inicialmente os três registros mais recentes por `created_at`, preservando a ordenação atual do histórico completo.
- Para tentativas, considerar mais recentes as três de maior `attempt_number`; apresentar esse subconjunto em ordem operacional crescente e, ao expandir, preservar a ordem operacional crescente do conjunto completo.
- O recolhimento não pode alterar contagens, conteúdo ou histórico.
- Disponibilizar os anteriores por expansão acessível.
- Aplicar o recolhimento em desktop e celular para reduzir densidade visual.
- O controle deve indicar quantidade adicional quando possível, por exemplo `Ver mais 5 alterações`.
- O estado expandido deve permitir `Ver menos`.

### Limite desta fase

O recolhimento é uma melhoria de legibilidade, não de carregamento: os dados atuais continuam sendo buscados e renderizados.

Não implementar agora:

- paginação;
- novos índices;
- mudança das consultas Supabase;
- carregamento sob demanda.

Se medições futuras mostrarem lentidão, priorizar carregamento dos detalhes por compra sob demanda. Paginar a lista de compras somente em cenário mais volumoso e comprovado.

## 13. Preparação visual para V2.3

- Não reservar espaços vazios nem implementar componentes de tags antecipadamente.
- A fundação deve permitir que pequenos marcadores sejam adicionados depois sem competir com badges de status.
- Tags futuras representam categorização; badges atuais representam estado operacional. A especificação da V2.3 deverá preservar essa distinção.
- Cartões móveis devem ter estrutura clara o bastante para receber metadados futuros sem nova reconstrução completa.

## 14. Acessibilidade — critérios mínimos

- Todas as ações devem ser alcançáveis por teclado.
- Foco visível deve existir em links, botões, inputs, tabs, menu móvel e controles de expansão.
- Campos de formulário devem possuir labels programáticas.
- Erros devem estar associados aos campos correspondentes.
- Botões apenas com ícone devem possuir nome acessível.
- Menu móvel deve comunicar aberto/fechado.
- Expansões devem comunicar estado por `aria-expanded` quando não forem implementadas com elemento semântico nativo.
- Modais devem preservar o comportamento acessível já existente.
- Estados não podem depender exclusivamente de cor.
- Contraste deve ser conferido visualmente nas combinações de texto, fundo, borda e foco tocadas.

## 15. Critérios de aceite por etapa

### Fundação

- nenhuma dependência adicionada;
- navegação completa e sem corte em celular;
- desktop mantém navegação horizontal funcional;
- componentes tocados usam os tokens mínimos;
- foco visível e teclado funcionam nos controles alterados;
- ausência de mudança de regras de negócio;
- `npm run lint` e `npm run build` aprovados.

### Piloto Contatos de Hoje

- a sequência WhatsApp → retorno → confirmação é compreensível sem explicação externa;
- abrir WhatsApp não registra tentativa;
- confirmação continua possível sem depender de detecção da abertura;
- `Registrar recompra` continua disponível como secundária;
- pausa está em `Mais ações` e usa Modal;
- opt-out defensivo bloqueia contato e explica o motivo;
- estados de espera, erro, sucesso e desabilitado são verificáveis;
- desktop e celular foram inspecionados visualmente;
- teclado, foco e nomes acessíveis foram verificados.

### Adoção nas telas

- tabelas continuam em desktop;
- Clientes e Compras usam cartões compactos em celular;
- CSV continua tabular e rolável;
- Histórico exibe três eventos recentes e permite acessar todos;
- opt-out é mostrado e acionado com textos aprovados;
- nenhuma informação operacional foi removida apenas para simplificar o layout.

## 16. Verificação visual necessária

Capturar screenshots de página inteira e também recortes próximos das áreas interativas quando a captura completa reduzir demais o conteúdo.

Viewports de referência:

- desktop: aproximadamente 1366 × 768;
- celular: aproximadamente 390 × 844;

Para o piloto, registrar:

1. Contatos de Hoje com vários contatos — desktop e celular;
2. cartão normal em detalhe — desktop e celular;
3. `Mais ações` aberto;
4. modal de pausa;
5. estado de carregamento ou ação em andamento;
6. estado de erro;
7. estado de sucesso após confirmação;
8. estado vazio;
9. caso defensivo de opt-out, se puder ser reproduzido legitimamente sem alterar produção;
10. navegação móvel fechada e aberta.

Se um estado não puder ser reproduzido com segurança, registrar a limitação em vez de alterar dados reais ou inventar evidência.

## 17. Validação técnica concluída

A revisão somente de leitura contra o repositório foi concluída antes da implementação. Ela confirmou:

- compatibilidade com `AGENTS.md` e com as regras de negócio;
- ausência de necessidade de nova dependência ou mudança no Supabase;
- necessidade de preservar a navegação lateral no desktop;
- substituição do `window.confirm` existente no fluxo de pausa;
- necessidade de explicitar ordenação e recolhimento do histórico;
- divisão da implementação em entregas pequenas e revisáveis;
- ausência atual de testes automatizados de componentes, E2E e acessibilidade.

A validação não substitui as verificações de cada entrega: lint, build, inspeção visual, teclado, foco e estados relevantes continuam obrigatórios.

## 18. Veredito de direção

A interface precisa de **padronização mais reorganização de hierarquia**, não de reestruturação ampla.

A identidade visual, o CSS existente e os componentes compartilhados são a base. A melhoria deve reduzir inconsistências e tornar a operação mais clara, sem substituir a arquitetura atual.
