import { useState } from 'react'
import { parseDietary, formatDietary, dietarySummary } from '../lib/dietary.js'

/**
 * Per-guest dietary rows. Paste the list off the function sheet and it is split
 * into name and requirement; everything stays editable afterwards.
 */
export default function DietaryEditor({ rows = [], onChange }) {
  const [paste, setPaste] = useState('')
  const [showPaste, setShowPaste] = useState(false)

  const update = (index, patch) => onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  const remove = (index) => onChange(rows.filter((_, i) => i !== index))
  const add = () => onChange([...rows, { name: '', requirement: '' }])

  const readPaste = (mode) => {
    const parsed = parseDietary(paste)
    if (!parsed.length) return
    onChange(mode === 'append' ? [...rows, ...parsed] : parsed)
    setPaste('')
    setShowPaste(false)
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h3>Guests and dietary</h3>
        <div>
          <button type="button" className="ghost" onClick={() => setShowPaste((v) => !v)}>
            {showPaste ? 'Hide paste' : 'Paste list'}
          </button>
          <button type="button" className="ghost" onClick={add}>+ Add</button>
        </div>
      </header>

      {showPaste && (
        <div className="paste-box">
          <textarea
            rows={7}
            value={paste}
            spellCheck={false}
            placeholder={'Brett Vegetarian\nCarly Waller Dairy Free\nKim Teale No garlic and lactose\nfree milk for coffee'}
            onChange={(e) => setPaste(e.target.value)}
          />
          <p className="muted">
            One guest per line, name first. A line that carries on from the one above is joined to it.
          </p>
          <div className="button-row">
            <button type="button" className="ghost" disabled={!paste.trim()} onClick={() => readPaste('replace')}>
              Read list
            </button>
            <button type="button" className="ghost" disabled={!paste.trim() || !rows.length} onClick={() => readPaste('append')}>
              Add to list
            </button>
            <button
              type="button"
              className="ghost"
              disabled={!rows.length}
              onClick={() => setPaste(formatDietary(rows))}
              title="Copy the current rows into the box to edit as text"
            >
              Load current
            </button>
          </div>
        </div>
      )}

      {!rows.length ? (
        <p className="muted">No guest list yet. Paste one, or add guests one at a time.</p>
      ) : (
        <>
          <div className="diet-rows">
            {rows.map((row, i) => (
              <div className="diet-row" key={i}>
                <input
                  className="diet-name"
                  placeholder="Name"
                  value={row.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                />
                <input
                  className="diet-req"
                  placeholder="Requirement"
                  value={row.requirement}
                  onChange={(e) => update(i, { requirement: e.target.value })}
                />
                <button type="button" className="icon danger" onClick={() => remove(i)} aria-label={`Remove ${row.name || 'guest'}`}>
                  &times;
                </button>
              </div>
            ))}
          </div>
          <p className="muted">{dietarySummary(rows)}</p>
        </>
      )}
    </section>
  )
}
