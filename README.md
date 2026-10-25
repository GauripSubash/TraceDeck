# TraceDeck

A local service-event investigation tool. Select an event to see the preceding
events sharing its request ID across services.

## First milestone

Build one working path: HTTP request -> Spring Boot -> PostgreSQL -> JSON response.

1. Start PostgreSQL and verify that it accepts queries.
2. Create a Spring Boot backend and connect it to PostgreSQL.
3. Store an example event and retrieve it through `GET /api/events/{id}`.

The React UI comes after this path works independently.

## Local database

On a fresh checkout, copy `.env.example` to `.env` and set `POSTGRES_PASSWORD`
before starting the database. The `.env` file is excluded from Git; commit only
the example containing a placeholder. Docker Compose automatically reads `.env`
from this project directory and substitutes the password into `compose.yaml`.

```powershell
Copy-Item .env.example .env
```

From the repository directory, run:

```powershell
docker compose up -d --wait db
docker compose exec -T db psql -U tracedeck -d tracedeck -c "SELECT current_database(), current_user;"
```

Connection settings for the backend running on your computer:

- JDBC URL: `jdbc:postgresql://localhost:5433/tracedeck`
- Username: `tracedeck`
- Password: the value of `POSTGRES_PASSWORD` in your local `.env` file

The password is set when PostgreSQL first initializes its data volume. Changing
`.env` later does not change an existing database user's password. The current
local setup keeps its existing password while moving it out of shared files.
An `.env` file is plain text, not encrypted storage. Spring Boot explicitly loads
it using `spring.config.import` in `application.properties`; Compose loading
`.env` does not automatically configure Java processes running on the host.

`compose.yaml` describes one database service. Docker downloads the PostgreSQL 16
image and runs it in a container. Port 5433 on this computer forwards to port 5432
inside that container. The port is bound to the local computer only.

The `postgres_data` volume keeps the database files when the container stops.
The health check waits until PostgreSQL accepts connections; the SQL command
above separately verifies that the configured database and user work.

Stop the database while retaining its data:

```powershell
docker compose down
```

## Backend

The backend uses Java 21 language features and Spring Boot 3.5.16. You can build
and run it with JDK 21 or a supported newer JDK (the local setup uses JDK 25).
The Maven wrapper downloads the project's Maven version, so a separate Maven
installation is unnecessary. The first build needs internet access.

With PostgreSQL running and the repository-root `.env` configured:

```powershell
cd backend
.\mvnw.cmd test
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=demo,verify-db"
```

Successful verification logs `Database connection verified: tracedeck`. The
`verify-db` profile runs a startup SQL query through the Java application's
connection. Without that profile, the additional verification query is skipped.
Stop the application with Ctrl+C. It listens on `http://localhost:8080`.
Requesting `/` returns HTTP 404 because we have not built a homepage.

There are currently 24 integration tests against local PostgreSQL: three for
retrieval, seven for import, six for search, and eight for investigation context.
Retrieval, search, and context tests roll
back their records. Import
tests verify committed writes and remove their own records afterward. They cover
batch limits, required fields, optional values, malformed JSON, indexed validation
errors, and rejecting a mixed valid/invalid batch without saving any events.
Isolated tests and CI setup will be added with the remaining features.

## Store and retrieve the first event

On startup, Spring executes `schema.sql` to create the events table and indexes
if absent. Hibernate then validates the entity mapping against that schema.
This bootstrap script does not migrate an existing table when its columns change;
versioned migrations can be added when schema changes are needed.

The `demo` profile saves one payment-timeout event through `EventRepository`
unless its fixed UUID already exists. It leaves existing records unchanged.
This is a temporary learning fixture, to be replaced by the 100-event dataset.
Starting without `demo` skips seeding but keeps any previously saved event.

In a second PowerShell terminal, request it:

```powershell
Invoke-RestMethod http://localhost:8080/api/events/00000000-0000-0000-0000-000000000001 | ConvertTo-Json
```

You can also open that URL in a browser or send GET from Postman. It returns the
stored event as JSON, including `source: payment-service`,
`eventType: PAYMENT_TIMEOUT`, and `requestId: req-1042`.

