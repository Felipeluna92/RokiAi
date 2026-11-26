import { describe, expect, it } from 'vitest'
import { normalizePhone } from './phone'

describe('normalizePhone', () => {
  it('celular internacional', () => {
    expect(normalizePhone('+55 19 99999-8888')).toEqual({ digits: '5519999998888', isMobile: true })
  })
  it('fixo', () => {
    expect(normalizePhone('(19) 3232-1234')).toEqual({ digits: '551932321234', isMobile: false })
  })
  it('celular antigo sem o 9 ganha o 9', () => {
    expect(normalizePhone('19 9999-8888')).toEqual({ digits: '5519999998888', isMobile: true })
  })
  it('zero de tronco', () => {
    expect(normalizePhone('019 99999-8888')).toEqual({ digits: '5519999998888', isMobile: true })
  })
  it('DDD 55 sem código do país não é confundido com +55', () => {
    expect(normalizePhone('(55) 99999-8888')).toEqual({ digits: '5555999998888', isMobile: true })
  })
  it('números especiais e inválidos → null', () => {
    expect(normalizePhone('0800 123 4567')).toBeNull()
    expect(normalizePhone('4004-1234')).toBeNull()
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone(null)).toBeNull()
    expect(normalizePhone('12345')).toBeNull()
  })
})
