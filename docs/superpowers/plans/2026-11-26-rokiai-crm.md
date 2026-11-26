# RokiAi CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ferramenta interna (usuário único) para prospectar comércios sem site via Google Places, acompanhar leads com WhatsApp e controlar clientes, cobranças e faturamento.

**Architecture:** App Next.js (App Router, TypeScript) na raiz do repo. Regras de negócio são funções puras em `src/lib/**` cobertas por Vitest; páginas usam Server Components + Server Actions que leem/escrevem no Supabase (Postgres + Auth, RLS por `owner_id`). Google Places é chamado só no servidor. Deploy na Vercel com Cron diário.

**Tech Stack:** Next.js 16, React, TypeScript, Tailwind CSS 4, shadcn/ui, Recharts, @supabase/ssr + @supabase/supabase-js, Vitest, Playwright (pré-instalado no ambiente).

**Spec:** `docs/superpowers/specs/2026-11-26-rokiai-crm-design.md`

## Global Constraints

- Interface toda em pt-BR; moeda `R$` via `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
- Fuso `America/Sao_Paulo` para "hoje"; datas de negócio trafegam como string `YYYY-MM-DD`.
- Valores monetários `numeric(12,2)` no banco; no código, números em reais com 2 casas.
- `GOOGLE_PLACES_API_KEY` nunca no cliente nem no repositório; módulos que a usam importam `server-only`.
- Só o `place_id` dos resultados do Google é persistido (exceto nome+telefone ao salvar lead) — opção B do spec.
- Todas as tabelas com `owner_id uuid not null default auth.uid()` e RLS `owner_id = auth.uid()`.
- Mobile-first: todas as telas usáveis a 375 px de largura.
- Sem envio automático de WhatsApp: só links `https://wa.me/<digits>?text=<encoded>`.

## Review Focus

1. **Meses curtos:** parcela de implantação iniciada dia 31 → vence no último dia de fev/abr, nunca pula mês nem estoura data. (Teste em Task 3.)
2. **Telefones brasileiros variados:** `+55 19 99999-9999`, `(19) 3232-1234`, `19 9999-9999` (celular antigo sem 9), `0800 123 4567`, vazio → normalização e flag de celular corretas. (Teste em Task 2.)
3. **"Hoje" perto da meia-noite:** às 22h em São Paulo (01h UTC do dia seguinte) uma cobrança que vence hoje aparece como "Vence hoje", não "Atrasada". (Teste em Task 1/3.)
4. **Geração de cobranças concorrente/repetida:** cron + abertura de página no mesmo instante, ou rodar duas vezes, não duplica mensalidades. (Teste em Task 3 para a função pura; unique + `on conflict do nothing` em Task 8.)
5. **Falha da API do Google** (chave inválida, cota estourada, zero resultados): mensagem clara na tela, nada quebra. (Teste em Task 6.)

---

## File Structure

```
src/
  lib/
    format.ts                 # moeda, datas, todayInSaoPaulo
    prospect/site-status.ts   # classifySite
    prospect/phone.ts         # normalizePhone
    prospect/score.ts         # potentialScore
    prospect/places.ts        # searchPlaces (server-only, fetch Google)
    billing/dates.ts          # addMonthsClamped, firstMonthlyDue
    billing/charges.ts        # buildSetupCharges, monthlyChargesToEnsure
    billing/status.ts         # chargeStatus
    billing/metrics.ts        # métricas do dashboard
    messages.ts               # renderTemplate, whatsappUrl
    supabase/server.ts, client.ts, middleware.ts
    types.ts                  # tipos de linha do banco
  app/
    login/page.tsx
    (app)/layout.tsx          # nav lateral (desktop) + barra inferior (mobile)
    (app)/page.tsx            # dashboard
    (app)/prospectar/…        # busca
    (app)/leads/…, leads/[id]/…
    (app)/clientes/…, clientes/novo, clientes/[id]/…
    (app)/cobrancas/…
    (app)/configuracoes/…
    api/cron/charges/route.ts
    api/export/route.ts
  middleware.ts
supabase/migrations/0001_init.sql
tests/ (unit: *.test.ts ao lado dos módulos em src/lib; e2e: tests/e2e/*.spec.ts)
```

---

### Task 1: Scaffold + utilitários de formato

**Files:**
- Create: projeto Next.js na raiz (`create-next-app` com TS, Tailwind, ESLint, App Router, `src/`, alias `@/*`), `vitest.config.ts`, `src/lib/format.ts`, `src/lib/format.test.ts`, `.env.example`
- shadcn/ui init + componentes: button, input, select, card, badge, dialog, sheet, table, tabs, textarea, label, dropdown-menu, sonner

