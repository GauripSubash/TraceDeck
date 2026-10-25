# TraceDeck

TraceDeck is a local event investigation tool built with Spring Boot, React,
and PostgreSQL. Import synthetic service events, filter the event table, and
select an event to see related history across services using its `requestId`.

## Features

- Upload JSON files with batch validation and transactional saving.
- Filter events by service and UTC time range with server-side pagination.
- Investigate events in a chronological timeline spanning multiple services.
- See a probable-cause suggestion based on the earliest WARN or ERROR in the returned timeline.
- Explore a reproducible 100-event dataset with successful and failed requests.
- Run backend tests, frontend tests, and production builds through GitHub Actions.

Events are synthetic. TraceDeck does not connect to real services or collect live
logs. Its probable-cause suggestion is a heuristic, not proven root cause. A failed
request does not establish that an entire service is down.

## Technology

- **Backend:** Java 21, Spring Boot 3.5.16, Spring Web, Spring Data JPA/Hibernate,
  Jakarta Bean Validation, Maven Wrapper.
- **Database:** PostgreSQL 16 with Docker Compose.
- **Frontend:** React 18, TypeScript 5.9, Vite 8, plain CSS.
- **Verification:** Spring Boot integration tests with MockMvc and PostgreSQL,
  Node's built-in test runner, TypeScript checks, and GitHub Actions.

## Run locally

Install JDK 21, Node.js 24 with npm, and Docker with Docker Compose. Start Docker
before continuing. Maven is provided by the wrapper. Initial dependency downloads
require internet access. Commands below use PowerShell from the repository root.
Check for existing backend/frontend processes before starting another instance.

### Configure and start PostgreSQL

On a fresh checkout:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and replace the `POSTGRES_PASSWORD` placeholder with your local
development password. If `.env` already exists, preserve your existing settings.
The real `.env` is ignored by Git; `.env.example` contains only a placeholder.

```powershell
docker compose up -d --wait db
```

The database and user are `tracedeck`. Local port **5433** forwards to PostgreSQL
port 5432 inside the container. Compose reads `.env`; Spring Boot explicitly
imports it when launched from the repository root or `backend/`.

### Start the backend

In a terminal at the repository root:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

The API listens at `http://127.0.0.1:8080`. There is no backend homepage, so `/`
returns 404. On startup, `schema.sql` creates tables and indexes if absent, then
Hibernate validates the mappings. This script does not migrate existing schemas.

### Start the frontend

In another terminal at the repository root:

```powershell
cd frontend
npm ci
npm run dev
```

