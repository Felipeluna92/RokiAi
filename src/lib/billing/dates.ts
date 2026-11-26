function parts(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return { y, m, d }
}

function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Soma `months` meses a `iso`, usando `day` (ou o dia original) limitado ao último dia do mês destino. */
export function addMonthsClamped(isoDate: string, months: number, day?: number): string {
  const { y, m, d } = parts(isoDate)
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return iso(ny, nm, Math.min(day ?? d, daysInMonth(ny, nm)))
}

/** Primeiro vencimento de mensalidade: primeiro `dueDay` ≥ `startDate`. */
export function firstMonthlyDue(startDate: string, dueDay: number): string {
  const { y, m, d } = parts(startDate)
  const sameMonth = iso(y, m, Math.min(dueDay, daysInMonth(y, m)))
  return d <= dueDay ? sameMonth : addMonthsClamped(iso(y, m, 1), 1, dueDay)
}

/** Primeiro dia do mês de `iso`. */
export function monthStart(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`
}