**Interfaces:**
- Produces: `formatBRL(n: number): string`, `formatDate(iso: string): string` (→ `dd/mm/aaaa`), `todayInSaoPaulo(now?: Date): string` (→ `YYYY-MM-DD`), `monthKey(iso: string): string` (→ `YYYY-MM`). Script `npm test` (vitest run).

- [ ] **Step 1:** Scaffold (`npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm`), instalar `vitest`, `server-only`, init shadcn e componentes acima. `.env.example` com `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GOOGLE_PLACES_API_KEY`, `CRON_SECRET`.
- [ ] **Step 2: Teste falhando** `src/lib/format.test.ts`:
```ts
expect(formatBRL(1234.5)).toBe('R$ 1.234,50'.replace(' ', ' '))
expect(formatDate('2026-03-05')).toBe('05/03/2026')
expect(todayInSaoPaulo(new Date('2026-03-11T01:00:00Z'))).toBe('2026-03-10') // 22h em SP
expect(todayInSaoPaulo(new Date('2026-03-11T15:00:00Z'))).toBe('2026-03-11')
expect(monthKey('2026-03-31')).toBe('2026-03')
```
- [ ] **Step 3:** `npm test` → FAIL (módulo inexistente).
- [ ] **Step 4:** Implementar `src/lib/format.ts` (`todayInSaoPaulo` via `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })`).
- [ ] **Step 5:** `npm test` → PASS; `npm run build` → sucesso.
- [ ] **Step 6:** Commit `chore: scaffold Next.js + utilitários de formato`.

### Task 2: Regras de prospecção (puras)

**Files:**
- Create: `src/lib/prospect/site-status.ts`, `phone.ts`, `score.ts` e respectivos `*.test.ts`

**Interfaces:**
- Produces:
  - `type SiteStatus = 'none' | 'social' | 'has_site'`; `classifySite(uri?: string | null): SiteStatus`
  - `normalizePhone(raw?: string | null): { digits: string; isMobile: boolean } | null` — `digits` no formato `55DDDNÚMERO`
  - `type Tier = 'alto' | 'medio' | 'baixo'`; `potentialScore(i: { ratingsCount?: number | null; rating?: number | null; phone: { isMobile: boolean } | null; siteStatus: SiteStatus }): { score: number; tier: Tier }`