Open [TraceDeck](http://127.0.0.1:5173/). Vite forwards `/api` requests to the
backend during development. Keep both terminals running. On Windows, stop Vite
before rerunning `npm ci` to avoid locked native dependency files.

On macOS/Linux, copy the template with `cp` and use `./mvnw` instead of
`.\mvnw.cmd`. If necessary, run `chmod +x mvnw` from `backend/` first.

## Try an investigation

1. In **Import events**, download the 100-event dataset or choose
   [`data/events.json`](data/events.json) directly.
2. Select the file and click **Import events**. The table refreshes after import.
3. Apply source `checkout-service` and UTC bounds `2026-09-20 14:08:00`
   through `2026-09-20 14:08:04`.
4. Find `CHECKOUT_FAILED` for `req-demo-1009` and click **Investigate**.
5. The timeline shows five events across four services. Its earliest warning
   is `PAYMENT_PROVIDER_SLOW` from `payment-service`.

The dataset has 20 requests with five events each: 14 successful traces and six
failure traces. It contains 82 INFO, 6 WARN, and 12 ERROR events, dated September
20, 2026, from 14:00:00 through 14:19:04 UTC. A four-event sample is also
downloadable in the UI.

Imports append records without deduplication. Import the fixture once for a clean
demo; repeated request IDs can mix copies in context history. Existing records
remain, so your database total may exceed 100.

See the [dataset guide](data/README.md) for failure scenarios and expected results.
To regenerate the canonical fixture and its frontend download, run from the root:

```powershell
node data/generate-events.mjs
```

Generation writes JSON files only; it does not import records into PostgreSQL.

## Architecture

React sends HTTP requests to a Spring controller. The service layer validates
input and coordinates transactions. Spring Data JPA queries PostgreSQL and maps
stored events into API responses.

Search filtering and pagination execute in PostgreSQL. Results sort by timestamp
descending, then UUID ascending. The UI separates draft and applied filters.
Apply/Clear return to page 1; refresh and pagination preserve applied filters.
Date/time inputs are interpreted as UTC.

Investigation retrieves up to five other events sharing the selected event's
request ID at or before its timestamp. These appear oldest first alongside the
selected event. Table filters do not restrict context. Equal timestamps have
deterministic UUID ordering but do not establish causal order.

The probable-cause field is the earliest WARN or ERROR event type in this
returned window, including the selected event. It is null for INFO-only windows.

## API

Base URL: `http://127.0.0.1:8080`.

### `POST /api/events/import`

Accepts a JSON array of 1-500 events. The entire batch is validated before saving
in one transaction. Returns 201 with `imported`, `message`, and generated
`eventIds` in input order. Invalid batches return 400 without saving records.

Required fields: `occurredAt` (ISO-8601 timestamp with timezone), `source` (up to
50 characters), `level` (`INFO`, `WARN`, or `ERROR`), `eventType` (up to 60),
`message` (up to 255), and `requestId` (up to 40). Required text must be nonblank.
Optional fields: `statusCode` (100-599), `durationMs` (nonnegative integer), and
`details` (text). Details may contain JSON text but are not validated as JSON or
stored as JSONB. UUIDs are generated by the backend.

See the [sample payload](frontend/public/sample-trace.json). Errors use Spring's
`ProblemDetail` format with indexed field errors for batch validation.

### `GET /api/events`

Optional query parameters:

- `source`: exact, case-sensitive service name.
- `from`, `to`: inclusive ISO-8601 time bounds; either may be omitted.
- `page`: zero-based page number, default 0.
- `size`: page size from 1-50, default 20.

Malformed parameters and reversed ranges return 400. Responses contain `content`,
`page`, `size`, `totalElements`, and `totalPages`.

### `GET /api/events/{id}`

Returns a stored event, 404 for an unknown UUID, or 400 for a malformed UUID.

### `GET /api/events/{id}/context?limit=5`

Accepts a limit from 1-5. Returns `selectedEvent`, `precedingEvents`, `requestId`,
`probableCause`, and `eventCount`. The count includes the selected event and
returned history, not the full request. Unknown events return 404; invalid IDs
or limits return 400.

## Tests and CI

With PostgreSQL running and `.env` configured, run backend tests:

```powershell
cd backend
.\mvnw.cmd -B test
```

There are 24 integration tests: retrieval (3), import (7), search (6), and context
(8). They load Spring Boot, exercise request handling through MockMvc, and query
real PostgreSQL. Retrieval/search/context test writes roll back. Import tests
verify committed writes and remove their own records afterward.

From `frontend/`:

```powershell
npm test
npm run build
```

The 18 frontend tests cover date filters, context requests, import behavior, and
dataset consistency using Node's test runner and fetch mocks. They are not browser
UI tests. The build runs `tsc --noEmit && vite build` and writes `frontend/dist/`.

The [GitHub Actions workflow](.github/workflows/ci.yml) runs on pushes and pull
requests with two independent Ubuntu jobs:

- **Backend tests:** Java 21, Maven caching, and a disposable PostgreSQL 16 service.
  Spring environment variables override local database settings.
- **Frontend checks:** Node 24, npm caching, `npm ci`, `npm test`, and `npm run build`.

See the repository's Actions tab for hosted run results. CI tests and builds the
application; it does not deploy it.

## Project structure

```text
backend/                 Spring Boot API, schema, Maven wrapper, integration tests
frontend/                React UI, frontend tests, downloadable fixtures
data/                    Canonical dataset, generator, scenario guide
benchmark/               Study protocol, task cards, results template
.github/workflows/ci.yml  Backend and frontend CI jobs
compose.yaml             Local PostgreSQL service and persistent volume
.env.example             Configuration template without real credentials
```

## Configuration and limits

- Data persists in the `postgres_data` Docker volume. Stop PostgreSQL while
  retaining its data with `docker compose down` from the repository root.
- The password is applied when the volume first initializes. Editing `.env`
  later does not change an existing PostgreSQL user's password.
- Optional backend profiles: `demo` seeds one fixed-ID event if absent;
  `verify-db` logs a database connection check. From `backend/`, run
  `.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=demo,verify-db"`.
- Authentication, live logging, alerts, and production hosting/API routing are
  not configured. Vite's API proxy is for development.
- The [investigation benchmark](benchmark/README.md) is prepared; no measured
  performance improvement is reported yet.
