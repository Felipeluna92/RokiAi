# RokiAi — Prospecção, CRM e Faturamento (design)

Data: 2026-11-26

## 1. Intenção e o porquê

O dono do RokiAi está **começando agora** um negócio de venda de sites para comércios locais.
Ele cobra de duas formas: **valor único pela criação do site** (implantação) e **mensalidade**
(hospedagem/manutenção). Precisa de uma ferramenta interna, só dele, para:

1. **Achar clientes**: buscar comércios de uma cidade no Google Maps que **não têm site** e
   ordenar pelos de maior potencial.
2. **Abordar e acompanhar**: contato via **WhatsApp**, funil de vendas até o fechamento.
3. **Controlar o dinheiro**: clientes ativos, receita recorrente (MRR), implantações,
   cobranças a vencer e em atraso.

Pagamentos chegam por **Pix direto na conta dele**; a baixa é **manual** no sistema.

Sucesso = ele abre o sistema no celular, busca "barbearia em <cidade>", vê uma lista
priorizada de quem não tem site, chama no WhatsApp com um clique, acompanha a negociação
e, depois de fechar, sabe exatamente quanto recebe por mês e quem está devendo.

## 2. Objetivos, não-objetivos, anti-objetivos

**Objetivos**
- Busca por cidade + categoria via Google Places API, com filtro "sem site" e nota de potencial.
- Funil de leads com anotações, próximo contato e botão de WhatsApp com mensagem modelo.
- Cadastro de clientes (vindos de leads ou manuais) com implantação + mensalidade.
- Geração automática das cobranças mensais e baixa manual ("marcar como pago").
- Dashboard de faturamento.
- Funcionar bem no celular. Interface em pt-BR, valores em R$, fuso America/Sao_Paulo.

**Não-objetivos (fora desta versão)**
- Integração com gateway de pagamento (Asaas, Mercado Pago, Stripe), boletos, NF-e.
- Envio automático/em massa de WhatsApp (API oficial ou não-oficial). O sistema só abre o
  `wa.me` com o texto pronto; quem envia é ele.
- Multiusuário/equipe, permissões.
- Criar os sites dos clientes.
- Contratos e propostas em PDF.

**Anti-objetivos (seria fracasso mesmo funcionando)**
- Expor a chave do Google no navegador.
- Qualquer automação que arrisque banimento do WhatsApp dele (disparo em massa).
- Abordar a mesma empresa duas vezes por não lembrar que já foi contatada.
- Gastar dinheiro com a API do Google sem ele perceber (buscas repetidas sem necessidade).
- Perder dados de clientes/cobranças.

## 3. Restrições

- Usuário único (o dono). Sem cadastro público.
- Ele já tem uma **chave da Google Places API** com faturamento ativo.
- Vercel e Supabase já estão conectados na sessão de desenvolvimento; planos gratuitos
  devem bastar.
- Repositório `RokiAi` está vazio — projeto do zero.

## 4. Abordagens consideradas

| Abordagem | Prós | Contras |
|---|---|---|
| **Next.js + Supabase + Vercel** (escolhida) | Site real, login, acessível do celular, chave escondida no servidor, Postgres com dados seguros, deploy direto pelas conexões já existentes, custo zero | Mais trabalho que uma planilha |
| Planilha Google + Apps Script | Rápido de começar | Funil, dashboard e busca ficam improvisados; escala mal |
| App local no computador | Sem hospedagem | Sem acesso pelo celular, ruim para quem prospecta pelo WhatsApp |

Escolhida a primeira (decisão do Claude, o dono delegou o "como" e não se opôs).

## 5. Stack (decisões do Claude)

- **Next.js (App Router) + TypeScript**, Tailwind CSS, componentes shadcn/ui, gráficos com Recharts.
- **Supabase**: Postgres + Auth (e-mail e senha). Cadastro público desativado; um único
  usuário criado na implantação. RLS ativada em todas as tabelas: só o usuário autenticado
  dono (`owner_id = auth.uid()`) lê/escreve.
- **Google Places API (New)** chamada **somente no servidor** (Route Handler / Server Action)
  com a chave em variável de ambiente `GOOGLE_PLACES_API_KEY`.
- **Vercel** para hospedagem; variáveis de ambiente configuradas no projeto.

## 6. Módulos

### 6.1 Login
- Tela de login (e-mail/senha). Todas as outras rotas exigem sessão.

### 6.2 Prospecção (busca)

**Entrada:** cidade (texto livre, ex. "Campinas, SP") + categoria (lista sugerida —
restaurante, barbearia, salão de beleza, oficina mecânica, clínica odontológica, pet shop,
academia, padaria, loja de roupas, etc. — ou texto livre).

**Chamada:** Places API (New) *Text Search* com consulta "`<categoria> em <cidade>`",
`languageCode=pt-BR`, `regionCode=BR`, field mask mínimo necessário:
`id, displayName, formattedAddress, location, nationalPhoneNumber, internationalPhoneNumber,
websiteUri, rating, userRatingCount, businessStatus, googleMapsUri, primaryType`.
Paginação via `nextPageToken` (até 60 resultados; botão "carregar mais", não automático,
para controlar custo).

