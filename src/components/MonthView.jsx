import { MONTHS, WEEKDAYS_SHORT, monthGrid, toKey } from '../lib/dates.js'
import { colourFor } from '../lib/colours.js'

/** Big month grid: booked days are tinted and every order shows as a pill. */
export default function MonthView({ month, events, selected, onSelect, compact = false }) {
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
            <button type="button" key={key} className={classes} onClick={() => onSelect(key)}>
              <span className="cell-date">
                {day.getDate() === 1 && !compact ? `${MONTHS[day.getMonth()].slice(0, 3)} 1` : day.getDate()}
              </span>
              <span className="cell-events">
                {dayEvents.slice(0, limit).map((event) => (
                  <span
                    key={event.id}
                    className={`pill ${event.colour || colourFor(event.title)}`}
                    title={event.detail || event.title}
                  >
                    <span className="pill-dot" />
                    <span className="pill-text">
                      {event.time ? `${event.time} ` : ''}
                      {event.title}
                    </span>
                  </span>
                ))}
                {dayEvents.length > limit && <span className="pill-more">{dayEvents.length - limit} more</span>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
