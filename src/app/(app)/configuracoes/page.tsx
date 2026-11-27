import { Download } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { buttonClass } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { requireUser } from '@/lib/auth'
import { monthKey, todayInSaoPaulo } from '@/lib/format'
import type { MessageTemplate, Settings } from '@/lib/types'
import { SettingsForm, Templates } from './settings-forms'

export const metadata = { title: 'Configurações · RokiAi' }

export default async function SettingsPage() {
  const { supabase, user } = await requireUser()
  const [{ data: settings }, { data: templates }, { data: usage }] = await Promise.all([
    supabase.from('settings').select('*').maybeSingle(),
    supabase.from('message_templates').select('id, kind, name, body').order('kind').order('created_at'),
    supabase.from('api_usage').select('requests').eq('month', monthKey(todayInSaoPaulo())).maybeSingle(),
  ])
  const s = settings as Settings
  const requests = usage?.requests ?? 0
  return (
    <div className="space-y-4">
      <PageHeader title="Configurações" subtitle={`Conectado como ${user.email}`} />
      <Card>
        <CardTitle className="mb-3">Seu negócio</CardTitle>
        <SettingsForm settings={s} />
      </Card>

      <Card>
        <CardTitle>Uso da API do Google neste mês</CardTitle>
        <p className="mt-1 text-sm">
          <strong>{requests}</strong> buscas · custo estimado <strong>US$ {(requests * Number(s.google_price_per_request)).toFixed(2)}</strong>
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Cada página de 20 resultados conta como 1 busca. O Google dá uma cota gratuita mensal; confira a fatura real no Google Cloud e
          crie um alerta de orçamento por lá.
        </p>
      </Card>

      <Card>
        <CardTitle className="mb-1">Modelos de mensagem</CardTitle>
        <p className="mb-3 text-xs text-zinc-500">
          Variáveis: {'{nome_empresa} {cidade} {categoria} {responsavel} {valor} {vencimento} {chave_pix}'}. Na cobrança, {'{nome_empresa}'} é o
          nome do seu negócio e {'{responsavel}'} o contato do cliente.
        </p>
        <Templates templates={(templates ?? []) as MessageTemplate[]} />
      </Card>

      <Card>
        <CardTitle className="mb-1">Backup dos dados</CardTitle>
        <p className="mb-3 text-sm text-zinc-500">Baixe uma cópia de leads, clientes e cobranças. Faça isso de vez em quando.</p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/export?format=json" className={buttonClass('outline')}>
            <Download className="h-4 w-4" /> Tudo (JSON)
          </a>
          <a href="/api/export?format=csv" className={buttonClass('outline')}>
            <Download className="h-4 w-4" /> Cobranças (CSV)
          </a>
        </div>
      </Card>
    </div>
  )
}
