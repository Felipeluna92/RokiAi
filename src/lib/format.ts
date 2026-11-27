const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatBRL(n: number): string {
  return brl.format(n)
}

/** `YYYY-MM-DD` → `dd/mm/aaaa` */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

const spDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Data de hoje (`YYYY-MM-DD`) no fuso de São Paulo. */
export function todayInSaoPaulo(now: Date = new Date()): string {
  return spDate.format(now)
}

/** `YYYY-MM-DD` → `YYYY-MM` */
export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

/** `55DDDNÚMERO` → `(DD) 99999-9999` */
export function formatPhoneDigits(digits?: string | null): string {
  if (!digits) return ''
  const d = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return digits
}

/**
 * Lê valores em reais digitados: "149,90", "1.500,50", "1.500" (milhar), "149.9" (ponto decimal).
 * Vazio → 0; texto inválido → NaN. Resultado arredondado para centavos.
 */
export function parseBRL(input: string | null | undefined): number {
  let s = String(input ?? '').replace(/R\$|\s/g, '')
  if (!s) return 0
  if (s.includes(',')) {
    if ((s.match(/,/g) ?? []).length > 1) return NaN
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '')
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN
  return Math.round(Number(s) * 100) / 100
}

/** Número → texto para campo de formulário ("149,90"). */
export function toInputBRL(n: number | string | null | undefined): string {
  if (n == null || n === '') return ''
  return Number(n).toFixed(2).replace('.', ',')
}