All four planned endpoints now exist: import, lookup, search, and context.
`GET /api/events/{id}` returns 200 for a stored event, 404 for an unknown UUID,
and 400 for an invalid UUID. Error bodies use Spring's `ProblemDetail` format.

The request path is controller -> service -> repository -> PostgreSQL. The
repository uses JPA/Hibernate to map an `Event` object to an `events` row. The
service converts the retrieved entity to an `EventResponse` record, and Spring's
JSON converter serializes it into the HTTP response. The first React checkpoint
now displays the search response in an event table.

## Import events

`POST /api/events/import` accepts a JSON array containing 1-500 events. An example
request is in `backend/src/main/resources/example-import.json`. From the repository
root, with the updated backend running, execute:

```powershell
$result = Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/events/import -ContentType application/json -InFile backend/src/main/resources/example-import.json
$result | ConvertTo-Json
Invoke-RestMethod "http://localhost:8080/api/events/$($result.eventIds[0])" | ConvertTo-Json
```

In Postman, select POST, enter the import URL, and select Body -> raw -> JSON.
Paste the example array and click Send. The response is HTTP 201:

```json
{
  "imported": 1,
  "message": "Events imported successfully",
  "eventIds": ["a-server-generated-uuid"]
}
```

The `eventIds` are generated by the server, in request order, so each imported
event can be retrieved through GET. Repeating an import creates new records;
this endpoint does not deduplicate events.

`EventRequest` defines input fields and Jakarta Bean Validation constraints.
The service validates every entry before converting requests to entities and
saving them in one transaction. IDs are not part of the input contract.

Required: `occurredAt` (ISO-8601 instant), `source` (max 50), `level` (INFO, WARN,
or ERROR), `eventType` (max 60), `message` (max 255), and `requestId` (max 40).
Text fields must not be blank. Optional: `statusCode` (100-599), `durationMs`
(nonnegative integer), and `details` (text; JSON within it is not validated).

Invalid requests return HTTP 400 with a `ProblemDetail` body and an `errors`
array. Fields use paths such as `events[1].durationMs`. Malformed JSON, invalid
timestamps, null entries, invalid batch sizes, and fractional integer values
are rejected. No events from a rejected batch are saved.

## Search and pagination

`GET /api/events` returns matching events, newest first. All parameters are
optional:

- `source`: exact service name, case-sensitive; supplied values must be nonblank
  and at most 50 characters. Omit the parameter to search all services.
- `from` and `to`: ISO-8601 instants with an offset, such as
  `2026-09-20T14:00:00Z`. Bounds are inclusive and can be supplied independently.
  `from` must not be later than `to`.
- `page`: zero-based page number, default 0; must not be negative.
- `size`: events per page, default 20; must be between 1 and 50.

Example URL for a browser or Postman GET request:

```text
http://localhost:8080/api/events?source=payment-service&from=2026-09-20T14:00:00Z&to=2026-09-20T15:00:00Z&page=0&size=2
```

The response has `content` (an array of event responses), `page`, `size`,
`totalElements` (all matches, not just this page), and `totalPages`. A page beyond
the available results returns HTTP 200 with empty `content`, retaining the total
counts. No matches means zero total elements and zero total pages.

`EventSpecifications` builds optional SQL conditions using JPA's criteria API.
`JpaSpecificationExecutor` lets the repository execute those conditions together
with a `PageRequest`. Filtering and pagination happen in PostgreSQL. The service
maps only the returned page into `EventResponse` objects. Sorting uses event time
descending and UUID ascending to resolve ties. Offset pagination can still shift
if events are imported between page requests; it does not provide a snapshot.

Manual checks after restarting the backend:

1. GET `/api/events` to see the default page and counts.
2. Add `source=payment-service` and verify every returned source.
3. Add a time range and confirm all event timestamps are within it.
4. Set `size=1`, then change `page=0` to `page=1` to retrieve the next match.
5. Try `page=-1`, `size=51`, a malformed timestamp, or reversed date bounds;
   each returns HTTP 400.

