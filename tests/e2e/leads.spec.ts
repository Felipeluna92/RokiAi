import { expect, test, type Page } from '@playwright/test'
import { login } from './helpers'
import { resetData } from './db'

test.beforeEach(async () => {
  await resetData()
})

async function createLead(page: Page, name: string, phone: string) {
  await page.goto('/leads/novo')
  await page.getByLabel('Nome da empresa').fill(name)
  await page.getByLabel('Telefone / WhatsApp').fill(phone)
  await page.getByLabel('Cidade').fill('Campinas, SP')
  await page.getByLabel('Categoria').fill('Padaria')
  await page.getByRole('button', { name: 'Salvar lead' }).click()
}

test('funil completo de um lead manual', async ({ page }) => {
  await login(page)
  await createLead(page, 'Padaria Teste', '(19) 99999-0000')
  await expect(page.getByRole('heading', { name: 'Padaria Teste' })).toBeVisible()
  await expect(page.getByLabel('Estágio')).toHaveValue('novo')

  // WhatsApp com modelo de abordagem
  await page.evaluate(() => {
    ;(window as unknown as { __opened: string[] }).__opened = []
    window.open = (u?: string | URL) => {
      ;(window as unknown as { __opened: string[] }).__opened.push(String(u))
      return null
    }
  })
  await page.getByRole('button', { name: 'Chamar no WhatsApp' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Mensagem')).toHaveValue(/Padaria Teste/)
  await dialog.getByRole('button', { name: 'Abrir WhatsApp' }).click()
  const opened = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened)
  expect(opened[0]).toMatch(/^https:\/\/wa\.me\/5519999990000\?text=/)
  expect(decodeURIComponent(opened[0])).toContain('Padaria Teste')
  await expect(page.getByLabel('Estágio')).toHaveValue('contatado')
  await expect(page.getByText('WhatsApp enviado')).toBeVisible()

  // nota
  await page.getByLabel('Nova anotação').fill('Ligar depois do almoço')
  await page.getByRole('button', { name: 'Adicionar' }).click()
  await expect(page.getByText('Ligar depois do almoço')).toBeVisible()

  // próximo contato hoje → aparece em "Para hoje"
  const today = await page.evaluate(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()))
  await page.getByLabel('Próximo contato').fill(today)
  await page.getByRole('button', { name: 'Salvar data' }).click()
  await expect(page.getByText('Próximo contato salvo')).toBeVisible()
  await page.goto('/leads')
  await expect(page.getByRole('region', { name: 'Para hoje' }).getByText('Padaria Teste')).toBeVisible()

  // perdido exige motivo
  await page.getByRole('link', { name: 'Padaria Teste' }).first().click()
  await expect(page.getByRole('heading', { name: 'Padaria Teste' })).toBeVisible()
  await page.getByLabel('Estágio').selectOption('perdido')
  const lost = page.getByRole('dialog')
  await lost.getByRole('button', { name: 'Confirmar' }).click()
  await expect(lost.getByText('Informe o motivo')).toBeVisible()
  await lost.getByLabel('Motivo da perda').fill('Achou caro')
  await lost.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByLabel('Estágio')).toHaveValue('perdido')
  await expect(page.getByText('Motivo da perda: Achou caro')).toBeVisible()
})

test('lista por estágio e fechado leva ao cadastro de cliente', async ({ page }) => {
  await login(page)
  await createLead(page, 'Oficina Lista', '19 3232-1234')
  await expect(page.getByText('Número fixo — pode não ter WhatsApp')).toBeVisible()
  await page.goto('/leads?stage=novo')
  await expect(page.getByRole('link', { name: 'Oficina Lista' })).toBeVisible()
  await page.goto('/leads?stage=contatado')
  await expect(page.getByRole('link', { name: 'Oficina Lista' })).toHaveCount(0)
  await page.goto('/leads?q=oficina')
  await page.getByRole('link', { name: 'Oficina Lista' }).first().click()
  await expect(page.getByRole('heading', { name: 'Oficina Lista' })).toBeVisible()
  await page.getByLabel('Estágio').selectOption('fechado')
  await expect(page).toHaveURL(/\/clientes\/novo\?lead=/)
})

test('telefone repetido avisa e não duplica', async ({ page }) => {
  await login(page)
  await createLead(page, 'Pet Um', '(19) 98888-7777')
  await expect(page.getByRole('heading', { name: 'Pet Um' })).toBeVisible()
  await createLead(page, 'Pet Dois', '+55 19 98888-7777')
  await expect(page.getByText('Já existe um lead com esse telefone')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Abrir Pet Um' })).toBeVisible()
})
