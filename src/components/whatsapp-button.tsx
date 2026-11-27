'use client'
import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Label, Select, Textarea } from '@/components/ui/input'
import { renderTemplate, whatsappUrl } from '@/lib/messages'
import type { MessageTemplate } from '@/lib/types'

export function WhatsAppButton({
  digits,
  templates,
  vars,
  onSent,
  label = 'Chamar no WhatsApp',
  size = 'default',
}: {
  digits: string | null
  templates: MessageTemplate[]
  vars: Record<string, string | number | null | undefined>
  onSent?: (templateName: string) => Promise<void> | void
  label?: string
  size?: 'default' | 'sm'
}) {
  const [open, setOpen] = useState(false)
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '')
  const template = templates.find((t) => t.id === templateId)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  function openDialog() {
    const t = templates.find((x) => x.id === templateId) ?? templates[0]
    setText(t ? renderTemplate(t.body, vars) : '')
    setOpen(true)
  }

  async function send() {
    if (!digits) return
    window.open(whatsappUrl(digits, text), '_blank', 'noopener')
    setBusy(true)
    try {
      await onSent?.(template?.name ?? 'Mensagem livre')
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  return (
    <>
      <Button variant="whatsapp" size={size} onClick={openDialog} disabled={!digits} title={digits ? undefined : 'Sem telefone'}>
        <MessageCircle className="h-4 w-4" /> {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="WhatsApp">
        <div className="space-y-3">
          {templates.length > 0 && (
            <div>
              <Label htmlFor="wa-template">Modelo</Label>
              <Select
                id="wa-template"
                value={templateId}
                onChange={(e) => {
                  setTemplateId(e.target.value)
                  const t = templates.find((x) => x.id === e.target.value)
                  setText(t ? renderTemplate(t.body, vars) : '')
                }}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="wa-text">Mensagem</Label>
            <Textarea id="wa-text" rows={7} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <Button variant="whatsapp" className="w-full" onClick={send} disabled={busy || !text.trim()}>
            <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
          </Button>
        </div>
      </Dialog>
    </>
  )
}
