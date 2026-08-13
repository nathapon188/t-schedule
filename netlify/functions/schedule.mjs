// Shared bookings store: one JSON document in Netlify Blobs, guarded by a
// passcode. Every device that knows the passcode reads and writes the same
// calendar, so nothing has to be passed around as a link.
//
// Set SCHEDULE_PASSCODE in the Netlify site settings. Without it the function
// refuses every request rather than serving customer details openly.
//
//   GET  /api/schedule  -> { version, state }
//   PUT  /api/schedule  -> { baseVersion, state } -> { version }
//                          409 with the current copy if someone else saved first

import { getStore } from '@netlify/blobs'

const KEY = 'bookings'
const MAX_BYTES = 512 * 1024

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

/** Length-independent compare, so the response time gives nothing away. */
function sameSecret(a = '', b = '') {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const emptyDoc = { version: 0, state: { bookings: [], events: [], deleted: [] }, updatedAt: null }

export default async function handler(req) {
  const expected = process.env.SCHEDULE_PASSCODE
  if (!expected) {
    return json({ error: 'not_configured', message: 'SCHEDULE_PASSCODE is not set on this site.' }, 503)
  }

  const supplied = req.headers.get('x-schedule-key') || ''
  if (!sameSecret(supplied, expected)) {
    return json({ error: 'unauthorised' }, 401)
  }

  const store = getStore({ name: 'schedule', consistency: 'strong' })

  if (req.method === 'GET') {
    const doc = (await store.get(KEY, { type: 'json' })) || emptyDoc
    return json(doc)
  }

  if (req.method === 'PUT') {
    let body
    try {
      body = await req.json()
    } catch {
      return json({ error: 'bad_json' }, 400)
    }

    const { baseVersion, state } = body || {}
    if (!state || !Array.isArray(state.bookings) || !Array.isArray(state.events)) {
      return json({ error: 'bad_state' }, 400)
    }
    const payload = JSON.stringify(state)
    if (payload.length > MAX_BYTES) {
      return json({ error: 'too_large', message: 'Schedule is larger than 512KB.' }, 413)
    }

    const current = (await store.get(KEY, { type: 'json' })) || emptyDoc
    if (typeof baseVersion === 'number' && baseVersion !== current.version) {
      // Someone else saved in the meantime: hand back their copy to merge into.
      return json({ error: 'conflict', ...current }, 409)
    }

    const next = {
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
      state: { bookings: state.bookings, events: state.events, deleted: (state.deleted || []).slice(-500) },
    }
    await store.setJSON(KEY, next)
    return json({ version: next.version, updatedAt: next.updatedAt })
  }

  return json({ error: 'method_not_allowed' }, 405)
}

export const config = { path: '/api/schedule' }
