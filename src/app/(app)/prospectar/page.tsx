import { PageHeader } from '@/components/page-header'
import { requireUser } from '@/lib/auth'
import { minutesAgoISO, monthKey, todayInSaoPaulo } from '@/lib/format'
import { currentProvider } from './actions'
import { ProspectClient } from './prospect-client'

export const metadata = { title: 'Prospectar · RokiAi' }

export default async function ProspectarPage() {
  const { supabase } = await requireUser()
  const month = monthKey(todayInSaoPaulo())
  const since = minutesAgoISO(20)
  const [provider, { data: settings }, { data: usage }, { data: runs }, { data: running }] = await Promise.all([
    currentProvider(),
    supabase.from('settings').select('google_price_per_request, google_monthly_alert, apify_monthly_alert_usd').maybeSingle(),
    supabase.from('api_usage').select('requests').eq('month', month).maybeSingle(),
    supabase.from('apify_runs').select('cost_usd, scraped').gte('created_at', `${month}-01T03:00:00Z`),
    supabase.from('apify_runs').select('run_id').eq('status', 'running').gte('created_at', since).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  const apifyCost = (runs ?? []).reduce((s, r) => s + Number(r.cost_usd ?? 0), 0)
  return (
    <>
      <PageHeader title="Prospectar" subtitle="Encontre comércios sem site no Google Maps" />
      <ProspectClient
        provider={provider}
        initialUsage={usage?.requests ?? 0}
        alertAt={settings?.google_monthly_alert ?? 1000}
        pricePerRequest={Number(settings?.google_price_per_request ?? 0.035)}
        apifyMonthCost={apifyCost}
        apifyAlertUsd={Number(settings?.apify_monthly_alert_usd ?? 4.5)}
        runningRunId={running?.run_id ?? null}
      />
    </>
  )
}