- [ ] **Step 1: Testes falhando:**
```ts
// site-status
expect(classifySite(undefined)).toBe('none')
expect(classifySite('')).toBe('none')
for (const u of ['https://instagram.com/x','http://www.facebook.com/x','https://fb.com/x','https://linktr.ee/x','https://wa.me/5519','https://api.whatsapp.com/send?phone=1','https://www.linkedin.com/company/x','https://tiktok.com/@x','https://www.ifood.com.br/delivery/x','https://goo.gl/maps/x','https://sites.google.com/view/x','https://x.business.site/'])
  expect(classifySite(u)).toBe('social')
expect(classifySite('https://barbeariadoze.com.br')).toBe('has_site')
expect(classifySite('not a url')).toBe('has_site')
// phone
expect(normalizePhone('+55 19 99999-8888')).toEqual({ digits: '5519999998888', isMobile: true })
expect(normalizePhone('(19) 3232-1234')).toEqual({ digits: '551932321234', isMobile: false })
expect(normalizePhone('19 9999-8888')).toEqual({ digits: '5519999998888', isMobile: true }) // celular antigo: insere 9
expect(normalizePhone('019 99999-8888')).toEqual({ digits: '5519999998888', isMobile: true })
expect(normalizePhone('0800 123 4567')).toBeNull()
expect(normalizePhone('')).toBeNull()
expect(normalizePhone('12345')).toBeNull()
// score
expect(potentialScore({ ratingsCount: 300, rating: 4.8, phone: { isMobile: true }, siteStatus: 'social' })).toEqual({ score: 100, tier: 'alto' })
expect(potentialScore({ ratingsCount: 0, rating: null, phone: null, siteStatus: 'none' })).toEqual({ score: 5, tier: 'baixo' })
expect(potentialScore({ ratingsCount: 300, rating: 4.0, phone: { isMobile: false }, siteStatus: 'none' }).score).toBe(65) // 40+15+10 → alto
expect(potentialScore({ ratingsCount: 5000, rating: 3.0, phone: null, siteStatus: 'none' }).score).toBe(40) // teto 40; médio
```
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: Implementar.**
  - `classifySite`: parse com `new URL`; falha → `'has_site'`; compara hostname sem `www.` contra a lista do spec (casa domínio exato ou sufixo `.dominio`; `goo.gl` só com path `/maps`; `business.site` por sufixo).
  - `normalizePhone`: só dígitos; remove `55` inicial se sobrar 10–11 dígitos; remove `0` de tronco (e operadora de 2 dígitos se 13+ após o 0 — ex. `0xx19…`, basta remover zeros iniciais até 10–11); prefixos `0800/0300/0500/4004/4003` → null; 10 dígitos cujo número começa em 6–9 → insere `9` após DDD; resultado 11 dígitos com 3º dígito `9` = celular; 10 dígitos começando 2–5 = fixo; qualquer outro tamanho → null.
  - `potentialScore`: avaliações `min(40, round(40*log10(1+n)/log10(301)))`; nota: null→5, ≥4.5→25, 4.0–4.5 linear 15→25, 3.5–4.0 linear 0→15, <3.5→0 (arredondar); telefone celular 25, fixo 10, nenhum 0; `social` +10; `score = min(100, soma)`; tier alto ≥65, médio 40–64, baixo <40.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: regras de prospecção (site, telefone, potencial)`.

### Task 3: Regras de cobrança (puras)

**Files:**
- Create: `src/lib/billing/dates.ts`, `charges.ts`, `status.ts` + testes

**Interfaces:**
- Produces:
  - `addMonthsClamped(iso: string, months: number, day?: number): string` — usa `day` (ou o dia de `iso`) limitado ao último dia do mês destino
  - `firstMonthlyDue(startDate: string, dueDay: number): string`
  - `type NewCharge = { type: 'setup' | 'monthly'; competence: string | null; description: string; amount: number; due_date: string }`
  - `buildSetupCharges(total: number, installments: number, firstDate: string): NewCharge[]`
  - `monthlyChargesToEnsure(c: { monthly_fee: number; due_day: number; start_date: string; status: 'active' | 'canceled'; canceled_at: string | null }, today: string): NewCharge[]` — todas as mensalidades desde a 1ª até a competência do mês seguinte a `today`; quem chama insere com `on conflict do nothing`
  - `type ChargeStatus = 'paga' | 'a_vencer' | 'vence_hoje' | 'atrasada'`; `chargeStatus(c: { due_date: string; paid_at: string | null }, today: string): ChargeStatus`

- [ ] **Step 1: Testes falhando:**
```ts
expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28')
expect(addMonthsClamped('2026-01-31', 3)).toBe('2026-04-30')
expect(addMonthsClamped('2026-01-31', 2)).toBe('2026-03-31')
expect(addMonthsClamped('2026-11-15', 2)).toBe('2027-01-15')
expect(firstMonthlyDue('2026-03-20', 10)).toBe('2026-04-10')
expect(firstMonthlyDue('2026-03-05', 10)).toBe('2026-03-10')
expect(firstMonthlyDue('2026-03-10', 10)).toBe('2026-03-10')
expect(buildSetupCharges(1000, 3, '2026-01-31')).toEqual([
  { type: 'setup', competence: null, description: 'Implantação 1/3', amount: 333.33, due_date: '2026-01-31' },
  { type: 'setup', competence: null, description: 'Implantação 2/3', amount: 333.33, due_date: '2026-02-28' },
  { type: 'setup', competence: null, description: 'Implantação 3/3', amount: 333.34, due_date: '2026-03-31' },
])
expect(buildSetupCharges(1500, 1, '2026-02-01')[0].description).toBe('Implantação')
const c = { monthly_fee: 150, due_day: 10, start_date: '2026-03-20', status: 'active' as const, canceled_at: null }
expect(monthlyChargesToEnsure(c, '2026-04-02').map(x => [x.competence, x.due_date])).toEqual([['2026-04-01','2026-04-10'], ['2026-05-01','2026-05-10']])
expect(monthlyChargesToEnsure(c, '2026-04-02')[0]).toMatchObject({ description: 'Mensalidade 04/2026', amount: 150 })
expect(monthlyChargesToEnsure({ ...c, start_date: '2026-01-05' }, '2026-03-15')).toHaveLength(4) // jan, fev, mar, abr
expect(monthlyChargesToEnsure({ ...c, status: 'canceled', canceled_at: '2026-05-01' }, '2026-07-01').map(x => x.competence)).toEqual(['2026-04-01'])
expect(monthlyChargesToEnsure({ ...c, start_date: '2026-09-01' }, '2026-04-02')).toEqual([])
// idempotência: mesma entrada → mesma saída (determinística)
expect(monthlyChargesToEnsure(c, '2026-04-02')).toEqual(monthlyChargesToEnsure(c, '2026-04-02'))
expect(chargeStatus({ due_date: '2026-03-10', paid_at: '2026-03-12' }, '2026-03-20')).toBe('paga')
expect(chargeStatus({ due_date: '2026-03-10', paid_at: null }, '2026-03-10')).toBe('vence_hoje')
expect(chargeStatus({ due_date: '2026-03-10', paid_at: null }, '2026-03-11')).toBe('atrasada')
expect(chargeStatus({ due_date: '2026-03-10', paid_at: null }, '2026-03-09')).toBe('a_vencer')
```
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar. Datas puramente por string/UTC (sem fuso). Parcelas: `floor(total/n*100)/100`, última recebe o resto. Cancelado: inclui só mensalidades com `due_date <= canceled_at`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: regras de cobrança (datas, parcelas, mensalidades, status)`.

