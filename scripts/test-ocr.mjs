// End-to-end check against a real image: node scripts/test-ocr.mjs <image path>
// Downloads the English traineddata on first run, so it needs internet.
import { createWorker } from 'tesseract.js'
import { parseForm } from '../src/lib/parse.js'

const file = process.argv[2]
if (!file) {
  console.error('usage: node scripts/test-ocr.mjs <image path>')
  process.exit(1)
}

const worker = await createWorker('eng', 1, {
  logger: (m) => m.status === 'recognizing text' && process.stdout.write(`\rreading ${Math.round(m.progress * 100)}%`),
})
const { data } = await worker.recognize(file)
await worker.terminate()

console.log('\n--- ocr text ---')
console.log(data.text)
console.log('--- parsed ---')
const parsed = parseForm(data.text)
console.log(JSON.stringify({ dates: parsed.dates, orders: parsed.orders, details: parsed.details }, null, 2))
console.log(`events: ${parsed.events.length}`)
