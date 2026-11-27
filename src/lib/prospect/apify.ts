import 'server-only'
import { classifySite } from './site-status'
import { normalizePhone } from './phone'
import { potentialScore } from './score'
import type { ProspectResult } from './places'

const API = 'https://api.apify.com/v2'
const ACTOR = 'compass~crawler-google-places'
export const APIFY_MAX_PLACES = 500
export const APIFY_PRICE_PER_PLACE = 0.004

export class ApifyError extends Error {}

type Opts = { token?: string; fetchImpl?: typeof fetch }

type ApifyPlace = {
  title?: string
  placeId?: string
  address?: string
  phone?: string | null
  phoneUnformatted?: string | null
  website?: string | null
  totalScore?: number | null
  reviewsCount?: number | null
  url?: string
  permanentlyClosed?: boolean
  temporarilyClosed?: boolean
}

export function mapApifyPlace(p: ApifyPlace): ProspectResult | null {
  if (!p.placeId || p.permanentlyClosed || p.temporarilyClosed) return null
  const phoneRaw = p.phone ?? p.phoneUnformatted ?? null
  const phone = normalizePhone(p.phoneUnformatted ?? p.phone)
  const siteStatus = classifySite(p.website)
  const { score, tier } = potentialScore({ ratingsCount: p.reviewsCount, rating: p.totalScore, phone, siteStatus })
  return {
    placeId: p.placeId,
    name: p.title ?? 'Sem nome',
    address: p.address ?? '',
    phoneRaw,
    phone,
    websiteUri: p.website ?? null,
    siteStatus,
    rating: p.totalScore ?? null,
    ratingsCount: p.reviewsCount ?? 0,
    mapsUrl: p.url ?? `https://www.google.com/maps/place/?q=place_id:${p.placeId}`,
    score,
    tier,
  }
}

function setup(opts: Opts) {
  const token = opts.token ?? process.env.APIFY_TOKEN ?? ''
  if (!token) throw new ApifyError('Token da Apify não configurado. Cadastre APIFY_TOKEN nas variáveis de ambiente.')
  return { token, doFetch: opts.fetchImpl ?? fetch }
}

async function call(doFetch: typeof fetch, url: string, token: string, init: RequestInit = {}) {
  try {
    return await doFetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
      cache: 'no-store',
    })
  } catch {
    throw new ApifyError('Não foi possível conectar à Apify. Verifique sua conexão.')
  }
}

function httpError(status: number, action: string) {
  if (status === 401) return new ApifyError('Token da Apify inválido.')
  if (status === 402 || status === 403) return new ApifyError('Sem créditos na Apify. Recarregue sua conta para continuar.')
  return new ApifyError(`Erro ao ${action} na Apify (código ${status}).`)
}

/** Inicia a busca (assíncrona). O resultado é lido depois com getApifyRun. */
export async function startApifySearch(
  q: { city: string; category: string; max: number },
  opts: Opts = {},
): Promise<{ runId: string }> {
  const { token, doFetch } = setup(opts)
  const max = Math.max(1, Math.min(APIFY_MAX_PLACES, Math.floor(q.max) || 1))
  const city = q.city.trim()
  const location = /brasil|brazil/i.test(city) ? city : `${city}, Brasil`
  // teto de gasto por execução (mínimo exigido pela Apify: US$ 0,50)
  const cap = Math.max(0.5, Math.ceil((max * APIFY_PRICE_PER_PLACE * 1.5 + 0.05) * 100) / 100)
  const url = `${API}/acts/${ACTOR}/runs?timeout=600&maxTotalChargeUsd=${cap}`
  const res = await call(doFetch, url, token, {
    method: 'POST',
    body: JSON.stringify({
      searchStringsArray: [q.category.trim()],
      locationQuery: location,
      maxCrawledPlacesPerSearch: max,
      language: 'pt-BR',
      skipClosedPlaces: true,
    }),
  })
  if (!res.ok) throw httpError(res.status, 'iniciar a busca')
  const json = await res.json().catch(() => ({}))
  const runId = json?.data?.id
  if (!runId) throw new ApifyError('Resposta inesperada da Apify ao iniciar a busca.')
  return { runId }
}

export type ApifyRunState =
  | { status: 'running' }
  | { status: 'succeeded'; results: ProspectResult[]; scraped: number; costUsd: number | null }
  | { status: 'failed'; error: string }

export async function getApifyRun(runId: string, opts: Opts = {}): Promise<ApifyRunState> {
  const { token, doFetch } = setup(opts)
  const res = await call(doFetch, `${API}/actor-runs/${encodeURIComponent(runId)}`, token)
  if (!res.ok) throw httpError(res.status, 'consultar a busca')
  const run = (await res.json().catch(() => ({})))?.data ?? {}
  const status = String(run.status ?? '')
  if (status === 'READY' || status === 'RUNNING') return { status: 'running' }
  if (status !== 'SUCCEEDED') return { status: 'failed', error: `A busca na Apify não terminou (status: ${status || 'desconhecido'}).` }

  const itemsRes = await call(doFetch, `${API}/datasets/${encodeURIComponent(run.defaultDatasetId)}/items?clean=true&format=json`, token)
  if (!itemsRes.ok) throw httpError(itemsRes.status, 'ler os resultados')
  const items = ((await itemsRes.json().catch(() => [])) ?? []) as ApifyPlace[]
  const seen = new Set<string>()
  const results = items
    .map(mapApifyPlace)
    .filter((r): r is ProspectResult => {
      if (!r || seen.has(r.placeId)) return false
      seen.add(r.placeId)
      return true
    })
    .sort((a, b) => b.score - a.score)
  return { status: 'succeeded', results, scraped: items.length, costUsd: typeof run.usageTotalUsd === 'number' ? run.usageTotalUsd : null }
}

export async function abortApifyRun(runId: string, opts: Opts = {}) {
  const { token, doFetch } = setup(opts)
  await call(doFetch, `${API}/actor-runs/${encodeURIComponent(runId)}/abort`, token, { method: 'POST' })
}
