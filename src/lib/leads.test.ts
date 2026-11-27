import { describe, expect, it } from 'vitest'
import { sortLeads, type SortableLead } from './leads'

const l = (id: string, over: Partial<SortableLead> = {}): SortableLead => ({
  id,
  potential_score: null,
  rating: null,
  ratings_count: null,
  updated_at: '2026-11-01T00:00:00Z',
  ...over,
})

describe('sortLeads', () => {
  const leads = [
    l('semdados', { updated_at: '2026-11-20T00:00:00Z' }),
    l('medio', { potential_score: 60, rating: 4.9, ratings_count: 20 }),
    l('alto', { potential_score: 90, rating: 4.5, ratings_count: 300 }),
    l('empate', { potential_score: 60, rating: 4.2, ratings_count: 900 }),
  ]
  it('prioridade: potencial desc, depois estrelas, depois avaliações; sem dados por último', () => {
    expect(sortLeads(leads, 'prioridade').map((x) => x.id)).toEqual(['alto', 'medio', 'empate', 'semdados'])
  })
  it('estrelas: nota desc, depois número de avaliações', () => {
    expect(sortLeads(leads, 'estrelas').map((x) => x.id)).toEqual(['medio', 'alto', 'empate', 'semdados'])
  })
  it('recentes: updated_at desc', () => {
    expect(sortLeads(leads, 'recentes')[0].id).toBe('semdados')
  })
  it('não altera o array original', () => {
    const copy = [...leads]
    sortLeads(leads, 'prioridade')
    expect(leads).toEqual(copy)
  })
})
