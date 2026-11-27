import { expect, test } from '@playwright/test'

test('login tem link para criar conta', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('link', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL(/\/cadastro$/)
})

test('e-mail não autorizado não consegue criar conta', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('E-mail').fill('intruso@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('senha-forte-123')
  await page.getByLabel('Repita a senha').fill('senha-forte-123')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByText('Este e-mail não está autorizado')).toBeVisible()
})

test('senhas diferentes', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('E-mail').fill('x@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('senha-forte-123')
  await page.getByLabel('Repita a senha').fill('outra-senha-123')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByText('As senhas não conferem')).toBeVisible()
})
