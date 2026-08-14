// Booking notes: node scripts/test-notes.mjs
import assert from 'node:assert/strict'
import { addNote, concatNotes, mergeNotes, noteCount, noteList, notesText, setNotes, visibleNotes, FORM_NOTE_ID } from '../src/lib/notes.js'
import { mergeStates } from '../src/lib/sync.js'
import { encodeState, decodeState } from '../src/lib/storage.js'

globalThis.btoa ??= (s) => Buffer.from(s, 'binary').toString('base64')
globalThis.atob ??= (s) => Buffer.from(s, 'base64').toString('binary')

let failures = 0
function check(name, fn) {
  try {
    fn()
    console.log(`  ok   ${name}`)
  } catch (err) {
    failures++
    console.log(`  FAIL ${name}\n       ${err.message}`)
  }
}

console.log('the note read off the form')
const fromForm = { guest: 'Dana Whitfield', notes: 'Sit down lunch, set up from 11:30.' }
check('is listed as a note', () => assert.equal(noteList(fromForm).length, 1))
check('is marked as coming from the form', () => {
  assert.equal(noteList(fromForm)[0].id, FORM_NOTE_ID)
  assert.equal(noteList(fromForm)[0].source, 'form')
})
check('has no time against it', () => assert.equal(noteList(fromForm)[0].at, ''))
check('a booking with nothing written has no notes', () => assert.deepEqual(noteList({ guest: 'A' }), []))

console.log('adding a note later')
const later = addNote(fromForm, 'Ward rang, moved to 11:00.', '2026-08-14T15:40:00.000Z')
check('the form note is kept', () => assert.equal(noteList(later)[0].text, 'Sit down lunch, set up from 11:30.'))
check('the new note is added after it', () => assert.equal(noteList(later)[1].text, 'Ward rang, moved to 11:00.'))
check('the new note carries when it was written', () => assert.equal(noteList(later)[1].at, '2026-08-14T15:40:00.000Z'))
check('the form string is folded in, so nothing shows twice', () => assert.equal(later.notes, ''))
check('the form note keeps its place after folding', () => assert.equal(later.noteList[0].id, FORM_NOTE_ID))
check('a second note does not disturb the first', () => {
  const two = addNote(later, 'Second trolley needed.', '2026-08-14T16:05:00.000Z')
  assert.deepEqual(noteList(two).map((n) => n.text), [
    'Sit down lunch, set up from 11:30.',
    'Ward rang, moved to 11:00.',
    'Second trolley needed.',
  ])
})
check('blank text adds nothing', () => assert.equal(addNote(later, '   '), later))
check('surrounding whitespace is trimmed', () =>
  assert.equal(addNote({}, '  Call Jaz on arrival.  ').noteList[0].text, 'Call Jaz on arrival.'))
check('every note gets its own id', () => {
  const ids = new Set(addNote(addNote({}, 'a'), 'b').noteList.map((n) => n.id))
  assert.equal(ids.size, 2)
})
check('other details are untouched', () => assert.equal(later.guest, 'Dana Whitfield'))

console.log('editing and removing')
const edited = setNotes(later, noteList(later).map((n) => (n.id === FORM_NOTE_ID ? { ...n, text: 'Set up from 11:00.' } : n)))
check('a note can be rewritten', () => assert.equal(noteList(edited)[0].text, 'Set up from 11:00.'))
check('rewriting the form note does not bring the old wording back', () =>
  assert.ok(!notesText(edited).includes('11:30')))
check('a note can be removed', () => {
  const gone = setNotes(later, noteList(later).filter((n) => n.id !== FORM_NOTE_ID))
  assert.equal(noteList(gone).length, 1)
})
check('an emptied note is kept while editing but not shown', () => {
  const blanked = setNotes(later, noteList(later).map((n) => ({ ...n, text: n.id === FORM_NOTE_ID ? '' : n.text })))
  assert.equal(noteList(blanked).length, 2)
  assert.equal(visibleNotes(blanked).length, 1)
  assert.equal(noteCount(blanked), 1)
})

console.log('flattened for the calendar entry')
check('a note with a time is stamped', () =>
  assert.ok(notesText(later).includes('15/08/2026') || notesText(later).includes('14/08/2026')))
