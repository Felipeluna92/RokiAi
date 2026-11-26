import { monthKey, todayInSaoPaulo } from '../format'
import { addMonthsClamped } from './dates'
import { chargeStatus } from './status'

export type Stage = 'novo' | 'contatado' | 'proposta' | 'fechado' | 'perdido'
export const STAGES: Stage[] = ['novo', 'contatado', 'proposta', 'fechado', 'perdido']
export const STAGE_LABEL: Record<Stage, string> = {
  novo: 'Novo',
  contatado: 'Contatado',
  proposta: 'Proposta enviada',
  fechado: 'Fechado',
  perdido: 'Perdido',
}

export type ChargeRow = {
  type: 'setup' | 'monthly'
  competence: string | null
  amount: number
  due_date: string
  paid_at: string | null
}

export type ClientRow = { monthly_fee: number; status: 'active' | 'canceled'; created_at: string }

const cents = (n: number) => Math.round(n * 100)
const reais = (c: number) => c / 100

export function dashboardMetrics(clients: ClientRow[], charges: ChargeRow[], today: string) {
  const month = monthKey(today)
  let mrr = 0
  let activeClients = 0
  let newClientsThisMonth = 0
  for (const c of clients) {
    if (c.status === 'active') {
      mrr += cents(Number(c.monthly_fee))
      activeClients++
    }
    if (monthKey(todayInSaoPaulo(new Date(c.created_at))) === month) newClientsThisMonth++
  }
  let received = 0
  let due = 0
  let overdueAmount = 0
  let overdueCount = 0
  for (const ch of charges) {
    const amount = cents(Number(ch.amount))
    if (ch.paid_at && monthKey(ch.paid_at) === month) received += amount
    if (!ch.paid_at && monthKey(ch.due_date) === month) due += amount
    if (chargeStatus(ch, today) === 'atrasada') {
      overdueAmount += amount
      overdueCount++
    }
  }
  return {
    mrr: reais(mrr),
    receivedThisMonth: reais(received),
    dueThisMonth: reais(due),
    overdue: { amount: reais(overdueAmount), count: overdueCount },
    activeClients,
    newClientsThisMonth,
  }
}

function lastMonths(today: string, months: number): string[] {
  const start = `${monthKey(today)}-01`
  return Array.from({ length: months }, (_, i) => monthKey(addMonthsClamped(start, i - months + 1)))
}

export function revenueByMonth(charges: ChargeRow[], today: string, months = 12) {
  const keys = lastMonths(today, months)
  const acc = new Map(keys.map((k) => [k, { setup: 0, monthly: 0 }]))
  for (const ch of charges) {
    if (!ch.paid_at) continue
    const slot = acc.get(monthKey(ch.paid_at))
    if (slot) slot[ch.type] += cents(Number(ch.amount))
  }
  return keys.map((month) => {
    const s = acc.get(month)!
    return { month, setup: reais(s.setup), monthly: reais(s.monthly) }
  })
}

export function mrrHistory(charges: ChargeRow[], today: string, months = 12) {
  const keys = lastMonths(today, months)
  const acc = new Map(keys.map((k) => [k, 0]))
  for (const ch of charges) {
    if (ch.type !== 'monthly' || !ch.competence) continue
    const k = monthKey(ch.competence)
    if (acc.has(k)) acc.set(k, acc.get(k)! + cents(Number(ch.amount)))
  }
  return keys.map((month) => ({ month, mrr: reais(acc.get(month)!) }))
}

export function funnelStats(leads: { stage: Stage; contacted_at: string | null }[]) {
  const counts = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>
  let contacted = 0
  for (const l of leads) {
    counts[l.stage]++
    if (l.contacted_at) contacted++
  }
  return { counts, conversion: contacted ? counts.fechado / contacted : 0 }
}
