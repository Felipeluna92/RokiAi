import Link from 'next/link'
import { ChargeRow, type ChargeWithClient } from '@/components/charge-row'
import { PageHeader } from '@/components/page-header'
import { Card } from '@/components/ui/card'
import { requireUser } from '@/lib/auth'
import { billingContext, fetchCharges } from '@/lib/billing/context'
import { ensureMonthlyCharges } from '@/lib/billing/ensure'
import { chargeStatus } from '@/lib/billing/status'
import { formatBRL, monthKey, todayInSaoPaulo } from '@/lib/format'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Cobranças · RokiAi' }

const TABS = [
  ['atrasadas', 'Atrasadas'],
  ['mes', 'Este mês'],
  ['proximas', 'Próximas'],
  ['pagas', 'Pagas'],
  ['todas', 'Todas'],
] as const
type Tab = (typeof TABS)[number][0]

export default async function ChargesPage({ searchParams }: PageProps<'/cobrancas'>) {
  const sp = await searchParams
  const { supabase } = await requireUser()
  const today = todayInSaoPaulo()
  await ensureMonthlyCharges(supabase, today)
  const [all, ctx] = await Promise.all([fetchCharges(supabase), billingContext(supabase)])
  const month = monthKey(today)

  const groups: Record<Tab, ChargeWithClient[]> = {
    atrasadas: all.filter((c) => chargeStatus(c, today) === 'atrasada'),
    mes: all.filter((c) => !c.paid_at && monthKey(c.due_date) === month),
    proximas: all.filter((c) => !c.paid_at && monthKey(c.due_date) > month),
    pagas: all.filter((c) => c.paid_at).sort((a, b) => b.paid_at!.localeCompare(a.paid_at!)),
    todas: all,
  }
  const requested = typeof sp.tab === 'string' && TABS.some(([k]) => k === sp.tab) ? (sp.tab as Tab) : null
  const tab: Tab = requested ?? (groups.atrasadas.length ? 'atrasadas' : 'mes')
  const list = groups[tab]
  const total = list.reduce((s, c) => s + Number(c.amount), 0)

  return (
    <>
      <PageHeader title="Cobranças" subtitle="Implantações e mensalidades" />
      <nav aria-label="Filtrar cobranças" className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {TABS.map(([k, label]) => (
          <Link
            key={k}
            href={`/cobrancas?tab=${k}`}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1 text-sm',
              tab === k ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900' : 'border-zinc-300 dark:border-zinc-700',
              k === 'atrasadas' && groups.atrasadas.length > 0 && tab !== k && 'border-red-300 text-red-700 dark:border-red-800 dark:text-red-300',
            )}
          >
            {label} <span className="opacity-70">{groups[k].length}</span>
          </Link>
        ))}
      </nav>
      <Card>
        <div className="mb-1 flex items-center justify-between text-sm text-zinc-500">
          <span>{list.length} cobranças</span>
          <span>
            Total: <strong className="text-zinc-900 dark:text-white">{formatBRL(total)}</strong>
          </span>
        </div>
        {list.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">Nada por aqui.</p>
        ) : (
          <ul>
            {list.map((c) => (
              <ChargeRow key={c.id} charge={c} today={today} templates={ctx.templates} pixKey={ctx.pixKey} businessName={ctx.businessName} />
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
