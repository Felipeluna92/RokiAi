import { describe, expect, it } from 'vitest'
import { buildSetupCharges, monthlyChargesToEnsure } from './charges'

describe('buildSetupCharges', () => {
  it('divide em parcelas mensais com resto na última', () => {
    expect(buildSetupCharges(1000, 3, '2026-01-31')).toEqual([
      { type: 'setup', competence: null, description: 'Implantação 1/3', amount: 333.33, due_date: '2026-01-31' },
      { type: 'setup', competence: null, description: 'Implantação 2/3', amount: 333.33, due_date: '2026-02-28' },
      { type: 'setup', competence: null, description: 'Implantação 3/3', amount: 333.34, due_date: '2026-03-31' },
    ])
  })
  it('à vista', () => {
    expect(buildSetupCharges(1500, 1, '2026-02-01')).toEqual([
      { type: 'setup', competence: null, description: 'Implantação', amount: 1500, due_date: '2026-02-01' },
    ])
  })
  it('valor zero não gera cobrança', () => {
    expect(buildSetupCharges(0, 3, '2026-02-01')).toEqual([])
  })
  it('soma das parcelas é exata', () => {
    const total = buildSetupCharges(100, 7, '2026-01-10').reduce((s, c) => s + c.amount, 0)
    expect(Math.round(total * 100)).toBe(10000)
  })
})

describe('monthlyChargesToEnsure', () => {
  const c = { monthly_fee: 150, due_day: 10, start_date: '2026-03-20', status: 'active' as const, canceled_at: null }

  it('gera mês atual e próximo', () => {
    expect(monthlyChargesToEnsure(c, '2026-04-02').map((x) => [x.competence, x.due_date])).toEqual([
      ['2026-04-01', '2026-04-10'],
      ['2026-05-01', '2026-05-10'],
    ])
  })
  it('descrição e valor', () => {
    expect(monthlyChargesToEnsure(c, '2026-04-02')[0]).toEqual({
      type: 'monthly',
      competence: '2026-04-01',
      description: 'Mensalidade 04/2026',
      amount: 150,
      due_date: '2026-04-10',
    })
  })
  it('início no passado gera retroativas', () => {
    expect(monthlyChargesToEnsure({ ...c, start_date: '2026-01-05' }, '2026-03-15')).toHaveLength(4)
  })
  it('cancelado para de gerar após o cancelamento', () => {
    expect(monthlyChargesToEnsure({ ...c, status: 'canceled', canceled_at: '2026-05-01' }, '2026-07-01').map((x) => x.competence)).toEqual(['2026-04-01'])
  })
  it('início futuro distante → nada', () => {
    expect(monthlyChargesToEnsure({ ...c, start_date: '2026-09-01' }, '2026-04-02')).toEqual([])
  })
  it('mensalidade zero → nada', () => {
    expect(monthlyChargesToEnsure({ ...c, monthly_fee: 0 }, '2026-04-02')).toEqual([])
  })
  it('determinística (idempotente)', () => {
    expect(monthlyChargesToEnsure(c, '2026-04-02')).toEqual(monthlyChargesToEnsure(c, '2026-04-02'))
  })
})
