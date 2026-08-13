// Parses the plain text of a catering form (OCR output or pasted text) into
// bookable dates, line items and contact details.
//
// Deliberately forgiving: OCR mangles tables, so every field is a best effort
// and the UI keeps all of it editable.

import { monthIndex, toKey, expandRange } from './dates.js'
import { matchSource } from './sources.js'

const WEEKDAY_RE = /\b(mon|tues?|wed(?:nes)?|thur?s?|fri|sat(?:ur)?|sun)(?:day)?\b\.?/gi
const ORDINAL_RE = /(\d{1,2})\s*(?:st|nd|rd|th)\b/gi
// Superscript ordinals ("21st") often come back from OCR as quotes or symbols:
// 21", 21', 13*, 14°, 22”. Strip the artefact and keep the day number.
const ORDINAL_ARTEFACT_RE = /(\d{1,2})\s*(?:["'‘’“”´`*°º˚]+|\b(?:t[hn]|s[t1]|rd|nd|ni|in)\b)/gi
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]{2,}/g
const MONEY_RE = /\$\s?([\d,]+(?:\.\d{1,2})?)/g
const TIME_RE = /\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b|\b(\d{1,2}):(\d{2})\b/i
const EACH_DAY_RE = /\b(each|every|per)\s+day\b|\bdaily\b|\bboth\s+days\b/i

const DIETARY_BOILERPLATE = [
  /please separate/i,
  /label all/i,
  /dietary requirement/i,
  /related foods/i,
  /specific person/i,
]

/** Lines, trimmed, with empties preserved as '' so blocks stay separable. */
function toLines(text) {
  return text.replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+$/, '').trim())
}

/** Value sitting after a row label, either on the same line or the next one. */
function labelValue(lines, labelRe, { skip = [] } = {}) {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(labelRe)
    if (!m) continue
    const inline = lines[i].slice(m.index + m[0].length).replace(/^[\s:|-]+/, '').trim()
    if (inline) return inline
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const candidate = lines[j].trim()
      if (!candidate) continue
      if (skip.some((re) => re.test(candidate))) continue
      return candidate
    }
    return ''
  }
  return ''
}

/* ------------------------------------------------------------------ dates */

const DATE_TOKEN_RE = new RegExp(
  [
    '(\\d{1,2})\\s*[\\/.\\-]\\s*(\\d{1,2})\\s*[\\/.\\-]\\s*(\\d{2,4})', // 21/08/2026
    '([A-Za-z]{3,9})\\.?\\s+(\\d{1,2})(?!\\d)', // August 21
    '(\\d{1,2})\\s*([A-Za-z]{3,9})\\.?', // 21 August
    '(\\d{4})(?!\\d)', // bare year
    '([A-Za-z]{3,9})\\.?', // month on its own: "13 & 14 August 2026"
    '(\\d{1,2})(?!\\d)', // bare day
    '(-)',
    '(,)',
  ].join('|'),
  'g',
)

function normaliseDateText(text) {
  return text
    .replace(WEEKDAY_RE, ' ')
    .replace(ORDINAL_RE, '$1')
    .replace(ORDINAL_ARTEFACT_RE, '$1 ')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\bthrough\b|\buntil\b|\bto\b/gi, '-')
    .replace(/&|\band\b|\bplus\b/gi, ',')
    .replace(/\s+/g, ' ')
    .trim()
}

function fullYear(n) {
  if (n >= 1000) return n
  return n < 70 ? 2000 + n : 1900 + n
}

/** Tokenise one candidate string into date / range / separator tokens. */
function tokeniseDates(text) {
  const tokens = []
  const source = normaliseDateText(text)
  DATE_TOKEN_RE.lastIndex = 0
  let m
  while ((m = DATE_TOKEN_RE.exec(source)) !== null) {
    const [, d1, m1, y1, monthWord, dayAfter, dayBefore, monthWord2, year, loneMonth, bareDay, dash, comma] = m
    if (d1) {
      tokens.push({ t: 'date', day: +d1, month: +m1 - 1, year: fullYear(+y1) })
    } else if (monthWord) {
      const mi = monthIndex(monthWord)
      if (mi !== null) tokens.push({ t: 'date', day: +dayAfter, month: mi })
    } else if (dayBefore && monthWord2) {
      const mi = monthIndex(monthWord2)
      if (mi !== null) tokens.push({ t: 'date', day: +dayBefore, month: mi })
      else tokens.push({ t: 'date', day: +dayBefore })
    } else if (year) {
      tokens.push({ t: 'year', year: +year })
    } else if (loneMonth) {
      const mi = monthIndex(loneMonth)
      if (mi !== null) tokens.push({ t: 'month', month: mi })
    } else if (bareDay) {
      tokens.push({ t: 'date', day: +bareDay })
    } else if (dash) {
      tokens.push({ t: 'range' })
    } else if (comma) {
      tokens.push({ t: 'sep' })
    }
  }
  return tokens
}

