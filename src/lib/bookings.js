// Turning a parsed form into a booking that can sit alongside the ones already
// on the calendar, instead of replacing them.

import { EVENT_COLOURS } from './colours.js'

/** Same day, same time, same order title: a re-paste of a form already loaded. */
export function signature(event) {
  return `${event.date}|${event.time || ''}|${(event.title || '').trim().toLowerCase()}`
}

export function nextColour(bookings) {
  const used = bookings.map((b) => b.colour)
  return EVENT_COLOURS.find((c) => !used.includes(c)) || EVENT_COLOURS[bookings.length % EVENT_COLOURS.length]
}

export function bookingLabel(booking, events) {
  const own = events.filter((e) => e.bookingId === booking.id)
  const days = new Set(own.map((e) => e.date)).size
  const name = booking.details?.guest || 'Untitled booking'
  return { name, days, orders: own.length }
}

/**
 * Builds a booking plus its events from a parse result.
 * Duplicate orders (already on the calendar) are reported, not added twice.
 */
export function buildBooking(parsed, { bookings, events, rawText }) {
  const id = `b${Date.now().toString(36)}${Math.floor(performance.now() % 1000)}`
  const colour = nextColour(bookings)
  const seen = new Set(events.map(signature))

  const candidates = parsed.events.map((event, i) => ({
    ...event,
    id: `${id}-${i}`,
    bookingId: id,
    colour,
  }))
  const fresh = candidates.filter((event) => !seen.has(signature(event)))

  return {
    booking: { id, colour, details: parsed.details, rawText },
    events: fresh,
    duplicates: candidates.length - fresh.length,
  }
}
