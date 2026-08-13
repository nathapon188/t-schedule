// Minimal RFC 5545 export. Times are written as floating local times so the
// file lands on the right clock time regardless of the importing calendar's zone.

import { fromKey } from './dates.js'

function escapeText(value = '') {
  return String(value).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function stamp(date) {
  const p = (n) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
    `T${p(date.getHours())}${p(date.getMinutes())}00`
  )
}

function stampUtc(date) {
  return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`
}

function fold(line) {
  if (line.length <= 74) return line
  const parts = []
  let rest = line
  while (rest.length > 74) {
    parts.push(rest.slice(0, 74))
    rest = ' ' + rest.slice(74)
  }
  parts.push(rest)
  return parts.join('\r\n')
}

export function buildIcs(events, bookings = [], { durationMinutes = 30 } = {}) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//t-Schedule//Catering//EN', 'CALSCALE:GREGORIAN']
  const detailsById = new Map(bookings.map((b) => [b.id, b.details || {}]))
  const fallback = bookings[0]?.details || {}

  events.forEach((event, i) => {
    const details = detailsById.get(event.bookingId) || fallback
    const day = fromKey(event.date)
    const allDay = !event.time
    const [h, m] = (event.time || '00:00').split(':').map(Number)
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h || 0, m || 0)
    const end = new Date(start.getTime() + durationMinutes * 60000)

    const summaryParts = [event.title]
    if (details.guest) summaryParts.push(details.guest)
    const description = [
      event.detail,
      details.requestedBy && `Requested by: ${details.requestedBy}`,
      details.pax && `Pax: ${details.pax}`,
      details.phone && `Phone: ${details.phone}`,
      details.emails?.length && `Email: ${details.emails.join(', ')}`,
      details.chargeBack && `Charge back: ${details.chargeBack}`,
      event.amount != null && `Amount: $${event.amount.toFixed(2)}`,
    ]
      .filter(Boolean)
      .join('\n')

    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.date.replace(/-/g, '')}-${i}@t-schedule`,
      `DTSTAMP:${stampUtc(new Date())}`,
      allDay
        ? `DTSTART;VALUE=DATE:${event.date.replace(/-/g, '')}`
        : `DTSTART:${stamp(start)}`,
      allDay ? '' : `DTEND:${stamp(end)}`,
      fold(`SUMMARY:${escapeText(summaryParts.filter(Boolean).join(' - '))}`),
      fold(`DESCRIPTION:${escapeText(description)}`),
      details.address ? fold(`LOCATION:${escapeText(details.address)}`) : '',
      'END:VEVENT',
    )
  })

  lines.push('END:VCALENDAR')
  return lines.filter(Boolean).join('\r\n')
}

export function downloadIcs(events, bookings, filename = 'catering-schedule.ics') {
  const blob = new Blob([buildIcs(events, bookings)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
