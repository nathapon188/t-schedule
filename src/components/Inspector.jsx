import ScheduleEditor from './ScheduleEditor.jsx'
import { bookingLabel } from '../lib/bookings.js'
import { SAMPLE_ONE_DAY, SAMPLE_TWO_DAYS, SAMPLE_RANGE } from '../samples.js'

/** Right-hand panel: import, correct, edit, save. Hidden in the mobile layout. */
export default function Inspector({
  imageUrl,
  status,
  error,
  note,
  onDismissNote,
  bookings,
  activeBooking,
  onActivate,
  onRemoveBooking,
  rawText,
  showText,
  onShowText,
  onRawText,
  onReparse,
  onFile,
  onPickImage,
  onPickJson,
  onSample,
  details,
  onDetails,
  events,
  onEvents,
  selected,
  onSelect,
  link,
  linkBase,
  onLinkBase,
  localhostLink,
  qr,
  onQr,
  onCopyLink,
  onSaveFile,
  onClear,
  onClose,
}) {
  return (
    <aside className="inspector">
      <header className="inspector-head">
        <h2>Bookings</h2>
        <button type="button" className="icon" onClick={onClose} title="Hide panel">
          &times;
        </button>
      </header>

      <div className="inspector-body">
        <section
          className="panel dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            onFile(e.dataTransfer.files?.[0])
          }}
        >
          {imageUrl ? (
            <img src={imageUrl} alt="Imported catering form" />
          ) : (
            <div className="dropzone-empty">
              <p><strong>Drop a form photo here</strong></p>
              <p className="muted">
                paste from the clipboard, or{' '}
                <button type="button" className="link" onClick={onPickImage}>browse</button>
              </p>
              <div className="samples">
                <span className="muted">Sample:</span>
                <button type="button" className="ghost" onClick={() => onSample(SAMPLE_ONE_DAY)}>1 day</button>
                <button type="button" className="ghost" onClick={() => onSample(SAMPLE_TWO_DAYS)}>2 days</button>
                <button type="button" className="ghost" onClick={() => onSample(SAMPLE_RANGE)}>Range</button>
              </div>
            </div>
          )}
          <p className="muted">Each form you import is added to the calendar. Nothing already on it is removed.</p>

          {status && (
            <div className="progress">
              <span>{status.stage}…</span>
              <progress value={status.progress || 0} max="1" />
            </div>
          )}
        </section>

        {error && <p className="alert">{error}</p>}
        {note && (
          <p className="note">
            {note.message}
            {note.action && (
              <button
                type="button"
                className="link"
                onClick={() => {
                  note.action.run()
                  onDismissNote()
                }}
              >
                {note.action.label}
              </button>
            )}
          </p>
        )}

        {bookings.length > 1 && (
          <section className="panel">
            <h3>Editing</h3>
            <div className="booking-tabs">
              {bookings.map((booking) => {
                const { name, days } = bookingLabel(booking, events)
                return (
                  <button
                    key={booking.id}
                    type="button"
                    className={`booking-tab ${booking.id === activeBooking?.id ? 'on' : ''}`}
                    onClick={() => onActivate(booking.id)}
                  >
                    <span className={`bullet ${booking.colour || 'green'}`} />
                    {name}
                    <span className="muted">
                      {' '}
                      {booking.details?.requestedBy ? `${booking.details.requestedBy} · ` : ''}
                      {days}d
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="muted">Details and Form text below apply to the selected booking.</p>
          </section>
        )}

        <ScheduleEditor
          details={details}
          onDetails={onDetails}
          events={events}
          onEvents={onEvents}
          bookings={bookings}
          activeBooking={activeBooking}
          selected={selected}
          onSelect={onSelect}
        />

        <section className="panel">
          <header className="panel-head">
            <h3>Form text</h3>
            <div>
              <button type="button" className="ghost" onClick={() => onShowText(!showText)} disabled={!activeBooking}>
                {showText ? 'Hide' : 'Edit'}
              </button>
              <button type="button" className="ghost" onClick={onReparse} disabled={!activeBooking}>
                Re-parse
              </button>
            </div>
          </header>
          {showText ? (
            <textarea
              className="raw"
              rows={12}
              value={rawText}
              spellCheck={false}
              placeholder="Paste the form text here, then press Re-parse"
              onChange={(e) => onRawText(e.target.value)}
            />
          ) : (
            <p className="muted">
              {rawText
                ? 'Open this if a field was read wrong, fix the text, then Re-parse. Only this booking is rebuilt.'
                : 'Nothing read yet.'}
            </p>
          )}
        </section>

        <section className="panel">
          <header className="panel-head">
            <h3>Save and share</h3>
            <div>
              {activeBooking && bookings.length > 1 && (
                <button type="button" className="ghost danger" onClick={() => onRemoveBooking(activeBooking.id)}>
                  Remove booking
                </button>
              )}
              <button type="button" className="ghost danger" onClick={onClear}>Clear all</button>
            </div>
          </header>
          <p className="muted">
            Kept in this browser automatically. No database or server involved, so each device holds its own copy.
          </p>
          <div className="button-row">
            <button type="button" className="ghost" disabled={!events.length} onClick={onSaveFile}>Save file</button>
            <button type="button" className="ghost" onClick={onPickJson}>Open file</button>
            <button type="button" className="ghost" disabled={!link} onClick={onCopyLink}>Copy link</button>
            <button type="button" className="ghost" disabled={!link} onClick={onQr}>Phone QR</button>
          </div>
          <p className="muted">
            To see this on a phone, send the <strong>Copy link</strong> address or scan the QR. The bookings travel inside
            the link, so the plain site address opens an empty calendar.
          </p>

          {localhostLink && (
            <label className="link-base">
              <span>
                This PC is serving on localhost, which a phone cannot reach. Replace it with this PC's IP (shown as the
                Network address in the terminal) before copying the link.
              </span>
              <input value={linkBase} onChange={(e) => onLinkBase(e.target.value)} />
            </label>
          )}

          {qr && (
            <div className="qr">
              <img src={qr} alt="QR code linking to this schedule" />
              <p className="muted">Scan to open every booking shown here on a phone.</p>
            </div>
          )}
          {!!link && <p className="muted link-preview">{link}</p>}
        </section>
      </div>
    </aside>
  )
}