**Classificação de site** a partir de `websiteUri`:
- vazio → **Sem site**
- domínio de rede social/agregador (instagram.com, facebook.com, fb.com, linktr.ee,
  wa.me, api.whatsapp.com, linkedin.com, tiktok.com, ifood.com.br, goo.gl/maps,
  sites.google.com, business.site) → **Só rede social** (conta como sem site, alvo bom)
- qualquer outro → **Tem site**

Filtro padrão mostra *Sem site* + *Só rede social*; um toggle mostra todos.

**Nota de potencial (0–100)** — proposta inicial, ajustável no código:
- Avaliações (`userRatingCount`): até 40 pts, escala logarítmica (≈ 0 para 0, 40 para ≥ 300).
- Nota média (`rating`): até 25 pts (≥ 4.5 = 25; 4.0 = 15; < 3.5 = 0; sem nota = 5).
- Tem telefone celular (válido para WhatsApp): 25 pts; só fixo: 10 pts; sem telefone: 0.
- Só rede social (já investe em presença online): +10 pts.
- `businessStatus` diferente de `OPERATIONAL` → excluído da lista.

Faixas: **Alto** ≥ 65, **Médio** 40–64, **Baixo** < 40. Ordenação padrão por nota.

**Cache e deduplicação:** todo lugar retornado é gravado/atualizado na tabela `places`
(chave `google_place_id`). Na lista, cada resultado mostra selo se já é **Lead** (com o
estágio), **Cliente** ou **Ignorado**. Buscas iguais (mesma cidade + categoria) feitas nas
últimas 24 h mostram o resultado salvo com aviso "resultado de <hora> — buscar de novo?",
para não pagar a API à toa.

**Ações por resultado:** "Salvar como lead", "Ignorar" (some das próximas buscas),
abrir no Google Maps. Seleção múltipla para salvar vários de uma vez.

### 6.3 Leads (funil)

Estágios: **Novo → Contatado → Proposta enviada → Fechado | Perdido**.

- Visualização em lista (padrão no celular) e em colunas tipo kanban (desktop), com
  filtro por estágio, cidade, categoria e busca por nome.
- Detalhe do lead: dados do Google, telefone, endereço, link do Maps, **anotações**
  (histórico com data), **próximo contato** (data), motivo de perda (quando Perdido).
- **Botão WhatsApp**: abre `https://wa.me/55<DDD><número>?text=<mensagem>` com o modelo
  escolhido preenchido. Ao clicar estando em *Novo*, passa para *Contatado* e registra a
  data na linha do tempo. Se o número for fixo, mostra aviso ("pode não ter WhatsApp")
  mas permite.
- Lista "**Para hoje**": leads com próximo contato ≤ hoje.
- Lead pode ser criado manualmente (indicação, sem Google).
- Ao mover para **Fechado**, abre o formulário de conversão em cliente (6.4).

**Modelos de mensagem** (tela de configurações): texto com variáveis
`{nome_empresa}`, `{cidade}`, `{nota}`, `{avaliacoes}`, `{categoria}`, `{valor}`,
`{vencimento}`, `{chave_pix}`. Tipos: abordagem, follow-up, cobrança. Vêm 3 modelos
iniciais editáveis.

### 6.4 Clientes

Campos: empresa, responsável, WhatsApp, e-mail (opcional), cidade, endereço do site
entregue (opcional), lead de origem, observações, e o **plano**:
- **Implantação**: valor total, número de parcelas (1 = à vista), data da 1ª parcela.
- **Mensalidade**: valor, dia de vencimento (1–28), data de início.
- Status: **Ativo**, **Cancelado** (com data de cancelamento). "Inadimplente" não é campo
  salvo: é calculado (tem cobrança vencida e não paga).

Mudança de valor da mensalidade vale das próximas cobranças em diante (cobranças já
geradas não mudam).

*Decisões do Claude (revisão do builder):*
- 1ª mensalidade: primeiro dia de vencimento **≥ data de início** (início 20/03 com
  vencimento dia 10 → 1ª cobrança em 10/04). Sem proporcional (pro rata).
- Data de início no passado: gera as mensalidades desde o início (ele está começando,
  então isso só acontece se ele quiser lançar histórico real); ao salvar, o formulário avisa
  quantas cobranças passadas serão criadas.
- Parcelas da implantação: mensais a partir da data da 1ª parcela, mesmo dia do mês
  (ajustado para o último dia quando o mês for mais curto).

### 6.5 Cobranças

Tabela `charges`: cliente, tipo (`setup` | `monthly`), competência (mês de referência,
para mensalidade), descrição (ex. "Implantação 2/3"), valor, vencimento, pago em, forma
(padrão Pix), observação.

- Parcelas de implantação são criadas todas de uma vez ao cadastrar o cliente.
- **Mensalidades**: função idempotente garante que existe a cobrança do mês corrente e do
  próximo para cada cliente ativo (unique em `client_id + type + competência`). Roda ao
  abrir o dashboard/cobranças e também por um **Vercel Cron diário**. Não gera para meses
  após o cancelamento.
