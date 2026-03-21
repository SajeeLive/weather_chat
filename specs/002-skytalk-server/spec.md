# Feature Specification: SkyTalk AI — Application Server

**Feature Branch**: `002-skytalk-server`
**Created**: 2026-03-21
**Status**: Draft
**Parent Feature**: [001-skytalk-ai-chat](../../001-skytalk-ai-chat/spec.md)

## Overview

The SkyTalk server is the secure orchestration layer between the user's chat messages,
the external weather data provider, and the AI language model. It receives queries
over a persistent WebSocket connection, resolves the location, fetches meteorological
data, calls the AI to compose an empathetic response, and emits the result — along
with structured weather context — back to the client.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Process a Weather Query and Return an AI Response (Priority: P1)

A connected client sends a natural language query (e.g., "Will it rain in Boston
tomorrow?"). The server extracts the location, calls the weather data provider for the
relevant forecast, passes that data to the AI, and emits a conversational response
back to the client — along with a structured `WeatherContext` object identifying the
condition category (sunny, cloudy, rainy, stormy) so the client can update its theme.

**Why this priority**: This is the server's entire purpose. Nothing else functions
without a working query-to-response pipeline.

**Independent Test**: Can be fully tested by connecting a test WebSocket client,
sending a `query` event, and asserting that the server emits a `message` event
containing a readable AI response and a valid `WeatherContext` object.

**Acceptance Scenarios**:

1. **Given** a WebSocket client is connected, **When** it emits `query` with
   `{ text: "Is it going to snow in Denver this weekend?" }`, **Then** the server
   emits a `message` event containing a conversational AI response addressing snow
   likelihood in Denver and a `WeatherContext` with `condition: "snowy"` or
   `"cloudy"` as appropriate.
2. **Given** a weather API call succeeds, **When** the AI generates its response,
   **Then** the response text interprets the data empathetically (e.g., "There's a
   good chance of snow Saturday — great for skiing, but drive carefully.") rather than
   reciting raw numbers.
3. **Given** the AI requires weather data, **When** it invokes the weather tool,
   **Then** the server fetches from OpenWeatherMap and returns the result to the AI
   before the final response is composed.

---

### User Story 2 — Resolve Ambiguous and Colloquial Location Names (Priority: P2)

A user's query references a location by nickname ("The Big Apple"), colloquial name
("The Windy City"), or an ambiguous name ("Springfield"). The server resolves the
intended location before fetching weather data. For nicknames, it applies a known
mapping. For ambiguous names with multiple matches, it emits a clarification request
back to the client rather than guessing.

**Why this priority**: Location resolution is a prerequisite for accurate weather
data. Failing here silently (wrong city) is worse than asking for clarification.

**Independent Test**: Can be tested by sending queries with colloquial and ambiguous
location names to the WebSocket handler and verifying the server either resolves
correctly or emits a `clarification_needed` event.

**Acceptance Scenarios**:

1. **Given** a query contains "The Big Apple", **When** processed, **Then** the server
   resolves this to "New York" before the weather API call.
2. **Given** a query contains only "Springfield" with no country/state context,
   **When** processed, **Then** the server emits a `clarification_needed` event with
   the top candidate cities (e.g., Springfield, IL; Springfield, MA; Springfield, MO)
   for the client to present to the user.
3. **Given** a non-English location name (e.g., "Ciudad de México"), **When**
   processed, **Then** the server resolves it to the correct location and fetches
   weather data without error.

---

### User Story 3 — Handle Service Failures Gracefully (Priority: P3)

When the weather data provider is unavailable, rate-limited, or returns an error, the
server MUST NOT propagate a raw error to the client. Instead it emits a structured
`error` event with a user-friendly message. The WebSocket connection MUST remain open
and the client MUST be able to submit further queries.

**Why this priority**: Resilient orchestration is a constitution principle. The user
experience of a failed lookup must be indistinguishable from a conversational
clarification — never a broken state.

**Independent Test**: Can be tested by pointing the server at a mock weather API that
returns 500 errors, then asserting the server emits `error` events with human-readable
messages and keeps the WebSocket session alive.

**Acceptance Scenarios**:

1. **Given** the weather API returns a 500 error, **When** a client submits a query,
   **Then** the server emits `{ type: "error", message: "I couldn't reach the weather
   service right now — want to try again?" }` and keeps the session open.
2. **Given** the AI service is unreachable, **When** a client submits a query,
   **Then** the server emits a user-friendly error event (not a stack trace) and the
   session remains usable.
3. **Given** an error has occurred, **When** the client submits a subsequent query,
   **Then** the server processes it normally — errors do not corrupt session state.

---

### User Story 4 — Emit Structured Logs for All Significant Operations (Priority: P4)

Every inbound WebSocket event, outbound API call, and error condition produces a
structured JSON log entry including: timestamp, log level, correlation ID, operation
name, and a human-readable message. Location data MUST NOT appear in INFO-level or
higher logs.

**Why this priority**: Required by the constitution (Principle V). Logs are the
primary debugging surface for an interview demo with no persistent storage.

**Independent Test**: Can be tested by running the server, submitting queries, and
inspecting stdout — asserting valid JSON on each line with required fields present and
no raw location strings at INFO level.

**Acceptance Scenarios**:

1. **Given** a query is received, **When** the handler processes it, **Then** the log
   emits at least: `{ level: "info", correlationId, event: "query_received",
   timestamp }`.
2. **Given** a weather API call is made, **When** it completes (success or failure),
   **Then** a log entry records the outcome with duration but no raw location string
   at INFO level.
3. **Given** an unhandled error occurs, **When** it is caught, **Then** the log emits
   at `error` level with a stack trace to stderr, not stdout.

---

### Edge Cases

- What happens if a query arrives with no extractable location and no prior location
  context in the session?
- How does the server handle concurrent queries from the same client (e.g., user
  submits before previous response completes)?
- What happens if the AI tool invocation fails partway through composing a response?
- How does the server behave if the OpenWeatherMap API key is missing or invalid at
  startup?
- What happens if a query references a future date beyond the 7-day forecast window?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-S-001**: The server MUST accept WebSocket connections from clients and maintain
  session state for the duration of the connection.
- **FR-S-002**: The server MUST process `query` events from connected clients and
  respond with `message` events containing an AI-generated conversational response.
- **FR-S-003**: The server MUST include a `WeatherContext` object in every `message`
  event, containing at minimum: `condition` (one of: sunny, cloudy, rainy, stormy,
  neutral), `location`, and `temperatureCelsius`.
- **FR-S-004**: The server MUST use an AI language model with tool use — providing the
  weather data as a tool result rather than injecting raw data into the prompt.
- **FR-S-005**: The server MUST resolve colloquial city nicknames (e.g., "The Big
  Apple" → "New York") before querying the weather API.
- **FR-S-006**: The server MUST emit a `clarification_needed` event when a location
  name matches multiple cities without sufficient context to choose.
- **FR-S-007**: The server MUST emit a user-friendly `error` event (never a raw
  exception) when the weather API or AI service is unavailable.
- **FR-S-008**: The server MUST keep the WebSocket session open after any recoverable
  error.
- **FR-S-009**: The server MUST emit structured JSON logs for every inbound event,
  outbound API call, and error condition.
- **FR-S-010**: The server MUST NOT log location data at INFO level or above.
- **FR-S-011**: The server MUST expose a `GET /health` REST endpoint returning 200
  when operational.
- **FR-S-012**: All external API credentials MUST be loaded from environment variables
  — never hardcoded.

### Key Entities

- **Session**: An active WebSocket connection. Holds the ordered message history and
  the most recently resolved location for the connection lifetime.
- **WeatherContext**: Resolved meteorological state for a location/time. Fields:
  `condition` (sunny | cloudy | rainy | stormy | neutral), `location` (display name),
  `temperatureCelsius`, `precipitationProbability`, `windKph`, `humidity`,
  `forecastDays` (array for multi-day queries).
- **AITool**: A callable function exposed to the AI model. Tools defined:
  `getCurrentWeather(city)`, `getForecast(city, days)`.
- **NicknameMap**: A static lookup of colloquial city names to canonical names.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-S-001**: The server delivers a complete AI response within 8 seconds of
  receiving a query event under normal network conditions.
- **SC-S-002**: 100% of queries that trigger a weather API or AI failure result in
  a user-friendly error event — zero raw exceptions reach the client.
- **SC-S-003**: Every log line emitted to stdout is valid JSON with `timestamp`,
  `level`, `correlationId`, and `message` fields present.
- **SC-S-004**: The server handles a minimum of 10 concurrent WebSocket sessions
  without session state cross-contamination.
- **SC-S-005**: The health endpoint responds within 100ms under no load.

## Assumptions

- The server runs on Node.js 20 LTS. No containerization required for the interview
  demo.
- OpenWeatherMap free tier (60 calls/minute) is sufficient for demo-scale traffic.
- The AI model is accessed via the Anthropic SDK (Claude) using tool use patterns.
- Session history is held in memory per connection; no Redis or external store needed.
- The colloquial nickname map covers the most common English-language city nicknames;
  exhaustive coverage is not required for v1.
