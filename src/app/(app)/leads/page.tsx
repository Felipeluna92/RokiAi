import Link from 'next/link'
import { CalendarClock, Plus } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { buttonClass } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { requireUser } from '@/lib/auth'
import { STAGE_LABEL, STAGES, type Stage } from '@/lib/billing/metrics'
import { formatDate, formatPhoneDigits, todayInSaoPaulo } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Lead } from '@/lib/types'
import { fetchAllPages } from '@/lib/paginate'

export const metadata = { title: 'Leads · RokiAi' }

const STAGE_TONE = { novo: 'blue', contatado: 'yellow', proposta: 'violet', fechado: 'green', perdido: 'gray' } as const

function LeadRow({ lead, today }: { lead: Lead; today: string }) {
  const late = lead.next_contact_at && lead.next_contact_at <= today && !['fechado', 'perdido'].includes(lead.stage)
  return (
    <Card className="flex flex-col gap-1 p-3">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
          {lead.name}
        </Link>
        <Badge tone={STAGE_TONE[lead.stage]}>{STAGE_LABEL[lead.stage]}</Badge>
      </div>
      <p className="text-xs text-zinc-500">
        {[lead.category, lead.city, formatPhoneDigits(lead.phone)].filter(Boolean).join(' · ')}
      </p>
      {lead.next_contact_at && (
        <p className={cn('flex items-center gap-1 text-xs', late ? 'font-medium text-red-600' : 'text-zinc-500')}>
          <CalendarClock className="h-3.5 w-3.5" /> Próximo contato: {formatDate(lead.next_contact_at)}
        </p>
      )}
    </Card>
  )
}

export default async function LeadsPage({ searchParams }: PageProps<'/leads'>) {
  const sp = await searchParams
  const stage = (typeof sp.stage === 'string' && (STAGES as string[]).includes(sp.stage) ? sp.stage : null) as Stage | null
  const q = typeof sp.q === 'string' ? sp.q.trim().toLowerCase() : ''
  const { supabase } = await requireUser()
  const all = await fetchAllPages<Lead>((from, to) =>
    supabase.from('leads').select('*').order('updated_at', { ascending: false }).order('id').range(from, to),
  )
  const today = todayInSaoPaulo()

  const matches = (l: Lead) =>
    !q || [l.name, l.city, l.category, l.phone].some((v) => v?.toLowerCase().includes(q))
  const filtered = all.filter(matches)
  const forToday = all
    .filter((l) => l.next_contact_at && l.next_contact_at <= today && !['fechado', 'perdido'].includes(l.stage))
    .sort((a, b) => a.next_contact_at!.localeCompare(b.next_contact_at!))
  const counts = Object.fromEntries(STAGES.map((s) => [s, filtered.filter((l) => l.stage === s).length])) as Record<Stage, number>
  const list = stage ? filtered.filter((l) => l.stage === stage) : filtered

  const tab = (s: Stage | null, label: string, n: number) => {
    const params = new URLSearchParams()
    if (s) params.set('stage', s)
    if (q) params.set('q', q)
    return (
      <Link
        key={s ?? 'todos'}
        href={`/leads${params.size ? `?${params}` : ''}`}
        className={cn(
          'shrink-0 rounded-full border px-3 py-1 text-sm',
          stage === s ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900' : 'border-zinc-300 dark:border-zinc-700',
        )}
      >
        {label} <span className="opacity-70">{n}</span>
      </Link>
    )
  }

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle={`${all.length} no funil`}
        actions={
          <Link href="/leads/novo" className={buttonClass('default', 'default')}>
            <Plus className="h-4 w-4" /> Novo lead
          </Link>
        }
      />

      {forToday.length > 0 && (
        <section aria-label="Para hoje" className="mb-5">
          <h2 className="mb-2 text-sm font-semibold text-red-600">Para hoje ({forToday.length})</h2>
          <div className="grid gap-2 md:grid-cols-2">
            {forToday.map((l) => (
              <LeadRow key={l.id} lead={l} today={today} />
            ))}
          </div>
        </section>
      )}

      <form className="mb-3">
        {stage && <input type="hidden" name="stage" value={stage} />}
        <Input name="q" defaultValue={q} placeholder="Buscar por nome, cidade, categoria ou telefone" aria-label="Buscar leads" />
      </form>

      <nav aria-label="Filtrar por estágio" className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {tab(null, 'Todos', filtered.length)}
        {STAGES.map((s) => tab(s, STAGE_LABEL[s], counts[s]))}
      </nav>

      {list.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">
          Nenhum lead aqui. <Link href="/prospectar" className="underline">Prospectar comércios</Link>
        </p>
      ) : stage ? (
        <div className="grid gap-2 md:grid-cols-2">
          {list.map((l) => (
            <LeadRow key={l.id} lead={l} today={today} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-2 md:hidden">
            {list.map((l) => (
              <LeadRow key={l.id} lead={l} today={today} />
            ))}
          </div>
          <div className="hidden gap-3 md:grid md:grid-cols-5">
            {STAGES.map((s) => (
              <div key={s} className="min-w-0">
                <h2 className="mb-2 text-sm font-semibold">
                  {STAGE_LABEL[s]} <span className="text-zinc-500">{counts[s]}</span>
                </h2>
                <div className="space-y-2">
                  {list
                    .filter((l) => l.stage === s)
                    .map((l) => (
                      <LeadRow key={l.id} lead={l} today={today} />
                    ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
