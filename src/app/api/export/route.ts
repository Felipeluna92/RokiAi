import { createClient } from '@/lib/supabase/server'
import { todayInSaoPaulo } from '@/lib/format'

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return new Response('Unauthorized', { status: 401 })
  const format = new URL(request.url).searchParams.get('format') === 'csv' ? 'csv' : 'json'
  const stamp = todayInSaoPaulo()

  if (format === 'csv') {
    const { data } = await supabase
      .from('charges')
      .select('type, description, amount, due_date, paid_at, notes, client:clients(company)')
      .order('due_date')
    const header = ['cliente', 'tipo', 'descricao', 'valor', 'vencimento', 'pago_em', 'observacao']
    const lines = (data ?? []).map((c) => {
      const client = c.client as unknown as { company: string } | null
      return [client?.company, c.type === 'setup' ? 'implantacao' : 'mensalidade', c.description, String(c.amount).replace('.', ','), c.due_date, c.paid_at, c.notes]
        .map(csvCell)
        .join(';')
    })
    return new Response('﻿' + [header.join(';'), ...lines].join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="rokiai-cobrancas-${stamp}.csv"`,
      },
    })
  }

  const tables = ['leads', 'lead_events', 'clients', 'charges', 'message_templates', 'place_marks'] as const
  const results = await Promise.all(tables.map((t) => supabase.from(t).select('*')))
  const { data: settings } = await supabase.from('settings').select('*').maybeSingle()
  const body: Record<string, unknown> = { exported_at: new Date().toISOString(), settings }
  tables.forEach((t, i) => (body[t] = results[i].data ?? []))
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="rokiai-backup-${stamp}.json"`,
    },
  })
}
