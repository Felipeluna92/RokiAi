import { describe, expect, it } from 'vitest'
import { fetchAllPages } from './paginate'

describe('fetchAllPages', () => {
  it('junta páginas até vir uma incompleta', async () => {
    const rows = Array.from({ length: 2345 }, (_, i) => i)
    const calls: [number, number][] = []
    const all = await fetchAllPages(async (from, to) => {
      calls.push([from, to])
      return { data: rows.slice(from, to + 1), error: null }
    }, 1000)
    expect(all).toHaveLength(2345)
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
  })
  it('propaga erro', async () => {
    await expect(fetchAllPages(async () => ({ data: null, error: { message: 'boom' } }))).rejects.toThrow('boom')
  })
})
