import { Star } from 'lucide-react'

export function Stars({ rating, count }: { rating: number | null; count: number | null }) {
  if (rating == null) return <span className="text-xs text-zinc-400">★ –</span>
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium">
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      {Number(rating).toFixed(1)}
      <span className="text-xs font-normal text-zinc-500">({count ?? 0})</span>
    </span>
  )
}