### Task 4: Métricas do dashboard e mensagens (puras)

**Files:**
- Create: `src/lib/billing/metrics.ts`, `src/lib/messages.ts` + testes

**Interfaces:**
- Consumes: `chargeStatus`, `monthKey`
- Produces:
  - `type ChargeRow = { type: 'setup'|'monthly'; competence: string|null; amount: number; due_date: string; paid_at: string|null }`
  - `type ClientRow = { monthly_fee: number; status: 'active'|'canceled'; created_at: string }`
  - `dashboardMetrics(clients: ClientRow[], charges: ChargeRow[], today: string): { mrr: number; receivedThisMonth: number; dueThisMonth: number; overdue: { amount: number; count: number }; activeClients: number; newClientsThisMonth: number }`
  - `revenueByMonth(charges: ChargeRow[], today: string, months = 12): { month: string; setup: number; monthly: number }[]` (por `paid_at`, ordem cronológica, meses sem receita = 0)
  - `mrrHistory(charges: ChargeRow[], today: string, months = 12): { month: string; mrr: number }[]` (soma mensalidades por `competence`)
  - `funnelStats(leads: { stage: Stage; contacted_at: string|null }[]): { counts: Record<Stage, number>; conversion: number }` onde `type Stage = 'novo'|'contatado'|'proposta'|'fechado'|'perdido'`; `conversion = fechado / leads com contacted_at` (0 se nenhum)
  - `renderTemplate(body: string, vars: Record<string, string | number | undefined>): string` — `{chave}` desconhecida/ausente vira `''`
  - `whatsappUrl(digits: string, text: string): string`
  - `TEMPLATE_VARS = ['nome_empresa','cidade','categoria','responsavel','valor','vencimento','chave_pix'] as const`

