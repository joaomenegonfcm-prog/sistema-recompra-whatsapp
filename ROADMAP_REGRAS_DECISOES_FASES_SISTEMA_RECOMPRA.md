# Sistema de Recompra por WhatsApp — Regras, Decisões Pendentes e Roadmap Futuro

**Documento de continuidade estratégica e técnica**  
**Data de referência:** 31/08/2026  
**Objetivo:** servir como documento-base para retomar o desenvolvimento do projeto em outro ambiente/assistente, preservando as decisões de negócio, arquitetura, UX e o roadmap conhecido.

> **Regra de leitura:** este documento separa o que já foi decidido do que ainda está em aberto. Onde o histórico disponível não registra uma decisão definitiva, o item aparece explicitamente como pendente; não são criadas decisões novas por inferência.

---

# 1. Regras de Negócio Decididas

## 1.1 Visão de negócio do produto

O **Sistema de Recompra por WhatsApp** é uma aplicação web **single-tenant**, desenvolvida sob medida para uma microtorrefação de café especial.

Seu objetivo é apoiar o processo operacional de recompra de clientes por meio de um fluxo **manual e controlado**:

1. cadastrar clientes;
2. cadastrar compras;
3. tratar cada compra como um ciclo de recompra;
4. determinar quando o cliente deve voltar a ser contatado;
5. listar os contatos elegíveis em **Contatos de Hoje**;
6. abrir manualmente a conversa no WhatsApp por `wa.me`;
7. o usuário enviar a mensagem manualmente;
8. o usuário retornar ao sistema;
9. registrar manualmente a tentativa realizada;
10. acompanhar compras, tentativas, status e histórico.

O produto **não é multiempresa** e **não envia mensagens automaticamente**.

A abertura do WhatsApp nunca deve ser tratada como confirmação de envio.

---

## 1.2 Compra = ciclo de recompra

Cada compra representa um ciclo de recompra.

Esse conceito é central para o sistema: as informações, tentativas, status e próximas ações de contato são relacionadas ao ciclo daquela compra.

A criação de cliente/compra como ciclo utiliza a RPC:

```text
create_purchase_cycle
```

A interface não deve substituir esse fluxo por gravação direta equivalente.

---

## 1.3 Identificação do cliente

O **telefone é o principal identificador do cliente** para o fluxo de recompra.

Dados de cliente e histórico devem permanecer consistentes com esse princípio.

---

## 1.4 Regras de status de compra

A propriedade `purchases.status` não deve ser alterada diretamente pelo front-end.

Alterações manuais de status devem passar pela RPC:

```text
change_purchase_status
```

Mudanças de status devem manter os mecanismos de auditoria já estabelecidos.

### Regra específica

O status:

```text
repurchased
```

não pode ser aplicado manualmente pelo usuário.

Essa restrição deve permanecer tanto na lógica quanto na interface.

---

## 1.5 Auditoria de status

Alterações manuais de status devem preservar histórico e contexto da alteração.

A V2.0 introduziu o histórico de status por meio da migration:

```text
supabase/sql/06_purchase_status_history.sql
```

A alteração é feita pela RPC `change_purchase_status`, com motivo obrigatório no fluxo manual.

A auditoria deve preservar, conforme o modelo já existente:

- status anterior;
- novo status;
- data/hora;
- motivo;
- tratamento de tentativas quando aplicável;
- metadados associados quando existentes.

A UI não deve contornar o mecanismo de auditoria.

---

## 1.6 Tentativas de contato

Uma tentativa válida é definida como:

```text
status = 'sent'
AND
voided_at IS NULL
```

Tentativas anuladas não são apagadas.

Elas permanecem preservadas, inclusive os campos relacionados à anulação (`voided_*`).

O histórico deve continuar permitindo distinguir tentativa válida de tentativa anulada.

---

## 1.7 Fluxo operacional do WhatsApp

O fluxo aprovado é:

```text
Abrir WhatsApp
→ enviar mensagem manualmente
→ voltar ao sistema
→ Confirmar envio
```

### Regras obrigatórias

