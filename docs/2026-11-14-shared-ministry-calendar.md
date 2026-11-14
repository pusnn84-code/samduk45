# Shared visits and ministry calendar

Approved design: compact cards sized to their text, a shared month, and details beneath the selected date. No separate personal-request list. Ministry event titles have no kind prefix.

- Authenticated members and the pastor read the same `/api/visits/calendar?month=YYYY-MM` data. Unauthenticated access is denied and responses are private/no-store. The shared DTO includes recipient name/sam, date/time, place and state, but excludes request reasons, contact details and private notes.
- Only admins can create confirmed ministry events, deactivate a recurring series, choose another visit recipient, accept requests, or mark a pending request unavailable. Members still submit pending self-requests.
- Explicit visit recipients are resolved from active roster IDs on the server. Their name/sam is saved separately from requester identity and additional attendees. Legacy pastor entries use the attendee text; ambiguous names never receive a guessed sam. Missing historical targets display `심방 대상 미입력` instead of attributing the appointment to the pastor.
- Green means confirmed/completed, yellow pending, red explicitly unavailable. Existing cancellations remain cancellations and are excluded from the shared calendar; they are not relabelled unavailable.
- All dates, including past and booking-blocked dates, can be opened for reading. Booking restrictions apply to the member submission action; the pastor can register directly.
- Ministry repeats are stored as one weekly series and expanded only across the requested month in Seoul calendar dates. Optional inclusive end dates are supported. Removing a series soft-deactivates it, after an explicit whole-series confirmation.
- Dates show at most two shortened titles plus an additional-count indicator; the full day shows every event. No fixed tall card or empty location row.

## Release requirements

1. Apply `drizzle/20261114010000_shared_ministry_calendar.sql` before deploying this source. It adds recipient snapshots, explicit unavailable state and the private ministry table; it also includes the pending removal of the old one-active-visit-per-day unique index.
2. Verify columns/table, RLS, denied anon/authenticated grants and absence of the unique date index. No roster/visit rows are deleted by this migration.
3. Deploy the latest complete source archive, not the older pending Vercel Drop. The earlier pastoral split, installation guide and one-line empathy changes remain included.
4. Register the requested `목요전도대` weekly Thursday 14:00 series with the pastor's authenticated UI after checking for an existing series. Use only confirmed date/place information; no sample person or sample location should be inserted in production.
5. Verify member calendar visibility and denied admin writes, multiple appointments per day, recipient identity, weekly recurrence, unavailable versus cancelled, past-date reading, phone-width overflow, and the compact cards.

## Validation / current limitation

Visit policy/API tests and source TypeScript validation run locally. Browser access to the temporary component development server timed out, so interactive mobile QA is still pending. Vercel currently displays the 5000-file/24-hour upload limit. Source is not yet deployed, and this migration has not been applied. No fake visits or ministry events were added to production.
