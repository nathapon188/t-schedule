import { weekDays, toKey, WEEKDAYS_SHORT, formatTime } from '../lib/dates.js'
import { colourFor } from '../lib/colours.js'

export default function WeekView({ anchor, events, selected, onSelect }) {
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
          <button type="button" key={key} className={classes} onClick={() => onSelect(key)}>
            <span className="week-head">
              <span className="week-day">{WEEKDAYS_SHORT[(day.getDay() + 6) % 7].toUpperCase()}</span>
              <span className="week-date">{day.getDate()}</span>
            </span>
            <span className="week-body">
              {items.map((event) => (
                <span key={event.id} className={`block ${event.colour || colourFor(event.title)}`}>
                  <strong>{formatTime(event.time) || 'TBC'}</strong>
                  {event.title}
                </span>
              ))}
            </span>
          </button>
        )
      })}
    </div>
  )
}
