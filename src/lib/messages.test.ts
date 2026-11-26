import { describe, expect, it } from 'vitest'
import { renderTemplate, whatsappUrl } from './messages'

describe('renderTemplate', () => {
  it('substitui variáveis e apaga desconhecidas/ausentes', () => {
    expect(renderTemplate('Oi {responsavel}, {nome_empresa} {xyz}!', { nome_empresa: 'Zé Barber' })).toBe('Oi , Zé Barber !')
  })
  it('aceita números e repete variáveis', () => {
    expect(renderTemplate('{valor} e {valor}', { valor: 10 })).toBe('10 e 10')
  })
})

describe('whatsappUrl', () => {
  it('codifica o texto', () => {
    expect(whatsappUrl('5519999998888', 'Olá & tchau')).toBe('https://wa.me/5519999998888?text=Ol%C3%A1%20%26%20tchau')
  })
})
