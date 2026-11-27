import 'server-only'
import type { Supabase } from '@/lib/supabase/server'
import type { MessageTemplate, Settings } from '@/lib/types'

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
