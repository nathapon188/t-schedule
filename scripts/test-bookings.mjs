// Merge, dedupe and persistence checks: node scripts/test-bookings.mjs
import assert from 'node:assert/strict'
import { parseForm } from '../src/lib/parse.js'
import { buildBooking, signature } from '../src/lib/bookings.js'
import { encodeState, decodeState } from '../src/lib/storage.js'
import { buildIcs } from '../src/lib/ics.js'
import { addNote, noteList } from '../src/lib/notes.js'
import { SAMPLE_TWO_DAYS, SAMPLE_RANGE } from '../src/samples.js'

// storage.js and ics.js run in the browser; give them the globals they use.
globalThis.btoa ??= (s) => Buffer.from(s, 'binary').toString('base64')
globalThis.atob ??= (s) => Buffer.from(s, 'base64').toString('binary')
globalThis.performance ??= { now: () => 0 }

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

const SECOND_FORM = SAMPLE_RANGE.replace('Dana Whitfield', 'Jordan Lee').replace('7-8 pax', '12 pax')

// First import.
const one = buildBooking(parseForm(SAMPLE_TWO_DAYS), { bookings: [], events: [], rawText: SAMPLE_TWO_DAYS })
let bookings = [one.booking]
let events = [...one.events]

console.log('adding a second form')
const two = buildBooking(parseForm(SECOND_FORM), { bookings, events, rawText: SECOND_FORM })
bookings = [...bookings, two.booking]
events = [...events, ...two.events]

check('first booking survives the second import', () => assert.equal(bookings.length, 2))
check('events from both bookings are on the calendar', () => assert.equal(events.length, 4 + 6))
check('original two days still present', () =>
  assert.ok(['2026-08-21', '2026-08-22'].every((d) => events.some((e) => e.date === d))))
check('new range days added', () =>
  assert.ok(['2026-08-24', '2026-08-25', '2026-08-26'].every((d) => events.some((e) => e.date === d))))
check('each booking gets its own colour', () => assert.notEqual(one.booking.colour, two.booking.colour))
check('events carry their booking id', () =>
  assert.equal(events.filter((e) => e.bookingId === two.booking.id).length, 6))
check('details stay per booking', () => {
  assert.equal(bookings[0].details.guest, 'Dana Whitfield')
  assert.equal(bookings[1].details.guest, 'Jordan Lee')
})

console.log('pasting the same form twice')
const again = buildBooking(parseForm(SAMPLE_TWO_DAYS), { bookings, events, rawText: SAMPLE_TWO_DAYS })
check('duplicate orders are not added again', () => assert.equal(again.events.length, 0))
check('duplicates are reported', () => assert.equal(again.duplicates, 4))
check('signature ignores case and padding', () =>
  assert.equal(signature({ date: '2026-08-21', time: '11:00', title: ' Morning Tea Order ' }),
    signature({ date: '2026-08-21', time: '11:00', title: 'morning tea order' })))

console.log('removing a booking')
const kept = events.filter((e) => e.bookingId !== two.booking.id)
check('removing one booking leaves the other intact', () => assert.equal(kept.length, 4))

console.log('link round trip')
const encoded = encodeState({ bookings, events })
const decoded = decodeState(encoded)
check('both bookings survive the link', () => assert.equal(decoded.bookings.length, 2))
check('all events survive the link', () => assert.equal(decoded.events.length, events.length))
check('event stays with its own booking', () => {
  const jordan = decoded.bookings[1]
  const own = decoded.events.filter((e) => e.bookingId === jordan.id)
  assert.equal(own.length, 6)
})
check('colours survive the link', () => assert.equal(decoded.events[0].colour, one.booking.colour))
check('guest names survive the link', () =>
  assert.deepEqual(decoded.bookings.map((b) => b.details.guest), ['Dana Whitfield', 'Jordan Lee']))
check('a v1 single-booking link still opens', () => {
  const legacy = encodeState({ bookings: [bookings[0]], events: events.slice(0, 4) })
  assert.equal(decodeState(legacy).events.length, 4)
})

console.log('notes and dietary list travel')
bookings[0].details.notes = 'Sit down lunch, set up from 11:30. Call Jaz on arrival.'
bookings[0].details.dietaryList = [
  { name: 'Brett', requirement: 'Vegetarian' },
  { name: 'Kim Teale', requirement: 'No garlic and lactose free milk for coffee' },
  { name: 'Sarah Jane', requirement: '' },
]
const withNotes = decodeState(encodeState({ bookings, events }))
check('notes survive the link', () =>
  assert.equal(noteList(withNotes.bookings[0].details)[0].text, 'Sit down lunch, set up from 11:30. Call Jaz on arrival.'))
check('dietary rows survive the link', () =>
  assert.deepEqual(withNotes.bookings[0].details.dietaryList, bookings[0].details.dietaryList))
check('a guest with no requirement is kept', () =>
  assert.equal(withNotes.bookings[0].details.dietaryList[2].name, 'Sarah Jane'))
check('the other booking has no dietary rows', () =>
  assert.deepEqual(withNotes.bookings[1].details.dietaryList, []))

console.log('ics export')
const ics = buildIcs(events, bookings)
check('one VEVENT per order', () => assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, events.length))
check('each event carries its own guest', () => {
  assert.ok(ics.includes('Dana Whitfield'))
  assert.ok(ics.includes('Jordan Lee'))
})
check('pax follows the right booking', () => assert.ok(ics.includes('Pax: 12 pax') && ics.includes('Pax: 7-8 pax')))
check('notes reach the calendar entry', () => assert.ok(ics.includes('Sit down lunch')))
check('a note added later reaches it too, with the time it was written', () => {
  bookings[0].details = addNote(bookings[0].details, 'Ward rang, moved to 11:00.', '2026-08-14T15:40:00.000Z')
  const withLater = buildIcs(events, bookings)
  assert.ok(withLater.includes('Ward rang'))
  assert.ok(withLater.includes('Sit down lunch'))
  assert.ok(/1[45]\/08\/2026/.test(withLater))
})
check('dietary names reach the calendar entry', () => assert.ok(ics.includes('Brett') && ics.includes('Kim Teale')))

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed')
process.exit(failures ? 1 : 0)
