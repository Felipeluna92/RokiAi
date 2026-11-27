import { describe, expect, it } from 'vitest'
import { classifySite } from './site-status'

describe('classifySite', () => {
  it('sem URL → none', () => {
    expect(classifySite(undefined)).toBe('none')
    expect(classifySite(null)).toBe('none')
    expect(classifySite('')).toBe('none')
  })
  it('redes sociais e agregadores → social', () => {
    for (const u of [
      'https://instagram.com/x',
      'http://www.facebook.com/x',
      'https://fb.com/x',
      'https://linktr.ee/x',
      'https://wa.me/5519',
      'https://api.whatsapp.com/send?phone=1',
      'https://www.linkedin.com/company/x',
      'https://tiktok.com/@x',
      'https://www.ifood.com.br/delivery/x',
      'https://goo.gl/maps/x',
      'https://sites.google.com/view/x',
      'https://x.business.site/',
      'https://m.facebook.com/x',
    ])
      expect(classifySite(u), u).toBe('social')
  })
  it('site próprio → has_site', () => {
    expect(classifySite('https://barbeariadoze.com.br')).toBe('has_site')
    expect(classifySite('https://goo.gl/abc')).toBe('has_site')
    expect(classifySite('https://notinstagram.com/x')).toBe('has_site')
    expect(classifySite('not a url')).toBe('has_site')
  })
})

describe('classifySite — agendamento e cardápio contam como sem site próprio', () => {
  it.each([
    'https://cashbarber.com.br/oliveira',
    'https://agendaservico.com/corteestilo',
    'https://booksy.com/pt-br/123',
    'https://www.trinks.com/salao-x',
    'https://beacons.ai/x',
    'https://bio.link/x',
    'https://wa.link/abc',
    'https://pedido.anota.ai/loja/x',
    'https://www.goomer.app/x',
  ])('%s → social', (u) => expect(classifySite(u)).toBe('social'))
})
