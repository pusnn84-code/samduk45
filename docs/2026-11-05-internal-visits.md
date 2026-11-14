# App-only pastoral visits

The live visit APIs use src/features/visits/internal-calendar.ts. A member submission is requested; only an authenticated admin can create a confirmed appointment directly, accept a request, edit its date/details, complete it, or cancel it. The existing unique active-date index serializes competing reservations (one active request/appointment per day).

The admin monthly calendar includes confirmed/completed records only. Pending requests appear in the request list. Members receive only their own request history and date availability, without other members' names, reasons, or locations. Booking periods and blocked dates/weekdays still apply to member requests; the pastor can directly register an appointment outside those restrictions.

Google Calendar setup/list/selection/status endpoints return 410 after admin authorization. Its callback refuses Calendar authorization, but preserves the separate Gmail notification callback. Historical Google provider modules remain for legacy unit coverage and connection cleanup; live visit operations never resolve them or call Google. Existing external resources/events are not deleted. Gmail receipts remain opt-in and are queued atomically on member submission without placing private reasons/locations/attendees in the outbox.

Directory family fields are excluded from the query DTO and UI. Birth-date initial passwords are deferred because the approved roster has age but no birth dates. The existing guard against disclosing phone-based passwords remains while the owner selects a replacement credential/publication approach.
