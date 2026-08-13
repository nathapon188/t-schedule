// Per-guest dietary requirements: "Brett Vegetarian", "Kim Teale No garlic".
//
// Pasted lists wrap wherever the source document wrapped, so a requirement can
// continue on the next line ("Unable to eat pineapple" / "or kiwi fruit"). The
// split between name and requirement is found by looking for the first word that
// reads as a dietary term rather than part of a name.

const DIET_WORDS = new Set(
  `vegetarian vegan veggie pescatarian dairy lactose gluten coeliac celiac nut nuts peanut peanuts
   shellfish seafood prawn prawns fish egg eggs soy soya sesame halal kosher allergic allergy allergies
   intolerant intolerance sensitive no not non none nil never unable cannot cant avoid avoids avoiding
   only prefers prefer dislikes dislike hates low fructose fodmap keto paleo df gf nf ndf onion garlic
   chilli chili spicy mild pork beef chicken bread wheat sugar salt vego`
    .split(/\s+/)
    .filter(Boolean),
)

const isDietWord = (word) => DIET_WORDS.has(word.replace(/[^\w']/g, '').toLowerCase())
const looksLikeNameWord = (word) => /^[A-Z][\w'’-]*\.?$/.test(word)

/** Rows from a pasted or typed list. Forgiving by design; the UI stays editable. */
export function parseDietary(text) {
  const rows = []
  const append = (line) => {
    const last = rows[rows.length - 1]
    if (!last) return
    last.requirement = `${last.requirement} ${line}`.replace(/\s+/g, ' ').trim()
  }

  for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
    const line = raw.trim().replace(/^[-•*\d.)\s]+(?=[A-Z])/, '')
    if (!line) continue

    // A line that does not start with a name carries on from the one above.
    if (!/^[A-Z]/.test(line)) {
      append(line)
      continue
    }

    // An explicit separator is the most reliable signal: "Carly Waller - dairy
    // free". A dash needs spaces around it, so a hyphenated name stays whole.
    const explicit = line.match(/^([^:|]{2,40}?)\s*[:|]\s*(.+)$/) || line.match(/^(.{2,40}?)\s+[-–—]\s+(.+)$/)
    if (explicit && explicit[1].split(/\s+/).length <= 4) {
      rows.push({ name: explicit[1].trim(), requirement: explicit[2].trim() })
      continue
    }

    const words = line.split(/\s+/)
    const nameWords = []
    let i = 0
    while (i < words.length && nameWords.length < 4 && looksLikeNameWord(words[i]) && !isDietWord(words[i])) {
      nameWords.push(words[i])
      i++
    }

    if (!nameWords.length) {
      if (rows.length) append(line)
      continue
    }
    rows.push({
      name: nameWords.join(' ').replace(/[,;:]$/, ''),
      requirement: words.slice(i).join(' ').trim(),
    })
  }

  return rows
}

/** Back to plain text, so the paste box round trips. */
export function formatDietary(rows = []) {
  return rows.map((r) => [r.name, r.requirement].filter(Boolean).join(' ')).join('\n')
}

/**
 * True when text reads as a guest list rather than a catering form: several
 * name-and-requirement rows, and none of the things a form always has (a date
 * row, pick-up times, a catering delivery block). Used so a photo of a sit-down
 * lunch list attaches to the booking being edited instead of starting a new one.
 */
export function looksLikeDietaryList(text = '') {
  const flat = String(text)
  if (/catering\s*(form|delivery|order)/i.test(flat)) return false
  if (/\b\d{1,2}\s*[:.]\s*\d{2}\s*(am|pm)?\b/i.test(flat)) return false
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}\b/i.test(flat)) return false
  if (/\b\d{1,2}\s*(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i.test(flat)) return false
  if (/\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/.test(flat)) return false

  const rows = parseDietary(flat)
  const named = rows.filter((r) => r.name)
  const withRequirement = rows.filter((r) => r.requirement)
  return named.length >= 2 && withRequirement.length >= 1
}

/** Adds rows to an existing list, skipping guests already on it. */
export function mergeDietary(existing = [], incoming = []) {
  const seen = new Set(existing.map((r) => (r.name || '').trim().toLowerCase()).filter(Boolean))
  const added = incoming.filter((r) => {
    const key = (r.name || '').trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
  return { rows: [...existing, ...added], added: added.length, skipped: incoming.length - added.length }
}

/** "7 guests, 4 vegetarian" style summary for the sidebar and run sheet. */
export function dietarySummary(rows = []) {
  const withRequirement = rows.filter((r) => r.requirement)
  if (!rows.length) return ''
  return `${rows.length} guest${rows.length === 1 ? '' : 's'}, ${withRequirement.length} with requirements`
}
