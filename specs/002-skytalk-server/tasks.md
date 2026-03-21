---
description: "Task list for 002-skytalk-server implementation"
---

# Tasks: SkyTalk AI — Application Server

**Input**: Design documents from `/specs/002-skytalk-server/` and `/specs/001-skytalk-ai-chat/`
**Prerequisites**: plan.md ✅ spec.md ✅ data-model.md ✅ contracts/trpc-router.md ✅ research.md ✅

**TDD Note**: Constitution Principle III is non-negotiable — tests are written before
implementation within each user story phase. Tasks are ordered accordingly.

**Organization**: Tasks grouped by user story to enable independent implementation
and testing of each story.

---

## Phase 1: Setup

**Purpose**: Initialize the server project with correct structure and tooling.

- [x] T001 Initialize Node.js/TypeScript project in `server/` (`pnpm init` + install all dependencies from plan.md)
- [x] T002 Create `server/tsconfig.json` (target: ES2022, module: NodeNext, strict: true, outDir: dist)
- [x] T003 [P] Create `server/jest.config.ts` (ts-jest preset, testMatch: tests/**/*.test.ts)
- [x] T004 [P] Create `server/.env.example` with `PORT`, `OPENWEATHERMAP_API_KEY`, `ANTHROPIC_API_KEY`, `LOG_LEVEL`
- [x] T005 [P] Add npm scripts to `server/package.json` (dev: tsx watch, build: tsc, test: jest, lint: tsc --noEmit)
- [x] T006 Create directory structure: `server/src/router/`, `server/src/services/`, `server/src/middleware/`, `server/src/types/`, `server/tests/unit/`, `server/tests/integration/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure required before any user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T007 Define all TypeScript interfaces in `server/src/types/index.ts` (WeatherCondition, WeatherContext, ForecastDay, Message, Session, Location, LocationCandidate, ChatEvent, SelectLocationInput, HealthResponse)
- [x] T008 Create pino logger factory in `server/src/middleware/logger.ts` (JSON output, log levels, `createSessionLogger(correlationId)` child logger helper)
- [x] T009 Create `server/src/router/index.ts` — initialize tRPC (`initTRPC.create()`), register custom errorFormatter that strips stack traces, export `appRouter` stub and `AppRouter` type
- [x] T010 Create Express app + tRPC HTTP adapter + tRPC WebSocket adapter in `server/src/index.ts` (single port 4000; load dotenv; validate required env vars at startup — throw if missing)
- [x] T011 [P] Load and validate environment variables at startup in `server/src/index.ts` (fail fast with clear message if `OPENWEATHERMAP_API_KEY` or `ANTHROPIC_API_KEY` is absent)

**Checkpoint**: `pnpm dev` starts without errors; `curl localhost:4000` reaches Express.

---

## Phase 3: User Story 1 — Process a Weather Query and Return an AI Response (P1) 🎯 MVP

**Goal**: A client sends a natural language weather query; the server returns an AI-generated
empathetic response with a `WeatherContext` object over the `chatStream` subscription.

**Independent Test**: Connect a Jest WebSocket test client, call `sendQuery`, subscribe to
`chatStream`, and assert a `message` event arrives with readable text and valid `WeatherContext`.

> **TDD — Write tests first, confirm they fail, then implement.**

### Tests for User Story 1

- [x] T012 [P] [US1] Write unit test for `weatherService.getCurrent()` in `server/tests/unit/weatherService.test.ts` (mock axios; assert WeatherContext shape returned for valid city)
- [x] T013 [P] [US1] Write unit test for `weatherService.getForecast()` in `server/tests/unit/weatherService.test.ts` (mock axios; assert ForecastDay[] returned for valid city + days)
- [x] T014 [P] [US1] Write unit test for OWM `weather[0].main` → `WeatherCondition` mapper in `server/tests/unit/weatherService.test.ts` (assert "Clear"→"sunny", "Thunderstorm"→"stormy", etc.)
- [x] T015 [US1] Write integration test for full `sendQuery` → `chatStream` round-trip in `server/tests/integration/router.test.ts` (mock OWM + mock ChatAnthropic; assert `loading` event then `message` event with WeatherContext)

### Implementation for User Story 1

- [x] T016 [P] [US1] Implement `weatherService.getCurrent(city: string): Promise<WeatherContext>` in `server/src/services/weatherService.ts` (GET `api.openweathermap.org/data/2.5/weather`, map response to WeatherContext)
- [x] T017 [P] [US1] Implement `weatherService.getForecast(city: string, days: number): Promise<ForecastDay[]>` in `server/src/services/weatherService.ts` (GET `api.openweathermap.org/data/2.5/forecast`, aggregate 3-hour slots into daily ForecastDay entries)
- [x] T018 [P] [US1] Implement OWM condition mapper `mapOwmCondition(main: string): WeatherCondition` in `server/src/services/weatherService.ts` (Clear→sunny, Clouds→cloudy, Rain/Drizzle→rainy, Thunderstorm→stormy, else→cloudy)
- [x] T019 [US1] Implement `aiService.ts` with LangChain agent in `server/src/services/aiService.ts`:
  - Instantiate `ChatAnthropic({ model: 'claude-sonnet-4-6', streaming: true })`
  - Define system prompt (empathetic accuracy, contextual relevance, tone, safety, clarification, scope rules)
  - Define `getCurrentWeather` and `getForecast` LangChain tools using `tool()` from `langchain/tools` with Zod schemas
  - Call `llm.bindTools([getCurrentWeather, getForecast])`
  - Add pino LangChain callback for tool invocation logging
- [x] T020 [US1] Implement `chatStream` subscription procedure in `server/src/router/index.ts` (create/store Session with correlationId on connect; expose observable; destroy Session on disconnect)
- [x] T021 [US1] Implement `sendQuery` mutation in `server/src/router/index.ts` (validate input with Zod; emit `{ type: 'loading' }`; invoke aiService; emit `{ type: 'message', payload }` with WeatherContext; catch errors → emit `{ type: 'error' }`)
- [x] T022 [US1] Implement `health` query procedure in `server/src/router/index.ts` (return `{ status: 'ok', timestamp }`)

**Checkpoint**: Tests T012–T015 pass. `sendQuery` with a real city returns an AI response within 8 seconds.

---

## Phase 4: User Story 2 — Resolve Ambiguous and Colloquial Location Names (P2)

**Goal**: Colloquial nicknames resolve correctly; ambiguous city names trigger a
`clarification_needed` event rather than a silent wrong-city lookup.

**Independent Test**: Send queries with "The Big Apple", "The Windy City", and "Springfield"
via the tRPC test client. Assert correct resolution or `clarification_needed` event respectively.

> **TDD — Write tests first, confirm they fail, then implement.**

### Tests for User Story 2

- [x] T023 [P] [US2] Write unit tests for `nicknameMap` resolution in `server/tests/unit/weatherService.test.ts` (assert "big apple"→"New York", "windy city"→"Chicago", "ciudad de mexico"→"Mexico City")
- [x] T024 [P] [US2] Write unit tests for OWM geocoding disambiguation in `server/tests/unit/weatherService.test.ts` (mock OWM geocoding returning 3 candidates; assert LocationCandidate[] returned)
- [x] T025 [US2] Write integration test for `clarification_needed` event in `server/tests/integration/router.test.ts` (send "Springfield" query; assert `chatStream` emits `{ type: 'clarification_needed', payload: { candidates: [...] } }`)
- [x] T026 [US2] Write integration test for `selectLocation` mutation in `server/tests/integration/router.test.ts` (call selectLocation with a candidate; assert server re-processes and emits `loading` → `message`)

### Implementation for User Story 2

- [x] T027 [P] [US2] Implement `nicknameMap` constant and `resolveNickname(input: string): string` in `server/src/services/weatherService.ts` (lowercase + trim input; map common English nicknames and non-English city names to canonical OWM city names)
- [x] T028 [US2] Implement `geocodeCity(city: string): Promise<Location | LocationCandidate[]>` in `server/src/services/weatherService.ts` (GET `api.openweathermap.org/geo/1.0/direct?q={city}&limit=5`; if 1 result → return Location; if >1 result → return LocationCandidate[]; if 0 results → throw user-friendly error)
- [x] T029 [US2] Integrate `resolveNickname` + `geocodeCity` into the `sendQuery` flow in `server/src/router/index.ts` (run nickname resolution before geocoding; if LocationCandidate[] returned → emit `clarification_needed` and halt; store resolved Location in Session)
- [x] T030 [US2] Implement `selectLocation` mutation in `server/src/router/index.ts` (validate SelectLocationInput with Zod; update Session.lastResolvedLocation; re-run AI query pipeline with confirmed location)

**Checkpoint**: Tests T023–T026 pass. "The Big Apple" resolves to New York weather. "Springfield" triggers clarification options.

---

## Phase 5: User Story 3 — Handle Service Failures Gracefully (P3)

**Goal**: Weather API and AI failures produce user-friendly `error` events on `chatStream`
without crashing or closing the WebSocket session.

**Independent Test**: Mock OWM to return 500; mock ChatAnthropic to throw. Assert
`chatStream` emits `{ type: 'error', payload: { message: '...', retryable: true } }`
and the session accepts a subsequent query normally.

> **TDD — Write tests first, confirm they fail, then implement.**

### Tests for User Story 3

- [x] T031 [P] [US3] Write integration test: OWM 500 → `error` event with retryable: true in `server/tests/integration/router.test.ts` (mock axios to throw; assert session stays open and next query succeeds)
- [x] T032 [P] [US3] Write integration test: AI service unavailable → `error` event in `server/tests/integration/router.test.ts` (mock ChatAnthropic to throw; assert user-friendly message emitted, no stack trace)
- [x] T033 [US3] Write integration test: error does not corrupt session state in `server/tests/integration/router.test.ts` (trigger error; send valid subsequent query; assert `message` event arrives normally)

### Implementation for User Story 3

- [x] T034 [P] [US3] Add try/catch around OWM axios calls in `server/src/services/weatherService.ts` — catch network errors, 4xx, 5xx; throw typed `WeatherServiceError` with user-friendly message and retryable flag
- [x] T035 [P] [US3] Add try/catch around LangChain agent invocation in `server/src/services/aiService.ts` — catch model errors; throw typed `AIServiceError` with user-friendly message
- [x] T036 [US3] Centralize error-to-ChatEvent mapping in `server/src/router/index.ts` — catch `WeatherServiceError` and `AIServiceError` in `sendQuery` and `selectLocation`; emit `{ type: 'error', payload: { message, retryable } }` without re-throwing (keeps session alive)
- [x] T037 [US3] Verify tRPC errorFormatter in `server/src/router/index.ts` strips all internal details (stack trace, axios internals) before any error reaches the client wire format

**Checkpoint**: Tests T031–T033 pass. Weather API and AI failures produce friendly messages; session accepts next query without reconnect.

---

## Phase 6: User Story 4 — Structured Logs for All Significant Operations (P4)

**Goal**: Every inbound event, outbound API call, and error produces a valid JSON log
line with `timestamp`, `level`, `correlationId`, and `message`. Location data never
appears at INFO level or above.

**Independent Test**: Run server, submit two queries, pipe stdout through `jq`; assert
every line is valid JSON with required fields. Grep for location strings at INFO level;
assert zero matches.

> **TDD — Write tests first, confirm they fail, then implement.**

### Tests for User Story 4

- [x] T038 [P] [US4] Write unit test for `createSessionLogger` in `server/tests/unit/logger.test.ts` (assert child logger always includes `correlationId` field in output; assert location string absent from INFO output)
- [x] T039 [US4] Write integration test for log structure in `server/tests/integration/router.test.ts` (capture stdout; submit query; parse each line as JSON; assert `timestamp`, `level`, `correlationId`, `message` fields present on every line)

### Implementation for User Story 4

- [x] T040 [P] [US4] Add `query_received` log entry (INFO, no location) in `server/src/router/index.ts` `sendQuery` handler using session's child logger
- [x] T041 [P] [US4] Add `weather_api_call` log entry (INFO, duration, no raw location) in `server/src/services/weatherService.ts` for each OWM request start + completion
- [x] T042 [P] [US4] Add `weather_api_error` log entry (ERROR, to stderr) in `server/src/services/weatherService.ts` error handler
- [x] T043 [US4] Add LangChain `BaseCallbackHandler` in `server/src/services/aiService.ts` — log `tool_invoked` (INFO, tool name only, no city) and `tool_completed` (INFO, duration) events via session logger
- [x] T044 [US4] Add `session_connected` and `session_disconnected` log entries (INFO) in `server/src/router/index.ts` `chatStream` subscription setup/teardown

**Checkpoint**: Tests T038–T039 pass. Every stdout line is valid JSON. No location strings visible at INFO level.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening across all user stories.

- [x] T045 [P] Add `pino-pretty` as dev dependency in `server/package.json` for human-readable dev logs (only active when `NODE_ENV=development`)
- [x] T046 [P] Add ESLint + `@typescript-eslint` config in `server/.eslintrc.json` (no-any, explicit return types on public functions)
- [x] T047 Validate all 4 user stories end-to-end using the smoke test in `specs/001-skytalk-ai-chat/quickstart.md` (server half only — start server, run health check, submit 3 test queries)
- [x] T048 [P] Confirm `AppRouter` type export compiles cleanly in isolation (`tsc --noEmit` in server/) — required for client type-only import to work

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — blocks all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — this is MVP; implement first
- **US2 (Phase 4)**: Depends on Phase 2; integrates with US1 weatherService (additive only)
- **US3 (Phase 5)**: Depends on Phase 2; wraps US1 + US2 error paths (additive only)
- **US4 (Phase 6)**: Depends on Phase 2; adds logging to US1–US3 files (additive only)
- **Polish (Phase 7)**: Depends on all stories complete

### Within Each User Story

1. Tests written first → confirmed failing
2. Services implemented (weatherService before aiService)
3. Router procedures implemented (depend on services)
4. Tests confirmed passing
5. Checkpoint validated

### Parallel Opportunities

```bash
# Phase 3 — run in parallel:
Task: "Write unit test for weatherService.getCurrent()"    # T012
Task: "Write unit test for weatherService.getForecast()"   # T013
Task: "Write unit test for condition mapper"               # T014
# Then after all pass:
Task: "Implement getCurrent()"                             # T016
Task: "Implement getForecast()"                            # T017
Task: "Implement condition mapper"                         # T018

# Phase 4 — run in parallel:
Task: "Write unit tests for nicknameMap"                   # T023
Task: "Write unit tests for geocoding disambiguation"      # T024
# Then:
Task: "Implement nicknameMap + resolveNickname()"          # T027
Task: "Implement geocodeCity()"                            # T028 (after T027)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (tests → services → router)
4. **STOP and VALIDATE**: Call health endpoint; submit a real weather query; confirm `chatStream` emits loading → message with valid WeatherContext

### Incremental Delivery

1. Setup + Foundational → server starts cleanly
2. US1 → working query/response pipeline (MVP — demostrable)
3. US2 → colloquial names + disambiguation
4. US3 → graceful failure handling
5. US4 → structured logging hardening
6. Polish → lint, pretty logs, smoke test

---

## Notes

- `[P]` = parallelizable — different files, no unresolved dependencies
- `[US?]` maps each task to its user story for traceability
- Every test task precedes its implementation tasks within the same story
- The `AppRouter` type export (T009) MUST be present before client development begins
- Location data (city names, coordinates) MUST NOT appear in pino INFO-level output — use `[REDACTED]` or omit entirely
