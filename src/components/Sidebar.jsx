import MiniMonth from './MiniMonth.jsx'
import { colourFor } from '../lib/colours.js'
import { bookingLabel } from '../lib/bookings.js'
import { formatLong, formatShort, formatTime, toKey, addDays, fromKey, startOfMonth } from '../lib/dates.js'

function agendaHeading(key) {
  const today = toKey(new Date())
  const tomorrow = toKey(addDays(new Date(), 1))
  if (key === today) return 'TODAY'
  if (key === tomorrow) return 'TOMORROW'
  return formatLong(key).toUpperCase()
}

const colourOf = (event) => event.colour || colourFor(event.title)

/** Dark rail: mini month, the run sheet for every booked day, and the booking list. */
export default function Sidebar({
  month,
  onMonthChange,
  events,
  bookings,
  sources,
  sourceFilter,
  onSourceFilter,
  activeId,
  onActivate,
  onRemoveBooking,
  selected,
  onSelect,
  onImport,
}) {
  const bookedDays = [...new Set(events.map((e) => e.date))].sort()
  const upcoming = bookedDays.map((day) => ({
    day,
    items: events.filter((e) => e.date === day).sort((a, b) => (a.time || '').localeCompare(b.time || '')),
  }))

  return (
    <aside className="sidebar">
      <header className="sidebar-head">
        <span className="sidebar-brand">Tamrab Thai</span>
        <button type="button" className="round" onClick={onImport} title="Import another form photo">
          +
        </button>
      </header>

      <MiniMonth
        month={month}
        bookedDays={bookedDays}
        selected={selected}
        onSelect={onSelect}
        onMonthChange={onMonthChange}
      />

      <div className="agenda">
        {!upcoming.length && <p className="agenda-empty">No bookings loaded. Press + to import a catering form.</p>}
        {upcoming.map(({ day, items }) => (
          <section key={day} className={`agenda-day ${selected === day ? 'on' : ''}`}>
            <button
              type="button"
              className="agenda-date"
              onClick={() => {
                onSelect(day)
                onMonthChange(startOfMonth(fromKey(day)))
              }}
            >
              {agendaHeading(day)}
            </button>
            {items.map((event) => (
              <button
                type="button"
                key={event.id}
                className="agenda-item"
                onClick={() => {
                  onSelect(day)
                  onActivate(event.bookingId)
                }}
              >
                <span className={`bullet ${colourOf(event)}`} />
                <span className="agenda-time">{formatTime(event.time) || 'TBC'}</span>
                <span className="agenda-title">{event.title}</span>
              </button>
            ))}
          </section>
        ))}
      </div>

      {sources.length > 1 && (
        <div className="rail-filter">
          <span className="rail-label">Requested by</span>
          <div className="rail-chips">
            <button type="button" className={!sourceFilter ? 'on' : ''} onClick={() => onSourceFilter('')}>
              All
            </button>
            {sources.map((source) => (
              <button
                key={source}
                type="button"
                className={sourceFilter === source ? 'on' : ''}
                onClick={() => onSourceFilter(sourceFilter === source ? '' : source)}
              >
                {source}
              </button>
            ))}
          </div>
        </div>
      )}

      {!!bookings.length && (
        <div className="rail-bookings">
          <span className="rail-label">Bookings ({bookings.length})</span>
          {bookings.map((booking) => {
            const { name, days, orders } = bookingLabel(booking, events)
            const own = events.filter((e) => e.bookingId === booking.id).map((e) => e.date).sort()
            return (
              <div key={booking.id} className={`rail-booking ${booking.id === activeId ? 'on' : ''}`}>
                <button type="button" className="rail-booking-main" onClick={() => onActivate(booking.id)}>
                  <span className={`bullet ${booking.colour || 'green'}`} />
                  <span className="rail-booking-text">
                    <strong>{name}</strong>
                    <span>
                      {own.length ? `${formatShort(own[0])}${days > 1 ? ` +${days - 1}` : ''}` : 'no dates'} · {orders} order
                      {orders === 1 ? '' : 's'}
                    </span>
                    {booking.details?.requestedBy && <span className="rail-source">{booking.details.requestedBy}</span>}
                    {!!booking.details?.dietaryList?.length && (
                      <span className="rail-source">
                        {booking.details.dietaryList.filter((r) => r.requirement).length} dietary
                      </span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  className="rail-remove"
                  title={`Remove ${name}`}
                  onClick={() => onRemoveBooking(booking.id)}
                >
                  &times;
                </button>
              </div>
            )
          })}
        </div>
      )}
    </aside>
  )
}
