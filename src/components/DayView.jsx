import { formatLong, formatTime, toKey } from '../lib/dates.js'
import { colourFor } from '../lib/colours.js'
import BookingBrief from './BookingBrief.jsx'

/** Hour rail for one day, so a pick-up run can be read at a glance. */
export default function DayView({ anchor, events, bookings = [], onOpenEvent }) {
  const key = typeof anchor === 'string' ? anchor : toKey(anchor)
  const items = events.filter((e) => e.date === key).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  const hours = items.length
    ? Array.from({ length: 24 }, (_, h) => h).filter((h) => h >= Math.max(0, Math.min(...items.map((e) => +(e.time || '08:00').slice(0, 2))) - 1) && h <= Math.min(23, Math.max(...items.map((e) => +(e.time || '18:00').slice(0, 2))) + 2))
    : Array.from({ length: 12 }, (_, i) => i + 7)

  return (
    <div className="day-view">
      <header className="day-view-head">
        <h2>{formatLong(key)}</h2>
        <span className="muted">
          {items.length ? `${items.length} order${items.length > 1 ? 's' : ''}` : 'Nothing booked'}
        </span>
      </header>

      <BookingBrief bookings={bookings} events={events} date={key} />

      <div className="hours">
        {hours.map((hour) => (
          <div key={hour} className="hour">
            <span className="hour-label">{formatTime(`${String(hour).padStart(2, '0')}:00`)}</span>
            <div className="hour-slot">
              {items
                .filter((e) => +(e.time || '').slice(0, 2) === hour)
                .map((event) => (
                  <button
                    type="button"
                    key={event.id}
                    className={`slot ${event.colour || colourFor(event.title)}`}
                    title="Click to edit this order"
                    onClick={() => onOpenEvent?.(event)}
                  >
                    <strong>
                      {formatTime(event.time)} {event.title}
                    </strong>
                    {event.detail && <p>{event.detail}</p>}
                    {event.amount != null && <p className="slot-amount">${Number(event.amount).toFixed(2)}</p>}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
