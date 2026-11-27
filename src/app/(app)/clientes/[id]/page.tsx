import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ChargeRow } from '@/components/charge-row'
import { Badge } from '@/components/ui/badge'
import { Card, CardTitle } from '@/components/ui/card'
import { requireUser } from '@/lib/auth'
import { billingContext, fetchCharges } from '@/lib/billing/context'
import { ensureMonthlyCharges } from '@/lib/billing/ensure'
import { formatBRL, formatDate, formatPhoneDigits, todayInSaoPaulo } from '@/lib/format'
import type { Client } from '@/lib/types'
import { ClientActions } from './client-actions'

export default async function ClientPage({ params }: PageProps<'/clientes/[id]'>) {
  const { id } = await params
  const { supabase } = await requireUser()
  const today = todayInSaoPaulo()
  await ensureMonthlyCharges(supabase, today, id)
  const [{ data: client }, list, ctx] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).maybeSingle(),
    fetchCharges(supabase, { clientId: id, ascending: false }),
    billingContext(supabase),
  ])
  if (!client) notFound()
  const c = client as Client
  const paid = list.filter((x) => x.paid_at).reduce((s, x) => s + Number(x.amount), 0)
  const open = list.filter((x) => !x.paid_at).reduce((s, x) => s + Number(x.amount), 0)

  return (
    <div className="space-y-4">
      <Link href="/clientes" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Clientes
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{c.company}</h1>
          <p className="text-sm text-zinc-500">{[c.contact_name, formatPhoneDigits(c.phone), c.city].filter(Boolean).join(' · ')}</p>
          {c.status === 'canceled' && (
            <Badge tone="gray" className="mt-1">
              Cancelado em {formatDate(c.canceled_at!)}
            </Badge>
          )}
        </div>
        <ClientActions client={c} today={today} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-zinc-500">Mensalidade</p>
          <p className="text-xl font-semibold tabular-nums">{formatBRL(Number(c.monthly_fee))}</p>
          {c.due_day && <p className="text-xs text-zinc-500">vence todo dia {c.due_day}</p>}
        </Card>
        <Card>
          <p className="text-xs text-zinc-500">Total recebido</p>
          <p className="text-xl font-semibold tabular-nums">{formatBRL(paid)}</p>
        </Card>
        <Card>
          <p className="text-xs text-zinc-500">Em aberto</p>
          <p className="text-xl font-semibold tabular-nums">{formatBRL(open)}</p>
        </Card>
      </div>

      <Card>
        <CardTitle>Cobranças</CardTitle>
        {list.length === 0 ? (
          <p className="py-6 text-sm text-zinc-500">Nenhuma cobrança.</p>
        ) : (
          <ul>
            {list.map((ch) => (
              <ChargeRow key={ch.id} charge={ch} today={today} templates={ctx.templates} pixKey={ctx.pixKey} businessName={ctx.businessName} showClient={false} />
            ))}
          </ul>
        )}
      </Card>

      {(c.site_url || c.email || c.notes || c.lead_id) && (
        <Card className="space-y-1 text-sm">
          {c.site_url && (
            <p>
              Site:{' '}
              <a href={c.site_url} target="_blank" rel="noreferrer" className="underline">
                {c.site_url}
              </a>
            </p>
          )}
          {c.email && <p>E-mail: {c.email}</p>}
          {c.notes && <p className="whitespace-pre-wrap">{c.notes}</p>}
          {c.lead_id && (
            <Link href={`/leads/${c.lead_id}`} className="underline">
              Ver histórico do lead
            </Link>
          )}
        </Card>
      )}
    </div>
  )
}
