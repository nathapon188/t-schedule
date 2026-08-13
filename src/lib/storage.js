// Persistence without a database or server:
//   1. localStorage      - this browser remembers every booking loaded so far
//   2. .json file        - save/open anywhere, including a shared drive
//   3. link in the URL   - the whole schedule rides in the hash, so a QR code
//                          or a pasted link opens it on another device
//   4. .ics export       - hand it to Outlook / Google Calendar (see ics.js)
//
// Stored shape (v2):
//   { v: 2, bookings: [{ id, details, rawText }], events: [{ ..., bookingId }] }
// v1 held a single booking; loadLocal migrates it.

export const STORE_KEY = 't-schedule/v1'

const DETAIL_KEYS = ['guest', 'pax', 'phone', 'emails', 'address', 'chargeBack', 'dietary', 'requestedBy', 'requested', 'confirmation', 'total']

export function emptyState() {
  return { v: 2, bookings: [], events: [] }
}

function migrate(saved) {
  if (!saved) return null
  if (Array.isArray(saved.bookings) && Array.isArray(saved.events)) return { v: 2, ...saved }
  // v1: one booking held at the top level.
  if (Array.isArray(saved.events)) {
    const id = 'b1'
    return {
      v: 2,
      bookings: [{ id, details: saved.details || {}, rawText: saved.rawText || '' }],
      events: saved.events.map((e) => ({ ...e, bookingId: e.bookingId || id, colour: e.colour || 'green' })),
    }
  }
  return null
}

export function loadLocal() {
  try {
    return migrate(JSON.parse(localStorage.getItem(STORE_KEY) || 'null'))
  } catch {
    return null
  }
}

export function saveLocal(state) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ v: 2, bookings: state.bookings, events: state.events }))
    return true
  } catch {
    return false // private mode or quota: not worth interrupting the user
  }
}

export function clearLocal() {
  try {
    localStorage.removeItem(STORE_KEY)
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------ url sharing */

function toBase64Url(bytes) {
  let bin = ''
  bytes.forEach((b) => {
    bin += String.fromCharCode(b)
  })
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4)
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

/** Trimmed to the fields worth carrying, so links stay short enough to scan. */
export function encodeState({ bookings = [], events = [] }) {
  const index = new Map(bookings.map((b, i) => [b.id, i]))
  const payload = {
    v: 2,
    b: bookings.map((b) => {
      const d = b.details || {}
      return {
        g: d.guest || undefined,
        p: d.pax || undefined,
        t: d.phone || undefined,
        e: d.emails?.length ? d.emails : undefined,
        a: d.address || undefined,
        c: d.chargeBack || undefined,
        di: d.dietary || undefined,
        rb: d.requestedBy || undefined,
        tot: d.total ?? undefined,
      }
    }),
    e: events.map((ev) => [
      index.get(ev.bookingId) ?? 0,
      ev.date,
      ev.time || '',
      ev.title || '',
      ev.detail || '',
      ev.amount ?? '',
      ev.colour || '',
    ]),
  }
  return toBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
}

function expandDetails(d = {}) {
  return {
    guest: d.g || '',
    pax: d.p || '',
    phone: d.t || '',
    emails: d.e || [],
    address: d.a || '',
    chargeBack: d.c || '',
    dietary: d.di || '',
    requestedBy: d.rb || '',
    requested: '',
    confirmation: '',
    total: d.tot ?? null,
  }
}

export function decodeState(encoded) {
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded)))
    if (!payload || !Array.isArray(payload.e)) return null

    // v1 links carried a single booking under `d`.
    const rawBookings = Array.isArray(payload.b) ? payload.b : [payload.d || {}]
    const bookings = rawBookings.map((d, i) => ({ id: `link${i}`, details: expandDetails(d), rawText: '' }))

    const events = payload.e.map((row, i) => {
      const [a, b, c, d, e, f, g] = row
      const hasIndex = typeof a === 'number'
      const [bi, date, time, title, detail, amount, colour] = hasIndex ? [a, b, c, d, e, f, g] : [0, a, b, c, d, e, f]
      return {
        id: `link-${i}-${date}`,
        bookingId: bookings[bi]?.id || bookings[0].id,
        date,
        time: time || '',
        title: title || '',
        detail: detail || '',
        amount: amount === '' || amount == null ? null : Number(amount),
        colour: colour || 'green',
      }
    })
    return { v: 2, bookings, events }
  } catch {
    return null
  }
}

/** Reads '#s=<payload>' from the current URL, if present. */
export function stateFromHash(hash = window.location.hash) {
  const match = hash.match(/[#&]s=([A-Za-z0-9\-_]+)/)
  return match ? decodeState(match[1]) : null
}

export function shareLink(state, base = window.location.href) {
  const url = new URL(base)
  url.hash = `s=${encodeState(state)}`
  return url.toString()
}

/* --------------------------------------------------------------- json file */

export function downloadJson(state, filename) {
  const first = state.events?.length ? [...state.events].map((e) => e.date).sort()[0] : 'schedule'
  const who = state.bookings?.[0]?.details?.guest || 'bookings'
  const name = filename || `catering-${who.replace(/[^\w]+/g, '-').toLowerCase()}-${first}.json`
  const blob = new Blob([JSON.stringify({ v: 2, bookings: state.bookings, events: state.events }, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export async function readJsonFile(file) {
  const parsed = migrate(JSON.parse(await file.text()))
  if (!parsed) throw new Error('Not a schedule file')
  return parsed
}

export { DETAIL_KEYS }
