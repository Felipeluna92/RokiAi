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

import { parseBRL, toInputBRL } from './format'
describe('parseBRL', () => {
  it.each([
    ['149.9', 149.9],
    ['149,90', 149.9],
    ['1.500', 1500],
    ['1.500,50', 1500.5],
    ['150.5', 150.5],
    ['150.50', 150.5],
    ['R$ 2.000,00', 2000],
    ['1500', 1500],
    ['12.345.678', 12345678],
    ['0', 0],
  ])('%s → %d', (input, expected) => expect(parseBRL(input)).toBe(expected))
  it('vazio → 0', () => expect(parseBRL('')).toBe(0))
  it('inválido → NaN', () => {
    expect(parseBRL('abc')).toBeNaN()
    expect(parseBRL('1,2,3')).toBeNaN()
  })
})
describe('toInputBRL', () => {
  it('formata para campo de texto', () => {
    expect(toInputBRL(149.9)).toBe('149,90')
    expect(toInputBRL(1500)).toBe('1500,00')
    expect(toInputBRL(null)).toBe('')
  })
})
