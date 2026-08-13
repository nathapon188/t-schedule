// Text fixtures matching the printed catering form, for trying the app without
// uploading anything. Same shape the OCR pass produces.
//
// Fictional data only: no real guest, venue or contact details belong in here.

export const SAMPLE_TWO_DAYS = `CATERING FORM
Name of Guest/s   Dana Whitfield
Dates   Friday 21st & Saturday 22nd August 2026
NUMBER OF PAX   7-8 pax
Phone Number   07 3000 0000
Email   bookings@example.com
accounts@example.com
Billing Address   1 SAMPLE ST BRISBANE Q 4000
Charge Back Authority   ref: #SamplePhotography
Catering Delivery-
Morning Tea Order: Pick up at 11:00am each day
7 x Fruit Cups each day ($2.50) = $17.50

Lunch Order: Pick up at 12:50pm each day
8 x Variety of sandwiches ($8.50) = $68

Total = $85.50
DIETARY REQUIREMENTS   TBC
REQUESTED   Draft 13/08
CONFIRMATION`

export const SAMPLE_ONE_DAY = SAMPLE_TWO_DAYS.replace(
  'Friday 21st & Saturday 22nd August 2026',
  'Friday 21st August 2026',
)

export const SAMPLE_RANGE = SAMPLE_TWO_DAYS.replace(
  'Friday 21st & Saturday 22nd August 2026',
  'Monday 24th - Wednesday 26th August 2026',
)

// The same booking as OCR often mangles it: superscript ordinals come back as
// quote marks, which used to stop the dates being recognised at all.
export const SAMPLE_OCR_ARTEFACTS = SAMPLE_TWO_DAYS.replace(
  'Friday 21st & Saturday 22nd August 2026',
  'Thursday 13" & Friday 14" August 2026',
)
