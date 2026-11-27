'use server'
import { requireUser } from '@/lib/auth'
import { monthKey, todayInSaoPaulo } from '@/lib/format'
import { PlacesError, searchPlaces, type ProspectResult } from '@/lib/prospect/places'
import { APIFY_MAX_PLACES, ApifyError, abortApifyRun, getApifyRun, startApifySearch } from '@/lib/prospect/apify'
import type { Stage } from '@/lib/billing/metrics'

export type SearchResponse =
  | { ok: true; results: ProspectResult[]; nextPageToken?: string; usage: number }
  | { ok: true; pending: string }
  | { ok: false; error: string; usage?: number }

export type Provider = 'apify' | 'google' | 'none'

/** Apify é a fonte principal; o Google entra se só a chave dele existir. */
export async function currentProvider(): Promise<Provider> {
  if (process.env.APIFY_TOKEN) return 'apify'
  if (process.env.GOOGLE_PLACES_API_KEY) return 'google'
  return 'none'
}

export async function searchAction(city: string, category: string, pageToken?: string, max = 50): Promise<SearchResponse> {
  const { supabase } = await requireUser()
  const c = city.trim()
  const cat = category.trim()
  if (!c || !cat) return { ok: false, error: 'Informe a cidade e a categoria.' }

  if ((await currentProvider()) === 'apify') {
    try {
      const { runId } = await startApifySearch({ city: c, category: cat, max })
      const { error } = await supabase
        .from('apify_runs')
        .insert({ run_id: runId, city: c, category: cat, max_places: Math.min(APIFY_MAX_PLACES, Math.max(1, Math.floor(max))) })
      if (error) {
        await abortApifyRun(runId).catch(() => {})
        return { ok: false, error: 'Não foi possível registrar a busca.' }
      }
      return { ok: true, pending: runId }
    } catch (e) {
      if (e instanceof ApifyError) return { ok: false, error: e.message }
      throw e
    }
  }
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

export type SaveItem = {
  placeId: string
  name: string
  phone: { digits: string; isMobile: boolean } | null
  rating?: number | null
  ratingsCount?: number | null
  score?: number | null
}

type Stats = Pick<SaveItem, 'placeId' | 'rating' | 'ratingsCount' | 'score'>

/** Valida os números que vêm do navegador antes de gravar. */
function cleanStats(i: Stats) {
  const rating = typeof i.rating === 'number' && i.rating >= 0 && i.rating <= 5 ? Math.round(i.rating * 10) / 10 : null
  const ratings_count = typeof i.ratingsCount === 'number' && i.ratingsCount >= 0 ? Math.floor(i.ratingsCount) : null
  const potential_score = typeof i.score === 'number' && i.score >= 0 && i.score <= 100 ? Math.round(i.score) : null
  return { rating, ratings_count, potential_score }
}

/** Atualiza estrelas/avaliações/potencial dos leads que reapareceram numa busca. */
export async function refreshLeadStatsAction(items: Stats[]) {
  if (!items.length) return
  const { supabase } = await requireUser()
  const { data: leads } = await supabase
    .from('leads')
    .select('id, google_place_id')
    .in('google_place_id', items.map((i) => i.placeId))
  const byPlace = new Map(items.map((i) => [i.placeId, i]))
  await Promise.all(
    (leads ?? []).map((l) => {
      const it = byPlace.get(l.google_place_id!)
      return it ? supabase.from('leads').update(cleanStats(it)).eq('id', l.id) : null
    }),
  )
}

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
    ...cleanStats(i),
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

export type PollResponse =
  | { status: 'running'; startedAt: string }
  | { status: 'succeeded'; results: ProspectResult[]; city: string; category: string; scraped: number; costUsd: number | null }
  | { status: 'failed'; error: string }

/** Consulta uma busca da Apify do próprio usuário (RLS garante a posse). */
export async function pollApifyAction(runId: string): Promise<PollResponse> {
  const { supabase } = await requireUser()
  const { data: run } = await supabase.from('apify_runs').select('*').eq('run_id', runId).maybeSingle()
  if (!run) return { status: 'failed', error: 'Busca não encontrada.' }
  if (run.status === 'aborted') return { status: 'failed', error: 'Busca cancelada.' }
  try {
    const state = await getApifyRun(runId)
    if (state.status === 'running') return { status: 'running', startedAt: run.created_at }
    if (state.status === 'failed') {
      if (run.status === 'running')
        await supabase.from('apify_runs').update({ status: 'failed', error: state.error, finished_at: new Date().toISOString() }).eq('run_id', runId)
      return state
    }
    if (run.status === 'running')
      await supabase
        .from('apify_runs')
        .update({ status: 'succeeded', scraped: state.scraped, cost_usd: state.costUsd, finished_at: new Date().toISOString() })
        .eq('run_id', runId)
    return { status: 'succeeded', results: state.results, city: run.city, category: run.category, scraped: state.scraped, costUsd: state.costUsd }
  } catch (e) {
    if (e instanceof ApifyError) return { status: 'failed', error: e.message }
    throw e
  }
}

export async function abortApifyAction(runId: string) {
  const { supabase } = await requireUser()
  const { data: run } = await supabase.from('apify_runs').select('status').eq('run_id', runId).maybeSingle()
  if (!run || run.status !== 'running') return
  await abortApifyRun(runId).catch(() => {})
  await supabase.from('apify_runs').update({ status: 'aborted', finished_at: new Date().toISOString() }).eq('run_id', runId)
}