- [ ] **Step 1: Testes falhando** (fixture: 2 clientes ativos 150 e 200 + 1 cancelado 100; cobranças: setup 500 venc. 2026-03-05 pago 2026-03-05; mensal 150 comp. 2026-03-01 venc. 2026-03-10 pago 2026-03-10; mensal 200 comp. 2026-03-01 venc. 2026-03-08 não pago; mensal 150 comp. 2026-03-01 venc. 2026-03-25 não pago; mensal 150 comp. 2026-02-01 venc. 2026-02-10 pago 2026-02-10; today `2026-03-15`):
```ts
expect(m.mrr).toBe(350); expect(m.receivedThisMonth).toBe(650)
expect(m.dueThisMonth).toBe(350); expect(m.overdue).toEqual({ amount: 200, count: 1 })
expect(m.activeClients).toBe(2)
const r = revenueByMonth(charges, '2026-03-15'); expect(r).toHaveLength(12)
expect(r.at(-1)).toEqual({ month: '2026-03', setup: 500, monthly: 150 })
expect(r.at(-2)).toEqual({ month: '2026-02', setup: 0, monthly: 150 })
expect(r[0].month).toBe('2025-04')
expect(mrrHistory(charges, '2026-03-15').at(-1)).toEqual({ month: '2026-03', mrr: 500 })
expect(funnelStats([{stage:'fechado',contacted_at:'x'},{stage:'perdido',contacted_at:'x'},{stage:'novo',contacted_at:null}]).conversion).toBe(0.5)
expect(funnelStats([]).conversion).toBe(0)
expect(renderTemplate('Oi {responsavel}, {nome_empresa} {xyz}!', { nome_empresa: 'Zé Barber' })).toBe('Oi , Zé Barber !')
expect(whatsappUrl('5519999998888', 'Olá & tchau')).toBe('https://wa.me/5519999998888?text=Ol%C3%A1%20%26%20tchau')
```
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** Implementar. **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: métricas do dashboard e modelos de mensagem`.

### Task 5: Banco, Supabase, login e layout

**Files:**
- Create: `supabase/migrations/0001_init.sql`, `src/lib/supabase/server.ts`, `client.ts`, `middleware.ts`, `src/middleware.ts`, `src/lib/types.ts`, `src/app/login/page.tsx` (+ action), `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx` (placeholder), `tests/e2e/auth.spec.ts`, `playwright.config.ts`

**Interfaces:**
- Produces: `createClient()` (server, async, cookies) em `@/lib/supabase/server`; `requireUser(): Promise<User>` (redireciona p/ `/login`); tipos de linha em `@/lib/types`; tabelas abaixo.

Esquema (`0001_init.sql`), todas com `id uuid pk default gen_random_uuid()`, `owner_id uuid not null default auth.uid() references auth.users`, `created_at timestamptz default now()`, RLS `for all using (owner_id = auth.uid()) with check (owner_id = auth.uid())`:
- `settings` (owner_id unique): `business_name text`, `pix_key text`, `default_setup_price numeric(12,2)`, `default_monthly_price numeric(12,2)`, `google_price_per_request numeric(10,4) default 0.035` (USD/req, configurável), `google_monthly_alert int default 1000`
- `api_usage`: `month text` (YYYY-MM), `requests int default 0`, unique(owner_id, month); função SQL `increment_api_usage(p_month text)` `security invoker` com upsert
- `place_marks`: `google_place_id text`, `status text check in ('ignored')`, unique(owner_id, google_place_id)
- `leads`: `google_place_id text null`, `name text not null`, `phone text null` (digits), `phone_is_mobile bool default false`, `city text`, `category text`, `source text check in ('google','manual')`, `stage text check in ('novo','contatado','proposta','fechado','perdido') default 'novo'`, `next_contact_at date`, `lost_reason text`, `contacted_at timestamptz`, `updated_at timestamptz`; unique index parcial (owner_id, google_place_id) where google_place_id is not null
- `lead_events`: `lead_id uuid references leads on delete cascade`, `type text check in ('note','stage_change','whatsapp')`, `body text`
- `message_templates`: `kind text check in ('approach','followup','charge')`, `name text`, `body text`
- `clients`: `lead_id uuid null references leads on delete set null`, `company text not null`, `contact_name text`, `phone text`, `email text`, `city text`, `site_url text`, `setup_total numeric(12,2) default 0`, `setup_installments int default 1 check >=1`, `monthly_fee numeric(12,2) default 0`, `due_day int check between 1 and 28`, `start_date date`, `status text check in ('active','canceled') default 'active'`, `canceled_at date`, `notes text`
- `charges`: `client_id uuid references clients on delete cascade`, `type text check in ('setup','monthly')`, `competence date null`, `description text`, `amount numeric(12,2)`, `due_date date`, `paid_at date null`, `method text default 'pix'`, `notes text`; unique index (client_id, type, competence) where type='monthly'
- Índices em FKs e em `charges(due_date)`, `leads(stage)`.

- [ ] **Step 1:** Escrever migração. Criar/escolher projeto Supabase via MCP (`list_projects`; criar `rokiai` se houver vaga no plano gratuito — senão perguntar ao usuário), aplicar com `apply_migration`, rodar `get_advisors` (security) → sem alertas de RLS.
- [ ] **Step 2:** Desativar cadastro público (Auth → "Allow new users to sign up" off — se não for possível via MCP, instruir o usuário no README) e criar o usuário do dono (e-mail fornecido pelo dono no momento do deploy; senha definida por ele). Seed: 3 `message_templates` e 1 `settings` criados no primeiro login se não existirem (`ensureDefaults()` em `src/lib/defaults.ts`).
- [ ] **Step 3: Teste e2e falhando** `tests/e2e/auth.spec.ts`: visitar `/` sem sessão → URL termina em `/login`; login com `E2E_EMAIL/E2E_PASSWORD` → vê heading "Dashboard" e a navegação com "Prospectar", "Leads", "Clientes", "Cobranças", "Configurações".
- [ ] **Step 4:** Implementar clientes Supabase (@supabase/ssr), middleware de sessão, login (Server Action `signInWithPassword`, erro "E-mail ou senha inválidos"), botão sair, layout com sidebar ≥ md e barra inferior < md (Dashboard, Prospectar, Leads, Cobranças, Mais→Clientes/Configurações).
- [ ] **Step 5:** `npx playwright test tests/e2e/auth.spec.ts --trace off` (com `npm run dev` e `.env.local`) → PASS. `npm run build` → sucesso.
- [ ] **Step 6:** Commit `feat: banco, autenticação e layout`.

### Task 6: Prospecção (busca no Google + salvar lead)

**Files:**
- Create: `src/lib/prospect/places.ts`, `places.test.ts`, `src/app/(app)/prospectar/page.tsx`, `actions.ts`, `results.tsx` (client), `src/lib/prospect/categories.ts`

**Interfaces:**
- Consumes: `classifySite`, `normalizePhone`, `potentialScore`, `createClient`
- Produces:
  - `type ProspectResult = { placeId: string; name: string; address: string; phoneRaw: string|null; phone: { digits: string; isMobile: boolean }|null; websiteUri: string|null; siteStatus: SiteStatus; rating: number|null; ratingsCount: number; mapsUrl: string; score: number; tier: Tier }`
  - `mapPlace(p: GooglePlace): ProspectResult | null` (null se `businessStatus` presente e ≠ `OPERATIONAL`)
  - `searchPlaces(query: string, pageToken?: string, fetchImpl = fetch): Promise<{ results: ProspectResult[]; nextPageToken?: string }>` — lança `PlacesError` com `message` pt-BR
  - Server Actions: `searchAction(city, category, pageToken?)`, `saveLeadsAction(items: Pick<ProspectResult,'placeId'|'name'|'phone'>[] & {city, category})`, `ignorePlaceAction(placeId)`, `marksForAction(placeIds): Promise<Record<string, { kind: 'lead'|'cliente'|'ignorado'; stage?: Stage }>>`

- [ ] **Step 1: Testes falhando** (`places.test.ts`, com `fetchImpl` falso):
  - `searchPlaces('barbearia em Campinas, SP')` faz POST para `https://places.googleapis.com/v1/places:searchText` com headers `X-Goog-Api-Key` e `X-Goog-FieldMask` = `places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.businessStatus,places.googleMapsUri,nextPageToken` e body `{ textQuery, languageCode: 'pt-BR', regionCode: 'BR', pageSize: 20 }` (+ `pageToken` quando dado).
  - Resposta com 3 lugares (um `CLOSED_PERMANENTLY`) → 2 resultados, ordenados por `score` desc, `nextPageToken` repassado.
  - Resposta `{}` → `{ results: [] }`.
  - HTTP 403 com `PERMISSION_DENIED` → `PlacesError` "Chave do Google inválida ou sem permissão para a Places API."; HTTP 429 / `RESOURCE_EXHAUSTED` → "Limite de uso da API do Google atingido. Tente mais tarde."; outro erro → "Erro ao buscar no Google (código N)."
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** Implementar `places.ts` (`import 'server-only'`, usa `internationalPhoneNumber ?? nationalPhoneNumber`). **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Página Prospectar:
  - Form: cidade (texto, lembrada em `localStorage`) + categoria (combobox com `categories.ts` + texto livre). `searchAction` incrementa `api_usage` (via `increment_api_usage`) a cada página buscada, inclusive com erro HTTP.
  - Resultados em `sessionStorage` (chave `cidade|categoria`) — sem salvar no banco. "Carregar mais" usa `nextPageToken` (botão, nunca automático).
  - Filtro padrão: `siteStatus ∈ {none, social}`; toggle "Mostrar todos". Ignorados ficam ocultos por padrão.
  - Card: nome, nota ★ + nº avaliações, telefone (badge "celular"/"fixo"), badge do site (Sem site / Só rede social / Tem site), badge de potencial (Alto/Médio/Baixo com score), selo Lead(estágio)/Cliente/Ignorado de `marksForAction`, ações Salvar lead / Ignorar / Abrir no Maps; seleção múltipla + "Salvar selecionados".
  - `saveLeadsAction` grava só `google_place_id, name, phone(digits), phone_is_mobile, city, category, source='google'` com `on conflict do nothing` (clique duplo não duplica). Toast "N leads salvos".
  - Banner se `api_usage` do mês ≥ `google_monthly_alert`: "Você já fez N buscas no Google este mês (≈ US$ X)."
  - Erro de `PlacesError` → alerta vermelho com a mensagem; zero resultados → "Nenhum comércio encontrado para essa busca."
