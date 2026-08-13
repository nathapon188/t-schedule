import { useState } from 'react'

/**
 * The shared calendar holds guest names and contact details, so a passcode sits
 * in front of it. Entered once per device and kept in this browser.
 */
export default function PasscodeGate({ status, message, onConnect, onSkip, onClose, canClose }) {
  const [value, setValue] = useState('')
  const busy = status === 'connecting'

  return (
    <div className="gate-backdrop" role="dialog" aria-modal="true" aria-label="Shared calendar passcode">
      <form
        className="gate"
        onSubmit={(e) => {
          e.preventDefault()
          if (value.trim()) onConnect(value.trim())
        }}
      >
        <h2>Shared calendar</h2>
        <p className="muted">
          Enter the team passcode to load the bookings everyone shares. This device will remember it.
        </p>

        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          placeholder="Passcode"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />

        {status === 'unauthorised' && <p className="alert">That passcode was not accepted.</p>}
        {status === 'not_configured' && (
          <p className="alert">
            The site has no passcode set yet. Add SCHEDULE_PASSCODE in the Netlify site settings, then redeploy.
          </p>
        )}
        {status === 'unavailable' && (
          <p className="alert">No shared store on this address. The app still works on this device alone.</p>
        )}
        {status === 'offline' && <p className="alert">Could not reach the shared store. Check the connection.</p>}
        {message && status !== 'ready' && <p className="muted">{message}</p>}

        <div className="gate-actions">
          <button type="submit" disabled={busy || !value.trim()}>
            {busy ? 'Connecting…' : 'Connect'}
          </button>
          <button type="button" className="ghost" onClick={onSkip}>
            This device only
          </button>
          {canClose && (
            <button type="button" className="ghost" onClick={onClose}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
