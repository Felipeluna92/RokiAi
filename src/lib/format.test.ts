import { describe, expect, it } from 'vitest'
import { formatBRL, formatDate, monthKey, todayInSaoPaulo } from './format'

describe('format', () => {
  it('formata moeda em reais', () => {
    expect(formatBRL(1234.5)).toBe('R$ 1.234,50')
  })
  it('formata data ISO como dd/mm/aaaa', () => {
    expect(formatDate('2026-03-05')).toBe('05/03/2026')
  })
  it('usa o fuso de São Paulo para hoje (22h em SP ainda é o mesmo dia)', () => {
    expect(todayInSaoPaulo(new Date('2026-03-11T01:00:00Z'))).toBe('2026-03-10')
    expect(todayInSaoPaulo(new Date('2026-03-11T15:00:00Z'))).toBe('2026-03-11')
  })
  it('extrai a chave do mês', () => {
    expect(monthKey('2026-03-31')).toBe('2026-03')
  })
})

import { formatPhoneDigits } from './format'
describe('formatPhoneDigits', () => {
  it('celular e fixo', () => {
    expect(formatPhoneDigits('5519999998888')).toBe('(19) 99999-8888')
    expect(formatPhoneDigits('551932321234')).toBe('(19) 3232-1234')
  })
  it('vazio', () => expect(formatPhoneDigits(null)).toBe(''))
})
