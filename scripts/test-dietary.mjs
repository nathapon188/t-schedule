// Dietary list parsing: node scripts/test-dietary.mjs
import assert from 'node:assert/strict'
import { parseDietary, formatDietary, dietarySummary, looksLikeDietaryList, mergeDietary } from '../src/lib/dietary.js'
import { SAMPLE_TWO_DAYS } from '../src/samples.js'

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

// Exactly as it comes off a sit-down lunch sheet, wrapping and all.
const SAMPLE = `Brett Vegetarian
Pooja Vegetarian
Michele Vegetarian, No Bread
Carly Waller Dairy Free
Kirsty Stewart Unable to eat pineapple

or kiwi fuit
Mikey Von Bardeleben Dairy Free
Kim Teale No garlic and lactose
free milk for coffee if
there is coffee`

const rows = parseDietary(SAMPLE)

console.log('sit-down lunch list')
check('one row per guest', () => assert.equal(rows.length, 7))
check('names in order', () =>
  assert.deepEqual(rows.map((r) => r.name), [
    'Brett',
    'Pooja',
    'Michele',
    'Carly Waller',
    'Kirsty Stewart',
    'Mikey Von Bardeleben',
    'Kim Teale',
  ]))
check('single word name and requirement', () => assert.equal(rows[0].requirement, 'Vegetarian'))
check('requirement with a comma stays whole', () => assert.equal(rows[2].requirement, 'Vegetarian, No Bread'))
check('two word name', () => assert.equal(rows[3].requirement, 'Dairy Free'))
check('wrapped requirement is joined across a blank line', () =>
  assert.equal(rows[4].requirement, 'Unable to eat pineapple or kiwi fuit'))
check('three word name is not eaten by the requirement', () => {
  assert.equal(rows[5].name, 'Mikey Von Bardeleben')
  assert.equal(rows[5].requirement, 'Dairy Free')
})
check('two wrapped lines both join', () =>
  assert.equal(rows[6].requirement, 'No garlic and lactose free milk for coffee if there is coffee'))

console.log('other shapes')
check('dash separator', () => {
  const [row] = parseDietary('Carly Waller - dairy free')
  assert.deepEqual(row, { name: 'Carly Waller', requirement: 'dairy free' })
})
check('colon separator', () => {
  const [row] = parseDietary('Kim Teale: no garlic')
  assert.deepEqual(row, { name: 'Kim Teale', requirement: 'no garlic' })
})
check('numbered list', () => {
  const parsed = parseDietary('1. Brett Vegetarian\n2. Pooja Vegan')
  assert.deepEqual(parsed.map((r) => r.name), ['Brett', 'Pooja'])
})
check('bulleted list', () => {
  const parsed = parseDietary('- Brett Vegetarian\n- Pooja Vegan')
  assert.deepEqual(parsed.map((r) => r.requirement), ['Vegetarian', 'Vegan'])
})
check('name with no requirement', () => {
  const [row] = parseDietary('Sarah Jane')
  assert.deepEqual(row, { name: 'Sarah Jane', requirement: '' })
})
check('hyphenated surname', () => {
  const [row] = parseDietary('Anne-Marie O’Brien Gluten free')
  assert.equal(row.name, 'Anne-Marie O’Brien')
  assert.equal(row.requirement, 'Gluten free')
})
check('blank input gives nothing', () => assert.deepEqual(parseDietary(''), []))
check('leading requirement line with no name is ignored', () => assert.deepEqual(parseDietary('no nuts'), []))

console.log('round trip and summary')
check('format then parse is stable', () => assert.deepEqual(parseDietary(formatDietary(rows)), rows))
check('summary counts guests and requirements', () =>
  assert.equal(dietarySummary(rows), '7 guests, 7 with requirements'))
check('summary counts a guest with nothing noted', () =>
  assert.equal(dietarySummary([{ name: 'A', requirement: 'Vegan' }, { name: 'B', requirement: '' }]),
    '2 guests, 1 with requirements'))
check('empty list has no summary', () => assert.equal(dietarySummary([]), ''))

console.log('telling a guest list from a catering form')
check('the lunch list is a guest list', () => assert.equal(looksLikeDietaryList(SAMPLE), true))
check('a catering form is not', () => assert.equal(looksLikeDietaryList(SAMPLE_TWO_DAYS), false))
check('a list with a date row is not', () =>
  assert.equal(looksLikeDietaryList('Dates 21 August 2026\nBrett Vegetarian\nPooja Vegan'), false))
check('a list with a pick-up time is not', () =>
  assert.equal(looksLikeDietaryList('Pick up at 11:00am\nBrett Vegetarian\nPooja Vegan'), false))
check('one name alone is not enough', () => assert.equal(looksLikeDietaryList('Brett Vegetarian'), false))
check('names with no requirements are not enough', () =>
  assert.equal(looksLikeDietaryList('Brett Smith\nPooja Patel'), false))
check('empty text is not', () => assert.equal(looksLikeDietaryList(''), false))

console.log('adding a list to a booking that has one')
const existing = [{ name: 'Brett', requirement: 'Vegetarian' }, { name: 'Carly Waller', requirement: 'Dairy Free' }]
const result = mergeDietary(existing, [
  { name: 'brett', requirement: 'Vegetarian' },
  { name: 'Kim Teale', requirement: 'No garlic' },
])
check('new guest added', () => assert.equal(result.added, 1))
check('guest already listed is skipped, case regardless', () => assert.equal(result.skipped, 1))
check('nothing lost', () => assert.deepEqual(result.rows.map((r) => r.name), ['Brett', 'Carly Waller', 'Kim Teale']))
check('a row with no name is skipped', () => assert.equal(mergeDietary(existing, [{ name: '', requirement: 'x' }]).added, 0))

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed')
process.exit(failures ? 1 : 0)
