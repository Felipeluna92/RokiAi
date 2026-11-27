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
