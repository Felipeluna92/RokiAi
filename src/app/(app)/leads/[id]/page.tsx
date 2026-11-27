import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Card, CardTitle } from '@/components/ui/card'
import { requireUser } from '@/lib/auth'
import { formatPhoneDigits } from '@/lib/format'
import type { Lead, LeadEvent, MessageTemplate } from '@/lib/types'
import { Stars } from '@/components/stars'
import { TIER_LABEL, tierOf } from '@/lib/prospect/score'
import { LeadActions, NextContactForm, NoteForm, StageSelect, Timeline } from './lead-detail'

export default async function LeadPage({ params }: PageProps<'/leads/[id]'>) {
  const { id } = await params
  const { supabase } = await requireUser()
  const [{ data: lead }, { data: events }, { data: templates }, { data: client }] = await Promise.all([
    supabase.from('leads').select('*').eq('id', id).maybeSingle(),
    supabase.from('lead_events').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
    supabase.from('message_templates').select('id, kind, name, body').in('kind', ['approach', 'followup']).order('kind'),
    supabase.from('clients').select('id').eq('lead_id', id).maybeSingle(),
  ])
  if (!lead) notFound()
  const l = lead as Lead

  return (
    <div className="space-y-4">
      <Link href="/leads" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Leads
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{l.name}</h1>
          <p className="text-sm text-zinc-500">{[l.category, l.city].filter(Boolean).join(' · ')}</p>
        </div>
        <StageSelect key={l.stage} id={l.id} stage={l.stage} />
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <Card className="space-y-3">
            <CardTitle>Contato</CardTitle>
            <div data-testid="lead-rating" className="flex flex-wrap items-center gap-2">
              <Stars rating={l.rating} count={l.ratings_count} />
              {l.potential_score != null && <span className="text-sm text-zinc-500">· {TIER_LABEL[tierOf(l.potential_score)]} ({l.potential_score}/100)</span>}
            </div>
            <p className="text-lg">{l.phone ? formatPhoneDigits(l.phone) : 'Sem telefone'}</p>
            {l.phone && !l.phone_is_mobile && (
              <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                Número fixo — pode não ter WhatsApp
              </p>
            )}
            <LeadActions
              lead={{ id: l.id, phone: l.phone, name: l.name, city: l.city, category: l.category, rating: l.rating, ratings_count: l.ratings_count }}
              templates={(templates ?? []) as MessageTemplate[]}
            />
            <div className="flex flex-wrap gap-3 text-sm">
              {l.google_place_id && (
                <a
                  href={`https://www.google.com/maps/place/?q=place_id:${l.google_place_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-zinc-600 underline dark:text-zinc-300"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Ver no Google
                </a>
              )}
              {client && (
                <Link href={`/clientes/${client.id}`} className="text-zinc-600 underline dark:text-zinc-300">
                  Ver cliente
                </Link>
              )}
            </div>
            {l.lost_reason && <p className="text-sm text-zinc-500">Motivo da perda: {l.lost_reason}</p>}
          </Card>
          <Card>
            <NextContactForm id={l.id} value={l.next_contact_at} />
          </Card>
        </div>
        <Card className="space-y-4">
          <CardTitle>Histórico</CardTitle>
          <NoteForm id={l.id} />
          <Timeline events={(events ?? []) as LeadEvent[]} createdAt={l.created_at} source={l.source} />
        </Card>
      </div>
    </div>
  )
}
