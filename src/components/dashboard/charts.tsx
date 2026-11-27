'use client'
import { useSyncExternalStore } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatBRL } from '@/lib/format'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const label = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}`
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(n))

// Cores por papel (paleta de referência validada): slot 1 azul, slot 2 laranja.
// Resolvidas dos tokens CSS (claro/escuro) para valores concretos usados nos atributos SVG.
const LIGHT = { setup: '#257de0', monthly: '#f47230', grid: '#ececec', axis: '#737373', surface: '#ffffff', hover: 'rgba(0,0,0,0.04)' }
const DARK = { setup: '#338ced', monthly: '#e76624', grid: '#2a2a2e', axis: '#a1a1aa', surface: '#18181b', hover: 'rgba(255,255,255,0.06)' }
const query = '(prefers-color-scheme: dark)'
function subscribe(cb: () => void) {
  const mq = window.matchMedia(query)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
function useColors() {
  const dark = useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false)
  return dark ? DARK : LIGHT
}

type TooltipRow = { name?: string | number; value?: number | string; color?: string; dataKey?: string | number }

function Tip({ active, payload, label: l }: { active?: boolean; payload?: TooltipRow[]; label?: string }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + Number(p.value ?? 0), 0)
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-md dark:border-zinc-700 dark:bg-zinc-900">
      <p className="mb-1 font-medium">{label(String(l))}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-zinc-500">{p.name}</span>
          <span className="ml-auto pl-3 font-medium tabular-nums">{formatBRL(Number(p.value))}</span>
        </p>
      ))}
      {payload.length > 1 && (
        <p className="mt-1 flex border-t border-zinc-100 pt-1 font-medium dark:border-zinc-800">
          Total <span className="ml-auto tabular-nums">{formatBRL(total)}</span>
        </p>
      )}
    </div>
  )
}

export function RevenueChart({ data }: { data: { month: string; setup: number; monthly: number }[] }) {
  const C = useColors()
  return (
    <div className="viz-root">
      <div className="mb-2 flex gap-4 text-xs text-zinc-600 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: C.setup }} /> Implantação
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: C.monthly }} /> Mensalidade
        </span>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="25%">
            <CartesianGrid vertical={false} stroke={C.grid} />
            <XAxis dataKey="month" tickFormatter={label} tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} width={44} />
            <Tooltip content={<Tip />} cursor={{ fill: C.hover }} />
            <Bar dataKey="monthly" name="Mensalidade" stackId="r" fill={C.monthly} stroke={C.surface} strokeWidth={2} />
            <Bar dataKey="setup" name="Implantação" stackId="r" fill={C.setup} stroke={C.surface} strokeWidth={2} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function MrrChart({ data }: { data: { month: string; mrr: number }[] }) {
  const C = useColors()
  const sparse = data.filter((d) => d.mrr > 0).length <= 2
  return (
    <div className="viz-root h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis dataKey="month" tickFormatter={label} tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} width={44} />
          <Tooltip content={<Tip />} cursor={{ stroke: C.axis, strokeDasharray: '3 3' }} />
          <Line
            type="linear"
            dataKey="mrr"
            name="MRR"
            stroke={C.setup}
            strokeWidth={2}
            dot={(p: { cx?: number; cy?: number; value?: number; index?: number }) =>
              sparse && Number(p.value) > 0 ? (
                <circle key={p.index} cx={p.cx} cy={p.cy} r={4} fill={C.setup} stroke={C.surface} strokeWidth={2} />
              ) : (
                <g key={p.index} />
              )
            }
            activeDot={{ r: 4, stroke: C.surface, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
