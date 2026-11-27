import Link from 'next/link'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { ChargeRow } from '@/components/charge-row'
import { fetchAllPages } from '@/lib/paginate'
import { MrrChart, RevenueChart } from '@/components/dashboard/charts'
import { PageHeader } from '@/components/page-header'
import { buttonClass } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { requireUser } from '@/lib/auth'
import { billingContext, fetchCharges } from '@/lib/billing/context'
import { ensureMonthlyCharges } from '@/lib/billing/ensure'
import { STAGE_LABEL, STAGES, dashboardMetrics, funnelStats, mrrHistory, revenueByMonth, type Stage } from '@/lib/billing/metrics'
import { chargeStatus } from '@/lib/billing/status'
import { formatBRL, todayInSaoPaulo } from '@/lib/format'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Dashboard · RokiAi' }

function Kpi({ id, label, value, hint, tone, className }: { id: string; label: string; value: string; hint?: string; tone?: 'red'; className?: string }) {
  return (
    <Card data-testid={id} className={cn('p-4', className)}>
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold tracking-tight tabular-nums', tone === 'red' && 'text-red-600 dark:text-red-400')}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
    </Card>
  )
}

export default async function DashboardPage() {
  const { supabase } = await requireUser()
  const today = todayInSaoPaulo()
  await ensureMonthlyCharges(supabase, today)
  const [{ data: clients }, allCharges, leads, ctx] = await Promise.all([
    supabase.from('clients').select('monthly_fee, status, created_at'),
    fetchCharges(supabase),
    fetchAllPages<{ stage: Stage; contacted_at: string | null }>((from, to) =>
      supabase.from('leads').select('stage, contacted_at').order('id').range(from, to),
    ),
    billingContext(supabase),
  ])
  const rows = allCharges.map((c) => ({ ...c, amount: Number(c.amount) }))
  const m = dashboardMetrics(
    (clients ?? []).map((c) => ({ ...c, monthly_fee: Number(c.monthly_fee) })),
    rows,
    today,
  )
  const revenue = revenueByMonth(rows, today)
  const mrr = mrrHistory(rows, today)
  const funnel = funnelStats(leads)
  const weekAhead = new Date(`${today}T12:00:00Z`)
  weekAhead.setUTCDate(weekAhead.getUTCDate() + 7)
  const limit = weekAhead.toISOString().slice(0, 10)
  const overdue = allCharges.filter((c) => chargeStatus(c, today) === 'atrasada')
  const upcoming = allCharges.filter((c) => !c.paid_at && c.due_date >= today && c.due_date <= limit)
  const hasClients = (clients ?? []).length > 0

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Visão geral do seu negócio" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi id="kpi-mrr" label="Receita recorrente (MRR)" value={formatBRL(m.mrr)} hint="soma das mensalidades ativas" />
        <Kpi id="kpi-received" label="Recebido no mês" value={formatBRL(m.receivedThisMonth)} />
        <Kpi id="kpi-due" label="A receber no mês" value={formatBRL(m.dueThisMonth)} />
        <Kpi
          id="kpi-overdue"
          label="Em atraso"
          value={formatBRL(m.overdue.amount)}
          hint={m.overdue.count ? `${m.overdue.count} cobrança${m.overdue.count > 1 ? 's' : ''}` : 'nada atrasado'}
          tone={m.overdue.count ? 'red' : undefined}
        />
        <Kpi id="kpi-clients" className="col-span-2 lg:col-span-1" label="Clientes ativos" value={String(m.activeClients)} hint={m.newClientsThisMonth ? `+${m.newClientsThisMonth} este mês` : undefined} />
      </div>

      {!hasClients && (
        <Card className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">Nenhum cliente ainda — comece prospectando</p>
            <p className="text-sm text-zinc-500">Busque comércios sem site na sua cidade e salve os melhores como leads.</p>
          </div>
          <Link href="/prospectar" className={buttonClass()}>
            Prospectar <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      )}

      {overdue.length > 0 && (
        <Card className="mt-4 border-red-200 dark:border-red-900">
          <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" /> Cobranças atrasadas
          </CardTitle>
          <ul>
            {overdue.slice(0, 5).map((c) => (
              <ChargeRow key={c.id} charge={c} today={today} templates={ctx.templates} pixKey={ctx.pixKey} businessName={ctx.businessName} />
            ))}
          </ul>
          {overdue.length > 5 && (
            <Link href="/cobrancas?tab=atrasadas" className="text-sm underline">
              Ver todas ({overdue.length})
            </Link>
          )}
        </Card>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card data-testid="revenue-chart">
          <CardTitle>Receita recebida por mês</CardTitle>
          <p className="mb-3 text-xs text-zinc-500">Últimos 12 meses, pela data do pagamento</p>
          <RevenueChart data={revenue} />
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-zinc-500">Ver tabela</summary>
            <table className="mt-2 w-full tabular-nums">
              <thead className="text-zinc-500">
                <tr>
                  <th className="text-left font-medium">Mês</th>
                  <th className="text-right font-medium">Implantação</th>
                  <th className="text-right font-medium">Mensalidade</th>
                  <th className="text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {revenue.map((r) => (
                  <tr key={r.month} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td>{r.month.slice(5)}/{r.month.slice(0, 4)}</td>
                    <td className="text-right">{formatBRL(r.setup)}</td>
                    <td className="text-right">{formatBRL(r.monthly)}</td>
                    <td className="text-right">{formatBRL(r.setup + r.monthly)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </Card>
        <Card>
          <CardTitle>Evolução do MRR</CardTitle>
          <p className="mb-3 text-xs text-zinc-500">Mensalidades geradas por mês de competência</p>
          <MrrChart data={mrr} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Funil de vendas</CardTitle>
          <p className="mb-3 text-xs text-zinc-500">
            Conversão: <strong className="text-zinc-900 dark:text-white">{Math.round(funnel.conversion * 100)}%</strong> dos leads contatados viraram clientes
          </p>
          <ul className="space-y-2">
            {STAGES.map((s) => {
              const n = funnel.counts[s]
              const max = Math.max(1, ...Object.values(funnel.counts))
              return (
                <li key={s} className="grid grid-cols-[7.5rem_1fr_2rem] items-center gap-2 text-sm">
                  <Link href={`/leads?stage=${s}`} className="hover:underline">
                    {STAGE_LABEL[s]}
                  </Link>
                  <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div className="h-2 rounded-full" style={{ width: `${(n / max) * 100}%`, background: 'var(--series-1)' }} />
                  </div>
                  <span className="text-right tabular-nums">{n}</span>
                </li>
              )
            })}
          </ul>
        </Card>
        <Card>
          <CardTitle>Próximos 7 dias</CardTitle>
          {upcoming.length === 0 ? (
            <p className="py-6 text-sm text-zinc-500">Nenhum vencimento nos próximos 7 dias.</p>
          ) : (
            <ul>
              {upcoming.map((c) => (
                <ChargeRow key={c.id} charge={c} today={today} templates={ctx.templates} pixKey={ctx.pixKey} businessName={ctx.businessName} />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
