# Tamrab Thai catering schedule

Drop a photo of a catering form in, get a calendar with every booked day highlighted.
Runs entirely in the browser: no server, no database, no data leaves the machine.

Hosted at https://tbooking.netlify.app/ (Netlify, with the shared store below).
The GitHub Pages workflow in `.github/workflows/deploy.yml` is an alternative
static deploy, but Pages cannot run the function, so it has no shared calendar.

## Shared calendar

Open the site on any device, enter the team passcode once, and the same bookings
load. Edits sync both ways.

- `netlify/functions/schedule.mjs` keeps one JSON document in Netlify Blobs and
  requires the `x-schedule-key` header to match the `SCHEDULE_PASSCODE`
  environment variable. Without that variable set the function refuses every
  request rather than serving guest details openly.
- `src/lib/sync.js` pulls on load, on tab focus and every 20 seconds, and pushes
  local edits 1.2s after you stop typing.
- Writes carry the version they were based on. If someone else saved first the
  function replies 409 with their copy, and the client merges and retries.
- Merging is a union by id: both devices' bookings survive, and deletions are
  recorded as tombstones so a removed booking is not resurrected by the next
  device to sync.
- A device with no unsaved edits accepts the shared copy outright, so another
  device's changes show up rather than being overwritten by a stale snapshot.
  Only a device holding unsaved edits keeps its own version of a clashing
  booking, which it then pushes up. If two people edit the same booking at the
  same moment, the one who saves last wins that booking.
- Every device also keeps its own local copy, so the calendar still opens when
  the connection or the function is unavailable. "This device only" opts out of
  sharing entirely.

### Setting the passcode

In Netlify: Site configuration → Environment variables → add `SCHEDULE_PASSCODE`
with a value you share with the team, then redeploy. It is never committed. To
rotate it, change the variable and each device enters the new one once.

A share link is still available and is now a snapshot: whoever opens it gets
their own copy of that booking, which is useful for sending a single run sheet to
someone who should not have the passcode.

## Run it

```
npm install
npm run dev
```

Vite prints a Local and a Network address. Use the Network one on a phone.

## How it works

1. **Import** a photo, screenshot or scan (drag and drop, browse, or Ctrl+V a
   clipboard screenshot). Tesseract.js reads the text in the browser.
2. **Parse** (`src/lib/parse.js`) pulls out the booking dates, the pick-up times
   and line items, and the contact fields. Orders written as "each day" repeat
   across every booked date, which is why a two-day booking highlights two days.
3. **Check and correct** in the right-hand panel. Every field is editable, and
   "Form text" lets you fix an OCR misread and Re-parse.
4. **Use it**: Day / Week / Month / Year views, .ics export for Outlook, print,
   or a link/QR for a phone.

## Date formats understood

Australian order (day first) throughout:

- `Friday 21st August 2026`
- `Friday 21st & Saturday 22nd August 2026`
- `21 and 22 August 2026`
- `Monday 24th – Wednesday 26th August 2026` (expanded to every day in range)
- `30th August - 1st September 2026` (crosses the month)
- `3, 4, 7 October 2026`
- `21/08/2026`
- `August 13 & 14, 2026`
- OCR artefacts where a superscript ordinal comes back as a quote or symbol:
  `13" & 14" August 2026`, `13* & 14* August 2026`

The "REQUESTED" and "CONFIRMATION" rows are ignored, so an internal note like
"Jaz draft 13/08" is not mistaken for a booking date.

## Requested by

Each booking records who asked for the catering. Westside Hospital, Private
Functions and Essence Suite are offered as one-click chips and as autocomplete
suggestions, and the field accepts anything else typed. It is read off the form
automatically from a "Requested By" row, or from any of those names appearing in
the form text, and it is kept separate from the internal "REQUESTED" draft note.

With more than one requester loaded, the dark rail shows filter chips that limit
the calendar to one requester at a time. The editing panel always lists every
order, so nothing hides behind a filter. The requester also travels in the
share link and lands in the .ics description.

## Several bookings on one calendar

Importing a form **adds** it to the calendar; nothing already there is removed.
Each booking gets its own colour, its own contact details, and its own copy of
the form text, and appears in the Bookings list at the bottom of the dark rail.
Orders that already exist on the same day, time and title are treated as a
re-paste of the same form and skipped, with the count reported.

Every import shows an Undo, so a wrong scan is one click away from being backed
out. Remove booking drops one booking and its orders; Clear all empties the
calendar. Re-parse rebuilds only the booking being edited.

## Saving, without a database

- **This browser** remembers every loaded booking automatically (localStorage).
- **Save file / Open file** writes a `.json` you can keep on a shared drive.
- **Copy link / Phone QR** encodes the whole schedule inside the URL hash, so
  another device opens the same schedule with no backend. Served from GitHub
  Pages the link works anywhere; running locally it points at `localhost`, so
  swap in this PC's LAN IP using the address box before sharing it.
- **Export .ics** hands the run sheet to Outlook or Google Calendar.

## Checks

```
node scripts/test-parse.mjs                 # date, time and form parsing
node scripts/test-bookings.mjs              # merging forms, dedupe, link and ics
node scripts/test-sync.mjs                  # shared store merge and tombstones
node scripts/test-ocr.mjs path\to\form.png  # full OCR pass on a real image
```

`test-ocr.mjs` downloads the English OCR model on first run, so it needs
internet once.

## Layout

- `src/lib/parse.js` — form text to dates, orders and details
- `src/lib/dates.js` — date maths and AU formatting (Monday-first weeks)
- `src/lib/ocr.js` — Tesseract worker, upscales small images first
- `src/lib/storage.js` — localStorage, JSON file, URL link encoding
- `src/lib/sync.js` — shared store client, merge and conflict retry
- `netlify/functions/schedule.mjs` — the shared store itself
- `src/lib/ics.js` — calendar export
- `src/components/` — sidebar, month/week/day/year views, editing panel
