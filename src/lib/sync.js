// Client half of the shared store. Talks to /api/schedule, and merges rather
// than clobbers when two devices save at once.

const API = '/api/schedule'
export const KEY_STORE = 't-schedule/key'

export function loadPasscode() {
  try {
    return localStorage.getItem(KEY_STORE) || ''
  } catch {
    return ''
  }
}

export function savePasscode(value) {
  try {
    if (value) localStorage.setItem(KEY_STORE, value)
    else localStorage.removeItem(KEY_STORE)
  } catch {
    /* ignore */
  }
}

/**
 * Union by id, then remove anything either side deleted. Without the tombstone
 * list a delete on one device would be resurrected by the next device to sync.
 *
 * `preferLocal` decides who wins an id held by both. Pass false when this device
 * has no unsaved edits: its copy is then just a stale snapshot, and keeping it
 * would hide the other device's changes and push the old values back up.
 */
export function mergeStates(local, remote, { preferLocal = true } = {}) {
  const deleted = new Set([...(remote.deleted || []), ...(local.deleted || [])])
  const first = preferLocal ? local : remote
  const second = preferLocal ? remote : local

  const bookings = []
  const seenBooking = new Set()
  for (const booking of [...(first.bookings || []), ...(second.bookings || [])]) {
    if (deleted.has(booking.id) || seenBooking.has(booking.id)) continue
    seenBooking.add(booking.id)
    bookings.push(booking)
  }

  const bookingIds = new Set(bookings.map((b) => b.id))
  const events = []
  const seenEvent = new Set()
  for (const event of [...(first.events || []), ...(second.events || [])]) {
    if (deleted.has(event.id) || seenEvent.has(event.id)) continue
    // An event whose booking was removed elsewhere goes with it.
    if (event.bookingId && !bookingIds.has(event.bookingId)) continue
    seenEvent.add(event.id)
    events.push(event)
  }

  return { bookings, events, deleted: [...deleted].slice(-500) }
}

/** Same data, ignoring key order, so a pull does not trigger a pointless push. */
export function fingerprint(state) {
  const bookings = [...(state.bookings || [])]
    .map((b) => `${b.id}:${JSON.stringify(b.details || {})}:${b.colour || ''}:${(b.rawText || '').length}`)
    .sort()
  const events = [...(state.events || [])]
    .map((e) => `${e.id}:${e.bookingId}:${e.date}:${e.time}:${e.title}:${e.amount ?? ''}:${(e.detail || '').length}`)
    .sort()
  return JSON.stringify([bookings, events, [...(state.deleted || [])].sort()])
}

async function request(method, passcode, body) {
  const res = await fetch(API, {
    method,
    headers: { 'x-schedule-key': passcode, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  let payload = null
  try {
    payload = await res.json()
  } catch {
    /* HTML error page from a host that has no function deployed */
  }
  return { res, payload }
}

export async function pullRemote(passcode) {
  try {
    const { res, payload } = await request('GET', passcode)
    if (res.status === 401) return { status: 'unauthorised' }
    if (res.status === 503) return { status: 'not_configured', message: payload?.message }
    if (res.status === 404 || !payload) return { status: 'unavailable' }
    if (!res.ok) return { status: 'error', message: payload?.error }
    return { status: 'ok', version: payload.version, state: payload.state, updatedAt: payload.updatedAt }
  } catch (err) {
    return { status: 'offline', message: err.message }
  }
}

export async function pushRemote(state, baseVersion, passcode) {
  try {
    const { res, payload } = await request('PUT', passcode, { baseVersion, state })
    if (res.status === 401) return { status: 'unauthorised' }
    if (res.status === 503) return { status: 'not_configured', message: payload?.message }
    if (res.status === 409) return { status: 'conflict', version: payload.version, state: payload.state }
    if (res.status === 413) return { status: 'too_large', message: payload?.message }
    if (res.status === 404 || !payload) return { status: 'unavailable' }
    if (!res.ok) return { status: 'error', message: payload?.error }
    return { status: 'ok', version: payload.version, updatedAt: payload.updatedAt }
  } catch (err) {
    return { status: 'offline', message: err.message }
  }
}

/** Push, and on a clash pull, merge and push once more. */
export async function syncUp(state, baseVersion, passcode) {
  const first = await pushRemote(state, baseVersion, passcode)
  if (first.status !== 'conflict') return { ...first, state }

  const merged = mergeStates(state, first.state)
  const second = await pushRemote(merged, first.version, passcode)
  return { ...second, state: merged, merged: true }
}
