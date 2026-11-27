import Link from 'next/link'
import { SignUpForm } from './signup-form'

export const metadata = { title: 'Criar conta · RokiAi' }

export default function SignUpPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-1 text-2xl font-bold">Criar conta</h1>
        <p className="mb-6 text-sm text-zinc-500">Somente e-mails autorizados podem se cadastrar.</p>
        <SignUpForm />
        <p className="mt-4 text-center text-sm text-zinc-500">
          Já tem conta?{' '}
          <Link href="/login" className="underline">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  )
}
