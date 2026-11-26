import { describe, expect, it } from 'vitest'
import { dashboardMetrics, funnelStats, mrrHistory, revenueByMonth, type ChargeRow, type ClientRow } from './metrics'

const clients: ClientRow[] = [
  { monthly_fee: 150, status: 'active', created_at: '2026-01-10T12:00:00Z' },
  { monthly_fee: 200, status: 'active', created_at: '2026-03-02T12:00:00Z' },
  { monthly_fee: 100, status: 'canceled', created_at: '2025-10-01T12:00:00Z' },
]
const charges: ChargeRow[] = [
  { type: 'setup', competence: null, amount: 500, due_date: '2026-03-05', paid_at: '2026-03-05' },
  { type: 'monthly', competence: '2026-03-01', amount: 150, due_date: '2026-03-10', paid_at: '2026-03-10' },
  { type: 'monthly', competence: '2026-03-01', amount: 200, due_date: '2026-03-08', paid_at: null },
  { type: 'monthly', competence: '2026-03-01', amount: 150, due_date: '2026-03-25', paid_at: null },
  { type: 'monthly', competence: '2026-02-01', amount: 150, due_date: '2026-02-10', paid_at: '2026-02-10' },
]
const today = '2026-03-15'

describe('dashboardMetrics', () => {
  const m = dashboardMetrics(clients, charges, today)
  it('MRR soma só ativos', () => expect(m.mrr).toBe(350))
  it('recebido no mês', () => expect(m.receivedThisMonth).toBe(650))
  it('a receber no mês', () => expect(m.dueThisMonth).toBe(350))
  it('em atraso', () => expect(m.overdue).toEqual({ amount: 200, count: 1 }))
  it('clientes ativos e novos', () => {
    expect(m.activeClients).toBe(2)
    expect(m.newClientsThisMonth).toBe(1)
  })
  it('vazio', () => {
    expect(dashboardMetrics([], [], today)).toEqual({
      mrr: 0, receivedThisMonth: 0, dueThisMonth: 0, overdue: { amount: 0, count: 0 }, activeClients: 0, newClientsThisMonth: 0,
    })
  })
})

describe('revenueByMonth', () => {
  const r = revenueByMonth(charges, today)
  it('12 meses em ordem', () => {
    expect(r).toHaveLength(12)
    expect(r[0].month).toBe('2025-04')
  })
  it('separa implantação e mensalidade', () => {
    expect(r.at(-1)).toEqual({ month: '2026-03', setup: 500, monthly: 150 })
    expect(r.at(-2)).toEqual({ month: '2026-02', setup: 0, monthly: 150 })
  })
})

describe('mrrHistory', () => {
  it('soma mensalidades por competência', () => {
    const h = mrrHistory(charges, today)
    expect(h).toHaveLength(12)
    expect(h.at(-1)).toEqual({ month: '2026-03', mrr: 500 })
    expect(h.at(-2)).toEqual({ month: '2026-02', mrr: 150 })
  })
})

describe('funnelStats', () => {
  it('conversão = fechados / contatados', () => {
    const f = funnelStats([
      { stage: 'fechado', contacted_at: 'x' },
      { stage: 'perdido', contacted_at: 'x' },
      { stage: 'novo', contacted_at: null },
    ])
    expect(f.conversion).toBe(0.5)
    expect(f.counts).toEqual({ novo: 1, contatado: 0, proposta: 0, fechado: 1, perdido: 1 })
  })
  it('sem leads', () => expect(funnelStats([]).conversion).toBe(0))
})