- Status calculado: **Paga**, **A vencer**, **Vence hoje**, **Atrasada** (vencimento < hoje,
  não paga).
- Ações: **Marcar como paga** (data padrão hoje, editável), desfazer, editar valor/vencimento,
  excluir (com confirmação), **Cobrar no WhatsApp** (modelo de cobrança com a chave Pix).

### 6.6 Dashboard de faturamento

Cartões:
- **MRR**: soma das mensalidades de clientes ativos.
- **Recebido no mês**: soma das cobranças pagas no mês corrente (implantação + mensalidade).
- **A receber no mês**: cobranças com vencimento no mês, não pagas.
- **Em atraso**: valor total e quantidade.
- **Clientes ativos** (e novos no mês).

Gráficos/listas:
- Receita recebida por mês, últimos 12 meses, barras empilhadas implantação × mensalidade.
- Evolução do MRR (12 meses), **calculada a partir das cobranças de mensalidade por
  competência** (soma do valor das mensalidades geradas para cada mês, pagas ou não). Sem
  tabela extra de histórico (decisão do Claude).
- Funil: quantidade de leads por estágio e taxa de conversão (Fechado / leads contatados).
- Lista: próximos vencimentos (7 dias) e cobranças atrasadas, com ação rápida de pagar/cobrar.

### 6.7 Configurações
- Nome do negócio, sua chave Pix, modelos de mensagem, preços padrão (implantação e
  mensalidade sugeridos no formulário de conversão).
- **Uso da API do Google**: contador de requisições ao Google no mês e custo estimado
  (preço por requisição configurável), com aviso visual ao passar de um limite que ele
  define (padrão: a cota gratuita do SKU usado). Sem bloqueio rígido. O README orienta a
  criar também um alerta de orçamento e uma cota diária no Google Cloud (decisão do Claude).
- **Exportar dados**: botão que baixa um JSON/CSV com leads, clientes e cobranças
  (backup manual), já que o plano gratuito do Supabase não tem backups restauráveis.
  O cron diário também toca o banco, o que evita a pausa por inatividade do plano
  gratuito (decisão do Claude).

## 7. Modelo de dados (resumo)

- `settings` (1 linha por dono): business_name, pix_key, default_setup_price,
  default_monthly_price.
- `searches`: city, category, query, results_count, created_at.
- `places`: google_place_id (unique), name, address, city, category, phone,
  phone_is_mobile, website_uri, site_status (`none|social|has_site`), rating,
  ratings_count, business_status, maps_url, lat, lng, potential_score, ignored, raw (jsonb),
  first_seen_at, updated_at.
- `search_results`: search_id, place_id, position.
- `leads`: place_id (nullable, unique quando presente), name, phone, city, category, stage,
  next_contact_at, lost_reason, contacted_at, created_at, updated_at.
- `lead_events`: lead_id, type (`note|stage_change|whatsapp`), body, created_at.
- `message_templates`: kind (`approach|followup|charge`), name, body.
- `clients`: lead_id (nullable), company, contact_name, phone, email, city, site_url,
  setup_total, setup_installments, monthly_fee, due_day, start_date, status, canceled_at,
  notes.
- `charges`: client_id, type, competence (date, 1º dia do mês, nullable para setup),
  description, amount, due_date, paid_at, method, notes. Unique (client_id, type, competence)
  para mensalidades.

Valores monetários em `numeric(12,2)`. Todas as tabelas com `owner_id` + RLS.

## 8. Telas / navegação

Menu: **Dashboard · Prospectar · Leads · Clientes · Cobranças · Configurações**.
No celular, barra inferior com os 4 primeiros + menu.

## 9. Entrega

- Código no repositório `RokiAi`, branch de desenvolvimento.
- Migrações SQL versionadas (pasta `supabase/migrations`).
- Projeto Supabase e projeto Vercel criados pelas conexões; variáveis de ambiente
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  se necessário, `GOOGLE_PLACES_API_KEY`, `CRON_SECRET`) configuradas.
- O dono insere a chave do Google ele mesmo no painel da Vercel (ou fornece por meio seguro);
  ela nunca vai para o repositório.
- README em pt-BR: como rodar local, como trocar a chave, como criar o usuário.
- Testes: unitários para regras de negócio (classificação de site, nota de potencial,
  normalização de telefone/celular, geração de cobranças, status de cobrança, cálculos do
  dashboard). Teste ponta a ponta leve do fluxo principal.

## 10. Deixado para quem constrói

- Layout visual, cores e componentes exatos (sóbrio, legível, mobile-first).
- Escolha entre Server Actions e Route Handlers.
- Detalhe da escala logarítmica e pesos finos da nota de potencial (dentro do proposto).
- Lista exata de categorias sugeridas e textos dos 3 modelos iniciais de mensagem.
- Se o Supabase usa projeto novo ou existente (verificar limite do plano gratuito).