- [ ] **Step 6:** Verificação manual com a chave real (se disponível em `.env.local`): buscar "barbearia" em uma cidade, salvar 1 lead, recarregar → selo "Lead · Novo". Sem chave: confirmar mensagem de erro amigável. `npm run build` → sucesso.
- [ ] **Step 7:** Commit `feat: prospecção via Google Places`.

### Task 7: Funil de leads + WhatsApp

**Files:**
- Create: `src/app/(app)/leads/page.tsx`, `leads/[id]/page.tsx`, `leads/actions.ts`, `leads/novo/page.tsx`, componentes `lead-card.tsx`, `kanban.tsx`, `whatsapp-button.tsx`; `tests/e2e/leads.spec.ts`

**Interfaces:**
- Consumes: `renderTemplate`, `whatsappUrl`, `normalizePhone`, `Stage`
- Produces: Server Actions `createLeadAction(form)`, `updateLeadStageAction(id, stage, extra?: { lost_reason?: string })`, `addLeadNoteAction(id, body)`, `setNextContactAction(id, date|null)`, `logWhatsappAction(id)` (registra evento; se estágio `novo` → `contatado` e `contacted_at = now()`); componente `<WhatsAppButton phone digits isMobile templates vars onSent />`.

- [ ] **Step 1: Teste e2e falhando** `leads.spec.ts`: criar lead manual "Padaria Teste" com telefone `(19) 99999-0000`; na lista aparece em "Novo"; no detalhe, clicar "Chamar no WhatsApp" com modelo de abordagem → popup com URL começando `https://wa.me/5519999990000?text=` contendo o nome; lead passa a "Contatado" e a linha do tempo mostra "WhatsApp enviado"; adicionar nota → aparece; mover para "Perdido" exige motivo.
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar:
  - Lista: abas por estágio com contagem (mobile) / colunas kanban com mudança de estágio por menu (desktop; sem drag-and-drop obrigatório), filtros cidade/categoria/busca por nome, seção "Para hoje" (`next_contact_at <= today`, exceto fechado/perdido) no topo.
  - Detalhe: dados, "Ver no Google" (`https://www.google.com/maps/place/?q=place_id:<id>` quando houver `google_place_id`), estágio, próximo contato, notas + linha do tempo (`lead_events`), WhatsApp com seletor de modelo (abordagem/follow-up) e preview editável antes de abrir; aviso "Número fixo — pode não ter WhatsApp" se `!phone_is_mobile`; botão desativado sem telefone.
  - Mudar para **Fechado** redireciona para `/clientes/novo?lead=<id>` (Task 8).
  - Lead manual: dedup por telefone — se já existe lead/cliente com o mesmo `phone`, avisa e oferece abrir o existente.
