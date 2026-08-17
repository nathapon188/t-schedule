// Quick parser checks: node scripts/test-parse.mjs
import assert from 'node:assert/strict'
import { parseForm, extractDates, extractTime } from '../src/lib/parse.js'
import {
  SAMPLE_ONE_DAY,
  SAMPLE_TWO_DAYS,
  SAMPLE_RANGE,
  SAMPLE_OCR_ARTEFACTS,
  SAMPLE_OCR_COLUMNS,
} from '../src/samples.js'

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

console.log('dates')
check('single date with weekday and ordinal', () =>
  assert.deepEqual(extractDates('Dates   Friday 21st August 2026'), ['2026-08-21']))
check('two dates joined with &', () =>
  assert.deepEqual(extractDates('Dates Friday 21st & Saturday 22nd August 2026'), ['2026-08-21', '2026-08-22']))
check('two dates joined with and', () =>
  assert.deepEqual(extractDates('Dates 21 and 22 August 2026'), ['2026-08-21', '2026-08-22']))
check('en dash range', () =>
  assert.deepEqual(extractDates('Dates Monday 24th – Wednesday 26th August 2026'),
    ['2026-08-24', '2026-08-25', '2026-08-26']))
check('word range', () =>
  assert.deepEqual(extractDates('Dates: 1 September to 3 September 2026'),
    ['2026-09-01', '2026-09-02', '2026-09-03']))
check('cross month range', () =>
  assert.deepEqual(extractDates('Dates 30th August - 1st September 2026'),
    ['2026-08-30', '2026-08-31', '2026-09-01']))
check('australian numeric date', () =>
  assert.deepEqual(extractDates('Dates 21/08/2026'), ['2026-08-21']))
check('month first', () =>
  assert.deepEqual(extractDates('Dates August 21, 2026'), ['2026-08-21']))
check('comma separated list', () =>
  assert.deepEqual(extractDates('Dates 3, 4, 7 October 2026'), ['2026-10-03', '2026-10-04', '2026-10-07']))
check('year falls back when absent', () =>
  assert.deepEqual(extractDates('Dates 21 August', 2026), ['2026-08-21']))
check('ocr reads ordinals as quotes', () =>
  assert.deepEqual(extractDates('Dates Thursday 13" & Friday 14" August 2026'), ['2026-08-13', '2026-08-14']))
check('ocr quote ordinals in a range', () =>
  assert.deepEqual(extractDates('Dates 13" - 15" August 2026'), ['2026-08-13', '2026-08-14', '2026-08-15']))
check('ocr curly quote ordinals', () =>
  assert.deepEqual(extractDates('Dates Thursday 13” and Friday 14” August 2026'), ['2026-08-13', '2026-08-14']))
check('ocr asterisk ordinals', () =>
  assert.deepEqual(extractDates('Dates 13* & 14* August 2026'), ['2026-08-13', '2026-08-14']))
check('month named before the days', () =>
  assert.deepEqual(extractDates('Dates August 13 & 14, 2026'), ['2026-08-13', '2026-08-14']))
check('dates row wrapping onto the next line', () =>
  assert.deepEqual(extractDates('Dates   Thursday 13th & Friday 14th\nAugust 2026'), ['2026-08-13', '2026-08-14']))
check('month alone is not a booking', () => assert.deepEqual(extractDates('Dates August 2026'), []))
check('three separate days', () =>
  assert.deepEqual(extractDates('Dates 13", 14" & 17" August 2026'),
    ['2026-08-13', '2026-08-14', '2026-08-17']))

console.log('times')
check('11:00am', () => assert.equal(extractTime('Pick up at 11:00am each day'), '11:00'))
check('12:50pm', () => assert.equal(extractTime('Pick up at 12:50pm each day'), '12:50'))
check('12:00am is midnight', () => assert.equal(extractTime('at 12:00am'), '00:00'))
check('bare pm hour', () => assert.equal(extractTime('drop off at 3pm'), '15:00'))
check('24 hour', () => assert.equal(extractTime('deliver 14:30'), '14:30'))
check('ocr reads the a of am as an 8', () => assert.equal(extractTime('®t 10:208m'), '10:20'))
check('ocr reads the m of pm as rn', () => assert.equal(extractTime('pick up 3prn'), '15:00'))

