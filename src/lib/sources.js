// Who asked for the catering. Suggestions, not a closed list: the field accepts
// anything typed, so a one-off requester does not need a code change.

export const REQUEST_SOURCES = ['Westside Hospital', 'Private Functions', 'Essence Suite']

/** Matches a known requester anywhere in the form text, tolerating OCR spacing. */
export function matchSource(text = '') {
  const flat = text.replace(/\s+/g, ' ').toLowerCase()
  return REQUEST_SOURCES.find((source) => flat.includes(source.toLowerCase())) || ''
}
