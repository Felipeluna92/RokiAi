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