- `Abrir WhatsApp` não registra tentativa;
- `Abrir WhatsApp` não altera o status da compra;
- a confirmação não depende de o sistema detectar que o WhatsApp foi aberto;
- o sistema não deve exigir um clique anterior em `Abrir WhatsApp` para permitir `Confirmar envio`;
- o registro da tentativa só ocorre no fluxo explícito de confirmação;
- não existe envio automático.

---

## 1.8 Contatos de Hoje

Contatos de Hoje deve apresentar os ciclos elegíveis para contato segundo as regras existentes de recompra.

A página possui instrução operacional explícita:

> Abra a conversa no WhatsApp, envie a mensagem e depois volte ao sistema para registrar o envio.

### Ordem das ações do cartão

1. `Abrir WhatsApp`;
2. `Confirmar envio`;
3. `Registrar recompra` permanece visível como ação secundária;
4. `Pausar contato` fica dentro de `Mais ações`.

`Mais ações` é uma revelação simples e acessível; não é um dropdown genérico de infraestrutura.

A pausa utiliza o `Modal` compartilhado e não `window.confirm`.

---

## 1.9 Regras de opt-out

O opt-out é reversível.

### Cliente disponível para contato

Deve existir a ação:

```text
Marcar como não contatar
```

A confirmação deve ocorrer por modal e exigir motivo.

O modal deve comunicar que:

- o cliente será excluído de Contatos de Hoje;
- a abertura de WhatsApp pelo sistema ficará bloqueada;
- o histórico será preservado;
- a decisão pode ser revertida.

### Cliente com opt-out

A interface deve mostrar:

```text
Não contatar
```

como badge contextual e disponibilizar:

```text
Permitir contato novamente
```

A remoção do opt-out **não força contato imediato**.

A remoção do opt-out também não deve:

- alterar datas de recompra;
- alterar status das compras;
- criar tentativa;
- inserir artificialmente o cliente em Contatos de Hoje.

O cliente volta a ser elegível somente de acordo com as regras normais do sistema.

---

## 1.10 Exibição do opt-out por tela

Decisões já tomadas:

| Tela | Tratamento |
|---|---|
| Clientes | Badge discreto `Não contatar` |
| Histórico do cliente | Badge + ação contextual |
| Compras | Não repetir badge em cada compra |
| Contatos de Hoje | Cliente normalmente excluído; proteção defensiva caso apareça |

As tags futuras da V2.3 não devem ser confundidas visualmente com o badge de opt-out.

---

## 1.11 Classificação de clientes

Na V2.3 foram definidos os seguintes intervalos:

- **Ativo:** até 30 dias;
- **Em resfriamento:** até 90 dias;
- **Frio:** acima de 90 dias.

Quando o cliente estiver acima de 90 dias de inatividade:

- a classificação passa a ser **Frio**;
- o cliente deve ser pausado automaticamente;
- deve existir uma indicação visual dessa situação.

> O histórico disponível registra essa regra como decisão de produto para a V2.3. O detalhe técnico exato de qual evento/rotina executará a pausa automática deve seguir a especificação da V2.3 e o estado real da migration antes da implementação.

---

## 1.12 Perfil do cliente — V2.3

O perfil do cliente terá campos estruturados opcionais:

1. **Produto ou café preferido** — texto com sugestão;
2. **Moagem preferida** — seleção única;
3. **Método de preparo** — seleção múltipla;
4. **Frequência de consumo** — seleção única;
5. **Perfil sensorial** — seleção múltipla;
6. **Observações** — texto livre.

Esses campos fazem parte do perfil e não devem ser confundidos com histórico de compra ou tags de classificação.

---

## 1.13 Tags

A V2.3 trabalha com uma paleta limitada de seis cores:

- neutral;
- blue;
- green;
- yellow;
- orange;
- purple.

Não está decidido adicionar novas cores fora dessa paleta.

Não criar cores adicionais apenas por conveniência de UI.

---

## 1.14 Histórico do cliente — organização visual

A organização visual do histórico foi definida com regras específicas.

### Alterações de status

Inicialmente mostrar:

- os **3 registros mais recentes**;
- ordenados por `created_at`, mais recente primeiro.

Expansão mostra todo o histórico.

### Tentativas

Inicialmente mostrar:

- as **3 tentativas de maior `attempt_number`**;
- em ordem crescente de `attempt_number`.

Exemplo:

```text
1, 2, 3, 4, 5
```

