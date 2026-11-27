import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from './supabase/server'

/** Garante sessão; devolve o cliente Supabase e o usuário. */
export async function requireUser() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return { supabase, user: data.user }
}
