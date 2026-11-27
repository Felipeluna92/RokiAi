'use client'
import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { AlertTriangle, ExternalLink, EyeOff, Eye, Loader2, Phone, Plus, Search, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Badge, type Tone } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { CATEGORIES } from '@/lib/prospect/categories'
import { STAGE_LABEL } from '@/lib/billing/metrics'
import type { ProspectResult } from '@/lib/prospect/places'
import type { SiteStatus } from '@/lib/prospect/site-status'
import type { Tier } from '@/lib/prospect/score'
import { ignorePlaceAction, marksForAction, saveLeadsAction, searchAction, type Mark } from './actions'

type Stored = { city: string; category: string; results: ProspectResult[]; nextPageToken?: string }

const SITE_LABEL: Record<SiteStatus, [string, Tone]> = {
  none: ['Sem site', 'green'],
  social: ['Só rede social', 'blue'],
  has_site: ['Tem site', 'gray'],
}
const TIER_LABEL: Record<Tier, [string, Tone]> = {
  alto: ['Potencial alto', 'green'],
  medio: ['Potencial médio', 'yellow'],
  baixo: ['Potencial baixo', 'gray'],
}

const SESSION_KEY = 'rokiai:prospect'
const CITY_KEY = 'rokiai:city'

function formatPhone(digits: string) {
  const d = digits.slice(2)
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
}