vira, inicialmente:

```text
3, 4, 5
```

A expansão mostra todas as tentativas preservando o histórico completo.

Tentativas anuladas continuam presentes.

### Independência

A expansão deve ser independente:

- por compra;
- por seção;
- sem um único booleano global que abra tudo.

O recolhimento é **somente visual**.

Não é tratado como otimização de rede ou banco.

---

## 1.15 Preservação de dados históricos

O sistema deve preservar:

- histórico de compras;
- tentativas;
- tentativas anuladas;
- histórico de status;
- auditoria;
- snapshots existentes.

Informação antiga pode ser recolhida visualmente, mas não deve ser removida ou substituída por versões resumidas irreversíveis.

---

## 1.16 Responsividade aprovada

Breakpoint principal:

```text
820px
```

### Desktop

- sidebar lateral preservada;
- tabelas de Clientes e Compras preservadas;
- ações principais compactas;
- histórico organizado sem redesign amplo.

### Mobile

- navegação vertical recolhível;
- ações primárias em largura total quando apropriado;
- Clientes e Compras com cartões;
- Contatos de Hoje com ações empilhadas;
- Histórico com reorganização das métricas e seções recolhíveis;
- evitar rolagem horizontal inesperada.

---

## 1.17 Acessibilidade

Decisões recorrentes:

- usar HTML semântico sempre que possível;
- usar botões nativos;
- usar `type="button"` quando a ação não submete formulário;
- usar `aria-expanded` e `aria-controls` para regiões recolhíveis;
- garantir IDs únicos;
- manter foco visível;
- quando conteúdo estiver recolhido, ele não deve continuar focável ou duplicado na árvore de acessibilidade;
- evitar ARIA desnecessária quando HTML semântico for suficiente.

Para menus e seções recolhíveis, comportamento via teclado com `Enter` e `Espaço` deve continuar funcionando.

---

## 1.18 Decisões de arquitetura e tecnologia

Stack atual:

- React 19;
- Vite 6;
- TypeScript;
- React Router;
- Supabase Auth;
- Supabase PostgreSQL;
- `@supabase/supabase-js`;
- PapaParse;
- date-fns;
- lucide-react;
- clsx;
- CSS existente;
- npm + `package-lock.json`.

Não introduzir nesta linha de desenvolvimento:

- Tailwind;
- shadcn/ui;
- biblioteca visual externa;
- React Hook Form;
- Zod;
- Zustand;
- TanStack Query;
- troca de stack;
- automação de WhatsApp;
- refatoração geral sem necessidade funcional.

---

## 1.19 Princípio de simplicidade

A preferência do projeto é por pequenas alterações locais em vez de uma camada de abstração genérica antecipada.

Exemplos explicitamente evitados:

- `ResponsiveTable` genérico;
- dropdown genérico para `Mais ações`;
- accordion genérico;
- design system interno grande;
- estado global para pequenos fluxos locais.

Componentes/funções compartilhados só devem surgir quando houver ganho concreto e a API continuar simples.

---

## 1.20 CSS e identidade visual

A direção visual aprovada é:

> **padronização + reorganização de hierarquia**, sem redesign amplo.

A identidade existente deve ser preservada.

Tokens mínimos foram adicionados ao CSS para:

- página;
- superfície;
- texto;
- texto secundário;
- bordas;
- primária;
- hover;
- foco;
- sucesso;
- informação;
- aviso;
- perigo;
- raios;
- escala de espaçamento de 4 a 32 px.

A adoção é incremental, apenas nos trechos tocados.

---

## 1.21 Performance: decisões já tomadas

O projeto evita otimização prematura.

Para o histórico:

- não implementar paginação sem volume comprovado;
- não criar novos índices só para apoiar a reorganização visual;
- não criar carregamento sob demanda apenas porque o conteúdo foi recolhido visualmente;
- não usar o recolhimento como argumento de otimização de backend.

Caso medições futuras mostrem lentidão real no histórico, a primeira alternativa considerada é carregar detalhes por compra sob demanda.

Paginação fica para um cenário de volume maior comprovado.

---

# 2. Decisões Pendentes

Esta seção contém assuntos que ainda não possuem decisão definitiva registrada no material de continuidade disponível.

