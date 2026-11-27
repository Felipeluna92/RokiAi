export const TEMPLATE_VARS = ['nome_empresa', 'cidade', 'categoria', 'nota', 'avaliacoes', 'responsavel', 'valor', 'vencimento', 'chave_pix'] as const
export type TemplateVar = (typeof TEMPLATE_VARS)[number]
export type TemplateKind = 'approach' | 'followup' | 'charge'
export const TEMPLATE_KIND_LABEL: Record<TemplateKind, string> = {
  approach: 'Abordagem',
  followup: 'Follow-up',
  charge: 'Cobrança',
}

/** Troca `{chave}` pelo valor; chaves ausentes viram texto vazio. */
export function renderTemplate(body: string, vars: Record<string, string | number | undefined | null>): string {
  return body.replace(/\{([a-z_]+)\}/g, (_, key: string) => {
    const v = vars[key]
    return v == null ? '' : String(v)
  })
}

export function whatsappUrl(digits: string, text: string): string {
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}
