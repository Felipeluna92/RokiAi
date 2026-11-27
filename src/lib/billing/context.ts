import 'server-only'
import type { Supabase } from '@/lib/supabase/server'
import type { MessageTemplate, Settings } from '@/lib/types'
import { fetchAllPages } from '@/lib/paginate'
import type { ChargeWithClient } from '@/components/charge-row'

/** Dados usados para cobrar no WhatsApp: modelos de cobrança e chave Pix. */
export async function billingContext(supabase: Supabase) {
  const [{ data: templates }, { data: settings }] = await Promise.all([
    supabase.from('message_templates').select('id, kind, name, body').eq('kind', 'charge'),
    supabase.from('settings').select('*').maybeSingle(),
  ])
  const s = settings as Settings | null
  return {
    templates: (templates ?? []) as MessageTemplate[],
    pixKey: s?.pix_key ?? null,
    businessName: s?.business_name ?? null,
    settings: s,
  }
}

export const CHARGE_SELECT = '*, client:clients(id, company, contact_name, phone)'

/** Todas as cobranças ativas (sem as anuladas), opcionalmente de um cliente, ordenadas por vencimento. */
export async function fetchCharges(supabase: Supabase, opts: { clientId?: string; ascending?: boolean } = {}) {
  return fetchAllPages<ChargeWithClient>((from, to) => {
    let q = supabase.from('charges').select(CHARGE_SELECT).is('voided_at', null)
    if (opts.clientId) q = q.eq('client_id', opts.clientId)
    return q.order('due_date', { ascending: opts.ascending ?? true }).order('id').range(from, to) as unknown as PromiseLike<{
      data: ChargeWithClient[] | null
      error: { message: string } | null
    }>
  })
}