## 2.1 Detalhamento final da V2.3 de classificação e pausa automática

A regra de negócio foi decidida — `Frio` acima de 90 dias e pausa automática —, mas o material disponível não registra de forma completa o mecanismo técnico definitivo que executará essa pausa automática.

Precisa ser definido/confirmado na especificação e no estado real do banco:

- se a pausa ocorre durante leitura da lista;
- em mutation transacional;
- por rotina agendada;
- por trigger;
- por RPC dedicada;
- ou por outra estratégia já prevista na migration.

**Não implementar por inferência.**

---

## 2.2 Taxonomia completa de tags da V2.3

As cores estão decididas, mas não há no material atual a lista completa das **tags de negócio** que existirão.

Ainda precisa ser definido:

- quais tags virão inicialmente;
- quais são globais ou específicas do negócio;
- se podem ser criadas pelo usuário;
- se existe catálogo fixo;
- limites de quantidade por cliente;
- se haverá ordenação das tags;
- se alguma tag possui comportamento funcional ou é apenas classificatória.

A paleta de seis cores não resolve essas questões.

---

## 2.3 Governança de edição de tags

Ainda não está documentado de forma definitiva:

- quem pode criar/editar/remover tags;
- se tags são compartilhadas pelo sistema ou pertencem ao perfil;
- como impedir duplicação de tags semanticamente iguais;
- se exclusão de tag é física ou lógica;
- como tratar tags antigas se a definição mudar.

---

## 2.4 Comportamento detalhado dos campos de perfil

Os seis campos do perfil estão definidos, mas alguns detalhes ainda exigem decisão de produto/UX:

- valores oficiais de moagem;
- valores oficiais de frequência;
- valores oficiais de perfil sensorial;
- opções oficiais de método de preparo;
- origem das sugestões do campo de produto/café preferido;
- limite de caracteres das observações;
- limites de seleção múltipla;
- comportamento de valores antigos caso o catálogo seja alterado.

Esses detalhes devem ser buscados na especificação da V2.3 antes de codar valores finais.

---

## 2.5 Relação entre tags, classificação e perfil

Ainda é importante confirmar a separação conceitual final entre:

- **tags**;
- **classificação de relacionamento/recência** (`Ativo`, `Em resfriamento`, `Frio`);
- **perfil de consumo**;
- **opt-out**.

A orientação atual indica que são conceitos distintos, mas o modelo completo de apresentação e prioridade visual na V2.3 ainda deve ser confirmado.

---

## 2.6 Impacto da classificação `Frio` em fluxos futuros

A decisão atual diz que clientes `Frio` são pausados automaticamente.

Ainda pode existir necessidade de definir:

- como ocorre a retomada;
- qual ação manual pode reativar o cliente;
- se a reativação é por compra nova, contato, edição do perfil ou ação dedicada;
- se a pausa é do cliente ou de cada ciclo;
- como a classificação reage a uma nova compra;
- quando o status visual é recalculado.

A especificação da V2.3 deve ser a fonte de decisão antes da implementação dessas extensões.

---

## 2.7 Política futura de automação do WhatsApp

O estado atual é claramente manual e não há decisão para envio automático.

Qualquer futura automação exigiria uma decisão arquitetural e de produto nova sobre:

- provedor/API;
- consentimento;
- fila;
- reprocessamento;
- auditoria;
- falhas;
- idempotência;
- custo;
- segurança.

Nada disso deve ser antecipado no código atual.

---

## 2.8 Evolução de volume e performance

Ainda não há evidência registrada de volume suficientemente alto para exigir:

- paginação;
- virtualização;
- carregamento sob demanda do histórico;
- novos índices;
- cache dedicado.

A questão só deve ser reaberta com medição real.

---

## 2.9 Expansões futuras da arquitetura de UI

A fundação visual intentionally evitou abstrações gerais.

Ainda está em aberto se, após crescimento do sistema, será necessário extrair componentes para:

- cabeçalhos;
- listas responsivas;
- seções recolhíveis;
- padrões de confirmação.

A decisão atual é não criar essas abstrações preventivamente.

---

## 2.10 Política formal de testes automatizados

O projeto possui validações manuais e lint/build, mas não há uma suíte automatizada estabelecida como requisito geral.

