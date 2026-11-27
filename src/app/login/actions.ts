'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signIn(_prev: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: 'E-mail ou senha inválidos' }
  redirect('/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function signUp(_prev: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')
  if (password.length < 8) return { error: 'A senha precisa ter pelo menos 8 caracteres' }
  if (password !== confirm) return { error: 'As senhas não conferem' }
  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({ email, password })
  if (error) {
    if (/already registered|already exists/i.test(error.message)) return { error: 'Esse e-mail já tem conta. Volte e entre.' }
    if (/database error|não autorizado/i.test(error.message)) return { error: 'Este e-mail não está autorizado a criar conta.' }
    return { error: 'Não foi possível criar a conta. Tente de novo.' }
  }
  const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
  if (loginError) return { error: 'Conta criada. Entre com seu e-mail e senha.' }
  redirect('/')
}
