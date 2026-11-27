'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MessageCircle, StickyNote, ArrowRightLeft, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label, Select, Textarea } from '@/components/ui/input'
import { WhatsAppButton } from '@/components/whatsapp-button'
import { STAGE_LABEL, STAGES, type Stage } from '@/lib/billing/metrics'
import type { LeadEvent, MessageTemplate } from '@/lib/types'
import { addLeadNoteAction, logWhatsappAction, setNextContactAction, updateLeadStageAction } from '../actions'

export function StageSelect({ id, stage }: { id: string; stage: Stage }) {
  const router = useRouter()
  const [value, setValue] = useState<Stage>(stage)
  const [lostOpen, setLostOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')
  const [pending, start] = useTransition()

  function change(next: Stage) {
    if (next === 'fechado') return router.push(`/clientes/novo?lead=${id}`)
    if (next === 'perdido') {
      setErr('')
      return setLostOpen(true)
    }
    setValue(next)
    start(async () => {
      await updateLeadStageAction(id, next)
      router.refresh()
    })
  }

  function confirmLost() {
    if (!reason.trim()) return setErr('Informe o motivo')
    start(async () => {
      const r = await updateLeadStageAction(id, 'perdido', reason)
      if (r?.error) return setErr(r.error)
      setValue('perdido')
      setLostOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="w-48">
      <Label htmlFor="stage">Estágio</Label>
      <Select id="stage" value={value} disabled={pending} onChange={(e) => change(e.target.value as Stage)}>
        {STAGES.map((s) => (
          <option key={s} value={s}>
            {STAGE_LABEL[s]}
          </option>
        ))}
      </Select>
      <Dialog open={lostOpen} onClose={() => setLostOpen(false)} title="Marcar como perdido">
        <div className="space-y-3">
          <div>
            <Label htmlFor="lost-reason">Motivo da perda</Label>
            <Textarea id="lost-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <Button onClick={confirmLost} disabled={pending} className="w-full">
            Confirmar
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

export function LeadActions({
  lead,
  templates,
}: {
  lead: {
    id: string
    phone: string | null
    name: string
    city: string | null
    category: string | null
    rating: number | null
    ratings_count: number | null
  }
  templates: MessageTemplate[]
}) {
  const router = useRouter()
  return (
    <WhatsAppButton
      digits={lead.phone}
      templates={templates}
      vars={{
        nome_empresa: lead.name,
        cidade: lead.city,
        categoria: lead.category,
        nota: lead.rating != null ? Number(lead.rating).toFixed(1).replace('.', ',') : null,
        avaliacoes: lead.ratings_count,
      }}
      onSent={async (name) => {
        await logWhatsappAction(lead.id, name)
        router.refresh()
      }}
    />
  )
}

export function NoteForm({ id }: { id: string }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [pending, start] = useTransition()
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          await addLeadNoteAction(id, text)
          setText('')
          router.refresh()
        })
      }}
    >
      <Label htmlFor="note">Nova anotação</Label>
      <Textarea id="note" rows={2} value={text} onChange={(e) => setText(e.target.value)} />
      <Button type="submit" size="sm" variant="outline" disabled={pending || !text.trim()}>
        Adicionar
      </Button>
    </form>
  )
}

export function NextContactForm({ id, value }: { id: string; value: string | null }) {
  const router = useRouter()
  const [date, setDate] = useState(value ?? '')
  const [pending, start] = useTransition()
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          await setNextContactAction(id, date || null)
          toast.success(date ? 'Próximo contato salvo' : 'Próximo contato removido')
          router.refresh()
        })
      }}
    >
      <div className="flex-1">
        <Label htmlFor="next-contact">Próximo contato</Label>
        <Input id="next-contact" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        Salvar data
      </Button>
    </form>
  )
}

const dt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })

export function Timeline({ events, createdAt, source }: { events: LeadEvent[]; createdAt: string; source: string }) {
  const icon = { note: StickyNote, whatsapp: MessageCircle, stage_change: ArrowRightLeft }
  const title = { note: 'Anotação', whatsapp: 'WhatsApp enviado', stage_change: 'Mudança de estágio' }
  return (
    <ol className="space-y-3">
      {events.map((e) => {
        const Icon = icon[e.type]
        return (
          <li key={e.id} className="flex gap-3">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{title[e.type]}</p>
              {e.body && <p className="text-sm whitespace-pre-wrap text-zinc-600 dark:text-zinc-300">{e.body}</p>}
              <p className="text-xs text-zinc-400">{dt.format(new Date(e.created_at))}</p>
            </div>
          </li>
        )
      })}
      <li className="flex gap-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
        <div>
          <p className="text-sm font-medium">Lead criado {source === 'google' ? 'pela prospecção' : 'manualmente'}</p>
          <p className="text-xs text-zinc-400">{dt.format(new Date(createdAt))}</p>
        </div>
      </li>
    </ol>
  )
}