check('the form note is written as it stands', () => assert.ok(notesText(later).startsWith('Sit down lunch')))
check('one note per line', () => assert.equal(notesText(later).split('\n').length, 2))
check('nothing written gives nothing', () => assert.equal(notesText({}), ''))

console.log('folding one booking into another')
const folded = concatNotes(fromForm, { notes: 'Allergy sheet with the driver.' })
check('both form notes survive', () => assert.equal(folded.length, 2))
check('the second is re-keyed, so ids stay unique', () => assert.notEqual(folded[0].id, folded[1].id))
check('wording is unchanged', () =>
  assert.deepEqual(folded.map((n) => n.text), ['Sit down lunch, set up from 11:30.', 'Allergy sheet with the driver.']))

console.log('two devices writing notes at once')
const onPhone = addNote(fromForm, 'Ward rang, moved to 11:00.', '2026-08-14T05:40:00.000Z')
const onDesktop = addNote(fromForm, 'Second trolley needed.', '2026-08-14T05:41:00.000Z')
const bothWays = mergeNotes(onPhone, onDesktop)
check('neither note is lost', () => assert.equal(visibleNotes(bothWays).length, 3))
check('they end up in the order they were written', () =>
  assert.deepEqual(visibleNotes(bothWays).map((n) => n.text), [
    'Sit down lunch, set up from 11:30.',
    'Ward rang, moved to 11:00.',
    'Second trolley needed.',
  ]))
check('the note both sides hold is not doubled up', () =>
  assert.equal(visibleNotes(bothWays).filter((n) => n.text.startsWith('Sit down')).length, 1))
check('nothing new leaves the details alone', () => assert.equal(mergeNotes(onPhone, fromForm), onPhone))

console.log('through the shared store merge')
const booking = (details) => ({ id: 'b1', colour: 'green', details, rawText: '' })
const synced = mergeStates(
  { bookings: [booking(onPhone)], events: [], deleted: [] },
  { bookings: [booking(onDesktop)], events: [], deleted: [] },
)
check('one booking, both devices\' notes', () => {
  assert.equal(synced.bookings.length, 1)
  assert.equal(visibleNotes(synced.bookings[0].details).length, 3)
})
check('the shared copy does not win outright when this device has edits', () =>
  assert.ok(notesText(synced.bookings[0].details).includes('Ward rang')))
check('a stale device still keeps what only it has', () => {
  const stale = mergeStates(
    { bookings: [booking(onPhone)], events: [], deleted: [] },
    { bookings: [booking(onDesktop)], events: [], deleted: [] },
    { preferLocal: false },
  )
  assert.equal(visibleNotes(stale.bookings[0].details).length, 3)
})
check('a deleted booking takes its notes with it', () => {
  const merged = mergeStates(
    { bookings: [], events: [], deleted: ['b1'] },
    { bookings: [booking(onDesktop)], events: [], deleted: [] },
  )
  assert.equal(merged.bookings.length, 0)
})
check('merging does not rewrite the caller\'s bookings', () => {
  const mine = booking(onPhone)
  mergeStates({ bookings: [mine], events: [], deleted: [] }, { bookings: [booking(onDesktop)], events: [], deleted: [] })
  assert.equal(noteList(mine.details).length, 2)
})

console.log('travelling in a share link')
const linked = decodeState(encodeState({ bookings: [booking(later)], events: [] }))
check('every note arrives', () => assert.equal(visibleNotes(linked.bookings[0].details).length, 2))
check('wording arrives', () => assert.equal(noteList(linked.bookings[0].details)[1].text, 'Ward rang, moved to 11:00.'))
check('the time it was written arrives', () =>
  assert.equal(noteList(linked.bookings[0].details)[1].at, '2026-08-14T15:40:00.000Z'))
check('ids stay unique after the trip', () => {
  const ids = new Set(noteList(linked.bookings[0].details).map((n) => n.id))
  assert.equal(ids.size, 2)
})
check('an older link with one note still opens', () => {
  const old = decodeState(encodeState({ bookings: [booking({ guest: 'A' })], events: [] }))
  old.bookings[0].details.notes = 'Set up from 11:30.' // as an older link would decode
  assert.equal(visibleNotes(old.bookings[0].details).length, 1)
})

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed')
process.exit(failures ? 1 : 0)
