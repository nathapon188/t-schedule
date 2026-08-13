// Orders keep a stable colour across every view, the way a calendar keeps a
// colour per calendar. Derived from the title so it survives a re-parse.

export const EVENT_COLOURS = ['green', 'blue', 'purple', 'orange', 'teal', 'red']

export function colourFor(title = '') {
  let hash = 0
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) % 100000
  return EVENT_COLOURS[hash % EVENT_COLOURS.length]
}
