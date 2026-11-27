'use server'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'

const isDate = (s: string | null | undefined) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)

function refresh() {
  revalidatePath('/cobrancas')
  revalidatePath('/clientes', 'layout')
  revalidatePath('/')
}

export async function markPaidAction(id: string, date: string) {
  const { supabase } = await requireUser()
  if (!isDate(date)) return { error: 'Data inválida' }
  const { error } = await supabase.from('charges').update({ paid_at: date }).eq('id', id)
  if (error) return { error: 'Não foi possível registrar o pagamento' }
  refresh()
  return {}
}

export async function unmarkPaidAction(id: string) {
  const { supabase } = await requireUser()
  const { error } = await supabase.from('charges').update({ paid_at: null }).eq('id', id)
  if (error) return { error: 'Não foi possível desfazer' }
  refresh()
  return {}
}

export async function updateChargeAction(id: string, patch: { amount: number; due_date: string; notes: string | null }) {
  const { supabase } = await requireUser()
  if (!(patch.amount > 0) || !isDate(patch.due_date)) return { error: 'Valor ou vencimento inválido' }
  const { error } = await supabase
    .from('charges')
    .update({ amount: Math.round(patch.amount * 100) / 100, due_date: patch.due_date, notes: patch.notes?.trim() || null })
    .eq('id', id)
  if (error) return { error: 'Não foi possível salvar' }
  refresh()
  return {}
}

/** Implantação é apagada; mensalidade é anulada para não ser gerada de novo na mesma competência. */
export async function deleteChargeAction(id: string) {
  const { supabase } = await requireUser()
  const { data: charge } = await supabase.from('charges').select('type').eq('id', id).maybeSingle()
  if (!charge) return { error: 'Cobrança não encontrada' }
  const { error } =
    charge.type === 'monthly'
      ? await supabase.from('charges').update({ voided_at: new Date().toISOString() }).eq('id', id)
      : await supabase.from('charges').delete().eq('id', id)
  if (error) return { error: 'Não foi possível excluir' }
  refresh()
  return {}
}
