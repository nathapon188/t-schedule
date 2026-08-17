// Shared-store merge checks: node scripts/test-sync.mjs
import assert from 'node:assert/strict'
import { mergeStates, fingerprint } from '../src/lib/sync.js'

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

const booking = (id, guest) => ({ id, colour: 'green', details: { guest }, rawText: '' })
const event = (id, bookingId, date, title = 'Lunch Order') => ({ id, bookingId, date, time: '12:50', title, detail: '', amount: 68 })

console.log('merging two devices')
const local = {
  bookings: [booking('b1', 'Dana Whitfield')],
  events: [event('b1-0', 'b1', '2026-08-21')],
  deleted: [],
}
const remote = {
  bookings: [booking('b2', 'Jordan Lee')],
  events: [event('b2-0', 'b2', '2026-08-24')],
  deleted: [],
}
const merged = mergeStates(local, remote)
check('keeps both bookings', () => assert.deepEqual(merged.bookings.map((b) => b.id).sort(), ['b1', 'b2']))
check('keeps both events', () => assert.equal(merged.events.length, 2))

console.log('same booking edited on both sides')
const edited = mergeStates(
  { bookings: [booking('b1', 'Dana Whitfield-Smith')], events: [], deleted: [] },
  { bookings: [booking('b1', 'Dana Whitfield')], events: [], deleted: [] },
)
check('local edit wins the clash', () => assert.equal(edited.bookings[0].details.guest, 'Dana Whitfield-Smith'))
check('no duplicate of the same id', () => assert.equal(edited.bookings.length, 1))

console.log('stale local copy accepts the shared version')
const stale = mergeStates(
  { bookings: [booking('b1', 'Dana Whitfield')], events: [event('b1-0', 'b1', '2026-08-21')], deleted: [] },
  { bookings: [booking('b1', 'Dana Whitfield, Westside')], events: [event('b1-0', 'b1', '2026-08-22')], deleted: [] },
  { preferLocal: false },
)
check('shared details win when this device has no edits', () =>
  assert.equal(stale.bookings[0].details.guest, 'Dana Whitfield, Westside'))
check('shared event details win too', () => assert.equal(stale.events[0].date, '2026-08-22'))
check('still no duplicates', () => {
  assert.equal(stale.bookings.length, 1)
  assert.equal(stale.events.length, 1)
})
check('a booking only this device has is still kept', () => {
  const merged = mergeStates(
    { bookings: [booking('b1', 'A'), booking('b9', 'Only here')], events: [], deleted: [] },
    { bookings: [booking('b1', 'A')], events: [], deleted: [] },
    { preferLocal: false },
  )
  assert.deepEqual(merged.bookings.map((b) => b.id).sort(), ['b1', 'b9'])
})
check('deletions still win over the shared copy', () => {
  const merged = mergeStates(
    { bookings: [], events: [], deleted: ['b1'] },
    { bookings: [booking('b1', 'A')], events: [], deleted: [] },
    { preferLocal: false },
  )
  assert.equal(merged.bookings.length, 0)
})

console.log('deletions')
const afterDelete = mergeStates(
  { bookings: [], events: [], deleted: ['b2'] }, // this device removed Jordan Lee
  remote, // the shared copy still has it
)
check('a removed booking does not come back', () => assert.equal(afterDelete.bookings.length, 0))
check('its orders go with it', () => assert.equal(afterDelete.events.length, 0))
check('the tombstone is kept for other devices', () => assert.ok(afterDelete.deleted.includes('b2')))

const remoteDeleted = mergeStates(local, { bookings: [], events: [], deleted: ['b1'] })
check('a deletion made elsewhere is honoured here', () => assert.equal(remoteDeleted.bookings.length, 0))

const singleOrder = mergeStates(
  { bookings: [booking('b1', 'Dana')], events: [], deleted: ['b1-0'] },
  { bookings: [booking('b1', 'Dana')], events: [event('b1-0', 'b1', '2026-08-21')], deleted: [] },
)
check('one removed order stays removed, booking stays', () => {
  assert.equal(singleOrder.bookings.length, 1)
  assert.equal(singleOrder.events.length, 0)
})

console.log('orphans')
const orphan = mergeStates(
  { bookings: [], events: [event('x-0', 'gone', '2026-08-21')], deleted: [] },
  { bookings: [], events: [], deleted: [] },
)
check('an event with no booking is dropped', () => assert.equal(orphan.events.length, 0))

console.log('fingerprint')
check('order of arrays does not matter', () => {
  const a = { bookings: [booking('b1', 'A'), booking('b2', 'B')], events: [], deleted: [] }
  const b = { bookings: [booking('b2', 'B'), booking('b1', 'A')], events: [], deleted: [] }
  assert.equal(fingerprint(a), fingerprint(b))
})
check('a real change is noticed', () => {
  const a = { bookings: [booking('b1', 'A')], events: [], deleted: [] }
  const b = { bookings: [booking('b1', 'B')], events: [], deleted: [] }
  assert.notEqual(fingerprint(a), fingerprint(b))
})
check('an amount change is noticed', () => {
  const a = { bookings: [], events: [{ ...event('e1', 'b1', '2026-08-21'), amount: 68 }], deleted: [] }
  const b = { bookings: [], events: [{ ...event('e1', 'b1', '2026-08-21'), amount: 70 }], deleted: [] }
  assert.notEqual(fingerprint(a), fingerprint(b))
})

check('an edit to the order text of the same length is noticed', () => {
  const a = { bookings: [], events: [{ ...event('e1', 'b1', '2026-08-21'), detail: '12 x ham roll' }], deleted: [] }
  const b = { bookings: [], events: [{ ...event('e1', 'b1', '2026-08-21'), detail: '13 x ham roll' }], deleted: [] }
  assert.notEqual(fingerprint(a), fingerprint(b))
})
check('an edit to the form text of the same length is noticed', () => {
  const a = { bookings: [{ ...booking('b1', 'A'), rawText: 'PAX 12' }], events: [], deleted: [] }
  const b = { bookings: [{ ...booking('b1', 'A'), rawText: 'PAX 13' }], events: [], deleted: [] }
  assert.notEqual(fingerprint(a), fingerprint(b))
})

console.log('tombstone list stays bounded')
const many = mergeStates(
  { bookings: [], events: [], deleted: Array.from({ length: 400 }, (_, i) => `l${i}`) },
  { bookings: [], events: [], deleted: Array.from({ length: 400 }, (_, i) => `r${i}`) },
)
check('capped at 500 ids', () => assert.equal(many.deleted.length, 500))

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed')
process.exit(failures ? 1 : 0)
