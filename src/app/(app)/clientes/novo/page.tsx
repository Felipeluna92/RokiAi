import { PageHeader } from '@/components/page-header'
import { Card } from '@/components/ui/card'
import { ClientForm } from '@/components/client-form'
import { requireUser } from '@/lib/auth'
import { todayInSaoPaulo } from '@/lib/format'
import { createClientAction } from '../actions'

export const metadata = { title: 'Novo cliente · RokiAi' }

export default async function NewClientPage({ searchParams }: PageProps<'/clientes/novo'>) {
  const sp = await searchParams
  const leadId = typeof sp.lead === 'string' ? sp.lead : undefined
  const { supabase } = await requireUser()
  const [{ data: lead }, { data: settings }] = await Promise.all([
    leadId ? supabase.from('leads').select('id, name, phone, city').eq('id', leadId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('settings').select('default_setup_price, default_monthly_price').maybeSingle(),
  ])
  return (
    <>
      <PageHeader title="Novo cliente" subtitle={lead ? `Fechando o lead ${lead.name}` : 'Cadastre um cliente e o plano dele'} />
      <Card className="max-w-3xl">
        <ClientForm
          mode="create"
          action={createClientAction}
          today={todayInSaoPaulo()}
          leadId={lead?.id}
          defaults={{
            company: lead?.name,
            phone: lead?.phone,
            city: lead?.city,
            setup_total: settings?.default_setup_price,
            monthly_fee: settings?.default_monthly_price,
          }}
        />
      </Card>
    </>
  )
}