export function ProspectClient({ initialUsage, alertAt, pricePerRequest }: { initialUsage: number; alertAt: number; pricePerRequest: number }) {
  const [city, setCity] = useState('')
  const [category, setCategory] = useState('')
  const [data, setData] = useState<Stored | null>(null)
  const [marks, setMarks] = useState<Record<string, Mark>>({})
  const [error, setError] = useState<string | null>(null)
  const [usage, setUsage] = useState(initialUsage)
  const [showAll, setShowAll] = useState(false)
  const [showIgnored, setShowIgnored] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()
  const [loadingMore, setLoadingMore] = useState(false)

  // restaura cidade e a última busca da sessão (resultados não vão para o banco)
  useEffect(() => {
    try {
      const savedCity = localStorage.getItem(CITY_KEY)
      if (savedCity) setCity(savedCity)
      const raw = sessionStorage.getItem(SESSION_KEY)
      if (raw) {
        const s = JSON.parse(raw) as Stored
        setData(s)
        setCity(s.city)
        setCategory(s.category)
        marksForAction(s.results.map((r) => r.placeId)).then(setMarks)
      }
    } catch {}
  }, [])

  function persist(s: Stored) {
    setData(s)
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(s))
      localStorage.setItem(CITY_KEY, s.city)
    } catch {}
  }

  async function refreshMarks(results: ProspectResult[]) {
    setMarks(await marksForAction(results.map((r) => r.placeId)))
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSelected(new Set())
    startTransition(async () => {
      const r = await searchAction(city, category)
      if (r.usage !== undefined) setUsage(r.usage)
      if (!r.ok) {
        setError(r.error)
        return
      }
      const s = { city: city.trim(), category: category.trim(), results: r.results, nextPageToken: r.nextPageToken }
      persist(s)
      await refreshMarks(r.results)
    })
  }

  async function onLoadMore() {
    if (!data?.nextPageToken) return
    setLoadingMore(true)
    try {
      const r = await searchAction(data.city, data.category, data.nextPageToken)
      if (r.usage !== undefined) setUsage(r.usage)
      if (!r.ok) return void setError(r.error)
      const seen = new Set(data.results.map((x) => x.placeId))
      const merged = [...data.results, ...r.results.filter((x) => !seen.has(x.placeId))].sort((a, b) => b.score - a.score)
      persist({ ...data, results: merged, nextPageToken: r.nextPageToken })
      await refreshMarks(merged)
    } finally {
      setLoadingMore(false)
    }
  }

  async function save(items: ProspectResult[]) {
    if (!data || !items.length) return
    const { saved } = await saveLeadsAction(
      items.map((i) => ({ placeId: i.placeId, name: i.name, phone: i.phone })),
      data.city,
      data.category,
    )
    toast.success(saved === 1 ? '1 lead salvo' : `${saved} leads salvos`)
    setSelected(new Set())
    await refreshMarks(data.results)
  }

  async function toggleIgnore(r: ProspectResult, ignore: boolean) {
    await ignorePlaceAction(r.placeId, ignore)
    if (data) await refreshMarks(data.results)
  }

  const visible = useMemo(() => {
    if (!data) return []
    return data.results.filter((r) => {
      if (!showAll && r.siteStatus === 'has_site') return false
      if (!showIgnored && marks[r.placeId]?.kind === 'ignorado') return false
      return true
    })
  }, [data, marks, showAll, showIgnored])

  const hidden = (data?.results.length ?? 0) - visible.length
  const selectable = visible.filter((r) => !marks[r.placeId])
  const selectedItems = visible.filter((r) => selected.has(r.placeId))

  return (
    <div className="space-y-4">
      {usage >= alertAt && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Você já fez {usage} buscas no Google este mês (≈ US$ {(usage * pricePerRequest).toFixed(2)}).
        </div>
      )}

      <Card>
        <form onSubmit={onSearch} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <Label htmlFor="city">Cidade</Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex.: Campinas, SP" required />
          </div>
          <div>
            <Label htmlFor="category">Categoria</Label>
            <Input id="category" list="categories" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex.: Barbearia" required />
            <datalist id="categories">
              {CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar
          </Button>
        </form>
        <p className="mt-2 text-xs text-zinc-500">Buscas no Google este mês: {usage}</p>
      </Card>

      {error && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-zinc-600 dark:text-zinc-400">
              <strong>{visible.length}</strong> de {data.results.length} em “{data.category} em {data.city}”
              {hidden > 0 && <> · {hidden} ocultos</>}
            </p>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Mostrar quem tem site
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={showIgnored} onChange={(e) => setShowIgnored(e.target.checked)} /> Mostrar ignorados
              </label>
            </div>
          </div>

          {selectable.length > 0 && (
            <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg bg-white/90 p-2 backdrop-blur dark:bg-zinc-900/90">
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={selectedItems.length > 0 && selectedItems.length === selectable.length}
                  onChange={(e) => setSelected(e.target.checked ? new Set(selectable.map((r) => r.placeId)) : new Set())}
                />
                Selecionar todos
              </label>
              {selectedItems.length > 0 && (
                <Button size="sm" onClick={() => save(selectedItems)}>
                  <Plus className="h-4 w-4" /> Salvar {selectedItems.length} selecionados
                </Button>
              )}
            </div>
          )}

          {data.results.length === 0 && <p className="py-8 text-center text-zinc-500">Nenhum comércio encontrado para essa busca.</p>}

          <ul className="grid gap-3 md:grid-cols-2">
            {visible.map((r) => {
              const mark = marks[r.placeId]
              const [siteLabel, siteTone] = SITE_LABEL[r.siteStatus]
              const [tierLabel, tierTone] = TIER_LABEL[r.tier]
              return (
                <li key={r.placeId}>
                  <Card className="flex h-full flex-col gap-2" data-testid="prospect-card">
                    <div className="flex items-start gap-2">
                      {!mark && (
                        <input
                          type="checkbox"
                          aria-label={`Selecionar ${r.name}`}
                          className="mt-1.5"
                          checked={selected.has(r.placeId)}
                          onChange={(e) => {
                            const next = new Set(selected)
                            if (e.target.checked) next.add(r.placeId)
                            else next.delete(r.placeId)
                            setSelected(next)
                          }}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold leading-tight">{r.name}</h3>
                        <p className="truncate text-xs text-zinc-500">{r.address}</p>
                      </div>
                      <Badge tone={tierTone} title={`Nota ${r.score}/100`}>
                        {tierLabel} · {r.score}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-sm">
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {r.rating?.toFixed(1) ?? '–'} <span className="text-zinc-500">({r.ratingsCount})</span>
                      </span>
                      <Badge tone={siteTone}>{siteLabel}</Badge>
                      {r.phone ? (
                        <Badge tone={r.phone.isMobile ? 'green' : 'gray'}>
                          <Phone className="h-3 w-3" /> {formatPhone(r.phone.digits)} · {r.phone.isMobile ? 'celular' : 'fixo'}
                        </Badge>
                      ) : (
                        <Badge>sem telefone</Badge>
                      )}
                      {mark?.kind === 'lead' && <Badge tone="violet">Lead · {STAGE_LABEL[mark.stage!]}</Badge>}
                      {mark?.kind === 'cliente' && <Badge tone="violet">Cliente</Badge>}
                      {mark?.kind === 'ignorado' && <Badge>Ignorado</Badge>}
                    </div>
                    <div className="mt-auto flex flex-wrap gap-2 pt-1">
                      {!mark && (
                        <Button size="sm" onClick={() => save([r])}>
                          <Plus className="h-4 w-4" /> Salvar lead
                        </Button>
                      )}
                      {mark?.leadId && (
                        <Link href={`/leads/${mark.leadId}`} className="inline-flex h-8 items-center rounded-lg border border-zinc-300 px-3 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
                          Abrir lead
                        </Link>
                      )}
                      {!mark && (
                        <Button size="sm" variant="ghost" onClick={() => toggleIgnore(r, true)}>
                          <EyeOff className="h-4 w-4" /> Ignorar
                        </Button>
                      )}
                      {mark?.kind === 'ignorado' && (
                        <Button size="sm" variant="ghost" onClick={() => toggleIgnore(r, false)}>
                          <Eye className="h-4 w-4" /> Desfazer
                        </Button>
                      )}
                      <a href={r.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
                        <ExternalLink className="h-3.5 w-3.5" /> Maps
                      </a>
                    </div>
                  </Card>
                </li>
              )
            })}
          </ul>

          {data.nextPageToken && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={onLoadMore} disabled={loadingMore}>
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />} Carregar mais 20 (nova busca no Google)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
