Seguindo o plano:

Este documento descreve o que o back-end precisa entregar e como o banco fica.
As decisoes de **como organizar** ficam com voces (ver a secao "Decisoes que
ficam com voces"). Aqui esta o "o que" e o "porque"; o "como" e de voces.

---

## 1. O que o back-end precisa entregar

- Multi-empresa de verdade: cada empresa so acessa os proprios dados. Isso e
  garantido no banco, nao so na tela.
- Camada de plataforma (a gente): criar empresas, definir planos, liberar e
  bloquear modulos por empresa.
- Acesso de suporte temporario: a gente entra numa empresa por tempo limitado,
  com codigo de autenticador, e tudo o que faz fica registrado.
- Usuarios, cargos e permissoes: cada cargo tem um conjunto de permissoes; a
  empresa pode ajustar as permissoes do cargo dela.
- Cadastro de produtos e fornecedores.
- Estoque por lote (FIFO): cada entrada vira um lote com seu custo; cada saida
  consome do lote mais antigo primeiro e calcula o lucro exato.
- Movimentacoes: entrada, saida, ajuste de saldo e perda.
- Historico do preco de venda de cada produto.
- Fila de solicitacao de cadastro: quando alguem sem permissao tenta cadastrar
  um produto novo pela camera, vira um pedido para outra pessoa aprovar.
- Auditoria: registrar quem fez o que, com o antes e o depois.
- Continuar usando os servicos de enriquecimento (CNPJ, CEP, codigo de barras).

---

## 2. Decisoes que ficam com voces (back leads)

Observacao: o que ja existe e seguro hoje vale manter. O banco usa regras de
seguranca por linha (cada consulta so devolve as linhas da empresa do usuario),
e essa e a camada que manda. A tela nunca decide sozinha o que aparece.

---

## 3. Banco de dados por tabelas

As tabelas estao agrupadas por area. Marcado como (novo) o que nao existe hoje,
(muda) o que muda, e (sai) o que deve ser removido.

### 3.1 Plataforma (a gente controla)

**modules** - catalogo de modulos do sistema.
- code (texto, chave): codigo do modulo, ex: "estoque".
- name (texto): nome para mostrar.
- description (texto): explicacao curta.

**plans** (novo) - os planos que a gente vende.
- code (texto, chave): ex: "basico".
- name (texto): nome do plano.

**plan_modules** (novo) - quais modulos cada plano libera.
- plan_code (liga a plans.code).
- module_code (liga a modules.code).

**companies** - as empresas clientes.
- id (uuid, chave).
- name (texto): nome da empresa.
- slug (texto): apelido unico para a url.
- document (texto): CNPJ.
- plan_code (muda; liga a plans.code): plano atual da empresa.
- is_active (sim/nao): se a empresa esta ativa.
- created_by, created_at, updated_at.

**company_modules** - os modulos liberados para cada empresa.
- company_id (liga a companies.id).
- module_code (liga a modules.code).
- enabled_at (data), enabled_by (quem liberou).

**platform_admins** - as pessoas da plataforma (a gente).
- user_id (liga ao usuario).
- (define quem tem poder de plataforma).

**support_access_grants** (novo) - cada acesso temporario de suporte.
- id (uuid).
- company_id (em qual empresa o suporte entrou).
- support_user_id (quem do suporte entrou).
- granted_by (quem da lideranca liberou).
- started_at (quando comecou).
- expires_at (quando expira, 15 minutos depois).
- reason (texto curto: motivo do acesso).
- Tudo o que o suporte faz nesse periodo cai na auditoria.

### 3.2 Empresa e acesso

**profiles** - dados do usuario (o login e a senha ficam no Supabase Auth).
- id (uuid, e o mesmo id do usuario do Auth).
- full_name (texto): nome completo.
- avatar_url (texto): foto, opcional.

**memberships** - o vinculo de um usuario com uma empresa.
- id (uuid).
- user_id (liga ao usuario).
- company_id (liga a companies.id).
- status (convidado, ativo, suspenso).
- invited_by, invited_at, joined_at.
- Um usuario pode ter vinculo com mais de uma empresa, e so ve as empresas a
  que esta vinculado.

**membership_roles** - quais cargos esse vinculo tem.
- membership_id (liga a memberships.id).
- role_id (liga a roles.id).

**role_templates** - os modelos de cargo, globais (a gente define).
- code (texto, chave): ex: "admin", "operador".
- name (texto).

**template_permissions** - quais permissoes cada modelo traz de fabrica.
- template_code (liga a role_templates.code).
- permission_code (liga a permissions.code).

**roles** - os cargos de cada empresa (muda: vira lista plana).
- id (uuid).
- company_id (de qual empresa e o cargo).
- code, name, description.
- template_code (de qual modelo ele nasceu).
- template_synced_at (quando foi sincronizado pela ultima vez).
- is_system (se e um cargo de sistema que nao se apaga).
- (sai) hierarchy_level e parent_role_id: nao tem mais hierarquia entre cargos.

**permissions** - catalogo de permissoes, por modulo.
- code (texto, chave): ex: "produtos.criar", "mov.entrada".
- module_code (de qual modulo e a permissao).
- description (texto).

**role_permissions** - quais permissoes cada cargo da empresa tem.
- role_id (liga a roles.id).
- permission_code (liga a permissions.code).
- is_active (sim/nao): a empresa pode ligar e desligar.

**company_invitations** - convites para novos usuarios.
- id, company_id, email, role_ids (lista de cargos), short_code, token_hash,
  status, expires_at, invited_by.

Sobre senha: o reset e automatico (link por email, pelo proprio Supabase). Nao
existe mais a tabela de pedidos de reset com aprovacao.

### 3.3 Produtos e fornecedores

**product_classifications** - a classificacao do produto, em arvore de 3 niveis.
- id, company_id, name (MAIUSCULAS, max 60).
- level: o nivel do no - 'department', 'category' ou 'brand'.
- parent_id (opcional): aponta para o no pai dentro da propria tabela.
- sort_order (numero): a ordem de exibicao entre os irmaos.
- Regras: department tem parent nulo; category tem como pai um department;
  brand tem como pai uma category. (validado por gatilho/check na migration.)

**products** - o produto (muda bastante).
- id (uuid).
- company_id (de qual empresa).
- name, description, sku, barcode, ncm, unit.
- min_stock (numero): estoque minimo, usado para avisar falta.
- classification_id (opcional): aponta para o nivel mais especifico escolhido
  na arvore de classificacao (departamento, categoria ou marca).
- sale_price (numero): o preco de venda, fica aqui no produto.
- location (texto): onde fica guardado, ex "prateleira A3".
- stock (numero): saldo atual em cache, somado dos lotes; mantido por gatilho.
- is_active, created_by, created_at, updated_at.
- (sai) supplier_id: o fornecedor nao fica mais no produto, vai para o lote.
- (sai) cost_price: o custo nao fica mais no produto, vai para o lote.
- (sai) warehouse_id: estoque e unico por empresa, sem multiplos depositos.

**suppliers** - os fornecedores (fica como esta, ja e por empresa).
- id, company_id.
- name, document (CNPJ), email, phone.
- cep, city, state, country.
- is_active, created_by, created_at, updated_at.

### 3.4 Estoque e movimentacoes

**stock_layers** (novo) - os lotes. Cada entrada cria um.
- id (uuid).
- company_id, product_id.
- supplier_id (opcional): de qual fornecedor veio esse lote.
- unit_cost (numero): o custo de cada unidade nesse lote.
- quantity_remaining (numero): quanto ainda resta desse lote.
- entry_date (data): quando entrou.
- (campo de validade fica para o futuro, nao na v1).

**stock_movements** - o livro de entradas e saidas.
- id (uuid).
- company_id, product_id.
- movement_type (muda): entrada, saida, ajuste, perda. (Hoje sao so entrada,
  saida e ajuste; entra o tipo perda.)
- quantity (numero): a quantidade movimentada.
- unit_cost (numero, opcional): usado na entrada e no ajuste para cima.
- reason (texto, opcional): motivo, usado principalmente na perda.
- performed_by (quem fez), created_at.

**movement_layer_consumption** (novo) - de qual lote cada saida tirou.
- movement_id (liga a stock_movements.id).
- layer_id (liga a stock_layers.id).
- quantity (quanto saiu desse lote).
- unit_cost (a que custo saiu).
- Serve para calcular o lucro exato de cada saida.

**sale_price_history** (novo) - o historico do preco de venda.
- id, product_id.
- price (numero): o preco que passou a valer.
- valid_from (data): desde quando.
- changed_by (quem mudou).

**stock_change_requests** (novo) - a fila de solicitacao de cadastro.
- id, company_id.
- ean (texto): o codigo de barras lido.
- enrichment_data (json): os dados que vieram do enriquecimento.
- requested_by (quem pediu).
- status (pendente, confirmada, recusada).
- created_at, resolved_by, resolved_at.

### 3.5 Auditoria

**audit_logs** - registro de tudo que acontece (fica como esta).
- id.
- action (texto): o que foi feito.
- actor_user_id, actor_email (quem fez).
- company_id (em qual empresa).
- resource_type, resource_id (em qual coisa: produto, movimentacao, etc).
- permission (qual permissao foi usada).
- status (deu certo ou nao).
- metadata (json): aqui guarda o antes e o depois.
- ip, user_agent, created_at.

### 3.6 Tabelas que devem sair

Estas apoiavam recursos que a gente cortou:
- field_catalog e role_field_rules (mascara de campo por cargo).
- scope_dimensions e role_scopes (escopo por deposito).
- warehouses (multiplos depositos).
- password_reset_requests (reset agora e automatico).

---

## 4. Relacionamentos (como as tabelas se ligam)

- Uma empresa (companies) tem um plano (plans). O plano libera modulos
  (plan_modules) e a empresa tem os modulos efetivos em company_modules.
- Um usuario (profiles) se liga a uma empresa por um vinculo (memberships).
  O vinculo recebe cargos (membership_roles -> roles).
- Um cargo (roles) pertence a uma empresa e nasce de um modelo (role_templates).
  O cargo tem permissoes (role_permissions -> permissions).
- Um produto (products) pertence a uma empresa e pode ter uma classificacao
  (product_classifications), uma arvore de 3 niveis: departamento -> categoria
  -> marca. O produto aponta para o no mais especifico escolhido.
- Cada entrada de um produto cria um lote (stock_layers), que pode apontar para
  um fornecedor (suppliers).
- Cada movimentacao (stock_movements) e de um produto. Quando e saida ou perda,
  ela consome de um ou mais lotes (movement_layer_consumption -> stock_layers).
- Cada produto tem um historico de preco de venda (sale_price_history).
- Um acesso de suporte (support_access_grants) aponta para a empresa visitada.
- A auditoria (audit_logs) aponta para a empresa e para a coisa mexida.

---

## 5. Servicos de enriquecimento (ja existem, manter)

Hoje ja existe um servico separado chamado enrichment-services. Ele e uma
pequena API que recebe um documento (CNPJ), um CEP, um codigo NCM ou um codigo
de barras (EAN) e devolve os dados ja organizados, puxados de fontes externas.

Pontos importantes para manter:

- Ele e um servico a parte do sistema principal. O sistema chama ele quando
  precisa preencher um formulario.
- A autenticacao entre o sistema e esse servico e por chave publica e privada
  (padrao JWKS com ES256), nao por uma senha simples compartilhada. Isso ja deu
  trabalho para acertar uma vez, entao vale manter como esta.
- A chamada e nao bloqueante: se o enriquecimento falhar, o formulario nao trava;
  o usuario preenche na mao. O sistema tambem ignora respostas que chegam fora de
  hora (protege contra dado velho aparecendo na tela).
- Tem um endereco de saude publico que e chamado de tempos em tempos para o
  servico nao "dormir" no plano gratis.
- Na v1 o enriquecimento e gratis para todas as empresas. Nao e um modulo pago.

Como entra no fluxo do estoque:

- No cadastro de fornecedor: digita o CNPJ, o sistema busca nome, endereco e
  contato e ja preenche.
- No cadastro de produto: le o codigo de barras, o sistema tenta achar os dados
  do produto pelo EAN e ja preenche.
- No recebimento pela camera: se o codigo lido nao existe no cadastro, o sistema
  usa o EAN para sugerir um produto novo ja preenchido.

---

## 6. Regras de negocio que vivem no back

- Saldo por gatilho: ao registrar uma movimentacao, um gatilho no banco atualiza
  o saldo do produto e impede saldo negativo. Nunca mexer no saldo na mao.
- FIFO: a saida consome do lote mais antigo primeiro; se precisar, atravessa
  mais de um lote. Cada pedaco consumido fica registrado com o custo do lote.
- Ajuste para cima: cria um lote novo, e o custo desse lote e digitado pelo
  operador.
- Perda: e uma saida que nao e venda; consome de um lote, mas com motivo, e fica
  separada das vendas para nao baguncar as analises.
- Isolamento: toda consulta so devolve dados da empresa do usuario; isso e regra
  do banco, nao da tela.
- Suporte: o acesso vale 15 minutos e expira sozinho; tudo que o suporte faz vai
  para a auditoria.
- Auditoria: gravar quem fez, o que fez, e o antes e o depois (no campo json).

---

## 7. Historias de exemplo (lado tecnico)

Historia 1 - Entrada cria lote.
O Joao registra a entrada de 100 unidades de um produto a R$ 2,00 cada. O back
cria um lote (stock_layers) com quantidade 100 e custo 2,00, cria a movimentacao
(stock_movements tipo entrada) e o gatilho soma 100 ao saldo do produto.

Historia 2 - Saida usa FIFO e calcula lucro.
Existem dois lotes: um antigo de 30 unidades a R$ 2,00 e um novo de 100 a R$ 2,50.
Uma venda de 40 unidades sai. O back tira 30 do lote antigo e 10 do novo, grava
isso em movement_layer_consumption, e calcula o lucro: preco de venda menos o
custo de cada parte. O saldo cai 40.

Historia 3 - Cadastro virou pendencia.
O estagiario le um codigo que nao existe. Ele nao tem a permissao de criar
produto. O back nao cria o produto; cria um pedido em stock_change_requests com
o codigo e os dados do enriquecimento. Depois a gerente, que tem permissao, abre
a fila, confere e confirma. So entao o produto e criado.

Historia 4 - Suporte entra e sai.
A Maria pediu ajuda. A lideranca libera o acesso de suporte com o codigo do
autenticador. O back cria um support_access_grant que expira em 15 minutos.
Durante esse tempo, cada acao do suporte e gravada na auditoria. Passados os 15
minutos, o acesso para de valer.
