// Client half of the shared store. Talks to /api/schedule, and merges rather
// than clobbers when two devices save at once.

import { mergeNotes } from './notes.js'

const API = '/api/schedule'
export const KEY_STORE = 't-schedule/key'
export const META_STORE = 't-schedule/sync'

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

/* ------------------------------------------------------- change detection */

/** FNV-1a, so what is remembered about the last sync stays a few bytes per item. */
function hash(text) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

// Detail and form text are edited by hand, so the whole string counts: a typo
// fix that keeps the length the same is still a change other devices need.
const bookingPrint = (b) => `${JSON.stringify(b.details || {})}:${b.colour || ''}:${JSON.stringify(b.rawText || '')}`
const eventPrint = (e) =>
  `${e.bookingId}:${e.date}:${e.time}:${e.title}:${e.amount ?? ''}:${e.colour || ''}:${JSON.stringify(e.detail || '')}`

/** Same data, ignoring key order, so a pull does not trigger a pointless push. */
export function fingerprint(state) {
  const bookings = [...(state.bookings || [])].map((b) => `${b.id}:${bookingPrint(b)}`).sort()
  const events = [...(state.events || [])].map((e) => `${e.id}:${eventPrint(e)}`).sort()
  return JSON.stringify([bookings, events, [...(state.deleted || [])].sort()])
}

/** The whole state in a few characters, for "has anything changed since the last sync". */
export function printOf(state) {
  return hash(fingerprint(state))
}

/**
 * One hash per booking and per order. Kept from the last sync, this is what
 * tells a later merge which side actually changed a shared id, instead of
 * guessing from whether the device as a whole has unsaved edits.
 */
export function itemPrints(state) {
  const base = {}
  for (const b of state.bookings || []) base[`b:${b.id}`] = hash(bookingPrint(b))
  for (const e of state.events || []) base[`e:${e.id}`] = hash(eventPrint(e))
  return base
}

/**
 * What this device last had in common with the shared copy: the version it was
 * based on, and a hash per item. Held in localStorage rather than memory, or a
 * reload would look like a device full of unsaved edits and push its stale
 * snapshot back over everyone else's work.
 */
export function loadSyncMeta() {
  try {
    const saved = JSON.parse(localStorage.getItem(META_STORE) || 'null')
    if (!saved || typeof saved.version !== 'number') return { version: 0, print: '', base: null }
    return { version: saved.version, print: saved.print || '', base: saved.base || null }
  } catch {
    return { version: 0, print: '', base: null }
  }
}

export function saveSyncMeta(meta) {
  try {
    localStorage.setItem(META_STORE, JSON.stringify({ v: 1, ...meta }))
  } catch {
    /* private mode or quota: the merge just falls back to the older guess */
  }
}

export function clearSyncMeta() {
  try {
    localStorage.removeItem(META_STORE)
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ merge */

/**
 * Union by id, then remove anything either side deleted. Without the tombstone
 * list a delete on one device would be resurrected by the next device to sync.
 *
 * `base` is the per-item state of the last sync. When it says only one side
 * changed an id, that side wins, whatever the rest of the device is doing: an
 * untouched order is never pushed back over someone else's edit to it.
 *
 * `preferLocal` is the fallback for an id `base` says nothing about, or that both
 * sides changed. Pass false when this device has no unsaved edits at all: its
 * copy is then just a stale snapshot.
 */
export function mergeStates(local, remote, { preferLocal = true, base = null } = {}) {
  const deleted = new Set([...(remote.deleted || []), ...(local.deleted || [])])

  const winner = (kind, print, mine, theirs) => {
    if (!mine) return theirs
    if (!theirs) return mine
    const was = base?.[`${kind}:${mine.id}`]
    if (was !== undefined) {
      const mineChanged = hash(print(mine)) !== was
      const theirsChanged = hash(print(theirs)) !== was
      if (mineChanged !== theirsChanged) return mineChanged ? mine : theirs
    }
    return preferLocal ? mine : theirs
  }

  const index = (list) => new Map((list || []).map((item) => [item.id, item]))
  const idsIn = (...lists) => {
    const ids = []
    const seen = new Set()
    for (const list of lists) {
      for (const item of list || []) {
        if (seen.has(item.id)) continue
        seen.add(item.id)
        ids.push(item.id)
      }
    }
    return ids
  }

  const localBookings = index(local.bookings)
  const remoteBookings = index(remote.bookings)
  const bookingIdOrder = preferLocal
    ? idsIn(local.bookings, remote.bookings)
    : idsIn(remote.bookings, local.bookings)

  const bookings = []
  for (const id of bookingIdOrder) {
    if (deleted.has(id)) continue
    const mine = localBookings.get(id)
    const theirs = remoteBookings.get(id)
    const held = winner('b', bookingPrint, mine, theirs)
    const other = held === mine ? theirs : mine
    // The winner keeps its fields, but notes are written as the day goes on and
    // often on two devices at once, so they are unioned rather than dropped.
    const details = other ? mergeNotes(held.details || {}, other.details || {}) : held.details
    bookings.push(details === held.details ? { ...held } : { ...held, details })
  }

  const bookingIds = new Set(bookings.map((b) => b.id))
  const localEvents = index(local.events)
  const remoteEvents = index(remote.events)
  const eventIdOrder = preferLocal ? idsIn(local.events, remote.events) : idsIn(remote.events, local.events)

  const events = []
  for (const id of eventIdOrder) {
    if (deleted.has(id)) continue
    const held = winner('e', eventPrint, localEvents.get(id), remoteEvents.get(id))
    // An event whose booking was removed elsewhere goes with it.
    if (held.bookingId && !bookingIds.has(held.bookingId)) continue
    events.push(held)
  }

  return { bookings, events, deleted: [...deleted].slice(-500) }
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
export async function syncUp(state, baseVersion, passcode, base = null) {
  const first = await pushRemote(state, baseVersion, passcode)
  if (first.status !== 'conflict') return { ...first, state }

  // The other device saved first. Its edits stand where this device did not
  // touch the same order, which `base` is what makes knowable.
  const merged = mergeStates(state, first.state, { base })
  const second = await pushRemote(merged, first.version, passcode)
  return { ...second, state: merged, merged: true }
}
