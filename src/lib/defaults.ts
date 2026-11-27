import 'server-only'
import type { Supabase } from './supabase/server'

export const DEFAULT_TEMPLATES = [
  {
    kind: 'approach',
    name: 'Primeira abordagem',
    body:
      'Olá! Tudo bem? Vi a {nome_empresa} no Google Maps aqui em {cidade} e notei que vocês ainda não têm um site. ' +
      'Eu crio sites profissionais para comércios locais, que aparecem no Google e trazem mais clientes pelo WhatsApp. ' +
      'Posso te mostrar um exemplo rapidinho?',
  },
  {
    kind: 'followup',
    name: 'Follow-up',
    body: 'Oi! Passando para saber se você conseguiu ver minha mensagem sobre o site da {nome_empresa}. Posso te mandar uma proposta sem compromisso?',
  },
  {
    kind: 'charge',
    name: 'Cobrança',
    body:
      'Olá {responsavel}! Lembrete da {nome_empresa}: a cobrança de {valor} vence em {vencimento}. ' +
      'Chave Pix: {chave_pix}. Qualquer dúvida estou à disposição. Obrigado!',
  },
] as const

/** Cria configurações e modelos padrão no primeiro acesso. */
export async function ensureDefaults(supabase: Supabase) {
  const { data: settings } = await supabase.from('settings').select('id').maybeSingle()
  if (!settings) await supabase.from('settings').insert({})
  const { count } = await supabase.from('message_templates').select('id', { count: 'exact', head: true })
  if (!count) await supabase.from('message_templates').insert(DEFAULT_TEMPLATES.map((t) => ({ ...t })))
}