Fica pendente uma decisão futura sobre:

- testes unitários;
- testes de integração;
- testes E2E;
- cobertura mínima;
- ferramentas específicas.

Não introduzir uma infraestrutura de testes nova sem decisão explícita.

---

## 2.11 Política de migrações e rollout da V2.3

Antes da implantação da V2.3 deve ser confirmado:

- ordem das migrations;
- compatibilidade com dados existentes;
- estratégia para dados nulos/vazios;
- rollout da UI em relação ao banco;
- validação de RLS;
- rollback, quando aplicável.

A migration conhecida da V2.3 é:

```text
supabase/sql/09_customer_tags_profiles.sql
```

Os testes conhecidos ficam em:

```text
supabase/tests/v2_3_a_customer_tags_profiles.sql
```

O estado atual dos scripts deve ser verificado diretamente no repositório antes da implementação.

---

## 2.12 Valores e comportamento de retomada após pausa

Além do caso de `Frio`, existe uma pergunta futura mais ampla:

- qual mecanismo de produto deve ser considerado a fonte oficial para “retomar” um ciclo pausado?

Não assumir que remover opt-out ou editar o cliente significa retomar um ciclo.

---

# 3. Detalhamento de Fases e Entregas Pendentes

## 3.1 Visão do roadmap

| Fase | Estado | Objetivo |
|---|---|---|
| V1 | Concluída | Base operacional de clientes, compras e recompra manual |
| V2.0 | Concluída | Edição segura, status via RPC e auditoria |
| V2.2 / Fundação visual | Concluída | Consolidação visual e responsiva incremental |
| V2.3 | **Próxima** | Tags, perfil básico e classificação de clientes |
| Fases posteriores | Planejamento | Evoluções de negócio dependentes das decisões da V2.3 |

---

# 3.2 V2 — o que ficou interrompido e o que não ficou

O ponto mais importante para evitar confusão no próximo ambiente é:

**A fundação visual da V2 não está interrompida. Ela foi concluída.**

Foram concluídas cinco entregas:

1. tokens e componentes básicos;
2. navegação móvel e cabeçalhos;
3. piloto de Contatos de Hoje;
4. cartões mobile de Clientes e Compras;
5. Histórico do cliente e opt-out visual.

Todas foram:

- implementadas;
- revisadas;
- validadas manualmente;
- integradas à `main`;
- publicadas;
- verificadas em produção.

A V2.0 também é tratada como concluída.

Portanto, **não existe uma tarefa visual pendente que deva ser retomada como se estivesse interrompida**.

A próxima frente é funcional: **V2.3**.

> O histórico anterior menciona que a V2.0-D chegou a ser iniciada durante o desenvolvimento intermediário, mas o handoff consolidado e o estado atual tratam a V2.0 como concluída. Assim, não deve ser reaberta como pendência sem evidência nova no Git.

---

# 3.3 V2.3 — Tags e Perfil Básico

## Objetivo

Introduzir estrutura de relacionamento e preferências do cliente sem alterar a lógica fundamental do ciclo de recompra.

## Base técnica já conhecida

Migration:

```text
supabase/sql/09_customer_tags_profiles.sql
```

Teste:

```text
supabase/tests/v2_3_a_customer_tags_profiles.sql
```

Os testes da migration já passaram após correções de setup relacionadas a UUIDs placeholder/contexto de role.

---

## Entrega V2.3-A — Banco e segurança

### Escopo esperado

Revisar e consolidar a migration já existente para:

- campos do perfil;
- tags;
- classificação necessária;
- relações e constraints;
- RLS;
- grants;
- compatibilidade com dados existentes.

### Antes de implementar

Confirmar no repositório:

- schema atual;
- políticas RLS;
- funções/RPCs existentes;
- nomenclatura das tabelas/colunas;
- se a migration já está aplicada na base relevante.

### Validação

Executar os testes existentes da V2.3 e criar testes adicionais apenas quando houver lacuna real.

---

# 3.4 V2.3-B — Perfil básico do cliente

## Campos

### Produto/café preferido

- texto;
- sugestões/autocomplete conforme definição da especificação;
- opcional.

### Moagem

- seleção única;
- valores finais devem vir da especificação aprovada.

### Método de preparo

