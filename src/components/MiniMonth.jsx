import { MONTHS, monthGrid, toKey, addMonths } from '../lib/dates.js'

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** Compact month used in the sidebar and in the year view. */
export default function MiniMonth({ month, bookedDays, selected, onSelect, onMonthChange, showTitle = true, titleClick }) {
  const days = monthGrid(month)
  const today = toKey(new Date())
  const booked = new Set(bookedDays)

  return (
    <div className="mini">
      {showTitle && (
        <header className="mini-head">
          <button type="button" className="mini-title" onClick={titleClick} disabled={!titleClick}>
            {MONTHS[month.getMonth()]} <span className="year">{month.getFullYear()}</span>
          </button>
          {onMonthChange && (
            <span className="mini-nav">
              <button type="button" onClick={() => onMonthChange(addMonths(month, -1))} aria-label="Previous month">
                &lsaquo;
              </button>
              <button type="button" onClick={() => onMonthChange(addMonths(month, 1))} aria-label="Next month">
                &rsaquo;
              </button>
            </span>
          )}
        </header>
      )}

      <div className="mini-grid">
        {LETTERS.map((letter, i) => (
          <span key={i} className="mini-letter">
            {letter}
          </span>
        ))}
        {days.map((day) => {
          const key = toKey(day)
          const classes = [
            'mini-day',
            day.getMonth() !== month.getMonth() && 'outside',
            booked.has(key) && 'booked',
            key === today && 'today',
            key === selected && 'selected',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <button type="button" key={key} className={classes} onClick={() => onSelect?.(key)}>
              {day.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