No level filter is implemented in this API; the planned UI's level filter will
apply only to the current page.

## Investigation context

`GET /api/events/{id}/context?limit=5` returns the selected event plus up to five
events sharing its request ID at or before its timestamp. The selected event is
excluded from the history query and returned separately. The optional `limit`
defaults to 5 and accepts integers from 1 to 5. An unknown event returns 404;
invalid IDs or limits return 400.

The response fields are:

- `selectedEvent`: the event identified by the URL.
- `precedingEvents`: the nearest matching events, displayed oldest to newest.
- `requestId`: the shared correlation key.
- `probableCause`: the event type of the earliest WARN or ERROR in the returned
  timeline, including the selected event; null if the timeline contains only INFO.
- `eventCount`: the number returned, including the selected event; not a count
  of every event in the full request.

The repository's JPQL query filters by request ID, timestamp, and selected ID.
JPQL refers to the Java entity and fields; Hibernate translates it to SQL.
`PageRequest` limits the database query without fetching the whole request
history or issuing a total-count query. Results arrive newest first, with UUID
descending as a tie-breaker, and the service reverses them for display.

Equal-timestamp events are included, with UUID ordering for determinism only;
timestamps and UUIDs cannot establish their actual causal order. The probable
cause is a heuristic based on the returned window, not proven root cause or a
search of the entire request. Search filters do not restrict investigation context
because context must include related events from other services.

To demonstrate a complete trace, restart the backend and POST the array in
`backend/src/main/resources/example-trace.json` to `/api/events/import`. Copy the
last ID in `eventIds` (the checkout failure) and GET its `/context` URL. Expect
three preceding events, `eventCount: 4`, and
`probableCause: PAYMENT_PROVIDER_SLOW`. With `limit=1`, expect only the warning
plus the selected error. Reimporting the fixture creates additional records with
the same request ID; change its request ID for a fresh independent demonstration.

From the repository root, the same demonstration in PowerShell is:

```powershell
$trace = Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/events/import -ContentType application/json -InFile backend/src/main/resources/example-trace.json
$failureId = $trace.eventIds[-1]
Invoke-RestMethod "http://localhost:8080/api/events/$failureId/context" | ConvertTo-Json -Depth 10
```

Files to understand first:

- `backend/pom.xml`: Maven build configuration and dependency list. Web adds HTTP
  handling, JPA adds database mapping, validation adds input checks, and the
  PostgreSQL driver implements communication with PostgreSQL.
- `backend/src/main/java/com/tracedeck/TraceDeckApplication.java`: the Java entry
  point. `@SpringBootApplication` enables configuration and component discovery.
- `backend/src/main/resources/application.properties`: database connection
  settings and local server configuration, with the password read from `.env`.
- `backend/src/main/java/com/tracedeck/DatabaseConnectionCheck.java`: a startup
  component for verifying the connection. Spring supplies `JdbcTemplate` through
  its constructor; the component uses it to execute SQL.

## Build and learning checkpoints

For each checkpoint, explain the input, the code or tool responsible, and the
output before continuing. The first checkpoint is complete when PostgreSQL
successfully answers the verification query. The full first milestone is complete
when the demo event is stored and returned through the HTTP endpoint.
The four backend endpoints and 24 integration tests are implemented. The first
frontend checkpoints display events, support page navigation, filter by source and
UTC time, and investigate events in a context drawer.
Frontend JSON importing and the 100-event dataset are implemented. Remaining UI polish, CI,
benchmark, and final interview review remain future
checkpoints. The suite currently requires a local PostgreSQL database and is
not yet configured to run in GitHub Actions.

## Frontend checkpoint 1: fetch and display events

The frontend uses React 18, Vite 8, TypeScript, and plain CSS. Use Node 22.12+
or a compatible newer release; the local setup uses Node 24.19.0.
Keep Spring Boot running on port 8080. In a separate PowerShell terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. This checkpoint fetches
`GET /api/events?page=0&size=20`, displays the first page newest first, and
shows the returned count alongside the database total. Refresh requests the
same page again. Timestamps are explicitly displayed in UTC; missing durations
display a dash, while zero remains `0 ms`.

