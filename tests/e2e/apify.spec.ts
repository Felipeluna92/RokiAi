import { expect, test } from '@playwright/test'
import { login } from './helpers'
import { resetData } from './db'

// Busca real na Apify (gasta alguns centavos): rode com APIFY_E2E=1
test.skip(!process.env.APIFY_E2E, 'defina APIFY_E2E=1 para rodar')
test.setTimeout(300_000)

test.beforeEach(async () => {
  await resetData()
})

test('busca real na Apify mostra progresso e resultados', async ({ page }) => {
  await login(page)
  await page.goto('/prospectar')
  await page.getByLabel('Cidade').fill('Campinas, SP')
  await page.getByLabel('Categoria').fill('Barbearia')
  await page.getByLabel('Quantidade').fill('3')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await expect(page.getByText(/Buscando na Apify/)).toBeVisible()
  await page.getByLabel('Mostrar quem tem site').check()
  await expect(page.getByTestId('prospect-card').first()).toBeVisible({ timeout: 240_000 })
  await expect(page.getByText(/Buscando na Apify/)).toHaveCount(0)

  await page.goto('/configuracoes')
  await expect(page.getByText(/Apify neste mês/)).toBeVisible()
  await expect(page.getByTestId('apify-usage')).toContainText('1 busca')
})
