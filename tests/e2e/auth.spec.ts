import { expect, test } from '@playwright/test'
import { login } from './helpers'

test('sem sessão redireciona para o login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
})

test('senha errada mostra erro', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(process.env.E2E_EMAIL!)
  await page.getByLabel('Senha').fill('errada-123')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('E-mail ou senha inválidos')).toBeVisible()
})

test('login mostra dashboard e navegação', async ({ page }) => {
  await login(page)
  const nav = page.getByRole('navigation', { name: 'Principal' })
  for (const item of ['Dashboard', 'Prospectar', 'Leads', 'Cobranças', 'Mais']) {
    await expect(nav.getByRole('link', { name: item }).or(nav.getByRole('button', { name: item }))).toBeVisible()
  }
  await nav.getByRole('button', { name: 'Mais' }).click()
  await expect(page.getByRole('link', { name: 'Clientes' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Configurações' })).toBeVisible()
})