console.log('whole form (two days)')
const two = parseForm(SAMPLE_TWO_DAYS)
check('finds both days', () => assert.deepEqual(two.dates, ['2026-08-21', '2026-08-22']))
check('finds two orders', () => assert.equal(two.orders.length, 2))
check('orders repeat on each day', () => assert.equal(two.events.length, 4))
check('event times', () =>
  assert.deepEqual([...new Set(two.events.map((e) => e.time))].sort(), ['11:00', '12:50']))
check('order titles', () =>
  assert.deepEqual(two.orders.map((o) => o.title), ['Morning Tea Order', 'Lunch Order']))
check('guest name', () => assert.equal(two.details.guest, 'Dana Whitfield'))
check('pax', () => assert.equal(two.details.pax, '7-8 pax'))
check('phone', () => assert.equal(two.details.phone, '07 3000 0000'))
check('both emails', () => assert.equal(two.details.emails.length, 2))
check('billing address', () => assert.match(two.details.address, /1 SAMPLE ST BRISBANE/))
check('charge back ref', () => assert.match(two.details.chargeBack, /SamplePhotography/))
check('form total', () => assert.equal(two.details.total, 85.5))
check('dietary skips boilerplate', () => assert.equal(two.details.dietary, 'TBC'))
check('requested date is not a booking date', () => assert.ok(!two.dates.includes('2026-08-13')))
check('per order amounts', () =>
  assert.deepEqual(two.orders.map((o) => o.amount), [17.5, 68]))

console.log('requested by')
check('reads a Requested By row', () => {
  const form = SAMPLE_TWO_DAYS.replace('CATERING FORM', 'CATERING FORM\nRequested By   Westside Hospital')
  assert.equal(parseForm(form).details.requestedBy, 'Westside Hospital')
})
check('picks up a known requester mentioned anywhere', () => {
  const form = SAMPLE_TWO_DAYS.replace('Charge Back Authority', 'Essence Suite\nCharge Back Authority')
  assert.equal(parseForm(form).details.requestedBy, 'Essence Suite')
})
check('blank when no requester is named', () => assert.equal(two.details.requestedBy, ''))
check('Requested By does not overwrite the Requested note', () => {
  const form = SAMPLE_TWO_DAYS.replace('REQUESTED   Draft 13/08', 'REQUESTED BY   Private Functions\nREQUESTED   Draft 13/08')
  const parsed = parseForm(form)
  assert.equal(parsed.details.requestedBy, 'Private Functions')
  assert.equal(parsed.details.requested, 'Draft 13/08')
})
check('a Requested By row is not read as a booking date', () => {
  const form = SAMPLE_TWO_DAYS.replace('CATERING FORM', 'CATERING FORM\nRequested By   Westside Hospital 12/07/2026')
  assert.deepEqual(parseForm(form).dates, ['2026-08-21', '2026-08-22'])
})

console.log('whole form (one day / range)')
const one = parseForm(SAMPLE_ONE_DAY)
check('single day highlighted', () => assert.deepEqual(one.dates, ['2026-08-21']))
check('two events on the one day', () => assert.equal(one.events.length, 2))
const range = parseForm(SAMPLE_RANGE)
check('three day range', () => assert.equal(range.dates.length, 3))
check('six events across the range', () => assert.equal(range.events.length, 6))

const artefacts = parseForm(SAMPLE_OCR_ARTEFACTS)
check('quote-mark ordinals still give two days', () =>
  assert.deepEqual(artefacts.dates, ['2026-08-13', '2026-08-14']))
check('quote-mark ordinals still give four orders', () => assert.equal(artefacts.events.length, 4))

console.log('whole form (table columns interleaved by ocr)')
const columns = parseForm(SAMPLE_OCR_COLUMNS)
check('date read off the catering line', () => assert.deepEqual(columns.dates, ['2026-09-18']))
check('one order', () => assert.equal(columns.orders.length, 1))
check('pick-up time survives the mangled am', () => assert.equal(columns.orders[0].time, '10:20'))
check('title is the meal, not the instructions column', () =>
  assert.equal(columns.orders[0].title, 'Morning Tea'))
check('priced lines add up to the order total', () => assert.equal(columns.orders[0].amount, 84.5))
check('instructions column is stripped from the detail', () =>
  assert.ok(!/wiggle room|please ensure/i.test(columns.orders[0].detail)))
check('every item is kept', () =>
  assert.ok(/Fruit cups/.test(columns.orders[0].detail) &&
    /Lychee Mocktails/.test(columns.orders[0].detail) &&
    /Apple juice/.test(columns.orders[0].detail)))
check('one event on the calendar', () => assert.equal(columns.events.length, 1))

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed')
process.exit(failures ? 1 : 0)
