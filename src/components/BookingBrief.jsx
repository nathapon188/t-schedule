import { dietarySummary } from '../lib/dietary.js'

/**
 * Notes and the dietary list for the bookings on one day: the bit the kitchen
 * actually needs, shown on the run sheet rather than hidden in the edit panel.
 */
export default function BookingBrief({ bookings, events, date }) {
  const ids = new Set(events.filter((e) => e.date === date).map((e) => e.bookingId))
  const relevant = bookings.filter(
    (b) => ids.has(b.id) && (b.details?.notes || b.details?.dietaryList?.length || b.details?.dietary),
  )
  if (!relevant.length) return null

  return (
    <div className="brief">
      {relevant.map((booking) => {
        const d = booking.details || {}
        const rows = d.dietaryList || []
        return (
          <section className="brief-card" key={booking.id}>
            <header>
              <span className={`bullet ${booking.colour || 'green'}`} />
              <strong>{d.guest || 'Booking'}</strong>
              {d.pax && <span className="muted">{d.pax}</span>}
            </header>

            {d.notes && <p className="brief-notes">{d.notes}</p>}

            {!!rows.length && (
              <>
                <p className="muted">{dietarySummary(rows)}</p>
                <ul className="brief-diet">
                  {rows.map((row, i) => (
                    <li key={i} className={row.requirement ? '' : 'plain'}>
                      <strong>{row.name}</strong>
                      {row.requirement && <span>{row.requirement}</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {!rows.length && d.dietary && <p className="muted">Dietary: {d.dietary}</p>}
          </section>
        )
      })}
    </div>
  )
}
