import 'server-only'
import type { Supabase } from '@/lib/supabase/server'
import { monthlyChargesToEnsure } from './charges'

/** Insere as mensalidades que faltam para todos os clientes (idempotente). Retorna quantas foram criadas. */
export async function ensureMonthlyCharges(supabase: Supabase, today: string, clientId?: string): Promise<number> {
  let q = supabase.from('clients').select('id, monthly_fee, due_day, start_date, status, canceled_at').gt('monthly_fee', 0)
  if (clientId) q = q.eq('id', clientId)
  const { data: clients, error } = await q
  if (error) throw new Error(error.message)
  const rows = (clients ?? []).flatMap((c) =>
    monthlyChargesToEnsure(
      {
        monthly_fee: Number(c.monthly_fee),
        due_day: c.due_day,
        start_date: c.start_date,
        status: c.status,
        canceled_at: c.canceled_at,
      },
      today,
    ).map((ch) => ({ ...ch, client_id: c.id })),
  )
  if (!rows.length) return 0
  const { data, error: upErr } = await supabase
    .from('charges')
    .upsert(rows, { onConflict: 'client_id,type,competence', ignoreDuplicates: true })
    .select('id')
  if (upErr) throw new Error(upErr.message)
  return data?.length ?? 0
}
