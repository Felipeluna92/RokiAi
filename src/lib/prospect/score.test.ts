import { describe, expect, it } from 'vitest'
import { potentialScore } from './score'

describe('potentialScore', () => {
  it('máximo', () => {
    expect(potentialScore({ ratingsCount: 300, rating: 4.8, phone: { isMobile: true }, siteStatus: 'social' })).toEqual({ score: 100, tier: 'alto' })
  })
  it('mínimo sem dados', () => {
    expect(potentialScore({ ratingsCount: 0, rating: null, phone: null, siteStatus: 'none' })).toEqual({ score: 5, tier: 'baixo' })
  })
  it('limite do alto (65)', () => {
    expect(potentialScore({ ratingsCount: 300, rating: 4.0, phone: { isMobile: false }, siteStatus: 'none' })).toEqual({ score: 65, tier: 'alto' })
  })
  it('avaliações têm teto de 40; nota baixa zera', () => {
    expect(potentialScore({ ratingsCount: 5000, rating: 3.0, phone: null, siteStatus: 'none' })).toEqual({ score: 40, tier: 'medio' })
  })
  it('interpola a nota entre 3.5 e 4.5', () => {
    expect(potentialScore({ ratingsCount: 0, rating: 3.75, phone: null, siteStatus: 'none' }).score).toBe(8)
    expect(potentialScore({ ratingsCount: 0, rating: 4.25, phone: null, siteStatus: 'none' }).score).toBe(20)
  })
})
