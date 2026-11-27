import { expect, test } from '@playwright/test'
import { login } from './helpers'

test('trocar senha em Configurações', async ({ page }) => {
  const original = process.env.E2E_PASSWORD!
  const temp = `${original}-novo`
  await login(page)
  await page.goto('/configuracoes')

  await page.getByLabel('Nova senha', { exact: true }).fill('curta')
  await page.getByLabel('Repita a nova senha').fill('curta')
  await page.getByRole('button', { name: 'Trocar senha' }).click()
  await expect(page.getByText('A senha precisa ter pelo menos 8 caracteres')).toBeVisible()

  await page.getByLabel('Nova senha', { exact: true }).fill(temp)
  await page.getByLabel('Repita a nova senha').fill(temp)
  await page.getByRole('button', { name: 'Trocar senha' }).click()
  await expect(page.getByText('Senha alterada')).toBeVisible()

  // sai e entra com a nova senha
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(process.env.E2E_EMAIL!)
  await page.getByLabel('Senha').fill(temp)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  // volta a senha original para os outros testes
  await page.goto('/configuracoes')
  await page.getByLabel('Nova senha', { exact: true }).fill(original)
  await page.getByLabel('Repita a nova senha').fill(original)
  await page.getByRole('button', { name: 'Trocar senha' }).click()
  await expect(page.getByText('Senha alterada')).toBeVisible()
})
