'use client'
import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { toInputBRL } from '@/lib/format'
import { TEMPLATE_KIND_LABEL, type TemplateKind } from '@/lib/messages'
import type { MessageTemplate, Settings } from '@/lib/types'
import { changePasswordAction, createTemplateAction, deleteTemplateAction, saveSettingsAction, saveTemplateAction } from './actions'

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, action, pending] = useActionState(saveSettingsAction, undefined)
  useEffect(() => {
    if (state?.ok) toast.success('Configurações salvas')
    if (state?.error) toast.error(state.error)
  }, [state])
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor="business_name">Nome do negócio</Label>
        <Input id="business_name" name="business_name" defaultValue={settings.business_name ?? ''} />
      </div>
      <div>
        <Label htmlFor="pix_key">Chave Pix</Label>
        <Input id="pix_key" name="pix_key" defaultValue={settings.pix_key ?? ''} />
      </div>
      <div>
        <Label htmlFor="default_setup_price">Preço padrão da implantação (R$)</Label>
        <Input id="default_setup_price" name="default_setup_price" inputMode="decimal" defaultValue={toInputBRL(settings.default_setup_price)} />
      </div>
      <div>
        <Label htmlFor="default_monthly_price">Mensalidade padrão (R$)</Label>
        <Input id="default_monthly_price" name="default_monthly_price" inputMode="decimal" defaultValue={toInputBRL(settings.default_monthly_price)} />
      </div>
      <div>
        <Label htmlFor="google_price_per_request">Custo por busca no Google (US$)</Label>
        <Input id="google_price_per_request" name="google_price_per_request" inputMode="decimal" defaultValue={settings.google_price_per_request} />
      </div>
      <div>
        <Label htmlFor="google_monthly_alert">Avisar a partir de quantas buscas no mês</Label>
        <Input id="google_monthly_alert" name="google_monthly_alert" type="number" min={1} defaultValue={settings.google_monthly_alert} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          Salvar configurações
        </Button>
      </div>
    </form>
  )
}

function TemplateEditor({ t }: { t: MessageTemplate }) {
  const router = useRouter()
  const [name, setName] = useState(t.name)
  const [body, setBody] = useState(t.body)
  const [pending, start] = useTransition()
  return (
    <div data-testid="template" className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-center gap-2">
        <Badge tone="blue">{TEMPLATE_KIND_LABEL[t.kind]}</Badge>
        <Input aria-label="Nome do modelo" value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
        <Button
          size="icon"
          variant="ghost"
          aria-label="Excluir modelo"
          onClick={() => {
            if (confirm('Excluir este modelo?'))
              start(async () => {
                await deleteTemplateAction(t.id)
                router.refresh()
              })
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <Label htmlFor={`body-${t.id}`} className="sr-only">
        Texto
      </Label>
      <Textarea id={`body-${t.id}`} aria-label="Texto" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await saveTemplateAction(t.id, name, body)
            if (r?.error) toast.error(r.error)
            else toast.success('Modelo salvo')
          })
        }
      >
        Salvar modelo
      </Button>
    </div>
  )
}

export function Templates({ templates }: { templates: MessageTemplate[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <div className="space-y-3">
      {templates.map((t) => (
        <TemplateEditor key={t.id} t={t} />
      ))}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(TEMPLATE_KIND_LABEL) as TemplateKind[]).map((k) => (
          <Button
            key={k}
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await createTemplateAction(k)
                router.refresh()
              })
            }
          >
            <Plus className="h-4 w-4" /> {TEMPLATE_KIND_LABEL[k]}
          </Button>
        ))}
      </div>
    </div>
  )
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, undefined)
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state?.ok) {
      toast.success('Senha alterada')
      formRef.current?.reset()
    }
  }, [state])
  return (
    <form ref={formRef} action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div>
        <Label htmlFor="new-password">Nova senha</Label>
        <Input id="new-password" name="password" type="password" autoComplete="new-password" required />
      </div>
      <div>
        <Label htmlFor="confirm-password">Repita a nova senha</Label>
        <Input id="confirm-password" name="confirm" type="password" autoComplete="new-password" required />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        Trocar senha
      </Button>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600 sm:col-span-3">
          {state.error}
        </p>
      )}
    </form>
  )
}