Loading, connection-error/retry, and empty-result states are included. If the
database is empty, start Spring Boot with the existing `demo` profile or import
the sample JSON through the API, then click Refresh events. Alternatively, use
the frontend Import events form described in checkpoint 6 below.

Files to read in order:

1. `frontend/src/types.ts` describes the event and page JSON shapes. TypeScript
   checks code against these types during development; it does not validate
   incoming JSON at runtime.
2. `frontend/src/api/events.ts` sends the HTTP request using the browser's
   `fetch` function and checks HTTP status codes before reading JSON.
3. `frontend/src/App.tsx` holds loading, error, and response values in React
   state. Its effect fetches on mount and refresh, and cancels obsolete requests.
4. `frontend/src/components/EventTable.tsx` receives events as props and uses a
   readable loop to create table rows, keyed by each event's UUID.
5. `frontend/src/main.tsx` mounts the app in `index.html`; `styles.css` supplies
   the responsive dark theme.
6. `frontend/vite.config.ts` forwards development `/api` requests to
   `http://127.0.0.1:8080`. The browser talks to Vite on the same origin, so this
   local setup requires no backend CORS change. This proxy is development-only;
   hosting the built files later requires API routing to be configured separately.

`package.json` defines dependencies and npm commands; `package-lock.json` locks
the resolved versions so `npm ci` can reproduce the installation. `tsconfig.json`
enables strict TypeScript checks. React Strict Mode may start and cancel an extra
request during development; cleanup prevents obsolete results from updating state.

Verify a production build with `npm run build` from `frontend`. This runs
TypeScript checking and writes static files into ignored `frontend/dist/`.
Manual checks: verify the seeded payment event appears, use Refresh events, and
stop the backend temporarily to check the error state. Restart it and use Retry
connection to recover. Demo-data loading,
and summary cards remain later checkpoints.

## Frontend checkpoint 2: pagination

Previous and Next browse server-side pages of 20 events. The footer shows the
visible event range, total count, and current page. Previous is disabled on the
first page, Next on the last page, and both while loading. Refresh and Retry
request the currently selected page.

`App.tsx` now remembers `pageNumber` separately from the response stored in
`page`. Page numbers sent to Spring start at 0; displayed page numbers start
at 1. Changing `pageNumber` reruns the existing effect because it appears in
the dependency array. `api/events.ts` accepts that number and puts it in the
request URL. The backend continues to perform pagination in PostgreSQL.
No new packages or source files were needed for this checkpoint.

The Previous button uses `setPageNumber(current => current - 1)`; Next uses
`current + 1`. Passing a function to the setter tells React to calculate the
next value from the latest state. The response's `totalPages` determines
whether another page exists. An empty page after data changes shows a recovery
message and allows Previous, instead of suggesting that the entire database
is empty.

Verified with 21 temporary events plus the existing event: page 1 showed 1-20
of 22; page 2 showed 21-22; Refresh retained page 2; first/last-page buttons
were disabled correctly. The temporary records were removed afterward, and
returning from the empty second page to the original event was verified.
The TypeScript check and Vite production build passed. With only the original
event present, both page buttons are expected to be disabled.

## Frontend checkpoint 3: source filtering

Choose a source and press Apply filter. The selector lists the four services
planned for the deterministic demo dataset; it does not discover services from
the database. All services omits the source parameter entirely. The backend
performs exact, case-sensitive matching in PostgreSQL before paginating results.
Clear filter returns to all services. Both applying and clearing reset the page
to 0 (displayed as page 1). Refresh and page navigation keep the applied source.

The new `frontend/src/components/FilterBar.tsx` describes a labeled selector and
Apply/Clear buttons. Its props include the selected value and functions supplied
by `App.tsx`. Calling those functions tells the parent about user actions.
The form prevents the browser's default submit behavior so React can update
the query without reloading the entire document.

