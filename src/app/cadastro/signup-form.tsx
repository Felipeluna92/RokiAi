'use client'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { signUp } from '../login/actions'

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, undefined)
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <Label htmlFor="password">Senha</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <div>
        <Label htmlFor="confirm">Repita a senha</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      {state?.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Criando…' : 'Criar conta'}
      </Button>
    </form>
  )
}
