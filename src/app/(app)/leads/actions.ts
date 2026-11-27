'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { normalizePhone } from '@/lib/prospect/phone'
import { STAGE_LABEL, STAGES, type Stage } from '@/lib/billing/metrics'

export type CreateLeadState = { error?: string; existing?: { id: string; name: string; kind: 'lead' | 'cliente' } } | undefined

export async function createLeadAction(_prev: CreateLeadState, form: FormData): Promise<CreateLeadState> {
  const { supabase } = await requireUser()
  const name = String(form.get('name') ?? '').trim()
  const rawPhone = String(form.get('phone') ?? '').trim()
  if (!name) return { error: 'Informe o nome da empresa.' }
  const phone = rawPhone ? normalizePhone(rawPhone) : null
  if (rawPhone && !phone) return { error: 'Telefone inválido. Use DDD + número.' }

  if (phone) {
    const [{ data: lead }, { data: client }] = await Promise.all([
      supabase.from('leads').select('id, name').eq('phone', phone.digits).limit(1).maybeSingle(),
      supabase.from('clients').select('id, company').eq('phone', phone.digits).limit(1).maybeSingle(),
    ])
    if (lead) return { error: 'Já existe um lead com esse telefone.', existing: { id: lead.id, name: lead.name, kind: 'lead' } }
    if (client) return { error: 'Já existe um cliente com esse telefone.', existing: { id: client.id, name: client.company, kind: 'cliente' } }
  }

  const { data, error } = await supabase
    .from('leads')
    .insert({
      name,
      phone: phone?.digits ?? null,
      phone_is_mobile: phone?.isMobile ?? false,
      city: String(form.get('city') ?? '').trim() || null,
      category: String(form.get('category') ?? '').trim() || null,
      source: 'manual',
    })
    .select('id')
    .single()
  if (error) return { error: 'Não foi possível salvar o lead.' }
  const note = String(form.get('note') ?? '').trim()
  if (note) await supabase.from('lead_events').insert({ lead_id: data.id, type: 'note', body: note })
  revalidatePath('/leads')
  redirect(`/leads/${data.id}`)
}

export async function updateLeadStageAction(id: string, stage: Stage, lostReason?: string) {
  const { supabase } = await requireUser()
  if (!STAGES.includes(stage)) throw new Error('Estágio inválido')
  if (stage === 'perdido' && !lostReason?.trim()) return { error: 'Informe o motivo' }
  const { data: lead } = await supabase.from('leads').select('stage, contacted_at').eq('id', id).single()
  if (!lead) return { error: 'Lead não encontrado' }
  const patch: Record<string, unknown> = { stage, lost_reason: stage === 'perdido' ? lostReason!.trim() : null }
  if (stage !== 'novo' && !lead.contacted_at) patch.contacted_at = new Date().toISOString()
  await supabase.from('leads').update(patch).eq('id', id)
  const from = STAGE_LABEL[lead.stage as Stage]
  const body = `${from} → ${STAGE_LABEL[stage]}${stage === 'perdido' ? ` · Motivo: ${lostReason!.trim()}` : ''}`
  await supabase.from('lead_events').insert({ lead_id: id, type: 'stage_change', body })
  revalidatePath(`/leads/${id}`)
  revalidatePath('/leads')
  return {}
}

export async function addLeadNoteAction(id: string, body: string) {
  const { supabase } = await requireUser()
  const text = body.trim()
  if (!text) return
  await supabase.from('lead_events').insert({ lead_id: id, type: 'note', body: text.slice(0, 4000) })
  await supabase.from('leads').update({ updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath(`/leads/${id}`)
}

export async function setNextContactAction(id: string, date: string | null) {
  const { supabase } = await requireUser()
  const value = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null
  await supabase.from('leads').update({ next_contact_at: value }).eq('id', id)
  revalidatePath(`/leads/${id}`)
  revalidatePath('/leads')
}

export async function logWhatsappAction(id: string, templateName: string) {
  const { supabase } = await requireUser()
  const { data: lead } = await supabase.from('leads').select('stage, contacted_at').eq('id', id).single()
  if (!lead) return
  const patch: Record<string, unknown> = {}
  if (!lead.contacted_at) patch.contacted_at = new Date().toISOString()
  if (lead.stage === 'novo') patch.stage = 'contatado'
  if (Object.keys(patch).length) await supabase.from('leads').update(patch).eq('id', id)
  await supabase.from('lead_events').insert({ lead_id: id, type: 'whatsapp', body: templateName })
  revalidatePath(`/leads/${id}`)
  revalidatePath('/leads')
}

export async function deleteLeadAction(id: string) {
  const { supabase } = await requireUser()
  await supabase.from('leads').delete().eq('id', id)
  revalidatePath('/leads')
  redirect('/leads')
}
