export type NormalizedPhone = { digits: string; isMobile: boolean }

const SPECIAL_PREFIXES = ['0800', '0300', '0500', '0900', '4004', '4003', '4020']

/**
 * Normaliza um telefone brasileiro para `55DDDNÚMERO`.
 * Retorna null para números especiais (0800, 4004…) ou inválidos.
 */
export function normalizePhone(raw?: string | null): NormalizedPhone | null {
  if (!raw) return null
  let d = raw.replace(/\D/g, '')
  if (!d) return null
  if (SPECIAL_PREFIXES.some((p) => d.startsWith(p))) return null
  // código do país (só se o que sobra tem tamanho de DDD + número)
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) d = d.slice(2)
  // zero de tronco
  while (d.startsWith('0') && d.length > 10) d = d.slice(1)
  if (d.length === 10) {
    const first = d[2]
    if ('6789'.includes(first)) d = `${d.slice(0, 2)}9${d.slice(2)}` // celular antigo sem o 9
    else if ('2345'.includes(first)) return { digits: `55${d}`, isMobile: false }
    else return null
  }
  if (d.length === 11 && d[2] === '9' && d[0] !== '0') return { digits: `55${d}`, isMobile: true }
  return null
}
