import { expect, test } from '@playwright/test'
import { login } from './helpers'
import { resetData, testDb } from './db'

const todaySP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

test.beforeEach(async () => {
  await resetData()
})

test('dashboard vazio mostra estado inicial', async ({ page }) => {
  await login(page)
  await expect(page.getByText('Nenhum cliente ainda')).toBeVisible()
  await expect(page.getByTestId('kpi-mrr')).toContainText('R$ 0,00')
})

test('dashboard com cliente mostra MRR, recebido e gráfico', async ({ page }) => {
  const sb = await testDb()
  const today = todaySP()
  const day = Math.min(28, Number(today.slice(8)))
  const { data: c } = await sb
    .from('clients')
    .insert({ company: 'Oficina Dash', monthly_fee: 120, due_day: day, start_date: today, setup_total: 300, setup_installments: 1 })
    .select('id')
    .single()
  await sb.from('charges').insert({ client_id: c!.id, type: 'setup', description: 'Implantação', amount: 300, due_date: today, paid_at: today })

  await login(page)
  await expect(page.getByTestId('kpi-mrr')).toContainText('R$ 120,00')
  await expect(page.getByTestId('kpi-received')).toContainText('R$ 300,00')
  await expect(page.getByTestId('revenue-chart').locator('svg').first()).toBeVisible()
  await expect(page.getByTestId('kpi-clients')).toContainText('1')
})

test('configurações salvam chave Pix e exportação funciona', async ({ page }) => {
  await login(page)
  await page.goto('/configuracoes')
  await page.getByLabel('Chave Pix').fill('teste@pix.com')
  await page.getByLabel('Nome do negócio').fill('RokiAi Sites')
  await page.getByRole('button', { name: 'Salvar configurações' }).click()
  await expect(page.getByText('Configurações salvas')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Chave Pix')).toHaveValue('teste@pix.com')

  // modelo de mensagem editável
  const tpl = page.getByTestId('template').filter({ hasText: 'Cobrança' }).first()
  await tpl.getByLabel('Texto').fill('Pague {valor} na chave {chave_pix}')
  await tpl.getByRole('button', { name: 'Salvar modelo' }).click()
  await expect(page.getByText('Modelo salvo')).toBeVisible()

  const res = await page.request.get('/api/export?format=json')
  expect(res.status()).toBe(200)
  const json = await res.json()
  expect(json.settings.pix_key).toBe('teste@pix.com')
  expect(Array.isArray(json.clients)).toBe(true)
  const csv = await page.request.get('/api/export?format=csv')
  expect(csv.headers()['content-type']).toContain('text/csv')
})

test('exportação exige login', async ({ request }) => {
  const r = await request.get('/api/export?format=json', { maxRedirects: 0 })
  expect([302, 303, 307, 401]).toContain(r.status())
})
