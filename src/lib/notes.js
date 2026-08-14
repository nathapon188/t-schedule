// Notes on a booking.
//
// A form arrives with one block of notes, but most of what staff need is written
// afterwards: "ward rang, moved to 11:30", "second trolley needed". So a booking
// holds a list of notes rather than one box, each with the time it was written,
// and a new note is added to whichever booking is chosen at the time.
//
// details.notes (a plain string straight off the form) is the older shape. It is
// still read - old saves, old links and parse.js all produce it - and is folded
// into the list as the first entry the moment anything is written.

import { formatStamp } from './dates.js'

export const FORM_NOTE_ID = 'form'

export function noteId() {
  return `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** Every note on a booking, the one read off the form first. */
export function noteList(details = {}) {
  const list = Array.isArray(details.noteList) ? details.noteList : []
  const fromForm = String(details.notes || '').trim()
  if (!fromForm || list.some((n) => n.id === FORM_NOTE_ID)) return list
  return [{ id: FORM_NOTE_ID, at: '', text: fromForm, source: 'form' }, ...list]
}

/** Notes worth showing: an entry emptied while editing is not one. */
export function visibleNotes(details = {}) {
  return noteList(details).filter((n) => String(n.text || '').trim())
}

export function noteCount(details = {}) {
  return visibleNotes(details).length
}

/**
 * The single writer. Folding the form's note into the list here is what keeps it
 * from being shown twice once the list is used.
 */
export function setNotes(details = {}, list = []) {
  return { ...details, notes: '', noteList: list }
}

export function addNote(details = {}, text, at = new Date().toISOString()) {
  const body = String(text || '').trim()
  if (!body) return details
  return setNotes(details, [...noteList(details), { id: noteId(), at, text: body }])
}

/**
 * Both bookings' notes end to end, for folding one booking into another. An id
 * already in use is re-keyed: two different bookings each have a form note.
 */
export function concatNotes(into = {}, from = {}) {
  const mine = noteList(into)
  const held = new Set(mine.map((n) => n.id))
  return [...mine, ...noteList(from).map((n) => (held.has(n.id) ? { ...n, id: noteId() } : n))]
}

/**
 * Union of two copies of the same booking's notes, `into` winning the wording of
 * an id both hold. Notes are written as work happens, often on two devices at
 * once, so a whole-list overwrite would quietly lose one of them.
 */
export function mergeNotes(into = {}, from = {}) {
  const mine = noteList(into)
  const held = new Set(mine.map((n) => n.id))
  const extra = noteList(from).filter((n) => !held.has(n.id))
  if (!extra.length) return into
  return setNotes(into, sortNotes([...mine, ...extra]))
}

/** Oldest first, with the form's own note ahead of anything dated. */
export function sortNotes(list = []) {
  return [...list].sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')))
}

/** Flattened for the .ics description and anywhere else plain text is wanted. */
export function notesText(details = {}) {
  return visibleNotes(details)
    .map((n) => {
      const when = formatStamp(n.at)
      return when ? `${when}: ${n.text.trim()}` : n.text.trim()
    })
    .join('\n')
}