- seleção múltipla;
- conjunto de opções precisa seguir o catálogo definido.

### Frequência de consumo

- seleção única.

### Perfil sensorial

- seleção múltipla.

### Observações

- texto livre;
- limite e validação devem seguir a definição final da V2.3.

## UX

A UI deve permitir:

- visualizar o perfil;
- editar o perfil;
- salvar sem afetar compras ou tentativas;
- manter mensagens de sucesso/erro consistentes;
- funcionar em desktop e mobile;
- seguir a fundação visual existente.

---

# 3.5 V2.3-C — Tags de cliente

## Escopo

Implementar visualização e edição das tags de cliente.

### Regras conhecidas

- paleta limitada a seis cores;
- tags são distintas de opt-out;
- tags não devem ser confundidas com status do ciclo;
- edição deve preservar integridade e RLS.

### Pendências para fechar antes da implementação

- catálogo inicial de tags;
- quem cria/edita tags;
- limite de tags por cliente;
- comportamento de exclusão;
- ordenação;
- possibilidade de tag customizada.

Por isso, esta entrega depende das decisões pendentes da seção 2.

---

# 3.6 V2.3-D — Classificação do cliente

## Regras

```text
<= 30 dias  → Ativo
<= 90 dias  → Em resfriamento
> 90 dias   → Frio
```

### `Frio`

Quando atingir mais de 90 dias:

- classificar como `Frio`;
- pausar automaticamente;
- mostrar indicação visual.

### Trabalho necessário

- definir/confirmar fonte de data usada no cálculo;
- implementar cálculo de forma consistente;
- garantir que a classificação não conflite com opt-out;
- determinar como a pausa automática ocorre tecnicamente;
- definir como uma nova compra altera a classificação;
- testar transições de fronteira (30 e 90 dias).

---

# 3.7 V2.3-E — Integração no perfil e telas

Após banco, perfil, tags e classificação estarem estáveis:

### Histórico do cliente

- apresentar perfil básico;
- apresentar tags;
- apresentar classificação;
- preservar badge de opt-out separado.

### Clientes

- permitir consultar informações relevantes do novo perfil;
- preservar cartões mobile já existentes;
- não repetir informações de maneira desnecessária.

### Contatos de Hoje

- respeitar opt-out e pausa;
- não transformar tags em regra automática de contato sem decisão específica.

### Compras

- não duplicar informações do perfil em cada compra.

---

# 3.8 V2.3-F — Regressão e publicação

Antes de considerar V2.3 concluída:

### Banco

- migrations validadas;
- RLS validado;
- grants validados;
- testes da V2.3 aprovados.

### Front-end

- lint aprovado;
- build aprovado;
- `git diff --check` aprovado;
- regressão manual de clientes/compras/histórico/Contatos de Hoje;
- desktop e mobile validados;
- teclado e foco validados onde aplicável.

### Publicação

Seguir o fluxo já consolidado:

1. branch da entrega;
2. escopo revisado;
3. lint/build/diff-check;
4. validação manual;
5. commit;
6. fast-forward para `main` quando possível;
7. nova validação na `main`;
8. revisão de `origin/main..main`;
9. push;
10. aguardar deploy;
11. smoke test em produção.

---

# 3.9 Fases posteriores — horizonte ainda não fechado

O histórico atual não fornece uma especificação completa para uma V2.4/V3 com o mesmo nível de detalhe da V2.3.

Portanto, não tratar como backlog decidido funcionalidades que ainda não foram formalizadas.

Áreas que podem vir a receber decisão futura, sem compromisso de roadmap ainda:

- evolução de automação de comunicação;
- análises/relatórios de comportamento;
- evolução de segmentação;
- refinamento de perfil;
- performance em volumes maiores;
- suíte de testes automatizados;
- abstrações adicionais de UI conforme crescimento real.

Esses itens são **áreas de discussão**, não entregas aprovadas.

---

# 3.10 Ordem recomendada para retomada do desenvolvimento

## Passo 1 — Diagnóstico

```powershell
git status --short
git branch --show-current
git branch -vv
git log -8 --oneline --decorate
git diff --name-only
git diff --cached --name-only
```

Confirmar que `main` está sincronizada antes de iniciar a V2.3.

## Passo 2 — Ler as regras do projeto

