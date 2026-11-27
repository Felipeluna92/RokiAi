'use server'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'

const money = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim().replace(/\./g, '').replace(',', '.')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}

export async function saveSettingsAction(_prev: { ok?: boolean; error?: string } | undefined, form: FormData) {
  const { supabase } = await requireUser()
  const price = Number(String(form.get('google_price_per_request') ?? '').replace(',', '.'))
  const alert = Math.floor(Number(form.get('google_monthly_alert')))
  const { error } = await supabase
    .from('settings')
    .update({
      business_name: String(form.get('business_name') ?? '').trim() || null,
      pix_key: String(form.get('pix_key') ?? '').trim() || null,
      default_setup_price: money(form.get('default_setup_price')),
      default_monthly_price: money(form.get('default_monthly_price')),
      google_price_per_request: Number.isFinite(price) && price >= 0 ? price : 0.035,
      google_monthly_alert: Number.isFinite(alert) && alert > 0 ? alert : 1000,
    })
    .not('id', 'is', null)
  if (error) return { error: 'Não foi possível salvar.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function saveTemplateAction(id: string, name: string, body: string) {
  const { supabase } = await requireUser()
  if (!name.trim() || !body.trim()) return { error: 'Preencha nome e texto.' }
  await supabase.from('message_templates').update({ name: name.trim(), body }).eq('id', id)
  revalidatePath('/configuracoes')
  return {}
}

export async function createTemplateAction(kind: 'approach' | 'followup' | 'charge') {
  const { supabase } = await requireUser()
  await supabase.from('message_templates').insert({ kind, name: 'Novo modelo', body: 'Olá! ' })
  revalidatePath('/configuracoes')
}

export async function deleteTemplateAction(id: string) {
  const { supabase } = await requireUser()
  await supabase.from('message_templates').delete().eq('id', id)
  revalidatePath('/configuracoes')
}
