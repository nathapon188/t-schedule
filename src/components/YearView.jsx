import MiniMonth from './MiniMonth.jsx'
import { MONTHS, startOfMonth, fromKey } from '../lib/dates.js'

export default function YearView({ anchor, events, selected, onSelect, onMonthChange, onViewMonth }) {
  const year = anchor.getFullYear()
  const bookedDays = [...new Set(events.map((e) => e.date))]

  return (
    <div className="year">
      {MONTHS.map((name, i) => (
        <div key={name} className="year-cell">
          <button
            type="button"
            className="year-title"
            onClick={() => {
              onMonthChange(new Date(year, i, 1))
              onViewMonth()
            }}
          >
            {name}
          </button>
          <MiniMonth
            month={new Date(year, i, 1)}
            bookedDays={bookedDays}
            selected={selected}
            showTitle={false}
            onSelect={(key) => {
              onSelect(key)
              onMonthChange(startOfMonth(fromKey(key)))
            }}
          />
        </div>
      ))}
    </div>
  )
}
