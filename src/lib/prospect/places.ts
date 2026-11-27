import 'server-only'
import { classifySite, type SiteStatus } from './site-status'
import { normalizePhone, type NormalizedPhone } from './phone'
import { potentialScore, type Tier } from './score'

export type ProspectResult = {
  placeId: string
  name: string
  address: string
  phoneRaw: string | null
  phone: NormalizedPhone | null
  websiteUri: string | null
  siteStatus: SiteStatus
  rating: number | null
  ratingsCount: number
  mapsUrl: string
  score: number
  tier: Tier
}

type GooglePlace = {
  id: string
  displayName?: { text?: string }
  formattedAddress?: string
  nationalPhoneNumber?: string
  internationalPhoneNumber?: string
  websiteUri?: string
  rating?: number
  userRatingCount?: number
  businessStatus?: string
  googleMapsUri?: string
}

export class PlacesError extends Error {}

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText'
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'places.googleMapsUri',
  'nextPageToken',
].join(',')

export function mapPlace(p: GooglePlace): ProspectResult | null {
  if (p.businessStatus && p.businessStatus !== 'OPERATIONAL') return null
  const phoneRaw = p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? null
  const phone = normalizePhone(phoneRaw)
  const siteStatus = classifySite(p.websiteUri)
  const { score, tier } = potentialScore({ ratingsCount: p.userRatingCount, rating: p.rating, phone, siteStatus })
  return {
    placeId: p.id,
    name: p.displayName?.text ?? 'Sem nome',
    address: p.formattedAddress ?? '',
    phoneRaw,
    phone,
    websiteUri: p.websiteUri ?? null,
    siteStatus,
    rating: p.rating ?? null,
    ratingsCount: p.userRatingCount ?? 0,
    mapsUrl: p.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${p.id}`,
    score,
    tier,
  }
}

function errorMessage(status: number, body: { error?: { status?: string; message?: string; details?: { reason?: string }[] } }) {
  const s = body.error?.status
  const keyProblem =
    status === 403 ||
    s === 'PERMISSION_DENIED' ||
    /api key/i.test(body.error?.message ?? '') ||
    body.error?.details?.some((d) => d.reason === 'API_KEY_INVALID')
  if (keyProblem) return 'Chave do Google inválida ou sem permissão para a Places API.'
  if (status === 429 || s === 'RESOURCE_EXHAUSTED') return 'Limite de uso da API do Google atingido. Tente mais tarde.'
  return `Erro ao buscar no Google (código ${status}).`
}

export async function searchPlaces(
  query: string,
  pageToken?: string,
  opts: { apiKey?: string; fetchImpl?: typeof fetch } = {},
): Promise<{ results: ProspectResult[]; nextPageToken?: string }> {
  const apiKey = opts.apiKey ?? process.env.GOOGLE_PLACES_API_KEY ?? ''
  if (!apiKey) throw new PlacesError('Chave do Google não configurada. Cadastre GOOGLE_PLACES_API_KEY nas variáveis de ambiente.')
  const doFetch = opts.fetchImpl ?? fetch
  const body: Record<string, unknown> = { textQuery: query, languageCode: 'pt-BR', regionCode: 'BR', pageSize: 20 }
  if (pageToken) body.pageToken = pageToken

  let res: Response
  try {
    res = await doFetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELD_MASK },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
  } catch {
    throw new PlacesError('Não foi possível conectar ao Google. Verifique sua conexão.')
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new PlacesError(errorMessage(res.status, json))

  const results = ((json.places ?? []) as GooglePlace[])
    .map(mapPlace)
    .filter((r): r is ProspectResult => r !== null)
    .sort((a, b) => b.score - a.score)
  return json.nextPageToken ? { results, nextPageToken: json.nextPageToken } : { results }
}
