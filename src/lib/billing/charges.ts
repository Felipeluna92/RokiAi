import { addMonthsClamped, firstMonthlyDue, monthStart } from './dates'

export type NewCharge = {
  type: 'setup' | 'monthly'
  competence: string | null
  description: string
  amount: number
  due_date: string
}

export type ClientPlan = {
  monthly_fee: number
  due_day: number
  start_date: string
  status: 'active' | 'canceled'
  canceled_at: string | null
}

/** Parcelas mensais da implantação; a última absorve o arredondamento. */
export function buildSetupCharges(total: number, installments: number, firstDate: string): NewCharge[] {
  const n = Math.max(1, Math.floor(installments))
  const cents = Math.round(total * 100)
  if (cents <= 0) return []
  const base = Math.floor(cents / n)
  return Array.from({ length: n }, (_, i) => ({
    type: 'setup' as const,
    competence: null,
    description: n === 1 ? 'Implantação' : `Implantação ${i + 1}/${n}`,
    amount: (i === n - 1 ? cents - base * (n - 1) : base) / 100,
    due_date: addMonthsClamped(firstDate, i),
  }))
}

/**
 * Todas as mensalidades que devem existir para o cliente: da primeira até a
 * competência do mês seguinte a `today`. Quem chama insere ignorando duplicadas.
 */
export function monthlyChargesToEnsure(c: ClientPlan, today: string): NewCharge[] {
  if (!(c.monthly_fee > 0) || !c.start_date || !c.due_day) return []
  const last = addMonthsClamped(monthStart(today), 1) // 1º dia do mês seguinte
  const out: NewCharge[] = []
  let due = firstMonthlyDue(c.start_date, c.due_day)
  for (let i = 0; i < 600 && monthStart(due) <= last; i++) {
    if (c.status === 'canceled' && c.canceled_at && due > c.canceled_at) break
    const competence = monthStart(due)
    out.push({
      type: 'monthly',
      competence,
      description: `Mensalidade ${competence.slice(5, 7)}/${competence.slice(0, 4)}`,
      amount: Math.round(c.monthly_fee * 100) / 100,
      due_date: due,
    })
    due = addMonthsClamped(competence, 1, c.due_day)
  }
  return out
}
