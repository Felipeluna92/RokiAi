'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, RotateCcw, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/input'
import { ClientForm } from '@/components/client-form'
import type { Client } from '@/lib/types'
import { cancelClientAction, reactivateClientAction, updateClientAction } from '../actions'

export function ClientActions({ client, today }: { client: Client; today: string }) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reactivateOpen, setReactivateOpen] = useState(false)
  const [resumeDate, setResumeDate] = useState(today)
  const [date, setDate] = useState(today)
  const [pending, start] = useTransition()

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
        <Pencil className="h-4 w-4" /> Editar
      </Button>
      {client.status === 'active' ? (
        <Button variant="ghost" size="sm" onClick={() => setCancelOpen(true)}>
          <XCircle className="h-4 w-4" /> Cancelar cliente
        </Button>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setReactivateOpen(true)}>
          <RotateCcw className="h-4 w-4" /> Reativar
        </Button>
      )}

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="Editar cliente">
        <ClientForm
          mode="edit"
          today={today}
          action={async (prev, form) => {
            const r = await updateClientAction(client.id, prev, form)
            if (!r?.error) {
              setEditOpen(false)
              router.refresh()
            }
            return r
          }}
          defaults={client}
        />
      </Dialog>

      <Dialog open={reactivateOpen} onClose={() => setReactivateOpen(false)} title="Reativar cliente">
        <div className="space-y-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Os meses em que o cliente ficou cancelado não serão cobrados.</p>
          <div>
            <Label htmlFor="resume-date">Retomar cobrança a partir de</Label>
            <Input id="resume-date" type="date" value={resumeDate} onChange={(e) => setResumeDate(e.target.value)} />
          </div>
          <Button
            className="w-full"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await reactivateClientAction(client.id, resumeDate)
                if (r?.error) return void toast.error(r.error)
                setReactivateOpen(false)
                router.refresh()
              })
            }
          >
            Confirmar reativação
          </Button>
        </div>
      </Dialog>

      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancelar cliente">
        <div className="space-y-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            As mensalidades não pagas com vencimento depois dessa data serão removidas. O histórico fica guardado.
          </p>
          <div>
            <Label htmlFor="cancel-date">Data do cancelamento</Label>
            <Input id="cancel-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Button
            variant="destructive"
            className="w-full"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await cancelClientAction(client.id, date)
                if (r?.error) return void toast.error(r.error)
                setCancelOpen(false)
                router.refresh()
              })
            }
          >
            Confirmar cancelamento
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
