import type { SiteStatus } from './site-status'

export type Tier = 'alto' | 'medio' | 'baixo'

export type ScoreInput = {
  ratingsCount?: number | null
  rating?: number | null
  phone: { isMobile: boolean } | null
  siteStatus: SiteStatus
}

function ratingPoints(rating?: number | null): number {
  if (rating == null) return 5
  if (rating >= 4.5) return 25
  if (rating >= 4.0) return 15 + ((rating - 4.0) / 0.5) * 10
  if (rating >= 3.5) return ((rating - 3.5) / 0.5) * 15
  return 0
}

/** Nota de potencial 0–100 (ver spec 6.2). */
export function potentialScore(i: ScoreInput): { score: number; tier: Tier } {
  const n = Math.max(0, i.ratingsCount ?? 0)
  const reviews = Math.min(40, (40 * Math.log10(1 + n)) / Math.log10(301))
  const phone = i.phone ? (i.phone.isMobile ? 25 : 10) : 0
  const social = i.siteStatus === 'social' ? 10 : 0
  const score = Math.min(100, Math.round(reviews + ratingPoints(i.rating) + phone + social))
  return { score, tier: tierOf(score) }
}

export function tierOf(score: number): Tier {
  return score >= 65 ? 'alto' : score >= 40 ? 'medio' : 'baixo'
}

export const TIER_LABEL: Record<Tier, string> = { alto: 'Potencial alto', medio: 'Potencial médio', baixo: 'Potencial baixo' }
