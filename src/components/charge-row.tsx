'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, MoreVertical, Pencil, Trash2, Undo2 } from 'lucide-react'
import { Badge, type Tone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label, Textarea } from '@/components/ui/input'
import { WhatsAppButton } from '@/components/whatsapp-button'
import { STATUS_LABEL, chargeStatus, type ChargeStatus } from '@/lib/billing/status'
import { formatBRL, formatDate, parseBRL, toInputBRL } from '@/lib/format'
import type { Charge, MessageTemplate } from '@/lib/types'
import { deleteChargeAction, markPaidAction, unmarkPaidAction, updateChargeAction } from '@/app/(app)/cobrancas/actions'

const TONE: Record<ChargeStatus, Tone> = { paga: 'green', a_vencer: 'gray', vence_hoje: 'yellow', atrasada: 'red' }

export type ChargeWithClient = Charge & {
  client: { id: string; company: string; contact_name: string | null; phone: string | null } | null
}

export function ChargeRow({
  charge,
  today,
  templates,
  pixKey,
  businessName,
  showClient = true,
}: {
  charge: ChargeWithClient
  today: string
  templates: MessageTemplate[]
  pixKey: string | null
  businessName: string | null
  showClient?: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [payOpen, setPayOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [payDate, setPayDate] = useState(today)
  const [amount, setAmount] = useState(toInputBRL(charge.amount))
  const [due, setDue] = useState(charge.due_date)
  const [notes, setNotes] = useState(charge.notes ?? '')
  const [err, setErr] = useState('')
  const status = chargeStatus(charge, today)

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      const r = (await fn()) as { error?: string } | void
      if (r && r.error) toast.error(r.error)
      router.refresh()
    })

  return (
    <li data-testid="charge-row" className="flex flex-col gap-2 border-b border-zinc-100 py-3 last:border-0 sm:flex-row sm:items-center dark:border-zinc-800">
      <div className="min-w-0 flex-1">
        {showClient && charge.client && (
          <Link href={`/clientes/${charge.client.id}`} className="font-medium hover:underline">
            {charge.client.company}
          </Link>
        )}
        <p className={showClient ? 'text-sm text-zinc-600 dark:text-zinc-400' : 'font-medium'}>
          {charge.description}
          {charge.notes && <span className="text-zinc-400"> · {charge.notes}</span>}
        </p>
        <p className="text-xs text-zinc-500">
          Vence {formatDate(charge.due_date)}
          {charge.paid_at && ` · pago em ${formatDate(charge.paid_at)}`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold tabular-nums">{formatBRL(Number(charge.amount))}</span>
        <Badge tone={TONE[status]}>{STATUS_LABEL[status]}</Badge>
        {status === 'paga' ? (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => unmarkPaidAction(charge.id))}>
            <Undo2 className="h-4 w-4" /> Desfazer
          </Button>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={() => (setPayDate(today), setPayOpen(true))}>
              <Check className="h-4 w-4" /> Marcar como paga
            </Button>
            <WhatsAppButton
              size="sm"
              label="Cobrar"
              digits={charge.client?.phone ?? null}
              templates={templates}
              vars={{
                nome_empresa: businessName ?? '',
                responsavel: charge.client?.contact_name ?? charge.client?.company ?? '',
                valor: formatBRL(Number(charge.amount)),
                vencimento: formatDate(charge.due_date),
                chave_pix: pixKey ?? '',
              }}
            />
          </>
        )}
        <div className="relative">
          <Button size="icon" variant="ghost" aria-label="Mais ações" onClick={() => setMenuOpen((o) => !o)}>
            <MoreVertical className="h-4 w-4" />
          </Button>
          {menuOpen && (
            <div className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => (setMenuOpen(false), setEditOpen(true))}>
                <Pencil className="h-4 w-4" /> Editar
              </button>
              <button
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-red-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => {
                  setMenuOpen(false)
                  if (confirm(`Excluir "${charge.description}"?`)) run(() => deleteChargeAction(charge.id))
                }}
              >
                <Trash2 className="h-4 w-4" /> Excluir
              </button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={payOpen} onClose={() => setPayOpen(false)} title="Registrar pagamento">
        <div className="space-y-3">
          <p className="text-sm">
            {charge.description} · <strong>{formatBRL(Number(charge.amount))}</strong>
          </p>
          <div>
            <Label htmlFor={`pay-${charge.id}`}>Data do pagamento</Label>
            <Input id={`pay-${charge.id}`} type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          </div>
          <Button
            className="w-full"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const r = await markPaidAction(charge.id, payDate)
                if (!r?.error) setPayOpen(false)
                return r
              })
            }
          >
            Confirmar pagamento
          </Button>
        </div>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="Editar cobrança">
        <div className="space-y-3">
          <div>
            <Label htmlFor={`amt-${charge.id}`}>Valor (R$)</Label>
            <Input id={`amt-${charge.id}`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label htmlFor={`due-${charge.id}`}>Vencimento</Label>
            <Input id={`due-${charge.id}`} type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <div>
            <Label htmlFor={`notes-${charge.id}`}>Observação</Label>
            <Textarea id={`notes-${charge.id}`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <Button
            className="w-full"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const r = await updateChargeAction(charge.id, { amount: parseBRL(amount), due_date: due, notes })
                if (r?.error) return void setErr(r.error)
                setEditOpen(false)
              })
            }
          >
            Salvar
          </Button>
        </div>
      </Dialog>
    </li>
  )
}