Antes de editar qualquer arquivo:

1. ler `AGENTS.md`;
2. ler a especificação aprovada da V2.3;
3. ler a migration `09_customer_tags_profiles.sql`;
4. ler os testes V2.3;
5. revisar migrations relacionadas anteriores;
6. verificar RLS/grants;
7. verificar estado real do Git.

## Passo 3 — Fechar lacunas da V2.3

Não codar valores ou comportamentos não definidos.

Fechar, em especial:

- catálogo de tags;
- valores dos campos de perfil;
- mecânica da pausa automática de `Frio`;
- mecanismo de retomada;
- regras de edição das tags.

## Passo 4 — Implementar por entregas pequenas

Ordem recomendada:

1. banco/segurança já definidos;
2. perfil básico;
3. tags;
4. classificação;
5. integração nas telas;
6. regressão;
7. publicação.

## Passo 5 — Não reabrir a fundação visual sem motivo

A fundação visual já foi encerrada e validada em produção.

Qualquer ajuste visual futuro deve ser tratado como parte do escopo da nova funcionalidade ou como bug/regressão específico.

---

# 4. Checklist de invariantes para qualquer nova fase

Antes de aprovar qualquer futura entrega, verificar:

### Negócio

- [ ] cada compra continua representando um ciclo;
- [ ] telefone continua sendo identificador principal;
- [ ] `create_purchase_cycle` continua sendo usado no fluxo previsto;
- [ ] `purchases.status` não é alterado diretamente pelo front-end;
- [ ] status manual continua passando por `change_purchase_status`;
- [ ] `repurchased` não é aplicado manualmente;
- [ ] tentativas válidas mantêm definição atual;
- [ ] tentativas anuladas continuam preservadas;
- [ ] abrir WhatsApp nunca registra tentativa;
- [ ] opt-out continua bloqueando contato;
- [ ] remover opt-out não força contato;
- [ ] histórico/auditoria continuam preservados.

### Técnica

- [ ] sem dependências desnecessárias;
- [ ] sem Tailwind/shadcn;
- [ ] sem troca de stack;
- [ ] sem refatoração ampla fora do escopo;
- [ ] sem alteração de Supabase sem requisito funcional;
- [ ] sem alteração de RPC/RLS fora da fase correspondente;
- [ ] Ponytail permanece em `lite`.

### UX

- [ ] breakpoint `820px` preservado;
- [ ] foco visível;
- [ ] controles recolhíveis acessíveis;
- [ ] conteúdo escondido não fica focável;
- [ ] identidade visual preservada;
- [ ] mobile e desktop validados.

### Git e produção

- [ ] branch específica;
- [ ] arquivos do commit conferidos;
- [ ] lint;
- [ ] build;
- [ ] `git diff --check`;
- [ ] validação manual;
- [ ] commit;
- [ ] fast-forward para `main` quando possível;
- [ ] revisão do diff contra `origin/main`;
- [ ] push;
- [ ] deploy confirmado;
- [ ] smoke test em produção.

---

# 5. Resumo executivo para o próximo agente

O projeto **não está parado no meio da fundação visual**. A V1 está em produção, a V2.0 está concluída e a fundação visual da V2 foi concluída em cinco entregas e publicada.

O próximo trabalho real é a **V2.3 — Tags e Perfil Básico**, apoiada pela migration `09_customer_tags_profiles.sql` e pelos testes da V2.3 já existentes.

As regras mais importantes para não quebrar são:

1. **WhatsApp é manual.** Abrir a conversa nunca registra tentativa.
2. **Status de compra é controlado por RPC/auditoria.** A UI não altera `purchases.status` diretamente.
3. **Tentativas são históricas e auditáveis.** Anulações são preservadas.
4. **Opt-out bloqueia contato e é reversível.** Remover opt-out não força contato imediato.
5. **`Frio` > 90 dias implica pausa automática**, mas o mecanismo técnico exato dessa pausa deve ser confirmado na especificação/migration antes da implementação.
6. **V2.3 possui perfil estruturado e tags**, mas alguns catálogos/regras de edição ainda precisam ser fechados.
7. **A fundação visual não deve ser refeita.** Novas alterações devem ser incrementais e guiadas pelo requisito funcional da nova fase.

