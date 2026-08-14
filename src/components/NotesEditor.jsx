import { useEffect, useState } from 'react'
import { noteList } from '../lib/notes.js'
import { formatShort, formatStamp } from '../lib/dates.js'

/**
 * Notes for one booking, added as the day goes on. The booking a note attaches to
 * is picked here rather than by switching tabs, so a note can be written down the
 * moment it is heard without losing the booking being edited.
 */
export default function NotesEditor({ bookings, activeBooking, events, onAddNote, onNotes }) {
  const [draft, setDraft] = useState('')
  const [pinned, setPinned] = useState('') // '' follows the booking being edited

  // Switching booking brings the panel back with it; choosing one here pins it.
  useEffect(() => setPinned(''), [activeBooking?.id])

  const target = bookings.find((b) => b.id === pinned) || activeBooking
  const notes = target ? noteList(target.details || {}) : []

  const write = (list) => onNotes(target.id, list)
  const add = () => {
    if (!draft.trim() || !target) return
    onAddNote(target.id, draft)
    setDraft('')
  }

  const optionLabel = (booking) => {
    const name = booking.details?.guest || 'Untitled booking'
    const own = events.filter((e) => e.bookingId === booking.id).map((e) => e.date).sort()
    const days = new Set(own).size
    return `${name}${own.length ? ` · ${formatShort(own[0])}${days > 1 ? ` +${days - 1}` : ''}` : ' · no dates'}`
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h3>Notes</h3>
        <span className="muted">{notes.length ? `${notes.length} note${notes.length === 1 ? '' : 's'}` : 'None yet'}</span>
      </header>

      {!target ? (
        <p className="muted">Import a form first, then notes can be added to it.</p>
      ) : (
        <>
          <label className="note-target">
            <span>Attach to</span>
            <select value={target.id} onChange={(e) => setPinned(e.target.value)}>
              {bookings.map((booking) => (
                <option key={booking.id} value={booking.id}>
                  {optionLabel(booking)}
                </option>
              ))}
            </select>
          </label>

          <div className="note-add">
            <textarea
              rows={2}
              value={draft}
              placeholder="Anything staff need on the day: access, contact, setup, a change over the phone"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) add()
              }}
            />
            <button type="button" className="ghost" disabled={!draft.trim()} onClick={add}>
              Add note
            </button>
          </div>

          {!notes.length ? (
            <p className="muted">No notes on this booking yet.</p>
          ) : (
            <ul className="note-list">
              {notes.map((note) => (
                <li className="note-item" key={note.id}>
                  <div className="note-meta">
                    <span>{note.source === 'form' ? 'Read off the form' : formatStamp(note.at) || 'Added'}</span>
                    <button
                      type="button"
                      className="icon danger"
                      aria-label="Remove note"
                      onClick={() => write(notes.filter((n) => n.id !== note.id))}
                    >
                      &times;
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={note.text}
                    onChange={(e) => write(notes.map((n) => (n.id === note.id ? { ...n, text: e.target.value } : n)))}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
