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

/** "7 guests, 4 vegetarian" style summary for the sidebar and run sheet. */
export function dietarySummary(rows = []) {
  const withRequirement = rows.filter((r) => r.requirement)
  if (!rows.length) return ''
  return `${rows.length} guest${rows.length === 1 ? '' : 's'}, ${withRequirement.length} with requirements`
}
