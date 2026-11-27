# RokiAi

Ferramenta interna para vender sites a comércios locais:

- **Prospectar** — busca comércios de uma cidade no Google Maps (via **Apify** — Google Maps Scraper — ou Google Places API), mostra quem **não tem site** (ou só tem rede social / link de agendamento) e dá uma nota de potencial.
- **Leads** — funil (Novo → Contatado → Proposta → Fechado/Perdido), anotações, próximo contato e botão de **WhatsApp** com mensagem pronta.
- **Clientes e cobranças** — implantação (à vista ou parcelada) + mensalidade, geração automática das mensalidades, baixa manual de pagamento (Pix) e cobrança pelo WhatsApp.
- **Dashboard** — MRR, recebido no mês, a receber, atrasados, gráficos de 12 meses e funil.

Stack: Next.js 16 · Supabase (Postgres + Auth) · Vercel.

## Primeiro acesso

O cadastro só aceita e-mails autorizados. Para autorizar o seu, rode no **SQL Editor** do Supabase:

```sql
insert into private.allowed_emails (email) values ('seu-email@exemplo.com');
```

Depois abra o site, clique em **Criar conta** e cadastre a senha. (O Supabase pode mandar um e-mail de confirmação — pode ignorar, a conta já fica ativa.)

## Fonte das buscas: Apify (principal)

1. Em [console.apify.com](https://console.apify.com) → *Settings → API & Integrations*, copie o **Personal API token**.
2. Na Vercel: *Project → Settings → Environment Variables* → adicione `APIFY_TOKEN` (Production) e faça um *Redeploy*.

O app usa o actor `compass/crawler-google-places` (a partir de US$ 4 por 1.000 comércios). Cada busca roda em segundo plano (30 s a alguns minutos); você escolhe quantos comércios quer (até 500) e pode cancelar. Cada execução tem um teto de gasto (mínimo da Apify: US$ 0,50). O gasto do mês aparece em **Configurações**, com aviso a partir do valor que você definir.

Se `APIFY_TOKEN` estiver configurado, a Apify é usada; senão, o Google Places (abaixo).

## Chave do Google (Places API, opcional)

1. No [Google Cloud Console](https://console.cloud.google.com/), ative a **Places API (New)** no projeto da sua chave.
2. Em *APIs e serviços → Credenciais*, restrinja a chave à **Places API (New)**.
3. Na Vercel: *Project → Settings → Environment Variables* → adicione `GOOGLE_PLACES_API_KEY` (Production) e faça um *Redeploy*.
4. Recomendado: em *Faturamento → Orçamentos e alertas* crie um alerta de orçamento, e em *Cotas* limite as requisições diárias da Places API.

Cada página de 20 resultados é 1 requisição. O app conta as buscas do mês em **Configurações** e avisa a partir do limite que você definir.

## Variáveis de ambiente

| Variável | Onde |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave publicável (anon) do Supabase |
| `APIFY_TOKEN` | token da Apify — **só no servidor, nunca commitar** |
| `GOOGLE_PLACES_API_KEY` | (opcional) chave da Places API — **só no servidor, nunca commitar** |
| `CRON_SECRET` | segredo da rota `/api/cron/charges` (a Vercel envia automaticamente) |

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha os valores
npm run dev
```

Testes: `npm test` (regras de negócio) e `npm run e2e` (ponta a ponta; precisa de `E2E_EMAIL`/`E2E_PASSWORD` de um usuário de teste no `.env.local`). A busca real na Apify só roda com `APIFY_E2E=1 npm run e2e -- tests/e2e/apify.spec.ts` (gasta alguns centavos).

## Banco de dados

As migrações ficam em `supabase/migrations/` e já estão aplicadas no projeto. Todas as tabelas usam RLS: cada linha pertence ao usuário logado.

## Backup

Em **Configurações → Backup dos dados** você baixa tudo em JSON e as cobranças em CSV. O plano gratuito do Supabase não tem backup restaurável — baixe de vez em quando.

## Cron

A Vercel chama `/api/cron/charges` uma vez por dia para manter o banco ativo (o plano gratuito do Supabase pausa projetos parados). As mensalidades são geradas automaticamente sempre que você abre o painel, clientes ou cobranças.
