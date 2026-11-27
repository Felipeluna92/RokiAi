import Link from 'next/link'
import { LoginForm } from './login-form'

export const metadata = { title: 'Entrar · RokiAi' }

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-1 text-2xl font-bold">RokiAi</h1>
        <p className="mb-6 text-sm text-zinc-500">Entre para acessar seu painel.</p>
        <LoginForm />
        <p className="mt-4 text-center text-sm text-zinc-500">
          Primeiro acesso?{' '}
          <Link href="/cadastro" className="underline">
            Criar conta
          </Link>
        </p>
      </div>
    </main>
  )
}
