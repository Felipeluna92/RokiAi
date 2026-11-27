import { expect, test, type Page } from '@playwright/test'
import { login } from './helpers'
import { resetData, testDb } from './db'

const todaySP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

test.beforeEach(async () => {
  const sb = await resetData()
  await sb.from('settings').update({ pix_key: 'teste@pix.com', business_name: 'RokiAi' }).not('id', 'is', null)
})

async function fillClient(page: Page, opts: { company?: string; start?: string } = {}) {
  const today = todaySP()
  if (opts.company) await page.getByLabel('Empresa').fill(opts.company)
  await page.getByLabel('Responsável').fill('Carlos')
  await page.getByLabel('WhatsApp').fill('(19) 97777-6666')
  await page.getByLabel('Valor da implantação').fill('900')
  await page.getByLabel('Parcelas').fill('3')
  await page.getByLabel('1ª parcela em').fill(today)
  await page.getByLabel('Mensalidade (R$)').fill('120')
  await page.getByLabel('Dia de vencimento').fill(String(Math.min(28, Number(today.slice(8)))))
  await page.getByLabel('Início da mensalidade').fill(opts.start ?? today)
}

test('cadastro de cliente gera parcelas e mensalidades sem duplicar', async ({ page }) => {
  await login(page)
  await page.goto('/clientes/novo')
  await fillClient(page, { company: 'Oficina Teste' })
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Oficina Teste' })).toBeVisible()

  const rows = page.getByTestId('charge-row')
  for (const d of ['Implantação 1/3', 'Implantação 2/3', 'Implantação 3/3']) {
    await expect(rows.filter({ hasText: d }).getByText('R$ 300,00')).toBeVisible()
  }
  await expect(rows.filter({ hasText: 'Mensalidade' }).first()).toBeVisible()
  const count = await rows.count()
  await page.reload()
  await page.reload()
  await expect(rows).toHaveCount(count)

  // marcar 1ª parcela como paga
  await rows.filter({ hasText: 'Implantação 1/3' }).getByRole('button', { name: 'Marcar como paga' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar pagamento' }).click()
  await expect(rows.filter({ hasText: 'Implantação 1/3' }).getByText('Paga', { exact: true })).toBeVisible()

  // desfazer
  await rows.filter({ hasText: 'Implantação 1/3' }).getByRole('button', { name: 'Desfazer' }).click()
  await expect(rows.filter({ hasText: 'Implantação 1/3' }).getByText('Paga', { exact: true })).toHaveCount(0)

  // cobrar no WhatsApp a partir de /cobrancas
  await page.goto('/cobrancas?tab=todas')
  const monthly = page.getByTestId('charge-row').filter({ hasText: 'Oficina Teste' }).filter({ hasText: 'Mensalidade' }).first()
  await monthly.getByRole('button', { name: 'Cobrar' }).click()
  const msg = page.getByRole('dialog').getByLabel('Mensagem')
  await expect(msg).toHaveValue(/R\$\s120,00/)
  await expect(msg).toHaveValue(/teste@pix\.com/)
})

test('cliente vindo de lead fecha o lead', async ({ page }) => {
  const sb = await testDb()
  const { data: lead } = await sb
    .from('leads')
    .insert({ name: 'Pet Lead', phone: '5519955554444', phone_is_mobile: true, city: 'Campinas', source: 'manual', stage: 'proposta' })
    .select('id')
    .single()
  await login(page)
  await page.goto(`/clientes/novo?lead=${lead!.id}`)
  await expect(page.getByLabel('Empresa')).toHaveValue('Pet Lead')
  await fillClient(page)
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Pet Lead' })).toBeVisible()
  await page.goto(`/leads/${lead!.id}`)
  await expect(page.getByLabel('Estágio')).toHaveValue('fechado')
  await expect(page.getByRole('link', { name: 'Ver cliente' })).toBeVisible()
})

test('início no passado avisa quantas mensalidades retroativas serão criadas', async ({ page }) => {
  await login(page)
  await page.goto('/clientes/novo')
  const today = todaySP()
  const [y, m] = today.split('-').map(Number)
  const past = `${m <= 3 ? y - 1 : y}-${String(((m - 4 + 12) % 12) + 1).padStart(2, '0')}-01` // ~3 meses atrás
  await fillClient(page, { company: 'Retro', start: past })
  await expect(page.getByText(/Serão criadas \d+ mensalidades passadas/)).toBeVisible()
})

test('cancelar cliente e status inadimplente na lista', async ({ page }) => {
  await login(page)
  await page.goto('/clientes/novo')
  const today = todaySP()
  const [y, m] = today.split('-').map(Number)
  const twoMonthsAgo = `${m <= 2 ? y - 1 : y}-${String(((m - 3 + 12) % 12) + 1).padStart(2, '0')}-01`
  await fillClient(page, { company: 'Devedor', start: twoMonthsAgo })
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Devedor' })).toBeVisible()
  await page.goto('/clientes')
  await expect(page.getByTestId('client-row').filter({ hasText: 'Devedor' }).getByText('Inadimplente')).toBeVisible()

  await page.getByRole('link', { name: 'Devedor' }).click()
  await expect(page.getByRole('heading', { name: 'Devedor' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar cliente' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar cancelamento' }).click()
  await expect(page.getByText(/Cancelado em/)).toBeVisible()
})

test('rota de cron exige segredo', async ({ request }) => {
  const r = await request.get('/api/cron/charges')
  expect(r.status()).toBe(401)
  const ok = await request.get('/api/cron/charges', { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } })
  expect(ok.status()).toBe(200)
})

test('mensalidade excluída não volta ao recarregar', async ({ page }) => {
  page.on('dialog', (d) => d.accept())
  await login(page)
  await page.goto('/clientes/novo')
  await fillClient(page, { company: 'Exclui Teste' })
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Exclui Teste' })).toBeVisible()
  const monthly = page.getByTestId('charge-row').filter({ hasText: 'Mensalidade' })
  const before = await monthly.count()
  await monthly.first().getByRole('button', { name: 'Mais ações' }).click()
  await page.getByRole('button', { name: 'Excluir' }).click()
  await expect(monthly).toHaveCount(before - 1)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Exclui Teste' })).toBeVisible()
  await expect(monthly).toHaveCount(before - 1)
})

test('reativar cliente não cobra os meses em que ficou cancelado', async ({ page }) => {
  await login(page)
  await page.goto('/clientes/novo')
  const today = todaySP()
  const [y, m] = today.split('-').map(Number)
  const start = `${m <= 3 ? y - 1 : y}-${String(((m - 4 + 12) % 12) + 1).padStart(2, '0')}-01`
  await fillClient(page, { company: 'Volta Teste', start })
  await page.getByLabel('Valor da implantação').fill('')
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Volta Teste' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar cliente' }).click()
  await page.getByLabel('Data do cancelamento').fill(start)
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar cancelamento' }).click()
  await expect(page.getByText(/Cancelado em/)).toBeVisible()
  await expect(page.getByTestId('charge-row')).toHaveCount(0)

  await page.getByRole('button', { name: 'Reativar' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar reativação' }).click()
  await expect(page.getByText(/Cancelado em/)).toHaveCount(0)
  await expect(page.getByTestId('charge-row').filter({ hasText: 'Atrasada' })).toHaveCount(0)
  await expect(page.getByTestId('charge-row').filter({ hasText: 'Mensalidade' }).first()).toBeVisible()
})
