import { useEffect, useRef } from 'react'
import { formatLong, formatTime } from '../lib/dates.js'
import { colourFor } from '../lib/colours.js'
import { REQUEST_SOURCES } from '../lib/sources.js'
import DietaryEditor from './DietaryEditor.jsx'
import NotesEditor from './NotesEditor.jsx'

const FIELDS = [
  ['guest', 'Name of guest/s'],
  ['pax', 'Number of pax'],
  ['phone', 'Phone number'],
  ['address', 'Billing address'],
  ['chargeBack', 'Charge back authority'],
  ['dietary', 'Dietary requirements'],
  ['requested', 'Requested'],
  ['confirmation', 'Confirmation'],
]

const colourOf = (event) => event.colour || colourFor(event.title)

export default function ScheduleEditor({
  details,
  onDetails,
  events,
  onEvents,
  onRemoveEvent,
  focusEvent,
  bookings,
  activeBooking,
  onAddNote,
  onNotes,
  selected,
  onSelect,
}) {
  const focusRow = useRef(null)

  // An order clicked on the calendar can be well down a long list, so bring it
  // into view rather than leaving the panel wherever it was scrolled to.
  useEffect(() => {
    focusRow.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focusEvent])

  const sorted = [...events].sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
  const grouped = sorted.reduce((acc, event) => {
    ;(acc[event.date] ||= []).push(event)
    return acc
  }, {})
  const total = events.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  const guestOf = (event) => bookings.find((b) => b.id === event.bookingId)?.details?.guest || ''

  // Every write goes through the setter's own list, not the one this render was
  // given: a sync landing between keystrokes must not be typed back over.
  const update = (id, patch) => onEvents((list) => list.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  // Goes through onRemoveEvent so the deletion is recorded and does not come
  // back from another device on the next sync.
  const remove = (id) => (onRemoveEvent ? onRemoveEvent(id) : onEvents((list) => list.filter((e) => e.id !== id)))
  const addEvent = () => {
    const date = selected || sorted[0]?.date || new Date().toISOString().slice(0, 10)
    onEvents((list) => [
      ...list,
      {
        id: `manual-${Date.now()}`,
        bookingId: activeBooking?.id,
        colour: activeBooking?.colour || 'green',
        date,
        time: '12:00',
        title: 'New order',
        detail: '',
        amount: null,
      },
    ])
  }

  return (
    <>
      <section className="panel">
        <header className="panel-head">
          <h3>Orders</h3>
          <button type="button" className="ghost" onClick={addEvent}>+ Add</button>
        </header>

        {!sorted.length && <p className="muted">No orders yet. Import a form photo, or add one manually.</p>}

        {Object.entries(grouped).map(([date, dayEvents]) => (
          <div key={date} className={`day-block ${selected === date ? 'is-selected' : ''}`}>
            <button type="button" className="day-block-head" onClick={() => onSelect(date)}>
              {formatLong(date)}
              <span className="muted">{dayEvents.length}</span>
            </button>

            {dayEvents.map((event) => (
              <div
                className={`event-row ${event.bookingId === activeBooking?.id ? 'is-active' : ''} ${
                  event.id === focusEvent ? 'is-focus' : ''
                }`}
                key={event.id}
                ref={event.id === focusEvent ? focusRow : null}
              >
                <span className={`bullet ${colourOf(event)}`} title={guestOf(event)} />
                <input
                  className="cell time"
                  type="time"
                  value={event.time || ''}
                  onChange={(e) => update(event.id, { time: e.target.value })}
                />
                <input className="cell title" value={event.title} onChange={(e) => update(event.id, { title: e.target.value })} />
                <input
                  className="cell date"
                  type="date"
                  value={event.date}
                  onChange={(e) => update(event.id, { date: e.target.value })}
                />
                <input
                  className="cell amount"
                  inputMode="decimal"
                  placeholder="$"
                  value={event.amount ?? ''}
                  onChange={(e) => update(event.id, { amount: e.target.value === '' ? null : Number(e.target.value) })}
                />
                <button type="button" className="icon danger" onClick={() => remove(event.id)} aria-label="Remove order">
                  &times;
                </button>
                <label className="event-detail">
                  <span>
                    {guestOf(event) && bookings.length > 1 && <strong>{guestOf(event)} · </strong>}
                    {event.time && <strong>{formatTime(event.time)}</strong>}
                  </span>
                  <textarea
                    rows={Math.min(10, Math.max(2, (event.detail || '').split('\n').length))}
                    value={event.detail || ''}
                    placeholder="What the order is: items, quantities, anything the kitchen needs"
                    onChange={(e) => update(event.id, { detail: e.target.value })}
                  />
                </label>
              </div>
            ))}
          </div>
        ))}

        {!!events.length && (
          <p className="totals">
            All orders <strong>${total.toFixed(2)}</strong>
          </p>
        )}
      </section>

      <section className="panel">
        <h3>Details{activeBooking && details.guest ? `: ${details.guest}` : ''}</h3>
        {!activeBooking ? (
          <p className="muted">Import a form to fill these in.</p>
        ) : (
          <div className="fields">
            <label className="wide">
              <span>Requested by</span>
              <input
                list="request-sources"
                placeholder="Westside Hospital, Private Functions, Essence Suite…"
                value={details.requestedBy || ''}
                onChange={(e) => onDetails({ ...details, requestedBy: e.target.value })}
              />
              <datalist id="request-sources">
                {REQUEST_SOURCES.map((source) => (
                  <option key={source} value={source} />
                ))}
              </datalist>
              <span className="chips">
                {REQUEST_SOURCES.map((source) => (
                  <button
                    key={source}
                    type="button"
                    className={`chip ${details.requestedBy === source ? 'on' : ''}`}
                    onClick={() => onDetails({ ...details, requestedBy: source })}
                  >
                    {source}
                  </button>
                ))}
              </span>
            </label>
            {FIELDS.map(([key, label]) => (
              <label key={key}>
                <span>{label}</span>
                <input value={details[key] || ''} onChange={(e) => onDetails({ ...details, [key]: e.target.value })} />
              </label>
            ))}
            <label className="wide">
              <span>Email</span>
              <input
                value={(details.emails || []).join(', ')}
                onChange={(e) =>
                  onDetails({ ...details, emails: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
                }
              />
            </label>
          </div>
        )}
      </section>

      <NotesEditor
        bookings={bookings}
        activeBooking={activeBooking}
        events={events}
        onAddNote={onAddNote}
        onNotes={onNotes}
      />

      {activeBooking && (
        <DietaryEditor
          rows={details.dietaryList || []}
          onChange={(rows) => onDetails({ ...details, dietaryList: rows })}
        />
      )}
    </>
  )
}
