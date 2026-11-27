export type LeadSort = 'prioridade' | 'estrelas' | 'recentes'
export const LEAD_SORTS: { value: LeadSort; label: string }[] = [
  { value: 'prioridade', label: 'Prioridade (potencial)' },
  { value: 'estrelas', label: 'Mais estrelas' },
  { value: 'recentes', label: 'Mais recentes' },
]

export type SortableLead = {
  id: string
  potential_score: number | null
  rating: number | null
  ratings_count: number | null
  updated_at: string
}

const desc = (a: number | null, b: number | null) => (b ?? -1) - (a ?? -1)

/** Ordena leads para decidir quem abordar primeiro. Sem dados vão para o fim. */
export function sortLeads<T extends SortableLead>(leads: T[], mode: LeadSort): T[] {
  const out = [...leads]
  if (mode === 'recentes') return out.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  if (mode === 'estrelas')
    return out.sort((a, b) => desc(Number(a.rating ?? NaN) || null, Number(b.rating ?? NaN) || null) || desc(a.ratings_count, b.ratings_count))
  return out.sort(
    (a, b) =>
      desc(a.potential_score, b.potential_score) ||
      desc(a.rating == null ? null : Number(a.rating), b.rating == null ? null : Number(b.rating)) ||
      desc(a.ratings_count, b.ratings_count) ||
      b.updated_at.localeCompare(a.updated_at),
  )
}