/** '21 - 22 August 2026': the bare 21 borrows month and year from its neighbours. */
function resolveTokens(tokens, defaultYear) {
  // Nearest token that names a month, looking forward first then backward, so
  // '13 & 14 August 2026' and 'August 13 & 14' both resolve.
  const monthDonor = (from) => {
    for (const dir of [1, -1]) {
      for (let j = from + dir; j >= 0 && j < tokens.length; j += dir) {
        const t = tokens[j]
        if (t.t === 'month') return t
        if (t.t === 'date' && t.month !== undefined && !t.invalid) return t
      }
    }
    return null
  }

  tokens.forEach((token, i) => {
    if (token.t !== 'date' || token.month !== undefined) return
    const donor = monthDonor(i)
    if (!donor) {
      token.invalid = true
      return
    }
    token.month = donor.month
    if (token.year === undefined && donor.year !== undefined) token.year = donor.year
  })

  const dates = tokens.filter((t) => t.t === 'date')
  const yearToken = tokens.find((t) => t.t === 'year')
  for (const d of dates) {
    if (d.year === undefined) {
      d.year = yearToken ? yearToken.year : dates.find((x) => x.year !== undefined)?.year ?? defaultYear
    }
  }
  for (const d of dates) {
    if (d.day < 1 || d.day > 31 || d.month < 0 || d.month > 11) d.invalid = true
  }
  return tokens
}

/** Walk tokens left to right, expanding any range that sits between two dates. */
function tokensToKeys(tokens) {
  const keys = []
  let pending = null // date awaiting a possible range partner
  let rangeOpen = false

  const keyOf = (d) => toKey(new Date(d.year, d.month, d.day))

  for (const token of tokens) {
    if (token.t === 'range') {
      if (pending) rangeOpen = true
      continue
    }
    if (token.t !== 'date' || token.invalid) continue
    if (rangeOpen && pending) {
      keys.push(...expandRange(keyOf(pending), keyOf(token)))
      rangeOpen = false
      pending = token
      continue
    }
    if (pending) keys.push(keyOf(pending))
    pending = token
  }
  if (pending) keys.push(keyOf(pending))
  return keys
}

/** Candidate strings most likely to hold the booking dates. */
function dateCandidates(lines) {
  const candidates = []
  const rowIndex = lines.findIndex((l) => /\bdates?\b/i.test(l) && !/^\s*(requested|confirmation)\b/i.test(l))
  if (rowIndex !== -1) {
    const m = lines[rowIndex].match(/\bdates?\b\s*[:|]?/i)
    const inline = lines[rowIndex].slice(m.index + m[0].length).replace(/^[\s:|-]+/, '').trim()
    if (inline) candidates.push(inline)
    // The row can wrap, leaving the month or year on the following line.
    candidates.push([inline, lines[rowIndex + 1] || '', lines[rowIndex + 2] || ''].join(' ').trim())
  }

  const hasMonth = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i
  const hasSlashDate = /\b\d{1,2}\s*[\/.\-]\s*\d{1,2}\s*[\/.\-]\s*\d{2,4}\b/
  for (const line of lines) {
    if (/^\s*(requested|confirmation)\b/i.test(line)) continue // "Jaz draft 13/08" is not a booking date
    if (hasMonth.test(line) || hasSlashDate.test(line)) candidates.push(line)
  }
  return candidates
}

export function extractDates(text, defaultYear = new Date().getFullYear()) {
  const lines = toLines(text)
  const seen = new Set()
  for (const candidate of dateCandidates(lines)) {
    const tokens = resolveTokens(tokeniseDates(candidate), defaultYear)
    const keys = tokensToKeys(tokens)
    keys.forEach((k) => seen.add(k))
    if (seen.size) break // first line that yields dates wins; the rest is usually noise
  }
  return [...seen].sort()
}

/* ------------------------------------------------------------------ times */

export function extractTime(text) {
  const m = text.match(TIME_RE)
  if (!m) return ''
  if (m[3]) {
    let h = +m[1] % 12
    if (m[3].toLowerCase() === 'pm') h += 12
    return `${String(h).padStart(2, '0')}:${m[2] || '00'}`
  }
  const h = +m[4]
  if (h > 23) return ''
  return `${String(h).padStart(2, '0')}:${m[5]}`
}

/* ------------------------------------------------- catering line items */

