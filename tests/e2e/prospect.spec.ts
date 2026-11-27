import { expect, test } from '@playwright/test'
import { login } from './helpers'
import { resetData } from './db'

const fake = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  placeId: id,
  name,
  address: 'Rua A, 1 - Campinas',
  phoneRaw: '+55 19 99999-0001',
  phone: { digits: '5519999990001', isMobile: true },
  websiteUri: null,
  siteStatus: 'none',
  rating: 4.7,
  ratingsCount: 120,
  mapsUrl: 'https://maps.google.com/?cid=1',
  score: 80,
  tier: 'alto',
  ...over,
})

test.beforeEach(async () => {
  await resetData()
})

test('sem chave do Google mostra erro claro', async ({ page }) => {
  test.skip(Boolean(process.env.GOOGLE_PLACES_API_KEY || process.env.APIFY_TOKEN), 'fonte configurada')
  await login(page)
  await page.goto('/prospectar')
  await page.getByLabel('Cidade').fill('Campinas, SP')
  await page.getByLabel('Categoria').fill('Barbearia')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Chave do Google não configurada' })).toBeVisible()
})

test('salvar, ignorar e marcar resultados', async ({ page }) => {
  await login(page)
  await page.evaluate(
    (s) => sessionStorage.setItem('rokiai:prospect', JSON.stringify(s)),
    {
      city: 'Campinas, SP',
      category: 'Barbearia',
      results: [
        fake('e2e-a', 'Barbearia Alfa'),
        fake('e2e-b', 'Barbearia Beta', { siteStatus: 'social', score: 70 }),
        fake('e2e-c', 'Barbearia Com Site', { siteStatus: 'has_site', websiteUri: 'https://x.com.br' }),
      ],
    },
  )
  await page.goto('/prospectar')
  const cards = page.getByTestId('prospect-card')
  await expect(cards).toHaveCount(2) // quem tem site fica oculto
  await page.getByLabel('Mostrar quem tem site').check()
  await expect(cards).toHaveCount(3)
  await page.getByLabel('Mostrar quem tem site').uncheck()

  const alfa = cards.filter({ hasText: 'Barbearia Alfa' })
  await alfa.getByRole('button', { name: 'Salvar lead' }).click()
  await expect(alfa.getByText('Lead · Novo')).toBeVisible()
  // clique duplo não duplica: o botão some depois de salvo
  await expect(alfa.getByRole('button', { name: 'Salvar lead' })).toHaveCount(0)

  const beta = cards.filter({ hasText: 'Barbearia Beta' })
  await beta.getByRole('button', { name: 'Ignorar' }).click()
  await expect(cards).toHaveCount(1)
  await page.getByLabel('Mostrar ignorados').check()
  await expect(cards.filter({ hasText: 'Barbearia Beta' }).getByText('Ignorado')).toBeVisible()

  // recarregar mantém resultados (sessionStorage) e marcações (banco)
  await page.reload()
  await expect(page.getByTestId('prospect-card').filter({ hasText: 'Barbearia Alfa' }).getByText('Lead · Novo')).toBeVisible()
})
