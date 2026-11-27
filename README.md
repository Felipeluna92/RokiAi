# RokiAi

Ferramenta interna para vender sites a comércios locais:

- **Prospectar** — busca comércios de uma cidade no Google Maps (Places API), mostra quem **não tem site** (ou só tem rede social) e dá uma nota de potencial.
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

## Chave do Google (Places API)

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
| `GOOGLE_PLACES_API_KEY` | chave da Places API — **só no servidor, nunca commitar** |
| `CRON_SECRET` | segredo da rota `/api/cron/charges` (a Vercel envia automaticamente) |

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha os valores
npm run dev
```

Testes: `npm test` (regras de negócio) e `npm run e2e` (ponta a ponta; precisa de `E2E_EMAIL`/`E2E_PASSWORD` de um usuário de teste no `.env.local`).

## Banco de dados

As migrações ficam em `supabase/migrations/` e já estão aplicadas no projeto. Todas as tabelas usam RLS: cada linha pertence ao usuário logado.

## Backup

Em **Configurações → Backup dos dados** você baixa tudo em JSON e as cobranças em CSV. O plano gratuito do Supabase não tem backup restaurável — baixe de vez em quando.

## Cron

A Vercel chama `/api/cron/charges` uma vez por dia para manter o banco ativo (o plano gratuito do Supabase pausa projetos parados). As mensalidades são geradas automaticamente sempre que você abre o painel, clientes ou cobranças.
