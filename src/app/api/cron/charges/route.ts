import { createClient } from '@supabase/supabase-js'

/**
 * Chamado diariamente pela Vercel Cron. Mantém o projeto Supabase ativo
 * (o plano gratuito pausa após inatividade). As mensalidades são geradas
 * quando o dono abre o painel, com a sessão dele.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  })
  const { error } = await sb.from('settings').select('id').limit(1)
  return Response.json({ ok: !error })
}
