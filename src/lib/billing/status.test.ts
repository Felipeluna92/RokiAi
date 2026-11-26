import { describe, expect, it } from 'vitest'
import { chargeStatus } from './status'
import { todayInSaoPaulo } from '../format'

describe('chargeStatus', () => {
  it('paga', () => expect(chargeStatus({ due_date: '2026-03-10', paid_at: '2026-03-12' }, '2026-03-20')).toBe('paga'))
  it('vence hoje', () => expect(chargeStatus({ due_date: '2026-03-10', paid_at: null }, '2026-03-10')).toBe('vence_hoje'))
  it('atrasada', () => expect(chargeStatus({ due_date: '2026-03-10', paid_at: null }, '2026-03-11')).toBe('atrasada'))
  it('a vencer', () => expect(chargeStatus({ due_date: '2026-03-10', paid_at: null }, '2026-03-09')).toBe('a_vencer'))
  it('22h em São Paulo ainda é "vence hoje"', () => {
    const today = todayInSaoPaulo(new Date('2026-03-11T01:00:00Z'))
    expect(chargeStatus({ due_date: '2026-03-10', paid_at: null }, today)).toBe('vence_hoje')
  })
})
