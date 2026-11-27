import Link from 'next/link'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { buttonClass } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { requireUser } from '@/lib/auth'
import { formatBRL, formatPhoneDigits, todayInSaoPaulo } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Client } from '@/lib/types'

export const metadata = { title: 'Clientes · RokiAi' }

export default async function ClientsPage({ searchParams }: PageProps<'/clientes'>) {
  const sp = await searchParams
  const view = sp.status === 'canceled' ? 'canceled' : 'active'
  const { supabase } = await requireUser()
  const today = todayInSaoPaulo()
  const [{ data: clients }, { data: overdue }] = await Promise.all([
    supabase.from('clients').select('*').order('company'),
    supabase.from('charges').select('client_id').is('paid_at', null).lt('due_date', today),
  ])
  const all = (clients ?? []) as Client[]
  const debtors = new Set((overdue ?? []).map((c) => c.client_id))
  const list = all.filter((c) => c.status === view)
  const activeCount = all.filter((c) => c.status === 'active').length

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={`${activeCount} ativos`}
        actions={
          <Link href="/clientes/novo" className={buttonClass()}>
            <Plus className="h-4 w-4" /> Novo cliente
          </Link>
        }
      />
      <nav aria-label="Filtrar clientes" className="mb-4 flex gap-2">
        {(['active', 'canceled'] as const).map((s) => (
          <Link
            key={s}
            href={s === 'active' ? '/clientes' : '/clientes?status=canceled'}
            className={cn(
              'rounded-full border px-3 py-1 text-sm',
              view === s ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900' : 'border-zinc-300 dark:border-zinc-700',
            )}
          >
            {s === 'active' ? 'Ativos' : 'Cancelados'} <span className="opacity-70">{all.filter((c) => c.status === s).length}</span>
          </Link>
        ))}
      </nav>
      {list.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">
          {view === 'active' ? 'Nenhum cliente ainda. Feche um lead para começar!' : 'Nenhum cliente cancelado.'}
        </p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {list.map((c) => (
            <Card key={c.id} data-testid="client-row" className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <Link href={`/clientes/${c.id}`} className="font-medium hover:underline">
                  {c.company}
                </Link>
                <p className="text-xs text-zinc-500">
                  {[c.contact_name, formatPhoneDigits(c.phone), c.city].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-semibold tabular-nums">{formatBRL(Number(c.monthly_fee))}/mês</span>
                {debtors.has(c.id) && <Badge tone="red">Inadimplente</Badge>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
