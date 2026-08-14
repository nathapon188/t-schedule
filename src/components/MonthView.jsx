import { MONTHS, WEEKDAYS_SHORT, monthGrid, toKey } from '../lib/dates.js'
import { colourFor } from '../lib/colours.js'

/**
 * Big month grid: booked days are tinted and every order shows as a pill.
 * The day opens itself, a pill opens the order it belongs to in the edit panel,
 * which is why the cell is a div with a button role rather than a button: a
 * button cannot hold other buttons.
 */
export default function MonthView({ month, events, selected, onSelect, onOpenEvent, compact = false }) {
  const days = monthGrid(month)
  const today = toKey(new Date())
  const limit = compact ? 2 : 4

  const byDay = events.reduce((acc, event) => {
    ;(acc[event.date] ||= []).push(event)
    return acc
  }, {})

  return (
    <div className="month">
      <div className="month-head">
        {WEEKDAYS_SHORT.map((d) => (
          <span key={d}>{compact ? d[0] : d.toUpperCase()}</span>
        ))}
      </div>

      <div className="month-grid">
        {days.map((day) => {
          const key = toKey(day)
          const dayEvents = (byDay[key] || []).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
          const outside = day.getMonth() !== month.getMonth()
          const classes = [
            'cell',
            outside && 'outside',
            dayEvents.length && 'booked',
            key === today && 'today',
            key === selected && 'selected',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <div
              key={key}
              className={classes}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(key)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(key)
                }
              }}
            >
              <span className="cell-date">
                {day.getDate() === 1 && !compact ? `${MONTHS[day.getMonth()].slice(0, 3)} 1` : day.getDate()}
              </span>
              <span className="cell-events">
                {dayEvents.slice(0, limit).map((event) => (
                  <button
                    type="button"
                    key={event.id}
                    className={`pill ${event.colour || colourFor(event.title)}`}
                    title={`${event.detail || event.title}\nClick to edit this order`}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (onOpenEvent) onOpenEvent(event)
                      else onSelect(key)
                    }}
                  >
                    <span className="pill-dot" />
                    <span className="pill-text">
                      {event.time ? `${event.time} ` : ''}
                      {event.title}
                    </span>
                  </button>
                ))}
                {dayEvents.length > limit && <span className="pill-more">{dayEvents.length - limit} more</span>}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
