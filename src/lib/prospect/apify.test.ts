import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
import { ApifyError, getApifyRun, mapApifyPlace, startApifySearch } from './apify'

function fakeFetch(responses: { status: number; body: unknown }[]) {
  const calls: { url: string; init?: RequestInit }[] = []
  let i = 0
  const fn = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    const r = responses[Math.min(i++, responses.length - 1)]
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } })
  }
  return { fn: fn as typeof fetch, calls }
}

const item = (over: Record<string, unknown> = {}) => ({
  title: 'Barbearia do Zé',
  placeId: 'p1',
  address: 'Rua A, 1 - Campinas - SP',
  phone: '+55 19 99999-8888',
  phoneUnformatted: '+5519999998888',
  website: 'https://www.instagram.com/ze',
  totalScore: 4.8,
  reviewsCount: 312,
  url: 'https://www.google.com/maps/search/?api=1&query=x&query_place_id=p1',
  permanentlyClosed: false,
  temporarilyClosed: false,
  ...over,
})

describe('mapApifyPlace', () => {
  it('converte para ProspectResult', () => {
    expect(mapApifyPlace(item())).toEqual({
      placeId: 'p1',
      name: 'Barbearia do Zé',
      address: 'Rua A, 1 - Campinas - SP',
      phoneRaw: '+55 19 99999-8888',
      phone: { digits: '5519999998888', isMobile: true },
      websiteUri: 'https://www.instagram.com/ze',
      siteStatus: 'social',
      rating: 4.8,
      ratingsCount: 312,
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=x&query_place_id=p1',
      score: 100,
      tier: 'alto',
    })
  })
  it('fechados ou sem placeId → null', () => {
    expect(mapApifyPlace(item({ permanentlyClosed: true }))).toBeNull()
    expect(mapApifyPlace(item({ temporarilyClosed: true }))).toBeNull()
    expect(mapApifyPlace(item({ placeId: undefined }))).toBeNull()
  })
  it('campos ausentes', () => {
    const r = mapApifyPlace(item({ phone: null, phoneUnformatted: null, website: null, totalScore: null, reviewsCount: null }))!
    expect(r).toMatchObject({ phone: null, phoneRaw: null, websiteUri: null, siteStatus: 'none', rating: null, ratingsCount: 0 })
  })
})

describe('startApifySearch', () => {
  it('inicia o actor com entrada, teto de custo e timeout', async () => {
    const { fn, calls } = fakeFetch([{ status: 201, body: { data: { id: 'RUN1', status: 'READY' } } }])
    const r = await startApifySearch({ city: 'Campinas, SP', category: 'Barbearia', max: 50 }, { token: 'T', fetchImpl: fn })
    expect(r).toEqual({ runId: 'RUN1' })
    const u = new URL(calls[0].url)
    expect(u.origin + u.pathname).toBe('https://api.apify.com/v2/acts/compass~crawler-google-places/runs')
    expect(u.searchParams.get('timeout')).toBe('600')
    expect(Number(u.searchParams.get('maxTotalChargeUsd'))).toBeGreaterThanOrEqual(0.5)
    expect(new Headers(calls[0].init!.headers).get('Authorization')).toBe('Bearer T')
    expect(JSON.parse(String(calls[0].init!.body))).toEqual({
      searchStringsArray: ['Barbearia'],
      locationQuery: 'Campinas, SP, Brasil',
      maxCrawledPlacesPerSearch: 50,
      language: 'pt-BR',
      skipClosedPlaces: true,
    })
  })
  it('não duplica "Brasil" e limita a quantidade', async () => {
    const { fn, calls } = fakeFetch([{ status: 201, body: { data: { id: 'R' } } }])
    await startApifySearch({ city: 'Recife, PE, Brasil', category: 'Pet shop', max: 5000 }, { token: 'T', fetchImpl: fn })
    const body = JSON.parse(String(calls[0].init!.body))
    expect(body.locationQuery).toBe('Recife, PE, Brasil')
    expect(body.maxCrawledPlacesPerSearch).toBe(500)
  })
  it('sem token → erro claro', async () => {
    const { fn } = fakeFetch([{ status: 201, body: {} }])
    await expect(startApifySearch({ city: 'a', category: 'b', max: 10 }, { token: '', fetchImpl: fn })).rejects.toThrow('Token da Apify não configurado')
  })
  it.each([
    [401, 'Token da Apify inválido.'],
    [402, 'Sem créditos na Apify. Recarregue sua conta para continuar.'],
    [403, 'Sem créditos na Apify. Recarregue sua conta para continuar.'],
    [500, 'Erro ao iniciar a busca na Apify (código 500).'],
  ])('HTTP %i → ApifyError', async (status, msg) => {
    const { fn } = fakeFetch([{ status, body: { error: { type: 'x', message: 'y' } } }])
    const p = startApifySearch({ city: 'a', category: 'b', max: 10 }, { token: 'T', fetchImpl: fn })
    await expect(p).rejects.toBeInstanceOf(ApifyError)
    await expect(p).rejects.toThrow(msg)
  })
})

describe('getApifyRun', () => {
  it('em andamento', async () => {
    const { fn } = fakeFetch([{ status: 200, body: { data: { status: 'RUNNING', usageTotalUsd: 0.01 } } }])
    expect(await getApifyRun('RUN1', { token: 'T', fetchImpl: fn })).toEqual({ status: 'running' })
  })
  it('concluída traz resultados mapeados, sem fechados e sem repetidos, ordenados', async () => {
    const { fn, calls } = fakeFetch([
      { status: 200, body: { data: { status: 'SUCCEEDED', defaultDatasetId: 'DS1', usageTotalUsd: 0.21 } } },
      {
        status: 200,
        body: [
          item({ placeId: 'a', title: 'Pequena', reviewsCount: 2, totalScore: 4, website: null, phoneUnformatted: null, phone: null }),
          item({ placeId: 'b', permanentlyClosed: true }),
          item({ placeId: 'c' }),
          item({ placeId: 'c' }),
        ],
      },
    ])
    const r = await getApifyRun('RUN1', { token: 'T', fetchImpl: fn })
    expect(r.status).toBe('succeeded')
    if (r.status !== 'succeeded') throw new Error()
    expect(r.results.map((x) => x.placeId)).toEqual(['c', 'a'])
    expect(r.costUsd).toBe(0.21)
    expect(r.scraped).toBe(4)
    expect(calls[0].url).toBe('https://api.apify.com/v2/actor-runs/RUN1')
    expect(calls[1].url).toBe('https://api.apify.com/v2/datasets/DS1/items?clean=true&format=json')
  })
  it.each(['FAILED', 'ABORTED', 'TIMED-OUT'])('%s → falhou', async (s) => {
    const { fn } = fakeFetch([{ status: 200, body: { data: { status: s } } }])
    const r = await getApifyRun('RUN1', { token: 'T', fetchImpl: fn })
    expect(r).toEqual({ status: 'failed', error: 'A busca na Apify não terminou (status: ' + s + ').' })
  })
})
