'use client'
import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { CATEGORIES } from '@/lib/prospect/categories'
import { createLeadAction } from '../actions'

export function NewLeadForm() {
  const [state, action, pending] = useActionState(createLeadAction, undefined)
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="name">Nome da empresa</Label>
        <Input id="name" name="name" required />
      </div>
      <div>
        <Label htmlFor="phone">Telefone / WhatsApp</Label>
        <Input id="phone" name="phone" inputMode="tel" placeholder="(19) 99999-9999" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="city">Cidade</Label>
          <Input id="city" name="city" />
        </div>
        <div>
          <Label htmlFor="category">Categoria</Label>
          <Input id="category" name="category" list="categories" />
          <datalist id="categories">
            {CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </div>
      <div>
        <Label htmlFor="note">Anotação (opcional)</Label>
        <Textarea id="note" name="note" rows={3} />
      </div>
      {state?.error && (
        <div role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {state.error}{' '}
          {state.existing && (
            <Link
              className="font-medium underline"
              href={state.existing.kind === 'lead' ? `/leads/${state.existing.id}` : `/clientes/${state.existing.id}`}
            >
              Abrir {state.existing.name}
            </Link>
          )}
        </div>
      )}
      <Button type="submit" disabled={pending}>
        Salvar lead
      </Button>
    </form>
  )
}
