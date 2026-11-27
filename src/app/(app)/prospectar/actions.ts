'use server'
import { requireUser } from '@/lib/auth'
import { monthKey, todayInSaoPaulo } from '@/lib/format'
import { PlacesError, searchPlaces, type ProspectResult } from '@/lib/prospect/places'
import type { Stage } from '@/lib/billing/metrics'

export type SearchResponse =
  | { ok: true; results: ProspectResult[]; nextPageToken?: string; usage: number }
  | { ok: false; error: string; usage?: number }

export async function searchAction(city: string, category: string, pageToken?: string): Promise<SearchResponse> {
  const { supabase } = await requireUser()
  const c = city.trim()
  const cat = category.trim()
  if (!c || !cat) return { ok: false, error: 'Informe a cidade e a categoria.' }
  const hasKey = Boolean(process.env.GOOGLE_PLACES_API_KEY)
  let usage: number | undefined
  if (hasKey) {
    const { data } = await supabase.rpc('increment_api_usage', { p_month: monthKey(todayInSaoPaulo()) })
    usage = typeof data === 'number' ? data : undefined
  }
  try {
    const r = await searchPlaces(`${cat} em ${c}`, pageToken)
    return { ok: true, ...r, usage: usage ?? 0 }
  } catch (e) {
    if (e instanceof PlacesError) return { ok: false, error: e.message, usage }
    throw e
  }
}

export type Mark = { kind: 'lead' | 'cliente' | 'ignorado'; stage?: Stage; leadId?: string }

export async function marksForAction(placeIds: string[]): Promise<Record<string, Mark>> {
  if (!placeIds.length) return {}
  const { supabase } = await requireUser()
  const out: Record<string, Mark> = {}
  const [{ data: ignored }, { data: leads }] = await Promise.all([
    supabase.from('place_marks').select('google_place_id').in('google_place_id', placeIds),
    supabase.from('leads').select('id, google_place_id, stage').in('google_place_id', placeIds),
  ])
  for (const m of ignored ?? []) out[m.google_place_id] = { kind: 'ignorado' }
  const leadIds = (leads ?? []).map((l) => l.id)
  const { data: clients } = leadIds.length
    ? await supabase.from('clients').select('lead_id').in('lead_id', leadIds)
    : { data: [] as { lead_id: string }[] }
  const clientLeadIds = new Set((clients ?? []).map((c) => c.lead_id))
  for (const l of leads ?? []) {
    out[l.google_place_id!] = clientLeadIds.has(l.id)
      ? { kind: 'cliente', leadId: l.id }
      : { kind: 'lead', stage: l.stage as Stage, leadId: l.id }
  }
  return out
}

export type SaveItem = { placeId: string; name: string; phone: { digits: string; isMobile: boolean } | null }

export async function saveLeadsAction(items: SaveItem[], city: string, category: string): Promise<{ saved: number }> {
  const { supabase } = await requireUser()
  if (!items.length) return { saved: 0 }
  const rows = items.map((i) => ({
    google_place_id: i.placeId,
    name: i.name.slice(0, 200),
    phone: i.phone?.digits ?? null,
    phone_is_mobile: i.phone?.isMobile ?? false,
    city: city.trim() || null,
    category: category.trim() || null,
    source: 'google' as const,
  }))
  const { data, error } = await supabase
    .from('leads')
    .upsert(rows, { onConflict: 'owner_id,google_place_id', ignoreDuplicates: true })
    .select('id')
  if (error) throw new Error(error.message)
  return { saved: data?.length ?? 0 }
}

export async function ignorePlaceAction(placeId: string, ignore: boolean) {
  const { supabase } = await requireUser()
  if (ignore) {
    await supabase.from('place_marks').upsert({ google_place_id: placeId, status: 'ignored' }, { onConflict: 'owner_id,google_place_id', ignoreDuplicates: true })
  } else {
    await supabase.from('place_marks').delete().eq('google_place_id', placeId)
  }
}
