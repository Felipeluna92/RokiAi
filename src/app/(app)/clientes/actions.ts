'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { buildSetupCharges } from '@/lib/billing/charges'
import { ensureMonthlyCharges } from '@/lib/billing/ensure'
import { parseBRL, todayInSaoPaulo } from '@/lib/format'
import { normalizePhone } from '@/lib/prospect/phone'

export type ClientFormState = { error?: string } | undefined

const num = (v: FormDataEntryValue | null) => parseBRL(String(v ?? ''))
const str = (v: FormDataEntryValue | null) => String(v ?? '').trim() || null
const isDate = (s: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)

function parsePlan(form: FormData) {
  const setup_total = num(form.get('setup_total'))
  const setup_installments = Math.max(1, Math.floor(num(form.get('setup_installments')) || 1))
  const monthly_fee = num(form.get('monthly_fee'))
  const due_day = Math.floor(num(form.get('due_day')))
  const start_date = str(form.get('start_date'))
  const setup_first = str(form.get('setup_first'))
  if ([setup_total, monthly_fee].some(Number.isNaN) || setup_total < 0 || monthly_fee < 0) return { error: 'Valores inválidos.' }
  if (monthly_fee > 0 && (!(due_day >= 1 && due_day <= 28) || !isDate(start_date)))
    return { error: 'Informe dia de vencimento (1 a 28) e início da mensalidade.' }
  if (setup_total > 0 && !isDate(setup_first)) return { error: 'Informe a data da 1ª parcela.' }
  if (setup_installments > 24) return { error: 'Máximo de 24 parcelas.' }
  return { setup_total, setup_installments, monthly_fee, due_day: monthly_fee > 0 ? due_day : null, start_date: monthly_fee > 0 ? start_date : null, setup_first }
}

export async function createClientAction(_prev: ClientFormState, form: FormData): Promise<ClientFormState> {
  const { supabase } = await requireUser()
  const company = str(form.get('company'))
  if (!company) return { error: 'Informe o nome da empresa.' }
  const rawPhone = str(form.get('phone'))
  const phone = rawPhone ? normalizePhone(rawPhone) : null
  if (rawPhone && !phone) return { error: 'WhatsApp inválido. Use DDD + número.' }
  const plan = parsePlan(form)
  if ('error' in plan) return { error: plan.error }
  const leadId = str(form.get('lead_id'))

  const { data: client, error } = await supabase
    .from('clients')
    .insert({
      lead_id: leadId,
      company,
      contact_name: str(form.get('contact_name')),
      phone: phone?.digits ?? null,
      email: str(form.get('email')),
      city: str(form.get('city')),
      site_url: str(form.get('site_url')),
      notes: str(form.get('notes')),
      setup_total: plan.setup_total,
      setup_installments: plan.setup_installments,
      monthly_fee: plan.monthly_fee,
      due_day: plan.due_day,
      start_date: plan.start_date,
    })
    .select('id')
    .single()
  if (error) return { error: 'Não foi possível salvar o cliente.' }

  const setup = plan.setup_total > 0 ? buildSetupCharges(plan.setup_total, plan.setup_installments, plan.setup_first!) : []
  try {
    if (setup.length) {
      const { error: setupErr } = await supabase.from('charges').insert(setup.map((c) => ({ ...c, client_id: client.id })))
      if (setupErr) throw new Error(setupErr.message)
    }
    await ensureMonthlyCharges(supabase, todayInSaoPaulo(), client.id)
  } catch {
    // desfaz para não deixar cliente sem cobranças (e evitar duplicata ao reenviar)
    await supabase.from('clients').delete().eq('id', client.id)
    return { error: 'Não foi possível gerar as cobranças. Nada foi salvo; tente de novo.' }
  }

  if (leadId) {
    const { data: lead } = await supabase.from('leads').select('stage, contacted_at').eq('id', leadId).maybeSingle()
    if (lead && lead.stage !== 'fechado') {
      await supabase
        .from('leads')
        .update({ stage: 'fechado', contacted_at: lead.contacted_at ?? new Date().toISOString(), lost_reason: null })
        .eq('id', leadId)
      await supabase.from('lead_events').insert({ lead_id: leadId, type: 'stage_change', body: 'Fechado · virou cliente' })
    }
  }
  revalidatePath('/clientes')
  redirect(`/clientes/${client.id}`)
}

export async function updateClientAction(id: string, _prev: ClientFormState, form: FormData): Promise<ClientFormState> {
  const { supabase } = await requireUser()
  const company = str(form.get('company'))
  if (!company) return { error: 'Informe o nome da empresa.' }
  const rawPhone = str(form.get('phone'))
  const phone = rawPhone ? normalizePhone(rawPhone) : null
  if (rawPhone && !phone) return { error: 'WhatsApp inválido. Use DDD + número.' }
  const monthly_fee = num(form.get('monthly_fee'))
  const due_day = Math.floor(num(form.get('due_day')))
  const start_date = str(form.get('start_date'))
  if (Number.isNaN(monthly_fee) || monthly_fee < 0) return { error: 'Mensalidade inválida.' }
  if (monthly_fee > 0 && (!(due_day >= 1 && due_day <= 28) || !isDate(start_date)))
    return { error: 'Informe dia de vencimento (1 a 28) e início da mensalidade.' }
  const { error } = await supabase
    .from('clients')
    .update({
      company,
      contact_name: str(form.get('contact_name')),
      phone: phone?.digits ?? null,
      email: str(form.get('email')),
      city: str(form.get('city')),
      site_url: str(form.get('site_url')),
      notes: str(form.get('notes')),
      monthly_fee,
      due_day: monthly_fee > 0 ? due_day : null,
      start_date: monthly_fee > 0 ? start_date : null,
    })
    .eq('id', id)
  if (error) return { error: 'Não foi possível salvar.' }
  await ensureMonthlyCharges(supabase, todayInSaoPaulo(), id)
  revalidatePath(`/clientes/${id}`)
  return {}
}

export async function cancelClientAction(id: string, date: string) {
  const { supabase } = await requireUser()
  if (!isDate(date)) return { error: 'Data inválida' }
  const { error } = await supabase.from('clients').update({ status: 'canceled', canceled_at: date }).eq('id', id)
  if (error) return { error: 'Não foi possível cancelar' }
  await supabase.from('charges').delete().eq('client_id', id).eq('type', 'monthly').is('paid_at', null).gt('due_date', date)
  revalidatePath(`/clientes/${id}`)
  revalidatePath('/clientes')
  return {}
}

/** Reativa e retoma a cobrança a partir de `date` (meses em que ficou cancelado não são cobrados). */
export async function reactivateClientAction(id: string, date: string) {
  const { supabase } = await requireUser()
  if (!isDate(date)) return { error: 'Data inválida' }
  const { data: c } = await supabase.from('clients').select('monthly_fee').eq('id', id).maybeSingle()
  if (!c) return { error: 'Cliente não encontrado' }
  const patch: Record<string, unknown> = { status: 'active', canceled_at: null }
  if (Number(c.monthly_fee) > 0) patch.start_date = date
  const { error } = await supabase.from('clients').update(patch).eq('id', id)
  if (error) return { error: 'Não foi possível reativar' }
  await ensureMonthlyCharges(supabase, todayInSaoPaulo(), id)
  revalidatePath(`/clientes/${id}`)
  revalidatePath('/clientes')
  return {}
}

export async function deleteClientAction(id: string) {
  const { supabase } = await requireUser()
  await supabase.from('clients').delete().eq('id', id)
  revalidatePath('/clientes')
  redirect('/clientes')
}
