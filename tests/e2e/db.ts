import { createClient } from '@supabase/supabase-js'

/** Cliente autenticado como o usuário de teste, para limpar dados entre testes. */
export async function testDb() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  })
  const { error } = await sb.auth.signInWithPassword({ email: process.env.E2E_EMAIL!, password: process.env.E2E_PASSWORD! })
  if (error) throw error
  return sb
}

export async function resetData() {
  const sb = await testDb()
  for (const t of ['charges', 'clients', 'lead_events', 'leads', 'place_marks', 'api_usage']) {
    const { error } = await sb.from(t).delete().not('id', 'is', null)
    if (error) throw error
  }
  return sb
}
