'use client'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Select } from '@/components/ui/input'
import { LEAD_SORTS, type LeadSort } from '@/lib/leads'

export function SortSelect({ value }: { value: LeadSort }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
      Ordenar por
      <Select
        aria-label="Ordenar por"
        className="h-9 w-auto"
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params)
          next.set('sort', e.target.value)
          router.replace(`${pathname}?${next}`)
        }}
      >
        {LEAD_SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </Select>
    </label>
  )
}