`App.tsx` keeps `draftSource` (the selector's current value) separate from
`source` (the applied query). Selecting a value updates the draft; applying it
updates the query and triggers the fetch effect. The event stream heading shows
the applied source so pending edits are not mistaken for active filters.
`api/events.ts` uses `URLSearchParams` to construct and encode query parameters.
No backend changes or new packages were needed.

Verified in the browser: editing the selector waits for Apply; no-match results
show a filter-specific message; Clear restores all services; a filtered 21-event
result paginates correctly; Refresh retains the filter and page; applying another
source or clearing from page 2 returns to page 1. The temporary test records were
removed afterward, preserving the original event. The TypeScript check and Vite
production build passed. Time filtering is covered by the next checkpoint below.

## Frontend checkpoint 4: UTC time filtering

From (UTC) and To (UTC) are optional date/time inputs. Values are interpreted as
UTC regardless of the computer's timezone, even when the browser displays the
controls in a regional format such as AM/PM. Apply filters combines source and
time bounds and returns to page 1. Clear filters clears all three fields, any
validation message, and the applied query. Refresh and pagination retain the
applied bounds. The event stream shows the applied UTC range separately from
the draft inputs.

Bounds are inclusive and use the exact instant entered. For example,
`2026-09-20T14:02` becomes `2026-09-20T14:02:00.000Z`; it does not include the
remainder of that minute. Seconds and milliseconds are supported. Either bound
may be omitted. Equal bounds are valid. Reversed ranges show an error without
changing the applied results or requesting data. Native input validation and
the conversion helper reject invalid dates.

`frontend/src/api/filterDates.ts` converts the timezone-free input strings to
explicit UTC instants and validates their order. `FilterBar.tsx` uses input
events to update draft state in `App.tsx`; Apply validates and copies those
drafts into the applied query. `api/events.ts` adds nonblank `from` and `to`
parameters using `URLSearchParams`. Filtering remains in PostgreSQL; no backend
changes were required.

Run `npm test` in `frontend` for five frontend tests covering UTC conversion,
optional/equal bounds, reversed ranges, invalid calendar dates, and construction
of the paginated/source/time API request. These use Node's built-in test runner
and TypeScript stripping on the documented Node version, with no new packages.
They are separate from the 24 backend integration tests.

Verified against the stored event in the browser: combined source and equal
timestamp bounds include the event; reversed bounds show an error while keeping
the applied range; a From-only range with no matches shows the empty state;
a To-only range includes the event at the boundary; Refresh retains the range;
Clear returns to all events. The frontend tests and production build pass.
Investigation is covered by the next checkpoint below.

## Frontend checkpoint 5: investigation drawer

Each row has an Investigate button. It opens a modal side panel and requests
`GET /api/events/{id}/context?limit=5`. The panel displays up to five preceding
events plus the selected event, oldest first in UTC. Source/time table filters
are intentionally not sent to this endpoint, so related events from other
services and earlier timestamps remain visible.

The selected event is marked in the timeline. Its ID, status code, duration, and
optional details appear below. Details are rendered as text, not HTML. The event
count describes this returned window, not the entire request. Equal timestamps
do not establish causal order. The probable cause is labeled as a heuristic:
the earliest WARN or ERROR in the returned window, including the selected event.
An INFO-only timeline shows that no WARN or ERROR was found.

New files and responsibilities:

- `frontend/src/components/InvestigationDrawer.tsx` owns its context request,
  loading/error/retry state, and native modal dialog. Closing or unmounting it
  aborts the request; obsolete responses do not update state. Close and Escape
  return to the table with keyboard focus restored to the opening button.
- `frontend/src/components/Timeline.tsx` loops over the backend's ordered history
  followed by the selected event to describe the timeline entries.
- `frontend/tests/context.test.mjs` checks the context URL and signal, HTTP error
  handling, 404 recovery guidance, and cancellation propagation.

`EventTable.tsx` calls an `onInvestigate` prop supplied by `App.tsx`, passing the
clicked event to the parent. `App.tsx` remembers that event and renders the drawer
while it is selected. The event UUID is its React key, so a different selected
event gets fresh drawer state. `types.ts` describes the context response, and
`api/events.ts` contains `fetchEventContext`. The table query and context query
have separate state, so investigation failures do not clear the event table.

Nine frontend tests and the production build pass. Browser checks covered a
temporary four-event trace across services despite source/time table filters,
chronological order, selected-event marking, probable-cause display, INFO-only
and no-history cases, absent optional fields, Close/Escape and focus restoration,
and connection-error/retry recovery. Temporary test records were removed after
verification; the original event was preserved.

## Frontend checkpoint 6: import through the frontend

The preferred input workflow is now implemented: choose a JSON file in the
Import events panel and press Import events. The browser reads the file,
validates JSON syntax and the 1-500 batch size, and sends a JSON array to
`POST /api/events/import`. Spring performs field validation and saves the batch
in one transaction. A rejected batch displays indexed field errors and saves
no events. On success, the UI clears filters, returns to page 1, and requests
the updated table. Submitting the same file again creates additional records;
there is no deduplication or automatic retry of a POST.

To try a complete trace:

1. Click Download 4-event sample, or use `frontend/public/sample-trace.json`.
2. Choose that file using the Event JSON file control.
3. Click Import events. Expect a message reporting 4 imported events.
4. Find `CHECKOUT_FAILED` with request ID `req-context-example` and click
   Investigate on that row.
5. Expect REQUEST_RECEIVED (INFO), AUTHENTICATION_PASSED (INFO),
   PAYMENT_PROVIDER_SLOW (WARN), and CHECKOUT_FAILED (ERROR), in that order.
   The probable-cause heuristic should be PAYMENT_PROVIDER_SLOW.

The sample has four services and one shared request ID. When preparing your
own file, each event needs occurredAt (ISO-8601 timestamp with timezone), source,
level (INFO/WARN/ERROR), eventType, message, and requestId. Events from the same
request share a requestId even across different services; use a different ID
for an independent trace. statusCode, durationMs, and details are optional.
The import API section above documents field lengths and allowed values.
There is a file upload interface; a manual event-entry form is not implemented.

`frontend/src/components/EventImporter.tsx` owns file selection and import
feedback. Its onImported callback tells App to clear the filters and refetch.
`frontend/src/api/importEvents.ts` parses the file, sends the POST, and preserves
backend field errors. It distinguishes validation failures from unconfirmed
network/server outcomes, where the user should check the table before retrying.
`frontend/public/sample-trace.json` is a downloadable copy of the backend's
four-event fixture. Fourteen frontend tests and the production build pass.

Browser verification covered malformed JSON, a mixed valid/invalid batch with
no writes, successful sample upload, clearing a preexisting source filter,
automatic table refresh, and investigation of the imported four-event trace.
The four sample records were intentionally retained for interactive review.
At that checkpoint, the database contained 5 events (the original demo event
plus the 4 imported sample events). Importing the sample again adds 4 more.

## Dataset checkpoint: 100 deterministic events

`data/events.json` contains 100 synthetic events across four services and 20
request traces (five events each). Fourteen requests succeed, and six demonstrate
expired authentication, an unavailable cart item, a payment timeout, an unsupported
postal code, database connection acquisition failure, or a declined payment.
There are 82 INFO, 6 WARN, and 12 ERROR events. All timestamps fall on
2026-09-20 from 14:00:00 through 14:19:04 UTC.

Use Download 100-event dataset in the frontend, choose the downloaded file, and
press Import events. This adds 100 records; it does not remove existing sample
events. Five preexisting records plus one import means 105 total, not 100.
Avoid reimporting the same dataset when demonstrating context, since duplicate
request IDs mix repeated traces. Generating the file alone does not modify the
database.

`data/generate-events.mjs` reproduces both the canonical JSON and the identical
frontend download using fixed scenarios and readable loops. Run
`node data/generate-events.mjs` from the repository root. See `data/README.md`
for failure IDs, expected heuristic results, UTC filter examples, and a
successful-trace demonstration. Input values are deterministic; imported event
UUIDs are generated by the server.

Eighteen frontend tests and the production build pass. Four dataset tests verify
reproducibility and matching copies, 100 events/20 traces/four services, the six
failure scenarios versus fourteen successful traces, and import field constraints.
CI, the investigation benchmark, and final demo/docs remain future checkpoints.