- [ ] **Step 4:** Rodar e2e → PASS. **Step 5:** Commit `feat: funil de leads com WhatsApp`.

### Task 8: Clientes e cobranças

**Files:**
- Create: `src/lib/billing/ensure.ts` (server), `src/app/(app)/clientes/page.tsx`, `clientes/novo/page.tsx`, `clientes/[id]/page.tsx`, `clientes/actions.ts`, `src/app/(app)/cobrancas/page.tsx`, `cobrancas/actions.ts`, `src/app/api/cron/charges/route.ts`; `tests/e2e/billing.spec.ts`

**Interfaces:**
- Consumes: `buildSetupCharges`, `monthlyChargesToEnsure`, `chargeStatus`, `firstMonthlyDue`, `todayInSaoPaulo`, `renderTemplate`, `whatsappUrl`
- Produces:
  - `ensureMonthlyCharges(supabase, today: string): Promise<number>` — para cada cliente (ativo ou cancelado) insere `monthlyChargesToEnsure` com upsert `onConflict: 'client_id,type,competence', ignoreDuplicates: true`; retorna inseridas
  - Server Actions: `createClientAction(form)` (cria cliente, parcelas de implantação, chama `ensureMonthlyCharges`, se `lead` → estágio `fechado` + evento), `updateClientAction`, `cancelClientAction(id, date)`, `markPaidAction(chargeId, date)`, `unmarkPaidAction`, `updateChargeAction(id, {amount, due_date, notes})`, `deleteChargeAction(id)`
  - `GET /api/cron/charges` — exige `Authorization: Bearer ${CRON_SECRET}`, usa service role **ou** itera por dono via função SQL `security definer` `ensure_all_monthly_charges(p_today date)`; escolha do implementador, desde que respeite a mesma regra de `monthlyChargesToEnsure` (se for SQL, teste ponta a ponta comparando com a função TS no cenário do Task 3).

