// Date helpers. Everything user facing is Australian: DD/MM/YYYY, weeks start Monday.

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const MONTH_LOOKUP = (() => {
  const map = new Map()
  MONTHS.forEach((name, i) => {
    const lower = name.toLowerCase()
    map.set(lower, i)
    map.set(lower.slice(0, 3), i)
  })
  map.set('sept', 8)
  return map
})()

export function monthIndex(word) {
  if (!word) return null
  const key = word.toLowerCase().replace(/\./g, '')
  if (MONTH_LOOKUP.has(key)) return MONTH_LOOKUP.get(key)
  // Handle truncated OCR output such as "Augus" or "Septemb".
  for (const [name, i] of MONTH_LOOKUP) {
    if (name.length >= 3 && key.length >= 3 && name.startsWith(key)) return i
  }
  return null
}

/** 'YYYY-MM-DD' for a local date, avoiding the UTC shift of toISOString(). */
export function toKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(date, n) {
  const next = new Date(date)
  next.setDate(next.getDate() + n)
  return next
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1)
}

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Monday of the week `date` sits in. */
export function startOfWeek(date) {
  const offset = (date.getDay() + 6) % 7
  return addDays(new Date(date.getFullYear(), date.getMonth(), date.getDate()), -offset)
}

export function weekDays(date) {
  const start = startOfWeek(date)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** Monday-first 6x7 grid covering the month that `date` sits in. */
export function monthGrid(date) {
  const first = startOfMonth(date)
  const offset = (first.getDay() + 6) % 7 // Sunday=0 -> 6
  const start = addDays(first, -offset)
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export function formatLong(key) {
  const d = fromKey(key)
  const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()]
  return `${weekday} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function formatDayMonth(key) {
  const d = fromKey(key)
  const weekday = WEEKDAYS_SHORT[(d.getDay() + 6) % 7]
  return `${weekday} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`
}

export function formatShort(key) {
  const d = fromKey(key)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

/** '11:00' -> '11:00am'. Blank stays blank. */
export function formatTime(hhmm) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h < 12 ? 'am' : 'pm'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')}${suffix}`
}

/** ISO timestamp -> '14/08/2026 3:40pm'. Blank or unreadable stays blank. */
export function formatStamp(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const day = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  return `${day} ${formatTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)}`
}

/** Days between two keys, inclusive, capped so a bad OCR read cannot explode the list. */
export function expandRange(startKey, endKey, cap = 60) {
  const out = []
  let cursor = fromKey(startKey)
  const end = fromKey(endKey)
  if (end < cursor) return [startKey]
  while (cursor <= end && out.length < cap) {
    out.push(toKey(cursor))
    cursor = addDays(cursor, 1)
  }
  return out
}
