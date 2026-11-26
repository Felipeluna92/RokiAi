import { describe, expect, it } from 'vitest'
import { addMonthsClamped, firstMonthlyDue } from './dates'

describe('addMonthsClamped', () => {
  it('limita ao último dia de meses curtos', () => {
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsClamped('2026-01-31', 3)).toBe('2026-04-30')
    expect(addMonthsClamped('2026-01-31', 2)).toBe('2026-03-31')
    expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29')
  })
  it('vira o ano', () => {
    expect(addMonthsClamped('2026-11-15', 2)).toBe('2027-01-15')
  })
  it('aceita dia explícito', () => {
    expect(addMonthsClamped('2026-03-01', 1, 10)).toBe('2026-04-10')
  })
})

describe('firstMonthlyDue', () => {
  it('início depois do vencimento → mês seguinte', () => {
    expect(firstMonthlyDue('2026-03-20', 10)).toBe('2026-04-10')
  })
  it('início antes ou no dia → mesmo mês', () => {
    expect(firstMonthlyDue('2026-03-05', 10)).toBe('2026-03-10')
    expect(firstMonthlyDue('2026-03-10', 10)).toBe('2026-03-10')
  })
  it('dezembro vira o ano', () => {
    expect(firstMonthlyDue('2026-12-20', 5)).toBe('2027-01-05')
  })
})