- [ ] **Step 1: Teste e2e falhando** `billing.spec.ts`: novo cliente "Oficina Teste", implantação R$ 900 em 3x a partir de hoje, mensalidade R$ 120 dia de vencimento = dia de hoje (limitado a 28), início hoje → detalhe mostra 3 parcelas de R$ 300 e mensalidades do mês atual/próximo; marcar a 1ª parcela como paga → status "Paga"; recarregar a página 2× → número de cobranças não muda; botão "Cobrar no WhatsApp" de uma cobrança abre URL `wa.me` com valor `R$ 120,00` e a chave Pix das configurações.
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar:
  - Form de cliente: pré-preenchido do lead (`?lead=`) e dos preços padrão de `settings`; ao salvar com `start_date` no passado mostra confirmação "Serão criadas N mensalidades passadas" (N via `monthlyChargesToEnsure`).
  - Detalhe do cliente: dados, plano, lista de cobranças com status colorido, cancelar cliente (data), editar mensalidade (afeta só cobranças futuras ainda não geradas).
  - Lista de clientes: ativos/cancelados, badge "Inadimplente" se tiver cobrança `atrasada`.
  - `/cobrancas`: chama `ensureMonthlyCharges` ao carregar; abas Atrasadas / Este mês / Próximas / Pagas; filtros por cliente; ações pagar (data padrão hoje), desfazer, editar, excluir (confirmação), cobrar no WhatsApp (modelo `charge`, vars `valor`, `vencimento`, `chave_pix`, `nome_empresa`, `responsavel`).
  - Cron route + `vercel.json` com `{"crons":[{"path":"/api/cron/charges","schedule":"0 10 * * *"}]}` (07h SP); request sem token → 401.
- [ ] **Step 4:** Rodar e2e → PASS; `curl` na rota de cron sem token → 401.
- [ ] **Step 5:** Commit `feat: clientes, cobranças e geração mensal`.

### Task 9: Dashboard, configurações e exportação

**Files:**
- Create/Modify: `src/app/(app)/page.tsx`, componentes `kpi-cards.tsx`, `revenue-chart.tsx`, `mrr-chart.tsx`, `funnel.tsx`; `src/app/(app)/configuracoes/page.tsx`, `actions.ts`; `src/app/api/export/route.ts`; `tests/e2e/dashboard.spec.ts`

**Interfaces:**
- Consumes: `dashboardMetrics`, `revenueByMonth`, `mrrHistory`, `funnelStats`, `ensureMonthlyCharges`, `TEMPLATE_VARS`
- Produces: `GET /api/export?format=json|csv` (autenticado; JSON com `{ leads, clients, charges, settings, message_templates }`; CSV = zip não exigido — CSV único de cobranças com colunas cliente, tipo, descrição, valor, vencimento, pago_em)

- [ ] **Step 1: Teste e2e falhando** `dashboard.spec.ts`: com o cliente do Task 8 (1 parcela paga R$ 300, mensalidade R$ 120) → cartão MRR mostra `R$ 120,00`, "Recebido no mês" `R$ 300,00`; gráfico de receita renderiza (svg presente); em Configurações, salvar chave Pix "teste@pix.com" → reflete na mensagem de cobrança; `/api/export?format=json` retorna 200 com `clients.length >= 1`.
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar dashboard (chama `ensureMonthlyCharges` antes): cartões MRR, Recebido no mês, A receber no mês, Em atraso (valor + qtd), Clientes ativos (+ novos no mês); barras empilhadas 12 meses (Implantação × Mensalidade) e linha de MRR com Recharts (ler o skill `dataviz` antes); funil com contagens e taxa de conversão; listas "Próximos 7 dias" e "Atrasadas" com ações rápidas. Estado vazio amigável ("Nenhum cliente ainda — comece prospectando" com link).
  Configurações: nome do negócio, chave Pix, preços padrão, CRUD de modelos (mostra variáveis disponíveis `TEMPLATE_VARS`), uso da API no mês (requisições × preço = custo estimado, limite de alerta editável), botões de exportação.
- [ ] **Step 4:** Rodar e2e → PASS; `npm test` e `npm run build` → PASS.
- [ ] **Step 5:** Commit `feat: dashboard, configurações e exportação`.

### Task 10: Deploy na Vercel + README

**Files:**
- Create: `README.md` (pt-BR), `vercel.json` (se ainda não existe)

- [ ] **Step 1:** README: o que é; rodar local (`npm i`, `.env.local`, `npm run dev`); aplicar migrações; criar usuário e desativar cadastro no Supabase; configurar a chave do Google (Places API (New) habilitada, restringir a chave por API, criar alerta de orçamento e cota diária no Google Cloud); como exportar backup; como o cron funciona.
- [ ] **Step 2:** Criar projeto na Vercel via MCP ligado ao repo GitHub `felipeluna92/rokiai` (branch de produção acordada com o usuário), definir env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `CRON_SECRET` (gerado), e **pedir ao usuário que cadastre `GOOGLE_PLACES_API_KEY` ele mesmo no painel da Vercel** (nunca no chat).
- [ ] **Step 3:** Deploy; verificar com `get_deployment` estado READY; abrir a URL com Playwright: `/` redireciona para `/login`; `/api/cron/charges` sem token → 401.
- [ ] **Step 4:** Commit `docs: README e configuração de deploy`; push.
