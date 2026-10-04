/**
 * Dates are stored as ISO strings / `YYYY-MM-DD`. Format them by slicing the
 * string rather than via `toLocaleDateString`, which would depend on the
 * runtime locale and can differ between server and client.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = value.slice(0, 10)
  const [y, m, d] = date.split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
}

export function formatMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(2)
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}