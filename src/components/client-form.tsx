'use client'
import { useActionState, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { monthlyChargesToEnsure } from '@/lib/billing/charges'
import { formatPhoneDigits, parseBRL, toInputBRL } from '@/lib/format'
import type { ClientFormState } from '@/app/(app)/clientes/actions'

type Defaults = {
  company?: string | null
  contact_name?: string | null
  phone?: string | null
  email?: string | null
  city?: string | null
  site_url?: string | null
  notes?: string | null
  setup_total?: number | null
  monthly_fee?: number | null
  due_day?: number | null
  start_date?: string | null
}

export function ClientForm({
  action,
  defaults,
  today,
  leadId,
  mode,
}: {
  action: (prev: ClientFormState, form: FormData) => Promise<ClientFormState>
  defaults: Defaults
  today: string
  leadId?: string
  mode: 'create' | 'edit'
}) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const [monthly, setMonthly] = useState(defaults.monthly_fee ? toInputBRL(defaults.monthly_fee) : '')
  const [dueDay, setDueDay] = useState(String(defaults.due_day ?? Math.min(28, Number(today.slice(8)))))
  const [start, setStart] = useState(defaults.start_date ?? today)

  const pastCount = useMemo(() => {
    const fee = parseBRL(monthly)
    const day = Number(dueDay)
    if (mode !== 'create' || !(fee > 0) || !(day >= 1 && day <= 28) || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return 0
    return monthlyChargesToEnsure({ monthly_fee: fee, due_day: day, start_date: start, status: 'active', canceled_at: null }, today).filter(
      (c) => c.due_date < today,
    ).length
  }, [monthly, dueDay, start, today, mode])

  return (
    <form action={formAction} className="space-y-5">
      {leadId && <input type="hidden" name="lead_id" value={leadId} />}
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">Dados do cliente</legend>
        <div className="sm:col-span-2">
          <Label htmlFor="company">Empresa</Label>
          <Input id="company" name="company" defaultValue={defaults.company ?? ''} required />
        </div>
        <div>
          <Label htmlFor="contact_name">Responsável</Label>
          <Input id="contact_name" name="contact_name" defaultValue={defaults.contact_name ?? ''} />
        </div>
        <div>
          <Label htmlFor="phone">WhatsApp</Label>
          <Input id="phone" name="phone" inputMode="tel" defaultValue={formatPhoneDigits(defaults.phone)} />
        </div>
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" defaultValue={defaults.email ?? ''} />
        </div>
        <div>
          <Label htmlFor="city">Cidade</Label>
          <Input id="city" name="city" defaultValue={defaults.city ?? ''} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="site_url">Site entregue</Label>
          <Input id="site_url" name="site_url" placeholder="https://" defaultValue={defaults.site_url ?? ''} />
        </div>
      </fieldset>

      {mode === 'create' && (
        <fieldset className="grid gap-4 sm:grid-cols-3">
          <legend className="mb-2 text-sm font-semibold">Implantação (criação do site)</legend>
          <div>
            <Label htmlFor="setup_total">Valor da implantação</Label>
            <Input id="setup_total" name="setup_total" inputMode="decimal" defaultValue={toInputBRL(defaults.setup_total)} placeholder="0,00" />
          </div>
          <div>
            <Label htmlFor="setup_installments">Parcelas</Label>
            <Input id="setup_installments" name="setup_installments" type="number" min={1} max={24} defaultValue={1} />
          </div>
          <div>
            <Label htmlFor="setup_first">1ª parcela em</Label>
            <Input id="setup_first" name="setup_first" type="date" defaultValue={today} />
          </div>
        </fieldset>
      )}

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold">Mensalidade</legend>
        <div>
          <Label htmlFor="monthly_fee">Mensalidade (R$)</Label>
          <Input id="monthly_fee" name="monthly_fee" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="0,00" />
        </div>
        <div>
          <Label htmlFor="due_day">Dia de vencimento</Label>
          <Input id="due_day" name="due_day" type="number" min={1} max={28} value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="start_date">Início da mensalidade</Label>
          <Input id="start_date" name="start_date" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        {mode === 'edit' && <p className="text-xs text-zinc-500 sm:col-span-3">Mudanças valem para as próximas cobranças; as já geradas não mudam.</p>}
      </fieldset>

      <div>
        <Label htmlFor="notes">Observações</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={defaults.notes ?? ''} />
      </div>

      {pastCount > 0 && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Serão criadas {pastCount} mensalidades passadas (início antes de hoje). Elas aparecerão como atrasadas até você marcar como pagas.
        </p>
      )}
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {mode === 'create' ? 'Salvar cliente' : 'Salvar alterações'}
      </Button>
    </form>
  )
}