function deliverySection(lines) {
  const start = lines.findIndex((l) => /catering\s*(delivery|order)/i.test(l))
  const from = start === -1 ? 0 : start
  let to = lines.length
  for (let i = from + 1; i < lines.length; i++) {
    if (/^\s*(dietary|requested|confirmation)\b/i.test(lines[i])) {
      to = i
      break
    }
  }
  const slice = lines.slice(from, to)
  if (start !== -1) {
    slice[0] = slice[0].replace(/.*catering\s*(delivery|order)[\s:\-–]*/i, '')
  }
  return slice
}

function sumMoney(text) {
  const amounts = [...text.matchAll(MONEY_RE)].map((m) => Number(m[1].replace(/,/g, '')))
  return amounts.length ? amounts : []
}

/**
 * Each block starting with a line that contains a time becomes one order.
 * Following lines without a time are treated as that order's detail.
 */
export function extractOrders(text) {
  const lines = deliverySection(toLines(text))
  const orders = []
  let current = null

  const push = () => {
    if (!current) return
    const detail = current.detail.filter(Boolean).join('\n')
    const amounts = sumMoney(detail)
    orders.push({
      title: current.title,
      time: current.time,
      detail,
      amount: amounts.length ? amounts[amounts.length - 1] : null,
      eachDay: EACH_DAY_RE.test(`${current.title} ${current.headline} ${detail}`),
    })
    current = null
  }

  for (const line of lines) {
    if (!line) continue
    if (/^total\b/i.test(line)) continue
    const time = extractTime(line)
    if (time) {
      push()
      const beforeColon = line.split(/[:\u2013-]/)[0]
      const looksLikeTitle = /[A-Za-z]{3}/.test(beforeColon) && !TIME_RE.test(beforeColon)
      const title = (looksLikeTitle ? beforeColon : line.replace(TIME_RE, '')).replace(/[\s:.\-]+$/, '').trim()
      current = { title: title || 'Catering order', time, headline: line, detail: [line] }
    } else if (current) {
      current.detail.push(line)
    }
  }
  push()
  return orders
}

/* ------------------------------------------------------------ whole form */

export function parseForm(text, { defaultYear = new Date().getFullYear() } = {}) {
  const lines = toLines(text)
  const joined = lines.join('\n')

  const dates = extractDates(text, defaultYear)
  const orders = extractOrders(text)

  const emails = [...new Set(joined.match(EMAIL_RE) || [])]
  const paxMatch = joined.match(/(\d{1,3}\s*(?:-|to|–)\s*\d{1,3}|\d{1,3})\s*pax/i)
  const phoneRaw = labelValue(lines, /phone\s*(number)?\s*[:|]?/i)
  const totalMatch = joined.match(/total\s*[:=]?\s*\$\s?([\d,]+(?:\.\d{1,2})?)/i)

  const details = {
    guest: labelValue(lines, /name\s+of\s+guest\/?s?\s*[:|]?/i) || labelValue(lines, /\bguest\/?s?\s*[:|]?/i),
    datesText: labelValue(lines, /\bdates?\b\s*[:|]?/i),
    pax: paxMatch ? `${paxMatch[1].replace(/\s+/g, '')} pax` : '',
    phone: (phoneRaw.match(/[\d][\d\s()+-]{5,}/) || [phoneRaw])[0].trim(),
    emails,
    address: labelValue(lines, /billing\s*address\s*[:|]?/i),
    chargeBack:
      (joined.match(/ref\s*[:#]\s*#?\s*([^\n]+)/i)?.[1] || '').trim() ||
      labelValue(lines, /charge\s*back(\s*authority)?\s*[:|]?/i),
    dietary: labelValue(lines, /dietary\s*(requirements?)?\s*[:|]?/i, { skip: DIETARY_BOILERPLATE }),
    // "Requested by" names the venue or department; "Requested" is the internal
    // draft note ("Jaz draft 13/08"), so they are kept apart.
    requestedBy: labelValue(lines, /requested\s*(?:by|from|for)\s*[:|]?/i) || matchSource(joined),
    requested: labelValue(lines, /^\s*requested\b(?!\s*(?:by|from|for)\b)\s*[:|]?/i),
    confirmation: labelValue(lines, /^\s*confirmation\s*[:|]?/i),
    total: totalMatch ? Number(totalMatch[1].replace(/,/g, '')) : null,
  }

  // One calendar event per order per applicable day.
  const events = []
  const targetDays = dates.length ? dates : []
  orders.forEach((order, oi) => {
    const days = order.eachDay || targetDays.length === 1 ? targetDays : targetDays.slice(0, 1)
    ;(days.length ? days : [null]).forEach((day, di) => {
      if (!day) return
      events.push({
        id: `${oi}-${di}-${day}`,
        date: day,
        time: order.time,
        title: order.title,
        detail: order.detail,
        amount: order.amount,
      })
    })
  })

  return { dates, orders, details, events, text }
}
