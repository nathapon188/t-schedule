// Keeps a tablet's screen on while the calendar is up on the wall or the bench.
//
// Windows tablets dim and lock on their own timer, which is fine for a laptop
// and useless for a screen that is only there to be read. The Screen Wake Lock
// API asks the OS to hold that off while this tab is visible; nothing else can,
// short of changing the machine's power plan.

import { useEffect, useState } from 'react'

const KEY = 't-schedule/awake'

export function wakeLockSupported() {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator
}

export function loadKeepAwake() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function saveKeepAwake(on) {
  try {
    if (on) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Holds a screen wake lock while `enabled`. Returns whether one is actually
 * held, so the tick box can own up when the browser has taken it back.
 *
 * The lock is dropped by the browser whenever the tab is hidden - switching
 * app, locking the tablet by hand - and is not handed back on return, so the
 * visibility listener asks again.
 */
export function useKeepAwake(enabled) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!enabled || !wakeLockSupported()) {
      setActive(false)
      return undefined
    }

    let lock = null
    let dropped = false

    const onRelease = () => setActive(false)

    const acquire = async () => {
      if (dropped || lock || document.visibilityState !== 'visible') return
      try {
        lock = await navigator.wakeLock.request('screen')
        if (dropped) {
          lock.release().catch(() => {})
          lock = null
          return
        }
        lock.addEventListener('release', onRelease)
        setActive(true)
      } catch {
        // Denied, or the battery is too low for the OS to allow it.
        lock = null
        setActive(false)
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire()
      else {
        lock = null // already released by the browser
        setActive(false)
      }
    }

    acquire()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      dropped = true
      document.removeEventListener('visibilitychange', onVisible)
      if (lock) {
        lock.removeEventListener('release', onRelease)
        lock.release().catch(() => {})
        lock = null
      }
      setActive(false)
    }
  }, [enabled])

  return active
}
