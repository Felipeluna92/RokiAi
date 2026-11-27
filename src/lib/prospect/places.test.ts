import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
import { PlacesError, searchPlaces } from './places'

const FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.businessStatus,places.googleMapsUri,nextPageToken'

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = []
  const fn = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init! })
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  }
  return { fn: fn as typeof fetch, calls }
}

const place = (over: Record<string, unknown>) => ({
  id: 'p',
  displayName: { text: 'X' },
  formattedAddress: 'Rua A, 1',
  googleMapsUri: 'https://maps.google.com/?cid=1',
  businessStatus: 'OPERATIONAL',
  ...over,
})

describe('searchPlaces', () => {
  it('chama a Text Search (New) com field mask e corpo corretos', async () => {
    const { fn, calls } = fakeFetch(200, {})
    await searchPlaces('barbearia em Campinas, SP', undefined, { apiKey: 'K', fetchImpl: fn })
    expect(calls[0].url).toBe('https://places.googleapis.com/v1/places:searchText')
    expect(calls[0].init.method).toBe('POST')
    const h = new Headers(calls[0].init.headers)
    expect(h.get('X-Goog-Api-Key')).toBe('K')
    expect(h.get('X-Goog-FieldMask')).toBe(FIELD_MASK)
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      textQuery: 'barbearia em Campinas, SP',
      languageCode: 'pt-BR',
      regionCode: 'BR',
      pageSize: 20,
    })
  })

  it('repassa o pageToken', async () => {
    const { fn, calls } = fakeFetch(200, {})
    await searchPlaces('q', 'TOKEN', { apiKey: 'K', fetchImpl: fn })
    expect(JSON.parse(String(calls[0].init.body)).pageToken).toBe('TOKEN')
  })

  it('mapeia, remove fechados e ordena por potencial', async () => {
    const { fn } = fakeFetch(200, {
      nextPageToken: 'NEXT',
      places: [
        place({ id: 'a', displayName: { text: 'Pequena' }, userRatingCount: 2, rating: 4 }),
        place({ id: 'b', displayName: { text: 'Fechada' }, businessStatus: 'CLOSED_PERMANENTLY' }),
        place({
          id: 'c',
          displayName: { text: 'Barbearia do Zé' },
          userRatingCount: 312,
          rating: 4.8,
          internationalPhoneNumber: '+55 19 99999-8888',
          websiteUri: 'https://instagram.com/ze',
        }),
      ],
    })
    const r = await searchPlaces('q', undefined, { apiKey: 'K', fetchImpl: fn })
    expect(r.nextPageToken).toBe('NEXT')
    expect(r.results.map((x) => x.placeId)).toEqual(['c', 'a'])
    expect(r.results[0]).toMatchObject({
      name: 'Barbearia do Zé',
      phone: { digits: '5519999998888', isMobile: true },
      siteStatus: 'social',
      rating: 4.8,
      ratingsCount: 312,
      score: 100,
      tier: 'alto',
    })
  })

  it('resposta vazia → sem resultados', async () => {
    const { fn } = fakeFetch(200, {})
    expect(await searchPlaces('q', undefined, { apiKey: 'K', fetchImpl: fn })).toEqual({ results: [] })
  })

  it('chave ausente → erro claro', async () => {
    const { fn } = fakeFetch(200, {})
    await expect(searchPlaces('q', undefined, { apiKey: '', fetchImpl: fn })).rejects.toThrow('Chave do Google não configurada')
  })

  it.each([
    [403, { error: { status: 'PERMISSION_DENIED' } }, 'Chave do Google inválida ou sem permissão para a Places API.'],
    [400, { error: { status: 'INVALID_ARGUMENT', message: 'API key not valid' } }, 'Chave do Google inválida ou sem permissão para a Places API.'],
    [429, { error: { status: 'RESOURCE_EXHAUSTED' } }, 'Limite de uso da API do Google atingido. Tente mais tarde.'],
    [500, { error: { status: 'INTERNAL' } }, 'Erro ao buscar no Google (código 500).'],
  ])('HTTP %i → PlacesError', async (status, body, msg) => {
    const { fn } = fakeFetch(status, body)
    const p = searchPlaces('q', undefined, { apiKey: 'K', fetchImpl: fn })
    await expect(p).rejects.toBeInstanceOf(PlacesError)
    await expect(p).rejects.toThrow(msg)
  })
})
