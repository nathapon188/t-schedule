import { weekDays, toKey, WEEKDAYS_SHORT, formatTime } from '../lib/dates.js'
import { colourFor } from '../lib/colours.js'

/** A day opens itself, an order opens in the edit panel. See MonthView on why
 *  the column is a div with a button role. */
export default function WeekView({ anchor, events, selected, onSelect, onOpenEvent }) {
  const days = weekDays(anchor)
  const today = toKey(new Date())

  return (
    <div className="week">
      {days.map((day) => {
        const key = toKey(day)
        const items = events.filter((e) => e.date === key).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
        const classes = ['week-col', items.length && 'booked', key === today && 'today', key === selected && 'selected']
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
            <span className="week-head">
              <span className="week-day">{WEEKDAYS_SHORT[(day.getDay() + 6) % 7].toUpperCase()}</span>
              <span className="week-date">{day.getDate()}</span>
            </span>
            <span className="week-body">
              {items.map((event) => (
                <button
                  type="button"
                  key={event.id}
                  className={`block ${event.colour || colourFor(event.title)}`}
                  title={`${event.detail || event.title}\nClick to edit this order`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (onOpenEvent) onOpenEvent(event)
                    else onSelect(key)
                  }}
                >
                  <strong>{formatTime(event.time) || 'TBC'}</strong>
                  {event.title}
                </button>
              ))}
            </span>
          </div>
        )
      })}
    </div>
  )
}
