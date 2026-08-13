import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import Sidebar from './components/Sidebar.jsx'
import MonthView from './components/MonthView.jsx'
import WeekView from './components/WeekView.jsx'
import DayView from './components/DayView.jsx'
import YearView from './components/YearView.jsx'
import Inspector from './components/Inspector.jsx'
import { parseForm } from './lib/parse.js'
import { readImage } from './lib/ocr.js'
import { downloadIcs } from './lib/ics.js'
import { buildBooking } from './lib/bookings.js'
import { MONTHS, fromKey, toKey, startOfMonth, startOfWeek, addDays, addMonths, formatLong, formatTime } from './lib/dates.js'
import { loadLocal, saveLocal, clearLocal, stateFromHash, shareLink, downloadJson, readJsonFile } from './lib/storage.js'

const EMPTY_DETAILS = { guest: '', pax: '', phone: '', emails: [], address: '', chargeBack: '', dietary: '', requestedBy: '', requested: '', confirmation: '', total: null }

const MOBILE_WIDTH = 900
const VIEWS = ['Day', 'Week', 'Month', 'Year']

export default function App() {
  // A shared link wins over whatever this browser remembers.
  const initial = useRef(stateFromHash() || loadLocal() || { bookings: [], events: [] }).current
  const firstDate = initial.events.length ? [...initial.events].map((e) => e.date).sort()[0] : null

  const [bookings, setBookings] = useState(initial.bookings)
  const [events, setEvents] = useState(initial.events)
  const [activeId, setActiveId] = useState(initial.bookings[initial.bookings.length - 1]?.id || null)

  const [imageUrl, setImageUrl] = useState(null)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [note, setNote] = useState(null)
  const [anchor, setAnchor] = useState(firstDate ? fromKey(firstDate) : new Date())
  const [selected, setSelected] = useState(firstDate)
  const [view, setView] = useState('Month')
  const [showText, setShowText] = useState(false)
  const [viewMode, setViewMode] = useState(() => (window.innerWidth <= MOBILE_WIDTH ? 'mobile' : 'desktop'))
  const [wideScreen, setWideScreen] = useState(() => window.innerWidth > MOBILE_WIDTH)
  const [inspectorOpen, setInspectorOpen] = useState(!initial.events.length)
  const [linkBase, setLinkBase] = useState(() => window.location.origin + window.location.pathname)
  const [qr, setQr] = useState(null)
  const [sourceFilter, setSourceFilter] = useState('')

  const fileInput = useRef(null)
  const jsonInput = useRef(null)

  const isMobile = viewMode === 'mobile'
  const emulating = isMobile && wideScreen
  const month = startOfMonth(anchor)

  const activeBooking = bookings.find((b) => b.id === activeId) || bookings[bookings.length - 1] || null
  const details = activeBooking?.details || EMPTY_DETAILS
  const rawText = activeBooking?.rawText || ''

  useEffect(() => {
    const onResize = () => setWideScreen(window.innerWidth > MOBILE_WIDTH)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    saveLocal({ bookings, events })
  }, [bookings, events])

  const flash = (message, action = null) => setNote({ message, action })

  useEffect(() => {
    if (!note) return
    const timer = setTimeout(() => setNote(null), 9000)
    return () => clearTimeout(timer)
  }, [note])

  const goTo = (key) => {
    setSelected(key)
    setAnchor(fromKey(key))
  }

  const patchBooking = (id, patch) => setBookings((list) => list.map((b) => (b.id === id ? { ...b, ...patch } : b)))

  const setDetails = (next) => {
    if (activeBooking) patchBooking(activeBooking.id, { details: next })
  }

  const removeBooking = (id) => {
    setBookings((list) => list.filter((b) => b.id !== id))
    setEvents((list) => list.filter((e) => e.bookingId !== id))
    if (activeId === id) setActiveId(null)
  }

  /** Adds a form to the calendar, keeping everything already on it. */
  const addForm = useCallback(
    (text, { replace = false } = {}) => {
      const parsed = parseForm(text)
      if (!parsed.dates.length) {
        setError('No dates found. Open Form text, fix the date line, then Re-parse.')
      } else if (!parsed.orders.length) {
        setError('Dates found, but no pick-up times. Add the orders by hand below.')
      } else {
        setError(null)
      }

      const baseBookings = replace ? [] : bookings
      const baseEvents = replace ? [] : events
      const { booking, events: added, duplicates } = buildBooking(parsed, {
        bookings: baseBookings,
        events: baseEvents,
        rawText: text,
      })

      setBookings([...baseBookings, booking])
      setEvents([...baseEvents, ...added])
      setActiveId(booking.id)

      if (added.length) {
        const first = added.map((e) => e.date).sort()[0]
        setAnchor(fromKey(first))
        setSelected(first)
      }

      const who = parsed.details.guest || 'Booking'
      const days = new Set(added.map((e) => e.date)).size
      if (added.length) {
        flash(
          `Added ${who}: ${days} day${days === 1 ? '' : 's'}, ${added.length} order${added.length === 1 ? '' : 's'}` +
            (duplicates ? `. ${duplicates} duplicate skipped.` : '. Existing bookings kept.'),
          { label: 'Undo', run: () => removeBooking(booking.id) },
        )
      } else if (duplicates) {
        flash(`${who} is already on the calendar, nothing added.`, { label: 'Undo', run: () => removeBooking(booking.id) })
      }
      return parsed
    },
    [bookings, events],
  )

  /** Re-parses the active booking's text in place, leaving other bookings alone. */
  const reparseActive = () => {
    if (!activeBooking) return
    const parsed = parseForm(activeBooking.rawText || '')
    const colour = activeBooking.colour
    patchBooking(activeBooking.id, { details: parsed.details })
    setEvents((list) => [
      ...list.filter((e) => e.bookingId !== activeBooking.id),
      ...parsed.events.map((e, i) => ({ ...e, id: `${activeBooking.id}-${i}`, bookingId: activeBooking.id, colour })),
    ])
    if (parsed.events.length) {
      const first = parsed.events.map((e) => e.date).sort()[0]
      setAnchor(fromKey(first))
      setSelected(first)
      setError(null)
    } else {
      setError('Still no dates in that text. Check the date line spelling.')
    }
  }

  const handleFile = useCallback(
    async (file) => {
      if (!file) return
      if (file.name?.toLowerCase().endsWith('.json')) {
        try {
          const loaded = await readJsonFile(file)
          setBookings(loaded.bookings)
          setEvents(loaded.events)
          setActiveId(loaded.bookings[loaded.bookings.length - 1]?.id || null)
          if (loaded.events.length) {
            const first = [...loaded.events].map((e) => e.date).sort()[0]
            setAnchor(fromKey(first))
            setSelected(first)
          }
          setError(null)
          flash(`Opened ${loaded.bookings.length} booking${loaded.bookings.length === 1 ? '' : 's'} from file.`)
        } catch (err) {
          setError(`Could not open that file: ${err.message}`)
        }
        return
      }
      if (!file.type.startsWith('image/')) {
        setError('That file is not an image or a saved .json schedule.')
        return
      }
      setError(null)
      setInspectorOpen(true)
      setImageUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(file)
      })
      setStatus({ stage: 'Starting', progress: 0 })
      try {
        const text = await readImage(file, setStatus)
        addForm(text)
      } catch (err) {
        console.error(err)
        setError(`Could not read the image: ${err.message}. Paste the form text instead.`)
        setShowText(true)
      } finally {
        setStatus(null)
      }
    },
    [addForm],
  )

  // Paste an image straight from the clipboard (Win+Shift+S then Ctrl+V).
  useEffect(() => {
    const onPaste = (e) => {
      const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'))
      if (item) handleFile(item.getAsFile())
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [handleFile])

  const link = useMemo(() => (events.length ? shareLink({ bookings, events }, linkBase) : ''), [bookings, events, linkBase])

  const buildQr = async () => {
    if (!link) return
    try {
      setQr(await QRCode.toDataURL(link, { margin: 1, width: 240, errorCorrectionLevel: 'L' }))
    } catch {
      setError(`Too much data for one QR code (${link.length} characters). Use Copy link, or save a file instead.`)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      flash('Link copied. Anyone opening it gets this schedule.')
    } catch {
      setError('Clipboard blocked, copy the link text shown below.')
    }
  }

  const clearAll = () => {
    clearLocal()
    setBookings([])
    setEvents([])
    setActiveId(null)
    setImageUrl(null)
    setSelected(null)
    setQr(null)
    setError(null)
    setNote(null)
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname)
  }

  const step = (direction) => {
    if (view === 'Day') {
      const next = addDays(selected ? fromKey(selected) : anchor, direction)
      setAnchor(next)
      setSelected(toKey(next))
    } else if (view === 'Week') {
      setAnchor(addDays(startOfWeek(anchor), direction * 7))
    } else if (view === 'Year') {
      setAnchor(new Date(anchor.getFullYear() + direction, anchor.getMonth(), 1))
    } else {
      setAnchor(addMonths(month, direction))
    }
  }

  const today = () => {
    const now = new Date()
    setAnchor(now)
    setSelected(toKey(now))
  }

  // Filtering by requester only changes what the calendar shows; the editing
  // panel always lists every order so nothing goes missing behind a filter.
  const sources = useMemo(
    () => [...new Set(bookings.map((b) => b.details?.requestedBy).filter(Boolean))].sort(),
    [bookings],
  )
  const visibleEvents = useMemo(() => {
    if (!sourceFilter) return events
    const ids = new Set(bookings.filter((b) => (b.details?.requestedBy || '') === sourceFilter).map((b) => b.id))
    return events.filter((e) => ids.has(e.bookingId))
  }, [events, bookings, sourceFilter])

  const bookedDays = useMemo(() => [...new Set(visibleEvents.map((e) => e.date))].sort(), [visibleEvents])
  const selectedEvents = useMemo(
    () => visibleEvents.filter((e) => e.date === selected).sort((a, b) => (a.time || '').localeCompare(b.time || '')),
    [visibleEvents, selected],
  )

  const title = useMemo(() => {
    if (view === 'Year') return String(anchor.getFullYear())
    if (view === 'Day') return formatLong(selected || toKey(anchor))
    if (view === 'Week') {
      const start = startOfWeek(anchor)
      const end = addDays(start, 6)
      return start.getMonth() === end.getMonth()
        ? `${start.getDate()} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`
        : `${start.getDate()} ${MONTHS[start.getMonth()].slice(0, 3)} – ${end.getDate()} ${MONTHS[end.getMonth()].slice(0, 3)} ${end.getFullYear()}`
    }
    return `${MONTHS[month.getMonth()]} ${month.getFullYear()}`
  }, [view, anchor, month, selected])

  const localhostLink = /localhost|127\.0\.0\.1/.test(linkBase)

  return (
    <div className={`shell ${isMobile ? 'is-mobile' : 'is-desktop'} ${emulating ? 'emulating' : ''}`}>
      <Sidebar
        month={month}
        onMonthChange={setAnchor}
        events={visibleEvents}
        bookings={bookings}
        sources={sources}
        sourceFilter={sourceFilter}
        onSourceFilter={setSourceFilter}
        activeId={activeBooking?.id || null}
        onActivate={(id) => {
          setActiveId(id)
          const own = events.filter((e) => e.bookingId === id).map((e) => e.date).sort()
          if (own.length) goTo(own[0])
        }}
        onRemoveBooking={removeBooking}
        selected={selected}
        onSelect={goTo}
        onImport={() => fileInput.current?.click()}
      />

      <div className="main">
        <header className="toolbar">
          <div className="toolbar-left">
            <div className="stepper">
              <button type="button" onClick={() => step(-1)} aria-label="Previous">&lsaquo;</button>
              <button type="button" className="today" onClick={today}>Today</button>
              <button type="button" onClick={() => step(1)} aria-label="Next">&rsaquo;</button>
            </div>
            <h1 className="period">
              {view === 'Month' ? (
                <>
                  {MONTHS[month.getMonth()]} <span className="year">{month.getFullYear()}</span>
                </>
              ) : (
                title
              )}
            </h1>
          </div>

          <div className="toolbar-right">
            <div className="segmented" role="group" aria-label="Calendar view">
              {VIEWS.map((name) => (
                <button key={name} type="button" className={view === name ? 'on' : ''} onClick={() => setView(name)}>
                  {name}
                </button>
              ))}
            </div>
            <div className="segmented layout-toggle" role="group" aria-label="Layout">
              {['desktop', 'mobile'].map((mode) => (
                <button key={mode} type="button" className={viewMode === mode ? 'on' : ''} onClick={() => setViewMode(mode)}>
                  {mode === 'desktop' ? 'Desktop' : 'Mobile'}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="ghost desktop-only"
              disabled={!events.length}
              onClick={() => downloadIcs(events, bookings)}
            >
              Export .ics
            </button>
            <button
              type="button"
              className={`ghost desktop-only ${inspectorOpen ? 'on' : ''}`}
              onClick={() => setInspectorOpen((v) => !v)}
            >
              {inspectorOpen ? 'Hide panel' : 'Import / edit'}
            </button>
          </div>
        </header>

        <div className="canvas">
          <div className="stage">
            {view === 'Month' && (
              <MonthView month={month} events={visibleEvents} selected={selected} onSelect={goTo} compact={isMobile} />
            )}
            {view === 'Week' && <WeekView anchor={anchor} events={visibleEvents} selected={selected} onSelect={goTo} />}
            {view === 'Day' && <DayView anchor={selected || toKey(anchor)} events={visibleEvents} />}
            {view === 'Year' && (
              <YearView
                anchor={anchor}
                events={visibleEvents}
                selected={selected}
                onSelect={setSelected}
                onMonthChange={setAnchor}
                onViewMonth={() => setView('Month')}
              />
            )}

            {isMobile && (
              <section className="mobile-detail">
                {!events.length && <p className="alert">Nothing scheduled. Open a shared link, or import a form on desktop.</p>}
                {selected && (
                  <>
                    <h2>{formatLong(selected)}</h2>
                    {selectedEvents.length ? (
                      <ul className="run-sheet">
                        {selectedEvents.map((e) => (
                          <li key={e.id}>
                            <span className={`time-pill ${e.colour || 'green'}`}>{formatTime(e.time) || 'TBC'}</span>
                            <div>
                              <strong>{e.title}</strong>
                              {e.detail && <p className="muted">{e.detail}</p>}
                              {e.amount != null && <p className="muted">${Number(e.amount).toFixed(2)}</p>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">Nothing booked on this day.</p>
                    )}
                  </>
                )}
                {!!bookedDays.length && (
                  <div className="mobile-days">
                    {bookedDays.map((day) => (
                      <button type="button" key={day} className={day === selected ? 'on' : ''} onClick={() => goTo(day)}>
                        {formatLong(day)}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>

          {inspectorOpen && !isMobile && (
            <Inspector
              imageUrl={imageUrl}
              status={status}
              error={error}
              note={note}
              onDismissNote={() => setNote(null)}
              bookings={bookings}
              activeBooking={activeBooking}
              onActivate={setActiveId}
              onRemoveBooking={removeBooking}
              rawText={rawText}
              showText={showText}
              onShowText={setShowText}
              onRawText={(text) => activeBooking && patchBooking(activeBooking.id, { rawText: text })}
              onReparse={reparseActive}
              onFile={handleFile}
              onPickImage={() => fileInput.current?.click()}
              onPickJson={() => jsonInput.current?.click()}
              onSample={(text) => addForm(text)}
              details={details}
              onDetails={setDetails}
              events={events}
              onEvents={setEvents}
              selected={selected}
              onSelect={goTo}
              link={link}
              linkBase={linkBase}
              onLinkBase={(value) => { setLinkBase(value); setQr(null) }}
              localhostLink={localhostLink}
              qr={qr}
              onQr={buildQr}
              onCopyLink={copyLink}
              onSaveFile={() => downloadJson({ bookings, events })}
              onClear={clearAll}
              onClose={() => setInspectorOpen(false)}
            />
          )}
        </div>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <input
        ref={jsonInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
    </div>
  )
}
