import { PageHeader } from '@/components/page-header'
import { requireUser } from '@/lib/auth'
import { monthKey, todayInSaoPaulo } from '@/lib/format'
import { ProspectClient } from './prospect-client'

export const metadata = { title: 'Prospectar · RokiAi' }

export default async function ProspectarPage() {
  const { supabase } = await requireUser()
  const [{ data: settings }, { data: usage }] = await Promise.all([
    supabase.from('settings').select('google_price_per_request, google_monthly_alert').maybeSingle(),
    supabase.from('api_usage').select('requests').eq('month', monthKey(todayInSaoPaulo())).maybeSingle(),
  ])
  return (
    <>
      <PageHeader title="Prospectar" subtitle="Encontre comércios sem site no Google Maps" />
      <ProspectClient
        initialUsage={usage?.requests ?? 0}
        alertAt={settings?.google_monthly_alert ?? 1000}
        pricePerRequest={Number(settings?.google_price_per_request ?? 0.035)}
      />
    </>
  )
}
